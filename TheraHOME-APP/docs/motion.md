# Motion system (Reanimated conventions)

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## Motion system (added 2026-08-22)

`react-native-reanimated` (4.5.1) + `react-native-worklets` (its babel-plugin
peer dep as of the v4 split) were added for an app-wide "missing transitions"
pass — tab switches, card/list entrances, a roadmap day-completion sequence,
reaction-tray/chart/badge tweens. This needed a `babel.config.js` that didn't
exist before (the project ran on Expo's implicit default config); it now
explicitly declares `babel-preset-expo` (added as a devDependency — it
wasn't hoisted to root `node_modules` otherwise) plus
`react-native-worklets/plugin` (must stay last in the plugins array).
Verified end-to-end via `npx expo export --platform ios` (a full Metro
bundle), since there's no device/simulator in an agent sandbox to visually
confirm animations — re-run that after any further babel/reanimated config
change. Reanimated 4 requires the New Architecture; this RN/Expo version
already defaults to it, no explicit `newArchEnabled` needed.

Pre-existing screens already had scattered RN-core `Animated` usage (chart
reveal, water ring, scroll parallax, `ProductDropdown`'s dropdown spring +
"Active Device Light" border comet) — all left untouched by that pass
(**never migrate working `Animated` code to Reanimated just because it's
nearby**; the two coexist fine in one component). New motion is Reanimated
throughout. Shared pieces, reuse rather than re-solving:
- `src/hooks/useReduceMotion.ts` — OS Reduce Motion; gate any hand-rolled
  `withTiming`/`withSpring` through it (Reanimated's built-in `entering`/
  `exiting` presets already auto-respect it via `ReduceMotion.System`, no
  extra gating needed for those).
- `src/hooks/useTabFocusFade.ts` — fade+translateY(6px) on each of the 4
  bottom-tab screens via `useFocusEffect` (works with `Tabs` keeping screens
  mounted — no unmount/remount needed, and it correctly *doesn't* replay on
  ordinary re-renders since those don't touch navigation focus).
- `src/lib/motion.ts` — `fadeUpEntering(delay, translateY?, duration?)` and
  `staggerDelay(index, step?, max?)` (caps how many list items actually
  stagger, so item 50 isn't stuck waiting seconds) — the standard "reveal
  once on mount" entrance used for Home's below-fold cards, Roadmap's day
  list/phase headers, Store's product cards, Community's feed/comments. A
  *new* item mounting (new array key — a freshly created post/comment)
  naturally replays this the same way, which is why "new post/comment
  animates in" needed no separate code path.
- `src/hooks/usePressScale.ts` / `src/components/motion/ScalePressable.tsx`
  — the 1→0.98 spring press feedback (Store cards/buttons).
- `src/components/motion/Collapsible.tsx` — height+opacity expand/collapse
  (Community reply threads). Renders children twice (once invisibly, to
  measure natural height — RN has no measure-before-paint API) — a real but
  accepted cost given reply lists are short.
- `src/components/motion/TransitionText.tsx` — crossfade a text value on
  change (old fades/slides up out, new fades/slides up in) via a keyed
  remount; used for Home's hero-card day/phase line and the notification
  badge count.
- `src/hooks/usePopOnChange.ts` — one-time micro-pop (scale bump) when a
  dependency changes, skipping the initial mount; used for the badge.
- Deliberately **not** applied to `ReactionSummary` (small reaction badges
  on every feed/comment row) or the chat bubble reaction badge — those can
  have dozens of instances on screen while scrolling, where a continuous
  per-row animation would be a real perf regression, not a polish win.
- `PainChart.tsx` gained `AnimatedChartPoint` (Reanimated `useAnimatedProps`
  on `Circle`/`SvgText`) so a same-range data change tweens each point to
  its new x/y instead of snapping — additive next to the pre-existing
  RN-`Animated` curtain-reveal-on-range-change, which still owns that
  transition untouched (`skipAnimation` on the point tween is keyed off a
  "did `range` itself just change" ref check, specifically to avoid the two
  competing).
- `PathNode.tsx` (Roadmap day nodes) sequences a day's `current`→`done`
  transition: circle color tweens via `interpolateColor` on a 0/1/2 "stage"
  shared value (locked/current/done), the checkmark pops in via the
  built-in `ZoomIn` entering preset (a lucide icon can't be stroke-drawn
  like a hand-authored SVG check — this is the closest equivalent), the
  connector line fills downward (`scaleY` + `transformOrigin: 'top'`), and
  the *next* day's own instance gets a delayed emphasize-pop when its
  status flips `locked`→`current` (a fixed heuristic delay, not true
  cross-component sequencing — there's no orchestrator watching sibling
  animations finish).

