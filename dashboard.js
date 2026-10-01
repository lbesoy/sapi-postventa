/**
 * MÓDULO DE DASHBOARD EJECUTIVO, ESTADÍSTICAS Y GRÁFICAS V2
 * Eurorep / SAPI - Vanilla Browser Bundle
 */
(function(global) {
  "use strict";

  // Fallbacks y polyfills defensivos para Node.js y ambientes desacoplados
  if (typeof global.usuarios === "undefined") global.usuarios = [];
  if (typeof global.tickets === "undefined") global.tickets = [];
  if (typeof global.ordenes === "undefined") global.ordenes = [];
  if (typeof global.maquinariaDb === "undefined") global.maquinariaDb = [];
  if (typeof global.clientesDb === "undefined") global.clientesDb = [];
  if (typeof global.sitiosDb === "undefined") global.sitiosDb = [];
  if (typeof global.currentSession === "undefined") global.currentSession = { userId: "admin", viewMode: "admin" };
  if (typeof global.getFilteredOrders === "undefined") {
    global.getFilteredOrders = () => (typeof ordenes !== "undefined" ? ordenes : (global.ordenes || []));
  }
  if (typeof global.getFilteredTickets === "undefined") {
    global.getFilteredTickets = () => (typeof tickets !== "undefined" ? tickets : (global.tickets || []));
  }
  if (typeof global.resolveTecnicoNombre === "undefined") {
    global.resolveTecnicoNombre = (idOrName) => idOrName;
  }
  if (typeof global.badgeTicketEstado === "undefined") {
    global.badgeTicketEstado = (t) => "pendiente";
  }
  if (typeof global.normStr === "undefined") {
    global.normStr = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

// ===== DESGLOSE DASHBOARD =====
function abrirDesgloseDashboard(tipo, filtro) {
  if (typeof document === "undefined") return;
  const modal = document.getElementById('modal-dashboard-desglose');
  const title = document.getElementById('modal-dashboard-desglose-title');
  const thead = document.getElementById('tabla-dashboard-desglose-head');
  const tbody = document.getElementById('tabla-dashboard-desglose-body');
  
  if (!modal || !title || !thead || !tbody) return;
  
  thead.innerHTML = '';
  tbody.innerHTML = '';
  
  // Obtenemos los filtros base (si es cliente)
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = null;
  if (isEmpresa && currentUser) {
    nombreEmpresaLogged = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
  }
  
  let data = [];
  
  if (tipo === 'maquinas') {
    title.textContent = "Desglose: Mis Máquinas";
    thead.innerHTML = `<tr><th>Cliente</th><th>ID / Serie</th><th>Tipo / Modelo</th><th>Ubicación</th></tr>`;
    
    // Obtener máquinas
    maquinariaDb.forEach(m => {
      const mcli = String(m.cliente || '').toLowerCase().trim();
      if (!isEmpresa || mcli === nombreEmpresaLogged) {
        data.push({ cliente: m.cliente || 'N/A', id: m.idInterno || m.serie || 'N/A', modelo: m.modelo || m.tipo || 'N/A', ubicacion: m.ubicacion || m.customData?.ubicacion || m.sitio || m.cliente || 'N/A' });
      }
    });
    clientesDb.forEach(c => {
      if (!isEmpresa || (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged)) {
        if (c.maquinas) {
          c.maquinas.forEach(m => {
            data.push({ cliente: c.nombre, id: m.idInterno || m.serie || 'N/A', modelo: m.modelo || m.tipo || 'N/A', ubicacion: m.ubicacion || m.customData?.ubicacion || m.sitio || c.nombre || 'N/A' });
          });
        }
      }
    });
    
    data.forEach(d => {
      tbody.innerHTML += `<tr><td>${d.cliente}</td><td>${d.id}</td><td>${d.modelo}</td><td>${d.ubicacion}</td></tr>`;
    });
  }
  
  else if (tipo === 'sitios') {
    title.textContent = "Desglose: Mis Sitios";
    thead.innerHTML = `<tr><th>Cliente</th><th>Nombre del Sitio</th><th>Estado</th><th>Dirección</th></tr>`;
    
    // Obtener sitios
    sitiosDb.forEach(s => {
      const scli = String(s.cliente || '').toLowerCase().trim();
      if (!isEmpresa || scli === nombreEmpresaLogged) {
        data.push({ cliente: s.cliente || 'N/A', nombre: s.nombre || 'N/A', estado: s.estado || 'N/A', direccion: s.direccion || 'N/A' });
      }
    });
    clientesDb.forEach(c => {
      if (!isEmpresa || (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged)) {
        if (c.sitios) {
          c.sitios.forEach(s => {
            data.push({ cliente: c.nombre, nombre: s.nombre || 'N/A', estado: s.estado || 'N/A', direccion: s.direccion || 'N/A' });
          });
        }
      }
    });
    
    data.forEach(d => {
      tbody.innerHTML += `<tr><td>${d.cliente}</td><td>${d.nombre}</td><td><span class="badge ${d.estado === 'Activo' ? 'badge-completado' : 'badge-pendiente'}">${d.estado}</span></td><td>${d.direccion}</td></tr>`;
    });
  }
  
  else if (tipo === 'ordenes' || tipo === 'chart_ord_tipo' || tipo === 'chart_ord_cliente' || tipo === 'chart_ord_equipo') {
    if (tipo === 'ordenes') title.textContent = filtro ? `Desglose: Órdenes - ${filtro}` : `Desglose: Total Órdenes`;
    if (tipo === 'chart_ord_tipo') title.textContent = `Desglose: Órdenes - Tipo: ${filtro}`;
    if (tipo === 'chart_ord_cliente') title.textContent = `Desglose: Órdenes - Cliente: ${filtro}`;
    if (tipo === 'chart_ord_equipo') title.textContent = `Desglose: Órdenes - Equipo: ${filtro}`;
    
    thead.innerHTML = `<tr><th>Folio</th><th>Cliente</th><th>Estado</th><th>Fecha</th></tr>`;
    
    let ordenesFiltradas = getFilteredOrders();
    if (isEmpresa && currentUser) {
      const hasEmpresa = !!(currentUser.empresa && String(currentUser.empresa).trim() !== '');
      const nombreFiltro = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
      
      ordenesFiltradas = ordenesFiltradas.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        let fromTicket = false;
        if (!hasEmpresa && o.soporte) {
          const tick = tickets.find(t => t.id === o.soporte);
          if (tick) {
            const tcli = String(tick.cliente || '').toLowerCase().trim();
            const tsol = String(tick.solicitante || '').toLowerCase().trim();
            if (tcli === nombreFiltro || tsol === nombreFiltro) fromTicket = true;
          }
        }
        if (hasEmpresa) return ocli === nombreFiltro;
        return ocli === nombreFiltro || fromTicket;
      });
    }
    
    if (tipo === 'ordenes' && filtro) {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.estado || '').toLowerCase().trim() === filtro.toLowerCase().trim());
    } else if (tipo === 'chart_ord_tipo') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.tipo || 'Otro').toLowerCase().trim() === filtro.toLowerCase().trim());
    } else if (tipo === 'chart_ord_cliente') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.cliente || '').toLowerCase().trim() === filtro.toLowerCase().trim());
    } else if (tipo === 'chart_ord_equipo') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.modelo || '').toLowerCase().trim() === filtro.toLowerCase().trim());
    }
    
    ordenesFiltradas.forEach(d => {
      const badgeClass = `badge-${(d.estado||'').toLowerCase().replace(/\s+/g,'-')}`;
      tbody.innerHTML += `<tr><td>${d.folio || 'N/A'}</td><td>${d.cliente || 'N/A'}</td><td><span class="badge ${badgeClass}">${d.estado}</span></td><td>${formatFechaAmigable(d.fecha)}</td></tr>`;
    });
  }
  
  else if (tipo === 'tickets' || tipo === 'chart_tkt_area') {
    if (tipo === 'tickets') title.textContent = filtro ? `Desglose: Tickets - ${filtro}` : `Desglose: Total Tickets`;
    if (tipo === 'chart_tkt_area') title.textContent = `Desglose: Tickets - Área: ${filtro}`;
    
    thead.innerHTML = `<tr><th>#</th><th>Asunto</th><th>Empresa</th><th>Estado</th><th>Monto</th>${!isEmpresa ? '<th>Prioridad</th>' : ''}</tr>`;
    
    let ticketsFiltrados = getFilteredTickets();
    if (isEmpresa && nombreEmpresaLogged) {
      ticketsFiltrados = ticketsFiltrados.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    }
    
    if (tipo === 'tickets' && filtro) {
      if (filtro === 'Cerrado - Aprobado') {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si');
      } else if (filtro === 'Cerrado - Rechazado') {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'no');
      } else {
        ticketsFiltrados = ticketsFiltrados.filter(t => (t.estado || '').toLowerCase().trim() === filtro.toLowerCase().trim());
      }
    } else if (tipo === 'chart_tkt_area') {
      ticketsFiltrados = ticketsFiltrados.filter(t => (t.area || 'Sin área').toLowerCase().trim() === filtro.toLowerCase().trim());
    }
    
    ticketsFiltrados.forEach(d => {
      const badgeClass = `badge-${badgeTicketEstado(d)}`;
      const estadoText = d.estado === 'Cerrado' ? (d.cotAceptada === 'si' ? 'Aceptado' : (d.cotAceptada === 'no' || d.cotAceptada === 'rechazada' ? 'Rechazado' : 'Aceptado')) : d.estado;
      const montoText = (d.montoCotizacion !== undefined && d.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(d.montoCotizacion) : '—';
      tbody.innerHTML += `<tr><td>${d.folio || d.id.split('-')[0]}</td><td>${d.asunto || 'N/A'}</td><td>${d.cliente || d.solicitante || 'N/A'}</td><td><span class="badge ${badgeClass}">${estadoText}</span></td><td style="font-weight:600; white-space:nowrap;">${montoText}</td>${!isEmpresa ? `<td>${d.prioridad || 'Media'}</td>` : ''}</tr>`;
    });
  }
  
  else if (tipo === 'rendimiento') {
    if (filtro === 'refacciones') {
      title.textContent = `Desglose: Refacciones Faltantes`;
      thead.innerHTML = `<tr><th>Refacción</th><th>Cantidad</th><th>Folio Orden</th><th>Cliente</th><th>Técnico</th></tr>`;
      getFilteredOrders().forEach(o => {
        if (!['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()) && o.ref_necesarias && o.ref_necesarias.length > 0) {
          o.ref_necesarias.forEach(r => {
            const desc = r.descripcion || r.clave || 'N/A';
            const cant = r.cantidad || 1;
            tbody.innerHTML += `<tr>
              <td style="font-weight: 600; color: var(--text-primary);">${desc}</td>
              <td style="font-weight: 700; color: var(--accent);">${cant}</td>
              <td>${o.folio || 'N/A'}</td>
              <td>${o.cliente || 'N/A'}</td>
              <td>${o.tecnico || 'N/A'}</td>
            </tr>`;
          });
        }
      });
    } else if (filtro === 'ordenes') {
      title.textContent = `Desglose: Resolución de Órdenes`;
      thead.innerHTML = `<tr><th>Folio</th><th>Cliente</th><th>Estado</th><th>Días de Resolución</th></tr>`;
      getFilteredOrders().forEach(o => {
        if (['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())) {
          let fCreacion = new Date(o.fecha || 0);
          let fCierre = o.fechaFin ? new Date(o.fechaFin) : fCreacion;
          if (o.bitacora && o.bitacora.length > 0) {
            let maxB = Math.max(...o.bitacora.map(b => new Date(b.fecha).getTime()));
            if (!isNaN(maxB) && maxB > fCierre.getTime()) fCierre = new Date(maxB);
          }
          let diff = fCierre.getTime() - fCreacion.getTime();
          let dias = Math.ceil(diff / (1000 * 3600 * 24));
          if (dias < 0) dias = 0;
          tbody.innerHTML += `<tr><td>${o.folio || 'N/A'}</td><td>${o.cliente || 'N/A'}</td><td><span class="badge badge-completado">Completado</span></td><td style="font-weight:600; color:var(--text-primary);">${dias} días</td></tr>`;
        }
      });
    } else if (filtro === 'tickets') {
      title.textContent = `Desglose: Resolución de Tickets`;
      thead.innerHTML = `<tr><th>#</th><th>Asunto</th><th>Estado</th><th>Días de Resolución</th></tr>`;
      getFilteredTickets().forEach(t => {
        if ((t.estado || '').toLowerCase() === 'cerrado') {
          let fCreacion = new Date(t.fechaCreacion || t.created_at || new Date());
          let fCierre = new Date(t.fechaCierre || t.updated_at || t.fechaCreacion || t.created_at || new Date());
          let diff = fCierre.getTime() - fCreacion.getTime();
          let dias = Math.ceil(diff / (1000 * 3600 * 24));
          if (dias < 0) dias = 0;
          tbody.innerHTML += `<tr><td>${t.folio || t.id.split('-')[0]}</td><td>${t.asunto || 'N/A'}</td><td><span class="badge badge-cerrado">Cerrado</span></td><td style="font-weight:600; color:var(--text-primary);">${dias} días</td></tr>`;
        }
      });
    }
  }
  if (tbody.innerHTML === '') {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="text-align: center;">No hay registros para este desglose.</td></tr>`;
  }
  
  modal.classList.add('open');
};

// ===== STATS =====
function renderStats() {
  if (typeof document === "undefined") return;
  try {
    _renderStatsInternal();
  } catch (error) {
    console.error("Error in renderStats:", error);
  }
}

function _renderStatsInternal() {
  if (typeof document === "undefined") return;
  let ordenesFilter = getFilteredOrders();
  let ticketsFilter = getFilteredTickets();

  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const hasEmpresa = currentUser ? !!(currentUser.empresa && String(currentUser.empresa).trim() !== '') : false;

  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      ordenesFilter = ordenesFilter.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        let fromTicket = false;
        if (!hasEmpresa && o.soporte) {
          const tick = tickets.find(t => t.id === o.soporte);
          if (tick) {
            const tcli = String(tick.cliente || '').toLowerCase().trim();
            const tsol = String(tick.solicitante || '').toLowerCase().trim();
            if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
          }
        }
        if (hasEmpresa) return ocli === nombreEmpresaLogged;
        return ocli === nombreEmpresaLogged || fromTicket;
      });
      ticketsFilter = ticketsFilter.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        if (hasEmpresa) return tcli === nombreEmpresaLogged;
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
      
      let countMaquinas = 0;
      maquinariaDb.forEach(m => {
        const mcli = String(m.cliente || '').toLowerCase().trim();
        if (mcli === nombreEmpresaLogged) countMaquinas++;
      });
      clientesDb.forEach(c => {
        if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
          if (c.maquinas) countMaquinas += c.maquinas.length;
        }
      });
      
      let countSitios = 0;
      sitiosDb.forEach(s => {
        const scli = String(s.cliente || '').toLowerCase().trim();
        if (scli === nombreEmpresaLogged) countSitios++;
      });
      clientesDb.forEach(c => {
        if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
          if (c.sitios) countSitios += c.sitios.length;
        }
      });
      
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'none';
      
      const elMaquinas = document.getElementById('stat-cli-maquinas');
      if (elMaquinas) elMaquinas.textContent = countMaquinas;
      
      const elSitios = document.getElementById('stat-cli-sitios');
      if (elSitios) elSitios.textContent = countSitios;

    } else {
      ordenesFilter = [];
      ticketsFilter = [];
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'none';
    }
  } else {
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'none';
      
      const userRole = currentSession.viewMode || '';
      if (userRole === 'tecnico') {
        const tecName = currentUser ? currentUser.nombre : '';
        const tecNameLower = window.normStr(tecName);
        ordenesFilter = ordenesFilter.filter(o => {
          let assigned = [];
          if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
          else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
          const assignedLower = assigned.map(s => window.normStr(s));
          let isCreator = false;
          let isTkAssigned = false;
          if (o.creadoPor && window.normStr(o.creadoPor) === tecNameLower) isCreator = true;
          if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
              if ((tk.solicitante && window.normStr(tk.solicitante) === tecNameLower) || 
                  (tk.creadoPor && window.normStr(tk.creadoPor) === tecNameLower)) isCreator = true;
              let tkAssigned = [];
              if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
              else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
              const tkAssignedLower = tkAssigned.map(s => window.normStr(s));
              if (tkAssignedLower.includes(tecNameLower)) isTkAssigned = true;
            }
          }
          return assignedLower.includes(tecNameLower) || isCreator || isTkAssigned;
        });

        ticketsFilter = ticketsFilter.filter(t => {
          let assigned = [];
          if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
          else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
          const assignedLower = assigned.map(s => window.normStr(s));
          return assignedLower.includes(tecNameLower) || 
                 (t.solicitante && window.normStr(t.solicitante) === tecNameLower) || 
                 (t.creadoPor && window.normStr(t.creadoPor) === tecNameLower);
        });
      } else if (userRole === 'supervisor') {
        const supFilter = currentUser ? currentUser.nombre : '';
        const supNameLower = window.normStr(supFilter);
        ordenesFilter = ordenesFilter.filter(o => {
          let passSupClient = false;
          const cli = clientesDb.find(c => c.nombre === o.cliente);
          if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
          }
          
          let assigned = [];
          if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
          else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
          const assignedLower = assigned.map(s => window.normStr(s));
          
          let passSupTicket = assignedLower.includes(supNameLower);
          let isCreator = false;
          if (o.creadoPor && window.normStr(o.creadoPor) === supNameLower) isCreator = true;
          if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
              if ((tk.solicitante && window.normStr(tk.solicitante) === supNameLower) || 
                  (tk.creadoPor && window.normStr(tk.creadoPor) === supNameLower)) isCreator = true;
              let tkAssigned = [];
              if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
              else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
              const tkAssignedLower = tkAssigned.map(s => window.normStr(s));
              if (tkAssignedLower.includes(supNameLower)) passSupTicket = true;
            }
          }
          return passSupClient || passSupTicket || isCreator;
        });

        const isLauraPaz = currentUser && (
          String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
          String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
          String(currentUser.email).toLowerCase().trim().includes('laurapaz')
        );
        if (!isLauraPaz) {
          ticketsFilter = ticketsFilter.filter(t => {
            let passSupClient = false;
            const cli = clientesDb.find(c => c.nombre === t.cliente);
            if (cli) {
              const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
              const supId = supUser ? supUser.id : supFilter;
              passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
            }
            
            let assigned = [];
            if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
            else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
            const assignedLower = assigned.map(s => window.normStr(s));
            
            let passSupTicket = assignedLower.includes(supNameLower) || 
                                (t.solicitante && window.normStr(t.solicitante) === supNameLower) || 
                                (t.creadoPor && window.normStr(t.creadoPor) === supNameLower);
            
            return passSupClient || passSupTicket;
          });
        }
      }
  }

  const total = ordenesFilter.length;
  const proceso = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'en proceso').length;
  const pendientes = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'pendiente').length;
  const completas = ordenesFilter.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;
  const refaccionesPendientes = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'refacciones pendientes').length;
  const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setStat('stat-total', total);
  setStat('stat-proceso', proceso);
  setStat('stat-pendientes', pendientes);
  setStat('stat-completas', completas);

  if (document.getElementById('stat-serv-total')) {
    document.getElementById('stat-serv-total').textContent = total;
    document.getElementById('stat-serv-proceso').textContent = proceso;
    document.getElementById('stat-serv-pendientes').textContent = pendientes;
    document.getElementById('stat-serv-refacciones-pendientes').textContent = refaccionesPendientes;
    document.getElementById('stat-serv-completas').textContent = completas;
  }

  // Stats Tickets
  const t_total = ticketsFilter.length;
  const t_abiertos = ticketsFilter.filter(t => t.estado === 'Abierto').length;
  const t_refacciones = ticketsFilter.filter(t => t.estado === 'Refacciones').length;
  const t_cotizacion = ticketsFilter.filter(t => t.estado === 'Cotización').length;
  const t_cerrados_aprobados = ticketsFilter.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si').length;
  const t_cerrados_rechazados = ticketsFilter.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'no').length;
  const t_cerrados = t_cerrados_aprobados + t_cerrados_rechazados;

  const sum_cotizacion = ticketsFilter.filter(t => t.estado === 'Cotización').reduce((sum, t) => sum + (Number(t.montoCotizacion) || 0), 0);
  const sum_cerrados_aprobados = ticketsFilter.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si').reduce((sum, t) => sum + (Number(t.montoCotizacion) || 0), 0);
  const formatMontoShort = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const elTotalT = document.getElementById('stat-t-total');
  if (elTotalT) {
    elTotalT.textContent = t_total;
    document.getElementById('stat-t-abiertos').textContent = t_abiertos;
    document.getElementById('stat-t-cotizacion').textContent = t_cotizacion;
    document.getElementById('stat-t-cerrados').textContent = t_cerrados;
  }
  if (document.getElementById('stat-tkt-total')) {
    document.getElementById('stat-tkt-total').textContent = t_total;
    document.getElementById('stat-tkt-abiertos').textContent = t_abiertos;
    document.getElementById('stat-tkt-refacciones').textContent = t_refacciones;
    document.getElementById('stat-tkt-cotizacion').textContent = t_cotizacion;
    
    const elCerrAp = document.getElementById('stat-tkt-cerrados-aprobados');
    if (elCerrAp) elCerrAp.textContent = t_cerrados_aprobados;
    const elCerrRech = document.getElementById('stat-tkt-cerrados-rechazados');
    if (elCerrRech) elCerrRech.textContent = t_cerrados_rechazados;
    
    // Update sum of amounts
    const elCotMonto = document.getElementById('stat-tkt-cotizacion-monto');
    if (elCotMonto) {
      if (sum_cotizacion > 0) {
        elCotMonto.textContent = formatMontoShort(sum_cotizacion);
        elCotMonto.style.display = 'inline-block';
      } else {
        elCotMonto.style.display = 'none';
      }
    }
    const elCerrMonto = document.getElementById('stat-tkt-cerrados-aprobados-monto');
    if (elCerrMonto) {
      if (sum_cerrados_aprobados > 0) {
        elCerrMonto.textContent = formatMontoShort(sum_cerrados_aprobados);
        elCerrMonto.style.display = 'inline-block';
      } else {
        elCerrMonto.style.display = 'none';
      }
    }
  }
  // V2 dashboard stats
  const setV2 = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setV2('v2-stat-total', total); setV2('v2-stat-pendientes', pendientes);
  setV2('v2-stat-proceso', proceso);
  setV2('v2-stat-refacciones-pendientes', refaccionesPendientes);
  setV2('v2-stat-completas', completas);
  setV2('v2-stat-t-total', t_total); setV2('v2-stat-t-abiertos', t_abiertos);
  setV2('v2-stat-t-refacciones', t_refacciones);
  setV2('v2-stat-t-cotizacion', t_cotizacion);
  setV2('v2-stat-t-cerrados-aprobados', t_cerrados_aprobados);
  setV2('v2-stat-t-cerrados-rechazados', t_cerrados_rechazados);
  
  // Set amounts for V2 dashboard
  const elV2CotMonto = document.getElementById('v2-stat-t-cotizacion-monto');
  if (elV2CotMonto) {
    if (sum_cotizacion > 0) {
      elV2CotMonto.textContent = formatMontoShort(sum_cotizacion);
      elV2CotMonto.style.display = 'inline-block';
    } else {
      elV2CotMonto.style.display = 'none';
    }
  }
  const elV2CerrMonto = document.getElementById('v2-stat-t-cerrados-aprobados-monto');
  if (elV2CerrMonto) {
    if (sum_cerrados_aprobados > 0) {
      elV2CerrMonto.textContent = formatMontoShort(sum_cerrados_aprobados);
      elV2CerrMonto.style.display = 'inline-block';
    } else {
      elV2CerrMonto.style.display = 'none';
    }
  }
  
  if (typeof renderDashboardV2 === 'function') {
    renderDashboardV2();
  }
}

// ===== DASHBOARD V2 ANALYTICS =====
let _v2Charts = {};

function getFilteredByTimeframe(items, timeframe) {
  if (!timeframe || timeframe === 'all') return items;
  
  const now = new Date();
  let startLimit;
  
  if (timeframe === 'today') {
    startLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (timeframe === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startLimit = new Date(now.getFullYear(), now.getMonth(), diff);
    startLimit.setHours(0,0,0,0);
  } else if (timeframe === 'month') {
    startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  return items.filter(item => {
    const val = item.fecha || item.fechaCreacion || item.fechaInicio || item.start;
    if (!val) return false;
    let itemDate;
    if (val.length === 10) {
      itemDate = new Date(val + 'T00:00:00');
    } else {
      itemDate = new Date(val);
    }
    return !isNaN(itemDate.getTime()) && itemDate >= startLimit;
  });
}

function renderDashboardV2() {
  if (typeof document === "undefined") return;
  // Fecha
  const el = document.getElementById('v2-fecha-hoy');
  if (el) el.textContent = new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = null;
  if (isEmpresa && currentUser) {
    nombreEmpresaLogged = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
  }

  const timeframe = document.getElementById('dash-date-filter') ? document.getElementById('dash-date-filter').value : 'all';
  let ordenesDash = getFilteredByTimeframe(getFilteredOrders(), timeframe);
  let ticketsDash = getFilteredByTimeframe(getFilteredTickets(), timeframe);
  let maquinariaDash = maquinariaDb;

  if (isEmpresa && nombreEmpresaLogged) {
    ordenesDash = ordenesDash.filter(o => {
      const ocli = String(o.cliente || '').toLowerCase().trim();
      let fromTicket = false;
      if (o.soporte) {
        const tick = tickets.find(t => t.id === o.soporte);
        if (tick) {
          const tcli = String(tick.cliente || '').toLowerCase().trim();
          const tsol = String(tick.solicitante || '').toLowerCase().trim();
          if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
        }
      }
      return ocli === nombreEmpresaLogged || fromTicket;
    });
    ticketsDash = ticketsDash.filter(t => {
      const tcli = String(t.cliente || '').toLowerCase().trim();
      const tsol = String(t.solicitante || '').toLowerCase().trim();
      return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
    });
    maquinariaDash = maquinariaDb.filter(m => String(m.cliente || '').toLowerCase().trim() === nombreEmpresaLogged);

    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Mis Sitios';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Mis Máquinas';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Equipos (Mantenimientos)';
  } else if ((currentSession.viewMode || '') === 'tecnico') {
    const tecName = currentUser ? currentUser.nombre : '';
    const tecNameLower = tecName.toLowerCase().trim();
    ordenesDash = ordenesDash.filter(o => {
      let assigned = [];
      if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
      else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
      const assignedLower = assigned.map(s => String(s).toLowerCase().trim());
      let isCreator = false;
      let isTkAssigned = false;
      if (o.creadoPor && String(o.creadoPor).toLowerCase().trim() === tecNameLower) isCreator = true;
      if (o.soporte) {
        const tk = tickets.find(x => x.id === o.soporte);
        if (tk) {
          if ((tk.solicitante && String(tk.solicitante).toLowerCase().trim() === tecNameLower) || 
              (tk.creadoPor && String(tk.creadoPor).toLowerCase().trim() === tecNameLower)) isCreator = true;
          let tkAssigned = [];
          if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
          else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
          const tkAssignedLower = tkAssigned.map(s => String(s).toLowerCase().trim());
          if (tkAssignedLower.includes(tecNameLower)) isTkAssigned = true;
        }
      }
      return assignedLower.includes(tecNameLower) || isCreator || isTkAssigned;
    });

    ticketsDash = ticketsDash.filter(t => {
      let assigned = [];
      if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
      else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
      const assignedLower = assigned.map(s => String(s).toLowerCase().trim());
      return assignedLower.includes(tecNameLower) || 
             (t.solicitante && String(t.solicitante).toLowerCase().trim() === tecNameLower) || 
             (t.creadoPor && String(t.creadoPor).toLowerCase().trim() === tecNameLower);
    });

    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Resolución Órdenes';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Resolución Tickets';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Clientes (Ordenes)';
  } else if ((currentSession.viewMode || '') === 'supervisor') {
    const supFilter = currentUser ? currentUser.nombre : '';
    ordenesDash = ordenesDash.filter(o => {
      let passSupClient = false;
      const cli = clientesDb.find(c => c.nombre === o.cliente);
      if (cli) {
        const supUser = usuarios.find(u => u.nombre === supFilter || u.id === supFilter);
        const supId = supUser ? supUser.id : supFilter;
        passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (cli.supervisorAsignado === supFilter);
      }
      
      let assigned = [];
      if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
      else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
      
      let passSupTicket = assigned.includes(supFilter);
      let isCreator = false;
      if (o.creadoPor === supFilter) isCreator = true;
      if (o.soporte) {
        const tk = tickets.find(x => x.id === o.soporte);
        if (tk) {
          if (tk.solicitante === supFilter || tk.creadoPor === supFilter) isCreator = true;
          let tkAssigned = [];
          if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
          else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
          if (tkAssigned.includes(supFilter)) passSupTicket = true;
        }
      }
      return passSupClient || passSupTicket || isCreator;
    });

    const isLauraPaz = currentUser && (
      String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
      String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
      String(currentUser.email).toLowerCase().trim().includes('laurapaz')
    );
    if (!isLauraPaz) {
      ticketsDash = ticketsDash.filter(t => {
        let passSupClient = false;
        const cli = clientesDb.find(c => c.nombre === t.cliente);
        if (cli) {
          const supUser = usuarios.find(u => u.nombre === supFilter || u.id === supFilter);
          const supId = supUser ? supUser.id : supFilter;
          passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (cli.supervisorAsignado === supFilter);
        }
        
        let assigned = [];
        if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
        else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
        
        let passSupTicket = assigned.includes(supFilter) || t.solicitante === supFilter || t.creadoPor === supFilter;
        
        return passSupClient || passSupTicket;
      });
    }

    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Resolución Órdenes';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Resolución Tickets';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Clientes (Ordenes)';
  } else {
    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Resolución Órdenes';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Resolución Tickets';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Clientes (Ordenes)';
  }

  // --- Rendimiento Global ---
  let refFaltantes = 0;
  let totalDiasOrdenes = 0;
  let countOrdenesCerradas = 0;

  ordenesDash.forEach(o => {
    const estado = (o.estado || '').toLowerCase();
    
    if (!['completado', 'cerrada', 'cerrado'].includes(estado)) {
      if (o.ref_necesarias && Array.isArray(o.ref_necesarias)) {
        refFaltantes += o.ref_necesarias.length;
      }
    } else {
      let fCreacion = new Date(o.fecha || 0);
      let fCierre = o.fechaFin ? new Date(o.fechaFin) : fCreacion;
      if (o.bitacora && o.bitacora.length > 0) {
        let maxB = Math.max(...o.bitacora.map(b => new Date(b.fecha).getTime()));
        if (!isNaN(maxB) && maxB > fCierre.getTime()) fCierre = new Date(maxB);
      }
      let diff = fCierre.getTime() - fCreacion.getTime();
      let dias = Math.ceil(diff / (1000 * 3600 * 24));
      if (dias < 0) dias = 0;
      totalDiasOrdenes += dias;
      countOrdenesCerradas++;
    }
  });

  let totalDiasTickets = 0;
  let countTicketsCerrados = 0;
  ticketsDash.forEach(t => {
    if ((t.estado || '').toLowerCase() === 'cerrado') {
      let fCreacion = new Date(t.fechaCreacion || t.created_at || new Date());
      let fCierre = new Date(t.fechaCierre || t.updated_at || t.fechaCreacion || t.created_at || new Date());
      let diff = fCierre.getTime() - fCreacion.getTime();
      let dias = Math.ceil(diff / (1000 * 3600 * 24));
      if (dias < 0) dias = 0;
      totalDiasTickets += dias;
      countTicketsCerrados++;
    }
  });

  const avgDiasOrdenes = countOrdenesCerradas > 0 ? Math.round(totalDiasOrdenes / countOrdenesCerradas) : 0;
  const avgDiasTickets = countTicketsCerrados > 0 ? Math.round(totalDiasTickets / countTicketsCerrados) : 0;

  const elRef = document.getElementById('v2-stat-ref-faltantes');
  if (elRef) elRef.textContent = refFaltantes;
  
  const elOrd = document.getElementById('v2-stat-avg-ordenes');
  const elTkt = document.getElementById('v2-stat-avg-tickets');
  
  const cardOrd = elOrd ? elOrd.closest('.stat-card') : null;
  const cardTkt = elTkt ? elTkt.closest('.stat-card') : null;
  const labelOrd = document.getElementById('v2-label-rend-2');
  const labelTkt = document.getElementById('v2-label-rend-3');
  const iconDivOrd = cardOrd ? cardOrd.querySelector('.stat-icon') : null;
  const iconDivTkt = cardTkt ? cardTkt.querySelector('.stat-icon') : null;
  const textOrd = document.getElementById('v2-desc-rend-2');
  const textTkt = document.getElementById('v2-desc-rend-3');
  
  if (isEmpresa && nombreEmpresaLogged) {
    let countMaquinas = 0;
    maquinariaDash.forEach(m => {
      const mcli = String(m.cliente || '').toLowerCase().trim();
      if (mcli === nombreEmpresaLogged) countMaquinas++;
    });
    clientesDb.forEach(c => {
      if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
        if (c.maquinas) countMaquinas += c.maquinas.length;
      }
    });

    let countSitios = 0;
    sitiosDb.forEach(s => {
      const scli = String(s.cliente || '').toLowerCase().trim();
      if (scli === nombreEmpresaLogged) countSitios++;
    });
    clientesDb.forEach(c => {
      if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
        if (c.sitios) countSitios += c.sitios.length;
      }
    });

    const sitiosCount = countSitios;
    const equiposCount = countMaquinas;
    
    if (labelOrd) labelOrd.textContent = 'Mis Sitios';
    if (textOrd) textOrd.textContent = 'Registrados en el sistema';
    if (elOrd) { elOrd.textContent = sitiosCount; elOrd.style.color = '#4f8ef7'; }
    if (cardOrd) cardOrd.setAttribute('onclick', "abrirDesgloseDashboard('sitios', '')");
    if (iconDivOrd) iconDivOrd.innerHTML = '<i data-lucide="map-pin"></i>';

    if (labelTkt) labelTkt.textContent = 'Mis Máquinas';
    if (textTkt) textTkt.textContent = 'Maquinaria vinculada';
    if (elTkt) { elTkt.textContent = equiposCount; elTkt.style.color = '#8b5cf6'; }
    if (cardTkt) cardTkt.setAttribute('onclick', "abrirDesgloseDashboard('maquinas', '')");
    if (iconDivTkt) iconDivTkt.innerHTML = '<i data-lucide="settings"></i>';
  } else {
    if (labelOrd) labelOrd.textContent = 'Resolución Órdenes';
    if (textOrd) textOrd.textContent = 'Tiempo promedio (Histórico)';
    if (elOrd) { elOrd.textContent = avgDiasOrdenes + ' d'; elOrd.style.color = '#4f8ef7'; }
    if (cardOrd) cardOrd.setAttribute('onclick', "abrirDesgloseDashboard('rendimiento', 'ordenes')");
    if (iconDivOrd) iconDivOrd.innerHTML = '<i data-lucide="timer"></i>';

    if (labelTkt) labelTkt.textContent = 'Resolución Tickets';
    if (textTkt) textTkt.textContent = 'Tiempo promedio (Cerrados)';
    if (elTkt) { elTkt.textContent = countTicketsCerrados > 0 ? (avgDiasTickets + ' d') : 'N/D'; elTkt.style.color = '#8b5cf6'; }
    if (cardTkt) cardTkt.setAttribute('onclick', "abrirDesgloseDashboard('rendimiento', 'tickets')");
    if (iconDivTkt) iconDivTkt.innerHTML = '<i data-lucide="hourglass"></i>';
  }
  lucide.createIcons();

  // --- Mini tabla Órdenes (últimas 6) ---
  const miniOrd = document.getElementById('v2-mini-ordenes');
  if (miniOrd) {
    const recientes = [...ordenesDash].sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0)).slice(0,6);
    miniOrd.innerHTML = recientes.map(o => {
      const est = (o.estado||'').toLowerCase();
      const col = est==='pendiente'?'#ef4444':est==='en proceso'?'#E8820C':'#10b981';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.5rem;font-weight:600;color:var(--text-primary);">${o.folio||'-'}</td>
        <td style="padding:0.5rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.cliente||'-'}</td>
        <td style="padding:0.5rem;"><span style="font-size:0.72rem;font-weight:600;color:${col};background:${col}22;padding:0.2rem 0.5rem;border-radius:999px;">${o.estado||'-'}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="3" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin órdenes</td></tr>';
  }

  // --- Mini tabla Tickets (últimos 6) ---
  const miniTkt = document.getElementById('v2-mini-tickets');
  if (miniTkt) {
    const recientes = [...ticketsDash].sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0)).slice(0,6);
    miniTkt.innerHTML = recientes.map(t => {
      const est = (t.estado||'').toLowerCase();
      const col = est==='abierto'?'#ef4444':est==='cerrado'?'#10b981':'#E8820C';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.5rem;font-weight:600;color:var(--text-primary);white-space:nowrap;">${t.folio||'#'}</td>
        <td style="padding:0.5rem;color:var(--text-muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.asunto||'-'}</td>
        <td style="padding:0.5rem;"><span style="font-size:0.72rem;font-weight:600;color:${col};background:${col}22;padding:0.2rem 0.5rem;border-radius:999px;">${t.estado||'-'}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="3" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin tickets</td></tr>';
  }

  // --- Gráficas (Requiere Chart.js) ---
  if (typeof Chart === 'undefined') {
    return;
  }

  try {
    const isDark = !document.body.classList.contains('light-mode');
    const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    if (Chart.defaults) {
      Chart.defaults.color = textColor;
      if (Chart.defaults.font) {
        Chart.defaults.font.family = 'Inter, sans-serif';
        Chart.defaults.font.size = 11;
      }
      Chart.defaults.maintainAspectRatio = false;
    }

    const destroyChart = (id) => { if (_v2Charts[id]) { _v2Charts[id].destroy(); delete _v2Charts[id]; } };

    // Donut: Estado de Órdenes
    destroyChart('ord-estado');
    const ordPend = ordenesDash.filter(o => (o.estado||'').toLowerCase() === 'pendiente').length;
    const ordProc = ordenesDash.filter(o => (o.estado||'').toLowerCase() === 'en proceso').length;
    const ordComp = ordenesDash.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;
    const ordOtro = ordenesDash.length - ordPend - ordProc - ordComp;
    const ctxOE = document.getElementById('chart-ordenes-estado');
    if (ctxOE) _v2Charts['ord-estado'] = new Chart(ctxOE, {
      type: 'doughnut',
      data: { labels: ['Pendiente','En Proceso','Completado','Otro'], datasets: [{ data: [ordPend, ordProc, ordComp, ordOtro], backgroundColor: ['#ef4444','#E8820C','#10b981','#6b7280'], borderWidth: 0 }] },
      options: {
        cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } } },
        onClick: (e, els) => { if(els.length) { const l = e.chart.data.labels[els[0].index]; if(l!=='Otro') abrirDesgloseDashboard('ordenes', l); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Órdenes por Tipo
    destroyChart('ord-tipo');
    const tipoCount = {};
    ordenesDash.forEach(o => { const t = o.tipo || 'Otro'; tipoCount[t] = (tipoCount[t]||0) + 1; });
    const ctxOT = document.getElementById('chart-ordenes-tipo');
    if (ctxOT) _v2Charts['ord-tipo'] = new Chart(ctxOT, {
      type: 'bar',
      data: { labels: Object.keys(tipoCount), datasets: [{ data: Object.values(tipoCount), backgroundColor: '#4f8ef7', borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: {} }, y: { grid: { display: false } } },
        onClick: (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_tipo', e.chart.data.labels[els[0].index]); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Top 5 Clientes/Equipos por Órdenes
    destroyChart('ord-cliente');
    
    let labels3 = [];
    let data3 = [];
    let onClick3 = null;

    if (isEmpresa && nombreEmpresaLogged) {
      const maqCount = {};
      ordenesDash.forEach(o => {
        if (o.modelo) maqCount[o.modelo] = (maqCount[o.modelo]||0) + 1;
      });
      const topMaq = Object.entries(maqCount).sort((a,b) => b[1] - a[1]).slice(0,5);
      labels3 = topMaq.map(m => m[0].length > 18 ? m[0].slice(0,16)+'…' : m[0]);
      data3 = topMaq.map(m => m[1]);
      onClick3 = (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_equipo', topMaq[els[0].index][0]); } };
    } else {
      const cliCount = {};
      ordenesDash.forEach(o => { if (o.cliente) cliCount[o.cliente] = (cliCount[o.cliente]||0) + 1; });
      const topCli = Object.entries(cliCount).sort((a,b) => b[1]-a[1]).slice(0,5);
      labels3 = topCli.map(c => c[0].length > 18 ? c[0].slice(0,16)+'…' : c[0]);
      data3 = topCli.map(c => c[1]);
      onClick3 = (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_cliente', topCli[els[0].index][0]); } };
    }

    const ctxOC = document.getElementById('chart-ordenes-cliente');
    if (ctxOC) _v2Charts['ord-cliente'] = new Chart(ctxOC, {
      type: 'bar',
      data: { labels: labels3, datasets: [{ data: data3, backgroundColor: ['#8b5cf6','#4f8ef7','#10b981','#E8820C','#ef4444'], borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } },
        onClick: onClick3,
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Tickets por Área
    destroyChart('tkt-area');
    const areaCount = {};
    ticketsDash.forEach(t => { const a = t.area || 'Sin área'; areaCount[a] = (areaCount[a]||0) + 1; });
    const ctxTA = document.getElementById('chart-tickets-area');
    if (ctxTA) _v2Charts['tkt-area'] = new Chart(ctxTA, {
      type: 'bar',
      data: { labels: Object.keys(areaCount), datasets: [{ data: Object.values(areaCount), backgroundColor: '#8b5cf6', borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } },
        onClick: (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_tkt_area', e.chart.data.labels[els[0].index]); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Donut: Estado de Tickets
    destroyChart('tkt-estado');
    const tktAb = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'abierto').length;
    const tktRef = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'refacciones').length;
    const tktCot = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'cotización' || (t.estado||'').toLowerCase() === 'cotizacion').length;
    const tktCerAp = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'cerrado' && t.cotAceptada === 'si').length;
    const tktCerRech = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'cerrado' && t.cotAceptada === 'no').length;
    const ctxTE = document.getElementById('chart-tickets-estado');
    if (ctxTE) _v2Charts['tkt-estado'] = new Chart(ctxTE, {
      type: 'doughnut',
      data: {
        labels: ['Abierto','Refacciones','Cotización','Cerrado (Aceptado)','Cerrado (Rechazado)'],
        datasets: [{
          data: [tktAb, tktRef, tktCot, tktCerAp, tktCerRech],
          backgroundColor: ['#ef4444','#f59e0b','#E8820C','#10b981','#94a3b8'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } } },
        onClick: (e, els) => {
          if(els.length) {
            const label = e.chart.data.labels[els[0].index];
            let filterVal = label;
            if (label === 'Cerrado (Aceptado)') filterVal = 'Cerrado - Aprobado';
            else if (label === 'Cerrado (Rechazado)') filterVal = 'Cerrado - Rechazado';
            abrirDesgloseDashboard('tickets', filterVal);
          }
        },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });
  } catch(e) {
    console.error("Error al renderizar gráficas V2:", e);
  }

  // --- Calcular Disponibilidad Global de la Flota (Dashboard Admin) ---
  try {
    const badgeEl = document.getElementById('v2-overall-availability-badge');
    const ringContainerEl = document.getElementById('v2-overall-availability-ring-container');
    const textEl = document.getElementById('v2-overall-availability-text');
    const descEl = document.getElementById('v2-overall-availability-desc');
    const opCountEl = document.getElementById('v2-overall-operating-count');
    const maintCountEl = document.getElementById('v2-overall-maintenance-count');
    const maintSectionEl = document.getElementById('v2-overall-maintenance-list-section');
    const maintBodyEl = document.getElementById('v2-overall-maintenance-list-body');

    if (badgeEl || textEl || opCountEl) {
      const activeMachines = maquinariaDash || [];
      let totalMachines = [...activeMachines];

      if (!isEmpresa || !nombreEmpresaLogged) {
        // Agregar manuales de clientesDb a totalMachines
        clientesDb.forEach(c => {
          if (c.maquinas) {
            c.maquinas.forEach(m => {
              const isDuplicate = totalMachines.some(sm => sm.idInterno === m.idInterno || sm.serie === m.serie);
              if (!isDuplicate) {
                totalMachines.push({
                  id: m.idInterno,
                  idInterno: m.idInterno,
                  serie: m.serie || 'N/A',
                  marca: m.marca || '',
                  modelo: m.modelo || 'Sin Modelo',
                  cliente: c.nombre,
                  ubicacion: m.ubicacion || 'N/A'
                });
              }
            });
          }
        });
      }

      // Filtrar por rol supervisor si aplica
      if (currentSession.viewMode === 'supervisor') {
        const supFilter = currentUser ? currentUser.nombre : '';
        const supUser = usuarios.find(u => u.nombre === supFilter || u.id === supFilter);
        const supId = supUser ? supUser.id : supFilter;
        
        const supClients = clientesDb.filter(c => 
          (c.supervisoresAsignados && c.supervisoresAsignados.includes(supId)) || 
          (c.supervisorAsignado === supId) || 
          (c.supervisorAsignado === supFilter)
        ).map(c => c.nombre);

        totalMachines = totalMachines.filter(m => supClients.includes(m.cliente));
      }

      const activeOrders = ordenesDash.filter(o => {
        const est = (o.estado || '').toLowerCase().trim();
        return est && !['completado', 'cerrada', 'cerrado'].includes(est);
      });

      const machinesInMaint = [];
      const maintMachineIdsOrSeries = new Set();

      activeOrders.forEach(o => {
        const match = totalMachines.find(m => {
          if (m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id || m.id === o.maquina || m.idInterno === o.maquina) return true;
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
          const idKey = match.id || match.idInterno || match.serie;
          if (!maintMachineIdsOrSeries.has(idKey)) {
            maintMachineIdsOrSeries.add(idKey);
            machinesInMaint.push({
              maquina: match,
              orden: o
            });
          }
        }
      });

      const totalCount = totalMachines.length;
      const maintCount = machinesInMaint.length;
      const opCount = Math.max(0, totalCount - maintCount);
      const availabilityPercent = totalCount > 0 ? Math.round((opCount / totalCount) * 100) : 100;

      if (badgeEl) {
        badgeEl.textContent = `${availabilityPercent}% Disponibilidad`;
        if (availabilityPercent === 100) {
          badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
          badgeEl.style.color = '#10b981';
        } else if (availabilityPercent >= 80) {
          badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
          badgeEl.style.color = '#f59e0b';
        } else {
          badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
          badgeEl.style.color = '#ef4444';
        }
      }

      if (textEl) textEl.textContent = `${opCount} / ${totalCount} Equipos`;

      if (descEl) {
        if (totalCount === 0) {
          descEl.textContent = 'No hay equipos registrados.';
        } else if (availabilityPercent === 100) {
          descEl.textContent = 'Toda la flota está operativa y disponible.';
        } else if (availabilityPercent >= 80) {
          descEl.textContent = 'La mayor parte de la flota está operativa.';
        } else {
          descEl.textContent = 'Se requiere atención en varios equipos.';
        }
      }

      if (opCountEl) opCountEl.textContent = opCount;
      if (maintCountEl) maintCountEl.textContent = maintCount;

      if (ringContainerEl) {
        ringContainerEl.innerHTML = `
          <div style="width: 64px; height: 64px; border-radius: 50%; background: conic-gradient(var(--green, #10b981) 0% ${availabilityPercent}%, var(--bg-hover, #1f2937) ${availabilityPercent}% 100%); display: flex; align-items: center; justify-content: center; position: relative;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--bg-secondary, #111827); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: var(--text-primary);">
              <span>${availabilityPercent}%</span>
              <span style="font-size:0.55rem; color:var(--text-muted); font-weight:normal;">DISP</span>
            </div>
          </div>
        `;
      }

      if (maintSectionEl && maintBodyEl) {
        if (maintCount > 0) {
          maintSectionEl.style.display = 'block';
          maintBodyEl.innerHTML = machinesInMaint.map(item => {
            const m = item.maquina;
            const o = item.orden;
            const est = (o.estado || '').toLowerCase();
            const col = est === 'pendiente' ? '#ef4444' : est === 'en proceso' ? '#E8820C' : '#10b981';
            return `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.6rem; font-weight:600; color:var(--text-primary);">${m.marca || ''} ${m.modelo || 'Sin Modelo'} <span style="font-weight:normal; font-size:0.7rem; color:var(--text-muted); font-family:monospace;">(ID: ${m.idInterno || m.serie})</span></td>
                <td style="padding:0.6rem; color:var(--text-muted);">${m.cliente || 'N/A'}</td>
                <td style="padding:0.6rem; color:var(--text-muted);"><span style="font-weight:600; color:var(--text-primary);">${o.folio || ''}</span> - ${o.asunto || o.tipo || ''}</td>
                <td style="padding:0.6rem; text-align:right;"><span style="font-size:0.7rem; font-weight:600; color:${col}; background:${col}22; padding:0.25rem 0.5rem; border-radius:999px;">${o.estado || ''}</span></td>
              </tr>
            `;
          }).join('');
        } else {
          maintSectionEl.style.display = 'none';
          maintBodyEl.innerHTML = '';
        }
      }
    }
  } catch (err) {
    console.error("Error al calcular disponibilidad de flota:", err);
  }

  if (window.lucide) lucide.createIcons();
}

// ===== DASHBOARD TABS =====
function setDashView(tab) {
  if (typeof document === "undefined") return;
  const btnV2 = document.getElementById('btn-dash-v2');
  const btnTecnicos = document.getElementById('btn-dash-tecnicos');
  const btnJunta = document.getElementById('btn-dash-junta');
  const contentV2 = document.getElementById('dash-content-v2');
  const contentTecnicos = document.getElementById('dash-content-tecnicos');
  const contentJunta = document.getElementById('dash-content-junta');

  // Reset styles
  [btnV2, btnTecnicos, btnJunta].forEach(btn => {
    if(!btn) return;
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text-muted)';
    btn.style.fontWeight = '500';
    btn.style.boxShadow = 'none';
  });

  // Hide all contents
  [contentV2, contentTecnicos, contentJunta].forEach(c => {
    if(c) c.style.display = 'none';
  });

  // Ocultar selector de Periodo cuando estamos en la pestaña de Junta
  const dateFilterContainer = document.getElementById('dash-date-filter-container');
  if (dateFilterContainer) {
    if (tab === 'junta') {
      dateFilterContainer.style.display = 'none';
    } else {
      dateFilterContainer.style.display = 'flex';
    }
  }

  // Activate selected
  let activeBtn;
  if (tab === 'v2') {
    activeBtn = btnV2;
    if(contentV2) contentV2.style.display = 'block';
    renderDashboardV2();
  } else if (tab === 'tecnicos') {
    activeBtn = btnTecnicos;
    if(contentTecnicos) contentTecnicos.style.display = 'block';
    renderDashboardTecnicos();
  } else if (tab === 'junta') {
    activeBtn = btnJunta;
    if(contentJunta) {
      contentJunta.style.display = 'flex';
      window.poblarFiltrosJuntaSelectores();
      window.renderJuntaRevision();
    }
  }

  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--bg-card)';
    activeBtn.style.color = 'var(--text-primary)';
    activeBtn.style.fontWeight = '600';
    activeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  }

  if (window.lucide) lucide.createIcons();
}

function renderDashboardTecnicos() {
  if (typeof document === "undefined") return;
  const timeframe = document.getElementById('dash-date-filter') ? document.getElementById('dash-date-filter').value : 'all';
  const ordersFiltered = getFilteredByTimeframe(getFilteredOrders(), timeframe);
  
  const stats = {};
  
  // Inicializar con todos los técnicos activos
  usuarios.filter(u => u.rol === 'tecnico' || u.rol === 'admin' || u.rol === 'superadmin').forEach(u => {
    stats[u.nombre] = { nombre: u.nombre, proceso: 0, finalizadas: 0, minReportados: 0, activoHoy: false };
  });

  // Calcular activoHoy (siempre respecto a la fecha actual)
  const todayStr = new Date().toISOString().substring(0, 10);
  getFilteredOrders().forEach(o => {
    if (o.bitacora && o.bitacora.length > 0) {
      o.bitacora.forEach(b => {
        if (b.tecnico && b.fecha === todayStr) {
          if (stats[b.tecnico]) stats[b.tecnico].activoHoy = true;
        }
      });
    }
  });

  // Calcular métricas desde órdenes y bitácoras
  ordersFiltered.forEach(o => {
    let techNames = [];
    if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) techNames = o.tecnicosAsignados.map(resolveTecnicoNombre);
    else if (o.tecnico) techNames = o.tecnico.split(',').map(s => s.trim());

    techNames.forEach(tName => {
      if (!stats[tName]) stats[tName] = { nombre: tName, proceso: 0, finalizadas: 0, minReportados: 0, activoHoy: false };
      if (o.estado === 'Finalizado') stats[tName].finalizadas++;
      else stats[tName].proceso++;
    });

    if (o.bitacora && o.bitacora.length > 0) {
      const bitacoraFiltered = getFilteredByTimeframe(o.bitacora, timeframe);
      bitacoraFiltered.forEach(b => {
        const tName = b.tecnico;
        if (tName && b.entrada && b.salida) {
          if (!stats[tName]) stats[tName] = { nombre: tName, proceso: 0, finalizadas: 0, minReportados: 0, activoHoy: false };
          const [hE, mE] = b.entrada.split(':').map(Number);
          const [hS, mS] = b.salida.split(':').map(Number);
          let diff = (hS * 60 + mS) - (hE * 60 + mE);
          if (diff < 0) diff += 24 * 60;
          stats[tName].minReportados += diff;
        }
      });
    }
  });

  const list = Object.values(stats)
    .filter(s => s.proceso > 0 || s.finalizadas > 0 || s.minReportados > 0)
    .sort((a,b) => b.minReportados - a.minReportados || b.finalizadas - a.finalizadas);

  const totalHoras = list.reduce((sum, s) => sum + s.minReportados, 0);
  const topTech = list.length > 0 ? list[0].nombre : 'N/A';
  const activeTechsCount = list.filter(s => s.minReportados > 0).length;
  const ordersWithHours = ordersFiltered.filter(o => o.bitacora && getFilteredByTimeframe(o.bitacora, timeframe).length > 0).length;
  const avgHoursPerOrder = ordersWithHours > 0 ? (totalHoras / 60 / ordersWithHours).toFixed(1) + 'h' : '0.0h';

  const kpisHtml = `
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:#10b981;"><i data-lucide="award"></i></div>
      <div>
        <div class="stat-label">Técnico Destacado</div>
        <div class="stat-value" style="font-size:1.15rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${topTech}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(79,142,247,0.12);color:#4f8ef7;"><i data-lucide="clock"></i></div>
      <div>
        <div class="stat-label">Total Horas Reportadas</div>
        <div class="stat-value" style="font-size:1.5rem;">${Math.floor(totalHoras / 60)}h ${totalHoras % 60}m</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b;"><i data-lucide="users"></i></div>
      <div>
        <div class="stat-label">Técnicos Activos</div>
        <div class="stat-value" style="font-size:1.5rem;">${activeTechsCount} / ${Object.keys(stats).length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(139,92,246,0.12);color:#8b5cf6;"><i data-lucide="trending-up"></i></div>
      <div>
        <div class="stat-label">Promedio por Orden</div>
        <div class="stat-value" style="font-size:1.5rem;">${avgHoursPerOrder}</div>
      </div>
    </div>
  `;
  document.getElementById('tecnicos-kpis-grid').innerHTML = kpisHtml;

  const maxMin = list.length > 0 ? Math.max(...list.map(s => s.minReportados)) : 1;

  const tbody = document.getElementById('tecnicos-stats-body');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay datos registrados aún</td></tr>';
  } else {
    tbody.innerHTML = list.map(s => {
      const hrs = Math.floor(s.minReportados / 60);
      const mns = s.minReportados % 60;
      const percentage = maxMin > 0 ? (s.minReportados / maxMin) * 100 : 0;
      const statusDot = s.activoHoy ? '<span style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#10b981; border:2px solid var(--bg-card); border-radius:50%;" title="Activo Hoy"></span>' : '<span style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#94a3b8; border:2px solid var(--bg-card); border-radius:50%;" title="Inactivo Hoy"></span>';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div style="position:relative; width:32px; height:32px;">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:bold;">
                  ${s.nombre.charAt(0).toUpperCase()}
                </div>
                ${statusDot}
              </div>
              <span style="font-weight:600;color:var(--text-primary);">${s.nombre}</span>
            </div>
          </td>
          <td style="text-align:center;"><span class="badge badge-pendiente" style="padding:0.3rem 0.6rem;">${s.proceso}</span></td>
          <td style="text-align:center;"><span class="badge badge-finalizado" style="padding:0.3rem 0.6rem;">${s.finalizadas}</span></td>
          <td>
            <div style="font-weight:700;color:var(--text-primary); font-size:1.05rem; text-align:right; margin-bottom: 0.15rem;">
              ${hrs}h ${mns > 0 ? mns + 'm' : ''}
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.7rem; color:var(--text-muted);">
              <div style="flex:1; height:6px; background:var(--bg-hover); border-radius:3px; overflow:hidden; border:1px solid var(--border);">
                <div style="width:${percentage}%; height:100%; background:linear-gradient(90deg, var(--accent) 0%, #10b981 100%); border-radius:3px;"></div>
              </div>
              <span style="font-weight:600; min-width:30px; text-align:right;">${Math.round(percentage)}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Renderizar gráfico comparativo de horas por técnico
  const canvas = document.getElementById('chart-tecnicos-horas');
  if (canvas && typeof Chart !== 'undefined') {
    if (_v2Charts['tecnicos-horas']) {
      _v2Charts['tecnicos-horas'].destroy();
      delete _v2Charts['tecnicos-horas'];
    }

    const topList = [...list].slice(0, 8);
    const labels = topList.map(s => s.nombre);
    const dataVals = topList.map(s => Number((s.minReportados / 60).toFixed(1)));

    const isDark = document.body.classList.contains('dark-theme') || (typeof currentSession !== 'undefined' && currentSession.theme === 'dark');
    const isMobile = window.innerWidth <= 768;
    const textColor = isDark ? '#f1f5f9' : '#0f172a';

    _v2Charts['tecnicos-horas'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Horas',
          data: dataVals,
          backgroundColor: 'rgba(232, 130, 12, 0.85)',
          borderRadius: 6,
          borderWidth: 0,
          maxBarThickness: 30
        }]
      },
      options: {
        indexAxis: isMobile ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed.x;
                return `${val} horas`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { weight: '500' } }
          },
          y: {
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
            ticks: { color: textColor }
          }
        }
      }
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function onDashFilterChange() {
  if (typeof document === "undefined") return;
  const activeTab = document.getElementById('btn-dash-v2').classList.contains('active') ? 'v2' : 'tecnicos';
  setDashView(activeTab);
};


  // Exponer en global/window para retrocompatibilidad total con el navegador y eventos HTML inline
  if (typeof global !== "undefined") {
    global.abrirDesgloseDashboard = abrirDesgloseDashboard;
    global.renderStats = renderStats;
    global._renderStatsInternal = _renderStatsInternal;
    global.getFilteredByTimeframe = getFilteredByTimeframe;
    global.renderDashboardV2 = renderDashboardV2;
    global.setDashView = setDashView;
    global.renderDashboardTecnicos = renderDashboardTecnicos;
    global.onDashFilterChange = onDashFilterChange;
    global._v2Charts = _v2Charts;
  }
})(typeof window !== "undefined" ? window : globalThis);
