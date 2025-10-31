# Testing Checklist - Plate Merchant Mobile App

Use this checklist to test all features of the mobile app before deployment.

## Prerequisites
- [ ] Supabase database is set up with proper schema
- [ ] Environment variables are configured in `.env`
- [ ] API endpoint is running and accessible
- [ ] Test restaurant account exists in database
- [ ] Test bookings exist in database

## Authentication
- [ ] App redirects to login screen when not authenticated
- [ ] Can sign in with valid credentials
- [ ] Invalid credentials show error message
- [ ] App redirects to bookings tab after successful login
- [ ] Session persists after closing and reopening app

---

## Bookings Tab Tests

### Analytics Cards
- [ ] Pending count shows correct number with orange color
- [ ] Accepted count shows correct number with green color
- [ ] Declined count shows correct number with red color
- [ ] Completed count shows correct number with blue color
- [ ] Cancelled count shows correct number with gray color
- [ ] Pending card pulses when count > 0
- [ ] Cards update when booking status changes

### Search & Filters
- [ ] Search by customer name works
- [ ] Search by email works
- [ ] Search by phone number works
- [ ] Search by confirmation code works
- [ ] Clear search button appears and works
- [ ] "Today" filter shows only today's bookings
- [ ] "This Week" filter works correctly
- [ ] "This Month" filter works correctly
- [ ] "All Dates" filter shows all bookings from today onward
- [ ] "Custom Range" opens date picker
- [ ] Custom date range filters correctly
- [ ] Status filter dropdown opens
- [ ] Each status filter works (All, Pending, Confirmed, etc.)
- [ ] Filters can be combined (date + status + search)

### Booking Cards - Display
- [ ] Status badge shows correct color and icon
- [ ] Pending bookings show elapsed time (updating every second)
- [ ] Customer name displays prominently
- [ ] Customer rating shows if < 5.0
- [ ] Confirmation code displays in top right
- [ ] Phone number displays and is clickable
- [ ] Email displays and is clickable
- [ ] Date formatted correctly (MMM d, yyyy)
- [ ] Time formatted correctly (h:mm a)
- [ ] Party size displays correctly
- [ ] Section/preference displays correctly
- [ ] Occasion displays when present
- [ ] Table preferences display when present
- [ ] Special requests display in colored box
- [ ] Dietary notes display as small badges
- [ ] Special offers display in blue box with details

### Booking Actions - Pending Bookings
- [ ] "DECLINE" button visible for pending bookings
- [ ] "ACCEPT" button visible for pending bookings
- [ ] Clicking DECLINE opens note modal
- [ ] Can decline without note
- [ ] Can decline with note
- [ ] Decline updates booking status in database
- [ ] Clicking ACCEPT immediately accepts booking
- [ ] Accept updates booking status to confirmed
- [ ] Toast notification shows on successful accept
- [ ] Toast notification shows on successful decline

### Booking Actions - Confirmed Bookings
- [ ] "Complete" button visible for confirmed bookings
- [ ] "More" menu button visible for confirmed bookings
- [ ] Clicking Complete marks booking as completed
- [ ] Clicking More opens action menu
- [ ] "Mark as No Show" option appears in menu
- [ ] "Cancel Booking" option appears in menu
- [ ] No Show shows confirmation alert
- [ ] Confirming No Show updates status
- [ ] Cancel opens note modal
- [ ] Can cancel with optional note
- [ ] Cancel updates status to cancelled_by_restaurant

### Real-time Updates
- [ ] New booking appears automatically without refresh
- [ ] Toast notification shows for new bookings
- [ ] Booking status changes update automatically
- [ ] Analytics cards update in real-time
- [ ] Pull to refresh works
- [ ] Real-time updates work across multiple devices

### Empty & Loading States
- [ ] Loading spinner shows while fetching bookings
- [ ] Empty state shows when no bookings match filters
- [ ] Empty state message changes based on active filters
- [ ] Empty state shows appropriate icon

### Data Integrity
- [ ] ALL pending bookings show regardless of date filter
- [ ] Pending bookings always appear at top of list
- [ ] Other bookings respect date filters
- [ ] No duplicate bookings appear
- [ ] Bookings sorted correctly (pending first, then by date)

---

## Manage Restaurant Tab Tests

### General Information Section
- [ ] Section expands/collapses when clicked
- [ ] Restaurant name field pre-filled with current value
- [ ] Description field pre-filled
- [ ] Address field pre-filled
- [ ] Phone number field pre-filled
- [ ] WhatsApp number field pre-filled
- [ ] Website URL field pre-filled
- [ ] Instagram handle field pre-filled
- [ ] Required fields show validation errors when empty
- [ ] Website URL validates format (must start with http/https)
- [ ] Can update all fields successfully
- [ ] "Save Changes" button shows loading spinner while saving
- [ ] Success toast shows after save
- [ ] Form stays populated after save
- [ ] Section collapses after successful save
- [ ] Changes persist after closing and reopening app

### Operational Settings Section
- [ ] Section expands/collapses when clicked
- [ ] Booking window field pre-filled (number)
- [ ] Cancellation window field pre-filled (number)
- [ ] Table turnover time field pre-filled (number)
- [ ] Booking policy shows current selection (Instant/Request)
- [ ] Minimum age field pre-filled
- [ ] Validation: booking window 1-90 days
- [ ] Validation: cancellation window 1-48 hours
- [ ] Validation: table turnover 30-240 minutes
- [ ] Validation: minimum age 0-99
- [ ] Can switch between Instant and Request policy
- [ ] Can update all settings successfully
- [ ] Success toast shows after save
- [ ] Changes persist after save

### Features & Amenities Section
- [ ] Section expands/collapses when clicked
- [ ] Price range shows current selection (1-4 dollar signs)
- [ ] Can select different price ranges
- [ ] Selected price range highlights in primary color
- [ ] Cuisine type dropdown shows current selection
- [ ] Clicking cuisine type opens modal
- [ ] All cuisine options appear in modal
- [ ] Can select new cuisine type
- [ ] Modal closes after selection
- [ ] Dietary options display as toggleable chips
- [ ] Selected dietary options highlight
- [ ] Can toggle multiple dietary options
- [ ] Parking Available switch shows current state
- [ ] Valet Parking switch shows current state
- [ ] Outdoor Seating switch shows current state
- [ ] Shisha Available switch shows current state
- [ ] All switches can be toggled
- [ ] Can update all features successfully
- [ ] Success toast shows after save
- [ ] Changes persist after save

### User Actions
- [ ] "Sign Out" button appears at bottom
- [ ] Clicking sign out shows confirmation alert
- [ ] Can cancel sign out
- [ ] Confirming sign out logs user out
- [ ] After sign out, redirects to login screen

---

## Error Handling Tests

### Network Errors
- [ ] App handles no internet connection gracefully
- [ ] Shows appropriate error messages when offline
- [ ] Retry logic works when connection restored
- [ ] Real-time reconnects automatically

### API Errors
- [ ] Shows error toast if booking update fails
- [ ] Shows error toast if restaurant update fails
- [ ] Errors don't crash the app
- [ ] Can retry failed operations

### Validation Errors
- [ ] Form validation errors show inline
- [ ] Red text displays for invalid inputs
- [ ] Save button disabled during save
- [ ] Can correct errors and resubmit

---

## UI/UX Tests

### Mobile Responsiveness
- [ ] All text is readable (minimum 16px body text)
- [ ] Touch targets are at least 48x48px
- [ ] Buttons are large and easy to tap
- [ ] Forms are easy to fill out on mobile
- [ ] No horizontal scrolling
- [ ] Content fits within screen width

### Visual Design
- [ ] Brand colors applied consistently
- [ ] Cards have proper shadows/borders
- [ ] Rounded corners on all cards (8-12px)
- [ ] Proper spacing between elements
- [ ] Icons display correctly
- [ ] Status badges have correct colors
- [ ] Typography is consistent

### Performance
- [ ] App loads quickly
- [ ] Smooth scrolling
- [ ] No lag when typing in search
- [ ] Date picker opens quickly
- [ ] Modals animate smoothly
- [ ] No stuttering or freezing

### Navigation
- [ ] Bottom tab bar visible and accessible
- [ ] Can switch between Bookings and Manage tabs
- [ ] Tab icons display correctly
- [ ] Active tab highlighted in primary color
- [ ] Navigation persists state when switching tabs

---

## Edge Cases

### Bookings Tab
- [ ] Handles 0 bookings gracefully
- [ ] Handles 100+ bookings efficiently
- [ ] Long customer names don't break layout
- [ ] Long special requests display properly
- [ ] Missing data (no email, no phone) handled
- [ ] No special offers doesn't break card
- [ ] Multiple dietary notes display correctly

### Manage Tab
- [ ] Handles very long restaurant names
- [ ] Handles very long descriptions
- [ ] Optional fields can be left empty
- [ ] Can clear optional fields
- [ ] Instagram handle works with/without @
- [ ] URL validation works for various formats

---

## Platform-Specific Tests (if applicable)

### Android
- [ ] Back button works correctly
- [ ] Hardware back button doesn't break navigation
- [ ] Toast notifications display properly
- [ ] Date picker uses Android native picker
- [ ] Permissions handled correctly (if any)

### iOS
- [ ] Safe area respected (notch)
- [ ] Keyboard pushes content up
- [ ] Date picker uses iOS native picker
- [ ] Alert dialogs use iOS style
- [ ] Haptic feedback works (if implemented)

---

## Security Tests
- [ ] User can only see their own restaurant data
- [ ] User can only manage their own bookings
- [ ] Session expires after appropriate time
- [ ] Re-login required after sign out
- [ ] Sensitive data not logged to console (production)

---

## Final Checks
- [ ] No console errors in development
- [ ] No console warnings in development
- [ ] App works in release mode
- [ ] App doesn't crash during normal usage
- [ ] All features work as described in prompt
- [ ] Documentation is clear and accurate

---

## Notes
Add any issues or observations here:

- 
- 
- 

---

## Test Environment
- Device/Simulator: _______________
- OS Version: _______________
- App Version: _______________
- Tested By: _______________
- Date: _______________




