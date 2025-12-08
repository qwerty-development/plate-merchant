import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { RestaurantProvider } from '@/contexts/restaurant-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeBookingAlerts } from '@/services/booking-alert-manager';
import { setupNotificationChannels } from '@/services/booking-notification-service';
import { setupBackgroundMessageHandler } from '@/services/fcm-service';
import { ActivityIndicator, View } from 'react-native';

// Initialize notification systems at module load (before any React components render)
if (Platform.OS === 'android') {
  // Initialize expo-notifications channels
  initializeBookingAlerts().catch(error => {
    console.error('❌ Failed to initialize booking alerts:', error);
  });

  setupNotificationChannels().catch(error => {
    console.error('❌ Failed to setup notification channels:', error);
  });

  // Setup FCM background message handler (optional - only works in production builds)
  try {
    setupBackgroundMessageHandler();
  } catch (error) {
    console.warn('⚠️ FCM background handler not available (OK in Expo Go):', error);
  }

  console.log('✅ Notification systems initialized');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function RootLayoutNav() {
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if user is not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to bookings tab when user is authenticated
      // Restaurant selection will be handled by the select-restaurant screen
      router.replace('/(tabs)/bookings');
    }
  }, [user, authLoading, segments]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RestaurantProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootLayoutNav />
            <StatusBar style="auto" />
          </ThemeProvider>
        </RestaurantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
