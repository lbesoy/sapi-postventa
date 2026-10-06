/**
 * Eurorep SAPI - Módulo de Listados, Filtros, Menús de Ordenación y Tabla de Órdenes
 * Archivo: ordenes_listado.js (Bundle para Navegador)
 */
(function() {
  let filtroEstadoServicios = '';
  let filtroTicketsV2 = 'todos';
  let currentOrdSortCol = (typeof window !== 'undefined' && window.currentOrdSortCol) || 'reciente';
  let currentOrdSortDir = (typeof window !== 'undefined' && window.currentOrdSortDir) || 'desc';

  function safeNormStr(s) {
    if (typeof window !== 'undefined' && typeof window.normStr === 'function') return window.normStr(s);
    return String(s || '').toLowerCase().trim();
  }

  function safeFormatFechaAmigable(f) {
    if (typeof window !== 'undefined' && typeof window.formatFechaAmigable === 'function') return window.formatFechaAmigable(f);
    return f || '';
  }

  function safeIsTestModeActive() {
    return typeof window !== 'undefined' && typeof window.isTestModeActive === 'function' ? window.isTestModeActive() : false;
  }

  function safeResolveTecnicoNombre(tecId) {
    if (typeof window !== 'undefined' && typeof window.resolveTecnicoNombre === 'function') {
      return window.resolveTecnicoNombre(tecId);
    }
    return tecId;
  }

  function safeGetFilteredOrders() {
    if (typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function') {
      return window.getFilteredOrders();
    }
    if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) return ordenes;
    if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) return window.ordenes;
    return [];
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
    
    const currentUser = currentSession ? usuarios.find(u => u.id === currentSession.userId) : null;
    const isEmpresa = currentSession && ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
    
    if (isEmpresa) {
      let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
      if (nombreEmpresaLogged) {
        nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
        filtradas = filtradas.filter(o => {
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
      } else {
        filtradas = [];
      }
    }

    const userRole = currentSession ? (currentSession.viewMode || '') : '';
    if (userRole === 'tecnico') {
      if (safeIsTestModeActive()) {
        tecFilter = '';
      } else {
        tecFilter = currentUser ? currentUser.nombre : '';
      }
    }
    if (userRole === 'supervisor') {
      supFilter = document.getElementById('filter-ord-supervisor')?.value || '';
    }
    
    if (tecFilter || supFilter) {
      const tecNameLower = tecFilter ? safeNormStr(tecFilter) : '';
      const supNameLower = supFilter ? safeNormStr(supFilter) : '';
      
      filtradas = filtradas.filter(o => {
        let passTec = true;
        let passSup = true;
        
        if (tecFilter && tecNameLower) {
           let assigned = [];
           if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(safeResolveTecnicoNombre);
           else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => safeNormStr(s));
           let isCreator = false;
           let isTkAssigned = false;
           if (o.creadoPor && safeNormStr(o.creadoPor) === tecNameLower) isCreator = true;
           if (o.soporte) {
              const tk = tickets.find(x => x.id === o.soporte);
              if (tk) {
                 if ((tk.solicitante && safeNormStr(tk.solicitante) === tecNameLower) || 
                     (tk.creadoPor && safeNormStr(tk.creadoPor) === tecNameLower)) isCreator = true;
                 let tkAssigned = [];
                 if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(safeResolveTecnicoNombre);
                 else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
                 const tkAssignedLower = tkAssigned.map(s => safeNormStr(s));
                 if (tkAssignedLower.includes(tecNameLower)) isTkAssigned = true;
              }
           }
           passTec = assignedLower.includes(tecNameLower) || isCreator || isTkAssigned;
        }
        
        if (supFilter && supNameLower) {
           let passSupClient = false;
           const cli = clientesDb.find(c => c.nombre === o.cliente);
           if (cli) {
              const supUser = usuarios.find(u => u && ((u.nombre && safeNormStr(u.nombre) === supNameLower) || u.id === supFilter));
              const supId = supUser ? supUser.id : supFilter;
              passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (safeNormStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
           }
           
           let assigned = [];
           if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(safeResolveTecnicoNombre);
           else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => safeNormStr(s));
           
           let passSupTicket = assignedLower.includes(supNameLower);
           let isCreator = false;
           if (o.soporte) {
              const tk = tickets.find(x => x.id === o.soporte);
              if (tk) {
                 if ((tk.solicitante && safeNormStr(tk.solicitante) === supNameLower) || 
                     (tk.creadoPor && safeNormStr(tk.creadoPor) === supNameLower)) isCreator = true;
                 let tkAssigned = [];
                 if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(safeResolveTecnicoNombre);
                 else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
                 const tkAssignedLower = tkAssigned.map(s => safeNormStr(s));
                 if (tkAssignedLower.includes(supNameLower)) passSupTicket = true;
              }
           }
           passSup = passSupClient || passSupTicket || isCreator;
        }
        
        return passTec && passSup;
      });
    }

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

    body.innerHTML = filtradas.map(o => {
      let orderCanEdit = canEdit;
      if (((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf) && (!currentSession || !['superadmin', 'admin'].includes(currentSession.viewMode))) {
        orderCanEdit = false;
      }
      const ticketAsoc = (o.soporte || o.ticket_id || o.ticket_folio)
        ? tickets.find(x => x.id === o.soporte || x.folio === o.soporte || (o.ticket_id && x.id === o.ticket_id) || (o.ticket_folio && x.folio === o.ticket_folio))
        : null;
      const ticketHtml = ticketAsoc
        ? `<a href="#" onclick="verDetalleTicket('${ticketAsoc.id}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="${ticketAsoc.asunto || ''}">${ticketAsoc.folio}</a>`
        : (o.soporte ? `<span style="font-family:monospace; font-size:0.8rem; color:var(--text-muted);">${o.soporte}</span>` : '-');
      
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
    if (!ctx) {
      if (typeof renderStats === 'function') renderStats();
      else if (typeof window !== 'undefined' && typeof window.renderStats === 'function') window.renderStats();
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // Exponer a window
  const allModuleExports = {
    filtroEstadoServicios: filtroEstadoServicios,
    filtroTicketsV2: filtroTicketsV2,
    currentOrdSortCol: currentOrdSortCol,
    currentOrdSortDir: currentOrdSortDir,
    setFiltroEstadoServicios: setFiltroEstadoServicios,
    setFiltroTicketsV2: setFiltroTicketsV2,
    toggleSortOrdenes: toggleSortOrdenes,
    renderTabla: renderTabla,
    badgeEstado: badgeEstado,
    filtrarOrdenes: filtrarOrdenes
  };
  window.OrdenesListado = allModuleExports;
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
})();
