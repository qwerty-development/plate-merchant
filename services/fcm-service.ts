/**
 * Firebase Cloud Messaging (FCM) Service
 *
 * This service handles FCM for production builds.
 * In Expo Go, we use Expo push notifications instead.
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { stopBookingAlert } from './booking-alert-manager';
import { BookingNotificationData, cancelBookingNotification, displayNewBookingNotification } from './booking-notification-service';

// Safely import Firebase - may not be available in Expo Go
let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
  console.warn('⚠️ [FCM] Firebase not available (OK in Expo Go). Using Expo push notifications.');
}

/**
 * Request notification permissions and get FCM token
 * This MUST be called when user logs in
 */
export async function requestNotificationPermissionAndGetToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [FCM] Skipping FCM setup (not Android)');
    return null;
  }

  if (!messaging) {
    console.log('⏭️ [FCM] Firebase not available, skipping');
    return null;
  }

  try {
    console.log('🔔 [FCM] Requesting notification permission...');

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('❌ [FCM] Notification permission denied');
      return null;
    }

    console.log('✅ [FCM] Notification permission granted');

    const token = await messaging().getToken();
    console.log('🎫 [FCM] Token obtained:', token.substring(0, 20) + '...');

    return token;
  } catch (error) {
    console.error('❌ [FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Register FCM token in Supabase for this device
 */
export async function registerFCMToken(restaurantId: string) {
  if (!messaging) return;

  try {
    const token = await requestNotificationPermissionAndGetToken();
    if (!token) {
      console.log('⏭️ [FCM] No token to register');
      return;
    }

    console.log('📝 [FCM] Registering token in Supabase...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ [FCM] No user found, cannot register token');
      return;
    }

    const { error } = await supabase
      .from('device_tokens')
      .upsert({
        user_id: user.id,
        restaurant_id: restaurantId,
        fcm_token: token,
        platform: Platform.OS,
        device_info: {
          os_version: Platform.Version,
        },
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'fcm_token',
      });

    if (error) {
      console.error('❌ [FCM] Error registering token:', error);
      return;
    }

    console.log('✅ [FCM] Token registered successfully');
  } catch (error) {
    console.error('❌ [FCM] Error in registerFCMToken:', error);
  }
}

/**
 * Handle token refresh
 */
export function setupTokenRefreshListener(restaurantId: string) {
  if (!messaging) return () => {};

  return messaging().onTokenRefresh(async (newToken: string) => {
    console.log('🔄 [FCM] Token refreshed:', newToken.substring(0, 20) + '...');
    await registerFCMToken(restaurantId);
  });
}

/**
 * Background message handler
 * Only works in production builds, not Expo Go
 */
export function setupBackgroundMessageHandler() {
  if (!messaging) {
    console.log('⏭️ [FCM] Firebase not available, background handler not registered');
    return;
  }

  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('📨 [FCM Background] Message received!', remoteMessage);

    try {
      const data = remoteMessage.data;
      if (!data) return;

      // Handle NEW BOOKING
      if (data.type === 'NEW_BOOKING' || data.type === 'new_booking') {
        const bookingId = String(data.booking_id || data.bookingId || '');
        const guestName = String(data.guest_name || data.guestName || 'Guest');
        const partySize = parseInt(String(data.guest_count || data.partySize || '1')) || 1;
        const bookingTime = String(data.booking_time || data.bookingTime || '');
        const restaurantId = String(data.restaurant_id || data.restaurantId || '');

        console.log('🎉 [FCM Background] New booking:', { bookingId, guestName, partySize });

        // Format time
        let formattedTime = '';
        try {
          formattedTime = new Date(bookingTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        } catch {}

        // Show notification directly using expo-notifications (works in killed state)
        const Notifications = require('expo-notifications').default;
        await Notifications.scheduleNotificationAsync({
          identifier: `booking_${bookingId}`,
          content: {
            title: 'New booking – Plate',
            body: `${guestName} • ${partySize} ${partySize === 1 ? 'guest' : 'guests'} at ${formattedTime}`,
            data: {
              bookingId: bookingId,
              type: 'NEW_BOOKING',
            },
            sound: 'new_booking.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: 'BOOKING_ACTION',
            badge: 1,
            channelId: 'plate_bookings', // Explicit channel ID
          },
          trigger: null,
        });

        // Also call displayNewBookingNotification to set up re-triggering
        const notificationData: BookingNotificationData = {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          guest_name: guestName,
          guest_count: partySize,
          booking_time: bookingTime,
        };
        
        await displayNewBookingNotification(notificationData).catch(err => {
          console.error('❌ [FCM Background] Re-trigger setup error:', err);
        });

        console.log('✅ [FCM Background] Notification triggered');
      } 
      // Handle BOOKING STATUS CHANGED
      else if (data.type === 'BOOKING_STATUS_CHANGED' || data.type === 'booking_cancelled' || data.type === 'booking_handled') {
        const bookingId = String(data.booking_id || data.bookingId || '');
        const status = String(data.status || '');
        console.log('🛑 [FCM Background] Booking status changed:', bookingId, status);
        
        if (bookingId) {
          await stopBookingAlert(bookingId);
          if (status === 'confirmed' || status === 'declined_by_restaurant') {
            await cancelBookingNotification(bookingId);
          }
        }
      }
    } catch (error) {
      console.error('❌ [FCM Background] Error handling message:', error);
    }
  });

  console.log('✅ [FCM] Background message handler registered');
}

/**
 * Foreground message handler
 */
export function setupForegroundMessageHandler() {
  if (!messaging) return () => {};

  return messaging().onMessage(async (remoteMessage: any) => {
    console.log('📨 [FCM Foreground] Message received!', remoteMessage);

    try {
      const data = remoteMessage.data;
      if (!data) return;

      // Handle NEW BOOKING
      if (data.type === 'NEW_BOOKING' || data.type === 'new_booking') {
        const bookingId = String(data.booking_id || data.bookingId || '');
        const guestName = String(data.guest_name || data.guestName || 'Guest');
        const partySize = parseInt(String(data.guest_count || data.partySize || '1')) || 1;
        const bookingTime = String(data.booking_time || data.bookingTime || '');
        const restaurantId = String(data.restaurant_id || data.restaurantId || '');

        console.log('🎉 [FCM Foreground] New booking:', { bookingId, guestName, partySize });

        const notificationData: BookingNotificationData = {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          guest_name: guestName,
          guest_count: partySize,
          booking_time: bookingTime,
        };
        
        await displayNewBookingNotification(notificationData).catch(err => {
          console.error('❌ [FCM Foreground] Notification error:', err);
        });

        console.log('✅ [FCM Foreground] Notification triggered');
      }
      // Handle BOOKING STATUS CHANGED
      else if (data.type === 'BOOKING_STATUS_CHANGED' || data.type === 'booking_cancelled' || data.type === 'booking_handled') {
        const bookingId = String(data.booking_id || data.bookingId || '');
        const status = String(data.status || '');
        console.log('🛑 [FCM Foreground] Booking status changed:', bookingId, status);
        
        if (bookingId) {
          await stopBookingAlert(bookingId);
          if (status === 'confirmed' || status === 'declined_by_restaurant') {
            await cancelBookingNotification(bookingId);
          }
        }
      }
    } catch (error) {
      console.error('❌ [FCM Foreground] Error handling message:', error);
    }
  });
}

/**
 * Initialize FCM service
 */
export function initializeFCM(restaurantId: string) {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [FCM] Skipping FCM initialization (not Android)');
    return () => {};
  }

  if (!messaging) {
    console.log('⏭️ [FCM] Firebase not available, skipping initialization');
    return () => {};
  }

  console.log('🚀 [FCM] Initializing FCM service for restaurant:', restaurantId);

  const unsubscribeForeground = setupForegroundMessageHandler();
  const unsubscribeTokenRefresh = setupTokenRefreshListener(restaurantId);
  registerFCMToken(restaurantId);

  console.log('✅ [FCM] FCM service initialized');

  return () => {
    unsubscribeForeground();
    unsubscribeTokenRefresh();
  };
}

/**
 * Check if FCM is available and working
 */
export async function checkFCMStatus(): Promise<{
  hasPermission: boolean;
  hasToken: boolean;
  token: string | null;
}> {
  if (!messaging) {
    return {
      hasPermission: false,
      hasToken: false,
      token: null,
    };
  }

  try {
    const authStatus = await messaging().hasPermission();
    const hasPermission =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    let token: string | null = null;
    if (hasPermission) {
      token = await messaging().getToken();
    }

    return {
      hasPermission,
      hasToken: !!token,
      token,
    };
  } catch (error) {
    console.error('❌ [FCM] Error checking status:', error);
    return {
      hasPermission: false,
      hasToken: false,
      token: null,
    };
  }
}
