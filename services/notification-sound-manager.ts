// services/notification-sound-manager.ts

import { Audio } from 'expo-av';

// Load sound file asset
const SOUND_FILE_MODULE = require('@/assets/notification/new_booking.wav');
let sound: Audio.Sound | null = null;
const activeBookingSounds = new Set<string>();

/**
 * Initializes the audio system for background and silent playback.
 * This ensures audio continues playing even when:
 * - App is in background
 * - Screen is off
 * - Device is locked
 */
export async function setupAudio() {
  try {
    console.log('[SoundManager] Setting up audio mode for background playback');
    await Audio.setAudioModeAsync({
      // iOS settings
      playsInSilentModeIOS: true,

      // Android settings - Critical for background playback
      staysActiveInBackground: true, // Keep audio alive in background
      shouldDuckAndroid: false, // Don't lower volume for other apps
      interruptionModeAndroid: 2, // INTERRUPTION_MODE_ANDROID_DUCK_OTHERS
      allowsRecordingIOS: false,

      // Additional settings for reliability
      playThroughEarpieceAndroid: false, // Use speaker, not earpiece
    });
    console.log('[SoundManager] Audio mode configured successfully');
  } catch (error) {
    console.error('[SoundManager] Failed to setup audio mode:', error);
    throw error;
  }
}

/**
 * Starts playing the notification sound for a given booking ID.
 * If the sound is already playing, it simply adds the ID to the active set.
 */
export async function playNotificationSound(bookingId: string) {
  try {
    console.log(`🔊 [SoundManager] Request to play sound for booking: ${bookingId}`);

    if (!activeBookingSounds.has(bookingId)) {
        console.log(`[SoundManager] Adding booking ${bookingId} to active sounds. Total active: ${activeBookingSounds.size + 1}`);
        activeBookingSounds.add(bookingId);
    } else {
        console.log(`[SoundManager] Booking ${bookingId} already in active sounds.`);
    }

    // Check if sound is already playing
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        console.log('[SoundManager] ✅ Sound is already playing continuously. No action needed.');
        return;
      } else {
        console.log('[SoundManager] Sound exists but not playing. Status:', {
          isLoaded: status.isLoaded,
          isPlaying: (status as any).isPlaying
        });
      }
    }

    console.log('[SoundManager] 🎵 Loading and playing notification sound...');
    console.log('[SoundManager] Sound file module type:', typeof SOUND_FILE_MODULE);
    console.log('[SoundManager] Sound file module value:', SOUND_FILE_MODULE);

    // Re-ensure audio mode (in case it was reset)
    await setupAudio();

    // Determine the correct sound source format
    let soundSource: any;
    
    if (typeof SOUND_FILE_MODULE === 'number') {
      // It's an asset ID (most common case)
      soundSource = SOUND_FILE_MODULE;
      console.log('[SoundManager] Using asset ID directly:', soundSource);
    } else if (typeof SOUND_FILE_MODULE === 'object') {
      // It might be an object with uri or other properties
      if (SOUND_FILE_MODULE.uri) {
        soundSource = { uri: SOUND_FILE_MODULE.uri };
        console.log('[SoundManager] Using URI from object:', soundSource);
      } else {
        // Try using the module directly
        soundSource = SOUND_FILE_MODULE;
        console.log('[SoundManager] Using module object directly:', soundSource);
      }
    } else {
      throw new Error(`Unexpected sound file module type: ${typeof SOUND_FILE_MODULE}`);
    }

    console.log('[SoundManager] Final sound source:', soundSource);

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: true,
          isLooping: true, // Loop continuously until explicitly stopped
          volume: 1.0, // Maximum volume
        },
        (status) => {
          // Status callback for debugging
          if (!status.isLoaded) {
            console.error('[SoundManager] Sound failed to load in callback:', status);
            if ((status as any).error) {
              console.error('[SoundManager] Load error details:', (status as any).error);
            }
          } else {
            console.log('[SoundManager] ✅ Sound loaded successfully! Status:', {
              isPlaying: (status as any).isPlaying,
              isLooping: (status as any).isLooping,
              positionMillis: (status as any).positionMillis,
              durationMillis: (status as any).durationMillis
            });
          }
        }
      );

      // Verify it loaded
      const status = await newSound.getStatusAsync();
      if (!status.isLoaded) {
        throw new Error(`Sound failed to load. Status: ${JSON.stringify(status)}`);
      }

      sound = newSound;
      console.log('[SoundManager] ✅ Sound started playing in continuous loop!');
    } catch (createError) {
      console.error('[SoundManager] ❌ Error creating sound:', createError);
      throw createError;
    }

    sound = newSound;
    console.log('[SoundManager] ✅ Sound started playing in continuous loop!');
  } catch (error) {
    console.error('[SoundManager] ❌ CRITICAL ERROR playing sound:', error);
    console.error('[SoundManager] Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}

/**
 * Marks a booking as handled and stops the sound if no other bookings are pending.
 */
export async function stopNotificationSound(bookingId: string) {
  if (activeBookingSounds.has(bookingId)) {
    console.log(`[SoundManager] Removing booking ${bookingId} from active sounds.`);
    activeBookingSounds.delete(bookingId);
  } else {
    console.log(`[SoundManager] Booking ${bookingId} was not in the active sound set.`);
  }

  if (activeBookingSounds.size === 0 && sound) {
    console.log('[SoundManager] All bookings handled. Stopping sound.');
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
      sound = null;
    } catch (error) {
      console.error('[SoundManager] Error stopping sound:', error);
    }
  } else {
     console.log(`[SoundManager] Not stopping sound, ${activeBookingSounds.size} bookings still active.`);
  }
}