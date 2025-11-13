const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

/**
 * Notifee Config Plugin for Expo
 * Configures Android manifest for Notifee foreground service
 */
const withNotifee = (config) => {
  return withPlugins(config, [
    // Configure Android Manifest
    (config) => withAndroidManifest(config, (config) => {
      const { manifest } = config.modResults;

      // Required permissions for Notifee foreground service
      const permissions = [
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
        'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.WAKE_LOCK',
        'android.permission.USE_FULL_SCREEN_INTENT',
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
      // Both expo-notifications and react-native-firebase-messaging declare this
      // We need to explicitly set it with tools:replace to resolve the conflict
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
          'android:foregroundServiceType': 'dataSync|specialUse',
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

      return config;
    }),
  ]);
};

module.exports = withNotifee;
