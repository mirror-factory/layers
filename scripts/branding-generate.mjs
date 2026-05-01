#!/usr/bin/env node
/**
 * branding:generate — regenerate Layers native app icons from the canonical SVG.
 *
 * Source of truth: branding/source/layers-icon-1024.svg
 *
 * Targets:
 *   - iOS:     ios/App/App/Assets.xcassets/AppIcon.appiconset/*
 *   - Android: android/app/src/main/res/mipmap-* + drawable/ic_launcher_background.xml
 *   - Electron: electron/build/icon.png, icon.icns, icon.ico
 *
 * Pipeline:
 *   1. Stage the master SVG in branding/source/assets/icon.svg (Capacitor expects a directory).
 *   2. Run `@capacitor/assets generate --ios --android` against that directory.
 *   3. Rasterize a 1024x1024 PNG and feed it through `electron-icon-builder` for desktop.
 *   4. Update android/app/src/main/res/drawable/ic_launcher_background.xml to paper-mint.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), '..');

const MASTER_SVG = join(repoRoot, 'branding/source/layers-icon-1024.svg');
const STAGE_DIR = join(repoRoot, 'branding/source/assets');
const STAGE_ICON = join(STAGE_DIR, 'icon.svg');
const ELECTRON_BUILD = join(repoRoot, 'electron/build');
const ANDROID_BG_XML = join(repoRoot, 'android/app/src/main/res/drawable/ic_launcher_background.xml');

const PAPER_LIGHT = '#fafdfb';
const PAPER_DARK = '#1c2436';

if (!existsSync(MASTER_SVG)) {
  console.error(`[branding] master SVG missing at ${MASTER_SVG}`);
  process.exit(1);
}

console.log('[branding] staging master SVG for @capacitor/assets...');
mkdirSync(STAGE_DIR, { recursive: true });
copyFileSync(MASTER_SVG, STAGE_ICON);

console.log('[branding] generating iOS + Android icons via @capacitor/assets...');
// Note: @capacitor/assets v3 has a bug where absolute --assetPath is not honored;
// always pass a relative path resolved from the repo root.
const stageDirRel = `./${relative(repoRoot, STAGE_DIR)}`;
execFileSync(
  'npx',
  [
    '@capacitor/assets',
    'generate',
    '--iconBackgroundColor', PAPER_LIGHT,
    '--iconBackgroundColorDark', PAPER_DARK,
    '--assetPath', stageDirRel,
    '--ios',
    '--android',
  ],
  { stdio: 'inherit', cwd: repoRoot },
);

console.log('[branding] writing paper-mint Android launcher background...');
const launcherBg = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportHeight="108"
    android:viewportWidth="108">
    <path
        android:fillColor="${PAPER_LIGHT}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
`;
writeFileSync(ANDROID_BG_XML, launcherBg);

console.log('[branding] rasterizing 1024x1024 PNG for Electron...');
const sharp = (await import('sharp')).default;
mkdirSync(ELECTRON_BUILD, { recursive: true });
const masterPng = join(ELECTRON_BUILD, 'icon.png');
await sharp(MASTER_SVG, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: PAPER_LIGHT })
  .png()
  .toFile(masterPng);

console.log('[branding] generating .icns / .ico via electron-icon-builder...');
const tmpOut = join(repoRoot, 'branding/generated/electron');
if (existsSync(tmpOut)) rmSync(tmpOut, { recursive: true, force: true });
mkdirSync(tmpOut, { recursive: true });
execFileSync(
  'npx',
  [
    'electron-icon-builder',
    '--input', masterPng,
    '--output', tmpOut,
    '--flatten',
  ],
  { stdio: 'inherit', cwd: repoRoot },
);

// electron-icon-builder writes to <tmpOut>/icons/{icon.icns,icon.ico,icon.png,...}
// Move the desktop deliverables into electron/build.
const generated = join(tmpOut, 'icons');
if (!existsSync(generated)) {
  console.error(`[branding] electron-icon-builder did not create ${generated}`);
  process.exit(1);
}

for (const name of ['icon.icns', 'icon.ico']) {
  const src = join(generated, name);
  if (existsSync(src)) {
    copyFileSync(src, join(ELECTRON_BUILD, name));
  } else {
    console.warn(`[branding] missing expected output: ${name}`);
  }
}
// icon.png in generated is 1024 too; keep our sharp-produced one (already at masterPng).

console.log('[branding] cleaning staging artifacts...');
rmSync(tmpOut, { recursive: true, force: true });

console.log('[branding] done. Artifacts:');
const summarize = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) summarize(full);
    else console.log(`  ${full.replace(repoRoot + '/', '')}`);
  }
};
summarize(ELECTRON_BUILD);
