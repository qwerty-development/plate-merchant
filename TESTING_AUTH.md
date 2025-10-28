# Testing Authentication - Quick Guide

## Step 1: Add Your Supabase Credentials

Create a `.env` file in the root directory:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Step 2: Disable Email Confirmation (for testing)

In your Supabase dashboard:
1. Go to **Authentication** → **Providers**
2. Click on **Email** 
3. Scroll to **Email Confirmation**
4. Toggle **OFF** "Confirm email"
5. Click **Save**

## Step 3: Run the App

```bash
npm start
```

## Step 4: Test Sign Up

1. The app should open on the Login screen
2. Click **"Sign Up"** at the bottom
3. Enter:
   - Email: test@example.com
   - Password: password123
   - Confirm Password: password123
4. Click **"Sign Up"**
5. You should see a success message and be redirected to login

## Step 5: Test Sign In

1. On the Login screen, enter:
   - Email: test@example.com
   - Password: password123
2. Click **"Sign In"**
3. You should be automatically redirected to the app's home screen

## Step 6: Test Sign Out

1. Navigate to the **Explore** tab
2. You should see your email displayed
3. Click the **"Sign Out"** button
4. Confirm the sign out
5. You should be redirected back to the Login screen

## Troubleshooting

### "Invalid API key" error
- Check that your `.env` file has the correct credentials
- Restart the Expo dev server: Stop (Ctrl+C) and run `npm start` again

### User not redirected after login
- Check the terminal for errors
- Make sure your Supabase project is active
- Verify the credentials are correct

### Email confirmation stuck
- Make sure you disabled email confirmation in Supabase dashboard
- Or check your email inbox for the confirmation link

## What's Next?

Once sign-in is working, we can add:
- Restaurant staff role checking
- Booking request notifications
- Accept/Decline booking functionality



