/**
 * MÓDULO DE CENTRO DE NOTIFICACIONES Y CAMPANITAS DE TICKETS
 * Eurorep / SAPI - Vanilla Browser Bundle
 */
(function(global) {
  "use strict";

const getSession = () => (typeof currentSession !== 'undefined' && currentSession) ? currentSession : (typeof window !== 'undefined' && window.currentSession ? window.currentSession : null);
const getUsuarios = () => (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : (typeof window !== 'undefined' && Array.isArray(window.usuarios) ? window.usuarios : []);
const getTickets = () => (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : (typeof window !== 'undefined' && Array.isArray(window.tickets) ? window.tickets : _getStorageJSON('sapi_tickets', []));

const getFilteredTicketsList = () => {
  if (typeof getFilteredTickets === 'function') return getFilteredTickets();
  if (typeof window !== 'undefined' && typeof window.getFilteredTickets === 'function') return window.getFilteredTickets();
  return getTickets();
};

const isTestActive = () => {
  if (typeof isTestModeActive === 'function') return isTestModeActive();
  if (typeof window !== 'undefined' && typeof window.isTestModeActive === 'function') return window.isTestModeActive();
  return false;
};

const _uuid = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));

const _getStorageJSON = (k, def = []) => {
  if (typeof localStorage === 'undefined') return def;
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
};

const _setStorageJSON = (k, v) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

// ===== INTERNAL NOTIFICATION BELL =====
function toggleInternalNotificationDropdown(event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  if (typeof document === 'undefined') return;

  const otherDd = document.getElementById('notification-dropdown');
  if (otherDd) otherDd.style.display = 'none';

  const dd = document.getElementById('internal-notification-dropdown');
  if (dd) {
    const isHidden = dd.style.display === 'none' || dd.style.display === '';
    if (isHidden) {
      sincronizarNotificacionesInternas();
    }
    dd.style.display = isHidden ? 'block' : 'none';
  }
}

function sincronizarNotificacionesInternas() {
  const session = getSession();
  const isSuperadmin = (session && (session.viewMode === 'superadmin' || session.rol === 'superadmin' || session.realRol === 'superadmin' || session.userId === 'superadmin'));
  const isAdmin = (session && (session.viewMode === 'admin' || session.rol === 'admin' || session.realRol === 'admin'));
  const isSupervisor = (session && (session.viewMode === 'supervisor' || session.rol === 'supervisor'));
  const isAdminOrSuper = isSuperadmin || isAdmin;

  const users = getUsuarios();
  const currentUser = users.find(u => u && u.id === session?.userId);
  const currentUserName = currentUser ? currentUser.nombre : (session?.nombre || 'Usuario');
  const sesentaDiasMs = 60 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);
  let readKeys = new Set(_getStorageJSON('sapi_internal_notifications_read_keys', []));

  allNotifications.forEach(n => {
    if (n && n.leida && n.id) {
      readKeys.add(n.id);
    }
  });

  const tkts = getTickets();
  const mapNotifs = new Map();

  allNotifications.forEach(n => {
    if (n && n.id) {
      // Si ya fue leída y tiene más de 60 días, descartar para mantener ligero el almacenamiento
      if (n.leida && n.fecha) {
        const tNotif = new Date(n.fecha).getTime();
        if (!isNaN(tNotif) && (ahora - tNotif > sesentaDiasMs)) return;
      }
      mapNotifs.set(n.id, n);
    }
  });

  tkts.forEach(t => {
    if (t && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
      t.comentariosInternos.forEach(c => {
        if (!c || (!c.texto && !c.usuario)) return;
        const fechaComentario = c.fecha || t.fechaModificacion || t.fecha || new Date().toISOString();
        const notifId = `${t.id}_comment_${c.fecha}_${c.usuario}`;
        const lectores = Array.isArray(c.leidoPor) ? c.leidoPor : [];
        const isAuthor = (c.usuario === currentUserName);
        const isReadByMe = isAuthor || readKeys.has(notifId) || lectores.some(l => (typeof l === 'string' ? l === currentUserName : l && l.usuario === currentUserName));

        // Si ya está leída y tiene más de 60 días, omitir
        if (isReadByMe) {
          const timestamp = new Date(fechaComentario).getTime();
          if (!isNaN(timestamp) && (ahora - timestamp > sesentaDiasMs)) {
            return;
          }
        }

        mapNotifs.set(notifId, {
          id: notifId,
          tipo: 'comentario',
          ticketId: t.id,
          ticketFolio: t.folio || 'Ticket',
          ticketAsunto: t.asunto || 'Sin asunto',
          fecha: fechaComentario,
          usuario: c.usuario || 'Usuario',
          comentarioTexto: c.texto || '',
          comentarioFecha: c.fecha || '',
          leida: isReadByMe,
          leidoPor: lectores,
          esPrueba: !!t.esPrueba
        });
      });
    }
  });

  let updatedList = Array.from(mapNotifs.values());
  updatedList.sort((a, b) => {
    const da = new Date(a.fecha || 0).getTime();
    const db = new Date(b.fecha || 0).getTime();
    return db - da;
  });

  if (updatedList.length > 100) {
    updatedList = updatedList.slice(0, 100);
  }

  _setStorageJSON('sapi_internal_notifications', updatedList);
  _setStorageJSON('sapi_internal_notifications_read_keys', Array.from(readKeys));

  updateInternalNotificationBell();
}

function generarNotificacionInterna(ticket, asignadoAnterior, asignadoNuevo) {
  if (!ticket) return;
  const normOld = String(asignadoAnterior || '').trim().toLowerCase();
  const normNew = String(asignadoNuevo || '').trim().toLowerCase();
  if (normOld === normNew) return; // Sin cambios reales

  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);
  const session = getSession();
  const users = getUsuarios();
  const currentUser = users.find(u => u && u.id === session?.userId);
  const currentUserName = currentUser ? currentUser.nombre : (session?.nombre || 'Usuario');

  const newNotif = {
    id: _uuid(),
    ticketId: ticket.id,
    ticketFolio: ticket.folio || '',
    ticketAsunto: ticket.asunto || '',
    fecha: new Date().toISOString(),
    usuario: currentUserName,
    asignadoAnterior: asignadoAnterior || 'Sin asignar',
    asignadoNuevo: asignadoNuevo || 'Sin asignar',
    leida: false,
    leidoPor: [],
    esPrueba: !!ticket.esPrueba
  };

  allNotifications.unshift(newNotif);
  _setStorageJSON('sapi_internal_notifications', allNotifications);

  updateInternalNotificationBell();
}

function generarNotificacionComentarioInterno(ticket, comentario) {
  if (!ticket || !comentario) return;
  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);
  const session = getSession();
  const users = getUsuarios();
  const currentUser = users.find(u => u && u.id === session?.userId);
  const currentUserName = currentUser ? currentUser.nombre : (session?.nombre || 'Usuario');
  const isSuperadmin = (session && (session.viewMode === 'superadmin' || session.rol === 'superadmin' || session.realRol === 'superadmin' || session.userId === 'superadmin'));

  if (!isSuperadmin && comentario.usuario === currentUserName) return;

  const notifId = `${ticket.id}_comment_${comentario.fecha}_${comentario.usuario}`;
  const exists = allNotifications.some(n => 
    n.id === notifId ||
    (n.ticketId === ticket.id && 
     n.tipo === 'comentario' && 
     n.comentarioFecha === comentario.fecha &&
     n.usuario === comentario.usuario)
  );
  if (exists) return;

  const newNotif = {
    id: notifId,
    tipo: 'comentario',
    ticketId: ticket.id,
    ticketFolio: ticket.folio || '',
    ticketAsunto: ticket.asunto || '',
    fecha: comentario.fecha || new Date().toISOString(),
    usuario: comentario.usuario,
    comentarioTexto: comentario.texto,
    comentarioFecha: comentario.fecha,
    leida: false,
    leidoPor: comentario.leidoPor || [],
    esPrueba: !!ticket.esPrueba
  };

  allNotifications.unshift(newNotif);
  _setStorageJSON('sapi_internal_notifications', allNotifications);

  updateInternalNotificationBell();
}

function updateInternalNotificationBell() {
  if (typeof document === 'undefined') return;

  const session = getSession();
  const bell = document.getElementById('internal-notification-bell-container');
  if (bell) {
    if (session && session.viewMode === 'tecnico') {
      bell.style.display = 'none';
      return;
    } else {
      bell.style.display = 'flex';
    }
  }

  const badge = document.getElementById('internal-notification-badge');
  const dropCount = document.getElementById('internal-notification-dropdown-count');
  const container = document.getElementById('internal-notification-items-container');

  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);

  const isTest = isTestActive();
  const isSuperadmin = (session && (session.viewMode === 'superadmin' || session.rol === 'superadmin' || session.realRol === 'superadmin' || session.userId === 'superadmin'));
  const isAdmin = (session && (session.viewMode === 'admin' || session.rol === 'admin' || session.realRol === 'admin'));
  const isSupervisor = (session && (session.viewMode === 'supervisor' || session.rol === 'supervisor'));
  const isAdminOrSuper = isSuperadmin || isAdmin;

  const users = getUsuarios();
  const currentUser = users.find(u => u && u.id === session?.userId);
  const currentUserName = currentUser ? currentUser.nombre : (session?.nombre || 'Usuario');

  let filtered = allNotifications.filter(n => !!n.esPrueba === isTest);

  const sesentaDiasMs = 60 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  // Si es Superadmin, Admin o Supervisor, ve las notificaciones de TODOS
  if (isAdminOrSuper || isSupervisor) {
    filtered = filtered.filter(n => {
      if (!n.leida) return true; // Las no leídas siempre se muestran
      if (!n.fecha) return true;
      const t = new Date(n.fecha).getTime();
      return !isNaN(t) && (ahora - t <= sesentaDiasMs);
    });
  } else {
    // Si es otro usuario regular, ve las de sus tickets o creadas por otros
    const currentTickets = getTickets();
    const myTicketIds = new Set(currentTickets.filter(t => t && (t.asignado === currentUserName || t.supervisor === currentUserName)).map(t => t.id));
    filtered = filtered.filter(n => myTicketIds.has(n.ticketId) || n.usuario !== currentUserName);
  }

  const unreadCount = filtered.filter(n => !n.leida).length;

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (dropCount) {
    dropCount.textContent = unreadCount;
  }

  if (container) {
    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.75rem; padding:1.5rem; font-style:italic;">No hay notificaciones internas.</div>`;
    } else {
      let html = '';
      filtered.forEach(n => {
        const fechaFormat = n.fecha ? new Date(n.fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' }) : 'Reciente';
        const isUnread = !n.leida;

        // Calcular quién ya leyó esta notificación
        const lectores = Array.isArray(n.leidoPor) ? n.leidoPor.map(l => (typeof l === 'string' ? l : l && l.usuario)).filter(Boolean) : [];
        const otrosLectores = lectores.filter(l => l !== n.usuario);
        let readReceiptHtml = '';
        if (otrosLectores.length > 0) {
          readReceiptHtml = `
            <div style="font-size:0.65rem; color:#10b981; margin-top:0.25rem; display:flex; align-items:center; gap:0.3rem; font-weight:500;">
              <i data-lucide="check-check" style="width:12px; height:12px; color:#10b981; flex-shrink:0;"></i>
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Leído por: ${otrosLectores.join(', ')}">Leído por: <strong style="color:var(--text-primary);">${otrosLectores.join(', ')}</strong></span>
            </div>
          `;
        } else {
          readReceiptHtml = `
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.25rem; display:flex; align-items:center; gap:0.3rem; opacity:0.75;">
              <i data-lucide="check" style="width:11px; height:11px; flex-shrink:0;"></i>
              <span>Sin leer por otros</span>
            </div>
          `;
        }

        html += `
          <div style="padding:0.6rem 1rem; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:0.2rem; cursor:pointer; transition:background 0.2s; position:relative; ${isUnread ? 'background:rgba(139,92,246,0.05);' : ''}" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='${isUnread ? 'rgba(139,92,246,0.05)' : 'transparent'}'" onclick="window.verTicketYMarcarInternaLeida('${n.ticketId}', '${n.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; font-size:0.78rem; color:var(--text-primary);">${n.ticketFolio || 'Ticket'}</span>
              <span style="font-size:0.65rem; color:var(--text-muted);">${fechaFormat}</span>
            </div>
            <span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.ticketAsunto || 'Sin asunto'}</span>
            ${n.tipo === 'comentario' ? `
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.1rem; line-height:1.2; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                "${n.comentarioTexto || ''}"
              </div>
              <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.1rem;">
                Comentado por: <strong style="color:#8b5cf6;">${n.usuario}</strong>
              </div>
            ` : `
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.1rem; line-height:1.2;">
                Responsable: <span style="color:var(--text-primary); font-weight:500;">${n.asignadoAnterior || 'Sin asignar'}</span> → <span style="color:#8b5cf6; font-weight:700;">${n.asignadoNuevo || 'Sin asignar'}</span>
              </div>
              <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.1rem;">
                Modificado por: <strong>${n.usuario}</strong>
              </div>
            `}
            ${readReceiptHtml}
            ${isUnread ? `<span style="position:absolute; right:8px; bottom:8px; width:6px; height:6px; border-radius:50%; background:#8b5cf6; box-shadow:0 0 6px rgba(139,92,246,0.6);"></span>` : ''}
          </div>
        `;
      });
      container.innerHTML = html;
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }
  }
}

function verTicketYMarcarInternaLeida(ticketId, notificationId) {
  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);
  let readKeys = new Set(_getStorageJSON('sapi_internal_notifications_read_keys', []));

  if (notificationId) {
    readKeys.add(notificationId);
  }

  const session = getSession();
  const users = getUsuarios();
  const currentUser = users.find(u => u && u.id === session?.userId);
  const currentUserName = currentUser ? currentUser.nombre : (session?.nombre || 'Usuario');
  const nowIso = new Date().toISOString();

  allNotifications = allNotifications.map(n => {
    if (n.id === notificationId) {
      n.leida = true;
      if (!Array.isArray(n.leidoPor)) n.leidoPor = [];
      if (!n.leidoPor.some(l => (typeof l === 'string' ? l === currentUserName : l && l.usuario === currentUserName))) {
        n.leidoPor.push({ usuario: currentUserName, fecha: nowIso });
      }
    }
    return n;
  });
  _setStorageJSON('sapi_internal_notifications', allNotifications);
  _setStorageJSON('sapi_internal_notifications_read_keys', Array.from(readKeys));

  updateInternalNotificationBell();

  if (typeof document !== 'undefined') {
    const dd = document.getElementById('internal-notification-dropdown');
    if (dd) dd.style.display = 'none';

    const navItem = document.querySelector('.nav-item[data-view="tickets"]');
    if (navItem) navItem.click();
  }

  if (typeof verDetalleTicket === 'function') {
    verDetalleTicket(ticketId);
  } else if (typeof window !== 'undefined' && typeof window.verDetalleTicket === 'function') {
    window.verDetalleTicket(ticketId);
  } else if (typeof abrirTicket === 'function') {
    abrirTicket(ticketId);
  } else if (typeof window !== 'undefined' && typeof window.abrirTicket === 'function') {
    window.abrirTicket(ticketId);
  }
}

function marcarTodasInternasLeidas() {
  let allNotifications = _getStorageJSON('sapi_internal_notifications', []);
  let readKeys = new Set(_getStorageJSON('sapi_internal_notifications_read_keys', []));
  const isTest = isTestActive();

  allNotifications = allNotifications.map(n => {
    if (!!n.esPrueba === isTest) {
      n.leida = true;
      if (n.id) readKeys.add(n.id);
    }
    return n;
  });
  _setStorageJSON('sapi_internal_notifications', allNotifications);
  _setStorageJSON('sapi_internal_notifications_read_keys', Array.from(readKeys));

  updateInternalNotificationBell();
}

// ===== NOTIFICATION BELL (TICKETS SIN ASIGNAR, PEDIDOS PENDIENTES, COTIZACIONES RECHAZADAS) =====
function toggleNotificationDropdown(event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  if (typeof document === 'undefined') return;

  const intDd = document.getElementById('internal-notification-dropdown');
  if (intDd) intDd.style.display = 'none';

  const dd = document.getElementById('notification-dropdown');
  if (dd) {
    const isHidden = dd.style.display === 'none' || dd.style.display === '';
    dd.style.display = isHidden ? 'block' : 'none';
  }
}

function updateNotificationBell() {
  if (typeof window !== 'undefined' && typeof window.updateInternalNotificationBell === 'function') {
    try { window.updateInternalNotificationBell(); } catch(e) {}
  } else {
    try { updateInternalNotificationBell(); } catch(e) {}
  }

  if (typeof document === 'undefined') return;

  const session = getSession();
  const bell = document.getElementById('notification-bell-container');
  if (bell) {
    if (session && session.viewMode === 'tecnico') {
      bell.style.display = 'none';
      return;
    } else {
      bell.style.display = 'flex';
    }
  }

  const badge = document.getElementById('notification-badge');
  const dropCount = document.getElementById('notification-dropdown-count');
  const container = document.getElementById('notification-items-container');

  const tkts = getTickets();
  if (!tkts) return;

  // Filtrar según el modo Sandbox activo
  const filteredTickets = getFilteredTicketsList();

  // 1. Tickets sin asignar: Solo tickets nuevos en estado Abierto que requieren asignación inicial
  const unassigned = filteredTickets.filter(t => {
    if (!t) return false;
    const asignadoClean = String(t.asignado || '').trim().toLowerCase();
    const estadoClean = String(t.estado || '').trim().toLowerCase();
    const tFolio = String(t.folio || '').trim();
    const isSubticket = /-[Aa]$/i.test(tFolio) || tFolio.toUpperCase().includes('-A') || t.categoria === 'Refacción';
    return (asignadoClean === 'sin asignar' || asignadoClean === '' || asignadoClean === '-') && 
           (estadoClean === 'abierto') && 
           !isSubticket;
  });

  // 2. Pedidos pendientes (cotización aceptada por el cliente pero sin número de pedido SAP registrado)
  const pendingOrders = filteredTickets.filter(t => {
    const cotAceptadaVal = String(t.cotAceptada || t.cot_aceptada || '').trim().toLowerCase();
    const tienePedido = !!(t.pedidoSAP || t.pedido_sap);
    const estadoClean = String(t.estado || '').trim().toLowerCase();
    return (cotAceptadaVal === 'si' || cotAceptadaVal === 'aprobada') && !tienePedido && (estadoClean !== 'cerrado' && estadoClean !== 'finalizado');
  });

  // 3. Cotizaciones rechazadas (cotización rechazada por el cliente y aún sin cerrar por el supervisor)
  const rejectedQuotes = filteredTickets.filter(t => {
    const cotAceptadaVal = String(t.cotAceptada || t.cot_aceptada || '').trim().toLowerCase();
    const estadoClean = String(t.estado || '').trim().toLowerCase();
    return (cotAceptadaVal === 'no' || cotAceptadaVal === 'rechazada') && (estadoClean !== 'cerrado' && estadoClean !== 'finalizado');
  });

  const totalNotifications = unassigned.length + pendingOrders.length + rejectedQuotes.length;

  if (badge) {
    if (totalNotifications > 0) {
      badge.textContent = totalNotifications;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
  if (dropCount) {
    dropCount.textContent = totalNotifications;
  }

  if (container) {
    if (totalNotifications === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.75rem; padding:1.5rem; font-style:italic;">No hay notificaciones pendientes.</div>`;
    } else {
      let html = '';

      // Renderizar Tickets Sin Asignar
      if (unassigned.length > 0) {
        html += `<div style="padding:0.4rem 1rem; font-size:0.7rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(255,255,255,0.01); display:flex; align-items:center; gap:0.25rem;"><i data-lucide="user-minus" style="width:12px; height:12px;"></i> Sin Asignar (${unassigned.length})</div>`;
        unassigned.forEach(t => {
          const prioColor = t.prioridad === 'Alta' ? 'var(--red)' : (t.prioridad === 'Baja' ? 'var(--blue)' : 'var(--orange)');
          const fechaFormat = t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : 'Reciente';

          html += `
            <div style="padding:0.6rem 1rem; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:0.2rem; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="window.abrirTicketDesdeNotification('${t.id}')">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.78rem; color:var(--text-primary);">${t.folio || 'N/A'}</span>
                <span style="background:${prioColor}15; color:${prioColor}; border:1px solid ${prioColor}30; padding:0.1rem 0.35rem; border-radius:4px; font-size:0.6rem; font-weight:600;">${t.prioridad || 'Media'}</span>
              </div>
              <span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.asunto || 'Sin asunto'}</span>
              <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted);">
                <span>Cliente: ${t.cliente || 'Genérico'}</span>
                <span>${fechaFormat}</span>
              </div>
            </div>
          `;
        });
      }

      // Renderizar Pedidos Pendientes
      if (pendingOrders.length > 0) {
        html += `<div style="padding:0.4rem 1rem; font-size:0.7rem; font-weight:700; color:var(--green); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(255,255,255,0.01); display:flex; align-items:center; gap:0.25rem; margin-top:0.4rem;"><i data-lucide="shopping-cart" style="width:12px; height:12px;"></i> Pedidos Pendientes (${pendingOrders.length})</div>`;
        pendingOrders.forEach(t => {
          const fechaFormat = t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : 'Reciente';
          const cotNum = t.cotizacionSAP || t.cotizacion_sap || 'N/A';

          html += `
            <div style="padding:0.6rem 1rem; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:0.2rem; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="window.abrirTicketDesdeNotification('${t.id}')">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.78rem; color:var(--text-primary);">${t.folio || 'N/A'}</span>
                <span style="background:rgba(16,185,129,0.1); color:var(--green); border:1px solid rgba(16,185,129,0.2); padding:0.1rem 0.35rem; border-radius:4px; font-size:0.6rem; font-weight:600;">Cotización Aprobada</span>
              </div>
              <span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Cot. SAP: ${cotNum} – ${t.asunto || 'Sin asunto'}</span>
              <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted);">
                <span>Cliente: ${t.cliente || 'Genérico'}</span>
                <span>${fechaFormat}</span>
              </div>
            </div>
          `;
        });
      }

      // Renderizar Cotizaciones Rechazadas
      if (rejectedQuotes.length > 0) {
        html += `<div style="padding:0.4rem 1rem; font-size:0.7rem; font-weight:700; color:var(--red); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(255,255,255,0.01); display:flex; align-items:center; gap:0.25rem; margin-top:0.4rem;"><i data-lucide="x-circle" style="width:12px; height:12px;"></i> Cotizaciones Rechazadas (${rejectedQuotes.length})</div>`;
        rejectedQuotes.forEach(t => {
          const fechaFormat = t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : 'Reciente';
          const cotNum = t.cotizacionSAP || t.cotizacion_sap || 'N/A';

          html += `
            <div style="padding:0.6rem 1rem; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:0.2rem; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="window.abrirTicketDesdeNotification('${t.id}')">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.78rem; color:var(--text-primary);">${t.folio || 'N/A'}</span>
                <span style="background:rgba(239,68,68,0.1); color:var(--red); border:1px solid rgba(239,68,68,0.2); padding:0.1rem 0.35rem; border-radius:4px; font-size:0.6rem; font-weight:600;">Cotización Rechazada</span>
              </div>
              <span style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Cot. SAP: ${cotNum} – ${t.asunto || 'Sin asunto'}</span>
              <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted);">
                <span>Cliente: ${t.cliente || 'Genérico'}</span>
                <span>${fechaFormat}</span>
              </div>
            </div>
          `;
        });
      }

      container.innerHTML = html;
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }
  }
}

function abrirTicketDesdeNotification(ticketId) {
  if (typeof document !== 'undefined') {
    const dd = document.getElementById('notification-dropdown');
    if (dd) dd.style.display = 'none';

    const navItem = document.querySelector('.nav-item[data-view="tickets"]');
    if (navItem) navItem.click();
  }

  if (typeof verDetalleTicket === 'function') {
    verDetalleTicket(ticketId);
  } else if (typeof window !== 'undefined' && typeof window.verDetalleTicket === 'function') {
    window.verDetalleTicket(ticketId);
  } else if (typeof abrirTicket === 'function') {
    abrirTicket(ticketId);
  } else if (typeof window !== 'undefined' && typeof window.abrirTicket === 'function') {
    window.abrirTicket(ticketId);
  }
}

function abrirOrdenDesdePerfil(id) {
  if (typeof editarOrden === 'function') {
    editarOrden(id);
  } else if (typeof window !== 'undefined' && typeof window.editarOrden === 'function') {
    window.editarOrden(id);
  }
}

// Global click listener para cerrar dropdowns de campanitas al hacer clic fuera
if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e) {
    const ddInt = document.getElementById('internal-notification-dropdown');
    const bellInt = document.getElementById('internal-notification-bell-container');
    if (ddInt && bellInt && !bellInt.contains(e.target)) {
      ddInt.style.display = 'none';
    }

    const ddOp = document.getElementById('notification-dropdown');
    const bellOp = document.getElementById('notification-bell-container');
    if (ddOp && bellOp && !bellOp.contains(e.target)) {
      ddOp.style.display = 'none';
    }
  });
}

// Exponer en window para compatibilidad total con eventos HTML inline
if (typeof window !== 'undefined') {
  window.toggleInternalNotificationDropdown = toggleInternalNotificationDropdown;
  window.sincronizarNotificacionesInternas = sincronizarNotificacionesInternas;
  window.generarNotificacionInterna = generarNotificacionInterna;
  window.generarNotificacionComentarioInterno = generarNotificacionComentarioInterno;
  window.updateInternalNotificationBell = updateInternalNotificationBell;
  window.verTicketYMarcarInternaLeida = verTicketYMarcarInternaLeida;
  window.marcarTodasInternasLeidas = marcarTodasInternasLeidas;
  window.toggleNotificationDropdown = toggleNotificationDropdown;
  window.updateNotificationBell = updateNotificationBell;
  window.abrirTicketDesdeNotification = abrirTicketDesdeNotification;
  window.abrirOrdenDesdePerfil = abrirOrdenDesdePerfil;
}

  // Exponer en global/window para retrocompatibilidad total
  if (typeof global !== "undefined") {
    global.toggleInternalNotificationDropdown = toggleInternalNotificationDropdown;
    global.sincronizarNotificacionesInternas = sincronizarNotificacionesInternas;
    global.generarNotificacionInterna = generarNotificacionInterna;
    global.generarNotificacionComentarioInterno = generarNotificacionComentarioInterno;
    global.updateInternalNotificationBell = updateInternalNotificationBell;
    global.verTicketYMarcarInternaLeida = verTicketYMarcarInternaLeida;
    global.marcarTodasInternasLeidas = marcarTodasInternasLeidas;
    global.toggleNotificationDropdown = toggleNotificationDropdown;
    global.updateNotificationBell = updateNotificationBell;
    global.abrirTicketDesdeNotification = abrirTicketDesdeNotification;
    global.abrirOrdenDesdePerfil = abrirOrdenDesdePerfil;
  }
  if (typeof window !== "undefined" && window !== global) {
    window.toggleInternalNotificationDropdown = toggleInternalNotificationDropdown;
    window.sincronizarNotificacionesInternas = sincronizarNotificacionesInternas;
    window.generarNotificacionInterna = generarNotificacionInterna;
    window.generarNotificacionComentarioInterno = generarNotificacionComentarioInterno;
    window.updateInternalNotificationBell = updateInternalNotificationBell;
    window.verTicketYMarcarInternaLeida = verTicketYMarcarInternaLeida;
    window.marcarTodasInternasLeidas = marcarTodasInternasLeidas;
    window.toggleNotificationDropdown = toggleNotificationDropdown;
    window.updateNotificationBell = updateNotificationBell;
    window.abrirTicketDesdeNotification = abrirTicketDesdeNotification;
    window.abrirOrdenDesdePerfil = abrirOrdenDesdePerfil;
  }
})(typeof window !== "undefined" ? window : globalThis);
