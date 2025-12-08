/**
 * Booking Alert Manager
 * Simple wrapper using expo-notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'booking-alerts-critical';

export async function initializeBookingAlerts() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Booking Alerts',
      description: 'Critical alerts for new booking requests',
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
    console.log('✅ [BookingAlerts] Channel created');
  } catch (error) {
    console.error('❌ [BookingAlerts] Error:', error);
  }
}

export async function triggerBookingAlert(
  bookingId: string,
  guestName: string,
  partySize: number,
  bookingTime?: string
) {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `booking-${bookingId}`,
      content: {
        title: '🎉 New Booking Request!',
        body: `${guestName} • ${partySize} ${partySize === 1 ? 'guest' : 'guests'}${bookingTime ? ` • ${bookingTime}` : ''}`,
        data: { bookingId, type: 'booking_alert' },
        sound: 'new_booking.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'BOOKING_ACTION',
        badge: 1,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('❌ [BookingAlerts] Error:', error);
  }
}

export async function stopBookingAlert(bookingId: string) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(`booking-${bookingId}`);
    await Notifications.cancelScheduledNotificationAsync(`booking-${bookingId}`);
  } catch (error) {
    console.error('❌ [BookingAlerts] Error:', error);
  }
}

export async function stopAllBookingAlerts() {
  if (Platform.OS !== 'android') return;
  try {
    const notifications = await Notifications.getPresentedNotificationsAsync();
    for (const n of notifications) {
      if (n.request.identifier?.startsWith('booking-')) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch (error) {
    console.error('❌ [BookingAlerts] Error:', error);
  }
}

export function getActiveBookingAlertsCount(): number {
  return 0; // Simplified
}

export function hasActiveAlert(bookingId: string): boolean {
  return false; // Simplified
}
