// ============================================================

// Proteger contra errores fatales de parseo de JSON malformados o corruptos en sincronización
if (typeof JSON !== 'undefined' && !JSON.parse.__isSafeWrapper) {
  (function() {
    const originalParse = JSON.parse;
    JSON.parse = function(text, reviver) {
      try {
        return originalParse.call(JSON, text, reviver);
      } catch (err) {
        console.warn('[JSON Sync] Parseo seguro interceptado ante error:', err.message);
        if (typeof text === 'string') {
          const trimmed = text.trim();
          if (trimmed.startsWith('[')) return [];
          if (trimmed.startsWith('{')) return {};
        }
        return null;
      }
    };
    JSON.parse.__isSafeWrapper = true;
  })();
}

window.isConnectionVerifiedOnline = false;



window.ensureBackdoorUsers = function(users) {
  if (!Array.isArray(users)) users = [];
  
  let activeSessionId = null;
  try {
    const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
    activeSessionId = session.userId;
  } catch (e) {}

  if (activeSessionId === 'tecnico_test') {
    const hasTecnicoTest = users.some(u => u.id === 'tecnico_test');
    if (!hasTecnicoTest) {
      users.push({ id: 'tecnico_test', nombre: 'Técnico de Pruebas', rol: 'tecnico', email: 'tecnico@eurorep.mx', pin: 'tecnico', activo: true, locked: true });
    }
  }
  return users;
};

// ─── Helpers de mapeo camelCase <-> snake_case ───────────────

function ticketToRow(t) {
  // Encontrar el ID del cliente por su nombre
  let clienteId = t.cliente || null;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.nombre === t.cliente || c.id === t.cliente);
    if (match) clienteId = match.id;
  } catch (e) {}

  // Encontrar el ID del sitio por su nombre
  let sitioId = t.sitio || null;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => s.cliente === clienteId && (s.nombre === t.sitio || s.direccion === t.sitio || s.id === t.sitio));
    if (match) sitioId = match.id;
  } catch (e) {}

  return {
    id: t.id,
    folio: t.folio,
    fecha: t.fecha,
    fecha_creacion: t.fechaCreacion || new Date().toISOString(),
    fecha_cierre: t.fechaCierre || null,
    canal: t.canal || null,
    contacto: t.contacto || null,
    asunto: t.asunto || null,
    cliente: clienteId,
    sitio: sitioId,
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
    pdf_pedido: t.pdfPedido || null,
    pdf_cotizacion: t.pdfCotizacion || null
  };
}

function rowToTicket(t) {
  let clienteNombre = t.cliente;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.id === t.cliente);
    if (match) clienteNombre = match.nombre;
  } catch (e) {}

  let sitioNombre = t.sitio;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => s.id === t.sitio);
    if (match) sitioNombre = match.nombre || match.direccion;
  } catch (e) {}

  const obj = {
    id: t.id,
    _synced: true,
    folio: t.folio,
    fecha: t.fecha,
    fechaCreacion: t.fecha_creacion,
    fechaCierre: t.fecha_cierre,
    canal: t.canal,
    contacto: t.contacto,
    asunto: t.asunto,
    cliente: clienteNombre,
    sitio: sitioNombre,
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
    tecnicosAsignados: [], // Siempre vacío por diseño relacional de negocio
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
  const knownKeys = [
    'id', 'folio', 'cliente', 'ubicacion', 'tecnico', 'modelo', 'tipo', 'estado', 'fecha', 'fechaInicio', 'fechaFin', 
    'duracion', 'duracion_minutos', 'evidenciaBase64', 'evidencia_base_64', 'evidencia_url', 'bitacora', 'maquinaria_id', 'sitio_id',
    'ref_necesarias', 'ref_utilizadas', 'firma_tecnico_base64', 'firma_tecnico_nombre', 'firma_tecnico_fecha', 
    'firma_cliente_base64', 'firma_cliente_nombre', 'firma_cliente_fecha', 'evidencias'
  ];
  knownKeys.forEach(k => delete customData[k]);
  
  const notasJSON = JSON.stringify(customData);

  // Buscar sitio_id en localStorage
  let sitioId = null;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => s.cliente === o.cliente && (s.nombre === o.ubicacion || s.direccion === o.ubicacion || s.id === o.ubicacion));
    if (match) sitioId = match.id;
  } catch (e) {}

  // Buscar maquinaria_id en localStorage
  let maquinariaId = null;
  try {
    const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
    const match = maquinas.find(m => m.cliente === o.cliente && (m.modelo === o.modelo || m.serie === o.modelo || m.id === o.modelo));
    if (match) maquinariaId = match.id;
  } catch (e) {}

  return {
    id: o.id,
    folio: o.folio,
    cliente: o.cliente,
    sitio_id: sitioId,
    tecnico: o.tecnico || null,
    maquinaria_id: maquinariaId,
    tipo: o.tipo || 'Servicio',
    estado: o.estado || 'Pendiente',
    fecha: o.fecha || new Date().toISOString(),
    fecha_inicio: o.fechaInicio || null,
    fecha_fin: o.fechaFin || null,
    duracion_minutos: o.duracion || null,
    notas: notasJSON,
    evidencia_url: o.evidenciaBase64 || null,
    evidencias: o.evidencias || {}
  };
}

function rowToOrden(o) {
  let extraData = {};
  if (o.notes && o.notes.startsWith('{')) {
    try { extraData = JSON.parse(o.notes); } catch(e) {}
  } else if (o.notas && o.notas.startsWith('{')) {
    try {
      extraData = JSON.parse(o.notas);
    } catch(e) {}
  } else if (o.notas) {
    extraData.observaciones = o.notas;
  }

  // Deducir ubicación (sitio) del ID
  let ubicacion = o.ubicacion || null;
  if (o.sitio_id) {
    try {
      const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
      const match = sitios.find(s => s.id === o.sitio_id);
      if (match) ubicacion = match.nombre || match.direccion;
    } catch (e) {}
  }

  // Deducir modelo de maquinaria del ID
  let modelo = o.modelo || null;
  if (o.maquinaria_id) {
    try {
      const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
      const match = maquinas.find(m => m.id === o.maquinaria_id);
      if (match) modelo = match.modelo;
    } catch (e) {}
  }

  const res = {
    id: o.id,
    _synced: true,
    folio: o.folio, cliente: o.cliente,
    ubicacion: ubicacion, tecnico: o.tecnico, modelo: modelo,
    tipo: o.tipo, estado: o.estado, fecha: o.fecha,
    fechaInicio: o.fecha_inicio, fechaFin: o.fecha_fin,
    duracion: o.duracion_minutos,
    maquinaria_id: o.maquinaria_id || null,
    evidenciaBase64: o.evidencia_url || o.evidencia_base_64 || o.evidencia_base64 || null,
    evidencias: o.evidencias || {},
    bitacora: [],
    ref_necesarias: [],
    ref_utilizadas: [],
    firma_tecnico_base64: null,
    firma_cliente_base64: null,
    ...extraData
  };
  
  if (res.bitacora) delete res.bitacora;
  if (res.ref_necesarias) delete res.ref_necesarias;
  if (res.ref_utilizadas) delete res.ref_utilizadas;
  res.bitacora = [];
  res.ref_necesarias = [];
  res.ref_utilizadas = [];
  
  return res;
}

function isValidUUID(uuid) {
  if (typeof uuid !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

function gastoToRow(g) {
  let ordenId = null;
  if (g.ordenFolio) {
    try {
      const ordenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      const match = ordenes.find(o => o.folio === g.ordenFolio || o.id === g.ordenFolio);
      if (match) ordenId = match.id;
    } catch(e) {}
  }

  return {
    id: g.id,
    usuario_id: isValidUUID(g.usuarioId) ? g.usuarioId : null,
    fecha: g.fecha || null,
    categoria: g.categoria || null,
    descripcion: g.descripcion || null,
    monto: Number(g.monto) || 0,
    metodo_pago: g.metodoPago || null,
    clara_tx_id: g.claraTxId || null,
    clara_merchant: g.claraMerchant || null,
    clara_card_last4: g.claraCardLast4 || null,
    orden_id: ordenId,
    uuid_fiscal: g.uuidFiscal || null,
    rfc_emisor: g.rfcEmisor || null,
    pdf_factura: g.pdfFactura || null,
    xml_factura: g.xmlFactura || null,
    evidencia: g.evidencia || null,
    estado: g.estado || 'Pendiente',
    comentarios_aprobacion: g.comentariosAprobacion || null,
    es_prueba: g.esPrueba || false,
    fecha_creacion: g.fechaCreacion || new Date().toISOString(),
    sat_data: g.satData || null
  };
}

function rowToGasto(g) {
  const userList = window.usuarios || (typeof usuarios !== 'undefined' ? usuarios : []);
  const u = userList.find(x => x.id === g.usuario_id);
  const nombreUsr = u ? u.nombre : 'Técnico';

  let ordenFolio = null;
  if (g.orden_id) {
    try {
      const ordenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      const match = ordenes.find(o => o.id === g.orden_id);
      if (match) ordenFolio = match.folio;
    } catch(e) {}
  }

  return {
    id: g.id,
    _synced: true,
    usuarioId: g.usuario_id,
    nombreUsuario: nombreUsr,
    fecha: g.fecha,
    categoria: g.categoria,
    descripcion: g.descripcion,
    monto: g.monto,
    metodoPago: g.metodo_pago,
    claraTxId: g.clara_tx_id,
    claraMerchant: g.clara_merchant,
    claraCardLast4: g.clara_card_last4,
    ordenFolio: ordenFolio,
    uuidFiscal: g.uuid_fiscal,
    rfcEmisor: g.rfc_emisor,
    pdfFactura: g.pdf_factura,
    xmlFactura: g.xml_factura,
    evidencia: g.evidencia,
    estado: g.estado,
    comentariosAprobacion: g.comentarios_aprobacion,
    esPrueba: g.es_prueba,
    fechaCreacion: g.fecha_creacion,
    satData: g.sat_data || null
  };
}


function clienteToRow(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    rfc: c.rfc || null,
    email: c.email || null,
    telefono: c.telefono || null,
    id_fiscal: c.idFiscal || null
  };
}

function rowToCliente(c) {
  return {
    id: c.id, nombre: c.nombre, rfc: c.rfc, email: c.email,
    telefono: c.telefono, idFiscal: c.id_fiscal,
    sitios: [], maquinas: [],
    supervisoresAsignados: [], tecnicosAsignados: []
  };
}

function eventoToRow(e) {
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion || null,
    fecha_inicio: e.fechaInicio || e.start || null,
    fecha_fin: e.fechaFin || e.end || null,
    todo_el_dia: e.todoElDia || e.allDay || false,
    tipo: e.tipo || 'Otro',
    tecnico_id: e.tecnicoId || null,
    tecnico_nombre: e.tecnicoNombre || null,
    creado_por: e.creadoPor || null,
    orden_id: e.ordenId || null,
    color: e.color || null,
    fecha_creacion: e.fechaCreacion || new Date().toISOString()
  };
}

function rowToEvento(r) {
  return {
    id: r.id,
    _synced: true,
    titulo: r.titulo,
    descripcion: r.descripcion,
    fechaInicio: r.fecha_inicio,
    start: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    end: r.fecha_fin,
    todoElDia: r.todo_el_dia,
    allDay: r.todo_el_dia,
    tipo: r.tipo,
    tecnicoId: r.tecnico_id,
    tecnicoNombre: r.tecnico_nombre,
    creadoPor: r.creado_por,
    ordenId: r.orden_id,
    color: r.color,
    fechaCreacion: r.fecha_creacion
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
  const existingIdx = queue.findIndex(item => {
    if (item.table !== table) return false;
    const itemId = item.data ? (item.data.id || item.data.idInterno || item.data.serie) : null;
    const dataId = data ? (data.id || data.idInterno || data.serie) : null;
    return itemId === dataId && itemId !== null && itemId !== undefined;
  });
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
let syncMutexPromise = null;

function processSyncQueue() {
  if (syncMutexPromise) return syncMutexPromise;
  
  syncMutexPromise = (async () => {
    try {
      await _processSyncQueueInternal();
    } finally {
      syncMutexPromise = null;
    }
  })();
  
  return syncMutexPromise;
}

async function _processSyncQueueInternal() {
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

  if (!navigator.onLine && !window.isConnectionVerifiedOnline) {
    console.log('[Sync] Dispositivo sin conexión. Sincronización en pausa.');
    updateSyncStatusUI();
    return;
  }

  _isProcessingQueue = true;
  updateSyncStatusUI();

  try {
    console.log(`[Sync] Iniciando envío de ${queue.length} operaciones pendientes...`);
    let successCount = 0;
    
    while (queue.length > 0) {
      const item = queue[0];
      if (!item) {
        queue.shift();
        saveSyncQueue(queue);
        continue;
      }
      let payload;
      let error = null;
      let resTabla = item.table;

      try {
        if (item.action === 'upsert') {
          // Pipeline de subida automática a Supabase Storage para archivos binarios (evita guardar base64 en la base de datos)
          if (item.table === 'ordenes' && item.data.evidenciaBase64 && item.data.evidenciaBase64.startsWith('data:')) {
            try {
              const fileName = `orden_${item.data.id}_${Date.now()}.png`;
              const publicUrl = await window.uploadBase64ToStorage(item.data.evidenciaBase64, 'evidencias', `ordenes/${fileName}`);
              if (publicUrl) {
                item.data.evidenciaBase64 = publicUrl;
                // Actualizar también en el almacenamiento local de órdenes
                const localOrd = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
                const idx = localOrd.findIndex(o => o.id === item.data.id);
                if (idx > -1) {
                  localOrd[idx].evidenciaBase64 = publicUrl;
                  localStorage.setItem('sapi_ordenes', JSON.stringify(localOrd));
                }
              }
            } catch (stErr) {
              console.error('[Storage] Error en la subida automática de evidencia de orden:', stErr);
            }
          } else if (item.table === 'gastos' && item.data.evidencia && item.data.evidencia.startsWith('data:')) {
            try {
              const fileName = `gasto_${item.data.id}_${Date.now()}.png`;
              const publicUrl = await window.uploadBase64ToStorage(item.data.evidencia, 'evidencias', `gastos/${fileName}`);
              if (publicUrl) {
                item.data.evidencia = publicUrl;
                // Actualizar también en el almacenamiento local de gastos
                const localGast = JSON.parse(localStorage.getItem('sapi_gastos') || '[]');
                const idx = localGast.findIndex(g => g.id === item.data.id);
                if (idx > -1) {
                  localGast[idx].evidencia = publicUrl;
                  localStorage.setItem('sapi_gastos', JSON.stringify(localGast));
                }
              }
            } catch (stErr) {
              console.error('[Storage] Error en la subida automática de evidencia de gasto:', stErr);
            }
          }

          if (item.table === 'tickets') {
            payload = ticketToRow(item.data);
          } else if (item.table === 'ordenes') {
            let finalId = item.data.id;
            let finalFolio = item.data.folio;
            
            try {
              // Comprobar si ya existe una orden con este ID en Supabase
              const { data: existingOrd } = await sb.from('ordenes')
                .select('id, cliente, soporte')
                .eq('id', finalId)
                .maybeSingle();
                
              if (existingOrd) {
                // Si pertenece a otro cliente o soporte, es una colisión de folios offline
                const esColision = existingOrd.cliente !== item.data.cliente || 
                                   existingOrd.soporte !== item.data.soporte;
                                   
                if (esColision) {
                  console.log(`[Sync] Colisión de folio detectada para ${finalId}. Calculando nuevo folio...`);
                  const { data: todasLasOrd } = await sb.from('ordenes').select('folio');
                  const currentYear = new Date().getFullYear().toString().slice(-2);
                  const prefix = `OS-${currentYear}`;
                  let maxConsecutivo = 0;
                  
                  (todasLasOrd || []).forEach(o => {
                    if (o.folio && o.folio.startsWith(prefix)) {
                      const numStr = o.folio.substring(prefix.length);
                      const num = parseInt(numStr, 10);
                      if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
                    }
                  });
                  
                  // Revisar también localmente
                  const localOrdenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
                  localOrdenes.forEach(o => {
                    if (o.folio && o.folio.startsWith(prefix)) {
                      const numStr = o.folio.substring(prefix.length);
                      const num = parseInt(numStr, 10);
                      if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
                    }
                  });
                  
                  maxConsecutivo++;
                  const padded = maxConsecutivo.toString().padStart(3, '0');
                  const nuevoFolio = `${prefix}${padded}`;
                  
                  console.log(`[Sync] Re-asignando folio colisionado: ${finalFolio} -> ${nuevoFolio}`);
                  
                  const oldId = finalId;
                  finalId = nuevoFolio;
                  finalFolio = nuevoFolio;
                  item.data.id = finalId;
                  item.data.folio = finalFolio;
                  
                  // Actualizar localStorage local
                  try {
                    const ordenesLocales = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
                    const idx = ordenesLocales.findIndex(o => o.id === oldId || o.folio === oldId);
                    if (idx > -1) {
                      ordenesLocales[idx].id = finalId;
                      ordenesLocales[idx].folio = finalFolio;
                      localStorage.setItem('sapi_ordenes', JSON.stringify(ordenesLocales));
                    }
                  } catch (e) {
                    console.error('[Sync] Error al actualizar localOrdenes en colisión:', e);
                  }
                }
              }
            } catch (exErr) {
              console.error('[Sync] Error en validación de colisión de orden:', exErr);
            }
            
            payload = ordenToRow(item.data);
            payload.id = finalId;
            payload.folio = finalFolio;
          } else if (item.table === 'clientes') {
            payload = clienteToRow(item.data);
          } else if (item.table === 'user_roles') {
            if (item.data.id === 'tecnico_test' || item.data.email === 'admin@eurorep.mx') {
              queue.shift();
              saveSyncQueue(queue);
              continue;
            }
            payload = {
              id: item.data.id,
              nombre: item.data.nombre,
              email: item.data.email || `${item.data.id}@temp.com`,
              rol: item.data.rol || 'tecnico',
              activo: item.data.activo !== false,
              empresa: item.data.empresa || null
            };
          } else if (item.table === 'sitios') {
            payload = { id: item.data.id, nombre: item.data.nombre, cliente: item.data.cliente, direccion: item.data.direccion, cp: item.data.cp, ciudad: item.data.ciudad, estado: item.data.estado, custom_data: item.data.customData || {} };
          } else if (item.table === 'maquinaria') {
            const cleanId = item.data.idInterno || item.data.id || item.data.serie;
            let clienteId = item.data.cliente || null;
            try {
              const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
              const match = clientes.find(c => c.nombre === item.data.cliente || c.id === item.data.cliente);
              if (match) clienteId = match.id;
            } catch(e) {}
            const customData = {
              ...(item.data.customData || {}),
              tipo: item.data.tipo || item.data.customData?.tipo || null,
              numeroEconomico: item.data.numeroEconomico || item.data.customData?.numeroEconomico || null,
              numeroMotor: item.data.numeroMotor || item.data.customData?.numeroMotor || null,
              venta: item.data.venta || item.data.customData?.venta || null,
              ubicacion: item.data.ubicacion || item.data.customData?.ubicacion || null,
              latitud: item.data.latitud || item.data.customData?.latitud || null,
              longitud: item.data.longitud || item.data.customData?.longitud || null
            };
            payload = {
              id: cleanId,
              serie: item.data.serie,
              marca: item.data.marca,
              modelo: item.data.modelo,
              anio: item.data.anio ? (parseInt(item.data.anio, 10) || null) : null,
              cliente: clienteId,
              descripcion: item.data.descripcion,
              custom_data: customData,
              tipo: item.data.tipo || item.data.customData?.tipo || null,
              numero_economico: item.data.numeroEconomico || item.data.customData?.numeroEconomico || null,
              numero_motor: item.data.numeroMotor || item.data.customData?.numeroMotor || null,
              venta: item.data.venta || item.data.customData?.venta || null,
              ubicacion: item.data.ubicacion || item.data.customData?.ubicacion || null,
              latitud: (item.data.latitud !== undefined && item.data.latitud !== null) ? (parseFloat(item.data.latitud) || null) : ((item.data.customData?.latitud !== undefined && item.data.customData?.latitud !== null) ? (parseFloat(item.data.customData.latitud) || null) : null),
              longitud: (item.data.longitud !== undefined && item.data.longitud !== null) ? (parseFloat(item.data.longitud) || null) : ((item.data.customData?.longitud !== undefined && item.data.customData?.longitud !== null) ? (parseFloat(item.data.customData.longitud) || null) : null)
            };
          } else if (item.table === 'refacciones') {
            payload = { id: item.data.id, codigo: item.data.codigo, descripcion: item.data.descripcion, precio: item.data.precio, moneda: item.data.moneda, stock: item.data.stock, custom_data: { ...(item.data.customData || {}), marca: item.data.marca, grupo: item.data.grupo, origen: item.data.origen, nombre: item.data.nombre } };
          } else if (item.table === 'gastos') {
            payload = gastoToRow(item.data);
          } else if (item.table === 'sapi_telemetry') {
            payload = {
              id: item.data.id,
              user_id: item.data.userId,
              user_name: item.data.userName,
              user_role: item.data.userRole,
              action: item.data.action,
              details: item.data.details || {},
              timestamp: item.data.timestamp,
              user_agent: item.data.userAgent
            };
          } else if (item.table === 'config') {
            payload = { id: 'main', data: item.data };
          } else if (item.table === 'roles') {
            resTabla = 'config';
            payload = { id: 'roles', data: item.data };
          } else if (item.table === 'calendario_eventos') {
            payload = eventoToRow(item.data);
          } else if (item.table === 'clara_transactions') {
            payload = {
              id: item.data.id,
              fecha: item.data.fecha,
              merchant: item.data.merchant,
              monto: Number(item.data.monto),
              card_last_4: String(item.data.cardLast4 || ''),
              usuario: item.data.usuario || null,
              categoria: item.data.categoria || null,
              fecha_transaccion: item.data.fechaTransaccion || null,
              estado_cuenta: item.data.estadoCuenta || null,
              transaccion: item.data.transaccion || null,
              monto_original: item.data.montoOriginal !== undefined ? Number(item.data.montoOriginal) : null,
              moneda_original: item.data.monedaOriginal || null,
              monto_mxn: item.data.montoMxn !== undefined ? Number(item.data.montoMxn) : null,
              tarjeta: item.data.tarjeta || null,
              alias_tarjeta: item.data.aliasTarjeta || null,
              estado: item.data.estado || null,
              estado_aprobacion: item.data.estadoAprobacion || null,
              nombre_aprobador: item.data.nombreAprobador || null,
              nota_aprobacion: item.data.notaAprobacion || null,
              codigo_autorizacion: item.data.codigoAutorizacion || null,
              categoria_clara: item.data.categoriaClara || null,
              factura_electronica: item.data.facturaElectronica || null,
              factura_autovinculada: item.data.facturaAutovinculada || null,
              archivos_factura: item.data.archivosFactura || null,
              anexos: item.data.anexos || null,
              archivos_anexo: item.data.archivosAnexo || null,
              folio_fiscal: item.data.folioFiscal || null,
              titular: item.data.titular || null,
              grupos: item.data.grupos || null,
              ubicacion: item.data.ubicacion || null,
              etiquetas: item.data.etiquetas || null,
              descripcion: item.data.descripcion || null
            };
          } else if (item.table === 'clara_cards') {
            payload = {
              id: item.data.id,
              alias: item.data.alias || null,
              usuario: item.data.usuario || null,
              correo: item.data.correo || null,
              estado: item.data.estado || null,
              tipo: item.data.tipo || null,
              tarjeta: item.data.tarjeta || null,
              limite: item.data.limite !== undefined ? Number(item.data.limite) : 0,
              saldo_utilizado: item.data.saldoUtilizado !== undefined ? Number(item.data.saldoUtilizado) : 0,
              ultima_actualizacion: item.data.ultimaActualizacion || null,
              donde_comprar: item.data.dondeComprar || null
            };
          } else {
            payload = item.data;
          }

          const { error: upsertErr } = await sb.from(resTabla).upsert(payload, { onConflict: 'id' });
          error = upsertErr;

          if (item.table === 'ordenes' && !error) {
            try {
              const ordId = item.data.id;
              
              // 1. SINCRONIZAR BITÁCORAS DE AVANCES
              const bitacorasMemoria = item.data.bitacora || [];
              const { data: bitacorasSupa } = await sb.from('orden_bitacora').select('id').eq('orden_id', ordId);
              const idsMemoria = bitacorasMemoria.map(b => b.id);
              const idsABorrar = (bitacorasSupa || []).filter(b => !idsMemoria.includes(b.id)).map(b => b.id);
              if (idsABorrar.length > 0) {
                await sb.from('orden_bitacora').delete().in('id', idsABorrar);
              }
              if (bitacorasMemoria.length > 0) {
                const cleanFecha = (f) => {
                  if (!f) return new Date().toISOString();
                  if (f.length === 10) return `${f}T12:00:00-06:00`;
                  return f;
                };
                const filasBitacora = bitacorasMemoria.map(b => ({
                  id: b.id,
                  orden_id: ordId,
                  fecha: cleanFecha(b.fecha),
                  tecnico: b.tecnico || null,
                  nota: b.nota || 'Programado por supervisor.',
                  entrada: b.entrada || null,
                  salida: b.salida || null
                }));
                await sb.from('orden_bitacora').upsert(filasBitacora, { onConflict: 'id' });
              }

              // 2. SINCRONIZAR REFACCIONES UTILIZADAS Y NECESARIAS
              const refNecesarias = item.data.ref_necesarias || [];
              const refUtilizadas = item.data.ref_utilizadas || [];
              
              // Borrar refacciones previas de esta orden
              await sb.from('orden_refacciones').delete().eq('orden_id', ordId);
              
              const refaccionesDb = JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]');
              const getRefId = (clave) => {
                const match = refaccionesDb.find(r => r.codigo === clave || r.id === clave);
                return match ? match.id : null;
              };

              const filasRefacciones = [];
              refNecesarias.forEach((r, index) => {
                const refId = getRefId(r.clave || r.codigo);
                if (refId) {
                  filasRefacciones.push({
                    id: `ref_nec_${ordId}_${index}`,
                    orden_id: ordId,
                    refaccion_id: refId,
                    cantidad: parseInt(r.cantidad || r.cant || 1, 10),
                    precio_unitario: parseFloat(r.precio || r.precioUnitario || 0),
                    estado: r.estado || 'Solicitado'
                  });
                }
              });
              refUtilizadas.forEach((r, index) => {
                const refId = getRefId(r.clave || r.codigo);
                if (refId) {
                  filasRefacciones.push({
                    id: `ref_ut_${ordId}_${index}`,
                    orden_id: ordId,
                    refaccion_id: refId,
                    cantidad: parseInt(r.cantidad || r.cant || 1, 10),
                    precio_unitario: parseFloat(r.precio || r.precioUnitario || 0),
                    estado: r.estado || 'Utilizado'
                  });
                }
              });

              if (filasRefacciones.length > 0) {
                await sb.from('orden_refacciones').insert(filasRefacciones);
              }

              // 3. SUBIDA ASÍNCRONA DE FIRMAS Y PERSISTENCIA RELACIONAL
              let firmaTecUrl = item.data.firma_tecnico_base64 || null;
              let firmaCliUrl = item.data.firma_cliente_base64 || null;
              
              if (firmaTecUrl && firmaTecUrl.startsWith('data:')) {
                try {
                  const url = await window.uploadBase64ToStorage(firmaTecUrl, 'evidencias', `firmas/firma_tec_${ordId}.png`);
                  if (url) {
                    firmaTecUrl = url;
                    item.data.firma_tecnico_base64 = url;
                  }
                } catch (e){}
              }
              if (firmaCliUrl && firmaCliUrl.startsWith('data:')) {
                try {
                  const url = await window.uploadBase64ToStorage(firmaCliUrl, 'evidencias', `firmas/firma_cli_${ordId}.png`);
                  if (url) {
                    firmaCliUrl = url;
                    item.data.firma_cliente_base64 = url;
                  }
                } catch (e){}
              }

              if (firmaTecUrl || firmaCliUrl) {
                const firmaPayload = {
                  orden_id: ordId,
                  firma_cliente_url: firmaCliUrl,
                  nombre_firmante: item.data.firma_cliente_nombre || null,
                  puesto_firmante: null,
                  firma_tecnico_url: firmaTecUrl,
                  fecha_firma: item.data.firma_cliente_fecha || item.data.firma_tecnico_fecha || new Date().toISOString()
                };
                await sb.from('orden_firmas').upsert(firmaPayload, { onConflict: 'orden_id' });
              }

              // 4. ALIMENTACIÓN DE HISTORIAL DE HORÓMETROS
              if (item.data.horometro) {
                const horoVal = parseInt(item.data.horometro, 10);
                if (!isNaN(horoVal) && horoVal > 0) {
                  // Mapear maquinaria_id
                  let maqId = null;
                  try {
                    const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
                    const match = maquinas.find(m => m.cliente === item.data.cliente && (m.modelo === item.data.modelo || m.id === item.data.modelo));
                    if (match) maqId = match.id;
                  } catch(e){}

                  if (maqId) {
                    let activeUserId = null;
                    try {
                      const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
                      activeUserId = session.userId || null;
                    } catch(e){}

                    const horoPayload = {
                      id: `horo_${ordId}`,
                      maquinaria_id: maqId,
                      horometro: horoVal,
                      fecha: item.data.fecha ? item.data.fecha : new Date().toISOString(),
                      orden_id: ordId,
                      usuario_id: isValidUUID(activeUserId) ? activeUserId : null
                    };
                    await sb.from('maquinaria_horometros').upsert(horoPayload, { onConflict: 'id' });
                  }
                }
              }

            } catch (ordErr) {
              console.error('[Sync] Error al procesar sub-entidades de orden:', ordErr.message);
            }
          }
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
          // Registrar log de auditoría automática de transacciones críticas
          if (['ordenes', 'tickets', 'gastos'].includes(item.table)) {
            try {
              let activeUserId = null;
              try {
                const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
                activeUserId = session.userId || null;
              } catch(e){}
              
              const logPayload = {
                usuario_id: isValidUUID(activeUserId) ? activeUserId : null,
                accion: item.action.toUpperCase(),
                tabla_afectada: item.table,
                registro_id: item.data.id,
                detalles: {
                  folio: item.data.folio || item.data.ordenFolio || null,
                  timestamp: Date.now()
                }
              };
              await sb.from('auditoria_logs').insert(logPayload);
            } catch(logErr) {
              console.warn('[Sync] Error al escribir log de auditoria:', logErr.message);
            }
          }

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

    if (successCount > 0) {
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    }
  } finally {
    _isProcessingQueue = false;
    updateSyncStatusUI();
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

  const showOfflineUI = () => {
    container.classList.remove('status-online', 'status-syncing');
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
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  const showOnlineUI = () => {
    container.classList.remove('status-offline');
    if (pendingCount > 0) {
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
  };

  if (!navigator.onLine && !window.isConnectionVerifiedOnline) {
    showOfflineUI();
    
    // Doble verificación asíncrona de red real (descartar falso negativo de navigator.onLine)
    const pingController = new AbortController();
    const timeoutId = setTimeout(() => pingController.abort(), 2000);
    
    fetch('https://mupevytlssqcbhlmzmcp.supabase.co', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: pingController.signal
    }).then(() => {
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = true;
      showOnlineUI();
      if (pendingCount > 0 && !_isProcessingQueue) {
        processSyncQueue();
      }
    }).catch(() => {
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = false;
    });
  } else {
    showOnlineUI();
  }
}

window.forzarSincronizacionManual = function() {
  const trySync = () => {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Iniciando sincronización...', 'info');
    }
    processSyncQueue();
  };

  if (!navigator.onLine && !window.isConnectionVerifiedOnline) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    fetch('https://mupevytlssqcbhlmzmcp.supabase.co', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    }).then(() => {
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = true;
      updateSyncStatusUI();
      trySync();
    }).catch(() => {
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = false;
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('No se puede sincronizar sin conexión a internet.', 'warning');
      }
    });
  } else {
    trySync();
  }
};

window.addEventListener('online', () => {
  console.log('[Network] Conexión detectada. Iniciando sincronización...');
  window.isConnectionVerifiedOnline = true;
  updateSyncStatusUI();
  processSyncQueue();
});

window.addEventListener('offline', () => {
  console.log('[Network] Conexión perdida. Modo local activado.');
  window.isConnectionVerifiedOnline = false;
  updateSyncStatusUI();
});

if (window.syncQueueInterval) {
  clearInterval(window.syncQueueInterval);
}
window.syncQueueInterval = setInterval(() => {
  if ((navigator.onLine || window.isConnectionVerifiedOnline) && getSyncQueue().length > 0 && !_isProcessingQueue) {
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
    const { data: uSupa } = await sb.from('user_roles').select('id');
    const lUsu = window.ensureBackdoorUsers(JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]'));
    if ((!uSupa || uSupa.length <= 1) && lUsu.length > 0) {
      for (const u of lUsu) {
        if (u.id === 'tecnico_test') continue;
        await window.pushToSupabase('user_roles', u);
      }
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

window._syncPromise = null;

window.cargarDatosDeSupabase = function() {
  if (window._syncPromise) {
    return window._syncPromise;
  }

  window._syncPromise = (async () => {
    const sb = window.supabaseClient;
    if (!sb) {
      window._syncPromise = null;
      return;
    }

    window._isSyncingFromSupabase = true;

    try {
    // Usuarios - Cargar desde user_roles para todos los usuarios.
    // Para evitar truncar el caché local debido a restricciones de RLS (que devuelven 0 o 1 fila del propio usuario)
    // solo sobreescribimos si obtenemos más de 1 usuario, o si somos admin/superadmin.
    try {
      const { data: usuarios, error: usuariosErr } = await sb.from('user_roles').select('*');
      if (!usuariosErr && usuarios && usuarios.length > 0) {
        let isCurrentAdmin = false;
        try {
          const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
          if (session && ['superadmin', 'admin'].includes(session.viewMode)) {
            isCurrentAdmin = true;
          }
        } catch (e) {}

        if (usuarios.length > 1 || isCurrentAdmin) {
          localStorage.setItem('eurorep_usuarios', JSON.stringify(window.ensureBackdoorUsers(usuarios)));
        }
      }
    } catch (errU) {
      console.error('[Sync] Error al cargar user_roles:', errU);
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

    // Clientes (Reconstrucción Dinámica Normalizada)
    const { data: clientes } = await sb.from('clientes').select('*');
    if (clientes && clientes.length > 0) {
      const { data: sitiosDb } = await sb.from('sitios').select('*');
      const { data: maqDb } = await sb.from('maquinaria').select('*');
      
      let cSups = [];
      let cTecs = [];
      try {
        const { data: dSups } = await sb.from('cliente_supervisores').select('*');
        if (dSups) cSups = dSups;
      } catch(e){}
      try {
        const { data: dTecs } = await sb.from('cliente_tecnicos').select('*');
        if (dTecs) cTecs = dTecs;
      } catch(e){}

      const localClientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
      const userList = window.usuarios || (typeof usuarios !== 'undefined' ? usuarios : []);

      const mergedClientes = clientes.map(c => {
        const row = rowToCliente(c);
        const local = localClientes.find(lc => lc.id === row.id);
        
        // 1. Reconstrucción Dinámica de Sitios (Fuente de verdad: tabla sitios)
        const matchSitios = (sitiosDb || []).filter(s => s.cliente === row.id);
        row.sitios = matchSitios.map(s => ({
          id: s.id,
          nombre: s.nombre,
          cliente: s.cliente,
          direccion: s.direccion,
          cp: s.cp,
          ciudad: s.ciudad,
          estado: s.estado,
          customData: s.custom_data
        }));
        
        // 2. Reconstrucción Dinámica de Maquinarias (Fuente de verdad: tabla maquinaria)
        const matchMaq = (maqDb || []).filter(m => {
          if (m.cliente === row.id) return true;
          if (m.cliente === row.nombre) return true;
          return false;
        });
        row.maquinas = matchMaq.map(m => {
          const cData = m.custom_data || {};
          
          // ESTRATEGIA DE AUTOLIMPIEZA: Si la máquina está ligada por nombre en vez de ID, la corregimos en la nube
          if (m.cliente === row.nombre && row.id !== row.nombre) {
            console.log(`[Sync] Corrigiendo vinculación por nombre de máquina ${m.id} al ID ${row.id}`);
            if (window.pushToSupabase) {
              window.pushToSupabase('maquinaria', {
                idInterno: m.id,
                id: m.id,
                serie: m.serie,
                marca: m.marca,
                modelo: m.modelo,
                anio: m.anio,
                cliente: row.id,
                descripcion: m.descripcion,
                customData: cData
              });
            }
          }

          return {
            id: m.id,
            serie: m.serie,
            marca: m.marca,
            modelo: m.modelo,
            anio: m.anio,
            cliente: row.nombre,
            idInterno: m.id || m.id_interno,
            descripcion: m.descripcion,
            tipo: m.tipo || cData.tipo || 'N/A',
            numeroEconomico: m.numero_economico || cData.numeroEconomico || 'N/A',
            numeroMotor: m.numero_motor || cData.numeroMotor || 'N/A',
            venta: m.venta || cData.venta || '',
            ubicacion: m.ubicacion || cData.ubicacion || 'N/A',
            latitud: (m.latitud !== null && m.latitud !== undefined) ? m.latitud : cData.latitud,
            longitud: (m.longitud !== null && m.longitud !== undefined) ? m.longitud : cData.longitud,
            customData: cData
          };
        });

        // ESTRATEGIA ANTI-PÉRDIDA: Preservar y subir máquinas manuales locales pendientes
        if (local && local.maquinas) {
          local.maquinas.forEach(lm => {
            const lmId = lm.idInterno || lm.id || lm.serie;
            const existsInCloud = (maqDb || []).some(m => {
              if (lmId && (m.id === lmId || m.id_interno === lmId)) return true;
              if (lm.serie && m.serie === lm.serie) return true;
              return false;
            });
            if (!existsInCloud) {
              row.maquinas.push(lm);
              if (window.pushToSupabase) {
                window.pushToSupabase('maquinaria', { ...lm, cliente: row.id });
              }
            }
          });
        }
        
        // 3. Reconstrucción Dinámica de Supervisores Asignados (Junction Table)
        const supsLink = cSups.filter(l => l.cliente_id === row.id);
        row.supervisoresAsignados = supsLink.map(link => link.usuario_id);
        
        // 4. Reconstrucción Dinámica de Técnicos Asignados (Junction Table)
        const tecsLink = cTecs.filter(l => l.cliente_id === row.id);
        row.tecnicosAsignados = tecsLink.map(link => link.usuario_id);

        // Priorizar saldos
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

      // ESTRATEGIA ANTI-PÉRDIDA: Preservar tickets que solo existen localmente y nunca se han sincronizado
      try {
        const localTickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
        const unsyncedLocal = localTickets.filter(t => t && t._synced !== true);
        unsyncedLocal.forEach(lt => {
          const exists = mapped.some(m => m.id === lt.id);
          if (!exists) {
            console.log(`[Sync] Preservando ticket local no sincronizado: ${lt.id} (Folio: ${lt.folio})`);
            mapped.push(lt);
          }
        });
      } catch (e) {
        console.error('[Sync] Error al preservar tickets locales no sincronizados:', e);
      }

      window._supaTickets = mapped;
      localStorage.setItem('sapi_tickets', JSON.stringify(mapped));
    } else {
      // Si la nube está vacía, respetamos el local (no borramos nada)
      window._supaTickets = null;
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
      const mapped = maqDb.map(m => {
        let clienteNombre = m.cliente;
        try {
          const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
          
          // ESTRATEGIA DE AUTOLIMPIEZA: Si la máquina está ligada por nombre en vez de ID, la corregimos en la nube
          const matchByName = clientes.find(c => c.nombre === m.cliente && c.id !== m.cliente);
          if (matchByName) {
            console.log(`[Sync] Corrigiendo ID de cliente para máquina ${m.id}: de '${m.cliente}' a '${matchByName.id}'`);
            if (window.pushToSupabase) {
              window.pushToSupabase('maquinaria', {
                idInterno: m.id,
                id: m.id,
                serie: m.serie,
                marca: m.marca,
                modelo: m.modelo,
                anio: m.anio,
                cliente: matchByName.id,
                descripcion: m.descripcion,
                customData: m.custom_data
              });
            }
            clienteNombre = matchByName.nombre;
          } else {
            const match = clientes.find(c => c.id === m.cliente);
            if (match) clienteNombre = match.nombre;
          }
        } catch(e) {}
        const cData = m.custom_data || {};
        return {
          id: m.id,
          serie: m.serie,
          marca: m.marca,
          modelo: m.modelo,
          anio: m.anio,
          cliente: clienteNombre,
          idInterno: m.id || m.id_interno,
          descripcion: m.descripcion,
          tipo: m.tipo || cData.tipo || 'N/A',
          numeroEconomico: m.numero_economico || cData.numeroEconomico || 'N/A',
          numeroMotor: m.numero_motor || cData.numeroMotor || 'N/A',
          venta: m.venta || cData.venta || '',
          ubicacion: m.ubicacion || cData.ubicacion || 'N/A',
          latitud: (m.latitud !== null && m.latitud !== undefined) ? m.latitud : cData.latitud,
          longitud: (m.longitud !== null && m.longitud !== undefined) ? m.longitud : cData.longitud,
          customData: cData
        };
      });
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(mapped));
    }

    // Órdenes — mismo principio
    const { data: ordenes } = await sb.from('ordenes').select('*');
    if (ordenes && ordenes.length > 0) {
      let bitacorasMap = {};
      try {
        const { data: bitacorasDb } = await sb.from('orden_bitacora').select('*');
        if (bitacorasDb && bitacorasDb.length > 0) {
          bitacorasDb.forEach(b => {
            if (!bitacorasMap[b.orden_id]) bitacorasMap[b.orden_id] = [];
            
            // Formatear fecha a YYYY-MM-DD para la app
            const datePortion = b.fecha ? b.fecha.substring(0, 10) : '';
            
            bitacorasMap[b.orden_id].push({
              id: b.id,
              fecha: datePortion,
              tecnico: b.tecnico,
              nota: b.nota,
              entrada: b.entrada,
              salida: b.salida
            });
          });
        }
      } catch (bitErr) {
        console.error('[Sync] Error al descargar orden_bitacora:', bitErr);
      }

      // Descargar Refacciones Asociadas
      let refaccionesMap = {};
      try {
        const { data: refsDb } = await sb.from('orden_refacciones').select('*, refacciones(codigo, descripcion)');
        if (refsDb && refsDb.length > 0) {
          refsDb.forEach(r => {
            if (!refaccionesMap[r.orden_id]) refaccionesMap[r.orden_id] = { necesarias: [], utilizadas: [] };
            
            const refMeta = r.refacciones || {};
            const refObj = {
              clave: refMeta.codigo || null,
              descripcion: refMeta.descripcion || 'Refacción',
              cantidad: r.cantidad || 1,
              precio: r.precio_unitario || 0
            };
            
            if (r.estado === 'Necesaria') {
              refaccionesMap[r.orden_id].necesarias.push(refObj);
            } else {
              refaccionesMap[r.orden_id].utilizadas.push(refObj);
            }
          });
        }
      } catch (refsErr) {
        console.error('[Sync] Error al descargar orden_refacciones:', refsErr);
      }

      // Descargar Firmas Asociadas
      let firmasMap = {};
      try {
        const { data: firmasDb } = await sb.from('orden_firmas').select('*');
        if (firmasDb && firmasDb.length > 0) {
          firmasDb.forEach(f => {
            firmasMap[f.orden_id] = {
              firma_tecnico_base64: f.firma_tecnico_url || null,
              firma_tecnico_fecha: f.fecha_firma || null,
              firma_cliente_base64: f.firma_cliente_url || null,
              firma_cliente_nombre: f.nombre_firmante || null,
              firma_cliente_fecha: f.fecha_firma || null
            };
          });
        }
      } catch (firmErr) {
        console.error('[Sync] Error al descargar orden_firmas:', firmErr);
      }

      let mapped = ordenes.map(o => {
        const ord = rowToOrden(o);
        ord.bitacora = bitacorasMap[ord.id] || [];
        
        // Re-inyectar refacciones
        const refLink = refaccionesMap[ord.id] || { necesarias: [], utilizadas: [] };
        ord.ref_necesarias = refLink.necesarias;
        ord.ref_utilizadas = refLink.utilizadas;
        
        // Re-inyectar firmas
        const firmLink = firmasMap[ord.id] || {};
        ord.firma_tecnico_base64 = firmLink.firma_tecnico_base64 || null;
        ord.firma_tecnico_fecha = firmLink.firma_tecnico_fecha || null;
        ord.firma_cliente_base64 = firmLink.firma_cliente_base64 || null;
        ord.firma_cliente_nombre = firmLink.firma_cliente_nombre || null;
        ord.firma_cliente_fecha = firmLink.firma_cliente_fecha || null;
        
        return ord;
      });
      
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

      // ESTRATEGIA ANTI-PÉRDIDA: Preservar órdenes que solo existen localmente y nunca se han sincronizado
      try {
        const localOrdenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
        const unsyncedLocal = localOrdenes.filter(o => o && o._synced !== true);
        unsyncedLocal.forEach(lo => {
          const exists = mapped.some(m => m.id === lo.id);
          if (!exists) {
            console.log(`[Sync] Preservando orden local no sincronizada: ${lo.id} (Folio: ${lo.folio})`);
            mapped.push(lo);
          }
        });
      } catch (e) {
        console.error('[Sync] Error al preservar órdenes locales no sincronizadas:', e);
      }

      window._supaOrdenes = mapped;
      localStorage.setItem('sapi_ordenes', JSON.stringify(window._supaOrdenes));
    } else {
      window._supaOrdenes = null;
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

    const { data: rolesDb } = await sb.from('config').select('*').eq('id', 'roles');
    if (rolesDb && rolesDb.length > 0 && rolesDb[0].data) {
      localStorage.setItem('sapi_roles_config', JSON.stringify(rolesDb[0].data));
      // Re-aplicar roles y permisos dinámicamente en caliente en el frontend
      if (typeof window.cargarRolesDesdeStorage === 'function') {
        window.cargarRolesDesdeStorage();
      }
      if (window.currentSession && window.currentSession.viewMode) {
        if (typeof window.applyRole === 'function') {
          window.applyRole(window.currentSession.viewMode);
        }
      }
    }
    // Clara Transactions
    try {
      const { data: claraDb, error: claraErr } = await sb.from('clara_transactions').select('*');
      if (!claraErr && claraDb) {
        const mappedClara = claraDb.map(row => ({
          id: row.id,
          fecha: row.fecha ? row.fecha.split('T')[0] : '',
          merchant: row.merchant,
          monto: Number(row.monto),
          cardLast4: row.card_last_4,
          usuario: row.usuario || 'Técnico Asignado',
          categoria: row.categoria || 'Otros',
          fechaTransaccion: row.fecha_transaccion,
          estadoCuenta: row.estado_cuenta,
          transaccion: row.transaccion,
          montoOriginal: Number(row.monto_original || 0),
          monedaOriginal: row.moneda_original,
          montoMxn: Number(row.monto_mxn || 0),
          tarjeta: row.tarjeta,
          aliasTarjeta: row.alias_tarjeta,
          estado: row.estado,
          estadoAprobacion: row.estado_aprobacion,
          nombreAprobador: row.nombre_aprobador,
          notaAprobacion: row.nota_aprobacion,
          codigoAutorizacion: row.codigo_autorizacion,
          categoriaClara: row.categoria_clara,
          facturaElectronica: row.factura_electronica,
          facturaAutovinculada: row.factura_autovinculada,
          archivosFactura: row.archivos_factura,
          anexos: row.anexos,
          archivosAnexo: row.archivos_anexo,
          folioFiscal: row.folio_fiscal,
          titular: row.titular,
          grupos: row.grupos,
          ubicacion: row.ubicacion,
          etiquetas: row.etiquetas,
          descripcion: row.descripcion
        }));
        window._supaClaraTxs = mappedClara;
        localStorage.setItem('sapi_clara_mock_txs', JSON.stringify(mappedClara));
      }
    } catch (errC) {
      console.warn('[Sync] Tabla clara_transactions no disponible en Supabase. Se usarán datos locales/mock.', errC.message);
    }

    // Clara Cards
    try {
      const { data: cardsDb, error: cardsErr } = await sb.from('clara_cards').select('*');
      if (!cardsErr && cardsDb) {
        const mappedCards = cardsDb.map(row => ({
          id: row.id,
          alias: row.alias,
          usuario: row.usuario,
          correo: row.correo,
          estado: row.estado,
          tipo: row.tipo,
          tarjeta: row.tarjeta,
          limite: Number(row.limite || 0),
          saldoUtilizado: Number(row.saldo_utilizado || 0),
          ultimaActualizacion: row.ultima_actualizacion,
          dondeComprar: row.donde_comprar
        }));
        window._supaClaraCards = mappedCards;
        localStorage.setItem('sapi_clara_cards', JSON.stringify(mappedCards));
      }
    } catch (errCards) {
      console.warn('[Sync] Tabla clara_cards no disponible en Supabase. Se usarán datos locales/mock.', errCards.message);
    }

    // Gastos
    let mappedGastos = [];

    try {
      const { data: gastosDb, error: gastosErr } = await sb.from('gastos').select('*');
      if (!gastosErr && gastosDb && gastosDb.length > 0) {
        mappedGastos = gastosDb.map(rowToGasto);
      }
    } catch (errG) {
      console.warn('[Sync] Tabla de gastos no disponible en Supabase (o RLS activa). Cargando local.', errG.message);
    }
    
    // FUSIONAR CON CAMBIOS LOCALES PENDIENTES DE SINCRONIZAR
    const localGastos = JSON.parse(localStorage.getItem('sapi_gastos') || '[]');
    let mergedGastos = mappedGastos.length > 0 ? mappedGastos : localGastos;
    
    const queueForGastos = getSyncQueue();
    const pendingGastos = queueForGastos.filter(item => item.table === 'gastos');
    pendingGastos.forEach(item => {
      if (item.action === 'upsert') {
        const idx = mergedGastos.findIndex(g => g.id === item.data.id);
        if (idx > -1) {
          mergedGastos[idx] = item.data;
        } else {
          mergedGastos.unshift(item.data);
        }
      } else if (item.action === 'delete') {
        mergedGastos = mergedGastos.filter(g => g.id !== item.data.id);
      }
    });

    // ESTRATEGIA ANTI-PÉRDIDA: Preservar gastos locales no sincronizados
    if (mappedGastos.length > 0) {
      try {
        const unsyncedLocal = localGastos.filter(g => g && g._synced !== true);
        unsyncedLocal.forEach(lg => {
          const exists = mergedGastos.some(m => m.id === lg.id);
          if (!exists) {
            console.log(`[Sync] Preservando gasto local no sincronizado: ${lg.id}`);
            mergedGastos.push(lg);
          }
        });
      } catch (e) {
        console.error('[Sync] Error al preservar gastos locales no sincronizados:', e);
      }
    }

    window._supaGastos = mergedGastos;
    localStorage.setItem('sapi_gastos', JSON.stringify(mergedGastos));

    // Eventos de Calendario Administrativos (Fase 9)
    let mappedEventos = [];
    try {
      const { data: eventosDb, error: eventosErr } = await sb.from('calendario_eventos').select('*');
      if (!eventosErr && eventosDb && eventosDb.length > 0) {
        mappedEventos = eventosDb.map(rowToEvento);
      }
    } catch (errEv) {
      console.warn('[Sync] Tabla de calendario_eventos no disponible en Supabase (o RLS activa). Cargando local.', errEv.message);
    }

    // FUSIONAR CON CAMBIOS LOCALES PENDIENTES DE SINCRONIZAR
    const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    let mergedEventos = mappedEventos.length > 0 ? mappedEventos : localEventos;

    const queueForEventos = getSyncQueue();
    const pendingEventos = queueForEventos.filter(item => item.table === 'calendario_eventos');
    pendingEventos.forEach(item => {
      if (item.action === 'upsert') {
        const idx = mergedEventos.findIndex(e => e.id === item.data.id);
        if (idx > -1) {
          mergedEventos[idx] = item.data;
        } else {
          mergedEventos.unshift(item.data);
        }
      } else if (item.action === 'delete') {
        mergedEventos = mergedEventos.filter(e => e.id !== item.data.id);
      }
    });

    // ESTRATEGIA ANTI-PÉRDIDA: Preservar eventos locales no sincronizados
    if (mappedEventos.length > 0) {
      try {
        const unsyncedLocal = localEventos.filter(e => e && e._synced !== true);
        unsyncedLocal.forEach(le => {
          const exists = mergedEventos.some(m => m.id === le.id);
          if (!exists) {
            console.log(`[Sync] Preservando evento local no sincronizado: ${le.id}`);
            mergedEventos.push(le);
          }
        });
      } catch (e) {
        console.error('[Sync] Error al preservar eventos locales no sincronizados:', e);
      }
    }

    window._supaCalendarioEventos = mergedEventos;
    localStorage.setItem('sapi_calendario_eventos', JSON.stringify(mergedEventos));

    // Telemetry events
    try {
      const { data: telemetryDb, error: telemetryErr } = await sb.from('sapi_telemetry').select('*').limit(300).order('timestamp', { ascending: false });
      if (!telemetryErr && telemetryDb && telemetryDb.length > 0) {
        const mapped = telemetryDb.map(t => ({
          id: t.id,
          userId: t.user_id,
          userName: t.user_name,
          userRole: t.user_role,
          action: t.action,
          details: t.details || {},
          timestamp: t.timestamp,
          userAgent: t.user_agent
        }));
        localStorage.setItem('sapi_telemetry_events', JSON.stringify(mapped));
      }
    } catch (errT) {
      console.warn('[Sync] Tabla sapi_telemetry no disponible en Supabase (o RLS activa).', errT.message);
    }

  } catch (error) {
    console.error('[Supabase] Error cargando datos:', error.message);
  } finally {
    window._isSyncingFromSupabase = false;
    window._syncPromise = null;
    window.dispatchEvent(new Event('supabase_datos_cargados'));
    console.log('[Supabase] ✅ Carga completa. Evento "supabase_datos_cargados" disparado.');
  }
  })();

  return window._syncPromise;
}

// ─── Realtime Subscriptions ──────────────────────────────────────────────────
function setupRealtime() {
  if (!window.supabaseClient) {
    console.warn('[Realtime] Cliente de Supabase no inicializado aún. Reintentando en 2 segundos...');
    setTimeout(setupRealtime, 2000);
    return;
  }

  const handleUpdate = async (tableName) => {
    try {
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
        } else if (tableName === 'clara_transactions') {
          const mappedClara = data.map(row => ({
            id: row.id,
            fecha: row.fecha ? row.fecha.split('T')[0] : '',
            merchant: row.merchant,
            monto: Number(row.monto),
            cardLast4: row.card_last_4,
            usuario: row.usuario || 'Técnico Asignado',
            categoria: row.categoria || 'Otros',
            fechaTransaccion: row.fecha_transaccion,
            estadoCuenta: row.estado_cuenta,
            transaccion: row.transaccion,
            montoOriginal: Number(row.monto_original || 0),
            monedaOriginal: row.moneda_original,
            montoMxn: Number(row.monto_mxn || 0),
            tarjeta: row.tarjeta,
            aliasTarjeta: row.alias_tarjeta,
            estado: row.estado,
            estadoAprobacion: row.estado_aprobacion,
            nombreAprobador: row.nombre_aprobador,
            notaAprobacion: row.nota_aprobacion,
            codigoAutorizacion: row.codigo_autorizacion,
            categoriaClara: row.categoria_clara,
            facturaElectronica: row.factura_electronica,
            facturaAutovinculada: row.factura_autovinculada,
            archivosFactura: row.archivos_factura,
            anexos: row.anexos,
            archivosAnexo: row.archivos_anexo,
            folioFiscal: row.folio_fiscal,
            titular: row.titular,
            grupos: row.grupos,
            ubicacion: row.ubicacion,
            etiquetas: row.etiquetas,
            descripcion: row.descripcion
          }));
          localStorage.setItem('sapi_clara_mock_txs', JSON.stringify(mappedClara));
          window._supaClaraTxs = mappedClara;
        } else if (tableName === 'sapi_telemetry') {
          const { data: telemetryDb, error: telemetryErr } = await window.supabaseClient.from('sapi_telemetry').select('*').limit(300).order('timestamp', { ascending: false });
          if (!telemetryErr && telemetryDb && telemetryDb.length > 0) {
            const mapped = telemetryDb.map(t => ({
              id: t.id,
              userId: t.user_id,
              userName: t.user_name,
              userRole: t.user_role,
              action: t.action,
              details: t.details || {},
              timestamp: t.timestamp,
              userAgent: t.user_agent
            }));
            localStorage.setItem('sapi_telemetry_events', JSON.stringify(mapped));
            
            // Re-render dashboard live if they are currently on the telemetry tab
            const activeView = document.querySelector('.view.active');
            if (activeView && activeView.id === 'view-telemetry' && window.renderTelemetryDashboard) {
              window.renderTelemetryDashboard();
            }
          }
        } else if (tableName === 'calendario_eventos') {
          const mapped = data.map(rowToEvento);
          localStorage.setItem('sapi_calendario_eventos', JSON.stringify(mapped));
          window._supaCalendarioEventos = mapped;
        } else if (tableName === 'clara_cards') {
          const mappedCards = data.map(row => ({
            id: row.id,
            alias: row.alias,
            usuario: row.usuario,
            correo: row.correo,
            estado: row.estado,
            tipo: row.tipo,
            tarjeta: row.tarjeta,
            limite: Number(row.limite || 0),
            saldoUtilizado: Number(row.saldo_utilizado || 0),
            ultimaActualizacion: row.ultima_actualizacion,
            dondeComprar: row.donde_comprar
          }));
          localStorage.setItem('sapi_clara_cards', JSON.stringify(mappedCards));
          window._supaClaraCards = mappedCards;
        }
        window.dispatchEvent(new Event('supabase_datos_cargados'));
      }
    } catch (e) {
      console.error(`[Realtime] Error al procesar actualización de la tabla ${tableName}:`, e.message);
    }
  };

  try {
    if (window.supabaseRealtimeChannel) {
      window.supabaseClient.removeChannel(window.supabaseRealtimeChannel);
    }
    window.supabaseRealtimeChannel = window.supabaseClient.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => handleUpdate('tickets'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => handleUpdate('ordenes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clara_transactions' }, () => handleUpdate('clara_transactions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clara_cards' }, () => handleUpdate('clara_cards'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sapi_telemetry' }, () => handleUpdate('sapi_telemetry'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_eventos' }, () => handleUpdate('calendario_eventos'));
      
    window.supabaseRealtimeChannel.subscribe();
  } catch (err) {
    console.error('[Realtime] Excepción al suscribirse al canal en tiempo real:', err.message);
  }
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

// Convert base64 data URL to Blob for binary storage upload
window.base64ToBlob = async function(base64Data) {
  try {
    const res = await fetch(base64Data);
    return await res.blob();
  } catch (err) {
    console.error('[Storage] Error converting base64 to blob:', err);
    return null;
  }
};

// Uploads a base64 file to Supabase Storage and returns the public URL
window.uploadBase64ToStorage = async function(base64Data, bucketName, filePath) {
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Storage] SupabaseClient not available.');
    return null;
  }

  try {
    const blob = await window.base64ToBlob(base64Data);
    if (!blob) return null;

    // Upload blob to Supabase Storage bucket
    const { data, error } = await sb.storage.from(bucketName).upload(filePath, blob, {
      cacheControl: '3600',
      upsert: true
    });

    if (error) {
      console.warn('[Storage] Error uploading to bucket:', error.message);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = sb.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrl;
  } catch (err) {
    console.error('[Storage] Exception during upload:', err);
    return null;
  }
};
