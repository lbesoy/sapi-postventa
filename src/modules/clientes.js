/**
 * Módulo de Clientes y Gestión de Maquinaria - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { cleanMojibake, normStr, safeFormatDate, formatFechaHoraAmigable, urlToDataUri } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";


// Variables de estado del módulo
if (typeof window !== "undefined") {
  window.currentCliView = window.currentCliView || "galeria";
  window.currentPageClientes = window.currentPageClientes || 1;
  window.CLIENTES_PER_PAGE = window.CLIENTES_PER_PAGE || 25;
  window.currentCliSortCol = window.currentCliSortCol || "reciente";
  window.currentCliSortDir = window.currentCliSortDir || "desc";
  window.currentDesgSortCol = window.currentDesgSortCol || "fecha";
  window.currentDesgSortDir = window.currentDesgSortDir || "asc";
  window.currentDesgloseData = window.currentDesgloseData || [];
}

// ===== CLIENTES =====
let currentCliView = 'galeria';

function setCliView(view) {
  currentCliView = view;
  document.getElementById('btn-cli-galeria').style.background = view === 'galeria' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-cli-galeria').style.color = view === 'galeria' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-cli-galeria').style.borderColor = view === 'galeria' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('btn-cli-lista').style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-cli-lista').style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-cli-lista').style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('clientes-grid').style.display = view === 'galeria' ? 'grid' : 'none';
  document.getElementById('clientes-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
}

// ==========================================
// DESGLOSE SAP (ÓRDENES ABIERTAS)
// ==========================================
async function abrirDesgloseSAP(cardCode, cardName) {
  if(!cardCode || cardCode === 'N/A') return;
  
  const modal = document.getElementById('modal-desglose-sap');
  const tbody = document.getElementById('desglose-sap-tbody');
  const title = document.getElementById('desglose-sap-title');
  const totalSpan = document.getElementById('desglose-sap-total');
  
  if(!modal || !tbody) return;
  
  title.textContent = `Saldo pedido cliente: ${cardCode} - ${cardName}`;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><div class="spinner"></div><p style="margin-top:1rem; color:var(--text-muted);">Consultando SAP SBO_SAPI...</p></td></tr>`;
  totalSpan.textContent = '$0.00';
  modal.style.display = 'flex';
  
  try {
    const response = await fetchSapApi(`/clientes/${cardCode}/ordenes`);
    if(!response.ok) throw new Error('Error en SAP');
    const rawData = await response.json();
    
    // Calcular Open Amount en base a las líneas del documento
    currentDesgloseData = rawData.map(ord => {
      let openAmount = 0;
      if (ord.DocumentLines && Array.isArray(ord.DocumentLines)) {
        openAmount = ord.DocumentLines.reduce((sum, line) => {
          const lineOpen = line.OpenAmount || 0;
          const lineTotal = line.LineTotal || 1;
          const lineGross = line.GrossTotal || line.LineTotal || 0;
          return sum + ((lineOpen / lineTotal) * lineGross);
        }, 0);
      }
      ord.computedOpenAmount = openAmount > 0 ? openAmount : (ord.DocTotal || 0);
      return ord;
    });
    
    // Default sort parameters
    currentDesgSortCol = 'fecha';
    currentDesgSortDir = 'asc';
    
    renderDesgloseSAP();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--red);">Error al conectar con SAP. Por favor intenta de nuevo.</td></tr>`;
  }
}

function toggleSortDesglose(col) {
  if (currentDesgSortCol === col) {
    currentDesgSortDir = currentDesgSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentDesgSortCol = col;
    currentDesgSortDir = 'asc';
  }
  renderDesgloseSAP();
}

function renderDesgloseSAP() {
  const tbody = document.getElementById('desglose-sap-tbody');
  const totalSpan = document.getElementById('desglose-sap-total');
  
  if(currentDesgloseData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--text-muted);">No hay órdenes abiertas para este cliente.</td></tr>`;
    return;
  }
  
  // Clonar para no mutar el array original (necesario para el orden default / saldo acumulado base)
  let filtrados = [...currentDesgloseData];
  
  // ORDENAMIENTO
  filtrados.sort((a, b) => {
    let valA, valB;
    if (currentDesgSortCol === 'docNum') {
      valA = parseInt(a.DocNum) || 0;
      valB = parseInt(b.DocNum) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'importe') {
      valA = parseFloat(a.DocTotal) || 0;
      valB = parseFloat(b.DocTotal) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'openAmount') {
      valA = parseFloat(a.computedOpenAmount) || 0;
      valB = parseFloat(b.computedOpenAmount) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'fecha') {
      valA = new Date(a.DocDate || 0).getTime();
      valB = new Date(b.DocDate || 0).getTime();
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else {
      valA = (a.Comments || '').toLowerCase();
      valB = (b.Comments || '').toLowerCase();
      if (valA < valB) return currentDesgSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return currentDesgSortDir === 'asc' ? 1 : -1;
      return 0;
    }
  });

  // Actualizar iconos de ordenamiento
  ['fecha', 'docNum', 'comments', 'importe', 'openAmount'].forEach(col => {
    const icon = document.getElementById('sort-icon-desg-' + col);
    if (icon) {
      const isCurrent = currentDesgSortCol === col;
      const iconName = isCurrent ? (currentDesgSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-desg-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  let saldoAcumulado = 0;
  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  const formatDate = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  tbody.innerHTML = filtrados.map(ord => {
    const importe = ord.DocTotal || 0;
    const saldoPendiente = ord.computedOpenAmount || 0;
    saldoAcumulado += saldoPendiente;
    return `
      <tr>
        <td>${formatDate(ord.DocDate)}</td>
        <td style="font-weight:600; color:var(--text-primary);">${ord.DocNum}</td>
        <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${ord.Comments || ''}">${ord.Comments || '-'}</td>
        <td style="text-align:right;">${formatMoney(importe)}</td>
        <td style="text-align:right; font-weight:600;">${formatMoney(saldoPendiente)}</td>
        <td style="text-align:right; font-weight:600; color:var(--accent);">${formatMoney(saldoAcumulado)}</td>
      </tr>
    `;
  }).join('');
  
  totalSpan.textContent = formatMoney(saldoAcumulado);
  
  if(window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }
}
function cerrarDesgloseSAP() {
  const modal = document.getElementById('modal-desglose-sap');
  if(modal) modal.style.display = 'none';
}

function toggleSortClientes(col) {
  if (currentCliSortCol === col) {
    currentCliSortDir = currentCliSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentCliSortCol = col;
    currentCliSortDir = 'asc';
  }
  renderClientes();
}

function calcularDisponibilidadFlota(maquinasList, ordenesList = (typeof ordenes !== "undefined" ? ordenes : [])) {
  const list = maquinasList || [];
  if (list.length === 0) {
    return { total: 0, operativos: 0, mantenimiento: 0, porcentaje: 100, color: 'var(--green, #10b981)' };
  }

  const activeOrders = (ordenesList || []).filter(o => {
    const est = (o.estado || '').toLowerCase().trim();
    return est && !['completado', 'cerrada', 'cerrado'].includes(est);
  });

  const maintSet = new Set();
  activeOrders.forEach(o => {
    const match = list.find(m => {
      const idKey = m.id || m.idInterno || m.uniqueId;
      if (idKey && (idKey === o.maquinaria_id || idKey === o.maquina)) return true;
      if (m.idInterno && (m.idInterno === o.maquinaria_id || m.idInterno === o.maquina)) return true;
      if (m.serie && m.serie !== 'N/A' && (m.serie === o.maquinaria_id || m.serie === o.maquina || m.serie === o.serie)) return true;
      const equipoString = o.equipo || '';
      const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
      return names.some(name => {
        return (
          (m.idInterno && name.includes(`[${m.idInterno}]`)) ||
          (m.serie && m.serie !== 'N/A' && name.includes(`(SN: ${m.serie})`)) ||
          (m.idInterno && name === m.idInterno) ||
          (m.serie && m.serie !== 'N/A' && name === m.serie)
        );
      });
    });
    if (match) {
      maintSet.add(match.idInterno || match.uniqueId || match.id || match.serie);
    }
  });

  const total = list.length;
  const mantenimiento = maintSet.size;
  const operativos = Math.max(0, total - mantenimiento);
  const porcentaje = Math.round((operativos / total) * 100);

  let color = 'var(--green, #10b981)';
  if (porcentaje < 80) color = 'var(--red, #ef4444)';
  else if (porcentaje < 100) color = 'var(--orange, #E8820C)';

  return { total, operativos, mantenimiento, porcentaje, color };
}
if (typeof window !== "undefined") window.calcularDisponibilidadFlota = calcularDisponibilidadFlota;

function renderClientes() {
  const grid = document.getElementById('clientes-grid');
  const tbody = document.getElementById('clientes-table-body');
  const paginationContainer = document.getElementById('clientes-pagination');
  
  const btnFusionar = document.getElementById('btn-fusionar-clientes');
  if (btnFusionar) {
    const isAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
    btnFusionar.style.display = isAdmin ? 'flex' : 'none';
  }
  
  // Eliminado el auto-sync bloqueante. Cargamos directamente la caché local.
  // Combina clientes legacy (de las órdenes) con clientes registrados
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente) {
      if (!legacyMap.has(o.cliente)) {
        legacyMap.set(o.cliente, { nombre: o.cliente, ubicacion: o.ubicacion, legacy: true });
      }
    }
  });

  const mergedClientes = [...clientesDb];
  
  // Incluir usuarios que son empresas o clientes, agrupándolos por su empresa
  usuarios.forEach(u => {
    if (u.rol === 'empresa' || u.rol === 'cliente' || u.rol === 'cliente-consultor') {
      const nomEmpresa = u.empresa || u.nombre; // Fallback for old users
      if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (nomEmpresa || '').toLowerCase())) {
        mergedClientes.push({ nombre: nomEmpresa, id: u.id, ubicacion: 'Usuario registrado' });
      }
    }
  });

  legacyMap.forEach((legacyClient) => {
    if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (legacyClient.nombre || '').toLowerCase())) {
      mergedClientes.push(legacyClient);
    }
  });

  const searchText = (document.getElementById('busqueda-cliente')?.value || '').toLowerCase().trim();
  let filtrados = mergedClientes;
  
  if (searchText) {
    filtrados = filtrados.filter(c => 
      (c.nombre || '').toLowerCase().includes(searchText) || 
      (c.rfc || '').toLowerCase().includes(searchText) ||
      (c.email && c.email.toLowerCase().includes(searchText))
    );
  }

  if (!filtrados.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">No se encontraron clientes.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="padding:2rem;">No se encontraron clientes.</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  
  // ORDENAMIENTO
  if (currentCliSortCol !== 'reciente') {
    filtrados.sort((a, b) => {
      let valA = a[currentCliSortCol] || '';
      let valB = b[currentCliSortCol] || '';
      
      if (currentCliSortCol === 'saldoCuenta' || currentCliSortCol === 'saldoOrdenes') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return currentCliSortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentCliSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentCliSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }
  
  // Actualizar iconos de ordenamiento
  ['id', 'nombre', 'rfc', 'contacto', 'email', 'telefono', 'grupoSinergia', 'saldoCuenta', 'saldoOrdenes'].forEach(col => {
    const icon = document.getElementById('sort-icon-cli-' + col);
    if (icon) {
      const isCurrent = currentCliSortCol === col;
      const iconName = isCurrent ? (currentCliSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-cli-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });
  
  // Asegurarnos de que lucide actualice los nuevos iconos inyectados
  if(window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }

  // PAGINACIÓN
  const totalPages = Math.ceil(filtrados.length / CLIENTES_PER_PAGE);
  if (currentPageClientes > totalPages) currentPageClientes = totalPages;
  if (currentPageClientes < 1) currentPageClientes = 1;
  
  const startIndex = (currentPageClientes - 1) * CLIENTES_PER_PAGE;
  const paginatedClientes = filtrados.slice(startIndex, startIndex + CLIENTES_PER_PAGE);

  // RENDERIZAR KPI BANNER DE DISPONIBILIDAD DE FLOTA EN CATÁLOGO DE CLIENTES
  const cliKpiEl = document.getElementById('cli-kpis-flota-container');
  if (cliKpiEl) {
    let allMachinesTotal = [...maquinariaDb];
    clientesDb.forEach(c => {
      if (c.maquinas) {
        c.maquinas.forEach(m => {
          if (!allMachinesTotal.some(sm => sm.idInterno === m.idInterno || (m.serie && m.serie !== 'N/A' && sm.serie === m.serie))) {
            allMachinesTotal.push(m);
          }
        });
      }
    });

    const globalDisp = calcularDisponibilidadFlota(allMachinesTotal, ordenes);
    cliKpiEl.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: conic-gradient(${globalDisp.color} 0% ${globalDisp.porcentaje}%, var(--bg-hover, #1f2937) ${globalDisp.porcentaje}% 100%); display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-card, #111827); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--text-primary);">
              <span>${globalDisp.porcentaje}%</span>
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="activity" style="width: 14px; height: 14px; color: ${globalDisp.color};"></i>
              Disponibilidad de la Flota (Global)
            </div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-top: 0.15rem;">
              ${globalDisp.operativos} / ${globalDisp.total} Equipos Operativos
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap;">
          <div style="background: var(--bg-secondary); padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); border-left: 3px solid var(--green);">
            <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Operando</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--green);">${globalDisp.operativos}</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); border-left: 3px solid ${globalDisp.mantenimiento > 0 ? 'var(--red)' : 'var(--border)'};">
            <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">En Mantenimiento</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: ${globalDisp.mantenimiento > 0 ? 'var(--red)' : 'var(--text-muted)'};">${globalDisp.mantenimiento}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // RENDERIZAR CABECERAS PERSONALIZADAS
  const trHeader = document.querySelector('#clientes .data-table thead tr');
  if (trHeader) {
    trHeader.querySelectorAll('.custom-th').forEach(el => el.remove());
    if (configData.mappings?.clientes?.customCols) {
      configData.mappings.clientes.customCols.forEach(col => {
        const th = document.createElement('th');
        th.className = 'custom-th';
        th.textContent = col.label;
        // Insert before the last column (Maquinaria/Acciones) if we want, or just append
        trHeader.insertBefore(th, trHeader.lastElementChild);
      });
    }
  }

  // RENDERIZAR CUADRÍCULA
  grid.innerHTML = paginatedClientes.map(c => {
    const qtyOrdenes = ordenes.filter(x => x.cliente === c.nombre).length;
    
    // Contar máquinas combinadas (SAP + manuales) y calcular disponibilidad del cliente
    const maqClient = maquinariaDb.filter(m => m.cliente === c.nombre || (c.id && m.cliente === c.id) || (c.rfc && m.cliente === c.rfc));
    let clientMachinesList = [...maqClient];
    (c.maquinas || []).forEach(m => {
       if (!clientMachinesList.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno)) {
           clientMachinesList.push(m);
       }
    });
    const totalMaquinas = clientMachinesList.length;

    let maquinasText = '';
    if (totalMaquinas > 0) {
      const dispInfo = calcularDisponibilidadFlota(clientMachinesList, ordenes);
      maquinasText = `
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem; display:flex; align-items:center; justify-content:space-between;">
          <span><i data-lucide="settings-2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:0.2rem;"></i> ${totalMaquinas} máquina(s)</span>
          <span class="badge" style="font-size:0.7rem; font-weight:700; background:${dispInfo.color}18; color:${dispInfo.color}; padding:0.15rem 0.45rem; border-radius:12px;">${dispInfo.porcentaje}% Disp.</span>
        </div>
      `;
    }
    
    // Formatear moneda (SAP)
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    
    return `
      <div class="card-person" style="cursor:pointer;" onclick="verDetalleCliente(this.dataset.nombre)" data-nombre="${(c.nombre || 'Sin nombre').replace(/"/g, '&quot;')}">
        <div class="card-person-name" style="font-weight:700; margin-bottom: 0.2rem;">${c.nombre || 'Sin nombre'}</div>
        ${c.id && c.id !== 'Usuario registrado' ? `<div style="font-size:0.72rem; color:var(--accent); font-weight:600; margin-bottom:0.4rem;">${c.id} ${c.rfc && c.rfc !== 'Genérico' ? `• ${c.rfc}` : ''}</div>` : ''}
        
        <div class="card-person-sub" style="margin-bottom:0.6rem;">
          ${c.email ? `<div style="margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.email}"><i data-lucide="mail" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>${c.email}</div>` : ''}
          ${c.grupoSinergia && c.grupoSinergia !== 'N/A' ? `<div><i data-lucide="users" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>Grupo: ${c.grupoSinergia}</div>` : ''}
        </div>
        
        ${API_CONFIG.USE_SAP_BACKEND ? `
        <div style="background: var(--bg-secondary); padding: 0.6rem; border-radius: var(--radius-sm); margin-bottom: 0.6rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Saldo SAP:</span>
            <span style="font-size:0.75rem; font-weight:600; color:${c.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'};">${formatMoney(c.saldoCuenta)}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Órdenes Abiertas:</span>
            <span style="font-size:0.75rem; font-weight:600; color:var(--accent); cursor:pointer; text-decoration:underline dashed;" onclick="event.stopPropagation(); abrirDesgloseSAP('${c.id}', '${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')">${formatMoney(c.saldoOrdenes)}</span>
          </div>
        </div>` : ''}
        
        <div class="card-person-sub" style="border-top: 1px dashed var(--border); padding-top:0.6rem;">
          ${qtyOrdenes} ticket(s) en CRM
        </div>
        ${maquinasText}
      </div>
    `;
  }).join('');
  
  if (tbody) {
    tbody.innerHTML = paginatedClientes.map(c => {
      // Re-contar para la tabla (ya que el map es independiente)
      const maqClient = maquinariaDb.filter(m => m.cliente === c.nombre || (c.id && m.cliente === c.id) || (c.rfc && m.cliente === c.rfc));
      let totalMaquinas = maqClient.length;
      (c.maquinas || []).forEach(m => {
         if (!maqClient.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno)) {
             totalMaquinas++;
         }
      });

      const qtyOrdenes = ordenes.filter(x => x.cliente === c.nombre).length;
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      
      let customTds = '';
      if (configData.mappings?.clientes?.customCols) {
        configData.mappings.clientes.customCols.forEach(col => {
          customTds += `<td style="font-size:0.85rem;">${c.customData && c.customData[col.label] ? c.customData[col.label] : 'N/A'}</td>`;
        });
      }

      return `
        <tr onclick="verDetalleCliente('${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')" style="cursor:pointer;" class="table-row-hover">
          <td>
            ${c.id && c.id !== 'Usuario registrado' && c.id !== 'N/A' ? `<div style="font-family:monospace; font-weight:600; color:var(--accent); background:var(--bg-secondary); padding:0.2rem 0.5rem; border-radius:4px; display:inline-block; font-size:0.85rem;">${c.id}</div>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
          </td>
          <td style="font-weight:600; color:var(--text-primary);">${c.nombre || 'Sin nombre'}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${c.rfc && c.rfc !== 'Genérico' ? c.rfc : 'N/A'}</td>
          <td style="font-size:0.85rem;">${c.contacto || 'N/A'}</td>
          <td>
            <div style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.email || ''}">
              ${c.email && c.email !== 'N/A' ? `<span style="font-size:0.85rem;">${c.email}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
            </div>
          </td>
          <td>
            <div style="white-space:nowrap;">
              ${c.telefono && c.telefono !== 'N/A' ? `<span style="font-size:0.85rem;">${c.telefono}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
            </div>
          </td>
          <td>${c.grupoSinergia && c.grupoSinergia !== 'N/A' ? `<span class="badge" style="background:var(--bg-hover); color:var(--text-primary); border:1px solid var(--border);">${c.grupoSinergia}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
          <td style="font-weight:600; color:${c.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'}; text-align:right;">${API_CONFIG.USE_SAP_BACKEND ? formatMoney(c.saldoCuenta) : '<span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">N/A</span>'}</td>
          <td style="font-weight:600; color:var(--accent); text-align:right;" onclick="event.stopPropagation(); abrirDesgloseSAP('${c.id}', '${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')">
            ${API_CONFIG.USE_SAP_BACKEND ? `<span style="border-bottom: 1px dashed var(--accent); cursor:pointer;">${formatMoney(c.saldoOrdenes)}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">N/A</span>'}
          </td>
          ${customTds}
          <td style="text-align:center;"><span class="badge" style="background:var(--blue-light); color:var(--blue);">${totalMaquinas}</span></td>
        </tr>
      `;
    }).join('');
  }
  
  // RENDERIZAR CONTROLES DE PAGINACIÓN
  if (paginationContainer) {
    if (totalPages > 1) {
      paginationContainer.innerHTML = `
        <button class="btn-secondary" style="padding:0.4rem 0.8rem; border-radius:var(--radius-sm);" ${currentPageClientes === 1 ? 'disabled' : ''} onclick="currentPageClientes--; renderClientes();">Anterior</button>
        <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">Página ${currentPageClientes} de ${totalPages}</span>
        <button class="btn-secondary" style="padding:0.4rem 0.8rem; border-radius:var(--radius-sm);" ${currentPageClientes === totalPages ? 'disabled' : ''} onclick="currentPageClientes++; renderClientes();">Siguiente</button>
      `;
    } else {
      paginationContainer.innerHTML = '';
    }
  }

  lucide.createIcons();
}

// ===== MODAL DETALLE DE CLIENTE =====
function verDetalleCliente(nombre) {
  currentViewClientName = nombre;
  const clienteOb = clientesDb.find(c => c.nombre === nombre);
  const legacyOrd = ordenes.filter(o => o.cliente === nombre);
  const clienteTks = tickets.filter(t => t.cliente === nombre || t.solicitante === nombre);
  
  const body = document.getElementById('detalle-cliente-body');
  const syncBtn = document.getElementById('btn-sync-single-client');
  if (syncBtn) syncBtn.style.display = API_CONFIG.USE_SAP_BACKEND ? 'flex' : 'none';
  
  // Información General
  let html = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Empresa</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${nombre}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ubicación</div>
        <div style="font-weight: 500; color: var(--text-primary);">${clienteOb?.ubicacion || legacyOrd[0]?.ubicacion || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">RFC</div>
        <div style="font-weight: 500; color: var(--text-primary);">${clienteOb?.rfc || 'N/A'}</div>
      </div>
    </div>
  `;

  if (clienteOb?.contacto || clienteOb?.email || clienteOb?.telefono) {
    html += `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding-left: 0.5rem; border-left: 2px solid var(--accent);">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Contacto Principal</div>
          <div style="font-weight: 500;">${clienteOb.contacto || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Teléfono</div>
          <div style="font-weight: 500;">${clienteOb.telefono || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Correo</div>
          <div style="font-weight: 500;">${clienteOb.email || 'N/A'}</div>
        </div>
        </div>
      </div>
    `;
  }

  // Información SAP
  if (API_CONFIG.USE_SAP_BACKEND && clienteOb) {
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    html += `
      <div style="background: var(--bg-body); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border); border-left: 3px solid var(--accent); position:relative; margin-top: 1.5rem;">
        <div style="position:absolute; top:-12px; left:12px; background:var(--bg-body); padding:0 8px; display:flex; align-items:center;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg" alt="SAP" style="height: 24px;">
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">ID (CardCode)</div>
            <div style="font-weight: 600; color: var(--text-primary); font-family: monospace;">${clienteOb.id || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Grupo</div>
            <div style="font-weight: 600; color: var(--text-primary);">${clienteOb.grupoSinergia || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Saldo SAP</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: ${clienteOb.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'};">${formatMoney(clienteOb.saldoCuenta)}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Abiertas</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${formatMoney(clienteOb.saldoOrdenes)}</div>
          </div>
`;

    // Inyectar columnas personalizadas de Clientes si existen
    if (clienteOb.customData) {
      Object.entries(clienteOb.customData).forEach(([label, value]) => {
        html += `
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${label}</div>
            <div style="font-weight: 600; color: var(--text-primary);">${value || 'N/A'}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  // Mostrar Personal Asignado
  let supNombre = 'N/A';
  let tecNombre = 'N/A';
  if (clienteOb) {
    if (clienteOb.supervisoresAsignados && clienteOb.supervisoresAsignados.length > 0) {
      supNombre = clienteOb.supervisoresAsignados.map(id => usuarios.find(x => x.id === id)?.nombre || id).filter(Boolean).join(', ') || 'N/A';
    } else if (clienteOb.supervisorAsignado) { // Legacy single support
      const u = usuarios.find(x => x.id === clienteOb.supervisorAsignado);
      if (u) supNombre = u.nombre;
    }
    
    if (clienteOb.tecnicosAsignados && clienteOb.tecnicosAsignados.length > 0) {
      tecNombre = clienteOb.tecnicosAsignados.map(id => usuarios.find(x => x.id === id)?.nombre || id).filter(Boolean).join(', ') || 'N/A';
    } else if (clienteOb.tecnicoAsignado) { // Legacy single support
      const u = usuarios.find(x => x.id === clienteOb.tecnicoAsignado);
      if (u) tecNombre = u.nombre;
    }
  }

  const isAdmin = currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin';
  const isSupervisorOrAdmin = isAdmin || currentSession.viewMode === 'supervisor';
  
  const editSupHtml = isAdmin ? `<i data-lucide="edit-2" style="width:14px;height:14px;cursor:pointer;color:var(--accent);margin-left:auto;" onclick="document.getElementById('disp-sup').style.display='none'; document.getElementById('edit-sup').style.display='block';"></i>` : '';
  const editTecHtml = isSupervisorOrAdmin ? `<i data-lucide="edit-2" style="width:14px;height:14px;cursor:pointer;color:var(--accent);margin-left:auto;" onclick="document.getElementById('disp-tec').style.display='none'; document.getElementById('edit-tec').style.display='block';"></i>` : '';

  const supOptions = `<option value="">-- Sin Asignar --</option>` + usuarios.filter(u=>u.rol==='supervisor').map(u=>`<option value="${u.id}" ${clienteOb?.supervisoresAsignados?.includes(u.id)?'selected':''}>${u.nombre}</option>`).join('');
  const tecOptions = `<option value="">-- Sin Asignar --</option>` + usuarios.filter(u=>u.rol==='tecnico').map(u=>`<option value="${u.id}" ${clienteOb?.tecnicosAsignados?.includes(u.id)?'selected':''}>${u.nombre}</option>`).join('');

  html += `
    <div style="margin-top:1rem; background: var(--bg-card); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; display:flex; align-items:center;"><i data-lucide="user-check" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i> Supervisor Asignado ${editSupHtml}</div>
        <div style="font-weight: 500; color: var(--text-primary); margin-top:0.25rem;" id="disp-sup">${supNombre}</div>
        <div id="edit-sup" style="display:none; margin-top:0.5rem;">
          <select style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid var(--border); font-size:0.85rem; background:var(--bg-body); color:var(--text-primary);" onchange="guardarPersonalCliente('${nombre.replace(/'/g, "\\'")}', 'supervisor', this.value)">
            ${supOptions}
          </select>
        </div>
      </div>
    </div>
  `;

  // Sitios
  let sitios = getNombresDeSitiosParaCliente(clienteOb || nombre);
  if (sitios.length === 0) sitios = ['Sede Principal'];

  html += `
    <div style="margin-top: 1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
        <h3 style="font-size:1rem; margin:0; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="map-pin" style="width:18px;height:18px;color:var(--text-muted);"></i> Sitios Registrados</h3>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; height: auto;" onclick="agregarSitioCliente('${nombre.replace(/'/g, "\\'")}')">+ Agregar Sitio</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
        ${sitios.map((s, idx) => {
          const sNombre = getSitioNombre(s);
          return `
          <span style="background:var(--bg-hover); padding:0.4rem 0.8rem; border-radius:1rem; border:1px solid var(--border); font-size:0.85rem; font-weight:500; color:var(--text-primary); display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;" onclick="abrirDetalleSitio('${sNombre.replace(/'/g, "\\'")}')" title="Ver detalle del sitio">
            ${sNombre}
          </span>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Máquinas
  let allClientMachines = [];
  
  // 1. Agregar de maquinariaDb (SAP/Supabase)
  const maqClient = maquinariaDb.filter(m => m.cliente === nombre || (clienteOb?.id && m.cliente === clienteOb.id) || (clienteOb?.rfc && m.cliente === clienteOb.rfc));
  maqClient.forEach(m => {
      allClientMachines.push({
          idInterno: m.idInterno || m.id || m.serie || 'N/A',
          uniqueId: m.id || m.idInterno,
          marca: m.marca || '',
          modelo: m.modelo || m.descripcion || 'Sin Modelo',
          serie: m.serie || 'N/A',
          anio: m.anio || 'N/A',
          venta: m.venta || m.customData?.venta || '',
          ubicacion: m.ubicacion || m.customData?.ubicacion || m.cliente || 'N/A'
      });
  });

  // 2. Combinar con máquinas manuales (clientesDb)
  (clienteOb?.maquinas || []).forEach(m => {
      const isDuplicate = maqClient.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno);
      if (!isDuplicate) {
          allClientMachines.push({
              idInterno: m.idInterno || 'N/A',
              uniqueId: m.idInterno,
              marca: m.marca || '',
              modelo: m.modelo || m.descripcion || 'Sin Modelo',
              serie: m.serie || 'N/A',
              anio: m.anio || 'N/A',
              venta: m.venta || m.customData?.venta || '',
              ubicacion: m.ubicacion || m.customData?.ubicacion || nombre || 'N/A'
          });
      }
  });

  if (allClientMachines.length > 0) {
    // Calcular Disponibilidad de la Flota para este cliente específico
    const activeClientOrders = ordenes.filter(o => o.cliente === nombre && o.estado && !['completado', 'cerrada', 'cerrado'].includes(o.estado.toLowerCase().trim()));
    const clientMachinesInMaint = new Set();
    activeClientOrders.forEach(o => {
      const match = allClientMachines.find(m => {
        if (m.idInterno === o.maquinaria_id || m.uniqueId === o.maquinaria_id || m.idInterno === o.maquina || m.uniqueId === o.maquina) return true;
        const equipoString = o.equipo || '';
        const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
        return names.some(name => {
          return (
            (m.idInterno && name.includes(`[${m.idInterno}]`)) ||
            (m.serie && name.includes(`(SN: ${m.serie})`)) ||
            name === m.idInterno ||
            name === m.serie
          );
        });
      });
      if (match) {
        clientMachinesInMaint.add(match.idInterno || match.uniqueId || match.serie);
      }
    });

    const clientTotal = allClientMachines.length;
    const clientMaint = clientMachinesInMaint.size;
    const clientOp = Math.max(0, clientTotal - clientMaint);
    const clientAvailability = clientTotal > 0 ? Math.round((clientOp / clientTotal) * 100) : 100;

    let ringColor = 'var(--green, #10b981)';
    if (clientAvailability < 80) ringColor = 'var(--red, #ef4444)';
    else if (clientAvailability < 100) ringColor = 'var(--orange, #E8820C)';

    html += `
      <div style="background: var(--bg-hover); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; align-items: center; gap: 1.5rem; margin-top: 1.5rem;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: conic-gradient(${ringColor} 0% ${clientAvailability}%, var(--bg-body, #1f2937) ${clientAvailability}% 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--bg-card, #111827); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: var(--text-primary);">
            <span>${clientAvailability}%</span>
            <span style="font-size:0.55rem; color:var(--text-muted); font-weight:normal;">DISP</span>
          </div>
        </div>
        <div>
          <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Disponibilidad de la Flota</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-top:0.15rem;">${clientOp} / ${clientTotal} Equipos Operativos</div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.1rem;">
            ${clientMaint > 0 ? `Hay ${clientMaint} equipo(s) fuera de servicio por mantenimiento activo.` : 'Todos los equipos del cliente operan normalmente.'}
          </div>
        </div>
      </div>
    `;

    html += `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);"><i data-lucide="settings-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Maquinaria Registrada</h3>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${allClientMachines.map(m => {
            const logoPath = getLogoMarca(m.marca);
            const callArgs = `'${(m.idInterno && m.idInterno !== 'N/A') ? m.idInterno : (m.uniqueId || '')}', '${m.serie || ''}', '${m.marca || ''}', '${m.modelo || ''}', '${nombre || ''}', '${m.ubicacion || ''}'`;
            return `
            <div onclick="verServiciosMaquina(${callArgs.replace(/"/g, '&quot;')})" style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.5rem; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
              <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary); display:flex; align-items:center;">
                ${logoPath ? `<img src="${logoPath}" alt="${m.marca}" onerror="this.onerror=null; this.outerHTML='<span>${m.marca} </span>';" style="height:24px; object-fit:contain; margin-right:8px;"/>` : `${m.marca || ''} `}
                ${m.modelo || 'Sin Modelo'}
                <span style="font-size:0.75rem; background:var(--bg-body); padding:0.15rem 0.4rem; border-radius:4px; border:1px solid var(--border); margin-left:0.5rem; color:var(--text-muted); font-family:monospace; font-weight:normal;">ID: ${m.idInterno || 'N/A'}</span>
                <div style="margin-left:auto; display:flex; gap:0.25rem;">
                  <button class="action-btn" onclick="event.stopPropagation(); editarMaquina('${nombre.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Editar Máquina" style="padding:0.25rem; width:auto; height:auto;">
                    <i data-lucide="edit-2" style="width:16px;height:16px;"></i>
                  </button>
                  <button class="action-btn" onclick="event.stopPropagation(); abrirModalMoverMaquina('${nombre.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Cambiar Sitio" style="padding:0.25rem; width:auto; height:auto;">
                    <i data-lucide="map-pin" style="width:16px;height:16px;"></i>
                  </button>
                  <button class="action-btn" onclick="event.stopPropagation(); abrirModalTraspasarMaquina('${nombre.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Traspasar Maquinaria" style="padding:0.25rem; width:auto; height:auto; color:#8b5cf6;">
                    <i data-lucide="arrow-right-left" style="width:16px;height:16px;"></i>
                  </button>
                </div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Número de Serie</strong> <span style="font-weight:500;">${m.serie || 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Año de Fab.</strong> <span style="font-weight:500;">${m.anio || 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Fecha de Venta</strong> <span style="font-weight:500;">${m.venta ? m.venta.split('-').reverse().join('/') : 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Ubicación</strong> <span style="font-weight:500;">${m.ubicacion || 'N/A'}</span></div>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Historial fusionado de Órdenes y Tickets
  const clienteTicketIds = clienteTks.map(t => t.id);
  const clienteOrd = ordenes.filter(o => o.cliente === nombre || (o.soporte && clienteTicketIds.includes(o.soporte)));

  let historial = [];

  const formatDateOnly = (dateStr) => {
    return formatFechaHoraAmigable(dateStr);
  };

  clienteTks.forEach(t => {
     let ordenesDelTicket = clienteOrd.filter(o => o.soporte === t.id);
     historial.push({
        tipo: 'ticket',
        fechaStr: t.fechaCreacion,
        obj: t,
        ordenesLigadas: ordenesDelTicket
     });
  });

  clienteOrd.forEach(o => {
     if (!clienteTks.some(t => t.id === o.soporte)) {
        historial.push({
           tipo: 'orden_independiente',
           fechaStr: o.fecha,
           obj: o
        });
     }
  });

  historial.sort((a, b) => {
     let d1 = a.fechaStr ? new Date(a.fechaStr) : new Date(0);
     let d2 = b.fechaStr ? new Date(b.fechaStr) : new Date(0);
     return d2 - d1;
  });

  let activos = [];
  let cerrados = [];

  historial.forEach(item => {
     let isClosed = false;
     if (item.tipo === 'ticket') {
        const t = item.obj;
        const ordenes = item.ordenesLigadas;
        const tClosed = t.estado === 'Cerrado';
        const allOrdersClosed = ordenes.every(o => (o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado');
        if (tClosed && allOrdersClosed) isClosed = true;
     } else {
        const o = item.obj;
        if ((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado') isClosed = true;
     }
     
     if (isClosed) cerrados.push(item);
     else activos.push(item);
  });

  const renderItem = (item) => {
     if (item.tipo === 'ticket') {
       const t = item.obj;
       const ordenes = item.ordenesLigadas;
       return `
         <div onclick="verDetalleTicket('${t.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div style="display:flex; justify-content:space-between; align-items:flex-start;">
             <div>
               <div style="display:flex; align-items:center; gap:0.4rem;">
                 <i data-lucide="ticket" style="width:14px;height:14px;color:var(--text-muted);"></i>
                 <span style="font-weight:600; color:var(--text-primary);">${t.asunto || 'Sin título'}</span>
               </div>
               <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
                 # ${t.folio || t.id.substring(0,8)} - ${formatDateOnly(t.fechaCreacion)}
               </div>
             </div>
             <span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span>
           </div>
           ${ordenes.map(o => `
             <div onclick="event.stopPropagation(); verDetalle('${o.id}')" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6';" onmouseout="this.style.opacity='1';">
                <div>
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
                    <span style="font-weight:500; color:var(--accent); font-size:0.9rem;">Orden #${o.folio || '-'}</span>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                     ${formatDateOnly(o.fecha)}
                  </div>
                </div>
                <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}" style="font-size:0.7rem; padding:0.2rem 0.4rem;">${o.estado||'Pendiente'}</span>
             </div>
           `).join('')}
         </div>
       `;
     } else {
        const o = item.obj;
        return `
          <div onclick="verDetalle('${o.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
            <div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
                <span style="font-weight:500; color:var(--accent);">Orden #${o.folio || '-'}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
                ${formatDateOnly(o.fecha)}
              </div>
            </div>
            <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}">${o.estado||'Pendiente'}</span>
          </div>
        `;
      }
  };

  if (historial.length > 0) {
    html += `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);"><i data-lucide="layers" style="width:18px;height:18px;color:var(--text-muted);"></i> Historial de Servicios (${historial.length})</h3>
        <div style="display:flex; flex-direction:column;">
          ${activos.map(renderItem).join('')}
          <div style="margin-top: 0.2rem; margin-bottom: 0.5rem; text-align: center;">
             <button type="button" onclick="const div = document.getElementById('cliente-historial-cerrados'); div.style.display = div.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('i') || this.querySelector('svg'); if(div.style.display==='none'){ icon && icon.setAttribute('data-lucide', 'chevron-down'); } else { icon && icon.setAttribute('data-lucide', 'chevron-up'); } if(this.querySelector('i')) lucide.createIcons();" style="background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; font-weight: 500; transition: background 0.2s;">
                Ver completados (${cerrados.length}) <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
             </button>
          </div>
          <div id="cliente-historial-cerrados" style="display:none;">
             ${cerrados.length > 0 ? cerrados.map(renderItem).join('') : '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No hay servicios completados aún.</div>'}
          </div>
        </div>
      </div>
    `;
  }


  body.innerHTML = html;
  document.getElementById('modal-detalle-cliente-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleMaquina(e) {
  if (e && e.target !== document.getElementById('modal-detalle-maquina-overlay')) return;
  document.getElementById('modal-detalle-maquina-overlay').classList.remove('open');
}

function abrirDetalleSitio(sitioNombre) {
  const sitioOb = sitiosDb.find(s => s.nombre === sitioNombre);
  const body = document.getElementById('detalle-sitio-body');
  if (!body) return;
  
  let html = '';
  
  if (sitioOb) {
    html += `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Nombre del Sitio</div>
          <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${sitioOb.nombre || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">ID de Sitio</div>
          <div style="font-weight: 500; color: var(--text-primary); font-family: monospace;">${sitioOb.id || 'N/A'}</div>
        </div>
        <div style="grid-column: span 2;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Dirección Completa</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.direccion || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ciudad / Estado</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.ciudad || ''} ${sitioOb.estado ? ', ' + sitioOb.estado : ''}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Código Postal</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.cp || 'N/A'}</div>
        </div>
      </div>
    `;
    
    if (sitioOb.customData && Object.keys(sitioOb.customData).length > 0) {
      html += `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding-left: 0.5rem; border-left: 2px solid var(--accent); margin-top:0.5rem;">
      `;
      Object.entries(sitioOb.customData).forEach(([label, value]) => {
        html += `
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${label}</div>
            <div style="font-weight: 600; color: var(--text-primary);">${value || 'N/A'}</div>
          </div>
        `;
      });
      html += `</div>`;
    }
  } else {
    html += `
      <div style="display:flex; flex-direction:column; gap:0.5rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Nombre del Sitio (Legacy)</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${sitioNombre}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Este sitio fue registrado localmente y no contiene más detalles estructurados de SAP.</div>
      </div>
    `;
  }
  
  // Extraer coordenadas
  let lat = null; let lon = null;
  if (sitioOb) {
    lat = sitioOb.latitud || sitioOb.lat || null;
    lon = sitioOb.longitud || sitioOb.lon || sitioOb.lng || null;
    if (sitioOb.customData) {
      const keys = Object.keys(sitioOb.customData);
      const kLat = keys.find(k => k.toLowerCase() === 'latitud' || k.toLowerCase() === 'lat' || k.toLowerCase() === 'u_latitud');
      const kLon = keys.find(k => k.toLowerCase() === 'longitud' || k.toLowerCase() === 'lon' || k.toLowerCase() === 'lng' || k.toLowerCase() === 'u_longitud');
      if (kLat && sitioOb.customData[kLat] && !lat) lat = sitioOb.customData[kLat];
      if (kLon && sitioOb.customData[kLon] && !lon) lon = sitioOb.customData[kLon];
    }
  } else {
    for (const cli of clientesDb) {
      if (cli.sitios) {
        const localSitio = cli.sitios.find(s => getSitioNombre(s) === sitioNombre);
        if (localSitio && typeof localSitio === 'object') {
          lat = localSitio.latitud || null;
          lon = localSitio.longitud || null;
          break;
        }
      }
    }
  }

  // Renderizar bloque de Coordenadas editable
  const safeNombre = sitioNombre.replace(/'/g, "\\'");
  html += `
    <div style="margin-top: 1rem; background: var(--bg-hover); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
      <div id="coordenadas-display" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap: 0.5rem;">
          ${lat && lon ? '<i data-lucide="map-pin" style="width:16px;height:16px;color:var(--accent);"></i>' : '<i data-lucide="map-pin-off" style="width:16px;height:16px;color:var(--text-muted);"></i>'}
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Coordenadas Geográficas</div>
            <div style="font-weight: 500; color: ${lat && lon ? 'var(--text-primary)' : 'var(--text-muted)'}; ${lat && lon ? 'font-family: monospace;' : 'font-size: 0.9rem;'}">${lat && lon ? `${lat}, ${lon}` : 'Sin coordenadas registradas'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${lat && lon ? `<a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" style="display:flex; align-items:center; gap:0.4rem; background: var(--accent); color: white; padding: 0.4rem 0.75rem; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 500;"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> Ver Mapa</a>` : ''}
          <button onclick="document.getElementById('coordenadas-display').style.display='none'; document.getElementById('coordenadas-edit').style.display='flex';" class="btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="edit-3" style="width:14px;height:14px;"></i> Editar</button>
        </div>
      </div>
      
      <div id="coordenadas-edit" style="display:none; flex-direction:column; gap:0.5rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border);">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Edita las coordenadas para asociarlas a este sitio. Esto actualizará también las máquinas en este sitio.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <input type="number" step="any" id="edit-sitio-lat" placeholder="Latitud" value="${lat || ''}" style="width:100%;"/>
          <input type="number" step="any" id="edit-sitio-lon" placeholder="Longitud" value="${lon || ''}" style="width:100%;"/>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
          <button type="button" onclick="const lt=document.getElementById('edit-sitio-lat').value; const ln=document.getElementById('edit-sitio-lon').value; if(lt&&ln) window.open('https://maps.google.com/?q='+lt+','+ln, '_blank'); else alert('Faltan coordenadas para probar el mapa.');" class="btn-secondary" style="padding: 0.3rem 0.75rem; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="map" style="width:14px;height:14px;"></i> Probar Mapa</button>
          <div style="display:flex; gap:0.5rem;">
            <button onclick="document.getElementById('coordenadas-edit').style.display='none'; document.getElementById('coordenadas-display').style.display='flex';" class="btn-secondary" style="padding: 0.3rem 0.75rem;">Cancelar</button>
            <button onclick="guardarCoordenadasSitio('${safeNombre}')" class="btn-primary" style="padding: 0.3rem 0.75rem;">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Maquinaria en este sitio
  const maquinas = maquinariaDb.filter(m => m.ubicacion === sitioNombre || m.sitio === sitioNombre);
  if (maquinas.length > 0) {
    html += `
      <div style="margin-top: 1rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);"><i data-lucide="settings-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Máquinas en este sitio (${maquinas.length})</h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:200px; overflow-y:auto; padding-right:0.5rem;">
          ${maquinas.map(m => `
            <div style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; background: var(--bg-body);">
              <div>
                <div style="font-weight:500; color:var(--accent);">${m.marca || ''} ${m.modelo || 'Sin Modelo'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Serie: ${m.serie || 'N/A'}</div>
              </div>
              ${m.latitud && m.longitud ? `
                <a href="https://maps.google.com/?q=${m.latitud},${m.longitud}" target="_blank" style="display:flex; align-items:center; gap:0.3rem; background: var(--bg-hover); color: var(--text-primary); padding: 0.3rem 0.5rem; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: 500; border: 1px solid var(--border);">
                  <i data-lucide="map-pin" style="width:12px;height:12px;color:var(--accent);"></i> Ver Mapa
                </a>
              ` : `
                <span style="font-size:0.7rem; color:var(--text-muted); background:var(--bg-hover); padding:0.2rem 0.4rem; border-radius:3px;">Sin coords.</span>
              `}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = html;
  document.getElementById('modal-detalle-sitio-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleSitio(e) {
  if (e && e.target !== document.getElementById('modal-detalle-sitio-overlay')) return;
  document.getElementById('modal-detalle-sitio-overlay').classList.remove('open');
}

function guardarCoordenadasSitio(sitioNombre) {
  const lat = document.getElementById('edit-sitio-lat').value.trim();
  const lon = document.getElementById('edit-sitio-lon').value.trim();
  
  if (!lat || !lon) {
    alert('Por favor ingresa latitud y longitud válidas.');
    return;
  }
  
  // 1. Actualizar en sitiosDb (si es de SAP)
  const sitioDbOb = sitiosDb.find(s => s.nombre === sitioNombre);
  if (sitioDbOb) {
    sitioDbOb.latitud = lat;
    sitioDbOb.longitud = lon;
    if (!sitioDbOb.customData) sitioDbOb.customData = {};
    sitioDbOb.customData.latitud = lat;
    sitioDbOb.customData.longitud = lon;
    
    // Guardar cambios locales de sitiosDb
    localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
    
    // Sincronizar sitio con Supabase
    if (window.pushToSupabase) {
      window.pushToSupabase('sitios', sitioDbOb);
    }
  }
  
  // 2. Actualizar en clientesDb (sitios locales)
  clientesDb.forEach(c => {
    if (c.sitios) {
      let idx = c.sitios.findIndex(s => getSitioNombre(s) === sitioNombre);
      if (idx >= 0) {
        if (typeof c.sitios[idx] === 'string') {
          c.sitios[idx] = { nombre: sitioNombre, latitud: lat, longitud: lon };
        } else {
          c.sitios[idx].latitud = lat;
          c.sitios[idx].longitud = lon;
        }
        
        // Sincronizar cliente con Supabase
        if (window.pushToSupabase) {
          window.pushToSupabase('clientes', c);
        }
      }
    }
  });
  
  // 3. Actualizar todas las máquinas en este sitio
  let changedMachines = false;
  maquinariaDb.forEach(m => {
    if (m.ubicacion === sitioNombre || m.sitio === sitioNombre) {
       m.latitud = lat;
       m.longitud = lon;
       if (!m.customData) m.customData = {};
       m.customData.latitud = lat;
       m.customData.longitud = lon;
       changedMachines = true;
       
       if (window.pushToSupabase) {
         window.pushToSupabase('maquinaria', m);
       }
    }
  });
  
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(m => {
        if (m.ubicacion === sitioNombre || m.sitio === sitioNombre) {
           m.latitud = lat;
           m.longitud = lon;
           changedMachines = true;
           
           if (window.pushToSupabase) {
             window.pushToSupabase('maquinaria', { ...m, cliente: c.id });
           }
        }
      });
    }
  });
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  if (changedMachines) {
    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
  }
  
  abrirDetalleSitio(sitioNombre);
  mostrarNotificacion('Coordenadas actualizadas exitosamente', 'success');
}

function verServiciosMaquina(idInterno, serie, marca, modelo, cliente, ubicacion) {
  const logoPath = getLogoMarca(marca);
  document.getElementById('detalle-maquina-title').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:1rem;">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <img src="logo_transparent.png" alt="Eurorep" style="height:32px; object-fit:contain; border-right:1px solid var(--border); padding-right:0.75rem;"/>
        <div style="display:flex; flex-direction:column; justify-content:center;">
          <span style="font-size:1.1rem; line-height:1.2;">${marca} ${modelo}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">ID: ${idInterno}</span>
        </div>
      </div>
      ${logoPath ? `<img src="${logoPath}" alt="${marca}" onerror="this.onerror=null; this.style.display='none';" style="height:28px; object-fit:contain; max-width:100px;"/>` : ''}
    </div>
  `;
  
  const snMatch = serie && serie !== 'N/A' ? `(SN: ${serie})` : null;
  const maqTickets = tickets.filter(t => 
    t.maquinaId === idInterno || 
    (serie && serie !== 'N/A' && t.maquinaId === serie) || 
    (snMatch && t.equipo && t.equipo.includes(snMatch)) || 
    (t.equipo && t.equipo.includes(idInterno)) ||
    (t.equipo && t.equipo === idInterno)
  );
  const maqTicketIds = maqTickets.map(t => t.id);
  const maqOrdenes = ordenes.filter(o => 
    o.maquina === idInterno || 
    (serie && serie !== 'N/A' && o.maquina === serie) || 
    o.serie === idInterno || 
    (serie && serie !== 'N/A' && o.serie === serie) || 
    (snMatch && o.equipo && o.equipo.includes(snMatch)) || 
    (o.equipo && o.equipo.includes(idInterno)) ||
    (o.equipo && o.equipo === idInterno) ||
    (o.soporte && maqTicketIds.includes(o.soporte))
  );
  
  let fechas = [];
  maqOrdenes.forEach(o => { if(o.fecha) fechas.push(new Date(o.fecha)); });
  maqTickets.forEach(t => { if(t.fechaCreacion) fechas.push(new Date(t.fechaCreacion)); });
  
  let ultimaFechaStr = 'Ninguno';
  if (fechas.length > 0) {
    const ultimaFecha = new Date(Math.max.apply(null, fechas));
    ultimaFechaStr = ultimaFecha.toISOString().split('T')[0].split('-').reverse().join('/');
  }
  
  // Siguiente Servicio
  let siguientes = [];
  maqOrdenes.forEach(o => {
    if (o.estado === 'Pendiente' || o.estado === 'En Proceso' || o.estado === 'Programado') {
      if (o.fecha) siguientes.push(new Date(o.fecha));
    }
  });
  
  let siguienteServicioStr = 'No programado';
  if (siguientes.length > 0) {
    const siguienteFecha = new Date(Math.min.apply(null, siguientes));
    siguienteServicioStr = siguienteFecha.toISOString().split('T')[0].split('-').reverse().join('/');
  } else {
    const hasPendingOrd = maqOrdenes.some(o => o.estado === 'Pendiente' || o.estado === 'En Proceso');
    const hasPendingTkt = maqTickets.some(t => t.estado === 'Abierto' || t.estado === 'En Proceso');
    if (hasPendingOrd) siguienteServicioStr = 'Por agendar (Orden)';
    else if (hasPendingTkt) siguienteServicioStr = 'Ticket abierto';
  }
  // Historial fusionado
  let historial = [];

  const formatDateOnly = (dateStr) => {
    return formatFechaHoraAmigable(dateStr);
  };

  maqTickets.forEach(t => {
     let ordenesDelTicket = maqOrdenes.filter(o => o.soporte === t.id);
     historial.push({
        tipo: 'ticket',
        fechaStr: t.fechaCreacion,
        obj: t,
        ordenesLigadas: ordenesDelTicket
     });
  });

  maqOrdenes.forEach(o => {
     if (!maqTickets.some(t => t.id === o.soporte)) {
        historial.push({
           tipo: 'orden_independiente',
           fechaStr: o.fecha,
           obj: o
        });
     }
  });

  // Buscar la máquina correspondiente en base de datos para obtener su bitácora
  let maquinaOb = maquinariaDb.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
  if (!maquinaOb) {
    for (const c of clientesDb) {
      if (c.maquinas) {
        const found = c.maquinas.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
        if (found) {
          maquinaOb = found;
          break;
        }
      }
    }
  }

  if (maquinaOb && maquinaOb.customData && Array.isArray(maquinaOb.customData.bitacora)) {
    maquinaOb.customData.bitacora.forEach(log => {
      historial.push({
        tipo: 'bitacora_traspaso',
        fechaStr: log.fecha,
        obj: log
      });
    });
  }

  historial.sort((a, b) => {
     let d1 = a.fechaStr ? new Date(a.fechaStr) : new Date(0);
     let d2 = b.fechaStr ? new Date(b.fechaStr) : new Date(0);
     return d2 - d1;
  });

  let activos = [];
  let cerrados = [];

  historial.forEach(item => {
     let isClosed = false;
     if (item.tipo === 'ticket') {
        const t = item.obj;
        const ordenes = item.ordenesLigadas;
        const tClosed = t.estado === 'Cerrado';
        const allOrdersClosed = ordenes.every(o => (o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado');
        if (tClosed && allOrdersClosed) isClosed = true;
     } else if (item.tipo === 'bitacora_traspaso') {
        isClosed = false;
     } else {
        const o = item.obj;
        if ((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado') isClosed = true;
     }
     
     if (isClosed) cerrados.push(item);
     else activos.push(item);
  });

  // Resolve latest horometer
  let horometroVal = maquinaOb?.horometro || maquinaOb?.customData?.horometro || '';
  if (!horometroVal) {
    const snMatch = serie && serie !== 'N/A' ? `(SN: ${serie})` : null;
    const sortedOrdenes = [...maqOrdenes].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    const ordenConHorometro = sortedOrdenes.find(o => o.horometro_real || o.horometro);
    if (ordenConHorometro) {
      horometroVal = ordenConHorometro.horometro_real || ordenConHorometro.horometro;
    }
  }
  const horometroStr = horometroVal && horometroVal !== 'N/A' ? `${Number(horometroVal).toLocaleString()} h` : 'N/A';
  const traspasosCount = historial.filter(item => item.tipo === 'bitacora_traspaso').length;

  let html = '';
  
  // Resumen
  html += `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; background:var(--bg-hover); padding:1rem; border-radius:var(--radius-md);">
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Serie</div>
        <div style="font-weight:500;">${serie || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Horómetro Actual</div>
        <div style="font-weight:600; color:var(--text-primary);">${horometroStr}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Cliente</div>
        <div style="font-weight:500;">${cliente || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Sitio / Ubicación</div>
        <div style="font-weight:500;">${ubicacion || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Último Servicio</div>
        <div style="font-weight:500;">${ultimaFechaStr}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Siguiente Servicio</div>
        <div style="font-weight:600; color:var(--orange);">${siguienteServicioStr}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Servicios Totales</div>
        <div style="font-weight:500; color:var(--accent); font-weight:600;">${historial.filter(item => item.tipo !== 'bitacora_traspaso').length}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Traspasos Históricos</div>
        <div style="font-weight:600; color:#8b5cf6;">${traspasosCount}</div>
      </div>
    </div>
  `;

  const renderItem = (item) => {
     if (item.tipo === 'ticket') {
       const t = item.obj;
       const ordenes = item.ordenesLigadas;
       return `
         <div onclick="verDetalleTicket('${t.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div style="display:flex; justify-content:space-between; align-items:flex-start;">
             <div>
               <div style="display:flex; align-items:center; gap:0.4rem;">
                 <i data-lucide="ticket" style="width:14px;height:14px;color:var(--text-muted);"></i>
                 <span style="font-weight:600; color:var(--text-primary);">${t.asunto || 'Sin título'}</span>
               </div>
               <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
                 # ${t.folio || t.id.substring(0,8)} - ${formatDateOnly(t.fechaCreacion)}
               </div>
             </div>
             <span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span>
           </div>
           ${ordenes.map(o => `
             <div onclick="event.stopPropagation(); verDetalle('${o.id}')" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6';" onmouseout="this.style.opacity='1';">
                <div>
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
                    <span style="font-weight:500; color:var(--accent); font-size:0.9rem;">Orden #${o.folio || '-'}</span>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                     ${formatDateOnly(o.fecha)}
                  </div>
                </div>
                <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}" style="font-size:0.7rem; padding:0.2rem 0.4rem;">${o.estado||'Pendiente'}</span>
             </div>
           `).join('')}
         </div>
       `;
     } else if (item.tipo === 'bitacora_traspaso') {
       const log = item.obj;
       return `
         <div style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:rgba(139,92,246,0.05); display:flex; justify-content:space-between; align-items:center;">
           <div>
             <div style="display:flex; align-items:center; gap:0.4rem;">
               <i data-lucide="arrow-right-left" style="width:14px;height:14px;color:#8b5cf6;"></i>
               <span style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">Traspaso de Empresa</span>
             </div>
             <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
               De <span style="font-weight:600; color:var(--text-primary);">${log.clienteAnterior}</span> a <span style="font-weight:600; color:var(--text-primary);">${log.clienteNuevo}</span>
               ${log.sitioAnterior && log.sitioNuevo && log.sitioAnterior !== log.sitioNuevo ? `<br/><span style="font-size:0.72rem; color:var(--text-muted);">Sitio: ${log.sitioAnterior} → ${log.sitioNuevo}</span>` : ''}
             </div>
             <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">
               Realizado por <strong>${log.usuario}</strong> el ${formatDateOnly(log.fecha)}
             </div>
           </div>
           <span class="badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6; border:1px solid rgba(139,92,246,0.3); font-size:0.7rem; padding:0.2rem 0.4rem; font-weight:700;">TRASPASO</span>
         </div>
       `;
     } else {
       const o = item.obj;
       return `
         <div onclick="verDetalle('${o.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div>
             <div style="display:flex; align-items:center; gap:0.4rem;">
               <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
               <span style="font-weight:500; color:var(--accent);">Orden #${o.folio || '-'}</span>
             </div>
             <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
               ${formatDateOnly(o.fecha)}
             </div>
           </div>
           <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}">${o.estado||'Pendiente'}</span>
         </div>
       `;
     }
  };

  if (historial.length > 0) {
    html += `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="layers" style="width:18px;height:18px;color:var(--text-muted);"></i> Historial de Servicios (${historial.length})</h3>
        <div style="display:flex; flex-direction:column;">
          ${activos.map(renderItem).join('')}
          <div style="margin-top: 0.2rem; margin-bottom: 0.5rem; text-align: center;">
             <button type="button" onclick="const div = document.getElementById('cliente-historial-cerrados'); div.style.display = div.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('i') || this.querySelector('svg'); if(div.style.display==='none'){ icon && icon.setAttribute('data-lucide', 'chevron-down'); } else { icon && icon.setAttribute('data-lucide', 'chevron-up'); } if(this.querySelector('i')) lucide.createIcons();" style="background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; font-weight: 500; transition: background 0.2s;">
                 Ver completados (${cerrados.length}) <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
             </button>
          </div>
          <div id="cliente-historial-cerrados" style="display:none;">
             ${cerrados.length > 0 ? cerrados.map(renderItem).join('') : '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No hay servicios completados aún.</div>'}
          </div>
        </div>
      </div>
    `;
  }
  
  if (historial.length === 0) {
    html += `<div class="empty-state" style="padding:2rem;">Esta máquina no tiene servicios registrados.</div>`;
  }
  
  document.getElementById('detalle-maquina-body').innerHTML = html;
  document.getElementById('modal-detalle-maquina-overlay').classList.add('open');
  lucide.createIcons();
}

function guardarPersonalCliente(clienteNombre, rol, userId) {
  let cliente = clientesDb.find(c => c.nombre === clienteNombre);
  if (!cliente) {
    // Si el cliente solo existe como legacy, lo creamos
    cliente = { id: crypto.randomUUID(), nombre: clienteNombre, sitios: [], maquinas: [] };
    clientesDb.push(cliente);
  }
  
  if (rol === 'supervisor') {
    cliente.supervisoresAsignados = userId ? [userId] : [];
  } else if (rol === 'tecnico') {
    cliente.tecnicosAsignados = userId ? [userId] : [];
  }
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  verDetalleCliente(clienteNombre); // Refrescar modal
}

function eliminarSitioDeClienteAdmin(clienteNombre, sitioNombre) {
  if (!confirm(`¿Estás seguro de eliminar el sitio "${sitioNombre}" de este cliente? (Los sitios de SAP no se pueden eliminar por aquí)`)) return;
  const cliente = clientesDb.find(c => c.nombre === clienteNombre);
  if (cliente && cliente.sitios) {
    const idx = cliente.sitios.findIndex(s => getSitioNombre(s) === sitioNombre);
    if (idx !== -1) {
      cliente.sitios.splice(idx, 1);
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      verDetalleCliente(clienteNombre); // Refrescar modal
    } else {
      alert("Este sitio proviene de SAP y no puede ser eliminado desde aquí.");
    }
  }
}

function cerrarDetalleCliente(e) {
  if (e && e.target !== document.getElementById('modal-detalle-cliente-overlay')) return;
  document.getElementById('modal-detalle-cliente-overlay').classList.remove('open');
}

// ===== MODAL CLIENTE LOGIC =====
function abrirModalCliente() {
  document.getElementById('form-cliente').reset();
  
  // Populate assigned personnel dropdowns
  const selectSup = document.getElementById('cl-supervisor');
  const selectTec = document.getElementById('cl-tecnico');
  if (selectSup) {
    selectSup.innerHTML = usuarios.filter(u => ['superadmin','admin','supervisor'].includes(u.rol) && u.activo !== false && (isTestModeActive() || !isTestUser(u)))
              .map(u => `<option value="${u.id}">${u.nombre} (${ROLES[u.rol]?.label || u.rol})</option>`).join('');
  }
  if (selectTec) {
    selectTec.innerHTML = usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && u.activo !== false && (isTestModeActive() || !isTestUser(u)))
              .map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
  }

  document.getElementById('maquinas-container').innerHTML = '';
  agregarMaquinaField(); // At least one empty machine field
  document.getElementById('modal-cliente-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarCliente(e) {
  if (e && e.target !== document.getElementById('modal-cliente-overlay')) return;
  document.getElementById('modal-cliente-overlay').classList.remove('open');
}

function agregarMaquinaField() {
  const container = document.getElementById('maquinas-container');
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.flexWrap = 'wrap';
  div.style.gap = '1rem';
  div.style.background = 'var(--bg-hover)';
  div.style.padding = '1rem';
  div.style.borderRadius = 'var(--radius-md)';
  div.style.alignItems = 'end';
  div.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%;">
      <div class="form-group">
        <label style="font-size:0.75rem;">Marca</label>
        <input type="text" class="cl-maquina-marca" placeholder="Ej. Fiori"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Modelo *</label>
        <input type="text" class="cl-maquina-modelo" placeholder="Ej. CX 160" required/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Número de Serie</label>
        <input type="text" class="cl-maquina-serie" placeholder="Ej. 12345678"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Año de Fabricación</label>
        <input type="number" class="cl-maquina-anio" placeholder="Ej. 2018"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Fecha de Venta</label>
        <input type="date" class="cl-maquina-venta"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Ubicación</label>
        <input type="text" class="cl-maquina-ubicacion" placeholder="Nave, Planta..."/>
      </div>
    </div>
    <div class="form-group" style="flex: 0 0 auto; margin-left: 1rem; align-self: flex-start; padding-top:1.25rem;">
      <button type="button" class="btn-secondary" style="height: 38px; padding: 0 1rem; color: var(--red);" onclick="this.parentElement.parentElement.remove()" title="Eliminar Máquina">
        <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
      </button>
    </div>
  `;
  container.appendChild(div);
  lucide.createIcons();
}

function guardarCliente(e) {
  e.preventDefault();
  
  const nombre = document.getElementById('cl-nombre').value.trim();
  const rfc = document.getElementById('cl-rfc').value.trim();
  const ubicacion = document.getElementById('cl-ubicacion').value.trim();
  const contacto = document.getElementById('cl-contacto').value.trim();
  const telefono = document.getElementById('cl-telefono').value.trim();
  const email = document.getElementById('cl-email').value.trim();
  const metodoContacto = document.getElementById('cl-metodo-contacto').value;
  
  const maquinasEls = document.querySelectorAll('#maquinas-container > div');
  const maquinas = [];
  maquinasEls.forEach(el => {
    const marca = el.querySelector('.cl-maquina-marca')?.value.trim() || '';
    const modelo = el.querySelector('.cl-maquina-modelo')?.value.trim() || '';
    const serie = el.querySelector('.cl-maquina-serie')?.value.trim() || '';
    const anio = el.querySelector('.cl-maquina-anio')?.value.trim() || '';
    const venta = el.querySelector('.cl-maquina-venta')?.value || '';
    const ubicacion = el.querySelector('.cl-maquina-ubicacion')?.value.trim() || '';
    if (modelo) {
      const idInterno = generarIdInternoMaquina(marca, venta || anio);
      maquinas.push({ idInterno, marca, modelo, serie, anio, venta, ubicacion });
    }
  });

  const supIds = Array.from(document.getElementById('cl-supervisor')?.selectedOptions || []).map(o => o.value);
  const tecIds = Array.from(document.getElementById('cl-tecnico')?.selectedOptions || []).map(o => o.value);

  const nuevoCliente = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    nombre,
    rfc,
    ubicacion,
    contacto,
    telefono,
    email,
    metodoContacto,
    maquinas,
    supervisoresAsignados: supIds,
    tecnicosAsignados: tecIds
  };

  clientesDb.push(nuevoCliente);
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  
  cerrarCliente();
  if (document.getElementById('view-clientes').classList.contains('active')) {
    renderClientes();
  }
}

// ===== MODAL AGREGAR MÁQUINA A CLIENTE =====
let editandoMaquinaId = null;
let editandoMaquinaCliente = null;

function abrirModalAgregarMaquina() {
  editandoMaquinaId = null;
  editandoMaquinaCliente = null;
  document.getElementById('agregar-maquina-title').textContent = 'Agregar Máquina a Cliente';
  document.getElementById('form-agregar-maquina').reset();
  
  const multiSection = document.getElementById('am-multiempresa-section');
  if (multiSection) multiSection.style.display = 'none';
  const multiSearch = document.getElementById('am-multiempresa-search');
  if (multiSearch) multiSearch.value = '';
  const multiList = document.getElementById('am-multiempresa-list');
  if (multiList) multiList.innerHTML = '';

  const select = document.getElementById('am-cliente');
  select.removeAttribute('disabled');
  document.getElementById('am-venta').disabled = false;
  
  const helperText = document.getElementById('am-cliente-helper-text');
  if (helperText) helperText.style.display = 'none';
  
  const btnEliminar = document.getElementById('btn-eliminar-maquina');
  if (btnEliminar) btnEliminar.style.display = 'none';
  
  const slider = document.getElementById('am-venta-tercero-slider');
  const knob = document.getElementById('am-venta-tercero-knob');
  if (slider) slider.style.backgroundColor = '#ccc';
  if (knob) knob.style.transform = 'translateX(0)';
  
  // Lógica del Select de Marca
  const selectMarca = document.getElementById('am-marca-select');
  const inputOtraMarca = document.getElementById('am-marca-otra');
  
  if (selectMarca && inputOtraMarca) {
    const marcasSet = new Set(MARCAS_OFICIALES);
    clientesDb.forEach(c => {
      if (c.maquinas) c.maquinas.forEach(m => { if (m.marca && !marcasSet.has(m.marca)) marcasSet.add(m.marca); });
    });
    
    // Construir el select
    let optionsHtml = '<option value="" disabled selected>Seleccione una marca...</option>';
    Array.from(marcasSet).sort().forEach(m => {
      optionsHtml += `<option value="${m}">${m}</option>`;
    });
    optionsHtml += '<option value="otra">Otra...</option>';
    selectMarca.innerHTML = optionsHtml;
    
    inputOtraMarca.style.display = 'none';
    inputOtraMarca.value = '';
    
    // Clonar para limpiar eventos y evitar acumulaciones
    const newSelectMarca = selectMarca.cloneNode(true);
    selectMarca.parentNode.replaceChild(newSelectMarca, selectMarca);
    
    newSelectMarca.addEventListener('change', function() {
      if (this.value === 'otra') {
        inputOtraMarca.style.display = 'block';
        inputOtraMarca.focus();
        inputOtraMarca.required = true;
      } else {
        inputOtraMarca.style.display = 'none';
        inputOtraMarca.required = false;
      }
    });
  }
  
  // Llenar el select de clientes
  select.innerHTML = '<option value="" disabled selected>Seleccione un cliente...</option>';
  
  // Obtener lista completa de clientes (legacy + db)
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente && !legacyMap.has(o.cliente)) {
      legacyMap.set(o.cliente, o.cliente);
    }
  });
  const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
  mergedNames.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    opt.textContent = nombre;
    select.appendChild(opt);
  });
  
  select.onchange = (e) => {
    const nombre = e.target.value;
    const multiSection = document.getElementById('am-multiempresa-section');
    if (multiSection) multiSection.style.display = 'none';
    const multiList = document.getElementById('am-multiempresa-list');
    if (multiList) multiList.innerHTML = '';
    
    const selectUbicacion = document.getElementById('am-ubicacion-select');
    const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
    
    if (selectUbicacion && inputOtraUbicacion) {
      const clienteObj = clientesDb.find(c => c.nombre === nombre);
      let optionsHtml = '<option value="" disabled selected>Seleccione una ubicación...</option>';
      
      if (clienteObj) {
        const sitios = getNombresDeSitiosParaCliente(clienteObj);
        sitios.forEach(sName => {
          optionsHtml += `<option value="${sName}">${sName}</option>`;
        });
      }
      optionsHtml += '<option value="otra">Otra...</option>';
      selectUbicacion.innerHTML = optionsHtml;
      
      inputOtraUbicacion.style.display = 'none';
      inputOtraUbicacion.value = '';
      
      const newSelectUbicacion = selectUbicacion.cloneNode(true);
      selectUbicacion.parentNode.replaceChild(newSelectUbicacion, selectUbicacion);
      
      newSelectUbicacion.addEventListener('change', function() {
        const latInput = document.getElementById('am-latitud');
        const lonInput = document.getElementById('am-longitud');
        
        if (this.value === 'otra') {
          inputOtraUbicacion.style.display = 'block';
          inputOtraUbicacion.focus();
          if (latInput) latInput.value = '';
          if (lonInput) lonInput.value = '';
        } else {
          inputOtraUbicacion.style.display = 'none';
          
          if (latInput && lonInput) {
            latInput.value = '';
            lonInput.value = '';
            
            const sitioName = this.value;
            const sitioDbOb = sitiosDb.find(s => s.nombre === sitioName);
            let foundLat = null; let foundLon = null;
            if (sitioDbOb) {
              foundLat = sitioDbOb.latitud || sitioDbOb.lat;
              foundLon = sitioDbOb.longitud || sitioDbOb.lon || sitioDbOb.lng;
              if (sitioDbOb.customData) {
                const keys = Object.keys(sitioDbOb.customData);
                const kLat = keys.find(k => k.toLowerCase() === 'latitud' || k.toLowerCase() === 'lat' || k.toLowerCase() === 'u_latitud');
                const kLon = keys.find(k => k.toLowerCase() === 'longitud' || k.toLowerCase() === 'lon' || k.toLowerCase() === 'lng' || k.toLowerCase() === 'u_longitud');
                if (kLat && sitioDbOb.customData[kLat] && !foundLat) foundLat = sitioDbOb.customData[kLat];
                if (kLon && sitioDbOb.customData[kLon] && !foundLon) foundLon = sitioDbOb.customData[kLon];
              }
            }
            
            if (!foundLat || !foundLon) {
              const cliObj = clientesDb.find(c => c.nombre === document.getElementById('am-cliente').value);
              if (cliObj && cliObj.sitios) {
                const localSitio = cliObj.sitios.find(s => getSitioNombre(s) === sitioName);
                if (localSitio && typeof localSitio === 'object') {
                  if (localSitio.latitud) foundLat = localSitio.latitud;
                  if (localSitio.longitud) foundLon = localSitio.longitud;
                }
              }
            }
            
            if (foundLat) latInput.value = foundLat;
            if (foundLon) lonInput.value = foundLon;
          }
        }
      });
    }
  };

  document.getElementById('modal-agregar-maquina-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarModalAgregarMaquina(e) {
  if (e && e.target !== document.getElementById('modal-agregar-maquina-overlay')) return;
  document.getElementById('modal-agregar-maquina-overlay').classList.remove('open');
  editandoMaquinaId = null;
  editandoMaquinaCliente = null;
}

// ===== FUSIONAR MAQUINARIAS HELPER FUNCTIONS (Solo Superadmins) =====
function abrirModalFusionarMaquinas() {
  const modalOverlay = document.getElementById('modal-fusionar-maquinas-overlay');
  const selOrigen = document.getElementById('fm-maquina-origen');
  const selDestino = document.getElementById('fm-maquina-destino');
  const checkboxConfirm = document.getElementById('fm-confirmar');
  const formEl = document.getElementById('form-fusionar-maquinas');

  if (formEl) formEl.reset();

  if (selOrigen && selDestino) {
    // Limpiar opciones anteriores
    selOrigen.innerHTML = '<option value="">Selecciona la máquina a eliminar...</option>';
    selDestino.innerHTML = '<option value="">Selecciona la máquina a conservar...</option>';

    // Ordenar maquinariaDb por marca/modelo
    const sortedMaq = [...maquinariaDb].sort((a, b) => {
      const brandA = (a.marca || '').toLowerCase();
      const brandB = (b.marca || '').toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      return (a.modelo || '').toLowerCase().localeCompare((b.modelo || '').toLowerCase());
    });

    // Rellenar las opciones
    sortedMaq.forEach(m => {
      const brand = m.marca || 'Sin Marca';
      const model = m.modelo || 'Sin Modelo';
      const serial = m.serie || 'Sin Serie';
      const eco = m.numeroEconomico && m.numeroEconomico !== 'N/A' ? ` [Eco: ${m.numeroEconomico}]` : '';
      const cli = m.cliente || 'Sin Cliente';
      const label = `[${brand}] ${model} - ${serial}${eco} (Cliente: ${cli})`;
      
      const opt1 = document.createElement('option');
      opt1.value = m.id;
      opt1.textContent = label;
      selOrigen.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = m.id;
      opt2.textContent = label;
      selDestino.appendChild(opt2);
    });
  }

  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
};

function cerrarModalFusionarMaquinas(e) {
  const modalOverlay = document.getElementById('modal-fusionar-maquinas-overlay');
  if (e && e.target !== modalOverlay) return;
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
};

async function fusionarMaquinarias(e) {
  if (e) e.preventDefault();

  const idOrigen = document.getElementById('fm-maquina-origen')?.value;
  const idDestino = document.getElementById('fm-maquina-destino')?.value;
  const confirmed = document.getElementById('fm-confirmar')?.checked;

  if (!idOrigen || !idDestino) {
    mostrarNotificacion('Por favor selecciona ambas maquinarias.', 'warning');
    return;
  }

  if (idOrigen === idDestino) {
    mostrarNotificacion('La máquina origen y destino no pueden ser la misma.', 'warning');
    return;
  }

  if (!confirmed) {
    mostrarNotificacion('Por favor confirma la advertencia de fusión.', 'warning');
    return;
  }

  const maquinaOrigen = maquinariaDb.find(m => m.id === idOrigen);
  const maquinaDestino = maquinariaDb.find(m => m.id === idDestino);

  if (!maquinaOrigen || !maquinaDestino) {
    mostrarNotificacion('No se pudo encontrar una de las maquinarias seleccionadas.', 'error');
    return;
  }

  const confirmMsg = `¿Estás completamente seguro de que deseas fusionar:\n\n` +
                     `❌ ELIMINAR: [${maquinaOrigen.marca}] ${maquinaOrigen.modelo} (Serie: ${maquinaOrigen.serie})\n` +
                     `➡️ CONSERVAR EN: [${maquinaDestino.marca}] ${maquinaDestino.modelo} (Serie: ${maquinaDestino.serie})?\n\n` +
                     `Esta acción moverá todas las órdenes de servicio, horómetros y levantamientos asociados en la base de datos de producción.`;

  if (!confirm(confirmMsg)) {
    return;
  }

  mostrarNotificacion('Iniciando fusión de maquinarias...', 'info');

  if (window.supabaseClient) {
    try {
      // Llamar a la función RPC en Supabase
      const { error } = await window.supabaseClient.rpc('fusionar_maquinarias', {
        maquina_origen_id: idOrigen,
        maquina_destino_id: idDestino
      });

      if (error) {
        throw error;
      }

      mostrarNotificacion('Fusión completada con éxito en Supabase.', 'success');
      cerrarModalFusionarMaquinas();

      // Recargar datos desde la nube
      window._syncPromise = null;
      if (typeof window.cargarDatosDeSupabase === 'function') {
        await window.cargarDatosDeSupabase();
      }
    } catch (err) {
      console.error('Error al fusionar maquinarias:', err);
      mostrarNotificacion('Error al fusionar maquinarias: ' + (err.message || err), 'error');
    }
  } else {
    // Fallback local
    ordenes.forEach(o => {
      if (o.maquinaria_id === idOrigen) {
        o.maquinaria_id = idDestino;
      }
    });
    
    levantamientos.forEach(l => {
      if (l.maquina === idOrigen) {
        l.maquina = idDestino;
      }
    });
    
    maquinariaDb = maquinariaDb.filter(m => m.id !== idOrigen);

    safeSetJSON('sapi_ordenes', ordenes);
    safeSetJSON('sapi_levantamientos', levantamientos);
    safeSetJSON('sapi_maquinaria_db', maquinariaDb);

    mostrarNotificacion('Fusión completada localmente (Modo Offline).', 'success');
    cerrarModalFusionarMaquinas();
    renderMaquinaria();
  }
};

function toggleVentaTercero() {
  const isTercero = document.getElementById('am-venta-tercero').checked;
  const inputVenta = document.getElementById('am-venta');
  const slider = document.getElementById('am-venta-tercero-slider');
  const knob = document.getElementById('am-venta-tercero-knob');
  
  if (isTercero) {
    inputVenta.value = '';
    inputVenta.disabled = true;
    if (slider) slider.style.backgroundColor = 'var(--accent)';
    if (knob) knob.style.transform = 'translateX(16px)';
  } else {
    inputVenta.disabled = false;
    if (slider) slider.style.backgroundColor = '#ccc';
    if (knob) knob.style.transform = 'translateX(0)';
  }
}

function toggleMultiempresaSection() {
  const section = document.getElementById('am-multiempresa-section');
  if (!section) return;
  
  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? 'block' : 'none';
  
  if (isHidden) {
    const list = document.getElementById('am-multiempresa-list');
    if (!list) return;
    
    list.innerHTML = '';
    const clientSelect = document.getElementById('am-cliente');
    const selectedClient = clientSelect ? clientSelect.value : '';
    
    const legacyMap = new Map();
    ordenes.forEach(o => {
      if (o.cliente && !legacyMap.has(o.cliente)) {
        legacyMap.set(o.cliente, o.cliente);
      }
    });
    const allClients = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    const otherClients = allClients.filter(c => c !== selectedClient);
    
    if (otherClients.length === 0) {
      list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:0.25rem;">No hay otras empresas registradas</div>';
      return;
    }
    
    let linked = [];
    if (editandoMaquinaId) {
      let maquina = null;
      if (editandoMaquinaCliente) {
        const cObj = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
        maquina = cObj?.maquinas?.find(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
      }
      if (!maquina) {
        maquina = maquinariaDb.find(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
      }
      if (maquina && maquina.customData) {
        linked = maquina.customData.empresasVinculadas || maquina.customData.clientesAdicionales || [];
        if (!Array.isArray(linked)) linked = [];
      }
    }
    
    otherClients.forEach(nombre => {
      const isChecked = linked.includes(nombre);
      const item = document.createElement('label');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '0.5rem';
      item.style.fontSize = '0.85rem';
      item.style.color = 'var(--text-primary)';
      item.style.cursor = 'pointer';
      item.style.padding = '0.2rem 0';
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = nombre;
      cb.checked = isChecked;
      cb.style.cursor = 'pointer';
      
      const span = document.createElement('span');
      span.textContent = nombre;
      
      item.appendChild(cb);
      item.appendChild(span);
      list.appendChild(item);
    });
  }
};

function desmarcarTodasMultiempresas() {
  const list = document.getElementById('am-multiempresa-list');
  if (list) {
    const checkboxes = list.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
  }
};

function filtrarMultiempresaList(val) {
  const list = document.getElementById('am-multiempresa-list');
  if (!list) return;
  
  const query = String(val).toLowerCase().trim();
  const items = list.querySelectorAll('label');
  items.forEach(item => {
    const span = item.querySelector('span');
    const text = span ? span.textContent.toLowerCase() : '';
    item.style.display = text.includes(query) ? 'flex' : 'none';
  });
};

function editarMaquina(clienteNombre, idInterno) {
  abrirModalAgregarMaquina();
  editandoMaquinaId = idInterno;
  editandoMaquinaCliente = clienteNombre;
  document.getElementById('agregar-maquina-title').textContent = 'Editar Máquina';
  
  const select = document.getElementById('am-cliente');
  
  let optionExists = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === clienteNombre) { optionExists = true; break; }
  }
  if (!optionExists && clienteNombre) {
    const opt = document.createElement('option');
    opt.value = clienteNombre;
    opt.textContent = clienteNombre;
    select.appendChild(opt);
  }
  
  select.value = clienteNombre;
  const isAllowed = currentSession.viewMode === 'superadmin' || currentSession.viewMode === 'admin';
  if (isAllowed) {
    select.removeAttribute('disabled');
  } else {
    select.setAttribute('disabled', 'true');
  }

  const helperText = document.getElementById('am-cliente-helper-text');
  if (helperText) {
    helperText.style.display = isAllowed ? 'block' : 'none';
  }
  
  const selectUbicacion = document.getElementById('am-ubicacion-select');
  const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
  if (selectUbicacion && inputOtraUbicacion) {
    let optionsHtml = '<option value="" disabled selected>Seleccione una ubicación...</option>';
    const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
    if (clienteObj) {
      let sitios = clienteObj.sitios || [];
      if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
        sitios = [clienteObj.ubicacion, ...sitios];
      }
      sitios.forEach(s => {
        const sName = getSitioNombre(s);
        optionsHtml += `<option value="${sName}">${sName}</option>`;
      });
    }
    optionsHtml += '<option value="otra">Otra...</option>';
    selectUbicacion.innerHTML = optionsHtml;
    
    const newSelectUbicacion = selectUbicacion.cloneNode(true);
    selectUbicacion.parentNode.replaceChild(newSelectUbicacion, selectUbicacion);
    
    newSelectUbicacion.addEventListener('change', function() {
      const latInput = document.getElementById('am-latitud');
      const lonInput = document.getElementById('am-longitud');
      
      if (this.value === 'otra') {
        inputOtraUbicacion.style.display = 'block';
        inputOtraUbicacion.focus();
        if (latInput) latInput.value = '';
        if (lonInput) lonInput.value = '';
      } else {
        inputOtraUbicacion.style.display = 'none';
        
        if (latInput && lonInput) {
          latInput.value = '';
          lonInput.value = '';
          
          const sitioName = this.value;
          const sitioDbOb = sitiosDb.find(s => s.nombre === sitioName);
          let foundLat = null; let foundLon = null;
          if (sitioDbOb) {
            foundLat = sitioDbOb.latitud || sitioDbOb.lat;
            foundLon = sitioDbOb.longitud || sitioDbOb.lon || sitioDbOb.lng;
            if (sitioDbOb.customData) {
              const keys = Object.keys(sitioDbOb.customData);
              const kLat = keys.find(k => k.toLowerCase() === 'latitud' || k.toLowerCase() === 'lat' || k.toLowerCase() === 'u_latitud');
              const kLon = keys.find(k => k.toLowerCase() === 'longitud' || k.toLowerCase() === 'lon' || k.toLowerCase() === 'lng' || k.toLowerCase() === 'u_longitud');
              if (kLat && sitioDbOb.customData[kLat] && !foundLat) foundLat = sitioDbOb.customData[kLat];
              if (kLon && sitioDbOb.customData[kLon] && !foundLon) foundLon = sitioDbOb.customData[kLon];
            }
          }
          
          if (!foundLat || !foundLon) {
            const cliObj = clientesDb.find(c => c.nombre === document.getElementById('am-cliente').value);
            if (cliObj && cliObj.sitios) {
              const localSitio = cliObj.sitios.find(s => getSitioNombre(s) === sitioName);
              if (localSitio && typeof localSitio === 'object') {
                if (localSitio.latitud) foundLat = localSitio.latitud;
                if (localSitio.longitud) foundLon = localSitio.longitud;
              }
            }
          }
          
          if (foundLat) latInput.value = foundLat;
          if (foundLon) lonInput.value = foundLon;
        }
      }
    });
    
    let maquina = clienteObj?.maquinas?.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
    if (!maquina) maquina = maquinariaDb.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
    
    if (maquina) {
        const selectMarca = document.getElementById('am-marca-select');
        const inputOtraMarca = document.getElementById('am-marca-otra');
        
        let marcaFound = false;
        Array.from(selectMarca.options).forEach(opt => {
          if (opt.value === maquina.marca) marcaFound = true;
        });

        if (marcaFound) {
          selectMarca.value = maquina.marca;
          inputOtraMarca.style.display = 'none';
          inputOtraMarca.value = '';
          inputOtraMarca.required = false;
        } else if (maquina.marca) {
          selectMarca.value = 'otra';
          inputOtraMarca.style.display = 'block';
          inputOtraMarca.value = maquina.marca;
          inputOtraMarca.required = true;
        } else {
          selectMarca.value = '';
        }

        document.getElementById('am-modelo').value = maquina.modelo || '';
        document.getElementById('am-serie').value = maquina.serie || '';
        if(document.getElementById('am-numeco')) document.getElementById('am-numeco').value = maquina.numeroEconomico || maquina.customData?.numeroEconomico || '';
        if(document.getElementById('am-nummotor')) document.getElementById('am-nummotor').value = maquina.numeroMotor || maquina.customData?.numeroMotor || '';
        document.getElementById('am-anio').value = maquina.anio || '';
        const idIntInput = document.getElementById('am-id-interno');
        if (idIntInput) {
            const cleanIdInt = maquina.idInterno || maquina.id || '';
            const isCleanIdUUID = cleanIdInt && cleanIdInt.length > 30 && cleanIdInt.includes('-');
            idIntInput.value = (cleanIdInt && cleanIdInt !== 'NA' && cleanIdInt !== 'N/A' && !isCleanIdUUID) ? cleanIdInt : '';
        }
        
        const selectTipo = document.getElementById('am-tipo-maquina');
        const inputOtroTipo = document.getElementById('am-tipo-otro');
        let tipoFound = false;
        const mTipo = maquina.tipo || maquina.customData?.tipo;
        Array.from(selectTipo.options).forEach(opt => {
          if (opt.value === mTipo) tipoFound = true;
        });
        if (tipoFound) {
          selectTipo.value = mTipo;
          inputOtroTipo.style.display = 'none';
          inputOtroTipo.value = '';
          inputOtroTipo.required = false;
        } else if (mTipo && mTipo !== 'N/A') {
          selectTipo.value = 'Otra';
          inputOtroTipo.style.display = 'block';
          inputOtroTipo.value = mTipo;
          inputOtroTipo.required = true;
        } else {
          selectTipo.value = '';
        }
        
        const inputVenta = document.getElementById('am-venta');
        const checkTercero = document.getElementById('am-venta-tercero');
        const slider = document.getElementById('am-venta-tercero-slider');
        const knob = document.getElementById('am-venta-tercero-knob');
        
        const mVenta = maquina.venta || maquina.customData?.venta;
        if (mVenta === 'TERCERO') {
          checkTercero.checked = true;
          inputVenta.value = '';
          inputVenta.disabled = true;
          if (slider) slider.style.backgroundColor = 'var(--accent)';
          if (knob) knob.style.transform = 'translateX(16px)';
        } else {
          checkTercero.checked = false;
          inputVenta.value = mVenta || '';
          inputVenta.disabled = false;
          if (slider) slider.style.backgroundColor = '#ccc';
          if (knob) knob.style.transform = 'translateX(0)';
        }

        const mLatitud = maquina.latitud || maquina.customData?.latitud || '';
        const mLongitud = maquina.longitud || maquina.customData?.longitud || '';
        document.getElementById('am-latitud').value = mLatitud;
        document.getElementById('am-longitud').value = mLongitud;
        
        const currentSelectUbicacion = document.getElementById('am-ubicacion-select');
        let ubiFound = false;
        const mUbicacion = maquina.ubicacion || maquina.customData?.ubicacion;
        Array.from(currentSelectUbicacion.options).forEach(opt => {
          if (opt.value === mUbicacion) ubiFound = true;
        });
        
        if (ubiFound) {
          currentSelectUbicacion.value = mUbicacion;
          inputOtraUbicacion.style.display = 'none';
          inputOtraUbicacion.value = '';
        } else if (mUbicacion) {
          currentSelectUbicacion.value = 'otra';
          inputOtraUbicacion.style.display = 'block';
          inputOtraUbicacion.value = mUbicacion;
        } else {
          currentSelectUbicacion.value = '';
        }
        
        // Renderizar Custom Fields
        const customContainer = document.getElementById('am-custom-fields-container');
        if (customContainer) {
          if (maquina.customData && Object.keys(maquina.customData).length > 0) {
            customContainer.style.display = 'block';
            let customHtml = '<div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem;"><i data-lucide="database" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Datos SAP (Solo Lectura)</div><div class="form-grid" style="grid-template-columns:1fr 1fr;">';
            Object.entries(maquina.customData).forEach(([label, val]) => {
              customHtml += `
                <div class="form-group">
                  <label>${label}</label>
                  <input type="text" value="${val || 'N/A'}" readonly style="background:var(--bg-hover); color:var(--text-muted); border-style:dashed;" />
                </div>
              `;
            });
            customHtml += '</div>';
            customContainer.innerHTML = customHtml;
          } else {
            customContainer.style.display = 'none';
            customContainer.innerHTML = '';
          }
        }
        
        // Show delete button only if it's a manual machine
        const isManual = clienteObj?.maquinas?.some(m => m.idInterno === idInterno);
        const btnEliminar = document.getElementById('btn-eliminar-maquina');
        if (btnEliminar) {
          btnEliminar.style.display = isManual ? 'block' : 'none';
        }
      }
  }
}

function guardarNuevaMaquina(e) {
  e.preventDefault();
  const clienteSeleccionado = document.getElementById('am-cliente').value;
  
  // Read multiempresa checkboxes
  const linkedCompanies = [];
  const multiempresaList = document.getElementById('am-multiempresa-list');
  if (multiempresaList) {
    const checkboxes = multiempresaList.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => linkedCompanies.push(cb.value));
  }

  const selectMarca = document.getElementById('am-marca-select');
  const inputOtraMarca = document.getElementById('am-marca-otra');
  const marca = selectMarca.value === 'otra' ? inputOtraMarca.value.trim() : selectMarca.value.trim();
  
  const selectTipo = document.getElementById('am-tipo-maquina');
  const inputOtroTipo = document.getElementById('am-tipo-otro');
  const tipo = selectTipo.value === 'Otra' ? inputOtroTipo.value.trim() : selectTipo.value.trim();

  const modelo = document.getElementById('am-modelo').value.trim();
  const serie = document.getElementById('am-serie').value.trim();
  const numeroEconomico = document.getElementById('am-numeco') ? document.getElementById('am-numeco').value.trim() : '';
  const numeroMotor = document.getElementById('am-nummotor') ? document.getElementById('am-nummotor').value.trim() : '';
  const anio = document.getElementById('am-anio').value.trim();
  const venta = document.getElementById('am-venta-tercero').checked ? 'TERCERO' : document.getElementById('am-venta').value;
  const selectUbicacion = document.getElementById('am-ubicacion-select');
  const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
  const ubicacion = selectUbicacion.value === 'otra' ? inputOtraUbicacion.value.trim() : selectUbicacion.value.trim();
  const latitud = document.getElementById('am-latitud').value.trim();
  const longitud = document.getElementById('am-longitud').value.trim();
  const inputIdInterno = document.getElementById('am-id-interno') ? document.getElementById('am-id-interno').value.trim() : '';
  const finalIdInterno = inputIdInterno || generarIdInternoMaquina(marca, venta || anio);

  if (!clienteSeleccionado || !modelo) return;

  // Buscar si el cliente existe en la DB
  let clienteObj = clientesDb.find(c => c.nombre === clienteSeleccionado);
  
  if (!clienteObj) {
    // Si no existe (es un cliente legacy), lo creamos en la DB
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: clienteSeleccionado,
      maquinas: []
    };
    clientesDb.push(clienteObj);
  }

  if (!clienteObj.maquinas) {
    clienteObj.maquinas = [];
  }

  // Resolver o crear sitio_id para vincular con sitiosDb y la BD
  let sitioId = null;
  if (ubicacion) {
    // Buscar si ya existe el sitio en sitiosDb para este cliente
    const existSitio = sitiosDb.find(s => s.cliente === clienteObj.id && s.nombre === ubicacion);
    if (existSitio) {
      sitioId = existSitio.id;
      // Actualizar coordenadas si cambiaron
      if (latitud) existSitio.latitud = latitud;
      if (longitud) existSitio.longitud = longitud;
      if (!existSitio.customData) existSitio.customData = {};
      existSitio.customData.latitud = latitud;
      existSitio.customData.longitud = longitud;
      localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
      if (window.pushToSupabase) window.pushToSupabase('sitios', existSitio);
    } else {
      // Si no existe, creamos un nuevo sitio
      sitioId = crypto.randomUUID();
      const nuevoSitioObj = {
        id: sitioId,
        nombre: ubicacion,
        cliente: clienteObj.id,
        direccion: '',
        cp: '',
        ciudad: '',
        estado: '',
        customData: { latitud, longitud }
      };
      sitiosDb.push(nuevoSitioObj);
      localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
      if (window.pushToSupabase) window.pushToSupabase('sitios', nuevoSitioObj);
      
      // Añadir al listado de sitios del cliente en local
      if (!clienteObj.sitios) clienteObj.sitios = [];
      clienteObj.sitios.push({ id: sitioId, nombre: ubicacion, latitud, longitud });
    }
  }

  const isTransfer = editandoMaquinaId && editandoMaquinaCliente && clienteSeleccionado !== editandoMaquinaCliente;
  let transferEvent = null;
  if (isTransfer) {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const currentUserName = currentUser ? currentUser.nombre : 'Administrador';

    let oldUbicacion = 'Sin Ubicación';
    let maqOldObj = maquinariaDb.find(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
    if (!maqOldObj && editandoMaquinaCliente) {
      const cOld = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
      if (cOld && cOld.maquinas) {
        maqOldObj = cOld.maquinas.find(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
      }
    }
    if (maqOldObj) {
      oldUbicacion = maqOldObj.ubicacion || 'Sin Ubicación';
    }

    transferEvent = {
      fecha: new Date().toISOString(),
      usuario: currentUserName,
      tipo: 'traspaso',
      clienteAnterior: editandoMaquinaCliente,
      clienteNuevo: clienteSeleccionado,
      sitioAnterior: oldUbicacion,
      sitioNuevo: ubicacion || 'Sin Ubicación'
    };
  }

  if (editandoMaquinaId && editandoMaquinaCliente) {
    const maqDbIdx = maquinariaDb.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
    
    if (maqDbIdx >= 0) {
        // MÁQUINA DE SAP / SUPABASE
        maquinariaDb[maqDbIdx].cliente = clienteSeleccionado;
        maquinariaDb[maqDbIdx].marca = marca;
        maquinariaDb[maqDbIdx].modelo = modelo;
        maquinariaDb[maqDbIdx].serie = serie;
        maquinariaDb[maqDbIdx].numeroEconomico = numeroEconomico;
        maquinariaDb[maqDbIdx].numeroMotor = numeroMotor;
        maquinariaDb[maqDbIdx].anio = anio;
        maquinariaDb[maqDbIdx].tipo = tipo;
        maquinariaDb[maqDbIdx].idInterno = finalIdInterno;
        maquinariaDb[maqDbIdx].ubicacion = ubicacion;
        maquinariaDb[maqDbIdx].sitio_id = sitioId;
        maquinariaDb[maqDbIdx].latitud = latitud;
        maquinariaDb[maqDbIdx].longitud = longitud;

        if (!maquinariaDb[maqDbIdx].customData) maquinariaDb[maqDbIdx].customData = {};
        maquinariaDb[maqDbIdx].customData.tipo = tipo;
        maquinariaDb[maqDbIdx].customData.numeroEconomico = numeroEconomico;
        maquinariaDb[maqDbIdx].customData.numeroMotor = numeroMotor;
        maquinariaDb[maqDbIdx].customData.venta = venta;
        maquinariaDb[maqDbIdx].customData.ubicacion = ubicacion;
        maquinariaDb[maqDbIdx].customData.latitud = latitud;
        maquinariaDb[maqDbIdx].customData.longitud = longitud;
        maquinariaDb[maqDbIdx].customData.empresasVinculadas = linkedCompanies;
        maquinariaDb[maqDbIdx].customData.clientesAdicionales = linkedCompanies;
        
        if (transferEvent) {
          if (!maquinariaDb[maqDbIdx].customData.bitacora) maquinariaDb[maqDbIdx].customData.bitacora = [];
          maquinariaDb[maqDbIdx].customData.bitacora.unshift(transferEvent);
        }

        localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
        if (window.pushToSupabase) window.pushToSupabase('maquinaria', maquinariaDb[maqDbIdx]);
    } else {
        // MÁQUINA MANUAL (En clientesDb)
        if (clienteSeleccionado !== editandoMaquinaCliente) {
          const clienteAntiguo = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
          let maquinaDatos = { idInterno: finalIdInterno, marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, sitio_id: sitioId, latitud, longitud, tipo };
          if (clienteAntiguo && clienteAntiguo.maquinas) {
            const oldIdx = clienteAntiguo.maquinas.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
            if (oldIdx >= 0) {
               maquinaDatos = { ...clienteAntiguo.maquinas[oldIdx], ...maquinaDatos, idInterno: finalIdInterno };
               clienteAntiguo.maquinas.splice(oldIdx, 1);
               if (window.pushToSupabase) window.pushToSupabase('clientes', clienteAntiguo);
            }
          }
          maquinaDatos.customData = {
            ...(maquinaDatos.customData || {}),
            empresasVinculadas: linkedCompanies,
            clientesAdicionales: linkedCompanies
          };
          
          if (transferEvent) {
            if (!maquinaDatos.customData.bitacora) maquinaDatos.customData.bitacora = [];
            maquinaDatos.customData.bitacora.unshift(transferEvent);
          }

          clienteObj.maquinas.push(maquinaDatos);
          if (window.pushToSupabase) window.pushToSupabase('maquinaria', { ...maquinaDatos, cliente: clienteObj.id });
        } else {
          const maquinaIdx = clienteObj.maquinas.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
          if (maquinaIdx >= 0) {
            clienteObj.maquinas[maquinaIdx] = {
              ...clienteObj.maquinas[maquinaIdx],
              idInterno: finalIdInterno,
              marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, sitio_id: sitioId, latitud, longitud, tipo,
              customData: {
                ...(clienteObj.maquinas[maquinaIdx].customData || {}),
                empresasVinculadas: linkedCompanies,
                clientesAdicionales: linkedCompanies
              }
            };
            if (window.pushToSupabase) window.pushToSupabase('maquinaria', { ...clienteObj.maquinas[maquinaIdx], cliente: clienteObj.id });
          }
        }
    }

    if (isTransfer) {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion(`El traspaso de la maquinaria se ha registrado exitosamente.`, 'success');
      }
      if (document.getElementById('modal-detalle-cliente-overlay').classList.contains('open')) {
        verDetalleCliente(editandoMaquinaCliente);
      }
    }
  } else {
    const idInterno = generarIdInternoMaquina(marca, venta || anio);
    const nuevaMaq = {
      idInterno, marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, sitio_id: sitioId, latitud, longitud, tipo,
      customData: { empresasVinculadas: linkedCompanies, clientesAdicionales: linkedCompanies }
    };
    clienteObj.maquinas.push(nuevaMaq);
    if (window.pushToSupabase) window.pushToSupabase('maquinaria', { ...nuevaMaq, cliente: clienteObj.id });
  }
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
  
  cerrarModalAgregarMaquina();
  if (document.getElementById('view-clientes').classList.contains('active')) {
    renderClientes();
  }
  if (document.getElementById('view-maquinaria').classList.contains('active')) {
    renderMaquinaria();
  }
  if (document.getElementById('modal-detalle-cliente').classList.contains('open')) {
    verDetalleCliente(clienteSeleccionado);
  }
  
  // Actualizar dropdowns si estamos en medio de crear un ticket o servicio
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const mFullName = MARCAS_RENDER[(marca || '').toUpperCase()] || marca || '';
  const mName = `${mFullName} ${modelo || ''} (SN: ${serie || ''})`.trim();
  if (document.getElementById('modal-ticket')?.classList.contains('open')) {
    const tCli = document.getElementById('t-cliente').value;
    if (tCli === clienteSeleccionado) {
      poblarMaquinasCliente('t-equipo', '', tCli);
      if (window.agregarMaquinaChip) {
        window.agregarMaquinaChip(mName);
      }
    }
  }
  if (document.getElementById('view-servicios')?.classList.contains('active')) {
    const fCli = document.getElementById('f-cliente').value;
    if (fCli === clienteSeleccionado) {
      poblarMaquinasCliente('f-equipo', mName, fCli);
      if (typeof onEquipoOrdenChange === 'function') onEquipoOrdenChange();
    }
  }
  if (document.getElementById('modal-nueva-renta')) {
    const rCli = document.getElementById('renta-cliente')?.value;
    if (rCli === clienteSeleccionado && typeof window.poblarRentaMaquinas === 'function') {
      const targetMaqId = (typeof idInterno !== 'undefined' ? idInterno : (typeof finalIdInterno !== 'undefined' ? finalIdInterno : serie));
      window.poblarRentaMaquinas(rCli, targetMaqId || mName);
    }
  }
}

function eliminarMaquinaActual() {
  if (!editandoMaquinaId || !editandoMaquinaCliente) return;

  const confirmar = confirm(`¿Estás seguro de que deseas eliminar la máquina ${editandoMaquinaId}? Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  const clienteObj = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
  if (!clienteObj || !clienteObj.maquinas) return;

  const maquinaIdx = clienteObj.maquinas.findIndex(m => m.idInterno === editandoMaquinaId);
  if (maquinaIdx >= 0) {
    clienteObj.maquinas.splice(maquinaIdx, 1);
    
    // Guardar cambios
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
    if (window.deleteFromSupabase) window.deleteFromSupabase('maquinaria', editandoMaquinaId);
    
    cerrarModalAgregarMaquina();
    
    // Renderizar vistas actualizadas
    if (document.getElementById('view-clientes').classList.contains('active')) {
      renderClientes();
    }
    if (document.getElementById('view-maquinaria').classList.contains('active')) {
      renderMaquinaria();
    }
    if (document.getElementById('modal-detalle-cliente').classList.contains('open')) {
      verDetalleCliente(editandoMaquinaCliente);
    }
    
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`Máquina ${editandoMaquinaId} eliminada correctamente.`, 'success');
    }
  }
}

// ===== MODAL MOVER MÁQUINA =====
function abrirModalMoverMaquina(clienteNombre, idInterno) {
  document.getElementById('form-mover-maquina').reset();
  document.getElementById('mm-cliente').value = clienteNombre;
  document.getElementById('mm-idInterno').value = idInterno;
  
  const selectUbi = document.getElementById('mm-ubicacion');
  if (selectUbi) {
    selectUbi.innerHTML = '<option value="">Selecciona un sitio registrado...</option>';
    const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
    if (clienteObj) {
      const sitios = getNombresDeSitiosParaCliente(clienteObj);
      sitios.forEach(sn => {
        const option = document.createElement('option');
        option.value = sn;
        option.textContent = sn;
        selectUbi.appendChild(option);
      });
    }
  }
  document.getElementById('modal-mover-maquina-overlay').classList.add('open');
}

function cerrarModalMoverMaquina(e) {
  if (e && e.target !== document.getElementById('modal-mover-maquina-overlay')) return;
  document.getElementById('modal-mover-maquina-overlay').classList.remove('open');
}

function guardarMoverMaquina(e) {
  e.preventDefault();
  const clienteNombre = document.getElementById('mm-cliente').value;
  const idInterno = document.getElementById('mm-idInterno').value;
  const nuevaUbicacion = document.getElementById('mm-ubicacion').value.trim();
  
  if (!nuevaUbicacion) return;

  const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
  let machineFound = false;

  // 1. Buscar en maquinariaDb (máquinas de SAP/Supabase)
  const maqSap = maquinariaDb.find(m => m.id === idInterno || m.idInterno === idInterno || m.serie === idInterno);
  if (maqSap) {
    maqSap.ubicacion = nuevaUbicacion;
    if (!maqSap.customData) maqSap.customData = {};
    maqSap.customData.ubicacion = nuevaUbicacion;
    
    // Heredar coordenadas del sitio destino si están registradas
    const sitioDest = sitiosDb.find(s => s.nombre === nuevaUbicacion);
    if (sitioDest) {
      maqSap.latitud = sitioDest.latitud || sitioDest.lat || null;
      maqSap.longitud = sitioDest.longitud || sitioDest.lon || sitioDest.lng || null;
      maqSap.customData.latitud = maqSap.latitud;
      maqSap.customData.longitud = maqSap.longitud;
    }
    
    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
    if (window.pushToSupabase) {
      window.pushToSupabase('maquinaria', maqSap);
    }
    machineFound = true;
  }

  // 2. Buscar en las máquinas manuales del cliente
  if (clienteObj && clienteObj.maquinas) {
    const maqManual = clienteObj.maquinas.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
    if (maqManual) {
      maqManual.ubicacion = nuevaUbicacion;
      
      // Heredar coordenadas del sitio destino si están registradas
      const sitioDest = sitiosDb.find(s => s.nombre === nuevaUbicacion);
      if (sitioDest) {
        maqManual.latitud = sitioDest.latitud || sitioDest.lat || null;
        maqManual.longitud = sitioDest.longitud || sitioDest.lon || sitioDest.lng || null;
      }
      
      // Auto-agregar a sitios del cliente si no existe
      if (!clienteObj.sitios) clienteObj.sitios = [];
      if (!clienteObj.sitios.includes(nuevaUbicacion)) {
        clienteObj.sitios.push(nuevaUbicacion);
      }
      
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      if (window.pushToSupabase) {
        window.pushToSupabase('clientes', clienteObj);
        window.pushToSupabase('maquinaria', { ...maqManual, cliente: clienteObj.id });
      }
      machineFound = true;
    }
  }

  if (machineFound) {
    cerrarModalMoverMaquina();
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`Máquina asignada exitosamente al sitio: ${nuevaUbicacion}`, 'success');
    }
    
    // Re-renderizar vistas activas
    if (document.getElementById('modal-detalle-cliente-overlay').classList.contains('open')) {
      verDetalleCliente(clienteNombre);
    }
    if (document.getElementById('view-maquinaria').classList.contains('active')) {
      renderMaquinaria();
    }
  } else {
    alert('No se pudo encontrar la máquina para mover.');
  }
}

// ===== MODAL TRASPASAR MÁQUINA DE CLIENTE (TRASPASO) =====
function abrirModalTraspasarMaquina(clienteNombre, idInterno) {
  const form = document.getElementById('form-traspasar-maquina');
  if (form) form.reset();
  
  document.getElementById('tm-idInterno').value = idInterno;
  document.getElementById('tm-cliente-origen').value = clienteNombre;
  
  // Buscar máquina
  let maquina = null;
  const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
  if (clienteObj && clienteObj.maquinas) {
    maquina = clienteObj.maquinas.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
  }
  if (!maquina) {
    maquina = maquinariaDb.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
  }

  const infoEl = document.getElementById('tm-maquina-info');
  const metaEl = document.getElementById('tm-maquina-meta');
  
  if (maquina) {
    if (infoEl) infoEl.textContent = `${maquina.marca || ''} ${maquina.modelo || 'Sin Modelo'}`;
    if (metaEl) metaEl.textContent = `Serie: ${maquina.serie || 'N/A'} | ID: ${maquina.idInterno || maquina.id || 'N/A'}`;
  } else {
    if (infoEl) infoEl.textContent = 'Máquina no encontrada';
    if (metaEl) metaEl.textContent = `ID: ${idInterno}`;
  }

  // Cargar clientes en select
  const selectCliente = document.getElementById('tm-cliente-destino');
  if (selectCliente) {
    selectCliente.innerHTML = '<option value="" disabled selected>Selecciona el nuevo cliente...</option>';
    
    // Todos los clientes de clientesDb excepto el cliente actual
    const otrosClientes = clientesDb.filter(c => c.nombre !== clienteNombre).sort((a, b) => a.nombre.localeCompare(b.nombre));
    otrosClientes.forEach(c => {
      const option = document.createElement('option');
      option.value = c.nombre;
      option.textContent = c.nombre;
      selectCliente.appendChild(option);
    });
  }

  // Limpiar ubicaciones de destino
  const selectUbi = document.getElementById('tm-ubicacion-destino');
  if (selectUbi) {
    selectUbi.innerHTML = '<option value="">Selecciona el sitio de destino...</option>';
  }

  lucide.createIcons();
  document.getElementById('modal-traspasar-maquina-overlay').classList.add('open');
};

function cerrarModalTraspasarMaquina(e) {
  if (e && e.target !== document.getElementById('modal-traspasar-maquina-overlay')) return;
  document.getElementById('modal-traspasar-maquina-overlay').classList.remove('open');
};

function cargarSitiosParaTraspaso(clienteDestinoNombre) {
  const selectUbi = document.getElementById('tm-ubicacion-destino');
  if (!selectUbi) return;
  
  selectUbi.innerHTML = '<option value="">Selecciona el sitio de destino...</option>';
  
  const clienteObj = clientesDb.find(c => c.nombre === clienteDestinoNombre);
  if (clienteObj) {
    const sitios = getNombresDeSitiosParaCliente(clienteObj);
    sitios.forEach(sn => {
      const option = document.createElement('option');
      option.value = sn;
      option.textContent = sn;
      selectUbi.appendChild(option);
    });
  }
};

function guardarTraspasarMaquina(e) {
  e.preventDefault();
  const idInterno = document.getElementById('tm-idInterno').value;
  const clienteOrigen = document.getElementById('tm-cliente-origen').value;
  const clienteDestino = document.getElementById('tm-cliente-destino').value;
  const sitioDestino = document.getElementById('tm-ubicacion-destino').value;
  
  if (!clienteDestino || !sitioDestino) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Por favor completa todos los campos del traspaso.', 'error');
    } else {
      alert('Por favor completa todos los campos del traspaso.');
    }
    return;
  }

  // Encontrar el usuario de sesión para la bitácora
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const currentUserName = currentUser ? currentUser.nombre : 'Administrador';

  // Buscar sitio destino id
  const destClientObj = clientesDb.find(c => c.nombre === clienteDestino);
  let sitioId = null;
  if (destClientObj) {
    const existSitio = sitiosDb.find(s => s.cliente === destClientObj.id && s.nombre === sitioDestino);
    if (existSitio) {
      sitioId = existSitio.id;
    }
  }

  let maquina = null;
  let machineFound = false;

  // Evento de traspaso para la bitácora
  const transferEvent = {
    fecha: new Date().toISOString(),
    usuario: currentUserName,
    tipo: 'traspaso',
    clienteAnterior: clienteOrigen,
    clienteNuevo: clienteDestino,
    sitioAnterior: '',
    sitioNuevo: sitioDestino
  };

  // 1. Buscar en maquinariaDb (máquinas de SAP/Supabase)
  const maqSapIdx = maquinariaDb.findIndex(m => m.id === idInterno || m.idInterno === idInterno || m.serie === idInterno);
  if (maqSapIdx >= 0) {
    maquina = maquinariaDb[maqSapIdx];
    transferEvent.sitioAnterior = maquina.ubicacion || 'Sin Ubicación';
    
    // Actualizar datos
    maquina.cliente = clienteDestino;
    maquina.ubicacion = sitioDestino;
    maquina.sitio_id = sitioId;

    if (!maquina.customData) maquina.customData = {};
    maquina.customData.ubicacion = sitioDestino;

    // Heredar coordenadas del sitio destino si están registradas
    const sitioDestObj = sitiosDb.find(s => s.nombre === sitioDestino && destClientObj && s.cliente === destClientObj.id);
    if (sitioDestObj) {
      maquina.latitud = sitioDestObj.latitud || sitioDestObj.lat || null;
      maquina.longitud = sitioDestObj.longitud || sitioDestObj.lon || sitioDestObj.lng || null;
      maquina.customData.latitud = maquina.latitud;
      maquina.customData.longitud = maquina.longitud;
    }

    // Inicializar e inyectar en bitácora
    if (!maquina.customData.bitacora) maquina.customData.bitacora = [];
    maquina.customData.bitacora.unshift(transferEvent);

    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
    if (window.pushToSupabase) {
      window.pushToSupabase('maquinaria', maquina);
    }
    machineFound = true;
  } else {
    // 2. Buscar en las máquinas manuales del cliente
    const clienteOrigObj = clientesDb.find(c => c.nombre === clienteOrigen);
    if (clienteOrigObj && clienteOrigObj.maquinas) {
      const maqManualIdx = clienteOrigObj.maquinas.findIndex(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
      if (maqManualIdx >= 0) {
        maquina = { ...clienteOrigObj.maquinas[maqManualIdx] };
        transferEvent.sitioAnterior = maquina.ubicacion || 'Sin Ubicación';
        
        // Remover de cliente origen
        clienteOrigObj.maquinas.splice(maqManualIdx, 1);
        if (window.pushToSupabase) {
          window.pushToSupabase('clientes', clienteOrigObj);
        }

        // Actualizar datos de máquina
        maquina.ubicacion = sitioDestino;
        maquina.sitio_id = sitioId;

        // Heredar coordenadas del sitio destino si están registradas
        const sitioDestObj = sitiosDb.find(s => s.nombre === sitioDestino && destClientObj && s.cliente === destClientObj.id);
        if (sitioDestObj) {
          maquina.latitud = sitioDestObj.latitud || sitioDestObj.lat || null;
          maquina.longitud = sitioDestObj.longitud || sitioDestObj.lon || sitioDestObj.lng || null;
        }

        if (!maquina.customData) maquina.customData = {};
        maquina.customData.ubicacion = sitioDestino;

        // Inicializar e inyectar en bitácora
        if (!maquina.customData.bitacora) maquina.customData.bitacora = [];
        maquina.customData.bitacora.unshift(transferEvent);

        // Agregar a cliente destino
        if (destClientObj) {
          if (!destClientObj.maquinas) destClientObj.maquinas = [];
          destClientObj.maquinas.push(maquina);
          localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
          if (window.pushToSupabase) {
            window.pushToSupabase('clientes', destClientObj);
            window.pushToSupabase('maquinaria', { ...maquina, cliente: destClientObj.id });
          }
        }
        machineFound = true;
      }
    }
  }

  if (machineFound) {
    window.cerrarModalTraspasarMaquina();
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`El traspaso de la maquinaria se ha registrado exitosamente.`, 'success');
    } else {
      alert(`El traspaso de la maquinaria se ha registrado exitosamente.`);
    }
    
    // Re-renderizar vistas activas
    if (document.getElementById('modal-detalle-cliente-overlay').classList.contains('open')) {
      verDetalleCliente(clienteOrigen);
    }
    if (document.getElementById('view-maquinaria').classList.contains('active')) {
      renderMaquinaria();
    }
  } else {
    alert('No se pudo encontrar la máquina para realizar el traspaso.');
  }
};


if (typeof window !== "undefined") {
  window.setCliView = setCliView;
  window.abrirDesgloseSAP = abrirDesgloseSAP;
  window.toggleSortDesglose = toggleSortDesglose;
  window.renderDesgloseSAP = renderDesgloseSAP;
  window.cerrarDesgloseSAP = cerrarDesgloseSAP;
  window.toggleSortClientes = toggleSortClientes;
  window.calcularDisponibilidadFlota = calcularDisponibilidadFlota;
  window.renderClientes = renderClientes;
  window.verDetalleCliente = verDetalleCliente;
  window.cerrarDetalleMaquina = cerrarDetalleMaquina;
  window.abrirDetalleSitio = abrirDetalleSitio;
  window.cerrarDetalleSitio = cerrarDetalleSitio;
  window.guardarCoordenadasSitio = guardarCoordenadasSitio;
  window.verServiciosMaquina = verServiciosMaquina;
  window.guardarPersonalCliente = guardarPersonalCliente;
  window.eliminarSitioDeClienteAdmin = eliminarSitioDeClienteAdmin;
  window.cerrarDetalleCliente = cerrarDetalleCliente;
  window.abrirModalCliente = abrirModalCliente;
  window.cerrarCliente = cerrarCliente;
  window.agregarMaquinaField = agregarMaquinaField;
  window.guardarCliente = guardarCliente;
  window.abrirModalAgregarMaquina = abrirModalAgregarMaquina;
  window.cerrarModalAgregarMaquina = cerrarModalAgregarMaquina;
  window.abrirModalFusionarMaquinas = abrirModalFusionarMaquinas;
  window.cerrarModalFusionarMaquinas = cerrarModalFusionarMaquinas;
  window.fusionarMaquinarias = fusionarMaquinarias;
  window.toggleVentaTercero = toggleVentaTercero;
  window.toggleMultiempresaSection = toggleMultiempresaSection;
  window.desmarcarTodasMultiempresas = desmarcarTodasMultiempresas;
  window.filtrarMultiempresaList = filtrarMultiempresaList;
  window.editarMaquina = editarMaquina;
  window.guardarNuevaMaquina = guardarNuevaMaquina;
  window.eliminarMaquinaActual = eliminarMaquinaActual;
  window.abrirModalMoverMaquina = abrirModalMoverMaquina;
  window.cerrarModalMoverMaquina = cerrarModalMoverMaquina;
  window.guardarMoverMaquina = guardarMoverMaquina;
  window.abrirModalTraspasarMaquina = abrirModalTraspasarMaquina;
  window.cerrarModalTraspasarMaquina = cerrarModalTraspasarMaquina;
  window.cargarSitiosParaTraspaso = cargarSitiosParaTraspaso;
  window.guardarTraspasarMaquina = guardarTraspasarMaquina;
}


// Exportar funciones del módulo de Clientes para ES modules
export {
  setCliView,
  abrirDesgloseSAP,
  toggleSortDesglose,
  renderDesgloseSAP,
  cerrarDesgloseSAP,
  toggleSortClientes,
  calcularDisponibilidadFlota,
  renderClientes,
  verDetalleCliente,
  cerrarDetalleMaquina,
  abrirDetalleSitio,
  cerrarDetalleSitio,
  guardarCoordenadasSitio,
  verServiciosMaquina,
  guardarPersonalCliente,
  eliminarSitioDeClienteAdmin,
  cerrarDetalleCliente,
  abrirModalCliente,
  cerrarCliente,
  agregarMaquinaField,
  guardarCliente,
  abrirModalAgregarMaquina,
  cerrarModalAgregarMaquina,
  abrirModalFusionarMaquinas,
  cerrarModalFusionarMaquinas,
  fusionarMaquinarias,
  toggleVentaTercero,
  toggleMultiempresaSection,
  desmarcarTodasMultiempresas,
  filtrarMultiempresaList,
  editarMaquina,
  guardarNuevaMaquina,
  eliminarMaquinaActual,
  abrirModalMoverMaquina,
  cerrarModalMoverMaquina,
  guardarMoverMaquina,
  abrirModalTraspasarMaquina,
  cerrarModalTraspasarMaquina,
  cargarSitiosParaTraspaso,
  guardarTraspasarMaquina
};
