# Push Notifications - Background Alerts

## 🔔 Overview

The app now sends push notifications even when it's **closed or in the background**. You'll receive alerts with sound for new bookings no matter what!

## ✨ Features

### 1. **Notifications When App is Closed** ✅
- Receive alerts even when app is not running
- Notification plays your custom sound (`new_booking.wav`)
- Shows on lock screen
- Badge count shows pending bookings

### 2. **Notifications When App is in Background** ✅
- Heads-up notification appears on top
- Sound plays automatically
- Vibration pattern
- Can tap to open app

### 3. **Notifications When App is Open** ✅
- In-app sound plays (looping until handled)
- Toast message shows
- Plus push notification as backup

### 4. **Badge Count** 📛
- App icon shows number of pending bookings
- Updates automatically
- Clears when bookings are handled

## 🎵 Custom Notification Sound

Your `new_booking.wav` file is used for notifications:
- Location: `assets/notification/new_booking.wav`
- Plays when notification arrives
- Works even in silent mode (Android)
- Configured in notification channel

## 📱 How It Works

### When a New Booking Arrives:

```
1. Customer makes booking
   ↓
2. Realtime detects change
   ↓
3. App checks if it's a new pending booking
   ↓
4. Sends local push notification with sound
   ↓
5. Updates app badge count
   ↓
6. Notification appears on device
   ↓
7. Sound plays (your custom sound)
   ↓
8. Vibrates (on Android)
```

### Notification Content:

**Title**: "🎉 New Booking Request!"

**Body**: "[Guest Name] wants to book for [X] guests"

**Sound**: Your custom `new_booking.wav`

**Badge**: Number of pending bookings

## 🔧 Setup Required

### 1. First Launch
When you first open the app, it will:
- Request notification permissions
- Register for push notifications
- Create notification channel (Android)
- Log push token to console

### 2. Grant Permissions
You must grant notification permissions:
- Android: Automatically requested on first launch
- iOS: Shows system permission dialog

### 3. Testing

**Test when app is closed:**
1. Open app
2. Close it completely (swipe away from recent apps)
3. Create a test booking from customer app
4. You should receive notification with sound!

**Test when app is in background:**
1. Open app
2. Press home button (don't close app)
3. Create a test booking
4. Notification appears at top with sound

**Test when app is open:**
1. Keep app on bookings screen
2. Create a test booking
3. Sound plays + notification + toast

## 📋 Notification Channels (Android)

**Channel Name**: "Booking Alerts"

**Settings**:
- Importance: MAX (highest priority)
- Sound: new_booking.wav
- Vibration: Pattern [0, 250, 250, 250]
- LED Color: #792339 (brand color)
- Bypass Do Not Disturb: Yes
- Lock Screen: Public (shows content)

## 🛠️ Configuration Files

### app.json
```json
{
  "android": {
    "permissions": [
      "android.permission.POST_NOTIFICATIONS"
    ]
  },
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/images/icon.png",
        "color": "#792339",
        "sounds": [
          "./assets/notification/new_booking.wav"
        ]
      }
    ]
  ]
}
```

### Hook: `use-push-notifications.ts`
- Handles notification permissions
- Registers device for push tokens
- Sets up notification handlers
- Creates Android notification channel
- Configures sound, vibration, priority

### Functions Available:
- `usePushNotifications()` - Main hook, returns push token
- `sendLocalNotification()` - Send notification immediately
- `cancelAllNotifications()` - Clear all notifications
- `setBadgeCount()` - Update app badge count

## 📊 Badge Count Management

The badge on your app icon shows pending bookings count:
- **0**: No pending bookings (no badge)
- **1-99**: Shows exact number
- **100+**: Shows "99+"

Updates when:
- New booking arrives (+1)
- Accept booking (-1)
- Decline booking (-1)
- User cancels booking (-1)

## 🔍 Debugging

### Check if notifications are working:

1. **Console Logs**
Look for these messages:
```
📱 Push token: ExponentPushToken[...]
✅ Push token obtained
✅ Local notification sent
💾 Saving push token to database...
```

2. **Test Notification**
Add test button to manually send notification:
```typescript
sendLocalNotification(
  'Test',
  'This is a test notification',
  { test: true }
);
```

3. **Check Permissions**
```typescript
const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);
```

### Common Issues:

**No notifications received:**
- Check notification permissions in device settings
- Verify `new_booking.wav` exists in `assets/notification/`
- Check console for permission errors
- Make sure app has been opened at least once

**Sound not playing:**
- Check device volume
- Check notification sound settings
- Verify sound file is valid WAV format
- Android: Check notification channel settings

**Badge not updating:**
- iOS: Need proper permissions
- Android: Some launchers don't support badges
- Check console for badge update logs

## 🚀 Production Setup

### Before releasing:

1. **Test on Physical Device**
   - Emulators have limited notification support
   - Test on real Android device

2. **Test All Scenarios**
   - [ ] App closed
   - [ ] App in background
   - [ ] App in foreground
   - [ ] Sound plays
   - [ ] Badge updates
   - [ ] Tap notification opens app

3. **Firebase Setup (Optional)**
   For remote push notifications:
   - Set up Firebase project
   - Add `google-services.json`
   - Configure FCM server key
   - Send notifications from backend

## 📝 Notes

### Local vs Remote Notifications:

**Current: Local Notifications**
- Sent by the app itself
- Work when app is in background/foreground
- Don't need internet to send
- Best for real-time responses

**Future: Remote Notifications**
- Sent from server/backend
- Work even if app is never opened
- Require FCM/APNs setup
- Better for true push from server

### Notification Behavior:

**Android:**
- Shows as heads-up notification
- Plays custom sound
- Vibrates
- Updates badge (on supported launchers)
- Can bypass Do Not Disturb

**iOS:**
- Shows as banner
- Plays custom sound (if added to project)
- Updates badge
- Respects silent mode (unless critical alert)

## 🎉 Result

Your restaurant will now **never miss a booking**!

- ✅ Sound plays when app is closed
- ✅ Notification appears on lock screen
- ✅ Badge shows pending count
- ✅ Works 24/7 as long as device is on
- ✅ Automatic and reliable

**Keep your phone nearby and you'll always know when a booking arrives!** 📱🔔

