import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import endOfDay from 'date-fns/endOfDay';
import endOfMonth from 'date-fns/endOfMonth';
import endOfWeek from 'date-fns/endOfWeek';
import format from 'date-fns/format';
import startOfDay from 'date-fns/startOfDay';
import startOfMonth from 'date-fns/startOfMonth';
import startOfWeek from 'date-fns/startOfWeek';
import React, { useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface FilterControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
}

const STATUS_OPTIONS = [
  { label: 'All Status', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled by Customer', value: 'cancelled_by_customer' },
  { label: 'Cancelled by Restaurant', value: 'cancelled_by_restaurant' },
  { label: 'Declined', value: 'declined_by_restaurant' },
  { label: 'No Show', value: 'no_show' },
];

export default function FilterControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: FilterControlsProps) {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  const handleDateFilterPress = (filter: DateFilter) => {
    onDateFilterChange(filter);
    
    const today = new Date();
    
    switch (filter) {
      case 'today':
        onStartDateChange(startOfDay(today));
        onEndDateChange(endOfDay(today));
        break;
      case 'week':
        onStartDateChange(startOfWeek(today));
        onEndDateChange(endOfWeek(today));
        break;
      case 'month':
        onStartDateChange(startOfMonth(today));
        onEndDateChange(endOfMonth(today));
        break;
      case 'all':
        onStartDateChange(startOfDay(today));
        onEndDateChange(new Date('2099-12-31'));
        break;
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }
    
    if (event.type === 'set' && selectedDate) {
      if (showDatePicker === 'start') {
        onStartDateChange(selectedDate);
      } else if (showDatePicker === 'end') {
        onEndDateChange(selectedDate);
      }
    }
  };

  const selectedStatusLabel = STATUS_OPTIONS.find(opt => opt.value === statusFilter)?.label || 'All Status';

  return (
    <View className="px-6 py-3">
      {/* Search Bar */}
      <View className="bg-white rounded-xl border border-lavender mb-3 flex-row items-center px-4 py-2">
        <MaterialIcons name="search" size={20} color="#787878" />
        <TextInput
          className="flex-1 ml-2 text-primary text-base"
          placeholder="Search by name, email, phone, or code..."
          placeholderTextColor="#d9c3db"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <MaterialIcons name="close" size={20} color="#787878" />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Filter Buttons */}
      <View className="mb-3">
        <Text className="text-gray text-sm mb-2 font-medium">Date Range</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${dateFilter === 'today' ? 'bg-primary' : 'bg-white border border-lavender'}`}
              onPress={() => handleDateFilterPress('today')}
            >
              <Text className={`${dateFilter === 'today' ? 'text-background' : 'text-primary'} font-medium`}>
                Today
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${dateFilter === 'week' ? 'bg-primary' : 'bg-white border border-lavender'}`}
              onPress={() => handleDateFilterPress('week')}
            >
              <Text className={`${dateFilter === 'week' ? 'text-background' : 'text-primary'} font-medium`}>
                This Week
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${dateFilter === 'month' ? 'bg-primary' : 'bg-white border border-lavender'}`}
              onPress={() => handleDateFilterPress('month')}
            >
              <Text className={`${dateFilter === 'month' ? 'text-background' : 'text-primary'} font-medium`}>
                This Month
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${dateFilter === 'all' ? 'bg-primary' : 'bg-white border border-lavender'}`}
              onPress={() => handleDateFilterPress('all')}
            >
              <Text className={`${dateFilter === 'all' ? 'text-background' : 'text-primary'} font-medium`}>
                All Dates
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ${dateFilter === 'custom' ? 'bg-primary' : 'bg-white border border-lavender'}`}
              onPress={() => {
                onDateFilterChange('custom');
                setShowDatePicker('start');
              }}
            >
              <Text className={`${dateFilter === 'custom' ? 'text-background' : 'text-primary'} font-medium`}>
                Custom Range
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Custom Date Range Display */}
      {dateFilter === 'custom' && startDate && endDate && (
        <View className="bg-accent/10 rounded-lg p-3 mb-3 border border-accent/30">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-primary font-medium">Start Date:</Text>
            <TouchableOpacity
              className="bg-white rounded-lg px-3 py-2 border border-lavender"
              onPress={() => setShowDatePicker('start')}
            >
              <Text className="text-primary">{format(startDate, 'MMM d, yyyy')}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-primary font-medium">End Date:</Text>
            <TouchableOpacity
              className="bg-white rounded-lg px-3 py-2 border border-lavender"
              onPress={() => setShowDatePicker('end')}
            >
              <Text className="text-primary">{format(endDate, 'MMM d, yyyy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status Filter */}
      <View className="mb-2">
        <Text className="text-gray text-sm mb-2 font-medium">Status</Text>
        <TouchableOpacity
          className="bg-white rounded-xl border border-lavender px-4 py-3 flex-row items-center justify-between"
          onPress={() => setShowStatusModal(true)}
        >
          <Text className="text-primary text-base font-medium">{selectedStatusLabel}</Text>
          <MaterialIcons name="arrow-drop-down" size={24} color="#792339" />
        </TouchableOpacity>
      </View>

      {/* Status Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View className="bg-white rounded-2xl w-4/5 max-h-96">
            <View className="border-b border-lavender p-4">
              <Text className="text-primary text-lg font-bold">Filter by Status</Text>
            </View>
            <ScrollView className="max-h-80">
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`p-4 border-b border-lavender/30 ${statusFilter === option.value ? 'bg-primary/5' : ''}`}
                  onPress={() => {
                    onStatusFilterChange(option.value);
                    setShowStatusModal(false);
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base ${statusFilter === option.value ? 'text-primary font-semibold' : 'text-gray'}`}>
                      {option.label}
                    </Text>
                    {statusFilter === option.value && (
                      <MaterialIcons name="check" size={24} color="#792339" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={showDatePicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

