/**
 * Firebase Cloud Messaging (FCM) Service
 *
 * This service handles:
 * 1. FCM token registration and updates
 * 2. Storing tokens in Supabase for backend to send messages
 * 3. Background message handling
 * 4. Triggering notifications and sounds when FCM messages arrive
 */

import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from './notification-sound-manager';
import { triggerBookingAlert } from './booking-alert-manager';
import notifee from '@notifee/react-native';

/**
 * Request notification permissions and get FCM token
 * This MUST be called when user logs in
 */
export async function requestNotificationPermissionAndGetToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [FCM] Skipping FCM setup (not Android)');
    return null;
  }

  try {
    console.log('🔔 [FCM] Requesting notification permission...');

    // Request permission (required for Android 13+)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('❌ [FCM] Notification permission denied');
      return null;
    }

    console.log('✅ [FCM] Notification permission granted');

    // Get FCM token
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
 * Links the token to the current user and restaurant
 */
export async function registerFCMToken(restaurantId: string) {
  try {
    const token = await requestNotificationPermissionAndGetToken();
    if (!token) {
      console.log('⏭️ [FCM] No token to register');
      return;
    }

    console.log('📝 [FCM] Registering token in Supabase...');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ [FCM] No user found, cannot register token');
      return;
    }

    // Upsert token in database
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
        onConflict: 'fcm_token', // Update if token already exists
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
 * Handle token refresh (FCM tokens can change periodically)
 */
export function setupTokenRefreshListener(restaurantId: string) {
  return messaging().onTokenRefresh(async (newToken) => {
    console.log('🔄 [FCM] Token refreshed:', newToken.substring(0, 20) + '...');
    await registerFCMToken(restaurantId);
  });
}

/**
 * Background message handler
 * This function runs even when the app is COMPLETELY CLOSED
 * It's called by Firebase when FCM message arrives in background
 */
export function setupBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📨 [FCM Background] Message received!', remoteMessage);

    try {
      const data = remoteMessage.data;

      if (!data || data.type !== 'new_booking') {
        console.log('⏭️ [FCM Background] Not a booking message');
        return;
      }

      const bookingId = data.bookingId as string;
      const guestName = data.guestName as string;
      const partySize = parseInt(data.partySize as string) || 1; // Fallback to 1 if NaN
      const bookingTime = data.bookingTime as string;

      console.log('🎉 [FCM Background] New booking:', { bookingId, guestName, partySize });

      // Play notification sound (don't let it block alert)
      playNotificationSound(bookingId).catch(err => {
        console.error('❌ [FCM Background] Sound error:', err);
      });

      // Trigger Notifee booking alert with actions (don't let it block sound)
      triggerBookingAlert(bookingId, guestName, partySize, bookingTime).catch(err => {
        console.error('❌ [FCM Background] Alert error:', err);
      });

      console.log('✅ [FCM Background] Notification and sound triggered');
    } catch (error) {
      console.error('❌ [FCM Background] Error handling message:', error);
    }
  });

  console.log('✅ [FCM] Background message handler registered');
}

/**
 * Foreground message handler
 * This function runs when the app is OPEN and in foreground
 */
export function setupForegroundMessageHandler() {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('📨 [FCM Foreground] Message received!', remoteMessage);

    try {
      const data = remoteMessage.data;

      if (!data || data.type !== 'new_booking') {
        console.log('⏭️ [FCM Foreground] Not a booking message');
        return;
      }

      const bookingId = data.bookingId as string;
      const guestName = data.guestName as string;
      const partySize = parseInt(data.partySize as string) || 1; // Fallback to 1 if NaN
      const bookingTime = data.bookingTime as string;

      console.log('🎉 [FCM Foreground] New booking:', { bookingId, guestName, partySize });

      // Play notification sound (don't let it block alert)
      playNotificationSound(bookingId).catch(err => {
        console.error('❌ [FCM Foreground] Sound error:', err);
      });

      // Trigger Notifee booking alert (this already displays the notification, no need for duplicate)
      triggerBookingAlert(bookingId, guestName, partySize, bookingTime).catch(err => {
        console.error('❌ [FCM Foreground] Alert error:', err);
      });

      console.log('✅ [FCM Foreground] Notification and sound triggered');
    } catch (error) {
      console.error('❌ [FCM Foreground] Error handling message:', error);
    }
  });
}

/**
 * Initialize FCM service
 * Call this when user is authenticated and restaurant is loaded
 *
 * NOTE: Background message handler should be set up at module level in _layout.tsx,
 * NOT here, to avoid registering it multiple times.
 */
export function initializeFCM(restaurantId: string) {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [FCM] Skipping FCM initialization (not Android)');
    return () => {};
  }

  console.log('🚀 [FCM] Initializing FCM service for restaurant:', restaurantId);

  // Setup foreground handler (for when app is open)
  const unsubscribeForeground = setupForegroundMessageHandler();

  // Setup token refresh listener
  const unsubscribeTokenRefresh = setupTokenRefreshListener(restaurantId);

  // Register token
  registerFCMToken(restaurantId);

  console.log('✅ [FCM] FCM service initialized');

  // Return cleanup function
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
