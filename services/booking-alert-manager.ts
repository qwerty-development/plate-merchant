/**
 * Booking Alert Manager - Native notification system using Notifee
 * This ensures alerts work even when app is backgrounded or screen is off
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  EventType,
  Event,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const BOOKING_CHANNEL_ID = 'booking-alerts-critical';
const ACTIVE_BOOKINGS = new Set<string>();

/**
 * Initialize the booking alert notification channel
 * MUST be called at app startup
 */
export async function initializeBookingAlerts() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🔔 [BookingAlerts] Initializing booking alert channel...');

    // Create HIGH PRIORITY channel for booking alerts
    await notifee.createChannel({
      id: BOOKING_CHANNEL_ID,
      name: 'Booking Alerts',
      description: 'Critical alerts for new booking requests',
      importance: AndroidImportance.HIGH, // HIGH = shows as heads-up notification
      sound: 'default', // Use default notification sound (custom sounds require native setup)
      vibration: true,
      vibrationPattern: [500, 500, 500, 500], // Strong vibration pattern
      lights: true,
      lightColor: '#792339',
      bypassDnd: true, // Bypass Do Not Disturb mode
    });

    console.log('✅ [BookingAlerts] Booking alert channel created');

    // Set up notification event handlers
    notifee.onForegroundEvent(handleNotificationEvent);
    notifee.onBackgroundEvent(handleNotificationEvent);

  } catch (error) {
    console.error('❌ [BookingAlerts] Error initializing:', error);
  }
}

/**
 * Handle notification actions (Accept/Decline from notification)
 */
async function handleNotificationEvent({ type, detail }: Event) {
  const { notification, pressAction } = detail;

  console.log('📱 [BookingAlerts] Event:', type, 'Action:', pressAction?.id);

  if (type === EventType.PRESS) {
    // User tapped the notification - open app to bookings screen
    console.log('👆 [BookingAlerts] Notification tapped, opening app...');
  } else if (type === EventType.ACTION_PRESS && pressAction?.id) {
    const bookingId = notification?.data?.bookingId as string;

    if (pressAction.id === 'accept' && bookingId) {
      console.log('✅ [BookingAlerts] Accept action for booking:', bookingId);
      // TODO: Call accept booking API
      await stopBookingAlert(bookingId);
    } else if (pressAction.id === 'decline' && bookingId) {
      console.log('❌ [BookingAlerts] Decline action for booking:', bookingId);
      // TODO: Call decline booking API
      await stopBookingAlert(bookingId);
    }
  } else if (type === EventType.DISMISSED) {
    // Notification was dismissed - but booking is still pending
    console.log('👋 [BookingAlerts] Notification dismissed');
  }
}

/**
 * Trigger a booking alert notification
 * This works even when app is backgrounded or screen is off
 */
export async function triggerBookingAlert(
  bookingId: string,
  guestName: string,
  partySize: number,
  bookingTime?: string
) {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🚨 [BookingAlerts] Triggering alert for booking:', bookingId);

    // Add to active bookings set
    ACTIVE_BOOKINGS.add(bookingId);

    // Create notification with actions
    await notifee.displayNotification({
      id: `booking-${bookingId}`,
      title: '🎉 New Booking Request!',
      body: `${guestName} • ${partySize} ${partySize === 1 ? 'guest' : 'guests'}${bookingTime ? ` • ${bookingTime}` : ''}`,
      data: {
        bookingId,
        type: 'booking_alert',
      },
      android: {
        channelId: BOOKING_CHANNEL_ID,
        importance: AndroidImportance.HIGH,

        // Make it persistent and attention-grabbing
        ongoing: false, // User can dismiss, but we'll re-alert
        autoCancel: false, // Stays until handled
        category: AndroidCategory.ALARM,
        visibility: AndroidVisibility.PUBLIC,

        // Sound and vibration (will use channel's default sound)
        vibrationPattern: [0, 500, 500, 500, 500, 500],

        // Full screen intent - wakes up screen
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },

        // Heads-up notification
        showTimestamp: true,
        timestamp: Date.now(),

        // Color and style
        color: '#792339',
        smallIcon: 'ic_notification', // Falls back to ic_launcher if not found

        // Action buttons
        actions: [
          {
            title: '✅ Accept',
            pressAction: {
              id: 'accept',
              launchActivity: 'default',
            },
          },
          {
            title: '❌ Decline',
            pressAction: {
              id: 'decline',
              launchActivity: 'default',
            },
          },
        ],
      },
    });

    console.log('✅ [BookingAlerts] Alert notification displayed');

    // Set up repeating alert if not handled within 10 seconds
    setTimeout(() => {
      if (ACTIVE_BOOKINGS.has(bookingId)) {
        console.log('⏰ [BookingAlerts] Re-alerting for booking:', bookingId);
        triggerBookingAlert(bookingId, guestName, partySize, bookingTime);
      }
    }, 10000); // Re-alert every 10 seconds

  } catch (error) {
    console.error('❌ [BookingAlerts] Error triggering alert:', error);
  }
}

/**
 * Stop the booking alert for a specific booking
 */
export async function stopBookingAlert(bookingId: string) {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🛑 [BookingAlerts] Stopping alert for booking:', bookingId);

    // Remove from active set
    ACTIVE_BOOKINGS.delete(bookingId);

    // Cancel the notification
    await notifee.cancelNotification(`booking-${bookingId}`);

    console.log('✅ [BookingAlerts] Alert stopped');
  } catch (error) {
    console.error('❌ [BookingAlerts] Error stopping alert:', error);
  }
}

/**
 * Stop all booking alerts
 */
export async function stopAllBookingAlerts() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🛑 [BookingAlerts] Stopping all alerts');

    // Clear the active set
    ACTIVE_BOOKINGS.clear();

    // Cancel all booking notifications
    const notifications = await notifee.getDisplayedNotifications();
    for (const notification of notifications) {
      if (notification.id?.startsWith('booking-')) {
        await notifee.cancelNotification(notification.id);
      }
    }

    console.log('✅ [BookingAlerts] All alerts stopped');
  } catch (error) {
    console.error('❌ [BookingAlerts] Error stopping alerts:', error);
  }
}

/**
 * Get count of active booking alerts
 */
export function getActiveBookingAlertsCount(): number {
  return ACTIVE_BOOKINGS.size;
}

/**
 * Check if a booking has an active alert
 */
export function hasActiveAlert(bookingId: string): boolean {
  return ACTIVE_BOOKINGS.has(bookingId);
}
