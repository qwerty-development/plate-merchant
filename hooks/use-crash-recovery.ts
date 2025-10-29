import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const CRASH_STATE_KEY = '@crash_recovery_state';
const APP_STATE_KEY = '@app_state';

interface AppState {
  lastActiveTime: number;
  pendingBookingsCount: number;
  lastBookingId: string | null;
  sessionStartTime: number;
  crashCount: number;
  lastCrashTime: number | null;
}

/**
 * Crash Recovery System - Saves app state and recovers after crashes
 * Detects unexpected restarts and restores previous state
 */
export function useCrashRecovery() {
  const [hasCrashed, setHasCrashed] = useState(false);
  const [recoveredState, setRecoveredState] = useState<AppState | null>(null);
  const [sessionStart] = useState(Date.now());

  useEffect(() => {
    checkForCrash();
  }, []);

  const checkForCrash = useCallback(async () => {
    try {
      const storedState = await AsyncStorage.getItem(APP_STATE_KEY);
      
      if (storedState) {
        const state: AppState = JSON.parse(storedState);
        const timeSinceLastActive = Date.now() - state.lastActiveTime;
        
        // If less than 5 minutes since last active, and we're starting fresh, likely a crash
        if (timeSinceLastActive < 300000) {
          console.warn('🔥 Potential crash detected - recovering state');
          setHasCrashed(true);
          setRecoveredState(state);
          
          // Increment crash count
          const newState: AppState = {
            ...state,
            crashCount: state.crashCount + 1,
            lastCrashTime: state.lastActiveTime,
            sessionStartTime: sessionStart,
          };
          
          await saveAppState(newState);
          
          // Log crash for monitoring
          console.error('📊 Crash Stats:', {
            crashCount: newState.crashCount,
            lastCrashTime: new Date(state.lastActiveTime).toISOString(),
            timeSinceCrash: timeSinceLastActive,
            pendingBookings: state.pendingBookingsCount,
          });
        } else {
          console.log('✅ Normal app restart detected');
          // Reset crash count on normal restart
          await saveAppState({
            ...state,
            sessionStartTime: sessionStart,
            crashCount: 0,
          });
        }
      } else {
        // First launch
        console.log('🆕 First app launch');
        await initializeAppState();
      }
    } catch (error) {
      console.error('Error checking crash state:', error);
    }
  }, [sessionStart]);

  const initializeAppState = useCallback(async () => {
    const initialState: AppState = {
      lastActiveTime: Date.now(),
      pendingBookingsCount: 0,
      lastBookingId: null,
      sessionStartTime: sessionStart,
      crashCount: 0,
      lastCrashTime: null,
    };
    
    await saveAppState(initialState);
  }, [sessionStart]);

  const saveAppState = useCallback(async (state: AppState) => {
    try {
      await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving app state:', error);
    }
  }, []);

  const updateAppState = useCallback(async (updates: Partial<AppState>) => {
    try {
      const storedState = await AsyncStorage.getItem(APP_STATE_KEY);
      const currentState: AppState = storedState 
        ? JSON.parse(storedState)
        : {
            lastActiveTime: Date.now(),
            pendingBookingsCount: 0,
            lastBookingId: null,
            sessionStartTime: sessionStart,
            crashCount: 0,
            lastCrashTime: null,
          };
      
      const newState: AppState = {
        ...currentState,
        ...updates,
        lastActiveTime: Date.now(),
      };
      
      await saveAppState(newState);
    } catch (error) {
      console.error('Error updating app state:', error);
    }
  }, [sessionStart, saveAppState]);

  const heartbeat = useCallback(async () => {
    // Update last active time to indicate app is alive
    await updateAppState({});
  }, [updateAppState]);

  const clearCrashState = useCallback(async () => {
    setHasCrashed(false);
    setRecoveredState(null);
    await updateAppState({ crashCount: 0, lastCrashTime: null });
  }, [updateAppState]);

  return {
    hasCrashed,
    recoveredState,
    updateAppState,
    heartbeat,
    clearCrashState,
  };
}
