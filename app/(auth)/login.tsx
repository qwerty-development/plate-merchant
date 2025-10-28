import { useAuth } from '@/contexts/auth-context';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    console.log('🔐 Attempting login with email:', email);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      console.error('❌ Login error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Login Failed', `${error.message}\n\nCode: ${error.status || 'unknown'}`);
    } else {
      console.log('✅ Login successful!');
      // Navigation will be handled automatically by the auth state change
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 justify-center">
        <View className="mb-10">
          <Text className="text-4xl font-bold text-primary mb-2">
            Welcome Back
          </Text>
          <Text className="text-base text-gray">
            Sign in to continue
          </Text>
        </View>

        <View className="w-full">
          <View className="mb-5">
            <Text className="text-sm font-semibold text-primary mb-2">
              Email
            </Text>
            <TextInput
              className="bg-white rounded-xl p-4 text-base text-primary border border-lavender"
              placeholder="Enter your email"
              placeholderTextColor="#d9c3db"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View className="mb-5">
            <Text className="text-sm font-semibold text-primary mb-2">
              Password
            </Text>
            <TextInput
              className="bg-white rounded-xl p-4 text-base text-primary border border-lavender"
              placeholder="Enter your password"
              placeholderTextColor="#d9c3db"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            className={`bg-primary rounded-xl p-4 items-center mt-3 ${loading ? 'opacity-50' : ''}`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffece2" />
            ) : (
              <Text className="text-background text-base font-semibold">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
