import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const DIRECTIONS = require('../../../assets/mascot/nurse-directions.webp');
const REACTIONS = require('../../../assets/mascot/nurse-reactions.webp');

/** Both sheets are 3x3. On the
 * directions sheet columns are yaw — looking left / straight / right — and
 * rows are pitch — up / level / down. A sheet drawn to this layout but
 * mirrored would turn the head away from the touch instead of toward it, and
 * nothing would report it, so check that column 0 really does face the left
 * of the frame before swapping either file. */
const GRID = 3;
const FORWARD = { row: 1, col: 1 } as const;

/** The reaction cells, named by what they show. */
const REACTION = {
  /** Eyes closed, content. Short enough to read as a blink. */
  blink: { row: 0, col: 0 },
  /** A heart overhead. */
  love: { row: 0, col: 1 },
  /** Sparkles overhead. */
  delight: { row: 0, col: 2 },
  /** Round mouth, wide eyes. */
  surprise: { row: 1, col: 0 },
  /** Star eyes, open smile. */
  excited: { row: 1, col: 1 },
  /** Blushing, eyes closed — a quiet "nice one". */
  pleased: { row: 1, col: 2 },
  /** Zzz overhead. */
  sleepy: { row: 2, col: 0 },
  /** Open-mouthed laugh. */
  laugh: { row: 2, col: 2 },
} as const;

/** The reactions something in the app can ask for, and how long each holds. */
export type MascotCueKind = 'pleased' | 'excited' | 'surprise' | 'laugh' | 'love';

const CUE_HOLD_MS: Record<MascotCueKind, number> = {
  pleased: 1200,
  excited: 2200,
  surprise: 1500,
  laugh: 1800,
  love: 1800,
};

/**
 * A one-shot reaction.
 *
 * `token` exists so the same reaction can fire twice in a row — drinking two
 * cups of water is two separate "pleased", and a bare `kind` would look
 * unchanged to React the second time.
 */
export interface MascotCue {
  kind: MascotCueKind;
  token: number;
}

/** Colours the idle loop. Not a reaction — it changes what the mascot does
 * when nothing in particular is happening. */
export type MascotMood = 'default' | 'night' | 'celebrating';

type Cell = { sheet: 'directions' | 'reactions'; row: number; col: number };

const IDLE_FORWARD: Cell = { sheet: 'directions', ...FORWARD };

/** How far a touch has to be off-centre before the head turns, so a tap right
 * next to the face does not make it twitch. */
const LOOK_DEADZONE = 28;

function directionFor(dx: number, dy: number): Cell {
  const col = dx < -LOOK_DEADZONE ? 0 : dx > LOOK_DEADZONE ? 2 : 1;
  const row = dy < -LOOK_DEADZONE ? 0 : dy > LOOK_DEADZONE ? 2 : 1;
  return { sheet: 'directions', row, col };
}

export interface MascotFaceProps {
  size: number;
  /** Where the user last touched, in window coordinates — the head turns to
   * face it. Null when the glance has expired. */
  lookAt?: { x: number; y: number } | null;
  /** True while the button is held. */
  excited?: boolean;
  /** A reaction to a real event — see MascotCue. */
  cue?: MascotCue | null;
  /** What the idle loop should lean towards. */
  mood?: MascotMood;
}

/**
 * The assistant's face: a sprite picked out of two 3x3 sheets, so it can look
 * around and react instead of sitting still.
 *
 * Both sheets are mounted at once and switched by opacity. Swapping the
 * `source` instead would make the first reaction of a session flash blank
 * while that file decodes, which is the one moment it must not.
 *
 * What makes it read as alive, in order of precedence:
 *   - held      → star eyes, and a spring pop
 *   - cued      → a reaction to something that actually happened in the app
 *                 (see MascotCue; Home fires these off real data)
 *   - looked at → the head turns toward the last touch anywhere on Home
 *   - otherwise → an idle loop that blinks, glances about and occasionally
 *                 sparkles, on a randomised delay so it never looks
 *                 metronomic — leaning sleepy at night and affectionate once
 *                 the programme is finished (see MascotMood)
 * plus a slow breath under all of it. Every bit of motion is gated on the
 * OS Reduce Motion setting, which leaves a still, forward-facing face.
 */
export function MascotFace({ size, lookAt, excited = false, cue = null, mood = 'default' }: MascotFaceProps) {
  const reduceMotion = useReduceMotion();
  const [idle, setIdle] = useState<Cell>(IDLE_FORWARD);
  const [cueCell, setCueCell] = useState<Cell | null>(null);
  const containerRef = useRef<View>(null);
  const centre = useRef<{ x: number; y: number } | null>(null);
  // The measurement lands in a ref, and writing a ref renders nothing. A
  // mascot that has just mounted therefore drew its first frame with no
  // centre to compare against, threw away whatever glance was already
  // waiting for it, and had nothing to make it look again until the idle
  // loop ticked — by which time the glance had expired. Switching tabs
  // mounts exactly such a mascot, which is why tapping a tab appeared to do
  // nothing. This flag exists only to turn that measurement into a render.
  const [measured, setMeasured] = useState(false);

  // --- reactions to real events ----------------------------------------
  const cueKind = cue?.kind;
  const cueToken = cue?.token;
  useEffect(() => {
    if (!cueKind || cueToken == null) return undefined;
    setCueCell({ sheet: 'reactions', ...REACTION[cueKind] });
    const timer = setTimeout(() => setCueCell(null), CUE_HOLD_MS[cueKind]);
    return () => clearTimeout(timer);
  }, [cueKind, cueToken]);

  // --- idle life -------------------------------------------------------
  useEffect(() => {
    if (reduceMotion) {
      setIdle(IDLE_FORWARD);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let revert: ReturnType<typeof setTimeout> | undefined;

    const back = (after: number) => {
      revert = setTimeout(() => {
        if (!cancelled) setIdle(IDLE_FORWARD);
      }, after);
    };

    const glance = () => {
      // A glance to one side, mostly level, sometimes up.
      setIdle({
        sheet: 'directions',
        row: Math.random() < 0.3 ? 0 : 1,
        col: Math.random() < 0.5 ? 0 : 2,
      });
      back(900);
    };

    const tick = () => {
      const roll = Math.random();
      if (mood === 'night') {
        // Late on, it mostly dozes rather than looking about.
        if (roll < 0.45) {
          setIdle({ sheet: 'reactions', ...REACTION.blink });
          back(150);
        } else if (roll < 0.65) {
          glance();
        } else {
          setIdle({ sheet: 'reactions', ...REACTION.sleepy });
          back(1500);
        }
      } else if (mood === 'celebrating') {
        if (roll < 0.4) {
          setIdle({ sheet: 'reactions', ...REACTION.blink });
          back(150);
        } else if (roll < 0.65) {
          glance();
        } else if (roll < 0.85) {
          setIdle({ sheet: 'reactions', ...REACTION.delight });
          back(750);
        } else {
          setIdle({ sheet: 'reactions', ...REACTION.love });
          back(1100);
        }
      } else if (roll < 0.55) {
        setIdle({ sheet: 'reactions', ...REACTION.blink });
        back(150);
      } else if (roll < 0.88) {
        glance();
      } else {
        setIdle({ sheet: 'reactions', ...REACTION.delight });
        back(750);
      }
      schedule();
    };

    const schedule = () => {
      timer = setTimeout(tick, 1600 + Math.random() * 2600);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (revert) clearTimeout(revert);
    };
  }, [mood, reduceMotion]);

  // --- breath + press pop ----------------------------------------------
  const breath = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, reduceMotion]);

  useEffect(() => {
    pop.value = reduceMotion ? 0 : withSpring(excited ? 1 : 0, { damping: 11, stiffness: 260 });
  }, [excited, pop, reduceMotion]);

  const liveStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + breath.value * 0.035 + pop.value * 0.12 },
      { translateY: -breath.value * 1.2 },
    ],
  }));

  // --- which cell is showing -------------------------------------------
  // Held beats a real event beats a glance beats the idle loop.
  let visible: Cell = idle;
  if (excited) {
    visible = { sheet: 'reactions', ...REACTION.excited };
  } else if (cueCell) {
    visible = cueCell;
  } else if (lookAt && measured && centre.current) {
    visible = directionFor(lookAt.x - centre.current.x, lookAt.y - centre.current.y);
  }

  const sheetSize = size * GRID;
  const layer = (
    key: Cell['sheet'],
    source: number,
    fallback: { row: number; col: number },
  ) => {
    const active = visible.sheet === key;
    const at = active ? visible : fallback;
    return (
      <Image
        key={key}
        source={source}
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        style={[
          styles.sprite,
          {
            width: sheetSize,
            height: sheetSize,
            left: -size * at.col,
            top: -size * at.row,
            opacity: active ? 1 : 0,
          },
        ]}
      />
    );
  };

  return (
    <Animated.View
      ref={containerRef}
      style={[{ width: size, height: size }, styles.window, liveStyle]}
      onLayout={() => {
        // Window coordinates, because `lookAt` arrives in them too — the touch
        // is reported by the screen, not by this button's parent.
        containerRef.current?.measureInWindow((x, y, width, height) => {
          centre.current = { x: x + width / 2, y: y + height / 2 };
          setMeasured(true);
        });
      }}
    >
      {layer('directions', DIRECTIONS, FORWARD)}
      {layer('reactions', REACTIONS, REACTION.blink)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: 'hidden',
  },
  sprite: {
    position: 'absolute',
  },
});
