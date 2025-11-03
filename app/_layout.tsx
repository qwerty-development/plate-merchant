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
import { registerForegroundServiceTask } from '@/services/foreground-service-task';
import { initializeBookingAlerts } from '@/services/booking-alert-manager';
import { ActivityIndicator, View } from 'react-native';

// Register foreground service task ONCE at module load (before any React components render)
// This is CRITICAL for Notifee foreground service to work
if (Platform.OS === 'android') {
  registerForegroundServiceTask();

  // Initialize booking alert system
  initializeBookingAlerts().catch(error => {
    console.error('❌ Failed to initialize booking alerts:', error);
  });
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
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if user is not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to bookings tab when user is authenticated
      router.replace('/(tabs)/bookings');
    }
  }, [user, loading, segments]);

  if (loading) {
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
