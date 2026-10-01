import assert from 'node:assert/strict';
import {
  cleanMojibake,
  normStr,
  safeFormatDate,
  formatFechaHoraAmigable,
  isTestUser,
  getTicketFechaModificacion,
  getCurrentUserDisplayName,
  getTicketModificadoPor
} from '../src/utils.js';

console.log('🧪 Ejecutando pruebas unitarias para src/utils.js...');

// 1. cleanMojibake
assert.equal(cleanMojibake('CamiÃ³n'), 'Camión', 'cleanMojibake debe reparar ó mojibake');
assert.equal(cleanMojibake('CotizaciÃ³n'), 'Cotización', 'cleanMojibake debe reparar ó mojibake');
assert.equal(cleanMojibake('GarcÃa'), 'García', 'cleanMojibake debe reparar ía');
assert.equal(cleanMojibake('Texto Normal'), 'Texto Normal', 'cleanMojibake no debe alterar texto normal');
console.log('  ✅ cleanMojibake: OK');

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

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE MÓDULOS PASARON CON ÉXITO (100%)!\n');
