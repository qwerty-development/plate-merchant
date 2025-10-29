import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Vibration } from 'react-native';

interface VisualAlertConfig {
  bookingId: string;
  guestName: string;
  partySize: number;
}

/**
 * Visual Alert System - Provides visual feedback when notification sound might fail
 * Flashing screen, vibration patterns, and animated indicators
 */
export function useVisualAlert() {
  const [activeAlerts, setActiveAlerts] = useState<Map<string, VisualAlertConfig>>(new Map());
  const [isFlashing, setIsFlashing] = useState(false);
  const flashAnimation = useRef(new Animated.Value(1)).current;
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAlerts();
    };
  }, []);

  // Flash animation loop
  useEffect(() => {
    if (isFlashing) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnimation, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      flashAnimation.setValue(1);
    }
  }, [isFlashing]);

  // Vibration loop
  useEffect(() => {
    if (activeAlerts.size > 0 && !vibrationIntervalRef.current) {
      // Start continuous vibration pattern
      const vibrationPattern = [0, 400, 800, 400, 800, 400, 2000]; // Vibrate, pause, repeat
      
      const startVibration = () => {
        Vibration.vibrate(vibrationPattern, true); // true = repeat
      };

      startVibration();
      
      // Store the vibration "interval" (we're using Vibration.vibrate with repeat)
      vibrationIntervalRef.current = setInterval(() => {
        // This keeps the interval alive, actual vibration is handled by Vibration.vibrate repeat
      }, 1000);

      return () => {
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = undefined;
        }
        Vibration.cancel();
      };
    } else if (activeAlerts.size === 0 && vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = undefined;
      Vibration.cancel();
    }
  }, [activeAlerts.size]);

  const startAlert = useCallback((config: VisualAlertConfig) => {
    console.log('🚨 Starting visual alert for booking:', config.bookingId);
    
    setActiveAlerts(prev => {
      const updated = new Map(prev);
      updated.set(config.bookingId, config);
      return updated;
    });

    setIsFlashing(true);

    // Start intense vibration pattern immediately
    Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500]);
  }, []);

  const stopAlert = useCallback((bookingId: string) => {
    console.log('✅ Stopping visual alert for booking:', bookingId);
    
    setActiveAlerts(prev => {
      const updated = new Map(prev);
      updated.delete(bookingId);
      
      // If no more active alerts, stop flashing
      if (updated.size === 0) {
        setIsFlashing(false);
      }
      
      return updated;
    });
  }, []);

  const stopAllAlerts = useCallback(() => {
    console.log('🛑 Stopping all visual alerts');
    
    setActiveAlerts(new Map());
    setIsFlashing(false);
    
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = undefined;
    }
    
    Vibration.cancel();
  }, []);

  const pulseVibration = useCallback(() => {
    // Single strong pulse for immediate feedback
    Vibration.vibrate([0, 1000]);
  }, []);

  return {
    activeAlerts: Array.from(activeAlerts.values()),
    isFlashing,
    flashAnimation,
    startAlert,
    stopAlert,
    stopAllAlerts,
    pulseVibration,
  };
}
