const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({ json: async () => ({}) });
global.lucide = { createIcons: () => {} };

// Mock setup for missing globals
global.currentSession = { userId: 'superadmin', viewMode: 'superadmin' };

const code = fs.readFileSync('app.js', 'utf8');
try {
  eval(code);
  setupNav();
  console.log('Before click. Active view:', document.querySelector('.view.active').id);
  const btn = document.querySelector('.nav-item[data-view="clientes"]');
  btn.click();
  console.log('After click. Active view:', document.querySelector('.view.active').id);
} catch(e) {
  console.error('CRASH:', e);
}
