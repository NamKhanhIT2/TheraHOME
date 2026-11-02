import React, { useId, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { homeGlassColors } from '@/theme';

export interface NeumorphicSurfaceProps {
  /** Corner radius. Half the width for a circle, 999 for a pill. */
  radius: number;
  /**
   * 'raised' for chips sitting on the photo, 'panel' for cards and the nav,
   * 'dark' for the roadmap's circles and the bar — where the owner wants the
   * depth to come from SHADOW rather than from a bright rim ("đổ bóng nhưng
   * kiểu màu đen tối chứ ko phải trắng bạc", 2026-10-25, with a dark
   * neumorphism kit for reference). The light edge is barely there; the dark
   * one carries it, and the caller adds a black drop shadow underneath.
   */
  tone?: 'raised' | 'panel' | 'dark';
  /**
   * The colour the rim and the fill darken towards. Defaults to the
   * palette's `edgeShade` (#001428), which is right on the blue-dark
   * screens — but on the violet-black behind the tab bar that navy is
   * BLUER, and therefore lighter, than the ground, so the bottom of the
   * curve came out as a silver streak (owner, twice, 2026-10-26). Anything
   * floating on a near-black ground should pass plain black.
   */
  shade?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The raised edge Home v3 gets from its inset shadows.
 *
 * The prototype builds every surface from a 145° highlight gradient plus two
 * inset shadows:
 *
 *   background: linear-gradient(145deg, rgba(255,255,255,0.07), transparent 55%)
 *   box-shadow: inset  1.5px  1.5px 1px rgba(255,255,255,0.16),
 *               inset -2px   -2px  4px rgba(0,20,40,0.18)
 *
 * React Native has neither gradient backgrounds nor inset shadows, and
 * flattening the pair to a single border colour is exactly what made the
 * first pass read flat beside the design. So it is painted with
 * `react-native-svg`, already a dependency: the fill carries the 145° sheen,
 * and the stroke runs light → neutral → dark along that same diagonal, which
 * is what two opposing inset shadows amount to.
 *
 * Absolutely filled — drop it in behind the children of any rounded box.
 */
export function NeumorphicSurface({ radius, tone = 'raised', shade, style }: NeumorphicSurfaceProps) {
  const edge = shade ?? homeGlassColors.edgeShade;
  // Two gradients per instance, and every <Svg> shares one id namespace.
  const uid = useId().replace(/\W/g, '');
  const fillId = `nsf${uid}`;
  const edgeId = `nse${uid}`;
  const panel = tone === 'panel';
  const dark = tone === 'dark';
  // Neumorphism lives in the rim, so it gets real width — the reference
  // sheets the owner sent carry a visible bevel, not a hairline.
  const stroke = dark ? 1.2 : panel ? 1.4 : 2;
  // Measured rather than percentages: the rim is stroked ON the rect's edge,
  // so it must be inset by half its width or the <Svg> clips the outer half —
  // and react-native-svg has no calc().
  const [size, setSize] = useState({ width: 0, height: 0 });
  const corner = Math.max(
    0,
    Math.min(radius, (size.width - stroke) / 2, (size.height - stroke) / 2),
  );

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
    >
      {size.width > stroke && size.height > stroke ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            {/* The 145° sheen. A raised chip fades it out past halfway, as
                GLASS_TOP does; a panel keeps the prototype's 0.03 tail, since
                NAVGLASS goes `rgba(255,255,255,0.09)` → `0.03` rather than to
                nothing — which is what stops the nav bar reading as a hole. */}
            {/* The dark tone runs straight down rather than along the 145°
                diagonal: in the reference crops the light sits on the TOP
                edge of the circle and the shadow on the bottom, which is
                what makes it read as a dome rather than as a lit sphere. */}
            <LinearGradient
              id={fillId}
              x1={dark ? '0.5' : '0.12'}
              y1="0"
              x2={dark ? '0.5' : '0.88'}
              y2="1"
            >
              <Stop offset="0" stopColor={homeGlassColors.text} stopOpacity={dark ? 0.06 : panel ? 0.12 : 0.14} />
              <Stop offset="0.55" stopColor={homeGlassColors.text} stopOpacity={dark ? 0 : panel ? 0.07 : 0} />
              <Stop
                offset="1"
                stopColor={dark ? edge : homeGlassColors.text}
                stopOpacity={dark ? 0.32 : panel ? 0.05 : 0}
              />
            </LinearGradient>
            {/* Light rim top-left, dark rim bottom-right. The middle stop is
                the prototype's plain 1px border (0.12 raised / 0.14 panel) —
                it was set far below that and left every ring too faint to
                read against the photograph. */}
            <LinearGradient
              id={edgeId}
              x1={dark ? '0.5' : '0.12'}
              y1="0"
              x2={dark ? '0.5' : '0.88'}
              y2="1"
            >
              <Stop offset="0" stopColor={homeGlassColors.text} stopOpacity={dark ? 0.1 : panel ? 0.44 : 0.62} />
              <Stop offset="0.45" stopColor={homeGlassColors.text} stopOpacity={dark ? 0.015 : panel ? 0.2 : 0.26} />
              <Stop offset="1" stopColor={edge} stopOpacity={dark ? 0.88 : panel ? 0.42 : 0.56} />
            </LinearGradient>
          </Defs>
          <Rect
            x={stroke / 2}
            y={stroke / 2}
            width={size.width - stroke}
            height={size.height - stroke}
            // Clamped to the box. SVG says an rx past half the width should
            // be reduced to it; react-native-svg does not, and a pill asking
            // for 999 came out as two big ellipses bleeding past its edges.
            rx={corner}
            ry={corner}
            fill={`url(#${fillId})`}
            stroke={`url(#${edgeId})`}
            strokeWidth={stroke}
          />
        </Svg>
      ) : null}
    </View>
  );
}
