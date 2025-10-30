

**Get Firebase Server Key (for later):**
- Firebase Console → Project Settings → Cloud Messaging → Copy "Server key"

---

## Step 2: Setup Supabase Backend (10 min)


**Verify:** Check Table Editor → `restaurant_devices` table should exist

### 2b. Deploy Edge Function

**Copy this file content:** `supabase-edge-function.ts` (see end of this file)

1. Supabase Dashboard → Edge Functions
2. Click "New Function"
3. Name: `send-fcm-notification`
4. Copy/paste the Edge Function code (from end of this file)
5. Click "Deploy"
6. Go to "Secrets" tab
7. Add secret:
   - Key: `FIREBASE_SERVER_KEY`
   - Value: [paste your Firebase Server Key from Step 1]

---

## Step 3: Build & Run App (5 min)

```bash
cd /Users/asif/Desktop/Work/plate-merchant

# Install dependencies
npm install

# Clean build (IMPORTANT: must use expo-dev-client for custom native code)
npx expo prebuild --clean

# Build and run on Android
npx expo run:android
```

**IMPORTANT:**
- Must use `npx expo run:android` (NOT `expo start`)
- App needs to be built with custom native code
- Cannot use Expo Go

---

## Step 4: Test It Works (5 min)

### Test 1: Check FCM Token Saved

1. Open app on tablet
2. Login
3. Check console logs for:
   ```
   ✅ FCM permission granted
   📱 FCM Token: [token]...
   ✅ FCM token saved to database
   ```
4. Verify in Supabase: Table Editor → `restaurant_devices` → Should see 1 row

### Test 2: Test Native Service

1. Go to Bookings screen
2. Tap 🟠 Orange Android button (top right)
3. Should hear sound for 5 seconds
4. **If this works, Layer 5 is functional!**

### Test 3: Create Real Booking

1. Create a booking with `status = 'pending'` in your database
2. All 5 layers should activate
3. Sound should play continuously

### Test 4: Force Close (ULTIMATE TEST)

1. Create pending booking
2. Sound starts playing
3. Swipe away app from Recent Apps
4. **Sound should STILL be playing!**
5. **If yes: System is BULLETPROOF! 🎉**

---

## Optional: Auto-Send FCM on New Bookings

If you want FCM push automatically sent when bookings are created:

1. Supabase Dashboard → SQL Editor
2. Run this SQL (replace `[YOUR_PROJECT_REF]` with your actual Supabase project ref):

```sql
-- Function to call Edge Function
CREATE OR REPLACE FUNCTION notify_restaurant_fcm(
    p_booking_id uuid,
    p_restaurant_id uuid,
    p_guest_name text,
    p_party_size integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This would use pg_net extension to call Edge Function
    -- For now, you can call the Edge Function manually from your app
    -- when a booking is created
    RAISE NOTICE 'Booking % needs FCM notification', p_booking_id;
END;
$$;

-- Trigger to call function
CREATE OR REPLACE FUNCTION trg_notify_on_pending()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        PERFORM notify_restaurant_fcm(NEW.id, NEW.restaurant_id, NEW.guest_name, NEW.party_size);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_fcm_trigger
AFTER INSERT OR UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION trg_notify_on_pending();
```

---

## Troubleshooting

### "Module @notifee/react-native does not exist"
```bash
npm install
npx expo prebuild --clean
npx expo run:android
```

### "google-services.json missing"
- Download from Firebase Console
- Place in project root
- Run `npx expo prebuild` again

### No sound when locked
- Must use `npx expo run:android` (not Expo Go)
- Check tablet volume (notifications, not media)
- Turn off Do Not Disturb

### FCM token not saving
- Check console logs for errors
- Verify `restaurant_devices` table exists
- Check user is logged in

---

## You're Done!

Once all 4 tests pass, your app has:

✅ Native Android Foreground Service
✅ FCM push notifications
✅ 5-layer redundancy
✅ Works when tablet locked
✅ Works when app force-closed
✅ Bulletproof notification system

---

## Edge Function Code

Save this as reference or use for deployment:

```typescript
// Supabase Edge Function: send-fcm-notification
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firebaseServerKey = Deno.env.get("FIREBASE_SERVER_KEY");

    if (!firebaseServerKey) {
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVER_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { bookingId, restaurantId, guestName, partySize } = await req.json();

    // Get devices for restaurant
    const { data: devices } = await supabase
      .from('restaurant_devices')
      .select('fcm_token')
      .eq('restaurant_id', restaurantId)
      .eq('enabled', true);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No devices registered' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send FCM to each device
    const results = [];
    for (const device of devices) {
      const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${firebaseServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: device.fcm_token,
          priority: 'high',
          data: {
            type: 'new_booking',
            bookingId,
            guestName,
            partySize: partySize.toString(),
            restaurantId,
          },
        }),
      });

      const result = await fcmResponse.json();
      results.push({ success: fcmResponse.ok, result });
    }

    const sent = results.filter(r => r.success).length;
    return new Response(
      JSON.stringify({ success: true, sent, total: devices.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```
