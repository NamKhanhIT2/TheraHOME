import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

/** Safe-area + `theme.colors.bgApp` background wrapper used by every screen. */
export function ScreenContainer({ children, style, edges }: ScreenContainerProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges ?? ['top', 'bottom']}
      style={[styles.base, { backgroundColor: theme.colors.bgApp }, style]}
    >
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
