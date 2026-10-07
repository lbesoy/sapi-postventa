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
      let tHtml = '<div class="table-container"><table><thead>';
      const headerRow = tableRows[0];
      tHtml += '<tr>' + headerRow.map(c => `<th>${formatInline(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
      
      for (let i = 1; i < tableRows.length; i++) {
        const row = tableRows[i];
        tHtml += '<tr>' + row.map(c => `<td>${formatInline(c.trim())}</td>`).join('') + '</tr>';
      }
      tHtml += '</tbody></table></div>';
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
        alertTitle = 'ℹ️ NOTA INFORMATIVA';
        content = fullText.replace(/^\[!NOTE\]\s*/i, '');
      } else if (fullText.startsWith('[!TIP]')) {
        alertClass = 'alert-tip';
        alertTitle = '💡 CONSEJO PRÁCTICO';
        content = fullText.replace(/^\[!TIP\]\s*/i, '');
      } else if (fullText.startsWith('[!IMPORTANT]')) {
        alertClass = 'alert-important';
        alertTitle = '⚠️ REQUISITO OPERATIVO IMPORTANTE';
        content = fullText.replace(/^\[!IMPORTANT\]\s*/i, '');
      } else if (fullText.startsWith('[!WARNING]')) {
        alertClass = 'alert-warning';
        alertTitle = '🚨 ADVERTENCIA';
        content = fullText.replace(/^\[!WARNING\]\s*/i, '');
      } else if (fullText.startsWith('[!CAUTION]')) {
        alertClass = 'alert-caution';
        alertTitle = '⛔ PRECAUCIÓN Y SEGURIDAD';
        content = fullText.replace(/^\[!CAUTION\]\s*/i, '');
      }

      if (alertClass) {
        html.push(`<div class="alert-card ${alertClass}"><div class="alert-title">${alertTitle}</div><div class="alert-body">${formatInline(content)}</div></div>`);
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
        const rawCode = codeBuffer.join('\n');
        const codeText = escapeHtml(rawCode);
        const isDiagram = /[➔◄▲▼►◄│─┌┐└┘├┤┼]/i.test(rawCode) || /->|<-|-->|<--/i.test(rawCode);
        const headerTitle = codeLang ? codeLang.toUpperCase() : (isDiagram ? 'MAPA DE FLUJO OPERATIVO' : 'TERMINAL / ESQUEMA TÉCNICO');
        
        let formattedCode = codeText;
        if (isDiagram) {
          // Highlight arrows in bright Eurorep orange
          formattedCode = formattedCode
            .replace(/([➔◄▲▼►◄]|\-\-\>|\<\-\-|\-\>|\<\-)/g, '<span class="diag-arrow">$1</span>')
            .replace(/([│─┌┐└┘├┤┼|])/g, '<span class="diag-pipe">$1</span>')
            .replace(/(\[[^\]]+\])/g, '<span class="diag-node">$1</span>');
        }
        
        html.push(`
<div class="code-terminal-card">
  <div class="code-terminal-header">
    <div class="terminal-dots">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
    </div>
    <span class="terminal-title">${headerTitle}</span>
    <span class="terminal-badge">SAPI POSTVENTA</span>
  </div>
  <pre><code class="language-${codeLang || 'text'}">${formattedCode}</code></pre>
</div>`);
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
      const titleText = formatInline(line.slice(2).trim());
      html.push(`
<div class="doc-header-banner">
  <div class="header-supertitle">
    <span class="supertitle-dot"></span> EUROREP S.A.P.I. DE C.V. • SISTEMA POSTVENTA
  </div>
  <h1>${titleText}</h1>
  <div class="header-accent-bar"></div>
  <div class="meta-chips-bar">
    <span class="chip chip-primary">🏢 Eurorep CRM & Operaciones</span>
    <span class="chip">⚙️ SAP Business One & Supabase</span>
    <span class="chip">📅 Vigencia 2026</span>
    <span class="chip">📘 Guía Oficial del Sistema</span>
  </div>
</div>`);
      continue;
    }

    // Horizontal Rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushList(); flushTable(); flushBlockquote();
      html.push('<hr class="doc-divider">');
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
  // Cargar logotipo de Eurorep en Base64 para autosuficiencia total
  let logoDataUri = '';
  try {
    const localLogo = path.join(MANUALS_DIR, 'logo_transparent.png');
    const rootLogo = path.join(MANUALS_DIR, '..', 'logo_transparent.png');
    const targetLogo = fs.existsSync(localLogo) ? localLogo : (fs.existsSync(rootLogo) ? rootLogo : null);
    if (targetLogo) {
      const b64 = fs.readFileSync(targetLogo).toString('base64');
      logoDataUri = `data:image/png;base64,${b64}`;
    }
  } catch (e) {
    console.error('Error leyendo logotipo Eurorep:', e);
  }
  if (!logoDataUri) {
    logoDataUri = '../logo_transparent.png';
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Eurorep SAPI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* ===== EUROREP CORPORATE BRAND TOKENS ===== */
      --eurorep-orange: #E8820C;
      --eurorep-orange-hover: #cf7009;
      --eurorep-orange-light: #fff7ed;
      --eurorep-orange-border: #fed7aa;
      --eurorep-orange-glow: rgba(232, 130, 12, 0.22);

      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-400: #94a3b8;
      --slate-300: #cbd5e1;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;

      --primary: var(--eurorep-orange);
      --primary-hover: var(--eurorep-orange-hover);
      --primary-light: var(--eurorep-orange-light);
      --border: var(--slate-200);
      --text-main: var(--slate-900);
      --text-body: var(--slate-700);
      --text-muted: var(--slate-500);

      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --info: #0284c7;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.72;
      color: var(--text-body);
      background: var(--slate-50);
      padding: 16px 20px 60px 20px;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* ===== STICKY TOPBAR BRANDED ===== */
    .viewer-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 14px;
      position: sticky;
      top: 12px;
      z-index: 100;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      max-width: 1040px;
      margin: 0 auto 18px auto;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .topbar-logo-link {
      display: flex;
      align-items: center;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    .topbar-logo-link:hover {
      opacity: 0.85;
    }

    .topbar-logo {
      height: 32px;
      width: auto;
      object-fit: contain;
    }

    .topbar-divider {
      width: 1px;
      height: 24px;
      background: var(--slate-300);
    }

    .doc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-size: 11.5px;
      font-weight: 700;
      border-radius: 9999px;
      background: var(--eurorep-orange-light);
      color: #c2410c;
      border: 1px solid var(--eurorep-orange-border);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .doc-badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--eurorep-orange);
      box-shadow: 0 0 6px var(--eurorep-orange-glow);
    }

    .topbar-title-tag {
      font-size: 13px;
      font-weight: 500;
      color: var(--slate-500);
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
      border: 1px solid transparent;
      user-select: none;
    }

    .btn-print {
      background: #ffffff;
      color: var(--slate-700);
      border: 1px solid var(--slate-300);
    }
    .btn-print:hover {
      background: var(--slate-100);
      border-color: var(--slate-400);
      color: var(--slate-900);
    }

    .btn-pdf {
      background: linear-gradient(135deg, #E8820C 0%, #cf7009 100%);
      color: #ffffff;
      border: none;
      box-shadow: 0 2px 8px rgba(232, 130, 12, 0.35);
    }
    .btn-pdf:hover {
      background: linear-gradient(135deg, #f59e0b 0%, #E8820C 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(232, 130, 12, 0.45);
    }

    /* ===== MAIN DOCUMENT CARD ===== */
    .doc-wrapper {
      max-width: 1040px;
      margin: 0 auto;
    }

    .doc-sheet {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 44px 52px;
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03);
    }

    /* ===== EXECUTIVE BANNER HEADER ===== */
    .doc-header-banner {
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }

    .header-supertitle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 700;
      color: var(--eurorep-orange);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .supertitle-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--eurorep-orange);
    }

    h1 {
      font-size: 29px;
      font-weight: 800;
      color: var(--slate-900);
      margin-top: 6px;
      margin-bottom: 14px;
      line-height: 1.26;
      letter-spacing: -0.025em;
    }

    .header-accent-bar {
      width: 76px;
      height: 4px;
      background: linear-gradient(90deg, #E8820C 0%, #f97316 100%);
      border-radius: 4px;
      margin-bottom: 18px;
    }

    .meta-chips-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      background: var(--slate-100);
      color: var(--slate-700);
      border: 1px solid var(--slate-200);
    }

    .chip-primary {
      background: var(--eurorep-orange-light);
      color: #c2410c;
      border-color: var(--eurorep-orange-border);
      font-weight: 600;
    }

    /* ===== CONTENT TYPOGRAPHY ===== */
    h2 {
      font-size: 20px;
      font-weight: 700;
      color: var(--slate-900);
      margin-top: 38px;
      margin-bottom: 16px;
      padding-left: 12px;
      border-left: 4px solid var(--eurorep-orange);
      line-height: 1.35;
      letter-spacing: -0.015em;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--slate-100);
    }

    h3 {
      font-size: 16.5px;
      font-weight: 700;
      color: var(--slate-800);
      margin-top: 26px;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    h4 {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--slate-700);
      margin-top: 20px;
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 16px;
      color: var(--slate-700);
      font-size: 15px;
    }

    strong {
      color: var(--slate-900);
      font-weight: 600;
    }

    .doc-divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }

    ul, ol {
      margin-top: 8px;
      margin-bottom: 18px;
      padding-left: 24px;
      color: var(--slate-700);
    }

    li {
      margin-bottom: 8px;
      padding-left: 2px;
    }

    li strong {
      color: var(--slate-900);
    }

    /* ===== TERMINAL / WORKFLOW CARDS ===== */
    .code-terminal-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      margin: 22px 0 28px 0;
      overflow: hidden;
      box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.15);
    }

    .code-terminal-header {
      background: #1e293b;
      padding: 9px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .terminal-dots {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }

    .terminal-title {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .terminal-badge {
      font-size: 10px;
      font-weight: 700;
      color: #fb923c;
      background: rgba(234, 88, 12, 0.18);
      border: 1px solid rgba(251, 146, 60, 0.3);
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    pre {
      background: transparent;
      padding: 20px 22px;
      overflow-x: auto;
      margin: 0;
    }

    pre code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 13.5px;
      line-height: 1.65;
      color: #e2e8f0;
      background: transparent;
      padding: 0;
      border: none;
    }

    /* Diagram Elements */
    .diag-arrow {
      color: #fb923c !important; /* Eurorep vibrant orange */
      font-weight: 700;
    }

    .diag-pipe {
      color: #f97316 !important;
      font-weight: 600;
    }

    .diag-node {
      color: #ffffff !important;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.09);
      padding: 2px 6px;
      border-radius: 5px;
      border: 1px solid rgba(255, 255, 255, 0.16);
    }

    /* Inline Code */
    code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 13px;
      background: var(--eurorep-orange-light);
      color: #c2410c;
      padding: 2px 7px;
      border-radius: 5px;
      border: 1px solid var(--eurorep-orange-border);
      font-weight: 500;
    }

    /* ===== ALERT CARDS ===== */
    .alert-card {
      margin: 20px 0 24px 0;
      padding: 16px 20px;
      border-radius: 10px;
      border-left: 4px solid;
      font-size: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }

    .alert-note {
      background: #f0f9ff;
      border-color: #0284c7;
      color: #0369a1;
    }

    .alert-tip {
      background: #f0fdf4;
      border-color: #10b981;
      color: #065f46;
    }

    .alert-important {
      background: var(--eurorep-orange-light);
      border-color: var(--eurorep-orange);
      color: #9a3412;
    }

    .alert-warning {
      background: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
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
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .alert-body {
      line-height: 1.6;
    }

    /* ===== TABLAS ===== */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin: 22px 0 28px 0;
      border-radius: 10px;
      border: 1px solid var(--border);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      text-align: left;
    }

    th {
      background: var(--slate-900);
      color: #ffffff;
      font-weight: 700;
      padding: 12px 16px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid var(--eurorep-orange);
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      color: var(--slate-700);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: var(--slate-50);
    }

    tr:hover td {
      background: var(--slate-100);
    }

    /* ===== IMÁGENES ===== */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin: 16px 0;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    }

    /* ===== ENLACES ===== */
    a {
      color: var(--eurorep-orange);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.15s ease;
    }

    a:hover {
      color: var(--eurorep-orange-hover);
      text-decoration: underline;
    }

    /* ===== CORPORATE FOOTER ===== */
    .doc-footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .footer-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .footer-logo {
      height: 32px;
      width: auto;
      opacity: 0.9;
      border: none !important;
      box-shadow: none !important;
      margin: 0 !important;
      border-radius: 0 !important;
    }

    .footer-text {
      font-size: 12px;
      color: var(--slate-500);
      line-height: 1.45;
    }

    .footer-right {
      font-size: 11.5px;
      color: var(--slate-400);
      text-align: right;
    }

    /* ===== RESPONSIVE & PRINT ===== */
    @media (max-width: 680px) {
      .topbar-title-tag, .topbar-divider { display: none; }
      .doc-sheet { padding: 24px 20px; }
      .footer-right { text-align: left; }
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .viewer-topbar {
        display: none !important;
      }
      .doc-wrapper {
        max-width: 100% !important;
      }
      .doc-sheet {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
      .code-terminal-card, .table-container, .alert-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- TOPBAR FIJA CON BRANDING EUROREP -->
  <div class="viewer-topbar">
    <div class="topbar-left">
      <a href="../index.html" class="topbar-logo-link" title="Eurorep SAPI Postventa">
        <img src="${logoDataUri}" alt="Eurorep Logo" class="topbar-logo" />
      </a>
      <div class="topbar-divider"></div>
      <div class="doc-badge">
        <span class="doc-badge-dot"></span>
        <span>EUROREP SAPI</span>
      </div>
      <span class="topbar-title-tag">Guía Oficial de Postventa</span>
    </div>
    <div class="topbar-actions">
      <button class="btn-action btn-print" onclick="window.print()" title="Imprimir o Guardar como PDF">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Imprimir
      </button>
      <a href="${pdfFile}" download class="btn-action btn-pdf" title="Descargar archivo PDF">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Descargar PDF
      </a>
    </div>
  </div>

  <!-- DOCUMENTO EN HOJA ELEVADA ESTILO CORPORATIVO -->
  <div class="doc-wrapper">
    <div class="doc-sheet">
      <div id="content">
        ${renderedBody}
      </div>

      <!-- FOOTER CORPORATIVO OFICIAL -->
      <footer class="doc-footer">
        <div class="footer-left">
          <img src="${logoDataUri}" alt="Eurorep Logo" class="footer-logo" />
          <div class="footer-text">
            <strong style="color:var(--slate-900);">EUROREP S.A.P.I. DE C.V.</strong><br>
            División de Postventa, Servicio Técnico y Mantenimiento de Maquinaria<br>
            <span style="font-size:11px; color:var(--slate-500);">Plataforma SAPI Postventa • Conectado con SAP Business One & Supabase</span>
          </div>
        </div>
        <div class="footer-right">
          <div>Documentación Operativa Oficial</div>
          <div style="margin-top:2px;">© 2026 Eurorep S.A.P.I. de C.V. • Todos los derechos reservados</div>
        </div>
      </footer>
    </div>
  </div>

</body>
</html>`;
}

function generateAllHtmlFiles() {
  console.log('🚀 Compilando todos los manuales Markdown a HTML estático con estilo oficial Eurorep...');
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
    console.log(`✅ Creado manual HTML con estilo Eurorep: ${item.htmlFile}`);
  }
  console.log('🎉 ¡Todos los manuales HTML con diseño oficial Eurorep fueron compilados con éxito!');
}

generateAllHtmlFiles();
