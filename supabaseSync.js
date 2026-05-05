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
          if (u.email === 'admin@eurorep.com.mx') continue; // Evitar duplicar el default
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
      localStorage.setItem('sapi_ordenes', JSON.stringify(ordMapped));
    }
    
    // Disparar un evento para que app.js sepa que debe recargar variables de memoria
    window.dispatchEvent(new Event('supabase_datos_cargados'));

  } catch (error) {
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
      if (item.email === 'admin@eurorep.com.mx') return;
      payload = {
        id: item.id,
        nombre: item.nombre,
        email: item.email || `${item.id}@temp.com`,
        pin: item.pin || '0000',
        rol: item.rol || 'tecnico',
        activo: item.activo,
        empresa: item.empresa || null
      };
    }

    const { error } = await window.supabaseClient.from(tabla).upsert(payload);
    if (error) console.error(`Error guardando en ${tabla}:`, error);
  } catch (e) {
    console.error(`Error de red al guardar en ${tabla}:`, e);
  }
};

// Interceptor mágico de LocalStorage: cuando app.js guarda algo local, también lo subimos a la nube
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  // Guardar localmente primero (mantiene UI rápida)
  originalSetItem.apply(this, arguments);
  
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
      data.forEach(o => window.pushToSupabase('ordenes', o));
    }
  } catch(e) {
    // Ignorar si no es JSON o hay error
  }
};
