// Ported from tokens/typography.css — Inter throughout, weight does the
// differentiation (400/600/700), sizes step 11px -> 28px.
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
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionSm: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 16, fontWeight: '500' },
  button: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 20, fontWeight: '600' },
};
