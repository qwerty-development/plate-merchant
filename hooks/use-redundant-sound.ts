import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Vibration } from 'react-native';

/**
 * Redundant Sound System - Multiple ways to play alert sound
 * If one method fails, tries others automatically
 */
export function useRedundantSound() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundMethod, setSoundMethod] = useState<'expo-av' | 'notification' | 'none'>('none');
  const playbackCheckIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Setup audio on mount
  useEffect(() => {
    setupAudio();
    return () => cleanup();
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      console.log('✅ Audio mode configured for redundant sound');
    } catch (error) {
      console.error('❌ Error setting audio mode:', error);
    }
  };

  const cleanup = () => {
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (playbackCheckIntervalRef.current) {
      clearInterval(playbackCheckIntervalRef.current);
    }
  };

  const playSound = useCallback(async (bookingId: string): Promise<boolean> => {
    console.log('🔊 Attempting to play sound for booking:', bookingId);

    // Method 1: Try expo-av (primary method)
    const method1Success = await tryExpoAVSound();
    if (method1Success) {
      setSoundMethod('expo-av');
      setIsPlaying(true);
      startPlaybackMonitoring();
      return true;
    }

    // Method 2: Try notification sound (fallback)
    console.warn('⚠️ expo-av failed, trying notification sound...');
    const method2Success = await tryNotificationSound(bookingId);
    if (method2Success) {
      setSoundMethod('notification');
      setIsPlaying(true);
      return true;
    }

    // Method 3: Emergency - just vibrate heavily
    console.error('❌ All sound methods failed, using vibration only');
    emergencyVibration();
    setSoundMethod('none');
    
    // Alert user about sound issue
    if (Platform.OS === 'android') {
      Alert.alert(
        '⚠️ Sound Issue',
        'Unable to play alert sound. Please check your volume settings.',
        [{ text: 'OK' }]
      );
    }

    return false;
  }, []);

  const tryExpoAVSound = async (): Promise<boolean> => {
    try {
      console.log('🎵 Trying expo-av sound...');
      
      // Stop existing sound if any
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Load and play new sound
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/notification/new_booking.wav'),
        {
          shouldPlay: true,
          isLooping: true,
          volume: 1.0,
        }
      );

      soundRef.current = sound;
      
      // Verify sound is actually playing
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        console.log('✅ expo-av sound playing successfully');
        return true;
      } else {
        console.warn('⚠️ expo-av sound loaded but not playing');
        return false;
      }
    } catch (error) {
      console.error('❌ expo-av sound failed:', error);
      return false;
    }
  };

  const tryNotificationSound = async (bookingId: string): Promise<boolean> => {
    try {
      console.log('🔔 Trying notification sound method...');
      
      // Send multiple silent notifications with sound
      for (let i = 0; i < 5; i++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 New Booking Alert',
            body: 'Please check the bookings screen',
            data: { bookingId, method: 'redundant_sound', iteration: i },
            sound: 'new_booking.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 200, 500],
          },
          trigger: {
            seconds: i * 5, // Every 5 seconds
          } as Notifications.TimeIntervalTriggerInput,
        });
      }
      
      console.log('✅ Notification sound method activated (5 notifications scheduled)');
      return true;
    } catch (error) {
      console.error('❌ Notification sound method failed:', error);
      return false;
    }
  };

  const emergencyVibration = () => {
    console.log('🚨 Emergency vibration activated');
    
    // Very strong, continuous vibration pattern
    const pattern = [0, 1000, 500, 1000, 500, 1000, 500, 1000];
    Vibration.vibrate(pattern);
    
    // Repeat vibration every 10 seconds
    const vibrationInterval = setInterval(() => {
      Vibration.vibrate(pattern);
    }, 10000);
    
    // Store interval for cleanup
    setTimeout(() => {
      clearInterval(vibrationInterval);
    }, 60000); // Stop after 1 minute
  };

  const startPlaybackMonitoring = () => {
    // Monitor if sound is actually playing
    playbackCheckIntervalRef.current = setInterval(async () => {
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            console.warn('⚠️ Sound stopped unexpectedly, restarting...');
            await soundRef.current.replayAsync();
          }
        } catch (error) {
          console.error('Error checking playback status:', error);
        }
      }
    }, 5000); // Check every 5 seconds
  };

  const stopSound = useCallback(async () => {
    console.log('🛑 Stopping all sound methods');
    
    try {
      // Stop expo-av sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Stop monitoring
      if (playbackCheckIntervalRef.current) {
        clearInterval(playbackCheckIntervalRef.current);
        playbackCheckIntervalRef.current = undefined;
      }

      // Stop vibrations
      Vibration.cancel();

      setIsPlaying(false);
      setSoundMethod('none');
      
      console.log('✅ All sound methods stopped');
    } catch (error) {
      console.error('Error stopping sound:', error);
    }
  }, []);

  const testSound = useCallback(async (): Promise<boolean> => {
    console.log('🧪 Testing sound system...');
    const success = await playSound('test-sound');
    
    // Stop after 3 seconds
    setTimeout(async () => {
      await stopSound();
    }, 3000);
    
    return success;
  }, [playSound, stopSound]);

  return {
    playSound,
    stopSound,
    testSound,
    isPlaying,
    soundMethod,
  };
}
