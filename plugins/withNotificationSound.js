const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to copy notification sound file to Android resources
 * This ensures the custom sound is available in production builds
 */
const withNotificationSound = (config) => {
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
        console.warn('⚠️ [NotificationSound] Sound file not found at:', soundSourcePath);
        console.warn('⚠️ [NotificationSound] Build will continue but custom sound may not work');
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
};

module.exports = withNotificationSound;
