// hooks/use-booking-notification.ts

import { playNotificationSound, stopNotificationSound } from '@/services/notification-sound-manager';
import { useCallback } from 'react';

export function useBookingNotification() {
  const playSound = useCallback(async (bookingId: string) => {
    console.log('▶️ [UI] Requesting sound playback for:', bookingId);
    await playNotificationSound(bookingId);
  }, []);

  const markBookingHandled = useCallback(async (bookingId: string) => {
    console.log('⏹️ [UI] Marking booking as handled:', bookingId);
    await stopNotificationSound(bookingId);
  }, []);

  return {
    playSound,
    markBookingHandled,
  };
}