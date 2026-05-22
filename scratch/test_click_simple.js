const { JSDOM } = require('jsdom');
const fs = require('fs');

console.log('Starting JSDOM parser...');
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

console.log('Loading scripts...');
const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');

try {
  eval(syncCode);
  eval(code);
  
  console.log('Setting up navigation...');
  setupNav();
  
  const activeBefore = document.querySelector('.view.active');
  console.log('Before click. Active view:', activeBefore ? activeBefore.id : 'none');
  
  const btn = document.querySelector('.nav-item[data-view="calendario"]');
  if (btn) {
    console.log('Clicking button...');
    btn.click();
    const activeAfter = document.querySelector('.view.active');
    console.log('After click. Active view:', activeAfter ? activeAfter.id : 'none');
  } else {
    console.log('Button not found!');
  }
} catch(e) {
  console.error('CRASH DETECTED:', e.message, e.stack);
}

console.log('Exiting...');
process.exit(0);
