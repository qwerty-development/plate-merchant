import { NativeModules } from 'react-native';

interface BookingServiceNativeModule {
  startService(restaurantId: string, supabaseUrl: string, supabaseKey: string): boolean;
  stopService(): boolean;
  stopAlarm(bookingId: string): boolean;
  acceptBooking(bookingId: string): boolean;
  declineBooking(bookingId: string): boolean;
}

const { BookingService } = NativeModules;

export default BookingService as BookingServiceNativeModule;
