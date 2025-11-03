/**
 * ============================================================================
 * Supabase Edge Function: notify-restaurant-push (v2 - With Repeating)
 * ============================================================================
 * Processes the restaurant_notification_outbox queue AND handles repeating
 * notifications to ensure "ring ring ring" behavior until booking is handled.
 *
 * New in v2:
 * - Sends repeat notifications every 30 seconds for pending bookings
 * - Stops repeating when booking is accepted/declined
 * - Ensures tablets ALWAYS hear alerts even in deep sleep
 *
 * Trigger: Cron job every 1 minute OR HTTP webhook
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Types
interface RestaurantNotificationOutbox {
  id: string;
  restaurant_id: string;
  booking_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  sound: string;
  priority: string;
  status: string;
  attempts: number;
  max_attempts: number;
  target_tokens: string[] | null;
  repeat_enabled: boolean;
  repeat_interval: number;
  repeat_count: number;
}

interface RestaurantDevice {
  id: string;
  restaurant_id: string;
  device_id: string;
  expo_push_token: string;
  device_name: string | null;
  platform: string;
  enabled: boolean;
}

interface ExpoPushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: Record<string, any>;
  priority: "high" | "normal" | "default";
  channelId?: string;
}

interface ExpoPushResponse {
  data: Array<{
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: any;
  }>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 50;
const MAX_TOKENS_PER_REQUEST = 100;

serve(async (req) => {
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("🚀 Starting restaurant push notification processor (v2 - with repeating)...");

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      repeated: 0,
    };

    // ========================================================================
    // PART 1: Process NEW queued notifications
    // ========================================================================
    const { data: outbox, error: fetchError } = await supabase
      .from("restaurant_notification_outbox")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ Error fetching outbox:", fetchError);
      throw fetchError;
    }

    if (outbox && outbox.length > 0) {
      console.log(`📬 Processing ${outbox.length} new notifications...`);

      for (const item of outbox as RestaurantNotificationOutbox[]) {
        const success = await processNotification(supabase, item);
        results.processed++;
        if (success) results.sent++;
        else results.failed++;
      }
    }

    // ========================================================================
    // PART 2: Process REPEATING notifications
    // ========================================================================
    console.log("🔁 Checking for notifications that need repeating...");

    const { data: toRepeat, error: repeatError } = await supabase
      .rpc("get_notifications_to_repeat");

    if (repeatError) {
      console.error("❌ Error fetching repeating notifications:", repeatError);
    } else if (toRepeat && toRepeat.length > 0) {
      console.log(`🔔 Found ${toRepeat.length} notifications to repeat`);

      for (const item of toRepeat) {
        try {
          console.log(`🔁 Repeating notification for booking ${item.booking_id} (repeat #${item.repeat_count + 1})`);

          // Create a NEW outbox entry for the repeat
          const { data: newOutbox, error: insertError } = await supabase
            .from("restaurant_notification_outbox")
            .insert({
              restaurant_id: item.restaurant_id,
              booking_id: item.booking_id,
              type: item.type,
              title: item.title,
              body: item.body,
              data: {
                ...item.data,
                isRepeat: true,
                repeatCount: item.repeat_count + 1,
              },
              sound: "default",
              priority: "high",
              status: "queued",
              repeat_enabled: false, // Don't repeat the repeat
            })
            .select()
            .single();

          if (insertError) {
            console.error("❌ Error creating repeat notification:", insertError);
            continue;
          }

          // Update original notification's repeat tracking
          await supabase
            .from("restaurant_notification_outbox")
            .update({
              last_repeat_at: new Date().toISOString(),
              repeat_count: item.repeat_count + 1,
            })
            .eq("id", item.outbox_id);

          // Process the new repeat notification
          const success = await processNotification(supabase, newOutbox as any);
          if (success) {
            results.repeated++;
            console.log(`✅ Repeat notification sent successfully`);
          }
        } catch (err) {
          console.error(`❌ Error repeating notification:`, err);
        }
      }
    } else {
      console.log("✅ No notifications need repeating");
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Processing complete in ${duration}ms`);
    console.log(`📊 Results:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        duration,
        ...results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Process a single notification
 */
async function processNotification(
  supabase: any,
  item: RestaurantNotificationOutbox
): Promise<boolean> {
  try {
    console.log(`📝 Processing notification ${item.id} for restaurant ${item.restaurant_id}`);

    // Get restaurant devices
    const { data: devices, error: devicesError } = await supabase
      .from("restaurant_devices")
      .select("*")
      .eq("restaurant_id", item.restaurant_id)
      .eq("enabled", true);

    if (devicesError) {
      throw new Error(`Failed to fetch devices: ${devicesError.message}`);
    }

    if (!devices || devices.length === 0) {
      console.log(`⚠️ No active devices for restaurant ${item.restaurant_id}, skipping`);

      await supabase
        .from("restaurant_notification_outbox")
        .update({
          status: "skipped",
          attempts: item.attempts + 1,
          error: "No active devices registered",
        })
        .eq("id", item.id);

      return false;
    }

    // Get tokens
    const tokens: string[] = (devices as RestaurantDevice[])
      .map((d) => d.expo_push_token)
      .filter(Boolean);

    if (tokens.length === 0) {
      await supabase
        .from("restaurant_notification_outbox")
        .update({
          status: "skipped",
          attempts: item.attempts + 1,
          error: "No valid push tokens",
        })
        .eq("id", item.id);

      return false;
    }

    // Prepare messages
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: item.title,
      body: item.body,
      data: {
        ...item.data,
        notificationId: item.id,
        bookingId: item.booking_id,
        type: item.type,
        timestamp: new Date().toISOString(),
      },
      priority: "high",
      channelId: "booking-alerts-critical",
    }));

    console.log(`📤 Sending ${messages.length} push notifications...`);

    // Send to Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const responseData: ExpoPushResponse = await response.json();

    // Process results
    const receiptIds: string[] = [];
    let allSuccessful = true;
    let lastError: string | null = null;

    for (let i = 0; i < responseData.data.length; i++) {
      const result = responseData.data[i];
      const device = devices[i] as RestaurantDevice | undefined;

      if (result.status === "ok" && result.id) {
        receiptIds.push(result.id);

        await supabase.from("restaurant_notification_delivery_logs").insert({
          outbox_id: item.id,
          device_id: device?.id,
          expo_push_token: messages[i].to,
          status: "ok",
          expo_receipt_id: result.id,
          response_data: result,
        });
      } else {
        allSuccessful = false;
        lastError = result.message || "Unknown error";

        await supabase.from("restaurant_notification_delivery_logs").insert({
          outbox_id: item.id,
          device_id: device?.id,
          expo_push_token: messages[i].to,
          status: "error",
          error: result.message,
          response_data: result,
        });

        // Disable invalid tokens
        if (
          result.details?.error === "DeviceNotRegistered" ||
          result.message?.includes("not a registered push notification")
        ) {
          console.log(`⚠️ Disabling device with invalid token: ${messages[i].to}`);
          await supabase
            .from("restaurant_devices")
            .update({ enabled: false })
            .eq("expo_push_token", messages[i].to);
        }
      }
    }

    // Update outbox
    if (allSuccessful && receiptIds.length > 0) {
      await supabase
        .from("restaurant_notification_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: item.attempts + 1,
          expo_receipt_ids: receiptIds,
        })
        .eq("id", item.id);

      console.log(`✅ Notification ${item.id} sent successfully`);
      return true;
    } else {
      const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "queued";

      await supabase
        .from("restaurant_notification_outbox")
        .update({
          status: newStatus,
          attempts: item.attempts + 1,
          error: lastError,
        })
        .eq("id", item.id);

      console.error(`❌ Notification ${item.id} failed`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error processing notification ${item.id}:`, err);

    const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "queued";

    await supabase
      .from("restaurant_notification_outbox")
      .update({
        status: newStatus,
        attempts: item.attempts + 1,
        error: String(err),
      })
      .eq("id", item.id);

    return false;
  }
}
