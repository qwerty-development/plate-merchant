import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBookingNotification() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingBookingIds, setPendingBookingIds] = useState<Set<string>>(new Set());

  const stopSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setIsPlaying(false);
        console.log('Notification sound stopped');
      }
    } catch (error) {
      console.error('Error stopping notification sound:', error);
    }
  }, []);

  // Initialize audio settings
  useEffect(() => {
    const setupAudio = async () => {
      try {
        console.log('🎵 Setting up audio mode...');
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        console.log('✅ Audio mode configured');
      } catch (error) {
        console.error('❌ Error setting audio mode:', error);
      }
    };

    setupAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const playSound = useCallback(async (bookingId: string) => {
    try {
      console.log('🔔 Attempting to play notification sound for booking:', bookingId);
      
      // Add booking to pending set
      setPendingBookingIds(prev => new Set(prev).add(bookingId));

      // If already playing, don't start again
      if (soundRef.current) {
        console.log('⚠️ Sound already playing, skipping');
        return;
      }

      console.log('📢 Loading sound file...');

      // Load and play the sound
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/notification/new_booking.wav'),
        { 
          shouldPlay: true,
          isLooping: true,
          volume: 1.0,
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      console.log('✅ Notification sound started successfully!');
      
      // Set up callback for when sound finishes (in case loop fails)
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying && !status.isLooping) {
          console.log('⚠️ Sound stopped unexpectedly');
        }
      });
    } catch (error) {
      console.error('❌ Error playing notification sound:', error);
    }
  }, []);

  const markBookingHandled = useCallback(async (bookingId: string) => {
    setPendingBookingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookingId);

      // Stop sound if no more pending bookings
      if (newSet.size === 0 && soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setIsPlaying(false);
      }

      return newSet;
    });
  }, []);

  const stopAllSounds = useCallback(async () => {
    setPendingBookingIds(new Set());
    await stopSound();
  }, [stopSound]);

  return {
    playSound,
    stopSound: stopAllSounds,
    markBookingHandled,
    isPlaying,
    pendingBookingIds,
  };
}

