const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to fix AndroidManifest.xml merger conflicts
 * Specifically fixes the Firebase notification color conflict
 */
const withAndroidManifestFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // Ensure application array exists
    if (!manifest.application || !manifest.application[0]) {
      manifest.application = [{ $: {} }];
    }

    const application = manifest.application[0];

    // Add xmlns:tools namespace to manifest root for manifest merging
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

    // Fix manifest merger conflict: Firebase notification color
    // Remove existing notification color metadata if present
    application['meta-data'] = application['meta-data'].filter(
      (meta) => meta.$['android:name'] !== 'com.google.firebase.messaging.default_notification_color'
    );

    // Add our version with tools:replace to override react-native-firebase's default
    const notificationColorMetadata = {
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_color',
        'android:resource': '@color/notification_icon_color',
        'tools:replace': 'android:resource',
      },
    };

    application['meta-data'].push(notificationColorMetadata);

    console.log('✅ [AndroidManifestFix] Fixed Firebase notification color conflict');
    return config;
  });
};

module.exports = withAndroidManifestFix;
