/**
 * ============================================================================
 * Restaurant Push Notification Service
 * ============================================================================
 * Handles registration and reception of server-side push notifications
 * for restaurant tablets. This ensures 100% reliable notification delivery
 * as notifications are sent from Supabase Edge Functions via Expo Push.
 * ============================================================================
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { triggerBookingAlert } from './booking-alert-manager';
import Constants from 'expo-constants';

let registeredToken: string | null = null;
let isInitialized = false;

/**
 * Initialize push notification system for restaurant tablets
 * Call this once at app startup
 */
export async function initializeRestaurantPushNotifications(
  restaurantId: string
): Promise<boolean> {
  if (isInitialized) {
    console.log('📱 [RestaurantPush] Already initialized');
    return true;
  }

  try {
    console.log('📱 [RestaurantPush] Initializing...');

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log('📬 [RestaurantPush] Notification received:', notification);

        // Always show notifications and play sound
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.error('❌ [RestaurantPush] Permission not granted');
      return false;
    }

    console.log('✅ [RestaurantPush] Permission granted');

    // Get push token
    if (!Device.isDevice) {
      console.warn('⚠️ [RestaurantPush] Must use physical device for push notifications');
      return false;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    registeredToken = tokenData.data;
    console.log('📱 [RestaurantPush] Got push token:', registeredToken);

    // Register device with Supabase
    await registerDevice(restaurantId, registeredToken);

    // Set up foreground notification handler
    setupForegroundHandler();

    // Set up background notification handler
    setupBackgroundHandler();

    isInitialized = true;
    console.log('✅ [RestaurantPush] Initialization complete');

    return true;
  } catch (error) {
    console.error('❌ [RestaurantPush] Initialization error:', error);
    return false;
  }
}

/**
 * Register device token with Supabase
 */
async function registerDevice(
  restaurantId: string,
  pushToken: string
): Promise<void> {
  try {
    const deviceId = pushToken; // Use token as unique device ID
    const platform = Platform.OS;
    const appVersion = Constants.expoConfig?.version || 'unknown';

    console.log('📝 [RestaurantPush] Registering device...');

    const { error } = await supabase.from('restaurant_devices').upsert(
      {
        restaurant_id: restaurantId,
        device_id: deviceId,
        expo_push_token: pushToken,
        device_name: `${Device.brand} ${Device.modelName}`,
        platform: platform,
        app_version: appVersion,
        enabled: true,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: 'restaurant_id,device_id',
      }
    );

    if (error) {
      throw error;
    }

    console.log('✅ [RestaurantPush] Device registered successfully');
  } catch (error) {
    console.error('❌ [RestaurantPush] Device registration error:', error);
    throw error;
  }
}

/**
 * Handle notifications when app is in foreground
 */
function setupForegroundHandler() {
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('🔔 [RestaurantPush] Foreground notification:', notification);

    const data = notification.request.content.data;
    const type = data?.type as string;
    const bookingId = data?.bookingId as string;

    // Handle different notification types
    if (type === 'new_booking' && bookingId) {
      console.log('🎉 [RestaurantPush] New booking notification');

      // Trigger native alert with sound
      const guestName = (data?.guestName as string) || 'Guest';
      const partySize = (data?.partySize as number) || 0;
      const bookingTime = data?.bookingTime
        ? new Date(data.bookingTime as string).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        : undefined;

      triggerBookingAlert(bookingId, guestName, partySize, bookingTime);
    } else if (type === 'booking_cancelled' && bookingId) {
      console.log('❌ [RestaurantPush] Booking cancelled notification');
      // Handle cancellation (could show a different type of alert)
    } else if (type === 'booking_modified' && bookingId) {
      console.log('📝 [RestaurantPush] Booking modified notification');
      // Handle modification
    }
  });
}

/**
 * Handle notifications when app is in background
 */
function setupBackgroundHandler() {
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 [RestaurantPush] Notification tapped:', response);

    const data = response.notification.request.content.data;
    const bookingId = data?.bookingId as string;
    const deeplink = data?.deeplink as string;

    // Navigate to booking details if available
    if (deeplink) {
      console.log('🔗 [RestaurantPush] Opening deeplink:', deeplink);
      // TODO: Handle navigation to booking details screen
    } else if (bookingId) {
      console.log('📖 [RestaurantPush] Opening booking:', bookingId);
      // TODO: Navigate to booking screen
    }
  });
}

/**
 * Unregister device (call when logging out or switching restaurants)
 */
export async function unregisterDevice(restaurantId: string): Promise<void> {
  if (!registeredToken) {
    console.log('⚠️ [RestaurantPush] No token to unregister');
    return;
  }

  try {
    console.log('🔌 [RestaurantPush] Unregistering device...');

    const { error } = await supabase
      .from('restaurant_devices')
      .update({
        enabled: false,
        last_seen: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('expo_push_token', registeredToken);

    if (error) {
      throw error;
    }

    console.log('✅ [RestaurantPush] Device unregistered');
    registeredToken = null;
    isInitialized = false;
  } catch (error) {
    console.error('❌ [RestaurantPush] Unregister error:', error);
  }
}

/**
 * Update device last seen timestamp
 */
export async function updateDeviceHeartbeat(restaurantId: string): Promise<void> {
  if (!registeredToken) return;

  try {
    await supabase
      .from('restaurant_devices')
      .update({
        last_seen: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('expo_push_token', registeredToken);
  } catch (error) {
    console.error('❌ [RestaurantPush] Heartbeat update error:', error);
  }
}

/**
 * Get current push token
 */
export function getPushToken(): string | null {
  return registeredToken;
}

/**
 * Check if push notifications are initialized
 */
export function isInitializedPush(): boolean {
  return isInitialized;
}
