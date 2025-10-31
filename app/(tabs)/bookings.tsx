import AnalyticsCards from '@/components/bookings/analytics-cards';
import BookingCard from '@/components/bookings/booking-card';
import FilterControls from '@/components/bookings/filter-controls';
import { useRestaurant } from '@/contexts/restaurant-context';
import { useBatteryOptimization } from '@/hooks/use-battery-optimization';
import { useBookingNotification } from '@/hooks/use-booking-notification';
import { useNotifeeForegroundService } from '@/hooks/use-notifee-foreground-service';
import { usePersistentNotification } from '@/hooks/use-persistent-notification';
import { sendLocalNotification, setBadgeCount, usePushNotifications } from '@/hooks/use-push-notifications';
import { useRealtimeConnection } from '@/hooks/use-realtime-connection';
import { supabase } from '@/lib/supabase';
import { Booking, BookingUpdatePayload } from '@/types/database';
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
  const { playSound, markBookingHandled, stopSound } = useBookingNotification();
  const { expoPushToken } = usePushNotifications();
  const {
    addPendingBooking,
    removePendingBooking,
    getPendingCount,
    isBackgroundTaskRegistered
  } = usePersistentNotification();
  const {
    isServiceRunning,
    isInitialized,
    updateServiceNotification
  } = useNotifeeForegroundService(true);
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

  // Prompt for battery optimization on first load
  useEffect(() => {
    if (Platform.OS === 'android' && isOptimized && restaurant?.id) {
      // Show battery optimization request after a short delay
      const timer = setTimeout(() => {
        requestBatteryOptimizationExemption();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOptimized, restaurant?.id]);

  // Handle notification action responses (Accept/Decline from notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const action = response.actionIdentifier;
      const bookingId = response.notification.request.content.data?.bookingId as string;

      console.log('📱 Notification action:', action, 'for booking:', bookingId);

      if (!bookingId) return;

      if (action === 'ACCEPT') {
        handleAccept(bookingId);
      } else if (action === 'DECLINE') {
        handleDecline(bookingId);
      }
    });

    return () => subscription.remove();
  }, []);

  // Save push token to database when available
  useEffect(() => {
    if (expoPushToken && restaurant?.id) {
      console.log('💾 Saving push token to database...');
      // You can save this to user_devices table or restaurant_staff table
      // For now, just log it
      console.log('📱 Restaurant push token:', expoPushToken);
    }
  }, [expoPushToken, restaurant?.id]);

  // Fetch bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', restaurant?.id, startDate, endDate],
    queryFn: async () => {
      if (!restaurant?.id) return [];

      try {
        // Always fetch ALL pending bookings
        const { data: pendingBookings, error: pendingError } = await supabase
          .from('bookings')
          .select(`
            *,
            profiles:user_id (
              id, full_name, phone_number, email, user_rating
            ),
            special_offers:applied_offer_id (
              id, title, description, discount_percentage
            )
          `)
          .eq('restaurant_id', restaurant.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pendingError) throw pendingError;

        // Fetch date-filtered bookings (excluding pending)
        const { data: dateFilteredBookings, error: dateError } = await supabase
          .from('bookings')
          .select(`
            *,
            profiles:user_id (
              id, full_name, phone_number, email, user_rating
            ),
            special_offers:applied_offer_id (
              id, title, description, discount_percentage
            )
          `)
          .eq('restaurant_id', restaurant.id)
          .neq('status', 'pending')
          .gte('booking_time', startDate.toISOString())
          .lte('booking_time', endDate.toISOString())
          .order('created_at', { ascending: false });

        if (dateError) throw dateError;

        // Combine and deduplicate
        const allBookings = [...(pendingBookings || []), ...(dateFilteredBookings || [])];
        const uniqueBookings = Array.from(
          new Map(allBookings.map(b => [b.id, b])).values()
        );

        // Sort: pending first, then by creation date
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

  // Update foreground service notification with pending count
  useEffect(() => {
    if (!isServiceRunning || !bookings) return;

    const pendingCount = bookings.filter(b => b.status === 'pending').length;

    if (pendingCount > 0) {
      updateServiceNotification(
        `🔔 ${pendingCount} Pending ${pendingCount === 1 ? 'Booking' : 'Bookings'}`,
        'Tap to view and respond',
        pendingCount
      );
    } else {
      updateServiceNotification(
        '✅ All Caught Up!',
        'No pending bookings - listening for new requests'
      );
    }
  }, [bookings, isServiceRunning, updateServiceNotification]);

  // Monitor pending bookings and play sound for new ones
  useEffect(() => {
    if (!bookings) return;

    const currentPendingIds = new Set(
      bookings.filter(b => b.status === 'pending').map(b => b.id)
    );

    console.log('📊 Current pending bookings:', currentPendingIds.size);
    console.log('📊 Previous pending bookings:', previousPendingIdsRef.current.size);
    console.log('📊 Is initial load:', isInitialLoadRef.current);

    // Skip playing sound on initial load (for existing bookings)
    if (isInitialLoadRef.current) {
      console.log('⏭️ Skipping sound on initial load');
      previousPendingIdsRef.current = currentPendingIds;
      isInitialLoadRef.current = false;
      return;
    }

    // Find new pending bookings
    const newPendingIds = Array.from(currentPendingIds).filter(
      id => !previousPendingIdsRef.current.has(id)
    );

    // Find bookings that were pending but are no longer (cancelled by user)
    const noPendingIds = Array.from(previousPendingIdsRef.current).filter(
      id => !currentPendingIds.has(id)
    );

    if (noPendingIds.length > 0) {
      console.log('⚠️ Bookings no longer pending:', noPendingIds.length);
      
      // Stop sound for bookings that were cancelled by user
      noPendingIds.forEach(id => {
        const booking = bookings.find(b => b.id === id);
        if (booking?.status === 'cancelled_by_user') {
          console.log('🛑 Booking cancelled by user, stopping sound:', id);
          markBookingHandled(id);
        }
      });
    }

    if (newPendingIds.length > 0) {
      console.log('🆕 New pending bookings detected:', newPendingIds.length);
      
      // Play sound and send notification for each new pending booking
      newPendingIds.forEach(id => {
        console.log('🔔 Playing sound for booking:', id);
        playSound(id);
        
        // Find the booking details
        const booking = bookings.find(b => b.id === id);
        if (booking) {
          const guestName = booking.guest_name || booking.profiles?.full_name || 'Guest';
          const partySize = booking.party_size;
          
          // Add to persistent notification system (repeating alerts)
          addPendingBooking(id, guestName, partySize);
          
          // Send local push notification (works when app is closed)
          sendLocalNotification(
            '🎉 New Booking Request!',
            `${guestName} wants to book for ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`,
            { bookingId: id, type: 'new_booking' }
          );
        }
      });
      
      // Update badge count
      setBadgeCount(currentPendingIds.size);
    }

    // Update the ref
    previousPendingIdsRef.current = currentPendingIds;
  }, [bookings, playSound, markBookingHandled]);

  // Handle realtime booking changes
  const handleBookingChange = useCallback((payload: any) => {
    console.log('📨 Booking change detected:', payload.eventType);
    
    // Refetch bookings
    queryClient.invalidateQueries({ queryKey: ['bookings'] });

    // Show toast and notification for new bookings
    if (payload.eventType === 'INSERT') {
      const newBooking = payload.new as Booking;
      const guestName = newBooking.guest_name || 'Guest';
      showToast(`New booking from ${guestName} for ${newBooking.party_size} guests`);
      
      // Send push notification if app is in background
      sendLocalNotification(
        '🎉 New Booking Request!',
        `${guestName} wants to book for ${newBooking.party_size} ${newBooking.party_size === 1 ? 'guest' : 'guests'}`,
        { bookingId: newBooking.id, type: 'new_booking' }
      );
    }
  }, [queryClient]);

  // Use realtime connection with automatic reconnection
  const { isConnected, lastHeartbeat, forceReconnect } = useRealtimeConnection({
    restaurantId: restaurant?.id,
    onBookingChange: handleBookingChange,
    enabled: !!restaurant?.id,
  });

  // Filter bookings
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        return (
          b.guest_name?.toLowerCase().includes(query) ||
          b.profiles?.full_name?.toLowerCase().includes(query) ||
          b.guest_email?.toLowerCase().includes(query) ||
          b.profiles?.email?.toLowerCase().includes(query) ||
          b.guest_phone?.includes(query) ||
          b.profiles?.phone_number?.includes(query) ||
          b.confirmation_code?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [bookings, statusFilter, searchQuery]);

  // Calculate analytics
  const analytics = useMemo(() => {
    return {
      pending: bookings.filter(b => b.status === 'pending').length,
      cancelled: bookings.filter(b => 
        b.status === 'cancelled_by_customer' || b.status === 'cancelled_by_restaurant'
      ).length,
      accepted: bookings.filter(b => b.status === 'confirmed').length,
      declined: bookings.filter(b => b.status === 'declined_by_restaurant').length,
      completed: bookings.filter(b => b.status === 'completed').length,
    };
  }, [bookings]);

  // Booking actions
  const updateBooking = async (payload: BookingUpdatePayload) => {
    try {
      // First, check current booking status
      const booking = bookings.find(b => b.id === payload.bookingId);
      
      if (!booking) {
        showToast('Booking not found');
        return;
      }

      // Prevent actions on cancelled_by_user bookings
      if (booking.status === 'cancelled_by_user') {
        showToast('This booking was cancelled by the customer');
        return;
      }

      const updateData: any = {
        status: payload.status,
        updated_at: new Date().toISOString(),
      };

      // Add note to the appropriate field based on action
      if (payload.note) {
        if (payload.status === 'declined_by_restaurant') {
          updateData.decline_note = payload.note;
          updateData.declined_at = new Date().toISOString();
        } else if (payload.status === 'cancelled_by_restaurant') {
          updateData.cancellation_note = payload.note;
          updateData.cancelled_at = new Date().toISOString();
        }
      }

      // Set timestamps for status changes
      if (payload.status === 'declined_by_restaurant' && !updateData.declined_at) {
        updateData.declined_at = new Date().toISOString();
      } else if (payload.status === 'cancelled_by_restaurant' && !updateData.cancelled_at) {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', payload.bookingId);

      if (error) throw error;

      showToast('Booking updated successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    } catch (error) {
      console.error('Error updating booking:', error);
      showToast('Failed to update booking');
    }
  };

  const handleAccept = (bookingId: string) => {
    markBookingHandled(bookingId);
    removePendingBooking(bookingId); // Stop persistent notifications
    updateBooking({ bookingId, status: 'confirmed' });
    
    // Update badge count
    const pendingCount = bookings.filter(b => b.status === 'pending' && b.id !== bookingId).length;
    setBadgeCount(pendingCount);
  };

  const handleDecline = (bookingId: string, note?: string) => {
    markBookingHandled(bookingId);
    removePendingBooking(bookingId); // Stop persistent notifications
    updateBooking({ bookingId, status: 'declined_by_restaurant', note });
    
    // Update badge count
    const pendingCount = bookings.filter(b => b.status === 'pending' && b.id !== bookingId).length;
    setBadgeCount(pendingCount);
  };

  const handleComplete = (bookingId: string) => {
    updateBooking({ bookingId, status: 'completed' });
  };

  const handleNoShow = (bookingId: string) => {
    updateBooking({ bookingId, status: 'no_show' });
  };

  const handleCancel = (bookingId: string, note?: string) => {
    updateBooking({ bookingId, status: 'cancelled_by_restaurant', note });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    setRefreshing(false);
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  if (!restaurant) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <MaterialIcons name="store" size={64} color="#d9c3db" />
        <Text className="text-primary text-lg font-semibold mt-4">
          No restaurant found
        </Text>
        <Text className="text-gray text-center px-8 mt-2">
          Please make sure your restaurant is set up properly.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-12 pb-4 px-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-background">Bookings</Text>
            <Text className="text-background/80 mt-1">
              Manage your reservation requests
            </Text>
          </View>
          <View className="flex-row gap-2 items-center">
            {/* Battery Optimization Indicator */}
            {isOptimized && Platform.OS === 'android' && (
              <TouchableOpacity
                className="bg-orange-500/30 rounded-full px-2 py-1 flex-row items-center gap-1"
                onPress={showBatteryOptimizationGuide}
              >
                <MaterialIcons name="battery-alert" size={12} color="#ffece2" />
                <Text className="text-background text-xs">Battery</Text>
              </TouchableOpacity>
            )}

            {/* Background Service Indicator */}
            {isServiceRunning && (
              <View className="bg-green-500/30 rounded-full px-2 py-1 flex-row items-center gap-1">
                <View className="w-2 h-2 rounded-full bg-green-400" />
                <Text className="text-background text-xs">Service Active</Text>
              </View>
            )}

            {/* Persistent Notifications Status */}
            {isBackgroundTaskRegistered && (
              <View className="bg-blue-500/30 rounded-full px-2 py-1 flex-row items-center gap-1">
                <MaterialIcons name="notifications-active" size={12} color="#ffece2" />
                <Text className="text-background text-xs">Alerts On</Text>
              </View>
            )}

            {/* Connection Status Indicator */}
            <TouchableOpacity
              className={`rounded-full p-2 ${isConnected ? 'bg-green-500/30' : 'bg-red-500/30'}`}
              onPress={forceReconnect}
            >
              <View className="flex-row items-center gap-1">
                <View 
                  className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <MaterialIcons 
                  name={isConnected ? "wifi" : "wifi-off"} 
                  size={16} 
                  color="#ffece2" 
                />
              </View>
            </TouchableOpacity>

            {/* Test Sound Buttons - Remove after testing */}
            <TouchableOpacity
              className="bg-green-500 rounded-full p-2"
              onPress={() => {
                console.log('🧪 Manual sound test triggered');
                playSound('test-booking-id');
              }}
            >
              <MaterialIcons name="volume-up" size={20} color="#ffece2" />
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-red-500 rounded-full p-2"
              onPress={() => {
                console.log('🛑 Manual stop sound triggered');
                stopSound();
              }}
            >
              <MaterialIcons name="volume-off" size={20} color="#ffece2" />
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-background/20 rounded-full p-2"
              onPress={() => setShowAnalytics(!showAnalytics)}
            >
              <MaterialIcons 
                name={showAnalytics ? "expand-less" : "expand-more"} 
                size={24} 
                color="#ffece2" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Compact Analytics Summary */}
        {!showAnalytics && (
          <View className="flex-row justify-between mt-4 bg-background/10 rounded-xl p-3">
            <View className="items-center">
              <Text className="text-background/70 text-xs">Pending</Text>
              <Text className="text-background font-bold text-lg">{analytics.pending}</Text>
            </View>
            <View className="items-center">
              <Text className="text-background/70 text-xs">Accepted</Text>
              <Text className="text-background font-bold text-lg">{analytics.accepted}</Text>
            </View>
            <View className="items-center">
              <Text className="text-background/70 text-xs">Completed</Text>
              <Text className="text-background font-bold text-lg">{analytics.completed}</Text>
            </View>
            <View className="items-center">
              <Text className="text-background/70 text-xs">Total</Text>
              <Text className="text-background font-bold text-lg">
                {analytics.pending + analytics.accepted + analytics.declined + analytics.completed + analytics.cancelled}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Expanded Analytics Cards */}
      {showAnalytics && (
        <AnalyticsCards
          pending={analytics.pending}
          cancelled={analytics.cancelled}
          accepted={analytics.accepted}
          declined={analytics.declined}
          completed={analytics.completed}
        />
      )}

      {/* Filters */}
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

      {/* Bookings List */}
      <ScrollView
        className="flex-1 px-6 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#792339" />
            <Text className="text-gray mt-4">Loading bookings...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View className="py-12 items-center">
            <MaterialIcons name="event-available" size={64} color="#d9c3db" />
            <Text className="text-primary text-lg font-semibold mt-4">
              No bookings found
            </Text>
            <Text className="text-gray text-center px-8 mt-2">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : statusFilter !== 'all'
                ? 'No bookings with this status'
                : 'You don\'t have any bookings yet'}
            </Text>
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
