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

export function painColor(value: number): string {
  if (value <= 3) return painScaleColors.low;
  if (value <= 7) return painScaleColors.mid;
  return painScaleColors.high;
}

export type ThemeColors = typeof lightColors;
