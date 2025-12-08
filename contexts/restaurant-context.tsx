import { supabase } from '@/lib/supabase';
import { startBookingStatusMonitor, stopBookingStatusMonitor } from '@/services/booking-status-monitor';
import { Restaurant } from '@/types/database';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

const SELECTED_RESTAURANT_KEY = 'selected_restaurant_id';

interface RestaurantContextType {
  restaurant: Restaurant | null;
  restaurants: Restaurant[];
  loading: boolean;
  refetch: () => Promise<void>;
  selectRestaurant: (restaurantId: string) => Promise<void>;
  refetchRestaurants: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all restaurants for the user (without setting selected)
  const fetchRestaurants = async () => {
    if (!user) {
      setRestaurants([]);
      return;
    }

    try {
      // Get all restaurant_ids from restaurant_staff where user is owner
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .eq('is_active', true);

      if (staffError) {
        console.error('Error fetching staff data:', staffError);
        setRestaurants([]);
        return;
      }

      if (!staffData || staffData.length === 0) {
        console.log('No restaurants found for user');
        setRestaurants([]);
        return;
      }

      // Fetch all restaurant details
      const restaurantIds = staffData.map(s => s.restaurant_id);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', restaurantIds)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching restaurants:', error);
        setRestaurants([]);
      } else {
        setRestaurants(data || []);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setRestaurants([]);
    }
  };

  // Fetch the selected restaurant
  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First fetch all restaurants
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .eq('is_active', true);

      if (staffError) {
        console.error('Error fetching staff data:', staffError);
        setRestaurants([]);
        setRestaurant(null);
        setLoading(false);
        return;
      }

      if (!staffData || staffData.length === 0) {
        console.log('No restaurants found for user');
        setRestaurants([]);
        setRestaurant(null);
        setLoading(false);
        return;
      }

      // Fetch all restaurant details
      const restaurantIds = staffData.map(s => s.restaurant_id);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', restaurantIds)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching restaurants:', error);
        setRestaurants([]);
        setRestaurant(null);
        setLoading(false);
        return;
      }

      const fetchedRestaurants = data || [];
      setRestaurants(fetchedRestaurants);

      // Get selected restaurant ID from storage
      const selectedId = await SecureStore.getItemAsync(SELECTED_RESTAURANT_KEY);
      
      let selected: Restaurant | null = null;
      if (selectedId) {
        // Find the selected restaurant in the list
        selected = fetchedRestaurants.find(r => r.id === selectedId) || null;
      }

      // If no selection or selection not found, use first restaurant
      if (!selected && fetchedRestaurants.length > 0) {
        selected = fetchedRestaurants[0];
        if (selected) {
          await SecureStore.setItemAsync(SELECTED_RESTAURANT_KEY, selected.id);
        }
      }

      setRestaurant(selected);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      setRestaurant(null);
    } finally {
      setLoading(false);
    }
  };

  // Select a restaurant
  const selectRestaurant = React.useCallback(async (restaurantId: string) => {
    try {
      const selected = restaurants.find(r => r.id === restaurantId);
      if (selected) {
        await SecureStore.setItemAsync(SELECTED_RESTAURANT_KEY, restaurantId);
        setRestaurant(selected);
        console.log('✅ Restaurant selected:', selected.name);
      }
    } catch (error) {
      console.error('Error selecting restaurant:', error);
    }
  }, [restaurants]);

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
    restaurants,
    loading,
    refetch: fetchRestaurant,
    selectRestaurant,
    refetchRestaurants: fetchRestaurants,
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

