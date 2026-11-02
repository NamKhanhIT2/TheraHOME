// What the call looks like once it is a floating window over another app.
//
// Picture-in-picture does not give the system a new view to draw: it takes
// THIS app's window and shrinks it, so whatever is on screen is what ends
// up in the little rectangle. A whole call screen scaled to an inch tall is
// unreadable — a hangup button too small to hit, a name clipped to two
// letters — so the app swaps itself for this while the window is up.
//
// It holds the three things that have to survive being made tiny: who, how
// long, and the fact that it is still running. Nothing else, and nothing
// interactive: a PiP window receives no touches at all (a tap on it expands
// the app back to full screen, which is the way back into the call), so a
// button drawn here would be a button that cannot be pressed.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { CallVideo, type CallTrackRef } from '@/components/call/CallVideo';

export function CallWindowView({ name, status, track, muted }: {
  name: string;
  /** Already formatted: a duration, or "Đang gọi…" while it rings. */
  status: string;
  /** The far end's camera, when there is one. */
  track: CallTrackRef | undefined;
  muted: boolean;
}) {
  const theme = useTheme();
  return (
    // Opaque and over everything: this is mounted above the router's Stack,
    // and the app underneath must not show through the gaps.
    <View style={styles.window}>
      {track ? (
        <CallVideo trackRef={track} style={styles.fill} objectFit="cover" />
      ) : (
        <View style={styles.identity}>
          <View style={[styles.dot, { backgroundColor: theme.colors.success }]}>
            <Icon name={muted ? 'mic-off' : 'phone'} size={14} color="#fff" />
          </View>
        </View>
      )}
      {/* Over the video rather than beside it: the window is too small to
          give a caption a row of its own, and a dark strip stays legible on
          top of any picture. */}
      <View style={styles.caption}>
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
        <Text numberOfLines={1} style={styles.status}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  window: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#101418' },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // Deliberately not theme typography: those sizes are chosen for a phone
  // screen, and this view is about an inch tall.
  name: { color: '#fff', fontSize: 12, fontWeight: '700' },
  status: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
});
