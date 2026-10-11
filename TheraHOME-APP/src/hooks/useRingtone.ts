// The sound a ringing phone makes.
//
// The first cut had none: an incoming call buzzed once and showed a modal, so
// a phone face-down on a desk rang silently and the owner's first report was
// "tôi chưa nghe tiếng chuông gọi đến". A notification sound does not cover
// this — the push only fires when the app is in the background, and the
// in-app path (Realtime) made no sound at all.
//
// `assets/sounds/ringtone.wav` is a synthesised 440+480 Hz pair on a 1.2s-on
// / 1.8s-off cadence, looped here. Generated rather than sourced so it ships
// with the repo and carries no licence.
//
// Two distinct sounds, because they mean different things:
//   ringtone  — "answer me", played to the person being called.
//   ringback  — "it is ringing at the other end", played to the caller. Quiet
//               and sparse on purpose; it is feedback, not a summons.
//
// Vibration repeats alongside the ringtone, since a phone on silent is
// exactly the case the sound cannot cover.
import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Same guard the typing sound uses (src/components/roadmap/SurveySuggestion.tsx):
// a JS bundle served to a binary built before expo-audio was added has no
// 'ExpoAudio' native module, and useAudioPlayer throws there. Degrade to a
// silent (but still vibrating) ring rather than crashing the call screen.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EXPO_AUDIO = requireOptionalNativeModule('ExpoAudio') ? require('expo-audio') : null;

const RINGTONE = require('../../assets/sounds/ringtone.wav');

/** 1.2s buzz, 1.8s gap — matched to the ringtone's own cadence so sound and
 * vibration land together instead of beating against each other. */
const VIBRATION_PATTERN = [0, 1200, 1800];

interface AudioPlayerLike {
  volume: number;
  loop: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
}

/**
 * Rings while `active` is true, and stops on every way out — answered,
 * declined, timed out, screen unmounted. The cleanup is the important half:
 * a ringtone that outlives its call is worse than no ringtone.
 *
 * @param active  whether the phone should be ringing right now
 * @param role    'incoming' summons the callee; 'ringback' reassures the caller
 */
export function useRingtone(active: boolean, role: 'incoming' | 'ringback' = 'incoming') {
  const player: AudioPlayerLike | null = EXPO_AUDIO
    // The EXPO_AUDIO gate is a module-level constant, so this hook is called
    // the same way on every render of a given build.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? (EXPO_AUDIO.useAudioPlayer(RINGTONE) as AudioPlayerLike)
    : null;
  const playingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (playingRef.current) {
        playingRef.current = false;
        try { player?.pause(); } catch { /* player already torn down */ }
        Vibration.cancel();
      }
      return;
    }

    playingRef.current = true;
    try {
      if (player) {
        player.loop = true;
        // Ringback is the caller's own feedback and plays against the
        // earpiece; at full volume it drowns the moment the other side picks
        // up and starts talking.
        player.volume = role === 'incoming' ? 1 : 0.25;
        player.seekTo(0);
        player.play();
      }
    } catch {
      // No audio in this build. The vibration below still carries the ring.
    }
    // Only the callee's phone vibrates. Buzzing the caller's hand while they
    // hold the phone to their ear is just annoying.
    if (role === 'incoming') Vibration.vibrate(VIBRATION_PATTERN, true);

    return () => {
      playingRef.current = false;
      try { player?.pause(); } catch { /* already gone */ }
      Vibration.cancel();
    };
  }, [active, role, player]);
}
