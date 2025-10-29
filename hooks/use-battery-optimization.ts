import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Device from 'expo-device';

/**
 * Battery Optimization Hook - Manages battery optimization settings
 *
 * CRITICAL FOR SAMSUNG TABLETS:
 * Samsung devices have aggressive battery optimization that WILL kill background tasks.
 * This hook helps guide users to disable battery optimization for reliable notifications.
 */
export function useBatteryOptimization() {
  const [isBatteryOptimizationIgnored, setIsBatteryOptimizationIgnored] = useState<boolean | null>(null);
  const [deviceManufacturer, setDeviceManufacturer] = useState<string>('');

  useEffect(() => {
    if (Platform.OS === 'android') {
      loadDeviceInfo();
    }
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const manufacturer = Device.manufacturer || '';
      setDeviceManufacturer(manufacturer.toLowerCase());
      console.log('📱 Device manufacturer:', manufacturer);
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  };

  /**
   * Check if battery optimization is disabled for this app
   * Note: We can't programmatically check this reliably, so we track user confirmation
   */
  const checkBatteryOptimization = useCallback(() => {
    if (Platform.OS !== 'android') return;

    // Show different instructions based on manufacturer
    const isSamsung = deviceManufacturer.includes('samsung');

    if (isSamsung) {
      showSamsungBatteryInstructions();
    } else {
      showGenericBatteryInstructions();
    }
  }, [deviceManufacturer]);

  /**
   * Samsung-specific battery optimization instructions
   */
  const showSamsungBatteryInstructions = () => {
    Alert.alert(
      '⚡ Samsung Battery Optimization',
      'For reliable booking notifications, please disable battery optimization:\n\n' +
      '1. Tap "Open Settings" below\n' +
      '2. Find "Plate Merchant" in the app list\n' +
      '3. Tap "Battery"\n' +
      '4. Enable "Allow background activity"\n' +
      '5. Tap "Optimize battery usage" → "All" → Find Plate Merchant → Turn OFF\n' +
      '6. Go back to Device Care → Battery → App power management → Apps that won\'t be put to sleep → Add Plate Merchant\n\n' +
      'This ensures you never miss a booking!',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => openSamsungBatterySettings(),
        },
      ]
    );
  };

  /**
   * Generic Android battery optimization instructions
   */
  const showGenericBatteryInstructions = () => {
    Alert.alert(
      '⚡ Battery Optimization Required',
      'For reliable booking notifications when the app is closed:\n\n' +
      '1. Tap "Open Settings" below\n' +
      '2. Find "Plate Merchant"\n' +
      '3. Disable battery optimization\n' +
      '4. Allow background activity\n\n' +
      'This ensures you receive all booking alerts!',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => openBatterySettings(),
        },
      ]
    );
  };

  /**
   * Open Samsung-specific battery settings
   */
  const openSamsungBatterySettings = async () => {
    try {
      // Open app settings - user will navigate to battery section
      await Linking.openSettings();
      console.log('✅ Opened Samsung battery settings');
    } catch (error) {
      console.error('Error opening Samsung battery settings:', error);
      openAppSettings();
    }
  };

  /**
   * Open generic battery optimization settings
   */
  const openBatterySettings = async () => {
    try {
      // Open app settings
      await Linking.openSettings();
      console.log('✅ Opened battery optimization settings');
    } catch (error) {
      console.error('Error opening battery settings:', error);
      openAppSettings();
    }
  };

  /**
   * Open app-specific settings
   */
  const openAppSettings = () => {
    try {
      Linking.openSettings();
      console.log('✅ Opened app settings');
    } catch (error) {
      console.error('Error opening app settings:', error);
    }
  };

  /**
   * Show auto-start instructions (manufacturer-specific)
   */
  const showAutoStartInstructions = useCallback(() => {
    const isSamsung = deviceManufacturer.includes('samsung');
    const isXiaomi = deviceManufacturer.includes('xiaomi') || deviceManufacturer.includes('redmi');
    const isHuawei = deviceManufacturer.includes('huawei') || deviceManufacturer.includes('honor');
    const isOppo = deviceManufacturer.includes('oppo') || deviceManufacturer.includes('realme');
    const isVivo = deviceManufacturer.includes('vivo');

    let instructions = '';

    if (isSamsung) {
      instructions = 'Samsung:\n• Device Care → Battery → App power management → Apps that won\'t be put to sleep → Add Plate Merchant';
    } else if (isXiaomi) {
      instructions = 'Xiaomi/Redmi:\n• Settings → Apps → Manage apps → Plate Merchant → Autostart → Enable';
    } else if (isHuawei) {
      instructions = 'Huawei/Honor:\n• Settings → Battery → App launch → Plate Merchant → Manage manually (Enable all)';
    } else if (isOppo) {
      instructions = 'Oppo/Realme:\n• Settings → Battery → Power saving mode → Add Plate Merchant to whitelist';
    } else if (isVivo) {
      instructions = 'Vivo:\n• Settings → Battery → Background power consumption → Plate Merchant → Allow';
    } else {
      instructions = 'General:\n• Find your device\'s auto-start or background app settings\n• Add Plate Merchant to the whitelist';
    }

    Alert.alert(
      '🚀 Auto-Start Settings',
      'Enable auto-start to ensure notifications work after device restart:\n\n' + instructions,
      [
        { text: 'OK' },
        {
          text: 'Open Settings',
          onPress: () => openAppSettings(),
        },
      ]
    );
  }, [deviceManufacturer]);

  /**
   * Show comprehensive setup guide
   */
  const showSetupGuide = useCallback(() => {
    const isSamsung = deviceManufacturer.includes('samsung');

    Alert.alert(
      '🔧 Complete Setup for Reliable Notifications',
      `For guaranteed booking alerts on your ${isSamsung ? 'Samsung' : 'Android'} tablet:\n\n` +
      '✅ 1. Disable Battery Optimization\n' +
      '✅ 2. Enable Auto-Start\n' +
      '✅ 3. Allow Background Activity\n' +
      '✅ 4. Keep tablet plugged in when possible\n' +
      '✅ 5. Keep tablet screen timeout long (10-30 min)\n\n' +
      'Would you like step-by-step guidance?',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Battery Settings',
          onPress: () => checkBatteryOptimization(),
        },
        {
          text: 'Auto-Start',
          onPress: () => showAutoStartInstructions(),
        },
      ]
    );
  }, [deviceManufacturer, checkBatteryOptimization, showAutoStartInstructions]);

  /**
   * Check if this is a Samsung device
   */
  const isSamsungDevice = useCallback(() => {
    return deviceManufacturer.includes('samsung');
  }, [deviceManufacturer]);

  /**
   * Mark battery optimization as configured (user confirmation)
   */
  const markBatteryOptimizationConfigured = useCallback(() => {
    setIsBatteryOptimizationIgnored(true);
    console.log('✅ Battery optimization marked as configured');
  }, []);

  return {
    isBatteryOptimizationIgnored,
    checkBatteryOptimization,
    showAutoStartInstructions,
    showSetupGuide,
    isSamsungDevice,
    deviceManufacturer,
    markBatteryOptimizationConfigured,
    openBatterySettings,
    openAppSettings,
  };
}
