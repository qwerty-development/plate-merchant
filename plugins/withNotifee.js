const { withAndroidManifest, withPlugins, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Combined plugin for Notifee and Notification Sound
 * 1. Configures Android manifest for Notifee foreground service
 * 2. Copies notification sound to Android resources for EAS Build
 */

// Function to copy notification sound to Android resources
function withNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = path.join(projectRoot, 'android');

      // Source and destination paths
      const soundSourcePath = path.join(projectRoot, 'assets', 'notification', 'new_booking.wav');
      const soundDestDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'raw');
      const soundDestPath = path.join(soundDestDir, 'new_booking.wav');

      console.log('🔊 [NotificationSound] Copying sound file for Android...');
      console.log('  Source:', soundSourcePath);
      console.log('  Destination:', soundDestPath);

      // Check if source file exists
      if (!fs.existsSync(soundSourcePath)) {
        console.warn('⚠️ [NotificationSound] Sound file not found, skipping copy');
        return config;
      }

      // Create raw directory if it doesn't exist
      if (!fs.existsSync(soundDestDir)) {
        console.log('📁 Creating raw resources directory...');
        fs.mkdirSync(soundDestDir, { recursive: true });
      }

      // Copy the sound file
      try {
        fs.copyFileSync(soundSourcePath, soundDestPath);
        console.log('✅ [NotificationSound] Sound file copied successfully!');
      } catch (error) {
        console.error('❌ [NotificationSound] Failed to copy sound file:', error);
        // Don't throw, just warn - build can continue
        console.warn('Build will continue but sound may not work');
      }

      return config;
    },
  ]);
}

// Main Notifee configuration
const withNotifee = (config) => {
  return withPlugins(config, [
    // First copy the sound file
    withNotificationSound,

    // Then configure Android Manifest
    (config) => withAndroidManifest(config, (config) => {
      const { manifest } = config.modResults;

      // Required permissions for Notifee foreground service and sound
      const permissions = [
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
        'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.WAKE_LOCK',
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.DISABLE_KEYGUARD',
        'android.permission.TURN_SCREEN_ON',
        'android.permission.VIBRATE',
      ];

      // Ensure uses-permission array exists
      if (!manifest['uses-permission']) {
        manifest['uses-permission'] = [];
      }

      // Add permissions if they don't exist
      permissions.forEach((permission) => {
        const exists = manifest['uses-permission'].some(
          (item) => item.$['android:name'] === permission
        );

        if (!exists) {
          manifest['uses-permission'].push({
            $: { 'android:name': permission },
          });
        }
      });

      // Ensure application array exists
      if (!manifest.application || !manifest.application[0]) {
        manifest.application = [{ $: {} }];
      }

      const application = manifest.application[0];

      // Add xmlns:tools for manifest merging
      if (!manifest.$) {
        manifest.$ = {};
      }
      if (!manifest.$['xmlns:tools']) {
        manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }

      // Ensure meta-data array exists
      if (!application['meta-data']) {
        application['meta-data'] = [];
      }

      // Fix manifest merger conflict: notification_icon_color
      const notificationColorMetadata = {
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_color',
          'android:resource': '@color/notification_icon_color',
          'tools:replace': 'android:resource',
        },
      };

      // Remove existing notification color metadata if present
      application['meta-data'] = application['meta-data'].filter(
        (meta) => meta.$['android:name'] !== 'com.google.firebase.messaging.default_notification_color'
      );

      // Add our version with tools:replace
      application['meta-data'].push(notificationColorMetadata);

      // Ensure service array exists
      if (!application.service) {
        application.service = [];
      }

      // Add Notifee Foreground Service
      const notifeeService = {
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:exported': 'false',
          'android:enabled': 'true',
          'android:foregroundServiceType': 'dataSync|specialUse|mediaPlayback',
          'android:stopWithTask': 'false',
        },
      };

      const notifeeServiceExists = application.service.some(
        (s) => s.$['android:name'] === 'app.notifee.core.ForegroundService'
      );

      if (!notifeeServiceExists) {
        application.service.push(notifeeService);
      }

      // Add property for special use foreground service (required for Android 14+)
      if (!application.property) {
        application.property = [];
      }

      const specialUseProperty = {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': 'Real-time booking notifications for restaurant tablets',
        },
      };

      const propertyExists = application.property.some(
        (p) => p.$['android:name'] === 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE'
      );

      if (!propertyExists) {
        application.property.push(specialUseProperty);
      }

      console.log('✅ [Notifee Plugin] Android manifest configured');
      return config;
    }),
  ]);
};

module.exports = withNotifee;