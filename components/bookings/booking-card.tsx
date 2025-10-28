import { formatBookingDate, formatBookingTime, getElapsedTime, getStatusColor, getStatusDisplayName } from '@/lib/utils';
import { Booking } from '@/types/database';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface BookingCardProps {
  booking: Booking;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string, note?: string) => void;
  onComplete: (bookingId: string) => void;
  onNoShow: (bookingId: string) => void;
  onCancel: (bookingId: string, note?: string) => void;
}

export default function BookingCard({
  booking,
  onAccept,
  onDecline,
  onComplete,
  onNoShow,
  onCancel,
}: BookingCardProps) {
  const [elapsedTime, setElapsedTime] = useState(getElapsedTime(booking.created_at));
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteAction, setNoteAction] = useState<'decline' | 'cancel' | null>(null);
  const [note, setNote] = useState('');

  const statusColor = getStatusColor(booking.status);
  const statusDisplay = getStatusDisplayName(booking.status);
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';
  const isCancelledByUser = booking.status === 'cancelled_by_user';

  // Update elapsed time every second for pending bookings
  useEffect(() => {
    if (!isPending) return;

    const interval = setInterval(() => {
      setElapsedTime(getElapsedTime(booking.created_at));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPending, booking.created_at]);

  const handlePhonePress = () => {
    const phone = booking.guest_phone || booking.profiles?.phone_number;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmailPress = () => {
    const email = booking.guest_email || booking.profiles?.email;
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const handleDeclinePress = () => {
    setNoteAction('decline');
    setNote('');
    setShowNoteModal(true);
  };

  const handleCancelPress = () => {
    setNoteAction('cancel');
    setNote('');
    setShowNoteModal(true);
  };

  const handleNoteSubmit = () => {
    setShowNoteModal(false);
    
    if (noteAction === 'decline') {
      onDecline(booking.id, note.trim() || undefined);
    } else if (noteAction === 'cancel') {
      onCancel(booking.id, note.trim() || undefined);
    }
    
    setNote('');
    setNoteAction(null);
  };

  const handleNoShowPress = () => {
    Alert.alert(
      'Mark as No Show',
      'Are you sure you want to mark this booking as a no-show?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: () => onNoShow(booking.id) },
      ]
    );
  };

  return (
    <>
      <View 
        className="bg-white rounded-2xl p-4 mb-4 border-2"
        style={{ borderColor: isPending ? statusColor : '#d9c3db' }}
      >
        {/* Header Section */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            {/* Status Badge */}
            <View className="flex-row items-center mb-2">
              <View 
                className="px-3 py-1 rounded-full flex-row items-center"
                style={{ backgroundColor: statusColor + '20' }}
              >
                <MaterialIcons 
                  name={
                    isPending ? 'schedule' :
                    booking.status === 'confirmed' ? 'check-circle' :
                    booking.status === 'completed' ? 'done-all' :
                    'cancel'
                  } 
                  size={16} 
                  color={statusColor} 
                />
                <Text className="font-semibold ml-1" style={{ color: statusColor }}>
                  {statusDisplay}
                </Text>
              </View>
              {isPending && (
                <Text className="text-gray text-xs ml-2">{elapsedTime}</Text>
              )}
            </View>

            {/* Customer Name */}
            <Text className="text-primary text-xl font-bold">
              {booking.guest_name || booking.profiles?.full_name || 'Guest'}
            </Text>
            
            {/* Customer Rating */}
            {booking.profiles?.user_rating != null && booking.profiles.user_rating < 5.0 && (
              <View className="flex-row items-center mt-1">
                <MaterialIcons name="star" size={16} color="#F2b25f" />
                <Text className="text-gray text-sm ml-1">
                  {booking.profiles.user_rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Confirmation Code */}
          <View className="bg-lavender/30 px-3 py-1 rounded-lg">
            <Text className="text-primary text-xs font-mono font-semibold">
              {booking.confirmation_code}
            </Text>
          </View>
        </View>

        {/* Contact Information */}
        <View className="mb-3">
          {(booking.guest_phone || booking.profiles?.phone_number) && (
            <TouchableOpacity 
              className="flex-row items-center mb-2"
              onPress={handlePhonePress}
            >
              <MaterialIcons name="phone" size={16} color="#787878" />
              <Text className="text-primary ml-2 underline">
                {booking.guest_phone || booking.profiles?.phone_number}
              </Text>
            </TouchableOpacity>
          )}
          
          {(booking.guest_email || booking.profiles?.email) && (
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={handleEmailPress}
            >
              <MaterialIcons name="email" size={16} color="#787878" />
              <Text className="text-primary ml-2 underline">
                {booking.guest_email || booking.profiles?.email}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Booking Details */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          <View className="flex-1 min-w-[45%] bg-background rounded-lg p-3 border border-lavender">
            <Text className="text-gray text-xs mb-1">Date</Text>
            <Text className="text-primary font-semibold">
              {formatBookingDate(booking.booking_time)}
            </Text>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-background rounded-lg p-3 border border-lavender">
            <Text className="text-gray text-xs mb-1">Time</Text>
            <Text className="text-primary font-semibold">
              {formatBookingTime(booking.booking_time)}
            </Text>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-background rounded-lg p-3 border border-lavender">
            <Text className="text-gray text-xs mb-1">Guests</Text>
            <Text className="text-primary font-semibold">
              {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
            </Text>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-background rounded-lg p-3 border border-lavender">
            <Text className="text-gray text-xs mb-1">Section</Text>
            <Text className="text-primary font-semibold">
              {booking.preferred_section || 'No preference'}
            </Text>
          </View>
        </View>

        {/* Additional Details */}
        {booking.occasion && (
          <View className="mb-2">
            <Text className="text-gray text-sm">
              <Text className="font-semibold">Occasion: </Text>
              {booking.occasion}
            </Text>
          </View>
        )}

        {booking.table_preferences && (
          <View className="mb-2">
            <Text className="text-gray text-sm">
              <Text className="font-semibold">Table Preference: </Text>
              {booking.table_preferences}
            </Text>
          </View>
        )}

        {booking.special_requests && (
          <View className="mb-2 bg-accent/10 rounded-lg p-3">
            <Text className="text-primary text-sm">
              <Text className="font-semibold">Special Request: </Text>
              {booking.special_requests}
            </Text>
          </View>
        )}

        {booking.dietary_notes && booking.dietary_notes.length > 0 && (
          <View className="mb-2 flex-row flex-wrap gap-2">
            {booking.dietary_notes.map((note, index) => (
              <View key={index} className="bg-lavender/30 px-2 py-1 rounded">
                <Text className="text-primary text-xs font-medium">{note}</Text>
              </View>
            ))}
          </View>
        )}

        {booking.special_offers && (
          <View className="mb-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
            <View className="flex-row items-center mb-1">
              <MaterialIcons name="local-offer" size={16} color="#2563eb" />
              <Text className="text-blue-600 font-semibold ml-1">
                {booking.special_offers.title}
              </Text>
            </View>
            {booking.special_offers.description && (
              <Text className="text-gray text-sm">{booking.special_offers.description}</Text>
            )}
            {booking.special_offers.discount_percentage && (
              <Text className="text-blue-600 text-sm font-semibold mt-1">
                {booking.special_offers.discount_percentage}% off
              </Text>
            )}
          </View>
        )}

      {/* Action Buttons */}
      {isPending && !isCancelledByUser && (
        <View className="flex-row gap-3 mt-3">
          <TouchableOpacity
            className="flex-1 bg-red-500 rounded-xl py-3 items-center"
            onPress={handleDeclinePress}
          >
            <Text className="text-white font-semibold text-base">DECLINE</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="flex-1 bg-green-600 rounded-xl py-3 items-center"
            onPress={() => onAccept(booking.id)}
          >
            <Text className="text-white font-semibold text-base">ACCEPT</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Cancelled by User - No Actions Available */}
      {isCancelledByUser && (
        <View className="bg-gray/10 rounded-xl p-3 mt-3 border border-gray/30">
          <View className="flex-row items-center">
            <MaterialIcons name="info" size={20} color="#787878" />
            <Text className="text-gray text-sm ml-2 flex-1">
              This booking was cancelled by the customer. No actions available.
            </Text>
          </View>
        </View>
      )}

        {isConfirmed && (
          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity
              className="flex-1 bg-primary rounded-xl py-3 items-center"
              onPress={() => onComplete(booking.id)}
            >
              <Text className="text-background font-semibold text-base">Complete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-gray/20 rounded-xl px-4 py-3 items-center justify-center"
              onPress={() => setShowMoreMenu(true)}
            >
              <MaterialIcons name="more-vert" size={24} color="#792339" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View className="bg-white rounded-2xl w-4/5 overflow-hidden">
            <TouchableOpacity
              className="p-4 border-b border-lavender/30 flex-row items-center"
              onPress={() => {
                setShowMoreMenu(false);
                handleNoShowPress();
              }}
            >
              <MaterialIcons name="event-busy" size={24} color="#dc2626" />
              <Text className="text-primary text-base ml-3">Mark as No Show</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="p-4 flex-row items-center"
              onPress={() => {
                setShowMoreMenu(false);
                handleCancelPress();
              }}
            >
              <MaterialIcons name="cancel" size={24} color="#dc2626" />
              <Text className="text-primary text-base ml-3">Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowNoteModal(false)}
        >
          <View className="bg-white rounded-2xl w-11/12 p-6">
            <Text className="text-primary text-xl font-bold mb-4">
              {noteAction === 'decline' ? 'Decline Booking' : 'Cancel Booking'}
            </Text>
            
            <Text className="text-gray mb-3">
              Add an optional note to send to the customer:
            </Text>
            
            <TextInput
              className="bg-background border border-lavender rounded-xl p-4 text-primary mb-4"
              placeholder="Enter your message (optional)"
              placeholderTextColor="#d9c3db"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray/20 rounded-xl py-3 items-center"
                onPress={() => setShowNoteModal(false)}
              >
                <Text className="text-primary font-semibold">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-red-500 rounded-xl py-3 items-center"
                onPress={handleNoteSubmit}
              >
                <Text className="text-white font-semibold">
                  {noteAction === 'decline' ? 'Decline' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

