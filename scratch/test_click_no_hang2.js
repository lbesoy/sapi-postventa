const { JSDOM } = require('jsdom');
const fs = require('fs');

// Mock setInterval but NOT setTimeout
global.setInterval = () => {};

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

// Mock window globals
dom.window.lucide = global.lucide;
dom.window.fetch = global.fetch;
dom.window.setInterval = global.setInterval;

// Mock Chart.js
global.Chart = function() {
  return { destroy: () => {}, update: () => {} };
};
dom.window.Chart = global.Chart;

// Mock FullCalendar
global.FullCalendar = {
  Calendar: function() {
    return { render: () => {}, destroy: () => {} };
  }
};
dom.window.FullCalendar = global.FullCalendar;

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');

try {
  console.log('Evaluating syncCode...');
  eval(syncCode);
  console.log('Evaluating app.js...');
  eval(code);
  
  console.log('Dispatching DOMContentLoaded...');
  const event = new dom.window.Event('DOMContentLoaded');
  dom.window.document.dispatchEvent(event);
  
  console.log('--- Initial State ---');
  console.log('Active view:', dom.window.document.querySelector('.view.active')?.id);
  
  console.log('--- Clicking "calendario" ---');
  const btn = dom.window.document.querySelector('.nav-item[data-view="calendario"]');
  if (!btn) {
    console.log('Error: Button not found');
  } else {
    btn.click();
    console.log('After click. Active view:', dom.window.document.querySelector('.view.active')?.id);
  }
} catch(e) {
  console.error('CRASH:', e);
}
// Force exit so any other timers don't keep it running
process.exit(0);
