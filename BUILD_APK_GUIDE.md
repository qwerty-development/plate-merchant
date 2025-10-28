# Building APK for Plate Merchant

This guide will help you build an Android APK for the Plate Merchant app.

## 📱 App Icon Setup

### Where to Put Your Icon Files:

The app uses icons from the `assets/images/` directory:

```
assets/images/
├── icon.png                          # Main app icon (1024x1024px)
├── android-icon-foreground.png       # Android adaptive icon foreground (1024x1024px)
├── android-icon-background.png       # Android adaptive icon background (1024x1024px)
├── android-icon-monochrome.png       # Android monochrome icon (1024x1024px)
├── splash-icon.png                   # Splash screen icon (400x400px recommended)
└── favicon.png                       # Web favicon (48x48px)
```

### Icon Requirements:

1. **icon.png** (Main Icon)
   - Size: **1024 x 1024 pixels**
   - Format: PNG with transparency
   - This is your main app icon

2. **android-icon-foreground.png**
   - Size: **1024 x 1024 pixels**
   - Format: PNG with transparency
   - The main icon part (centered, ~60% of canvas)

3. **android-icon-background.png**
   - Size: **1024 x 1024 pixels**
   - Format: PNG (can be solid color)
   - Background layer for adaptive icon

4. **android-icon-monochrome.png**
   - Size: **1024 x 1024 pixels**
   - Format: PNG (single color)
   - Used for themed icons on Android 13+

5. **splash-icon.png**
   - Size: **400 x 400 pixels** (or larger)
   - Format: PNG with transparency
   - Shows on app launch

### Current Brand Colors:
- Primary: `#792339` (burgundy)
- Background: `#ffece2` (peach)
- Accent: `#F2b25f` (gold)

## 🔨 Building the APK

### Option 1: EAS Build (Recommended - Cloud Build)

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS**
   ```bash
   eas build:configure
   ```

4. **Build APK**
   ```bash
   eas build --platform android --profile preview
   ```

5. **Wait for Build**
   - Build happens in the cloud
   - Takes 10-20 minutes
   - You'll get a download link when done

6. **Download APK**
   - Click the link in terminal
   - Or visit: https://expo.dev/accounts/[your-account]/projects/plate-merchant/builds

### Option 2: Local Build (Requires Android Studio)

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio

2. **Set up Android SDK**
   - Open Android Studio
   - SDK Manager → Install Android SDK 33+

3. **Prebuild**
   ```bash
   npx expo prebuild --platform android
   ```

4. **Build APK**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. **Find APK**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

## 📦 APK Configuration

### App Details (in app.json):
- **App Name**: Plate Merchant
- **Package**: com.qwertyapps.platemerchant
- **Version**: 1.0.0
- **Version Code**: 1

### To Change These:
Edit `app.json`:
```json
{
  "expo": {
    "name": "Plate Merchant",           // App name shown to users
    "version": "1.0.0",                  // User-facing version
    "android": {
      "package": "com.qwertyapps.platemerchant",  // Unique package ID
      "versionCode": 1                   // Internal version number
    }
  }
}
```

## 🚀 Installing the APK

### On Your Device:

1. **Enable Unknown Sources**
   - Settings → Security → Unknown Sources → Enable

2. **Transfer APK**
   - Email it to yourself
   - Use Google Drive
   - Use ADB: `adb install app-release.apk`

3. **Install**
   - Open APK file on device
   - Tap "Install"
   - Tap "Open" to launch

## ✅ Pre-Build Checklist

Before building, make sure:

- [ ] **Icons are ready** (1024x1024px in assets/images/)
- [ ] **App name is correct** (app.json → name)
- [ ] **Package name is unique** (com.yourcompany.appname)
- [ ] **Version is set** (1.0.0 for first release)
- [ ] **Environment variables are set** (.env file with Supabase credentials)
- [ ] **Test on Expo Go** (npm start → test in Expo Go app)
- [ ] **Remove test buttons** (optional - the sound test buttons)

## 🔧 Build Profiles (eas.json)

Create `eas.json` for different build types:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Profiles:
- **preview**: Builds APK (for testing)
- **production**: Builds AAB (for Play Store)

## 📱 Testing the APK

After installing:

1. **Test Basic Functions**
   - [ ] App opens successfully
   - [ ] Login works
   - [ ] Bookings tab loads
   - [ ] Connection indicator shows green
   - [ ] Can view bookings
   - [ ] Can accept/decline bookings
   - [ ] Sound plays for new bookings
   - [ ] Manage tab works
   - [ ] Can update restaurant info

2. **Test Real-time**
   - [ ] Leave app open for 5+ minutes
   - [ ] Create test booking from customer app
   - [ ] Sound should play immediately
   - [ ] Booking appears in list

3. **Test Offline**
   - [ ] Turn off WiFi/data
   - [ ] App shows disconnected (red indicator)
   - [ ] Turn on WiFi/data
   - [ ] App reconnects (green indicator)

## 🎨 Creating App Icons

### Tools to Create Icons:

1. **Online Tools**
   - https://icon.kitchen/ (generates all sizes)
   - https://appicon.co/ (iOS + Android)
   - https://makeappicon.com/

2. **Design Tools**
   - Figma (free)
   - Adobe Illustrator
   - Canva (free)

### Icon Design Tips:

- Keep it simple (recognizable at small sizes)
- Use your brand colors (#792339)
- Include a plate or food icon
- Make foreground contrast with background
- Test on both light and dark backgrounds

## 📤 Distributing the APK

### For Testing:
- Share APK file directly
- Use Firebase App Distribution
- Use TestFlight (iOS equivalent)

### For Production:
- Upload to Google Play Store
- Create Play Console account ($25 one-time fee)
- Upload AAB file (not APK)
- Complete store listing
- Submit for review

## 🆘 Troubleshooting

### "Build failed"
- Check expo.dev build logs
- Verify app.json syntax
- Check package.json dependencies

### "APK won't install"
- Enable Unknown Sources
- Check Android version (min: Android 5.0)
- Uninstall old version first

### "App crashes on launch"
- Check environment variables
- Verify Supabase credentials
- Check LogCat for errors

### "Icons not showing"
- Verify icon files exist
- Check file paths in app.json
- Icons must be PNG format
- Re-prebuild if changed after prebuild

## 📝 Next Steps

After building APK:

1. **Internal Testing**
   - Test with your team
   - Get feedback
   - Fix any issues

2. **Beta Testing**
   - Share with select restaurants
   - Collect feedback
   - Iterate

3. **Production Release**
   - Polish UI/UX
   - Complete testing
   - Submit to Play Store
   - Launch! 🚀

## 🔗 Useful Links

- [Expo Build Docs](https://docs.expo.dev/build/introduction/)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
- [Play Store Guide](https://play.google.com/console/about/)
- [Icon Generator](https://icon.kitchen/)

---

**Ready to build?** Run: `eas build --platform android --profile preview`

The build process will guide you through any missing setup! 🎉



