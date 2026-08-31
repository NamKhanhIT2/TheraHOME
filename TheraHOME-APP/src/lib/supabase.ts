import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — check .env',
  );
}

// expo-secure-store has a 2048-byte value limit per key; a session/refresh
// token can exceed that, so this adapter chunks large values across multiple
// keys rather than swapping to a lower-security fallback.
const CHUNK_SIZE = 1800;

const secureStoreAdapter: SupportedStorage = {
  async getItem(key: string) {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCount) return SecureStore.getItemAsync(key);

    // Treat a damaged/stale chunk manifest as an empty session instead of
    // throwing during app boot. This can happen after reinstalling a dev
    // build while Keychain data is retained by iOS.
    const count = Number(chunkCount);
    if (!Number.isInteger(count) || count <= 0 || count > 100) {
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      return SecureStore.getItemAsync(key);
    }
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}_${i}`)),
    );
    if (parts.every((p) => p !== null)) return parts.join('');

    // A partially-written session must not block every subsequent launch.
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {})),
    );
    await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
    return null;
  },
  async setItem(key: string, value: string) {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}_${i}`, c)));
  },
  async removeItem(key: string) {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCount) {
      await Promise.all(
        Array.from({ length: Number(chunkCount) }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`)),
      );
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

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
