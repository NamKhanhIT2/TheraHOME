import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { homeGlassColors, useTheme } from '@/theme';

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  /** 'glass' for the screens that belong to the dark redesign, 'violet' for
   * Cộng đồng and everything it opens. Without one of them a converted
   * screen paints its dark-palette text on the light `bgApp` (2026-10-25). */
  tone?: 'app' | 'glass' | 'violet';
}

/** Safe-area + `theme.colors.bgApp` background wrapper used by every screen. */
export function ScreenContainer({ children, style, edges, tone = 'app' }: ScreenContainerProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges ?? ['top', 'bottom']}
      style={[
        styles.base,
        {
          backgroundColor:
            tone === 'violet'
              ? homeGlassColors.purpleSky[2]
              : tone === 'glass'
                ? homeGlassColors.sky[4]
                : theme.colors.bgApp,
        },
        style,
      ]}
    >
      {/* Claim the status bar for this screen's own background. React Native's
       * StatusBar is a stack pushed in componentDidMount order, so a screen
       * left mounted underneath (Home pushes `light`) otherwise keeps owning
       * the bar and a light screen renders white-on-white — the Thông báo
       * screen did exactly that until 2026-11-01. This entry is pushed before
       * `children` mount, so a screen that declares its own <StatusBar>
       * inside still wins. */}
      <StatusBar style={tone === 'app' && !theme.dark ? 'dark' : 'light'} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});

interface ScreenScrollAreaProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Plain flex-1 View, used inside ScreenContainer when a ScrollView owns scrolling. */
export function ScreenBody({ children, style }: ScreenScrollAreaProps) {
  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}
