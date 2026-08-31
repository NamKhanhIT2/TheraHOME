import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Real Supabase auth state — replaces the Phase 1 `useAppStore().isSignedIn`
// mock flag as the root layout's auth gate.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootTimeout = setTimeout(() => {
      if (!mounted) return;
      if (__DEV__) console.warn('Supabase session restore timed out; continuing without a restored session.');
      setLoading(false);
    }, 8000);

    // A rejected SecureStore read used to leave `loading` true forever,
    // which means the native development client keeps showing its launch
    // spinner even though Metro already printed "iOS Bundled". Always
    // settle the boot gate; the auth listener below can still restore a
    // session if Supabase emits it just after this initial read.
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (mounted) setSession(data.session);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Unable to restore Supabase session:', error);
      })
      .finally(() => {
        clearTimeout(bootTimeout);
        if (mounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      clearTimeout(bootTimeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
