import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createChunkedStorage } from '@/lib/secureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — check .env',
  );
}

// expo-secure-store has a 2048-byte value limit per key; a session/refresh
// token can exceed that, so the session is chunked across multiple keys
// rather than swapping to a lower-security fallback. Layout, serialisation
// and the 2026-09-06 stale-session fix live in secureSessionStorage.ts.
//
// AFTER_FIRST_UNLOCK, not the default. expo-secure-store stores items as
// WHEN_UNLOCKED unless told otherwise, which means they cannot be READ while
// the screen is locked — and the one moment this app most needs its session
// is exactly then: a VoIP push wakes it on a locked phone to take an incoming
// call.
//
// Measured 2026-10-15, build 43: the push arrived, CallKit rang, the call was
// answered and ran for 41 seconds on the iPhone — and the server never saw an
// answer_call, because the app that woke up could not read its own session,
// decided nobody was signed in, and so never armed the bridge that turns a
// CallKit answer into an RPC. The caller sat on "Đang gọi…" the whole time,
// and unlocking the phone afterwards showed the login screen: the session was
// not merely unreadable, it was gone.
//
// AFTER_FIRST_UNLOCK keeps the item readable while locked once the phone has
// been unlocked at least once since boot, which is the standard accessibility
// for background work and costs nothing at rest — the data is still encrypted
// and still never leaves the device.
const KEYCHAIN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const secureStoreAdapter = createChunkedStorage({
  getItemAsync: (key) => SecureStore.getItemAsync(key, KEYCHAIN),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN),
});

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's auto-refresh timer only ticks while it's told the app is active
// — without this, a backgrounded app's session silently stops refreshing.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
