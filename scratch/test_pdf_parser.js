const fs = require('fs');

// Lightweight self-contained DOM Mock to prevent JSDOM conflicts in Node v24+
const globalMock = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  document: {
    addEventListener: () => {},
    getElementById: (id) => {
      return {
        addEventListener: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        value: '',
        innerHTML: '',
        appendChild: () => {},
        setAttribute: () => {},
        getAttribute: () => '',
        focus: () => {}
      };
    },
    createElement: () => ({ style: {}, classList: { add: () => {} } }),
    body: { style: {} }
  },
  location: { href: 'http://localhost', origin: 'http://localhost', pathname: '/' },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  localStorage: { getItem: () => '[]', setItem: () => {}, removeItem: () => {} },
  navigator: { onLine: true, userAgent: 'Node' },
  DOMParser: class {
    parseFromString(xmlText) {
      return {
        getElementsByTagName: (tagName) => {
          const cleanTag = tagName.replace('cfdi:', '').replace('tfd:', '');
          const nodes = [];
          
          let index = 0;
          while (true) {
            const tagOpenIndex = xmlText.indexOf('<', index);
            if (tagOpenIndex === -1) break;
            
            const tagCloseIndex = xmlText.indexOf('>', tagOpenIndex);
            if (tagCloseIndex === -1) break;
            
            const tagContent = xmlText.substring(tagOpenIndex, tagCloseIndex + 1);
            const tagMatch = new RegExp(`^<\\s*(?:[a-zA-Z0-9_-]+:)?${cleanTag}\\b`, 'i').test(tagContent);
            if (tagMatch) {
              const attrs = {};
              const attrRegex = /([a-zA-Z0-9:]+)\s*=\s*(["'])(.*?)\2/gi;
              let attrMatch;
              while ((attrMatch = attrRegex.exec(tagContent)) !== null) {
                attrs[attrMatch[1]] = attrMatch[3];
              }
              nodes.push({
                getAttribute: (name) => attrs[name] || attrs[name.toLowerCase()] || '',
                hasAttribute: (name) => attrs[name] !== undefined || attrs[name.toLowerCase()] !== undefined
              });
            }
            index = tagCloseIndex + 1;
          }
          return nodes;
        }
      };
    }
  }
};

global.window = globalMock;
global.document = globalMock.document;
global.DOMParser = globalMock.DOMParser;
global.navigator = globalMock.navigator;
global.sessionStorage = globalMock.sessionStorage;
global.localStorage = globalMock.localStorage;
global.location = globalMock.location;

global.configData = {
  rfc: 'ERE140718NY8'
};

global.lucide = { createIcons: () => {} };
global.mostrarNotificacion = () => {};

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

console.log('✅ PDF parser regex tests passed successfully!');
process.exit(0);
