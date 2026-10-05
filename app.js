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





