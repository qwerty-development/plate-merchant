import AnalyticsCards from '@/components/bookings/analytics-cards';
import BookingCard from '@/components/bookings/booking-card';
import FilterControls from '@/components/bookings/filter-controls';
import { useRestaurant } from '@/contexts/restaurant-context';
import { useBatteryOptimization } from '@/hooks/use-battery-optimization';
import { useBookingNotification } from '@/hooks/use-booking-notification';
import { useNotifeeForegroundService } from '@/hooks/use-notifee-foreground-service';
import { setBadgeCount } from '@/hooks/use-push-notifications';
import { supabase } from '@/lib/supabase';
import { triggerBookingAlert, stopBookingAlert } from '@/services/booking-alert-manager';
import { initializeFCM } from '@/services/fcm-service';
import { startPersistentAlert, stopPersistentAlert } from '@/services/persistent-audio-manager';
import { BookingUpdatePayload } from '@/types/database';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfDay } from 'date-fns/endOfDay';
import { startOfDay } from 'date-fns/startOfDay';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const { playSound, markBookingHandled } = useBookingNotification();
  const { isServiceRunning, updateServiceNotification } = useNotifeeForegroundService(true);
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

  const handleAccept = useCallback((bookingId: string) => {
    console.log('✅ Accepting booking:', bookingId);
    markBookingHandled(bookingId);
    stopBookingAlert(bookingId);
    stopPersistentAlert(bookingId);
    updateBooking({ bookingId, status: 'confirmed' });
  }, [markBookingHandled, updateBooking]);

  const handleDecline = useCallback((bookingId: string, note?: string) => {
    console.log('❌ Declining booking:', bookingId);
    markBookingHandled(bookingId);
    stopBookingAlert(bookingId);
    stopPersistentAlert(bookingId);
    updateBooking({ bookingId, status: 'declined_by_restaurant', note });
  }, [markBookingHandled, updateBooking]);

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

  // Update foreground service notification and badge count
  useEffect(() => {
    if (!isServiceRunning || !bookings) return;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    setBadgeCount(pendingCount);
    if (pendingCount > 0) {
      updateServiceNotification(
        `🔔 ${pendingCount} Pending ${pendingCount === 1 ? 'Booking' : 'Bookings'}`,
        'Tap to view and respond',
        pendingCount
      );
    } else {
      updateServiceNotification('✅ All Caught Up!', 'Listening for new requests');
    }
  }, [bookings, isServiceRunning, updateServiceNotification]);

  // Trigger sound/alerts for existing pending bookings on initial load
  useEffect(() => {
    if (!bookings || !isInitialLoadRef.current) return;

    const pendingBookings = bookings.filter(b => b.status === 'pending');
    if (pendingBookings.length > 0) {
      console.log(`🔊 [Bookings] Found ${pendingBookings.length} existing pending bookings, triggering alerts`);

      // Trigger sound and alerts for each pending booking
      pendingBookings.forEach(booking => {
        console.log(`🎉 [Bookings] Triggering alert for existing booking: ${booking.id}`);

        // Start persistent audio alert (non-blocking)
        startPersistentAlert(booking.id).catch(err => {
          console.error(`❌ [Bookings] Error starting audio for ${booking.id}:`, err);
        });

        // Trigger alert (non-blocking)
        const guestName = booking.profiles?.name || 'Guest';
        const partySize = booking.party_size || 1;
        const bookingTime = booking.booking_time ?
          new Date(booking.booking_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) : '';

        triggerBookingAlert(booking.id, guestName, partySize, bookingTime).catch(err => {
          console.error(`❌ [Bookings] Error triggering alert for ${booking.id}:`, err);
        });
      });
    }
  }, [bookings]);

  // Stop sounds and alerts when bookings are handled
  // Note: FCM handles triggering notifications for NEW bookings
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
        markBookingHandled(id);
        stopBookingAlert(id);
        stopPersistentAlert(id);
      });
    }

    previousPendingIdsRef.current = currentPendingIds;
  }, [bookings, markBookingHandled]);

  // Listen for ANY booking changes to refresh the UI
  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel(`bookings-ui-listener-${restaurant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          console.log('📨 [UI] Change detected, invalidating bookings query.');
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
        })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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

  if (!restaurant) {
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
            {isOptimized && Platform.OS === 'android' && (
              <TouchableOpacity className="bg-orange-500/30 rounded-full px-2 py-1 flex-row items-center gap-1" onPress={showBatteryOptimizationGuide}>
                <MaterialIcons name="battery-alert" size={12} color="#ffece2" />
                <Text className="text-background text-xs">Battery</Text>
              </TouchableOpacity>
            )}
            {isServiceRunning && (
              <View className="bg-green-500/30 rounded-full px-2 py-1 flex-row items-center gap-1">
                <View className="w-2 h-2 rounded-full bg-green-400" />
                <Text className="text-background text-xs">Service Active</Text>
              </View>
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