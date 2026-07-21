// --- IndexedDB Helper for Refacciones (unlimited offline storage) ---
window.getSapiIndexedDB = function() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open('SapiOfflineDB', 1);
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

  const baseNotas = t.notas || '';
  let finalNotas = baseNotas;
  finalNotas = window.inyectarCotizacionesEnNotas(finalNotas, t.cotizacionesAdicionales || []);
  finalNotas = window.inyectarRefaccionesEnNotas(finalNotas, t.refaccionesSeleccionadas || []);

  const row = {
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
    notas: (t.horometro ? `[H:${t.horometro}]\n` : '') + finalNotas,
    estado: t.estado || null,
    cotizacion_sap: t.cotizacionSAP || null,
    monto_cotizacion: (t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? Number(t.montoCotizacion) : null,
    cot_aceptada: t.cotAceptada || null,
    motivo_rechazo: t.motivoRechazo || null,
    pedido_sap: t.pedidoSAP || null
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

  // Optimizar Base64 de PDFs guardando un marcador local para ahorrar espacio (evitar saturación de localStorage)
  let hasPed = false;
  if (t.pdf_pedido) {
    hasPed = true;
  } else if (idsWithPedido && idsWithPedido.has(t.id)) {
    hasPed = true;
  }

  let hasCot = false;
  if (t.pdf_cotizacion) {
    hasCot = true;
  } else if (idsWithCotizacion && idsWithCotizacion.has(t.id)) {
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
    tecnicosAsignados: [], // Siempre vacío por diseño relacional de negocio
    pdfPedido: pdfPedidoVal,
    pdfCotizacion: pdfCotizacionVal,
    esPrueba: t.es_prueba || (t.folio && t.folio.includes('PRUEBA')) || (t.asunto && t.asunto.startsWith('[PRUEBA]')) || false
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
    'ubicacion_sitio', 'operador'
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
    operador: o.operador || null
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
  
  if (tabla === 'tickets') {
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
    }
    
    // Upsert directo en la nube
    const { error } = await sb.from(tabla).upsert(row);
    if (error) {
      console.error(`[Direct Push] Error al guardar en ${tabla}:`, error.message);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(`Error al guardar en ${tabla}: ${error.message}`, 'error');
      }
      throw error;
    }
    
    // Marcar el elemento local en localStorage como sincronizado (_synced = true)
    try {
      const storageKey = tabla === 'tickets' ? 'sapi_tickets' : (tabla === 'ordenes' ? 'sapi_ordenes' : null);
      if (storageKey) {
        const localItems = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const idx = localItems.findIndex(x => x.id === item.id);
        if (idx > -1) {
          localItems[idx]._synced = true;
          localStorage.setItem(storageKey, JSON.stringify(localItems));
          console.log(`[Direct Push] Marcado local ${tabla} como sincronizado (_synced: true) para ${item.id}`);
        }
      }
    } catch (e) {
      console.error('[Direct Push] Error al marcar elemento local como sincronizado:', e);
    }

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
  
  if (tabla === 'tickets') {
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
  window._lastSyncStartTimestamp = Date.now();
  updateSyncStatusUI();

  try {
    let successCount = 0;
    
    while (true) {
      const queue = getSyncQueue();
      if (queue.length === 0) break;

      const item = queue[0];
      if (!item) {
        const latestQueue = getSyncQueue();
        latestQueue.shift();
        saveSyncQueue(latestQueue);
        continue;
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
                  const { data: todasLasOrd } = await sb.from('ordenes').select('folio');
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
              limite: (item.data.limite !== undefined && !isNaN(Number(item.data.limite))) ? Number(item.data.limite) : 0,
              saldo_utilizado: (item.data.saldoUtilizado !== undefined && !isNaN(Number(item.data.saldoUtilizado))) ? Number(item.data.saldoUtilizado) : 0,
              ultima_actualizacion: item.data.ultimaActualizacion || null,
              donde_comprar: item.data.dondeComprar || null,
              usuario_vinculado_id: (item.data.usuarioVinculadoId && item.data.usuarioVinculadoId.trim().length === 36) ? item.data.usuarioVinculadoId.trim() : null
            };
          } else if (item.table === 'levantamientos') {
            payload = { ...item.data };
            // Upload Base64 evidences if any
            if (payload.evidencias_base64) {
              if (!payload.evidencias) payload.evidencias = {};
              for (const [k, v] of Object.entries(payload.evidencias_base64)) {
                if (v && v.startsWith('data:')) {
                  try {
                    const url = await window.uploadBase64ToStorage(v, 'evidencias', `levantamientos/${payload.folio}_${k}.jpg`);
                    if (url) payload.evidencias[k] = url;
                  } catch (e) {
                    console.error('[Sync] Error subiendo evidencia de levantamiento:', e);
                  }
                }
              }
              delete payload.evidencias_base64;
            }
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
              const { data: bitacorasSupa, error: selectBitErr } = await sb.from('orden_bitacora').select('id').eq('orden_id', ordId);
              if (selectBitErr) throw selectBitErr;

              const idsMemoria = bitacorasMemoria.map(b => b.id);
              const idsABorrar = (bitacorasSupa || []).filter(b => !idsMemoria.includes(b.id)).map(b => b.id);
              if (idsABorrar.length > 0) {
                const { error: delBitErr } = await sb.from('orden_bitacora').delete().in('id', idsABorrar);
                if (delBitErr) throw delBitErr;
              }
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
        } else if (item.action === 'delete') {
          const { error: deleteErr } = await sb.from(resTabla).delete().eq('id', item.data.id);
          error = deleteErr;
        }

        if (error) {
          // La telemetría es no-crítica: siempre se descarta silenciosamente sin notificar al usuario.
          if (item.table === 'sapi_telemetry') {
            console.warn('[Sync] Telemetría no enviada, descartando sin notificar:', error.message);
            const latestQueue = getSyncQueue();
            latestQueue.shift();
            saveSyncQueue(latestQueue);
          } else {
            console.error(`[Sync] Error en operación (${item.table} - ${item.action}):`, error.message);
            
            // Guardar el mensaje de error en el primer item de la cola
            const currentQueue = getSyncQueue();
            if (currentQueue.length > 0) {
              currentQueue[0].lastError = error.message;
              currentQueue[0].lastErrorCode = error.code || 'N/A';
              saveSyncQueue(currentQueue);
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

            if (!isNetworkError) {
              if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion(`Error BD (${item.table}): ${error.message}`, 'error');
              }
              if (window._isSyncManualForced) {
                if (window.mostrarNotificacion) {
                  window.mostrarNotificacion(`Error BD (${item.table} - ${item.action}): ${error.message} | Código: ${error.code || 'N/A'}`, 'error');
                } else {
                  console.error(`[Sync] Error BD: ${item.table} (${item.action}) - ${error.message}`);
                }
              }
            }

            if (isNetworkError) {
              break; // Error de red temporal, pausar procesamiento
            } else {
              console.warn(`[Sync] Error permanente de BD. Saltando elemento.`);
              const latestQueue = getSyncQueue();
              latestQueue.shift();
              saveSyncQueue(latestQueue);
            }
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
              // Solo intentar insertar si tenemos una sesión autenticada activa en Supabase (evita 403 Forbidden)
              let hasSession = false;
              if (typeof sb.auth.getSession === 'function') {
                const sessionRes = await sb.auth.getSession().catch(() => null);
                if (sessionRes && sessionRes.data && sessionRes.data.session) {
                  hasSession = true;
                }
              }
              if (hasSession) {
                await sb.from('auditoria_logs').insert(logPayload);
              }
            } catch(logErr) {
              console.warn('[Sync] Error al escribir log de auditoria:', logErr.message);
            }
          }

          const latestQueue = getSyncQueue();
          latestQueue.shift();
          saveSyncQueue(latestQueue);
          successCount++;
        }
      } catch (e) {
        console.error(`[Sync] Excepción en processSyncQueue:`, e.message);
        if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('network') || e.message.includes('fetch'))) {
          break;
        } else {
          const latestQueue = getSyncQueue();
          latestQueue.shift();
          saveSyncQueue(latestQueue);
        }
      }
    }

    if (successCount > 0) {
      if (typeof window.cargarDatosDeSupabase === 'function') {
        window.cargarDatosDeSupabase().then(() => {
          if (window._isSyncManualForced) {
            if (window.mostrarNotificacion) {
              window.mostrarNotificacion('¡Sincronización completada! Se sincronizaron ' + successCount + ' elemento(s) pendiente(s).', 'success');
            }
          }
        }).catch(err => {
          console.error('[Sync] Error al recargar datos tras sincronización:', err);
          window.dispatchEvent(new Event('supabase_datos_cargados'));
        });
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
  window._isSyncManualForced = true;
  const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');

  const trySync = () => {
    if (queue.length === 0) {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Descargando datos recientes de Supabase...', 'info');
      }
      if (window.cargarDatosDeSupabase) {
        window.cargarDatosDeSupabase().then(() => {
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('Datos actualizados correctamente.', 'success');
          } else {
            window.mostrarNotificacion('Datos actualizados correctamente.', 'success');
          }
        }).catch(err => {
          console.error('[Sync] Error al descargar datos:', err);
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('Error al descargar datos: ' + err.message, 'error');
          }
        }).finally(() => {
          window._isSyncManualForced = false;
        });
      } else {
        window._isSyncManualForced = false;
      }
    } else {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Iniciando sincronización de cambios locales...', 'info');
      }
      processSyncQueue().finally(() => {
        window._isSyncManualForced = false;
      });
    }
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

window.limpiarColaSincronizacion = function() {
  localStorage.setItem('sapi_sync_queue', '[]');
  if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
  console.log('[Sync] Cola de sincronización limpiada manualmente.');
  return 'Cola de sincronización vaciada con éxito.';
};

window.cerrarModalSyncDetalles = function() {
  const modal = document.getElementById('modal-sync-detalles');
  if (modal) modal.classList.remove('open');
};

window.ejecutarForzarSyncDesdeModal = function() {
  window.cerrarModalSyncDetalles();
  window.forzarSincronizacionManual();
};

window.verDetallesSincronizacion = function() {
  try {
    console.log('[Sync] verDetallesSincronizacion invocado.');
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    
    const listaEl = document.getElementById('sync-detalles-lista');
    const titleEl = document.querySelector('#modal-sync-detalles h2');
    const descEl = document.querySelector('#modal-sync-detalles .modal-body p');
    const actionBtn = document.getElementById('btn-import-cards-confirm') || document.querySelector('#modal-sync-detalles .form-actions button.btn-primary');
    
    if (listaEl) {
      listaEl.innerHTML = '';
      if (queue.length === 0) {
        if (titleEl) titleEl.textContent = 'Estado del Sistema';
        if (descEl) descEl.textContent = 'Todos tus cambios locales están guardados. Puedes forzar una descarga completa para obtener los últimos tickets creados desde otros dispositivos:';
        if (actionBtn) actionBtn.textContent = 'Descargar Nube (Sincronizar)';
        
        const emptyEl = document.createElement('div');
        emptyEl.style.textAlign = 'center';
        emptyEl.style.padding = '1.5rem';
        emptyEl.style.color = 'var(--text-muted)';
        emptyEl.style.fontSize = '0.9rem';
        emptyEl.innerHTML = '<i data-lucide="cloud-lightning" style="width:36px;height:36px;margin:0 auto 0.5rem auto;display:block;color:var(--accent,#e8820c);"></i> No hay cambios locales pendientes.';
        listaEl.appendChild(emptyEl);
      } else {
        if (titleEl) titleEl.textContent = 'Cambios Pendientes de Sincronizar';
        if (descEl) descEl.textContent = 'Los siguientes cambios se realizaron de manera local y están esperando a ser subidos a Supabase:';
        if (actionBtn) actionBtn.textContent = 'Sincronizar Ahora';
        
        queue.forEach(item => {
          if (!item) return;
          let desc = 'Sin descripción';
          if (item.data) {
            desc = item.data.folio || item.data.asunto || item.data.nombre || item.data.razon_social || item.data.descripcion || item.data.concepto || item.data.cliente || item.data.id || 'Sin descripción';
          }
          
          const itemEl = document.createElement('div');
          itemEl.style.display = 'flex';
          itemEl.style.flexDirection = 'column';
          itemEl.style.gap = '0.5rem';
          itemEl.style.background = 'var(--bg-card, #ffffff)';
          itemEl.style.border = '1px solid var(--border, #e5e7eb)';
          itemEl.style.borderRadius = '10px';
          itemEl.style.padding = '0.85rem 1rem';
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
          badgeContainer.style.gap = '0.5rem';
          
          const tableBadge = document.createElement('span');
          tableBadge.textContent = item.table;
          tableBadge.style.background = 'rgba(232, 130, 12, 0.08)';
          tableBadge.style.color = 'var(--accent, #e8820c)';
          tableBadge.style.border = '1px solid rgba(232, 130, 12, 0.2)';
          tableBadge.style.padding = '0.2rem 0.5rem';
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
          actionBadge.style.padding = '0.2rem 0.5rem';
          actionBadge.style.borderRadius = '6px';
          actionBadge.style.textTransform = 'uppercase';
          actionBadge.style.fontWeight = '700';
          actionBadge.style.fontSize = '0.65rem';
          actionBadge.style.letterSpacing = '0.05em';
          
          badgeContainer.appendChild(tableBadge);
          badgeContainer.appendChild(actionBadge);
          
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '✕';
          deleteBtn.style.background = 'transparent';
          deleteBtn.style.border = 'none';
          deleteBtn.style.color = 'var(--text-muted)';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.fontSize = '1rem';
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
          
          headerEl.appendChild(badgeContainer);
          headerEl.appendChild(deleteBtn);
          
          const bodyEl = document.createElement('div');
          bodyEl.textContent = desc;
          bodyEl.style.fontSize = '0.85rem';
          bodyEl.style.fontWeight = '600';
          bodyEl.style.color = 'var(--text-primary)';
          bodyEl.style.wordBreak = 'break-word';
          bodyEl.style.lineHeight = '1.4';
          
          itemEl.appendChild(headerEl);
          itemEl.appendChild(bodyEl);

          // Si el elemento falló en un intento previo, mostrar el error en rojo
          if (item.lastError) {
            const errEl = document.createElement('div');
            errEl.style.fontSize = '0.72rem';
            errEl.style.color = '#ef4444';
            errEl.style.marginTop = '0.25rem';
            errEl.style.fontWeight = '600';
            errEl.style.background = 'rgba(239, 68, 68, 0.05)';
            errEl.style.border = '1px solid rgba(239, 68, 68, 0.12)';
            errEl.style.padding = '0.35rem 0.5rem';
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
      console.error('[Sync] No se encontró modal-sync-detalles en el documento.');
    }
  } catch (err) {
    console.error('[Sync] Error al abrir detalles de sincronización:', err);
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Error al abrir detalles de sincronización: ' + err.message, 'error');
    }
    console.error('[Sync] Excepción en verDetallesSincronizacion:', err);
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
      if (['empresa', 'cliente'].includes(rol)) {
        isClientOrEmpresa = true;
      }
    } catch (e) {}

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
      const { data: configDb, error: configErr } = await sb.from('config').select('*');
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
      }
    } catch (cfgErr) {
      console.error('[Sync] Excepción al procesar config:', cfgErr.message);
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
            idInterno: m.id || m.id_interno,
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
      // 1. Descargar IDs que tienen PDF de forma rápida (sin Base64)
      const resPed = await sb.from('tickets').select('id').not('pdf_pedido', 'is', null);
      if (resPed.data) idsWithPedido = new Set(resPed.data.map(x => x.id));
      
      const resCot = await sb.from('tickets').select('id').not('pdf_cotizacion', 'is', null);
      if (resCot.data) idsWithCotizacion = new Set(resCot.data.map(x => x.id));

      // 2. Descargar columnas principales del ticket (excluyendo Base64 pesados de PDFs)
      const columns = 'id, folio, fecha, fecha_creacion, canal, contacto, asunto, cliente, sitio, solicitante, area, categoria, prioridad, asignado, descripcion, equipo, notas, estado, cotizacion_sap, cot_aceptada, motivo_rechazo, pedido_sap, created_at, fecha_cierre, monto_cotizacion';
      const res = await sb.from('tickets').select(columns);
      ticketsDb = res.data;
      ticketsError = res.error;
    } catch (e) {
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
          idInterno: m.id || m.id_interno,
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
      const { data: levantamientosDb, error: levErr } = await sb.from('levantamientos').select('*');
      if (levantamientosDb && !levErr) {
        localStorage.setItem('sapi_levantamientos', JSON.stringify(levantamientosDb));
        if (typeof window.levantamientos !== 'undefined') {
          window.levantamientos = levantamientosDb;
        }
      } else if (levErr) {
        console.error('[Sync] Error loading levantamientos:', levErr);
      }
    } catch (e) {
      console.error('[Sync] Exception loading levantamientos:', e);
    }

    // Órdenes — mismo principio
    const { data: ordenes, error: ordenesError } = await sb.from('ordenes').select('*');
    window.lastSyncOrdsLength = ordenes ? ordenes.length : -1;
    window.lastSyncOrdsError = ordenesError ? ordenesError.message : null;
    window.lastSyncTimestamp = new Date().toISOString();
    if (ordenes) {
      let bitacorasMap = {};
      try {
        const { data: bitacorasDb } = await sb.from('orden_bitacora').select('*');
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
      const { data: claraDb, error: claraErr } = await sb.from('clara_transactions').select('*');
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
      const { data: cardsDb, error: cardsErr } = await sb.from('clara_cards').select('*');
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

    // Cotizaciones SAP (Caché en memoria y localStorage para autocompletar)
    try {
      const { data: cotizaciones, error: cotizacionesErr } = await sb.from('cotizaciones_sap').select('*').order('numero_cotizacion', { ascending: false });
      if (!cotizacionesErr && cotizaciones) {
        window._cacheCotizacionesSap = cotizaciones;
        await window.saveCatalogOffline('eurorep_cotizaciones_sap', cotizaciones);
      }
    } catch (errCot) {
      console.warn('[Sync] Error al cargar cotizaciones_sap:', errCot);
    }

    // Pedidos SAP (Caché en memoria y localStorage para autocompletar)
    try {
      const { data: pedidos, error: pedidosErr } = await sb.from('pedidos_sap').select('*').order('numero_pedido', { ascending: false });
      if (!pedidosErr && pedidos) {
        window._cachePedidosSap = pedidos;
        await window.saveCatalogOffline('eurorep_pedidos_sap', pedidos);
      }
    } catch (errPed) {
      console.warn('[Sync] Error al cargar pedidos_sap:', errPed);
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
        const { data: dbData, error } = await window.supabaseClient.from(tableName).select('*');
        if (error) throw error;
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
              current[idx] = ticket;
            } else {
              current.unshift(ticket);
            }
            mapped = current;
          }
        } else {
          mapped = data.map(rowToTicket);
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

      } else if (tableName === 'sapi_telemetry') {
        let mapped = [];
        const mapTelemetry = t => ({
          id: t.id,
          userId: t.user_id,
          userName: t.user_name,
          userRole: t.user_role,
          action: t.action,
          details: t.details || {},
          timestamp: t.timestamp,
          userAgent: t.user_agent
        });

        if (!isFallback) {
          const current = JSON.parse(localStorage.getItem('sapi_telemetry_events') || '[]');
          if (payload.eventType === 'DELETE') {
            mapped = current.filter(t => t.id !== payload.old.id);
          } else {
            const item = mapTelemetry(payload.new);
            const idx = current.findIndex(t => t.id === item.id);
            if (idx > -1) {
              current[idx] = item;
            } else {
              current.unshift(item);
            }
            mapped = current.slice(0, 300);
          }
        } else {
          const { data: telemetryDb, error: telemetryErr } = await window.supabaseClient.from('sapi_telemetry').select('*').limit(300).order('timestamp', { ascending: false });
          if (!telemetryErr && telemetryDb) {
            mapped = telemetryDb.map(mapTelemetry);
          }
        }
        localStorage.setItem('sapi_telemetry_events', JSON.stringify(mapped));

        // Re-render dashboard live if they are currently on the telemetry tab
        const activeView = document.querySelector('.view.active');
        if (activeView && activeView.id === 'view-telemetry' && window.renderTelemetryDashboard) {
          window.renderTelemetryDashboard();
        }

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

      } else if (tableName === 'clara_cards') {
        let mappedCards = [];
        const mapCard = row => ({
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
        });

        if (!isFallback) {
          const current = window._supaClaraCards || JSON.parse(localStorage.getItem('sapi_clara_cards') || '[]');
          if (payload.eventType === 'DELETE') {
            mappedCards = current.filter(c => c.id !== payload.old.id);
          } else {
            const card = mapCard(payload.new);
            const idx = current.findIndex(c => c.id === card.id);
            if (idx > -1) {
              current[idx] = card;
            } else {
              current.unshift(card);
            }
            mappedCards = current;
          }
        } else {
          mappedCards = data.map(mapCard);
        }
        localStorage.setItem('sapi_clara_cards', JSON.stringify(mappedCards));
        window._supaClaraCards = mappedCards;
      }
      
      window.dispatchEvent(new Event('supabase_datos_cargados'));
    } catch (e) {
      console.error(`[Realtime] Error al procesar actualización de la tabla ${tableName}:`, e.message);
    }
  };

  try {
    if (window.supabaseRealtimeChannel) {
      window.supabaseClient.removeChannel(window.supabaseRealtimeChannel);
    }
    window.supabaseRealtimeChannel = window.supabaseClient.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => handleUpdate('tickets', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, (payload) => handleUpdate('ordenes', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clara_transactions' }, (payload) => handleUpdate('clara_transactions', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clara_cards' }, (payload) => handleUpdate('clara_cards', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sapi_telemetry' }, (payload) => handleUpdate('sapi_telemetry', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendario_eventos' }, (payload) => handleUpdate('calendario_eventos', payload));
      
    window.supabaseRealtimeChannel.subscribe();
  } catch (err) {
    console.error('[Realtime] Excepción al suscribirse al canal en tiempo real:', err.message);
  }
}

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
    setupRealtime();
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

  // Sanitizar el filePath para evitar caracteres prohibidos en Supabase Storage (como [, ], *, ?)
  const sanitizedPath = (filePath || '').replace(/[\[\]\*?]/g, '');

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
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const oldModal = document.getElementById('sapi-dynamic-sync-modal');
    if (oldModal) oldModal.remove();

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
    
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

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
    closeBtn.onclick = () => overlay.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.padding = '1.5rem';
    body.style.maxHeight = '60vh';
    body.style.overflowY = 'auto';
    
    if (queue.length === 0) {
      body.innerHTML = `
        <div style="text-align:center; color:var(--text-muted, #6b7280); padding: 2rem 1rem;">
          <i data-lucide="check-circle" style="width:48px;height:48px;margin:0 auto 1rem auto;display:block;color:var(--green,#10b981);"></i>
          <p style="margin:0; font-size:1.05rem; font-weight:500;">Todos tus cambios locales están guardados.</p>
        </div>
      `;
    } else {
      const p = document.createElement('p');
      p.textContent = 'Los siguientes cambios se realizaron localmente y están esperando a subir:';
      p.style.margin = '0 0 1rem 0';
      p.style.fontSize = '0.9rem';
      p.style.color = 'var(--text-secondary, #4b5563)';
      body.appendChild(p);
      
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '0.75rem';
      
      queue.forEach((item, index) => {
        const itemBox = document.createElement('div');
        itemBox.style.border = '1px solid var(--border, #e5e7eb)';
        itemBox.style.borderRadius = '10px';
        itemBox.style.padding = '1rem';
        itemBox.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
        
        let desc = 'Sin descripción';
        if (item && item.data) {
          desc = item.data.folio || item.data.asunto || item.data.nombre || item.data.cliente || item.data.id || 'Registro en ' + item.table;
        }
        
        itemBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <span style="font-size:0.7rem; font-weight:700; background:rgba(232,130,12,0.1); color:var(--accent,#e8820c); padding:0.2rem 0.5rem; border-radius:6px; border:1px solid rgba(232,130,12,0.2);">${item.table || 'DESCONOCIDO'}</span>
              <span style="font-size:0.7rem; font-weight:700; background:#e5e7eb; color:#4b5563; padding:0.2rem 0.5rem; border-radius:6px;">${item.action || 'UPSERT'}</span>
            </div>
          </div>
          <div style="font-size:0.85rem; font-weight:600; word-break:break-word;">${desc}</div>
        `;

        if (item.lastError) {
          const errEl = document.createElement('div');
          errEl.style.fontSize = '0.72rem';
          errEl.style.color = '#ef4444';
          errEl.style.marginTop = '0.4rem';
          errEl.style.fontWeight = '600';
          errEl.style.background = 'rgba(239, 68, 68, 0.05)';
          errEl.style.border = '1px solid rgba(239, 68, 68, 0.12)';
          errEl.style.padding = '0.4rem 0.5rem';
          errEl.style.borderRadius = '6px';
          errEl.style.display = 'flex';
          errEl.style.gap = '0.4rem';
          errEl.style.alignItems = 'flex-start';
          errEl.innerHTML = `
            <i data-lucide="alert-triangle" style="width:14px;height:14px;flex-shrink:0;margin-top:0.1rem;"></i>
            <span>Error: ${item.lastError} ${item.lastErrorCode ? `(Código: ${item.lastErrorCode})` : ''}</span>
          `;
          itemBox.appendChild(errEl);
        }
        list.appendChild(itemBox);
      });
      body.appendChild(list);
    }
    
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
    closeAction.onclick = () => overlay.remove();
    
    const syncAction = document.createElement('button');
    syncAction.textContent = 'Sincronizar Ahora';
    syncAction.className = 'btn-primary';
    syncAction.onclick = () => {
      overlay.remove();
      if (typeof window.forzarSincronizacionManual === 'function') {
        window.forzarSincronizacionManual();
      }
    };
    
    footer.appendChild(closeAction);
    footer.appendChild(syncAction);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

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

  } catch (err) {
    console.error('[Sync] Excepción:', err);
    alert('Error abriendo modal: ' + err.message);
  }
};
