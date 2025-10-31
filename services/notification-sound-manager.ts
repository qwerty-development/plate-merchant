// services/notification-sound-manager.ts

import { Audio } from 'expo-av';

const SOUND_FILE = require('@/assets/notification/new_booking.wav');
let sound: Audio.Sound | null = null;
const activeBookingSounds = new Set<string>();

/**
 * Initializes the audio system for background and silent playback.
 */
export async function setupAudio() {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
  });
}

/**
 * Starts playing the notification sound for a given booking ID.
 * If the sound is already playing, it simply adds the ID to the active set.
 */
export async function playNotificationSound(bookingId: string) {
  try {
    if (!activeBookingSounds.has(bookingId)) {
        console.log(`[SoundManager] Adding booking ${bookingId} to active sounds.`);
        activeBookingSounds.add(bookingId);
    }

    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        console.log('[SoundManager] Sound is already playing.');
        return;
      }
    }

    console.log('[SoundManager] Loading and playing sound...');
    await setupAudio(); // Ensure audio mode is set
    const { sound: newSound } = await Audio.Sound.createAsync(SOUND_FILE, {
      shouldPlay: true,
      isLooping: true,
    });
    sound = newSound;
  } catch (error) {
    console.error('[SoundManager] Error playing sound:', error);
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