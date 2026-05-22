const { JSDOM } = require('jsdom');
const fs = require('fs');

// Read the index.html
const html = fs.readFileSync('index.html', 'utf8');

// Load DOM with resources and scripts mock
const dom = new JSDOM(html, {
  url: 'http://localhost',
  runScripts: 'dangerously'
});

const { window } = dom;
const { document } = window;

// Setup localStorage mockup
const store = {};
window.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; }
};

// Setup global mocks on window
window.crypto = { randomUUID: () => 'test-uuid' };
window.lucide = { createIcons: () => {} };
window.FullCalendar = { Calendar: function() { return { render: () => {}, destroy: () => {} }; } };
window.Chart = function() { return { destroy: () => {} }; };

// Mock Supabase
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  })
};

// Read and evaluate scripts
const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8');

// Capture console errors
window.console.error = (...args) => {
  console.log('[BROWSER ERROR]:', ...args);
};

try {
  // Run scripts in window context
  const runInContext = (code, filename) => {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = code;
    document.body.appendChild(scriptEl);
  };

  runInContext(syncCode, 'supabaseSync.js');
  runInContext(appCode, 'app.js');

  console.log('Dispatching DOMContentLoaded...');
  const event = new window.Event('DOMContentLoaded', {
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(event);
  console.log('DOMContentLoaded dispatched successfully.');
} catch (err) {
  console.error('Crash during script evaluation or load:', err);
}
