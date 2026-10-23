#!/usr/bin/env node
/**
 * Script de Ensamblaje y Compilación Móvil para Android - Eurorep / SAPI
 * Archivo: scripts/build-mobile.mjs
 *
 * Prepara el paquete local en 'dist/' para Capacitor Android:
 * 1. Ensambla index.html actualizado desde src/html/.
 * 2. Reemplaza dependencias de CDN externas por librerías locales en dist/vendor/.
 * 3. Inyecta soporte para Capacitor JS y metadatos de viewport-fit=cover para notch de Android.
 * 4. Copia todos los módulos JS, CSS, imágenes, manuales y activos a dist/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileHtml } from './build-html.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const vendorDir = path.join(rootDir, 'vendor');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('📱 Compilando paquete móvil SAPI para Android...');

// 1. Compilar index.html fresco
const compiledHtml = compileHtml();
ensureDir(distDir);

// 2. Adaptar index.html para entorno Android nativo 100% Offline
let mobileHtml = compiledHtml;

// Asegurar viewport móvil con soporte para notch / corte de cámara y escala 1:1 nítida
mobileHtml = mobileHtml.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
);

// Reemplazos de CDN a locales en vendor/
const CDN_REPLACEMENTS = [
  ['https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', 'vendor/lucide.min.js'],
  ['https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js', 'vendor/fullcalendar.min.js'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'vendor/leaflet.css'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'vendor/leaflet.js'],
  ['https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js', 'vendor/chart.umd.min.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'vendor/pdf.min.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'vendor/html2pdf.bundle.min.js'],
  ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js'],
  ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'vendor/supabase.js']
];

CDN_REPLACEMENTS.forEach(([cdn, local]) => {
  mobileHtml = mobileHtml.replaceAll(cdn, local);
});

// Inyectar bandera de app móvil y puente capacitor.js si no están presentes
if (!mobileHtml.includes('window.IS_MOBILE_APP')) {
  mobileHtml = mobileHtml.replace('<head>', '<head>\n  <script>window.IS_MOBILE_APP = true;</script>');
}
if (!mobileHtml.includes('capacitor.js')) {
  mobileHtml = mobileHtml.replace('</head>', '  <script src="capacitor.js"></script>\n</head>');
}

fs.writeFileSync(path.join(distDir, 'index.html'), mobileHtml, 'utf8');
console.log('✅ dist/index.html preparado con librerías offline y capacitor.js');

// 3. Preparar cliente.html para móvil
if (fs.existsSync(path.join(rootDir, 'cliente.html'))) {
  let clienteHtml = fs.readFileSync(path.join(rootDir, 'cliente.html'), 'utf8');
  CDN_REPLACEMENTS.forEach(([cdn, local]) => {
    clienteHtml = clienteHtml.replaceAll(cdn, local);
  });
  if (!clienteHtml.includes('capacitor.js')) {
    clienteHtml = clienteHtml.replace('</head>', '  <script src="capacitor.js"></script>\n</head>');
  }
  fs.writeFileSync(path.join(distDir, 'cliente.html'), clienteHtml, 'utf8');
  console.log('✅ dist/cliente.html preparado');
}

// 4. Copiar carpeta vendor/
if (fs.existsSync(vendorDir)) {
  copyDirRecursive(vendorDir, path.join(distDir, 'vendor'));
  console.log('✅ dist/vendor/ copiado');
}

// 5. Copiar CSS y JS locales
const filesInRoot = fs.readdirSync(rootDir);
let countJs = 0;
let countCss = 0;
let countImg = 0;

for (const file of filesInRoot) {
  const ext = path.extname(file).toLowerCase();
  const filePath = path.join(rootDir, file);
  if (!fs.statSync(filePath).isFile()) continue;

  if (ext === '.js') {
    fs.copyFileSync(filePath, path.join(distDir, file));
    countJs++;
  } else if (ext === '.css') {
    fs.copyFileSync(filePath, path.join(distDir, file));
    countCss++;
  } else if (['.png', '.svg', '.jpg', '.jpeg', '.ico', '.json'].includes(ext)) {
    if (file !== 'package.json' && file !== 'package-lock.json' && file !== 'tsconfig.json' && file !== 'jsconfig.json' && file !== 'serve.json') {
      fs.copyFileSync(filePath, path.join(distDir, file));
      countImg++;
    }
  }
}
console.log(`✅ Copiados a dist/: ${countJs} archivos JS, ${countCss} CSS y ${countImg} imágenes/recursos.`);

// 6. Copiar manuales si existen
if (fs.existsSync(path.join(rootDir, 'manuales'))) {
  copyDirRecursive(path.join(rootDir, 'manuales'), path.join(distDir, 'manuales'));
  console.log('✅ dist/manuales/ copiado');
}

// 7. Copiar src/ si es necesario
if (fs.existsSync(path.join(rootDir, 'src'))) {
  copyDirRecursive(path.join(rootDir, 'src'), path.join(distDir, 'src'));
  console.log('✅ dist/src/ copiado');
}

// 8. Regenerar iconos y splash nativos de Eurorep para Android
const iconScript = path.join(rootDir, 'scripts/generate-android-icons.mjs');
if (fs.existsSync(iconScript)) {
  try {
    const { execSync } = await import('child_process');
    execSync('node scripts/generate-android-icons.mjs', { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.warn('⚠️ Advertencia al actualizar iconos de Android:', err.message);
  }
}

// 9. Sincronizar automáticamente a los assets nativos de Android
const androidAssetsPublic = path.join(rootDir, 'android/app/src/main/assets/public');
if (fs.existsSync(androidAssetsPublic)) {
  copyDirRecursive(distDir, androidAssetsPublic);
  console.log('✅ Sincronizados assets directamente a android/app/src/main/assets/public/');
}

console.log('🎉 Paquete móvil generado exitosamente en dist/ y sincronizado con Android.');

