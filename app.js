let currentMaqSortCol = 'reciente';
let currentMaqSortDir = 'desc';
let currentCliSortCol = 'reciente';
let currentCliSortDir = 'desc';
let currentOrdSortCol = 'reciente';
let currentOrdSortDir = 'desc';
let currentDesgSortCol = 'fecha';
let currentDesgSortDir = 'asc';
let currentDesgloseData = [];

// ===== DATA =====
let ordenes = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
let tickets = JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
let clientesDb = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
let refaccionesDb = JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]');
let tecnicosDb = JSON.parse(localStorage.getItem('sapi_tecnicos_db') || '[]');
let sitiosDb = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
let maquinariaDb = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');

// Sincronización con Supabase (escuchar cuando los datos bajen a localStorage)
window.addEventListener('supabase_datos_cargados', () => {
  ordenes = window._supaOrdenes || JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
  tickets = window._supaTickets || JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
  clientesDb = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
  tecnicosDb = JSON.parse(localStorage.getItem('sapi_tecnicos_db') || '[]');
  sitiosDb = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
  maquinariaDb = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
  usuarios = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
  
  // Re-render UI
  actualizarFiltrosPersonal();
  renderTabla();
  renderTabla('servicios');
  renderClientes();
  renderUsuariosList();
  renderStats();
  renderTickets();
  renderTickets('dash-tickets');
  updateTicketBadge();
  if (typeof renderMaquinaria === 'function') renderMaquinaria();
  
  // Re-aplicar rol para asegurar que el role-switcher se muestre si el usuario recién se descargó
  if (currentSession && currentSession.viewMode) {
    applyRole(currentSession.viewMode);
  }
});
let editandoId = null;
let editandoTicketId = null;
let ticketFiltroActivo = 'todos';

// ==========================================
// UTILIDADES GLOBALES
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
  const container = document.getElementById('notificaciones-container') || (() => {
    const el = document.createElement('div');
    el.id = 'notificaciones-container';
    el.style = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
    document.body.appendChild(el);
    return el;
  })();
  
  const toast = document.createElement('div');
  const bgColor = tipo === 'success' ? '#10b981' : (tipo === 'error' ? '#ef4444' : '#3b82f6');
  toast.style = `background: ${bgColor}; color: white; padding: 12px 20px; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: system-ui, sans-serif; font-size: 14px; opacity: 0; transform: translateY(20px); transition: all 0.3s ease;`;
  toast.textContent = mensaje;
  
  container.appendChild(toast);
  
  // Animar entrada
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  // Remover después de 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// MÓDULO DE INTEGRACIÓN SAP (PRÓXIMAMENTE)
// ==========================================
const API_CONFIG = {
  USE_SAP_BACKEND: true,
  BASE_URL: 'https://eurorep-api.onrender.com/api',
  // URL del backend local expuesto via Cloudflare Tunnel (actualizar cuando se configure)
  // Ejemplo: 'https://eurorep-local.trycloudflare.com/api'
  LOCAL_URL: localStorage.getItem('eurorep_local_api_url') || null
};

async function fetchClientesSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return clientesDb; // Retorna los locales si no hay SAP
  
  try {
    let url = `${API_CONFIG.BASE_URL}/clientes`;
    if (configData && configData.queryClientes) {
      url += `?queryCode=${encodeURIComponent(configData.queryClientes)}`;
    }
    const response = await fetch(url);
    const sapData = await response.json();
    
    // Si el servidor responde con error, mostrar mensaje claro en lugar de crash
    if (!response.ok || !Array.isArray(sapData)) {
      const errMsg = sapData?.error || sapData?.message || `Error del servidor: ${response.status}`;
      throw new Error(errMsg);
    }
    
    // Configuración de mapeo
    const map = (configData.mappings && configData.mappings.clientes) ? configData.mappings.clientes : {
      id: 'CardCode', nombre: 'CardName', rfc: 'LicTradNum', email: 'E_Mail', grupoSinergia: 'U_OK_Grupo', saldoCuenta: 'Balance'
    };

    // Mapeo: Convertimos la estructura del Query de SAP a nuestra estructura del CRM
    const clientesMapeados = sapData.map(bp => {
      const clienteObj = {
        id: bp[map.id] || '', // El ID interno en SAP
        createdAt: new Date().toISOString(),
        nombre: bp[map.nombre] || 'Sin Nombre',
        rfc: bp[map.rfc] || 'Genérico',
        ubicacion: '', 
        contacto: '', 
        telefono: '',
        email: bp[map.email] || '', 
        grupoSinergia: bp[map.grupoSinergia] || 'N/A', 
        saldoCuenta: parseFloat(bp.Balance) || parseFloat(bp[map.saldoCuenta]) || 0,
        saldoOrdenes: parseFloat(bp.OrdersBal) || 0,
        maquinas: [], // Esto se llenaría con otro endpoint (CustomerEquipmentCards)
        supervisoresAsignados: [],
        tecnicosAsignados: []
      };

      // Mapear columnas personalizadas
      if (map.customCols && map.customCols.length > 0) {
        clienteObj.customData = {};
        map.customCols.forEach(col => {
          clienteObj.customData[col.label] = bp[col.key] || '';
        });
      }

      return clienteObj;
    });
    
    return clientesMapeados;
  } catch (error) {
    console.error('Error conectando al puente SAP:', error);
    mostrarNotificacion(`⚠️ SAP: ${error.message}`, 'warning');
    return null; // Do NOT fallback to local data, otherwise caller assumes success
  }
}

async function fetchRefaccionesSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return refaccionesDb;
  
  try {
    if (!configData || !configData.queryRefacciones) {
      return refaccionesDb;
    }

    // 1. Fetch brand catalog from @OK_MARCA UDO table
    // Fallback hardcoded from known SAP @OK_MARCA data
    const MARCAS_FALLBACK = {
      'ETP': 'ESSER TWIN PIPES', 'BCR': 'BCR', 'PTZ': 'PUTZMEISTER', 'SCH': 'SCHWING',
      'CIF': 'CIFA', 'MTM': 'MTM', 'MCN': 'MCNELIUS', 'LON': 'LONDON', 'CAS': 'CASAGRANDE',
      'OTM': 'OTRAS MARCAS', 'CNF': 'CONFORMS', 'TFB': 'TEUFELBERGER', 'RBC': 'REBEL CRUSHER',
      'RBM': 'RUBBLE MASTER', 'FIO': 'FIORI', 'EVE': 'EVERDIGM', 'POR': 'PORTAFILL',
      'SIM': 'SIMEM', 'TUR': 'TURBOSOL', 'MBC': 'MB CUCHARAS', 'DOR': 'DORNER',
      'KNK': 'KINGKONG', 'HYU': 'HYUNDAI EVERDIGM', 'HER': 'HERRAMIENTA',
      'EBS': 'EBOSS', 'RCR': 'RUBBLE CRUSHER'
    };
    let marcaMap = { ...MARCAS_FALLBACK };
    try {
      const marcaRes = await fetch(`${API_CONFIG.BASE_URL}/sap/udo/OK_MARCA`);
      const marcaJson = await marcaRes.json();
      const udoItems = marcaJson.data || [];
      if (udoItems.length > 0) {
        udoItems.forEach(m => {
          const code = (m.Code || m.code || '').trim().toUpperCase();
          const name = m.Name || m.name || '';
          if (code && name) marcaMap[code] = name;
        });
        console.log(`✅ UDO @OK_MARCA cargado: ${udoItems.length} marcas`);
      }
    } catch(e) {
      console.warn('UDO no disponible, usando mapa de marcas de respaldo:', e.message);
    }

    // 2. Fetch refacciones
    const url = `${API_CONFIG.BASE_URL}/sap/queries/${encodeURIComponent(configData.queryRefacciones)}/execute?_t=${Date.now()}`;
    const response = await fetch(url);
    const jsonRes = await response.json();
    const sapData = jsonRes.data || [];
    
    const map = (configData.mappings && configData.mappings.refacciones) ? configData.mappings.refacciones : {
      id: 'ItemCode', nombre: 'ItemName', grupo: 'ItmsGrpNam', precio: 'Price', stock: 'OnHand', origen: 'Origen'
    };

    const refaccionesMapeadas = sapData.map(item => {
      const idInternoVal = item[map.id] || item.ItemCode || '';
      
      // Resolve marca: normalize code then lookup full name from map
      const marcaCodigo = (item.U_MARCA || item.MarcaCode || '').trim().toUpperCase();
      const marcaNombre = item.Name || marcaMap[marcaCodigo] || (marcaCodigo || 'N/A');

      // Calculate origen from ItemCode suffix
      let origenCalculado = item[map.origen] || item.Origen || '';
      if (!origenCalculado && idInternoVal) {
        origenCalculado = idInternoVal.toUpperCase().endsWith('N') ? 'Nacional' : 'Importado';
      }
      origenCalculado = origenCalculado || 'N/A';

      const refObj = {
        id: idInternoVal,
        codigo: idInternoVal,
        idInterno: idInternoVal,
        nombre: item[map.nombre] || item.ItemName || 'Sin Nombre',
        descripcion: item[map.nombre] || item.ItemName || 'Sin Nombre',
        marca: marcaNombre,
        marcaCodigo: marcaCodigo,
        grupo: item[map.grupo] || item.ItmsGrpNam || item.Grupo || '',
        ItmsGrpCod: item.ItmsGrpCod || item.GrupoCode || null,
        precio: item[map.precio] || item.Price || 0,
        moneda: item[map.moneda] || 'MXN',
        stock: item[map.stock] || item.OnHand || 0,
        origen: origenCalculado
      };

      if (map.customCols && map.customCols.length > 0) {
        refObj.customData = {};
        map.customCols.forEach(col => {
          refObj.customData[col.label] = item[col.key] || '';
        });
      }

      return refObj;
    });
    
    return refaccionesMapeadas;
  } catch (error) {
    console.error('Error conectando al puente SAP para refacciones:', error);
    return refaccionesDb;
  }
}

// ==========================================


const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const MARCAS_OFICIALES = ['Fiori', 'Rubble Master', 'Hyundai', 'CIFA', 'SIMEM', 'Casa Grande'];

function getLogoMarca(marca) {
  if (!marca) return null;
  const m = marca.toLowerCase().trim();
  if (m.includes('fiori')) return 'logo_fiori.png?v=2';
  if (m.includes('rubble')) return 'logo_rublemaster.svg?v=2';
  if (m.includes('hyundai')) return 'logo_hyundai.png?v=2';
  if (m.includes('cifa')) return 'logo_cifa.png?v=1';
  if (m.includes('simem')) return 'logo_simem.png?v=1';
  if (m.includes('casa grande') || m.includes('casagrande')) return 'logo_casagrande.png?v=1';
  return null;
}

// Overrides de tamaño por marca (para logos con distinto aspect ratio)
function getLogoStyle(marca) {
  if (!marca) return 'width:85px; height:32px; object-fit:contain; object-position:left center; margin-right:8px;';
  const m = marca.toLowerCase().trim();
  if (m.includes('casa grande') || m.includes('casagrande')) {
    return 'width:160px; height:50px; object-fit:contain; object-position:left center; margin-right:8px;';
  }
  return 'width:85px; height:32px; object-fit:contain; object-position:left center; margin-right:8px;';
}

// ===== INIT =====
// ===== ROLES SYSTEM =====
let ROLES = {
  superadmin: {
    label: 'Super Administrador',
    color: '#E8820C',
    views: ['dashboard','servicios','calendario','tickets','clientes','maquinaria','refacciones','tecnicos','sitios','config','preferencias'],
    canSwitchRoles: true,
  },
  admin: {
    label: 'Administrador',
    color: '#4f8ef7',
    views: ['dashboard','servicios','calendario','tickets','clientes','maquinaria','refacciones','tecnicos','sitios','config','preferencias'],
  },
  supervisor: {
    label: 'Supervisor',
    color: '#eab308',
    views: ['dashboard','servicios','calendario','tickets','clientes','maquinaria','refacciones','tecnicos','preferencias'],
  },
  tecnico: {
    label: 'Técnico / Instalador',
    color: '#10b981',
    views: ['dashboard','servicios','calendario','tickets','preferencias'],
  },
  empresa: {
    label: 'Empresa / Cliente',
    color: '#8b5cf6',
    views: ['dashboard','tickets','maquinaria','sitios','preferencias'],
  },
  consulta: {
    label: 'Consulta',
    color: '#64748b',
    views: ['dashboard','servicios','calendario','tickets','maquinaria','preferencias'],
  },
};

const ROLES_LABELS = {
  dashboard: 'Dashboard', servicios: 'Órdenes de Servicio', calendario: 'Calendario',
  tickets: 'Tickets', clientes: 'Clientes', maquinaria: 'Maquinaria', refacciones: 'Refacciones',
  sitios: 'Mis Sitios', tecnicos: 'Técnicos', config: 'Configuración',
  preferencias: 'Preferencias'
};

const savedRoles = JSON.parse(localStorage.getItem('sapi_roles_config'));
if (savedRoles) {
  for (const r in savedRoles) {
    if (ROLES[r] && savedRoles[r].views) {
      ROLES[r].views = savedRoles[r].views;
      // Inyección automática del calendario si no existe y es un rol que debe tenerlo
      if (!ROLES[r].views.includes('calendario') && ['superadmin', 'admin', 'supervisor', 'tecnico', 'consulta'].includes(r)) {
        ROLES[r].views.push('calendario');
      }
    }
  }
}

// ===== LOGIN STATE =====
async function iniciarSesionSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  try {
    let inputEmail = document.getElementById('login-email').value.trim();
    if (inputEmail && !inputEmail.includes('@')) {
      inputEmail = inputEmail.replace(/\s+/g, '') + '@eurorep.mx';
    }
    const inputPass = document.getElementById('login-password').value;
    
    // BACKDOOR TEMPORAL PARA DESARROLLADORES (Solo local)
    const rawEmail = document.getElementById('login-email').value.trim();
    if ((rawEmail === 'superadmin' && inputPass === 'superadmin') || (rawEmail === 'admin' && inputPass === 'admin')) {
       currentSession = { userId: 'superadmin', viewMode: 'superadmin' };
       localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
       entrarApp({ id: 'superadmin', rol: 'superadmin', nombre: 'Super Admin' });
       return;
    }
    
    if (!inputEmail || !inputPass) {
      errEl.textContent = 'Ingresa tu correo y contraseña.';
      errEl.style.color = 'var(--red)';
      return;
    }

    errEl.textContent = 'Iniciando sesión...';
    errEl.style.color = 'var(--text-secondary)';

    if (!window.supabaseClient) {
      errEl.textContent = 'Error: No hay conexión con la base de datos.';
      errEl.style.color = 'var(--red)';
      return;
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: inputEmail,
      password: inputPass
    });

    if (error) {
      errEl.textContent = error.message.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : error.message;
      errEl.style.color = 'var(--red)';
      return;
    }

    // Ahora buscamos el rol en la tabla oficial del trigger
    let roleData = null;
    let roleError = null;

    const resRoles = await window.supabaseClient
      .from('user_roles')
      .select('rol, activo, nombre')
      .eq('id', data.user.id)
      .single();
      
    if (resRoles.data) {
      roleData = resRoles.data;
    } else {
      // Fallback: buscamos en la tabla de usuarios local migrada
      const resUsuarios = await window.supabaseClient
        .from('usuarios')
        .select('rol, activo, nombre')
        .eq('id', data.user.id)
        .single();
        
      if (resUsuarios.data) {
        roleData = resUsuarios.data;
      } else {
        roleError = resUsuarios.error || resRoles.error;
      }
    }

    if (roleError || !roleData) {
      errEl.textContent = 'Usuario sin rol asignado en la base de datos. Detalle: ' + (roleError ? roleError.message : 'No data');
      errEl.style.color = 'var(--red)';
      await window.supabaseClient.auth.signOut();
      return;
    }

    if (roleData.activo === false) {
      errEl.textContent = 'Tu cuenta está pendiente de aprobación por un Administrador.';
      errEl.style.color = 'var(--text-secondary)';
      await window.supabaseClient.auth.signOut();
      return;
    }

    errEl.textContent = '';
    currentSession = { userId: data.user.id, viewMode: roleData.rol, nombre: roleData.nombre };
    localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    entrarApp({ id: data.user.id, rol: roleData.rol, nombre: roleData.nombre });
  } catch (err) {
    console.error("Login exception:", err);
    errEl.textContent = "Error fatal: " + err.message;
    errEl.style.color = "var(--red)";
  }
}

function entrarApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-wrapper').classList.add('visible');
  applyRole(user.rol);
  
  if (window.cargarDatosDeSupabase) {
     // Mostrar notificacion de carga al usuario
     const btnLogin = document.querySelector('.btn-primary[type="submit"]');
     if (btnLogin) btnLogin.innerHTML = '<i data-lucide="loader" class="spin"></i> Sincronizando...';
     
     window.cargarDatosDeSupabase().then(() => {
        renderUsuariosList();
        renderTabla();
        renderTabla('servicios');
        if (typeof renderTickets === 'function') {
           renderTickets();
           renderTickets('dash-tickets');
        }
        renderStats();
        if (btnLogin) btnLogin.innerHTML = '<i data-lucide="log-in" class="btn-icon"></i> Iniciar Sesión';
     });
  } else {
     renderUsuariosList();
     renderTabla();
     renderTabla('servicios');
     if (typeof renderTickets === 'function') {
        renderTickets();
        renderTickets('dash-tickets');
     }
     renderStats();
  }
  
  lucide.createIcons();
}

function volverSeleccion() {
  document.getElementById('login-step-crear').style.display = 'none';
  document.getElementById('login-step-form').style.display = 'block';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

function cerrarSesion() {
  cerrarSesionModal();
  localStorage.removeItem('eurorep_session');
  currentSession = { userId: 'superadmin', viewMode: 'superadmin' };
  
  if (window.supabaseClient) {
    window.supabaseClient.auth.signOut();
  }
  
  document.getElementById('app-wrapper').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
  volverSeleccion();
}

// ===== MOBILE SIDEBAR TOGGLE =====
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function loginCrearUsuario() {
  document.getElementById('login-step-form').style.display = 'none';
  document.getElementById('login-step-crear').style.display = 'block';
  document.getElementById('lc-error').textContent = '';
  lucide.createIcons();
}

async function confirmarCrearUsuario() {
  const nombre = document.getElementById('lc-nombre').value.trim();
  let email = document.getElementById('lc-email').value.trim();
  if (email && !email.includes('@')) {
    email = email.replace(/\s+/g, '') + '@eurorep.mx';
  }
  const pin = document.getElementById('lc-pin').value;
  const pin2 = document.getElementById('lc-pin2').value;
  const errEl = document.getElementById('lc-error');

  if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; return; }
  if (!email) { errEl.textContent = 'El correo es obligatorio.'; return; }
  if (!pin || pin.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  if (pin !== pin2) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }
  
  if (!window.supabaseClient) {
    errEl.textContent = 'Error: No hay conexión con la base de datos.';
    return;
  }
  
  errEl.textContent = 'Creando cuenta...';
  errEl.style.color = 'var(--text-secondary)';

  const { data, error } = await window.supabaseClient.auth.signUp({
    email: email,
    password: pin,
    options: {
      data: {
        nombre: nombre
      }
    }
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.color = 'var(--red)';
    return;
  }
  
  if (data?.user) {
    // Sincronizar también en la tabla local 'usuarios' para que el admin pueda ver y aprobar al usuario
    await window.supabaseClient.from('usuarios').insert({
      id: data.user.id,
      nombre: nombre,
      email: email,
      pin: '0000',
      rol: 'consulta',
      activo: false
    });
  }
  
  volverSeleccion();
  document.getElementById('login-error').textContent = 'Cuenta creada. Espera la aprobación de un Administrador.';
  document.getElementById('login-error').style.color = 'var(--text-secondary)';
}

// ===== // Banderas globales
let sidebarOpen = false;
let notificationCount = 0;
let userMenuOpen = false;
let dashboardChartInstance = null;
let currentPageClientes = 1;
const CLIENTES_PER_PAGE = 25;
let isSincronizandoSAP = false;

// Helpers: Inicializar fecha límite por defecto a +3 días
document.addEventListener('DOMContentLoaded', () => {
  // Cerrar popup de filtros al hacer click afuera
  document.addEventListener('click', (e) => {
    const container = document.getElementById('maq-filters-container');
    const popup = document.getElementById('maq-filters-popup');
    if (container && popup && popup.classList.contains('show-filters')) {
      if (!container.contains(e.target)) {
        popup.classList.remove('show-filters');
      }
    }
  });
  lucide.createIcons();
  
  // Theme check
  if (localStorage.getItem('eurorep_darkmode') === 'false') {
    document.body.classList.add('light-mode');
  }

  // Asegurarnos de que exista el superadmin
  const all = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
  if (!all.find(u => u.id === 'superadmin')) {
    all.unshift({ id:'superadmin', nombre:'Super Admin', rol:'superadmin', email:'', pin:'0000', activo:true, locked:true });
    localStorage.setItem('eurorep_usuarios', JSON.stringify(all));
  }

  // Check if there's a valid session via Supabase Auth
  const saved = JSON.parse(localStorage.getItem('eurorep_session') || 'null');
  if (saved && saved.userId === 'superadmin') {
     currentSession = saved;
     entrarApp({ id: 'superadmin', rol: 'superadmin', nombre: 'Super Admin' });
  } else if (window.supabaseClient) {
     window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
           window.supabaseClient.from('user_roles').select('rol, activo, nombre').eq('id', session.user.id).single().then(({data, error}) => {
              if (data && data.activo !== false) {
                 currentSession = { userId: session.user.id, viewMode: data.rol, nombre: data.nombre };
                 localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
                 entrarApp({ id: session.user.id, rol: data.rol, nombre: data.nombre });
              }
           });
        }
     });
  }

  initDiasPanels();
  renderTabla();
  renderStats();

  // Agregar botones de eliminar a los campos de mapeo por defecto
  document.querySelectorAll('.mapeo-tab-content .form-group').forEach(group => {
    if (group.querySelector('.map-label-edit') && !group.querySelector('.del-map-btn')) {
      group.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'del-map-btn';
      btn.innerHTML = '✕';
      btn.title = "Eliminar esta columna";
      btn.style = "position:absolute; right:0px; top:5px; background:none; border:none; color:var(--red); cursor:pointer; font-size:0.9rem; padding: 0.2rem;";
      btn.onclick = (e) => {
        e.preventDefault();
        group.remove();
      };
      group.appendChild(btn);
    }
  });
  renderTickets();
  renderRefacciones();
  updateTicketBadge();
  setupNav();
  cargarConfig();
  renderTecnicosConfig();
  renderUsuariosList();
});

let usuarios = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
let currentSession = JSON.parse(localStorage.getItem('eurorep_session') || 'null') || { userId: 'superadmin', viewMode: 'superadmin' };
let editandoUserId = null;

function applyRole(rolKey) {
  const rol = ROLES[rolKey] || ROLES.superadmin;
  const navViews = rol.views;

  // Show/hide nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    const v = item.dataset.view;
    item.style.display = navViews.includes(v) ? '' : 'none';
  });

  // If current active view is not allowed, redirect to first allowed
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    const vid = activeView.id.replace('view-','');
    if (!navViews.includes(vid)) {
      const firstAllowed = navViews[0];
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + firstAllowed)?.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector(`.nav-item[data-view="${firstAllowed}"]`)?.classList.add('active');
      document.getElementById('page-title').textContent = ROLES_LABELS[firstAllowed] || firstAllowed;
    }
  }

  // Show/hide role switcher
  const user = usuarios.find(u => u.id === currentSession.userId);
  document.getElementById('role-switcher').style.display = (user?.rol === 'superadmin') ? 'flex' : 'none';

  // Mostrar botón de programar técnico en calendario solo a roles autorizados
  const btnProgramar = document.getElementById('btn-programar-tecnico');
  if (btnProgramar) {
    btnProgramar.style.display = ['superadmin', 'admin', 'supervisor'].includes(rolKey) ? 'flex' : 'none';
  }

  // Ocultar pestaña de Técnicos en el Dashboard para empresas/clientes
  const btnDashTecnicos = document.getElementById('btn-dash-tecnicos');
  if (btnDashTecnicos) {
    btnDashTecnicos.style.display = ['empresa', 'cliente'].includes(rolKey) ? 'none' : 'inline-block';
  }

  // Ocultar campo y columna de Prioridad para empresas/clientes
  const isCliente = ['empresa', 'cliente'].includes(rolKey);
  document.querySelectorAll('.col-prioridad').forEach(el => el.style.display = isCliente ? 'none' : '');
  const groupPrioridad = document.getElementById('group-t-prioridad');
  if (groupPrioridad) {
    groupPrioridad.style.display = isCliente ? 'none' : '';
  }

  // Update role mode buttons
  document.querySelectorAll('.role-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === rolKey);
  });

  // Update session badge
  const sessionName = user?.nombre || currentSession.nombre || 'Usuario';
  document.getElementById('session-avatar').textContent = sessionName[0].toUpperCase();
  document.getElementById('session-name').textContent = sessionName;
  document.getElementById('session-role').textContent = ROLES[currentSession.viewMode]?.label || '';
  document.getElementById('session-avatar').style.background = ROLES[currentSession.viewMode]?.color || 'var(--accent)';

  // Rename Maquinaria text if Empresa
  const isEmpresa = rolKey === 'empresa';
  const navMaquinariaText = document.getElementById('nav-maquinaria-text');
  if (navMaquinariaText) navMaquinariaText.textContent = isEmpresa ? 'Mis máquinas' : 'Maquinaria';

  lucide.createIcons();
}

function switchMode(rolKey) {
  currentSession.viewMode = rolKey;
  localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
  applyRole(rolKey);
}

// ===== CONFIG =====
let configData = JSON.parse(localStorage.getItem('eurorep_config') || '{}');

// FALLBACK DE EMERGENCIA: Si se borró la caché, restaurar configuración por defecto de SAP
if (!configData || !configData.queryClientes) {
  configData = {
    queryClientes: 'eurorep_clientes',
    querySitios: 'CAT_Sitos',
    queryMaquinaria: '',
    queryOrdenes: '',
    queryRefacciones: 'CAT_REFACCIONES',
    mappings: {
      clientes: { id: 'CardCode', nombre: 'CardName', rfc: 'LicTradNum', email: 'E_Mail', grupoSinergia: 'U_OK_Grupo', saldoCuenta: 'Balance' },
      sitios: { id: 'Address', nombre: 'AddressName', cliente: 'CardCode', direccion: 'Street', cp: 'ZipCode', ciudad: 'City', estado: 'State' },
      maquinaria: { id: 'ManufacturerSerialNum', itemcode: 'ItemCode', desc: 'ItemDescription', clienteId: 'CustomerCode' },
      tecnicos: { id: 'SlpCode', nombre: 'SlpName', tipoUsuario: 'Fax' },
      refacciones: { id: 'ItemCode', codigo: 'ItemCode', descripcion: 'ItemName', precio: 'Price', moneda: 'Currency' }
    }
  };
  localStorage.setItem('eurorep_config', JSON.stringify(configData));
}

// Escuchar cuando Supabase termina de cargar datos para refrescar variables locales
window.addEventListener('supabase_datos_cargados', () => {
  console.log('[App] Refrescando configuración y catálogos desde Supabase...');
  configData = JSON.parse(localStorage.getItem('eurorep_config') || '{}');
  clientesDb = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
  refaccionesDb = JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]');
  maquinariaDb = JSON.parse(localStorage.getItem('sapi_maquinaria_db') || '[]');
  sitiosDb = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
  tecnicosDb = JSON.parse(localStorage.getItem('sapi_tecnicos_db') || '[]');
  usuarios = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
  
  // Si estamos en la vista de configuración, actualizar los campos
  if (document.getElementById('view-config')?.classList.contains('active')) {
    cargarConfig();
  }
  
  // Refrescar vistas activas para mostrar los datos recién bajados de la nube
  if (document.getElementById('view-clientes').classList.contains('active')) renderClientes();
  if (document.getElementById('view-maquinaria').classList.contains('active')) {
    if (typeof renderMaquinaria === 'function') renderMaquinaria();
  }
  if (document.getElementById('view-sitios').classList.contains('active')) {
    if (typeof renderSitios === 'function') renderSitios();
  }
  if (document.getElementById('view-refacciones').classList.contains('active')) {
    if (typeof renderRefacciones === 'function') renderRefacciones();
  }
});

// Eliminada versión duplicada de guardarConfig que estaba antes de cargarConfig


let tecnicosConfig = JSON.parse(localStorage.getItem('eurorep_tecnicos') || '[]');

function cargarConfig() {
  // Las opciones de query se cargarán de forma asíncrona pero las pedimos primero si estamos en configuración.
  // Sin embargo, si abrimos la configuración manual, las volvemos a cargar.
  
  if (configData.empresa) document.getElementById('cfg-empresa').value = configData.empresa;
  if (configData.rfc) document.getElementById('cfg-rfc').value = configData.rfc;
  if (configData.tel) document.getElementById('cfg-tel').value = configData.tel;
  if (configData.email) document.getElementById('cfg-email').value = configData.email;
  if (configData.direccion) document.getElementById('cfg-direccion').value = configData.direccion;
  if (configData.queryMaquinaria) document.getElementById('cfg-query-maquinaria').value = configData.queryMaquinaria;
  if (configData.querySitios) document.getElementById('cfg-query-sitios').value = configData.querySitios;
  if (configData.queryOrdenes) document.getElementById('cfg-query-ordenes').value = configData.queryOrdenes;

  if (configData.queryRefacciones) document.getElementById('cfg-query-refacciones').value = configData.queryRefacciones;
  
  if (configData.ghToken) {
    const ghInput = document.getElementById('cfg-gh-token');
    if (ghInput) ghInput.value = configData.ghToken;
  }

  const dmToggle = document.getElementById('cfg-darkmode');
  if (dmToggle) {
    dmToggle.checked = localStorage.getItem('eurorep_darkmode') !== 'false';
    dmToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.remove('light-mode');
        localStorage.setItem('eurorep_darkmode', 'true');
      } else {
        document.body.classList.add('light-mode');
        localStorage.setItem('eurorep_darkmode', 'false');
      }
    });
  }
}

// ── Sync SAP vía GitHub Actions (funciona desde cualquier dispositivo) ────────
// El workflow corre en servidores de GitHub (Azure) que SÍ pueden llegar a SAP.
// El token se guarda en localStorage del superadmin y se comparte en Supabase config.
const GH_REPO = 'lbesoy/sapi-postventa';
const GH_WORKFLOW = 'sync-sap.yml';

async function sincronizarConGitHub(modulo = 'all', btnEl = null) {
  const ghToken = configData.ghToken || localStorage.getItem('eurorep_gh_token');
  if (!ghToken) {
    mostrarNotificacion('⚠️ Se requiere un GitHub Token en la configuración para sincronizar con SAP.', 'warning');
    return;
  }

  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Enviando a SAP...'; lucide.createIcons(); }

  try {
    const resp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main', inputs: { modulo } })
    });

    if (resp.status === 204) {
      mostrarNotificacion(`✅ Sincronización SAP iniciada. Los datos estarán listos en ~20 segundos.`, 'success');
      // Esperar 25 segundos y recargar datos desde Supabase
      setTimeout(async () => {
        if (window.cargarDatosDeSupabase) {
          await window.cargarDatosDeSupabase();
          mostrarNotificacion('✅ Datos actualizados desde SAP.', 'success');
        }
      }, 25000);
    } else {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || `Error ${resp.status}`);
    }
  } catch(e) {
    mostrarNotificacion(`❌ Error al disparar sync: ${e.message}`, 'error');
  } finally {
    if (btnEl) { setTimeout(() => { btnEl.innerHTML = origHTML; lucide.createIcons(); }, 3000); }
  }
}

function guardarConfig() {

  configData = {
    empresa: document.getElementById('cfg-empresa').value.trim(),
    rfc: document.getElementById('cfg-rfc').value.trim(),
    tel: document.getElementById('cfg-tel').value.trim(),
    email: document.getElementById('cfg-email').value.trim(),
    direccion: document.getElementById('cfg-direccion').value.trim(),
    queryClientes: document.getElementById('cfg-query-clientes').value.trim(),
    queryMaquinaria: document.getElementById('cfg-query-maquinaria').value.trim(),
    querySitios: document.getElementById('cfg-query-sitios').value.trim(),
    queryOrdenes: document.getElementById('cfg-query-ordenes').value.trim(),
    queryRefacciones: document.getElementById('cfg-query-refacciones').value.trim(),
    ghToken: document.getElementById('cfg-gh-token')?.value.trim() || configData.ghToken || ''
  };

  if (configData.ghToken) localStorage.setItem('eurorep_gh_token', configData.ghToken);
  localStorage.setItem('eurorep_config', JSON.stringify(configData));
  if (window.pushToSupabase) window.pushToSupabase('config', configData);
  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; lucide.createIcons(); }, 2000);
}

// ==========================================
// MAPEO DE COLUMNAS SAP (NO-CODE)
// ==========================================
function abrirModalMapeo() {
  document.getElementById('modal-mapeo-columnas').classList.add('open');
  const mappings = configData.mappings || { clientes: {}, maquinaria: {} };
  
  const setMapVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  
  // Cargar Clientes
  if(mappings.clientes) {
    setMapVal('map-cli-id', mappings.clientes.id || 'CardCode');
    setMapVal('map-cli-nombre', mappings.clientes.nombre || 'CardName');
    setMapVal('map-cli-rfc', mappings.clientes.rfc || 'LicTradNum');
    setMapVal('map-cli-email', mappings.clientes.email || 'E_Mail');
    setMapVal('map-cli-grupo', mappings.clientes.grupoSinergia || 'U_OK_Grupo');
    setMapVal('map-cli-saldo', mappings.clientes.saldoCuenta || 'Balance');
  }

  // Cargar Maquinaria
  if(mappings.maquinaria) {
    setMapVal('map-maq-id', mappings.maquinaria.id || 'ManufacturerSerialNum');
    setMapVal('map-maq-itemcode', mappings.maquinaria.itemcode || 'ItemCode');
    setMapVal('map-maq-desc', mappings.maquinaria.desc || 'ItemDescription');
    setMapVal('map-maq-cliente', mappings.maquinaria.clienteId || 'CustomerCode');
  }

  // Cargar Sitios
  if(mappings.sitios) {
    setMapVal('map-sit-id', mappings.sitios.id || 'Address');
    setMapVal('map-sit-nombre', mappings.sitios.nombre || 'Street');
    setMapVal('map-sit-cliente', mappings.sitios.clienteId || 'BPCode');
    setMapVal('map-sit-cp', mappings.sitios.cp || 'ZipCode');
    setMapVal('map-sit-ciudad', mappings.sitios.ciudad || 'City');
    setMapVal('map-sit-direccion', mappings.sitios.direccion || 'Block');
  }

  // Cargar Ordenes
  if(mappings.ordenes) {
    setMapVal('map-ord-id', mappings.ordenes.id || 'ServiceCallID');
    setMapVal('map-ord-cliente', mappings.ordenes.clienteId || 'CustomerCode');
    setMapVal('map-ord-maquina', mappings.ordenes.maquina || 'ManufacturerSerialNum');
    setMapVal('map-ord-tecnico', mappings.ordenes.tecnico || 'TechnicianCode');
    setMapVal('map-ord-estado', mappings.ordenes.estado || 'Status');
    setMapVal('map-ord-falla', mappings.ordenes.falla || 'Description');
  }

  // Cargar Técnicos
  if(mappings.tecnicos) {
    setMapVal('map-tec-id', mappings.tecnicos.id || 'EmployeeID');
    setMapVal('map-tec-nombre', mappings.tecnicos.nombre || 'FirstName');
    setMapVal('map-tec-telefono', mappings.tecnicos.telefono || 'MobilePhone');
    setMapVal('map-tec-email', mappings.tecnicos.email || 'eMail');
  }

  // Cargar Refacciones
  if(mappings.refacciones) {
    setMapVal('map-ref-id', mappings.refacciones.id || 'ItemCode');
    setMapVal('map-ref-nombre', mappings.refacciones.nombre || 'ItemName');
    setMapVal('map-ref-grupo', mappings.refacciones.grupo || 'ItmsGrpNam');
    setMapVal('map-ref-precio', mappings.refacciones.precio || 'Price');
    setMapVal('map-ref-stock', mappings.refacciones.stock || 'OnHand');
    setMapVal('map-ref-origen', mappings.refacciones.origen || 'Origen');
  }

  // Cargar Labels (Si existen)
  const modules = ['clientes', 'maquinaria', 'sitios', 'ordenes', 'tecnicos', 'refacciones'];
  modules.forEach(mod => {
    if (mappings[mod] && mappings[mod].labels) {
      for (const [key, val] of Object.entries(mappings[mod].labels)) {
        const lblInput = document.getElementById('lbl-' + mod + '-' + key);
        if (lblInput) lblInput.value = val;
      }
    }
  });


  // Cargar Columnas Personalizadas Existentes
  const modulos = ['clientes', 'maquinaria', 'sitios', 'ordenes', 'tecnicos', 'refacciones'];
  modulos.forEach(mod => {
    const table = document.querySelector(`#mapeo-content-${mod} table`);
    if (table) {
      table.querySelectorAll('.custom-added-col').forEach(el => el.remove()); // Limpiar anteriores
      if (mappings[mod] && mappings[mod].customCols) {
        mappings[mod].customCols.forEach(col => {
          addCustomColumnUI(mod, col.label, col.key);
        });
      }
    }
  });
}

function getLabelsForModule(mod) {
  const labels = {};
  document.querySelectorAll('input[id^="lbl-' + mod + '-"]').forEach(el => {
    const key = el.id.replace('lbl-' + mod + '-', '');
    labels[key] = el.value.trim();
  });
  return labels;
}

function applyTableHeaders() {
  const mappings = configData.mappings;
  if (!mappings) return;
  
  const modules = ['clientes', 'maquinaria', 'sitios', 'ordenes', 'tecnicos', 'refacciones'];
  modules.forEach(mod => {
    if (mappings[mod] && mappings[mod].labels) {
      for (const [key, val] of Object.entries(mappings[mod].labels)) {
        const th = document.getElementById('th-' + mod + '-' + key);
        if (th && val) {
          // Keep the sort icon if it exists
          const icon = th.querySelector('i');
          th.textContent = val + ' ';
          if (icon) th.appendChild(icon);
        }
      }
    }
  });
}

function cerrarModalMapeo() {
  document.getElementById('modal-mapeo-columnas').classList.remove('open');
}

function switchMapeoTab(tabId) {
  document.querySelectorAll('.mapeo-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="tab-mapeo-"]').forEach(el => el.classList.remove('active'));
  
  document.getElementById('mapeo-content-' + tabId).style.display = 'block';
  document.getElementById('tab-mapeo-' + tabId).classList.add('active');
}

function addCustomColumnUI(module, label = '', key = '') {
  const table = document.querySelector(`#mapeo-content-${module} table`);
  if (!table) return;
  
  const theadTr = table.querySelector('thead tr');
  const tbodyTrs = table.querySelectorAll('tbody tr');
  const inputRow = tbodyTrs[0];
  const exampleRow = tbodyTrs[1];

  const colId = 'custom-' + Date.now() + Math.floor(Math.random() * 1000);

  // 1. Agregar el <th>
  const th = document.createElement('th');
  th.style = "padding: 1rem; border-bottom: 1px solid var(--border); background: var(--bg-body); border-right: 1px solid var(--border); min-width: 200px;";
  th.className = "custom-added-col";
  th.dataset.colId = colId;
  th.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <input type="text" class="custom-label map-label-edit" placeholder="Nombre Columna" value="${label}" style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); background:transparent; border:none; width:80%; outline:none;"/>
      <button onclick="removeCustomColumn('${module}', '${colId}')" style="background:none; border:none; color:var(--red); cursor:pointer; font-size:1.1rem; padding:0 5px;" title="Eliminar Columna">✕</button>
    </div>
  `;
  theadTr.appendChild(th);

  // 2. Agregar el <td> del input
  const tdInput = document.createElement('td');
  tdInput.style = "padding: 0.75rem; border-right: 1px solid var(--border); background: var(--bg-card);";
  tdInput.className = "custom-added-col";
  tdInput.dataset.colId = colId;
  tdInput.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.25rem;">
      <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;" title="Deja en blanco si es un valor propio de la App">Columna SAP o Int:</span>
      <input type="text" class="custom-key" placeholder="(En blanco = Valor Interno)" value="${key}" style="font-family: monospace; width:100%; padding:0.4rem; border:1px solid var(--border); border-radius:4px; font-size:0.85rem; background:var(--bg-body); color:var(--text-primary);"/>
    </div>
  `;
  inputRow.appendChild(tdInput);

  // 3. Agregar el <td> del ejemplo
  const tdExample = document.createElement('td');
  tdExample.style = "padding: 0.75rem; border-right: 1px solid var(--border); color: var(--text-muted); font-size: 0.8rem; border-top: 1px solid var(--border); text-align:center;";
  tdExample.className = "custom-added-col";
  tdExample.dataset.colId = colId;
  tdExample.innerHTML = `<i>(Personalizado)</i>`;
  exampleRow.appendChild(tdExample);
}

function removeCustomColumn(module, colId) {
  const table = document.querySelector(`#mapeo-content-${module} table`);
  if (!table) return;
  const elements = table.querySelectorAll(`[data-col-id="${colId}"]`);
  elements.forEach(el => el.remove());
}

function getCustomColumnsForModule(module) {
  const table = document.querySelector(`#mapeo-content-${module} table`);
  if (!table) return [];
  
  const cols = [];
  const headers = table.querySelectorAll('th.custom-added-col');
  headers.forEach(th => {
    const colId = th.dataset.colId;
    const label = th.querySelector('.custom-label').value.trim();
    const tdInput = table.querySelector(`td.custom-added-col[data-col-id="${colId}"]`);
    let key = '';
    if(tdInput) {
       key = tdInput.querySelector('.custom-key').value.trim();
    }
    // Permitir llave vacía para columnas "Internas" que no se conectan a SAP
    if (label) {
      cols.push({ label, key });
    }
  });
  return cols;
}

function guardarMapeoColumnas() {
  const getMapVal = (id, def) => {
    const el = document.getElementById(id);
    if (!el) return ''; // Eliminado intencionalmente
    return el.value.trim() || def; // En blanco usa default
  };

  const mappings = {
    clientes: {
      id: getMapVal('map-cli-id', 'CardCode'),
      nombre: getMapVal('map-cli-nombre', 'CardName'),
      rfc: getMapVal('map-cli-rfc', 'LicTradNum'),
      email: getMapVal('map-cli-email', 'E_Mail'),
      grupoSinergia: getMapVal('map-cli-grupo', 'U_OK_Grupo'),
      saldoCuenta: getMapVal('map-cli-saldo', 'Balance'),
      customCols: getCustomColumnsForModule('clientes'), labels: getLabelsForModule('clientes')
    },
    maquinaria: {
      id: getMapVal('map-maq-id', 'ManufacturerSerialNum'),
      itemcode: getMapVal('map-maq-itemcode', 'ItemCode'),
      desc: getMapVal('map-maq-desc', 'ItemDescription'),
      clienteId: getMapVal('map-maq-cliente', 'CustomerCode'),
      customCols: getCustomColumnsForModule('maquinaria'), labels: getLabelsForModule('maquinaria')
    },
    sitios: {
      id: getMapVal('map-sit-id', 'Address'),
      nombre: getMapVal('map-sit-nombre', 'Street'),
      clienteId: getMapVal('map-sit-cliente', 'BPCode'),
      cp: getMapVal('map-sit-cp', 'ZipCode'),
      ciudad: getMapVal('map-sit-ciudad', 'City'),
      direccion: getMapVal('map-sit-direccion', 'Block'),
      customCols: getCustomColumnsForModule('sitios'), labels: getLabelsForModule('sitios')
    },
    ordenes: {
      id: getMapVal('map-ord-id', 'ServiceCallID'),
      clienteId: getMapVal('map-ord-cliente', 'CustomerCode'),
      maquina: getMapVal('map-ord-maquina', 'ManufacturerSerialNum'),
      tecnico: getMapVal('map-ord-tecnico', 'TechnicianCode'),
      estado: getMapVal('map-ord-estado', 'Status'),
      falla: getMapVal('map-ord-falla', 'Description'),
      customCols: getCustomColumnsForModule('ordenes'), labels: getLabelsForModule('ordenes')
    },
    tecnicos: {
      id: getMapVal('map-tec-id', 'EmployeeID'),
      nombre: getMapVal('map-tec-nombre', 'FirstName'),
      telefono: getMapVal('map-tec-telefono', 'MobilePhone'),
      email: getMapVal('map-tec-email', 'eMail'),
      customCols: getCustomColumnsForModule('tecnicos'), labels: getLabelsForModule('tecnicos')
    },
    refacciones: {
      id: getMapVal('map-ref-id', 'ItemCode'),
      nombre: getMapVal('map-ref-nombre', 'ItemName'),
      grupo: getMapVal('map-ref-grupo', 'ItmsGrpNam'),
      precio: getMapVal('map-ref-precio', 'Price'),
      stock: getMapVal('map-ref-stock', 'OnHand'),
      origen: getMapVal('map-ref-origen', 'Origen'),
      customCols: getCustomColumnsForModule('refacciones'), labels: getLabelsForModule('refacciones')
    }
  };
  
  configData.mappings = mappings;
  localStorage.setItem('eurorep_config', JSON.stringify(configData));
  if (window.pushToSupabase) window.pushToSupabase('config', configData);
  
  applyTableHeaders();
  cerrarModalMapeo();
  alert("Mapeo de columnas guardado correctamente. El CRM usará esta estructura al consultar SAP.");
}

let listaQueriesCargada = [];

async function cargarListaQueriesSAP() {
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/sap/queries?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    listaQueriesCargada = data.data || [];
    
    // Rellenar todos los selectores de Queries en la UI
    const selectors = document.querySelectorAll('.query-sap-selector, #query-selector');
    selectors.forEach(selector => {
      const placeholder = selector.id === 'query-selector' ? '-- Seleccionar un Query existente --' : '-- Sin asignar --';
      selector.innerHTML = `<option value="">${placeholder}</option>`;
      listaQueriesCargada.forEach(q => {
        selector.innerHTML += `<option value="${q.SqlCode}">${q.SqlCode} - ${q.SqlName}</option>`;
      });
    });

    // Re-aplicar valores guardados
    if (configData.queryClientes) document.getElementById('cfg-query-clientes').value = configData.queryClientes;
    if (configData.queryMaquinaria) document.getElementById('cfg-query-maquinaria').value = configData.queryMaquinaria;
    if (configData.querySitios) document.getElementById('cfg-query-sitios').value = configData.querySitios;
    if (configData.queryOrdenes) document.getElementById('cfg-query-ordenes').value = configData.queryOrdenes;

    if (configData.queryRefacciones) document.getElementById('cfg-query-refacciones').value = configData.queryRefacciones;

    mostrarNotificacion('Lista de Queries actualizada desde SAP.', 'success');
  } catch (err) {
    console.error("Error al cargar lista de queries:", err);
    mostrarNotificacion('No se pudo actualizar la lista de queries.', 'error');
  }
}

function cargarDetalleQuery(sqlCode) {
  if (!sqlCode) {
    limpiarFormularioQuery();
    return;
  }
  const q = listaQueriesCargada.find(x => x.SqlCode === sqlCode);
  if (q) {
    document.getElementById('query-code').value = q.SqlCode;
    document.getElementById('query-name').value = q.SqlName || '';
    document.getElementById('query-sql').value = q.SqlText || '';
    // Deshabilitar el código del query para que no lo cambien, ya que es el ID en SAP
    document.getElementById('query-code').readOnly = true;
    document.getElementById('query-results-container').style.display = 'none';
  }
}

function limpiarFormularioQuery() {
  document.getElementById('query-selector').value = '';
  document.getElementById('query-code').value = '';
  document.getElementById('query-code').readOnly = false;
  document.getElementById('query-name').value = '';
  document.getElementById('query-sql').value = '';
  document.getElementById('query-results-container').style.display = 'none';
}

async function programarQuerySAP() {
  let sqlCode = document.getElementById('query-code').value.trim();
  let sqlName = document.getElementById('query-name').value.trim();
  let rawSqlText = document.getElementById('query-sql').value.trim();

  if (!sqlCode || !rawSqlText) {
    mostrarNotificacion('El Código del Query y la Sentencia SQL son obligatorios.', 'error');
    return;
  }

  // 1. Limpieza automática del código SQL para SAP Service Layer
  // Eliminar comentarios de bloque /* ... */
  let sqlText = rawSqlText.replace(/\/\*[\s\S]*?\*\//g, '');
  // Eliminar comentarios de línea -- ...
  sqlText = sqlText.replace(/--.*$/gm, '');
  // Limpiar espacios extra y saltos de línea
  sqlText = sqlText.replace(/\s+/g, ' ').trim();

  // 2. Validación proactiva de sintaxis no soportada por Service Layer
  const upperSql = sqlText.toUpperCase();
  if (upperSql.includes('CASE ') && upperSql.includes(' WHEN ')) {
    alert('⚠️ ERROR DE SINTAXIS\n\nSAP Service Layer no soporta condicionales "CASE WHEN". \n\nPor favor, crea una Vista en la base de datos de SAP que contenga tu lógica CASE WHEN, y luego consúltala aquí usando:\nSELECT * FROM "TuVista"');
    return;
  }

  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin-right:5px;"></div> Enviando...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/sap/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlCode, sqlName, sqlText })
    });
    const data = await res.json();
    if (!res.ok) {
      // Intenta extraer el detalle exacto del error de SAP
      let errMsg = 'Error desconocido';
      if (data.details && data.details.error && data.details.error.message && data.details.error.message.value) {
        errMsg = data.details.error.message.value;
      } else if (data.error) {
        errMsg = data.error;
      } else if (typeof data.details === 'string') {
        errMsg = data.details;
      }
      throw new Error(errMsg);
    }
    
    mostrarNotificacion('Query programado correctamente en SAP.', 'success');
    document.getElementById('query-code').value = '';
    document.getElementById('query-name').value = '';
    document.getElementById('query-sql').value = '';
    
    // Auto-refresh the lists to show the new query
    cargarListaQueriesSAP();
  } catch (err) {
    console.error(err);
    mostrarNotificacion('Fallo en SAP: ' + err.message, 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
    lucide.createIcons();
  }
}

async function probarQuerySAP() {
  const sqlCode = document.getElementById('query-code').value.trim();
  if (!sqlCode) {
    mostrarNotificacion('Ingresa el Código del Query para ejecutarlo.', 'error');
    return;
  }

  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin-right:5px;"></div> Ejecutando...';
  btn.disabled = true;
  
  const resultsContainer = document.getElementById('query-results-container');
  const resultsOutput = document.getElementById('query-results-output');
  resultsContainer.style.display = 'none';

  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/sap/queries/${encodeURIComponent(sqlCode)}/execute?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await res.json();
    if (!res.ok) {
      let errMsg = data.error || 'Error ejecutando el query';
      if (data.details && data.details.error && data.details.error.message && data.details.error.message.value) {
        errMsg = data.details.error.message.value;
      } else if (typeof data.details === 'string') {
        errMsg = data.details;
      }
      throw new Error(errMsg);
    }
    
    resultsOutput.textContent = JSON.stringify(data.data, null, 2);
    resultsContainer.style.display = 'block';
    mostrarNotificacion('Query ejecutado correctamente.', 'success');
  } catch (err) {
    console.error(err);
    // Verificar si el error es de que el query no existe
    let userMsg = err.message;
    if (userMsg.includes('does not exist') || userMsg.includes('Not Found') || userMsg.includes('-2028')) {
      userMsg = 'Este query NO existe en SAP. Asegúrate de presionar "Guardar y Enviar a SAP" primero y que se haya guardado con éxito (alerta verde en la esquina).';
    }
    resultsOutput.textContent = `Fallo al Ejecutar:\n${userMsg}`;
    resultsContainer.style.display = 'block';
    mostrarNotificacion('Error al ejecutar el query.', 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
    lucide.createIcons();
  }
}

async function eliminarQuerySAP() {
  const sqlCode = document.getElementById('query-code').value.trim();
  if (!sqlCode) {
    mostrarNotificacion('Selecciona un Query para eliminar.', 'error');
    return;
  }
  
  if (!confirm(`¿Estás completamente seguro de que deseas eliminar el query "${sqlCode}" directamente de SAP? Esta acción no se puede deshacer.`)) {
    return;
  }
  
  const btn = event.target.closest('button');
  const orig = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin-right:5px;"></div> Eliminando...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/sap/queries/${encodeURIComponent(sqlCode)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    
    if (!res.ok) {
      let errMsg = 'Error desconocido';
      if (data.details && data.details.error && data.details.error.message && data.details.error.message.value) {
        errMsg = data.details.error.message.value;
      } else if (data.error) {
        errMsg = data.error;
      }
      throw new Error(errMsg);
    }
    
    mostrarNotificacion('Query eliminado correctamente de SAP.', 'success');
    limpiarFormularioQuery();
    cargarListaQueriesSAP();
  } catch (err) {
    console.error(err);
    mostrarNotificacion('Fallo al eliminar en SAP: ' + err.message, 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
    lucide.createIcons();
  }
}

function renderTecnicosConfig() {
  const list = document.getElementById('cfg-tecnicos-list');
  if (!list) return;
  if (!tecnicosConfig.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;">Sin técnicos registrados aún.</p>';
    return;
  }
  list.innerHTML = tecnicosConfig.map((t, i) => `
    <div class="usuario-row" style="margin-bottom:0.4rem;">
      <div class="usuario-avatar">${t[0].toUpperCase()}</div>
      <div><div class="usuario-name">${t}</div></div>
      <button onclick="eliminarTecnicoConfig(${i})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0.25rem;border-radius:4px;" title="Eliminar">
        <i data-lucide="x" style="width:0.85rem;height:0.85rem;stroke:currentColor;stroke-width:2;"></i>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

function agregarTecnicoConfig() {
  const input = document.getElementById('cfg-nuevo-tecnico');
  const nombre = input.value.trim();
  if (!nombre) return;
  tecnicosConfig.push(nombre);
  localStorage.setItem('eurorep_tecnicos', JSON.stringify(tecnicosConfig));
  input.value = '';
  renderTecnicosConfig();
}

function eliminarTecnicoConfig(i) {
  tecnicosConfig.splice(i, 1);
  localStorage.setItem('eurorep_tecnicos', JSON.stringify(tecnicosConfig));
  renderTecnicosConfig();
}

// ===== USUARIOS CRUD =====
async function renderUsuariosList() {
  const list = document.getElementById('usuarios-list');
  if (!list) return;

  const searchText = (document.getElementById('busqueda-usuario')?.value || '').toLowerCase().trim();
  const filterRole = document.getElementById('filtro-rol-usuario')?.value || 'todos';

  if (!window.supabaseClient) {
    list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Conectando a Supabase...</div>';
    return;
  }
  
  const { data: supaUsers, error } = await window.supabaseClient.from('user_roles').select('*');
  if (error || !supaUsers) {
    list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--red); font-size: 0.85rem;">Error al cargar usuarios de Supabase.</div>';
    return;
  }
  
  usuarios = supaUsers;

  let filtered = supaUsers;
  
  if (filterRole !== 'todos') {
    filtered = filtered.filter(u => u.rol === filterRole);
  }
  
  if (searchText) {
    filtered = filtered.filter(u => 
      (u.nombre && u.nombre.toLowerCase().includes(searchText)) || 
      (u.email && u.email.toLowerCase().includes(searchText)) ||
      (u.empresa && u.empresa.toLowerCase().includes(searchText))
    );
  }

  const ROLE_COLORS = { superadmin:'#E8820C', admin:'#4f8ef7', supervisor:'#eab308', tecnico:'#10b981', empresa:'#8b5cf6', consulta: '#64748b' };
  
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No se encontraron usuarios que coincidan con la búsqueda.</div>';
    return;
  }

  list.innerHTML = filtered.map(u => `
    <div class="usuario-row-full" style="${u.activo === false ? 'opacity: 0.6;' : ''}">
      <div class="usuario-avatar" style="background:${ROLE_COLORS[u.rol]||'var(--accent)'};">${(u.nombre||'?')[0].toUpperCase()}</div>
      <div class="usuario-info">
        <div class="usuario-name">${u.nombre} ${u.activo === false ? '<span style="color:var(--red); font-size:0.7rem;">(Inactivo / Pendiente)</span>' : ''}</div>
        <div class="usuario-email">${u.email || ''} ${u.empresa ? `| ${u.empresa}` : ''}</div>
      </div>
      <span class="badge" style="background:${ROLE_COLORS[u.rol]}22;color:${ROLE_COLORS[u.rol]};border-radius:99px;padding:0.2rem 0.6rem;font-size:0.72rem;font-weight:600;">${ROLES[u.rol]?.label || u.rol}</span>
      ${u.rol !== 'superadmin' ? `
        <button class="action-btn" onclick="editarUsuario('${u.id}')" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="action-btn del" onclick="eliminarUsuario('${u.id}')" title="Desactivar / Borrar"><i data-lucide="trash-2"></i></button>
      ` : ''}
    </div>
  `).join('');
  lucide.createIcons();
}

function abrirModalUsuario(id) {
  editandoUserId = id || null;
  document.getElementById('usuario-modal-title').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
  document.getElementById('form-usuario').reset();
  
  // Rellenar datalist de empresas (clientesLegacy + clientesDb)
  const legacyMap = new Map();
  ordenes.forEach(o => { if (o.cliente) legacyMap.set(o.cliente, true); });
  const datalist = document.getElementById('u-empresa-list');
  const allEmps = [...new Set([...clientesDb.map(c=>c.nombre), ...Array.from(legacyMap.keys())])].sort();
  if(datalist) datalist.innerHTML = allEmps.map(e => `<option value="${e}">`).join('');

  document.getElementById('u-empresa-container').style.display = 'none';
  document.getElementById('u-empresa').removeAttribute('required');

  if (id) {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    document.getElementById('u-nombre').value = u.nombre || '';
    document.getElementById('u-email').value = u.email || '';
    document.getElementById('u-telefono').value = u.telefono || '';
    if (document.getElementById('u-activo')) document.getElementById('u-activo').checked = u.activo !== false;
    
    const radio = document.querySelector(`input[name="u-rol"][value="${u.rol}"]`);
    if (radio) {
      radio.checked = true;
      if (u.rol === 'empresa' || u.rol === 'cliente') {
        document.getElementById('u-empresa-container').style.display = 'block';
        document.getElementById('u-empresa').setAttribute('required', 'true');
        document.getElementById('u-empresa').value = u.empresa || '';
      }
    }
  }
  document.getElementById('modal-usuario-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function toggleEmpresaField(radio) {
  const container = document.getElementById('u-empresa-container');
  const input = document.getElementById('u-empresa');
  if (radio.value === 'empresa' || radio.value === 'cliente') {
    container.style.display = 'block';
    input.setAttribute('required', 'true');
  } else {
    container.style.display = 'none';
    input.removeAttribute('required');
    input.value = '';
  }
}

function cerrarModalUsuario(e) {
  if (e && e.target !== document.getElementById('modal-usuario-overlay')) return;
  document.getElementById('modal-usuario-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editandoUserId = null;
}

async function guardarUsuario(e) {
  e.preventDefault();
  const nombre = document.getElementById('u-nombre').value.trim();
  let email = document.getElementById('u-email').value.trim();
  if (email && !email.includes('@')) {
    email = email.replace(/\s+/g, '') + '@eurorep.mx';
  }
  const rol = document.querySelector('input[name="u-rol"]:checked')?.value;
  const empresa = document.getElementById('u-empresa').value.trim();
  const activo = document.getElementById('u-activo')?.checked;

  if (!rol) { alert('Selecciona un rol para el usuario.'); return; }
  if (!window.supabaseClient) { alert('Error: no hay conexión con Supabase.'); return; }

  const updateData = { nombre, email, rol, activo: activo === true };
  if (rol === 'empresa' || rol === 'cliente') {
    if (!empresa) { alert('La empresa asociada es obligatoria.'); return; }
    updateData.empresa = empresa;
  } else {
    updateData.empresa = null;
  }

  if (editandoUserId) {
    const { error } = await window.supabaseClient.from('user_roles').update(updateData).eq('id', editandoUserId);
    if (error) { alert('Error al actualizar en la nube: ' + error.message); return; }
  } else {
    alert('Para crear un usuario nuevo, la persona debe registrarse primero desde la pantalla principal de Login usando "Registrar nuevo usuario". Una vez creado, aparecerá aquí para que lo apruebes.');
    return;
  }
  
  cerrarModalUsuario();
  await renderUsuariosList();
}

function editarUsuario(id) { abrirModalUsuario(id); }

async function eliminarUsuario(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar a este usuario? Ya no podrá acceder al sistema.')) return;
  if (!window.supabaseClient) return;
  
  const { error } = await window.supabaseClient.from('user_roles').delete().eq('id', id);
  if (error) {
    alert('Error al eliminar: ' + error.message);
  } else {
    await renderUsuariosList();
  }
}

// ===== SESSION MODAL =====
function abrirSesionModal() {
  const body = document.getElementById('sesion-usuarios-list');
  const ROLE_COLORS = { superadmin:'#E8820C', admin:'#4f8ef7', supervisor:'#eab308', tecnico:'#10b981', empresa:'#8b5cf6' };
  let htmlStr = usuarios.filter(u => u.activo !== false).map(u => `
    <button class="sesion-user-btn ${currentSession.userId === u.id ? 'current' : ''}" onclick="cambiarUsuario('${u.id}')">
      <div class="usuario-avatar" style="background:${ROLE_COLORS[u.rol]||'var(--accent)'};">${u.nombre[0].toUpperCase()}</div>
      <div class="sesion-user-info">
        <div class="sesion-user-name">${u.nombre} ${currentSession.userId === u.id ? '✓' : ''}</div>
        <div class="sesion-user-role">${ROLES[u.rol]?.label || u.rol}</div>
      </div>
    </button>
  `).join('');
  
  htmlStr += `
    <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:1rem;">
      <button class="logout-btn" style="justify-content:center; background:var(--red-light); color:var(--red); border:1px solid var(--red);" onclick="cerrarSesion()">
        <i data-lucide="log-out" style="width:1rem; height:1rem;"></i>
        <span style="font-weight:600;">Cerrar Sesión por completo</span>
      </button>
    </div>
  `;
  body.innerHTML = htmlStr;
  document.getElementById('modal-sesion-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function cerrarSesionModal(e) {
  if (e && e.target !== document.getElementById('modal-sesion-overlay')) return;
  document.getElementById('modal-sesion-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function cambiarUsuario(userId) {
  const user = usuarios.find(u => u.id === userId);
  if (!user) return;
  currentSession = { userId, viewMode: user.rol };
  localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
  cerrarSesionModal();
  applyRole(user.rol);
  renderUsuariosList();
}

function agregarUsuario() { abrirModalUsuario(); }


function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      const viewEl = document.getElementById('view-' + view);
      
      // Cerrar sidebar en móvil
      if (window.innerWidth <= 640) {
        document.querySelector('.sidebar').classList.remove('open');
      }

      if (!viewEl) return;

      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      viewEl.classList.add('active');

      // Resetear scroll al tope al cambiar de vista
      const contentEl = document.querySelector('.content');
      if (contentEl) contentEl.scrollTop = 0;

      // Page title via data-title attribute
      document.getElementById('page-title').textContent = item.dataset.title || view;

      // Toggle action buttons
      const btnOrden = document.getElementById('btn-nueva-orden');
      const btnTicket = document.getElementById('btn-nuevo-ticket');
      const btnCliente = document.getElementById('btn-nuevo-cliente');
      const btnMaquina = document.getElementById('btn-agregar-maquina');
      
      if (btnOrden) btnOrden.style.display = 'none';
      if (btnTicket) btnTicket.style.display = 'none';
      if (btnCliente) btnCliente.style.display = 'none';
      if (btnMaquina) btnMaquina.style.display = 'none';

      const allowedToCreateClientsAndMachines = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);

      if (view === 'tickets') {
        if (btnTicket && currentSession.viewMode !== 'consulta') btnTicket.style.display = '';
      } else if (view === 'clientes') {
        if (btnCliente && allowedToCreateClientsAndMachines) btnCliente.style.display = '';
        if (btnMaquina && allowedToCreateClientsAndMachines) btnMaquina.style.display = '';
      } else if (view === 'servicios') {
        if (btnOrden && currentSession.viewMode !== 'consulta') btnOrden.style.display = '';
      }

      if (view === 'clientes') renderClientes();
      if (view === 'maquinaria') renderMaquinaria();
      if (view === 'calendario') renderCalendario();
      if (view === 'sitios') renderSitios();
      if (view === 'config') {
        renderUsuariosList();
        renderTecnicosConfig();
        renderPermisosRoles();
        cargarListaQueriesSAP();
      }
      if (view === 'servicios') { renderTabla('servicios'); renderStats(); }
      if (view === 'tickets') { renderTickets(); renderStats(); }
      if (view === 'tecnicos') {
        if (typeof renderTecnicos === 'function') renderTecnicos();
      }
      if (view === 'dashboard') {
        renderStats();
        // renderStats() ya invoca internamente a renderDashboardV2() si existe
      }
    });
  });
}

// ===== DESGLOSE DASHBOARD =====
window.abrirDesgloseDashboard = function(tipo, filtro) {
  const modal = document.getElementById('modal-dashboard-desglose');
  const title = document.getElementById('modal-dashboard-desglose-title');
  const thead = document.getElementById('tabla-dashboard-desglose-head');
  const tbody = document.getElementById('tabla-dashboard-desglose-body');
  
  if (!modal || !title || !thead || !tbody) return;
  
  thead.innerHTML = '';
  tbody.innerHTML = '';
  
  // Obtenemos los filtros base (si es cliente)
  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = null;
  if (isEmpresa && currentUser) {
    nombreEmpresaLogged = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
  }
  
  let data = [];
  
  if (tipo === 'maquinas') {
    title.textContent = "Desglose: Mis Máquinas";
    thead.innerHTML = `<tr><th>Cliente</th><th>ID / Serie</th><th>Tipo / Modelo</th><th>Ubicación</th></tr>`;
    
    // Obtener máquinas
    maquinariaDb.forEach(m => {
      const mcli = String(m.cliente || '').toLowerCase().trim();
      if (!isEmpresa || mcli === nombreEmpresaLogged) {
        data.push({ cliente: m.cliente || 'N/A', id: m.idInterno || m.serie || 'N/A', modelo: m.modelo || m.tipo || 'N/A', ubicacion: m.ubicacion || m.customData?.ubicacion || m.sitio || m.cliente || 'N/A' });
      }
    });
    clientesDb.forEach(c => {
      if (!isEmpresa || (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged)) {
        if (c.maquinas) {
          c.maquinas.forEach(m => {
            data.push({ cliente: c.nombre, id: m.idInterno || m.serie || 'N/A', modelo: m.modelo || m.tipo || 'N/A', ubicacion: m.ubicacion || m.customData?.ubicacion || m.sitio || c.nombre || 'N/A' });
          });
        }
      }
    });
    
    data.forEach(d => {
      tbody.innerHTML += `<tr><td>${d.cliente}</td><td>${d.id}</td><td>${d.modelo}</td><td>${d.ubicacion}</td></tr>`;
    });
  }
  
  else if (tipo === 'sitios') {
    title.textContent = "Desglose: Mis Sitios";
    thead.innerHTML = `<tr><th>Cliente</th><th>Nombre del Sitio</th><th>Estado</th><th>Dirección</th></tr>`;
    
    // Obtener sitios
    sitiosDb.forEach(s => {
      const scli = String(s.cliente || '').toLowerCase().trim();
      if (!isEmpresa || scli === nombreEmpresaLogged) {
        data.push({ cliente: s.cliente || 'N/A', nombre: s.nombre || 'N/A', estado: s.estado || 'N/A', direccion: s.direccion || 'N/A' });
      }
    });
    clientesDb.forEach(c => {
      if (!isEmpresa || (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged)) {
        if (c.sitios) {
          c.sitios.forEach(s => {
            data.push({ cliente: c.nombre, nombre: s.nombre || 'N/A', estado: s.estado || 'N/A', direccion: s.direccion || 'N/A' });
          });
        }
      }
    });
    
    data.forEach(d => {
      tbody.innerHTML += `<tr><td>${d.cliente}</td><td>${d.nombre}</td><td><span class="badge ${d.estado === 'Activo' ? 'badge-completado' : 'badge-pendiente'}">${d.estado}</span></td><td>${d.direccion}</td></tr>`;
    });
  }
  
  else if (tipo === 'ordenes' || tipo === 'chart_ord_tipo' || tipo === 'chart_ord_cliente' || tipo === 'chart_ord_equipo') {
    if (tipo === 'ordenes') title.textContent = filtro ? `Desglose: Órdenes - ${filtro}` : `Desglose: Total Órdenes`;
    if (tipo === 'chart_ord_tipo') title.textContent = `Desglose: Órdenes - Tipo: ${filtro}`;
    if (tipo === 'chart_ord_cliente') title.textContent = `Desglose: Órdenes - Cliente: ${filtro}`;
    if (tipo === 'chart_ord_equipo') title.textContent = `Desglose: Órdenes - Equipo: ${filtro}`;
    
    thead.innerHTML = `<tr><th>Folio</th><th>Cliente</th><th>Estado</th><th>Fecha</th></tr>`;
    
    let ordenesFiltradas = ordenes;
    if (isEmpresa && currentUser) {
      const hasEmpresa = !!(currentUser.empresa && String(currentUser.empresa).trim() !== '');
      const nombreFiltro = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
      
      ordenesFiltradas = ordenes.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        let fromTicket = false;
        if (!hasEmpresa && o.soporte) {
          const tick = tickets.find(t => t.id === o.soporte);
          if (tick) {
            const tcli = String(tick.cliente || '').toLowerCase().trim();
            const tsol = String(tick.solicitante || '').toLowerCase().trim();
            if (tcli === nombreFiltro || tsol === nombreFiltro) fromTicket = true;
          }
        }
        if (hasEmpresa) return ocli === nombreFiltro;
        return ocli === nombreFiltro || fromTicket;
      });
    }
    
    if (tipo === 'ordenes' && filtro) {
      ordenesFiltradas = ordenesFiltradas.filter(o => o.estado === filtro);
    } else if (tipo === 'chart_ord_tipo') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.tipo || 'Otro') === filtro);
    } else if (tipo === 'chart_ord_cliente') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.cliente || '') === filtro);
    } else if (tipo === 'chart_ord_equipo') {
      ordenesFiltradas = ordenesFiltradas.filter(o => (o.modelo || '') === filtro);
    }
    
    ordenesFiltradas.forEach(d => {
      const badgeClass = `badge-${(d.estado||'').toLowerCase().replace(/\s+/g,'-')}`;
      tbody.innerHTML += `<tr><td>${d.folio || 'N/A'}</td><td>${d.cliente || 'N/A'}</td><td><span class="badge ${badgeClass}">${d.estado}</span></td><td>${d.fecha ? new Date(d.fecha).toLocaleDateString() : 'N/A'}</td></tr>`;
    });
  }
  
  else if (tipo === 'tickets' || tipo === 'chart_tkt_area') {
    if (tipo === 'tickets') title.textContent = filtro ? `Desglose: Tickets - ${filtro}` : `Desglose: Total Tickets`;
    if (tipo === 'chart_tkt_area') title.textContent = `Desglose: Tickets - Área: ${filtro}`;
    
    thead.innerHTML = `<tr><th>#</th><th>Asunto</th><th>Empresa</th><th>Estado</th>${!isEmpresa ? '<th>Prioridad</th>' : ''}</tr>`;
    
    let ticketsFiltrados = tickets;
    if (isEmpresa && nombreEmpresaLogged) {
      ticketsFiltrados = tickets.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    }
    
    if (tipo === 'tickets' && filtro) {
      ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === filtro);
    } else if (tipo === 'chart_tkt_area') {
      ticketsFiltrados = ticketsFiltrados.filter(t => (t.area || 'Sin área') === filtro);
    }
    
    ticketsFiltrados.forEach(d => {
      const badgeClass = `badge-${(d.estado||'').toLowerCase()}`;
      tbody.innerHTML += `<tr><td>${d.folio || d.id.split('-')[0]}</td><td>${d.asunto || 'N/A'}</td><td>${d.cliente || d.solicitante || 'N/A'}</td><td><span class="badge ${badgeClass}">${d.estado}</span></td>${!isEmpresa ? `<td>${d.prioridad || 'Media'}</td>` : ''}</tr>`;
    });
  }
  
  else if (tipo === 'rendimiento') {
    if (filtro === 'refacciones') {
      title.textContent = `Desglose: Refacciones Faltantes`;
      thead.innerHTML = `<tr><th>Folio Orden</th><th>Cliente</th><th>Técnico</th><th>Refacciones</th></tr>`;
      ordenes.forEach(o => {
        if ((o.estado || '').toLowerCase() !== 'completado' && o.ref_necesarias && o.ref_necesarias.length > 0) {
          const refsStr = o.ref_necesarias.map(r => r.descripcion || r.clave || '').filter(Boolean).join(', ');
          tbody.innerHTML += `<tr><td>${o.folio || 'N/A'}</td><td>${o.cliente || 'N/A'}</td><td>${o.tecnico || 'N/A'}</td><td>${refsStr}</td></tr>`;
        }
      });
    } else if (filtro === 'ordenes') {
      title.textContent = `Desglose: Resolución de Órdenes`;
      thead.innerHTML = `<tr><th>Folio</th><th>Cliente</th><th>Estado</th><th>Días de Resolución</th></tr>`;
      ordenes.forEach(o => {
        if ((o.estado || '').toLowerCase() === 'completado') {
          let fCreacion = new Date(o.fecha || 0);
          let fCierre = fCreacion;
          if (o.bitacora && o.bitacora.length > 0) {
            let maxB = Math.max(...o.bitacora.map(b => new Date(b.fecha).getTime()));
            if (!isNaN(maxB)) fCierre = new Date(maxB);
          }
          let diff = fCierre.getTime() - fCreacion.getTime();
          let dias = Math.ceil(diff / (1000 * 3600 * 24));
          if (dias < 0) dias = 0;
          tbody.innerHTML += `<tr><td>${o.folio || 'N/A'}</td><td>${o.cliente || 'N/A'}</td><td><span class="badge badge-completado">Completado</span></td><td style="font-weight:600; color:var(--text-primary);">${dias} días</td></tr>`;
        }
      });
    } else if (filtro === 'tickets') {
      title.textContent = `Desglose: Resolución de Tickets`;
      thead.innerHTML = `<tr><th>#</th><th>Asunto</th><th>Estado</th><th>Días de Resolución</th></tr>`;
      tickets.forEach(t => {
        if ((t.estado || '').toLowerCase() === 'cerrado') {
          let fCreacion = new Date(t.fechaCreacion || t.created_at || new Date());
          let fCierre = new Date(t.fechaCierre || t.updated_at || t.fechaCreacion || t.created_at || new Date());
          let diff = fCierre.getTime() - fCreacion.getTime();
          let dias = Math.ceil(diff / (1000 * 3600 * 24));
          if (dias < 0) dias = 0;
          tbody.innerHTML += `<tr><td>${t.folio || t.id.split('-')[0]}</td><td>${t.asunto || 'N/A'}</td><td><span class="badge badge-cerrado">Cerrado</span></td><td style="font-weight:600; color:var(--text-primary);">${dias} días</td></tr>`;
        }
      });
    }
  }
  if (tbody.innerHTML === '') {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="text-align: center;">No hay registros para este desglose.</td></tr>`;
  }
  
  modal.classList.add('open');
};

// ===== STATS =====
function renderStats() {
  let ordenesFilter = ordenes;
  let ticketsFilter = tickets;

  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const hasEmpresa = currentUser ? !!(currentUser.empresa && String(currentUser.empresa).trim() !== '') : false;

  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      ordenesFilter = ordenes.filter(o => {
        const ocli = String(o.cliente || '').toLowerCase().trim();
        let fromTicket = false;
        if (!hasEmpresa && o.soporte) {
          const tick = tickets.find(t => t.id === o.soporte);
          if (tick) {
            const tcli = String(tick.cliente || '').toLowerCase().trim();
            const tsol = String(tick.solicitante || '').toLowerCase().trim();
            if (tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged) fromTicket = true;
          }
        }
        if (hasEmpresa) return ocli === nombreEmpresaLogged;
        return ocli === nombreEmpresaLogged || fromTicket;
      });
      ticketsFilter = tickets.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        if (hasEmpresa) return tcli === nombreEmpresaLogged;
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
      
      let countMaquinas = 0;
      maquinariaDb.forEach(m => {
        const mcli = String(m.cliente || '').toLowerCase().trim();
        if (mcli === nombreEmpresaLogged) countMaquinas++;
      });
      clientesDb.forEach(c => {
        if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
          if (c.maquinas) countMaquinas += c.maquinas.length;
        }
      });
      
      let countSitios = 0;
      sitiosDb.forEach(s => {
        const scli = String(s.cliente || '').toLowerCase().trim();
        if (scli === nombreEmpresaLogged) countSitios++;
      });
      clientesDb.forEach(c => {
        if (c.nombre && String(c.nombre).toLowerCase().trim() === nombreEmpresaLogged) {
          if (c.sitios) countSitios += c.sitios.length;
        }
      });
      
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'grid';
      
      const elMaquinas = document.getElementById('stat-cli-maquinas');
      if (elMaquinas) elMaquinas.textContent = countMaquinas;
      
      const elSitios = document.getElementById('stat-cli-sitios');
      if (elSitios) elSitios.textContent = countSitios;

    } else {
      ordenesFilter = [];
      ticketsFilter = [];
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'none';
    }
  } else {
      const elDashKpis = document.getElementById('dash-kpis-cliente');
      if (elDashKpis) elDashKpis.style.display = 'none';
  }

  const total = ordenesFilter.length;
  const proceso = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'en proceso').length;
  const pendientes = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'pendiente').length;
  const completas = ordenesFilter.filter(o => (o.estado || '').toLowerCase() === 'completado').length;
  const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setStat('stat-total', total);
  setStat('stat-proceso', proceso);
  setStat('stat-pendientes', pendientes);
  setStat('stat-completas', completas);

  if (document.getElementById('stat-serv-total')) {
    document.getElementById('stat-serv-total').textContent = total;
    document.getElementById('stat-serv-proceso').textContent = proceso;
    document.getElementById('stat-serv-pendientes').textContent = pendientes;
    document.getElementById('stat-serv-completas').textContent = completas;
  }

  // Stats Tickets
  const t_total = ticketsFilter.length;
  const t_abiertos = ticketsFilter.filter(t => t.estado === 'Abierto').length;
  const t_cotizacion = ticketsFilter.filter(t => t.estado === 'Cotización').length;
  const t_cerrados = ticketsFilter.filter(t => t.estado === 'Cerrado').length;
  const elTotalT = document.getElementById('stat-t-total');
  if (elTotalT) {
    elTotalT.textContent = t_total;
    document.getElementById('stat-t-abiertos').textContent = t_abiertos;
    document.getElementById('stat-t-cotizacion').textContent = t_cotizacion;
    document.getElementById('stat-t-cerrados').textContent = t_cerrados;
  }
  if (document.getElementById('stat-tkt-total')) {
    document.getElementById('stat-tkt-total').textContent = t_total;
    document.getElementById('stat-tkt-abiertos').textContent = t_abiertos;
    document.getElementById('stat-tkt-cotizacion').textContent = t_cotizacion;
    document.getElementById('stat-tkt-cerrados').textContent = t_cerrados;
  }
  // V2 dashboard stats
  const setV2 = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setV2('v2-stat-total', total); setV2('v2-stat-pendientes', pendientes);
  setV2('v2-stat-proceso', proceso); setV2('v2-stat-completas', completas);
  setV2('v2-stat-t-total', t_total); setV2('v2-stat-t-abiertos', t_abiertos);
  setV2('v2-stat-t-cotizacion', t_cotizacion); setV2('v2-stat-t-cerrados', t_cerrados);
  
  if (typeof renderDashboardV2 === 'function') {
    renderDashboardV2();
  }
}

// ===== DASHBOARD V2 ANALYTICS =====
let _v2Charts = {};

function renderDashboardV2() {
  // Fecha
  const el = document.getElementById('v2-fecha-hoy');
  if (el) el.textContent = new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = null;
  if (isEmpresa && currentUser) {
    nombreEmpresaLogged = String(currentUser.empresa || currentUser.nombre).toLowerCase().trim();
  }

  let ordenesDash = ordenes;
  let ticketsDash = tickets;
  let maquinariaDash = maquinariaDb;

  if (isEmpresa && nombreEmpresaLogged) {
    ordenesDash = ordenes.filter(o => {
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
    ticketsDash = tickets.filter(t => {
      const tcli = String(t.cliente || '').toLowerCase().trim();
      const tsol = String(t.solicitante || '').toLowerCase().trim();
      return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
    });
    maquinariaDash = maquinariaDb.filter(m => String(m.cliente || '').toLowerCase().trim() === nombreEmpresaLogged);

    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Sitios Activos';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Equipos Instalados';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Equipos (Mantenimientos)';
  } else {
    const rend1 = document.getElementById('v2-label-rend-1'); if (rend1) rend1.textContent = 'Refacciones Faltantes';
    const rend2 = document.getElementById('v2-label-rend-2'); if (rend2) rend2.textContent = 'Resolución Órdenes';
    const rend3 = document.getElementById('v2-label-rend-3'); if (rend3) rend3.textContent = 'Resolución Tickets';
    const chart3 = document.getElementById('v2-title-chart-3'); if (chart3) chart3.textContent = 'Top Clientes (Ordenes)';
  }

  // --- Rendimiento Global ---
  let refFaltantes = 0;
  let totalDiasOrdenes = 0;
  let countOrdenesCerradas = 0;

  ordenesDash.forEach(o => {
    const estado = (o.estado || '').toLowerCase();
    
    if (estado !== 'completado') {
      if (o.ref_necesarias && Array.isArray(o.ref_necesarias)) {
        refFaltantes += o.ref_necesarias.length;
      }
    } else {
      let fCreacion = new Date(o.fecha || 0);
      let fCierre = fCreacion;
      if (o.bitacora && o.bitacora.length > 0) {
        let maxB = Math.max(...o.bitacora.map(b => new Date(b.fecha).getTime()));
        if (!isNaN(maxB)) fCierre = new Date(maxB);
      }
      let diff = fCierre.getTime() - fCreacion.getTime();
      let dias = Math.ceil(diff / (1000 * 3600 * 24));
      if (dias < 0) dias = 0;
      totalDiasOrdenes += dias;
      countOrdenesCerradas++;
    }
  });

  let totalDiasTickets = 0;
  let countTicketsCerrados = 0;
  ticketsDash.forEach(t => {
    if ((t.estado || '').toLowerCase() === 'cerrado') {
      let fCreacion = new Date(t.fechaCreacion || t.created_at || new Date());
      let fCierre = new Date(t.fechaCierre || t.updated_at || t.fechaCreacion || t.created_at || new Date());
      let diff = fCierre.getTime() - fCreacion.getTime();
      let dias = Math.ceil(diff / (1000 * 3600 * 24));
      if (dias < 0) dias = 0;
      totalDiasTickets += dias;
      countTicketsCerrados++;
    }
  });

  const avgDiasOrdenes = countOrdenesCerradas > 0 ? Math.round(totalDiasOrdenes / countOrdenesCerradas) : 0;
  const avgDiasTickets = countTicketsCerrados > 0 ? Math.round(totalDiasTickets / countTicketsCerrados) : 0;

  const elRef = document.getElementById('v2-stat-ref-faltantes');
  if (elRef) elRef.textContent = refFaltantes;
  
  const elOrd = document.getElementById('v2-stat-avg-ordenes');
  const elTkt = document.getElementById('v2-stat-avg-tickets');
  
  const cardOrd = elOrd ? elOrd.closest('.stat-card') : null;
  const cardTkt = elTkt ? elTkt.closest('.stat-card') : null;
  const labelOrd = document.getElementById('v2-label-rend-2');
  const labelTkt = document.getElementById('v2-label-rend-3');
  const iconDivOrd = cardOrd ? cardOrd.querySelector('.stat-icon') : null;
  const iconDivTkt = cardTkt ? cardTkt.querySelector('.stat-icon') : null;
  const textOrd = cardOrd ? cardOrd.lastElementChild : null;
  const textTkt = cardTkt ? cardTkt.lastElementChild : null;
  
  if (isEmpresa && nombreEmpresaLogged) {
    const clienteObj = clientesDb.find(c => String(c.nombre || '').toLowerCase().trim() === nombreEmpresaLogged);
    const sitiosCount = clienteObj && clienteObj.sitios ? clienteObj.sitios.length : 0;
    const equiposCount = maquinariaDash.length;
    
    if (labelOrd) labelOrd.textContent = 'Sitios Activos';
    if (textOrd) textOrd.textContent = 'Registrados en el sistema';
    if (elOrd) { elOrd.textContent = sitiosCount; elOrd.style.color = '#4f8ef7'; }
    if (cardOrd) cardOrd.setAttribute('onclick', "abrirDesgloseDashboard('sitios', '')");
    if (iconDivOrd) iconDivOrd.innerHTML = '<i data-lucide="map-pin"></i>';

    if (labelTkt) labelTkt.textContent = 'Equipos Instalados';
    if (textTkt) textTkt.textContent = 'Maquinaria vinculada';
    if (elTkt) { elTkt.textContent = equiposCount; elTkt.style.color = '#8b5cf6'; }
    if (cardTkt) cardTkt.setAttribute('onclick', "abrirDesgloseDashboard('maquinas', '')");
    if (iconDivTkt) iconDivTkt.innerHTML = '<i data-lucide="settings"></i>';
  } else {
    if (labelOrd) labelOrd.textContent = 'Resolución Órdenes';
    if (textOrd) textOrd.textContent = 'Tiempo promedio (Histórico)';
    if (elOrd) { elOrd.textContent = avgDiasOrdenes + ' d'; elOrd.style.color = '#4f8ef7'; }
    if (cardOrd) cardOrd.setAttribute('onclick', "abrirDesgloseDashboard('rendimiento', 'ordenes')");
    if (iconDivOrd) iconDivOrd.innerHTML = '<i data-lucide="timer"></i>';

    if (labelTkt) labelTkt.textContent = 'Resolución Tickets';
    if (textTkt) textTkt.textContent = 'Tiempo promedio (Cerrados)';
    if (elTkt) { elTkt.textContent = countTicketsCerrados > 0 ? (avgDiasTickets + ' d') : 'N/D'; elTkt.style.color = '#8b5cf6'; }
    if (cardTkt) cardTkt.setAttribute('onclick', "abrirDesgloseDashboard('rendimiento', 'tickets')");
    if (iconDivTkt) iconDivTkt.innerHTML = '<i data-lucide="hourglass"></i>';
  }
  lucide.createIcons();

  // --- Mini tabla Órdenes (últimas 6) ---
  const miniOrd = document.getElementById('v2-mini-ordenes');
  if (miniOrd) {
    const recientes = [...ordenesDash].sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0)).slice(0,6);
    miniOrd.innerHTML = recientes.map(o => {
      const est = (o.estado||'').toLowerCase();
      const col = est==='pendiente'?'#ef4444':est==='en proceso'?'#E8820C':'#10b981';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.5rem;font-weight:600;color:var(--text-primary);">${o.folio||'-'}</td>
        <td style="padding:0.5rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.cliente||'-'}</td>
        <td style="padding:0.5rem;"><span style="font-size:0.72rem;font-weight:600;color:${col};background:${col}22;padding:0.2rem 0.5rem;border-radius:999px;">${o.estado||'-'}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="3" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin órdenes</td></tr>';
  }

  // --- Mini tabla Tickets (últimos 6) ---
  const miniTkt = document.getElementById('v2-mini-tickets');
  if (miniTkt) {
    const recientes = [...ticketsDash].sort((a,b) => new Date(b.fecha||0) - new Date(a.fecha||0)).slice(0,6);
    miniTkt.innerHTML = recientes.map(t => {
      const est = (t.estado||'').toLowerCase();
      const col = est==='abierto'?'#ef4444':est==='cerrado'?'#10b981':'#E8820C';
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.5rem;font-weight:600;color:var(--text-primary);white-space:nowrap;">${t.folio||'#'}</td>
        <td style="padding:0.5rem;color:var(--text-muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.asunto||'-'}</td>
        <td style="padding:0.5rem;"><span style="font-size:0.72rem;font-weight:600;color:${col};background:${col}22;padding:0.2rem 0.5rem;border-radius:999px;">${t.estado||'-'}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="3" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin tickets</td></tr>';
  }

  // --- Gráficas (Requiere Chart.js) ---
  if (typeof Chart === 'undefined') {
    console.warn("Chart.js no está cargado.");
    return;
  }

  try {
    const isDark = !document.body.classList.contains('light-mode');
    const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.maintainAspectRatio = false;

    const destroyChart = (id) => { if (_v2Charts[id]) { _v2Charts[id].destroy(); delete _v2Charts[id]; } };

    // Donut: Estado de Órdenes
    destroyChart('ord-estado');
    const ordPend = ordenesDash.filter(o => (o.estado||'').toLowerCase() === 'pendiente').length;
    const ordProc = ordenesDash.filter(o => (o.estado||'').toLowerCase() === 'en proceso').length;
    const ordComp = ordenesDash.filter(o => (o.estado||'').toLowerCase() === 'completado').length;
    const ordOtro = ordenesDash.length - ordPend - ordProc - ordComp;
    const ctxOE = document.getElementById('chart-ordenes-estado');
    if (ctxOE) _v2Charts['ord-estado'] = new Chart(ctxOE, {
      type: 'doughnut',
      data: { labels: ['Pendiente','En Proceso','Completado','Otro'], datasets: [{ data: [ordPend, ordProc, ordComp, ordOtro], backgroundColor: ['#ef4444','#E8820C','#10b981','#6b7280'], borderWidth: 0 }] },
      options: {
        cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } } },
        onClick: (e, els) => { if(els.length) { const l = e.chart.data.labels[els[0].index]; if(l!=='Otro') abrirDesgloseDashboard('ordenes', l); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Órdenes por Tipo
    destroyChart('ord-tipo');
    const tipoCount = {};
    ordenesDash.forEach(o => { const t = o.tipo || 'Otro'; tipoCount[t] = (tipoCount[t]||0) + 1; });
    const ctxOT = document.getElementById('chart-ordenes-tipo');
    if (ctxOT) _v2Charts['ord-tipo'] = new Chart(ctxOT, {
      type: 'bar',
      data: { labels: Object.keys(tipoCount), datasets: [{ data: Object.values(tipoCount), backgroundColor: '#4f8ef7', borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: {} }, y: { grid: { display: false } } },
        onClick: (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_tipo', e.chart.data.labels[els[0].index]); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Top 5 Clientes/Equipos por Órdenes
    destroyChart('ord-cliente');
    
    let labels3 = [];
    let data3 = [];
    let onClick3 = null;

    if (isEmpresa && nombreEmpresaLogged) {
      const maqCount = {};
      ordenesDash.forEach(o => {
        if (o.modelo) maqCount[o.modelo] = (maqCount[o.modelo]||0) + 1;
      });
      const topMaq = Object.entries(maqCount).sort((a,b) => b[1] - a[1]).slice(0,5);
      labels3 = topMaq.map(m => m[0].length > 18 ? m[0].slice(0,16)+'…' : m[0]);
      data3 = topMaq.map(m => m[1]);
      onClick3 = (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_equipo', topMaq[els[0].index][0]); } };
    } else {
      const cliCount = {};
      ordenesDash.forEach(o => { if (o.cliente) cliCount[o.cliente] = (cliCount[o.cliente]||0) + 1; });
      const topCli = Object.entries(cliCount).sort((a,b) => b[1]-a[1]).slice(0,5);
      labels3 = topCli.map(c => c[0].length > 18 ? c[0].slice(0,16)+'…' : c[0]);
      data3 = topCli.map(c => c[1]);
      onClick3 = (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_ord_cliente', topCli[els[0].index][0]); } };
    }

    const ctxOC = document.getElementById('chart-ordenes-cliente');
    if (ctxOC) _v2Charts['ord-cliente'] = new Chart(ctxOC, {
      type: 'bar',
      data: { labels: labels3, datasets: [{ data: data3, backgroundColor: ['#8b5cf6','#4f8ef7','#10b981','#E8820C','#ef4444'], borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } },
        onClick: onClick3,
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Barras: Tickets por Área
    destroyChart('tkt-area');
    const areaCount = {};
    ticketsDash.forEach(t => { const a = t.area || 'Sin área'; areaCount[a] = (areaCount[a]||0) + 1; });
    const ctxTA = document.getElementById('chart-tickets-area');
    if (ctxTA) _v2Charts['tkt-area'] = new Chart(ctxTA, {
      type: 'bar',
      data: { labels: Object.keys(areaCount), datasets: [{ data: Object.values(areaCount), backgroundColor: '#8b5cf6', borderRadius: 6, borderSkipped: false }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } },
        onClick: (e, els) => { if(els.length) { abrirDesgloseDashboard('chart_tkt_area', e.chart.data.labels[els[0].index]); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });

    // Donut: Estado de Tickets
    destroyChart('tkt-estado');
    const tktAb = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'abierto').length;
    const tktCot = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'cotización' || (t.estado||'').toLowerCase() === 'cotizacion').length;
    const tktCer = ticketsDash.filter(t => (t.estado||'').toLowerCase() === 'cerrado').length;
    const ctxTE = document.getElementById('chart-tickets-estado');
    if (ctxTE) _v2Charts['tkt-estado'] = new Chart(ctxTE, {
      type: 'doughnut',
      data: { labels: ['Abierto','Cotización','Cerrado'], datasets: [{ data: [tktAb, tktCot, tktCer], backgroundColor: ['#ef4444','#E8820C','#10b981'], borderWidth: 0 }] },
      options: {
        cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } } },
        onClick: (e, els) => { if(els.length) { abrirDesgloseDashboard('tickets', e.chart.data.labels[els[0].index]); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });
  } catch(e) {
    console.error("Error al renderizar gráficas V2:", e);
  }

  if (window.lucide) lucide.createIcons();
}

// ===== DASHBOARD TABS =====
function setDashView(tab) {
  const btnV2 = document.getElementById('btn-dash-v2');
  const btnTecnicos = document.getElementById('btn-dash-tecnicos');
  const contentV2 = document.getElementById('dash-content-v2');
  const contentTecnicos = document.getElementById('dash-content-tecnicos');

  // Reset styles
  [btnV2, btnTecnicos].forEach(btn => {
    if(!btn) return;
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text-muted)';
    btn.style.fontWeight = '500';
    btn.style.boxShadow = 'none';
  });

  // Hide all contents
  [contentV2, contentTecnicos].forEach(c => {
    if(c) c.style.display = 'none';
  });

  // Activate selected
  let activeBtn;
  if (tab === 'v2') {
    activeBtn = btnV2;
    if(contentV2) contentV2.style.display = 'block';
    renderDashboardV2();
  } else if (tab === 'tecnicos') {
    activeBtn = btnTecnicos;
    if(contentTecnicos) contentTecnicos.style.display = 'block';
    renderDashboardTecnicos();
  }

  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--bg-card)';
    activeBtn.style.color = 'var(--text-primary)';
    activeBtn.style.fontWeight = '600';
    activeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  }
}

function renderDashboardTecnicos() {
  const stats = {};
  
  // Inicializar con todos los técnicos activos
  usuarios.filter(u => u.rol === 'tecnico' || u.rol === 'admin' || u.rol === 'superadmin').forEach(u => {
    stats[u.nombre] = { nombre: u.nombre, proceso: 0, finalizadas: 0, minReportados: 0 };
  });

  // Calcular métricas desde órdenes y bitácoras
  ordenes.forEach(o => {
    let techNames = [];
    if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) techNames = o.tecnicosAsignados;
    else if (o.tecnico) techNames = o.tecnico.split(',').map(s => s.trim());

    techNames.forEach(tName => {
      if (!stats[tName]) stats[tName] = { nombre: tName, proceso: 0, finalizadas: 0, minReportados: 0 };
      if (o.estado === 'Finalizado') stats[tName].finalizadas++;
      else stats[tName].proceso++;
    });

    if (o.bitacora && o.bitacora.length > 0) {
      o.bitacora.forEach(b => {
        const tName = b.tecnico;
        if (tName && b.entrada && b.salida) {
          if (!stats[tName]) stats[tName] = { nombre: tName, proceso: 0, finalizadas: 0, minReportados: 0 };
          const [hE, mE] = b.entrada.split(':').map(Number);
          const [hS, mS] = b.salida.split(':').map(Number);
          let diff = (hS * 60 + mS) - (hE * 60 + mE);
          if (diff < 0) diff += 24 * 60;
          stats[tName].minReportados += diff;
        }
      });
    }
  });

  const list = Object.values(stats)
    .filter(s => s.proceso > 0 || s.finalizadas > 0 || s.minReportados > 0)
    .sort((a,b) => b.minReportados - a.minReportados || b.finalizadas - a.finalizadas);

  const totalHoras = list.reduce((sum, s) => sum + s.minReportados, 0);
  const topTech = list.length > 0 ? list[0].nombre : 'N/A';

  const kpisHtml = `
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:#10b981;"><i data-lucide="award"></i></div>
      <div>
        <div class="stat-label">Técnico Destacado</div>
        <div class="stat-value" style="font-size:1.2rem;">${topTech}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(79,142,247,0.12);color:#4f8ef7;"><i data-lucide="clock"></i></div>
      <div>
        <div class="stat-label">Total Horas Reportadas (Global)</div>
        <div class="stat-value">${Math.floor(totalHoras / 60)}h ${totalHoras % 60}m</div>
      </div>
    </div>
  `;
  document.getElementById('tecnicos-kpis-grid').innerHTML = kpisHtml;

  const tbody = document.getElementById('tecnicos-stats-body');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay datos registrados aún</td></tr>';
  } else {
    tbody.innerHTML = list.map(s => {
      const hrs = Math.floor(s.minReportados / 60);
      const mns = s.minReportados % 60;
      return `
        <tr>
          <td><div style="display:flex;align-items:center;gap:0.75rem;"><div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:bold;">${s.nombre.charAt(0).toUpperCase()}</div><span style="font-weight:600;color:var(--text-primary);">${s.nombre}</span></div></td>
          <td style="text-align:center;"><span class="badge badge-pendiente" style="padding:0.3rem 0.6rem;">${s.proceso}</span></td>
          <td style="text-align:center;"><span class="badge badge-finalizado" style="padding:0.3rem 0.6rem;">${s.finalizadas}</span></td>
          <td style="text-align:center;font-weight:700;color:var(--accent); font-size:1.05rem;">${hrs}h ${mns > 0 ? mns + 'm' : ''}</td>
        </tr>
      `;
    }).join('');
  }
  if (window.lucide) window.lucide.createIcons();
}

// ===== TABLE =====

let filtroEstadoServicios = '';
function setFiltroEstadoServicios(estado) {
  filtroEstadoServicios = estado;
  filtrarOrdenes('servicios');
  renderTabla('v2');
}

let filtroTicketsV2 = 'todos';
function setFiltroTicketsV2(estado) {
  filtroTicketsV2 = estado;
  renderTickets('v2');
}

function toggleSortOrdenes(col) {
  if (currentOrdSortCol === col) {
    currentOrdSortDir = currentOrdSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentOrdSortCol = col;
    currentOrdSortDir = 'asc';
  }
  filtrarOrdenes('servicios');
  filtrarOrdenes();
}

function renderTabla(ctx) {
  const isServiciosView = ctx === 'servicios';
  const isV2 = ctx === 'v2';
  const bodyId = isServiciosView ? 'tabla-body-servicios' : (isV2 ? 'v2-tabla-body' : 'tabla-body');
  const searchId = isServiciosView ? 'search-servicios' : (isV2 ? 'v2-search-ordenes' : 'search-input');
  const q = (document.getElementById(searchId)?.value || '').toLowerCase();
  
  let filtradas = ordenes.filter(o =>
    !q ||
    (o.cliente||'').toLowerCase().includes(q) ||
    (o.tecnico||'').toLowerCase().includes(q) ||
    (o.folio||'').toLowerCase().includes(q) ||
    (o.ubicacion||'').toLowerCase().includes(q)
  );

  if (isServiciosView && filtroEstadoServicios) {
    filtradas = filtradas.filter(o => (o.estado || '').toLowerCase() === filtroEstadoServicios.toLowerCase());
  }

  let tecFilter = document.getElementById('filter-ord-tecnico')?.value;
  let supFilter = document.getElementById('filter-ord-supervisor')?.value;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtradas = filtradas.filter(o => {
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
    } else {
      filtradas = [];
    }
  }

  if (currentUser) {
     if (currentUser.rol === 'tecnico') tecFilter = currentUser.nombre;
     if (currentUser.rol === 'supervisor') supFilter = currentUser.nombre;
  }
  
  if (tecFilter || supFilter) {
    const tecName = tecFilter;
    
    filtradas = filtradas.filter(o => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecName) {
         let assigned = [];
         if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados;
         else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
         let isCreator = false;
         let isTkAssigned = false;
         if (o.creadoPor === tecName) isCreator = true;
         if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
               if (tk.solicitante === tecName || tk.creadoPor === tecName) isCreator = true;
               let tkAssigned = [];
               if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados;
               else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
               if (tkAssigned.includes(tecName)) isTkAssigned = true;
            }
         }
         passTec = assigned.includes(tecName) || isCreator || isTkAssigned;
      }
      
      if (supFilter) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === o.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u.nombre === supFilter || u.id === supFilter);
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (cli.supervisorAsignado === supFilter);
         }
         
         let assigned = [];
         if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) assigned = o.tecnicosAsignados;
         else if (o.tecnico) assigned = o.tecnico.split(',').map(s=>s.trim());
         
         let passSupTicket = assigned.includes(supFilter);
         let isCreator = false;
         if (o.creadoPor === supFilter) isCreator = true;
         if (o.soporte) {
            const tk = tickets.find(x => x.id === o.soporte);
            if (tk) {
               if (tk.solicitante === supFilter || tk.creadoPor === supFilter) isCreator = true;
               let tkAssigned = [];
               if (tk.tecnicosAsignados && tk.tecnicosAsignados.length > 0) tkAssigned = tk.tecnicosAsignados;
               else if (tk.asignado && tk.asignado !== 'Sin asignar') tkAssigned = String(tk.asignado).split(',').map(s=>s.trim());
               if (tkAssigned.includes(supFilter)) passSupTicket = true;
            }
         }
         passSup = passSupClient || passSupTicket || isCreator;
      }
      
      return passTec && passSup;
    });
  }

  // ORDENAMIENTO
  if (currentOrdSortCol !== 'reciente') {
    filtradas.sort((a, b) => {
      let valA = a[currentOrdSortCol] || '';
      let valB = b[currentOrdSortCol] || '';
      
      if (currentOrdSortCol === 'id') {
        const numA = parseInt(valA.replace(/\D/g, '')) || 0;
        const numB = parseInt(valB.replace(/\D/g, '')) || 0;
        return currentOrdSortDir === 'asc' ? numA - numB : numB - numA;
      } else if (currentOrdSortCol === 'fecha') {
        const dateA = new Date(valA).getTime() || 0;
        const dateB = new Date(valB).getTime() || 0;
        return currentOrdSortDir === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentOrdSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentOrdSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  } else {
    // Ordenamiento por defecto (recientes primero)
    filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  // Actualizar iconos de ordenamiento
  ['id', 'cliente', 'ubicacion', 'modelo', 'tecnico', 'tipo', 'estado', 'fecha'].forEach(col => {
    const icon = document.getElementById('sort-icon-ord-' + col);
    if (icon) {
      const isCurrent = currentOrdSortCol === col;
      const iconName = isCurrent ? (currentOrdSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-ord-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  const body = document.getElementById(bodyId);
  if (!body) return;
  if (!filtradas.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state">No hay órdenes${q ? ' que coincidan' : ' registradas'}.</td></tr>`;
    return;
  }
  const isConsulta = currentSession.viewMode === 'consulta';
  const isTecnico = currentSession.viewMode === 'tecnico';
  const canEdit = !isConsulta && !isTecnico && !isEmpresa;
  const canDelete = ['superadmin', 'admin'].includes(currentSession.viewMode);

  body.innerHTML = filtradas.map(o => {
    let orderCanEdit = canEdit;
    if (o.firma_tecnico_base64 && !['superadmin', 'admin'].includes(currentSession.viewMode)) {
      orderCanEdit = false;
    }
    return `
    <tr>
      <td data-label="Acciones" style="white-space:nowrap; width:60px;">
        <div style="display:flex;gap:0.25rem;">
          <button class="action-btn" onclick="verDetalle('${o.id}')" title="Ver"><i data-lucide="eye"></i></button>
          ${orderCanEdit ? `<button class="action-btn" onclick="editarOrden('${o.id}')" title="Editar"><i data-lucide="pencil"></i></button>` : ''}
        </div>
      </td>
      <td data-label="Folio"><strong>${o.folio||'-'}</strong></td>
      <td data-label="Cliente">${o.cliente||'-'}</td>
      <td data-label="Ubicación">${o.ubicacion||'-'}</td>
      <td data-label="Modelo">${o.modelo||'-'}</td>

      <td data-label="Tipo"><span class="badge badge-${(o.tipo||'otro').toLowerCase().replace('é','e').replace('í','i')}">${o.tipo||'-'}</span></td>
      <td data-label="Estado"><span class="badge ${badgeEstado(o.estado)}">${o.estado||'-'}</span></td>
      <td data-label="Fecha">${o.fecha ? o.fecha.split('T')[0] : '-'}</td>
      <td data-label="" style="width:40px; text-align:center;">
        ${canDelete ? `<button class="action-btn del" onclick="eliminarOrden('${o.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
      </td>
    </tr>
    `;
  }).join('');
  if (!ctx) renderStats();
  lucide.createIcons();
}

function badgeEstado(estado) {
  if (estado === 'En Proceso') return 'badge-proceso';
  if (estado === 'Completado') return 'badge-completado';
  return 'badge-pendiente';
}

function filtrarOrdenes(ctx) { renderTabla(ctx); }

let hasSyncedSAPThisSession = false;

// ===== SINCRONIZACIÓN SAP =====
async function forzarSincronizacionSAP() {
  if (isSincronizandoSAP) return;
  
  const icons = document.querySelectorAll('.icon-sync-sap');
  icons.forEach(i => i.classList.add('rotating'));
  isSincronizandoSAP = true;
  
  try {
    const newDataCli = await fetchClientesSAP();
    if (newDataCli) {
      newDataCli.forEach(newCli => {
        const oldCli = clientesDb.find(c => c.nombre === newCli.nombre || c.id === newCli.id);
        if (oldCli) {
          if (oldCli.maquinas) newCli.maquinas = oldCli.maquinas;
          if (oldCli.sitios) newCli.sitios = oldCli.sitios;
          if (oldCli.contactos) newCli.contactos = oldCli.contactos;
          if (oldCli.logo) newCli.logo = oldCli.logo;
        }
      });
      clientesDb.forEach(oldCli => {
        if (!newDataCli.some(nc => nc.nombre === oldCli.nombre || nc.id === oldCli.id)) {
          newDataCli.push(oldCli);
        }
      });
      clientesDb = newDataCli;
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      // ── Guardar en Supabase como caché ──
      if (window.pushToSupabase) {
        for (const c of clientesDb) window.pushToSupabase('clientes', c);
      }
      hasSyncedSAPThisSession = true;
    } else {
        mostrarNotificacion('⚠️ Fallo al sincronizar clientes con SAP.', 'error');
    }

    const newDataRef = await fetchRefaccionesSAP();
    if (newDataRef && newDataRef.length > 0) {
      refaccionesDb = newDataRef;
      localStorage.setItem('sapi_refacciones_db', JSON.stringify(refaccionesDb));
      // ── Guardar en Supabase como caché ──
      if (window.pushToSupabase) {
        for (const r of refaccionesDb) {
          if (r.id) window.pushToSupabase('refacciones', r);
        }
      }
    }
    
    const newDataTec = await fetchTecnicosSAP();
    if (newDataTec && newDataTec.length > 0) {
      tecnicosDb = newDataTec;
      localStorage.setItem('sapi_tecnicos_db', JSON.stringify(tecnicosDb));
      let allUsers = JSON.parse(localStorage.getItem('eurorep_usuarios') || '[]');
      let usersChanged = false;
      tecnicosDb.forEach(t => {
        if (!t.nombre || t.nombre === 'Sin Nombre') return;
        const nombreCompleto = t.nombre.trim();
        const rawRole = (t.tipoUsuario || '').toLowerCase().trim();
        let mappedRole = 'tecnico';
        if (rawRole.includes('consulta')) mappedRole = 'consulta';
        else if (rawRole.includes('supervisor')) mappedRole = 'supervisor';
        const existe = allUsers.find(u => u.nombre === nombreCompleto || (u.email && u.email.includes(nombreCompleto.toLowerCase().replace(/\s+/g, ''))));
        if (!existe) {
          allUsers.push({ id: crypto.randomUUID(), nombre: nombreCompleto, email: nombreCompleto.toLowerCase().replace(/\s+/g, '') + '@eurorep.mx', pin: '0000', rol: mappedRole, activo: true, locked: false });
          usersChanged = true;
        } else {
          if (existe.rol !== mappedRole && ['tecnico', 'supervisor', 'consulta'].includes(existe.rol)) { existe.rol = mappedRole; usersChanged = true; }
          if (existe.email && existe.email.includes('@eurorep.com')) { existe.email = existe.email.replace('@eurorep.com', '@eurorep.mx'); usersChanged = true; }
        }
      });
      if (usersChanged) {
        localStorage.setItem('eurorep_usuarios', JSON.stringify(allUsers));
        usuarios = allUsers;
        if (window.pushToSupabase) allUsers.forEach(u => window.pushToSupabase('usuarios', u));
      }
    }
    
    const newDataSitios = await fetchSitiosSAP();
    if (newDataSitios && newDataSitios.length > 0) {
      sitiosDb = newDataSitios;
      localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
      if (window.pushToSupabase) {
        for (const s of sitiosDb) if (s.id) window.pushToSupabase('sitios', s);
      }
    }
    
    const newDataMaquinaria = await fetchMaquinariaSAP();
    if (newDataMaquinaria && newDataMaquinaria.length > 0) {
      maquinariaDb = newDataMaquinaria;
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
      if (window.pushToSupabase) {
        for (const m of maquinariaDb) if (m.id) window.pushToSupabase('maquinaria', m);
      }
    }
    
    mostrarNotificacion('✅ Catálogos sincronizados con SAP y guardados en la nube.', 'success');
  } catch (error) {
    console.error("Error SAP:", error);
    mostrarNotificacion('⚠️ Error al conectar con SAP B1. Usando caché de Supabase.', 'error');
  } finally {
    isSincronizandoSAP = false;
    icons.forEach(i => i.classList.remove('rotating'));
    renderClientes();
    renderRefacciones();
    if (typeof renderTecnicos === 'function') renderTecnicos();
    if (typeof renderSitios === 'function') renderSitios();
    if (typeof renderMaquinaria === 'function') renderMaquinaria();
    if (typeof renderUsuariosList === 'function') renderUsuariosList();
  }
}

// ── Sincronización individual por módulo ──────────────────────────────────────
const _syncingModules = {};
async function sincronizarModuloSAP(modulo, btnEl) {
  if (_syncingModules[modulo]) return;
  _syncingModules[modulo] = true;
  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Sincronizando SAP...'; lucide.createIcons(); }

  // ── Intentar primero con el backend local (Cloudflare Tunnel) ────────────
  // El backend local SÍ puede llegar a SAP; Render no puede por firewall.
  const localUrl = API_CONFIG.LOCAL_URL;
  if (localUrl) {
    try {
      mostrarNotificacion(`⏳ Conectando a SAP vía servidor local...`, 'info');
      const resp = await fetch(`${localUrl}/sync-all?modulo=${modulo}`, { signal: AbortSignal.timeout(90000) });
      if (resp.ok) {
        const result = await resp.json();
        // Recargar datos frescos desde Supabase (el servidor ya los guardó ahí)
        if (window.cargarDatosDeSupabase) await window.cargarDatosDeSupabase();
        const total = result[modulo] || 0;
        mostrarNotificacion(`✅ ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}: ${total} registros actualizados desde SAP.`, 'success');
        _syncingModules[modulo] = false;
        if (btnEl) { btnEl.innerHTML = origHTML; lucide.createIcons(); }
        return;
      }
    } catch (localErr) {
      console.warn('Backend local no disponible, usando método directo:', localErr.message);
    }
  }

  try {
    if (modulo === 'clientes') {
      const data = await fetchClientesSAP();
      if (data && data.length > 0) {
        data.forEach(nc => {
          const old = clientesDb.find(c => c.id === nc.id || c.nombre === nc.nombre);
          if (old) { if (old.maquinas) nc.maquinas = old.maquinas; if (old.logo) nc.logo = old.logo; }
        });
        clientesDb.forEach(old => { if (!data.some(nc => nc.id === old.id || nc.nombre === old.nombre)) data.push(old); });
        clientesDb = data;
        localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
        if (window.pushToSupabase) for (const c of clientesDb) window.pushToSupabase('clientes', c);
        renderClientes();
        mostrarNotificacion(`✅ Clientes actualizados (${data.length} registros) y guardados en la nube.`, 'success');
      } else if (data === null) {
        // fetchClientesSAP returned null due to an error, UI already showed warning.
      }
    } else if (modulo === 'refacciones') {
      const data = await fetchRefaccionesSAP();
      if (data && data.length > 0) {
        refaccionesDb = data;
        localStorage.setItem('sapi_refacciones_db', JSON.stringify(refaccionesDb));
        if (window.pushToSupabase) for (const r of refaccionesDb) if (r.id) window.pushToSupabase('refacciones', r);
        renderRefacciones();
        mostrarNotificacion(`✅ Refacciones actualizadas (${data.length} registros) y guardadas en la nube.`, 'success');
      }
    } else if (modulo === 'maquinaria') {
      const data = await fetchMaquinariaSAP();
      if (data && data.length > 0) {
        maquinariaDb = data;
        localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
        if (window.pushToSupabase) for (const m of maquinariaDb) if (m.id) window.pushToSupabase('maquinaria', m);
        if (typeof renderMaquinaria === 'function') renderMaquinaria();
        mostrarNotificacion(`✅ Maquinaria actualizada (${data.length} registros) y guardada en la nube.`, 'success');
      }
    } else if (modulo === 'sitios') {
      const data = await fetchSitiosSAP();
      if (data && data.length > 0) {
        sitiosDb = data;
        localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
        if (window.pushToSupabase) for (const s of sitiosDb) if (s.id) window.pushToSupabase('sitios', s);
        if (typeof renderSitios === 'function') renderSitios();
        mostrarNotificacion(`✅ Sitios actualizados (${data.length} registros) y guardados en la nube.`, 'success');
      }
    } else if (modulo === 'tecnicos') {
      const data = await fetchTecnicosSAP();
      if (data && data.length > 0) {
        tecnicosDb = data;
        localStorage.setItem('sapi_tecnicos_db', JSON.stringify(tecnicosDb));
        if (typeof renderUsuariosList === 'function') renderUsuariosList();
        mostrarNotificacion(`✅ Técnicos actualizados (${data.length} registros).`, 'success');
      }
    }
  } catch (err) {
    mostrarNotificacion(`⚠️ No se pudo actualizar ${modulo} desde SAP. Usando caché de Supabase.`, 'error');
  } finally {
    _syncingModules[modulo] = false;
    if (btnEl) { btnEl.innerHTML = origHTML; lucide.createIcons(); }
  }
}



async function fetchTecnicosSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return tecnicosDb;
  
  try {
    const url = `${API_CONFIG.BASE_URL}/tecnicos?_t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return tecnicosDb;
    const sapData = await response.json();
    
    // Mapear la respuesta de SAP (Esperamos Memo, SlpCode, SlpName, TipoUsuario, Celular desde nuestro backend)
    const tecnicosMapeados = sapData.map(t => ({
      id: t.SlpCode || '',
      nombre: t.SlpName || 'Sin Nombre',
      memo: t.Memo || '',
      tipoUsuario: t.TipoUsuario || '',
      celular: t.Celular || ''
    }));
    return tecnicosMapeados;
  } catch (err) {
    console.error("Error fetchTecnicosSAP:", err);
    return tecnicosDb;
  }
}

async function fetchSitiosSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return sitiosDb;
  if (!configData || !configData.querySitios) return sitiosDb;
  
  try {
    const queryCode = encodeURIComponent(configData.querySitios);
    const url = `${API_CONFIG.BASE_URL}/sap/queries/${queryCode}/execute?_t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return sitiosDb;
    const jsonRes = await response.json();
    const sapData = jsonRes.data || (Array.isArray(jsonRes) ? jsonRes : []);
    
    const map = (configData.mappings && configData.mappings.sitios) ? configData.mappings.sitios : {
      id: 'Address', nombre: 'Street', cliente: 'BPCode', direccion: 'Block', cp: 'ZipCode', ciudad: 'City'
    };
    
    const sitiosMapeados = sapData.map(s => {
      const sitioObj = {
        id: s[map.id] || s.Address || s.AddressName || '',
        nombre: s[map.nombre] || s.AddressName || s.Street || s.Address || 'Sitio Sin Nombre',
        cliente: s[map.clienteId || map.cliente] || s.BPCode || s.CardCode || s.Cliente || s.CardName || '',
        direccion: s[map.direccion] || s.Block || s.Street || '',
        cp: s[map.cp] || s.ZipCode || '',
        ciudad: s[map.ciudad] || s.City || ''
      };
      if (map.customCols && map.customCols.length > 0) {
        sitioObj.customData = {};
        map.customCols.forEach(col => {
          sitioObj.customData[col.label] = s[col.key] || '';
        });
      }
      return sitioObj;
    });
    return sitiosMapeados;
  } catch (err) {
    console.error("Error fetchSitiosSAP:", err);
    return sitiosDb;
  }
}

async function fetchMaquinariaSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return maquinariaDb;
  if (!configData || !configData.queryMaquinaria) return maquinariaDb;
  
  try {
    const queryCode = encodeURIComponent(configData.queryMaquinaria);
    const url = `${API_CONFIG.BASE_URL}/sap/queries/${queryCode}/execute?_t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return maquinariaDb;
    const jsonRes = await response.json();
    const sapData = jsonRes.data || (Array.isArray(jsonRes) ? jsonRes : []);
    
    const map = (configData.mappings && configData.mappings.maquinaria) ? configData.mappings.maquinaria : {
      id: 'ManufacturerSerialNum', itemcode: 'ItemCode', desc: 'ItemDescription', cliente: 'CustomerCode'
    };
    
    const maquinariaMapeada = sapData.map(m => {
      const maqObj = {
        serie: m[map.id] || '',
        marca: '', // SAP no suele tener un campo "Marca" directo en la tarjeta, o se mapea a otro
        modelo: m[map.itemcode] || '',
        anio: '',
        cliente: m[map.cliente] || '',
        idInterno: m[map.itemcode] || '',
        descripcion: m[map.desc] || ''
      };
      if (map.customCols && map.customCols.length > 0) {
        maqObj.customData = {};
        map.customCols.forEach(col => {
          maqObj.customData[col.label] = m[col.key] || '';
        });
      }
      return maqObj;
    });
    return maquinariaMapeada;
  } catch (err) {
    console.error("Error fetchMaquinariaSAP:", err);
    return maquinariaDb;
  }
}

// Actualizar un cliente específico desde la vista de detalle
let currentViewClientName = '';
async function sincronizarUnCliente() {
  if (!currentViewClientName) return;
  const icon = document.getElementById('icon-sync-single');
  if (icon) icon.classList.add('rotating');
  
  try {
    const newData = await fetchClientesSAP();
    if (newData && newData.length > 0) {
      clientesDb = newData;
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      mostrarNotificacion('Datos del cliente actualizados desde SAP.', 'success');
      verDetalleCliente(currentViewClientName); // Refrescar el modal
      renderClientes(); // Refrescar grid de fondo
    } else if (newData === null) {
      // Failed. Warning is already displayed by fetchClientesSAP.
    }
  } catch (error) {
    console.error("Error SAP single:", error);
    mostrarNotificacion('Error al actualizar desde SAP B1.', 'error');
  } finally {
    if (icon) icon.classList.remove('rotating');
  }
}
// ===== CLIENTES =====
let currentCliView = 'galeria';

function setCliView(view) {
  currentCliView = view;
  document.getElementById('btn-cli-galeria').style.background = view === 'galeria' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-cli-galeria').style.color = view === 'galeria' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-cli-galeria').style.borderColor = view === 'galeria' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('btn-cli-lista').style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-cli-lista').style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-cli-lista').style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('clientes-grid').style.display = view === 'galeria' ? 'grid' : 'none';
  document.getElementById('clientes-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
}

// ==========================================
// DESGLOSE SAP (ÓRDENES ABIERTAS)
// ==========================================
async function abrirDesgloseSAP(cardCode, cardName) {
  if(!cardCode || cardCode === 'N/A') return;
  
  const modal = document.getElementById('modal-desglose-sap');
  const tbody = document.getElementById('desglose-sap-tbody');
  const title = document.getElementById('desglose-sap-title');
  const totalSpan = document.getElementById('desglose-sap-total');
  
  if(!modal || !tbody) return;
  
  title.textContent = `Saldo pedido cliente: ${cardCode} - ${cardName}`;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><div class="spinner"></div><p style="margin-top:1rem; color:var(--text-muted);">Consultando SAP SBO_SAPI...</p></td></tr>`;
  totalSpan.textContent = '$0.00';
  modal.style.display = 'flex';
  
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/clientes/${cardCode}/ordenes`);
    if(!res.ok) throw new Error('Error en SAP');
    const rawData = await res.json();
    
    // Calcular Open Amount en base a las líneas del documento
    currentDesgloseData = rawData.map(ord => {
      let openAmount = 0;
      if (ord.DocumentLines && Array.isArray(ord.DocumentLines)) {
        openAmount = ord.DocumentLines.reduce((sum, line) => {
          const lineOpen = line.OpenAmount || 0;
          const lineTotal = line.LineTotal || 1;
          const lineGross = line.GrossTotal || line.LineTotal || 0;
          return sum + ((lineOpen / lineTotal) * lineGross);
        }, 0);
      }
      ord.computedOpenAmount = openAmount > 0 ? openAmount : (ord.DocTotal || 0);
      return ord;
    });
    
    // Default sort parameters
    currentDesgSortCol = 'fecha';
    currentDesgSortDir = 'asc';
    
    renderDesgloseSAP();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--red);">Error al conectar con SAP. Por favor intenta de nuevo.</td></tr>`;
  }
}

function toggleSortDesglose(col) {
  if (currentDesgSortCol === col) {
    currentDesgSortDir = currentDesgSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentDesgSortCol = col;
    currentDesgSortDir = 'asc';
  }
  renderDesgloseSAP();
}

function renderDesgloseSAP() {
  const tbody = document.getElementById('desglose-sap-tbody');
  const totalSpan = document.getElementById('desglose-sap-total');
  
  if(currentDesgloseData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:var(--text-muted);">No hay órdenes abiertas para este cliente.</td></tr>`;
    return;
  }
  
  // Clonar para no mutar el array original (necesario para el orden default / saldo acumulado base)
  let filtrados = [...currentDesgloseData];
  
  // ORDENAMIENTO
  filtrados.sort((a, b) => {
    let valA, valB;
    if (currentDesgSortCol === 'docNum') {
      valA = parseInt(a.DocNum) || 0;
      valB = parseInt(b.DocNum) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'importe') {
      valA = parseFloat(a.DocTotal) || 0;
      valB = parseFloat(b.DocTotal) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'openAmount') {
      valA = parseFloat(a.computedOpenAmount) || 0;
      valB = parseFloat(b.computedOpenAmount) || 0;
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else if (currentDesgSortCol === 'fecha') {
      valA = new Date(a.DocDate || 0).getTime();
      valB = new Date(b.DocDate || 0).getTime();
      return currentDesgSortDir === 'asc' ? valA - valB : valB - valA;
    } else {
      valA = (a.Comments || '').toLowerCase();
      valB = (b.Comments || '').toLowerCase();
      if (valA < valB) return currentDesgSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return currentDesgSortDir === 'asc' ? 1 : -1;
      return 0;
    }
  });

  // Actualizar iconos de ordenamiento
  ['fecha', 'docNum', 'comments', 'importe', 'openAmount'].forEach(col => {
    const icon = document.getElementById('sort-icon-desg-' + col);
    if (icon) {
      const isCurrent = currentDesgSortCol === col;
      const iconName = isCurrent ? (currentDesgSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-desg-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  let saldoAcumulado = 0;
  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  const formatDate = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  tbody.innerHTML = filtrados.map(ord => {
    const importe = ord.DocTotal || 0;
    const saldoPendiente = ord.computedOpenAmount || 0;
    saldoAcumulado += saldoPendiente;
    return `
      <tr>
        <td>${formatDate(ord.DocDate)}</td>
        <td style="font-weight:600; color:var(--text-primary);">${ord.DocNum}</td>
        <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${ord.Comments || ''}">${ord.Comments || '-'}</td>
        <td style="text-align:right;">${formatMoney(importe)}</td>
        <td style="text-align:right; font-weight:600;">${formatMoney(saldoPendiente)}</td>
        <td style="text-align:right; font-weight:600; color:var(--accent);">${formatMoney(saldoAcumulado)}</td>
      </tr>
    `;
  }).join('');
  
  totalSpan.textContent = formatMoney(saldoAcumulado);
  
  if(window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }
}
function cerrarDesgloseSAP() {
  const modal = document.getElementById('modal-desglose-sap');
  if(modal) modal.style.display = 'none';
}

function toggleSortClientes(col) {
  if (currentCliSortCol === col) {
    currentCliSortDir = currentCliSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentCliSortCol = col;
    currentCliSortDir = 'asc';
  }
  renderClientes();
}

function renderClientes() {
  const grid = document.getElementById('clientes-grid');
  const tbody = document.getElementById('clientes-table-body');
  const paginationContainer = document.getElementById('clientes-pagination');
  
  // Eliminado el auto-sync bloqueante. Cargamos directamente la caché local.
  // Combina clientes legacy (de las órdenes) con clientes registrados
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente) {
      if (!legacyMap.has(o.cliente)) {
        legacyMap.set(o.cliente, { nombre: o.cliente, ubicacion: o.ubicacion, legacy: true });
      }
    }
  });

  const mergedClientes = [...clientesDb];
  
  // Incluir usuarios que son empresas o clientes, agrupándolos por su empresa
  usuarios.forEach(u => {
    if (u.rol === 'empresa' || u.rol === 'cliente') {
      const nomEmpresa = u.empresa || u.nombre; // Fallback for old users
      if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (nomEmpresa || '').toLowerCase())) {
        mergedClientes.push({ nombre: nomEmpresa, id: u.id, ubicacion: 'Usuario registrado' });
      }
    }
  });

  legacyMap.forEach((legacyClient) => {
    if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (legacyClient.nombre || '').toLowerCase())) {
      mergedClientes.push(legacyClient);
    }
  });

  const searchText = (document.getElementById('busqueda-cliente')?.value || '').toLowerCase().trim();
  let filtrados = mergedClientes;
  
  if (searchText) {
    filtrados = filtrados.filter(c => 
      (c.nombre || '').toLowerCase().includes(searchText) || 
      (c.rfc || '').toLowerCase().includes(searchText) ||
      (c.email && c.email.toLowerCase().includes(searchText))
    );
  }

  if (!filtrados.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">No se encontraron clientes.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="padding:2rem;">No se encontraron clientes.</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  
  // ORDENAMIENTO
  if (currentCliSortCol !== 'reciente') {
    filtrados.sort((a, b) => {
      let valA = a[currentCliSortCol] || '';
      let valB = b[currentCliSortCol] || '';
      
      if (currentCliSortCol === 'saldoCuenta' || currentCliSortCol === 'saldoOrdenes') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return currentCliSortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentCliSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentCliSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }
  
  // Actualizar iconos de ordenamiento
  ['id', 'nombre', 'rfc', 'contacto', 'email', 'telefono', 'grupoSinergia', 'saldoCuenta', 'saldoOrdenes'].forEach(col => {
    const icon = document.getElementById('sort-icon-cli-' + col);
    if (icon) {
      const isCurrent = currentCliSortCol === col;
      const iconName = isCurrent ? (currentCliSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-cli-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });
  
  // Asegurarnos de que lucide actualice los nuevos iconos inyectados
  if(window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }

  // PAGINACIÓN
  const totalPages = Math.ceil(filtrados.length / CLIENTES_PER_PAGE);
  if (currentPageClientes > totalPages) currentPageClientes = totalPages;
  if (currentPageClientes < 1) currentPageClientes = 1;
  
  const startIndex = (currentPageClientes - 1) * CLIENTES_PER_PAGE;
  const paginatedClientes = filtrados.slice(startIndex, startIndex + CLIENTES_PER_PAGE);
  
  // RENDERIZAR CABECERAS PERSONALIZADAS
  const trHeader = document.querySelector('#clientes .data-table thead tr');
  if (trHeader) {
    trHeader.querySelectorAll('.custom-th').forEach(el => el.remove());
    if (configData.mappings?.clientes?.customCols) {
      configData.mappings.clientes.customCols.forEach(col => {
        const th = document.createElement('th');
        th.className = 'custom-th';
        th.textContent = col.label;
        // Insert before the last column (Maquinaria/Acciones) if we want, or just append
        trHeader.insertBefore(th, trHeader.lastElementChild);
      });
    }
  }

  // RENDERIZAR CUADRÍCULA
  grid.innerHTML = paginatedClientes.map(c => {
    const qtyOrdenes = ordenes.filter(x => x.cliente === c.nombre).length;
    
    // Contar máquinas combinadas (SAP + manuales)
    const maqClient = maquinariaDb.filter(m => m.cliente === c.nombre || m.cliente === c.id || m.cliente === c.rfc);
    let totalMaquinas = maqClient.length;
    (c.maquinas || []).forEach(m => {
       if (!maqClient.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno)) {
           totalMaquinas++;
       }
    });

    let maquinasText = '';
    if (totalMaquinas > 0) {
      maquinasText = `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;"><i data-lucide="settings-2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:0.2rem;"></i> ${totalMaquinas} máquina(s)</div>`;
    }
    
    // Formatear moneda (SAP)
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    
    return `
      <div class="card-person" style="cursor:pointer;" onclick="verDetalleCliente(this.dataset.nombre)" data-nombre="${(c.nombre || 'Sin nombre').replace(/"/g, '&quot;')}">
        <div class="card-person-name" style="font-weight:700; margin-bottom: 0.2rem;">${c.nombre || 'Sin nombre'}</div>
        ${c.id && c.id !== 'Usuario registrado' ? `<div style="font-size:0.72rem; color:var(--accent); font-weight:600; margin-bottom:0.4rem;">${c.id} ${c.rfc && c.rfc !== 'Genérico' ? `• ${c.rfc}` : ''}</div>` : ''}
        
        <div class="card-person-sub" style="margin-bottom:0.6rem;">
          ${c.email ? `<div style="margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.email}"><i data-lucide="mail" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>${c.email}</div>` : ''}
          ${c.grupoSinergia && c.grupoSinergia !== 'N/A' ? `<div><i data-lucide="users" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>Grupo: ${c.grupoSinergia}</div>` : ''}
        </div>
        
        ${API_CONFIG.USE_SAP_BACKEND ? `
        <div style="background: var(--bg-secondary); padding: 0.6rem; border-radius: var(--radius-sm); margin-bottom: 0.6rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Saldo SAP:</span>
            <span style="font-size:0.75rem; font-weight:600; color:${c.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'};">${formatMoney(c.saldoCuenta)}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Órdenes Abiertas:</span>
            <span style="font-size:0.75rem; font-weight:600; color:var(--accent); cursor:pointer; text-decoration:underline dashed;" onclick="event.stopPropagation(); abrirDesgloseSAP('${c.id}', '${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')">${formatMoney(c.saldoOrdenes)}</span>
          </div>
        </div>` : ''}
        
        <div class="card-person-sub" style="border-top: 1px dashed var(--border); padding-top:0.6rem;">
          ${qtyOrdenes} ticket(s) en CRM
        </div>
        ${maquinasText}
      </div>
    `;
  }).join('');
  
  if (tbody) {
    tbody.innerHTML = paginatedClientes.map(c => {
      // Re-contar para la tabla (ya que el map es independiente)
      const maqClient = maquinariaDb.filter(m => m.cliente === c.nombre || m.cliente === c.id || m.cliente === c.rfc);
      let totalMaquinas = maqClient.length;
      (c.maquinas || []).forEach(m => {
         if (!maqClient.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno)) {
             totalMaquinas++;
         }
      });

      const qtyOrdenes = ordenes.filter(x => x.cliente === c.nombre).length;
      const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
      
      let customTds = '';
      if (configData.mappings?.clientes?.customCols) {
        configData.mappings.clientes.customCols.forEach(col => {
          customTds += `<td style="font-size:0.85rem;">${c.customData && c.customData[col.label] ? c.customData[col.label] : 'N/A'}</td>`;
        });
      }

      return `
        <tr onclick="verDetalleCliente('${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')" style="cursor:pointer;" class="table-row-hover">
          <td>
            ${c.id && c.id !== 'Usuario registrado' && c.id !== 'N/A' ? `<div style="font-family:monospace; font-weight:600; color:var(--accent); background:var(--bg-secondary); padding:0.2rem 0.5rem; border-radius:4px; display:inline-block; font-size:0.85rem;">${c.id}</div>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
          </td>
          <td style="font-weight:600; color:var(--text-primary);">${c.nombre || 'Sin nombre'}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${c.rfc && c.rfc !== 'Genérico' ? c.rfc : 'N/A'}</td>
          <td style="font-size:0.85rem;">${c.contacto || 'N/A'}</td>
          <td>
            <div style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.email || ''}">
              ${c.email && c.email !== 'N/A' ? `<span style="font-size:0.85rem;">${c.email}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
            </div>
          </td>
          <td>
            <div style="white-space:nowrap;">
              ${c.telefono && c.telefono !== 'N/A' ? `<span style="font-size:0.85rem;">${c.telefono}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}
            </div>
          </td>
          <td>${c.grupoSinergia && c.grupoSinergia !== 'N/A' ? `<span class="badge" style="background:var(--bg-hover); color:var(--text-primary); border:1px solid var(--border);">${c.grupoSinergia}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
          <td style="font-weight:600; color:${c.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'}; text-align:right;">${API_CONFIG.USE_SAP_BACKEND ? formatMoney(c.saldoCuenta) : '<span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">N/A</span>'}</td>
          <td style="font-weight:600; color:var(--accent); text-align:right;" onclick="event.stopPropagation(); abrirDesgloseSAP('${c.id}', '${(c.nombre || 'Sin nombre').replace(/'/g, "\\'")}')">
            ${API_CONFIG.USE_SAP_BACKEND ? `<span style="border-bottom: 1px dashed var(--accent); cursor:pointer;">${formatMoney(c.saldoOrdenes)}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">N/A</span>'}
          </td>
          ${customTds}
          <td style="text-align:center;"><span class="badge" style="background:var(--blue-light); color:var(--blue);">${totalMaquinas}</span></td>
        </tr>
      `;
    }).join('');
  }
  
  // RENDERIZAR CONTROLES DE PAGINACIÓN
  if (paginationContainer) {
    if (totalPages > 1) {
      paginationContainer.innerHTML = `
        <button class="btn-secondary" style="padding:0.4rem 0.8rem; border-radius:var(--radius-sm);" ${currentPageClientes === 1 ? 'disabled' : ''} onclick="currentPageClientes--; renderClientes();">Anterior</button>
        <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">Página ${currentPageClientes} de ${totalPages}</span>
        <button class="btn-secondary" style="padding:0.4rem 0.8rem; border-radius:var(--radius-sm);" ${currentPageClientes === totalPages ? 'disabled' : ''} onclick="currentPageClientes++; renderClientes();">Siguiente</button>
      `;
    } else {
      paginationContainer.innerHTML = '';
    }
  }

  lucide.createIcons();
}

// ===== MODAL DETALLE DE CLIENTE =====
function verDetalleCliente(nombre) {
  currentViewClientName = nombre;
  const clienteOb = clientesDb.find(c => c.nombre === nombre);
  const legacyOrd = ordenes.filter(o => o.cliente === nombre);
  const clienteTks = tickets.filter(t => t.cliente === nombre || t.solicitante === nombre);
  
  const body = document.getElementById('detalle-cliente-body');
  const syncBtn = document.getElementById('btn-sync-single-client');
  if (syncBtn) syncBtn.style.display = API_CONFIG.USE_SAP_BACKEND ? 'flex' : 'none';
  
  // Información General
  let html = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Empresa</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${nombre}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ubicación</div>
        <div style="font-weight: 500; color: var(--text-primary);">${clienteOb?.ubicacion || legacyOrd[0]?.ubicacion || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">RFC</div>
        <div style="font-weight: 500; color: var(--text-primary);">${clienteOb?.rfc || 'N/A'}</div>
      </div>
    </div>
  `;

  if (clienteOb?.contacto || clienteOb?.email || clienteOb?.telefono) {
    html += `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding-left: 0.5rem; border-left: 2px solid var(--accent);">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Contacto Principal</div>
          <div style="font-weight: 500;">${clienteOb.contacto || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Teléfono</div>
          <div style="font-weight: 500;">${clienteOb.telefono || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Correo</div>
          <div style="font-weight: 500;">${clienteOb.email || 'N/A'}</div>
        </div>
        </div>
      </div>
    `;
  }

  // Información SAP
  if (API_CONFIG.USE_SAP_BACKEND && clienteOb) {
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    html += `
      <div style="background: var(--bg-body); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border); border-left: 3px solid var(--accent); position:relative; margin-top: 1.5rem;">
        <div style="position:absolute; top:-12px; left:12px; background:var(--bg-body); padding:0 8px; display:flex; align-items:center;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg" alt="SAP" style="height: 24px;">
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">ID (CardCode)</div>
            <div style="font-weight: 600; color: var(--text-primary); font-family: monospace;">${clienteOb.id || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Grupo</div>
            <div style="font-weight: 600; color: var(--text-primary);">${clienteOb.grupoSinergia || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Saldo SAP</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: ${clienteOb.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'};">${formatMoney(clienteOb.saldoCuenta)}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Órdenes Abiertas</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${formatMoney(clienteOb.saldoOrdenes)}</div>
          </div>
`;

    // Inyectar columnas personalizadas de Clientes si existen
    if (clienteOb.customData) {
      Object.entries(clienteOb.customData).forEach(([label, value]) => {
        html += `
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${label}</div>
            <div style="font-weight: 600; color: var(--text-primary);">${value || 'N/A'}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  // Mostrar Personal Asignado
  let supNombre = 'N/A';
  let tecNombre = 'N/A';
  if (clienteOb) {
    if (clienteOb.supervisoresAsignados && clienteOb.supervisoresAsignados.length > 0) {
      supNombre = clienteOb.supervisoresAsignados.map(id => usuarios.find(x => x.id === id)?.nombre).filter(Boolean).join(', ') || 'N/A';
    } else if (clienteOb.supervisorAsignado) { // Legacy single support
      const u = usuarios.find(x => x.id === clienteOb.supervisorAsignado);
      if (u) supNombre = u.nombre;
    }
    
    if (clienteOb.tecnicosAsignados && clienteOb.tecnicosAsignados.length > 0) {
      tecNombre = clienteOb.tecnicosAsignados.map(id => usuarios.find(x => x.id === id)?.nombre).filter(Boolean).join(', ') || 'N/A';
    } else if (clienteOb.tecnicoAsignado) { // Legacy single support
      const u = usuarios.find(x => x.id === clienteOb.tecnicoAsignado);
      if (u) tecNombre = u.nombre;
    }
  }

  const isAdmin = currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin';
  const isSupervisorOrAdmin = isAdmin || currentSession.viewMode === 'supervisor';
  
  const editSupHtml = isAdmin ? `<i data-lucide="edit-2" style="width:14px;height:14px;cursor:pointer;color:var(--accent);margin-left:auto;" onclick="document.getElementById('disp-sup').style.display='none'; document.getElementById('edit-sup').style.display='block';"></i>` : '';
  const editTecHtml = isSupervisorOrAdmin ? `<i data-lucide="edit-2" style="width:14px;height:14px;cursor:pointer;color:var(--accent);margin-left:auto;" onclick="document.getElementById('disp-tec').style.display='none'; document.getElementById('edit-tec').style.display='block';"></i>` : '';

  const supOptions = `<option value="">-- Sin Asignar --</option>` + usuarios.filter(u=>u.rol==='supervisor').map(u=>`<option value="${u.id}" ${clienteOb?.supervisoresAsignados?.includes(u.id)?'selected':''}>${u.nombre}</option>`).join('');
  const tecOptions = `<option value="">-- Sin Asignar --</option>` + usuarios.filter(u=>u.rol==='tecnico').map(u=>`<option value="${u.id}" ${clienteOb?.tecnicosAsignados?.includes(u.id)?'selected':''}>${u.nombre}</option>`).join('');

  html += `
    <div style="margin-top:1rem; background: var(--bg-card); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; display:flex; align-items:center;"><i data-lucide="user-check" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i> Supervisor Asignado ${editSupHtml}</div>
        <div style="font-weight: 500; color: var(--text-primary); margin-top:0.25rem;" id="disp-sup">${supNombre}</div>
        <div id="edit-sup" style="display:none; margin-top:0.5rem;">
          <select style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid var(--border); font-size:0.85rem; background:var(--bg-body); color:var(--text-primary);" onchange="guardarPersonalCliente('${nombre.replace(/'/g, "\\'")}', 'supervisor', this.value)">
            ${supOptions}
          </select>
        </div>
      </div>
    </div>
  `;

  // Sitios
  let sitiosFromDb = sitiosDb.filter(s => s.cliente === clienteOb?.id || s.cliente === clienteOb?.idInterno || s.cliente === clienteOb?.rfc || s.cliente === clienteOb?.nombre).map(s => s.nombre);
  let sitios = clienteOb?.sitios || [];
  if (clienteOb?.ubicacion && !sitios.includes(clienteOb.ubicacion)) {
    sitios = [clienteOb.ubicacion, ...sitios];
  }
  
  sitios = [...new Set([...sitios, ...sitiosFromDb])];
  
  if (sitios.length === 0) sitios = ['Sede Principal'];

  html += `
    <div style="margin-top: 1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
        <h3 style="font-size:1rem; margin:0; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="map-pin" style="width:18px;height:18px;color:var(--text-muted);"></i> Sitios Registrados</h3>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; height: auto;" onclick="agregarSitioCliente('${nombre.replace(/'/g, "\\'")}')">+ Agregar Sitio</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
        ${sitios.map((s, idx) => {
          const sNombre = getSitioNombre(s);
          return `
          <span style="background:var(--bg-hover); padding:0.4rem 0.8rem; border-radius:1rem; border:1px solid var(--border); font-size:0.85rem; font-weight:500; color:var(--text-primary); display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;" onclick="abrirDetalleSitio('${sNombre.replace(/'/g, "\\'")}')" title="Ver detalle del sitio">
            ${sNombre}
          </span>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Máquinas
  let allClientMachines = [];
  
  // 1. Agregar de maquinariaDb (SAP/Supabase)
  const maqClient = maquinariaDb.filter(m => m.cliente === nombre || m.cliente === clienteOb?.id || m.cliente === clienteOb?.rfc);
  maqClient.forEach(m => {
      allClientMachines.push({
          idInterno: m.idInterno || m.id || m.serie || 'N/A',
          uniqueId: m.id || m.idInterno,
          marca: m.marca || '',
          modelo: m.modelo || m.descripcion || 'Sin Modelo',
          serie: m.serie || 'N/A',
          anio: m.anio || 'N/A',
          venta: m.venta || m.customData?.venta || '',
          ubicacion: m.ubicacion || m.customData?.ubicacion || m.cliente || 'N/A'
      });
  });

  // 2. Combinar con máquinas manuales (clientesDb)
  (clienteOb?.maquinas || []).forEach(m => {
      const isDuplicate = maqClient.some(sap => sap.id === m.idInterno || sap.serie === m.serie || sap.idInterno === m.idInterno);
      if (!isDuplicate) {
          allClientMachines.push({
              idInterno: m.idInterno || 'N/A',
              uniqueId: m.idInterno,
              marca: m.marca || '',
              modelo: m.modelo || m.descripcion || 'Sin Modelo',
              serie: m.serie || 'N/A',
              anio: m.anio || 'N/A',
              venta: m.venta || m.customData?.venta || '',
              ubicacion: m.ubicacion || m.customData?.ubicacion || nombre || 'N/A'
          });
      }
  });

  if (allClientMachines.length > 0) {
    html += `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);"><i data-lucide="settings-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Maquinaria Registrada</h3>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${allClientMachines.map(m => {
            const logoPath = getLogoMarca(m.marca);
            const callArgs = `'${(m.idInterno && m.idInterno !== 'N/A') ? m.idInterno : (m.uniqueId || '')}', '${m.serie || ''}', '${m.marca || ''}', '${m.modelo || ''}', '${nombre || ''}', '${m.ubicacion || ''}'`;
            return `
            <div onclick="verServiciosMaquina(${callArgs.replace(/"/g, '&quot;')})" style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.5rem; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
              <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary); display:flex; align-items:center;">
                ${logoPath ? `<img src="${logoPath}" alt="${m.marca}" onerror="this.onerror=null; this.outerHTML='<span>${m.marca} </span>';" style="height:24px; object-fit:contain; margin-right:8px;"/>` : `${m.marca || ''} `}
                ${m.modelo || 'Sin Modelo'}
                ${currentSession.viewMode !== 'empresa' ? `<span style="font-size:0.75rem; background:var(--bg-body); padding:0.15rem 0.4rem; border-radius:4px; border:1px solid var(--border); margin-left:0.5rem; color:var(--text-muted); font-family:monospace; font-weight:normal;">ID: ${m.idInterno || 'N/A'}</span>` : ''}
                <div style="margin-left:auto; display:flex; gap:0.25rem;">
                  <button class="action-btn" onclick="event.stopPropagation(); editarMaquina('${nombre.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Editar Máquina" style="padding:0.25rem; width:auto; height:auto;">
                    <i data-lucide="edit-2" style="width:16px;height:16px;"></i>
                  </button>
                  <button class="action-btn" onclick="event.stopPropagation(); abrirModalMoverMaquina('${nombre.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Cambiar Sitio" style="padding:0.25rem; width:auto; height:auto;">
                    <i data-lucide="map-pin" style="width:16px;height:16px;"></i>
                  </button>
                </div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Número de Serie</strong> <span style="font-weight:500;">${m.serie || 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Año de Fab.</strong> <span style="font-weight:500;">${m.anio || 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Fecha de Venta</strong> <span style="font-weight:500;">${m.venta ? m.venta.split('-').reverse().join('/') : 'N/A'}</span></div>
                <div><strong style="display:block; color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase;">Ubicación</strong> <span style="font-weight:500;">${m.ubicacion || 'N/A'}</span></div>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Historial fusionado de Órdenes y Tickets
  const clienteTicketIds = clienteTks.map(t => t.id);
  const clienteOrd = ordenes.filter(o => o.cliente === nombre || (o.soporte && clienteTicketIds.includes(o.soporte)));

  let historial = [];

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    return dateStr.split('T')[0].split('-').reverse().join('/');
  };

  clienteTks.forEach(t => {
     let ordenesDelTicket = clienteOrd.filter(o => o.soporte === t.id);
     historial.push({
        tipo: 'ticket',
        fechaStr: t.fechaCreacion,
        obj: t,
        ordenesLigadas: ordenesDelTicket
     });
  });

  clienteOrd.forEach(o => {
     if (!clienteTks.some(t => t.id === o.soporte)) {
        historial.push({
           tipo: 'orden_independiente',
           fechaStr: o.fecha,
           obj: o
        });
     }
  });

  historial.sort((a, b) => {
     let d1 = a.fechaStr ? new Date(a.fechaStr) : new Date(0);
     let d2 = b.fechaStr ? new Date(b.fechaStr) : new Date(0);
     return d2 - d1;
  });

  let activos = [];
  let cerrados = [];

  historial.forEach(item => {
     let isClosed = false;
     if (item.tipo === 'ticket') {
        const t = item.obj;
        const ordenes = item.ordenesLigadas;
        const tClosed = t.estado === 'Cerrado';
        const allOrdersClosed = ordenes.every(o => o.estado === 'Completado' || o.estado === 'Cerrado');
        if (tClosed && allOrdersClosed) isClosed = true;
     } else {
        const o = item.obj;
        if (o.estado === 'Completado' || o.estado === 'Cerrado') isClosed = true;
     }
     
     if (isClosed) cerrados.push(item);
     else activos.push(item);
  });

  const renderItem = (item) => {
     if (item.tipo === 'ticket') {
       const t = item.obj;
       const ordenes = item.ordenesLigadas;
       return `
         <div onclick="verDetalleTicket('${t.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div style="display:flex; justify-content:space-between; align-items:flex-start;">
             <div>
               <div style="display:flex; align-items:center; gap:0.4rem;">
                 <i data-lucide="ticket" style="width:14px;height:14px;color:var(--text-muted);"></i>
                 <span style="font-weight:600; color:var(--text-primary);">${t.asunto || 'Sin título'}</span>
               </div>
               <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
                 # ${t.folio || t.id.substring(0,8)} - ${formatDateOnly(t.fechaCreacion)}
               </div>
             </div>
             <span class="badge badge-${badgeTicketEstado(t.estado)}">${t.estado||'Abierto'}</span>
           </div>
           ${ordenes.map(o => `
             <div onclick="event.stopPropagation(); verDetalle('${o.id}')" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6';" onmouseout="this.style.opacity='1';">
                <div>
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
                    <span style="font-weight:500; color:var(--accent); font-size:0.9rem;">Orden #${o.folio || '-'}</span>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                     ${formatDateOnly(o.fecha)}
                  </div>
                </div>
                <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}" style="font-size:0.7rem; padding:0.2rem 0.4rem;">${o.estado||'Pendiente'}</span>
             </div>
           `).join('')}
         </div>
       `;
     } else {
       const o = item.obj;
       return `
         <div onclick="verDetalle('${o.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div>
             <div style="display:flex; align-items:center; gap:0.4rem;">
               <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
               <span style="font-weight:500; color:var(--accent);">Orden #${o.folio || '-'}</span>
             </div>
             <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
               ${formatDateOnly(o.fecha)}
             </div>
           </div>
           <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}">${o.estado||'Pendiente'}</span>
         </div>
       `;
     }
  };

  if (historial.length > 0) {
    html += `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="layers" style="width:18px;height:18px;color:var(--text-muted);"></i> Historial de Servicios (${historial.length})</h3>
        <div style="display:flex; flex-direction:column;">
          ${activos.map(renderItem).join('')}
          <div style="margin-top: 0.2rem; margin-bottom: 0.5rem; text-align: center;">
             <button type="button" onclick="const div = document.getElementById('cliente-historial-cerrados'); div.style.display = div.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('i'); if(div.style.display==='none'){ icon.setAttribute('data-lucide', 'chevron-down'); } else { icon.setAttribute('data-lucide', 'chevron-up'); } lucide.createIcons();" style="background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; font-weight: 500; transition: background 0.2s;">
                Ver completados (${cerrados.length}) <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
             </button>
          </div>
          <div id="cliente-historial-cerrados" style="display:none;">
             ${cerrados.length > 0 ? cerrados.map(renderItem).join('') : '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No hay servicios completados aún.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  body.innerHTML = html;
  document.getElementById('modal-detalle-cliente-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleMaquina(e) {
  if (e && e.target !== document.getElementById('modal-detalle-maquina-overlay')) return;
  document.getElementById('modal-detalle-maquina-overlay').classList.remove('open');
}

function abrirDetalleSitio(sitioNombre) {
  const sitioOb = sitiosDb.find(s => s.nombre === sitioNombre);
  const body = document.getElementById('detalle-sitio-body');
  if (!body) return;
  
  let html = '';
  
  if (sitioOb) {
    html += `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Nombre del Sitio</div>
          <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${sitioOb.nombre || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">ID de Sitio</div>
          <div style="font-weight: 500; color: var(--text-primary); font-family: monospace;">${sitioOb.id || 'N/A'}</div>
        </div>
        <div style="grid-column: span 2;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Dirección Completa</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.direccion || 'N/A'}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ciudad / Estado</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.ciudad || ''} ${sitioOb.estado ? ', ' + sitioOb.estado : ''}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Código Postal</div>
          <div style="font-weight: 500; color: var(--text-primary);">${sitioOb.cp || 'N/A'}</div>
        </div>
      </div>
    `;
    
    if (sitioOb.customData && Object.keys(sitioOb.customData).length > 0) {
      html += `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding-left: 0.5rem; border-left: 2px solid var(--accent); margin-top:0.5rem;">
      `;
      Object.entries(sitioOb.customData).forEach(([label, value]) => {
        html += `
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${label}</div>
            <div style="font-weight: 600; color: var(--text-primary);">${value || 'N/A'}</div>
          </div>
        `;
      });
      html += `</div>`;
    }
  } else {
    html += `
      <div style="display:flex; flex-direction:column; gap:0.5rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Nombre del Sitio (Legacy)</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--text-primary);">${sitioNombre}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Este sitio fue registrado localmente y no contiene más detalles estructurados de SAP.</div>
      </div>
    `;
  }
  
  // Extraer coordenadas
  let lat = null; let lon = null;
  if (sitioOb) {
    lat = sitioOb.latitud || sitioOb.lat || null;
    lon = sitioOb.longitud || sitioOb.lon || sitioOb.lng || null;
    if (sitioOb.customData) {
      const keys = Object.keys(sitioOb.customData);
      const kLat = keys.find(k => k.toLowerCase() === 'latitud' || k.toLowerCase() === 'lat' || k.toLowerCase() === 'u_latitud');
      const kLon = keys.find(k => k.toLowerCase() === 'longitud' || k.toLowerCase() === 'lon' || k.toLowerCase() === 'lng' || k.toLowerCase() === 'u_longitud');
      if (kLat && sitioOb.customData[kLat] && !lat) lat = sitioOb.customData[kLat];
      if (kLon && sitioOb.customData[kLon] && !lon) lon = sitioOb.customData[kLon];
    }
  } else {
    for (const cli of clientesDb) {
      if (cli.sitios) {
        const localSitio = cli.sitios.find(s => getSitioNombre(s) === sitioNombre);
        if (localSitio && typeof localSitio === 'object') {
          lat = localSitio.latitud || null;
          lon = localSitio.longitud || null;
          break;
        }
      }
    }
  }

  // Renderizar bloque de Coordenadas editable
  const safeNombre = sitioNombre.replace(/'/g, "\\'");
  html += `
    <div style="margin-top: 1rem; background: var(--bg-hover); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
      <div id="coordenadas-display" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap: 0.5rem;">
          ${lat && lon ? '<i data-lucide="map-pin" style="width:16px;height:16px;color:var(--accent);"></i>' : '<i data-lucide="map-pin-off" style="width:16px;height:16px;color:var(--text-muted);"></i>'}
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Coordenadas Geográficas</div>
            <div style="font-weight: 500; color: ${lat && lon ? 'var(--text-primary)' : 'var(--text-muted)'}; ${lat && lon ? 'font-family: monospace;' : 'font-size: 0.9rem;'}">${lat && lon ? `${lat}, ${lon}` : 'Sin coordenadas registradas'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${lat && lon ? `<a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" style="display:flex; align-items:center; gap:0.4rem; background: var(--accent); color: white; padding: 0.4rem 0.75rem; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 500;"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> Ver Mapa</a>` : ''}
          <button onclick="document.getElementById('coordenadas-display').style.display='none'; document.getElementById('coordenadas-edit').style.display='flex';" class="btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="edit-3" style="width:14px;height:14px;"></i> Editar</button>
        </div>
      </div>
      
      <div id="coordenadas-edit" style="display:none; flex-direction:column; gap:0.5rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border);">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Edita las coordenadas para asociarlas a este sitio. Esto actualizará también las máquinas en este sitio.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <input type="number" step="any" id="edit-sitio-lat" placeholder="Latitud" value="${lat || ''}" style="width:100%;"/>
          <input type="number" step="any" id="edit-sitio-lon" placeholder="Longitud" value="${lon || ''}" style="width:100%;"/>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
          <button type="button" onclick="const lt=document.getElementById('edit-sitio-lat').value; const ln=document.getElementById('edit-sitio-lon').value; if(lt&&ln) window.open('https://maps.google.com/?q='+lt+','+ln, '_blank'); else alert('Faltan coordenadas para probar el mapa.');" class="btn-secondary" style="padding: 0.3rem 0.75rem; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="map" style="width:14px;height:14px;"></i> Probar Mapa</button>
          <div style="display:flex; gap:0.5rem;">
            <button onclick="document.getElementById('coordenadas-edit').style.display='none'; document.getElementById('coordenadas-display').style.display='flex';" class="btn-secondary" style="padding: 0.3rem 0.75rem;">Cancelar</button>
            <button onclick="guardarCoordenadasSitio('${safeNombre}')" class="btn-primary" style="padding: 0.3rem 0.75rem;">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Maquinaria en este sitio
  const maquinas = maquinariaDb.filter(m => m.ubicacion === sitioNombre || m.sitio === sitioNombre);
  if (maquinas.length > 0) {
    html += `
      <div style="margin-top: 1rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);"><i data-lucide="settings-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Máquinas en este sitio (${maquinas.length})</h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:200px; overflow-y:auto; padding-right:0.5rem;">
          ${maquinas.map(m => `
            <div style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; background: var(--bg-body);">
              <div>
                <div style="font-weight:500; color:var(--accent);">${m.marca || ''} ${m.modelo || 'Sin Modelo'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Serie: ${m.serie || 'N/A'}</div>
              </div>
              ${m.latitud && m.longitud ? `
                <a href="https://maps.google.com/?q=${m.latitud},${m.longitud}" target="_blank" style="display:flex; align-items:center; gap:0.3rem; background: var(--bg-hover); color: var(--text-primary); padding: 0.3rem 0.5rem; border-radius: 4px; text-decoration: none; font-size: 0.75rem; font-weight: 500; border: 1px solid var(--border);">
                  <i data-lucide="map-pin" style="width:12px;height:12px;color:var(--accent);"></i> Ver Mapa
                </a>
              ` : `
                <span style="font-size:0.7rem; color:var(--text-muted); background:var(--bg-hover); padding:0.2rem 0.4rem; border-radius:3px;">Sin coords.</span>
              `}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = html;
  document.getElementById('modal-detalle-sitio-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleSitio(e) {
  if (e && e.target !== document.getElementById('modal-detalle-sitio-overlay')) return;
  document.getElementById('modal-detalle-sitio-overlay').classList.remove('open');
}

function guardarCoordenadasSitio(sitioNombre) {
  const lat = document.getElementById('edit-sitio-lat').value.trim();
  const lon = document.getElementById('edit-sitio-lon').value.trim();
  
  if (!lat || !lon) {
    alert('Por favor ingresa latitud y longitud válidas.');
    return;
  }
  
  // 1. Actualizar en sitiosDb (si es de SAP)
  const sitioDbOb = sitiosDb.find(s => s.nombre === sitioNombre);
  if (sitioDbOb) {
    sitioDbOb.latitud = lat;
    sitioDbOb.longitud = lon;
  }
  
  // 2. Actualizar en clientesDb (sitios locales)
  clientesDb.forEach(c => {
    if (c.sitios) {
      let idx = c.sitios.findIndex(s => getSitioNombre(s) === sitioNombre);
      if (idx >= 0) {
        if (typeof c.sitios[idx] === 'string') {
          c.sitios[idx] = { nombre: sitioNombre, latitud: lat, longitud: lon };
        } else {
          c.sitios[idx].latitud = lat;
          c.sitios[idx].longitud = lon;
        }
      }
    }
  });
  
  // 3. Actualizar todas las máquinas en este sitio
  let changedMachines = false;
  maquinariaDb.forEach(m => {
    if (m.ubicacion === sitioNombre || m.sitio === sitioNombre) {
       m.latitud = lat;
       m.longitud = lon;
       changedMachines = true;
    }
  });
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(m => {
        if (m.ubicacion === sitioNombre || m.sitio === sitioNombre) {
           m.latitud = lat;
           m.longitud = lon;
           changedMachines = true;
        }
      });
    }
  });
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  
  abrirDetalleSitio(sitioNombre);
  mostrarNotificacion('Coordenadas actualizadas exitosamente', 'success');
}

function verServiciosMaquina(idInterno, serie, marca, modelo, cliente, ubicacion) {
  const logoPath = getLogoMarca(marca);
  document.getElementById('detalle-maquina-title').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:1rem;">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <img src="logo_transparent.png" alt="Eurorep" style="height:32px; object-fit:contain; border-right:1px solid var(--border); padding-right:0.75rem;"/>
        <div style="display:flex; flex-direction:column; justify-content:center;">
          <span style="font-size:1.1rem; line-height:1.2;">${marca} ${modelo}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">ID: ${idInterno}</span>
        </div>
      </div>
      ${logoPath ? `<img src="${logoPath}" alt="${marca}" onerror="this.onerror=null; this.style.display='none';" style="height:28px; object-fit:contain; max-width:100px;"/>` : ''}
    </div>
  `;
  
  const snMatch = serie && serie !== 'N/A' ? `(SN: ${serie})` : null;
  const maqTickets = tickets.filter(t => 
    t.maquinaId === idInterno || 
    (serie && serie !== 'N/A' && t.maquinaId === serie) || 
    (snMatch && t.equipo && t.equipo.includes(snMatch)) || 
    (t.equipo && t.equipo.includes(idInterno)) ||
    (t.equipo && t.equipo === idInterno)
  );
  const maqTicketIds = maqTickets.map(t => t.id);
  const maqOrdenes = ordenes.filter(o => 
    o.maquina === idInterno || 
    (serie && serie !== 'N/A' && o.maquina === serie) || 
    o.serie === idInterno || 
    (serie && serie !== 'N/A' && o.serie === serie) || 
    (snMatch && o.equipo && o.equipo.includes(snMatch)) || 
    (o.equipo && o.equipo.includes(idInterno)) ||
    (o.equipo && o.equipo === idInterno) ||
    (o.soporte && maqTicketIds.includes(o.soporte))
  );
  
  let fechas = [];
  maqOrdenes.forEach(o => { if(o.fecha) fechas.push(new Date(o.fecha)); });
  maqTickets.forEach(t => { if(t.fechaCreacion) fechas.push(new Date(t.fechaCreacion)); });
  
  let ultimaFechaStr = 'Ninguno';
  if (fechas.length > 0) {
    const ultimaFecha = new Date(Math.max.apply(null, fechas));
    ultimaFechaStr = ultimaFecha.toISOString().split('T')[0].split('-').reverse().join('/');
  }
  
  // Siguiente Servicio
  let siguientes = [];
  maqOrdenes.forEach(o => {
    if (o.estado === 'Pendiente' || o.estado === 'En Proceso' || o.estado === 'Programado') {
      if (o.fecha) siguientes.push(new Date(o.fecha));
    }
  });
  
  let siguienteServicioStr = 'No programado';
  if (siguientes.length > 0) {
    const siguienteFecha = new Date(Math.min.apply(null, siguientes));
    siguienteServicioStr = siguienteFecha.toISOString().split('T')[0].split('-').reverse().join('/');
  } else {
    const hasPendingOrd = maqOrdenes.some(o => o.estado === 'Pendiente' || o.estado === 'En Proceso');
    const hasPendingTkt = maqTickets.some(t => t.estado === 'Abierto' || t.estado === 'En Proceso');
    if (hasPendingOrd) siguienteServicioStr = 'Por agendar (Orden)';
    else if (hasPendingTkt) siguienteServicioStr = 'Ticket abierto';
  }
  // Historial fusionado
  let historial = [];

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    return dateStr.split('T')[0].split('-').reverse().join('/');
  };

  maqTickets.forEach(t => {
     let ordenesDelTicket = maqOrdenes.filter(o => o.soporte === t.id);
     historial.push({
        tipo: 'ticket',
        fechaStr: t.fechaCreacion,
        obj: t,
        ordenesLigadas: ordenesDelTicket
     });
  });

  maqOrdenes.forEach(o => {
     if (!maqTickets.some(t => t.id === o.soporte)) {
        historial.push({
           tipo: 'orden_independiente',
           fechaStr: o.fecha,
           obj: o
        });
     }
  });

  historial.sort((a, b) => {
     let d1 = a.fechaStr ? new Date(a.fechaStr) : new Date(0);
     let d2 = b.fechaStr ? new Date(b.fechaStr) : new Date(0);
     return d2 - d1;
  });

  let activos = [];
  let cerrados = [];

  historial.forEach(item => {
     let isClosed = false;
     if (item.tipo === 'ticket') {
        const t = item.obj;
        const ordenes = item.ordenesLigadas;
        const tClosed = t.estado === 'Cerrado';
        const allOrdersClosed = ordenes.every(o => o.estado === 'Completado' || o.estado === 'Cerrado');
        if (tClosed && allOrdersClosed) isClosed = true;
     } else {
        const o = item.obj;
        if (o.estado === 'Completado' || o.estado === 'Cerrado') isClosed = true;
     }
     
     if (isClosed) cerrados.push(item);
     else activos.push(item);
  });

  let html = '';
  
  // Resumen
  html += `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; background:var(--bg-hover); padding:1rem; border-radius:var(--radius-md);">
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Serie</div>
        <div style="font-weight:500;">${serie || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Último Servicio</div>
        <div style="font-weight:500;">${ultimaFechaStr}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Cliente</div>
        <div style="font-weight:500;">${cliente || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Siguiente Servicio</div>
        <div style="font-weight:600; color:var(--orange);">${siguienteServicioStr}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Sitio / Ubicación</div>
        <div style="font-weight:500;">${ubicacion || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Servicios Totales</div>
        <div style="font-weight:600; color:var(--accent); font-size:1.1rem;">${historial.length}</div>
      </div>
    </div>
  `;

  const renderItem = (item) => {
     if (item.tipo === 'ticket') {
       const t = item.obj;
       const ordenes = item.ordenesLigadas;
       return `
         <div onclick="verDetalleTicket('${t.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div style="display:flex; justify-content:space-between; align-items:flex-start;">
             <div>
               <div style="display:flex; align-items:center; gap:0.4rem;">
                 <i data-lucide="ticket" style="width:14px;height:14px;color:var(--text-muted);"></i>
                 <span style="font-weight:600; color:var(--text-primary);">${t.asunto || 'Sin título'}</span>
               </div>
               <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
                 # ${t.folio || t.id.substring(0,8)} - ${formatDateOnly(t.fechaCreacion)}
               </div>
             </div>
             <span class="badge badge-${badgeTicketEstado(t.estado)}">${t.estado||'Abierto'}</span>
           </div>
           ${ordenes.map(o => `
             <div onclick="event.stopPropagation(); verDetalle('${o.id}')" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6';" onmouseout="this.style.opacity='1';">
                <div>
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
                    <span style="font-weight:500; color:var(--accent); font-size:0.9rem;">Orden #${o.folio || '-'}</span>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                     ${formatDateOnly(o.fecha)}
                  </div>
                </div>
                <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}" style="font-size:0.7rem; padding:0.2rem 0.4rem;">${o.estado||'Pendiente'}</span>
             </div>
           `).join('')}
         </div>
       `;
     } else {
       const o = item.obj;
       return `
         <div onclick="verDetalle('${o.id}')" style="border:1px solid var(--border); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: border-color 0.2s, box-shadow 0.2s;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
           <div>
             <div style="display:flex; align-items:center; gap:0.4rem;">
               <i data-lucide="clipboard-list" style="width:14px;height:14px;color:var(--accent);"></i>
               <span style="font-weight:500; color:var(--accent);">Orden #${o.folio || '-'}</span>
             </div>
             <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;">
               ${formatDateOnly(o.fecha)}
             </div>
           </div>
           <span class="badge badge-${o.estado==='Pendiente'?'pendiente':o.estado==='En Proceso'?'proceso':'completado'}">${o.estado||'Pendiente'}</span>
         </div>
       `;
     }
  };

  if (historial.length > 0) {
    html += `
      <div>
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="layers" style="width:18px;height:18px;color:var(--text-muted);"></i> Historial de Servicios (${historial.length})</h3>
        <div style="display:flex; flex-direction:column;">
          ${activos.map(renderItem).join('')}
          <div style="margin-top: 0.2rem; margin-bottom: 0.5rem; text-align: center;">
             <button type="button" onclick="const div = document.getElementById('historial-cerrados'); div.style.display = div.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('i'); if(div.style.display==='none'){ icon.setAttribute('data-lucide', 'chevron-down'); } else { icon.setAttribute('data-lucide', 'chevron-up'); } lucide.createIcons();" style="background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; font-weight: 500; transition: background 0.2s;">
                Ver completados (${cerrados.length}) <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
             </button>
          </div>
          <div id="historial-cerrados" style="display:none;">
             ${cerrados.length > 0 ? cerrados.map(renderItem).join('') : '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No hay servicios completados aún.</div>'}
          </div>
        </div>
      </div>
    `;
  }
  
  if (historial.length === 0) {
    html += `<div class="empty-state" style="padding:2rem;">Esta máquina no tiene servicios registrados.</div>`;
  }
  
  document.getElementById('detalle-maquina-body').innerHTML = html;
  document.getElementById('modal-detalle-maquina-overlay').classList.add('open');
  lucide.createIcons();
}

function guardarPersonalCliente(clienteNombre, rol, userId) {
  let cliente = clientesDb.find(c => c.nombre === clienteNombre);
  if (!cliente) {
    // Si el cliente solo existe como legacy, lo creamos
    cliente = { id: crypto.randomUUID(), nombre: clienteNombre, sitios: [], maquinas: [] };
    clientesDb.push(cliente);
  }
  
  if (rol === 'supervisor') {
    cliente.supervisoresAsignados = userId ? [userId] : [];
  } else if (rol === 'tecnico') {
    cliente.tecnicosAsignados = userId ? [userId] : [];
  }
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  verDetalleCliente(clienteNombre); // Refrescar modal
}

function eliminarSitioDeClienteAdmin(clienteNombre, sitioNombre) {
  if (!confirm(`¿Estás seguro de eliminar el sitio "${sitioNombre}" de este cliente? (Los sitios de SAP no se pueden eliminar por aquí)`)) return;
  const cliente = clientesDb.find(c => c.nombre === clienteNombre);
  if (cliente && cliente.sitios) {
    const idx = cliente.sitios.findIndex(s => getSitioNombre(s) === sitioNombre);
    if (idx !== -1) {
      cliente.sitios.splice(idx, 1);
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      verDetalleCliente(clienteNombre); // Refrescar modal
    } else {
      alert("Este sitio proviene de SAP y no puede ser eliminado desde aquí.");
    }
  }
}

function cerrarDetalleCliente(e) {
  if (e && e.target !== document.getElementById('modal-detalle-cliente-overlay')) return;
  document.getElementById('modal-detalle-cliente-overlay').classList.remove('open');
}

// ===== MODAL CLIENTE LOGIC =====
function abrirModalCliente() {
  document.getElementById('form-cliente').reset();
  
  // Populate assigned personnel dropdowns
  const selectSup = document.getElementById('cl-supervisor');
  const selectTec = document.getElementById('cl-tecnico');
  if (selectSup) {
    selectSup.innerHTML = usuarios.filter(u => ['superadmin','admin','supervisor'].includes(u.rol) && u.activo !== false)
              .map(u => `<option value="${u.id}">${u.nombre} (${ROLES[u.rol]?.label || u.rol})</option>`).join('');
  }
  if (selectTec) {
    selectTec.innerHTML = usuarios.filter(u => u.rol === 'tecnico' && u.activo !== false)
              .map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
  }

  document.getElementById('maquinas-container').innerHTML = '';
  agregarMaquinaField(); // At least one empty machine field
  document.getElementById('modal-cliente-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarCliente(e) {
  if (e && e.target !== document.getElementById('modal-cliente-overlay')) return;
  document.getElementById('modal-cliente-overlay').classList.remove('open');
}

function agregarMaquinaField() {
  const container = document.getElementById('maquinas-container');
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.flexWrap = 'wrap';
  div.style.gap = '1rem';
  div.style.background = 'var(--bg-hover)';
  div.style.padding = '1rem';
  div.style.borderRadius = 'var(--radius-md)';
  div.style.alignItems = 'end';
  div.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%;">
      <div class="form-group">
        <label style="font-size:0.75rem;">Marca</label>
        <input type="text" class="cl-maquina-marca" placeholder="Ej. Fiori"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Modelo *</label>
        <input type="text" class="cl-maquina-modelo" placeholder="Ej. CX 160" required/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Número de Serie</label>
        <input type="text" class="cl-maquina-serie" placeholder="Ej. 12345678"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Año de Fabricación</label>
        <input type="number" class="cl-maquina-anio" placeholder="Ej. 2018"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Fecha de Venta</label>
        <input type="date" class="cl-maquina-venta"/>
      </div>
      <div class="form-group">
        <label style="font-size:0.75rem;">Ubicación</label>
        <input type="text" class="cl-maquina-ubicacion" placeholder="Nave, Planta..."/>
      </div>
    </div>
    <div class="form-group" style="flex: 0 0 auto; margin-left: 1rem; align-self: flex-start; padding-top:1.25rem;">
      <button type="button" class="btn-secondary" style="height: 38px; padding: 0 1rem; color: var(--red);" onclick="this.parentElement.parentElement.remove()" title="Eliminar Máquina">
        <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
      </button>
    </div>
  `;
  container.appendChild(div);
  lucide.createIcons();
}

function guardarCliente(e) {
  e.preventDefault();
  
  const nombre = document.getElementById('cl-nombre').value.trim();
  const rfc = document.getElementById('cl-rfc').value.trim();
  const ubicacion = document.getElementById('cl-ubicacion').value.trim();
  const contacto = document.getElementById('cl-contacto').value.trim();
  const telefono = document.getElementById('cl-telefono').value.trim();
  const email = document.getElementById('cl-email').value.trim();
  const metodoContacto = document.getElementById('cl-metodo-contacto').value;
  
  const maquinasEls = document.querySelectorAll('#maquinas-container > div');
  const maquinas = [];
  maquinasEls.forEach(el => {
    const marca = el.querySelector('.cl-maquina-marca')?.value.trim() || '';
    const modelo = el.querySelector('.cl-maquina-modelo')?.value.trim() || '';
    const serie = el.querySelector('.cl-maquina-serie')?.value.trim() || '';
    const anio = el.querySelector('.cl-maquina-anio')?.value.trim() || '';
    const venta = el.querySelector('.cl-maquina-venta')?.value || '';
    const ubicacion = el.querySelector('.cl-maquina-ubicacion')?.value.trim() || '';
    if (modelo) {
      const idInterno = generarIdInternoMaquina(marca, venta || anio);
      maquinas.push({ idInterno, marca, modelo, serie, anio, venta, ubicacion });
    }
  });

  const supIds = Array.from(document.getElementById('cl-supervisor')?.selectedOptions || []).map(o => o.value);
  const tecIds = Array.from(document.getElementById('cl-tecnico')?.selectedOptions || []).map(o => o.value);

  const nuevoCliente = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    nombre,
    rfc,
    ubicacion,
    contacto,
    telefono,
    email,
    metodoContacto,
    maquinas,
    supervisoresAsignados: supIds,
    tecnicosAsignados: tecIds
  };

  clientesDb.push(nuevoCliente);
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  
  cerrarCliente();
  if (document.getElementById('view-clientes').classList.contains('active')) {
    renderClientes();
  }
}

// ===== MODAL AGREGAR MÁQUINA A CLIENTE =====
let editandoMaquinaId = null;
let editandoMaquinaCliente = null;

function abrirModalAgregarMaquina() {
  editandoMaquinaId = null;
  editandoMaquinaCliente = null;
  document.getElementById('agregar-maquina-title').textContent = 'Agregar Máquina a Cliente';
  document.getElementById('form-agregar-maquina').reset();
  const select = document.getElementById('am-cliente');
  select.removeAttribute('disabled');
  document.getElementById('am-venta').disabled = false;
  
  const btnEliminar = document.getElementById('btn-eliminar-maquina');
  if (btnEliminar) btnEliminar.style.display = 'none';
  
  const slider = document.getElementById('am-venta-tercero-slider');
  const knob = document.getElementById('am-venta-tercero-knob');
  if (slider) slider.style.backgroundColor = '#ccc';
  if (knob) knob.style.transform = 'translateX(0)';
  
  // Lógica del Select de Marca
  const selectMarca = document.getElementById('am-marca-select');
  const inputOtraMarca = document.getElementById('am-marca-otra');
  
  if (selectMarca && inputOtraMarca) {
    const marcasSet = new Set(MARCAS_OFICIALES);
    clientesDb.forEach(c => {
      if (c.maquinas) c.maquinas.forEach(m => { if (m.marca && !marcasSet.has(m.marca)) marcasSet.add(m.marca); });
    });
    
    // Construir el select
    let optionsHtml = '<option value="" disabled selected>Seleccione una marca...</option>';
    Array.from(marcasSet).sort().forEach(m => {
      optionsHtml += `<option value="${m}">${m}</option>`;
    });
    optionsHtml += '<option value="otra">Otra...</option>';
    selectMarca.innerHTML = optionsHtml;
    
    inputOtraMarca.style.display = 'none';
    inputOtraMarca.value = '';
    
    // Clonar para limpiar eventos y evitar acumulaciones
    const newSelectMarca = selectMarca.cloneNode(true);
    selectMarca.parentNode.replaceChild(newSelectMarca, selectMarca);
    
    newSelectMarca.addEventListener('change', function() {
      if (this.value === 'otra') {
        inputOtraMarca.style.display = 'block';
        inputOtraMarca.focus();
        inputOtraMarca.required = true;
      } else {
        inputOtraMarca.style.display = 'none';
        inputOtraMarca.required = false;
      }
    });
  }
  
  // Llenar el select de clientes
  select.innerHTML = '<option value="" disabled selected>Seleccione un cliente...</option>';
  
  // Obtener lista completa de clientes (legacy + db)
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente && !legacyMap.has(o.cliente)) {
      legacyMap.set(o.cliente, o.cliente);
    }
  });
  const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
  mergedNames.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    opt.textContent = nombre;
    select.appendChild(opt);
  });
  
  select.onchange = (e) => {
    const nombre = e.target.value;
    const selectUbicacion = document.getElementById('am-ubicacion-select');
    const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
    
    if (selectUbicacion && inputOtraUbicacion) {
      const clienteObj = clientesDb.find(c => c.nombre === nombre);
      let optionsHtml = '<option value="" disabled selected>Seleccione una ubicación...</option>';
      
      if (clienteObj) {
        const sitios = getNombresDeSitiosParaCliente(clienteObj);
        sitios.forEach(sName => {
          optionsHtml += `<option value="${sName}">${sName}</option>`;
        });
      }
      optionsHtml += '<option value="otra">Otra...</option>';
      selectUbicacion.innerHTML = optionsHtml;
      
      inputOtraUbicacion.style.display = 'none';
      inputOtraUbicacion.value = '';
      
      const newSelectUbicacion = selectUbicacion.cloneNode(true);
      selectUbicacion.parentNode.replaceChild(newSelectUbicacion, selectUbicacion);
      
      newSelectUbicacion.addEventListener('change', function() {
        const latInput = document.getElementById('am-latitud');
        const lonInput = document.getElementById('am-longitud');
        
        if (this.value === 'otra') {
          inputOtraUbicacion.style.display = 'block';
          inputOtraUbicacion.focus();
          if (latInput) latInput.value = '';
          if (lonInput) lonInput.value = '';
        } else {
          inputOtraUbicacion.style.display = 'none';
          
          if (latInput && lonInput) {
            latInput.value = '';
            lonInput.value = '';
            
            const sitioName = this.value;
            const sitioDbOb = sitiosDb.find(s => s.nombre === sitioName);
            let foundLat = null; let foundLon = null;
            if (sitioDbOb) {
              foundLat = sitioDbOb.latitud || sitioDbOb.lat;
              foundLon = sitioDbOb.longitud || sitioDbOb.lon || sitioDbOb.lng;
              if (sitioDbOb.customData) {
                const keys = Object.keys(sitioDbOb.customData);
                const kLat = keys.find(k => k.toLowerCase() === 'latitud' || k.toLowerCase() === 'lat' || k.toLowerCase() === 'u_latitud');
                const kLon = keys.find(k => k.toLowerCase() === 'longitud' || k.toLowerCase() === 'lon' || k.toLowerCase() === 'lng' || k.toLowerCase() === 'u_longitud');
                if (kLat && sitioDbOb.customData[kLat] && !foundLat) foundLat = sitioDbOb.customData[kLat];
                if (kLon && sitioDbOb.customData[kLon] && !foundLon) foundLon = sitioDbOb.customData[kLon];
              }
            }
            
            if (!foundLat || !foundLon) {
              const cliObj = clientesDb.find(c => c.nombre === document.getElementById('am-cliente').value);
              if (cliObj && cliObj.sitios) {
                const localSitio = cliObj.sitios.find(s => getSitioNombre(s) === sitioName);
                if (localSitio && typeof localSitio === 'object') {
                  if (localSitio.latitud) foundLat = localSitio.latitud;
                  if (localSitio.longitud) foundLon = localSitio.longitud;
                }
              }
            }
            
            if (foundLat) latInput.value = foundLat;
            if (foundLon) lonInput.value = foundLon;
          }
        }
      });
    }
  };

  document.getElementById('modal-agregar-maquina-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarModalAgregarMaquina(e) {
  if (e && e.target !== document.getElementById('modal-agregar-maquina-overlay')) return;
  document.getElementById('modal-agregar-maquina-overlay').classList.remove('open');
  editandoMaquinaId = null;
  editandoMaquinaCliente = null;
}

function toggleVentaTercero() {
  const isTercero = document.getElementById('am-venta-tercero').checked;
  const inputVenta = document.getElementById('am-venta');
  const slider = document.getElementById('am-venta-tercero-slider');
  const knob = document.getElementById('am-venta-tercero-knob');
  
  if (isTercero) {
    inputVenta.value = '';
    inputVenta.disabled = true;
    if (slider) slider.style.backgroundColor = 'var(--accent)';
    if (knob) knob.style.transform = 'translateX(16px)';
  } else {
    inputVenta.disabled = false;
    if (slider) slider.style.backgroundColor = '#ccc';
    if (knob) knob.style.transform = 'translateX(0)';
  }
}

function editarMaquina(clienteNombre, idInterno) {
  abrirModalAgregarMaquina();
  editandoMaquinaId = idInterno;
  editandoMaquinaCliente = clienteNombre;
  document.getElementById('agregar-maquina-title').textContent = 'Editar Máquina';
  
  const select = document.getElementById('am-cliente');
  
  let optionExists = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === clienteNombre) { optionExists = true; break; }
  }
  if (!optionExists && clienteNombre) {
    const opt = document.createElement('option');
    opt.value = clienteNombre;
    opt.textContent = clienteNombre;
    select.appendChild(opt);
  }
  
  select.value = clienteNombre;
  if (currentSession.viewMode === 'superadmin') {
    select.removeAttribute('disabled');
  } else {
    select.setAttribute('disabled', 'true');
  }
  
  const selectUbicacion = document.getElementById('am-ubicacion-select');
  const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
  if (selectUbicacion && inputOtraUbicacion) {
    let optionsHtml = '<option value="" disabled selected>Seleccione una ubicación...</option>';
    const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
    if (clienteObj) {
      let sitios = clienteObj.sitios || [];
      if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
        sitios = [clienteObj.ubicacion, ...sitios];
      }
      sitios.forEach(s => {
        const sName = getSitioNombre(s);
        optionsHtml += `<option value="${sName}">${sName}</option>`;
      });
    }
    optionsHtml += '<option value="otra">Otra...</option>';
    selectUbicacion.innerHTML = optionsHtml;
    
    const newSelectUbicacion = selectUbicacion.cloneNode(true);
    selectUbicacion.parentNode.replaceChild(newSelectUbicacion, selectUbicacion);
    
    newSelectUbicacion.addEventListener('change', function() {
      if (this.value === 'otra') {
        inputOtraUbicacion.style.display = 'block';
        inputOtraUbicacion.focus();
      } else {
        inputOtraUbicacion.style.display = 'none';
      }
    });
    
    let maquina = clienteObj?.maquinas?.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
    if (!maquina) maquina = maquinariaDb.find(m => m.idInterno === idInterno || m.id === idInterno || m.serie === idInterno);
    
    if (maquina) {
        const selectMarca = document.getElementById('am-marca-select');
        const inputOtraMarca = document.getElementById('am-marca-otra');
        
        let marcaFound = false;
        Array.from(selectMarca.options).forEach(opt => {
          if (opt.value === maquina.marca) marcaFound = true;
        });

        if (marcaFound) {
          selectMarca.value = maquina.marca;
          inputOtraMarca.style.display = 'none';
          inputOtraMarca.value = '';
          inputOtraMarca.required = false;
        } else if (maquina.marca) {
          selectMarca.value = 'otra';
          inputOtraMarca.style.display = 'block';
          inputOtraMarca.value = maquina.marca;
          inputOtraMarca.required = true;
        } else {
          selectMarca.value = '';
        }

        document.getElementById('am-modelo').value = maquina.modelo || '';
        document.getElementById('am-serie').value = maquina.serie || '';
        if(document.getElementById('am-numeco')) document.getElementById('am-numeco').value = maquina.numeroEconomico || maquina.customData?.numeroEconomico || '';
        if(document.getElementById('am-nummotor')) document.getElementById('am-nummotor').value = maquina.numeroMotor || maquina.customData?.numeroMotor || '';
        document.getElementById('am-anio').value = maquina.anio || '';
        const idIntInput = document.getElementById('am-id-interno');
        if (idIntInput) {
            const isUUID = maquina.idInterno && maquina.idInterno.length > 30 && maquina.idInterno.includes('-');
            idIntInput.value = (maquina.idInterno && maquina.idInterno !== 'NA' && maquina.idInterno !== 'N/A' && maquina.idInterno !== maquina.id && !isUUID) ? maquina.idInterno : '';
        }
        
        const selectTipo = document.getElementById('am-tipo-maquina');
        const inputOtroTipo = document.getElementById('am-tipo-otro');
        let tipoFound = false;
        const mTipo = maquina.tipo || maquina.customData?.tipo;
        Array.from(selectTipo.options).forEach(opt => {
          if (opt.value === mTipo) tipoFound = true;
        });
        if (tipoFound) {
          selectTipo.value = mTipo;
          inputOtroTipo.style.display = 'none';
          inputOtroTipo.value = '';
          inputOtroTipo.required = false;
        } else if (mTipo && mTipo !== 'N/A') {
          selectTipo.value = 'Otra';
          inputOtroTipo.style.display = 'block';
          inputOtroTipo.value = mTipo;
          inputOtroTipo.required = true;
        } else {
          selectTipo.value = '';
        }
        
        const inputVenta = document.getElementById('am-venta');
        const checkTercero = document.getElementById('am-venta-tercero');
        const slider = document.getElementById('am-venta-tercero-slider');
        const knob = document.getElementById('am-venta-tercero-knob');
        
        const mVenta = maquina.venta || maquina.customData?.venta;
        if (mVenta === 'TERCERO') {
          checkTercero.checked = true;
          inputVenta.value = '';
          inputVenta.disabled = true;
          if (slider) slider.style.backgroundColor = 'var(--accent)';
          if (knob) knob.style.transform = 'translateX(16px)';
        } else {
          checkTercero.checked = false;
          inputVenta.value = mVenta || '';
          inputVenta.disabled = false;
          if (slider) slider.style.backgroundColor = '#ccc';
          if (knob) knob.style.transform = 'translateX(0)';
        }

        const mLatitud = maquina.latitud || maquina.customData?.latitud || '';
        const mLongitud = maquina.longitud || maquina.customData?.longitud || '';
        document.getElementById('am-latitud').value = mLatitud;
        document.getElementById('am-longitud').value = mLongitud;
        
        const currentSelectUbicacion = document.getElementById('am-ubicacion-select');
        let ubiFound = false;
        const mUbicacion = maquina.ubicacion || maquina.customData?.ubicacion;
        Array.from(currentSelectUbicacion.options).forEach(opt => {
          if (opt.value === mUbicacion) ubiFound = true;
        });
        
        if (ubiFound) {
          currentSelectUbicacion.value = mUbicacion;
          inputOtraUbicacion.style.display = 'none';
          inputOtraUbicacion.value = '';
        } else if (mUbicacion) {
          currentSelectUbicacion.value = 'otra';
          inputOtraUbicacion.style.display = 'block';
          inputOtraUbicacion.value = mUbicacion;
        } else {
          currentSelectUbicacion.value = '';
        }
        
        // Renderizar Custom Fields
        const customContainer = document.getElementById('am-custom-fields-container');
        if (customContainer) {
          if (maquina.customData && Object.keys(maquina.customData).length > 0) {
            customContainer.style.display = 'block';
            let customHtml = '<div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem;"><i data-lucide="database" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Datos SAP (Solo Lectura)</div><div class="form-grid" style="grid-template-columns:1fr 1fr;">';
            Object.entries(maquina.customData).forEach(([label, val]) => {
              customHtml += `
                <div class="form-group">
                  <label>${label}</label>
                  <input type="text" value="${val || 'N/A'}" readonly style="background:var(--bg-hover); color:var(--text-muted); border-style:dashed;" />
                </div>
              `;
            });
            customHtml += '</div>';
            customContainer.innerHTML = customHtml;
          } else {
            customContainer.style.display = 'none';
            customContainer.innerHTML = '';
          }
        }
        
        // Show delete button only if it's a manual machine
        const isManual = clienteObj?.maquinas?.some(m => m.idInterno === idInterno);
        const btnEliminar = document.getElementById('btn-eliminar-maquina');
        if (btnEliminar) {
          btnEliminar.style.display = isManual ? 'block' : 'none';
        }
      }
  }
}

function guardarNuevaMaquina(e) {
  e.preventDefault();
  const clienteSeleccionado = document.getElementById('am-cliente').value;
  const selectMarca = document.getElementById('am-marca-select');
  const inputOtraMarca = document.getElementById('am-marca-otra');
  const marca = selectMarca.value === 'otra' ? inputOtraMarca.value.trim() : selectMarca.value.trim();
  
  const selectTipo = document.getElementById('am-tipo-maquina');
  const inputOtroTipo = document.getElementById('am-tipo-otro');
  const tipo = selectTipo.value === 'Otra' ? inputOtroTipo.value.trim() : selectTipo.value.trim();

  const modelo = document.getElementById('am-modelo').value.trim();
  const serie = document.getElementById('am-serie').value.trim();
  const numeroEconomico = document.getElementById('am-numeco') ? document.getElementById('am-numeco').value.trim() : '';
  const numeroMotor = document.getElementById('am-nummotor') ? document.getElementById('am-nummotor').value.trim() : '';
  const anio = document.getElementById('am-anio').value.trim();
  const venta = document.getElementById('am-venta-tercero').checked ? 'TERCERO' : document.getElementById('am-venta').value;
  const selectUbicacion = document.getElementById('am-ubicacion-select');
  const inputOtraUbicacion = document.getElementById('am-ubicacion-otra');
  const ubicacion = selectUbicacion.value === 'otra' ? inputOtraUbicacion.value.trim() : selectUbicacion.value.trim();
  const latitud = document.getElementById('am-latitud').value.trim();
  const longitud = document.getElementById('am-longitud').value.trim();
  const inputIdInterno = document.getElementById('am-id-interno') ? document.getElementById('am-id-interno').value.trim() : '';
  const finalIdInterno = inputIdInterno || generarIdInternoMaquina(marca, venta || anio);

  if (!clienteSeleccionado || !modelo) return;

  // Buscar si el cliente existe en la DB
  let clienteObj = clientesDb.find(c => c.nombre === clienteSeleccionado);
  
  if (!clienteObj) {
    // Si no existe (es un cliente legacy), lo creamos en la DB
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: clienteSeleccionado,
      maquinas: []
    };
    clientesDb.push(clienteObj);
  }

  if (!clienteObj.maquinas) {
    clienteObj.maquinas = [];
  }

  if (editandoMaquinaId && editandoMaquinaCliente) {
    const maqDbIdx = maquinariaDb.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
    
    if (maqDbIdx >= 0) {
        // MÁQUINA DE SAP / SUPABASE
        maquinariaDb[maqDbIdx].cliente = clienteSeleccionado;
        maquinariaDb[maqDbIdx].marca = marca;
        maquinariaDb[maqDbIdx].modelo = modelo;
        maquinariaDb[maqDbIdx].serie = serie;
        maquinariaDb[maqDbIdx].numeroEconomico = numeroEconomico;
        maquinariaDb[maqDbIdx].numeroMotor = numeroMotor;
        maquinariaDb[maqDbIdx].anio = anio;
        maquinariaDb[maqDbIdx].tipo = tipo;
        
        maquinariaDb[maqDbIdx].idInterno = finalIdInterno;

        if (!maquinariaDb[maqDbIdx].customData) maquinariaDb[maqDbIdx].customData = {};
        maquinariaDb[maqDbIdx].customData.tipo = tipo;
        maquinariaDb[maqDbIdx].customData.numeroEconomico = numeroEconomico;
        maquinariaDb[maqDbIdx].customData.numeroMotor = numeroMotor;
        maquinariaDb[maqDbIdx].customData.venta = venta;
        maquinariaDb[maqDbIdx].customData.ubicacion = ubicacion;
        maquinariaDb[maqDbIdx].customData.latitud = latitud;
        maquinariaDb[maqDbIdx].customData.longitud = longitud;
        
        localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
        if (window.pushToSupabase) window.pushToSupabase('maquinaria', maquinariaDb[maqDbIdx]);
    } else {
        // MÁQUINA MANUAL (En clientesDb)
        if (clienteSeleccionado !== editandoMaquinaCliente) {
          const clienteAntiguo = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
          let maquinaDatos = { idInterno: finalIdInterno, marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, latitud, longitud, tipo };
          if (clienteAntiguo && clienteAntiguo.maquinas) {
            const oldIdx = clienteAntiguo.maquinas.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
            if (oldIdx >= 0) {
               maquinaDatos = { ...clienteAntiguo.maquinas[oldIdx], ...maquinaDatos, idInterno: finalIdInterno };
               clienteAntiguo.maquinas.splice(oldIdx, 1);
               if (window.pushToSupabase) window.pushToSupabase('clientes', clienteAntiguo);
            }
          }
          clienteObj.maquinas.push(maquinaDatos);
        } else {
          const maquinaIdx = clienteObj.maquinas.findIndex(m => m.idInterno === editandoMaquinaId || m.id === editandoMaquinaId || m.serie === editandoMaquinaId);
          if (maquinaIdx >= 0) {
            clienteObj.maquinas[maquinaIdx] = {
              ...clienteObj.maquinas[maquinaIdx],
              idInterno: finalIdInterno,
              marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, latitud, longitud, tipo
            };
          }
        }
    }
  } else {
    const idInterno = generarIdInternoMaquina(marca, venta || anio);
    clienteObj.maquinas.push({ idInterno, marca, modelo, serie, numeroEconomico, numeroMotor, anio, venta, ubicacion, latitud, longitud, tipo });
  }
  
  if (ubicacion) {
    if (!clienteObj.sitios) clienteObj.sitios = [];
    const isSapSite = sitiosDb.some(s => s.nombre === ubicacion);
    if (!isSapSite) {
      let sIdx = clienteObj.sitios.findIndex(s => getSitioNombre(s) === ubicacion);
      if (sIdx === -1) {
         clienteObj.sitios.push({ nombre: ubicacion, latitud, longitud });
      } else {
         if (typeof clienteObj.sitios[sIdx] === 'string') {
           clienteObj.sitios[sIdx] = { nombre: ubicacion, latitud, longitud };
         } else {
           if (latitud) clienteObj.sitios[sIdx].latitud = latitud;
           if (longitud) clienteObj.sitios[sIdx].longitud = longitud;
         }
      }
    } else {
      const sapSite = sitiosDb.find(s => s.nombre === ubicacion);
      if (sapSite) {
        if (latitud) sapSite.latitud = latitud;
        if (longitud) sapSite.longitud = longitud;
      }
    }
  }
  
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
  
  cerrarModalAgregarMaquina();
  if (document.getElementById('view-clientes').classList.contains('active')) {
    renderClientes();
  }
  if (document.getElementById('view-maquinaria').classList.contains('active')) {
    renderMaquinaria();
  }
  if (document.getElementById('modal-detalle-cliente').classList.contains('open')) {
    verDetalleCliente(clienteSeleccionado);
  }
  
  // Actualizar dropdowns si estamos en medio de crear un ticket o servicio
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const mFullName = MARCAS_RENDER[(marca || '').toUpperCase()] || marca || '';
  const mName = `${mFullName} ${modelo || ''} (SN: ${serie || ''})`.trim();
  if (document.getElementById('modal-ticket')?.classList.contains('open')) {
    const tCli = document.getElementById('t-cliente').value;
    if (tCli === clienteSeleccionado) {
      poblarMaquinasCliente('t-equipo', mName, tCli);
      if (typeof onEquipoTicketChange === 'function') onEquipoTicketChange();
    }
  }
  if (document.getElementById('view-servicios')?.classList.contains('active')) {
    const fCli = document.getElementById('f-cliente').value;
    if (fCli === clienteSeleccionado) {
      poblarMaquinasCliente('f-equipo', mName, fCli);
      if (typeof onEquipoOrdenChange === 'function') onEquipoOrdenChange();
    }
  }
}

function eliminarMaquinaActual() {
  if (!editandoMaquinaId || !editandoMaquinaCliente) return;

  const confirmar = confirm(`¿Estás seguro de que deseas eliminar la máquina ${editandoMaquinaId}? Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  const clienteObj = clientesDb.find(c => c.nombre === editandoMaquinaCliente);
  if (!clienteObj || !clienteObj.maquinas) return;

  const maquinaIdx = clienteObj.maquinas.findIndex(m => m.idInterno === editandoMaquinaId);
  if (maquinaIdx >= 0) {
    clienteObj.maquinas.splice(maquinaIdx, 1);
    
    // Guardar cambios
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
    
    cerrarModalAgregarMaquina();
    
    // Renderizar vistas actualizadas
    if (document.getElementById('view-clientes').classList.contains('active')) {
      renderClientes();
    }
    if (document.getElementById('view-maquinaria').classList.contains('active')) {
      renderMaquinaria();
    }
    if (document.getElementById('modal-detalle-cliente').classList.contains('open')) {
      verDetalleCliente(editandoMaquinaCliente);
    }
    
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`Máquina ${editandoMaquinaId} eliminada correctamente.`, 'success');
    }
  }
}

// ===== MODAL MOVER MÁQUINA =====
function abrirModalMoverMaquina(clienteNombre, idInterno) {
  document.getElementById('form-mover-maquina').reset();
  document.getElementById('mm-cliente').value = clienteNombre;
  document.getElementById('mm-idInterno').value = idInterno;
  
  const selectUbi = document.getElementById('mm-ubicacion');
  if (selectUbi) {
    selectUbi.innerHTML = '<option value="">Selecciona un sitio registrado...</option>';
    const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
    if (clienteObj) {
      const sitios = getNombresDeSitiosParaCliente(clienteObj);
      sitios.forEach(sn => {
        const option = document.createElement('option');
        option.value = sn;
        option.textContent = sn;
        selectUbi.appendChild(option);
      });
    }
  }
  document.getElementById('modal-mover-maquina-overlay').classList.add('open');
}

function cerrarModalMoverMaquina(e) {
  if (e && e.target !== document.getElementById('modal-mover-maquina-overlay')) return;
  document.getElementById('modal-mover-maquina-overlay').classList.remove('open');
}

function guardarMoverMaquina(e) {
  e.preventDefault();
  const clienteNombre = document.getElementById('mm-cliente').value;
  const idInterno = document.getElementById('mm-idInterno').value;
  const nuevaUbicacion = document.getElementById('mm-ubicacion').value.trim();
  
  if (!nuevaUbicacion) return;

  const clienteObj = clientesDb.find(c => c.nombre === clienteNombre);
  if (clienteObj && clienteObj.maquinas) {
    const maq = clienteObj.maquinas.find(m => m.idInterno === idInterno);
    if (maq) {
      maq.ubicacion = nuevaUbicacion;
      
      // Auto-add to sitios if not there
      if (!clienteObj.sitios) clienteObj.sitios = [];
      if (!clienteObj.sitios.includes(nuevaUbicacion)) {
        clienteObj.sitios.push(nuevaUbicacion);
      }
      
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
      
      cerrarModalMoverMaquina();
      
      // Re-render
      if (document.getElementById('modal-detalle-cliente-overlay').classList.contains('open')) {
        verDetalleCliente(clienteNombre);
      }
      if (document.getElementById('view-maquinaria').classList.contains('active')) {
        renderMaquinaria();
      }
    }
  }
}

// ===== CONFIG PERMISOS ROLES =====
function renderPermisosRoles() {
  const table = document.getElementById('tabla-permisos-roles');
  if (!table) return;

  const todasLasVistas = Object.keys(ROLES_LABELS);
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];

  let html = `
    <thead>
      <tr>
        <th style="text-align:left;">Vista</th>
        ${rolesParaEditar.map(r => `<th style="text-align:center;">${ROLES[r].label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
  `;

  todasLasVistas.forEach(vista => {
    html += `<tr>`;
    html += `<td style="font-weight:500;">${ROLES_LABELS[vista]}</td>`;
    rolesParaEditar.forEach(r => {
      const tieneVista = ROLES[r].views.includes(vista);
      // Opcional: hacer que el superadmin no pueda quitarse el dashboard o config, 
      // pero por ahora lo dejamos libre como lo pide el usuario.
      html += `
        <td style="text-align:center; vertical-align:middle;">
          <input type="checkbox" class="cb-permiso-rol" data-rol="${r}" data-vista="${vista}" ${tieneVista ? 'checked' : ''} style="width:1.2rem; height:1.2rem; cursor:pointer;" />
        </td>
      `;
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

function guardarPermisosRoles() {
  const checkboxes = document.querySelectorAll('.cb-permiso-rol');
  
  // Reset all mutable roles
  const rolesParaEditar = ['superadmin', 'admin', 'supervisor', 'tecnico', 'empresa', 'consulta'];
  rolesParaEditar.forEach(r => ROLES[r].views = []);
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      ROLES[cb.dataset.rol].views.push(cb.dataset.vista);
    }
  });
  
  localStorage.setItem('sapi_roles_config', JSON.stringify(ROLES));
  if (window.pushToSupabase) window.pushToSupabase('roles', ROLES);
  
  // Recargar la UI
  setupNav();
  
  // Feedback visual
  const btn = document.querySelector('button[onclick="guardarPermisosRoles()"]');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
  btn.style.background = 'var(--green)';
  lucide.createIcons();
  
  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.style.background = 'var(--primary)';
    lucide.createIcons();
  }, 2000);
}

// ===== CONFIG TÉCNICOS =====
let currentTecView = 'galeria';

function setTecView(view) {
  currentTecView = view;
  document.getElementById('btn-tec-galeria').style.background = view === 'galeria' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-tec-galeria').style.color = view === 'galeria' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-tec-galeria').style.borderColor = view === 'galeria' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('btn-tec-lista').style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
  document.getElementById('btn-tec-lista').style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-tec-lista').style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  
  document.getElementById('tecnicos-grid').style.display = view === 'galeria' ? 'grid' : 'none';
  document.getElementById('tecnicos-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
}

function renderTecnicos() {
  const grid = document.getElementById('tecnicos-grid');
  const tbody = document.getElementById('tecnicos-table-body');
  
  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };
  
  // Combine legacy technitians from orders with actual registered user technitians and SAP technitians
  const legacyTecs = ordenes.map(o => o.tecnico).filter(Boolean).map(formatNombreCorto);
  const userTecs = usuarios.filter(u => u.rol === 'tecnico').map(u => formatNombreCorto(u.nombre));
  const sapTecs = tecnicosDb.map(t => formatNombreCorto(t.nombre)).filter(Boolean);
  
  let tecsArr = [];
  if (API_CONFIG.USE_SAP_BACKEND && sapTecs.length > 0) {
    // Si SAP está activo, usar ESTRICTAMENTE los técnicos activos de SAP para evitar revivir inactivos del historial
    tecsArr = [...sapTecs];
  } else {
    tecsArr = [...legacyTecs, ...userTecs, ...sapTecs];
  }
  
  // Filtrar explícitamente cualquier técnico que se llame "N/A" (proveniente de bases locales viejas)
  // y también excluir a los usuarios que tengan el rol o tipo de usuario "consulta"
  const tecs = [...new Set(tecsArr)]
    .filter(t => !t.toUpperCase().includes('N/A') && t.trim() !== '')
    .filter(t => {
      const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t) || usuarios.find(u => formatNombreCorto(u.nombre) === t);
      const tRol = (tecObj?.tipoUsuario || tecObj?.rol || '').toLowerCase();
      return !tRol.includes('consulta');
    })
    .sort();
  
  if (!tecs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">Sin técnicos registrados aún.</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Sin técnicos registrados aún.</td></tr>`;
    return;
  }
  
  grid.innerHTML = tecs.map(t => {
    const total = ordenes.filter(o => formatNombreCorto(o.tecnico) === t).length;
    const comp = ordenes.filter(o => formatNombreCorto(o.tecnico) === t && o.estado === 'Completado').length;
    
    // Calcular Siguiente Ticket y Último Resuelto usando el sistema de tickets
    const tTickets = tickets.filter(tk => formatNombreCorto(tk.asignado) === t);
    const ticketsAbiertos = tTickets.filter(tk => tk.estado !== 'Resuelto' && tk.estado !== 'Cerrado');
    const proxTicket = ticketsAbiertos.length > 0 ? ticketsAbiertos[0] : null; // El más antiguo abierto
    
    const ticketsCerrados = tTickets.filter(tk => tk.estado === 'Resuelto' || tk.estado === 'Cerrado');
    const ultResuelto = ticketsCerrados.length > 0 ? ticketsCerrados[ticketsCerrados.length - 1] : null; // El más reciente cerrado

    const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t);
    const celular = tecObj?.celular || 'Sin celular';
    const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

    const proxTxt = proxTicket ? `<span style="color:var(--text-primary);">${proxTicket.cliente}</span> <span style="color:var(--text-muted);">(${proxTicket.fecha})</span>` : '<span style="color:var(--text-muted);">Ninguno</span>';
    const ultTxt = ultResuelto ? `<span style="color:var(--text-primary);">${ultResuelto.cliente}</span> <span style="color:var(--text-muted);">(${ultResuelto.fecha})</span>` : '<span style="color:var(--text-muted);">Ninguno</span>';

    return `
    <div class="card-person" onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer; display:flex; flex-direction:column; gap:0.5rem; padding:1.25rem;">
      <div>
        <div class="card-person-name" style="margin-bottom:0.2rem;">${t}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> ${tipoUsuario}</span>
          <span>&bull;</span>
          <span style="display:flex; align-items:center; gap:0.2rem;"><i data-lucide="phone" style="width:12px;height:12px;"></i> ${celular}</span>
        </div>
        <div class="card-person-sub" style="display:flex; justify-content:space-between;">
          <span>${total} servicio(s) históricos</span>
          <span style="color:var(--green); font-weight:500;">${comp} Completados</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.4rem; font-size:0.8rem;">
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="calendar-clock" style="width:14px;height:14px;color:var(--accent);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Siguiente Ticket</div>
            ${proxTxt}
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.4rem;">
          <i data-lucide="check-circle-2" style="width:14px;height:14px;color:var(--green);margin-top:2px;flex-shrink:0;"></i>
          <div style="line-height:1.2;">
            <div style="font-weight:600; color:var(--text-secondary); font-size:0.7rem; text-transform:uppercase; margin-bottom:2px;">Último Resuelto</div>
            ${ultTxt}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  if (tbody) {
    tbody.innerHTML = tecs.map(t => {
      const total = ordenes.filter(o => formatNombreCorto(o.tecnico) === t).length;
      const comp = ordenes.filter(o => formatNombreCorto(o.tecnico) === t && o.estado === 'Completado').length;

      const tTickets = tickets.filter(tk => formatNombreCorto(tk.asignado) === t);
      const ticketsAbiertos = tTickets.filter(tk => tk.estado !== 'Resuelto' && tk.estado !== 'Cerrado');
      const proxTicket = ticketsAbiertos.length > 0 ? ticketsAbiertos[0] : null; 
      
      const ticketsCerrados = tTickets.filter(tk => tk.estado === 'Resuelto' || tk.estado === 'Cerrado');
      const ultResuelto = ticketsCerrados.length > 0 ? ticketsCerrados[ticketsCerrados.length - 1] : null;

      const tecObj = tecnicosDb.find(x => formatNombreCorto(x.nombre) === t);
      const celular = tecObj?.celular || 'Sin celular';
      const tipoUsuario = tecObj?.tipoUsuario || 'Técnico';

      const proxTxt = proxTicket ? `<div style="font-weight:500;">${proxTicket.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${proxTicket.fecha}</div>` : '<span style="color:var(--text-muted);">Ninguno</span>';
      const ultTxt = ultResuelto ? `<div style="font-weight:500;">${ultResuelto.cliente}</div><div style="font-size:0.75rem; color:var(--text-muted);">${ultResuelto.fecha}</div>` : '<span style="color:var(--text-muted);">Ninguno</span>';

      return `
        <tr onclick="verDetalleTecnico('${t.replace(/'/g, "\\'")}')" style="cursor:pointer;" class="hover-row">
          <td>
            <div style="font-weight:500;">${t}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
              <span>${tipoUsuario}</span> &bull; <span>${celular}</span>
            </div>
          </td>
          <td>${total}</td>
          <td><span class="badge badge-completado">${comp} completados</span></td>
          <td>${proxTxt}</td>
          <td>${ultTxt}</td>
        </tr>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

function verDetalleTecnico(nombre) {
  document.getElementById('tecnico-detalle-title').innerHTML = `<i data-lucide="user" style="color:var(--accent);"></i> Perfil: ${nombre}`;
  
  const tUser = usuarios.find(u => u.nombre === nombre);
  
  // Find assigned clients
  let assignedClients = [];
  if (tUser) {
    assignedClients = clientesDb.filter(c => 
      (c.tecnicosAsignados && c.tecnicosAsignados.includes(tUser.id)) ||
      (c.tecnicoAsignado === tUser.id)
    );
  }
  
  // Find resolved tickets (Tickets have string assigned, e.g. "Juan Perez")
  // Tickets are usually assigned to a string. Or if it's multiple, they are comma separated.
  const resolvedTickets = tickets.filter(t => 
    t.estado === 'Resuelto' && 
    t.asignado && 
    t.asignado.split(',').map(s=>s.trim()).includes(nombre)
  );

  let html = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom:1.5rem;">
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Estado</div>
        <div style="font-weight: 500; font-size: 1.1rem; color: var(--green);">Activo</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Correo</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.email || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Celular</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${tUser?.telefono || 'N/A'}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Clientes Asignados</div>
        <div style="font-weight: 500; color: var(--text-primary); font-size: 1.1rem;">${assignedClients.length}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Tickets Resueltos</div>
        <div style="font-weight: 500; color: var(--accent); font-size: 1.1rem;">${resolvedTickets.length}</div>
      </div>
    </div>
  `;

  if (assignedClients.length > 0) {
    html += `
      <div style="margin-bottom:1.5rem;">
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="building-2" style="width:18px;height:18px;color:var(--text-muted);"></i> Empresas Asignadas
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${assignedClients.map(c => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${c.nombre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${c.ubicacion || 'Sin ubicación'}</div>
              </div>
              <button class="action-btn" onclick="cerrarDetalleTecnico(); verDetalleCliente('${c.nombre.replace(/'/g, "\\'")}')" style="font-size:0.75rem;">Ver Perfil</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (resolvedTickets.length > 0) {
    html += `
      <div>
        <h3 style="font-size:1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
          <i data-lucide="check-circle" style="width:18px;height:18px;color:var(--text-muted);"></i> Tickets Resueltos Recientes
        </h3>
        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:200px; overflow-y:auto; padding-right:0.5rem;">
          ${resolvedTickets.slice(0, 10).map(t => `
            <div style="background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight:500; color:var(--text-primary);">${t.folio} - ${t.asunto || 'Sin título'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${t.cliente || 'Uso Interno'} • ${t.fechaCreacion.split('T')[0].split('-').reverse().join('/')}</div>
              </div>
              <span class="badge badge-resuelto">Resuelto</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('detalle-tecnico-body').innerHTML = html;
  document.getElementById('modal-detalle-tecnico-overlay').classList.add('open');
  lucide.createIcons();
}

function cerrarDetalleTecnico(e) {
  if (e && e.target !== document.getElementById('modal-detalle-tecnico-overlay')) return;
  document.getElementById('modal-detalle-tecnico-overlay').classList.remove('open');
}

// ===== DIAS PANELS =====
function initDiasPanels() {
  const container = document.getElementById('dia-panels');
  container.innerHTML = DIAS.map((dia, i) => `
    <div class="dia-panel ${i===0?'active':''}" id="panel-${dia}">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="${dia}-fecha" onchange="autoCompletarFechas('${dia}', this.value)"/>
      </div>
      <div class="form-group">
        <label>Origen → Trabajo (hrs)</label>
        <input type="number" id="${dia}-traslado-ida" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Trabajo → Origen (hrs)</label>
        <input type="number" id="${dia}-traslado-vuelta" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Entrada</label>
        <input type="time" id="${dia}-entrada" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Salida</label>
        <input type="time" id="${dia}-salida" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Horas Normales</label>
        <input type="number" id="${dia}-normales" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Horas Extra</label>
        <input type="number" id="${dia}-extras" min="0" step="0.5"/>
      </div>
    </div>
  `).join('');
}

function calcularHorasDia(dia) {
  const entrada = document.getElementById(`${dia}-entrada`).value;
  const salida = document.getElementById(`${dia}-salida`).value;
  if (!entrada || !salida) return;
  
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  
  let totalMinutos = (sh * 60 + sm) - (eh * 60 + em);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  let totalHoras = totalMinutos / 60;
  let normales = Math.min(totalHoras, 8);
  let extras = totalHoras > 8 ? totalHoras - 8 : 0;
  
  document.getElementById(`${dia}-normales`).value = normales > 0 ? parseFloat(normales.toFixed(2)) : '';
  document.getElementById(`${dia}-extras`).value = extras > 0 ? parseFloat(extras.toFixed(2)) : '';
}

function autoCompletarFechas(diaOrigen, fechaStr) {
  if (!fechaStr) return;
  const origenIndex = DIAS.indexOf(diaOrigen);
  if (origenIndex === -1) return;
  
  const [year, month, day] = fechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  
  const dayOfWeek = baseDate.getDay();
  const expectedDayOfWeek = origenIndex === 6 ? 0 : origenIndex + 1;
  
  if (dayOfWeek !== expectedDayOfWeek) {
    mostrarNotificacion(`La fecha seleccionada no corresponde al día ${diaOrigen.toUpperCase()}.`, 'warning');
    document.getElementById(`${diaOrigen}-fecha`).value = '';
    return;
  }
  
  DIAS.forEach((dia, i) => {
    if (i === origenIndex) return;
    const diff = i - origenIndex;
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + diff);
    
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(newDate.getDate()).padStart(2, '0');
    
    const el = document.getElementById(`${dia}-fecha`);
    if (el && !el.value) { // Solo si está vacío
      el.value = `${y}-${m}-${d}`;
    }
  });
}

function selDia(btn, dia) {
  document.querySelectorAll('.dia-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dia-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + dia).classList.add('active');
}

// ===== KM CALC =====
function calcKmTotal() {
  const ida = parseFloat(document.getElementById('f-km-ida').value) || 0;
  const vuelta = parseFloat(document.getElementById('f-km-vuelta').value) || 0;
  document.getElementById('f-km-total').value = ida + vuelta;
}

// ===== REFACCIONES (ORDEN SERVICIO) =====
window.popularSelectMarcas = function(selectEl) {
  if (!selectEl) return;
  // Extraer marcas unicas validas
  const marcas = [...new Set(refaccionesDb.map(r => r.marca))].filter(m => m && m !== 'N/A').sort();
  let html = '<option value="">Marca...</option>';
  marcas.forEach(m => { html += `<option value="${m}">${m}</option>`; });
  selectEl.innerHTML = html;
};

window.popularSelectMarcas = function(comboIdMarca, comboIdDesc) {
  const optionsDiv = document.getElementById(comboIdMarca + '-options');
  if (!optionsDiv) return;
  const marcas = [...new Set(refaccionesDb.map(r => r.marca))].filter(m => m && m !== 'N/A').sort();
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  let html = '';
  marcas.forEach(m => {
    const mFull = MARCAS_RENDER[m.toUpperCase()] || m;
    html += `<div class="combo-option" onclick="window.seleccionarMarcaRefaccion(this, '${m}', '${mFull}', '${comboIdMarca}', '${comboIdDesc}')">${mFull}</div>`;
  });
  optionsDiv.innerHTML = html;
};

window.seleccionarMarcaRefaccion = function(optionEl, marcaCode, marcaFull, comboIdMarca, comboIdDesc) {
  const comboMenu = optionEl.closest('.combo-menu');
  
  // Close the menu
  comboMenu.classList.remove('open');
  document.getElementById(comboIdMarca + '-combo').classList.remove('focus');
  
  // Update hidden input and display text
  document.getElementById(comboIdMarca).value = marcaCode;
  document.getElementById(comboIdMarca + '-display').textContent = marcaFull;
  
  // Trigger update descripciones
  window.actualizarDescripcionesCombo(comboIdMarca, comboIdDesc);
};

window.actualizarDescripcionesCombo = function(comboIdMarca, comboIdDesc) {
  const marcaSel = document.getElementById(comboIdMarca).value;
  const optionsDiv = document.getElementById(comboIdDesc + '-options');
  const row = document.getElementById(comboIdDesc).closest('.ref-row');
  const inputClave = row.querySelector('.ref-clave');
  const inputPrecio = row.querySelector('.ref-precio');
  const hiddenDesc = document.getElementById(comboIdDesc);
  const displaySpan = document.getElementById(comboIdDesc + '-display');
  
  if (inputClave) inputClave.value = '';
  if (inputPrecio) inputPrecio.value = '';
  if (hiddenDesc) hiddenDesc.value = '';
  if (displaySpan) displaySpan.textContent = 'Descripción...';
  
  let html = '';
  if (marcaSel) {
    const refsPorMarca = refaccionesDb.filter(r => r.marca === marcaSel).sort((a,b) => (a.descripcion||'').localeCompare(b.descripcion||''));
    refsPorMarca.forEach(r => {
      html += `<div class="combo-option" onclick="window.seleccionarDescRefaccion(this, '${comboIdDesc}', '${r.id || r.codigo}', ${r.precio || 0})">${r.descripcion}</div>`;
    });
  } else {
    html = `<div class="combo-option" style="color:var(--text-muted)">Seleccione una marca primero</div>`;
  }
  if (optionsDiv) optionsDiv.innerHTML = html;
};

window.seleccionarDescRefaccion = function(optionEl, comboIdDesc, clave, precio) {
  const text = optionEl.textContent;
  const comboMenu = optionEl.closest('.combo-menu');
  
  // Close the menu
  comboMenu.classList.remove('open');
  document.getElementById(comboIdDesc + '-combo').classList.remove('focus');
  
  // Update hidden input and display text
  document.getElementById(comboIdDesc).value = text;
  document.getElementById(comboIdDesc + '-display').textContent = text;
  
  // Update Clave and Precio
  const row = optionEl.closest('.ref-row');
  const inputClave = row.querySelector('.ref-clave');
  const inputPrecio = row.querySelector('.ref-precio');
  if (inputClave) inputClave.value = clave || '';
  if (inputPrecio) inputPrecio.value = precio || '';
};

let refComboCounter = 0;

function agregarRef(section) {
  const list = document.getElementById(`ref-${section}-list`);
  const row = document.createElement('div');
  row.className = 'ref-row';
  row.dataset.section = section;
  
  refComboCounter++;
  const idComboMarca = `ref-marca-combo-${refComboCounter}`;
  const idComboDesc = `ref-desc-combo-${refComboCounter}`;
  
  let html = `
    <!-- MARCA COMBO -->
    <div style="flex: 1.2; min-width: 100px; position:relative;" class="group-ref-marca">
      <div class="combo-box" tabindex="0" id="${idComboMarca}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboMarca}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Marca...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboMarca}-menu" style="width: 250px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboMarca}-search" placeholder="Buscar..." oninput="filterCombo('${idComboMarca}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboMarca}-options">
          <!-- Populated by popularSelectMarcas -->
        </div>
      </div>
      <input type="hidden" class="ref-marca" id="${idComboMarca}" />
    </div>
    
    <!-- DESC COMBO -->
    <div style="flex: 2; position:relative; min-width: 120px;" class="group-ref-desc">
      <div class="combo-box" tabindex="0" id="${idComboDesc}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboDesc}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Descripción...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboDesc}-menu" style="width: 100%; min-width: 300px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboDesc}-search" placeholder="Buscar..." oninput="filterCombo('${idComboDesc}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboDesc}-options">
          <div class="combo-option" style="color:var(--text-muted)">Seleccione una marca primero</div>
        </div>
      </div>
      <input type="hidden" class="ref-desc-hidden ref-desc" id="${idComboDesc}" />
    </div>

    <input type="text" placeholder="Clave" class="ref-clave" style="width:70px; padding: 0.45rem 0.4rem; font-size:0.8rem;" readonly />
    <input type="number" placeholder="Cant." class="ref-cant" style="width:50px; padding: 0.45rem 0.4rem; font-size:0.8rem;" min="1" value="1"/>`;
    
  if (section === 'utilizadas') {
    html += `<input type="number" placeholder="Precio" class="ref-precio" style="width:70px; display:none; padding: 0.45rem 0.4rem; font-size:0.8rem;" step="0.01"/>`;
  }
  
  html += `<button type="button" class="btn-del-ref" onclick="eliminarRef(this)">✕</button>`;
  
  row.innerHTML = html;
  list.appendChild(row);
  
  if (window.lucide) window.lucide.createIcons({ root: row });
  
  // Attach Event Listeners dynamically
  const comboMarca = document.getElementById(`${idComboMarca}-combo`);
  if (comboMarca) {
    comboMarca.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboMarca);
    });
  }
  
  const comboDesc = document.getElementById(`${idComboDesc}-combo`);
  if (comboDesc) {
    comboDesc.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboDesc);
    });
  }
  
  // Prevent menu clicks from bubbling
  const menuMarca = document.getElementById(`${idComboMarca}-menu`);
  if (menuMarca) menuMarca.addEventListener('click', e => e.stopPropagation());
  
  const menuDesc = document.getElementById(`${idComboDesc}-menu`);
  if (menuDesc) menuDesc.addEventListener('click', e => e.stopPropagation());
  
  // Popular el select de marca en esta nueva fila
  window.popularSelectMarcas(idComboMarca, idComboDesc);
}

function eliminarRef(btn) {
  const row = btn.closest('.ref-row');
  const list = row.parentElement;
  if (list.querySelectorAll('.ref-row').length > 1) row.remove();
}

function getRefacciones(section) {
  const rows = document.querySelectorAll(`#ref-${section}-list .ref-row`);
  const result = [];
  rows.forEach(row => {
    const desc = row.querySelector('.ref-desc')?.value?.trim();
    if (!desc) return;
    const item = {
      descripcion: desc,
      clave: row.querySelector('.ref-clave')?.value?.trim(),
      cantidad: row.querySelector('.ref-cant')?.value,
    };
    if (section === 'utilizadas') item.precio = row.querySelector('.ref-precio')?.value;
    result.push(item);
  });
  return result;
}

function setRefacciones(section, items) {
  const list = document.getElementById(`ref-${section}-list`);
  list.innerHTML = '';
  const toSet = items.length ? items : [{}];
  toSet.forEach(item => {
    agregarRef(section);
    const row = list.lastElementChild;
    if (item.descripcion) {
      // Find marca from refaccionesDb
      let foundMarca = '';
      if (item.clave) {
        const match = refaccionesDb.find(r => r.id === item.clave || r.codigo === item.clave);
        if (match) foundMarca = match.marca;
      }
      if (!foundMarca) {
        const match = refaccionesDb.find(r => r.descripcion === item.descripcion);
        if (match) foundMarca = match.marca;
      }
      
      const hiddenMarca = row.querySelector('.ref-marca');
      const hiddenDesc = row.querySelector('.ref-desc-hidden');
      const comboSpanMarca = document.getElementById(hiddenMarca.id + '-display');
      const comboOptions = document.getElementById(hiddenDesc.id + '-options');
      const comboSpanDesc = document.getElementById(hiddenDesc.id + '-display');
      
      if (foundMarca) {
        hiddenMarca.value = foundMarca;
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[foundMarca.toUpperCase()] || foundMarca;
      }
      
      // Update descripciones based on the marca
      window.actualizarDescripcionesCombo(hiddenMarca.id, hiddenDesc.id);
      
      // Check if description exists in options
      let optExists = false;
      if (comboOptions) {
        comboOptions.querySelectorAll('.combo-option').forEach(opt => {
          if (opt.textContent === item.descripcion) optExists = true;
        });
      }
      
      // If the description is not in the options, add it as a legacy option
      if (!optExists && item.descripcion && comboOptions) {
        const legacyHtml = `<div class="combo-option" onclick="window.seleccionarDescRefaccion(this, '${hiddenDesc.id}', '${item.clave || ''}', ${item.precio || 0})">${item.descripcion}</div>`;
        if (comboOptions.innerHTML.includes('Seleccione una marca')) {
          comboOptions.innerHTML = legacyHtml;
        } else {
          comboOptions.innerHTML += legacyHtml;
        }
      }
      
      hiddenDesc.value = item.descripcion;
      if (comboSpanDesc) comboSpanDesc.textContent = item.descripcion;
    }
    
    if (item.clave) row.querySelector('.ref-clave').value = item.clave;
    if (item.cantidad) row.querySelector('.ref-cant').value = item.cantidad;
    if (section === 'utilizadas' && item.precio) row.querySelector('.ref-precio').value = item.precio;
  });
}

// ===== DIAS DATA =====
function getDiasData() {
  const data = {};
  DIAS.forEach(dia => {
    data[dia] = {
      fecha: document.getElementById(`${dia}-fecha`)?.value,
      trasladoIda: document.getElementById(`${dia}-traslado-ida`)?.value,
      trasladoVuelta: document.getElementById(`${dia}-traslado-vuelta`)?.value,
      entrada: document.getElementById(`${dia}-entrada`)?.value,
      salida: document.getElementById(`${dia}-salida`)?.value,
      normales: document.getElementById(`${dia}-normales`)?.value,
      extras: document.getElementById(`${dia}-extras`)?.value,
    };
  });
  return data;
}

function setDiasData(data) {
  if (!data) return;
  DIAS.forEach(dia => {
    if (!data[dia]) return;
    const d = data[dia];
    if (d.fecha) document.getElementById(`${dia}-fecha`).value = d.fecha;
    if (d.trasladoIda) document.getElementById(`${dia}-traslado-ida`).value = d.trasladoIda;
    if (d.trasladoVuelta) document.getElementById(`${dia}-traslado-vuelta`).value = d.trasladoVuelta;
    if (d.entrada) document.getElementById(`${dia}-entrada`).value = d.entrada;
    if (d.salida) document.getElementById(`${dia}-salida`).value = d.salida;
    if (d.normales) document.getElementById(`${dia}-normales`).value = d.normales;
    if (d.extras) document.getElementById(`${dia}-extras`).value = d.extras;
  });
}

// ===== FORM =====
function generarFolioConsecutivo() {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = `OS-${currentYear}`;
  let maxConsecutivo = 0;
  
  ordenes.forEach(o => {
    if (o.folio && typeof o.folio === 'string' && o.folio.startsWith(prefix)) {
      const numStr = o.folio.substring(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxConsecutivo) {
        maxConsecutivo = num;
      }
    }
  });
  
  maxConsecutivo++;
  const padded = maxConsecutivo.toString().padStart(3, '0');
  return `${prefix}${padded}`;
}

function abrirFormulario(id, modoReporte = false) {
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar órdenes.', 'error');
    return;
  }
  editandoId = id || null;
  document.getElementById('modal-title').textContent = modoReporte ? 'Llenar Reporte Técnico' : (id ? 'Editar Orden' : 'Nueva Orden de Servicio');
  document.getElementById('form-orden').reset();
  
  const sectionEstado = document.getElementById('section-estado-orden');
  if (sectionEstado) {
    if (currentSession.viewMode === 'superadmin') {
      sectionEstado.style.display = 'block';
    } else {
      sectionEstado.style.display = 'none';
    }
  }
  
  if (!id) {
    document.getElementById('f-folio').value = generarFolioConsecutivo();
  }
  
  initDiasPanels();
  setRefacciones('utilizadas', []);
  setRefacciones('necesarias', []);
  
  const elSoporte = document.getElementById('f-soporte');
  if (elSoporte) {
    elSoporte.innerHTML = '<option value="">Ninguno</option>';
  }

  // Llenar combo de clientes para Orden de Servicio
  const fClienteOptions = document.getElementById('f-cliente-options');
  const fClienteHidden = document.getElementById('f-cliente');
  const fClienteDisplay = document.getElementById('f-cliente-display');
  
  if (fClienteOptions) {
    fClienteHidden.value = '';
    fClienteDisplay.textContent = 'Seleccionar cliente...';
    fClienteOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('f-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      fClienteOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('f-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (!o) return;
    const fields = ['folio','pedido','ubicacion','operador','eco','horometro','horometro-real',
      'modelo','serie','soporte','km-ida','km-vuelta','km-total',
      'falla','trabajos','dictamen','condiciones','observaciones','pendientes',
      'noches','alimentacion','traslado-costo'];
    fields.forEach(f => {
      const el = document.getElementById('f-' + f);
      if (el && o[f.replace(/-/g,'_')] !== undefined) el.value = o[f.replace(/-/g,'_')];
    });
    
    if (o.cliente) {
      if (fClienteOptions) {
        selectComboOption('f-cliente', o.cliente, o.cliente, true); // true = isInitial
      } else {
        const elCliente = document.getElementById('f-cliente');
        if (elCliente) elCliente.value = o.cliente;
      }
    }
    poblarSoportesPorCliente(o.cliente, o.soporte);
    // tipo radio
    const radio = document.querySelector(`input[name="tipo"][value="${o.tipo}"]`);
    if (radio) radio.checked = true;
    // estado
    const sel = document.getElementById('f-estado');
    if (sel && o.estado) sel.value = o.estado;
    
    // Poblar tickets para la edición
    if (elSoporte && o.soporte) {
      const t = tickets.find(x => x.id === o.soporte);
      if (t && !Array.from(elSoporte.options).some(opt => opt.value === t.id)) {
        elSoporte.innerHTML += `<option value="${t.id}">${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}</option>`;
      }
      elSoporte.value = o.soporte;
    }
    
    // refacciones
    if (o.ref_utilizadas?.length) setRefacciones('utilizadas', o.ref_utilizadas);
    if (o.ref_necesarias?.length) setRefacciones('necesarias', o.ref_necesarias);
    // dias
    setDiasData(o.dias);
  } else {
    // Nueva Orden
    poblarSoportesPorCliente('');
  }
  
  // Los técnicos se extraen automáticamente del ticket al guardar
  
  poblarMaquinasCliente('f-equipo', id ? ordenes.find(x => x.id === id)?.equipo : '', id ? ordenes.find(x => x.id === id)?.cliente : '');
  
  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (o && o.soporte) {
      const elSoporte = document.getElementById('f-soporte');
      if (elSoporte) elSoporte.value = o.soporte;
    }
  }

  onSoporteChange(); // Sincroniza el pedido y metadata

  // Bloquear campos base si la orden viene de un ticket o si es técnico
  const isTecnico = currentSession.viewMode === 'tecnico';
  const soporteActual = document.getElementById('f-soporte').value;
  const lockFields = (isTecnico || soporteActual);

  const camposBloqueados = ['f-folio', 'f-pedido', 'f-ubicacion', 'f-modelo', 'f-serie', 'f-soporte', 'f-equipo'];
  camposBloqueados.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      if (el.tagName === 'SELECT') {
        el.disabled = !!lockFields;
      } else {
        el.readOnly = !!lockFields;
      }
      el.style.background = lockFields ? 'var(--bg-secondary)' : '';
    }
  });

  const fClienteCombo = document.getElementById('f-cliente-combo');
  if (fClienteCombo) {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    let lockCliente = false;
    let isCerrado = false;

    if (soporteActual) {
      const t = tickets.find(x => x.id === soporteActual);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      lockCliente = true; // Solo admins pueden editar la empresa
    } else {
      if (currentSession.viewMode === 'superadmin') {
        lockCliente = false; // Superadmin nunca se bloquea
      } else {
        lockCliente = isCerrado; // Admin se bloquea solo si el ticket asociado ya está cerrado
      }
    }

    fClienteCombo.style.pointerEvents = lockCliente ? 'none' : 'auto';
    fClienteCombo.style.background = lockCliente ? 'var(--bg-secondary)' : '';
  }
  
  document.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.disabled = !!lockFields;
  });

  // ===== MODO REPORTE: bloquear campos de información general =====
  if (modoReporte) {
    // Campos de texto/number bloqueados (info general + km)
    const camposInfoGeneral = [
      'f-folio', 'f-pedido', 'f-ubicacion', 'f-operador', 'f-eco',
      'f-horometro', 'f-modelo', 'f-serie',
      'f-km-ida', 'f-km-vuelta', 'f-km-total'
    ];
    camposInfoGeneral.forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.readOnly = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.cursor = 'not-allowed';
        el.style.opacity = '0.7';
      }
    });
    // Selects bloqueados
    ['f-soporte', 'f-equipo', 'f-estado'].forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.disabled = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.opacity = '0.7';
      }
    });
    // Combo cliente bloqueado
    const fClienteComboReporte = document.getElementById('f-cliente-combo');
    if (fClienteComboReporte) {
      fClienteComboReporte.style.pointerEvents = 'none';
      fClienteComboReporte.style.background = 'var(--bg-secondary)';
      fClienteComboReporte.style.opacity = '0.7';
    }
    // Radios de tipo bloqueados
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
      radio.disabled = true;
    });
    // Checkboxes de técnicos bloqueados
    document.querySelectorAll('input[name="f-tecnicos"]').forEach(cb => {
      cb.disabled = true;
    });
    // Banner visual en el header del modal
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.id = 'reporte-modo-banner';
      banner.style.cssText = 'border-left: 3px solid var(--accent, #e8850a); background: var(--bg-card); color: var(--text-secondary); padding: 0.55rem 0.9rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; border-radius: 0 4px 4px 0;';
      banner.innerHTML = '<i data-lucide="lock" style="width:14px;height:14px;flex-shrink:0;color:var(--accent,#e8850a);"></i><span>Solo puedes editar el diagnostico y trabajos. Para modificar los datos generales usa el boton <strong>Editar</strong> (lapiz).</span>';
      const modalBody = document.querySelector('#modal-form .modal-body');
      if (modalBody) modalBody.insertBefore(banner, modalBody.firstChild);
      if (window.lucide) window.lucide.createIcons({ root: banner });
    }
  } else {
    // Asegurarse de remover el banner si existe (al abrir en modo edición normal)
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (existingBanner) existingBanner.remove();
  }

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function onSoporteChange() {
  const soporteId = document.getElementById('f-soporte').value;
  const inPedido = document.getElementById('f-pedido');
  const metaDiv = document.getElementById('soporte-meta');
  const inTecnico = document.getElementById('f-tecnico');
  
  if (soporteId) {
    const t = tickets.find(x => x.id === soporteId);
    if (t) {
      if (t.pedidoSAP) {
        inPedido.value = t.pedidoSAP;
        inPedido.readOnly = true;
        inPedido.style.background = 'var(--bg-secondary)';
      }
      metaDiv.innerHTML = `<i data-lucide="info" style="width:12px;height:12px;vertical-align:middle;"></i> <strong>Ticket ${t.folio}</strong> ligado &bull; Cotización SAP: ${t.cotizacionSAP || 'N/A'}`;
      metaDiv.style.display = 'block';
      
      const comboEquipo = document.getElementById('f-equipo');
      if (comboEquipo && t.equipo && (!editandoId || !comboEquipo.value)) {
        if (!Array.from(comboEquipo.options).some(o => o.value === t.equipo)) {
           const opt = document.createElement('option');
           opt.value = t.equipo;
           opt.textContent = `${t.equipo} (Del Ticket)`;
           let parsedSerie = '';
           if (t.equipo.includes('(SN: ')) {
             parsedSerie = t.equipo.split('(SN: ')[1].replace(')', '').trim();
           }
           opt.setAttribute('data-serie', parsedSerie);
           opt.setAttribute('data-modelo', t.equipo.split('(SN:')[0].trim());
           opt.setAttribute('data-ubicacion', t.sitio || '');
           comboEquipo.appendChild(opt);
        }
        comboEquipo.value = t.equipo;
        if (typeof onEquipoOrdenChange === 'function') onEquipoOrdenChange();
        
        // Si f-ubicacion sigue vacío, llenarlo con el sitio del ticket si existe
        const inUbicacion = document.getElementById('f-ubicacion');
        if (inUbicacion && !inUbicacion.value && t.sitio) {
          inUbicacion.value = t.sitio;
        }
      }
      
      const inHorometro = document.getElementById('f-horometro');
      if (inHorometro && t.horometro && (!editandoId || !inHorometro.value)) {
        inHorometro.value = t.horometro;
      }
      
      // Técnicos se extraen en background durante el guardado
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } else {
    inPedido.value = '';
    inPedido.readOnly = false;
    inPedido.style.background = '';
    if (metaDiv) metaDiv.style.display = 'none';
  }
}

function editarOrden(id) {
  const o = ordenes.find(x => x.id === id);
  if (o && o.firma_tecnico_base64 && !['superadmin', 'admin'].includes(currentSession.viewMode)) {
    mostrarNotificacion('Esta orden ya fue firmada. Solo administradores pueden editarla.', 'error');
    return;
  }
  abrirFormulario(id);
}

function cerrarFormulario(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editandoId = null;
  // Limpiar banner de modo reporte si existe
  const banner = document.getElementById('reporte-modo-banner');
  if (banner) banner.remove();
}

function guardarOrdenes() {
  // Ya no se guardan en localStorage
}

function guardarOrden(e) {
  e.preventDefault();
  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'Servicio';
  let tecnicosSeleccionados = [];
  const soporteIdGuardar = document.getElementById('f-soporte').value.trim();
  const oVieja = editandoId ? (ordenes.find(x => x.id === editandoId) || {}) : null;
  
  if (soporteIdGuardar) {
    const t = tickets.find(x => x.id === soporteIdGuardar);
    if (t) {
      if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) {
        tecnicosSeleccionados = t.tecnicosAsignados;
      } else if (t.asignado && t.asignado !== 'Sin asignar') {
        tecnicosSeleccionados = t.asignado.split(',').map(s => s.trim());
      }
    }
  } else if (oVieja) {
    tecnicosSeleccionados = oVieja.tecnicosAsignados || (oVieja.tecnico ? oVieja.tecnico.split(',').map(s => s.trim()) : []);
  }
  const orden = {
    id: editandoId || crypto.randomUUID(),
    fecha: oVieja ? oVieja.fecha : new Date().toISOString().split('T')[0],
    folio: document.getElementById('f-folio').value.trim(),
    pedido: document.getElementById('f-pedido').value.trim(),
    cliente: document.getElementById('f-cliente').value.trim(),
    ubicacion: document.getElementById('f-ubicacion').value.trim(),
    operador: document.getElementById('f-operador').value.trim(),
    eco: document.getElementById('f-eco').value.trim(),
    horometro: document.getElementById('f-horometro').value.trim(),
    horometro_real: document.getElementById('f-horometro-real').value.trim(),
    equipo: document.getElementById('f-equipo')?.value || '',
    marca: document.getElementById('f-equipo')?.options[document.getElementById('f-equipo')?.selectedIndex]?.getAttribute('data-marca') || '',
    modelo: document.getElementById('f-modelo').value.trim(),
    serie: document.getElementById('f-serie').value.trim(),
    tecnico: tecnicosSeleccionados.join(', '),
    tecnicosAsignados: tecnicosSeleccionados,
    creadoPor: oVieja ? (oVieja.creadoPor || oVieja.tecnico) : (usuarios.find(u => u.id === currentSession.userId)?.nombre || ''),
    soporte: document.getElementById('f-soporte').value.trim(),
    km_ida: document.getElementById('f-km-ida').value,
    km_vuelta: document.getElementById('f-km-vuelta').value,
    km_total: document.getElementById('f-km-total').value,
    tipo,
    estado: document.getElementById('f-estado').value,
    falla: document.getElementById('f-falla').value.trim(),
    trabajos: document.getElementById('f-trabajos').value.trim(),
    dictamen: document.getElementById('f-dictamen').value.trim(),
    condiciones: document.getElementById('f-condiciones').value.trim(),
    observaciones: document.getElementById('f-observaciones').value.trim(),
    pendientes: document.getElementById('f-pendientes').value.trim(),
    ref_utilizadas: getRefacciones('utilizadas'),
    ref_necesarias: getRefacciones('necesarias'),
    factura_ref: '',
    factura_mo: '',
    noches: document.getElementById('f-noches').value,
    alimentacion: document.getElementById('f-alimentacion').value,
    traslado_costo: document.getElementById('f-traslado-costo').value,
    dias: getDiasData(),
  };
  
  if (oVieja) {
    orden.bitacora = oVieja.bitacora;
    orden.firma_tecnico_base64 = oVieja.firma_tecnico_base64;
    orden.firma_cliente_base64 = oVieja.firma_cliente_base64;
    orden.evidenciaBase64 = oVieja.evidenciaBase64 || oVieja.evidencia_base64;
  }
  
  // Computar estado automático o manual si es superadmin
  if (currentSession.viewMode === 'superadmin') {
    orden.estado = document.getElementById('f-estado').value;
  } else {
    orden.estado = calcularEstadoOrden(orden);
    document.getElementById('f-estado').value = orden.estado; // update UI state
  }

  if (oVieja) {
    ordenes = ordenes.map(o => o.id === editandoId ? orden : o);
  } else {
    ordenes.unshift(orden);
  }
  
  // Auto-cerrar el ticket relacionado
  if (orden.soporte) {
    const tIndex = tickets.findIndex(t => t.id === orden.soporte);
    if (tIndex >= 0 && tickets[tIndex].estado !== 'Cerrado') {
      tickets[tIndex].estado = 'Cerrado';
      if (window.supabaseClient) {
        window.pushToSupabase('tickets', tickets[tIndex]);
      }
      updateTicketBadge();
      if (typeof renderTickets === 'function') renderTickets();
    }
  }

  // Guardar siempre en local como respaldo
  localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));

  if (window.supabaseClient) {
    window.pushToSupabase('ordenes', orden);
  }
  cerrarFormulario();
  renderTabla();
  renderTabla('servicios');
  renderStats();
}

// ===== ELIMINAR =====
function eliminarOrden(id) {
  if (!confirm('¿Eliminar esta orden de servicio?')) return;
  ordenes = ordenes.filter(o => o.id !== id);
  localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
  
  if (window.supabaseClient) {
    window.supabaseClient.from('ordenes').delete().eq('id', id).then(() => {});
  }
  renderTabla();
  renderTabla('servicios');
  renderStats();
}

function completarReporteDesdeDetalle(id) {
  cerrarDetalle();
  setTimeout(() => {
    abrirFormulario(id, true); // true = modoReporte: solo permite editar el reporte técnico
  }, 100);
}

// ===== DETALLE =====
function verDetalle(id) {
  const o = ordenes.find(x => x.id === id);
  if (!o) return;
  document.getElementById('detalle-title').textContent = `Orden ${o.folio || o.id.slice(0,8)}`;
  
  const btnCompletar = document.getElementById('btn-completar-reporte');
  if (btnCompletar) {
    if (currentSession.viewMode !== 'consulta' && !o.firma_tecnico_base64) {
      btnCompletar.style.display = 'flex';
      btnCompletar.setAttribute('onclick', `completarReporteDesdeDetalle('${id}')`);
    } else {
      btnCompletar.style.display = 'none';
    }
  }

  const btnAsignarTecs = document.getElementById('btn-asignar-tecnicos');
  if (btnAsignarTecs) {
    if (['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) && o.estado !== 'Finalizado') {
      btnAsignarTecs.style.display = 'flex';
    } else {
      btnAsignarTecs.style.display = 'none';
    }
  }

  const btnEnviarCorreo = document.getElementById('btn-enviar-correo');
  if (btnEnviarCorreo) {
    btnEnviarCorreo.setAttribute('onclick', `enviarCorreoOrden('${id}')`);
  }

  window.currentDetalleOrdenId = id;

  const renderBitacora = (o) => {
    let html = '';
    if (!o.bitacora || o.bitacora.length === 0) {
      html += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;text-align:center;padding:1.5rem;background:var(--bg-body);border-radius:6px;border:1px dashed var(--border);">Aún no hay entradas en la bitácora para esta orden.</p>';
    } else {
      // Agrupar por día
      const agrupado = {};
      o.bitacora.forEach(b => {
        let fechaDia = 'Fecha Desconocida';
        let fechaDObj = null;
        try {
          fechaDObj = new Date(b.fecha);
          if (!isNaN(fechaDObj)) {
            // Se asume timezone local por seguridad del parseo de toLocaleDateString
            const partes = fechaDObj.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/');
            fechaDia = `${partes[2]}-${partes[1]}-${partes[0]}`; // YYYY-MM-DD
          }
        } catch(e){}
        if (!agrupado[fechaDia]) agrupado[fechaDia] = { objDate: fechaDObj, entries: [] };
        agrupado[fechaDia].entries.push(b);
      });

      // Ordenar días del más reciente al más antiguo
      const diasSorted = Object.keys(agrupado).sort((a, b) => b.localeCompare(a));

      html += '<div style="display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.5rem;">';
      
      diasSorted.forEach(diaKey => {
        const diaData = agrupado[diaKey];
        let displayDia = diaKey;
        let mesAbrev = '';
        let numDia = '';
        if (diaData.objDate && !isNaN(diaData.objDate)) {
          const dObj = diaData.objDate;
          displayDia = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          displayDia = displayDia.charAt(0).toUpperCase() + displayDia.slice(1);
          mesAbrev = dObj.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase().replace('.', '');
          numDia = dObj.getDate();
        }

        // Ordenar entradas dentro del día (por hora de entrada si existe)
        diaData.entries.sort((a,b) => (a.entrada || '').localeCompare(b.entrada || ''));

        let entriesHtml = diaData.entries.map(b => {
          let horasHtml = '';
          if (b.entrada && b.salida) {
            const [hE, mE] = b.entrada.split(':').map(Number);
            const [hS, mS] = b.salida.split(':').map(Number);
            let diff = (hS * 60 + mS) - (hE * 60 + mE);
            if (diff < 0) diff += 24 * 60; // Si pasa de medianoche
            const hrs = Math.floor(diff / 60);
            const mns = diff % 60;
            const durStr = `${hrs}h ${mns > 0 ? mns + 'm' : ''}`.trim();
            horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(232, 133, 10, 0.1); color:var(--accent); padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida} (${durStr})</span>`;
          } else if (b.entrada || b.salida) {
            horasHtml = `<span style="font-size:0.7rem; color:var(--text-muted);"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;"></i> ${b.entrada || '--:--'} a ${b.salida || '--:--'}</span>`;
          }

          return `
            <div style="background:var(--bg-body); border-left: 3px solid var(--border); border-radius:4px; padding:0.75rem 1rem; margin-top:0.6rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:24px; height:24px; border-radius:50%; background:var(--accent); color:white; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">
                    ${(b.tecnico || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Desconocido'}</span>
                  ${['superadmin', 'admin'].includes(currentSession.viewMode) ? `<button class="action-btn" onclick="editarBitacora('${o.id}', '${b.id}')" title="Editar Bitácora" style="padding:0.15rem; margin-left:0.5rem;"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>` : ''}
                </div>
                ${horasHtml}
              </div>
              <div style="font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:2.2rem; line-height:1.4;">${b.nota}</div>
            </div>
          `;
        }).join('');

        html += `
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            <!-- Calendario Icono -->
            <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:center; width:50px; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="background:var(--accent); color:white; width:100%; text-align:center; font-size:0.65rem; font-weight:bold; padding:0.25rem 0; letter-spacing:0.5px;">${mesAbrev}</div>
              <div style="font-size:1.3rem; font-weight:700; color:var(--text-primary); padding:0.3rem 0;">${numDia}</div>
            </div>
            <!-- Contenido del día -->
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:0.2rem; margin-top:0.2rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem;">${displayDia}</div>
              ${entriesHtml}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (o.estado !== 'Finalizado' && currentSession.viewMode !== 'consulta') {
      html += `<div style="text-align:right;"><button class="btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="abrirBitacora('${o.id}')"><i data-lucide="plus" style="width:14px;height:14px;"></i> Registrar Avance Diario</button></div>`;
    }
    return html;
  };

  const field = (label, val) => `
    <div class="detalle-field">
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;

  const seccion = (title, content) => `
    <div class="detalle-section">
      <div class="detalle-section-title">${title}</div>
      ${content}
    </div>`;

  const refTable = (items, hasPrice) => {
    if (!items?.length) return '<p style="color:var(--text-muted);font-size:0.82rem;">Sin refacciones</p>';
    return `<table class="detalle-ref-table">
      <thead><tr>
        <th>Descripción</th><th>Clave</th><th>Cant.</th>
        ${hasPrice ? '<th>Precio</th>' : ''}
      </tr></thead>
      <tbody>${items.map(r => `<tr>
        <td>${r.descripcion||'—'}</td>
        <td>${r.clave||'—'}</td>
        <td>${r.cantidad||'—'}</td>
        ${hasPrice ? `<td>$${r.precio||'0'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  };

  const diasRows = DIAS.map((dia, i) => {
    const d = o.dias?.[dia];
    if (!d || !d.fecha) return '';
    return `<tr>
      <td>${DIAS_LABEL[i]}</td>
      <td>${d.fecha||'—'}</td>
      <td>${d.entrada||'—'}</td>
      <td>${d.salida||'—'}</td>
      <td>${d.normales||'—'}</td>
      <td>${d.extras||'—'}</td>
    </tr>`;
  }).join('');

  const formatFecha = (fStr) => {
    if (!fStr) return '—';
    if (fStr.includes('T')) {
      const parts = fStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fStr;
  };

  document.getElementById('detalle-body').innerHTML = `
    <div class="print-only" style="text-align:center; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border);">
      <img src="logo_transparent.png" alt="Eurorep Logo" style="height:60px; object-fit:contain; margin-bottom:0.5rem;"/>
      <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary);">Orden de Servicio ${o.folio || ''}</h2>
      <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${formatFecha(o.fecha)}</p>
    </div>
    ${seccion('Información General', `
      <div class="detalle-grid">
        ${field('Folio', o.folio)} ${field('Pedido', o.pedido)} ${field('Fecha', formatFecha(o.fecha))}
        ${field('Cliente', o.cliente)} ${field('Ubicación', o.ubicacion)} ${field('Operador', o.operador)}
        ${field('No. ECO', o.eco)} ${field('Horómetro (Ticket)', o.horometro)} ${field('Horómetro Real', o.horometro_real)}
        ${field('Marca', (() => { 
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let m = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
          return MARCAS_RENDER[m.toUpperCase()] || m || '—';
        })())} ${field('Modelo', o.modelo)} ${field('Serie', o.serie)}
        ${field('Técnico', o.tecnico)} ${field('Ticket Soporte', (() => { const t = tickets.find(x => x.id === o.soporte); return t ? (t.folio || t.id.slice(0,8)) : o.soporte || null; })())}
      </div>`)}
    ${seccion('Kilómetros / Tipo', `
      <div class="detalle-grid">
        ${field('Origen → Trabajo', (o.km_ida != null && o.km_ida !== '') ? o.km_ida + ' km' : null)}
        ${field('Trabajo → Origen', (o.km_vuelta != null && o.km_vuelta !== '') ? o.km_vuelta + ' km' : null)}
        ${field('Total Km', (o.km_total != null && o.km_total !== '') ? o.km_total + ' km' : null)}
        ${field('Tipo de Visita', `<span class="badge badge-${(o.tipo||'otro').toLowerCase().replace(/ /g, '-').replace('é','e').replace('í','i')}">${o.tipo}</span>`)}
        ${field('Estado', `<span class="badge ${badgeEstado(o.estado)}">${o.estado}</span>`)}
      </div>`)}
    ${seccion('Diagnóstico y Trabajos', `
      ${field('Falla reportada', o.falla)}
      <div style="margin-top:0.5rem">${field('Trabajos realizados', o.trabajos)}</div>
      <div style="margin-top:0.5rem">${field('Dictamen', o.dictamen)}</div>
      <div style="margin-top:0.5rem">${field('Condiciones del equipo', o.condiciones)}</div>
      <div style="margin-top:0.5rem">${field('Observaciones', o.observaciones)}</div>
      <div style="margin-top:0.5rem">${field('Pendientes', o.pendientes)}</div>`)}
    ${seccion('Refacciones Utilizadas', refTable(o.ref_utilizadas, true))}
    ${seccion('Refacciones Necesarias', refTable(o.ref_necesarias, false))}
    ${diasRows ? seccion('Fechas de Servicio', `
      <table class="detalle-ref-table">
        <thead><tr><th>Día</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Normales</th><th>Extras</th></tr></thead>
        <tbody>${diasRows}</tbody>
      </table>
      <div class="detalle-grid" style="margin-top:0.75rem">
        ${field('No. Noches', o.noches)} ${field('Alimentación', o.alimentacion ? '$'+o.alimentacion : '')} ${field('Traslado', o.traslado_costo ? '$'+o.traslado_costo : '')}
      </div>`) : ''}
    ${seccion('Bitácora Diaria', renderBitacora(o))}
    
    ${seccion('Firmas de Conformidad', `
      <div style="display:flex; flex-wrap:wrap; gap:2rem; margin-top:1rem; justify-content:center;">
        
        <!-- TECNICO -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Técnico</h4>
          ${o.firma_tecnico_base64 
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_tecnico_base64}" alt="Firma del técnico" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_tecnico_nombre || o.tecnico || 'Técnico'}</p>
                 ${o.firma_tecnico_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_tecnico_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               ${currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin' ? `<button class="btn-secondary" onclick="limpiarFirma('${o.id}', 'tecnico')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Borrar firma (Admin)</button>` : ''}` 
            : `<div style="width:100%;">
                 <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                 <canvas id="firma-tecnico-canvas" width="400" height="150" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                 <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                   <button class="btn-secondary" onclick="borrarCanvasFirma('tecnico')" style="flex:1;">Borrar</button>
                   <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'tecnico')" style="flex:2;">Guardar Firma Técnico</button>
                 </div>
               </div>`
          }
        </div>

        <!-- CLIENTE -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Cliente</h4>
          ${o.firma_cliente_base64 
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_cliente_base64}" alt="Firma del cliente" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_cliente_nombre || o.cliente || 'Cliente'}</p>
                 ${o.firma_cliente_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_cliente_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               <button class="btn-secondary" onclick="limpiarFirma('${o.id}', 'cliente')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Volver a firmar</button>` 
            : (!o.firma_tecnico_base64 
               ? `<div style="width:100%; text-align:center; padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 0.9rem;">
                    <i data-lucide="lock" style="width:24px;height:24px;margin-bottom:0.5rem;"></i><br>
                    El técnico debe firmar primero para habilitar la firma del cliente.
                  </div>`
               : `<div style="width:100%;">
                 <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                 <input type="text" id="nombre-firma-cliente" class="form-control" placeholder="Nombre completo de quien firma" style="margin-bottom:0.5rem; font-size:0.85rem; padding:0.4rem;"/>
                 <canvas id="firma-cliente-canvas" width="400" height="150" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                 <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                   <button class="btn-secondary" onclick="borrarCanvasFirma('cliente')" style="flex:1;">Borrar</button>
                   <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'cliente')" style="flex:2;">Guardar Firma Cliente</button>
                 </div>
               </div>`)
          }
        </div>
        
      </div>
    `)}
  `;

  document.getElementById('modal-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
  
  setTimeout(() => {
    if (!o.firma_tecnico_base64) inicializarCanvasFirma('tecnico');
    if (o.firma_tecnico_base64 && !o.firma_cliente_base64) inicializarCanvasFirma('cliente');
  }, 100);
}

// ===== LOGICA DEL CANVAS DE FIRMA =====
let canvasesFirma = {
  tecnico: { canvas: null, ctx: null, dibujando: false },
  cliente: { canvas: null, ctx: null, dibujando: false }
};

function inicializarCanvasFirma(tipo) {
  const c = document.getElementById(`firma-${tipo}-canvas`);
  if (!c) return;
  const ctx = c.getContext('2d');
  
  canvasesFirma[tipo].canvas = c;
  canvasesFirma[tipo].ctx = ctx;
  
  const rect = c.getBoundingClientRect();
  c.width = rect.width;
  c.height = rect.height;
  
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000000';

  const startDraw = (e) => { canvasesFirma[tipo].dibujando = true; ctx.beginPath(); ctx.moveTo(getX(e, c), getY(e, c)); e.preventDefault(); };
  const draw = (e) => { if(!canvasesFirma[tipo].dibujando) return; ctx.lineTo(getX(e, c), getY(e, c)); ctx.stroke(); e.preventDefault(); };
  const stopDraw = () => { canvasesFirma[tipo].dibujando = false; ctx.closePath(); };

  const getX = (e, canvas) => e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.clientX - canvas.getBoundingClientRect().left;
  const getY = (e, canvas) => e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.clientY - canvas.getBoundingClientRect().top;

  c.addEventListener('mousedown', startDraw);
  c.addEventListener('mousemove', draw);
  c.addEventListener('mouseup', stopDraw);
  c.addEventListener('mouseout', stopDraw);
  
  c.addEventListener('touchstart', startDraw, {passive: false});
  c.addEventListener('touchmove', draw, {passive: false});
  c.addEventListener('touchend', stopDraw);
}

function borrarCanvasFirma(tipo) {
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (ctx && c) {
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

function guardarFirmaCanvas(ordenId, tipo) {
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (!c) return;
  
  const isBlank = !ctx.getImageData(0, 0, c.width, c.height).data.some(channel => channel !== 0);
  if (isBlank) {
    mostrarNotificacion(`Por favor firme como ${tipo} antes de guardar.`, 'warning');
    return;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = c.width;
  tempCanvas.height = c.height;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.fillStyle = '#FFFFFF';
  tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tCtx.drawImage(c, 0, 0);
  
  const base64Firma = tempCanvas.toDataURL('image/jpeg', 0.5);
  
  const idx = ordenes.findIndex(o => o.id === ordenId);
  if (idx !== -1) {
    const fechaFirma = new Date().toISOString();
    
    if (tipo === 'tecnico') {
      const currentUser = usuarios.find(u => u.id === currentSession.userId);
      ordenes[idx].firma_tecnico_base64 = base64Firma;
      ordenes[idx].firma_tecnico_nombre = currentUser ? currentUser.nombre : (currentSession.nombre || ordenes[idx].tecnico || 'Técnico');
      ordenes[idx].firma_tecnico_fecha = fechaFirma;
    } else {
      ordenes[idx].firma_cliente_base64 = base64Firma;
      ordenes[idx].firma_cliente_nombre = document.getElementById('nombre-firma-cliente')?.value || ordenes[idx].cliente || 'Cliente';
      ordenes[idx].firma_cliente_fecha = fechaFirma;
    }
    
    ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
    
    try {
      localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error de almacenamiento local. La firma puede no guardarse si no hay espacio.', 'error');
    }
    
    if (window.pushToSupabase) {
      window.pushToSupabase('ordenes', ordenes[idx]).catch(err => {
         console.error('Error supabase:', err);
         mostrarNotificacion('Error guardando en la nube', 'error');
      });
    }
    
    mostrarNotificacion(`Firma del ${tipo} guardada`, 'success');
    verDetalle(ordenId); 
    renderTabla();
    renderTabla('servicios');
  }
}

function limpiarFirma(ordenId, tipo) {
  if (!confirm(`¿Borrar la firma del ${tipo}?`)) return;
  const idx = ordenes.findIndex(o => o.id === ordenId);
  if (idx !== -1) {
    if (tipo === 'tecnico') ordenes[idx].firma_tecnico_base64 = null;
    else ordenes[idx].firma_cliente_base64 = null;
    
    ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
    
    localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
    if (window.pushToSupabase) window.pushToSupabase('ordenes', ordenes[idx]);
    verDetalle(ordenId); 
  }
}

// ==========================
// AUTOMATIZACIÓN DE ESTADOS
// ==========================
function calcularEstadoOrden(o) {
  const isSignedByClient = !!o.firma_cliente_base64;
  const refNecesarias = o.ref_necesarias || [];
  const hasPendingParts = refNecesarias.length > 0;
  
  if (isSignedByClient) {
    if (hasPendingParts) {
      return 'Refacciones pendientes';
    } else {
      return 'Cerrada';
    }
  } else {
    const hasBitacora = o.bitacora && o.bitacora.length > 0;
    const hasFalla = (o.falla || '').trim();
    const hasTrabajos = (o.trabajos || '').trim();
    const hasDictamen = (o.dictamen || '').trim();
    const hasCondiciones = (o.condiciones || '').trim();
    const hasObservaciones = (o.observaciones || '').trim();
    const hasPendientes = (o.pendientes || '').trim();
    const hasRefUtilizadas = o.ref_utilizadas && o.ref_utilizadas.length > 0;
    
    const hasData = hasFalla || hasTrabajos || hasDictamen || hasCondiciones || hasObservaciones || hasPendientes || hasRefUtilizadas || hasPendingParts;
    
    if (hasBitacora || hasData || o.firma_tecnico_base64) {
      return 'En proceso';
    } else {
      return 'Pendiente';
    }
  }
}

function abrirAsignarTecnicos() {
  const o = ordenes.find(x => x.id === window.currentDetalleOrdenId);
  if (!o) return;
  const container = document.getElementById('at-tecnicos-container');
  if (container) {
    container.innerHTML = '';
    const assigned = o.tecnicosAsignados || [];
    usuarios.filter(u => u.rol === 'tecnico').forEach(u => {
      const isChecked = assigned.includes(u.nombre);
      container.innerHTML += `
        <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; background: var(--bg-body); padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
          <input type="checkbox" name="at-tecnicos" value="${u.nombre}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; margin:0; margin-top:1px; flex-shrink:0;"/>
          <span style="flex:1; text-align:left; font-weight:normal; color:var(--text-primary);">${u.nombre}</span>
        </label>
      `;
    });
  }
  document.getElementById('modal-asignar-tecnicos-overlay').classList.add('open');
}

function cerrarAsignarTecnicos(e) {
  if (e && e.target !== document.getElementById('modal-asignar-tecnicos-overlay')) return;
  document.getElementById('modal-asignar-tecnicos-overlay').classList.remove('open');
}

function guardarAsignacionTecnicos() {
  const o = ordenes.find(x => x.id === window.currentDetalleOrdenId);
  if (!o) return;
  
  const selectedT = Array.from(document.querySelectorAll('input[name="at-tecnicos"]:checked')).map(cb => cb.value);
  o.tecnicosAsignados = selectedT;
  o.tecnico = selectedT.join(', ');
  
  localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
  if (window.pushToSupabase) {
    window.pushToSupabase('ordenes', o);
  }
  
  mostrarNotificacion('Técnicos asignados correctamente.', 'success');
  cerrarAsignarTecnicos();
  verDetalle(o.id);
  if (typeof renderCalendario === 'function' && document.getElementById('view-calendario')?.classList.contains('active')) {
    renderCalendario();
  } else {
    filtrarOrdenes();
  }
}

// ===== PROGRAMAR TÉCNICOS DESDE CALENDARIO =====
function abrirProgramarTecnico() {
  document.getElementById('pt-fecha').value = '';
  document.getElementById('pt-entrada').value = '';
  document.getElementById('pt-salida').value = '';
  document.getElementById('pt-tecnico').innerHTML = '<option value="">Selecciona una fecha primero...</option>';
  document.getElementById('pt-tecnico').disabled = true;

  // Llenar dropdown de órdenes
  const selectOrden = document.getElementById('pt-orden');
  const openOrds = ordenes.filter(o => o.estado !== 'Finalizado');
  selectOrden.innerHTML = '<option value="">Selecciona una orden...</option>' + openOrds.map(o => `<option value="${o.id}">[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}</option>`).join('');

  document.getElementById('modal-programar-tecnico-overlay').classList.add('open');
}

function actualizarTecnicosDisponibles() {
  const fecha = document.getElementById('pt-fecha').value;
  const selectTec = document.getElementById('pt-tecnico');
  if (!fecha) {
    selectTec.innerHTML = '<option value="">Selecciona una fecha primero...</option>';
    selectTec.disabled = true;
    return;
  }

  // Filtrar técnicos ocupados en esa fecha
  const tecnicosOcupados = new Set();
  ordenes.forEach(o => {
    if (o.bitacora && o.bitacora.length > 0) {
      o.bitacora.forEach(b => {
        if (b.fecha && b.fecha.startsWith(fecha) && b.tecnico) {
          tecnicosOcupados.add(b.tecnico);
        }
      });
    }
  });

  const disponibles = usuarios.filter(u => u.rol === 'tecnico' && !tecnicosOcupados.has(u.nombre) && u.activo !== false);
  
  if (disponibles.length === 0) {
    selectTec.innerHTML = '<option value="">Sin técnicos disponibles esta fecha</option>';
    selectTec.disabled = true;
  } else {
    selectTec.innerHTML = '<option value="">Selecciona un técnico disponible...</option>' + disponibles.map(u => `<option value="${u.nombre}">${u.nombre}</option>`).join('');
    selectTec.disabled = false;
  }
}

async function guardarProgramacionTecnico() {
  const fecha = document.getElementById('pt-fecha').value;
  const tecnico = document.getElementById('pt-tecnico').value;
  const ordenId = document.getElementById('pt-orden').value;
  const entrada = document.getElementById('pt-entrada').value;
  const salida = document.getElementById('pt-salida').value;

  if (!fecha || !tecnico || !ordenId) {
    alert("Por favor completa los campos requeridos (Fecha, Técnico, Orden).");
    return;
  }

  const oIndex = ordenes.findIndex(o => o.id === ordenId);
  if (oIndex === -1) return;
  const o = ordenes[oIndex];

  if (!o.bitacora) o.bitacora = [];
  
  const nuevaEntrada = {
    id: crypto.randomUUID(),
    fecha: fecha,
    tecnico: tecnico,
    nota: "Programado por supervisor. Pendiente de llenado por el técnico.",
    entrada: entrada,
    salida: salida
  };
  
  o.bitacora.push(nuevaEntrada);

  // Asegurar que el técnico está en la lista de asignados globalmente
  if (!o.tecnicosAsignados) o.tecnicosAsignados = [];
  if (!o.tecnicosAsignados.includes(tecnico)) {
    o.tecnicosAsignados.push(tecnico);
    o.tecnico = o.tecnicosAsignados.join(', ');
  }

  localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
  if (window.pushToSupabase) {
    await window.pushToSupabase('ordenes', o);
  }

  mostrarNotificacion('Asignación programada con éxito', 'success');
  document.getElementById('modal-programar-tecnico-overlay').classList.remove('open');
  if (typeof renderCalendario === 'function' && document.getElementById('view-calendario')?.classList.contains('active')) {
    renderCalendario();
  }
}

// Calcula el rango de fechas hábiles permitido para la bitácora
function calcularRangoFechasLaboral(diasHabilAtras) {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset()); // ajuste zona horaria local

  // Si hoy es fin de semana, el máximo permitido es el viernes anterior
  const maxDate = new Date(ahora);
  const dow = maxDate.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  if (dow === 6) maxDate.setDate(maxDate.getDate() - 1); // Sábado → Viernes
  if (dow === 0) maxDate.setDate(maxDate.getDate() - 2); // Domingo → Viernes

  // Retroceder N días hábiles desde el máximo
  const minDate = new Date(maxDate);
  let retrocedidos = 0;
  while (retrocedidos < diasHabilAtras) {
    minDate.setDate(minDate.getDate() - 1);
    const d = minDate.getDay();
    if (d !== 0 && d !== 6) retrocedidos++; // Solo cuenta lunes-viernes
  }

  return {
    min: minDate.toISOString().slice(0, 10),
    max: maxDate.toISOString().slice(0, 10),
  };
}

function abrirBitacora(id) {
  window.currentBitacoraOrdenId = id;
  window.currentBitacoraEntryId = null;
  const rango = calcularRangoFechasLaboral(2);

  const fechaInput = document.getElementById('bitacora-fecha');
  fechaInput.value = rango.max; // pre-selecciona el último día hábil (hoy o viernes si es fin de semana)
  fechaInput.min = rango.min;
  fechaInput.max = rango.max;

  document.getElementById('bitacora-nota').value = '';
  document.getElementById('bitacora-entrada').value = '';
  document.getElementById('bitacora-salida').value = '';
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function editarBitacora(ordenId, bitacoraId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  const b = o.bitacora?.find(x => x.id === bitacoraId);
  if (!b) return;

  window.currentBitacoraOrdenId = ordenId;
  window.currentBitacoraEntryId = bitacoraId;

  const fechaInput = document.getElementById('bitacora-fecha');
  const dObj = new Date(b.fecha);
  const dateStr = !isNaN(dObj) ? dObj.toISOString().split('T')[0] : '';
  fechaInput.value = dateStr;
  
  // Como admin, quitamos las restricciones de fecha para poder editar fechas pasadas
  fechaInput.min = '';
  fechaInput.max = '';

  document.getElementById('bitacora-nota').value = b.nota || '';
  document.getElementById('bitacora-entrada').value = b.entrada || '';
  document.getElementById('bitacora-salida').value = b.salida || '';
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function cerrarBitacora(e) {
  if (e && e.target !== document.getElementById('modal-bitacora-overlay')) return;
  document.getElementById('modal-bitacora-overlay').classList.remove('open');
}

function guardarNotaBitacora() {
  const o = ordenes.find(x => x.id === window.currentBitacoraOrdenId);
  if (!o) return;
  
  const fecha = document.getElementById('bitacora-fecha').value;
  const nota = document.getElementById('bitacora-nota').value.trim();
  const entrada = document.getElementById('bitacora-entrada').value;
  const salida = document.getElementById('bitacora-salida').value;
  
  if (!fecha || !nota) {
    mostrarNotificacion('La fecha y la nota son obligatorias.', 'warning');
    return;
  }

  const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);

  if (!isAdmin) {
    // Validar que la fecha seleccionada no sea fin de semana
    const fechaObj = new Date(fecha + 'T12:00:00'); // mediodía para evitar desfases de timezone
    const diaSemana = fechaObj.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      mostrarNotificacion('No se pueden registrar entradas en fin de semana.', 'error');
      return;
    }

    // Validar que esté dentro del rango hábil permitido
    const rango = calcularRangoFechasLaboral(2);
    if (fecha < rango.min || fecha > rango.max) {
      mostrarNotificacion('La fecha seleccionada está fuera del rango permitido.', 'error');
      return;
    }
  }
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreTecnico = currentUser ? currentUser.nombre : 'Usuario';
  const tecnicoDestino = window.currentBitacoraEntryId && o.bitacora ? 
      (o.bitacora.find(x => x.id === window.currentBitacoraEntryId)?.tecnico || nombreTecnico) : 
      nombreTecnico;

  // Validación de empalme de horarios (no permitir que el técnico repita horario)
  if (entrada && salida) {
    const doOverlap = (e1, s1, e2, s2) => {
      if (!e1 || !s1 || !e2 || !s2) return false;
      const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      let mE1 = toMin(e1), mS1 = toMin(s1);
      let mE2 = toMin(e2), mS2 = toMin(s2);
      if (mS1 <= mE1) mS1 += 24*60;
      if (mS2 <= mE2) mS2 += 24*60;
      return (mE1 < mS2 && mE2 < mS1);
    };

    let empalme = null;
    for (const ord of ordenes) {
      if (!ord.bitacora) continue;
      for (const bit of ord.bitacora) {
        if (bit.id === window.currentBitacoraEntryId) continue; // Ignorar el mismo registro si estamos editando
        if (bit.tecnico !== tecnicoDestino) continue; // Solo validar registros del mismo técnico
        
        try {
          const bitDateObj = new Date(bit.fecha);
          if (isNaN(bitDateObj)) continue;
          const bitDate = bitDateObj.toISOString().split('T')[0];
          
          if (bitDate === fecha) { // Si están en la misma fecha
            if (doOverlap(entrada, salida, bit.entrada, bit.salida)) {
              empalme = { ordenFolio: ord.folio || ord.id, entrada: bit.entrada, salida: bit.salida };
              break;
            }
          }
        } catch(e){}
      }
      if (empalme) break;
    }

    if (empalme) {
      mostrarNotificacion(`Horario empalmado con otro registro tuyo de ${empalme.entrada} a ${empalme.salida} (Orden: ${empalme.ordenFolio}).`, 'error');
      return;
    }
  }
  
  if (!o.bitacora) o.bitacora = [];

  if (window.currentBitacoraEntryId) {
    // Modo Edición
    const bIndex = o.bitacora.findIndex(x => x.id === window.currentBitacoraEntryId);
    if (bIndex >= 0) {
      o.bitacora[bIndex].fecha = new Date(fecha).toISOString();
      o.bitacora[bIndex].nota = nota;
      o.bitacora[bIndex].entrada = entrada;
      o.bitacora[bIndex].salida = salida;
    }
  } else {
    // Modo Creación
    o.bitacora.push({
      id: crypto.randomUUID(),
      fecha: new Date(fecha).toISOString(),
      nota: nota,
      entrada: entrada,
      salida: salida,
      tecnico: nombreTecnico
    });
  }
  
  o.estado = calcularEstadoOrden(o);
  
  localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
  if (window.pushToSupabase) {
    window.pushToSupabase('ordenes', o);
  }
  
  mostrarNotificacion(window.currentBitacoraEntryId ? 'Bitácora actualizada.' : 'Entrada de bitácora guardada.', 'success');
  cerrarBitacora();
  verDetalle(o.id); // Recargar modal
  renderTabla();
  renderTabla('servicios');
}

// ==========================
// AUTOMATIZACIÓN DE ESTADOS
// ==========================
function calcularEstadoOrden(o) {
  const isSignedByClient = !!o.firma_cliente_base64;
  const refNecesarias = o.ref_necesarias || [];
  const hasPendingParts = refNecesarias.length > 0;
  
  if (isSignedByClient) {
    if (hasPendingParts) {
      return 'Refacciones pendientes';
    } else {
      return 'Cerrada';
    }
  } else {
    const hasBitacora = o.bitacora && o.bitacora.length > 0;
    const hasFalla = (o.falla || '').trim();
    const hasTrabajos = (o.trabajos || '').trim();
    const hasDictamen = (o.dictamen || '').trim();
    const hasCondiciones = (o.condiciones || '').trim();
    const hasObservaciones = (o.observaciones || '').trim();
    const hasPendientes = (o.pendientes || '').trim();
    const hasRefUtilizadas = o.ref_utilizadas && o.ref_utilizadas.length > 0;
    
    const hasData = hasFalla || hasTrabajos || hasDictamen || hasCondiciones || hasObservaciones || hasPendientes || hasRefUtilizadas || hasPendingParts;
    
    if (hasBitacora || hasData || o.firma_tecnico_base64) {
      return 'En proceso';
    } else {
      return 'Pendiente';
    }
  }
}

function cerrarDetalle(e) {
  if (e && e.target !== document.getElementById('modal-detalle-overlay')) return;
  document.getElementById('modal-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function imprimirOrden() { window.print(); }

async function enviarCorreoOrden(ordenId) {
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  const destinatario = prompt("¿A qué correo deseas enviar esta orden de servicio?", "cliente@ejemplo.com");
  if (!destinatario) return;
  
  mostrarNotificacion("Enviando correo, por favor espera...", "info");
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h2 style="color: #e8820c; text-align: center;">Orden de Servicio: ${o.folio || 'N/A'}</h2>
      <p><strong>Cliente:</strong> ${o.cliente || '—'}</p>
      <p><strong>Fecha:</strong> ${o.fecha || '—'}</p>
      <p><strong>Equipo/Modelo:</strong> ${o.modelo || '—'} (Serie: ${o.serie || '—'})</p>
      <p><strong>Técnico Asignado:</strong> ${o.tecnico || '—'}</p>
      <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
      <h3 style="color: #444;">Trabajos Realizados</h3>
      <p>${(o.trabajos || 'Sin descripción').replace(/\n/g, '<br>')}</p>
      <h3 style="color: #444;">Observaciones</h3>
      <p>${(o.observaciones || '—').replace(/\n/g, '<br>')}</p>
      <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
      <p style="text-align: center; color: #777; font-size: 12px;">Para ver el reporte completo, consulte el portal de Eurorep.</p>
    </div>
  `;

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: destinatario,
        subject: `Reporte de Servicio ${o.folio || ''} - ${o.cliente || ''}`,
        htmlBody: htmlBody
      })
    });
    
    const result = await response.json();
    if (response.ok) {
      mostrarNotificacion("¡Correo enviado exitosamente!", "success");
    } else {
      mostrarNotificacion("Error al enviar: " + (result.error || "Revisa las credenciales SMTP en Vercel"), "error");
      console.error(result);
    }
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error de red al intentar enviar el correo.", "error");
  }
}

// ===== TICKETS DATA =====
function updateTicketBadge() {
  const abiertos = tickets.filter(t => t.estado === 'Abierto' || t.estado === 'En Proceso').length;
  const badge = document.getElementById('nav-badge-tickets');
  if (!badge) return;
  if (abiertos > 0) {
    badge.textContent = abiertos;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

function actualizarFiltrosPersonal() {
  try {
    const currentUser = usuarios.find(u => u && u.id === currentSession.userId);
    const userRole = currentUser ? currentUser.rol : '';
    const isTecnico = userRole === 'tecnico';
    const isSupervisor = userRole === 'supervisor';
    const userName = currentUser ? currentUser.nombre : '';

    const selectsTecnico = [document.getElementById('filter-ord-tecnico'), document.getElementById('filter-dash-tkt-tecnico'), document.getElementById('filter-tkt-tecnico')];
    const selectsSupervisor = [document.getElementById('filter-ord-supervisor'), document.getElementById('filter-dash-tkt-supervisor'), document.getElementById('filter-tkt-supervisor')];
    
    // Combinar todos los roles operativos para que salgan en ambos filtros
    let allStaff = new Set();
    
    // Agregar de usuarios (tecnicos, supervisores, admins)
    if (Array.isArray(usuarios)) {
      usuarios.forEach(u => { 
        if (u && ['tecnico', 'supervisor', 'admin', 'superadmin'].includes(u.rol) && u.activo !== false && typeof u.nombre === 'string') {
          allStaff.add(u.nombre.trim()); 
        }
      });
    }
    
    // Agregar de tecnicosDb
    if (Array.isArray(tecnicosDb)) {
      tecnicosDb.forEach(t => { 
        if (t && typeof t.nombre === 'string') allStaff.add(t.nombre.trim()); 
      });
    }
    
    // Agregar de tickets y ordenes por si hay historicos
    if (Array.isArray(tickets)) {
      tickets.forEach(t => {
        if (!t) return;
        if (typeof t.asignado === 'string' && t.asignado !== 'Sin asignar') {
          t.asignado.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(t.tecnicosAsignados)) {
          t.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(ordenes)) {
      ordenes.forEach(o => {
        if (!o) return;
        if (typeof o.tecnico === 'string') {
          o.tecnico.split(',').forEach(n => allStaff.add(n.trim()));
        }
        if (Array.isArray(o.tecnicosAsignados)) {
          o.tecnicosAsignados.forEach(n => { if (typeof n === 'string') allStaff.add(n.trim()); });
        }
      });
    }
    
    if (Array.isArray(clientesDb)) {
      clientesDb.forEach(c => {
        if (!c) return;
        if (typeof c.supervisorAsignado === 'string') allStaff.add(c.supervisorAsignado.trim());
        if (Array.isArray(c.supervisoresAsignados)) {
          c.supervisoresAsignados.forEach(s => { if (typeof s === 'string') allStaff.add(s.trim()); });
        }
      });
    }

    const uniqueStaff = Array.from(allStaff).filter(Boolean).sort((a,b) => a.localeCompare(b));
    
    const tecOptionsHtml = '<option value="">Cualquier Técnico</option>' + uniqueStaff.map(n => `<option value="${n}">${n}</option>`).join('');
    const supOptionsHtml = '<option value="">Cualquier Supervisor</option>' + uniqueStaff.map(n => `<option value="${n}">${n}</option>`).join('');
    
    selectsTecnico.forEach(sel => { 
      if(sel) { 
        const val = isTecnico ? userName : sel.value; 
        sel.innerHTML = tecOptionsHtml; 
        sel.value = val; 
        sel.disabled = isTecnico;
      } 
    });
    
    selectsSupervisor.forEach(sel => { 
      if(sel) { 
        const val = isSupervisor ? userName : (isTecnico ? '' : sel.value); 
        sel.innerHTML = supOptionsHtml; 
        sel.value = val; 
        sel.disabled = isSupervisor || isTecnico;
      } 
    });
  } catch (error) {
    console.error('Error al actualizar filtros de personal:', error);
  }
}

// ===== RENDER TICKETS =====
function renderTickets(ctx) {
  const isDashView = ctx === 'dash-tickets';
  const isV2 = ctx === 'v2';
  const bodyId = isDashView ? 'tabla-body-dash-tickets' : (isV2 ? 'v2-tickets-body' : 'tickets-body');
  const searchId = isDashView ? 'search-dash-tickets' : (isV2 ? 'v2-search-tickets' : 'search-tickets');
  
  const body = document.getElementById(bodyId);
  if (!body) return;
  const q = (document.getElementById(searchId)?.value || '').toLowerCase();
  
  let filtered = tickets.filter(t =>
    !q ||
    String(t.asunto||'').toLowerCase().includes(q) ||
    String(t.solicitante||'').toLowerCase().includes(q) ||
    String(t.cliente||'').toLowerCase().includes(q) ||
    String(t.asignado||'').toLowerCase().includes(q) ||
    String(t.folio||'').toLowerCase().includes(q)
  );
  
  let tecFilter = document.getElementById(isDashView ? 'filter-dash-tkt-tecnico' : 'filter-tkt-tecnico')?.value;
  let supFilter = document.getElementById(isDashView ? 'filter-dash-tkt-supervisor' : 'filter-tkt-supervisor')?.value;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  
  if (isEmpresa) {
    let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
    if (nombreEmpresaLogged) {
      nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
      filtered = filtered.filter(t => {
        const tcli = String(t.cliente || '').toLowerCase().trim();
        const tsol = String(t.solicitante || '').toLowerCase().trim();
        return tcli === nombreEmpresaLogged || tsol === nombreEmpresaLogged;
      });
    } else {
      filtered = [];
    }
  }

  if (currentUser) {
     if (currentUser.rol === 'tecnico') tecFilter = currentUser.nombre;
     if (currentUser.rol === 'supervisor') supFilter = currentUser.nombre;
  }
  
  if (tecFilter || supFilter) {
    const tecName = tecFilter; // Ahora usamos el nombre directamente
    
    filtered = filtered.filter(t => {
      let passTec = true;
      let passSup = true;
      
      if (tecFilter && tecName) {
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados;
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         passTec = assigned.includes(tecName) || t.solicitante === tecName || t.creadoPor === tecName;
      }
      
      if (supFilter) {
         let passSupClient = false;
         const cli = clientesDb.find(c => c.nombre === t.cliente);
         if (cli) {
            const supUser = usuarios.find(u => u.nombre === supFilter || u.id === supFilter);
            const supId = supUser ? supUser.id : supFilter;
            passSupClient = (cli.supervisoresAsignados && cli.supervisoresAsignados.includes(supId)) || (cli.supervisorAsignado === supId) || (cli.supervisorAsignado === supFilter);
         }
         
         let assigned = [];
         if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) assigned = t.tecnicosAsignados;
         else if (t.asignado && t.asignado !== 'Sin asignar') assigned = String(t.asignado).split(',').map(s=>s.trim());
         
         let passSupTicket = assigned.includes(supFilter) || t.solicitante === supFilter || t.creadoPor === supFilter;
         
         passSup = passSupClient || passSupTicket;
      }
      
      return passTec && passSup;
    });
  }
  
  if (!isDashView && !isV2 && ticketFiltroActivo !== 'todos') {
    filtered = filtered.filter(t => t.estado === ticketFiltroActivo);
  }
  if (isV2 && filtroTicketsV2 !== 'todos') {
    filtered = filtered.filter(t => (t.estado || '').toLowerCase() === filtroTicketsV2.toLowerCase());
  }
  
  if (isDashView && !q) {
    // Si estamos en el dashboard y no hay búsqueda, mostramos los 8 más recientes
    filtered = filtered.slice(0, 8);
  }
  
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state">No hay tickets${q||(!isDashView && ticketFiltroActivo!=='todos')?' que coincidan':' registrados'}.</td></tr>`;
    return;
  }
  const canEdit = currentSession.viewMode !== 'consulta';
  const canDelete = ['superadmin', 'admin'].includes(currentSession.viewMode);

  body.innerHTML = filtered.map((t, i) => `
    <tr style="cursor:pointer; transition: background 0.2s;" onclick="if(!event.target.closest('.action-btn')){ verDetalleTicket('${t.id}'); }" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
      <td data-label="Acciones" style="white-space:nowrap; width:60px;">
        <div style="display:flex;gap:0.25rem;">
          <button class="action-btn" onclick="verDetalleTicket('${t.id}')" title="Ver"><i data-lucide="eye"></i></button>
          ${canEdit ? `<button class="action-btn" onclick="editarTicket('${t.id}')" title="Editar"><i data-lucide="pencil"></i></button>` : ''}
        </div>
      </td>
      <td data-label="Folio"><strong>${t.folio||('#'+(i+1))}</strong></td>
      <td data-label="Asunto">
        <div style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.asunto || ''}">
          ${t.asunto||'—'}
        </div>
      </td>
      <td data-label="Solicitante">
        <div style="font-weight:500; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.solicitante || ''}">${t.solicitante||'—'}</div>
        ${t.cliente ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.cliente}${t.sitio ? ` - ${t.sitio}` : ''}"><i data-lucide="building-2" style="width:10px;height:10px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${t.cliente}${t.sitio ? ` - ${t.sitio}` : ''}</div>` : ''}
      </td>
      <td data-label="Área" style="white-space:nowrap;">${t.area||'—'}</td>
      <td data-label="Prioridad" class="col-prioridad" style="white-space:nowrap; display: ${isEmpresa ? 'none' : ''};"><span class="badge badge-${String(t.prioridad||'media').toLowerCase()}">${t.prioridad||'—'}</span></td>
      <td data-label="Estado" style="white-space:nowrap;"><span class="badge badge-${badgeTicketEstado(t.estado)}">${t.estado||'—'}</span></td>
      <td data-label="Asignado" style="white-space:nowrap;">${t.asignado||'—'}</td>
      <td data-label="Fecha" style="white-space:nowrap;">${t.fecha||'—'}</td>
      <td data-label="" style="width:40px; text-align:center;">
        ${canDelete ? `<button class="action-btn del" onclick="eliminarTicket('${t.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function badgeTicketEstado(estado) {
  const map = { 'Abierto':'abierto', 'Cotización':'en-proceso', 'Cerrado':'cerrado' };
  return map[estado] || 'abierto';
}

// ===== MAQUINARIA VIEW =====
let currentMaqView = 'lista';
let maqMap = null;
let maqMapMarkers = [];

function setMaqView(view) {
  currentMaqView = view;
  const btnLista = document.getElementById('btn-maq-lista');
  const btnMapa = document.getElementById('btn-maq-mapa');
  
  if (btnLista) {
    btnLista.style.background = view === 'lista' ? 'var(--accent-light)' : 'transparent';
    btnLista.style.color = view === 'lista' ? 'var(--accent)' : 'var(--text-muted)';
    btnLista.style.borderColor = view === 'lista' ? 'var(--accent)' : 'transparent';
  }
  if (btnMapa) {
    btnMapa.style.background = view === 'mapa' ? 'var(--accent-light)' : 'transparent';
    btnMapa.style.color = view === 'mapa' ? 'var(--accent)' : 'var(--text-muted)';
    btnMapa.style.borderColor = view === 'mapa' ? 'var(--accent)' : 'transparent';
  }
  
  document.getElementById('maquinaria-list-wrapper').style.display = view === 'lista' ? 'block' : 'none';
  const pagCtr = document.getElementById('maquinaria-pagination');
  if (pagCtr) pagCtr.style.display = view === 'lista' ? 'flex' : 'none';
  
  document.getElementById('maquinaria-map-wrapper').style.display = view === 'mapa' ? 'block' : 'none';
  
  if (view === 'mapa') {
    if (!maqMap) {
      // Centro de México aproximado por defecto
      maqMap = L.map('maquinaria-map').setView([23.6345, -102.5528], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      }).addTo(maqMap);
    }
    setTimeout(() => {
      maqMap.invalidateSize();
      renderMaquinaria(); // Forzar update de pines
    }, 200);
  }
}

function toggleSortMaquinaria(col) {
  if (currentMaqSortCol === col) {
    currentMaqSortDir = currentMaqSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentMaqSortCol = col;
    currentMaqSortDir = 'asc';
  }
  renderMaquinaria();
}

function renderMaquinaria() {
  const body = document.getElementById('tabla-body-maquinaria');
  if (!body) return;

  const q = (document.getElementById('search-maquinaria')?.value || '').toLowerCase();
  
  // Si es rol empresa, solo vemos las suyas (usando el nombre del user logueado)
  const isEmpresa = ['empresa', 'cliente'].includes(String(currentSession.viewMode || '').toLowerCase().trim());
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
  if (nombreEmpresaLogged) nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
  const canEdit = currentSession.viewMode !== 'consulta' && !isEmpresa;

  let allMachines = [];
  
  // Agregar máquinas de SAP
  maquinariaDb.forEach(m => {
    if (isEmpresa) {
      if (!nombreEmpresaLogged) return;
      const mcli = String(m.cliente || '').toLowerCase().trim();
      if (mcli !== nombreEmpresaLogged) return;
    }
    allMachines.push({
      cliente: m.cliente || 'N/A',
      idInterno: m.idInterno || m.id || m.serie || 'N/A',
      uniqueId: m.id || m.idInterno,
      tipo: m.tipo || m.customData?.tipo || 'N/A',
      marca: m.marca || '',
      modelo: m.modelo || m.descripcion || 'Sin Modelo',
      serie: m.serie || 'N/A',
      numeroEconomico: m.numeroEconomico || m.customData?.numeroEconomico || 'N/A',
      numeroMotor: m.numeroMotor || m.customData?.numeroMotor || 'N/A',
      anio: m.anio || 'N/A',
      venta: m.venta || m.customData?.venta || '',
      ubicacion: m.ubicacion || m.customData?.ubicacion || m.cliente || 'N/A',
      latitud: m.latitud || m.customData?.latitud,
      longitud: m.longitud || m.customData?.longitud
    });
  });

  // Combinar con máquinas creadas manualmente en clientesDb
  clientesDb.forEach(c => {
    if (isEmpresa && c.nombre !== nombreEmpresaLogged) return; // Filtro de seguridad
    if (c.maquinas) {
      c.maquinas.forEach(m => {
        // En base a que la maquinaria es 100% manual y no viene de SAP,
        // no ocultamos por serie duplicada para evitar que pruebas o errores de capa 8
        // hagan pensar al usuario que la máquina se borró.
        // Solo evitamos duplicados si por algún milagro tienen el mismo ID interno exacto ya en la lista.
        const isDuplicate = allMachines.some(sm => sm.idInterno === m.idInterno);
        if (!isDuplicate) {
            allMachines.push({
              cliente: c.nombre,
              idInterno: m.idInterno || m.id || m.serie || 'N/A',
              uniqueId: m.id || m.idInterno,
              tipo: m.tipo || 'N/A',
              marca: m.marca || '',
              modelo: m.modelo || 'Sin Modelo',
            serie: m.serie || 'N/A',
            numeroEconomico: m.numeroEconomico || 'N/A',
            numeroMotor: m.numeroMotor || 'N/A',
            anio: m.anio || 'N/A',
            venta: m.venta || '',
            ubicacion: m.ubicacion || 'N/A',
            latitud: m.latitud,
            longitud: m.longitud
          });
        }
      });
    }
  });

  // Opciones de Filtro Dinámico
  const filterSitioEl = document.getElementById('filter-maq-sitio');
  const filterMarcaEl = document.getElementById('filter-maq-marca');
  
  
  const filterSitio = filterSitioEl?.value || '';
  const filterMarca = filterMarcaEl?.value || '';
  

  if (filterSitioEl && filterMarcaEl) {
    const valSitio = filterSitioEl.value;
    const valMarca = filterMarcaEl.value;
    
    const uniqueSitios = [...new Set(allMachines.map(m => m.ubicacion).filter(Boolean))].sort();
    const uniqueMarcas = [...new Set(allMachines.map(m => m.marca).filter(Boolean))].sort();
    
    filterSitioEl.innerHTML = '<option value="">Todos los Sitios</option>' + uniqueSitios.map(s => `<option value="${s}">${s}</option>`).join('');
    filterMarcaEl.innerHTML = '<option value="">Todas las Marcas</option>' + uniqueMarcas.map(m => `<option value="${m}">${m}</option>`).join('');
    
    filterSitioEl.value = uniqueSitios.includes(valSitio) ? valSitio : '';
    filterMarcaEl.value = uniqueMarcas.includes(valMarca) ? valMarca : '';
  }

  // Filtrar
  let filtered = allMachines.filter(m => {
    const matchQ = !q || m.cliente.toLowerCase().includes(q) || m.idInterno.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q) || m.modelo.toLowerCase().includes(q) || m.serie.toLowerCase().includes(q);
    const matchSitio = !filterSitio || m.ubicacion === filterSitio;
    const matchMarca = !filterMarca || m.marca === filterMarca;
    return matchQ && matchSitio && matchMarca;
  });

  // Ordenar usando variables globales
  if (currentMaqSortCol === 'reciente') {
    filtered.reverse();
  } else {
    filtered.sort((a, b) => {
      let valA = a[currentMaqSortCol] || '';
      let valB = b[currentMaqSortCol] || '';
      
      if (currentMaqSortCol === 'anio') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
        return currentMaqSortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return currentMaqSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentMaqSortDir === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }

  // Actualizar iconos rehaciendo las etiquetas <i>
  ['tipo', 'marca', 'modelo', 'serie', 'numeroEconomico', 'numeroMotor', 'anio', 'cliente'].forEach(col => {
    const icon = document.getElementById('sort-icon-' + col);
    if (icon) {
      const isCurrent = currentMaqSortCol === col;
      const iconName = isCurrent ? (currentMaqSortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
      const color = isCurrent ? 'var(--accent)' : 'var(--text-muted)';
      icon.outerHTML = `<i id="sort-icon-${col}" data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;color:${color};"></i>`;
    }
  });

  const thId = document.getElementById('th-maquinaria-id');
  if (thId) thId.style.display = isEmpresa ? 'none' : '';

  // RENDERIZAR CABECERAS PERSONALIZADAS
  const trHeaderMaq = document.querySelector('#view-maquinaria .data-table thead tr');
  if (trHeaderMaq) {
    trHeaderMaq.querySelectorAll('.custom-th-maq').forEach(el => el.remove());
    if (configData.mappings?.maquinaria?.customCols) {
      configData.mappings.maquinaria.customCols.forEach(col => {
        const th = document.createElement('th');
        th.className = 'custom-th-maq';
        th.textContent = col.label;
        trHeaderMaq.insertBefore(th, trHeaderMaq.lastElementChild);
      });
    }
  }

  if (filtered.length === 0) {
    const colspan = (isEmpresa ? 8 : 9) + (configData.mappings?.maquinaria?.customCols?.length || 0);
    body.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">No se encontró maquinaria.</td></tr>`;
    actualizarMapaMaquinaria(filtered);
    return;
  }

  body.innerHTML = filtered.map(m => {
    const logoPath = getLogoMarca(m.marca);
    
    let customTds = '';
    if (configData.mappings?.maquinaria?.customCols) {
      configData.mappings.maquinaria.customCols.forEach(col => {
        customTds += `<td data-label="${col.label}" style="font-size:0.85rem;">${m.customData && m.customData[col.label] ? m.customData[col.label] : 'N/A'}</td>`;
      });
    }

    return `
    <tr onclick="verServiciosMaquina('${m.idInterno}', '${m.serie}', '${m.marca.replace(/'/g, "\\'")}', '${m.modelo.replace(/'/g, "\\'")}', '${m.cliente.replace(/'/g, "\\'")}', '${m.ubicacion.replace(/'/g, "\\'")}')" style="cursor:pointer;" class="table-row-hover">
      ${!isEmpresa ? `<td data-label="ID Interno"><span style="font-family:monospace; font-weight:500; color:var(--accent); background:var(--blue-light); padding:0.2rem 0.5rem; border-radius:4px;">${m.idInterno}</span></td>` : ''}
      <td data-label="Tipo">${m.tipo && m.tipo !== 'N/A' ? `<span class="badge" style="background:var(--bg-hover); color:var(--text-primary); border:1px solid var(--border);">${m.tipo}</span>` : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="Marca">
        <div style="display:flex; align-items:center;">
          ${logoPath ? `<img src="${logoPath}" alt="${m.marca}" onerror="this.onerror=null; this.outerHTML='<span>${m.marca}</span>';" style="${getLogoStyle(m.marca)}"/>` : m.marca || '-'}
        </div>
      </td>
      <td data-label="Modelo" style="font-weight:500;">${m.modelo}</td>
      <td data-label="Serie">${m.serie}</td>
      <td data-label="No. Económico">${m.numeroEconomico && m.numeroEconomico !== 'N/A' ? m.numeroEconomico : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="No. Motor">${m.numeroMotor && m.numeroMotor !== 'N/A' ? m.numeroMotor : '<span style="font-size:0.85rem; color:var(--text-muted);">N/A</span>'}</td>
      <td data-label="Año">${m.anio}</td>
      <td data-label="Cliente / Ubicación">
        <div style="font-weight:500;">${m.cliente}</div>
        ${m.ubicacion !== 'N/A' ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${m.ubicacion}</div>` : ''}
      </td>
      ${customTds}
      <td data-label="">
        <div style="display:flex; gap:0.25rem;">
          <button class="action-btn" onclick="event.stopPropagation(); verDetalleCliente('${m.cliente.replace(/'/g, "\\'")}')" title="Ver Perfil de la Empresa">
            <i data-lucide="building-2"></i>
          </button>
          ${canEdit ? `
          <button class="action-btn" onclick="event.stopPropagation(); editarMaquina('${m.cliente.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Editar Máquina">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); abrirModalMoverMaquina('${m.cliente.replace(/'/g, "\\'")}', '${m.uniqueId || m.idInterno}')" title="Mover de Sitio">
            <i data-lucide="map-pin"></i>
          </button>
          ` : ''}
        </div>
      </td>
    </tr>
    `;
  }).join('');
  
  actualizarMapaMaquinaria(filtered);
  lucide.createIcons();
  
  // Inicializar resizers cada vez que se renderiza o se ordena, asegurando que estén activos
  setTimeout(initTableResizers, 100);
}

function actualizarMapaMaquinaria(filteredData) {
  if (!maqMap || currentMaqView !== 'mapa') return;
  
  // Limpiar pines existentes
  maqMapMarkers.forEach(m => maqMap.removeLayer(m));
  maqMapMarkers = [];
  
  let bounds = [];
  let plotted = 0;
  
  filteredData.forEach(m => {
    // Buscar Latitud y Longitud en customData
    let lat = null, lng = null;
    if (m.customData) {
      // Buscar llaves que digan latitud/longitud ignorando mayúsculas
      const keys = Object.keys(m.customData);
      const kLat = keys.find(k => k.toLowerCase() === 'latitud');
      const kLng = keys.find(k => k.toLowerCase() === 'longitud');
      if (kLat) lat = parseFloat(m.customData[kLat]);
      if (kLng) lng = parseFloat(m.customData[kLng]);
    }
    
    // Fallback a las coordenadas manuales si existen
    if (!lat && m.latitud) lat = parseFloat(m.latitud);
    if (!lng && m.longitud) lng = parseFloat(m.longitud);
    
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const logoPath = getLogoMarca(m.marca);
      
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="background:white; border-radius:50%; padding:3px; box-shadow:0 3px 6px rgba(0,0,0,0.3); width:36px; height:36px; display:flex; align-items:center; justify-content:center; border:2px solid var(--accent); position:relative; z-index:2;">
            <img src="${logoPath}" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1000/1000109.png'"/>
          </div>
          <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid var(--accent); position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); z-index:1;"></div>
        `,
        iconSize: [42, 50],
        iconAnchor: [21, 50],
        popupAnchor: [0, -50]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(`
        <div style="font-family:'Inter',sans-serif; text-align:center;">
          <div style="font-weight:600; font-size:0.9rem;">${m.modelo}</div>
          <div style="font-size:0.75rem; color:#666;">SN: ${m.serie}</div>
          <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid #ddd; font-size:0.8rem;">
            <strong>${m.cliente}</strong><br>
            ${m.ubicacion !== 'N/A' ? m.ubicacion : ''}
          </div>
        </div>
      `);
      
      marker.on('dblclick', function() {
        maqMap.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });
      });

      marker.addTo(maqMap);
      maqMapMarkers.push(marker);
      bounds.push([lat, lng]);
      plotted++;
    }
  });
  
  if (bounds.length > 0) {
    maqMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 });
  } else if (plotted === 0) {
    // No hay datos, resetear al centro de México
    maqMap.setView([23.6345, -102.5528], 5);
  }
}

function switchRefTab(tab) {
  const btnCat = document.getElementById('btn-tab-ref-catalogo');
  const btnPen = document.getElementById('btn-tab-ref-pendientes');
  const cat = document.getElementById('ref-tab-catalogo');
  const pen = document.getElementById('ref-tab-pendientes');
  
  if (tab === 'catalogo') {
    if (btnCat) {
      btnCat.classList.add('active');
      btnCat.style.background = 'var(--bg-card)';
      btnCat.style.color = 'var(--text-primary)';
      btnCat.style.fontWeight = '600';
      btnCat.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    if (btnPen) {
      btnPen.classList.remove('active');
      btnPen.style.background = 'transparent';
      btnPen.style.color = 'var(--text-muted)';
      btnPen.style.fontWeight = '500';
      btnPen.style.boxShadow = 'none';
    }
    if (cat) cat.style.display = 'block';
    if (pen) pen.style.display = 'none';
  } else {
    if (btnCat) {
      btnCat.classList.remove('active');
      btnCat.style.background = 'transparent';
      btnCat.style.color = 'var(--text-muted)';
      btnCat.style.fontWeight = '500';
      btnCat.style.boxShadow = 'none';
    }
    if (btnPen) {
      btnPen.classList.add('active');
      btnPen.style.background = 'var(--bg-card)';
      btnPen.style.color = 'var(--text-primary)';
      btnPen.style.fontWeight = '600';
      btnPen.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    if (cat) cat.style.display = 'none';
    if (pen) pen.style.display = 'block';
    renderRefaccionesPendientes();
  }
}

function renderRefaccionesPendientes() {
  const grid = document.getElementById('ref-pendientes-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const pendientes = [];
  ordenes.forEach(o => {
    if (o.ref_necesarias && o.ref_necesarias.length > 0) {
      o.ref_necesarias.forEach(ref => {
        // Encontrar marca
        let foundMarca = '';
        if (ref.clave) {
          const match = refaccionesDb.find(r => r.id === ref.clave || r.codigo === ref.clave);
          if (match) foundMarca = match.marca;
        }
        if (!foundMarca && ref.descripcion) {
          const match = refaccionesDb.find(r => r.descripcion === ref.descripcion);
          if (match) foundMarca = match.marca;
        }
        
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        
        pendientes.push({
          ordenId: o.id,
          ordenFolio: o.folio,
          tecnico: o.tecnicoResponsable || o.tecnico || 'Desconocido',
          maquina: o.maquina || 'Sin Asignar',
          sitio: o.sitio || o.ubicacion || 'Desconocido',
          marca: MARCAS_RENDER[(foundMarca || '').toUpperCase()] || foundMarca || 'S/M',
          descripcion: ref.descripcion || 'Sin Descripción',
          cantidad: ref.cantidad || 1,
          clave: ref.clave || 'S/C',
          fecha: o.fecha || null
        });
      });
    }
  });
  
  pendientes.sort((a,b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  
  if (pendientes.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted); padding:1rem; grid-column: 1/-1;">No hay refacciones pendientes solicitadas en las Órdenes de Servicio actuales.</div>';
    return;
  }
  
  pendientes.forEach(p => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'flex-start';
    card.style.padding = '1.25rem';
    card.style.position = 'relative';
    
    card.innerHTML = `
      <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
        <span style="font-weight:800; font-size:1.15rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
          <span style="background:var(--accent-light); color:var(--accent); padding:0.1rem 0.4rem; border-radius:4px; font-size:0.9rem;">${p.cantidad}x</span> 
          ${p.marca}
        </span>
        <span class="status-badge status-open" style="font-size:0.75rem; cursor:pointer;" onclick="editarOrden('${p.ordenId}')" title="Ver/Editar Orden">Orden #${p.ordenFolio || 'S/N'}</span>
      </div>
      <div style="font-weight:600; font-size:0.95rem; color:var(--accent); margin-bottom:0.25rem;">${p.descripcion}</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem; font-family:monospace;">Clave: ${p.clave}</div>
      <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem; color:var(--text-secondary); width:100%; border-top: 1px dashed var(--border); padding-top: 0.75rem;">
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <i data-lucide="settings-2" style="width:14px;height:14px; margin-top:2px; color:var(--text-muted)"></i> 
          <span style="line-height:1.3">${p.maquina}</span>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <i data-lucide="map-pin" style="width:14px;height:14px; margin-top:2px; color:var(--text-muted)"></i> 
          <span style="line-height:1.3">${p.sitio}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="user" style="width:14px;height:14px; color:var(--text-muted)"></i> 
          <span>${p.tecnico}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons({ root: grid });
}

let refaccionesCurrentPage = 1;
const REFACCIONES_PAGE_SIZE = 50;

function renderRefacciones(resetPage = false) {
  if (resetPage) refaccionesCurrentPage = 1;
  const body = document.getElementById('tabla-body-refacciones');
  if (!body) return;

  const q = (document.getElementById('search-refacciones')?.value || '').toLowerCase();

  // Mapa de códigos → nombre completo (para resolver datos del caché de Supabase)
  const MARCAS_RENDER = {
    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
    'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
    'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
    'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
    'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER',
    'KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA',
    'EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
  };
  // Mapa de código numérico de grupo → nombre (exacto de SAP)
  const GRUPOS_RENDER = {
    101: 'Refacciones Cimentación',
    102: 'Refacciones Plantas Concreto',
    103: 'Refacciones Trituracion SAPI',
    104: 'Refacciones Concreto',
    105: 'Refacciones Ollas Revolvedoras',
    106: 'Refacciones Bombas Concreto',
    108: 'Herramienta',
    109: 'Tubería',
    110: 'Refacciones King Kong',
    111: 'Anticipo'
  };

  // Filtrar: sin marca → excluir; busqueda
  const filtered = refaccionesDb.filter(r => {
    // Resolve marca for filtering (may be code or full name in cache)
    const marcaRaw = (r.marca || r.marcaCodigo || '').trim();
    const marcaCode = marcaRaw.toUpperCase();
    const marcaFull = MARCAS_RENDER[marcaCode] || (marcaRaw.length > 4 ? marcaRaw : '');
    if (!marcaFull) return false; // exclude items with no resolvable brand
    if (!q) return true;
    const itemId = (r.idInterno || r.codigo || r.id || '').toLowerCase();
    const itemName = (r.nombre || r.descripcion || '').toLowerCase();
    const itemGrupo = (r.grupo || '').toLowerCase();
    return itemId.includes(q) || itemName.includes(q) || marcaFull.toLowerCase().includes(q) || itemGrupo.includes(q);
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / REFACCIONES_PAGE_SIZE) || 1;
  if (refaccionesCurrentPage > totalPages) refaccionesCurrentPage = totalPages;
  const start = (refaccionesCurrentPage - 1) * REFACCIONES_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + REFACCIONES_PAGE_SIZE);

  let html = '';
  pageItems.forEach(r => {
    const itemId = r.idInterno || r.codigo || r.id || 'N/A';
    const itemName = r.nombre || r.descripcion || 'Sin Nombre';

    // Resolve marca code and full name from maps (handles both cached codes and fresh names)
    const rawMarca = (r.marca || r.marcaCodigo || '').trim();
    const isCode = rawMarca.length <= 4 && rawMarca === rawMarca.toUpperCase();
    const itemMarcaCodigo = isCode ? rawMarca : (r.marcaCodigo || '');
    const marcaKey = (itemMarcaCodigo || rawMarca).toUpperCase();
    const itemMarcaNombre = MARCAS_RENDER[marcaKey] || rawMarca || 'N/A';

    // Resolve group: could be a name string or numeric code
    const grupoRaw = r.grupo || r.ItmsGrpNam || r.GrupoCode || r.ItmsGrpCod || '';
    const itemGrupo = (typeof grupoRaw === 'number')
      ? (GRUPOS_RENDER[grupoRaw] || `Grupo ${grupoRaw}`)
      : (grupoRaw || GRUPOS_RENDER[r.ItmsGrpCod] || 'N/A');

    const itemStock = r.stock || 0;
    let itemOrigen = r.origen || '';
    if (!itemOrigen && itemId !== 'N/A') {
      itemOrigen = itemId.toUpperCase().endsWith('N') ? 'Nacional' : 'Importado';
    }
    itemOrigen = itemOrigen || 'N/A';

    let customTds = '';
    if (configData?.mappings?.refacciones?.customCols) {
      configData.mappings.refacciones.customCols.forEach(col => {
        customTds += `<td style="font-size:0.85rem; color:var(--text-secondary);">${r.customData && r.customData[col.label] ? r.customData[col.label] : 'N/A'}</td>`;
      });
    }
    
    html += `
      <tr>
        <td style="font-weight: 500; color: var(--text-primary); max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemName}">${itemName}</td>
        <td><span style="font-family:monospace; font-size:0.82rem; font-weight:600; color:var(--accent); background:var(--bg-body); border:1px solid var(--border); padding:2px 6px; border-radius:4px;">${itemMarcaCodigo || marcaKey}</span></td>
        <td style="font-weight: 500; color: var(--text-primary);">${itemMarcaNombre}</td>
        <td><span class="status-badge status-open" style="background:var(--bg-secondary); color:var(--text-secondary);">${itemGrupo}</span></td>
        <td style="font-family: monospace; font-weight: 500;">$${Number(r.precio||0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td style="font-weight: 500; color: ${itemStock > 0 ? 'var(--green)' : 'var(--red)'}">${itemStock}</td>
        <td><span class="badge ${itemOrigen === 'Nacional' ? 'badge-completado' : (itemOrigen === 'Importado' ? 'badge-proceso' : 'badge-pendiente')}">${itemOrigen}</span></td>
        ${customTds}
        <td><button class="action-btn" onclick="mostrarNotificacion('Vista de detalle en construcción', 'info')" title="Ver detalles"><i data-lucide="eye"></i></button></td>
      </tr>
    `;
  });

  body.innerHTML = html || '<tr><td colspan="8" class="empty-state">No se encontraron refacciones.</td></tr>';

  // Pagination + total footer
  let footer = document.getElementById('refacciones-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.id = 'refacciones-footer';
    footer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; font-size:0.82rem; color:var(--text-muted); border-top:1px solid var(--border); flex-wrap:wrap; gap:0.5rem;';
    body.closest('.table-wrapper')?.after(footer);
  }
  footer.innerHTML = `
    <span>Mostrando <strong>${start + 1}–${Math.min(start + REFACCIONES_PAGE_SIZE, total)}</strong> de <strong>${total}</strong> refacciones</span>
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button onclick="refaccionesCurrentPage--; renderRefacciones()" ${refaccionesCurrentPage <= 1 ? 'disabled' : ''} style="padding:0.3rem 0.7rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-size:0.8rem;">← Anterior</button>
      <span>Pág. ${refaccionesCurrentPage} / ${totalPages}</span>
      <button onclick="refaccionesCurrentPage++; renderRefacciones()" ${refaccionesCurrentPage >= totalPages ? 'disabled' : ''} style="padding:0.3rem 0.7rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-size:0.8rem;">Siguiente →</button>
    </div>
  `;

  lucide.createIcons();
}


function renderSitios() {
  const body = document.getElementById('tabla-body-sitios');
  if (!body) return;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const isEmpresa = currentSession.viewMode === 'empresa';
  const isAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
  
  if (!isEmpresa && !isAdmin) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">No tienes permisos para ver Sitios.</td></tr>`;
    return;
  }
  
  let sitiosList = [];
  
  if (isAdmin) {
    sitiosList = sitiosDb;
  } else {
    const clienteObj = clientesDb.find(c => c.nombre === (currentUser.empresa || currentUser.nombre));
    let sitios = clienteObj && clienteObj.sitios ? clienteObj.sitios : [];
    if (clienteObj && clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      sitios = [clienteObj.ubicacion, ...sitios];
    }
    sitiosList = sitios;
  }
  
  if (!sitiosList || sitiosList.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">No se encontraron sitios registrados.</td></tr>`;
    return;
  }
  
  body.innerHTML = sitiosList.map((s, idx) => {
    const isObj = typeof s === 'object' && s !== null;
    const sNombre = isObj ? s.nombre : s;
    const sCp = isObj && s.cp ? s.cp : 'N/A';
    const sCiudad = isObj && s.ciudad ? s.ciudad : '';
    const sEstado = isObj && s.estado ? s.estado : '';
    const sDireccion = isObj && s.direccion ? s.direccion : '';
    
    // Si es admin, mostramos el ID y el BPCode (cliente)
    const sId = isObj && s.id ? s.id : '-';
    let sCliente = isObj && s.cliente ? s.cliente : '-';
    
    let sClienteDisplay = sCliente;
    if (isAdmin && sCliente !== '-') {
      const cliFound = clientesDb.find(c => c.id === sCliente || c.idInterno === sCliente || c.rfc === sCliente);
      if (cliFound) {
        sClienteDisplay = `<div style="font-weight:500;">${cliFound.nombre}</div><div style="font-size:0.75rem; color:var(--text-muted);">ID: ${sCliente}</div>`;
      } else {
        sClienteDisplay = `<div style="font-weight:500; color:var(--text-muted);">ID: ${sCliente}</div>`;
      }
    } else if (sCliente === '-') {
      sClienteDisplay = `<span style="color:var(--text-muted);">N/A</span>`;
    }

    let cpFinal = sCp;
    let ciudadFinal = sCiudad;
    let estadoFinal = sEstado;

    if (isObj && s.customData) {
      if (s.customData['Código Postal']) cpFinal = s.customData['Código Postal'];
      if (s.customData['Ciudad']) ciudadFinal = s.customData['Ciudad'];
      if (s.customData['Estado']) estadoFinal = s.customData['Estado'];
    }

    const sLoc = [ciudadFinal, estadoFinal].filter(Boolean).join(', ') || 'N/A';

    return `
    <tr>
      <td style="font-weight:500;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="map-pin" style="width:16px;height:16px;color:var(--accent);"></i> 
          <div>
            <div>${sNombre}</div>
            ${sDireccion ? `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${sDireccion}</div>` : ''}
            ${isAdmin ? `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">Sitio ID: ${sId}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${sClienteDisplay}</td>
      <td><span class="badge" style="background:var(--bg-hover);color:var(--text-muted);">${cpFinal}</span></td>
      <td><span style="font-size:0.9rem; color:var(--text-secondary);">${sLoc}</span></td>
      <td>
        ${!isAdmin ? `<button class="action-btn" onclick="renombrarSitioEmpresa('${idx}')" title="Renombrar Sitio"><i data-lucide="pencil"></i></button>` : `<button class="action-btn" onclick="abrirDetalleSitio('${sNombre.replace(/'/g, "\\'")}')" title="Ver detalles"><i data-lucide="eye"></i></button>`}
      </td>
    </tr>
    `;
  }).join('');
  lucide.createIcons();
}

function cerrarModalRenombrarSitio(e) {
  if (e && e.target !== document.getElementById('modal-renombrar-sitio-overlay')) return;
  document.getElementById('modal-renombrar-sitio-overlay').classList.remove('open');
}

function renombrarSitioEmpresa(idx) {
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const clienteObj = clientesDb.find(c => c.nombre === (currentUser.empresa || currentUser.nombre));
  if (clienteObj && clienteObj.sitios) {
    let sitios = clienteObj.sitios;
    if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      sitios = [clienteObj.ubicacion, ...sitios];
    }
    const sitioActual = sitios[idx];
    const nombreActual = getSitioNombre(sitioActual);
    
    document.getElementById('rs-idx').value = idx;
    document.getElementById('rs-nombre').value = nombreActual;
    document.getElementById('modal-renombrar-sitio-overlay').classList.add('open');
  }
}

function guardarRenombreSitio(e) {
  e.preventDefault();
  const idx = document.getElementById('rs-idx').value;
  const nuevoNombre = document.getElementById('rs-nombre').value;
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const clienteObj = clientesDb.find(c => c.nombre === (currentUser.empresa || currentUser.nombre));
  
  if (clienteObj && clienteObj.sitios) {
    let sitios = clienteObj.sitios;
    if (clienteObj.ubicacion && !sitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
      sitios = [clienteObj.ubicacion, ...sitios];
    }
    const sitioActual = sitios[idx];
    const nombreActual = getSitioNombre(sitioActual);
    
    if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre.trim() === nombreActual) {
      cerrarModalRenombrarSitio();
      return;
    }
    
    if (typeof sitioActual === 'object') {
      sitioActual.nombre = nuevoNombre.trim();
    } else {
      const originalIdx = clienteObj.sitios.findIndex(s => s === sitioActual);
      if (originalIdx !== -1) {
        clienteObj.sitios[originalIdx] = nuevoNombre.trim();
      } else {
        clienteObj.sitios.push(nuevoNombre.trim());
      }
    }
    
    if (clienteObj.ubicacion === nombreActual) {
      clienteObj.ubicacion = nuevoNombre.trim();
    }
    
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
    renderSitios();
    cerrarModalRenombrarSitio();
  }
}

function filtrarTickets(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ticketFiltroActivo = btn.dataset.filter;
  renderTickets();
}

function setFiltroTickets(estado) {
  ticketFiltroActivo = estado;
  // Sync the existing filter buttons
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === estado);
  });
  renderTickets();
}

// ===== CANAL SELECTION =====
function seleccionarCanal(canal) {
  // Hide all boxes
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  // Show selected
  const box = document.getElementById('canal-input-' + canal);
  if (box) box.style.display = 'block';
}

function updateFileLabel(input) {
  const textSpan = input.parentElement.querySelector('.file-label-text');
  if (input.files && input.files.length > 0) {
    if (input.files.length === 1) {
      textSpan.textContent = input.files[0].name;
    } else {
      textSpan.textContent = `${input.files.length} archivo(s) listo(s)`;
    }
    input.parentElement.style.borderColor = 'var(--accent)';
    input.parentElement.style.color = 'var(--accent)';
    input.parentElement.style.background = 'var(--accent-light)';
  } else {
    textSpan.textContent = 'Toca para subir foto(s)';
    input.parentElement.style.borderColor = 'var(--border)';
    input.parentElement.style.color = 'var(--text-muted)';
    input.parentElement.style.background = 'rgba(255,255,255,0.02)';
  }
}

// ===== TICKET FORM =====
function abrirTicket(id) {
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar tickets.', 'error');
    return;
  }
  editandoTicketId = id || null;
  document.getElementById('ticket-modal-title').textContent = id ? 'Editar Ticket' : 'Nuevo Ticket';
  document.getElementById('form-ticket').reset();

  const t = id ? tickets.find(x => x.id === id) : null;

  // Reset file labels
  ['t-cotizacion-pdf', 't-pedido-pdf'].forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) {
      const textSpan = el.parentElement.querySelector('.file-label-text');
      const hasPdf = inputId === 't-cotizacion-pdf' ? t?.pdfCotizacion : t?.pdfPedido;
      
      if (textSpan) textSpan.textContent = hasPdf ? 'PDF guardado (Sube para reemplazar)' : (inputId === 't-cotizacion-pdf' ? 'Subir cotización en PDF' : 'Subir pedido en PDF');
      
      el.parentElement.style.borderColor = hasPdf ? 'var(--accent)' : 'var(--border)';
      el.parentElement.style.color = hasPdf ? 'var(--accent)' : 'var(--text-muted)';
      el.parentElement.style.background = hasPdf ? 'var(--accent-light)' : 'rgba(255,255,255,0.02)';
    }
  });
  
  // Llenar el combo de clientes
  const comboOptions = document.getElementById('t-cliente-options');
  const inputHidden = document.getElementById('t-cliente');
  const displaySpan = document.getElementById('t-cliente-display');
  
  const isEmpresa = currentSession.viewMode === 'empresa';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreEmpresaLogged = isEmpresa && currentUser ? (currentUser.empresa || currentUser.nombre) : null;

  // Ocultar campos internos para el cliente
  const displayVal = isEmpresa ? 'none' : 'block';
  const displayValFlex = isEmpresa ? 'none' : 'flex';
  const elOrigen = document.getElementById('section-t-origen'); if (elOrigen) elOrigen.style.display = displayVal;
  const elCliente = document.getElementById('group-t-cliente'); if (elCliente) elCliente.style.display = displayVal;
  const elAsignado = document.getElementById('group-t-asignado'); if (elAsignado) elAsignado.style.display = displayVal;
  const elNotas = document.getElementById('group-t-notas'); if (elNotas) elNotas.style.display = displayVal;
  const elEstado = document.getElementById('section-t-estado'); if (elEstado) elEstado.style.display = (isEmpresa || !id) ? 'none' : 'block';
  const elEvidencias = document.getElementById('group-t-evidencias'); if (elEvidencias) elEvidencias.style.display = isEmpresa ? 'block' : 'none';

  if (comboOptions && !isEmpresa) {
    // Resetear valor inicial
    inputHidden.value = '';
    displaySpan.textContent = 'Ninguno / Uso Interno';
    
    // Generar opciones
    comboOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('t-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      comboOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  // Reset canal inputs
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  document.getElementById('t-sitio').value = '';
  document.getElementById('group-t-sitio').style.display = 'none';
  
  poblarMaquinasCliente('t-equipo', '');

  const selectAsignado = document.getElementById('t-asignado');
  if (selectAsignado) {
    selectAsignado.innerHTML = '<option value="">Sin asignar</option>';
    usuarios.filter(u => u.rol === 'supervisor').forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.nombre;
      opt.textContent = u.nombre;
      selectAsignado.appendChild(opt);
    });
  }

  // Si es empresa y es un ticket nuevo, autocompletamos su perfil
  if (isEmpresa && !id) {
    document.getElementById('t-solicitante').value = nombreEmpresaLogged || '';
    if (nombreEmpresaLogged) {
      selectComboOption('t-cliente', nombreEmpresaLogged, nombreEmpresaLogged);
    }
  }

  // Ocultar campos internos si es Empresa
  const displayInternal = isEmpresa ? 'none' : '';
  ['section-t-origen', 'group-t-cliente', 'group-t-asignado', 'group-t-notas', 'section-t-estado', 'group-t-resolucion', 'group-t-cierre'].forEach(elId => {
    const el = document.getElementById(elId);
    if (el) {
      if (!isEmpresa && elId === 'group-t-cliente') {
        el.style.display = 'block'; // Ensure block for combo box wrapper
      } else {
        el.style.display = displayInternal;
      }
    }
  });

  if (id) {
    const t = tickets.find(x => x.id === id);
    if (t) {
      editandoTicketId = id;
      document.getElementById('ticket-modal-title').textContent = 'Editar Ticket: ' + t.folio;
      document.getElementById('t-asunto').value = t.asunto || '';
      document.getElementById('t-solicitante').value = t.solicitante || '';
      document.getElementById('t-area').value = t.area || 'Operaciones';
      document.getElementById('t-cliente').value = t.cliente || '';
      document.getElementById('t-sitio').value = t.sitio || '';
      document.getElementById('t-categoria').value = t.categoria || 'Refacción';
      document.getElementById('t-prioridad').value = t.prioridad || 'Media';
      const selectAsignado = document.getElementById('t-asignado');
      if (selectAsignado) {
        let exists = Array.from(selectAsignado.options).some(o => o.value === t.asignado);
        if (!exists && t.asignado) {
          const opt = document.createElement('option');
          opt.value = t.asignado;
          opt.textContent = t.asignado + ' (No es supervisor)';
          selectAsignado.appendChild(opt);
        }
        selectAsignado.value = t.asignado || '';
      }
      document.getElementById('t-descripcion').value = t.descripcion || '';
      document.getElementById('t-notas').value = t.notas || '';
      
      const horometroEl = document.getElementById('t-horometro');
      if (horometroEl) horometroEl.value = t.horometro || '';
      
      const rEstado = document.querySelector(`input[name="t-estado"][value="${t.estado}"]`);
      if (rEstado) rEstado.checked = true;

      const rCanal = document.querySelector(`input[name="t-canal"][value="${t.canal}"]`);
      if (rCanal) {
        rCanal.checked = true;
        seleccionarCanal(t.canal);
        if (t.canal === 'correo') document.getElementById('t-correo').value = t.contacto || '';
        if (t.canal === 'whatsapp') document.getElementById('t-whatsapp').value = t.contacto || '';
        if (t.canal === 'telefono') document.getElementById('t-telefono').value = t.contacto || '';
      }
      
      if (t.cliente) {
        selectComboOption('t-cliente', t.cliente, t.cliente);
      } else {
        selectComboOption('t-cliente', 'Ninguno / Uso Interno', 'Ninguno / Uso Interno');
      }
      if (t.sitio) {
        const escapedSitio = t.sitio.replace(/'/g, "\\'");
        selectComboOption('t-sitio', escapedSitio, escapedSitio, true);
      }

      poblarMaquinasCliente('t-equipo', t.equipo, t.cliente);
      
      const elCotSap = document.getElementById('t-cotizacion-sap');
      if (elCotSap) elCotSap.value = t.cotizacionSAP || '';
      
      const elPedidoSap = document.getElementById('t-pedido-sap');
      if (elPedidoSap) elPedidoSap.value = t.pedidoSAP || '';
      
      const rAceptada = document.querySelector(`input[name="t-cot-aceptada"][value="${t.cotAceptada}"]`);
      if (rAceptada) rAceptada.checked = true;
      else {
        document.querySelectorAll('input[name="t-cot-aceptada"]').forEach(r => r.checked = false);
      }
      
      const elMotivo = document.getElementById('t-motivo-rechazo');
      if (elMotivo) elMotivo.value = t.motivoRechazo || '';
    }
  }



  toggleResolucionTicket();
  toggleMotivoRechazo();

  document.getElementById('modal-ticket-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function toggleResolucionTicket() {
  const estado = document.querySelector('input[name="t-estado"]:checked')?.value;
  const isCotizacion = estado === 'Cotización';
  const isCerrado = estado === 'Cerrado';
  
  const group = document.getElementById('group-t-resolucion');
  const groupCierre = document.getElementById('group-t-cierre');
  const inSap = document.getElementById('t-cotizacion-sap');
  
  if (group) group.style.display = (isCotizacion || isCerrado) ? 'block' : 'none';
  if (inSap) inSap.required = isCotizacion;
  
  if (groupCierre) groupCierre.style.display = isCerrado ? 'block' : 'none';
}

function toggleMotivoRechazo() {
  const aceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
  const groupMotivo = document.getElementById('group-t-motivo-rechazo');
  const txtMotivo = document.getElementById('t-motivo-rechazo');
  const groupPedido = document.getElementById('group-t-pedido');
  const inPedidoSap = document.getElementById('t-pedido-sap');
  
  if (groupMotivo) groupMotivo.style.display = (aceptada === 'no') ? 'block' : 'none';
  if (txtMotivo) txtMotivo.required = (aceptada === 'no');
  
  if (groupPedido) groupPedido.style.display = (aceptada === 'si') ? 'block' : 'none';
  if (inPedidoSap) inPedidoSap.required = (aceptada === 'si');
}

function editarTicket(id) { abrirTicket(id); }

function cerrarTicket(e) {
  if (e && e.target !== document.getElementById('modal-ticket-overlay')) return;
  document.getElementById('modal-ticket-overlay').classList.remove('open');
  document.getElementById('t-cliente-menu')?.classList.remove('open');
  document.getElementById('t-cliente-combo')?.classList.remove('focus');
  document.body.style.overflow = '';
  editandoTicketId = null;
}

// ===== HELPER MAQUINARIA Y TICKETS =====
function poblarSoportesPorCliente(clienteNombre, selectedSoporte = '') {
  const elSoporte = document.getElementById('f-soporte');
  if (!elSoporte) return;
  
  elSoporte.innerHTML = '<option value="">Ninguno</option>';
  
  const usedSoportes = ordenes.filter(x => x.id !== editandoId).map(x => x.soporte).filter(Boolean);
  const usedPedidos = ordenes.filter(x => x.id !== editandoId).map(x => x.pedido).filter(Boolean);
  
  let validTickets = [];
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno') {
    validTickets = tickets.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si' && !usedSoportes.includes(t.id) && !usedPedidos.includes(t.pedidoSAP) && t.cliente === clienteNombre);
  }
  
  validTickets.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}`;
    if (t.id === selectedSoporte) opt.selected = true;
    elSoporte.appendChild(opt);
  });
  
  if (selectedSoporte && !Array.from(elSoporte.options).some(o => o.value === selectedSoporte)) {
    const opt = document.createElement('option');
    opt.value = selectedSoporte;
    const t = tickets.find(x => x.id === selectedSoporte);
    opt.textContent = t ? `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}` : selectedSoporte;
    opt.selected = true;
    elSoporte.appendChild(opt);
  }
}

function poblarMaquinasCliente(selectId, selectedValue = '', clienteNombre = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccione una máquina registrada...</option><option value="Otra / No registrada">Otra / Captura manual</option>';
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno' && clienteNombre !== 'Ninguno') {
    const c = clientesDb.find(x => x.nombre === clienteNombre);
    if (c && c.maquinas) {
      c.maquinas.forEach(m => {
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const opt = document.createElement('option');
        const mName = `${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        opt.value = mName;
        opt.textContent = mName;
        if (mName === selectedValue) opt.selected = true;
        opt.setAttribute('data-marca', mFullName);
        opt.setAttribute('data-modelo', m.modelo || '');
        opt.setAttribute('data-serie', m.serie || '');
        opt.setAttribute('data-eco', m.no_economico || '');
        opt.setAttribute('data-ubicacion', m.ubicacion || m.sitio || '');
        select.appendChild(opt);
      });
    }
  }
  
  if (selectedValue && !Array.from(select.options).some(o => o.value === selectedValue) && selectedValue !== 'Otra / No registrada') {
    const opt = document.createElement('option');
    opt.value = selectedValue;
    opt.textContent = `${selectedValue} (Registrado previo)`;
    opt.selected = true;
    select.appendChild(opt);
  }
}

function onEquipoOrdenChange() {
  const select = document.getElementById('f-equipo');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;
  
  if (opt.value === 'Otra / No registrada') {
      const cliente = document.getElementById('f-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
          }
      }, 100);
      return;
  }
  
  const modelo = opt.getAttribute('data-modelo');
  const serie = opt.getAttribute('data-serie');
  const eco = opt.getAttribute('data-eco');
  const ubicacion = opt.getAttribute('data-ubicacion');
  
  if (modelo) document.getElementById('f-modelo').value = modelo;
  if (serie) document.getElementById('f-serie').value = serie;
  if (eco) document.getElementById('f-eco').value = eco;
  
  const inUbicacion = document.getElementById('f-ubicacion');
  if (inUbicacion && ubicacion && !inUbicacion.value) {
    inUbicacion.value = ubicacion;
  }
}

function onEquipoTicketChange() {
  const select = document.getElementById('t-equipo');
  if (!select) return;
  if (select.value === 'Otra / No registrada') {
      const cliente = document.getElementById('t-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
          }
      }, 100);
  }
}

// ===== CUSTOM COMBOBOX LOGIC =====
function toggleCombo(id) {
  if (id === 'f-cliente') {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    const soporteId = document.getElementById('f-soporte')?.value;
    let isCerrado = false;
    if (soporteId) {
      const t = tickets.find(x => x.id === soporteId);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      mostrarNotificacion('Solo administradores pueden editar la empresa de la orden.', 'warning');
      return;
    }
    if (isCerrado && currentSession.viewMode !== 'superadmin') {
      mostrarNotificacion('No se puede modificar la empresa porque el ticket asociado ya está cerrado.', 'warning');
      return;
    }
  }

  const menu = document.getElementById(id + '-menu');
  const combo = document.getElementById(id + '-combo');
  const search = document.getElementById(id + '-search');
  
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    combo.classList.remove('focus');
  } else {
    // Cerrar otros menús si hubiera
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
    
    menu.classList.add('open');
    combo.classList.add('focus');
    search.value = '';
    filterCombo(id, ''); // Mostrar todo
    search.focus();
  }
}

function filterCombo(id, query) {
  const q = query.toLowerCase().trim();
  const options = document.querySelectorAll(`#${id}-options .combo-option`);
  let foundMatch = false;
  
  options.forEach(opt => {
    const text = opt.textContent.toLowerCase();
    if (text.includes(q)) {
      opt.style.display = 'block';
      foundMatch = true;
    } else {
      opt.style.display = 'none';
    }
  });

  const addTextSpan = document.getElementById(id + '-add-text');
  if (addTextSpan) {
    const isSitio = id.includes('sitio');
    const entityName = isSitio ? 'sitio' : 'empresa';
    
    if (q && !foundMatch) {
      addTextSpan.textContent = `Crear ${entityName}: "${query}"`;
    } else {
      addTextSpan.textContent = `Crear nuev${isSitio ? 'o' : 'a'} ${entityName}`;
    }
  }
}

function selectComboOption(id, value, label, isInitial = false) {
  document.getElementById(id).value = value;
  const displayEl = document.getElementById(id + '-display');
  if (displayEl) displayEl.textContent = label;
  document.getElementById(id + '-menu').classList.remove('open');
  document.getElementById(id + '-combo').classList.remove('focus');

  if (id === 't-cliente') {
    const sitGroup = document.getElementById('group-t-sitio');
    const sitInput = document.getElementById('t-sitio');
    const sitDisplay = document.getElementById('t-sitio-display');
    const sitOptions = document.getElementById('t-sitio-options');
    
    if (!isInitial) poblarMaquinasCliente('t-equipo', '', value);
    
    if (value && value !== 'Ninguno' && value !== 'Ninguno / Uso Interno') {
      if (sitGroup) sitGroup.style.display = 'block';
      if (sitInput) sitInput.value = '';
      if (sitDisplay) sitDisplay.textContent = 'Ninguno';
      
      if (sitOptions) {
        sitOptions.innerHTML = '<div class="combo-option" onclick="selectComboOption(\'t-sitio\', \'\', \'Ninguno\')">Ninguno</div>';
        const c = clientesDb.find(x => x.nombre === value);
        if (c) {
          const sitios = getNombresDeSitiosParaCliente(c);
          sitios.forEach(sn => {
            const escapedSn = sn.replace(/'/g, "\\'");
            sitOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-sitio', '${escapedSn}', '${escapedSn}')">${sn}</div>`;
          });
        }
      }
    } else {
      if (sitGroup) sitGroup.style.display = 'none';
      if (sitInput) sitInput.value = '';
      if (sitDisplay) sitDisplay.textContent = 'Ninguno';
    }
  } else if (id === 'f-cliente') {
    if (!isInitial) {
      poblarMaquinasCliente('f-equipo', '', value);
      poblarSoportesPorCliente(value, '');
    }
  }
}

function agregarSitioCombo(id) {
  const cName = document.getElementById('t-cliente')?.value;
  if (!cName || cName === 'Ninguno' || cName === 'Ninguno / Uso Interno') {
    mostrarNotificacion('Primero selecciona una Empresa (Cliente).', 'warning');
    return;
  }
  const q = document.getElementById('t-sitio-search')?.value.trim() || '';
  document.getElementById('s-cliente-nombre').value = cName;
  document.getElementById('s-sitio-nombre').value = q;
  document.getElementById('s-sitio-direccion').value = '';
  document.getElementById('modal-sitio-title').textContent = 'Nuevo Sitio: ' + cName;
  document.getElementById('modal-agregar-sitio-overlay').classList.add('open');
  document.getElementById('t-sitio-menu').classList.remove('open');
  document.getElementById('t-sitio-combo').classList.remove('focus');
  window._addingSiteFromTicket = true;
}

function agregarEmpresaCombo(id) {
  const searchVal = document.getElementById(id + '-search').value.trim();
  const nombreEmpresa = searchVal || prompt('Ingresa el nombre de la nueva empresa:');
  
  if (!nombreEmpresa) return;

  // Registrar localmente como cliente legacy para que aparezca
  // Si desean crearle toda la metadata, deberán ir a Clientes > Nuevo Cliente
  // Aquí la damos de alta de forma rápida
  
  let clienteObj = clientesDb.find(c => c.nombre.toLowerCase() === nombreEmpresa.toLowerCase());
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombreEmpresa,
      maquinas: []
    };
    clientesDb.push(clienteObj);
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }

  // Refrescar el combo y seleccionar
  abrirTicket(editandoTicketId); // Esto recargará las opciones con el valor previo mantenido
  selectComboOption(id, nombreEmpresa, nombreEmpresa);
}

// Cerrar combobox si hacen click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('.form-group')) {
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
  }
});

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function guardarTicket(e) {
  e.preventDefault();
  const t_existente = editandoTicketId ? tickets.find(x=>x.id===editandoTicketId) : null;
  const isEmpresa = currentSession.viewMode === 'empresa';
  const estado = (isEmpresa || !editandoTicketId) ? 'Abierto' : (document.querySelector('input[name="t-estado"]:checked')?.value || 'Abierto');
  const canal = isEmpresa ? 'portal' : (document.querySelector('input[name="t-canal"]:checked')?.value || '');
  let contacto = '';
  if (!isEmpresa) {
    if (canal === 'correo') contacto = document.getElementById('t-correo')?.value?.trim();
    if (canal === 'whatsapp') contacto = document.getElementById('t-whatsapp')?.value?.trim();
    if (canal === 'telefono') contacto = document.getElementById('t-telefono')?.value?.trim();
  } else {
    // Si es empresa, el contacto es su propio correo si existe
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    contacto = currentUser ? currentUser.email : '';
  }
  
  if (!isEmpresa) {
    const asignadoVal = document.getElementById('t-asignado').value.trim();
    if (!asignadoVal) {
      mostrarNotificacion('Debe seleccionar a quién va asignado el ticket.', 'error');
      return;
    }
    const clienteVal = document.getElementById('t-cliente').value.trim();
    if (!clienteVal) {
      mostrarNotificacion('Debe seleccionar la Empresa / Cliente afectada.', 'error');
      return;
    }
  }
  
  if (!isEmpresa && estado === 'Cotización') {
    const cotSAP = document.getElementById('t-cotizacion-sap')?.value.trim();
    
    if (!cotSAP) {
      mostrarNotificacion('Debe ingresar el Número de Cotización SAP para pasar a Cotización.', 'error');
      return;
    }
  }

  if (!isEmpresa && estado === 'Cerrado') {
    const cotAceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
    const motivoRechazo = document.getElementById('t-motivo-rechazo')?.value.trim() || '';
    const pedidoSAP = document.getElementById('t-pedido-sap')?.value.trim() || '';
    const pedidoPdfUpload = document.getElementById('t-pedido-pdf')?.files.length > 0;
    
    if (!cotAceptada) {
      mostrarNotificacion('Debe indicar si la cotización fue aceptada o rechazada para cerrar el ticket.', 'error');
      return;
    }
    
    if (cotAceptada === 'no' && !motivoRechazo) {
      mostrarNotificacion('Debe especificar el motivo del rechazo.', 'error');
      return;
    }
    
    if (cotAceptada === 'si') {
      if (!pedidoSAP) {
        mostrarNotificacion('Debe ingresar el Número de Pedido SAP para cerrar una cotización aceptada.', 'error');
        return;
      }
      if (!pedidoPdfUpload && !t_existente?.pdfPedido) {
        mostrarNotificacion('Debe adjuntar el archivo PDF del pedido para cerrar la cotización aceptada.', 'error');
        return;
      }
    }
  }

  let pdfPedidoBase64 = t_existente ? t_existente.pdfPedido : null;
  const pedidoPdfInput = document.getElementById('t-pedido-pdf');
  if (pedidoPdfInput && pedidoPdfInput.files.length > 0) {
    try { pdfPedidoBase64 = await readFileAsBase64(pedidoPdfInput.files[0]); } catch(e){}
  }

  let pdfCotizacionBase64 = t_existente ? t_existente.pdfCotizacion : null;
  const cotPdfInput = document.getElementById('t-cotizacion-pdf');
  if (cotPdfInput && cotPdfInput.files.length > 0) {
    try { pdfCotizacionBase64 = await readFileAsBase64(cotPdfInput.files[0]); } catch(e){}
  }

  let newFolio = '';
  if (!editandoTicketId) {
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const prefix = `TKT-${yearStr}`;
    const ticketsDelAnio = tickets.filter(t => t.folio && t.folio.startsWith(prefix));
    let maxConsecutivo = 0;
    ticketsDelAnio.forEach(t => {
      const numStr = t.folio.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
    });
    newFolio = `${prefix}${(maxConsecutivo + 1).toString().padStart(3, '0')}`;
  }

  const ticket = {
    id: editandoTicketId || crypto.randomUUID(),
    folio: editandoTicketId ? t_existente?.folio : newFolio,
    fecha: t_existente ? t_existente.fecha : new Date().toISOString().split('T')[0],
    fechaCreacion: t_existente ? t_existente.fechaCreacion : new Date().toISOString(),
    fechaCierre: estado === 'Cerrado' ? (t_existente?.fechaCierre || new Date().toISOString()) : null,
    canal,
    contacto,
    asunto: document.getElementById('t-asunto').value.trim(),
    cliente: document.getElementById('t-cliente')?.value || '',
    sitio: document.getElementById('t-sitio')?.value || '',
    solicitante: document.getElementById('t-solicitante').value.trim(),
    creadoPor: t_existente ? (t_existente.creadoPor || t_existente.solicitante) : (usuarios.find(u => u.id === currentSession.userId)?.nombre || ''),
    area: document.getElementById('t-area').value,
    categoria: document.getElementById('t-categoria').value,
    prioridad: document.getElementById('t-prioridad').value,
    asignado: document.getElementById('t-asignado').value.trim(),
    descripcion: document.getElementById('t-descripcion').value.trim(),
    equipo: document.getElementById('t-equipo').value.trim(),
    horometro: document.getElementById('t-horometro')?.value.trim() || '',
    notas: document.getElementById('t-notas').value.trim(),
    estado,
    cotizacionSAP: document.getElementById('t-cotizacion-sap')?.value.trim() || '',
    cotAceptada: document.querySelector('input[name="t-cot-aceptada"]:checked')?.value || '',
    motivoRechazo: document.getElementById('t-motivo-rechazo')?.value.trim() || '',
    pedidoSAP: document.getElementById('t-pedido-sap')?.value.trim() || '',
    tecnicosAsignados: t_existente ? (t_existente.tecnicosAsignados || []) : [],
    pdfPedido: pdfPedidoBase64,
    pdfCotizacion: pdfCotizacionBase64
  };
  
  if (isEmpresa && !editandoTicketId && !ticket.asignado) {
    const c = clientesDb.find(x => x.nombre === ticket.cliente);
    if (c) {
      if (c.tecnicosAsignados && c.tecnicosAsignados.length > 0) {
        ticket.asignado = c.tecnicosAsignados.map(id => usuarios.find(u => u.id === id)?.nombre).filter(Boolean).join(', ');
      } else if (c.tecnicoAsignado) { // Legacy single support
        const tecUser = usuarios.find(u => u.id === c.tecnicoAsignado);
        if (tecUser) ticket.asignado = tecUser.nombre;
      }
    }
  }
  if (editandoTicketId) {
    tickets = tickets.map(t => t.id === editandoTicketId ? ticket : t);
  } else {
    tickets.unshift(ticket);
  }
  
  // Guardar SIEMPRE en local como respaldo (con try-catch para evitar que un PDF gigante rompa la subida a la nube)
  try {
    localStorage.setItem('sapi_tickets', JSON.stringify(tickets));
  } catch (err) {
    console.error('Error al guardar en localStorage (¿exceso de cuota por PDF?):', err);
    mostrarNotificacion('El archivo adjunto es muy pesado para la memoria local, pero intentaremos subirlo a la nube.', 'error');
  }
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', ticket);
  }
  cerrarTicket();
  renderTickets();
  updateTicketBadge();
}

function eliminarTicket(id) {
  if (!confirm('¿Eliminar este ticket?')) return;
  tickets = tickets.filter(t => t.id !== id);
  localStorage.setItem('sapi_tickets', JSON.stringify(tickets));
  
  if (window.supabaseClient) {
    window.supabaseClient.from('tickets').delete().eq('id', id).then(() => {});
  }
  renderTickets();
  updateTicketBadge();
}

// ===== DETALLE TICKET =====
function verDetalleTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  document.getElementById('ticket-detalle-title').textContent = `Ticket ${t.folio}`;
  const field = (label, val) => `
    <div class="detalle-field">
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;
  document.getElementById('ticket-detalle-body').innerHTML = `
    <div class="detalle-section">
      <div class="detalle-section-title">Datos del Ticket</div>
      <div class="detalle-grid">
        ${field('Folio', t.folio)}
        ${field('Fecha', t.fecha)}
        ${t.cliente ? field('Cliente', `${t.cliente}${t.sitio ? ` (Sitio: ${t.sitio})` : ''}`) : ''}
        ${field('Canal', t.canal ? ({correo:'Correo',whatsapp:'WhatsApp',telefono:'Llamada Tel.'}[t.canal]||t.canal) : '—')}
        ${field('Contacto', t.contacto)}
        ${field('Estado', `<span class="badge badge-${badgeTicketEstado(t.estado)}">${t.estado}</span>`)}
        ${!['empresa', 'cliente'].includes(currentSession.viewMode) ? field('Prioridad', `<span class="badge badge-${(t.prioridad||'media').toLowerCase()}">${t.prioridad}</span>`) : ''}
        ${field('Solicitante', t.solicitante)}
        ${field('Área', t.area)}
        ${field('Categoría', t.categoria)}
        ${field('Asignado a', t.asignado)}
        ${field('Equipo / Máquina', t.equipo)}
      </div>
    </div>
    <div class="detalle-section">
      <div class="detalle-section-title">Descripción</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.descripcion||'—'}</div></div>
    </div>
    ${(t.notas && currentSession.viewMode !== 'empresa') ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Notas Internas</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.notas}</div></div>
    </div>` : ''}

    ${t.estado === 'Cerrado' ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Resolución Final</div>
      <div class="detalle-grid">
        ${t.cotizacionSAP ? field('Cotización SAP', t.cotizacionSAP) : ''}
        ${t.pdfCotizacion ? field('PDF Cotización', `<a href="${t.pdfCotizacion}" download="Cotizacion_${t.folio}.pdf" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</a>`) : ''}
        ${t.cotAceptada ? field('Resultado', t.cotAceptada === 'si' ? '<span style="color:var(--success); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Aprobada</span>' : '<span style="color:var(--danger); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> Rechazada</span>') : ''}
        ${t.motivoRechazo ? field('Motivo Rechazo', t.motivoRechazo) : ''}
        ${t.pedidoSAP ? field('Pedido SAP', t.pedidoSAP) : ''}
        ${t.pdfPedido ? field('PDF Pedido', `<a href="${t.pdfPedido}" download="Pedido_${t.folio}.pdf" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</a>`) : ''}
        ${t.tecnicosAsignados && t.tecnicosAsignados.length > 0 ? field('Técnicos Asignados', t.tecnicosAsignados.join(', ')) : ''}
      </div>
    </div>
    ` : ''}

    ${t.estado === 'Abierto' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px;">
      <div class="detalle-section-title" style="margin-bottom:0.5rem; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="file-text"></i> Procesar Cotización</div>
      <div class="form-group full-width" style="margin-bottom:0;">
        <label>Ingresa el No. Cotización SAP para avanzar:</label>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
          <input type="text" id="quick-cot-sap-${t.id}" placeholder="COT-XXXXX" style="flex:1;">
          <button class="btn-primary" onclick="avanzarCotizacionTicket('${t.id}')">Pasar a Cotización</button>
        </div>
      </div>
    </div>
    ` : ''}

    ${t.estado === 'Cotización' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px;">
      <div class="detalle-section-title" style="margin-bottom:0.5rem; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Cierre de Cotización (SAP: ${t.cotizacionSAP || 'N/A'})</div>
      <div class="form-group full-width" style="margin-bottom:0;">
        <label>¿El cliente aceptó la cotización?</label>
        <div style="display:flex; gap:1rem; margin-top:0.5rem; margin-bottom: 0.75rem;">
          <label style="cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
            <input type="radio" name="quick-cot-acep-${t.id}" value="si" onchange="document.getElementById('quick-motivo-${t.id}').style.display='none'; document.getElementById('quick-pedido-${t.id}').style.display='block';"> 
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success);"></i> Sí, aprobada
          </label>
          <label style="cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
            <input type="radio" name="quick-cot-acep-${t.id}" value="no" onchange="document.getElementById('quick-motivo-${t.id}').style.display='block'; document.getElementById('quick-pedido-${t.id}').style.display='none';"> 
            <i data-lucide="x-circle" style="width:16px;height:16px;color:var(--danger);"></i> No, rechazada
          </label>
        </div>
        <div id="quick-motivo-${t.id}" style="display:none; margin-bottom:0.75rem;">
          <textarea id="quick-motivo-text-${t.id}" rows="2" placeholder="Especifica el motivo por el cual fue rechazada..."></textarea>
        </div>
        <div id="quick-pedido-${t.id}" style="display:none; margin-bottom:0.75rem;">
          <div class="form-group full-width">
            <label>No. Pedido SAP *</label>
            <input type="text" id="quick-pedido-sap-${t.id}" placeholder="Ej. PED-200450" />
          </div>
          <div class="form-group full-width" style="margin-top:0.5rem;">
            <label>Archivo Pedido (PDF) *</label>
            <label class="custom-file-upload">
              <input type="file" id="quick-pedido-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this)"/>
              <i data-lucide="upload" style="width:24px; height:24px; margin-bottom:0.4rem;"></i>
              <span class="file-label-text">Subir pedido en PDF</span>
            </label>
          </div>
          <div class="form-group full-width" style="margin-top:0.75rem;">
            <label>Tipo de Visita *</label>
            <select id="quick-tipo-${t.id}">
              <option value="Servicio preventivo">Servicio preventivo</option>
              <option value="Garantía">Garantía</option>
              <option value="Inspección">Inspección</option>
              <option value="Entrega y puesta en marcha">Entrega y puesta en marcha</option>
              <option value="Pre-entrega">Pre-entrega</option>
              <option value="Entrega Refacciones">Entrega Refacciones</option>
            </select>
          </div>
          </div>
        </div>
        <button class="btn-primary full-width" style="justify-content:center;" onclick="cerrarCotizacionTicket('${t.id}')">Finalizar y Cerrar Ticket</button>
      </div>
    </div>
    ` : ''}

    <div style="display:flex; justify-content:center; gap: 4px; height: 35px; width: 80%; margin: 2rem auto 0.5rem auto; opacity: 0.2; color: var(--text-primary);">
      <div style="width:2px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:3px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:2px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:4px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
    </div>
    <div style="font-family: monospace; font-size: 0.6rem; color: var(--text-muted); letter-spacing: 5px; text-align: center; margin-bottom: 1rem;">* ${t.folio} *</div>

    <div class="form-actions" style="border-top:2px dashed var(--border);padding-top:1rem;margin-top:0.5rem; justify-content:center;">
      <button class="btn-secondary" onclick="cerrarDetalleTicket()">Cerrar Vista</button>
      <button class="btn-primary" onclick="cerrarDetalleTicket();editarTicket('${t.id}')"><i data-lucide="pencil" style="width:16px;height:16px;"></i> Editar</button>
    </div>
  `;
  document.getElementById('modal-ticket-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function avanzarCotizacionTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const sap = document.getElementById(`quick-cot-sap-${id}`)?.value.trim();
  if (!sap) {
    mostrarNotificacion('Ingresa el número de cotización SAP.', 'warning');
    return;
  }
  t.cotizacionSAP = sap;
  t.estado = 'Cotización';
  if (window.supabaseClient) {
    window.pushToSupabase('tickets', t);
  }
  mostrarNotificacion('Ticket avanzado a Cotización.', 'success');
  cerrarDetalleTicket();
  renderTickets();
  updateTicketBadge();
}

async function cerrarCotizacionTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const aceptada = document.querySelector(`input[name="quick-cot-acep-${id}"]:checked`)?.value;
  if (!aceptada) {
    mostrarNotificacion('Debes indicar si fue aceptada o rechazada.', 'warning');
    return;
  }
  let motivo = '';
  let pedidoSAP = '';
  let pdfPedidoBase64 = t.pdfPedido || null;
  let tecnicosAsignados = t.tecnicosAsignados || [];
  let tipoVisitaSeleccionado = 'Servicio';
  
  if (aceptada === 'no') {
    motivo = document.getElementById(`quick-motivo-text-${id}`)?.value.trim();
    if (!motivo) {
      mostrarNotificacion('Debes especificar el motivo del rechazo.', 'warning');
      return;
    }
  } else if (aceptada === 'si') {
    pedidoSAP = document.getElementById(`quick-pedido-sap-${id}`)?.value.trim();
    const pdfUpload = document.getElementById(`quick-pedido-pdf-${id}`)?.files.length > 0;
    
    const selTipo = document.getElementById(`quick-tipo-${id}`)?.value;
    if (selTipo) {
      tipoVisitaSeleccionado = selTipo;
    }
    
    if (!pedidoSAP) {
      mostrarNotificacion('Debes ingresar el Número de Pedido SAP.', 'warning');
      return;
    }
    if (!pdfUpload && !pdfPedidoBase64) {
      mostrarNotificacion('Debes adjuntar el archivo PDF del pedido.', 'warning');
      return;
    }
    
    if (pdfUpload) {
      try { pdfPedidoBase64 = await readFileAsBase64(document.getElementById(`quick-pedido-pdf-${id}`).files[0]); } catch(e){}
    }
  }
  
  t.cotAceptada = aceptada;
  t.motivoRechazo = motivo;
  t.pedidoSAP = pedidoSAP;
  t.tecnicosAsignados = tecnicosAsignados;
  t.pdfPedido = pdfPedidoBase64;
  t.estado = 'Cerrado';
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  localStorage.setItem('sapi_tickets', JSON.stringify(tickets));
  
  if (aceptada === 'si') {
    const ordenExistente = ordenes.find(o => o.soporte === t.id);
    if (!ordenExistente) {
      let modeloStr = '';
      let serieStr = '';
      if (t.equipo) {
        let maq = null;
        clientesDb.forEach(c => {
          if (c.maquinas) {
            const found = c.maquinas.find(m => m.idInterno === t.equipo);
            if (found) maq = found;
          }
        });
        if (!maq) maq = maquinariaDb.find(m => m.idInterno === t.equipo);
        
        if (maq) {
          modeloStr = maq.modelo || '';
          serieStr = maq.serie || '';
        } else {
          modeloStr = t.equipo;
        }
      }

      const nuevaOrden = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString().split('T')[0],
        folio: generarFolioConsecutivo(),
        pedido: pedidoSAP || '',
        cliente: t.cliente || '',
        ubicacion: t.sitio || '',
        operador: '', // Se preguntará en sitio
        eco: '',
        horometro: '',
        modelo: modeloStr,
        serie: serieStr,
        tecnico: tecnicosAsignados.join(', '),
        tecnicosAsignados: tecnicosAsignados,
        soporte: t.id,
        km_ida: '', km_vuelta: '', km_total: '',
        tipo: tipoVisitaSeleccionado,
        estado: 'Pendiente',
        falla: (t.asunto ? t.asunto + '\n' : '') + (t.descripcion || ''),
        trabajos: '', dictamen: '', condiciones: '',
        observaciones: '', pendientes: '',
        ref_utilizadas: [], ref_necesarias: [],
        factura_ref: '', factura_mo: '',
        noches: '', alimentacion: '', traslado_costo: '',
        dias: [],
      };

      ordenes.unshift(nuevaOrden);
      localStorage.setItem('sapi_ordenes', JSON.stringify(ordenes));
      if (window.supabaseClient) {
        window.pushToSupabase('ordenes', nuevaOrden);
      }
      mostrarNotificacion('Orden de servicio pre-cargada y generada.', 'success');
      if (typeof renderTabla === 'function') renderTabla('servicios');
    }
  }
  
  mostrarNotificacion('Ticket cerrado con éxito.', 'success');
  cerrarDetalleTicket();
  renderTickets();
  updateTicketBadge();
}

function cerrarDetalleTicket(e) {
  if (e && e.target !== document.getElementById('modal-ticket-detalle-overlay')) return;
  document.getElementById('modal-ticket-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== HELPER: GENERAR ID INTERNO MÁQUINA =====
function getSitioNombre(s) { return typeof s === 'string' ? s : (s?.nombre || ''); }
function getNombresDeSitiosParaCliente(clienteObj) {
  if (!clienteObj) return [];
  let sitiosFromDb = sitiosDb.filter(s => s.cliente === clienteObj.id || s.cliente === clienteObj.idInterno || s.cliente === clienteObj.rfc || s.cliente === clienteObj.nombre).map(s => s.nombre);
  let localSitios = clienteObj.sitios || [];
  if (clienteObj.ubicacion && !localSitios.some(s => getSitioNombre(s) === clienteObj.ubicacion)) {
    localSitios = [clienteObj.ubicacion, ...localSitios];
  }
  return [...new Set([...localSitios.map(getSitioNombre), ...sitiosFromDb])];
}

function generarIdInternoMaquina(marca, anioVenta) {
  const m = marca ? marca.trim().toUpperCase() : 'XX';
  let iniciales = m.replace(/[^A-Z]/g, '');
  if (iniciales.length < 2) {
    iniciales = (iniciales + 'XX').substring(0, 2);
  } else {
    iniciales = iniciales.substring(0, 2);
  }
  
  let yy = '';
  if (anioVenta) {
    if (anioVenta.includes('-')) {
      yy = anioVenta.split('-')[0].substring(2, 4);
    } else {
      yy = anioVenta.toString().substring(2, 4);
    }
  }
  if (!yy || yy.length !== 2) {
    yy = new Date().getFullYear().toString().substring(2, 4);
  }
  
  const prefix = iniciales + yy;
  
  let max = 0;
  
  // Revisar en clientesDb (manuales)
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(maq => {
        if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
          const num = parseInt(maq.idInterno.substring(prefix.length), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    }
  });

  // Revisar también en maquinariaDb (SAP)
  maquinariaDb.forEach(maq => {
    if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
      const num = parseInt(maq.idInterno.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  
  return prefix + (max + 1).toString().padStart(3, '0');
}

function agregarSitioClienteDesdeEmpresa() {
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  if (!currentUser) return;
  agregarSitioCliente(currentUser.empresa || currentUser.nombre);
}

function agregarSitioCliente(nombre) {
  document.getElementById('form-agregar-sitio').reset();
  document.getElementById('s-cliente-nombre').value = nombre;
  document.getElementById('modal-agregar-sitio-overlay').classList.add('open');
  document.getElementById('s-sitio-nombre').focus();
}

function cerrarModalSitio(e) {
  if (e && e.target !== document.getElementById('modal-agregar-sitio-overlay')) return;
  document.getElementById('modal-agregar-sitio-overlay').classList.remove('open');
}

function guardarSitioCliente(e) {
  e.preventDefault();
  const nombre = document.getElementById('s-cliente-nombre').value;
  const nuevoSitio = document.getElementById('s-sitio-nombre').value.trim();
  const cp = document.getElementById('s-sitio-cp')?.value.trim() || '';
  const ciudad = document.getElementById('s-sitio-ciudad')?.value.trim() || '';
  const estado = document.getElementById('s-sitio-estado')?.value.trim() || '';
  const direccion = document.getElementById('s-sitio-direccion')?.value.trim() || '';
  
  if (!nuevoSitio || nuevoSitio === '') return;

  let clienteObj = clientesDb.find(c => c.nombre === nombre);
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombre,
      maquinas: [],
      sitios: []
    };
    clientesDb.push(clienteObj);
  }

  if (!clienteObj.sitios) clienteObj.sitios = [];
  
  const siteExists = clienteObj.sitios.some(s => getSitioNombre(s).toLowerCase() === nuevoSitio.toLowerCase());

  if (!siteExists) {
    clienteObj.sitios.push({
      nombre: nuevoSitio,
      direccion, cp, ciudad, estado
    });
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
    if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
  }
  
  cerrarModalSitio();
  
  if (window._addingSiteFromTicket) {
    selectComboOption('t-cliente', nombre, document.getElementById('t-cliente-display').textContent);
    const escapedSn = nuevoSitio.replace(/'/g, "\\'");
    selectComboOption('t-sitio', escapedSn, escapedSn);
    window._addingSiteFromTicket = false;
  } else if (currentSession.viewMode === 'empresa') {
    renderSitios();
  } else {
    verDetalleCliente(nombre);
  }
}

// ===== COLUMNAS AJUSTABLES =====
function initTableResizers() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach((table, tableIndex) => {
    const theadRow = table.querySelector('thead tr');
    if (!theadRow) return;

    // Load saved widths
    const storageKey = `table_widths_${tableIndex}`;
    const savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

    Array.from(theadRow.children).forEach((th, thIndex) => {
      // Evitar duplicar
      if (th.querySelector('.column-resizer')) {
        th.querySelector('.column-resizer').remove();
      }

      th.style.position = 'relative';
      
      // Apply saved width if exists
      if (savedWidths[thIndex]) {
        th.style.width = savedWidths[thIndex];
        th.style.minWidth = savedWidths[thIndex];
      } else {
        const currentWidth = window.getComputedStyle(th).width;
        if (currentWidth && currentWidth !== '0px' && currentWidth !== 'auto') {
          th.style.minWidth = currentWidth;
        }
      }

      const resizer = document.createElement('div');
      resizer.classList.add('column-resizer');
      resizer.style.width = '6px';
      resizer.style.height = '100%';
      resizer.style.position = 'absolute';
      resizer.style.right = '0';
      resizer.style.top = '0';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      resizer.style.zIndex = '1';
      
      resizer.addEventListener('mouseenter', () => resizer.style.borderRight = '2px solid var(--accent)');
      resizer.addEventListener('mouseleave', () => resizer.style.borderRight = 'none');
      
      th.appendChild(resizer);
      
      let startX = 0;
      let startWidth = 0;
      
      const mouseMoveHandler = function(e) {
        const dx = e.clientX - startX;
        const newWidth = `${startWidth + dx}px`;
        th.style.width = newWidth;
        th.style.minWidth = newWidth;
      };
      
      const mouseUpHandler = function() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        
        // Save new width
        savedWidths[thIndex] = th.style.width;
        localStorage.setItem(storageKey, JSON.stringify(savedWidths));
      };
      
      resizer.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        e.stopPropagation(); // Evita que se active el sort al arrastrar
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initTableResizers, 500);
});

// ─── CALENDARIO ────────────────────────────────────────────────────────────────
let calendarInstance = null;

function actualizarFiltrosCalendario() {
  const selCli = document.getElementById('filter-cal-cliente');
  const selTec = document.getElementById('filter-cal-tecnico');
  if (!selCli || !selTec) return;

  const currentCli = selCli.value;
  const currentTec = selTec.value;

  const isEmpresa = currentSession.viewMode === 'empresa';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const miEmpresa = currentUser ? (currentUser.empresa || currentUser.nombre) : null;

  let clientesDisponibles = ordenes;
  if (isEmpresa) clientesDisponibles = clientesDisponibles.filter(o => o.cliente === miEmpresa);

  const clientesUnicos = [...new Set(clientesDisponibles.map(o => o.cliente).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  let htmlCli = '<option value="">Todos los Clientes</option>';
  clientesUnicos.forEach(c => htmlCli += `<option value="${c}">${c}</option>`);
  
  if (selCli.innerHTML !== htmlCli) {
    selCli.innerHTML = htmlCli;
    selCli.value = currentCli;
    if (!selCli.value && currentCli) selCli.value = ''; 
  }

  const tecnicosUnicos = new Set();
  clientesDisponibles.forEach(o => {
    if (o.tecnico) o.tecnico.split(',').forEach(t => tecnicosUnicos.add(t.trim()));
    if (o.tecnicosAsignados) o.tecnicosAsignados.forEach(t => tecnicosUnicos.add(t));
    if (o.bitacora) o.bitacora.forEach(b => { if(b.tecnico) tecnicosUnicos.add(b.tecnico) });
  });
  
  const tArr = [...tecnicosUnicos].filter(Boolean).sort((a,b) => a.localeCompare(b));
  let htmlTec = '<option value="">Todos los Técnicos</option>';
  tArr.forEach(t => htmlTec += `<option value="${t}">${t}</option>`);
  
  if (selTec.innerHTML !== htmlTec) {
    selTec.innerHTML = htmlTec;
    selTec.value = currentTec;
    if (!selTec.value && currentTec) selTec.value = ''; 
  }
}

function getNthDayOfMonth(year, month, dayOfWeek, n) {
  const date = new Date(year, month, 1);
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    date.setDate(d);
    if (date.getMonth() !== month) break;
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === n) {
        const m = String(month + 1).padStart(2, '0');
        const day = String(d).padStart(2, '0');
        return `${year}-${m}-${day}`;
      }
    }
  }
  return null;
}

function getSemanaSanta(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month - 1, day);
  
  const jueves = new Date(easter);
  jueves.setDate(easter.getDate() - 3);
  
  const viernes = new Date(easter);
  viernes.setDate(easter.getDate() - 2);
  
  const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  return { jueves: format(jueves), viernes: format(viernes) };
}

function getFestivosMexico(year) {
  const ss = getSemanaSanta(year);
  const festivos = [
    { title: 'Año Nuevo', start: `${year}-01-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'party-popper' } },
    { title: 'Día de la Constitución', start: getNthDayOfMonth(year, 1, 1, 1), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'scroll' } },
    { title: 'Natalicio B. Juárez', start: getNthDayOfMonth(year, 2, 1, 3), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'user' } },
    { title: 'Jueves Santo', start: ss.jueves, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Viernes Santo', start: ss.viernes, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Día del Trabajo', start: `${year}-05-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'hard-hat' } },
    { title: 'Independencia', start: `${year}-09-16`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'flag' } },
    { title: 'Revolución Mex.', start: getNthDayOfMonth(year, 10, 1, 3), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'swords' } },
    { title: 'Virgen de Guadalupe', start: `${year}-12-12`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Navidad', start: `${year}-12-25`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'gift' } }
  ];
  if (year === 2024 || year === 2030 || year === 2036) {
    festivos.push({ title: 'Transmisión de Poder', start: `${year}-10-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'landmark' } });
  }
  return festivos;
}

function renderCalendario() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  if (typeof FullCalendar === 'undefined') {
    console.error("FullCalendar no está cargado.");
    return;
  }

  if (calendarInstance) {
    calendarInstance.destroy();
  }

  actualizarFiltrosCalendario();

  const filtroCliente = document.getElementById('filter-cal-cliente')?.value || '';
  const filtroTecnico = document.getElementById('filter-cal-tecnico')?.value || '';

  // Filtrar seguridad (rol empresa)
  const isEmpresa = currentSession.viewMode === 'empresa';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const miEmpresa = currentUser ? (currentUser.empresa || currentUser.nombre) : null;

  const eventos = [];
  
  const currentYear = new Date().getFullYear();
  eventos.push(...getFestivosMexico(currentYear - 1));
  eventos.push(...getFestivosMexico(currentYear));
  eventos.push(...getFestivosMexico(currentYear + 1));
  
  ordenes.filter(o => {
    if (isEmpresa && o.cliente !== miEmpresa) return false;
    if (filtroCliente && o.cliente !== filtroCliente) return false;
    return true;
  }).forEach(o => {
    let bgColor = '#3b82f6'; // Azul
    if (o.tipo === 'Mantenimiento' || o.tipo === 'Servicio preventivo') bgColor = '#10b981'; // Verde
    if (o.tipo === 'Reparación' || o.tipo === 'Inspección') bgColor = '#f59e0b'; // Naranja
    if (o.tipo === 'Garantía') bgColor = '#ef4444'; // Rojo
    if (o.tipo === 'Entrega y puesta en marcha') bgColor = '#8b5cf6'; // Morado
    if (o.tipo === 'Pre-entrega') bgColor = '#06b6d4'; // Cyan
    if (o.tipo === 'Entrega Refacciones') bgColor = '#ec4899'; // Rosa
    if (o.estado === 'Finalizado' || o.estado === 'Cerrada') bgColor = '#6b7280'; // Gris

    if (o.bitacora && o.bitacora.length > 0) {
      o.bitacora.forEach(b => {
        if (filtroTecnico && b.tecnico !== filtroTecnico) return;

        let dateStr = b.fecha;
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
        
        let eventColor = bgColor;
        if (b.nota && b.nota.includes('Programado por supervisor')) {
          eventColor = '#8b5cf6'; // Morado para los programados
        }

        let isAllDay = true;
        let startVal = dateStr;
        let endVal = null;

        if (b.entrada && b.salida) {
          isAllDay = false;
          startVal = `${dateStr}T${b.entrada}:00`;
          
          let endDateStr = dateStr;
          // Si cruza la medianoche (ej. entrada 20:00, salida 02:00)
          if (b.salida < b.entrada) {
            const dObj = new Date(dateStr + 'T00:00:00');
            dObj.setDate(dObj.getDate() + 1);
            endDateStr = dObj.toISOString().split('T')[0];
          }
          endVal = `${endDateStr}T${b.salida}:00`;
        } else if (b.entrada) {
          isAllDay = false;
          startVal = `${dateStr}T${b.entrada}:00`;
        }

        const ev = {
          id: `bit-${b.id || Math.random()}`,
          title: `${(b.tecnico || 'Téc').split(' ')[0]} | ${o.cliente}`,
          start: startVal,
          allDay: isAllDay,
          backgroundColor: eventColor,
          borderColor: eventColor,
          extendedProps: {
            isBitacora: true,
            ordenId: o.id,
            tecnico: b.tecnico || 'Desconocido',
            cliente: o.cliente,
            ubicacion: o.ubicacion || 'Sin ubicación',
            nota: b.nota,
            entrada: b.entrada,
            salida: b.salida
          }
        };

        if (endVal) ev.end = endVal;

        eventos.push(ev);
      });
    }
  });

  calendarInstance = new FullCalendar.Calendar(container, {
    initialView: 'dayGridMonth',
    firstDay: 1, // Start on Monday
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día'
    },
    events: eventos,
    eventClick: function(info) {
      if (info.event.extendedProps.isFestivo) return; // No hacer nada al hacer clic en días festivos
      if (info.event.extendedProps.isBitacora) {
        mostrarPopupBitacora(info);
      } else {
        verDetalle(info.event.id);
      }
    },
    eventContent: function(arg) {
      const bgColor = arg.event.backgroundColor || 'var(--accent)';
      
      if (arg.event.extendedProps.isFestivo) {
        const iconName = arg.event.extendedProps.icon || 'calendar';
        return {
          html: `<div style="background-color:${bgColor}; border:1px solid ${arg.event.borderColor}; border-radius:3px; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:2px 4px; color:${arg.event.textColor}; width:100%; box-sizing:border-box; display:flex; align-items:center; gap:0.25rem;" title="${arg.event.title}">
                   <i data-lucide="${iconName}" style="width:12px; height:12px;"></i>
                   <b>${arg.event.title}</b>
                 </div>`
        };
      }

      let timeText = arg.timeText || '';
      if (!arg.event.allDay && arg.event.extendedProps.entrada) {
        timeText = arg.event.extendedProps.entrada;
        if (arg.event.extendedProps.salida) {
          timeText += ` a ${arg.event.extendedProps.salida}`;
        }
      }

      const timeHtml = timeText ? `<div style="font-weight:700; margin-bottom:1px; font-size:0.7rem; color:rgba(255,255,255,0.9);">${timeText}</div>` : '';
      
      return {
        html: `<div style="background-color:${bgColor}; border-radius:3px; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:3px 4px; color:white; width:100%; box-sizing:border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.2);" title="${arg.event.title}">
                 ${timeHtml}<b>${arg.event.title}</b><br/>
                 <span style="font-size:0.65rem; opacity:0.85;">${arg.event.extendedProps.tecnico || 'Sin asignar'}</span>
               </div>`
      };
    },
    eventDidMount: function(info) {
      if (window.lucide) {
        window.lucide.createIcons({ root: info.el });
      }
    }
  });
  
  calendarInstance.render();
}

function mostrarPopupBitacora(info) {
  const dObj = info.event.start;
  const fechaStr = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const p = info.event.extendedProps;
  
  let horasStr = '';
  if (p.entrada || p.salida) {
    horasStr = `<p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Horario:</strong> ${p.entrada || '--:--'} a ${p.salida || '--:--'}</p>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px; background:var(--bg-card); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding: 1rem 1.5rem;">
        <h3 id="modal-title" style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="calendar-check" style="color:var(--accent);"></i> Avance Diario</h3>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-muted);"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body" style="padding:1.5rem;">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; text-transform:capitalize; font-weight:500;">${fechaStr}</div>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Técnico:</strong> ${p.tecnico}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Cliente:</strong> ${p.cliente}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Ubicación:</strong> ${p.ubicacion}</p>
        ${horasStr}
        <div style="margin-top:1rem; padding:1rem; background:var(--bg-body); border-radius:6px; font-size:0.85rem; border:1px solid var(--border); white-space:pre-wrap; line-height:1.5; color:var(--text-secondary); max-height:250px; overflow-y:auto;">${p.nota}</div>
        <div style="margin-top:1.5rem; text-align:right;">
          <button class="btn-primary" onclick="this.closest('.modal-overlay').remove(); verDetalle('${p.ordenId}')">Ver Orden Completa</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });
}

// ===== PASSWORD RECOVERY FLOW =====

document.addEventListener('DOMContentLoaded', () => {
  if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Mostrar la pantalla de actualización de contraseña
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-step-form').style.display = 'none';
        document.getElementById('login-step-recovery').style.display = 'none';
        document.getElementById('login-step-crear').style.display = 'none';
        document.getElementById('login-step-update-password').style.display = 'block';
        
        mostrarNotificacion('Sesión verificada. Ya puedes cambiar tu contraseña.', 'success');
      }
    });
  }
});

function abrirRecuperarPassword(e) {
  e.preventDefault();
  document.getElementById('login-step-form').style.display = 'none';
  document.getElementById('login-step-recovery').style.display = 'block';
  document.getElementById('recovery-email').value = document.getElementById('login-email').value || '';
}

function volverLoginDesdeRecovery() {
  document.getElementById('login-step-recovery').style.display = 'none';
  document.getElementById('login-step-form').style.display = 'block';
  document.getElementById('recovery-error').textContent = '';
}

async function enviarRecoveryLink(e) {
  e.preventDefault();
  const errEl = document.getElementById('recovery-error');
  const email = document.getElementById('recovery-email').value.trim();
  
  if (!email) return;
  
  errEl.textContent = 'Enviando enlace...';
  errEl.style.color = 'var(--text-secondary)';
  
  try {
    const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    
    if (error) {
      errEl.textContent = 'Error: ' + error.message;
      errEl.style.color = 'var(--red)';
    } else {
      errEl.textContent = '¡Enlace enviado! Revisa tu bandeja de entrada o spam. Ya puedes cerrar esta ventana.';
      errEl.style.color = 'var(--success)';
    }
  } catch (error) {
    errEl.textContent = 'Error de red. Intenta de nuevo.';
    errEl.style.color = 'var(--red)';
  }
}

async function guardarNuevaPassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('update-pass-error');
  const newPass = document.getElementById('new-password').value;
  
  if (newPass.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.style.color = 'var(--red)';
    return;
  }
  
  errEl.textContent = 'Actualizando contraseña...';
  errEl.style.color = 'var(--text-secondary)';
  
  try {
    const { data, error } = await window.supabaseClient.auth.updateUser({
      password: newPass
    });
    
    if (error) {
      errEl.textContent = 'Error al actualizar: ' + error.message;
      errEl.style.color = 'var(--red)';
    } else {
      mostrarNotificacion('¡Contraseña actualizada exitosamente!', 'success');
      document.getElementById('login-step-update-password').style.display = 'none';
      document.getElementById('login-step-form').style.display = 'block';
      document.getElementById('login-password').value = '';
    }
  } catch (error) {
    errEl.textContent = 'Error de red. Intenta de nuevo.';
    errEl.style.color = 'var(--red)';
  }
}
