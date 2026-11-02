import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  /** 'glass' for the screens on the dark redesign's palette. Same switch
   * `ScreenContainer` and `BackBar` carry — a light-mode primary button on
   * one of those screens is the brand blue on near-black, which passes for
   * deliberate until you put it next to a real one. */
  tone?: 'app' | 'glass';
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
  tone = 'app',
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const glass = tone === 'glass';

  const bg =
    variant === 'primary'
      ? glass ? homeGlassColors.tick : theme.colors.primary
      : variant === 'danger'
        ? glass ? homeGlassColors.surfaceRaised : theme.colors.errorTint
        : variant === 'secondary'
          ? glass ? homeGlassColors.surfaceRaised : theme.colors.bgCardAlt
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? glass ? homeGlassColors.text : theme.colors.textOnPrimary
      : variant === 'danger'
        ? glass ? homeGlassColors.dotMissed : theme.colors.error
        : glass ? homeGlassColors.text : theme.colors.textPrimary;
  const borderColor =
    variant === 'ghost' ? (glass ? homeGlassColors.hairline : theme.colors.borderInput) : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderRadius: theme.radius.md,
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[theme.type.button, { color: textColor }]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
