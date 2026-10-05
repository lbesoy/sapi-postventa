// Shim for agregarMaquinaChip (implemented in tickets_form.js)
if (typeof window !== 'undefined' && !window.agregarMaquinaChip) {
  window.agregarMaquinaChip = function(maquinaName) {
    if (window.TicketsForm && typeof window.TicketsForm.agregarMaquinaChip === 'function') {
      return window.TicketsForm.agregarMaquinaChip(maquinaName);
    }
  };
}

let currentMaqSortCol = 'reciente';
let currentMaqSortDir = 'desc';
let currentCliSortCol = 'reciente';
let currentCliSortDir = 'desc';
let currentOrdSortCol = 'reciente';
let currentOrdSortDir = 'desc';
let currentDesgSortCol = 'fecha';
let currentDesgSortDir = 'asc';
let currentDesgloseData = [];

// Registrar Service Worker para soporte PWA (sólo en producción, no en localhost)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) {
        reg.unregister();
        console.log('[Dev] Service Worker desregistrado en localhost:', reg.scope);
      }
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then(keys => {
        for (const k of keys) {
          caches.delete(k);
        }
      });
    }
  } else {
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('[PWA] Service Worker registrado con éxito:', reg.scope);
          
          // Detectar actualizaciones e instalar inmediatamente
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[PWA] Nueva versión detectada e instalada. Recargando para aplicar cambios...');
                    setTimeout(() => {
                      window.location.reload();
                    }, 500);
                  }
                }
              });
            }
          });
        })
        .catch(err => console.error('[PWA] Error al registrar Service Worker:', err));

      // Forzar verificación de actualización cuando la app vuelve al primer plano
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.ready.then(reg => {
            reg.update().catch(err => console.log('[PWA] Error al buscar actualizaciones:', err));
          });
        }
      });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  }
}

// Shim for generarTicketsRefaccionesFaltantes (implemented in app_migrations.js)
if (typeof window !== 'undefined' && !window.generarTicketsRefaccionesFaltantes) {
  window.generarTicketsRefaccionesFaltantes = async function() {
    if (window.AppMigrations && typeof window.AppMigrations.generarTicketsRefaccionesFaltantes === 'function') {
      return await window.AppMigrations.generarTicketsRefaccionesFaltantes();
    }
  };
}

// CONTROL DE VERSION Y RECARGA/LOGOUT FORZADO PARA ACTUALIZACIONES CRÍTICAS
const APP_VERSION = 'v1.3.341'; // Incrementar esta versión para obligar a todos los usuarios a descargar el nuevo código
if (typeof localStorage !== 'undefined') {
  const lastVersion = localStorage.getItem('eurorep_app_version');
  if (lastVersion !== APP_VERSION) {
    console.log(`[Version] Nueva versión detectada: ${APP_VERSION}. Conservando datos y actualizando versión...`);
    localStorage.setItem('eurorep_app_version', APP_VERSION);
  }
}

// Proteger contra la ausencia de Lucide (por ejemplo, por fallas de carga de CDN)
if (typeof window !== 'undefined') {
  if (typeof window.lucide === 'undefined' || typeof window.lucide.createIcons !== 'function') {
    window.lucide = window.lucide || {};
    window.lucide.createIcons = function() {
      // Esperar a que la biblioteca Lucide termine de inicializarse
    };
  }
}

// Función temporal activa por 48 horas (hasta el 8 de julio de 2026 a las 10:30 AM) para permitir pasar tickets sin cotización.
window.isTemporaryNoQuotePeriodActive = function() {
  const deadline = new Date('2026-07-08T10:30:00-06:00');
  return new Date() < deadline;
};

// Proteger contra errores de cuota de almacenamiento (QuotaExceededError) de localStorage.setItem
if (typeof window !== 'undefined' && window.localStorage) {
  (function() {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function(key, value) {
      try {
        originalSetItem.call(window.localStorage, key, value);
      } catch (err) {
        console.warn('[LocalStorage] Capturado error al guardar clave:', key, err.message);
        if (err.name === 'QuotaExceededError' || err.message.toLowerCase().includes('quota')) {
          try {
            console.log('--- DIAGNÓSTICO DE LOCALSTORAGE ---');
            let totalMB = 0;
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              const val = localStorage.getItem(k) || '';
              const sizeMB = (val.length * 2) / (1024 * 1024); // UTF-16 characters are 2 bytes each
              console.log(`- ${k}: ${sizeMB.toFixed(3)} MB`);
              totalMB += sizeMB;
            }
            console.log(`Total utilizado: ${totalMB.toFixed(3)} MB / 5.000 MB`);
            console.log('-----------------------------------');
          } catch (diagErr) {
            console.error('Error al generar diagnóstico de localStorage:', diagErr);
          }
          try {
            // Intenta liberar espacio removiendo telemetría no crítica
            window.localStorage.removeItem('sapi_telemetry_events');
            // IMPORTANTE: Primero removemos la clave vieja para evitar el pico de memoria transitorio durante la sobreescritura
            window.localStorage.removeItem(key);
            originalSetItem.call(window.localStorage, key, value);
            console.warn('[LocalStorage] Elemento guardado tras purgar telemetría de depuración.');
          } catch (innerErr) {
            console.error('[LocalStorage] Fallo crítico de espacio tras purga:', innerErr.message);
          }
        }
      }
    };
  })();
}

// Proteger contra errores fatales de parseo de JSON malformados o corruptos en cliente
(function() {
  const originalParse = JSON.parse;
  JSON.parse = function(text, reviver) {
    try {
      return originalParse.call(JSON, text, reviver);
    } catch (err) {
      console.warn('[JSON] Parseo seguro interceptado ante error:', err.message);
      if (typeof text === 'string') {
        const trimmed = text.trim();
        if (trimmed.startsWith('[')) return [];
        if (trimmed.startsWith('{')) return {};
      }
      return null;
    }
  };
})();


// ===== HELPERS =====
function safeGetJSON(key, defaultVal) {
  try {
    const val = localStorage.getItem(key);
    return val && val !== 'undefined' ? JSON.parse(val) : defaultVal;
  } catch (e) {
    console.error(`Error parsing localStorage key "${key}":`, e);
    return defaultVal;
  }
}

// Wrapper seguro para localStorage.setItem — maneja QuotaExceededError
function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
      console.error(`[localStorage] Cuota excedida al guardar "${key}". Tamaño del valor: ${JSON.stringify(value)?.length || 0} chars.`, e);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(
          '⚠️ Almacenamiento local lleno. Algunos datos no pudieron guardarse localmente, pero se están sincronizando con la nube.',
          'warning'
        );
      }
    } else {
      console.error(`[localStorage] Error al guardar "${key}":`, e);
    }
    return false;
  }
}

window.safeGetJSON = safeGetJSON;
window.safeSetJSON = safeSetJSON;

function ensureBackdoorUsersFallback(users) {
  if (typeof window.ensureBackdoorUsers === 'function') {
    return window.ensureBackdoorUsers(users);
  }
  if (!Array.isArray(users)) users = [];
  return users;
}

function obtenerNombreUsuarioActual() {
  if (typeof currentSession !== 'undefined' && currentSession) {
    const realId = currentSession.realUserId || currentSession.userId;
    if (realId) {
      const user = (typeof usuarios !== 'undefined' ? usuarios : []).find(u => u.id === realId);
      if (user && user.nombre) return user.nombre;
    }
    if (currentSession.nombre) return currentSession.nombre;
  }
  return 'Supervisor';
}

// Helpers de fecha y hora local para México
function getLocalDateString(date = new Date()) {
  const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return offsetDate.toISOString().split('T')[0];
}

function formatFechaAmigable(dateStr) {
  if (!dateStr) return '—';
  if (typeof dateStr === 'object' && dateStr instanceof Date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(dateStr.getDate())}/${pad(dateStr.getMonth() + 1)}/${dateStr.getFullYear()}`;
  }
  const str = String(dateStr).trim();
  // Si contiene T00:00:00 o cualquier formato ISO con T
  if (str.includes('T')) {
    const datePortion = str.split('T')[0];
    const parts = datePortion.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const pad = (num) => String(num).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  // Si es fecha corta YYYY-MM-DD
  const parts = str.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}
window.formatFechaAmigable = formatFechaAmigable;



// ===== DATA =====
let ordenes = safeGetJSON('sapi_ordenes', []);
setTimeout(() => {
  if (typeof window.deduplicarOrdenesLocales === 'function') {
    window.deduplicarOrdenesLocales();
  }
}, 2000); // Eliminar duplicados fantasmas en segundo plano tras inicializar
// Limpieza única de tickets fantasmas de la caché local debido a la reasignación de folios en Supabase
if (typeof localStorage !== 'undefined' && !localStorage.getItem('eurorep_tickets_cleaned_v2')) {
  localStorage.removeItem('sapi_tickets');
  localStorage.setItem('eurorep_tickets_cleaned_v2', 'true');
  console.log('[Deduplicar] Limpieza inicial única de tickets locales realizada para evitar fantasmas.');
}
let tickets = safeGetJSON('sapi_tickets', []);
let levantamientos = safeGetJSON('sapi_levantamientos', []);
let ideasFallasDb = safeGetJSON('sapi_ideas_fallas', []);
window.ideasFallasDb = ideasFallasDb;
let clientesDb = safeGetJSON('sapi_clientes_db', []);
let refaccionesDb = [];
window.refaccionesDb = refaccionesDb;
(async () => {
  try {
    refaccionesDb = await window.loadRefaccionesLocal();
    window.refaccionesDb = refaccionesDb;
    console.log(`[App] Catálogo de refacciones cargado desde IndexedDB (${refaccionesDb.length} registros).`);
    
    // Si aún está vacío tras el inicio local, disparar recuperación reactiva si hay Supabase
    if (refaccionesDb.length === 0 && window.supabaseClient && !window._descargandoRefaccionesAuto) {
      window._descargandoRefaccionesAuto = true;
      window.supabaseClient.from('refacciones').select('*').limit(3500).then(({ data: sbData }) => {
        window._descargandoRefaccionesAuto = false;
        if (sbData && sbData.length > 0) {
          const mapped = sbData.map(r => ({
            id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, 
            marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
            grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
            ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
          }));
          refaccionesDb = mapped;
          window.refaccionesDb = mapped;
          if (typeof window.saveRefaccionesLocal === 'function') window.saveRefaccionesLocal(mapped);
          console.log(`[App] ⚡ Catálogo de refacciones recuperado reactivamente desde Supabase (${mapped.length} registros).`);
          if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
          if (typeof window.renderRefaccionesPendientes === 'function') window.renderRefaccionesPendientes();
        }
      }).catch(() => { window._descargandoRefaccionesAuto = false; });
    }

    if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
    else if (typeof renderRefacciones === 'function') renderRefacciones();
    if (typeof window.renderRefaccionesPendientes === 'function') window.renderRefaccionesPendientes();
    else if (typeof renderRefaccionesPendientes === 'function') renderRefaccionesPendientes();
  } catch (err) {
    console.error('[App] Error al inicializar refacciones desde IndexedDB:', err);
  }
})();
let tecnicosDb = safeGetJSON('sapi_tecnicos_db', []);
let sitiosDb = safeGetJSON('sapi_sitios_db', []);
let maquinariaDb = safeGetJSON('sapi_maquinaria_db', []);
let gastos = safeGetJSON('sapi_gastos', []);


let usuarios = ensureBackdoorUsersFallback(safeGetJSON('eurorep_usuarios', []));
let currentSession = safeGetJSON('eurorep_session', null) || { userId: '', viewMode: 'consulta' };

if (typeof window !== 'undefined') {
  window.tickets = tickets;
  window.ordenes = ordenes;
  window.usuarios = usuarios;
  window.currentSession = currentSession;
}

// Helpers compartidos de escapeHTML y Juntas
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window !== 'undefined') window.escapeHTML = escapeHTML;

function calcularDiasJunta(fechaStr) {
  if (!fechaStr) return 0;
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((new Date() - d) / (1000 * 60 * 60 * 24)));
  } catch(e) { return 0; }
}
if (typeof window !== 'undefined') window.calcularDiasJunta = calcularDiasJunta;

function formatearTiempoRelativoJunta(dias, fechaStr) {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer (1 día)';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return `Hace ${dias} días (1 sem)`;
  if (dias < 30) return `Hace ${dias} días (${Math.floor(dias/7)} sem)`;
  return `Hace ${dias} días (${Math.floor(dias/30)} meses)`;
}
if (typeof window !== 'undefined') window.formatearTiempoRelativoJunta = formatearTiempoRelativoJunta;

function normalizarTextoJunta(str) {
  return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
if (typeof window !== 'undefined') window.normalizarTextoJunta = normalizarTextoJunta;

function unificarNombreUsuario(rawNombre) {
  if (typeof window !== 'undefined' && typeof window._unificarNombreUsuarioBase === 'function') {
    return window._unificarNombreUsuarioBase(rawNombre);
  }
  return String(rawNombre || 'Sin Asignar').trim();
}
if (typeof window !== 'undefined') window.unificarNombreUsuario = unificarNombreUsuario;

function obtenerInfoRolUsuario(nombre) {
  if (typeof window !== 'undefined' && typeof window._obtenerInfoRolUsuarioBase === 'function') {
    return window._obtenerInfoRolUsuarioBase(nombre);
  }
  return { rol: 'tecnico', label: 'Técnico', color: '#10b981', icon: 'wrench' };
}
if (typeof window !== 'undefined') window.obtenerInfoRolUsuario = obtenerInfoRolUsuario;

function extraerListaResponsables(raw) {
  if (!raw) return ['Sin Asignar'];
  const parts = String(raw).trim().split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['Sin Asignar'];
}
if (typeof window !== 'undefined') window.extraerListaResponsables = extraerListaResponsables;

// Clara Mock Transactions
let defaultClaraMockTxs = [
  { id: 'tx_clara_1', fecha: '2026-05-22', merchant: 'GASOLINERIA ES 08996', monto: 1174.79, cardLast4: '9112', usuario: 'Victor Gonzalez Zamora', categoria: 'Combustibles' },
  { id: 'tx_clara_2', fecha: '2026-05-22', merchant: 'GALERIAS IXTAPALUCA', monto: 95.01, cardLast4: '5513', usuario: 'Roque Falcon Chavez', categoria: 'Venta Minorista' },
  { id: 'tx_clara_3', fecha: '2026-05-22', merchant: 'UBER RIDE', monto: 68.95, cardLast4: '1130', usuario: 'Octavio Rivero', categoria: 'Transporte' },
  { id: 'tx_clara_4', fecha: '2026-05-22', merchant: 'PASE PEDREGAL S JEROCR', monto: 12.91, cardLast4: '9112', usuario: 'Victor Gonzalez Zamora', categoria: 'Transporte' },
  { id: 'tx_clara_5', fecha: '2026-05-21', merchant: 'PPROMEX*LINKEDIN', monto: 2194.99, cardLast4: '1130', usuario: 'Octavio Rivero', categoria: 'Servicios Profesionales' },
  { id: 'tx_clara_6', fecha: '2026-05-21', merchant: 'OFFICE DEPOT MIYANA', monto: 280.00, cardLast4: '9112', usuario: 'Victor Gonzalez Zamora', categoria: 'Venta Minorista' }
];

let claraMockTxs = safeGetJSON('sapi_clara_mock_txs', defaultClaraMockTxs);
if (claraMockTxs.length < 6 || !localStorage.getItem('sapi_clara_mock_txs')) {
  claraMockTxs = defaultClaraMockTxs;
  localStorage.setItem('sapi_clara_mock_txs', JSON.stringify(claraMockTxs));
}

// Shims for data migration and sync routines (implemented in app_migrations.js)
if (typeof window !== 'undefined') {
  if (!window.migrarOrdenesExistentesMaquinaria) {
    window.migrarOrdenesExistentesMaquinaria = function() {
      if (window.AppMigrations && typeof window.AppMigrations.migrarOrdenesExistentesMaquinaria === 'function') {
        return window.AppMigrations.migrarOrdenesExistentesMaquinaria();
      }
    };
  }
  if (!window.migrarUbicacionesMaquinariaDesdeTickets) {
    window.migrarUbicacionesMaquinariaDesdeTickets = function() {
      if (window.AppMigrations && typeof window.AppMigrations.migrarUbicacionesMaquinariaDesdeTickets === 'function') {
        return window.AppMigrations.migrarUbicacionesMaquinariaDesdeTickets();
      }
    };
  }
  if (!window.recuperarMaquinariaDesdeTickets) {
    window.recuperarMaquinariaDesdeTickets = function() {
      if (window.AppMigrations && typeof window.AppMigrations.recuperarMaquinariaDesdeTickets === 'function') {
        return window.AppMigrations.recuperarMaquinariaDesdeTickets();
      }
    };
  }
  if (!window.reintentarSincronizacionGastosLocales) {
    window.reintentarSincronizacionGastosLocales = function() {
      if (window.AppMigrations && typeof window.AppMigrations.reintentarSincronizacionGastosLocales === 'function') {
        return window.AppMigrations.reintentarSincronizacionGastosLocales();
      }
    };
  }
}

// Sincronización con Supabase (escuchar cuando los datos bajen a localStorage)
window.addEventListener('supabase_datos_cargados', async () => {
  try {
    console.log('[App] Refrescando configuración, catálogos y re-renderizando UI desde Supabase...');
    
    ordenes = safeGetJSON('sapi_ordenes', []);
    tickets = safeGetJSON('sapi_tickets', []);
    clientesDb = safeGetJSON('sapi_clientes_db', []);
    refaccionesDb = await window.loadRefaccionesLocal();
    window.refaccionesDb = refaccionesDb;
    maquinariaDb = safeGetJSON('sapi_maquinaria_db', []);
    sitiosDb = safeGetJSON('sapi_sitios_db', []);
    tecnicosDb = safeGetJSON('sapi_tecnicos_db', []);
    gastos = safeGetJSON('sapi_gastos', []);
    levantamientos = safeGetJSON('sapi_levantamientos', []);
    ideasFallasDb = safeGetJSON('sapi_ideas_fallas', []);
    window.ideasFallasDb = ideasFallasDb;
    claraMockTxs = safeGetJSON('sapi_clara_mock_txs', claraMockTxs);

    usuarios = ensureBackdoorUsersFallback(safeGetJSON('eurorep_usuarios', []));
    configData = safeGetJSON('eurorep_config', {});
    window.configData = configData;
    if (typeof window !== 'undefined') {
      window.tickets = tickets;
      window.ordenes = ordenes;
      window.usuarios = usuarios;
    }
    cargarRolesDesdeStorage();

    // Reparar y preservar de inmediato asignaciones, clientes y equipos
    if (typeof window.sanitizarAsignacionesTickets === 'function') {
      try { window.sanitizarAsignacionesTickets(); } catch (eSan) { console.warn('[App] Error al sanitizar tickets:', eSan); }
    }

    // Ejecutar migraciones heredadas solo una vez por sesión y solo para administradores
    // Esto previene bucles infinitos de escritura y consultas redundantes en clientes no-admin
    const session = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
    const isAdmin = ['superadmin', 'admin'].includes(session.viewMode || session.rol);
    
    const hasSessionStorage = typeof sessionStorage !== 'undefined';
    if (isAdmin) {
      if (!hasSessionStorage || !sessionStorage.getItem('eurorep_migrations_executed')) {
        if (hasSessionStorage) sessionStorage.setItem('eurorep_migrations_executed', 'true');
        console.log('[App] Iniciando migraciones heredadas únicas de la sesión para administrador...');
        window.migrarOrdenesExistentesMaquinaria();
        if (typeof window.migrarUbicacionesMaquinariaDesdeTickets === 'function') {
          window.migrarUbicacionesMaquinariaDesdeTickets();
        }
        if (typeof window.recuperarMaquinariaDesdeTickets === 'function') {
          window.recuperarMaquinariaDesdeTickets();
        }
      }
      
      if (!hasSessionStorage || !sessionStorage.getItem('eurorep_ref_tickets_migrated_v9')) {
        if (hasSessionStorage) sessionStorage.setItem('eurorep_ref_tickets_migrated_v9', 'true');
        
        let modifiedAny = false;
        tickets = tickets.map(t => {
          if (t && t.folio && t.folio.endsWith('-A')) {
            const originalFolio = t.folio.replace('-A', '');
            const parentTicket = tickets.find(x => x.folio === originalFolio);
            let assocOrder = null;
            if (parentTicket) {
              assocOrder = ordenes.find(o => o.soporte === parentTicket.id);
            }
            if (!assocOrder) {
              let cleanOrdFolio = originalFolio;
              if (cleanOrdFolio.startsWith('[PRUEBA] ')) cleanOrdFolio = cleanOrdFolio.replace('[PRUEBA] ', '');
              if (cleanOrdFolio.startsWith('[TEST] ')) cleanOrdFolio = cleanOrdFolio.replace('[TEST] ', '');
              if (cleanOrdFolio.startsWith('TKT-')) cleanOrdFolio = cleanOrdFolio.replace('TKT-', '');
              cleanOrdFolio = cleanOrdFolio.trim();
              assocOrder = ordenes.find(o => {
                let ofol = o.folio || '';
                if (ofol.startsWith('[PRUEBA] ')) ofol = ofol.replace('[PRUEBA] ', '');
                if (ofol.startsWith('[TEST] ')) ofol = ofol.replace('[TEST] ', '');
                return ofol.trim() === cleanOrdFolio;
              });
            }
            
            if (assocOrder && assocOrder.folio) {
              const newAsunto = `Refacciones para ${assocOrder.folio}`;
              if (t.asunto !== newAsunto) {
                t.asunto = newAsunto;
                modifiedAny = true;
                if (window.supabaseClient) {
                  window.pushToSupabase('tickets', t).catch(err => {
                    console.error("[Migration v9] Error syncing ticket:", err);
                  });
                }
              }
            }
          }
          return t;
        });
        
        if (modifiedAny) {
          try {
            safeSetJSON('sapi_tickets', tickets);
          } catch(e) {}
          if (typeof renderTickets === 'function') {
            renderTickets();
            renderTickets('dash-tickets');
          }
        }

        if (typeof window.generarTicketsRefaccionesFaltantes === 'function') {
          await window.generarTicketsRefaccionesFaltantes();
        }
      }
    }

    // Auto-sincronizar cualquier gasto local huérfano (no sincronizado en la base de datos)
    window.reintentarSincronizacionGastosLocales();

    // Si estamos en la vista de configuración, actualizar los campos
    if (document.getElementById('view-config')?.classList.contains('active')) {
      if (typeof cargarConfig === 'function') cargarConfig();
    }
    
    // Re-render UI
    actualizarFiltrosPersonal();
    renderTabla();
    renderTabla('servicios');
    
    if (typeof renderClientes === 'function') renderClientes();
    if (typeof renderUsuariosList === 'function') renderUsuariosList();
    if (typeof renderStats === 'function') renderStats();
    
    if (typeof renderTickets === 'function') {
      renderTickets();
      renderTickets('dash-tickets');
    }
    if (typeof updateTicketBadge === 'function') updateTicketBadge(); updateOrdenesBadge();
    if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
    if (typeof window.updateNotificationBell === 'function') window.updateNotificationBell();
    
    if (typeof renderMaquinaria === 'function' && document.getElementById('view-maquinaria')?.classList.contains('active')) {
      renderMaquinaria();
    }
    if (typeof renderSitios === 'function' && document.getElementById('view-sitios')?.classList.contains('active')) {
      renderSitios();
    }
    if (document.getElementById('view-refacciones')?.classList.contains('active')) {
      if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
      else if (typeof renderRefacciones === 'function') renderRefacciones();
      if (typeof window.renderRefaccionesPendientes === 'function') window.renderRefaccionesPendientes();
      else if (typeof renderRefaccionesPendientes === 'function') renderRefaccionesPendientes();
    }
    if (typeof renderGastos === 'function' && document.getElementById('view-gastos')?.classList.contains('active')) {
      renderGastos();
      if (typeof renderClaraCards === 'function') renderClaraCards();
    }
    if (typeof renderCalendario === 'function' && document.getElementById('view-calendario')?.classList.contains('active')) {
      renderCalendario();
    }
    if (typeof renderLevantamientos === 'function' && document.getElementById('view-levantamientos')?.classList.contains('active')) {
      renderLevantamientos();
    }
    if (typeof renderRentas === 'function' && document.getElementById('view-rentas')?.classList.contains('active')) {
      renderRentas();
    }
    if (typeof renderChatSoporteEmpresa === 'function' && document.getElementById('view-chat-soporte')?.classList.contains('active')) {
      renderChatSoporteEmpresa();
    }
    if (document.getElementById('view-preferencias')?.classList.contains('active')) {
      if (typeof renderServiciosProgramadosTecnico === 'function') renderServiciosProgramadosTecnico();
      if (typeof renderIdeasFallas === 'function') renderIdeasFallas();
      if (typeof window.renderManualesPorRol === 'function') window.renderManualesPorRol();
    }
    
    // Re-aplicar rol para asegurar que el role-switcher se muestre si el usuario recién se descargó
    if (currentSession && currentSession.viewMode) {
      if (typeof applyRole === 'function') applyRole(currentSession.viewMode);
    }

    // Calcular y reportar uso de almacenamiento local en megabytes
    try {
      let lsBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        let val = localStorage.getItem(key) || '';
        lsBytes += (key.length + val.length) * 2; // UTF-16
      }
      let idbBytes = 0;
      if (window.localStorageCache) {
        for (let key in window.localStorageCache) {
          if (window.localStorageCache.hasOwnProperty(key)) {
            let val = window.localStorageCache[key] || '';
            idbBytes += (key.length + val.length) * 2;
          }
        }
      }
      console.log(`[Storage] LocalStorage real: ${(lsBytes / 1024 / 1024).toFixed(3)} MB`);
      console.log(`[Storage] IndexedDB (Puente): ${(idbBytes / 1024 / 1024).toFixed(3)} MB`);
      console.log(`[Storage] Total ocupado: ${((lsBytes + idbBytes) / 1024 / 1024).toFixed(3)} MB`);
    } catch (eStorage) {
      console.warn('[Storage] Error al calcular espacio ocupado:', eStorage);
    }
  } catch (err) {
    console.error('[App] Error en listener supabase_datos_cargados:', err);
    if (window.trackTelemetryEvent) {
      try {
        window.trackTelemetryEvent('Diag: Listener Crash', {
          message: err.message,
          stack: err.stack
        });
      } catch (e) {}
    }
  }
});
let editandoId = null;
let editandoTicketId = null;
let ticketFiltroActivo = 'todos';

// ==========================================
// UTILIDADES GLOBALES
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
  const container = document.getElementById('notificaciones-container') || (() => {
    const el = document.createElement('div');
    el.id = 'notificaciones-container';
    el.style = 'position:fixed; bottom:20px; right:20px; z-index:999999; display:flex; flex-direction:column; gap:10px;';
    document.body.appendChild(el);
    return el;
  })();
  
  const toast = document.createElement('div');
  const bgColor = tipo === 'success' ? '#10b981' : (tipo === 'error' ? '#ef4444' : '#3b82f6');
  toast.style = `background: ${bgColor}; color: white; padding: 12px 20px; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: system-ui, sans-serif; font-size: 14px; opacity: 0; transform: translateY(20px); transition: all 0.3s ease;`;
  toast.textContent = mensaje;
  
  container.appendChild(toast);
  
  // Animar entrada
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  // Remover después de 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// MÓDULO DE INTEGRACIÓN SAP (CATÁLOGOS Y API)
// Extraído modularmente a sap_sync.js / src/modules/sap_sync.js
// ============================================================

// ==========================================


const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const MARCAS_OFICIALES = ['Fiori', 'Rubble Master', 'Hyundai', 'CIFA', 'SIMEM', 'Casa Grande'];

function getLogoMarca(marca) {
  if (!marca) return null;
  const m = marca.toLowerCase().trim();
  if (m.includes('fiori') || m.includes('db460') || m.includes('db 460')) return 'logo_fiori.png?v=2';
  if (m.includes('rubble') || m === 'rm' || m === 'rbm' || m.startsWith('rm-') || m.startsWith('rm ') || m.includes('rubblemaster') || m.startsWith('rm') || m.startsWith('ms')) return 'logo_rublemaster.svg?v=2';
  if (m.includes('hyundai') || m.startsWith('hx') || m.startsWith('hl')) return 'logo_hyundai.png?v=2';
  if (m.includes('cifa')) return 'logo_cifa.png?v=1';
  if (m.includes('simem')) return 'logo_simem.png?v=1';
  if (m.includes('casa grande') || m.includes('casagrande') || m.startsWith('b125') || m.startsWith('b250')) return 'logo_casagrande.png?v=1';
  return null;
}

// Overrides de tamaño por marca (para logos con distinto aspect ratio)
function getLogoStyle(marca) {
  if (!marca) return 'width:85px; height:32px; object-fit:contain; object-position:left center; margin-right:8px;';
  const m = marca.toLowerCase().trim();
  if (m.includes('casa grande') || m.includes('casagrande')) {
    return 'width:160px; height:50px; object-fit:contain; object-position:left center; margin-right:8px;';
  }
  return 'width:85px; height:32px; object-fit:contain; object-position:left center; margin-right:8px;';
}

// ===== INIT =====
// ===== ROLES SYSTEM =====
let ROLES = {
  superadmin: {
    label: 'Super Administrador',
    color: '#E8820C',
    views: ['dashboard','servicios','rentas','envios','calendario','levantamientos','tickets','clientes','maquinaria','refacciones','tecnicos','sitios','config','preferencias','gastos','telemetry','chat-soporte'],
    canSwitchRoles: true,
  },
  admin: {
    label: 'Administrador',
    color: '#4f8ef7',
    views: ['dashboard','servicios','rentas','envios','calendario','levantamientos','tickets','clientes','maquinaria','refacciones','tecnicos','sitios','config','preferencias','gastos','chat-soporte'],
  },
  supervisor: {
    label: 'Supervisor',
    color: '#eab308',
    views: ['dashboard','servicios','rentas','envios','calendario','levantamientos','tickets','clientes','maquinaria','refacciones','tecnicos','preferencias','gastos','chat-soporte'],
  },
  tecnico: {
    label: 'Técnico / Instalador',
    color: '#10b981',
    views: ['dashboard','servicios','rentas','envios','calendario','levantamientos','tickets','preferencias','gastos'],
  },
  empresa: {
    label: 'Empresa / Cliente',
    color: '#8b5cf6',
    views: ['dashboard','tickets','rentas','maquinaria','sitios','preferencias'],
  },
  consulta: {
    label: 'Consulta',
    color: '#64748b',
    views: ['dashboard','servicios','rentas','envios','calendario','tickets','maquinaria','preferencias'],
  },
};

const ROLES_LABELS = {
  dashboard: 'Dashboard', servicios: 'Órdenes de Servicio', rentas: 'Rentas de Maquinaria', envios: 'Envíos y Guías de Entrega', calendario: 'Calendario',
  tickets: 'Tickets', levantamientos: 'Levantamientos', clientes: 'Clientes', maquinaria: 'Maquinaria', refacciones: 'Refacciones',
  sitios: 'Mis Sitios', tecnicos: 'Técnicos', config: 'Configuración',
  preferencias: 'Preferencias', gastos: 'Control de Gastos', telemetry: 'Monitoreo Telemetría',
  'chat-soporte': 'Chat de Soporte'
};

if (typeof window !== 'undefined') {
  window.ROLES = ROLES;
  window.ROLES_LABELS = ROLES_LABELS;
}

function cargarRolesDesdeStorage() {
  const savedData = safeGetJSON('sapi_roles_config', null);
  let savedRoles = null;
  let isMigrated = false;

  if (savedData) {
    if (savedData.migrated_v2 && savedData.roles) {
      savedRoles = savedData.roles;
      isMigrated = true;
    } else {
      savedRoles = savedData;
      isMigrated = false;
    }
  }

  if (savedRoles) {
    for (const r in savedRoles) {
      if (ROLES[r] && savedRoles[r] && Array.isArray(savedRoles[r].views)) {
        ROLES[r].views = savedRoles[r].views;
      }
    }
  }

  // Garantizar siempre la protección del rol superadmin para evitar bloqueos de la vista de Configuración
  let configChanged = false;
  if (ROLES.superadmin && Array.isArray(ROLES.superadmin.views)) {
    if (!ROLES.superadmin.views.includes('config')) {
      console.log('[Roles] Previniendo bloqueo: Asegurando vista de Configuración para el rol superadmin.');
      ROLES.superadmin.views.push('config');
      configChanged = true;
    }
  }

  // Garantizar vista de envíos para los roles autorizados tras la actualización
  const rolesConEnvios = ['superadmin', 'admin', 'supervisor', 'tecnico', 'consulta'];
  rolesConEnvios.forEach(rol => {
    if (ROLES[rol] && Array.isArray(ROLES[rol].views)) {
      if (!ROLES[rol].views.includes('envios')) {
        ROLES[rol].views.push('envios');
        configChanged = true;
      }
    }
  });

  // Garantizar vista de levantamientos para los roles principales tras la actualización
  const rolesConLevantamientos = ['superadmin', 'admin', 'supervisor', 'tecnico'];
  rolesConLevantamientos.forEach(rol => {
    if (ROLES[rol] && Array.isArray(ROLES[rol].views)) {
      if (!ROLES[rol].views.includes('levantamientos')) {
        ROLES[rol].views.push('levantamientos');
        configChanged = true;
      }
    }
  });

  // Garantizar vista de chat-soporte para los roles principales tras la actualización
  const rolesConChatSoporte = ['superadmin', 'admin', 'supervisor'];
  rolesConChatSoporte.forEach(rol => {
    if (ROLES[rol] && Array.isArray(ROLES[rol].views)) {
      if (!ROLES[rol].views.includes('chat-soporte')) {
        ROLES[rol].views.push('chat-soporte');
        configChanged = true;
      }
    }
  });

  // Garantizar vista de rentas para los roles autorizados tras la actualización
  const rolesConRentas = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];
  rolesConRentas.forEach(rol => {
    if (ROLES[rol] && Array.isArray(ROLES[rol].views)) {
      if (!ROLES[rol].views.includes('rentas')) {
        ROLES[rol].views.push('rentas');
        configChanged = true;
      }
    }
  });

  if (configChanged) {
    const configToSave = {
      roles: ROLES,
      migrated_v2: true
    };
    localStorage.setItem('sapi_roles_config', JSON.stringify(configToSave));
    if (window.pushToSupabase) {
      window.pushToSupabase('roles', configToSave);
    }
  }
  
  // Garantizar siempre la inyección de vistas críticas por defecto si faltan en la configuración cargada
  // Solo se realiza si no se ha migrado a v2 (legacy) para no sobreescribir la configuración del usuario
  if (!isMigrated) {
    for (const r in ROLES) {
      if (ROLES[r] && Array.isArray(ROLES[r].views)) {
        if (!ROLES[r].views.includes('rentas') && ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'].includes(r)) {
          ROLES[r].views.push('rentas');
        }
        if (!ROLES[r].views.includes('envios') && ['superadmin', 'admin', 'supervisor', 'tecnico', 'consulta'].includes(r)) {
          ROLES[r].views.push('envios');
        }
        if (!ROLES[r].views.includes('calendario') && ['superadmin', 'admin', 'supervisor', 'tecnico', 'consulta'].includes(r)) {
          ROLES[r].views.push('calendario');
        }
        if (!ROLES[r].views.includes('gastos') && ['superadmin', 'admin', 'supervisor', 'tecnico'].includes(r)) {
          ROLES[r].views.push('gastos');
        }
        if (!ROLES[r].views.includes('telemetry') && r === 'superadmin') {
          ROLES[r].views.push('telemetry');
        }
      }
    }
    
    // Migrar y guardar inmediatamente la versión persistente v2
    const configToSave = {
      roles: ROLES,
      migrated_v2: true
    };
    localStorage.setItem('sapi_roles_config', JSON.stringify(configToSave));
    if (savedData && window.pushToSupabase) {
      window.pushToSupabase('roles', configToSave);
    }
  }
}
window.cargarRolesDesdeStorage = cargarRolesDesdeStorage;
window.applyRole = applyRole;
cargarRolesDesdeStorage();

// ===== LOGIN STATE =====
window.iniciarSesionSubmit = iniciarSesionSubmit;
async function iniciarSesionSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  try {
    let inputEmail = document.getElementById('login-email').value.trim();
    if (inputEmail && !inputEmail.includes('@')) {
      inputEmail = inputEmail.replace(/\s+/g, '') + '@eurorep.mx';
    }
    const inputPass = document.getElementById('login-password').value;
    

    // Nota: acceso de desarrollo eliminado de producción por seguridad.

    if (!inputEmail || !inputPass) {
      errEl.textContent = 'Ingresa tu correo y contraseña.';
      errEl.style.color = 'var(--red)';
      return;
    }

    errEl.textContent = 'Iniciando sesión...';
    errEl.style.color = 'var(--text-secondary)';

    if (!window.supabaseClient) {
      errEl.textContent = 'Error: No hay conexión con la base de datos.';
      errEl.style.color = 'var(--red)';
      return;
    }

    let data, error;
    try {
      const res = await window.supabaseClient.auth.signInWithPassword({
        email: inputEmail,
        password: inputPass
      });
      data = res.data;
      error = res.error;
    } catch (fetchErr) {
      errEl.textContent = 'Error de conexión con el servidor. Por favor reintenta en unos momentos.';
      errEl.style.color = 'var(--red)';
      return;
    }

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Invalid login')) {
        errEl.textContent = 'Correo o contraseña incorrectos.';
      } else if (msg.includes('Failed to fetch') || msg.includes('CORS') || error.status === 522) {
        errEl.textContent = 'El servicio de autenticación no respondió a tiempo. Reintenta en unos momentos.';
      } else {
        errEl.textContent = msg;
      }
      errEl.style.color = 'var(--red)';
      return;
    }

    // Ahora buscamos el rol en la tabla oficial del trigger
    const resRoles = await window.supabaseClient
      .from('user_roles')
      .select('rol, activo, nombre, empresa')
      .eq('id', data.user.id)
      .single();
      
    const roleData = resRoles.data;
    const roleError = resRoles.error;

    if (roleError || !roleData) {
      errEl.textContent = 'Usuario sin rol asignado en la base de datos. Detalle: ' + (roleError ? roleError.message : 'No data');
      errEl.style.color = 'var(--red)';
      await window.supabaseClient.auth.signOut();
      return;
    }

    if (roleData.activo === false) {
      errEl.textContent = 'Tu cuenta está pendiente de aprobación por un Administrador.';
      errEl.style.color = 'var(--text-secondary)';
      await window.supabaseClient.auth.signOut();
      return;
    }

    errEl.textContent = '';
    currentSession = { userId: data.user.id, viewMode: roleData.rol, nombre: roleData.nombre, empresa: roleData.empresa, realUserId: data.user.id, realRol: roleData.rol };
    localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
    window.trackTelemetryEvent('Inicio de Sesión', { metodo: 'Contraseña/Database' });
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    entrarApp({ id: data.user.id, rol: roleData.rol, nombre: roleData.nombre, empresa: roleData.empresa });
  } catch (err) {
    console.error("Login exception:", err);
    errEl.textContent = "Error fatal: " + err.message;
    errEl.style.color = "var(--red)";
  }
}

function entrarApp(user) {
  if (user && (user.rol === 'empresa' || user.rol === 'cliente' || user.rol === 'cliente-consultor')) {
    console.log('[Auth] Redirigiendo cliente al Portal de Clientes (cliente)...');
    window.location.href = 'cliente';
    return;
  }
  try {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.classList.add('hidden');
    const appWrapper = document.getElementById('app-wrapper');
    if (appWrapper) appWrapper.classList.add('visible');
    applyRole(user.rol);
  } catch (err) {
    console.error('Error during app layout transition:', err);
  }

  // Activar canal Realtime optimizado una vez logueado
  if (window.setupRealtime) {
    window.setupRealtime();
  }
  
  if (window.cargarDatosDeSupabase) {
     // Mostrar notificacion de carga al usuario
     const btnLogin = document.querySelector('.btn-primary[type="submit"]');
     if (btnLogin) btnLogin.innerHTML = '<i data-lucide="loader" class="spin"></i> Sincronizando...';
     
     window.cargarDatosDeSupabase().then(() => {
        try { renderUsuariosList(); } catch (e) { console.error('Error rendering user list:', e); }
        try { renderTabla(); } catch (e) { console.error('Error rendering table:', e); }
        try { renderTabla('servicios'); } catch (e) { console.error('Error rendering services table:', e); }
        if (typeof renderTickets === 'function') {
           try { renderTickets(); } catch (e) { console.error('Error rendering tickets:', e); }
           try { renderTickets('dash-tickets'); } catch (e) { console.error('Error rendering dash tickets:', e); }
        }
        try { renderStats(); } catch (e) { console.error('Error rendering stats:', e); }
        if (btnLogin) btnLogin.innerHTML = '<i data-lucide="log-in" class="btn-icon"></i> Iniciar Sesión';
     }).catch(err => {
        console.error('Error in cargarDatosDeSupabase:', err);
        if (btnLogin) btnLogin.innerHTML = '<i data-lucide="log-in" class="btn-icon"></i> Iniciar Sesión';
     });
  } else {
     try { renderUsuariosList(); } catch (e) { console.error('Error rendering user list:', e); }
     try { renderTabla(); } catch (e) { console.error('Error rendering table:', e); }
     try { renderTabla('servicios'); } catch (e) { console.error('Error rendering services table:', e); }
     if (typeof renderTickets === 'function') {
        try { renderTickets(); } catch (e) { console.error('Error rendering tickets:', e); }
        try { renderTickets('dash-tickets'); } catch (e) { console.error('Error rendering dash tickets:', e); }
     }
     try { renderStats(); } catch (e) { console.error('Error rendering stats:', e); }
  }
  
  try {
    lucide.createIcons();
  } catch (err) {
    console.error('Error rendering icons:', err);
  }
}

function volverSeleccion() {
  document.getElementById('login-step-crear').style.display = 'none';
  document.getElementById('login-step-form').style.display = 'block';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

function cerrarSesion() {
  cerrarSesionModal();
  localStorage.removeItem('eurorep_session');
  currentSession = null; // Limpiar sesión completamente

  if (window.supabaseRealtimeChannel && window.supabaseClient) {
    try {
      window.supabaseClient.removeChannel(window.supabaseRealtimeChannel);
      window.supabaseRealtimeChannel = null;
    } catch (e) {}
  }
  
  if (window.supabaseClient) {
    window.supabaseClient.auth.signOut().then(() => {
      document.getElementById('app-wrapper').classList.remove('visible');
      document.getElementById('login-screen').classList.remove('hidden');
      volverSeleccion();
    }).catch(() => {
      // Si falla signOut, forzar recarga limpia
      document.getElementById('app-wrapper').classList.remove('visible');
      document.getElementById('login-screen').classList.remove('hidden');
      volverSeleccion();
    });
  } else {
    document.getElementById('app-wrapper').classList.remove('visible');
    document.getElementById('login-screen').classList.remove('hidden');
    volverSeleccion();
  }
}

// ===== MOBILE SIDEBAR TOGGLE =====
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function loginCrearUsuario() {
  document.getElementById('login-step-form').style.display = 'none';
  document.getElementById('login-step-crear').style.display = 'block';
  document.getElementById('lc-error').textContent = '';
  lucide.createIcons();
}

async function confirmarCrearUsuario() {
  const nombre = document.getElementById('lc-nombre').value.trim();
  let email = document.getElementById('lc-email').value.trim();
  if (email && !email.includes('@')) {
    email = email.replace(/\s+/g, '') + '@eurorep.mx';
  }
  const pin = document.getElementById('lc-pin').value;
  const pin2 = document.getElementById('lc-pin2').value;
  const errEl = document.getElementById('lc-error');

  if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; return; }
  if (!email) { errEl.textContent = 'El correo es obligatorio.'; return; }
  if (!pin || pin.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  if (pin !== pin2) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }
  
  if (!window.supabaseClient) {
    errEl.textContent = 'Error: No hay conexión con la base de datos.';
    return;
  }
  
  errEl.textContent = 'Creando cuenta...';
  errEl.style.color = 'var(--text-secondary)';

  try {
    const { data, error } = await window.supabaseClient.auth.signUp({
      email: email,
      password: pin,
      options: {
        data: {
          nombre: nombre
        }
      }
    });

    if (error) {
      console.error('[SignUp] Error de Supabase:', error);
      let msg = error.message;
      if (!msg || msg === '{}' || typeof msg === 'object') {
        msg = error.error_description || error.code || 'El usuario ya existe, el teléfono ya está registrado o el servicio de registro está temporalmente cerrado.';
      }
      errEl.textContent = msg;
      errEl.style.color = 'var(--red)';
      return;
    }
    
    if (data?.user) {
      const inputEmailRaw = document.getElementById('lc-email').value.trim();
      const esCelularRaw = inputEmailRaw && !inputEmailRaw.includes('@');
      const telefonoLimpio = esCelularRaw ? inputEmailRaw.replace(/\s+/g, '') : '';

      // Asegurar que el registro de rol existe en user_roles en la nube con su celular inicial
      const { error: roleErr } = await window.supabaseClient.from('user_roles').insert({
        id: data.user.id,
        nombre: nombre,
        email: email,
        telefono: telefonoLimpio,
        rol: 'consulta',
        activo: false
      });
      if (roleErr) {
        console.warn('[SignUp] No se pudo asegurar el rol del usuario en user_roles:', roleErr.message);
      }
    }
    
    volverSeleccion();
    document.getElementById('login-error').textContent = 'Cuenta creada. Espera la aprobación de un Administrador.';
    document.getElementById('login-error').style.color = 'var(--text-secondary)';
  } catch (err) {
    console.error('[SignUp] Excepción al registrar usuario:', err);
    errEl.textContent = err.message || 'Error de red o conexión al registrar usuario.';
    errEl.style.color = 'var(--red)';
  }
}

// ===== // Banderas globales
let sidebarOpen = false;
let notificationCount = 0;
let userMenuOpen = false;
let dashboardChartInstance = null;
let currentPageClientes = 1;
const CLIENTES_PER_PAGE = 25;
let isSincronizandoSAP = false;

// Helpers: Inicializar fecha límite por defecto a +3 días
function inicializarApp() {
  // Sincronizar etiqueta de versión en el sidebar
  const verEl = document.getElementById('app-sidebar-version');
  if (verEl) {
    verEl.textContent = APP_VERSION;
  }
  const verElProfile = document.getElementById('app-profile-version');
  if (verElProfile) {
    verElProfile.textContent = APP_VERSION;
  }
  const loginVerEl = document.getElementById('login-app-version');
  if (loginVerEl) {
    loginVerEl.textContent = APP_VERSION;
  }

  // Cerrar popup de filtros al hacer click afuera
  try {
    document.addEventListener('click', (e) => {
      const container = document.getElementById('maq-filters-container');
      const popup = document.getElementById('maq-filters-popup');
      if (container && popup && popup.classList.contains('show-filters')) {
        if (!container.contains(e.target)) {
          popup.classList.remove('show-filters');
        }
      }
    });
  } catch (err) {
    console.error('Error setting up filter popup click listener:', err);
  }

  try {
    lucide.createIcons();
  } catch (err) {
    console.error('Error rendering Lucide icons:', err);
  }
  

  try {
    if (typeof window.actualizarAlertaRechazos === 'function') {
      window.actualizarAlertaRechazos();
    }
  } catch (err) {
    console.error('Error running rejections badge routine:', err);
  }
  
  // Theme check
  try {
    if (localStorage.getItem('eurorep_darkmode') === 'false') {
      document.body.classList.add('light-mode');
    }
  } catch (err) {
    console.error('Error applying theme:', err);
  }

  // Asegurarnos de que exista el superadmin y el técnico de pruebas
  try {
    const all = ensureBackdoorUsersFallback(safeGetJSON('eurorep_usuarios', []));
    localStorage.setItem('eurorep_usuarios', JSON.stringify(all));
  } catch (err) {
    console.error('Error ensuring backdoor users:', err);
  }

  // Check if there's a valid session via Supabase Auth or Local Backdoor
  try {
    const saved = safeGetJSON('eurorep_session', null);
    if (saved && saved.userId) {
       currentSession = saved;
       if (!currentSession.realUserId) {
         currentSession.realUserId = saved.userId;
       }
       if (!currentSession.realRol) {
         if (saved.userId === 'superadmin') {
           currentSession.realRol = 'superadmin';
         } else {
           const found = usuarios.find(u => u.id === saved.userId);
           currentSession.realRol = found ? found.rol : saved.viewMode;
         }
       }
       entrarApp({ id: saved.userId, rol: saved.viewMode, nombre: saved.nombre, empresa: saved.empresa });

       // Sincronizar y refrescar estado de sesión de Supabase en segundo plano
       if (window.supabaseClient) {
          if (saved.userId === 'superadmin' || saved.userId === 'tecnico_test') {
            console.log('[Auth] Usuario backdoor detectado. Iniciando descarga de base de datos en segundo plano...');
            if (window.cargarDatosDeSupabase) {
              window.cargarDatosDeSupabase().catch(console.error);
            }
          } else {
            window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                console.log('[Auth] Sesión de Supabase Auth validada/refrescada en segundo plano.');
                if (window.cargarDatosDeSupabase) {
                  window.cargarDatosDeSupabase().catch(console.error);
                }
              } else if (navigator.onLine) {
                console.warn('[Auth] Sesión de Supabase expirada. Redirigiendo a Login...');
                localStorage.removeItem('eurorep_session');
                window.location.reload();
              }
            }).catch(err => console.error('[Auth] Error al refrescar sesión de Supabase:', err));
          }
        }
    } else if (window.supabaseClient) {
       window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
          if (session) {
             window.supabaseClient.from('user_roles').select('rol, activo, nombre, empresa').eq('id', session.user.id).single().then(({data, error}) => {
                if (data && data.activo !== false) {
                   currentSession = { userId: session.user.id, viewMode: data.rol, nombre: data.nombre, empresa: data.empresa, realUserId: session.user.id, realRol: data.rol };
                   localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
                   entrarApp({ id: session.user.id, rol: data.rol, nombre: data.nombre, empresa: data.empresa });
                }
              }).catch(err => console.error('Error getting user role:', err));
            }
         }).catch(err => console.error('Error getting session:', err));
    }
  } catch (err) {
    console.error('Error restoring session:', err);
  }

  try {
    initDiasPanels();
  } catch (err) {
    console.error('Error calling initDiasPanels:', err);
  }
  
  try {
    renderTabla();
  } catch (err) {
    console.error('Error calling renderTabla:', err);
  }
  
  try {
    renderStats();
  } catch (err) {
    console.error('Error calling renderStats:', err);
  }

  // Agregar botones de eliminar a los campos de mapeo por defecto
  try {
    document.querySelectorAll('.mapeo-tab-content .form-group').forEach(group => {
      if (group.querySelector('.map-label-edit') && !group.querySelector('.del-map-btn')) {
        group.style.position = 'relative';
        const btn = document.createElement('button');
        btn.className = 'del-map-btn';
        btn.innerHTML = '✕';
        btn.title = "Eliminar esta columna";
        btn.style = "position:absolute; right:0px; top:5px; background:none; border:none; color:var(--red); cursor:pointer; font-size:0.9rem; padding: 0.2rem;";
        btn.onclick = (e) => {
          e.preventDefault();
          group.remove();
        };
        group.appendChild(btn);
      }
    });
  } catch (err) {
    console.error('Error appending delete mapping buttons:', err);
  }
  
  try {
    renderTickets();
  } catch (err) {
    console.error('Error calling renderTickets:', err);
  }
  
  try {
    if (typeof window.renderRefacciones === 'function') {
      window.renderRefacciones();
    } else if (typeof renderRefacciones === 'function') {
      renderRefacciones();
    }
    if (typeof window.renderRefaccionesPendientes === 'function') {
      window.renderRefaccionesPendientes();
    } else if (typeof renderRefaccionesPendientes === 'function') {
      renderRefaccionesPendientes();
    }
  } catch (err) {
    console.error('Error calling renderRefacciones:', err);
  }
  
  try {
    updateTicketBadge(); updateOrdenesBadge();
  } catch (err) {
    console.error('Error calling updateTicketBadge:', err);
  }
  
  try {
    setupNav();
  } catch (err) {
    console.error('Error calling setupNav:', err);
  }
  
  try {
    cargarConfig();
  } catch (err) {
    console.error('Error calling cargarConfig:', err);
  }
  
  try {
    renderTecnicosConfig();
  } catch (err) {
    console.error('Error calling renderTecnicosConfig:', err);
  }
  
  try {
    renderUsuariosList();
  } catch (err) {
    console.error('Error calling renderUsuariosList:', err);
  }
}


usuarios = ensureBackdoorUsersFallback(safeGetJSON('eurorep_usuarios', []));
currentSession = safeGetJSON('eurorep_session', null) || { userId: '', viewMode: 'consulta' };
if (currentSession && currentSession.userId && !currentSession.realUserId) {
  currentSession.realUserId = currentSession.userId;
  if (currentSession.userId === 'superadmin') {
    currentSession.realRol = 'superadmin';
  } else {
    const found = usuarios.find(u => u.id === currentSession.userId);
    currentSession.realRol = found ? found.rol : currentSession.viewMode;
  }
}
// Sincronizar dinámicamente propiedades del window con variables locales de app.js para evitar que se desfasen
Object.defineProperty(window, 'usuarios', {
  get() { return usuarios; },
  set(val) { usuarios = val; },
  configurable: true
});
Object.defineProperty(window, 'currentSession', {
  get() { return currentSession; },
  set(val) { currentSession = val; },
  configurable: true
});
let editandoUserId = null;

// ===== SANDBOX / MODO PRUEBAS =====
function isTestData(item) {
  if (!item) return false;
  
  if (item.esPrueba === true || item.isTest === true || item.es_prueba === true) return true;
  
  try {
    let notesObj = null;
    if (typeof item.notas === 'string') {
      const trimmed = item.notas.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        notesObj = JSON.parse(trimmed);
      }
    } else {
      notesObj = item.notas;
    }
    if (notesObj && (notesObj.esPrueba === true || notesObj.isTest === true || notesObj.es_prueba === true)) {
      return true;
    }
  } catch (e) {}

  // Comprobar campos clave exclusivamente con etiquetas explícitas [PRUEBA] / [TEST] o prefijos reconocidos
  const fieldsToCheck = [
    item.folio,
    item.ordenFolio,
    item.ordenId,
    item.id,
    item.soporte,
    item.numero_orden
  ];
  for (const field of fieldsToCheck) {
    if (field && typeof field === 'string') {
      const upper = field.trim().toUpperCase();
      if (
        upper.includes('[PRUEBA]') || 
        upper.includes('[TEST]') || 
        upper.startsWith('OS-PRUEBA') || 
        upper.startsWith('TKT-PRUEBA') || 
        upper.startsWith('LEV-PRUEBA') ||
        upper.startsWith('REN-PRUEBA') ||
        upper.startsWith('TEST-') ||
        upper.startsWith('PRUEBA-') ||
        /^TKT-OS00\d+/i.test(upper) ||
        /^OS00\d+/i.test(upper)
      ) {
        return true;
      }
    }
  }

  // Título / asunto con etiqueta explícita de prueba
  if (item.asunto && typeof item.asunto === 'string') {
    const asUpper = item.asunto.trim().toUpperCase();
    if (asUpper.includes('[PRUEBA]') || asUpper.includes('[TEST]')) return true;
  }
  if (item.titulo && typeof item.titulo === 'string') {
    const titUpper = item.titulo.trim().toUpperCase();
    if (titUpper.includes('[PRUEBA]') || titUpper.includes('[TEST]')) return true;
  }

  // Cliente explícito de prueba
  if (item.cliente && typeof item.cliente === 'string') {
    const cliUpper = item.cliente.trim().toUpperCase();
    if (cliUpper.includes('[PRUEBA]') || cliUpper.includes('[TEST]') || cliUpper === 'CLIENTE PRUEBA' || cliUpper === 'CLIENTE DE PRUEBA' || cliUpper === 'TEST CLIENT') {
      return true;
    }
  }

  // Técnico explícito de prueba o evento asignado a técnico de prueba
  const tec = item.tecnicoNombre || item.tecnico || item.asignado_a || item.asignadoA;
  if (tec && typeof tec === 'string') {
    const tecClean = tec.trim().toLowerCase();
    if (
      tecClean === 'test' || 
      tecClean === 'prueba' || 
      tecClean.startsWith('test ') || 
      tecClean.endsWith(' test') || 
      tecClean.includes('técnico de prueba') || 
      tecClean.includes('tecnico de prueba') ||
      tecClean.includes('[prueba]') ||
      tecClean.includes('[test]')
    ) {
      return true;
    }
    if (typeof isTestUser === 'function' && isTestUser({ nombre: tec })) {
      return true;
    }
  }

  // Descripción o nota con etiqueta de prueba
  const descNota = (item.descripcion || item.nota || '').toString().toUpperCase();
  if (descNota.includes('[PRUEBA]') || descNota.includes('[TEST]')) {
    return true;
  }

  // Si es un ticket con orden vinculada de prueba
  if (item.ordenId && typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
    const assocOrd = ordenes.find(o => o && o.id === item.ordenId);
    if (assocOrd && (assocOrd.esPrueba === true || assocOrd.isTest === true || (assocOrd.folio && assocOrd.folio.toUpperCase().includes('PRUEBA')))) {
      return true;
    }
  }

  // Si es una orden con soporte vinculado de prueba
  if (item.soporte && typeof tickets !== 'undefined' && Array.isArray(tickets)) {
    const assocTkt = tickets.find(t => t && (t.id === item.soporte || t.folio === item.soporte));
    if (assocTkt && (assocTkt.esPrueba === true || assocTkt.isTest === true || (assocTkt.folio && assocTkt.folio.toUpperCase().includes('PRUEBA')))) {
      return true;
    }
  }
  
  return false;
}

function isTestUser(user) {
  if (typeof window.isTestUser === 'function' && window.isTestUser !== isTestUser) {
    return window.isTestUser(user);
  }
  if (!user) return false;
  const name = (typeof user === 'string' ? user : (user.nombre || user.name || '')).toLowerCase();
  const email = (typeof user === 'object' ? (user.email || user.correo || '') : '').toLowerCase();
  return name.includes('prueba') || name.includes('test') || email.includes('prueba') || email.includes('test');
}

function isTestModeActive() {
  try {
    const userList = (typeof usuarios !== 'undefined' && Array.isArray(usuarios))
      ? usuarios
      : ((typeof window !== 'undefined' && Array.isArray(window.usuarios)) ? window.usuarios : []);
    const sess = (typeof currentSession !== 'undefined' && currentSession) ? currentSession : (typeof window !== 'undefined' ? window.currentSession : null);
    
    if (sess && sess.userId && userList.length > 0) {
      const user = userList.find(u => u.id === sess.userId);
      if (user) {
        if (user.rol === 'superadmin') {
          return (typeof localStorage !== 'undefined') ? localStorage.getItem('eurorep_test_mode') === 'true' : false;
        }
        return typeof isTestUser === 'function' ? isTestUser(user) : false;
      }
    }
    if (sess && sess.userId) {
      if (sess.realRol === 'superadmin') {
        return (typeof localStorage !== 'undefined') ? localStorage.getItem('eurorep_test_mode') === 'true' : false;
      }
      return typeof isTestUser === 'function' ? isTestUser({ nombre: sess.nombre, email: sess.userId + '@temp.com' }) : false;
    }
  } catch (e) {
    console.warn('[isTestModeActive] Error evaluando modo prueba:', e);
  }
  return false;
}

function resolveTecnicoNombre(idOrName) {
  if (!idOrName) return '';
  const user = (typeof usuarios !== 'undefined' ? usuarios : []).find(u => u.id === idOrName) || 
               (typeof tecnicosDb !== 'undefined' ? tecnicosDb : []).find(t => t.id === idOrName);
  return user ? user.nombre : idOrName;
}

function getFilteredOrders() {
  const active = isTestModeActive();
  return ordenes.filter(o => isTestData(o) === active);
}

function getFilteredTickets() {
  const active = isTestModeActive();
  return tickets.filter(t => isTestData(t) === active && t.categoria !== 'Soporte General');
}

function isTestGasto(g) {
  if (!g) return false;
  if (g.esPrueba === true || g.isTest === true || g.id === 'gasto_seed_1') return true;
  if (g.claraTxId && g.claraTxId.startsWith('tx_clara_')) return true;
  return false;
}

function getFilteredGastos() {
  const active = isTestModeActive();
  return gastos.filter(g => isTestGasto(g) === active);
}

function getFilteredClaraTxs() {
  const active = isTestModeActive();
  if (active) {
    return defaultClaraMockTxs;
  } else {
    return claraMockTxs.filter(tx => !tx.id.startsWith('tx_clara_'));
  }
}

function toggleTestMode(isActive) {
  localStorage.setItem('eurorep_test_mode', isActive ? 'true' : 'false');
  actualizarVistaActual();
}

function actualizarVistaActual() {
  try { applyRole(currentSession.viewMode); } catch(e){}
  try { renderTabla(); } catch(e){}
  try { renderServiciosProgramadosTecnico(); } catch(e){}
  try { renderTabla('servicios'); } catch(e){}
  if (typeof renderTickets === 'function') {
    try { renderTickets(); } catch(e){}
    try { renderTickets('dash-tickets'); } catch(e){}
  }
  try { renderStats(); } catch(e){}
  try { renderDashboardV2(); } catch(e){}
  try { renderDashboardTecnicos(); } catch(e){}
  try { renderTecnicos(); } catch(e){}
  try { 
    updateTicketBadge(); 
    updateOrdenesBadge(); 
    if (typeof window.updateEnviosBadge === 'function') window.updateEnviosBadge(); 
    if (typeof window.actualizarBadgeLevantamientos === 'function') window.actualizarBadgeLevantamientos();
  } catch(e){}
  if (typeof window.renderEnvios === 'function') {
    try { window.renderEnvios(); } catch(e){}
  }
  if (typeof window.renderGastos === 'function') {
    try { window.renderGastos(); } catch(e){}
  }
  if (typeof window.renderClaraTxs === 'function') {
    try { window.renderClaraTxs(); } catch(e){}
  }
  if (typeof window.renderTelemetryDashboard === 'function') {
    try { window.renderTelemetryDashboard(); } catch(e){}
  }
  if (typeof renderIdeasFallas === 'function') {
    try { renderIdeasFallas(); } catch(e){}
  }
  if (typeof window.filtrarKitsServicio === 'function') {
    try { window.filtrarKitsServicio(); } catch(e){}
  }
  if (typeof window.renderRentas === 'function') {
    try { window.renderRentas(); } catch(e){}
  }
}

window.toggleTestMode = toggleTestMode;
window.isTestModeActive = isTestModeActive;
window.isTestUser = isTestUser;
window.getFilteredOrders = getFilteredOrders;
window.getFilteredTickets = getFilteredTickets;

function applyRole(rolKey) {
  try {
    const user = usuarios.find(u => u.id === currentSession.userId);
    const rol = ROLES[rolKey] || ROLES.superadmin;
    const navViews = rol.views;

    // Show/hide nav items
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      const v = item.dataset.view;
      item.style.display = navViews.includes(v) ? '' : 'none';
    });

    // If current active view is not allowed, redirect to first allowed
    const activeView = document.querySelector('.view.active');
    if (activeView) {
      const vid = activeView.id.replace('view-','');
      if (!navViews.includes(vid)) {
        const firstAllowed = navViews[0];
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + firstAllowed)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-view="${firstAllowed}"]`)?.classList.add('active');
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
          let label = ROLES_LABELS[firstAllowed] || firstAllowed;
          if (firstAllowed === 'preferencias' && window.innerWidth <= 768) {
            label = 'Perfil';
          }
          pageTitle.textContent = label;
        }
      }
    }

    // Show/hide role switcher
    const roleSwitcher = document.getElementById('role-switcher');
    if (roleSwitcher) roleSwitcher.style.display = (currentSession.realRol === 'superadmin') ? 'flex' : 'none';

    // Show Ideas y Fallas card in preferencias for all roles
    const cardIdeasFallas = document.getElementById('card-ideas-fallas');
    if (cardIdeasFallas) {
      cardIdeasFallas.style.display = 'block';
    }

    // Show/hide merge machinery button (only for superadmins)
    const btnMaqFusionar = document.getElementById('btn-maq-fusionar');
    if (btnMaqFusionar) {
      btnMaqFusionar.style.display = (currentSession.realRol === 'superadmin') ? 'flex' : 'none';
    }

    // Show/hide Kits de Servicio button (ONLY superadmin, admin, supervisor)
    const btnMaqKits = document.getElementById('btn-maq-kits-servicio');
    if (btnMaqKits) {
      const canViewKits = ['superadmin', 'admin', 'supervisor'].includes(rolKey);
      btnMaqKits.style.display = canViewKits ? 'inline-flex' : 'none';
    }

    // Show/hide weekly report button (ONLY superadmin or admin)
    const repSemBtn = document.getElementById('btn-reporte-semanal-tecnicos');
    if (repSemBtn) {
      const isAdmin = ['superadmin', 'admin'].includes(rolKey);
      repSemBtn.style.display = isAdmin ? 'flex' : 'none';
    }

    // Show/hide Automatizaciones y Plantillas subtab button (ONLY superadmin or admin)
    const btnSubtabAuto = document.getElementById('btn-subtab-automatizaciones');
    if (btnSubtabAuto) {
      const isAdmin = ['superadmin', 'admin'].includes(rolKey);
      btnSubtabAuto.style.display = isAdmin ? 'flex' : 'none';
    }

    // Sync role selector in modal if present
    const roleSelectModal = document.getElementById('role-select-modal');
    if (roleSelectModal) roleSelectModal.value = rolKey;

    // Show/hide Sandbox switch (ONLY superadmin or test users can access)
    const testModeContainer = document.getElementById('test-mode-container');
    if (testModeContainer) {
      const isSuperadmin = (currentSession.realRol === 'superadmin');
      const isTest = isTestUser(user);
      testModeContainer.style.display = (isSuperadmin || isTest) ? 'flex' : 'none';
      const checkbox = document.getElementById('test-mode-checkbox');
      if (checkbox) {
        if (isTest) {
          checkbox.checked = true;
          checkbox.disabled = true;
          checkbox.title = "Los usuarios de prueba están fijos en el Sandbox";
        } else {
          checkbox.checked = localStorage.getItem('eurorep_test_mode') === 'true';
          checkbox.disabled = false;
          checkbox.title = "";
        }
      }
    }

    // Mostrar botón de programar técnico en calendario solo a roles autorizados
    const btnProgramar = document.getElementById('btn-programar-tecnico');
    if (btnProgramar) {
      btnProgramar.style.display = ['superadmin', 'admin', 'supervisor'].includes(rolKey) ? 'flex' : 'none';
    }
    const btnActividad = document.getElementById('btn-registrar-actividad');
    if (btnActividad) {
      btnActividad.style.display = ['superadmin', 'admin', 'supervisor'].includes(rolKey) ? 'flex' : 'none';
    }

    // Ocultar pestaña de Técnicos en el Dashboard para empresas/clientes
    const btnDashTecnicos = document.getElementById('btn-dash-tecnicos');
    if (btnDashTecnicos) {
      btnDashTecnicos.style.display = ['empresa', 'cliente', 'cliente-consultor'].includes(rolKey) ? 'none' : 'inline-block';
    }

    // Ocultar campo y columna de Prioridad, Asignado y Comentarios Internos para empresas/clientes
    const isCliente = ['empresa', 'cliente', 'cliente-consultor'].includes(rolKey);
    document.querySelectorAll('.col-prioridad, .col-asignado, .col-comentario-interno').forEach(el => el.style.display = isCliente ? 'none' : '');
    const groupPrioridad = document.getElementById('group-t-prioridad');
    if (groupPrioridad) {
      groupPrioridad.style.display = isCliente ? 'none' : '';
    }

    // Update role mode buttons
    document.querySelectorAll('.role-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === rolKey);
    });

    // Update session badge
    const sessionName = user?.nombre || currentSession.nombre || 'Usuario';
    const sessionAvatar = document.getElementById('session-avatar');
    if (sessionAvatar) {
      sessionAvatar.textContent = sessionName[0].toUpperCase();
      sessionAvatar.style.background = ROLES[currentSession.viewMode]?.color || 'var(--accent)';
    }
    const sessionNameEl = document.getElementById('session-name');
    if (sessionNameEl) sessionNameEl.textContent = sessionName;
    
    const sessionRole = document.getElementById('session-role');
    if (sessionRole) {
      const isClientRole = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
      if (isClientRole && currentSession.empresa) {
        sessionRole.textContent = currentSession.empresa;
      } else {
        sessionRole.textContent = ROLES[currentSession.viewMode]?.label || '';
      }
    }

    // Rename Maquinaria text if Empresa
    const isEmpresa = ['empresa', 'cliente-consultor'].includes(rolKey);
    const navMaquinariaText = document.getElementById('nav-maquinaria-text');
    if (navMaquinariaText) navMaquinariaText.textContent = isEmpresa ? 'Mis máquinas' : 'Maquinaria';

    // Hide Clara importing/actions buttons for non-admins
    const isAdminOrSuper = ['superadmin', 'admin'].includes(rolKey);
    const btnImportarTarjetas = document.getElementById('btn-importar-tarjetas-excel');
    if (btnImportarTarjetas) {
      btnImportarTarjetas.style.setProperty('display', isAdminOrSuper ? 'inline-flex' : 'none', 'important');
    }
    const btnImportarClaraTxs = document.getElementById('btn-importar-clara-txs');
    if (btnImportarClaraTxs) {
      btnImportarClaraTxs.style.setProperty('display', isAdminOrSuper ? 'inline-flex' : 'none', 'important');
    }
    const btnSubirMovimientos = document.getElementById('btn-subir-movimientos-csv');
    if (btnSubirMovimientos) {
      btnSubirMovimientos.style.setProperty('display', isAdminOrSuper ? 'inline-flex' : 'none', 'important');
    }
    const btnRegistrarGasto = document.getElementById('btn-registrar-gasto');
    if (btnRegistrarGasto) {
      btnRegistrarGasto.style.display = isAdminOrSuper ? '' : 'none';
    }
    const isTecnico = rolKey === 'tecnico';
    const filterClaraUserWrapper = document.getElementById('filter-clara-user-wrapper');
    if (filterClaraUserWrapper) {
      filterClaraUserWrapper.style.display = isTecnico ? 'none' : 'flex';
    }

    if (typeof window.renderManualesPorRol === 'function') {
      window.renderManualesPorRol();
    }

    lucide.createIcons();
  } catch (err) {
    console.error('Error applying role:', err);
  }
}

function updateTopbarButtons(view, role) {
  const btnOrden = document.getElementById('btn-nueva-orden');
  const btnTicket = document.getElementById('btn-nuevo-ticket');
  const btnCliente = document.getElementById('btn-nuevo-cliente');
  const btnMaquina = document.getElementById('btn-agregar-maquina');
  const btnLevantamiento = document.getElementById('btn-nuevo-levantamiento');
  const btnRenta = document.getElementById('btn-nueva-renta');

  if (btnOrden) btnOrden.style.display = 'none';
  if (btnTicket) btnTicket.style.display = 'none';
  if (btnCliente) btnCliente.style.display = 'none';
  if (btnMaquina) btnMaquina.style.display = 'none';
  if (btnLevantamiento) btnLevantamiento.style.display = 'none';
  if (btnRenta) btnRenta.style.display = 'none';

  const allowedToCreateClientsAndMachines = ['superadmin', 'admin', 'supervisor'].includes(role);

  if (view === 'tickets') {
    if (btnTicket && !['consulta', 'tecnico'].includes(role)) btnTicket.style.display = '';
    if (typeof window.actualizarBadgeDepuradorTickets === 'function') window.actualizarBadgeDepuradorTickets();
  } else if (view === 'clientes') {
    if (btnCliente && allowedToCreateClientsAndMachines) btnCliente.style.display = '';
    const portalTab = document.getElementById('btn-tab-cli-portal');
    const isPortalActive = portalTab && portalTab.classList.contains('active');
    if (btnMaquina && allowedToCreateClientsAndMachines && !isPortalActive) {
      btnMaquina.style.display = '';
    } else if (btnMaquina) {
      btnMaquina.style.display = 'none';
    }
  } else if (view === 'servicios') {
    if (btnOrden && ['superadmin', 'admin', 'supervisor'].includes(role)) btnOrden.style.display = '';
    if (typeof window.actualizarBadgeDepuradorOrdenes === 'function') window.actualizarBadgeDepuradorOrdenes();
  } else if (view === 'levantamientos') {
    if (btnLevantamiento && ['superadmin', 'admin', 'supervisor', 'tecnico'].includes(role)) btnLevantamiento.style.display = '';
  } else if (view === 'rentas') {
    if (btnRenta && ['superadmin', 'admin', 'supervisor', 'tecnico'].includes(role)) btnRenta.style.display = '';
  }
}

function reRenderActiveView() {
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  const view = activeView.id.replace('view-', '');
  
  try { actualizarFiltrosPersonal(); } catch (e) { console.error('Error updating personal filters:', e); }

  try {
    if (view === 'clientes') renderClientes();
    if (view === 'maquinaria') renderMaquinaria();
    if (view === 'calendario') renderCalendario();
    if (view === 'sitios') renderSitios();
    if (view === 'config') {
      renderUsuariosList();
      renderTecnicosConfig();
      renderPermisosRoles();
      cargarListaQueriesSAP();
    }
    if (view === 'servicios') { renderTabla('servicios'); renderStats(); }
    if (view === 'rentas' && typeof renderRentas === 'function') renderRentas();
    if (view === 'tickets') { renderTickets(); renderStats(); }
    if (view === 'levantamientos' && typeof renderLevantamientos === 'function') renderLevantamientos();
    if (view === 'tecnicos') {
      if (typeof renderTecnicos === 'function') renderTecnicos();
    }
    if (view === 'gastos') {
      if (typeof renderGastos === 'function') renderGastos();
    }
    if (view === 'dashboard') {
      renderStats();
    }
    if (view === 'preferencias') {
      if (typeof renderServiciosProgramadosTecnico === 'function') renderServiciosProgramadosTecnico();
      if (typeof renderIdeasFallas === 'function') renderIdeasFallas();
      if (typeof window.renderManualesPorRol === 'function') window.renderManualesPorRol();
    }
  } catch (err) {
    console.error(`Error re-rendering active view "${view}" after role switch:`, err);
  }
}

function switchMode(rolKey) {
  if (currentSession.realRol !== 'superadmin') {
    alert('Acceso denegado: Solo los superadministradores pueden simular otros roles.');
    return;
  }
  currentSession.viewMode = rolKey;
  localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
  applyRole(rolKey);
  reRenderActiveView();
  try { updateTicketBadge(); updateOrdenesBadge(); } catch(e){}
}

// ===== CONFIG =====
let configData = safeGetJSON('eurorep_config', {});
window.configData = configData;

// FALLBACK DE EMERGENCIA: Si se borró la caché, restaurar configuración por defecto de SAP
if (!configData || !configData.queryClientes) {
  configData = {
    queryClientes: 'eurorep_clientes',
    querySitios: 'CAT_Sitos',
    queryMaquinaria: '',
    queryOrdenes: '',
    queryRefacciones: 'CAT_REFACCIONES',
    mappings: {
      clientes: { id: 'CardCode', nombre: 'CardName', rfc: 'LicTradNum', email: 'E_Mail', grupoSinergia: 'U_OK_Grupo', saldoCuenta: 'Balance' },
      sitios: { id: 'Address', nombre: 'AddressName', cliente: 'CardCode', direccion: 'Street', cp: 'ZipCode', ciudad: 'City', estado: 'State' },
      maquinaria: { id: 'ManufacturerSerialNum', itemcode: 'ItemCode', desc: 'ItemDescription', clienteId: 'CustomerCode' },
      tecnicos: { id: 'SlpCode', nombre: 'SlpName', tipoUsuario: 'Fax' },
      refacciones: { id: 'ItemCode', codigo: 'ItemCode', descripcion: 'ItemName', precio: 'Price', moneda: 'Currency' }
    }
  };
  localStorage.setItem('eurorep_config', JSON.stringify(configData));
}

// Escuchar cuando Supabase termina de cargar datos para refrescar variables locales
// Listener de supabase_datos_cargados duplicado eliminado y consolidado al inicio

// Eliminada versión duplicada de guardarConfig que estaba antes de cargarConfig


let tecnicosConfig = safeGetJSON('eurorep_tecnicos', []);

function cargarConfig(...args) {
  if (typeof window !== "undefined" && typeof window.cargarConfig === "function" && window.cargarConfig !== cargarConfig) {
    return window.cargarConfig(...args);
  }
}

// ============================================================
// MÓDULO DE GESTIÓN DE IDEAS, FALLAS Y MEJORAS (FEEDBACK & PRIORIZACIÓN)
// Extraído modularmente a ideas_fallas.js / src/modules/ideas_fallas.js (-964 líneas)
// ============================================================
function renderIfArchivosPreview(...args) {
  if (typeof window !== "undefined" && typeof window.renderIfArchivosPreview === "function" && window.renderIfArchivosPreview !== renderIfArchivosPreview) {
    return window.renderIfArchivosPreview(...args);
  }
}
function puedeEditarIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.puedeEditarIdeaFalla === "function" && window.puedeEditarIdeaFalla !== puedeEditarIdeaFalla) {
    return window.puedeEditarIdeaFalla(...args);
  }
}
function abrirModalIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.abrirModalIdeaFalla === "function" && window.abrirModalIdeaFalla !== abrirModalIdeaFalla) {
    return window.abrirModalIdeaFalla(...args);
  }
}
function cerrarModalIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarModalIdeaFalla === "function" && window.cerrarModalIdeaFalla !== cerrarModalIdeaFalla) {
    return window.cerrarModalIdeaFalla(...args);
  }
}
function guardarIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.guardarIdeaFalla === "function" && window.guardarIdeaFalla !== guardarIdeaFalla) {
    return window.guardarIdeaFalla(...args);
  }
}
function cambiarEstadoIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.cambiarEstadoIdeaFalla === "function" && window.cambiarEstadoIdeaFalla !== cambiarEstadoIdeaFalla) {
    return window.cambiarEstadoIdeaFalla(...args);
  }
}
function eliminarIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarIdeaFalla === "function" && window.eliminarIdeaFalla !== eliminarIdeaFalla) {
    return window.eliminarIdeaFalla(...args);
  }
}
function renderIdeasFallas(...args) {
  if (typeof window !== "undefined" && typeof window.renderIdeasFallas === "function" && window.renderIdeasFallas !== renderIdeasFallas) {
    return window.renderIdeasFallas(...args);
  }
}
function cambiarPrioridadIdeaFalla(...args) {
  if (typeof window !== "undefined" && typeof window.cambiarPrioridadIdeaFalla === "function" && window.cambiarPrioridadIdeaFalla !== cambiarPrioridadIdeaFalla) {
    return window.cambiarPrioridadIdeaFalla(...args);
  }
}
function sincronizarConGitHub(...args) {
  if (typeof window !== "undefined" && typeof window.sincronizarConGitHub === "function" && window.sincronizarConGitHub !== sincronizarConGitHub) {
    return window.sincronizarConGitHub(...args);
  }
}
function guardarConfig(...args) {
  if (typeof window !== "undefined" && typeof window.guardarConfig === "function" && window.guardarConfig !== guardarConfig) {
    return window.guardarConfig(...args);
  }
}
function toggleOneDriveDemoMode(...args) {
  if (typeof window !== "undefined" && typeof window.toggleOneDriveDemoMode === "function" && window.toggleOneDriveDemoMode !== toggleOneDriveDemoMode) {
    return window.toggleOneDriveDemoMode(...args);
  }
}
function guardarOneDriveConfig(...args) {
  if (typeof window !== "undefined" && typeof window.guardarOneDriveConfig === "function" && window.guardarOneDriveConfig !== guardarOneDriveConfig) {
    return window.guardarOneDriveConfig(...args);
  }
}

// =========================================================================
// MÓDULO MAPEO DE COLUMNAS SAP Y QUERIES SQL (NO-CODE)
// Extraído modularmente a sap_mapper.js / src/modules/sap_mapper.js (-568 líneas)
// =========================================================================

function abrirModalMapeo(...args) {
  if (typeof window !== "undefined" && typeof window.abrirModalMapeo === "function" && window.abrirModalMapeo !== abrirModalMapeo) {
    return window.abrirModalMapeo(...args);
  }
}

function getLabelsForModule(...args) {
  if (typeof window !== "undefined" && typeof window.getLabelsForModule === "function" && window.getLabelsForModule !== getLabelsForModule) {
    return window.getLabelsForModule(...args);
  }
  return {};
}

function applyTableHeaders(...args) {
  if (typeof window !== "undefined" && typeof window.applyTableHeaders === "function" && window.applyTableHeaders !== applyTableHeaders) {
    return window.applyTableHeaders(...args);
  }
}

function cerrarModalMapeo(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarModalMapeo === "function" && window.cerrarModalMapeo !== cerrarModalMapeo) {
    return window.cerrarModalMapeo(...args);
  }
}

function switchMapeoTab(...args) {
  if (typeof window !== "undefined" && typeof window.switchMapeoTab === "function" && window.switchMapeoTab !== switchMapeoTab) {
    return window.switchMapeoTab(...args);
  }
}

function addCustomColumnUI(...args) {
  if (typeof window !== "undefined" && typeof window.addCustomColumnUI === "function" && window.addCustomColumnUI !== addCustomColumnUI) {
    return window.addCustomColumnUI(...args);
  }
}

function removeCustomColumn(...args) {
  if (typeof window !== "undefined" && typeof window.removeCustomColumn === "function" && window.removeCustomColumn !== removeCustomColumn) {
    return window.removeCustomColumn(...args);
  }
}

function getCustomColumnsForModule(...args) {
  if (typeof window !== "undefined" && typeof window.getCustomColumnsForModule === "function" && window.getCustomColumnsForModule !== getCustomColumnsForModule) {
    return window.getCustomColumnsForModule(...args);
  }
  return [];
}

function guardarMapeoColumnas(...args) {
  if (typeof window !== "undefined" && typeof window.guardarMapeoColumnas === "function" && window.guardarMapeoColumnas !== guardarMapeoColumnas) {
    return window.guardarMapeoColumnas(...args);
  }
}

function cargarListaQueriesSAP(...args) {
  if (typeof window !== "undefined" && typeof window.cargarListaQueriesSAP === "function" && window.cargarListaQueriesSAP !== cargarListaQueriesSAP) {
    return window.cargarListaQueriesSAP(...args);
  }
}

function cargarDetalleQuery(...args) {
  if (typeof window !== "undefined" && typeof window.cargarDetalleQuery === "function" && window.cargarDetalleQuery !== cargarDetalleQuery) {
    return window.cargarDetalleQuery(...args);
  }
}

function limpiarFormularioQuery(...args) {
  if (typeof window !== "undefined" && typeof window.limpiarFormularioQuery === "function" && window.limpiarFormularioQuery !== limpiarFormularioQuery) {
    return window.limpiarFormularioQuery(...args);
  }
}

function programarQuerySAP(...args) {
  if (typeof window !== "undefined" && typeof window.programarQuerySAP === "function" && window.programarQuerySAP !== programarQuerySAP) {
    return window.programarQuerySAP(...args);
  }
}

function probarQuerySAP(...args) {
  if (typeof window !== "undefined" && typeof window.probarQuerySAP === "function" && window.probarQuerySAP !== probarQuerySAP) {
    return window.probarQuerySAP(...args);
  }
}

function eliminarQuerySAP(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarQuerySAP === "function" && window.eliminarQuerySAP !== eliminarQuerySAP) {
    return window.eliminarQuerySAP(...args);
  }
}

function renderTecnicosConfig(...args) {
  if (typeof window !== "undefined" && typeof window.renderTecnicosConfig === "function" && window.renderTecnicosConfig !== renderTecnicosConfig) {
    return window.renderTecnicosConfig(...args);
  }
}

function agregarTecnicoConfig(...args) {
  if (typeof window !== "undefined" && typeof window.agregarTecnicoConfig === "function" && window.agregarTecnicoConfig !== agregarTecnicoConfig) {
    return window.agregarTecnicoConfig(...args);
  }
}

function eliminarTecnicoConfig(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarTecnicoConfig === "function" && window.eliminarTecnicoConfig !== eliminarTecnicoConfig) {
    return window.eliminarTecnicoConfig(...args);
  }
}

// =========================================================================
// MÓDULO GESTIÓN DE USUARIOS, SESIONES Y ROLES CRUD
// Extraído modularmente a usuarios.js / src/modules/usuarios.js (-870 líneas)
// =========================================================================

function renderUsuariosList(...args) {
  if (typeof window !== "undefined" && typeof window.renderUsuariosList === "function" && window.renderUsuariosList !== renderUsuariosList) {
    return window.renderUsuariosList(...args);
  }
}

function abrirModalUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.abrirModalUsuario === "function" && window.abrirModalUsuario !== abrirModalUsuario) {
    return window.abrirModalUsuario(...args);
  }
}

function toggleEmpresaField(...args) {
  if (typeof window !== "undefined" && typeof window.toggleEmpresaField === "function" && window.toggleEmpresaField !== toggleEmpresaField) {
    return window.toggleEmpresaField(...args);
  }
}

function cerrarModalUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarModalUsuario === "function" && window.cerrarModalUsuario !== cerrarModalUsuario) {
    return window.cerrarModalUsuario(...args);
  }
}

function onCambioFusionDestinoModal(...args) {
  if (typeof window !== "undefined" && typeof window.onCambioFusionDestinoModal === "function" && window.onCambioFusionDestinoModal !== onCambioFusionDestinoModal) {
    return window.onCambioFusionDestinoModal(...args);
  }
}

function ejecutarFusionDesdeEditarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.ejecutarFusionDesdeEditarUsuario === "function" && window.ejecutarFusionDesdeEditarUsuario !== ejecutarFusionDesdeEditarUsuario) {
    return window.ejecutarFusionDesdeEditarUsuario(...args);
  }
}

function adminRestablecerPasswordClick(...args) {
  if (typeof window !== "undefined" && typeof window.adminRestablecerPasswordClick === "function" && window.adminRestablecerPasswordClick !== adminRestablecerPasswordClick) {
    return window.adminRestablecerPasswordClick(...args);
  }
}

function guardarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.guardarUsuario === "function" && window.guardarUsuario !== guardarUsuario) {
    return window.guardarUsuario(...args);
  }
}

function editarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.editarUsuario === "function" && window.editarUsuario !== editarUsuario) {
    return window.editarUsuario(...args);
  }
}

function eliminarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarUsuario === "function" && window.eliminarUsuario !== eliminarUsuario) {
    return window.eliminarUsuario(...args);
  }
}

function abrirSesionModal(...args) {
  if (typeof window !== "undefined" && typeof window.abrirSesionModal === "function" && window.abrirSesionModal !== abrirSesionModal) {
    return window.abrirSesionModal(...args);
  }
}

function cerrarSesionModal(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarSesionModal === "function" && window.cerrarSesionModal !== cerrarSesionModal) {
    return window.cerrarSesionModal(...args);
  }
}

function cambiarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.cambiarUsuario === "function" && window.cambiarUsuario !== cambiarUsuario) {
    return window.cambiarUsuario(...args);
  }
}

function agregarUsuario(...args) {
  if (typeof window !== "undefined" && typeof window.agregarUsuario === "function" && window.agregarUsuario !== agregarUsuario) {
    return window.agregarUsuario(...args);
  }
}


function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      const viewEl = document.getElementById('view-' + view);
      
      // Cerrar sidebar en móvil
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
      }

      if (!viewEl) return;

      // Cambiar de vista
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      viewEl.classList.add('active');


      // Track telemetry tab view (excluding the telemetry monitoring module itself)
      if (window.trackTelemetryEvent && view !== 'telemetry') {
        window.trackTelemetryEvent('Visualización de Módulo', { modulo: view });
      }

      // Render telemetry dashboard if active
      if (view === 'telemetry') {
        if (window.renderTelemetryDashboard) {
          window.renderTelemetryDashboard();
        }
        if (typeof window.fetchTelemetryFromSupabase === 'function') {
          window.fetchTelemetryFromSupabase();
        }
      }

      // Page title via data-title attribute
      let pageTitleText = item.dataset.title || view;
      if (view === 'preferencias' && window.innerWidth <= 768) {
        pageTitleText = 'Perfil';
      }
      document.getElementById('page-title').textContent = pageTitleText;

      // Toggle action buttons
      updateTopbarButtons(view, currentSession.viewMode);

      try {
        if (view === 'clientes') renderClientes();
        if (view === 'maquinaria') renderMaquinaria();
        if (view === 'calendario') renderCalendario();
        if (view === 'sitios') renderSitios();
        if (view === 'config') {
          renderUsuariosList();
          renderTecnicosConfig();
          renderPermisosRoles();
          cargarListaQueriesSAP();
        }
        if (view === 'servicios') { renderTabla('servicios'); renderStats(); }
        if (view === 'rentas' && typeof renderRentas === 'function') renderRentas();
        if (view === 'envios' && typeof renderEnvios === 'function') renderEnvios();
        if (view === 'tickets') { renderTickets(); renderStats(); }
        if (view === 'levantamientos' && typeof renderLevantamientos === 'function') renderLevantamientos();
        if (view === 'tecnicos') {
          if (typeof renderTecnicos === 'function') renderTecnicos();
        }
        if (view === 'gastos') {
          if (typeof renderGastos === 'function') renderGastos();
        }
        if (view === 'chat-soporte') {
          if (typeof renderChatSoporteEmpresa === 'function') renderChatSoporteEmpresa();
        }
        if (view === 'refacciones') {
          if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
          else if (typeof renderRefacciones === 'function') renderRefacciones();
          if (typeof window.renderRefaccionesPendientes === 'function') window.renderRefaccionesPendientes();
          else if (typeof renderRefaccionesPendientes === 'function') renderRefaccionesPendientes();
        }
        if (view === 'dashboard') {
          renderStats();
          // renderStats() ya invoca internamente a renderDashboardV2() si existe
        }
        if (view === 'preferencias') {
          if (typeof renderServiciosProgramadosTecnico === 'function') {
            renderServiciosProgramadosTecnico();
          }
          if (typeof renderIdeasFallas === 'function') {
            renderIdeasFallas();
          }
          if (typeof window.renderManualesPorRol === 'function') {
            window.renderManualesPorRol();
          }
        }
      } catch (err) {
        console.error(`[Navigation] Error al renderizar vista "${view}":`, err);
      }

      // Cada .view.active es su propio scroll container — reset simple y garantizado
      viewEl.scrollTop = 0;

    });
  });
}

// =========================================================================
// MÓDULO DASHBOARD EJECUTIVO, ESTADÍSTICAS Y GRÁFICAS V2
// Extraído modularmente a dashboard.js / src/modules/dashboard.js (-1,395 líneas)
// =========================================================================

function renderStats(...args) {
  if (typeof window !== "undefined" && typeof window.renderStats === "function" && window.renderStats !== renderStats) {
    return window.renderStats(...args);
  }
}

function _renderStatsInternal(...args) {
  if (typeof window !== "undefined" && typeof window._renderStatsInternal === "function" && window._renderStatsInternal !== _renderStatsInternal) {
    return window._renderStatsInternal(...args);
  }
}

function renderDashboardV2(...args) {
  if (typeof window !== "undefined" && typeof window.renderDashboardV2 === "function" && window.renderDashboardV2 !== renderDashboardV2) {
    return window.renderDashboardV2(...args);
  }
}

function setDashView(...args) {
  if (typeof window !== "undefined" && typeof window.setDashView === "function" && window.setDashView !== setDashView) {
    return window.setDashView(...args);
  }
}

function renderDashboardTecnicos(...args) {
  if (typeof window !== "undefined" && typeof window.renderDashboardTecnicos === "function" && window.renderDashboardTecnicos !== renderDashboardTecnicos) {
    return window.renderDashboardTecnicos(...args);
  }
}

function getFilteredByTimeframe(...args) {
  if (typeof window !== "undefined" && typeof window.getFilteredByTimeframe === "function" && window.getFilteredByTimeframe !== getFilteredByTimeframe) {
    return window.getFilteredByTimeframe(...args);
  }
  return args[0] || [];
}

function abrirDesgloseDashboard(...args) {
  if (typeof window !== "undefined" && typeof window.abrirDesgloseDashboard === "function" && window.abrirDesgloseDashboard !== abrirDesgloseDashboard) {
    return window.abrirDesgloseDashboard(...args);
  }
}

function onDashFilterChange(...args) {
  if (typeof window !== "undefined" && typeof window.onDashFilterChange === "function" && window.onDashFilterChange !== onDashFilterChange) {
    return window.onDashFilterChange(...args);
  }
}

// ============================================================
// MÓDULO DE LISTADOS, FILTROS, MENÚS DE ORDENACIÓN Y TABLA DE ÓRDENES
// Extraído modularmente a ordenes_listado.js / src/modules/ordenes_listado.js
// ============================================================
function setFiltroEstadoServicios(...args) {
  if (typeof window !== "undefined" && typeof window.setFiltroEstadoServicios === "function" && window.setFiltroEstadoServicios !== setFiltroEstadoServicios) {
    return window.setFiltroEstadoServicios(...args);
  }
}
function setFiltroTicketsV2(...args) {
  if (typeof window !== "undefined" && typeof window.setFiltroTicketsV2 === "function" && window.setFiltroTicketsV2 !== setFiltroTicketsV2) {
    return window.setFiltroTicketsV2(...args);
  }
}
function toggleSortOrdenes(...args) {
  if (typeof window !== "undefined" && typeof window.toggleSortOrdenes === "function" && window.toggleSortOrdenes !== toggleSortOrdenes) {
    return window.toggleSortOrdenes(...args);
  }
}
function renderTabla(...args) {
  if (typeof window !== "undefined" && typeof window.renderTabla === "function" && window.renderTabla !== renderTabla) {
    return window.renderTabla(...args);
  }
}
function badgeEstado(...args) {
  if (typeof window !== "undefined" && typeof window.badgeEstado === "function" && window.badgeEstado !== badgeEstado) {
    return window.badgeEstado(...args);
  }
}
function filtrarOrdenes(...args) {
  if (typeof window !== "undefined" && typeof window.filtrarOrdenes === "function" && window.filtrarOrdenes !== filtrarOrdenes) {
    return window.filtrarOrdenes(...args);
  }
}

// ============================================================
// MÓDULO DE SINCRONIZACIÓN SAP (CATÁLOGOS MAESTROS)
// Extraído modularmente a sap_sync.js / src/modules/sap_sync.js
// ============================================================
// =========================================================================
// MÓDULO CLIENTES Y GESTIÓN DE MAQUINARIA
// Extraído modularmente a clientes.js / src/modules/clientes.js (-2,934 líneas)
// =========================================================================

// ============================================================
// MÓDULO DE CONFIGURACIÓN DE PERMISOS, ROLES Y TÉCNICOS
// Extraído modularmente a config_tecnicos.js / src/modules/config_tecnicos.js
// ============================================================
function renderPermisosRoles(...args) {
  if (typeof window !== "undefined" && typeof window.renderPermisosRoles === "function" && window.renderPermisosRoles !== renderPermisosRoles) {
    return window.renderPermisosRoles(...args);
  }
}
function guardarPermisosRoles(...args) {
  if (typeof window !== "undefined" && typeof window.guardarPermisosRoles === "function" && window.guardarPermisosRoles !== guardarPermisosRoles) {
    return window.guardarPermisosRoles(...args);
  }
}
function setTecView(...args) {
  if (typeof window !== "undefined" && typeof window.setTecView === "function" && window.setTecView !== setTecView) {
    return window.setTecView(...args);
  }
}
function renderTecnicos(...args) {
  if (typeof window !== "undefined" && typeof window.renderTecnicos === "function" && window.renderTecnicos !== renderTecnicos) {
    return window.renderTecnicos(...args);
  }
}
function verDetalleTecnico(...args) {
  if (typeof window !== "undefined" && typeof window.verDetalleTecnico === "function" && window.verDetalleTecnico !== verDetalleTecnico) {
    return window.verDetalleTecnico(...args);
  }
}
function cerrarDetalleTecnico(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarDetalleTecnico === "function" && window.cerrarDetalleTecnico !== cerrarDetalleTecnico) {
    return window.cerrarDetalleTecnico(...args);
  }
}

// =========================================================================
// MÓDULO REFACCIONES DE ÓRDENES DE SERVICIO Y TICKETS
// Extraído modularmente a refacciones_orden.js / src/modules/refacciones_orden.js (-738 líneas)
// =========================================================================

var MARCAS_CATALOGO_OFICIAL = (typeof window !== "undefined" && window.MARCAS_CATALOGO_OFICIAL) ? window.MARCAS_CATALOGO_OFICIAL : {
  'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
  'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
  'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
  'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
  'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER',
  'KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA',
  'EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
};

function popularSelectMarcas(...args) {
  if (typeof window !== "undefined" && typeof window.popularSelectMarcas === "function" && window.popularSelectMarcas !== popularSelectMarcas) {
    return window.popularSelectMarcas(...args);
  }
}

function seleccionarMarcaRefaccion(...args) {
  if (typeof window !== "undefined" && typeof window.seleccionarMarcaRefaccion === "function" && window.seleccionarMarcaRefaccion !== seleccionarMarcaRefaccion) {
    return window.seleccionarMarcaRefaccion(...args);
  }
}

function actualizarDescripcionesCombo(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarDescripcionesCombo === "function" && window.actualizarDescripcionesCombo !== actualizarDescripcionesCombo) {
    return window.actualizarDescripcionesCombo(...args);
  }
}

function seleccionarDescRefaccion(...args) {
  if (typeof window !== "undefined" && typeof window.seleccionarDescRefaccion === "function" && window.seleccionarDescRefaccion !== seleccionarDescRefaccion) {
    return window.seleccionarDescRefaccion(...args);
  }
}

function agregarRef(...args) {
  if (typeof window !== "undefined" && typeof window.agregarRef === "function" && window.agregarRef !== agregarRef) {
    return window.agregarRef(...args);
  }
}

function actualizarFilaDiscrepanciaRefaccion(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarFilaDiscrepanciaRefaccion === "function" && window.actualizarFilaDiscrepanciaRefaccion !== actualizarFilaDiscrepanciaRefaccion) {
    return window.actualizarFilaDiscrepanciaRefaccion(...args);
  }
}

function eliminarRef(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarRef === "function" && window.eliminarRef !== eliminarRef) {
    return window.eliminarRef(...args);
  }
}

function getRefacciones(...args) {
  if (typeof window !== "undefined" && typeof window.getRefacciones === "function" && window.getRefacciones !== getRefacciones) {
    return window.getRefacciones(...args);
  }
  return [];
}

function setRefacciones(...args) {
  if (typeof window !== "undefined" && typeof window.setRefacciones === "function" && window.setRefacciones !== setRefacciones) {
    return window.setRefacciones(...args);
  }
}

function inicializarRefaccionesTicket(...args) {
  if (typeof window !== "undefined" && typeof window.inicializarRefaccionesTicket === "function" && window.inicializarRefaccionesTicket !== inicializarRefaccionesTicket) {
    return window.inicializarRefaccionesTicket(...args);
  }
}

function agregarFilaRefaccionTicket(...args) {
  if (typeof window !== "undefined" && typeof window.agregarFilaRefaccionTicket === "function" && window.agregarFilaRefaccionTicket !== agregarFilaRefaccionTicket) {
    return window.agregarFilaRefaccionTicket(...args);
  }
}

function eliminarFilaRefaccionTicket(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarFilaRefaccionTicket === "function" && window.eliminarFilaRefaccionTicket !== eliminarFilaRefaccionTicket) {
    return window.eliminarFilaRefaccionTicket(...args);
  }
}

function guardarRefaccionesTicketDesdeUI(...args) {
  if (typeof window !== "undefined" && typeof window.guardarRefaccionesTicketDesdeUI === "function" && window.guardarRefaccionesTicketDesdeUI !== guardarRefaccionesTicketDesdeUI) {
    return window.guardarRefaccionesTicketDesdeUI(...args);
  }
}

function cerrarGarantiaInternaDirecto(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarGarantiaInternaDirecto === "function" && window.cerrarGarantiaInternaDirecto !== cerrarGarantiaInternaDirecto) {
    return window.cerrarGarantiaInternaDirecto(...args);
  }
}





// ============================================================
// MÓDULO DE FORMULARIO, DÍAS PANELS, KM Y GUARDADO DE ÓRDENES DE SERVICIO
// Extraído modularmente a ordenes_form.js / src/modules/ordenes_form.js
// ============================================================
function initDiasPanels(...args) {
  if (typeof window !== "undefined" && typeof window.initDiasPanels === "function" && window.initDiasPanels !== initDiasPanels) {
    return window.initDiasPanels(...args);
  }
}
function calcularHorasDia(...args) {
  if (typeof window !== "undefined" && typeof window.calcularHorasDia === "function" && window.calcularHorasDia !== calcularHorasDia) {
    return window.calcularHorasDia(...args);
  }
}
function autoCompletarFechas(...args) {
  if (typeof window !== "undefined" && typeof window.autoCompletarFechas === "function" && window.autoCompletarFechas !== autoCompletarFechas) {
    return window.autoCompletarFechas(...args);
  }
}
function selDia(...args) {
  if (typeof window !== "undefined" && typeof window.selDia === "function" && window.selDia !== selDia) {
    return window.selDia(...args);
  }
}
function calcKmTotal(...args) {
  if (typeof window !== "undefined" && typeof window.calcKmTotal === "function" && window.calcKmTotal !== calcKmTotal) {
    return window.calcKmTotal(...args);
  }
}
function getDiasData(...args) {
  if (typeof window !== "undefined" && typeof window.getDiasData === "function" && window.getDiasData !== getDiasData) {
    return window.getDiasData(...args);
  }
}
function setDiasData(...args) {
  if (typeof window !== "undefined" && typeof window.setDiasData === "function" && window.setDiasData !== setDiasData) {
    return window.setDiasData(...args);
  }
}
function generarFolioConsecutivo(...args) {
  if (typeof window !== "undefined" && typeof window.generarFolioConsecutivo === "function" && window.generarFolioConsecutivo !== generarFolioConsecutivo) {
    return window.generarFolioConsecutivo(...args);
  }
}
function abrirFormulario(...args) {
  if (typeof window !== "undefined" && typeof window.abrirFormulario === "function" && window.abrirFormulario !== abrirFormulario) {
    return window.abrirFormulario(...args);
  }
}
function autoFillFromPdfExtraction(...args) {
  if (typeof window !== "undefined" && typeof window.autoFillFromPdfExtraction === "function" && window.autoFillFromPdfExtraction !== autoFillFromPdfExtraction) {
    return window.autoFillFromPdfExtraction(...args);
  }
}
function onSoporteChange(...args) {
  if (typeof window !== "undefined" && typeof window.onSoporteChange === "function" && window.onSoporteChange !== onSoporteChange) {
    return window.onSoporteChange(...args);
  }
}
function editarOrden(...args) {
  if (typeof window !== "undefined" && typeof window.editarOrden === "function" && window.editarOrden !== editarOrden) {
    return window.editarOrden(...args);
  }
}
function cerrarFormulario(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarFormulario === "function" && window.cerrarFormulario !== cerrarFormulario) {
    return window.cerrarFormulario(...args);
  }
}
function guardarOrdenes(...args) {
  if (typeof window !== "undefined" && typeof window.guardarOrdenes === "function" && window.guardarOrdenes !== guardarOrdenes) {
    return window.guardarOrdenes(...args);
  }
}
function guardarOrden(...args) {
  if (typeof window !== "undefined" && typeof window.guardarOrden === "function" && window.guardarOrden !== guardarOrden) {
    return window.guardarOrden(...args);
  }
}
function eliminarOrden(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarOrden === "function" && window.eliminarOrden !== eliminarOrden) {
    return window.eliminarOrden(...args);
  }
}
function completarReporteDesdeDetalle(...args) {
  if (typeof window !== "undefined" && typeof window.completarReporteDesdeDetalle === "function" && window.completarReporteDesdeDetalle !== completarReporteDesdeDetalle) {
    return window.completarReporteDesdeDetalle(...args);
  }
}

// ============================================================
// MÓDULO DE DETALLE, EVIDENCIAS FOTOGRÁFICAS Y CANVAS DE FIRMAS DE ÓRDENES
// Extraído modularmente a ordenes_detalle.js / src/modules/ordenes_detalle.js
// ============================================================
function renderEvidenciasFotograficas(...args) {
  if (typeof window !== "undefined" && typeof window.renderEvidenciasFotograficas === "function" && window.renderEvidenciasFotograficas !== renderEvidenciasFotograficas) {
    return window.renderEvidenciasFotograficas(...args);
  }
}
function previsualizarImagenCompleta(...args) {
  if (typeof window !== "undefined" && typeof window.previsualizarImagenCompleta === "function" && window.previsualizarImagenCompleta !== previsualizarImagenCompleta) {
    return window.previsualizarImagenCompleta(...args);
  }
}
function abrirImagenEnPestana(...args) {
  if (typeof window !== "undefined" && typeof window.abrirImagenEnPestana === "function" && window.abrirImagenEnPestana !== abrirImagenEnPestana) {
    return window.abrirImagenEnPestana(...args);
  }
}
function subirEvidenciaFoto(...args) {
  if (typeof window !== "undefined" && typeof window.subirEvidenciaFoto === "function" && window.subirEvidenciaFoto !== subirEvidenciaFoto) {
    return window.subirEvidenciaFoto(...args);
  }
}
function subirFotoRefaccion(...args) {
  if (typeof window !== "undefined" && typeof window.subirFotoRefaccion === "function" && window.subirFotoRefaccion !== subirFotoRefaccion) {
    return window.subirFotoRefaccion(...args);
  }
}
function eliminarEvidenciaFoto(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarEvidenciaFoto === "function" && window.eliminarEvidenciaFoto !== eliminarEvidenciaFoto) {
    return window.eliminarEvidenciaFoto(...args);
  }
}
function verDetalle(...args) {
  if (typeof window !== "undefined" && typeof window.verDetalle === "function" && window.verDetalle !== verDetalle) {
    return window.verDetalle(...args);
  }
}
function agregarRenglonTecnicoCierre(...args) {
  if (typeof window !== "undefined" && typeof window.agregarRenglonTecnicoCierre === "function" && window.agregarRenglonTecnicoCierre !== agregarRenglonTecnicoCierre) {
    return window.agregarRenglonTecnicoCierre(...args);
  }
}
function abrirCierrePapel(...args) {
  if (typeof window !== "undefined" && typeof window.abrirCierrePapel === "function" && window.abrirCierrePapel !== abrirCierrePapel) {
    return window.abrirCierrePapel(...args);
  }
}
function cerrarCierrePapel(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarCierrePapel === "function" && window.cerrarCierrePapel !== cerrarCierrePapel) {
    return window.cerrarCierrePapel(...args);
  }
}
function confirmarCierrePapel(...args) {
  if (typeof window !== "undefined" && typeof window.confirmarCierrePapel === "function" && window.confirmarCierrePapel !== confirmarCierrePapel) {
    return window.confirmarCierrePapel(...args);
  }
}
function inicializarCanvasFirma(...args) {
  if (typeof window !== "undefined" && typeof window.inicializarCanvasFirma === "function" && window.inicializarCanvasFirma !== inicializarCanvasFirma) {
    return window.inicializarCanvasFirma(...args);
  }
}
function borrarCanvasFirma(...args) {
  if (typeof window !== "undefined" && typeof window.borrarCanvasFirma === "function" && window.borrarCanvasFirma !== borrarCanvasFirma) {
    return window.borrarCanvasFirma(...args);
  }
}
function guardarFirmaCanvas(...args) {
  if (typeof window !== "undefined" && typeof window.guardarFirmaCanvas === "function" && window.guardarFirmaCanvas !== guardarFirmaCanvas) {
    return window.guardarFirmaCanvas(...args);
  }
}
function limpiarFirma(...args) {
  if (typeof window !== "undefined" && typeof window.limpiarFirma === "function" && window.limpiarFirma !== limpiarFirma) {
    return window.limpiarFirma(...args);
  }
}


// ============================================================
// MÓDULO DE ASIGNACIÓN SEMANAL Y PROGRAMACIÓN DE TÉCNICOS
// Extraído a asignacion_tecnicos.js y src/modules/asignacion_tecnicos.js
// ============================================================

// ============================================================
// MÓDULO DE BITÁCORA DE AVANCES Y REPORTES DE ÓRDENES
// Extraído modularmente a ordenes_bitacora.js / src/modules/ordenes_bitacora.js
// ============================================================
function calcularRangoFechasLaboral(...args) {
  if (typeof window !== "undefined" && typeof window.calcularRangoFechasLaboral === "function" && window.calcularRangoFechasLaboral !== calcularRangoFechasLaboral) {
    return window.calcularRangoFechasLaboral(...args);
  }
}
function abrirBitacora(...args) {
  if (typeof window !== "undefined" && typeof window.abrirBitacora === "function" && window.abrirBitacora !== abrirBitacora) {
    return window.abrirBitacora(...args);
  }
}
function iniciarReporteDesdeAsignacion(...args) {
  if (typeof window !== "undefined" && typeof window.iniciarReporteDesdeAsignacion === "function" && window.iniciarReporteDesdeAsignacion !== iniciarReporteDesdeAsignacion) {
    return window.iniciarReporteDesdeAsignacion(...args);
  }
}
function editarBitacora(...args) {
  if (typeof window !== "undefined" && typeof window.editarBitacora === "function" && window.editarBitacora !== editarBitacora) {
    return window.editarBitacora(...args);
  }
}
function cerrarBitacora(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarBitacora === "function" && window.cerrarBitacora !== cerrarBitacora) {
    return window.cerrarBitacora(...args);
  }
}
function actualizarEventoCalendarioDesdeBitacora(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarEventoCalendarioDesdeBitacora === "function" && window.actualizarEventoCalendarioDesdeBitacora !== actualizarEventoCalendarioDesdeBitacora) {
    return window.actualizarEventoCalendarioDesdeBitacora(...args);
  }
}
function guardarNotaBitacora(...args) {
  if (typeof window !== "undefined" && typeof window.guardarNotaBitacora === "function" && window.guardarNotaBitacora !== guardarNotaBitacora) {
    return window.guardarNotaBitacora(...args);
  }
}

// ============================================================
// MÓDULO DE AUTOMATIZACIÓN DE ESTADOS, REPORTE PDF Y ENVÍO DE ÓRDENES
// Extraído modularmente a ordenes_estados.js / src/modules/ordenes_estados.js
// ============================================================
function calcularEstadoOrden(...args) {
  if (typeof window !== "undefined" && typeof window.calcularEstadoOrden === "function" && window.calcularEstadoOrden !== calcularEstadoOrden) {
    return window.calcularEstadoOrden(...args);
  }
}
function cerrarDetalle(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarDetalle === "function" && window.cerrarDetalle !== cerrarDetalle) {
    return window.cerrarDetalle(...args);
  }
}
function generarBase64Pdf(...args) {
  if (typeof window !== "undefined" && typeof window.generarBase64Pdf === "function" && window.generarBase64Pdf !== generarBase64Pdf) {
    return window.generarBase64Pdf(...args);
  }
}
function toggleCampoCorreo(...args) {
  if (typeof window !== "undefined" && typeof window.toggleCampoCorreo === "function" && window.toggleCampoCorreo !== toggleCampoCorreo) {
    return window.toggleCampoCorreo(...args);
  }
}
function ejecutarComandoEditor(...args) {
  if (typeof window !== "undefined" && typeof window.ejecutarComandoEditor === "function" && window.ejecutarComandoEditor !== ejecutarComandoEditor) {
    return window.ejecutarComandoEditor(...args);
  }
}
function abrirPaletaColor(...args) {
  if (typeof window !== "undefined" && typeof window.abrirPaletaColor === "function" && window.abrirPaletaColor !== abrirPaletaColor) {
    return window.abrirPaletaColor(...args);
  }
}
function ejecutarColorEditor(...args) {
  if (typeof window !== "undefined" && typeof window.ejecutarColorEditor === "function" && window.ejecutarColorEditor !== ejecutarColorEditor) {
    return window.ejecutarColorEditor(...args);
  }
}
function imprimirOrden(...args) {
  if (typeof window !== "undefined" && typeof window.imprimirOrden === "function" && window.imprimirOrden !== imprimirOrden) {
    return window.imprimirOrden(...args);
  }
}
function enviarCorreoOrden(...args) {
  if (typeof window !== "undefined" && typeof window.enviarCorreoOrden === "function" && window.enviarCorreoOrden !== enviarCorreoOrden) {
    return window.enviarCorreoOrden(...args);
  }
}
function cerrarModalCorreo(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarModalCorreo === "function" && window.cerrarModalCorreo !== cerrarModalCorreo) {
    return window.cerrarModalCorreo(...args);
  }
}
function procesarEnviarCorreo(...args) {
  if (typeof window !== "undefined" && typeof window.procesarEnviarCorreo === "function" && window.procesarEnviarCorreo !== procesarEnviarCorreo) {
    return window.procesarEnviarCorreo(...args);
  }
}

// ============================================================
// MÓDULO DE LISTADOS, FILTROS, MENÚS DE ORDENACIÓN Y BADGES DE TICKETS
// Extraído modularmente a tickets_listado.js / src/modules/tickets_listado.js
// ============================================================
function updateTicketBadge(...args) {
  if (typeof window !== "undefined" && typeof window.updateTicketBadge === "function" && window.updateTicketBadge !== updateTicketBadge) {
    return window.updateTicketBadge(...args);
  }
}
function updateOrdenesBadge(...args) {
  if (typeof window !== "undefined" && typeof window.updateOrdenesBadge === "function" && window.updateOrdenesBadge !== updateOrdenesBadge) {
    return window.updateOrdenesBadge(...args);
  }
}
function actualizarFiltrosPersonal(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarFiltrosPersonal === "function" && window.actualizarFiltrosPersonal !== actualizarFiltrosPersonal) {
    return window.actualizarFiltrosPersonal(...args);
  }
}
function onSortTicketsChange(...args) {
  if (typeof window !== "undefined" && typeof window.onSortTicketsChange === "function" && window.onSortTicketsChange !== onSortTicketsChange) {
    return window.onSortTicketsChange(...args);
  }
}
function toggleSortMenu(...args) {
  if (typeof window !== "undefined" && typeof window.toggleSortMenu === "function" && window.toggleSortMenu !== toggleSortMenu) {
    return window.toggleSortMenu(...args);
  }
}
function setSortDirection(...args) {
  if (typeof window !== "undefined" && typeof window.setSortDirection === "function" && window.setSortDirection !== setSortDirection) {
    return window.setSortDirection(...args);
  }
}
function seleccionarColumnaOrden(...args) {
  if (typeof window !== "undefined" && typeof window.seleccionarColumnaOrden === "function" && window.seleccionarColumnaOrden !== seleccionarColumnaOrden) {
    return window.seleccionarColumnaOrden(...args);
  }
}
function actualizarUISortMenu(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarUISortMenu === "function" && window.actualizarUISortMenu !== actualizarUISortMenu) {
    return window.actualizarUISortMenu(...args);
  }
}
function actualizarCabeceraOrdenacion(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarCabeceraOrdenacion === "function" && window.actualizarCabeceraOrdenacion !== actualizarCabeceraOrdenacion) {
    return window.actualizarCabeceraOrdenacion(...args);
  }
}
function ordenarTicketsPor(...args) {
  if (typeof window !== "undefined" && typeof window.ordenarTicketsPor === "function" && window.ordenarTicketsPor !== ordenarTicketsPor) {
    return window.ordenarTicketsPor(...args);
  }
}
function toggleTipoFilterMenu(...args) {
  if (typeof window !== "undefined" && typeof window.toggleTipoFilterMenu === "function" && window.toggleTipoFilterMenu !== toggleTipoFilterMenu) {
    return window.toggleTipoFilterMenu(...args);
  }
}
function setTicketTipoFilter(...args) {
  if (typeof window !== "undefined" && typeof window.setTicketTipoFilter === "function" && window.setTicketTipoFilter !== setTicketTipoFilter) {
    return window.setTicketTipoFilter(...args);
  }
}
function actualizarUITipoFilter(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarUITipoFilter === "function" && window.actualizarUITipoFilter !== actualizarUITipoFilter) {
    return window.actualizarUITipoFilter(...args);
  }
}
function toggleSupervisorFilterMenu(...args) {
  if (typeof window !== "undefined" && typeof window.toggleSupervisorFilterMenu === "function" && window.toggleSupervisorFilterMenu !== toggleSupervisorFilterMenu) {
    return window.toggleSupervisorFilterMenu(...args);
  }
}
function setTicketSupervisorFilter(...args) {
  if (typeof window !== "undefined" && typeof window.setTicketSupervisorFilter === "function" && window.setTicketSupervisorFilter !== setTicketSupervisorFilter) {
    return window.setTicketSupervisorFilter(...args);
  }
}
function actualizarUISupervisorFilter(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarUISupervisorFilter === "function" && window.actualizarUISupervisorFilter !== actualizarUISupervisorFilter) {
    return window.actualizarUISupervisorFilter(...args);
  }
}
function toggleAntiguedadFilterMenu(...args) {
  if (typeof window !== "undefined" && typeof window.toggleAntiguedadFilterMenu === "function" && window.toggleAntiguedadFilterMenu !== toggleAntiguedadFilterMenu) {
    return window.toggleAntiguedadFilterMenu(...args);
  }
}
function cambiarModoAntiguedad(...args) {
  if (typeof window !== "undefined" && typeof window.cambiarModoAntiguedad === "function" && window.cambiarModoAntiguedad !== cambiarModoAntiguedad) {
    return window.cambiarModoAntiguedad(...args);
  }
}
function setAntiguedadRango(...args) {
  if (typeof window !== "undefined" && typeof window.setAntiguedadRango === "function" && window.setAntiguedadRango !== setAntiguedadRango) {
    return window.setAntiguedadRango(...args);
  }
}
function setAntiguedadFilter(...args) {
  if (typeof window !== "undefined" && typeof window.setAntiguedadFilter === "function" && window.setAntiguedadFilter !== setAntiguedadFilter) {
    return window.setAntiguedadFilter(...args);
  }
}
function actualizarUIAntiguedadFilter(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarUIAntiguedadFilter === "function" && window.actualizarUIAntiguedadFilter !== actualizarUIAntiguedadFilter) {
    return window.actualizarUIAntiguedadFilter(...args);
  }
}
function esTicketHijoRefacciones(...args) {
  if (typeof window !== "undefined" && typeof window.esTicketHijoRefacciones === "function" && window.esTicketHijoRefacciones !== esTicketHijoRefacciones) {
    return window.esTicketHijoRefacciones(...args);
  }
  return false;
}
function obtenerOrdenAsociadaTicket(...args) {
  if (typeof window !== "undefined" && typeof window.obtenerOrdenAsociadaTicket === "function" && window.obtenerOrdenAsociadaTicket !== obtenerOrdenAsociadaTicket) {
    return window.obtenerOrdenAsociadaTicket(...args);
  }
  return null;
}
function verOrdenDesdeTicket(...args) {
  if (typeof window !== "undefined" && typeof window.verOrdenDesdeTicket === "function" && window.verOrdenDesdeTicket !== verOrdenDesdeTicket) {
    return window.verOrdenDesdeTicket(...args);
  }
}
function obtenerTicketPadre(...args) {
  if (typeof window !== "undefined" && typeof window.obtenerTicketPadre === "function" && window.obtenerTicketPadre !== obtenerTicketPadre) {
    return window.obtenerTicketPadre(...args);
  }
  return null;
}
function resolverClienteTicket(...args) {
  if (typeof window !== "undefined" && typeof window.resolverClienteTicket === "function" && window.resolverClienteTicket !== resolverClienteTicket) {
    return window.resolverClienteTicket(...args);
  }
  return "";
}
function renderTickets(...args) {
  if (typeof window !== "undefined" && typeof window.renderTickets === "function" && window.renderTickets !== renderTickets) {
    return window.renderTickets(...args);
  }
}
function esTicketEnTransito(...args) {
  if (typeof window !== "undefined" && typeof window.esTicketEnTransito === "function" && window.esTicketEnTransito !== esTicketEnTransito) {
    return window.esTicketEnTransito(...args);
  }
  return false;
}
function badgeTicketEstado(...args) {
  if (typeof window !== "undefined" && typeof window.badgeTicketEstado === "function" && window.badgeTicketEstado !== badgeTicketEstado) {
    return window.badgeTicketEstado(...args);
  }
  return "abierto";
}
function getTicketEstadoLabel(...args) {
  if (typeof window !== "undefined" && typeof window.getTicketEstadoLabel === "function" && window.getTicketEstadoLabel !== getTicketEstadoLabel) {
    return window.getTicketEstadoLabel(...args);
  }
  return "—";
}
function filtrarTickets(...args) {
  if (typeof window !== "undefined" && typeof window.filtrarTickets === "function" && window.filtrarTickets !== filtrarTickets) {
    return window.filtrarTickets(...args);
  }
}
function setFiltroTickets(...args) {
  if (typeof window !== "undefined" && typeof window.setFiltroTickets === "function" && window.setFiltroTickets !== setFiltroTickets) {
    return window.setFiltroTickets(...args);
  }
}
function seleccionarCanal(...args) {
  if (typeof window !== "undefined" && typeof window.seleccionarCanal === "function" && window.seleccionarCanal !== seleccionarCanal) {
    return window.seleccionarCanal(...args);
  }
}
function updateFileLabel(...args) {
  if (typeof window !== "undefined" && typeof window.updateFileLabel === "function" && window.updateFileLabel !== updateFileLabel) {
    return window.updateFileLabel(...args);
  }
}

// ============================================================
// MÓDULO DE COTIZACIONES, PEDIDOS Y VALIDACIÓN SAP
// Extraído modularmente a sap_sync.js / src/modules/sap_sync.js
// ============================================================

// ============================================================
// MÓDULO DE CENTRO DE NOTIFICACIONES Y CAMPANITAS DE TICKETS
// Extraído modularmente a notificaciones.js / src/modules/notificaciones.js
// ============================================================

// ============================================================
// MÓDULO DE SERVICIOS PROGRAMADOS DE TÉCNICO Y ENVÍOS EN TICKETS
// Extraído modularmente a servicios_programados.js / src/modules/servicios_programados.js
// ============================================================
function renderServiciosProgramadosTecnico(...args) {
  if (typeof window !== "undefined" && typeof window.renderServiciosProgramadosTecnico === "function" && window.renderServiciosProgramadosTecnico !== renderServiciosProgramadosTecnico) {
    return window.renderServiciosProgramadosTecnico(...args);
  }
}
function renderTicketRefaccionesList(...args) {
  if (typeof window !== "undefined" && typeof window.renderTicketRefaccionesList === "function" && window.renderTicketRefaccionesList !== renderTicketRefaccionesList) {
    return window.renderTicketRefaccionesList(...args);
  }
}
function obtenerEnviosDesdeDOM(...args) {
  if (typeof window !== "undefined" && typeof window.obtenerEnviosDesdeDOM === "function" && window.obtenerEnviosDesdeDOM !== obtenerEnviosDesdeDOM) {
    return window.obtenerEnviosDesdeDOM(...args);
  }
  return [];
}
function actualizarVisibilidadDestinoPiezas(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarVisibilidadDestinoPiezas === "function" && window.actualizarVisibilidadDestinoPiezas !== actualizarVisibilidadDestinoPiezas) {
    return window.actualizarVisibilidadDestinoPiezas(...args);
  }
}
function actualizarEstatusRefaccionesDesdeGuias(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarEstatusRefaccionesDesdeGuias === "function" && window.actualizarEstatusRefaccionesDesdeGuias !== actualizarEstatusRefaccionesDesdeGuias) {
    return window.actualizarEstatusRefaccionesDesdeGuias(...args);
  }
}
function esTicketDeServicioEnCampo(...args) {
  if (typeof window !== "undefined" && typeof window.esTicketDeServicioEnCampo === "function" && window.esTicketDeServicioEnCampo !== esTicketDeServicioEnCampo) {
    return window.esTicketDeServicioEnCampo(...args);
  }
  return false;
}
function renderEnvioCards(...args) {
  if (typeof window !== "undefined" && typeof window.renderEnvioCards === "function" && window.renderEnvioCards !== renderEnvioCards) {
    return window.renderEnvioCards(...args);
  }
}

// ============================================================
// MÓDULO DE FORMULARIO, VALIDACIÓN Y GUARDADO DE TICKETS
// Extraído modularmente a tickets_form.js / src/modules/tickets_form.js
// ============================================================
function abrirTicket(...args) {
  if (typeof window !== "undefined" && typeof window.abrirTicket === "function" && window.abrirTicket !== abrirTicket) {
    return window.abrirTicket(...args);
  }
}
function abrirTicketPreloaded(...args) {
  if (typeof window !== "undefined" && typeof window.abrirTicketPreloaded === "function" && window.abrirTicketPreloaded !== abrirTicketPreloaded) {
    return window.abrirTicketPreloaded(...args);
  }
}
function toggleResolucionTicket(...args) {
  if (typeof window !== "undefined" && typeof window.toggleResolucionTicket === "function" && window.toggleResolucionTicket !== toggleResolucionTicket) {
    return window.toggleResolucionTicket(...args);
  }
}
function toggleMotivoRechazo(...args) {
  if (typeof window !== "undefined" && typeof window.toggleMotivoRechazo === "function" && window.toggleMotivoRechazo !== toggleMotivoRechazo) {
    return window.toggleMotivoRechazo(...args);
  }
}
function editarTicket(...args) {
  if (typeof window !== "undefined" && typeof window.editarTicket === "function" && window.editarTicket !== editarTicket) {
    return window.editarTicket(...args);
  }
}
function cerrarTicket(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarTicket === "function" && window.cerrarTicket !== cerrarTicket) {
    return window.cerrarTicket(...args);
  }
}
function poblarSoportesPorCliente(...args) {
  if (typeof window !== "undefined" && typeof window.poblarSoportesPorCliente === "function" && window.poblarSoportesPorCliente !== poblarSoportesPorCliente) {
    return window.poblarSoportesPorCliente(...args);
  }
}
function poblarMaquinasCliente(...args) {
  if (typeof window !== "undefined" && typeof window.poblarMaquinasCliente === "function" && window.poblarMaquinasCliente !== poblarMaquinasCliente) {
    return window.poblarMaquinasCliente(...args);
  }
}
function onEquipoOrdenChange(...args) {
  if (typeof window !== "undefined" && typeof window.onEquipoOrdenChange === "function" && window.onEquipoOrdenChange !== onEquipoOrdenChange) {
    return window.onEquipoOrdenChange(...args);
  }
}
function onEquipoTicketChange(...args) {
  if (typeof window !== "undefined" && typeof window.onEquipoTicketChange === "function" && window.onEquipoTicketChange !== onEquipoTicketChange) {
    return window.onEquipoTicketChange(...args);
  }
}
function onEquipoTicketChangeMultiple(...args) {
  if (typeof window !== "undefined" && typeof window.onEquipoTicketChangeMultiple === "function" && window.onEquipoTicketChangeMultiple !== onEquipoTicketChangeMultiple) {
    return window.onEquipoTicketChangeMultiple(...args);
  }
}
function actualizarCamposMaquinaOrden(...args) {
  if (typeof window !== "undefined" && typeof window.actualizarCamposMaquinaOrden === "function" && window.actualizarCamposMaquinaOrden !== actualizarCamposMaquinaOrden) {
    return window.actualizarCamposMaquinaOrden(...args);
  }
}
function agregarMaquinaChipOrden(...args) {
  if (typeof window !== "undefined" && typeof window.agregarMaquinaChipOrden === "function" && window.agregarMaquinaChipOrden !== agregarMaquinaChipOrden) {
    return window.agregarMaquinaChipOrden(...args);
  }
}
function onEquipoOrdenChangeMultiple(...args) {
  if (typeof window !== "undefined" && typeof window.onEquipoOrdenChangeMultiple === "function" && window.onEquipoOrdenChangeMultiple !== onEquipoOrdenChangeMultiple) {
    return window.onEquipoOrdenChangeMultiple(...args);
  }
}
function toggleCombo(...args) {
  if (typeof window !== "undefined" && typeof window.toggleCombo === "function" && window.toggleCombo !== toggleCombo) {
    return window.toggleCombo(...args);
  }
}
function filterCombo(...args) {
  if (typeof window !== "undefined" && typeof window.filterCombo === "function" && window.filterCombo !== filterCombo) {
    return window.filterCombo(...args);
  }
}
function selectComboOption(...args) {
  if (typeof window !== "undefined" && typeof window.selectComboOption === "function" && window.selectComboOption !== selectComboOption) {
    return window.selectComboOption(...args);
  }
}
function agregarSitioCombo(...args) {
  if (typeof window !== "undefined" && typeof window.agregarSitioCombo === "function" && window.agregarSitioCombo !== agregarSitioCombo) {
    return window.agregarSitioCombo(...args);
  }
}
function agregarEmpresaCombo(...args) {
  if (typeof window !== "undefined" && typeof window.agregarEmpresaCombo === "function" && window.agregarEmpresaCombo !== agregarEmpresaCombo) {
    return window.agregarEmpresaCombo(...args);
  }
}
function readFileAsBase64(...args) {
  if (typeof window !== "undefined" && typeof window.readFileAsBase64 === "function" && window.readFileAsBase64 !== readFileAsBase64) {
    return window.readFileAsBase64(...args);
  }
}
function guardarTicket(...args) {
  if (typeof window !== "undefined" && typeof window.guardarTicket === "function" && window.guardarTicket !== guardarTicket) {
    return window.guardarTicket(...args);
  }
}
function eliminarTicket(...args) {
  if (typeof window !== "undefined" && typeof window.eliminarTicket === "function" && window.eliminarTicket !== eliminarTicket) {
    return window.eliminarTicket(...args);
  }
}

// ============================================================
// MÓDULO DE DETALLE, COMENTARIOS Y ADJUNTOS DE TICKETS
// Extraído modularmente a tickets_detalle.js / src/modules/tickets_detalle.js
// ============================================================
function renderComentariosInternosHtml(...args) {
  if (typeof window !== "undefined" && typeof window.renderComentariosInternosHtml === "function" && window.renderComentariosInternosHtml !== renderComentariosInternosHtml) {
    return window.renderComentariosInternosHtml(...args);
  }
}
function switchCommentTab(...args) {
  if (typeof window !== "undefined" && typeof window.switchCommentTab === "function" && window.switchCommentTab !== switchCommentTab) {
    return window.switchCommentTab(...args);
  }
}
function agregarComentarioInterno(...args) {
  if (typeof window !== "undefined" && typeof window.agregarComentarioInterno === "function" && window.agregarComentarioInterno !== agregarComentarioInterno) {
    return window.agregarComentarioInterno(...args);
  }
}
function agregarComentarioExterno(...args) {
  if (typeof window !== "undefined" && typeof window.agregarComentarioExterno === "function" && window.agregarComentarioExterno !== agregarComentarioExterno) {
    return window.agregarComentarioExterno(...args);
  }
}
function verDetalleTicket(...args) {
  if (typeof window !== "undefined" && typeof window.verDetalleTicket === "function" && window.verDetalleTicket !== verDetalleTicket) {
    return window.verDetalleTicket(...args);
  }
}
function visualizarPdfOnDemand(...args) {
  if (typeof window !== "undefined" && typeof window.visualizarPdfOnDemand === "function" && window.visualizarPdfOnDemand !== visualizarPdfOnDemand) {
    return window.visualizarPdfOnDemand(...args);
  }
}
function visualizarDestinoPdfActual(...args) {
  if (typeof window !== "undefined" && typeof window.visualizarDestinoPdfActual === "function" && window.visualizarDestinoPdfActual !== visualizarDestinoPdfActual) {
    return window.visualizarDestinoPdfActual(...args);
  }
}
function descargarPdfOnDemand(...args) {
  if (typeof window !== "undefined" && typeof window.descargarPdfOnDemand === "function" && window.descargarPdfOnDemand !== descargarPdfOnDemand) {
    return window.descargarPdfOnDemand(...args);
  }
}
function avanzarCotizacionTicket(...args) {
  if (typeof window !== "undefined" && typeof window.avanzarCotizacionTicket === "function" && window.avanzarCotizacionTicket !== avanzarCotizacionTicket) {
    return window.avanzarCotizacionTicket(...args);
  }
}
function cerrarCotizacionTicket(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarCotizacionTicket === "function" && window.cerrarCotizacionTicket !== cerrarCotizacionTicket) {
    return window.cerrarCotizacionTicket(...args);
  }
}
function cerrarDetalleTicket(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarDetalleTicket === "function" && window.cerrarDetalleTicket !== cerrarDetalleTicket) {
    return window.cerrarDetalleTicket(...args);
  }
}
function forzarEstadoTicket(...args) {
  if (typeof window !== "undefined" && typeof window.forzarEstadoTicket === "function" && window.forzarEstadoTicket !== forzarEstadoTicket) {
    return window.forzarEstadoTicket(...args);
  }
}
function forzarCrearOrdenServicio(...args) {
  if (typeof window !== "undefined" && typeof window.forzarCrearOrdenServicio === "function" && window.forzarCrearOrdenServicio !== forzarCrearOrdenServicio) {
    return window.forzarCrearOrdenServicio(...args);
  }
}


// ============================================================
// MÓDULO DE SITIOS DE OBRA, CLIENTES Y GENERACIÓN DE ID MÁQUINA
// Extraído modularmente a sitios_clientes.js / src/modules/sitios_clientes.js
// ============================================================
function getSitioNombre(...args) {
  if (typeof window !== "undefined" && typeof window.getSitioNombre === "function" && window.getSitioNombre !== getSitioNombre) {
    return window.getSitioNombre(...args);
  }
}
function getNombresDeSitiosParaCliente(...args) {
  if (typeof window !== "undefined" && typeof window.getNombresDeSitiosParaCliente === "function" && window.getNombresDeSitiosParaCliente !== getNombresDeSitiosParaCliente) {
    return window.getNombresDeSitiosParaCliente(...args);
  }
}
function generarIdInternoMaquina(...args) {
  if (typeof window !== "undefined" && typeof window.generarIdInternoMaquina === "function" && window.generarIdInternoMaquina !== generarIdInternoMaquina) {
    return window.generarIdInternoMaquina(...args);
  }
}
function agregarSitioClienteDesdeEmpresa(...args) {
  if (typeof window !== "undefined" && typeof window.agregarSitioClienteDesdeEmpresa === "function" && window.agregarSitioClienteDesdeEmpresa !== agregarSitioClienteDesdeEmpresa) {
    return window.agregarSitioClienteDesdeEmpresa(...args);
  }
}
function agregarSitioCliente(...args) {
  if (typeof window !== "undefined" && typeof window.agregarSitioCliente === "function" && window.agregarSitioCliente !== agregarSitioCliente) {
    return window.agregarSitioCliente(...args);
  }
}
function cerrarModalSitio(...args) {
  if (typeof window !== "undefined" && typeof window.cerrarModalSitio === "function" && window.cerrarModalSitio !== cerrarModalSitio) {
    return window.cerrarModalSitio(...args);
  }
}
function guardarSitioCliente(...args) {
  if (typeof window !== "undefined" && typeof window.guardarSitioCliente === "function" && window.guardarSitioCliente !== guardarSitioCliente) {
    return window.guardarSitioCliente(...args);
  }
}

// ===== COLUMNAS AJUSTABLES =====
// ============================================================
// REDIMENSIONAMIENTO DE TABLAS
// Extraído modularmente a preferencias.js / src/modules/preferencias.js
// ============================================================
function initTableResizers(...args) {
  if (typeof window !== "undefined" && typeof window.initTableResizers === "function" && window.initTableResizers !== initTableResizers) {
    return window.initTableResizers(...args);
  }
}
function inicializarTableResizersEvent(...args) {
  if (typeof window !== "undefined" && typeof window.inicializarTableResizersEvent === "function" && window.inicializarTableResizersEvent !== inicializarTableResizersEvent) {
    return window.inicializarTableResizersEvent(...args);
  }
}


// =========================================================================
// MÓDULO CALENDARIO FULLCALENDAR Y GESTIÓN DE EVENTOS
// Extraído modularmente a calendario.js / src/modules/calendario.js (-1,183 líneas)
// =========================================================================

// ===== PASSWORD RECOVERY FLOW =====

// ============================================================
// FLUJO DE RECUPERACIÓN DE CONTRASEÑA
// Extraído modularmente a preferencias.js / src/modules/preferencias.js
// ============================================================
function inicializarPasswordRecovery(...args) {
  if (typeof window !== "undefined" && typeof window.inicializarPasswordRecovery === "function" && window.inicializarPasswordRecovery !== inicializarPasswordRecovery) {
    return window.inicializarPasswordRecovery(...args);
  }
}
function abrirRecuperarPassword(...args) {
  if (typeof window !== "undefined" && typeof window.abrirRecuperarPassword === "function" && window.abrirRecuperarPassword !== abrirRecuperarPassword) {
    return window.abrirRecuperarPassword(...args);
  }
}
function volverLoginDesdeRecovery(...args) {
  if (typeof window !== "undefined" && typeof window.volverLoginDesdeRecovery === "function" && window.volverLoginDesdeRecovery !== volverLoginDesdeRecovery) {
    return window.volverLoginDesdeRecovery(...args);
  }
}
function enviarRecoveryLink(...args) {
  if (typeof window !== "undefined" && typeof window.enviarRecoveryLink === "function" && window.enviarRecoveryLink !== enviarRecoveryLink) {
    return window.enviarRecoveryLink(...args);
  }
}
function guardarNuevaPassword(...args) {
  if (typeof window !== "undefined" && typeof window.guardarNuevaPassword === "function" && window.guardarNuevaPassword !== guardarNuevaPassword) {
    return window.guardarNuevaPassword(...args);
  }
}


// =========================================================================
// MÓDULO CONTROL DE GASTOS Y CONCILIACIÓN CLARA
// Extraído modularmente a gastos.js / src/modules/gastos.js (-4,950 líneas)
// =========================================================================

// =========================================================================
// MÓDULO DE INTEGRACIÓN MICROSOFT ONEDRIVE, EXTRACCIÓN FISCAL SAT Y VISOR PDF
// Extraído modularmente a onedrive.js / src/modules/onedrive.js (-1,788 líneas)
// =========================================================================

// =========================================================================
// MÓDULO DE TELEMETRÍA, AUDITORÍA Y HERRAMIENTAS SUPERADMIN
// Extraído modularmente a telemetria.js / src/modules/telemetria.js (-1,703 líneas)
// =========================================================================

// =========================================================================
// MÓDULO CHAT DE SOPORTE Y BANDEJA DE CORREO
// Extraído modularmente a soporte.js / src/modules/soporte.js (-2,612 líneas)
// =========================================================================

// ===== DISPARAR INICIALIZACIÓN GLOBAL DE LA APP AL FINAL DEL ARCHIVO PARA EVITAR ERRORES DE TDZ =====
function dispararInicializacionGlobal() {
  try {
    if (typeof window.sanitizarAsignacionesTickets === 'function') {
      window.sanitizarAsignacionesTickets();
    }
  } catch (err) {
    console.error('Error al sanitizar tickets en inicialización global:', err);
  }
  try {
    if (typeof window.reestablecerTicket26477 === 'function') {
      window.reestablecerTicket26477();
    }
  } catch (err) {
    console.error('Error al reestablecer TKT-26477:', err);
  }
  try {
    inicializarApp();
  } catch (err) {
    console.error('Error al inicializar la app:', err);
  }
  try {
    if (typeof window.cargarConfiguracionesNube === 'function') {
      window.cargarConfiguracionesNube();
    }
  } catch (err) {
    console.error('Error al cargar configuraciones de la nube:', err);
  }
  try {
    inicializarTableResizersEvent();
  } catch (err) {
    console.error('Error al inicializar resizer de tablas:', err);
  }
  try {
    inicializarPasswordRecovery();
  } catch (err) {
    console.error('Error al inicializar recuperación de contraseña:', err);
  }
  try {
    if (typeof updateTicketBadge === 'function') updateTicketBadge();
    if (typeof updateOrdenesBadge === 'function') updateOrdenesBadge();
    if (typeof window.actualizarBadgeLevantamientos === 'function') window.actualizarBadgeLevantamientos();
    if (typeof window.updateEnviosBadge === 'function') window.updateEnviosBadge();
    if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
    if (typeof window.updateNotificationBell === 'function') window.updateNotificationBell();
    if (typeof window.renderManualesPorRol === 'function') window.renderManualesPorRol();
  } catch (err) {
    console.error('Error al actualizar badges y notificaciones:', err);
  }

  // Listener para el campo de orden en el modal registrar actividad
  try {
    const mraOrden = document.getElementById('mra-orden');
    if (mraOrden) {
      mraOrden.addEventListener('change', function() {
        const ordenId = this.value;
        const btnToggle = document.getElementById('mra-btn-toggle-traslado');
        const sectTraslado = document.getElementById('mra-traslado-section');
        if (ordenId) {
          if (sectTraslado && sectTraslado.style.display !== 'block') {
            if (btnToggle) btnToggle.style.display = 'flex';
          }
        } else {
          if (btnToggle) btnToggle.style.display = 'none';
          if (sectTraslado) sectTraslado.style.display = 'none';
          if (document.getElementById('mra-fecha-inicio-traslado')) {
            document.getElementById('mra-fecha-inicio-traslado').value = '';
            document.getElementById('mra-hora-inicio').value = '';
            document.getElementById('mra-horas-traslado').value = '';
            document.getElementById('mra-fecha-fin-regreso-date').value = '';
            document.getElementById('mra-hora-fin-regreso').value = '';
            document.getElementById('mra-horas-regreso').value = '';
          }
        }
      });
    }
  } catch (err) {
    console.error('Error al inicializar listener de mra-orden:', err);
  }

  // Purga definitiva de registros de prueba huérfanos de la sesión
  try {
    if (typeof localStorage !== 'undefined') {
      const q = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
      const qFiltered = q.filter(item => {
        const f = String(item?.data?.folio || item?.data?.id || item?.id || '');
        return !f.includes('OS-PRUEBA-002') && !f.includes('OS-PRUEBA-005') && !f.includes('[PRUEBA]');
      });
      if (qFiltered.length !== q.length) {
        localStorage.setItem('sapi_sync_queue', JSON.stringify(qFiltered));
        if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
      }
      const ords = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      const ordsFiltered = ords.filter(o => {
        const f = String(o?.folio || o?.id || '');
        return !f.includes('OS-PRUEBA-002') && !f.includes('OS-PRUEBA-005');
      });
      if (ordsFiltered.length !== ords.length) {
        localStorage.setItem('sapi_ordenes', JSON.stringify(ordsFiltered));
        if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
          ordenes = ordsFiltered;
        }
      }
    }
  } catch(e) {}
}

// ============================================================
// SUBVISTAS DE CLIENTES Y PORTAL DE USUARIOS
// Extraído modularmente a sitios_clientes.js / src/modules/sitios_clientes.js
// ============================================================
window.setClientesSubView = function(...args) {
  if (typeof window.setClientesSubView === "function") return window.setClientesSubView(...args);
};
window.renderPortalUsuariosList = function(...args) {
  if (typeof window.renderPortalUsuariosList === "function") return window.renderPortalUsuariosList(...args);
};
window.aprobarUsuarioPortal = async function(...args) {
  if (typeof window.aprobarUsuarioPortal === "function") return window.aprobarUsuarioPortal(...args);
};

// =========================================================================
// MÓDULO DE AUTOMATIZACIONES, REGLAS Y PLANTILLAS DE CORREO
// Extraído modularmente a automatizaciones.js / src/modules/automatizaciones.js (-937 líneas)
// =========================================================================

// ============================================================
// DIAGRAMA DE FLUJO INTERACTIVO (PREFERENCIAS)
// ============================================================
// ============================================================
// DIAGRAMA DE FLUJO INTERACTIVO (PREFERENCIAS)
// Extraído modularmente a preferencias.js / src/modules/preferencias.js
// ============================================================
window.abrirModalDiagramaFlujo = function(...args) {
  if (typeof window.abrirModalDiagramaFlujo === "function") return window.abrirModalDiagramaFlujo(...args);
};
window.cerrarModalDiagramaFlujo = function(...args) {
  if (typeof window.cerrarModalDiagramaFlujo === "function") return window.cerrarModalDiagramaFlujo(...args);
};
window.zoomDiagramaFlujo = function(...args) {
  if (typeof window.zoomDiagramaFlujo === "function") return window.zoomDiagramaFlujo(...args);
};
window.resetZoomDiagramaFlujo = function(...args) {
  if (typeof window.resetZoomDiagramaFlujo === "function") return window.resetZoomDiagramaFlujo(...args);
};
window.toggleSimbologiaFlujo = function(...args) {
  if (typeof window.toggleSimbologiaFlujo === "function") return window.toggleSimbologiaFlujo(...args);
};
window.filtrarRutaDiagrama = function(...args) {
  if (typeof window.filtrarRutaDiagrama === "function") return window.filtrarRutaDiagrama(...args);
};

// =========================================================================
// MÓDULO DE DEPURACIÓN DE ÓRDENES DE REFACCIONES, GARANTÍAS Y VISOR DE MANUALES
// Extraído modularmente a depurador_ordenes.js / src/modules/depurador_ordenes.js (-879 líneas)
// =========================================================================
// =========================================================================
// MÓDULO DE RESUMEN SEMANAL OPERATIVO Y REPORTES EJECUTIVOS
// Extraído modularmente a resumen_semanal.js / src/modules/resumen_semanal.js (-556 líneas)
// =========================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', dispararInicializacionGlobal);
} else {
  dispararInicializacionGlobal();
}





