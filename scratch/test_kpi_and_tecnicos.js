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

window.console.error = (...args) => {
  console.log('[BROWSER ERROR]:', ...args);
};

try {
  // Set up mock data in localStorage BEFORE evaluating app.js so that the script loads them
  const testTecnicoUser = {
    id: 'user-tec-local-123',
    nombre: 'Local Técnico De Prueba',
    email: 'local_tec@test.com',
    rol: 'tecnico',
    telefono: '555-LOCAL-123'
  };

  window.localStorage.setItem('eurorep_usuarios', JSON.stringify([
    testTecnicoUser,
    { id: 'admin-123', nombre: 'Admin User', rol: 'administrador' }
  ]));
  window.localStorage.setItem('sapi_tecnicos_db', JSON.stringify([
    { nombre: 'SAP Tec Uno', celular: '123-SAP-1', tipoUsuario: 'Técnico' }
  ]));
  window.localStorage.setItem('sapi_ordenes', JSON.stringify([
    { id: 'ord-1', cliente: 'Cliente A', tecnico: 'SAP Tec Uno', estado: 'En proceso', tecnicosAsignados: ['SAP Tec Uno'] }
  ]));
  window.localStorage.setItem('sapi_tickets', JSON.stringify([
    { id: 'tkt-1', cliente: 'Cliente A', asignado: 'SAP Tec Uno', estado: 'Abierto', tecnicosAsignados: ['SAP Tec Uno'] }
  ]));
  window.localStorage.setItem('eurorep_session', JSON.stringify({
    userId: 'user-tec-local-123',
    viewMode: 'tecnico'
  }));

  // Run scripts in window context
  const runInContext = (code, filename) => {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = code;
    document.body.appendChild(scriptEl);
  };

  runInContext(syncCode, 'supabaseSync.js');
  runInContext(appCode, 'app.js');

  console.log('DOM and scripts evaluated successfully.');

  // Test renderStats()
  console.log('Testing renderStats() for technician with 0 orders...');
  window.renderStats();

  const statTotal = document.getElementById('stat-serv-total')?.textContent;
  const statProceso = document.getElementById('stat-serv-proceso')?.textContent;
  console.log(`KPI Stat Total: ${statTotal} (Expected: 0)`);
  console.log(`KPI Stat Proceso: ${statProceso} (Expected: 0)`);
  
  if (statTotal !== '0' || statProceso !== '0') {
    throw new Error(`KPI Stat mismatch: expected 0, got ${statTotal} and ${statProceso}`);
  }
  console.log('✅ renderStats() test passed!');

  // Test renderDashboardV2()
  console.log('Testing renderDashboardV2() for technician with 0 orders...');
  // Mock window.myChart3 and check if renderDashboardV2 executes without crashing
  window.renderDashboardV2();
  console.log('✅ renderDashboardV2() execution test passed!');

  // Test renderTecnicos()
  console.log('Testing renderTecnicos() containing local technician user...');
  window.renderTecnicos();

  // The local technician formatted short name should be "Local Técnico"
  const gridHtml = document.getElementById('tecnicos-grid')?.innerHTML;
  console.log('Tecnicos Grid HTML contains "Local Técnico":', gridHtml.includes('Local Técnico'));
  if (!gridHtml.includes('Local Técnico')) {
    throw new Error('Local technician not found in the rendered grid!');
  }
  if (!gridHtml.includes('Siguiente Orden') || !gridHtml.includes('Último Completado')) {
    throw new Error('Grid does not contain Siguiente Orden or Último Completado labels!');
  }
  if (gridHtml.includes('Siguiente Ticket') || gridHtml.includes('Último Resuelto')) {
    throw new Error('Grid still contains deprecated Siguiente Ticket or Último Resuelto labels!');
  }
  console.log('✅ renderTecnicos() test passed!');

  // Test verDetalleTecnico()
  console.log('Testing verDetalleTecnico() for the local technician...');
  window.verDetalleTecnico('Local Técnico');

  const detailTitle = document.getElementById('tecnico-detalle-title')?.innerHTML;
  console.log('Detail Title:', detailTitle);
  if (!detailTitle.includes('Local Técnico')) {
    throw new Error('Detail view title does not contain "Local Técnico"');
  }

  console.log('✅ verDetalleTecnico() test passed!');

  // Test responsive profile navigation
  console.log('Testing responsive profile navigation title...');
  
  // Registrar listeners de navegación manualmente en el entorno de prueba
  if (typeof window.setupNav === 'function') {
    window.setupNav();
  } else {
    throw new Error('window.setupNav is not defined!');
  }

  const navPref = document.getElementById('nav-preferencias');
  if (!navPref) {
    throw new Error('nav-preferencias element not found in DOM!');
  }

  const labelDesktop = navPref.querySelector('.label-desktop')?.textContent;
  const labelMobile = navPref.querySelector('.label-mobile')?.textContent;
  console.log(`label-desktop in DOM: ${labelDesktop}`);
  console.log(`label-mobile in DOM: ${labelMobile}`);
  if (labelDesktop !== 'Preferencias' || labelMobile !== 'Perfil') {
    throw new Error('Desktop/Mobile labels not structured correctly in navPref');
  }

  // 1. Simulate Desktop Width
  window.innerWidth = 1024;
  navPref.click();
  const titleDesktop = document.getElementById('page-title')?.textContent;
  console.log(`Desktop page-title: ${titleDesktop} (Expected: Preferencias)`);
  if (titleDesktop !== 'Preferencias') {
    throw new Error(`Desktop title mismatch: expected Preferencias, got ${titleDesktop}`);
  }

  // 2. Simulate Mobile Width
  window.innerWidth = 375;
  navPref.click();
  const titleMobile = document.getElementById('page-title')?.textContent;
  console.log(`Mobile page-title: ${titleMobile} (Expected: Perfil)`);
  if (titleMobile !== 'Perfil') {
    throw new Error(`Mobile title mismatch: expected Perfil, got ${titleMobile}`);
  }

  console.log('✅ responsive profile navigation test passed!');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');

} catch (err) {
  console.error('Test crashed:', err);
  process.exit(1);
}
