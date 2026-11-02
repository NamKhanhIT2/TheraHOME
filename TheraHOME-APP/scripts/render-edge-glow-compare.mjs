#!/usr/bin/env node
// Renders the exact SkSL used by the app through Skia's CanvasKit backend.
// Camera crop is deliberately fixed and approximate; the source video is a
// recording of a phone, not a pixel-perfect screen capture.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit.js';
import { EDGE_GLOW_SHADER, DEFAULT_EDGE_GLOW_TUNING } from '../src/components/motion/edgeGlowShader.ts';

const require = createRequire(import.meta.url);
const pack = process.argv[2] ?? '/Users/macos/Downloads/siri-edge-glow-codex-pack';
const out = process.argv[3] ?? path.resolve('previews/siri-edge-glow-compare');
const stillsOnly = process.argv.includes('--stills-only');
const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'reference-manifest.json'), 'utf8'));
const width = 390;
const height = 844;
const onset = manifest.estimated_effect_onset_video_seconds;
const base = path.join(out, 'screen-before.png');
const videoFrames = path.join(out, 'video-frames');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(videoFrames, { recursive: true });

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited ${result.status}`);
}

global.CanvasKit = await CanvasKitInit({
  locateFile: (file) => path.resolve('node_modules/canvaskit-wasm/bin/full', file),
});
const { Skia } = require('@shopify/react-native-skia/lib/commonjs/headless').getSkiaExports();
const effect = Skia.RuntimeEffect.Make(EDGE_GLOW_SHADER);
if (!effect) throw new Error('Edge glow shader failed to compile');
const surface = Skia.Surface.MakeOffscreen(width, height);
if (!surface) throw new Error('Could not make Skia offscreen surface');
const canvas = surface.getCanvas();
const paint = Skia.Paint();
const frameRect = { x: 0, y: 0, width, height };

function render(timeMs, filename) {
  canvas.clear(Skia.Color('transparent'));
  const tuning = DEFAULT_EDGE_GLOW_TUNING;
  paint.setShader(effect.makeShader([
    width, height, timeMs, tuning.radius, tuning.exposure, tuning.coreWidth,
    tuning.haloSigma, tuning.noiseAmp, tuning.speed, tuning.anchorShift,
    ...tuning.layers, tuning.debugMask,
  ]));
  canvas.drawRect(frameRect, paint);
  surface.flush();
  fs.writeFileSync(filename, surface.makeImageSnapshot().encodeToBytes());
}

// The fixed crop is a starting geometry estimate from the guide (x65..402,
// y75..795). It is applied unchanged to every PTS frame.
const crop = 'crop=337:720:65:75,scale=390:844';
const before = manifest.reference_frames[0];
ffmpeg(['-i', path.join(pack, before.file), '-vf', crop, base]);

const comparisonFrames = [];
for (const frame of manifest.reference_frames) {
  const stamp = frame.pts_seconds.toFixed(3).replace('.', '-');
  const timeMs = Math.max(0, Math.round((frame.pts_seconds - onset) * 1000));
  const raw = path.join(out, `glow-${stamp}.png`);
  const reference = path.join(out, `reference-${stamp}.png`);
  const result = path.join(out, `render-${stamp}.png`);
  const compare = path.join(out, `compare-${stamp}.png`);
  render(timeMs, raw);
  ffmpeg(['-i', path.join(pack, frame.file), '-vf', crop, reference]);
  ffmpeg(['-i', base, '-i', raw, '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto', '-frames:v', '1', result]);
  ffmpeg(['-i', reference, '-i', result, '-filter_complex',
    '[0:v]scale=195:422[a];[1:v]scale=195:422[b];[a][b]hstack=inputs=2',
    '-frames:v', '1', compare]);
  comparisonFrames.push(compare);
}

const sheet = path.join(out, 'contact-sheet.png');
ffmpeg([
  ...comparisonFrames.flatMap((file) => ['-i', file]),
  '-filter_complex', `${comparisonFrames.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${comparisonFrames.length}`,
  '-frames:v', '1', sheet,
]);

const video = path.join(out, 'side-by-side.mp4');
if (!stillsOnly) {
  // Cover 2.44s..9.37s at 12fps, with real video PTS on the left.
  const fps = 12;
  const count = Math.floor((manifest.container_duration_seconds - onset) * fps);
  for (let index = 0; index < count; index++) {
    const raw = path.join(videoFrames, `${String(index).padStart(4, '0')}.png`);
    render(Math.round(index * 1000 / fps), raw);
  }

  ffmpeg([
    '-framerate', String(fps), '-i', path.join(videoFrames, '%04d.png'),
    '-framerate', String(fps), '-loop', '1', '-i', base,
    '-ss', String(onset), '-i', path.join(pack, manifest.source),
    '-filter_complex', `[1:v][0:v]overlay=0:0:shortest=1:format=auto[render];[2:v]${crop},fps=${fps}[ref];[ref][render]hstack=inputs=2[out]`,
    '-map', '[out]', '-t', String(count / fps), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', video,
  ]);
}

fs.writeFileSync(path.join(out, 'README.txt'),
  'Left: fixed crop of the supplied camera recording. Right: Skia shader over the PTS 2.333 s pre-glow crop.\n' +
  'Crop x=65..402, y=75..795 is estimated, with no perspective/camera/exposure calibration.\n' +
  `Onset PTS ${onset}s. The render uses the exact SkSL source imported by the app.\n`);
console.log(`Wrote ${sheet}${stillsOnly ? '' : ` and ${video}`}`);
