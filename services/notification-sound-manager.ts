// services/notification-sound-manager.ts

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

const SOUND_FILE = require('@/assets/notification/new_booking.wav');
let sound: Audio.Sound | null = null;
const activeBookingSounds = new Set<string>();
let isAudioInitialized = false;

/**
 * Initializes the audio system for background and silent playback.
 * This ensures audio continues playing even when:
 * - App is in background
 * - Screen is off
 * - Device is locked
 * - Phone is in silent mode (Android)
 *
 * CRITICAL: Uses proper audio configuration to bypass silent mode and DND
 */
export async function setupAudio() {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [SoundManager] Skipping audio setup (not Android)');
    return;
  }

  try {
    console.log('🔊 [SoundManager] Setting up audio mode for CRITICAL ALERTS...');

    // Configure audio mode for alarm-style playback
    await Audio.setAudioModeAsync({
      // ==================== iOS SETTINGS ====================
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,

      // ==================== ANDROID SETTINGS ====================
      // CRITICAL: These settings ensure sound plays even in silent mode
      staysActiveInBackground: true, // Keep audio alive when app is backgrounded
      shouldDuckAndroid: false, // Don't lower volume for other apps - we're critical!
      playThroughEarpieceAndroid: false, // Use SPEAKER, not earpiece (important!)

      // INTERRUPTION MODE: DoNotMix = highest priority, won't mix with other audio
      // This is equivalent to using STREAM_ALARM on Android
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });

    isAudioInitialized = true;
    console.log('✅ [SoundManager] Audio mode configured for ALARM-LEVEL playback');
    console.log('   - Will play through SPEAKER');
    console.log('   - Will work in SILENT mode');
    console.log('   - Will work in BACKGROUND');
    console.log('   - Uses HIGHEST priority audio focus');
  } catch (error) {
    console.error('❌ [SoundManager] CRITICAL: Failed to setup audio mode:', error);
    isAudioInitialized = false;
    throw error;
  }
}

/**
 * Starts playing the notification sound for a given booking ID.
 * If the sound is already playing, it simply adds the ID to the active set.
 *
 * CRITICAL: This plays a LOOPING alarm sound that continues until all bookings are handled
 */
export async function playNotificationSound(bookingId: string) {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [SoundManager] Skipping sound playback (not Android)');
    return;
  }

  try {
    console.log(`\n🔊 [SoundManager] ========================================`);
    console.log(`🔊 [SoundManager] REQUEST: Play alarm for booking: ${bookingId}`);
    console.log(`🔊 [SoundManager] ========================================`);

    // Add to active bookings tracking
    if (!activeBookingSounds.has(bookingId)) {
      activeBookingSounds.add(bookingId);
      console.log(`✅ [SoundManager] Added booking ${bookingId} to active alerts`);
      console.log(`📊 [SoundManager] Total active bookings: ${activeBookingSounds.size}`);
    } else {
      console.log(`ℹ️  [SoundManager] Booking ${bookingId} already tracked`);
    }

    // Check if sound is already playing
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && (status as any).isPlaying) {
          console.log('✅ [SoundManager] Alarm is ALREADY PLAYING - keeping it active');
          console.log(`📊 [SoundManager] Current position: ${((status as any).positionMillis / 1000).toFixed(1)}s`);
          return; // Sound already playing, just track the new booking
        } else {
          console.log('⚠️  [SoundManager] Sound object exists but not playing');
          console.log(`    Status: loaded=${status.isLoaded}, playing=${(status as any).isPlaying}`);
          // Will create new sound below
        }
      } catch (statusError) {
        console.warn('⚠️  [SoundManager] Error checking sound status:', statusError);
        // Continue to create new sound
      }
    }

    // Initialize audio mode if not already done
    if (!isAudioInitialized) {
      console.log('🔧 [SoundManager] Audio not initialized, setting up...');
      await setupAudio();
    } else {
      console.log('✅ [SoundManager] Audio already initialized');
    }

    console.log('🎵 [SoundManager] Loading notification sound file...');
    console.log('📁 [SoundManager] File: assets/notification/new_booking.wav');

    // Create and play the alarm sound
    const { sound: newSound } = await Audio.Sound.createAsync(
      SOUND_FILE,
      {
        shouldPlay: true, // Start playing immediately
        isLooping: true, // CRITICAL: Loop continuously
        volume: 1.0, // Maximum volume
        rate: 1.0, // Normal playback rate
        shouldCorrectPitch: false,
      },
      (status) => {
        // Status callback for monitoring
        if (!status.isLoaded) {
          if ('error' in status) {
            console.error('❌ [SoundManager] Sound load error:', status.error);
          }
        } else if ((status as any).isPlaying) {
          // Only log periodically to avoid spam
          const position = (status as any).positionMillis;
          if (position % 5000 < 100) { // Log every ~5 seconds
            console.log(`🔊 [SoundManager] Alarm playing: ${(position / 1000).toFixed(1)}s / ${((status as any).durationMillis / 1000).toFixed(1)}s`);
          }
        }
      }
    );

    // Store the sound object
    sound = newSound;

    // Verify it's actually playing
    const verifyStatus = await newSound.getStatusAsync();
    if (verifyStatus.isLoaded && (verifyStatus as any).isPlaying) {
      console.log('✅ ✅ ✅ [SoundManager] ALARM STARTED SUCCESSFULLY! ✅ ✅ ✅');
      console.log(`🔊 [SoundManager] Playing continuously at MAXIMUM volume`);
      console.log(`🔁 [SoundManager] Looping: ${(verifyStatus as any).isLooping}`);
      console.log(`📢 [SoundManager] Volume: ${(verifyStatus as any).volume * 100}%`);
      console.log(`⏱️  [SoundManager] Duration: ${((verifyStatus as any).durationMillis / 1000).toFixed(1)}s`);
    } else {
      console.error('❌ [SoundManager] CRITICAL: Sound loaded but NOT PLAYING!');
      console.error('   Status:', verifyStatus);

      // Try to play manually
      console.log('🔄 [SoundManager] Attempting manual playback...');
      await newSound.playAsync();
      console.log('✅ [SoundManager] Manual playback initiated');
    }

  } catch (error) {
    console.error('\n❌ ❌ ❌ [SoundManager] CRITICAL ERROR ❌ ❌ ❌');
    console.error('[SoundManager] Failed to play notification sound!');
    console.error('[SoundManager] Error type:', error?.constructor?.name);
    console.error('[SoundManager] Error message:', (error as Error).message);
    console.error('[SoundManager] Error stack:', (error as Error).stack);
    console.error('[SoundManager] This is a CRITICAL issue - bookings will not alert properly!');
    console.error('❌ ❌ ❌ [SoundManager] ======================== ❌ ❌ ❌\n');

    // Don't throw - allow other systems to continue working
  }
}

/**
 * Marks a booking as handled and stops the sound if no other bookings are pending.
 *
 * CRITICAL: Only stops the alarm when ALL bookings have been handled
 */
export async function stopNotificationSound(bookingId: string) {
  if (Platform.OS !== 'android') {
    console.log('⏭️ [SoundManager] Skipping sound stop (not Android)');
    return;
  }

  console.log(`\n🛑 [SoundManager] ========================================`);
  console.log(`🛑 [SoundManager] REQUEST: Stop alarm for booking: ${bookingId}`);
  console.log(`🛑 [SoundManager] ========================================`);

  // Remove from active bookings
  if (activeBookingSounds.has(bookingId)) {
    activeBookingSounds.delete(bookingId);
    console.log(`✅ [SoundManager] Removed booking ${bookingId} from active alerts`);
  } else {
    console.log(`⚠️  [SoundManager] Booking ${bookingId} was not in active set`);
  }

  console.log(`📊 [SoundManager] Remaining active bookings: ${activeBookingSounds.size}`);

  // Only stop sound if NO bookings remain
  if (activeBookingSounds.size === 0) {
    console.log('🎯 [SoundManager] No more active bookings - STOPPING ALARM');

    if (!sound) {
      console.log('ℹ️  [SoundManager] No sound object to stop');
      return;
    }

    try {
      const status = await sound.getStatusAsync();

      if (status.isLoaded) {
        console.log('🛑 [SoundManager] Stopping playback...');
        await sound.stopAsync();

        console.log('🗑️  [SoundManager] Unloading sound...');
        await sound.unloadAsync();

        console.log('✅ ✅ ✅ [SoundManager] ALARM STOPPED SUCCESSFULLY! ✅ ✅ ✅');
      } else {
        console.log('ℹ️  [SoundManager] Sound was not loaded');
      }

      sound = null;
    } catch (error) {
      console.error('❌ [SoundManager] Error stopping sound:', error);
      console.error('   Error message:', (error as Error).message);

      // Force cleanup even on error
      sound = null;
    }
  } else {
    console.log(`⏩ [SoundManager] Keeping alarm active (${activeBookingSounds.size} bookings pending)`);
    const remainingIds = Array.from(activeBookingSounds);
    console.log(`📋 [SoundManager] Active booking IDs:`, remainingIds);
  }

  console.log(`🛑 [SoundManager] ========================================\n`);
}

/**
 * Get current sound manager status (for debugging)
 */
export async function getSoundStatus(): Promise<{
  isPlaying: boolean;
  activeBookings: number;
  bookingIds: string[];
  isAudioInitialized: boolean;
  soundObject: boolean;
} | null> {
  if (Platform.OS !== 'android') return null;

  let isPlaying = false;

  if (sound) {
    try {
      const status = await sound.getStatusAsync();
      isPlaying = status.isLoaded && (status as any).isPlaying;
    } catch (error) {
      console.error('[SoundManager] Error getting status:', error);
    }
  }

  return {
    isPlaying,
    activeBookings: activeBookingSounds.size,
    bookingIds: Array.from(activeBookingSounds),
    isAudioInitialized,
    soundObject: sound !== null,
  };
}