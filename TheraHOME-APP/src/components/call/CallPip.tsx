// The small self-view, with the two behaviours everyone already expects
// from it: you can drag it out of the way, and tapping it swaps it with the
// big picture.
//
// Both come from the same place — on Messenger and Zalo the little window
// is in the way exactly when something important is underneath it, and the
// learned response is to flick it to another corner. A self-view that
// cannot be moved makes people hold the phone differently instead.
//
// Built on PanResponder and the Animated API, which ship with React Native,
// rather than adding a gesture library for sixty lines. The drag follows
// the finger and then springs to whichever corner it was let go nearest,
// so it can never be left half off the screen or on top of the controls.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PIP_WIDTH = 108;
export const PIP_HEIGHT = 160;
/** Clear of the status bar at the top and of the control row at the bottom:
 * a corner the buttons occupy is not a corner. Measured from the safe area
 * rather than from the screen, so it clears a notch or an island too. */
const EDGE = 16;
const TOP_GAP = 8;
/** Roughly the height of the control row plus the End button beneath it. */
const CONTROLS_HEIGHT = 190;
/** Past this much movement it is a drag, and the release is not a tap. */
const DRAG_SLOP = 5;

export function CallPip({ onPress, children }: {
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const corners = useMemo(() => {
    const top = insets.top + TOP_GAP;
    return {
      left: EDGE,
      right: Math.max(EDGE, width - PIP_WIDTH - EDGE),
      top,
      bottom: Math.max(top, height - insets.bottom - PIP_HEIGHT - CONTROLS_HEIGHT),
    };
  }, [width, height, insets.top, insets.bottom]);

  // Opens where every other caller puts it: top right.
  const position = useRef(new Animated.ValueXY({ x: corners.right, y: corners.top })).current;
  // Animated values cannot be read synchronously, and the snap needs to know
  // where the window actually is, so a listener mirrors it.
  const current = useRef({ x: corners.right, y: corners.top });
  const dragged = useRef(false);
  // Once the user has put the window somewhere, it stays there. Until then
  // it follows the default corner — which matters because the safe-area
  // insets arrive a render after the first layout, and a window parked
  // against a stale inset sits under the notch.
  const everDragged = useRef(false);
  // Read inside the responder, which is built once and must not capture a
  // stale screen size or a stale handler.
  const cornersRef = useRef(corners);
  cornersRef.current = corners;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    const id = position.addListener((value) => { current.current = value; });
    return () => position.removeListener(id);
  }, [position]);

  useEffect(() => {
    if (everDragged.current) return;
    position.setValue({ x: corners.right, y: corners.top });
  }, [corners, position]);

  const responder = useMemo(() => PanResponder.create({
    // Claim the touch only once it has travelled: a stationary finger is a
    // tap, and taps belong to the swap.
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > DRAG_SLOP || Math.abs(gesture.dy) > DRAG_SLOP,
    onPanResponderGrant: () => {
      dragged.current = false;
      // Folds the current position into the offset so the gesture's dx/dy
      // can be written straight onto the value.
      position.extractOffset();
    },
    onPanResponderMove: (_event, gesture) => {
      if (Math.abs(gesture.dx) > DRAG_SLOP || Math.abs(gesture.dy) > DRAG_SLOP) {
        dragged.current = true;
        everDragged.current = true;
      }
      position.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: () => {
      position.flattenOffset();
      if (!dragged.current) {
        onPressRef.current?.();
        return;
      }
      const edges = cornersRef.current;
      const { x, y } = current.current;
      // Nearest corner by the window's own centre, not by the finger.
      const toLeft = x + PIP_WIDTH / 2 < width / 2;
      const toTop = y + PIP_HEIGHT / 2 < height / 2;
      Animated.spring(position, {
        toValue: { x: toLeft ? edges.left : edges.right, y: toTop ? edges.top : edges.bottom },
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }).start();
    },
    // A call coming in, or the app losing focus mid-drag, must not strand it.
    onPanResponderTerminate: () => {
      position.flattenOffset();
    },
  }), [position, width, height]);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.pip, { left: 0, top: 0, transform: position.getTranslateTransform() }]}
    >
      <View style={styles.clip}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pip: {
    position: 'absolute',
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 14,
    backgroundColor: '#111',
    // Lifted off the picture behind it, the way every other caller draws it.
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  clip: { flex: 1, borderRadius: 14, overflow: 'hidden' },
});
