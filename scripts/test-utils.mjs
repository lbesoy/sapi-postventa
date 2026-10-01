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

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE UTILS.JS PASARON CON ÉXITO!\n');
