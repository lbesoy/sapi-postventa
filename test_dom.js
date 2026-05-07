const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
  <html><body>
    <div id="login-screen"></div>
    <div id="app-wrapper"></div>
    <nav>
      <div class="nav-item" data-view="dashboard">Dashboard</div>
      <div class="nav-item" data-view="clientes">Clientes</div>
    </nav>
    <div id="view-dashboard" class="view active"></div>
    <div id="view-clientes" class="view"></div>
    <h1 id="page-title"></h1>
  </body></html>
`, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({ json: async () => ({}) });

const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');
try {
  eval(code);
  setupNav();
  document.querySelector('.nav-item[data-view="clientes"]').click();
  console.log('Click succeeded!');
} catch(e) {
  console.error('Crash during click:', e);
}
