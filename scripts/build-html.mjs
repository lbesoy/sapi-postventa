#!/usr/bin/env node
/**
 * Eurorep SAPI - Compilador y Ensamblador de Plantillas HTML Modulares
 * Archivo: scripts/build-html.mjs
 *
 * Lee src/html/app_shell.html y ensambla las vistas (src/html/views/*.html)
 * y los modales (src/html/modals/*.html) en el index.html principal.
 *
 * Modos de ejecución:
 *   node scripts/build-html.mjs         -> Compila index.html
 *   node scripts/build-html.mjs --check -> Valida que index.html esté sincronizado
 *   node scripts/build-html.mjs --watch -> Observa cambios en src/html/ y recompila al instante
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcHtmlDir = path.join(rootDir, 'src', 'html');
const shellPath = path.join(srcHtmlDir, 'app_shell.html');
const targetIndexPath = path.join(rootDir, 'index.html');

export function compileHtml() {
  if (!fs.existsSync(shellPath)) {
    throw new Error(`No se encontró la plantilla base: ${shellPath}`);
  }

  const shellContent = fs.readFileSync(shellPath, 'utf8');
  const includeRegex = /<!-- @@include "([^"]+)" -->/g;

  const compiled = shellContent.replace(includeRegex, (match, relPath) => {
    const componentPath = path.join(srcHtmlDir, relPath);
    if (!fs.existsSync(componentPath)) {
      console.warn(`[Build HTML] Advertencia: No se encontró el componente: ${relPath}`);
      return `<!-- Componente no encontrado: ${relPath} -->`;
    }
    return fs.readFileSync(componentPath, 'utf8');
  });

  return compiled;
}

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const isWatchMode = args.includes('--watch');

if (isCheckMode) {
  try {
    const compiled = compileHtml();
    const existing = fs.readFileSync(targetIndexPath, 'utf8');
    if (compiled !== existing) {
      console.error('❌ [Build HTML] Error: index.html no coincide con las plantillas modulares en src/html/.');
      console.error('   Ejecuta: npm run build:html');
      process.exit(1);
    }
    console.log('✅ [Build HTML] index.html se encuentra 100% sincronizado con src/html/.');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Build HTML] Error durante la verificación:', err.message);
    process.exit(1);
  }
} else if (isWatchMode) {
  console.log('👀 [Build HTML] Observando cambios en src/html/ (views/ y modals/)...');
  
  // Compilar inicial
  const initial = compileHtml();
  fs.writeFileSync(targetIndexPath, initial, 'utf8');
  console.log(`⚡ [Build HTML] index.html compilado exitosamente (${(initial.length / 1024).toFixed(1)} KB).`);

  let debounceTimer = null;
  fs.watch(srcHtmlDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const updated = compileHtml();
        fs.writeFileSync(targetIndexPath, updated, 'utf8');
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] ⚡ [Build HTML] Actualizado index.html tras cambios en ${filename}`);
      } catch (err) {
        console.error('❌ [Build HTML] Error al recompilar:', err.message);
      }
    }, 100);
  });
} else {
  try {
    const compiled = compileHtml();
    fs.writeFileSync(targetIndexPath, compiled, 'utf8');
    console.log(`✅ [Build HTML] index.html compilado exitosamente (${(compiled.length / 1024).toFixed(1)} KB).`);
  } catch (err) {
    console.error('❌ [Build HTML] Error al compilar index.html:', err.message);
    process.exit(1);
  }
}
