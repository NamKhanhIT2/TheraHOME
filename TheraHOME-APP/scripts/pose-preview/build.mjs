#!/usr/bin/env node
// Builds the browser harness that lets you try the feature without a
// native build.
//
// WHAT IT IS FOR. `modules/therahome-pose` is native, so the only way to
// try the real screen is to build and install the app. That is slow, and it
// is far too slow for the thing that actually needs trying over and over:
// whether the THRESHOLDS feel right — whether a limb goes red when a person
// would say it is wrong, and stays green when they would say it is fine.
//
// So this serves the real comparison engine — the same `poseCompare.ts` the
// app ships, transpiled, not reimplemented — against a webcam, with the
// real reference track. What it canNOT tell you: anything about the native
// detectors (it uses MediaPipe in the browser) or about performance on a
// phone. A Mac's frame rate says nothing about a Galaxy A12.
//
// Usage, from TheraHOME-APP:
//   node scripts/pose-preview/build.mjs --track <track.json> --clip <clip.mp4>
//   python3 -m http.server 8777 --directory scripts/pose-preview/dist
//   open http://localhost:8777
//
// localhost rather than opening the file directly: browsers only hand over
// a camera in a secure context, and localhost counts as one.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const dist = join(here, 'dist');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Both of these import nothing at runtime — only types — so each one
 * transpiles to a standalone ES module with no loader and no bundler. That
 * is not an accident: it is why the engine could be tested under
 * `node --test` in the first place. */
const MODULES = ['src/lib/poseTrack.ts', 'src/lib/poseCompare.ts'];

await mkdir(dist, { recursive: true });

for (const file of MODULES) {
  const source = await readFile(join(root, file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const name = file.split('/').pop().replace(/\.ts$/, '.js');
  await writeFile(join(dist, name), outputText);
  console.log(`transpiled ${file} → dist/${name}`);
}

await copyFile(join(here, 'index.html'), join(dist, 'index.html'));
console.log('copied index.html → dist/index.html');

const trackPath = arg('track');
const clipPath = arg('clip');
if (trackPath) {
  await copyFile(trackPath, join(dist, 'track.json'));
  console.log(`copied ${trackPath} → dist/track.json`);
}
if (clipPath) {
  await copyFile(clipPath, join(dist, 'clip.mp4'));
  console.log(`copied ${clipPath} → dist/clip.mp4`);
}

console.log('\nNow run:\n  python3 -m http.server 8777 --directory scripts/pose-preview/dist\nand open http://localhost:8777');
