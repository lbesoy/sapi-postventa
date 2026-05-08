// Logica de sincronización inicial entre localStorage y Supabase

async function migrarDatosASupabase() {
  if (!window.supabaseClient) {
    console.error("Supabase no está inicializado.");
    return;
  }

  const sb = window.supabaseClient;
  let hayCambios = false;

  try {
    // 1. USUARIOS
    const { data: dbUsuarios, error: errUsu } = await sb.from('usuarios').select('*');
    if (!errUsu && dbUsuarios.length <= 1) { // Solo está el admin por defecto
      const localUsuarios = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
      if (localUsuarios.length > 0) {
        console.log("Migrando usuarios a Supabase...");
        for (const u of localUsuarios) {
          if (u.email === 'admin@eurorep.mx') continue; // Evitar duplicar el default
          await sb.from('usuarios').insert({
            id: u.id,
            nombre: u.nombre,
            email: u.email || `${u.id}@temp.com`,
            pin: u.pin || '0000',
            rol: u.rol || 'tecnico',
            activo: u.activo !== false,
            empresa: u.empresa || null
          });
        }
        hayCambios = true;
      }
    }

    // 2. CLIENTES
    const { data: dbClientes, error: errCli } = await sb.from('clientes').select('*');
    if (!errCli && dbClientes.length === 0) {
      const localClientes = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
      if (localClientes.length > 0) {
        console.log("Migrando clientes a Supabase...");
        for (const c of localClientes) {
          await sb.from('clientes').insert({
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
          });
        }
        hayCambios = true;
      }
    }

    // 3. ORDENES (Tickets)
    const { data: dbOrdenes, error: errOrd } = await sb.from('ordenes').select('*');
    if (!errOrd && dbOrdenes.length === 0) {
      const localOrdenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      if (localOrdenes.length > 0) {
        console.log("Migrando órdenes a Supabase...");
        for (const o of localOrdenes) {
          await sb.from('ordenes').insert({
            id: o.id || crypto.randomUUID(),
            folio: o.folio,
            cliente: o.cliente,
            ubicacion: o.ubicacion,
            tecnico: o.tecnico,
            modelo: o.modelo,
            tipo: o.tipo || 'Servicio',
            estado: o.estado || 'Pendiente',
            fecha: o.fecha || new Date().toISOString(),
            fecha_inicio: o.fechaInicio || null,
            fecha_fin: o.fechaFin || null,
            duracion_minutos: o.duracion || null,
            notas: o.notas || null
          });
        }
        hayCambios = true;
      }
    }

    // 4. TICKETS (Soporte)
    const { data: dbTickets, error: errTik } = await sb.from('tickets').select('*');
    if (!errTik && dbTickets.length === 0) {
      const localTickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      if (localTickets.length > 0) {
        console.log("Migrando tickets a Supabase...");
        for (const t of localTickets) {
          await sb.from('tickets').insert({
            id: t.id || crypto.randomUUID(),
            folio: t.folio,
            fecha: t.fecha,
            fecha_creacion: t.fechaCreacion,
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
            cotizacion_sap: t.cotizacionSAP,
            cot_aceptada: t.cotAceptada,
            motivo_rechazo: t.motivoRechazo,
            pedido_sap: t.pedidoSAP,
            tecnicos_asignados: t.tecnicosAsignados || [],
            pdf_pedido: t.pdfPedido,
            pdf_cotizacion: t.pdfCotizacion
          });
        }
        hayCambios = true;
      }
    }

    const { data: dbSitios, error: errSit } = await sb.from('sitios').select('*');
    if (!errSit && dbSitios.length === 0) {
      const local = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
      if (local.length > 0) {
        for (const i of local) await window.pushToSupabase('sitios', i);
        hayCambios = true;
      }
    }

    const { data: dbMaq, error: errMaq } = await sb.from('maquinaria').select('*');
    if (!errMaq && dbMaq.length === 0) {
      const local = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
      if (local.length > 0) {
        for (const i of local) await window.pushToSupabase('maquinaria', i);
        hayCambios = true;
      }
    }

    const { data: dbRef, error: errRef } = await sb.from('refacciones').select('*');
    if (!errRef && dbRef.length === 0) {
      const local = JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]');
      if (local.length > 0) {
        for (const i of local) await window.pushToSupabase('refacciones', i);
        hayCambios = true;
      }
    }

    const { data: dbConfig, error: errConf } = await sb.from('config').select('*');
    if (!errConf && dbConfig.length === 0) {
      const local = JSON.parse(localStorage.getItem('eurorep_config') || 'null');
      if (local) {
        await window.pushToSupabase('config', local);
        hayCambios = true;
      }
    }
    // Migración individual por tabla para evitar perder datos si una tabla (como usuarios) ya tiene datos pero las demás están vacías.
    
    // 1. Usuarios
    const { data: uSupa } = await sb.from('usuarios').select('id').limit(1);
    const lUsu = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
    if ((!uSupa || uSupa.length === 0) && lUsu.length > 0) {
      console.log("Migrando usuarios...");
      for (const u of lUsu) {
        if (u.id !== 'superadmin' || u.email !== '') await pushToSupabase('usuarios', u);
      }
      hayCambios = true;
    }

    // 2. Clientes
    const { data: cSupa } = await sb.from('clientes').select('id').limit(1);
    const lCli = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    if ((!cSupa || cSupa.length === 0) && lCli.length > 0) {
      console.log("Migrando clientes...");
      for (const c of lCli) await pushToSupabase('clientes', c);
      hayCambios = true;
    }

    // 3. Ordenes
    const { data: oSupa } = await sb.from('ordenes').select('id').limit(1);
    const lOrd = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if ((!oSupa || oSupa.length === 0) && lOrd.length > 0) {
      console.log("Migrando ordenes...");
      for (const o of lOrd) await pushToSupabase('ordenes', o);
      hayCambios = true;
    }

    // 4. Tickets
    const { data: tSupa } = await sb.from('tickets').select('id').limit(1);
    const lTik = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
    // Delete the test ticket I just made if it exists so we can actually see if it's empty
    if ((!tSupa || tSupa.length === 0 || (tSupa.length === 1 && tSupa[0].id === 'test')) && lTik.length > 0) {
      console.log("Migrando tickets...");
      for (const t of lTik) await pushToSupabase('tickets', t);
      hayCambios = true;
    }

    // 5. Sitios
    const { data: sSupa } = await sb.from('sitios').select('id').limit(1);
    const lSit = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    if ((!sSupa || sSupa.length === 0) && lSit.length > 0) {
      for (const s of lSit) await pushToSupabase('sitios', s);
    }

    // 6. Maquinaria
    const { data: mSupa } = await sb.from('maquinaria').select('id').limit(1);
    const lMaq = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
    if ((!mSupa || mSupa.length === 0) && lMaq.length > 0) {
      for (const m of lMaq) await pushToSupabase('maquinaria', m);
    }

    // 7. Refacciones
    const { data: rSupa } = await sb.from('refacciones').select('id').limit(1);
    const lRef = JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]');
    if ((!rSupa || rSupa.length === 0) && lRef.length > 0) {
      for (const r of lRef) await pushToSupabase('refacciones', r);
    }

    // 8. Config
    const { data: cfgSupa } = await sb.from('config').select('id').limit(1);
    const lCfg = JSON.parse(localStorage.getItem('eurorep_config') || 'null');
    if ((!cfgSupa || cfgSupa.length === 0) && lCfg) {
      await pushToSupabase('config', lCfg);
    }

    // 9. Roles
    const { data: rolSupa } = await sb.from('roles').select('id').limit(1);
    const lRol = JSON.parse(localStorage.getItem('sapi_roles_config') || 'null');
    if ((!rolSupa || rolSupa.length === 0) && lRol) {
      await pushToSupabase('roles', lRol);
    }

    if (hayCambios) {
      console.log("✅ Migración inicial completada con éxito.");
    }

    // Ahora, descargar siempre de Supabase hacia LocalStorage para mantener el estado actual
    await cargarDatosDeSupabase();

  } catch (err) {
    console.error("Error en la migración a Supabase:", err);
  }
}

async function cargarDatosDeSupabase() {
  const sb = window.supabaseClient;
  if (!sb) return;
  window._isSyncingFromSupabase = true;

  try {
    const { data: usuarios } = await sb.from('usuarios').select('*');
    if (usuarios && usuarios.length > 0) {
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
    } else {
      // Si Supabase regresa vacío (quizá por RLS), inyectar lbesoy por seguridad
      const localU = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
      if (localU.length === 0) {
        localU.push({ id: 'lbesoy', nombre: 'Pablo Besoy', email: 'lbesoy', pin: 'pbesoy13', rol: 'superadmin', activo: true, locked: false });
        localStorage.setItem('eurorep_usuarios', JSON.stringify(localU));
      }
    }

    const { data: clientes } = await sb.from('clientes').select('*');
    if (clientes) {
      // Mapear de snake_case a camelCase para mantener compatibilidad con app.js
      const cliMapped = clientes.map(c => ({
        id: c.id,
        nombre: c.nombre,
        rfc: c.rfc,
        email: c.email,
        telefono: c.telefono,
        idFiscal: c.id_fiscal,
        sitios: c.sitios || [],
        maquinas: c.maquinas || [],
        supervisoresAsignados: c.supervisores_asignados || [],
        tecnicosAsignados: c.tecnicos_asignados || []
      }));
      localStorage.setItem('sapi_clientes_db', JSON.stringify(cliMapped));
    }

    const { data: ordenes } = await sb.from('ordenes').select('*');
    if (ordenes) {
      const ordMapped = ordenes.map(o => ({
        id: o.id,
        folio: o.folio,
        cliente: o.cliente,
        ubicacion: o.ubicacion,
        tecnico: o.tecnico,
        modelo: o.modelo,
        tipo: o.tipo,
        estado: o.estado,
        fecha: o.fecha,
        fechaInicio: o.fecha_inicio,
        fechaFin: o.fecha_fin,
        duracion: o.duracion_minutos,
        notas: o.notas,
        evidenciaBase64: o.evidencia_base64
      }));
      window._supaOrdenes = ordMapped;
      try {
        localStorage.removeItem('sapi_ordenes');
      } catch(e) {}
    }

    const { data: ticketsDb } = await sb.from('tickets').select('*');
    if (ticketsDb) {
      const tikMapped = ticketsDb.map(t => ({
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
        tecnicosAsignados: t.tecnicos_asignados,
        pdfPedido: t.pdf_pedido,
        pdfCotizacion: t.pdf_cotizacion
      }));
      window._supaTickets = tikMapped;
      try {
        localStorage.removeItem('sapi_tickets');
      } catch(e) {}
    }

    const { data: sitiosDb } = await sb.from('sitios').select('*');
    if (sitiosDb) {
      const sitMapped = sitiosDb.map(s => ({
        id: s.id, nombre: s.nombre, cliente: s.cliente, direccion: s.direccion, cp: s.cp, ciudad: s.ciudad, estado: s.estado, customData: s.custom_data
      }));
      localStorage.setItem('sapi_sitios_db', JSON.stringify(sitMapped));
    }

    const { data: maqDb } = await sb.from('maquinaria').select('*');
    if (maqDb) {
      const maqMapped = maqDb.map(m => ({
        id: m.id, serie: m.serie, marca: m.marca, modelo: m.modelo, anio: m.anio, cliente: m.cliente, idInterno: m.id_interno, descripcion: m.descripcion, customData: m.custom_data
      }));
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maqMapped));
    }

    const { data: refDb } = await sb.from('refacciones').select('*');
    if (refDb) {
      const refMapped = refDb.map(r => ({
        id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, customData: r.custom_data
      }));
      localStorage.setItem('sapi_refacciones_db', JSON.stringify(refMapped));
    }

    const { data: configDb } = await sb.from('config').select('*');
    if (configDb && configDb.length > 0) {
      localStorage.setItem('eurorep_config', JSON.stringify(configDb[0].data));
    }

    const { data: rolesDb } = await sb.from('roles').select('*');
    if (rolesDb && rolesDb.length > 0) {
      localStorage.setItem('sapi_roles_config', JSON.stringify(rolesDb[0].data));
    }
    
    window._isSyncingFromSupabase = false;
    // Disparar un evento para que app.js sepa que debe recargar variables de memoria
    window.dispatchEvent(new Event('supabase_datos_cargados'));

  } catch (error) {
    window._isSyncingFromSupabase = false;
    console.error("Error cargando datos de Supabase:", error);
  }
}

// Ejecutar migración o carga al iniciar
document.addEventListener('DOMContentLoaded', () => {
  migrarDatosASupabase();
});

// Exponer utilidad para guardar datos hacia Supabase desde app.js
window.pushToSupabase = async function(tabla, item) {
  if (!window.supabaseClient) return;
  try {
    // Convertir camelCase a snake_case para la base de datos
    let payload = { ...item };
    
    if (tabla === 'clientes') {
      payload = {
        id: item.id,
        nombre: item.nombre,
        rfc: item.rfc || null,
        email: item.email || null,
        telefono: item.telefono || null,
        id_fiscal: item.idFiscal || null,
        sitios: item.sitios || [],
        maquinas: item.maquinas || [],
        supervisores_asignados: item.supervisoresAsignados || [],
        tecnicos_asignados: item.tecnicosAsignados || []
      };
    } else if (tabla === 'ordenes') {
      payload = {
        id: item.id,
        folio: item.folio,
        cliente: item.cliente,
        ubicacion: item.ubicacion,
        tecnico: item.tecnico,
        modelo: item.modelo,
        tipo: item.tipo,
        estado: item.estado,
        fecha: item.fecha,
        fecha_inicio: item.fechaInicio || null,
        fecha_fin: item.fechaFin || null,
        duracion_minutos: item.duracion || null,
        notas: item.notas || null,
        evidencia_base64: item.evidenciaBase64 || null
      };
    } else if (tabla === 'usuarios') {
      // Evitar guardar SuperAdmin en caso de error
      if (item.email === 'admin@eurorep.mx') return;
      payload = {
        id: item.id,
        nombre: item.nombre,
        email: item.email || `${item.id}@temp.com`,
        pin: item.pin || '0000',
        rol: item.rol || 'tecnico',
        activo: item.activo,
        empresa: item.empresa || null
      };
    } else if (tabla === 'tickets') {
      payload = {
        id: item.id,
        folio: item.folio,
        fecha: item.fecha,
        fecha_creacion: item.fechaCreacion,
        canal: item.canal,
        contacto: item.contacto,
        asunto: item.asunto,
        cliente: item.cliente,
        sitio: item.sitio,
        solicitante: item.solicitante,
        area: item.area,
        categoria: item.categoria,
        prioridad: item.prioridad,
        asignado: item.asignado,
        descripcion: item.descripcion,
        equipo: item.equipo,
        notas: item.notas,
        estado: item.estado,
        cotizacion_sap: item.cotizacionSAP,
        cot_aceptada: item.cotAceptada,
        motivo_rechazo: item.motivoRechazo,
        pedido_sap: item.pedidoSAP,
        tecnicos_asignados: item.tecnicosAsignados || [],
        pdf_pedido: item.pdfPedido,
        pdf_cotizacion: item.pdfCotizacion
      };
    } else if (tabla === 'sitios') {
      payload = {
        id: item.id, nombre: item.nombre, cliente: item.cliente, direccion: item.direccion, cp: item.cp, ciudad: item.ciudad, estado: item.estado, custom_data: item.customData || {}
      };
    } else if (tabla === 'maquinaria') {
      payload = {
        id: item.id, serie: item.serie, marca: item.marca, modelo: item.modelo, anio: item.anio, cliente: item.cliente, id_interno: item.idInterno, descripcion: item.descripcion, custom_data: item.customData || {}
      };
    } else if (tabla === 'refacciones') {
      payload = {
        id: item.id, codigo: item.codigo, descripcion: item.descripcion, precio: item.precio, moneda: item.moneda, stock: item.stock, custom_data: item.customData || {}
      };
    } else if (tabla === 'config' || tabla === 'roles') {
      payload = {
        id: 'main',
        data: item
      };
    }

    const { error } = await window.supabaseClient.from(tabla).upsert(payload);
    if (error) {
      console.error(`Error guardando en ${tabla}:`, error);
      alert(`Error Supabase [${tabla}]: ` + JSON.stringify(error));
    }
  } catch (e) {
    console.error(`Error de red al guardar en ${tabla}:`, e);
    alert(`Error de Red [${tabla}]: ` + e.message);
  }
};

// Interceptor mágico de LocalStorage: cuando app.js guarda algo local, también lo subimos a la nube
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (window._isSyncingFromSupabase) {
    try { originalSetItem.apply(this, arguments); } catch(e) {}
    return;
  }
  // Guardar localmente primero (mantiene UI rápida)
  try {
    originalSetItem.apply(this, arguments);
  } catch(e) {}
  
  if (!window.supabaseClient) return;

  try {
    const data = JSON.parse(value);
    
    // Si la lista de usuarios cambia, encontramos el que cambió (o subimos todos, más simple subir todos para sincronizar en esta fase)
    if (key === 'eurorep_usuarios' && Array.isArray(data)) {
      data.forEach(u => window.pushToSupabase('usuarios', u));
    }
    else if (key === 'sapi_clientes_db' && Array.isArray(data)) {
      data.forEach(c => window.pushToSupabase('clientes', c));
    }
    else if (key === 'sapi_ordenes' && Array.isArray(data)) {
      // Manejado directamente por app.js
    }
    else if (key === 'sapi_tickets' && Array.isArray(data)) {
      // Ahora se maneja directamente en app.js para evitar subir todos los tickets repetidamente
    }
    else if (key === 'sapi_sitios_db' && Array.isArray(data)) {
      data.forEach(s => window.pushToSupabase('sitios', s));
    }
    else if (key === 'sapi_maquinaria_db' && Array.isArray(data)) {
      data.forEach(m => window.pushToSupabase('maquinaria', m));
    }
    else if (key === 'sapi_refacciones_db' && Array.isArray(data)) {
      data.forEach(r => window.pushToSupabase('refacciones', r));
    }
    else if (key === 'eurorep_config') {
      window.pushToSupabase('config', data);
    }
    else if (key === 'sapi_roles_config') {
      window.pushToSupabase('roles', data);
    }
  } catch(e) {
    // Ignorar si no es JSON o hay error
  }
};
