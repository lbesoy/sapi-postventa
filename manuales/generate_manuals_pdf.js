const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MANUALS_DIR = __dirname;

const filesToConvert = [
  { md: 'manual_cliente.md', pdf: 'manual_cliente.pdf', title: 'Manual de Uso: Portal del Cliente' },
  { md: 'manual_administrador.md', pdf: 'manual_administrador.pdf', title: 'Manual de Administración y Supervisión Operativa' },
  { md: 'manual_tecnico.md', pdf: 'manual_tecnico.pdf', title: 'Manual del Técnico de Campo y Taller' },
  { md: 'manual_tickets.md', pdf: 'manual_tickets.pdf', title: 'Manual de Gestión y Ciclo de Tickets' },
  { md: 'manual_gastos.md', pdf: 'manual_gastos.pdf', title: 'Manual de Control de Gastos e Integración Clara' },
  { md: 'manual_flujo_completo.md', pdf: 'manual_flujo_completo.pdf', title: 'Manual de Flujo Completo del Sistema' },
  { md: 'manual_tecnico_desarrollador.md', pdf: 'manual_tecnico_desarrollador.pdf', title: 'Manual Técnico y de Arquitectura para Desarrolladores' },
  { md: 'README.md', pdf: 'README.pdf', title: 'Centro de Documentación y Ayuda Oficial' }
];

function getHtmlTemplate(markdownContent, title) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.1/marked.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --secondary: #475569;
      --bg: #ffffff;
      --text: #0f172a;
      --text-muted: #475569;
      --border: #e2e8f0;
      --card-bg: #f8fafc;
      --code-bg: #f1f5f9;
      --accent: #f59e0b;
      --success: #10b981;
      --danger: #ef4444;
      --purple: #8b5cf6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13.5px;
      line-height: 1.65;
      color: var(--text);
      background: var(--bg);
      padding: 10px 25px;
    }

    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 10px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 3px solid var(--primary);
      letter-spacing: -0.5px;
      page-break-after: avoid;
    }

    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 26px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid var(--border);
      page-break-after: avoid;
    }

    h3 {
      font-size: 15px;
      font-weight: 700;
      color: #334155;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    h4 {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 12px;
      color: #334155;
    }

    strong {
      color: #0f172a;
      font-weight: 700;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 22px 0;
    }

    ul, ol {
      margin-top: 6px;
      margin-bottom: 14px;
      padding-left: 24px;
      color: #334155;
    }

    li {
      margin-bottom: 6px;
    }

    /* Tablas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 20px 0;
      font-size: 12.5px;
      page-break-inside: avoid;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid var(--border);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 9px 12px;
      border: 1px solid var(--border);
      color: #334155;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Código */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--code-bg);
      color: #e11d48;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 14px 0 18px 0;
      page-break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: #38bdf8;
      padding: 0;
      border: none;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Blockquotes / Callouts */
    blockquote {
      margin: 14px 0 18px 0;
      padding: 12px 16px;
      border-left: 4px solid var(--primary);
      background: #eff6ff;
      border-radius: 0 8px 8px 0;
      color: #1e3a8a;
      font-size: 13px;
      page-break-inside: avoid;
    }

    .alert-card {
      margin: 14px 0 18px 0;
      padding: 12px 16px;
      border-radius: 6px;
      border-left: 4px solid;
      font-size: 13px;
      page-break-inside: avoid;
    }

    .alert-note {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }

    .alert-tip {
      background: #f0fdf4;
      border-color: #10b981;
      color: #065f46;
    }

    .alert-important {
      background: #fefce8;
      border-color: #eab308;
      color: #854d0e;
    }

    .alert-warning {
      background: #fff7ed;
      border-color: #f97316;
      color: #9a3412;
    }

    .alert-caution {
      background: #fef2f2;
      border-color: #ef4444;
      color: #991b1b;
    }

    .alert-title {
      font-weight: 700;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Imágenes */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid var(--border);
      margin: 10px 0;
      page-break-inside: avoid;
    }

    /* Links */
    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    a:hover {
      text-decoration: underline;
    }

    .doc-badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 12px;
      background: #e0f2fe;
      color: #0369a1;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="doc-badge">SAPI Postventa — Eurorep CRM</div>
  <div id="content"></div>

  <textarea id="raw-markdown" style="display:none;">${markdownContent.replace(/<\/textarea>/gi, '<\\/textarea>')}</textarea>

  <script>
    const rawMd = document.getElementById('raw-markdown').value;
    marked.setOptions({
      gfm: true,
      breaks: true
    });

    let html = marked.parse(rawMd);

    // Transform GitHub alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
    html = html.replace(/<blockquote>\s*<p>\s*\[!NOTE\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, p1) {
      return '<div class="alert-card alert-note"><div class="alert-title">ℹ️ NOTA</div>' + p1 + '</div>';
    });
    html = html.replace(/<blockquote>\s*<p>\s*\[!TIP\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, p1) {
      return '<div class="alert-card alert-tip"><div class="alert-title">💡 CONSEJO PRÁCTICO</div>' + p1 + '</div>';
    });
    html = html.replace(/<blockquote>\s*<p>\s*\[!IMPORTANT\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, p1) {
      return '<div class="alert-card alert-important"><div class="alert-title">⚠️ IMPORTANTE</div>' + p1 + '</div>';
    });
    html = html.replace(/<blockquote>\s*<p>\s*\[!WARNING\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, p1) {
      return '<div class="alert-card alert-warning"><div class="alert-title">🚨 ADVERTENCIA</div>' + p1 + '</div>';
    });
    html = html.replace(/<blockquote>\s*<p>\s*\[!CAUTION\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, p1) {
      return '<div class="alert-card alert-caution"><div class="alert-title">⛔ PRECAUCIÓN / SEGURIDAD</div>' + p1 + '</div>';
    });

    document.getElementById('content').innerHTML = html;
  </script>
</body>
</html>`;
}

async function generateAllPdfs() {
  console.log('🚀 Iniciando compilación de manuales en PDF con Puppeteer y Google Chrome...');
  
  if (!fs.existsSync(CHROME_PATH)) {
    console.error('❌ No se encontró Google Chrome en:', CHROME_PATH);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  for (const item of filesToConvert) {
    const mdPath = path.join(MANUALS_DIR, item.md);
    const pdfPath = path.join(MANUALS_DIR, item.pdf);

    if (!fs.existsSync(mdPath)) {
      console.warn(`⚠️ Archivo ${item.md} no encontrado. Omitiendo.`);
      continue;
    }

    console.log(`📄 Procesando: ${item.md} -> ${item.pdf}`);
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const html = getHtmlTemplate(mdContent, item.title);

    const page = await browser.newPage();
    
    // Set content and wait until network idle for CDN scripts
    await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });

    // Allow a small delay for marked.js and CSS rendering
    await new Promise(r => setTimeout(r, 600));

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '24mm',
        bottom: '22mm',
        left: '18mm',
        right: '18mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width: 100%; font-size: 8px; font-family: sans-serif; color: #94a3b8; display: flex; justify-content: space-between; padding: 0 18mm; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          <span style="font-weight: bold; color: #2563eb;">EUROREP SAPI — POSTVENTA & SERVICIO</span>
          <span>${item.title}</span>
        </div>
      `,
      footerTemplate: `
        <div style="width: 100%; font-size: 8px; font-family: sans-serif; color: #94a3b8; display: flex; justify-content: space-between; padding: 0 18mm; border-top: 1px solid #e2e8f0; padding-top: 4px;">
          <span>Documentación Oficial del Sistema</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `
    });

    await page.close();
    console.log(`✅ Generado con éxito: ${item.pdf}`);
  }

  await browser.close();
  console.log('🎉 ¡Todos los manuales en PDF fueron compilados exitosamente!');
}

generateAllPdfs().catch(err => {
  console.error('❌ Error durante la generación de PDFs:', err);
  process.exit(1);
});
