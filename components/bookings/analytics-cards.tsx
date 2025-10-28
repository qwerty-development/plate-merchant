import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface AnalyticsCardsProps {
  pending: number;
  cancelled: number;
  accepted: number;
  declined: number;
  completed: number;
}

interface StatCardProps {
  label: string;
  count: number;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  backgroundColor: string;
  pulse?: boolean;
}

function StatCard({ label, count, icon, color, backgroundColor, pulse = false }: StatCardProps) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (pulse && count > 0) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [pulse, count]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle]}>
      <View 
        className="rounded-2xl p-4 border"
        style={{ backgroundColor, borderColor: color }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <MaterialIcons name={icon} size={24} color={color} />
          <Text className="text-3xl font-bold" style={{ color }}>
            {count}
          </Text>
        </View>
        <Text className="text-sm font-medium" style={{ color }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function AnalyticsCards({
  pending,
  cancelled,
  accepted,
  declined,
  completed,
}: AnalyticsCardsProps) {
  return (
    <View className="px-6 py-4">
      <View className="flex-row flex-wrap gap-3">
        {/* Pending - larger, full width */}
        <View className="w-full">
          <StatCard
            label="Pending"
            count={pending}
            icon="schedule"
            color="#f97316"
            backgroundColor="#fff7ed"
            pulse={true}
          />
        </View>
        
        {/* Other stats in 2-column grid */}
        <View className="flex-1" style={{ minWidth: '47%' }}>
          <StatCard
            label="Accepted"
            count={accepted}
            icon="check-circle"
            color="#16a34a"
            backgroundColor="#f0fdf4"
          />
        </View>
        
        <View className="flex-1" style={{ minWidth: '47%' }}>
          <StatCard
            label="Declined"
            count={declined}
            icon="cancel"
            color="#dc2626"
            backgroundColor="#fef2f2"
          />
        </View>
        
        <View className="flex-1" style={{ minWidth: '47%' }}>
          <StatCard
            label="Completed"
            count={completed}
            icon="done-all"
            color="#2563eb"
            backgroundColor="#eff6ff"
          />
        </View>
        
        <View className="flex-1" style={{ minWidth: '47%' }}>
          <StatCard
            label="Cancelled"
            count={cancelled}
            icon="block"
            color="#6b7280"
            backgroundColor="#f9fafb"
          />
        </View>
      </View>
    </View>
  );
}




