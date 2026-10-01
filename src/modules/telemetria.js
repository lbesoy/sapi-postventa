/**
 * Módulo de Telemetría SuperAdmin, Fusión de Clientes, Deduplicación de Órdenes y Diagnósticos del Sistema
 * Eurorep / SAPI - Fase 3.12
 */

// Helpers de acceso seguro a variables globales
function _getSb() {
  if (typeof window !== "undefined" && window.supabaseClient) return window.supabaseClient;
  return null;
}

function _getSession() {
  if (typeof currentSession !== "undefined" && currentSession) return currentSession;
  if (typeof window !== "undefined" && window.currentSession) return window.currentSession;
  return null;
}

function _getUsuarios() {
  if (typeof usuarios !== "undefined" && Array.isArray(usuarios)) return usuarios;
  if (typeof window !== "undefined" && Array.isArray(window.usuarios)) return window.usuarios;
  return [];
}

function _getOrdenes() {
  if (typeof ordenes !== "undefined" && Array.isArray(ordenes)) return ordenes;
  if (typeof window !== "undefined" && Array.isArray(window.ordenes)) return window.ordenes;
  return [];
}

function _setOrdenes(val) {
  if (typeof ordenes !== "undefined") ordenes = val;
  if (typeof window !== "undefined") window.ordenes = val;
}

function _getTickets() {
  if (typeof tickets !== "undefined" && Array.isArray(tickets)) return tickets;
  if (typeof window !== "undefined" && Array.isArray(window.tickets)) return window.tickets;
  return [];
}

function _getClientesDb() {
  if (typeof clientesDb !== "undefined" && Array.isArray(clientesDb)) return clientesDb;
  if (typeof window !== "undefined" && Array.isArray(window.clientesDb)) return window.clientesDb;
  return [];
}

function _setClientesDb(val) {
  if (typeof clientesDb !== "undefined") clientesDb = val;
  if (typeof window !== "undefined") window.clientesDb = val;
}

function _getMaquinariaDb() {
  if (typeof maquinariaDb !== "undefined" && Array.isArray(maquinariaDb)) return maquinariaDb;
  if (typeof window !== "undefined" && Array.isArray(window.maquinariaDb)) return window.maquinariaDb;
  return [];
}

function _getSitiosDb() {
  if (typeof sitiosDb !== "undefined" && Array.isArray(sitiosDb)) return sitiosDb;
  if (typeof window !== "undefined" && Array.isArray(window.sitiosDb)) return window.sitiosDb;
  return [];
}

function _getRolesLabels() {
  if (typeof ROLES_LABELS !== "undefined" && ROLES_LABELS) return ROLES_LABELS;
  if (typeof window !== "undefined" && window.ROLES_LABELS) return window.ROLES_LABELS;
  return {};
}

function _isTestModeActive() {
  if (typeof isTestModeActive === "function") return isTestModeActive();
  if (typeof window !== "undefined" && typeof window.isTestModeActive === "function") return window.isTestModeActive();
  return false;
}

function _isTestData(item) {
  if (typeof isTestData === "function") return isTestData(item);
  if (typeof window !== "undefined" && typeof window.isTestData === "function") return window.isTestData(item);
  return false;
}

function _notify(msg, type = "info") {
  if (typeof mostrarNotificacion === "function") mostrarNotificacion(msg, type);
  else if (typeof window !== "undefined" && typeof window.mostrarNotificacion === "function") window.mostrarNotificacion(msg, type);
  else console.log(`[${type}] ${msg}`);
}

function _safeSetJSON(key, val) {
  if (typeof safeSetJSON === "function") safeSetJSON(key, val);
  else if (typeof window !== "undefined" && typeof window.safeSetJSON === "function") window.safeSetJSON(key, val);
  else if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(val));
}

function _renderIcons(opts) {
  if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") lucide.createIcons(opts);
  else if (typeof window !== "undefined" && window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons(opts);
}

// =========================================================================
// ===== SUPERADMIN TELEMETRY & USER ACTIVITY SYSTEM (LOCAL ONLY) =====
// =========================================================================

// Global tracking event function
function trackTelemetryEvent(action, details = {}) {
  try {
    if (!currentSession || !currentSession.userId) return;

    // Si estamos impersonando/simulando a otro usuario, no registrar telemetría para mantener las métricas limpias
    if (currentSession.userId !== currentSession.realUserId) return;

    const events = JSON.parse(localStorage.getItem('sapi_telemetry_events') || '[]');
    let userName = currentSession.nombre || 'Desconocido';
    const userObj = (typeof usuarios !== 'undefined') ? usuarios.find(u => u.id === currentSession.userId) : null;
    if (userObj && userObj.nombre) userName = userObj.nombre;

    const newEvent = {
      id: crypto.randomUUID(),
      userId: currentSession.userId,
      userName: userName,
      userRole: currentSession.viewMode || 'N/A',
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    events.unshift(newEvent);
    // Limit to 100 events to prevent localStorage bloat
    if (events.length > 100) events.pop();

    localStorage.setItem('sapi_telemetry_events', JSON.stringify(events));

    // Sync to Supabase in background
    if (window.pushToSupabase) {
      window.pushToSupabase('sapi_telemetry', newEvent);
    }
  } catch (err) {
    console.warn('[Telemetry] Error saving event:', err);
  }
};

// Seeder to populate beautiful mock historical data if empty
function seedMockTelemetryData() {
  try {
    const existing = localStorage.getItem('sapi_telemetry_events');
    if (existing && JSON.parse(existing).length > 20) return; // Already seeded

    console.log('[Telemetry] Seeding beautiful telemetry historical records...');
    const events = [];
    const now = new Date();
    
    const mockUsers = [
      { id: 'usr_valeria', name: 'Valeria Hernández', role: 'supervisor', views: ['servicios', 'tickets', 'calendario', 'gastos', 'tecnicos'] },
      { id: 'usr_luciano', name: 'Luciano', role: 'admin', views: ['dashboard', 'gastos', 'clientes', 'maquinaria', 'refacciones', 'config'] },
      { id: 'usr_luciano_jr', name: 'Luciano Jr.', role: 'tecnico', views: ['servicios', 'tickets', 'calendario', 'gastos'] },
      { id: 'superadmin', name: 'Super Admin', role: 'superadmin', views: ['dashboard', 'config', 'telemetry', 'gastos'] }
    ];

    const actions = [
      { type: 'login', label: 'Inicio de Sesión', details: () => ({ metodo: 'Contraseña/Database' }) },
      { type: 'view', label: 'Visualización de Módulo', details: (u) => ({ modulo: u.views[Math.floor(Math.random() * u.views.length)] }) },
      { type: 'onedrive_connect', label: 'Conexión OneDrive', details: () => ({ rootFolder: 'xLiid' }) },
      { type: 'onedrive_import', label: 'Importación OneDrive', details: () => {
          const files = ['Factura_ERE140718_998.xml', 'Evidencia_Kodiak_Aranzia.pdf', '0138818C-E177.pdf', 'Recibo_Combustible.pdf'];
          return { archivo: files[Math.floor(Math.random() * files.length)], tipo: Math.random() > 0.5 ? 'xml' : 'pdf' };
        }
      },
      { type: 'vincular', label: 'Vinculación de Factura', details: () => ({ rfc: 'GVA120524XYZ', uuid: 'F1A2B3C4-D5E6-4A7B' }) },
      { type: 'gasto', label: 'Guardado de Gasto', details: () => {
          const cats = ['Combustible', 'Alimentación', 'Otros'];
          return { categoria: cats[Math.floor(Math.random() * cats.length)], monto: Math.floor(Math.random() * 1200) + 100 };
        }
      }
    ];

    // Seed events over the last 7 days
    for (let day = 7; day >= 0; day--) {
      const dayDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      
      // Let's generate 10-25 events per day
      const eventCount = Math.floor(Math.random() * 15) + 10;
      
      for (let e = 0; e < eventCount; e++) {
        const eventTime = new Date(dayDate.getTime());
        eventTime.setHours(Math.floor(Math.random() * 14) + 8); // business hours 8am - 10pm
        eventTime.setMinutes(Math.floor(Math.random() * 60));
        eventTime.setSeconds(Math.floor(Math.random() * 60));

        const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        let actionChoice;
        
        // Ensure every user starts their day with a login
        if (e < mockUsers.length) {
          actionChoice = actions[0]; // login
        } else {
          // Weighted random action selection
          const rng = Math.random();
          if (rng < 0.15) actionChoice = actions[0]; // login
          else if (rng < 0.65) actionChoice = actions[1]; // tab view
          else if (rng < 0.75) actionChoice = actions[2]; // onedrive connect
          else if (rng < 0.85) actionChoice = actions[3]; // onedrive import
          else if (rng < 0.90) actionChoice = actions[4]; // vincular factura
          else actionChoice = actions[5]; // save expense
        }

        events.push({
          id: crypto.randomUUID(),
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: actionChoice.label,
          details: actionChoice.details(user),
          timestamp: eventTime.toISOString(),
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          isTest: true
        });
      }
    }

    // Sort descending chronologically
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    localStorage.setItem('sapi_telemetry_events', JSON.stringify(events));
  } catch (err) {
    console.warn('[Telemetry] Error seeding data:', err);
  }
};

// Filter logs in feed
window._currentTelemetryLogFilter = 'all';
function filterTelemetryLogs(filter) {
  window._currentTelemetryLogFilter = filter;
  
  // Set tab buttons active
  document.querySelectorAll('.telemetry-log-filter').forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderBottomColor = 'transparent';
    btn.style.color = 'var(--text-muted)';
    btn.style.fontWeight = '500';
  });

  const activeBtn = document.getElementById(`btn-tlog-${filter}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.borderBottomColor = 'var(--accent)';
    activeBtn.style.color = 'var(--text-primary)';
    activeBtn.style.fontWeight = '600';
  }

  window.renderTelemetryEventsFeed();
};

// Clear all telemetry logs
async function clearTelemetryLogs() {
  if (confirm('¿Estás seguro de que deseas limpiar todo el historial de telemetría?')) {
    localStorage.setItem('sapi_telemetry_events', '[]');
    window.renderTelemetryDashboard();
    
    if (window.supabaseClient) {
      try {
        const { error } = await window.supabaseClient.from('sapi_telemetry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
          console.error('[Telemetry] Error al limpiar logs en Supabase:', error);
        } else {
          console.log('[Telemetry] Historial de telemetría limpiado de Supabase exitosamente.');
        }
      } catch (e) {
        console.error('[Telemetry] Excepción al limpiar logs en Supabase:', e);
      }
    }
  }
};

// Compute relative time string (e.g. "Hace 5 minutos")
function getRelativeTime(dateStr) {
  try {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now - eventDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Hace unos momentos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHrs < 24) {
      if (diffHrs === 1) return 'Hace 1 hora';
      return `Hace ${diffHrs} horas`;
    }
    if (diffDays === 1) return `Ayer a las ${eventDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    return eventDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

// Render telemetry chronological feed logs
function renderTelemetryEventsFeed() {
  const container = document.getElementById('telemetry-events-feed');
  if (!container) return;

  const allEvents = JSON.parse(localStorage.getItem('sapi_telemetry_events') || '[]');
  const events = allEvents.filter(e => e && e.action && !e.action.startsWith('Diag:') && !(e.action === 'Visualización de Módulo' && e.details?.modulo === 'telemetry'));
  const filter = window._currentTelemetryLogFilter;
  const activeMode = isTestModeActive();

  // Filter events by mode (Sandbox/Production)
  let filtered = events.filter(e => {
    const isMockEvent = (e.isTest === true || ['Valeria Hernández', 'Luciano', 'Luciano Jr.', 'Super Admin'].includes(e.userName) || (['usr_valeria', 'usr_luciano', 'usr_luciano_jr', 'superadmin'].includes(e.userId) && e.userName !== 'Pablo Besoy'));
    return isMockEvent === activeMode;
  });

  if (filter === 'logins') {
    filtered = filtered.filter(e => e.action === 'Inicio de Sesión');
  } else if (filter === 'views') {
    filtered = filtered.filter(e => e.action === 'Visualización de Módulo');
  } else if (filter === 'actions') {
    filtered = filtered.filter(e => [
      'Conexión OneDrive', 'Importación OneDrive', 'Vinculación de Factura', 'Guardado de Gasto', 'Visor PDF SAT',
      'Creación de Gasto', 'Edición de Gasto', 'Eliminación de Gasto',
      'Creación de Ticket', 'Edición de Ticket', 'Eliminación de Ticket'
    ].includes(e.action));
  } else if (filter === 'orders') {
    filtered = filtered.filter(e => [
      'Creación de Orden', 'Edición de Orden', 'Eliminación de Orden',
      'Creación de Asignación', 'Edición de Asignación', 'Eliminación de Asignación',
      'Firma de Técnico (Orden Completada)', 'Firma de Cliente (Orden Firmada)',
      'Vinculación Orden en Detalle'
    ].includes(e.action));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted); font-size:0.8rem; display:flex; flex-direction:column; align-items:center; gap:0.5rem; justify-content:center; border:1px dashed var(--border); border-radius:8px;">
        <i data-lucide="info" style="width:20px; height:20px; opacity:0.5;"></i>
        <span>No se encontraron eventos en esta categoría.</span>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(e => {
    let icon = 'activity';
    let iconColor = 'var(--text-muted)';
    let iconBg = 'rgba(255,255,255,0.05)';
    let desc = '';

    if (e.action === 'Inicio de Sesión') {
      icon = 'log-in';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Inició sesión mediante ${e.details?.metodo || 'módulo estándar'}.`;
    } else if (e.action === 'Visualización de Módulo') {
      icon = 'eye';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      const modLabel = ROLES_LABELS[e.details?.modulo] || e.details?.modulo || 'Módulo';
      desc = `Visualizó el módulo de <strong>${modLabel}</strong>.`;
    } else if (e.action === 'Conexión OneDrive') {
      icon = 'cloud';
      iconColor = '#0078d4';
      iconBg = 'rgba(0,120,212,0.12)';
      desc = `Estableció conexión con carpeta OneDrive ID: <span style="font-family:monospace; font-size:0.7rem;">${e.details?.rootFolder || '-'}</span>`;
    } else if (e.action === 'Importación OneDrive') {
      icon = 'download-cloud';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Importó el archivo <strong>${e.details?.archivo || 'documento'}</strong> (${e.details?.tipo?.toUpperCase() || 'N/A'}) desde OneDrive.`;
    } else if (e.action === 'Vinculación de Factura') {
      icon = 'link';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Auto-vinculó comprobante SAT (UUID: <span style="font-family:monospace;">${e.details?.uuid?.substring(0,8) || '-'}...</span>).`;
    } else if (e.action === 'Guardado de Gasto') {
      icon = 'receipt';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      desc = `Registró movimiento de <strong>${e.details?.categoria || 'Gastos'}</strong> por un total de <strong>${formatMoney(e.details?.monto)}</strong>.`;
    } else if (e.action === 'Visor PDF SAT') {
      icon = 'file-text';
      iconColor = 'var(--red)';
      iconBg = 'rgba(239,68,68,0.12)';
      desc = `Visualizó Ficha SAT detallada para el archivo PDF <strong>${e.details?.archivo || '-'}</strong>.`;
    } else if (e.action === 'Creación de Ticket') {
      icon = 'plus-circle';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Creó el Ticket folio <strong>${e.details?.folio || '-'}</strong>: "${e.details?.asunto || ''}"`;
    } else if (e.action === 'Edición de Ticket') {
      icon = 'edit';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Editó el Ticket folio <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Eliminación de Ticket') {
      icon = 'trash-2';
      iconColor = 'var(--red)';
      iconBg = 'rgba(239,68,68,0.12)';
      desc = `Eliminó el Ticket folio <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Creación de Orden') {
      icon = 'plus-circle';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Creó la Orden de Servicio folio <strong>${e.details?.folio || '-'}</strong> para el cliente <strong>${e.details?.cliente || ''}</strong>.`;
    } else if (e.action === 'Edición de Orden') {
      icon = 'edit';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Editó la Orden de Servicio folio <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Eliminación de Orden') {
      icon = 'trash-2';
      iconColor = 'var(--red)';
      iconBg = 'rgba(239,68,68,0.12)';
      desc = `Eliminó la Orden de Servicio folio <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Creación de Gasto') {
      icon = 'plus-circle';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      desc = `Registró un gasto de <strong>${e.details?.categoria || 'Gastos'}</strong> por <strong>${formatMoney(e.details?.monto)}</strong> ("${e.details?.descripcion || ''}").`;
    } else if (e.action === 'Edición de Gasto') {
      icon = 'edit';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      desc = `Actualizó el gasto de <strong>${e.details?.categoria || 'Gastos'}</strong> por un total de <strong>${formatMoney(e.details?.monto)}</strong>.`;
    } else if (e.action === 'Eliminación de Gasto') {
      icon = 'trash-2';
      iconColor = 'var(--red)';
      iconBg = 'rgba(239,68,68,0.12)';
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      desc = `Eliminó el gasto de <strong>${e.details?.descripcion || 'Gasto'}</strong> por <strong>${formatMoney(e.details?.monto)}</strong>.`;
    } else if (e.action === 'Firma de Cliente (Orden Firmada)') {
      icon = 'check-square';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Firmó de conformidad la Orden de Servicio folio <strong>${e.details?.folio || '-'}</strong> para el cliente <strong>${e.details?.cliente || ''}</strong>.`;
    } else if (e.action === 'Firma de Técnico (Orden Completada)') {
      icon = 'pen-tool';
      iconColor = 'var(--green)';
      iconBg = 'rgba(16,185,129,0.12)';
      desc = `Técnico firmó y completó la Orden de Servicio folio <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Creación de Asignación') {
      icon = 'calendar';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Asignó la orden <strong>${e.details?.folio || '-'}</strong> al técnico <strong>${e.details?.tecnico || ''}</strong> para la fecha <strong>${e.details?.fecha || ''}</strong>.`;
    } else if (e.action === 'Edición de Asignación') {
      icon = 'calendar';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Modificó la asignación de la orden <strong>${e.details?.folio || '-'}</strong>.`;
    } else if (e.action === 'Eliminación de Asignación') {
      icon = 'trash-2';
      iconColor = 'var(--red)';
      iconBg = 'rgba(239,68,68,0.12)';
      const descTecnico = e.details?.tecnico ? ` del técnico <strong>${e.details.tecnico}</strong> (Fecha: ${e.details?.fecha || ''})` : '';
      desc = `Eliminó la asignación de servicio folio <strong>${e.details?.folio || '-'}</strong>${descTecnico}.`;
    } else if (e.action === 'Vinculación Orden en Detalle') {
      icon = 'link';
      iconColor = 'var(--accent)';
      iconBg = 'rgba(168,85,247,0.12)';
      desc = `Vinculó el gasto ID <strong>${e.details?.gastoId || '-'}</strong> con la orden folio <strong>${e.details?.ordenFolio || ''}</strong>.`;
    } else {
      desc = `${e.action} - ${JSON.stringify(e.details || {})}`;
    }

    const roleColors = {
      superadmin: '#E8820C',
      admin: '#4f8ef7',
      supervisor: '#eab308',
      tecnico: '#10b981',
      empresa: '#8b5cf6',
      consulta: '#64748b'
    };
    const rColor = roleColors[e.userRole] || 'var(--text-muted)';
    const rLabel = e.userRole?.toUpperCase() || 'N/A';

    return `
      <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:8px; padding:0.65rem 0.8rem; display:flex; gap:0.75rem; align-items:start;">
        <div style="width:26px; height:26px; border-radius:6px; background:${iconBg}; color:${iconColor}; display:flex; justify-content:center; align-items:center; flex-shrink:0;">
          <i data-lucide="${icon}" style="width:14px; height:14px;"></i>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.15rem; flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.25rem;">
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <span style="font-weight:700; font-size:0.75rem; color:var(--text-primary);">${e.userName}</span>
              <span style="font-size:0.55rem; font-weight:700; color:${rColor}; background:rgba(255,255,255,0.03); border:1px solid ${rColor}30; padding:0 0.25rem; border-radius:3px; letter-spacing:0.02em;">${rLabel}</span>
            </div>
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:500;">${window.getRelativeTime(e.timestamp)}</span>
          </div>
          <div style="font-size:0.72rem; color:var(--text-secondary); line-height:1.3; word-break:break-word;">${desc}</div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
};

// Core telemetry calculations and rendering function
function renderTelemetryDashboard() {
  // Ensure we seed mock historical data if empty
  window.seedMockTelemetryData();

  const allEvents = JSON.parse(localStorage.getItem('sapi_telemetry_events') || '[]');
  const events = allEvents.filter(e => e && e.action && !e.action.startsWith('Diag:') && !(e.action === 'Visualización de Módulo' && e.details?.modulo === 'telemetry'));
  const daysLimit = parseInt(document.getElementById('telemetry-time-range')?.value || '7');
  const activeMode = isTestModeActive();

  // Filter events by date range limit and sandbox/real mode
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - daysLimit);
  
  const rangeEvents = events.filter(e => {
    const isMockEvent = (e.isTest === true || ['Valeria Hernández', 'Luciano', 'Luciano Jr.', 'Super Admin'].includes(e.userName) || (['usr_valeria', 'usr_luciano', 'usr_luciano_jr', 'superadmin'].includes(e.userId) && e.userName !== 'Pablo Besoy'));
    const matchesMode = (isMockEvent === activeMode);
    return matchesMode && (new Date(e.timestamp) >= limitDate);
  });

  // 1. Calculate KPI Metrics
  const loginEvents = rangeEvents.filter(e => e.action === 'Inicio de Sesión');
  const viewEvents = rangeEvents.filter(e => e.action === 'Visualización de Módulo');
  
  // Estimate Active Usage Time (in minutes) via session grouping
  // Group events by user and by day
  const userDayGroups = {};
  rangeEvents.forEach(e => {
    const dayStr = e.timestamp.split('T')[0];
    const key = `${e.userId}_${dayStr}`;
    if (!userDayGroups[key]) userDayGroups[key] = [];
    userDayGroups[key].push(new Date(e.timestamp).getTime());
  });

  let totalActiveMinutes = 0;
  for (const key in userDayGroups) {
    // Sort times ascending
    const times = userDayGroups[key].sort((a,b) => a - b);
    let sessionTime = 0;
    let sessionStart = times[0];
    let lastTime = times[0];

    for (let i = 1; i < times.length; i++) {
      const diffMins = (times[i] - lastTime) / 60000;
      if (diffMins < 15) {
        // Continue current session
        lastTime = times[i];
      } else {
        // End current session, start a new one
        sessionTime += Math.ceil((lastTime - sessionStart) / 60000) + 5; // +5 mins buffer
        sessionStart = times[i];
        lastTime = times[i];
      }
    }
    // Add final session time
    sessionTime += Math.ceil((lastTime - sessionStart) / 60000) + (times.length > 0 ? 5 : 0);
    totalActiveMinutes += sessionTime;
  }

  // Populate KPIs UI
  const formatTimeStr = (totalMins) => {
    if (totalMins < 60) return `${totalMins}m`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m`;
  };

  const elLogins = document.getElementById('telemetry-stat-logins');
  const elViews = document.getElementById('telemetry-stat-views');
  const elTime = document.getElementById('telemetry-stat-time');
  const elEvents = document.getElementById('telemetry-stat-events');

  if (elLogins) elLogins.textContent = loginEvents.length;
  if (elViews) elViews.textContent = viewEvents.length;
  if (elTime) elTime.textContent = formatTimeStr(totalActiveMinutes);
  if (elEvents) elEvents.textContent = rangeEvents.length;

  // 2. Calculate Top Active Users
  // Accumulate metrics per user
  const userMetrics = {};
  rangeEvents.forEach(e => {
    if (!userMetrics[e.userId]) {
      userMetrics[e.userId] = {
        name: e.userName,
        role: e.userRole,
        logins: 0,
        views: 0,
        events: []
      };
    }
    if (e.action === 'Inicio de Sesión') userMetrics[e.userId].logins++;
    if (e.action === 'Visualización de Módulo') userMetrics[e.userId].views++;
    userMetrics[e.userId].events.push(new Date(e.timestamp).getTime());
  });

  // Calculate estimated usage time per user
  for (const uid in userMetrics) {
    const userEvs = userMetrics[uid].events.sort((a,b) => a - b);
    let userMins = 0;
    if (userEvs.length > 0) {
      // Group user events into days
      const days = {};
      userEvs.forEach(t => {
        const dStr = new Date(t).toISOString().split('T')[0];
        if (!days[dStr]) days[dStr] = [];
        days[dStr].push(t);
      });

      for (const d in days) {
        const times = days[d];
        let sessionStart = times[0];
        let lastTime = times[0];
        let dayMins = 0;

        for (let i = 1; i < times.length; i++) {
          if ((times[i] - lastTime) / 60000 < 15) {
            lastTime = times[i];
          } else {
            dayMins += Math.ceil((lastTime - sessionStart) / 60000) + 5;
            sessionStart = times[i];
            lastTime = times[i];
          }
        }
        dayMins += Math.ceil((lastTime - sessionStart) / 60000) + 5;
        userMins += dayMins;
      }
    }
    userMetrics[uid].estimatedMins = userMins;
  }

  // Sort users by activity score (logins * 3 + views + mins/5) descending
  const sortedUsers = Object.values(userMetrics).sort((a,b) => {
    const scoreA = a.logins * 3 + a.views + a.estimatedMins / 5;
    const scoreB = b.logins * 3 + b.views + b.estimatedMins / 5;
    return scoreB - scoreA;
  });

  const usersTable = document.getElementById('telemetry-users-table');
  if (usersTable) {
    usersTable.innerHTML = sortedUsers.map(u => {
      // Get initials
      const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      // Dynamic avatar color based on name string hash
      let hash = 0;
      for (let i = 0; i < u.name.length; i++) {
        hash = u.name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash % 360);
      const avatarStyle = `width:26px; height:26px; border-radius:50%; background:hsl(${h}, 60%, 45%); color:white; font-size:0.68rem; font-weight:700; display:flex; justify-content:center; align-items:center; flex-shrink:0; text-shadow: 0 1px 2px rgba(0,0,0,0.25);`;

      const roleColors = {
        superadmin: '#E8820C',
        admin: '#4f8ef7',
        supervisor: '#eab308',
        tecnico: '#10b981',
        empresa: '#8b5cf6',
        consulta: '#64748b'
      };
      const rColor = roleColors[u.role] || 'var(--text-muted)';
      const rLabel = u.role?.toUpperCase() || 'N/A';

      return `
        <tr style="border-bottom:1px solid var(--border); transition:var(--transition);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
          <td style="padding:0.65rem 0.75rem; display:flex; align-items:center; gap:0.5rem; border:none;">
            <div style="${avatarStyle}">${initials}</div>
            <div style="display:flex; flex-direction:column; gap:0.1rem; min-width:0;">
              <span style="font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${u.name}</span>
              <span style="font-size:0.58rem; color:${rColor}; font-weight:600; letter-spacing:0.02em;">${rLabel}</span>
            </div>
          </td>
          <td style="padding:0.65rem 0.75rem; text-align:center; font-weight:600; color:var(--text-secondary); border:none;">${u.logins}</td>
          <td style="padding:0.65rem 0.75rem; text-align:center; font-weight:600; color:var(--text-secondary); border:none;">${u.views}</td>
          <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:700; color:var(--text-primary); border:none; font-family:monospace;">${formatTimeStr(u.estimatedMins)}</td>
        </tr>
      `;
    }).join('');
  }

  // 3. Calculate Most Viewed Modules
  const moduleCounts = {};
  viewEvents.forEach(e => {
    const mod = e.details?.modulo;
    if (mod) {
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
    }
  });

  // Sort modules
  const sortedModules = Object.entries(moduleCounts).sort((a,b) => b[1] - a[1]);
  const maxViews = sortedModules[0]?.[1] || 1;

  const modulesList = document.getElementById('telemetry-modules-list');
  if (modulesList) {
    if (sortedModules.length === 0) {
      modulesList.innerHTML = `
        <div style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding:1rem 0;">No hay datos de navegación registrados en este periodo.</div>
      `;
    } else {
      modulesList.innerHTML = sortedModules.slice(0, 5).map(([mod, count]) => {
        const label = ROLES_LABELS[mod] || mod;
        const pct = Math.round((count / maxViews) * 100);
        return `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-weight:600;">
              <span style="color:var(--text-secondary);">${label}</span>
              <span style="color:var(--text-primary); font-family:monospace;">${count} vistas</span>
            </div>
            <div style="width:100%; height:8px; background:var(--bg-body); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--accent) 0%, #ec4899 100%); border-radius:4px; transition: width 0.6s ease-in-out;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Event feed list
  window.renderTelemetryEventsFeed();
};


// ==========================================
// FUSIÓN DE CLIENTES DUPLICADOS (v1.3.100)
// ==========================================
let _fusionPrincipal = null;  // Cliente principal (conservar)
let _fusionDuplicado = null;  // Cliente duplicado (eliminar)

function obtenerTodosLosClientes() {
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente) {
      if (!legacyMap.has(o.cliente)) {
        legacyMap.set(o.cliente, { nombre: o.cliente, ubicacion: o.ubicacion, legacy: true });
      }
    }
  });

  const merged = [...clientesDb];
  
  usuarios.forEach(u => {
    if (u.rol === 'empresa' || u.rol === 'cliente' || u.rol === 'cliente-consultor') {
      const nomEmpresa = u.empresa || u.nombre;
      if (!merged.find(c => (c.nombre || '').toLowerCase() === (nomEmpresa || '').toLowerCase())) {
        merged.push({ nombre: nomEmpresa, id: u.id, ubicacion: 'Usuario registrado' });
      }
    }
  });

  legacyMap.forEach((legacyClient) => {
    if (!merged.find(c => (c.nombre || '').toLowerCase() === (legacyClient.nombre || '').toLowerCase())) {
      merged.push(legacyClient);
    }
  });

  return merged;
}

function abrirModalFusionarClientes() {
  const isAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
  if (!isAdmin) {
    mostrarNotificacion('No tienes permisos para realizar esta acción.', 'error');
    return;
  }

  _fusionPrincipal = null;
  _fusionDuplicado = null;

  document.getElementById('fusionar-principal-input').value = '';
  document.getElementById('fusionar-duplicado-input').value = '';

  document.getElementById('fusionar-principal-preview').style.display = 'none';
  document.getElementById('fusionar-duplicado-preview').style.display = 'none';
  document.getElementById('fusionar-resumen').style.display = 'none';

  const btnConfirmar = document.getElementById('btn-confirmar-fusion');
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.style.opacity = '0.4';
  }

  const overlay = document.getElementById('modal-fusionar-clientes-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      const inner = document.getElementById('modal-fusionar-clientes-inner');
      if (inner) {
        inner.style.transform = 'translateY(0)';
        inner.style.opacity = '1';
      }
    });
  }
  lucide.createIcons();
}

function cerrarModalFusionarClientes() {
  const overlay = document.getElementById('modal-fusionar-clientes-overlay');
  const inner = document.getElementById('modal-fusionar-clientes-inner');
  if (overlay && inner) {
    overlay.style.opacity = '0';
    inner.style.transform = 'translateY(20px)';
    inner.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 200);
  }
}

function esMismoCliente(c1, c2) {
  if (!c1 || !c2) return false;
  return c1.nombre === c2.nombre && (c1.id || '') === (c2.id || '') && !!c1.legacy === !!c2.legacy;
}

function mostrarCargando(show, text = 'Cargando...') {
  const btn = document.getElementById('btn-confirmar-fusion');
  if (!btn) return;
  if (show) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; margin-right:6px; vertical-align:middle; animation:spin 0.75s linear infinite;"></span> ${text}`;
    btn.style.opacity = '0.7';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || `<i data-lucide="git-merge" style="width:15px;height:15px;"></i> Fusionar Clientes`;
    btn.style.opacity = '1';
    if (window.lucide) window.lucide.createIcons();
  }
}

function filtrarFusionClientes(tipo) {
  const input = document.getElementById(`fusionar-${tipo}-input`);
  const lista = document.getElementById(`fusionar-${tipo}-lista`);
  if (!input || !lista) return;

  const val = input.value.toLowerCase().trim();
  const todos = obtenerTodosLosClientes();
  
  // Filtrar de todos los clientes de la app
  const matches = todos.filter(c => {
    // Excluir si es el otro cliente ya seleccionado
    if (tipo === 'principal' && _fusionDuplicado && esMismoCliente(c, _fusionDuplicado)) return false;
    if (tipo === 'duplicado' && _fusionPrincipal && esMismoCliente(c, _fusionPrincipal)) return false;
    
    return (
      (c.nombre || '').toLowerCase().includes(val) ||
      (c.rfc || '').toLowerCase().includes(val) ||
      (c.id || '').toLowerCase().includes(val)
    );
  });

  if (matches.length === 0) {
    lista.innerHTML = `<div style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.85rem; text-align:center;">No se encontraron resultados</div>`;
  } else {
    lista.innerHTML = matches.map(c => {
      const idText = c.id && c.id !== 'Usuario registrado' ? `<span style="font-family:monospace; font-size:0.7rem; background:var(--bg-body); padding:0.1rem 0.3rem; border-radius:3px; color:var(--text-muted); border:1px solid var(--border);">${c.id}</span>` : '<span style="font-size:0.7rem; color:var(--text-muted);">Sin ID SAP</span>';
      return `
        <div onclick="seleccionarClienteFusion('${tipo}', '${c.nombre.replace(/'/g, "\\'")}', '${(c.id || '').replace(/'/g, "\\'")}', ${c.legacy ? 'true' : 'false'})"
          style="padding:0.6rem 0.75rem; cursor:pointer; font-size:0.85rem; border-bottom:1px solid var(--border); transition:background 0.2s; display:flex; align-items:center; justify-content:space-between;"
          onmouseover="this.style.background='var(--bg-hover)'"
          onmouseout="this.style.background='transparent'">
          <span style="font-weight:500; color:var(--text-primary);">${c.nombre}</span>
          ${idText}
        </div>
      `;
    }).join('');
  }
  lista.style.display = 'block';
}

function mostrarListaFusion(tipo) {
  filtrarFusionClientes(tipo);
}

// Cerrar listas si se hace click afuera
if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e) {
    const pInput = document.getElementById('fusionar-principal-input');
    const pLista = document.getElementById('fusionar-principal-lista');
    if (pInput && pLista && !e.target.closest('#fusionar-principal-input') && !e.target.closest('#fusionar-principal-lista')) {
      pLista.style.display = 'none';
    }
    const dInput = document.getElementById('fusionar-duplicado-input');
    const dLista = document.getElementById('fusionar-duplicado-lista');
    if (dInput && dLista && !e.target.closest('#fusionar-duplicado-input') && !e.target.closest('#fusionar-duplicado-lista')) {
      dLista.style.display = 'none';
    }
  });
}

function seleccionarClienteFusion(tipo, nombre, id, isLegacy) {
  const client = obtenerTodosLosClientes().find(c => 
    c.nombre === nombre && 
    (c.id || '') === (id || '') && 
    !!c.legacy === !!isLegacy
  );
  if (!client) return;

  if (tipo === 'principal') {
    _fusionPrincipal = client;
  } else {
    _fusionDuplicado = client;
  }

  const input = document.getElementById(`fusionar-${tipo}-input`);
  const lista = document.getElementById(`fusionar-${tipo}-lista`);
  if (input) input.value = nombre;
  if (lista) lista.style.display = 'none';

  // Mostrar previsualización
  const preview = document.getElementById(`fusionar-${tipo}-preview`);
  if (preview) {
    const pfx = tipo === 'principal' ? 'conservar' : 'eliminar';
    const color = tipo === 'principal' ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)';
    const bg = tipo === 'principal' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    const border = tipo === 'principal' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';

    // Contar tickets y órdenes
    const tkCount = tickets.filter(t => t.cliente === client.nombre || t.solicitante === client.nombre).length;
    const ordCount = ordenes.filter(o => o.cliente === client.nombre).length;

    // Contar maquinaria
    let clientMaqs = [];
    const mSAP = maquinariaDb.filter(m => m.cliente === client.nombre || (client.id && m.cliente === client.id) || (client.rfc && m.cliente === client.rfc));
    mSAP.forEach(m => clientMaqs.push(m.id || m.idInterno || m.serie));
    (client.maquinas || []).forEach(m => {
      if (!mSAP.some(sap => sap.id === m.idInterno || sap.serie === m.serie)) {
        clientMaqs.push(m.idInterno || m.serie);
      }
    });
    const maqCount = [...new Set(clientMaqs)].length;

    preview.style.background = bg;
    preview.style.borderColor = border;
    preview.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">${client.nombre}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem; display:flex; gap:0.5rem; align-items:center;">
            <span>RFC: ${client.rfc || 'N/A'}</span>
            ${client.id && client.id !== 'Usuario registrado' ? `• <span>ID SAP: <strong style="font-family:monospace;">${client.id}</strong></span>` : '• <span style="color:#d97706; font-weight:500;">Sin ID SAP</span>'}
          </div>
        </div>
        <span style="font-size:0.7rem; font-weight:600; text-transform:uppercase; color:${color}; background:rgba(${tipo === 'principal' ? '34,197,94,0.12' : '239,68,68,0.12'}); padding:0.15rem 0.4rem; border-radius:4px;">${pfx}</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.5rem; margin-top:0.5rem; text-align:center; font-size:0.78rem; border-top:1px dashed var(--border); padding-top:0.4rem; color:var(--text-muted);">
        <div><strong>${ordCount}</strong> órdenes</div>
        <div><strong>${tkCount}</strong> tickets</div>
        <div><strong>${maqCount}</strong> máquinas</div>
      </div>
    `;
    preview.style.display = 'block';
  }

  actualizarResumenFusion();
}

function actualizarResumenFusion() {
  const resumen = document.getElementById('fusionar-resumen');
  const btnConfirmar = document.getElementById('btn-confirmar-fusion');
  if (!resumen || !btnConfirmar) return;

  if (_fusionPrincipal && _fusionDuplicado) {
    const dupOrd = ordenes.filter(o => o.cliente === _fusionDuplicado.nombre).length;
    const dupTk = tickets.filter(t => t.cliente === _fusionDuplicado.nombre || t.solicitante === _fusionDuplicado.nombre).length;

    let dupMaqs = [];
    const mSAP = maquinariaDb.filter(m => m.cliente === _fusionDuplicado.nombre || (_fusionDuplicado.id && m.cliente === _fusionDuplicado.id) || (_fusionDuplicado.rfc && m.cliente === _fusionDuplicado.rfc));
    mSAP.forEach(m => dupMaqs.push(m.id || m.idInterno || m.serie));
    (_fusionDuplicado.maquinas || []).forEach(m => {
      if (!mSAP.some(sap => sap.id === m.idInterno || sap.serie === m.serie)) {
        dupMaqs.push(m.idInterno || m.serie);
      }
    });
    const dupMaqCount = [...new Set(dupMaqs)].length;

    resumen.innerHTML = `
      <div style="font-weight:600; color:var(--text-primary); margin-bottom:0.4rem;">Resumen de la Fusión:</div>
      <ul style="margin:0; padding-left:1.2rem; color:var(--text-secondary);">
        <li>Se reasignarán <strong>${dupOrd}</strong> órdenes a <strong>${_fusionPrincipal.nombre}</strong>.</li>
        <li>Se reasignarán <strong>${dupTk}</strong> tickets a <strong>${_fusionPrincipal.nombre}</strong>.</li>
        <li>Se transferirán <strong>${dupMaqCount}</strong> máquinas registradas a <strong>${_fusionPrincipal.nombre}</strong>.</li>
        <li>El cliente duplicado <strong>${_fusionDuplicado.nombre}</strong> será eliminado permanentemente.</li>
      </ul>
    `;
    resumen.style.display = 'block';
    btnConfirmar.disabled = false;
    btnConfirmar.style.opacity = '1';
  } else {
    resumen.style.display = 'none';
    btnConfirmar.disabled = true;
    btnConfirmar.style.opacity = '0.4';
  }
}

async function confirmarFusionClientes() {
  const isAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
  if (!isAdmin) {
    mostrarNotificacion('No tienes permisos para realizar esta acción.', 'error');
    return;
  }

  if (!_fusionPrincipal || !_fusionDuplicado) {
    mostrarNotificacion('Por favor, selecciona ambos clientes.', 'error');
    return;
  }
  if (esMismoCliente(_fusionPrincipal, _fusionDuplicado)) {
    mostrarNotificacion('No se puede fusionar un cliente consigo mismo.', 'error');
    return;
  }

  const pNombre = _fusionPrincipal.nombre;
  const dNombre = _fusionDuplicado.nombre;
  const pId = (_fusionPrincipal.id && _fusionPrincipal.id !== 'Usuario registrado') ? _fusionPrincipal.id : pNombre;
  const dId = (_fusionDuplicado.id && _fusionDuplicado.id !== 'Usuario registrado') ? _fusionDuplicado.id : null;

  try {
    mostrarCargando(true, 'Fusionando clientes...');

    // Asegurarse de que el principal exista en clientesDb
    let principalEnDb = clientesDb.find(c => c.nombre === pNombre || (pId && c.id === pId));
    if (!principalEnDb) {
      principalEnDb = {
        id: pId && pId !== pNombre ? pId : crypto.randomUUID(),
        nombre: pNombre,
        rfc: _fusionPrincipal.rfc || '',
        ubicacion: _fusionPrincipal.ubicacion || '',
        contacto: _fusionPrincipal.contacto || '',
        telefono: _fusionPrincipal.telefono || '',
        email: _fusionPrincipal.email || '',
        maquinas: [],
        sitios: [],
        createdAt: new Date().toISOString()
      };
      clientesDb.push(principalEnDb);
    }

    // 1. Reasignar Órdenes
    let ordenesModificadas = [];
    ordenes.forEach(o => {
      if (o.cliente === dNombre) {
        o.cliente = pNombre;
        ordenesModificadas.push(o);
      }
    });

    // 2. Reasignar Tickets
    let ticketsModificados = [];
    tickets.forEach(t => {
      let mod = false;
      if (t.cliente === dNombre) {
        t.cliente = pNombre;
        mod = true;
      }
      if (t.solicitante === dNombre) {
        t.solicitante = pNombre;
        mod = true;
      }
      if (mod) {
        ticketsModificados.push(t);
      }
    });

    // 3. Reasignar Maquinaria
    let maqModificada = [];
    maquinariaDb.forEach(m => {
      if (m.cliente === dNombre || (dId && m.cliente === dId)) {
        m.cliente = pId; // Preferimos ID de SAP para la maquinaria
        maqModificada.push(m);
      }
    });

    // 4. Reasignar Sitios
    let sitiosModificados = [];
    sitiosDb.forEach(s => {
      if (s.cliente === dNombre || (dId && s.cliente === dId)) {
        s.cliente = pId;
        sitiosModificados.push(s);
      }
    });

    // 5. Combinar máquinas en el Cliente Principal
    const pMaquinas = principalEnDb.maquinas || [];
    const dMaquinas = _fusionDuplicado.maquinas || [];
    dMaquinas.forEach(dm => {
      const existe = pMaquinas.some(pm => pm.idInterno === dm.idInterno || pm.serie === dm.serie);
      if (!existe) {
        pMaquinas.push(dm);
      }
    });
    principalEnDb.maquinas = pMaquinas;

    // 6. Combinar sitios en el Cliente Principal
    const pSitios = principalEnDb.sitios || [];
    const dSitios = _fusionDuplicado.sitios || [];
    dSitios.forEach(ds => {
      if (!pSitios.includes(ds)) {
        pSitios.push(ds);
      }
    });
    principalEnDb.sitios = pSitios;

    // 7. Completar campos vacíos en Cliente Principal con datos del duplicado
    principalEnDb.contacto = principalEnDb.contacto || _fusionDuplicado.contacto || '';
    principalEnDb.telefono = principalEnDb.telefono || _fusionDuplicado.telefono || '';
    principalEnDb.email = principalEnDb.email || _fusionDuplicado.email || '';
    principalEnDb.rfc = principalEnDb.rfc || _fusionDuplicado.rfc || '';
    principalEnDb.ubicacion = principalEnDb.ubicacion || _fusionDuplicado.ubicacion || '';
    principalEnDb.grupoSinergia = principalEnDb.grupoSinergia || _fusionDuplicado.grupoSinergia || '';

    // 8. Eliminar cliente duplicado de la lista local
    clientesDb = clientesDb.filter(c => !esMismoCliente(c, _fusionDuplicado));

    // 9. Guardar cambios en LocalStorage
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    safeSetJSON('sapi_ordenes', ordenes);
    safeSetJSON('sapi_tickets', tickets);
    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
    localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));

    // 10. Encolar / Sincronizar en Supabase
    if (window.pushToSupabase) {
      // Registrar modificaciones de órdenes
      for (const o of ordenesModificadas) {
        window.pushToSupabase('ordenes', o);
      }
      // Registrar modificaciones de tickets
      for (const t of ticketsModificados) {
        window.pushToSupabase('tickets', t);
      }
      // Registrar modificaciones de maquinaria
      for (const m of maqModificada) {
        window.pushToSupabase('maquinaria', m);
      }
      // Registrar modificaciones de sitios
      for (const s of sitiosModificados) {
        window.pushToSupabase('sitios', s);
      }
      // Actualizar cliente principal
      window.pushToSupabase('clientes', principalEnDb);

      // Eliminar cliente duplicado
      if (dId) {
        if (window.deleteFromSupabase) {
          window.deleteFromSupabase('clientes', dId);
        }
      }
    }

    mostrarCargando(false);
    mostrarNotificacion(`Fusión completada con éxito. ${dNombre} ha sido absorbido por ${pNombre}.`, 'success');
    cerrarModalFusionarClientes();
    renderClientes();
  } catch (err) {
    console.error('Error al fusionar clientes:', err);
    mostrarCargando(false);
    mostrarNotificacion('Ocurrió un error inesperado al realizar la fusión.', 'error');
  }
}function deduplicarOrdenesLocales() {
  if (typeof localStorage === 'undefined') return;
  const localOrds = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
  if (localOrds.length === 0) return;

  const seen = new Map();
  const keep = [];
  const removedIds = new Set();

  localOrds.forEach(o => {
    // Limpiar entradas duplicadas dentro de la propia bitácora de la orden
    if (o.bitacora && Array.isArray(o.bitacora) && o.bitacora.length > 0) {
      const seenB = new Set();
      o.bitacora = o.bitacora.filter(b => {
        const bKey = `${b.id || ''}_${b.fecha}_${b.tecnico}_${b.entrada}_${b.salida}_${b.nota || ''}`;
        if (seenB.has(bKey)) return false;
        seenB.add(bKey);
        return true;
      });
    }

    // Generar una clave única basada en el contenido de la orden (excluyendo id y folio)
    const key = [
      o.cliente || '',
      o.tecnico || '',
      o.tipo || '',
      o.fecha || '',
      o.maquinaria_id || '',
      o.sitio_id || '',
      o.notas || '',
      o.evidencia_url || o.evidenciaBase64 || ''
    ].join('|');

    if (!seen.has(key)) {
      seen.set(key, true);
      keep.push(o);
    } else {
      removedIds.add(o.id);
    }
  });

  if (removedIds.size > 0) {
    console.log(`[Deduplicar] Eliminadas ${removedIds.size} órdenes duplicadas locales.`);
    localStorage.setItem('sapi_ordenes', JSON.stringify(keep));
    ordenes = keep; // actualizar la variable global en memoria
    
    // Limpiar cola de sincronización de las órdenes eliminadas
    try {
      const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
      const newQueue = queue.filter(item => {
        if (item.table === 'ordenes') {
          const orderId = item.data ? item.data.id : null;
          if (removedIds.has(orderId)) return false;
        }
        return true;
      });
      localStorage.setItem('sapi_sync_queue', JSON.stringify(newQueue));
      if (window.updateSyncStatusUI) window.updateSyncStatusUI();
    } catch (e) {
      console.error('Error limpiando cola de sync en deduplicación:', e);
    }
  }

  // Deduplicar en Supabase usando la sesión actual del usuario
  const sb = window.supabaseClient;
  if (sb) {
    (async () => {
      try {
        let supaOrds = [];
        let fetchErr = null;
        try {
          supaOrds = await window.fetchTablePaginated('ordenes', '*');
        } catch (err) {
          fetchErr = err;
        }
        if (!fetchErr && supaOrds && supaOrds.length > 0) {
          const sSeen = new Map();
          const sDupIds = [];

          // Ordenar para mantener el primer folio creado
          supaOrds.sort((a, b) => String(a.folio || a.id).localeCompare(String(b.folio || b.id)));

          supaOrds.forEach(o => {
            let cName = o.cliente || '';
            try {
              const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
              const match = clientes.find(c => c.id === o.cliente);
              if (match) cName = match.nombre;
            } catch (e) {}

            const key = [
              cName || '',
              o.tecnico || '',
              o.tipo || '',
              o.fecha || '',
              o.maquinaria_id || '',
              o.sitio_id || '',
              o.notas || '',
              o.evidencia_url || ''
            ].join('|');

            if (!sSeen.has(key)) {
              sSeen.set(key, o.id);
            } else {
              sDupIds.push(o.id);
            }
          });

          if (sDupIds.length > 0) {
            console.log(`[Deduplicar Supabase] Eliminando ${sDupIds.length} duplicados en Supabase...`);
            for (let i = 0; i < sDupIds.length; i += 50) {
              const batch = sDupIds.slice(i, i + 50);
              await sb.from('ordenes').delete().in('id', batch);
            }
            console.log('[Deduplicar Supabase] Devolviendo ordenes deduplicadas.');
            mostrarNotificacion(`Se han eliminado ${sDupIds.length} órdenes duplicadas en la base de datos.`, 'info');
          }
        }
      } catch (e) {
        console.warn('Bypassing Supabase deduplication due to session/auth:', e);
      }
    })();
  }
}

async function regenerarOrdenesDesdeTickets() {
  const confirmacion = confirm("¿Estás seguro de que quieres borrar TODAS las órdenes de servicio de la base de datos y del navegador, y regenerarlas a partir de los tickets cerrados y aceptados? Esta acción no se puede deshacer.");
  if (!confirmacion) return;

  console.log('[Regenerar] Iniciando limpieza de órdenes...');
  
  // 1. Limpiar localmente
  ordenes = [];
  localStorage.setItem('sapi_ordenes', '[]');
  
  // Limpiar cola de sincronización para evitar conflictos con folios viejos
  try {
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const newQueue = queue.filter(item => item.table !== 'ordenes');
    localStorage.setItem('sapi_sync_queue', JSON.stringify(newQueue));
  } catch (e) {}

  // 2. Limpiar en Supabase
  const sb = window.supabaseClient;
  if (sb) {
    console.log('[Regenerar] Borrando todas las órdenes en Supabase...');
    const { error: delErr } = await sb.from('ordenes').delete().neq('id', 'dummy_id_never_exists');
    if (delErr) {
      console.error('[Regenerar] Error al borrar órdenes en Supabase:', delErr);
      alert('Error al borrar las órdenes de la base de datos de Supabase: ' + delErr.message);
      return;
    }
  }

  // 3. Filtrar y ordenar tickets cerrados de SERVICIO EN CAMPO (excluyendo rechazados, garantías y refacciones)
  const ticketsFiltrados = tickets.filter(t => t.estado === 'Cerrado' && t.cotAceptada !== 'no' && window.esTicketDeServicioEnCampo(t));
  ticketsFiltrados.sort((a, b) => {
    const d1 = new Date(a.fechaCreacion || a.fecha || 0);
    const d2 = new Date(b.fechaCreacion || b.fecha || 0);
    return d1 - d2;
  });

  console.log(`[Regenerar] Encontrados ${ticketsFiltrados.length} tickets cerrados para regenerar.`);

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  // 4. Regenerar orden por orden
  for (const t of ticketsFiltrados) {
    let modeloStr = '';
    let serieStr = '';
    let marcaStr = '';
    let ecoStr = '';
    let maquinariaId = null;

    if (t.equipo) {
      const matchMaquina = (m) => {
        const cleanId = m.idInterno || m.id || '';
        if (!cleanId) return false;
        const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
        const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        
        const equipoString = t.equipo || '';
        const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
        
        return names.some(name => {
          return (
            name === mName ||
            name === cleanId ||
            name === m.serie ||
            name.includes(`[${cleanId}]`) ||
            (m.serie && name.includes(`(SN: ${m.serie})`))
          );
        });
      };

      let maq = null;
      clientesDb.forEach(c => {
        if (c.maquinas) {
          const found = c.maquinas.find(matchMaquina);
          if (found) maq = found;
        }
      });
      if (!maq) maq = maquinariaDb.find(matchMaquina);

      if (maq) {
        modeloStr = maq.modelo || '';
        serieStr = maq.serie || '';
        marcaStr = maq.marca || '';
        ecoStr = maq.no_economico || '';
        maquinariaId = maq.id || maq.idInterno || null;
      } else {
        if (t.equipo.includes('(SN: ')) {
          const parts = t.equipo.split('(SN: ');
          serieStr = parts[1].replace(')', '').trim();
          let left = parts[0].trim();
          if (left.startsWith('[') && left.includes(']')) {
            left = left.substring(left.indexOf(']') + 1).trim();
          }
          modeloStr = left;
        } else {
          modeloStr = t.equipo;
        }
      }
    }

    // Calcular folio secuencial
    let newFolio = generarFolioConsecutivo();
    const isTest = isTestData(t) || isTestModeActive();
    if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
      newFolio = `[PRUEBA] ${newFolio}`;
    }

    const nuevaOrden = {
      id: newFolio,
      fecha: t.fechaCierre || t.fecha || getLocalDateString(),
      folio: newFolio,
      pedido: t.pedidoSAP || '',
      cliente: t.cliente || '',
      ubicacion: t.sitio || '',
      ubicacion_sitio: '',
      operador: '',
      eco: ecoStr || '',
      horometro: '',
      modelo: modeloStr,
      serie: serieStr,
      marca: marcaStr || '',
      maquinaria_id: maquinariaId || null,
      equipo: t.equipo || '',
      tecnico: (t.tecnicosAsignados || []).join(', '),
      tecnicosAsignados: t.tecnicosAsignados || [],
      soporte: t.id,
      km_ida: '', km_vuelta: '', km_total: '',
      tipo: 'Servicio',
      estado: 'Pendiente',
      falla: (t.asunto ? t.asunto + '\n' : '') + (t.descripcion || ''),
      trabajos: '', dictamen: '', condiciones: '',
      observaciones: '', pendientes: '',
      ref_utilizadas: [], ref_necesarias: [],
      factura_ref: '', factura_mo: '',
      noches: '', alimentacion: '', traslado_costo: '',
      dias: [],
      esPrueba: isTest,
      _synced: true,
    };

    ordenes.push(nuevaOrden);
    if (window.supabaseClient && window.ordenToRow) {
      const row = window.ordenToRow(nuevaOrden);
      const { error: upsertErr } = await window.supabaseClient.from('ordenes').upsert(row);
      if (upsertErr) {
        console.error('[Regenerar] Error al subir orden a Supabase:', upsertErr);
      }
    }
  }

  safeSetJSON('sapi_ordenes', ordenes);
  console.log(`[Regenerar] Completado. Se crearon ${ordenes.length} órdenes.`);
  alert(`¡Proceso completado! Se eliminaron todas las órdenes anteriores y se regeneraron ${ordenes.length} órdenes secuenciales a partir de los tickets cerrados y aprobados.`);
  
  if (typeof renderTabla === 'function') renderTabla('servicios');
  if (window.updateSyncStatusUI) window.updateSyncStatusUI();
  
  // Forzar reload
  location.reload();
};

function confirmarAccion(options = {}) {
  return new Promise((resolve) => {
    // 1. Crear contenedor principal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // Forzamos estilos inline para asegurar que esté por encima de TODO
    overlay.style.cssText = `
      z-index: 9999999 !important;
      display: flex !important;
      position: fixed !important;
      inset: 0 !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0,0,0,0.6) !important;
      backdrop-filter: blur(6px) !important;
      opacity: 0;
      transition: opacity 0.25s ease-in-out;
    `;

    // 2. Determinar icono y colores
    const iconName = options.esPeligroso ? (options.icono || 'alert-triangle') : (options.icono || 'help-circle');
    const colorPrimario = options.esPeligroso ? 'var(--red, #ef4444)' : 'var(--accent, #E8820C)';
    const colorFondoIcono = options.esPeligroso ? 'rgba(239,68,68,0.12)' : 'rgba(232,130,12,0.12)';
    
    // 3. Crear HTML interno
    overlay.innerHTML = `
      <div class="modal" style="
        max-width: 440px; width: 92%; border-radius: 20px; background: var(--bg-card, #fff); 
        color: var(--text-primary, #111); border: 1px solid var(--border, #eaeaea); 
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); padding: 2rem; display: flex; 
        flex-direction: column; gap: 1.25rem; transform: scale(0.9); 
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-top: 4px solid ${colorPrimario};
      ">
        <div style="display:flex; gap:1rem; align-items:flex-start;">
          <div style="background:${colorFondoIcono}; color:${colorPrimario}; border-radius:12px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <i data-lucide="${iconName}" style="width:24px; height:24px;"></i>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; flex:1;">
            <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary); font-family:var(--font-title, inherit); letter-spacing:-0.02em;">
              ${options.titulo || 'Confirmación'}
            </h3>
            <p style="margin:0; color:var(--text-secondary); font-size:0.95rem; line-height:1.6; font-weight:400;">
              ${options.mensaje || '¿Estás seguro de realizar esta acción?'}
            </p>
          </div>
        </div>
        <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:0.5rem; border-top:1px solid var(--border, #eaeaea); padding-top:1.25rem;">
          <button type="button" class="btn-cancelar-dinamico" style="
            margin:0; padding:0.6rem 1.25rem; height:auto; font-size:0.9rem; font-weight:600; 
            border-radius:10px; transition: all 0.2s; background: var(--bg-hover, #f3f4f6); 
            border: 1px solid var(--border, #e5e7eb); color: var(--text-primary, #374151); cursor: pointer;
          ">${options.textoCancelar || 'Cancelar'}</button>
          
          <button type="button" class="btn-aceptar-dinamico" style="
            margin:0; padding:0.6rem 1.25rem; height:auto; font-size:0.9rem; font-weight:600; 
            border-radius:10px; transition: all 0.2s; background: ${colorPrimario}; 
            border: 1px solid ${colorPrimario}; color: #ffffff; cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
          ">${options.textoAceptar || 'Aceptar'}</button>
        </div>
      </div>
    `;

    // 4. Agregar al DOM
    document.body.appendChild(overlay);

    // Renderizar iconos Lucide si existe la librería
    if (window.lucide) {
      window.lucide.createIcons({ root: overlay });
    }

    const modalContent = overlay.querySelector('.modal');
    const btnCancel = overlay.querySelector('.btn-cancelar-dinamico');
    const btnAccept = overlay.querySelector('.btn-aceptar-dinamico');

    // 5. Función de limpieza
    const cleanUp = () => {
      overlay.style.opacity = '0';
      if (modalContent) modalContent.style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 250);
    };

    // 6. Asignar eventos
    btnCancel.onclick = (e) => {
      e.stopPropagation();
      cleanUp();
      resolve(false);
    };

    btnAccept.onclick = (e) => {
      e.stopPropagation();
      cleanUp();
      resolve(true);
    };
    
    // Si hacen clic en el fondo oscuro, se cierra y cancela (opcional, pero útil)
    overlay.onclick = (e) => {
      if(e.target === overlay) {
        e.stopPropagation();
        cleanUp();
        resolve(false);
      }
    };

    // 7. Animar entrada
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      if (modalContent) modalContent.style.transform = 'scale(1)';
    });
  });
};

async function eliminarAsignacionProgramadaDirecto(ordenId, bitacoraId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este registro/asignación del calendario?")) return;

  // 1. Eliminar de la bitácora de la orden
  const oIndex = ordenes.findIndex(o => o.id === ordenId);
  let asignacionEliminada = null;
  if (oIndex > -1) {
    const o = ordenes[oIndex];
    if (o.bitacora) {
      asignacionEliminada = o.bitacora.find(b => b.id === bitacoraId || `bit-${b.id}` === bitacoraId);
      const cleanId = asignacionEliminada ? asignacionEliminada.id : bitacoraId;
      o.bitacora = o.bitacora.filter(b => b.id !== cleanId && `bit-${b.id}` !== bitacoraId);
      
      const activeTecs = Array.from(new Set((o.bitacora || []).map(b => (b.tecnico || '').trim()).filter(Boolean)));
      o.tecnicosAsignados = activeTecs;
      o.tecnico = activeTecs.join(', ');

      safeSetJSON('sapi_ordenes', ordenes);
      if (window.pushToSupabase) {
        await window.pushToSupabase('ordenes', o);
      }
    }
  }

  // 2. Eliminar el evento del calendario
  const cleanBitId = String(bitacoraId || '').replace('bit-', '');
  const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
  const filtrados = localEventos.filter(x => x.id !== bitacoraId && x.id !== cleanBitId);
  localStorage.setItem('sapi_calendario_eventos', JSON.stringify(filtrados));
  
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('orden_bitacora', cleanBitId);
    window.deleteFromSupabase('calendario_eventos', cleanBitId);
    window.deleteFromSupabase('calendario_eventos', bitacoraId);
  }

  if (window.trackTelemetryEvent) {
    const o = oIndex > -1 ? ordenes[oIndex] : null;
    const folioStr = o ? (o.folio || 'Sin Folio') : 'Sin Folio';
    window.trackTelemetryEvent('Eliminación de Asignación', { 
      id: bitacoraId, 
      folio: folioStr,
      tecnico: asignacionEliminada ? asignacionEliminada.tecnico : null,
      fecha: asignacionEliminada ? asignacionEliminada.fecha : null
    });
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion("Asignación eliminada del calendario.", "info");
  }

  // 3. Re-renderizar detalle y calendarios
  verDetalle(ordenId);
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
};

async function eliminarTodasAsignacionesOrden(ordenId) {
  const o = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes.find(x => x.id === ordenId) : null;
  if (!o) return;
  const folio = o.folio || o.id;

  const pendientes = (o.bitacora || []).filter(b => {
    if (!b) return false;
    const notaLower = (b.nota || '').toLowerCase();
    const hasReal = Boolean(b.firma_tecnico_url || b.firma_tecnico_base64 || (b.fotos && b.fotos.length > 0) || (b.evidencias && Object.keys(b.evidencias).length > 0));
    return !hasReal && (b.realizado === false || notaLower.includes('programado') || notaLower.includes('pendiente de llenado') || !b.nota);
  });

  if (pendientes.length === 0) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`La orden ${folio} no tiene asignaciones programadas pendientes.`, 'info');
    }
    return;
  }

  if (!confirm(`¿Deseas eliminar TODAS las ${pendientes.length} asignaciones programadas de la orden ${folio}?\n\n(Nota: Los avances diarios completados por los técnicos no se borrarán).`)) return;

  const idsEliminados = pendientes.map(b => b.id).filter(Boolean);
  o.bitacora = (o.bitacora || []).filter(b => !idsEliminados.includes(b.id));

  // Actualizar técnicos asignados
  const tecnicosRestantes = new Set((o.bitacora || []).map(b => b.tecnico).filter(Boolean));
  o.tecnicosAsignados = Array.from(tecnicosRestantes);
  o.tecnico = o.tecnicosAsignados.join(', ');

  safeSetJSON('sapi_ordenes', ordenes);

  // Limpiar sapi_calendario_eventos
  try {
    const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    const filtradosEventos = localEventos.filter(ev => !idsEliminados.includes(ev.id) && ev.ordenId !== ordenId);
    localStorage.setItem('sapi_calendario_eventos', JSON.stringify(filtradosEventos));
  } catch(e){}

  // Borrar de Supabase
  if (window.deleteFromSupabase) {
    idsEliminados.forEach(id => {
      window.deleteFromSupabase('orden_bitacora', id);
      window.deleteFromSupabase('calendario_eventos', id);
    });
  }
  if (window.pushToSupabase) {
    await window.pushToSupabase('ordenes', o);
  }

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`✅ Se eliminaron ${idsEliminados.length} asignaciones programadas de la orden ${folio}.`, 'success');
  }
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
  if (typeof verDetalle === 'function' && document.getElementById('view-detalle')?.classList.contains('active')) {
    verDetalle(ordenId);
  }
};

function sanitizarBitacorasOrdenes() {
  // Función de purga/sanitización automática DESACTIVADA PERMANENTEMENTE.
  // Protege todas las asignaciones legítimas, evitando cualquier eliminación local o en Supabase.
  return;
};

async function limpiarAsignacionesDuplicadas() {
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
};

async function ejecutarDiagnosticoLocal() {
  const diagnosticEl = document.getElementById('diagnostic-results');
  if (!diagnosticEl) return;
  
  diagnosticEl.style.display = 'block';
  diagnosticEl.textContent = 'Ejecutando diagnóstico...';
  
  try {
    const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
    const uList = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
    const ords = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    const errorLog = localStorage.getItem('last_sync_error') || 'Ninguno registrado';
    
    let info = '';
    
    // Verificar sesión real de Supabase Client
    if (window.supabaseClient) {
      try {
        const { data: supaSession } = await window.supabaseClient.auth.getSession();
        if (supaSession && supaSession.session) {
          info += `Supabase Client Auth: ACTIVO\n`;
          info += `- Supabase User ID: ${supaSession.session.user.id}\n`;
          info += `- Supabase Email: ${supaSession.session.user.email}\n`;
          
          // Ejecutar consulta de prueba en vivo
          try {
            const { data: liveOrds, error: liveErr } = await window.supabaseClient.from('ordenes').select('id, folio, tecnico, notas');
            if (liveErr) {
              info += `Live Query Error: ${liveErr.message} (${liveErr.code || ''})\n`;
            } else {
              info += `Live Query Success: Trajo ${liveOrds ? liveOrds.length : 0} órdenes\n`;
              if (liveOrds && liveOrds.length > 0) {
                info += `  Primer folio: ${liveOrds[0].folio} (Téc: ${liveOrds[0].tecnico})\n`;
              }
            }
          } catch (queryEx) {
            info += `Live Query Exception: ${queryEx.message}\n`;
          }
        } else {
          info += `Supabase Client Auth: NO ACTIVO (Sesión vacía)\n`;
        }
      } catch (authErr) {
        info += `Supabase Client Auth: ERROR al obtener (${authErr.message})\n`;
      }
    } else {
      info += `Supabase Client Auth: CLIENTE NO INICIALIZADO\n`;
    }
    
    info += `Usuario ID en Portal: ${session.userId || 'N/A'}\n`;
    info += `Nombre Sesión Portal: ${session.nombre || 'N/A'}\n`;
    info += `Rol Real / Vista Portal: ${session.realRol || 'N/A'} / ${session.viewMode || 'N/A'}\n`;
    info += `Usuarios en LocalStorage: ${uList.length}\n`;
    
    // Buscar usuario actual en la lista
    const currentU = uList.find(u => u.id === session.userId);
    info += `Usuario en BD Local: ${currentU ? 'Encontrado' : 'NO encontrado'}\n`;
    if (currentU) {
      info += `- Nombre en BD: ${currentU.nombre}\n`;
      info += `- Rol en BD: ${currentU.rol}\n`;
    }
    
    info += `Última sinc Supabase: ${window.lastSyncTimestamp || 'N/A'}\n`;
    info += `- Órdenes traídas en Sinc: ${window.lastSyncOrdsLength !== undefined ? window.lastSyncOrdsLength : 'N/A'} (Error: ${window.lastSyncOrdsError || 'Ninguno'})\n`;
    info += `- Órdenes mapped en Sinc: ${window.lastSyncMappedLength !== undefined ? window.lastSyncMappedLength : 'N/A'}\n`;
    info += `Órdenes Totales Local (en Cache): ${ords.length}\n`;
    
    // Contar por tipo (test vs real)
    let testCount = 0;
    let realCount = 0;
    ords.forEach(o => {
      if (isTestData(o)) testCount++;
      else realCount++;
    });
    info += `- Órdenes Sandbox (Test): ${testCount}\n`;
    info += `- Órdenes Reales: ${realCount}\n`;
    
    // Listar detalles de las órdenes de prueba
    const testOrds = ords.filter(isTestData);
    info += `\nÓrdenes Sandbox Detalle (${testOrds.length}):\n`;
    
    const tecName = currentU ? currentU.nombre : (session.nombre || '');
    const tecNameLower = tecName.toLowerCase().trim();
    
    testOrds.forEach(o => {
      let assigned = [];
      if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
        assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
      } else if (o.tecnico) {
        assigned = o.tecnico.split(',').map(s=>s.trim());
      }
      const assignedLower = assigned.map(s => String(s).toLowerCase().trim());
      const isCreator = o.creadoPor && String(o.creadoPor).toLowerCase().trim() === tecNameLower;
      const isAssigned = assignedLower.includes(tecNameLower);
      
      info += `- Folio: ${o.folio}\n`;
      info += `  Tecnico (col): ${o.tecnico}\n`;
      info += `  TecnicosAsignados: ${JSON.stringify(o.tecnicosAsignados)}\n`;
      info += `  CreadoPor: ${o.creadoPor}\n`;
      info += `  Match Técnico: ${isAssigned ? 'SÍ' : 'NO'}\n`;
      info += `  Match Creador: ${isCreator ? 'SÍ' : 'NO'}\n`;
    });
    
    info += `\nÚltimo Error de Sincronización:\n${errorLog}`;
    info += `\n\nÚltimo Error de Subida de Imagen:\n${window.lastUploadError || 'Ninguno registrado'}`;
    
    diagnosticEl.textContent = info;
  } catch (err) {
    diagnosticEl.textContent = `Error al ejecutar diagnóstico: ${err.message}\n${err.stack}`;
  }
};


// Bindeo global en window
if (typeof window !== "undefined") {
  window.trackTelemetryEvent = trackTelemetryEvent;
  window.seedMockTelemetryData = seedMockTelemetryData;
  window.filterTelemetryLogs = filterTelemetryLogs;
  window.clearTelemetryLogs = clearTelemetryLogs;
  window.getRelativeTime = getRelativeTime;
  window.renderTelemetryEventsFeed = renderTelemetryEventsFeed;
  window.renderTelemetryDashboard = renderTelemetryDashboard;
  window.obtenerTodosLosClientes = obtenerTodosLosClientes;
  window.abrirModalFusionarClientes = abrirModalFusionarClientes;
  window.cerrarModalFusionarClientes = cerrarModalFusionarClientes;
  window.esMismoCliente = esMismoCliente;
  window.mostrarCargando = mostrarCargando;
  window.filtrarFusionClientes = filtrarFusionClientes;
  window.mostrarListaFusion = mostrarListaFusion;
  window.seleccionarClienteFusion = seleccionarClienteFusion;
  window.actualizarResumenFusion = actualizarResumenFusion;
  window.confirmarFusionClientes = confirmarFusionClientes;
  window.deduplicarOrdenesLocales = deduplicarOrdenesLocales;
  window.regenerarOrdenesDesdeTickets = regenerarOrdenesDesdeTickets;
  window.confirmarAccion = confirmarAccion;
  window.eliminarAsignacionProgramadaDirecto = eliminarAsignacionProgramadaDirecto;
  window.eliminarTodasAsignacionesOrden = eliminarTodasAsignacionesOrden;
  window.sanitizarBitacorasOrdenes = sanitizarBitacorasOrdenes;
  window.limpiarAsignacionesDuplicadas = limpiarAsignacionesDuplicadas;
  window.ejecutarDiagnosticoLocal = ejecutarDiagnosticoLocal;
}

export {
  trackTelemetryEvent,
  seedMockTelemetryData,
  filterTelemetryLogs,
  clearTelemetryLogs,
  getRelativeTime,
  renderTelemetryEventsFeed,
  renderTelemetryDashboard,
  obtenerTodosLosClientes,
  abrirModalFusionarClientes,
  cerrarModalFusionarClientes,
  esMismoCliente,
  mostrarCargando,
  filtrarFusionClientes,
  mostrarListaFusion,
  seleccionarClienteFusion,
  actualizarResumenFusion,
  confirmarFusionClientes,
  deduplicarOrdenesLocales,
  regenerarOrdenesDesdeTickets,
  confirmarAccion,
  eliminarAsignacionProgramadaDirecto,
  eliminarTodasAsignacionesOrden,
  sanitizarBitacorasOrdenes,
  limpiarAsignacionesDuplicadas,
  ejecutarDiagnosticoLocal
};
