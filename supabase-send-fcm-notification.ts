// Supabase Edge Function: send-fcm-notification
// Sends FCM push notifications to restaurant companion app tablets
// Separate from the "notify" function which handles customer app notifications

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingNotificationPayload {
  bookingId: string;
  restaurantId: string;
  guestName: string;
  partySize: number;
  bookingTime?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firebaseServerKey = Deno.env.get("FIREBASE_SERVER_KEY");

    if (!firebaseServerKey) {
      console.error('❌ FIREBASE_SERVER_KEY not set in environment');
      return new Response(
        JSON.stringify({
          error: 'Firebase Server Key not configured',
          message: 'Please set FIREBASE_SERVER_KEY in Supabase Edge Function secrets'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse request body
    const payload: BookingNotificationPayload = await req.json();
    const { bookingId, restaurantId, guestName, partySize, bookingTime } = payload;

    console.log('📱 Sending FCM notification for booking:', bookingId);

    // Get all active devices for this restaurant from restaurant_devices table
    const { data: devices, error: devicesError } = await supabase
      .from('restaurant_devices')
      .select('fcm_token, user_id, device_name')
      .eq('restaurant_id', restaurantId)
      .eq('enabled', true);

    if (devicesError) {
      console.error('❌ Error fetching devices:', devicesError);
      throw devicesError;
    }

    if (!devices || devices.length === 0) {
      console.log('⚠️ No devices registered for restaurant:', restaurantId);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No devices registered for this restaurant',
          restaurantId
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📱 Found ${devices.length} device(s) for restaurant ${restaurantId}`);

    // Send FCM notification to each device
    const results = [];

    for (const device of devices) {
      try {
        const fcmPayload = {
          to: device.fcm_token,
          priority: 'high',
          data: {
            type: 'new_booking',
            bookingId,
            guestName,
            partySize: partySize.toString(),
            restaurantId,
            bookingTime: bookingTime || '',
          },
          // Silent data-only message (app handles the notification)
          // This ensures the app wakes up even when killed
        };

        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${firebaseServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        const fcmResult = await fcmResponse.json();

        if (fcmResponse.ok && fcmResult.success === 1) {
          console.log(`✅ FCM sent to device ${device.device_name || device.fcm_token.substring(0, 20)}`);
          results.push({
            device_id: device.fcm_token.substring(0, 20) + '...',
            status: 'sent',
            message_id: fcmResult.results?.[0]?.message_id,
          });

          // Update last_seen timestamp
          await supabase
            .from('restaurant_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('fcm_token', device.fcm_token);

        } else {
          console.error(`❌ FCM failed for device:`, fcmResult);
          results.push({
            device_id: device.fcm_token.substring(0, 20) + '...',
            status: 'failed',
            error: fcmResult.error || fcmResult.results?.[0]?.error,
          });
        }

      } catch (deviceError) {
        console.error(`❌ Error sending to device:`, deviceError);
        results.push({
          device_id: device.fcm_token.substring(0, 20) + '...',
          status: 'error',
          error: String(deviceError),
        });
      }
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const failureCount = results.filter(r => r.status !== 'sent').length;

    console.log(`📊 FCM Results: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        restaurantId,
        totalDevices: devices.length,
        sent: successCount,
        failed: failureCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Edge Function error:', error);
    return new Response(
      JSON.stringify({
        error: String(error),
        message: 'Failed to send FCM notification'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
