import { supabase } from '@/lib/supabase';
import { startBookingStatusMonitor, stopBookingStatusMonitor } from '@/services/booking-status-monitor';
import { Restaurant } from '@/types/database';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

interface RestaurantContextType {
  restaurant: Restaurant | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First, get the restaurant_id from restaurant_staff where user is owner
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .eq('is_active', true)
        .single();

      if (staffError) {
        console.error('Error fetching staff data:', staffError);
        setRestaurant(null);
        setLoading(false);
        return;
      }

      if (!staffData?.restaurant_id) {
        console.log('No restaurant found for user');
        setRestaurant(null);
        setLoading(false);
        return;
      }

      // Then fetch the restaurant details
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', staffData.restaurant_id)
        .single();

      if (error) {
        console.error('Error fetching restaurant:', error);
        setRestaurant(null);
      } else {
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      setRestaurant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurant();
  }, [user]);

  // Start/Stop global booking status monitor
  useEffect(() => {
    if (restaurant?.id) {
      startBookingStatusMonitor(restaurant.id);
    } else {
      stopBookingStatusMonitor();
    }
    return () => stopBookingStatusMonitor();
  }, [restaurant?.id]);

  const value = {
    restaurant,
    loading,
    refetch: fetchRestaurant,
  };

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}

