const fs = require('fs');

console.log('--- STARTING CLOUD SYNC MAPPING TESTS ---');

// Mock window and document variables
global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {}
};
global.document = {
  addEventListener: () => {}
};
global.navigator = { onLine: true };
global.localStorage = {
  getItem: () => '[]',
  setItem: () => {}
};
global.Event = class {};

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
eval(syncCode);

const mockSatData = {
  versionCfdi: '4.0',
  uuid: 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D',
  estatus: 'Vigente',
  total: 1110.00,
  rfcEmisor: 'GVA120524XYZ',
  nombreEmisor: 'GASOLINERA DEL VALLE S.A.'
};

const mockGasto = {
  id: 'gasto-123',
  usuarioId: 'usr-456',
  nombreUsuario: 'Luciano',
  monto: 1110.00,
  satData: mockSatData
};

console.log('Testing gastoToRow...');
const row = gastoToRow(mockGasto);

if (!row.sat_data || row.sat_data.uuid !== 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D') {
  console.error('FAIL: sat_data not correctly mapped to PostgreSQL row:', JSON.stringify(row));
  process.exit(1);
}

console.log('Testing rowToGasto...');
const restored = rowToGasto(row);

if (!restored.satData || restored.satData.uuid !== 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D') {
  console.error('FAIL: satData not correctly restored from database row:', JSON.stringify(restored));
  process.exit(1);
}

console.log('✅ Cloud sync mapping tests passed successfully!');
process.exit(0);
