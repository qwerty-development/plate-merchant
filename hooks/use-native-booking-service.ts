import BookingService from '@/modules/booking-service';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

const { ServiceConfig } = NativeModules;

interface BookingEvent {
  bookingId: string;
  guestName?: string;
  partySize?: number;
  action?: string;
}

/**
 * Hook to manage the native Android booking listener service
 * This is the MAIN service that keeps the app alive and listens for bookings 24/7
 */
export function useNativeBookingService() {
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [lastBookingEvent, setLastBookingEvent] = useState<BookingEvent | null>(null);

  // Start the native service
  const startService = useCallback(async (
    restaurantId: string,
    supabaseUrl: string,
    supabaseKey: string
  ) => {
    if (Platform.OS !== 'android') {
      console.log('⏭️ Native service only available on Android');
      return false;
    }

    try {
      console.log('🚀 Starting native booking service...');
      
      // Save configuration to native SharedPreferences (for BootReceiver)
      if (ServiceConfig) {
        ServiceConfig.saveConfig(restaurantId, supabaseUrl, supabaseKey);
        console.log('📝 Configuration saved to native SharedPreferences');
      }
      
      const success = BookingService.startService(restaurantId, supabaseUrl, supabaseKey);
      
      if (success) {
        setIsServiceRunning(true);
        console.log('✅ Native booking service started successfully');
      } else {
        console.error('❌ Failed to start native booking service');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error starting native service:', error);
      return false;
    }
  }, []);

  // Stop the native service
  const stopService = useCallback(async () => {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('🛑 Stopping native booking service...');
      const success = BookingService.stopService();
      
      if (success) {
        setIsServiceRunning(false);
        console.log('✅ Native booking service stopped');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error stopping native service:', error);
      return false;
    }
  }, []);

  // Stop alarm for a specific booking
  const stopAlarm = useCallback((bookingId: string) => {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('🔕 Stopping alarm for booking:', bookingId);
      return BookingService.stopAlarm(bookingId);
    } catch (error) {
      console.error('❌ Error stopping alarm:', error);
      return false;
    }
  }, []);

  // Accept booking (stops alarm and updates status)
  const acceptBooking = useCallback((bookingId: string) => {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('✅ Accepting booking via native service:', bookingId);
      return BookingService.acceptBooking(bookingId);
    } catch (error) {
      console.error('❌ Error accepting booking:', error);
      return false;
    }
  }, []);

  // Decline booking (stops alarm and updates status)
  const declineBooking = useCallback((bookingId: string) => {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('❌ Declining booking via native service:', bookingId);
      return BookingService.declineBooking(bookingId);
    } catch (error) {
      console.error('❌ Error declining booking:', error);
      return false;
    }
  }, []);

  // Listen for booking events from native service
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const eventEmitter = DeviceEventEmitter;
    
    const subscription = eventEmitter.addListener(
      'com.qwertyapps.platemerchant.BOOKING_EVENT',
      (event: BookingEvent) => {
        console.log('📨 Booking event from native service:', event);
        setLastBookingEvent(event);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    isServiceRunning,
    lastBookingEvent,
    startService,
    stopService,
    stopAlarm,
    acceptBooking,
    declineBooking,
  };
}
