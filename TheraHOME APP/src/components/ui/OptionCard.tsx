import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';

export interface OptionCardProps {
  label: string;
  active: boolean;
  multi?: boolean;
  onPress: () => void;
  /** Optional leading illustrative icon — when set, it fades/scales in on
   * mount (staggered by `index`) instead of appearing static. */
  icon?: string;
  index?: number;
}

/** Question-answer chip/card — full-width row, used by the onboarding
 * questionnaire (`QuestionScreen` in the reference). */
export function OptionCard({ label, active, multi, onPress, icon, index = 0 }: OptionCardProps) {
  const theme = useTheme();
  const iconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!icon) return;
    Animated.timing(iconAnim, { toValue: 1, duration: 320, delay: index * 60, useNativeDriver: true }).start();
  }, [icon, iconAnim, index]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          borderRadius: theme.radius.md,
          borderWidth: active ? 2 : 1,
          borderColor: active ? theme.colors.primary : theme.colors.borderInput,
          backgroundColor: active ? theme.colors.primaryTint10 : theme.colors.bgCard,
        },
      ]}
    >
      {icon ? (
        <Animated.View
          style={[
            styles.leadingIcon,
            {
              backgroundColor: active ? theme.colors.primary : theme.colors.primaryTint10,
              opacity: iconAnim,
              transform: [{ scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            },
          ]}
        >
          <Icon name={icon} size={16} color={active ? '#fff' : theme.colors.primary} />
        </Animated.View>
      ) : null}
      <Text
        style={[
          theme.type.bodyStrong,
          { color: active ? theme.colors.primary : theme.colors.textPrimary, flex: 1 },
        ]}
      >
        {label}
      </Text>
      {multi ? (
        <Icon
          name={active ? 'check-square' : 'square'}
          size={19}
          color={active ? theme.colors.primary : theme.colors.textMuted}
        />
      ) : active ? (
        <Icon name="check" size={18} color={theme.colors.primary} />
      ) : (
        <View style={{ width: 18 }} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 12,
  },
  leadingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
