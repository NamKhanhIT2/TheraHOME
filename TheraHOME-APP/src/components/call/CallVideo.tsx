// Video rendering for a call.
//
// LiveKit's `<VideoTrack>` takes a `TrackReference` — the
// {participant, publication, source} triple its React bindings normally build
// from a room context. The call screen drives a `Room` object directly
// instead (so it can control exactly when the room is joined and left, which
// is what keeps unanswered calls off the bill), so the triples are assembled
// here by hand.
//
// `useCallVideoTracks` also has to re-render on its own: a camera track can
// appear seconds after the room connects, and disappear when the far end
// taps "tắt camera". None of that goes through React state unless something
// subscribes to the room's events, which is what the effect below does.
//
// Both the component and the hook degrade to nothing when the native modules
// are missing (an older binary — see src/lib/livekit.ts), so a voice call on
// such a build still works and a video one simply shows no picture.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { LiveKitRoom } from '@/lib/livekit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LK_NATIVE = requireOptionalNativeModule('LiveKitReactNative') ? require('@livekit/react-native') : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LK_CLIENT = LK_NATIVE ? require('livekit-client') : null;

// The shape `<VideoTrack>` wants. Kept loose on purpose: importing
// `TrackReference` from @livekit/components-react would pull the web
// bindings into the bundle for a type.
export interface CallTrackRef {
  participant: unknown;
  publication: unknown;
  source: unknown;
}

export function CallVideo({ trackRef, style, objectFit = 'cover', mirror }: {
  trackRef: CallTrackRef | undefined;
  style?: ViewStyle;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
}) {
  if (!LK_NATIVE || !trackRef) return <View style={[styles.placeholder, style]} />;
  const VideoTrack = LK_NATIVE.VideoTrack;
  return <VideoTrack trackRef={trackRef} style={style} objectFit={objectFit} mirror={mirror} />;
}

/**
 * The local and remote camera tracks, kept current.
 *
 * Returns `undefined` for either side until that camera is actually
 * publishing, which is what lets the call screen show the identity card
 * instead of a black rectangle while the picture is still on its way.
 */
export function useCallVideoTracks(room: LiveKitRoom | null, enabled: boolean): {
  local: CallTrackRef | undefined;
  remote: CallTrackRef | undefined;
} {
  const [tracks, setTracks] = useState<{ local?: CallTrackRef; remote?: CallTrackRef }>({});

  useEffect(() => {
    if (!room || !enabled || !LK_CLIENT) {
      setTracks({});
      return;
    }
    const Source = LK_CLIENT.Track.Source;
    const RoomEvent = LK_CLIENT.RoomEvent;

    function read() {
      if (!room) return;
      const localPublication = room.localParticipant.getTrackPublication(Source.Camera);
      const local = localPublication?.videoTrack
        ? { participant: room.localParticipant, publication: localPublication, source: Source.Camera }
        : undefined;

      let remote: CallTrackRef | undefined;
      // One remote participant in a 1-1 call; the loop is only here so a
      // third joiner cannot crash this, and the first camera found wins.
      for (const participant of room.remoteParticipants.values()) {
        const publication = participant.getTrackPublication(Source.Camera);
        if (publication?.videoTrack) {
          remote = { participant, publication, source: Source.Camera };
          break;
        }
      }
      setTracks({ local, remote });
    }

    read();
    // Every event that can change which cameras are publishing. Muting is in
    // the list because a far end that turns its camera off keeps the
    // publication but stops the picture, and the screen should fall back to
    // the identity card rather than freeze on the last frame.
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ];
    for (const event of events) room.on(event, read);
    return () => {
      for (const event of events) room.off(event, read);
    };
  }, [room, enabled]);

  return { local: tracks.local, remote: tracks.remote };
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#111' },
});
