# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication for your Plate Merchant app.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed
- Expo CLI

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in your project details:
   - **Name**: plate-merchant (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Choose the closest region to you
4. Click "Create new project" and wait for it to initialize

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, click on the "Settings" icon (gear icon) in the left sidebar
2. Go to "API" section
3. You'll need two values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

## Step 3: Configure Your App

1. Create a `.env` file in the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and replace the placeholder values with your actual Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 4: Enable Email Authentication (Optional)

By default, Supabase requires email confirmation. To disable this for development:

1. In your Supabase dashboard, go to "Authentication" → "Providers"
2. Click on "Email"
3. Scroll down to "Email Confirmation"
4. Toggle "Enable email confirmations" to OFF (for development only)
5. Click "Save"

**Note**: For production, keep email confirmation enabled for security.

## Step 5: Run Your App

1. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go

## How Authentication Works

### Protected Routes

All routes are now protected by authentication. The app automatically:
- Redirects unauthenticated users to the login screen
- Redirects authenticated users away from auth screens to the main app

### Authentication Flow

1. **Sign Up**: New users can create an account with email and password
2. **Sign In**: Existing users can log in with their credentials
3. **Sign Out**: Authenticated users can sign out from the Explore tab
4. **Session Persistence**: User sessions are saved securely using:
   - `expo-secure-store` on iOS/Android (encrypted storage)
   - `AsyncStorage` on web

### File Structure

```
├── lib/
│   └── supabase.ts                    # Supabase client configuration
├── contexts/
│   └── auth-context.tsx               # Auth state management
├── app/
│   ├── _layout.tsx                    # Root layout with auth protection
│   ├── (auth)/
│   │   ├── _layout.tsx               # Auth screens layout
│   │   ├── login.tsx                 # Login screen
│   │   └── signup.tsx                # Sign up screen
│   └── (tabs)/
│       ├── index.tsx                 # Home screen (protected)
│       └── explore.tsx               # Explore screen (protected, with sign out)
```

## Using Authentication in Your Components

To access authentication state in any component:

```tsx
import { useAuth } from '@/contexts/auth-context';

function MyComponent() {
  const { user, session, loading, signOut } = useAuth();
  
  if (loading) {
    return <ActivityIndicator />;
  }
  
  return (
    <View>
      <Text>Welcome, {user?.email}</Text>
      <Button title="Sign Out" onPress={signOut} />
    </View>
  );
}
```

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env` file has the correct credentials
- Make sure you're using `EXPO_PUBLIC_` prefix for environment variables
- Restart your development server after changing `.env`

### User not redirected after login
- Check that your auth routes are set up correctly
- Verify the router configuration in `app/_layout.tsx`

### Email confirmation issues
- If testing locally, disable email confirmation in Supabase dashboard
- For production, set up proper email templates and SMTP settings

## Next Steps

Now that authentication is set up, you can:

1. **Add user profiles**: Create a `profiles` table in Supabase to store additional user data
2. **Implement password reset**: Add forgot password functionality
3. **Add social authentication**: Enable OAuth providers (Google, GitHub, etc.)
4. **Set up Row Level Security**: Secure your database tables with RLS policies
5. **Add role-based access control**: Implement different user roles and permissions

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)




