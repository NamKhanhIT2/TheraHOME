import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';

/**
 * Stable entry point for cold launches and development-client deep links.
 *
 * The root layout conditionally registers the onboarding, patient and staff
 * navigators. Without a real `/` screen, a cold launch first fell through to
 * `+not-found`; that screen then tried to open `/questions` even after the
 * onboarding navigator had been removed, producing a not-found redirect loop
 * whose only visible UI was an endless ActivityIndicator.
 */
export default function AppEntryScreen() {
  const { session, loading: sessionLoading } = useSession();
  const profileQuery = useProfile(session?.user.id);

  // RootNavigator already renders the branded boot screen while these are
  // loading. Keeping this component empty for that very short overlap avoids
  // flashing an onboarding screen underneath it.
  if (sessionLoading || (!!session?.user.id && profileQuery.isPending)) return null;

  if (!session) return <Redirect href="/login" />;

  const profile = profileQuery.data;
  if (!profile) return <Redirect href="/login" />;

  const isStaff = profile.accountType === 'admin' || profile.accountType === 'cskh';
  if (isStaff) return <Redirect href="/(staff)/chat" />;
  // TheraHOME-issued accounts skip the intake/country screens entirely —
  // RootNavigator treats them as inApp, so the (onboarding) group (which
  // holds /questions and /country) is NOT registered for them. Redirecting
  // there anyway landed on an unregistered route = blank screen (hit by
  // admin-issued accounts, whose profiles rows default country_confirmed
  // to false). Mirror RootNavigator's gating exactly.
  const isTheraIssued = profile.accountType !== 'normal';
  if (!isTheraIssued && profile.onboardingCompleted === false) return <Redirect href="/questions" />;
  if (!isTheraIssued && profile.countryConfirmed === false) return <Redirect href="/country" />;

  return <Redirect href="/(tabs)/home" />;
}
