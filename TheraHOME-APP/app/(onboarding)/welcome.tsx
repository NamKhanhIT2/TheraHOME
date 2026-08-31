import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Compatibility route for old links and installed development builds.
 * The Welcome screen has been removed from the active flow.
 */
export default function WelcomeRedirect() {
  return <Redirect href="/login" />;
}
