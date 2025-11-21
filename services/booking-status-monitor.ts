import { supabase } from '@/lib/supabase';
import { stopBookingAlert } from './booking-alert-manager';
import { stopPersistentAlert } from './persistent-audio-manager';

/**
 * Booking Status Monitor
 * 
 * This service listens for booking status changes via Supabase Realtime.
 * It runs globally (outside of UI components) to ensure that if the app is 
 * kept alive by the Foreground Service (sound playing), it can still 
 * receive updates and stop the sound if a booking is handled elsewhere.
 */

let subscription: any = null;

export function startBookingStatusMonitor(restaurantId: string) {
  if (subscription) {
    console.log('⚠️ [StatusMonitor] Already running, restarting...');
    stopBookingStatusMonitor();
  }

  console.log('🛡️ [StatusMonitor] Starting global booking status monitor for:', restaurantId);

  const channel = supabase
    .channel('global-booking-monitor')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      async (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;

        console.log(`🔄 [StatusMonitor] Booking update detected: ${newRecord.id}, Status: ${newRecord.status}`);

        // If booking was pending and is now NOT pending (accepted, declined, cancelled, etc.)
        // We must stop the sound and alert.
        if (newRecord.status !== 'pending') {
          console.log(`✅ [StatusMonitor] Booking ${newRecord.id} is no longer pending. Stopping alerts.`);
          
          // Stop the continuous sound
          await stopPersistentAlert(newRecord.id);
          
          // Clear the notification
          await stopBookingAlert(newRecord.id);
        }
      }
    )
    .subscribe((status) => {
      console.log('🛡️ [StatusMonitor] Subscription status:', status);
    });

  subscription = channel;
}

export function stopBookingStatusMonitor() {
  if (subscription) {
    console.log('🛑 [StatusMonitor] Stopping monitor');
    supabase.removeChannel(subscription);
    subscription = null;
  }
}
