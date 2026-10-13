/**
 * Eurorep SAPI - Módulo de Listados, Filtros, Menús de Ordenación y Tabla de Órdenes
 * Archivo: src/modules/ordenes_listado.js
 *
 * Contiene la lógica para renderizado de la tabla principal de órdenes,
 * filtros por estado, técnico, supervisor, búsqueda multifactorial, y ordenamiento dinámico.
 */

import { normStr, safeFormatDate, formatFechaHoraAmigable } from '../utils.js';

let filtroEstadoServicios = '';
let filtroTicketsV2 = 'todos';
let currentOrdSortCol = (typeof window !== 'undefined' && window.currentOrdSortCol) || 'reciente';
let currentOrdSortDir = (typeof window !== 'undefined' && window.currentOrdSortDir) || 'desc';

function safeNormStr(s) {
  if (typeof normStr === 'function') return normStr(s);
  if (typeof window !== 'undefined' && typeof window.normStr === 'function') return window.normStr(s);
  return String(s || '').toLowerCase().trim();
}

function safeFormatFechaAmigable(f) {
  if (typeof window !== 'undefined' && typeof window.formatFechaAmigable === 'function') return window.formatFechaAmigable(f);
  if (typeof formatFechaHoraAmigable === 'function') return formatFechaHoraAmigable(f);
  if (typeof safeFormatDate === 'function') return safeFormatDate(f);
  return f || '';
}

function safeIsTestModeActive() {
  return typeof window !== 'undefined' && typeof window.isTestModeActive === 'function' ? window.isTestModeActive() : false;
}

function safeResolveTecnicoNombre(tecId) {
  if (!tecId) return '';
  if (typeof window !== 'undefined' && typeof window.resolveTecnicoNombre === 'function') {
    return window.resolveTecnicoNombre(tecId);
  }
  const users = (typeof window !== 'undefined' && Array.isArray(window.usuarios))
    ? window.usuarios
    : ((typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : []);
  const tecs = (typeof window !== 'undefined' && Array.isArray(window.tecnicosDb))
    ? window.tecnicosDb
    : ((typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) ? tecnicosDb : []);
  const match = users.find(u => u && (u.id === tecId || u.nombre === tecId)) || tecs.find(t => t && (t.id === tecId || t.nombre === tecId));
  return match ? match.nombre : tecId;
}

function safeGetFilteredOrders() {
  let list = [];
  if (typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function') {
    list = window.getFilteredOrders();
  } else if (typeof window !== 'undefined' && Array.isArray(window.ordenes) && window.ordenes.length > 0) {
    list = window.ordenes;
  } else if (typeof ordenes !== 'undefined' && Array.isArray(ordenes) && ordenes.length > 0) {
    list = ordenes;
  } else if (typeof safeGetJSON === 'function') {
    list = safeGetJSON('sapi_ordenes', []);
  } else if (typeof localStorage !== 'undefined') {
    try { list = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]'); } catch(e) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenFolios = new Set();
  return list.filter(o => {
    if (!o) return false;
    const oid = o.id ? String(o.id).trim() : null;
    const rawFolio = (o.folio || o.numero_orden) ? String(o.folio || o.numero_orden).trim() : '';
    const isGeneric = !rawFolio || ['-', 'n/a', 's/n', 'sin folio', 'null', 'undefined', 'por asignar'].includes(rawFolio.toLowerCase());
    if (oid && seenIds.has(oid)) return false;
    if (!isGeneric && seenFolios.has(rawFolio.toLowerCase())) return false;
    if (oid) seenIds.add(oid);
    if (!isGeneric) seenFolios.add(rawFolio.toLowerCase());
    return true;
  });
}

function setFiltroEstadoServicios(estado) {
  filtroEstadoServicios = estado;
  if (typeof window !== 'undefined') window.filtroEstadoServicios = estado;
  filtrarOrdenes('servicios');
  renderTabla('v2');
}

function setFiltroTicketsV2(estado) {
  filtroTicketsV2 = estado;
  if (typeof window !== 'undefined') window.filtroTicketsV2 = estado;
  if (typeof renderTickets === 'function') {
    renderTickets('v2');
  } else if (typeof window !== 'undefined' && typeof window.renderTickets === 'function') {
    window.renderTickets('v2');
  }
}

function toggleSortOrdenes(col) {
  if (currentOrdSortCol === col) {
    currentOrdSortDir = currentOrdSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentOrdSortCol = col;
    currentOrdSortDir = 'asc';
  }
  if (typeof window !== 'undefined') {
    window.currentOrdSortCol = currentOrdSortCol;
    window.currentOrdSortDir = currentOrdSortDir;
  }
  filtrarOrdenes('servicios');
  filtrarOrdenes();
}

function badgeEstado(estado) {
  if (estado === 'En Proceso') return 'badge-proceso';
  if ((estado === 'Completado' || estado === 'Cerrada' || estado === 'Cerrado')) return 'badge-completado';
  return 'badge-pendiente';
}

function filtrarOrdenes(ctx) {
  renderTabla(ctx);
}

function renderTabla(ctx) {
  if (typeof document === 'undefined') return;

  try {
    if (typeof actualizarFiltrosPersonal === 'function') actualizarFiltrosPersonal();
    else if (typeof window !== 'undefined' && typeof window.actualizarFiltrosPersonal === 'function') window.actualizarFiltrosPersonal();
  } catch (e) {}

  const isServiciosView = ctx === 'servicios';
  const currentSession = (typeof window !== 'undefined' && window.currentSession) ? window.currentSession : null;
  const usuarios = (typeof window !== 'undefined' && Array.isArray(window.usuarios)) ? window.usuarios : [];
  const tickets = (typeof window !== 'undefined' && Array.isArray(window.tickets)) ? window.tickets : [];
  const clientesDb = (typeof window !== 'undefined' && Array.isArray(window.clientesDb)) ? window.clientesDb : [];

  if (isServiciosView) {
    const btnExportOrd = document.getElementById('btn-exportar-ordenes-excel');
    if (btnExportOrd) {
      const isEmpresaUser = currentSession && ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
      btnExportOrd.style.display = isEmpresaUser ? 'none' : 'inline-flex';
    }
    const btnRegen = document.getElementById('btn-regenerar-ordenes');
    if (btnRegen) {
      const isAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
      btnRegen.style.display = isAdmin ? 'flex' : 'none';
    }
    const btnDepurar = document.getElementById('btn-depurar-ordenes-ref');
    if (btnDepurar) {
      const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin');
      btnDepurar.style.display = isSuperAdmin ? 'flex' : 'none';
      if (isSuperAdmin && typeof window.actualizarBadgeDepuradorOrdenes === 'function') {
        window.actualizarBadgeDepuradorOrdenes();
      }
    }
  }

  const isV2 = ctx === 'v2';
  const bodyId = isServiciosView ? 'tabla-body-servicios' : (isV2 ? 'v2-tabla-body' : 'tabla-body');
  const searchId = isServiciosView ? 'search-servicios' : (isV2 ? 'v2-search-ordenes' : 'search-input');
  const q = (document.getElementById(searchId)?.value || '').toLowerCase();
  const qClean = q.trim();
  const qNorm = qClean.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const qNum = qClean.replace(/[^0-9]/g, '');
  
  let filtradas = safeGetFilteredOrders().filter(o => {
    if (!qClean) return true;
    const oFol = String(o.folio || o.numero_orden || o.id || '').toLowerCase();
    const oFolNorm = oFol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const oFolNum = oFol.replace(/[^0-9]/g, '');

    const matchFolio = oFol.includes(qClean) || 
                       (qNorm && oFolNorm.includes(qNorm)) || 
                       (qNorm && qNorm.includes(oFolNorm)) ||
                       (qNum.length >= 4 && oFolNum === qNum);
    const matchCliente = String(o.cliente || '').toLowerCase().includes(qClean);
    const matchTecnico = String(o.tecnico || '').toLowerCase().includes(qClean);
    const matchUbicacion = String(o.ubicacion || '').toLowerCase().includes(qClean);
    const matchModelo = String(o.modelo || '').toLowerCase().includes(qClean);
    const matchTipo = String(o.tipo || '').toLowerCase().includes(qClean);
    const matchEstado = String(o.estado || '').toLowerCase().includes(qClean);

    // Buscar por ticket origen (folio, id, asunto, solicitante)
    let matchTicket = false;
    const rawSoporte = String(o.soporte || o.ticket_id || o.ticket_folio || '').toLowerCase();
    const rawSoporteNorm = rawSoporte.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rawSoporteNum = rawSoporte.replace(/[^0-9]/g, '');
    if (rawSoporte && (rawSoporte.includes(qClean) || (qNorm && rawSoporteNorm.includes(qNorm)) || (qNum.length >= 4 && rawSoporteNum === qNum))) {
      matchTicket = true;
    }

    if (!matchTicket && (o.soporte || o.ticket_id || o.ticket_folio)) {
      const targetTktId = o.soporte || o.ticket_id;
      const targetTktFolio = o.ticket_folio;
      const tk = tickets.find(x => x.id === targetTktId || x.folio === targetTktId || (targetTktFolio && x.folio === targetTktFolio));
      if (tk) {
        if (String(tk.folio || '').toLowerCase().includes(qClean)) matchTicket = true;
        if (String(tk.asunto || '').toLowerCase().includes(qClean)) matchTicket = true;
        if (String(tk.solicitante || '').toLowerCase().includes(qClean)) matchTicket = true;
      }
    }

    return matchCliente || matchTecnico || matchFolio || matchUbicacion || matchModelo || matchTipo || matchEstado || matchTicket;
  });

  if (isServiciosView && filtroEstadoServicios) {
    filtradas = filtradas.filter(o => (o.estado || '').toLowerCase() === filtroEstadoServicios.toLowerCase());
  }

    let tecFilter = document.getElementById('filter-ord-tecnico')?.value;
    let supFilter = document.getElementById('filter-ord-supervisor')?.value;
    
    const activeSession = (typeof currentSession !== 'undefined' && currentSession) ? currentSession : ((typeof window !== 'undefined' && window.currentSession) ? window.currentSession : null);
    const usersList = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : ((typeof window !== 'undefined' && Array.isArray(window.usuarios)) ? window.usuarios : []);
    const ticketsList = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : ((typeof window !== 'undefined' && Array.isArray(window.tickets)) ? window.tickets : []);
    const clientesList = (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) ? clientesDb : ((typeof window !== 'undefined' && Array.isArray(window.clientesDb)) ? window.clientesDb : []);

    const currentUser = activeSession ? usersList.find(u => u && u.id === activeSession.userId) : null;
    const isEmpresa = activeSession && ['empresa', 'cliente', 'cliente-consultor'].includes(String(activeSession.viewMode || '').toLowerCase().trim());
    
    if (isEmpresa) {
      let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
      if (nombreEmpresaLogged) {
        nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
        filtradas = filtradas.filter(o => {
          const ocli = String(o.cliente || '').toLowerCase().trim();
          let fromTicket = false;
          if (o.soporte || o.ticket_id) {
            const targetTkId = o.soporte || o.ticket_id;
            const tick = ticketsList.find(t => t && (t.id === targetTkId || t.folio === targetTkId));
            if (tick) {
              const tcli = String(tick.cliente || '').toLowerCase().trim();
              const tsol = String(tick.solicitante || '').toLowerCase().trim();
              if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
            }
          }
          return ocli === nombreEmpresaLogged || fromTicket;
        });
      } else {
        filtradas = [];
      }
    }

    const userRole = activeSession ? (activeSession.viewMode || '') : '';
    if (userRole === 'tecnico') {
      if (safeIsTestModeActive()) {
        tecFilter = '';
      } else {
        tecFilter = currentUser ? currentUser.nombre : (activeSession.nombre || '');
      }
    }
    if (userRole === 'supervisor') {
      supFilter = document.getElementById('filter-ord-supervisor')?.value || '';
    }
    
    if (tecFilter || supFilter) {
      const tecNameLower = tecFilter ? safeNormStr(tecFilter) : '';
      const supNameLower = supFilter ? safeNormStr(supFilter) : '';
      const myUserId = activeSession ? activeSession.userId : null;
      
      filtradas = filtradas.filter(o => {
        let passTec = true;
        let passSup = true;
        
        if (tecFilter && tecNameLower) {
           let assigned = [];
           if (o.tecnicosAsignados && Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.length > 0) {
             assigned = o.tecnicosAsignados.map(safeResolveTecnicoNombre);
           }
           if (o.tecnico) {
             assigned = assigned.concat(String(o.tecnico).split(',').map(s=>s.trim()));
           }
           const assignedLower = assigned.map(s => safeNormStr(s));
           const isDirectIdMatch = Boolean(myUserId && Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.includes(myUserId));
           const isDirectNameMatch = assignedLower.some(a => a === tecNameLower || a.includes(tecNameLower) || tecNameLower.includes(a));
           let isCreator = false;
           let isTkAssigned = false;
           let isBitacoraAssigned = false;
           if (o.bitacora && Array.isArray(o.bitacora)) {
             isBitacoraAssigned = o.bitacora.some(b => {
               if (!b || !b.tecnico) return false;
               const bNorm = safeNormStr(b.tecnico);
               return bNorm === tecNameLower || 
                      bNorm.includes(tecNameLower) || 
                      tecNameLower.includes(bNorm) || 
                      (myUserId && (b.tecnico === myUserId || b.tecnicoId === myUserId));
             });
           }
           if (o.creadoPor && (safeNormStr(o.creadoPor) === tecNameLower || (myUserId && o.creadoPor === myUserId))) {
             isCreator = true;
           }
           if (o.soporte || o.ticket_id) {
              const targetTkId = o.soporte || o.ticket_id;
              const tk = ticketsList.find(x => x && (x.id === targetTkId || x.folio === targetTkId));
              if (tk) {
                 if ((tk.solicitante && safeNormStr(tk.solicitante) === tecNameLower) || 
                     (tk.creadoPor && (safeNormStr(tk.creadoPor) === tecNameLower || (myUserId && tk.creadoPor === myUserId)))) {
                   isCreator = true;
                 }
                 let tkAssigned = [];
                 if (tk.tecnicosAsignados && Array.isArray(tk.tecnicosAsignados) && tk.tecnicosAsignados.length > 0) {
                   tkAssigned = tk.tecnicosAsignados.map(safeResolveTecnicoNombre);
                 }
                 if (tk.asignado && tk.asignado !== 'Sin asignar') {
                   tkAssigned = tkAssigned.concat(String(tk.asignado).split(',').map(s=>s.trim()));
                 }
                 const tkAssignedLower = tkAssigned.map(s => safeNormStr(s));
                 if (tkAssignedLower.some(a => a === tecNameLower || a.includes(tecNameLower) || tecNameLower.includes(a)) || (myUserId && Array.isArray(tk.tecnicosAsignados) && tk.tecnicosAsignados.includes(myUserId))) {
                   isTkAssigned = true;
                 }
              }
           }
           passTec = isDirectIdMatch || isDirectNameMatch || isCreator || isTkAssigned || isBitacoraAssigned;
        }
        
        if (supFilter && supNameLower) {
           let passSupClient = false;
           const cli = clientesList.find(c => c && c.nombre === o.cliente);
           if (cli) {
              const supUser = usersList.find(u => u && ((u.nombre && safeNormStr(u.nombre) === supNameLower) || u.id === supFilter));
              const supId = supUser ? supUser.id : supFilter;
              passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (safeNormStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
           }
           
           let assigned = [];
           if (o.tecnicosAsignados && Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.length > 0) {
             assigned = o.tecnicosAsignados.map(safeResolveTecnicoNombre);
           }
           if (o.tecnico) {
             assigned = assigned.concat(String(o.tecnico).split(',').map(s=>s.trim()));
           }
           const assignedLower = assigned.map(s => safeNormStr(s));
           
           let passSupTicket = assignedLower.includes(supNameLower);
           let isCreator = false;
           if (o.soporte || o.ticket_id) {
              const targetTkId = o.soporte || o.ticket_id;
              const tk = ticketsList.find(x => x && (x.id === targetTkId || x.folio === targetTkId));
              if (tk) {
                 if ((tk.solicitante && safeNormStr(tk.solicitante) === supNameLower) || 
                     (tk.creadoPor && safeNormStr(tk.creadoPor) === supNameLower)) isCreator = true;
                 let tkAssigned = [];
                 if (tk.tecnicosAsignados && Array.isArray(tk.tecnicosAsignados) && tk.tecnicosAsignados.length > 0) {
                   tkAssigned = tk.tecnicosAsignados.map(safeResolveTecnicoNombre);
                 }
                 if (tk.asignado && tk.asignado !== 'Sin asignar') {
                   tkAssigned = tkAssigned.concat(String(tk.asignado).split(',').map(s=>s.trim()));
                 }
                 const tkAssignedLower = tkAssigned.map(s => safeNormStr(s));
                 if (tkAssignedLower.includes(supNameLower)) passSupTicket = true;
              }
           }
           passSup = passSupClient || passSupTicket || isCreator;
        }
        
        return passTec && passSup;
      });
    }

    // Deduplicación estricta por ID y Folio no genérico
    const seenOrdIds = new Set();
    const seenOrdFolios = new Set();
    filtradas = filtradas.filter(o => {
      if (!o) return false;
      const oid = o.id ? String(o.id).trim() : null;
      const rawFolio = (o.folio || o.numero_orden) ? String(o.folio || o.numero_orden).trim() : '';
      const isGeneric = !rawFolio || ['-', 'n/a', 's/n', 'sin folio', 'null', 'undefined', 'por asignar'].includes(rawFolio.toLowerCase());
      if (oid && seenOrdIds.has(oid)) return false;
      if (!isGeneric && seenOrdFolios.has(rawFolio.toLowerCase())) return false;
      if (oid) seenOrdIds.add(oid);
      if (!isGeneric) seenOrdFolios.add(rawFolio.toLowerCase());
      return true;
    });

  // ORDENAMIENTO
  if (currentOrdSortCol !== 'reciente') {
    filtradas.sort((a, b) => {
      let valA = a[currentOrdSortCol] || '';
      let valB = b[currentOrdSortCol] || '';
      
      if (currentOrdSortCol === 'id') {
        const numA = parseInt(valA.replace(/\D/g, '')) || 0;
        const numB = parseInt(valB.replace(/\D/g, '')) || 0;
        return currentOrdSortDir === 'asc' ? numA - numB : numB - numA;
      } else if (currentOrdSortCol === 'fecha') {
        const dateA = new Date(valA).getTime() || 0;
        const dateB = new Date(valB).getTime() || 0;
        return currentOrdSortDir === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentOrdSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentOrdSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  } else {
    // Ordenamiento por defecto (recientes primero)
    filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  // Actualizar iconos de ordenamiento
  ['id', 'cliente', 'ubicacion', 'modelo', 'tecnico', 'tipo', 'estado', 'fecha'].forEach(col => {
    const icon = document.getElementById('sort-icon-ord-' + col);
    if (icon) {
      const isCurrent = currentOrdSortCol === col;
      const iconName = isCurrent ? (currentOrdSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-ord-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  if (isServiciosView && typeof window !== 'undefined') {
    window._currentOrdenesFiltradas = filtradas;
  }

  const body = document.getElementById(bodyId);
  if (!body) return;
  if (!filtradas.length) {
    body.innerHTML = `<tr><td colspan="10" class="empty-state">No hay órdenes${q ? ' que coincidan' : ' registradas'}.</td></tr>`;
    return;
  }
  const isConsulta = currentSession && currentSession.viewMode === 'consulta';
  const isTecnico = currentSession && currentSession.viewMode === 'tecnico';
  const canEdit = !isConsulta && !isTecnico && !isEmpresa;
  const canDelete = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);

  // Paginación progresiva para mantener el DOM ultra-rápido en listas extensas
  const currentQ = qClean || '';
  const currentCtx = ctx || 'default';
  if (typeof window !== 'undefined') {
    if (currentQ !== window._lastRenderOrdenesQuery || currentCtx !== window._lastRenderOrdenesCtx) {
      window.ordenPageLimit = 50;
      window._lastRenderOrdenesQuery = currentQ;
      window._lastRenderOrdenesCtx = currentCtx;
    }
  }
  const currentLimit = (typeof window !== 'undefined' && typeof window.ordenPageLimit === 'number') ? window.ordenPageLimit : 50;
  const totalMatching = filtradas.length;
  let paginatedOrdenes = filtradas;
  let hasMoreOrdenes = false;

  if (currentLimit > 0 && filtradas.length > currentLimit) {
    paginatedOrdenes = filtradas.slice(0, currentLimit);
    hasMoreOrdenes = true;
  }

  let htmlRows = paginatedOrdenes.map(o => {
    let orderCanEdit = canEdit;
    if (((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf) && (!currentSession || !['superadmin', 'admin'].includes(currentSession.viewMode))) {
      orderCanEdit = false;
    }
    const targetVal = o.soporte || o.ticket_id || o.ticket_folio;
    const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ticketAsoc = targetVal
      ? tickets.find(x => x.id === targetVal || x.folio === targetVal || (o.ticket_id && x.id === o.ticket_id) || (o.ticket_folio && x.folio === o.ticket_folio) || (o.soporte && (x.id === o.soporte || x.folio === o.soporte)))
      : null;
    let ticketHtml = '-';
    if (ticketAsoc) {
      ticketHtml = `<a href="#" onclick="verDetalleTicket('${ticketAsoc.id || ticketAsoc.folio}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="${ticketAsoc.asunto || ''}">${ticketAsoc.folio || ticketAsoc.id}</a>`;
    } else if (o.ticket_folio || (o.soporte && !isUuidRegex.test(o.soporte))) {
      const displayFolio = o.ticket_folio || o.soporte;
      const callId = o.ticket_id || o.soporte;
      ticketHtml = `<a href="#" onclick="verDetalleTicket('${callId}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="Ticket ${displayFolio}">${displayFolio}</a>`;
    } else if (o.soporte) {
      const knownFolio = (typeof window !== 'undefined' && window._ticketFolioMap) ? window._ticketFolioMap[o.soporte] : null;
      if (knownFolio) {
        ticketHtml = `<a href="#" onclick="verDetalleTicket('${o.soporte}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="Ticket ${knownFolio}">${knownFolio}</a>`;
      } else {
        ticketHtml = `<span class="async-ticket-cell" data-tkt-id="${o.soporte}" style="color: var(--accent); font-weight: 600; font-size: 0.85rem;"><i data-lucide="loader" style="width:12px;height:12px;display:inline-block;animation:spin 1s linear infinite;vertical-align:middle;"></i> Ticket...</span>`;
      }
    }
    
    return `
    <tr>
      <td data-label="Acciones" style="white-space:nowrap; width:60px;">
        <div style="display:flex;gap:0.25rem;">
          <button class="action-btn" onclick="verDetalle('${o.id}')" title="Ver"><i data-lucide="eye"></i></button>
          ${orderCanEdit ? `<button class="action-btn" onclick="editarOrden('${o.id}')" title="Editar"><i data-lucide="pencil"></i></button>` : ''}
        </div>
      </td>
      <td data-label="Folio"><strong>${o.folio||'-'}</strong></td>
      <td data-label="Ticket">${ticketHtml}</td>
      <td data-label="Cliente">${o.cliente||'-'}</td>
      <td data-label="Ubicación">${o.ubicacion||'-'}</td>
      <td data-label="Modelo">${o.modelo||'-'}</td>

      <td data-label="Tipo"><span class="badge badge-${(o.tipo||'otro').toLowerCase().replace('é','e').replace('í','i')}">${o.tipo||'-'}</span></td>
      <td data-label="Estado"><span class="badge ${badgeEstado(o.estado)}">${o.estado||'-'}</span></td>
      <td data-label="Fecha">${safeFormatFechaAmigable(o.fecha)}</td>
      <td data-label="" style="width:40px; text-align:center;">
        ${canDelete ? `<button class="action-btn del" onclick="eliminarOrden('${o.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
      </td>
    </tr>
    `;
  }).join('');

  if (hasMoreOrdenes) {
    const escapedCtx = String(ctx || '').replace(/'/g, "\\'");
    htmlRows += `
      <tr id="ordenes-load-more-row">
        <td colspan="10" style="text-align:center; padding:14px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-top:1px solid var(--border-color);">
          <div style="display:flex; align-items:center; justify-content:center; gap:12px; font-size:0.85rem; color:var(--text-secondary); flex-wrap:wrap;">
            <span>Mostrando <strong>${paginatedOrdenes.length}</strong> de <strong>${totalMatching}</strong> órdenes</span>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.cargarMasOrdenes('${escapedCtx}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:600; padding:4px 12px; cursor:pointer;">
              <i data-lucide="chevron-down" style="width:14px;height:14px;"></i> Cargar más (+50)
            </button>
            <button type="button" class="btn btn-sm btn-link" onclick="window.mostrarTodasLasOrdenes('${escapedCtx}')" style="color:var(--accent); text-decoration:underline; font-weight:500; background:none; border:none; cursor:pointer;">
              Mostrar todas
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  body.innerHTML = htmlRows;

  if (!ctx) {
    if (typeof renderStats === 'function') renderStats();
    else if (typeof window !== 'undefined' && typeof window.renderStats === 'function') window.renderStats();
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  resolvePendingAsyncTickets();
}

function resolvePendingAsyncTickets() {
  if (typeof document === 'undefined') return;
  const pending = document.querySelectorAll('.async-ticket-cell[data-tkt-id]');
  if (!pending || pending.length === 0) return;
  const ids = Array.from(new Set(Array.from(pending).map(el => el.getAttribute('data-tkt-id')).filter(Boolean)));
  if (ids.length === 0 || typeof window === 'undefined' || !window.supabaseClient) return;

  window.supabaseClient.from('tickets').select('id, folio').in('id', ids.slice(0, 50)).then(({ data, error }) => {
    if (error || !data) return;
    if (!window._ticketFolioMap) window._ticketFolioMap = {};
    data.forEach(t => {
      if (!t || !t.id || !t.folio) return;
      window._ticketFolioMap[t.id] = t.folio;
      const cells = document.querySelectorAll(`.async-ticket-cell[data-tkt-id="${t.id}"]`);
      cells.forEach(c => {
        c.outerHTML = `<a href="#" onclick="verDetalleTicket('${t.id}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="Ticket ${t.folio}">${t.folio}</a>`;
      });
    });
  }).catch(() => {});
}

function cargarMasOrdenes(ctx) {
  if (typeof window !== 'undefined') {
    window.ordenPageLimit = (window.ordenPageLimit || 50) + 50;
  }
  renderTabla(ctx);
}

function mostrarTodasLasOrdenes(ctx) {
  if (typeof window !== 'undefined') {
    window.ordenPageLimit = 999999;
  }
  renderTabla(ctx);
}

function resetOrdenPageLimit() {
  if (typeof window !== 'undefined') {
    window.ordenPageLimit = 50;
  }
}

// Exportar órdenes de servicio a archivo Excel (.xlsx)
function exportarOrdenesAExcel() {
  const currentSession = (typeof window !== 'undefined' && window.currentSession) ? window.currentSession : null;
  const isEmpresa = currentSession && ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  if (isEmpresa) {
    if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion('No tienes permisos para exportar la lista de órdenes.', 'error');
    } else if (typeof alert === 'function') {
      alert('No tienes permisos para exportar la lista de órdenes.');
    }
    return null;
  }

  let lista = (typeof window !== 'undefined' && Array.isArray(window._currentOrdenesFiltradas)) ? window._currentOrdenesFiltradas : null;
  if (!lista || lista.length === 0) {
    if (typeof safeGetFilteredOrders === 'function') {
      lista = safeGetFilteredOrders();
    } else if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) {
      lista = window.ordenes;
    } else {
      lista = [];
    }
  }

  if (!lista || lista.length === 0) {
    if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion('No hay órdenes de servicio en la lista para exportar.', 'warning');
    } else if (typeof alert === 'function') {
      alert('No hay órdenes de servicio en la lista para exportar.');
    }
    return [];
  }

  const ticketsList = (typeof window !== 'undefined' && Array.isArray(window.tickets)) ? window.tickets : [];

  const dataExport = lista.map((o, idx) => {
    const ticketAsoc = (o.soporte || o.ticket_id || o.ticket_folio)
      ? ticketsList.find(x => x && (x.id === o.soporte || x.folio === o.soporte || (o.ticket_id && x.id === o.ticket_id) || (o.ticket_folio && x.folio === o.ticket_folio)))
      : null;

    let tecnicoStr = '';
    if (o.tecnicosAsignados && Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.length > 0) {
      tecnicoStr = o.tecnicosAsignados.map(safeResolveTecnicoNombre).filter(Boolean).join(', ');
    }
    if (!tecnicoStr && o.tecnico) {
      tecnicoStr = String(o.tecnico);
    }

    const folioTicket = ticketAsoc ? (ticketAsoc.folio || '') : (o.soporte || o.ticket_id || o.ticket_folio || '');
    const fechaOrdStr = safeFormatFechaAmigable(o.fecha);
    const fechaCreacionStr = safeFormatFechaAmigable(o.created_at || o.fechaCreacion || o.fecha);

    return {
      '#': idx + 1,
      'Folio': o.folio || o.numero_orden || o.id || ('OS-' + (idx + 1)),
      'Ticket Asociado': folioTicket,
      'Cliente': o.cliente || '',
      'Ubicación / Sitio': o.ubicacion || o.ubicacion_sitio || o.sitio || '',
      'Modelo': o.modelo || '',
      'No. Serie': o.serie || o.numero_serie || o.no_serie || '',
      'Tipo de Servicio': o.tipo || '',
      'Estado': o.estado || '',
      'Técnico Asignado': tecnicoStr,
      'Fecha de Orden': fechaOrdStr,
      'Fecha Creación': fechaCreacionStr,
      'Descripción / Falla': o.descripcion || o.falla_reportada || o.trabajo_solicitado || '',
      'Trabajos Realizados': o.trabajo_realizado || o.observaciones || '',
      'Horómetro': (o.horometro !== undefined && o.horometro !== null && o.horometro !== '') ? o.horometro : ''
    };
  });

  const fechaHoy = new Date().toISOString().split('T')[0];
  const filename = `Ordenes_Servicio_Eurorep_${fechaHoy}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(dataExport);

    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 14 },  // Folio
      { wch: 16 },  // Ticket Asociado
      { wch: 28 },  // Cliente
      { wch: 22 },  // Ubicación / Sitio
      { wch: 18 },  // Modelo
      { wch: 18 },  // No. Serie
      { wch: 18 },  // Tipo de Servicio
      { wch: 16 },  // Estado
      { wch: 24 },  // Técnico Asignado
      { wch: 16 },  // Fecha de Orden
      { wch: 16 },  // Fecha Creación
      { wch: 35 },  // Descripción / Falla
      { wch: 35 },  // Trabajos Realizados
      { wch: 14 }   // Horómetro
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Órdenes de Servicio');
    XLSX.writeFile(wb, filename);

    if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} órdenes de servicio a Excel (${filename}).`, 'success');
    }
  } else {
    // Fallback a CSV UTF-8 con BOM
    const headers = Object.keys(dataExport[0]);
    let csv = '\uFEFF' + headers.join(',') + '\n';
    dataExport.forEach(row => {
      const line = headers.map(h => `"${String(row[h] !== undefined && row[h] !== null ? row[h] : '').replace(/"/g, '""')}"`).join(',');
      csv += line + '\n';
    });

    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ordenes_Servicio_Eurorep_${fechaHoy}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} órdenes de servicio a CSV.`, 'success');
    }
  }

  return dataExport;
}

// Asignación al objeto global window para interoperabilidad en navegador clásico
if (typeof window !== 'undefined') {
  window.OrdenesListado = {
    filtroEstadoServicios,
    filtroTicketsV2,
    currentOrdSortCol,
    currentOrdSortDir,
    setFiltroEstadoServicios,
    setFiltroTicketsV2,
    toggleSortOrdenes,
    renderTabla,
    badgeEstado,
    filtrarOrdenes,
    exportarOrdenesAExcel,
    cargarMasOrdenes,
    mostrarTodasLasOrdenes,
    resetOrdenPageLimit
  };
  window.filtroEstadoServicios = filtroEstadoServicios;
  window.filtroTicketsV2 = filtroTicketsV2;
  window.currentOrdSortCol = currentOrdSortCol;
  window.currentOrdSortDir = currentOrdSortDir;
  window.setFiltroEstadoServicios = setFiltroEstadoServicios;
  window.setFiltroTicketsV2 = setFiltroTicketsV2;
  window.toggleSortOrdenes = toggleSortOrdenes;
  window.renderTabla = renderTabla;
  window.badgeEstado = badgeEstado;
  window.filtrarOrdenes = filtrarOrdenes;
  window.exportarOrdenesAExcel = exportarOrdenesAExcel;
  window.cargarMasOrdenes = cargarMasOrdenes;
  window.mostrarTodasLasOrdenes = mostrarTodasLasOrdenes;
  window.resetOrdenPageLimit = resetOrdenPageLimit;
  window.safeGetFilteredOrders = safeGetFilteredOrders;
}

export {
  filtroEstadoServicios,
  filtroTicketsV2,
  currentOrdSortCol,
  currentOrdSortDir,
  setFiltroEstadoServicios,
  setFiltroTicketsV2,
  toggleSortOrdenes,
  renderTabla,
  badgeEstado,
  filtrarOrdenes,
  exportarOrdenesAExcel,
  cargarMasOrdenes,
  mostrarTodasLasOrdenes,
  resetOrdenPageLimit,
  safeGetFilteredOrders
};
