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
    notas: o.notas || null,
    evidencia_base64: o.evidenciaBase64 || null
  };
}

function rowToOrden(o) {
  return {
    id: o.id, folio: o.folio, cliente: o.cliente,
    ubicacion: o.ubicacion, tecnico: o.tecnico, modelo: o.modelo,
    tipo: o.tipo, estado: o.estado, fecha: o.fecha,
    fechaInicio: o.fecha_inicio, fechaFin: o.fecha_fin,
    duracion: o.duracion_minutos, notas: o.notas,
    evidenciaBase64: o.evidencia_base64
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

// ─── pushToSupabase: Función central de escritura a la nube ─────────────────

window.pushToSupabase = async function(tabla, item) {
  const sb = window.supabaseClient;
  if (!sb) {
    console.warn('[Supabase] Cliente no disponible aún. El dato se guardó localmente.');
    return;
  }

  let payload;
  try {
    if (tabla === 'tickets') {
      payload = ticketToRow(item);
    } else if (tabla === 'ordenes') {
      payload = ordenToRow(item);
    } else if (tabla === 'clientes') {
      payload = clienteToRow(item);
    } else if (tabla === 'usuarios') {
      if (item.email === 'admin@eurorep.mx') return;
      payload = {
        id: item.id,
        nombre: item.nombre,
        email: item.email || `${item.id}@temp.com`,
        pin: item.pin || '0000',
        rol: item.rol || 'tecnico',
        activo: item.activo !== false,
        empresa: item.empresa || null
      };
    } else if (tabla === 'sitios') {
      payload = { id: item.id, nombre: item.nombre, cliente: item.cliente, direccion: item.direccion, cp: item.cp, ciudad: item.ciudad, estado: item.estado, custom_data: item.customData || {} };
    } else if (tabla === 'maquinaria') {
      payload = { id: item.id, serie: item.serie, marca: item.marca, modelo: item.modelo, anio: item.anio, cliente: item.cliente, id_interno: item.idInterno, descripcion: item.descripcion, custom_data: item.customData || {} };
    } else if (tabla === 'refacciones') {
      payload = { id: item.id, codigo: item.codigo, descripcion: item.descripcion, precio: item.precio, moneda: item.moneda, stock: item.stock, custom_data: item.customData || {} };
    } else if (tabla === 'config' || tabla === 'roles') {
      payload = { id: 'main', data: item };
    } else {
      payload = item;
    }

    const { error } = await sb.from(tabla).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`[Supabase] Error upsert en ${tabla}:`, error.message, error.details);
    } else {
      console.log(`[Supabase] ✅ ${tabla} guardado correctamente.`);
    }
  } catch (e) {
    console.error(`[Supabase] Excepción al guardar en ${tabla}:`, e.message);
  }
};

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
    await cargarDatosDeSupabase();

  } catch (err) {
    console.error('[Supabase] Error durante la migración:', err.message);
    // Aún así intentamos cargar lo que hay en la nube
    try { await cargarDatosDeSupabase(); } catch(e2) {}
  }
}

// ─── cargarDatosDeSupabase: Descarga la nube a localStorage / variables ─────

async function cargarDatosDeSupabase() {
  const sb = window.supabaseClient;
  if (!sb) return;

  window._isSyncingFromSupabase = true;

  try {
    // Usuarios
    const { data: usuarios } = await sb.from('usuarios').select('*');
    if (usuarios && usuarios.length > 0) {
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
    }

    // Clientes
    const { data: clientes } = await sb.from('clientes').select('*');
    if (clientes && clientes.length > 0) {
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientes.map(rowToCliente)));
    }

    // Tickets — SOLO sobreescribir local si la nube tiene tickets
    const { data: ticketsDb } = await sb.from('tickets').select('*');
    if (ticketsDb && ticketsDb.length > 0) {
      const mapped = ticketsDb.map(rowToTicket);
      window._supaTickets = mapped;
      localStorage.setItem('sapi_tickets', JSON.stringify(mapped));
    } else {
      // Si la nube está vacía, respetamos el local (no borramos nada)
      window._supaTickets = null;
    }

    // Órdenes — mismo principio
    const { data: ordenes } = await sb.from('ordenes').select('*');
    if (ordenes && ordenes.length > 0) {
      window._supaOrdenes = ordenes.map(rowToOrden);
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

    // Refacciones
    const { data: refDb } = await sb.from('refacciones').select('*');
    if (refDb && refDb.length > 0) {
      const mapped = refDb.map(r => ({ id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, customData: r.custom_data }));
      localStorage.setItem('sapi_refacciones_db', JSON.stringify(mapped));
    }

    // Config
    const { data: configDb } = await sb.from('config').select('*');
    if (configDb && configDb.length > 0 && configDb[0].data) {
      localStorage.setItem('eurorep_config', JSON.stringify(configDb[0].data));
    }

    // Roles
    const { data: rolesDb } = await sb.from('roles').select('*');
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

// ─── Arrancar cuando el DOM esté listo ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Esperar brevemente para asegurar que supabaseClient.js ya inicializó window.supabaseClient
  setTimeout(() => {
    migrarDatosASupabase();
  }, 300);
});
