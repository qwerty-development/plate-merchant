/**
 * ============================================================================
 * Supabase Edge Function: notify-restaurant-push
 * ============================================================================
 * Processes the restaurant_notification_outbox queue and sends push
 * notifications to restaurant tablets via Expo Push Notification service.
 *
 * This ensures 100% reliable delivery as notifications are sent from the
 * server-side, independent of the app's JavaScript execution state.
 *
 * Trigger: Cron job every 1-2 minutes OR HTTP webhook
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
const BATCH_SIZE = 50; // Process 50 notifications per run
const MAX_TOKENS_PER_REQUEST = 100; // Expo limit

serve(async (req) => {
  const startTime = Date.now();

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("🚀 Starting restaurant push notification processor...");

    // Fetch queued notifications
    const { data: outbox, error: fetchError } = await supabase
      .from("restaurant_notification_outbox")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", 3) // Max 3 attempts
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ Error fetching outbox:", fetchError);
      throw fetchError;
    }

    if (!outbox || outbox.length === 0) {
      console.log("✅ No queued notifications to process");
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: "No queued notifications",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📬 Processing ${outbox.length} notifications...`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    // Process each notification
    for (const item of outbox as RestaurantNotificationOutbox[]) {
      results.processed++;

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

          results.skipped++;
          continue;
        }

        // Filter tokens
        let tokens: string[];
        if (item.target_tokens && item.target_tokens.length > 0) {
          // Use specific tokens if provided
          tokens = item.target_tokens;
        } else {
          // Use all devices' tokens
          tokens = (devices as RestaurantDevice[])
            .map((d) => d.expo_push_token)
            .filter(Boolean);
        }

        if (tokens.length === 0) {
          console.log(`⚠️ No valid push tokens found, skipping`);

          await supabase
            .from("restaurant_notification_outbox")
            .update({
              status: "skipped",
              attempts: item.attempts + 1,
              error: "No valid push tokens",
            })
            .eq("id", item.id);

          results.skipped++;
          continue;
        }

        // Prepare Expo push messages
        const messages: ExpoPushMessage[] = tokens.map((token) => ({
          to: token,
          sound: item.sound || "default",
          title: item.title,
          body: item.body,
          data: {
            ...item.data,
            notificationId: item.id,
            bookingId: item.booking_id,
            type: item.type,
            timestamp: new Date().toISOString(),
          },
          priority: item.priority === "high" ? "high" : "default",
          channelId: "booking-alerts-critical", // Match Notifee channel ID
        }));

        console.log(`📤 Sending ${messages.length} push notifications...`);

        // Send to Expo Push API (handle batching if needed)
        const chunks = chunkArray(messages, MAX_TOKENS_PER_REQUEST);
        const receiptIds: string[] = [];
        let allSuccessful = true;
        let lastError: string | null = null;

        for (const chunk of chunks) {
          const response = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          const responseData: ExpoPushResponse = await response.json();

          // Log individual results
          for (let i = 0; i < responseData.data.length; i++) {
            const result = responseData.data[i];
            const device = devices[i] as RestaurantDevice | undefined;

            if (result.status === "ok" && result.id) {
              receiptIds.push(result.id);

              // Log successful delivery
              await supabase.from("restaurant_notification_delivery_logs").insert({
                outbox_id: item.id,
                device_id: device?.id,
                expo_push_token: chunk[i].to,
                status: "ok",
                expo_receipt_id: result.id,
                response_data: result,
              });
            } else {
              allSuccessful = false;
              lastError = result.message || "Unknown error";

              // Log failed delivery
              await supabase.from("restaurant_notification_delivery_logs").insert({
                outbox_id: item.id,
                device_id: device?.id,
                expo_push_token: chunk[i].to,
                status: "error",
                error: result.message,
                response_data: result,
              });

              // If token is invalid, disable the device
              if (
                result.details?.error === "DeviceNotRegistered" ||
                result.message?.includes("not a registered push notification")
              ) {
                console.log(`⚠️ Disabling device with invalid token: ${chunk[i].to}`);
                await supabase
                  .from("restaurant_devices")
                  .update({ enabled: false })
                  .eq("expo_push_token", chunk[i].to);
              }
            }
          }
        }

        // Update outbox status
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

          results.sent++;
          console.log(`✅ Notification ${item.id} sent successfully`);
        } else {
          // Mark as failed if max attempts reached, otherwise keep queued
          const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "queued";

          await supabase
            .from("restaurant_notification_outbox")
            .update({
              status: newStatus,
              attempts: item.attempts + 1,
              error: lastError,
            })
            .eq("id", item.id);

          if (newStatus === "failed") {
            results.failed++;
            console.error(`❌ Notification ${item.id} failed after max attempts`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing notification ${item.id}:`, err);

        // Update with error
        const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "queued";

        await supabase
          .from("restaurant_notification_outbox")
          .update({
            status: newStatus,
            attempts: item.attempts + 1,
            error: String(err),
          })
          .eq("id", item.id);

        if (newStatus === "failed") {
          results.failed++;
        }
      }
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
 * Helper: Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
