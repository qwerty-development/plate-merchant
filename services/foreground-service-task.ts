import notifee from '@notifee/react-native';

/**
 * Register the foreground service task with Notifee
 * This MUST be called at app startup, outside of any React components
 *
 * This task keeps the app alive and maintains the realtime connection
 */
export function registerForegroundServiceTask() {
  console.log('📝 Registering foreground service task...');

  notifee.registerForegroundService((notification) => {
    return new Promise(() => {
      // This promise intentionally never resolves
      // This keeps the foreground service running indefinitely
      // The service will continue running as long as the app process is alive

      console.log('✅ Foreground service task registered and running');
      console.log('🔄 Service will keep app alive for realtime connections');

      // The notification parameter contains the notification data
      // We don't need to do anything with it here - just keep the service alive
    });
  });

  console.log('✅ Foreground service task registered successfully');
}
