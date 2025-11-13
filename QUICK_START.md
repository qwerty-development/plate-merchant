# 🚀 Quick Start - FCM Notifications

## ✅ Setup Complete - Ready to Test!

All configuration is done. Just build and test!

---

## Build & Deploy

```bash
# Clean build
cd android && ./gradlew clean && cd ..

# Build and install on Samsung A9
npx expo run:android
```

---

## What Should Happen

### When App Opens:
1. ✅ FCM token registers automatically
2. ✅ Console shows: "✅ [FCM] Token registered successfully"
3. ✅ Entry appears in Supabase `device_tokens` table

### When Booking Arrives:
1. ✅ Device wakes up (even if locked)
2. ✅ Full-screen notification appears
3. ✅ **Sound loops continuously** (not just once)
4. ✅ Notification repeats every 10 seconds
5. ✅ Works even when app is closed

### When Staff Responds:
1. ✅ Tap "Accept" or "Decline"
2. ✅ Sound stops immediately
3. ✅ Notifications clear

---

## Quick Test

1. **Open app on tablet** → Login as restaurant staff
2. **From another device**, create test booking
3. **Expected**: Sound + notification within 5 seconds
4. **Wait 10 seconds**: Another notification appears
5. **Accept booking**: Sound stops

---

## Troubleshooting

### No notification arrives?
```bash
# 1. Check device token registered
# Go to Supabase → Table Editor → device_tokens
# Should see entry for your restaurant

# 2. Check Edge Function logs
# Go to Supabase → Edge Functions → send-booking-fcm → Logs
# Look for "✅ FCM message sent" or errors

# 3. Verify secret is set
npx supabase secrets list | grep FIREBASE
```

### Sound doesn't play?
- Check device volume (both media and ring)
- Disable Do Not Disturb mode
- Check notification permissions in Android settings

---

## Files Modified

- ✅ `android/app/google-services.json` - Firebase config
- ✅ `app.json` - Added Firebase plugin
- ✅ `services/fcm-service.ts` - FCM implementation
- ✅ Supabase secrets - FIREBASE_SERVICE_ACCOUNT set
- ✅ Database - device_tokens table + trigger created
- ✅ Edge Function - send-booking-fcm deployed

---

## Architecture Summary

```
Booking Created
    ↓
Database Trigger
    ↓
Edge Function (gets OAuth token)
    ↓
Firebase Cloud Messaging
    ↓
Samsung A9 Tablet
    ↓
🔊 Sound loops + 📱 Notification repeats every 10s
```

---

## Key Points

✅ **Sound is continuous** - Uses `isLooping: true`, not one-time beep
✅ **Notifications repeat** - Auto-repeat every 10 seconds
✅ **Bypasses Doze mode** - FCM high-priority wakes device
✅ **Works when closed** - Background handler runs in Headless JS
✅ **Industry standard** - Same approach as Uber Eats

---

## That's It!

Just run:
```bash
npx expo run:android
```

And test with a real booking! 🎉

For detailed docs, see `DEPLOYMENT_COMPLETE.md`
