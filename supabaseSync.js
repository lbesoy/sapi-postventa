// --- Global Helper for Paginated Supabase Fetches ---
window.fetchTablePaginated = async (tableName, selectQuery = '*', orderColumn = null, orderAscending = false, queryModifier = null, pageLimit = 1000, timeoutMs = 30000) => {
  const sb = window.supabaseClient;
  if (!sb) {
    console.error(`[Sync] Supabase client not initialized when fetching ${tableName}`);
    return [];
  }
  
  // Tablas con campos JSONB pesados (tickets) se descargan en lotes seguros de 100
  if (tableName === 'tickets' && pageLimit > 100) {
    pageLimit = 100;
  }

  let allData = [];
  let fetchMore = true;
  let page = 0;
  while (fetchMore) {
    let query = sb.from(tableName).select(selectQuery);
    if (queryModifier) {
      query = queryModifier(query);
    }
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: orderAscending });
    }
    
    // Timeout protector de 30s para evitar cuelgues indefinidos
    const fetchPromise = query.range(page * pageLimit, (page + 1) * pageLimit - 1);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout (${timeoutMs/1000}s) en tabla ${tableName}`)), timeoutMs)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      console.error(`[Sync] Error cargando ${tableName} página ${page}:`, error.message);
      throw error;
    }
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageLimit) {
        fetchMore = false;
      } else {
        page++;
      }
    } else {
      fetchMore = false;
    }
  }
  return allData;
};

// --- IndexedDB Helper for Refacciones (unlimited offline storage) ---
window.getSapiIndexedDB = function() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open('SapiOfflineDB', 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('catalogs')) {
        db.createObjectStore('catalogs', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => resolve(null);
  });
};

window.saveCatalogOffline = async function(catalogKey, dataArray) {
  try {
    const db = await window.getSapiIndexedDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('catalogs', 'readwrite');
        const store = tx.objectStore('catalogs');
        const req = store.put({ id: catalogKey, data: dataArray });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      console.log(`[IndexedDB] Catálogo ${catalogKey} guardado con éxito.`);
      if (typeof localStorage !== 'undefined') {
        const redirectedKeys = ['sapi_refacciones_db', 'eurorep_pedidos_sap', 'eurorep_cotizaciones_sap', 'sapi_tickets', 'sapi_ordenes'];
        if (redirectedKeys.includes(catalogKey)) {
          if (typeof window.localStorageCache === 'undefined') {
            window.localStorageCache = {};
          }
          window.localStorageCache[catalogKey] = JSON.stringify(dataArray);
        } else {
          localStorage.removeItem(catalogKey);
        }
      }
      return;
    }
  } catch (err) {
    console.error(`[IndexedDB] Fallo al guardar catálogo ${catalogKey} en IndexedDB:`, err);
  }
  // Fallback
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(catalogKey, JSON.stringify(dataArray));
    }
  } catch (err) {
    console.error(`[LocalStorage] Fallo crítico al guardar catálogo ${catalogKey}:`, err);
  }
};

window.loadCatalogOffline = async function(catalogKey, defaultValue = []) {
  try {
    const db = await window.getSapiIndexedDB();
    if (db) {
      const result = await new Promise((resolve) => {
        const tx = db.transaction('catalogs', 'readonly');
        const store = tx.objectStore('catalogs');
        const req = store.get(catalogKey);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
      if (result) {
        return result;
      }
    }
  } catch (err) {
    console.error(`[IndexedDB] Fallo al leer catálogo ${catalogKey}:`, err);
  }
  // Fallback
  try {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(catalogKey);
      return local ? JSON.parse(local) : defaultValue;
    }
  } catch (e) {}
  return defaultValue;
};

window.saveRefaccionesLocal = async function(refaccionesArray) {
  return window.saveCatalogOffline('sapi_refacciones_db', refaccionesArray);
};

window.loadRefaccionesLocal = async function() {
  return window.loadCatalogOffline('sapi_refacciones_db', []);
};

// Helpers de serialización de refacciones en el campo 'notas' del ticket
window.extraerRefaccionesDeNotas = function(notasStr) {
  const str = notasStr || '';
  const separator = '=== REFACCIONES ===';
  const idx = str.indexOf(separator);
  if (idx > -1) {
    const notasLimpias = str.substring(0, idx).trim();
    const refaccionesJSON = str.substring(idx + separator.length).trim();
    try {
      const refacciones = JSON.parse(refaccionesJSON);
      return { notasLimpias, refacciones: Array.isArray(refacciones) ? refacciones : [] };
    } catch (e) {
      console.warn("Error parsing refacciones JSON from notes:", e);
      return { notasLimpias: str, refacciones: [] };
    }
  }
  return { notasLimpias: str, refacciones: [] };
};

window.inyectarRefaccionesEnNotas = function(rawOrCleanNotasStr, refacciones) {
  const extracted = window.extraerRefaccionesDeNotas(rawOrCleanNotasStr);
  const clean = (extracted.notasLimpias || '').trim();
  if (!refacciones || refacciones.length === 0) return clean;
  return `${clean}\n\n=== REFACCIONES ===\n${JSON.stringify(refacciones)}`;
};

// Helpers de serialización de cotizaciones en el campo 'notas' del ticket
window.extraerCotizacionesDeNotas = function(notasStr) {
  const str = notasStr || '';
  const separator = '=== COTIZACIONES ===';
  const idx = str.indexOf(separator);
  if (idx > -1) {
    const notasLimpias = str.substring(0, idx).trim();
    const cotizacionesJSON = str.substring(idx + separator.length).trim();
    try {
      const cotizaciones = JSON.parse(cotizacionesJSON);
      return { notasLimpias, cotizaciones: Array.isArray(cotizaciones) ? cotizaciones : [] };
    } catch (e) {
      console.warn("Error parsing cotizaciones JSON from notes:", e);
      return { notasLimpias: str, cotizaciones: [] };
    }
  }
  return { notasLimpias: str, cotizaciones: [] };
};

window.inyectarCotizacionesEnNotas = function(rawOrCleanNotasStr, cotizaciones) {
  const extracted = window.extraerCotizacionesDeNotas(rawOrCleanNotasStr);
  const clean = (extracted.notasLimpias || '').trim();
  if (!cotizaciones || cotizaciones.length === 0) return clean;
  return `${clean}\n\n=== COTIZACIONES ===\n${JSON.stringify(cotizaciones)}`;
};

// ============================================================

// Proteger contra errores fatales de parseo de JSON malformados o corruptos en sincronización
if (typeof JSON !== 'undefined' && !JSON.parse.__isSafeWrapper) {
  (function() {
    const originalParse = JSON.parse;
    JSON.parse = function(text, reviver) {
      try {
        return originalParse.call(JSON, text, reviver);
      } catch (err) {
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
window._cacheCotizacionesSap = [];
window._cachePedidosSap = [];
(async () => {
  try {
    window._cacheCotizacionesSap = await window.loadCatalogOffline('eurorep_cotizaciones_sap', []);
    window._cachePedidosSap = await window.loadCatalogOffline('eurorep_pedidos_sap', []);
  } catch (e) {}
})();



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

function padCard(val) {
  const digits = String(val || '').replace(/[^0-9]/g, '');
  return digits ? digits.padStart(4, '0').slice(-4) : '';
}

window.ticketToRow = ticketToRow;
function ticketToRow(t) {
  // Encontrar el ID del cliente por su nombre
  let clienteId = null;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => 
      (c.nombre && t.cliente && String(c.nombre).toLowerCase().trim() === String(t.cliente).toLowerCase().trim()) ||
      (c.id && t.cliente && String(c.id).toLowerCase().trim() === String(t.cliente).toLowerCase().trim())
    );
    if (match) {
      clienteId = match.id;
    } else if (t.cliente) {
      const existById = clientes.find(c => String(c.id).toLowerCase().trim() === String(t.cliente).toLowerCase().trim());
      if (existById) clienteId = existById.id;
    }
  } catch (e) {}

  // Encontrar el ID del sitio por su nombre
  let sitioId = null;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => (s.cliente === clienteId || s.cliente === t.cliente) && (s.nombre === t.sitio || s.direccion === t.sitio || s.id === t.sitio));
    if (match) {
      sitioId = match.id;
    } else if (t.sitio) {
      const existById = sitios.find(s => s.id === t.sitio);
      if (existById) sitioId = existById.id;
    }
  } catch (e) {}

  const baseNotas = t.notas || '';
  let finalNotas = baseNotas;
  finalNotas = window.inyectarCotizacionesEnNotas(finalNotas, t.cotizacionesAdicionales || []);
  finalNotas = window.inyectarRefaccionesEnNotas(finalNotas, t.refaccionesSeleccionadas || []);

  let prefix = '';
  if (t.horometro) prefix += `[H:${t.horometro}]\n`;
  if (t.destinoPiezas) prefix += `[U:${t.destinoPiezas}]\n`;
  if (t.destinoPrecio) prefix += `[Y:${t.destinoPrecio}]\n`;
  if (t.destinoPdfUrl) prefix += `[Z:${t.destinoPdfUrl}]\n`;
  if (t.envios && t.envios.length > 0) {
    prefix += `[S:${JSON.stringify(t.envios)}]\n`;
    const first = t.envios[0] || {};
    if (first.paqueteria) prefix += `[P:${first.paqueteria}]\n`;
    if (first.guiaPedido) prefix += `[G:${first.guiaPedido}]\n`;
    if (first.fechaPedido) prefix += `[D:${first.fechaPedido}]\n`;
    if (first.fechaEntrega) prefix += `[E:${first.fechaEntrega}]\n`;
  } else {
    if (t.guiaPedido) prefix += `[G:${t.guiaPedido}]\n`;
    if (t.paqueteria) prefix += `[P:${t.paqueteria}]\n`;
    if (t.fechaPedido) prefix += `[D:${t.fechaPedido}]\n`;
    if (t.fechaEntrega) prefix += `[E:${t.fechaEntrega}]\n`;
  }

  const nowIso = new Date().toISOString();
  const fechaMod = (window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : null) || t.fechaModificacion || t.fecha_modificacion || t.updated_at || nowIso;
  const modificadoPorVal = (window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : null) || t.modificadoPor || t.modificado_por || t.creadoPor || null;

  const row = {
    id: t.id,
    folio: t.folio,
    fecha: t.fecha,
    fecha_creacion: t.fechaCreacion || new Date().toISOString(),
    fecha_modificacion: fechaMod,
    updated_at: fechaMod,
    modificado_por: modificadoPorVal,
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
    notas: prefix + finalNotas,
    estado: t.estado || null,
    cotizacion_sap: t.cotizacionSAP || null,
    monto_cotizacion: (t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? Number(t.montoCotizacion) : null,
    cot_aceptada: t.cotAceptada || null,
    motivo_rechazo: t.motivoRechazo || null,
    pedido_sap: t.pedidoSAP || null,
    comentarios_internos: t.comentariosInternos || [],
    comentarios_clientes: t.comentariosClientes || [],
    creado_por: t.creadoPor || null
  };

  // Solo incluir campos PDF si tienen el Base64 real y no un marcador
  if (t.pdfPedido !== undefined && t.pdfPedido !== '__HAS_PDF__' && t.pdfPedido !== true) {
    row.pdf_pedido = t.pdfPedido;
  }
  if (t.pdfCotizacion !== undefined && t.pdfCotizacion !== '__HAS_PDF__' && t.pdfCotizacion !== true) {
    row.pdf_cotizacion = t.pdfCotizacion;
  }

  return row;
}

function rowToTicket(t, idsWithPedido, idsWithCotizacion) {
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

  let hasPed = false;
  let hasCot = false;

  if (t.has_pdf_pedido !== undefined) {
    hasPed = t.has_pdf_pedido;
  } else if (idsWithPedido && idsWithPedido.has(t.id)) {
    hasPed = true;
  } else if (t.pdf_pedido && typeof t.pdf_pedido === 'string' && t.pdf_pedido.length > 50) {
    hasPed = true;
  }

  if (t.has_pdf_cotizacion !== undefined) {
    hasCot = t.has_pdf_cotizacion;
  } else if (idsWithCotizacion && idsWithCotizacion.has(t.id)) {
    hasCot = true;
  } else if (t.pdf_cotizacion && typeof t.pdf_cotizacion === 'string' && t.pdf_cotizacion.length > 50) {
    hasCot = true;
  }

  const pdfPedidoVal = hasPed ? '__HAS_PDF__' : null;
  const pdfCotizacionVal = hasCot ? '__HAS_PDF__' : null;

  const extracted = window.extraerRefaccionesDeNotas(t.notas);
  const extractedCot = window.extraerCotizacionesDeNotas(extracted.notasLimpias);

  const obj = {
    id: t.id,
    _synced: true,
    folio: t.folio,
    fecha: t.fecha,
    fechaCreacion: t.fecha_creacion,
    fechaModificacion: t.fecha_modificacion || t.updated_at || t.fecha_creacion || t.fecha || null,
    modificadoPor: t.modificado_por || t.creado_por || null,
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
    notas: extractedCot.notasLimpias,
    refaccionesSeleccionadas: extracted.refacciones,
    cotizacionesAdicionales: extractedCot.cotizaciones,
    estado: t.estado,
    cotizacionSAP: t.cotizacion_sap,
    montoCotizacion: (t.monto_cotizacion !== undefined && t.monto_cotizacion !== null) ? Number(t.monto_cotizacion) : null,
    cotAceptada: t.cot_aceptada,
    motivoRechazo: t.motivo_rechazo,
    pedidoSAP: t.pedido_sap,
    creadoPor: t.creado_por || null,
    comentariosInternos: t.comentarios_internos || [],
    comentariosClientes: t.comentarios_clientes || [],
    tecnicosAsignados: [], // Siempre vacío por diseño relacional de negocio
    pdfPedido: pdfPedidoVal,
    pdfCotizacion: pdfCotizacionVal,
    esPrueba: t.es_prueba || (t.folio && t.folio.includes('PRUEBA')) || (t.asunto && t.asunto.startsWith('[PRUEBA]')) || false
  };
  
  obj.horometro = '';
  obj.guiaPedido = '';
  obj.paqueteria = '';
  obj.fechaPedido = '';
  obj.fechaEntrega = '';
  obj.destinoPiezas = '';
  obj.destinoPrecio = '';
  obj.destinoPdfUrl = '';
  obj.envios = [];
  
  if (obj.notas) {
    let remainingNotes = obj.notas;
    let matched = true;
    while (remainingNotes && remainingNotes.startsWith('[')) {
      const endIdx = remainingNotes.indexOf(']\n');
      if (endIdx === -1) break;
      const tag = remainingNotes.substring(1, 3);
      const val = remainingNotes.substring(3, endIdx);
      if (tag === 'H:') {
        obj.horometro = val;
      } else if (tag === 'U:') {
        obj.destinoPiezas = val;
      } else if (tag === 'Y:') {
        obj.destinoPrecio = val;
      } else if (tag === 'Z:') {
        obj.destinoPdfUrl = val;
      } else if (tag === 'G:') {
        obj.guiaPedido = val;
      } else if (tag === 'P:') {
        obj.paqueteria = val;
      } else if (tag === 'D:') {
        obj.fechaPedido = val;
      } else if (tag === 'E:') {
        obj.fechaEntrega = val;
      } else if (tag === 'S:') {
        try {
          obj.envios = JSON.parse(val);
        } catch (e) {
          obj.envios = [];
        }
      } else {
        break;
      }
      remainingNotes = remainingNotes.substring(endIdx + 2);
    }
    obj.notas = remainingNotes;
  }

  // Fallback migration to shipments if legacy single shipment info exists but no envios
  if ((!obj.envios || obj.envios.length === 0) && (obj.paqueteria || obj.guiaPedido || obj.fechaPedido || obj.fechaEntrega)) {
    obj.envios = [{
      id: Math.random().toString(36).substring(2, 9),
      paqueteria: obj.paqueteria || '',
      guiaPedido: obj.guiaPedido || '',
      fechaPedido: obj.fechaPedido || '',
      fechaEntrega: obj.fechaEntrega || '',
      parts: (obj.refaccionesSeleccionadas || []).map(p => ({
        clave: p.clave || p.codigo || '',
        descripcion: p.descripcion || p.nombre || ''
      }))
    }];
  }

  // Clasificar de forma retroactiva como de prueba si contiene comentarios/mensajes de prueba
  if (obj.categoria === 'Soporte General') {
    const hasTestMsg = obj.comentariosClientes && obj.comentariosClientes.some(msg => {
      const text = String(msg && msg.texto || '').toLowerCase();
      return text.includes('prueba') || text.includes('test');
    });
    if (hasTestMsg) {
      obj.esPrueba = true;
    }
  }

  return obj;
}

function getValidDbTecnico(tecnicoStr) {
  if (!tecnicoStr) return null;
  const names = tecnicoStr.split(',').map(n => n.trim()).filter(Boolean);
  
  let localUsers = [];
  try {
    localUsers = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
  } catch (e) {}
  
  for (const name of names) {
    const match = localUsers.find(u => u.nombre && u.nombre.trim().toLowerCase() === name.toLowerCase());
    if (match) {
      return match.nombre;
    }
  }
  return null;
}

window.ordenToRow = ordenToRow;
function ordenToRow(o) {
  const customData = { ...o };
  const knownKeys = [
    'id', 'folio', 'cliente', 'ubicacion', 'tipo', 'estado', 'fecha', 'fechaInicio', 'fechaFin', 
    'duracion', 'duracion_minutos', 'evidenciaBase64', 'evidencia_base_64', 'evidencia_url', 'bitacora', 'maquinaria_id', 'sitio_id',
    'firma_tecnico_base64', 'firma_tecnico_nombre', 'firma_tecnico_fecha', 
    'firma_cliente_base64', 'firma_cliente_nombre', 'firma_cliente_fecha', 'evidencias',
    'ubicacion_sitio', 'operador',
    'cierre_papel_pdf', 'cierre_papel_motivo', 'cierre_papel_usuario', 'cierre_papel_fecha',
    'cierre_papel_tecnicos_horas'
  ];
  knownKeys.forEach(k => delete customData[k]);
  
  if (o.ref_utilizadas) {
    const pdfFlags = {};
    o.ref_utilizadas.forEach(r => {
      if (r.isFromPdf) pdfFlags[r.descripcion] = true;
    });
    if (Object.keys(pdfFlags).length > 0) {
      customData.pdfRefFlags = pdfFlags;
    }
  }
  
  const notasJSON = JSON.stringify(customData);

  // Buscar sitio_id en localStorage
  let sitioId = null;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => s.cliente === o.cliente && (s.nombre === o.ubicacion || s.direccion === o.ubicacion || s.id === o.ubicacion));
    if (match) sitioId = match.id;
  } catch (e) {}

  // Buscar maquinaria_id en localStorage
  let maquinariaId = o.maquinaria_id || null;
  if (!maquinariaId) {
    try {
      const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
      const match = maquinas.find(m => 
        m.cliente === o.cliente && (
          (o.serie && m.serie === o.serie) || 
          (o.modelo && m.modelo === o.modelo) ||
          (o.equipo && (m.idInterno === o.equipo || m.id === o.equipo || m.serie === o.equipo))
        )
      );
      if (match) maquinariaId = match.id;
    } catch (e) {}
  }

  let clienteId = o.cliente || null;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.nombre === o.cliente || c.id === o.cliente);
    if (match) clienteId = match.id;
  } catch (e) {}

  return {
    id: o.id,
    folio: o.folio,
    cliente: clienteId,
    sitio_id: sitioId,
    tecnico: getValidDbTecnico(o.tecnico) || null,
    maquinaria_id: maquinariaId,
    tipo: o.tipo || 'Servicio',
    estado: o.estado || 'Pendiente',
    fecha: o.fecha || new Date().toISOString(),
    fecha_inicio: o.fechaInicio || null,
    fecha_fin: o.fechaFin || null,
    duracion_minutos: o.duracion || null,
    notas: notasJSON,
    evidencia_url: o.evidenciaBase64 || null,
    evidencias: o.evidencias || {},
    ubicacion_sitio: o.ubicacion_sitio || null,
    operador: o.operador || null,
    cierre_papel_pdf: o.cierre_papel_pdf || null,
    cierre_papel_motivo: o.cierre_papel_motivo || null,
    cierre_papel_usuario: o.cierre_papel_usuario || null,
    cierre_papel_fecha: o.cierre_papel_fecha || null,
    cierre_papel_tecnicos_horas: o.cierre_papel_tecnicos_horas || null
  };
}

window.rowToOrden = rowToOrden;
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

  // Deducir modelo, marca, serie, eco de maquinaria del ID
  let modelo = o.modelo || null;
  let serie = extraData.serie || null;
  let marca = extraData.marca || null;
  let eco = extraData.eco || null;

  if (o.maquinaria_id) {
    try {
      const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
      const match = maquinas.find(m => m.id === o.maquinaria_id);
      if (match) {
        modelo = match.modelo || modelo;
        serie = match.serie || serie;
        marca = match.marca || marca;
        eco = match.no_economico || match.numeroEconomico || eco;
      }
    } catch (e) {}
  }

  let clienteNombre = o.cliente;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.id === o.cliente);
    if (match) clienteNombre = match.nombre;
  } catch (e) {}

  let evidenciasObj = o.evidencias || {};
  if (typeof evidenciasObj === 'string') {
    try {
      evidenciasObj = JSON.parse(evidenciasObj);
    } catch (e) {
      evidenciasObj = {};
    }
  }

  const res = {
    id: o.id,
    _synced: true,
    folio: o.folio, cliente: clienteNombre,
    ubicacion: ubicacion, tecnico: extraData.tecnico || o.tecnico || null,
    tipo: o.tipo, estado: o.estado, fecha: o.fecha,
    fechaInicio: o.fecha_inicio, fechaFin: o.fecha_fin,
    duracion: o.duracion_minutos,
    maquinaria_id: o.maquinaria_id || null,
    evidenciaBase64: o.evidencia_url || o.evidencia_base_64 || o.evidencia_base64 || null,
    evidencias: evidenciasObj,
    bitacora: [],
    ref_necesarias: [],
    ref_utilizadas: [],
    firma_tecnico_base64: null,
    firma_cliente_base64: null,
    ubicacion_sitio: o.ubicacion_sitio || null,
    operador: o.operador || null,
    cierre_papel_pdf: o.cierre_papel_pdf || null,
    cierre_papel_motivo: o.cierre_papel_motivo || null,
    cierre_papel_usuario: o.cierre_papel_usuario || null,
    cierre_papel_fecha: o.cierre_papel_fecha || null,
    cierre_papel_tecnicos_horas: o.cierre_papel_tecnicos_horas || null,
    ...extraData
  };
  
  if (res.bitacora) delete res.bitacora;
  res.bitacora = [];
  res.ref_necesarias = extraData.ref_necesarias || [];
  res.ref_utilizadas = extraData.ref_utilizadas || [];

  if (!res.ubicacion_sitio && extraData.ubicacion_sitio) res.ubicacion_sitio = extraData.ubicacion_sitio;
  if (!res.operador && extraData.operador) res.operador = extraData.operador;

  // Priorizar el modelo deducido o el de extraData si no hay id relacional
  res.modelo = modelo || res.modelo || null;
  res.serie = serie || res.serie || null;
  res.marca = marca || res.marca || null;
  res.eco = eco || res.eco || null;
  
  return res;
}

window.levantamientoToRow = levantamientoToRow;
function levantamientoToRow(l) {
  // Encontrar el ID del cliente por su nombre
  let clienteId = null;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.nombre === l.cliente || c.id === l.cliente);
    if (match) {
      clienteId = match.id;
    } else if (l.cliente) {
      const existById = clientes.find(c => c.id === l.cliente);
      if (existById) clienteId = existById.id;
    }
  } catch (e) {}

  // Encontrar el ID del sitio por su nombre
  let sitioId = null;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => (s.cliente === clienteId || s.cliente === l.cliente) && (s.nombre === l.sitio || s.direccion === l.sitio || s.id === l.sitio));
    if (match) {
      sitioId = match.id;
    } else if (l.sitio) {
      const existById = sitios.find(s => s.id === l.sitio);
      if (existById) sitioId = existById.id;
    }
  } catch (e) {}

  // Encontrar el ID de la máquina por su serie o idInterno (si existe máquina en l)
  let maquinaId = null;
  try {
    const maquinas = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
    const match = maquinas.find(m => (m.cliente === clienteId || m.cliente === l.cliente) && (m.serie === l.maquina || m.idInterno === l.maquina || m.id === l.maquina));
    if (match) {
      maquinaId = match.id;
    } else if (l.maquina) {
      const existById = maquinas.find(m => m.id === l.maquina);
      if (existById) maquinaId = existById.id;
    }
  } catch (e) {}

  const baseNotas = l.notas_tecnico || '';
  let finalNotas = baseNotas;
  finalNotas = window.inyectarRefaccionesEnNotas(finalNotas, l.refacciones || []);

  const row = {
    id: l.id,
    folio: l.folio,
    cliente: clienteId,
    sitio: sitioId,
    maquina: maquinaId,
    solicitante: l.solicitante || null,
    descripcion: l.descripcion || null,
    fecha_esperada: l.fecha_esperada ? (l.fecha_esperada.length === 10 ? `${l.fecha_esperada}T12:00:00-06:00` : l.fecha_esperada) : null,
    estado: l.estado || 'Pendiente',
    tecnico_asignado: l.tecnico_asignado || null,
    notas_tecnico: finalNotas,
    evidencias: l.evidencias || {},
    ticket_generado_id: l.ticket_generado_id || null,
    created_at: l.created_at || new Date().toISOString(),
    updated_at: l.updated_at || new Date().toISOString()
  };

  return row;
}

window.rowToLevantamiento = rowToLevantamiento;
function rowToLevantamiento(r) {
  let clienteNombre = r.cliente;
  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const match = clientes.find(c => c.id === r.cliente);
    if (match) clienteNombre = match.nombre;
  } catch (e) {}

  let sitioNombre = r.sitio;
  try {
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const match = sitios.find(s => s.id === r.sitio);
    if (match) sitioNombre = match.nombre || match.direccion;
  } catch (e) {}

  const extracted = window.extraerRefaccionesDeNotas(r.notas_tecnico);

  return {
    id: r.id,
    _synced: true,
    folio: r.folio,
    cliente: clienteNombre,
    sitio: sitioNombre,
    solicitante: r.solicitante || null,
    descripcion: r.descripcion || null,
    fecha_esperada: r.fecha_esperada || null,
    estado: r.estado || 'Pendiente',
    tecnico_asignado: r.tecnico_asignado || null,
    notas_tecnico: extracted.notasLimpias,
    refacciones: extracted.refacciones,
    evidencias: r.evidencias || {},
    ticket_generado_id: r.ticket_generado_id || null,
    created_at: r.created_at || null,
    updated_at: r.updated_at || null
  };
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

function envioToRow(e) {
  if (!e) return {};
  let ticketId = e.ticketId || e.ticket_id || null;
  let clienteId = null;
  let sitioId = null;

  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');

    if (e.cliente) {
      const matchCli = clientes.find(c => c.id === e.cliente || (c.nombre && c.nombre.trim().toLowerCase() === String(e.cliente).trim().toLowerCase()));
      if (matchCli) clienteId = matchCli.id;
    }
    if (e.sitio) {
      const matchSit = sitios.find(s => (s.cliente === clienteId || s.cliente === e.cliente || !s.cliente) && (s.id === e.sitio || (s.nombre && s.nombre.trim().toLowerCase() === String(e.sitio).trim().toLowerCase()) || (s.direccion && s.direccion.trim().toLowerCase() === String(e.sitio).trim().toLowerCase())));
      if (matchSit) {
        sitioId = matchSit.id;
      } else {
        const existById = sitios.find(s => s.id === e.sitio);
        if (existById) sitioId = existById.id;
      }
    }

    if (ticketId) {
      const tickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      const matchTkt = tickets.find(t => t.id === ticketId || t.folio === ticketId);
      if (matchTkt) ticketId = matchTkt.id;
    }
  } catch(err) {}

  return {
    id: e.id,
    ticket_id: ticketId,
    cliente: clienteId,
    sitio: sitioId,
    paqueteria: e.paqueteria || 'DHL',
    guia_pedido: e.guiaPedido || e.guia_pedido || null,
    url_rastreo: e.urlRastreo || e.url_rastreo || null,
    fecha_envio: e.fechaEnvio || e.fecha_envio || e.fechaPedido || null,
    fecha_entrega: e.fechaEntrega || e.fecha_entrega || null,
    fecha_llegada: e.fechaLlegada || e.fecha_llegada || null,
    llego: !!e.llego,
    estatus: e.estatus || (e.llego ? 'Entregado' : 'En Tránsito'),
    parts: e.parts || [],
    pdf_guia: e.pdfGuia || e.pdf_guia || null,
    notas: e.notas || null
  };
}
window.envioToRow = envioToRow;

function rowToEnvio(r) {
  let clienteNombre = '';
  let sitioNombre = '';
  let ticketFolio = '';

  try {
    const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    const localTickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');

    if (r.cliente) {
      const matchCli = clientes.find(c => c.id === r.cliente);
      clienteNombre = matchCli ? matchCli.nombre : r.cliente;
    }
    if (r.sitio) {
      const matchSit = sitios.find(s => s.id === r.sitio);
      sitioNombre = matchSit ? matchSit.nombre : r.sitio;
    }
    if (r.ticket_id) {
      const matchTkt = localTickets.find(t => t.id === r.ticket_id || t.folio === r.ticket_id);
      if (matchTkt) {
        ticketFolio = matchTkt.folio || matchTkt.id;
        if (!clienteNombre) clienteNombre = matchTkt.cliente || '';
        if (!sitioNombre) sitioNombre = matchTkt.sitio || '';
      }
    }
  } catch(err) {}

  return {
    id: r.id,
    _synced: true,
    ticketId: r.ticket_id || '',
    ticketFolio: ticketFolio || (r.ticket_id ? `TKT-${r.ticket_id}` : 'Directo'),
    cliente: clienteNombre || 'Sin cliente',
    sitio: sitioNombre || 'General',
    paqueteria: r.paqueteria || 'DHL',
    guiaPedido: r.guia_pedido || '',
    urlRastreo: r.url_rastreo || '',
    fechaEnvio: r.fecha_envio || '',
    fechaPedido: r.fecha_envio || '',
    fechaEntrega: r.fecha_entrega || '',
    fechaLlegada: r.fecha_llegada || '',
    llego: !!r.llego,
    estatus: r.estatus || (r.llego ? 'Entregado' : 'En Tránsito'),
    parts: r.parts || [],
    pdfGuia: r.pdf_guia || '',
    notas: r.notas || ''
  };
}
window.rowToEnvio = rowToEnvio;


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
    titulo: e.titulo || 'Evento',
    descripcion: e.descripcion || null,
    fecha_inicio: e.fechaInicio || e.start || new Date().toISOString(),
    fecha_fin: e.fechaFin || e.end || null,
    todo_el_dia: !!(e.todoElDia || e.allDay),
    tipo: ['Junta', 'Capacitación', 'Vacaciones', 'Descanso', 'Otro', 'Servicio', 'Levantamiento', 'Traslado'].includes(e.tipo) ? e.tipo : 'Otro',
    tecnico_id: isValidUUID(e.tecnicoId) ? e.tecnicoId : null,
    tecnico_nombre: e.tecnicoNombre || null,
    creado_por: isValidUUID(e.creadoPor) ? e.creadoPor : null,
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

function coalesceSyncQueue(queue) {
  if (!Array.isArray(queue) || queue.length <= 1) return queue || [];
  const map = new Map();
  const result = [];
  
  for (const item of queue) {
    if (!item) continue;
    const itemId = item.data ? (item.data.id || item.data.idInterno || item.data.serie) : (item.id || null);
    if (itemId && item.table) {
      const key = `${item.table}::${itemId}`;
      if (map.has(key)) {
        const prevIdx = map.get(key);
        if (result[prevIdx].action === 'delete' && item.action === 'upsert') {
          // Conservar delete si ya estaba borrado
        } else {
          result[prevIdx] = item;
        }
      } else {
        map.set(key, result.length);
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

function addToSyncQueue(table, action, data) {
  const queue = getSyncQueue();
  const existingIdx = queue.findIndex(item => {
    if (item.table !== table) return false;
    if (table === 'roles' || table === 'kits_servicio' || table === 'kits_servicio_sandbox' || table === 'machotes_servicio') return true;
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
  // La telemetría es no-crítica: se envía directo sin cola para evitar
  // acumulación de errores "Failed to fetch" en la UI.
  if (tabla === 'sapi_telemetry') {
    const sb = window.supabaseClient;
    if (!sb) return;
    try {
      const sessionRes = await sb.auth.getSession().catch(() => null);
      if (!sessionRes || !sessionRes.data || !sessionRes.data.session) return;
      const payload = {
        id: item.id,
        user_id: item.userId,
        user_name: item.userName,
        user_role: item.userRole,
        action: item.action,
        details: item.details || {},
        timestamp: item.timestamp,
        user_agent: item.userAgent
      };
      sb.from('sapi_telemetry').upsert(payload, { onConflict: 'id' }).then(() => {}).catch(() => {});
    } catch (e) { /* silencioso */ }
    return;
  }

  // Determinar si la operación debe ser ONLINE-ONLY (directa a Supabase sin encolar offline)
  let isOnlineOnly = false;
  
  if (tabla === 'tickets' || tabla === 'ideas_fallas' || tabla === 'envios') {
    isOnlineOnly = true;
  }

  if (isOnlineOnly) {
    const sb = window.supabaseClient;
    if (!sb) {
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(`No hay conexión con la base de datos para guardar en ${tabla}.`, 'error');
      }
      throw new Error('No hay conexión con la base de datos.');
    }
    
    // Mapear el objeto de negocio a fila de Supabase si aplica
    let row = item;
    if (tabla === 'ordenes' && typeof window.ordenToRow === 'function') {
      row = window.ordenToRow(item);
    } else if (tabla === 'tickets' && typeof window.ticketToRow === 'function') {
      row = window.ticketToRow(item);
    } else if (tabla === 'levantamientos' && typeof window.levantamientoToRow === 'function') {
      row = window.levantamientoToRow(item);
    } else if (tabla === 'envios' && typeof window.envioToRow === 'function') {
      row = window.envioToRow(item);
    }
    
    // Upsert directo en la nube
    let { error } = await sb.from(tabla).upsert(row);

    // Bucle dinámico de autorecuperación para columnas no migradas en Supabase (PGRST204 / schema cache)
    let colRetries = 0;
    while (error && error.message && (error.message.includes('schema cache') || error.message.includes('column') || error.code === 'PGRST204') && colRetries < 8) {
      colRetries++;
      const match = error.message.match(/['"]([^'"]+)['"]\s+column/i) || 
                    error.message.match(/column\s+['"]([^'"]+)['"]/i) ||
                    error.message.match(/column\s+of\s+['"]([^'"]+)['"]/i);
      const missingCol = match ? match[1] : null;
      
      if (missingCol && row[missingCol] !== undefined) {
        console.warn(`[Direct Push] Columna '${missingCol}' no existe en Supabase (${tabla}). Eliminando y reintentando...`);
        delete row[missingCol];
        const resRetry = await sb.from(tabla).upsert(row);
        error = resRetry.error;
      } else {
        const knownOptionals = ['prioridad', 'orden', 'fecha_modificacion', 'updated_at', 'modificado_por', 'fecha_resolucion', 'resolucion', 'resuelto_por', 'archivos'];
        let deletedAny = false;
        knownOptionals.forEach(col => {
          if (row[col] !== undefined) {
            delete row[col];
            deletedAny = true;
          }
        });
        if (!deletedAny) break;
        const resRetry = await sb.from(tabla).upsert(row);
        error = resRetry.error;
      }
    }

    // Si hay error de clave foránea (ej. sitio_fkey, cliente_fkey) en envios u otras tablas
    if (error && (error.code === '23503' || (error.message && error.message.includes('foreign key')))) {
      console.warn(`[Direct Push] Violación de clave foránea en ${tabla}. Reintentando con claves foráneas neutralizadas...`);
      const fallbackRow = { ...row };
      if (fallbackRow.sitio !== undefined) fallbackRow.sitio = null;
      if (fallbackRow.sitio_id !== undefined) fallbackRow.sitio_id = null;
      if (fallbackRow.cliente !== undefined && error.message.includes('cliente')) fallbackRow.cliente = null;
      if (fallbackRow.ticket_id !== undefined && error.message.includes('ticket')) fallbackRow.ticket_id = null;
      const resFallback = await sb.from(tabla).upsert(fallbackRow);
      error = resFallback.error;
    }

    // Si hay conflicto de clave única por folio (tickets_folio_unique o folio existente con distinto ID), actualizar el registro existente por folio
    if (error && (tabla === 'tickets' || tabla === 'ordenes') && (error.message.includes('tickets_folio_unique') || error.message.includes('duplicate key') || error.message.includes('unique constraint'))) {
      console.warn(`[Direct Push] Conflicto de folio único en ${tabla} para folio ${row.folio || row.id}. Actualizando registro existente por folio...`);
      const keyCol = row.folio ? 'folio' : 'id';
      const keyVal = row.folio || row.id;
      const resUpdate = await sb.from(tabla).update(row).eq(keyCol, keyVal);
      error = resUpdate.error;
    }

    if (error) {
      console.error(`[Direct Push] Error al guardar en ${tabla}:`, error.message);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(`Error al guardar en ${tabla}: ${error.message}`, 'error');
      }
      throw error;
    }
    
    // Marcar el elemento local en localStorage como sincronizado (_synced = true)
    try {
      const storageKey = tabla === 'tickets' ? 'sapi_tickets' : (tabla === 'ordenes' ? 'sapi_ordenes' : (tabla === 'envios' ? 'sapi_envios_db' : null));
      if (storageKey) {
        const localItems = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const idx = localItems.findIndex(i => i.id === item.id);
        if (idx > -1) {
          localItems[idx]._synced = true;
          localStorage.setItem(storageKey, JSON.stringify(localItems));
        }
      }
    } catch(e) {}
    
    console.log(`[Direct Push] Guardado exitoso directo en la tabla ${tabla}.`);
    return;
  }

  // Añadir a la cola local para estrategia offline-first (tecnicos / otras tablas)
  addToSyncQueue(tabla, 'upsert', item);
  
  // Intentar sincronizar inmediatamente en segundo plano
  processSyncQueue();
};

window.deleteFromSupabase = async function(tabla, id) {
  // Determinar si la operación debe ser ONLINE-ONLY
  let isOnlineOnly = false;
  
  if (tabla === 'tickets' || tabla === 'ideas_fallas' || tabla === 'envios') {
    isOnlineOnly = true;
  }

  if (isOnlineOnly) {
    const sb = window.supabaseClient;
    if (!sb) {
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(`No hay conexión con la base de datos para eliminar de ${tabla}.`, 'error');
      }
      throw new Error('No hay conexión con la base de datos.');
    }
    
    // Borrado directo en la nube
    const { error } = await sb.from(tabla).delete().eq('id', id);
    if (error) {
      console.error(`[Direct Delete] Error al eliminar en ${tabla}:`, error.message);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(`Error al eliminar de ${tabla}: ${error.message}`, 'error');
      }
      throw error;
    }
    console.log(`[Direct Delete] Eliminado exitoso directo de la tabla ${tabla}.`);
    return;
  }

  // Añadir borrado a la cola
  addToSyncQueue(tabla, 'delete', { id });
  
  // Intentar sincronizar
  processSyncQueue();
};

let _isProcessingQueue = false;
let syncMutexPromise = null;

function processSyncQueue() {
  const now = Date.now();
  if (_isProcessingQueue && window._lastSyncStartTimestamp && (now - window._lastSyncStartTimestamp > 45000)) {
    console.warn('[Sync Watchdog] Sincronización bloqueada por más de 45 segundos. Forzando liberación del candado...');
    _isProcessingQueue = false;
    syncMutexPromise = null;
  }

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
  if (_isProcessingQueue) {
    if (window._isSyncManualForced) {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('La sincronización ya está en progreso. Por favor, espera un momento...', 'warning');
      }
    }
    return;
  }
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Sync] SupabaseClient no disponible. Sincronización en espera.');
    updateSyncStatusUI();
    return;
  }

  // Evitar procesar la cola de sincronización si no hay sesión activa en Supabase.
  // Esto previene que se disparen errores de RLS ("violates row-level security policy")
  // al intentar subir datos de forma anónima, y evita que se descarten elementos de la cola.
  try {
    const sessionRes = await sb.auth.getSession().catch(() => null);
    if (!sessionRes || !sessionRes.data || !sessionRes.data.session) {
      console.log('[Sync] No hay sesión activa en Supabase. Sincronización pospuesta hasta iniciar sesión.');
      updateSyncStatusUI();
      return;
    }
  } catch (e) {
    console.error('[Sync] Error al verificar sesión para processSyncQueue:', e);
    updateSyncStatusUI();
    return;
  }

  // Coalescer duplicados antes de procesar
  const rawQueue = getSyncQueue();
  const queue = coalesceSyncQueue(rawQueue);
  if (queue.length !== rawQueue.length) {
    saveSyncQueue(queue);
  }

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
  window._lastSyncStartTimestamp = Date.now();
  updateSyncStatusUI();

  try {
    let successCount = 0;
    let consecutiveNetworkErrors = 0;
    const MAX_CONSECUTIVE_NETWORK_ERRORS = 3;

    // Snapshot de elementos a procesar en esta pasada (no bloqueante)
    const queueToProcess = [...getSyncQueue()];

    for (let qIdx = 0; qIdx < queueToProcess.length; qIdx++) {
      const item = queueToProcess[qIdx];
      if (!item) continue;

      // Verificar si el item sigue presente en la cola (no fue eliminado manualmente)
      const freshQueue = getSyncQueue();
      const currentIdx = freshQueue.findIndex(q => 
        q.table === item.table && 
        q.action === item.action && 
        ((q.data && item.data && (q.data.id === item.data.id || q.data.idInterno === item.data.idInterno || q.data.serie === item.data.serie)) || (q.id && item.id && q.id === item.id))
      );
      if (currentIdx === -1) {
        continue;
      }

      if (!navigator.onLine && !window.isConnectionVerifiedOnline) {
        console.log('[Sync] Conexión perdida durante sincronización. Pausando cola.');
        break;
      }

      let payload;
      let error = null;
      let resTabla = item.table;

      try {
        if (item.action === 'upsert') {
          // Pipeline de subida automática a Supabase Storage para archivos binarios (evita guardar base64 en la base de datos)
          if (item.table === 'ordenes') {
            let actualizoOrdenLocal = false;
            const localOrd = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
            const idx = localOrd.findIndex(o => o.id === item.data.id);

            // 1. Evidencia antigua / fallback
            if (item.data.evidenciaBase64 && item.data.evidenciaBase64.startsWith('data:')) {
              try {
                const fileName = `orden_${item.data.id}_${Date.now()}.png`;
                const publicUrl = await window.uploadBase64ToStorage(item.data.evidenciaBase64, 'evidencias', `ordenes/${fileName}`);
                if (publicUrl) {
                  item.data.evidenciaBase64 = publicUrl;
                  if (idx > -1) {
                    localOrd[idx].evidenciaBase64 = publicUrl;
                    actualizoOrdenLocal = true;
                  }
                }
              } catch (stErr) {
                console.error('[Storage] Error en la subida automática de evidencia de orden (evidenciaBase64):', stErr);
              }
            }

            // 2. Estructura de evidencias del técnico (fotoInicio, fotoFin, adicionales)
            if (item.data.evidencias) {
              // Subir fotoInicio si es base64
              if (item.data.evidencias.fotoInicio && item.data.evidencias.fotoInicio.startsWith('data:')) {
                try {
                  const fileName = `fotoInicio_${item.data.id}_${Date.now()}.jpg`;
                  const publicUrl = await window.uploadBase64ToStorage(item.data.evidencias.fotoInicio, 'evidencias', `ordenes/${item.data.id}/${fileName}`);
                  if (publicUrl) {
                    item.data.evidencias.fotoInicio = publicUrl;
                    if (idx > -1) {
                      if (!localOrd[idx].evidencias) localOrd[idx].evidencias = {};
                      localOrd[idx].evidencias.fotoInicio = publicUrl;
                      actualizoOrdenLocal = true;
                    }
                  }
                } catch (stErr) {
                  console.error('[Storage] Error en la subida automática de fotoInicio:', stErr);
                }
              }

              // Subir fotoFin si es base64
              if (item.data.evidencias.fotoFin && item.data.evidencias.fotoFin.startsWith('data:')) {
                try {
                  const fileName = `fotoFin_${item.data.id}_${Date.now()}.jpg`;
                  const publicUrl = await window.uploadBase64ToStorage(item.data.evidencias.fotoFin, 'evidencias', `ordenes/${item.data.id}/${fileName}`);
                  if (publicUrl) {
                    item.data.evidencias.fotoFin = publicUrl;
                    if (idx > -1) {
                      if (!localOrd[idx].evidencias) localOrd[idx].evidencias = {};
                      localOrd[idx].evidencias.fotoFin = publicUrl;
                      actualizoOrdenLocal = true;
                    }
                  }
                } catch (stErr) {
                  console.error('[Storage] Error en la subida automática de fotoFin:', stErr);
                }
              }

              // Subir fotos adicionales que sean base64
              if (item.data.evidencias.adicionales && item.data.evidencias.adicionales.length > 0) {
                for (let i = 0; i < item.data.evidencias.adicionales.length; i++) {
                  const imgUrl = item.data.evidencias.adicionales[i];
                  if (imgUrl && imgUrl.startsWith('data:')) {
                    try {
                      const fileName = `adicional_${i}_${item.data.id}_${Date.now()}.jpg`;
                      const publicUrl = await window.uploadBase64ToStorage(imgUrl, 'evidencias', `ordenes/${item.data.id}/${fileName}`);
                      if (publicUrl) {
                        item.data.evidencias.adicionales[i] = publicUrl;
                        if (idx > -1) {
                          if (!localOrd[idx].evidencias) localOrd[idx].evidencias = {};
                          if (!localOrd[idx].evidencias.adicionales) localOrd[idx].evidencias.adicionales = [];
                          localOrd[idx].evidencias.adicionales[i] = publicUrl;
                          actualizoOrdenLocal = true;
                        }
                      }
                    } catch (stErr) {
                      console.error('[Storage] Error en la subida automática de foto adicional:', stErr);
                    }
                  }
                }
              }
            }

            if (actualizoOrdenLocal && idx > -1) {
              localStorage.setItem('sapi_ordenes', JSON.stringify(localOrd));
            }
          } else if (item.table === 'gastos') {
            let actualizoGastoLocal = false;
            const localGast = JSON.parse(localStorage.getItem('sapi_gastos') || '[]');
            const idx = localGast.findIndex(g => g.id === item.data.id);

            // Subir Evidencia si es base64
            if (item.data.evidencia && item.data.evidencia.startsWith('data:')) {
              try {
                const fileName = `gasto_${item.data.id}_${Date.now()}.png`;
                const publicUrl = await window.uploadBase64ToStorage(item.data.evidencia, 'evidencias', `gastos/${fileName}`);
                if (publicUrl) {
                  item.data.evidencia = publicUrl;
                  if (idx > -1) {
                    localGast[idx].evidencia = publicUrl;
                    actualizoGastoLocal = true;
                  }
                }
              } catch (stErr) {
                console.error('[Storage] Error en la subida automática de evidencia de gasto:', stErr);
              }
            }

            // Subir PDF Factura si es base64
            if (item.data.pdfFactura && item.data.pdfFactura.startsWith('data:')) {
              try {
                const fileName = `factura_${item.data.id}_${Date.now()}.pdf`;
                const publicUrl = await window.uploadBase64ToStorage(item.data.pdfFactura, 'evidencias', `facturas/${fileName}`);
                if (publicUrl) {
                  item.data.pdfFactura = publicUrl;
                  if (idx > -1) {
                    localGast[idx].pdfFactura = publicUrl;
                    actualizoGastoLocal = true;
                  }
                }
              } catch (stErr) {
                console.error('[Storage] Error en la subida automática de PDF de gasto:', stErr);
              }
            }

            // Subir XML Factura si es base64
            if (item.data.xmlFactura && item.data.xmlFactura.startsWith('data:')) {
              try {
                const fileName = `factura_${item.data.id}_${Date.now()}.xml`;
                const publicUrl = await window.uploadBase64ToStorage(item.data.xmlFactura, 'evidencias', `facturas/${fileName}`);
                if (publicUrl) {
                  item.data.xmlFactura = publicUrl;
                  if (idx > -1) {
                    localGast[idx].xmlFactura = publicUrl;
                    actualizoGastoLocal = true;
                  }
                }
              } catch (stErr) {
                console.error('[Storage] Error en la subida automática de XML de gasto:', stErr);
              }
            }

            if (actualizoGastoLocal) {
              localStorage.setItem('sapi_gastos', JSON.stringify(localGast));
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
                .select('id, cliente, notas')
                .eq('id', finalId)
                .maybeSingle();
                
              if (existingOrd) {
                let existingSoporte = null;
                if (existingOrd.notas) {
                  try {
                    const parsed = JSON.parse(existingOrd.notas);
                    existingSoporte = parsed.soporte || null;
                  } catch (e) {}
                }
                // Si pertenece a otro cliente o soporte, es una colisión de folios offline
                let existingClienteNombre = existingOrd.cliente;
                try {
                  const clientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
                  const match = clientes.find(c => c.id === existingOrd.cliente);
                  if (match) existingClienteNombre = match.nombre;
                } catch (e) {}

                const esColision = (existingClienteNombre || '').trim().toLowerCase() !== (item.data.cliente || '').trim().toLowerCase() || 
                                   (existingSoporte || '').trim().toLowerCase() !== (item.data.soporte || '').trim().toLowerCase();
                                   
                if (esColision) {
                  console.log(`[Sync] Colisión de folio detectada para ${finalId}. Calculando nuevo folio...`);
                  let todasLasOrd = [];
                  try {
                    todasLasOrd = await window.fetchTablePaginated('ordenes', 'folio');
                  } catch (err) {
                    console.error('[Sync] Error al descargar folios de órdenes para colisión:', err);
                  }
                  const currentYear = new Date().getFullYear().toString().slice(-2);
                  const isTest = (finalFolio && (finalFolio.includes('PRUEBA') || finalFolio.includes('TEST')));
                  const prefix = isTest ? `OS-PRUEBA-` : `OS-${currentYear}`;
                  let maxConsecutivo = 0;
                  
                  (todasLasOrd || []).forEach(o => {
                    if (o.folio && typeof o.folio === 'string') {
                      const cleanFolio = o.folio.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
                      if (cleanFolio.startsWith(prefix)) {
                        const numStr = cleanFolio.substring(prefix.length);
                        const num = parseInt(numStr, 10);
                        if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
                      }
                    }
                  });
                  
                  // Revisar también localmente
                  const localOrdenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
                  localOrdenes.forEach(o => {
                    if (o.folio && typeof o.folio === 'string') {
                      const cleanFolio = o.folio.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
                      if (cleanFolio.startsWith(prefix)) {
                        const numStr = cleanFolio.substring(prefix.length);
                        const num = parseInt(numStr, 10);
                        if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
                      }
                    }
                  });
                  
                  maxConsecutivo++;
                  const padded = maxConsecutivo.toString().padStart(3, '0');
                  let nuevoFolio = `${prefix}${padded}`;
                  if (isTest && !nuevoFolio.startsWith('[PRUEBA]')) {
                    nuevoFolio = `[PRUEBA] ${nuevoFolio}`;
                  }
                  
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
            
            // Encontrar el ID del sitio por su nombre
            let sitioId = item.data.sitio_id || null;
            if (!sitioId && (item.data.ubicacion || item.data.customData?.ubicacion)) {
              const ubiName = item.data.ubicacion || item.data.customData?.ubicacion;
              try {
                const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
                const match = sitios.find(s => s.cliente === clienteId && (s.nombre === ubiName || s.direccion === ubiName || s.id === ubiName));
                if (match) sitioId = match.id;
              } catch (e) {}
            }
            
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
              sitio_id: sitioId,
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
            if (item.data && item.data.id && item.data.data !== undefined) {
              payload = { id: item.data.id, data: item.data.data };
            } else {
              payload = { id: 'main', data: item.data };
            }
          } else if (item.table === 'kits_servicio' || item.table === 'machotes_servicio') {
            resTabla = 'config';
            payload = { id: 'kits_servicio', data: item.data };
          } else if (item.table === 'kits_servicio_sandbox') {
            resTabla = 'config';
            payload = { id: 'kits_servicio_sandbox', data: item.data };
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
              limite: (item.data.limite !== undefined && !isNaN(Number(item.data.limite))) ? Number(item.data.limite) : 0,
              saldo_utilizado: (item.data.saldoUtilizado !== undefined && !isNaN(Number(item.data.saldoUtilizado))) ? Number(item.data.saldoUtilizado) : 0,
              ultima_actualizacion: item.data.ultimaActualizacion || null,
              donde_comprar: item.data.dondeComprar || null,
              usuario_vinculado_id: (item.data.usuarioVinculadoId && item.data.usuarioVinculadoId.trim().length === 36) ? item.data.usuarioVinculadoId.trim() : null
            };
          } else if (item.table === 'levantamientos') {
            payload = levantamientoToRow(item.data);
            // Upload Base64 evidences if any
            if (item.data.evidencias_base64 && Object.keys(item.data.evidencias_base64).length > 0) {
              let actualizoLocal = false;
              const localLev = JSON.parse(localStorage.getItem('sapi_levantamientos') || '[]');
              const idx = localLev.findIndex(l => l.id === item.data.id);

              if (!payload.evidencias) payload.evidencias = {};
              for (const [k, v] of Object.entries(item.data.evidencias_base64)) {
                if (v && v.startsWith('data:')) {
                  try {
                    const url = await window.uploadBase64ToStorage(v, 'evidencias', `levantamientos/${payload.folio}_${k}.jpg`);
                    if (url) {
                      payload.evidencias[k] = url;
                      actualizoLocal = true;
                    }
                  } catch (e) {
                    console.error('[Sync] Error subiendo evidencia de levantamiento:', e);
                  }
                }
              }

              if (actualizoLocal) {
                // Actualizar item.data para que tenga las URLs de storage y no base64
                item.data.evidencias = payload.evidencias;
                delete item.data.evidencias_base64;

                // Actualizar localStorage
                if (idx > -1) {
                  localLev[idx].evidencias = payload.evidencias;
                  delete localLev[idx].evidencias_base64;
                  localStorage.setItem('sapi_levantamientos', JSON.stringify(localLev));
                }

                // Actualizar estado global en memoria
                if (typeof window.levantamientos !== 'undefined') {
                  const globalIdx = window.levantamientos.findIndex(l => l.id === item.data.id);
                  if (globalIdx > -1) {
                    window.levantamientos[globalIdx].evidencias = payload.evidencias;
                    delete window.levantamientos[globalIdx].evidencias_base64;
                  }
                }
              }
            }
          } else if (item.table === 'envios') {
            payload = typeof window.envioToRow === 'function' ? window.envioToRow(item.data) : item.data;
          } else {
            payload = item.data;
          }

          let { error: upsertErr } = await sb.from(resTabla).upsert(payload, { onConflict: 'id' });

          // Bucle dinámico de autorecuperación para columnas no migradas en Supabase (PGRST204 / schema cache)
          let queueColRetries = 0;
          while (upsertErr && upsertErr.message && (upsertErr.message.includes('schema cache') || upsertErr.message.includes('column') || upsertErr.code === 'PGRST204') && queueColRetries < 8) {
            queueColRetries++;
            const match = upsertErr.message.match(/['"]([^'"]+)['"]\s+column/i) || 
                          upsertErr.message.match(/column\s+['"]([^'"]+)['"]/i) ||
                          upsertErr.message.match(/column\s+of\s+['"]([^'"]+)['"]/i);
            const missingCol = match ? match[1] : null;
            
            if (missingCol && payload[missingCol] !== undefined) {
              console.warn(`[Sync Queue] Columna '${missingCol}' no existe en Supabase (${resTabla}). Eliminando y reintentando...`);
              delete payload[missingCol];
              const resRetry = await sb.from(resTabla).upsert(payload, { onConflict: 'id' });
              upsertErr = resRetry.error;
            } else {
              const knownOptionals = ['prioridad', 'orden', 'fecha_modificacion', 'updated_at', 'modificado_por', 'fecha_resolucion', 'resolucion', 'resuelto_por', 'archivos'];
              let deletedAny = false;
              knownOptionals.forEach(col => {
                if (payload[col] !== undefined) {
                  delete payload[col];
                  deletedAny = true;
                }
              });
              if (!deletedAny) break;
              const resRetry = await sb.from(resTabla).upsert(payload, { onConflict: 'id' });
              upsertErr = resRetry.error;
            }
          }

          if (upsertErr && (upsertErr.code === '23503' || (upsertErr.message && upsertErr.message.includes('foreign key')))) {
            console.warn(`[Sync Queue] Violación FK en ${resTabla}. Reintentando con claves foráneas neutralizadas...`);
            const fallbackPayload = { ...payload };
            if (fallbackPayload.sitio !== undefined) fallbackPayload.sitio = null;
            if (fallbackPayload.sitio_id !== undefined) fallbackPayload.sitio_id = null;
            if (fallbackPayload.cliente !== undefined && upsertErr.message.includes('cliente')) fallbackPayload.cliente = null;
            if (fallbackPayload.ticket_id !== undefined && upsertErr.message.includes('ticket')) fallbackPayload.ticket_id = null;
            const resFallback = await sb.from(resTabla).upsert(fallbackPayload, { onConflict: 'id' });
            upsertErr = resFallback.error;
          }
          error = upsertErr;

          if (item.table === 'ordenes' && !error) {
            try {
              const ordId = item.data.id;
              
              // 1. SINCRONIZAR BITÁCORAS DE AVANCES
              const bitacorasMemoria = item.data.bitacora || [];
              if (bitacorasMemoria.length > 0) {
                const cleanFecha = (f) => {
                  if (!f) return new Date().toISOString();
                  if (f.length === 10) return `${f}T12:00:00-06:00`;
                  return f;
                };
                const filasBitacora = bitacorasMemoria.map(b => {
                  const dbTecnico = getValidDbTecnico(b.tecnico);
                  let dbNota = b.nota || 'Programado por supervisor.';
                  if (!dbTecnico && b.tecnico) {
                    dbNota += `\n[Técnico: ${b.tecnico}]`;
                  }
                  if (typeof b.realizado !== 'undefined') {
                    dbNota += `\n[Realizado: ${b.realizado}]`;
                  }
                  if (b.programadoEntrada && b.programadoSalida) {
                    dbNota += `\n[Prog: ${b.programadoEntrada}-${b.programadoSalida}]`;
                  }
                  if (b.desviacion) {
                    dbNota += `\n[Desv: ${b.desviacion}]`;
                  }
                  if (b.asignadoPorName) {
                    dbNota += `\n[AsignadoPor: ${b.asignadoPorName}]`;
                  }
                  return {
                    id: b.id,
                    orden_id: ordId,
                    fecha: cleanFecha(b.fecha),
                    tecnico: dbTecnico || null,
                    nota: dbNota,
                    entrada: b.entrada || null,
                    salida: b.salida || null,
                    hora_inicio: b.hora_inicio || null,
                    horas_traslado: b.horas_traslado || null,
                    programado_horas_traslado: b.programadoHorasTraslado || null,
                    hora_fin_regreso: b.hora_fin_regreso || null,
                    horas_regreso: b.horas_regreso || null,
                    programado_horas_regreso: b.programadoHorasRegreso || null,
                    tipo: b.tipo || 'Servicio'
                  };
                });
                const { error: upsertBitErr } = await sb.from('orden_bitacora').upsert(filasBitacora, { onConflict: 'id' });
                if (upsertBitErr) throw upsertBitErr;
              }

              // 2. SINCRONIZAR REFACCIONES UTILIZADAS Y NECESARIAS
              const refNecesarias = item.data.ref_necesarias || [];
              const refUtilizadas = item.data.ref_utilizadas || [];
              
              // Borrar refacciones previas de esta orden
              const { error: delRefErr } = await sb.from('orden_refacciones').delete().eq('orden_id', ordId);
              if (delRefErr) throw delRefErr;
              
              const refaccionesDb = await window.loadRefaccionesLocal();
              const getRefId = (clave, descripcion) => {
                let match = null;
                if (clave) {
                  match = refaccionesDb.find(r => r.codigo === clave || r.id === clave);
                }
                if (!match && descripcion) {
                  const descClean = descripcion.trim().toLowerCase();
                  match = refaccionesDb.find(r => r.descripcion && r.descripcion.trim().toLowerCase() === descClean);
                }
                return match ? match.id : null;
              };

              const filasRefacciones = [];
              refNecesarias.forEach((r, index) => {
                const refId = getRefId(r.clave || r.codigo, r.descripcion);
                if (refId) {
                  filasRefacciones.push({
                    id: `ref_nec_${ordId}_${index}`,
                    orden_id: ordId,
                    refaccion_id: refId,
                    cantidad: parseInt(r.cantidad || r.cant || 1, 10),
                    precio_unitario: parseFloat(r.precio || r.precioUnitario || 0),
                    estado: r.estado || 'Solicitado',
                    estatus_pedido: r.estatusPedido || 'Por Pedir'
                  });
                } else {
                  console.warn(`[Sync] No se encontró ID para la refacción necesaria: ${r.descripcion} (Clave: ${r.clave})`);
                }
              });
              refUtilizadas.forEach((r, index) => {
                const refId = getRefId(r.clave || r.codigo, r.descripcion);
                if (refId) {
                  filasRefacciones.push({
                    id: `ref_ut_${ordId}_${index}`,
                    orden_id: ordId,
                    refaccion_id: refId,
                    cantidad: parseInt(r.cantidad || r.cant || 1, 10),
                    precio_unitario: parseFloat(r.precio || r.precioUnitario || 0),
                    estado: r.estado || 'Utilizado',
                    estatus_pedido: r.estatusPedido || null
                  });
                } else {
                  console.warn(`[Sync] No se encontró ID para la refacción utilizada: ${r.descripcion} (Clave: ${r.clave})`);
                }
              });

              if (filasRefacciones.length > 0) {
                const { error: insRefErr } = await sb.from('orden_refacciones').insert(filasRefacciones);
                if (insRefErr) throw insRefErr;
              }

              // 3. SUBIDA ASÍNCRONA DE FIRMAS Y PERSISTENCIA RELACIONAL
              let firmaTecUrl = item.data.firma_tecnico_base64 || null;
              let firmaCliUrl = item.data.firma_cliente_base64 || null;
              
              // Evitar sobrescribir firmas previas con null recuperándolas de la BD si existen
              try {
                const { data: existingFirm } = await sb.from('orden_firmas').select('firma_tecnico_url, firma_cliente_url, nombre_firmante').eq('orden_id', ordId).maybeSingle();
                if (existingFirm) {
                  if (firmaTecUrl !== '__DELETED__' && !firmaTecUrl && existingFirm.firma_tecnico_url) {
                    firmaTecUrl = existingFirm.firma_tecnico_url;
                    item.data.firma_tecnico_base64 = existingFirm.firma_tecnico_url;
                  }
                  if (firmaCliUrl !== '__DELETED__' && !firmaCliUrl && existingFirm.firma_cliente_url) {
                    firmaCliUrl = existingFirm.firma_cliente_url;
                    item.data.firma_cliente_base64 = existingFirm.firma_cliente_url;
                  }
                  if (!item.data.firma_cliente_nombre && existingFirm.nombre_firmante) {
                    item.data.firma_cliente_nombre = existingFirm.nombre_firmante;
                  }
                }
              } catch (e) {
                console.error('[Sync] Error al recuperar firmas existentes:', e);
              }

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

               if (firmaTecUrl || firmaCliUrl || firmaTecUrl === '__DELETED__' || firmaCliUrl === '__DELETED__') {
                const firmaPayload = {
                  orden_id: ordId,
                  firma_cliente_url: firmaCliUrl === '__DELETED__' ? null : (firmaCliUrl || null),
                  nombre_firmante: item.data.firma_cliente_nombre || null,
                  puesto_firmante: null,
                  firma_tecnico_url: firmaTecUrl === '__DELETED__' ? null : (firmaTecUrl || null),
                  fecha_firma: item.data.firma_cliente_fecha || item.data.firma_tecnico_fecha || new Date().toISOString()
                };
                const { error: upsertFirmErr } = await sb.from('orden_firmas').upsert(firmaPayload, { onConflict: 'orden_id' });
                if (upsertFirmErr) throw upsertFirmErr;
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
                    const { error: upsertHoroErr } = await sb.from('maquinaria_horometros').upsert(horoPayload, { onConflict: 'id' });
                    if (upsertHoroErr) {
                      console.error('[Sync] Error upserting horometro (ignored):', upsertHoroErr);
                    }
                  }
                }
              }

            } catch (ordErr) {
              console.error('[Sync] Error al procesar sub-entidades de orden:', ordErr.message || ordErr);
              error = ordErr;
            }
          }
          if (item.table === 'ordenes' && !error) {
            try {
              const localOrd = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
              const idx = localOrd.findIndex(o => o.id === item.data.id);
              if (idx > -1) {
                localOrd[idx]._synced = true;
                localOrd[idx].firma_tecnico_base64 = item.data.firma_tecnico_base64;
                localOrd[idx].firma_cliente_base64 = item.data.firma_cliente_base64;
                localStorage.setItem('sapi_ordenes', JSON.stringify(localOrd));
                console.log(`[Sync] Marcado orden local como sincronizada y actualizado firmas para ${item.data.id}`);
              }
              if (typeof ordenes !== 'undefined') {
                const idxGlobal = ordenes.findIndex(o => o.id === item.data.id);
                if (idxGlobal > -1) {
                  ordenes[idxGlobal]._synced = true;
                  ordenes[idxGlobal].firma_tecnico_base64 = item.data.firma_tecnico_base64;
                  ordenes[idxGlobal].firma_cliente_base64 = item.data.firma_cliente_base64;
                }
              }
            } catch (loErr) {
              console.error('[Sync] Error al marcar orden local como sincronizada:', loErr);
            }
          }
          if (item.table === 'tickets' && !error) {
            try {
              const localTk = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
              const idx = localTk.findIndex(t => t.id === item.data.id);
              if (idx > -1) {
                localTk[idx]._synced = true;
                localStorage.setItem('sapi_tickets', JSON.stringify(localTk));
                console.log(`[Sync] Marcado ticket local como sincronizado (_synced: true) para ${item.data.id}`);
              }
            } catch (ltErr) {
              console.error('[Sync] Error al marcar ticket local como sincronizado:', ltErr);
            }
          }
          if (item.table === 'gastos' && !error) {
            try {
              const localGast = JSON.parse(localStorage.getItem('sapi_gastos') || '[]');
              const idx = localGast.findIndex(g => g.id === item.data.id);
              if (idx > -1) {
                localGast[idx]._synced = true;
                localStorage.setItem('sapi_gastos', JSON.stringify(localGast));
                console.log(`[Sync] Marcado gasto local como sincronizado (_synced: true) para ${item.data.id}`);
              }
            } catch (lgErr) {
              console.error('[Sync] Error al marcar gasto local como sincronizado:', lgErr);
            }
          }
          if (item.table === 'levantamientos' && !error) {
            try {
              const localLev = JSON.parse(localStorage.getItem('sapi_levantamientos') || '[]');
              const idx = localLev.findIndex(l => l.id === item.data.id);
              if (idx > -1) {
                localLev[idx]._synced = true;
                localStorage.setItem('sapi_levantamientos', JSON.stringify(localLev));
                if (typeof window.levantamientos !== 'undefined') {
                  const globalIdx = window.levantamientos.findIndex(l => l.id === item.data.id);
                  if (globalIdx > -1) window.levantamientos[globalIdx]._synced = true;
                }
                if (typeof window.renderLevantamientos === 'function') {
                  window.renderLevantamientos();
                }
                console.log(`[Sync] Marcado levantamiento local como sincronizado (_synced: true) para ${item.data.id}`);
              }
            } catch (llErr) {
              console.error('[Sync] Error al marcar levantamiento local como sincronizado:', llErr);
            }
          }
        } else if (item.action === 'delete') {
          const { error: deleteErr } = await sb.from(resTabla).delete().eq('id', item.data.id);
          error = deleteErr;
        }

        if (error) {
          // La telemetría es no-crítica: siempre se descarta silenciosamente sin notificar al usuario.
          if (item.table === 'sapi_telemetry') {
            console.warn('[Sync] Telemetría no enviada, descartando sin notificar:', error.message);
            const q = getSyncQueue();
            const idx = q.findIndex(x => x.table === item.table && x.action === item.action && x.data?.id === item.data?.id);
            if (idx > -1) { q.splice(idx, 1); saveSyncQueue(q); }
            continue;
          }

          console.error(`[Sync] Error en elemento (${item.table} - ${item.action}):`, error.message);
          
          // Guardar el mensaje de error en este item específico de la cola
          const q = getSyncQueue();
          const targetIdx = q.findIndex(x => 
            x.table === item.table && 
            x.action === item.action && 
            ((x.data && item.data && (x.data.id === item.data.id || x.data.idInterno === item.data.idInterno || x.data.serie === item.data.serie)) || (x.id && item.id && x.id === item.id))
          );
          if (targetIdx > -1) {
            q[targetIdx].lastError = error.message;
            q[targetIdx].lastErrorCode = error.code || 'N/A';
            q[targetIdx].retries = (q[targetIdx].retries || 0) + 1;
            q[targetIdx].lastAttempt = Date.now();
            saveSyncQueue(q);
          }
          
          const isNetworkError = error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('network') ||
            error.message.includes('timeout') ||
            error.message.includes('connection') ||
            error.message.includes('TypeError') ||
            error.message.includes('fetch') ||
            error.message.includes('schema cache') ||
            error.message.includes('503') ||
            error.message.includes('502') ||
            error.message.includes('Service Unavailable') ||
            error.message.includes('Bad Gateway')
          );

          if (isNetworkError) {
            consecutiveNetworkErrors++;
            if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS && !navigator.onLine) {
              console.warn('[Sync] Red totalmente desconectada tras múltiples intentos. Pausando cola.');
              break;
            }
            console.warn(`[Sync] Fallo temporal en ${item.table}. Continuando con los demás elementos de la cola...`);
          } else {
            console.warn(`[Sync] Error permanente en ${item.table}: ${error.message}. Pasando al siguiente elemento.`);
            consecutiveNetworkErrors = 0;
          }

        } else {
          // ÉXITO:
          consecutiveNetworkErrors = 0;
          successCount++;

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
                registro_id: item.data ? (item.data.id || item.data.folio) : item.id,
                detalles: {
                  folio: item.data ? (item.data.folio || item.data.ordenFolio || null) : null,
                  timestamp: Date.now()
                }
              };
              if (typeof sb.auth.getSession === 'function') {
                const sessionRes = await sb.auth.getSession().catch(() => null);
                if (sessionRes && sessionRes.data && sessionRes.data.session) {
                  sb.from('auditoria_logs').insert(logPayload).then(() => {}).catch(() => {});
                }
              }
            } catch(logErr) {
              console.warn('[Sync] Error al escribir log de auditoria:', logErr.message);
            }
          }

          // Eliminar el elemento sincronizado con éxito de la cola
          const q = getSyncQueue();
          const targetIdx = q.findIndex(x => 
            x.table === item.table && 
            x.action === item.action && 
            ((x.data && item.data && (x.data.id === item.data.id || x.data.idInterno === item.data.idInterno || x.data.serie === item.data.serie)) || (x.id && item.id && x.id === item.id))
          );
          if (targetIdx > -1) {
            q.splice(targetIdx, 1);
            saveSyncQueue(q);
          }
        }
      } catch (e) {
        console.error(`[Sync] Excepción en processSyncQueue para ${item.table}:`, e.message);
        const q = getSyncQueue();
        const targetIdx = q.findIndex(x => 
          x.table === item.table && 
          x.action === item.action && 
          ((x.data && item.data && (x.data.id === item.data.id || x.data.idInterno === item.data.idInterno || x.data.serie === item.data.serie)) || (x.id && item.id && x.id === item.id))
        );
        if (targetIdx > -1) {
          q[targetIdx].lastError = e.message;
          q[targetIdx].lastErrorCode = e.code || 'N/A';
          q[targetIdx].retries = (q[targetIdx].retries || 0) + 1;
          q[targetIdx].lastAttempt = Date.now();
          saveSyncQueue(q);
        }
        if (!navigator.onLine) {
          break;
        }
      }
    } // Fin del for

    if (successCount > 0) {
      if (typeof window.cargarDatosDeSupabase === 'function') {
        try {
          await window.cargarDatosDeSupabase();
          if (window._isSyncManualForced) {
            if (window.mostrarNotificacion) {
              window.mostrarNotificacion('¡Sincronización completada! Se sincronizaron ' + successCount + ' elemento(s) pendiente(s).', 'success');
            }
          }
        } catch (err) {
          console.error('[Sync] Error al recargar datos tras sincronización:', err);
          window.dispatchEvent(new Event('supabase_datos_cargados'));
        }
      } else {
        window.dispatchEvent(new Event('supabase_datos_cargados'));
        if (window._isSyncManualForced) {
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('¡Sincronización completada! Se sincronizaron ' + successCount + ' elemento(s) pendiente(s).', 'success');
          }
        }
      }
    } else {
      if (window._isSyncManualForced && getSyncQueue().length > 0) {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('No se pudo subir ningún elemento. Revisa tu conexión a internet.', 'error');
        }
      }
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
  if (pendingCount > 0) {
    console.log('[Sync] Cola de sincronización pendiente: ' + pendingCount + ' elementos.');
  }

  container.classList.remove('status-online', 'status-syncing', 'status-offline');

  const showOfflineUI = () => {
    container.classList.remove('status-online', 'status-syncing');
    container.classList.add('status-offline');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'wifi-off');
      iconEl.style.animation = 'none';
    }
    
    // Leer y formatear la última vez que se sincronizó
    const lastSyncStr = localStorage.getItem('sapi_last_sync_timestamp') || window.lastSyncTimestamp;
    let lastSyncFormatted = '';
    if (lastSyncStr) {
      try {
        const d = new Date(lastSyncStr);
        lastSyncFormatted = ' (' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + ')';
      } catch (e) {}
    }

    if (textEl) textEl.textContent = 'Sin conexión' + lastSyncFormatted;
    
    // Tooltip informativo
    let tooltipMsg = 'Cuando está fuera de línea se podrá ver a qué hora fue la última vez que se sincronizó.';
    if (lastSyncStr) {
      try {
        const d = new Date(lastSyncStr);
        const fullDate = d.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        tooltipMsg = 'Cuando está fuera de línea se podrá ver a qué hora fue la última vez que se sincronizó. Última sincronización: ' + fullDate;
      } catch (e) {}
    }
    container.setAttribute('title', tooltipMsg);

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
    
    const lastSyncStr = localStorage.getItem('sapi_last_sync_timestamp') || window.lastSyncTimestamp;
    let lastSyncFormatted = 'Nunca';
    if (lastSyncStr) {
      try {
        const d = new Date(lastSyncStr);
        lastSyncFormatted = d.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (e) {}
    }
    
    container.setAttribute('title', 'Conectado. Última sincronización: ' + lastSyncFormatted + '. Clic para ver detalles.');
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

window.forzarSincronizacionManual = async function() {
  window._isSyncManualForced = true;

  const trySync = async () => {
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    if (queue.length === 0) {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Descargando datos recientes de Supabase...', 'info');
      }
      if (typeof window.cargarDatosDeSupabase === 'function') {
        try {
          await window.cargarDatosDeSupabase();
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('Datos actualizados correctamente.', 'success');
          }
        } catch (err) {
          console.error('[Sync] Error al descargar datos:', err);
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('Error al descargar datos: ' + (err?.message || err), 'error');
          }
          throw err;
        } finally {
          window._isSyncManualForced = false;
        }
      } else {
        window._isSyncManualForced = false;
      }
    } else {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Iniciando sincronización de cambios locales...', 'info');
      }
      try {
        await processSyncQueue();
      } catch (err) {
        console.error('[Sync] Error al procesar cola de sincronización:', err);
        throw err;
      } finally {
        window._isSyncManualForced = false;
      }
    }
  };

  if (!navigator.onLine && !window.isConnectionVerifiedOnline) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    try {
      await fetch('https://mupevytlssqcbhlmzmcp.supabase.co', {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = true;
      if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
      return await trySync();
    } catch (err) {
      clearTimeout(timeoutId);
      window.isConnectionVerifiedOnline = false;
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('No se puede sincronizar sin conexión a internet.', 'warning');
      }
      window._isSyncManualForced = false;
      throw new Error('No se puede sincronizar sin conexión a internet.');
    }
  } else {
    return await trySync();
  }
};

window.limpiarColaSincronizacion = function() {
  localStorage.setItem('sapi_sync_queue', '[]');
  if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
  console.log('[Sync] Cola de sincronización limpiada manualmente.');
  return 'Cola de sincronización vaciada con éxito.';
};

window.cerrarModalSyncDetalles = function() {
  const modal = document.getElementById('modal-sync-detalles');
  if (modal) modal.classList.remove('open');
  const dynModal = document.getElementById('sapi-dynamic-sync-modal');
  if (dynModal) dynModal.remove();
};

window.ejecutarForzarSyncDesdeModal = function() {
  window.cerrarModalSyncDetalles();
  window.forzarSincronizacionManual();
};

window.descartarErroresSincronizacion = function() {
  let queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
  const conError = queue.filter(item => item && item.lastError).length;
  if (conError === 0) {
    if (window.mostrarNotificacion) window.mostrarNotificacion('No hay elementos con error en la cola.', 'info');
    return;
  }
  if (confirm(`¿Deseas descartar y eliminar los ${conError} elemento(s) que tienen error? Los cambios locales no subidos de esos elementos se omitirán.`)) {
    queue = queue.filter(item => !item || !item.lastError);
    localStorage.setItem('sapi_sync_queue', JSON.stringify(queue));
    if (typeof window.verDetallesSincronizacion === 'function') {
      window.verDetallesSincronizacion();
    }
    if (window.updateSyncStatusUI) window.updateSyncStatusUI();
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`${conError} elemento(s) con error descartados.`, 'success');
    }
  }
};

window.reintentarItemSincronizacion = async function(table, itemId) {
  let queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
  const idx = queue.findIndex(q => q.table === table && q.data && (q.data.id === itemId || q.data.idInterno === itemId || q.data.serie === itemId));
  if (idx > -1) {
    delete queue[idx].lastError;
    delete queue[idx].lastErrorCode;
    queue[idx].retries = 0;
    const targetItem = queue.splice(idx, 1)[0];
    queue.unshift(targetItem);
    localStorage.setItem('sapi_sync_queue', JSON.stringify(queue));
    if (typeof window.verDetallesSincronizacion === 'function') {
      window.verDetallesSincronizacion();
    }
    window.forzarSincronizacionManual();
  }
};

window.verDetallesSincronizacion = function() {
  try {
    console.log('[Sync] verDetallesSincronizacion invocado.');
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const conError = queue.filter(item => item && item.lastError).length;
    
    const listaEl = document.getElementById('sync-detalles-lista');
    const titleEl = document.querySelector('#modal-sync-detalles h2');
    const descEl = document.querySelector('#modal-sync-detalles .modal-body p');
    const actionBtn = document.getElementById('btn-import-cards-confirm') || document.querySelector('#modal-sync-detalles .form-actions button.btn-primary');
    
    if (listaEl) {
      listaEl.innerHTML = '';
      if (queue.length === 0) {
        if (titleEl) titleEl.textContent = 'Estado del Sistema';
        if (descEl) descEl.textContent = 'Todos tus cambios locales están sincronizados con la nube. Puedes forzar una descarga completa para obtener las últimas actualizaciones:';
        if (actionBtn) actionBtn.textContent = 'Descargar Nube (Sincronizar)';
        
        const emptyEl = document.createElement('div');
        emptyEl.style.textAlign = 'center';
        emptyEl.style.padding = '1.5rem';
        emptyEl.style.color = 'var(--text-muted)';
        emptyEl.style.fontSize = '0.9rem';
        emptyEl.innerHTML = '<i data-lucide="cloud-lightning" style="width:36px;height:36px;margin:0 auto 0.5rem auto;display:block;color:var(--accent,#e8820c);"></i> No hay cambios locales pendientes.';
        listaEl.appendChild(emptyEl);
      } else {
        if (titleEl) titleEl.textContent = `Cambios Pendientes (${queue.length})`;
        if (descEl) {
          descEl.innerHTML = `Tienes <strong>${queue.length}</strong> cambio${queue.length > 1 ? 's' : ''} local${queue.length > 1 ? 'es' : ''} esperando a subir a Supabase${conError > 0 ? ` (<span style="color:#ef4444; font-weight:700;">${conError} con error</span>)` : ''}:`;
        }
        if (actionBtn) actionBtn.textContent = `Sincronizar Ahora (${queue.length})`;
        
        // Banner para descartar errores si hay items fallidos
        if (conError > 0) {
          const bannerErr = document.createElement('div');
          bannerErr.style.display = 'flex';
          bannerErr.style.justifyContent = 'space-between';
          bannerErr.style.alignItems = 'center';
          bannerErr.style.background = 'rgba(239, 68, 68, 0.08)';
          bannerErr.style.border = '1px solid rgba(239, 68, 68, 0.2)';
          bannerErr.style.borderRadius = '8px';
          bannerErr.style.padding = '0.5rem 0.75rem';
          bannerErr.style.fontSize = '0.78rem';
          bannerErr.style.color = '#ef4444';
          bannerErr.style.fontWeight = '600';
          bannerErr.style.marginBottom = '0.5rem';
          bannerErr.innerHTML = `
            <span>⚠️ ${conError} elemento(s) no se pudieron subir.</span>
            <button type="button" class="btn-secondary" onclick="window.descartarErroresSincronizacion()" style="padding:0.2rem 0.5rem; font-size:0.72rem; border-color:rgba(239,68,68,0.3); color:#ef4444; background:white;">Descartar Errores</button>
          `;
          listaEl.appendChild(bannerErr);
        }

        queue.forEach(item => {
          if (!item) return;
          let desc = 'Sin descripción';
          let itemId = null;
          if (item.data) {
            itemId = item.data.id || item.data.idInterno || item.data.serie || item.data.folio;
            desc = item.data.folio || item.data.asunto || item.data.nombre || item.data.razon_social || item.data.titulo || item.data.descripcion || item.data.concepto || item.data.cliente || item.data.id || 'Sin descripción';
          }
          
          const itemEl = document.createElement('div');
          itemEl.style.display = 'flex';
          itemEl.style.flexDirection = 'column';
          itemEl.style.gap = '0.45rem';
          itemEl.style.background = item.lastError ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card, #ffffff)';
          itemEl.style.border = item.lastError ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border, #e5e7eb)';
          itemEl.style.borderRadius = '10px';
          itemEl.style.padding = '0.75rem 0.9rem';
          itemEl.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
          
          const headerEl = document.createElement('div');
          headerEl.style.display = 'flex';
          headerEl.style.alignItems = 'center';
          headerEl.style.gap = '0.5rem';
          headerEl.style.fontSize = '0.7rem';
          headerEl.style.fontWeight = '700';
          headerEl.style.justifyContent = 'space-between';
          
          const badgeContainer = document.createElement('div');
          badgeContainer.style.display = 'flex';
          badgeContainer.style.alignItems = 'center';
          badgeContainer.style.gap = '0.4rem';
          badgeContainer.style.flexWrap = 'wrap';
          
          const tableBadge = document.createElement('span');
          tableBadge.textContent = item.table;
          tableBadge.style.background = 'rgba(232, 130, 12, 0.08)';
          tableBadge.style.color = 'var(--accent, #e8820c)';
          tableBadge.style.border = '1px solid rgba(232, 130, 12, 0.2)';
          tableBadge.style.padding = '0.15rem 0.45rem';
          tableBadge.style.borderRadius = '6px';
          tableBadge.style.textTransform = 'uppercase';
          tableBadge.style.fontWeight = '700';
          tableBadge.style.fontSize = '0.65rem';
          tableBadge.style.letterSpacing = '0.05em';
          
          const actionBadge = document.createElement('span');
          actionBadge.textContent = item.action;
          actionBadge.style.background = 'var(--bg-hover, #f3f4f6)';
          actionBadge.style.color = 'var(--text-secondary, #4b5563)';
          actionBadge.style.border = '1px solid var(--border, #e5e7eb)';
          actionBadge.style.padding = '0.15rem 0.45rem';
          actionBadge.style.borderRadius = '6px';
          actionBadge.style.textTransform = 'uppercase';
          actionBadge.style.fontWeight = '700';
          actionBadge.style.fontSize = '0.65rem';
          actionBadge.style.letterSpacing = '0.05em';
          
          badgeContainer.appendChild(tableBadge);
          badgeContainer.appendChild(actionBadge);

          if (item.retries > 0) {
            const retriesBadge = document.createElement('span');
            retriesBadge.textContent = `${item.retries} intento${item.retries > 1 ? 's' : ''}`;
            retriesBadge.style.background = 'rgba(100, 116, 139, 0.1)';
            retriesBadge.style.color = 'var(--text-muted, #64748b)';
            retriesBadge.style.padding = '0.15rem 0.4rem';
            retriesBadge.style.borderRadius = '6px';
            retriesBadge.style.fontSize = '0.65rem';
            retriesBadge.style.fontWeight = '600';
            badgeContainer.appendChild(retriesBadge);
          }

          const actionIcons = document.createElement('div');
          actionIcons.style.display = 'flex';
          actionIcons.style.alignItems = 'center';
          actionIcons.style.gap = '0.4rem';

          if (item.lastError && itemId) {
            const retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.innerHTML = '⟳';
            retryBtn.style.background = 'rgba(232, 130, 12, 0.1)';
            retryBtn.style.border = '1px solid rgba(232, 130, 12, 0.25)';
            retryBtn.style.color = 'var(--accent, #e8820c)';
            retryBtn.style.cursor = 'pointer';
            retryBtn.style.fontSize = '0.85rem';
            retryBtn.style.borderRadius = '4px';
            retryBtn.style.padding = '1px 6px';
            retryBtn.title = 'Reintentar este elemento ahora';
            retryBtn.onclick = function() {
              window.reintentarItemSincronizacion(item.table, itemId);
            };
            actionIcons.appendChild(retryBtn);
          }
          
          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.innerHTML = '✕';
          deleteBtn.style.background = 'transparent';
          deleteBtn.style.border = 'none';
          deleteBtn.style.color = 'var(--text-muted)';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.fontSize = '0.9rem';
          deleteBtn.style.padding = '0 0.2rem';
          deleteBtn.title = 'Eliminar este cambio pendiente (ignorar)';
          deleteBtn.onclick = function() {
            if (confirm('¿Estás seguro de que deseas ignorar y eliminar este cambio local? Los datos no se subirán a la nube.')) {
              let currentQueue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
              currentQueue = currentQueue.filter(qItem => JSON.stringify(qItem) !== JSON.stringify(item));
              localStorage.setItem('sapi_sync_queue', JSON.stringify(currentQueue));
              window.verDetallesSincronizacion();
              if (window.updateSyncStatusUI) window.updateSyncStatusUI();
            }
          };
          actionIcons.appendChild(deleteBtn);
          
          headerEl.appendChild(badgeContainer);
          headerEl.appendChild(actionIcons);
          
          const bodyEl = document.createElement('div');
          bodyEl.textContent = desc;
          bodyEl.style.fontSize = '0.84rem';
          bodyEl.style.fontWeight = '600';
          bodyEl.style.color = 'var(--text-primary)';
          bodyEl.style.wordBreak = 'break-word';
          bodyEl.style.lineHeight = '1.35';
          
          itemEl.appendChild(headerEl);
          itemEl.appendChild(bodyEl);

          // Si el elemento falló en un intento previo, mostrar el error en rojo
          if (item.lastError) {
            const errEl = document.createElement('div');
            errEl.style.fontSize = '0.72rem';
            errEl.style.color = '#ef4444';
            errEl.style.marginTop = '0.2rem';
            errEl.style.fontWeight = '600';
            errEl.style.background = 'rgba(239, 68, 68, 0.06)';
            errEl.style.border = '1px solid rgba(239, 68, 68, 0.15)';
            errEl.style.padding = '0.3rem 0.5rem';
            errEl.style.borderRadius = '6px';
            errEl.innerHTML = `⚠️ Error: ${item.lastError} ${item.lastErrorCode ? `(Código: ${item.lastErrorCode})` : ''}`;
            itemEl.appendChild(errEl);
          }
          listaEl.appendChild(itemEl);
        });
      }
    }
    
    const modal = document.getElementById('modal-sync-detalles');
    if (modal) {
      console.log('[Sync] Mostrando modal con clase open.');
      modal.classList.add('open');
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } else {
      console.error('[Sync] No se encontró el modal con id modal-sync-detalles.');
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Error: No se encontró el modal de sincronización. Fuerza la recarga (Cmd+Shift+R).', 'error');
      }
    }
  } catch (err) {
    console.error('[Sync] Error al abrir detalles de sincronización:', err);
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Error al abrir detalles de sincronización: ' + err.message, 'error');
    }
  }
};

let _onlineDebounceTimer = null;
window.addEventListener('online', () => {
  if (_onlineDebounceTimer) clearTimeout(_onlineDebounceTimer);
  _onlineDebounceTimer = setTimeout(() => {
    console.log('[Network] Conexión restablecida. Iniciando sincronización...');
    window.isConnectionVerifiedOnline = true;
    updateSyncStatusUI();
    processSyncQueue();
  }, 1500);
});

window.addEventListener('offline', () => {
  if (_onlineDebounceTimer) {
    clearTimeout(_onlineDebounceTimer);
    _onlineDebounceTimer = null;
  }
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

  // DESACTIVADO: La migración legacy local->Supabase ya no es necesaria en producción.
  // Evitamos llamadas innecesarias que provocaban errores de RLS (Row-Level Security)
  // en usuarios con roles no-administradores al iniciar la app.
  try {
    await window.cargarDatosDeSupabase();
  } catch (err) {
    console.error('[Supabase] Error cargando datos iniciales:', err.message);
  }
}

// ─── cargarDatosDeSupabase: Descarga la nube a localStorage / variables ─────

window._syncPromise = null;

// LIMPIEZA DE EMERGENCIA: Quitar clara_cards de la cola
try {
  let q = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
  const oldLen = q.length;
  q = q.filter(item => item.table !== 'clara_cards');
  if (q.length !== oldLen) {
    localStorage.setItem('sapi_sync_queue', JSON.stringify(q));
    console.log('[Sync] Se eliminaron clara_cards atascadas de la cola.');
  }
} catch(e) {}

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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('last_sync_error');
    }

    // Asegurar que la sesión de Supabase esté activa antes de realizar consultas.
    // Si no hay sesión activa (ej. expirada en este recargo o backdoor local), 
    // evitamos sobreescribir el caché local con arreglos vacíos por restricciones de RLS.
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const hasSession = !!(sessionData && sessionData.session);
      
      const savedSessionStr = localStorage.getItem('eurorep_session');
      let isBackdoorUser = false;
      if (savedSessionStr) {
        try {
          const saved = JSON.parse(savedSessionStr);
          if (saved && (saved.userId === 'superadmin' || saved.userId === 'tecnico_test')) {
            isBackdoorUser = true;
          }
        } catch(e) {}
      }

      if (!hasSession && !isBackdoorUser && !window._isSyncManualForced) {
        console.warn('[Sync] No hay sesión activa de Supabase ni de desarrollo. Omitiendo descarga para proteger el caché local.');
        window._isSyncingFromSupabase = false;
        window._syncPromise = null;
        window.dispatchEvent(new Event('supabase_datos_cargados'));
        return;
      }
    } catch (e) {
      console.error('[Sync] Error al verificar sesión en cargarDatosDeSupabase:', e);
    }

    let isClientOrEmpresa = false;
    try {
      const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
      const rol = String(session.viewMode || '').toLowerCase().trim();
      if (['empresa', 'cliente', 'cliente-consultor'].includes(rol)) {
        isClientOrEmpresa = true;
      }
    } catch (e) {}

    try {
    // Usuarios - Cargar desde user_roles para todos los usuarios.
    // Para evitar truncar el caché local debido a restricciones de RLS (que devuelven 0 o 1 fila del propio usuario)
    // solo sobreescribimos si obtenemos más de 1 usuario, o si somos admin/superadmin.
    try {
      let usuarios = null;
      let usuariosErr = null;
      try {
        usuarios = await fetchTablePaginated('user_roles', '*');
      } catch (err) {
        usuariosErr = err;
      }
      if (!usuariosErr && usuarios && usuarios.length > 0) {
        let cUsrs = [];
        try {
          cUsrs = await fetchTablePaginated('cliente_usuarios', '*');
        } catch(e) {
          console.warn('[Sync] No se pudo cargar cliente_usuarios:', e.message);
        }

        // Augment each user with their associated companies
        usuarios = usuarios.map(u => {
          const myCompanies = cUsrs.filter(cu => cu.usuario_id === u.id).map(cu => cu.cliente_id);
          return { ...u, empresas: myCompanies };
        });

        let isCurrentAdmin = false;
        try {
          const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
          if (session && ['superadmin', 'admin'].includes(session.viewMode)) {
            isCurrentAdmin = true;
          }
        } catch (e) {}

        if (usuarios.length > 1 || isCurrentAdmin) {
          localStorage.setItem('eurorep_usuarios', JSON.stringify(window.ensureBackdoorUsers(usuarios)));
        } else {
          try {
            const localUsers = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
            usuarios.forEach(u => {
              const idx = localUsers.findIndex(lu => lu.id === u.id);
              if (idx > -1) {
                localUsers[idx] = u;
              } else {
                localUsers.push(u);
              }
            });
            localStorage.setItem('eurorep_usuarios', JSON.stringify(window.ensureBackdoorUsers(localUsers)));
          } catch (e) {
            localStorage.setItem('eurorep_usuarios', JSON.stringify(window.ensureBackdoorUsers(usuarios)));
          }
        }
      }
    } catch (errU) {
      console.error('[Sync] Error al cargar user_roles:', errU);
    }

    // Config, Saldos y Roles (Procesados de forma unificada e independiente)
    let saldosSap = {};
    try {
      let configDb = null;
      let configErr = null;
      try {
        configDb = await fetchTablePaginated('config', '*');
      } catch (err) {
        configErr = err;
      }
      if (configErr) {
        console.error('[Sync] Error al descargar config de Supabase:', configErr.message);
      } else if (configDb && configDb.length > 0) {
        const mainCfg = configDb.find(c => c.id === 'main');
        if (mainCfg && mainCfg.data) {
          localStorage.setItem('eurorep_config', JSON.stringify(mainCfg.data));
        }
        const saldosCfg = configDb.find(c => c.id === 'saldos_sap');
        if (saldosCfg && saldosCfg.data) {
          saldosSap = saldosCfg.data;
        }
        const rolesCfg = configDb.find(c => c.id === 'roles');
        if (rolesCfg && rolesCfg.data) {
          localStorage.setItem('sapi_roles_config', JSON.stringify(rolesCfg.data));
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
        const kitsCfg = configDb.find(c => c.id === 'kits_servicio' || c.id === 'machotes_servicio');
        if (kitsCfg && Array.isArray(kitsCfg.data)) {
          if (typeof safeSetJSON === 'function') {
            safeSetJSON('sapi_kits_servicio', kitsCfg.data);
          } else {
            localStorage.setItem('sapi_kits_servicio', JSON.stringify(kitsCfg.data));
          }
        } else {
          // En modo Real, si no hay kits registrados en Supabase, la lista en produccion es vacia
          if (typeof safeSetJSON === 'function') {
            safeSetJSON('sapi_kits_servicio', []);
          } else {
            localStorage.setItem('sapi_kits_servicio', JSON.stringify([]));
          }
        }

        const kitsSandboxCfg = configDb.find(c => c.id === 'kits_servicio_sandbox');
        if (kitsSandboxCfg && Array.isArray(kitsSandboxCfg.data)) {
          if (typeof safeSetJSON === 'function') {
            safeSetJSON('sapi_kits_servicio_sandbox', kitsSandboxCfg.data);
          } else {
            localStorage.setItem('sapi_kits_servicio_sandbox', JSON.stringify(kitsSandboxCfg.data));
          }
        } else {
          // En modo Sandbox, si no hay kits registrados en Supabase, la lista de pruebas inicia vacía
          if (typeof safeSetJSON === 'function') {
            safeSetJSON('sapi_kits_servicio_sandbox', []);
          } else {
            localStorage.setItem('sapi_kits_servicio_sandbox', JSON.stringify([]));
          }
        }

        if (typeof window.filtrarKitsServicio === 'function') {
          window.filtrarKitsServicio();
        }
      }
    } catch (cfgErr) {
      console.error('[Sync] Excepción al procesar config:', cfgErr.message);
    }

    // Clientes (Reconstrucción Dinámica Normalizada)
    let clientes = null;
    try {
      clientes = await fetchTablePaginated('clientes', '*');
    } catch(e){}
    if (clientes && clientes.length > 0) {
      let sitiosDb = [];
      try { sitiosDb = await fetchTablePaginated('sitios', '*'); } catch(e){}
      let maqDb = [];
      try { maqDb = await fetchTablePaginated('maquinaria', '*'); } catch(e){}
      
      let cSups = [];
      let cTecs = [];
      try {
        cSups = await fetchTablePaginated('cliente_supervisores', '*');
      } catch(e){}
      try {
        cTecs = await fetchTablePaginated('cliente_tecnicos', '*');
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
          const cData = m.custom_data || {};
          const addClients = cData.clientesAdicionales || cData.empresasVinculadas || [];
          if (Array.isArray(addClients) && (addClients.includes(row.id) || addClients.includes(row.nombre))) return true;
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
                customData: cData,
                sitio_id: m.sitio_id
              });
            }
          }

          // Resolver nombre del sitio a partir del sitio_id
          let ubiName = m.ubicacion || cData.ubicacion || 'N/A';
          if (m.sitio_id) {
            const sMatch = (sitiosDb || []).find(s => s.id === m.sitio_id);
            if (sMatch) ubiName = sMatch.nombre;
          }

          return {
            id: m.id,
            serie: m.serie,
            marca: m.marca,
            modelo: m.modelo,
            anio: m.anio,
            cliente: row.nombre,
            idInterno: m.id_interno || m.id,
            descripcion: m.descripcion,
            tipo: m.tipo || cData.tipo || 'N/A',
            numeroEconomico: m.numero_economico || cData.numeroEconomico || 'N/A',
            numeroMotor: m.numero_motor || cData.numeroMotor || 'N/A',
            venta: m.venta || cData.venta || '',
            ubicacion: ubiName,
            sitio_id: m.sitio_id || null,
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

    // Tickets — SOLO sobreescribir local si la consulta fue exitosa
    let ticketsDb = null;
    let ticketsError = null;
    let idsWithPedido = new Set();
    let idsWithCotizacion = new Set();
    try {
      // Descargar columnas principales del ticket en lotes directos de alta velocidad (sin ordenamiento lento de disco en BD)
      let columns = 'id, folio, fecha, fecha_creacion, canal, contacto, asunto, cliente, sitio, solicitante, area, categoria, prioridad, asignado, descripcion, equipo, notas, estado, cotizacion_sap, cot_aceptada, motivo_rechazo, pedido_sap, created_at, fecha_cierre, monto_cotizacion, comentarios_internos, creado_por, comentarios_clientes, fecha_modificacion, updated_at, modificado_por';
      try {
        ticketsDb = await fetchTablePaginated('tickets', columns, null, false, null, 50, 15000);
      } catch (colErr) {
        if (colErr && colErr.message && (colErr.message.includes('fecha_modificacion') || colErr.message.includes('updated_at') || colErr.message.includes('modificado_por') || colErr.message.includes('schema cache'))) {
          console.warn('[Sync] Reintentando carga de tickets sin columnas de fecha_modificacion/updated_at/modificado_por...');
          columns = 'id, folio, fecha, fecha_creacion, canal, contacto, asunto, cliente, sitio, solicitante, area, categoria, prioridad, asignado, descripcion, equipo, notas, estado, cotizacion_sap, cot_aceptada, motivo_rechazo, pedido_sap, created_at, fecha_cierre, monto_cotizacion, comentarios_internos, creado_por, comentarios_clientes';
          ticketsDb = await fetchTablePaginated('tickets', columns, null, false, null, 50, 15000);
        } else {
          throw colErr;
        }
      }
    } catch (e) {
      console.warn('[Sync] Error al descargar tickets principales de Supabase:', e.message);
      ticketsError = e;
    }



    if (ticketsDb) {
      let mapped = [];
      let mapErrors = [];
      ticketsDb.forEach(t => {
        try {
          mapped.push(rowToTicket(t, idsWithPedido, idsWithCotizacion));
        } catch (e) {
          mapErrors.push({ folio: t.folio, error: e.message });
        }
      });
      
      if (mapErrors.length > 0 && window.trackTelemetryEvent) {
        window.trackTelemetryEvent('Diag: Mapping Errors', { errors: mapErrors });
      }
      
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
      
      // Emitir evento inmediato para que la UI renderice los tickets descargados sin esperar el resto del sync
      console.log('[Sync] Tickets guardados. Despachando evento de renderizado inmediato.');
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    } else {
      // Si la nube está vacía, respetamos el local (no borramos nada)
      window._supaTickets = null;
    }

    // Sitios
    let sitiosDb = [];
    try {
      sitiosDb = await fetchTablePaginated('sitios', '*');
    } catch (e) {}
    if (sitiosDb && sitiosDb.length > 0) {
      const mapped = sitiosDb.map(s => ({ id: s.id, nombre: s.nombre, cliente: s.cliente, direccion: s.direccion, cp: s.cp, ciudad: s.ciudad, estado: s.estado, customData: s.custom_data }));
      localStorage.setItem('sapi_sitios_db', JSON.stringify(mapped));
    }

    // Maquinaria
    let maqDb = [];
    try {
      maqDb = await fetchTablePaginated('maquinaria', '*');
    } catch (e) {}
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
                customData: m.custom_data,
                sitio_id: m.sitio_id
              });
            }
            clienteNombre = matchByName.nombre;
          } else {
            const match = clientes.find(c => c.id === m.cliente);
            if (match) clienteNombre = match.nombre;
          }
        } catch(e) {}
        const cData = m.custom_data || {};

        // Resolver nombre del sitio a partir del sitio_id
        let ubiName = m.ubicacion || cData.ubicacion || 'N/A';
        if (m.sitio_id) {
          try {
            const sitios = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
            const sMatch = sitios.find(s => s.id === m.sitio_id);
            if (sMatch) ubiName = sMatch.nombre;
          } catch(e) {}
        }

        return {
          id: m.id,
          serie: m.serie,
          marca: m.marca,
          modelo: m.modelo,
          anio: m.anio,
          cliente: clienteNombre,
          idInterno: m.id_interno || m.id,
          descripcion: m.descripcion,
          tipo: m.tipo || cData.tipo || 'N/A',
          numeroEconomico: m.numero_economico || cData.numeroEconomico || 'N/A',
          numeroMotor: m.numero_motor || cData.numeroMotor || 'N/A',
          venta: m.venta || cData.venta || '',
          ubicacion: ubiName,
          sitio_id: m.sitio_id || null,
          latitud: (m.latitud !== null && m.latitud !== undefined) ? m.latitud : cData.latitud,
          longitud: (m.longitud !== null && m.longitud !== undefined) ? m.longitud : cData.longitud,
          customData: cData
        };
      });
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(mapped));
    }

    // Levantamientos
    try {
      let levantamientosDb = null;
      let levErr = null;
      try {
        levantamientosDb = await fetchTablePaginated('levantamientos', '*');
      } catch (err) {
        levErr = err;
      }
      if (levantamientosDb && !levErr) {
        const mapped = levantamientosDb.map(rowToLevantamiento);
        localStorage.setItem('sapi_levantamientos', JSON.stringify(mapped));
        if (typeof window.levantamientos !== 'undefined') {
          window.levantamientos = mapped;
        }
      } else if (levErr) {
        console.error('[Sync] Error loading levantamientos:', levErr);
      }
    } catch (e) {
      console.error('[Sync] Exception loading levantamientos:', e);
    }

    // Envíos y Guías de Paquetería
    try {
      let enviosDb = null;
      let envErr = null;
      try {
        enviosDb = await fetchTablePaginated('envios', '*');
      } catch (err) {
        envErr = err;
      }
      if (enviosDb && !envErr) {
        const mapped = enviosDb.map(rowToEnvio);
        localStorage.setItem('sapi_envios_db', JSON.stringify(mapped));
        if (typeof window.sapiEnviosDb !== 'undefined') {
          window.sapiEnviosDb = mapped;
        }
        // Sincronizar hacia los tickets locales si existen
        try {
          const localTickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
          let tktChanged = false;
          mapped.forEach(env => {
            if (env.ticketId) {
              const t = localTickets.find(x => x.id === env.ticketId || x.folio === env.ticketId);
              if (t) {
                if (!t.envios) t.envios = [];
                const existIdx = t.envios.findIndex(x => x.id === env.id);
                if (existIdx >= 0) {
                  t.envios[existIdx] = env;
                } else {
                  t.envios.push(env);
                }
                tktChanged = true;
              }
            }
          });
          if (tktChanged) {
            localStorage.setItem('sapi_tickets', JSON.stringify(localTickets));
            if (typeof tickets !== 'undefined') window.tickets = localTickets;
          }
        } catch(e) {}

        if (typeof window.renderEnvios === 'function') {
          window.renderEnvios();
        }
      }
    } catch (e) {
      console.warn('[Sync] Tabla envios no disponible o en migración:', e.message);
    }

    // Órdenes y subtablas asociadas descargadas de forma estable y secuencial
    let ordenes = null;
    let ordenesError = null;
    let bitacorasDb = [];
    let refsDb = [];
    let firmasDb = [];

    try {
      ordenes = await fetchTablePaginated('ordenes', '*');
      try { bitacorasDb = await fetchTablePaginated('orden_bitacora', '*'); } catch(e) {}
      try { refsDb = await fetchTablePaginated('orden_refacciones', '*, refacciones(codigo, descripcion)'); } catch(e) {}
      try { firmasDb = await fetchTablePaginated('orden_firmas', '*'); } catch(e) {}
    } catch (err) {
      ordenesError = err;
    }

    window.lastSyncOrdsLength = ordenes ? ordenes.length : -1;
    window.lastSyncOrdsError = ordenesError ? ordenesError.message : null;
    window.lastSyncTimestamp = new Date().toISOString();
    localStorage.setItem('sapi_last_sync_timestamp', window.lastSyncTimestamp);
    if (ordenes) {
      let bitacorasMap = {};
      if (bitacorasDb && bitacorasDb.length > 0) {
        bitacorasDb.forEach(b => {
          if (!bitacorasMap[b.orden_id]) bitacorasMap[b.orden_id] = [];
          
          // Formatear fecha a YYYY-MM-DD para la app
          const datePortion = b.fecha ? b.fecha.substring(0, 10) : '';
          
          let tecnico = b.tecnico;
          let nota = b.nota || '';
          let realizado = true;
          let programadoEntrada = null;
          let programadoSalida = null;
          let desviacion = null;

          if (nota.includes('[Realizado: ')) {
            const match = nota.match(/(?:\r?\n|^)\[Realizado: (.*?)\]/);
            if (match) {
              realizado = match[1] === 'true';
              nota = nota.replace(/(?:\r?\n|^)\[Realizado: (.*?)\]/g, '');
            }
          } else {
            // Retrocompatibilidad
            const esPendiente = nota.includes('Programado por supervisor');
            realizado = !esPendiente;
          }

          if (nota.includes('[Prog: ')) {
            const match = nota.match(/(?:\r?\n|^)\[Prog: (.*?)-(.*?)\]/);
            if (match) {
              programadoEntrada = match[1];
              programadoSalida = match[2];
              nota = nota.replace(/(?:\r?\n|^)\[Prog: (.*?)-(.*?)\]/g, '');
            }
          }

          if (nota.includes('[Desv: ')) {
            const match = nota.match(/(?:\r?\n|^)\[Desv: (.*?)\]/);
            if (match) {
              desviacion = match[1];
              nota = nota.replace(/(?:\r?\n|^)\[Desv: (.*?)\]/g, '');
            }
          }

          if (!tecnico && nota.includes('[Técnico: ')) {
            const match = nota.match(/\n\[Técnico: (.*?)\]$/);
            if (match) {
              tecnico = match[1];
              nota = nota.replace(/\n\[Técnico: (.*?)\]$/, '');
            }
          }

          let asignadoPorName = null;
          if (nota.includes('[AsignadoPor: ')) {
            const match = nota.match(/(?:\r?\n|^)\[AsignadoPor: (.*?)\]/);
            if (match) {
              asignadoPorName = match[1];
              nota = nota.replace(/(?:\r?\n|^)\[AsignadoPor: (.*?)\]/g, '');
            }
          }

          bitacorasMap[b.orden_id].push({
            id: b.id,
            fecha: datePortion,
            tecnico: tecnico,
            nota: nota,
            entrada: b.entrada,
            salida: b.salida,
            hora_inicio: b.hora_inicio,
            horas_traslado: b.horas_traslado,
            programadoHorasTraslado: b.programado_horas_traslado,
            hora_fin_regreso: b.hora_fin_regreso,
            horas_regreso: b.horas_regreso,
            programadoHorasRegreso: b.programado_horas_regreso,
            tipo: b.tipo || 'Servicio',
            realizado: realizado,
            programadoEntrada: programadoEntrada,
            programadoSalida: programadoSalida,
            desviacion: desviacion,
            asignadoPorName: asignadoPorName
          });
        });
      }

      // Procesar Refacciones Asociadas
      let refaccionesMap = {};
      if (refsDb && refsDb.length > 0) {
        refsDb.forEach(r => {
          if (!refaccionesMap[r.orden_id]) refaccionesMap[r.orden_id] = { necesarias: [], utilizadas: [] };
          
          const refMeta = r.refacciones || {};
          const refObj = {
            clave: refMeta.codigo || null,
            descripcion: refMeta.descripcion || 'Refacción',
            cantidad: r.cantidad || 1,
            precio: r.precio_unitario || 0,
            estatusPedido: r.estatus_pedido || (r.estado === 'Necesaria' || r.estado === 'Solicitado' ? 'Por Pedir' : null),
            estado: r.estado || null
          };
          
          if (r.estado === 'Necesaria' || r.estado === 'Solicitado') {
            refaccionesMap[r.orden_id].necesarias.push(refObj);
          } else {
            refaccionesMap[r.orden_id].utilizadas.push(refObj);
          }
        });
      }

      // Procesar Firmas Asociadas
      let firmasMap = {};
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

      let mapped = ordenes.map(o => {
        const ord = rowToOrden(o);
        ord.bitacora = bitacorasMap[ord.id] || [];
        
        // Re-inyectar y fusionar refacciones
        const refLink = refaccionesMap[ord.id] || { necesarias: [], utilizadas: [] };
        
        // Fusionar necesarias
        refLink.necesarias.forEach(rl => {
          const match = ord.ref_necesarias.find(ex => ex.descripcion === rl.descripcion);
          if (match) {
            match.estatusPedido = rl.estatusPedido;
            match.estado = rl.estado;
            match.clave = match.clave || rl.clave;
          } else {
            ord.ref_necesarias.push(rl);
          }
        });
        
        // Fusionar utilizadas
        refLink.utilizadas.forEach(rl => {
          const match = ord.ref_utilizadas.find(ex => ex.descripcion === rl.descripcion);
          if (match) {
            match.estatusPedido = rl.estatusPedido;
            match.estado = rl.estado;
            match.clave = match.clave || rl.clave;
          } else {
            ord.ref_utilizadas.push(rl);
          }
        });
        
        // Mantener las banderas de pdf
        if (ord.pdfRefFlags) {
          ord.ref_utilizadas.forEach(r => {
            if (ord.pdfRefFlags[r.descripcion]) {
              r.isFromPdf = true;
            }
          });
        }
        
        // Re-inyectar firmas
        const firmLink = firmasMap[ord.id] || {};
        ord.firma_tecnico_base64 = firmLink.firma_tecnico_base64 || null;
        ord.firma_tecnico_fecha = firmLink.firma_tecnico_fecha || null;
        ord.firma_cliente_base64 = firmLink.firma_cliente_base64 || null;
        ord.firma_cliente_nombre = firmLink.firma_cliente_nombre || null;
        ord.firma_cliente_fecha = firmLink.firma_cliente_fecha || null;
        
        return ord;
      });
      window.lastSyncMappedLength = mapped ? mapped.length : -1;
      
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
      
      // Emitir evento inmediato para que la UI renderice las órdenes descargadas sin esperar el resto del sync
      console.log('[Sync] Órdenes guardadas. Despachando evento de renderizado inmediato.');
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    } else {
      window._supaOrdenes = null;
    }

    if (!isClientOrEmpresa) {
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
          marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
          grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
          ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
        }));
        await window.saveRefaccionesLocal(mapped);
      }
    } else {
      console.log('[Sync] Omitiendo descarga del catálogo de refacciones para rol cliente/empresa.');
    }

    // La tabla config y roles ya se procesan arriba de forma segura al inicio de la sincronización.
    // Clara Transactions
    try {
      let claraDb = null;
      let claraErr = null;
      try {
        claraDb = await fetchTablePaginated('clara_transactions', '*');
      } catch (err) {
        claraErr = err;
      }
      if (!claraErr && claraDb) {
        const mappedClara = claraDb.map(row => ({
          id: row.id,
          fecha: row.fecha ? row.fecha.split('T')[0] : '',
          merchant: row.merchant,
          monto: Number(row.monto),
          cardLast4: padCard(row.card_last_4),
          usuario: row.usuario || 'Técnico Asignado',
          categoria: row.categoria || 'Otros',
          fechaTransaccion: row.fecha_transaccion,
          estadoCuenta: row.estado_cuenta,
          transaccion: row.transaccion,
          montoOriginal: Number(row.monto_original || 0),
          monedaOriginal: row.moneda_original,
          montoMxn: Number(row.monto_mxn || 0),
          tarjeta: padCard(row.tarjeta),
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
        // Recuperar y fusionar transacciones locales pendientes de subir
        let localTxs = [];
        try {
          localTxs = JSON.parse(localStorage.getItem('sapi_clara_mock_txs') || '[]');
        } catch(e) {}
        
        const dbIds = new Set(mappedClara.map(t => t.id));
        const pendingUploads = localTxs.filter(t => t && t.id && !dbIds.has(t.id));
        
        if (pendingUploads.length > 0) {
          console.log(`[Sync] Detectadas ${pendingUploads.length} transacciones Clara locales no sincronizadas. Conservando y re-intentando subir.`);
          pendingUploads.forEach(t => {
            mappedClara.push(t);
            if (window.pushToSupabase) {
              window.pushToSupabase('clara_transactions', t);
            }
          });
        }

        window._supaClaraTxs = mappedClara;
        localStorage.setItem('sapi_clara_mock_txs', JSON.stringify(mappedClara));
      }
    } catch (errC) {
      console.warn('[Sync] Tabla clara_transactions no disponible en Supabase. Se usarán datos locales/mock.', errC.message);
    }

    // Clara Cards
    try {
      let cardsDb = null;
      let cardsErr = null;
      try {
        cardsDb = await fetchTablePaginated('clara_cards', '*');
      } catch (err) {
        cardsErr = err;
      }
      if (!cardsErr && cardsDb) {
        const mappedCards = cardsDb.map(row => ({
          id: row.id,
          alias: row.alias,
          usuario: row.usuario,
          correo: row.correo,
          estado: row.estado,
          tipo: row.tipo,
          tarjeta: padCard(row.tarjeta),
          limite: Number(row.limite || 0),
          saldoUtilizado: Number(row.saldo_utilizado || 0),
          ultimaActualizacion: row.ultima_actualizacion,
          dondeComprar: row.donde_comprar,
          usuarioVinculadoId: row.usuario_vinculado_id || null
        }));
        // Recuperar y fusionar tarjetas locales pendientes de subir
        let localCards = [];
        try {
          localCards = JSON.parse(localStorage.getItem('sapi_clara_cards') || '[]');
        } catch(e) {}

        const dbCardIds = new Set(mappedCards.map(c => c.id));
        const pendingCards = localCards.filter(c => c && c.id && !dbCardIds.has(c.id));

        if (pendingCards.length > 0) {
          console.log(`[Sync] Detectadas ${pendingCards.length} tarjetas Clara locales no sincronizadas. Conservando y re-intentando subir.`);
          pendingCards.forEach(c => {
            mappedCards.push(c);
            if (window.pushToSupabase) {
              window.pushToSupabase('clara_cards', c);
            }
          });
        }

        window._supaClaraCards = mappedCards;
        localStorage.setItem('sapi_clara_cards', JSON.stringify(mappedCards));
      }
    } catch (errCards) {
      console.warn('[Sync] Tabla clara_cards no disponible en Supabase. Se usarán datos locales/mock.', errCards.message);
    }

    // Gastos
    let mappedGastos = [];

    try {
      let gastosDb = null;
      let gastosErr = null;
      try {
        gastosDb = await fetchTablePaginated('gastos', '*');
      } catch (err) {
        gastosErr = err;
      }
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
      let eventosDb = null;
      let eventosErr = null;
      try {
        eventosDb = await fetchTablePaginated('calendario_eventos', '*');
      } catch (err) {
        eventosErr = err;
      }
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

    // Telemetry events: Ahora se consultan bajo demanda cuando el admin abre el módulo de telemetría
    // evitando saturar conexiones y memoria en el inicio de sesión.
    window.fetchTelemetryFromSupabase = async function(limitCount = 200) {
      const client = window.supabaseClient;
      if (!client) return;
      try {
        const { data: telemetryDb, error: telemetryErr } = await client
          .from('sapi_telemetry')
          .select('*')
          .limit(limitCount)
          .order('timestamp', { ascending: false });

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
          if (typeof window.renderTelemetryDashboard === 'function') {
            window.renderTelemetryDashboard();
          }
        }
      } catch (errT) {
        console.warn('[Telemetry] Error al consultar telemetría de Supabase:', errT.message);
      }
    };

    // Cotizaciones SAP (Caché en memoria y localStorage para autocompletar)
    try {
      let cotizaciones = null;
      let cotizacionesErr = null;
      try {
        cotizaciones = await fetchTablePaginated('cotizaciones_sap', '*', null, false);
      } catch (err) {
        cotizacionesErr = err;
      }
      if (!cotizacionesErr && cotizaciones) {
        window._cacheCotizacionesSap = cotizaciones;
        await window.saveCatalogOffline('eurorep_cotizaciones_sap', cotizaciones);
      }
    } catch (errCot) {
      console.warn('[Sync] Error al cargar cotizaciones_sap:', errCot);
    }

    // Pedidos SAP (Caché en memoria y localStorage para autocompletar)
    try {
      let pedidos = null;
      let pedidosErr = null;
      try {
        pedidos = await fetchTablePaginated('pedidos_sap', '*', null, false);
      } catch (err) {
        pedidosErr = err;
      }
      if (!pedidosErr && pedidos) {
        window._cachePedidosSap = pedidos;
        await window.saveCatalogOffline('eurorep_pedidos_sap', pedidos);
      }
    } catch (errPed) {
      console.warn('[Sync] Error al cargar pedidos_sap:', errPed);
    }

    // Ideas y Fallas (Solo Superadmins)
    try {
      const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
      const isSuper = session && (session.realRol === 'superadmin' || session.viewMode === 'superadmin');
      if (isSuper) {
        let ideasFallas = null;
        let ideasFallasErr = null;
        try {
          ideasFallas = await fetchTablePaginated('ideas_fallas', '*');
        } catch (err) {
          ideasFallasErr = err;
        }
        if (!ideasFallasErr && ideasFallas) {
          localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallas));
          if (typeof window.ideasFallasDb !== 'undefined') {
            window.ideasFallasDb = ideasFallas;
          }
        }
      }
    } catch (errIf) {
      console.warn('[Sync] Error al cargar ideas_fallas:', errIf);
    }

  } catch (error) {
    console.error('[Supabase] Error cargando datos:', error.message);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('last_sync_error', error.message + '\n' + error.stack);
    }
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

  const handleUpdate = async (tableName, payload) => {
    try {
      console.log(`[Supabase Realtime] Cambio detectado en la tabla: ${tableName}. Evento: ${payload?.eventType || 'SELECT_FALLBACK'}`);
      
      let data = [];
      let isFallback = !payload || !payload.eventType;

      if (isFallback) {
        let dbData = [];
        try {
          dbData = await window.fetchTablePaginated(tableName, '*');
        } catch (error) {
          throw error;
        }
        data = dbData || [];
      }

      if (tableName === 'tickets') {
        let mapped = [];
        if (!isFallback) {
          const current = window._supaTickets || JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
          if (payload.eventType === 'DELETE') {
            mapped = current.filter(t => t.id !== payload.old.id);
          } else {
            const ticket = rowToTicket(payload.new);
            const idx = current.findIndex(t => t.id === ticket.id);
            if (idx > -1) {
              const oldTicket = current[idx];
              // Comparar comentarios internos nuevos para notificaciones
              if (ticket.comentariosInternos && ticket.comentariosInternos.length > 0) {
                const oldComments = oldTicket.comentariosInternos || [];
                ticket.comentariosInternos.forEach(c => {
                  const alreadyExists = oldComments.some(oc => oc.fecha === c.fecha && oc.usuario === c.usuario);
                  if (!alreadyExists) {
                    if (typeof window.generarNotificacionComentarioInterno === 'function') {
                      window.generarNotificacionComentarioInterno(ticket, c);
                    }
                  }
                });
              }
              current[idx] = ticket;
            } else {
              // Si es un ticket nuevo y trae comentarios, notificarlos
              if (ticket.comentariosInternos && ticket.comentariosInternos.length > 0) {
                ticket.comentariosInternos.forEach(c => {
                  if (typeof window.generarNotificacionComentarioInterno === 'function') {
                    window.generarNotificacionComentarioInterno(ticket, c);
                  }
                });
              }
              current.unshift(ticket);
            }
            mapped = current;
          }
        } else {
          // Fallback (carga completa de la tabla)
          const current = window._supaTickets || JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
          mapped = data.map(rowToTicket);
          
          mapped.forEach(ticket => {
            const oldTicket = current.find(t => t.id === ticket.id);
            if (oldTicket && ticket.comentariosInternos && ticket.comentariosInternos.length > 0) {
              const oldComments = oldTicket.comentariosInternos || [];
              ticket.comentariosInternos.forEach(c => {
                const alreadyExists = oldComments.some(oc => oc.fecha === c.fecha && oc.usuario === c.usuario);
                if (!alreadyExists) {
                  if (typeof window.generarNotificacionComentarioInterno === 'function') {
                    window.generarNotificacionComentarioInterno(ticket, c);
                  }
                }
              });
            }
          });
        }
        localStorage.setItem('sapi_tickets', JSON.stringify(mapped));
        window._supaTickets = mapped;

      } else if (tableName === 'ordenes') {
        let mapped = [];
        if (!isFallback) {
          const current = window._supaOrdenes || JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
          if (payload.eventType === 'DELETE') {
            mapped = current.filter(o => o.id !== payload.old.id);
          } else {
            const orden = rowToOrden(payload.new);
            const idx = current.findIndex(o => o.id === orden.id);
            if (idx > -1) {
              const oldOrd = current[idx];
              // Preservar sub-entidades locales que no vienen en el payload de la tabla de órdenes
              orden.ref_necesarias = oldOrd.ref_necesarias || [];
              orden.ref_utilizadas = oldOrd.ref_utilizadas || [];
              orden.bitacora = oldOrd.bitacora || [];
              if (!orden.firma_tecnico_base64) orden.firma_tecnico_base64 = oldOrd.firma_tecnico_base64;
              if (!orden.firma_cliente_base64) orden.firma_cliente_base64 = oldOrd.firma_cliente_base64;
              if (!orden.firma_cliente_nombre) orden.firma_cliente_nombre = oldOrd.firma_cliente_nombre;
              if (!orden.firma_cliente_fecha) orden.firma_cliente_fecha = oldOrd.firma_cliente_fecha;
              if (!orden.firma_tecnico_fecha) orden.firma_tecnico_fecha = oldOrd.firma_tecnico_fecha;
              if (!orden.evidencias || Object.keys(orden.evidencias).length === 0) {
                orden.evidencias = oldOrd.evidencias || {};
              }
              current[idx] = orden;
            } else {
              current.unshift(orden);
            }
            mapped = current;
          }
        } else {
          mapped = data.map(rowToOrden);
        }
        localStorage.setItem('sapi_ordenes', JSON.stringify(mapped));
        window._supaOrdenes = mapped;

      } else if (tableName === 'clara_transactions') {
        let mappedClara = [];
        const mapTx = row => ({
          id: row.id,
          fecha: row.fecha ? row.fecha.split('T')[0] : '',
          merchant: row.merchant,
          monto: Number(row.monto),
          cardLast4: padCard(row.card_last_4),
          usuario: row.usuario || 'Técnico Asignado',
          categoria: row.categoria || 'Otros',
          fechaTransaccion: row.fecha_transaccion,
          estadoCuenta: row.estado_cuenta,
          transaccion: row.transaccion,
          montoOriginal: Number(row.monto_original || 0),
          monedaOriginal: row.moneda_original,
          montoMxn: Number(row.monto_mxn || 0),
          tarjeta: padCard(row.tarjeta),
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
        });

        if (!isFallback) {
          const current = window._supaClaraTxs || JSON.parse(localStorage.getItem('sapi_clara_mock_txs') || '[]');
          if (payload.eventType === 'DELETE') {
            mappedClara = current.filter(t => t.id !== payload.old.id);
          } else {
            const tx = mapTx(payload.new);
            const idx = current.findIndex(t => t.id === tx.id);
            if (idx > -1) {
              current[idx] = tx;
            } else {
              current.unshift(tx);
            }
            mappedClara = current;
          }
        } else {
          mappedClara = data.map(mapTx);
        }
        localStorage.setItem('sapi_clara_mock_txs', JSON.stringify(mappedClara));
        window._supaClaraTxs = mappedClara;

      } else if (tableName === 'calendario_eventos') {
        let mapped = [];
        if (!isFallback) {
          const current = window._supaCalendarioEventos || JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
          if (payload.eventType === 'DELETE') {
            mapped = current.filter(e => e.id !== payload.old.id);
          } else {
            const evento = rowToEvento(payload.new);
            const idx = current.findIndex(e => e.id === evento.id);
            if (idx > -1) {
              current[idx] = evento;
            } else {
              current.unshift(evento);
            }
            mapped = current;
          }
        } else {
          mapped = data.map(rowToEvento);
        }
        localStorage.setItem('sapi_calendario_eventos', JSON.stringify(mapped));
        window._supaCalendarioEventos = mapped;

      } else if (tableName === 'ideas_fallas') {
        let mapped = [];
        if (!isFallback) {
          const current = JSON.parse(localStorage.getItem('sapi_ideas_fallas') || '[]');
          if (payload.eventType === 'DELETE') {
            mapped = current.filter(i => i.id !== payload.old.id);
          } else {
            const idea = payload.new;
            const idx = current.findIndex(i => i.id === idea.id);
            if (idx > -1) {
              current[idx] = idea;
            } else {
              current.unshift(idea);
            }
            mapped = current;
          }
        } else {
          mapped = data;
        }
        localStorage.setItem('sapi_ideas_fallas', JSON.stringify(mapped));
        if (typeof window.ideasFallasDb !== 'undefined') {
          window.ideasFallasDb = mapped;
        }
        if (typeof window.renderIdeasFallasList === 'function') {
          window.renderIdeasFallasList();
        }
      }

      if (tableName === 'envios') {
        let mappedEnvios = [];
        const current = JSON.parse(localStorage.getItem('sapi_envios_db') || '[]');
        if (!isFallback) {
          if (payload.eventType === 'DELETE') {
            mappedEnvios = current.filter(e => e.id !== payload.old.id);
          } else {
            const envio = rowToEnvio(payload.new);
            const idx = current.findIndex(e => e.id === envio.id);
            if (idx > -1) {
              current[idx] = envio;
            } else {
              current.unshift(envio);
            }
            mappedEnvios = current;
          }
        } else {
          mappedEnvios = data.map(rowToEnvio);
        }
        localStorage.setItem('sapi_envios_db', JSON.stringify(mappedEnvios));
        if (typeof window.sapiEnviosDb !== 'undefined') {
          window.sapiEnviosDb = mappedEnvios;
        }

        if (typeof window.renderEnvios === 'function') {
          window.renderEnvios();
        }
      }

      if (tableName === 'config') {
        if (!isFallback && payload.new) {
          const cfgId = payload.new.id;
          const cfgData = payload.new.data;
          if (cfgId === 'main' && cfgData) {
            localStorage.setItem('eurorep_config', JSON.stringify(cfgData));
          } else if (cfgId === 'roles' && cfgData) {
            localStorage.setItem('sapi_roles_config', JSON.stringify(cfgData));
            if (typeof window.cargarRolesDesdeStorage === 'function') window.cargarRolesDesdeStorage();
            if (window.currentSession && window.currentSession.viewMode && typeof window.applyRole === 'function') {
              window.applyRole(window.currentSession.viewMode);
            }
          } else if ((cfgId === 'kits_servicio' || cfgId === 'machotes_servicio') && cfgData) {
            if (typeof safeSetJSON === 'function') {
              safeSetJSON('sapi_kits_servicio', cfgData);
            } else {
              localStorage.setItem('sapi_kits_servicio', JSON.stringify(cfgData));
            }
            if (typeof window.filtrarKitsServicio === 'function') {
              window.filtrarKitsServicio();
            }
          } else if (cfgId === 'kits_servicio_sandbox' && cfgData) {
            if (typeof safeSetJSON === 'function') {
              safeSetJSON('sapi_kits_servicio_sandbox', cfgData);
            } else {
              localStorage.setItem('sapi_kits_servicio_sandbox', JSON.stringify(cfgData));
            }
            if (typeof window.filtrarKitsServicio === 'function') {
              window.filtrarKitsServicio();
            }
          }
        }
      }
      
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    } catch (e) {
      console.error(`[Realtime] Error al procesar actualización de la tabla ${tableName}:`, e.message);
    }
  };

  try {
    // Si no hay sesión de usuario activa, no abrir canal en vivo para proteger conexiones de Supabase
    const sessionStr = localStorage.getItem('eurorep_session');
    if (!sessionStr) {
      return;
    }

    if (window.supabaseRealtimeChannel) {
      window.supabaseClient.removeChannel(window.supabaseRealtimeChannel);
    }
    window.supabaseRealtimeChannel = window.supabaseClient.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => handleUpdate('tickets', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, (payload) => handleUpdate('ordenes', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'envios' }, (payload) => handleUpdate('envios', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_eventos' }, (payload) => handleUpdate('calendario_eventos', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas_fallas' }, (payload) => handleUpdate('ideas_fallas', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, (payload) => handleUpdate('config', payload));
      
    window.supabaseRealtimeChannel.subscribe();
  } catch (err) {
    console.error('[Realtime] Excepción al suscribirse al canal en tiempo real:', err.message);
  }
}

window.setupRealtime = setupRealtime;

// ─── Arrancar cuando el DOM esté listo ───────────────────────────────────────
function arrancarSync() {
  // Limpiar cualquier elemento de prueba en la cola de sincronización para evitar fallos
  try {
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const filtered = queue.filter(item => {
      if (item && item.data) {
        const isTest = item.data.isTest || item.data.esPrueba || item.data.id === 'gasto_seed_1';
        if (isTest) return false;
      }
      // La telemetría nunca se encola: limpiar items rezagados de versiones anteriores
      if (item && item.table === 'sapi_telemetry') return false;
      return true;
    });
    if (filtered.length !== queue.length) {
      localStorage.setItem('sapi_sync_queue', JSON.stringify(filtered));
      console.log(`[Sync] Limpiados ${queue.length - filtered.length} elementos de la cola offline (pruebas + telemetría rezagada).`);
    }
  } catch (e) {
    console.warn('[Sync] Error al limpiar cola de pruebas:', e);
  }

  setTimeout(() => {
    migrarDatosASupabase();
    if (localStorage.getItem('eurorep_session')) {
      setupRealtime();
    }
    updateSyncStatusUI();
    processSyncQueue();
  }, 300);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancarSync);
} else {
  arrancarSync();
}

// Convert base64 data URL to Blob for binary storage upload
window.base64ToBlob = async function(base64Data) {
  try {
    if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:') || base64Data.includes('mockevidence') || base64Data.length < 30) {
      console.warn('[Storage] Skipping conversion: invalid or mock base64 data URL.');
      return null;
    }
    const res = await fetch(base64Data);
    return await res.blob();
  } catch (err) {
    console.error('[Storage] Error converting base64 to blob:', err);
    return null;
  }
};

window.uploadBase64ToStorage = async function(base64Data, bucketName, filePath) {
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Storage] SupabaseClient not available.');
    return null;
  }

  // Sanitizar el filePath para evitar caracteres prohibidos en Supabase Storage
  let sanitizedPath = decodeURIComponent(filePath || ''); // Convertir %20 a espacios reales primero
  sanitizedPath = sanitizedPath.replace(/[^a-zA-Z0-9_\-\/\.]/g, '_'); // Reemplazar TODO lo que no sea seguro por _

  try {
    const blob = await window.base64ToBlob(base64Data);
    if (!blob) return null;

    // Upload blob to Supabase Storage bucket
    const { data, error } = await sb.storage.from(bucketName).upload(sanitizedPath, blob, {
      cacheControl: '3600',
      upsert: true
    });

    if (error) {
      console.warn('[Storage] Error uploading to bucket:', error.message);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = sb.storage.from(bucketName).getPublicUrl(sanitizedPath);
    return publicUrl;
  } catch (err) {
    console.error('[Storage] Exception during upload:', err);
    return null;
  }
};
window.verDetallesSincronizacion = function() {
  try {
    if (!document.getElementById('sapi-sync-spinner-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'sapi-sync-spinner-style';
      styleEl.textContent = `
        @keyframes sapi-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const oldModal = document.getElementById('sapi-dynamic-sync-modal');
    if (oldModal) oldModal.remove();

    let isSyncing = false;

    const overlay = document.createElement('div');
    overlay.id = 'sapi-dynamic-sync-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.zIndex = '9999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';
    
    overlay.onclick = function(e) {
      if (e.target === overlay) overlay.remove();
    };

    const modal = document.createElement('div');
    modal.style.backgroundColor = 'var(--bg-card, #ffffff)';
    modal.style.borderRadius = '16px';
    modal.style.width = '100%';
    modal.style.maxWidth = '550px';
    modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
    modal.style.border = '1px solid var(--border, #e5e7eb)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.overflow = 'hidden';
    modal.style.color = 'var(--text-primary, #111827)';

    const header = document.createElement('div');
    header.style.padding = '1.25rem 1.5rem';
    header.style.borderBottom = '1px solid var(--border, #e5e7eb)';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const title = document.createElement('h2');
    title.textContent = queue.length === 0 ? 'Estado del Sistema' : 'Cambios Pendientes (' + queue.length + ')';
    title.style.margin = '0';
    title.style.fontSize = '1.25rem';
    title.style.fontWeight = '700';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = 'var(--text-secondary, #6b7280)';
    closeBtn.onclick = () => {
      overlay.remove();
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.padding = '1.5rem';
    body.style.maxHeight = '60vh';
    body.style.overflowY = 'auto';
    
    const renderBodyContent = (currentQueue) => {
      if (currentQueue.length === 0) {
        return `
          <div style="text-align:center; color:var(--text-muted, #6b7280); padding: 2rem 1rem;">
            <i data-lucide="check-circle" style="width:48px;height:48px;margin:0 auto 1rem auto;display:block;color:var(--green,#10b981);"></i>
            <p style="margin:0; font-size:1.05rem; font-weight:500;">Todos tus cambios locales están guardados.</p>
          </div>
        `;
      } else {
        let html = `
          <p style="margin:0 0 1rem 0; font-size:0.9rem; color:var(--text-secondary, #4b5563);">
            Los siguientes cambios se realizaron localmente y están esperando a subir:
          </p>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
        `;
        currentQueue.forEach((item, index) => {
          let desc = 'Sin descripción';
          if (item && item.data) {
            desc = item.data.folio || item.data.asunto || item.data.nombre || item.data.cliente || item.data.id || 'Registro en ' + item.table;
          }
          html += `
            <div style="border:1px solid var(--border, #e5e7eb); border-radius:10px; padding:1rem; background-color:var(--bg-hover, #f9fafb);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <div style="display:flex; gap:0.5rem;">
                  <span style="font-size:0.7rem; font-weight:700; background:rgba(232,130,12,0.1); color:var(--accent,#e8820c); padding:0.2rem 0.5rem; border-radius:6px; border:1px solid rgba(232,130,12,0.2);">${item.table || 'DESCONOCIDO'}</span>
                  <span style="font-size:0.7rem; font-weight:700; background:#e5e7eb; color:#4b5563; padding:0.2rem 0.5rem; border-radius:6px;">${item.action || 'UPSERT'}</span>
                </div>
                <button class="sapi-del-queue-btn" data-index="${index}" style="background:transparent; border:none; color:var(--text-muted, #9ca3af); cursor:pointer; font-size:1rem; padding:0 0.2rem;" title="Eliminar este cambio pendiente">✕</button>
              </div>
              <div style="font-size:0.85rem; font-weight:600; word-break:break-word;">${desc}</div>
              ${item.lastError ? `
                <div style="font-size:0.72rem; color:#ef4444; margin-top:0.4rem; font-weight:600; background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.12); padding:0.4rem 0.5rem; border-radius:6px; display:flex; gap:0.4rem; align-items:flex-start;">
                  <i data-lucide="alert-triangle" style="width:14px;height:14px;flex-shrink:0;margin-top:0.1rem;"></i>
                  <span>Error: ${item.lastError} ${item.lastErrorCode ? `(Código: ${item.lastErrorCode})` : ''}</span>
                </div>
              ` : ''}
            </div>
          `;
        });
        html += `</div>`;
        return html;
      }
    };

    // Agregar banner de estado de sincronización (Online/Offline)
    const isOffline = !navigator.onLine && !window.isConnectionVerifiedOnline;
    const lastSyncStr = localStorage.getItem('sapi_last_sync_timestamp') || window.lastSyncTimestamp;
    let lastSyncFormatted = 'Nunca';
    if (lastSyncStr) {
      try {
        const d = new Date(lastSyncStr);
        lastSyncFormatted = d.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (e) {
        lastSyncFormatted = lastSyncStr;
      }
    }

    const statusBanner = document.createElement('div');
    statusBanner.style.marginBottom = '1.25rem';
    statusBanner.style.padding = '0.85rem 1rem';
    statusBanner.style.borderRadius = '10px';
    statusBanner.style.fontSize = '0.85rem';
    statusBanner.style.color = 'var(--text-secondary, #4b5563)';
    statusBanner.style.display = 'flex';
    statusBanner.style.gap = '0.5rem';
    statusBanner.style.alignItems = 'flex-start';

    if (isOffline) {
      statusBanner.style.backgroundColor = 'rgba(232, 130, 12, 0.05)';
      statusBanner.style.border = '1px solid rgba(232, 130, 12, 0.2)';
      statusBanner.innerHTML = `
        <i data-lucide="wifi-off" style="width:16px; height:16px; color:var(--accent,#e8820c); flex-shrink:0; margin-top:0.1rem;"></i>
        <div>
          <span style="font-weight:600; color:var(--text-primary,#111827);">Modo fuera de línea</span>
          <div style="margin-top:0.2rem;">Cuando está fuera de línea se podrá ver a qué hora fue la última vez que se sincronizó.</div>
          <div style="margin-top:0.4rem; font-size:0.78rem; font-weight:700; color:var(--accent,#e8820c);">Última sincronización: ${lastSyncFormatted}</div>
        </div>
      `;
    } else {
      statusBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
      statusBanner.style.border = '1px solid rgba(16, 185, 129, 0.2)';
      statusBanner.innerHTML = `
        <i data-lucide="wifi" style="width:16px; height:16px; color:var(--green,#10b981); flex-shrink:0; margin-top:0.1rem;"></i>
        <div>
          <span style="font-weight:600; color:var(--text-primary,#111827);">Conectado a Supabase</span>
          <div style="margin-top:0.2rem;">El sistema se encuentra sincronizado en tiempo real.</div>
          <div style="margin-top:0.4rem; font-size:0.78rem; font-weight:700; color:var(--green,#10b981);">Última sincronización: ${lastSyncFormatted}</div>
        </div>
      `;
    }
    body.appendChild(statusBanner);

    const bodyContentContainer = document.createElement('div');
    bodyContentContainer.innerHTML = renderBodyContent(queue);
    body.appendChild(bodyContentContainer);
    
    const footer = document.createElement('div');
    footer.style.padding = '1rem 1.5rem';
    footer.style.borderTop = '1px solid var(--border, #e5e7eb)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '0.75rem';
    footer.style.backgroundColor = 'var(--bg-body, #f3f4f6)';
    
    const closeAction = document.createElement('button');
    closeAction.textContent = 'Cerrar';
    closeAction.className = 'btn-secondary';
    closeAction.onclick = () => {
      overlay.remove();
      if (isSyncing && window.mostrarNotificacion) {
        window.mostrarNotificacion('La sincronización continúa en segundo plano...', 'info');
      }
    };
    
    const syncAction = document.createElement('button');
    syncAction.textContent = 'Sincronizar Ahora';
    syncAction.className = 'btn-primary';

    const setupDeleteHandlers = () => {
      const delBtns = overlay.querySelectorAll('.sapi-del-queue-btn');
      delBtns.forEach(btn => {
        btn.onclick = function(e) {
          if (confirm('¿Seguro que deseas eliminar este cambio local? Se perderán los datos.')) {
            const idx = parseInt(this.getAttribute('data-index'), 10);
            let currentQueue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
            currentQueue.splice(idx, 1);
            localStorage.setItem('sapi_sync_queue', JSON.stringify(currentQueue));
            overlay.remove();
            window.verDetallesSincronizacion();
            if (window.updateSyncStatusUI) window.updateSyncStatusUI();
          }
        };
      });
    };

    syncAction.onclick = async () => {
      if (isSyncing) return;
      isSyncing = true;

      // Mantener controles de cierre SIEMPRE habilitados para permitir al usuario trabajar libremente
      closeBtn.disabled = false;
      closeBtn.style.opacity = '1';
      closeBtn.style.cursor = 'pointer';
      closeAction.disabled = false;
      closeAction.style.opacity = '1';
      closeAction.style.cursor = 'pointer';

      // Cambiar botón a estado de carga
      syncAction.disabled = true;
      syncAction.style.opacity = '0.85';
      syncAction.style.cursor = 'wait';
      syncAction.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid #ffffff;border-top-color:transparent;border-radius:50%;animation:sapi-spin 0.8s linear infinite;margin-right:8px;vertical-align:-2px;"></span> Sincronizando...';

      // Actualizar banner con indicador de carga
      statusBanner.style.backgroundColor = 'rgba(232, 130, 12, 0.08)';
      statusBanner.style.border = '1px solid rgba(232, 130, 12, 0.3)';
      statusBanner.innerHTML = `
        <span style="display:inline-block;width:18px;height:18px;border:2.5px solid var(--accent, #e8820c);border-top-color:transparent;border-radius:50%;animation:sapi-spin 0.8s linear infinite;flex-shrink:0;margin-top:0.15rem;"></span>
        <div>
          <span style="font-weight:700; color:var(--text-primary,#111827);">Sincronizando con Supabase...</span>
          <div id="sync-modal-progress-text" style="margin-top:0.2rem; font-size:0.82rem; color:var(--text-secondary,#4b5563);">Subiendo cambios locales y descargando las últimas actualizaciones. Por favor, espera...</div>
        </div>
      `;

      try {
        if (typeof window.forzarSincronizacionManual === 'function') {
          await window.forzarSincronizacionManual();
        }

        // Obtener nueva hora de sincronización
        const newLastSyncStr = localStorage.getItem('sapi_last_sync_timestamp') || new Date().toISOString();
        let newLastSyncFormatted = newLastSyncStr;
        try {
          const d = new Date(newLastSyncStr);
          newLastSyncFormatted = d.toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } catch (e) {}

        // Actualizar banner a éxito
        statusBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
        statusBanner.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusBanner.innerHTML = `
          <i data-lucide="check-circle" style="width:18px; height:18px; color:var(--green,#10b981); flex-shrink:0; margin-top:0.1rem;"></i>
          <div>
            <span style="font-weight:700; color:var(--green,#10b981);">¡Sincronización completada con éxito!</span>
            <div style="margin-top:0.2rem; font-size:0.82rem;">El sistema se encuentra sincronizado en tiempo real.</div>
            <div style="margin-top:0.4rem; font-size:0.78rem; font-weight:700; color:var(--green,#10b981);">Última sincronización: ${newLastSyncFormatted}</div>
          </div>
        `;

        const updatedQueue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
        title.textContent = updatedQueue.length === 0 ? 'Estado del Sistema' : 'Cambios Pendientes (' + updatedQueue.length + ')';
        bodyContentContainer.innerHTML = renderBodyContent(updatedQueue);

        // Re-habilitar controles
        isSyncing = false;
        closeBtn.disabled = false;
        closeBtn.style.opacity = '1';
        closeBtn.style.cursor = 'pointer';
        closeAction.disabled = false;
        closeAction.style.opacity = '1';
        closeAction.style.cursor = 'pointer';

        syncAction.disabled = false;
        syncAction.style.opacity = '1';
        syncAction.style.cursor = 'pointer';
        syncAction.textContent = 'Sincronizar de nuevo';

        setupDeleteHandlers();
      } catch (err) {
        console.error('[Sync Modal] Error durante sincronización manual:', err);
        isSyncing = false;
        closeBtn.disabled = false;
        closeBtn.style.opacity = '1';
        closeBtn.style.cursor = 'pointer';
        closeAction.disabled = false;
        closeAction.style.opacity = '1';
        closeAction.style.cursor = 'pointer';

        syncAction.disabled = false;
        syncAction.style.opacity = '1';
        syncAction.style.cursor = 'pointer';
        syncAction.textContent = 'Reintentar Sincronización';

        statusBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        statusBanner.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusBanner.innerHTML = `
          <i data-lucide="alert-triangle" style="width:18px; height:18px; color:#ef4444; flex-shrink:0; margin-top:0.1rem;"></i>
          <div>
            <span style="font-weight:700; color:#ef4444;">Error al sincronizar</span>
            <div style="margin-top:0.2rem; font-size:0.82rem; color:#ef4444;">${err.message || 'No se pudo completar la sincronización. Verifica tu conexión a internet.'}</div>
          </div>
        `;
      } finally {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    };
    
    footer.appendChild(closeAction);
    footer.appendChild(syncAction);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setupDeleteHandlers();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

  } catch (err) {
    console.error('[Sync] Excepción:', err);
    alert('Error abriendo modal: ' + err.message);
  }
};
