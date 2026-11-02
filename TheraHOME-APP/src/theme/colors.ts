// Ported from the Claude Design tokens
// (_ds/therahome-design-system-.../tokens/colors.css) — values only, not the CSS file.
// Dark overrides come from the prototype's inline `.theme-dark` block.

export const lightColors = {
  primary: '#007FD9',
  primaryDark: '#0066AD',
  primaryLight: '#4DA3E8',
  primaryTint10: '#E5F2FC',
  primaryTint05: '#F2F8FD',

  bgApp: '#EEF3FB',
  bgCard: '#FFFFFF',
  bgCardAlt: '#F6F8FC',

  textPrimary: '#16213A',
  textSecondary: '#6B7480',
  textMuted: '#A0A8B4',
  textOnPrimary: '#FFFFFF',

  accentOrange: '#FFB648',
  accentOrangeTint: '#FFF1DC',
  accentTeal: '#4FD1C5',
  accentYellow: '#FFD23F',
  accentPurple: '#8B7CF6',

  success: '#34C759',
  successTint: '#E7F9EC',
  warning: '#FF9F43',
  warningTint: '#FFF3E4',
  error: '#FF4D4F',
  errorTint: '#FFEBEC',

  borderLight: '#E7ECF3',
  borderInput: '#DCE3EE',
  divider: '#EEF1F6',
  overlayScrim: 'rgba(22,33,58,0.45)',
};

export const darkColors: typeof lightColors = {
  ...lightColors,
  primary: '#3AA1FF',
  primaryDark: '#1E86E8',
  primaryTint10: '#17273A',
  primaryTint05: '#141C29',

  bgApp: '#10151F',
  bgCard: '#1B2230',
  bgCardAlt: '#232B3B',

  textPrimary: '#F3F5F8',
  textSecondary: '#A6AFBF',
  textMuted: '#6C7686',

  successTint: '#13301F',
  warningTint: '#332310',
  errorTint: '#361619',
  accentOrangeTint: '#332310',

  borderLight: '#2A3242',
  borderInput: '#333C4D',
  divider: '#262E3D',
  overlayScrim: 'rgba(0,0,0,0.6)',
};

// Pain-scale colours from the owner's dark instrument reference: electric
// blue rises through violet into red.
export const painScaleColors = {
  low: '#3153FF',
  mid: '#91259F',
  high: '#EF2A5C',
} as const;

// Each integer score keeps its severity hue while gaining intensity inside
// that band. A score of 0 and a score of 3 are both blue, for example, but
// they should not look like the same reading on the chart.
const painScaleSteps = [
  '#17287D',
  '#1F36A9',
  '#2845D6',
  painScaleColors.low,
  '#4632B2',
  '#5B2FBB',
  '#742BB6',
  painScaleColors.mid,
  '#B22472',
  '#D12661',
  painScaleColors.high,
] as const;

// The skeleton drawn over a camera frame or a reference clip.
//
// Its own palette, not the UI tokens, because it is not UI: it sits on top
// of live video of a room whose colours nobody controls, in light mode and
// dark alike, and it has to stay legible over a white wall, a wooden floor
// and grey leggings.
//
// White, with the dark halo below — checked against the product video the
// owner sent (2026-10-16). White reads on every background once it is
// haloed, and it leaves colour to mean something: green, amber and red say
// how the movement is going, and nothing else on the body is coloured at
// all. An earlier version used gold for the neutral skeleton and spent the
// one thing the feature needs to say on decoration.
//
// `reference` is the neutral "this is your body" colour — the only one the
// specialist's frame ever uses, because the specialist is never wrong.
// ok/warn/bad only ever colour the CUSTOMER's skeleton, limb by limb.
export const poseColors = {
  reference: '#FFFFFF',
  ok: '#34C759',
  warn: '#FF9F43',
  bad: '#FF4D4F',
  /** A joint the detector guessed rather than saw — off the edge of the
   * frame, or hidden behind the body. Never coloured as if it were a
   * measurement, and never red: "we cannot see your arm" is not "your arm
   * is wrong". */
  weak: '#9AA4B2',
  /** Drawn under every bone and joint, wider, so a white skeleton survives
   * a white wall and a green one survives a green mat. */
  halo: 'rgba(0, 0, 0, 0.38)',
} as const;

export function painColor(value: number): string {
  const score = Math.round(Math.max(0, Math.min(10, value)));
  return painScaleSteps[score];
}

export type ThemeColors = typeof lightColors;

// Home v3 ("TheraHOME Home v3.html" in the Claude Design project) — the
// photo-backed home screen.
//
// Its own palette, like `painScaleColors` and `poseColors` above, and for the
// same reason: it is not UI painted on `bgApp`. Every one of these colours is
// read on top of a dark photograph under a near-black scrim, so it does not
// flip with the light/dark setting — there is only the one surface, and the
// theme's `textPrimary`/`bgCard` would be unreadable on it in either mode.
// Values are the prototype's own (home-oura.jsx), not the shared tokens.
export const homeGlassColors = {
  /** The five-stop sky the photo sits on, and shows through once it fades. */
  sky: ['#2F86AE', '#1D5F82', '#123F58', '#0A1F2D', '#060D14'] as const,
  skyStops: [0, 0.32, 0.58, 0.8, 1] as const,

  /** Card fill — a dark tint, not a light one: the prototype's backdrop-blur
   * does little this far down the scrim, so the tint carries the panel. */
  surface: 'rgba(20,40,56,0.38)',
  /** Raised chips that sit ON the photo (metric circles, header buttons). */
  surfaceRaised: 'rgba(255,255,255,0.06)',
  /** The floating bottom bar and the assistant button beside it.
   *
   * A dark tint, not a white film. At `rgba(255,255,255,0.08)` the bar
   * picked up whatever was behind it and read as silver against the app's
   * blue-black — "hơi bạc" (owner, 2026-10-25). This sits a few shades above
   * the background instead, so the bar belongs to it. */
  // Opaque, and a touch lighter than every ground it floats over
  // (#060D14 on Home, #0A0912 on Cộng đồng). Neumorphism is built from a
  // light and a shade cast BY the surface, so the surface has to be solid —
  // through a translucent one the two layers show through each other and
  // the effect collapses into a grey smear.
  // Dark-neumorphic chrome (owner's spec, 2026-10-26). The bar is cast
  // from the same material as the ground right behind it; `navSurface` is
  // the faint top-left → bottom-right gradient across its face.
  navGround: '#080E14',
  // The face stays close to neutral graphite on the roadmap and store; the
  // depth comes from the light direction rather than a bright blue fill.
  surfaceNav: '#111920',
  navSurface: ['#1B2630', '#0A1118'] as [string, string],
  surfaceActionNeumorphic: '#19283A',
  actionSurface: ['#2A4056', '#111C29'] as [string, string],
  neumorphicShade: '#000000',
  neumorphicLight: '#6886A3',
  neumorphicHighlight: '#C7D9EA',
  neumorphicWellLight: '#356A88',
  // Quiet tabs are cool grey; blue is reserved for the selected destination
  // and primary-action glyphs so the bar does not become four equal accents.
  navIcon: '#7A8C9E',
  navIconActive: '#55BDF5',
  // Back to 0.14 (owner, 2026-10-25): at 0.10 the selected tab had almost
  // stopped reading as selected.
  // The selected tab is a well sunk into the bar, so it is barely darker
  // than the bar itself — the shading does the work, not the fill.
  surfaceNavActive: '#091118',
  /** Icon well inside a card row. */
  surfaceInset: 'rgba(255,255,255,0.12)',
  /** The "Bắt đầu hôm nay" pill. */
  surfaceAction: 'rgba(255,255,255,0.16)',

  hairline: 'rgba(255,255,255,0.12)',
  hairlineNav: 'rgba(255,255,255,0.14)',

  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.85)',
  textMuted: 'rgba(255,255,255,0.65)',
  textFaint: 'rgba(255,255,255,0.55)',

  /** Cộng đồng's own accent, from the owner's reference for that tab
   * (2026-10-25). It is deliberately only that tab's: Home is blue, the
   * roadmap's today is red, and this one is violet. */
  /** ...and the sky that goes with it, for that tab only. */
  /** Lighter than the first pass: the owner asked for a hint of violet, not
   * a violet screen (2026-10-25). */
  purpleSky: ['#1A1529', '#120F1E', '#0A0912'] as const,
  purple: '#8B5CF6',
  purpleStrong: '#7C3AED',
  purpleSoft: 'rgba(139,92,246,0.16)',

  /** The roadmap's completed days. A deeper blue than `accentStrong`, which
   * on a near-black screen read as pale cyan (owner, 2026-10-25). */
  tick: '#2F8FFF',
  roadmapSky: ['#1A222A', '#10171E', '#080D12'] as const,
  roadmapSkyStops: [0, 0.42, 1] as const,
  roadmapKnob: '#151A20',
  roadmapKnobSurface: ['#232A32', '#0D1116'] as [string, string],
  roadmapKnobLight: '#465361',
  roadmapKnobIcon: '#6F7C8B',

  /** "Xem tất cả" and other inline links. */
  link: '#8FD8F0',
  accent: '#5FB8F5',
  accentStrong: '#3AA0F0',
  /** The discomfort line — deliberately not the pain-scale ramp: on this
   * surface one colour reads as one series, and the 0–10 band labels carry
   * the severity instead. */
  pain: '#FF3D7F',

  dotDone: '#34C76F',
  dotCurrent: '#FFFFFF',
  dotMissed: '#FF5A5F',
  dotIdle: 'rgba(255,255,255,0.18)',
  badge: '#FF6B6B',

  /** The dark half of the raised edge — the prototype's inset
   * `rgba(0,20,40,0.18)`, a cold shade rather than plain black. */
  edgeShade: '#001428',

  gaugeTrack: 'rgba(255,255,255,0.22)',
  gridLine: 'rgba(255,255,255,0.14)',
  gridLineFaint: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.7)',

  /** The gradient laid over the photograph: a cool wash at the top, going
   * to near-black by the time the cards start. */
  scrimTop: '#144664',
  scrimMid: '#081422',
  /** Also painted over everything as the hero scrolls away. */
  scrim: '#060D18',
  toast: 'rgba(10,20,30,0.78)',
  /** Menus and sheets: opaque, because a translucent one lets the text
   * underneath read straight through it. */
  menu: '#1C1A26',
  /** The water dial (Home v3, owner's reference 2026-10-24). Near-neutral
   * blacks and a brushed-metal ramp: the instrument look depends on the
   * panel being darker than everything around it, so these deliberately sit
   * outside the screen's blue-grey glass palette. */
  /** The face is tinted toward the screen's own blue-black and kept darker
   * than the card it sits on, so the dial reads as sunk into the glass panel
   * rather than as a neutral-grey sticker laid over it. */
  dialFaceTop: '#0C1620',
  dialFaceBottom: '#060B11',
  /** The groove the band sits in, and the dial's own ground. */
  dialTrack: '#09111A',
  dialMetalHi: '#F4F7F9',
  dialMetalMid: '#878F97',
  dialMetalLo: '#23282E',
  dialBlue: '#1E90FF',
  dialBlueLight: '#5CB3FF',
  dialBlueDeep: '#0A74E6',
  dialTick: 'rgba(255,255,255,0.88)',

  /** Apple's three Activity rings, kept close to their own hues — the whole
   * point of drawing them is that someone with an iPhone recognises the
   * shape and the colour before reading a word of it. */
  ringMove: '#FF375F',
  ringExercise: '#7BE24E',
  ringStand: '#4FD6E8',
  ringTrack: 'rgba(255,255,255,0.1)',
  /** The needle. Red, and stopping well short of the band — a pointer that
   * touches the scale reads as part of it. */
  dialNeedle: '#FF453A',
  /** Today, on the roadmap. Red, as the owner's design has it. */
  /** Softened one notch from iOS's systemRed: the same signal, less glare
   * on a dark screen (owner, 2026-10-25). */
  focus: '#E5484D',
  focusSoft: 'rgba(229,72,77,0.34)',
  dialNeedleLight: '#FF7A70',

  /** The water in the tumbler, and the lettering etched on its side —
   * the prototype's `thWater` / `thWaterV` gradients and its etched type. */
  waterDeep: '#1C8AE0',
  waterLight: '#6CC4FA',
  waterShade: '#003F7A',
  waterSurface: '#9AD6FF',
  etched: 'rgba(206,214,222,0.82)',

  /** Drop shadows on this surface are cast by near-black panels onto a
   * near-black scrim, so they key off black rather than the theme's
   * blue-grey `shadows.card`, which disappears here. */
  shadow: '#000000',
} as const;

/**
 * The Store tab, rebuilt 2026-10-31 from the owner's reference shot and then
 * from his reference video the same day.
 *
 * It is split, and deliberately so: the product sits on a light wash that
 * swipes, and the copy below it sits on a fixed dark panel that does not.
 * The light half is sampled from the reference shot; the dark half is the
 * app's own chrome, because the floating bar sits directly under it and a
 * second, unrelated dark would read as a seam.
 */
export const storeColors = {
  /** Periwinkle at the status bar, washing out to near-white behind the
   * product so the cut-out photo has nothing to fight. */
  sky: ['#B9C3E8', '#E2D8E5', '#F4EFF3'] as const,
  skyStops: [0, 0.55, 1] as const,

  /** The panel the copy sits on. Not pure white — against the wash above it
   * a true #FFF reads as a hole rather than a surface. */
  sheet: '#FDFDFD',
  text: '#15161A',
  textMuted: '#6B6F7A',
  textFaint: '#A0A4AE',
  divider: '#ECECF0',

  /** The slate blue of "Add to Cart" and the stepper's plus. */
  action: '#5E6C8D',
  actionText: '#FFFFFF',
  /** The round chrome buttons floating on the wash. */
  chip: '#FFFFFF',
  stepperTrack: '#E7E9EE',
  dot: '#D7D7D9',
  dotActive: '#141414',
  /** Only for the struck-through list price beside the member price. */
  strike: '#A0A4AE',
  shadow: '#2B2F45',

  /** The fixed panel under the pager. Only its text changes as you swipe. */
  panel: '#0C131A',
  panelText: '#FFFFFF',
  panelMuted: 'rgba(255,255,255,0.62)',
  panelFaint: 'rgba(255,255,255,0.38)',
  panelTrack: '#1B2630',
  panelAction: '#2F8FFF',
  panelAccent: '#5FB8F5',
} as const;
