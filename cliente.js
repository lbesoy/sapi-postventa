/* ===== PORTAL DE CLIENTES - EUROREP JS ===== */

// Wrapper seguro para Lucide Icons
window.safeCreateIcons = function() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try {
      lucide.createIcons();
    } catch(e) {
      console.warn('[Lucide Error] Falló al inicializar iconos:', e);
    }
  }
};

// Variable segura para formatear fechas sin lanzar excepciones RangeError
function safeFormatDate(fechaStr, options = { day:'numeric', month:'short' }, defaultVal = 'N/A') {
  if (!fechaStr) return defaultVal;
  
  // Si la fecha es YYYY-MM-DD, añadir hora del mediodía local para evitar desfases de zona horaria
  let cleanStr = String(fechaStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    cleanStr += 'T12:00:00';
  }
  
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return defaultVal;
  try {
    return d.toLocaleDateString('es-MX', options);
  } catch(e) {
    try {
      return d.toLocaleString('es-MX');
    } catch(e2) {
      return defaultVal;
    }
  }
}

// Variables globales para el estado local
let currentSession = null;
let usuarios = [];
let clientesDb = [];
let maquinariaDb = [];
let sitiosDb = [];
let tickets = [];
let ordenes = [];

let nombreEmpresaLogged = null;
let currentTicketFiltro = 'abiertos';
let currentTicketFiltroPrio = '';
let currentTicketOrden = 'reciente';
let selectedTicketPhotoBase64 = null;

// ===== SANDBOX / MODO PRUEBAS =====
function isTestData(item) {
  if (!item) return false;
  if (item.esPrueba === true || item.isTest === true) return true;
  try {
    let notesObj = null;
    if (typeof item.notas === 'string') {
      const trimmed = item.notas.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        notesObj = JSON.parse(trimmed);
      }
    } else {
      notesObj = item.notas;
    }
    if (notesObj && (notesObj.esPrueba === true || notesObj.isTest === true)) {
      return true;
    }
  } catch (e) {}
  
  const fieldsToCheckPrefix = [
    item.folio,
    item.asunto,
    item.serie,
    item.modelo,
    item.id
  ];
  for (const field of fieldsToCheckPrefix) {
    if (field && typeof field === 'string') {
      const trimmed = field.trim().toUpperCase();
      if (
        trimmed.startsWith('[PRUEBA]') || 
        trimmed.startsWith('[TEST]') || 
        trimmed.startsWith('PRUEBA') || 
        trimmed.startsWith('TEST')
      ) {
        return true;
      }
    }
  }
  return false;
}

function isTestUser(user) {
  if (!user) return false;
  const name = (user.nombre || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return name.includes('prueba') || name.includes('test') || email.includes('prueba') || email.includes('test');
}

function isTestModeActive() {
  if (!currentSession) return false;
  const isPrueba1 = currentSession && (
    String(currentSession.nombre || '').toLowerCase().trim() === 'prueba1' ||
    String(currentSession.email || '').toLowerCase().trim() === 'prueba1@prueba.com'
  );
  return isPrueba1;
}

function toggleClientSandboxMode(checked) {
  localStorage.setItem('eurorep_cliente_test_mode', checked ? 'true' : 'false');
  doRender();
}

// Catálogos e Iconos de marcas
const MARCAS_RENDER = {
  'ETP': 'ESSER TWIN PIPES', 'BCR': 'BCR', 'PTZ': 'PUTZMEISTER', 'SCH': 'SCHWING',
  'CIF': 'CIFA', 'MTM': 'MTM', 'MCN': 'MCNELIUS', 'LON': 'LONDON', 'CAS': 'CASAGRANDE',
  'OTM': 'OTRAS MARCAS', 'CNF': 'CONFORMS', 'TFB': 'TEUFELBERGER', 'RBC': 'REBEL CRUSHER',
  'RBM': 'RUBBLE MASTER', 'FIO': 'FIORI', 'EVE': 'EVERDIGM', 'POR': 'PORTAFILL',
  'SIM': 'SIMEM', 'TUR': 'TURBOSOL', 'MBC': 'MB CUCHARAS', 'DOR': 'DORNER',
  'KNK': 'KINGKONG', 'HYU': 'HYUNDAI EVERDIGM', 'HER': 'HERRAMIENTA', 'EBS': 'EBOSS',
  'RCR': 'RUBBLE CRUSHER'
};

// Inicialización del Portal
async function inicializarPortal() {
  // Inicializar Tema (Oscuro por defecto)
  const savedTheme = localStorage.getItem('theme_mode') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  }
  
  // Lucide Icons
  window.safeCreateIcons();

  // Verificar Auth y Rol
  await verificarSesionCliente();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarPortal);
} else {
  inicializarPortal();
}

// Verificación de sesión y restricciones
async function verificarSesionCliente() {
  const loader = document.getElementById('loader-screen');
  const loginScr = document.getElementById('login-screen');
  const appWrap = document.getElementById('app-wrapper');
  
  try {
    // 1. Intentar cargar sesión guardada en localStorage
    let sessionObj = null;
    try {
      sessionObj = JSON.parse(localStorage.getItem('eurorep_session') || '{}');
    } catch(e) {}

    // 2. Si no hay sesión local o está incompleta, verificar Supabase Auth
    if (!sessionObj || !sessionObj.userId || !sessionObj.email) {
      if (window.supabaseClient) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
          // Obtener rol desde base de datos
          const { data: roleData, error } = await window.supabaseClient
            .from('user_roles')
            .select('rol, activo, nombre, empresa, email, telefono')
            .eq('id', session.user.id)
            .single();

          if (!error && roleData && roleData.activo !== false) {
            sessionObj = {
              userId: session.user.id,
              viewMode: roleData.rol,
              nombre: roleData.nombre,
              empresa: roleData.empresa,
              email: roleData.email || session.user.email,
              realUserId: session.user.id,
              realRol: roleData.rol
            };
            localStorage.setItem('eurorep_session', JSON.stringify(sessionObj));
          }
        }
      }
    }

    // 3. Validar si tenemos una sesión autenticada con rol adecuado
    if (sessionObj && sessionObj.userId) {
      const rol = String(sessionObj.viewMode || '').toLowerCase().trim();
      
      // Restricción: Si el rol es admin/supervisor/tecnico, regresarlo al panel principal
      if (['superadmin', 'admin', 'supervisor', 'tecnico', 'consulta'].includes(rol)) {
        showToast('Acceso administrativo detectado. Redirigiendo...', 'info');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        return;
      }

      // Si es empresa o cliente, permitir el paso
      if (rol === 'empresa' || rol === 'cliente') {
        currentSession = sessionObj;
        
        // Validar que la sesión en Supabase esté activa si estamos online
        let isSupaSessionActive = true;
        if (window.supabaseClient && navigator.onLine) {
          try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
              isSupaSessionActive = false;
            }
          } catch(e) {
            console.error('[Auth] Error al comprobar sesión de Supabase:', e);
          }
        }

        if (!isSupaSessionActive) {
          console.warn('[Auth] Sesión de Supabase expirada. Redirigiendo a Login...');
          localStorage.removeItem('eurorep_session');
          loginScr.style.display = 'flex';
          appWrap.classList.remove('visible');
          loader.classList.add('fade-out');
          loader.style.display = 'none';
          return;
        }

        nombreEmpresaLogged = String(currentSession.empresa || currentSession.nombre).toLowerCase().trim();
        
        loginScr.style.display = 'none';
        appWrap.classList.add('visible');
        
        // Cargar Datos
        await inicializarDatos();
        
        // Sincronizar switch de Sandbox
        const sbToggle = document.getElementById('sandbox-mode-toggle');
        const sbContainer = document.querySelector('.sandbox-toggle-container');
        
        const isPrueba1 = currentSession && (
          String(currentSession.nombre || '').toLowerCase().trim() === 'prueba1' ||
          String(currentSession.email || '').toLowerCase().trim() === 'prueba1@prueba.com'
        );

        if (sbContainer) {
          if (isPrueba1) {
            sbContainer.style.display = 'flex';
            if (sbToggle) {
              sbToggle.checked = true; // Prueba1 siempre está en Sandbox
              sbToggle.disabled = true;
              sbContainer.title = "Los usuarios de prueba están fijos en el Sandbox";
              sbContainer.style.opacity = '0.7';
            }
          } else {
            sbContainer.style.display = 'none';
          }
        }

        loader.classList.add('fade-out');
        loader.style.display = 'none';
        return;
      }
    }
    
    // 4. Si falló la autenticación, mostrar login
    localStorage.removeItem('eurorep_session');
    loginScr.style.display = 'flex';
    appWrap.classList.remove('visible');
    loader.classList.add('fade-out');
    loader.style.display = 'none';

  } catch (err) {
    console.error('[Auth Error]', err);
    loader.classList.add('fade-out');
    loader.style.display = 'none';
    loginScr.style.display = 'flex';
  }
}

// Iniciar sesión desde el formulario
async function iniciarSesionCliente(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  
  errEl.textContent = '';
  
  if (!window.supabaseClient) {
    errEl.textContent = 'Error: no hay conexión con Supabase.';
    return;
  }

  // Mostrar spinner en botón
  const btn = e.target.querySelector('button[type="submit"]');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';
  btn.disabled = true;

  try {
    // 1. Autenticar en Supabase Auth
    let userEmail = email;
    if (email && !email.includes('@')) {
      userEmail = email.replace(/\s+/g, '') + '@eurorep.mx';
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: pass
    });

    if (error) throw error;

    // 2. Obtener rol y datos de perfil
    const { data: roleData, error: roleErr } = await window.supabaseClient
      .from('user_roles')
      .select('rol, activo, nombre, empresa, email, telefono')
      .eq('id', data.user.id)
      .single();

    if (roleErr || !roleData) {
      throw new Error('No se encontró configuración de roles para esta cuenta.');
    }

    if (roleData.activo === false) {
      throw new Error('Esta cuenta ha sido desactivada por el administrador.');
    }

    const rol = String(roleData.rol || '').toLowerCase().trim();
    if (!['empresa', 'cliente'].includes(rol)) {
      // Si tiene otro rol, mandarlo al index.html
      currentSession = {
        userId: data.user.id,
        viewMode: roleData.rol,
        nombre: roleData.nombre,
        realUserId: data.user.id,
        realRol: roleData.rol
      };
      localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
      window.location.href = 'index.html';
      return;
    }

    // Guardar sesión de cliente
    currentSession = {
      userId: data.user.id,
      viewMode: roleData.rol,
      nombre: roleData.nombre,
      empresa: roleData.empresa,
      email: roleData.email || data.user.email,
      realUserId: data.user.id,
      realRol: roleData.rol
    };
    localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
    nombreEmpresaLogged = String(currentSession.empresa || currentSession.nombre).toLowerCase().trim();

    showToast('Sesión iniciada con éxito', 'success');
    
    // Recargar la app
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-wrapper').classList.add('visible');
    
    // Cargar datos
    const loader = document.getElementById('loader-screen');
    loader.classList.remove('fade-out');
    
    await inicializarDatos();
    
    loader.classList.add('fade-out');
    loader.style.display = 'none';

  } catch (err) {
    console.error('[Login Error]', err);
    errEl.textContent = err.message || 'Error al iniciar sesión. Verifica tus credenciales.';
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
}

// Cerrar sesión
async function cerrarSesionCliente() {
  if (window.supabaseClient) {
    await window.supabaseClient.auth.signOut().catch(() => {});
  }
  localStorage.removeItem('eurorep_session');
  currentSession = null;
  nombreEmpresaLogged = null;
  
  // Limpiar campos de login
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
  
  document.getElementById('app-wrapper').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
  
  showToast('Sesión cerrada correctamente', 'info');
}

// Carga e Inicialización de datos
function cargarDatosLocales() {
  try {
    usuarios = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
    clientesDb = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    maquinariaDb = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
    sitiosDb = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    tickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
    ordenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
  } catch(e) {
    console.error('Error al cargar datos desde LocalStorage', e);
  }
}

async function inicializarDatos() {
  // 1. Intentar descargar datos frescos de la nube en segundo plano (no bloqueante)
  if (window.cargarDatosDeSupabase) {
    window.cargarDatosDeSupabase().catch(e => {
      console.warn('[Sync] Falló la sincronización en tiempo real en segundo plano.', e);
    });
  }

  // 2. Extraer datos locales de LocalStorage
  cargarDatosLocales();

  // 3. Rellenar Perfil de Sidebar
  const avatar = document.getElementById('sidebar-avatar');
  const nameEl = document.getElementById('sidebar-name');
  const companyEl = document.getElementById('sidebar-empresa');
  const headerComp = document.getElementById('header-company-name');

  const uName = currentSession.nombre || 'Cliente';
  const cName = currentSession.empresa || 'Empresa';

  if (avatar) avatar.textContent = uName.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = uName;
  if (companyEl) companyEl.textContent = cName;
  if (headerComp) headerComp.textContent = cName;

  // 4. Renderizar Vistas
  doRender();
  
  // 5. Vincular clics de navegación
  vincularNavegacion();
}

// Enlace de eventos de navegación
function vincularNavegacion() {
  const navs = document.querySelectorAll('.nav-item, .mobile-nav-item');
  navs.forEach(nav => {
    // Evitar duplicar listeners
    nav.removeEventListener('click', handleNavClick);
    nav.addEventListener('click', handleNavClick);
  });
}

function handleNavClick(e) {
  // Evitar clicks de FAB móviles que llaman funciones rápidas
  if (e.currentTarget.classList.contains('fab-btn') && window.innerWidth <= 768) {
    return;
  }
  
  e.preventDefault();
  const target = e.currentTarget.dataset.target;
  navegarA(target);
}

function navegarA(targetView) {
  // 1. Remover clases activas de la navegación
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    if (item.dataset.target === targetView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 2. Ocultar todas las vistas y mostrar la activa
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  
  const targetEl = document.getElementById('view-' + targetView);
  if (targetEl) targetEl.classList.add('active');

  // 3. Modificar título en header
  const titleMap = {
    'dashboard': 'Resumen',
    'maquinaria': 'Mis Equipos',
    'tickets': 'Solicitudes',
    'servicios': 'Órdenes de Servicio',
    'sitios': 'Mis Sitios'
  };
  
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = titleMap[targetView] || 'Portal';
  
  // Desplazar arriba
  const viewContainer = document.querySelector('.views-container');
  if (viewContainer) viewContainer.scrollTop = 0;

  // Renderizar de nuevo por si se actualizaron datos
  doRender();
}

// Renderizados generales
function doRender() {
  if (!nombreEmpresaLogged) return;

  // --- FILTRADOS DE SEGURIDAD ESTRICTOS POR CLIENTE ---
  // Obtener equipos del cliente
  const misEquipos = maquinariaDb.filter(m => String(m.cliente || '').toLowerCase().trim() === nombreEmpresaLogged);
  const clienteObj = clientesDb.find(c => String(c.nombre || '').toLowerCase().trim() === nombreEmpresaLogged);
  
  // Agregar también máquinas incrustadas en el objeto cliente por si no están en maquinariaDb
  if (clienteObj && clienteObj.maquinas) {
    clienteObj.maquinas.forEach(m => {
      if (!misEquipos.some(x => x.id === m.id || (m.idInterno && x.idInterno === m.idInterno))) {
        misEquipos.push({ ...m, cliente: clienteObj.nombre });
      }
    });
  }

  // Sitios del cliente
  const misSitios = sitiosDb.filter(s => String(s.cliente || '').toLowerCase().trim() === nombreEmpresaLogged || (clienteObj && s.cliente === clienteObj.id));
  if (clienteObj && clienteObj.sitios) {
    clienteObj.sitios.forEach(s => {
      const sName = s.nombre || s.direccion || '';
      if (sName && !misSitios.some(x => x.nombre === sName || x.id === s.id)) {
        misSitios.push({ ...s, cliente: clienteObj.nombre });
      }
    });
  }

  // Tickets del cliente
  const misTickets = tickets.filter(t => {
    const tcli = String(t.cliente || '').toLowerCase().trim();
    const tsol = String(t.solicitante || '').toLowerCase().trim();
    return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
  });

  // Ordenes del cliente
  const misOrdenes = ordenes.filter(o => {
    const ocli = String(o.cliente || '').toLowerCase().trim();
    let fromTicket = false;
    if (o.soporte) {
      const tick = tickets.find(t => t.id === o.soporte);
      if (tick) {
        const tcli = String(tick.cliente || '').toLowerCase().trim();
        const tsol = String(tick.solicitante || '').toLowerCase().trim();
        if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
      }
    }
    return ocli === nombreEmpresaLogged || fromTicket;
  });

  // --- FILTRADO POR MODO SANDBOX ---
  const activeSandbox = isTestModeActive();
  const misEquiposFiltered = misEquipos.filter(m => isTestData(m) === activeSandbox);
  const misTicketsFiltered = misTickets.filter(t => isTestData(t) === activeSandbox);
  const misOrdenesFiltered = misOrdenes.filter(o => isTestData(o) === activeSandbox);

  // --- RENDERIZAR METRICAS (KPIs) ---
  const activeTicketsCount = misTicketsFiltered.filter(t => t.estado && t.estado.toLowerCase() !== 'cerrado').length;
  const activeServicesCount = misOrdenesFiltered.filter(o => o.estado && !['finalizado', 'firmado'].includes(o.estado.toLowerCase())).length;

  const kpiEquipos = document.getElementById('kpi-equipos');
  const kpiTickets = document.getElementById('kpi-tickets');
  const kpiServicios = document.getElementById('kpi-servicios');

  if (kpiEquipos) kpiEquipos.textContent = misEquiposFiltered.length;
  if (kpiTickets) kpiTickets.textContent = activeTicketsCount;
  if (kpiServicios) kpiServicios.textContent = activeServicesCount;

  // --- CALCULAR KPI DE FLOTA CIRCULAR ---
  const fleetKpiEl = document.getElementById('fleet-health-kpi-container');
  if (fleetKpiEl) {
    if (misEquiposFiltered.length > 0) {
      fleetKpiEl.style.display = 'flex';
      
      const machinesInMaintenance = new Set();
      misOrdenesFiltered.filter(o => o.estado && !['finalizado', 'firmado'].includes(o.estado.toLowerCase())).forEach(o => {
        const match = misEquiposFiltered.find(m => 
          m.id === o.maquinaria_id || 
          (m.idInterno && o.equipo && o.equipo.includes(m.idInterno)) ||
          (m.serie && o.equipo && o.equipo.includes(m.serie))
        );
        if (match) {
          machinesInMaintenance.add(match.id || match.idInterno || match.serie);
        }
      });

      const countMaintenance = machinesInMaintenance.size;
      const countOperando = Math.max(0, misEquiposFiltered.length - countMaintenance);
      const availabilityPercent = Math.round((countOperando / misEquiposFiltered.length) * 100);

      // Actualizar UI del anillo
      const ringEl = document.getElementById('fleet-health-ring');
      const percentEl = document.getElementById('fleet-health-percent');
      const descEl = document.getElementById('fleet-health-desc');
      const opCountEl = document.getElementById('fleet-count-operando');
      const maintCountEl = document.getElementById('fleet-count-mantenimiento');

      if (percentEl) percentEl.textContent = `${availabilityPercent}%`;
      if (ringEl) {
        ringEl.style.background = `conic-gradient(var(--green) 0% ${availabilityPercent}%, var(--bg-hover) ${availabilityPercent}% 100%)`;
      }
      if (descEl) {
        if (availabilityPercent === 100) {
          descEl.textContent = 'Todos tus equipos operan en condiciones normales.';
        } else if (availabilityPercent >= 80) {
          descEl.textContent = 'La mayor parte de tu flota está operativa.';
        } else {
          descEl.textContent = 'Varios equipos requieren mantenimiento activo.';
        }
      }
      if (opCountEl) opCountEl.textContent = countOperando;
      if (maintCountEl) maintCountEl.textContent = countMaintenance;
    } else {
      fleetKpiEl.style.display = 'none';
    }
  }

  // --- EJECUTAR COMPONENTES INDIVIDUALES ---
  renderDashboardSection(misOrdenesFiltered, activeServicesCount);
  renderMachinerySection(misEquiposFiltered, misOrdenesFiltered);
  renderTicketsSection(misSitios, misEquiposFiltered, misTicketsFiltered);
  renderServicesSection(misOrdenesFiltered);
  renderLocationsSection(misSitios, misEquiposFiltered);
}

// 1. Dashboard UI
function renderDashboardSection(misOrdenes, activeServicesCount) {
  const container = document.getElementById('active-services-list');
  if (!container) return;

  const activeOrders = misOrdenes.filter(o => o.estado && !['finalizado', 'firmado'].includes(o.estado.toLowerCase()));

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle-2" style="color:var(--green); width:36px; height:36px;"></i>
        <p style="margin-top:0.5rem; font-weight:500;">No tienes servicios activos en curso.</p>
        <span style="font-size:0.8rem; color:var(--text-muted);">Tus equipos operan con normalidad.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Renderizar lista de órdenes activas con un indicador visual de progreso
  let html = '';
  activeOrders.slice(0, 3).forEach(o => {
    const fechaFormat = safeFormatDate(o.fecha, { day:'numeric', month:'short' }, 'Hoy');
    const tecnicoNombre = o.tecnico || 'Asignando Ingeniero...';
    
    // Porcentaje de progreso según estado de la orden
    let pct = 25;
    let label = 'Reporte Recibido';
    let color = 'var(--blue)';
    
    const est = String(o.estado || '').toLowerCase().trim();
    if (est === 'en camino' || est === 'camino') {
      pct = 50;
      label = 'Técnico en Camino';
      color = 'var(--orange)';
    } else if (est === 'en proceso' || est === 'proceso') {
      pct = 75;
      label = 'En Reparación';
      color = 'var(--accent)';
    }

    html += `
      <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; margin-bottom:0.75rem; cursor:pointer;" onclick="abrirDetalleOrdenCliente('${o.id}')">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <strong style="font-size:0.95rem;">${o.folio || 'Servicio'}</strong>
          <span class="status-pill ${est}" style="font-size:0.7rem;">${o.estado || 'Pendiente'}</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">
          <i data-lucide="wrench" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${o.tipo || 'Servicio Técnico'} – ${o.modelo || o.equipo || 'Maquinaria'}
        </p>
        <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
          <span>Técnico: <strong>${tecnicoNombre}</strong></span>
          <span>${fechaFormat}</span>
        </div>
        
        <!-- Barra de progreso visual -->
        <div style="width:100%; height:6px; background:var(--bg-hover); border-radius:3px; overflow:hidden; position:relative;">
          <div style="width:${pct}%; height:100%; background:${color}; transition: width 0.5s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
          <span>Reporte</span>
          <span style="color:${pct >= 50 ? 'var(--text-primary)' : ''}">Camino</span>
          <span style="color:${pct >= 75 ? 'var(--text-primary)' : ''}">En Sitio</span>
          <span style="color:${pct === 100 ? 'var(--text-primary)' : ''}">Terminado</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  lucide.createIcons();
}

// 2. Machinery UI
// 2. Machinery UI
function renderMachinerySection(misEquipos, misOrdenes) {
  const container = document.getElementById('machinery-container');
  if (!container) return;

  if (misEquipos.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <i data-lucide="settings-2" style="width:48px; height:48px;"></i>
        <p style="margin-top:0.75rem; font-weight:600; font-size:1.1rem;">No tienes maquinaria vinculada</p>
        <p style="font-size:0.85rem;">Si tienes equipos de Eurorep y no los visualizas, ponte en contacto para enlazarlos.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  misEquipos.forEach(m => {
    const codMarca = (m.marca || '').toLowerCase().trim();
    const logoImg = getLogoByBrand(codMarca);
    const marcaCompleta = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || 'Genérico';
    
    // Obtener órdenes de servicio históricas de esta máquina
    const ordenesMaquina = misOrdenes.filter(o => 
      o.maquinaria_id === m.id || 
      (m.idInterno && o.equipo && o.equipo.includes(m.idInterno)) ||
      (m.serie && o.equipo && o.equipo.includes(m.serie))
    );

    // Determinar estado de la máquina
    let statusLabel = 'Operando';
    let statusClass = 'operando';
    
    const tieneServicioActivo = ordenesMaquina.some(o => o.estado && !['finalizado', 'firmado'].includes(o.estado.toLowerCase()));
    if (tieneServicioActivo) {
      statusLabel = 'En Mantenimiento';
      statusClass = 'proceso';
    }

    const horometroVal = m.horometro || m.customData?.horometro || 0;
    const ubicacionVal = m.ubicacion || m.customData?.ubicacion || 'Sin Ubicación';

    // Calcular progreso al siguiente mantenimiento preventivo (250h cycle)
    const horasCiclo = Number(horometroVal) % 250;
    const pctCiclo = Math.round((horasCiclo / 250) * 100);
    const horasFaltantes = Math.max(0, 250 - horasCiclo);

    html += `
      <div class="machine-card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%; min-height:430px;">
        <div>
          <div class="machine-header">
            <img src="${logoImg}" alt="${marcaCompleta}" class="machine-brand-logo" />
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>
          
          <div class="machine-body" style="padding:1.25rem;">
            <h3 class="machine-name" style="margin-bottom:0.25rem; font-size:1.15rem; font-weight:700;">${m.modelo || 'Modelo no registrado'}</h3>
            <p class="machine-sn" style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1.25rem; font-weight:500;">
              No. Económico: <strong>${m.idInterno || 'N/A'}</strong> | Serie: <strong>${m.serie || 'S/N'}</strong>
            </p>
            
            <!-- Detalles de Horómetro y Ubicación -->
            <div class="machine-details" style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
              <div style="background:var(--bg-primary); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.02em; display:block; margin-bottom:0.15rem;">Horómetro</span>
                <strong style="font-size:1.05rem; color:var(--text-primary);"><i data-lucide="timer" style="width:14px; height:14px; color:var(--accent); vertical-align:middle; margin-right:3px;"></i> ${Number(horometroVal).toLocaleString()} h</strong>
              </div>
              <div style="background:var(--bg-primary); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.02em; display:block; margin-bottom:0.15rem;">Ubicación</span>
                <strong style="font-size:0.8rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:block; margin-top:2px;" title="${ubicacionVal}"><i data-lucide="map-pin" style="width:12px; height:12px; color:var(--accent); vertical-align:middle; margin-right:3px;"></i> ${ubicacionVal}</strong>
              </div>
            </div>
            
            <!-- Progreso al siguiente mantenimiento preventivo (250h cycle) -->
            <div style="margin-bottom:1.5rem; background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:600; margin-bottom:0.35rem;">
                <span style="color:var(--text-secondary);"><i data-lucide="shield-check" style="width:12px; height:12px; color:var(--green); vertical-align:middle; margin-right:3px;"></i> Próx. Mantenimiento</span>
                <span style="color:var(--text-primary);">${horasFaltantes} horas</span>
              </div>
              <div style="width:100%; height:6px; background:var(--bg-hover); border-radius:3px; overflow:hidden;">
                <div style="width:${pctCiclo}%; height:100%; background:${pctCiclo > 85 ? 'var(--red)' : 'var(--green)'}; border-radius:3px; transition:width 0.4s ease;"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <!-- Historial de Servicios (Collapsible) -->
          <details style="border-top:1px solid var(--border); background:var(--bg-primary); cursor:pointer;">
            <summary style="padding:0.75rem 1.25rem; font-size:0.8rem; font-weight:700; color:var(--text-secondary); outline:none; display:flex; justify-content:space-between; align-items:center; list-style:none;">
              <span>Servicios Recientes (${ordenesMaquina.length})</span>
              <i data-lucide="chevron-down" style="width:14px; height:14px; transition:transform 0.2s ease;"></i>
            </summary>
            <div style="padding:0 1.25rem 1rem 1.25rem; max-height:120px; overflow-y:auto;">
              ${ordenesMaquina.length === 0 ? '<div style="font-size:0.75rem; color:var(--text-muted); padding:0.25rem 0;">Sin historial de servicios.</div>' : ''}
              ${ordenesMaquina.slice(0, 5).map(o => `
                <div class="history-item" onclick="abrirDetalleOrdenCliente('${o.id}')" style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px dashed var(--border); font-size:0.75rem; cursor:pointer;">
                  <span style="font-weight:600; color:var(--accent);">${o.folio || 'Orden'} | <span style="color:var(--text-primary); font-weight:500;">${o.tipo || 'Servicio'}</span></span>
                  <span style="color:var(--text-muted); font-weight:600;">${safeFormatDate(o.fecha, { day:'numeric', month:'short' })}</span>
                </div>
              `).join('')}
            </div>
          </details>
          
          <!-- Acciones de Falla -->
          <div class="machine-actions" style="padding:1rem 1.25rem; border-top:1px solid var(--border); display:flex; background:var(--bg-hover);">
            <button class="btn-primary" onclick="reportarFallaDeMaquina('${m.idInterno || m.id}', '${m.modelo || ''}', '${m.serie || ''}', '${m.ubicacion || ''}')" style="width:100%; display:flex; align-items:center; justify-content:center; gap:0.5rem; font-size:0.85rem; padding:0.6rem;">
              <i data-lucide="alert-triangle" style="width:14px; height:14px;"></i> Reportar Falla
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  
  // Agregar rotación de flecha interactiva para los tags <details>
  document.querySelectorAll('details').forEach(el => {
    el.addEventListener('toggle', () => {
      const icon = el.querySelector('[data-lucide="chevron-down"]');
      if (icon) {
        icon.style.transform = el.open ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  });

  lucide.createIcons();
}

// 3. Tickets UI & Logic
function renderTicketsSection(misSitios, misEquipos, misTickets) {
  // Rellenar combos del formulario de ticket
  const comboSitios = document.getElementById('t-sitio');
  const comboEquipos = document.getElementById('t-equipo');
  
  if (comboSitios && comboSitios.options.length <= 1) {
    const listOptions = misSitios.map(s => {
      const val = s.nombre || s.direccion || '';
      return `<option value="${val}">${val}</option>`;
    }).join('');
    comboSitios.innerHTML = `<option value="" disabled selected>Selecciona ubicación...</option>` + listOptions;
  }
  
  if (comboEquipos && comboEquipos.options.length <= 1) {
    const listOptions = misEquipos.map(m => {
      const codMarca = (m.marca || '').toUpperCase();
      const mFullName = MARCAS_RENDER[codMarca] || m.marca || 'Equipo';
      const cleanId = m.idInterno || m.id || '';
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const text = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      return `<option value="${text}">${text}</option>`;
    }).join('');
    comboEquipos.innerHTML = `<option value="" disabled selected>Selecciona equipo...</option><option value="Otra / No registrada">Otra / No registrada</option>` + listOptions;
  }

  // Renderizar historial de tickets
  const historyList = document.getElementById('tickets-history-list');
  if (!historyList) return;

  // Filtrar y ordenar según controles activos
  let filtered = [...misTickets];
  
  // 1. Filtrar por estado abierto/todos
  if (currentTicketFiltro === 'abiertos') {
    filtered = filtered.filter(t => t.estado && t.estado.toLowerCase() !== 'cerrado');
  }

  // 2. Filtrar por prioridad
  if (currentTicketFiltroPrio) {
    filtered = filtered.filter(t => String(t.prioridad || '').toLowerCase() === currentTicketFiltroPrio.toLowerCase());
  }

  // 3. Ordenar
  filtered.sort((a, b) => {
    if (currentTicketOrden === 'reciente') {
      const da = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
      const db = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
      return db - da; // Más nuevo primero
    } else if (currentTicketOrden === 'antiguo') {
      const da = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
      const db = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
      return da - db; // Más antiguo primero
    } else if (currentTicketOrden === 'prioridad') {
      const pVal = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
      const pa = pVal[a.prioridad] || 0;
      const pb = pVal[b.prioridad] || 0;
      return pb - pa; // Mayor prioridad primero
    } else if (currentTicketOrden === 'estado') {
      return String(a.estado || '').localeCompare(String(b.estado || ''));
    }
    return 0;
  });

  // Ajustar botones de filtro activos
  const btnAbiertos = document.getElementById('btn-filtro-t-abiertos');
  const btnTodos = document.getElementById('btn-filtro-t-todos');
  if (btnAbiertos) btnAbiertos.className = currentTicketFiltro === 'abiertos' ? 'btn-primary' : 'btn-secondary';
  if (btnTodos) btnTodos.className = currentTicketFiltro === 'todos' ? 'btn-primary' : 'btn-secondary';

  if (filtered.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="ticket"></i>
        <p>No hay solicitudes de servicio registradas.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  filtered.forEach(t => {
    const fechaFormat = t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }) : 'Reciente';
    const est = String(t.estado || 'Abierto').toLowerCase().trim();
    
    // Configuración de color por prioridad
    const prioColor = t.prioridad === 'Alta' ? 'var(--red)' : (t.prioridad === 'Baja' ? 'var(--blue)' : 'var(--orange)');
    const prioBadge = `<span style="background:${prioColor}15; color:${prioColor}; border:1px solid ${prioColor}30; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:0.02em;">${t.prioridad || 'Media'}</span>`;
    
    // Iconos de categoría
    const catIcons = {
      'Correctivo': '<i data-lucide="alert-triangle" style="width:16px; height:16px; color:var(--red); flex-shrink:0;"></i>',
      'Preventivo': '<i data-lucide="shield-check" style="width:16px; height:16px; color:var(--green); flex-shrink:0;"></i>',
      'Refacciones': '<i data-lucide="settings" style="width:16px; height:16px; color:var(--accent); flex-shrink:0;"></i>',
      'Otros': '<i data-lucide="help-circle" style="width:16px; height:16px; color:var(--blue); flex-shrink:0;"></i>'
    };
    const iconHtml = catIcons[t.categoria] || '<i data-lucide="ticket" style="width:16px; height:16px; color:var(--accent); flex-shrink:0;"></i>';

    // Determinar pasos activos para la mini línea de tiempo
    let step1Class = 'active';
    let step2Class = '';
    let step3Class = '';
    let step4Class = '';

    if (est === 'cerrado' || est === 'finalizado') {
      step1Class = 'active';
      step2Class = 'active';
      step3Class = 'active';
      step4Class = 'active';
    } else if (est === 'en proceso' || est === 'cotizacion' || est === 'refacciones') {
      step1Class = 'active';
      step2Class = 'active';
      step3Class = 'active';
    } else if (t.asignado && t.asignado !== 'Asignando...') {
      step1Class = 'active';
      step2Class = 'active';
    }
    
    html += `
      <div class="ticket-card-premium" style="border-left: 4px solid ${prioColor};" onclick="abrirDetalleTicketCliente('${t.id}')">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
          <h4 style="margin:0; font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:0.4rem; color:var(--text-primary);">
            ${iconHtml} ${t.asunto || 'Sin Asunto'}
          </h4>
          <span class="status-pill ${est}">${t.estado || 'Abierto'}</span>
        </div>
        
        <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${t.descripcion || 'Sin descripción...'}
        </p>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.25rem;">
          <div style="display:flex; gap:0.75rem; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap;">
            <span style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="calendar" style="width:12px; height:12px;"></i> ${fechaFormat}</span>
            <span style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${t.sitio || 'General'}</span>
            <span style="display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="cpu" style="width:12px; height:12px;"></i> ${t.equipo || 'Genérico'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem;">
            <span>Folio: <strong>${t.folio || 'N/A'}</strong></span>
            ${prioBadge}
          </div>
        </div>

        <div class="ticket-progress-mini">
          <span class="ticket-progress-step ${step1Class}" style="${step1Class ? 'color:var(--text-primary); font-weight:600;' : ''}"><i data-lucide="send" style="width:10px; height:10px;"></i> Reportado</span>
          <span class="ticket-progress-step ${step2Class}" style="${step2Class ? 'color:var(--orange); font-weight:600;' : ''}"><i data-lucide="user" style="width:10px; height:10px;"></i> Asignado</span>
          <span class="ticket-progress-step ${step3Class}" style="${step3Class ? 'color:var(--accent); font-weight:600;' : ''}"><i data-lucide="clock" style="width:10px; height:10px;"></i> En Curso</span>
          <span class="ticket-progress-step ${step4Class}" style="${step4Class ? 'color:var(--green); font-weight:600;' : ''}"><i data-lucide="check" style="width:10px; height:10px;"></i> Resuelto</span>
        </div>
      </div>
    `;
  });

  historyList.innerHTML = html;
  lucide.createIcons();
}

function filtrarHistorialTickets(filtro) {
  currentTicketFiltro = filtro;
  doRender();
}

function onHistorialFiltroChange() {
  currentTicketFiltroPrio = document.getElementById('historial-filtro-prio')?.value || '';
  currentTicketOrden = document.getElementById('historial-ordenar')?.value || 'reciente';
  doRender();
}

// Acción de cambiar de maquina en ticket para habilitar campo de horómetro
function onTicketEquipoChange(val) {
  const group = document.getElementById('t-horometro-group');
  if (!group) return;
  
  if (val && val !== 'Otra / No registrada') {
    group.style.display = 'block';
  } else {
    group.style.display = 'none';
    document.getElementById('t-horometro').value = '';
  }
}

// Subida de imagen y preview para Ticket
function previewFotoTicket(input) {
  const container = document.getElementById('ticket-photo-preview');
  if (!container) return;
  
  container.innerHTML = '';
  selectedTicketPhotoBase64 = null;
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    // Validar tamaño
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen supera el límite de 5MB.', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      selectedTicketPhotoBase64 = e.target.result;
      
      container.innerHTML = `
        <div class="image-preview">
          <img src="${selectedTicketPhotoBase64}" alt="Vista previa" />
          <button type="button" class="image-preview-delete" onclick="eliminarFotoTicketPreview()">✕</button>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  }
}

function eliminarFotoTicketPreview() {
  const input = document.getElementById('t-foto');
  const container = document.getElementById('ticket-photo-preview');
  
  if (input) input.value = '';
  if (container) container.innerHTML = '';
  selectedTicketPhotoBase64 = null;
}

// Enviar creación de Ticket
async function crearTicketCliente(e) {
  e.preventDefault();
  
  if (!window.supabaseClient) {
    showToast('No hay conexión activa con la base de datos.', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:18px; height:18px; border-width:2px; margin:0 auto;"></div> Enviando...';
  btn.disabled = true;

  try {
    const sitioVal = document.getElementById('t-sitio').value;
    const equipoVal = document.getElementById('t-equipo').value;
    const horometroVal = document.getElementById('t-horometro')?.value.trim() || '';
    const prioridadVal = document.getElementById('t-prioridad').value;
    const categoriaVal = document.getElementById('t-categoria').value;
    const asuntoVal = document.getElementById('t-asunto').value.trim();
    const descripcionVal = document.getElementById('t-descripcion').value.trim();

    // Generar Folio consecutivo local temporal
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const isSandbox = isTestModeActive();
    const prefix = isSandbox ? 'TKT-PRUEBA-' : `TKT-${yearStr}`;
    const ticketsDelAnio = tickets.filter(t => t.folio && t.folio.startsWith(prefix));
    let maxConsecutivo = 0;
    ticketsDelAnio.forEach(t => {
      const numStr = t.folio.substring(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
    });
    const newFolio = `${prefix}${(maxConsecutivo + 1).toString().padStart(3, '0')}`;

    // Obtener correo registrado con fallback dinámico de la sesión de Supabase si el caché local no lo tiene
    let emailContacto = currentSession.email || '';
    if (!emailContacto && window.supabaseClient) {
      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session && session.user && session.user.email) {
          emailContacto = session.user.email;
        }
      } catch (errSession) {
        console.error('[Ticket] Fallback de sesión no pudo obtener correo:', errSession);
      }
    }

    // Construir Objeto Ticket
    const ticketId = crypto.randomUUID();
    const newTicket = {
      id: ticketId,
      _synced: false,
      folio: newFolio,
      fecha: new Date().toISOString(),
      fechaCreacion: new Date().toISOString(),
      fechaCierre: null,
      canal: 'portal',
      contacto: emailContacto || '',
      asunto: isSandbox ? `[PRUEBA] ${asuntoVal}` : asuntoVal,
      cliente: currentSession.empresa || currentSession.nombre,
      sitio: sitioVal,
      solicitante: currentSession.nombre,
      creadoPor: currentSession.nombre,
      area: 'Soporte Clientes',
      categoria: categoriaVal,
      prioridad: prioridadVal,
      asignado: 'Sin asignar', // Inicial
      descripcion: descripcionVal,
      equipo: equipoVal,
      horometro: horometroVal,
      notas: selectedTicketPhotoBase64 ? `[H:${horometroVal}]\nFalla reportada con evidencia fotográfica en el portal.` : (horometroVal ? `[H:${horometroVal}]` : ''),
      estado: 'Abierto',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: selectedTicketPhotoBase64 || null, // Guardamos la foto en la columna pdfCotizacion o similar si no hay storage configurado, o directo a Supabase.
      esPrueba: isSandbox
    };

    // Subir foto a columna correspondiente en base de datos.
    // Nota: El backend mapea ticketToRow que inserta en la tabla tickets.
    // Si hay evidencia de foto de falla, la inyectamos en pdf_cotizacion o notas.
    // Para simplificar, si hay Base64, el RLS de Supabase lo subirá.
    
    // Guardar en array local
    tickets.unshift(newTicket);
    localStorage.setItem('sapi_tickets', JSON.stringify(tickets));

    // Sincronizar en la nube
    await window.pushToSupabase('tickets', newTicket);

    showToast('Solicitud creada y enviada correctamente', 'success');

    // Limpiar Formulario
    document.getElementById('form-nuevo-ticket').reset();
    eliminarFotoTicketPreview();
    onTicketEquipoChange('');

    // Actualizar Vistas
    doRender();

  } catch (err) {
    console.error('Error al guardar ticket', err);
    showToast('Falla al enviar la solicitud: ' + (err.message || err), 'error');
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
}

// 4. Service Orders UI
function renderServicesSection(misOrdenes) {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;

  if (misOrdenes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="text-align: center;">No hay órdenes de servicio registradas.</td></tr>`;
  } else {
    let html = '';
    misOrdenes.forEach(o => {
      const fechaFormat = safeFormatDate(o.fecha, { day:'numeric', month:'short', year:'numeric' }, 'N/A');
      const est = String(o.estado || 'Pendiente').toLowerCase().trim();
      
      // Comprobar si hay PDF firmado
      const tieneReporte = !!(o.firma_cliente_base64 || o.evidenciaBase64 || o.firma_tecnico_base64);
      const actionBtn = tieneReporte ? 
        `<button class="btn-secondary" style="padding:0.35rem 0.6rem; font-size:0.8rem; margin:0;" onclick="abrirReportePdfCliente(event, '${o.id}')"><i data-lucide="file-text"></i> PDF</button>` : 
        `<span style="font-size:0.75rem; color:var(--text-muted);">Pendiente</span>`;

      html += `
        <tr onclick="abrirDetalleOrdenCliente('${o.id}')" style="cursor:pointer;">
          <td><strong>${o.folio || 'N/A'}</strong></td>
          <td>${o.modelo || o.equipo || 'Maquinaria'}</td>
          <td>${o.tipo || 'Servicio'}</td>
          <td>${fechaFormat}</td>
          <td>${o.tecnico || 'Sin asignar'}</td>
          <td><span class="status-pill ${est}">${o.estado || 'Pendiente'}</span></td>
          <td style="text-align:right;" onclick="event.stopPropagation()">${actionBtn}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // --- RENDERIZAR CUADRÍCULA DE DOCUMENTOS / REPORTES PDF ---
  const docsContainer = document.getElementById('document-downloads-container');
  if (docsContainer) {
    const ordenesConDocumento = misOrdenes.filter(o => 
      o.firma_cliente_base64 || o.firma_tecnico_base64 || o.evidenciaBase64 || String(o.estado || '').toLowerCase() === 'finalizado'
    );

    if (ordenesConDocumento.length === 0) {
      docsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; padding: 1.5rem; border:1px dashed var(--border); border-radius:var(--radius-md);">
          <i data-lucide="file-text" style="width:32px; height:32px; color:var(--text-muted);"></i>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.5rem;">No tienes reportes PDF o cotizaciones firmadas listas para descargar.</p>
        </div>
      `;
    } else {
      let docsHtml = '';
      ordenesConDocumento.forEach(o => {
        const docDate = safeFormatDate(o.fecha, { day:'numeric', month:'short', year:'numeric' }, 'Reciente');
        const docFolio = o.folio || `Servicio #${o.id.slice(0,6)}`;
        const docTitle = `Reporte Técnico ${docFolio}`;
        const docSubtitle = `${o.tipo || 'Servicio'} – ${o.modelo || o.equipo || 'Equipo'}`;

        docsHtml += `
          <div class="doc-download-card">
            <div class="doc-icon">
              <i data-lucide="file-text"></i>
            </div>
            <div class="doc-info">
              <div class="doc-title">${docTitle}</div>
              <div class="doc-subtitle" style="font-size:0.75rem; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${docSubtitle}</div>
              <div class="doc-meta">${docDate}</div>
            </div>
            <button class="btn-doc-download" onclick="abrirReportePdfCliente(event, '${o.id}')" title="Descargar PDF">
              <i data-lucide="download" style="width:14px; height:14px;"></i>
            </button>
          </div>
        `;
      });
      docsContainer.innerHTML = docsHtml;
    }
  }

  lucide.createIcons();
}

// 5. Locations UI
function renderLocationsSection(misSitios, misEquipos) {
  const tbody = document.getElementById('locations-table-body');
  if (!tbody) return;

  if (misSitios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state" style="text-align: center;">No hay frentes de trabajo vinculados.</td></tr>`;
    return;
  }

  let html = '';
  misSitios.forEach(s => {
    const sName = s.nombre || s.direccion || '';
    
    // Filtrar equipos en este sitio específico
    const eqEnSitio = misEquipos.filter(m => {
      const ubi = String(m.ubicacion || m.customData?.ubicacion || '').toLowerCase().trim();
      return ubi === String(sName).toLowerCase().trim() || m.sitio_id === s.id;
    });

    const listEqs = eqEnSitio.length === 0 ? 
      '<span style="color:var(--text-muted); font-size:0.8rem;">Ningún equipo en sitio</span>' :
      eqEnSitio.map(m => `<span class="status-pill operando" style="margin-right:0.3rem; margin-bottom:0.3rem; font-size:0.7rem;">${m.modelo || 'Equipo'}</span>`).join('');

    html += `
      <tr>
        <td><strong>${s.nombre || 'Sin nombre'}</strong></td>
        <td><i data-lucide="map-pin" style="width:12px; height:12px; vertical-align:middle; color:var(--text-muted); margin-right:4px;"></i> ${s.direccion || 'Sin dirección registrada'}</td>
        <td><div style="display:flex; flex-wrap:wrap;">${listEqs}</div></td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  lucide.createIcons();
}

// Reportar falla rápido desde Dashboard
function abrirReportarFallaRapida() {
  navegarA('tickets');
}

// Reportar falla rápido en móvil (botón central del nav bar)
function abrirReportarFallaRapidaMobile(e) {
  e.preventDefault();
  navegarA('tickets');
}

// Reportar falla rápido vinculando máquina
function reportarFallaDeMaquina(id, modelo, serie, ubicacion) {
  navegarA('tickets');
  
  // Rellenar combos del formulario
  const comboEquipos = document.getElementById('t-equipo');
  const comboSitios = document.getElementById('t-sitio');
  
  if (comboEquipos) {
    // Buscar la opción correspondiente
    for (let i = 0; i < comboEquipos.options.length; i++) {
      const optVal = comboEquipos.options[i].value;
      if (optVal.includes(serie) || optVal.includes(id)) {
        comboEquipos.value = optVal;
        onTicketEquipoChange(optVal);
        break;
      }
    }
  }

  if (comboSitios && ubicacion) {
    // Seleccionar sitio
    for (let i = 0; i < comboSitios.options.length; i++) {
      if (comboSitios.options[i].value === ubicacion) {
        comboSitios.value = ubicacion;
        break;
      }
    }
  }
}

// Modales interactivos
function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Detalle del Ticket en Modal
function abrirDetalleTicketCliente(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;

  const title = document.getElementById('modal-ticket-title');
  const body = document.getElementById('modal-ticket-body');
  
  if (title) title.textContent = `Ticket: ${t.folio || 'Detalle'}`;
  
  const est = String(t.estado || 'Abierto').toLowerCase().trim();
  const fechaFormat = safeFormatDate(t.fechaCreacion, { day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }, 'N/A');
  
  // Calcular clases y textos detallados de la línea de tiempo de rastreo premium
  const steps = [
    {
      title: 'Reportado',
      desc: 'Tu solicitud de servicio fue recibida por nuestro sistema.',
      time: safeFormatDate(t.fechaCreacion, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }, ''),
      status: 'completed'
    },
    {
      title: 'Asignado',
      desc: t.asignado && t.asignado !== 'Asignando...' ? `Ingeniero asignado: ${t.asignado}` : 'Asignando el técnico idóneo para tu equipo...',
      time: '',
      status: t.asignado && t.asignado !== 'Asignando...' ? 'completed' : 'active'
    },
    {
      title: 'En Camino',
      desc: 'El ingeniero se dirige hacia el sitio de trabajo con el equipamiento necesario.',
      time: '',
      status: 'pending'
    },
    {
      title: 'En Sitio / Reparación',
      desc: 'Técnico trabajando en la reparación/mantenimiento en tu frente de trabajo.',
      time: '',
      status: 'pending'
    },
    {
      title: 'Terminado',
      desc: 'El servicio ha concluido y el reporte técnico ha sido firmado y archivado.',
      time: '',
      status: 'pending'
    }
  ];

  const estLower = est.toLowerCase();
  const ordenAsociada = ordenes.find(o => 
    o.ticket_id === t.id || 
    (t.folio && o.folio && o.folio.includes(t.folio)) ||
    (t.folio && o.descripcion && o.descripcion.includes(t.folio))
  );

  if (ordenAsociada) {
    const oEst = String(ordenAsociada.estado || '').toLowerCase().trim();
    steps[1].status = 'completed';
    steps[1].time = safeFormatDate(ordenAsociada.fecha, { day:'numeric', month:'short' }, '');
    
    if (oEst === 'en camino' || oEst === 'camino') {
      steps[2].status = 'active';
    } else if (oEst === 'en proceso' || oEst === 'proceso') {
      steps[2].status = 'completed';
      steps[3].status = 'active';
    } else if (oEst === 'finalizado' || oEst === 'firmado' || estLower === 'cerrado' || estLower === 'finalizado') {
      steps[2].status = 'completed';
      steps[3].status = 'completed';
      steps[4].status = 'completed';
    } else {
      steps[2].status = 'active';
    }
  } else {
    if (estLower === 'cerrado' || estLower === 'finalizado') {
      steps[1].status = 'completed';
      steps[2].status = 'completed';
      steps[3].status = 'completed';
      steps[4].status = 'completed';
    } else if (estLower === 'en proceso' || estLower === 'cotizacion' || estLower === 'refacciones') {
      steps[1].status = 'completed';
      steps[2].status = 'active';
    }
  }

  // Asegurar herencia de estados anteriores en la cadena
  let activeFound = false;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status === 'completed' || steps[i].status === 'active') {
      activeFound = true;
    }
    if (activeFound && steps[i].status === 'pending') {
      steps[i].status = 'completed';
    }
  }

  const trackerHtml = `
    <div class="service-tracker">
      ${steps.map(s => `
        <div class="tracker-step ${s.status}">
          <div class="tracker-icon-container">
            <div class="tracker-icon"></div>
          </div>
          <div class="tracker-info">
            <div class="tracker-title">
              ${s.title}
              ${s.time ? `<span class="tracker-time">${s.time}</span>` : ''}
            </div>
            <div class="tracker-desc">${s.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  let cotizacionHtml = '';
  // Si tiene cotización y el estado es Cotización/Cerrado, mostrar detalles
  if (t.cotizacionSAP) {
    cotizacionHtml = `
      <div style="background:var(--accent-light); border:1px solid var(--accent); border-radius:var(--radius-md); padding:1rem; margin-top:1.5rem;">
        <h4 style="color:var(--accent); font-weight:700; font-size:0.95rem; margin-bottom:0.5rem;"><i data-lucide="file-text" style="width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Cotización SAP Asociada</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem; margin-bottom:0.75rem;">
          <span>No. Cotización: <strong>${t.cotizacionSAP}</strong></span>
          <span>Monto: <strong>$${Number(t.montoCotizacion || 0).toLocaleString('es-MX')} MXN</strong></span>
          <span>Aceptada: <strong>${t.cotAceptada === 'si' ? 'Sí' : (t.cotAceptada === 'no' ? 'No' : 'Pendiente de Aceptación')}</strong></span>
          ${t.pedidoSAP ? `<span>Pedido SAP: <strong>${t.pedidoSAP}</strong></span>` : ''}
        </div>
        
        <div style="display:flex; gap:0.5rem;">
          ${t.pdfCotizacion ? `<button class="btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="descargarTicketPdf('${t.id}', 'cotizacion')"><i data-lucide="download"></i> Descargar Cotización</button>` : ''}
          ${t.pdfPedido ? `<button class="btn-secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="descargarTicketPdf('${t.id}', 'pedido')"><i data-lucide="download"></i> Descargar Pedido</button>` : ''}
        </div>
      </div>
    `;
  }

  // Foto evidencia si existe
  let photoHtml = '';
  if (t.pdfCotizacion && !t.cotizacionSAP) {
    const isPlaceholder = t.pdfCotizacion === '__HAS_PDF__';
    photoHtml = `
      <div style="margin-top:1.5rem;">
        <h4 style="font-size:0.9rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.5rem;">Evidencia Fotográfica</h4>
        <div id="t-evidence-img-container-${t.id}" style="width:100%; max-height:220px; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; background:#000;">
          <img id="t-evidence-img-${t.id}" src="${isPlaceholder ? '' : t.pdfCotizacion}" alt="Evidencia" style="width:100%; height:100%; object-fit:contain; display:${isPlaceholder ? 'none' : 'block'};" />
          ${isPlaceholder ? `<span id="t-evidence-loading-${t.id}" style="font-size:0.8rem; color:var(--text-secondary);"><i data-lucide="loader" class="rotating" style="width:14px; height:14px; vertical-align:middle; margin-right:4px; display:inline-block;"></i> Cargando imagen...</span>` : ''}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    ${trackerHtml}
    
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; font-size:0.9rem; border-top:1px solid var(--border); padding-top:1.5rem;">
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Asunto</span>
        <strong>${t.asunto || 'Sin Asunto'}</strong>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Estado</span>
        <span class="status-pill ${est}">${t.estado || 'Abierto'}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Equipo</span>
        <span>${t.equipo || 'Genérico'}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Horómetro</span>
        <span>${t.horometro ? `${t.horometro} h` : 'N/A'}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Prioridad</span>
        <span>${t.prioridad || 'Media'}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Fecha de Reporte</span>
        <span>${fechaFormat}</span>
      </div>
      <div style="grid-column: 1/-1;">
        <span style="color:var(--text-muted); font-size:0.75rem; display:block;">Ingeniero Asignado</span>
        <strong><i data-lucide="user" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${t.asignado || 'Asignando...'}</strong>
      </div>
    </div>
    
    <div style="border-top:1px solid var(--border); padding-top:1rem;">
      <h4 style="font-size:0.9rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.5rem;">Descripción del Reporte</h4>
      <p style="font-size:0.9rem; line-height:1.5; color:var(--text-primary); white-space:pre-wrap; background:var(--bg-primary); padding:1rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${t.descripcion || 'Sin descripción detallada.'}</p>
    </div>

    ${photoHtml}
    ${cotizacionHtml}
  `;

  abrirModal('modal-ticket');
  lucide.createIcons();

  if (t.pdfCotizacion === '__HAS_PDF__') {
    // Descargar evidencia fotográfica bajo demanda
    setTimeout(async () => {
      try {
        const { data, error } = await window.supabaseClient
          .from('tickets')
          .select('pdf_cotizacion')
          .eq('id', t.id)
          .single();
        
        if (error) throw error;
        
        const base64 = data ? data.pdf_cotizacion : null;
        if (base64) {
          t.pdfCotizacion = base64; // Guardar localmente
          const img = document.getElementById(`t-evidence-img-${t.id}`);
          const loaderEl = document.getElementById(`t-evidence-loading-${t.id}`);
          if (img) {
            img.src = base64;
            img.style.display = 'block';
          }
          if (loaderEl) {
            loaderEl.style.display = 'none';
          }
        }
      } catch (err) {
        console.error('Error cargando evidencia fotográfica:', err);
        const loaderEl = document.getElementById(`t-evidence-loading-${t.id}`);
        if (loaderEl) {
          loaderEl.innerHTML = '<span style="color:var(--red);">Error al cargar imagen</span>';
        }
      }
    }, 50);
  }
}

// Descargar PDFs de cotización o pedidos desde tickets
async function descargarTicketPdf(ticketId, tipo) {
  if (window.descargarPdfOnDemand) {
    try {
      await window.descargarPdfOnDemand(ticketId, tipo);
    } catch(e) {
      showToast('Error al descargar el PDF.', 'error');
    }
  } else {
    showToast('Módulo de descarga no disponible.', 'error');
  }
}

// Función para unificar y formatear la bitácora diaria (avances) del cliente
function renderBitacoraCliente(o) {
  let html = '';
  const items = [...(o.bitacora || [])];

  // Unificación inteligente reactiva con eventos de calendario locales
  try {
    const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    localEventos.forEach(ev => {
      if (ev.ordenId === o.id) {
        // Extraer fecha ISO simple (YYYY-MM-DD)
        const fISO = (ev.fechaInicio || ev.start || '').substring(0, 10);
        if (!fISO) return;

        // Extraer horas de entrada y salida
        let ent = '';
        let sal = '';
        try {
          if (ev.fechaInicio || ev.start) {
            const dI = new Date(ev.fechaInicio || ev.start);
            ent = `${String(dI.getUTCHours()).padStart(2, '0')}:${String(dI.getUTCMinutes()).padStart(2, '0')}`;
          }
          if (ev.fechaFin || ev.end) {
            const dF = new Date(ev.fechaFin || ev.end);
            sal = `${String(dF.getUTCHours()).padStart(2, '0')}:${String(dF.getUTCMinutes()).padStart(2, '0')}`;
          }
        } catch(e){}

        // Verificar si ya existe en la bitácora
        const existe = items.some(b => b.id === ev.id || (b.fecha === fISO && b.tecnico === ev.tecnicoNombre && b.entrada === ent));
        
        if (!existe) {
          items.push({
            id: ev.id,
            fecha: fISO,
            tecnico: ev.tecnicoNombre || 'Sin Asignar',
            nota: ev.descripcion || "Programado por supervisor. Pendiente de llenado por el técnico.",
            entrada: ent,
            salida: sal,
            realizado: false
          });
        }
      }
    });
  } catch(e){}

  // Separar pendientes de realizados
  const pendientes = items.filter(b => b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true));
  const realizados = items.filter(b => b.realizado === true || (!pendientes.some(p => p.id === b.id)));

  // 1. Renderizar Visitas Programadas (Pendientes)
  if (pendientes.length > 0) {
    html += `
      <div style="margin-bottom:1.25rem; background:rgba(139, 92, 246, 0.03); border: 1px solid rgba(139, 92, 246, 0.15); border-radius:var(--radius-md); padding:1rem;">
        <h4 style="font-size:0.8rem; font-weight:700; color:#8b5cf6; text-transform:uppercase; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; border-bottom:1px solid rgba(139, 92, 246, 0.15); padding-bottom:0.4rem; margin-top:0;">
          <i data-lucide="calendar" style="width:14px; height:14px;"></i> Visitas Programadas (Pendientes)
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
    `;
    
    pendientes.forEach(b => {
      let horasHtml = '';
      if (b.entrada && b.salida) {
        horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(139, 92, 246, 0.1); color:#8b5cf6; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.68rem; font-weight:600;"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${b.entrada} - ${b.salida}</span>`;
      }
      
      const fechaFormateada = safeFormatDate(b.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, b.fecha);
      const capitalizeFecha = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

      html += `
        <div style="background:var(--bg-primary); border: 1px solid var(--border); border-left: 4px solid #8b5cf6; border-radius:var(--radius-sm); padding:0.75rem 0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <div style="width:22px; height:22px; border-radius:50%; background:#8b5cf6; color:white; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:bold;">
                ${(b.tecnico || 'T').charAt(0).toUpperCase()}
              </div>
              <div>
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Sin asignar'}</span>
                <div style="font-size:0.7rem; color:var(--text-muted);">${capitalizeFecha}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="background:rgba(139, 92, 246, 0.1); color:#8b5cf6; border-radius:99px; padding:0.15rem 0.45rem; font-size:0.6rem; font-weight:700;">PROGRAMADO</span>
              ${horasHtml}
            </div>
          </div>
          <div style="font-size:0.78rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:1.8rem; line-height:1.4; font-style:italic;">${b.nota}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }

  // 2. Renderizar Historial de Trabajo (Realizados)
  html += `
    <h4 style="font-size:0.82rem; font-weight:700; color:#10b981; text-transform:uppercase; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; border-bottom:1px solid var(--border); padding-bottom:0.4rem; margin-top: 1rem;">
      <i data-lucide="clipboard-check" style="width:14px; height:14px;"></i> Bitácora de Trabajos Diarios
    </h4>
  `;

  if (realizados.length === 0) {
    html += '<p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1rem; text-align:center; padding:1.25rem; background:var(--bg-primary); border-radius:var(--radius-sm); border:1px dashed var(--border);">Aún no hay reportes de trabajo diarios registrados.</p>';
  } else {
    // Agrupar por día
    const agrupado = {};
    realizados.forEach(b => {
      let fechaDia = b.fecha;
      let fechaDObj = null;
      try {
        fechaDObj = new Date(b.fecha);
        if (!isNaN(fechaDObj)) {
          fechaDia = safeFormatDate(b.fecha, { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
      } catch(e){}
      if (!agrupado[fechaDia]) agrupado[fechaDia] = { objDate: fechaDObj, entries: [] };
      agrupado[fechaDia].entries.push(b);
    });

    // Ordenar días del más reciente al más antiguo
    const diasSorted = Object.keys(agrupado).sort((a, b) => b.localeCompare(a));

    html += '<div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:1.25rem;">';
    
    diasSorted.forEach(diaKey => {
      const diaData = agrupado[diaKey];
      const displayDia = safeFormatDate(diaKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, diaKey);
      const capitalizeDia = displayDia.charAt(0).toUpperCase() + displayDia.slice(1);

      // Ordenar entradas dentro del día (por hora de entrada si existe)
      diaData.entries.sort((a,b) => (a.entrada || '').localeCompare(b.entrada || ''));

      let entriesHtml = diaData.entries.map(b => {
        let horasHtml = '';
        let desvHtml = '';

        if (b.desviacion) {
          if (b.desviacion === 'Alineado') {
            desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.2rem; background:rgba(16, 185, 129, 0.08); color:#10b981; padding:0.12rem 0.4rem; border-radius:12px; font-size:0.62rem; font-weight:600; border:1px solid rgba(16, 185, 129, 0.2); margin-left:0.35rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="check-circle" style="width:10px;height:10px;"></i> Alineado</span>`;
          } else if (b.desviacion.startsWith('+')) {
            desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.2rem; background:rgba(59, 130, 246, 0.08); color:#3b82f6; padding:0.12rem 0.4rem; border-radius:12px; font-size:0.62rem; font-weight:600; border:1px solid rgba(59, 130, 246, 0.2); margin-left:0.35rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-up" style="width:10px;height:10px;"></i> Desviación: ${b.desviacion}</span>`;
          } else {
            desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.2rem; background:rgba(239, 68, 68, 0.08); color:#ef4444; padding:0.12rem 0.4rem; border-radius:12px; font-size:0.62rem; font-weight:600; border:1px solid rgba(239, 68, 68, 0.2); margin-left:0.35rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-down" style="width:10px;height:10px;"></i> Desviación: ${b.desviacion}</span>`;
          }
        }

        if (b.entrada && b.salida) {
          const [hE, mE] = b.entrada.split(':').map(Number);
          const [hS, mS] = b.salida.split(':').map(Number);
          let diff = (hS * 60 + mS) - (hE * 60 + mE);
          if (diff < 0) diff += 24 * 60;
          const hrs = Math.floor(diff / 60);
          const mns = diff % 60;
          const durStr = `${hrs}h ${mns > 0 ? mns + 'm' : ''}`.trim();
          horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(16, 185, 129, 0.1); color:#10b981; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.68rem; font-weight:600;"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${b.entrada} - ${b.salida} (${durStr})</span>${desvHtml}`;
        } else if (b.entrada || b.salida) {
          horasHtml = `<span style="font-size:0.68rem; color:var(--text-muted);"><i data-lucide="clock" style="width:11px;height:11px;vertical-align:middle;"></i> ${b.entrada || '--:--'} a ${b.salida || '--:--'}</span>${desvHtml}`;
        }

        return `
          <div style="background:var(--bg-primary); border-left: 3px solid #10b981; border-radius:var(--radius-xs); padding:0.65rem 0.85rem; margin-top:0.5rem; border: 1px solid var(--border); border-left-width: 3px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <div style="width:20px; height:20px; border-radius:50%; background:#10b981; color:white; display:flex; align-items:center; justify-content:center; font-size:0.62rem; font-weight:bold;">
                  ${(b.tecnico || 'U').charAt(0).toUpperCase()}
                </div>
                <span style="font-size:0.78rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Técnico'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="background:rgba(16, 185, 129, 0.1); color:#10b981; border-radius:99px; padding:0.12rem 0.4rem; font-size:0.6rem; font-weight:700;">REPORTADO</span>
                ${horasHtml}
              </div>
            </div>
            <div style="font-size:0.78rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:1.6rem; line-height:1.4;">${b.nota || 'Sin comentarios registrados.'}</div>
          </div>
        `;
      }).join('');

      html += `
        <div style="background:var(--bg-hover); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem; margin-bottom: 0.5rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:0.35rem; border-bottom:1px dashed var(--border); padding-bottom:0.45rem; margin-bottom:0.25rem;">
            <i data-lucide="calendar-days" style="width:14px; height:14px; color:var(--accent);"></i> ${capitalizeDia}
          </div>
          ${entriesHtml}
        </div>
      `;
    });

    html += '</div>';
  }

  return html;
}

// Detalle de la Orden de Servicio en Modal
function abrirDetalleOrdenCliente(id) {
  const o = ordenes.find(x => x.id === id);
  if (!o) return;

  const title = document.getElementById('modal-order-title');
  const body = document.getElementById('modal-order-body');
  const btnDownload = document.getElementById('btn-download-pdf');
  
  if (title) title.textContent = `Orden de Servicio: ${o.folio || 'Detalle'}`;
  
  const est = String(o.estado || 'Pendiente').toLowerCase().trim();
  const fechaFormat = safeFormatDate(o.fecha, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }, 'N/A');
  const fechaFinFormat = safeFormatDate(o.fechaFin, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }, 'En Proceso');

  // Sincronizar el botón de descargar PDF si la orden contiene evidencias/firmas
  const tieneReporte = !!(o.firma_cliente_base64 || o.evidenciaBase64 || o.firma_tecnico_base64);
  if (btnDownload) {
    if (tieneReporte) {
      btnDownload.style.display = 'inline-flex';
      btnDownload.onclick = (e) => abrirReportePdfCliente(e, o.id);
    } else {
      btnDownload.style.display = 'none';
    }
  }

  // Actividades completadas (si existen)
  let actividadesHtml = '<span style="color:var(--text-muted); font-size:0.85rem;">En proceso de llenado por el técnico.</span>';
  const tieneReporteTecnico = !!(o.falla || o.trabajos || o.dictamen || o.condiciones || o.observaciones || o.pendientes || o.horometro);
  if (tieneReporteTecnico) {
    actividadesHtml = `
      <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; font-size:0.85rem; line-height:1.5; display:flex; flex-direction:column; gap:0.75rem;">
        ${o.horometro ? `<div><strong>Horómetro registrado:</strong> <strong>${Number(o.horometro).toLocaleString()} h</strong></div>` : ''}
        ${o.falla ? `<div><strong>Síntoma / Falla Reportada:</strong><br><span style="color:var(--text-secondary);">${o.falla.replace(/\n/g, '<br>')}</span></div>` : ''}
        ${o.trabajos ? `<div><strong>Trabajos Realizados:</strong><br><span style="color:var(--text-secondary);">${o.trabajos.replace(/\n/g, '<br>')}</span></div>` : ''}
        ${o.dictamen ? `<div><strong>Dictamen Técnico:</strong><br><span style="color:var(--text-secondary);">${o.dictamen.replace(/\n/g, '<br>')}</span></div>` : ''}
        ${o.condiciones ? `<div><strong>Condiciones del Equipo:</strong><br><span style="color:var(--text-secondary);">${o.condiciones.replace(/\n/g, '<br>')}</span></div>` : ''}
        ${o.observaciones ? `<div><strong>Observaciones adicionales:</strong><br><span style="color:var(--text-secondary);">${o.observaciones.replace(/\n/g, '<br>')}</span></div>` : ''}
        ${o.pendientes ? `<div><strong>Trabajos Pendientes / Recomendaciones:</strong><br><span style="color:var(--text-secondary);">${o.pendientes.replace(/\n/g, '<br>')}</span></div>` : ''}
      </div>
    `;
  }

  // Bitácora Diaria / Avances
  const bitacoraHtml = renderBitacoraCliente(o);

  // Registro de Jornadas semanales (dias)
  let diasHtml = '';
  if (o.dias) {
    const DIAS_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const DIAS_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const activeDays = DIAS_KEYS.filter(dia => o.dias[dia] && o.dias[dia].fecha);
    
    if (activeDays.length > 0) {
      diasHtml = `
        <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-top:1.25rem;">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.75rem;"><i data-lucide="clock" style="width:16px; height:16px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Jornadas de Trabajo</h4>
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left;">
              <thead>
                <tr style="background:var(--bg-hover); border-bottom:1px solid var(--border); color:var(--text-secondary);">
                  <th style="padding:0.4rem 0.6rem;">Día</th>
                  <th style="padding:0.4rem 0.6rem;">Fecha</th>
                  <th style="padding:0.4rem 0.6rem;">Entrada</th>
                  <th style="padding:0.4rem 0.6rem;">Salida</th>
                  <th style="padding:0.4rem 0.6rem; text-align:right;">Normales</th>
                  <th style="padding:0.4rem 0.6rem; text-align:right;">Extras</th>
                </tr>
              </thead>
              <tbody>
                ${DIAS_KEYS.map((dia, idx) => {
                  const d = o.dias[dia];
                  if (!d || !d.fecha) return '';
                  return `
                    <tr style="border-bottom:1px dashed var(--border);">
                      <td style="padding:0.4rem 0.6rem; font-weight:600;">${DIAS_LABELS[idx]}</td>
                      <td style="padding:0.4rem 0.6rem;">${d.fecha}</td>
                      <td style="padding:0.4rem 0.6rem;">${d.entrada || '—'}</td>
                      <td style="padding:0.4rem 0.6rem;">${d.salida || '—'}</td>
                      <td style="padding:0.4rem 0.6rem; text-align:right;">${d.normales || 0} h</td>
                      <td style="padding:0.4rem 0.6rem; text-align:right;">${d.extras || 0} h</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // Refacciones Necesarias / Utilizadas
  let refaccionesHtml = '';
  const tieneUtilizadas = o.ref_utilizadas && o.ref_utilizadas.length > 0;
  const tieneNecesarias = o.ref_necesarias && o.ref_necesarias.length > 0;
  if (tieneUtilizadas || tieneNecesarias) {
    refaccionesHtml = `
      <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-top:1.25rem;">
        <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.75rem;"><i data-lucide="package" style="width:16px; height:16px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Refacciones y Materiales</h4>
        <div style="display:grid; grid-template-columns: ${tieneUtilizadas && tieneNecesarias ? '1fr 1fr' : '1fr'}; gap:1rem;">
          ${tieneUtilizadas ? `
            <div>
              <div style="font-size:0.8rem; font-weight:600; color:var(--green); margin-bottom:0.35rem;">Utilizadas en Servicio</div>
              <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left;">
                  <thead>
                    <tr style="background:var(--bg-hover); border-bottom:1px solid var(--border); color:var(--text-secondary);">
                      <th style="padding:0.4rem 0.6rem;">Refacción</th>
                      <th style="padding:0.4rem 0.6rem;">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${o.ref_utilizadas.map(r => `
                      <tr style="border-bottom:1px dashed var(--border);">
                        <td style="padding:0.4rem 0.6rem;"><strong>${r.clave || ''}</strong><br><span style="color:var(--text-muted); font-size:0.7rem;">${r.descripcion || ''}</span></td>
                        <td style="padding:0.4rem 0.6rem; font-weight:600;">${r.cantidad || 1}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
          
          ${tieneNecesarias ? `
            <div>
              <div style="font-size:0.8rem; font-weight:600; color:var(--orange); margin-bottom:0.35rem;">Recomendadas / Necesarias</div>
              <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left;">
                  <thead>
                    <tr style="background:var(--bg-hover); border-bottom:1px solid var(--border); color:var(--text-secondary);">
                      <th style="padding:0.4rem 0.6rem;">Refacción</th>
                      <th style="padding:0.4rem 0.6rem;">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${o.ref_necesarias.map(r => `
                      <tr style="border-bottom:1px dashed var(--border);">
                        <td style="padding:0.4rem 0.6rem;"><strong>${r.clave || ''}</strong><br><span style="color:var(--text-muted); font-size:0.7rem;">${r.descripcion || ''}</span></td>
                        <td style="padding:0.4rem 0.6rem; font-weight:600;">${r.cantidad || 1}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Evidencias Fotográficas
  let fotosHtml = '';
  const ev = o.evidencias || {};
  const tieneFotos = !!(ev.fotoInicio || ev.fotoFin || (ev.adicionales && ev.adicionales.length > 0));
  if (tieneFotos) {
    const todasLasFotos = [];
    if (ev.fotoInicio) todasLasFotos.push({ label: 'Entrada / Inicio', url: ev.fotoInicio });
    if (ev.fotoFin) todasLasFotos.push({ label: 'Salida / Fin', url: ev.fotoFin });
    if (ev.adicionales) {
      ev.adicionales.forEach((f, idx) => {
        if (f) todasLasFotos.push({ label: `Adicional ${idx + 1}`, url: f });
      });
    }

    fotosHtml = `
      <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-top:1.25rem;">
        <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.75rem;"><i data-lucide="image" style="width:16px; height:16px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Evidencia Fotográfica</h4>
        <div style="display:flex; gap:0.75rem; overflow-x:auto; padding-bottom:0.5rem; scrollbar-width:thin;">
          ${todasLasFotos.map(f => `
            <div style="flex: 0 0 140px; background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.25rem; text-align:center;">
              <div style="width:100%; height:90px; border-radius:var(--radius-xs); overflow:hidden; background:black; position:relative; cursor:pointer;" onclick="window.open('${f.url}', '_blank')">
                <img src="${f.url}" alt="${f.label}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'"/>
              </div>
              <span style="font-size:0.7rem; font-weight:600; color:var(--text-secondary); display:block; margin-top:0.35rem;">${f.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Firmas de Conformidad
  let firmasHtml = '';
  const tieneTecnicoFirma = !!o.firma_tecnico_base64;
  const tieneClienteFirma = !!o.firma_cliente_base64;
  if (tieneTecnicoFirma || tieneClienteFirma) {
    firmasHtml = `
      <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-top:1.25rem;">
        <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.75rem;"><i data-lucide="pen-tool" style="width:16px; height:16px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Firmas de Conformidad</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
          ${tieneTecnicoFirma ? `
            <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.75rem; text-align:center;">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.5rem;">Firma Técnico</span>
              <div style="background:white; border-radius:var(--radius-sm); padding:0.5rem; display:inline-block; width:100%; max-width:180px;">
                <img src="${o.firma_tecnico_base64}" alt="Firma Técnico" style="max-height:80px; max-width:100%; object-fit:contain; filter:contrast(1.2);"/>
              </div>
              <strong style="font-size:0.8rem; color:var(--text-primary); display:block; margin-top:0.5rem;">${o.firma_tecnico_nombre || o.tecnico || 'Ingeniero'}</strong>
              ${o.firma_tecnico_fecha ? `<span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.15rem;">${safeFormatDate(o.firma_tecnico_fecha, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>` : ''}
            </div>
          ` : ''}
          
          ${tieneClienteFirma ? `
            <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.75rem; text-align:center;">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.5rem;">Firma Cliente</span>
              <div style="background:white; border-radius:var(--radius-sm); padding:0.5rem; display:inline-block; width:100%; max-width:180px;">
                <img src="${o.firma_cliente_base64}" alt="Firma Cliente" style="max-height:80px; max-width:100%; object-fit:contain; filter:contrast(1.2);"/>
              </div>
              <strong style="font-size:0.8rem; color:var(--text-primary); display:block; margin-top:0.5rem;">${o.firma_cliente_nombre || 'Representante'}</strong>
              ${o.firma_cliente_fecha ? `<span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.15rem;">${safeFormatDate(o.firma_cliente_fecha, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Mapear marca formateada
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  let mBrand = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
  const marcaText = MARCAS_RENDER[mBrand.toUpperCase()] || mBrand || '—';

  // Buscar ID de maquinaria
  const maq = (maquinariaDb || []).find(m => (o.maquinaria_id && m.id === o.maquinaria_id) || (o.serie && m.serie === o.serie) || (o.modelo && m.modelo === o.modelo && m.cliente === o.cliente));
  const idMaquinaText = maq && (maq.idInterno || maq.id) ? maq.idInterno || maq.id : '—';

  // Buscar Ticket de Soporte de origen
  const tktSoporte = (tickets || []).find(x => x.id === o.soporte);
  const ticketSoporteText = tktSoporte ? (tktSoporte.folio || tktSoporte.id.slice(0,8)) : o.soporte || '—';

  // Layout de los bloques de información general
  const infoGeneralHtml = `
    <div style="margin-bottom:1.5rem; border-top:1px solid var(--border); padding-top:1.25rem;">
      <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.75rem;"><i data-lucide="info" style="width:14px; height:14px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Información General</h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; font-size:0.85rem; line-height:1.4;">
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Folio de Orden</span>
          <strong>${o.folio || '—'}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">No. Pedido / PO</span>
          <strong>${o.pedido || '—'}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Fecha de Registro</span>
          <span>${safeFormatDate(o.fecha, { day:'numeric', month:'short', year:'numeric' }, '—')}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Ubicación (Ticket)</span>
          <span>${o.ubicacion || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Ubicación en Sitio</span>
          <span>${o.ubicacion_sitio || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Operador</span>
          <span>${o.operador || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">No. ECO</span>
          <span>${o.eco || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Horómetro Real</span>
          <span>${o.horometro_real ? Number(o.horometro_real).toLocaleString() + ' h' : '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Marca</span>
          <span>${marcaText}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Modelo</span>
          <span>${o.modelo || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Número de Serie</span>
          <span style="font-family:monospace; font-size:0.8rem;">${o.serie || '—'}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">ID Máquina</span>
          <span style="font-family:monospace; font-size:0.8rem; font-weight:600; color:var(--accent);">${idMaquinaText}</span>
        </div>
        <div>
          <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Ticket Soporte</span>
          <strong>${ticketSoporteText}</strong>
        </div>
      </div>
    </div>
  `;

  // Layout de kilómetros / traslado (si existen)
  let viajeHtml = '';
  if (o.km_ida || o.km_vuelta || o.km_total) {
    viajeHtml = `
      <div style="border-top:1px dashed var(--border); padding-top:1.25rem; margin-top:1.25rem; margin-bottom:1.5rem;">
        <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.75rem;"><i data-lucide="map" style="width:14px; height:14px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Kilómetros y Traslado</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; font-size:0.85rem; line-height:1.4;">
          <div>
            <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Origen → Frente de Trabajo</span>
            <span>${o.km_ida ? o.km_ida + ' km' : '—'}</span>
          </div>
          <div>
            <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Frente de Trabajo → Origen</span>
            <span>${o.km_vuelta ? o.km_vuelta + ' km' : '—'}</span>
          </div>
          <div>
            <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Distancia Total</span>
            <strong>${o.km_total ? o.km_total + ' km' : '—'}</strong>
          </div>
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <!-- Cabecera rápida de labores -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem; margin-bottom:1.5rem; background:var(--bg-hover); border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; font-size:0.85rem; line-height:1.4;">
      <div>
        <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Estado del Servicio</span>
        <span class="status-pill ${est}">${o.estado || 'Pendiente'}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Tipo de Servicio</span>
        <strong>${o.tipo || 'Servicio Técnico'}</strong>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Ingeniero Asignado</span>
        <strong><i data-lucide="user" style="width:13px; height:13px; vertical-align:middle; margin-right:2px; color:var(--accent);"></i> ${o.tecnico || 'Por asignar'}</strong>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Inicio de Labores</span>
        <span>${fechaFormat}</span>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.72rem; display:block;">Fin de Labores</span>
        <span>${fechaFinFormat}</span>
      </div>
    </div>
    
    <!-- Información General -->
    ${infoGeneralHtml}

    <!-- Traslado / Viáticos -->
    ${viajeHtml}
    
    <!-- Reporte Técnico y Actividades -->
    <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-top:1.25rem;">
      <h4 style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.75rem;"><i data-lucide="clipboard-list" style="width:16px; height:16px; vertical-align:middle; margin-right:4px; color:var(--accent);"></i> Reporte Técnico y Actividades</h4>
      ${actividadesHtml}
    </div>

    ${bitacoraHtml}
    ${diasHtml}
    ${refaccionesHtml}
    ${fotosHtml}
    ${firmasHtml}
  `;

  abrirModal('modal-order');
  lucide.createIcons();
}

// Descargar/Imprimir Reporte PDF de la Orden
function abrirReportePdfCliente(e, orderId) {
  if (e) e.stopPropagation();
  
  // La impresión y visualización de PDF está implementada en app.js a través de window.imprimirReporteDirecto o window.descargarReportePdf.
  // Reutilizaremos esa lógica si está en memoria (se inyecta por el iframe o carga de scripts).
  // Si no está, podemos crear el visor.
  if (typeof window.imprimirReporteDirecto === 'function') {
    window.imprimirReporteDirecto(orderId);
  } else {
    // Si no está declarada de forma global en supabaseSync, mostramos el base64 directamente
    const o = ordenes.find(x => x.id === orderId);
    if (o) {
      const base64 = o.firma_cliente_base64 || o.evidenciaBase64 || o.firma_tecnico_base64;
      if (base64 && base64.startsWith('data:')) {
        const win = window.open();
        if (win) {
          win.document.write(`<iframe src="${base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        } else {
          showToast('Permite las ventanas emergentes para ver el reporte.', 'info');
        }
      } else {
        showToast('El archivo del reporte firmado se está generando en el servidor.', 'info');
      }
    }
  }
}

// Ayudante de logos de marca
function getLogoByBrand(brand) {
  if (!brand) return 'logo_transparent.png';
  const b = brand.toLowerCase();
  if (b.includes('cifa')) return 'logo_cifa.png';
  if (b.includes('casagrande') || b.includes('casa grande') || b.includes('cas')) return 'logo_casagrande.png';
  if (b.includes('fiori') || b.includes('fio')) return 'logo_fiori.png';
  if (b.includes('hyundai') || b.includes('hyu')) return 'logo_hyundai.png';
  if (b.includes('rubble') || b.includes('rublemaster') || b.includes('rubble master') || b.includes('rbm')) return 'logo_rublemaster.svg';
  if (b.includes('simem') || b.includes('sim')) return 'logo_simem.png';
  return 'logo_transparent.png';
}

// Tema Oscuro / Claro
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  const icon = document.getElementById('theme-icon');
  
  if (isLight) {
    localStorage.setItem('theme_mode', 'light');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  } else {
    localStorage.setItem('theme_mode', 'dark');
    if (icon) icon.setAttribute('data-lucide', 'sun');
  }
  lucide.createIcons();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle-2';
  if (type === 'error') icon = 'alert-octagon';
  
  toast.innerHTML = `
    <i data-lucide="${icon}" style="width:20px; height:20px; flex-shrink:0;"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Escuchar cambios de Supabase en segundo plano (Opcional, recarga reactiva)
window.addEventListener('supabase_datos_cargados', () => {
  console.log('[Sync Event] Datos sincronizados desde Supabase Auth. Re-renderizando portal...');
  cargarDatosLocales();
  doRender();
});

// Mostrar/Ocultar formularios de registro
function mostrarRegistroCliente(e) {
  if (e) e.preventDefault();
  document.getElementById('login-step-login').style.display = 'none';
  document.getElementById('login-step-register').style.display = 'block';
  document.getElementById('reg-error').textContent = '';
  lucide.createIcons();
}

function mostrarLoginCliente(e) {
  if (e) e.preventDefault();
  document.getElementById('login-step-register').style.display = 'none';
  document.getElementById('login-step-login').style.display = 'block';
  document.getElementById('login-error').textContent = '';
  lucide.createIcons();
}

// Envío del formulario de registro de cliente
async function registrarClienteSubmit(e) {
  e.preventDefault();
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const empresa = document.getElementById('reg-empresa').value.trim();
  const pass = document.getElementById('reg-password').value;
  const passConfirm = document.getElementById('reg-password-confirm').value;
  const errEl = document.getElementById('reg-error');

  errEl.textContent = '';

  if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; return; }
  if (!email) { errEl.textContent = 'El correo electrónico es obligatorio.'; return; }
  if (!empresa) { errEl.textContent = 'La empresa es obligatoria.'; return; }
  if (pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  if (pass !== passConfirm) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }

  if (!window.supabaseClient) {
    errEl.textContent = 'Error: no hay conexión con Supabase.';
    return;
  }

  // Spinner en botón
  const btn = e.target.querySelector('button[type="submit"]');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:18px; height:18px; border-width:2px; margin:0 auto;"></div> Registrando...';
  btn.disabled = true;

  try {
    // 1. Crear usuario en Supabase Auth
    const { data, error } = await window.supabaseClient.auth.signUp({
      email: email,
      password: pass,
      options: {
        data: {
          nombre: nombre,
          empresa: empresa,
          rol: 'empresa'
        }
      }
    });

    if (error) throw error;

    if (data?.user) {
      // 2. Insertar/Actualizar rol en user_roles automáticamente como 'empresa' y con la empresa seleccionada
      // Usamos upsert para evitar el conflicto con el trigger automático handle_new_user de Supabase
      const { error: roleErr } = await window.supabaseClient.from('user_roles').upsert({
        id: data.user.id,
        nombre: nombre,
        email: email,
        rol: 'empresa',
        empresa: empresa,
        activo: false
      });

      if (roleErr) {
        console.warn('[SignUp Client] No se pudo guardar el registro en user_roles:', roleErr.message);
      }
    }

    // Regresar al login con mensaje de éxito
    mostrarLoginCliente();
    const loginErrorEl = document.getElementById('login-error');
    if (loginErrorEl) {
      loginErrorEl.textContent = 'Cuenta registrada. Tu acceso debe ser aprobado por un administrador.';
      loginErrorEl.style.color = 'var(--green)';
    }
    showToast('Cuenta creada con éxito. Pendiente de aprobación.', 'success');

  } catch (err) {
    console.error('[Registration Error]', err);
    errEl.textContent = err.message || 'Ocurrió un error al registrar la cuenta.';
    errEl.style.color = 'var(--red)';
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
}
