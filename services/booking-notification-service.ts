/**
 * Booking Notification Service
 * 
 * Simple, reliable notification system using ONLY expo-notifications.
 * Works with FCM for background/killed app state.
 */

import { supabase } from '@/lib/supabase';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { playNotificationSound, setupAudio, stopNotificationSound } from './notification-sound-manager';

const CHANNEL_ID = 'plate_bookings';
const ACTIVE_NOTIFICATIONS = new Map<string, NodeJS.Timeout>();
const PENDING_BOOKINGS = new Set<string>(); // Track pending bookings for background re-triggering

// Background task name
const BACKGROUND_FETCH_TASK = 'booking-notification-check';

/**
 * Background task to re-trigger pending booking notifications
 * This runs even when app is backgrounded/killed
 * MUST be defined before registerTaskAsync is called
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('🔄 [BookingNotifications] Background task running...');
  
  try {
    const { supabase } = require('@/lib/supabase');
    const Notifications = require('expo-notifications').default;
    
    // Check all pending bookings
    const pendingIds = Array.from(PENDING_BOOKINGS);
    
    for (const bookingId of pendingIds) {
      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select('status, guest_name, guest_count, booking_time')
          .eq('id', bookingId)
          .single();

        if (booking && booking.status === 'pending') {
          // Re-trigger notification
          const formattedTime = formatBookingTime(booking.booking_time);
          await Notifications.scheduleNotificationAsync({
            identifier: `booking_${bookingId}`,
            content: {
              title: 'New booking – Plate',
              body: `${booking.guest_name} • ${booking.guest_count} ${booking.guest_count === 1 ? 'guest' : 'guests'} at ${formattedTime}`,
              data: {
                bookingId: bookingId,
                type: 'NEW_BOOKING',
              },
              sound: 'new_booking.wav',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: 'BOOKING_ACTION',
              badge: 1,
            },
            trigger: null,
          });
          console.log('🔄 [BookingNotifications] Re-triggered notification (background):', bookingId);
        } else {
          // Booking was handled, remove from pending
          PENDING_BOOKINGS.delete(bookingId);
        }
      } catch (error) {
        console.error(`❌ [BookingNotifications] Error checking booking ${bookingId}:`, error);
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ [BookingNotifications] Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

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
    // Setup audio system for persistent looping sound
    await setupAudio().catch(err => {
      console.warn('⚠️ [BookingNotifications] Audio setup failed:', err);
    });

    // Create high-priority channel with custom sound
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Booking Alerts',
      description: 'New booking requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#792339',
      sound: 'new_booking.wav', // Must match filename in res/raw/
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

    // Register background task for re-triggering notifications
    if (Platform.OS === 'android') {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 30, // 30 seconds
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('✅ [BookingNotifications] Background task registered');
      } catch (error) {
        console.warn('⚠️ [BookingNotifications] Background task registration failed:', error);
      }
    }

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
 * Re-triggers every 30 seconds until booking is handled (works in foreground and background)
 */
export async function displayNewBookingNotification(data: BookingNotificationData) {
  try {
    const { booking_id, guest_name, guest_count, booking_time } = data;
    const formattedTime = formatBookingTime(booking_time);

    // Store booking info for background re-triggering
    PENDING_BOOKINGS.add(booking_id);

    const showNotification = async () => {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `booking_${booking_id}`,
          content: {
            title: 'New booking – Plate',
            body: `${guest_name} • ${guest_count} ${guest_count === 1 ? 'guest' : 'guests'} at ${formattedTime}`,
            data: {
              bookingId: booking_id,
              type: 'NEW_BOOKING',
            },
            sound: 'new_booking.wav', // Custom sound
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: 'BOOKING_ACTION',
            badge: 1,
            ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }), // Explicitly set channel for Android
          },
          trigger: null, // Show immediately
        });
        console.log('🔔 [BookingNotifications] Notification shown:', booking_id);
      } catch (error) {
        console.error('❌ [BookingNotifications] Error showing notification:', error);
      }
    };

    // Show immediately
    await showNotification();

    // Start persistent looping sound for in-app notifications
    // This will play continuously until booking is accepted/declined
    await playNotificationSound(booking_id).catch(err => {
      console.error('❌ [BookingNotifications] Error starting sound:', err);
    });

    // Clear any existing interval for this booking
    const existingInterval = ACTIVE_NOTIFICATIONS.get(booking_id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Re-trigger every 30 seconds (foreground only - background uses BackgroundFetch)
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
          console.log('🔄 [BookingNotifications] Re-triggering notification (foreground):', booking_id);
        } else {
          // Booking was handled, stop re-triggering
          clearInterval(interval);
          ACTIVE_NOTIFICATIONS.delete(booking_id);
          PENDING_BOOKINGS.delete(booking_id);
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

    // Remove from pending set
    PENDING_BOOKINGS.delete(bookingId);

    // Stop persistent looping sound
    await stopNotificationSound(bookingId).catch(err => {
      console.error('❌ [BookingNotifications] Error stopping sound:', err);
    });

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
