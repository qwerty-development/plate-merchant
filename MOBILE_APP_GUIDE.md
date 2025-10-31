# Mobile App Guide - Plate Merchant

This is the mobile companion app for restaurant owners to manage bookings and restaurant information on-the-go.

## Features

### 📅 Bookings Tab
- **Real-time booking management** - Accept, decline, complete, or cancel bookings
- **Analytics Dashboard** - See pending, accepted, declined, completed, and cancelled bookings at a glance
- **Advanced Filtering** - Filter by date range (today, this week, this month, custom) and status
- **Search Functionality** - Search by customer name, email, phone number, or confirmation code
- **Detailed Booking Cards** - View all booking details including:
  - Customer information and ratings
  - Contact details (phone, email) with quick actions
  - Booking details (date, time, guests, section)
  - Special requests and dietary notes
  - Applied special offers
  - Table preferences and occasions
- **Real-time Updates** - Automatically updates when new bookings arrive or status changes
- **Elapsed Time Tracking** - Shows how long pending bookings have been waiting

### ⚙️ Manage Restaurant Tab
- **General Information** - Update restaurant name, description, address, phone, WhatsApp, website, Instagram
- **Operational Settings** - Configure booking window, cancellation window, table turnover time, booking policy, minimum age
- **Features & Amenities** - Set price range, cuisine type, dietary options, and amenities (parking, valet, outdoor seating, shisha)
- **Collapsible Sections** - Clean mobile-friendly interface with expandable sections
- **Form Validation** - Real-time validation with helpful error messages
- **Auto-save** - Changes persist and sync across devices

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- Expo CLI installed (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)
- Android Studio (for Android APK builds)

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `EXPO_PUBLIC_API_URL` - Your API endpoint URL

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm start
# or
npx expo start
```

This will start the Metro bundler. You can then:
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan QR code with Expo Go app on your phone

## Building for Production

### Android APK

1. **Configure app.json**
   - Update `expo.name`, `expo.slug`, and `expo.android.package`
   - Set your app version and build number

2. **Build APK locally** (requires Android Studio):
   ```bash
   npx expo prebuild
   npx expo run:android --variant release
   ```

3. **Build APK with EAS** (recommended):
   ```bash
   npm install -g eas-cli
   eas login
   eas build --platform android
   ```

### iOS (requires Mac)
```bash
npx expo prebuild
npx expo run:ios --configuration Release
```

Or with EAS:
```bash
eas build --platform ios
```

## Database Schema Requirements

The app expects the following Supabase tables:

### `restaurants` table
- `id` (uuid, primary key)
- `owner_id` (uuid, foreign key to auth.users)
- `name` (text)
- `description` (text, nullable)
- `address` (text)
- `phone_number` (text, nullable)
- `whatsapp_number` (text, nullable)
- `website_url` (text, nullable)
- `instagram_handle` (text, nullable)
- `booking_window` (integer)
- `cancellation_window` (integer)
- `table_turnover_time` (integer)
- `booking_policy` (text: 'instant' or 'request')
- `minimum_age` (integer, nullable)
- `price_range` (integer, 1-4)
- `cuisine_type` (text, nullable)
- `dietary_options` (text[], nullable)
- `parking_available` (boolean)
- `valet_parking` (boolean)
- `outdoor_seating` (boolean)
- `shisha_available` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `bookings` table
- `id` (uuid, primary key)
- `restaurant_id` (uuid, foreign key)
- `user_id` (uuid, foreign key)
- `booking_time` (timestamp)
- `party_size` (integer)
- `status` (text: 'pending', 'confirmed', 'completed', 'cancelled_by_customer', 'cancelled_by_restaurant', 'declined_by_restaurant', 'no_show')
- `special_requests` (text, nullable)
- `preferred_section` (text, nullable)
- `occasion` (text, nullable)
- `dietary_notes` (text[], nullable)
- `guest_name` (text)
- `guest_email` (text, nullable)
- `confirmation_code` (text)
- `table_preferences` (text, nullable)
- `applied_offer_id` (uuid, foreign key, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `profiles` table
- `id` (uuid, primary key, foreign key to auth.users)
- `full_name` (text, nullable)
- `phone_number` (text, nullable)
- `email` (text, nullable)
- `user_rating` (numeric, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `special_offers` table
- `id` (uuid, primary key)
- `title` (text)
- `description` (text, nullable)
- `discount_percentage` (numeric, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## API Endpoint

The app requires a booking update API endpoint at:
`POST /api/basic-booking-update`

Request body:
```json
{
  "bookingId": "uuid",
  "status": "confirmed" | "declined_by_restaurant" | "cancelled_by_restaurant" | "completed" | "no_show",
  "note": "optional message to customer"
}
```

## Troubleshooting

### Metro bundler issues
```bash
npx expo start --clear
```

### Android build issues
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

### Supabase connection issues
- Check your environment variables are set correctly
- Verify Supabase URL and keys in the Supabase dashboard
- Check Row Level Security (RLS) policies are configured

### Real-time not working
- Verify Realtime is enabled in Supabase dashboard
- Check RLS policies allow SELECT operations
- Ensure network connection is stable

## Color Scheme

The app uses the following brand colors:
- **Background**: `#ffece2`
- **Primary**: `#792339`
- **Accent**: `#F2b25f`
- **Gray**: `#787878`
- **Lavender**: `#d9c3db`

Status colors:
- **Pending**: `#f97316` (orange)
- **Confirmed**: `#16a34a` (green)
- **Declined**: `#dc2626` (red)
- **Completed**: `#2563eb` (blue)
- **Cancelled**: `#6b7280` (gray)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Expo documentation: https://docs.expo.dev/
3. Review Supabase documentation: https://supabase.com/docs
4. Check React Query documentation: https://tanstack.com/query/latest

## License

[Your License Here]




