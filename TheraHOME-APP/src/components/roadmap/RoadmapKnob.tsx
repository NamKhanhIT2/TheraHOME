import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { homeGlassColors } from '@/theme';
import { NeumorphicBox } from '@/components/home/NeumorphicBox';

export interface RoadmapKnobProps {
  size: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Roadmap's circular control material.
 *
 * The reference has no painted silver rim: a near-black face is lifted by a
 * tight charcoal light up-left and a deeper black shade down-right. Keeping
 * this separate from Home's blue chrome lets the neutral Roadmap background
 * and its knobs belong to one material without recolouring the shared nav.
 */
export function RoadmapKnob({ size, children, style }: RoadmapKnobProps) {
  return (
    <NeumorphicBox
      color={homeGlassColors.roadmapKnob}
      gradient={homeGlassColors.roadmapKnobSurface}
      radius={size / 2}
      shadeOffset={{ width: 3, height: 5 }}
      shadeBlur={9}
      shadeOpacity={0.72}
      lightOffset={{ width: -2, height: -2 }}
      lightBlur={6}
      lightColor={homeGlassColors.roadmapKnobLight}
      lightOpacity={0.11}
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        style,
      ]}
    >
      {children}
    </NeumorphicBox>
  );
}
