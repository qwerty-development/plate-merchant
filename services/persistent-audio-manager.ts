/**
 * Persistent Audio Manager with Android Foreground Service
 * This provides TRUE background audio that works even when:
 * - App is closed
 * - Screen is off
 * - Device is locked
 *
 * Architecture:
 * 1. Notifee Foreground Service - Keeps app alive and shows notification
 * 2. react-native-sound - Plays audio continuously (protected by the service)
 * 3. Config plugin - Ensures sound file is copied to Android resources during EAS build
 * 4. Wake lock via foreground service - Prevents CPU sleep during audio playback
 *
 * IMPORTANT: The config plugin (withNotifee.js) EXPLICITLY copies the sound file
 * from assets/notification/new_booking.wav to android/app/src/main/res/raw/
 * during the EAS build process. This guarantees react-native-sound can find it.
 */

import Sound from 'react-native-sound';
import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

const activeBookingSounds = new Set<string>();
let alertSound: Sound | null = null;
let isPlaying = false;
let foregroundServiceStarted = false;

const CHANNEL_ID = 'booking-alert-channel';
const NOTIFICATION_ID = 'booking-alert-notification';

/**
 * Create notification channel for foreground service
 * Required for Android 8+
 */
async function createNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Booking Alerts',
      description: 'Continuous alerts for new restaurant bookings',
      importance: AndroidImportance.HIGH,
      sound: 'default', // This is for the notification sound, not our custom alert
      vibration: false, // Disable vibration for the notification itself
    });
    console.log('✅ [PersistentAudio] Notification channel created');
  } catch (error) {
    console.error('❌ [PersistentAudio] Failed to create channel:', error);
  }
}

/**
 * Start Android Foreground Service with persistent notification
 * This keeps the app alive in background and allows audio to continue
 */
async function startForegroundService() {
  if (Platform.OS !== 'android' || foregroundServiceStarted) return;

  try {
    console.log('🚀 [PersistentAudio] Starting foreground service...');

    await createNotificationChannel();

    // Display foreground notification
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: '🔔 New Booking Alert',
      body: 'Alert sound is playing. Accept or decline the booking to stop.',
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        ongoing: true, // Cannot be dismissed by user
        autoCancel: false,
        asForegroundService: true, // THIS IS THE KEY - makes it a foreground service!
        colorized: true,
        color: '#FF6B6B',
        smallIcon: 'ic_launcher', // Default Android icon
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });

    foregroundServiceStarted = true;
    console.log('✅ [PersistentAudio] Foreground service started');
  } catch (error) {
    console.error('❌ [PersistentAudio] Failed to start foreground service:', error);
  }
}

/**
 * Stop Android Foreground Service and remove notification
 */
async function stopForegroundService() {
  if (Platform.OS !== 'android' || !foregroundServiceStarted) return;

  try {
    console.log('🛑 [PersistentAudio] Stopping foreground service...');

    await notifee.cancelNotification(NOTIFICATION_ID);
    foregroundServiceStarted = false;

    console.log('✅ [PersistentAudio] Foreground service stopped');
  } catch (error) {
    console.error('❌ [PersistentAudio] Failed to stop foreground service:', error);
  }
}

/**
 * Initialize the sound system for background audio
 * MUST be called at app startup
 *
 * NOTE: The config plugin ensures new_booking.wav is at:
 * android/app/src/main/res/raw/new_booking.wav
 */
export async function setupPersistentAudio() {
  if (Platform.OS !== 'android') return;

  return new Promise<void>((resolve, reject) => {
    try {
      console.log('🎵 [PersistentAudio] Setting up native sound...');
      console.log('    Expected location: android/app/src/main/res/raw/new_booking.wav');

      // Enable playback in silence mode (iOS) and background (Android)
      Sound.setCategory('Playback', true);

      // Load the alert sound from raw resources
      // The config plugin copies it there during build
      alertSound = new Sound('new_booking.wav', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.error('❌ [PersistentAudio] Failed to load sound:', error);
          console.error('    Make sure the config plugin copied the file during build');
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
 *
 * KEY: Starts foreground service FIRST to protect the audio playback
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

    // CRITICAL: Start foreground service BEFORE audio playback
    // This prevents Android from killing the process
    await startForegroundService();

    // If already playing, no need to restart audio
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

    // Start playback (now protected by foreground service!)
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
    console.log('[PersistentAudio] ✅ Started continuous looping audio with foreground service!');
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
 *
 * KEY: Stops foreground service when no more bookings to free resources
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
      console.log('[PersistentAudio] No more active bookings, stopping audio and service');

      // Stop audio
      alertSound.pause();
      alertSound.setCurrentTime(0); // Reset to beginning
      isPlaying = false;

      // CRITICAL: Stop foreground service to free resources
      await stopForegroundService();

      console.log('✅ [PersistentAudio] Audio and foreground service stopped');
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
 * Clean up sound resources and stop foreground service
 * Call on app exit if needed
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

    // Stop foreground service
    await stopForegroundService();

    console.log('✅ [PersistentAudio] Cleanup complete');
  } catch (error) {
    console.error('[PersistentAudio] Error during cleanup:', error);
  }
}
