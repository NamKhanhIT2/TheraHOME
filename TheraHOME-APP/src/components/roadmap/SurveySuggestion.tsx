import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { MascotLampIntro } from '@/components/roadmap/MascotLampIntro';
import { useI18n } from '@/lib/i18n';

// Owner-supplied typing sound (extracted from their 0909 clip). It plays as a
// background track for the whole reveal — started when the typing begins,
// stopped when it finishes or the viewer skips — not one tap per key.
const TYPING_SOUND = require('../../../assets/sounds/typing-sound.m4a');
// Same brandmark as the auth screens, shown at the top of the content.
const BRANDMARK = require('../../../assets/brandmark-gradient.png');

// Lightweight inline markup admins can use in the suggestion content:
//   *text*  → highlighted (brand colour), for the point that should stand out
//   ~text~  → dimmed (muted colour), for less important lines
// parseMarkup strips the markers and returns the display text plus a per-char
// tag, so the typewriter types the clean text and each character keeps its style.
// Text colours for this screen are FIXED, never theme tokens: the wellness
// background image is always light, so theme.colors.textPrimary (white in dark
// mode) made every unmarked line invisible. Same brand palette as the brandmark
// styles at the bottom of this file — navy body, soft grey for ~dim~, blue for *em*.
const SUGGESTION_TEXT = '#174C78';
const SUGGESTION_DIM = '#6E84A2';
const SUGGESTION_EM = '#078BE4';

type MTag = 'normal' | 'em' | 'dim';
function parseMarkup(raw: string): { display: string; tags: MTag[] } {
  let display = '';
  const tags: MTag[] = [];
  let cur: MTag = 'normal';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '*') {
      cur = cur === 'em' ? 'normal' : 'em';
      continue;
    }
    if (ch === '~') {
      cur = cur === 'dim' ? 'normal' : 'dim';
      continue;
    }
    display += ch;
    tags.push(cur);
  }
  return { display, tags };
}

// expo-audio is a native module (added 2026-09-09). A JS bundle served over
// Metro to an app binary built BEFORE it was added has no 'ExpoAudio' native
// module, and calling useAudioPlayer there throws
// "Cannot find native module 'ExpoAudio'". Gate on the module actually being
// present so the screen degrades to SILENT instead of crashing — the sound
// comes back on its own once a native build that includes expo-audio ships.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EXPO_AUDIO = requireOptionalNativeModule('ExpoAudio') ? require('expo-audio') : null;

// Typewriter timing (ms). Title types a touch slower so it reads as a
// heading; the body is brisker so a whole paragraph doesn't drag.
const TITLE_SPEED = 45;
// Part 2 (body) types with the same deliberate, readable cadence as the title
// (was much faster — a paragraph flew by too quickly to read).
const BODY_SPEED = 38;
const TITLE_HOLD = 900; // fully-typed title lingers before it leaves
const HANDOFF = 260; // gap while the title fades out before the body starts

type Phase = 'title' | 'body';

/**
 * The "Gợi ý từ TheraHOME" content, revealed as a typewriter (per explicit
 * request 2026-09-09): the TITLE types out first, holds, then DISAPPEARS, and
 * only then does the BODY type out. Tap anywhere to skip to the finished
 * state; reduce-motion shows the resting state (body) with no animation.
 */
export function SurveySuggestion({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [skip, setSkip] = useState(false);
  // The mascot-lamp intro plays first; the typewriter waits for it to finish.
  const [introDone, setIntroDone] = useState(false);
  const [phase, setPhase] = useState<Phase>('title');
  const [titleGone, setTitleGone] = useState(false);
  const [typed, setTyped] = useState(''); // typed portion of whichever field is active
  const [bodyDone, setBodyDone] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);

  // Background typing sound. `player` is null when the native audio module
  // isn't in this binary (see EXPO_AUDIO) — start/stop then no-op. The
  // EXPO_AUDIO gate is a build-time constant, so the hook is called the same
  // way on every render of a given build.
  const player = EXPO_AUDIO
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? (EXPO_AUDIO.useAudioPlayer(TYPING_SOUND) as { volume: number; loop: boolean; seekTo: (s: number) => void; play: () => void; pause: () => void })
    : null;
  useEffect(() => {
    if (!player) return;
    try {
      player.volume = 1.0;
      // No loop: the clip is long enough to cover the whole reveal, so it
      // plays through once with no seam. It's started with the typing, paused
      // through the gap, and stopped the moment the reveal ends — so the sound
      // and the text begin and end together.
      player.loop = false;
    } catch {
      // player not ready yet — defaults are fine
    }
  }, [player]);
  const startAudio = useCallback(() => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore playback hiccups — the sound is decorative
    }
  }, [player]);
  const stopAudio = useCallback(() => {
    if (!player) return;
    try {
      player.pause();
    } catch {
      // ignore
    }
  }, [player]);
  // Resume from the paused position (not from 0) so the sound stays in sync
  // with the text after a pause — used when the body starts typing.
  const resumeAudio = useCallback(() => {
    if (!player) return;
    try {
      player.play();
    } catch {
      // ignore
    }
  }, [player]);

  // Resolve the reduce-motion preference once before deciding how to reveal.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  // Blinking cursor — independent of the typing loop so it keeps ticking
  // while a field holds.
  useEffect(() => {
    if (bodyDone) return; // no cursor once everything is shown
    const id = setInterval(() => setCursorOn((c) => !c), 500);
    return () => clearInterval(id);
  }, [bodyDone]);

  // Parse the markup once; the typewriter types the display text (markers
  // stripped), and rendering uses the per-char tags for highlight/dim.
  const titleP = parseMarkup(title);
  const bodyP = parseMarkup(body);
  const displayTitle = titleP.display;
  const displayBody = bodyP.display;

  // The reveal itself. Re-runs (cancelling its timers) if the viewer taps to
  // skip or the content changes.
  useEffect(() => {
    if (reduceMotion === null) return; // wait for the preference

    // Finished/instant state: title gone, body fully shown, no sound.
    if (reduceMotion || skip) {
      setPhase('body');
      setTitleGone(true);
      setTyped(displayBody);
      setBodyDone(true);
      stopAudio();
      return;
    }

    // Hold the typewriter until the mascot-lamp intro has finished.
    if (!introDone) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const type = (text: string, speed: number, done: () => void) => {
      setTyped('');
      let i = 0;
      const step = () => {
        if (cancelled) return;
        i += 1;
        setTyped(text.slice(0, i));
        if (i >= text.length) {
          done();
          return;
        }
        timers.push(setTimeout(step, speed));
      };
      timers.push(setTimeout(step, speed));
    };

    setPhase('title');
    setTitleGone(false);
    setBodyDone(false);
    startAudio();
    type(displayTitle, TITLE_SPEED, () => {
      // Title finished typing — silence the sound through the hold + fade gap
      // (no typing = no sound), then resume it exactly as the body starts.
      stopAudio();
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setTitleGone(true); // fade the title out
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setPhase('body');
              resumeAudio();
              type(displayBody, BODY_SPEED, () => {
                setBodyDone(true);
                stopAudio();
              });
            }, HANDOFF),
          );
        }, TITLE_HOLD),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      stopAudio();
    };
  }, [reduceMotion, skip, introDone, displayTitle, displayBody, startAudio, stopAudio, resumeAudio]);

  // Thin caption-style caret to match the reference (typewriter "|"), not a
  // block cursor. A hair space when off keeps the line width from jumping.
  const cursor = cursorOn ? '|' : ' ';

  // The mascot-lamp intro plays first (skipped under reduce-motion). The text
  // content stays hidden underneath until the intro hands off.
  const showIntro = reduceMotion === false && !skip && !introDone;
  const contentReady = introDone || reduceMotion === true || skip;

  // Both parts (Phần 1 · Tiêu đề and Phần 2 · Nội dung) share one style — same
  // size, weight and colour, so neither reads as a "heading" over the other
  // (per explicit request).
  // FIXED colours, not theme tokens: this screen sits on a fixed LIGHT wellness
  // background image, so in dark mode `textPrimary` came out white and the
  // whole text vanished into the image (owner screenshot, build 20). Navy /
  // grey / blue below are the brand colours already used for the brandmark.
  const partTextStyle = {
    fontSize: 20,
    lineHeight: 29,
    color: SUGGESTION_TEXT,
    fontFamily: theme.fontFamily.semiBold,
  };

  // Group consecutive same-tag characters of one line into styled Text runs.
  const renderRuns = (chars: { c: string; tag: MTag }[]) => {
    const runs: { tag: MTag; text: string }[] = [];
    for (const { c, tag } of chars) {
      const last = runs[runs.length - 1];
      if (last && last.tag === tag) last.text += c;
      else runs.push({ tag, text: c });
    }
    return runs.map((r, i) => (
      <Text
        key={i}
        style={r.tag === 'em' ? { color: SUGGESTION_EM } : r.tag === 'dim' ? { color: SUGGESTION_DIM } : undefined}
      >
        {r.text}
      </Text>
    ));
  };

  // Per-line layout. TITLE: first line is the centred, slightly larger heading;
  // the rest are justified (căn hai bên). BODY: the last line is centred, the
  // rest left-aligned. Highlight/dim come from the *…* / ~…~ markup.
  const renderPart = (parsed: { display: string; tags: MTag[] }, kind: 'title' | 'body', showCursor: boolean) => {
    const totalLines = parsed.display.split('\n').length;
    const lines: { c: string; tag: MTag }[][] = [[]];
    for (let i = 0; i < typed.length; i += 1) {
      const c = typed[i];
      if (c === '\n') {
        lines.push([]);
        continue;
      }
      lines[lines.length - 1].push({ c, tag: parsed.tags[i] ?? 'normal' });
    }
    return (
      <View style={styles.paras}>
        {lines.map((chars, li) => {
          const isCurrent = li === lines.length - 1;
          let align: 'left' | 'center' | 'justify';
          let fontSize = 20;
          if (kind === 'title') {
            // All centred (justify stretched the spacing unevenly); the first
            // line is the larger heading.
            align = 'center';
            fontSize = li === 0 ? 25 : 20;
          } else {
            align = li === totalLines - 1 ? 'center' : 'left';
          }
          return (
            <Text
              key={li}
              style={[partTextStyle, { textAlign: align, fontSize, lineHeight: Math.round(fontSize * 1.42), marginTop: li === 0 ? 0 : 8 }]}
            >
              {renderRuns(chars)}
              {isCurrent && showCursor ? cursor : ''}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <Pressable style={styles.body} onPress={bodyDone ? undefined : () => setSkip(true)}>
      {contentReady ? (
        <View style={styles.brandBlock} pointerEvents="none">
          <Image source={BRANDMARK} resizeMode="contain" style={styles.brandmark} />
          <Text style={styles.brand}>
            Thera<Text style={styles.brandAccent}>HOME</Text>
          </Text>
        </View>
      ) : null}

      {contentReady && !titleGone ? (
        <Reanimated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(220)} style={styles.paras}>
          {renderPart(titleP, 'title', true)}
        </Reanimated.View>
      ) : null}

      {contentReady && phase === 'body' ? (
        <Reanimated.View entering={FadeIn.duration(220)} style={styles.paras}>
          {renderPart(bodyP, 'body', !bodyDone)}
        </Reanimated.View>
      ) : null}

      {contentReady ? (
        bodyDone ? (
          <Reanimated.View entering={FadeIn.duration(240)} style={styles.footer}>
            <Button style={{ width: '100%' }} onPress={onClose}>
              {t('quizContinue')}
            </Button>
          </Reanimated.View>
        ) : (
          <Text style={[theme.type.captionSm, { color: SUGGESTION_DIM, marginTop: 22 }]}>{t('tapToSkip')}</Text>
        )
      ) : null}

      {showIntro ? <MascotLampIntro onDone={() => setIntroDone(true)} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // Extra bottom padding lifts the vertically-centred content up a bit so it
    // doesn't sit low under the logo.
    paddingBottom: 120,
  },
  paras: {
    width: '100%',
  },
  footer: {
    width: '100%',
    marginTop: 28,
  },
  brandBlock: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandmark: {
    width: 82,
    height: 74,
  },
  brand: {
    color: '#174C78',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  brandAccent: {
    color: '#078BE4',
  },
});
