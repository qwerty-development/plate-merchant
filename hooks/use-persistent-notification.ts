import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const PENDING_BOOKINGS_KEY = '@pending_bookings';
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

interface PendingBooking {
  id: string;
  guestName: string;
  partySize: number;
  timestamp: number;
  notificationCount: number; // Track how many times we've notified
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    console.log('🔄 Background task running...');
    
    // Get pending bookings from storage
    const stored = await AsyncStorage.getItem(PENDING_BOOKINGS_KEY);
    if (!stored) {
      console.log('No pending bookings in background');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const pendingBookings: PendingBooking[] = JSON.parse(stored);
    console.log(`📋 Found ${pendingBookings.length} pending bookings in background`);

    // Send repeating notifications for each pending booking
    for (const booking of pendingBookings) {
      await sendPersistentNotification(booking);
      
      // Update notification count
      booking.notificationCount++;
    }

    // Save updated counts
    await AsyncStorage.setItem(PENDING_BOOKINGS_KEY, JSON.stringify(pendingBookings));

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Send a persistent notification with high priority
 */
async function sendPersistentNotification(booking: PendingBooking) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 URGENT: New Booking Request!',
        body: `${booking.guestName} wants to book for ${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}. Tap to respond!`,
        data: { 
          bookingId: booking.id,
          type: 'persistent_booking',
          timestamp: Date.now(),
        },
        sound: 'new_booking.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 200, 500, 200, 500], // Long vibration pattern
        categoryIdentifier: 'BOOKING_ACTION',
        badge: 1,
        sticky: true, // Android - notification stays visible
        autoDismiss: false, // Android - won't auto-dismiss
      },
      trigger: null, // Show immediately
    });
    
    console.log(`✅ Persistent notification sent for booking ${booking.id} (count: ${booking.notificationCount + 1})`);
  } catch (error) {
    console.error('❌ Error sending persistent notification:', error);
  }
}

export function usePersistentNotification() {
  const [pendingBookings, setPendingBookings] = useState<Map<string, PendingBooking>>(new Map());
  const [isBackgroundTaskRegistered, setIsBackgroundTaskRegistered] = useState(false);

  // Load pending bookings from storage on mount
  useEffect(() => {
    loadPendingBookings();
  }, []);

  // Register background fetch task
  useEffect(() => {
    if (Platform.OS === 'android') {
      registerBackgroundTask();
    }
  }, []);

  const loadPendingBookings = async () => {
    try {
      const stored = await AsyncStorage.getItem(PENDING_BOOKINGS_KEY);
      if (stored) {
        const bookings: PendingBooking[] = JSON.parse(stored);
        const map = new Map(bookings.map(b => [b.id, b]));
        setPendingBookings(map);
        console.log(`📥 Loaded ${bookings.length} pending bookings from storage`);
      }
    } catch (error) {
      console.error('Error loading pending bookings:', error);
    }
  };

  const savePendingBookings = async (bookings: Map<string, PendingBooking>) => {
    try {
      const array = Array.from(bookings.values());
      await AsyncStorage.setItem(PENDING_BOOKINGS_KEY, JSON.stringify(array));
      console.log(`💾 Saved ${array.length} pending bookings to storage`);
    } catch (error) {
      console.error('Error saving pending bookings:', error);
    }
  };

  const registerBackgroundTask = async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
      
      if (!isRegistered) {
        console.log('📱 Registering background notification task...');
        
        await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
          minimumInterval: 15, // Minimum 15 seconds (Android minimum)
          stopOnTerminate: false, // Continue after app closes
          startOnBoot: true, // Start after device reboot
        });
        
        console.log('✅ Background task registered successfully');
        setIsBackgroundTaskRegistered(true);
      } else {
        console.log('✅ Background task already registered');
        setIsBackgroundTaskRegistered(true);
      }
    } catch (error) {
      console.error('❌ Error registering background task:', error);
    }
  };

  const addPendingBooking = useCallback(async (
    bookingId: string,
    guestName: string,
    partySize: number
  ) => {
    console.log(`➕ Adding pending booking: ${bookingId}`);
    
    const newBooking: PendingBooking = {
      id: bookingId,
      guestName,
      partySize,
      timestamp: Date.now(),
      notificationCount: 0,
    };

    setPendingBookings(prev => {
      const updated = new Map(prev);
      updated.set(bookingId, newBooking);
      savePendingBookings(updated);
      return updated;
    });

    // Send initial notification
    await sendPersistentNotification(newBooking);

    // Schedule repeating notifications every 30 seconds for the next 10 minutes
    // This ensures notifications keep coming even if background task fails
    for (let i = 1; i <= 20; i++) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 URGENT: New Booking Request!',
          body: `${guestName} is still waiting for a response! ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`,
          data: { 
            bookingId,
            type: 'persistent_booking_repeat',
            timestamp: Date.now(),
            sequence: i,
          },
          sound: 'new_booking.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 500, 200, 500],
          categoryIdentifier: 'BOOKING_ACTION',
          badge: 1,
          sticky: true,
          autoDismiss: false,
        },
        trigger: {
          seconds: 30 * i, // Every 30 seconds
        } as Notifications.TimeIntervalTriggerInput,
      });
    }

    console.log(`✅ Scheduled 20 repeating notifications for booking ${bookingId}`);
  }, []);

  const removePendingBooking = useCallback(async (bookingId: string) => {
    console.log(`➖ Removing pending booking: ${bookingId}`);
    
    setPendingBookings(prev => {
      const updated = new Map(prev);
      updated.delete(bookingId);
      savePendingBookings(updated);
      return updated;
    });

    // Cancel all scheduled notifications for this booking
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allNotifications) {
      if (notification.content.data?.bookingId === bookingId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    console.log(`✅ Cancelled all notifications for booking ${bookingId}`);
  }, []);

  const clearAllPendingBookings = useCallback(async () => {
    console.log('🗑️ Clearing all pending bookings');
    
    setPendingBookings(new Map());
    await AsyncStorage.removeItem(PENDING_BOOKINGS_KEY);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    
    console.log('✅ All pending bookings cleared');
  }, []);

  const getPendingCount = useCallback(() => {
    return pendingBookings.size;
  }, [pendingBookings]);

  return {
    addPendingBooking,
    removePendingBooking,
    clearAllPendingBookings,
    getPendingCount,
    pendingBookings: Array.from(pendingBookings.values()),
    isBackgroundTaskRegistered,
  };
}
