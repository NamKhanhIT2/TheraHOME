// Ported from the Claude Design tokens
// (_ds/therahome-design-system-.../tokens/colors.css) — values only, not the CSS file.
// Dark overrides come from the prototype's inline `.theme-dark` block.

export const lightColors = {
  primary: '#007FD9',
  primaryDark: '#0066AD',
  primaryLight: '#4DA3E8',
  primaryTint10: '#E5F2FC',
  primaryTint05: '#F2F8FD',

  bgApp: '#EEF3FB',
  bgCard: '#FFFFFF',
  bgCardAlt: '#F6F8FC',

  textPrimary: '#16213A',
  textSecondary: '#6B7480',
  textMuted: '#A0A8B4',
  textOnPrimary: '#FFFFFF',

  accentOrange: '#FFB648',
  accentOrangeTint: '#FFF1DC',
  accentTeal: '#4FD1C5',
  accentYellow: '#FFD23F',
  accentPurple: '#8B7CF6',

  success: '#34C759',
  successTint: '#E7F9EC',
  warning: '#FF9F43',
  warningTint: '#FFF3E4',
  error: '#FF4D4F',
  errorTint: '#FFEBEC',

  borderLight: '#E7ECF3',
  borderInput: '#DCE3EE',
  divider: '#EEF1F6',
  overlayScrim: 'rgba(22,33,58,0.45)',
};

export const darkColors: typeof lightColors = {
  ...lightColors,
  primary: '#3AA1FF',
  primaryDark: '#1E86E8',
  primaryTint10: '#17273A',
  primaryTint05: '#141C29',

  bgApp: '#10151F',
  bgCard: '#1B2230',
  bgCardAlt: '#232B3B',

  textPrimary: '#F3F5F8',
  textSecondary: '#A6AFBF',
  textMuted: '#6C7686',

  successTint: '#13301F',
  warningTint: '#332310',
  errorTint: '#361619',
  accentOrangeTint: '#332310',

  borderLight: '#2A3242',
  borderInput: '#333C4D',
  divider: '#262E3D',
  overlayScrim: 'rgba(0,0,0,0.6)',
};

// Pain-scale specific colors (distinct hardcoded values in the source prototype,
// not the same as the accent-orange/accent-yellow tokens).
export const painScaleColors = {
  low: '#2BE98C',
  mid: '#FFDD31',
  high: '#FF9F0A',
} as const;

// The skeleton drawn over a camera frame or a reference clip.
//
// Its own palette, not the UI tokens, because it is not UI: it sits on top
// of live video of a room whose colours nobody controls, in light mode and
// dark alike, and it has to stay legible over a white wall, a wooden floor
// and grey leggings.
//
// White, with the dark halo below — checked against the product video the
// owner sent (2026-10-16). White reads on every background once it is
// haloed, and it leaves colour to mean something: green, amber and red say
// how the movement is going, and nothing else on the body is coloured at
// all. An earlier version used gold for the neutral skeleton and spent the
// one thing the feature needs to say on decoration.
//
// `reference` is the neutral "this is your body" colour — the only one the
// specialist's frame ever uses, because the specialist is never wrong.
// ok/warn/bad only ever colour the CUSTOMER's skeleton, limb by limb.
export const poseColors = {
  reference: '#FFFFFF',
  ok: '#34C759',
  warn: '#FF9F43',
  bad: '#FF4D4F',
  /** A joint the detector guessed rather than saw — off the edge of the
   * frame, or hidden behind the body. Never coloured as if it were a
   * measurement, and never red: "we cannot see your arm" is not "your arm
   * is wrong". */
  weak: '#9AA4B2',
  /** Drawn under every bone and joint, wider, so a white skeleton survives
   * a white wall and a green one survives a green mat. */
  halo: 'rgba(0, 0, 0, 0.38)',
} as const;

export function painColor(value: number): string {
  if (value <= 3) return painScaleColors.low;
  if (value <= 7) return painScaleColors.mid;
  return painScaleColors.high;
}

export type ThemeColors = typeof lightColors;
