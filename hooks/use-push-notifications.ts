import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export interface PushNotification {
  title: string;
  body: string;
  data?: any;
  sound?: string | boolean;
  priority?: 'default' | 'high' | 'max';
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      console.log('📱 Push token:', token);
      setExpoPushToken(token);
    });

    // Listener for when notification is received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
      setNotification(notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      console.log('Notification data:', data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    // Create notification category with actions
    await Notifications.setNotificationCategoryAsync('BOOKING_ACTION', [
      {
        identifier: 'ACCEPT',
        buttonTitle: '✅ Accept',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: '❌ Decline',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    // Create CRITICAL booking alert channel
    await Notifications.setNotificationChannelAsync('booking-alerts', {
      name: 'Booking Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#792339',
      sound: 'new_booking.wav',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

    // Create a separate channel for foreground service
    await Notifications.setNotificationChannelAsync('foreground-service', {
      name: 'Background Service',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push token for push notification!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Push token obtained:', token);
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  } else {
    console.log('⚠️ Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Send a local notification (works when app is closed)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
  sound: boolean = true
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: sound ? 'new_booking.wav' : undefined,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        categoryIdentifier: 'booking',
        badge: 1,
      },
      trigger: null, // null = show immediately
    });
    console.log('✅ Local notification sent');
  } catch (error) {
    console.error('❌ Error sending local notification:', error);
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

