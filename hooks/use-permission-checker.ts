import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

export interface PermissionStatus {
  notifications: boolean;
  batteryOptimization: 'unknown' | 'optimized' | 'unrestricted';
  allGranted: boolean;
}

/**
 * Permission Checker - Continuously monitors critical permissions
 * Alerts user if permissions are revoked or battery optimization is enabled
 */
export function usePermissionChecker() {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    notifications: false,
    batteryOptimization: 'unknown',
    allGranted: false,
  });
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Check on mount
    checkPermissions();

    // Check every minute
    const interval = setInterval(checkPermissions, 60000);

    return () => clearInterval(interval);
  }, []);

  const checkPermissions = useCallback(async () => {
    const { status: notificationStatus } = await Notifications.getPermissionsAsync();
    const notificationsGranted = notificationStatus === 'granted';

    const newStatus: PermissionStatus = {
      notifications: notificationsGranted,
      batteryOptimization: 'unknown', // Can't easily check this programmatically
      allGranted: notificationsGranted,
    };

    setPermissions(newStatus);

    // Show warning if critical permissions are missing
    if (!notificationsGranted) {
      console.warn('⚠️ CRITICAL: Notification permission not granted');
      setShowPermissionWarning(true);
    } else {
      setShowPermissionWarning(false);
    }

    return newStatus;
  }, []);

  const requestPermissions = useCallback(async () => {
    console.log('📱 Requesting notification permissions...');
    
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'This app needs notification permissions to alert you of new bookings. Please enable notifications in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    } else {
      console.log('✅ Notification permission granted');
      await checkPermissions();
    }
  }, [checkPermissions]);

  const showBatteryOptimizationWarning = useCallback(() => {
    Alert.alert(
      '⚡ Battery Optimization Detected',
      'For best results, disable battery optimization for this app:\n\n' +
      '1. Go to Settings\n' +
      '2. Apps → Plate Merchant\n' +
      '3. Battery → Unrestricted\n\n' +
      'This ensures you never miss a booking!',
      [
        { text: 'Later', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }, []);

  return {
    permissions,
    showPermissionWarning,
    checkPermissions,
    requestPermissions,
    showBatteryOptimizationWarning,
  };
}
