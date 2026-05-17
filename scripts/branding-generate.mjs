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
 *   1. Render native launcher PNGs from the canonical SVG with `sharp`.
 *   2. Write iOS Contents.json and Android launcher background metadata.
 *   3. Rasterize desktop PNG/ICO assets with `sharp`; generate ICNS via macOS `iconutil`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), '..');

const MASTER_SVG = join(repoRoot, 'branding/source/layers-icon-1024.svg');
const ELECTRON_BUILD = join(repoRoot, 'electron/build');
const IOS_APPICONSET = join(repoRoot, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const ANDROID_RES = join(repoRoot, 'android/app/src/main/res');
const ANDROID_BG_XML = join(repoRoot, 'android/app/src/main/res/drawable/ic_launcher_background.xml');

const PAPER_LIGHT = '#fafdfb';
const PAPER_DARK = '#1c2436';
const IOS_ICONS = [
  { idiom: 'iphone', size: '20x20', scale: '2x', pixels: 40, filename: 'icon-40.png' },
  { idiom: 'iphone', size: '20x20', scale: '3x', pixels: 60, filename: 'icon-60.png' },
  { idiom: 'iphone', size: '29x29', scale: '2x', pixels: 58, filename: 'icon-58.png' },
  { idiom: 'iphone', size: '29x29', scale: '3x', pixels: 87, filename: 'icon-87.png' },
  { idiom: 'iphone', size: '40x40', scale: '2x', pixels: 80, filename: 'icon-80.png' },
  { idiom: 'iphone', size: '40x40', scale: '3x', pixels: 120, filename: 'icon-120-iphone-spotlight.png' },
  { idiom: 'iphone', size: '60x60', scale: '2x', pixels: 120, filename: 'icon-120.png' },
  { idiom: 'iphone', size: '60x60', scale: '3x', pixels: 180, filename: 'icon-180.png' },
  { idiom: 'ipad', size: '20x20', scale: '1x', pixels: 20, filename: 'icon-20.png' },
  { idiom: 'ipad', size: '20x20', scale: '2x', pixels: 40, filename: 'icon-40-ipad-notification.png' },
  { idiom: 'ipad', size: '29x29', scale: '1x', pixels: 29, filename: 'icon-29.png' },
  { idiom: 'ipad', size: '29x29', scale: '2x', pixels: 58, filename: 'icon-58-ipad-settings.png' },
  { idiom: 'ipad', size: '40x40', scale: '1x', pixels: 40, filename: 'icon-40-ipad-spotlight.png' },
  { idiom: 'ipad', size: '40x40', scale: '2x', pixels: 80, filename: 'icon-80-ipad-spotlight.png' },
  { idiom: 'ipad', size: '76x76', scale: '1x', pixels: 76, filename: 'icon-76.png' },
  { idiom: 'ipad', size: '76x76', scale: '2x', pixels: 152, filename: 'icon-152.png' },
  { idiom: 'ipad', size: '83.5x83.5', scale: '2x', pixels: 167, filename: 'icon-167.png' },
  { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', pixels: 1024, filename: 'icon-1024.png' },
];
const ANDROID_DENSITIES = [
  ['ldpi', 36],
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICNS_ENTRIES = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];
async function renderPng(sharp, size) {
  return sharp(MASTER_SVG, { density: 384 })
    .resize(size, size, { fit: 'contain', background: PAPER_LIGHT })
    .png()
    .toBuffer();
}

function writeIco(filePath, images) {
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + entrySize * images.length;
  let offset = directorySize;
  const header = Buffer.alloc(directorySize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  images.forEach(({ size, buffer }, index) => {
    const entryOffset = headerSize + index * entrySize;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += buffer.length;
  });

  writeFileSync(filePath, Buffer.concat([header, ...images.map(({ buffer }) => buffer)]));
}

async function generateIosIcons(sharp) {
  mkdirSync(IOS_APPICONSET, { recursive: true });
  for (const icon of IOS_ICONS) {
    writeFileSync(join(IOS_APPICONSET, icon.filename), await renderPng(sharp, icon.pixels));
  }

  const contents = {
    images: IOS_ICONS.map(({ idiom, scale, size, filename }) => ({
      idiom,
      scale,
      size,
      filename,
    })),
    info: {
      author: 'xcode',
      version: 1,
    },
  };
  writeFileSync(join(IOS_APPICONSET, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

async function generateAndroidIcons(sharp) {
  for (const [density, size] of ANDROID_DENSITIES) {
    const dir = join(ANDROID_RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const icon = await renderPng(sharp, size);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      writeFileSync(join(dir, name), icon);
    }
  }
}

if (!existsSync(MASTER_SVG)) {
  console.error(`[branding] master SVG missing at ${MASTER_SVG}`);
  process.exit(1);
}

const sharp = (await import('sharp')).default;

console.log('[branding] generating iOS icons via sharp...');
await generateIosIcons(sharp);

console.log('[branding] generating Android launcher icons via sharp...');
await generateAndroidIcons(sharp);

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
mkdirSync(ELECTRON_BUILD, { recursive: true });
const masterPng = join(ELECTRON_BUILD, 'icon.png');
writeFileSync(masterPng, await renderPng(sharp, 1024));

console.log('[branding] generating .ico via sharp...');
const tmpOut = join(repoRoot, 'branding/generated/electron');
if (existsSync(tmpOut)) rmSync(tmpOut, { recursive: true, force: true });
mkdirSync(tmpOut, { recursive: true });
const icoImages = [];
for (const size of ICO_SIZES) {
  icoImages.push({ size, buffer: await renderPng(sharp, size) });
}
writeIco(join(ELECTRON_BUILD, 'icon.ico'), icoImages);

console.log('[branding] generating .icns...');
if (process.platform === 'darwin') {
  const iconset = join(tmpOut, 'Layers.iconset');
  mkdirSync(iconset, { recursive: true });
  for (const [name, size] of ICNS_ENTRIES) {
    writeFileSync(join(iconset, name), await renderPng(sharp, size));
  }
  execFileSync(
    'iconutil',
    ['-c', 'icns', iconset, '-o', join(ELECTRON_BUILD, 'icon.icns')],
    { stdio: 'inherit', cwd: repoRoot },
  );
} else if (existsSync(join(ELECTRON_BUILD, 'icon.icns'))) {
  console.warn('[branding] keeping existing icon.icns; regeneration requires macOS iconutil.');
} else {
  console.warn('[branding] icon.icns missing; run this script on macOS before packaging DMGs.');
}

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
