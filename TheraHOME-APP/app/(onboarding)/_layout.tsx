import React from 'react';
import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="questions" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="thera-login" />
      <Stack.Screen name="country" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
