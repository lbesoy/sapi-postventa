const { JSDOM } = require('jsdom');
const fs = require('fs');

console.log('Starting JSDOM...');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
  getItem: (key) => {
    if (key === 'eurorep_usuarios') return '[]';
    return null;
  },
  setItem: () => {}
};
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({ json: async () => ({}) });
global.lucide = { createIcons: () => {} };
global.FullCalendar = { Calendar: function() { return { render: () => {} }; } };

// Mock setup for missing globals
global.currentSession = { userId: 'superadmin', viewMode: 'superadmin' };

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');

try {
  eval(syncCode);
  eval(code);
  setupNav();
  
  const navItems = document.querySelectorAll('.nav-item');
  console.log(`Found ${navItems.length} nav items.`);
  
  navItems.forEach(item => {
    const view = item.getAttribute('data-view');
    console.log(`\n--- Simulating click on view: ${view} ---`);
    try {
      item.click();
      const active = document.querySelector('.view.active');
      console.log(`Status: SUCCESS. Active view: ${active ? active.id : 'none'}`);
    } catch(err) {
      console.error(`Status: CRASHED clicking ${view}! Error:`, err.message, err.stack);
    }
  });
} catch(e) {
  console.error('CRASH DURING EVAL:', e.message, e.stack);
}

process.exit(0);
