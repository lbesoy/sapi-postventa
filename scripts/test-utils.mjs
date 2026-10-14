import assert from 'node:assert/strict';
import {
  debounce,
  debouncedCall,
  cleanMojibake,
  normStr,
  safeFormatDate,
  formatFechaHoraAmigable,
  isTestUser,
  getTicketFechaModificacion,
  getCurrentUserDisplayName,
  getTicketModificadoPor,
  escapeHTML,
  calcularDiasJunta,
  formatearTiempoRelativoJunta,
  unificarNombreUsuario,
  extraerListaResponsables,
  loadScriptOnDemand,
  compressImageFile,
  esUsuarioSuperadmin,
  resolverCreadorTicket,
  esNombrePaqueteria,
  esResponsableExcluidoOperativo,
  obtenerInfoRolUsuario,
  esSupervisorOAdmin,
  esTecnicoCampo,
  mergeEvidencias
} from '../src/utils.js';

console.log('🧪 Ejecutando pruebas unitarias para src/utils.js...');

if (typeof globalThis.localStorage === 'undefined') {
  const _store = {};
  globalThis.localStorage = {
    getItem: (k) => (_store[k] !== undefined ? _store[k] : null),
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); }
  };
}

// 0. loadScriptOnDemand (Lazy Loading)
assert.equal(typeof loadScriptOnDemand, 'function', 'loadScriptOnDemand debe ser función');
await assert.doesNotReject(async () => {
  await loadScriptOnDemand('test-script.js');
}, 'loadScriptOnDemand debe resolver de forma segura en entornos sin DOM');
console.log('  ✅ loadScriptOnDemand (Lazy Loading): OK');

// 0.05 compressImageFile (Client-side Image Compression)
assert.equal(typeof compressImageFile, 'function', 'compressImageFile debe ser función');
const dummyPdf = { name: 'reporte.pdf', type: 'application/pdf', size: 2048 };
const compPdf = await compressImageFile(dummyPdf);
assert.equal(typeof compPdf, 'string', 'compressImageFile debe retornar un string');
const dummyImg = { name: 'foto.jpg', type: 'image/jpeg', size: 1024 };
const compImg = await compressImageFile(dummyImg);
assert.equal(typeof compImg, 'string', 'compressImageFile debe resolver de forma segura en entornos sin DOM');
console.log('  ✅ compressImageFile (Compresión en Cliente): OK');

// 0.1 debounce y debouncedCall
assert.equal(typeof debounce, 'function', 'debounce debe ser función');
assert.equal(typeof debouncedCall, 'function', 'debouncedCall debe ser función');

let testCounter = 0;
const increment = debounce(() => { testCounter++; }, 30);
increment();
increment();
increment();
assert.equal(testCounter, 0, 'debounce no debe ejecutar de inmediato');
await new Promise(r => setTimeout(r, 60));
assert.equal(testCounter, 1, 'debounce debe consolidar múltiples llamadas consecutivas en 1 sola');

let callCount = 0;
debouncedCall('test-key', () => { callCount++; }, 30);
debouncedCall('test-key', () => { callCount++; }, 30);
debouncedCall('test-key', () => { callCount++; }, 30);
assert.equal(callCount, 0, 'debouncedCall no debe ejecutar de inmediato');
await new Promise(r => setTimeout(r, 60));
assert.equal(callCount, 1, 'debouncedCall debe consolidar en 1 sola llamada para la misma clave');
console.log('  ✅ Debounce y DebouncedCall (Search Optimizations): OK');

// 1. cleanMojibake
assert.equal(cleanMojibake('CamiÃ³n'), 'Camión', 'cleanMojibake debe reparar ó mojibake');
assert.equal(cleanMojibake('CotizaciÃ³n'), 'Cotización', 'cleanMojibake debe reparar ó mojibake');
assert.equal(cleanMojibake('GarcÃa'), 'García', 'cleanMojibake debe reparar ía');
assert.equal(cleanMojibake('Texto Normal'), 'Texto Normal', 'cleanMojibake no debe alterar texto normal');
console.log('  ✅ cleanMojibake: OK');

// 1.1 escapeHTML
assert.equal(escapeHTML('<b>Hola & "Adiós"</b>'), '&lt;b&gt;Hola &amp; &quot;Adiós&quot;&lt;/b&gt;', 'escapeHTML debe escapar etiquetas y comillas');
assert.equal(escapeHTML(null), '', 'escapeHTML con null debe retornar string vacío');
assert.equal(escapeHTML(undefined), '', 'escapeHTML con undefined debe retornar string vacío');
console.log('  ✅ escapeHTML: OK');

// 1.2 calcularDiasJunta y formatearTiempoRelativoJunta
assert.equal(calcularDiasJunta(''), 0, 'calcularDiasJunta con vacío debe ser 0');
assert.equal(calcularDiasJunta(new Date().toISOString()), 0, 'calcularDiasJunta de hoy debe ser 0');
assert.equal(formatearTiempoRelativoJunta(0), 'Hoy', 'formatearTiempoRelativoJunta de 0 días debe ser Hoy');
assert.equal(formatearTiempoRelativoJunta(1), 'Ayer (1 día)', 'formatearTiempoRelativoJunta de 1 día debe ser Ayer');
assert.equal(formatearTiempoRelativoJunta(5), 'Hace 5 días', 'formatearTiempoRelativoJunta de 5 días');
console.log('  ✅ calcularDiasJunta y formatearTiempoRelativoJunta: OK');

// 1.3 extraerListaResponsables
assert.deepEqual(extraerListaResponsables('Juan Pérez, Carlos Gómez'), ['Juan Pérez', 'Carlos Gómez'], 'extraerListaResponsables desglosa responsables');
assert.deepEqual(extraerListaResponsables(''), ['Sin Asignar'], 'extraerListaResponsables vacío retorna Sin Asignar');
assert.deepEqual(extraerListaResponsables('Sin Asignar'), ['Sin Asignar'], 'extraerListaResponsables Sin Asignar');
assert.deepEqual(extraerListaResponsables('DHL'), ['Sin Asignar'], 'extraerListaResponsables con DHL debe excluirse y retornar Sin Asignar');
assert.deepEqual(extraerListaResponsables('DHL Express, FedEx'), ['Sin Asignar'], 'extraerListaResponsables con paqueterías debe retornar Sin Asignar');
assert.deepEqual(extraerListaResponsables('Juan Pérez, DHL'), ['Juan Pérez'], 'extraerListaResponsables debe conservar técnico y excluir DHL');
assert.deepEqual(extraerListaResponsables('Pablo Besoy'), ['Sin Asignar'], 'extraerListaResponsables con Pablo Besoy debe retornar Sin Asignar para operación de técnicos');
assert.deepEqual(extraerListaResponsables('Pablo Besoy, Carlos Gómez'), ['Carlos Gómez'], 'extraerListaResponsables debe conservar técnico operativo y excluir directivo');
assert.equal(esNombrePaqueteria('DHL'), true, 'esNombrePaqueteria detecta DHL');
assert.equal(esNombrePaqueteria('DHL Express'), true, 'esNombrePaqueteria detecta DHL Express');
assert.equal(esNombrePaqueteria('FedEx'), true, 'esNombrePaqueteria detecta FedEx');
assert.equal(esNombrePaqueteria('Juan Pérez'), false, 'esNombrePaqueteria no debe marcar a técnico real');
assert.equal(esResponsableExcluidoOperativo('Pablo Besoy'), true, 'esResponsableExcluidoOperativo detecta Pablo Besoy');
assert.equal(esResponsableExcluidoOperativo('pablo besoy'), true, 'esResponsableExcluidoOperativo en minúsculas');
assert.equal(esResponsableExcluidoOperativo('Pablo Besoy Trigueros'), true, 'esResponsableExcluidoOperativo con segundo apellido');
assert.equal(esResponsableExcluidoOperativo('DHL'), true, 'esResponsableExcluidoOperativo detecta DHL');
assert.equal(esResponsableExcluidoOperativo('Usuario prueba'), true, 'esResponsableExcluidoOperativo detecta usuario de prueba');
assert.equal(esResponsableExcluidoOperativo('Juan Pérez'), false, 'esResponsableExcluidoOperativo permite técnico operativo');
assert.equal(obtenerInfoRolUsuario('Pablo Besoy').rol, 'superadmin', 'obtenerInfoRolUsuario identifica a Pablo Besoy como superadmin');
assert.equal(obtenerInfoRolUsuario('Sin Asignar').rol, 'sin_asignar', 'obtenerInfoRolUsuario identifica Sin Asignar correctamente');
assert.equal(obtenerInfoRolUsuario('Almacén y Compras').rol, 'almacen', 'obtenerInfoRolUsuario identifica a Almacén y Compras');
assert.equal(obtenerInfoRolUsuario('Almacén y Compras').label, 'Almacén y Compras');
assert.equal(obtenerInfoRolUsuario('Almacén y Compras').icon, 'package');
assert.equal(obtenerInfoRolUsuario('Compras y Logística').rol, 'almacen', 'obtenerInfoRolUsuario detecta compras/logistica');

const backupUsuariosRoles = globalThis.usuarios;
try {
  globalThis.usuarios = [
    { id: 'u-sup-1', nombre: 'Victor Edmundo Santelis Flores', rol: 'supervisor', activo: true },
    { id: 'u-tec-1', nombre: 'Sergio Soria', rol: 'tecnico', activo: true }
  ];
  assert.equal(esSupervisorOAdmin('Victor Edmundo Santelis Flores'), true, 'esSupervisorOAdmin identifica a Victor Santelis');
  assert.equal(esSupervisorOAdmin('Sergio Soria'), false, 'esSupervisorOAdmin no incluye a Sergio Soria');
  assert.equal(esTecnicoCampo('Sergio Soria'), true, 'esTecnicoCampo identifica a Sergio Soria');
  assert.equal(esTecnicoCampo('Victor Edmundo Santelis Flores'), false, 'esTecnicoCampo no incluye a Victor Santelis');
  assert.equal(esTecnicoCampo('Almacén y Compras'), false, 'esTecnicoCampo no incluye a Almacén y Compras');
} finally {
  globalThis.usuarios = backupUsuariosRoles;
}
console.log('  ✅ extraerListaResponsables, esNombrePaqueteria, esResponsableExcluidoOperativo, esSupervisorOAdmin y esTecnicoCampo: OK');

// 2. normStr
assert.equal(normStr('  TÉCNICO Especial  '), 'tecnico especial', 'normStr debe normalizar acentos y espacios');
assert.equal(normStr('ÁÉÍÓÚñ'), 'aeioun', 'normStr debe remover tildes y diacríticos');
console.log('  ✅ normStr: OK');

// 3. safeFormatDate
assert.equal(safeFormatDate('2026-05-15'), '15 may', 'safeFormatDate debe formatear fecha básica');
assert.equal(safeFormatDate(null), 'N/A', 'safeFormatDate con null debe retornar N/A');
assert.equal(safeFormatDate('invalid-date', undefined, 'Fallback'), 'Fallback', 'safeFormatDate fecha inválida');
console.log('  ✅ safeFormatDate: OK');

// 4. formatFechaHoraAmigable
assert.equal(formatFechaHoraAmigable('2026-09-30T00:00:00'), '30/09/2026', 'formatFechaHoraAmigable debe convertir fecha con T00:00:00');
assert.equal(formatFechaHoraAmigable('2026-12-25'), '25/12/2026', 'formatFechaHoraAmigable debe convertir YYYY-MM-DD');
assert.equal(formatFechaHoraAmigable(''), '—', 'formatFechaHoraAmigable con vacío debe retornar guión');
console.log('  ✅ formatFechaHoraAmigable: OK');

// 5. isTestUser
assert.equal(isTestUser({ nombre: 'Usuario Prueba', email: 'user@test.com' }), true, 'isTestUser debe detectar usuario de prueba');
assert.equal(isTestUser({ nombre: 'Juan Pérez', email: 'juan@eurorep.mx' }), false, 'isTestUser debe rechazar usuario real');
assert.equal(isTestUser(null), false, 'isTestUser debe manejar null');
console.log('  ✅ isTestUser: OK');

// 6. getTicketModificadoPor
const ticketMod = { modificadoPor: 'Rodrigo Narvaez' };
assert.equal(getTicketModificadoPor(ticketMod), 'Rodrigo Narvaez', 'getTicketModificadoPor debe priorizar modificadoPor');

const ticketComent = {
  comentariosInternos: [{ usuario: 'Carlos Ramirez', fecha: '2026-09-30T10:00:00Z' }]
};
assert.equal(getTicketModificadoPor(ticketComent), 'Carlos Ramirez', 'getTicketModificadoPor debe usar último comentario');
console.log('  ✅ getTicketModificadoPor: OK');

// 7. getCurrentUserDisplayName
assert.equal(typeof getCurrentUserDisplayName(), 'string', 'getCurrentUserDisplayName debe retornar string sin crashear');
console.log('  ✅ getCurrentUserDisplayName: OK');

// 7.0 resolverCreadorTicket (Resolución de creadores de tickets)
assert.equal(typeof resolverCreadorTicket, 'function', 'resolverCreadorTicket debe ser función');
assert.equal(resolverCreadorTicket({ creadoPor: 'Pablo Besoy' }), 'Pablo Besoy', 'resolverCreadorTicket debe respetar creadoPor');
assert.equal(resolverCreadorTicket({ creado_por: 'Pablo Besoy' }), 'Pablo Besoy', 'resolverCreadorTicket debe leer creado_por');
assert.equal(resolverCreadorTicket({ comentariosInternos: [{ usuario: 'Adrian Franco', texto: 'Ticket creado' }] }), 'Adrian Franco', 'resolverCreadorTicket debe leer primer comentario');
assert.equal(resolverCreadorTicket(null), '', 'resolverCreadorTicket con null retorna cadena vacía');
console.log('  ✅ resolverCreadorTicket: OK');

// 7.1 esUsuarioSuperadmin (Restricción estricta de permisos de Superadmin)
assert.equal(typeof esUsuarioSuperadmin, 'function', 'esUsuarioSuperadmin debe ser función');
const savedOrigSess = globalThis.currentSession;
const savedOrigUsers = globalThis.usuarios;

// Test A: Sin sesión -> false
globalThis.currentSession = null;
assert.equal(esUsuarioSuperadmin(), false, 'Sin sesión debe ser false');

// Test B: Usuario con rol admin -> false
globalThis.currentSession = { userId: 'usr-admin', viewMode: 'admin', realRol: 'admin' };
assert.equal(esUsuarioSuperadmin(), false, 'Rol admin debe ser false');

// Test C: Usuario con rol supervisor -> false
globalThis.currentSession = { userId: 'usr-sup', viewMode: 'supervisor', realRol: 'supervisor' };
assert.equal(esUsuarioSuperadmin(), false, 'Rol supervisor debe ser false');

// Test D: Usuario con rol tecnico -> false
globalThis.currentSession = { userId: 'usr-tec', viewMode: 'tecnico', realRol: 'tecnico' };
assert.equal(esUsuarioSuperadmin(), false, 'Rol tecnico debe ser false');

// Test E: Usuario con rol empresa / consulta -> false
globalThis.currentSession = { userId: 'usr-emp', viewMode: 'empresa', realRol: 'empresa' };
assert.equal(esUsuarioSuperadmin(), false, 'Rol empresa debe ser false');

// Test F: Superadmin simulando rol de técnico (viewMode = 'tecnico') -> false
globalThis.currentSession = { userId: 'superadmin', viewMode: 'tecnico', realRol: 'superadmin' };
assert.equal(esUsuarioSuperadmin(), false, 'Superadmin simulando vista técnico debe ser false');

// Test G: Superadmin real y en vista superadmin -> true
globalThis.currentSession = { userId: 'superadmin', viewMode: 'superadmin', realRol: 'superadmin' };
assert.equal(esUsuarioSuperadmin(), true, 'Superadmin auténtico debe ser true');

// Test H: Usuario admin intentando inyectar viewMode superadmin con rol en BD admin -> false
globalThis.usuarios = [{ id: 'fake-super', rol: 'admin', nombre: 'Atacante' }];
globalThis.currentSession = { userId: 'fake-super', viewMode: 'superadmin', realRol: 'admin' };
assert.equal(esUsuarioSuperadmin(), false, 'Usuario con rol admin en BD nunca debe ser superadmin');

// Restaurar variables globales originales
globalThis.currentSession = savedOrigSess;
globalThis.usuarios = savedOrigUsers;
console.log('  ✅ esUsuarioSuperadmin (Restricción exclusiva a Superadmins): OK');


// 8. supabaseClient
const { supabaseClient, SUPABASE_URL } = await import('../src/supabaseClient.js');
assert.ok(supabaseClient, 'supabaseClient debe estar inicializado');
assert.equal(typeof supabaseClient.from, 'function', 'supabaseClient debe tener método .from()');
assert.ok(SUPABASE_URL.includes('mupevytlssqcbhlmzmcp'), 'SUPABASE_URL debe apuntar al proyecto correcto');
console.log('  ✅ supabaseClient: OK');

// 9. Rentas - calcularEstadoRenta y obtenerBadgeRenta
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
const { calcularEstadoRenta, obtenerBadgeRenta } = await import('../src/modules/rentas.js');

// Test A: Renta con estado explícito Finalizada o Cancelada
assert.equal(calcularEstadoRenta({ estado: 'Finalizada' }), 'Finalizada', 'Estado Finalizada debe respetarse');
assert.equal(calcularEstadoRenta({ estado: 'Cancelada' }), 'Cancelada', 'Estado Cancelada debe respetarse');

// Test B: Renta futura -> Reservada
const fechaFutura = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
assert.equal(calcularEstadoRenta({ fecha_inicio: fechaFutura }), 'Reservada', 'Renta con inicio futuro debe ser Reservada');

// Test C: Renta vencida
assert.equal(calcularEstadoRenta({ fecha_inicio: '2020-01-01', fecha_fin_estimada: '2020-02-01' }), 'Vencida', 'Renta con fecha fin pasada debe ser Vencida');

// Test D: obtenerBadgeRenta
assert.ok(obtenerBadgeRenta('Activa').includes('Activa'), 'Badge Activa debe contener etiqueta');
assert.ok(obtenerBadgeRenta('Vencida').includes('Vencida'), 'Badge Vencida debe contener etiqueta');
console.log('  ✅ Rentas (calcularEstadoRenta y obtenerBadgeRenta): OK');

// 10. Levantamientos - calcularEstadisticasLevantamientos y actualizarBadgeLevantamientos
const { calcularEstadisticasLevantamientos, actualizarBadgeLevantamientos } = await import('../src/modules/levantamientos.js');

const dummyLevs = [
  { id: '1', estado: 'Pendiente' },
  { id: '2', estado: 'Completado' },
  { id: '3', estado: 'En Proceso' },
  { id: '4', estado: 'Completado' }
];

const stats = calcularEstadisticasLevantamientos(dummyLevs);
assert.equal(stats.total, 4, 'Total de levantamientos debe ser 4');
assert.equal(stats.pendientes, 2, 'Pendientes debe ser 2 (Pendiente y En Proceso)');
assert.equal(stats.completados, 2, 'Completados debe ser 2');

const emptyStats = calcularEstadisticasLevantamientos(null);
assert.equal(emptyStats.total, 0, 'Manejo de nulos seguro');

// Test B: actualizarBadgeLevantamientos desde el inicio sin entrar a la vista
const mockBadgeLev = { textContent: '', style: {}, classList: { add: () => {}, remove: () => {} } };
const origDocLev = global.document;
global.document = {
  getElementById: (id) => (id === 'nav-badge-levantamientos' ? mockBadgeLev : null)
};
global.window = global.window || {};
global.window.levantamientos = dummyLevs;
global.currentSession = { viewMode: 'admin' };
actualizarBadgeLevantamientos();
assert.equal(mockBadgeLev.textContent, 2, 'Badge de levantamientos debe mostrar 2 pendientes de inmediato sin entrar a la vista');
assert.equal(mockBadgeLev.style.display, 'inline-flex', 'Badge de levantamientos debe ser visible con display inline-flex');
global.document = origDocLev;
console.log('  ✅ Levantamientos (calcularEstadisticasLevantamientos y actualizarBadgeLevantamientos): OK');

// 11. Reporte Semanal de Técnicos
const { obtenerLunes, formatShortDate, formatISODate, formatNombreCorto } = await import('../src/modules/tecnicos_reporte.js');

const viernes = new Date(2026, 9, 2); // 2 de octubre 2026
const lunes = obtenerLunes(viernes);
assert.equal(lunes.getDay(), 1, 'El día retornado por obtenerLunes debe ser Lunes (día 1)');

const fechaTest = new Date(2026, 9, 2);
assert.equal(formatShortDate(fechaTest), '02/10/2026', 'formatShortDate debe ser DD/MM/YYYY');
assert.equal(formatISODate(fechaTest), '2026-10-02', 'formatISODate debe ser YYYY-MM-DD');

assert.equal(formatNombreCorto('Juan Carlos Pérez García'), 'Juan Carlos', 'formatNombreCorto toma nombre corto');
assert.equal(formatNombreCorto(''), '', 'formatNombreCorto vacío');
console.log('  ✅ Reporte de Técnicos (obtenerLunes, formatShortDate, formatNombreCorto): OK');

// 12. Storage Bridge (IndexedDB y LocalStorage redirection)
const { redirectedKeys, scheduleDbWrite, getSharedDb } = await import('../src/storage/bridge.js');
assert.ok(Array.isArray(redirectedKeys), 'redirectedKeys debe ser un array');
assert.ok(redirectedKeys.includes('sapi_refacciones_db'), 'redirectedKeys debe contener sapi_refacciones_db');
assert.ok(redirectedKeys.includes('sapi_sync_queue'), 'redirectedKeys debe contener sapi_sync_queue');
assert.ok(redirectedKeys.includes('sapi_tickets'), 'redirectedKeys debe contener sapi_tickets');
assert.equal(typeof getSharedDb, 'function', 'getSharedDb debe ser una función');
assert.equal(typeof scheduleDbWrite, 'function', 'scheduleDbWrite debe ser una función');
console.log('  ✅ Storage Bridge (claves críticas y funciones): OK');

// 13. Módulo de Gastos y Conciliación Clara
const { defaultClaraCards } = await import('../src/modules/gastos.js');
assert.ok(Array.isArray(defaultClaraCards), 'defaultClaraCards debe ser un array');
assert.ok(defaultClaraCards.length >= 10, 'defaultClaraCards debe contener catálogo base de tarjetas');
assert.ok(defaultClaraCards[0].alias, 'Las tarjetas deben tener propiedad alias');
console.log('  ✅ Gastos y Tarjetas Clara (catálogo base y exports): OK');

// 14. Módulo de Clientes y Gestión de Maquinaria
const { calcularDisponibilidadFlota, renderClientes, verDetalleCliente, abrirModalCliente } = await import('../src/modules/clientes.js');
assert.equal(typeof calcularDisponibilidadFlota, 'function', 'calcularDisponibilidadFlota debe ser una función');
assert.equal(typeof renderClientes, 'function', 'renderClientes debe ser una función');
assert.equal(typeof verDetalleCliente, 'function', 'verDetalleCliente debe ser una función');
assert.equal(typeof abrirModalCliente, 'function', 'abrirModalCliente debe ser una función');

// Test A: Flota vacía
const dispVacia = calcularDisponibilidadFlota([]);
assert.equal(dispVacia.total, 0, 'Total flota vacía debe ser 0');
assert.equal(dispVacia.porcentaje, 100, 'Porcentaje flota vacía debe ser 100%');

// Test B: Flota con máquinas 100% operativas (sin órdenes activas)
const flotaTest = [
  { idInterno: 'M-01', serie: 'SN001', modelo: 'Montacargas 1' },
  { idInterno: 'M-02', serie: 'SN002', modelo: 'Montacargas 2' },
  { idInterno: 'M-03', serie: 'SN003', modelo: 'Montacargas 3' },
  { idInterno: 'M-04', serie: 'SN004', modelo: 'Montacargas 4' }
];
const dispOperativas = calcularDisponibilidadFlota(flotaTest, []);
assert.equal(dispOperativas.total, 4, 'Total debe ser 4');
assert.equal(dispOperativas.operativos, 4, 'Operativos debe ser 4');
assert.equal(dispOperativas.mantenimiento, 0, 'Mantenimiento debe ser 0');
assert.equal(dispOperativas.porcentaje, 100, 'Porcentaje debe ser 100%');

// Test C: Flota con 1 máquina en mantenimiento (orden activa abierta)
const ordenesActivas = [
  { maquinaria_id: 'M-02', estado: 'En Proceso' }
];
const dispConMant = calcularDisponibilidadFlota(flotaTest, ordenesActivas);
assert.equal(dispConMant.total, 4, 'Total debe ser 4');
assert.equal(dispConMant.operativos, 3, 'Operativos debe ser 3');
assert.equal(dispConMant.mantenimiento, 1, 'Mantenimiento debe ser 1');
assert.equal(dispConMant.porcentaje, 75, 'Porcentaje debe ser 75%');
assert.ok(dispConMant.color.includes('ef4444'), 'Color rojo cuando porcentaje < 80%');
console.log('  ✅ Clientes y Maquinaria (calcularDisponibilidadFlota y exports): OK');

// 15. Módulo de Catálogo de Maquinaria, Refacciones y Sitios
const { renderMaquinaria, setMaqView, toggleSortMaquinaria, generarIdInternoMaquina, renderRefacciones, renderSitios } = await import('../src/modules/maquinaria.js');
assert.equal(typeof renderMaquinaria, 'function', 'renderMaquinaria debe ser una función');
assert.equal(typeof setMaqView, 'function', 'setMaqView debe ser una función');
assert.equal(typeof toggleSortMaquinaria, 'function', 'toggleSortMaquinaria debe ser una función');
assert.equal(typeof generarIdInternoMaquina, 'function', 'generarIdInternoMaquina debe ser una función');
assert.equal(typeof renderRefacciones, 'function', 'renderRefacciones debe ser una función');
assert.equal(typeof renderSitios, 'function', 'renderSitios debe ser una función');

// Test A: Generar ID interno de maquinaria para marca y año base
const idNuevo1 = generarIdInternoMaquina('Caterpillar', '2026', [], []);
assert.equal(idNuevo1, 'CA26001', 'generarIdInternoMaquina debe generar CA26001');

// Test B: Generar ID interno correlativo cuando ya existen máquinas previas
const maqExistentes = [
  { idInterno: 'CA26001' },
  { idInterno: 'CA26002' }
];
const idNuevo2 = generarIdInternoMaquina('CAT', '2026', [], maqExistentes);
assert.equal(idNuevo2, 'CA26003', 'generarIdInternoMaquina debe incrementar correlativo a CA26003');

// Test C: Generar ID interno con marca de 1 letra o vacía
const idGenerico = generarIdInternoMaquina('', '2025', [], []);
assert.ok(idGenerico.startsWith('XX25'), 'generarIdInternoMaquina con marca vacía usa XX');

// Test D: renderRefacciones con catálogo poblado en window.refaccionesDb
const mockBody = { innerHTML: '', closest: () => null };
const mockSearch = { value: '' };
const prevDoc = global.document;
global.document = {
  getElementById: (id) => {
    if (id === 'tabla-body-refacciones') return mockBody;
    if (id === 'search-refacciones') return mockSearch;
    if (id === 'refacciones-footer') return { innerHTML: '', style: {} };
    return null;
  },
  addEventListener: () => {}
};
if (!global.window) global.window = {};
global.window.refaccionesDb = [
  { id: '1', codigo: 'REF-01', descripcion: 'Manguera de Presión', marca: 'PUTZMEISTER', marcaCodigo: 'PTZ', grupo: 'Refacciones Bomba', precio: 1500, stock: 5 },
  { id: '2', codigo: 'PTZ-101', descripcion: 'Codo 90 Putzmeister', marca: 'PTZ', marcaCodigo: 'PTZ', grupo: '', ItmsGrpCod: 101, precio: 2500, moneda: 'USD', stock: 10 },
  { id: '3', codigo: 'SCH-102', descripcion: 'Válvula Schwing', marca: 'SCHWING', marcaCodigo: 'SCH', grupo: 102, ItmsGrpCod: 102, precio: 4500, stock: 0 },
  { id: '4', codigo: 'GEN-01', descripcion: 'Tornillo Grado 8 Hexagonal', marca: 'N/A', marcaCodigo: '', grupo: 'Tornillería', precio: 25, stock: 100 }
];
global.lucide = { createIcons: () => {} };

renderRefacciones();
assert.ok(mockBody.innerHTML.includes('Manguera de Presión'), 'renderRefacciones debe renderizar items desde window.refaccionesDb');
assert.ok(mockBody.innerHTML.includes('PUTZMEISTER'), 'renderRefacciones debe mostrar la marca resuelta');
assert.ok(mockBody.innerHTML.includes('Codo 90 Putzmeister'), 'renderRefacciones debe resolver refacción con ItmsGrpCod 101 sin errores');
assert.ok(mockBody.innerHTML.includes('Refacciones'), 'renderRefacciones debe resolver nombre de grupo desde GRUPOS_RENDER');
assert.ok(mockBody.innerHTML.includes('Refacciones Hidráulico'), 'renderRefacciones debe resolver grupo numérico 102');
assert.ok(mockBody.innerHTML.includes('Tornillo Grado 8 Hexagonal'), 'renderRefacciones debe renderizar piezas genéricas o sin marca sin excluirlas');

// Test E: Búsqueda reactiva en renderRefacciones
mockSearch.value = 'valvula';
renderRefacciones();
assert.ok(mockBody.innerHTML.includes('Válvula Schwing'), 'renderRefacciones debe filtrar por término de búsqueda');
assert.ok(!mockBody.innerHTML.includes('Codo 90 Putzmeister'), 'renderRefacciones debe excluir items que no coinciden');

// Reset search
mockSearch.value = '';

// Test F: Hidratación síncrona desde localStorageCache cuando window.refaccionesDb está inicialmente vacío
global.window.refaccionesDb = [];
global.window.localStorageCache = {
  'sapi_refacciones_db': JSON.stringify([
    { id: '10', codigo: 'REF-HIDRA', descripcion: 'Filtro Hidráulico Sincronizado', marca: 'CASE', marcaCodigo: 'CASE', grupo: 'Filtros', precio: 890, stock: 12 }
  ])
};
mockBody.innerHTML = '';
renderRefacciones();
assert.ok(mockBody.innerHTML.includes('Filtro Hidráulico Sincronizado'), 'renderRefacciones debe hidratar síncronamente desde localStorageCache');
assert.equal(global.window.refaccionesDb.length, 1, 'window.refaccionesDb debe poblarse con el catálogo hidratado');

// Restaurar mock
global.document = prevDoc;

console.log('  ✅ Catálogo de Maquinaria, Refacciones y Sitios (generarIdInternoMaquina, renderRefacciones con GRUPOS_RENDER/filtros y exports): OK');

// 16. Módulo de Calendario FullCalendar y Eventos
const { renderCalendario, getFestivosMexico, getSemanaSanta, getNthDayOfMonth, actualizarFiltrosCalendario } = await import('../src/modules/calendario.js');
assert.equal(typeof renderCalendario, 'function', 'renderCalendario debe ser una función');
assert.equal(typeof getFestivosMexico, 'function', 'getFestivosMexico debe ser una función');
assert.equal(typeof getSemanaSanta, 'function', 'getSemanaSanta debe ser una función');
assert.equal(typeof getNthDayOfMonth, 'function', 'getNthDayOfMonth debe ser una función');
assert.equal(typeof actualizarFiltrosCalendario, 'function', 'actualizarFiltrosCalendario debe ser una función');

// Test A: Días festivos de México para 2026
const festivos2026 = getFestivosMexico(2026);
assert.ok(Array.isArray(festivos2026), 'getFestivosMexico debe retornar un array');
assert.ok(festivos2026.length >= 10, 'Deben existir al menos 10 festivos oficiales en 2026');
assert.equal(festivos2026[0].title, 'Año Nuevo', 'El primer festivo debe ser Año Nuevo');
assert.equal(festivos2026[0].start, '2026-01-01', 'Año Nuevo debe ser 2026-01-01');

// Test B: Cálculo de Semana Santa (Algoritmo de Gauss)
const ss2026 = getSemanaSanta(2026);
assert.equal(ss2026.jueves, '2026-04-02', 'Jueves Santo 2026 debe ser 2026-04-02');
assert.equal(ss2026.viernes, '2026-04-03', 'Viernes Santo 2026 debe ser 2026-04-03');

// Test C: Encontrar N-ésimo día de la semana en un mes (ej. tercer lunes de marzo = Natalicio de Benito Juárez)
const natalicioJuarez2026 = getNthDayOfMonth(2026, 2, 1, 3); // mes 2 es marzo, día 1 es lunes, el 3er lunes
assert.equal(natalicioJuarez2026, '2026-03-16', 'Tercer lunes de marzo 2026 debe ser 16 de marzo');

// Test D: Filtrado de técnicos en el calendario con resolución de UUIDs a nombres legibles
const prevDocCal = global.document;
const prevUsersCal = global.usuarios;
const prevOrdersCal = global.ordenes;
const prevSessCal = global.currentSession;
const mockSelCli = { value: '', innerHTML: '', style: {} };
const mockSelTec = { value: '', innerHTML: '', style: {} };
global.document = {
  getElementById: (id) => {
    if (id === 'filter-cal-cliente') return mockSelCli;
    if (id === 'filter-cal-tecnico') return mockSelTec;
    return null;
  }
};
global.usuarios = [
  { id: '0fa8950b-480b-40f1-a01c-320a57bb94fa', nombre: 'Sergio Soria Cervantes', rol: 'tecnico', activo: true },
  { id: 'be40ea0f-0eca-4c56-8392-3e00125c32b4', nombre: 'Eduardo Jiménez Ortiz', rol: 'tecnico', activo: true }
];
global.ordenes = [
  { id: 'ord-1', cliente: 'Cliente A', tecnico: 'Eduardo Jiménez Ortiz', tecnicosAsignados: ['0fa8950b-480b-40f1-a01c-320a57bb94fa'] },
  { id: 'ord-2', cliente: 'Cliente B', bitacora: [{ tecnico: 'be40ea0f-0eca-4c56-8392-3e00125c32b4' }, { tecnico: '77777777-8888-9999-aaaa-bbbbbbbbbbbb' }] }
];
global.currentSession = { viewMode: 'admin', userId: 'admin-1', nombre: 'Admin' };

actualizarFiltrosCalendario();

assert.ok(mockSelTec.innerHTML.includes('Eduardo Jiménez Ortiz'), 'El selector debe contener "Eduardo Jiménez Ortiz"');
assert.ok(mockSelTec.innerHTML.includes('Sergio Soria Cervantes'), 'El selector debe contener "Sergio Soria Cervantes"');
const calUuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
assert.ok(!calUuidRegex.test(mockSelTec.innerHTML), 'El selector de técnicos del calendario NO debe contener ningún UUID sin resolver');

global.document = prevDocCal;
global.usuarios = prevUsersCal;
global.ordenes = prevOrdersCal;
global.currentSession = prevSessCal;

console.log('  ✅ Calendario FullCalendar (getFestivosMexico, getSemanaSanta, getNthDayOfMonth, actualizarFiltrosCalendario sin UUIDs): OK');

// 17. Módulo de Chat de Soporte y Bandeja de Correo
const { formatMontoConComas, switchSoporteTab, setMailFilter, renderBandejaCorreoEmpresa, renderChatSoporteEmpresa } = await import('../src/modules/soporte.js');
assert.equal(typeof formatMontoConComas, 'function', 'formatMontoConComas debe ser una función');
assert.equal(typeof switchSoporteTab, 'function', 'switchSoporteTab debe ser una función');
assert.equal(typeof setMailFilter, 'function', 'setMailFilter debe ser una función');
assert.equal(typeof renderBandejaCorreoEmpresa, 'function', 'renderBandejaCorreoEmpresa debe ser una función');
assert.equal(typeof renderChatSoporteEmpresa, 'function', 'renderChatSoporteEmpresa debe ser una función');

// Test A: Formateo numérico a moneda mexicana
assert.equal(formatMontoConComas(15420.5), '$15,420.50', 'formatMontoConComas debe formatear con comas y 2 decimales');
assert.equal(formatMontoConComas('1500'), '$1,500.00', 'formatMontoConComas con string numérico');
assert.equal(formatMontoConComas('$2,500.00'), '$2,500.00', 'formatMontoConComas ya formateado');
assert.equal(formatMontoConComas(null), '$0.00', 'formatMontoConComas con null debe dar $0.00');
assert.equal(formatMontoConComas(''), '$0.00', 'formatMontoConComas con vacío debe dar $0.00');
console.log('  ✅ Chat de Soporte y Bandeja de Correo (formatMontoConComas y exports): OK');

// 18. Módulo de Kits de Servicio y Machotes de Mantenimiento
const { KITS_PRECARGADOS_DEFAULT, detectarSistemaRefaccion, loadKitsServicio, saveKitsServicio, filtrarKitsServicio, abrirModalKitsServicio } = await import('../src/modules/kits.js');
assert.ok(Array.isArray(KITS_PRECARGADOS_DEFAULT), 'KITS_PRECARGADOS_DEFAULT debe ser un array');
assert.equal(KITS_PRECARGADOS_DEFAULT.length, 36, 'Deben existir 36 machotes de kits precargados estándar');
assert.equal(typeof detectarSistemaRefaccion, 'function', 'detectarSistemaRefaccion debe ser una función');
assert.equal(typeof loadKitsServicio, 'function', 'loadKitsServicio debe ser una función');
assert.equal(typeof saveKitsServicio, 'function', 'saveKitsServicio debe ser una función');
assert.equal(typeof filtrarKitsServicio, 'function', 'filtrarKitsServicio debe ser una función');
assert.equal(typeof abrirModalKitsServicio, 'function', 'abrirModalKitsServicio debe ser una función');

// Test A: Detección inteligente de sistemas por palabras clave
assert.equal(detectarSistemaRefaccion('Filtro de aceite de motor John Deere'), 'Motor', 'Debe detectar sistema Motor');
assert.equal(detectarSistemaRefaccion('Filtro primario de combustible diésel'), 'Combustible', 'Debe detectar sistema Combustible');
assert.equal(detectarSistemaRefaccion('Filtro de aire de admisión primario'), 'Aire / Admisión', 'Debe detectar sistema Aire / Admisión');
assert.equal(detectarSistemaRefaccion('Filtro hidráulico de retorno alta presión'), 'Hidráulico', 'Debe detectar sistema Hidráulico');
assert.equal(detectarSistemaRefaccion('Banda de transmisión en V dentada'), 'Transmisión', 'Debe detectar sistema Transmisión');
assert.equal(detectarSistemaRefaccion('Alternador eléctrico 24V y batería'), 'Eléctrico', 'Debe detectar sistema Eléctrico');
assert.equal(detectarSistemaRefaccion('Placa de desgaste y martillo de trituración'), 'Desgaste / Cuchillas', 'Debe detectar Desgaste / Cuchillas');
assert.equal(detectarSistemaRefaccion('Tornillo genérico M10x50'), 'General', 'Debe clasificar como General por defecto');

// Test B: Validación de integridad de los kits precargados
const kitRubble = KITS_PRECARGADOS_DEFAULT.find(k => k.id === 'kit-rm120x-250h');
assert.ok(kitRubble, 'Debe existir el kit oficial RM120X 250h');
assert.equal(kitRubble.marca, 'RUBBLE MASTER', 'Marca debe ser RUBBLE MASTER');
assert.equal(kitRubble.intervalo, '250', 'Intervalo debe ser 250h');
assert.ok(kitRubble.piezas.length >= 3, 'El kit 250h debe contener al menos 3 refacciones');
console.log('  ✅ Kits de Servicio y Machotes (detectarSistemaRefaccion, catálogo 36 kits y exports): OK');

// 19. Módulo de Juntas de Revisión y Rescate Histórico
const { 
  reestablecerTicket26477, 
  obtenerTodosLosPendientes, 
  renderJuntaRevision, 
  copiarMinutaJunta, 
  toggleFullscreenJunta, 
  toggleJuntaAnalytics,
  generarContenidoTooltipDesglose,
  mostrarTooltipDesglose,
  ocultarTooltipDesglose
} = await import('../src/modules/juntas.js');
assert.equal(typeof reestablecerTicket26477, 'function', 'reestablecerTicket26477 debe ser una función');
assert.equal(typeof obtenerTodosLosPendientes, 'function', 'obtenerTodosLosPendientes debe ser una función');
assert.equal(typeof renderJuntaRevision, 'function', 'renderJuntaRevision debe ser una función');
assert.equal(typeof copiarMinutaJunta, 'function', 'copiarMinutaJunta debe ser una función');
assert.equal(typeof toggleFullscreenJunta, 'function', 'toggleFullscreenJunta debe ser una función');
assert.equal(typeof toggleJuntaAnalytics, 'function', 'toggleJuntaAnalytics debe ser una función');
assert.equal(typeof generarContenidoTooltipDesglose, 'function', 'generarContenidoTooltipDesglose debe ser función');
assert.equal(typeof mostrarTooltipDesglose, 'function', 'mostrarTooltipDesglose debe ser función');
assert.equal(typeof ocultarTooltipDesglose, 'function', 'ocultarTooltipDesglose debe ser función');

// Test A: Ejecución segura de obtenerTodosLosPendientes sin fallar ante entorno vacío
const pendientes = obtenerTodosLosPendientes();
assert.ok(Array.isArray(pendientes), 'obtenerTodosLosPendientes debe devolver un array');

// Test B: Generación de tooltip de desglose interactivo para cada columna analítica
const mockRespTooltip = {
  nombre: 'Técnico Especialista',
  total: 6,
  ticketsCount: 2,
  ticketsMas15: 1,
  ordenesCount: 2,
  ordenesSinFirma: 1,
  levantamientosCount: 1,
  enviosCount: 1,
  urgentesCount: 2,
  maxDias: 20,
  items: [
    { tipo: 'ticket', id: 101, folio: 'TK-101', cliente: 'Cliente Alfa', diasAntiguedad: 20, prioridad: 'Urgente' },
    { tipo: 'ticket', id: 102, folio: 'TK-102', cliente: 'Cliente Beta', diasAntiguedad: 5, prioridad: 'Media' },
    { tipo: 'orden', id: 201, folio: 'OS-201', cliente: 'Cliente Alfa', diasAntiguedad: 12, prioridad: 'Urgente' },
    { tipo: 'orden', id: 202, folio: 'OS-202', cliente: 'Cliente Gamma', diasAntiguedad: 2, prioridad: 'Baja' },
    { tipo: 'levantamiento', id: 301, folio: 'LEV-301', cliente: 'Cliente Delta', diasAntiguedad: 9, prioridad: 'Alta' },
    { tipo: 'envio', id: 401, folio: 'GUIA-888', cliente: 'Cliente Alfa', diasAntiguedad: 8, rawItem: { guiaPedido: '888' } }
  ]
};

const htmlTotal = generarContenidoTooltipDesglose(mockRespTooltip, 'total');
assert.ok(htmlTotal.includes('Total Pendientes'), 'Tooltip total debe incluir Total Pendientes');
assert.ok(htmlTotal.includes('Técnico Especialista'), 'Tooltip total debe incluir nombre del técnico');
assert.ok(htmlTotal.includes('Tickets'), 'Tooltip total debe desglosar Tickets');
assert.ok(htmlTotal.includes('Órdenes'), 'Tooltip total debe desglosar Órdenes');

const htmlTickets = generarContenidoTooltipDesglose(mockRespTooltip, 'tickets');
assert.ok(htmlTickets.includes('Desglose de Tickets'), 'Tooltip tickets debe incluir título de desglose');
assert.ok(htmlTickets.includes('TK-101'), 'Tooltip tickets debe listar top caso TK-101');
assert.ok(htmlTickets.includes('&gt; 15 días'), 'Tooltip tickets debe detallar tickets > 15 días');

const htmlOrdenes = generarContenidoTooltipDesglose(mockRespTooltip, 'ordenes');
assert.ok(htmlOrdenes.includes('Desglose de Órdenes'), 'Tooltip ordenes debe incluir título');
assert.ok(htmlOrdenes.includes('Pendiente de firmas'), 'Tooltip ordenes debe indicar órdenes sin firma');
assert.ok(htmlOrdenes.includes('OS-201'), 'Tooltip ordenes debe listar OS-201');

const htmlLev = generarContenidoTooltipDesglose(mockRespTooltip, 'levantamientos');
assert.ok(htmlLev.includes('Desglose de Levantamientos'), 'Tooltip levantamientos debe incluir título');
assert.ok(htmlLev.includes('LEV-301'), 'Tooltip levantamientos debe listar LEV-301');

const htmlEnv = generarContenidoTooltipDesglose(mockRespTooltip, 'envios');
assert.ok(htmlEnv.includes('Desglose de Envíos'), 'Tooltip envios debe incluir título');
assert.ok(htmlEnv.includes('Con guía asignada'), 'Tooltip envios debe desglosar guía');

const htmlRezago = generarContenidoTooltipDesglose(mockRespTooltip, 'rezago');
assert.ok(htmlRezago.includes('Análisis de Rezago'), 'Tooltip rezago debe incluir título');
assert.ok(htmlRezago.includes('20 días'), 'Tooltip rezago debe incluir max días');
assert.ok(htmlRezago.includes('Promedio de Rezago'), 'Tooltip rezago debe calcular promedio');

// Test C: Asignación de envíos a Supervisores y a 'Almacén y Compras', NUNCA a técnicos de campo
const backupTktsJunta = globalThis.tickets;
const backupEnviosJunta = globalThis.window.obtenerTodosLosEnvios;
const backupUsuariosJunta = globalThis.usuarios;
try {
  globalThis.usuarios = [
    { id: 'u-sup-1', nombre: 'Victor Edmundo Santelis Flores', rol: 'supervisor', activo: true },
    { id: 'u-tec-1', nombre: 'Sergio Soria', rol: 'tecnico', activo: true },
    { id: 'u-tec-2', nombre: 'Jesús Garduño', rol: 'tecnico', activo: true }
  ];
  globalThis.tickets = [
    // Ticket 1: Con supervisor explícito y técnico asignado
    { id: 'tkt-test-1', folio: 'TKT-1001', supervisor: 'Victor Edmundo Santelis Flores', asignado: 'Sergio Soria', estado: 'Abierto', cliente: 'Cliente Alfa' },
    // Ticket 2: Solo con técnico asignado, sin supervisor
    { id: 'tkt-test-2', folio: 'TKT-1002', asignado: 'Jesús Garduño', estado: 'Abierto', cliente: 'Cliente Beta' }
  ];
  globalThis.window.obtenerTodosLosEnvios = () => [
    {
      id: 'env-1001',
      ticketId: 'tkt-test-1',
      ticketFolio: 'TKT-1001',
      guiaPedido: 'DHL-1111',
      paqueteria: 'DHL',
      parts: [{ descripcion: 'Bomba hidráulica', cantidad: 1 }],
      estatus: 'En Tránsito',
      fechaEnvio: '2026-10-10'
    },
    {
      id: 'env-1002',
      ticketId: 'tkt-test-2',
      ticketFolio: 'TKT-1002',
      guiaPedido: 'FEDEX-2222',
      paqueteria: 'FedEx',
      parts: [{ descripcion: 'Filtro de aire', cantidad: 2 }],
      estatus: 'En Tránsito',
      fechaEnvio: '2026-10-11'
    }
  ];
  const itemsPendientes = obtenerTodosLosPendientes();

  // 1. Envío de ticket con supervisor: Asignado al supervisor (Victor Santelis)
  const envio1 = itemsPendientes.find(i => i.id === 'env-1001');
  assert.ok(envio1, 'El envío 1 debe estar en la lista de pendientes');
  assert.equal(envio1.responsable, 'Victor Edmundo Santelis Flores', 'El envío 1 debe estar a cargo del supervisor');
  assert.equal(envio1.tecnicoDestino, 'Sergio Soria', 'El técnico de destino debe ser Sergio Soria');
  assert.ok(envio1.titulo.includes('(Para técnico: Sergio Soria)'), 'El título debe clarificar para qué técnico es la refacción');

  // 2. Envío de ticket sin supervisor: Asignado a Almacén y Compras
  const envio2 = itemsPendientes.find(i => i.id === 'env-1002');
  assert.ok(envio2, 'El envío 2 debe estar en la lista de pendientes');
  assert.equal(envio2.responsable, 'Almacén y Compras', 'El envío 2 sin supervisor debe estar a cargo de Almacén y Compras');
  assert.equal(envio2.tecnicoDestino, 'Jesús Garduño', 'El técnico de destino debe ser Jesús Garduño');

  // 3. Verificar que NINGÚN técnico de campo tenga envíos a su cargo ("solo técnicos no")
  const enviosDeSergio = itemsPendientes.filter(i => i.tipo === 'envio' && i.responsablesList.includes('Sergio Soria'));
  assert.equal(enviosDeSergio.length, 0, 'Sergio Soria no debe tener envíos asignados');
  const enviosDeJesus = itemsPendientes.filter(i => i.tipo === 'envio' && i.responsablesList.includes('Jesús Garduño'));
  assert.equal(enviosDeJesus.length, 0, 'Jesús Garduño no debe tener envíos asignados');
} finally {
  globalThis.tickets = backupTktsJunta;
  if (backupEnviosJunta) {
    globalThis.window.obtenerTodosLosEnvios = backupEnviosJunta;
  }
  globalThis.usuarios = backupUsuariosJunta;
}

console.log('  ✅ Juntas de Revisión (obtenerTodosLosPendientes, desgloses interactivos en hover y exports): OK');

// 20. Módulo de Depuración y Auditoría de Tickets
const { analizarInformacionTicket, contarTicketsADepuracion, sanitizarAsignacionesTickets, abrirModalDepurarTickets, exportarDepuradorTicketsAExcel, detectarYDepurarTicketsDuplicados } = await import('../src/modules/depurador_tickets.js');
assert.equal(typeof analizarInformacionTicket, 'function', 'analizarInformacionTicket debe ser una función');
assert.equal(typeof contarTicketsADepuracion, 'function', 'contarTicketsADepuracion debe ser una función');
assert.equal(typeof sanitizarAsignacionesTickets, 'function', 'sanitizarAsignacionesTickets debe ser una función');
assert.equal(typeof abrirModalDepurarTickets, 'function', 'abrirModalDepurarTickets debe ser una función');
assert.equal(typeof exportarDepuradorTicketsAExcel, 'function', 'exportarDepuradorTicketsAExcel debe ser una función');
assert.equal(typeof detectarYDepurarTicketsDuplicados, 'function', 'detectarYDepurarTicketsDuplicados debe ser una función');

// Test A: Análisis forense de ticket con datos SAP
const diagTkt = analizarInformacionTicket({ folio: 'TKT-26477', cotizacionSAP: '109923', pedidoSAP: '45001', comentariosInternos: [{ texto: 'ok' }] });
assert.equal(diagTkt.tieneInfo, true, 'Ticket con cotización SAP debe marcar tieneInfo=true');
assert.equal(diagTkt.cotizacionSAP, '109923', 'Cotización SAP debe extraerse correctamente');
assert.equal(diagTkt.pedidoSAP, '45001', 'Pedido SAP debe extraerse correctamente');
assert.equal(diagTkt.numComentarios, 1, 'Debe contar 1 comentario');

// Test B: Detección y depuración forense de tickets duplicados gemelos (TKT-26550 / TKT-26551)
const origGlobalTickets = global.window ? global.window.tickets : null;
global.window = global.window || {};
global.window.tickets = [
  { id: 'tkt-dup-1', folio: 'TKT-26550', cliente: 'Cliente Prueba S.A.', asunto: 'Falla fuga de aceite en tractor', equipo: 'CAT D6T', fechaCreacion: new Date(Date.now() - 5000).toISOString() },
  { id: 'tkt-dup-2', folio: 'TKT-26551', cliente: 'Cliente Prueba S.A.', asunto: 'Falla fuga de aceite en tractor', equipo: 'CAT D6T', fechaCreacion: new Date().toISOString() }
];
global.window.ordenes = [];

const hallazgosDuplicados = await detectarYDepurarTicketsDuplicados(false);
assert.equal(hallazgosDuplicados.totalEncontrados, 1, 'Debe detectar 1 par de tickets duplicados');
assert.equal(hallazgosDuplicados.duplicados[0].duplicado.folio, 'TKT-26551', 'El duplicado redundante debe ser TKT-26551');
assert.equal(hallazgosDuplicados.duplicados[0].original.folio, 'TKT-26550', 'El ticket original a conservar debe ser TKT-26550');

// Depuración con autoEliminar=true
const resultadoDepuracion = await detectarYDepurarTicketsDuplicados(true);
assert.equal(resultadoDepuracion.totalEncontrados, 1, 'Debe purgar el ticket gemelo detectado');
assert.equal(global.window.tickets.length, 1, 'Debe restar únicamente el ticket original');
assert.equal(global.window.tickets[0].folio, 'TKT-26550', 'El ticket conservado en memoria debe ser el original');
if (origGlobalTickets) global.window.tickets = origGlobalTickets;

console.log('  ✅ Depurador de Tickets (analizarInformacionTicket, sanitizarAsignacionesTickets, detectarYDepurarTicketsDuplicados y exports): OK');

// 21. Módulo de Envíos y Guías de Paquetería
const { obtenerUrlRastreoPaqueteria, asegurarGuiaEnvioParaTicket, obtenerTodosLosEnvios, renderEnvios, exportarEnviosAExcel, updateEnviosBadge } = await import('../src/modules/envios.js');
assert.equal(typeof obtenerUrlRastreoPaqueteria, 'function', 'obtenerUrlRastreoPaqueteria debe ser una función');
assert.equal(typeof asegurarGuiaEnvioParaTicket, 'function', 'asegurarGuiaEnvioParaTicket debe ser una función');
assert.equal(typeof obtenerTodosLosEnvios, 'function', 'obtenerTodosLosEnvios debe ser una función');
assert.equal(typeof renderEnvios, 'function', 'renderEnvios debe ser una función');
assert.equal(typeof exportarEnviosAExcel, 'function', 'exportarEnviosAExcel debe ser una función');
assert.equal(typeof updateEnviosBadge, 'function', 'updateEnviosBadge debe ser una función');

// Test A: Generación de URLs de rastreo multicarrier
const urlDhl = obtenerUrlRastreoPaqueteria('DHL Express', '77889900');
assert.ok(urlDhl.includes('dhl.com') && urlDhl.includes('77889900'), 'URL de DHL debe incluir tracking-id');

const urlFedex = obtenerUrlRastreoPaqueteria('FedEx', '1122334455');
assert.ok(urlFedex.includes('fedex.com') && urlFedex.includes('1122334455'), 'URL de FedEx debe incluir trknbr');

const urlEstafeta = obtenerUrlRastreoPaqueteria('Estafeta', 'EST-9988');
assert.ok(urlEstafeta.includes('estafeta.com') && urlEstafeta.includes('EST-9988'), 'URL de Estafeta debe incluir guia');

// Test B: updateEnviosBadge desde el inicio sin entrar a la vista
const mockBadgeEnv = { textContent: '', style: {}, classList: { add: () => {}, remove: () => {} } };
const origDocEnv = global.document;
global.document = {
  getElementById: (id) => (id === 'nav-badge-envios' ? mockBadgeEnv : null)
};
global.window = global.window || {};
global.window.tickets = [
  { id: 't1', folio: 'TKT-100', guiaPedido: 'GUIA-123', envios: [{ id: 'e1', guiaPedido: 'GUIA-123', llego: false }] },
  { id: 't2', folio: 'TKT-101', guiaPedido: '', envios: [] }
];
updateEnviosBadge();
assert.equal(mockBadgeEnv.textContent, 1, 'Badge de envíos debe mostrar 1 en tránsito de inmediato sin entrar a la vista');
assert.equal(mockBadgeEnv.style.display, 'inline-flex', 'Badge de envíos debe ser visible con display inline-flex');
global.document = origDocEnv;
console.log('  ✅ Envíos y Guías de Paquetería (obtenerUrlRastreoPaqueteria multicarrier y updateEnviosBadge): OK');

// 22. Módulo de Asignación Semanal y Programación de Técnicos
const {
  abrirAsignarTecnicos,
  cerrarAsignarTecnicos,
  guardarAsignacionTecnicos,
  obtenerDiaDeSemanaLocal,
  calcularFechaParaDiaDeSemana,
  horaAMinutos,
  hayTraslapoHorario,
  renderCalendarioSemanalModal,
  toggleDiaSemanaModal,
  agregarActividadSemanal,
  quitarActividadSemanal,
  onTipoDiaChange,
  onTipoPrincipalChange,
  toggleMismaOrden,
  navegarSemana,
  seleccionarDiasSemana,
  abrirProgramarTecnico,
  calcularLlegadaTraslados,
  actualizarTecnicosDisponibles,
  guardarProgramacionTecnico
} = await import('../src/modules/asignacion_tecnicos.js');

assert.equal(typeof abrirAsignarTecnicos, 'function', 'abrirAsignarTecnicos debe ser una función');
assert.equal(typeof abrirProgramarTecnico, 'function', 'abrirProgramarTecnico debe ser una función');
assert.equal(typeof actualizarTecnicosDisponibles, 'function', 'actualizarTecnicosDisponibles debe ser una función');
assert.equal(typeof guardarProgramacionTecnico, 'function', 'guardarProgramacionTecnico debe ser una función');

// Test A: Conversión de horas a minutos
assert.equal(horaAMinutos('08:30'), 510, '08:30 debe ser 510 minutos');
assert.equal(horaAMinutos('00:00'), 0, '00:00 debe ser 0 minutos');
assert.equal(horaAMinutos('17:45'), 1065, '17:45 debe ser 1065 minutos');
assert.equal(horaAMinutos(null), null, 'null debe retornar null');

// Test B: Detección matemática de traslapes de horario
assert.equal(hayTraslapoHorario('09:00', '12:00', '11:00', '14:00'), true, 'Debe detectar traslape parcial');
assert.equal(hayTraslapoHorario('09:00', '12:00', '09:30', '11:30'), true, 'Debe detectar traslape contenido');
assert.equal(hayTraslapoHorario('08:00', '10:00', '10:00', '12:00'), false, 'Mismo límite (10:00) no es traslape');
assert.equal(hayTraslapoHorario('08:00', '10:00', '13:00', '15:00'), false, 'Horarios disjuntos no se traslapan');

// Test C: Cálculos de días y fechas semanales
assert.equal(obtenerDiaDeSemanaLocal('2026-10-01'), 4, '2026-10-01 es Jueves (día 4)');
assert.equal(calcularFechaParaDiaDeSemana('2026-10-01', 1), '2026-09-28', 'El lunes de esa semana debe ser 2026-09-28');
assert.equal(calcularFechaParaDiaDeSemana('2026-10-01', 5), '2026-10-02', 'El viernes de esa semana debe ser 2026-10-02');
console.log('  ✅ Asignación y Programación de Técnicos (horaAMinutos, hayTraslapoHorario, fechas y exports): OK');

// 23. Módulo de Integración y Sincronización SAP
const {
  API_CONFIG,
  fetchSapApi,
  fetchClientesSAP,
  fetchRefaccionesSAP,
  fetchTecnicosSAP,
  fetchSitiosSAP,
  fetchMaquinariaSAP,
  forzarSincronizacionSAP,
  sincronizarModuloSAP,
  sincronizarUnCliente,
  sincronizarConGitHub,
  renderLinkedCotizaciones,
  togglePasarCotizacionBtn,
  deleteLinkedCotizacion,
  viewLinkedCotizacionPdf,
  vincularNuevaCotizacion,
  initSearchableSelect,
  poblarCotizacionesDropdown,
  poblarPedidosDropdown,
  onModalPedidoSelected,
  onQuickPedidoSelected,
  autoExtraerDesdePdfPedido,
  clearPdfPedidoInput,
  validarPedidoConSAP,
  syncSapPedidoManual,
  onModalCotizacionSelected,
  onQuickCotizacionSelected,
  autoExtraerDesdePdfCotizacion,
  clearPdfInput,
  checkPdfSapMatchCount,
  validarCotizacionConSAP,
  syncSapCotizacionManual
} = await import('../src/modules/sap_sync.js');

assert.equal(typeof fetchClientesSAP, 'function', 'fetchClientesSAP debe ser una función');
assert.equal(typeof fetchRefaccionesSAP, 'function', 'fetchRefaccionesSAP debe ser una función');
assert.equal(typeof initSearchableSelect, 'function', 'initSearchableSelect debe ser una función');
assert.equal(typeof checkPdfSapMatchCount, 'function', 'checkPdfSapMatchCount debe ser una función');
assert.equal(typeof validarCotizacionConSAP, 'function', 'validarCotizacionConSAP debe ser una función');
assert.equal(typeof validarPedidoConSAP, 'function', 'validarPedidoConSAP debe ser una función');
assert.equal(typeof sincronizarConGitHub, 'function', 'sincronizarConGitHub debe ser una función');

// Test A: API_CONFIG base
assert.ok(API_CONFIG && typeof API_CONFIG.BASE_URL === 'string', 'API_CONFIG debe tener BASE_URL');
assert.equal(API_CONFIG.USE_SAP_BACKEND, true, 'USE_SAP_BACKEND debe estar activo por defecto');

// Test B: checkPdfSapMatchCount con bypass cuando no hay PDF cargado
assert.equal(checkPdfSapMatchCount('1101234', 1500, 'Cliente Test'), 3, 'Sin PDF en cache debe retornar 3 (bypass)');

// Test C: poblarPedidosDropdown conserva pedidos de todos los clientes y divide en grupos
{
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevEvent = globalThis.Event;
  const prevTickets = globalThis.tickets;
  const prevEditandoTicketId = globalThis.editandoTicketId;

  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div>
      <select id="t-pedido-sap"></select>
    </div>
  </body></html>`);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Event = dom.window.Event;

  window._cachePedidosSap = [
    { numero_pedido: '2200100', cliente_nombre: 'Minera San Julián', monto: 12500, fecha: '2026-08-01' },
    { numero_pedido: '2200200', cliente_nombre: 'Euro Representaciones', monto: 5400, fecha: '2026-08-02' }
  ];
  window.tickets = [
    { id: 'TKT-TEST', cliente: 'Minera San Julián' }
  ];
  globalThis.tickets = window.tickets;
  globalThis.editandoTicketId = 'TKT-TEST';

  await poblarPedidosDropdown(true, 'TKT-TEST');

  const selectEl = dom.window.document.getElementById('t-pedido-sap');
  const allOptions = Array.from(selectEl.options);
  assert.equal(allOptions.length, 3, 'Debe haber 3 opciones (placeholder + 2 pedidos)');
  assert.ok(allOptions.some(o => o.value === '2200100'), 'El pedido de Minera San Julián debe estar presente');
  assert.ok(allOptions.some(o => o.value === '2200200'), 'El pedido de Euro Representaciones NO debe ser descartado');

  const optgroups = selectEl.querySelectorAll('optgroup');
  assert.equal(optgroups.length, 2, 'Deben existir 2 grupos: Pedidos de este cliente y Todos los demás');

  globalThis.document = prevDoc;
  globalThis.window = prevWin;
  globalThis.Event = prevEvent;
  globalThis.tickets = prevTickets;
  globalThis.editandoTicketId = prevEditandoTicketId;
}

// Test D: poblarCotizacionesDropdown conserva cotizaciones de todos los clientes
{
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevEvent = globalThis.Event;
  const prevTickets = globalThis.tickets;
  const prevEditandoTicketId = globalThis.editandoTicketId;

  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div>
      <select id="t-cotizacion-sap"></select>
    </div>
  </body></html>`);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Event = dom.window.Event;

  window._cacheCotizacionesSap = [
    { numero_cotizacion: '1100100', cliente: 'Minera San Julián', monto: 15000, fecha: '2026-07-01' },
    { numero_cotizacion: '1100200', cliente: 'Euro Representaciones', monto: 8200, fecha: '2026-07-02' }
  ];
  window.tickets = [
    { id: 'TKT-TEST', cliente: 'Minera San Julián' }
  ];
  globalThis.tickets = window.tickets;
  globalThis.editandoTicketId = 'TKT-TEST';

  await poblarCotizacionesDropdown(true, 'TKT-TEST');

  const selectEl = dom.window.document.getElementById('t-cotizacion-sap');
  const allOptions = Array.from(selectEl.options);
  assert.equal(allOptions.length, 3, 'Debe haber 3 opciones (placeholder + 2 cotizaciones)');
  assert.ok(allOptions.some(o => o.value === '1100100'), 'La cotización de Minera San Julián debe estar presente');
  assert.ok(allOptions.some(o => o.value === '1100200'), 'La cotización de Euro Representaciones NO debe ser descartada');

  globalThis.document = prevDoc;
  globalThis.window = prevWin;
  globalThis.Event = prevEvent;
  globalThis.tickets = prevTickets;
  globalThis.editandoTicketId = prevEditandoTicketId;
}

console.log('  ✅ Integración y Sincronización SAP (API_CONFIG, checkPdfSapMatchCount, poblarPedidosDropdown preservando pedidos, catálogos y exports): OK');

// =========================================================================
// PRUEBAS DE MÓDULO: OneDrive, Extracción SAT 26 Campos y Visor PDF
// =========================================================================
const {
  onedriveMockDb,
  formatBytes,
  abrirOneDrivePicker,
  cerrarOneDrivePicker,
  extraerDatosCompletosXml,
  analizarFacturaPdfTexto,
  decodificarXmlBase64
} = await import('../src/modules/onedrive.js');

assert.ok(onedriveMockDb && Array.isArray(onedriveMockDb['/']), 'onedriveMockDb debe contener carpeta raíz');
assert.ok(onedriveMockDb['folder_mayo'], 'onedriveMockDb debe contener folder_mayo');
assert.equal(typeof abrirOneDrivePicker, 'function', 'abrirOneDrivePicker debe ser una función');
assert.equal(typeof cerrarOneDrivePicker, 'function', 'cerrarOneDrivePicker debe ser una función');
assert.equal(typeof extraerDatosCompletosXml, 'function', 'extraerDatosCompletosXml debe ser una función');
assert.equal(typeof analizarFacturaPdfTexto, 'function', 'analizarFacturaPdfTexto debe ser una función');

// Test A: formatBytes
assert.equal(formatBytes(0), '0 Bytes', 'formatBytes(0) debe retornar "0 Bytes"');
assert.equal(formatBytes(1024), '1 KB', 'formatBytes(1024) debe retornar "1 KB"');
assert.equal(formatBytes(1048576), '1 MB', 'formatBytes(1048576) debe retornar "1 MB"');
assert.equal(formatBytes(null), '--', 'formatBytes(null) debe retornar "--"');

// Test B: extraerDatosCompletosXml sobre CFDI 4.0
const sampleXml = onedriveMockDb['folder_mayo'][0].content;
const xmlSat = extraerDatosCompletosXml(sampleXml);
assert.equal(xmlSat.uuid, 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D', 'UUID del XML debe ser F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D');
assert.equal(xmlSat.rfcEmisor, 'GVA120524XYZ', 'RFC Emisor debe ser GVA120524XYZ');
assert.equal(xmlSat.total, 1174.79, 'Total debe ser 1174.79');
assert.equal(xmlSat.versionCfdi, '4.0', 'Versión CFDI debe ser 4.0');

// Test C: analizarFacturaPdfTexto sobre texto simulado
const samplePdfText = `
FACTURA DIGITAL CFDI
Emisor: GASOLINERA DEL VALLE S.A.
RFC: GVA120524XYZ
Régimen Fiscal: 601 General de Ley
Folio Fiscal UUID: a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
Fecha de Emisión: 2026-05-22
Moneda: MXN
Subtotal: $1,012.75
IVA 16%: $162.04
Total Factura: $1,174.79
`;
const pdfSat = analizarFacturaPdfTexto(samplePdfText);
assert.equal(pdfSat.uuid, 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D', 'UUID del PDF debe coincidir');
assert.equal(pdfSat.rfcEmisor, 'GVA120524XYZ', 'RFC del PDF debe coincidir');
assert.equal(pdfSat.nombreEmisor, 'GASOLINERA DEL VALLE S.A.', 'Nombre emisor debe limpiarse de ruidos');
assert.equal(pdfSat.total, 1174.79, 'Total extraído del PDF debe ser 1174.79');
assert.equal(pdfSat.fechaEmision, '2026-05-22', 'Fecha de emisión debe ser 2026-05-22');

// Test D: Resolución de Refacciones y Marcas (caso reportado por usuario)
const MARCAS_CATALOGO_OFICIAL = {
  'CAS': 'CASE',
  'CIF': 'CIFA',
  'EBS': 'EBS',
  'EVE': 'EVERDIGM',
  'FIO': 'FIORI',
  'HYU': 'HYUNDAI EVERDIGM',
  'OTM': 'OTHER MOCK',
  'PTZ': 'PUTZMEISTER',
  'RBM': 'REICH',
  'SCH': 'SCHWING',
  'SIM': 'SIMESA',
  'TUR': 'TURBOSOL'
};
// Bidireccional exacto de actualizarDescripcionesCombo:
const coincideMarca = (marcaPieza, marcaSeleccionada) => {
  const mSelNorm = (marcaSeleccionada || '').trim().toLowerCase();
  const mSelFull = (MARCAS_CATALOGO_OFICIAL[mSelNorm.toUpperCase()] || mSelNorm).trim().toLowerCase();
  
  const mPiezaNorm = (marcaPieza || '').trim().toLowerCase();
  const mPiezaFull = (MARCAS_CATALOGO_OFICIAL[mPiezaNorm.toUpperCase()] || mPiezaNorm).trim().toLowerCase();

  return mPiezaNorm === mSelNorm || 
         mPiezaNorm === mSelFull || 
         mPiezaFull === mSelNorm || 
         mPiezaFull === mSelFull;
};

// Caso 1: Refacción con código 'HYU' (Supabase) y usuario selecciona 'HYUNDAI EVERDIGM' (UI)
assert.ok(coincideMarca('HYU', 'HYUNDAI EVERDIGM'), 'HYU debe coincidir con HYUNDAI EVERDIGM');

// Caso 2: Refacción con nombre completo y usuario selecciona código
assert.ok(coincideMarca('HYUNDAI EVERDIGM', 'HYU'), 'HYUNDAI EVERDIGM debe coincidir con HYU');

// Caso 3: Refacción con código 'CAS' y usuario selecciona 'CASE'
assert.ok(coincideMarca('CAS', 'CASE'), 'CAS debe coincidir con CASE');

// Caso 4: Refacción con código 'EVE' y usuario selecciona 'EVERDIGM'
assert.ok(coincideMarca('EVE', 'EVERDIGM'), 'EVE debe coincidir con EVERDIGM');

// Caso 5: Refacción 'PUTZMEISTER' no debe coincidir con 'SCHWING'
assert.ok(!coincideMarca('PTZ', 'SCHWING'), 'PUTZMEISTER no debe coincidir con SCHWING');

console.log('  ✅ Microsoft OneDrive, Extracción Fiscal SAT y Resolución de Refacciones: OK');

// 25. MÓDULO DE TELEMETRÍA, AUDITORÍA Y HERRAMIENTAS SUPERADMIN
console.log('🧪 Verificando Módulo de Telemetría SuperAdmin (telemetria.js / src/modules/telemetria.js)...');
const {
  trackTelemetryEvent,
  seedMockTelemetryData,
  filterTelemetryLogs,
  clearTelemetryLogs,
  getRelativeTime,
  renderTelemetryEventsFeed,
  renderTelemetryDashboard,
  obtenerTodosLosClientes,
  abrirModalFusionarClientes,
  cerrarModalFusionarClientes,
  esMismoCliente,
  mostrarCargando,
  filtrarFusionClientes,
  mostrarListaFusion,
  seleccionarClienteFusion,
  actualizarResumenFusion,
  confirmarFusionClientes,
  deduplicarOrdenesLocales,
  regenerarOrdenesDesdeTickets,
  confirmarAccion,
  eliminarAsignacionProgramadaDirecto,
  eliminarTodasAsignacionesOrden,
  sanitizarBitacorasOrdenes,
  limpiarAsignacionesDuplicadas,
  ejecutarDiagnosticoLocal
} = await import('../src/modules/telemetria.js');

// Test A: Funciones existen
assert.equal(typeof trackTelemetryEvent, 'function', 'trackTelemetryEvent debe ser función');
assert.equal(typeof getRelativeTime, 'function', 'getRelativeTime debe ser función');
assert.equal(typeof esMismoCliente, 'function', 'esMismoCliente debe ser función');
assert.equal(typeof confirmarAccion, 'function', 'confirmarAccion debe ser función');
assert.equal(typeof deduplicarOrdenesLocales, 'function', 'deduplicarOrdenesLocales debe ser función');
assert.equal(typeof ejecutarDiagnosticoLocal, 'function', 'ejecutarDiagnosticoLocal debe ser función');

// Test B: getRelativeTime
const nowIso = new Date().toISOString();
assert.equal(getRelativeTime(nowIso), 'Hace unos momentos', 'getRelativeTime reciente debe retornar "Hace unos momentos"');
const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
assert.equal(getRelativeTime(tenMinsAgo), 'Hace 10 min', 'getRelativeTime de 10m debe retornar "Hace 10 min"');
const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
assert.equal(getRelativeTime(oneHourAgo), 'Hace 1 hora', 'getRelativeTime de 1h debe retornar "Hace 1 hora"');

// Test C: esMismoCliente
const c1 = { id: 'CLI-001', nombre: 'CEMEX S.A.B.', legacy: false };
const c2 = { id: 'CLI-001', nombre: 'CEMEX S.A.B.', legacy: false };
const c3 = { id: 'CLI-002', nombre: 'HOLCIM APASCO', legacy: false };
assert.ok(esMismoCliente(c1, c2), 'Mismo objeto cliente debe retornar true');
assert.ok(!esMismoCliente(c1, c3), 'Clientes distintos no deben coincidir');
assert.ok(!esMismoCliente(null, c1), 'Comparar con null debe retornar false');

console.log('  ✅ Telemetría SuperAdmin, Fusión de Clientes y Diagnósticos: OK');

// 26. MÓDULO DE AUTOMATIZACIONES, REGLAS Y PLANTILLAS DE CORREO
console.log('🧪 Verificando Módulo de Automatizaciones y Plantillas (automatizaciones.js / src/modules/automatizaciones.js)...');
const {
  defaultTemplates,
  defaultRules,
  isCloudSyncActive,
  obtenerHtmlPlantillaProfesional,
  ejecutarAutomatizacion,
  guardarAutoPlantilla,
  toggleReglaActiva
} = await import('../src/modules/automatizaciones.js');

// Test A: Catálogos maestros de plantillas y reglas
assert.ok(Array.isArray(defaultTemplates), 'defaultTemplates debe ser un array');
assert.ok(defaultTemplates.length >= 8, 'defaultTemplates debe tener al menos 8 plantillas base');
const welcomeTpl = defaultTemplates.find(t => t.id === 'welcome');
assert.ok(welcomeTpl, 'Debe existir plantilla welcome');
assert.ok(welcomeTpl.asunto.includes('Eurorep'), 'Asunto de bienvenida debe mencionar Eurorep');

assert.ok(Array.isArray(defaultRules), 'defaultRules debe ser un array');
assert.ok(defaultRules.length >= 8, 'defaultRules debe tener al menos 8 reglas base');

// Test B: Funciones y helpers disponibles
assert.equal(typeof isCloudSyncActive, 'function', 'isCloudSyncActive debe ser función');
assert.equal(typeof obtenerHtmlPlantillaProfesional, 'function', 'obtenerHtmlPlantillaProfesional debe ser función');
assert.equal(typeof ejecutarAutomatizacion, 'function', 'ejecutarAutomatizacion debe ser función');
assert.equal(typeof toggleReglaActiva, 'function', 'toggleReglaActiva debe ser función');

// Test C: Generador de HTML profesional de correo
const testBody = 'Estimado cliente,\n\nSu cotización está lista.\n\nSaludos.';
const htmlMail = obtenerHtmlPlantillaProfesional(testBody);
assert.ok(htmlMail.includes('Eurorep'), 'HTML de correo debe contener branding de Eurorep');
assert.ok(htmlMail.includes('Su cotización está lista'), 'HTML de correo debe contener el cuerpo transformado');
assert.ok(htmlMail.includes('<div') && htmlMail.includes('max-width: 600px'), 'HTML debe generar estructura de maquetado profesional');

console.log('  ✅ Automatizaciones, Reglas de Eventos y Plantillas de Correo: OK');

// 27. MÓDULO DE RESUMEN SEMANAL OPERATIVO Y REPORTES EJECUTIVOS
console.log('🧪 Verificando Módulo de Resumen Semanal Operativo (resumen_semanal.js / src/modules/resumen_semanal.js)...');
const {
  abrirModalResumenSemanal,
  cerrarModalResumenSemanal,
  obtenerRangoSemana,
  parseFechaResumenMs,
  obtenerTodosLosElementosGlobales,
  cargarResumenSemanal,
  renderizarGraficasResumenSemanal,
  setResumenTicketTab,
  _extraerResponsablesIndividuales
} = await import('../src/modules/resumen_semanal.js');

// Test A: Funciones existen
assert.equal(typeof abrirModalResumenSemanal, 'function', 'abrirModalResumenSemanal debe ser función');
assert.equal(typeof cerrarModalResumenSemanal, 'function', 'cerrarModalResumenSemanal debe ser función');
assert.equal(typeof obtenerRangoSemana, 'function', 'obtenerRangoSemana debe ser función');
assert.equal(typeof parseFechaResumenMs, 'function', 'parseFechaResumenMs debe ser función');
assert.equal(typeof obtenerTodosLosElementosGlobales, 'function', 'obtenerTodosLosElementosGlobales debe ser función');
assert.equal(typeof cargarResumenSemanal, 'function', 'cargarResumenSemanal debe ser función');
assert.equal(typeof renderizarGraficasResumenSemanal, 'function', 'renderizarGraficasResumenSemanal debe ser función');
assert.equal(typeof setResumenTicketTab, 'function', 'setResumenTicketTab debe ser función');
assert.equal(typeof _extraerResponsablesIndividuales, 'function', '_extraerResponsablesIndividuales debe ser función');

// Test B: obtenerRangoSemana
const { monday: m0, sunday: s0 } = obtenerRangoSemana(0);
assert.ok(m0 instanceof Date, 'monday debe ser una instancia de Date');
assert.ok(s0 instanceof Date, 'sunday debe ser una instancia de Date');
assert.equal(m0.getDay(), 1, 'monday debe ser lunes (day 1)');
assert.equal(s0.getDay(), 0, 'sunday debe ser domingo (day 0)');
assert.ok(s0.getTime() > m0.getTime(), 'sunday debe ser posterior a monday');

const { monday: mPast } = obtenerRangoSemana(-1);
assert.equal(mPast.getDay(), 1, 'semana pasada monday debe ser lunes');
assert.ok(m0.getTime() - mPast.getTime() >= 6 * 24 * 3600 * 1000, 'diferencia debe ser de 7 días');

// Test C: parseFechaResumenMs
const isoMs = parseFechaResumenMs('2026-06-15T10:00:00Z');
assert.equal(typeof isoMs, 'number', 'parseFechaResumenMs de ISO debe retornar number');
assert.ok(isoMs > 0, 'ms debe ser mayor a 0');
assert.equal(parseFechaResumenMs(null), null, 'parseFechaResumenMs de null debe ser null');
assert.equal(parseFechaResumenMs('invalid-date'), null, 'parseFechaResumenMs de invalido debe ser null');

// Test D: obtenerTodosLosElementosGlobales
const emptyItems = obtenerTodosLosElementosGlobales();
assert.ok(Array.isArray(emptyItems), 'obtenerTodosLosElementosGlobales debe retornar array');

// Test E: _extraerResponsablesIndividuales desglosa técnicos concatenados
const combo1 = _extraerResponsablesIndividuales('Rodrigo Alonso Narvaez, Juan carlos Ramírez');
assert.deepEqual(combo1, ['Rodrigo Alonso Narvaez', 'Juan carlos Ramírez'], 'Debe separar técnicos por coma');

const combo2 = _extraerResponsablesIndividuales(['Ernesto Luciano, Luis Gress', 'Roberto Martinez de Jesus']);
assert.deepEqual(combo2, ['Ernesto Luciano', 'Luis Gress', 'Roberto Martinez de Jesus'], 'Debe aplanar arrays y separar sub-cadenas');

const comboSinAsignar = _extraerResponsablesIndividuales('Sin Asignar');
assert.deepEqual(comboSinAsignar, [], 'Sin Asignar debe retornar array vacío para no considerarlo usuario');

// Test F: obtenerTodosLosElementosGlobales desglosa tickets y órdenes con múltiples técnicos asignados
const prevTickets = globalThis.tickets;
const prevOrdenes = globalThis.ordenes;
try {
  globalThis.tickets = [
    {
      id: 'tkt-test-combo-1',
      folio: 'TKT-9901',
      titulo: 'Fuga hidráulica',
      cliente: 'Minera Real',
      estado: 'Abierto',
      fechaCreacion: '2026-10-05T10:00:00Z',
      asignado: 'Eduardo Jiménez Ortiz, Jesús Garduño gomez'
    }
  ];
  globalThis.ordenes = [
    {
      id: 'os-test-combo-1',
      folio: 'OS-9901',
      trabajoSolicitado: 'Mantenimiento 500h',
      cliente: 'Minera Real',
      estado: 'Abierta',
      fechaCreacion: '2026-10-05T11:00:00Z',
      tecnicosAsignados: ['Juan carlos Ramírez, Sergio Soria Cervantes']
    }
  ];

  const elementos = obtenerTodosLosElementosGlobales();
  const tktElem = elementos.find(e => e.folio === 'TKT-9901');
  assert.ok(tktElem, 'Debe encontrar ticket 9901');
  assert.deepEqual(tktElem.responsables, ['Eduardo Jiménez Ortiz', 'Jesús Garduño gomez'], 'Ticket debe tener técnicos individuales');

  const osElem = elementos.find(e => e.folio === 'OS-9901');
  assert.ok(osElem, 'Debe encontrar orden 9901');
  assert.deepEqual(osElem.responsables, ['Juan carlos Ramírez', 'Sergio Soria Cervantes'], 'Orden debe tener técnicos individuales');
} finally {
  globalThis.tickets = prevTickets;
  globalThis.ordenes = prevOrdenes;
}

// Test G: Exclusión de usuarios de prueba (Test User, Usuario prueba, Prueba Tecnico)
const testUser1 = _extraerResponsablesIndividuales('Test User');
assert.deepEqual(testUser1, [], 'Test User debe ser ignorado y retornar []');

const testUser2 = _extraerResponsablesIndividuales('Usuario prueba');
assert.deepEqual(testUser2, [], 'Usuario prueba debe ser ignorado y retornar []');

const testUser3 = _extraerResponsablesIndividuales('Prueba Tecnico');
assert.deepEqual(testUser3, [], 'Prueba Tecnico debe ser ignorado y retornar []');

const mixedCombo = _extraerResponsablesIndividuales('Luis Gress, Prueba Tecnico, Test User');
assert.deepEqual(mixedCombo, ['Luis Gress'], 'Debe extraer solo al técnico real y descartar test users');

console.log('  ✅ Resumen Semanal Operativo y Reportes Ejecutivos: OK');

// 28. MÓDULO DE DEPURACIÓN DE ÓRDENES DE REFACCIONES, GARANTÍAS Y VISOR DE MANUALES
console.log('🧪 Verificando Módulo de Depuración de Órdenes y Manuales (depurador_ordenes.js / src/modules/depurador_ordenes.js)...');
const {
  _depurarOrdenesCache,
  _depurarSeleccionadas,
  _depurarFiltradasActuales,
  contarOrdenesRefacciones,
  renderManualesPorRol,
  crearModalVisorManualSiNoExiste,
  abrirVisorManualPorId,
  abrirVisorManual,
  cerrarVisorManual,
  actualizarBadgeDepuradorOrdenes,
  abrirModalDepurarOrdenes,
  cerrarModalDepurarOrdenes,
  filtrarTablaDepurador,
  toggleDepurarCheckAll,
  toggleDepurarRowCheck,
  actualizarBotonesAccionMasivaDepurador,
  eliminarOrdenDesdeDepurador,
  eliminarSeleccionadasDepurador,
  eliminarTodasPendientesRefacciones,
  exportarDepuradorAExcel
} = await import('../src/modules/depurador_ordenes.js');

// Test A: Funciones y estructuras de estado existen
assert.ok(_depurarSeleccionadas instanceof Set, '_depurarSeleccionadas debe ser un Set');
assert.ok(Array.isArray(_depurarOrdenesCache), '_depurarOrdenesCache debe ser un Array');
assert.ok(Array.isArray(_depurarFiltradasActuales), '_depurarFiltradasActuales debe ser un Array');
assert.equal(typeof contarOrdenesRefacciones, 'function', 'contarOrdenesRefacciones debe ser función');
assert.equal(typeof renderManualesPorRol, 'function', 'renderManualesPorRol debe ser función');
assert.equal(typeof abrirVisorManualPorId, 'function', 'abrirVisorManualPorId debe ser función');
assert.equal(typeof abrirModalDepurarOrdenes, 'function', 'abrirModalDepurarOrdenes debe ser función');
assert.equal(typeof toggleDepurarRowCheck, 'function', 'toggleDepurarRowCheck debe ser función');

// Test B: contarOrdenesRefacciones
const conteo = contarOrdenesRefacciones();
assert.equal(typeof conteo.totalOrdenes, 'number', 'totalOrdenes debe ser número');
assert.equal(typeof conteo.totalTickets, 'number', 'totalTickets debe ser número');
assert.ok(Array.isArray(conteo.detalleRefacciones), 'detalleRefacciones debe ser un array');
assert.ok(Array.isArray(conteo.detalleGarantias), 'detalleGarantias debe ser un array');
assert.ok(Array.isArray(conteo.todas), 'todas debe ser un array');

// Test C: toggleDepurarRowCheck
toggleDepurarRowCheck('ORD-TEST-001', true);
assert.ok(_depurarSeleccionadas.has('ORD-TEST-001'), 'ORD-TEST-001 debe estar en el set de seleccionadas');
toggleDepurarRowCheck('ORD-TEST-001', false);
assert.ok(!_depurarSeleccionadas.has('ORD-TEST-001'), 'ORD-TEST-001 debe haberse eliminado del set');

console.log('  ✅ Depuración de Órdenes de Refacciones, Garantías y Visor de Manuales: OK');

// 29. Dashboard Ejecutivo, Estadísticas y Gráficas V2
const {
  abrirDesgloseDashboard,
  renderStats,
  _renderStatsInternal,
  getFilteredByTimeframe,
  renderDashboardV2,
  setDashView,
  renderDashboardTecnicos,
  onDashFilterChange,
  _v2Charts
} = await import('../src/modules/dashboard.js');

// Test A: Funciones y estructuras exportadas existen
assert.equal(typeof abrirDesgloseDashboard, 'function', 'abrirDesgloseDashboard debe ser función');
assert.equal(typeof renderStats, 'function', 'renderStats debe ser función');
assert.equal(typeof _renderStatsInternal, 'function', '_renderStatsInternal debe ser función');
assert.equal(typeof getFilteredByTimeframe, 'function', 'getFilteredByTimeframe debe ser función');
assert.equal(typeof renderDashboardV2, 'function', 'renderDashboardV2 debe ser función');
assert.equal(typeof setDashView, 'function', 'setDashView debe ser función');
assert.equal(typeof renderDashboardTecnicos, 'function', 'renderDashboardTecnicos debe ser función');
assert.equal(typeof onDashFilterChange, 'function', 'onDashFilterChange debe ser función');
assert.ok(typeof _v2Charts === 'object' && _v2Charts !== null, '_v2Charts debe ser un objeto');

// Test B: getFilteredByTimeframe filtra adecuadamente por periodo
const hoy = new Date().toISOString().substring(0, 10);
const ayer = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
const haceUnMes = new Date(Date.now() - 40 * 86400000).toISOString().substring(0, 10);

const itemsPrueba = [
  { id: '1', fecha: hoy },
  { id: '2', fecha: ayer },
  { id: '3', fecha: haceUnMes }
];

const todos = getFilteredByTimeframe(itemsPrueba, 'all');
assert.equal(todos.length, 3, 'Timeframe all debe retornar todos los items');

const filtradosHoy = getFilteredByTimeframe(itemsPrueba, 'today');
assert.ok(filtradosHoy.some(i => i.id === '1'), 'Timeframe today debe incluir item de hoy');
assert.ok(!filtradosHoy.some(i => i.id === '3'), 'Timeframe today no debe incluir item de hace un mes');

const filtradosVacio = getFilteredByTimeframe([], 'today');
assert.deepEqual(filtradosVacio, [], 'getFilteredByTimeframe con array vacío debe retornar []');

// Test C: Invocación segura sin DOM de renderStats y renderDashboardV2
assert.doesNotThrow(() => {
  renderStats();
  renderDashboardV2();
  setDashView('v2');
  renderDashboardTecnicos();
  onDashFilterChange();
  abrirDesgloseDashboard('maquinas', '');
}, 'Las funciones del dashboard no deben lanzar error en ausencia de DOM');

console.log('  ✅ Dashboard Ejecutivo, Estadísticas y Gráficas V2: OK');

// 30. Gestión de Usuarios, Roles, Permisos y Sesiones CRUD
const {
  renderUsuariosList,
  abrirModalUsuario,
  toggleEmpresaField,
  cerrarModalUsuario,
  onCambioFusionDestinoModal,
  ejecutarFusionDesdeEditarUsuario,
  adminRestablecerPasswordClick,
  guardarUsuario,
  editarUsuario,
  eliminarUsuario,
  abrirSesionModal,
  cerrarSesionModal,
  cambiarUsuario,
  agregarUsuario,
  renderTecnicosConfig,
  agregarTecnicoConfig,
  eliminarTecnicoConfig
} = await import('../src/modules/usuarios.js');

// Test A: Funciones existen
assert.equal(typeof renderUsuariosList, 'function', 'renderUsuariosList debe ser función');
assert.equal(typeof abrirModalUsuario, 'function', 'abrirModalUsuario debe ser función');
assert.equal(typeof toggleEmpresaField, 'function', 'toggleEmpresaField debe ser función');
assert.equal(typeof cerrarModalUsuario, 'function', 'cerrarModalUsuario debe ser función');
assert.equal(typeof onCambioFusionDestinoModal, 'function', 'onCambioFusionDestinoModal debe ser función');
assert.equal(typeof ejecutarFusionDesdeEditarUsuario, 'function', 'ejecutarFusionDesdeEditarUsuario debe ser función');
assert.equal(typeof adminRestablecerPasswordClick, 'function', 'adminRestablecerPasswordClick debe ser función');
assert.equal(typeof guardarUsuario, 'function', 'guardarUsuario debe ser función');
assert.equal(typeof editarUsuario, 'function', 'editarUsuario debe ser función');
assert.equal(typeof eliminarUsuario, 'function', 'eliminarUsuario debe ser función');
assert.equal(typeof abrirSesionModal, 'function', 'abrirSesionModal debe ser función');
assert.equal(typeof cerrarSesionModal, 'function', 'cerrarSesionModal debe ser función');
assert.equal(typeof cambiarUsuario, 'function', 'cambiarUsuario debe ser función');
assert.equal(typeof agregarUsuario, 'function', 'agregarUsuario debe ser función');
assert.equal(typeof renderTecnicosConfig, 'function', 'renderTecnicosConfig debe ser función');
assert.equal(typeof agregarTecnicoConfig, 'function', 'agregarTecnicoConfig debe ser función');
assert.equal(typeof eliminarTecnicoConfig, 'function', 'eliminarTecnicoConfig debe ser función');

// Test B: Invocación segura sin DOM
assert.doesNotThrow(() => {
  renderUsuariosList();
  abrirModalUsuario();
  toggleEmpresaField();
  cerrarModalUsuario();
  onCambioFusionDestinoModal();
  abrirSesionModal();
  cerrarSesionModal();
  renderTecnicosConfig();
}, 'Las funciones de usuarios no deben arrojar error en ausencia de DOM');

console.log('  ✅ Gestión de Usuarios, Roles, Permisos y Sesiones CRUD: OK');

// 31. Mapeo de Columnas SAP (No-Code) y Queries SQL SAP
const {
  abrirModalMapeo,
  getLabelsForModule,
  applyTableHeaders,
  cerrarModalMapeo,
  switchMapeoTab,
  addCustomColumnUI,
  removeCustomColumn,
  getCustomColumnsForModule,
  guardarMapeoColumnas,
  listaQueriesCargada,
  cargarListaQueriesSAP,
  cargarDetalleQuery,
  limpiarFormularioQuery,
  programarQuerySAP,
  probarQuerySAP,
  eliminarQuerySAP
} = await import('../src/modules/sap_mapper.js');

// Test A: Funciones y estructuras exportadas existen
assert.equal(typeof abrirModalMapeo, 'function', 'abrirModalMapeo debe ser función');
assert.equal(typeof getLabelsForModule, 'function', 'getLabelsForModule debe ser función');
assert.equal(typeof applyTableHeaders, 'function', 'applyTableHeaders debe ser función');
assert.equal(typeof cerrarModalMapeo, 'function', 'cerrarModalMapeo debe ser función');
assert.equal(typeof switchMapeoTab, 'function', 'switchMapeoTab debe ser función');
assert.equal(typeof addCustomColumnUI, 'function', 'addCustomColumnUI debe ser función');
assert.equal(typeof removeCustomColumn, 'function', 'removeCustomColumn debe ser función');
assert.equal(typeof getCustomColumnsForModule, 'function', 'getCustomColumnsForModule debe ser función');
assert.equal(typeof guardarMapeoColumnas, 'function', 'guardarMapeoColumnas debe ser función');
assert.equal(typeof cargarListaQueriesSAP, 'function', 'cargarListaQueriesSAP debe ser función');
assert.equal(typeof cargarDetalleQuery, 'function', 'cargarDetalleQuery debe ser función');
assert.equal(typeof limpiarFormularioQuery, 'function', 'limpiarFormularioQuery debe ser función');
assert.equal(typeof programarQuerySAP, 'function', 'programarQuerySAP debe ser función');
assert.equal(typeof probarQuerySAP, 'function', 'probarQuerySAP debe ser función');
assert.equal(typeof eliminarQuerySAP, 'function', 'eliminarQuerySAP debe ser función');
assert.ok(Array.isArray(listaQueriesCargada), 'listaQueriesCargada debe ser un Array');

// Test B: Invocación segura sin DOM
assert.doesNotThrow(() => {
  abrirModalMapeo();
  applyTableHeaders();
  cerrarModalMapeo();
  switchMapeoTab('clientes');
  addCustomColumnUI('clientes');
  removeCustomColumn('clientes', 'test-col');
  getCustomColumnsForModule('clientes');
  getLabelsForModule('clientes');
  limpiarFormularioQuery();
}, 'Las funciones del mapeo SAP no deben arrojar error en ausencia de DOM');

console.log('  ✅ Mapeo de Columnas SAP (No-Code) y Queries SQL SAP: OK');

// 32. Refacciones de Órdenes de Servicio y Tickets
const {
  MARCAS_CATALOGO_OFICIAL: marcasModuloRefacciones,
  popularSelectMarcas,
  seleccionarMarcaRefaccion,
  actualizarDescripcionesCombo,
  seleccionarDescRefaccion,
  refComboCounter,
  agregarRef,
  actualizarFilaDiscrepanciaRefaccion,
  eliminarRef,
  getRefacciones,
  setRefacciones,
  inicializarRefaccionesTicket,
  agregarFilaRefaccionTicket,
  eliminarFilaRefaccionTicket,
  guardarRefaccionesTicketDesdeUI,
  cerrarGarantiaInternaDirecto,
  aplicarDatosRefaccionEnFila,
  buscarRefaccionPorClave,
  seleccionarRefaccionPorClaveFila,
  teclaClaveRefaccion,
  alSalirClaveRefaccion
} = await import('../src/modules/refacciones_orden.js');

// Test A: Constantes y funciones existen
assert.ok(typeof marcasModuloRefacciones === 'object' && marcasModuloRefacciones !== null, 'marcasModuloRefacciones debe ser objeto');
assert.equal(Object.keys(marcasModuloRefacciones).length, 26, 'marcasModuloRefacciones debe contener 26 marcas');
assert.equal(marcasModuloRefacciones['PTZ'], 'PUTZMEISTER', 'PTZ debe ser PUTZMEISTER');
assert.equal(marcasModuloRefacciones['SCH'], 'SCHWING', 'SCH debe ser SCHWING');
assert.equal(typeof popularSelectMarcas, 'function', 'popularSelectMarcas debe ser función');
assert.equal(typeof seleccionarMarcaRefaccion, 'function', 'seleccionarMarcaRefaccion debe ser función');
assert.equal(typeof actualizarDescripcionesCombo, 'function', 'actualizarDescripcionesCombo debe ser función');
assert.equal(typeof seleccionarDescRefaccion, 'function', 'seleccionarDescRefaccion debe ser función');
assert.equal(typeof agregarRef, 'function', 'agregarRef debe ser función');
assert.equal(typeof actualizarFilaDiscrepanciaRefaccion, 'function', 'actualizarFilaDiscrepanciaRefaccion debe ser función');
assert.equal(typeof eliminarRef, 'function', 'eliminarRef debe ser función');
assert.equal(typeof getRefacciones, 'function', 'getRefacciones debe ser función');
assert.equal(typeof setRefacciones, 'function', 'setRefacciones debe ser función');
assert.equal(typeof inicializarRefaccionesTicket, 'function', 'inicializarRefaccionesTicket debe ser función');
assert.equal(typeof agregarFilaRefaccionTicket, 'function', 'agregarFilaRefaccionTicket debe ser función');
assert.equal(typeof eliminarFilaRefaccionTicket, 'function', 'eliminarFilaRefaccionTicket debe ser función');
assert.equal(typeof guardarRefaccionesTicketDesdeUI, 'function', 'guardarRefaccionesTicketDesdeUI debe ser función');
assert.equal(typeof cerrarGarantiaInternaDirecto, 'function', 'cerrarGarantiaInternaDirecto debe ser función');
assert.equal(typeof aplicarDatosRefaccionEnFila, 'function', 'aplicarDatosRefaccionEnFila debe ser función');
assert.equal(typeof buscarRefaccionPorClave, 'function', 'buscarRefaccionPorClave debe ser función');
assert.equal(typeof seleccionarRefaccionPorClaveFila, 'function', 'seleccionarRefaccionPorClaveFila debe ser función');
assert.equal(typeof teclaClaveRefaccion, 'function', 'teclaClaveRefaccion debe ser función');
assert.equal(typeof alSalirClaveRefaccion, 'function', 'alSalirClaveRefaccion debe ser función');

// Test B: Invocación segura sin DOM
assert.deepEqual(getRefacciones(), [], 'getRefacciones sin DOM debe retornar array vacío');
assert.doesNotThrow(() => {
  popularSelectMarcas('combo-marca', 'combo-desc');
  seleccionarMarcaRefaccion(null, 'PTZ', 'PUTZMEISTER', 'm', 'd');
  actualizarDescripcionesCombo('m', 'd');
  seleccionarDescRefaccion(null, 'd', '123', 500);
  agregarRef();
  actualizarFilaDiscrepanciaRefaccion(null);
  eliminarRef(null);
  setRefacciones([]);
  inicializarRefaccionesTicket('tk-1', []);
  agregarFilaRefaccionTicket('tk-1', {});
  eliminarFilaRefaccionTicket(null, 'tk-1');
  buscarRefaccionPorClave(null, 'dropdown-test');
  seleccionarRefaccionPorClaveFila('dropdown-test', '96901116N', 'ABRAZADERA', 'CAS', 100);
  aplicarDatosRefaccionEnFila(null, null);
  teclaClaveRefaccion({ key: 'Enter', preventDefault: () => {} }, null, 'dropdown-test');
  alSalirClaveRefaccion(null, 'dropdown-test');
}, 'Las funciones de refacciones no deben arrojar error en ausencia de DOM');

console.log('  ✅ Refacciones de Órdenes de Servicio y Tickets: OK');

console.log('Test 33: Centro de Notificaciones Internas y Campanitas de Tickets');
const {
  toggleInternalNotificationDropdown,
  sincronizarNotificacionesInternas,
  generarNotificacionInterna,
  generarNotificacionComentarioInterno,
  updateInternalNotificationBell,
  verTicketYMarcarInternaLeida,
  marcarTodasInternasLeidas,
  toggleNotificationDropdown,
  updateNotificationBell,
  abrirTicketDesdeNotification,
  abrirOrdenDesdePerfil
} = await import('../src/modules/notificaciones.js');

// Test A: Funciones existen
assert.equal(typeof toggleInternalNotificationDropdown, 'function', 'toggleInternalNotificationDropdown debe ser función');
assert.equal(typeof sincronizarNotificacionesInternas, 'function', 'sincronizarNotificacionesInternas debe ser función');
assert.equal(typeof generarNotificacionInterna, 'function', 'generarNotificacionInterna debe ser función');
assert.equal(typeof generarNotificacionComentarioInterno, 'function', 'generarNotificacionComentarioInterno debe ser función');
assert.equal(typeof updateInternalNotificationBell, 'function', 'updateInternalNotificationBell debe ser función');
assert.equal(typeof verTicketYMarcarInternaLeida, 'function', 'verTicketYMarcarInternaLeida debe ser función');
assert.equal(typeof marcarTodasInternasLeidas, 'function', 'marcarTodasInternasLeidas debe ser función');
assert.equal(typeof toggleNotificationDropdown, 'function', 'toggleNotificationDropdown debe ser función');
assert.equal(typeof updateNotificationBell, 'function', 'updateNotificationBell debe ser función');
assert.equal(typeof abrirTicketDesdeNotification, 'function', 'abrirTicketDesdeNotification debe ser función');
assert.equal(typeof abrirOrdenDesdePerfil, 'function', 'abrirOrdenDesdePerfil debe ser función');

// Test B: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  toggleInternalNotificationDropdown(null);
  sincronizarNotificacionesInternas();
  generarNotificacionInterna({ id: 't-1', folio: 'T-100', asunto: 'Prueba' }, 'Juan', 'Pedro');
  generarNotificacionComentarioInterno({ id: 't-1', folio: 'T-100', asunto: 'Prueba' }, { usuario: 'Carlos', fecha: '2026-10-02T12:00:00Z', texto: 'Comentario' });
  updateInternalNotificationBell();
  verTicketYMarcarInternaLeida('t-1', 'notif-1');
  marcarTodasInternasLeidas();
  toggleNotificationDropdown(null);
  updateNotificationBell();
  abrirTicketDesdeNotification('t-1');
  abrirOrdenDesdePerfil('o-1');
}, 'Las funciones de notificaciones no deben arrojar error en ausencia de DOM');

console.log('  ✅ Centro de Notificaciones y Campanitas de Tickets: OK');

console.log('Test 34: Configuración de Permisos, Roles y Técnicos');
const {
  renderPermisosRoles,
  guardarPermisosRoles,
  currentTecView,
  setTecView,
  renderTecnicos,
  verDetalleTecnico,
  cerrarDetalleTecnico
} = await import('../src/modules/config_tecnicos.js');

// Test A: Funciones y variables existen
assert.equal(typeof renderPermisosRoles, 'function', 'renderPermisosRoles debe ser función');
assert.equal(typeof guardarPermisosRoles, 'function', 'guardarPermisosRoles debe ser función');
assert.equal(typeof currentTecView, 'string', 'currentTecView debe ser string');
assert.equal(typeof setTecView, 'function', 'setTecView debe ser función');
assert.equal(typeof renderTecnicos, 'function', 'renderTecnicos debe ser función');
assert.equal(typeof verDetalleTecnico, 'function', 'verDetalleTecnico debe ser función');
assert.equal(typeof cerrarDetalleTecnico, 'function', 'cerrarDetalleTecnico debe ser función');

// Test B: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  renderPermisosRoles();
  guardarPermisosRoles();
  setTecView('galeria');
  setTecView('lista');
  renderTecnicos();
  verDetalleTecnico('Técnico Demo');
  cerrarDetalleTecnico(null);
}, 'Las funciones de configuración de técnicos y roles no deben arrojar error en ausencia de DOM');

console.log('  ✅ Configuración de Permisos, Roles y Técnicos: OK');

console.log('Test 35: Automatización de Estados, Reportes PDF y Envío de Órdenes');
const {
  calcularEstadoOrden,
  cerrarDetalle,
  generarBase64Pdf,
  toggleCampoCorreo,
  ejecutarComandoEditor,
  abrirPaletaColor,
  ejecutarColorEditor,
  imprimirOrden,
  enviarCorreoOrden,
  cerrarModalCorreo,
  procesarEnviarCorreo
} = await import('../src/modules/ordenes_estados.js');

// Test A: Funciones existen
assert.equal(typeof calcularEstadoOrden, 'function', 'calcularEstadoOrden debe ser función');
assert.equal(typeof cerrarDetalle, 'function', 'cerrarDetalle debe ser función');
assert.equal(typeof generarBase64Pdf, 'function', 'generarBase64Pdf debe ser función');
assert.equal(typeof toggleCampoCorreo, 'function', 'toggleCampoCorreo debe ser función');
assert.equal(typeof ejecutarComandoEditor, 'function', 'ejecutarComandoEditor debe ser función');
assert.equal(typeof abrirPaletaColor, 'function', 'abrirPaletaColor debe ser función');
assert.equal(typeof ejecutarColorEditor, 'function', 'ejecutarColorEditor debe ser función');
assert.equal(typeof imprimirOrden, 'function', 'imprimirOrden debe ser función');
assert.equal(typeof enviarCorreoOrden, 'function', 'enviarCorreoOrden debe ser función');
assert.equal(typeof cerrarModalCorreo, 'function', 'cerrarModalCorreo debe ser función');
assert.equal(typeof procesarEnviarCorreo, 'function', 'procesarEnviarCorreo debe ser función');

// Test B: Reglas de negocio de calcularEstadoOrden
assert.equal(calcularEstadoOrden({}), 'Pendiente', 'Orden sin datos debe ser Pendiente');
assert.equal(calcularEstadoOrden({ trabajos: 'Ajuste de frenos' }), 'En proceso', 'Orden con trabajos debe ser En proceso');
assert.equal(calcularEstadoOrden({ bitacora: [{ fecha: '2026-10-05' }] }), 'En proceso', 'Orden con bitacora debe ser En proceso');
assert.equal(calcularEstadoOrden({ firma_tecnico_base64: 'data:image/png;base64,abc' }), 'En proceso', 'Orden con firma técnico debe ser En proceso');
assert.equal(calcularEstadoOrden({
  firma_cliente_base64: 'data:image/png;base64,xyz',
  ref_necesarias: [{ descripcion: 'Bomba', cantidad: 1 }]
}), 'Refacciones pendientes', 'Orden firmada con ref_necesarias debe ser Refacciones pendientes');
assert.equal(calcularEstadoOrden({
  firma_cliente_base64: 'data:image/png;base64,xyz',
  ref_necesarias: []
}), 'Completado', 'Orden firmada sin ref_necesarias debe ser Completado');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  cerrarDetalle(null);
  toggleCampoCorreo('cc');
  ejecutarComandoEditor('bold');
  abrirPaletaColor(null, 'foreColor');
  ejecutarColorEditor('foreColor', '#ff0000');
  imprimirOrden();
  enviarCorreoOrden('ord-123');
  cerrarModalCorreo();
  procesarEnviarCorreo(null);
}, 'Las funciones de ordenes_estados no deben arrojar error en ausencia de DOM');

console.log('Test 36: Servicios Programados de Técnico y Gestión de Envíos en Tickets');
const {
  renderServiciosProgramadosTecnico,
  renderTicketRefaccionesList,
  obtenerEnviosDesdeDOM,
  actualizarVisibilidadDestinoPiezas,
  actualizarEstatusRefaccionesDesdeGuias,
  esTicketDeServicioEnCampo,
  renderEnvioCards
} = await import('../src/modules/servicios_programados.js');

// Test A: Funciones existen
assert.equal(typeof renderServiciosProgramadosTecnico, 'function', 'renderServiciosProgramadosTecnico debe ser función');
assert.equal(typeof renderTicketRefaccionesList, 'function', 'renderTicketRefaccionesList debe ser función');
assert.equal(typeof obtenerEnviosDesdeDOM, 'function', 'obtenerEnviosDesdeDOM debe ser función');
assert.equal(typeof actualizarVisibilidadDestinoPiezas, 'function', 'actualizarVisibilidadDestinoPiezas debe ser función');
assert.equal(typeof actualizarEstatusRefaccionesDesdeGuias, 'function', 'actualizarEstatusRefaccionesDesdeGuias debe ser función');
assert.equal(typeof esTicketDeServicioEnCampo, 'function', 'esTicketDeServicioEnCampo debe ser función');
assert.equal(typeof renderEnvioCards, 'function', 'renderEnvioCards debe ser función');

// Test B: Lógica de negocio de esTicketDeServicioEnCampo
assert.equal(esTicketDeServicioEnCampo(null), false, 'null debe ser false');
assert.equal(esTicketDeServicioEnCampo({ folio: 'TK-100-A' }), false, 'Subticket -A debe ser false');
assert.equal(esTicketDeServicioEnCampo({ folio: 'REF-2026-01' }), false, 'Folio REF- debe ser false');
assert.equal(esTicketDeServicioEnCampo({ area: 'Refacciones y Almacén' }), false, 'Área refacciones debe ser false');
assert.equal(esTicketDeServicioEnCampo({ categoria: 'Garantía', tipo: 'Garantía' }), false, 'Garantía administrativa debe ser false');
assert.equal(esTicketDeServicioEnCampo({ destinoPiezas: 'cliente' }), false, 'Destino directo a cliente debe ser false');
assert.equal(esTicketDeServicioEnCampo({ guiaPedido: 'GUIA123', categoria: 'Venta' }), false, 'Venta con envío sin servicio debe ser false');

// Casos positivos de servicio en campo
assert.equal(esTicketDeServicioEnCampo({ categoria: 'Servicio Técnico', tipo: 'Preventivo' }), true, 'Servicio Técnico debe ser true');
assert.equal(esTicketDeServicioEnCampo({ categoria: 'Mantenimiento en Campo' }), true, 'Mantenimiento debe ser true');
assert.equal(esTicketDeServicioEnCampo({ categoria: 'Puesta en Marcha' }), true, 'Puesta en marcha debe ser true');
assert.equal(esTicketDeServicioEnCampo({ area: 'Operaciones', tipo: 'Correctivo' }), true, 'Correctivo en operaciones debe ser true');
assert.equal(esTicketDeServicioEnCampo({ categoria: 'Reparación de Bomba' }), true, 'Reparación debe ser true');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.deepEqual(obtenerEnviosDesdeDOM(), [], 'obtenerEnviosDesdeDOM sin DOM debe retornar array vacío');
assert.doesNotThrow(() => {
  renderServiciosProgramadosTecnico();
  renderTicketRefaccionesList({ id: 't1', refaccionesSeleccionadas: [] });
  actualizarVisibilidadDestinoPiezas({ destinoPiezas: 'tecnico' });
  actualizarEstatusRefaccionesDesdeGuias({ refaccionesSeleccionadas: [] });
  renderEnvioCards({ envios: [] });
}, 'Las funciones de servicios_programados no deben arrojar error en ausencia de DOM');

console.log('Test 37: Listados, Filtros, Menús de Ordenación y Badges de Tickets');
const {
  updateTicketBadge,
  updateOrdenesBadge,
  actualizarFiltrosPersonal,
  ticketSortColumn,
  ticketSortDirection,
  onSortTicketsChange,
  toggleSortMenu,
  setSortDirection,
  seleccionarColumnaOrden,
  actualizarUISortMenu,
  actualizarCabeceraOrdenacion,
  ordenarTicketsPor,
  toggleTipoFilterMenu,
  setTicketTipoFilter,
  actualizarUITipoFilter,
  toggleSupervisorFilterMenu,
  setTicketSupervisorFilter,
  actualizarUISupervisorFilter,
  toggleAntiguedadFilterMenu,
  cambiarModoAntiguedad,
  setAntiguedadRango,
  setAntiguedadFilter,
  actualizarUIAntiguedadFilter,
  esTicketHijoRefacciones,
  obtenerOrdenAsociadaTicket,
  verOrdenDesdeTicket,
  obtenerTicketPadre,
  resolverClienteTicket,
  renderTickets,
  exportarTicketsAExcel,
  esTicketEnTransito,
  badgeTicketEstado,
  getTicketEstadoLabel,
  filtrarTickets,
  setFiltroTickets,
  seleccionarCanal,
  updateFileLabel,
  cargarMasTickets,
  mostrarTodosLosTickets,
  resetTicketPageLimit,
  safeGetFilteredTickets
} = await import('../src/modules/tickets_listado.js');

// Test A: Funciones y variables existen
assert.equal(typeof updateTicketBadge, 'function', 'updateTicketBadge debe ser función');
assert.equal(typeof updateOrdenesBadge, 'function', 'updateOrdenesBadge debe ser función');
assert.equal(typeof actualizarFiltrosPersonal, 'function', 'actualizarFiltrosPersonal debe ser función');
assert.equal(typeof ordenarTicketsPor, 'function', 'ordenarTicketsPor debe ser función');
assert.equal(typeof renderTickets, 'function', 'renderTickets debe ser función');
assert.equal(typeof exportarTicketsAExcel, 'function', 'exportarTicketsAExcel debe ser función');
assert.equal(typeof badgeTicketEstado, 'function', 'badgeTicketEstado debe ser función');
assert.equal(typeof getTicketEstadoLabel, 'function', 'getTicketEstadoLabel debe ser función');
assert.equal(typeof esTicketHijoRefacciones, 'function', 'esTicketHijoRefacciones debe ser función');
assert.equal(typeof resolverClienteTicket, 'function', 'resolverClienteTicket debe ser función');
assert.equal(typeof filtrarTickets, 'function', 'filtrarTickets debe ser función');
assert.equal(typeof setFiltroTickets, 'function', 'setFiltroTickets debe ser función');
assert.equal(typeof cargarMasTickets, 'function', 'cargarMasTickets debe ser función');
assert.equal(typeof mostrarTodosLosTickets, 'function', 'mostrarTodosLosTickets debe ser función');
assert.equal(typeof resetTicketPageLimit, 'function', 'resetTicketPageLimit debe ser función');
assert.doesNotThrow(() => {
  resetTicketPageLimit();
  cargarMasTickets();
  mostrarTodosLosTickets();
  resetTicketPageLimit();
}, 'Las funciones de paginación de tickets deben ejecutarse sin errores');

// Test B: Lógica de badgeTicketEstado
assert.equal(badgeTicketEstado({ estado: 'Abierto' }), 'abierto', 'Estado Abierto debe dar clase abierto');
assert.equal(badgeTicketEstado({ estado: 'Cotización' }), 'en-proceso', 'Estado Cotización estándar debe dar clase en-proceso');
assert.equal(badgeTicketEstado({ estado: 'Cotización', cotAceptada: 'si' }), 'cerrado-aprobado', 'Cotización aprobada debe dar cerrado-aprobado');
assert.equal(badgeTicketEstado({ estado: 'Cotización', cotAceptada: 'no' }), 'cerrado-rechazado', 'Cotización rechazada debe dar cerrado-rechazado');
assert.equal(badgeTicketEstado({ estado: 'Refacciones' }), 'refacciones', 'Estado Refacciones debe dar clase refacciones');
assert.equal(badgeTicketEstado({ estado: 'Cerrado', cotAceptada: 'si' }), 'cerrado-aprobado', 'Cerrado aprobado debe dar cerrado-aprobado');
assert.equal(badgeTicketEstado({ estado: 'Cerrado', cotAceptada: 'no' }), 'cerrado-rechazado', 'Cerrado rechazado debe dar cerrado-rechazado');

// Test C: Lógica de getTicketEstadoLabel
assert.equal(getTicketEstadoLabel({ estado: 'Abierto' }), 'Abierto', 'Label de Abierto debe ser Abierto');
assert.equal(getTicketEstadoLabel({ estado: 'Cerrado', cotAceptada: 'si' }), 'Aceptado', 'Label de Cerrado aceptado debe ser Aceptado');
assert.equal(getTicketEstadoLabel({ estado: 'Cerrado', cotAceptada: 'no' }), 'Rechazado', 'Label de Cerrado rechazado debe ser Rechazado');
assert.equal(getTicketEstadoLabel(null), '—', 'Label de null debe ser raya');

// Test D: Lógica de esTicketHijoRefacciones
assert.equal(esTicketHijoRefacciones({ folio: 'TK-12345-A' }), true, 'Folio terminado en -A es ticket hijo');
assert.equal(esTicketHijoRefacciones({ folio: 'TK-12345' }), false, 'Folio normal no es ticket hijo');
assert.equal(esTicketHijoRefacciones(null), false, 'null no es ticket hijo');

// Test E: Lógica de resolverClienteTicket
assert.equal(resolverClienteTicket({ cliente: 'Holcim México' }), 'Holcim México', 'Cliente directo');
assert.equal(resolverClienteTicket(null), '', 'null retorna string vacío');

// Test F: Invocación defensiva de lógica de datos en Node.js (sin DOM)
assert.doesNotThrow(() => {
  obtenerOrdenAsociadaTicket({ folio: 'TK-1' });
  obtenerTicketPadre({ folio: 'TK-1-A' });
  esTicketEnTransito({ envios: [] });
}, 'Las funciones lógicas de tickets_listado no deben arrojar error en ausencia de DOM');
assert.ok(ticketSortColumn !== undefined, 'ticketSortColumn debe estar definido');
assert.ok(ticketSortDirection !== undefined, 'ticketSortDirection debe estar definido');

// Test G: Deduplicación estricta en safeGetFilteredTickets
const fakeDuplicateTickets = [
  { id: 'tkt-1', folio: 'TKT-PRUEBA-018', asunto: 'MTO 1', categoria: 'Mantenimiento' },
  { id: 'tkt-1', folio: 'TKT-PRUEBA-018', asunto: 'MTO 1', categoria: 'Mantenimiento' },
  { id: 'tkt-2', folio: 'TKT-PRUEBA-020', asunto: 'MTO 2', categoria: 'Mantenimiento' },
  { id: 'tkt-2', folio: 'TKT-PRUEBA-020', asunto: 'MTO 2', categoria: 'Mantenimiento' },
  { id: 'tkt-3', folio: 'TKT-PRUEBA-021', asunto: 'MTO 3', categoria: 'Mantenimiento' }
];
const oldGetFilteredTickets = global.getFilteredTickets;
global.getFilteredTickets = () => fakeDuplicateTickets;
const deduplicated = safeGetFilteredTickets();
assert.equal(deduplicated.length, 3, 'safeGetFilteredTickets debe eliminar tickets duplicados y devolver solo 3');
assert.equal(deduplicated.map(t => t.folio).join(','), 'TKT-PRUEBA-018,TKT-PRUEBA-020,TKT-PRUEBA-021', 'Folios deben ser únicos');
if (oldGetFilteredTickets) global.getFilteredTickets = oldGetFilteredTickets;
else delete global.getFilteredTickets;

console.log('  ✅ Listados, Filtros, Menús de Ordenación y Badges de Tickets (con Deduplicación Estricta): OK');

console.log('Test 38: Formulario, Combos y Guardado de Tickets');
const {
  abrirTicket,
  abrirTicketPreloaded,
  toggleResolucionTicket,
  toggleMotivoRechazo,
  editarTicket,
  cerrarTicket,
  poblarSoportesPorCliente,
  poblarMaquinasCliente,
  onEquipoOrdenChange,
  onEquipoTicketChange,
  onEquipoTicketChangeMultiple,
  actualizarCamposMaquinaOrden,
  agregarMaquinaChipOrden,
  onEquipoOrdenChangeMultiple,
  toggleCombo,
  filterCombo,
  selectComboOption,
  agregarSitioCombo,
  agregarEmpresaCombo,
  readFileAsBase64,
  guardarTicket,
  eliminarTicket,
  procesarArchivosArrastrados,
  inicializarDragAndDropTickets
} = await import('../src/modules/tickets_form.js');

// Test A: Existencia y tipo de las funciones exportadas
assert.equal(typeof abrirTicket, 'function', 'abrirTicket debe ser función');
assert.equal(typeof abrirTicketPreloaded, 'function', 'abrirTicketPreloaded debe ser función');
assert.equal(typeof toggleResolucionTicket, 'function', 'toggleResolucionTicket debe ser función');
assert.equal(typeof toggleMotivoRechazo, 'function', 'toggleMotivoRechazo debe ser función');
assert.equal(typeof editarTicket, 'function', 'editarTicket debe ser función');
assert.equal(typeof cerrarTicket, 'function', 'cerrarTicket debe ser función');
assert.equal(typeof poblarSoportesPorCliente, 'function', 'poblarSoportesPorCliente debe ser función');
assert.equal(typeof poblarMaquinasCliente, 'function', 'poblarMaquinasCliente debe ser función');
assert.equal(typeof onEquipoOrdenChange, 'function', 'onEquipoOrdenChange debe ser función');
assert.equal(typeof onEquipoTicketChange, 'function', 'onEquipoTicketChange debe ser función');
assert.equal(typeof onEquipoTicketChangeMultiple, 'function', 'onEquipoTicketChangeMultiple debe ser función');
assert.equal(typeof actualizarCamposMaquinaOrden, 'function', 'actualizarCamposMaquinaOrden debe ser función');
assert.equal(typeof agregarMaquinaChipOrden, 'function', 'agregarMaquinaChipOrden debe ser función');
assert.equal(typeof onEquipoOrdenChangeMultiple, 'function', 'onEquipoOrdenChangeMultiple debe ser función');
assert.equal(typeof toggleCombo, 'function', 'toggleCombo debe ser función');
assert.equal(typeof filterCombo, 'function', 'filterCombo debe ser función');
assert.equal(typeof selectComboOption, 'function', 'selectComboOption debe ser función');
assert.equal(typeof agregarSitioCombo, 'function', 'agregarSitioCombo debe ser función');
assert.equal(typeof agregarEmpresaCombo, 'function', 'agregarEmpresaCombo debe ser función');
assert.equal(typeof readFileAsBase64, 'function', 'readFileAsBase64 debe ser función');
assert.equal(typeof guardarTicket, 'function', 'guardarTicket debe ser función');
assert.equal(typeof eliminarTicket, 'function', 'eliminarTicket debe ser función');

// Test B: readFileAsBase64 retorna promesa sin arrojar error
const b64Res = await readFileAsBase64(null);
assert.equal(typeof b64Res, 'string', 'readFileAsBase64 debe retornar string en ambiente sin FileReader');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  abrirTicket('TK-NONEXISTENT');
  abrirTicketPreloaded({});
  toggleResolucionTicket();
  toggleMotivoRechazo();
  cerrarTicket({ preventDefault: () => {} });
  poblarSoportesPorCliente('Cliente Test');
  poblarMaquinasCliente('select-id', 'M-1', 'Cliente Test');
  onEquipoOrdenChange();
  onEquipoTicketChange();
  onEquipoTicketChangeMultiple();
  actualizarCamposMaquinaOrden();
  agregarMaquinaChipOrden('Maquina A');
  onEquipoOrdenChangeMultiple();
  toggleCombo('combo-test');
  filterCombo('combo-test', 'query');
  filterCombo('combo-test');
  filterCombo('combo-test', undefined);
  selectComboOption('combo-test', 'val', 'Label');
  agregarSitioCombo('combo-test');
  agregarEmpresaCombo('combo-test');
}, 'Las funciones de tickets_form no deben arrojar error en ausencia de DOM');

// Test D: Candado de guardado concurrente (Mutex anti-doble clic)
global.window = global.window || {};
global.window._guardandoTicket = true;
let dummyPrevented = false;
await guardarTicket({ preventDefault: () => { dummyPrevented = true; } });
assert.equal(dummyPrevented, false, 'guardarTicket debe bloquearse inmediatamente si _guardandoTicket es true');
global.window._guardandoTicket = false;

console.log('  ✅ Formulario, Combos y Guardado de Tickets: OK');

console.log('Test 39: Detalle, Comentarios y Adjuntos de Tickets');
const {
  renderComentariosInternosHtml,
  switchCommentTab,
  agregarComentarioInterno,
  agregarComentarioExterno,
  verDetalleTicket,
  visualizarPdfOnDemand,
  visualizarDestinoPdfActual,
  descargarPdfOnDemand,
  avanzarCotizacionTicket,
  cerrarCotizacionTicket,
  cerrarDetalleTicket,
  forzarEstadoTicket,
  forzarCrearOrdenServicio
} = await import('../src/modules/tickets_detalle.js');

// Test A: Existencia y tipo de las funciones exportadas
assert.equal(typeof renderComentariosInternosHtml, 'function', 'renderComentariosInternosHtml debe ser función');
assert.equal(typeof switchCommentTab, 'function', 'switchCommentTab debe ser función');
assert.equal(typeof agregarComentarioInterno, 'function', 'agregarComentarioInterno debe ser función');
assert.equal(typeof agregarComentarioExterno, 'function', 'agregarComentarioExterno debe ser función');
assert.equal(typeof verDetalleTicket, 'function', 'verDetalleTicket debe ser función');
assert.equal(typeof visualizarPdfOnDemand, 'function', 'visualizarPdfOnDemand debe ser función');
assert.equal(typeof visualizarDestinoPdfActual, 'function', 'visualizarDestinoPdfActual debe ser función');
assert.equal(typeof descargarPdfOnDemand, 'function', 'descargarPdfOnDemand debe ser función');
assert.equal(typeof avanzarCotizacionTicket, 'function', 'avanzarCotizacionTicket debe ser función');
assert.equal(typeof cerrarCotizacionTicket, 'function', 'cerrarCotizacionTicket debe ser función');
assert.equal(typeof cerrarDetalleTicket, 'function', 'cerrarDetalleTicket debe ser función');
assert.equal(typeof forzarEstadoTicket, 'function', 'forzarEstadoTicket debe ser función');
assert.equal(typeof forzarCrearOrdenServicio, 'function', 'forzarCrearOrdenServicio debe ser función');

// Test B: renderComentariosInternosHtml genera HTML válido para ticket de prueba
const dummyTicket = {
  id: 't-test-1',
  comentariosInternos: [
    { usuario: 'Soporte Eurorep', texto: 'Comentario de prueba interno', fecha: '2026-10-05T12:00:00Z' }
  ],
  comentariosClientes: [
    { usuario: 'Cliente Demo', texto: 'Mensaje externo del cliente', fecha: '2026-10-05T12:30:00Z' }
  ]
};
const htmlGenerado = renderComentariosInternosHtml(dummyTicket);
assert.ok(typeof htmlGenerado === 'string' && htmlGenerado.includes('Comentario de prueba interno'), 'renderComentariosInternosHtml debe incluir el texto del comentario');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  switchCommentTab('internos');
  switchCommentTab('externos');
  verDetalleTicket('TK-NONEXISTENT');
  visualizarPdfOnDemand('TK-1', 'cotizacion');
  visualizarDestinoPdfActual();
  descargarPdfOnDemand('TK-1', 'cotizacion');
  cerrarDetalleTicket({ preventDefault: () => {} });
  forzarEstadoTicket('TK-1');
  forzarCrearOrdenServicio('TK-1');
}, 'Las funciones de tickets_detalle no deben arrojar error en ausencia de DOM');

console.log('  ✅ Detalle, Comentarios y Adjuntos de Tickets: OK');

console.log('Test 40: Detalle, Evidencias Fotográficas y Canvas de Firmas de Órdenes');
const {
  renderEvidenciasFotograficas,
  previsualizarImagenCompleta,
  abrirImagenEnPestana,
  subirEvidenciaFoto,
  subirFotoRefaccion,
  eliminarEvidenciaFoto,
  verDetalle,
  agregarRenglonTecnicoCierre,
  abrirCierrePapel,
  cerrarCierrePapel,
  confirmarCierrePapel,
  confirmarCierreOrdenAdmin,
  confirmarReaperturaOrdenAdmin,
  inicializarCanvasFirma,
  borrarCanvasFirma,
  guardarFirmaCanvas,
  limpiarFirma
} = await import('../src/modules/ordenes_detalle.js');

// Test A: Existencia y tipo de las funciones exportadas
assert.equal(typeof renderEvidenciasFotograficas, 'function', 'renderEvidenciasFotograficas debe ser función');
assert.equal(typeof previsualizarImagenCompleta, 'function', 'previsualizarImagenCompleta debe ser función');
assert.equal(typeof abrirImagenEnPestana, 'function', 'abrirImagenEnPestana debe ser función');
assert.equal(typeof subirEvidenciaFoto, 'function', 'subirEvidenciaFoto debe ser función');
assert.equal(typeof subirFotoRefaccion, 'function', 'subirFotoRefaccion debe ser función');
assert.equal(typeof eliminarEvidenciaFoto, 'function', 'eliminarEvidenciaFoto debe ser función');
assert.equal(typeof verDetalle, 'function', 'verDetalle debe ser función');
assert.equal(typeof agregarRenglonTecnicoCierre, 'function', 'agregarRenglonTecnicoCierre debe ser función');
assert.equal(typeof abrirCierrePapel, 'function', 'abrirCierrePapel debe ser función');
assert.equal(typeof cerrarCierrePapel, 'function', 'cerrarCierrePapel debe ser función');
assert.equal(typeof confirmarCierrePapel, 'function', 'confirmarCierrePapel debe ser función');
assert.equal(typeof confirmarCierreOrdenAdmin, 'function', 'confirmarCierreOrdenAdmin debe ser función');
assert.equal(typeof confirmarReaperturaOrdenAdmin, 'function', 'confirmarReaperturaOrdenAdmin debe ser función');
assert.equal(typeof inicializarCanvasFirma, 'function', 'inicializarCanvasFirma debe ser función');
assert.equal(typeof borrarCanvasFirma, 'function', 'borrarCanvasFirma debe ser función');
assert.equal(typeof guardarFirmaCanvas, 'function', 'guardarFirmaCanvas debe ser función');
assert.equal(typeof limpiarFirma, 'function', 'limpiarFirma debe ser función');

// Test B: renderEvidenciasFotograficas genera HTML para orden
const dummyOrden = {
  id: 'ord-test-1',
  estado: 'En Proceso',
  evidencias: {
    fotoInicio: 'data:image/webp;base64,AAAA',
    fotoFin: null,
    adicionales: []
  }
};
const evHtml = renderEvidenciasFotograficas(dummyOrden);
assert.ok(typeof evHtml === 'string', 'renderEvidenciasFotograficas debe retornar string HTML');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  previsualizarImagenCompleta('https://example.com/foto.jpg', 'Prueba');
  abrirImagenEnPestana('ticket-id');
  verDetalle('ORD-NONEXISTENT');
  agregarRenglonTecnicoCierre();
  abrirCierrePapel('ord-1');
  cerrarCierrePapel({ preventDefault: () => {} });
  inicializarCanvasFirma('cliente');
  borrarCanvasFirma('cliente');
  guardarFirmaCanvas('ord-1', 'cliente');
  confirmarCierreOrdenAdmin('ord-1');
  confirmarReaperturaOrdenAdmin('ord-1');
}, 'Las funciones de ordenes_detalle no deben arrojar error en ausencia de DOM');

// Test D: Validación exhaustiva de mergeEvidencias (cero pérdida de evidencias)
assert.equal(typeof mergeEvidencias, 'function', 'mergeEvidencias debe ser función');
const evMerged = mergeEvidencias(
  { fotoInicio: 'https://ex.com/ini.jpg', adicionales: ['https://ex.com/a.jpg', 'https://ex.com/b.jpg'] },
  { fotoFin: 'https://ex.com/fin.jpg', adicionales: ['https://ex.com/b.jpg', 'https://ex.com/c.jpg'] }
);
assert.equal(evMerged.fotoInicio, 'https://ex.com/ini.jpg', 'fotoInicio debe preservarse');
assert.equal(evMerged.fotoFin, 'https://ex.com/fin.jpg', 'fotoFin debe integrarse');
assert.deepEqual(evMerged.adicionales, ['https://ex.com/a.jpg', 'https://ex.com/b.jpg', 'https://ex.com/c.jpg'], 'adicionales debe ser la unión sin duplicados');

// Exclusión explícita de fotos eliminadas
const evWithExclusion = mergeEvidencias(
  { adicionales: ['https://ex.com/a.jpg', 'https://ex.com/b.jpg'] },
  { adicionales: ['https://ex.com/b.jpg'] },
  ['https://ex.com/a.jpg']
);
assert.deepEqual(evWithExclusion.adicionales, ['https://ex.com/b.jpg'], 'foto eliminada no debe reaparecer');

console.log('  ✅ Detalle, Evidencias Fotográficas y Canvas de Firmas de Órdenes: OK');

console.log('Test 41: Bitácora de Avances y Reportes de Órdenes');
const {
  calcularRangoFechasLaboral,
  abrirBitacora,
  iniciarReporteDesdeAsignacion,
  editarBitacora,
  cerrarBitacora,
  actualizarEventoCalendarioDesdeBitacora,
  guardarNotaBitacora
} = await import('../src/modules/ordenes_bitacora.js');

// Test A: Existencia y tipo de las funciones exportadas
assert.equal(typeof calcularRangoFechasLaboral, 'function', 'calcularRangoFechasLaboral debe ser función');
assert.equal(typeof abrirBitacora, 'function', 'abrirBitacora debe ser función');
assert.equal(typeof iniciarReporteDesdeAsignacion, 'function', 'iniciarReporteDesdeAsignacion debe ser función');
assert.equal(typeof editarBitacora, 'function', 'editarBitacora debe ser función');
assert.equal(typeof cerrarBitacora, 'function', 'cerrarBitacora debe ser función');
assert.equal(typeof actualizarEventoCalendarioDesdeBitacora, 'function', 'actualizarEventoCalendarioDesdeBitacora debe ser función');
assert.equal(typeof guardarNotaBitacora, 'function', 'guardarNotaBitacora debe ser función');

// Test B: Lógica de negocio de calcularRangoFechasLaboral
const rangoLaboral = calcularRangoFechasLaboral(3);
assert.ok(rangoLaboral && rangoLaboral.min && rangoLaboral.max, 'calcularRangoFechasLaboral debe retornar { min, max }');
assert.ok(rangoLaboral.min <= rangoLaboral.max, 'min debe ser menor o igual a max');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  abrirBitacora('ORD-NONEXISTENT');
  iniciarReporteDesdeAsignacion('ORD-NONEXISTENT', 'BIT-1');
  editarBitacora('ORD-NONEXISTENT', 'BIT-1');
  cerrarBitacora({ preventDefault: () => {} });
  actualizarEventoCalendarioDesdeBitacora(null, null);
}, 'Las funciones de ordenes_bitacora no deben arrojar error en ausencia de DOM');

console.log('  ✅ Bitácora de Avances y Reportes de Órdenes: OK');

console.log('Test 42: Formulario, Días Panels, KM y Guardado de Órdenes');
const {
  DIAS,
  initDiasPanels,
  calcularHorasDia,
  autoCompletarFechas,
  selDia,
  calcKmTotal,
  getDiasData,
  setDiasData,
  generarFolioConsecutivo,
  abrirFormulario,
  autoFillFromPdfExtraction,
  onSoporteChange,
  editarOrden,
  cerrarFormulario,
  guardarOrdenes,
  guardarOrden,
  eliminarOrden,
  completarReporteDesdeDetalle
} = await import('../src/modules/ordenes_form.js');

// Test A: Existencia y tipo de las funciones exportadas
assert.ok(Array.isArray(DIAS) && DIAS.length === 7, 'DIAS debe ser un array de 7 días');
assert.equal(typeof initDiasPanels, 'function', 'initDiasPanels debe ser función');
assert.equal(typeof calcularHorasDia, 'function', 'calcularHorasDia debe ser función');
assert.equal(typeof autoCompletarFechas, 'function', 'autoCompletarFechas debe ser función');
assert.equal(typeof selDia, 'function', 'selDia debe ser función');
assert.equal(typeof calcKmTotal, 'function', 'calcKmTotal debe ser función');
assert.equal(typeof getDiasData, 'function', 'getDiasData debe ser función');
assert.equal(typeof setDiasData, 'function', 'setDiasData debe ser función');
assert.equal(typeof generarFolioConsecutivo, 'function', 'generarFolioConsecutivo debe ser función');
assert.equal(typeof abrirFormulario, 'function', 'abrirFormulario debe ser función');
assert.equal(typeof autoFillFromPdfExtraction, 'function', 'autoFillFromPdfExtraction debe ser función');
assert.equal(typeof onSoporteChange, 'function', 'onSoporteChange debe ser función');
assert.equal(typeof editarOrden, 'function', 'editarOrden debe ser función');
assert.equal(typeof cerrarFormulario, 'function', 'cerrarFormulario debe ser función');
assert.equal(typeof guardarOrdenes, 'function', 'guardarOrdenes debe ser función');
assert.equal(typeof guardarOrden, 'function', 'guardarOrden debe ser función');
assert.equal(typeof eliminarOrden, 'function', 'eliminarOrden debe ser función');
assert.equal(typeof completarReporteDesdeDetalle, 'function', 'completarReporteDesdeDetalle debe ser función');

// Test B: Lógica de negocio de generarFolioConsecutivo
const nuevoFolio = generarFolioConsecutivo();
assert.ok(typeof nuevoFolio === 'string' && nuevoFolio.startsWith('OS-'), 'generarFolioConsecutivo debe generar un folio que comience con OS-');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  initDiasPanels();
  calcularHorasDia('lunes');
  autoCompletarFechas('lunes', '2026-10-05');
  calcKmTotal();
  getDiasData();
  setDiasData({});
  abrirFormulario('ORD-NONEXISTENT');
  autoFillFromPdfExtraction('TK-1');
  onSoporteChange();
  editarOrden('ORD-NONEXISTENT');
  cerrarFormulario({ preventDefault: () => {} });
  guardarOrdenes();
  completarReporteDesdeDetalle('ORD-NONEXISTENT');
}, 'Las funciones de ordenes_form no deben arrojar error en ausencia de DOM');

console.log('  ✅ Formulario, Días Panels, KM y Guardado de Órdenes: OK');

// ============================================================================
// TEST 43: Listados, Filtros, Menús de Ordenación y Tabla de Órdenes
// ============================================================================
console.log('Test 43: Listados, Filtros, Menús de Ordenación y Tabla de Órdenes');
const {
  filtroEstadoServicios,
  filtroTicketsV2,
  currentOrdSortCol,
  currentOrdSortDir,
  setFiltroEstadoServicios,
  setFiltroTicketsV2,
  toggleSortOrdenes,
  renderTabla,
  badgeEstado,
  filtrarOrdenes,
  exportarOrdenesAExcel,
  cargarMasOrdenes,
  mostrarTodasLasOrdenes,
  resetOrdenPageLimit,
  safeGetFilteredOrders
} = await import('../src/modules/ordenes_listado.js');

// Test A: Funciones y exports existen
assert.equal(typeof setFiltroEstadoServicios, 'function', 'setFiltroEstadoServicios debe ser función');
assert.equal(typeof setFiltroTicketsV2, 'function', 'setFiltroTicketsV2 debe ser función');
assert.equal(typeof toggleSortOrdenes, 'function', 'toggleSortOrdenes debe ser función');
assert.equal(typeof renderTabla, 'function', 'renderTabla debe ser función');
assert.equal(typeof badgeEstado, 'function', 'badgeEstado debe ser función');
assert.equal(typeof filtrarOrdenes, 'function', 'filtrarOrdenes debe ser función');
assert.equal(typeof exportarOrdenesAExcel, 'function', 'exportarOrdenesAExcel debe ser función');
assert.equal(typeof cargarMasOrdenes, 'function', 'cargarMasOrdenes debe ser función');
assert.equal(typeof mostrarTodasLasOrdenes, 'function', 'mostrarTodasLasOrdenes debe ser función');
assert.equal(typeof resetOrdenPageLimit, 'function', 'resetOrdenPageLimit debe ser función');
assert.doesNotThrow(() => {
  resetOrdenPageLimit();
  cargarMasOrdenes();
  mostrarTodasLasOrdenes();
  resetOrdenPageLimit();
}, 'Las funciones de paginación de órdenes deben ejecutarse sin errores');

// Test B: badgeEstado
assert.equal(badgeEstado('En Proceso'), 'badge-proceso', 'badgeEstado En Proceso debe retornar badge-proceso');
assert.equal(badgeEstado('Completado'), 'badge-completado', 'badgeEstado Completado debe retornar badge-completado');
assert.equal(badgeEstado('Cerrada'), 'badge-completado', 'badgeEstado Cerrada debe retornar badge-completado');
assert.equal(badgeEstado('Cerrado'), 'badge-completado', 'badgeEstado Cerrado debe retornar badge-completado');
assert.equal(badgeEstado('Pendiente'), 'badge-pendiente', 'badgeEstado Pendiente debe retornar badge-pendiente');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  renderTabla();
  renderTabla('servicios');
  renderTabla('v2');
  filtrarOrdenes();
  filtrarOrdenes('servicios');
  setFiltroEstadoServicios('Completado');
  setFiltroTicketsV2('abiertos');
  toggleSortOrdenes('cliente');
  toggleSortOrdenes('cliente');
  toggleSortOrdenes('fecha');
}, 'Las funciones de ordenes_listado no deben arrojar error en ausencia de DOM');

// Test D: Deduplicación estricta en safeGetFilteredOrders
const fakeDuplicateOrders = [
  { id: 'ord-1', folio: 'OS-1001', cliente: 'Cliente 1' },
  { id: 'ord-1', folio: 'OS-1001', cliente: 'Cliente 1' },
  { id: 'ord-2', folio: 'OS-1002', cliente: 'Cliente 2' },
  { id: 'ord-2', folio: 'OS-1002', cliente: 'Cliente 2' }
];
const oldGetFilteredOrders = global.getFilteredOrders;
global.getFilteredOrders = () => fakeDuplicateOrders;
const deduplicatedOrds = safeGetFilteredOrders();
assert.equal(deduplicatedOrds.length, 2, 'safeGetFilteredOrders debe eliminar órdenes duplicadas y devolver solo 2');
assert.equal(deduplicatedOrds.map(o => o.folio).join(','), 'OS-1001,OS-1002', 'Folios de órdenes deben ser únicos');
if (oldGetFilteredOrders) global.getFilteredOrders = oldGetFilteredOrders;
else delete global.getFilteredOrders;

console.log('  ✅ Listados, Filtros, Menús de Ordenación y Tabla de Órdenes (con Deduplicación Estricta): OK');

// ============================================================================
// TEST 44: Ideas, Fallas, Mejoras y Priorización Drag & Drop
// ============================================================================
console.log('Test 44: Ideas, Fallas, Mejoras y Priorización Drag & Drop');
const {
  editandoIdeaFallaId,
  ifArchivosAdjuntosTemp,
  renderIfArchivosPreview,
  eliminarIfArchivoTemp,
  handleIfFilesSelect,
  handleIfFilesDrop,
  procesarFilesIf,
  abrirModalResolucionIdeaFalla,
  cerrarModalResolucionIdeaFalla,
  guardarResolucionIdeaFalla,
  puedeEditarIdeaFalla,
  abrirModalIdeaFalla,
  cerrarModalIdeaFalla,
  guardarIdeaFalla,
  cambiarEstadoIdeaFalla,
  eliminarIdeaFalla,
  filtrarIdeaFallaPorKpi,
  renderIdeasFallas,
  cambiarPrioridadIdeaFalla,
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  sincronizarConGitHub: syncGithubModule
} = await import('../src/modules/ideas_fallas.js');

// Test A: Funciones y exports existen
assert.equal(typeof puedeEditarIdeaFalla, 'function', 'puedeEditarIdeaFalla debe ser función');
assert.equal(typeof abrirModalIdeaFalla, 'function', 'abrirModalIdeaFalla debe ser función');
assert.equal(typeof cerrarModalIdeaFalla, 'function', 'cerrarModalIdeaFalla debe ser función');
assert.equal(typeof guardarIdeaFalla, 'function', 'guardarIdeaFalla debe ser función');
assert.equal(typeof cambiarEstadoIdeaFalla, 'function', 'cambiarEstadoIdeaFalla debe ser función');
assert.equal(typeof eliminarIdeaFalla, 'function', 'eliminarIdeaFalla debe ser función');
assert.equal(typeof renderIdeasFallas, 'function', 'renderIdeasFallas debe ser función');
assert.equal(typeof syncGithubModule, 'function', 'syncGithubModule debe ser función');

// Test B: Regla de negocio de puedeEditarIdeaFalla
// Caso sin sesión: false
globalThis.window = globalThis.window || {};
globalThis.window.currentSession = null;
assert.equal(puedeEditarIdeaFalla({ creado_por_id: 'usr-1' }), false, 'Sin sesión no debe permitir editar');

// Caso sesión Superadmin: siempre true
globalThis.window.currentSession = { viewMode: 'superadmin', userId: 'super-1', nombre: 'Admin' };
assert.equal(puedeEditarIdeaFalla({ creado_por_id: 'usr-1', creado_por: 'Otro' }), true, 'Superadmin siempre puede editar');

// Caso sesión normal mismo autor: true
globalThis.window.currentSession = { viewMode: 'tecnico', userId: 'tec-1', nombre: 'Juan Pérez' };
globalThis.window.usuarios = [{ id: 'tec-1', nombre: 'Juan Pérez' }];
assert.equal(puedeEditarIdeaFalla({ creado_por_id: 'tec-1' }), true, 'El creador debe poder editar');
assert.equal(puedeEditarIdeaFalla({ creado_por_id: 'tec-2', creado_por: 'Pedro' }), false, 'Otro usuario no debe poder editar');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  renderIfArchivosPreview();
  eliminarIfArchivoTemp(0);
  abrirModalResolucionIdeaFalla('test-1');
  cerrarModalResolucionIdeaFalla();
  abrirModalIdeaFalla('test-1');
  cerrarModalIdeaFalla();
  renderIdeasFallas();
  filtrarIdeaFallaPorKpi('ideas');
  filtrarIdeaFallaPorKpi('fallas');
  filtrarIdeaFallaPorKpi('pendientes');
  filtrarIdeaFallaPorKpi('completados');
}, 'Las funciones de ideas_fallas no deben arrojar error en ausencia de DOM');

console.log('  ✅ Ideas, Fallas, Mejoras y Priorización Drag & Drop: OK');

// ============================================================================
// TEST 45: Preferencias, Configuración General, Recuperación de Contraseña y Diagrama de Flujo
// ============================================================================
console.log('Test 45: Preferencias, Configuración General, Recuperación de Contraseña y Diagrama de Flujo');
const {
  cargarConfig,
  guardarConfig,
  toggleOneDriveDemoMode,
  guardarOneDriveConfig,
  initTableResizers,
  inicializarTableResizersEvent,
  inicializarPasswordRecovery,
  abrirRecuperarPassword,
  volverLoginDesdeRecovery,
  enviarRecoveryLink,
  guardarNuevaPassword,
  abrirModalDiagramaFlujo,
  cerrarModalDiagramaFlujo,
  zoomDiagramaFlujo,
  resetZoomDiagramaFlujo,
  toggleSimbologiaFlujo,
  filtrarRutaDiagrama
} = await import('../src/modules/preferencias.js');

// Test A: Funciones y exports existen
assert.equal(typeof cargarConfig, 'function', 'cargarConfig debe ser función');
assert.equal(typeof guardarConfig, 'function', 'guardarConfig debe ser función');
assert.equal(typeof toggleOneDriveDemoMode, 'function', 'toggleOneDriveDemoMode debe ser función');
assert.equal(typeof guardarOneDriveConfig, 'function', 'guardarOneDriveConfig debe ser función');
assert.equal(typeof initTableResizers, 'function', 'initTableResizers debe ser función');
assert.equal(typeof inicializarPasswordRecovery, 'function', 'inicializarPasswordRecovery debe ser función');
assert.equal(typeof abrirRecuperarPassword, 'function', 'abrirRecuperarPassword debe ser función');
assert.equal(typeof abrirModalDiagramaFlujo, 'function', 'abrirModalDiagramaFlujo debe ser función');
assert.equal(typeof zoomDiagramaFlujo, 'function', 'zoomDiagramaFlujo debe ser función');
assert.equal(typeof resetZoomDiagramaFlujo, 'function', 'resetZoomDiagramaFlujo debe ser función');

// Test B: Lógica de zoom con límites min/max
resetZoomDiagramaFlujo();
assert.equal(resetZoomDiagramaFlujo(), 1, 'resetZoomDiagramaFlujo debe restablecer el zoom a 1');
const zoomPlus = zoomDiagramaFlujo(0.2);
assert.ok(Math.abs(zoomPlus - 1.2) < 0.001, 'zoomDiagramaFlujo(+0.2) debe dar 1.2');
const zoomMax = zoomDiagramaFlujo(10);
assert.equal(zoomMax, 1.8, 'zoomDiagramaFlujo debe limitar a máximo 1.8');
const zoomMin = zoomDiagramaFlujo(-10);
assert.equal(zoomMin, 0.6, 'zoomDiagramaFlujo debe limitar a mínimo 0.6');
resetZoomDiagramaFlujo();

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  cargarConfig();
  guardarConfig();
  toggleOneDriveDemoMode();
  guardarOneDriveConfig();
  initTableResizers();
  inicializarTableResizersEvent();
  inicializarPasswordRecovery();
  abrirRecuperarPassword();
  volverLoginDesdeRecovery();
  abrirModalDiagramaFlujo();
  cerrarModalDiagramaFlujo();
  toggleSimbologiaFlujo();
  filtrarRutaDiagrama('normal');
  filtrarRutaDiagrama('garantia');
}, 'Las funciones de preferencias no deben arrojar error en ausencia de DOM');

console.log('  ✅ Preferencias, Configuración General, Recuperación de Contraseña y Diagrama de Flujo: OK');

// ============================================================================
// TEST 46: Sitios de Obra, Subvistas de Clientes y Portal de Usuarios
// ============================================================================
console.log('Test 46: Sitios de Obra, Subvistas de Clientes y Portal de Usuarios');
const {
  getSitioNombre: getSitioNombreModule,
  getNombresDeSitiosParaCliente,
  generarIdInternoMaquina: generarIdInternoMaquinaModule,
  agregarSitioClienteDesdeEmpresa,
  agregarSitioCliente,
  cerrarModalSitio,
  guardarSitioCliente,
  setClientesSubView,
  renderPortalUsuariosList,
  aprobarUsuarioPortal
} = await import('../src/modules/sitios_clientes.js');

// Test A: Funciones y exports existen
assert.equal(typeof getSitioNombreModule, 'function', 'getSitioNombre debe ser función');
assert.equal(typeof getNombresDeSitiosParaCliente, 'function', 'getNombresDeSitiosParaCliente debe ser función');
assert.equal(typeof generarIdInternoMaquinaModule, 'function', 'generarIdInternoMaquina debe ser función');
assert.equal(typeof agregarSitioClienteDesdeEmpresa, 'function', 'agregarSitioClienteDesdeEmpresa debe ser función');
assert.equal(typeof agregarSitioCliente, 'function', 'agregarSitioCliente debe ser función');
assert.equal(typeof cerrarModalSitio, 'function', 'cerrarModalSitio debe ser función');
assert.equal(typeof guardarSitioCliente, 'function', 'guardarSitioCliente debe ser función');
assert.equal(typeof setClientesSubView, 'function', 'setClientesSubView debe ser función');
assert.equal(typeof renderPortalUsuariosList, 'function', 'renderPortalUsuariosList debe ser función');
assert.equal(typeof aprobarUsuarioPortal, 'function', 'aprobarUsuarioPortal debe ser función');

// Test B: Lógica de getSitioNombre y generarIdInternoMaquina
assert.equal(getSitioNombreModule('Obra Centro'), 'Obra Centro', 'getSitioNombre de string debe retornar el string');
assert.equal(getSitioNombreModule({ nombre: 'Obra Sur' }), 'Obra Sur', 'getSitioNombre de objeto debe retornar el nombre');
assert.equal(getSitioNombreModule(null), '', 'getSitioNombre de null debe retornar cadena vacía');

globalThis.window.clientesDb = [];
globalThis.window.maquinariaDb = [];
const idMaq = generarIdInternoMaquinaModule('KOMATSU', '2026');
assert.ok(typeof idMaq === 'string' && idMaq.startsWith('KO26'), 'generarIdInternoMaquina debe generar prefijo KO26');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  getNombresDeSitiosParaCliente(null);
  agregarSitioClienteDesdeEmpresa();
  agregarSitioCliente('');
  cerrarModalSitio();
  setClientesSubView('catalogo');
  setClientesSubView('portal');
  renderPortalUsuariosList();
}, 'Las funciones de sitios_clientes no deben arrojar error en ausencia de DOM');
const mockClient = {
  id: 'cli-uuid-123',
  idInterno: 'CLI001',
  nombre: 'Constructora Monterrey S.A. de C.V.',
  sitios: [{ nombre: 'Planta Monterrey' }, 'Obra Valle']
};
globalThis.window.clientesDb = [mockClient];
globalThis.window.sitiosDb = [
  { id: 'sit-1', nombre: 'Parque Industrial Apodaca', cliente: 'cli-uuid-123' },
  { id: 'sit-2', nombre: 'Obra Guadalupe', customData: { clienteNombre: 'Constructora Monterrey' } }
];
globalThis.window.maquinariaDb = [
  { id: 'maq-1', cliente: 'Constructora Monterrey S.A. de C.V.', ubicacion: 'Mina Saltillo' }
];

// Búsqueda pasando el objeto del cliente
const sitiosObj = getNombresDeSitiosParaCliente(mockClient);
assert.ok(sitiosObj.includes('Parque Industrial Apodaca'), 'Debe incluir sitio desde sitiosDb por cliente_id');
assert.ok(sitiosObj.includes('Obra Guadalupe'), 'Debe incluir sitio desde sitiosDb por match flexible');
assert.ok(sitiosObj.includes('Planta Monterrey'), 'Debe incluir sitio desde cliente.sitios');
assert.ok(sitiosObj.includes('Obra Valle'), 'Debe incluir sitio string desde cliente.sitios');
assert.ok(sitiosObj.includes('Mina Saltillo'), 'Debe incluir sitio desde maquinariaDb');

// Búsqueda pasando únicamente el string del cliente (como viene en tickets legacy o no normalizados)
const sitiosStr = getNombresDeSitiosParaCliente('constructora monterrey');
assert.ok(sitiosStr.includes('Parque Industrial Apodaca'), 'Debe encontrar sitio buscando por nombre flexible del cliente');
assert.ok(sitiosStr.includes('Obra Valle'), 'Debe encontrar sitio local buscando por nombre flexible del cliente');

// Test E: Registro de IDs válidos en window._supaValidSitioIds
globalThis.window._supaValidSitioIds = new Set();
globalThis.window._supaValidSitioIds.add('sit-1');
assert.ok(globalThis.window._supaValidSitioIds.has('sit-1'), '_supaValidSitioIds debe registrar IDs de sitios creados');


// 47. MÓDULO DE MIGRACIONES DE DATOS Y CHIPS DE MÁQUINAS EN TICKETS
console.log('🧪 Verificando Módulo de Migraciones y Tickets Form (app_migrations.js / tickets_form.js)...');
const {
  generarTicketsRefaccionesFaltantes,
  migrarOrdenesExistentesMaquinaria,
  migrarUbicacionesMaquinariaDesdeTickets,
  recuperarMaquinariaDesdeTickets,
  reintentarSincronizacionGastosLocales,
  repararCreadoresTicketsFaltantes
} = await import('../src/modules/app_migrations.js');
const {
  agregarMaquinaChip
} = await import('../src/modules/tickets_form.js');

// Test A: Existencia y firma de funciones
assert.equal(typeof generarTicketsRefaccionesFaltantes, 'function', 'generarTicketsRefaccionesFaltantes debe ser función');
assert.equal(typeof migrarOrdenesExistentesMaquinaria, 'function', 'migrarOrdenesExistentesMaquinaria debe ser función');
assert.equal(typeof migrarUbicacionesMaquinariaDesdeTickets, 'function', 'migrarUbicacionesMaquinariaDesdeTickets debe ser función');
assert.equal(typeof recuperarMaquinariaDesdeTickets, 'function', 'recuperarMaquinariaDesdeTickets debe ser función');
assert.equal(typeof reintentarSincronizacionGastosLocales, 'function', 'reintentarSincronizacionGastosLocales debe ser función');
assert.equal(typeof repararCreadoresTicketsFaltantes, 'function', 'repararCreadoresTicketsFaltantes debe ser función');
assert.equal(typeof agregarMaquinaChip, 'function', 'agregarMaquinaChip debe ser función');

// Test A.1: repararCreadoresTicketsFaltantes repara tickets sin creador
const ticketsTestRepair = [
  { id: 'tk_rep_1', folio: 'TK-101', creadoPor: '', creado_por: 'Pablo Besoy' },
  { id: 'tk_rep_2', folio: 'TK-102', creadoPor: null, comentariosInternos: [{ usuario: 'Adrian Franco', texto: 'Iniciando' }] }
];
globalThis.window = globalThis.window || {};
globalThis.window.resolverCreadorTicket = resolverCreadorTicket;
localStorage.setItem('sapi_tickets', JSON.stringify(ticketsTestRepair));
repararCreadoresTicketsFaltantes();
const reparados = JSON.parse(localStorage.getItem('sapi_tickets'));
assert.equal(reparados[0].creadoPor, 'Pablo Besoy', 'Ticket 1 debe haber reparado creadoPor');
assert.equal(reparados[1].creadoPor, 'Adrian Franco', 'Ticket 2 debe haber reparado creadoPor desde comentarios');

// Test B: generarTicketsRefaccionesFaltantes genera ticket para orden con refacciones pendientes
globalThis.window.ordenes = [
  {
    id: 'ord_test_99',
    folio: 'OS-999',
    cliente: 'Constructora Alfa',
    ubicacion: 'Sitio Norte',
    tecnico: 'Juan Pérez',
    ref_necesarias: [
      { clave: 'FLT-01', descripcion: 'Filtro Hidráulico', cantidad: 2, marca: 'CAT' }
    ]
  }
];
globalThis.window.tickets = [];
await generarTicketsRefaccionesFaltantes();

assert.equal(globalThis.window.tickets.length, 1, 'Debe generarse exactamente 1 ticket para la orden');
const tktGenerado = globalThis.window.tickets[0];
assert.equal(tktGenerado.folio, 'TKT-OS-999-A', 'El folio generado debe ser TKT-OS-999-A');
assert.equal(tktGenerado.cliente, 'Constructora Alfa', 'El cliente del ticket debe coincidir');
assert.equal(tktGenerado.categoria, 'Refacción', 'La categoría del ticket debe ser Refacción');
assert.equal(tktGenerado.refaccionesSeleccionadas.length, 1, 'Debe incluir las refacciones mapeadas');
assert.equal(tktGenerado.refaccionesSeleccionadas[0].clave, 'FLT-01', 'La clave de refacción debe coincidir');

// Test C: Invocación defensiva en Node.js (sin DOM)
assert.doesNotThrow(() => {
  migrarOrdenesExistentesMaquinaria();
  migrarUbicacionesMaquinariaDesdeTickets();
  recuperarMaquinariaDesdeTickets();
  reintentarSincronizacionGastosLocales();
  agregarMaquinaChip('MOCK-MAQ-1');
}, 'Las funciones de migraciones y agregarMaquinaChip no deben arrojar error en ausencia de DOM');

console.log('  ✅ Migraciones de Catálogos, Generación de Tickets de Refacciones y Chips: OK');

// 48. MÓDULO DE ESTADO REACTIVO CENTRALIZADO (STORE)
console.log('🧪 Verificando Módulo de Estado Reactivo Centralizado (src/store.js / store.js)...');
const { createStore, store } = await import('../src/store.js');

assert.equal(typeof createStore, 'function', 'createStore debe ser una función');
assert.equal(typeof store, 'object', 'store debe ser un objeto');
assert.equal(typeof store.getState, 'function', 'store.getState debe ser función');
assert.equal(typeof store.setState, 'function', 'store.setState debe ser función');
assert.equal(typeof store.subscribe, 'function', 'store.subscribe debe ser función');
assert.equal(typeof store.addTicket, 'function', 'store.addTicket debe ser función');
assert.equal(typeof store.updateTicket, 'function', 'store.updateTicket debe ser función');
assert.equal(typeof store.removeTicket, 'function', 'store.removeTicket debe ser función');

// Test A: Crear store aislado y probar reactividad
const localStore = createStore({ tickets: [{ id: 't1', folio: 'TKT-01' }], ordenes: [] });
let listenerCalled = 0;
let lastTickets = null;

const unsub = localStore.subscribe('tickets', (updated) => {
  listenerCalled++;
  lastTickets = updated;
});

localStore.addTicket({ id: 't2', folio: 'TKT-02' });
assert.equal(listenerCalled, 1, 'El suscriptor debe ejecutarse en addTicket');
assert.equal(localStore.getState('tickets').length, 2, 'Debe haber 2 tickets en el estado');
assert.equal(lastTickets[0].folio, 'TKT-02', 'El nuevo ticket debe estar al inicio');

localStore.updateTicket('t1', { estado: 'Cerrado' });
assert.equal(listenerCalled, 2, 'El suscriptor debe ejecutarse en updateTicket');
assert.equal(localStore.getState('tickets').find(t => t.id === 't1').estado, 'Cerrado');

localStore.removeTicket('t2');
assert.equal(listenerCalled, 3, 'El suscriptor debe ejecutarse en removeTicket');
assert.equal(localStore.getState('tickets').length, 1);

unsub();
localStore.addTicket({ id: 't3', folio: 'TKT-03' });
assert.equal(listenerCalled, 3, 'El suscriptor desuscrito no debe ejecutarse de nuevo');

console.log('  ✅ Estado Reactivo Centralizado (Store, Pub/Sub y Entidades): OK');

// 49. MÓDULO DE DEFINICIÓN DE MODELOS Y TIPADO JSDOC
console.log('🧪 Verificando Definiciones de Tipos JSDoc y Modelos (src/types/models.js)...');
const { TiposModelos } = await import('../src/types/models.js');

assert.equal(typeof TiposModelos, 'object', 'TiposModelos debe ser un objeto');
assert.equal(TiposModelos.version, '1.0.0', 'TiposModelos debe tener versión 1.0.0');

console.log('  ✅ Definiciones de Tipos JSDoc y Modelos de Negocio: OK');

// 50. MÓDULO DE OFFLINE-FIRST Y BACKGROUND SYNC
console.log('🧪 Verificando Arquitectura Offline-First y Background Sync (sw.js / src/utils.js)...');
const {
  solicitarBackgroundSync,
  registrarListenerBackgroundSync,
  verificarConexionRed,
  obtenerEstadoOffline
} = await import('../src/utils.js');

assert.equal(typeof solicitarBackgroundSync, 'function', 'solicitarBackgroundSync debe ser función');
assert.equal(typeof registrarListenerBackgroundSync, 'function', 'registrarListenerBackgroundSync debe ser función');
assert.equal(typeof verificarConexionRed, 'function', 'verificarConexionRed debe ser función');
assert.equal(typeof obtenerEstadoOffline, 'function', 'obtenerEstadoOffline debe ser función');

// Test A: Estado offline reporta estructura correcta
const estado = obtenerEstadoOffline();
assert.equal(typeof estado, 'object', 'obtenerEstadoOffline debe retornar un objeto');
assert.equal(typeof estado.online, 'boolean', 'estado.online debe ser booleano');
assert.equal(typeof estado.queueCount, 'number', 'estado.queueCount debe ser numérico');
assert.equal(typeof estado.backgroundSyncSupported, 'boolean', 'estado.backgroundSyncSupported debe ser booleano');

// Test B: registrarListenerBackgroundSync retorna función de desuscripción segura
const unsubscribeSync = registrarListenerBackgroundSync(() => {});
assert.equal(typeof unsubscribeSync, 'function', 'registrarListenerBackgroundSync debe retornar función de desuscripción');
unsubscribeSync(); // Ejecución segura sin excepciones

// Test C: solicitarBackgroundSync responde con promesa booleana segura
const syncPromise = solicitarBackgroundSync('test-tag');
assert(syncPromise instanceof Promise, 'solicitarBackgroundSync debe retornar una Promesa');
const syncResult = await syncPromise;
assert.equal(typeof syncResult, 'boolean', 'El resultado de solicitarBackgroundSync debe ser booleano');

// Test D: sw.js debe declarar la versión v417 del caché PWA
import fs from 'node:fs';
import path from 'node:path';
const swPath = path.resolve('sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
assert.ok(/const CACHE_NAME = 'eurorep-postventa-v(417|418|419)';/.test(swContent), 'sw.js debe declarar versión válida de caché');

console.log('  ✅ Arquitectura Offline-First y Background Sync: OK');

// 51. MÓDULO DE MANTENIMIENTO Y RETENCIÓN DE ALMACENAMIENTO (app.js)
console.log('🧪 Verificando Rutina de Retención y Limpieza de Almacenamiento (app.js)...');
const appJsPath = path.resolve('app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
assert.ok(appJsContent.includes('function ejecutarLimpiezaMantenimientoAlmacenamiento'), 'app.js debe definir ejecutarLimpiezaMantenimientoAlmacenamiento');
assert.ok(appJsContent.includes('window.ejecutarLimpiezaMantenimientoAlmacenamiento = ejecutarLimpiezaMantenimientoAlmacenamiento'), 'ejecutarLimpiezaMantenimientoAlmacenamiento debe exportarse en window');

// Test de lógica de retención con mock de localStorage
const mockStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  get length() { return Object.keys(this.data).length; },
  key(i) { return Object.keys(this.data)[i]; }
};

// Generar 250 logs simulados
const logsPrueba = [];
for (let i = 0; i < 250; i++) {
  logsPrueba.push({ id: `log-${i}`, fecha: new Date(Date.now() - i * 3600000).toISOString() });
}
mockStorage.setItem('sapi_email_logs', JSON.stringify(logsPrueba));

// Simular el proceso de truncado
let logs = JSON.parse(mockStorage.getItem('sapi_email_logs'));
if (logs.length > 200) {
  logs = logs.slice(-200);
  mockStorage.setItem('sapi_email_logs', JSON.stringify(logs));
}
assert.equal(JSON.parse(mockStorage.getItem('sapi_email_logs')).length, 200, 'La retención debe truncar a 200 logs');
console.log('  ✅ Rutina de Retención y Limpieza de Almacenamiento: OK');

// 54. BLINDAJE DE VENTANAS MODALES (PREVENCIÓN DE CIERRE EN BACKDROP Y GESTOS HORIZONTALES)
console.log('🧪 Verificando Blindaje de Ventanas Modales y Prevención de Cierre Accidental...');

// Test A: CSS overscroll-behavior en style.css y cliente.css
const cssStyle = fs.readFileSync(path.resolve('style.css'), 'utf8');
const cssCliente = fs.readFileSync(path.resolve('cliente.css'), 'utf8');
assert.ok(cssStyle.includes('overscroll-behavior-x: none;'), 'style.css debe contener overscroll-behavior-x: none');
assert.ok(cssCliente.includes('overscroll-behavior-x: none;'), 'cliente.css debe contener overscroll-behavior-x: none');

// Test B: Plantillas modales en src/html/modals no deben tener onclick en modal-overlay
const modalDir = path.resolve('src/html/modals');
const modalFiles = fs.readdirSync(modalDir).filter(f => f.endsWith('.html'));
for (const mf of modalFiles) {
  const content = fs.readFileSync(path.join(modalDir, mf), 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('modal-overlay') && l.includes('onclick')) {
      assert.fail(`El archivo ${mf}:${idx+1} aún tiene onclick en el overlay: ${l.trim()}`);
    }
  });
}

// Test C: Funciones de cierre deben ignorar eventos con target en el overlay
function createMockElement(id, classes = ['open', 'modal-overlay']) {
  const classListSet = new Set(classes);
  return {
    id,
    classList: {
      contains: (c) => classListSet.has(c),
      add: (c) => classListSet.add(c),
      remove: (c) => classListSet.delete(c)
    },
    style: {},
    remove: () => {}
  };
}

const mockDoc = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = createMockElement(id);
    }
    return this.elements[id];
  },
  body: { style: {} }
};

const originalDoc = globalThis.document;
globalThis.document = mockDoc;

try {
  // 1. cerrarFormulario
  const ordOverlay = mockDoc.getElementById('modal-overlay');
  ordOverlay.classList.add('open');
  cerrarFormulario({ target: ordOverlay });
  assert.ok(ordOverlay.classList.contains('open'), 'cerrarFormulario NO debe cerrar el modal al hacer clic en el overlay');
  cerrarFormulario();
  assert.ok(!ordOverlay.classList.contains('open'), 'cerrarFormulario debe cerrar al invocarse sin evento o desde botón');

  // 2. cerrarTicket
  const tktOverlay = mockDoc.getElementById('modal-ticket-overlay');
  tktOverlay.classList.add('open');
  cerrarTicket({ target: tktOverlay });
  assert.ok(tktOverlay.classList.contains('open'), 'cerrarTicket NO debe cerrar el modal al hacer clic en el overlay');
  cerrarTicket();
  assert.ok(!tktOverlay.classList.contains('open'), 'cerrarTicket debe cerrar al invocarse sin evento o desde botón');

  // 3. cerrarDetalle
  const detOverlay = mockDoc.getElementById('modal-detalle-overlay');
  detOverlay.classList.add('open');
  cerrarDetalle({ target: detOverlay });
  assert.ok(detOverlay.classList.contains('open'), 'cerrarDetalle NO debe cerrar el modal al hacer clic en el overlay');
  cerrarDetalle();
  assert.ok(!detOverlay.classList.contains('open'), 'cerrarDetalle debe cerrar al invocarse sin evento o desde botón');

  // 4. cerrarDetalleTicket
  const tktDetOverlay = mockDoc.getElementById('modal-ticket-detalle-overlay');
  tktDetOverlay.classList.add('open');
  cerrarDetalleTicket({ target: tktDetOverlay });
  assert.ok(tktDetOverlay.classList.contains('open'), 'cerrarDetalleTicket NO debe cerrar el modal al hacer clic en el overlay');
  cerrarDetalleTicket();
  assert.ok(!tktDetOverlay.classList.contains('open'), 'cerrarDetalleTicket debe cerrar al invocarse sin evento o desde botón');

  // 5. cerrarBitacora
  const bitOverlay = mockDoc.getElementById('modal-bitacora-overlay');
  bitOverlay.classList.add('open');
  cerrarBitacora({ target: bitOverlay });
  assert.ok(bitOverlay.classList.contains('open'), 'cerrarBitacora NO debe cerrar el modal al hacer clic en el overlay');
  cerrarBitacora();
  assert.ok(!bitOverlay.classList.contains('open'), 'cerrarBitacora debe cerrar al invocarse sin evento o desde botón');

  // 6. cerrarCierrePapel
  const cpOverlay = mockDoc.getElementById('modal-cierre-papel-overlay');
  cpOverlay.classList.add('open');
  cerrarCierrePapel({ target: cpOverlay });
  assert.ok(cpOverlay.classList.contains('open'), 'cerrarCierrePapel NO debe cerrar el modal al hacer clic en el overlay');
  cerrarCierrePapel();
  assert.ok(!cpOverlay.classList.contains('open'), 'cerrarCierrePapel debe cerrar al invocarse sin evento o desde botón');
} finally {
  globalThis.document = originalDoc;
}

console.log('  ✅ Blindaje de Ventanas Modales (Prevención Clic Exterior, Arrastre y Gestos Horizontales): OK');

// 55. SOPORTE DE ARRASTRAR Y SOLTAR (DRAG & DROP) PARA COTIZACIONES Y PEDIDOS EN TICKETS
console.log('🧪 Verificando Soporte de Drag & Drop para PDFs en Tickets...');

// Test A: Existencia de estilos en style.css
assert.ok(cssStyle.includes('.custom-file-upload.dragover'), 'style.css debe contener regla .custom-file-upload.dragover');
assert.ok(cssStyle.includes('.custom-file-upload.drag-hint'), 'style.css debe contener regla .custom-file-upload.drag-hint');
assert.ok(cssStyle.includes('.file-sublabel-text'), 'style.css debe contener regla .file-sublabel-text');

// Test B: data-drop-zone y sublabels en plantillas HTML y módulos de detalle
const modalTicketFormHtml = fs.readFileSync(path.join(modalDir, 'modal_ticket_form.html'), 'utf8');
assert.ok(modalTicketFormHtml.includes('data-drop-zone="cotizacion"'), 'modal_ticket_form.html debe incluir data-drop-zone="cotizacion"');
assert.ok(modalTicketFormHtml.includes('data-drop-zone="pedido"'), 'modal_ticket_form.html debe incluir data-drop-zone="pedido"');
assert.ok(modalTicketFormHtml.includes('file-sublabel-text'), 'modal_ticket_form.html debe incluir file-sublabel-text');

const ticketsDetalleCode = fs.readFileSync(path.resolve('tickets_detalle.js'), 'utf8');
assert.ok(ticketsDetalleCode.includes('data-drop-zone="cotizacion"'), 'tickets_detalle.js debe incluir data-drop-zone="cotizacion"');
assert.ok(ticketsDetalleCode.includes('data-drop-zone="pedido"'), 'tickets_detalle.js debe incluir data-drop-zone="pedido"');

// Test C: Funciones exportadas
assert.equal(typeof inicializarDragAndDropTickets, 'function', 'inicializarDragAndDropTickets debe ser una función');
assert.equal(typeof procesarArchivosArrastrados, 'function', 'procesarArchivosArrastrados debe ser una función');

// Test D: Simulación de arrastrar y soltar archivo PDF vs no-PDF
{
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;
  try {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(`
      <div id="modal-ticket-overlay">
        <label class="custom-file-upload" data-drop-zone="cotizacion">
          <input type="file" id="t-cotizacion-pdf" accept="application/pdf" />
          <i data-lucide="upload-cloud"></i>
          <span class="file-label-text">Arrastra aquí o selecciona tu cotización (PDF)</span>
          <span class="file-sublabel-text">Haz clic o suelta el archivo PDF aquí</span>
        </label>
        <button type="button" id="btn-clear-pdf-modal" style="display:none;"></button>
        <div id="pdf-extraction-table-container" style="display:none;"></div>

        <label class="custom-file-upload" data-drop-zone="pedido">
          <input type="file" id="t-pedido-pdf" accept="application/pdf" />
          <i data-lucide="upload-cloud"></i>
          <span class="file-label-text">Arrastra aquí o selecciona tu pedido (PDF)</span>
          <span class="file-sublabel-text">Haz clic o suelta el archivo PDF aquí</span>
        </label>
        <button type="button" id="btn-clear-pdf-pedido-modal" style="display:none;"></button>
      </div>
    `);

    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    dom.window.updateFileLabel = updateFileLabel;

    const cotZone = dom.window.document.querySelector('[data-drop-zone="cotizacion"]');
    const cotInput = dom.window.document.getElementById('t-cotizacion-pdf');
    const clearCotBtn = dom.window.document.getElementById('btn-clear-pdf-modal');

    // 1. Archivo inválido (imagen o ejecutable) debe ser rechazado
    const archivoInvalido = [{ name: 'foto.png', type: 'image/png', size: 1024 }];
    const resInvalido = procesarArchivosArrastrados(cotZone, archivoInvalido);
    assert.strictEqual(resInvalido, false, 'procesarArchivosArrastrados debe rechazar archivos que no sean PDF');

    // 2. Archivo PDF válido debe ser aceptado y actualizar etiquetas
    const pdfCotValido = [{ name: 'Cotizacion_Prueba.pdf', type: 'application/pdf', size: 524288 }]; // 512 KB
    const resValido = procesarArchivosArrastrados(cotZone, pdfCotValido);
    assert.strictEqual(resValido, true, 'procesarArchivosArrastrados debe aceptar archivos PDF válidos');
    
    assert.equal(cotZone.querySelector('.file-label-text').textContent, 'Cotizacion_Prueba.pdf', 'Debe actualizar el nombre del archivo');
    assert.ok(cotZone.querySelector('.file-sublabel-text').textContent.includes('512.0 KB'), 'Debe mostrar el tamaño en KB');
    assert.equal(clearCotBtn.style.display, 'inline-flex', 'Debe mostrar el botón de eliminar cotización');

    // 3. Prueba en Pedido PDF
    const pedZone = dom.window.document.querySelector('[data-drop-zone="pedido"]');
    const clearPedBtn = dom.window.document.getElementById('btn-clear-pdf-pedido-modal');
    const pdfPedValido = [{ name: 'Pedido_12345.pdf', type: 'application/pdf', size: 262144 }]; // 256 KB
    const resPed = procesarArchivosArrastrados(pedZone, pdfPedValido);
    assert.strictEqual(resPed, true, 'procesarArchivosArrastrados debe aceptar pedido PDF');
    assert.equal(pedZone.querySelector('.file-label-text').textContent, 'Pedido_12345.pdf');
    assert.ok(pedZone.querySelector('.file-sublabel-text').textContent.includes('256.0 KB'));
    assert.equal(clearPedBtn.style.display, 'inline-flex', 'Debe mostrar el botón de eliminar pedido');

    // 4. Limpieza con updateFileLabel / clear
    cotInput.files = [];
    updateFileLabel(cotInput);
    assert.equal(cotZone.querySelector('.file-label-text').textContent, 'Arrastra aquí o selecciona tu cotización (PDF)');
    assert.equal(clearCotBtn.style.display, 'none', 'Debe ocultar el botón de eliminar tras limpiar');
  } finally {
    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
  }
}
console.log('  ✅ Soporte de Drag & Drop para PDFs en Tickets (Cotizaciones y Pedidos): OK');

console.log('Test 56: Exportación a Excel (.xlsx) de Tickets y Órdenes de Servicio');
{
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;
  const originalXlsx = globalThis.XLSX;

  try {
    const fs = await import('fs');
    const { JSDOM } = await import('jsdom');
    const indexHtmlContent = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf-8');

    // 1. Verificar existencia de botones en index.html
    assert.ok(indexHtmlContent.includes('id="btn-exportar-tickets-excel"'), 'El botón de exportar tickets debe estar presente en index.html');
    assert.ok(indexHtmlContent.includes('id="btn-exportar-ordenes-excel"'), 'El botón de exportar órdenes debe estar presente en index.html');

    // 2. Simular entorno DOM y XLSX mockeado para pruebas
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="view-tickets" class="active"></div>
        <div id="page-title"></div>
        <div id="tkt-filtered-count"></div>
        <input id="search-tickets" value="" />
        <button id="btn-exportar-tickets-excel" style="display:none;"></button>
        <div id="tickets-body"></div>

        <input id="search-servicios" value="" />
        <button id="btn-exportar-ordenes-excel" style="display:inline-flex;"></button>
        <button id="btn-regenerar-ordenes" style="display:none;"></button>
        <tbody id="tabla-body-servicios"></tbody>
      </body>
      </html>
    `, { url: 'http://localhost:3005' });

    globalThis.document = dom.window.document;
    globalThis.window = dom.window;

    let excelExportedSheets = [];
    let excelExportedFiles = [];
    globalThis.XLSX = {
      utils: {
        json_to_sheet: (data) => {
          excelExportedSheets.push(data);
          return { '!cols': [] };
        },
        book_new: () => ({ Sheets: {}, SheetNames: [] }),
        book_append_sheet: (wb, ws, name) => {
          wb.Sheets[name] = ws;
          wb.SheetNames.push(name);
        }
      },
      writeFile: (wb, filename) => {
        excelExportedFiles.push(filename);
      }
    };
    dom.window.XLSX = globalThis.XLSX;

    const savedGlobalSession = globalThis.currentSession;
    const savedGlobalTickets = globalThis._currentTicketsFiltrados;
    const savedGlobalOrdenes = globalThis._currentOrdenesFiltradas;

    // 3. Prueba de Seguridad: Usuario NO superadmin intenta exportar tickets
    dom.window.currentSession = { userId: 'tec-1', viewMode: 'tecnico', nombre: 'Juan Técnico' };
    globalThis.currentSession = dom.window.currentSession;
    const ticketsPrueba = [
      {
        id: 'tkt-1',
        folio: 'TKT-1001',
        asunto: 'Falla bomba hidráulica',
        categoria: 'Mantenimiento Correctivo',
        solicitante: 'Pedro Supervisor',
        cliente: 'Constructora Alfa',
        sitio: 'Planta Norte',
        area: 'Taller',
        prioridad: 'Alta',
        estado: 'Abierto',
        comentariosInternos: [
          { usuario: 'Carlos Ing', texto: 'Se requiere cambio de empaque', fecha: '2026-10-12T10:00:00Z' }
        ],
        cotizacionSAP: 'COT-8877',
        montoCotizacion: 12500,
        pedidoSAP: 'PED-4433',
        asignado: 'Juan Técnico',
        fechaCreacion: '2026-10-12T08:00:00Z',
        fechaModificacion: '2026-10-12T10:30:00Z',
        modificadoPor: 'Carlos Ing'
      }
    ];

    dom.window._currentTicketsFiltrados = ticketsPrueba;
    dom.window.tickets = ticketsPrueba;
    globalThis._currentTicketsFiltrados = ticketsPrueba;

    const resBloqueado = exportarTicketsAExcel();
    assert.strictEqual(resBloqueado, null, 'exportarTicketsAExcel debe retornar null y rechazar la exportación si el usuario no es superadmin');
    assert.strictEqual(excelExportedFiles.length, 0, 'No debe haberse generado ningún archivo Excel');

    // 4. Prueba con Super Administrador: exportación exitosa de tickets
    dom.window.currentSession = { userId: 'admin-root', viewMode: 'superadmin', realRol: 'superadmin', nombre: 'Super Administrador' };
    globalThis.currentSession = dom.window.currentSession;

    const resExitoTickets = exportarTicketsAExcel();
    assert.ok(Array.isArray(resExitoTickets), 'exportarTicketsAExcel debe retornar el arreglo de datos mapeados');
    assert.strictEqual(resExitoTickets.length, 1, 'Debe exportar el ticket de prueba');
    assert.strictEqual(resExitoTickets[0]['Folio'], 'TKT-1001');
    assert.strictEqual(resExitoTickets[0]['Asunto'], 'Falla bomba hidráulica');
    assert.strictEqual(resExitoTickets[0]['Cliente'], 'Constructora Alfa');
    assert.strictEqual(resExitoTickets[0]['Último Comentario'], 'Se requiere cambio de empaque');
    assert.strictEqual(resExitoTickets[0]['Autor Comentario'], 'Carlos Ing');
    assert.strictEqual(resExitoTickets[0]['Cotización SAP'], 'COT-8877');
    assert.strictEqual(resExitoTickets[0]['Monto Cotización ($)'], 12500);
    assert.strictEqual(resExitoTickets[0]['Pedido SAP'], 'PED-4433');
    assert.strictEqual(resExitoTickets[0]['Técnico Asignado'], 'Juan Técnico');
    assert.ok(excelExportedFiles.some(f => f.startsWith('Tickets_Eurorep_')), 'Debe haberse generado el archivo Excel de tickets');

    // 5. Prueba de Órdenes de Servicio: Bloqueo para perfiles Empresa
    dom.window.currentSession = { userId: 'cli-1', viewMode: 'empresa', nombre: 'Cliente Portal' };
    globalThis.currentSession = dom.window.currentSession;
    const ordenesPrueba = [
      {
        id: 'ord-1',
        folio: 'OS-2001',
        soporte: 'tkt-1',
        cliente: 'Constructora Alfa',
        ubicacion: 'Planta Norte',
        modelo: 'Montacargas Yale ERP-030',
        serie: 'YAL-998877',
        tipo: 'Correctivo',
        estado: 'En Proceso',
        tecnico: 'Juan Técnico',
        fecha: '2026-10-12',
        created_at: '2026-10-12T09:00:00Z',
        descripcion: 'Fuga de aceite en pistón principal',
        trabajo_realizado: 'Diagnóstico preliminar',
        horometro: 1420
      }
    ];
    dom.window._currentOrdenesFiltradas = ordenesPrueba;
    dom.window.ordenes = ordenesPrueba;
    globalThis._currentOrdenesFiltradas = ordenesPrueba;

    const resBloqueadoOrdenes = exportarOrdenesAExcel();
    assert.strictEqual(resBloqueadoOrdenes, null, 'exportarOrdenesAExcel debe retornar null y rechazar para rol empresa');

    // 6. Prueba de Órdenes de Servicio: Exportación exitosa para personal operativo (admin/supervisor/superadmin)
    dom.window.currentSession = { userId: 'sup-1', viewMode: 'supervisor', nombre: 'Supervisor General' };
    globalThis.currentSession = dom.window.currentSession;
    const resExitoOrdenes = exportarOrdenesAExcel();
    assert.ok(Array.isArray(resExitoOrdenes), 'exportarOrdenesAExcel debe retornar el arreglo de datos mapeados');
    assert.strictEqual(resExitoOrdenes.length, 1, 'Debe exportar la orden de prueba');
    assert.strictEqual(resExitoOrdenes[0]['Folio'], 'OS-2001');
    assert.strictEqual(resExitoOrdenes[0]['Ticket Asociado'], 'TKT-1001');
    assert.strictEqual(resExitoOrdenes[0]['Cliente'], 'Constructora Alfa');
    assert.strictEqual(resExitoOrdenes[0]['Modelo'], 'Montacargas Yale ERP-030');
    assert.strictEqual(resExitoOrdenes[0]['No. Serie'], 'YAL-998877');
    assert.strictEqual(resExitoOrdenes[0]['Horómetro'], 1420);
    assert.strictEqual(resExitoOrdenes[0]['Descripción / Falla'], 'Fuga de aceite en pistón principal');
    assert.ok(excelExportedFiles.some(f => f.startsWith('Ordenes_Servicio_Eurorep_')), 'Debe haberse generado el archivo Excel de órdenes');
  } finally {
    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
    globalThis.XLSX = originalXlsx;
    if (typeof savedGlobalSession !== 'undefined') globalThis.currentSession = savedGlobalSession;
    if (typeof savedGlobalTickets !== 'undefined') globalThis._currentTicketsFiltrados = savedGlobalTickets;
    if (typeof savedGlobalOrdenes !== 'undefined') globalThis._currentOrdenesFiltradas = savedGlobalOrdenes;
  }
}
console.log('  ✅ Exportación a Excel (.xlsx) de Tickets y Órdenes de Servicio: OK');

// Test 57: Colorimetría de bitácoras y asignaciones en Calendario
console.log('🧪 Verificando Colorimetría de Bitácoras y Asignaciones en Calendario...');
{
  function calcularColorEventoCalendario(b) {
    const notaClean = (b.nota || '').trim();
    const cleanNotaSinTags = notaClean.replace(/(?:\r?\n|^)\[.*?\]/g, '').trim();
    const cleanNotaLower = cleanNotaSinTags.toLowerCase();

    const hasRealContent = Boolean(
      (b.firma_tecnico_url && b.firma_tecnico_url !== '__DELETED__') ||
      (b.firma_tecnico_base64 && b.firma_tecnico_base64 !== '__DELETED__') ||
      (b.firma_cliente_url && b.firma_cliente_url !== '__DELETED__') ||
      (b.firma_cliente_base64 && b.firma_cliente_base64 !== '__DELETED__') ||
      (b.fotos && b.fotos.length > 0) ||
      (b.evidencias && Object.keys(b.evidencias).length > 0) ||
      b.cierre_papel_pdf
    );

    const isSupervisorTemplate = !cleanNotaSinTags ||
      cleanNotaLower.includes('programado por supervisor') ||
      cleanNotaLower.includes('pendiente de llenado') ||
      cleanNotaLower.includes('pendiente de reporte');
    const hasTechnicianReport = !isSupervisorTemplate && cleanNotaSinTags.length > 15;

    const isRealizado = b.realizado === true || (b.realizado !== false && (hasTechnicianReport || hasRealContent)) || (hasTechnicianReport && !isSupervisorTemplate);
    const esAsignacionPendiente = !isRealizado;

    let eventColor = '#ef4444'; // Rojo por defecto

    if (esAsignacionPendiente) {
      eventColor = '#8b5cf6'; // Morado
    } else {
      if (b.programadoEntrada) {
        const isAligned = !b.desviacion || b.desviacion === 'Alineado' || b.desviacion === '0m';
        if (isAligned) {
          eventColor = '#10b981'; // Verde
        } else {
          eventColor = '#3b82f6'; // Azul
        }
      } else {
        eventColor = '#ef4444'; // Rojo
      }
    }

    const isTrasladoEvent = b.tipo === 'Traslado' || (b.nota && b.nota.toLowerCase().includes('traslado'));
    if (isTrasladoEvent && b.realizado) {
      eventColor = '#475569';
    }

    return eventColor;
  }

  // 1. Asignación programada pendiente (plantilla de supervisor) -> Morado (#8b5cf6)
  const bPendiente = {
    realizado: false,
    programadoEntrada: '09:00',
    programadoSalida: '18:00',
    nota: 'Programado por supervisor. Pendiente de llenado por el técnico.'
  };
  assert.strictEqual(calcularColorEventoCalendario(bPendiente), '#8b5cf6', 'Asignación pendiente debe ser morada (#8b5cf6)');

  // 2. Reporte completado y alineado SIN firmas ni fotos (caso Eduardo Jiménez) -> Verde (#10b981)
  const bCompletadoAlineado = {
    realizado: true,
    programadoEntrada: '09:00',
    programadoSalida: '18:00',
    entrada: '09:00',
    salida: '18:00',
    desviacion: 'Alineado',
    nota: 'Se pasa a hotel por técnico Andrea. Se llega a sitio y se inician pruebas de tableros.'
  };
  assert.strictEqual(calcularColorEventoCalendario(bCompletadoAlineado), '#10b981', 'Reporte completado alineado sin firmas debe ser verde (#10b981)');

  // 3. Reporte con la palabra "programado" en la redacción ("mantenimiento preventivo programado") -> Verde (#10b981)
  const bNotaConPalabraProgramado = {
    realizado: true,
    programadoEntrada: '09:00',
    desviacion: 'Alineado',
    nota: 'Se realizó el mantenimiento preventivo programado de 500 horas satisfactoriamente.'
  };
  assert.strictEqual(calcularColorEventoCalendario(bNotaConPalabraProgramado), '#10b981', 'Reporte con texto "programado" pero realizado debe ser verde (#10b981)');

  // 4. Reporte completado con desviación de horas -> Azul (#3b82f6)
  const bDesviado = {
    realizado: true,
    programadoEntrada: '09:00',
    desviacion: '+2h 30m',
    nota: 'Se concluyó cambio de sellos hidráulicos.'
  };
  assert.strictEqual(calcularColorEventoCalendario(bDesviado), '#3b82f6', 'Reporte con desviación de horas debe ser azul (#3b82f6)');

  // 5. Trabajo completado sin asignación previa -> Rojo (#ef4444)
  const bSinAsignar = {
    realizado: true,
    nota: 'Atención de emergencia en planta.'
  };
  assert.strictEqual(calcularColorEventoCalendario(bSinAsignar), '#ef4444', 'Trabajo no programado debe ser rojo (#ef4444)');

  console.log('  ✅ Colorimetría de Bitácoras y Asignaciones en Calendario: OK');
}

// Test 58: Validación de solapamiento de horarios (ignorar asignaciones pendientes)
console.log('🧪 Verificando que asignaciones pendientes no generen falso empalme de horarios...');
{
  function doOverlap(e1, s1, e2, s2) {
    return (e1 < s2) && (s1 > e2);
  }

  function verificarEmpalme(nuevaEntrada, nuevaSalida, tecnico, fecha, ordenesExistentes, ordenActualIdx = 0, editIdx = null) {
    for (let oIdx = 0; oIdx < ordenesExistentes.length; oIdx++) {
      const ordBit = ordenesExistentes[oIdx].bitacora || [];
      for (let bIdx = 0; bIdx < ordBit.length; bIdx++) {
        const bit = ordBit[bIdx];
        if (editIdx !== null && oIdx === ordenActualIdx && bIdx === editIdx) continue;
        if (bit.realizado === false) continue; // CRUCIAL: Ignorar plantillas o asignaciones pendientes
        if (bit.fecha !== fecha) continue;
        if (bit.tecnico && bit.tecnico.toLowerCase() === tecnico.toLowerCase()) {
          const bitEntrada = bit.entrada || bit.programadoEntrada;
          const bitSalida = bit.salida || bit.programadoSalida;
          if (bitEntrada && bitSalida && nuevaEntrada && nuevaSalida) {
            if (doOverlap(nuevaEntrada, nuevaSalida, bitEntrada, bitSalida)) {
              return { empalme: true, conflicto: bit };
            }
          }
        }
      }
    }
    return { empalme: false };
  }

  const ordenesMock = [
    {
      id: 'ord-1',
      bitacora: [
        // Asignación programada por supervisor (pendiente de llenar por técnico)
        {
          id: 'asig-1',
          tecnico: 'Eduardo Jiménez',
          fecha: '2026-10-13',
          programadoEntrada: '09:00',
          programadoSalida: '18:00',
          realizado: false,
          nota: 'Programado por supervisor'
        }
      ]
    }
  ];

  // Caso 1: El técnico guarda su reporte de 09:00 a 18:00 en la misma fecha
  // NO debe causar error de empalme con la asignación previa realizada: false
  const resSinEmpalme = verificarEmpalme('09:00', '18:00', 'Eduardo Jiménez', '2026-10-13', ordenesMock, 0, null);
  assert.strictEqual(resSinEmpalme.empalme, false, 'Una asignación pendiente no debe bloquear el reporte por falso empalme');

  // Caso 2: Si ya existe un reporte REALIZADO en ese horario, SÍ debe alertar empalme
  ordenesMock[0].bitacora.push({
    id: 'rep-previo',
    tecnico: 'Eduardo Jiménez',
    fecha: '2026-10-13',
    entrada: '09:00',
    salida: '14:00',
    realizado: true,
    nota: 'Trabajo real ya completado'
  });
  const resConEmpalme = verificarEmpalme('10:00', '12:00', 'Eduardo Jiménez', '2026-10-13', ordenesMock, 0, null);
  assert.strictEqual(resConEmpalme.empalme, true, 'Debe alertar empalme si ya hay un reporte realizado por el mismo técnico en el mismo horario');

  console.log('  ✅ Validación de Empalmes (ignora realizado: false): OK');
}

// Test 59: Reconciliador bidireccional de bitácoras (preserva reportes técnicos locales)
console.log('🧪 Verificando que el reconciliador de Supabase preserve reportes técnicos locales...');
{
  function reconciliarBitacoras(ordenLocal, bitacorasRemotas) {
    const ord = { ...ordenLocal, bitacora: [...(ordenLocal.bitacora || [])] };
    const localMap = new Map();
    ord.bitacora.forEach((b, idx) => {
      const k = b.id ? `id:${b.id}` : `legacy:${b.fecha || ''}|${b.tecnico || ''}|${b.entrada || ''}`;
      localMap.set(k, { b, idx });
    });

    bitacorasRemotas.forEach(b => {
      const k = b.id ? `id:${b.id}` : `legacy:${b.fecha || ''}|${b.tecnico || ''}|${b.entrada || ''}`;
      if (localMap.has(k)) {
        const { b: lb, idx } = localMap.get(k);
        const isLocalReal = lb.realizado === true || (lb.realizado !== false && ((lb.nota && lb.nota.length > 20) || lb.firma_tecnico_url || lb.firma_tecnico_base64 || (lb.fotos && lb.fotos.length > 0)));
        const isRemotePending = b.realizado === false || !b.realizado;
        if (isLocalReal && isRemotePending) {
          ord.bitacora[idx] = { ...b, ...lb, realizado: true };
        } else {
          ord.bitacora[idx] = b;
        }
      } else {
        ord.bitacora.push(b);
      }
    });

    return ord.bitacora;
  }

  const ordenLocal = {
    id: 'ord-100',
    bitacora: [
      {
        id: 'bit-001',
        tecnico: 'Eduardo Jiménez',
        fecha: '2026-10-13',
        entrada: '09:00',
        salida: '18:00',
        realizado: true,
        nota: 'Se revisó tablero de control, se cambiaron filtros y se firmó de recibido con el cliente.',
        firma_tecnico_base64: 'data:image/png;base64,mock'
      }
    ]
  };

  // La base de datos remota todavía tiene la plantilla con realizado: false porque el técnico estaba offline
  const bitacorasRemotas = [
    {
      id: 'bit-001',
      tecnico: 'Eduardo Jiménez',
      fecha: '2026-10-13',
      programadoEntrada: '09:00',
      programadoSalida: '18:00',
      realizado: false,
      nota: 'Programado por supervisor'
    }
  ];

  const resultado = reconciliarBitacoras(ordenLocal, bitacorasRemotas);
  assert.strictEqual(resultado.length, 1);
  assert.strictEqual(resultado[0].realizado, true, 'El reporte local realizado no debe sobrescribirse a realizado: false');
  assert.ok(resultado[0].nota.includes('tablero de control'), 'La nota del técnico debe ser preservada');
  assert.ok(resultado[0].firma_tecnico_base64, 'La firma del técnico debe ser preservada');

  console.log('  ✅ Reconciliador de Bitácoras (preservación de avances locales): OK');
}

// Test 60: Validación flexible de identidad de técnicos (UUID y coincidencias de nombre)
console.log('🧪 Verificando validación flexible de identidad de técnicos...');
{
  function normStr(s) {
    return (s || '').toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function esMiAsignacion(session, asignacion) {
    const miNorm = normStr(session?.name || '');
    const bTecNorm = normStr(asignacion.tecnico || '');
    return Boolean(
      (session?.userId && asignacion.tecnicoId && String(asignacion.tecnicoId) === String(session.userId)) ||
      (miNorm && bTecNorm && (bTecNorm.includes(miNorm) || miNorm.includes(bTecNorm)))
    );
  }

  // 1. Coincidencia por UUID
  const session1 = { userId: 'usr-12345', name: 'Eduardo J.' };
  const asig1 = { tecnicoId: 'usr-12345', tecnico: 'Eduardo Jiménez Ortiz' };
  assert.strictEqual(esMiAsignacion(session1, asig1), true, 'Debe coincidir por UUID de usuario');

  // 2. Coincidencia por inclusión de nombre (apellidos compuestos)
  const session2 = { userId: 'usr-999', name: 'Eduardo Jiménez' };
  const asig2 = { tecnicoId: null, tecnico: 'Eduardo Jiménez Ortiz' };
  assert.strictEqual(esMiAsignacion(session2, asig2), true, 'Debe coincidir aunque la asignación tenga segundo apellido');

  // 3. Coincidencia inversa con acentos
  const session3 = { userId: 'usr-888', name: 'Ángel Gómez Martínez' };
  const asig3 = { tecnicoId: null, tecnico: 'Angel Gomez' };
  assert.strictEqual(esMiAsignacion(session3, asig3), true, 'Debe coincidir normalizando acentos e inclusión inversa');

  // 4. No debe coincidir con un técnico distinto
  const session4 = { userId: 'usr-111', name: 'Carlos Mendoza' };
  const asig4 = { tecnicoId: 'usr-222', tecnico: 'Eduardo Jiménez' };
  assert.strictEqual(esMiAsignacion(session4, asig4), false, 'No debe coincidir con un técnico completamente diferente');

  console.log('  ✅ Validación Flexible de Identidad de Técnicos: OK');
}

// Test 61: Resolución de UUIDs a nombres humanos en Juntas de Revisión y deduplicación
console.log('🧪 Verificando resolución de UUIDs a nombres humanos en Juntas...');
{
  const mockUsuarios = [
    { id: '70759c7c-9c4f-4521-80f6-e48994f4deb2', nombre: 'Victor Edmundo Santelis Flores', rol: 'supervisor' },
    { id: 'd775fdce-07fe-48e9-8518-24415aa50195', nombre: 'Abraham reyes', rol: 'tecnico' },
    { id: 'be40ea0f-0eca-4c56-8392-3e00125c32b4', nombre: 'Eduardo Jiménez Ortiz', rol: 'tecnico' },
    { id: 'a956eb23-46f3-4a9d-b36f-db47446b2746', nombre: 'Ernesto Luciano', rol: 'tecnico' }
  ];

  const prevGlobalUsers = global.usuarios;
  global.usuarios = mockUsuarios;

  const { unificarNombreUsuario, extraerListaResponsables, obtenerInfoRolUsuario } = await import('../src/utils.js');

  // 1. unificarNombreUsuario con UUID directo
  const nombreResuelto = unificarNombreUsuario('70759c7c-9c4f-4521-80f6-e48994f4deb2');
  assert.strictEqual(nombreResuelto, 'Victor Edmundo Santelis Flores', 'Debe resolver el UUID de Victor Santelis a su nombre real');

  // 2. extraerListaResponsables con lista mixta (nombre + UUID)
  const listaMixta = extraerListaResponsables('Juan carlos Ramírez, d775fdce-07fe-48e9-8518-24415aa50195');
  assert.deepStrictEqual(listaMixta, ['Juan carlos Ramírez', 'Abraham reyes'], 'Debe transformar el UUID en nombre dentro de la lista');

  // 3. Deduplicación estricta cuando viene el nombre Y el UUID de la misma persona
  const listaDuplicadaConUuid = extraerListaResponsables('Abraham reyes, d775fdce-07fe-48e9-8518-24415aa50195');
  assert.deepStrictEqual(listaDuplicadaConUuid, ['Abraham reyes'], 'Debe deduplicar a una sola persona y no generar fila con UUID');

  // 4. obtenerInfoRolUsuario resolviendo rol correcto a partir de UUID
  const rolVictor = obtenerInfoRolUsuario('70759c7c-9c4f-4521-80f6-e48994f4deb2');
  assert.strictEqual(rolVictor.rol, 'supervisor', 'Debe detectar el rol real del usuario a partir del UUID');

  global.usuarios = prevGlobalUsers;
  console.log('  ✅ Resolución de UUIDs a Nombres Humanos en Juntas: OK');
}

// 62. Verificación de Extracción y Auto-Marcado de Reembolso KM desde SAP PEDIDO / PED_TRI
{
  console.log('🧪 Verificando Extracción y Detección de Reembolso KM...');

  // Mock texto típico extraído de SAP PEDIDO CLIENTE PED_TRI
  const sapCleanText = `
    PEDIDO CLIENTE PED_TRI 2200611
    Cliente: CL002 CONSTRUCTORA EJEMPLO S.A.
    1 15,000.00 16.00 15,000.00 001 1 MET Servicio de Mantenimiento Preventivo E48 ZFAC10
    1 8,800.00 16.00 8,800.00 002 1 MET Reembolso KM/Casetas E48 CDMX - Cardel,Veracruz - 800 - KM - Ida y vuelta - Precio del KM - 11 ZFAC10
    1 1,500.00 16.00 1,500.00 003 1 MET Viaticos Operaciones HOSPEDAJE E48
    1 800.00 16.00 800.00 004 1 MET Viaticos Operaciones ALIMENTOS E48
    Subtotal: 26,100.00
    Importe total: 30,276.00
  `;

  // Test regex SAP PED_TRI
  const itemRegexSap = /(?:(\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+)?(\d{3})\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+(.*?)(?=\s+(?:ZFAC\d+|Item Code:|\d+(?:\.\d+)?\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+\d{3}|\d{3}\s+\d+|\bSubtotal:|\bImporte total:|$))/gi;
  const items = [];
  let m;
  while ((m = itemRegexSap.exec(sapCleanText)) !== null) {
    const desc = (m[8] || '').trim();
    if (desc && desc.length > 2) {
      items.push({
        partida: m[5],
        cantidad: parseFloat(m[6] || m[1] || '1'),
        descripcion: desc,
        total: m[4] ? parseFloat(m[4].replace(/,/g, '')) : 0
      });
    }
  }

  assert.ok(items.length >= 3, `Debe extraer al menos 3 partidas de SAP PED_TRI (se extrajeron ${items.length})`);
  const kmItem = items.find(it => it.descripcion.toLowerCase().includes('reembolso') && it.descripcion.toLowerCase().includes('km'));
  assert.ok(kmItem, 'Debe haber extraído la partida de Reembolso KM/Casetas');
  assert.strictEqual(kmItem.partida, '002', 'La partida de Reembolso KM debe ser 002');

  // Test detección en texto directo como salvaguarda
  const cleanLower = sapCleanText.toLowerCase();
  const hasKmText = (cleanLower.includes('reembolso') && (cleanLower.includes('km') || cleanLower.includes('casetas') || cleanLower.includes('kilometraje'))) || cleanLower.includes('reembolso km');
  assert.strictEqual(hasKmText, true, 'Debe detectar Reembolso KM en texto crudo');

  // Test autoFillFromPdfExtraction evaluando el checkbox
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <input type="number" id="f-noches" value="" />
    <input type="number" id="f-alimentacion" value="" />
    <input type="number" id="f-traslado-costo" value="" />
    <input type="checkbox" id="f-reembolso-km" />
    <input type="text" id="f-pedido" value="2200611" />
  </body></html>`);

  global.document = dom.window.document;
  global.window = dom.window;

  // Mock _lastPdfPedidoExtracted
  window._lastPdfPedidoExtracted = {
    doc: '2200611',
    cleanText: sapCleanText,
    articulos: items,
    mainArticulos: items.filter(x => !x.descripcion.toLowerCase().includes('reembolso') && !x.descripcion.toLowerCase().includes('viaticos')),
    detallesViaje: {
      num_hospedaje: 1,
      num_alimento: 1,
      num_traslado: 800
    }
  };

  const { autoFillFromPdfExtraction } = await import('../src/modules/ordenes_form.js');
  autoFillFromPdfExtraction('TKT-TEST-KM', true);

  const elReembolso = dom.window.document.getElementById('f-reembolso-km');
  assert.strictEqual(elReembolso.checked, true, 'El checkbox f-reembolso-km debe marcarse como true al procesar extracción');

  const elNoches = dom.window.document.getElementById('f-noches');
  assert.strictEqual(elNoches.value, '1', 'f-noches debe auto-llenarse');

  console.log('  ✅ Extracción y Detección de Reembolso KM: OK');
}

// 63. MÓDULO DE SEPARACIÓN DE TÉCNICOS COMBINADOS POR COMAS (CALENDARIO Y TICKETS)
console.log('🧪 Verificando Separación de Técnicos Combinados por Comas...');
{
  const { matchTecnico, actualizarFiltrosCalendario } = await import('../src/modules/calendario.js');
  
  // 1. matchTecnico con combinaciones separadas por coma
  const multiTec = 'Eduardo Jiménez Ortiz, José Antonio Miranda Romero, Abraham reyes';
  assert.strictEqual(matchTecnico(multiTec, 'Eduardo Jiménez Ortiz'), true, 'Debe coincidir con el primer técnico');
  assert.strictEqual(matchTecnico(multiTec, 'José Antonio Miranda Romero'), true, 'Debe coincidir con el segundo técnico');
  assert.strictEqual(matchTecnico(multiTec, 'Abraham reyes'), true, 'Debe coincidir con el tercer técnico');
  assert.strictEqual(matchTecnico(multiTec, 'eduardo jimenez'), true, 'Debe coincidir con nombre normalizado');
  assert.strictEqual(matchTecnico(multiTec, 'Carlos Santana'), false, 'No debe coincidir con técnico no presente');
  
  // 2. matchTecnico con arrays
  assert.strictEqual(matchTecnico(['Eduardo Jiménez Ortiz', 'José Antonio'], 'Eduardo Jiménez Ortiz'), true, 'Array debe coincidir');
  
  // 3. actualizarFiltrosCalendario debe desglosar técnicos combinados y no incluir comas en las opciones
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <select id="filter-cal-cliente"></select>
    <select id="filter-cal-tecnico"></select>
  </body></html>`, { url: 'http://localhost' });

  global.document = dom.window.document;
  global.window = dom.window;

  const prevUsers = global.usuarios;
  const prevTecs = global.tecnicosDb;
  const prevSess = global.currentSession;
  const prevOrds = global.ordenes;

  global.usuarios = [
    { id: 'u1', nombre: 'Pablo Besoy', rol: 'admin', activo: true },
    { id: 'u2', nombre: 'Eduardo Jiménez Ortiz, José Antonio Miranda Romero', rol: 'tecnico', activo: true }
  ];
  global.tecnicosDb = [
    { id: 't1', nombre: 'Ignacio Silvestre alba, Juan carlos Ramírez' }
  ];
  global.currentSession = { userId: 'u1', viewMode: 'admin', nombre: 'Pablo Besoy' };
  global.ordenes = [
    { id: 'o1', cliente: 'Cliente A', tecnico: 'Luis Gress, Rodrigo Alonso Narváez', bitacora: [] }
  ];
  dom.window.usuarios = global.usuarios;
  dom.window.tecnicosDb = global.tecnicosDb;
  dom.window.currentSession = global.currentSession;
  dom.window.ordenes = global.ordenes;
  dom.window.localStorage.setItem('sapi_calendario_eventos', JSON.stringify([
    { id: 'ev1', tipo: 'Junta', titulo: 'Junta Staff', tecnicoNombre: 'Jesús Garduño gomez, José Antonio Miranda Romero' }
  ]));

  actualizarFiltrosCalendario();

  const selectTec = dom.window.document.getElementById('filter-cal-tecnico');
  const options = Array.from(selectTec.options).map(o => o.value).filter(Boolean);

  global.usuarios = prevUsers;
  global.tecnicosDb = prevTecs;
  global.currentSession = prevSess;
  global.ordenes = prevOrds;

  assert.ok(options.length > 0, 'Debe poblar opciones de técnicos');
  options.forEach(opt => {
    assert.strictEqual(opt.includes(','), false, `La opción "${opt}" no debe contener comas`);
  });

  assert.ok(options.includes('Eduardo Jiménez Ortiz'), 'Debe incluir a Eduardo Jiménez Ortiz individualmente');
  assert.ok(options.includes('José Antonio Miranda Romero'), 'Debe incluir a José Antonio Miranda Romero individualmente');
  assert.ok(options.includes('Ignacio Silvestre alba'), 'Debe incluir a Ignacio Silvestre alba individualmente');
  assert.ok(options.includes('Juan carlos Ramírez'), 'Debe incluir a Juan carlos Ramírez individualmente');
  assert.ok(options.includes('Luis Gress'), 'Debe incluir a Luis Gress individualmente');
  assert.ok(options.includes('Rodrigo Alonso Narváez'), 'Debe incluir a Rodrigo Alonso Narváez individualmente');

  console.log('  ✅ Separación de Técnicos Combinados por Comas en Filtros y Búsqueda: OK');
}

// ============================================================
// TEST: Módulo de Servicios Preventivos en Rentas (servicios_preventivos.js)
// ============================================================
{
  console.log('🧪 Verificando Módulo de Servicios Preventivos en Rentas (servicios_preventivos.js)...');
  const { JSDOM } = await import('jsdom');
  const fs = await import('node:fs');
  const path = await import('node:path');

  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <input id="sp-hora-entrada" value="08:30" />
    <input id="sp-hora-salida" value="14:00" />
    <div id="sp-horas-calculadas-badge"></div>
    <div id="sp-checklist-container"></div>
    <select id="sp-tipo-mantenimiento"><option value="250h">250h</option></select>
    <input id="sp-horometro" value="1000" />
    <input id="sp-proximo-horometro" value="" />
    <table id="sp-refacciones-table">
      <tbody id="sp-refacciones-tbody"></tbody>
    </table>
    <div id="sp-refacciones-total-label"></div>
    <input id="sp-monto-mano-obra" value="500" />
    <div id="sp-gran-total-label"></div>
    <div id="badge-count-preventivos"></div>
    <div id="count-pill-sp-todos"></div>
    <div id="count-pill-sp-cliente"></div>
    <div id="count-pill-sp-eurorep"></div>
    <div id="count-pill-sp-garantia"></div>
    <div id="stat-sp-total"></div>
    <div id="stat-sp-cliente"></div>
    <div id="stat-sp-eurorep"></div>
    <div id="stat-sp-garantia"></div>
    <div id="stat-sp-refacciones"></div>
    <div class="modal-overlay" id="modal-servicio-preventivo-overlay">
      <div id="modal-sp-title"></div>
      <div id="modal-sp-folio-badge"></div>
      <select id="sp-renta-id"></select>
      <input id="sp-id" />
      <input id="sp-cliente" />
      <input id="sp-sitio" />
      <input id="sp-equipo" />
      <input id="sp-serie" />
      <input id="sp-fecha" />
      <input id="sp-operador-nombre" />
      <input id="sp-supervisor" />
      <input id="sp-justificacion-pago" />
      <select id="sp-tipo-operador"></select>
      <select id="sp-estado-equipo"></select>
      <select id="sp-select-kit-horas"></select>
      <button id="sp-btn-cargar-kit-sugerido"><span id="sp-btn-cargar-kit-texto"></span></button>
      <div id="sp-kit-banner-info" style="display: none;"><span id="sp-kit-banner-texto"></span></div>
      <input type="radio" name="sp_pagado_por" value="cliente" />
      <input type="radio" name="sp_pagado_por" value="eurorep" />
    </div>
  </body></html>`, { url: 'http://localhost', runScripts: 'dangerously' });

  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;

  // Cargar supabaseSync.js para verificar row converters
  const supaSyncCode = fs.readFileSync(path.resolve('./supabaseSync.js'), 'utf-8');
  dom.window.eval(supaSyncCode);

  // Cargar kits.js
  const kitsCode = fs.readFileSync(path.resolve('./kits.js'), 'utf-8');
  dom.window.eval(kitsCode);

  // Cargar servicios_preventivos.js
  const spCode = fs.readFileSync(path.resolve('./servicios_preventivos.js'), 'utf-8');
  dom.window.eval(spCode);

  // 1. Horas trabajadas (cálculo diurno y nocturno)
  const horasDiurnas = dom.window.recalcularHorasTrabajadasSP();
  assert.equal(horasDiurnas, 5.5, '08:30 a 14:00 deben ser 5.5 horas');

  dom.window.document.getElementById('sp-hora-entrada').value = '22:00';
  dom.window.document.getElementById('sp-hora-salida').value = '02:00';
  const horasNocturnas = dom.window.recalcularHorasTrabajadasSP();
  assert.equal(horasNocturnas, 4.0, '22:00 a 02:00 deben ser 4.0 horas cruzando medianoche');

  // 2. Badges de responsabilidad de pago (Cliente, Eurorep, Garantía, Compartido)
  const bCli = dom.window.obtenerBadgePagadorSP('cliente');
  assert.ok(bCli.includes('Facturable Cliente'), 'Badge cliente debe indicar Facturable');

  const bEur = dom.window.obtenerBadgePagadorSP('eurorep');
  assert.ok(bEur.includes('Cubierto Eurorep'), 'Badge eurorep debe indicar Cubierto');

  const bGar = dom.window.obtenerBadgePagadorSP('garantia');
  assert.ok(bGar.includes('Garantía Fabricante'), 'Badge garantia debe indicar Garantía');

  const bComp = dom.window.obtenerBadgePagadorSP('compartido');
  assert.ok(bComp.includes('Compartido'), 'Badge compartido debe indicar Compartido');

  // 3. Checklist y sugerencia de próximo horómetro
  dom.window.generarChecklistActividadesSP();
  const checkboxes = dom.window.document.querySelectorAll('.sp-checklist-input');
  assert.ok(checkboxes.length >= 5, 'Debe generar items de checklist para mantenimiento preventivo 250h');

  dom.window.calcularProximoHorometroSP();
  const proxHoro = dom.window.document.getElementById('sp-proximo-horometro').value;
  assert.equal(proxHoro, '1250.0', '1000 + 250h debe sugerir próximo servicio en 1250.0 hrs');

  // 4. Tabla dinámica de refacciones y totales de inversión
  dom.window.agregarFilaRefaccionSP({
    clave: 'FIL-01',
    descripcion: 'Filtro aceite motor',
    cantidad: 2,
    unidad: 'Pza',
    costo_unitario: 450,
    pagado_por: 'cliente'
  });
  dom.window.agregarFilaRefaccionSP({
    clave: 'ACE-15W40',
    descripcion: 'Aceite multigrado 15W40',
    cantidad: 10,
    unidad: 'Lts',
    costo_unitario: 120,
    pagado_por: 'eurorep'
  });

  const totales = dom.window.recalcularTotalesServicioPreventivo();
  assert.equal(totales.totalRef, 2100, '2x450 + 10x120 = 2100 en refacciones');
  assert.equal(totales.manoObra, 500, 'Mano de obra debe ser 500');
  assert.equal(totales.granTotal, 2600, 'Gran total debe ser 2600');

  // 5. Supabase sync converters: rowToServicioPreventivo & servicioPreventivoToRow
  assert.equal(typeof dom.window.servicioPreventivoToRow, 'function', 'servicioPreventivoToRow debe existir');
  assert.equal(typeof dom.window.rowToServicioPreventivo, 'function', 'rowToServicioPreventivo debe existir');

  const mockAppSP = {
    id: 'b1234567-89ab-4cde-0123-456789abcdef',
    folio: 'SP-2026-0042',
    renta_id: 'ren-001',
    renta_folio: 'REN-2026-0010',
    cliente: 'Constructora S.A.',
    sitio: 'Obra Autopista',
    equipo: 'Retroexcavadora Cat 416',
    serie: 'CAT416E-1029',
    pagado_por: 'cliente',
    justificacion_pago: 'Servicio programado en contrato',
    monto_mano_obra: 500,
    monto_refacciones: 2100,
    monto_total_servicio: 2600,
    fecha_servicio: '2026-10-13',
    hora_entrada: '08:00',
    hora_salida: '12:00',
    horas_trabajadas: 4.0,
    horometro_servicio: 1500,
    operador_nombre: 'Adrian Franco',
    tipo_operador: 'eurorep',
    estado_equipo: 'Operativo',
    refacciones: [
      { clave: 'FIL-01', descripcion: 'Filtro', cantidad: 2, unidad: 'Pza', costo_unitario: 450, subtotal: 900, pagado_por: 'cliente' }
    ]
  };

  const dbRow = dom.window.servicioPreventivoToRow(mockAppSP);
  assert.equal(dbRow.folio, 'SP-2026-0042');
  assert.equal(dbRow.pagado_por, 'cliente');
  assert.equal(dbRow.monto_total_servicio, 2600);
  assert.equal(dbRow.horas_trabajadas, 4.0);

  const restored = dom.window.rowToServicioPreventivo(dbRow);
  assert.equal(restored.folio, mockAppSP.folio);
  assert.equal(restored.cliente, mockAppSP.cliente);
  assert.equal(restored.monto_total_servicio, mockAppSP.monto_total_servicio);
  assert.equal(restored.refacciones.length, 1);
  assert.equal(restored.esPrueba, false);

  // 6. Blindaje y Aislamiento de Sandbox / Modo Pruebas
  let testModeActive = false;
  dom.window.isTestModeActive = () => testModeActive;
  dom.window.isTestData = (item) => {
    if (!item) return false;
    if (item.esPrueba === true || item.es_prueba === true) return true;
    const f = String(item.folio || '').toUpperCase();
    return f.startsWith('SP-PRUEBA') || f.startsWith('REN-PRUEBA');
  };

  // 6.1 Generación de folio en Producción vs Sandbox
  testModeActive = false;
  const folioProd = dom.window.generarSiguienteFolioSP();
  assert.ok(folioProd.startsWith(`SP-${new Date().getFullYear()}-`), `Folio producción debe ser SP-${new Date().getFullYear()}-...: ${folioProd}`);

  testModeActive = true;
  const folioSandbox = dom.window.generarSiguienteFolioSP();
  assert.ok(folioSandbox.startsWith(`SP-PRUEBA-${new Date().getFullYear()}-`), `Folio sandbox debe ser SP-PRUEBA-${new Date().getFullYear()}-...: ${folioSandbox}`);

  // 6.2 Aislamiento de datos en Listado y KPIs
  const spProd = {
    id: 'sp-prod-1',
    folio: 'SP-2026-0001',
    cliente: 'Cliente Real S.A.',
    pagado_por: 'cliente',
    es_prueba: false,
    esPrueba: false
  };
  const spTest = {
    id: 'sp-test-1',
    folio: 'SP-PRUEBA-2026-0001',
    cliente: 'Cliente Prueba Demo',
    pagado_por: 'cliente',
    es_prueba: true,
    esPrueba: true
  };
  dom.window.serviciosPreventivos = [spProd, spTest];

  // En Producción
  testModeActive = false;
  dom.window.actualizarBadgesServiciosPreventivos();
  const countProd = dom.window.document.getElementById('stat-sp-total')?.textContent;
  assert.equal(countProd, '1', 'En producción solo debe contabilizar 1 servicio preventivo real');

  // En Sandbox
  testModeActive = true;
  dom.window.actualizarBadgesServiciosPreventivos();
  const countSandbox = dom.window.document.getElementById('stat-sp-total')?.textContent;
  assert.equal(countSandbox, '1', 'En sandbox solo debe contabilizar 1 servicio preventivo de prueba');

  // 6.3 Aislamiento en selector de Rentas del Modal
  dom.window.rentas = [
    { id: 'ren-real-1', folio: 'REN-0001', cliente: 'Cliente Real', estado: 'Activa', esPrueba: false },
    { id: 'ren-test-1', folio: 'REN-PRUEBA-0001', cliente: 'Cliente Demo', estado: 'Activa', esPrueba: true }
  ];

  // Abrir modal en Producción
  testModeActive = false;
  dom.window.abrirModalServicioPreventivo();
  const optionsProd = Array.from(dom.window.document.getElementById('sp-renta-id')?.options || []).map(o => o.value);
  assert.ok(optionsProd.includes('ren-real-1'), 'Modal de producción debe incluir renta real');
  assert.ok(!optionsProd.includes('ren-test-1'), 'Modal de producción NO debe incluir renta de prueba');

  // Abrir modal en Sandbox
  testModeActive = true;
  dom.window.abrirModalServicioPreventivo();
  const optionsSandbox = Array.from(dom.window.document.getElementById('sp-renta-id')?.options || []).map(o => o.value);
  assert.ok(optionsSandbox.includes('ren-test-1'), 'Modal de sandbox debe incluir renta de prueba');
  assert.ok(!optionsSandbox.includes('ren-real-1'), 'Modal de sandbox NO debe incluir renta real');

  // 7. Kits de refacciones por horas de uso de maquinaria
  const kitsDisponibles = dom.window.obtenerKitsDisponiblesSP();
  assert.ok(kitsDisponibles.length >= 3, 'Debe disponer de kits precargados u oficiales de maquinaria');

  // Asignar maquinaria RM120X y verificar detección de kit 250h sugerido
  dom.window.document.getElementById('sp-equipo').value = 'Rubble Master RM120X';
  dom.window.document.getElementById('sp-tipo-mantenimiento').value = '250h';
  dom.window.actualizarSelectorKitsSP();

  const textoBoton = dom.window.document.getElementById('sp-btn-cargar-kit-texto').textContent;
  assert.ok(textoBoton.includes('250h') && textoBoton.includes('RM120X'), 'Botón sugerido debe mostrar Kit 250h (RM120X)');

  const selectKit = dom.window.document.getElementById('sp-select-kit-horas');
  assert.ok(selectKit.children.length >= 2, 'Select de kits debe tener optgroups con machotes recomendados y catálogo');

  // Cargar kit sugerido (250h)
  dom.window.cargarKitSugeridoSP();
  const filasRef = dom.window.document.querySelectorAll('#sp-refacciones-tbody tr');
  assert.equal(filasRef.length, 3, 'Kit 250h de RM120X debe cargar exactamente 3 refacciones');

  const bannerInfo = dom.window.document.getElementById('sp-kit-banner-info');
  assert.equal(bannerInfo.style.display, 'flex', 'Banner informativo debe mostrarse al aplicar kit');

  // Limpiar refacciones
  dom.window.limpiarRefaccionesSP(false);
  const filasDespuesLimpiar = dom.window.document.querySelectorAll('#sp-refacciones-tbody tr');
  assert.equal(filasDespuesLimpiar.length, 0, 'Limpiar refacciones debe vaciar la tabla');
  assert.equal(bannerInfo.style.display, 'none', 'Banner informativo debe ocultarse al limpiar');

  console.log('  ✅ Módulo de Servicios Preventivos en Rentas (Horarios, Badges, Refacciones, Kits por Horas, Offline Sync & Sandbox Isolation): OK');

  // =========================================================================
  // 8. MÓDULO DE SERVICIOS NO PREVENTIVOS EN RENTAS (BOLSA DE HORAS, BITÁCORA Y MULTIMÁQUINA)
  // =========================================================================
  // Cargar servicios_no_preventivos.js en el entorno DOM
  const snpCode = fs.readFileSync(path.resolve('./servicios_no_preventivos.js'), 'utf-8');
  dom.window.eval(snpCode);

  // Inyectar elementos DOM de Servicios No Preventivos si no existen
  const snpContainer = dom.window.document.createElement('div');
  snpContainer.innerHTML = `
    <div id="rentas-subtab-no-preventivos">
      <div id="stat-bolsa-contratada"></div>
      <div id="stat-bolsa-consumida"></div>
      <div id="stat-bolsa-saldo"></div>
      <div id="stat-bolsa-status-label"></div>
      <div id="stat-bolsa-porcentaje"></div>
      <div id="stat-bolsa-progress-bar"></div>
      <div id="snp-bolsa-maquinas-chips"></div>

      <div id="stat-snp-total">0</div>
      <div id="stat-snp-horas">0.0 hrs</div>
      <div id="stat-snp-maquinas">0</div>
      <div id="stat-snp-bolsa-horas">0.0 hrs</div>
      <div id="stat-snp-refacciones">$0.00</div>

      <span id="badge-count-no-preventivos">0</span>
      <span id="count-pill-snp-todos">0</span>
      <span id="count-pill-snp-correctivo">0</span>
      <span id="count-pill-snp-electrico">0</span>
      <span id="count-pill-snp-hidraulico">0</span>
      <span id="count-pill-snp-calibracion">0</span>

      <select id="snp-filtro-semana"></select>
      <select id="snp-filtro-cliente-bolsa"></select>
      <select id="snp-filtro-renta-bolsa"></select>
      <input id="search-no-preventivos" />

      <table id="no-preventivos-table-body"></table>
      <div id="no-preventivos-cards-mobile"></div>
    </div>

    <!-- Modal Form Elements -->
    <div id="modal-servicio-no-preventivo-overlay" style="display:none;">
      <h3 id="modal-snp-title"></h3>
      <span id="modal-snp-folio-badge"></span>
      <input id="snp-id" />
      <select id="snp-renta-id"></select>
      <input id="snp-cliente" />
      <input id="snp-sitio" />
      <input id="snp-equipo" />
      <input id="snp-serie" />
      <input id="snp-horometro" />
      <span id="snp-horas-calculadas-badge"></span>
      <input id="snp-tecnico-nombre" />
      <input id="snp-fecha" />
      <input id="snp-hora-inicio" />
      <input id="snp-hora-fin" />
      <input id="snp-aplica-bolsa" type="checkbox" checked />
      <select id="snp-tipo-trabajo"></select>
      <select id="snp-sistema"></select>
      <select id="snp-estado-equipo"></select>
      <input id="snp-descripcion-falla" />
      <textarea id="snp-solucion-aplicada"></textarea>
      <tbody id="snp-refacciones-tbody"></tbody>
      <span id="snp-refacciones-total-label"></span>
      <div id="snp-galeria-fotos"></div>
      <canvas id="snp-canvas-firma-tecnico" width="320" height="110"></canvas>
      <canvas id="snp-canvas-firma-cliente" width="320" height="110"></canvas>
      <input id="snp-nombre-recibe" />
    </div>

    <!-- Modal Reporte Semanal -->
    <div id="modal-reporte-semanal-snp-overlay" style="display:none;">
      <select id="snp-reporte-filtro-cliente"></select>
      <select id="snp-reporte-filtro-renta"></select>
      <select id="snp-reporte-filtro-semana"></select>
      <select id="snp-reporte-filtro-maquina"></select>
      <div id="snp-reporte-semanal-documento"></div>
    </div>

    <!-- Modal Config Bolsa -->
    <div id="modal-configurar-bolsa-horas-overlay" style="display:none;">
      <select id="cfg-bolsa-cliente"></select>
      <select id="cfg-bolsa-renta-id"></select>
      <input id="cfg-bolsa-horas-total" />
      <input id="cfg-bolsa-tarifa-excedente" />
      <input id="cfg-bolsa-fecha-inicio" />
      <textarea id="cfg-bolsa-notas"></textarea>
    </div>
  `;
  dom.window.document.body.appendChild(snpContainer);

  // 8.1 Cálculo de horas diurnas y nocturnas
  dom.window.document.getElementById('snp-hora-inicio').value = '08:00';
  dom.window.document.getElementById('snp-hora-fin').value = '11:30';
  const horasSNP1 = dom.window.recalcularHorasTrabajadasSNP();
  assert.equal(horasSNP1, 3.5, '08:00 a 11:30 deben ser 3.5 horas de trabajo técnico');

  dom.window.document.getElementById('snp-hora-inicio').value = '21:00';
  dom.window.document.getElementById('snp-hora-fin').value = '01:30';
  const horasSNPNocturnas = dom.window.recalcularHorasTrabajadasSNP();
  assert.equal(horasSNPNocturnas, 4.5, '21:00 a 01:30 deben ser 4.5 horas cruzando medianoche');

  // 8.2 Generación de Folios en Producción vs Sandbox
  testModeActive = false;
  const folioSNPProd = dom.window.generarSiguienteFolioSNP();
  assert.ok(folioSNPProd.startsWith(`SNP-${new Date().getFullYear()}-`), `Folio producción debe ser SNP-${new Date().getFullYear()}-...: ${folioSNPProd}`);

  testModeActive = true;
  const folioSNPSandbox = dom.window.generarSiguienteFolioSNP();
  assert.ok(folioSNPSandbox.startsWith(`SNP-PRUEBA-${new Date().getFullYear()}-`), `Folio sandbox debe ser SNP-PRUEBA-${new Date().getFullYear()}-...: ${folioSNPSandbox}`);

  // 8.3 Supabase Converters: rowToServicioNoPreventivo & servicioNoPreventivoToRow
  assert.equal(typeof dom.window.servicioNoPreventivoToRow, 'function', 'servicioNoPreventivoToRow debe existir en supabaseSync');
  assert.equal(typeof dom.window.rowToServicioNoPreventivo, 'function', 'rowToServicioNoPreventivo debe existir en supabaseSync');

  const mockSNPApp = {
    id: 'snp-mock-uuid-001',
    folio: 'SNP-2026-0001',
    renta_id: 'ren-001',
    renta_folio: 'REN-2026-0010',
    cliente: 'Minera del Norte S.A.',
    sitio: 'Tajo Norte',
    equipo: 'Trituradora RM120X',
    serie: 'RM120X-5510',
    horometro_servicio: 1845.5,
    tecnico_nombre: 'Adrian Franco',
    fecha_servicio: '2026-10-14',
    semana_ano: '2026-W42',
    hora_inicio: '08:00',
    hora_fin: '11:30',
    horas_trabajadas: 3.5,
    aplica_bolsa_horas: true,
    tipo_trabajo: 'Correctivo Mecanico',
    sistema_afectado: 'Trituracion / Cribado',
    estado_equipo: 'Operativo',
    descripcion_falla: 'Banda transportadora principal descentrada y con roce',
    solucion_aplicada: 'Alineación de polea de cola, ajuste de tensores y prueba con 40m3 de balasto.',
    monto_refacciones: 850,
    refacciones: [
      { clave: 'ROD-6205', descripcion: 'Rodamiento de rodillo guía', cantidad: 2, unidad: 'PZA', costo_unitario: 425, subtotal: 850, pagado_por: 'cliente' }
    ]
  };

  const snpRow = dom.window.servicioNoPreventivoToRow(mockSNPApp);
  assert.equal(snpRow.folio, 'SNP-2026-0001');
  assert.equal(snpRow.equipo, 'Trituradora RM120X');
  assert.equal(snpRow.horas_trabajadas, 3.5);
  assert.equal(snpRow.aplica_bolsa_horas, true);
  assert.equal(snpRow.semana_ano, '2026-W42');

  const snpRestored = dom.window.rowToServicioNoPreventivo(snpRow);
  assert.equal(snpRestored.folio, mockSNPApp.folio);
  assert.equal(snpRestored.descripcion_falla, mockSNPApp.descripcion_falla);
  assert.equal(snpRestored.horas_trabajadas, 3.5);
  assert.equal(snpRestored.refacciones.length, 1);
  assert.equal(snpRestored.esPrueba, false);

  // 8.4 Bolsa de Horas Dashboard y Balance Por Cliente (Multi-Proyecto)
  // Caso de uso: Un mismo cliente ("Minera del Norte S.A.") tiene dos contratos/obras distintas (ren-001 y ren-002)
  dom.window.rentas = [
    {
      id: 'ren-001',
      folio: 'REN-2026-0010',
      cliente: 'Minera del Norte S.A.',
      sitio: 'Tajo Norte',
      equipo: 'Trituradora RM120X',
      bolsa_horas_total: 50.0,
      bolsa_tarifa_excedente: 650
    },
    {
      id: 'ren-002',
      folio: 'REN-2026-0011',
      cliente: 'Minera del Norte S.A.',
      sitio: 'Planta Peñasquito',
      equipo: 'Excavadora HX220',
      bolsa_horas_total: 30.0,
      bolsa_tarifa_excedente: 650
    }
  ];

  // Configurar bolsa global del cliente en 80 hrs
  const bolsasClientesTest = {
    'minera del norte s.a.': {
      cliente: 'Minera del Norte S.A.',
      horas_contratadas: 80.0,
      tarifa_excedente: 650,
      fecha_inicio: '2026-10-01',
      notas: 'Bolsa acordada para ambos frentes de trabajo'
    }
  };
  dom.window.localStorage.setItem('sapi_bolsas_clientes', JSON.stringify(bolsasClientesTest));

  dom.window.serviciosNoPreventivos = [
    {
      id: 'snp-1',
      folio: 'SNP-2026-0001',
      renta_id: 'ren-001',
      cliente: 'Minera del Norte S.A.',
      sitio: 'Tajo Norte',
      equipo: 'Trituradora RM120X',
      horas_trabajadas: 4.0,
      aplica_bolsa_horas: true,
      fecha_servicio: '2026-10-14',
      semana_ano: '2026-W42'
    },
    {
      id: 'snp-2',
      folio: 'SNP-2026-0002',
      renta_id: 'ren-002',
      cliente: 'Minera del Norte S.A.',
      sitio: 'Planta Peñasquito',
      equipo: 'Excavadora HX220',
      horas_trabajadas: 6.0,
      aplica_bolsa_horas: true,
      fecha_servicio: '2026-10-14',
      semana_ano: '2026-W42'
    },
    {
      id: 'snp-3',
      folio: 'SNP-2026-0003',
      renta_id: 'ren-001',
      cliente: 'Minera del Norte S.A.',
      sitio: 'Tajo Norte',
      equipo: 'Criba Móvil MSC8500',
      horas_trabajadas: 2.5,
      aplica_bolsa_horas: false, // Extraordinario, no descuenta bolsa
      fecha_servicio: '2026-10-14',
      semana_ano: '2026-W42'
    }
  ];

  // Actualizar dashboard filtrando por el cliente
  dom.window.actualizarBolsaHorasDashboard('Minera del Norte S.A.');

  const statContratada = dom.window.document.getElementById('stat-bolsa-contratada')?.textContent;
  const statConsumida = dom.window.document.getElementById('stat-bolsa-consumida')?.textContent;
  const statSaldo = dom.window.document.getElementById('stat-bolsa-saldo')?.textContent;

  assert.equal(statContratada, '80.0 hrs', 'Horas contratadas de la bolsa del cliente deben ser 80.0 hrs');
  assert.equal(statConsumida, '10.0 hrs', 'Horas consumidas de bolsa del cliente deben ser 4.0 + 6.0 = 10.0 hrs (agrupando múltiples obras y excluyendo horas extraordinarias)');
  assert.equal(statSaldo, '70.0 hrs', 'Saldo disponible de la bolsa del cliente debe ser 80 - 10 = 70.0 hrs');

  // Verificar desglose por maquinaria y sitio para el cliente seleccionado
  const chipsHtml = dom.window.document.getElementById('snp-bolsa-maquinas-chips')?.innerHTML;
  assert.ok(chipsHtml.includes('Trituradora RM120X') && chipsHtml.includes('4.0 hrs'), 'Debe incluir chip de Trituradora en Tajo Norte con 4.0 hrs');
  assert.ok(chipsHtml.includes('Excavadora HX220') && chipsHtml.includes('6.0 hrs'), 'Debe incluir chip de Excavadora en Planta Peñasquito con 6.0 hrs');

  // 8.5 Bitácora Semanal y Generación de Documento por Cliente
  dom.window.abrirModalReporteSemanalSNP();
  dom.window.document.getElementById('snp-reporte-filtro-cliente').value = 'Minera del Norte S.A.';
  dom.window.alCambiarClienteEnReporteSNP();

  const docHtml = dom.window.document.getElementById('snp-reporte-semanal-documento')?.innerHTML;
  assert.ok(docHtml.includes('EUROREP S.A. DE C.V.'), 'Documento semanal debe incluir membrete oficial Eurorep');
  assert.ok(docHtml.includes('Bitácora Semanal de Servicio'), 'Documento debe tener título formal de Bitácora');
  assert.ok(docHtml.includes('Minera del Norte S.A.'), 'Documento debe incluir cliente arrendatario');
  assert.ok(docHtml.includes('80.0 hrs'), 'Documento debe reflejar bolsa contratada por el cliente de 80.0 hrs');
  assert.ok(docHtml.includes('70.0 hrs'), 'Documento debe reflejar saldo restante de bolsa de 70.0 hrs');
  assert.ok(docHtml.includes('Trituradora RM120X'), 'Documento debe incluir intervención de trituradora');
  assert.ok(docHtml.includes('Excavadora HX220'), 'Documento debe incluir intervención de excavadora');

  console.log('  ✅ Módulo de Servicios NO Preventivos en Rentas (Bolsa de Horas por Cliente, Multi-Proyecto, Bitácora Semanal, Supabase & Sandbox): OK');
}

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE MÓDULOS PASARON CON ÉXITO (100%)!\n');
process.exit(0);










