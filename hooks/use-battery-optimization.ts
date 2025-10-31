import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Hook to manage battery optimization exemptions
 * Critical for keeping the app alive on Android tablets
 */
export function useBatteryOptimization() {
  const [isOptimized, setIsOptimized] = useState<boolean | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && !hasChecked) {
      checkBatteryOptimization();
    }
  }, [hasChecked]);

  const checkBatteryOptimization = async () => {
    try {
      console.log('🔋 Checking battery optimization status...');
      // Note: Expo doesn't have a direct way to check this
      // We'll assume it's enabled and prompt the user
      setHasChecked(true);
      setIsOptimized(true); // Assume optimized until proven otherwise
    } catch (error) {
      console.error('❌ Error checking battery optimization:', error);
    }
  };

  const requestBatteryOptimizationExemption = useCallback(() => {
    Alert.alert(
      '⚡ Battery Optimization Required',
      'To ensure this app continues receiving booking notifications 24/7, even when the tablet screen is off, we need to disable battery optimization.\n\n' +
        'This is ESSENTIAL for the restaurant tablet to work properly.\n\n' +
        'After clicking OK, please:\n' +
        '1. Find "Plate Merchant" in the list\n' +
        '2. Select "Don\'t optimize" or "Allow"\n' +
        '3. Tap "Done"',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK - Open Settings',
          onPress: openBatteryOptimizationSettings,
        },
      ]
    );
  }, []);

  const openBatteryOptimizationSettings = async () => {
    try {
      console.log('🔋 Opening battery optimization settings...');

      if (Platform.OS === 'android') {
        // Try to open battery optimization settings directly
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            {
              data: 'package:com.qwertyapps.platemerchant',
            }
          );
          console.log('✅ Opened battery optimization dialog');
        } catch (intentError) {
          console.log('⚠️ Direct intent failed, trying settings...');

          // Fallback: Open general ignore battery optimization settings
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
          );
          console.log('✅ Opened battery optimization settings page');
        }

        setIsOptimized(false);
      }
    } catch (error) {
      console.error('❌ Error opening battery optimization settings:', error);

      // Final fallback: Open app settings
      Alert.alert(
        'Manual Setup Required',
        'Please manually disable battery optimization:\n\n' +
          '1. Open Android Settings\n' +
          '2. Go to Apps → Plate Merchant\n' +
          '3. Go to Battery\n' +
          '4. Select "Unrestricted" or "Don\'t optimize"',
        [
          {
            text: 'Open App Settings',
            onPress: () => Linking.openSettings(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const showBatteryOptimizationGuide = useCallback(() => {
    Alert.alert(
      '🔋 Battery Optimization Guide',
      'For the restaurant tablet to work properly 24/7:\n\n' +
        '✅ REQUIRED STEPS:\n\n' +
        '1. Disable Battery Optimization\n' +
        '   • Go to Android Settings\n' +
        '   • Apps → Plate Merchant → Battery\n' +
        '   • Select "Unrestricted" or "Don\'t optimize"\n\n' +
        '2. Allow Background Activity\n' +
        '   • In the same Battery settings\n' +
        '   • Enable "Background activity"\n\n' +
        '3. Prevent App from Closing\n' +
        '   • Recent Apps → Long press Plate Merchant\n' +
        '   • Tap the lock icon (if available)\n\n' +
        '4. Keep Tablet Plugged In\n' +
        '   • Always connected to power\n' +
        '   • Prevents battery saving modes',
      [
        {
          text: 'Got it',
          style: 'default',
        },
        {
          text: 'Open Settings',
          onPress: openBatteryOptimizationSettings,
        },
      ]
    );
  }, [openBatteryOptimizationSettings]);

  return {
    isOptimized,
    hasChecked,
    requestBatteryOptimizationExemption,
    openBatteryOptimizationSettings,
    showBatteryOptimizationGuide,
  };
}
