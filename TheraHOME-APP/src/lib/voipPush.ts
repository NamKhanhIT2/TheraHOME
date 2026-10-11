// The iOS half of lock-screen ringing: getting a PushKit token, and keeping
// the server's copy of it current.
//
// Three things make this unlike the Expo push token next to it:
//
//   - It comes from PushKit, not from Expo, and is a different value for the
//     same device. `push_tokens` cannot hold it; `voip_tokens` does.
//   - It is only useful to `dispatch-voip-push`, which talks to APNs
//     directly, because Expo's service cannot send `apns-push-type: voip`.
//   - The *ringing* does not happen here. By the time any JS runs, the
//     native side has already reported the call to CallKit — Apple requires
//     that to happen inside the PushKit callback, before any JS exists. See
//     plugins/withVoipPushKit.js.
//
// So this file is only about registration. The call itself is handled by
// CallKit and then by useCallKeepBridge, exactly as on Android.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '@/lib/supabase';

const VOIP = requireOptionalNativeModule('RNVoipPushNotification')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('react-native-voip-push-notification').default
  : null;

export function isVoipPushSupported(): boolean {
  return Platform.OS === 'ios' && !!VOIP;
}

let registered = false;

/**
 * Asks iOS for a PushKit token and stores whatever it returns.
 *
 * The token can change — on reinstall, on restore to a new device — so the
 * `register` event is kept subscribed for the life of the app rather than
 * read once at startup. The RPC upserts by token and reassigns ownership,
 * which is what makes a handed-over handset ring for whoever is signed in
 * now instead of its previous owner.
 */
export function registerVoipPush(): () => void {
  if (!isVoipPushSupported()) return () => undefined;

  const onToken = (token: string) => {
    if (!token) return;
    void supabase.rpc('register_voip_token', { p_token: token })
      .then(({ error }) => {
        if (error && __DEV__) console.warn('register_voip_token failed:', error.message);
      });
  };

  VOIP.addEventListener('register', onToken);

  // `didLoadWithEvents` replays anything PushKit delivered before JS was
  // ready — which is the normal case on a cold start caused by a VoIP push,
  // and the one where losing the token would be most costly.
  VOIP.addEventListener('didLoadWithEvents', (events: { name: string; data: unknown }[]) => {
    for (const event of events ?? []) {
      if (event.name === 'RNVoipPushRemoteNotificationsRegisteredEvent') {
        onToken(event.data as string);
      }
    }
  });

  if (!registered) {
    VOIP.registerVoipToken();
    registered = true;
  }

  return () => {
    VOIP.removeEventListener('register');
    VOIP.removeEventListener('didLoadWithEvents');
  };
}

/** Drops this device's VoIP token server-side. Called on sign-out, so a
 * shared handset stops ringing for an account nobody is signed into. */
export async function unregisterVoipPush(token?: string): Promise<void> {
  if (!isVoipPushSupported() || !token) return;
  const { error } = await supabase.from('voip_tokens').delete().eq('token', token);
  if (error && __DEV__) console.warn('unregister_voip_token failed:', error.message);
}
