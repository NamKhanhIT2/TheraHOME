import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

// Nested stacks do not inherit the root's screenOptions, so this repeats the
// Android/iOS transition match made in app/_layout.tsx — without it the
// questionnaire still bloomed in place on Android while every screen outside
// onboarding slid in from the right.
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="questions" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="thera-login" />
      <Stack.Screen name="country" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
