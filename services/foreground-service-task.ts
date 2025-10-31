// services/foreground-service-task.ts

import { supabase } from '@/lib/supabase';
import { Booking } from '@/types/database';
import notifee from '@notifee/react-native';
import * as Notifications from 'expo-notifications';
import { playNotificationSound, stopNotificationSound } from './notification-sound-manager';

/**
 * Sends a high-priority local push notification for a new booking.
 */
async function sendNewBookingNotification(booking: Booking) {
  try {
    const guestName = booking.guest_name || 'Guest';
    const partySize = booking.party_size;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 New Booking Request!',
        body: `${guestName} for ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`,
        sound: 'new_booking.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 200, 500],
        categoryIdentifier: 'BOOKING_ACTION',
        data: { bookingId: booking.id, type: 'new_booking' },
      },
      trigger: null, // Shows immediately
    });
  } catch (e) {
    console.error('Failed to send push notification', e);
  }
}

/**
 * Register the foreground service task with Notifee.
 * This MUST be called at app startup.
 * This task keeps the app alive and maintains the realtime connection.
 */
export function registerForegroundServiceTask() {
  notifee.registerForegroundService(() => {
    return new Promise(() => {
      // This promise intentionally never resolves to keep the service running.
      console.log('✅ Foreground service headless task is now running.');

      const channel = supabase.channel('background-booking-listener');

      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bookings', filter: 'status=eq.pending' },
          async payload => {
            console.log('📨 [BACKGROUND] New pending booking received!');
            const newBooking = payload.new as Booking;
            // Use the centralized sound manager to play sound
            await playNotificationSound(newBooking.id);
            await sendNewBookingNotification(newBooking);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bookings' },
          async payload => {
            // Check if a booking was handled (no longer pending)
            if (payload.old.status === 'pending' && payload.new.status !== 'pending') {
              console.log('📨 [BACKGROUND] Booking handled, requesting sound stop.');
              // Use the centralized sound manager to stop sound
              await stopNotificationSound(payload.new.id);
            }
          }
        )
        .subscribe(status => {
          console.log(`📡 [BACKGROUND] Supabase status: ${status}`);
          if (status === 'SUBSCRIBED') {
            console.log('✅ [BACKGROUND] Supabase realtime connected!');
          }
        });

      console.log('👂 [BACKGROUND] Headless task is now listening for bookings...');
    });
  });
}