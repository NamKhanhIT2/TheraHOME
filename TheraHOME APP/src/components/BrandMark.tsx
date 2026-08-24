import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

export interface BrandMarkProps {
  size?: number;
  color?: string;
}

/** Ported 1:1 from the reference `BrandMark` SVG (a house-roof + drop + wave mark). */
export function BrandMark({ size = 56, color }: BrandMarkProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M8 30 L32 10 L56 30" stroke={c} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 27 V54 H50 V27" stroke={c} strokeWidth={4.5} strokeLinejoin="round" />
      <Path d="M32 19 C25 25 25 35 32 42 C39 35 39 25 32 19 Z" fill={c} />
      <Path d="M9 53 Q20.5 47 32 53 Q43.5 59 55 53" stroke={c} strokeWidth={4.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
