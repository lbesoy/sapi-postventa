window.agregarMaquinaChip = function(maquinaName) {
  if (!maquinaName) return;
  const container = document.getElementById('t-equipos-seleccionados');
  if (!container) return;
  
  // Evitar duplicados
  const existing = Array.from(container.querySelectorAll('.maquina-chip')).some(c => c.getAttribute('data-value') === maquinaName);
  if (existing) return;
  
  const currentTicket = editandoTicketId ? tickets.find(x => x.id === editandoTicketId) : null;
  const isRefTicket = currentTicket && currentTicket.folio && currentTicket.folio.endsWith('-A');

  const chip = document.createElement('div');
  chip.className = 'maquina-chip';
  chip.setAttribute('data-value', maquinaName);
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    background: var(--bg-hover, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary, #1f2937);
    gap: 0.25rem;
    box-shadow: var(--shadow-sm);
  `;
  
  const deleteBtn = isRefTicket ? '' : `<span onclick="this.parentElement.remove(); if (typeof window.alCambiarCategoriaTicket === 'function' && document.getElementById('t-categoria')?.value === 'Servicio Técnico') window.alCambiarCategoriaTicket();" style="cursor:pointer; font-weight:bold; color:var(--red, #ef4444); margin-left:4px; font-size:1.1rem; line-height:1;">&times;</span>`;

  chip.innerHTML = `
    <span>${maquinaName}</span>
    ${deleteBtn}
  `;
  container.appendChild(chip);
  if (typeof window.alCambiarCategoriaTicket === 'function' && document.getElementById('t-categoria')?.value === 'Servicio Técnico') {
    window.alCambiarCategoriaTicket();
  }
};let currentMaqSortCol = 'reciente';
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

window.generarTicketsRefaccionesFaltantes = async function() {
  console.log('[App] Iniciando escaneo y generación de tickets de refacciones faltantes para órdenes...');
  let creados = 0;
  
  for (const o of ordenes) {
    const refNecesarias = o.ref_necesarias || [];
    if (refNecesarias.length === 0) continue;
    
    // Calcular el targetFolio correspondiente
    let baseFolio = o.folio || '';
    let parentTicketId = o.soporte || null;
    let ticketPadre = parentTicketId ? tickets.find(t => t.id === parentTicketId) : null;
    
    let prefix = '';
    let cleanFolio = baseFolio.trim();
    if (cleanFolio.startsWith('[PRUEBA] ')) {
      prefix = '[PRUEBA] ';
      cleanFolio = cleanFolio.replace('[PRUEBA] ', '').trim();
    } else if (cleanFolio.startsWith('[TEST] ')) {
      prefix = '[TEST] ';
      cleanFolio = cleanFolio.replace('[TEST] ', '').trim();
    }
    
    if (!cleanFolio.toUpperCase().startsWith('TKT-')) {
      cleanFolio = 'TKT-' + cleanFolio;
    }
    
    const targetFolio = cleanFolio.endsWith('-A') ? `${prefix}${cleanFolio}` : `${prefix}${cleanFolio}-A`;
    
    // Verificar si ya existe un ticket local con este folio
    let ticketExistente = tickets.find(t => t.folio === targetFolio);
    if (ticketExistente) continue; // Ya existe, no hacemos nada
    
    // Crear el ticket autogenerado desde la orden
    console.log(`[App] Generando ticket faltante ${targetFolio} para la orden ${o.folio}...`);
    
    const now = new Date().toISOString();
    const refaccionesMapeadas = refNecesarias.map(r => ({
      marca: r.marca || '',
      codigo: r.clave || r.codigo || 'S/C',
      clave: r.clave || r.codigo || 'S/C',
      nombre: r.descripcion || r.nombre || 'Sin Descripción',
      descripcion: r.descripcion || r.nombre || 'Sin Descripción',
      cantidad: r.cantidad || 1,
      estatusPedido: r.estatusPedido || 'Por Pedir'
    }));

    const ticket = {
      id: crypto.randomUUID(),
      folio: targetFolio,
      ordenId: o.id,
      ordenFolio: o.folio,
      fecha: now,
      fechaCreacion: now,
      fechaCierre: null,
      canal: 'sistema',
      contacto: '',
      asunto: `Refacciones para ${baseFolio}`,
      cliente: o.cliente,
      sitio: o.ubicacion || o.ubicacion_sitio || '',
      solicitante: o.creadoPor || o.tecnico || 'Sistema',
      creadoPor: o.creadoPor || o.tecnico || 'Sistema',
      area: ticketPadre ? (ticketPadre.area || 'Operaciones') : 'Operaciones',
      categoria: 'Refacción',
      prioridad: ticketPadre ? (ticketPadre.prioridad || 'Media') : 'Media',
      asignado: (ticketPadre && ticketPadre.asignado) ? ticketPadre.asignado : '',
      descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${o.folio}.`,
      equipo: o.equipo,
      notas: '',
      refaccionesSeleccionadas: refaccionesMapeadas,
      cotizacionesAdicionales: [],
      estado: 'Refacciones',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      comentariosInternos: [],
      comentariosClientes: [],
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: null,
      esPrueba: o.esPrueba || false
    };
    
    tickets.unshift(ticket);
    creados++;
    
    if (window.supabaseClient) {
      try {
        await window.pushToSupabase('tickets', ticket);
      } catch (err) {
        console.error(`[App] Error al sincronizar ticket faltante con Supabase:`, err);
      }
    }
  }
  
  if (creados > 0) {
    console.log(`[App] Se generaron ${creados} tickets de refacciones faltantes.`);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof renderTickets === 'function') {
      renderTickets();
      renderTickets('dash-tickets');
    }
    if (typeof updateTicketBadge === 'function') updateTicketBadge(); updateOrdenesBadge();
  }
};

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

// Función para migrar y reparar la maquinaria de órdenes existentes
window.migrarOrdenesExistentesMaquinaria = function() {
  console.log('[App] Ejecutando migración de maquinaria en órdenes existentes...');
  let modificados = 0;
  
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  ordenes.forEach(o => {
    if (!o.soporte) return;
    if (o.maquinaria_id && o.modelo && o.serie && o.marca && o.eco && o.equipo) return;
    
    const t = tickets.find(x => x.id === o.soporte);
    if (!t || !t.equipo) return;
    
    const prevModelo = o.modelo;
    const prevSerie = o.serie;
    const prevMarca = o.marca;
    const prevEco = o.eco;
    const prevMaqId = o.maquinaria_id;
    const prevEquipo = o.equipo;

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

    let modeloStr = o.modelo || '';
    let serieStr = o.serie || '';
    let marcaStr = o.marca || '';
    let ecoStr = o.eco || '';
    let maquinariaId = o.maquinaria_id || null;

    if (maq) {
      modeloStr = maq.modelo || modeloStr;
      serieStr = maq.serie || serieStr;
      marcaStr = maq.marca || marcaStr;
      ecoStr = maq.no_economico || ecoStr;
      maquinariaId = maq.id || maq.idInterno || maquinariaId;
    } else {
      if (t.equipo.includes('(SN: ')) {
        const parts = t.equipo.split('(SN: ');
        serieStr = serieStr || parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          left = left.substring(left.indexOf(']') + 1).trim();
        }
        modeloStr = modeloStr || left;
      } else {
        modeloStr = modeloStr || t.equipo;
      }
    }

    if (
      modeloStr !== prevModelo ||
      serieStr !== prevSerie ||
      marcaStr !== prevMarca ||
      ecoStr !== prevEco ||
      maquinariaId !== prevMaqId ||
      !o.equipo
    ) {
      o.modelo = modeloStr;
      o.serie = serieStr;
      o.marca = marcaStr;
      o.eco = ecoStr;
      o.maquinaria_id = maquinariaId;
      o.equipo = t.equipo;
      
      modificados++;
    }
  });

  if (modificados > 0) {
    console.log(`[App] Se migraron y corrigieron ${modificados} órdenes con datos de maquinaria.`);
    safeSetJSON('sapi_ordenes', ordenes);
  }
};

window.migrarUbicacionesMaquinariaDesdeTickets = function() {
  console.log('[App] Ejecutando migración de ubicaciones de maquinaria desde tickets...');
  let modificadosMaquinariaDb = false;
  let modificadosClientesDb = false;
  let syncCount = 0;

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  // Ordenar tickets de más antiguo a más reciente para que prevalezca la ubicación del ticket más reciente
  const ticketsOrdenados = [...tickets].sort((a, b) => new Date(a.fechaCreacion || a.fecha || 0) - new Date(b.fechaCreacion || b.fecha || 0));

  ticketsOrdenados.forEach(t => {
    if (!t.equipo || t.equipo === 'Otra / No registrada') return;
    if (!t.sitio || t.sitio === 'Ninguno' || t.sitio.toLowerCase() === 'n/a') return;

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

    // Buscar en clientesDb (máquinas manuales)
    clientesDb.forEach(c => {
      if (c.maquinas) {
        c.maquinas.forEach(m => {
          if (matchMaquina(m)) {
            const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
            if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
              console.log(`[Migración] Asignando ubicación '${t.sitio}' a máquina manual ${m.idInterno} del cliente ${c.nombre} según ticket ${t.folio}`);
              m.ubicacion = t.sitio;
              
              // Resolver sitio_id
              let sitioId = m.sitio_id || null;
              const existSitio = sitiosDb.find(s => (s.cliente === c.id || s.cliente === c.nombre) && s.nombre === t.sitio);
              if (existSitio) sitioId = existSitio.id;
              m.sitio_id = sitioId;
              
              modificadosClientesDb = true;
              syncCount++;
            }
          }
        });
      }
    });

    // Buscar en maquinariaDb (máquinas de SAP/Supabase)
    maquinariaDb.forEach(m => {
      if (matchMaquina(m)) {
        const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
        if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
          console.log(`[Migración] Asignando ubicación '${t.sitio}' a máquina SAP ${m.idInterno || m.id} según ticket ${t.folio}`);
          m.ubicacion = t.sitio;
          
          // Resolver sitio_id
          let clientObj = clientesDb.find(c => c.nombre === m.cliente || c.id === m.cliente);
          let clientDbId = clientObj ? clientObj.id : m.cliente;
          let sitioId = m.sitio_id || null;
          const existSitio = sitiosDb.find(s => (s.cliente === clientDbId || s.cliente === m.cliente) && s.nombre === t.sitio);
          if (existSitio) sitioId = existSitio.id;
          m.sitio_id = sitioId;
          
          if (!m.customData) m.customData = {};
          m.customData.ubicacion = t.sitio;
          
          modificadosMaquinariaDb = true;
          syncCount++;
        }
      }
    });
  });

  if (modificadosClientesDb) {
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }
  if (modificadosMaquinariaDb) {
    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
  }
  if (syncCount > 0) {
    console.log(`[Migración] Se corrigieron las ubicaciones de ${syncCount} máquinas y se enviaron a sincronización.`);
  }
};

window.recuperarMaquinariaDesdeTickets = function() {
  console.log('[App] Ejecutando recuperación de maquinaria desaparecida desde tickets...');
  let modificadosClientesDb = false;
  let recoverCount = 0;

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  tickets.forEach(t => {
    if (!t.equipo || t.equipo === 'Otra / No registrada' || t.equipo.toLowerCase() === 'n/a') return;
    if (!t.cliente || t.cliente === 'Ninguno / Uso Interno' || t.cliente === 'Ninguno') return;

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

    // 1. Verificar si la máquina ya existe en clientesDb
    let maqExiste = false;
    clientesDb.forEach(c => {
      if (c.maquinas && c.maquinas.some(matchMaquina)) maqExiste = true;
    });

    // 2. Verificar en maquinariaDb
    if (maquinariaDb.some(matchMaquina)) maqExiste = true;

    // 3. Si no existe en ningún lado, la recreamos
    if (!maqExiste) {
      console.log(`[Recuperación] Recreando máquina desaparecida '${t.equipo}' para el cliente '${t.cliente}'`);
      
      let idInterno = null;
      let marca = 'OTM';
      let modelo = 'Sin Modelo';
      let serie = 'N/A';

      let equipoStr = t.equipo.trim();
      if (equipoStr.includes('(SN: ')) {
        const parts = equipoStr.split('(SN: ');
        serie = parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          const idIndex = left.indexOf(']');
          idInterno = left.substring(1, idIndex).trim();
          left = left.substring(idIndex + 1).trim();
        }
        
        let foundMarcaKey = null;
        for (const [key, value] of Object.entries(MARCAS_RENDER)) {
          if (left.toUpperCase().startsWith(value.toUpperCase())) {
            foundMarcaKey = key;
            modelo = left.substring(value.length).trim();
            break;
          }
          if (left.toUpperCase().startsWith(key.toUpperCase())) {
            foundMarcaKey = key;
            modelo = left.substring(key.length).trim();
            break;
          }
        }
        
        if (foundMarcaKey) {
          marca = foundMarcaKey;
        } else {
          const words = left.split(' ');
          if (words.length > 0) {
            marca = words[0];
            modelo = words.slice(1).join(' ') || 'Sin Modelo';
          }
        }
      } else {
        modelo = equipoStr;
      }

      // Encontrar o crear clienteObj en clientesDb
      let clienteObj = clientesDb.find(c => c.nombre === t.cliente);
      if (!clienteObj) {
        clienteObj = {
          id: crypto.randomUUID(),
          nombre: t.cliente,
          maquinas: [],
          sitios: [],
          createdAt: new Date().toISOString()
        };
        clientesDb.push(clienteObj);
        modificadosClientesDb = true;
      }

      if (!clienteObj.maquinas) {
        clienteObj.maquinas = [];
      }

      const nuevaMaq = {
        idInterno: idInterno || generarIdInternoMaquina(marca, ''),
        id: crypto.randomUUID(),
        marca,
        modelo,
        serie,
        ubicacion: t.sitio || 'N/A',
        sitio_id: null,
        latitud: null,
        longitud: null,
        tipo: 'N/A',
        customData: {
          tipo: 'N/A',
          numeroEconomico: 'N/A',
          numeroMotor: 'N/A',
          venta: '',
          ubicacion: t.sitio || 'N/A'
        }
      };

      // Resolver sitio_id
      if (t.sitio && t.sitio !== 'Ninguno') {
        const existSitio = sitiosDb.find(s => (s.cliente === clienteObj.id || s.cliente === clienteObj.nombre) && s.nombre === t.sitio);
        if (existSitio) nuevaMaq.sitio_id = existSitio.id;
      }

      clienteObj.maquinas.push(nuevaMaq);
      modificadosClientesDb = true;
      recoverCount++;

      // Sincronizar nueva máquina con Supabase
      if (window.pushToSupabase) {
        window.pushToSupabase('maquinaria', { ...nuevaMaq, cliente: clienteObj.id });
      }
    }
  });

  if (modificadosClientesDb) {
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }
  if (recoverCount > 0) {
    console.log(`[Recuperación] Se recuperaron con éxito ${recoverCount} máquinas desaparecidas desde los tickets.`);
  }
};

// Función para reintentar sincronizar gastos locales que no han subido a Supabase
window.reintentarSincronizacionGastosLocales = function() {
  console.log('[App] Verificando gastos locales pendientes de sincronización...');
  const localGastos = safeGetJSON('sapi_gastos', []);
  let encolados = 0;
  localGastos.forEach(g => {
    if (g && g._synced !== true) {
      // Evitar reintentar sincronizar gastos de prueba/mock
      if (g.esPrueba === true || g.isTest === true || g.id === 'gasto_seed_1') {
        return;
      }
      console.log('[Sync] Re-sincronizando gasto local:', g.id);
      if (window.pushToSupabase) {
        window.pushToSupabase('gastos', g);
        encolados++;
      }
    }
  });
  if (encolados > 0) {
    console.log(`[App] Se re-encolaron ${encolados} gastos locales para subida.`);
  }
};

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

function cargarConfig() {
  // Las opciones de query se cargarán de forma asíncrona pero las pedimos primero si estamos en configuración.
  // Sin embargo, si abrimos la configuración manual, las volvemos a cargar.
  
  if (configData.empresa) document.getElementById('cfg-empresa').value = configData.empresa;
  if (configData.rfc) document.getElementById('cfg-rfc').value = configData.rfc;
  if (configData.tel) document.getElementById('cfg-tel').value = configData.tel;
  if (configData.email) document.getElementById('cfg-email').value = configData.email;
  if (configData.direccion) document.getElementById('cfg-direccion').value = configData.direccion;
  if (configData.queryMaquinaria) document.getElementById('cfg-query-maquinaria').value = configData.queryMaquinaria;
  if (configData.querySitios) document.getElementById('cfg-query-sitios').value = configData.querySitios;
  if (configData.queryOrdenes) document.getElementById('cfg-query-ordenes').value = configData.queryOrdenes;

  if (configData.queryRefacciones) document.getElementById('cfg-query-refacciones').value = configData.queryRefacciones;


  const dmToggle = document.getElementById('cfg-darkmode');
  if (dmToggle) {
    dmToggle.checked = localStorage.getItem('eurorep_darkmode') !== 'false';
    dmToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.remove('light-mode');
        localStorage.setItem('eurorep_darkmode', 'true');
      } else {
        document.body.classList.add('light-mode');
        localStorage.setItem('eurorep_darkmode', 'false');
      }
    });
  }

  // Cargar configuración de OneDrive
  const odClientId = configData.onedriveClientId || 'MOCK';
  const odForceMock = configData.onedriveForceMock !== false;
  const odFolderId = configData.onedriveFolderId || '';
  const odFolderConciliadosId = configData.onedriveFolderConciliadosId || '';
  
  const inputOdClientId = document.getElementById('cfg-onedrive-client-id');
  const inputOdForceMock = document.getElementById('cfg-onedrive-force-mock');
  const inputOdFolderId = document.getElementById('cfg-onedrive-folder-id');
  const inputOdFolderConciliadosId = document.getElementById('cfg-onedrive-folder-conciliados-id');
  
  if (inputOdClientId) inputOdClientId.value = odClientId;
  if (inputOdFolderId) inputOdFolderId.value = odFolderId;
  if (inputOdFolderConciliadosId) inputOdFolderConciliadosId.value = odFolderConciliadosId;
  if (inputOdForceMock) {
    inputOdForceMock.checked = odForceMock;
    setTimeout(() => { window.toggleOneDriveDemoMode(); }, 0);
  }
  
  if (typeof renderIdeasFallas === 'function') {
    renderIdeasFallas();
  }
}

// ─── IDEAS Y FALLAS MODULE ──────────────────────────────────────────────────
let editandoIdeaFallaId = null;
let ifArchivosAdjuntosTemp = [];

function renderIfArchivosPreview() {
  const container = document.getElementById('if-archivos-preview');
  if (!container) return;
  if (ifArchivosAdjuntosTemp.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = ifArchivosAdjuntosTemp.map((arch, idx) => {
    const isImg = arch.tipo && arch.tipo.startsWith('image/');
    return `
      <div style="display:flex; align-items:center; gap:0.4rem; background:var(--bg-card); border:1px solid var(--border); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.75rem; max-width:220px; box-shadow:var(--shadow-sm);">
        ${isImg 
          ? `<img src="${arch.url}" style="width:26px; height:26px; object-fit:cover; border-radius:4px;" />` 
          : `<i data-lucide="file-text" style="width:20px; height:20px; color:var(--accent);"></i>`
        }
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;" title="${arch.nombre}">${arch.nombre}</span>
        <button type="button" onclick="window.eliminarIfArchivoTemp(${idx})" style="background:none; border:none; color:var(--red); cursor:pointer; font-weight:bold; font-size:0.9rem; padding:0 2px;">✕</button>
      </div>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}
window.renderIfArchivosPreview = renderIfArchivosPreview;

window.eliminarIfArchivoTemp = function(idx) {
  if (idx > -1 && idx < ifArchivosAdjuntosTemp.length) {
    ifArchivosAdjuntosTemp.splice(idx, 1);
    renderIfArchivosPreview();
  }
};

window.handleIfFilesSelect = function(e) {
  const files = Array.from(e.target.files || []);
  procesarFilesIf(files);
  e.target.value = '';
};

window.handleIfFilesDrop = function(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files || []);
  procesarFilesIf(files);
};

function procesarFilesIf(files) {
  files.forEach(file => {
    if (file.size > 8 * 1024 * 1024) {
      alert(`El archivo "${file.name}" supera el límite recomendado de 8MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      ifArchivosAdjuntosTemp.push({
        nombre: file.name,
        tipo: file.type,
        url: evt.target.result,
        fecha: new Date().toISOString()
      });
      renderIfArchivosPreview();
    };
    reader.readAsDataURL(file);
  });
}
    window.toggleIfResolucionInput = function() {
  const estadoVal = document.getElementById('if-estado')?.value;
  const resContainer = document.getElementById('if-resolucion-container');
  if (resContainer) {
    resContainer.style.display = (estadoVal === 'Resuelto') ? 'block' : 'none';
  }
};

window.abrirModalResolucionIdeaFalla = function(id) {
  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  const inputId = document.getElementById('if-res-id');
  const inputExp = document.getElementById('if-res-explicacion');
  if (inputId) inputId.value = id;
  if (inputExp) inputExp.value = item.resolucion || '';

  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();
};

window.cerrarModalResolucionIdeaFalla = function(e) {
  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (e && e.target !== modalOverlay) return;
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  renderIdeasFallas();
};

window.guardarResolucionIdeaFalla = async function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('if-res-id')?.value;
  const explicacion = document.getElementById('if-res-explicacion')?.value || '';

  if (!id) return;
  if (!explicacion.trim()) {
    alert('Por favor escribe la explicación o conclusión de la solución.');
    return;
  }

  const idx = ideasFallasDb.findIndex(x => x.id === id);
  if (idx === -1) return;

  const user = usuarios.find(u => u.id === currentSession?.userId);
  const userNombre = user ? user.nombre : (currentSession?.nombre || 'Superadmin');

  ideasFallasDb[idx] = {
    ...ideasFallasDb[idx],
    estado: 'Resuelto',
    resolucion: explicacion.trim(),
    resuelto_por: userNombre,
    fecha_resolucion: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const item = ideasFallasDb[idx];
  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  
  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';

  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro marcado como Resuelto con conclusión.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al guardar resolución en Supabase:', err);
    }
  }
};

function puedeEditarIdeaFalla(item) {
  if (!item) return false;
  if (!currentSession) return false;
  
  // Superadmin en la vista activa tiene permisos completos de edición
  if (currentSession.viewMode === 'superadmin') return true;
  
  const currentUserId = currentSession.userId;
  const user = usuarios.find(u => u.id === currentUserId);
  const currentUserName = (user ? user.nombre : (currentSession.nombre || '')).trim().toLowerCase();
  
  // 1. Comparar por ID de usuario creador
  if (item.creado_por_id && currentUserId && String(item.creado_por_id) === String(currentUserId)) {
    return true;
  }
  
  // 2. Comparar por nombre de usuario creador (para compatibilidad)
  const itemAuthorName = (item.creado_por || '').trim().toLowerCase();
  if (currentUserName && itemAuthorName && currentUserName === itemAuthorName) {
    return true;
  }
  
  return false;
}

function abrirModalIdeaFalla(id = null) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  
  if (id) {
    const item = ideasFallasDb.find(x => x.id === id);
    if (!item) return;
    if (!puedeEditarIdeaFalla(item)) {
      alert('Acceso denegado: Solo puedes editar los registros de ideas o fallas creados por ti.');
      return;
    }
  }

  editandoIdeaFallaId = id || null;
  const modalTitle = document.getElementById('idea-falla-modal-title');
  const formEl = document.getElementById('form-idea-falla');
  const estadoContainer = document.getElementById('if-estado-container');

  if (formEl) formEl.reset();

  if (id) {
    if (modalTitle) modalTitle.textContent = 'Editar Registro';
    if (estadoContainer) estadoContainer.style.display = isSuperadmin ? 'block' : 'none';

    const item = ideasFallasDb.find(x => x.id === id);
    if (item) {
      const radio = document.querySelector(`input[name="if-tipo"][value="${item.tipo}"]`);
      if (radio) radio.checked = true;
      
      const tituloInput = document.getElementById('if-titulo');
      if (tituloInput) tituloInput.value = item.titulo || '';

      const descTextarea = document.getElementById('if-descripcion');
      if (descTextarea) descTextarea.value = item.descripcion || '';

      const moduloSelect = document.getElementById('if-modulo');
      if (moduloSelect) moduloSelect.value = item.modulo || 'General';

      const prioridadSelect = document.getElementById('if-prioridad');
      if (prioridadSelect) prioridadSelect.value = item.prioridad || 'Media';

      const estadoSelect = document.getElementById('if-estado');
      if (estadoSelect) estadoSelect.value = item.estado || 'Pendiente';

      const resolucionTextarea = document.getElementById('if-resolucion');
      if (resolucionTextarea) resolucionTextarea.value = item.resolucion || '';

      ifArchivosAdjuntosTemp = item.archivos ? JSON.parse(JSON.stringify(item.archivos)) : [];
      window.toggleIfResolucionInput();
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Reportar Idea / Falla';
    if (estadoContainer) estadoContainer.style.display = 'none';
    const moduloSelect = document.getElementById('if-modulo');
    if (moduloSelect) moduloSelect.value = 'General';
    ifArchivosAdjuntosTemp = [];
    window.toggleIfResolucionInput();
  }

  renderIfArchivosPreview();

  const modalOverlay = document.getElementById('modal-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function cerrarModalIdeaFalla(e) {
  const modalOverlay = document.getElementById('modal-idea-falla-overlay');
  if (e && e.target !== modalOverlay) return;
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  editandoIdeaFallaId = null;
  ifArchivosAdjuntosTemp = [];
}

async function guardarIdeaFalla(e) {
  if (e) e.preventDefault();

  const tipo = document.querySelector('input[name="if-tipo"]:checked')?.value || 'Idea';
  const titulo = document.getElementById('if-titulo')?.value || '';
  const descripcion = document.getElementById('if-descripcion')?.value || '';
  const modulo = document.getElementById('if-modulo')?.value || 'General';
  const prioridad = document.getElementById('if-prioridad')?.value || 'Media';
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');

  if (!titulo.trim()) {
    alert('Por favor introduce un título válido.');
    return;
  }

  const user = usuarios.find(u => u.id === currentSession.userId);
  const userNombre = user ? user.nombre : (currentSession.nombre || 'Usuario');

  let item;
  if (editandoIdeaFallaId) {
    const idx = ideasFallasDb.findIndex(x => x.id === editandoIdeaFallaId);
    if (idx > -1) {
      const existingItem = ideasFallasDb[idx];
      if (!puedeEditarIdeaFalla(existingItem)) {
        alert('Acceso denegado: Solo puedes editar los registros creados por ti.');
        return;
      }

      const nuevoEstado = isSuperadmin && document.getElementById('if-estado')
        ? (document.getElementById('if-estado').value || existingItem.estado || 'Pendiente')
        : (existingItem.estado || 'Pendiente');

      const resolucionText = document.getElementById('if-resolucion')?.value || '';
      let resueltoPor = existingItem.resuelto_por;
      let fechaResolucion = existingItem.fecha_resolucion;

      if (nuevoEstado === 'Resuelto' && (!existingItem.estado || existingItem.estado !== 'Resuelto' || !fechaResolucion)) {
        resueltoPor = userNombre;
        fechaResolucion = new Date().toISOString();
      }

      ideasFallasDb[idx] = {
        ...existingItem,
        tipo,
        modulo,
        titulo,
        descripcion,
        archivos: [...ifArchivosAdjuntosTemp],
        prioridad,
        estado: nuevoEstado,
        resolucion: resolucionText.trim(),
        resuelto_por: resueltoPor,
        fecha_resolucion: fechaResolucion,
        updated_at: new Date().toISOString()
      };
      item = ideasFallasDb[idx];
    }
  } else {
    item = {
      id: 'IF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      tipo,
      modulo,
      titulo,
      descripcion,
      archivos: [...ifArchivosAdjuntosTemp],
      prioridad,
      estado: 'Pendiente',
      creado_por: userNombre,
      creado_por_id: currentSession.userId || currentSession.realUserId,
      orden: ideasFallasDb.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    ideasFallasDb.push(item);
  }

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();
  cerrarModalIdeaFalla();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro guardado y sincronizado con éxito.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al sincronizar con Supabase:', err);
    }
  }
}

async function cambiarEstadoIdeaFalla(id, nuevoEstado) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) {
    alert('Acceso denegado: Solo los superadministradores pueden cambiar el estado de una idea o falla.');
    renderIdeasFallas();
    return;
  }

  if (nuevoEstado === 'Resuelto') {
    window.abrirModalResolucionIdeaFalla(id);
    return;
  }

  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  item.estado = nuevoEstado;
  item.updated_at = new Date().toISOString();

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Estado actualizado y sincronizado.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al cambiar estado en Supabase:', err);
    }
  }
}

async function eliminarIdeaFalla(id) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) {
    alert('Acceso denegado: Solo los superadministradores pueden eliminar registros de ideas y fallas.');
    return;
  }

  if (!confirm('¿Estás seguro de que deseas eliminar este registro de Ideas/Fallas?')) {
    return;
  }

  const idx = ideasFallasDb.findIndex(x => x.id === id);
  if (idx > -1) {
    ideasFallasDb.splice(idx, 1);
  }

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.deleteFromSupabase) {
    try {
      await window.deleteFromSupabase('ideas_fallas', id);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro eliminado de la base de datos.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al eliminar de Supabase:', err);
    }
  }
}

window.filtrarIdeaFallaPorKpi = function(tipo, val) {
  const elTipo = document.getElementById('filtro-tipo-idea-falla');
  const elEstado = document.getElementById('filtro-estado-idea-falla');

  if (tipo === 'tipo') {
    if (elTipo) {
      elTipo.value = (elTipo.value === val) ? 'todos' : val;
    }
    if (elEstado) elEstado.value = 'pendientes_en_curso';
  } else if (tipo === 'estado') {
    if (elEstado) {
      elEstado.value = (elEstado.value === val) ? 'pendientes_en_curso' : val;
    }
    if (elTipo) elTipo.value = 'todos';
  }
  
  renderIdeasFallas();
};

function renderIdeasFallas() {
  const tbody = document.getElementById('tabla-ideas-fallas-body');
  if (!tbody) return;

  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');

  // Actualizar recuadros KPI
  const ideasCount = ideasFallasDb.filter(x => x.tipo === 'Idea' && x.estado !== 'Resuelto' && x.estado !== 'Rechazado').length;
  const fallasCount = ideasFallasDb.filter(x => x.tipo === 'Falla' && x.estado !== 'Resuelto' && x.estado !== 'Rechazado').length;
  const pendientesCount = ideasFallasDb.filter(x => ['Pendiente', 'En Análisis', 'En Desarrollo', 'En Pruebas', 'En Progreso'].includes(x.estado || 'Pendiente')).length;
  const completadosCount = ideasFallasDb.filter(x => x.estado === 'Resuelto').length;

  const kpiIdeas = document.getElementById('kpi-if-ideas');
  if (kpiIdeas) kpiIdeas.textContent = ideasCount;

  const kpiFallas = document.getElementById('kpi-if-fallas');
  if (kpiFallas) kpiFallas.textContent = fallasCount;

  const kpiPendientes = document.getElementById('kpi-if-pendientes');
  if (kpiPendientes) kpiPendientes.textContent = pendientesCount;

  const kpiCompletados = document.getElementById('kpi-if-completados');
  if (kpiCompletados) kpiCompletados.textContent = completadosCount;

  const query = (document.getElementById('busqueda-idea-falla')?.value || '').toLowerCase().trim();
  const filtroModulo = document.getElementById('filtro-modulo-idea-falla')?.value || 'todos';
  const filtroTipo = document.getElementById('filtro-tipo-idea-falla')?.value || 'todos';
  const filtroPrioridad = document.getElementById('filtro-prioridad-idea-falla')?.value || 'todos';
  const filtroEstado = document.getElementById('filtro-estado-idea-falla')?.value || 'pendientes_en_curso';

  // Resaltado visual del recuadro KPI activo
  const cardIdeas = document.getElementById('card-kpi-if-ideas');
  const cardFallas = document.getElementById('card-kpi-if-fallas');
  const cardPendientes = document.getElementById('card-kpi-if-pendientes');
  const cardCompletados = document.getElementById('card-kpi-if-completados');

  [cardIdeas, cardFallas, cardPendientes, cardCompletados].forEach(c => {
    if (c) {
      c.style.borderColor = 'var(--border)';
      c.style.boxShadow = 'var(--shadow-sm)';
      c.style.transform = 'none';
    }
  });

  if (filtroTipo === 'Idea' && cardIdeas) {
    cardIdeas.style.borderColor = '#10b981';
    cardIdeas.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
    cardIdeas.style.transform = 'translateY(-2px)';
  } else if (filtroTipo === 'Falla' && cardFallas) {
    cardFallas.style.borderColor = '#ef4444';
    cardFallas.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
    cardFallas.style.transform = 'translateY(-2px)';
  } else if (filtroEstado === 'pendientes_en_curso' && cardPendientes) {
    cardPendientes.style.borderColor = '#f59e0b';
    cardPendientes.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.25)';
    cardPendientes.style.transform = 'translateY(-2px)';
  } else if (filtroEstado === 'Resuelto' && cardCompletados) {
    cardCompletados.style.borderColor = '#10b981';
    cardCompletados.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
    cardCompletados.style.transform = 'translateY(-2px)';
  }

  const filtrados = ideasFallasDb.filter(item => {
    const matchQuery = !query || 
      (item.titulo || '').toLowerCase().includes(query) || 
      (item.descripcion || '').toLowerCase().includes(query);

    const matchModulo = filtroModulo === 'todos' || (item.modulo || 'General') === filtroModulo;
    const matchTipo = filtroTipo === 'todos' || item.tipo === filtroTipo;
    const matchPrioridad = filtroPrioridad === 'todos' || item.prioridad === filtroPrioridad;

    let matchEstado = true;
    if (filtroEstado === 'pendientes_en_curso') {
      matchEstado = ['Pendiente', 'En Análisis', 'En Desarrollo', 'En Pruebas', 'En Progreso'].includes(item.estado || 'Pendiente');
    } else if (filtroEstado !== 'todos') {
      matchEstado = item.estado === filtroEstado;
    } else if (filtroTipo === 'Idea' || filtroTipo === 'Falla') {
      // Excluir automáticamente las resueltas y rechazadas al ver el catálogo activo de Ideas o Fallas
      matchEstado = item.estado !== 'Resuelto' && item.estado !== 'Rechazado';
    }

    return matchQuery && matchModulo && matchTipo && matchPrioridad && matchEstado;
  });

  // Ordenar por orden de priorización (campo orden) y luego por fecha descendente
  filtrados.sort((a, b) => {
    const ordenA = a.orden !== undefined ? a.orden : 999999;
    const ordenB = b.orden !== undefined ? b.orden : 999999;
    if (ordenA !== ordenB) {
      return ordenA - ordenB;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.88rem;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
            <i data-lucide="inbox" style="width:28px; height:28px; opacity:0.4;"></i>
            <span>No se encontraron registros de Ideas y Fallas.</span>
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  const MODULE_CONFIG = {
    'Tickets': { label: 'Tickets', color: '#4f8ef7', bg: 'rgba(79, 142, 247, 0.1)' },
    'Levantamientos': { label: 'Levantamientos', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    'Órdenes': { label: 'Órdenes', color: '#E8820C', bg: 'rgba(232, 130, 12, 0.1)' },
    'Clientes': { label: 'Clientes / SAP', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Gastos': { label: 'Gastos / Clara', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
    'Portal': { label: 'Portal Clientes', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    'Calendario': { label: 'Calendario', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'UI': { label: 'UI / Interfaz', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    'General': { label: 'General', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
  };

  tbody.innerHTML = filtrados.map((item, idx) => {
    const canEdit = puedeEditarIdeaFalla(item);

    // Tag para Módulo
    const modKey = item.modulo || 'General';
    const modCfg = MODULE_CONFIG[modKey] || MODULE_CONFIG['General'];

    // Badge de estado / etapa
    let badgeStyle = 'background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3);'; // Pendiente
    if (item.estado === 'En Análisis') {
      badgeStyle = 'background: rgba(168, 85, 247, 0.1); color: #9333ea; border: 1px solid rgba(168, 85, 247, 0.3);';
    } else if (item.estado === 'En Desarrollo' || item.estado === 'En Progreso') {
      badgeStyle = 'background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3);';
    } else if (item.estado === 'En Pruebas') {
      badgeStyle = 'background: rgba(6, 182, 212, 0.1); color: #0891b2; border: 1px solid rgba(6, 182, 212, 0.3);';
    } else if (item.estado === 'Resuelto') {
      badgeStyle = 'background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);';
    } else if (item.estado === 'Rechazado') {
      badgeStyle = 'background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);';
    }

    // Prioridad del elemento y estilo
    const prioVal = item.prioridad || 'Media';
    let prioStyle = 'background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25);';
    if (prioVal === 'Baja') {
      prioStyle = 'background: rgba(100, 116, 139, 0.08); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.25);';
    } else if (prioVal === 'Alta') {
      prioStyle = 'background: rgba(245, 158, 11, 0.08); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25);';
    } else if (prioVal === 'Crítica') {
      prioStyle = 'background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 700;';
    }

    // Formatear fecha
    const fecha = item.created_at ? new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    const archivosHTML = (item.archivos && item.archivos.length > 0) ? `
      <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem;">
        ${item.archivos.map(arch => {
          const isImg = arch.tipo && arch.tipo.startsWith('image/');
          return `
            <a href="${arch.url}" target="_blank" download="${arch.nombre}" onclick="event.stopPropagation();" 
               style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--bg-secondary); border:1px solid var(--border); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.72rem; color:var(--accent); text-decoration:none; font-weight:600; transition:all 0.15s;"
               onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
              ${isImg ? `<i data-lucide="image" style="width:12px; height:12px;"></i>` : `<i data-lucide="paperclip" style="width:12px; height:12px;"></i>`}
              <span style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${arch.nombre}</span>
            </a>
          `;
        }).join('')}
      </div>
    ` : '';

    const fechaRes = item.fecha_resolucion ? `• ${new Date(item.fecha_resolucion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}` : '';
    const resolucionHTML = (item.resolucion && (item.estado === 'Resuelto' || item.resolucion.trim().length > 0)) ? `
      <div style="margin-top:0.45rem; background:rgba(16, 185, 129, 0.06); border:1px solid rgba(16, 185, 129, 0.2); border-left:3px solid #10b981; padding:0.45rem 0.65rem; border-radius:6px; font-size:0.78rem; word-break:break-word;">
        <div style="font-weight:700; color:#10b981; display:flex; align-items:center; gap:0.3rem; margin-bottom:0.15rem;">
          <i data-lucide="check-circle-2" style="width:13px; height:13px;"></i>
          <span>Solución:</span>
        </div>
        <div style="color:var(--text-primary); white-space:pre-wrap; font-size:0.78rem; line-height:1.4;">${item.resolucion}</div>
        ${item.resuelto_por ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Resuelto por <b>${item.resuelto_por}</b> ${fechaRes}</div>` : ''}
      </div>
    ` : '';

    const dragAttrs = isSuperadmin 
      ? `draggable="true" 
         ondragstart="window.handleDragStart(event, '${item.id}')" 
         ondragover="window.handleDragOver(event)" 
         ondragenter="window.handleDragEnter(event, this)" 
         ondragleave="window.handleDragLeave(event, this)" 
         ondrop="window.handleDrop(event, '${item.id}')" 
         style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s; cursor: grab;"`
      : `style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s;"`;

    return `
      <tr ${dragAttrs}
          class="idea-falla-row"
          onmouseover="this.style.backgroundColor='var(--bg-hover, #f8fafc)'" 
          onmouseout="this.style.backgroundColor='transparent'">
        <td style="text-align: center; vertical-align: middle; padding: 0.75rem 0.5rem;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.78rem; background: var(--bg-hover, #e2e8f0); padding: 0.15rem 0.45rem; border-radius: 4px; min-width: 22px; text-align: center;">${idx + 1}</span>
            ${isSuperadmin ? '<i data-lucide="grip-vertical" style="width: 14px; height: 14px; color: var(--text-muted); opacity: 0.65; cursor: grab;"></i>' : ''}
          </div>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle;">
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem;">
            ${item.tipo === 'Idea' 
              ? `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:5px; font-size:0.73rem; font-weight:700; background:rgba(16, 185, 129, 0.1); color:#10b981; border: 1px solid rgba(16, 185, 129, 0.25);"><i data-lucide="sparkles" style="width:12px; height:12px;"></i> Idea</span>`
              : `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:5px; font-size:0.73rem; font-weight:700; background:rgba(239, 68, 68, 0.1); color:#ef4444; border: 1px solid rgba(239, 68, 68, 0.25);"><i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> Falla</span>`
            }
            <div style="display:inline-flex; align-items:center; gap:0.3rem; font-size:0.72rem; font-weight:600; color:var(--text-secondary); background:var(--bg-secondary); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid var(--border); white-space:nowrap;">
              <i data-lucide="layers" style="width:11px; height:11px; opacity:0.7; flex-shrink:0;"></i>
              <span>${modCfg.label}</span>
            </div>
          </div>
        </td>
        <td style="padding: 0.75rem 1rem; vertical-align: middle; word-break: break-word;">
          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem; line-height: 1.35; margin-bottom: 0.2rem;">${item.titulo || ''}</div>
          ${item.descripcion ? `<div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin-top: 0.25rem; word-break: break-word;">${item.descripcion}</div>` : ''}
          ${archivosHTML}
          ${resolucionHTML}
        </td>
        <td style="padding: 0.75rem 0.5rem; vertical-align: middle; text-align: center;">
          <select ${canEdit ? '' : 'disabled'} style="font-size: 0.76rem; font-weight: 600; padding: 0.32rem 0.6rem; border-radius: 6px; outline: none; ${canEdit ? 'cursor: pointer;' : 'cursor: default; opacity: 0.9;'} ${prioStyle} text-align: center; transition: all 0.15s;"
            onchange="cambiarPrioridadIdeaFalla('${item.id}', this.value)">
            <option value="Baja" ${prioVal === 'Baja' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Baja</option>
            <option value="Media" ${prioVal === 'Media' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Media</option>
            <option value="Alta" ${prioVal === 'Alta' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Alta</option>
            <option value="Crítica" ${prioVal === 'Crítica' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Crítica</option>
          </select>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle;">
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;" title="${item.creado_por || 'Sistema'}">
              <i data-lucide="user" style="width: 12px; height: 12px; opacity: 0.65; color: var(--text-muted); flex-shrink:0;"></i>
              <span>${item.creado_por || 'Sistema'}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;">
              <i data-lucide="calendar" style="width: 11px; height: 11px; opacity: 0.65; color: var(--text-muted); flex-shrink:0;"></i>
              <span>${fecha}</span>
            </div>
          </div>
        </td>
        <td style="padding: 0.75rem 0.5rem; vertical-align: middle; text-align: center;">
          <select ${isSuperadmin ? '' : 'disabled'} onchange="cambiarEstadoIdeaFalla('${item.id}', this.value)" 
                  style="font-size: 0.74rem; font-weight: 700; padding: 0.32rem 0.7rem; border-radius: 20px; outline: none; ${isSuperadmin ? 'cursor: pointer;' : 'cursor: default; opacity: 0.95;'} text-align: center; ${badgeStyle} transition: all 0.2s;">
            <option value="Pendiente" ${item.estado === 'Pendiente' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Pendiente</option>
            <option value="En Análisis" ${item.estado === 'En Análisis' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Análisis</option>
            <option value="En Desarrollo" ${(item.estado === 'En Desarrollo' || item.estado === 'En Progreso') ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Desarrollo</option>
            <option value="En Pruebas" ${item.estado === 'En Pruebas' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Pruebas</option>
            <option value="Resuelto" ${item.estado === 'Resuelto' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Resuelto</option>
            <option value="Rechazado" ${item.estado === 'Rechazado' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Rechazado</option>
          </select>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle; text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 0.35rem; align-items: center; justify-content: flex-end;">
            ${canEdit ? `
              <button class="action-btn" title="Editar" onclick="abrirModalIdeaFalla('${item.id}')"
                style="padding: 0.35rem 0.45rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;"
                onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)';"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-secondary)';">
                <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
              </button>
            ` : ''}
            ${isSuperadmin ? `
              <button class="action-btn del" title="Eliminar" onclick="eliminarIdeaFalla('${item.id}')"
                style="padding: 0.35rem 0.45rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--red, #ef4444); display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;"
                onmouseover="this.style.background='rgba(239, 68, 68, 0.1)';"
                onmouseout="this.style.background='var(--bg-secondary)';">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            ` : ''}
            ${!canEdit && !isSuperadmin ? `
              <span style="color: var(--text-muted); font-size: 0.72rem; font-style: italic; padding: 0.2rem 0.4rem;">Solo lectura</span>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

async function cambiarPrioridadIdeaFalla(id, nuevaPrioridad) {
  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  if (!puedeEditarIdeaFalla(item)) {
    alert('Acceso denegado: Solo puedes modificar la prioridad de tus propios registros.');
    renderIdeasFallas();
    return;
  }

  item.prioridad = nuevaPrioridad;
  item.updated_at = new Date().toISOString();

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Prioridad actualizada y sincronizada.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al cambiar prioridad en Supabase:', err);
    }
  }
}

// --- Drag & Drop Prioritization ---
let draggedId = null;

window.handleDragStart = function(e, id) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  draggedId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
};

window.handleDragOver = function(e) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return false;
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
};

window.handleDragEnter = function(e, row) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  row.style.borderTop = '2px solid var(--accent)';
};

window.handleDragLeave = function(e, row) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  row.style.borderTop = '';
};

window.handleDrop = async function(e, targetId) {
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;

  e.stopPropagation();
  e.preventDefault();
  
  const row = e.currentTarget;
  if (row) row.style.borderTop = '';
  
  if (draggedId === targetId) return;
  
  const dragIdx = ideasFallasDb.findIndex(x => x.id === draggedId);
  const targetIdx = ideasFallasDb.findIndex(x => x.id === targetId);
  
  if (dragIdx === -1 || targetIdx === -1) return;
  
  const temp = ideasFallasDb[dragIdx];
  ideasFallasDb.splice(dragIdx, 1);
  ideasFallasDb.splice(targetIdx, 0, temp);
  
  // Recalculate order indices
  ideasFallasDb.forEach((item, idx) => {
    item.orden = idx;
  });
  
  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();
  
  if (window.pushToSupabase) {
    try {
      for (const item of ideasFallasDb) {
        await window.pushToSupabase('ideas_fallas', item);
      }
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Orden de priorización actualizado y sincronizado en la nube.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al sincronizar nuevo orden con Supabase:', err);
    }
  }
};

// Exponer funciones al objeto global window para que funcionen los onclicks del HTML
window.puedeEditarIdeaFalla = puedeEditarIdeaFalla;
window.abrirModalIdeaFalla = abrirModalIdeaFalla;
window.cerrarModalIdeaFalla = cerrarModalIdeaFalla;
window.guardarIdeaFalla = guardarIdeaFalla;
window.cambiarEstadoIdeaFalla = cambiarEstadoIdeaFalla;
window.cambiarPrioridadIdeaFalla = cambiarPrioridadIdeaFalla;
window.eliminarIdeaFalla = eliminarIdeaFalla;
window.renderIdeasFallas = renderIdeasFallas;

// ── Sync SAP vía GitHub Actions (funciona desde cualquier dispositivo) ────────
// El workflow corre en servidores de GitHub (Azure) que SÍ pueden llegar a SAP.
// El token se guarda en localStorage del superadmin y se comparte en Supabase config.
const GH_REPO = 'lbesoy/sapi-postventa';
const GH_WORKFLOW = 'sync-sap.yml';

async function sincronizarConGitHub(modulo = 'all', btnEl = null) {
  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { 
    btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Conectando SAP...'; 
    btnEl.disabled = true;
    lucide.createIcons(); 
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Sapi-Client-Token': 'SapiSecuredClientToken'
    };
    
    if (window.supabaseClient) {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const triggerTime = new Date().getTime();

    const resp = await fetch('/api/trigger-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ modulo })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${resp.status}`);
    }

    mostrarNotificacion(`⏳ Sincronización iniciada en SAP. Procesando datos...`, 'info');
    if (btnEl) {
      btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Procesando SAP...';
      lucide.createIcons();
    }

    let targetRunId = null;
    let attempts = 0;
    const maxAttempts = 40; // max ~3 minutos (5s por intento)

    const pollStatus = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollStatus);
        mostrarNotificacion('⚠️ Tiempo de espera agotado. Verifica la actualización en unos minutos.', 'warning');
        finishSync();
        return;
      }

      try {
        const statusResp = await fetch('/api/sync-status', {
          method: 'POST',
          headers
        });

        if (statusResp.ok) {
          const run = await statusResp.json();
          const runCreatedTime = new Date(run.created_at).getTime();

          if (!targetRunId) {
            if (run.status !== 'completed' || (runCreatedTime > triggerTime - 120000)) {
              targetRunId = run.id;
              console.log(`[Sync] Detectado workflow run activo: ID ${targetRunId}, Estado: ${run.status}`);
            }
          }

          if (targetRunId && run.id === targetRunId) {
            if (btnEl) {
              btnEl.innerHTML = `<i data-lucide="loader" class="btn-icon rotating"></i> SAP: ${run.status === 'in_progress' ? 'Procesando' : run.status}...`;
              lucide.createIcons();
            }

            if (run.status === 'completed') {
              clearInterval(pollStatus);
              if (run.conclusion === 'success') {
                mostrarNotificacion('⏳ Recargando base de datos...', 'info');
                if (window.cargarDatosDeSupabase) {
                  await window.cargarDatosDeSupabase();
                }
                mostrarNotificacion('✅ Sincronización SAP finalizada con éxito.', 'success');
                if (window.validarCotizacionConSAP) {
                  window.validarCotizacionConSAP(true);
                  const activeInlineStatusEl = document.querySelector('[id^="quick-sap-validation-status-"]');
                  if (activeInlineStatusEl) {
                    const activeInlineTransitionId = activeInlineStatusEl.id.replace('quick-sap-validation-status-', '');
                    window.validarCotizacionConSAP(false, activeInlineTransitionId);
                  }
                }
                if (window.poblarPedidosDropdown) {
                  window.poblarPedidosDropdown(true, null, document.getElementById('t-pedido-sap')?.value || '');
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.poblarPedidosDropdown(false, activeQuickTicketId, activeQuickPedEl.value || '');
                  }
                }
                if (window.validarPedidoConSAP) {
                  window.validarPedidoConSAP(true);
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.validarPedidoConSAP(false, activeQuickTicketId);
                  }
                }
              } else {
                mostrarNotificacion(`❌ Sincronización SAP fallida: ${run.conclusion || 'desconocido'}`, 'error');
              }
              finishSync();
            }
          }
        }
      } catch (err) {
        console.warn('Error sondeando estado de sync:', err);
      }
    }, 5000);

    function finishSync() {
      if (btnEl) {
        btnEl.innerHTML = origHTML;
        btnEl.disabled = false;
        lucide.createIcons();
      }
    }

  } catch(e) {
    mostrarNotificacion(`❌ Error al disparar sync: ${e.message}`, 'error');
    if (btnEl) {
      btnEl.innerHTML = origHTML;
      btnEl.disabled = false;
      lucide.createIcons();
    }
  }
}
window.sincronizarConGitHub = sincronizarConGitHub;

function guardarConfig() {

  configData = {
    empresa: document.getElementById('cfg-empresa').value.trim(),
    rfc: document.getElementById('cfg-rfc').value.trim(),
    tel: document.getElementById('cfg-tel').value.trim(),
    email: document.getElementById('cfg-email').value.trim(),
    direccion: document.getElementById('cfg-direccion').value.trim(),
    queryClientes: document.getElementById('cfg-query-clientes').value.trim(),
    queryMaquinaria: document.getElementById('cfg-query-maquinaria').value.trim(),
    querySitios: document.getElementById('cfg-query-sitios').value.trim(),
    queryOrdenes: document.getElementById('cfg-query-ordenes').value.trim(),
    queryRefacciones: document.getElementById('cfg-query-refacciones').value.trim()
  };

  localStorage.setItem('eurorep_config', JSON.stringify(configData));
  if (window.pushToSupabase) window.pushToSupabase('config', configData);
  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; lucide.createIcons(); }, 2000);
}

window.toggleOneDriveDemoMode = function() {
  const checkbox = document.getElementById('cfg-onedrive-force-mock');
  const container = document.getElementById('onedrive-redirect-uri-container');
  const folderContainer = document.getElementById('onedrive-folder-id-container');
  const conciliadosContainer = document.getElementById('onedrive-folder-conciliados-id-container');
  const text = document.getElementById('onedrive-redirect-uri-text');
  
  if (!checkbox) return;
  
  if (checkbox.checked) {
    if (container) container.style.display = 'none';
    if (folderContainer) folderContainer.style.display = 'none';
    if (conciliadosContainer) conciliadosContainer.style.display = 'none';
  } else {
    if (container) container.style.display = 'block';
    if (folderContainer) folderContainer.style.display = 'block';
    if (conciliadosContainer) conciliadosContainer.style.display = 'block';
    if (text) {
      text.textContent = window.location.origin;
    }
  }
};

window.guardarOneDriveConfig = function() {
  const clientId = document.getElementById('cfg-onedrive-client-id').value.trim();
  const forceMock = document.getElementById('cfg-onedrive-force-mock').checked;
  const folderId = document.getElementById('cfg-onedrive-folder-id')?.value.trim() || '';
  const folderConciliadosId = document.getElementById('cfg-onedrive-folder-conciliados-id')?.value.trim() || '';

  configData.onedriveClientId = clientId || 'MOCK';
  configData.onedriveForceMock = forceMock;
  configData.onedriveFolderId = folderId;
  configData.onedriveFolderConciliadosId = folderConciliadosId;

  localStorage.setItem('eurorep_config', JSON.stringify(configData));
  if (window.pushToSupabase) window.pushToSupabase('config', configData);

  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  
  mostrarNotificacion('Configuración de OneDrive guardada correctamente.', 'success');
  
  setTimeout(() => { 
    btn.innerHTML = orig; 
    btn.style.background = ''; 
    lucide.createIcons(); 
  }, 2000);
};

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

// ===== TABLE =====

let filtroEstadoServicios = '';
function setFiltroEstadoServicios(estado) {
  filtroEstadoServicios = estado;
  filtrarOrdenes('servicios');
  renderTabla('v2');
}

let filtroTicketsV2 = 'todos';
function setFiltroTicketsV2(estado) {
  filtroTicketsV2 = estado;
  renderTickets('v2');
}

function toggleSortOrdenes(col) {
  if (currentOrdSortCol === col) {
    currentOrdSortDir = currentOrdSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentOrdSortCol = col;
    currentOrdSortDir = 'asc';
  }
  filtrarOrdenes('servicios');
  filtrarOrdenes();
}

function renderTabla(ctx) {
  try { actualizarFiltrosPersonal(); } catch (e) {}
  const isServiciosView = ctx === 'servicios';
  if (isServiciosView) {
    const btnRegen = document.getElementById('btn-regenerar-ordenes');
    if (btnRegen) {
      const isAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
      btnRegen.style.display = isAdmin ? 'flex' : 'none';
    }
    const btnDepurar = document.getElementById('btn-depurar-ordenes-ref');
    if (btnDepurar) {
      const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin');
      btnDepurar.style.display = isSuperAdmin ? 'flex' : 'none';
      if (isSuperAdmin && typeof window.actualizarBadgeDepuradorOrdenes === 'function') {
        window.actualizarBadgeDepuradorOrdenes();
      }
    }
  }
  const isV2 = ctx === 'v2';
  const bodyId = isServiciosView ? 'tabla-body-servicios' : (isV2 ? 'v2-tabla-body' : 'tabla-body');
  const searchId = isServiciosView ? 'search-servicios' : (isV2 ? 'v2-search-ordenes' : 'search-input');
  const q = (document.getElementById(searchId)?.value || '').toLowerCase();
  const qClean = q.trim();
  const qNorm = qClean.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const qNum = qClean.replace(/[^0-9]/g, '');
  
  let filtradas = getFilteredOrders().filter(o => {
    if (!qClean) return true;
    const oFol = String(o.folio || o.numero_orden || o.id || '').toLowerCase();
    const oFolNorm = oFol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const oFolNum = oFol.replace(/[^0-9]/g, '');

    const matchFolio = oFol.includes(qClean) || 
                       (qNorm && oFolNorm.includes(qNorm)) || 
                       (qNorm && qNorm.includes(oFolNorm)) ||
                       (qNum.length >= 4 && oFolNum === qNum);
    const matchCliente = String(o.cliente || '').toLowerCase().includes(qClean);
    const matchTecnico = String(o.tecnico || '').toLowerCase().includes(qClean);
    const matchUbicacion = String(o.ubicacion || '').toLowerCase().includes(qClean);
    const matchModelo = String(o.modelo || '').toLowerCase().includes(qClean);
    const matchTipo = String(o.tipo || '').toLowerCase().includes(qClean);
    const matchEstado = String(o.estado || '').toLowerCase().includes(qClean);

    // Buscar por ticket origen (folio, id, asunto, solicitante)
    let matchTicket = false;
    const rawSoporte = String(o.soporte || o.ticket_id || o.ticket_folio || '').toLowerCase();
    const rawSoporteNorm = rawSoporte.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const rawSoporteNum = rawSoporte.replace(/[^0-9]/g, '');
    if (rawSoporte && (rawSoporte.includes(qClean) || (qNorm && rawSoporteNorm.includes(qNorm)) || (qNum.length >= 4 && rawSoporteNum === qNum))) {
      matchTicket = true;
    }

    if (!matchTicket && (o.soporte || o.ticket_id || o.ticket_folio)) {
      const targetTktId = o.soporte || o.ticket_id;
      const targetTktFolio = o.ticket_folio;
      const tk = (typeof tickets !== 'undefined' && tickets) 
        ? tickets.find(x => x.id === targetTktId || x.folio === targetTktId || (targetTktFolio && x.folio === targetTktFolio))
        : null;
      if (tk) {
        if (String(tk.folio || '').toLowerCase().includes(qClean)) matchTicket = true;
        if (String(tk.asunto || '').toLowerCase().includes(qClean)) matchTicket = true;
        if (String(tk.solicitante || '').toLowerCase().includes(qClean)) matchTicket = true;
      }
    }

    return matchCliente || matchTecnico || matchFolio || matchUbicacion || matchModelo || matchTipo || matchEstado || matchTicket;
  });

  if (isServiciosView && filtroEstadoServicios) {
    filtradas = filtradas.filter(o => (o.estado || '').toLowerCase() === filtroEstadoServicios.toLowerCase());
  }

  let tecFilter = document.getElementById('filter-ord-tecnico')?.value;
  let supFilter = document.getElementById('filter-ord-supervisor')?.value;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtradas = filtradas.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        let fromTicket = false;
        if (o.soporte) {
          const tick = tickets.find(t => t.id === o.soporte);
          if (tick) {
            const tcli = String(tick.cliente || '').toLowerCase().trim();
            const tsol = String(tick.solicitante || '').toLowerCase().trim();
            if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
          }
        }
        return ocli === nombreEmpresaLogged || fromTicket;
      });
    } else {
      filtradas = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  if (userRole === 'tecnico') {
    if (isTestModeActive()) {
      tecFilter = '';
    } else {
      tecFilter = currentUser ? currentUser.nombre : '';
    }
  }
  if (userRole === 'supervisor') {
    supFilter = document.getElementById('filter-ord-supervisor')?.value || '';
  }
  
  if (tecFilter || supFilter) {
    const tecNameLower = tecFilter ? window.normStr(tecFilter) : '';
    const supNameLower = supFilter ? window.normStr(supFilter) : '';
    
    filtradas = filtradas.filter(o => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecNameLower) {
         let assigned = [];
         if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
         else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => window.normStr(s));
         let isCreator = false;
         let isTkAssigned = false;
         if (o.creadoPor && window.normStr(o.creadoPor) === tecNameLower) isCreator = true;
         if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
               if ((tk.solicitante && window.normStr(tk.solicitante) === tecNameLower) || 
                   (tk.creadoPor && window.normStr(tk.creadoPor) === tecNameLower)) isCreator = true;
               let tkAssigned = [];
               if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
               else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
               const tkAssignedLower = tkAssigned.map(s => window.normStr(s));
               if (tkAssignedLower.includes(tecNameLower)) isTkAssigned = true;
            }
         }
         passTec = assignedLower.includes(tecNameLower) || isCreator || isTkAssigned;
      }
      
      if (supFilter && supNameLower) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === o.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
         }
         
         let assigned = [];
         if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados.map(resolveTecnicoNombre);
         else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => window.normStr(s));
         
         let passSupTicket = assignedLower.includes(supNameLower);
         let isCreator = false;
         if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
               if ((tk.solicitante && window.normStr(tk.solicitante) === supNameLower) || 
                   (tk.creadoPor && window.normStr(tk.creadoPor) === supNameLower)) isCreator = true;
               let tkAssigned = [];
               if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados.map(resolveTecnicoNombre);
               else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
               const tkAssignedLower = tkAssigned.map(s => window.normStr(s));
               if (tkAssignedLower.includes(supNameLower)) passSupTicket = true;
            }
         }
         passSup = passSupClient || passSupTicket || isCreator;
      }
      
      return passTec && passSup;
    });
  }

  // ORDENAMIENTO
  if (currentOrdSortCol !== 'reciente') {
    filtradas.sort((a, b) => {
      let valA = a[currentOrdSortCol] || '';
      let valB = b[currentOrdSortCol] || '';
      
      if (currentOrdSortCol === 'id') {
        const numA = parseInt(valA.replace(/\D/g, '')) || 0;
        const numB = parseInt(valB.replace(/\D/g, '')) || 0;
        return currentOrdSortDir === 'asc' ? numA - numB : numB - numA;
      } else if (currentOrdSortCol === 'fecha') {
        const dateA = new Date(valA).getTime() || 0;
        const dateB = new Date(valB).getTime() || 0;
        return currentOrdSortDir === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentOrdSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentOrdSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  } else {
    // Ordenamiento por defecto (recientes primero)
    filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  // Actualizar iconos de ordenamiento
  ['id', 'cliente', 'ubicacion', 'modelo', 'tecnico', 'tipo', 'estado', 'fecha'].forEach(col => {
    const icon = document.getElementById('sort-icon-ord-' + col);
    if (icon) {
      const isCurrent = currentOrdSortCol === col;
      const iconName = isCurrent ? (currentOrdSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-ord-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  const body = document.getElementById(bodyId);
  if (!body) return;
  if (!filtradas.length) {
    body.innerHTML = `<tr><td colspan="10" class="empty-state">No hay órdenes${q ? ' que coincidan' : ' registradas'}.</td></tr>`;
    return;
  }
  const isConsulta = currentSession.viewMode === 'consulta';
  const isTecnico = currentSession.viewMode === 'tecnico';
  const canEdit = !isConsulta && !isTecnico && !isEmpresa;
  const canDelete = ['superadmin', 'admin'].includes(currentSession.viewMode);

  body.innerHTML = filtradas.map(o => {
    let orderCanEdit = canEdit;
    if (((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf) && !['superadmin', 'admin'].includes(currentSession.viewMode)) {
      orderCanEdit = false;
    }
    const ticketAsoc = (o.soporte || o.ticket_id || o.ticket_folio)
      ? tickets.find(x => x.id === o.soporte || x.folio === o.soporte || (o.ticket_id && x.id === o.ticket_id) || (o.ticket_folio && x.folio === o.ticket_folio))
      : null;
    const ticketHtml = ticketAsoc
      ? `<a href="#" onclick="verDetalleTicket('${ticketAsoc.id}'); return false;" style="color: var(--accent); font-weight: 600; text-decoration: underline;" title="${ticketAsoc.asunto || ''}">${ticketAsoc.folio}</a>`
      : (o.soporte ? `<span style="font-family:monospace; font-size:0.8rem; color:var(--text-muted);">${o.soporte}</span>` : '-');
    
    return `
    <tr>
      <td data-label="Acciones" style="white-space:nowrap; width:60px;">
        <div style="display:flex;gap:0.25rem;">
          <button class="action-btn" onclick="verDetalle('${o.id}')" title="Ver"><i data-lucide="eye"></i></button>
          ${orderCanEdit ? `<button class="action-btn" onclick="editarOrden('${o.id}')" title="Editar"><i data-lucide="pencil"></i></button>` : ''}
        </div>
      </td>
      <td data-label="Folio"><strong>${o.folio||'-'}</strong></td>
      <td data-label="Ticket">${ticketHtml}</td>
      <td data-label="Cliente">${o.cliente||'-'}</td>
      <td data-label="Ubicación">${o.ubicacion||'-'}</td>
      <td data-label="Modelo">${o.modelo||'-'}</td>

      <td data-label="Tipo"><span class="badge badge-${(o.tipo||'otro').toLowerCase().replace('é','e').replace('í','i')}">${o.tipo||'-'}</span></td>
      <td data-label="Estado"><span class="badge ${badgeEstado(o.estado)}">${o.estado||'-'}</span></td>
      <td data-label="Fecha">${formatFechaAmigable(o.fecha)}</td>
      <td data-label="" style="width:40px; text-align:center;">
        ${canDelete ? `<button class="action-btn del" onclick="eliminarOrden('${o.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
      </td>
    </tr>
    `;
  }).join('');
  if (!ctx) renderStats();
  lucide.createIcons();
}

function badgeEstado(estado) {
  if (estado === 'En Proceso') return 'badge-proceso';
  if ((estado === 'Completado' || estado === 'Cerrada' || estado === 'Cerrado')) return 'badge-completado';
  return 'badge-pendiente';
}

function filtrarOrdenes(ctx) { renderTabla(ctx); }

// ============================================================
// MÓDULO DE SINCRONIZACIÓN SAP (CATÁLOGOS MAESTROS)
// Extraído modularmente a sap_sync.js / src/modules/sap_sync.js
// ============================================================
// =========================================================================
// MÓDULO CLIENTES Y GESTIÓN DE MAQUINARIA
// Extraído modularmente a clientes.js / src/modules/clientes.js (-2,934 líneas)
// =========================================================================

// ===== CONFIG PERMISOS ROLES =====
function renderPermisosRoles() {
  const table = document.getElementById('tabla-permisos-roles');
  if (!table) return;

  const todasLasVistas = Object.keys(ROLES_LABELS);
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];

  let html = `
    <thead>
      <tr>
        <th style="text-align:left;">Vista</th>
        ${rolesParaEditar.map(r => `<th style="text-align:center;">${ROLES[r].label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
  `;

  todasLasVistas.forEach(vista => {
    html += `<tr>`;
    html += `<td style="font-weight:500;">${ROLES_LABELS[vista]}</td>`;
    rolesParaEditar.forEach(r => {
      const tieneVista = ROLES[r].views.includes(vista);
      // Opcional: hacer que el superadmin no pueda quitarse el dashboard o config, 
      // pero por ahora lo dejamos libre como lo pide el usuario.
      html += `
        <td style="text-align:center; vertical-align:middle;">
          <input type="checkbox" class="cb-permiso-rol" data-rol="${r}" data-vista="${vista}" ${tieneVista ? 'checked' : ''} style="width:1.2rem; height:1.2rem; cursor:pointer;" />
        </td>
      `;
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

function guardarPermisosRoles() {
  const checkboxes = document.querySelectorAll('.cb-permiso-rol');
  
  // Reset all mutable roles
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];
  rolesParaEditar.forEach(r => ROLES[r].views = []);
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      ROLES[cb.dataset.rol].views.push(cb.dataset.vista);
    }
  });
  
  const configToSave = {
    roles: ROLES,
    migrated_v2: true
  };
  localStorage.setItem('sapi_roles_config', JSON.stringify(configToSave));
  if (window.pushToSupabase) window.pushToSupabase('roles', configToSave);
  
  // Recargar la UI
  setupNav();
  
  // Feedback visual
  const btn = document.querySelector('button[onclick="guardarPermisosRoles()"]');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  
  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.style.background = '';
    lucide.createIcons();
  }, 2000);
}

// ===== CONFIG TÉCNICOS =====
let currentTecView = 'galeria';

function setTecView(view) {
  currentTecView = view;
  document.getElementById('btn-tec-galeria').style.background = view === 'galeria' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-tec-galeria').style.color = view === 'galeria' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-tec-galeria').style.borderColor = view === 'galeria' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('btn-tec-lista').style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-tec-lista').style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-tec-lista').style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('tecnicos-grid').style.display = view === 'galeria' ? 'grid' : 'none';
  document.getElementById('tecnicos-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
}

function renderTecnicos() {
  const grid = document.getElementById('tecnicos-grid');
  const tbody = document.getElementById('tecnicos-table-body');
  
  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };
  
  // Combine legacy technitians from orders with actual registered user technitians and SAP technitians
  const legacyTecs = getFilteredOrders().map(o => o.tecnico).filter(Boolean).map(formatNombreCorto);
  const userTecs = usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && (isTestModeActive() || !isTestUser(u))).map(u => formatNombreCorto(u.nombre));
  const sapTecs = tecnicosDb.map(t => formatNombreCorto(t.nombre)).filter(Boolean);
  
  let tecsArr = [];
  if (API_CONFIG.USE_SAP_BACKEND && sapTecs.length > 0) {
    // Si SAP está activo, usar los técnicos activos de SAP y también los usuarios locales con rol de técnico
    tecsArr = [...sapTecs, ...userTecs];
  } else {
    tecsArr = [...legacyTecs, ...userTecs, ...sapTecs];
  }
  
  // Filtrar explícitamente cualquier técnico que se llame "N/A" (proveniente de bases locales viejas)
  // y también excluir a los usuarios que tengan el rol o tipo de usuario "consulta"
  const tecs = [...new Set(tecsArr)]
    .filter(t => !t.toUpperCase().includes('N/A') && t.trim() !== '')
    .filter(t => {
      const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t) || usuarios.find(u => formatNombreCorto(u.nombre) === t);
      if (tecObj && !isTestModeActive() && isTestUser(tecObj)) return false;
      const tRol = (tecObj?.tipoUsuario || tecObj?.rol || '').toLowerCase();
      return !tRol.includes('consulta');
    })
    .sort();
  
  if (!tecs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">Sin técnicos registrados aún.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Sin técnicos registrados aún.</td></tr>`;
    return;
  }
  
  grid.innerHTML = tecs.map(t => {
    // Calcular órdenes del técnico
    const tOrdenes = getFilteredOrders().filter(o => {
      let assigned = [];
      if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
        assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecnicoNombre(id)));
      } else if (o.tecnico) {
        assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
      }
      return assigned.includes(t);
    });

    const total = tOrdenes.length;
    const comp = tOrdenes.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;
    
    // Calcular Siguiente Orden y Último Completado usando el sistema de órdenes
    const ordenesAbiertas = tOrdenes
      .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // la más antigua abierta primero
    const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;
    
    const ordenesCompletadas = tOrdenes
      .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // la más reciente completada primero
    const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

    const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t) || usuarios.find(u => formatNombreCorto(u.nombre) === t);
    const celular = tecObj?.telefono || tecObj?.celular || 'Sin celular';
    const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

    const proxTxt = proxOrden ? `<span onclick="event.stopPropagation(); verDetalle('${proxOrden.id}')" style="color:var(--accent); font-weight:600; text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${proxOrden.cliente}</span> <span style="color:var(--text-muted);">(${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''})</span>` : '<span style="color:var(--text-muted);">Ninguna</span>';
    const ultTxt = ultCompletada ? `<span onclick="event.stopPropagation(); verDetalle('${ultCompletada.id}')" style="color:var(--accent); font-weight:600; text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${ultCompletada.cliente}</span> <span style="color:var(--text-muted);">(${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''})</span>` : '<span style="color:var(--text-muted);">Ninguna</span>';


    return `
    <div class="card-person" onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer; display:flex; flex-direction:column; gap:0.5rem; padding:1.25rem;">
      <div>
        <div class="card-person-name" style="margin-bottom:0.2rem;">${t}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> ${tipoUsuario}</span>
          <span>&bull;</span>
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="phone" style="width:12px;height:12px;"></i> ${celular}</span>
        </div>
        <div class="card-person-sub" style="display:flex; justify-content:space-between;">
          <span>${total} servicio(s) históricos</span>
          <span style="color:var(--green); font-weight:500;">${comp} Completados</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.4rem; font-size:0.8rem;">
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="calendar-clock" style="width:14px;height:14px;color:var(--accent);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Siguiente Orden</div>
            ${proxTxt}
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="check-circle-2" style="width:14px;height:14px;color:var(--green);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Último Completado</div>
            ${ultTxt}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  if (tbody) {
    tbody.innerHTML = tecs.map(t => {
      // Calcular órdenes del técnico
      const tOrdenes = getFilteredOrders().filter(o => {
        let assigned = [];
        if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
          assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecnicoNombre(id)));
        } else if (o.tecnico) {
          assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
        }
        return assigned.includes(t);
      });

      const total = tOrdenes.length;
      const comp = tOrdenes.filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase())).length;

      // Calcular Siguiente Orden y Último Completado usando el sistema de órdenes
      const ordenesAbiertas = tOrdenes
        .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // la más antigua abierta primero
      const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;
      
      const ordenesCompletadas = tOrdenes
        .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // la más reciente completada primero
      const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

      const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t) || usuarios.find(u => formatNombreCorto(u.nombre) === t);
      const celular = tecObj?.telefono || tecObj?.celular || 'Sin celular';
      const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

      const proxTxt = proxOrden ? `<div onclick="event.stopPropagation(); verDetalle('${proxOrden.id}')" style="font-weight:600; color:var(--accent); text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${proxOrden.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''}</div>` : '<span style="color:var(--text-muted);">Ninguna</span>';
      const ultTxt = ultCompletada ? `<div onclick="event.stopPropagation(); verDetalle('${ultCompletada.id}')" style="font-weight:600; color:var(--accent); text-decoration:underline; cursor:pointer;" title="Ver Orden de Servicio">${ultCompletada.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''}</div>` : '<span style="color:var(--text-muted);">Ninguna</span>';


      return `
        <tr onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer;" class="hover-row">
          <td>
            <div style="font-weight:500;">${t}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
              <span>${tipoUsuario}</span> &bull; <span>${celular}</span>
            </div>
          </td>
          <td>${total}</td>
          <td><span class="badge badge-completado">${comp} completados</span></td>
          <td>${proxTxt}</td>
          <td>${ultTxt}</td>
        </tr>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

function verDetalleTecnico(nombre) {
  document.getElementById('tecnico-detalle-title').innerHTML = `<i data-lucide="user" style="color:var(--accent);"></i> Perfil: ${nombre}`;
  
  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };
  const tUser = usuarios.find(u => u.nombre === nombre || formatNombreCorto(u.nombre) === nombre) || 
                tecnicosDb.find(t => t.nombre === nombre || formatNombreCorto(t.nombre) === nombre);
  
  // Find assigned clients
  let assignedClients = [];
  if (tUser) {
    assignedClients = clientesDb.filter(c => 
      (c.tecnicosAsignados && c.tecnicosAsignados.includes(tUser.id)) ||
      (c.tecnicoAsignado === tUser.id)
    );
  }
  
  // Find resolved tickets (Tickets have string assigned, e.g. "Juan Perez")
  // Tickets are usually assigned to a string. Or if it's multiple, they are comma separated.
  const resolvedTickets = tickets.filter(t => 
    t.estado === 'Resuelto' && 
    t.asignado && 
    t.asignado.split(',').map(s=>s.trim()).includes(nombre)
  );

  // Calcular Siguiente Orden y Último Completado para el perfil del técnico
  const tNameShort = formatNombreCorto(nombre);
  const tOrdenes = getFilteredOrders().filter(o => {
    let assigned = [];
    if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
      assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecnicoNombre(id)));
    } else if (o.tecnico) {
      assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
    }
    return assigned.includes(tNameShort);
  });

  const ordenesAbiertas = tOrdenes
    .filter(o => !['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const proxOrden = ordenesAbiertas.length > 0 ? ordenesAbiertas[0] : null;

  const ordenesCompletadas = tOrdenes
    .filter(o => ['completado', 'cerrada', 'cerrado'].includes((o.estado || '').toLowerCase()))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultCompletada = ordenesCompletadas.length > 0 ? ordenesCompletadas[0] : null;

  let html = `

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom:1.5rem;">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Estado</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--green);">Activo</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Correo</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.email || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Celular</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.celular || tUser?.telefono || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Clientes Asignados</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${assignedClients.length}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Completadas</div>
        <div style="font-weight: 500; color: var(--green); font-size: 1.1rem;">${ordenesCompletadas.length}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Pendientes</div>
        <div style="font-weight: 500; color: var(--accent); font-size: 1.1rem;">${ordenesAbiertas.length}</div>
      </div>
    </div>
  `;


  html += `
    <div style="margin-bottom:1.5rem;">
      <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
        <i data-lucide="clipboard-list" style="width:18px;height:18px;color:var(--text-muted);"></i> Siguiente Orden y Actividad
      </h3>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Siguiente Orden</div>
            <div style="font-weight:600; color:var(--text-primary);">${proxOrden ? proxOrden.cliente : 'Ninguna'}</div>
            ${proxOrden ? `<div style="font-size:0.8rem; color:var(--text-muted);">Folio: ${proxOrden.folio} • Fecha: ${proxOrden.fecha ? proxOrden.fecha.split('T')[0] : ''}</div>` : ''}
          </div>
          ${proxOrden ? `<button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalle('${proxOrden.id}')" style="font-size:0.75rem;"><i data-lucide="eye" style="width:12px;height:12px;margin-right:3px;vertical-align:middle;"></i> Ver Orden</button>` : ''}
        </div>
        <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Último Completado</div>
            <div style="font-weight:600; color:var(--text-primary);">${ultCompletada ? ultCompletada.cliente : 'Ninguno'}</div>
            ${ultCompletada ? `<div style="font-size:0.8rem; color:var(--text-muted);">Folio: ${ultCompletada.folio} • Fecha: ${ultCompletada.fecha ? ultCompletada.fecha.split('T')[0] : ''}</div>` : ''}
          </div>
          ${ultCompletada ? `<button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalle('${ultCompletada.id}')" style="font-size:0.75rem;"><i data-lucide="eye" style="width:12px;height:12px;margin-right:3px;vertical-align:middle;"></i> Ver Orden</button>` : ''}
        </div>
      </div>
    </div>
  `;

  if (assignedClients.length > 0) {

    html += `
      <div style="margin-bottom:1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="building-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Empresas Asignadas
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${assignedClients.map(c => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${c.nombre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${c.ubicacion || 'Sin ubicación'}</div>
              </div>
              <button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalleCliente('${c.nombre.replace(/'/g, "\\'")}')" style="font-size:0.75rem;">Ver Perfil</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (resolvedTickets.length > 0) {
    html += `
      <div>
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="check-circle" style="width:18px;height:18px;color:var(--text-muted);"></i> Tickets Resueltos Recientes
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:200px; overflow-y:auto; padding-right:0.5rem;">
          ${resolvedTickets.slice(0, 10).map(t => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:500; color:var(--text-primary);">${t.folio} - ${t.asunto || 'Sin título'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${t.cliente || 'Uso Interno'} • ${formatFechaAmigable(t.fechaCreacion)}</div>
              </div>
              <span class="badge badge-resuelto">Resuelto</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('detalle-tecnico-body').innerHTML = html;
  document.getElementById('modal-detalle-tecnico-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleTecnico(e) {
  if (e && e.target !== document.getElementById('modal-detalle-tecnico-overlay')) return;
  document.getElementById('modal-detalle-tecnico-overlay').classList.remove('open');
}

// ===== DIAS PANELS =====
function initDiasPanels() {
  const container = document.getElementById('dia-panels');
  container.innerHTML = DIAS.map((dia, i) => `
    <div class="dia-panel ${i===0?'active':''}" id="panel-${dia}">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="${dia}-fecha" onchange="autoCompletarFechas('${dia}', this.value)"/>
      </div>
      <div class="form-group">
        <label>Origen → Trabajo (hrs)</label>
        <input type="number" id="${dia}-traslado-ida" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Trabajo → Origen (hrs)</label>
        <input type="number" id="${dia}-traslado-vuelta" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Entrada</label>
        <input type="time" id="${dia}-entrada" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Salida</label>
        <input type="time" id="${dia}-salida" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Horas Normales</label>
        <input type="number" id="${dia}-normales" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Horas Extra</label>
        <input type="number" id="${dia}-extras" min="0" step="0.5"/>
      </div>
    </div>
  `).join('');
}

function calcularHorasDia(dia) {
  const entrada = document.getElementById(`${dia}-entrada`).value;
  const salida = document.getElementById(`${dia}-salida`).value;
  if (!entrada || !salida) return;
  
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  
  let totalMinutos = (sh * 60 + sm) - (eh * 60 + em);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  let totalHoras = totalMinutos / 60;
  let normales = Math.min(totalHoras, 8);
  let extras = totalHoras > 8 ? totalHoras - 8 : 0;
  
  document.getElementById(`${dia}-normales`).value = normales > 0 ? parseFloat(normales.toFixed(2)) : '';
  document.getElementById(`${dia}-extras`).value = extras > 0 ? parseFloat(extras.toFixed(2)) : '';
}

function autoCompletarFechas(diaOrigen, fechaStr) {
  if (!fechaStr) return;
  const origenIndex = DIAS.indexOf(diaOrigen);
  if (origenIndex === -1) return;
  
  const [year, month, day] = fechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  
  const dayOfWeek = baseDate.getDay();
  const expectedDayOfWeek = origenIndex === 6 ? 0 : origenIndex + 1;
  
  if (dayOfWeek !== expectedDayOfWeek) {
    mostrarNotificacion(`La fecha seleccionada no corresponde al día ${diaOrigen.toUpperCase()}.`, 'warning');
    document.getElementById(`${diaOrigen}-fecha`).value = '';
    return;
  }
  
  DIAS.forEach((dia, i) => {
    if (i === origenIndex) return;
    const diff = i - origenIndex;
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + diff);
    
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(newDate.getDate()).padStart(2, '0');
    
    const el = document.getElementById(`${dia}-fecha`);
    if (el && !el.value) { // Solo si está vacío
      el.value = `${y}-${m}-${d}`;
    }
  });
}

function selDia(btn, dia) {
  document.querySelectorAll('.dia-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dia-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + dia).classList.add('active');
}

// ===== KM CALC =====
function calcKmTotal() {
  const ida = parseFloat(document.getElementById('f-km-ida').value) || 0;
  const vuelta = parseFloat(document.getElementById('f-km-vuelta').value) || 0;
  document.getElementById('f-km-total').value = ida + vuelta;
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



// ===== DIAS DATA =====
function getDiasData() {
  const data = {};
  DIAS.forEach(dia => {
    data[dia] = {
      fecha: document.getElementById(`${dia}-fecha`)?.value,
      trasladoIda: document.getElementById(`${dia}-traslado-ida`)?.value,
      trasladoVuelta: document.getElementById(`${dia}-traslado-vuelta`)?.value,
      entrada: document.getElementById(`${dia}-entrada`)?.value,
      salida: document.getElementById(`${dia}-salida`)?.value,
      normales: document.getElementById(`${dia}-normales`)?.value,
      extras: document.getElementById(`${dia}-extras`)?.value,
    };
  });
  return data;
}

function setDiasData(data) {
  if (!data) return;
  DIAS.forEach(dia => {
    if (!data[dia]) return;
    const d = data[dia];
    if (d.fecha) document.getElementById(`${dia}-fecha`).value = d.fecha;
    if (d.trasladoIda) document.getElementById(`${dia}-traslado-ida`).value = d.trasladoIda;
    if (d.trasladoVuelta) document.getElementById(`${dia}-traslado-vuelta`).value = d.trasladoVuelta;
    if (d.entrada) document.getElementById(`${dia}-entrada`).value = d.entrada;
    if (d.salida) document.getElementById(`${dia}-salida`).value = d.salida;
    if (d.normales) document.getElementById(`${dia}-normales`).value = d.normales;
    if (d.extras) document.getElementById(`${dia}-extras`).value = d.extras;
  });
}

// ===== FORM =====
function generarFolioConsecutivo() {
  const isTest = isTestModeActive();
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = isTest ? `OS-PRUEBA-` : `OS-${currentYear}`;
  let maxConsecutivo = 0;
  
  ordenes.forEach(o => {
    if (o.folio && typeof o.folio === 'string') {
      const cleanFolio = o.folio.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
      if (cleanFolio.startsWith(prefix)) {
        const numStr = cleanFolio.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxConsecutivo) {
          maxConsecutivo = num;
        }
      }
    }
  });
  
  maxConsecutivo++;
  const padded = maxConsecutivo.toString().padStart(3, '0');
  return `${prefix}${padded}`;
}

function abrirFormulario(id, modoReporte = false) {
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar órdenes.', 'error');
    return;
  }
  editandoId = id || null;
  document.getElementById('modal-title').textContent = modoReporte ? 'Llenar Reporte Técnico' : (id ? 'Editar Orden' : 'Nueva Orden de Servicio');
  document.getElementById('form-orden').reset();

  // Restaurar estilos y propiedades habilitadas por defecto (evita que se queden bloqueadas de sesiones anteriores)
  const todosCamposTexto = [
    'f-folio', 'f-pedido', 'f-ubicacion', 'f-ubicacion-sitio', 'f-operador', 'f-eco',
    'f-horometro', 'f-horometro-real', 'f-modelo', 'f-serie',
    'f-km-ida', 'f-km-vuelta'
  ];
  todosCamposTexto.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.readOnly = false;
      el.style.background = '';
      el.style.cursor = '';
      el.style.opacity = '';
    }
  });

  const todosSelects = ['f-soporte', 'f-equipo', 'f-estado'];
  todosSelects.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.disabled = false;
      el.style.background = '';
      el.style.opacity = '';
    }
  });

  const fClienteComboReset = document.getElementById('f-cliente-combo');
  if (fClienteComboReset) {
    fClienteComboReset.style.pointerEvents = 'auto';
    fClienteComboReset.style.background = '';
    fClienteComboReset.style.opacity = '';
  }

  document.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.disabled = false;
  });

  document.querySelectorAll('input[name="f-tecnicos"]').forEach(cb => {
    cb.disabled = false;
  });

  const elFallaReset = document.getElementById('f-falla');
  if (elFallaReset) {
    elFallaReset.readOnly = false;
    elFallaReset.style.background = '';
    elFallaReset.style.cursor = '';
  }
  
  const sectionEstado = document.getElementById('section-estado-orden');
  if (sectionEstado) {
    if (currentSession.viewMode === 'superadmin') {
      sectionEstado.style.display = 'block';
    } else {
      sectionEstado.style.display = 'none';
    }
  }
  
  if (!id) {
    document.getElementById('f-folio').value = generarFolioConsecutivo();
  }
  
  initDiasPanels();
  setRefacciones('utilizadas', []);
  setRefacciones('necesarias', []);
  
  const elSoporte = document.getElementById('f-soporte');
  if (elSoporte) {
    elSoporte.innerHTML = '<option value="">Ninguno</option>';
  }

  // Llenar combo de clientes para Orden de Servicio
  const fClienteOptions = document.getElementById('f-cliente-options');
  const fClienteHidden = document.getElementById('f-cliente');
  const fClienteDisplay = document.getElementById('f-cliente-display');
  
  if (fClienteOptions) {
    fClienteHidden.value = '';
    fClienteDisplay.textContent = 'Seleccionar cliente...';
    fClienteOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('f-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      fClienteOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('f-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (!o) return;
    const fields = ['folio','pedido','ubicacion','ubicacion-sitio','operador','eco','horometro','horometro-real',
      'modelo','serie','soporte','km-ida','km-vuelta','km-total',
      'falla','trabajos','dictamen','condiciones','observaciones','pendientes',
      'noches','alimentacion','traslado-costo'];
    
    // Checkbox especial
    const elReembolso = document.getElementById('f-reembolso-km');
    if (elReembolso) elReembolso.checked = !!o.reembolso_km;
    fields.forEach(f => {
      const el = document.getElementById('f-' + f);
      if (el && o[f.replace(/-/g,'_')] !== undefined) el.value = o[f.replace(/-/g,'_')];
    });
    
    if (o.cliente) {
      if (fClienteOptions) {
        selectComboOption('f-cliente', o.cliente, o.cliente, true); // true = isInitial
      } else {
        const elCliente = document.getElementById('f-cliente');
        if (elCliente) elCliente.value = o.cliente;
      }
    }
    poblarSoportesPorCliente(o.cliente, o.soporte);
    // tipo radio
    const radio = document.querySelector(`input[name="tipo"][value="${o.tipo}"]`);
    if (radio) radio.checked = true;
    // estado
    const sel = document.getElementById('f-estado');
    if (sel && o.estado) sel.value = o.estado;
    
    // Poblar tickets para la edición
    if (elSoporte && o.soporte) {
      const t = tickets.find(x => x.id === o.soporte);
      if (t && !Array.from(elSoporte.options).some(opt => opt.value === t.id)) {
        elSoporte.innerHTML += `<option value="${t.id}">${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}</option>`;
      }
      elSoporte.value = o.soporte;
    }
    
    // refacciones
    if (o.ref_utilizadas?.length) setRefacciones('utilizadas', o.ref_utilizadas);
    if (o.ref_necesarias?.length) setRefacciones('necesarias', o.ref_necesarias);
    // dias
    setDiasData(o.dias);
  } else {
    // Nueva Orden
    poblarSoportesPorCliente('');
    const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
    if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
  }
  
  // Los técnicos se extraen automáticamente del ticket al guardar
  const oSel = id ? ordenes.find(x => x.id === id) : null;
  poblarMaquinasCliente('f-equipo', '', oSel ? oSel.cliente : '');
  
  const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
  if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
  
  if (oSel && oSel.equipo) {
    oSel.equipo.split(', ').forEach(eqName => {
      if (eqName.trim() && window.agregarMaquinaChipOrden) {
        window.agregarMaquinaChipOrden(eqName.trim());
      }
    });
  }
  
  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (o && o.soporte) {
      const elSoporte = document.getElementById('f-soporte');
      if (elSoporte) elSoporte.value = o.soporte;
    }
  }

  onSoporteChange(); // Sincroniza el pedido y metadata

  // Bloquear campos base si la orden viene de un ticket o si es técnico
  const isTecnico = currentSession.viewMode === 'tecnico';
  const soporteActual = document.getElementById('f-soporte').value;
  const lockFields = (isTecnico || soporteActual);

  const camposBloqueados = ['f-folio', 'f-pedido', 'f-ubicacion', 'f-modelo', 'f-serie', 'f-soporte', 'f-equipo'];
  camposBloqueados.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      if (el.tagName === 'SELECT') {
        el.disabled = !!lockFields;
      } else {
        el.readOnly = !!lockFields;
      }
      el.style.background = lockFields ? 'var(--bg-secondary)' : '';
    }
  });

  // Bloquear falla reportada si es técnico
  const elFalla = document.getElementById('f-falla');
  if (elFalla) {
    elFalla.readOnly = !!isTecnico;
    elFalla.style.background = isTecnico ? 'var(--bg-secondary)' : '';
    elFalla.style.cursor = isTecnico ? 'not-allowed' : '';
  }

  const fClienteCombo = document.getElementById('f-cliente-combo');
  if (fClienteCombo) {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    let lockCliente = false;
    let isCerrado = false;

    if (soporteActual) {
      const t = tickets.find(x => x.id === soporteActual);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      lockCliente = true; // Solo admins pueden editar la empresa
    } else {
      if (currentSession.viewMode === 'superadmin') {
        lockCliente = false; // Superadmin nunca se bloquea
      } else {
        lockCliente = isCerrado; // Admin se bloquea solo si el ticket asociado ya está cerrado
      }
    }

    fClienteCombo.style.pointerEvents = lockCliente ? 'none' : 'auto';
    fClienteCombo.style.background = lockCliente ? 'var(--bg-secondary)' : '';
  }
  
  document.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.disabled = !!lockFields;
  });

  // ===== MODO REPORTE: bloquear campos de información general =====
  if (modoReporte) {
    // Campos de texto/number bloqueados (info general + km)
    const camposInfoGeneral = [
      'f-folio', 'f-pedido', 'f-ubicacion', 'f-eco',
      'f-horometro', 'f-modelo', 'f-serie',
      'f-km-total'
    ];
    camposInfoGeneral.forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.readOnly = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.cursor = 'not-allowed';
        el.style.opacity = '0.7';
      }
    });
    // Selects bloqueados
    ['f-soporte', 'f-equipo', 'f-estado'].forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.disabled = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.opacity = '0.7';
      }
    });
    // Combo cliente bloqueado
    const fClienteComboReporte = document.getElementById('f-cliente-combo');
    if (fClienteComboReporte) {
      fClienteComboReporte.style.pointerEvents = 'none';
      fClienteComboReporte.style.background = 'var(--bg-secondary)';
      fClienteComboReporte.style.opacity = '0.7';
    }
    // Radios de tipo bloqueados
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
      radio.disabled = true;
    });
    // Checkboxes de técnicos bloqueados
    document.querySelectorAll('input[name="f-tecnicos"]').forEach(cb => {
      cb.disabled = true;
    });
    // Banner visual en el header del modal
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.id = 'reporte-modo-banner';
      banner.style.cssText = 'border-left: 3px solid var(--accent, #e8850a); background: var(--bg-card); color: var(--text-secondary); padding: 0.55rem 0.9rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; border-radius: 0 4px 4px 0;';
      banner.innerHTML = '<i data-lucide="lock" style="width:14px;height:14px;flex-shrink:0;color:var(--accent,#e8850a);"></i><span>Solo puedes editar el diagnostico y trabajos. Para modificar los datos generales usa el boton <strong>Editar</strong> (lapiz).</span>';
      const modalBody = document.querySelector('#modal-form .modal-body');
      if (modalBody) modalBody.insertBefore(banner, modalBody.firstChild);
      if (window.lucide) window.lucide.createIcons({ root: banner });
    }
  } else {
    // Asegurarse de remover el banner si existe (al abrir en modo edición normal)
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (existingBanner) existingBanner.remove();
  }

  // ===== Lógica de Autollenado de "Fecha de Servicio" desde PDF Extraído =====
  if (soporteActual) {
    window.autoFillFromPdfExtraction(soporteActual, !id);
  }

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.autoFillFromPdfExtraction = function(ticketId, force = false) {
  if (!window.supabaseClient || !ticketId) return;

  const elNoches = document.getElementById('f-noches');
  const elAlimento = document.getElementById('f-alimentacion');
  
  const nocVal = elNoches ? elNoches.value : '';
  const isNewOrEmpty = force || (nocVal === '' || nocVal === '0');
  console.log('[Auto-fill PDF] Evaluando ticket_id:', ticketId, 'isNewOrEmpty:', isNewOrEmpty);
  
  if (isNewOrEmpty) {
    window.supabaseClient
      .from('pdf_extracciones_ai')
      .select('extras, conceptos')
      .eq('ticket_id', ticketId)
      .order('fecha_extraccion', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const ext = data[0].extras || [];
          const viajeData = ext.find(x => x.isViajeData);
          console.log('[Auto-fill PDF] Datos de logística encontrados:', viajeData);
          if (viajeData) {
            if (elNoches && (elNoches.value === '' || elNoches.value === '0')) {
               elNoches.value = viajeData.num_hospedaje || 0;
               console.log('[Auto-fill PDF] Llenado f-noches con:', viajeData.num_hospedaje);
            }
            if (elAlimento && (elAlimento.value === '' || elAlimento.value === '0')) {
               elAlimento.value = viajeData.num_alimento || 0;
               console.log('[Auto-fill PDF] Llenado f-alimentacion con:', viajeData.num_alimento);
            }
            const elTraslado = document.getElementById('f-traslado-costo');
            if (elTraslado && (elTraslado.value === '' || elTraslado.value === '0')) {
               elTraslado.value = viajeData.num_traslado || 0;
               console.log('[Auto-fill PDF] Llenado f-traslado-costo con:', viajeData.num_traslado);
            }
          }
          
          // Auto-check Reembolso KM
          const elReembolso = document.getElementById('f-reembolso-km');
          if (elReembolso) {
            const allItems = [...ext, ...(data[0].conceptos || [])];
            const hasReembolso = allItems.some(x => !x.isViajeData && x.descripcion && x.descripcion.toLowerCase().includes('reembolso') && x.descripcion.toLowerCase().includes('km'));
            if (hasReembolso) {
              elReembolso.checked = true;
              console.log('[Auto-fill PDF] Reembolso KM detectado y marcado.');
            }
          }
        } else {
           console.log('[Auto-fill PDF] No se encontró extracción en BD o hubo error', error);
        }
      })
      .catch(err => console.warn('[Auto-fill PDF] Error:', err));
  }
};

function onSoporteChange() {
  const soporteId = document.getElementById('f-soporte').value;
  const inPedido = document.getElementById('f-pedido');
  const metaDiv = document.getElementById('soporte-meta');
  const inTecnico = document.getElementById('f-tecnico');
  
  if (soporteId) {
    const t = tickets.find(x => x.id === soporteId);
    if (t) {
      if (t.pedidoSAP) {
        inPedido.value = t.pedidoSAP;
        inPedido.readOnly = true;
        inPedido.style.background = 'var(--bg-secondary)';
      }
      metaDiv.innerHTML = `<i data-lucide="info" style="width:12px;height:12px;vertical-align:middle;"></i> <strong>Ticket ${t.folio}</strong> ligado &bull; Cotización SAP: ${t.cotizacionSAP || 'N/A'}`;
      metaDiv.style.display = 'block';
      
      const comboEquipo = document.getElementById('f-equipo');
      if (comboEquipo && t.equipo && (!editandoId || !comboEquipo.value)) {
        if (!Array.from(comboEquipo.options).some(o => o.value === t.equipo)) {
           const opt = document.createElement('option');
           opt.value = t.equipo;
           opt.textContent = `${t.equipo} (Del Ticket)`;
           let parsedSerie = '';
           if (t.equipo.includes('(SN: ')) {
             parsedSerie = t.equipo.split('(SN: ')[1].replace(')', '').trim();
           }
           opt.setAttribute('data-serie', parsedSerie);
           opt.setAttribute('data-modelo', t.equipo.split('(SN:')[0].trim());
           opt.setAttribute('data-ubicacion', t.sitio || '');
           comboEquipo.appendChild(opt);
        }
        comboEquipo.value = t.equipo;
        if (typeof onEquipoOrdenChange === 'function') onEquipoOrdenChange();
        
        // Si f-ubicacion sigue vacío, llenarlo con el sitio del ticket si existe
        const inUbicacion = document.getElementById('f-ubicacion');
        if (inUbicacion && !inUbicacion.value && t.sitio) {
          inUbicacion.value = t.sitio;
        }
      }
      
      const inHorometro = document.getElementById('f-horometro');
      if (inHorometro && t.horometro && (!editandoId || !inHorometro.value)) {
        inHorometro.value = t.horometro;
      }
      
      // Auto-fill logística and Reembolso KM from PDF
      window.autoFillFromPdfExtraction(t.id, true);
      
      // Técnicos se extraen en background durante el guardado
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } else {
    inPedido.value = '';
    inPedido.readOnly = false;
    inPedido.style.background = '';
    if (metaDiv) metaDiv.style.display = 'none';
  }
}

function editarOrden(id) {
  const o = ordenes.find(x => x.id === id);
  if (o && (((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf)) && !['superadmin', 'admin'].includes(currentSession.viewMode)) {
    mostrarNotificacion('Esta orden ya fue firmada o cerrada en papel. Solo administradores pueden editarla.', 'error');
    return;
  }
  abrirFormulario(id);
}

function cerrarFormulario(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editandoId = null;
  // Limpiar banner de modo reporte si existe
  const banner = document.getElementById('reporte-modo-banner');
  if (banner) banner.remove();
}

function guardarOrdenes() {
  // Ya no se guardan en localStorage
}

async function guardarOrden(e) {
  e.preventDefault();
  
  const btnGuardar = document.querySelector('#modal-reporte button[type="submit"]') || e.target.querySelector('button[type="submit"]');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    if (!btnGuardar.dataset.originalText) btnGuardar.dataset.originalText = btnGuardar.textContent;
    btnGuardar.textContent = 'Guardando...';
  }

  const restoreBtn = () => {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = btnGuardar.dataset.originalText;
    }
  };

  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'Servicio';
  let tecnicosSeleccionados = [];
  const soporteIdGuardar = document.getElementById('f-soporte').value.trim();
  const oVieja = editandoId ? (ordenes.find(x => x.id === editandoId) || {}) : null;

  // VALIDACIÓN: Avisar si cambiaron los días de hospedaje/alimentos vs ticket extraído
  const inputNoches = Number(document.getElementById('f-noches')?.value || 0);
  const inputAlimentacion = Number(document.getElementById('f-alimentacion')?.value || 0);
  
  if (soporteIdGuardar && window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('pdf_extracciones_ai')
        .select('extras')
        .eq('ticket_id', soporteIdGuardar)
        .order('fecha_extraccion', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const ext = data[0].extras || [];
        const viajeData = ext.find(x => x.isViajeData);
        if (viajeData) {
          const extHospedaje = Number(viajeData.num_hospedaje || 0);
          const extAlimento = Number(viajeData.num_alimento || 0);
          
          let advertencias = [];
          if (inputNoches !== extHospedaje) {
            const dif = inputNoches - extHospedaje;
            const diffText = dif > 0 ? `+${dif}` : `${dif}`;
            advertencias.push(`- Noches/Hospedajes: Extraídas ${extHospedaje}, Capturadas ${inputNoches} (Cambio: ${diffText})`);
          }
          if (inputAlimentacion !== extAlimento) {
            const dif = inputAlimentacion - extAlimento;
            const diffText = dif > 0 ? `+${dif}` : `${dif}`;
            advertencias.push(`- Alimentos: Extraídos ${extAlimento}, Capturados ${inputAlimentacion} (Cambio: ${diffText})`);
          }
          
          if (advertencias.length > 0) {
            const msj = `⚠️ ADVERTENCIA DE VIÁTICOS ⚠️\n\nHas modificado los viáticos respecto a lo que se extrajo automáticamente del Ticket:\n\n${advertencias.join('\n')}\n\n¿Estás seguro de que deseas guardar la orden con estos valores modificados?`;
            if (!confirm(msj)) {
              restoreBtn();
              return; // Detiene el guardado
            } else {
               window._viaticosWarningToSave = `⚠️ Se modificaron los viáticos manualmente respecto a los extraídos del Ticket. ${advertencias.join(' | ')}`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Validation] Error al verificar viáticos:', err);
    }
  }

  if (oVieja && (oVieja.tecnicosAsignados?.length > 0 || oVieja.tecnico)) {
    tecnicosSeleccionados = oVieja.tecnicosAsignados || oVieja.tecnico.split(',').map(s => s.trim());
  } else if (soporteIdGuardar) {
    const t = tickets.find(x => x.id === soporteIdGuardar);
    if (t) {
      if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) {
        tecnicosSeleccionados = t.tecnicosAsignados;
      } else if (t.asignado && t.asignado !== 'Sin asignar') {
        tecnicosSeleccionados = t.asignado.split(',').map(s => s.trim());
      }
    }
  }

  // Si el usuario que guarda es técnico, nos aseguramos de que esté asignado a la orden
  if (currentSession.viewMode === 'tecnico') {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';
    if (miTecnicoNombre && !tecnicosSeleccionados.includes(miTecnicoNombre)) {
      tecnicosSeleccionados.push(miTecnicoNombre);
    }
  }

  let folioVal = document.getElementById('f-folio').value.trim();
  if (!editandoId && isTestModeActive()) {
    if (folioVal && !folioVal.startsWith('[PRUEBA]')) {
      folioVal = `[PRUEBA] ${folioVal}`;
    }
  }

  let equipoVal = '';
  const chips = Array.from(document.querySelectorAll('#f-equipos-seleccionados .maquina-chip')).map(c => c.getAttribute('data-value'));
  if (chips.length > 0) {
    equipoVal = chips.join(', ');
  } else {
    equipoVal = document.getElementById('f-equipo')?.value || '';
  }

  if (!equipoVal) {
    mostrarNotificacion('Debe seleccionar al menos una máquina.', 'error');
    restoreBtn();
    return;
  }

  let marcasVal = '';
  let maquinariaId = null;
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const matchMaquina = (m, name) => {
    const cleanId = m.idInterno || m.id || '';
    const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
    const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
    const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
    const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
    return name === mName || name === cleanId || name === m.serie;
  };

  if (chips.length > 0) {
    const marcasArr = [];
    chips.forEach(cName => {
      let maq = null;
      clientesDb.forEach(c => {
        if (c.maquinas) {
          const found = c.maquinas.find(m => matchMaquina(m, cName));
          if (found) maq = found;
        }
      });
      if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, cName));
      if (maq) {
        if (maq.marca) marcasArr.push(maq.marca);
        if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
      }
    });
    marcasVal = [...new Set(marcasArr)].join(', ');
  } else {
    marcasVal = document.getElementById('f-equipo')?.options[document.getElementById('f-equipo')?.selectedIndex]?.getAttribute('data-marca') || '';
    maquinariaId = oVieja ? oVieja.maquinaria_id : null;
  }

  const orden = {
    id: editandoId || folioVal,
    fecha: oVieja ? oVieja.fecha : getLocalDateString(),
    folio: folioVal,
    pedido: document.getElementById('f-pedido').value.trim(),
    cliente: document.getElementById('f-cliente').value.trim(),
    ubicacion: document.getElementById('f-ubicacion').value.trim(),
    ubicacion_sitio: document.getElementById('f-ubicacion-sitio').value.trim(),
    operador: document.getElementById('f-operador').value.trim(),
    eco: document.getElementById('f-eco').value.trim(),
    horometro: document.getElementById('f-horometro').value.trim(),
    horometro_real: document.getElementById('f-horometro-real').value.trim(),
    equipo: equipoVal,
    marca: marcasVal,
    maquinaria_id: maquinariaId,
    modelo: document.getElementById('f-modelo').value.trim(),
    serie: document.getElementById('f-serie').value.trim(),
    tecnico: tecnicosSeleccionados.join(', '),
    tecnicosAsignados: tecnicosSeleccionados,
    creadoPor: oVieja ? (oVieja.creadoPor || oVieja.tecnico) : (usuarios.find(u => u.id === currentSession.userId)?.nombre || ''),
    soporte: document.getElementById('f-soporte').value.trim(),
    km_ida: document.getElementById('f-km-ida').value,
    km_vuelta: document.getElementById('f-km-vuelta').value,
    km_total: document.getElementById('f-km-total').value,
    tipo,
    estado: document.getElementById('f-estado').value,
    falla: document.getElementById('f-falla').value.trim(),
    trabajos: document.getElementById('f-trabajos').value.trim(),
    dictamen: document.getElementById('f-dictamen').value.trim(),
    condiciones: document.getElementById('f-condiciones').value.trim(),
    observaciones: document.getElementById('f-observaciones').value.trim(),
    pendientes: document.getElementById('f-pendientes').value.trim(),
    ref_utilizadas: getRefacciones('utilizadas'),
    ref_necesarias: getRefacciones('necesarias'),
    factura_ref: '',
    factura_mo: '',
    noches: document.getElementById('f-noches').value,
    alimentacion: document.getElementById('f-alimentacion').value,
    traslado_costo: document.getElementById('f-traslado-costo').value,
    reembolso_km: document.getElementById('f-reembolso-km') ? document.getElementById('f-reembolso-km').checked : false,
    dias: getDiasData(),
    esPrueba: oVieja ? (oVieja.esPrueba || false) : isTestModeActive(),
    evidencias: oVieja ? (oVieja.evidencias || { fotoInicio: null, fotoFin: null, adicionales: [] }) : { fotoInicio: null, fotoFin: null, adicionales: [] }
  };
  
  // VALIDACIÓN: Refacciones utilizadas obligatorias con foto (omitir si cantidad es 0)
  const refSinFoto = orden.ref_utilizadas.find(ref => !ref.fotoUrl && ref.descripcion && parseFloat(ref.cantidad || 0) > 0);
  if (refSinFoto) {
    if (currentSession.viewMode === 'tecnico') {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`Es obligatorio subir la fotografía para la refacción: ${refSinFoto.descripcion}`, 'error');
      }
      restoreBtn();
      return;
    } else {
      const continuar = confirm(`⚠️ Falta la fotografía para la refacción: ${refSinFoto.descripcion}.\n\n¿Estás seguro de que deseas guardar la orden sin esta evidencia fotográfica?`);
      if (!continuar) {
        restoreBtn();
        return;
      }
    }
  }

  // VALIDACIÓN: Justificación de discrepancia obligatoria
  const refConDiscrepanciaSinJustificar = orden.ref_utilizadas.find(ref => 
    ref.isFromPdf && 
    parseFloat(ref.cantidad || 0) !== parseFloat(ref.originalPdfCantidad || 0) && 
    (!ref.justificacion_discrepancia || !ref.justificacion_discrepancia.trim())
  );

  if (refConDiscrepanciaSinJustificar) {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Es obligatorio ingresar el motivo de la discrepancia para la refacción: ${refConDiscrepanciaSinJustificar.descripcion}`, 'error');
    } else {
      alert(`Es obligatorio ingresar el motivo de la discrepancia para la refacción: ${refConDiscrepanciaSinJustificar.descripcion}`);
    }
    restoreBtn();
    return;
  }

  if (oVieja) {
    orden.bitacora = oVieja.bitacora || [];
    orden.firma_tecnico_base64 = oVieja.firma_tecnico_base64;
    orden.firma_tecnico_nombre = oVieja.firma_tecnico_nombre;
    orden.firma_tecnico_fecha = oVieja.firma_tecnico_fecha;
    orden.firma_cliente_base64 = oVieja.firma_cliente_base64;
    orden.firma_cliente_nombre = oVieja.firma_cliente_nombre;
    orden.firma_cliente_fecha = oVieja.firma_cliente_fecha;
    orden.evidenciaBase64 = oVieja.evidenciaBase64 || oVieja.evidencia_base64;
  } else {
    orden.bitacora = [];
  }

  if (window._viaticosWarningToSave) {
    orden.bitacora.push({
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      tecnico: currentSession.viewMode === 'tecnico' ? (usuarios.find(u => u.id === currentSession.userId)?.nombre || 'Sistema') : 'Sistema',
      tipo: 'Aviso del Sistema',
      nota: window._viaticosWarningToSave
    });
    window._viaticosWarningToSave = null;
  }
  
  // Computar estado automático o manual si es superadmin
  if (currentSession.viewMode === 'superadmin') {
    orden.estado = document.getElementById('f-estado').value;
  } else {
    orden.estado = calcularEstadoOrden(orden);
    document.getElementById('f-estado').value = orden.estado; // update UI state
  }

  if (oVieja) {
    ordenes = ordenes.map(o => o.id === editandoId ? orden : o);
  } else {
    ordenes.unshift(orden);
  }
  
  // Auto-cerrar el ticket relacionado
  if (orden.soporte) {
    const tIndex = tickets.findIndex(t => t.id === orden.soporte);
    if (tIndex >= 0 && tickets[tIndex].estado !== 'Cerrado') {
      tickets[tIndex].estado = 'Cerrado';
      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        window.pushToSupabase('tickets', tickets[tIndex]);
      }
      updateTicketBadge(); updateOrdenesBadge();
      if (typeof renderTickets === 'function') renderTickets();
    }
  }

  // Guardar siempre en local como respaldo
  safeSetJSON('sapi_ordenes', ordenes);

  if (window.supabaseClient) {
    window.pushToSupabase('ordenes', orden);
  }
  
  if (typeof window.crearOActualizarTicketRefacciones === 'function') {
    try {
      await window.crearOActualizarTicketRefacciones(orden);
    } catch (err) {
      console.error('[App] Error al generar/actualizar el ticket de refacciones:', err);
    }
  }
  if (window.trackTelemetryEvent) {
    let act = editandoId ? 'Edición de Orden' : 'Creación de Orden';
    if (editandoId && currentSession.viewMode === 'tecnico') {
      act = 'Llenado de Orden (Técnico)';
    }
    window.trackTelemetryEvent(act, { folio: orden.folio, cliente: orden.cliente });
  }
  
  restoreBtn();
  cerrarFormulario();
  renderTabla();
  renderTabla('servicios');
  renderStats();
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}

// ===== ELIMINAR =====
async function eliminarOrden(id) {
  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Orden de Servicio',
    mensaje: '¿Estás seguro de que deseas eliminar esta orden de servicio?',
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;
  const o = ordenes.find(x => x.id === id);
  const folio = o ? o.folio : 'Desconocido';

  ordenes = ordenes.filter(o => o.id !== id);
  safeSetJSON('sapi_ordenes', ordenes);
  
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('ordenes', id);
  }
  if (window.trackTelemetryEvent) {
    window.trackTelemetryEvent('Eliminación de Orden', { id, folio });
  }
  renderTabla();
  renderTabla('servicios');
  renderStats();
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}

function completarReporteDesdeDetalle(id) {
  cerrarDetalle();
  setTimeout(() => {
    abrirFormulario(id, true); // true = modoReporte: solo permite editar el reporte técnico
  }, 100);
}

// ===== EVIDENCIA FOTOGRÁFICA Y STORAGE =====
function renderEvidenciasFotograficas(o) {
  const ev = o.evidencias || { fotoInicio: null, fotoFin: null, adicionales: [] };
  const adicionales = ev.adicionales || [];
  const isClosed = (
    (o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || 
    o.estado === 'Cerrado' || 
    o.estado === 'Cerrada' || 
    o.estado === 'Finalizado' || 
    o.estado === 'Refacciones pendientes' || 
    o.cierre_papel_pdf ||
    (!(!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__') && o.firma_cliente_base64 !== '__DELETED__') || 
    (!(!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__') && o.firma_tecnico_base64 !== '__DELETED__')
  );
  
  const tieneInicio = !!ev.fotoInicio;
  const tieneFin = !!ev.fotoFin;
  const tieneUbicacionSitio = !!(o.ubicacion_sitio && o.ubicacion_sitio.trim());
  const tieneOperador = !!(o.operador && o.operador.trim());
  const listos = tieneInicio && tieneFin && tieneUbicacionSitio && tieneOperador;

  let alertHtml = '';
  if (listos) {
    alertHtml = `
      <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); color:#10b981; border-radius:8px; padding:0.75rem 1rem; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;">
        <i data-lucide="check-circle" style="width:16px;height:16px;"></i> Requisitos y evidencias cargadas correctamente. Firma de conformidad habilitada.
      </div>
    `;
  } else {
    let faltantes = [];
    if (!tieneUbicacionSitio) faltantes.push("la Ubicación en Sitio");
    if (!tieneOperador) faltantes.push("el Operador");
    if (!tieneInicio || !tieneFin) faltantes.push("la Foto de Inicio y Fin");

    alertHtml = `
      <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); color:#d97706; border-radius:8px; padding:0.75rem 1rem; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;">
        <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i> Se requiere registrar: ${faltantes.join(', ')} para poder firmar y completar el servicio.
      </div>
    `;
  }

  const renderTarjetaFoto = (titulo, tipo, url, obligatoria) => {
    const isConsulta = currentSession.viewMode === 'consulta' || isClosed;
    const uploadBtn = isConsulta ? '' : `
      <label class="btn-primary" style="font-size:0.72rem; min-height:auto; padding:0.35rem 0.75rem; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem; margin-top:0.5rem;">
        <i data-lucide="upload" style="width:12px;height:12px;"></i> ${url ? 'Reemplazar' : 'Cargar Foto'}
        <input type="file" accept="image/*" onchange="subirEvidenciaFoto('${o.id}', '${tipo}', this)" style="display:none;" />
      </label>
    `;

    const hasImage = !!url;

    return `
      <div style="flex:1; min-width:200px; background:var(--bg-body); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; align-items:center; gap:0.5rem; box-shadow:0 2px 5px rgba(0,0,0,0.02); transition:var(--transition); position:relative;">
        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:0.25rem;">
          ${obligatoria ? '<span style="color:var(--red); font-size:1.1rem; line-height:0.5; margin-right:2px;">*</span>' : ''} ${titulo}
        </div>
        <div style="width:100%; height:130px; border-radius:6px; border:1px solid var(--border); overflow:hidden; background:var(--bg-card); display:flex; justify-content:center; align-items:center; position:relative;">
          ${hasImage 
            ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.previsualizarImagenCompleta('${url}', '${titulo}')" title="Haga clic para ver en pantalla completa" />
               ${isConsulta ? '' : `
                 <button type="button" onclick="eliminarEvidenciaFoto('${o.id}', '${tipo}', '${url}')" style="position:absolute; top:4px; right:4px; width:24px; height:24px; border-radius:50%; background:rgba(239,68,68,0.9); border:none; color:white; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.15);" title="Eliminar evidencia">
                   <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                 </button>
               `}
              ` 
            : `<div style="color:var(--text-muted); opacity:0.5; text-align:center; font-size:0.75rem; display:flex; flex-direction:column; gap:0.25rem; align-items:center; justify-content:center;">
                 <i data-lucide="camera" style="width:24px;height:24px;"></i>
                 <span>Sin imagen cargada</span>
               </div>`
          }
        </div>
        ${uploadBtn}
      </div>
    `;
  };

  const renderAdicionalesHtml = () => {
    const isConsulta = currentSession.viewMode === 'consulta' || isClosed;
    const uploadBtn = isConsulta ? '' : `
      <label style="display:flex; flex-shrink:0; width:100px; height:100px; border:2px dashed var(--border); border-radius:6px; background:var(--bg-body); flex-direction:column; gap:0.25rem; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted); transition:var(--transition); position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.01); margin:0;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
        <i data-lucide="plus" style="width:16px;height:16px;"></i>
        <span style="font-size:0.65rem; font-weight:600;">Subir foto</span>
        <input type="file" accept="image/*" onchange="subirEvidenciaFoto('${o.id}', 'adicional', this)" style="display:none;" />
      </label>
    `;

    const fotosList = adicionales.map((url, idx) => `
      <div style="width:100px; height:100px; border-radius:6px; border:1px solid var(--border); overflow:hidden; position:relative; background:var(--bg-card); flex-shrink:0;">
        <img src="${url}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.previsualizarImagenCompleta('${url}', 'Evidencia Adicional ${idx + 1}')" />
        ${isConsulta ? '' : `
          <button type="button" onclick="eliminarEvidenciaFoto('${o.id}', 'adicional', '${url}')" style="position:absolute; top:3px; right:3px; width:18px; height:18px; border-radius:50%; background:rgba(239,68,68,0.95); border:none; color:white; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" title="Eliminar foto">
            <i data-lucide="trash-2" style="width:10px;height:10px;"></i>
          </button>
        `}
      </div>
    `).join('');

    return `
      <div style="display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:0.75rem; align-items:center;">
        ${fotosList}
        ${uploadBtn}
      </div>
    `;
  };

  // === VISTA DE IMPRESIÓN PARA EVIDENCIAS (FOTOS GRANDES Y LIMPIAS) ===
  let printEvidenciasHtml = '';
  if (tieneInicio || tieneFin || adicionales.length > 0) {
    printEvidenciasHtml += `
      <div style="display:flex; flex-direction:column; gap:1.5rem; margin-top:0.5rem;">
        <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
    `;

    if (tieneInicio) {
      printEvidenciasHtml += `
        <div style="flex:1; min-width:280px; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Inicio (Entrada)</div>
          <div style="height:220px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
            <img src="${ev.fotoInicio}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
        </div>
      `;
    }

    if (tieneFin) {
      printEvidenciasHtml += `
        <div style="flex:1; min-width:280px; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Fin (Salida)</div>
          <div style="height:220px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
            <img src="${ev.fotoFin}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
        </div>
      `;
    }

    printEvidenciasHtml += `
        </div>
    `;

    if (adicionales.length > 0) {
      printEvidenciasHtml += `
        <div style="margin-top:0.5rem;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.75rem; text-transform:uppercase;">Evidencias Adicionales</div>
          <div style="display:flex; flex-wrap:wrap; gap:1rem; justify-content:flex-start;">
      `;

      adicionales.forEach((url, idx) => {
        printEvidenciasHtml += `
          <div style="border:1px solid #d1d5db; border-radius:6px; padding:0.5rem; background:#f9fafb; text-align:center; width:200px;">
            <div style="font-size:0.65rem; font-weight:600; color:#4b5563; margin-bottom:0.35rem;">Adicional ${idx + 1}</div>
            <div style="height:140px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
              <img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </div>
          </div>
        `;
      });

      printEvidenciasHtml += `
          </div>
        </div>
      `;
    }

    printEvidenciasHtml += `
      </div>
    `;
  } else {
    printEvidenciasHtml = '<p style="color:#000; font-size:0.8rem; font-style:italic;">Sin fotos de evidencia cargadas.</p>';
  }

  return `
    <div class="no-print" style="margin-top:0.5rem;">
      ${alertHtml}
      <div style="display:flex; flex-wrap:wrap; gap:1.25rem;">
        ${renderTarjetaFoto('FOTO DE INICIO (Entrada)', 'fotoInicio', ev.fotoInicio, true)}
        ${renderTarjetaFoto('FOTO DE FIN (Salida)', 'fotoFin', ev.fotoFin, true)}
      </div>
      <div style="margin-top:1.5rem; border-top:1px solid var(--border); padding-top:1rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Evidencias Adicionales (Opcionales)</div>
        ${renderAdicionalesHtml()}
      </div>
    </div>
    <div class="print-only">
      ${printEvidenciasHtml}
    </div>
  `;
}

window.previsualizarImagenCompleta = function(url, titulo) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '100000';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.innerHTML = `
    <div style="position:relative; max-width:90%; max-height:90%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; outline:none;">
      <h3 style="color:white; margin:0; font-size:1.1rem; text-shadow:0 2px 4px rgba(0,0,0,0.5);">${titulo}</h3>
      <img src="${url}" style="max-width:100%; max-height:80vh; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); object-fit:contain;" />
      <button onclick="this.closest('.modal-overlay').remove()" style="position:absolute; top:-35px; right:-15px; background:none; border:none; color:white; font-size:2rem; cursor:pointer;" title="Cerrar">&times;</button>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.abrirImagenEnPestana = function(ticketId) {
  const t = (window.tickets || []).find(x => x.id === ticketId);
  const src = (t && t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') ? t.pdfCotizacion : (t?.foto || t?.evidencia);
  if (src) {
    const win = window.open();
    if (win) {
      win.document.write(`<title>Evidencia Fotográfica Ticket ${t?.folio || ''}</title><body style="margin:0; background:#111; display:flex; align-items:center; justify-content:center; min-height:100vh;"><img src="${src}" style="max-width:100%; max-height:100vh; object-fit:contain;" /></body>`);
    }
  }
};

window.subirEvidenciaFoto = async function(ordenId, tipo, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;

  const hasTecnicoFirma = o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__';
  const hasClienteFirma = o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__';
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf) || hasTecnicoFirma || hasClienteFirma) {
    mostrarNotificacion('No se pueden modificar evidencias en una orden cerrada o con firmas.', 'error');
    return;
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Comprimiendo y preparando imagen...', 'info');
  }

  const compressImage = (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = (e) => reject(e);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 1200;
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("La compresión de imagen falló (Blob vacío)"));
              }, 'image/jpeg', 0.85);
            } else {
              // Fallback para navegadores antiguos/Safari que no soportan toBlob directamente
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while(n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              const blob = new Blob([u8arr], {type:mime});
              resolve(blob);
            }
          } catch (err) {
            reject(err);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(imageFile);
    });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  try {
    const compressedBlob = await compressImage(file);
    const uniqueName = `${tipo}_${Date.now()}_${Math.random().toString(36).substring(2,7)}.jpg`;
    const filePath = `ordenes/${ordenId}/${uniqueName}`.replace(/[\[\]\*?]/g, '');

    let publicUrl = null;
    let savedOffline = false;

    // Si estamos offline o no hay supabaseClient, guardar directo en base64
    if (!navigator.onLine || !window.supabaseClient) {
      const base64Data = await blobToBase64(compressedBlob);
      publicUrl = base64Data;
      savedOffline = true;
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Imagen guardada localmente (Modo Offline)', 'info');
      }
    } else {
      try {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Subiendo imagen a Supabase Storage...', 'info');
        }

        const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
          .from('evidencias')
          .upload(filePath, compressedBlob, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadErr) {
          throw uploadErr;
        }

        const { data: urlData } = window.supabaseClient.storage
          .from('evidencias')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Fallo la subida directa (guardando como base64 local para sincronizar después):", err);
        const base64Data = await blobToBase64(compressedBlob);
        publicUrl = base64Data;
        savedOffline = true;
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Guardado localmente (Fallo de red al subir)', 'warning');
        }
      }
    }

    if (!o.evidencias) o.evidencias = { fotoInicio: null, fotoFin: null, adicionales: [] };
    
    if (tipo === 'fotoInicio') {
      o.evidencias.fotoInicio = publicUrl;
    } else if (tipo === 'fotoFin') {
      o.evidencias.fotoFin = publicUrl;
    } else if (tipo === 'adicional') {
      if (!o.evidencias.adicionales) o.evidencias.adicionales = [];
      o.evidencias.adicionales.push(publicUrl);
    }

    safeSetJSON('sapi_ordenes', ordenes);
    if (window.pushToSupabase) {
      await window.pushToSupabase('ordenes', o);
    }

    if (window.trackTelemetryEvent) {
      const labelFoto = tipo === 'fotoInicio' ? 'Foto de Inicio' : (tipo === 'fotoFin' ? 'Foto de Fin' : 'Foto Adicional');
      window.trackTelemetryEvent('Carga de Evidencia', { id: ordenId, folio: o.folio, tipo: labelFoto });
    }

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(savedOffline ? 'Evidencia guardada localmente (Offline)' : 'Evidencia fotográfica subida correctamente.', 'success');
    }

    verDetalle(ordenId);
  } catch (err) {
    console.error("Error en subirEvidenciaFoto:", err);
    alert("Ocurrió un error inesperado al subir la imagen.");
  }
};

window.subirFotoRefaccion = async function(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  const container = inputEl.parentElement;
  const btn = container.querySelector('.ref-foto-btn');
  const preview = container.querySelector('.ref-foto-preview');
  const urlHidden = container.querySelector('.ref-foto-url');

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Comprimiendo y preparando imagen...', 'info');
  }

  const compressImage = (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = (e) => reject(e);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1200;
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("La compresión falló"));
              }, 'image/jpeg', 0.85);
            } else {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while(n--) { u8arr[n] = bstr.charCodeAt(n); }
              resolve(new Blob([u8arr], {type:mime}));
            }
          } catch (err) { reject(err); }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(imageFile);
    });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  try {
    const compressedBlob = await compressImage(file);
    let publicUrl = null;
    let savedOffline = false;

    if (!navigator.onLine || !window.supabaseClient) {
      publicUrl = await blobToBase64(compressedBlob);
      savedOffline = true;
    } else {
      try {
        if (window.mostrarNotificacion) window.mostrarNotificacion('Subiendo a la nube...', 'info');
        const uniqueName = `refaccion_${Date.now()}_${Math.random().toString(36).substring(2,7)}.jpg`;
        // Put in a general 'refacciones' path inside evidencias
        const filePath = `refacciones/${uniqueName}`;
        
        const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
          .from('evidencias')
          .upload(filePath, compressedBlob, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = window.supabaseClient.storage
          .from('evidencias')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Fallo subida directa:", err);
        publicUrl = await blobToBase64(compressedBlob);
        savedOffline = true;
      }
    }

    urlHidden.value = publicUrl;
    btn.style.display = 'none';
    preview.style.display = 'flex';
    
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(savedOffline ? 'Guardado localmente' : 'Foto de refacción lista', 'success');
    }
  } catch (err) {
    console.error("Error al procesar foto de refacción:", err);
    alert("Ocurrió un error al procesar la fotografía.");
  }
};

window.eliminarEvidenciaFoto = async function(ordenId, tipo, url) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o || !o.evidencias) return;

  const hasTecnicoFirma = o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__';
  const hasClienteFirma = o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__';
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf) || hasTecnicoFirma || hasClienteFirma) {
    mostrarNotificacion('No se pueden modificar evidencias en una orden cerrada o con firmas.', 'error');
    return;
  }

  const confirmado = await window.confirmarAccion({
    titulo: 'Quitar Evidencia',
    mensaje: '¿Estás seguro de que deseas quitar esta foto de evidencia?',
    esPeligroso: true,
    icono: 'trash-2'
  });
  if (!confirmado) return;

  if (tipo === 'fotoInicio') {
    o.evidencias.fotoInicio = null;
  } else if (tipo === 'fotoFin') {
    o.evidencias.fotoFin = null;
  } else if (tipo === 'adicional') {
    o.evidencias.adicionales = (o.evidencias.adicionales || []).filter(x => x !== url);
  }

  safeSetJSON('sapi_ordenes', ordenes);
  if (window.pushToSupabase) {
    await window.pushToSupabase('ordenes', o);
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Foto removida correctamente.', 'info');
  }

  verDetalle(ordenId);
};

// ===== DETALLE =====
function verDetalle(id) {
  let o = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes.find(x => x && x.id === id) : null;
  if (!o) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const targetNorm = norm(id);
    const targetNum = String(id).replace(/[^0-9]/g, '');
    let pool = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? [...ordenes] : [];
    if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) pool = pool.concat(window.ordenes);
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      if (Array.isArray(local)) pool = pool.concat(local);
    } catch (e) {}
    o = pool.find(x => x && (x.id === id || x.folio === id || norm(x.folio || x.id) === targetNorm || (targetNum.length >= 4 && String(x.folio || '').replace(/[^0-9]/g, '') === targetNum)));
  }
  if (!o) return;
  const actualId = o.id || id;
  document.getElementById('detalle-title').textContent = `Orden ${o.folio || o.id.slice(0,8)}`;
  
  const btnCierrePapel = document.getElementById('btn-cierre-papel');
  if (btnCierrePapel) {
    const isAllowedRole = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
    const orderClosed = ['completado', 'cerrada', 'cerrado', 'finalizado'].includes(String(o.estado || '').toLowerCase()) || o.cierre_papel_pdf;
    if (isAllowedRole && !orderClosed) {
      btnCierrePapel.style.display = 'flex';
      btnCierrePapel.setAttribute('onclick', `abrirCierrePapel('${actualId}')`);
    } else {
      btnCierrePapel.style.display = 'none';
    }
  }

  const btnCompletar = document.getElementById('btn-completar-reporte');
  if (btnCompletar) {
    const hasCierrePapel = !!o.cierre_papel_pdf;
    if (currentSession.viewMode !== 'consulta' && !hasCierrePapel && (!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__')) {
      btnCompletar.style.display = 'flex';
      btnCompletar.setAttribute('onclick', `completarReporteDesdeDetalle('${actualId}')`);
    } else {
      btnCompletar.style.display = 'none';
    }
  }

  const btnAsignarTecs = document.getElementById('btn-asignar-tecnicos');
  if (btnAsignarTecs) {
    if (['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) && o.estado !== 'Finalizado') {
      btnAsignarTecs.style.display = 'flex';
    } else {
      btnAsignarTecs.style.display = 'none';
    }
  }

  const btnEnviarCorreo = document.getElementById('btn-enviar-correo');
  if (btnEnviarCorreo) {
    if (currentSession.viewMode === 'tecnico') {
      btnEnviarCorreo.style.display = 'none';
    } else {
      btnEnviarCorreo.style.display = 'flex';
      btnEnviarCorreo.setAttribute('onclick', `enviarCorreoOrden('${actualId}')`);
    }
  }

  const btnImprimir = document.getElementById('btn-imprimir-orden');
  if (btnImprimir) {
    if (currentSession.viewMode === 'tecnico') {
      btnImprimir.style.display = 'none';
    } else {
      btnImprimir.style.display = 'flex';
    }
  }

  window.currentDetalleOrdenId = actualId;

  const renderBitacora = (o) => {
    let html = '';
    const isClosed = (['completado', 'cerrada', 'cerrado', 'finalizado'].includes(String(o.estado || '').toLowerCase())) && ((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf);
    const isTecnico = currentSession.viewMode === 'tecnico';
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';

    let items = [...(o.bitacora || [])];
    // Mostrar todo el historial de la orden sin ocultar las bitácoras registradas por otros compañeros de equipo

    // Unificación inteligente reactiva con eventos de calendario
    try {
      const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
      const normStr = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      localEventos.forEach(ev => {
        if (ev.ordenId === o.id) {
          if (isTecnico && miTecnicoNombre && normStr(ev.tecnicoNombre) !== normStr(miTecnicoNombre)) {
            return;
          }
          // Extraer fecha local simple (YYYY-MM-DD)
          let fISO = '';
          if (ev.fechaInicio || ev.start) {
            const dateVal = ev.fechaInicio || ev.start;
            if (dateVal.includes('T')) {
              const dI = new Date(dateVal);
              fISO = `${dI.getFullYear()}-${String(dI.getMonth() + 1).padStart(2, '0')}-${String(dI.getDate()).padStart(2, '0')}`;
            } else {
              fISO = dateVal.substring(0, 10);
            }
          }
          if (!fISO) return;

          // Extraer horas de entrada y salida locales
          let ent = '';
          let sal = '';
          try {
            if (ev.fechaInicio || ev.start) {
              const dateVal = ev.fechaInicio || ev.start;
              if (dateVal.includes('T')) {
                const dI = new Date(dateVal);
                ent = `${String(dI.getHours()).padStart(2, '0')}:${String(dI.getMinutes()).padStart(2, '0')}`;
              }
            }
            if (ev.fechaFin || ev.end) {
              const dateVal = ev.fechaFin || ev.end;
              if (dateVal.includes('T')) {
                const dF = new Date(dateVal);
                sal = `${String(dF.getHours()).padStart(2, '0')}:${String(dF.getMinutes()).padStart(2, '0')}`;
              }
            }
          } catch(e){}

          // Verificar si ya existe en la bitácora
          const existe = items.some(b => b.id === ev.id || (b.fecha === fISO && b.tecnico === ev.tecnicoNombre && b.entrada === ent));
          
          if (!existe) {
            items.push({
              id: ev.id,
              fecha: fISO,
              tecnico: ev.tecnicoNombre || 'Sin Asignar',
              nota: ev.descripcion || "Programado por supervisor. Pendiente de llenado por el técnico.",
              entrada: ent,
              salida: sal,
              realizado: false,
              asignadoPorName: ev.creadoPorNombre || 'Supervisor'
            });
          }
        }
      });
    } catch(e){}

    // Separar pendientes de realizados
    const pendientes = items.filter(b => b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true));
    const realizados = items.filter(b => b.realizado === true || (!pendientes.some(p => p.id === b.id)));

    // 1. Renderizar Asignaciones Programadas (Pendientes)
    if (pendientes.length > 0) {
      html += `
        <div style="margin-bottom:1.5rem; background:rgba(139, 92, 246, 0.02); border: 1px solid rgba(139, 92, 246, 0.1); border-radius:10px; padding:1.25rem;">
          <h4 style="font-size:0.82rem; font-weight:700; color:#8b5cf6; text-transform:uppercase; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; border-bottom:1px solid rgba(139, 92, 246, 0.15); padding-bottom:0.5rem; margin-top:0;">
            <i data-lucide="calendar" style="width:16px; height:16px;"></i> Asignaciones Programadas (Pendientes)
          </h4>
          <div style="display:flex; flex-direction:column; gap:0.85rem;">
      `;
      
      pendientes.forEach(b => {
        let horasHtml = '';
        if (b.entrada && b.salida) {
          horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(139, 92, 246, 0.1); color:#8b5cf6; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida}</span>`;
        }
        
        const btnReportar = (['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode) && !isClosed) ? `
          <div style="margin-top:0.6rem; text-align:right;">
            <button class="btn-primary" onclick="iniciarReporteDesdeAsignacion('${o.id}', '${b.id}')" style="font-size:0.75rem; padding:0.3rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem; background:#8b5cf6; border-color:#8b5cf6; box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);">
              <i data-lucide="file-signature" style="width:12px; height:12px;"></i> Reportar Trabajo Realizado
            </button>
          </div>
        ` : '';

        // Formatear fecha legible
        let fechaFormateada = b.fecha;
        try {
          const dObj = new Date(b.fecha);
          if (!isNaN(dObj)) {
            fechaFormateada = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
            fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
          }
        } catch(e){}

        const esSupervisorOrAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
        const actionButtons = (esSupervisorOrAdmin && !isClosed) ? `
          <button class="action-btn" onclick="window.mostrarDetalleEventoAdministrativo('${b.id}')" style="margin-left:0.5rem;" title="Editar Asignación">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="action-btn del" onclick="window.eliminarAsignacionProgramadaDirecto('${o.id}', '${b.id}')" title="Eliminar Asignación">
            <i data-lucide="trash-2"></i>
          </button>
        ` : '';

        html += `
          <div style="background:var(--bg-body); border: 1px solid var(--border); border-left: 4px solid #8b5cf6; border-radius:8px; padding:0.85rem 1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:24px; height:24px; border-radius:50%; background:#8b5cf6; color:white; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">
                  ${(b.tecnico || 'T').charAt(0).toUpperCase()}
                </div>
                <div>
                  <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Sin asignar'}</span>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${fechaFormateada}${b.asignadoPorName ? ` &bull; Asignado por: ${b.asignadoPorName}` : ''}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span class="badge" style="background:rgba(139, 92, 246, 0.1); color:#8b5cf6; border-radius:99px; padding:0.15rem 0.45rem; font-size:0.65rem; font-weight:700;">PROGRAMADO</span>
                ${horasHtml}
                ${actionButtons}
              </div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:2.2rem; line-height:1.4; font-style:italic;">${b.nota}</div>
            ${btnReportar}
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }

    // 2. Renderizar Historial de Trabajo (Realizados)
    html += `
      <h4 style="font-size:0.82rem; font-weight:700; color:#10b981; text-transform:uppercase; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; margin-top: 1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
        <i data-lucide="clipboard-check" style="width:16px; height:16px;"></i> Historial de Trabajo (Realizado)
      </h4>
    `;

    if (realizados.length === 0) {
      html += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;text-align:center;padding:1.5rem;background:var(--bg-body);border-radius:6px;border:1px dashed var(--border);">Aún no hay reportes de trabajo diarios realizados.</p>';
    } else {
      // Agrupar por día
      const agrupado = {};
      realizados.forEach(b => {
        let fechaDia = 'Fecha Desconocida';
        let fechaDObj = null;
        try {
          fechaDObj = new Date(b.fecha);
          if (!isNaN(fechaDObj)) {
            const partes = fechaDObj.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).split('/');
            fechaDia = `${partes[2]}-${partes[1]}-${partes[0]}`; // YYYY-MM-DD
          }
        } catch(e){}
        if (!agrupado[fechaDia]) agrupado[fechaDia] = { objDate: fechaDObj, entries: [] };
        agrupado[fechaDia].entries.push(b);
      });

      // Ordenar días del más reciente al más antiguo
      const diasSorted = Object.keys(agrupado).sort((a, b) => b.localeCompare(a));

      html += '<div style="display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.5rem;">';
      
      diasSorted.forEach(diaKey => {
        const diaData = agrupado[diaKey];
        let displayDia = diaKey;
        let mesAbrev = '';
        let numDia = '';
        if (diaData.objDate && !isNaN(diaData.objDate)) {
          const dObj = diaData.objDate;
          displayDia = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
          displayDia = displayDia.charAt(0).toUpperCase() + displayDia.slice(1);
          mesAbrev = dObj.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');
          numDia = dObj.getUTCDate();
        }

        // Ordenar entradas dentro del día (por hora de entrada si existe)
        diaData.entries.sort((a,b) => (a.entrada || '').localeCompare(b.entrada || ''));

        let entriesHtml = diaData.entries.map(b => {
          let horasHtml = '';
          let desvHtml = '';

          if (b.desviacion) {
            if (b.desviacion === 'Alineado') {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(16, 185, 129, 0.08); color:#10b981; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(16, 185, 129, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="check-circle" style="width:11px;height:11px;"></i> Alineado</span>`;
            } else if (b.desviacion.startsWith('+')) {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(59, 130, 246, 0.08); color:#3b82f6; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(59, 130, 246, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-up" style="width:11px;height:11px;"></i> Desviación: ${b.desviacion}</span>`;
            } else {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(239, 68, 68, 0.08); color:#ef4444; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(239, 68, 68, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-down" style="width:11px;height:11px;"></i> Desviación: ${b.desviacion}</span>`;
            }
          }

          const isTrasladoRegreso = b.nota && b.nota.toLowerCase().includes('traslado de regreso');
          if (b.entrada && b.salida) {
            const [hE, mE] = b.entrada.split(':').map(Number);
            const [hS, mS] = b.salida.split(':').map(Number);
            let diff = (hS * 60 + mS) - (hE * 60 + mE);
            if (diff < 0) diff += 24 * 60; // Si pasa de medianoche
            const diffH = (diff / 60).toFixed(1);
            
            if (isTrasladoRegreso) {
              horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(232, 130, 12, 0.1); color:var(--accent); padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="car" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida} (${diffH}h)</span>`;
            } else {
              const hrs = Math.floor(diff / 60);
              const mns = diff % 60;
              const durStr = `${hrs}h ${mns > 0 ? mns + 'm' : ''}`.trim();
              horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(16, 185, 129, 0.1); color:#10b981; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida} (${durStr})</span>${desvHtml}`;
            }
          } else if (b.entrada || b.salida) {
            horasHtml = `<span style="font-size:0.7rem; color:var(--text-muted);"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;"></i> ${b.entrada || '--:--'} a ${b.salida || '--:--'}</span>${desvHtml}`;
          } else if (b.horas_traslado || b.horas_regreso || isTrasladoRegreso) {
            const totalTraslado = (parseFloat(b.horas_traslado) || 0) + (parseFloat(b.horas_regreso) || 0);
            horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(71, 85, 105, 0.1); color:#475569; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="car" style="width:12px;height:12px;"></i> Traslado: ${totalTraslado.toFixed(1)}h</span>${desvHtml}`;
          }

          const borderColor = isTrasladoRegreso ? '#475569' : '#10b981';
          const badgeBg = isTrasladoRegreso ? 'rgba(71, 85, 105, 0.1)' : 'rgba(16, 185, 129, 0.1)';
          const badgeText = isTrasladoRegreso ? '#475569' : '#10b981';

          return `
            <div style="background:var(--bg-body); border-left: 3px solid ${borderColor}; border-radius:4px; padding:0.75rem 1rem; margin-top:0.6rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:24px; height:24px; border-radius:50%; background:${borderColor}; color:white; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">
                    ${(b.tecnico || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Desconocido'}</span>
                  ${(['superadmin', 'admin'].includes(currentSession.viewMode) && (!isClosed || isTrasladoRegreso)) ? `<button class="action-btn" onclick="editarBitacora('${o.id}', '${b.id}')" title="Editar Bitácora" style="padding:0.15rem; margin-left:0.5rem;"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span class="badge" style="background:${badgeBg}; color:${badgeText}; border-radius:99px; padding:0.15rem 0.45rem; font-size:0.65rem; font-weight:700;">REPORTADO</span>
                  ${horasHtml}
                </div>
              </div>
              <div style="font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:2.2rem; line-height:1.4;">${b.nota}</div>
            </div>
          `;
        }).join('');

        html += `
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            <!-- Calendario Icono -->
            <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:center; width:50px; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="background:#10b981; color:white; width:100%; text-align:center; font-size:0.65rem; font-weight:bold; padding:0.25rem 0; letter-spacing:0.5px;">${mesAbrev}</div>
              <div style="font-size:1.3rem; font-weight:700; color:var(--text-primary); padding:0.3rem 0;">${numDia}</div>
            </div>
            <!-- Contenido del día -->
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:0.2rem; margin-top:0.2rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem;">${displayDia}</div>
              ${entriesHtml}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    const puedeLlenarBitacora = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
    if (!isClosed && puedeLlenarBitacora) {
      html += `<div style="text-align:right; margin-top: 1rem;"><button class="btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="abrirBitacora('${o.id}')"><i data-lucide="plus" style="width:14px;height:14px;"></i> Registrar Avance Diario</button></div>`;
    }
    
    // === VISTA DE IMPRESIÓN (TABLA COMPACTA) ===
    let tableHtml = '';
    if (items.length === 0) {
      tableHtml = '<p style="color:#000; font-size:0.8rem; font-style:italic;">Sin registros en la bitácora.</p>';
    } else {
      const sorted = [...items].sort((a, b) => {
        const dateA = a.fecha || '';
        const dateB = b.fecha || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.entrada || '';
        const timeB = b.entrada || '';
        return timeA.localeCompare(timeB);
      });

      tableHtml += `
        <table class="bitacora-print-table" style="width:100%; border-collapse:collapse; font-size:0.7rem; margin-top:0.5rem; color:#000; border:1px solid #d1d5db;">
          <thead>
            <tr style="background:#f3f4f6; text-align:left; border-bottom:1.5px solid #9ca3af;">
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:15%;">Fecha</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:20%;">Técnico</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:20%;">Horario</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:12%;">Estado</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:33%;">Actividad / Avances Reportados</th>
            </tr>
          </thead>
          <tbody>
      `;

      sorted.forEach(b => {
        let fFormateada = b.fecha;
        try {
          const dObj = new Date(b.fecha);
          if (!isNaN(dObj)) {
            fFormateada = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
            fFormateada = fFormateada.replace('.', '');
          }
        } catch(e){}

        let hrsStr = '—';
        if (b.entrada && b.salida) {
          hrsStr = `${b.entrada} - ${b.salida}`;
          if (b.realizado) {
            try {
              const [hE, mE] = b.entrada.split(':').map(Number);
              const [hS, mS] = b.salida.split(':').map(Number);
              let diff = (hS * 60 + mS) - (hE * 60 + mE);
              if (diff < 0) diff += 24 * 60;
              const hrs = Math.floor(diff / 60);
              const mns = diff % 60;
              hrsStr += ` (${hrs}h${mns > 0 ? ' ' + mns + 'm' : ''})`;
            } catch(e){}
          }
        } else if (b.entrada || b.salida) {
          hrsStr = `${b.entrada || '--:--'} - ${b.salida || '--:--'}`;
        } else if (b.horas_traslado || b.horas_regreso) {
          const totalTraslado = (parseFloat(b.horas_traslado) || 0) + (parseFloat(b.horas_regreso) || 0);
          hrsStr = `Traslado: ${totalTraslado.toFixed(1)}h`;
        }

        let estadoStr = b.realizado ? 'REPORTADO' : 'PROGRAMADO';
        if (b.realizado && b.desviacion) {
          estadoStr += ` (${b.desviacion})`;
        }

        tableHtml += `
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:nowrap;">${fFormateada}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:500;">${b.tecnico || '—'}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:nowrap;">${hrsStr}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-size:0.65rem; font-weight:600;">${estadoStr}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:pre-wrap; line-height:1.3;">${b.nota || '—'}</td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
      `;
    }

    return `
      <div class="no-print">${html}</div>
      <div class="print-only">${tableHtml}</div>
    `;
  };

  const field = (label, val) => `
    <div class="detalle-field">
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;

  const seccion = (title, content) => `
    <div class="detalle-section">
      <div class="detalle-section-title">${title}</div>
      ${content}
    </div>`;

  const refTable = (items, hasPrice) => {
    if (!items?.length) return '<p style="color:var(--text-muted);font-size:0.82rem;">Sin refacciones</p>';
    return `<table class="detalle-ref-table">
      <thead><tr>
        <th>Descripción</th><th>Clave</th><th>Cant.</th>
        ${hasPrice ? '<th>Precio</th>' : ''}
      </tr></thead>
      <tbody>${items.map(r => `<tr>
        <td>${r.descripcion||'—'}</td>
        <td>${r.clave||'—'}</td>
        <td>${r.cantidad||'—'}</td>
        ${hasPrice ? `<td>$${r.precio||'0'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  };

  const diasRows = DIAS.map((dia, i) => {
    const d = o.dias?.[dia];
    if (!d || !d.fecha) return '';
    return `<tr>
      <td>${DIAS_LABEL[i]}</td>
      <td>${d.fecha||'—'}</td>
      <td>${d.entrada||'—'}</td>
      <td>${d.salida||'—'}</td>
      <td>${d.normales||'—'}</td>
      <td>${d.extras||'—'}</td>
    </tr>`;
  }).join('');

  const formatFecha = (fStr) => {
    if (!fStr) return '—';
    if (fStr.includes('T')) {
      const parts = fStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fStr;
  };

  document.getElementById('detalle-body').innerHTML = `
    <div class="print-only" style="text-align:center; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border);">
      <img src="logo_transparent.png" alt="Eurorep Logo" style="height:60px; object-fit:contain; margin-bottom:0.5rem;"/>
      <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary);">Orden de Servicio ${o.folio || ''}</h2>
      <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${formatFecha(o.fecha)}</p>
    </div>
    ${seccion('Información General', `
      <div class="detalle-grid">
        ${field('Folio', o.folio)} ${field('Pedido', o.pedido)} ${field('Fecha', formatFecha(o.fecha))}
        ${field('Cliente', o.cliente)} ${field('Ubicación (Ticket)', o.ubicacion)} ${field('Ubicación en Sitio', o.ubicacion_sitio)} ${field('Operador', o.operador)}
        ${field('No. ECO', o.eco)} ${field('Horómetro (Ticket)', o.horometro)} ${field('Horómetro Real', o.horometro_real)}
        ${field('Marca', (() => { 
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let m = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
          return MARCAS_RENDER[m.toUpperCase()] || m || '—';
        })())} ${field('Modelo', o.modelo)} ${field('Serie', o.serie)}
        ${field('ID Máquina', (() => {
          let maq = null;
          if (o.maquinaria_id) {
            maq = maquinariaDb.find(m => m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas) {
                  const found = c.maquinas.find(m => m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id);
                  if (found) maq = found;
                }
              });
            }
          } else if (o.serie) {
            maq = maquinariaDb.find(m => m.serie === o.serie);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas) {
                  const found = c.maquinas.find(m => m.serie === o.serie);
                  if (found) maq = found;
                }
              });
            }
          } else if (o.modelo && o.cliente) {
            maq = maquinariaDb.find(m => m.modelo === o.modelo && m.cliente === o.cliente);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas && c.nombre === o.cliente) {
                  const found = c.maquinas.find(m => m.modelo === o.modelo);
                  if (found) maq = found;
                }
              });
            }
          }
          return maq && (maq.idInterno || maq.id) ? `<span style="font-family:monospace; font-weight:600; color:var(--accent); background:var(--blue-light); padding:0.15rem 0.4rem; border-radius:4px; border:1px solid rgba(232, 133, 10, 0.3);">${maq.idInterno || maq.id}</span>` : '—';
        })())}
        ${field('Técnico', o.tecnico)} ${field('Ticket Soporte', (() => { const t = tickets.find(x => x.id === o.soporte); return t ? (t.folio || t.id.slice(0,8)) : o.soporte || null; })())}
      </div>`)}
    ${seccion('Kilómetros / Tipo', `
      <div class="detalle-grid">
        ${field('Origen → Trabajo', (o.km_ida != null && o.km_ida !== '') ? o.km_ida + ' km' : null)}
        ${field('Trabajo → Origen', (o.km_vuelta != null && o.km_vuelta !== '') ? o.km_vuelta + ' km' : null)}
        ${field('Total Km', (o.km_total != null && o.km_total !== '') ? o.km_total + ' km' : null)}
        ${field('Tipo de Visita', `<span class="badge badge-${(o.tipo||'otro').toLowerCase().replace(/ /g, '-').replace('é','e').replace('í','i')}">${o.tipo}</span>`)}
        ${field('Estado', `<span class="badge ${badgeEstado(o.estado)}">${o.estado}</span>`)}
      </div>
      ${o.reembolso_km ? `
        <div style="margin-top:1rem; display:flex; flex-direction:row; align-items:center; gap:1rem; flex-wrap:wrap;">
          ${(() => {
            const hasTrasladoRegreso = o.bitacora && o.bitacora.some(b => b.nota === 'Traslado de regreso desde el sitio de trabajo');
            return `
            <div style="display:flex; flex-direction:column; gap:0.25rem; padding:0.5rem 0.75rem; border-left:3px solid var(--accent); background:rgba(232, 130, 12, 0.08); border-radius:0 6px 6px 0; width:fit-content;">
              <div style="display:flex; align-items:center; gap:0.4rem; color:var(--accent); font-weight:700; font-size:0.85rem;">
                <i data-lucide="check-circle" style="width:14px;height:14px;"></i>
                Aplica Reembolso de KM
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem; color:var(--accent); font-size:0.75rem; font-weight:600; opacity:0.85;">
                <i data-lucide="${hasTrasladoRegreso ? 'check-check' : 'clock'}" style="width:13px;height:13px;"></i>
                ${hasTrasladoRegreso ? 'Traslado de regreso registrado' : 'A la espera de traslado de regreso'}
              </div>
            </div>
            ${(!hasTrasladoRegreso && ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode)) ? `
            <button class="btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.6rem; display:flex; align-items:center; gap:0.3rem;" onclick="abrirBitacora('${o.id}', 'Traslado de regreso desde el sitio de trabajo', true)">
              <i data-lucide="plus" style="width:12px;height:12px;"></i> Registrar Regreso
            </button>
            ` : ''}
            `;
          })()}
        </div>
      ` : `
        <div style="margin-top:1rem; display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.6rem; border:1px solid var(--border); background:var(--bg-secondary); border-radius:6px; width:fit-content;">
          <i data-lucide="x-circle" style="width:13px;height:13px;color:var(--text-muted);"></i>
          <span style="color:var(--text-muted); font-size:0.75rem; font-weight:500;">No aplica Reembolso de KM</span>
        </div>
      `}
    `)}
    ${seccion('Diagnóstico y Trabajos', `
      ${field('Falla reportada', o.falla)}
      <div style="margin-top:0.5rem">${field('Trabajos realizados', o.trabajos)}</div>
      <div style="margin-top:0.5rem">${field('Dictamen', o.dictamen)}</div>
      <div style="margin-top:0.5rem">${field('Condiciones del equipo', o.condiciones)}</div>
      <div style="margin-top:0.5rem">${field('Observaciones', o.observaciones)}</div>
      <div style="margin-top:0.5rem">${field('Pendientes', o.pendientes)}</div>`)}
    ${seccion('Refacciones Utilizadas', refTable(o.ref_utilizadas, false))}
    ${seccion('Refacciones Necesarias', refTable(o.ref_necesarias, false))}
    ${(o.noches || o.alimentacion || o.traslado_costo) ? seccion('Fecha de Servicio', `
      <div class="detalle-grid">
        ${field('No. Noches', o.noches)} ${field('Alimentación', o.alimentacion)} ${field('Traslado', o.traslado_costo)}
      </div>`) : ''}
    ${seccion('Bitácora Diaria', renderBitacora(o))}
    ${seccion('Evidencias Fotográficas', renderEvidenciasFotograficas(o))}
    
    ${o.cierre_papel_pdf ? (() => {
      let tecnicosHorasHtml = '';
      if (o.cierre_papel_tecnicos_horas && o.cierre_papel_tecnicos_horas.length > 0) {
        let rowsHtml = o.cierre_papel_tecnicos_horas.map(item => {
          const horasVal = item.horas !== undefined && item.horas !== '' ? `${item.horas} hrs` : '—';
          const trayectosVal = item.trayectos !== undefined && item.trayectos !== '' ? `${item.trayectos} tray.` : '—';
          const idaVal = item.ida !== undefined && item.ida !== '' ? `${item.ida} hrs` : '—';
          const regresoVal = item.regreso !== undefined && item.regreso !== '' ? `${item.regreso} hrs` : '—';
          
          let fechaVal = '—';
          if (item.fecha_inicio && item.fecha_fin && item.fecha_inicio !== item.fecha_fin) {
            const pIni = item.fecha_inicio.split('-');
            const pFin = item.fecha_fin.split('-');
            const fIniFormateada = pIni.length === 3 ? `${pIni[2]}/${pIni[1]}` : item.fecha_inicio;
            const fFinFormateada = pFin.length === 3 ? `${pFin[2]}/${pFin[1]}/${pFin[0]}` : item.fecha_fin;
            fechaVal = `${fIniFormateada} al ${fFinFormateada}`;
          } else {
            const rawFecha = item.fecha_inicio || item.fecha || item.dias;
            if (rawFecha && rawFecha !== '') {
              if (rawFecha.includes('-')) {
                const parts = rawFecha.split('-');
                if (parts.length === 3) {
                  fechaVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                  fechaVal = rawFecha;
                }
              } else {
                fechaVal = rawFecha;
              }
            }
          }
          
          return `
            <tr style="border-bottom:1px solid rgba(79, 70, 229, 0.1);">
              <td style="padding:0.5rem; font-weight:600; color:var(--text-primary); text-align:left;">${item.tecnico}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${horasVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${fechaVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${idaVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${regresoVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${trayectosVal}</td>
            </tr>
          `;
        }).join('');
        
        tecnicosHorasHtml = `
          <div style="margin-top:0.75rem;">
            <strong style="font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Personal de Trabajo Detallado:</strong>
            <div style="border:1px solid rgba(79, 70, 229, 0.15); border-radius:8px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; background:rgba(255,255,255,0.01);">
                <thead>
                  <tr style="background:rgba(79, 70, 229, 0.08); text-align:left; color:#4f46e5; font-weight:700; font-size:0.8rem; border-bottom:1px solid rgba(79, 70, 229, 0.15);">
                    <th style="padding:0.5rem; text-align:left; width: 32%;">Técnico</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Horas</th>
                    <th style="padding:0.5rem; text-align:center; width: 18%;">Fecha</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Ida</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Regreso</th>
                    <th style="padding:0.5rem; text-align:center; width: 14%;">Trayectos</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      
      return seccion('Cierre de Orden en Papel', `
        <div style="background:rgba(79, 70, 229, 0.04); border:1px solid rgba(79, 70, 229, 0.15); border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:0.5rem; color:#4f46e5; font-weight:700; font-size:1rem; border-bottom:1px solid rgba(79, 70, 229, 0.15); padding-bottom:0.4rem; margin-bottom:0.2rem;">
            <i data-lucide="file-check" style="width:18px; height:18px;"></i>
            Esta orden fue cerrada físicamente (formato papel)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem; font-size:0.85rem;">
            <div><strong>Autorizado por:</strong> ${o.cierre_papel_usuario || '—'}</div>
            <div><strong>Fecha de cierre:</strong> ${o.cierre_papel_fecha ? new Date(o.cierre_papel_fecha).toLocaleString('es-MX', {dateStyle: 'medium', timeStyle: 'short'}) : '—'}</div>
          </div>
          <div style="font-size:0.85rem; margin-top:0.25rem; background:var(--bg-secondary); padding:0.6rem; border-radius:6px; border-left:4px solid #4f46e5;">
            <strong>Justificación / Motivo:</strong><br>
            <span style="font-style:italic; color:var(--text-secondary); display:block; margin-top:0.2rem;">${o.cierre_papel_motivo || '—'}</span>
          </div>
          
          ${tecnicosHorasHtml}
          
          <div style="margin-top:0.4rem; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <a href="${o.cierre_papel_pdf}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:0.35rem; text-decoration:none; background:#4f46e5; border-color:#4f46e5; color:white; padding:0.4rem 0.8rem; border-radius:6px; font-size:0.8rem; font-weight:600;">
                <i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir PDF
              </a>
              <button class="btn-secondary" onclick="document.getElementById('cp-pdf-iframe-container').style.display = document.getElementById('cp-pdf-iframe-container').style.display === 'none' ? 'block' : 'none';" style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.8rem; padding:0.4rem 0.8rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer;">
                <i data-lucide="eye" style="width:14px;height:14px;"></i> Vista Previa
              </button>
            </div>
            <div id="cp-pdf-iframe-container" style="display:none; margin-top:0.5rem; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:white;">
              <iframe src="${o.cierre_papel_pdf}" style="width:100%; height:550px; border:none; display:block;"></iframe>
            </div>
          </div>
        </div>
      `);
    })() : seccion('Firmas de Conformidad', `
      <div style="display:flex; flex-wrap:wrap; gap:2rem; margin-top:1rem; justify-content:center;">
        
        <!-- TECNICO -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Técnico</h4>
          ${(o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__')
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_tecnico_base64}" alt="Firma del técnico" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_tecnico_nombre || o.tecnico || 'Técnico'}</p>
                 ${o.firma_tecnico_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_tecnico_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               ${currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin' ? `<button class="btn-secondary" onclick="console.log('Borrando tecnico...'); limpiarFirma('${o.id}', 'tecnico')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Borrar firma (Admin)</button>` : ''}` 
            : (() => {
                const ev = o.evidencias || {};
                const tieneObligatorias = !!(ev.fotoInicio && ev.fotoFin);
                const tieneUbicacionSitio = !!(o.ubicacion_sitio && o.ubicacion_sitio.trim());
                const tieneOperador = !!(o.operador && o.operador.trim());
                if (!tieneObligatorias || !tieneUbicacionSitio || !tieneOperador) {
                  let faltantes = [];
                  if (!tieneUbicacionSitio) faltantes.push("la <strong>Ubicación en Sitio</strong>");
                  if (!tieneOperador) faltantes.push("el <strong>Operador</strong>");
                  if (!tieneObligatorias) faltantes.push("la <strong>Foto de Inicio y Fin</strong>");
                  
                  let msg = `Debes registrar ${faltantes.join(', ')} para habilitar la firma del técnico.`;
                  const lastCommaIdx = msg.lastIndexOf(', ');
                  if (lastCommaIdx !== -1) {
                    msg = msg.substring(0, lastCommaIdx) + ' y ' + msg.substring(lastCommaIdx + 2);
                  }
                  
                  return `
                    <div style="width:100%; text-align:center; padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 0.85rem; background:var(--bg-body); display:flex; flex-direction:column; align-items:center; gap:0.4rem;">
                      <i data-lucide="alert-circle" style="width:24px;height:24px;color:var(--accent);opacity:0.7;"></i>
                      <span>${msg}</span>
                    </div>
                  `;
                }
                return `
                  <div style="width:100%;">
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                    <canvas id="firma-tecnico-canvas" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                      <button class="btn-secondary" onclick="borrarCanvasFirma('tecnico')" style="flex:1;">Borrar</button>
                      <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'tecnico')" style="flex:2;">Guardar Firma Técnico</button>
                    </div>
                  </div>
                `;
              })()
          }
        </div>

        <!-- CLIENTE -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Cliente</h4>
          ${(o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__')
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_cliente_base64}" alt="Firma del cliente" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_cliente_nombre || o.cliente || 'Cliente'}</p>
                 ${o.firma_cliente_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_cliente_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               ${currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin' ? `<button class="btn-secondary" onclick="console.log('Borrando cliente...'); limpiarFirma('${o.id}', 'cliente')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Volver a firmar</button>` : `<button class="btn-secondary" onclick="limpiarFirma('${o.id}', 'cliente')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Volver a firmar</button>`}` 
            : ((!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__') 
               ? `<div style="width:100%; text-align:center; padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 0.9rem;">
                    <i data-lucide="lock" style="width:24px;height:24px;margin-bottom:0.5rem;"></i><br>
                    El técnico debe firmar primero para habilitar la firma del cliente.
                  </div>`
               : `<div style="width:100%;">
                 <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                 <input type="text" id="nombre-firma-cliente" class="form-control" placeholder="Nombre completo de quien firma" style="margin-bottom:0.5rem; font-size:0.85rem; padding:0.4rem;"/>
                 <canvas id="firma-cliente-canvas" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                 <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                   <button class="btn-secondary" onclick="borrarCanvasFirma('cliente')" style="flex:1;">Borrar</button>
                   <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'cliente')" style="flex:2;">Guardar Firma Cliente</button>
                 </div>
               </div>`)
          }
        </div>
        
      </div>
    `)}
  `;

  document.getElementById('modal-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
  
  setTimeout(() => {
    if (!o.cierre_papel_pdf) {
      if ((!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__')) inicializarCanvasFirma('tecnico');
      if ((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') && (!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__')) inicializarCanvasFirma('cliente');
    }
  }, 100);
}

window.agregarRenglonTecnicoCierre = function(tecnicoNombre = '', horas = '', fecha_inicio = '', fecha_fin = '', trayectos = '', ida = '', regreso = '', existingId = '') {
  const container = document.getElementById('cp-tecnicos-lista');
  if (!container) return;
  const rowId = existingId || ('cp-' + crypto.randomUUID());
  const div = document.createElement('div');
  div.id = rowId;
  div.style.display = 'flex';
  div.style.gap = '0.35rem';
  div.style.alignItems = 'center';
  div.style.marginBottom = '0.25rem';
  
  let options = '<option value="">-- Seleccionar Técnico --</option>';
  const sortedUsers = [...usuarios].sort((a,b) => a.nombre.localeCompare(b.nombre));
  sortedUsers.forEach(u => {
    const selected = u.nombre === tecnicoNombre ? 'selected' : '';
    options += `<option value="${u.nombre}" ${selected}>${u.nombre}</option>`;
  });
  
  div.innerHTML = `
    <select class="cp-tecnico-select" required style="flex:2; min-width:130px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;">
      ${options}
    </select>
    <input type="number" class="cp-tecnico-horas" step="0.5" min="0" value="${horas}" placeholder="Hrs/Día" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Horas Trabajadas por Día" />
    <input type="date" class="cp-tecnico-fecha-inicio" value="${fecha_inicio}" required style="flex:1.8; min-width:115px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Fecha de Inicio" />
    <input type="date" class="cp-tecnico-fecha-fin" value="${fecha_fin}" style="flex:1.8; min-width:115px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Fecha de Fin (Opcional)" />
    <input type="number" class="cp-tecnico-ida" step="0.5" min="0" value="${ida}" placeholder="Ida" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Ida (Horas de Traslado)" />
    <input type="number" class="cp-tecnico-regreso" step="0.5" min="0" value="${regreso}" placeholder="Regreso" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Regreso (Horas de Retorno)" />
    <input type="number" class="cp-tecnico-trayectos" step="0.5" min="0" value="${trayectos}" placeholder="Tray." required style="flex:1.2; min-width:75px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Número de Trayectos" />
    <div style="display:flex; gap:0.25rem; flex-shrink:0;">
      <button type="button" onclick="window.agregarRenglonTecnicoCierre(document.querySelector('#${rowId} .cp-tecnico-select').value)" class="action-btn" style="padding:0.35rem; display:inline-flex; align-items:center; justify-content:center; background:rgba(79, 70, 229, 0.08); color:#4f46e5; border:1px solid rgba(79, 70, 229, 0.15);" title="Copiar técnico"><i data-lucide="copy" style="width:14px; height:14px;"></i></button>
      <button type="button" onclick="document.getElementById('${rowId}').remove()" class="action-btn del" style="padding:0.35rem; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
    </div>
  `;
  container.appendChild(div);
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

window.abrirCierrePapel = function(ordenId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  // Guardar ID
  document.getElementById('cp-orden-id').value = ordenId;
  
  // Resetear el formulario
  document.getElementById('form-cierre-papel').reset();
  
  // Limpiar lista de técnicos y pre-poblar
  const container = document.getElementById('cp-tecnicos-lista');
  if (container) container.innerHTML = '';
  
  let tecnicosLista = [];
  if (o.cierre_papel_tecnicos_horas && o.cierre_papel_tecnicos_horas.length > 0) {
    tecnicosLista = o.cierre_papel_tecnicos_horas.map(item => ({
      id: item.id || ('cp-' + crypto.randomUUID()),
      tecnico: item.tecnico,
      horas: item.horas,
      fecha_inicio: item.fecha_inicio || item.fecha || item.dias || '',
      fecha_fin: item.fecha_fin || item.fecha_inicio || item.fecha || item.dias || '',
      trayectos: item.trayectos,
      ida: item.ida !== undefined ? item.ida : '',
      regreso: item.regreso !== undefined ? item.regreso : ''
    }));
  } else if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
    tecnicosLista = o.tecnicosAsignados.map(t => ({ id: 'cp-' + crypto.randomUUID(), tecnico: t, horas: '', fecha_inicio: '', fecha_fin: '', trayectos: '', ida: '', regreso: '' }));
  } else if (o.tecnico) {
    tecnicosLista = o.tecnico.split(',').map(t => t.trim()).filter(Boolean).map(t => ({ id: 'cp-' + crypto.randomUUID(), tecnico: t, horas: '', fecha_inicio: '', fecha_fin: '', trayectos: '', ida: '', regreso: '' }));
  }
  
  tecnicosLista.forEach(item => {
    window.agregarRenglonTecnicoCierre(item.tecnico, item.horas, item.fecha_inicio, item.fecha_fin, item.trayectos, item.ida, item.regreso, item.id);
  });
  
  // Abrir modal
  document.getElementById('modal-cierre-papel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
};

window.cerrarCierrePapel = function(e) {
  if (e && e.target !== document.getElementById('modal-cierre-papel-overlay') && e.target !== document.querySelector('#modal-cierre-papel .modal-close') && e.target.tagName !== 'BUTTON') {
    if (e.target.closest('#modal-cierre-papel')) return;
  }
  document.getElementById('modal-cierre-papel-overlay').classList.remove('open');
  if (!document.getElementById('modal-detalle-overlay').classList.contains('open')) {
    document.body.style.overflow = '';
  }
};

window.confirmarCierrePapel = async function(e) {
  e.preventDefault();
  
  const ordenId = document.getElementById('cp-orden-id').value;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  const fileInput = document.getElementById('cp-pdf-file');
  const file = fileInput.files[0];
  if (!file) {
    mostrarNotificacion('Por favor, seleccione un archivo PDF.', 'warning');
    return;
  }
  
  const nuevoEstado = document.getElementById('cp-estado').value;
  const motivo = document.getElementById('cp-motivo').value.trim();
  if (motivo.length < 5) {
    mostrarNotificacion('Por favor, ingrese un motivo de al menos 5 caracteres.', 'warning');
    return;
  }

  const rows = document.querySelectorAll('#cp-tecnicos-lista > div');
  const tecnicosHoras = [];
  let isInvalid = false;
  for (const row of rows) {
    const rowId = row.id;
    const tecnicoSelect = row.querySelector('.cp-tecnico-select');
    const horasInput = row.querySelector('.cp-tecnico-horas');
    const fechaInicioInput = row.querySelector('.cp-tecnico-fecha-inicio');
    const fechaFinInput = row.querySelector('.cp-tecnico-fecha-fin');
    const trayectosInput = row.querySelector('.cp-tecnico-trayectos');
    const idaInput = row.querySelector('.cp-tecnico-ida');
    const regresoInput = row.querySelector('.cp-tecnico-regreso');
    
    if (tecnicoSelect && horasInput && fechaInicioInput && fechaFinInput && trayectosInput && idaInput && regresoInput) {
      const tecnico = tecnicoSelect.value;
      const horasVal = horasInput.value.trim();
      const fechaInicioVal = fechaInicioInput.value.trim();
      const fechaFinVal = fechaFinInput.value.trim() || fechaInicioVal;
      const trayectosVal = trayectosInput.value.trim();
      const idaVal = idaInput.value.trim();
      const regresoVal = regresoInput.value.trim();
      
      const hasAnyVal = horasVal || fechaInicioVal || fechaFinInput.value.trim() || trayectosVal || idaVal || regresoVal;
      
      if (!tecnico && hasAnyVal) {
        mostrarNotificacion('Debe seleccionar un técnico para los datos ingresados.', 'warning');
        isInvalid = true;
        break;
      }
      if (tecnico && (!horasVal || !fechaInicioVal || !trayectosVal || !idaVal || !regresoVal)) {
        mostrarNotificacion('Debe ingresar las horas, la fecha de inicio, la ida, el regreso y los trayectos para el técnico seleccionado.', 'warning');
        isInvalid = true;
        break;
      }
      
      if (tecnico && horasVal && fechaInicioVal && trayectosVal && idaVal && regresoVal) {
        const hrs = parseFloat(horasVal);
        const trs = parseFloat(trayectosVal);
        const ida = parseFloat(idaVal);
        const regreso = parseFloat(regresoVal);
        
        if (isNaN(hrs) || hrs < 0 || isNaN(trs) || trs < 0 || isNaN(ida) || ida < 0 || isNaN(regreso) || regreso < 0) {
          mostrarNotificacion('Los valores de horas, ida, regreso y trayectos deben ser números mayores o iguales a cero.', 'warning');
          isInvalid = true;
          break;
        }
        
        if (new Date(fechaFinVal) < new Date(fechaInicioVal)) {
          mostrarNotificacion('La fecha de fin no puede ser anterior a la fecha de inicio.', 'warning');
          isInvalid = true;
          break;
        }
        
        tecnicosHoras.push({
          id: rowId,
          tecnico,
          horas: hrs,
          fecha_inicio: fechaInicioVal,
          fecha_fin: fechaFinVal,
          trayectos: trs,
          ida,
          regreso
        });
      }
    }
  }
  if (isInvalid) return;
  
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  let originalBtnText = '';
  if (btnSubmit) {
    originalBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="rotating" data-lucide="loader-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Guardando...';
    lucide.createIcons();
  }
  
  let publicUrl = null;
  const timestamp = Date.now();
  const uniqueName = `cierre_papel_${timestamp}_${Math.random().toString(36).substring(2,7)}.pdf`;
  const filePath = `ordenes/${ordenId}/${uniqueName}`;
  
  if (!navigator.onLine || !window.supabaseClient) {
    try {
      mostrarNotificacion('Guardando archivo localmente (Modo Offline)...', 'info');
      const blobToBase64 = (blob) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      };
      publicUrl = await blobToBase64(file);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Fallo al procesar el archivo en modo offline.', 'error');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
        lucide.createIcons();
      }
      return;
    }
  } else {
    try {
      mostrarNotificacion('Subiendo PDF a Supabase Storage...', 'info');
      const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
        .from('evidencias')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (uploadErr) throw uploadErr;
      
      const { data: urlData } = window.supabaseClient.storage
        .from('evidencias')
        .getPublicUrl(filePath);
        
      publicUrl = urlData.publicUrl;
    } catch (err) {
      console.warn("Fallo la subida directa a Supabase. Guardando offline:", err);
      try {
        const blobToBase64 = (blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        };
        publicUrl = await blobToBase64(file);
      } catch (baseErr) {
        console.error(baseErr);
        mostrarNotificacion('Error al guardar el archivo localmente.', 'error');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalBtnText;
          lucide.createIcons();
        }
        return;
      }
    }
  }
  
  const idx = ordenes.findIndex(x => x.id === ordenId);
  if (idx !== -1) {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const usuarioNombre = currentUser ? currentUser.nombre : (currentSession.nombre || 'Supervisor');
    
    ordenes[idx].cierre_papel_pdf = publicUrl;
    ordenes[idx].cierre_papel_motivo = motivo;
    ordenes[idx].cierre_papel_usuario = usuarioNombre;
    ordenes[idx].cierre_papel_fecha = new Date().toISOString();
    ordenes[idx].cierre_papel_tecnicos_horas = tecnicosHoras;
    ordenes[idx].estado = nuevoEstado;

    // Sincronizar con la bitácora para reflejar en el calendario
    if (!ordenes[idx].bitacora) ordenes[idx].bitacora = [];

    // Expandir cada rango en entradas de un día individuales
    const obtenerFechasEnRango = (inicio, fin) => {
      const fechas = [];
      let current = new Date(inicio + 'T00:00:00');
      const end = new Date(fin + 'T00:00:00');
      while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        fechas.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
      }
      return fechas;
    };

    const expandedEntries = [];
    tecnicosHoras.forEach(row => {
      const fechas = obtenerFechasEnRango(row.fecha_inicio, row.fecha_fin);
      fechas.forEach(f => {
        expandedEntries.push({
          id: `${row.id}-${f}`,
          tecnico: row.tecnico,
          horas: row.horas,
          fecha: f,
          trayectos: row.trayectos,
          ida: row.ida,
          regreso: row.regreso
        });
      });
    });

    // Filtrar entradas obsoletas de cierre en papel en o.bitacora
    ordenes[idx].bitacora = ordenes[idx].bitacora.filter(b => {
      if (b.cierre_papel) {
        return expandedEntries.some(ee => ee.id === b.id);
      }
      return true;
    });

    // Limpiar eventos eliminados del calendario
    try {
      const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
      const updatedEventos = [];
      for (const ev of localEventos) {
        if (ev.ordenId === ordenId && ev.id) {
          const cleanEvId = String(ev.id).replace('bit-', '');
          const isPaperClosureEvent = cleanEvId.startsWith('cp-');
          if (isPaperClosureEvent) {
            const stillExists = ordenes[idx].bitacora.some(b => b.id === cleanEvId || b.id === ev.id || `bit-${b.id}` === ev.id);
            if (!stillExists) {
              if (window.deleteFromSupabase) {
                window.deleteFromSupabase('calendario_eventos', ev.id);
              }
              if (window.deleteFromSupabase) {
                window.deleteFromSupabase('calendario_eventos', `bit-traslado-ida-${cleanEvId}`);
                window.deleteFromSupabase('calendario_eventos', `bit-traslado-regreso-${cleanEvId}`);
              }
              continue;
            }
          }
        }
        updatedEventos.push(ev);
      }
      localStorage.setItem('sapi_calendario_eventos', JSON.stringify(updatedEventos));
    } catch (e) {
      console.error('Error al limpiar eventos del calendario:', e);
    }

    // Crear/actualizar entradas y actualizar calendario
    expandedEntries.forEach(ee => {
      let bEntry = ordenes[idx].bitacora.find(b => b.id === ee.id);
      
      const entrada = '08:00';
      const baseHour = 8;
      const totalHours = parseFloat(ee.horas);
      const endHour = baseHour + totalHours;
      const endHH = Math.floor(endHour).toString().padStart(2, '0');
      const endMM = Math.round((endHour % 1) * 60).toString().padStart(2, '0');
      const salida = `${endHH}:${endMM}`;
      
      if (bEntry) {
        bEntry.fecha = ee.fecha;
        bEntry.tecnico = ee.tecnico;
        bEntry.realizado = true;
        bEntry.entrada = entrada;
        bEntry.salida = salida;
        bEntry.horas_traslado = ee.ida || null;
        bEntry.horas_regreso = ee.regreso || null;
        if (!bEntry.nota || !bEntry.nota.includes('Cierre en papel')) {
          bEntry.nota = `Cierre en papel: ${motivo}. ` + (bEntry.nota || '');
        }
        bEntry.cierre_papel = true;
      } else {
        bEntry = {
          id: ee.id,
          fecha: ee.fecha,
          tecnico: ee.tecnico,
          tipo: 'Servicio',
          nota: `Cierre en papel: ${motivo}`,
          entrada: entrada,
          salida: salida,
          horas_traslado: ee.ida || null,
          horas_regreso: ee.regreso || null,
          realizado: true,
          cierre_papel: true,
          asignadoPorName: usuarioNombre,
          asignadoPorId: currentSession.userId || null
        };
        ordenes[idx].bitacora.push(bEntry);
      }
      
      if (typeof actualizarEventoCalendarioDesdeBitacora === 'function') {
        actualizarEventoCalendarioDesdeBitacora(ordenes[idx], bEntry);
      }
    });

    try {
      safeSetJSON('sapi_ordenes', ordenes);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error al guardar en almacenamiento local.', 'error');
    }
    
    if (window.pushToSupabase) {
      window.pushToSupabase('ordenes', ordenes[idx]).catch(err => {
        console.error('Error al sincronizar con la nube:', err);
      });
    }
    
    mostrarNotificacion('Orden cerrada correctamente.', 'success');
    
    cerrarCierrePapel();
    verDetalle(ordenId);
    
    try {
      renderTabla();
      renderTabla('servicios');
    } catch (e) {
      console.error('Error al refrescar tablas:', e);
    }
  }
};

// ===== LOGICA DEL CANVAS DE FIRMA =====
let canvasesFirma = {
  tecnico: { canvas: null, ctx: null, dibujando: false },
  cliente: { canvas: null, ctx: null, dibujando: false }
};

function inicializarCanvasFirma(tipo) {
  const c = document.getElementById(`firma-${tipo}-canvas`);
  if (!c) return;
  const ctx = c.getContext('2d');
  
  canvasesFirma[tipo].canvas = c;
  canvasesFirma[tipo].ctx = ctx;
  
  // Asegurar dimensiones reales de renderizado para evitar deformación por escala CSS y desfases de toque
  const parentWidth = c.parentElement ? c.parentElement.clientWidth : 0;
  c.width = c.offsetWidth || c.clientWidth || parentWidth || 320;
  c.height = c.offsetHeight || c.clientHeight || 150;
  
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000000';

  // Manejo responsivo y fluido ante rotación o redimensionamiento del celular del técnico
  if (canvasesFirma[tipo].resizeHandler) {
    window.removeEventListener('resize', canvasesFirma[tipo].resizeHandler);
  }
  
  const resizeHandler = () => {
    if (!c) return;
    const currentWidth = c.offsetWidth || c.clientWidth || (c.parentElement ? c.parentElement.clientWidth : 0) || 320;
    if (c.width !== currentWidth) {
      let tempImage = null;
      try {
        tempImage = ctx.getImageData(0, 0, c.width, c.height);
      } catch(e) {}
      
      c.width = currentWidth;
      c.height = c.offsetHeight || c.clientHeight || 150;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
      
      if (tempImage) {
        try {
          ctx.putImageData(tempImage, 0, 0);
        } catch(e) {}
      }
    }
  };
  
  canvasesFirma[tipo].resizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  const startDraw = (e) => { canvasesFirma[tipo].dibujando = true; ctx.beginPath(); ctx.moveTo(getX(e, c), getY(e, c)); e.preventDefault(); };
  const draw = (e) => { if(!canvasesFirma[tipo].dibujando) return; ctx.lineTo(getX(e, c), getY(e, c)); ctx.stroke(); e.preventDefault(); };
  const stopDraw = () => { canvasesFirma[tipo].dibujando = false; ctx.closePath(); };

  const getX = (e, canvas) => e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.clientX - canvas.getBoundingClientRect().left;
  const getY = (e, canvas) => e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.clientY - canvas.getBoundingClientRect().top;

  c.addEventListener('mousedown', startDraw);
  c.addEventListener('mousemove', draw);
  c.addEventListener('mouseup', stopDraw);
  c.addEventListener('mouseout', stopDraw);
  
  c.addEventListener('touchstart', startDraw, {passive: false});
  c.addEventListener('touchmove', draw, {passive: false});
  c.addEventListener('touchend', stopDraw);
}

function borrarCanvasFirma(tipo) {
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (ctx && c) {
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

function guardarFirmaCanvas(ordenId, tipo) {
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (!c) return;
  
  const isBlank = !ctx.getImageData(0, 0, c.width, c.height).data.some(channel => channel !== 0);
  if (isBlank) {
    mostrarNotificacion(`Por favor firme como ${tipo} antes de guardar.`, 'warning');
    return;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = c.width;
  tempCanvas.height = c.height;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.fillStyle = '#FFFFFF';
  tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tCtx.drawImage(c, 0, 0);
  
  const base64Firma = tempCanvas.toDataURL('image/jpeg', 0.5);
  
  const idx = ordenes.findIndex(o => o.id === ordenId);
  if (idx !== -1) {
    if (ordenes[idx].cierre_papel_pdf) {
      mostrarNotificacion('No se pueden registrar firmas en una orden cerrada en papel.', 'error');
      return;
    }
    const fechaFirma = new Date().toISOString();
    
    const ev = ordenes[idx].evidencias || {};
    const oObj = ordenes[idx];
    const tieneUbicacionSitio = !!(oObj.ubicacion_sitio && oObj.ubicacion_sitio.trim());
    const tieneOperador = !!(oObj.operador && oObj.operador.trim());
    const tieneObligatorias = !!(ev.fotoInicio && ev.fotoFin);
    
    if (!tieneObligatorias || !tieneUbicacionSitio || !tieneOperador) {
      let faltantes = [];
      if (!tieneUbicacionSitio) faltantes.push("Ubicación en Sitio");
      if (!tieneOperador) faltantes.push("Operador");
      if (!tieneObligatorias) faltantes.push("Fotos de Inicio y Fin");
      mostrarNotificacion('Debes registrar: ' + faltantes.join(', ') + ' antes de guardar la firma.', 'error');
      return;
    }

    if (tipo === 'tecnico') {
      const currentUser = usuarios.find(u => u.id === currentSession.userId);
      ordenes[idx].firma_tecnico_base64 = base64Firma;
      ordenes[idx].firma_tecnico_nombre = currentUser ? currentUser.nombre : (currentSession.nombre || ordenes[idx].tecnico || 'Técnico');
      ordenes[idx].firma_tecnico_fecha = fechaFirma;
    } else {
      ordenes[idx].firma_cliente_base64 = base64Firma;
      ordenes[idx].firma_cliente_nombre = document.getElementById('nombre-firma-cliente')?.value || ordenes[idx].cliente || 'Cliente';
      ordenes[idx].firma_cliente_fecha = fechaFirma;
    }
    
    ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
    
    try {
      safeSetJSON('sapi_ordenes', ordenes);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error de almacenamiento local. La firma puede no guardarse si no hay espacio.', 'error');
    }
    
    if (window.pushToSupabase) {
      window.pushToSupabase('ordenes', ordenes[idx]).catch(err => {
         console.error('Error supabase:', err);
         mostrarNotificacion('Error guardando en la nube', 'error');
      });
    }

    if (window.trackTelemetryEvent) {
      const act = tipo === 'tecnico' ? 'Firma de Técnico (Orden Completada)' : 'Firma de Cliente (Orden Firmada)';
      window.trackTelemetryEvent(act, { id: ordenId, folio: ordenes[idx].folio, cliente: ordenes[idx].cliente });
    }
    
    mostrarNotificacion(`Firma del ${tipo} guardada`, 'success');
    verDetalle(ordenId); 
    renderTabla();
    renderTabla('servicios');
  }
}

async function limpiarFirma(ordenId, tipo) {
  try {
    const confirmado = await window.confirmarAccion({
      titulo: 'Borrar Firma',
      mensaje: `¿Estás seguro de que deseas borrar la firma del ${tipo === 'tecnico' ? 'técnico' : 'cliente'}?`,
      esPeligroso: true,
      icono: 'eraser'
    });
    if (!confirmado) return;
    const idx = ordenes.findIndex(o => o.id === ordenId);
    if (idx !== -1) {
      if (ordenes[idx].cierre_papel_pdf) {
        mostrarNotificacion('No se pueden modificar firmas en una orden cerrada en papel.', 'error');
        return;
      }
      if (tipo === 'tecnico') ordenes[idx].firma_tecnico_base64 = '__DELETED__';
      else ordenes[idx].firma_cliente_base64 = '__DELETED__';
      
      ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
      
      safeSetJSON('sapi_ordenes', ordenes);
      if (window.pushToSupabase) window.pushToSupabase('ordenes', ordenes[idx]);
      verDetalle(ordenId); 
    }
  } catch (err) {
    console.error('Error en limpiarFirma:', err);
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Error al borrar firma: ' + err.message, 'error');
    } else {
      alert('Error: ' + err.message);
    }
  }
}

// ============================================================
// MÓDULO DE ASIGNACIÓN SEMANAL Y PROGRAMACIÓN DE TÉCNICOS
// Extraído a asignacion_tecnicos.js y src/modules/asignacion_tecnicos.js
// ============================================================

// Calcula el rango de fechas hábiles permitido para la bitácora
function calcularRangoFechasLaboral(diasHabilAtras) {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset()); // ajuste zona horaria local

  const maxDate = new Date(ahora); // El máximo siempre es hoy (incluso en fin de semana)

  // Retroceder N días hábiles para el mínimo
  const minDate = new Date(ahora);
  let retrocedidos = 0;
  while (retrocedidos < diasHabilAtras) {
    minDate.setDate(minDate.getDate() - 1);
    const d = minDate.getDay();
    if (d !== 0 && d !== 6) retrocedidos++; // Solo cuenta lunes-viernes para el límite inferior
  }

  return {
    min: minDate.toISOString().slice(0, 10),
    max: maxDate.toISOString().slice(0, 10),
  };
}

function abrirBitacora(id, defaultNote = '', isOnlyTraslado = false) {
  const o = ordenes.find(x => x.id === id);
  if (o && !isOnlyTraslado && (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf))) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  window.currentBitacoraOrdenId = id;
  window.currentBitacoraEntryId = null;
  const rango = calcularRangoFechasLaboral(10);

  // Lógica para mostrar/ocultar campos si es solo traslado
  const modalTitle = document.getElementById('modal-bitacora-title');
  const grupoHoras = document.getElementById('grupo-bitacora-horas');
  const grupoTraslados = document.getElementById('grupo-bitacora-traslados');
  const colTrasladoIda = document.getElementById('col-traslado-ida');
  const inputEntrada = document.getElementById('bitacora-entrada');
  const inputSalida = document.getElementById('bitacora-salida');

  if (isOnlyTraslado) {
    if (modalTitle) modalTitle.textContent = 'Registrar Traslado de Regreso';
    
    // Ocultar grupo de traslados numéricos
    if (grupoTraslados) grupoTraslados.style.display = 'none';
    
    // Mostrar grupo de horas y cambiar etiquetas
    if (grupoHoras) grupoHoras.style.display = 'flex';
    const lblEntrada = document.getElementById('lbl-bitacora-entrada');
    const lblSalida = document.getElementById('lbl-bitacora-salida');
    if (lblEntrada) lblEntrada.textContent = 'Hora de Salida *';
    if (lblSalida) lblSalida.textContent = 'Hora de Llegada *';
    
    // Asegurar que sean requeridos
    if (inputEntrada) inputEntrada.setAttribute('required', 'true');
    if (inputSalida) inputSalida.setAttribute('required', 'true');
  } else {
    if (modalTitle) modalTitle.textContent = 'Registrar Avance Diario';
    
    // Mostrar ambos grupos
    if (grupoHoras) grupoHoras.style.display = 'flex';
    if (grupoTraslados) grupoTraslados.style.display = 'flex';
    if (colTrasladoIda) colTrasladoIda.style.display = 'block';
    
    // Restaurar etiquetas originales
    const lblEntrada = document.getElementById('lbl-bitacora-entrada');
    const lblSalida = document.getElementById('lbl-bitacora-salida');
    if (lblEntrada) lblEntrada.textContent = 'Hora de Entrada *';
    if (lblSalida) lblSalida.textContent = 'Hora de Salida *';
    
    // Asegurar que sean requeridos
    if (inputEntrada) inputEntrada.setAttribute('required', 'true');
    if (inputSalida) inputSalida.setAttribute('required', 'true');
  }

  const fechaInput = document.getElementById('bitacora-fecha');
  fechaInput.value = rango.max; // pre-selecciona el último día hábil (hoy o viernes si es fin de semana)
  fechaInput.min = rango.min;
  fechaInput.max = rango.max;

  document.getElementById('bitacora-nota').value = defaultNote || '';
  document.getElementById('bitacora-entrada').value = '';
  document.getElementById('bitacora-salida').value = '';
  document.getElementById('bitacora-horas-traslado').value = '';
  document.getElementById('bitacora-horas-regreso').value = '';
  
  if (defaultNote) {
    const tipoSelect = document.getElementById('bitacora-tipo');
    if (tipoSelect) {
      Array.from(tipoSelect.options).forEach(opt => {
        if (opt.value.toLowerCase().includes('traslado')) opt.selected = true;
      });
    }
  }
  
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function iniciarReporteDesdeAsignacion(ordenId, bitacoraId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado')) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  const b = o.bitacora?.find(x => x.id === bitacoraId);
  if (!b) return;

  if (currentSession.viewMode === 'tecnico') {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';
    const normStr = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normStr(b.tecnico) !== normStr(miTecnicoNombre)) {
      mostrarNotificacion('Solo puedes reportar tus propias asignaciones programadas.', 'error');
      return;
    }
  }

  window.currentBitacoraOrdenId = ordenId;
  window.currentBitacoraEntryId = bitacoraId;

  // Modificar título del modal para contextualizar
  const modalTitle = document.getElementById('modal-bitacora-title');
  if (modalTitle) modalTitle.textContent = 'Reportar Trabajo de Asignación';

  const fechaInput = document.getElementById('bitacora-fecha');
  if (fechaInput) {
    let dateStr = b.fecha;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    fechaInput.value = dateStr;
    // Permitir al técnico registrar la fecha programada
    fechaInput.min = '';
    fechaInput.max = '';
  }

  // Pre-rellenar horas de la asignación y limpiar la nota por defecto del supervisor
  document.getElementById('bitacora-nota').value = '';
  document.getElementById('bitacora-entrada').value = b.entrada || '';
  document.getElementById('bitacora-salida').value = b.salida || '';
  document.getElementById('bitacora-horas-traslado').value = b.horas_traslado || '';
  document.getElementById('bitacora-horas-regreso').value = b.horas_regreso || '';
  
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}
window.iniciarReporteDesdeAsignacion = iniciarReporteDesdeAsignacion;

function editarBitacora(ordenId, bitacoraId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf)) {
    mostrarNotificacion('No se pueden editar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const b = o.bitacora?.find(x => x.id === bitacoraId);
  if (!b) return;

  window.currentBitacoraOrdenId = ordenId;
  window.currentBitacoraEntryId = bitacoraId;

  // Establecer título del modal
  const modalTitle = document.getElementById('modal-bitacora-title');
  if (modalTitle) modalTitle.textContent = 'Editar Entrada de Bitácora';

  const fechaInput = document.getElementById('bitacora-fecha');
  const dObj = new Date(b.fecha);
  const dateStr = !isNaN(dObj) ? dObj.toISOString().split('T')[0] : '';
  fechaInput.value = dateStr;
  
  // Como admin, quitamos las restricciones de fecha para poder editar fechas pasadas
  fechaInput.min = '';
  fechaInput.max = '';

  document.getElementById('bitacora-nota').value = b.nota || '';
  document.getElementById('bitacora-entrada').value = b.entrada || '';
  document.getElementById('bitacora-salida').value = b.salida || '';
  document.getElementById('bitacora-horas-traslado').value = b.horas_traslado || '';
  document.getElementById('bitacora-horas-regreso').value = b.horas_regreso || '';
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function cerrarBitacora(e) {
  if (e && e.target !== document.getElementById('modal-bitacora-overlay')) return;
  document.getElementById('modal-bitacora-overlay').classList.remove('open');
}

function actualizarEventoCalendarioDesdeBitacora(orden, bitacoraEntry) {
  try {
    const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    
    // Buscar si ya existe el evento por ID
    let idx = localEventos.findIndex(x => x.id === bitacoraEntry.id || x.id === `bit-${bitacoraEntry.id}`);
    
    // Si no existe por ID, buscamos si hay algún evento de esta orden en el mismo día y técnico
    if (idx === -1 && bitacoraEntry.fecha) {
      const bitDate = bitacoraEntry.fecha.substring(0, 10);
      idx = localEventos.findIndex(x => 
        x.ordenId === orden.id && 
        (x.start && x.start.substring(0, 10) === bitDate) &&
        (x.tecnicoNombre === bitacoraEntry.tecnico)
      );
    }

    let color = '#ef4444'; // Rojo: Trabajo realizado sin asignación
    if (bitacoraEntry.realizado === false || (bitacoraEntry.nota && bitacoraEntry.nota.includes('Programado por supervisor') && bitacoraEntry.realizado !== true)) {
      color = '#8b5cf6'; // Morado: Asignación programada (Pendiente)
    } else if (bitacoraEntry.realizado === true) {
      if (bitacoraEntry.programadoEntrada) {
        const isAligned = !bitacoraEntry.desviacion || bitacoraEntry.desviacion === 'Alineado' || bitacoraEntry.desviacion === '0m';
        color = isAligned ? '#10b981' : '#3b82f6'; // Verde o Azul
      } else {
        color = '#ef4444'; // Rojo: Trabajo realizado sin asignación
      }
    }

    const entradaHora = bitacoraEntry.entrada || '08:00';
    const salidaHora = bitacoraEntry.salida || '18:00';
    const dateStr = bitacoraEntry.fecha ? bitacoraEntry.fecha.substring(0, 10) : new Date().toISOString().split('T')[0];
    const startISO = `${dateStr}T${entradaHora}:00`;
    
    let endDateStr = dateStr;
    if (bitacoraEntry.salida && bitacoraEntry.entrada && bitacoraEntry.salida < bitacoraEntry.entrada) {
      const dObj = new Date(dateStr + 'T00:00:00');
      dObj.setDate(dObj.getDate() + 1);
      endDateStr = dObj.toISOString().split('T')[0];
    }
    const endISO = `${endDateStr}T${salidaHora}:00`;

    const usr = usuarios.find(u => u.nombre === bitacoraEntry.tecnico);
    const tecnicoId = usr ? usr.id : null;

    const eventTitle = `${(bitacoraEntry.tecnico || 'Téc').split(' ')[0]} | ${orden.cliente}`;

    const eventoObj = {
      id: idx > -1 ? localEventos[idx].id : bitacoraEntry.id,
      titulo: eventTitle,
      start: new Date(startISO).toISOString(),
      end: new Date(endISO).toISOString(),
      tipo: 'Servicio',
      tecnicoId: tecnicoId,
      tecnicoNombre: bitacoraEntry.tecnico,
      ordenId: orden.id,
      descripcion: bitacoraEntry.nota || '',
      color: color,
      todoElDia: false,
      allDay: false
    };

    if (idx > -1) {
      localEventos[idx] = eventoObj;
    } else {
      localEventos.push(eventoObj);
    }

    localStorage.setItem('sapi_calendario_eventos', JSON.stringify(localEventos));
    if (window.pushToSupabase) {
      window.pushToSupabase('calendario_eventos', eventoObj);
    }
  } catch(e) {
    console.error('Error al sincronizar evento en calendario_eventos:', e);
  }
}

function guardarNotaBitacora() {
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  const o = ordenes.find(x => x.id === window.currentBitacoraOrdenId);
  if (!o) return;
  if (o.cierre_papel_pdf) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  
  const fecha = document.getElementById('bitacora-fecha').value;
  const nota = document.getElementById('bitacora-nota').value.trim();
  const entrada = document.getElementById('bitacora-entrada').value;
  const salida = document.getElementById('bitacora-salida').value;
  const horasTraslado = document.getElementById('bitacora-horas-traslado').value;
  const horasRegreso = document.getElementById('bitacora-horas-regreso').value;
  
  if (!fecha || !nota || !entrada || !salida) {
    mostrarNotificacion('Todos los campos son obligatorios (fecha, nota, hora de salida y hora de llegada).', 'warning');
    return;
  }

  const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
  const isTraslado = document.getElementById('modal-bitacora-title')?.textContent === 'Registrar Traslado de Regreso';
  let hrsRegCalc = horasRegreso ? parseFloat(horasRegreso) : null;
  if (isTraslado && entrada && salida) {
    const [hE, mE] = entrada.split(':').map(Number);
    const [hS, mS] = salida.split(':').map(Number);
    let diff = (hS * 60 + mS) - (hE * 60 + mE);
    if (diff < 0) diff += 24 * 60;
    hrsRegCalc = parseFloat((diff / 60).toFixed(2));
  }

  if (!isAdmin) {
    if (isTraslado) {
      let lastDateStr = o.firma_cliente_fecha || o.firma_tecnico_fecha;
      if (!lastDateStr) {
        if (o.bitacora && o.bitacora.length > 0) {
          const validEntries = o.bitacora.filter(b => b.id !== window.currentBitacoraEntryId && b.tipo !== 'Aviso del Sistema');
          if (validEntries.length > 0) {
            validEntries.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
            lastDateStr = validEntries[0].fecha;
          }
        }
      }
      if (!lastDateStr) lastDateStr = o.fecha;
      
      if (lastDateStr) {
        const dCierre = new Date(lastDateStr);
        dCierre.setHours(0,0,0,0);
        
        const dSeleccionada = new Date(fecha + 'T00:00:00'); // Tratar la fecha seleccionada en local
        const diffTime = dSeleccionada.getTime() - dCierre.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0 || diffDays > 2) {
          mostrarNotificacion('La fecha del traslado no puede exceder los 2 días después de la firma o el último trabajo reportado.', 'error');
          return;
        }
      }
    } else {
      // Validar que esté dentro del rango hábil permitido (que ahora permite fines de semana si caen en el rango)
      const rango = calcularRangoFechasLaboral(10);
      if (fecha < rango.min || fecha > rango.max) {
        mostrarNotificacion('La fecha seleccionada está fuera del rango permitido.', 'error');
        return;
      }
    }
  }
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreTecnico = currentUser ? currentUser.nombre : 'Usuario';
  const tecnicoDestino = window.currentBitacoraEntryId && o.bitacora ? 
      (o.bitacora.find(x => x.id === window.currentBitacoraEntryId)?.tecnico || nombreTecnico) : 
      nombreTecnico;

  // Validación de empalme de horarios (no permitir que el técnico repita horario)
  if (entrada && salida) {
    const doOverlap = (e1, s1, e2, s2) => {
      if (!e1 || !s1 || !e2 || !s2) return false;
      const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      let mE1 = toMin(e1), mS1 = toMin(s1);
      let mE2 = toMin(e2), mS2 = toMin(s2);
      if (mS1 <= mE1) mS1 += 24*60;
      if (mS2 <= mE2) mS2 += 24*60;
      return (mE1 < mS2 && mE2 < mS1);
    };

    let empalme = null;
    for (const ord of ordenes) {
      if (!ord.bitacora) continue;
      for (const bit of ord.bitacora) {
        if (bit.id === window.currentBitacoraEntryId) continue; // Ignorar el mismo registro si estamos editando
        if (bit.tecnico !== tecnicoDestino) continue; // Solo validar registros del mismo técnico
        
        try {
          const bitDateObj = new Date(bit.fecha);
          if (isNaN(bitDateObj)) continue;
          const bitDate = bitDateObj.toISOString().split('T')[0];
          
          if (bitDate === fecha) { // Si están en la misma fecha
            if (doOverlap(entrada, salida, bit.entrada, bit.salida)) {
              empalme = { ordenFolio: ord.folio || ord.id, entrada: bit.entrada, salida: bit.salida };
              break;
            }
          }
        } catch(e){}
      }
      if (empalme) break;
    }

    if (empalme) {
      mostrarNotificacion(`Horario empalmado con otro registro tuyo de ${empalme.entrada} a ${empalme.salida} (Orden: ${empalme.ordenFolio}).`, 'error');
      return;
    }
  }
  
  if (!o.bitacora) o.bitacora = [];

  let esAsignacionPendiente = false;
  if (window.currentBitacoraEntryId) {
    const bIndex = o.bitacora.findIndex(x => x.id === window.currentBitacoraEntryId);
    if (bIndex >= 0) {
      const bObj = o.bitacora[bIndex];
      if (bObj.realizado === false || (bObj.nota && bObj.nota.includes('Programado por supervisor') && bObj.realizado !== true)) {
        esAsignacionPendiente = true;
      }
    }
  }

  if (window.currentBitacoraEntryId && !esAsignacionPendiente) {
    // MODO EDICIÓN REAL (de una bitácora ya reportada previamente)
    const bIndex = o.bitacora.findIndex(x => x.id === window.currentBitacoraEntryId);
    if (bIndex >= 0) {
      o.bitacora[bIndex].fecha = new Date(fecha).toISOString();
      o.bitacora[bIndex].nota = nota;
      o.bitacora[bIndex].entrada = entrada;
      o.bitacora[bIndex].salida = salida;
      o.bitacora[bIndex].horas_traslado = horasTraslado ? parseFloat(horasTraslado) : null;
      o.bitacora[bIndex].horas_regreso = hrsRegCalc !== null ? hrsRegCalc : (horasRegreso ? parseFloat(horasRegreso) : null);
      o.bitacora[bIndex].realizado = true;
      actualizarEventoCalendarioDesdeBitacora(o, o.bitacora[bIndex]);
    }
  } else {
    // MODO CREACIÓN NUEVA (o reporte de asignación pendiente)
    let progEntrada = '';
    let progSalida = '';
    let desviacionStr = null;
    let bObjRef = null;

    if (esAsignacionPendiente) {
      const bObj = o.bitacora.find(x => x.id === window.currentBitacoraEntryId);
      if (bObj) {
        bObjRef = bObj;
        progEntrada = bObj.entrada || '';
        progSalida = bObj.salida || '';
        
        if (progEntrada && progSalida && entrada && salida) {
          const toMin = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          let minReal = toMin(salida) - toMin(entrada);
          if (minReal < 0) minReal += 24 * 60;
          
          let minProg = toMin(progSalida) - toMin(progEntrada);
          if (minProg < 0) minProg += 24 * 60;
          
          const diffMin = minReal - minProg;
          
          if (diffMin === 0) {
            desviacionStr = 'Alineado';
          } else {
            const absMin = Math.abs(diffMin);
            const hrs = Math.floor(absMin / 60);
            const mns = absMin % 60;
            const sign = diffMin > 0 ? '+' : '-';
            desviacionStr = `${sign}${hrs > 0 ? hrs + 'h ' : ''}${mns > 0 ? mns + 'm' : ''}`.trim();
            if (desviacionStr === sign) desviacionStr = 'Alineado'; // fallback
          }
        }
      }
      // Eliminar el pendiente programado original
      o.bitacora = o.bitacora.filter(x => x.id !== window.currentBitacoraEntryId);
    }

    // Insertar reporte de trabajo limpio y realizado
    const nuevaEntrada = {
      id: esAsignacionPendiente ? window.currentBitacoraEntryId : crypto.randomUUID(),
      fecha: new Date(fecha).toISOString(),
      nota: nota,
      entrada: entrada,
      salida: salida,
      tecnico: tecnicoDestino,
      realizado: true,
      programadoEntrada: progEntrada || null,
      programadoSalida: progSalida || null,
      desviacion: desviacionStr || null,
      programadoHorasTraslado: bObjRef ? bObjRef.horas_traslado : null,
      programadoHorasRegreso: bObjRef ? bObjRef.horas_regreso : null,
      fecha_inicio_traslado: bObjRef ? bObjRef.fecha_inicio_traslado : null,
      hora_inicio: bObjRef ? bObjRef.hora_inicio : null,
      fecha_fin_regreso: bObjRef ? bObjRef.fecha_fin_regreso : null,
      hora_fin_regreso: bObjRef ? bObjRef.hora_fin_regreso : null,
      horas_traslado: horasTraslado ? parseFloat(horasTraslado) : (bObjRef ? bObjRef.horas_traslado : null),
      horas_regreso: hrsRegCalc !== null ? hrsRegCalc : (horasRegreso ? parseFloat(horasRegreso) : (bObjRef ? bObjRef.horas_regreso : null)),
      tipo: bObjRef ? bObjRef.tipo : (isTraslado ? 'Traslado' : 'Servicio')
    };
    o.bitacora.push(nuevaEntrada);
    actualizarEventoCalendarioDesdeBitacora(o, nuevaEntrada);
  }
  
  o.estado = calcularEstadoOrden(o);
  
  safeSetJSON('sapi_ordenes', ordenes);
  if (window.pushToSupabase) {
    window.pushToSupabase('ordenes', o);
  }

  if (window.trackTelemetryEvent) {
    const act = window.currentBitacoraEntryId ? 'Edición de Avance (Bitácora)' : 'Registro de Avance (Bitácora)';
    window.trackTelemetryEvent(act, { id: o.id, folio: o.folio, cliente: o.cliente });
  }
  
  mostrarNotificacion(window.currentBitacoraEntryId ? 'Bitácora actualizada.' : 'Entrada de bitácora guardada.', 'success');
  cerrarBitacora();
  verDetalle(o.id); // Recargar modal
  renderTabla();
  renderTabla('servicios');
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}

// ==========================
// AUTOMATIZACIÓN DE ESTADOS
// ==========================
function calcularEstadoOrden(o) {
  const isSignedByClient = (!(!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__') && o.firma_cliente_base64 !== '__DELETED__');
  const refNecesarias = o.ref_necesarias || [];
  const hasPendingParts = refNecesarias.length > 0;
  
  if (isSignedByClient) {
    if (hasPendingParts) {
      return 'Refacciones pendientes';
    } else {
      return 'Completado';
    }
  } else {
    const hasBitacora = o.bitacora && o.bitacora.length > 0;
    const hasFalla = (o.falla || '').trim();
    const hasTrabajos = (o.trabajos || '').trim();
    const hasDictamen = (o.dictamen || '').trim();
    const hasCondiciones = (o.condiciones || '').trim();
    const hasObservaciones = (o.observaciones || '').trim();
    const hasPendientes = (o.pendientes || '').trim();
    const hasRefUtilizadas = o.ref_utilizadas && o.ref_utilizadas.length > 0;
    
    const hasData = hasFalla || hasTrabajos || hasDictamen || hasCondiciones || hasObservaciones || hasPendientes || hasRefUtilizadas || hasPendingParts;
    
    if (hasBitacora || hasData || (o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__')) {
      return 'En proceso';
    } else {
      return 'Pendiente';
    }
  }
}

function cerrarDetalle(e) {
  if (e && e.target !== document.getElementById('modal-detalle-overlay')) return;
  document.getElementById('modal-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function generarBase64Pdf(ordenId) {
  let ordList = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? [...ordenes] : [];
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) ordList = ordList.concat(window.ordenes);
  try {
    const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if (Array.isArray(local)) ordList = ordList.concat(local);
  } catch (e) {}

  const o = ordList.find(x => x && (String(x.id) === String(ordenId) || String(x.folio) === String(ordenId) || String(x.folio || '').replace(/\D/g, '') === String(ordenId).replace(/\D/g, '')));
  if (!o) {
    console.warn('[generarBase64Pdf] Orden no encontrada para ID:', ordenId);
    return null;
  }

  const formatFecha = (fStr) => {
    if (!fStr) return '—';
    if (typeof window.formatFechaAmigable === 'function') return window.formatFechaAmigable(fStr);
    if (fStr.includes('T')) {
      const parts = fStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fStr;
  };

  const badgeEstado = (estado) => {
    if (estado === 'En Proceso') return 'badge-proceso';
    if (estado === 'Completado') return 'badge-completado';
    return 'badge-pendiente';
  };

  const seccion = (title, content) => `
    <div class="detalle-section" style="margin-bottom:1.5rem; page-break-inside:avoid; break-inside:avoid;">
      <div class="detalle-section-title" style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#0f172a; margin-bottom:0.75rem; padding:0.35rem 0.6rem; background:#f1f5f9; border-left:4px solid #e8820c;">${title}</div>
      ${content}
    </div>`;

  const field = (label, val, span = 1) => `
    <div class="detalle-field col-span-${span}" style="border-bottom:1px solid #e2e8f0; padding-bottom:0.35rem; page-break-inside:avoid; break-inside:avoid; grid-column: span ${span};">
      <div class="detalle-label" style="font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:0.2rem;">${label}</div>
      <div class="detalle-value" style="font-size:0.85rem; font-weight:600; word-break:break-word; color:#0f172a; line-height:1.3;">${val || '—'}</div>
    </div>`;

  const refTable = (items, hasPrice) => {
    if (!items || !items.length) return '<p style="color:#64748b; font-size:0.82rem; margin:0;">Sin refacciones</p>';
    return `<table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.5rem;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Descripción</th>
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Clave</th>
        <th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Cant.</th>
        ${hasPrice ? '<th style="padding:0.5rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:600; color:#475569; text-transform:uppercase; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Precio</th>' : ''}
      </tr></thead>
      <tbody>${items.map(r => `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.descripcion||'—'}</td>
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.clave||'—'}</td>
        <td style="padding:0.5rem 0.75rem; color:#334155;">${r.cantidad||'—'}</td>
        ${hasPrice ? `<td style="padding:0.5rem 0.75rem; color:#334155;">$${r.precio||'0'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  };

  // Bitácora Diaria
  let bitacoraHtml = '';
  const bitacoraItems = [...(o.bitacora || [])];
  if (bitacoraItems.length === 0) {
    bitacoraHtml = '<p style="color:#64748b; font-size:0.8rem; font-style:italic; margin:0;">Sin registros en la bitácora.</p>';
  } else {
    const sortedBitacora = bitacoraItems.sort((a, b) => {
      const dateA = a.fecha || '';
      const dateB = b.fecha || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.entrada || '';
      const timeB = b.entrada || '';
      return timeA.localeCompare(timeB);
    });

    bitacoraHtml += `
      <table style="width:100%; border-collapse:collapse; font-size:0.75rem; margin-top:0.5rem; color:#334155;">
        <thead>
          <tr style="background:#f8fafc; text-align:left; color:#475569;">
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:15%; text-transform:uppercase; font-size:0.68rem;">Fecha</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:20%; text-transform:uppercase; font-size:0.68rem;">Técnico</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:20%; text-transform:uppercase; font-size:0.68rem;">Horario</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:15%; text-transform:uppercase; font-size:0.68rem;">Estado</th>
            <th style="padding:0.5rem 0.75rem; border-top:1px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:600; width:30%; text-transform:uppercase; font-size:0.68rem;">Actividad / Avances Reportados</th>
          </tr>
        </thead>
        <tbody>
    `;

    sortedBitacora.forEach(b => {
      let fFormateada = b.fecha;
      try {
        const dObj = new Date(b.fecha);
        if (!isNaN(dObj)) {
          fFormateada = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
        }
      } catch(e){}

      let hrsStr = '—';
      if (b.entrada && b.salida) {
        hrsStr = `${b.entrada} - ${b.salida}`;
      } else if (b.entrada || b.salida) {
        hrsStr = `${b.entrada || '--:--'} - ${b.salida || '--:--'}`;
      }

      let estadoStr = b.realizado ? 'REPORTADO' : 'PROGRAMADO';
      if (b.realizado && b.desviacion) {
        estadoStr += ` (${b.desviacion})`;
      }

      bitacoraHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:0.5rem 0.75rem; white-space:nowrap;">${fFormateada}</td>
          <td style="padding:0.5rem 0.75rem; font-weight:500;">${b.tecnico || '—'}</td>
          <td style="padding:0.5rem 0.75rem; white-space:nowrap;">${hrsStr}</td>
          <td style="padding:0.5rem 0.75rem; font-size:0.7rem; font-weight:600;">${estadoStr}</td>
          <td style="padding:0.5rem 0.75rem; white-space:pre-wrap; line-height:1.3; color:#334155;">${b.nota || '—'}</td>
        </tr>
      `;
    });

    bitacoraHtml += `</tbody></table>`;
  }

  // Evidencias Fotográficas
  let ev = o.evidencias || {};
  if (typeof ev === 'string') {
    try { ev = JSON.parse(ev); } catch(e) { ev = {}; }
  }
  const rawAdicionales = Array.isArray(ev.adicionales) ? ev.adicionales : (ev.adicionales ? Object.values(ev.adicionales) : []);
  const logoSrc = 'logo_transparent.png';

  const toUri = window.urlToDataUri || (async (u) => u);
  const [
    logoDataUri,
    fotoInicioDataUri,
    fotoFinDataUri,
    firmaTecnicoDataUri,
    firmaClienteDataUri,
    legacyEvidenciaDataUri,
    ...adicionalesDataUris
  ] = await Promise.all([
    toUri(logoSrc),
    toUri(ev.fotoInicio),
    toUri(ev.fotoFin),
    toUri(o.firma_tecnico_base64 || o.firma_tecnico_url || o.firma_tecnico),
    toUri(o.firma_cliente_base64 || o.firma_cliente_url || o.firma_cliente),
    toUri(o.evidenciaBase64 || o.evidencias_url),
    ...rawAdicionales.map(u => toUri(u))
  ]);

  const fotoInicioFinal = fotoInicioDataUri || ev.fotoInicio;
  const fotoFinFinal = fotoFinDataUri || ev.fotoFin;
  const logoFinal = logoDataUri || logoSrc;
  const firmaTecnicoFinal = firmaTecnicoDataUri || o.firma_tecnico_base64 || o.firma_tecnico_url || o.firma_tecnico;
  const firmaClienteFinal = firmaClienteDataUri || o.firma_cliente_base64 || o.firma_cliente_url || o.firma_cliente;
  const adicionalesFinales = rawAdicionales.map((url, idx) => adicionalesDataUris[idx] || url);

  let printEvidenciasHtml = '';
  const tieneInicio = !!fotoInicioFinal;
  const tieneFin = !!fotoFinFinal;

  if (tieneInicio || tieneFin || adicionalesFinales.length > 0 || legacyEvidenciaDataUri) {
    printEvidenciasHtml += `<div style="display:block; margin-top:0.5rem;"><div style="display:block; text-align:left;">`;
    if (tieneInicio) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-right:1.5rem; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Inicio (Entrada)</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${fotoInicioFinal}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    if (tieneFin) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Fin (Salida)</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${fotoFinFinal}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    if (!tieneInicio && !tieneFin && legacyEvidenciaDataUri) {
      printEvidenciasHtml += `
        <div style="display:inline-block; vertical-align:top; width:330px; margin-bottom:1.5rem; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Evidencia Principal</div>
          <div style="height:210px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:206px; padding:2px; box-sizing:border-box;">
            <img crossorigin="anonymous" src="${legacyEvidenciaDataUri}" style="max-width:310px; max-height:200px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
          </div>
        </div>`;
    }
    printEvidenciasHtml += `</div>`;

    if (adicionalesFinales.length > 0) {
      printEvidenciasHtml += `
        <div style="margin-top:1rem;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.75rem; text-transform:uppercase;">Evidencias Adicionales</div>
          <div style="display:block; text-align:left;">
      `;
      adicionalesFinales.forEach((url, idx) => {
        printEvidenciasHtml += `
          <div style="display:inline-block; vertical-align:top; border:1px solid #d1d5db; border-radius:6px; padding:0.5rem; background:#f9fafb; text-align:center; width:210px; margin-right:1rem; margin-bottom:1rem; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box;">
            <div style="font-size:0.65rem; font-weight:600; color:#4b5563; margin-bottom:0.35rem;">Adicional ${idx + 1}</div>
            <div style="height:140px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; text-align:center; line-height:136px; padding:2px; box-sizing:border-box;">
              <img crossorigin="anonymous" src="${url}" style="max-width:196px; max-height:134px; width:auto; height:auto; display:inline-block; vertical-align:middle;" />
            </div>
          </div>
        `;
      });
      printEvidenciasHtml += `</div></div>`;
    }
    printEvidenciasHtml += `</div>`;
  } else {
    printEvidenciasHtml = '<p style="color:#64748b; font-size:0.8rem; font-style:italic; margin:0;">Sin fotos de evidencia cargadas.</p>';
  }

  // Crear contenedor temporal para el renderizado del PDF
  const reportContainer = document.createElement('div');
  reportContainer.className = 'admin-pdf-render-container';
  reportContainer.style.cssText = 'width:760px; background:#ffffff; color:#0f172a; padding:25px; font-family:Inter, Arial, sans-serif; box-sizing:border-box; line-height:1.4;';

  reportContainer.innerHTML = `
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid #e8820c;">
      <div style="text-align:left;">
        <img crossorigin="anonymous" src="${logoFinal}" alt="Eurorep Logo" style="height:55px; object-fit:contain; margin-bottom:0.4rem;" />
        <div style="font-size:0.75rem; color:#64748b; line-height:1.35;">
          <strong>EURO REPRESENTACIONES S.A. DE C.V.</strong><br>
          Servicio Técnico Especializado en Maquinaria<br>
          Ptalctes@eurorep.mx | www.eurorep.mx
        </div>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0; font-size:1.35rem; color:#0f172a; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Orden de Servicio</h2>
        <div style="font-size:1.15rem; color:#e8820c; font-weight:700; margin-top:0.2rem;">${o.folio || ''}</div>
        <div style="font-size:0.8rem; color:#64748b; margin-top:0.4rem;">
          <strong>Fecha Emisión:</strong> ${formatFecha(o.fecha)}
        </div>
      </div>
    </div>

    <!-- Información General -->
    ${seccion('Información General', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('Folio', o.folio, 1)} ${field('Pedido', o.pedido, 1)} ${field('Fecha', formatFecha(o.fecha), 1)}
        ${field('Cliente', o.cliente, 2)} ${field('Ubicación (Ticket)', o.ubicacion, 1)}
        ${field('Ubicación en Sitio', o.ubicacion_sitio, 3)}
        ${field('Operador', o.operador, 1)} ${field('No. ECO', o.eco, 1)} ${field('Horómetro (Ticket)', o.horometro, 1)}
        ${field('Horómetro Real', o.horometro_real, 1)}
        ${field('Marca', (() => { 
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let m = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
          return MARCAS_RENDER[m.toUpperCase()] || m || '—';
        })(), 1)} ${field('Modelo', o.modelo, 1)} ${field('Serie', o.serie, 1)}
        ${field('ID Máquina', (o.maquinaria_id || o.serie || '—'), 1)}
        ${field('Técnico', o.tecnico, 1)}
        ${field('Ticket Soporte', o.soporte || o.folio_ticket || '—', 1)}
      </div>`)}

    <!-- Kilómetros / Tipo -->
    ${seccion('Kilómetros / Tipo', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('Origen → Trabajo', (o.km_ida != null && o.km_ida !== '') ? o.km_ida + ' km' : null, 1)}
        ${field('Trabajo → Origen', (o.km_vuelta != null && o.km_vuelta !== '') ? o.km_vuelta + ' km' : null, 1)}
        ${field('Total Km', (o.km_total != null && o.km_total !== '') ? o.km_total + ' km' : null, 1)}
        ${field('Tipo de Visita', o.tipo || 'Servicio', 2)}
        ${field('Estado', o.estado || 'Completado', 1)}
      </div>`)}

    <!-- Diagnóstico y Trabajos -->
    ${seccion('Diagnóstico y Trabajos', `
      ${field('Falla reportada', o.falla, 3)}
      <div style="margin-top:0.5rem">${field('Trabajos realizados', o.trabajos, 3)}</div>
      <div style="margin-top:0.5rem">${field('Dictamen', o.dictamen, 3)}</div>
      <div style="margin-top:0.5rem">${field('Condiciones del equipo', o.condiciones, 3)}</div>
      <div style="margin-top:0.5rem">${field('Observaciones', o.observaciones, 3)}</div>
      <div style="margin-top:0.5rem">${field('Pendientes', o.pendientes, 3)}</div>`)}

    <!-- Refacciones -->
    ${seccion('Refacciones Utilizadas', refTable(o.ref_utilizadas, false))}
    ${seccion('Refacciones Necesarias', refTable(o.ref_necesarias, false))}

    ${(o.noches || o.alimentacion || o.traslado_costo) ? seccion('Servicio', `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem 1.25rem;">
        ${field('No. Noches', o.noches, 1)} ${field('Alimentación', o.alimentacion ? o.alimentacion : '', 1)} ${field('Traslado', o.traslado_costo ? o.traslado_costo : '', 1)}
      </div>`) : ''}

    <!-- Bitácora -->
    ${seccion('Bitácora Diaria', bitacoraHtml)}

    <!-- Evidencias -->
    ${seccion('Evidencias Fotográficas', printEvidenciasHtml)}

    <!-- Firmas -->
    ${seccion('Firmas de Conformidad', `
      <div style="display:flex; flex-wrap:wrap; gap:2rem; margin-top:1rem; justify-content:center;">
        <!-- TECNICO -->
        <div style="flex:1; min-width:280px; max-width:340px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a; font-size:0.9rem; font-weight:700; text-align:center;">Firma del Técnico</h4>
          ${firmaTecnicoFinal 
            ? `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; background:white; width:100%; text-align:center; box-sizing:border-box;">
                 <img crossorigin="anonymous" src="${firmaTecnicoFinal}" alt="Firma del técnico" style="max-width:100%; max-height:110px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:#0f172a; font-weight:600; font-size:0.82rem; margin-top:0.4rem; margin-bottom:0;">${o.firma_tecnico_nombre || o.tecnico || 'Técnico Asignado'}</p>
                 ${o.firma_tecnico_fecha ? `<p style="text-align:center; color:#64748b; font-size:0.72rem; margin-top:0.2rem; margin-bottom:0;">${new Date(o.firma_tecnico_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>`
            : `<p style="color:#64748b; font-size:0.82rem; font-style:italic; text-align:center;">Sin firma del técnico</p>`
          }
        </div>

        <!-- CLIENTE -->
        <div style="flex:1; min-width:280px; max-width:340px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a; font-size:0.9rem; font-weight:700; text-align:center;">Firma del Cliente</h4>
          ${firmaClienteFinal 
            ? `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; background:white; width:100%; text-align:center; box-sizing:border-box;">
                 <img crossorigin="anonymous" src="${firmaClienteFinal}" alt="Firma del cliente" style="max-width:100%; max-height:110px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:#0f172a; font-weight:600; font-size:0.82rem; margin-top:0.4rem; margin-bottom:0;">${o.firma_cliente_nombre || o.cliente || 'Cliente'}</p>
                 ${o.firma_cliente_fecha ? `<p style="text-align:center; color:#64748b; font-size:0.72rem; margin-top:0.2rem; margin-bottom:0;">${new Date(o.firma_cliente_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>`
            : `<p style="color:#64748b; font-size:0.82rem; font-style:italic; text-align:center;">Sin firma del cliente</p>`
          }
        </div>
      </div>
    `)}
  `;

  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  tempContainer.style.background = '#ffffff';
  tempContainer.appendChild(reportContainer);
  document.body.appendChild(tempContainer);

  // Esperar a que todas las imágenes estén decodificadas y listas
  const imgElements = Array.from(reportContainer.querySelectorAll('img'));
  await Promise.all(imgElements.map(img => {
    if (img.complete && img.naturalWidth > 0) {
      return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise(resolve => {
      img.onload = () => (typeof img.decode === 'function' ? img.decode().then(resolve).catch(resolve) : resolve());
      img.onerror = resolve;
      setTimeout(resolve, 3000);
    });
  }));

  const folio = o.folio || ordenId;
  const opt = {
    margin:       10,
    filename:     `Reporte_Servicio_${folio}.pdf`,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, allowTaint: true, letterRendering: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      const worker = html2pdf().from(reportContainer).set(opt);
      let pdfBase64 = null;
      try {
        pdfBase64 = await worker.output('datauristring');
      } catch (e1) {
        try {
          pdfBase64 = await worker.outputPdf('datauristring');
        } catch (e2) {
          pdfBase64 = await worker.output('bloburl');
        }
      }
      if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.includes(',')) {
        return pdfBase64.split(',')[1];
      }
      return pdfBase64;
    } else {
      console.error('html2pdf library is not loaded');
      return null;
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    return null;
  } finally {
    if (tempContainer.parentNode) {
      document.body.removeChild(tempContainer);
    }
  }
}

window.toggleCampoCorreo = function(campo) {
  const row = document.getElementById(`row-correo-${campo}`);
  if (row) {
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  }
};

window.ejecutarComandoEditor = function(comando) {
  document.execCommand(comando, false, null);
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) editor.focus();
};

window.abrirPaletaColor = function(e, tipo) {
  if (tipo === 'foreColor') {
    document.getElementById('editor-font-color').click();
  } else {
    document.getElementById('editor-bg-color').click();
  }
};

window.ejecutarColorEditor = function(tipo, color) {
  document.execCommand(tipo, false, color);
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) editor.focus();
};

function imprimirOrden() { window.print(); }

function enviarCorreoOrden(ordenId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  // Buscar correo del cliente en clientesDb
  const cli = clientesDb.find(c => c.nombre === o.cliente);
  const destEmail = cli ? (cli.email || cli.E_Mail || '') : '';
  
  document.getElementById('correo-orden-id').value = ordenId;
  document.getElementById('correo-destinatario').value = destEmail || 'cliente@ejemplo.com';
  document.getElementById('correo-asunto').value = `Reporte de Servicio ${o.folio || ''} - ${o.cliente || ''}`;
  
  // Limpiar campos CC y CCO
  const ccEl = document.getElementById('correo-cc');
  const ccoEl = document.getElementById('correo-cco');
  if (ccEl) ccEl.value = '';
  if (ccoEl) ccoEl.value = '';
  
  // Ocultar filas de CC y CCO por defecto
  const rowCc = document.getElementById('row-correo-cc');
  const rowCco = document.getElementById('row-correo-cco');
  if (rowCc) rowCc.style.display = 'none';
  if (rowCco) rowCco.style.display = 'none';

  // Mensaje por defecto en HTML
  const defaultMsgHtml = `Hola,<br><br>Adjuntamos el reporte de servicio correspondiente a la orden de servicio folio <strong>${o.folio || ''}</strong>.<br><br>Saludos cordiales,<br>Euro Representaciones`;
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) {
    editor.innerHTML = defaultMsgHtml;
  }
  
  const labelAdjunto = document.getElementById('adjunto-pdf-nombre');
  if (labelAdjunto) {
    labelAdjunto.textContent = `Reporte_Servicio_${o.folio || ordenId}.pdf`;
  }
  
  const overlay = document.getElementById('modal-correo-overlay');
  if (overlay) {
    overlay.classList.add('open');
  }
  
  // Resetear el visor
  const frame = document.getElementById('correo-pdf-frame');
  const spinner = document.getElementById('correo-pdf-loading');
  if (frame && spinner) {
    frame.style.display = 'none';
    frame.src = '';
    spinner.style.display = 'flex';
    spinner.innerHTML = `
      <div style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span style="font-size: 0.75rem; font-weight: 600;">Generando vista previa del PDF...</span>
    `;
  }
  
  window._ultimoPdfGenerado = null;
  
  // Iniciar la generación en segundo plano
  setTimeout(() => {
    generarBase64Pdf(ordenId).then(base64Pdf => {
      if (base64Pdf) {
        window._ultimoPdfGenerado = base64Pdf;
        
        // Cargar en el frame
        try {
          const raw = window.atob(base64Pdf);
          const rawLength = raw.length;
          const uInt8Array = new Uint8Array(rawLength);
          for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          const blob = new Blob([uInt8Array], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          
          if (frame && spinner) {
            frame.src = blobUrl;
            frame.style.display = 'block';
            spinner.style.display = 'none';
          }
        } catch (blobErr) {
          console.error('Error loading blob to frame:', blobErr);
          if (spinner) {
            spinner.innerHTML = '<span style="color:#ef4444; font-size:0.75rem;">Error al renderizar PDF</span>';
          }
        }
      } else {
        if (spinner) {
          spinner.innerHTML = '<span style="color:#ef4444; font-size:0.75rem;">Error al generar reporte</span>';
        }
      }
    });
  }, 300);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function cerrarModalCorreo() {
  const overlay = document.getElementById('modal-correo-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
  const frame = document.getElementById('correo-pdf-frame');
  if (frame) {
    frame.src = '';
  }
  const editor = document.getElementById('correo-mensaje-editor');
  if (editor) {
    editor.innerHTML = '';
  }
  window._ultimoPdfGenerado = null;
}

async function procesarEnviarCorreo(e) {
  if (e) e.preventDefault();
  
  const ordenId = document.getElementById('correo-orden-id').value;
  const destinatario = document.getElementById('correo-destinatario').value.trim();
  const cc = document.getElementById('correo-cc').value.trim();
  const bcc = document.getElementById('correo-cco').value.trim();
  const asunto = document.getElementById('correo-asunto').value.trim();
  
  const editor = document.getElementById('correo-mensaje-editor');
  const mensajeHtml = editor ? editor.innerHTML : '';
  
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  if (!destinatario) {
    mostrarNotificacion("Por favor ingresa un destinatario válido", "error");
    return;
  }
  
  const btnSubmit = document.getElementById('btn-enviar-correo-submit');
  
  let base64Pdf = window._ultimoPdfGenerado;
  if (!base64Pdf) {
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = 'Generando PDF...';
    }
    mostrarNotificacion("Generando reporte PDF adjunto...", "info");
    try {
      base64Pdf = await generarBase64Pdf(ordenId);
    } catch (pdfErr) {
      console.error("Failed to generate PDF:", pdfErr);
    }
  }
  
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Enviando...';
  }
  mostrarNotificacion("Enviando correo con PDF adjunto...", "info");
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <div style="margin-bottom: 20px; line-height: 1.5; font-size: 14px; color: #444;">
        ${mensajeHtml}
      </div>
      <div style="border-top: 2px solid #e8820c; padding-top: 20px; margin-top: 20px;">
        <h2 style="color: #e8820c; text-align: center; margin-top: 0;">Orden de Servicio: ${o.folio || 'N/A'}</h2>
        <p><strong>Cliente:</strong> ${o.cliente || '—'}</p>
        <p><strong>Fecha:</strong> ${formatFechaAmigable(o.fecha)}</p>
        <p><strong>Equipo/Modelo:</strong> ${o.modelo || '—'} (Serie: ${o.serie || '—'})</p>
        <p><strong>Técnico Asignado:</strong> ${o.tecnico || '—'}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
        <p style="text-align: center; color: #777; font-size: 12px;">Se ha adjuntado el documento PDF oficial del reporte a este correo para su descarga y archivo.</p>
      </div>
    </div>
  `;

  try {
    let token = '';
    if (window.supabaseClient && window.supabaseClient.auth) {
      try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        token = sessionData?.session?.access_token || '';
      } catch (authErr) {
        console.warn('Could not read Supabase session token:', authErr);
      }
    }

    const payload = {
      to: destinatario,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: asunto,
      htmlBody: htmlBody
    };

    if (base64Pdf) {
      payload.attachments = [
        {
          filename: `Reporte_Servicio_${o.folio || ordenId}.pdf`,
          content: base64Pdf,
          encoding: 'base64'
        }
      ];
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Sapi-Client-Token': 'SapiSecuredClientToken'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (response.ok) {
      mostrarNotificacion("¡Correo enviado exitosamente con reporte PDF adjunto!", "success");
      cerrarModalCorreo();

      if (typeof window.registrarLogEmail === 'function') {
        window.registrarLogEmail({
          id: 'email_rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          tipo: 'enviado',
          de: 'Ptalctes@eurorep.mx',
          para: payload.to,
          cc: payload.cc || '',
          bcc: payload.bcc || '',
          cliente: o.cliente || 'Cliente',
          asunto: payload.subject,
          cuerpo: `Reporte de Servicio finalizado para la Orden ${o.folio || ordenId}.`,
          htmlBody: htmlBody,
          fecha: new Date().toISOString(),
          evento: 'Reporte de Servicio',
          regla: 'Envío de Reporte PDF',
          estatus: 'Enviado',
          folio_os: o.folio || ordenId,
          folio_ticket: o.folio_ticket || (o.ticket ? o.ticket.folio : ''),
          archivos: base64Pdf ? [`Reporte_Servicio_${o.folio || ordenId}.pdf`] : []
        });
      }
    } else {
      console.error(result);
      mostrarNotificacion("Error al enviar el correo: " + (result.error || result.message || 'Error desconocido'), "error");
    }
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error de conexión al enviar el correo.", "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="send" class="btn-icon"></i> Enviar Correo';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// ===== TICKETS DATA =====
function updateTicketBadge() {
  let filtered = getFilteredTickets();
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtered = filtered.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    } else {
      filtered = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  let tecFilter = '';
  let supFilter = '';
  if (userRole === 'tecnico') {
    const isSuperadmin = (usuarios.find(u => u.id === currentSession.userId)?.rol === 'superadmin');
    if (isSuperadmin && isTestModeActive()) {
      tecFilter = '';
    } else {
      tecFilter = currentUser ? currentUser.nombre : '';
    }
  }
  if (userRole === 'supervisor') {
    const isLauraPaz = currentUser && (
      String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
      String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
      String(currentUser.email).toLowerCase().trim().includes('laurapaz')
    );
    if (isLauraPaz) {
      supFilter = '';
    } else {
      supFilter = currentUser ? currentUser.nombre : '';
    }
  }
  
  if (tecFilter || supFilter) {
    const tecNameLower = tecFilter ? window.normStr(tecFilter) : '';
    const supNameLower = supFilter ? window.normStr(supFilter) : '';
    filtered = filtered.filter(t => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecNameLower) {
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => window.normStr(s));
         passTec = assignedLower.includes(tecNameLower) || 
                   (t.solicitante && window.normStr(t.solicitante) === tecNameLower) || 
                   (t.creadoPor && window.normStr(t.creadoPor) === tecNameLower);
      }
      
      if (supFilter && supNameLower) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === t.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
         }
         
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => window.normStr(s));
         
         let passSupTicket = assignedLower.includes(supNameLower) || 
                             (t.solicitante && window.normStr(t.solicitante) === supNameLower) || 
                             (t.creadoPor && window.normStr(t.creadoPor) === supNameLower);
         
         passSup = passSupClient || passSupTicket;
      }
      
      return passTec && passSup;
    });
  }

  const abiertos = filtered.filter(t => t.estado === 'Abierto').length;
  const badge = document.getElementById('nav-badge-tickets');
  if (badge) {
    if (abiertos > 0) {
      badge.textContent = abiertos;
      badge.classList.add('visible');
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
      badge.style.display = 'none';
    }
  }

  if (typeof window.updateEnviosBadge === 'function') {
    window.updateEnviosBadge();
  }
  if (typeof window.actualizarBadgeLevantamientos === 'function') {
    window.actualizarBadgeLevantamientos();
  }
  if (typeof window.actualizarBadgeJuntaRevision === 'function') {
    window.actualizarBadgeJuntaRevision();
  }
}

function updateOrdenesBadge() {
  let filtered = getFilteredOrders();
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtered = filtered.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        return ocli === nombreEmpresaLogged;
      });
    } else {
      filtered = [];
    }
  }

  const userRole = currentSession.viewMode || '';
  let tecFilter = '';
  let supFilter = '';
  if (userRole === 'tecnico') {
    const isSuperadmin = (usuarios.find(u => u.id === currentSession.userId)?.rol === 'superadmin');
    if (isSuperadmin && isTestModeActive()) {
      tecFilter = '';
    } else {
      tecFilter = currentUser ? currentUser.nombre : '';
    }
  }
  if (userRole === 'supervisor') {
    const isLauraPaz = currentUser && (
      String(currentUser.nombre).toLowerCase().trim() === 'laura paz' ||
      String(currentUser.email).toLowerCase().trim().includes('laura.paz') ||
      String(currentUser.email).toLowerCase().trim().includes('laurapaz')
    );
    if (isLauraPaz) {
      supFilter = '';
    } else {
      supFilter = currentUser ? currentUser.nombre : '';
    }
  }

  if (tecFilter || supFilter) {
    const tecNameLower = tecFilter ? window.normStr(tecFilter) : '';
    const supNameLower = supFilter ? window.normStr(supFilter) : '';
    
    filtered = filtered.filter(o => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecNameLower) {
         let assigned = [];
         if (o.tecnico_asignado) assigned = String(o.tecnico_asignado).split(',').map(s=>s.trim());
         else if (o.tecnico) assigned = String(o.tecnico).split(',').map(s=>s.trim());
         const assignedLower = assigned.map(s => window.normStr(s));
         passTec = assignedLower.includes(tecNameLower);
      }
      
      if (supFilter && supNameLower) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === o.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
         }
         passSup = passSupClient;
      }
      
      return passTec && passSup;
    });
  }

  const activas = filtered.filter(o => o.estado === 'Pendiente' || o.estado === 'En Proceso').length;
  const badge = document.getElementById('nav-badge-ordenes');
  if (badge) {
    if (activas > 0) {
      badge.textContent = activas;
      badge.classList.add('visible');
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
      badge.style.display = 'none';
    }
  }

  if (typeof window.actualizarBadgeLevantamientos === 'function') {
    window.actualizarBadgeLevantamientos();
  }
  if (typeof window.actualizarBadgeDepuradorOrdenes === 'function') {
    window.actualizarBadgeDepuradorOrdenes();
  }
  if (typeof window.actualizarBadgeDepuradorTickets === 'function') {
    window.actualizarBadgeDepuradorTickets();
  }

  if (typeof window.updateEnviosBadge === 'function') {
    window.updateEnviosBadge();
  }
  if (typeof window.actualizarBadgeJuntaRevision === 'function') {
    window.actualizarBadgeJuntaRevision();
  }
}

function actualizarFiltrosPersonal() {
  try {
    const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
    const userRole = currentSession.viewMode || '';
    const isTecnico = userRole === 'tecnico';
    const isSupervisor = userRole === 'supervisor';
    const userName = currentUser ? currentUser.nombre : '';

    const selectsTecnico = [document.getElementById('filter-ord-tecnico'), document.getElementById('filter-dash-tkt-tecnico'), document.getElementById('filter-tkt-tecnico')];
    const selectsSupervisor = [document.getElementById('filter-ord-supervisor'), document.getElementById('filter-dash-tkt-supervisor'), document.getElementById('filter-tkt-supervisor')];
    
    // Combinar todos los roles operativos para que salgan en ambos filtros
    let allStaff = new Set();
    
    // Agregar de usuarios (tecnicos, supervisores, admins)
    if (Array.isArray(usuarios)) {
      usuarios.forEach(u => { 
        if (u && ['tecnico', 'supervisor', 'admin', 'superadmin'].includes(u.rol) && u.activo !== false && typeof u.nombre === 'string') {
          allStaff.add(u.nombre.trim()); 
        }
      });
    }
    
    // Agregar de tecnicosDb
    if (Array.isArray(tecnicosDb)) {
      tecnicosDb.forEach(t => { 
        if (t && typeof t.nombre === 'string') allStaff.add(t.nombre.trim()); 
      });
    }
    
    // Agregar de tickets y ordenes por si hay historicos
    if (Array.isArray(tickets)) {
      tickets.forEach(t => {
        if (!t) return;
        if (typeof t.asignado === 'string' && t.asignado !== 'Sin asignar') {
          t.asignado.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(t.tecnicosAsignados)) {
          t.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(ordenes)) {
      ordenes.forEach(o => {
        if (!o) return;
        if (typeof o.tecnico === 'string') {
          o.tecnico.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(o.tecnicosAsignados)) {
          o.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(clientesDb)) {
      clientesDb.forEach(c => {
        if (!c) return;
        if (typeof c.supervisorAsignado === 'string') allStaff.add(c.supervisorAsignado.trim());
        if (Array.isArray(c.supervisoresAsignados)) {
          c.supervisoresAsignados.forEach(s => { if (typeof s === 'string') allStaff.add(s.trim()); });
        }
      });
    }

    const uniqueStaff = Array.from(allStaff).filter(Boolean).sort((a,b) => a.localeCompare(b));
    
    // Crear lista separada exclusiva para supervisores
    let allSupervisores = new Set();
    if (Array.isArray(usuarios)) {
      usuarios.forEach(u => {
        if (u && u.rol === 'supervisor' && u.activo !== false && typeof u.nombre === 'string') {
          allSupervisores.add(u.nombre.trim());
        }
      });
    }
    if (Array.isArray(clientesDb)) {
      clientesDb.forEach(c => {
        if (!c) return;
        if (typeof c.supervisorAsignado === 'string' && c.supervisorAsignado.trim()) {
          allSupervisores.add(c.supervisorAsignado.trim());
        }
        if (Array.isArray(c.supervisoresAsignados)) {
          c.supervisoresAsignados.forEach(s => {
            if (typeof s === 'string') {
              if (s.includes('-')) { // Es un UUID de usuario, buscamos su nombre
                const u = usuarios.find(usr => usr.id === s);
                if (u && typeof u.nombre === 'string') allSupervisores.add(u.nombre.trim());
              } else {
                allSupervisores.add(s.trim());
              }
            }
          });
        }
      });
    }
    const uniqueSupervisores = Array.from(allSupervisores).filter(Boolean).sort((a,b) => a.localeCompare(b));

    const tecOptionsHtml = '<option value="">Cualquier Técnico</option>' + uniqueStaff.map(n => `<option value="${n}">${n}</option>`).join('');
    const supOptionsHtml = '<option value="">Cualquier Supervisor</option>' + uniqueSupervisores.map(n => `<option value="${n}">${n}</option>`).join('');
    
    selectsTecnico.forEach(sel => { 
      if(sel) { 
        let val = isTecnico ? userName : sel.value; 
        sel.innerHTML = tecOptionsHtml; 
        if (val) {
          const normalizedVal = window.normStr(val);
          const matchedOption = Array.from(sel.options).find(opt => window.normStr(opt.value) === normalizedVal);
          if (matchedOption) {
            val = matchedOption.value;
          }
        }
        sel.value = val; 
        sel.disabled = isTecnico;
      } 
    });
    
    selectsSupervisor.forEach(sel => { 
      if(sel) { 
        let val = sel.value;
        const isFirstLoad = sel.options.length <= 1;
        if (isSupervisor && isFirstLoad) {
          val = userName;
        } else if (isTecnico) {
          val = '';
        }
        sel.innerHTML = supOptionsHtml; 
        if (val) {
          const normalizedVal = window.normStr(val);
          const matchedOption = Array.from(sel.options).find(opt => window.normStr(opt.value) === normalizedVal);
          if (matchedOption) {
            val = matchedOption.value;
          }
        }
        sel.value = val; 
        sel.disabled = isTecnico;
      } 
    });

    // Actualizar filtro de tipo/categoría de ticket
    const selectTipos = [document.getElementById('filter-tkt-tipo'), document.getElementById('filter-dash-tkt-tipo')];
    const baseTipos = [
      'Refacción',
      'Servicio Técnico',
      'Soporte',
      'Garantía',
      'Garantía Interna',
      'Pre-Entrega',
      'Puesta en Marcha',
      'Solicitud de Información',
      'Otro'
    ];
    const allTipos = new Set(baseTipos);
    if (Array.isArray(tickets)) {
      tickets.forEach(t => {
        if (t && (t.categoria || t.tipo)) {
          const cat = String(t.categoria || t.tipo).trim();
          if (cat) allTipos.add(cat);
        }
      });
    }
    const sortedTipos = Array.from(allTipos).filter(Boolean).sort((a,b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const tipoOptionsHtml = '<option value="">Todos los Tipos</option>' + sortedTipos.map(t => `<option value="${t}">${t}</option>`).join('');
    selectTipos.forEach(sel => {
      if (sel) {
        const prevVal = sel.value;
        sel.innerHTML = tipoOptionsHtml;
        if (prevVal) {
          const normalizedVal = window.normStr ? window.normStr(prevVal) : prevVal.toLowerCase().trim();
          const matchedOption = Array.from(sel.options).find(opt => (window.normStr ? window.normStr(opt.value) : opt.value.toLowerCase().trim()) === normalizedVal);
          if (matchedOption) {
            sel.value = matchedOption.value;
          }
        }
      }
    });

    if (window.actualizarUISupervisorFilter) {
      window.actualizarUISupervisorFilter();
    }
    if (window.actualizarUITipoFilter) {
      window.actualizarUITipoFilter(sortedTipos);
    }
  } catch (error) {
    console.error('Error al actualizar filtros de personal:', error);
  }
}

let ticketSortColumn = 'folio';
let ticketSortDirection = 'desc';

window.onSortTicketsChange = function(val) {
  if (!val) return;
  const parts = val.split('-');
  const col = parts[0];
  const dir = parts[1] || 'desc';
  ticketSortColumn = col;
  ticketSortDirection = dir;
  window.actualizarCabeceraOrdenacion();
  renderTickets();
};

window.toggleSortMenu = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-sort-tickets');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  // Cerrar menú de antigüedad si estuviera abierto
  const menuAnt = document.getElementById('menu-antiguedad-filter');
  if (menuAnt) menuAnt.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUISortMenu();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

window.setSortDirection = function(dir) {
  ticketSortDirection = dir;
  window.actualizarCabeceraOrdenacion();
  renderTickets();
};

window.seleccionarColumnaOrden = function(col) {
  const colNorm = (col === 'fecha-mod') ? 'fecha-mod' : col;
  const currentNorm = (ticketSortColumn === 'fecha-modificacion') ? 'fecha-mod' : ticketSortColumn;
  if (currentNorm === colNorm) {
    ticketSortDirection = ticketSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    ticketSortColumn = (col === 'fecha-mod') ? 'fecha-modificacion' : col;
    if (['monto', 'fecha', 'fecha-modificacion', 'fecha-mod', 'folio', 'prioridad', 'comentario'].includes(ticketSortColumn)) {
      ticketSortDirection = 'desc';
    } else {
      ticketSortDirection = 'asc';
    }
  }
  window.actualizarCabeceraOrdenacion();
  const menu = document.getElementById('menu-sort-tickets');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

window.actualizarUISortMenu = function() {
  const colNorm = (ticketSortColumn === 'fecha-modificacion') ? 'fecha-mod' : ticketSortColumn;
  const isAsc = ticketSortDirection === 'asc';

  // Botones de dirección en popover
  const btnDesc = document.getElementById('btn-sort-dir-desc');
  const btnAsc = document.getElementById('btn-sort-dir-asc');
  if (btnDesc && btnAsc) {
    if (!isAsc) {
      btnDesc.style.background = 'var(--bg-card)';
      btnDesc.style.color = 'var(--accent)';
      btnDesc.style.boxShadow = 'var(--shadow-sm)';
      btnAsc.style.background = 'transparent';
      btnAsc.style.color = 'var(--text-muted)';
      btnAsc.style.boxShadow = 'none';
    } else {
      btnAsc.style.background = 'var(--bg-card)';
      btnAsc.style.color = 'var(--accent)';
      btnAsc.style.boxShadow = 'var(--shadow-sm)';
      btnDesc.style.background = 'transparent';
      btnDesc.style.color = 'var(--text-muted)';
      btnDesc.style.boxShadow = 'none';
    }
  }

  const colMeta = {
    'folio': { name: 'Folio', descLabel: 'Mayor a Menor', ascLabel: 'Menor a Mayor', shortDesc: 'Mayor', shortAsc: 'Menor' },
    'fecha-mod': { name: 'Última Modif.', descLabel: 'Más reciente', ascLabel: 'Más antigua', shortDesc: 'Reciente', shortAsc: 'Antigua' },
    'fecha': { name: 'Creación', descLabel: 'Más reciente', ascLabel: 'Más antigua', shortDesc: 'Reciente', shortAsc: 'Antigua' },
    'monto': { name: 'Monto', descLabel: 'Mayor a Menor', ascLabel: 'Menor a Mayor', shortDesc: 'Mayor', shortAsc: 'Menor' },
    'prioridad': { name: 'Prioridad', descLabel: 'Alta a Baja', ascLabel: 'Baja a Alta', shortDesc: 'Alta', shortAsc: 'Baja' },
    'comentario': { name: 'Comentario', descLabel: 'Más reciente', ascLabel: 'Más antiguo', shortDesc: 'Reciente', shortAsc: 'Antiguo' },
    'asunto': { name: 'Asunto', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'solicitante': { name: 'Solicitante', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'estado': { name: 'Estado', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' },
    'tipo': { name: 'Tipo', descLabel: 'Z → A', ascLabel: 'A → Z', shortDesc: 'Z-A', shortAsc: 'A-Z' }
  };

  const currentMeta = colMeta[colNorm] || { name: colNorm, descLabel: 'Desc', ascLabel: 'Asc', shortDesc: 'Desc', shortAsc: 'Asc' };

  // Actualizar texto del botón principal
  const labelBtn = document.getElementById('label-sort-tickets');
  if (labelBtn) {
    const dirText = isAsc ? currentMeta.shortAsc : currentMeta.shortDesc;
    labelBtn.textContent = `${currentMeta.name} (${dirText})`;
  }

  // Actualizar filas de opciones
  const rows = document.querySelectorAll('.sort-opt-row');
  rows.forEach(r => {
    const rCol = r.dataset.col;
    const isAct = (rCol === colNorm);
    r.style.background = isAct ? 'var(--bg-hover)' : 'transparent';
    r.style.color = isAct ? 'var(--accent)' : 'var(--text-primary)';
    r.style.fontWeight = isAct ? '600' : '500';

    const check = r.querySelector('.sort-check');
    if (check) check.style.display = isAct ? 'inline-block' : 'none';

    const sublabel = r.querySelector('.sort-opt-sublabel');
    if (sublabel) {
      const meta = colMeta[rCol];
      if (meta) {
        sublabel.textContent = isAsc ? meta.ascLabel : meta.descLabel;
      }
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.actualizarCabeceraOrdenacion = function() {
  const headers = {
    'folio': 'th-ord-folio',
    'asunto': 'th-ord-asunto',
    'solicitante': 'th-ord-solicitante',
    'area': 'th-ord-area',
    'prioridad': 'th-ord-prioridad',
    'estado': 'th-ord-estado',
    'comentario': 'th-ord-comentario',
    'cotizacion': 'th-ord-cotizacion',
    'monto': 'th-ord-monto-cotizacion',
    'pedido': 'th-ord-pedido',
    'asignado': 'th-ord-asignado',
    'fecha': 'th-ord-fecha',
    'fecha-modificacion': 'th-ord-fecha-modificacion',
    'fecha-mod': 'th-ord-fecha-modificacion'
  };
  
  Object.values(headers).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const text = el.dataset.labelOriginal || el.textContent.replace(/[▲▼]/g, '').trim();
      if (!el.dataset.labelOriginal) {
        el.dataset.labelOriginal = text;
      }
      el.classList.remove('sort-asc', 'sort-desc');
      el.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">${text} <i data-lucide="chevrons-up-down" style="width:14px;height:14px;opacity:0.3;"></i></span>`;
    }
  });
  
  const activeId = headers[ticketSortColumn];
  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    const text = activeEl.dataset.labelOriginal;
    const isAsc = ticketSortDirection === 'asc';
    activeEl.classList.add(isAsc ? 'sort-asc' : 'sort-desc');
    activeEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">${text} <i data-lucide="${isAsc ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;color:var(--accent);"></i></span>`;
  }

  // Sincronizar popover de ordenación
  if (window.actualizarUISortMenu) {
    window.actualizarUISortMenu();
  }

  // Sincronizar select sort-tickets si existe
  const sortSelect = document.getElementById('sort-tickets');
  if (sortSelect) {
    const desired = `${ticketSortColumn}-${ticketSortDirection}`;
    const exists = Array.from(sortSelect.options).some(o => o.value === desired);
    if (exists) {
      sortSelect.value = desired;
    }
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
};

window.ordenarTicketsPor = function(columna) {
  if (ticketSortColumn === columna) {
    ticketSortDirection = ticketSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    ticketSortColumn = columna;
    // Para folios, montos, fechas, modificaciones, prioridades y comentarios, el primer click es 'desc' (Mayor a menor / Más reciente)
    if (['monto', 'fecha', 'fecha-modificacion', 'fecha-mod', 'folio', 'prioridad', 'comentario'].includes(columna)) {
      ticketSortDirection = 'desc';
    } else {
      ticketSortDirection = 'asc';
    }
  }
  renderTickets();
};

// ===== FILTRO DE TIPO DE TICKET =====
window.toggleTipoFilterMenu = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-tkt-tipo-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mSup = document.getElementById('menu-tkt-sup-filter');
  const mAnt = document.getElementById('menu-antiguedad-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mSup) mSup.style.display = 'none';
  if (mAnt) mAnt.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUITipoFilter();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

window.setTicketTipoFilter = function(val) {
  const sel = document.getElementById('filter-tkt-tipo');
  if (sel) {
    sel.value = val || '';
  }
  window.actualizarUITipoFilter();
  const menu = document.getElementById('menu-tkt-tipo-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

window.actualizarUITipoFilter = function(tiposList) {
  const sel = document.getElementById('filter-tkt-tipo');
  const currentVal = sel ? sel.value : '';
  const btn = document.getElementById('btn-tkt-tipo-filter');
  const label = document.getElementById('label-tkt-tipo-filter');
  const listContainer = document.getElementById('tipo-filter-options-list');

  if (label) {
    label.textContent = currentVal ? currentVal : 'Todos los Tipos';
  }
  if (btn) {
    if (currentVal) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  }

  if (listContainer) {
    let options = [];
    if (Array.isArray(tiposList) && tiposList.length > 0) {
      options = tiposList;
    } else if (sel && sel.options) {
      options = Array.from(sel.options).map(o => o.value).filter(Boolean);
    }

    const iconForTipo = (tipo) => {
      const t = String(tipo || '').toLowerCase();
      if (t.includes('refacc')) return 'package';
      if (t.includes('servici') || t.includes('manten')) return 'wrench';
      if (t.includes('soport')) return 'headphones';
      if (t.includes('garant')) return 'shield-check';
      if (t.includes('entrega') || t.includes('marcha')) return 'truck';
      if (t.includes('informac')) return 'help-circle';
      if (t.includes('correctiv') || t.includes('falla')) return 'alert-triangle';
      return 'tag';
    };

    let html = `
      <button type="button" class="tipo-opt-row" onclick="window.setTicketTipoFilter('')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${!currentVal ? 'var(--bg-hover)' : 'transparent'}; color: ${!currentVal ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${!currentVal ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="tags" style="width: 14px; height: 14px; opacity: 0.8;"></i>
          <span>Todos los Tipos</span>
        </div>
        <i data-lucide="check" style="width: 13px; height: 13px; display: ${!currentVal ? 'inline-block' : 'none'};"></i>
      </button>
    `;

    options.forEach(tipo => {
      const isAct = (tipo === currentVal);
      const icon = iconForTipo(tipo);
      html += `
        <button type="button" class="tipo-opt-row" onclick="window.setTicketTipoFilter('${tipo.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${isAct ? 'var(--bg-hover)' : 'transparent'}; color: ${isAct ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${isAct ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="${icon}" style="width: 14px; height: 14px; opacity: 0.8;"></i>
            <span>${tipo}</span>
          </div>
          <i data-lucide="check" style="width: 13px; height: 13px; display: ${isAct ? 'inline-block' : 'none'};"></i>
        </button>
      `;
    });

    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// ===== FILTRO DE SUPERVISOR =====
window.toggleSupervisorFilterMenu = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-tkt-sup-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mTipo = document.getElementById('menu-tkt-tipo-filter');
  const mAnt = document.getElementById('menu-antiguedad-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mTipo) mTipo.style.display = 'none';
  if (mAnt) mAnt.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    window.actualizarUISupervisorFilter();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

window.setTicketSupervisorFilter = function(val) {
  const sel = document.getElementById('filter-tkt-supervisor');
  if (sel) {
    sel.value = val || '';
  }
  window.actualizarUISupervisorFilter();
  const menu = document.getElementById('menu-tkt-sup-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

window.actualizarUISupervisorFilter = function() {
  const sel = document.getElementById('filter-tkt-supervisor');
  const currentVal = sel ? sel.value : '';
  const btn = document.getElementById('btn-tkt-sup-filter');
  const label = document.getElementById('label-tkt-sup-filter');
  const listContainer = document.getElementById('sup-filter-options-list');

  if (label) {
    label.textContent = currentVal ? currentVal : 'Cualquier Supervisor';
  }
  if (btn) {
    if (currentVal) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  }

  if (listContainer && sel && sel.options) {
    const options = Array.from(sel.options).map(o => o.value).filter(Boolean);
    let html = `
      <button type="button" class="sup-opt-row" onclick="window.setTicketSupervisorFilter('')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${!currentVal ? 'var(--bg-hover)' : 'transparent'}; color: ${!currentVal ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${!currentVal ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="users" style="width: 14px; height: 14px; opacity: 0.8;"></i>
          <span>Cualquier Supervisor</span>
        </div>
        <i data-lucide="check" style="width: 13px; height: 13px; display: ${!currentVal ? 'inline-block' : 'none'};"></i>
      </button>
    `;

    options.forEach(sup => {
      const isAct = (sup === currentVal);
      html += `
        <button type="button" class="sup-opt-row" onclick="window.setTicketSupervisorFilter('${sup.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; border-radius: 6px; border: none; background: ${isAct ? 'var(--bg-hover)' : 'transparent'}; color: ${isAct ? 'var(--accent)' : 'var(--text-primary)'}; font-size: 0.8rem; font-weight: ${isAct ? '600' : '500'}; cursor: pointer; text-align: left; transition: all 0.15s;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="user" style="width: 14px; height: 14px; opacity: 0.8;"></i>
            <span>${sup}</span>
          </div>
          <i data-lucide="check" style="width: 13px; height: 13px; display: ${isAct ? 'inline-block' : 'none'};"></i>
        </button>
      `;
    });

    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// ===== FILTRO DE ANTIGÜEDAD (TICKETS) =====
window.ticketAntiguedadModo = 'mod'; // 'mod' o 'crea'
window.ticketAntiguedadRango = ''; // '' (todas), '1_7', '8_15', 'gt_15'

window.toggleAntiguedadFilterMenu = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-antiguedad-filter');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  const mTipo = document.getElementById('menu-tkt-tipo-filter');
  const mSup = document.getElementById('menu-tkt-sup-filter');
  const mSort = document.getElementById('menu-sort-tickets');
  if (mTipo) mTipo.style.display = 'none';
  if (mSup) mSup.style.display = 'none';
  if (mSort) mSort.style.display = 'none';

  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen && typeof lucide !== 'undefined') lucide.createIcons();
};

window.cambiarModoAntiguedad = function(modo) {
  window.ticketAntiguedadModo = modo;
  const tabMod = document.getElementById('tab-antiguedad-mod');
  const tabCrea = document.getElementById('tab-antiguedad-crea');
  if (tabMod && tabCrea) {
    if (modo === 'mod') {
      tabMod.style.background = 'var(--bg-card)';
      tabMod.style.color = 'var(--accent)';
      tabMod.style.boxShadow = 'var(--shadow-sm)';
      tabCrea.style.background = 'transparent';
      tabCrea.style.color = 'var(--text-muted)';
      tabCrea.style.boxShadow = 'none';
    } else {
      tabCrea.style.background = 'var(--bg-card)';
      tabCrea.style.color = 'var(--accent)';
      tabCrea.style.boxShadow = 'var(--shadow-sm)';
      tabMod.style.background = 'transparent';
      tabMod.style.color = 'var(--text-muted)';
      tabMod.style.boxShadow = 'none';
    }
  }
  if (window.ticketAntiguedadRango) {
    window.actualizarUIAntiguedadFilter();
    renderTickets();
  }
};

window.setAntiguedadRango = function(rango) {
  window.ticketAntiguedadRango = rango;
  window.actualizarUIAntiguedadFilter();
  const menu = document.getElementById('menu-antiguedad-filter');
  if (menu) menu.style.display = 'none';
  renderTickets();
};

window.setAntiguedadFilter = function(val) {
  window.setAntiguedadRango(val);
};

window.actualizarUIAntiguedadFilter = function() {
  const btn = document.getElementById('btn-antiguedad-filter');
  const label = document.getElementById('label-antiguedad-filter');
  const rows = document.querySelectorAll('.antiguedad-opt-row');
  
  rows.forEach(r => {
    const isAct = r.dataset.rango === (window.ticketAntiguedadRango || '');
    r.style.background = isAct ? 'var(--bg-hover)' : 'transparent';
    r.style.color = isAct ? 'var(--accent)' : 'var(--text-primary)';
    r.style.fontWeight = isAct ? '600' : '500';
    const check = r.querySelector('.antiguedad-check');
    if (check) check.style.display = isAct ? 'inline-block' : 'none';
  });

  if (!window.ticketAntiguedadRango) {
    if (label) label.textContent = 'Antigüedad';
    if (btn) {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border)';
    }
  } else {
    const modoName = window.ticketAntiguedadModo === 'mod' ? 'Modif' : 'Creación';
    const rangoNames = { '1_7': '1 a 7 d', '8_15': '8 a 15 d', 'gt_15': '+15 d' };
    const text = `${modoName}: ${rangoNames[window.ticketAntiguedadRango] || window.ticketAntiguedadRango}`;
    if (label) label.textContent = text;
    if (btn) {
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

document.addEventListener('click', function(e) {
  const popovers = [
    { menu: document.getElementById('menu-tkt-tipo-filter'), btn: document.getElementById('btn-tkt-tipo-filter') },
    { menu: document.getElementById('menu-tkt-sup-filter'), btn: document.getElementById('btn-tkt-sup-filter') },
    { menu: document.getElementById('menu-antiguedad-filter'), btn: document.getElementById('btn-antiguedad-filter') },
    { menu: document.getElementById('menu-sort-tickets'), btn: document.getElementById('btn-sort-tickets') }
  ];

  popovers.forEach(p => {
    if (p.menu && p.menu.style.display === 'block') {
      if (!p.menu.contains(e.target) && (!p.btn || !p.btn.contains(e.target))) {
        p.menu.style.display = 'none';
      }
    }
  });
});

// ===== ASOCIACIÓN TICKET HIJO DE REFACCIONES (-A) <-> ORDEN DE SERVICIO / TICKET PADRE =====
window.esTicketHijoRefacciones = function(t) {
  if (!t || typeof t !== 'object') return false;
  const tFolio = String(t.folio || '').trim();
  // Solo los tickets que tienen terminación -A / -a o vínculo explícito de subticket
  if (/-[Aa]$/i.test(tFolio) || tFolio.toUpperCase().includes('-A') || Boolean(t.parentTicketId || t.ticketPadreId || t.ticket_padre_id)) {
    return true;
  }
  const asunto = String(t.asunto || '');
  const desc = String(t.descripcion || '');
  if (/(?:refacciones\s*para|ticket\s*padre|derivado\s*del|subticket)/i.test(asunto) || /(?:ticket\s*padre|derivado\s*del\s*ticket|subticket)/i.test(desc)) {
    return true;
  }
  return false;
};

window.obtenerOrdenAsociadaTicket = function(t) {
  if (!t || typeof t !== 'object') return null;

  // 1. Usar pool en memoria prioritariamente para evitar saturar el heap
  let allOrds = (typeof ordenes !== 'undefined' && Array.isArray(ordenes) && ordenes.length > 0)
    ? ordenes
    : ((typeof window !== 'undefined' && Array.isArray(window.ordenes) && window.ordenes.length > 0)
      ? window.ordenes
      : null);

  if (!allOrds) {
    try {
      allOrds = (typeof safeGetJSON === 'function') 
        ? safeGetJSON('sapi_ordenes', []) 
        : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    } catch (e) {
      allOrds = [];
    }
  }

  if (!allOrds || allOrds.length === 0) return null;

  const allTkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];

  // Helper para normalizar cadenas (sin espacios, sin guiones, mayúsculas)
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const getOrderFolio = (o) => String(o.folio || o.numero_orden || o.numeroOrden || o.noOrden || o.id || '').trim();

  // 2. Coincidencia directa por ordenId, orden_id, ordenFolio en órdenes REALES
  if (t.ordenId || t.orden_id) {
    const targetId = t.ordenId || t.orden_id;
    const found = allOrds.find(o => o && (o.id === targetId || o.folio === targetId || norm(getOrderFolio(o)) === norm(targetId)));
    if (found) return found;
  }
  if (t.ordenFolio) {
    const found = allOrds.find(o => o && (norm(getOrderFolio(o)) === norm(t.ordenFolio) || getOrderFolio(o).includes(t.ordenFolio)));
    if (found) return found;
  }

  // 3. Coincidencia por soporte en la orden (orden.soporte === t.id o t.folio)
  if (t.id) {
    const found = allOrds.find(o => o && (o.soporte === t.id || norm(o.soporte) === norm(t.id)));
    if (found) return found;
  }
  if (t.folio) {
    const found = allOrds.find(o => o && (o.soporte === t.folio || norm(o.soporte) === norm(t.folio)));
    if (found) return found;
  }

  // 4. Extracción de número de ticket/OS base (ej. TKT-OS-26248-A -> número 26248, buscando orden con soporte TKT-26248)
  const tFolio = String(t.folio || '').trim();
  const numMatch = tFolio.match(/\d{4,6}/) || (t.asunto ? String(t.asunto).match(/\d{4,6}/) : null);
  const ticketNumber = numMatch ? numMatch[0] : '';

  if (ticketNumber) {
    // A) Buscar orden que tenga en soporte este folio de ticket (ej: orden OS-26145 con soporte TKT-26248)
    const foundBySoporteNum = allOrds.find(o => {
      if (!o || !o.soporte) return false;
      const sopNorm = norm(o.soporte);
      const sopNum = String(o.soporte).replace(/[^0-9]/g, '');
      return sopNum === ticketNumber || sopNorm === ('TKT' + ticketNumber) || sopNorm === ticketNumber;
    });
    if (foundBySoporteNum) return foundBySoporteNum;

    // B) Buscar el ticket padre en la lista de tickets y ver si alguna orden apunta a ese ticket padre
    const parentTicket = allTkts.find(x => {
      if (!x) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      return (xFol === `TKT-${ticketNumber}` || xFol === ticketNumber || xNum === ticketNumber) && x.id !== t.id;
    });
    if (parentTicket) {
      const foundByParent = allOrds.find(o => o && (o.soporte === parentTicket.id || o.soporte === parentTicket.folio || norm(o.soporte) === norm(parentTicket.folio)));
      if (foundByParent) return foundByParent;
    }

    // C) Buscar si el número de ticket coincide con el número de la orden REAL
    const foundByOrdNum = allOrds.find(o => {
      if (!o) return false;
      const oFol = getOrderFolio(o);
      const oNum = oFol.replace(/[^0-9]/g, '');
      return oNum === ticketNumber;
    });
    if (foundByOrdNum) return foundByOrdNum;
  }

  // 5. Coincidencia por folios limpios en órdenes REALES
  if (tFolio) {
    let cleanBase = tFolio.replace(/-[Aa]$/i, '').trim();
    if (cleanBase.startsWith('[PRUEBA] ')) cleanBase = cleanBase.replace('[PRUEBA] ', '').trim();
    if (cleanBase.startsWith('[TEST] ')) cleanBase = cleanBase.replace('[TEST] ', '').trim();
    if (cleanBase.startsWith('TKT-')) cleanBase = cleanBase.replace('TKT-', '').trim();
    const normBase = norm(cleanBase);

    const foundDirect = allOrds.find(o => {
      if (!o) return false;
      const oFol = getOrderFolio(o);
      const oNorm = norm(oFol);
      return oNorm === normBase || o.id === cleanBase;
    });
    if (foundDirect) return foundDirect;
  }

  // 6. Búsqueda por patrón OS-XXXXX en Asunto, Folio o Descripción que coincida con una orden REAL
  const fullText = `${tFolio} ${t.asunto || ''} ${t.descripcion || ''}`;
  const osMatches = fullText.match(/(?:OS|ORD)[-\s]?\d{3,7}/gi);
  if (osMatches && osMatches.length > 0) {
    for (const matchStr of osMatches) {
      const normMatch = norm(matchStr);
      const numOnly = matchStr.replace(/[^0-9]/g, '');

      const found = allOrds.find(o => {
        if (!o) return false;
        const oFol = getOrderFolio(o);
        const oNorm = norm(oFol);
        const oNum = oFol.replace(/[^0-9]/g, '');
        return oNorm === normMatch || (numOnly.length >= 4 && oNum === numOnly);
      });
      if (found) return found;
    }
  }

  // IMPORTANTE: Si la orden NO existe en la base de datos de órdenes, devolvemos null (no inventar órdenes sintéticas)
  return null;
};

// Alias para compatibilidad histórica en vistas de refacciones
window.obtenerOrdenAsociadaATicketRefacciones = window.obtenerOrdenAsociadaTicket;

window.verOrdenDesdeTicket = function(ordenId) {
  if (!ordenId) return;
  const overlayDetalle = document.getElementById('modal-ticket-detalle-overlay');
  if (overlayDetalle) overlayDetalle.classList.remove('open');
  const overlayEdit = document.getElementById('modal-ticket-overlay');
  if (overlayEdit) overlayEdit.classList.remove('open');
  document.body.style.overflow = '';
  
  // Buscar en el pool de órdenes si existe el objeto orden
  let pool = [];
  if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) pool = pool.concat(ordenes);
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) pool = pool.concat(window.ordenes);
  try {
    const local = (typeof safeGetJSON === 'function') 
      ? safeGetJSON('sapi_ordenes', []) 
      : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    if (Array.isArray(local)) pool = pool.concat(local);
  } catch (e) {}

  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const targetNorm = norm(ordenId);
  const targetNum = String(ordenId).replace(/[^0-9]/g, '');

  const foundOrder = pool.find(o => {
    if (!o) return false;
    const oFol = String(o.folio || o.numero_orden || o.numeroOrden || o.noOrden || o.id || '').trim();
    const oNorm = norm(oFol);
    const oNum = oFol.replace(/[^0-9]/g, '');
    return o.id === ordenId || oFol === ordenId || oNorm === targetNorm || (targetNum.length >= 4 && oNum === targetNum);
  });

  if (foundOrder && typeof verDetalle === 'function') {
    verDetalle(foundOrder.id || foundOrder.folio);
  } else {
    // Si no está en memoria, navegar a la pestaña de Órdenes de Servicio y filtrar por el folio
    const navServicios = document.querySelector('.nav-item[data-view="servicios"]');
    if (navServicios) navServicios.click();
    setTimeout(() => {
      const searchInput = document.getElementById('search-servicios');
      if (searchInput) {
        searchInput.value = ordenId;
        if (typeof filtrarOrdenes === 'function') {
          filtrarOrdenes('servicios');
        }
      }
    }, 150);
  }
};

// ===== ASOCIACIÓN TICKET HIJO -> TICKET PADRE / ORIGEN =====
window.obtenerTicketPadre = function(t) {
  if (!t || typeof t !== 'object') return null;

  // Solo los tickets con -A (subtickets de refacciones) o derivados tienen ticket padre
  if (typeof window.esTicketHijoRefacciones === 'function' && !window.esTicketHijoRefacciones(t)) {
    return null;
  }

  const tFolio = String(t.folio || '').trim();

  // Usar pool en memoria prioritariamente
  let allTkts = (typeof tickets !== 'undefined' && Array.isArray(tickets) && tickets.length > 0)
    ? tickets
    : ((typeof window !== 'undefined' && Array.isArray(window.tickets) && window.tickets.length > 0)
      ? window.tickets
      : null);

  if (!allTkts) {
    try {
      allTkts = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
    } catch (e) {
      allTkts = [];
    }
  }

  if (!allTkts || allTkts.length === 0) return null;
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Coincidencia directa por id/folio de padre
  if (t.parentTicketId || t.ticketPadreId || t.ticket_padre_id) {
    const pId = t.parentTicketId || t.ticketPadreId || t.ticket_padre_id;
    const found = allTkts.find(x => x && (x.id === pId || x.folio === pId || norm(x.folio) === norm(pId)) && x.id !== t.id);
    if (found) return found;
  }

  // 2. Búsqueda por mención explícita en Asunto o Descripción (ej: "Refacciones para TKT-26140" o "Ticket Padre TKT-26140")
  const fullText = `${t.asunto || ''} ${t.descripcion || ''}`;
  const explicitMatch = fullText.match(/(?:ticket\s*padre|refacciones\s*para|derivado\s*del\s*ticket\s*padre|derivado\s*del\s*ticket|origen)\s*(?:TKT-)?(\d{4,6})/i);
  if (explicitMatch && explicitMatch[1]) {
    const targetNum = explicitMatch[1];
    const found = allTkts.find(x => {
      if (!x || x.id === t.id) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      const xNorm = norm(xFol);
      return xFol === `TKT-${targetNum}` || xFol === `TKT-OS-${targetNum}` || xFol === targetNum || xNum === targetNum || xNorm === ('TKT' + targetNum);
    });
    if (found) return found;
  }

  // 3. Extracción de folio limpio quitando -A, TKT-, etc.
  let cleanBase = tFolio.replace(/-[Aa]$/i, '').trim();
  if (cleanBase.startsWith('[PRUEBA] ')) cleanBase = cleanBase.replace('[PRUEBA] ', '').trim();
  if (cleanBase.startsWith('[TEST] ')) cleanBase = cleanBase.replace('[TEST] ', '').trim();
  
  // Extraer número de ticket (ej. 26249 de TKT-OS-26249-A o de TKT-26249-A)
  const numMatch = cleanBase.match(/\d{4,6}/) || (t.asunto ? String(t.asunto).match(/\d{4,6}/) : null);
  const ticketNum = numMatch ? numMatch[0] : '';

  if (ticketNum && ticketNum !== tFolio.replace(/[^0-9]/g, '')) {
    // Buscar en lista de tickets si existe TKT-26249, 26249 o TKT-OS-26249 (sin -A)
    const found = allTkts.find(x => {
      if (!x || x.id === t.id) return false;
      const xFol = String(x.folio || '').trim();
      const xNum = xFol.replace(/[^0-9]/g, '');
      const xNorm = norm(xFol);
      return xFol === `TKT-${ticketNum}` || xFol === `TKT-OS-${ticketNum}` || xFol === ticketNum || xNum === ticketNum || xNorm === ('TKT' + ticketNum);
    });
    if (found) return found;
  }

  // 4. Buscar por cleanBase
  if (cleanBase && cleanBase !== tFolio) {
    const normBase = norm(cleanBase);
    const found = allTkts.find(x => x && x.id !== t.id && (norm(x.folio) === normBase || x.id === cleanBase));
    if (found) return found;
  }

  // 5. Fallback: número identificable de ticket padre
  const fallbackNum = (explicitMatch && explicitMatch[1]) ? explicitMatch[1] : ticketNum;
  if (fallbackNum) {
    const parentFolio = `TKT-${fallbackNum}`;
    if (parentFolio !== tFolio && norm(parentFolio) !== norm(tFolio)) {
      return {
        id: parentFolio,
        folio: parentFolio,
        asunto: `Ticket Origen ${parentFolio}`,
        isSynthetic: true
      };
    }
  }

  return null;
};

// ===== RESOLUCIÓN EXHAUSTIVA DE CLIENTE PARA TICKETS =====
window.resolverClienteTicket = function(t, depth = 0) {
  if (!t || typeof t !== 'object') return '';
  if (depth > 2) return t.cliente || '';

  const allClients = (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0)
    ? clientesDb
    : (() => {
        try {
          return JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
        } catch(e) { return []; }
      })();

  const isBlankCli = (val) => {
    if (!val) return true;
    const str = String(val).toLowerCase().trim();
    return !str || str === 'sin cliente' || str === 'ninguno' || str === 'ninguno / uso interno' || str === 'genérico' || str === 'generico' || str === 'sin_cliente' || str === '-';
  };

  // 1. Si ya tiene t.cliente válido y no en blanco
  if (!isBlankCli(t.cliente)) {
    const rawVal = String(t.cliente).trim();
    const matchedById = allClients.find(c => 
      (c.id && String(c.id).toLowerCase().trim() === rawVal.toLowerCase()) ||
      (c.idInterno && String(c.idInterno).toLowerCase().trim() === rawVal.toLowerCase()) ||
      (c.rfc && String(c.rfc).toLowerCase().trim() === rawVal.toLowerCase())
    );
    if (matchedById && matchedById.nombre) {
      return matchedById.nombre;
    }
    const matchedByName = allClients.find(c => c.nombre && String(c.nombre).toLowerCase().trim() === rawVal.toLowerCase());
    if (matchedByName) return matchedByName.nombre;
    return rawVal;
  }

  // 2. Resolver desde Ticket Padre
  const parent = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
  if (parent && parent.id !== t.id && !isBlankCli(parent.cliente)) {
    const pCli = window.resolverClienteTicket(parent, depth + 1);
    if (pCli) return pCli;
  }

  // 3. Resolver desde Orden de Servicio Asociada
  const assocOrder = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
  if (assocOrder && !isBlankCli(assocOrder.cliente)) {
    const rawOrdCli = String(assocOrder.cliente).trim();
    const matched = allClients.find(c => 
      (c.id && String(c.id).toLowerCase().trim() === rawOrdCli.toLowerCase()) ||
      (c.nombre && String(c.nombre).toLowerCase().trim() === rawOrdCli.toLowerCase())
    );
    return matched ? matched.nombre : rawOrdCli;
  }

  // 4. Resolver desde Máquina / Equipo (t.equipo)
  const eqStr = String(t.equipo || '').trim();
  if (eqStr && eqStr !== 'Otra / No registrada' && eqStr !== '—' && eqStr !== '-') {
    let maquinasPool = (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb) && maquinariaDb.length > 0)
      ? maquinariaDb
      : (() => {
          try {
            return JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
          } catch(e) { return []; }
        })();

    const eqLower = eqStr.toLowerCase();
    for (const m of maquinasPool) {
      if (!m) continue;
      const mSerie = m.serie ? String(m.serie).toLowerCase().trim() : '';
      const mIdInt = m.idInterno ? String(m.idInterno).toLowerCase().trim() : '';
      const mId = m.id ? String(m.id).toLowerCase().trim() : '';
      
      let matches = false;
      if (mSerie && mSerie.length >= 3 && eqLower.includes(mSerie)) matches = true;
      if (mIdInt && mIdInt.length >= 3 && eqLower.includes(mIdInt)) matches = true;
      if (mId && eqLower.includes(mId)) matches = true;

      if (matches && m.cliente) {
        const cliMatch = allClients.find(c => 
          (c.id && String(c.id).toLowerCase().trim() === String(m.cliente).toLowerCase().trim()) ||
          (c.nombre && String(c.nombre).toLowerCase().trim() === String(m.cliente).toLowerCase().trim())
        );
        return cliMatch ? cliMatch.nombre : m.cliente;
      }
    }

    for (const c of allClients) {
      if (c && Array.isArray(c.maquinas)) {
        for (const m of c.maquinas) {
          const mSerie = m.serie ? String(m.serie).toLowerCase().trim() : '';
          const mIdInt = m.idInterno ? String(m.idInterno).toLowerCase().trim() : '';
          if ((mSerie && mSerie.length >= 3 && eqLower.includes(mSerie)) || (mIdInt && mIdInt.length >= 3 && eqLower.includes(mIdInt))) {
            return c.nombre;
          }
        }
      }
    }
  }

  // 5. Resolver desde Sitio / Ubicación (t.sitio)
  const sitStr = String(t.sitio || '').trim();
  if (sitStr && sitStr !== 'Ninguno' && sitStr !== '—' && sitStr !== '-') {
    let sitiosPool = [];
    if (typeof sitiosDb !== 'undefined' && Array.isArray(sitiosDb)) sitiosPool = sitiosPool.concat(sitiosDb);
    try {
      const localS = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
      if (Array.isArray(localS)) sitiosPool = sitiosPool.concat(localS);
    } catch(e) {}

    const sitLower = sitStr.toLowerCase();
    const matchedSitio = sitiosPool.find(s => 
      s && (
        (s.id && String(s.id).toLowerCase() === sitLower) ||
        (s.nombre && String(s.nombre).toLowerCase() === sitLower) ||
        (s.direccion && String(s.direccion).toLowerCase() === sitLower)
      )
    );
    if (matchedSitio && matchedSitio.cliente) {
      const cliMatch = allClients.find(c => 
        (c.id && String(c.id).toLowerCase().trim() === String(matchedSitio.cliente).toLowerCase().trim()) ||
        (c.nombre && String(c.nombre).toLowerCase().trim() === String(matchedSitio.cliente).toLowerCase().trim())
      );
      return cliMatch ? cliMatch.nombre : matchedSitio.cliente;
    }
  }

  // 6. Resolver desde Cotizaciones / Pedidos SAP
  const sapVal = String(t.cotizacionSAP || t.pedidoSAP || '').trim();
  if (sapVal) {
    let quotes = window._cacheCotizacionesSap || [];
    const qMatch = quotes.find(q => q && (q.numero_cotizacion === sapVal || q.numero_pedido === sapVal));
    if (qMatch && qMatch.cliente) {
      return qMatch.cliente;
    }
  }

  // 7. Resolver desde Solicitante o Contacto
  const solStr = String(t.solicitante || '').trim().toLowerCase();
  if (solStr) {
    const cliBySol = allClients.find(c => c.nombre && c.nombre.toLowerCase().trim() === solStr);
    if (cliBySol) return cliBySol.nombre;

    let usersPool = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : [];
    const uMatch = usersPool.find(u => u && u.nombre && u.nombre.toLowerCase().trim() === solStr && u.empresa);
    if (uMatch) return uMatch.empresa;
  }

  // 8. Buscar mención directa de cliente en Asunto / Descripción / Notas
  const fullText = `${t.asunto || ''} ${t.descripcion || ''} ${t.notas || ''}`.toLowerCase();
  for (const c of allClients) {
    if (c && c.nombre && c.nombre.length >= 4) {
      const cNorm = c.nombre.toLowerCase().trim();
      if (fullText.includes(cNorm)) {
        return c.nombre;
      }
    }
  }

  return '';
};

// ===== RENDER TICKETS =====
function renderTickets(ctx) {
  const isDashView = ctx === 'dash-tickets';
  const isV2 = ctx === 'v2';
  const bodyId = isDashView ? 'tabla-body-dash-tickets' : (isV2 ? 'v2-tickets-body' : 'tickets-body');
  
  try {
    try { actualizarFiltrosPersonal(); } catch (e) {}
    if (window.updateNotificationBell) {
      try { window.updateNotificationBell(); } catch (e) {}
    }
    const searchId = isDashView ? 'search-dash-tickets' : (isV2 ? 'v2-search-tickets' : 'search-tickets');
    
    const body = document.getElementById(bodyId);
    if (!body) return;
    const q = (document.getElementById(searchId)?.value || '').toLowerCase();
    
    let filtered = getFilteredTickets().filter(t =>
      t && t.categoria !== 'Soporte General' && (
        !q ||
        String(t.asunto||'').toLowerCase().includes(q) ||
        String(t.categoria||'').toLowerCase().includes(q) ||
        String(t.tipo||'').toLowerCase().includes(q) ||
        String(t.solicitante||'').toLowerCase().includes(q) ||
        String(t.cliente||'').toLowerCase().includes(q) ||
        String(t.asignado||'').toLowerCase().includes(q) ||
        String(t.folio||'').toLowerCase().includes(q) ||
        String(t.cotizacionSAP||'').toLowerCase().includes(q) ||
        String(t.pedidoSAP||'').toLowerCase().includes(q) ||
        (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.some(c => c && (String(c.texto||'').toLowerCase().includes(q) || String(c.usuario||'').toLowerCase().includes(q))))
      )
    );
    

    
    // Ordenar dinámicamente según la columna seleccionada
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      let valA, valB;
      switch(ticketSortColumn) {
        case 'folio':
          valA = String(a.folio || '');
          valB = String(b.folio || '');
          return ticketSortDirection === 'asc'
            ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        case 'asunto':
          valA = String(a.asunto || '').toLowerCase();
          valB = String(b.asunto || '').toLowerCase();
          break;
        case 'solicitante':
          valA = String(a.solicitante || '').toLowerCase();
          valB = String(b.solicitante || '').toLowerCase();
          break;
        case 'categoria':
        case 'tipo':
          valA = String(a.categoria || a.tipo || '').toLowerCase();
          valB = String(b.categoria || b.tipo || '').toLowerCase();
          break;
        case 'area':
          valA = String(a.area || '').toLowerCase();
          valB = String(b.area || '').toLowerCase();
          break;
        case 'prioridad':
          const prioMap = { 'alta': 3, 'media': 2, 'baja': 1 };
          valA = prioMap[String(a.prioridad || '').toLowerCase()] || 0;
          valB = prioMap[String(b.prioridad || '').toLowerCase()] || 0;
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'estado':
          valA = String(a.estado || '').toLowerCase();
          valB = String(b.estado || '').toLowerCase();
          break;
        case 'comentario':
          const getCommentTime = (tkt) => {
            if (!tkt || !tkt.comentariosInternos || !tkt.comentariosInternos.length) return 0;
            const last = tkt.comentariosInternos[tkt.comentariosInternos.length - 1];
            return last && last.fecha ? new Date(last.fecha).getTime() : 0;
          };
          valA = getCommentTime(a);
          valB = getCommentTime(b);
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'cotizacion':
          valA = String(a.cotizacionSAP || '').toLowerCase();
          valB = String(b.cotizacionSAP || '').toLowerCase();
          break;
        case 'monto':
          valA = Number(a.montoCotizacion || 0);
          valB = Number(b.montoCotizacion || 0);
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'pedido':
          valA = String(a.pedidoSAP || '').toLowerCase();
          valB = String(b.pedidoSAP || '').toLowerCase();
          break;
        case 'asignado':
          valA = String(a.asignado || '').toLowerCase();
          valB = String(b.asignado || '').toLowerCase();
          break;
        case 'fecha':
          valA = new Date(a.fechaCreacion || a.fecha || 0).getTime();
          valB = new Date(b.fechaCreacion || b.fecha || 0).getTime();
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        case 'fecha-modificacion':
        case 'fecha-mod':
          valA = new Date(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(a) : (a.fechaModificacion || a.fechaCreacion || a.fecha || 0)).getTime();
          valB = new Date(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(b) : (b.fechaModificacion || b.fechaCreacion || b.fecha || 0)).getTime();
          return ticketSortDirection === 'asc' ? valA - valB : valB - valA;
        default:
          valA = String(a.folio || '');
          valB = String(b.folio || '');
          return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (valA < valB) return ticketSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return ticketSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
    const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
    let tecFilter = '';
    let supFilter = '';
    let tipoFilter = '';
    if (!isEmpresa) {
      tipoFilter = document.getElementById(isDashView ? 'filter-dash-tkt-tipo' : 'filter-tkt-tipo')?.value || '';
      tecFilter = document.getElementById(isDashView ? 'filter-dash-tkt-tecnico' : 'filter-tkt-tecnico')?.value || '';
      supFilter = document.getElementById(isDashView ? 'filter-dash-tkt-supervisor' : 'filter-tkt-supervisor')?.value || '';
    } else {
      tipoFilter = document.getElementById('filter-tkt-tipo')?.value || '';
    }
  
    if (isEmpresa) {
      let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
      if (nombreEmpresaLogged) {
        nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
        filtered = filtered.filter(t => {
          if (!t) return false;
          const tcli = String(t.cliente || '').toLowerCase().trim();
          const tsol = String(t.solicitante || '').toLowerCase().trim();
          return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
        });
      } else {
        filtered = [];
      }
    }
  
    const userRole = currentSession.viewMode || '';
    if (userRole === 'tecnico') {
      if (isTestModeActive()) {
        tecFilter = '';
      } else {
        tecFilter = currentUser ? currentUser.nombre : '';
      }
    }
    if (userRole === 'supervisor') {
      supFilter = document.getElementById(isDashView ? 'filter-dash-tkt-supervisor' : 'filter-tkt-supervisor')?.value || '';
    }

    if (tipoFilter) {
      const tipoNorm = window.normStr ? window.normStr(tipoFilter) : tipoFilter.toLowerCase().trim();
      filtered = filtered.filter(t => {
        if (!t) return false;
        const cat = String(t.categoria || t.tipo || '');
        const catNorm = window.normStr ? window.normStr(cat) : cat.toLowerCase().trim();
        if (tipoNorm === 'otro') {
          return catNorm === 'otro' || !catNorm;
        }
        return catNorm === tipoNorm;
      });
    }

    if (window.ticketAntiguedadRango) {
      const nowTime = new Date().getTime();
      const msPerDay = 1000 * 60 * 60 * 24;
      const modo = window.ticketAntiguedadModo || 'mod';
      const rango = window.ticketAntiguedadRango;
      
      filtered = filtered.filter(t => {
        if (!t) return false;
        
        let targetDateStr = null;
        if (modo === 'mod') {
          targetDateStr = window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha);
        } else {
          targetDateStr = t.fechaCreacion || t.fecha;
        }
        
        if (!targetDateStr) return false;
        const targetTime = new Date(targetDateStr).getTime();
        if (isNaN(targetTime)) return false;
        
        const diffDays = (nowTime - targetTime) / msPerDay;
        
        if (rango === '1_7') {
          return diffDays <= 7;
        } else if (rango === '8_15') {
          return diffDays > 7 && diffDays <= 15;
        } else if (rango === 'gt_15') {
          return diffDays > 15;
        }
        return true;
      });
    }
    
    if (tecFilter || supFilter) {
      const tecNameLower = tecFilter ? window.normStr(tecFilter) : '';
      const supNameLower = supFilter ? window.normStr(supFilter) : '';
      
      filtered = filtered.filter(t => {
        if (!t) return false;
        let passTec = true;
        let passSup = true;
        
        if (tecFilter && tecNameLower) {
           let assigned = [];
           if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
           else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => window.normStr(s));
           passTec = assignedLower.includes(tecNameLower) || 
                     (t.solicitante && window.normStr(t.solicitante) === tecNameLower) || 
                     (t.creadoPor && window.normStr(t.creadoPor) === tecNameLower);
        }
        
        if (supFilter && supNameLower) {
           let passSupClient = false;
           const cli = clientesDb.find(c => c && c.nombre === t.cliente);
           if (cli) {
              const supUser = usuarios.find(u => u && ((u.nombre && window.normStr(u.nombre) === supNameLower) || u.id === supFilter));
              const supId = supUser ? supUser.id : supFilter;
              passSupClient = (cli.supervisoresAsignados && Array.isArray(cli.supervisoresAsignados) && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (window.normStr(cli.supervisorAsignado) === supNameLower) || (cli.supervisorAsignado === supFilter);
           }
           
           let assigned = [];
           if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados.map(resolveTecnicoNombre);
           else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
           const assignedLower = assigned.map(s => window.normStr(s));
           
           let passSupTicket = assignedLower.includes(supNameLower) || 
                               (t.solicitante && window.normStr(t.solicitante) === supNameLower) || 
                               (t.creadoPor && window.normStr(t.creadoPor) === supNameLower);
           
           passSup = passSupClient || passSupTicket;
        }
        
        return passTec && passSup;
      });
    }
    
    if (!isDashView && !isV2 && ticketFiltroActivo !== 'todos') {
      if (ticketFiltroActivo === 'Cerrado - Aprobado') {
        filtered = filtered.filter(t => t && t.estado === 'Cerrado' && t.cotAceptada === 'si');
      } else if (ticketFiltroActivo === 'Cerrado - Rechazado') {
        filtered = filtered.filter(t => t && t.estado === 'Cerrado' && t.cotAceptada === 'no');
      } else {
        filtered = filtered.filter(t => t && t.estado === ticketFiltroActivo);
      }
    }
    if (isV2 && filtroTicketsV2 !== 'todos') {
      filtered = filtered.filter(t => t && (t.estado || '').toLowerCase() === filtroTicketsV2.toLowerCase());
    }
    
    if (isDashView && !q) {
      filtered = filtered.slice(0, 8);
    }
    
    // Actualizar contador de tickets filtrados y título de página
    const countEl = document.getElementById('tkt-filtered-count');
    if (countEl && !isDashView && !isV2) {
      countEl.textContent = `${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`;
    }
    const viewTicketsEl = document.getElementById('view-tickets');
    if (viewTicketsEl && viewTicketsEl.classList.contains('active') && !isDashView && !isV2) {
      const pageTitleEl = document.getElementById('page-title');
      if (pageTitleEl) {
        pageTitleEl.textContent = `Tickets (${filtered.length})`;
      }
    }
    
    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="14" class="empty-state">No hay tickets${q||(!isDashView && ticketFiltroActivo!=='todos')?' que coincidan':' registrados'}.</td></tr>`;
      return;
    }
    const canEdit = currentSession.viewMode !== 'consulta';
    const canDelete = ['superadmin', 'admin'].includes(currentSession.viewMode);
    const isSuperadmin = (typeof currentSession !== 'undefined' && currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));

    body.innerHTML = filtered.map((t, i) => {
      if (!t) return '';
      const latestComment = (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0)
      let comentarioHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>';
      if (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
        const ult = t.comentariosInternos[t.comentariosInternos.length - 1];
        const rawText = String(ult.texto || '').replace(/\s+/g, ' ').trim();
        const safeText = escapeHTML(rawText);
        const safeUser = escapeHTML(ult.usuario || '');
        const fechaStr = ult.fecha ? formatFechaAmigable(ult.fecha) : '';
        const tooltip = `${safeUser}${fechaStr ? ' (' + fechaStr + ')' : ''}: ${safeText}`;
        
        comentarioHtml = `
          <div style="font-weight: 500; font-size: 0.8rem; color: var(--text-primary); line-height: 1.35; min-width: 210px; max-width: 310px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tooltip}">
            ${safeText || '—'}
          </div>
          ${(safeUser || fechaStr) ? `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 0.2rem; min-width: 210px; max-width: 310px; font-size: 0.72rem;" title="${tooltip}">
              <span style="color: var(--accent); font-weight: 600; min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="message-square" style="width:11px;height:11px;flex-shrink:0;"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeUser || 'Staff'}</span>
              </span>
              ${fechaStr ? `<span style="flex-shrink: 0; white-space: nowrap; color: var(--text-muted); font-size: 0.72rem; font-weight: 500;">• ${fechaStr}</span>` : ''}
            </div>
          ` : ''}
        `;
      }

      const assocOrder = window.obtenerOrdenAsociadaTicket(t);
      const parentTicket = !assocOrder ? (typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null) : null;

      return `
      <tr style="cursor:pointer; transition: background 0.2s;" onclick="if(!event.target.closest('.action-btn, .os-link-btn, .parent-tkt-btn')){ verDetalleTicket('${t.id}'); }" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <td data-label="Acciones" style="white-space:nowrap; width:60px;">
          <div style="display:flex;gap:0.25rem; align-items:center;">
            <button class="action-btn" onclick="verDetalleTicket('${t.id}')" title="Ver Ticket"><i data-lucide="eye"></i></button>
            ${canEdit ? `<button class="action-btn" onclick="editarTicket('${t.id}')" title="Editar Ticket"><i data-lucide="pencil"></i></button>` : ''}
            ${assocOrder ? `<button class="action-btn os-link-btn" onclick="event.stopPropagation(); window.verOrdenDesdeTicket('${assocOrder.id}')" title="Ver Orden de Servicio ${assocOrder.folio || ''}" style="color: #2563eb; background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.25);"><i data-lucide="file-text"></i></button>` : (parentTicket ? `<button class="action-btn parent-tkt-btn" onclick="event.stopPropagation(); verDetalleTicket('${parentTicket.id}')" title="Ver Ticket Origen ${parentTicket.folio || ''}" style="color: #ea580c; background: rgba(234,88,12,0.08); border-color: rgba(234,88,12,0.25);"><i data-lucide="ticket"></i></button>` : (isSuperadmin ? `<button class="action-btn" onclick="event.stopPropagation(); window.forzarCrearOrdenServicio('${t.id}')" title="Forzar Orden de Servicio (Superadmin)" style="color: #2563eb; background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.25);"><i data-lucide="file-plus"></i></button>` : ''))}
          </div>
        </td>
        <td data-label="Folio" style="white-space: nowrap;">
          <div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start;">
            <strong>${t.folio||('#'+(i+1))}</strong>
            ${assocOrder ? `
              <button type="button" class="os-link-btn" onclick="event.stopPropagation(); window.verOrdenDesdeTicket('${assocOrder.id}')" style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 600; color: #2563eb; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); padding: 1px 5px; border-radius: 4px; cursor: pointer; text-decoration: none;" title="Abrir Orden de Servicio ${assocOrder.folio || assocOrder.id}">
                <i data-lucide="file-text" style="width: 10px; height: 10px;"></i>
                <span>${assocOrder.folio || 'Ver OS'}</span>
                <i data-lucide="external-link" style="width: 9px; height: 9px;"></i>
              </button>
            ` : (parentTicket ? `
              <button type="button" class="os-link-btn parent-tkt-btn" onclick="event.stopPropagation(); verDetalleTicket('${parentTicket.id}')" style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 600; color: #ea580c; background: rgba(234, 88, 12, 0.08); border: 1px solid rgba(234, 88, 12, 0.25); padding: 1px 5px; border-radius: 4px; cursor: pointer; text-decoration: none;" title="Abrir Ticket Origen ${parentTicket.folio || parentTicket.id}">
                <i data-lucide="ticket" style="width: 10px; height: 10px;"></i>
                <span>${parentTicket.folio || parentTicket.id}</span>
                <i data-lucide="external-link" style="width: 9px; height: 9px;"></i>
              </button>
            ` : '')}
          </div>
        </td>
        <td data-label="Asunto">
          <div style="min-width: 160px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.asunto || ''}">
            ${t.asunto||'—'}
          </div>
          ${t.categoria ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;"><span class="badge" style="background:var(--bg-hover); color:var(--text-secondary); font-size:0.68rem; padding:0.1rem 0.35rem; border:1px solid var(--border);">${t.categoria}</span></div>` : ''}
        </td>
        <td data-label="Solicitante">
          <div style="font-weight:500; min-width: 150px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.solicitante || ''}">${t.solicitante||'—'}</div>
          ${(() => {
            const resolvedCli = (typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '') || t.cliente || (parentTicket && parentTicket.cliente) || (assocOrder && assocOrder.cliente) || '';
            const resolvedSit = t.sitio || (parentTicket && parentTicket.sitio) || (assocOrder && (assocOrder.ubicacion || assocOrder.ubicacion_sitio)) || '';
            if (!resolvedCli) return '';
            return `
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; min-width: 150px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${resolvedCli}${resolvedSit ? ` - ${resolvedSit}` : ''}">
                <i data-lucide="building-2" style="width:10px;height:10px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${resolvedCli}${resolvedSit ? ` - ${resolvedSit}` : ''}
              </div>`;
          })()}
        </td>
        <td data-label="Área" style="white-space:nowrap;">${t.area||'—'}</td>
        <td data-label="Prioridad" class="col-prioridad" style="white-space:nowrap; display: ${isEmpresa ? 'none' : ''};"><span class="badge badge-${String(t.prioridad||'media').toLowerCase()}">${t.prioridad||'—'}</span></td>
        <td data-label="Estado" style="white-space:nowrap;"><span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span></td>
        <td data-label="Último Comentario" class="col-comentario-interno" style="display: ${isEmpresa ? 'none' : ''};">
          ${comentarioHtml}
        </td>
        <td data-label="Cotización SAP" style="white-space:nowrap; font-family: monospace;">${t.cotizacionSAP||'—'}</td>
        <td data-label="Monto" style="white-space:nowrap; font-weight: 600;">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</td>
        <td data-label="Pedido SAP" style="white-space:nowrap; font-family: monospace;">${t.pedidoSAP||'—'}</td>
        <td data-label="Asignado" class="col-asignado" style="white-space:nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis; display: ${isEmpresa ? 'none' : ''};" title="${t.asignado || parentTicket?.asignado || assocOrder?.tecnico || ''}">${t.asignado || parentTicket?.asignado || assocOrder?.tecnico || '—'}</td>
        <td data-label="Fecha Creación" style="white-space:nowrap;">${formatFechaHoraAmigable(t.fechaCreacion || t.fecha)}</td>
        <td data-label="Última Modif." style="white-space:nowrap;">
          <div style="font-size:0.8rem; color:var(--text-secondary);">${formatFechaHoraAmigable(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha))}</div>
          <div style="font-size:0.72rem; color:var(--accent); font-weight:500; overflow:hidden; text-overflow:ellipsis; max-width:135px; display:flex; align-items:center; gap:3px; margin-top:2px;" title="Modificado por ${window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || '—')}">
            <i data-lucide="user" style="width:11px;height:11px;flex-shrink:0;"></i>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || '—')}</span>
          </div>
        </td>
        <td data-label="" style="width:40px; text-align:center;">
          ${canDelete ? `<button class="action-btn del" onclick="eliminarTicket('${t.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
        </td>
      </tr>
      `;
    }).join('');
    
    try { actualizarCabeceraOrdenacion(); } catch (e) {}
    try { if (typeof window.actualizarBadgeDepuradorTickets === 'function') window.actualizarBadgeDepuradorTickets(); } catch (e) {}
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Error in renderTickets:", error);
    const body = document.getElementById(bodyId);
    if (body) {
      body.innerHTML = `<tr><td colspan="15" class="error-state" style="color:#ef4444; font-weight:600; padding:20px; text-align:center; background:rgba(239,68,68,0.05);">Falla al renderizar tickets: ${error.message}</td></tr>`;
    }
  }
}

window.esTicketEnTransito = function(t) {
  if (!t || typeof t !== 'object') return false;
  const envios = t.envios || [];
  if (envios.length > 0) {
    const anyInTransit = envios.some(env => env.parts && env.parts.length > 0 && !env.llego);
    if (anyInTransit) return true;
  }
  const parts = t.refaccionesSeleccionadas || [];
  if (parts.length > 0) {
    return parts.some(p => p.estatusPedido === 'En Tránsito / Pedido');
  }
  return false;
};

function badgeTicketEstado(tOrEstado) {
  const estado = typeof tOrEstado === 'object' ? tOrEstado.estado : tOrEstado;
  if (typeof tOrEstado === 'object') {
    if (tOrEstado.estado === 'Cerrado') {
      return tOrEstado.cotAceptada === 'si' ? 'cerrado-aprobado' : 'cerrado-rechazado';
    }
    if (tOrEstado.estado === 'Cotización') {
      if (tOrEstado.cotAceptada === 'no' || tOrEstado.cotAceptada === 'rechazada') {
        return 'cerrado-rechazado';
      }
      if (tOrEstado.cotAceptada === 'si' || tOrEstado.cotAceptada === 'aprobada') {
        return 'cerrado-aprobado';
      }
    }
  }
  const map = { 'Abierto':'abierto', 'Cotización':'en-proceso', 'Refacciones':'refacciones', 'Cerrado':'cerrado' };
  return map[estado] || 'abierto';
}

function getTicketEstadoLabel(t) {
  if (!t) return '—';
  if (t.estado === 'Cerrado') {
    return t.cotAceptada === 'si' ? 'Aceptado' : (t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'Rechazado' : 'Aceptado');
  }
  if (t.estado === 'Cotización') {
    if (t.cotAceptada === 'si' || t.cotAceptada === 'aprobada') return 'Cotización (Aprobada)';
    if (t.cotAceptada === 'no' || t.cotAceptada === 'rechazada') return 'Cotización (Rechazada)';
  }
  return t.estado || 'Abierto';
}

// =========================================================================
// MÓDULO CATÁLOGO DE MAQUINARIA, REFACCIONES Y SITIOS
// Extraído modularmente a maquinaria.js / src/modules/maquinaria.js (-1,973 líneas)
// =========================================================================

function filtrarTickets(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ticketFiltroActivo = btn.dataset.filter;
  renderTickets();
}

function setFiltroTickets(estado) {
  ticketFiltroActivo = estado;
  // Sync the existing filter buttons
  document.querySelectorAll('.filter-btn').forEach(b => {
    const filterVal = b.dataset.filter;
    const isActive = filterVal === estado || (filterVal === 'Cerrado' && estado.startsWith('Cerrado -'));
    b.classList.toggle('active', isActive);
  });
  renderTickets();
}

// ===== CANAL SELECTION =====
function seleccionarCanal(canal) {
  // Hide all boxes
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  // Show selected
  const box = document.getElementById('canal-input-' + canal);
  if (box) box.style.display = 'block';
}

function updateFileLabel(input) {
  const textSpan = input.parentElement.querySelector('.file-label-text');
  const isSelected = input.files && input.files.length > 0;
  
  if (isSelected) {
    if (input.files.length === 1) {
      textSpan.textContent = input.files[0].name;
    } else {
      textSpan.textContent = `${input.files.length} archivo(s) listo(s)`;
    }
    input.parentElement.style.borderColor = 'var(--accent)';
    input.parentElement.style.color = 'var(--accent)';
    input.parentElement.style.background = 'var(--accent-light)';
  } else {
    // Si es cotización, pedido o destino en PDF, poner el texto por defecto correcto
    let defaultText = 'Subir PDF';
    if (input.id.includes('cotizacion')) {
      defaultText = 'Subir cotización en PDF';
    } else if (input.id.includes('pedido')) {
      defaultText = 'Subir pedido en PDF';
    }
    textSpan.textContent = defaultText;
    input.parentElement.style.borderColor = 'var(--border)';
    input.parentElement.style.color = 'var(--text-secondary)';
    input.parentElement.style.background = 'var(--bg-primary)';
  }

  if (input.id === 'ref-destino-pdf-file') {
    const verBtn = document.getElementById('btn-ver-destino-pdf');
    if (verBtn) {
      verBtn.style.display = isSelected ? 'inline-flex' : 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  // Controlar visibilidad del botón de limpiar/basura si existe
  const isCotizacionPdf = input.id === 't-cotizacion-pdf' || input.id.startsWith('quick-cot-pdf-');
  if (isCotizacionPdf) {
    const isModal = input.id === 't-cotizacion-pdf';
    const ticketId = isModal ? null : input.id.replace('quick-cot-pdf-', '');
    const clearBtnId = isModal ? 'btn-clear-pdf-modal' : `btn-clear-pdf-quick-${ticketId}`;
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
      clearBtn.style.display = isSelected ? 'inline-flex' : 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// ============================================================
// MÓDULO DE COTIZACIONES, PEDIDOS Y VALIDACIÓN SAP
// Extraído modularmente a sap_sync.js / src/modules/sap_sync.js
// ============================================================

// ===== INTERNAL NOTIFICATION BELL =====
window.toggleInternalNotificationDropdown = function(event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const otherDd = document.getElementById('notification-dropdown');
  if (otherDd) otherDd.style.display = 'none';

  const dd = document.getElementById('internal-notification-dropdown');
  if (dd) {
    const isHidden = dd.style.display === 'none' || dd.style.display === '';
    if (isHidden) {
      if (typeof window.sincronizarNotificacionesInternas === 'function') {
        window.sincronizarNotificacionesInternas();
      } else if (typeof window.updateInternalNotificationBell === 'function') {
        window.updateInternalNotificationBell();
      }
    }
    dd.style.display = isHidden ? 'block' : 'none';
  }
};

document.addEventListener('click', function(e) {
  const dd = document.getElementById('internal-notification-dropdown');
  const bell = document.getElementById('internal-notification-bell-container');
  if (dd && bell && !bell.contains(e.target)) {
    dd.style.display = 'none';
  }
});

window.sincronizarNotificacionesInternas = function() {
  const isSuperadmin = (currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));
  const isAdmin = (currentSession && (currentSession.viewMode === 'admin' || currentSession.rol === 'admin' || currentSession.realRol === 'admin'));
  const isSupervisor = (currentSession && (currentSession.viewMode === 'supervisor' || currentSession.rol === 'supervisor'));
  const isAdminOrSuper = isSuperadmin || isAdmin;

  const currentUser = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios.find(u => u && u.id === currentSession?.userId) : null;
  const currentUserName = currentUser ? currentUser.nombre : (currentSession?.nombre || 'Usuario');
  const sesentaDiasMs = 60 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  let readKeys = new Set();
  try {
    const storedReadKeys = JSON.parse(localStorage.getItem('sapi_internal_notifications_read_keys')) || [];
    readKeys = new Set(storedReadKeys);
  } catch(e) {}

  allNotifications.forEach(n => {
    if (n && n.leida && n.id) {
      readKeys.add(n.id);
    }
  });

  const tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : (JSON.parse(localStorage.getItem('sapi_tickets') || '[]'));
  
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

  localStorage.setItem('sapi_internal_notifications', JSON.stringify(updatedList));
  localStorage.setItem('sapi_internal_notifications_read_keys', JSON.stringify(Array.from(readKeys)));

  if (typeof window.updateInternalNotificationBell === 'function') {
    window.updateInternalNotificationBell();
  }
};

window.generarNotificacionInterna = function(ticket, asignadoAnterior, asignadoNuevo) {
  const normOld = String(asignadoAnterior || '').trim().toLowerCase();
  const normNew = String(asignadoNuevo || '').trim().toLowerCase();
  if (normOld === normNew) return; // Sin cambios reales

  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const currentUserName = currentUser ? currentUser.nombre : 'Usuario';

  const newNotif = {
    id: crypto.randomUUID(),
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
  localStorage.setItem('sapi_internal_notifications', JSON.stringify(allNotifications));
  
  if (window.updateInternalNotificationBell) {
    window.updateInternalNotificationBell();
  }
};

window.generarNotificacionComentarioInterno = function(ticket, comentario) {
  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const currentUserName = currentUser ? currentUser.nombre : 'Usuario';
  const isSuperadmin = (currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));

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
  localStorage.setItem('sapi_internal_notifications', JSON.stringify(allNotifications));
  
  if (window.updateInternalNotificationBell) {
    window.updateInternalNotificationBell();
  }
};

window.updateInternalNotificationBell = function() {
  const bell = document.getElementById('internal-notification-bell-container');
  if (bell) {
    if (currentSession && currentSession.viewMode === 'tecnico') {
      bell.style.display = 'none';
      return;
    } else {
      bell.style.display = 'flex';
    }
  }

  const badge = document.getElementById('internal-notification-badge');
  const dropCount = document.getElementById('internal-notification-dropdown-count');
  const container = document.getElementById('internal-notification-items-container');

  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  const isTest = (typeof isTestModeActive === 'function') ? isTestModeActive() : false;
  const isSuperadmin = (currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));
  const isAdmin = (currentSession && (currentSession.viewMode === 'admin' || currentSession.rol === 'admin' || currentSession.realRol === 'admin'));
  const isSupervisor = (currentSession && (currentSession.viewMode === 'supervisor' || currentSession.rol === 'supervisor'));
  const isAdminOrSuper = isSuperadmin || isAdmin;

  const currentUser = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios.find(u => u && u.id === currentSession?.userId) : null;
  const currentUserName = currentUser ? currentUser.nombre : (currentSession?.nombre || 'Usuario');

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
    const currentTickets = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];
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
};

window.verTicketYMarcarInternaLeida = function(ticketId, notificationId) {
  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  let readKeys = new Set();
  try {
    const storedReadKeys = JSON.parse(localStorage.getItem('sapi_internal_notifications_read_keys')) || [];
    readKeys = new Set(storedReadKeys);
  } catch(e) {}

  if (notificationId) {
    readKeys.add(notificationId);
  }

  const currentUser = usuarios.find(u => u && u.id === currentSession?.userId);
  const currentUserName = currentUser ? currentUser.nombre : 'Usuario';
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
  localStorage.setItem('sapi_internal_notifications', JSON.stringify(allNotifications));
  localStorage.setItem('sapi_internal_notifications_read_keys', JSON.stringify(Array.from(readKeys)));

  window.updateInternalNotificationBell();

  const dd = document.getElementById('internal-notification-dropdown');
  if (dd) dd.style.display = 'none';

  const navItem = document.querySelector('.nav-item[data-view="tickets"]');
  if (navItem) navItem.click();

  if (typeof verDetalleTicket === 'function') {
    verDetalleTicket(ticketId);
  } else if (typeof abrirTicket === 'function') {
    abrirTicket(ticketId);
  }
};

window.marcarTodasInternasLeidas = function() {
  let allNotifications = [];
  try {
    allNotifications = JSON.parse(localStorage.getItem('sapi_internal_notifications')) || [];
  } catch(e) {}

  let readKeys = new Set();
  try {
    const storedReadKeys = JSON.parse(localStorage.getItem('sapi_internal_notifications_read_keys')) || [];
    readKeys = new Set(storedReadKeys);
  } catch(e) {}

  const isTest = (typeof isTestModeActive === 'function') ? isTestModeActive() : false;

  allNotifications = allNotifications.map(n => {
    if (!!n.esPrueba === isTest) {
      n.leida = true;
      if (n.id) readKeys.add(n.id);
    }
    return n;
  });
  localStorage.setItem('sapi_internal_notifications', JSON.stringify(allNotifications));
  localStorage.setItem('sapi_internal_notifications_read_keys', JSON.stringify(Array.from(readKeys)));

  window.updateInternalNotificationBell();
};

// ===== NOTIFICATION BELL (TICKETS SIN ASIGNAR) =====
window.toggleNotificationDropdown = function(event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const intDd = document.getElementById('internal-notification-dropdown');
  if (intDd) intDd.style.display = 'none';

  const dd = document.getElementById('notification-dropdown');
  if (dd) {
    const isHidden = dd.style.display === 'none' || dd.style.display === '';
    dd.style.display = isHidden ? 'block' : 'none';
  }
};

document.addEventListener('click', function(e) {
  const dd = document.getElementById('notification-dropdown');
  const bell = document.getElementById('notification-bell-container');
  if (dd && bell && !bell.contains(e.target)) {
    dd.style.display = 'none';
  }
});

window.updateNotificationBell = function() {
  if (window.updateInternalNotificationBell) {
    try { window.updateInternalNotificationBell(); } catch(e) {}
  }

  const bell = document.getElementById('notification-bell-container');
  if (bell) {
    if (currentSession.viewMode === 'tecnico') {
      bell.style.display = 'none';
      return;
    } else {
      bell.style.display = 'flex';
    }
  }

  const badge = document.getElementById('notification-badge');
  const dropCount = document.getElementById('notification-dropdown-count');
  const container = document.getElementById('notification-items-container');
  
  if (!tickets) return;

  // Filtrar según el modo Sandbox activo
  const filteredTickets = getFilteredTickets();
  
  // 1. Tickets sin asignar: Solo tickets nuevos en estado Abierto que requieren asignación inicial (excluyendo subtickets de refacciones que pertenecen a su propio flujo)
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
      if (window.lucide) lucide.createIcons();
    }
  }
};

window.abrirTicketDesdeNotification = function(ticketId) {
  const dd = document.getElementById('notification-dropdown');
  if (dd) dd.style.display = 'none';
  
  const navItem = document.querySelector('.nav-item[data-view="tickets"]');
  if (navItem) {
    navItem.click();
  }
  if (typeof verDetalleTicket === 'function') {
    verDetalleTicket(ticketId);
  } else {
    abrirTicket(ticketId);
  }
};

window.abrirOrdenDesdePerfil = function(id) {
  editarOrden(id);
};

window.renderServiciosProgramadosTecnico = function() {
  const card = document.getElementById('card-servicios-programados');
  const container = document.getElementById('servicios-programados-list');
  if (!card || !container) return;

  const isTecnico = currentSession.viewMode === 'tecnico';
  if (!isTecnico) {
    card.style.display = 'none';
    return;
  }

  // Si es técnico, mostramos la tarjeta
  card.style.display = 'block';

  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const miTecnicoNombre = currentUser ? currentUser.nombre : '';
  const miNombreClean = miTecnicoNombre.trim().toLowerCase();

  if (!miNombreClean) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1.5rem; font-style:italic;">No se pudo resolver el nombre del técnico.</div>`;
    return;
  }

  // Filtrar órdenes que no estén resueltas / finalizadas
  const pendingServices = getFilteredOrders().filter(o => {
    const estadoClean = String(o.estado || '').trim().toLowerCase();
    if (estadoClean === 'finalizado' || estadoClean === 'cerrada' || estadoClean === 'completada') return false;

    const orderTecnicoClean = String(o.tecnico || '').trim().toLowerCase();
    const isAssignedToOrder = orderTecnicoClean === miNombreClean ||
      (Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.some(t => String(t).trim().toLowerCase() === miNombreClean)) ||
      orderTecnicoClean.split(',').map(s => s.trim()).includes(miNombreClean);

    let hasPendingBitacora = false;
    if (o.bitacora && Array.isArray(o.bitacora)) {
      hasPendingBitacora = o.bitacora.some(b => {
        const bTecnicoClean = String(b.tecnico || '').trim().toLowerCase();
        const esAsignacionPendiente = b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true);
        return bTecnicoClean === miNombreClean && esAsignacionPendiente;
      });
    }

    return isAssignedToOrder || hasPendingBitacora;
  });

  let html = '';
  if (pendingServices.length === 0) {
    html = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1.5rem; font-style:italic;">No tienes servicios programados pendientes. ¡Buen trabajo!</div>`;
  } else {
    pendingServices.forEach(o => {
      let scheduledTimeText = 'No especificada';
      let scheduledDateText = o.fecha ? new Date(o.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha';

      if (o.bitacora && Array.isArray(o.bitacora)) {
        const myBitacora = o.bitacora.find(b => String(b.tecnico || '').trim().toLowerCase() === miNombreClean);
        if (myBitacora) {
          if (myBitacora.fecha) {
            scheduledDateText = new Date(myBitacora.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
          }
          if (myBitacora.entrada) {
            scheduledTimeText = `${myBitacora.entrada} hs`;
            if (myBitacora.salida) {
              scheduledTimeText += ` - ${myBitacora.salida} hs`;
            }
          }
        }
      }
      if (scheduledTimeText === 'No especificada') {
        try {
          const localEvents = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
          const myEv = localEvents.find(e => (e.ordenId === o.id || e.orden_id === o.id) && String(e.tecnicoNombre || e.tecnico_nombre || '').trim().toLowerCase() === miNombreClean);
          if (myEv) {
            const startVal = myEv.fechaInicio || myEv.fecha_inicio || myEv.start;
            if (startVal) {
              const dObj = new Date(startVal);
              scheduledDateText = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
              const ent = `${String(dObj.getHours()).padStart(2,'0')}:${String(dObj.getMinutes()).padStart(2,'0')}`;
              scheduledTimeText = `${ent} hs`;
              const endVal = myEv.fechaFin || myEv.fecha_fin || myEv.end;
              if (endVal) {
                const dEnd = new Date(endVal);
                scheduledTimeText += ` - ${String(dEnd.getHours()).padStart(2,'0')}:${String(dEnd.getMinutes()).padStart(2,'0')} hs`;
              }
            }
          }
        } catch(e){}
      }

      html += `
        <div class="service-item-card" onclick="window.abrirOrdenDesdePerfil('${o.id}')" style="background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; padding:0.75rem 1rem; display:flex; flex-direction:column; gap:0.4rem; cursor:pointer; transition:var(--transition);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:monospace; font-weight:600; color:var(--accent); font-size:0.85rem;">${o.folio}</span>
            <span class="badge" style="background:rgba(245,158,11,0.1); color:var(--orange); font-size:0.7rem; border:1px solid rgba(245,158,11,0.2);">${o.tipo || 'Servicio'}</span>
          </div>
          <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary);">${o.cliente}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${o.marca || ''} ${o.modelo || ''}</div>
          <div style="margin-top:0.25rem; display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.75rem; border-top:1px dashed var(--border); padding-top:0.4rem;">
            <div style="color:var(--text-muted); display:flex; align-items:center; gap:3px;"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${scheduledDateText}</div>
            <div style="color:var(--accent); display:flex; align-items:center; gap:3px; font-weight:500;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${scheduledTimeText}</div>
          </div>
        </div>
      `;
    });
  }
  container.innerHTML = html;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

window.renderTicketRefaccionesList = function(t) {
  const refPartsBottom = document.getElementById('ref-ticket-parts-bottom');
  const refBottomPiezasList = document.getElementById('ref-bottom-piezas-list');
  if (refPartsBottom && refBottomPiezasList) {
    refPartsBottom.style.display = 'block';
    refBottomPiezasList.innerHTML = '';
    const parts = t.refaccionesSeleccionadas || [];
    if (parts.length > 0) {
      parts.forEach(p => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          font-size: 0.85rem;
        `;
        
        let pStatusColor = '#ef4444';
        let pStatusBg = 'rgba(239, 68, 68, 0.1)';
        if (p.estatusPedido === 'En Tránsito / Pedido') {
          pStatusColor = '#e8820c';
          pStatusBg = 'rgba(232, 130, 12, 0.1)';
        } else if (p.estatusPedido === 'Entregado al Técnico') {
          pStatusColor = '#22c55e';
          pStatusBg = 'rgba(34, 197, 94, 0.1)';
        }
        
        let detailsHtml = `(Clave: ${p.clave || p.codigo || 'S/C'})`;
        let extraInfo = [];
        if (p.proveedor) extraInfo.push(`Prov: ${p.proveedor}`);
        if (p.precio) {
          const val = parseFloat(p.precio);
          if (!isNaN(val)) {
            extraInfo.push(`Precio: $${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          } else {
            extraInfo.push(`Precio: $${p.precio}`);
          }
        }
        if (extraInfo.length > 0) {
          detailsHtml += ` • ${extraInfo.join(' | ')}`;
        }

        itemDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: 500; color: var(--text-primary);">
              <span style="color: var(--accent); font-weight: 700; margin-right: 4px;">${p.cantidad || p.qty || 1}x</span> 
              ${p.descripcion || p.nombre || 'Sin Descripción'}
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; display: inline-block; margin-left: 8px;">${detailsHtml}</span>
            </span>
            <span class="status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${pStatusColor}; background: ${pStatusBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${pStatusColor}33; cursor: pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${p.clave || p.codigo}', '${p.descripcion || p.nombre}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad || 1}, '${p.marca || ''}')">
              ${p.estatusPedido || 'Por Pedir'}
            </span>
          </div>
        `;
        refBottomPiezasList.appendChild(itemDiv);
      });
    } else {
      refBottomPiezasList.innerHTML = '<span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">Ninguna refacción registrada.</span>';
    }
  }
};

window.obtenerEnviosDesdeDOM = function() {
  const container = document.getElementById('envios-container');
  if (!container) return [];

  const cards = container.querySelectorAll('.envio-card');
  const envios = [];

  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    const paqueteria = card.querySelector('.envio-paqueteria').value.trim();
    const guiaPedido = card.querySelector('.envio-guia').value.trim();
    const fechaPedido = card.querySelector('.envio-fecha-pedido').value;
    const fechaEntrega = card.querySelector('.envio-fecha-entrega').value;
    const llego = card.querySelector('.envio-llego')?.checked || false;
    const fechaLlegada = card.querySelector('.envio-fecha-llegada')?.value || '';

    const parts = [];
    const checkboxes = card.querySelectorAll('.envio-part-checkbox:checked');
    checkboxes.forEach(cb => {
      parts.push({
        clave: cb.getAttribute('data-clave'),
        descripcion: cb.getAttribute('data-desc')
      });
    });

    envios.push({
      id,
      paqueteria,
      guiaPedido,
      fechaPedido,
      fechaEntrega,
      llego,
      fechaLlegada,
      parts
    });
  });

  return envios;
};

window.actualizarVisibilidadDestinoPiezas = function(t) {
  let allEntregadas = false;
  if (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
    allEntregadas = t.refaccionesSeleccionadas.every(p => p.estatusPedido === 'Entregado al Técnico');
  }

  const destContainer = document.getElementById('ref-ticket-destination-fields');
  const selectDest = document.getElementById('ref-destino-piezas');

  if (destContainer) {
    if (allEntregadas) {
      destContainer.style.display = 'block';
      if (selectDest && selectDest.value === '') {
        selectDest.value = t.destinoPiezas || '';
      }
    } else {
      destContainer.style.display = 'none';
      if (selectDest) selectDest.value = '';
    }
  }
};

window.actualizarEstatusRefaccionesDesdeGuias = function(t) {
  const envios = window.obtenerEnviosDesdeDOM();
  if (t.refaccionesSeleccionadas) {
    t.refaccionesSeleccionadas.forEach(p => {
      const pClave = p.clave || p.codigo || '';
      const pDesc = p.descripcion || p.nombre || '';

      // Find all guides that contain this part
      const matchingEnvios = envios.filter(env => 
        env.parts && env.parts.some(ep => ep.clave === pClave && ep.descripcion === pDesc)
      );

      if (matchingEnvios.length > 0) {
        // If at least one matching guide has llego === true
        const anyArrived = matchingEnvios.some(env => env.llego);
        if (anyArrived) {
          p.estatusPedido = 'Entregado al Técnico';
        } else {
          p.estatusPedido = 'En Tránsito / Pedido';
        }
      } else {
        // Not in any guide
        p.estatusPedido = 'Por Pedir';
      }
    });
  }
  window.renderTicketRefaccionesList(t);
  window.actualizarVisibilidadDestinoPiezas(t);
};

// Helper: Determina si un ticket requiere una Orden de Servicio en campo o si es solo despacho / refacciones / garantía
window.esTicketDeServicioEnCampo = function(t) {
  if (!t || typeof t !== 'object') return false;
  
  const norm = (s) => {
    if (!s) return '';
    if (typeof window.normStr === 'function') return window.normStr(s);
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const cat = norm(t.categoria);
  const area = norm(t.area);
  const tipo = norm(t.tipo);
  const asunto = norm(t.asunto);
  const desc = norm(t.descripcion);
  const folio = String(t.folio || '').trim().toUpperCase();

  // 1. Subtickets de refacción (-A) o folios con prefijo de refacción
  if (folio.endsWith('-A') || folio.includes('-REF') || folio.includes('-A-') || folio.startsWith('REF-')) {
    return false;
  }

  // 2. Si el Área es Refacciones, Garantías, Piezas o Almacén
  if (area.includes('refacci') || area.includes('garant') || area.includes('pieza') || area.includes('almacen')) {
    return false;
  }

  // 3. Si la Categoría es Refacción, Refacciones, Garantía, Piezas, Despacho, Envío, Paquetería o Información
  const esCatRefOrGar = cat.includes('refacci') || cat.includes('garant') || cat.includes('pieza') || 
                        cat.includes('despacho') || cat.includes('envio') || cat.includes('paqueteri') || 
                        cat.includes('solicitud de informacion');
  if (esCatRefOrGar) {
    // Si el área o categoría es refacción/garantía sin ser servicio explícito
    if (!cat.includes('servicio') && !cat.includes('mantenimiento') && !cat.includes('puesta en marcha') && !cat.includes('pre-entrega') && !cat.includes('inspeccion') && !cat.includes('reparacion')) {
      return false;
    }
  }

  // 4. Si el Tipo es Refacción, Garantía o Despacho
  if (tipo.includes('refacci') || tipo.includes('garant') || tipo.includes('pieza') || tipo.includes('despacho')) {
    return false;
  }

  // 5. Si el Asunto contiene términos explícitos de refacciones o garantías (y no es servicio técnico en campo)
  const esAsuntoRef = (asunto.includes('refacci') || asunto.includes('garant') || asunto.includes('despacho')) &&
                      !asunto.includes('servicio') && !asunto.includes('mantenimiento') && !asunto.includes('puesta en marcha') && !asunto.includes('reparacion');
  if (esAsuntoRef) {
    return false;
  }

  // 6. Si el destino de las piezas es directo al cliente
  if (t.destinoPiezas === 'cliente') {
    return false;
  }

  // 7. Si el ticket tiene refacciones o envíos y no es un servicio técnico en campo explícito
  const esServicioTecnicoExplicito = cat.includes('servicio') || cat.includes('mantenimiento') || cat.includes('puesta en marcha') || cat.includes('pre-entrega') || cat.includes('inspeccion') || cat.includes('reparacion');
  const tieneRefacciones = (Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0) || (Array.isArray(t.envios) && t.envios.length > 0) || (t.guiaPedido && String(t.guiaPedido).trim().length > 0);
  
  if (tieneRefacciones && !esServicioTecnicoExplicito) {
    return false;
  }

  // 8. Solo retornar true si existe indicación de servicio / mantenimiento / puesta en marcha / pre-entrega / soporte en campo
  const esServicio = esServicioTecnicoExplicito || 
                     cat.includes('soporte') || cat.includes('otro') ||
                     area.includes('servicio') || area.includes('operaciones') || area.includes('soporte') ||
                     tipo.includes('servicio') || tipo.includes('preventivo') || tipo.includes('correctivo');

  return esServicio;
};

window.renderEnvioCards = function(t) {
  const container = document.getElementById('envios-container');
  if (!container) return;
  container.innerHTML = '';

  let envios = t.envios || [];
  
  // Backward compatibility: if envios is empty but legacy single shipment info exists, initialize
  if (envios.length === 0 && (t.paqueteria || t.guiaPedido || t.fechaPedido || t.fechaEntrega)) {
    envios.push({
      id: Math.random().toString(36).substring(2, 9),
      paqueteria: t.paqueteria || '',
      guiaPedido: t.guiaPedido || '',
      fechaPedido: t.fechaPedido || '',
      fechaEntrega: t.fechaEntrega || '',
      llego: false,
      fechaLlegada: '',
      parts: (t.refaccionesSeleccionadas || []).map(p => ({
        clave: p.clave || p.codigo || '',
        descripcion: p.descripcion || p.nombre || ''
      }))
    });
  }

  // If still empty, push one empty one so there is at least one input fields set visible
  if (envios.length === 0) {
    envios.push({
      id: Math.random().toString(36).substring(2, 9),
      paqueteria: '',
      guiaPedido: '',
      fechaPedido: '',
      fechaEntrega: '',
      llego: false,
      fechaLlegada: '',
      parts: []
    });
  }

  t.envios = envios;

  envios.forEach((envio, index) => {
    const card = document.createElement('div');
    card.className = 'envio-card';
    card.setAttribute('data-id', envio.id);
    card.style.cssText = 'background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; position: relative; display: flex; flex-direction: column; gap: 0.75rem; width: 100%; box-sizing: border-box;';
    
    // Checkbox items for all parts in the ticket
    const ticketParts = t.refaccionesSeleccionadas || [];
    let partsCheckboxesHtml = '';
    if (ticketParts.length > 0) {
      partsCheckboxesHtml = ticketParts.map(p => {
        const pClave = p.clave || p.codigo || '';
        const pDesc = p.descripcion || p.nombre || '';
        const isChecked = envio.parts && envio.parts.some(ep => ep.clave === pClave && ep.descripcion === pDesc);
        const checkedAttr = isChecked ? 'checked' : '';
        return `
          <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; user-select: none; padding: 2px 0;">
            <input type="checkbox" class="envio-part-checkbox" data-clave="${pClave}" data-desc="${pDesc}" ${checkedAttr} style="margin-top: 3px;" />
            <span><strong style="color: var(--accent);">${p.cantidad || p.qty || 1}x</strong> ${pDesc} <span style="color: var(--text-muted); font-size: 0.75rem; font-family: monospace;">(${pClave})</span></span>
          </label>
        `;
      }).join('');
    } else {
      partsCheckboxesHtml = '<span style="color: var(--text-muted); font-style: italic; font-size: 0.8rem;">No hay refacciones en este ticket.</span>';
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Guía / Envío #${index + 1}</span>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; user-select: none; margin-bottom: 0;">
            <input type="checkbox" class="envio-llego" ${envio.llego ? 'checked' : ''} style="margin-top: 2px;" />
            <span>¿Ya Llegó?</span>
          </label>
          <div class="envio-fecha-llegada-container" style="display: ${envio.llego ? 'flex' : 'none'}; align-items: center; gap: 4px;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">el:</span>
            <input type="date" class="envio-fecha-llegada" value="${envio.fechaLlegada || ''}" style="padding: 0.25rem; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
          </div>
          <button type="button" class="btn-delete-envio" style="background: none; border: none; color: #ef4444; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Eliminar
          </button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Paquetería</label>
          <input type="text" class="envio-paqueteria" value="${envio.paqueteria || ''}" placeholder="E.j. DHL, FedEx, RedPack" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Guía de Pedido</label>
          <input type="text" class="envio-guia" value="${envio.guiaPedido || ''}" placeholder="Número de Guía" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Fecha de Pedido</label>
          <input type="date" class="envio-fecha-pedido" value="${envio.fechaPedido || ''}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Fecha de Entrega</label>
          <input type="date" class="envio-fecha-entrega" value="${envio.fechaEntrega || ''}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
      </div>
      
      <div class="envio-time-text" style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border);">
        <i data-lucide="clock" style="width: 14px; height: 14px; color: var(--accent);"></i>
        <span>El tiempo se calculará al ingresar las fechas.</span>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.25rem;">
        <label style="font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">Refacciones en este envío:</label>
        <div class="envio-parts-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; padding: 2px;">
          ${partsCheckboxesHtml}
        </div>
      </div>
    `;

    // Event listener for delete button
    card.querySelector('.btn-delete-envio').onclick = () => {
      t.envios = t.envios.filter(x => x.id !== envio.id);
      window.renderEnvioCards(t);
      window.actualizarEstatusRefaccionesDesdeGuias(t);
    };

    // Calculate time helper
    const updateTime = () => {
      const fPedido = card.querySelector('.envio-fecha-pedido').value;
      const fEntrega = card.querySelector('.envio-fecha-entrega').value;
      const textSpan = card.querySelector('.envio-time-text span');
      if (!textSpan) return;

      let parts = [];
      if (fPedido) {
        const reqDate = new Date(fPedido);
        reqDate.setHours(0,0,0,0);
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const diffTranscurrido = Math.floor((hoy.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffTranscurrido >= 0) {
          parts.push(`Transcurrido: <strong style="color: var(--accent);">${diffTranscurrido}d</strong>`);
        }
      }

      if (fEntrega) {
        const estDate = new Date(fEntrega);
        estDate.setHours(0,0,0,0);
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const diffFaltante = Math.ceil((estDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffFaltante > 0) {
          parts.push(`Faltan: <strong style="color: var(--text-primary);">${diffFaltante}d</strong>`);
        } else if (diffFaltante === 0) {
          parts.push(`<span style="color: #f97316; font-weight: 700;">¡Se entrega HOY!</span>`);
        } else {
          parts.push(`<span style="color: #ef4444; font-weight: 700;">⚠️ Atrasado: ${Math.abs(diffFaltante)}d</span>`);
        }
      }

      if (parts.length > 0) {
        textSpan.innerHTML = parts.join(' | ');
      } else {
        textSpan.innerHTML = 'El tiempo se calculará al ingresar las fechas.';
      }
    };

    card.querySelector('.envio-fecha-pedido').onchange = updateTime;
    card.querySelector('.envio-fecha-entrega').onchange = updateTime;
    updateTime();

    // Listen to changes to auto update refacciones statuses
    card.querySelectorAll('.envio-part-checkbox').forEach(cb => {
      cb.onchange = () => {
        window.actualizarEstatusRefaccionesDesdeGuias(t);
      };
    });

    const chkLlego = card.querySelector('.envio-llego');
    const fLlegadaContainer = card.querySelector('.envio-fecha-llegada-container');
    const fLlegadaInput = card.querySelector('.envio-fecha-llegada');

    if (chkLlego) {
      chkLlego.onchange = () => {
        if (chkLlego.checked) {
          fLlegadaContainer.style.display = 'flex';
          if (!fLlegadaInput.value) {
            const offset = new Date().getTimezoneOffset();
            const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
            fLlegadaInput.value = localDate.toISOString().split('T')[0];
          }
        } else {
          fLlegadaContainer.style.display = 'none';
          fLlegadaInput.value = '';
        }
        window.actualizarEstatusRefaccionesDesdeGuias(t);
      };
    }

    if (fLlegadaInput) {
      fLlegadaInput.onchange = () => {
        window.actualizarEstatusRefaccionesDesdeGuias(t);
      };
    }

    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons({ root: container });
};

// ===== TICKET FORM =====
function abrirTicket(id) {
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar tickets.', 'error');
    return;
  }
  editandoTicketId = id || null;
  document.getElementById('ticket-modal-title').textContent = id ? 'Editar Ticket' : 'Nuevo Ticket';
  
  const btnSubmit = document.getElementById('btn-submit-ticket');
  if (btnSubmit) {
    btnSubmit.innerHTML = id ? '<i data-lucide="save" class="btn-icon"></i> Guardar Cambios' : '<i data-lucide="save" class="btn-icon"></i> Emitir Ticket';
  }

  document.getElementById('form-ticket').reset();
  
  const statusDiv = document.getElementById('t-sap-validation-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
  }

  const pedidoStatusDiv = document.getElementById('t-pedido-sap-validation-status');
  if (pedidoStatusDiv) {
    pedidoStatusDiv.style.display = 'none';
    pedidoStatusDiv.innerHTML = '';
  }

  const pedidoPdfExtDiv = document.getElementById('pdf-pedido-extraction-table-container');
  if (pedidoPdfExtDiv) {
    pedidoPdfExtDiv.style.display = 'none';
    pedidoPdfExtDiv.innerHTML = '';
  }

  window._lastPdfPedidoExtracted = null;

  const t = id ? tickets.find(x => x.id === id) : null;

  window.editandoCotizaciones = [];
  if (t) {
    if (Array.isArray(t.cotizacionesAdicionales) && t.cotizacionesAdicionales.length > 0) {
      window.editandoCotizaciones = JSON.parse(JSON.stringify(t.cotizacionesAdicionales));
    } else if (t.cotizacionSAP) {
      window.editandoCotizaciones = [{
        sap: t.cotizacionSAP,
        monto: t.montoCotizacion || 0,
        pdf: t.pdfCotizacion || null
      }];
    }
  }

  setTimeout(() => {
    if (window.renderLinkedCotizaciones) {
      window.renderLinkedCotizaciones(true);
    }
  }, 100);

  if (window.poblarCotizacionesDropdown) {
    window.poblarCotizacionesDropdown(true, null, '');
  }

  if (window.poblarPedidosDropdown) {
    window.poblarPedidosDropdown(true, null, t ? t.pedidoSAP : '');
  }

  if (t && t.pedidoSAP) {
    const elPedMonto = document.getElementById('t-pedido-monto');
    // Si ya existe monto del pedido en el ticket lo mostramos, de lo contrario buscamos en la orden de SAP
    if (elPedMonto) {
      const order = (window._cachePedidosSap || []).find(o => o.numero_pedido === t.pedidoSAP);
      elPedMonto.value = t.montoPedido || (order ? order.monto : '');
    }
    setTimeout(() => {
      if (window.validarPedidoConSAP) {
        window.validarPedidoConSAP(true);
      }
    }, 200);
  } else {
    const elPedMonto = document.getElementById('t-pedido-monto');
    if (elPedMonto) elPedMonto.value = '';
  }

  // Reset file labels
  ['t-cotizacion-pdf', 't-pedido-pdf'].forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) {
      const textSpan = el.parentElement.querySelector('.file-label-text');
      const hasPdf = inputId === 't-cotizacion-pdf' ? t?.pdfCotizacion : t?.pdfPedido;
      
      if (textSpan) textSpan.textContent = hasPdf ? 'PDF guardado (Sube para reemplazar)' : (inputId === 't-cotizacion-pdf' ? 'Subir cotización en PDF' : 'Subir pedido en PDF');
      
      el.parentElement.style.borderColor = hasPdf ? 'var(--accent)' : 'var(--border)';
      el.parentElement.style.color = hasPdf ? 'var(--accent)' : 'var(--text-muted)';
      el.parentElement.style.background = hasPdf ? 'var(--accent-light)' : 'rgba(255,255,255,0.02)';
    }
  });

  const destPiezasEl = document.getElementById('ref-destino-piezas');
  if (destPiezasEl) destPiezasEl.value = '';

  const destPrecioEl = document.getElementById('ref-destino-precio');
  if (destPrecioEl) destPrecioEl.value = '';

  const destPdfInput = document.getElementById('ref-destino-pdf-file');
  if (destPdfInput) destPdfInput.value = '';

  const destPdfSpan = destPdfInput?.parentElement?.querySelector('.file-label-text');
  if (destPdfSpan) {
    destPdfSpan.textContent = 'Subir PDF';
    const parentLabel = destPdfSpan.parentElement;
    parentLabel.style.borderColor = 'var(--border)';
    parentLabel.style.color = 'var(--text-secondary)';
    parentLabel.style.background = 'var(--bg-primary)';
  }
  const destPdfVerBtn = document.getElementById('btn-ver-destino-pdf');
  if (destPdfVerBtn) destPdfVerBtn.style.display = 'none';
  
  // Llenar el combo de clientes
  const comboOptions = document.getElementById('t-cliente-options');
  const inputHidden = document.getElementById('t-cliente');
  const displaySpan = document.getElementById('t-cliente-display');
  
  const isEmpresa = currentSession.viewMode === 'empresa';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreEmpresaLogged = isEmpresa && currentUser ? (currentUser.empresa || currentUser.nombre) : null;

  // Ocultar campos internos para el cliente
  const displayVal = isEmpresa ? 'none' : 'block';
  const displayValFlex = isEmpresa ? 'none' : 'flex';
  const elOrigen = document.getElementById('section-t-origen'); if (elOrigen) elOrigen.style.display = displayVal;
  const elCliente = document.getElementById('group-t-cliente'); if (elCliente) elCliente.style.display = displayVal;
  const elAsignado = document.getElementById('group-t-asignado'); if (elAsignado) elAsignado.style.display = displayVal;
  const elNotas = document.getElementById('group-t-notas'); if (elNotas) elNotas.style.display = displayVal;
  const elEstado = document.getElementById('section-t-estado'); if (elEstado) elEstado.style.display = (isEmpresa || !id) ? 'none' : 'block';
  const elEvidencias = document.getElementById('group-t-evidencias'); if (elEvidencias) elEvidencias.style.display = isEmpresa ? 'block' : 'none';

  if (comboOptions && !isEmpresa) {
    // Resetear valor inicial
    inputHidden.value = '';
    displaySpan.textContent = 'Ninguno / Uso Interno';
    
    // Generar opciones
    comboOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('t-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      comboOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  // Reset canal inputs
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  document.getElementById('t-sitio').value = '';
  document.getElementById('group-t-sitio').style.display = 'none';
  poblarMaquinasCliente('t-equipo', '');
  const selectedEquiposContainer = document.getElementById('t-equipos-seleccionados');
  if (selectedEquiposContainer) selectedEquiposContainer.innerHTML = '';

  const selectAsignado = document.getElementById('t-asignado');
  if (selectAsignado) {
    selectAsignado.innerHTML = '<option value="">Sin asignar</option>';
    usuarios.filter(u => u && ['supervisor', 'admin', 'superadmin'].includes(u.rol) && u.activo !== false && ((typeof isTestModeActive === 'function' && isTestModeActive()) || !(typeof isTestUser === 'function' && isTestUser(u)))).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.nombre;
      opt.textContent = u.nombre;
      selectAsignado.appendChild(opt);
    });
  }

  // Si es empresa y es un ticket nuevo, autocompletamos su perfil
  if (isEmpresa && !id) {
    document.getElementById('t-solicitante').value = currentUser ? currentUser.nombre : '';
    const cliName = currentUser ? (currentUser.empresa || currentUser.nombre) : '';
    if (cliName) {
      selectComboOption('t-cliente', cliName, cliName);
    }
  }

  // Ocultar campos internos si es Empresa
  const displayInternal = isEmpresa ? 'none' : '';
  ['section-t-origen', 'group-t-cliente', 'group-t-asignado', 'group-t-notas', 'section-t-estado', 'group-t-resolucion', 'group-t-cierre'].forEach(elId => {
    const el = document.getElementById(elId);
    if (el) {
      if (!isEmpresa && elId === 'group-t-cliente') {
        el.style.display = 'block'; // Ensure block for combo box wrapper
      } else if (elId === 'section-t-estado') {
        el.style.display = (id && !isEmpresa) ? 'block' : 'none'; // Only show if editing and not empresa
      } else {
        el.style.display = displayInternal;
      }
    }
  });

  if (id) {
    const t = tickets.find(x => x.id === id);
    if (t) {
      editandoTicketId = id;
      document.getElementById('ticket-modal-title').textContent = 'Editar Ticket: ' + t.folio;
      document.getElementById('t-asunto').value = t.asunto || '';
      document.getElementById('t-solicitante').value = t.solicitante || '';
      document.getElementById('t-area').value = t.area || 'Operaciones';
      document.getElementById('t-cliente').value = t.cliente || '';
      document.getElementById('t-sitio').value = t.sitio || '';
      document.getElementById('t-categoria').value = t.categoria || 'Refacción';
      document.getElementById('t-prioridad').value = t.prioridad || 'Media';
      const selectAsignado = document.getElementById('t-asignado');
      if (selectAsignado) {
        if (t.asignado && t.asignado !== 'Sin Asignar' && t.asignado !== 'sin_asignar' && t.asignado !== '-') {
          let exists = Array.from(selectAsignado.options).some(o => o.value === t.asignado);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = t.asignado;
            opt.textContent = t.asignado;
            selectAsignado.appendChild(opt);
          }
          selectAsignado.value = t.asignado;
        } else {
          selectAsignado.value = '';
        }
      }
      document.getElementById('t-descripcion').value = t.descripcion || '';
      document.getElementById('t-notas').value = t.notas || '';
      
      const horometroEl = document.getElementById('t-horometro');
      if (horometroEl) horometroEl.value = t.horometro || '';
      
      const rEstado = document.querySelector(`input[name="t-estado"][value="${t.estado}"]`);
      if (rEstado) rEstado.checked = true;

      const rCanal = document.querySelector(`input[name="t-canal"][value="${t.canal}"]`);
      if (rCanal) {
        rCanal.checked = true;
        seleccionarCanal(t.canal);
        if (t.canal === 'correo') document.getElementById('t-correo').value = t.contacto || '';
        if (t.canal === 'whatsapp') document.getElementById('t-whatsapp').value = t.contacto || '';
        if (t.canal === 'telefono') document.getElementById('t-telefono').value = t.contacto || '';
      } else {
        // Deseleccionar canales y ocultar inputs si es un canal del portal o vacío
        document.querySelectorAll('input[name="t-canal"]').forEach(el => el.checked = false);
        seleccionarCanal('');
      }
      
      const pTicket = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
      const assocOrd = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
      const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '';
      const effectiveCliente = resolvedCli || t.cliente || (pTicket && pTicket.cliente ? pTicket.cliente : (assocOrd && assocOrd.cliente ? assocOrd.cliente : ''));
      const effectiveSitio = t.sitio || (pTicket && pTicket.sitio ? pTicket.sitio : (assocOrd && (assocOrd.ubicacion || assocOrd.ubicacion_sitio) ? (assocOrd.ubicacion || assocOrd.ubicacion_sitio) : ''));

      if (effectiveCliente) {
        selectComboOption('t-cliente', effectiveCliente, effectiveCliente);
      } else {
        selectComboOption('t-cliente', 'Ninguno / Uso Interno', 'Ninguno / Uso Interno');
      }
      if (effectiveSitio) {
        const escapedSitio = effectiveSitio.replace(/'/g, "\\'");
        selectComboOption('t-sitio', escapedSitio, escapedSitio, true);
      }

      poblarMaquinasCliente('t-equipo', '', effectiveCliente || t.cliente);
      const effectiveEquipo = (t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo : ((pTicket && pTicket.equipo && pTicket.equipo !== 'Otra / No registrada') ? pTicket.equipo : ((assocOrd && assocOrd.equipo) ? assocOrd.equipo : (t.equipo || '')));
      if (effectiveEquipo) {
        effectiveEquipo.split(', ').forEach(eqName => {
          if (eqName.trim()) {
            window.agregarMaquinaChip(eqName.trim());
          }
        });
      }
      
      const elCotSap = document.getElementById('t-cotizacion-sap');
      if (elCotSap) elCotSap.value = '';
      
      const elCotMonto = document.getElementById('t-cotizacion-monto');
      if (elCotMonto) elCotMonto.value = '';
      
      const elPedidoSap = document.getElementById('t-pedido-sap');
      if (elPedidoSap) elPedidoSap.value = t.pedidoSAP || '';
      
      const rAceptada = document.querySelector(`input[name="t-cot-aceptada"][value="${t.cotAceptada}"]`);
      if (rAceptada) rAceptada.checked = true;
      else {
        document.querySelectorAll('input[name="t-cot-aceptada"]').forEach(r => r.checked = false);
      }
      
      const elMotivo = document.getElementById('t-motivo-rechazo');
      if (elMotivo) elMotivo.value = t.motivoRechazo || '';

      const destPiezasEl = document.getElementById('ref-destino-piezas');
      if (destPiezasEl) destPiezasEl.value = t.destinoPiezas || '';

      const destPrecioEl = document.getElementById('ref-destino-precio');
      if (destPrecioEl) destPrecioEl.value = t.destinoPrecio || '';

      const destPdfInput = document.getElementById('ref-destino-pdf-file');
      const destPdfSpan = destPdfInput?.parentElement?.querySelector('.file-label-text');
      const hasDestinoPdf = !!t.destinoPdfUrl;
      const destPdfVerBtn = document.getElementById('btn-ver-destino-pdf');

      if (destPdfSpan) {
        destPdfSpan.textContent = hasDestinoPdf ? 'PDF guardado (Sube para reemplazar)' : 'Subir PDF';
        const parentLabel = destPdfSpan.parentElement;
        parentLabel.style.borderColor = hasDestinoPdf ? 'var(--accent)' : 'var(--border)';
        parentLabel.style.color = hasDestinoPdf ? 'var(--accent)' : 'var(--text-secondary)';
        parentLabel.style.background = hasDestinoPdf ? 'var(--accent-light)' : 'var(--bg-primary)';
      }
      if (destPdfVerBtn) {
        destPdfVerBtn.style.display = hasDestinoPdf ? 'inline-flex' : 'none';
      }
    }
  }

  // Cargar y mostrar la evidencia fotográfica del cliente si existe
  const elAdminEvidencia = document.getElementById('group-t-admin-evidencia');
  const imgAdminEvidencia = document.getElementById('t-admin-evidence-img');
  const loaderAdminEvidencia = document.getElementById('t-admin-evidence-loading');

  if (elAdminEvidencia && imgAdminEvidencia && loaderAdminEvidencia) {
    if (t && t.pdfCotizacion && !t.cotizacionSAP) {
      elAdminEvidencia.style.display = 'block';
      const isPlaceholder = t.pdfCotizacion === '__HAS_PDF__';
      if (isPlaceholder) {
        imgAdminEvidencia.src = '';
        imgAdminEvidencia.style.display = 'none';
        loaderAdminEvidencia.style.display = 'inline-block';
        
        // Descargar bajo demanda
        setTimeout(async () => {
          try {
            const { data, error } = await window.supabaseClient
              .from('tickets')
              .select('pdf_cotizacion')
              .eq('id', t.id)
              .single();
            if (error) throw error;
            const base64 = data ? data.pdf_cotizacion : null;
            if (base64) {
              t.pdfCotizacion = base64; // guardar localmente en caché
              imgAdminEvidencia.src = base64;
              imgAdminEvidencia.style.display = 'block';
              loaderAdminEvidencia.style.display = 'none';
            } else {
              loaderAdminEvidencia.innerHTML = '<span style="color:var(--text-muted);">Sin imagen</span>';
            }
          } catch (err) {
            console.error('Error cargando evidencia fotográfica en admin:', err);
            loaderAdminEvidencia.innerHTML = '<span style="color:var(--red);">Error al cargar imagen</span>';
          }
        }, 50);
      } else {
        imgAdminEvidencia.src = t.pdfCotizacion;
        imgAdminEvidencia.style.display = 'block';
        loaderAdminEvidencia.style.display = 'none';
      }
    } else {
      elAdminEvidencia.style.display = 'none';
      imgAdminEvidencia.src = '';
      imgAdminEvidencia.style.display = 'none';
      loaderAdminEvidencia.style.display = 'none';
    }
  }

  toggleResolucionTicket();
  toggleMotivoRechazo();

  // Control de campos y cabecera para Tickets de Refacciones / Garantías
  const isRefTicket = t && t.folio && t.folio.endsWith('-A');
  const catLower = (t && t.categoria ? t.categoria : (document.getElementById('t-categoria')?.value || '')).trim().toLowerCase();
  const isShippingCategory = !window.esTicketDeServicioEnCampo(t || { categoria: catLower });
  const refHeader = document.getElementById('ref-ticket-info-header');
  const refShippingFields = document.getElementById('ref-ticket-shipping-fields');

  if (isRefTicket) {
    if (refShippingFields) {
      refShippingFields.style.display = 'block';
      window.renderEnvioCards(t);

      const btnAdd = document.getElementById('btn-add-envio');
      if (btnAdd) {
        btnAdd.onclick = () => {
          const envios = t.envios || [];
          envios.push({
            id: Math.random().toString(36).substring(2, 9),
            paqueteria: '',
            guiaPedido: '',
            fechaPedido: '',
            fechaEntrega: '',
            parts: []
          });
          t.envios = envios;
          window.renderEnvioCards(t);
        };
      }
    }
    if (refHeader) {
      refHeader.style.display = 'block';
      document.getElementById('ref-info-cliente').textContent = t.cliente || 'Ninguno';
      document.getElementById('ref-info-sitio').textContent = t.sitio || 'Ninguno';
      document.getElementById('ref-info-solicitante').textContent = t.solicitante || 'Sistema';
      document.getElementById('ref-info-horometro').textContent = (t.horometro && t.horometro !== 'N/A') ? `${t.horometro} h` : 'Ninguno';
      
      const elRefInfoCat = document.getElementById('ref-info-categoria');
      if (elRefInfoCat) {
        elRefInfoCat.textContent = t.categoria || 'Refacción';
      }

      // Populate Service Order client signature date & Order link button
      const assocOrder = window.obtenerOrdenAsociadaTicket(t);
      const elRefCierre = document.getElementById('ref-info-fechacierre');
      if (elRefCierre) {
        let signatureDateStr = 'Pendiente';
        if (assocOrder && assocOrder.firma_cliente_fecha) {
          signatureDateStr = new Date(assocOrder.firma_cliente_fecha).toLocaleDateString();
        }
        elRefCierre.textContent = signatureDateStr;
      }

      const elRefOrdenBtn = document.getElementById('ref-info-orden-btn-container');
      if (elRefOrdenBtn) {
        if (assocOrder && assocOrder.id) {
          elRefOrdenBtn.innerHTML = `
            <button type="button" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.75rem; font-weight:600; color:#2563eb; border:1px solid rgba(37,99,235,0.3); background:rgba(37,99,235,0.08); border-radius:6px; cursor:pointer;">
              <i data-lucide="file-text" style="width:13px;height:13px;"></i> Ver Orden de Servicio (${assocOrder.folio || assocOrder.id})
            </button>
          `;
        } else {
          const parentTicket = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
          if (parentTicket) {
            elRefOrdenBtn.innerHTML = `
              <button type="button" onclick="verDetalleTicket('${parentTicket.id}')" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.75rem; font-weight:600; color:#ea580c; border:1px solid rgba(234,88,12,0.3); background:rgba(234,88,12,0.08); border-radius:6px; cursor:pointer;">
                <i data-lucide="ticket" style="width:13px;height:13px;"></i> Ver Ticket Origen (${parentTicket.folio || parentTicket.id})
              </button>
            `;
          } else {
            elRefOrdenBtn.innerHTML = '';
          }
        }
      }

      // Populate machinery badges
      const refInfoMaq = document.getElementById('ref-info-maquinaria');
      if (refInfoMaq) {
        refInfoMaq.innerHTML = '';
        if (t.equipo) {
          t.equipo.split(', ').forEach(eqName => {
            if (eqName.trim()) {
              const badge = document.createElement('span');
              badge.style.cssText = `
                background: rgba(232, 130, 12, 0.08);
                color: var(--accent);
                border: 1px solid rgba(232, 130, 12, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 0.78rem;
              `;
              badge.textContent = eqName.trim();
              refInfoMaq.appendChild(badge);
            }
          });
        } else {
          refInfoMaq.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Ninguno</span>';
        }
      }
    }

    // Populate parts list in the bottom container
    window.renderTicketRefaccionesList(t);
    window.actualizarVisibilidadDestinoPiezas(t);

    // Hide input groups and generation section
    if (document.getElementById('group-t-cliente')) document.getElementById('group-t-cliente').style.display = 'none';
    if (document.getElementById('group-t-sitio')) document.getElementById('group-t-sitio').style.display = 'none';
    if (document.getElementById('group-t-solicitante')) document.getElementById('group-t-solicitante').style.display = 'none';
    if (document.getElementById('group-t-maquinaria')) document.getElementById('group-t-maquinaria').style.display = 'none';
    if (document.getElementById('group-t-horometro')) document.getElementById('group-t-horometro').style.display = 'none';
    if (document.getElementById('group-t-categoria')) document.getElementById('group-t-categoria').style.display = 'none';
    if (document.getElementById('section-t-origen')) document.getElementById('section-t-origen').style.display = 'none';
    
    // Hide status section for parts tickets
    if (document.getElementById('section-t-estado')) document.getElementById('section-t-estado').style.display = 'none';

    // Force category to 'Refacción' and disable selection
    const catSelect = document.getElementById('t-categoria');
    if (catSelect) {
      catSelect.value = 'Refacción';
      catSelect.disabled = true;
    }
  } else {
    if (refHeader) refHeader.style.display = 'none';
    
    // Los envíos ahora se gestionan centralizadamente desde el módulo de Envíos
    if (refShippingFields) {
      refShippingFields.style.display = 'none';
    }

    if (document.getElementById('ref-ticket-destination-fields')) {
      document.getElementById('ref-ticket-destination-fields').style.display = 'none';
    }
    const refPartsBottom = document.getElementById('ref-ticket-parts-bottom');
    if (refPartsBottom) refPartsBottom.style.display = 'none';

    // Restore input groups and generation section
    if (document.getElementById('group-t-cliente')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('group-t-cliente').style.display = isEmpresa ? 'none' : 'block';
    }
    if (document.getElementById('group-t-solicitante')) {
      document.getElementById('group-t-solicitante').style.display = 'block';
    }
    if (document.getElementById('group-t-maquinaria')) {
      document.getElementById('group-t-maquinaria').style.display = 'block';
    }
    if (document.getElementById('group-t-horometro')) {
      document.getElementById('group-t-horometro').style.display = 'block';
    }
    if (document.getElementById('group-t-categoria')) {
      document.getElementById('group-t-categoria').style.display = 'block';
      const catSelect = document.getElementById('t-categoria');
      if (catSelect) {
        catSelect.disabled = false;
      }
    }
    if (document.getElementById('section-t-origen')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('section-t-origen').style.display = isEmpresa ? 'none' : 'block';
    }
    
    // Restore status section
    if (document.getElementById('section-t-estado')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('section-t-estado').style.display = (id && !isEmpresa) ? 'block' : 'none';
    }

    // Enable category selector
    const catSelect = document.getElementById('t-categoria');
    if (catSelect) {
      catSelect.disabled = false;
    }

    const selectEq = document.getElementById('t-equipo');
    if (selectEq) selectEq.style.display = 'block';
  }

  // Disparar sincronización de categoría y selector de kits para Servicio Técnico
  if (typeof window.alCambiarCategoriaTicket === 'function') {
    window.alCambiarCategoriaTicket();
    if (t && t.categoria === 'Servicio Técnico' && t.kitServicioId && typeof window.seleccionarMachoteTicket === 'function') {
      window.seleccionarMachoteTicket(t.kitServicioId);
    } else if (typeof window.seleccionarMachoteTicket === 'function') {
      window.seleccionarMachoteTicket('');
    }
  }

  document.getElementById('modal-ticket-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.abrirTicketPreloaded = function(datos) {
  // 1. Abrir ticket en modo creación
  abrirTicket(null);
  
  // 2. Rellenar los campos con los datos
  if (datos.asunto) {
    document.getElementById('t-asunto').value = datos.asunto;
  }
  if (datos.solicitante) {
    document.getElementById('t-solicitante').value = datos.solicitante;
  }
  if (datos.cliente) {
    selectComboOption('t-cliente', datos.cliente, datos.cliente);
  }
  if (datos.sitio) {
    const escapedSitio = datos.sitio.replace(/'/g, "\\'");
    selectComboOption('t-sitio', escapedSitio, escapedSitio, true);
  }
  if (datos.descripcion) {
    document.getElementById('t-descripcion').value = datos.descripcion;
  }
  if (datos.notas) {
    document.getElementById('t-notas').value = datos.notas;
  }
  if (datos.prioridad) {
    document.getElementById('t-prioridad').value = datos.prioridad;
  }
  if (datos.area) {
    document.getElementById('t-area').value = datos.area;
  }
  if (datos.categoria) {
    document.getElementById('t-categoria').value = datos.categoria;
  }
  
  // 3. Seleccionar equipos (maquinaria) si vienen
  if (datos.equipo) {
    poblarMaquinasCliente('t-equipo', '', datos.cliente);
    datos.equipo.split(', ').forEach(eqName => {
      if (eqName.trim()) {
        window.agregarMaquinaChip(eqName.trim());
      }
    });
  }
  
  // 4. Inicializar refacciones si vienen
  if (datos.refaccionesSeleccionadas && window.inicializarRefaccionesTicket) {
    window.inicializarRefaccionesTicket(null, datos.refaccionesSeleccionadas);
  }
};

function toggleResolucionTicket() {
  const estado = document.querySelector('input[name="t-estado"]:checked')?.value;
  const isCotizacion = estado === 'Cotización';
  const isCerrado = estado === 'Cerrado';
  
  const group = document.getElementById('group-t-resolucion');
  const groupCierre = document.getElementById('group-t-cierre');
  const inSap = document.getElementById('t-cotizacion-sap');
  
  if (group) group.style.display = (isCotizacion || isCerrado) ? 'block' : 'none';
  if (inSap) inSap.required = isCotizacion;
  
  if (groupCierre) groupCierre.style.display = isCerrado ? 'block' : 'none';
}

function toggleMotivoRechazo() {
  const aceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
  const groupMotivo = document.getElementById('group-t-motivo-rechazo');
  const txtMotivo = document.getElementById('t-motivo-rechazo');
  const groupPedido = document.getElementById('group-t-pedido');
  const inPedidoSap = document.getElementById('t-pedido-sap');
  
  if (groupMotivo) groupMotivo.style.display = (aceptada === 'no') ? 'block' : 'none';
  if (txtMotivo) txtMotivo.required = (aceptada === 'no');
  
  if (groupPedido) groupPedido.style.display = (aceptada === 'si') ? 'block' : 'none';
  if (inPedidoSap) inPedidoSap.required = (aceptada === 'si');

  if (aceptada === 'si' && window.validarPedidoConSAP) {
    window.validarPedidoConSAP(true);
  }
}

function editarTicket(id) { abrirTicket(id); }

function cerrarTicket(e) {
  if (e && e.target !== document.getElementById('modal-ticket-overlay')) return;
  document.getElementById('modal-ticket-overlay').classList.remove('open');
  document.getElementById('t-cliente-menu')?.classList.remove('open');
  document.getElementById('t-cliente-combo')?.classList.remove('focus');
  document.body.style.overflow = '';
  editandoTicketId = null;
  window._levantamientoDeOrigen = null;
}

// ===== HELPER MAQUINARIA Y TICKETS =====
function poblarSoportesPorCliente(clienteNombre, selectedSoporte = '') {
  const elSoporte = document.getElementById('f-soporte');
  if (!elSoporte) return;
  
  elSoporte.innerHTML = '<option value="">Ninguno</option>';
  
  const usedSoportes = ordenes.filter(x => x.id !== editandoId).map(x => x.soporte).filter(Boolean);
  const usedPedidos = ordenes.filter(x => x.id !== editandoId).map(x => x.pedido).filter(Boolean);
  
  let validTickets = [];
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno') {
    validTickets = tickets.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si' && !usedSoportes.includes(t.id) && !usedPedidos.includes(t.pedidoSAP) && t.cliente === clienteNombre);
  }
  
  validTickets.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}`;
    if (t.id === selectedSoporte) opt.selected = true;
    elSoporte.appendChild(opt);
  });
  
  if (selectedSoporte && !Array.from(elSoporte.options).some(o => o.value === selectedSoporte)) {
    const opt = document.createElement('option');
    opt.value = selectedSoporte;
    const t = tickets.find(x => x.id === selectedSoporte);
    opt.textContent = t ? `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}` : selectedSoporte;
    opt.selected = true;
    elSoporte.appendChild(opt);
  }
}

function poblarMaquinasCliente(selectId, selectedValue = '', clienteNombre = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccione una máquina registrada...</option><option value="Otra / No registrada">Otra / Captura manual</option>';
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno' && clienteNombre !== 'Ninguno') {
    const c = clientesDb.find(x => x.nombre === clienteNombre);
    if (c && c.maquinas) {
      c.maquinas.forEach(m => {
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const cleanId = m.idInterno || m.id || '';
        const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
        const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
        const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        const opt = document.createElement('option');
        opt.value = mName;
        opt.textContent = mName;
        if (mName === selectedValue) opt.selected = true;
        opt.setAttribute('data-marca', mFullName);
        opt.setAttribute('data-modelo', m.modelo || '');
        opt.setAttribute('data-serie', m.serie || '');
        opt.setAttribute('data-eco', m.no_economico || '');
        opt.setAttribute('data-ubicacion', m.ubicacion || m.sitio || '');
        select.appendChild(opt);
      });
    }
  }
  
  if (selectedValue && !Array.from(select.options).some(o => o.value === selectedValue) && selectedValue !== 'Otra / No registrada') {
    const opt = document.createElement('option');
    opt.value = selectedValue;
    opt.textContent = `${selectedValue} (Registrado previo)`;
    opt.selected = true;
    select.appendChild(opt);
  }
}

function onEquipoOrdenChange() {
  const select = document.getElementById('f-equipo');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;
  
  if (opt.value === 'Otra / No registrada') {
      const cliente = document.getElementById('f-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
              if (typeof amCliente.onchange === 'function') {
                  amCliente.onchange({ target: amCliente });
              }
              const orderSitio = document.getElementById('f-ubicacion')?.value || '';
              if (orderSitio) {
                  const amUbicacionSelect = document.getElementById('am-ubicacion-select');
                  const amUbicacionOtra = document.getElementById('am-ubicacion-otra');
                  if (amUbicacionSelect) {
                      let exists = false;
                      for (let i = 0; i < amUbicacionSelect.options.length; i++) {
                          if (amUbicacionSelect.options[i].value === orderSitio) {
                              exists = true;
                              break;
                          }
                      }
                      if (exists) {
                          amUbicacionSelect.value = orderSitio;
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                      } else {
                          amUbicacionSelect.value = 'otra';
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                          if (amUbicacionOtra) {
                              amUbicacionOtra.value = orderSitio;
                          }
                      }
                  }
              }
          }
      }, 100);
      return;
  }
  
  const modelo = opt.getAttribute('data-modelo');
  const serie = opt.getAttribute('data-serie');
  const eco = opt.getAttribute('data-eco');
  const ubicacion = opt.getAttribute('data-ubicacion');
  
  if (modelo) document.getElementById('f-modelo').value = modelo;
  if (serie) document.getElementById('f-serie').value = serie;
  if (eco) document.getElementById('f-eco').value = eco;
  
  const inUbicacion = document.getElementById('f-ubicacion');
  if (inUbicacion && ubicacion && !inUbicacion.value) {
    inUbicacion.value = ubicacion;
  }
}

function onEquipoTicketChange() {
  const select = document.getElementById('t-equipo');
  if (!select) return;
  if (select.value === 'Otra / No registrada') {
      const cliente = document.getElementById('t-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
              if (typeof amCliente.onchange === 'function') {
                  amCliente.onchange({ target: amCliente });
              }
              const ticketSitio = document.getElementById('t-sitio')?.value || '';
              if (ticketSitio) {
                  const amUbicacionSelect = document.getElementById('am-ubicacion-select');
                  const amUbicacionOtra = document.getElementById('am-ubicacion-otra');
                  if (amUbicacionSelect) {
                      let exists = false;
                      for (let i = 0; i < amUbicacionSelect.options.length; i++) {
                          if (amUbicacionSelect.options[i].value === ticketSitio) {
                              exists = true;
                              break;
                          }
                      }
                      if (exists) {
                          amUbicacionSelect.value = ticketSitio;
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                      } else {
                          amUbicacionSelect.value = 'otra';
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                          if (amUbicacionOtra) {
                              amUbicacionOtra.value = ticketSitio;
                          }
                      }
                  }
              }
          }
      }, 100);
  }
}



window.onEquipoTicketChangeMultiple = function() {
  const select = document.getElementById('t-equipo');
  if (!select) return;
  const val = select.value;
  if (!val) return;
  
  if (val === 'Otra / No registrada') {
    onEquipoTicketChange(); // Abre modal de registro manual
    return;
  }
  
  window.agregarMaquinaChip(val);
  select.value = ''; // Reset select to let them select more
};

window.actualizarCamposMaquinaOrden = function() {
  const container = document.getElementById('f-equipos-seleccionados');
  if (!container) return;
  const chips = Array.from(container.querySelectorAll('.maquina-chip')).map(c => c.getAttribute('data-value'));
  
  if (chips.length === 0) {
    document.getElementById('f-modelo').value = '';
    document.getElementById('f-serie').value = '';
    document.getElementById('f-eco').value = '';
    return;
  }
  
  const modelos = [];
  const series = [];
  const ecos = [];
  
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const matchMaquina = (m, name) => {
    const cleanId = m.idInterno || m.id || '';
    const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
    const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
    const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
    const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
    return name === mName || name === cleanId || name === m.serie;
  };
  
  chips.forEach(cName => {
    let maq = null;
    clientesDb.forEach(c => {
      if (c.maquinas) {
        const found = c.maquinas.find(m => matchMaquina(m, cName));
        if (found) maq = found;
      }
    });
    if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, cName));
    
    if (maq) {
      if (maq.modelo) modelos.push(maq.modelo);
      if (maq.serie) series.push(maq.serie);
      if (maq.no_economico) ecos.push(maq.no_economico);
    } else {
      if (cName.includes('(SN: ')) {
        const parts = cName.split('(SN: ');
        const s = parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          left = left.substring(left.indexOf(']') + 1).trim();
        }
        modelos.push(left);
        series.push(s);
      } else {
        modelos.push(cName);
      }
    }
  });
  
  document.getElementById('f-modelo').value = [...new Set(modelos)].join(', ');
  document.getElementById('f-serie').value = [...new Set(series)].join(', ');
  document.getElementById('f-eco').value = [...new Set(ecos)].join(', ');
};

window.agregarMaquinaChipOrden = function(maquinaName) {
  if (!maquinaName) return;
  const container = document.getElementById('f-equipos-seleccionados');
  if (!container) return;
  
  const existing = Array.from(container.querySelectorAll('.maquina-chip')).some(c => c.getAttribute('data-value') === maquinaName);
  if (existing) return;
  
  const chip = document.createElement('div');
  chip.className = 'maquina-chip';
  chip.setAttribute('data-value', maquinaName);
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    background: var(--bg-hover, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary, #1f2937);
    gap: 0.25rem;
    box-shadow: var(--shadow-sm);
  `;
  chip.innerHTML = `
    <span>${maquinaName}</span>
    <span onclick="this.parentElement.remove(); window.actualizarCamposMaquinaOrden();" style="cursor:pointer; font-weight:bold; color:var(--red, #ef4444); margin-left:4px; font-size:1.1rem; line-height:1;">&times;</span>
  `;
  container.appendChild(chip);
  window.actualizarCamposMaquinaOrden();
};

window.onEquipoOrdenChangeMultiple = function() {
  const select = document.getElementById('f-equipo');
  if (!select) return;
  const val = select.value;
  if (!val) return;
  
  if (val === 'Otra / No registrada') {
    onEquipoOrdenChange();
    return;
  }
  
  window.agregarMaquinaChipOrden(val);
  select.value = '';
};

// ===== CUSTOM COMBOBOX LOGIC =====
function toggleCombo(id) {
  if (id === 'f-cliente') {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    const soporteId = document.getElementById('f-soporte')?.value;
    let isCerrado = false;
    if (soporteId) {
      const t = tickets.find(x => x.id === soporteId);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      mostrarNotificacion('Solo administradores pueden editar la empresa de la orden.', 'warning');
      return;
    }
    if (isCerrado && currentSession.viewMode !== 'superadmin') {
      mostrarNotificacion('No se puede modificar la empresa porque el ticket asociado ya está cerrado.', 'warning');
      return;
    }
  }

  const menu = document.getElementById(id + '-menu');
  const combo = document.getElementById(id + '-combo');
  const search = document.getElementById(id + '-search');
  
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    combo.classList.remove('focus');
  } else {
    // Cerrar otros menús si hubiera
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
    
    menu.classList.add('open');
    combo.classList.add('focus');
    search.value = '';
    filterCombo(id, ''); // Mostrar todo
    search.focus();
  }
}

function filterCombo(id, query) {
  const q = query.toLowerCase().trim();
  const options = document.querySelectorAll(`#${id}-options .combo-option`);
  let foundMatch = false;
  
  options.forEach(opt => {
    const text = opt.textContent.toLowerCase();
    const code = (opt.dataset.code || '').toLowerCase();
    const desc = (opt.dataset.desc || '').toLowerCase();
    const clave = (opt.dataset.clave || '').toLowerCase();
    if (!q || text.includes(q) || code.includes(q) || desc.includes(q) || clave.includes(q)) {
      opt.style.display = 'block';
      foundMatch = true;
    } else {
      opt.style.display = 'none';
    }
  });

  const addTextSpan = document.getElementById(id + '-add-text');
  if (addTextSpan) {
    const isSitio = id.includes('sitio');
    const entityName = isSitio ? 'sitio' : 'empresa';
    
    if (q && !foundMatch) {
      addTextSpan.textContent = `Crear ${entityName}: "${query}"`;
    } else {
      addTextSpan.textContent = `Crear nuev${isSitio ? 'o' : 'a'} ${entityName}`;
    }
  }
}
window.filterCombo = filterCombo;
window.toggleCombo = toggleCombo;

function selectComboOption(id, value, label, isInitial = false) {
  document.getElementById(id).value = value;
  const displayEl = document.getElementById(id + '-display');
  if (displayEl) displayEl.textContent = label;
  document.getElementById(id + '-menu').classList.remove('open');
  document.getElementById(id + '-combo').classList.remove('focus');

  if (id === 't-cliente') {
    const sitGroup = document.getElementById('group-t-sitio');
    const sitInput = document.getElementById('t-sitio');
    const sitDisplay = document.getElementById('t-sitio-display');
    const sitOptions = document.getElementById('t-sitio-options');
    
    if (!isInitial) {
      poblarMaquinasCliente('t-equipo', '', value);
      const selectedEquiposContainer = document.getElementById('t-equipos-seleccionados');
      if (selectedEquiposContainer) selectedEquiposContainer.innerHTML = '';
    }
    
    if (value && value !== 'Ninguno' && value !== 'Ninguno / Uso Interno') {
      if (sitGroup) sitGroup.style.display = 'block';
      if (sitInput && !isInitial) sitInput.value = '';
      if (sitDisplay && !isInitial) sitDisplay.textContent = 'Ninguno';
      
      if (sitOptions) {
        sitOptions.innerHTML = '<div class="combo-option" onclick="selectComboOption(\'t-sitio\', \'\', \'Ninguno\')">Ninguno</div>';
        const c = (clientesDb || []).find(x => x.nombre === value || x.id === value || x.idInterno === value || x.rfc === value);
        const sitios = getNombresDeSitiosParaCliente(c || value);
        sitios.forEach(sn => {
          const escapedSn = sn.replace(/'/g, "\\'").replace(/"/g, '&quot;');
          sitOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-sitio', '${escapedSn}', '${escapedSn}')">${sn}</div>`;
        });
      }
    } else {
      if (sitGroup) sitGroup.style.display = 'none';
      if (sitInput) sitInput.value = '';
      if (sitDisplay) sitDisplay.textContent = 'Ninguno';
    }
  } else if (id === 'f-cliente') {
    if (!isInitial) {
      poblarMaquinasCliente('f-equipo', '', value);
      poblarSoportesPorCliente(value, '');
      const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
      if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
    }
  } else if (id === 'pt-orden') {
    for (let i = 0; i <= 6; i++) {
      const sel = document.getElementById(`pt-orden-dia-${i}`);
      if (sel) {
        selectComboOption(`pt-orden-dia-${i}`, value, label, true);
      }
    }
  }
}
window.selectComboOption = selectComboOption;

function agregarSitioCombo(id) {
  const cName = document.getElementById('t-cliente')?.value;
  if (!cName || cName === 'Ninguno' || cName === 'Ninguno / Uso Interno') {
    mostrarNotificacion('Primero selecciona una Empresa (Cliente).', 'warning');
    return;
  }
  const q = document.getElementById('t-sitio-search')?.value.trim() || '';
  agregarSitioCliente(cName);
  if (q) {
    document.getElementById('s-sitio-nombre').value = q;
  }
  document.getElementById('t-sitio-menu').classList.remove('open');
  document.getElementById('t-sitio-combo').classList.remove('focus');
  window._addingSiteFromTicket = true;
}

function agregarEmpresaCombo(id) {
  const searchVal = document.getElementById(id + '-search').value.trim();
  const nombreEmpresa = searchVal || prompt('Ingresa el nombre de la nueva empresa:');
  
  if (!nombreEmpresa) return;

  // Registrar localmente como cliente legacy para que aparezca
  // Si desean crearle toda la metadata, deberán ir a Clientes > Nuevo Cliente
  // Aquí la damos de alta de forma rápida
  
  let clienteObj = clientesDb.find(c => c.nombre.toLowerCase() === nombreEmpresa.toLowerCase());
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombreEmpresa,
      maquinas: []
    };
    clientesDb.push(clienteObj);
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }

  // Refrescar el combo y seleccionar
  abrirTicket(editandoTicketId); // Esto recargará las opciones con el valor previo mantenido
  selectComboOption(id, nombreEmpresa, nombreEmpresa);
}

// Cerrar combobox si hacen click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('.form-group')) {
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
  }
});

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function guardarTicket(e) {
  e.preventDefault();
  const t_existente = editandoTicketId ? tickets.find(x=>x.id===editandoTicketId) : null;
  const isEmpresa = currentSession.viewMode === 'empresa';
  const estado = (isEmpresa || !editandoTicketId) ? 'Abierto' : (document.querySelector('input[name="t-estado"]:checked')?.value || 'Abierto');
  // Preservar canal y contacto de portal si se edita desde el panel administrativo
  let canal = isEmpresa ? 'portal' : (document.querySelector('input[name="t-canal"]:checked')?.value || '');
  if (!isEmpresa && editandoTicketId && !canal && t_existente?.canal === 'portal') {
    canal = 'portal';
  }

  let contacto = '';
  if (!isEmpresa) {
    if (canal === 'correo') contacto = document.getElementById('t-correo')?.value?.trim();
    else if (canal === 'whatsapp') contacto = document.getElementById('t-whatsapp')?.value?.trim();
    else if (canal === 'telefono') contacto = document.getElementById('t-telefono')?.value?.trim();
    else if (canal === 'portal' && editandoTicketId && t_existente?.contacto) {
      contacto = t_existente.contacto;
    }
  } else {
    // Si es empresa, el contacto es su propio correo si existe
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    contacto = currentUser ? currentUser.email : '';
  }
  
  if (!isEmpresa) {
    const asignadoVal = document.getElementById('t-asignado').value.trim();
    if (!asignadoVal) {
      mostrarNotificacion('Debe seleccionar a quién va asignado el ticket.', 'error');
      return;
    }
    const clienteVal = document.getElementById('t-cliente').value.trim();
    if (!clienteVal) {
      mostrarNotificacion('Debe seleccionar la Empresa / Cliente afectada.', 'error');
      return;
    }
  }
  
  const categoriaVal = document.getElementById('t-categoria')?.value || '';
  const isGarantiaInterna = (categoriaVal === 'Garantía Interna' || t_existente?.categoria === 'Garantía Interna');
  
  if (!isEmpresa && (estado === 'Cotización' || estado === 'Cerrado') && !isGarantiaInterna) {
    // Si la lista de cotizaciones está vacía, intentar vincular los valores actuales de los inputs
    if (!window.editandoCotizaciones || window.editandoCotizaciones.length === 0) {
      const sapInputVal = document.getElementById('t-cotizacion-sap')?.value.trim();
      const montoInputVal = document.getElementById('t-cotizacion-monto')?.value.trim();
      if (sapInputVal || montoInputVal) {
        await window.vincularNuevaCotizacion(true);
      }
    }

    const bypassQuote = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
    if (!bypassQuote && (!window.editandoCotizaciones || window.editandoCotizaciones.length === 0)) {
      mostrarNotificacion('Debe vincular al menos una cotización de SAP para este ticket.', 'error');
      return;
    }
  }

  if (!isEmpresa && estado === 'Cerrado' && !isGarantiaInterna) {
    const cotAceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
    const motivoRechazo = document.getElementById('t-motivo-rechazo')?.value.trim() || '';
    const pedidoSAP = document.getElementById('t-pedido-sap')?.value.trim() || '';
    const pedidoPdfUpload = document.getElementById('t-pedido-pdf')?.files.length > 0;
    
    if (!cotAceptada) {
      mostrarNotificacion('Debe indicar si la cotización fue aceptada o rechazada para cerrar el ticket.', 'error');
      return;
    }
    
    if (cotAceptada === 'no' && !motivoRechazo) {
      mostrarNotificacion('Debe especificar el motivo del rechazo.', 'error');
      return;
    }
    
    if (cotAceptada === 'si') {
      const bypass = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      if (!bypass) {
        if (!pedidoSAP) {
          mostrarNotificacion('Debe ingresar el Número de Pedido SAP para cerrar una cotización aceptada.', 'error');
          return;
        }
        if (!pedidoPdfUpload && !t_existente?.pdfPedido) {
          mostrarNotificacion('Debe adjuntar el archivo PDF del pedido para cerrar la cotización aceptada.', 'error');
          return;
        }
        if (window._isPedidoSapBlocked) {
          mostrarNotificacion('No se puede guardar el ticket debido a una discrepancia crítica entre el PDF y SAP.', 'error');
          return;
        }
      }
    }
  }

  let pdfPedidoBase64 = t_existente ? t_existente.pdfPedido : null;
  const pedidoPdfInput = document.getElementById('t-pedido-pdf');
  if (pedidoPdfInput && pedidoPdfInput.files.length > 0) {
    try { pdfPedidoBase64 = await readFileAsBase64(pedidoPdfInput.files[0]); } catch(e){}
  }

  let pdfCotizacionBase64 = t_existente ? t_existente.pdfCotizacion : null;
  const cotPdfInput = document.getElementById('t-cotizacion-pdf');
  if (cotPdfInput && cotPdfInput.files.length > 0) {
    try { pdfCotizacionBase64 = await readFileAsBase64(cotPdfInput.files[0]); } catch(e){}
  }

  let newFolio = '';
  if (!editandoTicketId) {
    const isTest = isTestModeActive();
    if (typeof window.obtenerSiguienteFolioTicket === 'function') {
      newFolio = await window.obtenerSiguienteFolioTicket(isTest);
    } else {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const prefix = isTest ? `TKT-PRUEBA-` : `TKT-${yearStr}`;
      const ticketsDelAnio = tickets.filter(t => t && t.folio && t.folio.startsWith(prefix));
      let maxConsecutivo = 0;
      ticketsDelAnio.forEach(t => {
        const numStr = t.folio.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
      });
      newFolio = `${prefix}${(maxConsecutivo + 1).toString().padStart(3, '0')}`;
    }
  }

  let asuntoVal = document.getElementById('t-asunto').value.trim();
  if (!editandoTicketId && isTestModeActive()) {
    if (asuntoVal && !asuntoVal.startsWith('[PRUEBA]')) {
      asuntoVal = `[PRUEBA] ${asuntoVal}`;
    }
  }

  let equipoVal = '';
  const chips = Array.from(document.querySelectorAll('#t-equipos-seleccionados .maquina-chip')).map(c => c.getAttribute('data-value'));
  if (chips.length > 0) {
    equipoVal = chips.join(', ');
  } else {
    equipoVal = document.getElementById('t-equipo')?.value?.trim() || '';
  }
  
  if (!equipoVal) {
    mostrarNotificacion('Debe seleccionar al menos una máquina afectada.', 'error');
    return;
  }

  let enviosVal = [];
  let paqueteriaVal = '';
  let guiaVal = '';
  let fPedidoVal = '';
  let fEntregaVal = '';

  let destinoPdfUrl = t_existente ? t_existente.destinoPdfUrl : '';
  const isRefTicket = t_existente && t_existente.folio && t_existente.folio.endsWith('-A');
  if (isRefTicket || (document.getElementById('ref-ticket-shipping-fields') && document.getElementById('ref-ticket-shipping-fields').style.display !== 'none')) {
    enviosVal = window.obtenerEnviosDesdeDOM();
    for (let i = 0; i < enviosVal.length; i++) {
      if (enviosVal[i].llego && !enviosVal[i].fechaLlegada) {
        mostrarNotificacion(`Debe seleccionar la fecha en la que fue entregada la Guía/Envío #${i + 1}`, 'error');
        return;
      }
    }
    const destContainer = document.getElementById('ref-ticket-destination-fields');
    const selectDest = document.getElementById('ref-destino-piezas');
    if (destContainer && destContainer.style.display !== 'none') {
      if (selectDest && !selectDest.value) {
        mostrarNotificacion('Debe seleccionar si las piezas entregadas serán instaladas o enviadas al cliente.', 'error');
        return;
      }
    }
    const first = enviosVal[0] || {};
    paqueteriaVal = first.paqueteria || '';
    guiaVal = first.guiaPedido || '';
    fPedidoVal = first.fechaPedido || '';
    fEntregaVal = first.fechaEntrega || '';

    const destinoPdfInput = document.getElementById('ref-destino-pdf-file');
    if (destinoPdfInput && destinoPdfInput.files.length > 0) {
      try {
        const file = destinoPdfInput.files[0];
        const base64 = await readFileAsBase64(file);
        mostrarNotificacion('Subiendo PDF de destino...', 'info');
        const filename = `destino_${editandoTicketId || crypto.randomUUID()}_${Date.now()}.pdf`;
        const fullPath = `tickets/destino_pdf/${filename}`;
        const publicUrl = await window.uploadBase64ToStorage(base64, 'evidencias', fullPath);
        if (publicUrl) {
          destinoPdfUrl = publicUrl;
        } else {
          throw new Error('No se pudo subir el archivo PDF.');
        }
      } catch (e) {
        console.error('[Destino PDF Upload] Error:', e);
        mostrarNotificacion('Falla al subir PDF de destino: ' + e.message, 'error');
        return;
      }
    }
  }

  const destinoPrecioVal = document.getElementById('ref-destino-precio')?.value || '';

  const catSeleccionada = document.getElementById('t-categoria')?.value || '';
  const kitIdSeleccionado = (catSeleccionada === 'Servicio Técnico') 
    ? (document.getElementById('t-kit-servicio-select')?.value || '') 
    : '';
  const kitObj = window._ticketKitSeleccionado || (kitIdSeleccionado ? (window.loadKitsServicio() || []).find(k => k.id === kitIdSeleccionado) : null);
  const kitNombreSeleccionado = (kitObj && kitIdSeleccionado) 
    ? kitObj.nombre 
    : (t_existente ? (t_existente.kitServicioNombre || '') : '');

  let refaccionesFinales = t_existente ? (t_existente.refaccionesSeleccionadas || []) : [];
  if (kitObj && kitIdSeleccionado && refaccionesFinales.length === 0) {
    refaccionesFinales = (kitObj.piezas || []).map(p => ({
      clave: p.codigo || p.clave || 'S/C',
      codigo: p.codigo || p.clave || 'S/C',
      nombre: p.descripcion || p.nombre || 'Sin Descripción',
      descripcion: p.descripcion || p.nombre || 'Sin Descripción',
      marca: p.marca || kitObj.marca || '',
      cantidad: parseInt(p.cantidad, 10) || 1,
      estatusPedido: 'Por Pedir'
    }));
  }

  const ticket = {
    id: editandoTicketId || crypto.randomUUID(),
    folio: editandoTicketId ? t_existente?.folio : newFolio,
    fecha: t_existente ? t_existente.fecha : new Date().toISOString(),
    fechaCreacion: t_existente ? t_existente.fechaCreacion : new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    modificadoPor: window.getCurrentUserDisplayName ? window.getCurrentUserDisplayName() : (usuarios.find(u => u.id === currentSession.userId)?.nombre || 'Usuario'),
    fechaCierre: estado === 'Cerrado' ? (t_existente?.fechaCierre || new Date().toISOString()) : null,
    canal,
    contacto,
    asunto: asuntoVal,
    cliente: document.getElementById('t-cliente')?.value || '',
    sitio: document.getElementById('t-sitio')?.value || '',
    solicitante: document.getElementById('t-solicitante').value.trim(),
    creadoPor: t_existente ? (t_existente.creadoPor || t_existente.solicitante) : (usuarios.find(u => u.id === currentSession.userId)?.nombre || ''),
    area: document.getElementById('t-area').value,
    categoria: catSeleccionada,
    prioridad: document.getElementById('t-prioridad').value,
    asignado: document.getElementById('t-asignado').value.trim(),
    descripcion: document.getElementById('t-descripcion').value.trim(),
    equipo: equipoVal,
    horometro: document.getElementById('t-horometro')?.value.trim() || '',
    notas: document.getElementById('t-notas').value.trim(),
    kitServicioId: kitIdSeleccionado || (t_existente ? (t_existente.kitServicioId || '') : ''),
    kitServicioNombre: kitNombreSeleccionado || (t_existente ? (t_existente.kitServicioNombre || '') : ''),
    estado,
    cotizacionSAP: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones[0].sap : '',
    montoCotizacion: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones.reduce((sum, c) => sum + (Number(c.monto) || 0), 0) : null,
    cotAceptada: document.querySelector('input[name="t-cot-aceptada"]:checked')?.value || '',
    motivoRechazo: document.getElementById('t-motivo-rechazo')?.value.trim() || '',
    pedidoSAP: document.getElementById('t-pedido-sap')?.value.trim() || '',
    tecnicosAsignados: [],
    pdfPedido: pdfPedidoBase64,
    pdfCotizacion: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones[0].pdf : null,
    cotizacionesAdicionales: window.editandoCotizaciones || [],
    comentariosInternos: t_existente ? (t_existente.comentariosInternos || []) : [],
    esPrueba: t_existente ? (t_existente.esPrueba || false) : isTestModeActive(),
    refaccionesSeleccionadas: refaccionesFinales,
    guiaPedido: guiaVal || (t_existente ? (t_existente.guiaPedido || '') : ''),
    paqueteria: paqueteriaVal || (t_existente ? (t_existente.paqueteria || '') : ''),
    fechaPedido: fPedidoVal || (t_existente ? (t_existente.fechaPedido || '') : ''),
    fechaEntrega: fEntregaVal || (t_existente ? (t_existente.fechaEntrega || '') : ''),
    envios: (enviosVal && enviosVal.length > 0) ? enviosVal : (t_existente ? (t_existente.envios || []) : []),
    destinoPiezas: document.getElementById('ref-destino-piezas')?.value || '',
    destinoPrecio: destinoPrecioVal,
    destinoPdfUrl: destinoPdfUrl
  };

  // Actualizar ubicación de la máquina si es N/A o vacía
  if (ticket.equipo && ticket.equipo !== 'Otra / No registrada' && ticket.sitio && ticket.sitio !== 'Ninguno') {
    const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
    
    const matchMaquina = (m) => {
      const cleanId = m.idInterno || m.id || '';
      if (!cleanId) return false;
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
      const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      
      const equipoString = ticket.equipo || '';
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

    let maqModificada = false;

    // Buscar en clientesDb
    clientesDb.forEach(c => {
      if (c.maquinas) {
        c.maquinas.forEach(m => {
          if (matchMaquina(m)) {
            const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
            if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
              console.log(`[Ticket] Asignando ubicación '${ticket.sitio}' a máquina manual ${m.idInterno} según ticket`);
              m.ubicacion = ticket.sitio;
              
              // Resolver sitio_id
              let sitioId = m.sitio_id || null;
              const existSitio = sitiosDb.find(s => (s.cliente === c.id || s.cliente === c.nombre) && s.nombre === ticket.sitio);
              if (existSitio) sitioId = existSitio.id;
              m.sitio_id = sitioId;
              
              maqModificada = true;
              if (window.pushToSupabase) {
                window.pushToSupabase('maquinaria', { ...m, cliente: c.id });
              }
            }
          }
        });
      }
    });

    // Buscar en maquinariaDb
    maquinariaDb.forEach(m => {
      if (matchMaquina(m)) {
        const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
        if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
          console.log(`[Ticket] Asignando ubicación '${ticket.sitio}' a máquina SAP ${m.idInterno || m.id} según ticket`);
          m.ubicacion = ticket.sitio;
          
          // Resolver sitio_id
          let clientObj = clientesDb.find(c => c.nombre === m.cliente || c.id === m.cliente);
          let clientDbId = clientObj ? clientObj.id : m.cliente;
          let sitioId = m.sitio_id || null;
          const existSitio = sitiosDb.find(s => (s.cliente === clientDbId || s.cliente === m.cliente) && s.nombre === ticket.sitio);
          if (existSitio) sitioId = existSitio.id;
          m.sitio_id = sitioId;
          
          if (!m.customData) m.customData = {};
          m.customData.ubicacion = ticket.sitio;
          
          maqModificada = true;
          if (window.pushToSupabase) {
            window.pushToSupabase('maquinaria', m);
          }
        }
      }
    });

    if (maqModificada) {
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
    }
  }
  
  if (isEmpresa && !editandoTicketId && !ticket.asignado) {
    const c = clientesDb.find(x => x.nombre === ticket.cliente);
    if (c) {
      if (c.supervisoresAsignados && c.supervisoresAsignados.length > 0) {
        ticket.asignado = c.supervisoresAsignados.map(id => usuarios.find(u => u.id === id)?.nombre).filter(Boolean).join(', ');
      } else if (c.supervisorAsignado) {
        const supUser = usuarios.find(u => u.id === c.supervisorAsignado);
        if (supUser) ticket.asignado = supUser.nombre;
      }
    }
  }

  // Detectar cambio de responsable para notificaciones internas
  const oldAsignado = t_existente ? (t_existente.asignado || 'Sin asignar') : 'Sin asignar';
  const newAsignado = ticket.asignado || 'Sin asignar';
  if (String(oldAsignado).trim().toLowerCase() !== String(newAsignado).trim().toLowerCase()) {
    if (typeof window.generarNotificacionInterna === 'function') {
      window.generarNotificacionInterna(ticket, oldAsignado, newAsignado);
    }
  }

  if (editandoTicketId) {
    tickets = tickets.map(t => t.id === editandoTicketId ? ticket : t);
  } else {
    tickets.unshift(ticket);
  }
  
  // Guardar SIEMPRE en local como respaldo (con try-catch para evitar que un PDF gigante rompa la subida a la nube)
  try {
    safeSetJSON('sapi_tickets', tickets);
  } catch (err) {
    console.error('Error al guardar en localStorage (¿exceso de cuota por PDF?):', err);
    mostrarNotificacion('El archivo adjunto es muy pesado para la memoria local, pero intentaremos subirlo a la nube.', 'error');
  }
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', ticket);
  }

  // Sincronizar automáticamente con la Orden de Servicio vinculada si existe
  try {
    const assocOrd = (typeof window.obtenerOrdenAsociadaTicket === 'function')
      ? window.obtenerOrdenAsociadaTicket(ticket)
      : (typeof ordenes !== 'undefined' && Array.isArray(ordenes) ? ordenes.find(o => o && (o.soporte === ticket.id || o.soporte === ticket.folio || o.id === ticket.ordenId || o.folio === ticket.ordenFolio)) : null);

    if (assocOrd) {
      let ordMod = false;
      const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(ticket) : '';
      const cliTarget = resolvedCli || ticket.cliente;
      if (cliTarget && assocOrd.cliente !== cliTarget) {
        assocOrd.cliente = cliTarget;
        ordMod = true;
      }
      if (ticket.sitio && assocOrd.ubicacion !== ticket.sitio) {
        assocOrd.ubicacion = ticket.sitio;
        ordMod = true;
      }
      if (ticket.asignado && ticket.asignado !== 'Sin asignar' && ticket.asignado !== '-') {
        if (assocOrd.tecnico !== ticket.asignado) {
          assocOrd.tecnico = ticket.asignado;
          assocOrd.tecnicosAsignados = ticket.asignado.split(',').map(s => s.trim()).filter(Boolean);
          ordMod = true;
        }
      }
      if (ticket.categoria) {
        const tipoTarget = ticket.categoria === 'Servicio Técnico' ? 'Servicio' : ticket.categoria;
        if (assocOrd.tipo !== tipoTarget) {
          assocOrd.tipo = tipoTarget;
          ordMod = true;
        }
      }
      if (ticket.equipo && assocOrd.equipo !== ticket.equipo) {
        assocOrd.equipo = ticket.equipo;
        ordMod = true;
      }
      if (!assocOrd.soporte) {
        assocOrd.soporte = ticket.id || ticket.folio;
        ordMod = true;
      }
      if (ordMod) {
        assocOrd._synced = false;
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          await window.pushToSupabase('ordenes', assocOrd);
        }
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    }
  } catch (errSyncOrd) {
    console.warn('[Ticket] Error al sincronizar orden vinculada:', errSyncOrd);
  }

  // Generar Orden de Servicio automáticamente solo si es de Servicio en campo (NO para Garantías ni Refacciones)
  if (estado === 'Cerrado' && ticket.cotAceptada === 'si') {
    if (window.esTicketDeServicioEnCampo(ticket)) {
      const ordenExistente = ordenes.find(o => o.soporte === ticket.id);
      if (!ordenExistente) {
        let modeloStr = '';
        let serieStr = '';
        let marcaStr = '';
        let ecoStr = '';
        let maquinariaId = null;

        if (ticket.equipo) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          
          const matchMaquina = (m, name) => {
            const cleanId = m.idInterno || m.id || '';
            const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
            const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
            const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
            const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
            
            return (
              name === mName ||
              name === cleanId ||
              name === m.serie ||
              name.includes(cleanId) ||
              (m.serie && name.includes(m.serie))
            );
          };

          const eqNames = ticket.equipo.split(', ');
          const modelosArr = [];
          const seriesArr = [];
          const marcasArr = [];
          const ecosArr = [];

          eqNames.forEach(eqName => {
            let maq = null;
            clientesDb.forEach(c => {
              if (c.maquinas) {
                const found = c.maquinas.find(m => matchMaquina(m, eqName));
                if (found) maq = found;
              }
            });
            if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, eqName));

            if (maq) {
              if (maq.modelo) modelosArr.push(maq.modelo);
              if (maq.serie) seriesArr.push(maq.serie);
              if (maq.marca) marcasArr.push(maq.marca);
              if (maq.no_economico) ecosArr.push(maq.no_economico);
              if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
            } else {
              if (eqName.includes('(SN: ')) {
                const parts = eqName.split('(SN: ');
                const s = parts[1].replace(')', '').trim();
                let left = parts[0].trim();
                if (left.startsWith('[') && left.includes(']')) {
                  left = left.substring(left.indexOf(']') + 1).trim();
                }
                modelosArr.push(left);
                seriesArr.push(s);
              } else {
                modelosArr.push(eqName);
              }
            }
          });

          modeloStr = [...new Set(modelosArr)].join(', ');
          serieStr = [...new Set(seriesArr)].join(', ');
          marcaStr = [...new Set(marcasArr)].join(', ');
          ecoStr = [...new Set(ecosArr)].join(', ');
        }

        let newFolio = generarFolioConsecutivo();
        const isTest = isTestData(ticket) || isTestModeActive();
        if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
          newFolio = `[PRUEBA] ${newFolio}`;
        }

        let orderTecnicos = [...(ticket.tecnicosAsignados || [])];
        if (orderTecnicos.length === 0 && ticket.asignado) {
          orderTecnicos = ticket.asignado.split(',').map(s => s.trim()).filter(Boolean);
        }

        const nuevaOrden = {
          id: newFolio,
          fecha: getLocalDateString(),
          folio: newFolio,
          pedido: ticket.pedidoSAP || '',
          cliente: ticket.cliente || '',
          ubicacion: ticket.sitio || '',
          ubicacion_sitio: '',
          operador: '',
          eco: ecoStr || '',
          horometro: '',
          modelo: modeloStr,
          serie: serieStr,
          marca: marcaStr || '',
          maquinaria_id: maquinariaId || null,
          equipo: ticket.equipo || '',
          tecnico: orderTecnicos.join(', '),
          tecnicosAsignados: orderTecnicos,
          soporte: ticket.id,
          km_ida: '', km_vuelta: '', km_total: '',
          tipo: 'Servicio',
          estado: 'Pendiente',
          falla: (ticket.asunto ? ticket.asunto + '\n' : '') + (ticket.descripcion || ''),
          trabajos: '', dictamen: '', condiciones: '',
          observaciones: '', pendientes: '',
          ref_utilizadas: [], ref_necesarias: [],
          factura_ref: '', factura_mo: '',
          noches: '', alimentacion: '', traslado_costo: '',
          dias: [],
          esPrueba: isTest,
        };

        ordenes.unshift(nuevaOrden);
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          await window.pushToSupabase('ordenes', nuevaOrden);
        }
        mostrarNotificacion('Orden de servicio pre-cargada y generada.', 'success');
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    } else {
      mostrarNotificacion(`Ticket de ${ticket.categoria || 'Garantía / Refacciones'} procesado para Guía de Envío / Despacho.`, 'info');
    }
  }

  // Asegurar generación automática de Guía de Envío si el ticket tiene refacciones
  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    const isRefCat = String(ticket.categoria || '').toLowerCase().includes('refacci') || String(ticket.categoria || '').toLowerCase().includes('garant') || (ticket.folio && ticket.folio.endsWith('-A'));
    if (isRefCat || (ticket.refaccionesSeleccionadas && ticket.refaccionesSeleccionadas.length > 0)) {
      window.asegurarGuiaEnvioParaTicket(ticket);
    }
  }

  if (window._levantamientoDeOrigen) {
    const lev = window._levantamientoDeOrigen;
    lev.estado = 'Completado';
    lev.ticket_generado_id = ticket.id;
    lev._synced = false;
    
    if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
    if (window.supabaseClient) {
      // Actualizar solo el estado y el id del ticket generado en Supabase para no sobreescribir las evidencias
      await window.supabaseClient.from('levantamientos')
        .update({ estado: 'Completado', ticket_generado_id: ticket.id })
        .eq('id', lev.id);
    }
    if (typeof renderLevantamientos === 'function') {
      renderLevantamientos();
    }
    window._levantamientoDeOrigen = null;
    mostrarNotificacion('Levantamiento completado y vinculado al ticket.', 'success');
  }
  if (window.trackTelemetryEvent) {
    const act = editandoTicketId ? 'Edición de Ticket' : 'Creación de Ticket';
    window.trackTelemetryEvent(act, { folio: ticket.folio, asunto: ticket.asunto });
  }
  cerrarTicket();
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
  if (typeof renderRefaccionesPendientes === 'function') {
    renderRefaccionesPendientes();
  }
}

async function eliminarTicket(id) {
  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Ticket',
    mensaje: '¿Estás seguro de que deseas eliminar este ticket?',
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;
  const t = tickets.find(x => x.id === id);
  const folio = t ? t.folio : 'Desconocido';

  tickets = tickets.filter(t => t.id !== id);
  safeSetJSON('sapi_tickets', tickets);
  
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('tickets', id);
  }
  if (window.trackTelemetryEvent) {
    window.trackTelemetryEvent('Eliminación de Ticket', { id, folio });
  }
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
}

// ===== COMENTARIOS INTERNOS Y EXTERNOS HELPER FUNCTIONS =====
window.renderComentariosInternosHtml = function(t) {
  const isClientView = ['empresa', 'cliente', 'cliente-consultor'].includes(window.currentSession?.viewMode);
  
  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const currentUserName = currentUser ? currentUser.nombre : '';

  // 1. Renderizar lista de comentarios internos (para staff)
  let listInternosHtml = '';
  if (!isClientView) {
    listInternosHtml = (t.comentariosInternos && t.comentariosInternos.length > 0)
      ? t.comentariosInternos.map(c => {
          const isMe = c.usuario === currentUserName;
          const alignStyle = isMe
            ? 'align-self: flex-end; background: rgba(232, 130, 12, 0.08); border-left: 3px solid var(--accent);'
            : 'align-self: flex-start; background: var(--bg-card); border-left: 3px solid var(--border);';
          
          const lectores = Array.isArray(c.leidoPor)
            ? c.leidoPor.map(l => {
                if (typeof l === 'string') return l;
                if (l && l.usuario) {
                  const fStr = l.fecha ? formatFechaHoraAmigable(l.fecha) : '';
                  return fStr ? `${l.usuario} (${fStr})` : l.usuario;
                }
                return null;
              }).filter(Boolean)
            : [];
          
          const otrosLectores = lectores.filter(l => !l.startsWith(c.usuario));
          let leidoHtml = '';
          if (otrosLectores.length > 0) {
            leidoHtml = `
              <div style="margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: #10b981; font-weight: 500;">
                <i data-lucide="check-check" style="width: 12px; height: 12px; color: #10b981; flex-shrink:0;"></i>
                <span>Leído por: <strong style="color: var(--text-primary);">${otrosLectores.join(', ')}</strong></span>
              </div>
            `;
          } else {
            leidoHtml = `
              <div style="margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: var(--text-muted); opacity: 0.7;">
                <i data-lucide="check" style="width: 12px; height: 12px; flex-shrink:0;"></i>
                <span>No leído aún por otros</span>
              </div>
            `;
          }

          return `
            <div style="max-width: 85%; padding: 0.6rem 0.8rem; border-radius: 8px; box-shadow: var(--shadow-sm); ${alignStyle}">
              <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; align-items: center;">
                <span style="font-weight: 700; font-size: 0.75rem; color: ${isMe ? 'var(--accent)' : 'var(--text-primary)'};">${c.usuario}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${formatFechaHoraAmigable(c.fecha)}</span>
              </div>
              <div style="font-size: 0.85rem; white-space: pre-wrap; color: var(--text-primary); line-height: 1.35; font-family: inherit;">${c.texto}</div>
              ${leidoHtml}
            </div>
          `;
        }).join('')
      : `<div style="text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.8rem; padding: 1.5rem 0;">No hay comentarios de seguimiento registrados en este ticket.</div>`;
  }

  // 2. Renderizar lista de comentarios externos (clientes)
  const listClientesHtml = (t.comentariosClientes && t.comentariosClientes.length > 0)
    ? t.comentariosClientes.map(c => {
        const isMe = c.usuario === currentUserName || c.usuario === 'Soporte' || c.usuario === 'EuroRep';
        const alignStyle = isMe
          ? 'align-self: flex-end; background: rgba(232, 130, 12, 0.08); border-left: 3px solid var(--accent);'
          : 'align-self: flex-start; background: var(--bg-card); border-left: 3px solid var(--border);';
        
        return `
          <div style="max-width: 85%; padding: 0.6rem 0.8rem; border-radius: 8px; box-shadow: var(--shadow-sm); ${alignStyle}">
            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; align-items: center;">
              <span style="font-weight: 700; font-size: 0.75rem; color: ${isMe ? 'var(--accent)' : 'var(--text-primary)'};">${c.usuario}</span>
              <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${formatFechaHoraAmigable(c.fecha)}</span>
            </div>
            <div style="font-size: 0.85rem; white-space: pre-wrap; color: var(--text-primary); line-height: 1.35; font-family: inherit;">${c.texto}</div>
          </div>
        `;
      }).join('')
    : `<div style="text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.8rem; padding: 1.5rem 0;">No hay comentarios de cliente registrados en este ticket.</div>`;

  if (isClientView) {
    // Si es vista cliente, mostrar únicamente los externos
    return `
      <div class="detalle-section" style="border-top:1px dashed var(--border); padding-top:1.25rem; margin-top:1.5rem;">
        <div class="detalle-section-title" style="display:flex; align-items:center; gap:0.5rem; text-transform: uppercase;"><i data-lucide="message-square" style="width:16px;height:16px;"></i> Comentarios y Mensajes</div>
        
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listClientesHtml}
        </div>

        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment-externo" placeholder="Escribe un mensaje para soporte..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioExterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>
    `;
  }

  // Vista staff: Mostrar interfaz con pestañas
  const activeTab = window._activeCommentTab || 'internos';
  const isInternosActive = activeTab === 'internos';
  
  const tabInternosBtnStyle = isInternosActive
    ? 'color: var(--accent); border-bottom: 2px solid var(--accent); font-weight: 700;'
    : 'color: var(--text-muted); border-bottom: 2px solid transparent; font-weight: 600;';
    
  const tabExternosBtnStyle = !isInternosActive
    ? 'color: var(--accent); border-bottom: 2px solid var(--accent); font-weight: 700;'
    : 'color: var(--text-muted); border-bottom: 2px solid transparent; font-weight: 600;';

  const containerInternosDisplay = isInternosActive ? 'block' : 'none';
  const containerExternosDisplay = !isInternosActive ? 'block' : 'none';

  return `
    <div class="detalle-section" style="border-top:1px dashed var(--border); padding-top:1.25rem; margin-top:1.5rem;">
      <!-- Cabecera de Pestañas -->
      <div class="comments-tab-header" style="display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1rem; gap: 1rem;">
        <button type="button" id="tab-btn-internos" onclick="window.switchCommentTab('internos')" style="background: none; border: none; padding: 0.5rem 1rem; ${tabInternosBtnStyle} font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem; outline: none;">
          <i data-lucide="lock" style="width:14px; height:14px;"></i> Comentarios Internos
        </button>
        <button type="button" id="tab-btn-externos" onclick="window.switchCommentTab('externos')" style="background: none; border: none; padding: 0.5rem 1rem; ${tabExternosBtnStyle} font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem; outline: none;">
          <i data-lucide="message-square" style="width:14px; height:14px;"></i> Visibles para Cliente
        </button>
      </div>

      <!-- Contenedor Comentarios Internos -->
      <div id="comments-container-internos" style="display: ${containerInternosDisplay};">
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listInternosHtml}
        </div>
        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment" placeholder="Escribe un comentario interno..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioInterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>

      <!-- Contenedor Comentarios Externos -->
      <div id="comments-container-externos" style="display: ${containerExternosDisplay};">
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listClientesHtml}
        </div>
        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment-externo" placeholder="Escribe un comentario visible para el cliente..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioExterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>
    </div>
  `;
};

window.switchCommentTab = function(tab) {
  const btnInternos = document.getElementById('tab-btn-internos');
  const btnExternos = document.getElementById('tab-btn-externos');
  const contInternos = document.getElementById('comments-container-internos');
  const contExternos = document.getElementById('comments-container-externos');
  
  if (!btnInternos || !btnExternos || !contInternos || !contExternos) return;
  
  if (tab === 'internos') {
    btnInternos.style.color = 'var(--accent)';
    btnInternos.style.borderBottom = '2px solid var(--accent)';
    btnInternos.style.fontWeight = '700';
    
    btnExternos.style.color = 'var(--text-muted)';
    btnExternos.style.borderBottom = '2px solid transparent';
    btnExternos.style.fontWeight = '600';
    
    contInternos.style.display = 'block';
    contExternos.style.display = 'none';
    window._activeCommentTab = 'internos';
  } else {
    btnExternos.style.color = 'var(--accent)';
    btnExternos.style.borderBottom = '2px solid var(--accent)';
    btnExternos.style.fontWeight = '700';
    
    btnInternos.style.color = 'var(--text-muted)';
    btnInternos.style.borderBottom = '2px solid transparent';
    btnInternos.style.fontWeight = '600';
    
    contInternos.style.display = 'none';
    contExternos.style.display = 'block';
    window._activeCommentTab = 'externos';
  }
};

window.agregarComentarioInterno = async function(ticketId) {
  const textarea = document.getElementById('chat-new-comment');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const userName = currentUser ? currentUser.nombre : 'Usuario';

  const now = new Date().toISOString();
  const nuevoComentario = {
    usuario: userName,
    fecha: now,
    texto: text
  };

  if (!t.comentariosInternos) {
    t.comentariosInternos = [];
  }
  t.fechaModificacion = now;
  t.modificadoPor = userName;

  if (window.supabaseClient) {
    try {
      const tClone = JSON.parse(JSON.stringify(t));
      if (!tClone.comentariosInternos) tClone.comentariosInternos = [];
      tClone.comentariosInternos.push(nuevoComentario);
      tClone.fechaModificacion = now;
      tClone.modificadoPor = userName;
      
      await window.pushToSupabase('tickets', tClone);
      
      t.comentariosInternos.push(nuevoComentario);
      safeSetJSON('sapi_tickets', tickets);
      if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
      mostrarNotificacion('Comentario agregado.', 'success');
      
      if (typeof window.ejecutarAutomatizacion === 'function') {
        window.ejecutarAutomatizacion('Comentario guardado en chat del ticket', {
          email: t.clienteEmail || t.solicitanteEmail || '',
          nombre_cliente: t.cliente || '',
          folio_ticket: t.folio || t.id,
          comentario: nuevoComentario.texto,
          link: window.location.origin + '/cliente'
        });
      }

      verDetalleTicket(ticketId);
    } catch (err) {
      console.error('Error al guardar comentario en Supabase:', err);
      mostrarNotificacion('Error al guardar el comentario. Verifica tus permisos o conexión.', 'error');
    }
  } else {
    t.comentariosInternos.push(nuevoComentario);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
    mostrarNotificacion('Comentario guardado localmente.', 'success');
    
    if (typeof window.ejecutarAutomatizacion === 'function') {
      window.ejecutarAutomatizacion('Comentario guardado en chat del ticket', {
        email: t.clienteEmail || t.solicitanteEmail || '',
        nombre_cliente: t.cliente || '',
        folio_ticket: t.folio || t.id,
        comentario: nuevoComentario.texto,
        link: window.location.origin + '/cliente'
      });
    }

    verDetalleTicket(ticketId);
  }
};

window.agregarComentarioExterno = async function(ticketId) {
  const textarea = document.getElementById('chat-new-comment-externo');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Ticket no encontrado.', 'error');
    } else {
      alert('Ticket no encontrado.');
    }
    return;
  }

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const userName = currentUser ? currentUser.nombre : (window.nombreEmpresaLogged || window.currentSession?.nombre || 'Soporte');

  const now = new Date().toISOString();
  const nuevoMensaje = {
    usuario: userName,
    fecha: now,
    texto: text
  };

  if (!t.comentariosClientes) {
    t.comentariosClientes = [];
  }
  t.fechaModificacion = now;
  t.modificadoPor = userName;

  if (window.supabaseClient) {
    try {
      const tClone = JSON.parse(JSON.stringify(t));
      if (!tClone.comentariosClientes) tClone.comentariosClientes = [];
      tClone.comentariosClientes.push(nuevoMensaje);
      tClone.fechaModificacion = now;
      tClone.modificadoPor = userName;
      
      await window.pushToSupabase('tickets', tClone);
      
      t.comentariosClientes.push(nuevoMensaje);
      safeSetJSON('sapi_tickets', tickets);
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Comentario externo enviado.', 'success');
      }
      
      if (typeof verDetalleTicket === 'function') {
        verDetalleTicket(ticketId);
      }
    } catch (err) {
      console.error('Error al guardar comentario en Supabase:', err);
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Error al guardar el comentario. Verifica tus permisos o conexión.', 'error');
      }
    }
  } else {
    t.comentariosClientes.push(nuevoMensaje);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Comentario guardado localmente.', 'success');
    }
    if (typeof verDetalleTicket === 'function') {
      verDetalleTicket(ticketId);
    }
  }
};



// ===== DETALLE TICKET =====
function verDetalleTicket(id) {
  let t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x && (x.id === id || x.folio === id)) : null;
  if (!t) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const targetNorm = norm(id);
    const targetNum = String(id).replace(/[^0-9]/g, '');
    let pool = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? [...tickets] : [];
    if (typeof window !== 'undefined' && Array.isArray(window.tickets)) pool = pool.concat(window.tickets);
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      if (Array.isArray(local)) pool = pool.concat(local);
    } catch (e) {}
    t = pool.find(x => x && (x.id === id || x.folio === id || norm(x.folio || x.id) === targetNorm || (targetNum.length >= 4 && String(x.folio || '').replace(/[^0-9]/g, '') === targetNum)));
  }
  if (!t) {
    const navTickets = document.querySelector('.nav-item[data-view="tickets"]');
    if (navTickets) navTickets.click();
    setTimeout(() => {
      const searchInput = document.getElementById('search-tickets');
      if (searchInput) {
        searchInput.value = id;
        if (typeof renderTickets === 'function') renderTickets();
      }
    }, 150);
    return;
  }

  // Registrar lectura de comentarios internos por el usuario actual
  const currentUserObj = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios.find(u => u && u.id === window.currentSession?.userId) : null;
  const currentUserName = currentUserObj ? currentUserObj.nombre : '';

  if (currentUserName && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
    let modified = false;
    const nowIso = new Date().toISOString();
    t.comentariosInternos.forEach(c => {
      if (!c) return;
      if (!Array.isArray(c.leidoPor)) {
        c.leidoPor = [];
      }
      const yaLeido = c.leidoPor.some(l => (typeof l === 'string' ? l === currentUserName : l && l.usuario === currentUserName));
      if (!yaLeido) {
        c.leidoPor.push({
          usuario: currentUserName,
          fecha: nowIso
        });
        modified = true;
      }
    });

    if (modified) {
      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        window.pushToSupabase('tickets', t).catch(err => console.warn('[Sync] Error al actualizar lectura de comentarios:', err));
      }
      if (typeof window.sincronizarNotificacionesInternas === 'function') {
        window.sincronizarNotificacionesInternas();
      }
    }
  }

  const assocOrder = window.obtenerOrdenAsociadaTicket(t);
  const parentTicket = !assocOrder ? (typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null) : null;
  const isSuperadmin = (typeof currentSession !== 'undefined' && currentSession && (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));
  const isDecisionLocked = ['si', 'aprobada', 'no', 'rechazada'].includes(String(t.cotAceptada || '').toLowerCase().trim());
  document.getElementById('ticket-detalle-title').textContent = `Ticket ${t.folio}`;

  const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '';
  const clienteDisplay = resolvedCli || t.cliente || (parentTicket && parentTicket.cliente ? `${parentTicket.cliente} <span style="font-size:0.75rem; color:var(--accent); font-weight:normal;">(Heredado de Ticket Origen ${parentTicket.folio || parentTicket.id})</span>` : (assocOrder && assocOrder.cliente ? `${assocOrder.cliente} <span style="font-size:0.75rem; color:#2563eb; font-weight:normal;">(Heredado de OS ${assocOrder.folio || assocOrder.id})</span>` : ''));
  const sitioDisplay = t.sitio || (parentTicket && parentTicket.sitio ? parentTicket.sitio : (assocOrder && (assocOrder.ubicacion || assocOrder.ubicacion_sitio) ? (assocOrder.ubicacion || assocOrder.ubicacion_sitio) : ''));
  const equipoDisplay = (t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo : ((parentTicket && parentTicket.equipo && parentTicket.equipo !== 'Otra / No registrada') ? `${parentTicket.equipo} <span style="font-size:0.75rem; color:var(--accent); font-weight:normal;">(Ticket Origen)</span>` : ((assocOrder && assocOrder.equipo) ? `${assocOrder.equipo} <span style="font-size:0.75rem; color:#2563eb; font-weight:normal;">(Orden de Servicio)</span>` : (t.equipo || '—')));

  const field = (label, val, fullWidth = false) => `
    <div class="detalle-field" ${fullWidth ? 'style="grid-column: 1 / -1;"' : ''}>
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;
  document.getElementById('ticket-detalle-body').innerHTML = `
    ${assocOrder ? `
    <div class="detalle-section" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%); border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 8px; padding: 0.85rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(37, 99, 235, 0.15); color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="file-text" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #2563eb;">Orden de Servicio Vinculada</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
            <span>${assocOrder.folio || assocOrder.id}</span>
            ${assocOrder.tipoServicio ? `<span class="badge" style="font-size: 0.68rem; background: var(--bg-card); border: 1px solid var(--border);">${assocOrder.tipoServicio}</span>` : ''}
            ${assocOrder.estado ? `<span class="badge badge-${String(assocOrder.estado).toLowerCase()}">${assocOrder.estado}</span>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
            ${assocOrder.cliente ? `<span style="margin-right: 8px;"><i data-lucide="building-2" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${assocOrder.cliente}</span>` : ''}
            ${assocOrder.equipo ? `<span><i data-lucide="wrench" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${assocOrder.equipo}</span>` : ''}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #2563eb; color: #ffffff; border: none;">
          <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Ver Orden de Servicio
        </button>
      </div>
    </div>
    ` : (parentTicket ? `
    <div class="detalle-section" style="background: linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(234, 88, 12, 0.03) 100%); border: 1px solid rgba(234, 88, 12, 0.25); border-radius: 8px; padding: 0.85rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(234, 88, 12, 0.15); color: #ea580c; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="ticket" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #ea580c;">Ticket de Origen Vinculado</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
            <span>${parentTicket.folio || parentTicket.id}</span>
            ${parentTicket.categoria ? `<span class="badge" style="font-size: 0.68rem; background: var(--bg-card); border: 1px solid var(--border);">${parentTicket.categoria}</span>` : ''}
            ${parentTicket.estado ? `<span class="badge badge-${badgeTicketEstado(parentTicket)}">${getTicketEstadoLabel(parentTicket)}</span>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
            ${parentTicket.asunto ? `<span>${parentTicket.asunto}</span>` : (parentTicket.cliente ? `<span>${parentTicket.cliente}</span>` : '')}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="verDetalleTicket('${parentTicket.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #ea580c; color: #ffffff; border: none;">
          <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Ver Ticket Origen
        </button>
      </div>
    </div>
    ` : (isSuperadmin ? `
    <div class="detalle-section" style="background: rgba(37, 99, 235, 0.04); border: 1px dashed rgba(37, 99, 235, 0.35); border-radius: 8px; padding: 0.75rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(37, 99, 235, 0.12); color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #2563eb;">Sin Orden de Servicio</div>
          <div style="font-size: 0.82rem; color: var(--text-secondary);">Este ticket no cuenta con una orden de servicio generada.</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="forzarCrearOrdenServicio('${t.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.4rem 0.85rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #2563eb; color: #ffffff; border: none;">
          <i data-lucide="file-plus" style="width: 14px; height: 14px;"></i> Forzar Orden de Servicio
        </button>
      </div>
    </div>
    ` : ''))}
    <div class="detalle-section">
      <div class="detalle-section-title">Datos del Ticket</div>
      <div class="detalle-grid">
        ${field('Folio', t.folio)}
        ${assocOrder ? field('Orden de Servicio', `<a href="javascript:void(0)" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" style="color:#2563eb; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> ${assocOrder.folio || assocOrder.id} <i data-lucide="external-link" style="width:11px;height:11px;"></i></a>`) : (parentTicket ? field('Ticket Origen', `<a href="javascript:void(0)" onclick="verDetalleTicket('${parentTicket.id}')" style="color:#ea580c; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="ticket" style="width:13px;height:13px;"></i> ${parentTicket.folio || parentTicket.id} <i data-lucide="external-link" style="width:11px;height:11px;"></i></a>`) : '')}
        ${field('Fecha Creación', formatFechaHoraAmigable(t.fechaCreacion || t.fecha))}
        ${field('Última Modificación', formatFechaHoraAmigable(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha)))}
        ${field('Modificado por', window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || t.creadoPor || '—'))}
        ${field('Asunto', `<strong style="color:var(--text-primary); font-size:0.95rem;">${t.asunto || '—'}</strong>`, true)}
        ${field('Cliente', clienteDisplay ? `${clienteDisplay}${sitioDisplay ? ` (Sitio: ${sitioDisplay})` : ''}` : '—')}
        ${field('Canal', t.canal ? ({correo:'Correo',whatsapp:'WhatsApp',telefono:'Llamada Tel.'}[t.canal]||t.canal) : '—')}
        ${field('Contacto', t.contacto)}
        ${field('Estado', `<span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span>`)}
        ${!['empresa', 'cliente', 'cliente-consultor'].includes(currentSession.viewMode) ? field('Prioridad', `<span class="badge badge-${(t.prioridad||'media').toLowerCase()}">${t.prioridad}</span>`) : ''}
        ${field('Solicitante', t.solicitante)}
        ${field('Creado por', t.creadoPor)}
        ${field('Área', t.area)}
        ${field('Categoría', t.categoria)}
        ${field('Asignado a', t.asignado)}
        ${field('Equipo / Máquina', equipoDisplay, true)}
      </div>
    </div>
    <div class="detalle-section">
      <div class="detalle-section-title">Descripción</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.descripcion||'—'}</div></div>
    </div>
    ${(t.notes || t.notas && currentSession.viewMode !== 'empresa') ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Notas Internas</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.notas}</div></div>
    </div>` : ''}

    ${((t.pdfCotizacion && !t.cotizacionSAP) || t.foto || t.evidencia || (t.evidencias && (Array.isArray(t.evidencias) ? t.evidencias.length > 0 : Object.keys(t.evidencias).length > 0)) || (t.notas && String(t.notas).toLowerCase().includes('evidencia fotográfica'))) ? `
    <div class="detalle-section" id="section-detalle-evidencia-${t.id}">
      <div class="detalle-section-title" style="display:flex; align-items:center; gap:0.5rem; color:var(--accent);"><i data-lucide="camera"></i> Evidencia Fotográfica</div>
      <div class="detalle-field" style="display:flex; flex-direction:column; gap:0.5rem;">
        <div id="detalle-evidence-container-${t.id}" style="width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--border); background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; min-height:180px; max-height:380px; position:relative; padding:0.5rem;">
          <img id="detalle-evidence-img-${t.id}" src="${(t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') ? t.pdfCotizacion : (t.foto || t.evidencia || '')}" alt="Evidencia de Falla" style="max-width:100%; max-height:360px; object-fit:contain; border-radius:6px; cursor:pointer; display:${(t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') || t.foto || t.evidencia ? 'block' : 'none'}; box-shadow:0 4px 15px rgba(0,0,0,0.25);" onclick="window.previsualizarImagenCompleta(this.src, 'Evidencia Fotográfica - Ticket ${t.folio || ''}')" title="Clic para ver en pantalla completa" onerror="this.style.display='none'; const sec=document.getElementById('section-detalle-evidencia-${t.id}'); if(sec) sec.style.display='none';" />
          <span id="detalle-evidence-loading-${t.id}" style="font-size:0.82rem; color:var(--text-muted); display:${(!t.pdfCotizacion || t.pdfCotizacion === '__HAS_PDF__') && !t.foto && !t.evidencia ? 'inline-flex' : 'none'}; align-items:center; gap:6px;">
            <i data-lucide="loader" class="rotating" style="width:16px;height:16px;color:var(--accent);"></i> Cargando evidencia fotográfica...
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); padding:0 0.2rem;">
          <span><i data-lucide="maximize-2" style="width:12px;height:12px;vertical-align:middle;margin-right:3px;"></i> Haz clic en la imagen para ampliar en pantalla completa</span>
          <button type="button" onclick="window.abrirImagenEnPestana('${t.id}')" style="background:none; border:none; color:var(--accent); font-size:0.75rem; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="external-link" style="width:12px;height:12px;"></i> Abrir original</button>
        </div>
      </div>
    </div>
    ` : ''}

    ${t.estado === 'Cerrado' ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Resolución Final</div>
      
      <!-- Elegant metadata cards -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
        <!-- SAP Card -->
        <div style="flex: 1; min-width: 150px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Cotización SAP</span>
          <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${t.cotizacionSAP || '—'}</span>
        </div>
        <!-- Monto Card -->
        <div style="flex: 1; min-width: 150px; background: linear-gradient(135deg, rgba(232, 130, 12, 0.08) 0%, rgba(232, 130, 12, 0.02) 100%); border: 1px solid rgba(232, 130, 12, 0.2); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--accent); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Monto Total</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent);">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</span>
        </div>
      </div>

      <div class="detalle-grid">
        ${t.pdfCotizacion ? field('PDF Cotización', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : ''}
        ${t.cotAceptada ? field('Resultado', t.cotAceptada === 'si' ? '<span style="color:var(--green); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Aprobada</span>' : '<span style="color:var(--red); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> Rechazada</span>') : ''}
        ${t.motivoRechazo ? field('Motivo Rechazo', t.motivoRechazo) : ''}
        ${t.pedidoSAP ? field('Pedido SAP', t.pedidoSAP) : ''}
        ${t.pdfPedido ? field('PDF Pedido', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : ''}
        ${t.tecnicosAsignados && t.tecnicosAsignados.length > 0 ? field('Técnicos Asignados', t.tecnicosAsignados.join(', ')) : ''}
      </div>
      <div id="closed-pdf-extraction-${t.id}" style="margin-top: 1rem;"></div>
    </div>
    ` : ''}

    ${t.estado === 'Abierto' && currentSession.viewMode !== 'empresa' ? (t.categoria === 'Garantía Interna' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; display:flex; flex-direction:column; gap:1rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Procesar Garantía Interna</div>
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Este ticket es de categoría <strong>Garantía Interna</strong>. No se requiere ingresar refacciones, cotización ni pedido SAP.</p>
        <button type="button" class="btn-primary" style="background:var(--green); border-color:var(--green); margin-top:0.5rem; justify-content:center; display:inline-flex; align-items:center; gap:4px;" onclick="window.cerrarGarantiaInternaDirecto('${t.id}')"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Finalizar y Cerrar Ticket</button>
      </div>
    </div>
    ` : `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; display:flex; flex-direction:column; gap:1rem;">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="settings"></i> Procesar Ticket: Selección de Refacciones</div>
      
      <!-- Listado/Editor inline de Refacciones (idéntico a órdenes de servicio) -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
        <div style="font-weight:600; font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.25rem;">Refacciones Requeridas</div>
        <div id="ref-ticket-list" style="display:flex; flex-direction:column; gap:0.5rem;">
          <!-- Las filas se insertan dinámicamente -->
        </div>
        ${['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) ? `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; flex-wrap:wrap; gap:0.5rem;">
            <button type="button" class="btn-add-ref" style="width:fit-content; margin:0;" onclick="window.agregarFilaRefaccionTicket('${t.id}')">+ Agregar Refacción</button>
            <button type="button" class="btn-primary" style="background:var(--green); border-color:var(--green);" onclick="window.guardarRefaccionesTicketDesdeUI('${t.id}', true)">Guardar Refacciones</button>
          </div>
        ` : ''}
      </div>
    </div>
    `) : ''}

    ${t.estado === 'Refacciones' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1.25rem; border-radius: 8px; display:flex; flex-direction:column; gap:1.25rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Etapa: Selección de Refacciones</div>
      
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow: var(--shadow-sm);">
        <div style="font-weight:600; font-size:0.85rem; color:var(--text-secondary); border-bottom:1px solid var(--border); padding-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;"><i data-lucide="lock" style="width:14px;height:14px;color:var(--text-muted);"></i> Refacciones Solicitadas (Bloqueado / Lectura)</div>
        
        ${t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border); text-align:left; color:var(--text-muted); font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:0.5rem 0.25rem; width:15%;">Marca</th>
                  <th style="padding:0.5rem 0.25rem; width:40%;">Descripción</th>
                  <th style="padding:0.5rem 0.25rem; width:15%;">Clave</th>
                  <th style="padding:0.5rem 0.25rem; width:10%; text-align:center;">Cant.</th>
                  <th style="padding:0.5rem 0.25rem; width:20%; text-align:center;">Estatus</th>
                </tr>
              </thead>
              <tbody>
                ${t.refaccionesSeleccionadas.map(ref => {
                  const brandName = {
                    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                    'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                    'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                    'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
                  }[String(ref.marca).toUpperCase()] || ref.marca || '—';
                  
                  let pStatusColor = '#ef4444';
                  let pStatusBg = 'rgba(239, 68, 68, 0.1)';
                  if (ref.estatusPedido === 'En Tránsito / Pedido') {
                    pStatusColor = '#e8820c';
                    pStatusBg = 'rgba(232, 130, 12, 0.1)';
                  } else if (ref.estatusPedido === 'Entregado al Técnico') {
                    pStatusColor = '#22c55e';
                    pStatusBg = 'rgba(34, 197, 94, 0.1)';
                  }
                  
                  const safeClave = (ref.clave || ref.codigo || 'S/C').replace(/'/g, "\\'");
                  const safeNombre = (ref.descripcion || ref.nombre || 'Sin Descripción').replace(/'/g, "\\'");
                  
                  return `
                    <tr style="border-bottom:1px solid var(--border); color:var(--text-primary);">
                      <td style="padding:0.6rem 0.25rem; font-weight:600; color:var(--orange);">${brandName}</td>
                      <td style="padding:0.6rem 0.25rem; line-height:1.3; font-weight:500;">${ref.nombre || ref.descripcion || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${ref.codigo || ref.clave || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center; font-weight:700; color:var(--text-primary);">${ref.cantidad || 1}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center;">
                        <span class="status-badge" style="font-size:0.7rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:2px 6px; border-radius:4px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${safeClave}', '${safeNombre}', '${ref.estatusPedido || 'Por Pedir'}', ${ref.cantidad || 1}, '${ref.marca || ''}')">
                          ${ref.estatusPedido || 'Por Pedir'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-style:italic;">No hay refacciones solicitadas.</div>
        `}
      </div>

      <!-- Avanzar a Cotización -->
      ${['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) ? `
      <div style="border-top:1px dashed var(--border); padding-top:1rem; margin-top:0.25rem; display:flex; flex-direction:column; gap:0.75rem;">
        <!-- Contenedor para múltiples cotizaciones vinculadas en panel rápido -->
        <div id="quick-linked-cotizaciones-container-${t.id}" style="margin-bottom:0.5rem; width:100%;"></div>
        
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <label style="font-weight:600; font-size:0.85rem; display:block; margin:0; color:var(--text-secondary);">No. Cotización SAP *</label>
            <button type="button" id="btn-sync-sap-cot-${t.id}" onclick="window.syncSapCotizacionManual('${t.id}')" class="btn-text-action" style="font-size:0.7rem; color:var(--accent); background:none; border:none; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> Sincronizar con SAP</button>
          </div>
          <select id="quick-cot-sap-${t.id}" onchange="window.onQuickCotizacionSelected('${t.id}')" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;"></select>
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:0.4rem; color:var(--text-secondary);">Monto de Cotización ($) *</label>
          <input type="number" id="quick-cot-monto-${t.id}" value="" oninput="window.validarCotizacionConSAP(false, '${t.id}')" step="0.01" min="0" placeholder="Ej. 12500.00" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;">
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:0.4rem; color:var(--text-secondary);">Archivo Cotización (PDF) *</label>
          <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
            <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
              <label class="custom-file-upload" style="flex:1; margin:0;">
                <input type="file" id="quick-cot-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfCotizacion(this.files[0], false, '${t.id}');"/>
                <i data-lucide="upload" style="width:24px; height:24px; margin-bottom:0.4rem;"></i>
                <span class="file-label-text">Subir cotización en PDF</span>
              </label>
              <button type="button" id="btn-clear-pdf-quick-${t.id}" onclick="window.clearPdfInput(false, '${t.id}')" class="btn-icon" style="display:none; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:0.6rem; cursor:pointer; height:45px; width:45px; align-items:center; justify-content:center;" title="Eliminar archivo"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
            </div>
            <div id="quick-pdf-extraction-table-container-${t.id}" style="display:none;"></div>
          </div>
        </div>
        <div id="quick-sap-validation-status-${t.id}" style="display:none; margin-top: 0.25rem;"></div>
        
        <button type="button" class="btn-secondary" id="btn-quick-vincular-cotizacion-${t.id}" style="width:100%; margin-top:0.25rem; justify-content:center; display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;" onclick="window.vincularNuevaCotizacion(false, '${t.id}')"><i data-lucide="plus-circle" style="width:14px; height:14px;"></i> Vincular esta Cotización</button>
        
        <button id="btn-pasar-cotizacion-${t.id}" class="btn-primary" style="background:var(--accent); border-color:var(--accent); margin-top:0.5rem; justify-content:center; ${(!t.cotizacionSAP && !(window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive())) ? 'opacity:0.5; cursor:not-allowed;' : ''}" ${(!t.cotizacionSAP && !(window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive())) ? 'disabled' : ''} onclick="avanzarCotizacionTicket('${t.id}')">Pasar a Cotización</button>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${t.estado === 'Cotización' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1.25rem; border-radius: 8px; display:flex; flex-direction:column; gap:1.25rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Cierre de Cotización</div>
      
      <!-- Elegant metadata cards -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <!-- SAP Card -->
        <div style="flex: 1; min-width: 150px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Cotización SAP</span>
          <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${t.cotizacionSAP || '—'}</span>
        </div>
        <!-- Monto Card -->
        <div style="flex: 1; min-width: 150px; background: linear-gradient(135deg, rgba(232, 130, 12, 0.08) 0%, rgba(232, 130, 12, 0.02) 100%); border: 1px solid rgba(232, 130, 12, 0.2); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--accent); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Monto Total</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent);">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</span>
        </div>
      </div>
      
      ${t.pdfCotizacion ? `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; align-items:center; justify-content:space-between; box-shadow: var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.85rem; color:var(--text-secondary);">
          <i data-lucide="file-text" style="width:16px;height:16px;color:var(--accent);"></i> Archivo de Cotización
        </div>
        <div style="display:flex; gap:0.25rem;">
          <button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button>
          <button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button>
        </div>
      </div>
      ` : ''}
      
      <!-- Refacciones Solicitadas (Bloqueado / Lectura) -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow: var(--shadow-sm);">
        <div style="font-weight:600; font-size:0.85rem; color:var(--text-secondary); border-bottom:1px solid var(--border); padding-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;"><i data-lucide="lock" style="width:14px;height:14px;color:var(--text-muted);"></i> Refacciones Solicitadas (Bloqueado / Lectura)</div>
        
        ${t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border); text-align:left; color:var(--text-muted); font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:0.5rem 0.25rem; width:15%;">Marca</th>
                  <th style="padding:0.5rem 0.25rem; width:40%;">Descripción</th>
                  <th style="padding:0.5rem 0.25rem; width:15%;">Clave</th>
                  <th style="padding:0.5rem 0.25rem; width:10%; text-align:center;">Cant.</th>
                  <th style="padding:0.5rem 0.25rem; width:20%; text-align:center;">Estatus</th>
                </tr>
              </thead>
              <tbody>
                ${t.refaccionesSeleccionadas.map(ref => {
                  const brandName = {
                    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                    'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                    'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                    'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
                  }[String(ref.marca).toUpperCase()] || ref.marca || '—';
                  
                  let pStatusColor = '#ef4444';
                  let pStatusBg = 'rgba(239, 68, 68, 0.1)';
                  if (ref.estatusPedido === 'En Tránsito / Pedido') {
                    pStatusColor = '#e8820c';
                    pStatusBg = 'rgba(232, 130, 12, 0.1)';
                  } else if (ref.estatusPedido === 'Entregado al Técnico') {
                    pStatusColor = '#22c55e';
                    pStatusBg = 'rgba(34, 197, 94, 0.1)';
                  }
                  
                  const safeClave = (ref.clave || ref.codigo || 'S/C').replace(/'/g, "\\'");
                  const safeNombre = (ref.descripcion || ref.nombre || 'Sin Descripción').replace(/'/g, "\\'");
                  
                  return `
                    <tr style="border-bottom:1px solid var(--border); color:var(--text-primary);">
                      <td style="padding:0.6rem 0.25rem; font-weight:600; color:var(--orange);">${brandName}</td>
                      <td style="padding:0.6rem 0.25rem; line-height:1.3; font-weight:500;">${ref.nombre || ref.descripcion || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${ref.codigo || ref.clave || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center; font-weight:700; color:var(--text-primary);">${ref.cantidad || 1}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center;">
                        <span class="status-badge" style="font-size:0.7rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:2px 6px; border-radius:4px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${safeClave}', '${safeNombre}', '${ref.estatusPedido || 'Por Pedir'}', ${ref.cantidad || 1}, '${ref.marca || ''}')">
                          ${ref.estatusPedido || 'Por Pedir'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-style:italic;">No hay refacciones solicitadas.</div>
        `}
      </div>

      <div class="form-group full-width" style="margin-bottom:0; border-top: 1px dashed var(--border); padding-top: 1rem;">
        <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; display:flex; align-items:center; gap:0.35rem; margin-bottom:0.5rem;">
          ¿El cliente aceptó la cotización?
          ${isDecisionLocked ? `<span style="font-size:0.72rem; color:var(--green); font-weight:600; display:inline-flex; align-items:center; gap:3px; background:rgba(16,185,129,0.1); padding:1px 6px; border-radius:4px;"><i data-lucide="info" style="width:11px;height:11px;"></i> Definido por el cliente</span>` : ''}
        </label>
        <div style="display:flex; gap:1rem; margin-top:0.5rem; margin-bottom: 0.75rem;">
          <label style="cursor:${isDecisionLocked ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; font-weight:500; color:var(--text-primary); ${isDecisionLocked ? 'opacity:0.7;' : ''}">
            <input type="radio" name="quick-cot-acep-${t.id}" value="si" ${t.cotAceptada === 'si' || t.cotAceptada === 'aprobada' ? 'checked' : ''} ${isDecisionLocked ? 'disabled' : ''} onchange="document.getElementById('quick-motivo-${t.id}').style.display='none'; document.getElementById('quick-pedido-${t.id}').style.display='block';"> 
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--green);"></i> Sí, aprobada
          </label>
          <label style="cursor:${isDecisionLocked ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; font-weight:500; color:var(--text-primary); ${isDecisionLocked ? 'opacity:0.7;' : ''}">
            <input type="radio" name="quick-cot-acep-${t.id}" value="no" ${t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'checked' : ''} ${isDecisionLocked ? 'disabled' : ''} onchange="document.getElementById('quick-motivo-${t.id}').style.display='block'; document.getElementById('quick-pedido-${t.id}').style.display='none';"> 
            <i data-lucide="x-circle" style="width:16px;height:16px;color:var(--red);"></i> No, rechazada
          </label>
        </div>
        <div id="quick-motivo-${t.id}" style="display: ${t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'block' : 'none'}; margin-bottom:0.75rem;">
          <textarea id="quick-motivo-text-${t.id}" rows="2" placeholder="Especifica el motivo por el cual fue rechazada..." ${isDecisionLocked ? 'disabled style="background:rgba(255,255,255,0.01); color:var(--text-secondary); cursor:not-allowed;"' : ''}>${t.motivoRechazo || ''}</textarea>
        </div>
        <div id="quick-pedido-${t.id}" style="display: ${t.cotAceptada === 'si' || t.cotAceptada === 'aprobada' ? 'block' : 'none'}; margin-bottom:0.75rem;">
          <div class="form-group full-width">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin:0;">No. Pedido SAP *</label>
              <button type="button" id="btn-sync-sap-ped-quick-${t.id}" onclick="window.syncSapPedidoManual(false, '${t.id}')" class="btn-text-action" style="font-size:0.75rem; color:var(--accent); background:none; border:none; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> Sincronizar con SAP</button>
            </div>
            <select id="quick-ped-sap-${t.id}" onchange="window.onQuickPedidoSelected('${t.id}')" style="width:100%; border:1px solid var(--border); border-radius:6px; background:rgba(255,255,255,0.02); color:var(--text-primary); padding:0.6rem; font-size:0.85rem;"></select>
          </div>
          <div class="form-group full-width" style="margin-top:0.5rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Monto de Pedido ($) *</label>
            <input type="number" id="quick-ped-monto-${t.id}" oninput="window.validarPedidoConSAP(false, '${t.id}')" step="0.01" min="0" placeholder="Ej. 12500.00" style="width:100%; border:1px solid var(--border); border-radius:6px; background:rgba(255,255,255,0.02); color:var(--text-primary); padding:0.6rem; font-size:0.85rem;" />
          </div>
          <div class="form-group full-width" style="margin-top:0.5rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Archivo Pedido (PDF) *</label>
            <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
              <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
                <label class="custom-file-upload" style="flex:1; margin:0;">
                  <input type="file" id="quick-ped-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfPedido(this.files[0], false, '${t.id}');" />
                  <i data-lucide="upload" style="width:24px; height:24px; margin-bottom:0.4rem;"></i>
                  <span class="file-label-text">Subir pedido en PDF</span>
                </label>
                <button type="button" id="btn-clear-pdf-pedido-quick-${t.id}" onclick="window.clearPdfPedidoInput(false, '${t.id}')" class="btn-icon" style="display:none; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:0.6rem; cursor:pointer; height:45px; width:45px; align-items:center; justify-content:center;" title="Eliminar archivo"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
              </div>
              <div id="quick-pdf-pedido-extraction-table-container-${t.id}" style="display:none;"></div>
            </div>
          </div>
          <div id="quick-pedido-sap-validation-status-${t.id}" style="margin-top: 0.75rem; display: none;"></div>
          <div class="form-group full-width" style="margin-top:0.75rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Tipo de Visita *</label>
            <select id="quick-tipo-${t.id}">
              <option value="Servicio preventivo">Servicio preventivo</option>
              <option value="Garantía">Garantía</option>
              <option value="Inspección">Inspección</option>
              <option value="Entrega y puesta en marcha">Entrega y puesta en marcha</option>
              <option value="Pre-entrega">Pre-entrega</option>
              <option value="Entrega Refacciones">Entrega Refacciones</option>
            </select>
          </div>
        </div>
        <button class="btn-primary full-width" style="justify-content:center; margin-top: 1rem;" onclick="cerrarCotizacionTicket('${t.id}')">Finalizar y Cerrar Ticket</button>
      </div>
    </div>
    ` : ''}

    ${window.renderComentariosInternosHtml(t)}

    <div style="display:flex; justify-content:center; gap: 4px; height: 35px; width: 80%; margin: 2rem auto 0.5rem auto; opacity: 0.2; color: var(--text-primary);">
      <div style="width:2px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:3px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:2px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:4px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
    </div>
    <div style="font-family: monospace; font-size: 0.6rem; color: var(--text-muted); letter-spacing: 5px; text-align: center; margin-bottom: 1rem;">* ${t.folio} *</div>

    <div class="form-actions" style="border-top:2px dashed var(--border);padding-top:1rem;margin-top:0.5rem; justify-content:center; gap:0.5rem; flex-wrap:wrap;">
      <button class="btn-secondary" onclick="cerrarDetalleTicket()">Cerrar Vista</button>
      <button class="btn-primary" onclick="cerrarDetalleTicket();editarTicket('${t.id}')"><i data-lucide="pencil" style="width:16px;height:16px;"></i> Editar</button>
      ${isSuperadmin ? `
        <button class="btn-secondary" style="border-color:var(--accent); color:var(--accent);" onclick="forzarEstadoTicket('${t.id}')">
          <i data-lucide="zap" style="width:16px;height:16px;margin-right:4px;"></i> Forzar Estado
        </button>
        ${!assocOrder ? `
          <button class="btn-secondary" style="border-color:#2563eb; color:#2563eb;" onclick="forzarCrearOrdenServicio('${t.id}')">
            <i data-lucide="file-plus" style="width:16px;height:16px;margin-right:4px;"></i> Forzar Orden de Servicio
          </button>
        ` : ''}
      ` : ''}
    </div>
  `;
  document.getElementById('modal-ticket-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  
  // Auto-scroll chat to bottom
  setTimeout(() => {
    const chatContainer = document.querySelector('#modal-ticket-detalle .chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, 100);

  // Carga asíncrona de evidencia fotográfica si viene como placeholder o si existe en base de datos
  const hasPendingEvidence = t.pdfCotizacion === '__HAS_PDF__' || (!t.pdfCotizacion && t.notas && String(t.notas).toLowerCase().includes('evidencia fotográfica'));
  if (hasPendingEvidence && window.supabaseClient) {
    setTimeout(async () => {
      try {
        const { data, error } = await window.supabaseClient
          .from('tickets')
          .select('pdf_cotizacion')
          .eq('id', t.id)
          .single();
        if (error) throw error;
        const base64 = data ? data.pdf_cotizacion : null;
        const imgEl = document.getElementById(`detalle-evidence-img-${t.id}`);
        const loadEl = document.getElementById(`detalle-evidence-loading-${t.id}`);
        if (base64) {
          t.pdfCotizacion = base64;
          if (imgEl) {
            imgEl.src = base64;
            imgEl.style.display = 'block';
          }
          if (loadEl) loadEl.style.display = 'none';
        } else {
          if (loadEl) loadEl.innerHTML = '<span style="color:var(--text-muted);"><i data-lucide="image-off" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> No se encontró imagen adjunta en la base de datos</span>';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (err) {
        console.error('Error cargando evidencia fotográfica en verDetalleTicket:', err);
        const loadEl = document.getElementById(`detalle-evidence-loading-${t.id}`);
        if (loadEl) loadEl.innerHTML = '<span style="color:var(--red); font-size:0.8rem;">Error al descargar imagen de evidencia</span>';
      }
    }, 30);
  }

  if (t.estado === 'Cerrado' && t.cotAceptada === 'si' && window.supabaseClient) {
    setTimeout(async () => {
      const container = document.getElementById(`closed-pdf-extraction-${t.id}`);
      if (!container) return;
      
      try {
        const { data, error } = await window.supabaseClient
          .from('pdf_extracciones_ai')
          .select('*')
          .eq('ticket_id', t.id)
          .order('fecha_extraccion', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          const ex = data[0];
          const mainArticulos = Array.isArray(ex.conceptos) ? ex.conceptos : [];
          const extrasArticulos = Array.isArray(ex.extras) ? ex.extras : [];
          
          let logisticaHtml = '';
          const logisticaObj = extrasArticulos.find(e => e.isViajeData);
          if (logisticaObj) {
            logisticaHtml = `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">✈️ Logística Extraída (Viáticos y Ruta)</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                        <th style="padding:4px;">Origen</th>
                        <th style="padding:4px;">Destino</th>
                        <th style="padding:4px;">Hospedajes</th>
                        <th style="padding:4px;">Alimentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                        <td style="padding:4px;" title="${logisticaObj.origen || ''}">${logisticaObj.origen || '—'}</td>
                        <td style="padding:4px;" title="${logisticaObj.destino || ''}">${logisticaObj.destino || '—'}</td>
                        <td style="padding:4px;">${logisticaObj.num_hospedaje || 0}</td>
                        <td style="padding:4px;">${logisticaObj.num_alimento || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          } else if (ex.ruta_servicio) {
             logisticaHtml = `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">✈️ Logística Extraída (Ruta)</div>
                <div style="font-size:0.75rem; padding:0 8px;">${ex.ruta_servicio}</div>
              </div>
            `;
          }

          const generateTable = (title, icon, items) => {
            const filteredItems = items.filter(i => !i.isViajeData);
            if (filteredItems.length === 0) return '';
            return `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">${icon} ${title} (${filteredItems.length})</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                        <th style="padding:4px;">Descripción</th>
                        <th style="padding:4px; text-align:center;">Cant</th>
                        <th style="padding:4px; text-align:center;">UM</th>
                        <th style="padding:4px; text-align:center;">X Surtir</th>
                        <th style="padding:4px; text-align:center;">Almacén</th>
                        <th style="padding:4px; text-align:right;">Precio</th>
                        <th style="padding:4px; text-align:center;">Imp %</th>
                        <th style="padding:4px; text-align:right;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredItems.map(art => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                          <td style="padding:4px;" title="${art.descripcion || ''}">${art.descripcion || '—'}</td>
                          <td style="padding:4px; text-align:center; font-weight:600;">${art.cantidad || 0}</td>
                          <td style="padding:4px; text-align:center;">${art.unidad_medida || '—'}</td>
                          <td style="padding:4px; text-align:center;">${art.x_surtir || 0}</td>
                          <td style="padding:4px; text-align:center;">${art.almacen || '—'}</td>
                          <td style="padding:4px; text-align:right;">${art.precio ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.precio) : '—'}</td>
                          <td style="padding:4px; text-align:center;">${art.impuesto_porcentaje || 0}%</td>
                          <td style="padding:4px; text-align:right; font-weight:600;">${art.total ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.total) : '—'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          };

          const allExtractedItems = [...mainArticulos, ...extrasArticulos];
          const hasReembolsoKm = allExtractedItems.some(x => !x.isViajeData && x.descripcion && x.descripcion.toLowerCase().includes('reembolso') && x.descripcion.toLowerCase().includes('km'));

          container.innerHTML = `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.75rem; font-size:0.8rem;">
              <div style="font-weight:600; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <span>📋 Datos Históricos Extraídos del Archivo</span>
                ${hasReembolsoKm ? `<span style="background:rgba(232, 130, 12, 0.1); color:var(--accent); padding:2px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:4px; border:1px solid rgba(232, 130, 12, 0.2);">Reembolso KM Detectado</span>` : ''}
              </div>
              ${generateTable('Refacciones Extraídas', '📦', mainArticulos)}
              ${generateTable('Extras Extraídos', '📋', extrasArticulos)}
              ${logisticaHtml}
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: container });
        }
      } catch (err) {
        console.error('Error fetching AI extraction:', err);
      }
    }, 100);
  }

  if (t.estado === 'Abierto' && currentSession.viewMode !== 'empresa') {
    window.inicializarRefaccionesTicket(t.id, t.refaccionesSeleccionadas || []);
  }
  if (t.estado === 'Refacciones' && currentSession.viewMode !== 'empresa') {
    if (!window.quickEditandoCotizaciones) window.quickEditandoCotizaciones = {};
    window.quickEditandoCotizaciones[t.id] = [];
    if (Array.isArray(t.cotizacionesAdicionales) && t.cotizacionesAdicionales.length > 0) {
      window.quickEditandoCotizaciones[t.id] = JSON.parse(JSON.stringify(t.cotizacionesAdicionales));
    } else if (t.cotizacionSAP) {
      window.quickEditandoCotizaciones[t.id] = [{
        sap: t.cotizacionSAP,
        monto: t.montoCotizacion || 0,
        pdf: t.pdfCotizacion || null
      }];
    }

    setTimeout(() => {
      if (window.renderLinkedCotizaciones) {
        window.renderLinkedCotizaciones(false, t.id);
      }
    }, 100);

    if (window.poblarCotizacionesDropdown) {
      window.poblarCotizacionesDropdown(false, t.id, '');
    }
  }
  if (t.estado === 'Cotización' && currentSession.viewMode !== 'empresa') {
    if (window.poblarPedidosDropdown) {
      window.poblarPedidosDropdown(false, t.id, t.pedidoSAP || '');
    }
    if (t.pedidoSAP) {
      const elPedMonto = document.getElementById(`quick-ped-monto-${t.id}`);
      if (elPedMonto) {
        const order = (window._cachePedidosSap || []).find(o => o.numero_pedido === t.pedidoSAP);
        elPedMonto.value = t.montoPedido || (order ? order.monto : '');
      }
      setTimeout(() => {
        if (window.validarPedidoConSAP) {
          window.validarPedidoConSAP(false, t.id);
        }
      }, 200);
    }
  }
  lucide.createIcons();
}

// Visualización de PDF bajo demanda en una pestaña nueva
window.visualizarPdfOnDemand = async function(ticketId, tipo) {
  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const label = tipo === 'pedido' ? 'pdfPedido' : 'pdfCotizacion';
  const dbCol = tipo === 'pedido' ? 'pdf_pedido' : 'pdf_cotizacion';

  const showPdf = (base64Data) => {
    let base64Pure = base64Data;
    if (base64Data.startsWith('data:')) {
      base64Pure = base64Data.split(',')[1];
    }
    try {
      const byteCharacters = atob(base64Pure);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (e) {
      console.error('Error al decodificar Base64:', e);
      window.open(base64Data, '_blank');
    }
  };

  const localVal = t[label];
  if (localVal && localVal.startsWith('data:')) {
    showPdf(localVal);
    return;
  }

  if (!window.supabaseClient) {
    mostrarNotificacion('No hay conexión con la base de datos para visualizar el PDF.', 'error');
    return;
  }

  mostrarNotificacion('Cargando archivo PDF...', 'info');

  try {
    const { data, error } = await window.supabaseClient
      .from('tickets')
      .select(dbCol)
      .eq('id', ticketId)
      .single();

    if (error) throw error;

    const dbVal = data ? data[dbCol] : null;
    if (!dbVal) {
      mostrarNotificacion('El archivo no está disponible en el servidor.', 'error');
      return;
    }

    showPdf(dbVal);
  } catch (err) {
    console.error('[PDF View] Error:', err);
    mostrarNotificacion('Error al cargar el archivo: ' + err.message, 'error');
  }
};

window.visualizarDestinoPdfActual = function() {
  const currentTicketId = window.soporteActual;
  if (!currentTicketId) return;
  const t = tickets.find(x => x.id === currentTicketId);
  if (!t || !t.destinoPdfUrl) {
    const fileInput = document.getElementById('ref-destino-pdf-file');
    if (fileInput && fileInput.files.length > 0) {
      const fileURL = URL.createObjectURL(fileInput.files[0]);
      window.open(fileURL, '_blank');
    } else {
      mostrarNotificacion('No hay ningún PDF cargado.', 'warning');
    }
    return;
  }
  
  if (t.destinoPdfUrl.startsWith('data:')) {
    let base64Pure = t.destinoPdfUrl;
    if (t.destinoPdfUrl.startsWith('data:')) {
      base64Pure = t.destinoPdfUrl.split(',')[1];
    }
    try {
      const byteCharacters = atob(base64Pure);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (e) {
      window.open(t.destinoPdfUrl, '_blank');
    }
  } else {
    window.open(t.destinoPdfUrl, '_blank');
  }
};

// Descarga de PDF bajo demanda desde Supabase para evitar saturación de localStorage
window.descargarPdfOnDemand = async function(ticketId, tipo) {
  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const label = tipo === 'pedido' ? 'pdfPedido' : 'pdfCotizacion';
  const dbCol = tipo === 'pedido' ? 'pdf_pedido' : 'pdf_cotizacion';
  const folio = t.folio || 'ticket';

  // 1. Si el archivo ya está en memoria local (ej. recién subido/editado y no sincronizado)
  const localVal = t[label];
  if (localVal && localVal.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = localVal;
    link.download = `${tipo === 'pedido' ? 'Pedido' : 'Cotizacion'}_${folio}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // 2. Si es el marcador, se requiere estar online para descargarlo de Supabase
  if (!window.supabaseClient) {
    mostrarNotificacion('No hay conexión con la base de datos para descargar el PDF.', 'error');
    return;
  }

  mostrarNotificacion('Descargando archivo PDF...', 'info');

  try {
    const { data, error } = await window.supabaseClient
      .from('tickets')
      .select(dbCol)
      .eq('id', ticketId)
      .single();

    if (error) throw error;

    const dbVal = data ? data[dbCol] : null;
    if (!dbVal) {
      mostrarNotificacion('El archivo no está disponible en el servidor.', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = dbVal;
    link.download = `${tipo === 'pedido' ? 'Pedido' : 'Cotizacion'}_${folio}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion('Descarga iniciada con éxito.', 'success');
  } catch (err) {
    console.error('[PDF Download] Error:', err);
    mostrarNotificacion('Error al descargar el archivo: ' + err.message, 'error');
  }
};

async function avanzarCotizacionTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;

  // Si la lista está vacía, intentar vincular los valores actuales
  if (!window.quickEditandoCotizaciones || !window.quickEditandoCotizaciones[id] || window.quickEditandoCotizaciones[id].length === 0) {
    const quickSap = document.getElementById(`quick-cot-sap-${id}`)?.value.trim();
    const quickMontoInput = document.getElementById(`quick-cot-monto-${id}`);
    const quickMontoVal = quickMontoInput ? parseFloat(quickMontoInput.value) : 0;
    if (quickSap || quickMontoVal > 0) {
      await window.vincularNuevaCotizacion(false, id);
    }
  }

  const list = window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[id] : [];
  const bypassQuote = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
  if (!bypassQuote && (!Array.isArray(list) || list.length === 0)) {
    mostrarNotificacion('Debe vincular al menos una cotización de SAP para este ticket.', 'error');
    return;
  }

  const primaryCot = list[0] || { sap: '', pdf: null };
  const totalMonto = list.length > 0 ? list.reduce((sum, c) => sum + (Number(c.monto) || 0), 0) : null;

  t.cotizacionSAP = primaryCot.sap;
  t.montoCotizacion = totalMonto;
  t.pdfCotizacion = primaryCot.pdf;
  t.cotizacionesAdicionales = list;
  t.estado = 'Cotización';

  safeSetJSON('sapi_tickets', tickets);
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  mostrarNotificacion('Ticket avanzado a Cotización.', 'success');

  if (typeof window.ejecutarAutomatizacion === 'function') {
    window.ejecutarAutomatizacion('Carga de Cotización SAP en ticket', {
      email: t.clienteEmail || t.solicitanteEmail || '',
      nombre_cliente: t.cliente || '',
      folio_ticket: t.folio || t.id,
      monto_cotizacion: totalMonto ? `$${Number(totalMonto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '',
      link: window.location.origin + '/cliente'
    });
  }

  cerrarDetalleTicket();
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
}

async function cerrarCotizacionTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const isGarantiaInterna = t.categoria === 'Garantía Interna';
  let aceptada = 'si';
  if (!isGarantiaInterna) {
    const selAcep = document.querySelector(`input[name="quick-cot-acep-${id}"]:checked`)?.value;
    if (!selAcep) {
      mostrarNotificacion('Debes indicar si fue aceptada o rechazada.', 'warning');
      return;
    }
    aceptada = selAcep;
  }
  let motivo = '';
  let pedidoSAP = '';
  let pdfPedidoBase64 = t.pdfPedido || null;
  let tecnicosAsignados = t.tecnicosAsignados || [];
  let tipoVisitaSeleccionado = 'Servicio';
  
  if (aceptada === 'no') {
    motivo = document.getElementById(`quick-motivo-text-${id}`)?.value.trim();
    if (!motivo) {
      mostrarNotificacion('Debes especificar el motivo del rechazo.', 'warning');
      return;
    }
  } else if (aceptada === 'si') {
    pedidoSAP = document.getElementById(`quick-ped-sap-${id}`)?.value.trim() || '';
    const pdfUpload = document.getElementById(`quick-ped-pdf-${id}`)?.files.length > 0;
    
    const selTipo = document.getElementById(`quick-tipo-${id}`)?.value;
    if (selTipo) {
      tipoVisitaSeleccionado = selTipo;
    }
    
    const bypass = isGarantiaInterna || (window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive()) || (window.currentSession && window.currentSession.viewMode === 'superadmin');
    if (!bypass) {
      if (!pedidoSAP) {
        mostrarNotificacion('Debes ingresar el Número de Pedido SAP.', 'warning');
        return;
      }
      if (!pdfUpload && !pdfPedidoBase64) {
        mostrarNotificacion('Debes adjuntar el archivo PDF del pedido.', 'warning');
        return;
      }
      
      const isBlocked = window._pedidoSapBlockedState && window._pedidoSapBlockedState[id];
      if (isBlocked) {
        mostrarNotificacion('No se puede cerrar el ticket debido a una discrepancia crítica entre el PDF y SAP.', 'error');
        return;
      }
    }
    
    if (pdfUpload) {
      try { pdfPedidoBase64 = await readFileAsBase64(document.getElementById(`quick-ped-pdf-${id}`).files[0]); } catch(e){}
    }
  }
  
  t.cotAceptada = aceptada;
  t.motivoRechazo = motivo;
  t.pedidoSAP = pedidoSAP;
  t.tecnicosAsignados = tecnicosAsignados;
  t.pdfPedido = pdfPedidoBase64;
  t.estado = 'Cerrado';
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  safeSetJSON('sapi_tickets', tickets);
  
  if (aceptada === 'si') {
    if (typeof window.ejecutarAutomatizacion === 'function') {
      window.ejecutarAutomatizacion('Cotización SAP aceptada por el cliente', {
        email: t.contacto || '',
        nombre_cliente: t.cliente || 'Cliente',
        folio_ticket: t.folio,
        monto_cotizacion: t.montoCotizacion ? window.formatMontoConComas(t.montoCotizacion) : '',
        estatus_ticket: t.estado,
        link: window.location.origin + '/cliente'
      });
    }
    if (window.esTicketDeServicioEnCampo(t)) {
      const ordenExistente = ordenes.find(o => o.soporte === t.id);
      if (!ordenExistente) {
        let modeloStr = '';
        let serieStr = '';
        let marcaStr = '';
        let ecoStr = '';
        let maquinariaId = null;

        if (t.equipo) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          
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

        let newFolio = generarFolioConsecutivo();
        const isTest = isTestData(t) || isTestModeActive();
        if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
          newFolio = `[PRUEBA] ${newFolio}`;
        }

        let refUtilizadasExtraidas = [];
        if (window.supabaseClient) {
          try {
            const { data: dbEx } = await window.supabaseClient
              .from('pdf_extracciones_ai')
              .select('conceptos')
              .eq('ticket_id', id)
              .order('fecha_extraccion', { ascending: false })
              .limit(1);
            if (dbEx && dbEx.length > 0 && dbEx[0].conceptos) {
              refUtilizadasExtraidas = dbEx[0].conceptos.map(c => {
                let matchedClave = '';
                const descUpper = (c.descripcion || '').trim().toUpperCase();
                if (descUpper && typeof refaccionesDb !== 'undefined') {
                  const match = refaccionesDb.find(r => (r.descripcion || '').toUpperCase().trim() === descUpper);
                  if (match) matchedClave = match.codigo || match.id || '';
                }
                return {
                  descripcion: c.descripcion || '',
                  cantidad: (c.cantidad || 1).toString(),
                  clave: matchedClave,
                  isFromPdf: true
                };
              });
            }
          } catch(err) {}
        }
        if (refUtilizadasExtraidas.length === 0 && window._lastPdfPedidoExtracted && window._lastPdfPedidoExtracted.mainArticulos) {
          refUtilizadasExtraidas = window._lastPdfPedidoExtracted.mainArticulos.map(c => {
            let matchedClave = '';
            const descUpper = (c.descripcion || '').trim().toUpperCase();
            if (descUpper && typeof refaccionesDb !== 'undefined') {
              const match = refaccionesDb.find(r => (r.descripcion || '').toUpperCase().trim() === descUpper);
              if (match) matchedClave = match.codigo || match.id || '';
            }
            return {
              descripcion: c.descripcion || '',
              cantidad: (c.cantidad || 1).toString(),
              clave: matchedClave,
              isFromPdf: true
            };
          });
        }

        let refNecesariasManuales = [];
        if (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
          refNecesariasManuales = t.refaccionesSeleccionadas.map(r => ({
            descripcion: r.nombre || r.descripcion || '',
            cantidad: (r.cantidad || 1).toString(),
            clave: r.codigo || r.clave || ''
          }));
        }

        const nuevaOrden = {
          id: newFolio,
          fecha: getLocalDateString(),
          folio: newFolio,
          pedido: pedidoSAP || '',
          cliente: t.cliente || '',
          ubicacion: t.sitio || '',
          ubicacion_sitio: '',
          operador: '', // Se preguntará en sitio
          eco: ecoStr || '',
          horometro: '',
          modelo: modeloStr,
          serie: serieStr,
          marca: marcaStr || '',
          maquinaria_id: maquinariaId || null,
          equipo: t.equipo || '',
          tecnico: tecnicosAsignados.join(', '),
          tecnicosAsignados: tecnicosAsignados,
          soporte: t.id,
          km_ida: '', km_vuelta: '', km_total: '',
          tipo: tipoVisitaSeleccionado,
          estado: 'Pendiente',
          falla: (t.asunto ? t.asunto + '\n' : '') + (t.descripcion || ''),
          trabajos: '', dictamen: '', condiciones: '',
          observaciones: '', pendientes: '',
          ref_utilizadas: refUtilizadasExtraidas, ref_necesarias: refNecesariasManuales,
          factura_ref: '', factura_mo: '',
          noches: '', alimentacion: '', traslado_costo: '',
          dias: [],
          esPrueba: isTest,
        };

        ordenes.unshift(nuevaOrden);
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          window.pushToSupabase('ordenes', nuevaOrden);
        }
        mostrarNotificacion('Orden de servicio pre-cargada y generada.', 'success');
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    } else {
      mostrarNotificacion(`Ticket de ${t.categoria || 'Garantía / Refacciones'} procesado para Guía de Envío.`, 'info');
    }
  }

  // Asegurar generación automática de Guía de Envío si el ticket tiene refacciones
  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    const isRefCat = String(t.categoria || '').toLowerCase().includes('refacci') || String(t.categoria || '').toLowerCase().includes('garant') || (t.folio && t.folio.endsWith('-A'));
    if (isRefCat || (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0)) {
      window.asegurarGuiaEnvioParaTicket(t);
    }
  }
  
  mostrarNotificacion('Ticket cerrado con éxito.', 'success');
  cerrarDetalleTicket();
  renderTickets();
  updateTicketBadge(); updateOrdenesBadge();
}

function cerrarDetalleTicket(e) {
  if (e && e.target !== document.getElementById('modal-ticket-detalle-overlay')) return;
  document.getElementById('modal-ticket-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

window.forzarEstadoTicket = async function(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:400px; padding:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
        <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
          <i data-lucide="zap" style="color:var(--accent);"></i> Forzar Estado (Superadmin)
        </h3>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-muted);">
          <i data-lucide="x"></i>
        </button>
      </div>
      
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">
        Cambiarás el estado del ticket <strong>${t.folio}</strong> saltando todas las validaciones.
      </p>

      <div class="form-group" style="margin-bottom:1.5rem;">
        <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.4rem; display:block;">Nuevo Estado:</label>
        <select id="forzar-estado-select" style="width:100%; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);">
          <option value="Abierto" ${t.estado === 'Abierto' ? 'selected' : ''}>Abierto</option>
          <option value="Refacciones" ${t.estado === 'Refacciones' ? 'selected' : ''}>Refacciones</option>
          <option value="Cotización" ${t.estado === 'Cotización' ? 'selected' : ''}>Cotización</option>
          <option value="Cerrado" ${t.estado === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
        </select>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button class="btn-primary" style="background:var(--accent); border-color:var(--accent);" id="btn-forzar-confirmar">Confirmar Cambio</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });

  overlay.querySelector('#btn-forzar-confirmar').addEventListener('click', async () => {
    const nuevoEstado = overlay.querySelector('#forzar-estado-select').value;
    const btn = overlay.querySelector('#btn-forzar-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="spin" data-lucide="loader"></i> Aplicando...';
    if (window.lucide) window.lucide.createIcons({ root: btn });

    t.estado = nuevoEstado;
    if (window.supabaseClient) {
      await window.pushToSupabase('tickets', t);
    }
    safeSetJSON('sapi_tickets', tickets);
    mostrarNotificacion(`Estado del ticket forzado a ${nuevoEstado}`, 'success');
    
    overlay.remove();
    cerrarDetalleTicket();
    renderTickets();
    updateTicketBadge(); updateOrdenesBadge();
  });
};

window.forzarCrearOrdenServicio = async function(id) {
  const isSuperadmin = (typeof currentSession !== 'undefined' && currentSession && 
    (currentSession.viewMode === 'superadmin' || currentSession.rol === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.userId === 'superadmin'));
  
  if (!isSuperadmin) {
    mostrarNotificacion('Solo los usuarios con rol Superadmin pueden forzar la creación de órdenes de servicio.', 'error');
    return;
  }

  let t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x && (x.id === id || x.folio === id)) : null;
  if (!t) {
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      t = local.find(x => x && (x.id === id || x.folio === id));
    } catch(e){}
  }
  if (!t) {
    mostrarNotificacion('No se encontró el ticket seleccionado.', 'error');
    return;
  }

  const existingOrder = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
  if (existingOrder) {
    const continuar = confirm(`Este ticket ya tiene una Orden de Servicio asociada (${existingOrder.folio || existingOrder.id}). ¿Estás seguro de que deseas forzar la creación de OTRA orden de servicio para este ticket?`);
    if (!continuar) return;
  }

  // Obtener lista de máquinas del cliente o catálogo general
  let maquinasOptions = [];
  const clienteNombre = t.cliente || '';
  if (clienteNombre && typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) {
    const cObj = clientesDb.find(c => c.nombre === clienteNombre || c.id === clienteNombre || c.idInterno === clienteNombre || c.rfc === clienteNombre);
    if (cObj && Array.isArray(cObj.maquinas)) {
      maquinasOptions = cObj.maquinas;
    }
  }
  if (maquinasOptions.length === 0 && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
    const normCli = String(clienteNombre).toLowerCase().trim();
    if (normCli) {
      maquinasOptions = maquinariaDb.filter(m => String(m.cliente || '').toLowerCase().trim() === normCli);
    }
  }

  // Obtener lista de técnicos disponibles
  const tecsSet = new Set();
  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) {
    tecnicosDb.forEach(tec => {
      const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(tec.nombre) : tec.nombre;
      if (n) tecsSet.add(n);
    });
  }
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    usuarios.filter(u => ['tecnico', 'supervisor', 'admin', 'superadmin'].includes(u.rol)).forEach(u => {
      const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(u.nombre) : u.nombre;
      if (n) tecsSet.add(n);
    });
  }
  const listaTecnicos = Array.from(tecsSet).sort();

  // Técnicos preasignados en el ticket
  let tecsAsignadosTicket = [];
  if (Array.isArray(t.tecnicosAsignados) && t.tecnicosAsignados.length > 0) {
    tecsAsignadosTicket = t.tecnicosAsignados;
  } else if (t.asignado) {
    tecsAsignadosTicket = String(t.asignado).split(',').map(s => s.trim()).filter(Boolean);
  }

  const tieneRefacciones = Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:560px; padding:1.5rem; max-height:90vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.6rem;">
        <h3 style="margin:0; font-size:1.15rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
          <i data-lucide="file-plus" style="color:#2563eb;"></i> Forzar Orden de Servicio (Superadmin)
        </h3>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-muted);">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div style="background: rgba(37, 99, 235, 0.06); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 8px; padding: 0.8rem 1rem; margin-bottom: 1.2rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem;">
          <div><span style="color:var(--text-muted);">Ticket:</span> <strong style="color:var(--text-primary);">${t.folio || t.id}</strong></div>
          <div><span style="color:var(--text-muted);">Estado:</span> <span class="badge badge-${typeof badgeTicketEstado === 'function' ? badgeTicketEstado(t) : 'abierto'}">${typeof getTicketEstadoLabel === 'function' ? getTicketEstadoLabel(t) : (t.estado || 'Abierto')}</span></div>
          <div style="grid-column: 1 / -1;"><span style="color:var(--text-muted);">Cliente:</span> <strong style="color:var(--text-primary);">${t.cliente || 'Sin cliente especificado'}</strong> ${t.sitio ? `(Sitio: ${t.sitio})` : ''}</div>
          <div style="grid-column: 1 / -1;"><span style="color:var(--text-muted);">Asunto:</span> <span style="color:var(--text-secondary);">${t.asunto || '—'}</span></div>
        </div>
      </div>

      <form id="form-forzar-orden" onsubmit="event.preventDefault();">
        <div class="form-group" style="margin-bottom:1rem;">
          <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.35rem; display:block;">Tipo de Visita / Servicio *</label>
          <select id="forzar-tipo-servicio" style="width:100%; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);">
            <option value="Servicio" ${(!t.tipo || t.tipo === 'Servicio') ? 'selected' : ''}>Servicio</option>
            <option value="Servicio preventivo" ${(t.tipo === 'Servicio preventivo' || (t.categoria && t.categoria.includes('Preventivo'))) ? 'selected' : ''}>Servicio preventivo</option>
            <option value="Servicio correctivo" ${(t.tipo === 'Servicio correctivo' || (t.categoria && t.categoria.includes('Correctivo'))) ? 'selected' : ''}>Servicio correctivo</option>
            <option value="Inspección" ${t.tipo === 'Inspección' ? 'selected' : ''}>Inspección</option>
            <option value="Entrega y puesta en marcha" ${(t.tipo === 'Entrega y puesta en marcha' || (t.categoria && t.categoria.includes('Puesta en Marcha'))) ? 'selected' : ''}>Entrega y puesta en marcha</option>
            <option value="Pre-entrega" ${(t.tipo === 'Pre-entrega' || (t.categoria && t.categoria.includes('Pre-Entrega'))) ? 'selected' : ''}>Pre-entrega</option>
            <option value="Garantía" ${(t.tipo === 'Garantía' || (t.categoria && t.categoria.includes('Garantía'))) ? 'selected' : ''}>Garantía</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:1rem;">
          <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.35rem; display:block;">Equipo / Maquinaria</label>
          <input type="text" id="forzar-equipo" value="${(t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo.replace(/"/g, '&quot;') : ''}" placeholder="Ej. [1234] CIFA K40H (SN: 9876)" style="width:100%; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);" />
          ${maquinasOptions.length > 0 ? `
            <div style="margin-top: 0.35rem; font-size: 0.75rem; color: var(--text-muted);">
              Sugerencias del cliente: 
              <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                ${maquinasOptions.slice(0, 6).map(m => {
                  const label = `${m.idInterno ? `[${m.idInterno}] ` : ''}${m.marca || ''} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
                  const safeLabel = label.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                  return `<button type="button" class="badge" style="cursor:pointer; background:var(--bg-card); border:1px solid var(--border); font-size:0.72rem; padding:2px 6px;" onclick="document.getElementById('forzar-equipo').value='${safeLabel}'">${label}</button>`;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="form-group" style="margin-bottom:1rem;">
          <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.35rem; display:block;">Técnicos Asignados</label>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; background: var(--bg-secondary);">
            ${listaTecnicos.length > 0 ? listaTecnicos.map(tec => {
              const checked = tecsAsignadosTicket.some(st => String(st).toLowerCase().trim() === String(tec).toLowerCase().trim() || String(st).includes(tec));
              return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; margin-bottom: 4px; cursor: pointer; color: var(--text-primary);">
                  <input type="checkbox" name="forzar-tecnicos" value="${tec.replace(/"/g, '&quot;')}" ${checked ? 'checked' : ''} />
                  <span>${tec}</span>
                </label>
              `;
            }).join('') : '<span style="font-size:0.8rem; color:var(--text-muted);">No hay técnicos disponibles en la base de datos</span>'}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:1rem;">
          <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.35rem; display:block;">No. Pedido SAP <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">(Opcional)</span></label>
          <input type="text" id="forzar-pedido-sap" value="${(t.pedidoSAP || '').replace(/"/g, '&quot;')}" placeholder="Ej. 10245" style="width:100%; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);" />
        </div>

        <div class="form-group" style="margin-bottom:1rem;">
          <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.35rem; display:block;">Falla / Descripción del Servicio</label>
          <textarea id="forzar-falla" rows="3" style="width:100%; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary); resize:vertical;">${((t.asunto ? t.asunto + '\n' : '') + (t.descripcion || '')).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>

        ${tieneRefacciones ? `
          <div class="form-group" style="margin-bottom:1.2rem; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.65rem 0.85rem;">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; font-weight:600; color:var(--text-primary); cursor:pointer;">
              <input type="checkbox" id="forzar-incluir-refacciones" checked />
              <span>Copiar ${t.refaccionesSeleccionadas.length} refacción(es) del ticket a la Orden de Servicio</span>
            </label>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.5rem; border-top:1px solid var(--border); padding-top:1rem;">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button type="button" class="btn-primary" style="background:#2563eb; border-color:#2563eb;" id="btn-forzar-orden-confirmar">
            <i data-lucide="file-plus" style="width:16px;height:16px;"></i> Crear y Vincular Orden
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });

  overlay.querySelector('#btn-forzar-orden-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-forzar-orden-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="spin" data-lucide="loader" style="width:16px;height:16px;"></i> Creando Orden...';
    if (window.lucide) window.lucide.createIcons({ root: btn });

    try {
      const tipoVal = overlay.querySelector('#forzar-tipo-servicio').value;
      const equipoVal = overlay.querySelector('#forzar-equipo').value.trim();
      const pedidoVal = overlay.querySelector('#forzar-pedido-sap').value.trim();
      const fallaVal = overlay.querySelector('#forzar-falla').value.trim();
      const incluirRef = overlay.querySelector('#forzar-incluir-refacciones')?.checked;

      const checkedTecs = Array.from(overlay.querySelectorAll('input[name="forzar-tecnicos"]:checked')).map(cb => cb.value);

      // 1. Extraer o asociar datos de maquinaria
      let modeloStr = '';
      let serieStr = '';
      let marcaStr = '';
      let ecoStr = '';
      let maquinariaId = null;

      const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
      
      const matchMaquina = (m, name) => {
        if (!m || !name) return false;
        const cleanId = m.idInterno || m.id || '';
        const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
        const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(cleanId) ||
          (m.serie && name.includes(m.serie))
        );
      };

      if (equipoVal) {
        const eqNames = equipoVal.split(',').map(s => s.trim()).filter(Boolean);
        const modelosArr = [];
        const seriesArr = [];
        const marcasArr = [];
        const ecosArr = [];

        eqNames.forEach(eqName => {
          let maq = null;
          if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) {
            clientesDb.forEach(c => {
              if (c.maquinas) {
                const found = c.maquinas.find(m => matchMaquina(m, eqName));
                if (found) maq = found;
              }
            });
          }
          if (!maq && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
            maq = maquinariaDb.find(m => matchMaquina(m, eqName));
          }

          if (maq) {
            if (maq.modelo) modelosArr.push(maq.modelo);
            if (maq.serie) seriesArr.push(maq.serie);
            if (maq.marca) marcasArr.push(maq.marca);
            if (maq.no_economico) ecosArr.push(maq.no_economico);
            if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
          } else {
            if (eqName.includes('(SN: ')) {
              const parts = eqName.split('(SN: ');
              const s = parts[1].replace(')', '').trim();
              let left = parts[0].trim();
              if (left.startsWith('[') && left.includes(']')) {
                left = left.substring(left.indexOf(']') + 1).trim();
              }
              modelosArr.push(left);
              seriesArr.push(s);
            } else {
              modelosArr.push(eqName);
            }
          }
        });

        modeloStr = [...new Set(modelosArr)].join(', ');
        serieStr = [...new Set(seriesArr)].join(', ');
        marcaStr = [...new Set(marcasArr)].join(', ');
        ecoStr = [...new Set(ecosArr)].join(', ');
      }

      // 2. Refacciones
      let refNecesariasManuales = [];
      if (incluirRef && t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
        refNecesariasManuales = t.refaccionesSeleccionadas.map(r => ({
          descripcion: r.nombre || r.descripcion || '',
          cantidad: (r.cantidad || 1).toString(),
          clave: r.codigo || r.clave || ''
        }));
      }

      // 3. Folio consecutivo
      let newFolio = (typeof generarFolioConsecutivo === 'function') ? generarFolioConsecutivo() : `OS-${Date.now()}`;
      const isTest = (typeof isTestData === 'function' && isTestData(t)) || (typeof isTestModeActive === 'function' && isTestModeActive());
      if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
        newFolio = `[PRUEBA] ${newFolio}`;
      }

      // 4. Crear objeto de Orden de Servicio
      const nuevaOrden = {
        id: newFolio,
        fecha: t.fechaCierre || t.fecha || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]),
        folio: newFolio,
        pedido: pedidoVal || t.pedidoSAP || '',
        cliente: t.cliente || '',
        ubicacion: t.sitio || '',
        ubicacion_sitio: '',
        operador: '',
        eco: ecoStr || '',
        horometro: t.horometro || '',
        modelo: modeloStr || '',
        serie: serieStr || '',
        marca: marcaStr || '',
        maquinaria_id: maquinariaId || null,
        equipo: equipoVal || t.equipo || '',
        tecnico: checkedTecs.join(', '),
        tecnicosAsignados: checkedTecs,
        soporte: t.id,
        km_ida: '', km_vuelta: '', km_total: '',
        tipo: tipoVal || 'Servicio',
        estado: 'Pendiente',
        falla: fallaVal || ((t.asunto ? t.asunto + '\n' : '') + (t.descripcion || '')),
        trabajos: '', dictamen: '', condiciones: '',
        observaciones: '', pendientes: '',
        ref_utilizadas: [],
        ref_necesarias: refNecesariasManuales,
        factura_ref: '', factura_mo: '',
        noches: '', alimentacion: '', traslado_costo: '',
        dias: [],
        esPrueba: isTest,
        _synced: false
      };

      // 5. Guardar orden
      if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
        ordenes.unshift(nuevaOrden);
      }
      safeSetJSON('sapi_ordenes', ordenes);

      if (window.supabaseClient) {
        await window.pushToSupabase('ordenes', nuevaOrden);
      }

      // 6. Actualizar ticket
      t.ordenId = nuevaOrden.id;
      t.ordenFolio = nuevaOrden.folio;
      
      const adminName = (currentSession && currentSession.nombre) ? currentSession.nombre : 'Superadmin';
      if (!Array.isArray(t.comentariosInternos)) t.comentariosInternos = [];
      t.comentariosInternos.push({
        id: 'com-' + Date.now(),
        usuario: adminName,
        rol: 'superadmin',
        texto: `Se forzó la creación de la Orden de Servicio ${nuevaOrden.folio} vinculada a este ticket.`,
        fecha: new Date().toISOString(),
        leidoPor: [{ usuario: adminName, fecha: new Date().toISOString() }]
      });

      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        await window.pushToSupabase('tickets', t);
      }

      mostrarNotificacion(`Orden de Servicio ${nuevaOrden.folio} generada y vinculada exitosamente.`, 'success');

      overlay.remove();

      // Refrescar UI
      if (typeof renderTickets === 'function') renderTickets();
      if (typeof renderTabla === 'function') renderTabla('servicios');
      if (typeof updateTicketBadge === 'function') updateTicketBadge();
      if (typeof updateOrdenesBadge === 'function') updateOrdenesBadge();

      // Si el detalle del ticket está abierto, refrescarlo para mostrar el banner de la nueva orden
      const overlayDetalle = document.getElementById('modal-ticket-detalle-overlay');
      if (overlayDetalle && overlayDetalle.classList.contains('open') && typeof verDetalleTicket === 'function') {
        verDetalleTicket(t.id);
      }

    } catch (err) {
      console.error('[ForzarCrearOrden] Error:', err);
      mostrarNotificacion('Error al generar la orden de servicio: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="file-plus" style="width:16px;height:16px;"></i> Reintentar Creación';
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  });
};

// ===== HELPER: GENERAR ID INTERNO MÁQUINA =====
function getSitioNombre(s) { return typeof s === 'string' ? s : (s?.nombre || ''); }
function getNombresDeSitiosParaCliente(clienteObj) {
  if (!clienteObj) return [];
  let cObj = typeof clienteObj === 'object' ? clienteObj : null;
  let rawVal = typeof clienteObj === 'string' ? clienteObj.trim() : '';

  if (!cObj && rawVal) {
    cObj = (clientesDb || []).find(c => c.nombre === rawVal || c.id === rawVal || c.idInterno === rawVal || c.rfc === rawVal);
  }

  const candidateKeys = new Set();
  if (rawVal) candidateKeys.add(rawVal.toLowerCase());
  if (cObj) {
    if (cObj.id) candidateKeys.add(String(cObj.id).toLowerCase());
    if (cObj.idInterno) candidateKeys.add(String(cObj.idInterno).toLowerCase());
    if (cObj.rfc) candidateKeys.add(String(cObj.rfc).toLowerCase());
    if (cObj.nombre) candidateKeys.add(String(cObj.nombre).toLowerCase());
  }

  // 1. Buscar en sitiosDb
  const sitiosFromDb = (sitiosDb || []).filter(s => {
    if (!s) return false;
    const sCli = String(s.cliente || '').toLowerCase();
    const sCliCustom = String(s.customData?.clienteNombre || '').toLowerCase();
    return candidateKeys.has(sCli) || (sCliCustom && candidateKeys.has(sCliCustom));
  }).map(s => s.nombre).filter(Boolean);

  // 2. Buscar en clienteObj.sitios
  let localSitios = [];
  if (cObj) {
    if (Array.isArray(cObj.sitios)) {
      localSitios = cObj.sitios.map(getSitioNombre).filter(Boolean);
    }
    if (cObj.ubicacion && !localSitios.includes(cObj.ubicacion)) {
      localSitios = [cObj.ubicacion, ...localSitios];
    }
  }

  // 3. Buscar en maquinariaDb
  const sitiosFromMaq = (maquinariaDb || []).filter(m => {
    if (!m) return false;
    const mCli = String(m.cliente || '').toLowerCase();
    return candidateKeys.has(mCli);
  }).map(m => m.ubicacion || m.sitio).filter(Boolean);

  const merged = [...new Set([...sitiosFromDb, ...localSitios, ...sitiosFromMaq])];
  return merged.filter(s => s && s.trim() !== '');
}

function generarIdInternoMaquina(marca, anioVenta) {
  const m = marca ? marca.trim().toUpperCase() : 'XX';
  let iniciales = m.replace(/[^A-Z]/g, '');
  if (iniciales.length < 2) {
    iniciales = (iniciales + 'XX').substring(0, 2);
  } else {
    iniciales = iniciales.substring(0, 2);
  }
  
  let yy = '';
  if (anioVenta) {
    if (anioVenta.includes('-')) {
      yy = anioVenta.split('-')[0].substring(2, 4);
    } else {
      yy = anioVenta.toString().substring(2, 4);
    }
  }
  if (!yy || yy.length !== 2) {
    yy = new Date().getFullYear().toString().substring(2, 4);
  }
  
  const prefix = iniciales + yy;
  
  let max = 0;
  
  // Revisar en clientesDb (manuales)
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(maq => {
        if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
          const num = parseInt(maq.idInterno.substring(prefix.length), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    }
  });

  // Revisar también en maquinariaDb (SAP)
  maquinariaDb.forEach(maq => {
    if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
      const num = parseInt(maq.idInterno.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  
  return prefix + (max + 1).toString().padStart(3, '0');
}

function agregarSitioClienteDesdeEmpresa() {
  const isEmpresa = currentSession.viewMode === 'empresa';
  if (isEmpresa) {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    agregarSitioCliente(currentUser ? (currentUser.empresa || currentUser.nombre) : '');
  } else {
    agregarSitioCliente('');
  }
}

function agregarSitioCliente(nombre) {
  document.getElementById('form-agregar-sitio').reset();
  const clientGroup = document.getElementById('s-cliente-group');
  const clientSelect = document.getElementById('s-cliente-select');
  const clientHidden = document.getElementById('s-cliente-nombre');
  const modalTitle = document.getElementById('modal-sitio-title');

  if (clientSelect) {
    clientSelect.innerHTML = '<option value="">-- Selecciona un cliente / empresa --</option>';
    const allClients = new Map();
    (clientesDb || []).forEach(c => {
      if (c && c.nombre && c.nombre.trim()) {
        allClients.set(c.nombre.trim(), c.id || c.nombre.trim());
      }
    });
    (maquinariaDb || []).forEach(m => {
      if (m && m.cliente && m.cliente.trim() && !allClients.has(m.cliente.trim())) {
        allClients.set(m.cliente.trim(), m.cliente.trim());
      }
    });

    const sortedNames = Array.from(allClients.keys()).sort((a, b) => a.localeCompare(b));
    sortedNames.forEach(cName => {
      const opt = document.createElement('option');
      opt.value = cName;
      opt.textContent = cName;
      clientSelect.appendChild(opt);
    });
  }

  const isEmpresa = currentSession.viewMode === 'empresa';

  if (nombre && String(nombre).trim()) {
    const cleanNombre = String(nombre).trim();
    if (clientHidden) clientHidden.value = cleanNombre;
    if (clientSelect) clientSelect.value = cleanNombre;
    if (clientGroup) clientGroup.style.display = 'none';
    if (modalTitle) modalTitle.textContent = 'Nuevo Sitio: ' + cleanNombre;
  } else {
    if (isEmpresa) {
      const currentUser = usuarios.find(u => u.id === currentSession.userId);
      const empName = currentUser ? (currentUser.empresa || currentUser.nombre) : '';
      if (clientHidden) clientHidden.value = empName;
      if (clientSelect) clientSelect.value = empName;
      if (clientGroup) clientGroup.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Nuevo Sitio: ' + (empName || 'Mi Empresa');
    } else {
      if (clientHidden) clientHidden.value = '';
      if (clientSelect) clientSelect.value = '';
      if (clientGroup) clientGroup.style.display = 'block';
      if (modalTitle) modalTitle.textContent = 'Nuevo Sitio / Obra';
    }
  }

  document.getElementById('modal-agregar-sitio-overlay').classList.add('open');
  setTimeout(() => {
    if (clientGroup && clientGroup.style.display !== 'none' && clientSelect) {
      clientSelect.focus();
    } else {
      document.getElementById('s-sitio-nombre')?.focus();
    }
  }, 50);
}

function cerrarModalSitio(e) {
  if (e && e.target !== document.getElementById('modal-agregar-sitio-overlay')) return;
  document.getElementById('modal-agregar-sitio-overlay').classList.remove('open');
}

async function guardarSitioCliente(e) {
  e.preventDefault();
  let nombre = (document.getElementById('s-cliente-nombre')?.value || '').trim();
  const selectVal = (document.getElementById('s-cliente-select')?.value || '').trim();
  const clientGroup = document.getElementById('s-cliente-group');

  if (clientGroup && clientGroup.style.display !== 'none' && selectVal) {
    nombre = selectVal;
  } else if (!nombre && selectVal) {
    nombre = selectVal;
  }

  if (!nombre) {
    mostrarNotificacion('Por favor selecciona o especifica una Empresa / Cliente.', 'warning');
    return;
  }

  const nuevoSitio = document.getElementById('s-sitio-nombre').value.trim();
  const cp = document.getElementById('s-sitio-cp')?.value.trim() || '';
  const ciudad = document.getElementById('s-sitio-ciudad')?.value.trim() || '';
  const estado = document.getElementById('s-sitio-estado')?.value.trim() || '';
  const direccion = document.getElementById('s-sitio-direccion')?.value.trim() || '';
  
  if (!nuevoSitio || nuevoSitio === '') {
    mostrarNotificacion('El nombre del sitio es obligatorio.', 'warning');
    return;
  }

  let clienteObj = clientesDb.find(c => c.nombre === nombre || c.id === nombre || c.idInterno === nombre || c.rfc === nombre);
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombre,
      maquinas: [],
      sitios: []
    };
    clientesDb.push(clienteObj);
  }

  if (!clienteObj.sitios) clienteObj.sitios = [];

  const clientDbId = clienteObj.id || nombre;
  const clientDbName = clienteObj.nombre || nombre;

  // 1. Guardar/Actualizar en sitiosDb
  let existSitioDb = (sitiosDb || []).find(s => {
    if (!s) return false;
    const sameCli = s.cliente === clienteObj.id || s.cliente === clienteObj.idInterno || s.cliente === clienteObj.rfc || s.cliente === clienteObj.nombre || s.cliente === nombre || s.customData?.clienteNombre === clientDbName;
    return sameCli && (s.nombre || '').toLowerCase() === nuevoSitio.toLowerCase();
  });

  if (!existSitioDb) {
    existSitioDb = {
      id: crypto.randomUUID(),
      nombre: nuevoSitio,
      cliente: clientDbId,
      direccion: direccion,
      cp: cp,
      ciudad: ciudad,
      estado: estado,
      customData: {
        ubicacion: nuevoSitio,
        clienteNombre: clientDbName,
        'Código Postal': cp,
        'Ciudad': ciudad,
        'Estado': estado,
        'Dirección': direccion
      },
      createdAt: new Date().toISOString()
    };
    sitiosDb.push(existSitioDb);
  } else {
    existSitioDb.direccion = direccion || existSitioDb.direccion;
    existSitioDb.cp = cp || existSitioDb.cp;
    existSitioDb.ciudad = ciudad || existSitioDb.ciudad;
    existSitioDb.estado = estado || existSitioDb.estado;
    if (!existSitioDb.customData) existSitioDb.customData = {};
    existSitioDb.customData.ubicacion = nuevoSitio;
    existSitioDb.customData.clienteNombre = clientDbName;
    if (cp) existSitioDb.customData['Código Postal'] = cp;
    if (ciudad) existSitioDb.customData['Ciudad'] = ciudad;
    if (estado) existSitioDb.customData['Estado'] = estado;
    if (direccion) existSitioDb.customData['Dirección'] = direccion;
  }

  localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
  if (window.pushToSupabase) {
    await window.pushToSupabase('sitios', existSitioDb);
  }

  // 2. Guardar en clienteObj.sitios para compatibilidad
  const siteInLegacyIdx = clienteObj.sitios.findIndex(s => getSitioNombre(s).toLowerCase() === nuevoSitio.toLowerCase());
  const siteObjLegacy = {
    nombre: nuevoSitio,
    direccion, cp, ciudad, estado
  };
  if (siteInLegacyIdx === -1) {
    clienteObj.sitios.push(siteObjLegacy);
  } else {
    clienteObj.sitios[siteInLegacyIdx] = Object.assign({}, clienteObj.sitios[siteInLegacyIdx], siteObjLegacy);
  }
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  if (window.pushToSupabase) {
    await window.pushToSupabase('clientes', clienteObj);
  }

  cerrarModalSitio();
  mostrarNotificacion(`Sitio "${nuevoSitio}" guardado correctamente.`, 'success');
  
  if (window._addingSiteFromTicket) {
    const clientLabel = document.getElementById('t-cliente-display')?.textContent || clientDbName;
    selectComboOption('t-cliente', clientDbName, clientLabel, true);
    selectComboOption('t-sitio', nuevoSitio, nuevoSitio);
    window._addingSiteFromTicket = false;
  } else if (currentSession.viewMode === 'empresa') {
    renderSitios();
  } else {
    if (document.getElementById('view-sitios')?.classList.contains('active')) {
      renderSitios();
    }
    if (document.getElementById('detalle-cliente-modal')?.classList.contains('open') || document.getElementById('modal-detalle-cliente')?.classList.contains('open')) {
      verDetalleCliente(clientDbName);
    }
  }
}

// ===== COLUMNAS AJUSTABLES =====
function initTableResizers() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach((table, tableIndex) => {
    const theadRow = table.querySelector('thead tr');
    if (!theadRow) return;

    // Load saved widths
    const storageKey = `table_widths_${tableIndex}`;
    const savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

    Array.from(theadRow.children).forEach((th, thIndex) => {
      // Evitar duplicar
      if (th.querySelector('.column-resizer')) {
        th.querySelector('.column-resizer').remove();
      }

      th.style.position = 'relative';
      
      // Apply saved width if exists
      if (savedWidths[thIndex]) {
        th.style.width = savedWidths[thIndex];
        th.style.minWidth = savedWidths[thIndex];
      } else {
        const currentWidth = window.getComputedStyle(th).width;
        if (currentWidth && currentWidth !== '0px' && currentWidth !== 'auto') {
          th.style.minWidth = currentWidth;
        }
      }

      const resizer = document.createElement('div');
      resizer.classList.add('column-resizer');
      resizer.style.width = '6px';
      resizer.style.height = '100%';
      resizer.style.position = 'absolute';
      resizer.style.right = '0';
      resizer.style.top = '0';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      resizer.style.zIndex = '1';
      
      resizer.addEventListener('mouseenter', () => resizer.style.borderRight = '2px solid var(--accent)');
      resizer.addEventListener('mouseleave', () => resizer.style.borderRight = 'none');
      
      th.appendChild(resizer);
      
      let startX = 0;
      let startWidth = 0;
      
      const mouseMoveHandler = function(e) {
        const dx = e.clientX - startX;
        const newWidth = `${startWidth + dx}px`;
        th.style.width = newWidth;
        th.style.minWidth = newWidth;
      };
      
      const mouseUpHandler = function() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        
        // Save new width
        savedWidths[thIndex] = th.style.width;
        localStorage.setItem(storageKey, JSON.stringify(savedWidths));
      };
      
      resizer.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        e.stopPropagation(); // Evita que se active el sort al arrastrar
      });
    });
  });
}

function inicializarTableResizersEvent() {
  setTimeout(initTableResizers, 500);
}


// =========================================================================
// MÓDULO CALENDARIO FULLCALENDAR Y GESTIÓN DE EVENTOS
// Extraído modularmente a calendario.js / src/modules/calendario.js (-1,183 líneas)
// =========================================================================

// ===== PASSWORD RECOVERY FLOW =====

function inicializarPasswordRecovery() {
  if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Mostrar la pantalla de actualización de contraseña
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-step-form').style.display = 'none';
        document.getElementById('login-step-recovery').style.display = 'none';
        document.getElementById('login-step-crear').style.display = 'none';
        document.getElementById('login-step-update-password').style.display = 'block';
        
        mostrarNotificacion('Sesión verificada. Ya puedes cambiar tu contraseña.', 'success');
      }
    });
  }
}


function abrirRecuperarPassword(e) {
  e.preventDefault();
  document.getElementById('login-step-form').style.display = 'none';
  document.getElementById('login-step-recovery').style.display = 'block';
  document.getElementById('recovery-email').value = document.getElementById('login-email').value || '';
}

function volverLoginDesdeRecovery() {
  document.getElementById('login-step-recovery').style.display = 'none';
  document.getElementById('login-step-form').style.display = 'block';
  document.getElementById('recovery-error').textContent = '';
}

async function enviarRecoveryLink(e) {
  e.preventDefault();
  const errEl = document.getElementById('recovery-error');
  let email = document.getElementById('recovery-email').value.trim();
  
  if (!email) return;
  
  // Si no contiene '@' o es un correo de celular ficticio (ej: 5548350555@eurorep.mx)
  const partBeforeAt = email.split('@')[0];
  const esTelefono = !email.includes('@') || (email.toLowerCase().endsWith('@eurorep.mx') && /^\d+$/.test(partBeforeAt));
  
  if (esTelefono) {
    const telefonoLimpio = partBeforeAt.replace(/\s+/g, '');
    errEl.innerHTML = `Las cuentas registradas con número celular no pueden recibir correos de recuperación.<br><br>Por favor, contacta al administrador de Eurorep por WhatsApp para restablecer tu contraseña:<br><br><a href="https://wa.me/525512345678?text=Hola,%20necesito%20restablecer%20mi%20contrase%C3%B1a%20para%20la%20cuenta%20de%20tel%C3%A9fono%20${telefonoLimpio}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; padding:0.5rem 1rem; border-radius:6px; font-weight:600; margin-top:0.5rem; justify-content:center; width:100%; box-sizing:border-box;"><i data-lucide="message-circle" style="width:1.2rem; height:1.2rem; color:#fff;"></i> Solicitar por WhatsApp</a>`;
    errEl.style.color = 'var(--text-primary)';
    if (window.lucide) {
      window.lucide.createIcons();
    }
    return;
  }
  
  errEl.textContent = 'Enviando enlace...';
  errEl.style.color = 'var(--text-secondary)';
  
  try {
    const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    
    if (error) {
      errEl.textContent = 'Error: ' + error.message;
      errEl.style.color = 'var(--red)';
    } else {
      errEl.textContent = '¡Enlace enviado! Revisa tu bandeja de entrada o spam. Ya puedes cerrar esta ventana.';
      errEl.style.color = 'var(--green)';
    }
  } catch (error) {
    errEl.textContent = 'Error de red. Intenta de nuevo.';
    errEl.style.color = 'var(--red)';
  }
}

async function guardarNuevaPassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('update-pass-error');
  const newPass = document.getElementById('new-password').value;
  
  if (newPass.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.style.color = 'var(--red)';
    return;
  }
  
  errEl.textContent = 'Actualizando contraseña...';
  errEl.style.color = 'var(--text-secondary)';
  
  try {
    const { data, error } = await window.supabaseClient.auth.updateUser({
      password: newPass
    });
    
    if (error) {
      errEl.textContent = 'Error al actualizar: ' + error.message;
      errEl.style.color = 'var(--red)';
    } else {
      mostrarNotificacion('¡Contraseña actualizada exitosamente!', 'success');
      document.getElementById('login-step-update-password').style.display = 'none';
      document.getElementById('login-step-form').style.display = 'block';
      document.getElementById('login-password').value = '';
    }
  } catch (error) {
    errEl.textContent = 'Error de red. Intenta de nuevo.';
    errEl.style.color = 'var(--red)';
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

window.setClientesSubView = function(subView) {
  const btnCatalogo = document.getElementById('btn-tab-cli-catalogo');
  const btnPortal = document.getElementById('btn-tab-cli-portal');
  const cntCatalogo = document.getElementById('clientes-catalogo-container');
  const cntPortal = document.getElementById('clientes-portal-container');
  
  if (!btnCatalogo || !btnPortal || !cntCatalogo || !cntPortal) return;
  
  if (subView === 'catalogo') {
    btnCatalogo.classList.add('active');
    btnCatalogo.style.background = 'var(--accent)';
    btnCatalogo.style.color = '#fff';
    btnCatalogo.style.borderColor = 'var(--accent)';
    
    btnPortal.classList.remove('active');
    btnPortal.style.background = 'var(--bg-card)';
    btnPortal.style.color = 'var(--text-primary)';
    btnPortal.style.borderColor = 'var(--border)';
    
    cntCatalogo.style.display = 'block';
    cntPortal.style.display = 'none';
  } else {
    btnPortal.classList.add('active');
    btnPortal.style.background = 'var(--accent)';
    btnPortal.style.color = '#fff';
    btnPortal.style.borderColor = 'var(--accent)';
    
    btnCatalogo.classList.remove('active');
    btnCatalogo.style.background = 'var(--bg-card)';
    btnCatalogo.style.color = 'var(--text-primary)';
    btnCatalogo.style.borderColor = 'var(--border)';
    
    cntCatalogo.style.display = 'none';
    cntPortal.style.display = 'block';
    
    renderPortalUsuariosList();
  }
  
  if (currentSession && typeof updateTopbarButtons === 'function') {
    updateTopbarButtons('clientes', currentSession.viewMode);
  }
};

window.renderPortalUsuariosList = function() {
  const tbody = document.getElementById('clientes-portal-table-body');
  if (!tbody) return;
  
  // Populate company select dropdown dynamically
  const selectEmpresa = document.getElementById('filtro-empresa-usuario-portal');
  if (selectEmpresa) {
    const currentSelected = selectEmpresa.value;
    selectEmpresa.innerHTML = '<option value="todas">Todas las Empresas</option>';
    const sortedClientes = [...clientesDb].sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));
    sortedClientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      selectEmpresa.appendChild(opt);
    });
    if (Array.from(selectEmpresa.options).some(o => o.value === currentSelected)) {
      selectEmpresa.value = currentSelected;
    }
  }

  const searchText = (document.getElementById('busqueda-usuario-portal')?.value || '').toLowerCase().trim();
  const filterEstado = document.getElementById('filtro-estado-usuario-portal')?.value || 'todos';
  const filterRol = document.getElementById('filtro-rol-usuario-portal')?.value || 'todos';
  const filterEmpresa = selectEmpresa?.value || 'todas';
  
  // Filter portal users (client-related roles only) and sort alphabetically
  let portalUsers = usuarios.filter(u => ['empresa', 'cliente', 'cliente-consultor'].includes(u.rol));
  portalUsers.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
  
  // Apply Search
  if (searchText) {
    portalUsers = portalUsers.filter(u => 
      (u.nombre && u.nombre.toLowerCase().includes(searchText)) || 
      (u.email && u.email.toLowerCase().includes(searchText)) ||
      (u.empresa && u.empresa.toLowerCase().includes(searchText))
    );
  }
  
  // Apply Estado Filter
  if (filterEstado === 'activos') {
    portalUsers = portalUsers.filter(u => u.activo !== false);
  } else if (filterEstado === 'pendientes') {
    portalUsers = portalUsers.filter(u => u.activo === false);
  }
  
  // Apply Rol Filter
  if (filterRol !== 'todos') {
    portalUsers = portalUsers.filter(u => u.rol === filterRol);
  }
  
  // Apply Empresa Filter
  if (filterEmpresa !== 'todas') {
    portalUsers = portalUsers.filter(u => {
      if (u.empresas && u.empresas.length > 0) {
        return u.empresas.includes(filterEmpresa);
      }
      return u.empresa && (u.empresa === filterEmpresa || u.empresa.toLowerCase() === filterEmpresa.toLowerCase());
    });
  }
  
  if (portalUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
          No se encontraron usuarios del portal de clientes.
        </td>
      </tr>
    `;
    return;
  }
  
  const ROLE_LABELS = {
    'empresa': 'Cliente',
    'cliente': 'Cliente',
    'cliente-consultor': 'Cliente Consultor'
  };
  
  const ROLE_COLORS = {
    'empresa': '#8b5cf6',
    'cliente': '#8b5cf6',
    'cliente-consultor': '#ec4899'
  };
  
  tbody.innerHTML = portalUsers.map(u => {
    // Resolve Associated Companies Display as modern chips/tags
    let empHtml = '';
    let empNamesDisplay = '';
    
    if (u.empresas && u.empresas.length > 0) {
      empNamesDisplay = u.empresas.map(empId => {
        const match = clientesDb.find(c => c.id === empId);
        return match ? match.nombre : empId;
      }).join(', ');
      
      empHtml = u.empresas.map(empId => {
        const match = clientesDb.find(c => c.id === empId);
        const name = match ? match.nombre : empId;
        return `<span style="display: inline-flex; align-items: center; background: var(--bg-hover, #f1f5f9); border: 1px solid var(--border, #e2e8f0); border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.72rem; color: var(--text-primary); font-weight: 600; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.1rem;" title="${name}">${name}</span>`;
      }).join('');
    } else {
      const fallbackName = u.empresa || 'Ninguna';
      empNamesDisplay = fallbackName;
      empHtml = `<span style="display: inline-flex; align-items: center; background: rgba(232, 130, 12, 0.08); border: 1px solid rgba(232, 130, 12, 0.15); border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.72rem; color: var(--orange, #e8820c); font-weight: 600; margin: 0.1rem;" title="${fallbackName}">${fallbackName}</span>`;
    }
    
    const isPending = (u.activo === false);
    const badgeColor = isPending ? 'background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);' : 'background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
    const badgeText = isPending ? 'Pendiente' : 'Activo';
    
    // Actions HTML
    const approveBtn = isPending ? `
      <button class="action-btn" onclick="aprobarUsuarioPortal('${u.id}')" title="Aprobar Acceso" style="color: #10b981; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: var(--radius-sm); padding: 0.3rem 0.5rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
        <i data-lucide="check" style="width:14px;height:14px;"></i>
      </button>
    ` : '';
    
    return `
      <tr style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s;" onmouseover="this.style.backgroundColor='var(--bg-hover, #f8fafc)'" onmouseout="this.style.backgroundColor='transparent'">
        <td style="padding: 0.85rem 1rem; vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${ROLE_COLORS[u.rol] || 'var(--accent)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              ${(u.nombre || '?')[0].toUpperCase()}
            </div>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">${u.nombre || 'Sin Nombre'}</div>
          </div>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; color: var(--text-secondary); font-family: monospace; font-size: 0.82rem;">
          ${u.email || ''}
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle;">
          <span class="badge" style="background: ${ROLE_COLORS[u.rol]}12; color: ${ROLE_COLORS[u.rol]}; border-radius: 20px; padding: 0.25rem 0.65rem; font-size: 0.72rem; font-weight: 700; border: 1px solid ${ROLE_COLORS[u.rol]}22; letter-spacing: 0.3px;">
            ${ROLE_LABELS[u.rol] || u.rol}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; line-height: 1.45;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center;" title="${empNamesDisplay}">
            ${empHtml}
          </div>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; text-align: center;">
          <span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.65rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; ${badgeColor} letter-spacing: 0.3px;">
            ${badgeText}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
            ${approveBtn}
            <button class="action-btn" onclick="window._modalUsuarioContexto = 'portal'; editarUsuario('${u.id}')" title="Editar" style="background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
              <i data-lucide="pencil" style="width:14px;height:14px; color: var(--text-secondary);"></i>
            </button>
            <button class="action-btn del" onclick="eliminarUsuario('${u.id}')" title="Borrar" style="background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
              <i data-lucide="trash-2" style="width:14px;height:14px; color: var(--red);"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
};

window.aprobarUsuarioPortal = async function(id) {
  if (!confirm('¿Estás seguro de que deseas aprobar el acceso a este usuario del portal?')) return;
  if (!window.supabaseClient) {
    alert('No hay conexión con Supabase');
    return;
  }
  
  try {
    const { error } = await window.supabaseClient
      .from('user_roles')
      .update({ activo: true })
      .eq('id', id);
      
    if (error) throw error;
    
    // Update local cache
    const match = usuarios.find(u => u.id === id);
    if (match) {
      match.activo = true;
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
      
      // Trigger Automation
      if (typeof window.ejecutarAutomatizacion === 'function') {
        window.ejecutarAutomatizacion('Activación de usuario en panel', {
          email: match.email,
          nombre_usuario: match.nombre,
          nombre_cliente: match.empresa || 'Cliente',
          link: window.location.origin + '/cliente'
        });
      }
    }
    
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Usuario aprobado con éxito', 'success');
    } else {
      alert('Usuario aprobado con éxito');
    }
    
    renderPortalUsuariosList();
    
    // Also refresh the general user list if the function exists
    if (typeof renderUsuariosList === 'function') {
      renderUsuariosList();
    }
  } catch (err) {
    console.error('Error approving user:', err);
    alert('Error al aprobar usuario: ' + err.message);
  }
};

// =========================================================================
// MÓDULO DE AUTOMATIZACIONES, REGLAS Y PLANTILLAS DE CORREO
// Extraído modularmente a automatizaciones.js / src/modules/automatizaciones.js (-937 líneas)
// =========================================================================

// ============================================================
// DIAGRAMA DE FLUJO INTERACTIVO (PREFERENCIAS)
// ============================================================
window.abrirModalDiagramaFlujo = function() {
  const modal = document.getElementById('modal-diagrama-flujo-overlay');
  const mainContent = document.getElementById('flowchart-main-content');
  const modalContent = document.getElementById('flowchart-modal-content');
  if (modal && mainContent && modalContent) {
    modalContent.innerHTML = mainContent.innerHTML;
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  }
};

window.cerrarModalDiagramaFlujo = function(e) {
  if (e && e.target && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('close-btn') && !e.target.closest('.close-btn')) return;
  const modal = document.getElementById('modal-diagrama-flujo-overlay');
  if (modal) modal.classList.remove('open');
};

let currentDiagramZoom = 1;
window.zoomDiagramaFlujo = function(delta) {
  const content = document.getElementById('flowchart-modal-content');
  if (!content) return;
  currentDiagramZoom = Math.max(0.6, Math.min(1.8, currentDiagramZoom + delta));
  content.style.transform = `scale(${currentDiagramZoom})`;
  content.style.transformOrigin = 'top center';
  const label = document.getElementById('diagrama-zoom-label');
  if (label) label.textContent = `${Math.round(currentDiagramZoom * 100)}%`;
};

window.resetZoomDiagramaFlujo = function() {
  const content = document.getElementById('flowchart-modal-content');
  if (!content) return;
  currentDiagramZoom = 1;
  content.style.transform = 'scale(1)';
  const label = document.getElementById('diagrama-zoom-label');
  if (label) label.textContent = '100%';
};

window.toggleSimbologiaFlujo = function() {
  const legend = document.getElementById('flowchart-legend-box');
  if (legend) {
    legend.style.display = legend.style.display === 'none' ? 'flex' : 'none';
  }
};

window.filtrarRutaDiagrama = function(ruta, btn) {
  document.querySelectorAll('.flowchart-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const container = document.getElementById('flowchart-main-content');
  const modalContainer = document.getElementById('flowchart-modal-content');
  
  [container, modalContainer].forEach(root => {
    if (!root) return;
    const nodes = root.querySelectorAll('.flowchart-card-node, .flow-connector-bridge, .flow-connector-v');
    nodes.forEach(n => {
      n.style.opacity = '1';
      n.style.filter = 'none';
    });

    if (ruta === 'normal') {
      root.querySelectorAll('.step-levantamiento, .step-garantia, .step-subticket').forEach(el => {
        el.style.opacity = '0.25';
        el.style.filter = 'grayscale(80%)';
      });
    } else if (ruta === 'levantamiento') {
      nodes.forEach(el => {
        if (!el.closest('.step-levantamiento') && !el.closest('.step-entrada')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    } else if (ruta === 'garantia') {
      nodes.forEach(el => {
        if (!el.closest('.step-garantia') && !el.closest('.step-os') && !el.closest('.step-cierre')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    } else if (ruta === 'subticket') {
      nodes.forEach(el => {
        if (!el.closest('.step-subticket') && !el.closest('.step-cotizacion') && !el.closest('.step-os')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    }
  });
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





