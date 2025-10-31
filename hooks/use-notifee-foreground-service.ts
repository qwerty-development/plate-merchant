import notifee, {
  AndroidColor,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  AndroidForegroundServiceType
} from '@notifee/react-native';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const CHANNEL_ID = 'plate-foreground-service';
const NOTIFICATION_ID = 'plate-foreground-service-notification';

/**
 * Enhanced hook to manage Android foreground service using Notifee
 * This creates a TRUE foreground service that keeps the app process alive
 * even when the tablet screen is off or the app is backgrounded
 */
export function useNotifeeForegroundService(enabled: boolean = true) {
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      console.log('⏭️ Skipping foreground service (not Android or disabled)');
      return;
    }

    initializeNotifee();
  }, [enabled]);

  const initializeNotifee = async () => {
    try {
      console.log('🔧 Initializing Notifee...');

      // Create notification channel for foreground service
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Plate Restaurant Service',
        importance: AndroidImportance.LOW, // LOW importance = no sound/vibration
        description: 'Keeps the app running to receive booking notifications',
        vibration: false,
        sound: undefined,
        lights: false,
      });

      console.log('✅ Notifee channel created');
      setIsInitialized(true);

      // Start the service
      await startForegroundService();
    } catch (error) {
      console.error('❌ Error initializing Notifee:', error);
    }
  };

  const startForegroundService = async () => {
    try {
      console.log('🚀 Starting Notifee foreground service...');

      // Display foreground notification
      await notifee.displayNotification({
        id: NOTIFICATION_ID,
        title: '🔔 Plate Merchant Active',
        body: 'Listening for new booking requests',
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.LOW,
          ongoing: true, // Cannot be dismissed by user
          autoCancel: false,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          asForegroundService: true, // THIS IS KEY - marks as foreground service
          foregroundServiceTypes: [
            AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
          ],
          color: AndroidColor.RED,
          colorized: true,
          smallIcon: 'ic_launcher', // Uses your app icon
          largeIcon: require('@/assets/images/icon.png'),
          progress: {
            indeterminate: false,
            current: 0,
            max: 0,
          },
          category: AndroidCategory.SERVICE,
          visibility: AndroidVisibility.PUBLIC,
        },
      });

      setIsServiceRunning(true);
      console.log('✅ Notifee foreground service started successfully!');
      console.log('📱 The app will now stay alive even when backgrounded');
    } catch (error) {
      console.error('❌ Error starting foreground service:', error);
      throw error;
    }
  };

  const stopForegroundService = async () => {
    try {
      console.log('🛑 Stopping Notifee foreground service...');

      // Cancel the foreground notification
      await notifee.cancelNotification(NOTIFICATION_ID);

      // Stop the foreground service
      await notifee.stopForegroundService();

      setIsServiceRunning(false);
      console.log('✅ Foreground service stopped');
    } catch (error) {
      console.error('❌ Error stopping foreground service:', error);
    }
  };

  const updateServiceNotification = async (
    title: string,
    body: string,
    pendingCount?: number
  ) => {
    try {
      if (!isServiceRunning) return;

      await notifee.displayNotification({
        id: NOTIFICATION_ID,
        title,
        body,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.LOW,
          ongoing: true,
          autoCancel: false,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          asForegroundService: true,
          foregroundServiceTypes: [
            AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
          ],
          color: AndroidColor.RED,
          colorized: true,
          smallIcon: 'ic_launcher',
          largeIcon: require('@/assets/images/icon.png'),
          progress: pendingCount
            ? {
                indeterminate: false,
                current: pendingCount,
                max: pendingCount,
              }
            : {
                indeterminate: false,
                current: 0,
                max: 0,
              },
          category: AndroidCategory.SERVICE,
          visibility: AndroidVisibility.PUBLIC,
        },
      });

      console.log('📝 Service notification updated');
    } catch (error) {
      console.error('❌ Error updating service notification:', error);
    }
  };

  return {
    isServiceRunning,
    isInitialized,
    startForegroundService,
    stopForegroundService,
    updateServiceNotification,
  };
}
