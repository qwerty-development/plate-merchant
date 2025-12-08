/* eslint-disable import/no-unresolved */
import AnalyticsCards from '@/components/bookings/analytics-cards';
import BookingCard from '@/components/bookings/booking-card';
import FilterControls from '@/components/bookings/filter-controls';
import { useRestaurant } from '@/contexts/restaurant-context';
import { useBatteryOptimization } from '@/hooks/use-battery-optimization';
// Foreground service removed - using expo-notifications instead
import { setBadgeCount } from '@/hooks/use-push-notifications';
import { supabase } from '@/lib/supabase';
import { stopBookingAlert } from '@/services/booking-alert-manager';
import { cancelBookingNotification, displayNewBookingNotification, resolveBookingNotification } from '@/services/booking-notification-service';
import { initializeFCM } from '@/services/fcm-service';
import { playNotificationSound, setupAudio, stopNotificationSound } from '@/services/notification-sound-manager';
import { BookingUpdatePayload } from '@/types/database';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfDay } from 'date-fns/endOfDay';
import { startOfDay } from 'date-fns/startOfDay';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function BookingsScreen() {
  const { restaurant, restaurants, loading } = useRestaurant();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Foreground service removed - notifications work via FCM
  const {
    isOptimized,
    requestBatteryOptimizationExemption,
    showBatteryOptimizationGuide
  } = useBatteryOptimization();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const previousPendingIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
    else Alert.alert('', message);
  };

  const updateBooking = useCallback(async (payload: BookingUpdatePayload) => {
    try {
      const { error } = await supabase.from('bookings').update({
        status: payload.status,
        updated_at: new Date().toISOString(),
        ...(payload.note && payload.status === 'declined_by_restaurant' && { decline_note: payload.note }),
        ...(payload.note && payload.status === 'cancelled_by_restaurant' && { cancellation_note: payload.note }),
      }).eq('id', payload.bookingId);
  
      if (error) throw error;
  
      showToast('Booking updated successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    } catch (error) {
      console.error('Error updating booking:', error);
      showToast('Failed to update booking');
    }
  }, [queryClient]);

  const handleAccept = useCallback(async (bookingId: string) => {
    console.log('✅ Accepting booking:', bookingId);
    stopBookingAlert(bookingId);
    await resolveBookingNotification(bookingId, 'confirmed');
    updateBooking({ bookingId, status: 'confirmed' });
  }, [updateBooking]);

  const handleDecline = useCallback(async (bookingId: string, note?: string) => {
    console.log('❌ Declining booking:', bookingId);
    stopBookingAlert(bookingId);
    await resolveBookingNotification(bookingId, 'declined_by_restaurant');
    updateBooking({ bookingId, status: 'declined_by_restaurant', note });
  }, [updateBooking]);

  // Test sound function
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const testSoundId = 'test-sound-123';
  
  const handleTestSound = useCallback(async () => {
    try {
      if (isSoundPlaying) {
        // Stop sound
        await stopNotificationSound(testSoundId);
        setIsSoundPlaying(false);
        showToast('Sound stopped');
      } else {
        // Setup audio first
        await setupAudio();
        // Play sound
        await playNotificationSound(testSoundId);
        setIsSoundPlaying(true);
        showToast('Sound playing (looping)...');
      }
    } catch (error) {
      console.error('❌ Test sound error:', error);
      showToast(`Sound error: ${(error as Error).message}`);
    }
  }, [isSoundPlaying]);

  // Initialize FCM when restaurant is loaded
  useEffect(() => {
    if (restaurant?.id && Platform.OS === 'android') {
      console.log('🚀 [Bookings] Initializing FCM for restaurant:', restaurant.id);
      const cleanup = initializeFCM(restaurant.id);
      return cleanup;
    }
  }, [restaurant?.id]);

  // Prompt for battery optimization on first load
  useEffect(() => {
    if (Platform.OS === 'android' && isOptimized && restaurant?.id) {
      const timer = setTimeout(() => {
        requestBatteryOptimizationExemption();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOptimized, restaurant?.id, requestBatteryOptimizationExemption]);

  // Handle notification action responses (Accept/Decline from notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const action = response.actionIdentifier;
      const bookingId = response.notification.request.content.data?.bookingId as string;
      if (!bookingId) return;
      if (action === 'ACCEPT') handleAccept(bookingId);
      else if (action === 'DECLINE') handleDecline(bookingId);
    });
    return () => subscription.remove();
  }, [handleAccept, handleDecline]);

  // Fetch bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', restaurant?.id, startDate, endDate],
    queryFn: async () => {
        if (!restaurant?.id) return [];
        try {
            const { data: pendingBookings, error: pendingError } = await supabase
                .from('bookings')
                .select(`*, profiles:user_id (*), special_offers:applied_offer_id (*)`)
                .eq('restaurant_id', restaurant.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (pendingError) throw pendingError;

            const { data: dateFilteredBookings, error: dateError } = await supabase
                .from('bookings')
                .select(`*, profiles:user_id (*), special_offers:applied_offer_id (*)`)
                .eq('restaurant_id', restaurant.id)
                .neq('status', 'pending')
                .gte('booking_time', startDate.toISOString())
                .lte('booking_time', endDate.toISOString())
                .order('created_at', { ascending: false });
            if (dateError) throw dateError;

            const allBookings = [...(pendingBookings || []), ...(dateFilteredBookings || [])];
            const uniqueBookings = Array.from(new Map(allBookings.map(b => [b.id, b])).values());
            return uniqueBookings.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast('Failed to fetch bookings');
            return [];
        }
    },
    enabled: !!restaurant?.id,
  });

  // Update badge count
  useEffect(() => {
    if (!bookings) return;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    setBadgeCount(pendingCount);
  }, [bookings]);

  // Trigger sound/alerts for existing pending bookings on initial load
  useEffect(() => {
    if (!bookings || !isInitialLoadRef.current || !restaurant?.id) return;

    const pendingBookings = bookings.filter(b => b.status === 'pending');
    if (pendingBookings.length > 0) {
      console.log(`🔊 [Bookings] Found ${pendingBookings.length} existing pending bookings, starting sounds`);

      // Trigger notifications and sounds for each pending booking
      pendingBookings.forEach(booking => {
        console.log(`🎉 [Bookings] Starting sound for existing pending booking: ${booking.id}`);

        const guestName = booking.profiles?.name || 'Guest';
        const partySize = booking.party_size || 1;
        const bookingTime = booking.booking_time || new Date().toISOString();

        displayNewBookingNotification({
          booking_id: booking.id,
          restaurant_id: restaurant.id,
          guest_name: guestName,
          guest_count: partySize,
          booking_time: bookingTime,
        }).catch(err => {
          console.error(`❌ [Bookings] Error starting notification/sound for ${booking.id}:`, err);
        });
      });
    }
  }, [bookings, restaurant?.id]);

  // Stop sounds and alerts when bookings are handled
  // AND trigger sounds for new bookings that arrive while app is open
  useEffect(() => {
    if (!bookings) return;
    const currentPendingIds = new Set(bookings.filter(b => b.status === 'pending').map(b => b.id));

    if (isInitialLoadRef.current) {
      previousPendingIdsRef.current = currentPendingIds;
      isInitialLoadRef.current = false;
      return;
    }

    // Detect bookings that were pending but are now handled
    const handledPendingIds = Array.from(previousPendingIdsRef.current).filter(id => !currentPendingIds.has(id));
    if (handledPendingIds.length > 0) {
      handledPendingIds.forEach(id => {
        console.log('✅ Booking handled:', id);
        stopBookingAlert(id);
      });
    }

    // Detect NEW pending bookings (arrived while app was open)
    const newPendingIds = Array.from(currentPendingIds).filter(id => !previousPendingIdsRef.current.has(id));
    if (newPendingIds.length > 0 && restaurant?.id) {
      console.log('🎉 [Bookings] New pending bookings detected:', newPendingIds);
      newPendingIds.forEach(id => {
        const booking = bookings.find(b => b.id === id);
        if (booking) {
          console.log(`🔊 [Bookings] Starting notification and sound for NEW booking: ${booking.id}`);
          
          const guestName = booking.profiles?.name || 'Guest';
          const partySize = booking.party_size || 1;
          const bookingTime = booking.booking_time || new Date().toISOString();

          displayNewBookingNotification({
            booking_id: booking.id,
            restaurant_id: restaurant.id,
            guest_name: guestName,
            guest_count: partySize,
            booking_time: bookingTime,
          }).catch(err => {
            console.error(`❌ [Bookings] Error starting notification/sound for ${booking.id}:`, err);
          });
        }
      });
    }

  }, [bookings, restaurant?.id]);

  // Listen for ANY booking changes to refresh the UI and update notifications
  useEffect(() => {
    console.log('🔌 Setting up Supabase Realtime subscription for bookings...');
    
    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: restaurant?.id ? `restaurant_id=eq.${restaurant.id}` : undefined,
        },
        async (payload) => {
          console.log('🔄 [Realtime] Booking change received:', payload.eventType);
          
          // Handle notification updates when booking status changes
          if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;
            const bookingId = payload.new.id as string;

            // If booking was pending and is now accepted/declined, update notification
            if (oldStatus === 'pending' && (newStatus === 'confirmed' || newStatus === 'declined_by_restaurant')) {
              console.log('📱 [Realtime] Booking status changed, updating notification:', bookingId, newStatus);
              
              if (newStatus === 'confirmed') {
                await resolveBookingNotification(bookingId, 'confirmed');
              } else if (newStatus === 'declined_by_restaurant') {
                await resolveBookingNotification(bookingId, 'declined_by_restaurant');
              }
            }
            // If booking was cancelled or completed, cancel notification
            else if (newStatus === 'cancelled_by_user' || newStatus === 'cancelled_by_restaurant' || newStatus === 'completed') {
              console.log('📱 [Realtime] Booking cancelled/completed, cancelling notification:', bookingId);
              await cancelBookingNotification(bookingId);
            }
          }
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
        }
      )
      .subscribe((status) => {
        console.log('🔌 [Realtime] Subscription status:', status);
      });

    // Add AppState listener to refetch on resume
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, refreshing bookings...');
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
      }
    });

    return () => {
      console.log('🔌 [Realtime] Cleaning up subscription');
      supabase.removeChannel(channel);
      subscription.remove();
    };
  }, [restaurant?.id, queryClient]);

  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.guest_name?.toLowerCase().includes(query) ||
        b.confirmation_code?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [bookings, statusFilter, searchQuery]);

  const analytics = useMemo(() => ({
    pending: bookings.filter(b => b.status === 'pending').length,
    cancelled: bookings.filter(b => b.status.startsWith('cancelled_')).length,
    accepted: bookings.filter(b => b.status === 'confirmed').length,
    declined: bookings.filter(b => b.status === 'declined_by_restaurant').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  }), [bookings]);

  const handleComplete = (bookingId: string) => updateBooking({ bookingId, status: 'completed' });
  const handleNoShow = (bookingId: string) => updateBooking({ bookingId, status: 'no_show' });
  const handleCancel = (bookingId: string, note?: string) => updateBooking({ bookingId, status: 'cancelled_by_restaurant', note });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    setRefreshing(false);
  }, [queryClient]);

  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    // If user has multiple restaurants but none selected, redirect to selection (only once)
    if (!restaurant && restaurants.length > 1 && !loading && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace('/(tabs)/select-restaurant');
    }
  }, [restaurant, restaurants.length, loading, router]);

  if (!restaurant) {
    if (loading) {
      return (
        <View className="flex-1 bg-background justify-center items-center p-4">
          <ActivityIndicator size="large" color="#792339" />
          <Text className="text-gray mt-4">Loading restaurant...</Text>
        </View>
      );
    }
    
    if (restaurants.length > 1) {
      return (
        <View className="flex-1 bg-background justify-center items-center p-4">
          <ActivityIndicator size="large" color="#792339" />
          <Text className="text-gray mt-4">Redirecting to restaurant selection...</Text>
        </View>
      );
    }
    
    return (
      <View className="flex-1 bg-background justify-center items-center p-4">
        <MaterialIcons name="store" size={64} color="#d9c3db" />
        <Text className="text-primary text-lg font-semibold mt-4">No restaurant found</Text>
        <Text className="text-gray text-center px-8 mt-2">Please ensure your account is set up correctly.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="bg-primary pt-12 pb-4 px-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-background">Bookings</Text>
            <Text className="text-background/80 mt-1">Manage reservation requests</Text>
          </View>
          <View className="flex-row gap-2 items-center">
            {/* Test Sound Button */}
            <TouchableOpacity 
              className={`rounded-full px-3 py-1.5 flex-row items-center gap-1 ${isSoundPlaying ? 'bg-red-500/30' : 'bg-green-500/30'}`}
              onPress={handleTestSound}
            >
              <MaterialIcons name={isSoundPlaying ? "stop" : "volume-up"} size={14} color="#ffece2" />
              <Text className="text-background text-xs font-medium">{isSoundPlaying ? 'Stop' : 'Test Sound'}</Text>
            </TouchableOpacity>
            {isOptimized && Platform.OS === 'android' && (
              <TouchableOpacity className="bg-orange-500/30 rounded-full px-2 py-1 flex-row items-center gap-1" onPress={showBatteryOptimizationGuide}>
                <MaterialIcons name="battery-alert" size={12} color="#ffece2" />
                <Text className="text-background text-xs">Battery</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity className="bg-background/20 rounded-full p-2" onPress={() => setShowAnalytics(!showAnalytics)}>
              <MaterialIcons name={showAnalytics ? "expand-less" : "expand-more"} size={24} color="#ffece2" />
            </TouchableOpacity>
          </View>
        </View>
        {!showAnalytics && (
          <View className="flex-row justify-between mt-4 bg-background/10 rounded-xl p-3">
            <View className="items-center"><Text className="text-background/70 text-xs">Pending</Text><Text className="text-background font-bold text-lg">{analytics.pending}</Text></View>
            <View className="items-center"><Text className="text-background/70 text-xs">Accepted</Text><Text className="text-background font-bold text-lg">{analytics.accepted}</Text></View>
            <View className="items-center"><Text className="text-background/70 text-xs">Completed</Text><Text className="text-background font-bold text-lg">{analytics.completed}</Text></View>
            <View className="items-center"><Text className="text-background/70 text-xs">Total</Text><Text className="text-background font-bold text-lg">{bookings.length}</Text></View>
          </View>
        )}
      </View>
      {showAnalytics && <AnalyticsCards {...analytics} />}
      <FilterControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />
      <ScrollView
        className="flex-1 px-6 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#792339" />
            <Text className="text-gray mt-4">Loading bookings...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View className="py-12 items-center">
            <MaterialIcons name="event-available" size={64} color="#d9c3db" />
            <Text className="text-primary text-lg font-semibold mt-4">No bookings found</Text>
            <Text className="text-gray text-center px-8 mt-2">Try adjusting your search or filters.</Text>
          </View>
        ) : (
          <>
            {filteredBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onComplete={handleComplete}
                onNoShow={handleNoShow}
                onCancel={handleCancel}
              />
            ))}
            <View className="h-6" />
          </>
        )}
      </ScrollView>
    </View>
  );
}