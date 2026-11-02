# Home v3 (and Lộ trình) — the owner's standing UI rules

Written down on 2026-10-25 at the owner's request, after the same rules were
broken and re-fixed several times. **Read this before changing anything on
`app/(tabs)/home.tsx` or `src/components/home/`.** If a change here conflicts
with one of these, the rule wins unless the owner says otherwise.

Each rule says what it is and, where it matters, why the obvious
implementation is wrong.

## Edges — what may be seen, and where

1. **Nothing is ever visible under the fixed header.** Not at 10% opacity,
   not for one frame.
2. **Nothing is ever visible below or behind the floating nav**, including at
   rest, before any scrolling has happened.
3. **The top edge dissolves BY PIXEL, not by element.** The upper half of a
   chart must be able to be half gone while its lower half is still crisp
   (owner, 2026-10-25, quoting the design's own spec). That means a mask over
   the scroller — `MaskedView` with a vertical alpha gradient — and it is the
   one thing opacity cannot imitate: a whole row fading either vanishes while
   it still has open space below the header, or shows its top through it.
   Both were shipped, both were rejected.
4. The dissolve band sits just above the header's lower edge, so content is
   at full strength everywhere it has open space and loses itself in the band
   the header covers. The header's own backdrop gradient (transparent at
   rest, darkening as the hero goes) finishes the separation.
5. The bottom band fades content out before the nav rather than letting it
   slide under.
6. **A row also fades as a whole, on the design's own curve**, keyed to
   where its CENTRE sits in the viewport: in between 1.02 and 0.76 of the way
   down, out between 0.34 and 0.06. Centre-based is what makes it start early
   enough — "hiding must begin lower down the screen, not at the header"
   (owner, 2026-10-25). The mask then finishes the job at the edge; the two
   together are what the design has, and neither alone was accepted.
7. Positions come from `measureLayout` against the scroll content, not from
   adding up `onLayout` offsets — a view that does not participate (like
   `GlassCard`) silently breaks the chain.

## Composition

8. **Cards have no background.** No tint, no rim, no shadow: content sits
   directly on the app's own background. The gap between blocks is what
   separates them (2026-10-24).
9. The scrolling stack lines up with the hero: 14pt from the screen edge plus
   8pt inside each block.
10. Anything that renders no content renders nothing at all — never an empty
   frame, never a placeholder box.

## The hero

11. The day numeral is centred on the NUMBER horizontally, not on the whole
    "NGÀY n/N" group, and sits low enough not to overlap the photograph's
    subject.
12. The arc is thin and bright ("thanh thoát, sắc tinh khôi"), with a bloom
    made of concentric strokes — **react-native-svg filter primitives draw
    nothing at all on iOS**.
13. The mascot must feel alive: idle motion, and reactions to real events
    (water logged, goal reached), never to a timer alone.

## Water

14. The dial follows the owner's reference image: bezel, tick marks, needle,
    a knob either side. Radii are measured off that image, not estimated.
15. **The needle is red and must not touch the blue band.**
16. `+` / `−` change the number on the frame they are pressed. Never wait for
    the mutation to come back.

## Health

17. Today's Apple Activity rings and step count, from HealthKit.
18. **Never show rings of zero against goals nobody set.** A phone with no
    Apple Watch has no activity summary; show what the phone itself counts
    (steps, distance, flights) and say why the other rings are missing.

## Type and surface

19. SF Pro on iOS for this screen (`heroFont`), Inter elsewhere.
20. Raised chips, the nav and buttons keep their neumorphic rim
    (`NeumorphicSurface`); it is painted, because React Native has no inset
    shadow.

## Motion and cost

21. **No live blur.** A `UIVisualEffectView` re-blurs its backdrop every
    frame; with one over the hero, one frame in four was dropped on the
    owner's iPhone 11 Pro Max. The mask stays (rule 3) — it was removed with
    the blur and had to come back, so its cost is now the budget's problem,
    not a reason to drop it. The photograph's blurred copy carries what is
    left of the design's `blur(0 → 6px)` on the hero.
22. Judge smoothness by counting frozen frames in a screen recording (the
    method and the numbers are in `feature-notes.md`, 2026-10-24), never by
    eye, and never from a debug build.
23. After the splash the owner expects Home itself — no white flash, no
    skeleton. Data is warmed under the splash and the last session's answers
    are read from disk.

## Working language

24. Replies and questions to the owner are in Vietnamese; code, paths and
    comments stay in English.


## Copy

25. Vietnamese copy on this screen is written, not generated: short
    sentences, no em-dashes standing in for a clause, no "số liệu" where
    "bạn đi được bao nhiêu" says it. The owner can tell, and has said so.
26. A switch that the OS can refuse (notification permission) must correct
    itself and say why, rather than staying on.

27. Home's scroll animation is **Reanimated**, driven by
    `useAnimatedScrollHandler` — not RN `Animated`. RN's native driver updates
    a frame behind the scroll view, and `scrollEventThrottle` feeds it: at 64
    it kicked the whole screen backwards four times a second. Anything
    scroll-linked added here belongs in a `useAnimatedStyle`.
28. Dividers between sections are hairlines with nothing written on them.

29. Lộ trình uses the same dark palette and the same floating bar as Home.
    Today's row is marked with a surface and a thin accent rim — never a red
    ring or a glow ("loè loẹt").
30. The floating bar sits at `navBottomOffset(inset)`; anything that has to
    clear it reads that function rather than repeating the number.

31. Each tab has its own ground: Home the photograph, Lộ trình and Cửa hàng
    the blue sky, Cộng đồng the violet one. The floating bar is shared and
    identical on all four.
32. Accents are per surface, not global: blue for Home and the roadmap's
    completed days (`tick`), red for today, violet for Cộng đồng.
