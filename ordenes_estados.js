/**
 * MÓDULO DE AUTOMATIZACIÓN DE ESTADOS, REPORTE PDF Y ENVÍO DE ÓRDENES
 * Eurorep / SAPI - Vanilla Browser Bundle
 */
(function(global) {
  "use strict";

const getOrdenes = () => {
  let ordList = (typeof ordenes !== "undefined" && Array.isArray(ordenes)) ? [...ordenes] : [];
  if (typeof window !== "undefined" && Array.isArray(window.ordenes)) ordList = ordList.concat(window.ordenes);
  try {
    if (typeof localStorage !== "undefined") {
      const local = (typeof safeGetJSON === "function") ? safeGetJSON("sapi_ordenes", []) : JSON.parse(localStorage.getItem("sapi_ordenes") || "[]");
      if (Array.isArray(local)) ordList = ordList.concat(local);
    }
  } catch (e) {}
  return ordList;
};

const getClientesDb = () => {
  if (typeof clientesDb !== "undefined" && Array.isArray(clientesDb)) return clientesDb;
  if (typeof window !== "undefined" && Array.isArray(window.clientesDb)) return window.clientesDb;
  try {
    if (typeof localStorage !== "undefined") {
      return (typeof safeGetJSON === "function") ? safeGetJSON("sapi_clientes_db", []) : JSON.parse(localStorage.getItem("sapi_clientes_db") || "[]");
    }
  } catch(e) {}
  return [];
};

const safeFormatFechaAmigable = (f) => {
  if (typeof formatFechaAmigable === "function") return formatFechaAmigable(f);
  if (typeof window !== "undefined" && typeof window.formatFechaAmigable === "function") return window.formatFechaAmigable(f);
  if (!f) return "—";
  try {
    const d = new Date(f);
    return isNaN(d) ? f : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch(e) { return f; }
};

const safeMostrarNotificacion = (msg, tipo) => {
  if (typeof mostrarNotificacion === "function") return mostrarNotificacion(msg, tipo);
  if (typeof window !== "undefined" && typeof window.mostrarNotificacion === "function") return window.mostrarNotificacion(msg, tipo);
  console.log("[" + (tipo || "info") + "] " + msg);
};

// ==========================
// AUTOMATIZACIÓN DE ESTADOS
// ==========================
function calcularEstadoOrden(o) {
  const isSignedByClient = (!(!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__') && o.firma_cliente_base64 !== '__DELETED__');
  const refNecesarias = o.ref_necesarias || [];
  const hasPendingParts = refNecesarias.length > 0;
  
  if (isSignedByClient) {
    if (hasPendingParts) {
      return 'Refacciones pendientes';
    } else {
      return 'Completado';
    }
  } else {
    const hasBitacora = o.bitacora && o.bitacora.length > 0;
    const hasFalla = (o.falla || '').trim();
    const hasTrabajos = (o.trabajos || '').trim();
    const hasDictamen = (o.dictamen || '').trim();
    const hasCondiciones = (o.condiciones || '').trim();
    const hasObservaciones = (o.observaciones || '').trim();
    const hasPendientes = (o.pendientes || '').trim();
    const hasRefUtilizadas = o.ref_utilizadas && o.ref_utilizadas.length > 0;
    
    const hasData = hasFalla || hasTrabajos || hasDictamen || hasCondiciones || hasObservaciones || hasPendientes || hasRefUtilizadas || hasPendingParts;
    
    if (hasBitacora || hasData || (o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__')) {
      return 'En proceso';
    } else {
      return 'Pendiente';
    }
  }
}

function cerrarDetalle(e) {
  if (typeof document === "undefined") return;
  if (e && e.target !== document.getElementById('modal-detalle-overlay')) return;
  document.getElementById('modal-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function generarBase64Pdf(ordenId) {
  if (typeof document === "undefined") return null;
  let ordList = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? [...ordenes] : [];
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) ordList = ordList.concat(window.ordenes);
  try {
    const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if (Array.isArray(local)) ordList = ordList.concat(local);
  } catch (e) {}

  const o = ordList.find(x => x && (String(x.id) === String(ordenId) || String(x.folio) === String(ordenId) || String(x.folio || '').replace(/\D/g, '') === String(ordenId).replace(/\D/g, '')));
  if (!o) {
    console.warn('[generarBase64Pdf] Orden no encontrada para ID:', ordenId);
    return null;
  }

  const formatFecha = (fStr) => {
    if (!fStr) return '—';
    if (typeof window.formatFechaAmigable === 'function') return window.safeFormatFechaAmigable(fStr);
    if (fStr.includes('T')) {
      const parts = fStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fStr;
  };

  const badgeEstado = (estado) => {
    if (estado === 'En Proceso') return 'badge-proceso';
    if (estado === 'Completado') return 'badge-completado';
    return 'badge-pendiente';
  };

  const seccion = (title, content) => `
    <div class="detalle-section" style="margin-bottom:1.5rem; page-break-inside:avoid; break-inside:avoid;">
      <div class="detalle-section-title" style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#0f172a; margin-bottom:0.75rem; padding:0.35rem 0.6rem; background:#f1f5f9; border-left:4px solid #e8820c;">${title}</div>
      ${content}
    </div>`;

  const field = (label, val, span = 1) => `
    <div class="detalle-field col-span-${span}" style="border-bottom:1px solid #e2e8f0; padding-bottom:0.35rem; page-break-inside:avoid; break-inside:avoid; grid-column: span ${span};">
      <div class="detalle-label" style="font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:0.2rem;">${label}</div>
      <div class="detalle-value" style="font-size:0.85rem; font-weight:600; word-break:break-word; color:#0f172a; line-height:1.3;">${val || '—'}</div>
    </div>`;

  const refTable = (items, hasPrice) => {
    if (!items || !items.length) return '<p style="color:#64748b; font-size:0.82rem; margin:0;">Sin refacciones</p>';
    return `<table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.5rem;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Descripción</th>
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Clave</th>
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Cant.</th>
        ${hasPrice ? '<th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Precio</th>' : ''}
      </tr></thead>
      <tbody>${items.map(r => `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.descripcion||'—'}</td>
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.clave||'—'}</td>
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.cantidad||'—'}</td>
        ${hasPrice ? `<td style="padding:0.5rem 0.75rem; color:#334155;">$${r.precio||'0'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  };

  // Bitácora Diaria
  let bitacoraHtml = '';
  const bitacoraItems = [...(o.bitacora || [])];
  if (bitacoraItems.length === 0) {
    bitacoraHtml = '<p style="color:#64748b; font-size:0.8rem; font-style:italic; margin:0;">Sin registros en la bitácora.</p>';
  } else {
    const sortedBitacora = bitacoraItems.sort((a, b) => {
      const dateA = a.fecha || '';
      const dateB = b.fecha || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.entrada || '';
      const timeB = b.entrada || '';
      return timeA.localeCompare(timeB);
    });

    bitacoraHtml += `
      <table style="width:100%; border-collapse:collapse; font-size:0.75rem; margin-top:0.5rem; color:#334155;">
        <thead>
          <tr style="background:#f8fafc; text-align:left; color:#475569;">
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:15%; text-transform:uppercase; font-size:0.68rem;">Fecha</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:20%; text-transform:uppercase; font-size:0.68rem;">Técnico</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:20%; text-transform:uppercase; font-size:0.68rem;">Horario</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:15%; text-transform:uppercase; font-size:0.68rem;">Estado</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:30%; text-transform:uppercase; font-size:0.68rem;">Actividad / Avances Reportados</th>
          </tr>
        </thead>
        <tbody>
    `;

    sortedBitacora.forEach(b => {
      let fFormateada = b.fecha;
      try {
        const dObj = new Date(b.fecha);
        if (!isNaN(dObj)) {
          fFormateada = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
        }
      } catch(e){}

      let hrsStr = '—';
      if (b.entrada && b.salida) {
        hrsStr = `${b.entrada} - ${b.salida}`;
      } else if (b.entrada || b.salida) {
        hrsStr = `${b.entrada || '--:--'} - ${b.salida || '--:--'}`;
      }

      let estadoStr = b.realizado ? 'REPORTADO' : 'PROGRAMADO';
      if (b.realizado && b.desviacion) {
        estadoStr += ` (${b.desviacion})`;
      }

      bitacoraHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:0.5rem 0.75rem; white-space:nowrap;">${fFormateada}</td>
          <td style="padding:0.5rem 0.75rem; font-weight:500;">${b.tecnico || '—'}</td>
          <td style="padding:0.5rem 0.75rem; white-space:nowrap;">${hrsStr}</td>
          <td style="padding:0.5rem 0.75rem; font-size:0.7rem; font-weight:600;">${estadoStr}</td>
          <td style="padding:0.5rem 0.75rem; white-space:pre-wrap; line-height:1.3; color:#334155;">${b.nota || '—'}</td>
        </tr>
      `;
    });

    bitacoraHtml += `</tbody></table>`;
  }

  // Evidencias Fotográficas
  let ev = o.evidencias || {};
  if (typeof ev === 'string') {
    try { ev = JSON.parse(ev); } catch(e) { ev = {}; }
  }
  const rawAdicionales = Array.isArray(ev.adicionales) ? ev.adicionales : (ev.adicionales ? Object.values(ev.adicionales) : []);
  const logoSrc = 'logo_transparent.png';

  const toUri = window.urlToDataUri || (async (u) => u);
  const [
    logoDataUri,
    fotoInicioDataUri,
    fotoFinDataUri,
    firmaTecnicoDataUri,
    firmaClienteDataUri,
    legacyEvidenciaDataUri,
    ...adicionalesDataUris
  ] = await Promise.all([
    toUri(logoSrc),
    toUri(ev.fotoInicio),
    toUri(ev.fotoFin),
    toUri(o.firma_tecnico_base64 || o.firma_tecnico_url || o.firma_tecnico),
    toUri(o.firma_cliente_base64 || o.firma_cliente_url || o.firma_cliente),
    toUri(o.evidenciaBase64 || o.evidencias_url),
    ...rawAdicionales.map(u => toUri(u))
  ]);

  const fotoInicioFinal = fotoInicioDataUri || ev.fotoInicio;
  const fotoFinFinal = fotoFinDataUri || ev.fotoFin;
  const logoFinal = logoDataUri || logoSrc;
  const firmaTecnicoFinal = firmaTecnicoDataUri || o.firma_tecnico_base64 || o.firma_tecnico_url || o.firma_tecnico;
  const firmaClienteFinal = firmaClienteDataUri || o.firma_cliente_base64 || o.firma_cliente_url || o.firma_cliente;
  const adicionalesFinales = rawAdicionales.map((url, idx) => adicionalesDataUris[idx] || url);

  let printEvidenciasHtml = '';
  const tieneInicio = !!fotoInicioFinal;
  const tieneFin = !!fotoFinFinal;

  if (tieneInicio || tieneFin || adicionalesFinales.length > 0 || legacyEvidenciaDataUri) {
    printEvidenciasHtml += `<div style="display:block; margin-top:0.5rem;"><div style="display:block; text-align:left;">`;
    if (tieneInicio) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-right:1.5rem; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Inicio (Entrada)</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${fotoInicioFinal}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    if (tieneFin) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Fin (Salida)</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${fotoFinFinal}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    if (!tieneInicio && !tieneFin && legacyEvidenciaDataUri) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Evidencia Principal</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${legacyEvidenciaDataUri}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    printEvidenciasHtml += `</div>`;

    if (adicionalesFinales.length > 0) {
      printEvidenciasHtml += `
        <div style="margin-top:1rem;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.75rem; text-transform:uppercase;">Evidencias Adicionales</div>
          <div style="display:block; text-align:left;">
      `;
      adicionalesFinales.forEach((url, idx) => {
        printEvidenciasHtml += `
          <div style="display:inline-block; vertical-align:top; border:1px solid #d1d5db; border-radius:6px; padding:0.5rem; background:#f9fafb; text-align:center; width:210px; margin-right:1rem; margin-bottom:1rem; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
            <div style="font-size:0.65rem; font-weight:600; color:#4b5563; margin-bottom:0.35rem;">Adicional ${idx + 1}</div>
            <div style="height:140px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:136px; padding:2px; box-sizing:border-box;">
              <img crossorigin="anonymous" src="${url}" style="max-width:196px; max-height:134px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
            </div>
          </div>
        `;
      });
      printEvidenciasHtml += `</div></div>`;
    }
    printEvidenciasHtml += `</div>`;
  } else {
    printEvidenciasHtml = '<p style="color:#64748b; font-size:0.8rem; font-style:italic; margin:0;">Sin fotos de evidencia cargadas.</p>';
  }

  // Crear contenedor temporal para el renderizado del PDF
  const reportContainer = document.createElement('div');
  reportContainer.className = 'admin-pdf-render-container';
  reportContainer.style.cssText = 'width:760px; background:#ffffff; color:#0f172a; padding:25px; font-family:Inter, Arial, sans-serif; box-sizing:border-box; line-height:1.4;';

  reportContainer.innerHTML = `
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid #e8820c;">
      <div style="text-align:left;">
        <img crossorigin="anonymous" src="${logoFinal}" alt="Eurorep Logo" style="height:55px; object-fit:contain; margin-bottom:0.4rem;" />
        <div style="font-size:0.75rem; color:#64748b; line-height:1.35;">
          <strong>EURO REPRESENTACIONES S.A. DE C.V.</strong><br>
          Servicio Técnico Especializado en Maquinaria<br>
          Ptalctes@eurorep.mx | www.eurorep.mx
        </div>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0; font-size:1.35rem; color:#0f172a; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Orden de Servicio</h2>
        <div style="font-size:1.15rem; color:#e8820c; font-weight:700; margin-top:0.2rem;">${o.folio || ''}</div>
        <div style="font-size:0.8rem; color:#64748b; margin-top:0.4rem;">
          <strong>Fecha Emisión:</strong> ${formatFecha(o.fecha)}
        </div>
      </div>
    </div>

    <!-- Información General -->
    ${seccion('Información General', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('Folio', o.folio, 1)} ${field('Pedido', o.pedido, 1)} ${field('Fecha', formatFecha(o.fecha), 1)}
        ${field('Cliente', o.cliente, 2)} ${field('Ubicación (Ticket)', o.ubicacion, 1)}
        ${field('Ubicación en Sitio', o.ubicacion_sitio, 3)}
        ${field('Operador', o.operador, 1)} ${field('No. ECO', o.eco, 1)} ${field('Horómetro (Ticket)', o.horometro, 1)}
        ${field('Horómetro Real', o.horometro_real, 1)}
        ${field('Marca', (() => { 
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let m = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
          return MARCAS_RENDER[m.toUpperCase()] || m || '—';
        })(), 1)} ${field('Modelo', o.modelo, 1)} ${field('Serie', o.serie, 1)}
        ${field('ID Máquina', (o.maquinaria_id || o.serie || '—'), 1)}
        ${field('Técnico', o.tecnico, 1)}
        ${field('Ticket Soporte', o.soporte || o.folio_ticket || '—', 1)}
      </div>`)}

    <!-- Kilómetros / Tipo -->
    ${seccion('Kilómetros / Tipo', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('Origen → Trabajo', (o.km_ida != null && o.km_ida !== '') ? o.km_ida + ' km' : null, 1)}
        ${field('Trabajo → Origen', (o.km_vuelta != null && o.km_vuelta !== '') ? o.km_vuelta + ' km' : null, 1)}
        ${field('Total Km', (o.km_total != null && o.km_total !== '') ? o.km_total + ' km' : null, 1)}
        ${field('Tipo de Visita', o.tipo || 'Servicio', 2)}
        ${field('Estado', o.estado || 'Completado', 1)}
      </div>`)}

    <!-- Diagnóstico y Trabajos -->
    ${seccion('Diagnóstico y Trabajos', `
      ${field('Falla reportada', o.falla, 3)}
      <div style="margin-top:0.5rem">${field('Trabajos realizados', o.trabajos, 3)}</div>
      <div style="margin-top:0.5rem">${field('Dictamen', o.dictamen, 3)}</div>
      <div style="margin-top:0.5rem">${field('Condiciones del equipo', o.condiciones, 3)}</div>
      <div style="margin-top:0.5rem">${field('Observaciones', o.observaciones, 3)}</div>
      <div style="margin-top:0.5rem">${field('Pendientes', o.pendientes, 3)}</div>`)}

    <!-- Refacciones -->
    ${seccion('Refacciones Utilizadas', refTable(o.ref_utilizadas, false))}
    ${seccion('Refacciones Necesarias', refTable(o.ref_necesarias, false))}

    ${(o.noches || o.alimentacion || o.traslado_costo) ? seccion('Servicio', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('No. Noches', o.noches, 1)} ${field('Alimentación', o.alimentacion ? o.alimentacion : '', 1)} ${field('Traslado', o.traslado_costo ? o.traslado_costo : '', 1)}
      </div>`) : ''}

    <!-- Bitácora -->
    ${seccion('Bitácora Diaria', bitacoraHtml)}

    <!-- Evidencias -->
    ${seccion('Evidencias Fotográficas', printEvidenciasHtml)}

    <!-- Firmas -->
    ${seccion('Firmas de Conformidad', `
      <div style="display:flex; flex-wrap:wrap; gap:2rem; margin-top:1rem; justify-content:center;">
        <!-- TECNICO -->
        <div style="flex:1; min-width:280px; max-width:340px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a; font-size:0.9rem; font-weight:700; text-align:center;">Firma del Técnico</h4>
          ${firmaTecnicoFinal 
            ? `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; background:white; width:100%; text-align:center; box-sizing:border-box;">
                 <img crossorigin="anonymous" src="${firmaTecnicoFinal}" alt="Firma del técnico" style="max-width:100%; max-height:110px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:#0f172a; font-weight:600; font-size:0.82rem; margin-top:0.4rem; margin-bottom:0;">${o.firma_tecnico_nombre || o.tecnico || 'Técnico Asignado'}</p>
                 ${o.firma_tecnico_fecha ? `<p style="text-align:center; color:#64748b; font-size:0.72rem; margin-top:0.2rem; margin-bottom:0;">${new Date(o.firma_tecnico_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>`
            : `<p style="color:#64748b; font-size:0.82rem; font-style:italic; text-align:center;">Sin firma del técnico</p>`
          }
        </div>

        <!-- CLIENTE -->
        <div style="flex:1; min-width:280px; max-width:340px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a; font-size:0.9rem; font-weight:700; text-align:center;">Firma del Cliente</h4>
          ${firmaClienteFinal 
            ? `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; background:white; width:100%; text-align:center; box-sizing:border-box;">
                 <img crossorigin="anonymous" src="${firmaClienteFinal}" alt="Firma del cliente" style="max-width:100%; max-height:110px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:#0f172a; font-weight:600; font-size:0.82rem; margin-top:0.4rem; margin-bottom:0;">${o.firma_cliente_nombre || o.cliente || 'Cliente'}</p>
                 ${o.firma_cliente_fecha ? `<p style="text-align:center; color:#64748b; font-size:0.72rem; margin-top:0.2rem; margin-bottom:0;">${new Date(o.firma_cliente_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>`
            : `<p style="color:#64748b; font-size:0.82rem; font-style:italic; text-align:center;">Sin firma del cliente</p>`
          }
        </div>
      </div>
    `)}
  `;

  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  tempContainer.style.background = '#ffffff';
  tempContainer.appendChild(reportContainer);
  document.body.appendChild(tempContainer);

  // Esperar a que todas las imágenes estén decodificadas y listas
  const imgElements = Array.from(reportContainer.querySelectorAll('img'));
  await Promise.all(imgElements.map(img => {
    if (img.complete && img.naturalWidth > 0) {
      return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise(resolve => {
      img.onload = () => (typeof img.decode === 'function' ? img.decode().then(resolve).catch(resolve) : resolve());
      img.onerror = resolve;
      setTimeout(resolve, 3000);
    });
  }));

  const folio = o.folio || ordenId;
  const opt = {
    margin:       10,
    filename:     `Reporte_Servicio_${folio}.pdf`,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, allowTaint: true, letterRendering: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      const worker = html2pdf().from(reportContainer).set(opt);
      let pdfBase64 = null;
      try {
        pdfBase64 = await worker.output('datauristring');
      } catch (e1) {
        try {
          pdfBase64 = await worker.outputPdf('datauristring');
        } catch (e2) {
          pdfBase64 = await worker.output('bloburl');
        }
      }
      if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.includes(',')) {
        return pdfBase64.split(',')[1];
      }
      return pdfBase64;
    } else {
      console.error('html2pdf library is not loaded');
      return null;
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    return null;
  } finally {
    if (tempContainer.parentNode) {
      document.body.removeChild(tempContainer);
    }
  }
}

function toggleCampoCorreo(campo) {
  if (typeof document === "undefined") return;
  const row = document.getElementById(`row-correo-${campo}`);
  if (row) {
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  }
};

function ejecutarComandoEditor(comando) {
  if (typeof document === "undefined") return;
  document.execCommand(comando, false, null);
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) editor.focus();
};

function abrirPaletaColor(e, tipo) {
  if (typeof document === "undefined") return;
  if (tipo === 'foreColor') {
    document.getElementById('editor-font-color').click();
  } else {
    document.getElementById('editor-bg-color').click();
  }
};

function ejecutarColorEditor(tipo, color) {
  if (typeof document === "undefined") return;
  document.execCommand(tipo, false, color);
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) editor.focus();
};

function imprimirOrden() {
  if (typeof window !== "undefined" && typeof window.print === "function") window.print();
}

function enviarCorreoOrden(ordenId) {
  if (typeof document === "undefined") return;
  const clientesDb = getClientesDb();
  const ordenes = getOrdenes();
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  // Buscar correo del cliente en clientesDb
  const cli = clientesDb.find(c => c.nombre === o.cliente);
  const destEmail = cli ? (cli.email || cli.E_Mail || '') : '';
  
  document.getElementById('correo-orden-id').value = ordenId;
  document.getElementById('correo-destinatario').value = destEmail || 'cliente@ejemplo.com';
  document.getElementById('correo-asunto').value = `Reporte de Servicio ${o.folio || ''} - ${o.cliente || ''}`;
  
  // Limpiar campos CC y CCO
  const ccEl = document.getElementById('correo-cc');
  const ccoEl = document.getElementById('correo-cco');
  if (ccEl) ccEl.value = '';
  if (ccoEl) ccoEl.value = '';
  
  // Ocultar filas de CC y CCO por defecto
  const rowCc = document.getElementById('row-correo-cc');
  const rowCco = document.getElementById('row-correo-cco');
  if (rowCc) rowCc.style.display = 'none';
  if (rowCco) rowCco.style.display = 'none';

  // Mensaje por defecto en HTML
  const defaultMsgHtml = `Hola,<br><br>Adjuntamos el reporte de servicio correspondiente a la orden de servicio folio <strong>${o.folio || ''}</strong>.<br><br>Saludos cordiales,<br>Euro Representaciones`;
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) {
    editor.innerHTML = defaultMsgHtml;
  }
  
  const labelAdjunto = document.getElementById('adjunto-pdf-nombre');
  if (labelAdjunto) {
    labelAdjunto.textContent = `Reporte_Servicio_${o.folio || ordenId}.pdf`;
  }
  
  const overlay = document.getElementById('modal-correo-overlay');
  if (overlay) {
    overlay.classList.add('open');
  }
  
  // Resetear el visor
  const frame = document.getElementById('correo-pdf-frame');
  const spinner = document.getElementById('correo-pdf-loading');
  if (frame && spinner) {
    frame.style.display = 'none';
    frame.src = '';
    spinner.style.display = 'flex';
    spinner.innerHTML = `
      <div style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span style="font-size: 0.75rem; font-weight: 600;">Generando vista previa del PDF...</span>
    `;
  }
  
  window._ultimoPdfGenerado = null;
  
  // Iniciar la generación en segundo plano
  setTimeout(() => {
    generarBase64Pdf(ordenId).then(base64Pdf => {
      if (base64Pdf) {
        window._ultimoPdfGenerado = base64Pdf;
        
        // Cargar en el frame
        try {
          const raw = window.atob(base64Pdf);
          const rawLength = raw.length;
          const uInt8Array = new Uint8Array(rawLength);
          for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          const blob = new Blob([uInt8Array], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          
          if (frame && spinner) {
            frame.src = blobUrl;
            frame.style.display = 'block';
            spinner.style.display = 'none';
          }
        } catch (blobErr) {
          console.error('Error loading blob to frame:', blobErr);
          if (spinner) {
            spinner.innerHTML = '<span style="color:#ef4444; font-size:0.75rem;">Error al renderizar PDF</span>';
          }
        }
      } else {
        if (spinner) {
          spinner.innerHTML = '<span style="color:#ef4444; font-size:0.75rem;">Error al generar reporte</span>';
        }
      }
    });
  }, 300);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function cerrarModalCorreo() {
  if (typeof document === "undefined") return;
  const overlay = document.getElementById('modal-correo-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
  const frame = document.getElementById('correo-pdf-frame');
  if (frame) {
    frame.src = '';
  }
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) {
    editor.innerHTML = '';
  }
  window._ultimoPdfGenerado = null;
}

async function procesarEnviarCorreo(e) {
  if (typeof document === "undefined") return;
  const ordenes = getOrdenes();
  if (e) e.preventDefault();
  
  const ordenId = document.getElementById('correo-orden-id').value;
  const destinatario = document.getElementById('correo-destinatario').value.trim();
  const cc = document.getElementById('correo-cc').value.trim();
  const bcc = document.getElementById('correo-cco').value.trim();
  const asunto = document.getElementById('correo-asunto').value.trim();
  
  const editor = document.getElementById('correo-mensaje-editor');
  const mensajeHtml = editor ? editor.innerHTML : '';
  
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  if (!destinatario) {
    safeMostrarNotificacion("Por favor ingresa un destinatario válido", "error");
    return;
  }
  
  const btnSubmit = document.getElementById('btn-enviar-correo-submit');
  
  let base64Pdf = window._ultimoPdfGenerado;
  if (!base64Pdf) {
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = 'Generando PDF...';
    }
    safeMostrarNotificacion("Generando reporte PDF adjunto...", "info");
    try {
      base64Pdf = await generarBase64Pdf(ordenId);
    } catch (pdfErr) {
      console.error("Failed to generate PDF:", pdfErr);
    }
  }
  
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Enviando...';
  }
  safeMostrarNotificacion("Enviando correo con PDF adjunto...", "info");
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <div style="margin-bottom: 20px; line-height: 1.5; font-size: 14px; color: #444;">
        ${mensajeHtml}
      </div>
      <div style="border-top: 2px solid #e8820c; padding-top: 20px; margin-top: 20px;">
        <h2 style="color: #e8820c; text-align: center; margin-top: 0;">Orden de Servicio: ${o.folio || 'N/A'}</h2>
        <p><strong>Cliente:</strong> ${o.cliente || '—'}</p>
        <p><strong>Fecha:</strong> ${safeFormatFechaAmigable(o.fecha)}</p>
        <p><strong>Equipo/Modelo:</strong> ${o.modelo || '—'} (Serie: ${o.serie || '—'})</p>
        <p><strong>Técnico Asignado:</strong> ${o.tecnico || '—'}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
        <p style="text-align: center; color: #777; font-size: 12px;">Se ha adjuntado el documento PDF oficial del reporte a este correo para su descarga y archivo.</p>
      </div>
    </div>
  `;

  try {
    let token = '';
    if (window.supabaseClient && window.supabaseClient.auth) {
      try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        token = sessionData?.session?.access_token || '';
      } catch (authErr) {
        console.warn('Could not read Supabase session token:', authErr);
      }
    }

    const payload = {
      to: destinatario,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: asunto,
      htmlBody: htmlBody
    };

    if (base64Pdf) {
      payload.attachments = [
        {
          filename: `Reporte_Servicio_${o.folio || ordenId}.pdf`,
          content: base64Pdf,
          encoding: 'base64'
        }
      ];
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Sapi-Client-Token': 'SapiSecuredClientToken'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (response.ok) {
      safeMostrarNotificacion("¡Correo enviado exitosamente con reporte PDF adjunto!", "success");
      cerrarModalCorreo();

      if (typeof window.registrarLogEmail === 'function') {
        window.registrarLogEmail({
          id: 'email_rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          tipo: 'enviado',
          de: 'Ptalctes@eurorep.mx',
          para: payload.to,
          cc: payload.cc || '',
          bcc: payload.bcc || '',
          cliente: o.cliente || 'Cliente',
          asunto: payload.subject,
          cuerpo: `Reporte de Servicio finalizado para la Orden ${o.folio || ordenId}.`,
          htmlBody: htmlBody,
          fecha: new Date().toISOString(),
          evento: 'Reporte de Servicio',
          regla: 'Envío de Reporte PDF',
          estatus: 'Enviado',
          folio_os: o.folio || ordenId,
          folio_ticket: o.folio_ticket || (o.ticket ? o.ticket.folio : ''),
          archivos: base64Pdf ? [`Reporte_Servicio_${o.folio || ordenId}.pdf`] : []
        });
      }
    } else {
      console.error(result);
      safeMostrarNotificacion("Error al enviar el correo: " + (result.error || result.message || 'Error desconocido'), "error");
    }
  } catch (err) {
    console.error(err);
    safeMostrarNotificacion("Error de conexión al enviar el correo.", "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="send" class="btn-icon"></i> Enviar Correo';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Exponer en window para retrocompatibilidad total con eventos HTML inline
if (typeof window !== "undefined") {
  window.calcularEstadoOrden = calcularEstadoOrden;
  window.cerrarDetalle = cerrarDetalle;
  window.generarBase64Pdf = generarBase64Pdf;
  window.toggleCampoCorreo = toggleCampoCorreo;
  window.ejecutarComandoEditor = ejecutarComandoEditor;
  window.abrirPaletaColor = abrirPaletaColor;
  window.ejecutarColorEditor = ejecutarColorEditor;
  window.imprimirOrden = imprimirOrden;
  window.enviarCorreoOrden = enviarCorreoOrden;
  window.cerrarModalCorreo = cerrarModalCorreo;
  window.procesarEnviarCorreo = procesarEnviarCorreo;
}


  // Exponer en global y window para retrocompatibilidad total
  if (typeof global !== "undefined") {
    global.calcularEstadoOrden = calcularEstadoOrden;
    global.cerrarDetalle = cerrarDetalle;
    global.generarBase64Pdf = generarBase64Pdf;
    global.toggleCampoCorreo = toggleCampoCorreo;
    global.ejecutarComandoEditor = ejecutarComandoEditor;
    global.abrirPaletaColor = abrirPaletaColor;
    global.ejecutarColorEditor = ejecutarColorEditor;
    global.imprimirOrden = imprimirOrden;
    global.enviarCorreoOrden = enviarCorreoOrden;
    global.cerrarModalCorreo = cerrarModalCorreo;
    global.procesarEnviarCorreo = procesarEnviarCorreo;
  }
  if (typeof window !== "undefined" && window !== global) {
    window.calcularEstadoOrden = calcularEstadoOrden;
    window.cerrarDetalle = cerrarDetalle;
    window.generarBase64Pdf = generarBase64Pdf;
    window.toggleCampoCorreo = toggleCampoCorreo;
    window.ejecutarComandoEditor = ejecutarComandoEditor;
    window.abrirPaletaColor = abrirPaletaColor;
    window.ejecutarColorEditor = ejecutarColorEditor;
    window.imprimirOrden = imprimirOrden;
    window.enviarCorreoOrden = enviarCorreoOrden;
    window.cerrarModalCorreo = cerrarModalCorreo;
    window.procesarEnviarCorreo = procesarEnviarCorreo;
  }
  const allModuleExports = {
    calcularEstadoOrden,
    cerrarDetalle,
    generarBase64Pdf,
    toggleCampoCorreo,
    ejecutarComandoEditor,
    abrirPaletaColor,
    ejecutarColorEditor,
    imprimirOrden,
    enviarCorreoOrden,
    cerrarModalCorreo,
    procesarEnviarCorreo
  };
  if (typeof global !== "undefined") global.OrdenesEstados = allModuleExports;
  if (typeof window !== "undefined") window.OrdenesEstados = allModuleExports;
})(typeof window !== "undefined" ? window : globalThis);
