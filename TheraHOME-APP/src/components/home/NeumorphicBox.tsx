import React, { useId, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { homeGlassColors } from '@/theme/colors';

/**
 * The one material the dark-neumorphic chrome is made of: the tab bar, the
 * selected tab's well, the assistant disc and Home's "Bắt đầu hôm nay".
 *
 * Neumorphism is light and shade, not an edge. A surface is the same stuff
 * as the ground it sits on, lit from the top-left: a soft shade falls to the
 * bottom-right, a far weaker light to the top-left, and the only line drawn
 * anywhere is a thin highlight along the top edge that fades out at both
 * ends. Nothing is stroked all the way round — every bordered version of
 * this bar drew a silver line on the near-black ground, three times
 * (2026-10-26).
 *
 * React Native allows one shadow per view, so the two outer shadows are two
 * sibling layers behind the content, each filled with the base colour so
 * only their shadows show. It has no inset shadow at all, so `well` is
 * painted with `react-native-svg` instead: a dark gradient pooling at the
 * top-left, a pale one at the bottom-right, which is what an inner shadow
 * amounts to.
 */
export interface NeumorphicBoxProps {
  /** Base fill — the same colour family as the ground underneath. */
  color: string;
  radius: number;
  /** Faint surface gradient, top-left → bottom-right. */
  gradient?: [string, string];
  /** The thin lit line along the top edge. */
  topHighlight?: boolean;
  /** Draws a recess instead of a raised surface: the light and the shade
   * swap sides and move inside. */
  well?: boolean;
  shadeOffset?: { width: number; height: number };
  shadeBlur?: number;
  shadeOpacity?: number;
  lightOffset?: { width: number; height: number };
  lightBlur?: number;
  lightColor?: string;
  lightOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function NeumorphicBox({
  color,
  radius,
  gradient,
  topHighlight = false,
  well = false,
  shadeOffset = { width: 7, height: 10 },
  shadeBlur = 20,
  shadeOpacity = 0.62,
  lightOffset = { width: -5, height: -5 },
  lightBlur = 14,
  lightColor = homeGlassColors.neumorphicLight,
  lightOpacity = 0.24,
  style,
  children,
}: NeumorphicBoxProps) {
  const uid = useId().replace(/\W/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const fillId = `nbf${uid}`;
  const wellDarkId = `nbd${uid}`;
  const wellLightId = `nbl${uid}`;
  const highlightId = `nbh${uid}`;
  const corner = Math.min(radius, size.height / 2, size.width / 2);

  const layer: ViewStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius,
    backgroundColor: color,
  };

  return (
    <View
      style={[{ borderRadius: radius }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
    >
      {well ? null : (
        <>
          <View
            pointerEvents="none"
            style={[
              layer,
              {
                shadowColor: homeGlassColors.neumorphicShade,
                shadowOffset: shadeOffset,
                shadowOpacity: shadeOpacity,
                shadowRadius: shadeBlur,
                elevation: 12,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              layer,
              {
                shadowColor: lightColor,
                shadowOffset: lightOffset,
                shadowOpacity: lightOpacity,
                shadowRadius: lightBlur,
              },
            ]}
          />
        </>
      )}
      {well ? <View pointerEvents="none" style={layer} /> : null}

      {size.width > 0 && size.height > 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
          <Svg width={size.width} height={size.height}>
            <Defs>
              {gradient ? (
                <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={gradient[0]} />
                  <Stop offset="1" stopColor={gradient[1]} />
                </LinearGradient>
              ) : null}
              {/* The recess: shade pooled at the top-left, light at the
                  bottom-right — the opposite of the raised surface's
                  lighting, which is what reads as "pressed in". */}
              <LinearGradient id={wellDarkId} x1="0" y1="0" x2="0.75" y2="0.75">
                <Stop offset="0" stopColor={homeGlassColors.neumorphicShade} stopOpacity="0.78" />
                <Stop offset="0.66" stopColor={homeGlassColors.neumorphicShade} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id={wellLightId} x1="1" y1="1" x2="0.3" y2="0.3">
                <Stop offset="0" stopColor={homeGlassColors.neumorphicWellLight} stopOpacity="0.32" />
                <Stop offset="0.72" stopColor={homeGlassColors.neumorphicWellLight} stopOpacity="0" />
              </LinearGradient>
              {/* Brightest in the middle, gone at both ends — a lit edge,
                  not an outline. */}
              <LinearGradient id={highlightId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={homeGlassColors.neumorphicHighlight} stopOpacity="0" />
                <Stop offset="0.5" stopColor={homeGlassColors.neumorphicHighlight} stopOpacity="0.26" />
                <Stop offset="1" stopColor={homeGlassColors.neumorphicHighlight} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {gradient ? (
              <Rect x={0} y={0} width={size.width} height={size.height} rx={corner} ry={corner} fill={`url(#${fillId})`} />
            ) : null}
            {well ? (
              <>
                <Rect x={0} y={0} width={size.width} height={size.height} rx={corner} ry={corner} fill={`url(#${wellDarkId})`} />
                <Rect x={0} y={0} width={size.width} height={size.height} rx={corner} ry={corner} fill={`url(#${wellLightId})`} />
              </>
            ) : null}
            {topHighlight ? (
              <Rect
                x={size.width * 0.08}
                y={0.7}
                width={size.width * 0.84}
                height={1.6}
                rx={0.8}
                fill={`url(#${highlightId})`}
              />
            ) : null}
          </Svg>
        </View>
      ) : null}

      {children}
    </View>
  );
}
