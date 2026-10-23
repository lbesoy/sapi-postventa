#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const logoPath = path.join(rootDir, 'logo_transparent.png');
const resDir = path.join(rootDir, 'android/app/src/main/res');
const tempDir = path.join(rootDir, '.temp_icons');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('🎨 Generando iconos nativos y Splash Screens de Eurorep...');

const mipmaps = [
  { dir: 'mipmap-mdpi', iconSize: 48, iconH: 34, fgSize: 108, fgH: 56 },
  { dir: 'mipmap-hdpi', iconSize: 72, iconH: 50, fgSize: 162, fgH: 84 },
  { dir: 'mipmap-xhdpi', iconSize: 96, iconH: 68, fgSize: 216, fgH: 112 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, iconH: 102, fgSize: 324, fgH: 168 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, iconH: 136, fgSize: 432, fgH: 224 }
];

for (const m of mipmaps) {
  const targetDir = path.join(resDir, m.dir);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // 1. ic_launcher.png (White background with Eurorep Logo)
  const tempIcon = path.join(tempDir, `icon_${m.iconSize}_raw.png`);
  const finalIcon = path.join(targetDir, 'ic_launcher.png');
  const finalRoundIcon = path.join(targetDir, 'ic_launcher_round.png');
  execSync(`sips --resampleHeight ${m.iconH} "${logoPath}" --out "${tempIcon}" 2>/dev/null`);
  execSync(`sips --padToHeightWidth ${m.iconSize} ${m.iconSize} --padColor FFFFFF "${tempIcon}" --out "${finalIcon}" 2>/dev/null`);
  fs.copyFileSync(finalIcon, finalRoundIcon);

  // 2. ic_launcher_foreground.png (Transparent background adaptive icon)
  const tempFg = path.join(tempDir, `fg_${m.fgSize}_raw.png`);
  const finalFg = path.join(targetDir, 'ic_launcher_foreground.png');
  execSync(`sips --resampleHeight ${m.fgH} "${logoPath}" --out "${tempFg}" 2>/dev/null`);
  execSync(`sips --padToHeightWidth ${m.fgSize} ${m.fgSize} "${tempFg}" --out "${finalFg}" 2>/dev/null`);

  console.log(`✅ [${m.dir}] ic_launcher, ic_launcher_round (${m.iconSize}x${m.iconSize}) y foreground (${m.fgSize}x${m.fgSize}) creados.`);
}

// Remove XML vector drawable that overrides foreground png on API 24+
const vectorFg = path.join(resDir, 'drawable-v24/ic_launcher_foreground.xml');
if (fs.existsSync(vectorFg)) {
  fs.unlinkSync(vectorFg);
  console.log('🗑️  Eliminado drawable-v24/ic_launcher_foreground.xml para dar prioridad al logo de Eurorep.');
}

// 3. Splash Screens
const splashes = [
  { folder: 'drawable', w: 480, h: 800, logoH: 180 },
  { folder: 'drawable-port-mdpi', w: 320, h: 480, logoH: 120 },
  { folder: 'drawable-port-hdpi', w: 480, h: 800, logoH: 180 },
  { folder: 'drawable-port-xhdpi', w: 720, h: 1280, logoH: 260 },
  { folder: 'drawable-port-xxhdpi', w: 960, h: 1600, logoH: 360 },
  { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920, logoH: 480 },
  { folder: 'drawable-land-mdpi', w: 480, h: 320, logoH: 120 },
  { folder: 'drawable-land-hdpi', w: 800, h: 480, logoH: 180 },
  { folder: 'drawable-land-xhdpi', w: 1280, h: 720, logoH: 260 },
  { folder: 'drawable-land-xxhdpi', w: 1600, h: 960, logoH: 360 },
  { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280, logoH: 480 }
];

for (const s of splashes) {
  const targetDir = path.join(resDir, s.folder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const tempSplash = path.join(tempDir, `splash_${s.w}x${s.h}_raw.png`);
  const finalSplash = path.join(targetDir, 'splash.png');
  execSync(`sips --resampleHeight ${s.logoH} "${logoPath}" --out "${tempSplash}" 2>/dev/null`);
  execSync(`sips --padToHeightWidth ${s.h} ${s.w} --padColor FFFFFF "${tempSplash}" --out "${finalSplash}" 2>/dev/null`);
  console.log(`✅ [${s.folder}] splash.png (${s.w}x${s.h}) creado.`);
}

// Cleanup tempDir
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('🎉 ¡Todos los iconos y pantallas de carga de Eurorep generados exitosamente!');
