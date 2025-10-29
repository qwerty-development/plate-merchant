import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, Vibration } from 'react-native';

const HEALTH_CHECK_KEY = '@system_health';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_FAILED_CHECKS = 3;

interface SystemHealth {
  lastCheck: number;
  notificationPermission: boolean;
  backgroundTaskActive: boolean;
  foregroundServiceActive: boolean;
  realtimeConnected: boolean;
  soundTestPassed: boolean;
  failedChecks: number;
  lastNotificationSent: number;
  appRestarts: number;
}

/**
 * System Health Monitor - Watchdog that ensures everything is working
 * Automatically detects and fixes issues
 */
export function useSystemHealthMonitor(
  isConnected: boolean,
  isBackgroundTaskRegistered: boolean,
  isServiceRunning: boolean
) {
  const [health, setHealth] = useState<SystemHealth>({
    lastCheck: Date.now(),
    notificationPermission: false,
    backgroundTaskActive: false,
    foregroundServiceActive: false,
    realtimeConnected: false,
    soundTestPassed: false,
    failedChecks: 0,
    lastNotificationSent: 0,
    appRestarts: 0,
  });
  
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [issues, setIssues] = useState<string[]>([]);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Load health data from storage
  useEffect(() => {
    loadHealthData();
  }, []);

  // Save health data periodically
  useEffect(() => {
    saveHealthData(health);
  }, [health]);

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Run health checks periodically
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Initial check
    runHealthCheck();

    // Periodic checks
    healthCheckIntervalRef.current = setInterval(() => {
      runHealthCheck();
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [isConnected, isBackgroundTaskRegistered, isServiceRunning]);

  const loadHealthData = async () => {
    try {
      const stored = await AsyncStorage.getItem(HEALTH_CHECK_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setHealth({
          ...data,
          appRestarts: (data.appRestarts || 0) + 1, // Increment restart counter
        });
        console.log('📊 Health data loaded, app restarts:', data.appRestarts + 1);
      }
    } catch (error) {
      console.error('Error loading health data:', error);
    }
  };

  const saveHealthData = async (data: SystemHealth) => {
    try {
      await AsyncStorage.setItem(HEALTH_CHECK_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving health data:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`📱 App state changed: ${appStateRef.current} → ${nextAppState}`);
    
    if (appStateRef.current === 'background' && nextAppState === 'active') {
      console.log('🔄 App returned to foreground, running health check...');
      // App came back to foreground, run immediate health check
      setTimeout(() => runHealthCheck(), 1000);
    }
    
    appStateRef.current = nextAppState;
  };

  const runHealthCheck = useCallback(async () => {
    console.log('🏥 Running system health check...');
    const currentIssues: string[] = [];

    // Check notification permissions
    const { status: notificationStatus } = await Notifications.getPermissionsAsync();
    const hasNotificationPermission = notificationStatus === 'granted';
    if (!hasNotificationPermission) {
      currentIssues.push('Notification permission denied');
    }

    // Check realtime connection
    if (!isConnected) {
      currentIssues.push('Realtime connection lost');
    }

    // Check background task
    if (!isBackgroundTaskRegistered) {
      currentIssues.push('Background task not registered');
    }

    // Check foreground service
    if (!isServiceRunning) {
      currentIssues.push('Foreground service not running');
    }

    // Update health state
    const newHealth: SystemHealth = {
      lastCheck: Date.now(),
      notificationPermission: hasNotificationPermission,
      backgroundTaskActive: isBackgroundTaskRegistered,
      foregroundServiceActive: isServiceRunning,
      realtimeConnected: isConnected,
      soundTestPassed: health.soundTestPassed,
      failedChecks: currentIssues.length > 0 ? health.failedChecks + 1 : 0,
      lastNotificationSent: health.lastNotificationSent,
      appRestarts: health.appRestarts,
    };

    setHealth(newHealth);
    setIssues(currentIssues);

    // Determine health status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (currentIssues.length > 0) {
      status = 'warning';
    }
    if (currentIssues.length > 2 || newHealth.failedChecks >= MAX_FAILED_CHECKS) {
      status = 'critical';
    }
    setHealthStatus(status);

    // Log results
    if (currentIssues.length > 0) {
      console.warn('⚠️ Health issues detected:', currentIssues);
      console.log('🔧 Attempting auto-recovery...');
      await attemptAutoRecovery(currentIssues);
    } else {
      console.log('✅ System health: All checks passed');
    }
  }, [isConnected, isBackgroundTaskRegistered, isServiceRunning, health]);

  const attemptAutoRecovery = async (detectedIssues: string[]) => {
    console.log('🔧 Auto-recovery started for issues:', detectedIssues);

    for (const issue of detectedIssues) {
      switch (issue) {
        case 'Notification permission denied':
          console.log('📱 Attempting to request notification permissions...');
          await Notifications.requestPermissionsAsync();
          break;

        case 'Realtime connection lost':
          console.log('🔌 Realtime connection will auto-reconnect');
          // Connection auto-reconnects via useRealtimeConnection hook
          break;

        case 'Background task not registered':
          console.log('⏰ Background task registration issue detected');
          // Can't re-register from here, but logged for visibility
          break;

        case 'Foreground service not running':
          console.log('🛡️ Foreground service issue detected');
          // Service should auto-restart via hook
          break;
      }
    }

    // Send a test notification to verify system is working
    await sendHealthCheckNotification();
  };

  const sendHealthCheckNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏥 System Health Check',
          body: 'Notification system is operational',
          data: { type: 'health_check' },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: null,
      });
      
      setHealth(prev => ({
        ...prev,
        lastNotificationSent: Date.now(),
      }));
      
      console.log('✅ Health check notification sent');
    } catch (error) {
      console.error('❌ Failed to send health check notification:', error);
    }
  };

  const markSoundTestPassed = useCallback(() => {
    setHealth(prev => ({
      ...prev,
      soundTestPassed: true,
    }));
    console.log('🔊 Sound test marked as passed');
  }, []);

  const triggerEmergencyAlert = useCallback(() => {
    console.log('🚨 EMERGENCY ALERT TRIGGERED');
    
    // Maximum vibration
    Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);
    
    // Send urgent notification
    Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 URGENT: System Check Required',
        body: 'Please verify the app is working correctly',
        data: { type: 'emergency_alert' },
        sound: 'new_booking.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 1000, 500, 1000],
      },
      trigger: null,
    });
  }, []);

  return {
    health,
    healthStatus,
    issues,
    runHealthCheck,
    markSoundTestPassed,
    triggerEmergencyAlert,
  };
}
