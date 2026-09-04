// Ported from tokens/typography.css — Inter throughout, weight does the
// differentiation (400/600/700), sizes step 12px -> 28px. Body/caption
// tiers sit 1px above the original CSS tokens (readability request
// 2026-09-03); heading tiers keep the original sizes.
import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight'>;

export const typeScale: Record<
  'display' | 'h1' | 'h2' | 'body' | 'bodyStrong' | 'caption' | 'captionSm' | 'button',
  TypeToken
> = {
  display: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  h1: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, fontWeight: '400' },
  captionSm: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  button: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 20, fontWeight: '600' },
};
