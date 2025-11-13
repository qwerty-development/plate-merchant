/**
 * Persistent Audio Manager using react-native-track-player
 * This provides TRUE background audio that works even when:
 * - App is closed
 * - Screen is off
 * - Device is locked
 *
 * Uses native Android MediaPlayer instead of JavaScript-based audio
 */

import TrackPlayer, {
  Capability,
  RepeatMode,
  State,
  AppKilledPlaybackBehavior
} from 'react-native-track-player';
import { Platform } from 'react-native';

const activeBookingSounds = new Set<string>();
let isPlayerSetup = false;
let isPlaying = false;

const BOOKING_ALERT_TRACK = {
  id: 'booking-alert-sound',
  url: require('@/assets/notification/new_booking.wav'),
  title: 'New Booking Alert',
  artist: 'Plate Merchant',
  duration: 5, // Approximate duration in seconds
};

/**
 * Initialize the track player for background audio
 * MUST be called at app startup
 */
export async function setupPersistentAudio() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🎵 [PersistentAudio] Setting up track player...');

    // Check if already setup
    const currentTrack = await TrackPlayer.getActiveTrack();
    if (currentTrack) {
      console.log('✅ [PersistentAudio] Track player already initialized');
      isPlayerSetup = true;
      return;
    }

    // Setup track player
    await TrackPlayer.setupPlayer({
      waitForBuffer: false, // Start immediately
      autoHandleInterruptions: false, // Don't pause for phone calls - critical alert
    });

    // Configure capabilities for foreground service
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
      progressUpdateEventInterval: 2,
    });

    // Add the alert sound track
    await TrackPlayer.add(BOOKING_ALERT_TRACK);

    // Set repeat mode to loop indefinitely
    await TrackPlayer.setRepeatMode(RepeatMode.Track);

    // Set volume to maximum
    await TrackPlayer.setVolume(1.0);

    isPlayerSetup = true;
    console.log('✅ [PersistentAudio] Track player initialized and ready');
  } catch (error) {
    console.error('❌ [PersistentAudio] Failed to setup:', error);
    throw error;
  }
}

/**
 * Start playing the persistent alert sound for a booking
 * Sound will loop continuously until explicitly stopped
 */
export async function startPersistentAlert(bookingId: string) {
  if (Platform.OS !== 'android') return;

  try {
    console.log(`🔊 [PersistentAudio] Starting alert for booking: ${bookingId}`);

    // Add to active bookings
    if (!activeBookingSounds.has(bookingId)) {
      console.log(`[PersistentAudio] Adding booking ${bookingId} to active sounds. Total: ${activeBookingSounds.size + 1}`);
      activeBookingSounds.add(bookingId);
    }

    // If already playing, no need to restart
    if (isPlaying) {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        console.log('[PersistentAudio] ✅ Audio already playing continuously');
        return;
      }
    }

    // Ensure player is setup
    if (!isPlayerSetup) {
      console.log('[PersistentAudio] Player not setup, initializing...');
      await setupPersistentAudio();
    }

    // Start playback
    await TrackPlayer.play();
    isPlaying = true;

    console.log('[PersistentAudio] ✅ Started continuous looping audio!');

    // Log playback state for debugging
    const state = await TrackPlayer.getPlaybackState();
    const queue = await TrackPlayer.getQueue();
    console.log('[PersistentAudio] Playback state:', {
      state: state.state,
      queueLength: queue.length,
      repeatMode: await TrackPlayer.getRepeatMode()
    });
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
export async function stopPersistentAlert(bookingId: string) {
  if (Platform.OS !== 'android') return;

  try {
    console.log(`🛑 [PersistentAudio] Stopping alert for booking: ${bookingId}`);

    // Remove from active bookings
    if (activeBookingSounds.has(bookingId)) {
      activeBookingSounds.delete(bookingId);
      console.log(`[PersistentAudio] Removed booking ${bookingId}. Remaining: ${activeBookingSounds.size}`);
    }

    // Only stop if no more active bookings
    if (activeBookingSounds.size === 0) {
      console.log('[PersistentAudio] No more active bookings, stopping audio');

      await TrackPlayer.pause();
      await TrackPlayer.seekTo(0); // Reset to beginning for next time
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
export async function getAudioStatus() {
  if (Platform.OS !== 'android') return null;

  try {
    const state = await TrackPlayer.getPlaybackState();
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();

    return {
      isPlaying: state.state === State.Playing,
      state: state.state,
      position,
      duration,
      activeBookings: activeBookingSounds.size,
      bookingIds: Array.from(activeBookingSounds)
    };
  } catch (error) {
    console.error('[PersistentAudio] Error getting status:', error);
    return null;
  }
}

/**
 * Clean up track player (call on app exit if needed)
 */
export async function cleanupPersistentAudio() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('[PersistentAudio] Cleaning up...');
    await TrackPlayer.reset();
    activeBookingSounds.clear();
    isPlayerSetup = false;
    isPlaying = false;
    console.log('✅ [PersistentAudio] Cleanup complete');
  } catch (error) {
    console.error('[PersistentAudio] Error during cleanup:', error);
  }
}
