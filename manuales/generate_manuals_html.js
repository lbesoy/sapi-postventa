const fs = require('fs');
const path = require('path');

const MANUALS_DIR = __dirname;

const filesToGenerate = [
  { md: 'manual_cliente.md', htmlFile: 'manual_cliente.html', pdfFile: 'manual_cliente.pdf', title: 'Manual de Uso: Portal del Cliente' },
  { md: 'manual_administrador.md', htmlFile: 'manual_administrador.html', pdfFile: 'manual_administrador.pdf', title: 'Manual de Administración y Supervisión Operativa' },
  { md: 'manual_tecnico.md', htmlFile: 'manual_tecnico.html', pdfFile: 'manual_tecnico.pdf', title: 'Manual del Técnico de Campo y Taller' },
  { md: 'manual_tickets.md', htmlFile: 'manual_tickets.html', pdfFile: 'manual_tickets.pdf', title: 'Manual de Gestión y Ciclo de Tickets' },
  { md: 'manual_gastos.md', htmlFile: 'manual_gastos.html', pdfFile: 'manual_gastos.pdf', title: 'Manual de Control de Gastos e Integración Clara' },
  { md: 'manual_flujo_completo.md', htmlFile: 'manual_flujo_completo.html', pdfFile: 'manual_flujo_completo.pdf', title: 'Manual de Flujo Completo del Sistema' },
  { md: 'manual_tecnico_desarrollador.md', htmlFile: 'manual_tecnico_desarrollador.html', pdfFile: 'manual_tecnico_desarrollador.pdf', title: 'Manual Técnico y de Arquitectura para Desarrolladores' },
  { md: 'README.md', htmlFile: 'README.html', pdfFile: 'README.pdf', title: 'Centro de Documentación y Ayuda Oficial' }
];

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseMarkdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listType = 'ul'; // 'ul' or 'ol'
  let inBlockquote = false;
  let blockquoteBuffer = [];

  function flushList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      let tHtml = '<table><thead>';
      const headerRow = tableRows[0];
      tHtml += '<tr>' + headerRow.map(c => `<th>${formatInline(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
      
      for (let i = 1; i < tableRows.length; i++) {
        const row = tableRows[i];
        tHtml += '<tr>' + row.map(c => `<td>${formatInline(c.trim())}</td>`).join('') + '</tr>';
      }
      tHtml += '</tbody></table>';
      html.push(tHtml);
      inTable = false;
      tableRows = [];
    }
  }

  function flushBlockquote() {
    if (inBlockquote && blockquoteBuffer.length > 0) {
      const fullText = blockquoteBuffer.join('\n').trim();
      let alertClass = '';
      let alertTitle = '';
      let content = fullText;

      if (fullText.startsWith('[!NOTE]')) {
        alertClass = 'alert-note';
        alertTitle = 'ℹ️ NOTA';
        content = fullText.replace(/^\[!NOTE\]\s*/i, '');
      } else if (fullText.startsWith('[!TIP]')) {
        alertClass = 'alert-tip';
        alertTitle = '💡 CONSEJO PRÁCTICO';
        content = fullText.replace(/^\[!TIP\]\s*/i, '');
      } else if (fullText.startsWith('[!IMPORTANT]')) {
        alertClass = 'alert-important';
        alertTitle = '⚠️ IMPORTANTE';
        content = fullText.replace(/^\[!IMPORTANT\]\s*/i, '');
      } else if (fullText.startsWith('[!WARNING]')) {
        alertClass = 'alert-warning';
        alertTitle = '🚨 ADVERTENCIA';
        content = fullText.replace(/^\[!WARNING\]\s*/i, '');
      } else if (fullText.startsWith('[!CAUTION]')) {
        alertClass = 'alert-caution';
        alertTitle = '⛔ PRECAUCIÓN / SEGURIDAD';
        content = fullText.replace(/^\[!CAUTION\]\s*/i, '');
      }

      if (alertClass) {
        html.push(`<div class="alert-card ${alertClass}"><div class="alert-title">${alertTitle}</div>${formatInline(content)}</div>`);
      } else {
        html.push(`<blockquote>${formatInline(content)}</blockquote>`);
      }

      inBlockquote = false;
      blockquoteBuffer = [];
    }
  }

  function formatInline(text) {
    let s = text;
    // Inline code: `code`
    s = s.replace(/`([^`]+)`/g, (m, p1) => `<code>${escapeHtml(p1)}</code>`);
    // Bold: **text** or __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Links: [label](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
      // Fix local .md links to .html
      let targetUrl = url;
      if (targetUrl.endsWith('.md')) {
        targetUrl = targetUrl.replace(/\.md$/, '.html');
      }
      return `<a href="${targetUrl}">${label}</a>`;
    });
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced Code block
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeText = escapeHtml(codeBuffer.join('\n'));
        html.push(`<pre><code class="language-${codeLang}">${codeText}</code></pre>`);
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        // Start code block
        flushList();
        flushTable();
        flushBlockquote();
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Blockquotes (> ...)
    const bqMatch = line.match(/^(?:\s*\d+\.\s+)?\s*>\s?(.*)$/);
    if (bqMatch) {
      flushList();
      flushTable();
      inBlockquote = true;
      blockquoteBuffer.push(bqMatch[1]);
      continue;
    } else if (inBlockquote) {
      if (line.trim().length === 0) {
        flushBlockquote();
      } else if (!line.trim().startsWith('#') && !line.trim().startsWith('|') && !line.trim().startsWith('*') && !line.trim().startsWith('-') && !/^\d+\./.test(line.trim()) && !line.trim().startsWith('```')) {
        blockquoteBuffer.push(line.trim());
        continue;
      } else {
        flushBlockquote();
      }
    }

    // Table rows (| ... |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList();
      flushBlockquote();
      const rawCols = line.trim().split('|').slice(1, -1);
      // Check if it's separator row (|---|---|)
      const isSep = rawCols.every(c => /^[\s:-]+$/.test(c));
      if (!isSep) {
        inTable = true;
        tableRows.push(rawCols);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty lines
    if (line.trim().length === 0) {
      flushList();
      flushTable();
      flushBlockquote();
      continue;
    }

    // Headers
    if (line.startsWith('#### ')) {
      flushList(); flushTable(); flushBlockquote();
      html.push(`<h4>${formatInline(line.slice(5).trim())}</h4>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList(); flushTable(); flushBlockquote();
      html.push(`<h3>${formatInline(line.slice(4).trim())}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList(); flushTable(); flushBlockquote();
      html.push(`<h2>${formatInline(line.slice(3).trim())}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList(); flushTable(); flushBlockquote();
      html.push(`<h1>${formatInline(line.slice(2).trim())}</h1>`);
      continue;
    }

    // Horizontal Rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushList(); flushTable(); flushBlockquote();
      html.push('<hr>');
      continue;
    }

    // Unordered List (* or -)
    if (/^\s*[*+-]\s+/.test(line)) {
      flushTable(); flushBlockquote();
      if (!inList || listType !== 'ul') {
        flushList();
        inList = true;
        listType = 'ul';
        html.push('<ul>');
      }
      const itemContent = line.replace(/^\s*[*+-]\s+/, '');
      html.push(`<li>${formatInline(itemContent)}</li>`);
      continue;
    }

    // Ordered List (1. 2. ...)
    if (/^\s*\d+\.\s+/.test(line)) {
      flushTable(); flushBlockquote();
      if (!inList || listType !== 'ol') {
        flushList();
        inList = true;
        listType = 'ol';
        html.push('<ol>');
      }
      const itemContent = line.replace(/^\s*\d+\.\s+/, '');
      html.push(`<li>${formatInline(itemContent)}</li>`);
      continue;
    }

    // Paragraph
    flushList(); flushTable(); flushBlockquote();
    html.push(`<p>${formatInline(line.trim())}</p>`);
  }

  flushList();
  flushTable();
  flushBlockquote();

  return html.join('\n');
}

function buildFullHtmlPage(renderedBody, title, pdfFile) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Eurorep SAPI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --secondary: #475569;
      --bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
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
      font-size: 15px;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }

    /* Top Floating / Header Bar */
    .viewer-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 24px;
      position: sticky;
      top: 12px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      backdrop-filter: blur(8px);
    }

    .doc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      background: #e0f2fe;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .btn-pdf {
      background: var(--primary);
      color: #ffffff;
      border: 1px solid var(--primary);
    }
    .btn-pdf:hover {
      background: var(--primary-dark);
    }

    .btn-print {
      background: #ffffff;
      color: var(--secondary);
      border: 1px solid var(--border);
    }
    .btn-print:hover {
      background: #f1f5f9;
      color: var(--text);
    }

    /* Content Typography */
    #content {
      margin-top: 10px;
    }

    h1 {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 10px;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 3px solid var(--primary);
      letter-spacing: -0.5px;
    }

    h2 {
      font-size: 21px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 36px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1.5px solid var(--border);
    }

    h3 {
      font-size: 17px;
      font-weight: 700;
      color: #334155;
      margin-top: 28px;
      margin-bottom: 12px;
    }

    h4 {
      font-size: 15px;
      font-weight: 600;
      color: #475569;
      margin-top: 20px;
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 16px;
      color: #334155;
    }

    strong {
      color: #0f172a;
      font-weight: 700;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }

    ul, ol {
      margin-top: 8px;
      margin-bottom: 18px;
      padding-left: 28px;
      color: #334155;
    }

    li {
      margin-bottom: 8px;
    }

    /* Tablas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0 28px 0;
      font-size: 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 12px 14px;
      border: 1px solid var(--border);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 11px 14px;
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
      font-size: 13px;
      background: var(--code-bg);
      color: #e11d48;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 16px 20px;
      border-radius: 10px;
      overflow-x: auto;
      margin: 18px 0 24px 0;
    }

    pre code {
      background: transparent;
      color: #38bdf8;
      padding: 0;
      border: none;
      font-size: 13px;
      line-height: 1.6;
    }

    /* Alert Cards */
    .alert-card {
      margin: 20px 0 24px 0;
      padding: 16px 20px;
      border-radius: 8px;
      border-left: 4px solid;
      font-size: 14.5px;
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
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Imágenes */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid var(--border);
      margin: 14px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.04);
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

    @media print {
      .viewer-topbar { display: none; }
      body { padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="viewer-topbar">
    <div class="doc-badge">EUROREP SAPI — POSTVENTA</div>
    <div class="topbar-actions">
      <button class="btn-action btn-print" onclick="window.print()">
        🖨️ Imprimir
      </button>
      <a href="${pdfFile}" download class="btn-action btn-pdf">
        ⬇️ Descargar PDF
      </a>
    </div>
  </div>

  <div id="content">
    ${renderedBody}
  </div>
</body>
</html>`;
}

function generateAllHtmlFiles() {
  console.log('🚀 Compilando todos los manuales Markdown a HTML estático interactivo...');
  for (const item of filesToGenerate) {
    const mdPath = path.join(MANUALS_DIR, item.md);
    const htmlPath = path.join(MANUALS_DIR, item.htmlFile);

    if (!fs.existsSync(mdPath)) {
      console.warn(`⚠️ Archivo ${item.md} no encontrado. Omitiendo.`);
      continue;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const parsedBody = parseMarkdownToHtml(mdContent);
    const fullHtml = buildFullHtmlPage(parsedBody, item.title, item.pdfFile);
    fs.writeFileSync(htmlPath, fullHtml, 'utf8');
    console.log(`✅ Creado visor HTML pre-renderizado: ${item.htmlFile}`);
  }
  console.log('🎉 ¡Todos los manuales HTML fueron compilados con éxito!');
}

generateAllHtmlFiles();
