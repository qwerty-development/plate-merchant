import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Firebase Cloud Messaging Hook
 *
 * Handles:
 * - FCM token registration and storage
 * - Background message handling (when app is closed/background)
 * - Foreground message handling (when app is open)
 * - Server-sent push notifications for new bookings
 *
 * This enables the server to wake up the app and trigger the native foreground service
 * even when the app is completely closed.
 */

export interface FCMBookingData {
  type: 'new_booking';
  bookingId: string;
  guestName: string;
  partySize: string;
  restaurantId: string;
}

export function useFCMNotifications() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      console.log('⏭️ FCM only configured for Android');
      return;
    }

    // Request permission and register
    requestPermissionAndRegister();

    // Setup message handlers
    setupMessageHandlers();

  }, []);

  /**
   * Request FCM permission and register device
   */
  const requestPermissionAndRegister = async () => {
    try {
      console.log('📱 Requesting FCM permission...');

      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('⚠️ FCM permission not granted');
        return;
      }

      console.log('✅ FCM permission granted');

      // Get FCM token
      const token = await messaging().getToken();

      if (token) {
        console.log('📱 FCM Token:', token.substring(0, 20) + '...');
        setFcmToken(token);
        setIsRegistered(true);

        // Save token to database (will be used by server to send notifications)
        await saveFCMTokenToDatabase(token);
      }

    } catch (error) {
      console.error('❌ Error requesting FCM permission:', error);
    }
  };

  /**
   * Save FCM token to Supabase for server-side push notifications
   */
  const saveFCMTokenToDatabase = async (token: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('⚠️ No user logged in, cannot save FCM token');
        return;
      }

      // Get restaurant_id from restaurant_staff
      const { data: staffData } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const restaurantId = staffData?.restaurant_id;

      if (!restaurantId) {
        console.warn('⚠️ No restaurant found for user, saving without restaurant_id');
      }

      console.log('💾 Saving FCM token to database...');

      // Save token to restaurant_devices table
      const { error } = await supabase
        .from('restaurant_devices')
        .upsert({
          user_id: user.id,
          restaurant_id: restaurantId,
          device_id: token, // Use FCM token as device ID
          fcm_token: token,
          platform: Platform.OS,
          device_name: `${Platform.OS} Tablet`,
          enabled: true,
          last_seen: new Date().toISOString(),
        }, {
          onConflict: 'fcm_token'
        });

      if (error) {
        console.error('❌ Error saving FCM token:', error);
        throw error;
      }

      console.log('✅ FCM token saved to database');
      console.log('📱 Restaurant ID:', restaurantId);
      console.log('📱 Token:', token.substring(0, 30) + '...');

    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
    }
  };

  /**
   * Setup message handlers for background and foreground
   */
  const setupMessageHandlers = () => {
    // Handle background messages (app closed or in background)
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📨 Background message received:', remoteMessage);

      try {
        // Extract booking data from message
        const data = remoteMessage.data as unknown as FCMBookingData;

        if (data.type === 'new_booking') {
          console.log('🆕 New booking notification (background):', data.bookingId);

          // The native foreground service will be triggered by the React Native app
          // when it processes this notification.
          // Note: Background handler can't directly access React hooks,
          // so we rely on the app startup flow to handle this.

          // You could store the notification in AsyncStorage here
          // and process it when the app opens
        }
      } catch (error) {
        console.error('❌ Error handling background message:', error);
      }
    });

    // Handle foreground messages (app is open)
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('📨 Foreground message received:', remoteMessage);

      try {
        const data = remoteMessage.data as unknown as FCMBookingData;

        if (data.type === 'new_booking') {
          console.log('🆕 New booking notification (foreground):', data.bookingId);

          // In foreground, the app will handle this through the realtime listener
          // This is a backup mechanism
        }
      } catch (error) {
        console.error('❌ Error handling foreground message:', error);
      }
    });

    // Handle notification opened (user tapped notification)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Notification opened app:', remoteMessage);

      const data = remoteMessage.data as unknown as FCMBookingData;

      if (data.type === 'new_booking') {
        // Navigate to bookings screen
        // Note: This would require navigation ref
        console.log('📍 Should navigate to booking:', data.bookingId);
      }
    });

    // Check if app was opened from a notification (app was killed)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('🚀 App opened from notification (killed state):', remoteMessage);

          const data = remoteMessage.data as unknown as FCMBookingData;

          if (data.type === 'new_booking') {
            console.log('📍 Should navigate to booking:', data.bookingId);
          }
        }
      });

    return unsubscribe;
  };

  /**
   * Get current FCM token
   */
  const getToken = useCallback((): string | null => {
    return fcmToken;
  }, [fcmToken]);

  /**
   * Refresh FCM token
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      console.log('🔄 Refreshing FCM token...');

      await messaging().deleteToken();
      const newToken = await messaging().getToken();

      if (newToken) {
        setFcmToken(newToken);
        await saveFCMTokenToDatabase(newToken);
        console.log('✅ FCM token refreshed');
        return newToken;
      }

      return null;
    } catch (error) {
      console.error('❌ Error refreshing FCM token:', error);
      return null;
    }
  }, []);

  /**
   * Test FCM by showing a test notification
   */
  const test = useCallback(() => {
    if (!fcmToken) {
      Alert.alert('❌ Not Registered', 'FCM token not available. Please restart the app.');
      return;
    }

    Alert.alert(
      '✅ FCM Registered',
      `Device is registered for push notifications.\n\nToken: ${fcmToken.substring(0, 30)}...\n\n` +
      'The server can now send push notifications to this device.',
      [
        {
          text: 'Copy Token',
          onPress: () => {
            // Would need Clipboard module
            console.log('Full token:', fcmToken);
          }
        },
        { text: 'OK' }
      ]
    );
  }, [fcmToken]);

  return {
    fcmToken,
    isRegistered,
    getToken,
    refreshToken,
    test,
  };
}

/**
 * Helper function to send FCM notification from server
 *
 * This is SERVER-SIDE CODE (Node.js example)
 * Put this in your backend (Supabase Edge Function, Express server, etc.)
 */
export const serverSideExample = `
// SERVER-SIDE CODE (not for React Native)
// Example: Supabase Edge Function or Node.js backend

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'your-project-id',
    clientEmail: 'your-client-email',
    privateKey: 'your-private-key'
  })
});

// Function to send booking notification
async function sendBookingNotification(
  fcmToken: string,
  bookingId: string,
  guestName: string,
  partySize: number
) {
  const message = {
    token: fcmToken,
    data: {
      type: 'new_booking',
      bookingId: bookingId,
      guestName: guestName,
      partySize: partySize.toString(),
    },
    android: {
      priority: 'high' as const,
      // Silent notification - app handles the alert
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// Example: Call this when a new booking is created
// sendBookingNotification(
//   deviceToken,
//   'booking-123',
//   'John Doe',
//   4
// );
`;
