/**
 * Siri-style edge light reconstructed from the supplied video. All distances
 * are logical screen points; the same source is rendered headlessly by the
 * comparison script, so debugTimeMs gives a repeatable image.
 */
export const EDGE_GLOW_SHADER = `
uniform float2 resolution;
uniform float timeMs;
uniform float radius;
uniform float exposure;
uniform float coreWidth;
uniform float haloSigma;
uniform float noiseAmp;
uniform float speed;
uniform float anchorShift;
uniform float4 layers; // core, band, halo, wash
uniform float debugMask;

float gauss(float x, float sigma) {
  return exp(-0.5 * x * x / max(0.01, sigma * sigma));
}

float light(float2 p, float2 center, float spreadX, float spreadY) {
  float2 delta = (p - center) / float2(spreadX, spreadY);
  return exp(-0.5 * dot(delta, delta));
}

float roundedRect(float2 p, float2 halfSize, float r) {
  float2 q = abs(p - halfSize) - (halfSize - float2(r));
  return length(max(q, float2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

float3 field(float2 p, float t, float aspect) {
  float2 shift = float2(anchorShift, 0.0);
  float2 cyan = float2(0.14, 0.95 * aspect) + shift
    + float2(0.025 * sin(t * 0.66), 0.024 * cos(t * 0.83));
  float2 blue = float2(0.88, 0.13 * aspect) + shift
    + float2(0.025 * sin(t * 0.47 + 1.4), 0.020 * cos(t * 0.71));
  float2 pinkL = float2(0.035, 0.47 * aspect) + shift
    + float2(0.010 * sin(t * 0.72 + 2.0), 0.054 * cos(t * 0.51));
  float2 pinkR = float2(0.97, 0.51 * aspect) + shift
    + float2(0.010 * cos(t * 0.58), 0.057 * sin(t * 0.63 + 1.2));
  float2 amber = float2(0.83, 0.95 * aspect) + shift
    + float2(0.024 * cos(t * 0.48 + 0.9), 0.020 * sin(t * 0.77));
  float2 violet = float2(0.07, 0.10 * aspect) + shift
    + float2(0.024 * sin(t * 0.54 + 0.7), 0.025 * cos(t * 0.62));
  float2 blueL = float2(0.29, 0.25 * aspect) + shift
    + float2(0.022 * cos(t * 0.39 + 2.0), 0.030 * sin(t * 0.57));
  float2 goldL = float2(0.015, 0.63 * aspect) + shift
    + float2(0.006 * sin(t * 0.48), 0.046 * cos(t * 0.82 + 0.3));

  float a = light(p, cyan, 0.38, 0.49) * (1.0 + 0.18 * sin(t * 1.43));
  float b = light(p, blue, 0.45, 0.50) * (1.0 + 0.14 * sin(t * 1.09 + 1.1));
  float c = light(p, pinkL, 0.40, 0.51) * (1.0 + 0.19 * sin(t * 1.66 + 2.0));
  float d = light(p, pinkR, 0.40, 0.51) * (1.0 + 0.16 * sin(t * 1.27 + 0.6));
  float e = light(p, amber, 0.38, 0.44) * (1.0 + 0.14 * sin(t * 1.71 + 2.2));
  float f = light(p, violet, 0.39, 0.44) * (1.0 + 0.13 * sin(t * 1.34 + 1.7));
  float g = light(p, blueL, 0.48, 0.60) * (1.0 + 0.12 * sin(t * 1.20 + 0.4));
  float h = light(p, goldL, 0.30, 0.40)
    * smoothstep(0.23, 0.52, t)
    * (1.65 + 0.55 * sin(t * 1.5 + 0.6));
  float3 topColor = mix(float3(0.66, 0.39, 1.00), float3(0.98, 0.33, 0.72),
    smoothstep(0.18, 0.43, t));
  float total = a + b + c + d + e + f + g + h;
  return (
    a * float3(0.00, 0.86, 1.00) +
    b * float3(0.23, 0.45, 1.00) +
    c * float3(0.98, 0.31, 0.70) +
    d * float3(0.96, 0.36, 0.75) +
    e * float3(1.00, 0.65, 0.30) +
    f * topColor +
    g * float3(0.30, 0.57, 1.00) +
    h * float3(1.00, 0.79, 0.32)
  ) / max(total, 0.001);
}

half4 main(float2 pos) {
  float tMs = max(0.0, timeMs);
  float t = tMs * 0.001 * speed;
  float aspect = resolution.y / resolution.x;
  float2 q = pos / resolution.x;
  float d = roundedRect(pos, resolution * 0.5, radius);
  float u = -d;
  float inside = smoothstep(-0.8, 0.8, u);

  if (debugMask > 0.5) {
    float mask = inside * (1.0 - smoothstep(24.0, 27.0, u));
    return half4(mask, mask, mask, mask);
  }
  if (tMs > 1150.0 && u > max(70.0, haloSigma * 5.0)) {
    return half4(0.0);
  }

  float bottom = smoothstep(0.28, 0.91, pos.y / resolution.y);
  float onset = -20.0 + 180.0 * (1.0 - pos.y / resolution.y);
  float appeared = smoothstep(onset, onset + 95.0, tMs);
  float burst = smoothstep(30.0, 160.0, tMs)
    * (1.0 - smoothstep(330.0, 900.0, tMs));
  float washEnvelope = smoothstep(35.0, 160.0, tMs)
    * (1.0 - smoothstep(400.0, 1100.0, tMs));

  // Continuous low-frequency variation changes bloom width, never the
  // physical outline. Each side therefore breathes at a different phase.
  float n = sin(pos.y / resolution.x * 2.9 + t * 0.86)
    * cos(pos.x / resolution.x * 3.1 - t * 0.61);
  float local = 0.84 + 0.15 * sin(pos.y / resolution.x * 2.2 + t * 1.22)
    + 0.08 * sin(pos.x / resolution.x * 4.1 - t * 1.76);
  float sigma = haloSigma * (1.0 + 0.11 * n)
    + noiseAmp * n + burst * (15.0 + 24.0 * bottom);
  float halo = gauss(u - 4.0 - noiseAmp * 0.5 * n, sigma);
  float band = gauss(u - 3.0, 3.5 + burst * 6.5);
  float core = gauss(u - 2.5, max(0.5, coreWidth * 0.36));

  float edgeAlpha = appeared * inside * (
    layers.x * 0.89 * core +
    layers.y * 0.42 * band +
    layers.z * 0.22 * local * halo
  );
  edgeAlpha += appeared * inside * burst * (0.11 + 0.11 * bottom) * halo;

  // The colored wash climbs from the bottom once, then clears the centre.
  float travel = clamp((tMs - 40.0) / 330.0, 0.0, 1.0);
  float frontY = resolution.y * (1.06 - 1.00 * travel);
  float front = gauss(pos.y - frontY, resolution.y * 0.34);
  float lowerClear = 1.0 - 0.85 * smoothstep(0.54, 0.88, pos.y / resolution.y);
  float iconClear = 1.0 - 0.62
    * (1.0 - smoothstep(0.34, 0.49, pos.y / resolution.y))
    * smoothstep(0.04, 0.15, pos.x / resolution.x)
    * (1.0 - smoothstep(0.91, 0.99, pos.x / resolution.x));
  float wash = layers.w * washEnvelope * (0.35 + 0.31 * front)
    * lowerClear * iconClear;

  float alpha = clamp(exposure * (edgeAlpha + wash), 0.0, 0.98);
  float3 color = field(q, t, aspect);
  float3 introColor = mix(float3(0.03, 0.86, 1.0), float3(1.0, 0.37, 0.76),
    smoothstep(0.04, 0.29, pos.x / resolution.x));
  float bottomCyan = (1.0 - smoothstep(0.38, 0.90, pos.x / resolution.x))
    * smoothstep(0.74, 0.98, pos.y / resolution.y);
  introColor = mix(introColor, float3(0.02, 0.94, 1.0), bottomCyan);
  float leftWarm = smoothstep(190.0, 340.0, tMs)
    * (1.0 - smoothstep(680.0, 950.0, tMs))
    * (1.0 - smoothstep(0.06, 0.27, pos.x / resolution.x))
    * (1.0 - smoothstep(0.67, 0.86, pos.y / resolution.y));
  introColor = mix(introColor, float3(1.0, 0.61, 0.42), leftWarm);
  color = mix(color, introColor, burst * (0.68 + 0.18 * bottom));
  float whiteMix = clamp(layers.x * core * 0.24 + burst * core * 0.07, 0.0, 0.36);
  color = mix(color, float3(1.0, 0.97, 1.0), whiteMix);
  return half4(color * alpha, alpha);
}
`;

export interface EdgeGlowTuning {
  radius: number;
  exposure: number;
  coreWidth: number;
  haloSigma: number;
  noiseAmp: number;
  speed: number;
  anchorShift: number;
  layers: readonly [number, number, number, number];
  debugMask: number;
}

export const DEFAULT_EDGE_GLOW_TUNING: EdgeGlowTuning = {
  radius: 54,
  exposure: 1,
  coreWidth: 2.5,
  haloSigma: 12,
  noiseAmp: 1,
  speed: 1,
  anchorShift: 0,
  layers: [1, 1, 1, 1],
  debugMask: 0,
};
