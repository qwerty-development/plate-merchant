# Notification Assets

This folder contains audio files for notifications.

## Required Files

- **new_booking.wav** - Notification sound that plays when a new booking arrives
  - Format: WAV audio file
  - Duration: Recommended 2-5 seconds (will loop continuously)
  - Volume: Should be normalized for consistent playback
  - Usage: Plays continuously until the booking is accepted or declined

## Usage

The notification sound is managed by the `useBookingNotification` hook and will:
- Play automatically when a new pending booking arrives
- Loop continuously until action is taken
- Stop when the booking is accepted or declined
- Support multiple pending bookings (tracks each booking ID)
- Play even when the device is in silent mode (iOS)

## Adding Your Sound File

Place your `new_booking.wav` file in this directory. The app will automatically use it.

