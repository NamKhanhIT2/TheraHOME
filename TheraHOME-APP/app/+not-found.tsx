import React from 'react';
import { Redirect } from 'expo-router';

// Expo Router's reserved catch-all for any path that doesn't match a real
// screen. The Google OAuth redirect (and a cold Expo Go connect) can
// transiently land here before the root layout's session state has settled.
//
// Always recover through the real `/` entry point. It owns the complete
// session/profile/onboarding/staff decision, so an invalid or stale deep link
// can never bounce between this catch-all and a route removed by
// Stack.Protected.
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
