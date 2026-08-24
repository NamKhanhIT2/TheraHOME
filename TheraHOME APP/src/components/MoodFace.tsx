import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { painColor } from '@/theme/colors';

export interface MoodFaceProps {
  value: number;
  size?: number;
}

/** Ported 1:1 from the reference `MoodFace` SVG face used in the pain-scale modal. */
export function MoodFace({ value, size = 84 }: MoodFaceProps) {
  const color = painColor(value);
  const band = value <= 3 ? 'low' : value <= 7 ? 'mid' : 'high';
  const t = 1 - (value / 10) * 2;
  const curve = t * 9;

  let mouthPath: string;
  let leftEye: React.ReactNode;
  let rightEye: React.ReactNode;
  let leftBrow: React.ReactNode;
  let rightBrow: React.ReactNode;
  const bounce = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounce.setValue(0.88);
    tilt.setValue(value >= 8 ? -1 : value <= 2 ? 1 : 0);
    Animated.spring(bounce, { toValue: 1, friction: 4, tension: 110, useNativeDriver: true }).start();
    Animated.timing(tilt, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [bounce, tilt, value]);

  if (band === 'low') {
    mouthPath = value <= 1 ? 'M23,40 Q36,52 49,40' : `M24,42 Q36,${42 + curve} 48,42`;
    leftEye = <Circle cx={27} cy={29} r={3.2} fill={color} />;
    rightEye = <Circle cx={45} cy={29} r={3.2} fill={color} />;
    leftBrow = <Path d="M22,21 Q26,18 31,20" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
    rightBrow = <Path d="M41,20 Q46,18 50,21" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
  } else if (band === 'mid') {
    mouthPath = `M24,44 Q36,${44 + curve} 48,44`;
    leftEye = <Circle cx={27} cy={29} r={3} fill={color} />;
    rightEye = <Circle cx={45} cy={29} r={3} fill={color} />;
    leftBrow = <Path d="M22,21 L31,22" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
    rightBrow = <Path d="M41,22 L50,21" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
  } else {
    mouthPath = value >= 9 ? 'M24,49 Q36,36 48,49' : 'M23,46 L28,50 L33,46 L38,50 L43,46 L48,50';
    leftEye = <Path d="M23,29 Q27,25 31,29" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
    rightEye = <Path d="M41,29 Q45,25 49,29" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
    leftBrow = <Path d="M21,18 L31,23" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
    rightBrow = <Path d="M51,18 L41,23" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
  }

  const rotate = tilt.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-5deg', '0deg', '5deg'] });
  return (
    <Animated.View style={{ transform: [{ scale: bounce }, { rotate }] }}>
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={34} fill={color} opacity={0.16} />
      <Circle cx={36} cy={36} r={27} fill="none" stroke={color} strokeWidth={3} />
      {leftBrow}
      {rightBrow}
      {leftEye}
      {rightEye}
      {value <= 2 ? (
        <>
          <Ellipse cx={20} cy={37} rx={4} ry={2} fill={color} opacity={0.22} />
          <Ellipse cx={52} cy={37} rx={4} ry={2} fill={color} opacity={0.22} />
        </>
      ) : null}
      {value >= 9 ? <Path d="M51,31 Q56,36 51,41 Q47,36 51,31" fill={color} opacity={0.7} /> : null}
      <Path d={mouthPath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    </Animated.View>
  );
}
