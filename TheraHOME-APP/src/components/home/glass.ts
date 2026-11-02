import { Platform } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { homeGlassColors } from '@/theme';

/**
 * Home v3's glass treatments, from the prototype's `GLASS_TOP`, `GLASS` and
 * `NAVGLASS` constants (home-oura.jsx). Two of the three are left: the cards
 * gave theirs up on 2026-10-24 (see `glassCard` below), so what still paints
 * a surface is the chips on the photograph and the floating nav.
 *
 * The prototype builds its depth from `backdrop-filter: blur(...)`, a 145°
 * highlight gradient and two inset shadows. React Native has none of the
 * three. What carries over is the tint, the hairline and the drop shadow —
 * and that is most of the effect here, because the designer already put a
 * near-opaque dark fill underneath every blur (`homeGlassColors.surface` is
 * `rgba(20,40,56,0.38)`, not a light frost), and the screen behind these
 * panels is a photograph under a 95% scrim by the time they appear.
 *
 * A real frosted blur would mean adding `expo-blur` — a native module, so a
 * new dev-client build before anyone could open the screen. Not worth it for
 * the difference; revisit if the cards ever sit over something busier.
 */

/**
 * Cards in the scrolling stack below the hero — flat since 2026-10-24.
 *
 * They used to be panels: a dark tint, a painted rim and a drop shadow. The
 * owner asked for the content to sit on the app's own background instead, so
 * what is left is the layout. Nothing paints a surface here any more; the
 * blocks are told apart by `GLASS_CARD_GAP` and by their own type hierarchy,
 * and each one still fades up as it enters view (see ScrollFade).
 */
export const glassCard: ViewStyle = {
  backgroundColor: 'transparent',
};

/** Chips that sit directly ON the photograph — the metric circles and the
 * two header buttons. Lighter than a card, because there is no scrim under
 * them yet and a dark fill would read as a hole punched in the picture. */
export const glassRaised: ViewStyle = {
  backgroundColor: homeGlassColors.surfaceRaised,
  shadowColor: homeGlassColors.shadow,
  shadowOffset: { width: 4, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 14,
  elevation: 4,
};

/** The floating bottom bar and the assistant button beside it. */
export const glassNav: ViewStyle = {
  backgroundColor: homeGlassColors.surfaceNav,
  // Dark neumorphism: the bar is barely lighter than what it sits on, and
  // the depth comes from a real shadow under it rather than from a bright
  // rim (owner, 2026-10-25, with a dark UI kit for reference).
  // Soft and close, in black. The streak the owner kept seeing was the
  // navy rim, not this — but a shadow pushed 10pt down still reads as a
  // band rather than as depth, so it stays tight.
  shadowColor: homeGlassColors.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.45,
  shadowRadius: 16,
  elevation: 10,
};

/** The same depth for a small round control — the roadmap's day nodes and
 * their action buttons. */
export const darkKnob: ViewStyle = {
  shadowColor: homeGlassColors.shadow,
  shadowOffset: { width: 3, height: 5 },
  shadowOpacity: 0.68,
  shadowRadius: 9,
  elevation: 7,
};

/** With no panel to sit inside, the only inset left is a small horizontal one
 * that lines the stack up with the hero above it — and the gap has to do all
 * the separating the card edges used to do, so it is far wider than the
 * prototype's 10. */
export const GLASS_CARD_PADDING = 8;
export const GLASS_CARD_GAP = 28;

/** Numerals that change in place (day counter, cup count, metric values) are
 * tabular so the layout does not twitch when 9 becomes 10. */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

// ─────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────

const INTER_BY_WEIGHT = {
  '200': 'Inter_200ExtraLight',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
} as const;

/**
 * Home v3 is drawn in SF Pro — the prototype asks for
 * `"SF Pro Display", "SF Pro Text", -apple-system` and the rest of the screen
 * is tuned to its proportions (the 72pt hairline numeral especially).
 *
 * So this screen, and only this screen, steps outside the app's Inter. On iOS
 * that means the system face, which IS SF Pro. Android has no SF Pro at all,
 * so it keeps Inter at the matching weight rather than silently falling back
 * to Roboto at a weight Inter would have rendered differently.
 */
export function heroFont(weight: keyof typeof INTER_BY_WEIGHT): TextStyle {
  return Platform.OS === 'ios'
    ? { fontFamily: 'System', fontWeight: weight }
    : { fontFamily: INTER_BY_WEIGHT[weight], fontWeight: weight };
}
