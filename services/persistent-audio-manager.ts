/**
 * Persistent Audio Manager using react-native-sound
 * This provides TRUE background audio that works even when:
 * - App is closed
 * - Screen is off
 * - Device is locked
 *
 * Uses native Android MediaPlayer instead of JavaScript-based audio
 */

import Sound from 'react-native-sound';
import { Platform } from 'react-native';

const activeBookingSounds = new Set<string>();
let alertSound: Sound | null = null;
let isPlaying = false;

/**
 * Initialize the sound system for background audio
 * MUST be called at app startup
 */
export async function setupPersistentAudio() {
  if (Platform.OS !== 'android') return;

  return new Promise<void>((resolve, reject) => {
    try {
      console.log('🎵 [PersistentAudio] Setting up native sound...');

      // Enable playback in silence mode (iOS) and background (Android)
      Sound.setCategory('Playback', true);

      // Load the alert sound
      alertSound = new Sound('new_booking.wav', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.error('❌ [PersistentAudio] Failed to load sound:', error);
          reject(error);
          return;
        }

        console.log('✅ [PersistentAudio] Sound loaded successfully');
        console.log('[PersistentAudio] Duration:', alertSound?.getDuration(), 'seconds');

        // Set to loop infinitely
        alertSound?.setNumberOfLoops(-1); // -1 = infinite loop

        // Set volume to maximum
        alertSound?.setVolume(1.0);

        resolve();
      });
    } catch (error) {
      console.error('❌ [PersistentAudio] Setup error:', error);
      reject(error);
    }
  });
}

/**
 * Start playing the persistent alert sound for a booking
 * Sound will loop continuously until explicitly stopped
 */
export async function startPersistentAlert(bookingId: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    console.log(`🔊 [PersistentAudio] Starting alert for booking: ${bookingId}`);

    // Add to active bookings
    if (!activeBookingSounds.has(bookingId)) {
      console.log(`[PersistentAudio] Adding booking ${bookingId} to active sounds. Total: ${activeBookingSounds.size + 1}`);
      activeBookingSounds.add(bookingId);
    } else {
      console.log(`[PersistentAudio] Booking ${bookingId} already in active sounds.`);
    }

    // If already playing, no need to restart
    if (isPlaying && alertSound) {
      alertSound.getCurrentTime((seconds) => {
        console.log('[PersistentAudio] ✅ Audio already playing continuously at', seconds, 'seconds');
      });
      return;
    }

    // Ensure sound is loaded
    if (!alertSound) {
      console.log('[PersistentAudio] Sound not loaded, initializing...');
      await setupPersistentAudio();
    }

    if (!alertSound) {
      throw new Error('Sound failed to initialize');
    }

    console.log('[PersistentAudio] 🎵 Starting continuous looping audio...');

    // Start playback
    alertSound.play((success) => {
      if (success) {
        console.log('[PersistentAudio] ✅ Audio playback completed successfully (will loop)');
      } else {
        console.error('[PersistentAudio] ❌ Audio playback failed');
        isPlaying = false;

        // Try to restart
        alertSound?.reset();
        alertSound?.play(() => {
          console.log('[PersistentAudio] 🔄 Audio restarted after failure');
        });
      }
    });

    isPlaying = true;
    console.log('[PersistentAudio] ✅ Started continuous looping audio!');
  } catch (error) {
    console.error('[PersistentAudio] ❌ Error starting alert:', error);
    console.error('[PersistentAudio] Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}

/**
 * Stop the persistent alert for a specific booking
 * Only stops playback if no other bookings are pending
 */
export async function stopPersistentAlert(bookingId: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    console.log(`🛑 [PersistentAudio] Stopping alert for booking: ${bookingId}`);

    // Remove from active bookings
    if (activeBookingSounds.has(bookingId)) {
      activeBookingSounds.delete(bookingId);
      console.log(`[PersistentAudio] Removed booking ${bookingId}. Remaining: ${activeBookingSounds.size}`);
    }

    // Only stop if no more active bookings
    if (activeBookingSounds.size === 0 && alertSound) {
      console.log('[PersistentAudio] No more active bookings, stopping audio');

      alertSound.pause();
      alertSound.setCurrentTime(0); // Reset to beginning
      isPlaying = false;

      console.log('✅ [PersistentAudio] Audio stopped');
    } else {
      console.log(`[PersistentAudio] Audio continues playing (${activeBookingSounds.size} bookings still active)`);
    }
  } catch (error) {
    console.error('[PersistentAudio] ❌ Error stopping alert:', error);
  }
}

/**
 * Get current playback status (for debugging)
 */
export async function getAudioStatus(): Promise<{
  isPlaying: boolean;
  activeBookings: number;
  bookingIds: string[];
  currentTime?: number;
  duration?: number;
} | null> {
  if (Platform.OS !== 'android' || !alertSound) return null;

  return new Promise((resolve) => {
    alertSound?.getCurrentTime((seconds) => {
      resolve({
        isPlaying,
        activeBookings: activeBookingSounds.size,
        bookingIds: Array.from(activeBookingSounds),
        currentTime: seconds,
        duration: alertSound?.getDuration()
      });
    });
  });
}

/**
 * Clean up sound resources (call on app exit if needed)
 */
export async function cleanupPersistentAudio(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    console.log('[PersistentAudio] Cleaning up...');

    if (alertSound) {
      alertSound.stop();
      alertSound.release();
      alertSound = null;
    }

    activeBookingSounds.clear();
    isPlaying = false;

    console.log('✅ [PersistentAudio] Cleanup complete');
  } catch (error) {
    console.error('[PersistentAudio] Error during cleanup:', error);
  }
}
