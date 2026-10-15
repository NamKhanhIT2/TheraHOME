# Voice/video call regression checks

Run from `TheraHOME-APP`:

```sh
npm run test:calls
npx tsc --noEmit
npx eslint 'app/call/[callId].tsx' src/components/call src/components/chat/CallButton.tsx src/hooks/useCallKeepBridge.ts src/hooks/useCalls.ts src/hooks/useRingtone.ts src/lib/callSession.ts src/lib/callkeep.ts src/lib/livekit.ts tests
```

The Node tests execute the actual TypeScript modules with mocked native/network boundaries. They cover cancellation during connection, late responses, duplicate native events, peer reconnects, bounded connection waits, camera/microphone failures, serialised controls, audio ownership, iOS routing configuration, and answering without a mounted call screen.

The signaling tests execute `202610142100_call_transitions_are_serialized.sql` in an isolated PostgreSQL instance through PGlite. Authentication, chat logging and cron are test stubs; no remote Supabase instance or user account is accessed. These tests cover both orderings of answer versus hangup/timeout, idempotent transitions, stale answers, authorization with nullable participant columns, history deduplication, and RPC grants. PGlite uses a single connection: this does not exercise concurrent PostgreSQL sessions or a real cron scheduler.

## Deployment

Apply `supabase/migrations/202610142100_call_transitions_are_serialized.sql` to the target Supabase project before distributing the updated app. It preserves the existing RPC signatures, uses a 45-second ring deadline, serializes answer/end transitions with row locks, and schedules the existing stale-call cleanup once a minute. The scheduled sweep is a fallback when the caller's app has been killed; it is not an exact 45-second background timer. `pg_cron` is already introduced by migration `202609031600`.

The app changes are JavaScript/TypeScript only and add no native module. They require a build that already includes the project's existing LiveKit, CallKeep, PushKit and proximity modules. `@electric-sql/pglite` is a development-only test dependency.

## Physical-device privacy boundary

Treat physical phones as user-controlled devices. The tester may launch or stop `ai.therahome` by package name and read TheraHOME/backend diagnostics, but must not send global UI input (`adb shell input`), automate taps or typing, capture the device screen, or inspect another foreground app. The user performs all taps, permission choices and call controls on a physical phone.

Before any read-only TheraHOME UI inspection, confirm that the resumed package is `ai.therahome`. Never paste QA credentials into a physical device through automation. Emulator/simulator automation must always name the virtual-device serial explicitly.

## Device validation still required

The automated tests do not establish real media connections or validate APNs/FCM delivery, OS audio routing, Bluetooth, camera hardware or locked-screen behavior. Use a customer account and a staff account on two physical devices with the target backend migration applied:

1. Call in both directions, for audio and video. Answer, decline, cancel before answer, and let the 45-second ring expire. Confirm both UIs stop ringing and the thread gets one history entry.
2. Minimise while ringing, connecting and connected. Navigate in chat and reopen from the bar; the same call continues. Background/foreground the caller while ringing without cancelling it.
3. Answer and hang up from the locked screen, including a cold start. Confirm media connects without needing a second Answer tap, other staff phones stop ringing, and a late Answer does not revive a cancelled call.
4. Toggle mic/camera/speaker, flip camera repeatedly, and refuse camera permission. Confirm the far end matches the controls, audio survives camera refusal, and muted video returns to the identity view.
5. During a video call on iOS, switch off speaker and verify the earpiece. During speakerphone use, cover the proximity sensor and verify the screen stays on.
6. Interrupt Wi-Fi/mobile data briefly and restore it, then repeat with a longer interruption. A brief loss reconnects; a failed connection ends with a reason instead of waiting indefinitely. Hang up while offline and confirm the server row is resolved after connectivity returns.
7. Put the receiving app in the background and kill it; check push delivery, native ringing and cancellation on actual iOS/Android versions. Background behavior is OS-dependent and is not established by a Metro export.

SDK references used during review: [LiveKit connection lifecycle](https://docs.livekit.io/intro/basics/connect/), [CallKeep API](https://github.com/react-native-webrtc/react-native-callkeep). Installed SDK source is the reference for audio routing names and native API availability.
