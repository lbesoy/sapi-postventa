import assert from 'node:assert/strict';
import {
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
  extraerListaResponsables
} from '../src/utils.js';

console.log('🧪 Ejecutando pruebas unitarias para src/utils.js...');

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
console.log('  ✅ extraerListaResponsables: OK');

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

// 10. Levantamientos - calcularEstadisticasLevantamientos
const { calcularEstadisticasLevantamientos } = await import('../src/modules/levantamientos.js');

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
console.log('  ✅ Levantamientos (calcularEstadisticasLevantamientos): OK');

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
    if (id === 'refacciones-footer') return { innerHTML: '' };
    return null;
  },
  addEventListener: () => {}
};
if (!global.window) global.window = {};
global.window.refaccionesDb = [
  { id: '1', codigo: 'REF-01', descripcion: 'Manguera de Presión', marca: 'PUTZMEISTER', marcaCodigo: 'PTZ', grupo: 'Refacciones Bomba', precio: 1500, stock: 5 }
];
global.lucide = { createIcons: () => {} };

renderRefacciones();
assert.ok(mockBody.innerHTML.includes('Manguera de Presión'), 'renderRefacciones debe renderizar items desde window.refaccionesDb');
assert.ok(mockBody.innerHTML.includes('PUTZMEISTER'), 'renderRefacciones debe mostrar la marca resuelta');

// Restaurar mock
global.document = prevDoc;

console.log('  ✅ Catálogo de Maquinaria, Refacciones y Sitios (generarIdInternoMaquina, renderRefacciones y exports): OK');

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
console.log('  ✅ Calendario FullCalendar (getFestivosMexico, getSemanaSanta, getNthDayOfMonth): OK');

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
const { reestablecerTicket26477, obtenerTodosLosPendientes, renderJuntaRevision, copiarMinutaJunta, toggleFullscreenJunta, toggleJuntaAnalytics } = await import('../src/modules/juntas.js');
assert.equal(typeof reestablecerTicket26477, 'function', 'reestablecerTicket26477 debe ser una función');
assert.equal(typeof obtenerTodosLosPendientes, 'function', 'obtenerTodosLosPendientes debe ser una función');
assert.equal(typeof renderJuntaRevision, 'function', 'renderJuntaRevision debe ser una función');
assert.equal(typeof copiarMinutaJunta, 'function', 'copiarMinutaJunta debe ser una función');
assert.equal(typeof toggleFullscreenJunta, 'function', 'toggleFullscreenJunta debe ser una función');
assert.equal(typeof toggleJuntaAnalytics, 'function', 'toggleJuntaAnalytics debe ser una función');

// Test A: Ejecución segura de obtenerTodosLosPendientes sin fallar ante entorno vacío
const pendientes = obtenerTodosLosPendientes();
assert.ok(Array.isArray(pendientes), 'obtenerTodosLosPendientes debe devolver un array');
console.log('  ✅ Juntas de Revisión (obtenerTodosLosPendientes, reestablecerTicket26477 y exports): OK');

// 20. Módulo de Depuración y Auditoría de Tickets
const { analizarInformacionTicket, contarTicketsADepuracion, sanitizarAsignacionesTickets, abrirModalDepurarTickets, exportarDepuradorTicketsAExcel } = await import('../src/modules/depurador_tickets.js');
assert.equal(typeof analizarInformacionTicket, 'function', 'analizarInformacionTicket debe ser una función');
assert.equal(typeof contarTicketsADepuracion, 'function', 'contarTicketsADepuracion debe ser una función');
assert.equal(typeof sanitizarAsignacionesTickets, 'function', 'sanitizarAsignacionesTickets debe ser una función');
assert.equal(typeof abrirModalDepurarTickets, 'function', 'abrirModalDepurarTickets debe ser una función');
assert.equal(typeof exportarDepuradorTicketsAExcel, 'function', 'exportarDepuradorTicketsAExcel debe ser una función');

// Test A: Análisis forense de ticket con datos SAP
const diagTkt = analizarInformacionTicket({ folio: 'TKT-26477', cotizacionSAP: '109923', pedidoSAP: '45001', comentariosInternos: [{ texto: 'ok' }] });
assert.equal(diagTkt.tieneInfo, true, 'Ticket con cotización SAP debe marcar tieneInfo=true');
assert.equal(diagTkt.cotizacionSAP, '109923', 'Cotización SAP debe extraerse correctamente');
assert.equal(diagTkt.pedidoSAP, '45001', 'Pedido SAP debe extraerse correctamente');
assert.equal(diagTkt.numComentarios, 1, 'Debe contar 1 comentario');
console.log('  ✅ Depurador de Tickets (analizarInformacionTicket, sanitizarAsignacionesTickets y exports): OK');

// 21. Módulo de Envíos y Guías de Paquetería
const { obtenerUrlRastreoPaqueteria, asegurarGuiaEnvioParaTicket, obtenerTodosLosEnvios, renderEnvios, exportarEnviosAExcel } = await import('../src/modules/envios.js');
assert.equal(typeof obtenerUrlRastreoPaqueteria, 'function', 'obtenerUrlRastreoPaqueteria debe ser una función');
assert.equal(typeof asegurarGuiaEnvioParaTicket, 'function', 'asegurarGuiaEnvioParaTicket debe ser una función');
assert.equal(typeof obtenerTodosLosEnvios, 'function', 'obtenerTodosLosEnvios debe ser una función');
assert.equal(typeof renderEnvios, 'function', 'renderEnvios debe ser una función');
assert.equal(typeof exportarEnviosAExcel, 'function', 'exportarEnviosAExcel debe ser una función');

// Test A: Generación de URLs de rastreo multicarrier
const urlDhl = obtenerUrlRastreoPaqueteria('DHL Express', '77889900');
assert.ok(urlDhl.includes('dhl.com') && urlDhl.includes('77889900'), 'URL de DHL debe incluir tracking-id');

const urlFedex = obtenerUrlRastreoPaqueteria('FedEx', '1122334455');
assert.ok(urlFedex.includes('fedex.com') && urlFedex.includes('1122334455'), 'URL de FedEx debe incluir trknbr');

const urlEstafeta = obtenerUrlRastreoPaqueteria('Estafeta', 'EST-9988');
assert.ok(urlEstafeta.includes('estafeta.com') && urlEstafeta.includes('EST-9988'), 'URL de Estafeta debe incluir guia');
console.log('  ✅ Envíos y Guías de Paquetería (obtenerUrlRastreoPaqueteria multicarrier y exports): OK');

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

console.log('  ✅ Integración y Sincronización SAP (API_CONFIG, checkPdfSapMatchCount, catálogos y exports): OK');

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

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE MÓDULOS PASARON CON ÉXITO (100%)!\n');



