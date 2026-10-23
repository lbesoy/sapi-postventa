import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const vendorDir = path.join(rootDir, 'vendor');

if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

const VENDOR_FILES = [
  { url: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', file: 'lucide.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js', file: 'fullcalendar.min.js' },
  { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', file: 'leaflet.js' },
  { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', file: 'leaflet.css' },
  { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js', file: 'chart.umd.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', file: 'pdf.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', file: 'html2pdf.bundle.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', file: 'xlsx.full.min.js' }
];

// Supabase local from node_modules
const localSupabase = path.join(rootDir, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
if (fs.existsSync(localSupabase)) {
  fs.copyFileSync(localSupabase, path.join(vendorDir, 'supabase.js'));
  console.log('✅ Copiado localmente: supabase.js');
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: Status ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
}

async function main() {
  console.log('Descargando librerías para modo 100% Offline en Android...');
  for (const item of VENDOR_FILES) {
    const dest = path.join(vendorDir, item.file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`⏩ Ya existe: ${item.file}`);
      continue;
    }
    try {
      console.log(`⬇️ Descargando ${item.file}...`);
      await downloadFile(item.url, dest);
      console.log(`✅ Guardado: ${item.file} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.warn(`⚠️ Error descargando ${item.file}:`, e.message);
    }
  }
  console.log('🎉 Librerías vendor listas en vendor/.');
}

main();
