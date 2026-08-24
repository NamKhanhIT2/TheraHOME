import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';

// Expo Router's reserved catch-all for any path that doesn't match a real
// screen. The Google OAuth redirect (and a cold Expo Go connect) can
// transiently land here before the root layout's session/activation state
// has settled.
//
// There is no `app/index.tsx`, and which top-level group is even
// *registered* depends on auth state (see app/_layout.tsx's
// Stack.Protected guards) — so redirecting to a guessed path like `/` risks
// landing on another unmatched route and looping right back here. Instead
// this mirrors the root layout's own session/activation check and replaces
// with whichever concrete path is guaranteed to be registered for that
// state.
export default function NotFoundScreen() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const programsQuery = useActivatedPrograms(userId);
  const activationLoading = !!userId && programsQuery.isPending;
  const isActivated = (programsQuery.data?.length ?? 0) > 0;

  useEffect(() => {
    if (sessionLoading || activationLoading) return;
    if (session && isActivated) {
      router.replace('/home');
    } else if (session) {
      router.replace('/activate');
    } else {
      router.replace('/welcome');
    }
  }, [sessionLoading, activationLoading, session, isActivated]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bgApp }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}
