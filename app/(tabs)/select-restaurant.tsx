import { useRestaurant } from '@/contexts/restaurant-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SelectRestaurantScreen() {
  const { restaurants, restaurant, loading, selectRestaurant } = useRestaurant();
  const router = useRouter();
  const hasAutoSelectedRef = React.useRef(false);

  // If only one restaurant, auto-select it (only once)
  useEffect(() => {
    if (!loading && restaurants.length === 1 && !restaurant && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;
      selectRestaurant(restaurants[0].id).then(() => {
        router.replace('/(tabs)/bookings');
      });
    }
  }, [restaurants.length, loading, restaurant]);

  const isNavigatingRef = useRef(false);
  
  const handleSelectRestaurant = async (restaurantId: string) => {
    if (isNavigatingRef.current) return; // Prevent double-tap
    isNavigatingRef.current = true;
    
    try {
      await selectRestaurant(restaurantId);
      // Small delay to ensure state is updated
      setTimeout(() => {
        router.replace('/(tabs)/bookings');
      }, 100);
    } catch (error) {
      console.error('Error selecting restaurant:', error);
      isNavigatingRef.current = false;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#792339" />
        <Text className="text-gray mt-4">Loading restaurants...</Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <MaterialIcons name="restaurant" size={64} color="#d9c3db" />
        <Text className="text-primary text-xl font-bold mt-4 text-center">
          No Restaurants Found
        </Text>
        <Text className="text-gray text-center mt-2 px-8">
          You don&apos;t have access to any restaurants yet. Please contact support.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-6">
        <Text className="text-3xl font-bold text-background">Select Restaurant</Text>
        <Text className="text-background/80 mt-1">
          Choose which restaurant to manage
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        {restaurants.map((r) => (
          <TouchableOpacity
            key={r.id}
            onPress={() => handleSelectRestaurant(r.id)}
            className={`bg-white rounded-2xl p-4 mb-4 border-2 ${
              restaurant?.id === r.id
                ? 'border-primary'
                : 'border-lavender'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-primary text-xl font-bold">
                    {r.name}
                  </Text>
                  {restaurant?.id === r.id && (
                    <View className="bg-primary rounded-full px-2 py-1">
                      <Text className="text-background text-xs font-semibold">
                        ACTIVE
                      </Text>
                    </View>
                  )}
                </View>
                {r.description && (
                  <Text className="text-gray text-sm mt-1" numberOfLines={2}>
                    {r.description}
                  </Text>
                )}
                {r.address && (
                  <View className="flex-row items-center mt-2">
                    <MaterialIcons name="location-on" size={16} color="#787878" />
                    <Text className="text-gray text-sm ml-1" numberOfLines={1}>
                      {r.address}
                    </Text>
                  </View>
                )}
                {r.cuisine_type && (
                  <View className="flex-row items-center mt-1">
                    <MaterialIcons name="restaurant-menu" size={16} color="#787878" />
                    <Text className="text-gray text-sm ml-1">
                      {r.cuisine_type}
                    </Text>
                  </View>
                )}
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={restaurant?.id === r.id ? '#792339' : '#787878'}
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
