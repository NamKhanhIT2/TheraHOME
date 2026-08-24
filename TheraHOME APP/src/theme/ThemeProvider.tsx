import React, { createContext, useContext, useMemo } from 'react';
import { darkColors, lightColors, type ThemeColors } from './colors';
import { fontFamily, typeScale } from './typography';
import { cardPadding, listGap, screenMargin, space } from './spacing';
import { radius, shadows } from './radius';
import { useAppStore } from '@/store/useAppStore';

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  type: typeof typeScale;
  fontFamily: typeof fontFamily;
  space: typeof space;
  screenMargin: number;
  cardPadding: number;
  listGap: number;
  radius: typeof radius;
  shadows: typeof shadows;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);

  const theme = useMemo<Theme>(
    () => ({
      dark: darkMode,
      colors: darkMode ? darkColors : lightColors,
      type: typeScale,
      fontFamily,
      space,
      screenMargin,
      cardPadding,
      listGap,
      radius,
      shadows,
    }),
    [darkMode],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
