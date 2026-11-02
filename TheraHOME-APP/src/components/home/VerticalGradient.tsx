import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export interface GradientStop {
  /** 0 = top edge, 1 = bottom edge. */
  offset: number;
  color: string;
  opacity?: number;
}

/**
 * An absolutely-filled top-to-bottom gradient.
 *
 * React Native has no gradient primitive, and `expo-linear-gradient` is not
 * installed — it is a native module, so adding one would mean a new dev-client
 * build before anybody could look at this screen. `react-native-svg` is
 * already a dependency and paints the same thing, so Home v3's sky, its photo
 * scrim and the pain chart's area fill all go through here.
 */
export function VerticalGradient({ stops, style }: { stops: GradientStop[]; style?: StyleProp<ViewStyle> }) {
  // Every <Svg> on screen shares one id namespace, so two instances with a
  // fixed id would define the same gradient twice and one would silently win.
  // useId's value contains ':' characters, which are not safe inside a
  // `url(#...)` reference — strip everything that is not a word character.
  const id = `vgrad${useId().replace(/\W/g, '')}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((stop, index) => (
              <Stop key={index} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
