/**
 * Módulo de Listados, Filtros, Menús de Ordenación y Badges de Tickets - Eurorep / SAPI
 * Bundle Vanilla IIFE para el navegador con retrocompatibilidad global en window.
 */
(function(root) {
  function safeNorm(s) {
    if (!s) return "";
    if (typeof root !== "undefined" && typeof root.normStr === "function") return root.normStr(s);
    if (typeof window !== "undefined" && typeof window.normStr === "function") return window.normStr(s);
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function safeFormatFechaAmigable(dateStr) {
    if (typeof formatFechaAmigable === "function") return formatFechaAmigable(dateStr);
    if (typeof window !== "undefined" && typeof window.formatFechaAmigable === "function") return window.formatFechaAmigable(dateStr);
    return String(dateStr || "");
  }

  function safeFormatFechaHoraAmigable(dateStr) {
    if (typeof formatFechaHoraAmigable === "function") return formatFechaHoraAmigable(dateStr);
    if (typeof window !== "undefined" && typeof window.formatFechaHoraAmigable === "function") return window.formatFechaHoraAmigable(dateStr);
    return String(dateStr || "");
  }

  function safeEscapeHTML(str) {
    if (typeof escapeHTML === "function") return escapeHTML(str);
    if (typeof window !== "undefined" && typeof window.escapeHTML === "function") return window.escapeHTML(str);
    return String(str || "").replace(/[&<>'"]/g, tag => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[tag] || tag));
  }

  function safeResolveTecnicoNombre(id) {
    if (typeof resolveTecnicoNombre === "function") return resolveTecnicoNombre(id);
    if (typeof window !== "undefined" && typeof window.resolveTecnicoNombre === "function") return window.resolveTecnicoNombre(id);
    return id;
  }

  let ticketFiltroActivo = (typeof window !== "undefined" && window.ticketFiltroActivo) || "todos";

  function safeGetTickets() {
    if (typeof tickets !== "undefined" && Array.isArray(tickets)) return tickets;
    if (typeof window !== "undefined" && Array.isArray(window.tickets)) return window.tickets;
    if (typeof safeGetJSON === "function") return safeGetJSON('sapi_tickets', []);
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('sapi_tickets') || '[]'); } catch(e) { return []; }
    }
    return [];
  }
  function safeGetUsuarios() {
    if (typeof usuarios !== "undefined" && Array.isArray(usuarios)) return usuarios;
    if (typeof window !== "undefined" && Array.isArray(window.usuarios)) return window.usuarios;
    if (typeof safeGetJSON === "function") return safeGetJSON('eurorep_usuarios', []);
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]'); } catch(e) { return []; }
    }
    return [];
  }
  function safeGetTecnicosDb() {
    if (typeof tecnicosDb !== "undefined" && Array.isArray(tecnicosDb)) return tecnicosDb;
    if (typeof window !== "undefined" && Array.isArray(window.tecnicosDb)) return window.tecnicosDb;
    if (typeof safeGetJSON === "function") return safeGetJSON('sapi_tecnicos_db', []);
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('sapi_tecnicos_db') || '[]'); } catch(e) { return []; }
    }
    return [];
  }
  function safeGetClientesDb() {
    if (typeof clientesDb !== "undefined" && Array.isArray(clientesDb)) return clientesDb;
    if (typeof window !== "undefined" && Array.isArray(window.clientesDb)) return window.clientesDb;
    if (typeof safeGetJSON === "function") return safeGetJSON('sapi_clientes_db', []);
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]'); } catch(e) { return []; }
    }
    return [];
  }
  function safeGetOrdenes() {
    if (typeof ordenes !== "undefined" && Array.isArray(ordenes)) return ordenes;
    if (typeof window !== "undefined" && Array.isArray(window.ordenes)) return window.ordenes;
    if (typeof safeGetJSON === "function") return safeGetJSON('sapi_ordenes', []);
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('sapi_ordenes') || '[]'); } catch(e) { return []; }
    }
    return [];
  }
  function safeGetCurrentSession() {
    if (typeof currentSession !== "undefined" && currentSession) return currentSession;
    if (typeof window !== "undefined" && window.currentSession) return window.currentSession;
    if (typeof safeGetJSON === "function") return safeGetJSON('eurorep_session', null) || { userId: '', viewMode: 'consulta' };
    if (typeof localStorage !== "undefined") {
      try { return JSON.parse(localStorage.getItem('eurorep_session') || 'null') || { userId: '', viewMode: 'consulta' }; } catch(e) { return { userId: '', viewMode: 'consulta' }; }
    }
    return { userId: '', viewMode: 'consulta' };
  }

  function safeGetFilteredTickets() {
    if (typeof getFilteredTickets === "function") return getFilteredTickets();
    if (typeof window !== "undefined" && typeof window.getFilteredTickets === "function") return window.getFilteredTickets();
    return safeGetTickets();
  }

// ===== TICKETS DATA =====
function updateTicketBadge() {
  if (typeof document === 'undefined') return;
  const usuarios = safeGetUsuarios();
  const currentSession = safeGetCurrentSession();
  const clientesDb = safeGetClientesDb();
  let filtered = safeGetFilteredTickets();
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtered = filtered.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    } else {
      filtered = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  let tecFilter = '';
  let supFilter = '';
  if (userRole === 'tecnico') {
    const isSuperadmin = (usuarios.find(u => u.id === currentSession.userId)?.rol === 'superadmin');
    if (isSuperadmin && isTestModeActive()) {
      tecFilter = '';
    } else {
      tecFilter = currentUser ? currentUser.nombre : '';
    }
  }
  if (userRole === 'supervisor') {
    const isLauraPaz = currentUser && (
      String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
      String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
      String(currentUser.email).toLowerCase().trim().includes('laurapaz')
    );
    if (isLauraPaz) {
      supFilter = '';
    } else {
      supFilter = currentUser ? currentUser.nombre : '';
    }
  }
  
  if (tecFilter || supFilter) {
    const tecNameLower = tecFilter ? safeNorm(tecFilter) : '';
    const supNameLower = supFilter ? safeNorm(supFilter) : '';
    filtered = filtered.filter(t => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecNameLower) {
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(safeResolveTecnicoNombre);
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => safeNorm(s));
         passTec = assignedLower.includes(tecNameLower) || 
                   (t.solicitante && safeNorm(t.solicitante) === tecNameLower) || 
                   (t.creadoPor && safeNorm(t.creadoPor) === tecNameLower);
      }
      
      if (supFilter && supNameLower) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === t.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && safeNorm(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (safeNorm(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
         }
         
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(safeResolveTecnicoNombre);
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => safeNorm(s));
         
         let passSupTicket = assignedLower.includes(supNameLower) || 
                             (t.solicitante && safeNorm(t.solicitante) === supNameLower) || 
                             (t.creadoPor && safeNorm(t.creadoPor) === supNameLower);
         
         passSup = passSupClient || passSupTicket;
      }
      
      return passTec && passSup;
    });
  }

  const abiertos = filtered.filter(t => t.estado === 'Abierto').length;
  const badge = document.getElementById('nav-badge-tickets');
  if (badge) {
    if (abiertos > 0) {
      badge.textContent = abiertos;
      badge.classList.add('visible');
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
      badge.style.display = 'none';
    }
  }

  if (typeof window.updateEnviosBadge === 'function') {
    window.updateEnviosBadge();
  }
  if (typeof window.actualizarBadgeLevantamientos === 'function') {
    window.actualizarBadgeLevantamientos();
  }
  if (typeof window.actualizarBadgeJuntaRevision === 'function') {
    window.actualizarBadgeJuntaRevision();
  }
}

function updateOrdenesBadge() {
  if (typeof document === 'undefined') return;
  const usuarios = safeGetUsuarios();
  const currentSession = safeGetCurrentSession();
  const clientesDb = safeGetClientesDb();
  const ordenes = safeGetOrdenes();
  let filtered = (typeof getFilteredOrders === 'function') ? getFilteredOrders() : ((typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function') ? window.getFilteredOrders() : ordenes);
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtered = filtered.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        return ocli === nombreEmpresaLogged;
      });
    } else {
      filtered = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  let tecFilter = '';
  let supFilter = '';
  if (userRole === 'tecnico') {
    const isSuperadmin = (usuarios.find(u => u.id === currentSession.userId)?.rol === 'superadmin');
    if (isSuperadmin && isTestModeActive()) {
      tecFilter = '';
    } else {
      tecFilter = currentUser ? currentUser.nombre : '';
    }
  }
  if (userRole === 'supervisor') {
    const isLauraPaz = currentUser && (
      String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
      String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
      String(currentUser.email).toLowerCase().trim().includes('laurapaz')
    );
    if (isLauraPaz) {
      supFilter = '';
    } else {
      supFilter = currentUser ? currentUser.nombre : '';
    }
  }

  if (tecFilter || supFilter) {
    const tecNameLower = tecFilter ? safeNorm(tecFilter) : '';
    const supNameLower = supFilter ? safeNorm(supFilter) : '';
    
    filtered = filtered.filter(o => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecNameLower) {
         let assigned = [];
         if (o.tecnico_asignado) assigned = String(o.tecnico_asignado).split(',').map(s=>s.trim());
         else if (o.tecnico) assigned = String(o.tecnico).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => safeNorm(s));
         passTec = assignedLower.includes(tecNameLower);
      }
      
      if (supFilter && supNameLower) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === o.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && safeNorm(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (safeNorm(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
         }
         passSup = passSupClient;
      }
      
      return passTec && passSup;
    });
  }

  const activas = filtered.filter(o => o.estado === 'Pendiente' || o.estado === 'En Proceso').length;
  const badge = document.getElementById('nav-badge-ordenes');
  if (badge) {
    if (activas > 0) {
      badge.textContent = activas;
      badge.classList.add('visible');
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
      badge.style.display = 'none';
    }
  }

  if (typeof window.actualizarBadgeLevantamientos === 'function') {
    window.actualizarBadgeLevantamientos();
  }
  if (typeof window.actualizarBadgeDepuradorOrdenes === 'function') {
    window.actualizarBadgeDepuradorOrdenes();
  }
  if (typeof window.actualizarBadgeDepuradorTickets === 'function') {
    window.actualizarBadgeDepuradorTickets();
  }

  if (typeof window.updateEnviosBadge === 'function') {
    window.updateEnviosBadge();
  }
  if (typeof window.actualizarBadgeJuntaRevision === 'function') {
    window.actualizarBadgeJuntaRevision();
  }
}

function actualizarFiltrosPersonal() {
  if (typeof document === 'undefined') return;
  try {
    const usuarios = safeGetUsuarios();
    const currentSession = safeGetCurrentSession();
    const tecnicosDb = safeGetTecnicosDb();
    const tickets = safeGetTickets();
    const ordenes = safeGetOrdenes();
    const clientesDb = safeGetClientesDb();
    const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
    const userRole = currentSession.viewMode || '';
    const isTecnico = userRole === 'tecnico';
    const isSupervisor = userRole === 'supervisor';
    const userName = currentUser ? currentUser.nombre : '';

    const selectsTecnico = [document.getElementById('filter-ord-tecnico'), document.getElementById('filter-dash-tkt-tecnico'), document.getElementById('filter-tkt-tecnico')];
    const selectsSupervisor = [document.getElementById('filter-ord-supervisor'), document.getElementById('filter-dash-tkt-supervisor'), document.getElementById('filter-tkt-supervisor')];
    
    // Combinar todos los roles operativos para que salgan en ambos filtros
    let allStaff = new Set();
    
    // Agregar de usuarios (tecnicos, supervisores, admins)
    if (Array.isArray(usuarios)) {
      usuarios.forEach(u => { 
        if (u && ['tecnico', 'supervisor', 'admin', 'superadmin'].includes(u.rol) && u.activo !== false && typeof u.nombre === 'string') {
          allStaff.add(u.nombre.trim()); 
        }
      });
    }
    
    // Agregar de tecnicosDb
    if (Array.isArray(tecnicosDb)) {
      tecnicosDb.forEach(t => { 
        if (t && typeof t.nombre === 'string') allStaff.add(t.nombre.trim()); 
      });
    }
    
    // Agregar de tickets y ordenes por si hay historicos
    if (Array.isArray(tickets)) {
      tickets.forEach(t => {
        if (!t) return;
        if (typeof t.asignado === 'string' && t.asignado !== 'Sin asignar') {
          t.asignado.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(t.tecnicosAsignados)) {
          t.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(ordenes)) {
      ordenes.forEach(o => {
        if (!o) return;
        if (typeof o.tecnico === 'string') {
          o.tecnico.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(o.tecnicosAsignados)) {
          o.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(clientesDb)) {
      clientesDb.forEach(c => {
        if (!c) return;
        if (typeof c.supervisorAsignado === 'string') allStaff.add(c.supervisorAsignado.trim());
        if (Array.isArray(c.supervisoresAsignados)) {
          c.supervisoresAsignados.forEach(s => { if (typeof s === 'string') allStaff.add(s.trim()); });
        }
      });
    }

    const uniqueStaff = Array.from(allStaff).filter(Boolean).sort((a,b) => a.localeCompare(b));
    
    // Crear lista separada exclusiva para supervisores
    let allSupervisores = new Set();
    if (Array.isArray(usuarios)) {
      usuarios.forEach(u => {
        if (u && u.rol === 'supervisor' && u.activo !== false && typeof u.nombre === 'string') {
          allSupervisores.add(u.nombre.trim());
        }
      });
    }
    if (Array.isArray(clientesDb)) {
      clientesDb.forEach(c => {
        if (!c) return;
        if (typeof c.supervisorAsignado === 'string' && c.supervisorAsignado.trim()) {
          allSupervisores.add(c.supervisorAsignado.trim());
        }
        if (Array.isArray(c.supervisoresAsignados)) {
          c.supervisoresAsignados.forEach(s => {
            if (typeof s === 'string') {
              if (s.includes('-')) { // Es un UUID de usuario, buscamos su nombre
                const u = usuarios.find(usr => usr.id === s);
                if (u && typeof u.nombre === 'string') allSupervisores.add(u.nombre.trim());
              } else {
                allSupervisores.add(s.trim());
              }
            }
          });
        }
      });
    }
    const uniqueSupervisores = Array.from(allSupervisores).filter(Boolean).sort((a,b) => a.localeCompare(b));

    const tecOptionsHtml = '<option value="">Cualquier Técnico</option>' + uniqueStaff.map(n => `<option value="${n}">${n}</option>`).join('');
    const supOptionsHtml = '<option value="">Cualquier Supervisor</option>' + uniqueSupervisores.map(n => `<option value="${n}">${n}</option>`).join('');
    
    selectsTecnico.forEach(sel => { 
      if(sel) { 
        let val = isTecnico ? userName : sel.value; 
        sel.innerHTML = tecOptionsHtml; 
        if (val) {
          const normalizedVal = safeNorm(val);
          const matchedOption = Array.from(sel.options).find(opt => safeNorm(opt.value) === normalizedVal);
          if (matchedOption) {
            val = matchedOption.value;
          }
        }
        sel.value = val; 
        sel.disabled = isTecnico;
      } 
    });
    
    selectsSupervisor.forEach(sel => { 
      if(sel) { 
        let val = sel.value;
        const isFirstLoad = sel.options.length <= 1;
        if (isSupervisor && isFirstLoad) {
          val = userName;
        } else if (isTecnico) {
          val = '';
        }
        sel.innerHTML = supOptionsHtml; 
        if (val) {
          const normalizedVal = safeNorm(val);
          const matchedOption = Array.from(sel.options).find(opt => safeNorm(opt.value) === normalizedVal);
          if (matchedOption) {
            val = matchedOption.value;
          }
        }
        sel.value = val; 
        sel.disabled = isTecnico;
      } 
    });

    // Actualizar filtro de tipo/categoría de ticket
    const selectTipos = [document.getElementById('filter-tkt-tipo'), document.getElementById('filter-dash-tkt-tipo')];
    const baseTipos = [
      'Refacción',
      'Servicio Técnico',
      'Soporte',
      'Garantía',
      'Garantía Interna',
      'Pre-Entrega',
      'Puesta en Marcha',
      'Solicitud de Información',
      'Otro'
    ];
    const allTipos = new Set(baseTipos);
    if (Array.isArray(tickets)) {
      tickets.forEach(t => {
        if (t && (t.categoria || t.tipo)) {
          const cat = String(t.categoria || t.tipo).trim();
          if (cat) allTipos.add(cat);
        }
      });
    }
    const sortedTipos = Array.from(allTipos).filter(Boolean).sort((a,b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const tipoOptionsHtml = '<option value="">Todos los Tipos</option>' + sortedTipos.map(t => `<option value="${t}">${t}</option>`).join('');
    selectTipos.forEach(sel => {
      if (sel) {
        const prevVal = sel.value;
        sel.innerHTML = tipoOptionsHtml;
        if (prevVal) {
          const normalizedVal = safeNorm ? safeNorm(prevVal) : prevVal.toLowerCase().trim();
          const matchedOption = Array.from(sel.options).find(opt => (safeNorm ? safeNorm(opt.value) : opt.value.toLowerCase().trim()) === normalizedVal);
          if (matchedOption) {
            sel.value = matchedOption.value;
          }
        }
      }
    });

    if (window.actualizarUISupervisorFilter) {
      window.actualizarUISupervisorFilter();
    }
    if (window.actualizarUITipoFilter) {
      window.actualizarUITipoFilter(sortedTipos);
    }
  } catch (error) {
    console.error('Error al actualizar filtros de personal:', error);
  }
}

let ticketSortColumn = (typeof window !== "undefined" && window.ticketSortColumn) || 'folio';
let ticketSortDirection = (typeof window !== "undefined" && window.ticketSortDirection) || 'desc';

function onSortTicketsChange(val) {
  if (!val) return;
  const parts = val.split('-');
  const col = parts[0];
  const dir = parts[1] || 'desc';
  ticketSortColumn = col; if (typeof window !== "undefined") window.ticketSortColumn = col;
  ticketSortDirection = dir; if (typeof window !== "undefined") window.ticketSortDirection = dir;
  window.actualizarCabeceraOrdenacion();
  renderTickets();
};

function toggleSortMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-sort-tickets');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  // Cerrar menú de antigüedad si estuviera abierto
  const menuAnt = document.getElementById('menu-antiguedad-filter');
  if (menuAnt) menuAnt.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUISortMenu();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

function setSortDirection(dir) {
  ticketSortDirection = dir; if (typeof window !== "undefined") window.ticketSortDirection = dir;
  window.actualizarCabeceraOrdenacion();
  renderTickets();
};

function seleccionarColumnaOrden(col) {
  const colNorm = (col === 'fecha-mod') ? 'fecha-mod' : col;
  const currentNorm = (ticketSortColumn === 'fecha-modificacion') ? 'fecha-mod' : ticketSortColumn;
  if (currentNorm === colNorm) {
    ticketSortDirection = ticketSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    ticketSortColumn = (col === 'fecha-mod') ? 'fecha-modificacion' : col;
    if (['monto', 'fecha', 'fecha-modificacion', 'fecha-mod', 'folio', 'prioridad', 'comentario'].includes(ticketSortColumn)) {
      ticketSortDirection = 'desc';
    } else {
      ticketSortDirection = 'asc';
    }
  }
  window.actualizarCabeceraOrdenacion();
  const menu = document.getElementById('menu-sort-tickets');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

function actualizarUISortMenu() {
  if (typeof document === 'undefined') return;
  const colNorm = (ticketSortColumn === 'fecha-modificacion') ? 'fecha-mod' : ticketSortColumn;
  const isAsc = ticketSortDirection === 'asc';

  // Botones de dirección en popover
  const btnDesc = document.getElementById('btn-sort-dir-desc');
  const btnAsc = document.getElementById('btn-sort-dir-asc');
  if (btnDesc && btnAsc) {
    if (!isAsc) {
      btnDesc.style.background = 'var(--bg-card)';
      btnDesc.style.color = 'var(--accent)';
      btnDesc.style.boxShadow = 'var(--shadow-sm)';
      btnAsc.style.background = 'transparent';
      btnAsc.style.color = 'var(--text-muted)';
      btnAsc.style.boxShadow = 'none';
    } else {
      btnAsc.style.background = 'var(--bg-card)';
      btnAsc.style.color = 'var(--accent)';
      btnAsc.style.boxShadow = 'var(--shadow-sm)';
      btnDesc.style.background = 'transparent';
      btnDesc.style.color = 'var(--text-muted)';
      btnDesc.style.boxShadow = 'none';
    }
  }

  const colMeta = {
    'folio': { name: 'Folio', descLabel: 'Mayor a Menor', ascLabel: 'Menor a Mayor', shortDesc: 'Mayor', shortAsc: 'Menor' },
    'fecha-mod': { name: 'Última Modif.', descLabel: 'Más reciente', ascLabel: 'Más antigua', shortDesc: 'Reciente', shortAsc: 'Antigua' },
    'fecha': { name: 'Creación', descLabel: 'Más reciente', ascLabel: 'Más antigua', shortDesc: 'Reciente', shortAsc: 'Antigua' },
    'monto': { name: 'Monto', descLabel: 'Mayor a Menor', ascLabel: 'Menor a Mayor', shortDesc: 'Mayor', shortAsc: 'Menor' },
    'prioridad': { name: 'Prioridad', descLabel: 'Alta a Baja', ascLabel: 'Baja a Alta', shortDesc: 'Alta', shortAsc: 'Baja' },
    'comentario': { name: 'Comentario', descLabel: 'Más reciente', ascLabel: 'Más antiguo', shortDesc: 'Reciente', shortAsc: 'Antiguo' },
    'asunto': { name: 'Asunto', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'solicitante': { name: 'Solicitante', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'estado': { name: 'Estado', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'tipo': { name: 'Tipo', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' }
  };

  const currentMeta = colMeta[colNorm] || { name: colNorm, descLabel: 'Desc', ascLabel: 'Asc', shortDesc: 'Desc', shortAsc: 'Asc' };

  // Actualizar texto del botón principal
  const labelBtn = document.getElementById('label-sort-tickets');
  if (labelBtn) {
    const dirText = isAsc ? currentMeta.shortAsc : currentMeta.shortDesc;
    labelBtn.textContent = `${currentMeta.name} (${dirText})`;
  }

  // Actualizar filas de opciones
  const rows = document.querySelectorAll('.sort-opt-row');
  rows.forEach(r => {
    const rCol = r.dataset.col;
    const isAct = (rCol === colNorm);
    r.style.background = isAct ? 'var(--bg-hover)' : 'transparent';
    r.style.color = isAct ? 'var(--accent)' : 'var(--text-primary)';
    r.style.fontWeight = isAct ? '600' : '500';

    const check = r.querySelector('.sort-check');
    if (check) check.style.display = isAct ? 'inline-block' : 'none';

    const sublabel = r.querySelector('.sort-opt-sublabel');
    if (sublabel) {
      const meta = colMeta[rCol];
      if (meta) {
        sublabel.textContent = isAsc ? meta.ascLabel : meta.descLabel;
      }
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

function actualizarCabeceraOrdenacion() {
  if (typeof document === 'undefined') return;
  const headers = {
    'folio': 'th-ord-folio',
    'asunto': 'th-ord-asunto',
    'solicitante': 'th-ord-solicitante',
    'area': 'th-ord-area',
    'prioridad': 'th-ord-prioridad',
    'estado': 'th-ord-estado',
    'comentario': 'th-ord-comentario',
    'cotizacion': 'th-ord-cotizacion',
    'monto': 'th-ord-monto-cotizacion',
    'pedido': 'th-ord-pedido',
    'asignado': 'th-ord-asignado',
    'fecha': 'th-ord-fecha',
    'fecha-modificacion': 'th-ord-fecha-modificacion',
    'fecha-mod': 'th-ord-fecha-modificacion'
  };
  
  Object.values(headers).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const text = el.dataset.labelOriginal || el.textContent.replace(/[▲▼]/g, '').trim();
      if (!el.dataset.labelOriginal) {
        el.dataset.labelOriginal = text;
      }
      el.classList.remove('sort-asc', 'sort-desc');
      el.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">${text} <i data-lucide="chevrons-up-down" style="width:14px;height:14px;opacity:0.3;"></i></span>`;
    }
  });
  
  const activeId = headers[ticketSortColumn];
  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    const text = activeEl.dataset.labelOriginal;
    const isAsc = ticketSortDirection === 'asc';
    activeEl.classList.add(isAsc ? 'sort-asc' : 'sort-desc');
    activeEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">${text} <i data-lucide="${isAsc ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;color:var(--accent);"></i></span>`;
  }

  // Sincronizar popover de ordenación
  if (window.actualizarUISortMenu) {
    window.actualizarUISortMenu();
  }

  // Sincronizar select sort-tickets si existe
  const sortSelect = document.getElementById('sort-tickets');
  if (sortSelect) {
    const desired = `${ticketSortColumn}-${ticketSortDirection}`;
    const exists = Array.from(sortSelect.options).some(o => o.value === desired);
    if (exists) {
      sortSelect.value = desired;
    }
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
};

function ordenarTicketsPor(columna) {
  if (ticketSortColumn === columna) {
    ticketSortDirection = ticketSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    ticketSortColumn = columna; if (typeof window !== "undefined") window.ticketSortColumn = columna;
    // Para folios, montos, fechas, modificaciones, prioridades y comentarios, el primer click es 'desc' (Mayor a menor / Más reciente)
    if (['monto', 'fecha', 'fecha-modificacion', 'fecha-mod', 'folio', 'prioridad', 'comentario'].includes(columna)) {
      ticketSortDirection = 'desc';
    } else {
      ticketSortDirection = 'asc';
    }
  }
  renderTickets();
};

// ===== FILTRO DE TIPO DE TICKET =====
function toggleTipoFilterMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-tkt-tipo-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mSup = document.getElementById('menu-tkt-sup-filter');
  const mAnt = document.getElementById('menu-antiguedad-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mSup) mSup.style.display = 'none';
  if (mAnt) mAnt.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUITipoFilter();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

function setTicketTipoFilter(val) {
  const sel = document.getElementById('filter-tkt-tipo');
  if (sel) {
    sel.value = val || '';
  }
  window.actualizarUITipoFilter();
  const menu = document.getElementById('menu-tkt-tipo-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

function actualizarUITipoFilter(tiposList) {
  if (typeof document === 'undefined') return;
  const sel = document.getElementById('filter-tkt-tipo');
  const currentVal = sel ? sel.value : '';
  const btn = document.getElementById('btn-tkt-tipo-filter');
  const label = document.getElementById('label-tkt-tipo-filter');
  const listContainer = document.getElementById('tipo-filter-options-list');

  if (label) {
    label.textContent = currentVal ? currentVal : 'Todos los Tipos';
  }
  if (btn) {
    if (currentVal) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  }

  if (listContainer) {
    let options = [];
    if (Array.isArray(tiposList) && tiposList.length > 0) {
      options = tiposList;
    } else if (sel && sel.options) {
      options = Array.from(sel.options).map(o => o.value).filter(Boolean);
    }

    const iconForTipo = (tipo) => {
      const t = String(tipo || '').toLowerCase();
      if (t.includes('refacc')) return 'package';
      if (t.includes('servici') || t.includes('manten')) return 'wrench';
      if (t.includes('soport')) return 'headphones';
      if (t.includes('garant')) return 'shield-check';
      if (t.includes('entrega') || t.includes('marcha')) return 'truck';
      if (t.includes('informac')) return 'help-circle';
      if (t.includes('correctiv') || t.includes('falla')) return 'alert-triangle';
      return 'tag';
    };

    let html = `
      <button type="button" class="tipo-opt-row" onclick="window.setTicketTipoFilter('')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${!currentVal ? 'var(--bg-hover)' : 'transparent'}; color: ${!currentVal ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${!currentVal ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="tags" style="width: 14px; height: 14px; opacity: 0.8;"></i>
          <span>Todos los Tipos</span>
        </div>
        <i data-lucide="check" style="width: 13px; height: 13px; display: ${!currentVal ? 'inline-block' : 'none'};"></i>
      </button>
    `;

    options.forEach(tipo => {
      const isAct = (tipo === currentVal);
      const icon = iconForTipo(tipo);
      html += `
        <button type="button" class="tipo-opt-row" onclick="window.setTicketTipoFilter('${tipo.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${isAct ? 'var(--bg-hover)' : 'transparent'}; color: ${isAct ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${isAct ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="${icon}" style="width: 14px; height: 14px; opacity: 0.8;"></i>
            <span>${tipo}</span>
          </div>
          <i data-lucide="check" style="width: 13px; height: 13px; display: ${isAct ? 'inline-block' : 'none'};"></i>
        </button>
      `;
    });

    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// ===== FILTRO DE SUPERVISOR =====
function toggleSupervisorFilterMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-tkt-sup-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mTipo = document.getElementById('menu-tkt-tipo-filter');
  const mAnt = document.getElementById('menu-antiguedad-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mTipo) mTipo.style.display = 'none';
  if (mAnt) mAnt.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUISupervisorFilter();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

function setTicketSupervisorFilter(val) {
  const sel = document.getElementById('filter-tkt-supervisor');
  if (sel) {
    sel.value = val || '';
  }
  window.actualizarUISupervisorFilter();
  const menu = document.getElementById('menu-tkt-sup-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

function actualizarUISupervisorFilter() {
  if (typeof document === 'undefined') return;
  const sel = document.getElementById('filter-tkt-supervisor');
  const currentVal = sel ? sel.value : '';
  const btn = document.getElementById('btn-tkt-sup-filter');
  const label = document.getElementById('label-tkt-sup-filter');
  const listContainer = document.getElementById('sup-filter-options-list');

  if (label) {
    label.textContent = currentVal ? currentVal : 'Cualquier Supervisor';
  }
  if (btn) {
    if (currentVal) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  }

  if (listContainer && sel && sel.options) {
    const options = Array.from(sel.options).map(o => o.value).filter(Boolean);
    let html = `
      <button type="button" class="sup-opt-row" onclick="window.setTicketSupervisorFilter('')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${!currentVal ? 'var(--bg-hover)' : 'transparent'}; color: ${!currentVal ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${!currentVal ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="users" style="width: 14px; height: 14px; opacity: 0.8;"></i>
          <span>Cualquier Supervisor</span>
        </div>
        <i data-lucide="check" style="width: 13px; height: 13px; display: ${!currentVal ? 'inline-block' : 'none'};"></i>
      </button>
    `;

    options.forEach(sup => {
      const isAct = (sup === currentVal);
      html += `
        <button type="button" class="sup-opt-row" onclick="window.setTicketSupervisorFilter('${sup.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${isAct ? 'var(--bg-hover)' : 'transparent'}; color: ${isAct ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${isAct ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="user" style="width: 14px; height: 14px; opacity: 0.8;"></i>
            <span>${sup}</span>
          </div>
          <i data-lucide="check" style="width: 13px; height: 13px; display: ${isAct ? 'inline-block' : 'none'};"></i>
        </button>
      `;
    });

    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// ===== FILTRO DE ANTIGÜEDAD (TICKETS) =====
window.ticketAntiguedadModo = 'mod'; // 'mod' o 'crea'
window.ticketAntiguedadRango = ''; // '' (todas), '1_7', '8_15', 'gt_15'

function toggleAntiguedadFilterMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-antiguedad-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mTipo = document.getElementById('menu-tkt-tipo-filter');
  const mSup = document.getElementById('menu-tkt-sup-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mTipo) mTipo.style.display = 'none';
  if (mSup) mSup.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && typeof lucide !== 'undefined') lucide.createIcons();
};

function cambiarModoAntiguedad(modo) {
  window.ticketAntiguedadModo = modo;
  const tabMod = document.getElementById('tab-antiguedad-mod');
  const tabCrea = document.getElementById('tab-antiguedad-crea');
  if (tabMod && tabCrea) {
    if (modo === 'mod') {
      tabMod.style.background = 'var(--bg-card)';
      tabMod.style.color = 'var(--accent)';
      tabMod.style.boxShadow = 'var(--shadow-sm)';
      tabCrea.style.background = 'transparent';
      tabCrea.style.color = 'var(--text-muted)';
      tabCrea.style.boxShadow = 'none';
    } else {
      tabCrea.style.background = 'var(--bg-card)';
      tabCrea.style.color = 'var(--accent)';
      tabCrea.style.boxShadow = 'var(--shadow-sm)';
      tabMod.style.background = 'transparent';
      tabMod.style.color = 'var(--text-muted)';
      tabMod.style.boxShadow = 'none';
    }
  }
  if (window.ticketAntiguedadRango) {
    window.actualizarUIAntiguedadFilter();
    renderTickets();
  }
};

function setAntiguedadRango(rango) {
  window.ticketAntiguedadRango = rango;
  window.actualizarUIAntiguedadFilter();
  const menu = document.getElementById('menu-antiguedad-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

function setAntiguedadFilter(val) {
  window.setAntiguedadRango(val);
};

function actualizarUIAntiguedadFilter() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn-antiguedad-filter');
  const label = document.getElementById('label-antiguedad-filter');
  const rows = document.querySelectorAll('.antiguedad-opt-row');
  
  rows.forEach(r => {
    const isAct = r.dataset.rango === (window.ticketAntiguedadRango || '');
    r.style.background = isAct ? 'var(--bg-hover)' : 'transparent';
    r.style.color = isAct ? 'var(--accent)' : 'var(--text-primary)';
    r.style.fontWeight = isAct ? '600' : '500';
    const check = r.querySelector('.antiguedad-check');
    if (check) check.style.display = isAct ? 'inline-block' : 'none';
  });

  if (!window.ticketAntiguedadRango) {
    if (label) label.textContent = 'Antigüedad';
    if (btn) {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  } else {
    const modoName = window.ticketAntiguedadModo === 'mod' ? 'Modif' : 'Creación';
    const rangoNames = { '1_7': '1 a 7 d', '8_15': '8 a 15 d', 'gt_15': '+15 d' };
    const text = `${modoName}: ${rangoNames[window.ticketAntiguedadRango] || window.ticketAntiguedadRango}`;
    if (label) label.textContent = text;
    if (btn) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e) {
    const popovers = [
      { menu: document.getElementById('menu-tkt-tipo-filter'), btn: document.getElementById('btn-tkt-tipo-filter') },
      { menu: document.getElementById('menu-tkt-sup-filter'), btn: document.getElementById('btn-tkt-sup-filter') },
      { menu: document.getElementById('menu-antiguedad-filter'), btn: document.getElementById('btn-antiguedad-filter') },
      { menu: document.getElementById('menu-sort-tickets'), btn: document.getElementById('btn-sort-tickets') }
    ];

    popovers.forEach(p => {
      if (p.menu && p.menu.style.display === 'block') {
        if (!p.menu.contains(e.target) && (!p.btn || !p.btn.contains(e.target))) {
          p.menu.style.display = 'none';
        }
      }
    });
  });
}

// ===== ASOCIACIÓN TICKET HIJO DE REFACCIONES (-A) <-> ORDEN DE SERVICIO / TICKET PADRE =====
function esTicketHijoRefacciones(t) {
  if (!t || typeof t !== 'object') return false;
  const tFolio = String(t.folio || '').trim();
  // Solo los tickets que tienen terminación -A / -a o vínculo explícito de subticket
  if (/-[Aa]$/i.test(tFolio) || tFolio.toUpperCase().includes('-A') || Boolean(t.parentTicketId || t.ticketPadreId || t.ticket_padre_id)) {
    return true;
  }
  const asunto = String(t.asunto || '');
  const desc = String(t.descripcion || '');
  if (/(?:refacciones\s*para|ticket\s*padre|derivado\s*del|subticket)/i.test(asunto) || /(?:ticket\s*padre|derivado\s*del\s*ticket|subticket)/i.test(desc)) {
    return true;
  }
  return false;
};

function obtenerOrdenAsociadaTicket(t) {
  if (!t || typeof t !== 'object') return null;

  // 1. Usar pool en memoria prioritariamente para evitar saturar el heap
  let allOrds = (typeof ordenes !== 'undefined' && Array.isArray(ordenes) && ordenes.length > 0)
    ? ordenes
    : ((typeof window !== 'undefined' && Array.isArray(window.ordenes) && window.ordenes.length > 0)
      ? window.ordenes
      : null);

  if (!allOrds) {
    try {
      allOrds = (typeof safeGetJSON === 'function') 
        ? safeGetJSON('sapi_ordenes', []) 
        : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    } catch (e) {
      allOrds = [];
    }
  }

  if (!allOrds || allOrds.length === 0) return null;

  const allTkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];

  // Helper para normalizar cadenas (sin espacios, sin guiones, mayúsculas)
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const getOrderFolio = (o) => String(o.folio || o.numero_orden || o.numeroOrden || o.noOrden || o.id || '').trim();

  // 2. Coincidencia directa por ordenId, orden_id, ordenFolio en órdenes REALES
  if (t.ordenId || t.orden_id) {
    const targetId = t.ordenId || t.orden_id;
    const found = allOrds.find(o => o && (o.id === targetId || o.folio === targetId || norm(getOrderFolio(o)) === norm(targetId)));
    if (found) return found;
  }
  if (t.ordenFolio) {
    const found = allOrds.find(o => o && (norm(getOrderFolio(o)) === norm(t.ordenFolio) || getOrderFolio(o).includes(t.ordenFolio)));
    if (found) return found;
  }

  // 3. Coincidencia por soporte en la orden (orden.soporte === t.id o t.folio)
  if (t.id) {
    const found = allOrds.find(o => o && (o.soporte === t.id || norm(o.soporte) === norm(t.id)));
    if (found) return found;
  }
  if (t.folio) {
    const found = allOrds.find(o => o && (o.soporte === t.folio || norm(o.soporte) === norm(t.folio)));
    if (found) return found;
  }

  // 4. Extracción de número de ticket/OS base (ej. TKT-OS-26248-A -> número 26248, buscando orden con soporte TKT-26248)
  const tFolio = String(t.folio || '').trim();
  const numMatch = tFolio.match(/\d{4,6}/) || (t.asunto ? String(t.asunto).match(/\d{4,6}/) : null);
  const ticketNumber = numMatch ? numMatch[0] : '';

  if (ticketNumber) {
    // A) Buscar orden que tenga en soporte este folio de ticket (ej: orden OS-26145 con soporte TKT-26248)
    const foundBySoporteNum = allOrds.find(o => {
      if (!o || !o.soporte) return false;
      const sopNorm = norm(o.soporte);
      const sopNum = String(o.soporte).replace(/[^0-9]/g, '');
      return sopNum === ticketNumber || sopNorm === ('TKT' + ticketNumber) || sopNorm === ticketNumber;
    });
    if (foundBySoporteNum) return foundBySoporteNum;

    // B) Buscar el ticket padre en la lista de tickets y ver si alguna orden apunta a ese ticket padre
    const parentTicket = allTkts.find(x => {
      if (!x) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      return (xFol === `TKT-${ticketNumber}` || xFol === ticketNumber || xNum === ticketNumber) && x.id !== t.id;
    });
    if (parentTicket) {
      const foundByParent = allOrds.find(o => o && (o.soporte === parentTicket.id || o.soporte === parentTicket.folio || norm(o.soporte) === norm(parentTicket.folio)));
      if (foundByParent) return foundByParent;
    }

    // C) Buscar si el número de ticket coincide con el número de la orden REAL
    const foundByOrdNum = allOrds.find(o => {
      if (!o) return false;
      const oFol = getOrderFolio(o);
      const oNum = oFol.replace(/[^0-9]/g, '');
      return oNum === ticketNumber;
    });
    if (foundByOrdNum) return foundByOrdNum;
  }

  // 5. Coincidencia por folios limpios en órdenes REALES
  if (tFolio) {
    let cleanBase = tFolio.replace(/-[Aa]$/i, '').trim();
    if (cleanBase.startsWith('[PRUEBA] ')) cleanBase = cleanBase.replace('[PRUEBA] ', '').trim();
    if (cleanBase.startsWith('[TEST] ')) cleanBase = cleanBase.replace('[TEST] ', '').trim();
    if (cleanBase.startsWith('TKT-')) cleanBase = cleanBase.replace('TKT-', '').trim();
    const normBase = norm(cleanBase);

    const foundDirect = allOrds.find(o => {
      if (!o) return false;
      const oFol = getOrderFolio(o);
      const oNorm = norm(oFol);
      return oNorm === normBase || o.id === cleanBase;
    });
    if (foundDirect) return foundDirect;
  }

  // 6. Búsqueda por patrón OS-XXXXX en Asunto, Folio o Descripción que coincida con una orden REAL
  const fullText = `${tFolio} ${t.asunto || ''} ${t.descripcion || ''}`;
  const osMatches = fullText.match(/(?:OS|ORD)[-\s]?\d{3,7}/gi);
  if (osMatches && osMatches.length > 0) {
    for (const matchStr of osMatches) {
      const normMatch = norm(matchStr);
      const numOnly = matchStr.replace(/[^0-9]/g, '');

      const found = allOrds.find(o => {
        if (!o) return false;
        const oFol = getOrderFolio(o);
        const oNorm = norm(oFol);
        const oNum = oFol.replace(/[^0-9]/g, '');
        return oNorm === normMatch || (numOnly.length >= 4 && oNum === numOnly);
      });
      if (found) return found;
    }
  }

  // IMPORTANTE: Si la orden NO existe en la base de datos de órdenes, devolvemos null (no inventar órdenes sintéticas)
  return null;
};

// Alias para compatibilidad histórica en vistas de refacciones
window.obtenerOrdenAsociadaATicketRefacciones = window.obtenerOrdenAsociadaTicket;

function verOrdenDesdeTicket(ordenId) {
  if (!ordenId) return;
  const overlayDetalle = document.getElementById('modal-ticket-detalle-overlay');
  if (overlayDetalle) overlayDetalle.classList.remove('open');
  const overlayEdit = document.getElementById('modal-ticket-overlay');
  if (overlayEdit) overlayEdit.classList.remove('open');
  document.body.style.overflow = '';
  
  // Buscar en el pool de órdenes si existe el objeto orden
  let pool = [];
  if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) pool = pool.concat(ordenes);
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) pool = pool.concat(window.ordenes);
  try {
    const local = (typeof safeGetJSON === 'function') 
      ? safeGetJSON('sapi_ordenes', []) 
      : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if (Array.isArray(local)) pool = pool.concat(local);
  } catch (e) {}

  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const targetNorm = norm(ordenId);
  const targetNum = String(ordenId).replace(/[^0-9]/g, '');

  const foundOrder = pool.find(o => {
    if (!o) return false;
    const oFol = String(o.folio || o.numero_orden || o.numeroOrden || o.noOrden || o.id || '').trim();
    const oNorm = norm(oFol);
    const oNum = oFol.replace(/[^0-9]/g, '');
    return o.id === ordenId || oFol === ordenId || oNorm === targetNorm || (targetNum.length >= 4 && oNum === targetNum);
  });

  if (foundOrder && typeof verDetalle === 'function') {
    verDetalle(foundOrder.id || foundOrder.folio);
  } else {
    // Si no está en memoria, navegar a la pestaña de Órdenes de Servicio y filtrar por el folio
    const navServicios = document.querySelector('.nav-item[data-view="servicios"]');
    if (navServicios) navServicios.click();
    setTimeout(() => {
      const searchInput = document.getElementById('search-servicios');
      if (searchInput) {
        searchInput.value = ordenId;
        if (typeof filtrarOrdenes === 'function') {
          filtrarOrdenes('servicios');
        }
      }
    }, 150);
  }
};

// ===== ASOCIACIÓN TICKET HIJO -> TICKET PADRE / ORIGEN =====
function obtenerTicketPadre(t) {
  if (!t || typeof t !== 'object') return null;

  // Solo los tickets con -A (subtickets de refacciones) o derivados tienen ticket padre
  if (typeof window.esTicketHijoRefacciones === 'function' && !window.esTicketHijoRefacciones(t)) {
    return null;
  }

  const tFolio = String(t.folio || '').trim();

  // Usar pool en memoria prioritariamente
  let allTkts = (typeof tickets !== 'undefined' && Array.isArray(tickets) && tickets.length > 0)
    ? tickets
    : ((typeof window !== 'undefined' && Array.isArray(window.tickets) && window.tickets.length > 0)
      ? window.tickets
      : null);

  if (!allTkts) {
    try {
      allTkts = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
    } catch (e) {
      allTkts = [];
    }
  }

  if (!allTkts || allTkts.length === 0) return null;
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Coincidencia directa por id/folio de padre
  if (t.parentTicketId || t.ticketPadreId || t.ticket_padre_id) {
    const pId = t.parentTicketId || t.ticketPadreId || t.ticket_padre_id;
    const found = allTkts.find(x => x && (x.id === pId || x.folio === pId || norm(x.folio) === norm(pId)) && x.id !== t.id);
    if (found) return found;
  }

  // 2. Búsqueda por mención explícita en Asunto o Descripción (ej: "Refacciones para TKT-26140" o "Ticket Padre TKT-26140")
  const fullText = `${t.asunto || ''} ${t.descripcion || ''}`;
  const explicitMatch = fullText.match(/(?:ticket\s*padre|refacciones\s*para|derivado\s*del\s*ticket\s*padre|derivado\s*del\s*ticket|origen)\s*(?:TKT-)?(\d{4,6})/i);
  if (explicitMatch && explicitMatch[1]) {
    const targetNum = explicitMatch[1];
    const found = allTkts.find(x => {
      if (!x || x.id === t.id) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      const xNorm = norm(xFol);
      return xFol === `TKT-${targetNum}` || xFol === `TKT-OS-${targetNum}` || xFol === targetNum || xNum === targetNum || xNorm === ('TKT' + targetNum);
    });
    if (found) return found;
  }

  // 3. Extracción de folio limpio quitando -A, TKT-, etc.
  let cleanBase = tFolio.replace(/-[Aa]$/i, '').trim();
  if (cleanBase.startsWith('[PRUEBA] ')) cleanBase = cleanBase.replace('[PRUEBA] ', '').trim();
  if (cleanBase.startsWith('[TEST] ')) cleanBase = cleanBase.replace('[TEST] ', '').trim();
  
  // Extraer número de ticket (ej. 26249 de TKT-OS-26249-A o de TKT-26249-A)
  const numMatch = cleanBase.match(/\d{4,6}/) || (t.asunto ? String(t.asunto).match(/\d{4,6}/) : null);
  const ticketNum = numMatch ? numMatch[0] : '';

  if (ticketNum && ticketNum !== tFolio.replace(/[^0-9]/g, '')) {
    // Buscar en lista de tickets si existe TKT-26249, 26249 o TKT-OS-26249 (sin -A)
    const found = allTkts.find(x => {
      if (!x || x.id === t.id) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      const xNorm = norm(xFol);
      return xFol === `TKT-${ticketNum}` || xFol === `TKT-OS-${ticketNum}` || xFol === ticketNum || xNum === ticketNum || xNorm === ('TKT' + ticketNum);
    });
    if (found) return found;
  }

  // 4. Buscar por cleanBase
  if (cleanBase && cleanBase !== tFolio) {
    const normBase = norm(cleanBase);
    const found = allTkts.find(x => x && x.id !== t.id && (norm(x.folio) === normBase || x.id === cleanBase));
    if (found) return found;
  }

  // 5. Fallback: número identificable de ticket padre
  const fallbackNum = (explicitMatch && explicitMatch[1]) ? explicitMatch[1] : ticketNum;
  if (fallbackNum) {
    const parentFolio = `TKT-${fallbackNum}`;
    if (parentFolio !== tFolio && norm(parentFolio) !== norm(tFolio)) {
      return {
        id: parentFolio,
        folio: parentFolio,
        asunto: `Ticket Origen ${parentFolio}`,
        isSynthetic: true
      };
    }
  }

  return null;
};

// ===== RESOLUCIÓN EXHAUSTIVA DE CLIENTE PARA TICKETS =====
function resolverClienteTicket(t, depth = 0) {
  if (!t || typeof t !== 'object') return '';
  if (depth > 2) return t.cliente || '';

  const allClients = (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0)
    ? clientesDb
    : (() => {
        try {
          return JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
        } catch(e) { return []; }
      })();

  const isBlankCli = (val) => {
    if (!val) return true;
    const str = String(val).toLowerCase().trim();
    return !str || str === 'sin cliente' || str === 'ninguno' || str === 'ninguno / uso interno' || str === 'genérico' || str === 'generico' || str === 'sin_cliente' || str === '-';
  };

  // 1. Si ya tiene t.cliente válido y no en blanco
  if (!isBlankCli(t.cliente)) {
    const rawVal = String(t.cliente).trim();
    const matchedById = allClients.find(c => 
      (c.id && String(c.id).toLowerCase().trim() === rawVal.toLowerCase()) ||
      (c.idInterno && String(c.idInterno).toLowerCase().trim() === rawVal.toLowerCase()) ||
      (c.rfc && String(c.rfc).toLowerCase().trim() === rawVal.toLowerCase())
    );
    if (matchedById && matchedById.nombre) {
      return matchedById.nombre;
    }
    const matchedByName = allClients.find(c => c.nombre && String(c.nombre).toLowerCase().trim() === rawVal.toLowerCase());
    if (matchedByName) return matchedByName.nombre;
    return rawVal;
  }

  // 2. Resolver desde Ticket Padre
  const parent = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
  if (parent && parent.id !== t.id && !isBlankCli(parent.cliente)) {
    const pCli = window.resolverClienteTicket(parent, depth + 1);
    if (pCli) return pCli;
  }

  // 3. Resolver desde Orden de Servicio Asociada
  const assocOrder = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
  if (assocOrder && !isBlankCli(assocOrder.cliente)) {
    const rawOrdCli = String(assocOrder.cliente).trim();
    const matched = allClients.find(c => 
      (c.id && String(c.id).toLowerCase().trim() === rawOrdCli.toLowerCase()) ||
      (c.nombre && String(c.nombre).toLowerCase().trim() === rawOrdCli.toLowerCase())
    );
    return matched ? matched.nombre : rawOrdCli;
  }

  // 4. Resolver desde Máquina / Equipo (t.equipo)
  const eqStr = String(t.equipo || '').trim();
  if (eqStr && eqStr !== 'Otra / No registrada' && eqStr !== '—' && eqStr !== '-') {
    let maquinasPool = (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb) && maquinariaDb.length > 0)
      ? maquinariaDb
      : (() => {
          try {
            return JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
          } catch(e) { return []; }
        })();

    const eqLower = eqStr.toLowerCase();
    for (const m of maquinasPool) {
      if (!m) continue;
      const mSerie = m.serie ? String(m.serie).toLowerCase().trim() : '';
      const mIdInt = m.idInterno ? String(m.idInterno).toLowerCase().trim() : '';
      const mId = m.id ? String(m.id).toLowerCase().trim() : '';
      
      let matches = false;
      if (mSerie && mSerie.length >= 3 && eqLower.includes(mSerie)) matches = true;
      if (mIdInt && mIdInt.length >= 3 && eqLower.includes(mIdInt)) matches = true;
      if (mId && eqLower.includes(mId)) matches = true;

      if (matches && m.cliente) {
        const cliMatch = allClients.find(c => 
          (c.id && String(c.id).toLowerCase().trim() === String(m.cliente).toLowerCase().trim()) ||
          (c.nombre && String(c.nombre).toLowerCase().trim() === String(m.cliente).toLowerCase().trim())
        );
        return cliMatch ? cliMatch.nombre : m.cliente;
      }
    }

    for (const c of allClients) {
      if (c && Array.isArray(c.maquinas)) {
        for (const m of c.maquinas) {
          const mSerie = m.serie ? String(m.serie).toLowerCase().trim() : '';
          const mIdInt = m.idInterno ? String(m.idInterno).toLowerCase().trim() : '';
          if ((mSerie && mSerie.length >= 3 && eqLower.includes(mSerie)) || (mIdInt && mIdInt.length >= 3 && eqLower.includes(mIdInt))) {
            return c.nombre;
          }
        }
      }
    }
  }

  // 5. Resolver desde Sitio / Ubicación (t.sitio)
  const sitStr = String(t.sitio || '').trim();
  if (sitStr && sitStr !== 'Ninguno' && sitStr !== '—' && sitStr !== '-') {
    let sitiosPool = [];
    if (typeof sitiosDb !== 'undefined' && Array.isArray(sitiosDb)) sitiosPool = sitiosPool.concat(sitiosDb);
    try {
      const localS = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
      if (Array.isArray(localS)) sitiosPool = sitiosPool.concat(localS);
    } catch(e) {}

    const sitLower = sitStr.toLowerCase();
    const matchedSitio = sitiosPool.find(s => 
      s && (
        (s.id && String(s.id).toLowerCase() === sitLower) ||
        (s.nombre && String(s.nombre).toLowerCase() === sitLower) ||
        (s.direccion && String(s.direccion).toLowerCase() === sitLower)
      )
    );
    if (matchedSitio && matchedSitio.cliente) {
      const cliMatch = allClients.find(c => 
        (c.id && String(c.id).toLowerCase().trim() === String(matchedSitio.cliente).toLowerCase().trim()) ||
        (c.nombre && String(c.nombre).toLowerCase().trim() === String(matchedSitio.cliente).toLowerCase().trim())
      );
      return cliMatch ? cliMatch.nombre : matchedSitio.cliente;
    }
  }

  // 6. Resolver desde Cotizaciones / Pedidos SAP
  const sapVal = String(t.cotizacionSAP || t.pedidoSAP || '').trim();
  if (sapVal) {
    let quotes = window._cacheCotizacionesSap || [];
    const qMatch = quotes.find(q => q && (q.numero_cotizacion === sapVal || q.numero_pedido === sapVal));
    if (qMatch && qMatch.cliente) {
      return qMatch.cliente;
    }
  }

  // 7. Resolver desde Solicitante o Contacto
  const solStr = String(t.solicitante || '').trim().toLowerCase();
  if (solStr) {
    const cliBySol = allClients.find(c => c.nombre && c.nombre.toLowerCase().trim() === solStr);
    if (cliBySol) return cliBySol.nombre;

    let usersPool = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : [];
    const uMatch = usersPool.find(u => u && u.nombre && u.nombre.toLowerCase().trim() === solStr && u.empresa);
    if (uMatch) return uMatch.empresa;
  }

  // 8. Buscar mención directa de cliente en Asunto / Descripción / Notas
  const fullText = `${t.asunto || ''} ${t.descripcion || ''} ${t.notas || ''}`.toLowerCase();
  for (const c of allClients) {
    if (c && c.nombre && c.nombre.length >= 4) {
      const cNorm = c.nombre.toLowerCase().trim();
      if (fullText.includes(cNorm)) {
        return c.nombre;
      }
    }
  }

  return '';
};

// ===== RENDER TICKETS =====
function renderTickets(ctx) {
  if (typeof document === 'undefined') return;
  const usuarios = safeGetUsuarios();
  const currentSession = safeGetCurrentSession();
  const clientesDb = safeGetClientesDb();
  const isDashView = ctx === 'dash-tickets';
  const isV2 = ctx === 'v2';
  const bodyId = isDashView ? 'tabla-body-dash-tickets' : (isV2 ? 'v2-tickets-body' : 'tickets-body');
  
  try {
    try { actualizarFiltrosPersonal(); } catch (e) {}
    if (window.updateNotificationBell) {
      try { window.updateNotificationBell(); } catch (e) {}
    }
    const searchId = isDashView ? 'search-dash-tickets' : (isV2 ? 'v2-search-tickets' : 'search-tickets');
    
    const body = document.getElementById(bodyId);
    if (!body) return;
    const q = (document.getElementById(searchId)?.value || '').toLowerCase();
    
    let filtered = safeGetFilteredTickets().filter(t =>
      t && t.categoria !== 'Soporte General' && (
        !q ||
        String(t.asunto||'').toLowerCase().includes(q) ||
        String(t.categoria||'').toLowerCase().includes(q) ||
        String(t.tipo||'').toLowerCase().includes(q) ||
        String(t.solicitante||'').toLowerCase().includes(q) ||
        String(t.cliente||'').toLowerCase().includes(q) ||
        String(t.asignado||'').toLowerCase().includes(q) ||
        String(t.folio||'').toLowerCase().includes(q) ||
        String(t.cotizacionSAP||'').toLowerCase().includes(q) ||
        String(t.pedidoSAP||'').toLowerCase().includes(q) ||
        (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.some(c => c && (String(c.texto||'').toLowerCase().includes(q) || String(c.usuario||'').toLowerCase().includes(q))))
      )
    );
    

    
    // Ordenar dinámicamente según la columna seleccionada
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      let valA, valB;
      switch(ticketSortColumn) {
        case 'folio':
          valA = String(a.folio || '');
          valB = String(b.folio || '');
          return ticketSortDirection === 'asc'
            ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        case 'asunto':
          valA = String(a.asunto || '').toLowerCase();
          valB = String(b.asunto || '').toLowerCase();
          break;
        case 'solicitante':
          valA = String(a.solicitante || '').toLowerCase();
          valB = String(b.solicitante || '').toLowerCase();
          break;
        case 'categoria':
        case 'tipo':
          valA = String(a.categoria || a.tipo || '').toLowerCase();
          valB = String(b.categoria || b.tipo || '').toLowerCase();
          break;
        case 'area':
          valA = String(a.area || '').toLowerCase();
          valB = String(b.area || '').toLowerCase();
          break;
        case 'prioridad':
          const prioMap = { 'alta': 3, 'media': 2, 'baja': 1 };
          valA = prioMap[String(a.prioridad || '').toLowerCase()] || 0;
          valB = prioMap[String(b.prioridad || '').toLowerCase()] || 0;
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'estado':
          valA = String(a.estado || '').toLowerCase();
          valB = String(b.estado || '').toLowerCase();
          break;
        case 'comentario':
          const getCommentTime = (tkt) => {
            if (!tkt || !tkt.comentariosInternos || !tkt.comentariosInternos.length) return 0;
            const last = tkt.comentariosInternos[tkt.comentariosInternos.length - 1];
            return last && last.fecha ? new Date(last.fecha).getTime() : 0;
          };
          valA = getCommentTime(a);
          valB = getCommentTime(b);
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'cotizacion':
          valA = String(a.cotizacionSAP || '').toLowerCase();
          valB = String(b.cotizacionSAP || '').toLowerCase();
          break;
        case 'monto':
          valA = Number(a.montoCotizacion || 0);
          valB = Number(b.montoCotizacion || 0);
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'pedido':
          valA = String(a.pedidoSAP || '').toLowerCase();
          valB = String(b.pedidoSAP || '').toLowerCase();
          break;
        case 'asignado':
          valA = String(a.asignado || '').toLowerCase();
          valB = String(b.asignado || '').toLowerCase();
          break;
        case 'fecha':
          valA = new Date(a.fechaCreacion || a.fecha || 0).getTime();
          valB = new Date(b.fechaCreacion || b.fecha || 0).getTime();
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'fecha-modificacion':
        case 'fecha-mod':
          valA = new Date(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(a) : (a.fechaModificacion || a.fechaCreacion || a.fecha || 0)).getTime();
          valB = new Date(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(b) : (b.fechaModificacion || b.fechaCreacion || b.fecha || 0)).getTime();
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        default:
          valA = String(a.folio || '');
          valB = String(b.folio || '');
          return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (valA < valB) return ticketSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return ticketSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
    const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
    let tecFilter = '';
    let supFilter = '';
    let tipoFilter = '';
    if (!isEmpresa) {
      tipoFilter = document.getElementById(isDashView ? 'filter-dash-tkt-tipo' : 'filter-tkt-tipo')?.value || '';
      tecFilter = document.getElementById(isDashView ? 'filter-dash-tkt-tecnico' : 'filter-tkt-tecnico')?.value || '';
      supFilter = document.getElementById(isDashView ? 'filter-dash-tkt-supervisor' : 'filter-tkt-supervisor')?.value || '';
    } else {
      tipoFilter = document.getElementById('filter-tkt-tipo')?.value || '';
    }
  
    if (isEmpresa) {
      let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
      if (nombreEmpresaLogged) {
        nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
        filtered = filtered.filter(t => {
          if (!t) return false;
          const tcli = String(t.cliente || '').toLowerCase().trim();
          const tsol = String(t.solicitante || '').toLowerCase().trim();
          return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
        });
      } else {
        filtered = [];
      }
    }
  
    const userRole = currentSession.viewMode || '';
    if (userRole === 'tecnico') {
      if (isTestModeActive()) {
        tecFilter = '';
      } else {
        tecFilter = currentUser ? currentUser.nombre : '';
      }
    }
    if (userRole === 'supervisor') {
      supFilter = document.getElementById(isDashView ? 'filter-dash-tkt-supervisor' : 'filter-tkt-supervisor')?.value || '';
    }

    if (tipoFilter) {
      const tipoNorm = safeNorm ? safeNorm(tipoFilter) : tipoFilter.toLowerCase().trim();
      filtered = filtered.filter(t => {
        if (!t) return false;
        const cat = String(t.categoria || t.tipo || '');
        const catNorm = safeNorm ? safeNorm(cat) : cat.toLowerCase().trim();
        if (tipoNorm === 'otro') {
          return catNorm === 'otro' || !catNorm;
        }
        return catNorm === tipoNorm;
      });
    }

    if (window.ticketAntiguedadRango) {
      const nowTime = new Date().getTime();
      const msPerDay = 1000 * 60 * 60 * 24;
      const modo = window.ticketAntiguedadModo || 'mod';
      const rango = window.ticketAntiguedadRango;
      
      filtered = filtered.filter(t => {
        if (!t) return false;
        
        let targetDateStr = null;
        if (modo === 'mod') {
          targetDateStr = window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha);
        } else {
          targetDateStr = t.fechaCreacion || t.fecha;
        }
        
        if (!targetDateStr) return false;
        const targetTime = new Date(targetDateStr).getTime();
        if (isNaN(targetTime)) return false;
        
        const diffDays = (nowTime - targetTime) / msPerDay;
        
        if (rango === '1_7') {
          return diffDays <= 7;
        } else if (rango === '8_15') {
          return diffDays > 7 && diffDays <= 15;
        } else if (rango === 'gt_15') {
          return diffDays > 15;
        }
        return true;
      });
    }
    
    if (tecFilter || supFilter) {
      const tecNameLower = tecFilter ? safeNorm(tecFilter) : '';
      const supNameLower = supFilter ? safeNorm(supFilter) : '';
      
      filtered = filtered.filter(t => {
        if (!t) return false;
        let passTec = true;
        let passSup = true;
        
        if (tecFilter && tecNameLower) {
           let assigned = [];
           if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(safeResolveTecnicoNombre);
           else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => safeNorm(s));
           passTec = assignedLower.includes(tecNameLower) || 
                     (t.solicitante && safeNorm(t.solicitante) === tecNameLower) || 
                     (t.creadoPor && safeNorm(t.creadoPor) === tecNameLower);
        }
        
        if (supFilter && supNameLower) {
           let passSupClient = false;
           const cli = clientesDb.find(c => c && c.nombre === t.cliente);
           if (cli) {
              const supUser = usuarios.find(u => u && ((u.nombre && safeNorm(u.nombre) === supNameLower) || u.id === supFilter));
              const supId = supUser ? supUser.id : supFilter;
              passSupClient = (cli.supervisoresAsignados && Array.isArray(cli.supervisoresAsignados) && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (safeNorm(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
           }
           
           let assigned = [];
           if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(safeResolveTecnicoNombre);
           else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => safeNorm(s));
           
           let passSupTicket = assignedLower.includes(supNameLower) || 
                               (t.solicitante && safeNorm(t.solicitante) === supNameLower) || 
                               (t.creadoPor && safeNorm(t.creadoPor) === supNameLower);
           
           passSup = passSupClient || passSupTicket;
        }
        
        return passTec && passSup;
      });
    }
    
    if (!isDashView && !isV2 && ticketFiltroActivo !== 'todos') {
      if (ticketFiltroActivo === 'Cerrado - Aprobado') {
        filtered = filtered.filter(t => t && t.estado === 'Cerrado' && t.cotAceptada === 'si');
      } else if (ticketFiltroActivo === 'Cerrado - Rechazado') {
        filtered = filtered.filter(t => t && t.estado === 'Cerrado' && t.cotAceptada === 'no');
      } else {
        filtered = filtered.filter(t => t && t.estado === ticketFiltroActivo);
      }
    }
    if (isV2 && filtroTicketsV2 !== 'todos') {
      filtered = filtered.filter(t => t && (t.estado || '').toLowerCase() === filtroTicketsV2.toLowerCase());
    }
    
    if (isDashView && !q) {
      filtered = filtered.slice(0, 8);
    }
    
    // Actualizar contador de tickets filtrados y título de página
    const countEl = document.getElementById('tkt-filtered-count');
    if (countEl && !isDashView && !isV2) {
      countEl.textContent = `${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`;
    }
    const viewTicketsEl = document.getElementById('view-tickets');
    if (viewTicketsEl && viewTicketsEl.classList.contains('active') && !isDashView && !isV2) {
      const pageTitleEl = document.getElementById('page-title');
      if (pageTitleEl) {
        pageTitleEl.textContent = `Tickets (${filtered.length})`;
      }
    }
    
    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="14" class="empty-state">No hay tickets${q||(!isDashView && ticketFiltroActivo!=='todos')?' que coincidan':' registrados'}.</td></tr>`;
      return;
    }
    const canEdit = currentSession.viewMode !== 'consulta';
    const canDelete = ['superadmin', 'admin'].includes(currentSession.viewMode);
    const isSuperadmin = (typeof currentSession !== 'undefined' && currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));

    body.innerHTML = filtered.map((t, i) => {
      if (!t) return '';
      const latestComment = (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0)
      let comentarioHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>';
      if (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
        const ult = t.comentariosInternos[t.comentariosInternos.length - 1];
        const rawText = String(ult.texto || '').replace(/\s+/g, ' ').trim();
        const safeText = safeEscapeHTML(rawText);
        const safeUser = safeEscapeHTML(ult.usuario || '');
        const fechaStr = ult.fecha ? safeFormatFechaAmigable(ult.fecha) : '';
        const tooltip = `${safeUser}${fechaStr ? ' (' + fechaStr + ')' : ''}: ${safeText}`;
        
        comentarioHtml = `
          <div style="font-weight: 500; font-size: 0.8rem; color: var(--text-primary); line-height: 1.35; min-width: 210px; max-width: 310px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tooltip}">
            ${safeText || '—'}
          </div>
          ${(safeUser || fechaStr) ? `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 0.2rem; min-width: 210px; max-width: 310px; font-size: 0.72rem;" title="${tooltip}">
              <span style="color: var(--accent); font-weight: 600; min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="message-square" style="width:11px;height:11px;flex-shrink:0;"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeUser || 'Staff'}</span>
              </span>
              ${fechaStr ? `<span style="flex-shrink: 0; white-space: nowrap; color: var(--text-muted); font-size: 0.72rem; font-weight: 500;">• ${fechaStr}</span>` : ''}
            </div>
          ` : ''}
        `;
      }

      const assocOrder = (typeof obtenerOrdenAsociadaTicket === 'function' ? obtenerOrdenAsociadaTicket(t) : (typeof window !== 'undefined' && typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null));
      const parentTicket = !assocOrder ? (typeof obtenerTicketPadre === 'function' ? obtenerTicketPadre(t) : (typeof window !== 'undefined' && typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null)) : null;

      return `
      <tr style="cursor:pointer; transition: background 0.2s;" onclick="if(!event.target.closest('.action-btn, .os-link-btn, .parent-tkt-btn')){ verDetalleTicket('${t.id}'); }" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <td data-label="Acciones" style="white-space:nowrap; width:60px;">
          <div style="display:flex;gap:0.25rem; align-items:center;">
            <button class="action-btn" onclick="verDetalleTicket('${t.id}')" title="Ver Ticket"><i data-lucide="eye"></i></button>
            ${canEdit ? `<button class="action-btn" onclick="editarTicket('${t.id}')" title="Editar Ticket"><i data-lucide="pencil"></i></button>` : ''}
            ${assocOrder ? `<button class="action-btn os-link-btn" onclick="event.stopPropagation(); window.verOrdenDesdeTicket('${assocOrder.id}')" title="Ver Orden de Servicio ${assocOrder.folio || ''}" style="color: #2563eb; background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.25);"><i data-lucide="file-text"></i></button>` : (parentTicket ? `<button class="action-btn parent-tkt-btn" onclick="event.stopPropagation(); verDetalleTicket('${parentTicket.id}')" title="Ver Ticket Origen ${parentTicket.folio || ''}" style="color: #ea580c; background: rgba(234,88,12,0.08); border-color: rgba(234,88,12,0.25);"><i data-lucide="ticket"></i></button>` : (isSuperadmin ? `<button class="action-btn" onclick="event.stopPropagation(); window.forzarCrearOrdenServicio('${t.id}')" title="Forzar Orden de Servicio (Superadmin)" style="color: #2563eb; background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.25);"><i data-lucide="file-plus"></i></button>` : ''))}
          </div>
        </td>
        <td data-label="Folio" style="white-space: nowrap;">
          <div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start;">
            <strong>${t.folio||('#'+(i+1))}</strong>
            ${assocOrder ? `
              <button type="button" class="os-link-btn" onclick="event.stopPropagation(); window.verOrdenDesdeTicket('${assocOrder.id}')" style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 600; color: #2563eb; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); padding: 1px 5px; border-radius: 4px; cursor: pointer; text-decoration: none;" title="Abrir Orden de Servicio ${assocOrder.folio || assocOrder.id}">
                <i data-lucide="file-text" style="width: 10px; height: 10px;"></i>
                <span>${assocOrder.folio || 'Ver OS'}</span>
                <i data-lucide="external-link" style="width: 9px; height: 9px;"></i>
              </button>
            ` : (parentTicket ? `
              <button type="button" class="os-link-btn parent-tkt-btn" onclick="event.stopPropagation(); verDetalleTicket('${parentTicket.id}')" style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 600; color: #ea580c; background: rgba(234, 88, 12, 0.08); border: 1px solid rgba(234, 88, 12, 0.25); padding: 1px 5px; border-radius: 4px; cursor: pointer; text-decoration: none;" title="Abrir Ticket Origen ${parentTicket.folio || parentTicket.id}">
                <i data-lucide="ticket" style="width: 10px; height: 10px;"></i>
                <span>${parentTicket.folio || parentTicket.id}</span>
                <i data-lucide="external-link" style="width: 9px; height: 9px;"></i>
              </button>
            ` : '')}
          </div>
        </td>
        <td data-label="Asunto">
          <div style="min-width: 160px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.asunto || ''}">
            ${t.asunto||'—'}
          </div>
          ${t.categoria ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;"><span class="badge" style="background:var(--bg-hover); color:var(--text-secondary); font-size:0.68rem; padding:0.1rem 0.35rem; border:1px solid var(--border);">${t.categoria}</span></div>` : ''}
        </td>
        <td data-label="Solicitante">
          <div style="font-weight:500; min-width: 150px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.solicitante || ''}">${t.solicitante||'—'}</div>
          ${(() => {
            const resolvedCli = (typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '') || t.cliente || (parentTicket && parentTicket.cliente) || (assocOrder && assocOrder.cliente) || '';
            const resolvedSit = t.sitio || (parentTicket && parentTicket.sitio) || (assocOrder && (assocOrder.ubicacion || assocOrder.ubicacion_sitio)) || '';
            if (!resolvedCli) return '';
            return `
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; min-width: 150px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${resolvedCli}${resolvedSit ? ` - ${resolvedSit}` : ''}">
                <i data-lucide="building-2" style="width:10px;height:10px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${resolvedCli}${resolvedSit ? ` - ${resolvedSit}` : ''}
              </div>`;
          })()}
        </td>
        <td data-label="Área" style="white-space:nowrap;">${t.area||'—'}</td>
        <td data-label="Prioridad" class="col-prioridad" style="white-space:nowrap; display: ${isEmpresa ? 'none' : ''};"><span class="badge badge-${String(t.prioridad||'media').toLowerCase()}">${t.prioridad||'—'}</span></td>
        <td data-label="Estado" style="white-space:nowrap;"><span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span></td>
        <td data-label="Último Comentario" class="col-comentario-interno" style="display: ${isEmpresa ? 'none' : ''};">
          ${comentarioHtml}
        </td>
        <td data-label="Cotización SAP" style="white-space:nowrap; font-family: monospace;">${t.cotizacionSAP||'—'}</td>
        <td data-label="Monto" style="white-space:nowrap; font-weight: 600;">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</td>
        <td data-label="Pedido SAP" style="white-space:nowrap; font-family: monospace;">${t.pedidoSAP||'—'}</td>
        <td data-label="Asignado" class="col-asignado" style="white-space:nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis; display: ${isEmpresa ? 'none' : ''};" title="${t.asignado || parentTicket?.asignado || assocOrder?.tecnico || ''}">${t.asignado || parentTicket?.asignado || assocOrder?.tecnico || '—'}</td>
        <td data-label="Fecha Creación" style="white-space:nowrap;">${safeFormatFechaHoraAmigable(t.fechaCreacion || t.fecha)}</td>
        <td data-label="Última Modif." style="white-space:nowrap;">
          <div style="font-size:0.8rem; color:var(--text-secondary);">${safeFormatFechaHoraAmigable(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha))}</div>
          <div style="font-size:0.72rem; color:var(--accent); font-weight:500; overflow:hidden; text-overflow:ellipsis; max-width:135px; display:flex; align-items:center; gap:3px; margin-top:2px;" title="Modificado por ${window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || '—')}">
            <i data-lucide="user" style="width:11px;height:11px;flex-shrink:0;"></i>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || '—')}</span>
          </div>
        </td>
        <td data-label="" style="width:40px; text-align:center;">
          ${canDelete ? `<button class="action-btn del" onclick="eliminarTicket('${t.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
        </td>
      </tr>
      `;
    }).join('');
    
    try { actualizarCabeceraOrdenacion(); } catch (e) {}
    try { if (typeof window.actualizarBadgeDepuradorTickets === 'function') window.actualizarBadgeDepuradorTickets(); } catch (e) {}
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Error in renderTickets:", error);
    const body = document.getElementById(bodyId);
    if (body) {
      body.innerHTML = `<tr><td colspan="15" class="error-state" style="color:#ef4444; font-weight:600; padding:20px; text-align:center; background:rgba(239,68,68,0.05);">Falla al renderizar tickets: ${error.message}</td></tr>`;
    }
  }
}

function esTicketEnTransito(t) {
  if (!t || typeof t !== 'object') return false;
  const envios = t.envios || [];
  if (envios.length > 0) {
    const anyInTransit = envios.some(env => env.parts && env.parts.length > 0 && !env.llego);
    if (anyInTransit) return true;
  }
  const parts = t.refaccionesSeleccionadas || [];
  if (parts.length > 0) {
    return parts.some(p => p.estatusPedido === 'En Tránsito / Pedido');
  }
  return false;
};

function badgeTicketEstado(tOrEstado) {
  const estado = typeof tOrEstado === 'object' ? tOrEstado.estado : tOrEstado;
  if (typeof tOrEstado === 'object') {
    if (tOrEstado.estado === 'Cerrado') {
      return tOrEstado.cotAceptada === 'si' ? 'cerrado-aprobado' : 'cerrado-rechazado';
    }
    if (tOrEstado.estado === 'Cotización') {
      if (tOrEstado.cotAceptada === 'no' || tOrEstado.cotAceptada === 'rechazada') {
        return 'cerrado-rechazado';
      }
      if (tOrEstado.cotAceptada === 'si' || tOrEstado.cotAceptada === 'aprobada') {
        return 'cerrado-aprobado';
      }
    }
  }
  const map = { 'Abierto':'abierto', 'Cotización':'en-proceso', 'Refacciones':'refacciones', 'Cerrado':'cerrado' };
  return map[estado] || 'abierto';
}

function getTicketEstadoLabel(t) {
  if (!t) return '—';
  if (t.estado === 'Cerrado') {
    return t.cotAceptada === 'si' ? 'Aceptado' : (t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'Rechazado' : 'Aceptado');
  }
  if (t.estado === 'Cotización') {
    if (t.cotAceptada === 'si' || t.cotAceptada === 'aprobada') return 'Cotización (Aprobada)';
    if (t.cotAceptada === 'no' || t.cotAceptada === 'rechazada') return 'Cotización (Rechazada)';
  }
  return t.estado || 'Abierto';
}

// =========================================================================
// MÓDULO CATÁLOGO DE MAQUINARIA, REFACCIONES Y SITIOS
// Extraído modularmente a maquinaria.js / src/modules/maquinaria.js (-1,973 líneas)
// =========================================================================

function filtrarTickets(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ticketFiltroActivo = btn.dataset.filter; if (typeof window !== "undefined") window.ticketFiltroActivo = ticketFiltroActivo;
  renderTickets();
}

function setFiltroTickets(estado) {
  ticketFiltroActivo = estado; if (typeof window !== "undefined") window.ticketFiltroActivo = ticketFiltroActivo;
  // Sync the existing filter buttons
  document.querySelectorAll('.filter-btn').forEach(b => {
    const filterVal = b.dataset.filter;
    const isActive = filterVal === estado || (filterVal === 'Cerrado' && estado.startsWith('Cerrado -'));
    b.classList.toggle('active', isActive);
  });
  renderTickets();
}

// ===== CANAL SELECTION =====
function seleccionarCanal(canal) {
  // Hide all boxes
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  // Show selected
  const box = document.getElementById('canal-input-' + canal);
  if (box) box.style.display = 'block';
}

function updateFileLabel(input) {
  const textSpan = input.parentElement.querySelector('.file-label-text');
  const isSelected = input.files && input.files.length > 0;
  
  if (isSelected) {
    if (input.files.length === 1) {
      textSpan.textContent = input.files[0].name;
    } else {
      textSpan.textContent = `${input.files.length} archivo(s) listo(s)`;
    }
    input.parentElement.style.borderColor = 'var(--accent)';
    input.parentElement.style.color = 'var(--accent)';
    input.parentElement.style.background = 'var(--accent-light)';
  } else {
    // Si es cotización, pedido o destino en PDF, poner el texto por defecto correcto
    let defaultText = 'Subir PDF';
    if (input.id.includes('cotizacion')) {
      defaultText = 'Subir cotización en PDF';
    } else if (input.id.includes('pedido')) {
      defaultText = 'Subir pedido en PDF';
    }
    textSpan.textContent = defaultText;
    input.parentElement.style.borderColor = 'var(--border)';
    input.parentElement.style.color = 'var(--text-secondary)';
    input.parentElement.style.background = 'var(--bg-primary)';
  }

  if (input.id === 'ref-destino-pdf-file') {
    const verBtn = document.getElementById('btn-ver-destino-pdf');
    if (verBtn) {
      verBtn.style.display = isSelected ? 'inline-flex' : 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  // Controlar visibilidad del botón de limpiar/basura si existe
  const isCotizacionPdf = input.id === 't-cotizacion-pdf' || input.id.startsWith('quick-cot-pdf-');
  if (isCotizacionPdf) {
    const isModal = input.id === 't-cotizacion-pdf';
    const ticketId = isModal ? null : input.id.replace('quick-cot-pdf-', '');
    const clearBtnId = isModal ? 'btn-clear-pdf-modal' : `btn-clear-pdf-quick-${ticketId}`;
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
      clearBtn.style.display = isSelected ? 'inline-flex' : 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

  const allModuleExports = {
    updateTicketBadge,
    updateOrdenesBadge,
    actualizarFiltrosPersonal,
    ticketSortColumn,
    ticketSortDirection,
    onSortTicketsChange,
    toggleSortMenu,
    setSortDirection,
    seleccionarColumnaOrden,
    actualizarUISortMenu,
    actualizarCabeceraOrdenacion,
    ordenarTicketsPor,
    toggleTipoFilterMenu,
    setTicketTipoFilter,
    actualizarUITipoFilter,
    toggleSupervisorFilterMenu,
    setTicketSupervisorFilter,
    actualizarUISupervisorFilter,
    toggleAntiguedadFilterMenu,
    cambiarModoAntiguedad,
    setAntiguedadRango,
    setAntiguedadFilter,
    actualizarUIAntiguedadFilter,
    esTicketHijoRefacciones,
    obtenerOrdenAsociadaTicket,
    verOrdenDesdeTicket,
    obtenerTicketPadre,
    resolverClienteTicket,
    renderTickets,
    esTicketEnTransito,
    badgeTicketEstado,
    getTicketEstadoLabel,
    filtrarTickets,
    setFiltroTickets,
    seleccionarCanal,
    updateFileLabel
  };

  if (typeof root !== "undefined") {
    root.TicketsListado = allModuleExports;
    Object.assign(root, allModuleExports);
  }
  if (typeof window !== "undefined") {
    window.TicketsListado = allModuleExports;
    Object.assign(window, allModuleExports);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = allModuleExports;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
