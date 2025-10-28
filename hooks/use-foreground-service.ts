import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const FOREGROUND_SERVICE_NOTIFICATION_ID = 'foreground-service';

/**
 * Hook to manage Android foreground service
 * Keeps the app alive in the background with a persistent notification
 */
export function useForegroundService(enabled: boolean = true) {
  const [isServiceRunning, setIsServiceRunning] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      console.log('⏭️ Skipping foreground service (not Android or disabled)');
      return;
    }

    startForegroundService();

    return () => {
      stopForegroundService();
    };
  }, [enabled]);

  const startForegroundService = async () => {
    try {
      console.log('🚀 Starting foreground service...');

      // Create a persistent notification that keeps the service alive
      await Notifications.scheduleNotificationAsync({
        identifier: FOREGROUND_SERVICE_NOTIFICATION_ID,
        content: {
          title: '🔔 Plate Merchant - Active',
          body: 'Listening for new booking requests...',
          data: { 
            type: 'foreground_service',
            persistent: true,
          },
          priority: Notifications.AndroidNotificationPriority.LOW,
          categoryIdentifier: 'SERVICE',
          badge: 0,
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      });

      setIsServiceRunning(true);
      console.log('✅ Foreground service started');
    } catch (error) {
      console.error('❌ Error starting foreground service:', error);
    }
  };

  const stopForegroundService = async () => {
    try {
      console.log('🛑 Stopping foreground service...');
      
      // Dismiss the foreground service notification
      const allNotifications = await Notifications.getPresentedNotificationsAsync();
      const serviceNotification = allNotifications.find(
        n => n.request.identifier === FOREGROUND_SERVICE_NOTIFICATION_ID
      );
      
      if (serviceNotification) {
        await Notifications.dismissNotificationAsync(serviceNotification.request.identifier);
      }

      setIsServiceRunning(false);
      console.log('✅ Foreground service stopped');
    } catch (error) {
      console.error('❌ Error stopping foreground service:', error);
    }
  };

  return {
    isServiceRunning,
    startForegroundService,
    stopForegroundService,
  };
}
