const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.localStorage = {
  store: {},
  getItem: (key) => global.localStorage.store[key] || null,
  setItem: (key, value) => { global.localStorage.store[key] = value; }
};
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({
  ok: true,
  json: async () => [
    { SlpCode: 'sap1', SlpName: 'SAP Tech 1', TipoUsuario: 'tecnico' }
  ]
});
global.lucide = { createIcons: () => {} };
global.navigator = { onLine: true };
global.Chart = function() { return { destroy: () => {} }; };

// Mock Supabase Client returning only the 10 real user roles
const mockUserRoles = [
  { id: 'u1', nombre: 'Luciano Besoy', rol: 'superadmin', activo: true, email: 'luciano@eurorep.mx' },
  { id: 'u2', nombre: 'Pablo Besoy', rol: 'superadmin', activo: true, email: 'pablo@adgreenpower.com' },
  { id: 'u3', nombre: 'Laura Paz', rol: 'supervisor', activo: true, email: 'operaciones@eurorep.mx' }
];

global.window.supabaseClient = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  channel: () => ({
    on: () => ({ on: () => ({ subscribe: () => {} }) }),
    subscribe: () => {}
  }),
  from: (table) => {
    return {
      select: (columns) => {
        if (table === 'user_roles') {
          return Promise.resolve({ data: mockUserRoles, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }
    };
  }
};

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');

try {
  eval(syncCode);
  eval(code);

  // Trigger loading from Supabase Sync
  window.cargarDatosDeSupabase().then(() => {
    console.log('--- After loading from Supabase Sync ---');
    console.log('Current users stored in localStorage:', localStorage.getItem('eurorep_usuarios'));
    
    // Now trigger SAP Sync
    forzarSincronizacionSAP().then(() => {
      console.log('--- After SAP Sync ---');
      console.log('Local storage users:', localStorage.getItem('eurorep_usuarios'));
      process.exit(0);
    }).catch(err => {
      console.log('Error during forzarSincronizacionSAP:', err.stack || err);
      process.exit(1);
    });
  }).catch(err => {
    console.log('Error during cargarDatosDeSupabase:', err.stack || err);
    process.exit(1);
  });

} catch(e) {
  console.error('CRASH DURING TEST:', e);
  process.exit(1);
}
