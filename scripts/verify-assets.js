#!/usr/bin/env node

/**
 * Script de Verificación de Integridad y Activos - Eurorep / SAPI
 * Valida antes de cualquier despliegue que:
 * 1. Todos los scripts y manuales referenciados existan en disco.
 * 2. Ningún archivo referenciado esté como untracked (olvidado) en Git.
 * 3. Todos los archivos JavaScript pasen chequeo de sintaxis (node -c).
 * 4. Las claves críticas de almacenamiento estén protegidas en localstorage-bridge.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
let hasErrors = false;

function error(msg) {
  console.error(`❌ [ERROR] ${msg}`);
  hasErrors = true;
}

function success(msg) {
  console.log(`✅ [OK] ${msg}`);
}

function warn(msg) {
  console.warn(`⚠️ [WARN] ${msg}`);
}

console.log('=====================================================');
console.log('🔍 INICIANDO AUDITORÍA PREVENTIVA DE INTEGRIDAD SAPI');
console.log('=====================================================\n');

// 1. EXTRAER SCRIPTS DE index.html y cliente.html
function extractReferencedScripts(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const scripts = new Set();

  // A) src="..."
  const srcRegex = /<script[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = srcRegex.exec(content)) !== null) {
    const src = match[1].split('?')[0];
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      scripts.add(src);
    }
  }

  // B) Array var scripts = [ ... ]
  const arrayRegex = /scripts\s*=\s*\[([\s\S]*?)\]/g;
  while ((match = arrayRegex.exec(content)) !== null) {
    const rawItems = match[1];
    const itemRegex = /["']([^"']+)["']/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(rawItems)) !== null) {
      const src = itemMatch[1].split('?')[0];
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        scripts.add(src);
      }
    }
  }

  return Array.from(scripts);
}

const htmlFiles = ['index.html', 'cliente.html'];
const allLocalScripts = new Set();

htmlFiles.forEach(htmlFile => {
  const fullPath = path.join(ROOT_DIR, htmlFile);
  if (!fs.existsSync(fullPath)) {
    error(`Archivo HTML base no encontrado: ${htmlFile}`);
    return;
  }
  const scripts = extractReferencedScripts(fullPath);
  console.log(`📄 Analizando ${htmlFile} (${scripts.length} scripts locales encontrados):`);
  scripts.forEach(s => {
    allLocalScripts.add(s);
    const scriptPath = path.join(ROOT_DIR, s);
    if (!fs.existsSync(scriptPath)) {
      error(`En ${htmlFile}: el archivo referenciado "${s}" NO existe en disco.`);
    } else {
      console.log(`   - ${s} [Presente]`);
    }
  });
  console.log('');
});

// 2. VERIFICAR QUE NO HAYA ARCHIVOS UNTRACKED EN GIT
console.log('📦 Verificando estado en Git de los archivos indispensables...');
try {
  const statusOut = execSync('GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git status --porcelain', { cwd: ROOT_DIR }).toString();
  const untrackedFiles = statusOut
    .split('\n')
    .filter(l => l.startsWith('??'))
    .map(l => l.replace('??', '').trim());

  allLocalScripts.forEach(script => {
    if (untrackedFiles.includes(script)) {
      error(`El archivo "${script}" está en uso pero aparece como UNTRACKED (??) en Git. Debe agregarse al repositorio.`);
    }
  });

  if (!hasErrors) {
    success('Todos los scripts en uso están bajo seguimiento en Git.');
  }
} catch (e) {
  warn(`No se pudo verificar el estado de Git: ${e.message}`);
}
console.log('');

// 3. CHEQUEO DE SINTAXIS JAVASCRIPT (node -c)
console.log('⚡ Comprobando sintaxis de archivos JavaScript...');
allLocalScripts.forEach(script => {
  const scriptPath = path.join(ROOT_DIR, script);
  if (fs.existsSync(scriptPath) && script.endsWith('.js')) {
    try {
      execSync(`node -c "${scriptPath}"`);
      console.log(`   - ${script}: Sintaxis válida`);
    } catch (e) {
      error(`Error de sintaxis en ${script}: ${e.message}`);
    }
  }
});

// Comprobar también módulos en src/ (recursivo)
const srcDir = path.join(ROOT_DIR, 'src');
if (fs.existsSync(srcDir)) {
  function checkDir(dir, prefix = 'src/') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath, `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        try {
          execSync(`node -c "${fullPath}"`);
          console.log(`   - ${prefix}${entry.name}: Sintaxis válida`);
        } catch (e) {
          error(`Error de sintaxis en ${prefix}${entry.name}: ${e.message}`);
        }
      }
    });
  }
  checkDir(srcDir);
}
console.log('');

// 4. VERIFICAR PROTECCIÓN EN localstorage-bridge.js
console.log('🛡️ Verificando claves críticas en localstorage-bridge.js...');
const bridgePath = path.join(ROOT_DIR, 'localstorage-bridge.js');
if (fs.existsSync(bridgePath)) {
  const bridgeContent = fs.readFileSync(bridgePath, 'utf8');
  const requiredKeys = ['sapi_refacciones_db', 'sapi_sync_queue', 'sapi_tickets', 'sapi_ordenes', 'sapi_levantamientos'];
  const missingKeys = requiredKeys.filter(k => !bridgeContent.includes(`'${k}'`) && !bridgeContent.includes(`"${k}"`));

  if (missingKeys.length > 0) {
    error(`Faltan claves críticas en redirectedKeys de localstorage-bridge.js: ${missingKeys.join(', ')}`);
  } else {
    success('Todas las claves críticas pesadas están redirigidas a IndexedDB.');
  }
} else {
  error('localstorage-bridge.js no existe.');
}
console.log('');

// 5. VERIFICAR QUE NINGÚN SECRETO (.env*) ESTÉ SEGUIDO EN GIT
console.log('🔒 Verificando que no haya secretos o archivos .env en el índice de Git...');
try {
  const trackedEnv = execSync('GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git ls-files ".env*" "*.env.local"', { cwd: ROOT_DIR })
    .toString()
    .trim();
  if (trackedEnv) {
    const trackedList = trackedEnv.split('\n').filter(Boolean);
    error(`Se detectaron archivos de entorno/secretos seguidos en Git:\n   - ${trackedList.join('\n   - ')}\n   Usa "git rm --cached <archivo>" y agrégalos a .gitignore.`);
  } else {
    success('Ningún archivo de variables de entorno (.env) está expuesto en Git.');
  }
} catch (e) {
  warn(`No se pudo verificar el rastreo de secretos en Git: ${e.message}`);
}
console.log('');

// 5. RESUMEN FINAL
console.log('=====================================================');
if (hasErrors) {
  console.error('❌ LA AUDITORÍA HA DETECTADO PROBLEMAS CRÍTICOS.');
  console.error('Resuelve los errores antes de probar o desplegar.');
  console.log('=====================================================');
  process.exit(1);
} else {
  console.log('🎉 AUDITORÍA COMPLETADA CON ÉXITO: 0 ERRORES ENCONTRADOS.');
  console.log('El sistema se encuentra íntegro y protegido.');
  console.log('=====================================================');
  process.exit(0);
}
