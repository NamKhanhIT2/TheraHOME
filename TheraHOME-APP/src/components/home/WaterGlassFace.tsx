import React from 'react';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaterGlassFaceProps {
  size: number;
  cups: number;
  goal: number;
  unit: string;
  progress: SharedValue<number>;
}

/** The original dial's 200-unit footprint and spring now drive a glass fill. */
export function WaterGlassFace({ size, cups, goal, unit, progress }: WaterGlassFaceProps) {
  const waterProps = useAnimatedProps(() => {
    const fill = Math.max(0, Math.min(1, progress.value));
    const level = 130 - fill * 99;
    return {
      d: `M46 ${level} C68 ${level - 2} 132 ${level + 2} 154 ${level} L150 137 L50 137 Z`,
      opacity: fill < 0.005 ? 0 : 1,
    };
  });
  const surfaceProps = useAnimatedProps(() => {
    const fill = Math.max(0, Math.min(1, progress.value));
    const level = 130 - fill * 99;
    return {
      d: `M46 ${level} C68 ${level - 7} 132 ${level - 7} 154 ${level} C132 ${level + 5} 68 ${level + 5} 46 ${level} Z`,
      opacity: fill < 0.005 ? 0 : 1,
    };
  });

  const marks = Math.min(12, Math.max(0, goal));
  const gap = marks > 1 ? Math.min(16, 142 / (marks - 1)) : 0;
  const first = 100 - ((marks - 1) * gap) / 2;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessible={false}>
      <Defs>
        <ClipPath id="glassInterior">
          <Path d="M47 25 L153 25 L145 126 Q143 131 100 132 Q57 131 55 126 Z" />
        </ClipPath>
        <LinearGradient id="glassWall" x1="0" y1="0.3" x2="1" y2="0.4">
          <Stop offset="0" stopColor="#E8F7FF" stopOpacity={0.68} />
          <Stop offset="0.12" stopColor="#8ECFFF" stopOpacity={0.18} />
          <Stop offset="0.32" stopColor="#D5ECFF" stopOpacity={0.025} />
          <Stop offset="0.72" stopColor="#99C8EA" stopOpacity={0.04} />
          <Stop offset="0.90" stopColor="#D8F1FF" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#F4FCFF" stopOpacity={0.76} />
        </LinearGradient>
        <LinearGradient id="waterFill" x1="0.1" y1="0" x2="0.92" y2="1">
          <Stop offset="0" stopColor="#68C9FF" stopOpacity={0.82} />
          <Stop offset="0.28" stopColor="#177FCB" stopOpacity={0.64} />
          <Stop offset="0.64" stopColor="#0B558F" stopOpacity={0.78} />
          <Stop offset="1" stopColor="#249FE4" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id="waterSheen" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ECFAFF" stopOpacity={0.34} />
          <Stop offset="0.17" stopColor="#B5EBFF" stopOpacity={0.06} />
          <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.91" stopColor="#C5F1FF" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.32} />
        </LinearGradient>
        <LinearGradient id="glassSide" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F6FCFF" stopOpacity={0.86} />
          <Stop offset="0.42" stopColor="#8AC9F2" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#EBF8FF" stopOpacity={0.78} />
        </LinearGradient>
        <LinearGradient id="glassBase" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8ECFFF" stopOpacity={0.3} />
          <Stop offset="0.62" stopColor="#E6F7FF" stopOpacity={0.82} />
          <Stop offset="1" stopColor="#7CBDE6" stopOpacity={0.34} />
        </LinearGradient>
        <RadialGradient id="glassFootGlow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#31B9FF" stopOpacity={0.27} />
          <Stop offset="1" stopColor="#31B9FF" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Ellipse cx="100" cy="137" rx="59" ry="12" fill="url(#glassFootGlow)" />
      <Path d="M42 22 L52 126 Q53 138 100 139 Q147 138 148 126 L158 22 Z" fill="url(#glassWall)" />
      <G clipPath="url(#glassInterior)">
        <AnimatedPath animatedProps={waterProps} fill="url(#waterFill)" />
        <AnimatedPath animatedProps={waterProps} fill="url(#waterSheen)" />
        <AnimatedPath animatedProps={surfaceProps} fill="#B5E8FF" fillOpacity={0.2} stroke="#B5E8FF" strokeWidth={1.7} />
        <AnimatedPath animatedProps={surfaceProps} fill="none" stroke="#F4FCFF" strokeOpacity={0.66} strokeWidth={0.7} />
        <Path d="M56 28 L62 126" stroke="#E9F8FF" strokeWidth={7} strokeOpacity={0.16} />
        <Path d="M139 27 L143 121" stroke="#DCF4FF" strokeWidth={5} strokeOpacity={0.12} />
      </G>

      <Path d="M42 22 L52 126 Q53 138 100 139 Q147 138 148 126 L158 22" fill="none" stroke="url(#glassSide)" strokeWidth={2.6} />
      <Path d="M47 25 L55 125 Q58 131 100 132 Q142 131 145 125 L153 25" fill="none" stroke="#B8E6FF" strokeOpacity={0.56} strokeWidth={1.1} />
      <Path d="M52 124 Q57 137 100 137 Q143 137 148 124 L146 134 Q139 144 100 144 Q61 144 54 134 Z" fill="url(#glassBase)" />
      <Ellipse cx="100" cy="135" rx="45" ry="5.2" fill="none" stroke="#F5FCFF" strokeOpacity={0.78} strokeWidth={1.9} />
      <Ellipse cx="100" cy="22" rx="58" ry="7.4" fill="#071C2D" fillOpacity={0.32} stroke="#DDF5FF" strokeOpacity={0.88} strokeWidth={1.6} />
      <Ellipse cx="100" cy="23.5" rx="52.5" ry="4.9" fill="none" stroke="#75CFFF" strokeOpacity={0.58} strokeWidth={1.2} />
      <Path d="M46 20 Q64 11 99 15" fill="none" stroke="#FFFFFF" strokeOpacity={0.82} strokeWidth={1.1} strokeLinecap="round" />
      <Path d="M117 15 Q144 16 155 21" fill="none" stroke="#D8F3FF" strokeOpacity={0.58} strokeWidth={1} strokeLinecap="round" />

      <SvgText x="100" y="169" textAnchor="middle" fill="#F7FBFF" fontSize="21" fontWeight="700">
        {`${cups} / ${goal} ${unit}`}
      </SvgText>
      {Array.from({ length: marks }, (_, index) => {
        const x = first + index * gap;
        return (
          <Path
            key={index}
            d={`M${x} 179 C${x - 1.5} 181 ${x - 3.5} 184 ${x - 3.5} 186 A3.5 3.5 0 0 0 ${x + 3.5} 186 C${x + 3.5} 184 ${x + 1.5} 181 ${x} 179 Z`}
            fill={index < cups ? '#35BAFF' : '#486680'}
            opacity={index < cups ? 1 : 0.7}
          />
        );
      })}
    </Svg>
  );
}
