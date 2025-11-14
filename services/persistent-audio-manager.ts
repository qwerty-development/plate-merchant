/**
 * Persistent Audio Manager with Android Foreground Service
 * This provides TRUE background audio that works even when:
 * - App is closed
 * - Screen is off
 * - Device is locked
 *
 * Architecture:
 * 1. Notifee Foreground Service - Keeps app alive and shows notification
 * 2. Expo AV - Plays audio continuously (protected by the service)
 * 3. Wake lock via foreground service - Prevents CPU sleep during audio playback
 *
 * IMPORTANT: We use expo-av instead of react-native-sound because:
 * - expo-av properly handles Expo asset bundling with require()
 * - react-native-sound expects native resources which don't work reliably with Expo managed workflow
 * - The foreground service is what keeps audio alive, not the audio library choice
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

const activeBookingSounds = new Set<string>();
let alertSound: Audio.Sound | null = null;
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
 */
export async function setupPersistentAudio() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🎵 [PersistentAudio] Setting up expo-av audio...');

    // Set audio mode for background playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true, // CRITICAL for background audio
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // Load the alert sound using Expo's asset system
    // This properly handles the asset bundling
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/notification/new_booking.wav'),
      {
        shouldPlay: false,
        isLooping: true, // CRITICAL: Set to loop infinitely
        volume: 1.0,
      }
    );

    alertSound = sound;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      console.log('✅ [PersistentAudio] Sound loaded successfully');
      console.log('[PersistentAudio] Duration:', (status.durationMillis ?? 0) / 1000, 'seconds');
    }
  } catch (error) {
    console.error('❌ [PersistentAudio] Setup error:', error);
    console.error('[PersistentAudio] Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
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
      const status = await alertSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        console.log('[PersistentAudio] ✅ Audio already playing continuously at', status.positionMillis / 1000, 'seconds');
        return;
      }
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
    await alertSound.playAsync();

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
      await alertSound.stopAsync();
      await alertSound.setPositionAsync(0); // Reset to beginning
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

  try {
    const status = await alertSound.getStatusAsync();

    if (status.isLoaded) {
      return {
        isPlaying,
        activeBookings: activeBookingSounds.size,
        bookingIds: Array.from(activeBookingSounds),
        currentTime: status.positionMillis / 1000,
        duration: (status.durationMillis ?? 0) / 1000
      };
    }
  } catch (error) {
    console.error('[PersistentAudio] Error getting status:', error);
  }

  return null;
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
      await alertSound.unloadAsync();
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
