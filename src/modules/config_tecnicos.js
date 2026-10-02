/**
 * MÓDULO DE CONFIGURACIÓN DE PERMISOS, ROLES Y TÉCNICOS
 * Eurorep / SAPI - ES Module
 */

const getRolesLabels = () => (typeof ROLES_LABELS !== 'undefined' ? ROLES_LABELS : (typeof window !== 'undefined' && window.ROLES_LABELS ? window.ROLES_LABELS : {
  dashboard: 'Dashboard', servicios: 'Órdenes de Servicio', rentas: 'Rentas de Maquinaria', envios: 'Envíos y Guías de Entrega', calendario: 'Calendario',
  tickets: 'Tickets', levantamientos: 'Levantamientos', clientes: 'Clientes', maquinaria: 'Maquinaria', refacciones: 'Refacciones',
  sitios: 'Mis Sitios', tecnicos: 'Técnicos', config: 'Configuración',
  preferencias: 'Preferencias', gastos: 'Control de Gastos', telemetry: 'Monitoreo Telemetría',
  'chat-soporte': 'Chat de Soporte'
}));

const getRoles = () => (typeof ROLES !== 'undefined' ? ROLES : (typeof window !== 'undefined' && window.ROLES ? window.ROLES : (typeof global !== 'undefined' && global.ROLES ? global.ROLES : {})));
const getUsuarios = () => (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : (typeof window !== 'undefined' && Array.isArray(window.usuarios) ? window.usuarios : (typeof global !== 'undefined' && Array.isArray(global.usuarios) ? global.usuarios : []));
const getTecnicosDb = () => (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) ? tecnicosDb : (typeof window !== 'undefined' && Array.isArray(window.tecnicosDb) ? window.tecnicosDb : (typeof global !== 'undefined' && Array.isArray(global.tecnicosDb) ? global.tecnicosDb : []));
const getClientesDb = () => (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) ? clientesDb : (typeof window !== 'undefined' && Array.isArray(window.clientesDb) ? window.clientesDb : (typeof global !== 'undefined' && Array.isArray(global.clientesDb) ? global.clientesDb : []));
const getTickets = () => (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : (typeof window !== 'undefined' && Array.isArray(window.tickets) ? window.tickets : (typeof global !== 'undefined' && Array.isArray(global.tickets) ? global.tickets : []));

const getFilteredOrdersList = () => {
  if (typeof getFilteredOrders === 'function') return getFilteredOrders();
  if (typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function') return window.getFilteredOrders();
  if (typeof global !== 'undefined' && typeof global.getFilteredOrders === 'function') return global.getFilteredOrders();
  return (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes : (typeof window !== 'undefined' && Array.isArray(window.ordenes) ? window.ordenes : []);
};

const getApiConfig = () => (typeof API_CONFIG !== 'undefined' ? API_CONFIG : (typeof window !== 'undefined' && window.API_CONFIG ? window.API_CONFIG : (typeof global !== 'undefined' && global.API_CONFIG ? global.API_CONFIG : { USE_SAP_BACKEND: false })));

const isTestActive = () => {
  if (typeof isTestModeActive === 'function') return isTestModeActive();
  if (typeof window !== 'undefined' && typeof window.isTestModeActive === 'function') return window.isTestModeActive();
  return false;
};

const checkTestUser = (u) => {
  if (typeof isTestUser === 'function') return isTestUser(u);
  if (typeof window !== 'undefined' && typeof window.isTestUser === 'function') return window.isTestUser(u);
  return false;
};

const resolveTecNombre = (id) => {
  if (typeof resolveTecnicoNombre === 'function') return resolveTecnicoNombre(id);
  if (typeof window !== 'undefined' && typeof window.resolveTecnicoNombre === 'function') return window.resolveTecnicoNombre(id);
  return id || '';
};

const safeFormatFechaAmigable = (fecha) => {
  if (typeof formatFechaAmigable === 'function') return formatFechaAmigable(fecha);
  if (typeof window !== 'undefined' && typeof window.formatFechaAmigable === 'function') return window.formatFechaAmigable(fecha);
  if (!fecha) return '';
  try {
    return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch(e) {
    return fecha;
  }
};

// ===== CONFIG PERMISOS ROLES =====
function renderPermisosRoles() {
  if (typeof document === "undefined") return;
  const table = document.getElementById('tabla-permisos-roles');
  if (!table) return;

  const todasLasVistas = Object.keys(getRolesLabels());
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];

  let html = `
    <thead>
      <tr>
        <th style="text-align:left;">Vista</th>
        ${rolesParaEditar.map(r => `<th style="text-align:center;">${getRoles()[r].label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
  `;

  todasLasVistas.forEach(vista => {
    html += `<tr>`;
    html += `<td style="font-weight:500;">${ROLES_LABELS[vista]}</td>`;
    rolesParaEditar.forEach(r => {
      const tieneVista = getRoles()[r].views.includes(vista);
      // Opcional: hacer que el superadmin no pueda quitarse el dashboard o config, 
      // pero por ahora lo dejamos libre como lo pide el usuario.
      html += `
        <td style="text-align:center; vertical-align:middle;">
          <input type="checkbox" class="cb-permiso-rol" data-rol="${r}" data-vista="${vista}" ${tieneVista ? 'checked' : ''} style="width:1.2rem; height:1.2rem; cursor:pointer;" />
        </td>
      `;
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

function guardarPermisosRoles() {
  if (typeof document === "undefined") return;
  const checkboxes = document.querySelectorAll('.cb-permiso-rol');
  
  // Reset all mutable roles
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];
  rolesParaEditar.forEach(r => getRoles()[r].views = []);
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      getRoles()[cb.dataset.rol].views.push(cb.dataset.vista);
    }
  });
  
  const configToSave = {
    roles: getRoles(),
    migrated_v2: true
  };
  localStorage.setItem('sapi_roles_config', JSON.stringify(configToSave));
  if (window.pushToSupabase) window.pushToSupabase('roles', configToSave);
  
  // Recargar la UI
  setupNav();
  
  // Feedback visual
  const btn = document.querySelector('button[onclick="guardarPermisosRoles()"]');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  
  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.style.background = '';
    lucide.createIcons();
  }, 2000);
}

// ===== CONFIG TÉCNICOS =====
let currentTecView = 'galeria';

function setTecView(view) {
  currentTecView = view;
  if (typeof window !== "undefined") window.currentTecView = view;
  if (typeof document === "undefined") return;

  const btnGal = document.getElementById("btn-tec-galeria");
  if (btnGal) {
    btnGal.style.background = view === "galeria" ? "var(--accent-light)" : "transparent";
    btnGal.style.color = view === "galeria" ? "var(--accent)" : "var(--text-muted)";
    btnGal.style.borderColor = view === "galeria" ? "var(--accent)" : "transparent";
  }

  const btnLis = document.getElementById("btn-tec-lista");
  if (btnLis) {
    btnLis.style.background = view === "lista" ? "var(--accent-light)" : "transparent";
    btnLis.style.color = view === "lista" ? "var(--accent)" : "var(--text-muted)";
    btnLis.style.borderColor = view === "lista" ? "var(--accent)" : "transparent";
  }

  const gridEl = document.getElementById("tecnicos-grid");
  if (gridEl) gridEl.style.display = view === "galeria" ? "grid" : "none";

  const listEl = document.getElementById("tecnicos-list-wrapper");
  if (listEl) listEl.style.display = view === "lista" ? "block" : "none";
}

function renderTecnicos() {
  if (typeof document === "undefined") return;
  const grid = document.getElementById("tecnicos-grid");
  const tbody = document.getElementById('tecnicos-table-body');
  
  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };
  
  // Combine legacy technitians from orders with actual registered user technitians and SAP technitians
  const legacyTecs = getFilteredOrdersList().map(o => o.tecnico).filter(Boolean).map(formatNombreCorto);
  const userTecs = getUsuarios().filter(u => ['tecnico', 'supervisor'].includes(u.rol) && (isTestActive() || !checkTestUser(u))).map(u => formatNombreCorto(u.nombre));
  const sapTecs = getTecnicosDb().map(t => formatNombreCorto(t.nombre)).filter(Boolean);
  
  let tecsArr = [];
  if (getApiConfig().USE_SAP_BACKEND && sapTecs.length > 0) {
    // Si SAP está activo, usar los técnicos activos de SAP y también los usuarios locales con rol de técnico
    tecsArr = [...sapTecs, ...userTecs];
  } else {
    tecsArr = [...legacyTecs, ...userTecs, ...sapTecs];
  }
  
  // Filtrar explícitamente cualquier técnico que se llame "N/A" (proveniente de bases locales viejas)
  // y también excluir a los usuarios que tengan el rol o tipo de usuario "consulta"
  const tecs = [...new Set(tecsArr)]
    .filter(t => !t.toUpperCase().includes('N/A') && t.trim() !== '')
    .filter(t => {
      const tecObj = getTecnicosDb().find(x => formatNombreCorto(x.nombre) === t) || getUsuarios().find(u => formatNombreCorto(u.nombre) === t);
      if (tecObj && !isTestActive() && checkTestUser(tecObj)) return false;
      const tRol = (tecObj?.tipoUsuario || tecObj?.rol || '').toLowerCase();
      return !tRol.includes('consulta');
    })
    .sort();
  
  if (!tecs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">Sin técnicos registrados aún.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Sin técnicos registrados aún.</td></tr>`;
    return;
  }
  
  grid.innerHTML = tecs.map(t => {
    // Calcular órdenes del técnico
    const tOrdenes = getFilteredOrdersList().filter(o => {
      let assigned = [];
      if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
        assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecNombre(id)));
      } else if (o.tecnico) {
        assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
      }
      return assigned.includes(t);
    });

    const total = tOrdenes.length;
    const comp = tOrdenes.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;
    
    // Calcular Siguiente Orden y Último Completado usando el sistema de órdenes
    const ordenesAbiertas = tOrdenes
      .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // la más antigua abierta primero
    const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;
    
    const ordenesCompletadas = tOrdenes
      .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // la más reciente completada primero
    const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

    const tecObj = getTecnicosDb().find(x => formatNombreCorto(x.nombre) === t) || getUsuarios().find(u => formatNombreCorto(u.nombre) === t);
    const celular = tecObj?.telefono || tecObj?.celular || 'Sin celular';
    const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

    const proxTxt = proxOrden ? `<span onclick="event.stopPropagation(); verDetalle('${proxOrden.id}')" style="color:var(--accent); font-weight:600; text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${proxOrden.cliente}</span> <span style="color:var(--text-muted);">(${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''})</span>` : '<span style="color:var(--text-muted);">Ninguna</span>';
    const ultTxt = ultCompletada ? `<span onclick="event.stopPropagation(); verDetalle('${ultCompletada.id}')" style="color:var(--accent); font-weight:600; text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${ultCompletada.cliente}</span> <span style="color:var(--text-muted);">(${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''})</span>` : '<span style="color:var(--text-muted);">Ninguna</span>';


    return `
    <div class="card-person" onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer; display:flex; flex-direction:column; gap:0.5rem; padding:1.25rem;">
      <div>
        <div class="card-person-name" style="margin-bottom:0.2rem;">${t}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> ${tipoUsuario}</span>
          <span>&bull;</span>
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="phone" style="width:12px;height:12px;"></i> ${celular}</span>
        </div>
        <div class="card-person-sub" style="display:flex; justify-content:space-between;">
          <span>${total} servicio(s) históricos</span>
          <span style="color:var(--green); font-weight:500;">${comp} Completados</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.4rem; font-size:0.8rem;">
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="calendar-clock" style="width:14px;height:14px;color:var(--accent);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Siguiente Orden</div>
            ${proxTxt}
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="check-circle-2" style="width:14px;height:14px;color:var(--green);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Último Completado</div>
            ${ultTxt}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  if (tbody) {
    tbody.innerHTML = tecs.map(t => {
      // Calcular órdenes del técnico
      const tOrdenes = getFilteredOrdersList().filter(o => {
        let assigned = [];
        if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
          assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecNombre(id)));
        } else if (o.tecnico) {
          assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
        }
        return assigned.includes(t);
      });

      const total = tOrdenes.length;
      const comp = tOrdenes.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;

      // Calcular Siguiente Orden y Último Completado usando el sistema de órdenes
      const ordenesAbiertas = tOrdenes
        .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // la más antigua abierta primero
      const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;
      
      const ordenesCompletadas = tOrdenes
        .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // la más reciente completada primero
      const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

      const tecObj = getTecnicosDb().find(x => formatNombreCorto(x.nombre) === t) || getUsuarios().find(u => formatNombreCorto(u.nombre) === t);
      const celular = tecObj?.telefono || tecObj?.celular || 'Sin celular';
      const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

      const proxTxt = proxOrden ? `<div onclick="event.stopPropagation(); verDetalle('${proxOrden.id}')" style="font-weight:600; color:var(--accent); text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${proxOrden.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''}</div>` : '<span style="color:var(--text-muted);">Ninguna</span>';
      const ultTxt = ultCompletada ? `<div onclick="event.stopPropagation(); verDetalle('${ultCompletada.id}')" style="font-weight:600; color:var(--accent); text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${ultCompletada.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''}</div>` : '<span style="color:var(--text-muted);">Ninguna</span>';


      return `
        <tr onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer;" class="hover-row">
          <td>
            <div style="font-weight:500;">${t}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
              <span>${tipoUsuario}</span> &bull; <span>${celular}</span>
            </div>
          </td>
          <td>${total}</td>
          <td><span class="badge badge-completado">${comp} completados</span></td>
          <td>${proxTxt}</td>
          <td>${ultTxt}</td>
        </tr>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

function verDetalleTecnico(nombre) {
  if (typeof document === "undefined") return;
  document.getElementById('tecnico-detalle-title').innerHTML = `<i data-lucide="user" style="color:var(--accent);"></i> Perfil: ${nombre}`;
  
  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };
  const tUser = getUsuarios().find(u => u.nombre === nombre || formatNombreCorto(u.nombre) === nombre) || 
                getTecnicosDb().find(t => t.nombre === nombre || formatNombreCorto(t.nombre) === nombre);
  
  // Find assigned clients
  let assignedClients = [];
  if (tUser) {
    assignedClients = getClientesDb().filter(c => 
      (c.tecnicosAsignados && c.tecnicosAsignados.includes(tUser.id)) ||
      (c.tecnicoAsignado === tUser.id)
    );
  }
  
  // Find resolved tickets (Tickets have string assigned, e.g. "Juan Perez")
  // Tickets are usually assigned to a string. Or if it's multiple, they are comma separated.
  const resolvedTickets = getTickets().filter(t => 
    t.estado === 'Resuelto' && 
    t.asignado && 
    t.asignado.split(',').map(s=>s.trim()).includes(nombre)
  );

  // Calcular Siguiente Orden y Último Completado para el perfil del técnico
  const tNameShort = formatNombreCorto(nombre);
  const tOrdenes = getFilteredOrdersList().filter(o => {
    let assigned = [];
    if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
      assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecNombre(id)));
    } else if (o.tecnico) {
      assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
    }
    return assigned.includes(tNameShort);
  });

  const ordenesAbiertas = tOrdenes
    .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;

  const ordenesCompletadas = tOrdenes
    .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

  let html = `

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom:1.5rem;">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Estado</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--green);">Activo</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Correo</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.email || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Celular</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.celular || tUser?.telefono || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Clientes Asignados</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${assignedClients.length}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Completadas</div>
        <div style="font-weight: 500; color: var(--green); font-size: 1.1rem;">${ordenesCompletadas.length}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Pendientes</div>
        <div style="font-weight: 500; color: var(--accent); font-size: 1.1rem;">${ordenesAbiertas.length}</div>
      </div>
    </div>
  `;


  html += `
    <div style="margin-bottom:1.5rem;">
      <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
        <i data-lucide="clipboard-list" style="width:18px;height:18px;color:var(--text-muted);"></i> Siguiente Orden y Actividad
      </h3>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Siguiente Orden</div>
            <div style="font-weight:600; color:var(--text-primary);">${proxOrden ? proxOrden.cliente : 'Ninguna'}</div>
            ${proxOrden ? `<div style="font-size:0.8rem; color:var(--text-muted);">Folio: ${proxOrden.folio} • Fecha: ${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''}</div>` : ''}
          </div>
          ${proxOrden ? `<button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalle('${proxOrden.id}')" style="font-size:0.75rem;"><i data-lucide="eye" style="width:12px;height:12px;margin-right:3px;vertical-align:middle;"></i> Ver Orden</button>` : ''}
        </div>
        <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Último Completado</div>
            <div style="font-weight:600; color:var(--text-primary);">${ultCompletada ? ultCompletada.cliente : 'Ninguno'}</div>
            ${ultCompletada ? `<div style="font-size:0.8rem; color:var(--text-muted);">Folio: ${ultCompletada.folio} • Fecha: ${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''}</div>` : ''}
          </div>
          ${ultCompletada ? `<button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalle('${ultCompletada.id}')" style="font-size:0.75rem;"><i data-lucide="eye" style="width:12px;height:12px;margin-right:3px;vertical-align:middle;"></i> Ver Orden</button>` : ''}
        </div>
      </div>
    </div>
  `;

  if (assignedClients.length > 0) {

    html += `
      <div style="margin-bottom:1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="building-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Empresas Asignadas
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${assignedClients.map(c => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${c.nombre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${c.ubicacion || 'Sin ubicación'}</div>
              </div>
              <button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalleCliente('${c.nombre.replace(/'/g, "\\'")}')" style="font-size:0.75rem;">Ver Perfil</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (resolvedTickets.length > 0) {
    html += `
      <div>
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="check-circle" style="width:18px;height:18px;color:var(--text-muted);"></i> Tickets Resueltos Recientes
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:200px; overflow-y:auto; padding-right:0.5rem;">
          ${resolvedTickets.slice(0, 10).map(t => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:500; color:var(--text-primary);">${t.folio} - ${t.asunto || 'Sin título'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${t.cliente || 'Uso Interno'} • ${safeFormatFechaAmigable(t.fechaCreacion)}</div>
              </div>
              <span class="badge badge-resuelto">Resuelto</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('detalle-tecnico-body').innerHTML = html;
  document.getElementById('modal-detalle-tecnico-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleTecnico(e) {
  if (typeof document === "undefined") return;
  if (e && e.target !== document.getElementById('modal-detalle-tecnico-overlay')) return;
  document.getElementById('modal-detalle-tecnico-overlay').classList.remove('open');
}

// Exponer en window para compatibilidad total con eventos HTML inline
if (typeof window !== 'undefined') {
  window.renderPermisosRoles = renderPermisosRoles;
  window.guardarPermisosRoles = guardarPermisosRoles;
  window.currentTecView = currentTecView;
  window.setTecView = setTecView;
  window.renderTecnicos = renderTecnicos;
  window.verDetalleTecnico = verDetalleTecnico;
  window.cerrarDetalleTecnico = cerrarDetalleTecnico;
}

export {
  renderPermisosRoles,
  guardarPermisosRoles,
  currentTecView,
  setTecView,
  renderTecnicos,
  verDetalleTecnico,
  cerrarDetalleTecnico
};
