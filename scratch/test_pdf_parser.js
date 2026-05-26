const { JSDOM } = require('jsdom');
const fs = require('fs');

const mockHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="modal-gasto-overlay"></div>
  <div id="gasto-sat-details-accordion"></div>
  <div id="gasto-sat-accordion-body"></div>
  <div id="gasto-sat-suggested-matches-container"></div>
  <div id="gasto-sat-suggested-matches-list"></div>
  <div id="gasto-sat-datos-vinculados"></div>
  <input id="gasto-monto" value="1174.79" />
  <input id="gasto-fecha" value="2026-05-22" />
  <input id="gasto-rfc-emisor" />
  <input id="gasto-uuid-fiscal" />
  <select id="gasto-orden"><option value="">General</option></select>
  <div id="gasto-header-monto"></div>
</body>
</html>
`;
const dom = new JSDOM(mockHtml, { url: 'http://localhost' });
const { window } = dom;
const { document } = window;

global.window = window;
global.document = document;
global.navigator = window.navigator;

// Assign global configData mockup
global.configData = {
  rfc: 'ERE140718NY8'
};

// Mock other globals
global.lucide = { createIcons: () => {} };
global.mostrarNotificacion = () => {};
global.localStorage = {
  getItem: () => '[]',
  setItem: () => {}
};

// Read app.js
const appCode = fs.readFileSync('app.js', 'utf8');
eval(appCode);

console.log('--- STARTING PDF PARSER REGEX TESTS ---');

const sampleText = `
FACTURA DIGITAL
EMISOR: COMERCIALIZADORA DE REFACCIONES S.A. DE C.V.
RFC: CRF120524XYZ
RECEPTOR: EUROREP SAPI DE CV
RFC: ERE140718NY8
DIRECCION: AV. INSURGENTES SUR 1234
FECHA DE EMISION: 2026-05-22T18:04:00
UUID (FOLIO FISCAL): F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D
SUBTOTAL: $1,000.00
IVA: $174.79
TOTAL DE LA INVOICE: $1,174.79 M.N.
GRACIAS POR SU COMPRA!
`;

const result = window.analizarFacturaPdfTexto(sampleText);
console.log('Parsed PDF Metadata result:');
console.log(JSON.stringify(result, null, 2));

if (result.rfc !== 'CRF120524XYZ') {
  console.error('FAIL: RFC extraction incorrect. Expected CRF120524XYZ, got:', result.rfc);
  process.exit(1);
}

if (result.uuid !== 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D') {
  console.error('FAIL: UUID extraction incorrect. Expected F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D, got:', result.uuid);
  process.exit(1);
}

if (result.monto !== 1174.79) {
  console.error('FAIL: Monto extraction incorrect. Expected 1174.79, got:', result.monto);
  process.exit(1);
}

if (result.date !== '2026-05-22') {
  console.error('FAIL: Date extraction incorrect. Expected 2026-05-22, got:', result.date);
  process.exit(1);
}

console.log('✅ PDF regex auto-parsing test passed successfully!');
process.exit(0);
