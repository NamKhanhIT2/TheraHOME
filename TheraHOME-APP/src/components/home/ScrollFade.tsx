import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Home's reveal: every piece of content appears as it rises past the nav and
 * disappears as it meets the fixed header, on its own, in the order its
 * geometry puts it in.
 *
 * The unit is the ROW, not the card. A card is 290–420pt tall; ask it to be
 * gone before its top meets the header and it vanishes while all of it is
 * still on screen, let it fade in proportion to how much has crossed and its
 * top sits under the header at 90% opacity. Both were shipped and both were
 * reported — they are the same mistake, an edge effect applied to a unit far
 * larger than the edge.
 *
 * Positions are measured against the scroll content itself, with
 * `measureLayout`. The first version added up `onLayout` offsets level by
 * level, which breaks the moment anything that does not participate sits in
 * between — `GlassCard` did, so every row inside every card believed it was a
 * few points below the top of the stack. Rows then showed through the nav at
 * rest, vanished the instant a scroll began, or never appeared at all
 * (owner's three screenshots, 2026-10-25). Asking the platform where a view
 * actually is cannot drift like that.
 */

export interface ScrollFadeEnv {
  scrollY: SharedValue<number>;
  /** The scrolling content view, which every row measures itself against. */
  contentRef: React.RefObject<View | null>;
  /** Screen y the fixed header ends at, and the one the nav starts at. */
  headerBottom: number;
  tabTop: number;
  /** Viewport height — the thresholds below are fractions of it. */
  viewport: number;
  /**
   * Bumped whenever the content's own height changes. A row's `onLayout` does
   * NOT fire when a card above it grows — its position inside its own parent
   * did not change — so this is what tells everything to measure again.
   */
  version: number;
  /**
   * Screen travel per point of scroll. 1 for anything that simply scrolls;
   * the hero also translates itself as it leaves, so its rows cross the
   * header faster than the scroll offset alone would say.
   */
  speed: number;
}

const EnvContext = createContext<ScrollFadeEnv | null>(null);

export function ScrollFadeProvider({ value, children }: { value: ScrollFadeEnv; children: React.ReactNode }) {
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

/** Where a view sits inside the scroll content, asked of the platform. */
function useAbsoluteBox(env: ScrollFadeEnv | null, onMeasure?: (top: number, height: number) => void) {
  const ref = useRef<View>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const content = env?.contentRef;
  const measure = useCallback(() => {
    const node = ref.current;
    const parent = content?.current;
    if (!node || !parent) return;
    node.measureLayout(
      parent,
      (_x, y, _width, height) => {
        setBox((previous) =>
          previous && previous.top === y && previous.height === height ? previous : { top: y, height },
        );
        onMeasure?.(y, height);
      },
      () => undefined,
    );
    // `onMeasure` is a fresh closure on every render of the caller; including
    // it here would re-measure on every render instead of on every layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  return { ref, box, measure };
}

/**
 * A container that does not fade, but re-measures with everything else — for
 * the hero, which carries its own transform, and for anything that needs to
 * report where it ended up.
 */
export function FadeGroup({
  children,
  style,
  onMeasure,
  rasterize,
  pointerEvents,
}: {
  children: React.ReactNode;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  onMeasure?: (absoluteTop: number) => void;
  rasterize?: boolean;
  /** 'box-none' for a group whose own box is bigger than what it draws —
   * otherwise its empty padding swallows the taps of whatever it slides
   * over. See the card stack in Home. */
  pointerEvents?: ViewProps['pointerEvents'];
}) {
  const env = useContext(EnvContext);
  const { ref, measure } = useAbsoluteBox(env, (top) => onMeasure?.(top));
  const version = env?.version ?? 0;
  React.useEffect(measure, [measure, version]);
  return (
    <Animated.View
      ref={ref}
      style={style}
      onLayout={measure}
      pointerEvents={pointerEvents}
      shouldRasterizeIOS={rasterize}
      renderToHardwareTextureAndroid={rasterize}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The design's own curve, from its `ScrollFade`: an element is keyed to where
 * its CENTRE sits in the viewport. It fades in between 1.02 and 0.76 of the
 * way down, holds, and fades out between 0.34 and 0.10.
 *
 * Being centre-based is what makes it start early enough — the owner's note
 * was that the hiding began too close to the header (2026-10-25). A short row
 * is already a third of the way up the screen when it starts to go, which is
 * what the design screenshot shows.
 *
 * This fades the whole element. What happens WITHIN it at the very edge —
 * top half gone, bottom half still crisp — is the mask's job, not this one's;
 * the two together are what the design has.
 *
 * The numbers are the prototype's own, read out of `home-oura.jsx`:
 * `inK = (1.02 - c) / 0.26`, `outK = (c - 0.1) / 0.24`, `k = min(inK, outK)`.
 * Its fifth ingredient, `blur((1 - k) * 6px)`, has no equivalent in React
 * Native — it is the one part of this that cannot be reproduced.
 */
const AT = [1.02, 0.76, 0.34, 0.1];
const OPACITY = [0, 1, 1, 0];
/** The design lifts an element as it leaves, not only as it arrives:
 * `ty = (1 - inK) * 36 - (1 - outK) * 24`. Going up as it fades is most of
 * what makes it read as leaving rather than switching off. */
const TRANSLATE = [36, 0, 0, -24];
/** `scale(0.94 + 0.06k)` — the same 0.94 at both ends. */
const SCALE = [0.94, 1, 1, 0.94];

export interface RevealProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** The lift on arrival. Off for the hero, which has its own. */
  arrive?: boolean;
  /** Draw once and scale the bitmap instead of re-drawing every frame. Only
   * for rows whose contents are STILL — anything animating underneath
   * invalidates the cache on every frame and costs more than it saves. */
  rasterize?: boolean;
  onMeasure?: (absoluteTop: number, height: number) => void;
  /** Overrides the environment's speed for this subtree. */
  speed?: number;
}

export function Reveal({
  children,
  style,
  arrive = true,
  rasterize,
  onMeasure,
  speed: speedOverride,
}: RevealProps) {
  const env = useContext(EnvContext);
  const { ref, box, measure } = useAbsoluteBox(env, onMeasure);
  // A worklet closes over what it reads; the shared value has to be one of
  // those bindings rather than reached through a possibly-null context.
  const fallback = useSharedValue(0);
  const scroll = env?.scrollY ?? fallback;
  const version = env?.version ?? 0;
  React.useEffect(measure, [measure, version]);

  const speed = speedOverride ?? env?.speed ?? 1;

  // Everything the worklet needs, flattened to numbers it can close over.
  const top = box?.top ?? 0;
  const height = box?.height ?? 0;
  const viewport = env?.viewport ?? 1;
  const ready = !!env && box != null && box.height > 0;

  const fadeStyle = useAnimatedStyle(() => {
    // Until it has been measured a row has no idea where it is, and a
    // zero-height row (a card that rendered nothing) gets no interpolation at
    // all — an input range with no width is not one.
    if (!ready) return { opacity: 0 };
    const centre = top + height / 2;
    // The scroll offset at which the centre sits at a given fraction of the
    // viewport. Larger fraction, lower on screen, so this runs downwards and
    // the input range comes out increasing.
    const input = AT.map((fraction) => (centre - fraction * viewport) / speed);
    const opacity = interpolate(scroll.value, input, OPACITY, Extrapolation.CLAMP);
    if (!arrive) return { opacity };
    return {
      opacity,
      transform: [
        { translateY: interpolate(scroll.value, input, TRANSLATE, Extrapolation.CLAMP) },
        { scale: interpolate(scroll.value, input, SCALE, Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      ref={ref}
      shouldRasterizeIOS={rasterize}
      renderToHardwareTextureAndroid={rasterize}
      style={[style, fadeStyle]}
      onLayout={measure}
    >
      {children}
    </Animated.View>
  );
}
