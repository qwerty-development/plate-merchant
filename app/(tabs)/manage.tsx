import { useAuth } from '@/contexts/auth-context';
import { useRestaurant } from '@/contexts/restaurant-context';
import { supabase } from '@/lib/supabase';
import {
    FeaturesAmenitiesFormData,
    featuresAmenitiesSchema,
    GeneralInfoFormData,
    generalInfoSchema,
    OperationalSettingsFormData,
    operationalSettingsSchema,
} from '@/lib/validations';
import { DietaryOption } from '@/types/database';
import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';

type Section = 'general' | 'operational' | 'features' | null;

const CUISINE_OPTIONS = [
  'Lebanese',
  'Mediterranean',
  'Italian',
  'French',
  'Japanese',
  'Chinese',
  'Indian',
  'Mexican',
  'American',
  'Seafood',
  'Steakhouse',
  'Fusion',
  'Vegetarian',
  'Cafe',
];

const DIETARY_OPTIONS: DietaryOption[] = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Halal',
  'Kosher',
  'Dairy-free',
  'Nut-free',
];

export default function ManageScreen() {
  const { user, signOut } = useAuth();
  const { restaurant, restaurants, refetch } = useRestaurant();
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const [expandedSection, setExpandedSection] = useState<Section>(null);
  const [savingSection, setSavingSection] = useState<Section>(null);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [selectedDietaryOptions, setSelectedDietaryOptions] = useState<DietaryOption[]>(
    restaurant?.dietary_options || []
  );

  // General Info Form
  const generalInfoForm = useForm<GeneralInfoFormData>({
    resolver: zodResolver(generalInfoSchema),
    defaultValues: {
      name: restaurant?.name || '',
      description: restaurant?.description || '',
      address: restaurant?.address || '',
      phone_number: restaurant?.phone_number || '',
      whatsapp_number: restaurant?.whatsapp_number || '',
      website_url: restaurant?.website_url || '',
      instagram_handle: restaurant?.instagram_handle || '',
    },
  });

  // Operational Settings Form
  const operationalForm = useForm<OperationalSettingsFormData>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: {
      booking_window: restaurant?.booking_window || 30,
      cancellation_window: restaurant?.cancellation_window || 24,
      table_turnover_time: restaurant?.table_turnover_time || 90,
      booking_policy: restaurant?.booking_policy || 'instant',
      minimum_age: restaurant?.minimum_age || null,
    },
  });

  // Features & Amenities Form
  const featuresForm = useForm<FeaturesAmenitiesFormData>({
    resolver: zodResolver(featuresAmenitiesSchema),
    defaultValues: {
      price_range: restaurant?.price_range || 2,
      cuisine_type: restaurant?.cuisine_type || null,
      dietary_options: restaurant?.dietary_options || [],
      parking_available: restaurant?.parking_available || false,
      valet_parking: restaurant?.valet_parking || false,
      outdoor_seating: restaurant?.outdoor_seating || false,
      shisha_available: restaurant?.shisha_available || false,
    },
  });

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert('', message);
    }
  };

  const toggleSection = (section: Section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const onSaveGeneralInfo = async (data: GeneralInfoFormData) => {
    if (!restaurant?.id) return;

    try {
      setSavingSection('general');

      const { error } = await supabase
        .from('restaurants')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);

      if (error) throw error;

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      showToast('General information updated successfully');
      setExpandedSection(null);
    } catch (error) {
      console.error('Error updating general info:', error);
      showToast('Failed to update general information');
    } finally {
      setSavingSection(null);
    }
  };

  const onSaveOperational = async (data: OperationalSettingsFormData) => {
    if (!restaurant?.id) return;

    try {
      setSavingSection('operational');

      const { error } = await supabase
        .from('restaurants')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);

      if (error) throw error;

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      showToast('Operational settings updated successfully');
      setExpandedSection(null);
    } catch (error) {
      console.error('Error updating operational settings:', error);
      showToast('Failed to update operational settings');
    } finally {
      setSavingSection(null);
    }
  };

  const onSaveFeatures = async (data: FeaturesAmenitiesFormData) => {
    if (!restaurant?.id) return;

    try {
      setSavingSection('features');

      const { error } = await supabase
        .from('restaurants')
        .update({
          ...data,
          dietary_options: selectedDietaryOptions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);

      if (error) throw error;

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      showToast('Features & amenities updated successfully');
      setExpandedSection(null);
    } catch (error) {
      console.error('Error updating features:', error);
      showToast('Failed to update features & amenities');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  if (!restaurant) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#792339" />
        <Text className="text-gray mt-4">Loading restaurant...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-6">
        <Text className="text-3xl font-bold text-background">Manage</Text>
        <Text className="text-background/80 mt-1">
          Restaurant settings and tools
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        {/* User Info Card */}
        <View className="bg-white rounded-2xl p-4 border border-lavender mb-4">
          <Text className="text-gray text-sm mb-1">Signed in as</Text>
          <Text className="text-primary text-base font-semibold">
            {user?.email}
          </Text>
          <Text className="text-primary text-lg font-bold mt-2">
            {restaurant.name}
          </Text>
        </View>

        {/* Restaurant Selector - Show if user has multiple restaurants */}
        {restaurants.length > 1 && (
          <View className="bg-white rounded-2xl border border-lavender mb-4 overflow-hidden">
            <TouchableOpacity
              className="p-4 flex-row items-center justify-between"
              onPress={() => router.push('/(tabs)/select-restaurant')}
            >
              <View className="flex-row items-center flex-1">
                <MaterialIcons name="store" size={24} color="#792339" />
                <View className="ml-3 flex-1">
                  <Text className="text-primary text-lg font-semibold">
                    Switch Restaurant
                  </Text>
                  <Text className="text-gray text-sm mt-1">
                    {restaurants.length} restaurant{restaurants.length > 1 ? 's' : ''} available
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#787878" />
            </TouchableOpacity>
          </View>
        )}

        {/* General Information Section */}
        <View className="bg-white rounded-2xl border border-lavender mb-4 overflow-hidden">
          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={() => toggleSection('general')}
          >
            <View className="flex-row items-center flex-1">
              <MaterialIcons name="info" size={24} color="#792339" />
              <Text className="text-primary text-lg font-semibold ml-3">
                General Information
              </Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'general' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#792339"
            />
          </TouchableOpacity>

          {expandedSection === 'general' && (
            <View className="px-4 pb-4 border-t border-lavender/30">
              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Restaurant Name *
                </Text>
                <Controller
                  control={generalInfoForm.control}
                  name="name"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value}
                        onChangeText={onChange}
                        placeholder="Enter restaurant name"
                        placeholderTextColor="#d9c3db"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">Description</Text>
                <Controller
                  control={generalInfoForm.control}
                  name="description"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-background border border-lavender rounded-xl p-4 text-primary"
                      value={value || ''}
                      onChangeText={onChange}
                      placeholder="Describe your restaurant"
                      placeholderTextColor="#d9c3db"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">Address *</Text>
                <Controller
                  control={generalInfoForm.control}
                  name="address"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value}
                        onChangeText={onChange}
                        placeholder="Enter full address"
                        placeholderTextColor="#d9c3db"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">Phone Number</Text>
                <Controller
                  control={generalInfoForm.control}
                  name="phone_number"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row items-center bg-background border border-lavender rounded-xl px-4">
                      <MaterialIcons name="phone" size={20} color="#787878" />
                      <TextInput
                        className="flex-1 p-4 text-primary"
                        value={value || ''}
                        onChangeText={onChange}
                        placeholder="Enter phone number"
                        placeholderTextColor="#d9c3db"
                        keyboardType="phone-pad"
                      />
                    </View>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">WhatsApp Number</Text>
                <Controller
                  control={generalInfoForm.control}
                  name="whatsapp_number"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row items-center bg-background border border-lavender rounded-xl px-4">
                      <MaterialIcons name="phone" size={20} color="#25D366" />
                      <TextInput
                        className="flex-1 p-4 text-primary"
                        value={value || ''}
                        onChangeText={onChange}
                        placeholder="Enter WhatsApp number"
                        placeholderTextColor="#d9c3db"
                        keyboardType="phone-pad"
                      />
                    </View>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">Website URL</Text>
                <Controller
                  control={generalInfoForm.control}
                  name="website_url"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <View className="flex-row items-center bg-background border border-lavender rounded-xl px-4">
                        <MaterialIcons name="language" size={20} color="#787878" />
                        <TextInput
                          className="flex-1 p-4 text-primary"
                          value={value || ''}
                          onChangeText={onChange}
                          placeholder="https://example.com"
                          placeholderTextColor="#d9c3db"
                          keyboardType="url"
                          autoCapitalize="none"
                        />
                      </View>
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Instagram Handle
                </Text>
                <Controller
                  control={generalInfoForm.control}
                  name="instagram_handle"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row items-center bg-background border border-lavender rounded-xl px-4">
                      <Text className="text-gray font-semibold">@</Text>
                      <TextInput
                        className="flex-1 p-4 text-primary"
                        value={value || ''}
                        onChangeText={onChange}
                        placeholder="username"
                        placeholderTextColor="#d9c3db"
                        autoCapitalize="none"
                      />
                    </View>
                  )}
                />
              </View>

              <TouchableOpacity
                className="bg-primary rounded-xl py-4 items-center mt-4"
                onPress={generalInfoForm.handleSubmit(onSaveGeneralInfo)}
                disabled={savingSection === 'general'}
              >
                {savingSection === 'general' ? (
                  <ActivityIndicator color="#ffece2" />
                ) : (
                  <Text className="text-background font-semibold text-base">
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Operational Settings Section */}
        <View className="bg-white rounded-2xl border border-lavender mb-4 overflow-hidden">
          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={() => toggleSection('operational')}
          >
            <View className="flex-row items-center flex-1">
              <MaterialIcons name="settings" size={24} color="#792339" />
              <Text className="text-primary text-lg font-semibold ml-3">
                Operational Settings
              </Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'operational' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#792339"
            />
          </TouchableOpacity>

          {expandedSection === 'operational' && (
            <View className="px-4 pb-4 border-t border-lavender/30">
              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Booking Window (days) *
                </Text>
                <Text className="text-gray text-xs mb-2">
                  How far in advance can customers book?
                </Text>
                <Controller
                  control={operationalForm.control}
                  name="booking_window"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value?.toString() || ''}
                        onChangeText={(text) => onChange(parseInt(text) || 1)}
                        placeholder="30"
                        placeholderTextColor="#d9c3db"
                        keyboardType="number-pad"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Cancellation Window (hours) *
                </Text>
                <Text className="text-gray text-xs mb-2">
                  How far in advance can customers cancel?
                </Text>
                <Controller
                  control={operationalForm.control}
                  name="cancellation_window"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value?.toString() || ''}
                        onChangeText={(text) => onChange(parseInt(text) || 1)}
                        placeholder="24"
                        placeholderTextColor="#d9c3db"
                        keyboardType="number-pad"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Table Turnover Time (minutes) *
                </Text>
                <Text className="text-gray text-xs mb-2">
                  Average dining duration
                </Text>
                <Controller
                  control={operationalForm.control}
                  name="table_turnover_time"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value?.toString() || ''}
                        onChangeText={(text) => onChange(parseInt(text) || 30)}
                        placeholder="90"
                        placeholderTextColor="#d9c3db"
                        keyboardType="number-pad"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Booking Policy *
                </Text>
                <Controller
                  control={operationalForm.control}
                  name="booking_policy"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className={`flex-1 py-3 rounded-xl border-2 items-center ${
                          value === 'instant'
                            ? 'bg-primary border-primary'
                            : 'bg-white border-lavender'
                        }`}
                        onPress={() => onChange('instant')}
                      >
                        <Text
                          className={`font-semibold ${
                            value === 'instant' ? 'text-background' : 'text-primary'
                          }`}
                        >
                          Instant
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`flex-1 py-3 rounded-xl border-2 items-center ${
                          value === 'request'
                            ? 'bg-primary border-primary'
                            : 'bg-white border-lavender'
                        }`}
                        onPress={() => onChange('request')}
                      >
                        <Text
                          className={`font-semibold ${
                            value === 'request' ? 'text-background' : 'text-primary'
                          }`}
                        >
                          Request
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Minimum Age (optional)
                </Text>
                <Controller
                  control={operationalForm.control}
                  name="minimum_age"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                      <TextInput
                        className="bg-background border border-lavender rounded-xl p-4 text-primary"
                        value={value?.toString() || ''}
                        onChangeText={(text) => onChange(text ? parseInt(text) : null)}
                        placeholder="21"
                        placeholderTextColor="#d9c3db"
                        keyboardType="number-pad"
                      />
                      {error && (
                        <Text className="text-red-500 text-sm mt-1">{error.message}</Text>
                      )}
                    </>
                  )}
                />
              </View>

              <TouchableOpacity
                className="bg-primary rounded-xl py-4 items-center mt-4"
                onPress={operationalForm.handleSubmit(onSaveOperational)}
                disabled={savingSection === 'operational'}
              >
                {savingSection === 'operational' ? (
                  <ActivityIndicator color="#ffece2" />
                ) : (
                  <Text className="text-background font-semibold text-base">
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Features & Amenities Section */}
        <View className="bg-white rounded-2xl border border-lavender mb-4 overflow-hidden">
          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={() => toggleSection('features')}
          >
            <View className="flex-row items-center flex-1">
              <MaterialIcons name="star" size={24} color="#792339" />
              <Text className="text-primary text-lg font-semibold ml-3">
                Features & Amenities
              </Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'features' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#792339"
            />
          </TouchableOpacity>

          {expandedSection === 'features' && (
            <View className="px-4 pb-4 border-t border-lavender/30">
              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Price Range *
                </Text>
                <Controller
                  control={featuresForm.control}
                  name="price_range"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row justify-between">
                      {[1, 2, 3, 4].map((level) => (
                        <TouchableOpacity
                          key={level}
                          className={`flex-1 mx-1 py-3 rounded-xl border-2 items-center ${
                            value === level
                              ? 'bg-primary border-primary'
                              : 'bg-white border-lavender'
                          }`}
                          onPress={() => onChange(level)}
                        >
                          <Text
                            className={`font-bold text-lg ${
                              value === level ? 'text-background' : 'text-primary'
                            }`}
                          >
                            {'$'.repeat(level)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">Cuisine Type</Text>
                <Controller
                  control={featuresForm.control}
                  name="cuisine_type"
                  render={({ field: { onChange, value } }) => (
                    <TouchableOpacity
                      className="bg-background border border-lavender rounded-xl p-4 flex-row items-center justify-between"
                      onPress={() => setShowCuisineModal(true)}
                    >
                      <Text className="text-primary">
                        {value || 'Select cuisine type'}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#792339" />
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-2 font-medium">
                  Dietary Options
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      className={`px-4 py-2 rounded-xl border ${
                        selectedDietaryOptions.includes(option)
                          ? 'bg-primary border-primary'
                          : 'bg-white border-lavender'
                      }`}
                      onPress={() => {
                        if (selectedDietaryOptions.includes(option)) {
                          setSelectedDietaryOptions(
                            selectedDietaryOptions.filter((o) => o !== option)
                          );
                        } else {
                          setSelectedDietaryOptions([...selectedDietaryOptions, option]);
                        }
                      }}
                    >
                      <Text
                        className={`font-medium ${
                          selectedDietaryOptions.includes(option)
                            ? 'text-background'
                            : 'text-primary'
                        }`}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="py-4">
                <Text className="text-gray text-sm mb-3 font-medium">Amenities</Text>

                <View className="space-y-3">
                  <Controller
                    control={featuresForm.control}
                    name="parking_available"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row items-center justify-between py-2">
                        <Text className="text-primary font-medium">Parking Available</Text>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: '#d9c3db', true: '#F2b25f' }}
                          thumbColor={value ? '#792339' : '#f4f3f4'}
                        />
                      </View>
                    )}
                  />

                  <Controller
                    control={featuresForm.control}
                    name="valet_parking"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row items-center justify-between py-2">
                        <Text className="text-primary font-medium">Valet Parking</Text>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: '#d9c3db', true: '#F2b25f' }}
                          thumbColor={value ? '#792339' : '#f4f3f4'}
                        />
                      </View>
                    )}
                  />

                  <Controller
                    control={featuresForm.control}
                    name="outdoor_seating"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row items-center justify-between py-2">
                        <Text className="text-primary font-medium">Outdoor Seating</Text>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: '#d9c3db', true: '#F2b25f' }}
                          thumbColor={value ? '#792339' : '#f4f3f4'}
                        />
                      </View>
                    )}
                  />

                  <Controller
                    control={featuresForm.control}
                    name="shisha_available"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row items-center justify-between py-2">
                        <Text className="text-primary font-medium">Shisha Available</Text>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: '#d9c3db', true: '#F2b25f' }}
                          thumbColor={value ? '#792339' : '#f4f3f4'}
                        />
                      </View>
                    )}
                  />
                </View>
              </View>

              <TouchableOpacity
                className="bg-primary rounded-xl py-4 items-center mt-4"
                onPress={featuresForm.handleSubmit(onSaveFeatures)}
                disabled={savingSection === 'features'}
              >
                {savingSection === 'features' ? (
                  <ActivityIndicator color="#ffece2" />
                ) : (
                  <Text className="text-background font-semibold text-base">
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center mb-8"
          onPress={handleSignOut}
        >
          <Text className="text-background text-base font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cuisine Type Modal */}
      <Modal
        visible={showCuisineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowCuisineModal(false)}
        >
          <View className="bg-white rounded-2xl w-4/5 max-h-96">
            <View className="border-b border-lavender p-4">
              <Text className="text-primary text-lg font-bold">Select Cuisine Type</Text>
            </View>
            <ScrollView className="max-h-80">
              {CUISINE_OPTIONS.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine}
                  className="p-4 border-b border-lavender/30"
                  onPress={() => {
                    featuresForm.setValue('cuisine_type', cuisine as any);
                    setShowCuisineModal(false);
                  }}
                >
                  <Text className="text-primary text-base">{cuisine}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
