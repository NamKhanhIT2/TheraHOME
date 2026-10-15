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
import { NativeModules, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// The guard asks for the module by the EXACT key the library itself reads —
// `NativeModules.RNVoipPushNotificationManager`, the Objective-C class name,
// because RNVoipPushNotificationManager.m uses a bare RCT_EXPORT_MODULE().
//
// This was `requireOptionalNativeModule('RNVoipPushNotification')`: the pod's
// name, which is what the library is called everywhere except inside itself.
// Nothing is registered under that key, so the guard matched nothing and this
// file silently turned itself off on every iPhone — no PushKit token was ever
// stored, `voip_tokens` stayed empty (measured: 0 rows), and no locked iPhone
// could ring. The native half had been working all along: AppDelegate calls
// voipRegistration() at launch and iOS hands a token back. Nobody was
// listening for it.
//
// Keyed off NativeModules rather than expo-modules-core from now on, for the
// simple reason that it is the same lookup the library performs: if this is
// null, `require`ing the library would not have worked either.
const VOIP = NativeModules.RNVoipPushNotificationManager
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('react-native-voip-push-notification').default
  : null;

export function isVoipPushSupported(): boolean {
  return Platform.OS === 'ios' && !!VOIP;
}

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

  // NOT `VOIP.registerVoipToken()` any more. AppDelegate now creates the
  // PKPushRegistry itself and keeps a reference to it (see
  // plugins/withVoipPushKit.js); asking the library to register as well would
  // stand up a SECOND registry for the same app, and the one that wins is
  // whichever the system happened to keep.
  //
  // Nothing is lost here: registration happens at launch, earlier than this
  // code could manage, and the token still arrives on the `register` event
  // above because the delegate hands it to
  // `RNVoipPushNotificationManager.didUpdate`. `didLoadWithEvents` replays it
  // for the cold-start case, which is the one that matters most.

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
