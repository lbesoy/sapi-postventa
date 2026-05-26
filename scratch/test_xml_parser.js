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

console.log('--- STARTING XML 26-FIELD PARSER OFFLINE TESTS ---');

const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Serie="F" Folio="998822" Fecha="2026-05-22T18:04:00" FormaPago="03" MetodoPago="PUE" Moneda="MXN" TipoCambio="1" SubTotal="1000.00" Descuento="50.00" Total="1110.00" TipoDeComprobante="I">
  <cfdi:Emisor Rfc="GVA120524XYZ" Nombre="GASOLINERA DEL VALLE S.A." RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ERE140718NY8" Nombre="EUROREP S.A. DE C.V." RegimenFiscal="603"/>
  <cfdi:Impuestos TotalImpuestosRetenidos="66.00">
    <cfdi:Retenciones>
      <cfdi:Retencion Impuesto="001" Importe="26.00"/>
      <cfdi:Retencion Impuesto="002" Importe="40.00"/>
    </cfdi:Retenciones>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="f1a2b3c4-d5e6-4a7b-8c9d-0e1f2a3b4c5d" FechaTimbrado="2026-05-22T18:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

const result = window.extraerDatosCompletosXml(sampleXml);
console.log('Parsed XML 26 fields results:');
console.log(JSON.stringify(result, null, 2));

const expected = {
  versionCfdi: '4.0',
  uuid: 'F1A2B3C4-D5E6-4A7B-8C9D-0E1F2A3B4C5D',
  estatus: 'Vigente',
  tipoComprobante: 'I - Ingreso',
  fechaEmision: '2026-05-22T18:04:00',
  anoEmision: '2026',
  mesEmision: '05',
  diaEmision: '22',
  fechaTimbrado: '2026-05-22T18:05:00',
  serie: 'F',
  folio: '998822',
  formaPago: '03 - Transferencia electrónica de fondos',
  metodoPago: 'PUE - Pago en una sola exhibición',
  rfcEmisor: 'GVA120524XYZ',
  nombreEmisor: 'GASOLINERA DEL VALLE S.A.',
  rfcReceptor: 'ERE140718NY8',
  nombreReceptor: 'EUROREP S.A. DE C.V.',
  moneda: 'MXN',
  tipoCambio: '1',
  subtotal: 1000.00,
  descuento: 50.00,
  total: 1110.00,
  isrRetenido: 26.00,
  ivaRetenido: 40.00
};

for (const [key, expVal] of Object.entries(expected)) {
  if (result[key] !== expVal) {
    console.error(`FAIL: Field [${key}] incorrect. Expected "${expVal}", got "${result[key]}"`);
    process.exit(1);
  }
}

console.log('✅ XML 26-field parser offline tests passed successfully!');
process.exit(0);
