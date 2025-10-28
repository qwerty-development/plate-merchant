import { Redirect } from 'expo-router';

export default function HomeScreen() {
  // Redirect to bookings page
  return <Redirect href="/(tabs)/bookings" />;
}
