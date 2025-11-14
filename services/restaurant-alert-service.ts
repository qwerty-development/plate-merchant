/**
 * Restaurant Alert Service - Core notification system for tablet
 * Handles continuous sound, screen wake, and persistent notifications
 */

import notifee, {
    AndroidCategory,
    AndroidColor,
    AndroidImportance,
    AndroidVisibility,
} from '@notifee/react-native';
import { Platform, Vibration } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import Sound from 'react-native-sound';

// Configuration
const SOUND_FILENAME = 'new_booking.wav'; // Must match file in android/app/src/main/res/raw/
const VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000]; // Strong pattern
const REPEAT_INTERVAL_MS = 10000; // Re-alert every 10 seconds
const CHANNEL_ID = 'restaurant-booking-alerts';
const SERVICE_CHANNEL_ID = 'restaurant-foreground-service';

// State management
class RestaurantAlertService {
  private sound: Sound | null = null;
  private activeBookings = new Map<string, NodeJS.Timeout>();
  private isServiceRunning = false;
  private soundLoaded = false;

  /**
   * Initialize the service - call this on app start
   */
  async initialize() {
    if (Platform.OS !== 'android') return;

    console.log('🚀 [AlertService] Initializing Restaurant Alert Service...');

    try {
      // Create notification channels
      await this.createNotificationChannels();

      // Load the sound file
      await this.loadSound();

      // Start foreground service
      await this.startForegroundService();

      console.log('✅ [AlertService] Service initialized successfully');
    } catch (error) {
      console.error('❌ [AlertService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create Android notification channels
   */
  private async createNotificationChannels() {
    // Channel for booking alerts (high priority)
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Booking Alerts',
      description: 'Critical alerts for new restaurant bookings',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: VIBRATION_PATTERN,
      lights: true,
      lightColor: AndroidColor.RED,
      bypassDnd: true,
    });

    // Channel for foreground service (low priority)
    await notifee.createChannel({
      id: SERVICE_CHANNEL_ID,
      name: 'Background Service',
      description: 'Keeps the app running to receive bookings',
      importance: AndroidImportance.LOW,
      vibration: false,
    });

    console.log('✅ [AlertService] Notification channels created');
  }

  /**
   * Load the sound file from Android resources
   */
  private loadSound(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.soundLoaded) {
        resolve();
        return;
      }

      console.log('🎵 [AlertService] Loading sound file...');

      // Enable playback in silence mode
      Sound.setCategory('Playback', true);

      // Load sound from android/app/src/main/res/raw/
      this.sound = new Sound(SOUND_FILENAME, Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.error('❌ [AlertService] Failed to load sound:', error);
          reject(new Error(`Sound loading failed: ${error}`));
          return;
        }

        if (!this.sound) {
          reject(new Error('Sound object is null after loading'));
          return;
        }

        // Configure sound for infinite loop
        this.sound.setNumberOfLoops(-1); // -1 = infinite
        this.sound.setVolume(1.0); // Maximum volume

        this.soundLoaded = true;
        console.log('✅ [AlertService] Sound loaded successfully');
        console.log(`   Duration: ${this.sound.getDuration()}s`);
        resolve();
      });
    });
  }

  /**
   * Start Android foreground service to keep app alive
   */
  private async startForegroundService() {
    if (this.isServiceRunning) return;

    try {
      await notifee.displayNotification({
        id: 'foreground-service',
        title: 'Plate Merchant Active',
        body: 'Ready to receive bookings',
        android: {
          channelId: SERVICE_CHANNEL_ID,
          asForegroundService: true,
          ongoing: true,
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_launcher',
          color: '#792339',
        },
      });

      this.isServiceRunning = true;
      console.log('✅ [AlertService] Foreground service started');
    } catch (error) {
      console.error('❌ [AlertService] Failed to start foreground service:', error);
    }
  }

  /**
   * MAIN FUNCTION: Start alert for new booking
   * This will:
   * 1. Turn on screen
   * 2. Start continuous sound
   * 3. Vibrate device
   * 4. Show persistent notification
   * 5. Repeat every 10 seconds
   */
  async startBookingAlert(
    bookingId: string,
    guestName: string,
    partySize: number,
    bookingTime?: string
  ) {
    console.log(`🚨 [AlertService] NEW BOOKING ALERT: ${bookingId}`);
    console.log(`   Guest: ${guestName}, Party: ${partySize}, Time: ${bookingTime}`);

    try {
      // 1. Wake up the screen
      KeepAwake.activate();
      console.log('💡 [AlertService] Screen wake activated');

      // 2. Start continuous sound
      await this.startContinuousSound();

      // 3. Vibrate device
      Vibration.vibrate(VIBRATION_PATTERN);

      // 4. Show high-priority notification
      await this.showBookingNotification(bookingId, guestName, partySize, bookingTime);

      // 5. Schedule repeating alerts
      this.scheduleRepeatingAlert(bookingId, guestName, partySize, bookingTime);

      console.log('✅ [AlertService] All alert systems activated!');
    } catch (error) {
      console.error('❌ [AlertService] Failed to start alert:', error);
      // Try fallback notification at least
      this.showFallbackNotification(bookingId, guestName, partySize);
    }
  }

  /**
   * Start playing continuous sound
   */
  private async startContinuousSound() {
    if (!this.sound) {
      console.log('⚠️ [AlertService] Sound not loaded, attempting reload...');
      await this.loadSound();
    }

    if (!this.sound) {
      throw new Error('Sound unavailable');
    }

    // Check if already playing
    if (this.sound.isPlaying()) {
      console.log('🔊 [AlertService] Sound already playing');
      return;
    }

    console.log('🔊 [AlertService] Starting continuous sound loop...');
    
    this.sound.play((success) => {
      if (success) {
        console.log('✅ [AlertService] Sound loop completed (will restart automatically)');
      } else {
        console.error('❌ [AlertService] Sound playback failed');
        // Try to restart
        setTimeout(() => {
          this.startContinuousSound();
        }, 1000);
      }
    });
  }

  /**
   * Show high-priority booking notification
   */
  private async showBookingNotification(
    bookingId: string,
    guestName: string,
    partySize: number,
    bookingTime?: string
  ) {
    await notifee.displayNotification({
      id: `booking-${bookingId}`,
      title: '🎉 NEW BOOKING ALERT!',
      body: `${guestName} • ${partySize} ${partySize === 1 ? 'guest' : 'guests'}${
        bookingTime ? ` • ${bookingTime}` : ''
      }`,
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        
        // Full screen intent - CRITICAL for waking device
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        
        // Visual prominence
        color: AndroidColor.RED,
        colorized: true,
        
        // Persistence
        ongoing: false,
        autoCancel: false,
        
        // Category
        category: AndroidCategory.ALARM,
        visibility: AndroidVisibility.PUBLIC,
        
        // Timestamp
        showTimestamp: true,
        timestamp: Date.now(),
        
        // Actions
        actions: [
          {
            title: '✅ ACCEPT',
            pressAction: {
              id: 'accept',
              launchActivity: 'default',
            },
          },
          {
            title: '❌ DECLINE',
            pressAction: {
              id: 'decline',
              launchActivity: 'default',
            },
          },
        ],
      },
    });
  }

  /**
   * Schedule repeating alerts every 10 seconds
   */
  private scheduleRepeatingAlert(
    bookingId: string,
    guestName: string,
    partySize: number,
    bookingTime?: string
  ) {
    // Clear any existing timer for this booking
    const existingTimer = this.activeBookings.get(bookingId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up repeating alert
    const timer:any = setInterval(() => {
      console.log(`🔁 [AlertService] Repeating alert for booking: ${bookingId}`);
      
      // Vibrate again
      Vibration.vibrate(VIBRATION_PATTERN);
      
      // Update notification
      this.showBookingNotification(bookingId, guestName, partySize, bookingTime);
    }, REPEAT_INTERVAL_MS);

    this.activeBookings.set(bookingId, timer);
    console.log(`⏰ [AlertService] Scheduled repeating alerts for ${bookingId}`);
  }

  /**
   * Fallback notification if main alert fails
   */
  private async showFallbackNotification(
    bookingId: string,
    guestName: string,
    partySize: number
  ) {
    try {
      // Use simpler notification
      await notifee.displayNotification({
        title: 'NEW BOOKING',
        body: `${guestName} - ${partySize} guests`,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          smallIcon: 'ic_launcher',
        },
      });
    } catch (error) {
      console.error('❌ [AlertService] Even fallback notification failed:', error);
    }
  }

  /**
   * STOP alert for a handled booking
   */
  async stopBookingAlert(bookingId: string) {
    console.log(`🛑 [AlertService] Stopping alert for booking: ${bookingId}`);

    try {
      // 1. Clear repeating timer
      const timer = this.activeBookings.get(bookingId);
      if (timer) {
        clearInterval(timer);
        this.activeBookings.delete(bookingId);
        console.log('⏰ [AlertService] Cleared repeating timer');
      }

      // 2. Cancel notification
      await notifee.cancelNotification(`booking-${bookingId}`);
      console.log('📴 [AlertService] Cancelled notification');

      // 3. Stop sound if no more active bookings
      if (this.activeBookings.size === 0) {
        this.stopSound();
        
        // 4. Deactivate screen wake
        KeepAwake.deactivate();
        console.log('💤 [AlertService] Screen wake deactivated');
      }

      console.log('✅ [AlertService] Alert stopped successfully');
    } catch (error) {
      console.error('❌ [AlertService] Error stopping alert:', error);
    }
  }

  /**
   * Stop the continuous sound
   */
  private stopSound() {
    if (this.sound && this.sound.isPlaying()) {
      console.log('🔇 [AlertService] Stopping sound...');
      this.sound.stop(() => {
        console.log('✅ [AlertService] Sound stopped');
      });
    }
  }

  /**
   * Update foreground service notification
   */
  async updateServiceStatus(pendingCount: number) {
    if (!this.isServiceRunning) return;

    const title = pendingCount > 0 
      ? `🔔 ${pendingCount} Pending Booking${pendingCount > 1 ? 's' : ''}`
      : '✅ All Caught Up';
    
    const body = pendingCount > 0
      ? 'Tap to view and respond'
      : 'Ready to receive bookings';

    await notifee.displayNotification({
      id: 'foreground-service',
      title,
      body,
      android: {
        channelId: SERVICE_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        color: pendingCount > 0 ? AndroidColor.RED : '#792339',
        progress: pendingCount > 0 ? {
          max: pendingCount,
          current: pendingCount,
          indeterminate: false,
        } : undefined,
      },
    });
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    console.log('🧹 [AlertService] Cleaning up...');

    // Stop all alerts
    for (const [bookingId] of this.activeBookings) {
      await this.stopBookingAlert(bookingId);
    }

    // Release sound
    if (this.sound) {
      this.sound.release();
      this.sound = null;
    }

    // Stop foreground service
    await notifee.cancelNotification('foreground-service');
    this.isServiceRunning = false;

    // Deactivate screen wake
    KeepAwake.deactivate();

    console.log('✅ [AlertService] Cleanup complete');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isServiceRunning: this.isServiceRunning,
      soundLoaded: this.soundLoaded,
      activeBookings: this.activeBookings.size,
      bookingIds: Array.from(this.activeBookings.keys()),
    };
  }
}

// Export singleton instance
export const restaurantAlertService = new RestaurantAlertService();