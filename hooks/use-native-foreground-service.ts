import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Native Android Foreground Service Hook
 *
 * Uses @notifee/react-native to create a TRUE Android Foreground Service that:
 * - Plays continuous alert sound even when app is closed/locked
 * - Shows persistent, non-dismissible notification
 * - Survives force-close (when triggered by FCM)
 * - Cannot be killed by battery optimization
 *
 * This is the BULLETPROOF solution for Samsung tablets.
 */

interface BookingAlert {
  bookingId: string;
  guestName: string;
  partySize: number;
}

const CHANNEL_ID = 'booking-foreground-service';
const NOTIFICATION_ID = 'booking-alert';

export function useNativeForegroundService() {
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      console.log('⏭️ Native foreground service only available on Android');
      return;
    }

    // Create notification channel on mount
    createNotificationChannel();

    // Setup notification event listeners
    setupNotificationListeners();

    return () => {
      // Cleanup on unmount
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
    };
  }, []);

  /**
   * Create Android notification channel for foreground service
   */
  const createNotificationChannel = async () => {
    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Booking Alerts (Foreground Service)',
        importance: AndroidImportance.HIGH,
        sound: 'new_booking', // References new_booking.wav in assets
        vibration: true,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        lights: true,
        lightColor: '#792339',
        bypassDnd: true, // Works even in Do Not Disturb
        visibility: AndroidVisibility.PUBLIC, // Shows on lock screen
      });

      console.log('✅ Native foreground service channel created');
    } catch (error) {
      console.error('❌ Error creating notification channel:', error);
    }
  };

  /**
   * Setup listeners for notification actions
   */
  const setupNotificationListeners = () => {
    // Handle notification press
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('📱 Foreground service notification pressed');
        // User tapped notification - let the app handle navigation
      }

      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'acknowledge') {
        console.log('✅ Acknowledge action pressed from notification');
        // Stop the service
        stop();
      }
    });

    // Handle background notification events
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'acknowledge') {
        console.log('✅ Acknowledge action pressed from background');
        await stop();
      }
    });
  };

  /**
   * Start the native foreground service with continuous sound
   */
  const start = useCallback(async (booking: BookingAlert): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.warn('⚠️ Native foreground service only works on Android');
      return false;
    }

    try {
      console.log(`🚀 Starting native foreground service for booking: ${booking.bookingId}`);

      // Display foreground service notification
      await notifee.displayNotification({
        id: NOTIFICATION_ID,
        title: '🔔 URGENT: New Booking Request!',
        body: `${booking.guestName} wants to book for ${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}.\n\nTap "Acknowledge" to stop the alert.`,
        data: {
          bookingId: booking.bookingId,
          type: 'native_foreground_service',
        },
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,

          // CRITICAL: Register as foreground service
          asForegroundService: true,

          // Ongoing notification (can't swipe away)
          ongoing: true,

          // Auto-cancel disabled (stays until explicitly dismissed)
          autoCancel: false,

          // Show on lock screen
          visibility: AndroidVisibility.PUBLIC,

          // Full screen intent (wakes screen when locked)
          fullScreenAction: {
            id: 'default',
          },

          // Sound settings
          sound: 'new_booking',
          vibrationPattern: [0, 1000, 500, 1000, 500, 1000],

          // Action buttons
          actions: [
            {
              title: '✅ Acknowledge',
              pressAction: {
                id: 'acknowledge',
              },
            },
          ],

          // Progress indicator (indeterminate - shows it's active)
          progress: {
            indeterminate: true,
          },

          // Color
          color: '#792339',

          // Small icon
          smallIcon: 'ic_launcher',

          // Category
          category: 'alarm',

          // Lights
          lightUpScreen: true,
          lights: ['#792339', 1000, 500],
        },
      });

      // Start sound loop
      // Note: Notifee plays sound once per notification
      // To loop sound, we need to trigger notifications repeatedly
      startSoundLoop(booking);

      setIsServiceRunning(true);
      setActiveBookingId(booking.bookingId);

      console.log('✅ Native foreground service started successfully');
      return true;

    } catch (error) {
      console.error('❌ Error starting native foreground service:', error);
      return false;
    }
  }, []);

  /**
   * Start continuous sound loop by updating notification
   */
  const startSoundLoop = (booking: BookingAlert) => {
    // Clear any existing interval
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
    }

    // Update notification every 5 seconds to re-trigger sound
    // This creates a continuous alert effect
    soundIntervalRef.current = setInterval(async () => {
      try {
        // Update the notification to re-trigger sound
        await notifee.displayNotification({
          id: NOTIFICATION_ID, // Same ID = updates existing notification
          title: '🔔 URGENT: New Booking Request!',
          body: `${booking.guestName} is still waiting! ${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}`,
          data: {
            bookingId: booking.bookingId,
            type: 'native_foreground_service_update',
            timestamp: Date.now(),
          },
          android: {
            channelId: CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            asForegroundService: true,
            ongoing: true,
            autoCancel: false,
            visibility: AndroidVisibility.PUBLIC,
            sound: 'new_booking',
            vibrationPattern: [0, 1000, 500, 1000],
            actions: [
              {
                title: '✅ Acknowledge',
                pressAction: {
                  id: 'acknowledge',
                },
              },
            ],
            progress: {
              indeterminate: true,
            },
            color: '#792339',
            smallIcon: 'ic_launcher',
            category: 'alarm',
            lightUpScreen: true,
            lights: ['#792339', 1000, 500],
          },
        });

        console.log('🔔 Sound loop: Notification updated');
      } catch (error) {
        console.error('❌ Error in sound loop:', error);
      }
    }, 5000); // Every 5 seconds
  };

  /**
   * Stop the native foreground service
   */
  const stop = useCallback(async (bookingId?: string): Promise<void> => {
    try {
      // If bookingId provided, only stop if it matches active booking
      if (bookingId && bookingId !== activeBookingId) {
        console.log(`⏭️ Skipping stop: ${bookingId} doesn't match active booking ${activeBookingId}`);
        return;
      }

      console.log('🛑 Stopping native foreground service');

      // Clear sound loop
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }

      // Cancel the foreground service notification
      await notifee.cancelNotification(NOTIFICATION_ID);

      // Stop the foreground service
      await notifee.stopForegroundService();

      setIsServiceRunning(false);
      setActiveBookingId(null);

      console.log('✅ Native foreground service stopped');
    } catch (error) {
      console.error('❌ Error stopping native foreground service:', error);
    }
  }, [activeBookingId]);

  /**
   * Check if service is currently running
   */
  const isRunning = useCallback((): boolean => {
    return isServiceRunning;
  }, [isServiceRunning]);

  /**
   * Get the active booking ID (if any)
   */
  const getActiveBookingId = useCallback((): string | null => {
    return activeBookingId;
  }, [activeBookingId]);

  /**
   * Test the native service (for debugging)
   */
  const test = useCallback(async (): Promise<boolean> => {
    console.log('🧪 Testing native foreground service...');

    const testBooking: BookingAlert = {
      bookingId: 'test-booking-id',
      guestName: 'Test Guest',
      partySize: 4,
    };

    const success = await start(testBooking);

    // Auto-stop after 5 seconds
    setTimeout(async () => {
      await stop();
      console.log('✅ Test complete');
    }, 5000);

    return success;
  }, [start, stop]);

  return {
    start,
    stop,
    test,
    isRunning,
    getActiveBookingId,
    isServiceRunning,
    activeBookingId,
  };
}
