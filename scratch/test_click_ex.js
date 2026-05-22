const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = { 
  getItem: (key) => {
    if (key === 'eurorep_usuarios') return '[]';
    if (key === 'eurorep_session') return '{"userId":"superadmin","viewMode":"superadmin","nombre":"Super Admin"}';
    return null;
  }, 
  setItem: () => {} 
};
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({ json: async () => ({}) });
global.lucide = { createIcons: () => {} };

// Mock setup for missing globals
global.currentSession = { userId: 'superadmin', viewMode: 'superadmin', nombre: 'Super Admin' };

// Mock some window functions if needed
dom.window.lucide = global.lucide;
dom.window.fetch = global.fetch;

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');
try {
  eval(syncCode);
  eval(code);
  setupNav();
  console.log('Before click. Active view:', document.querySelector('.view.active')?.id);
  const btn = document.querySelector('.nav-item[data-view="calendario"]');
  if (!btn) {
    console.log('Error: Button with data-view="calendario" not found');
  } else {
    btn.click();
    console.log('After click. Active view:', document.querySelector('.view.active')?.id);
  }
} catch(e) {
  console.error('CRASH:', e);
}
process.exit(0);
