/**
 * Módulo de Depuración y Auditoría de Tickets - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { cleanMojibake, normStr, safeFormatDate, formatFechaHoraAmigable, urlToDataUri } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";
/**
 * Módulo de Depuración y Auditoría de Tickets - Eurorep / SAPI
 * Funciones de análisis forense, diagnóstico, eliminación/regeneración y sanitización.
 */
// ============================================================
// DEPURADOR Y REGENERADOR DE TICKETS -A (SUPERADMIN)
// ============================================================
let _depurarTicketsCache = [];
let _depurarTicketsSeleccionadas = new Set();
let _depurarTicketsFiltradasActuales = [];

function analizarInformacionTicket(t) {
  if (!t || typeof t !== 'object') {
    return {
      tieneInfo: false,
      detalles: [],
      modificadoPor: null,
      fechaMod: null,
      numComentarios: 0,
      cotizacionSAP: '',
      pedidoSAP: '',
      numEnvios: 0,
      tieneCotizacion: false,
      montoCotizacion: ''
    };
  }

  const detalles = [];

  // 1. Cotización y Pedido SAP
  const cotSAP = String(t.cotizacionSAP || t.cotizacion_sap || '').trim();
  const pedSAP = String(t.pedidoSAP || '').trim();
  const montoCot = (t.montoCotizacion && String(t.montoCotizacion).trim() && String(t.montoCotizacion).trim() !== '0') ? String(t.montoCotizacion).trim() : '';
  const tienePDFCot = Boolean(t.pdfCotizacion);
  const tieneCotAdic = Array.isArray(t.cotizacionesAdicionales) && t.cotizacionesAdicionales.length > 0;
  const tieneCotAceptada = ['si', 'no', 'aprobada', 'rechazada', 'pendiente'].includes(String(t.cotAceptada || '').toLowerCase().trim());
  const estadoCot = ['cotización', 'cotizacion', 'cotizado'].includes(String(t.estado || '').toLowerCase().trim());

  const tieneCotizacion = Boolean(cotSAP || montoCot || tienePDFCot || tieneCotAdic || tieneCotAceptada || estadoCot);

  if (cotSAP) detalles.push(`Cotización SAP: ${cotSAP}`);
  if (pedSAP) detalles.push(`Pedido SAP: ${pedSAP}`);
  if (montoCot) detalles.push(`Monto: $${montoCot}`);
  if (t.cotAceptada === 'si' || t.cotAceptada === 'aprobada') detalles.push('Cotización Aceptada');
  else if (t.cotAceptada === 'no' || t.cotAceptada === 'rechazada') detalles.push('Cotización Rechazada');

  // 2. Comentarios internos
  const numComentarios = Array.isArray(t.comentariosInternos) ? t.comentariosInternos.filter(c => c && (c.texto || c.usuario)).length : 0;
  if (numComentarios > 0) {
    detalles.push(`${numComentarios} comentario${numComentarios > 1 ? 's' : ''} interno${numComentarios > 1 ? 's' : ''}`);
  }

  // 3. Envíos y guías de paquetería
  const numEnvios = Array.isArray(t.envios) ? t.envios.length : 0;
  if (numEnvios > 0) {
    detalles.push(`${numEnvios} guía${numEnvios > 1 ? 's' : ''} de envío`);
  }

  // 4. Archivos adjuntos o fotos
  const numAdjuntos = (Array.isArray(t.adjuntos) ? t.adjuntos.length : 0) + (Array.isArray(t.fotos) ? t.fotos.length : 0);
  if (numAdjuntos > 0) {
    detalles.push(`${numAdjuntos} adjunto${numAdjuntos > 1 ? 's' : ''}`);
  }

  // 5. Refacciones con estatus de pedido avanzado
  if (Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0) {
    const partsConEstatus = t.refaccionesSeleccionadas.filter(p => p && p.estatusPedido && !['Pendiente', 'Por Pedir'].includes(p.estatusPedido));
    if (partsConEstatus.length > 0) {
      detalles.push(`${partsConEstatus.length} parte(s) en proceso (${partsConEstatus.map(p => p.estatusPedido).join(', ')})`);
    }
  }

  // 6. Modificación manual por usuario (solo cuando es una modificación humana real)
  const modUser = t.modificadoPor || t.modificado_por || null;
  const esModificadoHumano = modUser && !['Sistema', 'Automático', 'Autogenerado', '—', '', 'null', 'undefined'].includes(String(modUser).trim());

  if (esModificadoHumano) {
    detalles.push(`Modificado por ${modUser}`);
  }

  return {
    tieneInfo: detalles.length > 0,
    detalles: detalles,
    modificadoPor: esModificadoHumano ? modUser : null,
    fechaMod: t.fechaModificacion || t.updated_at || null,
    numComentarios: numComentarios,
    cotizacionSAP: cotSAP,
    pedidoSAP: pedSAP,
    numEnvios: numEnvios,
    tieneCotizacion: tieneCotizacion,
    montoCotizacion: montoCot
  };
};

function contarTicketsADepuracion() {
  let ords = typeof getFilteredOrders === 'function' ? getFilteredOrders() : ((typeof ordenes !== 'undefined' && ordenes && ordenes.length > 0) ? ordenes : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]'));
  let tkts = typeof getFilteredTickets === 'function' ? getFilteredTickets() : ((typeof tickets !== 'undefined' && tickets && tickets.length > 0) ? tickets : JSON.parse(localStorage.getItem('sapi_tickets') || '[]'));

  if (typeof isTestData === 'function') {
    const activeSandbox = typeof isTestModeActive === 'function' ? isTestModeActive() : false;
    ords = ords.filter(o => isTestData(o) === activeSandbox);
    tkts = tkts.filter(t => isTestData(t) === activeSandbox);
  }

  const ticketsA = [];
  let huerfanosCount = 0;
  let osCount = 0;
  let padreCount = 0;
  let modificadosCount = 0;
  let limpiosCount = 0;
  let conCotizacionCount = 0;
  let sinCotizacionCount = 0;

  tkts.forEach(t => {
    if (!t) return;
    const tFolio = String(t.folio || '').trim();
    const isA = /-[Aa]$/i.test(tFolio) || tFolio.toUpperCase().includes('-A') || Boolean(t.parentTicketId || t.ticketPadreId);
    if (!isA) return;

    const assocOrder = window.obtenerOrdenAsociadaTicket(t);
    const parentTicket = !assocOrder ? (typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null) : null;
    const refCount = (t.refaccionesSeleccionadas && Array.isArray(t.refaccionesSeleccionadas)) ? t.refaccionesSeleccionadas.length : 0;
    const info = window.analizarInformacionTicket(t);

    let tipoVinculo = 'huerfano';
    let vinculoDetalle = 'Sin Orden / Ticket Origen';

    if (assocOrder) {
      tipoVinculo = 'os';
      vinculoDetalle = `OS: ${assocOrder.folio || assocOrder.id}`;
      osCount++;
    } else if (parentTicket) {
      tipoVinculo = 'padre';
      vinculoDetalle = `Ticket Padre: ${parentTicket.folio || parentTicket.id}`;
      padreCount++;
    } else {
      huerfanosCount++;
    }

    if (info.tieneInfo) {
      modificadosCount++;
    } else {
      limpiosCount++;
    }

    if (info.tieneCotizacion) {
      conCotizacionCount++;
    } else {
      sinCotizacionCount++;
    }

    ticketsA.push({
      id: t.id,
      folio: t.folio || 'S/F',
      asunto: t.asunto || '—',
      cliente: t.cliente || 'Sin cliente',
      sitio: t.sitio || '',
      estado: t.estado || 'Refacciones',
      fechaCreacion: t.fechaCreacion || t.fecha || '',
      refCount: refCount,
      tipoVinculo: tipoVinculo,
      vinculoDetalle: vinculoDetalle,
      assocOrderFolio: assocOrder ? (assocOrder.folio || assocOrder.id) : null,
      parentTicketFolio: parentTicket ? (parentTicket.folio || parentTicket.id) : null,
      info: info,
      raw: t
    });
  });

  return {
    total: ticketsA.length,
    huerfanosCount,
    osCount,
    padreCount,
    modificadosCount,
    limpiosCount,
    conCotizacionCount,
    sinCotizacionCount,
    todos: ticketsA
  };
};

function actualizarEstadisticasModalDepurador(diag) {
  if (!diag) diag = window.contarTicketsADepuracion();
  const statTotal = document.getElementById('depurar-tkt-stat-total');
  if (statTotal) statTotal.textContent = diag.total;
  const statMod = document.getElementById('depurar-tkt-stat-modificados');
  if (statMod) statMod.textContent = diag.modificadosCount;
  const statLimp = document.getElementById('depurar-tkt-stat-limpios');
  if (statLimp) statLimp.textContent = diag.limpiosCount;
  const statHuerf = document.getElementById('depurar-tkt-stat-huerfanos');
  if (statHuerf) statHuerf.textContent = diag.huerfanosCount;
  const statOS = document.getElementById('depurar-tkt-stat-os');
  if (statOS) statOS.textContent = diag.osCount;
  const statPadre = document.getElementById('depurar-tkt-stat-padre');
  if (statPadre) statPadre.textContent = diag.padreCount;
  const statCot = document.getElementById('depurar-tkt-stat-cotizados');
  if (statCot) statCot.textContent = diag.conCotizacionCount;
  const statSinCot = document.getElementById('depurar-tkt-stat-sincot');
  if (statSinCot) statSinCot.textContent = diag.sinCotizacionCount;
  const statSel = document.getElementById('depurar-tkt-stat-selected');
  if (statSel) statSel.textContent = window._depurarTicketsSeleccionadas.size;
};

function actualizarBadgeDepuradorTickets() {
  const btnDepurar = document.getElementById('btn-depurar-tickets-ref');
  if (!btnDepurar) return;
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.rol === 'superadmin');
  btnDepurar.style.display = isSuperAdmin ? 'inline-flex' : 'none';
  if (isSuperAdmin) {
    const diag = window.contarTicketsADepuracion();
    const badge = document.getElementById('badge-count-tickets-a');
    if (badge) badge.textContent = diag.total;
  }
};

function abrirModalDepurarTickets() {
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.rol === 'superadmin');
  if (!isSuperAdmin) {
    mostrarNotificacion('Solo el Superadministrador puede acceder a la herramienta de depuración de tickets.', 'error');
    return;
  }

  const diag = window.contarTicketsADepuracion();
  window._depurarTicketsCache = diag.todos;
  window._depurarTicketsSeleccionadas.clear();

  window.actualizarEstadisticasModalDepurador(diag);

  const searchInput = document.getElementById('depurar-tkt-search-input');
  if (searchInput) searchInput.value = '';
  const filterVinc = document.getElementById('depurar-tkt-filter-vinculo');
  if (filterVinc) filterVinc.value = 'all';
  const filterCot = document.getElementById('depurar-tkt-filter-cotizacion');
  if (filterCot) filterCot.value = 'all';

  window.filtrarTablaDepuradorTickets();

  const modal = document.getElementById('modal-depurar-tickets-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

function cerrarModalDepurarTickets(e) {
  if (e && e.target && e.target !== document.getElementById('modal-depurar-tickets-overlay') && !e.target.classList.contains('modal-close') && !e.target.closest('.modal-close') && !e.target.closest('button')) {
    return;
  }
  const modal = document.getElementById('modal-depurar-tickets-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
};

function filtrarTablaDepuradorTickets() {
  const q = (document.getElementById('depurar-tkt-search-input')?.value || '').toLowerCase().trim();
  const fVinc = document.getElementById('depurar-tkt-filter-vinculo')?.value || 'all';
  const fCot = document.getElementById('depurar-tkt-filter-cotizacion')?.value || 'all';

  let filtradas = (window._depurarTicketsCache || []).filter(item => {
    // Filtro por cotización
    if (fCot === 'con_cotizacion' && !item.info.tieneCotizacion) return false;
    if (fCot === 'sin_cotizacion' && item.info.tieneCotizacion) return false;

    // Filtro por vínculo / estado
    if (fVinc === 'modificados' && !item.info.tieneInfo) return false;
    if (fVinc === 'limpios' && item.info.tieneInfo) return false;
    if (fVinc === 'huerfano' && item.tipoVinculo !== 'huerfano') return false;
    if (fVinc === 'os' && item.tipoVinculo !== 'os') return false;
    if (fVinc === 'padre' && item.tipoVinculo !== 'padre') return false;

    if (q) {
      const matchFolio = (item.folio || '').toLowerCase().includes(q);
      const matchAsunto = (item.asunto || '').toLowerCase().includes(q);
      const matchCliente = (item.cliente || '').toLowerCase().includes(q);
      const matchVinculo = (item.vinculoDetalle || '').toLowerCase().includes(q);
      const matchMod = (item.info.detalles || []).some(d => d.toLowerCase().includes(q));
      const matchCot = item.info.tieneCotizacion ? 'con cotizacion cotizado sap' : 'sin cotizacion';
      if (!matchFolio && !matchAsunto && !matchCliente && !matchVinculo && !matchMod && !matchCot.includes(q)) return false;
    }
    return true;
  });

  window._depurarTicketsFiltradasActuales = filtradas;

  const tbody = document.getElementById('depurar-tkt-tabla-body');
  if (!tbody) return;

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
          No se encontraron tickets -A con los filtros aplicados.
        </td>
      </tr>
    `;
    window.actualizarContadoresSeleccionTickets();
    return;
  }

  tbody.innerHTML = filtradas.map(item => {
    const isChecked = window._depurarTicketsSeleccionadas.has(item.id);
    const badgeVinculo = item.tipoVinculo === 'os'
      ? `<span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; border:1px solid rgba(37,99,235,0.3); white-space:nowrap;"><i data-lucide="file-text" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${item.vinculoDetalle}</span>`
      : (item.tipoVinculo === 'padre'
        ? `<span class="badge" style="background:rgba(234,88,12,0.1); color:#ea580c; border:1px solid rgba(234,88,12,0.3); white-space:nowrap;"><i data-lucide="ticket" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${item.vinculoDetalle}</span>`
        : `<span class="badge" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); white-space:nowrap;"><i data-lucide="alert-triangle" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>Huérfano / Sin Orden</span>`
      );

    const badgeCotTag = item.info.tieneCotizacion
      ? `<span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; border:1px solid rgba(16,185,129,0.3); font-weight:700; width:fit-content;"><i data-lucide="file-check-2" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>${item.info.cotizacionSAP ? 'SAP: ' + item.info.cotizacionSAP : 'Con Cotización'}</span>`
      : `<span class="badge" style="background:rgba(100,116,139,0.1); color:#64748b; border:1px solid rgba(100,116,139,0.25); font-weight:500; width:fit-content;"><i data-lucide="clock" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Sin Cotización</span>`;

    const cellAuditoria = item.info.tieneInfo
      ? `
        <div style="display:flex; flex-direction:column; gap:4px; max-width:280px;">
          <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
            <span class="badge" style="background:rgba(217,119,6,0.12); color:#d97706; border:1px solid rgba(217,119,6,0.3); font-weight:700; width:fit-content;">
              <i data-lucide="edit-3" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Modificado
            </span>
            ${badgeCotTag}
          </div>
          <div style="font-size:0.72rem; color:var(--text-secondary); line-height:1.35;" title="${item.info.detalles.join('\n')}">
            ${item.info.detalles.map(d => `<span style="display:inline-block; background:rgba(217,119,6,0.08); color:var(--text-primary); border:1px solid rgba(217,119,6,0.2); padding:1px 6px; border-radius:4px; margin:1px 2px 1px 0; font-weight:500;">${d}</span>`).join('')}
          </div>
        </div>
      `
      : `
        <div style="display:flex; flex-direction:column; gap:4px; max-width:280px;">
          <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
            <span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.25); font-weight:600; white-space:nowrap;">
              <i data-lucide="check-circle" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Sin Modificar (Limpio)
            </span>
            ${badgeCotTag}
          </div>
        </div>
      `;

    return `
      <tr style="border-bottom:1px solid var(--border); ${isChecked ? 'background:rgba(234,88,12,0.06);' : ''}">
        <td style="text-align:center; padding:0.6rem 0.4rem;">
          <input type="checkbox" onchange="window.toggleDepurarTicket('${item.id}', this.checked)" ${isChecked ? 'checked' : ''} style="cursor:pointer;" />
        </td>
        <td style="padding:0.6rem 0.75rem; font-weight:700; white-space:nowrap;">
          <a href="javascript:void(0)" onclick="window.cerrarModalDepurarTickets(); verDetalleTicket('${item.id}');" style="color:var(--accent); text-decoration:underline;" title="Abrir detalle del Ticket">${item.folio}</a>
        </td>
        <td style="padding:0.6rem 0.75rem; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.asunto}">${item.asunto}</td>
        <td style="padding:0.6rem 0.75rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.cliente}${item.sitio ? ' - ' + item.sitio : ''}">
          <div style="font-weight:500;">${item.cliente}</div>
          ${item.sitio ? `<div style="font-size:0.72rem; color:var(--text-muted);">${item.sitio}</div>` : ''}
        </td>
        <td style="padding:0.6rem 0.75rem;">${badgeVinculo}</td>
        <td style="padding:0.6rem 0.75rem; text-align:center;">
          <span class="badge" style="background:var(--bg-body); border:1px solid var(--border); font-weight:600;">${item.refCount} partes</span>
        </td>
        <td style="padding:0.6rem 0.75rem;">${cellAuditoria}</td>
        <td style="padding:0.6rem 0.75rem; white-space:nowrap;"><span class="badge badge-${badgeTicketEstado(item.raw)}">${getTicketEstadoLabel(item.raw)}</span></td>
        <td style="padding:0.6rem 0.75rem; font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">${formatFechaAmigable(item.fechaCreacion)}</td>
        <td style="text-align:center; padding:0.6rem 0.5rem; white-space:nowrap;">
          <div style="display:inline-flex; align-items:center; gap:4px;">
            <button class="action-btn" onclick="window.cerrarModalDepurarTickets(); verDetalleTicket('${item.id}');" title="Ver Ticket Completo" style="width:28px; height:28px; border-radius:6px; color:var(--accent, #ea580c); border:1px solid rgba(234,88,12,0.25); background:transparent; cursor:pointer;">
              <i data-lucide="eye" style="width:13px; height:13px;"></i>
            </button>
            <button class="action-btn del" onclick="window.eliminarTicketIndividualDepurador('${item.id}')" title="Eliminar Ticket" style="width:28px; height:28px; border-radius:6px; color:var(--danger, #ef4444); border:1px solid rgba(239,68,68,0.25); background:transparent; cursor:pointer;">
              <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  window.actualizarContadoresSeleccionTickets();
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

function toggleDepurarCheckAllTickets(checked) {
  (window._depurarTicketsFiltradasActuales || []).forEach(item => {
    if (checked) {
      window._depurarTicketsSeleccionadas.add(item.id);
    } else {
      window._depurarTicketsSeleccionadas.delete(item.id);
    }
  });
  window.filtrarTablaDepuradorTickets();
};

function toggleDepurarTicket(id, checked) {
  if (checked) {
    window._depurarTicketsSeleccionadas.add(id);
  } else {
    window._depurarTicketsSeleccionadas.delete(id);
  }
  window.actualizarContadoresSeleccionTickets();
};

function actualizarContadoresSeleccionTickets() {
  const count = window._depurarTicketsSeleccionadas.size;
  const statSel = document.getElementById('depurar-tkt-stat-selected');
  if (statSel) statSel.textContent = count;

  const btnDel = document.getElementById('btn-depurar-tkt-delete-selected');
  const countLabel = document.getElementById('btn-depurar-tkt-del-count');
  if (countLabel) countLabel.textContent = count;

  if (btnDel) {
    if (count > 0) {
      btnDel.disabled = false;
      btnDel.style.opacity = '1';
      btnDel.style.cursor = 'pointer';
    } else {
      btnDel.disabled = true;
      btnDel.style.opacity = '0.5';
      btnDel.style.cursor = 'not-allowed';
    }
  }

  const checkAll = document.getElementById('depurar-tkt-check-all');
  if (checkAll && window._depurarTicketsFiltradasActuales && window._depurarTicketsFiltradasActuales.length > 0) {
    const allVisibleChecked = window._depurarTicketsFiltradasActuales.every(i => window._depurarTicketsSeleccionadas.has(i.id));
    checkAll.checked = allVisibleChecked;
  } else if (checkAll) {
    checkAll.checked = false;
  }
};

async function eliminarTicketIndividualDepurador(id) {
  const item = (window._depurarTicketsCache || []).find(x => x.id === id);
  const folio = item ? item.folio : id;

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Ticket',
    mensaje: `¿Deseas eliminar el ticket ${folio}?`,
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  tickets = tickets.filter(t => t.id !== id);
  safeSetJSON('sapi_tickets', tickets);
  if (window.deleteFromSupabase) {
    await window.deleteFromSupabase('tickets', id).catch(() => {});
  }

  window._depurarTicketsSeleccionadas.delete(id);
  window._depurarTicketsCache = window._depurarTicketsCache.filter(x => x.id !== id);

  const diag = window.contarTicketsADepuracion();
  window.actualizarEstadisticasModalDepurador(diag);
  window.filtrarTablaDepuradorTickets();
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  mostrarNotificacion(`Ticket ${folio} eliminado correctamente.`, 'success');
};

async function eliminarSeleccionadosDepuradorTickets() {
  const ids = Array.from(window._depurarTicketsSeleccionadas);
  if (ids.length === 0) return;

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Tickets Seleccionados',
    mensaje: `¿Estás seguro de eliminar los ${ids.length} tickets seleccionados? Esta acción es irreversible.`,
    textoAceptar: `Eliminar (${ids.length})`,
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  tickets = tickets.filter(t => !ids.includes(t.id));
  safeSetJSON('sapi_tickets', tickets);
  if (window.deleteFromSupabase) {
    await Promise.all(ids.map(id => window.deleteFromSupabase('tickets', id).catch(() => {})));
  }

  window._depurarTicketsSeleccionadas.clear();
  window._depurarTicketsCache = window._depurarTicketsCache.filter(x => !ids.includes(x.id));

  const diag = window.contarTicketsADepuracion();
  window.actualizarEstadisticasModalDepurador(diag);
  window.filtrarTablaDepuradorTickets();
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  mostrarNotificacion(`${ids.length} tickets eliminados correctamente.`, 'success');
};

// Regenerador específico para Tickets SIN Cotización (Protege 100% de los tickets con cotización)
async function regenerarSoloTicketsSinCotizacion() {
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.rol === 'superadmin');
  if (!isSuperAdmin) {
    mostrarNotificacion('Solo el Superadministrador puede ejecutar esta acción.', 'error');
    return;
  }

  const diag = window.contarTicketsADepuracion();
  const sinCot = diag.todos.filter(i => !i.info.tieneCotizacion);
  const conCot = diag.todos.filter(i => i.info.tieneCotizacion);

  if (sinCot.length === 0) {
    mostrarNotificacion('No hay tickets -A sin cotización para regenerar. Todos los existentes ya cuentan con cotización registrada.', 'info');
    return;
  }

  const confirmed = await window.confirmarAccion({
    titulo: 'Regenerar Tickets Sin Cotización',
    mensaje: `Se eliminarán ${sinCot.length} ticket(s) -A que NO tienen cotización y se conservarán 100% intactos ${conCot.length} ticket(s) que YA TIENEN COTIZACIÓN registrada.\n\nLuego se regenerarán únicamente las refacciones necesarias desde las Órdenes de Servicio activas. ¿Deseas continuar?`,
    textoAceptar: `Regenerar (${sinCot.length} sin cotización)`,
    textoCancelar: 'Cancelar',
    esPeligroso: false
  });
  if (!confirmed) return;

  const existingFolioMap = new Map();
  (Array.isArray(tickets) ? tickets : []).forEach(t => {
    if (t && t.folio) existingFolioMap.set(t.folio, t.id);
  });

  const sinCotIds = new Set(sinCot.map(v => v.id));

  // 1. Conservar solo los que YA TIENEN COTIZACIÓN
  tickets = (Array.isArray(tickets) ? tickets : []).filter(t => !sinCotIds.has(t.id));

  // 2. Regenerar ÚNICAMENTE desde Órdenes de Servicio activas con refacciones necesarias
  const poolOrdenes = Array.isArray(ordenes) ? [...ordenes] : [];
  let regeneradosOS = 0;
  const now = new Date().toISOString();

  poolOrdenes.forEach(o => {
    if (!o) return;
    const refNecesarias = o.ref_necesarias || [];
    if (!Array.isArray(refNecesarias) || refNecesarias.length === 0) return;

    let baseFolio = String(o.folio || '').trim();
    if (o.soporte) {
      const parentTicket = (Array.isArray(tickets) ? tickets : []).find(t => t.id === o.soporte || t.folio === o.soporte);
      if (parentTicket && parentTicket.folio) baseFolio = parentTicket.folio;
    }
    if (!baseFolio) return;

    let targetFolio = baseFolio.startsWith('TKT-') ? `${baseFolio}-A` : `TKT-${baseFolio}-A`;
    if (targetFolio.endsWith('-A-A')) targetFolio = targetFolio.replace('-A-A', '-A');

    // Verificar si ya existe un ticket protegido (con cotización) para esta orden
    const yaExiste = tickets.some(t => t && (t.ordenId === o.id || t.folio === targetFolio));
    if (yaExiste) return;

    const refaccionesMapeadas = refNecesarias.map(r => ({
      marca: r.marca || '',
      codigo: r.clave || r.codigo || 'S/C',
      clave: r.clave || r.codigo || 'S/C',
      nombre: r.descripcion || r.nombre || 'Sin Descripción',
      descripcion: r.descripcion || r.nombre || 'Sin Descripción',
      cantidad: r.cantidad || 1,
      estatusPedido: r.estatusPedido || 'Por Pedir'
    }));

    const ticketId = existingFolioMap.get(targetFolio) || crypto.randomUUID();

    const nuevoTicket = {
      id: ticketId,
      folio: targetFolio,
      ordenId: o.id,
      ordenFolio: o.folio,
      fecha: o.fecha || now,
      fechaCreacion: o.fecha || now,
      fechaCierre: null,
      canal: 'sistema',
      contacto: '',
      asunto: `Refacciones para ${o.folio || ''}`,
      cliente: o.cliente || 'Sin cliente',
      sitio: o.ubicacion || o.ubicacion_sitio || '',
      solicitante: o.creadoPor || o.tecnico || 'Sistema',
      creadoPor: o.creadoPor || o.tecnico || 'Sistema',
      area: 'Operaciones',
      categoria: 'Refacción',
      prioridad: 'Media',
      asignado: 'Adrian Franco',
      descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${o.folio}.`,
      equipo: o.equipo || '',
      horometro: o.horometro_real || o.horometro || '',
      notas: '',
      refaccionesSeleccionadas: refaccionesMapeadas,
      cotizacionesAdicionales: [],
      estado: 'Refacciones',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      comentariosInternos: [],
      comentariosClientes: [],
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: null,
      esPrueba: o.esPrueba || false
    };

    tickets.push(nuevoTicket);
    regeneradosOS++;
  });

  // 3. Eliminar en Supabase solo los IDs que ya no existen en la lista final
  const finalIds = new Set(tickets.map(t => t.id));
  const idsToDelete = Array.from(sinCotIds).filter(id => !finalIds.has(id));
  if (window.deleteFromSupabase && idsToDelete.length > 0) {
    await Promise.all(idsToDelete.map(id => window.deleteFromSupabase('tickets', id).catch(() => {})));
  }

  // 4. Sincronizar los tickets nuevos/regenerados en Supabase
  if (window.pushToSupabase) {
    const regeneratedTickets = tickets.filter(t => sinCotIds.has(t.id) || !existingFolioMap.has(t.folio));
    for (const t of regeneratedTickets) {
      await window.pushToSupabase('tickets', t).catch(() => {});
    }
  }

  safeSetJSON('sapi_tickets', tickets);
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  window.actualizarBadgeDepuradorOrdenes();

  mostrarNotificacion(`Regeneración exitosa: ${idsToDelete.length} duplicados/huérfanos eliminados, ${conCot.length} tickets cotizados protegidos, ${regeneradosOS} tickets de Órdenes de Servicio sincronizados.`, 'success');

  const nuevoDiag = window.contarTicketsADepuracion();
  window._depurarTicketsCache = nuevoDiag.todos;
  window._depurarTicketsSeleccionadas.clear();
  window.actualizarEstadisticasModalDepurador(nuevoDiag);
  window.filtrarTablaDepuradorTickets();
};

// Limpieza segura: Solo elimina tickets vacíos / sin modificar y regenera los faltantes desde Órdenes de Servicio
async function limpiarSoloTicketsVaciosYRegenerar() {
  const diag = window.contarTicketsADepuracion();
  const vacios = diag.todos.filter(i => !i.info.tieneInfo);
  const modificados = diag.todos.filter(i => i.info.tieneInfo);

  if (vacios.length === 0) {
    mostrarNotificacion('No hay tickets -A vacíos para limpiar. Todos los existentes tienen información capturada por el equipo.', 'info');
    return;
  }

  const confirmed = await window.confirmarAccion({
    titulo: 'Limpiar Solo Tickets Vacíos',
    mensaje: `Se eliminarán ${vacios.length} tickets -A vacíos/sin modificar y se conservarán intactos ${modificados.length} tickets con comentarios/SAP del equipo. Luego se sincronizarán los tickets requeridos desde las Órdenes de Servicio activas. ¿Deseas continuar?`,
    textoAceptar: `Limpiar ${vacios.length} vacíos y regenerar`,
    textoCancelar: 'Cancelar',
    esPeligroso: false
  });
  if (!confirmed) return;

  const existingFolioMap = new Map();
  (Array.isArray(tickets) ? tickets : []).forEach(t => {
    if (t && t.folio) existingFolioMap.set(t.folio, t.id);
  });

  const vaciosIds = new Set(vacios.map(v => v.id));

  // Eliminar solo los vacíos
  tickets = tickets.filter(t => !vaciosIds.has(t.id));

  // 1. Regenerar desde Órdenes de Servicio activas que no tengan ya un ticket activo
  const poolOrdenes = Array.isArray(ordenes) ? [...ordenes] : [];
  let regeneradosOS = 0;
  const now = new Date().toISOString();

  poolOrdenes.forEach(o => {
    if (!o) return;
    const refNecesarias = o.ref_necesarias || [];
    if (!Array.isArray(refNecesarias) || refNecesarias.length === 0) return;

    let baseFolio = String(o.folio || '').trim();
    if (o.soporte) {
      const parentTicket = (Array.isArray(tickets) ? tickets : []).find(t => t.id === o.soporte || t.folio === o.soporte);
      if (parentTicket && parentTicket.folio) baseFolio = parentTicket.folio;
    }
    if (!baseFolio) return;

    let targetFolio = baseFolio.startsWith('TKT-') ? `${baseFolio}-A` : `TKT-${baseFolio}-A`;
    if (targetFolio.endsWith('-A-A')) targetFolio = targetFolio.replace('-A-A', '-A');

    // Verificar si ya existe un ticket conservado para esta orden
    const yaExiste = tickets.some(t => t && (t.ordenId === o.id || t.folio === targetFolio));
    if (yaExiste) return;

    const refaccionesMapeadas = refNecesarias.map(r => ({
      marca: r.marca || '',
      codigo: r.clave || r.codigo || 'S/C',
      clave: r.clave || r.codigo || 'S/C',
      nombre: r.descripcion || r.nombre || 'Sin Descripción',
      descripcion: r.descripcion || r.nombre || 'Sin Descripción',
      cantidad: r.cantidad || 1,
      estatusPedido: r.estatusPedido || 'Por Pedir'
    }));

    const ticketId = existingFolioMap.get(targetFolio) || crypto.randomUUID();

    const nuevoTicket = {
      id: ticketId,
      folio: targetFolio,
      ordenId: o.id,
      ordenFolio: o.folio,
      fecha: o.fecha || now,
      fechaCreacion: o.fecha || now,
      fechaCierre: null,
      canal: 'sistema',
      contacto: '',
      asunto: `Refacciones para ${o.folio || ''}`,
      cliente: o.cliente || 'Sin cliente',
      sitio: o.ubicacion || o.ubicacion_sitio || '',
      solicitante: o.creadoPor || o.tecnico || 'Sistema',
      creadoPor: o.creadoPor || o.tecnico || 'Sistema',
      area: 'Operaciones',
      categoria: 'Refacción',
      prioridad: 'Media',
      asignado: 'Adrian Franco',
      descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${o.folio}.`,
      equipo: o.equipo || '',
      horometro: o.horometro_real || o.horometro || '',
      notas: '',
      refaccionesSeleccionadas: refaccionesMapeadas,
      cotizacionesAdicionales: [],
      estado: 'Refacciones',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      comentariosInternos: [],
      comentariosClientes: [],
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: null,
      esPrueba: o.esPrueba || false
    };

    tickets.push(nuevoTicket);
    regeneradosOS++;
  });

  // 2. Eliminar en Supabase solo los IDs que ya no existen
  const finalIdsVacios = new Set(tickets.map(t => t.id));
  const idsToDeleteVacios = Array.from(vaciosIds).filter(id => !finalIdsVacios.has(id));
  if (window.deleteFromSupabase && idsToDeleteVacios.length > 0) {
    await Promise.all(idsToDeleteVacios.map(id => window.deleteFromSupabase('tickets', id).catch(() => {})));
  }

  // 3. Sincronizar los tickets nuevos/regenerados en Supabase
  if (window.pushToSupabase) {
    const regeneratedTickets = tickets.filter(t => vaciosIds.has(t.id) || !existingFolioMap.has(t.folio));
    for (const t of regeneratedTickets) {
      await window.pushToSupabase('tickets', t).catch(() => {});
    }
  }

  safeSetJSON('sapi_tickets', tickets);
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  window.actualizarBadgeDepuradorOrdenes();

  mostrarNotificacion(`Limpieza segura completada: ${idsToDeleteVacios.length} tickets vacíos eliminados, ${modificados.length} modificados protegidos, ${regeneradosOS} tickets de Órdenes de Servicio sincronizados.`, 'success');

  const nuevoDiag = window.contarTicketsADepuracion();
  window._depurarTicketsCache = nuevoDiag.todos;
  window._depurarTicketsSeleccionadas.clear();
  window.actualizarEstadisticasModalDepurador(nuevoDiag);
  window.filtrarTablaDepuradorTickets();
};

// Regenerador específico desde Tickets Padre (Sincroniza subtickets que ya están vinculados a su Padre real)
async function regenerarTicketsDesdeTicketsPadre() {
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.rol === 'superadmin');
  if (!isSuperAdmin) {
    mostrarNotificacion('Solo el Superadministrador puede ejecutar esta acción.', 'error');
    return;
  }

  const diag = window.contarTicketsADepuracion();
  const ticketsConPadre = diag.todos.filter(i => i.tipoVinculo === 'padre');

  if (ticketsConPadre.length === 0) {
    mostrarNotificacion('No se encontraron subtickets -A vinculados a un Ticket Padre para regenerar.', 'info');
    return;
  }

  const confirmed = await window.confirmarAccion({
    titulo: 'Sincronizar Subtickets desde Tickets Padre',
    mensaje: `Se identificaron ${ticketsConPadre.length} subticket(s) -A vinculados a sus Tickets Padre. Esta acción sincronizará los datos del ticket padre correspondiente (cliente, sitio, equipo, horómetro). ¿Deseas continuar?`,
    textoAceptar: `Sincronizar (${ticketsConPadre.length})`,
    textoCancelar: 'Cancelar',
    esPeligroso: false
  });
  if (!confirmed) return;

  const poolTickets = Array.isArray(tickets) ? [...tickets] : [];
  let sincronizados = 0;

  for (const item of ticketsConPadre) {
    const tHijo = poolTickets.find(t => t && t.id === item.id);
    if (!tHijo) continue;

    const p = window.obtenerTicketPadre(tHijo);
    if (!p) continue;

    // Sincronizar datos exactos desde el padre real
    tHijo.parentTicketId = p.id;
    tHijo.ticketPadreId = p.id;
    tHijo.ordenId = null;
    tHijo.ordenFolio = null;

    if (p.cliente) tHijo.cliente = p.cliente;
    if (p.sitio) tHijo.sitio = p.sitio;
    if (p.equipo) tHijo.equipo = p.equipo;
    if (p.horometro) tHijo.horometro = p.horometro;

    if (Array.isArray(p.refaccionesSeleccionadas) && p.refaccionesSeleccionadas.length > 0) {
      if (!tHijo.refaccionesSeleccionadas || tHijo.refaccionesSeleccionadas.length === 0) {
        tHijo.refaccionesSeleccionadas = p.refaccionesSeleccionadas.map(r => ({
          marca: r.marca || '',
          codigo: r.clave || r.codigo || 'S/C',
          clave: r.clave || r.codigo || 'S/C',
          nombre: r.descripcion || r.nombre || 'Sin Descripción',
          descripcion: r.descripcion || r.nombre || 'Sin Descripción',
          cantidad: r.cantidad || 1,
          estatusPedido: r.estatusPedido || 'Por Pedir'
        }));
      }
    }

    if (window.pushToSupabase) {
      await window.pushToSupabase('tickets', tHijo).catch(() => {});
    }
    sincronizados++;
  }

  safeSetJSON('sapi_tickets', tickets);
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  window.actualizarBadgeDepuradorOrdenes();

  mostrarNotificacion(`Sincronización desde Tickets Padre exitosa: ${sincronizados} tickets sincronizados.`, 'success');

  const nuevoDiag = window.contarTicketsADepuracion();
  window._depurarTicketsCache = nuevoDiag.todos;
  window._depurarTicketsSeleccionadas.clear();
  window.actualizarEstadisticasModalDepurador(nuevoDiag);
  window.filtrarTablaDepuradorTickets();
};

async function depurarYRegenerarTicketsCompletos() {
  const diag = window.contarTicketsADepuracion();
  let advertenciaModificados = '';

  if (diag.modificadosCount > 0) {
    advertenciaModificados = `\n\n⚠️ ¡ATENCIÓN! Se detectaron ${diag.modificadosCount} ticket(s) con comentarios internos, órdenes SAP o modificaciones del equipo. La 'Limpieza Total' los eliminará y regenerará desde cero desde las Órdenes de Servicio activas.`;
  }

  const confirmed = await window.confirmarAccion({
    titulo: 'Limpieza y Regeneración Total de Tickets -A',
    mensaje: `Esta acción eliminará todos los tickets -A (${diag.total} en total) y escaneará las Órdenes de Servicio activas para regenerar tickets 100% limpios y vinculados a sus OS.${advertenciaModificados}\n\n¿Estás seguro de continuar?`,
    textoAceptar: 'Limpiar y Regenerar Todo',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  const existingFolioMap = new Map();
  (Array.isArray(tickets) ? tickets : []).forEach(t => {
    if (t && t.folio) existingFolioMap.set(t.folio, t.id);
  });

  const poolTickets = Array.isArray(tickets) ? [...tickets] : [];
  const poolOrdenes = Array.isArray(ordenes) ? [...ordenes] : [];

  // 1. Identificar todos los tickets -A existentes
  const ticketsABorrados = [];
  const ticketsConservados = [];

  poolTickets.forEach(t => {
    if (!t) return;
    const tFolio = String(t.folio || '').trim();
    const isA = /-[Aa]$/i.test(tFolio) || tFolio.toUpperCase().includes('-A') || Boolean(t.parentTicketId || t.ticketPadreId);
    if (isA) {
      ticketsABorrados.push(t);
    } else {
      ticketsConservados.push(t);
    }
  });

  tickets = ticketsConservados;
  let regeneradosOS = 0;
  const now = new Date().toISOString();

  // 2. Regenerar desde Órdenes de Servicio activas que tienen refacciones necesarias
  poolOrdenes.forEach(o => {
    if (!o) return;
    const refNecesarias = o.ref_necesarias || [];
    if (!Array.isArray(refNecesarias) || refNecesarias.length === 0) return;

    let baseFolio = String(o.folio || '').trim();
    if (o.soporte) {
      const parentTicket = ticketsConservados.find(t => t.id === o.soporte || t.folio === o.soporte);
      if (parentTicket && parentTicket.folio) baseFolio = parentTicket.folio;
    }
    if (!baseFolio) return;

    let targetFolio = baseFolio.startsWith('TKT-') ? `${baseFolio}-A` : `TKT-${baseFolio}-A`;
    if (targetFolio.endsWith('-A-A')) targetFolio = targetFolio.replace('-A-A', '-A');

    const refaccionesMapeadas = refNecesarias.map(r => ({
      marca: r.marca || '',
      codigo: r.clave || r.codigo || 'S/C',
      clave: r.clave || r.codigo || 'S/C',
      nombre: r.descripcion || r.nombre || 'Sin Descripción',
      descripcion: r.descripcion || r.nombre || 'Sin Descripción',
      cantidad: r.cantidad || 1,
      estatusPedido: r.estatusPedido || 'Por Pedir'
    }));

    const ticketId = existingFolioMap.get(targetFolio) || crypto.randomUUID();

    const nuevoTicket = {
      id: ticketId,
      folio: targetFolio,
      ordenId: o.id,
      ordenFolio: o.folio,
      fecha: o.fecha || now,
      fechaCreacion: o.fecha || now,
      fechaCierre: null,
      canal: 'sistema',
      contacto: '',
      asunto: `Refacciones para ${o.folio || ''}`,
      cliente: o.cliente || 'Sin cliente',
      sitio: o.ubicacion || o.ubicacion_sitio || '',
      solicitante: o.creadoPor || o.tecnico || 'Sistema',
      creadoPor: o.creadoPor || o.tecnico || 'Sistema',
      area: 'Operaciones',
      categoria: 'Refacción',
      prioridad: 'Media',
      asignado: 'Adrian Franco',
      descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${o.folio}.`,
      equipo: o.equipo || '',
      horometro: o.horometro_real || o.horometro || '',
      notas: '',
      refaccionesSeleccionadas: refaccionesMapeadas,
      cotizacionesAdicionales: [],
      estado: 'Refacciones',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      comentariosInternos: [],
      comentariosClientes: [],
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: null,
      esPrueba: o.esPrueba || false
    };

    tickets.push(nuevoTicket);
    regeneradosOS++;
  });

  // 3. Eliminar en Supabase solo los IDs que ya no existen
  const finalIds = new Set(tickets.map(t => t.id));
  const idsToDelete = ticketsABorrados.map(t => t.id).filter(id => !finalIds.has(id));
  if (window.deleteFromSupabase && idsToDelete.length > 0) {
    await Promise.all(idsToDelete.map(id => window.deleteFromSupabase('tickets', id).catch(() => {})));
  }

  // 4. Sincronizar en Supabase
  if (window.pushToSupabase) {
    const isA_Ticket = (t) => {
      const f = String(t?.folio || '').trim();
      return /-[Aa]$/i.test(f) || f.toUpperCase().includes('-A') || Boolean(t?.parentTicketId || t?.ticketPadreId);
    };
    for (const t of tickets.filter(isA_Ticket)) {
      await window.pushToSupabase('tickets', t).catch(() => {});
    }
  }

  safeSetJSON('sapi_tickets', tickets);
  renderTickets();
  renderStats();
  window.actualizarBadgeDepuradorTickets();
  window.actualizarBadgeDepuradorOrdenes();

  mostrarNotificacion(`Limpieza exitosa: ${idsToDelete.length} tickets obsoletos/duplicados eliminados, ${regeneradosOS} tickets de Órdenes de Servicio regenerados.`, 'success');

  // Recargar datos en el modal
  const diagNuevo = window.contarTicketsADepuracion();
  window._depurarTicketsCache = diagNuevo.todos;
  window._depurarTicketsSeleccionadas.clear();
  window.actualizarEstadisticasModalDepurador(diagNuevo);
  window.filtrarTablaDepuradorTickets();
};

function exportarDepuradorTicketsAExcel() {
  const lista = window._depurarTicketsFiltradasActuales || [];
  if (lista.length === 0) {
    mostrarNotificacion('No hay tickets en la lista para exportar.', 'warning');
    return;
  }
  if (typeof XLSX === 'undefined') {
    mostrarNotificacion('Librería de Excel no disponible.', 'error');
    return;
  }

  const data = lista.map(i => ({
    'Folio Ticket': i.folio,
    'Asunto': i.asunto,
    'Cliente': i.cliente,
    'Sitio': i.sitio,
    'Tipo de Vínculo': i.tipoVinculo === 'os' ? 'Orden de Servicio' : (i.tipoVinculo === 'padre' ? 'Ticket Padre' : 'Huérfano'),
    'Detalle Vínculo': i.vinculoDetalle,
    'No. Refacciones': i.refCount,
    'Tiene Cotización': i.info.tieneCotizacion ? 'SÍ' : 'NO',
    'Tiene Información / Modificado': i.info.tieneInfo ? 'SÍ (Modificado)' : 'NO (Limpio)',
    'Detalle de Modificaciones': i.info.detalles.join(' | ') || 'Ninguna',
    'Modificado Por': i.info.modificadoPor || '—',
    'Comentarios Internos': i.info.numComentarios,
    'Cotización SAP': i.info.cotizacionSAP || '—',
    'Monto Cotización': i.info.montoCotizacion ? `$${i.info.montoCotizacion}` : '—',
    'Pedido SAP': i.info.pedidoSAP || '—',
    'Envíos / Guías': i.info.numEnvios,
    'Estado': i.estado,
    'Fecha Creación': i.fechaCreacion
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Depuración Tickets -A');
  XLSX.writeFile(wb, `Auditoria_Tickets_A_${new Date().toISOString().slice(0,10)}.xlsx`);
  mostrarNotificacion('Reporte Excel generado con éxito.', 'success');
};



// Sanitizar asignaciones de tickets: asegura preservación de asignaciones y recuperación exhaustiva de cliente/equipo
function sanitizarAsignacionesTickets() {
  if (window._isSanitizingTickets) return;
  const now = Date.now();
  if (window._lastTicketsSanitizeTime && (now - window._lastTicketsSanitizeTime < 10000)) {
    return;
  }
  window._isSanitizingTickets = true;
  window._lastTicketsSanitizeTime = now;

  try {
    const tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];
    if (tkts.length === 0) return;

    let modificado = false;
    const repairedTickets = [];

    tkts.forEach(t => {
      if (!t) return;
      let tMod = false;

      // 1. Preservar asignación si venía en t.tecnico o t.tecnicosAsignados y t.asignado está vacío
      if ((!t.asignado || t.asignado === '-' || t.asignado === 'Sin Asignar' || t.asignado === 'sin_asignar') && t.tecnico) {
        t.asignado = t.tecnico;
        tMod = true;
      }
      if ((!t.asignado || t.asignado === '-' || t.asignado === 'Sin Asignar' || t.asignado === 'sin_asignar') && Array.isArray(t.tecnicosAsignados) && t.tecnicosAsignados.length > 0) {
        t.asignado = t.tecnicosAsignados.join(', ');
        tMod = true;
      }

      // 2. Herencia y recuperación exhaustiva de Cliente (solo si el cliente está en blanco o sin definir)
      const isBlankCliVal = (val) => {
        if (!val) return true;
        const str = String(val).toLowerCase().trim();
        return !str || str === 'sin cliente' || str === 'ninguno' || str === 'genérico' || str === 'generico' || str === 'sin_cliente' || str === '-';
      };
      if (isBlankCliVal(t.cliente)) {
        const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '';
        if (resolvedCli && resolvedCli !== t.cliente) {
          t.cliente = resolvedCli;
          tMod = true;
        }
      }

      // 3. Herencia de Sitio, Equipo y Asignado desde Parent/OS si faltan
      const p = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
      const o = !p && typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
      if (p) {
        if (!t.sitio && p.sitio) { t.sitio = p.sitio; tMod = true; }
        if ((!t.equipo || t.equipo === 'Otra / No registrada') && p.equipo) { t.equipo = p.equipo; tMod = true; }
        if ((!t.asignado || t.asignado === '-' || t.asignado === 'Sin Asignar') && p.asignado) { t.asignado = p.asignado; tMod = true; }
      } else if (o) {
        if (!t.sitio && (o.ubicacion || o.ubicacion_sitio)) { t.sitio = o.ubicacion || o.ubicacion_sitio; tMod = true; }
        if ((!t.equipo || t.equipo === 'Otra / No registrada') && o.equipo) { t.equipo = o.equipo; tMod = true; }
        if ((!t.asignado || t.asignado === '-' || t.asignado === 'Sin Asignar') && (o.tecnico || o.responsable)) { t.asignado = o.tecnico || o.responsable; tMod = true; }
      }

      if (tMod) {
        modificado = true;
        repairedTickets.push(t);
      }
    });

    if (modificado) {
      if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
      // Sincronizar de inmediato los tickets reparados hacia Supabase para consolidar la base de datos
      if (window.pushToSupabase && repairedTickets.length > 0) {
        repairedTickets.forEach(repT => {
          try {
            window.pushToSupabase('tickets', repT).catch(e => console.warn('[Sanitize Sync] Error al persistir ticket reparado en Supabase:', repT.folio, e));
          } catch(e) {}
        });
      }
    }
  } finally {
    window._isSanitizingTickets = false;
  }
};


if (typeof window !== 'undefined') {
  window.analizarInformacionTicket = analizarInformacionTicket;
  window.contarTicketsADepuracion = contarTicketsADepuracion;
  window.actualizarEstadisticasModalDepurador = actualizarEstadisticasModalDepurador;
  window.actualizarBadgeDepuradorTickets = actualizarBadgeDepuradorTickets;
  window.abrirModalDepurarTickets = abrirModalDepurarTickets;
  window.cerrarModalDepurarTickets = cerrarModalDepurarTickets;
  window.filtrarTablaDepuradorTickets = filtrarTablaDepuradorTickets;
  window.toggleDepurarCheckAllTickets = toggleDepurarCheckAllTickets;
  window.toggleDepurarTicket = toggleDepurarTicket;
  window.actualizarContadoresSeleccionTickets = actualizarContadoresSeleccionTickets;
  window.eliminarTicketIndividualDepurador = eliminarTicketIndividualDepurador;
  window.eliminarSeleccionadosDepuradorTickets = eliminarSeleccionadosDepuradorTickets;
  window.regenerarSoloTicketsSinCotizacion = regenerarSoloTicketsSinCotizacion;
  window.limpiarSoloTicketsVaciosYRegenerar = limpiarSoloTicketsVaciosYRegenerar;
  window.regenerarTicketsDesdeTicketsPadre = regenerarTicketsDesdeTicketsPadre;
  window.depurarYRegenerarTicketsCompletos = depurarYRegenerarTicketsCompletos;
  window.exportarDepuradorTicketsAExcel = exportarDepuradorTicketsAExcel;
  window.sanitizarAsignacionesTickets = sanitizarAsignacionesTickets;
  window._depurarTicketsCache = _depurarTicketsCache;
  window._depurarTicketsSeleccionadas = _depurarTicketsSeleccionadas;
  window._depurarTicketsFiltradasActuales = _depurarTicketsFiltradasActuales;
}

export {
  analizarInformacionTicket,
  contarTicketsADepuracion,
  actualizarEstadisticasModalDepurador,
  actualizarBadgeDepuradorTickets,
  abrirModalDepurarTickets,
  cerrarModalDepurarTickets,
  filtrarTablaDepuradorTickets,
  toggleDepurarCheckAllTickets,
  toggleDepurarTicket,
  actualizarContadoresSeleccionTickets,
  eliminarTicketIndividualDepurador,
  eliminarSeleccionadosDepuradorTickets,
  regenerarSoloTicketsSinCotizacion,
  limpiarSoloTicketsVaciosYRegenerar,
  regenerarTicketsDesdeTicketsPadre,
  depurarYRegenerarTicketsCompletos,
  exportarDepuradorTicketsAExcel,
  sanitizarAsignacionesTickets,
  _depurarTicketsCache,
  _depurarTicketsSeleccionadas,
  _depurarTicketsFiltradasActuales
};
