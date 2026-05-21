// ============================================================
// supabaseSync.js — Sincronización con Supabase
// Versión limpia. Estrategia: Local-first + Cloud backup.
// ============================================================

// ─── Helpers de mapeo camelCase <-> snake_case ───────────────

function ticketToRow(t) {
  return {
    id: t.id,
    folio: t.folio,
    fecha: t.fecha,
    fecha_creacion: t.fechaCreacion || new Date().toISOString(),
    canal: t.canal || null,
    contacto: t.contacto || null,
    asunto: t.asunto || null,
    cliente: t.cliente || null,
    sitio: t.sitio || null,
    solicitante: t.solicitante || null,
    area: t.area || null,
    categoria: t.categoria || null,
    prioridad: t.prioridad || null,
    asignado: t.asignado || null,
    descripcion: t.descripcion || null,
    equipo: t.equipo || null,
    notas: (t.horometro ? `[H:${t.horometro}]\n` : '') + (t.notas || ''),
    estado: t.estado || null,
    cotizacion_sap: t.cotizacionSAP || null,
    cot_aceptada: t.cotAceptada || null,
    motivo_rechazo: t.motivoRechazo || null,
    pedido_sap: t.pedidoSAP || null,
    tecnicos_asignados: t.tecnicosAsignados || [],
    pdf_pedido: t.pdfPedido || null,
    pdf_cotizacion: t.pdfCotizacion || null
  };
}

function rowToTicket(t) {
  const obj = {
    id: t.id,
    folio: t.folio,
    fecha: t.fecha,
    fechaCreacion: t.fecha_creacion,
    canal: t.canal,
    contacto: t.contacto,
    asunto: t.asunto,
    cliente: t.cliente,
    sitio: t.sitio,
    solicitante: t.solicitante,
    area: t.area,
    categoria: t.categoria,
    prioridad: t.prioridad,
    asignado: t.asignado,
    descripcion: t.descripcion,
    equipo: t.equipo,
    notas: t.notas,
    estado: t.estado,
    cotizacionSAP: t.cotizacion_sap,
    cotAceptada: t.cot_aceptada,
    motivoRechazo: t.motivo_rechazo,
    pedidoSAP: t.pedido_sap,
    tecnicosAsignados: t.tecnicos_asignados || [],
    pdfPedido: t.pdf_pedido,
    pdfCotizacion: t.pdf_cotizacion
  };
  
  if (obj.notas && obj.notas.startsWith('[H:')) {
    const endIdx = obj.notas.indexOf(']\n');
    if (endIdx > -1) {
      obj.horometro = obj.notas.substring(3, endIdx);
      obj.notas = obj.notas.substring(endIdx + 2);
    }
  }
  return obj;
}

function ordenToRow(o) {
  const customData = { ...o };
  const knownKeys = ['id', 'folio', 'cliente', 'ubicacion', 'tecnico', 'modelo', 'tipo', 'estado', 'fecha', 'fechaInicio', 'fechaFin', 'duracion', 'duracion_minutos', 'evidenciaBase64', 'evidencia_base64'];
  knownKeys.forEach(k => delete customData[k]);
  
  const notasJSON = JSON.stringify(customData);

  return {
    id: o.id,
    folio: o.folio,
    cliente: o.cliente,
    ubicacion: o.ubicacion || null,
    tecnico: o.tecnico || null,
    modelo: o.modelo || null,
    tipo: o.tipo || 'Servicio',
    estado: o.estado || 'Pendiente',
    fecha: o.fecha || new Date().toISOString(),
    fecha_inicio: o.fechaInicio || null,
    fecha_fin: o.fechaFin || null,
    duracion_minutos: o.duracion || null,
    notas: notasJSON,
    evidencia_base64: o.evidenciaBase64 || null
  };
}

function rowToOrden(o) {
  let extraData = {};
  if (o.notas && o.notas.startsWith('{')) {
    try {
      extraData = JSON.parse(o.notas);
    } catch(e) {}
  } else if (o.notas) {
    extraData.observaciones = o.notas; // Fallback por si hay texto legacy
  }

  return {
    id: o.id, folio: o.folio, cliente: o.cliente,
    ubicacion: o.ubicacion, tecnico: o.tecnico, modelo: o.modelo,
    tipo: o.tipo, estado: o.estado, fecha: o.fecha,
    fechaInicio: o.fecha_inicio, fechaFin: o.fecha_fin,
    duracion: o.duracion_minutos,
    evidenciaBase64: o.evidencia_base64,
    ...extraData
  };
}

function clienteToRow(c) {
  if (!c.id) {
    c.id = crypto.randomUUID();
  }
  return {
    id: c.id,
    nombre: c.nombre,
    rfc: c.rfc || null,
    email: c.email || null,
    telefono: c.telefono || null,
    id_fiscal: c.idFiscal || null,
    sitios: c.sitios || [],
    maquinas: c.maquinas || [],
    supervisores_asignados: c.supervisoresAsignados || [],
    tecnicos_asignados: c.tecnicosAsignados || []
  };
}

function rowToCliente(c) {
  return {
    id: c.id, nombre: c.nombre, rfc: c.rfc, email: c.email,
    telefono: c.telefono, idFiscal: c.id_fiscal,
    sitios: c.sitios || [], maquinas: c.maquinas || [],
    supervisoresAsignados: c.supervisores_asignados || [],
    tecnicosAsignados: c.tecnicos_asignados || []
  };
}

// ─── Cola de Sincronización Offline ──────────────────────────

function getSyncQueue() {
  return JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
}

function saveSyncQueue(queue) {
  localStorage.setItem('sapi_sync_queue', JSON.stringify(queue));
  updateSyncStatusUI();
}

function addToSyncQueue(table, action, data) {
  const queue = getSyncQueue();
  const existingIdx = queue.findIndex(item => item.table === table && item.data.id === data.id);
  if (existingIdx > -1) {
    if (queue[existingIdx].action === 'delete' && action === 'upsert') {
      // mantener el delete pendiente si ya está ahí
    } else {
      queue[existingIdx] = { table, action, data, timestamp: Date.now() };
    }
  } else {
    queue.push({ table, action, data, timestamp: Date.now() });
  }
  saveSyncQueue(queue);
}

window.pushToSupabase = async function(tabla, item) {
  // Añadir a la cola local para estrategia offline-first
  addToSyncQueue(tabla, 'upsert', item);
  
  // Intentar sincronizar inmediatamente en segundo plano
  processSyncQueue();
};

window.deleteFromSupabase = async function(tabla, id) {
  // Añadir borrado a la cola
  addToSyncQueue(tabla, 'delete', { id });
  
  // Intentar sincronizar
  processSyncQueue();
};

let _isProcessingQueue = false;

async function processSyncQueue() {
  if (_isProcessingQueue) return;
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Sync] SupabaseClient no disponible. Sincronización en espera.');
    updateSyncStatusUI();
    return;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    updateSyncStatusUI();
    return;
  }

  if (!navigator.onLine) {
    console.log('[Sync] Dispositivo sin conexión. Sincronización en pausa.');
    updateSyncStatusUI();
    return;
  }

  _isProcessingQueue = true;
  updateSyncStatusUI();

  console.log(`[Sync] Iniciando envío de ${queue.length} operaciones pendientes...`);
  
  let successCount = 0;
  
  while (queue.length > 0) {
    const item = queue[0];
    let payload;
    let error = null;
    let resTabla = item.table;

    try {
      if (item.action === 'upsert') {
        if (item.table === 'tickets') {
          payload = ticketToRow(item.data);
        } else if (item.table === 'ordenes') {
          payload = ordenToRow(item.data);
        } else if (item.table === 'clientes') {
          payload = clienteToRow(item.data);
        } else if (item.table === 'usuarios') {
          if (item.data.email === 'admin@eurorep.mx') {
            queue.shift();
            saveSyncQueue(queue);
            continue;
          }
          payload = {
            id: item.data.id,
            nombre: item.data.nombre,
            email: item.data.email || `${item.data.id}@temp.com`,
            pin: item.data.pin || '0000',
            rol: item.data.rol || 'tecnico',
            activo: item.data.activo !== false,
            empresa: item.data.empresa || null
          };
        } else if (item.table === 'sitios') {
          payload = { id: item.data.id, nombre: item.data.nombre, cliente: item.data.cliente, direccion: item.data.direccion, cp: item.data.cp, ciudad: item.data.ciudad, estado: item.data.estado, custom_data: item.data.customData || {} };
        } else if (item.table === 'maquinaria') {
          payload = { id: item.data.id, serie: item.data.serie, marca: item.data.marca, modelo: item.data.modelo, anio: item.data.anio, cliente: item.data.cliente, id_interno: item.data.idInterno, descripcion: item.data.descripcion, custom_data: item.data.customData || {} };
        } else if (item.table === 'refacciones') {
          payload = { id: item.data.id, codigo: item.data.codigo, descripcion: item.data.descripcion, precio: item.data.precio, moneda: item.data.moneda, stock: item.data.stock, custom_data: { ...(item.data.customData || {}), marca: item.data.marca, grupo: item.data.grupo, origen: item.data.origen, nombre: item.data.nombre } };
        } else if (item.table === 'config') {
          payload = { id: 'main', data: item.data };
        } else if (item.table === 'roles') {
          resTabla = 'config';
          payload = { id: 'roles', data: item.data };
        } else {
          payload = item.data;
        }

        const { error: upsertErr } = await sb.from(resTabla).upsert(payload, { onConflict: 'id' });
        error = upsertErr;
      } else if (item.action === 'delete') {
        const { error: deleteErr } = await sb.from(resTabla).delete().eq('id', item.data.id);
        error = deleteErr;
      }

      if (error) {
        console.error(`[Sync] Error en operación (${item.table} - ${item.action}):`, error.message);
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('network') || error.message.includes('timeout') || error.message.includes('connection') || error.message.includes('TypeError: Failed to fetch'))) {
          break; // Error de red temporal, pausar procesamiento
        } else {
          console.warn(`[Sync] Error permanente de BD. Saltando elemento.`);
          queue.shift();
          saveSyncQueue(queue);
        }
      } else {
        queue.shift();
        saveSyncQueue(queue);
        successCount++;
      }
    } catch (e) {
      console.error(`[Sync] Excepción en processSyncQueue:`, e.message);
      if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('network') || e.message.includes('fetch'))) {
        break;
      } else {
        queue.shift();
        saveSyncQueue(queue);
      }
    }
  }

  _isProcessingQueue = false;
  updateSyncStatusUI();

  if (successCount > 0 && window.mostrarNotificacion) {
    window.mostrarNotificacion(`Sincronización completa: ${successCount} cambios enviados.`, 'success');
    window.dispatchEvent(new Event('supabase_datos_cargados'));
  }
}

function updateSyncStatusUI() {
  const container = document.getElementById('sync-status-indicator');
  if (!container) return;

  const iconEl = document.getElementById('sync-status-icon');
  const textEl = document.getElementById('sync-status-text');
  const badgeEl = document.getElementById('sync-pending-badge');
  const queue = getSyncQueue();
  const pendingCount = queue.length;

  container.classList.remove('status-online', 'status-syncing', 'status-offline');

  if (!navigator.onLine) {
    container.classList.add('status-offline');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'wifi-off');
      iconEl.style.animation = 'none';
    }
    if (textEl) textEl.textContent = 'Sin conexión';
    if (badgeEl) {
      if (pendingCount > 0) {
        badgeEl.textContent = pendingCount;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  } else if (pendingCount > 0) {
    container.classList.add('status-syncing');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'refresh-cw');
      iconEl.style.animation = 'spin 2s linear infinite';
    }
    if (textEl) textEl.textContent = _isProcessingQueue ? 'Sincronizando...' : 'Cambios pendientes';
    if (badgeEl) {
      badgeEl.textContent = pendingCount;
      badgeEl.style.display = 'inline-block';
    }
  } else {
    container.classList.add('status-online');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'wifi');
      iconEl.style.animation = 'none';
    }
    if (textEl) textEl.textContent = 'Conectado';
    if (badgeEl) {
      badgeEl.style.display = 'none';
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

window.forzarSincronizacionManual = function() {
  if (!navigator.onLine) {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('No se puede sincronizar sin conexión a internet.', 'warning');
    }
    return;
  }
  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Iniciando sincronización...', 'info');
  }
  processSyncQueue();
};

window.addEventListener('online', () => {
  console.log('[Network] Conexión detectada. Iniciando sincronización...');
  updateSyncStatusUI();
  processSyncQueue();
});

window.addEventListener('offline', () => {
  console.log('[Network] Conexión perdida. Modo local activado.');
  updateSyncStatusUI();
});

setInterval(() => {
  if (navigator.onLine && getSyncQueue().length > 0 && !_isProcessingQueue) {
    processSyncQueue();
  }
}, 30000);

// ─── migrarDatosASupabase: Al iniciar, sube datos locales si la nube está vacía ─

async function migrarDatosASupabase() {
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Supabase] Cliente no disponible al iniciar. Se saltará la migración.');
    return;
  }

  console.log('[Supabase] Iniciando migración/carga...');

  try {
    // ── 1. USUARIOS ──────────────────────────────────────────
    const { data: uSupa } = await sb.from('usuarios').select('id');
    const lUsu = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
    if ((!uSupa || uSupa.length <= 1) && lUsu.length > 0) {
      for (const u of lUsu) await window.pushToSupabase('usuarios', u);
    }

    // ── 2. CLIENTES ──────────────────────────────────────────
    const { data: cSupa } = await sb.from('clientes').select('id');
    const lCli = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    if ((!cSupa || cSupa.length === 0) && lCli.length > 0) {
      for (const c of lCli) await window.pushToSupabase('clientes', c);
    }

    // ── 3. TICKETS ───────────────────────────────────────────
    const { data: tSupa } = await sb.from('tickets').select('id');
    const lTik = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
    if ((!tSupa || tSupa.length === 0) && lTik.length > 0) {
      for (const t of lTik) await window.pushToSupabase('tickets', t);
    }

    // ── 4. ÓRDENES ───────────────────────────────────────────
    const { data: oSupa } = await sb.from('ordenes').select('id');
    const lOrd = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if ((!oSupa || oSupa.length === 0) && lOrd.length > 0) {
      for (const o of lOrd) await window.pushToSupabase('ordenes', o);
    }

    // NOTA: Sitios, Maquinaria y Refacciones se obtienen de SAP directamente.
    // No se migran a Supabase para evitar conflictos con IDs nulos de SAP.

    // ── 8. CONFIG ────────────────────────────────────────────
    const { data: cfgSupa } = await sb.from('config').select('id');
    const lCfg = JSON.parse(localStorage.getItem('eurorep_config') || 'null');
    if ((!cfgSupa || cfgSupa.length === 0) && lCfg) {
      await window.pushToSupabase('config', lCfg);
    }

    // ── 9. ROLES ─────────────────────────────────────────────
    const { data: rolSupa } = await sb.from('roles').select('id');
    const lRol = JSON.parse(localStorage.getItem('sapi_roles_config') || 'null');
    if ((!rolSupa || rolSupa.length === 0) && lRol) {
      await window.pushToSupabase('roles', lRol);
    }

    console.log('[Supabase] Migración completada. Descargando datos actuales...');
    await window.cargarDatosDeSupabase();

  } catch (err) {
    console.error('[Supabase] Error durante la migración:', err.message);
    // Aún así intentamos cargar lo que hay en la nube
    try { await window.cargarDatosDeSupabase(); } catch(e2) {}
  }
}

// ─── cargarDatosDeSupabase: Descarga la nube a localStorage / variables ─────

window.cargarDatosDeSupabase = async function() {
  const sb = window.supabaseClient;
  if (!sb) return;

  window._isSyncingFromSupabase = true;

  try {
    // Usuarios
    const { data: usuarios } = await sb.from('usuarios').select('*');
    if (usuarios && usuarios.length > 0) {
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
    }

    // Config y Saldos
    const { data: configDb } = await sb.from('config').select('*');
    let saldosSap = {};
    if (configDb && configDb.length > 0) {
      const mainCfg = configDb.find(c => c.id === 'main');
      if (mainCfg && mainCfg.data) {
        localStorage.setItem('eurorep_config', JSON.stringify(mainCfg.data));
      }
      const saldosCfg = configDb.find(c => c.id === 'saldos_sap');
      if (saldosCfg && saldosCfg.data) {
        saldosSap = saldosCfg.data;
      }
    }

    // Clientes
    const { data: clientes } = await sb.from('clientes').select('*');
    if (clientes && clientes.length > 0) {
      const localClientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
      const mergedClientes = clientes.map(c => {
        const row = rowToCliente(c);
        const local = localClientes.find(lc => lc.id === row.id);
        
        // Priorizar saldos_sap provenientes del backend background sync
        if (saldosSap[row.id]) {
          row.saldoCuenta = saldosSap[row.id].saldoCuenta || 0;
          row.saldoOrdenes = saldosSap[row.id].saldoOrdenes || 0;
        } else if (local) {
          row.saldoCuenta = local.saldoCuenta || 0;
          row.saldoOrdenes = local.saldoOrdenes || 0;
        } else {
          row.saldoCuenta = 0;
          row.saldoOrdenes = 0;
        }
        return row;
      });
      localStorage.setItem('sapi_clientes_db', JSON.stringify(mergedClientes));
    }

    // Tickets — SOLO sobreescribir local si la nube tiene tickets
    const { data: ticketsDb } = await sb.from('tickets').select('*');
    if (ticketsDb && ticketsDb.length > 0) {
      let mapped = ticketsDb.map(rowToTicket);
      
      // FUSIONAR CON CAMBIOS LOCALES PENDIENTES DE SINCRONIZAR
      const queue = getSyncQueue();
      const pendingTickets = queue.filter(item => item.table === 'tickets');
      pendingTickets.forEach(item => {
        if (item.action === 'upsert') {
          const idx = mapped.findIndex(t => t.id === item.data.id);
          if (idx > -1) {
            mapped[idx] = item.data;
          } else {
            mapped.unshift(item.data);
          }
        } else if (item.action === 'delete') {
          mapped = mapped.filter(t => t.id !== item.data.id);
        }
      });

      window._supaTickets = mapped;
      localStorage.setItem('sapi_tickets', JSON.stringify(mapped));
    } else {
      // Si la nube está vacía, respetamos el local (no borramos nada)
      window._supaTickets = null;
    }

    // Órdenes — mismo principio
    const { data: ordenes } = await sb.from('ordenes').select('*');
    if (ordenes && ordenes.length > 0) {
      let mapped = ordenes.map(rowToOrden);
      
      // FUSIONAR CON CAMBIOS LOCALES PENDIENTES DE SINCRONIZAR
      const queue = getSyncQueue();
      const pendingOrdenes = queue.filter(item => item.table === 'ordenes');
      pendingOrdenes.forEach(item => {
        if (item.action === 'upsert') {
          const idx = mapped.findIndex(o => o.id === item.data.id);
          if (idx > -1) {
            mapped[idx] = item.data;
          } else {
            mapped.unshift(item.data);
          }
        } else if (item.action === 'delete') {
          mapped = mapped.filter(o => o.id !== item.data.id);
        }
      });

      window._supaOrdenes = mapped;
      localStorage.setItem('sapi_ordenes', JSON.stringify(window._supaOrdenes));
    } else {
      window._supaOrdenes = null;
    }

    // Sitios
    const { data: sitiosDb } = await sb.from('sitios').select('*');
    if (sitiosDb && sitiosDb.length > 0) {
      const mapped = sitiosDb.map(s => ({ id: s.id, nombre: s.nombre, cliente: s.cliente, direccion: s.direccion, cp: s.cp, ciudad: s.ciudad, estado: s.estado, customData: s.custom_data }));
      localStorage.setItem('sapi_sitios_db', JSON.stringify(mapped));
    }

    // Maquinaria
    const { data: maqDb } = await sb.from('maquinaria').select('*');
    if (maqDb && maqDb.length > 0) {
      const mapped = maqDb.map(m => ({ id: m.id, serie: m.serie, marca: m.marca, modelo: m.modelo, anio: m.anio, cliente: m.cliente, idInterno: m.id_interno, descripcion: m.descripcion, customData: m.custom_data }));
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(mapped));
    }

    // Refacciones (con paginación para traer más de 1000 items)
    let allRefacciones = [];
    let fetchMore = true;
    let page = 0;
    while (fetchMore) {
      const { data: refDbChunk } = await sb.from('refacciones').select('*').range(page * 1000, (page + 1) * 1000 - 1);
      if (refDbChunk && refDbChunk.length > 0) {
        allRefacciones = allRefacciones.concat(refDbChunk);
        if (refDbChunk.length < 1000) fetchMore = false;
        else page++;
      } else {
        fetchMore = false;
      }
    }
    if (allRefacciones.length > 0) {
      const mapped = allRefacciones.map(r => ({
        id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, 
        customData: r.custom_data, marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
        grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
        ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
      }));
      localStorage.setItem('sapi_refacciones_db', JSON.stringify(mapped));
    }

    // La tabla config ahora se procesa arriba antes que clientes.

    // Roles
    const { data: rolesDb } = await sb.from('config').select('*').eq('id', 'roles');
    if (rolesDb && rolesDb.length > 0 && rolesDb[0].data) {
      localStorage.setItem('sapi_roles_config', JSON.stringify(rolesDb[0].data));
    }

  } catch (error) {
    console.error('[Supabase] Error cargando datos:', error.message);
  } finally {
    window._isSyncingFromSupabase = false;
    window.dispatchEvent(new Event('supabase_datos_cargados'));
    console.log('[Supabase] ✅ Carga completa. Evento "supabase_datos_cargados" disparado.');
  }
}

// ─── Realtime Subscriptions ──────────────────────────────────────────────────
function setupRealtime() {
  if (!window.supabaseClient) return;

  const handleUpdate = async (tableName) => {
    console.log(`[Supabase Realtime] Cambio detectado en la tabla: ${tableName}. Actualizando...`);
    const { data, error } = await window.supabaseClient.from(tableName).select('*');
    if (!error && data) {
      if (tableName === 'tickets') {
        const mapped = data.map(rowToTicket);
        localStorage.setItem('sapi_tickets', JSON.stringify(mapped));
        window._supaTickets = mapped;
      } else if (tableName === 'ordenes') {
        const mapped = data.map(rowToOrden);
        localStorage.setItem('sapi_ordenes', JSON.stringify(mapped));
        window._supaOrdenes = mapped;
      }
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    }
  };

  window.supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => handleUpdate('tickets'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => handleUpdate('ordenes'))
    .subscribe();
}

// ─── Arrancar cuando el DOM esté listo ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    migrarDatosASupabase();
    setupRealtime();
    updateSyncStatusUI();
    processSyncQueue();
  }, 300);
});
