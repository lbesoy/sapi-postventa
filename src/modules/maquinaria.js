/**
 * Módulo de Catálogo de Maquinaria, Refacciones y Sitios - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { cleanMojibake, normStr, safeFormatDate, formatFechaHoraAmigable, urlToDataUri } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";


// Variables de estado del módulo
if (typeof window !== "undefined") {
  window.currentMaqView = window.currentMaqView || "lista";
  window.currentMaqSortCol = window.currentMaqSortCol || "reciente";
  window.currentMaqSortDir = window.currentMaqSortDir || "desc";
  window.refaccionesViewMode = (typeof localStorage !== "undefined" ? localStorage.getItem("sapi_ref_view_mode") : null) || "table";
}

// ===== MAQUINARIA VIEW =====
let currentMaqView = 'lista';
let maqMap = null;
let maqMapMarkers = [];

function setMaqView(view) {
  currentMaqView = view;
  const btnLista = document.getElementById('btn-maq-lista');
  const btnMapa = document.getElementById('btn-maq-mapa');
  
  if (btnLista) {
    btnLista.style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
    btnLista.style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
    btnLista.style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  }
  if (btnMapa) {
    btnMapa.style.background = view === 'mapa' ? 'var(--accent-light)' : 'transparent';
    btnMapa.style.color = view === 'mapa' ? 'var(--accent)' : 'var(--text-muted)';
    btnMapa.style.borderColor = view === 'mapa' ? 'var(--accent)' : 'transparent';
  }
  
  document.getElementById('maquinaria-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
  const pagCtr = document.getElementById('maquinaria-pagination');
  if (pagCtr) pagCtr.style.display = view === 'lista' ? 'flex' : 'none';
  
  document.getElementById('maquinaria-map-wrapper').style.display = view === 'mapa' ? 'block' : 'none';
  
  if (view === 'mapa') {
    if (!maqMap) {
      // Centro de México aproximado por defecto
      maqMap = L.map('maquinaria-map').setView([23.6345, -102.5528], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      }).addTo(maqMap);
    }
    setTimeout(() => {
      maqMap.invalidateSize();
      renderMaquinaria(); // Forzar update de pines
    }, 200);
  }
}

function toggleSortMaquinaria(col) {
  if (currentMaqSortCol === col) {
    currentMaqSortDir = currentMaqSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentMaqSortCol = col;
    currentMaqSortDir = 'asc';
  }
  renderMaquinaria();
}

function renderMaquinaria() {
  const body = document.getElementById('tabla-body-maquinaria');
  if (!body) return;

  const q = (document.getElementById('search-maquinaria')?.value || '').toLowerCase();
  
  // Si es rol empresa, solo vemos las suyas (usando el nombre del user logueado)
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
  if (nombreEmpresaLogged) nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
  const canEdit = currentSession.viewMode !== 'consulta' && !isEmpresa;
  const canViewKits = ['superadmin', 'admin', 'supervisor'].includes(String(currentSession.viewMode || currentSession.rol || currentSession.realRol || '').toLowerCase().trim());

  let allMachines = [];
  
  // Agregar máquinas de SAP
  maquinariaDb.forEach(m => {
    const linked = m.customData?.empresasVinculadas || m.customData?.clientesAdicionales || [];
    if (isEmpresa) {
      if (!nombreEmpresaLogged) return;
      const mcli = String(m.cliente || '').toLowerCase().trim();
      const isLinked = Array.isArray(linked) && linked.some(c => String(c).toLowerCase().trim() === nombreEmpresaLogged);
      if (mcli !== nombreEmpresaLogged && !isLinked) return;
    }

    // Resolve latest horometer
    let horometroVal = m.horometro || m.customData?.horometro || '';
    if (!horometroVal) {
      const snMatch = m.serie && m.serie !== 'N/A' ? `(SN: ${m.serie})` : null;
      const maqOrdenes = ordenes.filter(o => 
        o.maquina === m.idInterno || 
        (m.serie && m.serie !== 'N/A' && o.maquina === m.serie) || 
        o.serie === m.idInterno || 
        (m.serie && m.serie !== 'N/A' && o.serie === m.serie) || 
        (snMatch && o.equipo && o.equipo.includes(snMatch)) || 
        (o.equipo && o.equipo.includes(m.idInterno)) ||
        (o.equipo && o.equipo === m.idInterno)
      );
      const sortedOrdenes = [...maqOrdenes].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
      const ordenConHorometro = sortedOrdenes.find(o => o.horometro_real || o.horometro);
      if (ordenConHorometro) {
        horometroVal = ordenConHorometro.horometro_real || ordenConHorometro.horometro;
      }
    }

    allMachines.push({
      cliente: m.cliente || 'N/A',
      idInterno: m.idInterno || m.id || m.serie || 'N/A',
      uniqueId: m.id || m.idInterno,
      tipo: m.tipo || m.customData?.tipo || 'N/A',
      marca: m.marca || '',
      modelo: m.modelo || m.descripcion || 'Sin Modelo',
      serie: m.serie || 'N/A',
      numeroEconomico: m.numeroEconomico || m.customData?.numeroEconomico || 'N/A',
      numeroMotor: m.numeroMotor || m.customData?.numeroMotor || 'N/A',
      horometro: horometroVal || 'N/A',
      anio: m.anio || 'N/A',
      venta: m.venta || m.customData?.venta || '',
      ubicacion: m.ubicacion || m.customData?.ubicacion || m.cliente || 'N/A',
      latitud: m.latitud || m.customData?.latitud,
      longitud: m.longitud || m.customData?.longitud,
      customData: m.customData || {}
    });
  });

  // Combinar con máquinas creadas manualmente en clientesDb
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(m => {
        const linked = m.customData?.empresasVinculadas || m.customData?.clientesAdicionales || [];
        const isLinked = Array.isArray(linked) && linked.some(comp => String(comp).toLowerCase().trim() === nombreEmpresaLogged);
        
        if (isEmpresa && String(c.nombre).toLowerCase().trim() !== nombreEmpresaLogged && !isLinked) return; // Filtro de seguridad
        
        // Resolve latest horometer
        let horometroVal = m.horometro || m.customData?.horometro || '';
        if (!horometroVal) {
          const snMatch = m.serie && m.serie !== 'N/A' ? `(SN: ${m.serie})` : null;
          const maqOrdenes = ordenes.filter(o => 
            o.maquina === m.idInterno || 
            (m.serie && m.serie !== 'N/A' && o.maquina === m.serie) || 
            o.serie === m.idInterno || 
            (m.serie && m.serie !== 'N/A' && o.serie === m.serie) || 
            (snMatch && o.equipo && o.equipo.includes(snMatch)) || 
            (o.equipo && o.equipo.includes(m.idInterno)) ||
            (o.equipo && o.equipo === m.idInterno)
          );
          const sortedOrdenes = [...maqOrdenes].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
          const ordenConHorometro = sortedOrdenes.find(o => o.horometro_real || o.horometro);
          if (ordenConHorometro) {
            horometroVal = ordenConHorometro.horometro_real || ordenConHorometro.horometro;
          }
        }

        // En base a que la maquinaria es 100% manual y no viene de SAP,
        // no ocultamos por serie duplicada para evitar que pruebas o errores de capa 8
        // hagan pensar al usuario que la máquina se borró.
        // Solo evitamos duplicados si por algún milagro tienen el mismo ID interno exacto ya en la lista.
        const isDuplicate = allMachines.some(sm => sm.idInterno === m.idInterno);
        if (!isDuplicate) {
            allMachines.push({
              cliente: c.nombre,
              idInterno: m.idInterno || m.id || m.serie || 'N/A',
              uniqueId: m.id || m.idInterno,
              tipo: m.tipo || 'N/A',
              marca: m.marca || '',
              modelo: m.modelo || 'Sin Modelo',
              serie: m.serie || 'N/A',
              numeroEconomico: m.numeroEconomico || 'N/A',
              numeroMotor: m.numeroMotor || 'N/A',
              horometro: horometroVal || 'N/A',
              anio: m.anio || 'N/A',
              venta: m.venta || '',
              ubicacion: m.ubicacion || 'N/A',
              latitud: m.latitud,
              longitud: m.longitud,
              customData: m.customData || {}
            });
        }
      });
    }
  });

  // RENDERIZAR BANNER KPI DISPONIBILIDAD DE FLOTA EN MAQUINARIA
  const maqKpiEl = document.getElementById('maq-kpis-flota-container');
  if (maqKpiEl) {
    const globalDisp = calcularDisponibilidadFlota(allMachines, ordenes);
    maqKpiEl.innerHTML = `
      <div class="stats-grid" style="margin-bottom: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(79,142,247,0.12);color:var(--accent);"><i data-lucide="settings-2"></i></div>
          <div>
            <div class="stat-label">Total en Flota</div>
            <div class="stat-value">${globalDisp.total}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:var(--green);"><i data-lucide="check-circle-2"></i></div>
          <div>
            <div class="stat-label">Equipos Operativos</div>
            <div class="stat-value" style="color:var(--green);">${globalDisp.operativos}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(239,68,68,0.12);color:var(--red);"><i data-lucide="wrench"></i></div>
          <div>
            <div class="stat-label">En Mantenimiento</div>
            <div class="stat-value" style="color:${globalDisp.mantenimiento > 0 ? 'var(--red)' : 'var(--text-muted)'};">${globalDisp.mantenimiento}</div>
          </div>
        </div>
        <div class="stat-card" style="border-left: 4px solid ${globalDisp.color};">
          <div class="stat-icon" style="background:${globalDisp.color}18;color:${globalDisp.color};"><i data-lucide="activity"></i></div>
          <div>
            <div class="stat-label">Disponibilidad Global</div>
            <div class="stat-value" style="color:${globalDisp.color};">${globalDisp.porcentaje}%</div>
          </div>
        </div>
      </div>
    `;
  }

  // Opciones de Filtro Dinámico
  const filterSitioEl = document.getElementById('filter-maq-sitio');
  const filterMarcaEl = document.getElementById('filter-maq-marca');
  
  
  const filterSitio = filterSitioEl?.value || '';
  const filterMarca = filterMarcaEl?.value || '';
  

  if (filterSitioEl && filterMarcaEl) {
    const valSitio = filterSitioEl.value;
    const valMarca = filterMarcaEl.value;
    
    const uniqueSitios = [...new Set(allMachines.map(m => m.ubicacion).filter(Boolean))].sort();
    const uniqueMarcas = [...new Set(allMachines.map(m => m.marca).filter(Boolean))].sort();
    
    filterSitioEl.innerHTML = '<option value="">Todos los Sitios</option>' + uniqueSitios.map(s => `<option value="${s}">${s}</option>`).join('');
    filterMarcaEl.innerHTML = '<option value="">Todas las Marcas</option>' + uniqueMarcas.map(m => `<option value="${m}">${m}</option>`).join('');
    
    filterSitioEl.value = uniqueSitios.includes(valSitio) ? valSitio : '';
    filterMarcaEl.value = uniqueMarcas.includes(valMarca) ? valMarca : '';
  }

  // Filtrar
  let filtered = allMachines.filter(m => {
    let matchLinked = false;
    const linked = m.customData?.empresasVinculadas || m.customData?.clientesAdicionales || [];
    if (Array.isArray(linked)) {
      matchLinked = linked.some(comp => comp.toLowerCase().includes(q));
    }
    const matchQ = !q || m.cliente.toLowerCase().includes(q) || m.idInterno.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q) || m.modelo.toLowerCase().includes(q) || m.serie.toLowerCase().includes(q) || matchLinked;
    const matchSitio = !filterSitio || m.ubicacion === filterSitio;
    const matchMarca = !filterMarca || m.marca === filterMarca;
    return matchQ && matchSitio && matchMarca;
  });

  // Ordenar usando variables globales
  if (currentMaqSortCol === 'reciente') {
    filtered.reverse();
  } else {
    filtered.sort((a, b) => {
      let valA = a[currentMaqSortCol] || '';
      let valB = b[currentMaqSortCol] || '';
      
      if (currentMaqSortCol === 'anio' || currentMaqSortCol === 'horometro') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return currentMaqSortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentMaqSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentMaqSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }

  // Actualizar iconos rehaciendo las etiquetas <i>
  ['tipo', 'marca', 'modelo', 'serie', 'numeroEconomico', 'numeroMotor', 'horometro', 'anio', 'cliente'].forEach(col => {
    const icon = document.getElementById('sort-icon-' + col);
    if (icon) {
      const isCurrent = currentMaqSortCol === col;
      const iconName = isCurrent ? (currentMaqSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  const thId = document.getElementById('th-maquinaria-id');
  if (thId) thId.style.display = isEmpresa ? 'none' : '';

  // RENDERIZAR CABECERAS PERSONALIZADAS
  const cfg = (typeof configData !== 'undefined' ? configData : (typeof window !== 'undefined' && window.configData ? window.configData : null));
  const trHeaderMaq = document.querySelector('#view-maquinaria .data-table thead tr');
  if (trHeaderMaq) {
    trHeaderMaq.querySelectorAll('.custom-th-maq').forEach(el => el.remove());
    if (cfg?.mappings?.maquinaria?.customCols) {
      cfg.mappings.maquinaria.customCols.forEach(col => {
        const th = document.createElement('th');
        th.className = 'custom-th-maq';
        th.textContent = col.label;
        trHeaderMaq.insertBefore(th, trHeaderMaq.lastElementChild);
      });
    }
  }

  if (filtered.length === 0) {
    const colspan = (isEmpresa ? 10 : 11) + (cfg?.mappings?.maquinaria?.customCols?.length || 0);
    body.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">No se encontró maquinaria.</td></tr>`;
    actualizarMapaMaquinaria(filtered);
    return;
  }

  body.innerHTML = filtered.map(m => {
    const logoPath = getLogoMarca(m.marca);
    
    let customTds = '';
    if (cfg?.mappings?.maquinaria?.customCols) {
      cfg.mappings.maquinaria.customCols.forEach(col => {
        customTds += `<td data-label="${col.label}" style="font-size:0.85rem;">${m.customData && m.customData[col.label] ? m.customData[col.label] : 'N/A'}</td>`;
      });
    }

    return `
    <tr onclick="verServiciosMaquina('${m.idInterno}', '${m.serie}', '${m.marca.replace(/'/g, "\\'")}', '${m.modelo.replace(/'/g, "\\'")}', '${m.cliente.replace(/'/g, "\\'")}', '${m.ubicacion.replace(/'/g, "\\'")}')" style="cursor:pointer;" class="table-row-hover">
      ${!isEmpresa ? `<td data-label="ID Interno"><span style="font-family:monospace; font-weight:500; color:var(--accent); background:var(--blue-light); padding:0.2rem 0.5rem; border-radius:4px;">${m.idInterno}</span></td>` : ''}
      <td data-label="Tipo">${m.tipo && m.tipo !== 'N/A' ? `<span class="badge" style="background:var(--bg-hover); color:var(--text-primary); border:1px solid var(--border);">${m.tipo}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="Marca">
        <div style="display:flex; align-items:center;">
          ${logoPath ? `<img src="${logoPath}" alt="${m.marca}" onerror="this.onerror=null; this.outerHTML='<span>${m.marca}</span>';" style="${getLogoStyle(m.marca)}"/>` : m.marca || '-'}
        </div>
      </td>
      <td data-label="Modelo" style="font-weight:500;">${m.modelo}</td>
      <td data-label="Serie">${m.serie}</td>
      <td data-label="No. Económico">${m.numeroEconomico && m.numeroEconomico !== 'N/A' ? m.numeroEconomico : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="No. Motor">${m.numeroMotor && m.numeroMotor !== 'N/A' ? m.numeroMotor : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="Horómetro">${m.horometro && m.horometro !== 'N/A' ? `${Number(m.horometro).toLocaleString()} h` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="Año">${m.anio}</td>
      <td data-label="Cliente / Ubicación">
        <div style="font-weight:500;">${m.cliente}</div>
        ${m.ubicacion !== 'N/A' ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${m.ubicacion}</div>` : ''}
        ${m.customData && (m.customData.empresasVinculadas || m.customData.clientesAdicionales) ? (() => {
          const linked = m.customData.empresasVinculadas || m.customData.clientesAdicionales || [];
          if (Array.isArray(linked) && linked.length > 0) {
            return `<div style="font-size:0.7rem; color:var(--accent); margin-top:0.2rem; font-weight:500; display:flex; align-items:center; gap:3px;"><i data-lucide="building" style="width:11px;height:11px;flex-shrink:0;"></i>Multi: ${linked.join(', ')}</div>`;
          }
          return '';
        })() : ''}
      </td>
      ${customTds}
      <td data-label="">
        <div style="display:flex; gap:0.25rem;">
          ${canViewKits ? `
          <button class="action-btn" onclick="event.stopPropagation(); window.abrirModalKitsServicio('${(m.modelo || '').replace(/'/g, "\\'")}')" title="Ver Kits de Servicio para ${m.modelo || 'esta máquina'}" style="color:#2563eb; background:rgba(37,99,235,0.06); border-color:rgba(37,99,235,0.2);">
            <i data-lucide="package"></i>
          </button>
          ` : ''}
          <button class="action-btn" onclick="event.stopPropagation(); verDetalleCliente('${m.cliente.replace(/'/g, "\\'")}')" title="Ver Perfil de la Empresa">
            <i data-lucide="building-2"></i>
          </button>
          ${canEdit ? `
          <button class="action-btn" onclick="event.stopPropagation(); editarMaquina('${m.cliente.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Editar Máquina">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); abrirModalMoverMaquina('${m.cliente.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Mover de Sitio">
            <i data-lucide="map-pin"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); abrirModalTraspasarMaquina('${m.cliente.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Traspasar Maquinaria" style="color:#8b5cf6;">
            <i data-lucide="arrow-right-left"></i>
          </button>
          ` : ''}
        </div>
      </td>
    </tr>
    `;
  }).join('');
  
  actualizarMapaMaquinaria(filtered);
  lucide.createIcons();
  
  // Inicializar resizers cada vez que se renderiza o se ordena, asegurando que estén activos
  setTimeout(initTableResizers, 100);
}

function actualizarMapaMaquinaria(filteredData) {
  if (!maqMap || currentMaqView !== 'mapa') return;
  
  // Limpiar pines existentes
  maqMapMarkers.forEach(m => maqMap.removeLayer(m));
  maqMapMarkers = [];
  
  let bounds = [];
  let plotted = 0;
  
  const groups = {};
  
  filteredData.forEach(m => {
    // Buscar Latitud y Longitud en customData
    let lat = null, lng = null;
    if (m.customData) {
      // Buscar llaves que digan latitud/longitud ignorando mayúsculas
      const keys = Object.keys(m.customData);
      const kLat = keys.find(k => k.toLowerCase() === 'latitud');
      const kLng = keys.find(k => k.toLowerCase() === 'longitud');
      if (kLat) lat = parseFloat(m.customData[kLat]);
      if (kLng) lng = parseFloat(m.customData[kLng]);
    }
    
    // Fallback a las coordenadas manuales si existen
    if (!lat && m.latitud) lat = parseFloat(m.latitud);
    if (!lng && m.longitud) lng = parseFloat(m.longitud);
    
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const key = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
      if (!groups[key]) {
        groups[key] = {
          lat,
          lng,
          maquinas: []
        };
      }
      groups[key].maquinas.push(m);
    }
  });
  
  Object.values(groups).forEach(g => {
    const mainMaq = g.maquinas[0];
    const count = g.maquinas.length;
    
    const uniqueBrands = [...new Set(g.maquinas.map(m => (m.marca || '').toLowerCase().trim()))];
    const isMultiBrand = uniqueBrands.length > 1;
    const logoPath = isMultiBrand ? '' : getLogoMarca(mainMaq.marca);
    
    const badgeHtml = count > 1 ? `
      <div style="position:absolute; top:-5px; right:-5px; background:var(--red, #ef4444); color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:bold; border:1.5px solid white; z-index:10;">
        ${count}
      </div>
    ` : '';
    
    const innerPinHtml = isMultiBrand ? `
      <div style="background:white; border-radius:50%; padding:3px; box-shadow:0 3px 6px rgba(0,0,0,0.3); width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:2px solid var(--accent); position:relative; z-index:2; color:var(--accent);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        ${badgeHtml}
      </div>
      <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid var(--accent); position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); z-index:1;"></div>
    ` : `
      <div style="background:white; border-radius:50%; padding:3px; box-shadow:0 3px 6px rgba(0,0,0,0.3); width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:2px solid var(--accent); position:relative; z-index:2;">
        <img src="${logoPath}" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" onerror="this.src='logo_transparent.png'"/>
        ${badgeHtml}
      </div>
      <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid var(--accent); position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); z-index:1;"></div>
    `;

    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: innerPinHtml,
      iconSize: [42, 50],
      iconAnchor: [21, 50],
      popupAnchor: [0, -50]
    });

    let popupContentHtml = `<div style="font-family:'Inter',sans-serif; min-width:200px;">`;
    if (count === 1) {
      const logo = getLogoMarca(mainMaq.marca);
      popupContentHtml += `
        <div style="text-align:center;">
          <div style="display:flex; align-items:center; justify-content:center; gap:0.4rem; margin-bottom:0.25rem;">
            ${logo ? `<img src="${logo}" style="width:16px; height:16px; object-fit:contain; border-radius:50%; border:1px solid #ddd; background:white;" onerror="this.style.display='none';"/>` : ''}
            <span style="font-weight:600; font-size:0.9rem;">${mainMaq.modelo}</span>
          </div>
          <div style="font-size:0.75rem; color:#666;">SN: ${mainMaq.serie}</div>
          <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid #ddd; font-size:0.8rem;">
            <strong>${mainMaq.cliente}</strong><br>
            ${mainMaq.ubicacion !== 'N/A' ? mainMaq.ubicacion : ''}
          </div>
        </div>
      `;
    } else {
      popupContentHtml += `
        <div style="font-weight:700; font-size:0.85rem; border-bottom:1px solid #ddd; padding-bottom:0.3rem; margin-bottom:0.4rem; color:var(--accent);">
          ${count} Máquinas en este Sitio
        </div>
        <div style="max-height:150px; overflow-y:auto; display:flex; flex-direction:column; gap:0.4rem; padding-right:5px; margin-bottom:0.4rem;">
          ${g.maquinas.map(m => {
            const logo = getLogoMarca(m.marca);
            return `
              <div style="font-size:0.78rem; border-bottom:1px dashed #eee; padding-bottom:0.25rem; display:flex; align-items:center; gap:0.4rem;">
                ${logo ? `<img src="${logo}" style="width:16px; height:16px; object-fit:contain; border-radius:50%; border:1px solid #ddd; background:white;" onerror="this.style.display='none';"/>` : ''}
                <div style="flex:1;">
                  <strong style="color:var(--text-primary);">${m.modelo}</strong> <span style="font-size:0.7rem; color:#777;">(SN: ${m.serie})</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top:0.4rem; font-size:0.75rem; color:#555; border-top:1px solid #ddd; padding-top:0.4rem;">
          <strong>Cliente:</strong> ${mainMaq.cliente}<br>
          ${mainMaq.ubicacion !== 'N/A' ? `<strong>Ubicación:</strong> ${mainMaq.ubicacion}` : ''}
        </div>
      `;
    }
    popupContentHtml += `</div>`;

    const marker = L.marker([g.lat, g.lng], { icon: customIcon }).bindPopup(popupContentHtml);
    
    marker.on('dblclick', function() {
      maqMap.flyTo([g.lat, g.lng], 18, { animate: true, duration: 1.5 });
    });

    marker.addTo(maqMap);
    maqMapMarkers.push(marker);
    bounds.push([g.lat, g.lng]);
    plotted++;
  });
  
  if (bounds.length > 0) {
    maqMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 });
  } else if (plotted === 0) {
    // No hay datos, resetear al centro de México
    maqMap.setView([23.6345, -102.5528], 5);
  }
}

function switchRefTab(tab) {
  const btnCat = document.getElementById('btn-tab-ref-catalogo');
  const btnPen = document.getElementById('btn-tab-ref-pendientes');
  const cat = document.getElementById('ref-tab-catalogo');
  const pen = document.getElementById('ref-tab-pendientes');
  
  if (tab === 'catalogo') {
    if (btnCat) {
      btnCat.classList.add('active');
      btnCat.style.background = 'var(--bg-card)';
      btnCat.style.color = 'var(--text-primary)';
      btnCat.style.fontWeight = '600';
      btnCat.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    if (btnPen) {
      btnPen.classList.remove('active');
      btnPen.style.background = 'transparent';
      btnPen.style.color = 'var(--text-muted)';
      btnPen.style.fontWeight = '500';
      btnPen.style.boxShadow = 'none';
    }
    if (cat) cat.style.display = 'block';
    if (pen) pen.style.display = 'none';
  } else {
    if (btnCat) {
      btnCat.classList.remove('active');
      btnCat.style.background = 'transparent';
      btnCat.style.color = 'var(--text-muted)';
      btnCat.style.fontWeight = '500';
      btnCat.style.boxShadow = 'none';
    }
    if (btnPen) {
      btnPen.classList.add('active');
      btnPen.style.background = 'var(--bg-card)';
      btnPen.style.color = 'var(--text-primary)';
      btnPen.style.fontWeight = '600';
      btnPen.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    if (cat) cat.style.display = 'none';
    if (pen) pen.style.display = 'block';
    renderRefaccionesPendientes();
  }
}

async function crearOActualizarTicketRefacciones(orden) {
  const refNecesarias = orden.ref_necesarias || [];
  if (refNecesarias.length === 0) return;

  let parentTicketId = orden.soporte || null;
  let ticketPadre = parentTicketId ? tickets.find(t => t.id === parentTicketId || t.folio === parentTicketId) : null;

  let baseFolio = ticketPadre ? ticketPadre.folio : (orden.folio || '');

  if (!baseFolio) {
    console.warn("[crearOActualizarTicketRefacciones] No se encontró folio base para la orden o ticket.");
    return;
  }

  let prefix = '';
  let cleanFolio = baseFolio.trim();
  if (cleanFolio.startsWith('[PRUEBA] ')) {
    prefix = '[PRUEBA] ';
    cleanFolio = cleanFolio.replace('[PRUEBA] ', '').trim();
  } else if (cleanFolio.startsWith('[TEST] ')) {
    prefix = '[TEST] ';
    cleanFolio = cleanFolio.replace('[TEST] ', '').trim();
  }
  
  if (!cleanFolio.toUpperCase().startsWith('TKT-')) {
    cleanFolio = 'TKT-' + cleanFolio;
  }
  
  const targetFolio = cleanFolio.endsWith('-A') ? `${prefix}${cleanFolio}` : `${prefix}${cleanFolio}-A`;
  
  // Resolución robusta de ticketPadre eliminando sufijo -A en el targetFolio si es necesario
  if (!ticketPadre && targetFolio) {
    let cleanTarget = targetFolio.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
    if (cleanTarget.endsWith('-A')) {
      const baseParentFolio = cleanTarget.slice(0, -2);
      ticketPadre = tickets.find(t => {
        let f = t.folio || '';
        f = f.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
        return f === baseParentFolio;
      });
    }
  }

  console.log(`[DEBUG RefAcc] Orden: ${orden.folio}, Soporte: ${orden.soporte}, TargetFolio: ${targetFolio}, Tickets totales: ${tickets.length}`);
  if (ticketPadre) {
    console.log(`[DEBUG RefAcc] Padre encontrado: ${ticketPadre.folio}, Solicitante padre: ${ticketPadre.solicitante}`);
  } else {
    console.log(`[DEBUG RefAcc] Padre NO encontrado.`);
  }

  let ticketExistente = tickets.find(t => t.folio === targetFolio);
  const now = new Date().toISOString();

  const refaccionesMapeadas = refNecesarias.map(r => ({
    marca: r.marca || '',
    codigo: r.clave || r.codigo || 'S/C',
    clave: r.clave || r.codigo || 'S/C',
    nombre: r.descripcion || r.nombre || 'Sin Descripción',
    descripcion: r.descripcion || r.nombre || 'Sin Descripción',
    cantidad: r.cantidad || 1,
    estatusPedido: r.estatusPedido || 'Por Pedir'
  }));

  const ticket = {
    id: ticketExistente ? ticketExistente.id : crypto.randomUUID(),
    folio: targetFolio,
    ordenId: orden.id,
    ordenFolio: orden.folio,
    fecha: ticketExistente ? ticketExistente.fecha : now,
    fechaCreacion: ticketExistente ? ticketExistente.fechaCreacion : now,
    fechaCierre: ticketExistente ? ticketExistente.fechaCierre : null,
    canal: ticketExistente ? ticketExistente.canal : 'sistema',
    contacto: ticketExistente ? ticketExistente.contacto : '',
    asunto: `Refacciones para ${orden.folio || ''}`,
    cliente: orden.cliente,
    sitio: orden.ubicacion || orden.ubicacion_sitio || '',
    solicitante: ticketPadre ? ticketPadre.solicitante : (orden.creadoPor || orden.tecnico || 'Sistema'),
    creadoPor: ticketPadre ? (ticketPadre.creadoPor || ticketPadre.solicitante) : (orden.creadoPor || orden.tecnico || 'Sistema'),
    area: ticketPadre ? (ticketPadre.area || 'Operaciones') : 'Operaciones',
    categoria: 'Refacción',
    prioridad: ticketPadre ? (ticketPadre.prioridad || 'Media') : 'Media',
    asignado: (ticketExistente && ticketExistente.asignado && ticketExistente.asignado !== orden.tecnico) ? ticketExistente.asignado : 'Adrian Franco',
    descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${orden.folio}.`,
    equipo: orden.equipo,
    horometro: orden.horometro_real || orden.horometro || (ticketExistente ? ticketExistente.horometro : ''),
    notas: ticketExistente ? ticketExistente.notes || ticketExistente.notas : '',
    refaccionesSeleccionadas: refaccionesMapeadas,
    cotizacionesAdicionales: ticketExistente ? (ticketExistente.cotizacionesAdicionales || []) : [],
    estado: ticketExistente ? ticketExistente.estado : 'Refacciones',
    cotizacionSAP: ticketExistente ? ticketExistente.cotizacionSAP : '',
    montoCotizacion: ticketExistente ? ticketExistente.montoCotizacion : null,
    cotAceptada: ticketExistente ? ticketExistente.cotAceptada : '',
    motivoRechazo: ticketExistente ? ticketExistente.motivoRechazo : '',
    pedidoSAP: ticketExistente ? ticketExistente.pedidoSAP : '',
    comentariosInternos: ticketExistente ? (ticketExistente.comentariosInternos || []) : [],
    comentariosClientes: ticketExistente ? (ticketExistente.comentariosClientes || []) : [],
    tecnicosAsignados: ticketExistente ? (ticketExistente.tecnicosAsignados || []) : [],
    pdfPedido: ticketExistente ? ticketExistente.pdfPedido : null,
    pdfCotizacion: ticketExistente ? ticketExistente.pdfCotizacion : null,
    esPrueba: orden.esPrueba || false
  };

  if (ticketExistente) {
    tickets = tickets.map(t => t.id === ticket.id ? ticket : t);
  } else {
    tickets.unshift(ticket);
  }

  try {
    safeSetJSON('sapi_tickets', tickets);
  } catch (err) {
    console.error('Error al guardar sapi_tickets en localStorage:', err);
  }

  if (window.supabaseClient) {
    try {
      await window.pushToSupabase('tickets', ticket);
    } catch (err) {
      console.error(`[crearOActualizarTicketRefacciones] Error al sincronizar ticket con Supabase:`, err);
    }
  }

  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    window.asegurarGuiaEnvioParaTicket(ticket);
  }

  if (typeof updateTicketBadge === 'function') updateTicketBadge();
  if (typeof renderTickets === 'function') {
    renderTickets();
    renderTickets('dash-tickets');
  }
};

let refaccionesViewMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('sapi_ref_view_mode') : null) || 'table';

function setRefaccionesViewMode(mode) {
  refaccionesViewMode = mode;
  localStorage.setItem('sapi_ref_view_mode', mode);
  renderRefaccionesPendientes();
};

function renderRefaccionesPendientes() {
  const grid = document.getElementById('ref-pendientes-grid');
  const tableContainer = document.getElementById('ref-pendientes-table-container');
  const tableBody = document.getElementById('ref-pendientes-table-body');
  const piecesContainer = document.getElementById('ref-pendientes-pieces-container');
  const piecesBody = document.getElementById('ref-pendientes-pieces-body');
  const btnTable = document.getElementById('btn-ref-view-table');
  const btnPieces = document.getElementById('btn-ref-view-pieces');

  if (!tableContainer) return;

  // Toggle dynamic container display and update active class/styles
  if (refaccionesViewMode === 'pieces') {
    if (piecesContainer) piecesContainer.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    if (grid) grid.style.display = 'none';
    
    if (btnPieces) {
      btnPieces.classList.add('active');
      btnPieces.style.background = 'var(--bg-card)';
      btnPieces.style.color = 'var(--text-primary)';
      btnPieces.style.fontWeight = '600';
      btnPieces.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    if (btnTable) {
      btnTable.classList.remove('active');
      btnTable.style.background = 'transparent';
      btnTable.style.color = 'var(--text-muted)';
      btnTable.style.fontWeight = '500';
      btnTable.style.boxShadow = 'none';
    }
  } else {
    if (piecesContainer) piecesContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    if (grid) grid.style.display = 'none';
    
    if (btnPieces) {
      btnPieces.classList.remove('active');
      btnPieces.style.background = 'transparent';
      btnPieces.style.color = 'var(--text-muted)';
      btnPieces.style.fontWeight = '500';
      btnPieces.style.boxShadow = 'none';
    }
    if (btnTable) {
      btnTable.classList.add('active');
      btnTable.style.background = 'var(--bg-card)';
      btnTable.style.color = 'var(--text-primary)';
      btnTable.style.fontWeight = '600';
      btnTable.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
  }

  if (grid) grid.innerHTML = '';
  if (tableBody) tableBody.innerHTML = '';
  if (piecesBody) piecesBody.innerHTML = '';
  
  const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  window.obtenerOrdenAsociadaATicketRefacciones = window.obtenerOrdenAsociadaTicket;

  const allTickets = (typeof getFilteredTickets === 'function' ? getFilteredTickets() : tickets) || [];
  let refTickets = allTickets.filter(t => {
    if (!t || t.estado === 'Cerrado') return false;
    const cat = String(t.categoria || '').toLowerCase();
    const hasParts = Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0;
    const isRefCat = cat.includes('refacci') || cat.includes('garant') || (t.folio && t.folio.endsWith('-A'));
    return hasParts || isRefCat;
  });

  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      refTickets = refTickets.filter(t => {
        if (!t) return false;
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    } else {
      refTickets = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  if (userRole === 'tecnico') {
    const tecName = currentUser ? currentUser.nombre : '';
    if (tecName && !isTestModeActive()) {
      refTickets = refTickets.filter(t => {
        const assigned = (t.asignado || '').split(',').map(s => s.trim());
        return assigned.includes(tecName) || (t.tecnicosAsignados && t.tecnicosAsignados.includes(tecName));
      });
    }
  }

  refTickets.sort((a, b) => new Date(b.fechaCreacion || b.fecha || 0) - new Date(a.fechaCreacion || a.fecha || 0));

  if (refTickets.length === 0) {
    if (refaccionesViewMode === 'cards') {
      if (grid) grid.innerHTML = '<div style="color:var(--text-muted); padding:1rem; grid-column: 1/-1;">No hay tickets de refacciones pendientes en este momento.</div>';
    } else if (refaccionesViewMode === 'pieces') {
      if (piecesBody) piecesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem; font-style:italic;">No hay piezas de refacciones pendientes en este momento.</td></tr>';
    } else {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem; font-style:italic;">No hay tickets de refacciones pendientes en este momento.</td></tr>';
    }
    return;
  }

  // ===== VISTA POR PIEZAS (PIECES MODE) =====
  if (refaccionesViewMode === 'pieces' && piecesBody) {
    let totalPiecesCount = 0;
    refTickets.forEach(t => {
      const originalFolio = (t.folio || '').replace('-A', '');
      const parentTicket = tickets.find(x => x.folio === originalFolio && x.id !== t.id);
      const parentOrder = window.obtenerOrdenAsociadaATicketRefacciones(t);

      const parentLink = `
        <div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; align-items:flex-start;">
          ${parentOrder ? `
          <div style="font-size:0.72rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); verDetalle('${parentOrder.id}')">
            <i data-lucide="file-text" style="width:11px; height:11px; color:var(--text-muted);"></i>
            <span>OS: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentOrder.folio}</span></span>
          </div>` : ''}
          ${parentTicket ? `
          <div style="font-size:0.72rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); editarTicket('${parentTicket.id}')">
            <i data-lucide="link" style="width:11px; height:11px; color:var(--text-muted);"></i>
            <span>Original: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentTicket.folio}</span></span>
          </div>` : ''}
        </div>
      `;

      const parts = (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0)
        ? t.refaccionesSeleccionadas
        : [{ clave: 'N/A', descripcion: t.asunto || 'Refacciones solicitadas', cantidad: 1, estatusPedido: 'Por Pedir', marca: '' }];

      parts.forEach(p => {
        totalPiecesCount++;
        let pStatusColor = '#ef4444';
        let pStatusBg = 'rgba(239, 68, 68, 0.1)';
        if (p.estatusPedido === 'En Tránsito / Pedido') {
          pStatusColor = '#e8820c';
          pStatusBg = 'rgba(232, 130, 12, 0.1)';
        } else if (p.estatusPedido === 'Entregado al Técnico') {
          pStatusColor = '#22c55e';
          pStatusBg = 'rgba(34, 197, 94, 0.1)';
        }
        const pMarca = p.marca || '';
        let brandName = {
          'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
          'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
          'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
          'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
          'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
        }[String(pMarca).toUpperCase()] || pMarca || '';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border)';
        row.style.color = 'var(--text-primary)';
        row.style.fontSize = '0.85rem';
        row.style.cursor = 'pointer';
        row.onclick = () => editarTicket(t.id);

        row.innerHTML = `
          <td style="padding:0.75rem 0.5rem; text-align:center;" onclick="event.stopPropagation();">
            <button class="btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:4px; display:inline-flex; align-items:center; gap:0.25rem; border:none; cursor:pointer;" onclick="editarTicket('${t.id}')">
              <i data-lucide="eye" style="width:12px; height:12px;"></i> Ver
            </button>
          </td>
          <td style="padding:0.75rem 0.5rem; font-family:monospace; font-weight:700;">
            <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start;">
              <span style="background:var(--accent-light); color:var(--accent); padding:0.15rem 0.4rem; border-radius:4px; font-size:0.78rem;">${t.folio}</span>
              ${parentLink}
            </div>
          </td>
          <td style="padding:0.75rem 0.5rem; font-weight:600; line-height:1.3;">
            <span style="color:var(--accent); font-weight:700; margin-right:4px;">${p.cantidad || 1}x</span>
            ${p.descripcion || p.nombre || 'Pieza'}
          </td>
          <td style="padding:0.75rem 0.5rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">
            <div>${p.clave || p.codigo || '—'}</div>
            ${brandName ? `<div style="font-size:0.72rem; color:var(--text-muted); font-family:inherit;">${brandName}</div>` : ''}
          </td>
          <td style="padding:0.75rem 0.5rem; font-weight:500;">
            ${t.cliente || 'Sin cliente'}
          </td>
          <td style="padding:0.75rem 0.5rem; font-size:0.8rem; color:var(--text-secondary); line-height:1.3;">
            <div><i data-lucide="map-pin" style="width:11px; height:11px; vertical-align:middle; margin-right:3px; color:var(--text-muted);"></i> ${t.sitio || 'Sin sitio'}</div>
            ${t.equipo ? `<div style="margin-top:2px;"><i data-lucide="settings-2" style="width:11px; height:11px; vertical-align:middle; margin-right:3px; color:var(--text-muted);"></i> ${t.equipo}</div>` : ''}
          </td>
          <td style="padding:0.75rem 0.5rem; text-align:center;">
            <span class="status-badge" style="font-size:0.72rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; border:1px solid ${pStatusColor}33; padding:0.25rem 0.5rem; border-radius:4px; cursor:pointer; display:inline-block; white-space:nowrap;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${p.clave || p.codigo || ''}', '${p.descripcion || p.nombre || ''}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad || 1}, '${p.marca || ''}')">
              ${p.estatusPedido || 'Por Pedir'}
            </span>
          </td>
          <td style="padding:0.75rem 0.5rem; text-align:center; font-size:0.8rem; color:var(--text-muted); white-space:nowrap;">
            ${new Date(t.fechaCreacion || t.fecha || Date.now()).toLocaleDateString()}
          </td>
        `;
        piecesBody.appendChild(row);
      });
    });

    if (totalPiecesCount === 0) {
      piecesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem; font-style:italic;">No hay piezas solicitadas pendientes en este momento.</td></tr>';
    }
    if (window.lucide) window.lucide.createIcons({ root: piecesContainer });
    return;
  }

  // ===== VISTA CARDS O TABLA DE TICKETS =====
  if (refaccionesViewMode === 'cards') {
    refTickets.forEach(t => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.padding = '1.25rem';
      card.style.position = 'relative';
      card.style.cursor = 'pointer';
      card.style.transition = 'transform 0.2s, box-shadow 0.2s';
      card.onmouseover = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = 'var(--shadow-md)'; };
      card.onmouseout = () => { card.style.transform = 'none'; card.style.boxShadow = 'var(--shadow)'; };

      card.onclick = () => {
        editarTicket(t.id);
      };

      let badgeColor = 'var(--accent, #E8820C)';
      let badgeBg = 'rgba(232, 130, 12, 0.1)';
      if (t.estado === 'Cotización') {
        badgeColor = 'var(--accent-light, #2563eb)';
        badgeBg = 'rgba(37, 99, 235, 0.1)';
      } else if (t.estado === 'Abierto') {
        badgeColor = 'var(--blue, #3b82f6)';
        badgeBg = 'rgba(59, 130, 246, 0.1)';
      }

      const originalFolio = t.folio.replace('-A', '');
      const parentTicket = tickets.find(x => x.folio === originalFolio);
      const parentOrder = window.obtenerOrdenAsociadaATicketRefacciones(t);

      const parts = t.refaccionesSeleccionadas || [];
      let partsHtml = '';
      if (parts.length > 0) {
        partsHtml = `
          <div style="width: 100%; margin-top: 0.5rem; margin-bottom: 0.75rem;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.5px;">Piezas Solicitadas:</div>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              ${parts.map(p => {
                let pStatusColor = '#ef4444';
                let pStatusBg = 'rgba(239, 68, 68, 0.1)';
                if (p.estatusPedido === 'En Tránsito / Pedido') {
                  pStatusColor = '#e8820c';
                  pStatusBg = 'rgba(232, 130, 12, 0.1)';
                } else if (p.estatusPedido === 'Entregado al Técnico') {
                  pStatusColor = '#22c55e';
                  pStatusBg = 'rgba(34, 197, 94, 0.1)';
                }
                const pMarca = p.marca || '';
                let brandName = {
                  'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                  'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                  'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                  'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                  'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
                }[String(pMarca).toUpperCase()] || pMarca || '';
                let detailsText = `Clave: ${p.clave || p.codigo} ${brandName ? `(${brandName})` : ''}`;

                return `
                  <div style="background:var(--bg-secondary); padding:0.4rem 0.6rem; border-radius:6px; font-size:0.85rem; border:1px solid var(--border); display: flex; flex-direction: column; gap: 2px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:600; color:var(--text-primary);">
                        <span style="color:var(--accent); font-weight:700; margin-right:4px;">${p.cantidad}x</span> 
                        ${p.descripcion || p.nombre}
                        <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; display:block; margin-top:2px;">${detailsText}</span>
                      </span>
                      <span class="status-badge" style="font-size:0.7rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:2px 6px; border-radius:4px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${p.clave || p.codigo}', '${p.descripcion || p.nombre}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad}, '${p.marca || ''}')">
                        ${p.estatusPedido || 'Por Pedir'}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        partsHtml = `<div style="font-size:0.85rem; color:var(--text-muted); font-style:italic; margin: 0.5rem 0;">Ninguna pieza registrada.</div>`;
      }

      card.innerHTML = `
        <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <span style="font-weight:800; font-size:1.15rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
            <span style="background:var(--accent-light); color:var(--accent); padding:0.15rem 0.4rem; border-radius:6px; font-size:0.8rem; font-family:monospace;">${t.folio}</span> 
          </span>
          <span class="status-badge" style="font-size:0.75rem; font-weight:700; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor}33; padding:0.25rem 0.5rem; border-radius:6px;">
            ${getTicketEstadoLabel(t)}
          </span>
        </div>
        
        <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:0.5rem;">
          ${t.asunto || 'Ticket de Refacciones'}
        </div>
        
        ${partsHtml}

        <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem; color:var(--text-secondary); width:100%; border-top: 1px dashed var(--border); padding-top: 0.75rem; margin-top:0.5rem;">
          <div style="display:flex; align-items:flex-start; gap:0.5rem;">
            <i data-lucide="building" style="width:14px;height:14px; margin-top:2px; color:var(--text-muted)"></i>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-weight:600; line-height:1.3; color:var(--text-primary);">${t.cliente}</span>
              ${parentOrder ? `
              <div style="font-size:0.75rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); verDetalle('${parentOrder.id}')">
                <i data-lucide="file-text" style="width:11px; height:11px; color:var(--text-muted)"></i>
                <span>OS: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentOrder.folio}</span></span>
              </div>` : ''}
              ${parentTicket ? `
              <div style="font-size:0.75rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); editarTicket('${parentTicket.id}')">
                <i data-lucide="link" style="width:11px; height:11px; color:var(--text-muted)"></i>
                <span>Original: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentTicket.folio}</span></span>
              </div>` : ''}
            </div>
          </div>
          <div style="display:flex; align-items:flex-start; gap:0.5rem;">
            <i data-lucide="map-pin" style="width:14px;height:14px; margin-top:2px; color:var(--text-muted)"></i> 
            <span style="line-height:1.3">${t.sitio || 'Sin sitio'}</span>
          </div>
          ${t.equipo ? `
          <div style="display:flex; align-items:flex-start; gap:0.5rem;">
            <i data-lucide="settings-2" style="width:14px;height:14px; margin-top:2px; color:var(--text-muted)"></i> 
            <span style="line-height:1.3">${t.equipo}</span>
          </div>` : ''}
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <i data-lucide="user" style="width:14px;height:14px; color:var(--text-muted)"></i> 
            <span>Asignado: ${t.asignado || 'Sin asignar'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:var(--text-muted);">
            <i data-lucide="calendar" style="width:12px;height:12px;"></i>
            <span>Creado: ${new Date(t.fechaCreacion || t.fecha).toLocaleDateString()}</span>
          </div>
        </div>
      `;
      
      grid.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons({ root: grid });
  } else if (tableBody) {
    refTickets.forEach(t => {
      const originalFolio = t.folio.replace('-A', '');
      const parentTicket = tickets.find(x => x.folio === originalFolio);
      const parentOrder = window.obtenerOrdenAsociadaATicketRefacciones(t);

      const parentLink = `
        <div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; align-items:flex-start;">
          ${parentOrder ? `
          <div style="font-size:0.72rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); verDetalle('${parentOrder.id}')">
            <i data-lucide="file-text" style="width:11px; height:11px; color:var(--text-muted);"></i>
            <span>OS: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentOrder.folio}</span></span>
          </div>` : ''}
          ${parentTicket ? `
          <div style="font-size:0.72rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="event.stopPropagation(); editarTicket('${parentTicket.id}')">
            <i data-lucide="link" style="width:11px; height:11px; color:var(--text-muted);"></i>
            <span>Original: <span style="text-decoration:underline; font-weight:600; color:var(--text-primary);">${parentTicket.folio}</span></span>
          </div>` : ''}
        </div>
      `;

      const parts = t.refaccionesSeleccionadas || [];
      let partsHtml = '';
      if (parts.length > 0) {
        partsHtml = `
          <div style="display:flex; flex-direction:column; gap:0.35rem;">
            ${parts.map(p => {
              let pStatusColor = '#ef4444';
              let pStatusBg = 'rgba(239, 68, 68, 0.1)';
              if (p.estatusPedido === 'En Tránsito / Pedido') {
                pStatusColor = '#e8820c';
                pStatusBg = 'rgba(232, 130, 12, 0.1)';
              } else if (p.estatusPedido === 'Entregado al Técnico') {
                pStatusColor = '#22c55e';
                pStatusBg = 'rgba(34, 197, 94, 0.1)';
              }
              const pMarca = p.marca || '';
              let brandName = {
                'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
              }[String(pMarca).toUpperCase()] || pMarca || '';
              
              let detailsText = `Clave: ${p.clave || p.codigo} ${brandName ? `(${brandName})` : ''}`;

              return `
                <div style="background:var(--bg-secondary); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; border:1px solid var(--border); width: 100%; max-width: 450px; display: flex; flex-direction: column; gap: 2px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; width: 100%;">
                    <span style="font-weight:500; color:var(--text-primary);">
                      <span style="color:var(--accent); font-weight:700; margin-right:4px;">${p.cantidad}x</span> 
                      ${p.descripcion || p.nombre}
                      <span style="font-size:0.7rem; color:var(--text-muted); font-family:monospace; display:block; margin-top:1px;">${detailsText}</span>
                    </span>
                    <span class="status-badge" style="font-size:0.65rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:1px 5px; border-radius:3px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${p.clave || p.codigo}', '${p.descripcion || p.nombre}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad}, '${p.marca || ''}')">
                      ${p.estatusPedido || 'Por Pedir'}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        partsHtml = `<span style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">Ninguna pieza registrada.</span>`;
      }

      let badgeColor = 'var(--accent, #E8820C)';
      let badgeBg = 'rgba(232, 130, 12, 0.1)';
      if (t.estado === 'Cotización') {
        badgeColor = 'var(--accent-light, #2563eb)';
        badgeBg = 'rgba(37, 99, 235, 0.1)';
      } else if (t.estado === 'Abierto') {
        badgeColor = 'var(--blue, #3b82f6)';
        badgeBg = 'rgba(59, 130, 246, 0.1)';
      }

      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--border)';
      row.style.color = 'var(--text-primary)';
      row.style.fontSize = '0.85rem';
      row.style.cursor = 'pointer';
      
      row.onclick = () => {
        editarTicket(t.id);
      };

      row.innerHTML = `
        <td style="padding:0.75rem 0.5rem; text-align:center;">
          <button class="btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:4px; display:inline-flex; align-items:center; gap:0.25rem; border:none; cursor:pointer;" onclick="event.stopPropagation(); editarTicket('${t.id}')">
            <i data-lucide="eye" style="width:12px; height:12px;"></i> Ver
          </button>
        </td>
        <td style="padding:0.75rem 0.5rem; font-family:monospace; font-weight:700;">
          <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start;">
            <span style="background:var(--accent-light); color:var(--accent); padding:0.15rem 0.4rem; border-radius:4px; font-size:0.78rem;">${t.folio}</span>
          </div>
        </td>
        <td style="padding:0.75rem 0.5rem; font-weight:600; line-height:1.2;">
          ${t.asunto || 'Ticket de Refacciones'}
        </td>
        <td style="padding:0.75rem 0.5rem; font-weight:500;">
          <div>${t.cliente}</div>
          ${parentLink}
        </td>
        <td style="padding:0.75rem 0.5rem; font-size:0.8rem; color:var(--text-secondary); line-height:1.3;">
          <div><i data-lucide="map-pin" style="width:11px; height:11px; vertical-align:middle; margin-right:3px; color:var(--text-muted);"></i> ${t.sitio || 'Sin sitio'}</div>
          ${t.equipo ? `<div style="margin-top:2px;"><i data-lucide="settings-2" style="width:11px; height:11px; vertical-align:middle; margin-right:3px; color:var(--text-muted);"></i> ${t.equipo}</div>` : ''}
        </td>
        <td style="padding:0.75rem 0.5rem; text-align:center;">
          <span class="status-badge" style="font-size:0.72rem; font-weight:700; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor}33; padding:0.2rem 0.4rem; border-radius:4px; display:inline-block;">
            ${getTicketEstadoLabel(t)}
          </span>
        </td>
        <td style="padding:0.75rem 0.5rem; vertical-align:middle;">
          ${partsHtml}
        </td>
        <td style="padding:0.75rem 0.5rem; text-align:center; font-size:0.8rem; color:var(--text-muted);">
          ${new Date(t.fechaCreacion || t.fecha).toLocaleDateString()}
        </td>
      `;
      tableBody.appendChild(row);
    });
    if (window.lucide) window.lucide.createIcons({ root: tableContainer });
  }
}

async function actualizarEstatusPiezaEnTicketYOrden(ticketId, clave, descripcion, nuevoEstatus, extraData = {}) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  let partsUpdated = false;
  if (ticket.refaccionesSeleccionadas) {
    const ref = ticket.refaccionesSeleccionadas.find(r => (r.clave === clave || r.codigo === clave) && (r.descripcion === descripcion || r.nombre === descripcion));
    if (ref) {
      ref.estatusPedido = nuevoEstatus;
      if (extraData.guiaPedido !== undefined) ref.guiaPedido = extraData.guiaPedido;
      if (extraData.precio !== undefined) ref.precio = extraData.precio;
      if (extraData.proveedor !== undefined) ref.proveedor = extraData.proveedor;
      if (extraData.paqueteria !== undefined) ref.paqueteria = extraData.paqueteria;
      if (extraData.fechaPedido !== undefined) ref.fechaPedido = extraData.fechaPedido;
      if (extraData.fechaEstimada !== undefined) ref.fechaEstimada = extraData.fechaEstimada;
      if (extraData.marca !== undefined) ref.marca = extraData.marca;
      partsUpdated = true;
    }
  }

  if (!partsUpdated) return;

  const originalFolio = ticket.folio.replace('-A', '');
  const parentTicket = tickets.find(t => t.folio === originalFolio);
  
  let orden = null;
  if (parentTicket) {
    orden = ordenes.find(o => o.soporte === parentTicket.id);
  }
  if (!orden) {
    let cleanOrdFolio = originalFolio;
    if (cleanOrdFolio.startsWith('[PRUEBA] ')) cleanOrdFolio = cleanOrdFolio.replace('[PRUEBA] ', '');
    if (cleanOrdFolio.startsWith('[TEST] ')) cleanOrdFolio = cleanOrdFolio.replace('[TEST] ', '');
    if (cleanOrdFolio.startsWith('TKT-')) cleanOrdFolio = cleanOrdFolio.replace('TKT-', '');
    cleanOrdFolio = cleanOrdFolio.trim();

    orden = ordenes.find(o => {
      let ofol = o.folio || '';
      if (ofol.startsWith('[PRUEBA] ')) ofol = ofol.replace('[PRUEBA] ', '');
      if (ofol.startsWith('[TEST] ')) ofol = ofol.replace('[TEST] ', '');
      return ofol.trim() === cleanOrdFolio;
    });
  }

  if (orden && orden.ref_necesarias) {
    const oRef = orden.ref_necesarias.find(r => (r.clave === clave || r.codigo === clave) && (r.descripcion === descripcion || r.nombre === descripcion));
    if (oRef) {
      oRef.estatusPedido = nuevoEstatus;
      if (extraData.guiaPedido !== undefined) oRef.guiaPedido = extraData.guiaPedido;
      if (extraData.precio !== undefined) oRef.precio = extraData.precio;
      if (extraData.proveedor !== undefined) oRef.proveedor = extraData.proveedor;
      if (extraData.paqueteria !== undefined) oRef.paqueteria = extraData.paqueteria;
      if (extraData.fechaPedido !== undefined) oRef.fechaPedido = extraData.fechaPedido;
      if (extraData.fechaEstimada !== undefined) oRef.fechaEstimada = extraData.fechaEstimada;
      if (extraData.marca !== undefined) oRef.marca = extraData.marca;
      if (window.supabaseClient) {
        try {
          await window.pushToSupabase('ordenes', orden);
        } catch (err) {
          console.error("Error al sincronizar orden en Supabase:", err);
        }
      }
    }
    safeSetJSON('sapi_ordenes', ordenes);
  }

  safeSetJSON('sapi_tickets', tickets);
  if (window.supabaseClient) {
    try {
      await window.pushToSupabase('tickets', ticket);
    } catch (err) {
      console.error("Error al sincronizar ticket en Supabase:", err);
    }
  }

  renderRefaccionesPendientes();
  
  // Si el detalle del ticket está abierto, refrescarlo para mostrar el cambio
  const detalleView = document.getElementById('detalle-ticket-view');
  if (detalleView && detalleView.style.display !== 'none') {
    verDetalleTicket(ticketId);
  }

  // Si el modal de edición de ticket está abierto para este ticket, refrescar su listado inferior de refacciones
  if (typeof editandoTicketId !== 'undefined' && editandoTicketId === ticketId) {
    const refBottomPiezasList = document.getElementById('ref-bottom-piezas-list');
    if (refBottomPiezasList) {
      refBottomPiezasList.innerHTML = '';
      const parts = ticket.refaccionesSeleccionadas || [];
      if (parts.length > 0) {
        parts.forEach(p => {
          const itemDiv = document.createElement('div');
          itemDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 0.4rem 0.6rem;
            font-size: 0.85rem;
          `;
          
          let pStatusColor = '#ef4444';
          let pStatusBg = 'rgba(239, 68, 68, 0.1)';
          if (p.estatusPedido === 'En Tránsito / Pedido') {
            pStatusColor = '#e8820c';
            pStatusBg = 'rgba(232, 130, 12, 0.1)';
          } else if (p.estatusPedido === 'Entregado al Técnico') {
            pStatusColor = '#22c55e';
            pStatusBg = 'rgba(34, 197, 94, 0.1)';
          }
          
          let detailsHtml = `(Clave: ${p.clave || p.codigo || 'S/C'})`;
          let extraInfo = [];
          if (p.proveedor) extraInfo.push(`Prov: ${p.proveedor}`);
          if (p.precio) {
            const val = parseFloat(p.precio);
            if (!isNaN(val)) {
              extraInfo.push(`Precio: $${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            } else {
              extraInfo.push(`Precio: $${p.precio}`);
            }
          }
          if (extraInfo.length > 0) {
            detailsHtml += ` • ${extraInfo.join(' | ')}`;
          }

          let miniProgressHtml = '';

          itemDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-weight: 500; color: var(--text-primary);">
                <span style="color: var(--accent); font-weight: 700; margin-right: 4px;">${p.cantidad || p.qty || 1}x</span> 
                ${p.descripcion || p.nombre || 'Sin Descripción'}
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; display: inline-block; margin-left: 8px;">${detailsHtml}</span>
              </span>
              <span class="status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${pStatusColor}; background: ${pStatusBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${pStatusColor}33; cursor: pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${ticketId}', '${p.clave || p.codigo}', '${p.descripcion || p.nombre}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad || 1}, '${p.marca || ''}')">
                ${p.estatusPedido || 'Por Pedir'}
              </span>
            </div>
            ${miniProgressHtml}
          `;
          refBottomPiezasList.appendChild(itemDiv);
        });
      } else {
        refBottomPiezasList.innerHTML = '<span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">Ninguna refacción registrada.</span>';
      }
    }
  }
};

function abrirModalPiezaPendienteTicket(ticketId, clave, descripcion, estatusActual, cantidad, marca) {
  const existing = document.getElementById('dynamic-modal-pieza');
  if (existing) existing.remove();

  const ticket = tickets.find(t => t.id === ticketId);
  const folioText = ticket ? (ticket.folio || 'S/N') : 'S/N';

  let existingGuia = '';
  let existingPrecio = '';
  let existingProveedor = '';
  let existingPaqueteria = '';
  let existingFechaPedido = '';
  let existingFechaEstimada = '';
  let existingMarca = marca || '';
  if (ticket && ticket.refaccionesSeleccionadas) {
    const ref = ticket.refaccionesSeleccionadas.find(r => (r.clave === clave || r.codigo === clave) && (r.descripcion === descripcion || r.nombre === descripcion));
    if (ref) {
      existingGuia = ref.guiaPedido || '';
      existingPrecio = ref.precio || '';
      existingProveedor = ref.proveedor || '';
      existingPaqueteria = ref.paqueteria || '';
      existingFechaPedido = ref.fechaPedido || '';
      existingFechaEstimada = ref.fechaEstimada || '';
      if (!existingMarca) existingMarca = ref.marca || '';
    }
  }

  if (!existingFechaPedido && ticket && (estatusActual === 'En Tránsito / Pedido' || estatusActual === 'Entregado al Técnico')) {
    const tDate = ticket.fecha_creacion || ticket.created_at;
    if (tDate) {
      existingFechaPedido = new Date(tDate).toISOString().split('T')[0];
    } else {
      existingFechaPedido = new Date().toISOString().split('T')[0];
    }
  }

  const displayBrand = {
    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
    'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
    'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
    'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
  }[String(existingMarca).toUpperCase()] || existingMarca || 'Sin Marca';

  const overlay = document.createElement('div');
  overlay.id = 'dynamic-modal-pieza';
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex !important; align-items: center; justify-content: center; z-index: 9999999 !important; padding: 1rem; box-sizing: border-box;';
  
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'max-width: 550px; width: 100%; border-radius: 16px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; font-family: inherit; margin: auto; z-index: 10000000;';

  const header = document.createElement('div');
  header.style.cssText = 'padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary);';
  header.innerHTML = `
    <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Detalle de Refacción (Ticket)</h2>
    <button style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-muted);" onclick="document.getElementById('dynamic-modal-pieza').remove()">✕</button>
  `;

  const body = document.createElement('div');
  body.style.cssText = 'padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;';
  
  body.innerHTML = `
    <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin-bottom:0.25rem;">${cantidad}x ${descripcion}</div>
    <div id="dynamic-modal-marca-display" style="font-size:0.95rem; color:var(--accent); font-weight:700; margin-bottom:0.5rem;">Marca: ${displayBrand}</div>
    <div style="font-size:0.85rem; color:var(--text-muted); font-family:monospace; margin-bottom:0.25rem;">Clave: ${clave}</div>
    <div style="font-size:0.85rem; color:var(--text-muted);">Ticket #${folioText}</div>
    
    <div style="margin-top: 0.5rem;">
      <label style="font-weight:600; margin-bottom:0.4rem; display:block; font-size:0.9rem;">Marca de Refacción</label>
      <input type="text" id="dynamic-modal-marca" list="brands-datalist" value="${existingMarca}" placeholder="E.j. PTZ, SCH, ETP" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.95rem; outline: none; font-family: inherit; box-sizing: border-box;">
      <datalist id="brands-datalist">
          <option value="ETP">ESSER TWIN PIPES</option>
          <option value="BCR">BCR</option>
          <option value="PTZ">PUTZMEISTER</option>
          <option value="SCH">SCHWING</option>
          <option value="CIF">CIFA</option>
          <option value="MTM">MTM</option>
          <option value="MCN">MCNELIUS</option>
          <option value="LON">LONDON</option>
          <option value="CAS">CASAGRANDE</option>
          <option value="OTM">OTRAS MARCAS</option>
          <option value="CNF">CONFORMS</option>
          <option value="TFB">TEUFELBERGER</option>
          <option value="RBC">REBEL CRUSHER</option>
          <option value="RBM">RUBBLE MASTER</option>
          <option value="FIO">FIORI</option>
          <option value="EVE">EVERDIGM</option>
          <option value="POR">PORTAFILL</option>
          <option value="SIM">SIMEM</option>
          <option value="TUR">TURBOSOL</option>
          <option value="MBC">MB CUCHARAS</option>
          <option value="DOR">DORNER</option>
          <option value="KNK">KINGKONG</option>
          <option value="HYU">HYUNDAI EVERDIGM</option>
          <option value="HER">HERRAMIENTA</option>
          <option value="EBS">EBOSS</option>
          <option value="RCR">RUBBLE CRUSHER</option>
        </datalist>
      </div>
    </div>

    <div style="margin-top: 0.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <div>
        <label style="font-weight:600; margin-bottom:0.4rem; display:block; font-size:0.9rem;">Proveedor</label>
        <input type="text" id="dynamic-modal-proveedor" value="${existingProveedor}" placeholder="Escribe el proveedor" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.95rem; outline: none; font-family: inherit; box-sizing: border-box;">
      </div>
      <div>
        <label style="font-weight:600; margin-bottom:0.4rem; display:block; font-size:0.9rem;">Precio ($)</label>
        <input type="number" step="any" id="dynamic-modal-precio" value="${existingPrecio}" placeholder="Costo" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.95rem; outline: none; font-family: inherit; box-sizing: border-box;">
      </div>
    </div>
  `;

  const footer = document.createElement('div');
  footer.style.cssText = 'padding: 1.25rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--bg-body);';
  footer.innerHTML = `
    <button type="button" class="btn-secondary" style="margin:0; padding:0.6rem 1.25rem; border-radius:10px; cursor:pointer;" onclick="document.getElementById('dynamic-modal-pieza').remove()">Cancelar</button>
    <button type="button" class="btn-primary" style="margin:0; padding:0.6rem 1.25rem; border-radius:10px; cursor:pointer; font-weight:600; background: var(--accent); color: #fff; border: none;" id="dynamic-modal-save">Guardar Cambios</button>
  `;

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);



  document.getElementById('dynamic-modal-marca').oninput = () => {
    const val = document.getElementById('dynamic-modal-marca').value.trim();
    const displayBrand = {
      'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
      'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
      'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
      'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
      'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
    }[val.toUpperCase()] || val || 'Sin Marca';
    document.getElementById('dynamic-modal-marca-display').innerHTML = `Marca: ${displayBrand}`;
  };

  document.getElementById('dynamic-modal-save').onclick = async () => {
    const nuevoEstatus = estatusActual || 'Por Pedir';
    const nuevoProveedor = document.getElementById('dynamic-modal-proveedor').value.trim();
    const nuevoPrecio = document.getElementById('dynamic-modal-precio').value.trim();
    const nuevaMarca = document.getElementById('dynamic-modal-marca').value.trim();

    overlay.remove();
    await window.actualizarEstatusPiezaEnTicketYOrden(ticketId, clave, descripcion, nuevoEstatus, {
      proveedor: nuevoProveedor,
      paqueteria: '',
      guiaPedido: '',
      precio: nuevoPrecio,
      fechaPedido: '',
      fechaEstimada: '',
      marca: nuevaMarca
    });
  };
};

// Wrappers legados para compatibilidad
function abrirModalPiezaPendienteNuevo(ordenId, clave, descripcion, estatusActual, cantidad, marca) {
  const orden = ordenes.find(o => o.id === ordenId || o.folio === ordenId);
  if (orden) {
    let baseFolio = orden.folio;
    if (orden.soporte) {
      const parentTicket = tickets.find(t => t.id === orden.soporte);
      if (parentTicket && parentTicket.folio) baseFolio = parentTicket.folio;
    }
    const targetFolio = baseFolio.endsWith('-A') ? baseFolio : `${baseFolio}-A`;
    const ticket = tickets.find(t => t.folio === targetFolio);
    if (ticket) {
      window.abrirModalPiezaPendienteTicket(ticket.id, clave, descripcion, estatusActual, cantidad, marca);
      return;
    }
  }
  window.abrirModalPiezaPendienteTicket(null, clave, descripcion, estatusActual, cantidad, marca);
};

async function cambiarEstatusEnLinea(ordenId, clave, descripcion, nuevoEstatus) {
  const orden = ordenes.find(o => o.id === ordenId || o.folio === ordenId);
  if (!orden) return;
  
  let baseFolio = orden.folio;
  if (orden.soporte) {
    const parentTicket = tickets.find(t => t.id === orden.soporte);
    if (parentTicket && parentTicket.folio) baseFolio = parentTicket.folio;
  }
  const targetFolio = baseFolio.endsWith('-A') ? baseFolio : `${baseFolio}-A`;
  const ticket = tickets.find(t => t.folio === targetFolio);
  if (ticket) {
    await window.actualizarEstatusPiezaEnTicketYOrden(ticket.id, clave, descripcion, nuevoEstatus);
  } else {
    if (!orden.ref_necesarias || !Array.isArray(orden.ref_necesarias)) return;
    const ref = orden.ref_necesarias.find(r => (r.clave === clave || r.codigo === clave) && (r.descripcion === descripcion || r.nombre === descripcion));
    if (ref) {
      ref.estatusPedido = nuevoEstatus;
      try {
        await window.pushToSupabase('ordenes', orden);
        safeSetJSON('sapi_ordenes', ordenes);
        renderRefaccionesPendientes();
      } catch (err) {
        console.error(err);
      }
    }
  }
};

let refaccionesCurrentPage = 1;
const REFACCIONES_PAGE_SIZE = 50;

function renderRefacciones(resetPage = false) {
  if (resetPage) refaccionesCurrentPage = 1;
  const body = document.getElementById('tabla-body-refacciones');
  if (!body) return;

  const q = (document.getElementById('search-refacciones')?.value || '').toLowerCase();

  // Obtener catálogo desde window.refaccionesDb o refaccionesDb
  let catalogo = (typeof window !== 'undefined' && Array.isArray(window.refaccionesDb) && window.refaccionesDb.length > 0)
    ? window.refaccionesDb
    : ((typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb) && refaccionesDb.length > 0) ? refaccionesDb : []);

  // Si aún está vacío en memoria, intentar cargar desde IndexedDB reactivamente
  if (catalogo.length === 0 && typeof window !== 'undefined' && typeof window.loadRefaccionesLocal === 'function' && !window._cargandoRefaccionesLocal) {
    window._cargandoRefaccionesLocal = true;
    window.loadRefaccionesLocal().then(data => {
      window._cargandoRefaccionesLocal = false;
      if (data && data.length > 0) {
        window.refaccionesDb = data;
        if (typeof refaccionesDb !== 'undefined') refaccionesDb = data;
        console.log(`[renderRefacciones] Catálogo recuperado reactivamente desde IndexedDB (${data.length} registros).`);
        renderRefacciones();
      }
    }).catch(err => {
      window._cargandoRefaccionesLocal = false;
      console.warn('[renderRefacciones] Error al cargar refacciones desde IndexedDB:', err);
    });
  }

  // Mapa de códigos → nombre completo (para resolver datos del caché de Supabase)
  const MARCAS_RENDER = {
    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
    'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
    'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
    'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
    'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER',
    'KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA',
    'EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
  };
  // Mapa de código numérico de grupo → nombre (exacto de SAP)
  const GRUPOS_RENDER = {
    101: 'Refacciones Cimentación',
    102: 'Refacciones Plantas Concreto',
    103: 'Refacciones Trituracion SAPI',
    104: 'Refacciones Concreto',
    105: 'Refacciones Ollas Revolvedoras',
    106: 'Refacciones Bombas Concreto',
    108: 'Herramienta',
    109: 'Tubería',
    110: 'Refacciones King Kong',
    111: 'Anticipo'
  };

  if (catalogo.length === 0 && window._cargandoRefaccionesLocal) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);"><i data-lucide="loader" class="spin"></i> Cargando catálogo de refacciones...</td></tr>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  console.log(`[renderRefacciones] refaccionesDb length: ${catalogo.length}`);

  // Filtrar: sin marca → excluir; busqueda
  const filtered = catalogo.filter(r => {
    // Resolve marca for filtering (may be code or full name in cache)
    const marcaRaw = (r.marca || r.marcaCodigo || '').trim();
    const marcaCode = marcaRaw.toUpperCase();
    const marcaFull = MARCAS_RENDER[marcaCode] || (marcaRaw.length > 4 ? marcaRaw : '');
    if (!marcaFull) return false; // exclude items with no resolvable brand
    if (!q) return true;
    const itemId = (r.idInterno || r.codigo || r.id || '').toLowerCase();
    const itemName = (r.nombre || r.descripcion || '').toLowerCase();
    const itemGrupo = (r.grupo || '').toLowerCase();
    return itemId.includes(q) || itemName.includes(q) || marcaFull.toLowerCase().includes(q) || itemGrupo.includes(q);
  });

  console.log(`[renderRefacciones] filtered length: ${filtered.length}, query: "${q}"`);

  const debugEl = document.getElementById('debug-refacciones');
  if (debugEl) {
    debugEl.style.display = 'none';
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / REFACCIONES_PAGE_SIZE) || 1;
  if (refaccionesCurrentPage > totalPages) refaccionesCurrentPage = totalPages;
  const start = (refaccionesCurrentPage - 1) * REFACCIONES_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + REFACCIONES_PAGE_SIZE);

  let html = '';
  pageItems.forEach(r => {
    const itemId = r.idInterno || r.codigo || r.id || 'N/A';
    const itemName = r.nombre || r.descripcion || 'Sin Nombre';

    // Resolve marca code and full name from maps (handles both cached codes and fresh names)
    const rawMarca = (r.marca || r.marcaCodigo || '').trim();
    const isCode = rawMarca.length <= 4 && rawMarca === rawMarca.toUpperCase();
    const itemMarcaCodigo = isCode ? rawMarca : (r.marcaCodigo || '');
    const marcaKey = (itemMarcaCodigo || rawMarca).toUpperCase();
    const itemMarcaNombre = MARCAS_RENDER[marcaKey] || rawMarca || 'N/A';

    // Resolve group: could be a name string or numeric code
    const grupoRaw = r.grupo || r.ItmsGrpNam || r.GrupoCode || r.ItmsGrpCod || '';
    const itemGrupo = (typeof grupoRaw === 'number')
      ? (GRUPOS_RENDER[grupoRaw] || `Grupo ${grupoRaw}`)
      : (grupoRaw || GRUPOS_RENDER[r.ItmsGrpCod] || 'N/A');

    const itemStock = r.stock || 0;
    let itemOrigen = r.origen || '';
    if (!itemOrigen && itemId !== 'N/A') {
      itemOrigen = itemId.toUpperCase().endsWith('N') ? 'Nacional' : 'Importado';
    }
    itemOrigen = itemOrigen || 'N/A';

    let customTds = '';
    const cfgRef = (typeof configData !== 'undefined' ? configData : (typeof window !== 'undefined' && window.configData ? window.configData : null));
    if (cfgRef?.mappings?.refacciones?.customCols) {
      cfgRef.mappings.refacciones.customCols.forEach(col => {
        customTds += `<td style="font-size:0.85rem; color:var(--text-secondary);">${r.customData && r.customData[col.label] ? r.customData[col.label] : 'N/A'}</td>`;
      });
    }
    
    html += `
      <tr>
        <td style="font-weight: 500; color: var(--text-primary); max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemName}">${itemName}</td>
        <td><span style="font-family:monospace; font-size:0.82rem; font-weight:600; color:var(--accent); background:var(--bg-body); border:1px solid var(--border); padding:2px 6px; border-radius:4px;">${itemMarcaCodigo || marcaKey}</span></td>
        <td style="font-weight: 500; color: var(--text-primary);">${itemMarcaNombre}</td>
        <td><span class="status-badge status-open" style="background:var(--bg-secondary); color:var(--text-secondary);">${itemGrupo}</span></td>
        <td style="font-family: monospace; font-weight: 500;">$${Number(r.precio||0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="font-weight: 500; color: ${itemStock > 0 ? 'var(--green)' : 'var(--red)'}">${itemStock}</td>
        <td><span class="badge ${itemOrigen === 'Nacional' ? 'badge-completado' : (itemOrigen === 'Importado' ? 'badge-proceso' : 'badge-pendiente')}">${itemOrigen}</span></td>
        ${customTds}
        <td><button class="action-btn" onclick="mostrarNotificacion('Vista de detalle en construcción', 'info')" title="Ver detalles"><i data-lucide="eye"></i></button></td>
      </tr>
    `;
  });

  body.innerHTML = html || '<tr><td colspan="8" class="empty-state">No se encontraron refacciones.</td></tr>';

  // Pagination + total footer
  let footer = document.getElementById('refacciones-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.id = 'refacciones-footer';
    footer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; font-size:0.82rem; color:var(--text-muted); border-top:1px solid var(--border); flex-wrap:wrap; gap:0.5rem;';
    body.closest('.table-wrapper')?.after(footer);
  }
  footer.innerHTML = `
    <span>Mostrando <strong>${start + 1}–${Math.min(start + REFACCIONES_PAGE_SIZE, total)}</strong> de <strong>${total}</strong> refacciones</span>
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button onclick="refaccionesCurrentPage--; renderRefacciones()" ${refaccionesCurrentPage <= 1 ? 'disabled' : ''} style="padding:0.3rem 0.7rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-size:0.8rem;">← Anterior</button>
      <span>Pág. ${refaccionesCurrentPage} / ${totalPages}</span>
      <button onclick="refaccionesCurrentPage++; renderRefacciones()" ${refaccionesCurrentPage >= totalPages ? 'disabled' : ''} style="padding:0.3rem 0.7rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-size:0.8rem;">Siguiente →</button>
    </div>
  `;

  lucide.createIcons();
}

function renderSitios() {
  const body = document.getElementById('tabla-body-sitios');
  if (!body) return;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = currentSession.viewMode === 'empresa';
  const isAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
  
  if (!isEmpresa && !isAdmin) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No tienes permisos para ver Sitios.</td></tr>`;
    return;
  }
  
  let sitiosList = [];
  
  if (isAdmin) {
    sitiosList = [...(sitiosDb || [])];
    (clientesDb || []).forEach(c => {
      if (c && c.sitios && Array.isArray(c.sitios)) {
        c.sitios.forEach(s => {
          const sNombre = getSitioNombre(s);
          if (sNombre && !sitiosList.some(ex => (ex.nombre || '').toLowerCase() === sNombre.toLowerCase() && (ex.cliente === c.id || ex.cliente === c.idInterno || ex.cliente === c.rfc || ex.cliente === c.nombre))) {
            sitiosList.push(typeof s === 'object' ? Object.assign({ cliente: c.id || c.nombre }, s) : { nombre: sNombre, cliente: c.id || c.nombre });
          }
        });
      }
    });
  } else {
    const clientName = currentUser ? (currentUser.empresa || currentUser.nombre) : '';
    const clienteObj = (clientesDb || []).find(c => c.nombre === clientName || c.id === clientName || c.idInterno === clientName || c.rfc === clientName);

    const candidateKeys = new Set();
    if (clientName) candidateKeys.add(clientName.toLowerCase());
    if (clienteObj) {
      if (clienteObj.id) candidateKeys.add(String(clienteObj.id).toLowerCase());
      if (clienteObj.idInterno) candidateKeys.add(String(clienteObj.idInterno).toLowerCase());
      if (clienteObj.rfc) candidateKeys.add(String(clienteObj.rfc).toLowerCase());
      if (clienteObj.nombre) candidateKeys.add(String(clienteObj.nombre).toLowerCase());
    }

    const sitiosFromDb = (sitiosDb || []).filter(s => {
      if (!s) return false;
      const sCli = String(s.cliente || '').toLowerCase();
      const sCliCustom = String(s.customData?.clienteNombre || '').toLowerCase();
      return candidateKeys.has(sCli) || (sCliCustom && candidateKeys.has(sCliCustom));
    });

    let localSitios = clienteObj && clienteObj.sitios ? clienteObj.sitios : [];
    if (clienteObj && clienteObj.ubicacion && !localSitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      localSitios = [{ nombre: clienteObj.ubicacion }, ...localSitios];
    }

    sitiosList = [...sitiosFromDb];
    localSitios.forEach(s => {
      const sNombre = getSitioNombre(s);
      if (sNombre && !sitiosList.some(ex => (ex.nombre || '').toLowerCase() === sNombre.toLowerCase())) {
        sitiosList.push(typeof s === 'object' ? s : { nombre: sNombre, cliente: clienteObj?.id || clientName });
      }
    });
  }
  
  // 1. Aplicar filtro de búsqueda
  const q = (document.getElementById('search-sitios')?.value || '').toLowerCase().trim();
  if (q) {
    sitiosList = sitiosList.filter(s => {
      const isObj = typeof s === 'object' && s !== null;
      const sNombre = (isObj ? s.nombre : s || '').toLowerCase();
      const sCp = (isObj && s.cp ? s.cp : '').toLowerCase();
      const sCiudad = (isObj && s.ciudad ? s.ciudad : '').toLowerCase();
      const sEstado = (isObj && s.estado ? s.estado : '').toLowerCase();
      const sDireccion = (isObj && s.direccion ? s.direccion : '').toLowerCase();
      
      let sClienteNombre = '';
      if (isObj && s.cliente) {
        sClienteNombre = s.cliente.toLowerCase();
        const cliFound = (clientesDb || []).find(c => c.id === s.cliente || c.idInterno === s.cliente || c.rfc === s.cliente);
        if (cliFound && cliFound.nombre) sClienteNombre += ' ' + cliFound.nombre.toLowerCase();
      }

      return sNombre.includes(q) || sCp.includes(q) || sCiudad.includes(q) || sEstado.includes(q) || sDireccion.includes(q) || sClienteNombre.includes(q);
    });
  }

  // 2. Aplicar ordenamiento
  const sortVal = document.getElementById('sort-sitios')?.value || 'nombre-asc';
  sitiosList.sort((a, b) => {
    const isObjA = typeof a === 'object' && a !== null;
    const isObjB = typeof b === 'object' && b !== null;
    
    const valA_nombre = (isObjA ? a.nombre : a || '').toString().toLowerCase().trim();
    const valB_nombre = (isObjB ? b.nombre : b || '').toString().toLowerCase().trim();

    // Obtener nombres de clientes para ordenar si aplica
    let valA_cliente = '';
    if (isObjA && a.cliente) {
      const cli = (clientesDb || []).find(c => c.id === a.cliente || c.idInterno === a.cliente || c.nombre === a.cliente);
      valA_cliente = cli ? cli.nombre.toLowerCase() : a.cliente.toLowerCase();
    }
    let valB_cliente = '';
    if (isObjB && b.cliente) {
      const cli = (clientesDb || []).find(c => c.id === b.cliente || c.idInterno === b.cliente || c.nombre === b.cliente);
      valB_cliente = cli ? cli.nombre.toLowerCase() : b.cliente.toLowerCase();
    }

    const valA_cp = (isObjA && a.cp ? a.cp : '').toString().toLowerCase().trim();
    const valB_cp = (isObjB && b.cp ? b.cp : '').toString().toLowerCase().trim();

    if (sortVal === 'nombre-asc') return valA_nombre.localeCompare(valB_nombre);
    if (sortVal === 'nombre-desc') return valB_nombre.localeCompare(valA_nombre);
    if (sortVal === 'cliente-asc') return valA_cliente.localeCompare(valB_cliente);
    if (sortVal === 'cliente-desc') return valB_cliente.localeCompare(valA_cliente);
    if (sortVal === 'cp-asc') {
      const cpA = parseInt(valA_cp, 10) || 0;
      const cpB = parseInt(valB_cp, 10) || 0;
      return cpA - cpB;
    }
    if (sortVal === 'cp-desc') {
      const cpA = parseInt(valA_cp, 10) || 0;
      const cpB = parseInt(valB_cp, 10) || 0;
      return cpB - cpA;
    }
    return 0;
  });

  if (!sitiosList || sitiosList.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No se encontraron sitios que coincidan con la búsqueda.</td></tr>`;
    return;
  }
  
  body.innerHTML = sitiosList.map((s, idx) => {
    const isObj = typeof s === 'object' && s !== null;
    const sNombre = isObj ? s.nombre : s;
    const sCp = isObj && s.cp ? s.cp : 'N/A';
    const sCiudad = isObj && s.ciudad ? s.ciudad : '';
    const sEstado = isObj && s.estado ? s.estado : '';
    const sDireccion = isObj && s.direccion ? s.direccion : '';
    
    const sId = isObj && s.id ? s.id : '-';
    let sCliente = isObj && s.cliente ? s.cliente : '-';
    
    let sClienteDisplay = sCliente;
    if (isAdmin && sCliente !== '-') {
      const cliFound = clientesDb.find(c => c.id === sCliente || c.idInterno === sCliente || c.rfc === sCliente);
      if (cliFound) {
        sClienteDisplay = `<div style="font-weight:500;">${cliFound.nombre}</div><div style="font-size:0.75rem; color:var(--text-muted);">ID: ${sCliente}</div>`;
      } else {
        sClienteDisplay = `<div style="font-weight:500; color:var(--text-muted);">ID: ${sCliente}</div>`;
      }
    } else if (sCliente === '-') {
      sClienteDisplay = `<span style="color:var(--text-muted);">N/A</span>`;
    }

    let cpFinal = sCp;
    let ciudadFinal = sCiudad;
    let estadoFinal = sEstado;

    if (isObj && s.customData) {
      if (s.customData['Código Postal']) cpFinal = s.customData['Código Postal'];
      if (s.customData['Ciudad']) ciudadFinal = s.customData['Ciudad'];
      if (s.customData['Estado']) estadoFinal = s.customData['Estado'];
    }

    const sLoc = [ciudadFinal, estadoFinal].filter(Boolean).join(', ') || 'N/A';

    let clientNames = [];
    if (isObj && s.cliente) {
      clientNames.push(s.cliente);
      const cliObj = (clientesDb || []).find(c => c.id === s.cliente || c.idInterno === s.cliente || c.nombre === s.cliente);
      if (cliObj) {
        clientNames.push(cliObj.nombre);
        if (cliObj.id) clientNames.push(cliObj.id);
      }
    }
    const sIdVal = isObj && s.id ? s.id : null;
    const maquinasSitio = (maquinariaDb || []).filter(m => {
      if (sIdVal && m.sitio_id && m.sitio_id === sIdVal) return true;
      const matchesName = sNombre && (m.ubicacion === sNombre || m.sitio === sNombre);
      if (!matchesName) return false;
      if (clientNames.length > 0) {
        return clientNames.includes(m.cliente);
      }
      return true;
    });

    let maquinasDisplay = '<span style="color:var(--text-muted); font-size:0.85rem;">—</span>';
    if (maquinasSitio.length > 0) {
      maquinasDisplay = `<div style="display:flex; flex-wrap:wrap; gap:4px; max-width:250px;">` +
        maquinasSitio.map(m => {
          const cleanId = m.idInterno || m.id || '';
          const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
          const prefix = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
          const name = `${prefix}${m.marca || ''} ${m.modelo || ''}`.trim();
          return `<span class="badge" style="background:rgba(232, 133, 10, 0.12); color:var(--accent); border:1px solid rgba(232, 133, 10, 0.2); font-weight:600; font-size:0.75rem; padding:0.15rem 0.4rem; border-radius:4px;" title="Serie: ${m.serie || 'N/A'}">${name}</span>`;
        }).join('') +
      `</div>`;
    }

    return `
    <tr>
      <td style="font-weight:500;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="map-pin" style="width:16px;height:16px;color:var(--accent);"></i> 
          <div>
            <div>${sNombre}</div>
            ${sDireccion ? `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${sDireccion}</div>` : ''}
            ${isAdmin ? `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">Sitio ID: ${sId}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${sClienteDisplay}</td>
      <td><span class="badge" style="background:var(--bg-hover);color:var(--text-muted);">${cpFinal}</span></td>
      <td><span style="font-size:0.9rem; color:var(--text-secondary);">${sLoc}</span></td>
      <td>${maquinasDisplay}</td>
      <td>
        ${!isAdmin ? `<button class="action-btn" onclick="renombrarSitioEmpresa('${idx}')" title="Renombrar Sitio"><i data-lucide="pencil"></i></button>` : `<button class="action-btn" onclick="abrirDetalleSitio('${sNombre.replace(/'/g, "\\'")}')" title="Ver detalles"><i data-lucide="eye"></i></button>`}
      </td>
    </tr>
    `;
  }).join('');
  lucide.createIcons();
}

function cerrarModalRenombrarSitio(e) {
  if (e && e.target !== document.getElementById('modal-renombrar-sitio-overlay')) return;
  document.getElementById('modal-renombrar-sitio-overlay').classList.remove('open');
}

function renombrarSitioEmpresa(idx) {
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const clienteObj = clientesDb.find(c => c.nombre === (currentUser.empresa || currentUser.nombre));
  if (clienteObj && clienteObj.sitios) {
    let sitios = clienteObj.sitios;
    if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      sitios = [clienteObj.ubicacion, ...sitios];
    }
    const sitioActual = sitios[idx];
    const nombreActual = getSitioNombre(sitioActual);
    
    document.getElementById('rs-idx').value = idx;
    document.getElementById('rs-nombre').value = nombreActual;
    document.getElementById('modal-renombrar-sitio-overlay').classList.add('open');
  }
}

function guardarRenombreSitio(e) {
  e.preventDefault();
  const idx = document.getElementById('rs-idx').value;
  const nuevoNombre = document.getElementById('rs-nombre').value;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const clienteObj = clientesDb.find(c => c.nombre === (currentUser.empresa || currentUser.nombre));
  
  if (clienteObj && clienteObj.sitios) {
    let sitios = clienteObj.sitios;
    if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      sitios = [clienteObj.ubicacion, ...sitios];
    }
    const sitioActual = sitios[idx];
    const nombreActual = getSitioNombre(sitioActual);
    
    if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre.trim() === nombreActual) {
      cerrarModalRenombrarSitio();
      return;
    }
    
    if (typeof sitioActual === 'object') {
      sitioActual.nombre = nuevoNombre.trim();
    } else {
      const originalIdx = clienteObj.sitios.findIndex(s => s === sitioActual);
      if (originalIdx !== -1) {
        clienteObj.sitios[originalIdx] = nuevoNombre.trim();
      } else {
        clienteObj.sitios.push(nuevoNombre.trim());
      }
    }
    
    if (clienteObj.ubicacion === nombreActual) {
      clienteObj.ubicacion = nuevoNombre.trim();
    }
    
    // Sincronizar en sitiosDb también si existe
    const sitioDbOb = (sitiosDb || []).find(s => s.nombre === nombreActual && (clienteObj ? (s.cliente === clienteObj.id || s.cliente === clienteObj.nombre || s.customData?.clienteNombre === clienteObj.nombre) : true));
    if (sitioDbOb) {
      sitioDbOb.nombre = nuevoNombre.trim();
      if (!sitioDbOb.customData) sitioDbOb.customData = {};
      sitioDbOb.customData.ubicacion = nuevoNombre.trim();
      localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
      if (window.pushToSupabase) window.pushToSupabase('sitios', sitioDbOb);
    }

    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
    renderSitios();
    cerrarModalRenombrarSitio();
  }
}


// Helper: Generación automática de identificador interno único de maquinaria
function generarIdInternoMaquina(marca, anioVenta, dbList = (typeof clientesDb !== "undefined" ? clientesDb : []), maqDb = (typeof maquinariaDb !== "undefined" ? maquinariaDb : [])) {
  const m = marca ? marca.trim().toUpperCase() : "XX";
  let iniciales = m.replace(/[^A-Z]/g, "");
  if (iniciales.length < 2) {
    iniciales = (iniciales + "XX").substring(0, 2);
  } else {
    iniciales = iniciales.substring(0, 2);
  }
  
  let yy = "";
  if (anioVenta) {
    if (typeof anioVenta === "string" && anioVenta.includes("-")) {
      yy = anioVenta.split("-")[0].substring(2, 4);
    } else {
      yy = anioVenta.toString().substring(2, 4);
    }
  }
  if (!yy || yy.length !== 2) {
    yy = new Date().getFullYear().toString().substring(2, 4);
  }
  
  const prefix = iniciales + yy;
  let max = 0;
  
  (dbList || []).forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(maq => {
        if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
          const num = parseInt(maq.idInterno.substring(prefix.length), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    }
  });

  (maqDb || []).forEach(maq => {
    if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
      const num = parseInt(maq.idInterno.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  
  return prefix + (max + 1).toString().padStart(3, "0");
}


if (typeof window !== "undefined") {
  window.setMaqView = setMaqView;
  window.toggleSortMaquinaria = toggleSortMaquinaria;
  window.renderMaquinaria = renderMaquinaria;
  window.actualizarMapaMaquinaria = actualizarMapaMaquinaria;
  window.switchRefTab = switchRefTab;
  window.crearOActualizarTicketRefacciones = crearOActualizarTicketRefacciones;
  window.setRefaccionesViewMode = setRefaccionesViewMode;
  window.renderRefaccionesPendientes = renderRefaccionesPendientes;
  window.actualizarEstatusPiezaEnTicketYOrden = actualizarEstatusPiezaEnTicketYOrden;
  window.abrirModalPiezaPendienteTicket = abrirModalPiezaPendienteTicket;
  window.abrirModalPiezaPendienteNuevo = abrirModalPiezaPendienteNuevo;
  window.cambiarEstatusEnLinea = cambiarEstatusEnLinea;
  window.renderRefacciones = renderRefacciones;
  window.renderSitios = renderSitios;
  window.cerrarModalRenombrarSitio = cerrarModalRenombrarSitio;
  window.renombrarSitioEmpresa = renombrarSitioEmpresa;
  window.guardarRenombreSitio = guardarRenombreSitio;
  window.generarIdInternoMaquina = generarIdInternoMaquina;
}

if (typeof document !== "undefined") {
  if (document.getElementById('view-refacciones')?.classList.contains('active')) {
    renderRefacciones();
    if (typeof renderRefaccionesPendientes === 'function') renderRefaccionesPendientes();
  }
}


// Exportar funciones del módulo de Maquinaria para ES modules
export {
  setMaqView,
  toggleSortMaquinaria,
  renderMaquinaria,
  actualizarMapaMaquinaria,
  switchRefTab,
  crearOActualizarTicketRefacciones,
  setRefaccionesViewMode,
  renderRefaccionesPendientes,
  actualizarEstatusPiezaEnTicketYOrden,
  abrirModalPiezaPendienteTicket,
  abrirModalPiezaPendienteNuevo,
  cambiarEstatusEnLinea,
  renderRefacciones,
  renderSitios,
  cerrarModalRenombrarSitio,
  renombrarSitioEmpresa,
  guardarRenombreSitio,
  generarIdInternoMaquina
};
