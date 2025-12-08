/**
 * Booking Notification Service
 * 
 * Simple, reliable notification system using ONLY expo-notifications.
 * Works with FCM for background/killed app state.
 */

import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'plate_bookings';
const ACTIVE_NOTIFICATIONS = new Map<string, NodeJS.Timeout>();

export interface BookingNotificationData {
  type?: 'NEW_BOOKING' | 'BOOKING_STATUS_CHANGED';
  booking_id: string;
  restaurant_id: string;
  guest_name: string;
  guest_count: number;
  booking_time: string;
}

/**
 * Setup notification channel - call at app startup
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    // Create high-priority channel
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Booking Alerts',
      description: 'New booking requests',
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

    // Create category with action buttons
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

    console.log('✅ [BookingNotifications] Channels setup complete');
  } catch (error) {
    console.error('❌ [BookingNotifications] Setup error:', error);
  }
}

/**
 * Handle notification action (Accept/Decline)
 */
export async function handleNotificationAction(
  actionIdentifier: string,
  notificationData: any
) {
  const bookingId = notificationData?.bookingId || notificationData?.booking_id;
  if (!bookingId) return;

  try {
    if (actionIdentifier === 'ACCEPT') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      await cancelBookingNotification(bookingId);
    } else if (actionIdentifier === 'DECLINE') {
      await supabase
        .from('bookings')
        .update({ status: 'declined_by_restaurant', updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      await cancelBookingNotification(bookingId);
    }
  } catch (error) {
    console.error('❌ [BookingNotifications] Action error:', error);
  }
}

/**
 * Display new booking notification
 * Re-triggers every 30 seconds until booking is handled (simulates ongoing notification)
 */
export async function displayNewBookingNotification(data: BookingNotificationData) {
  try {
    const { booking_id, guest_name, guest_count, booking_time } = data;
    const formattedTime = formatBookingTime(booking_time);

    const showNotification = async () => {
      await Notifications.scheduleNotificationAsync({
        identifier: `booking_${booking_id}`,
        content: {
          title: 'New booking – Plate',
          body: `${guest_name} • ${guest_count} ${guest_count === 1 ? 'guest' : 'guests'} at ${formattedTime}`,
          data: {
            bookingId: booking_id,
            type: 'NEW_BOOKING',
          },
          sound: 'new_booking.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'BOOKING_ACTION',
          badge: 1,
        },
        trigger: null,
      });
    };

    // Show immediately
    await showNotification();

    // Clear any existing interval for this booking
    const existingInterval = ACTIVE_NOTIFICATIONS.get(booking_id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Re-trigger every 30 seconds to keep notification visible (simulates ongoing)
    const interval = setInterval(async () => {
      try {
        // Check if booking is still pending before re-triggering
        const { data: booking } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', booking_id)
          .single();

        if (booking && booking.status === 'pending') {
          await showNotification();
          console.log('🔄 [BookingNotifications] Re-triggering notification for:', booking_id);
        } else {
          // Booking was handled, stop re-triggering
          clearInterval(interval);
          ACTIVE_NOTIFICATIONS.delete(booking_id);
          await cancelBookingNotification(booking_id);
        }
      } catch (error) {
        console.error('❌ [BookingNotifications] Error checking booking status:', error);
      }
    }, 30000); // 30 seconds

    ACTIVE_NOTIFICATIONS.set(booking_id, interval);
    console.log('✅ [BookingNotifications] Notification displayed (will re-trigger every 30s):', booking_id);
  } catch (error) {
    console.error('❌ [BookingNotifications] Display error:', error);
  }
}

/**
 * Cancel booking notification
 */
export async function cancelBookingNotification(bookingId: string) {
  try {
    // Stop re-triggering interval
    const interval = ACTIVE_NOTIFICATIONS.get(bookingId);
    if (interval) {
      clearInterval(interval);
      ACTIVE_NOTIFICATIONS.delete(bookingId);
    }

    // Cancel notification
    await Notifications.dismissNotificationAsync(`booking_${bookingId}`);
    await Notifications.cancelScheduledNotificationAsync(`booking_${bookingId}`);
    console.log('✅ [BookingNotifications] Notification cancelled:', bookingId);
  } catch (error) {
    console.error('❌ [BookingNotifications] Cancel error:', error);
  }
}

/**
 * Resolve booking notification (when accepted/declined)
 */
export async function resolveBookingNotification(
  bookingId: string,
  status: 'confirmed' | 'declined_by_restaurant'
) {
  await cancelBookingNotification(bookingId);
}

function formatBookingTime(bookingTime: string): string {
  try {
    return new Date(bookingTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}
