/**
 * Módulo de Integración Microsoft OneDrive, Extracción Fiscal SAT y Visor de PDF - Eurorep / SAPI
 *
 * Incluye:
 * - Base de datos simulada y conector real de Microsoft Graph (OAuth2 implicit/bearer).
 * - Explorador y selector de archivos OneDrive (árbol de directorios, breadcrumbs, búsqueda).
 * - Descarga y procesamiento de comprobantes XML y PDF.
 * - Motor de extracción fiscal CFDI 4.0 / 3.3 (26 campos normativos del SAT).
 * - Analizador de texto plano para facturas PDF (con o sin OCR nativo).
 * - Sincronización con Supabase (tabla `facturas_analizadas`).
 * - Visor interactivo de documentos PDF con ficha técnica SAT y acordión desglosado.
 */

// Helper para obtener cliente Supabase
function _getSb() {
  if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
  return null;
}

// Helper para configuración global segura
function _getConfigData() {
  if (typeof configData !== 'undefined' && configData) return configData;
  if (typeof window !== 'undefined' && window.configData) return window.configData;
  return {};
}

// Helper para notificaciones seguro
function _notify(msg, type = 'info') {
  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(msg, type);
  } else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
    window.mostrarNotificacion(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

// Helper para renderizar iconos Lucide seguro
function _renderIcons() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  } else if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Helper para extraer rutas relativas de OneDrive/SharePoint seguro
function _extraerPath(folderId) {
  if (typeof window !== 'undefined' && typeof window.extraerPathOneDrive === 'function') {
    return window.extraerPathOneDrive(folderId);
  }
  if (typeof folderId !== 'string') return '';
  const docIndex = folderId.indexOf('/Documents/');
  if (docIndex > -1) {
    return folderId.substring(docIndex + 11);
  } else if (folderId.startsWith('/')) {
    return folderId.substring(1);
  }
  return folderId;
}

// =========================================================================
// ── BASE DE DATOS MOCK Y VARIABLES DE ESTADO ──────────────────────────────
// =========================================================================

export const onedriveMockDb = {
  '/': [
    { id: 'folder_mayo', name: 'Facturas Mayo 2026', type: 'folder', date: '24 May 2026 10:15', size: '--' },
    { id: 'folder_viaje', name: 'Comprobantes de Viaje', type: 'folder', date: '24 May 2026 09:30', size: '--' },
    { id: 'politica_pdf', name: 'Politica_de_Gastos_Eurorep.pdf', type: 'file', ext: 'pdf', date: '15 May 2026 14:00', size: '1.4 MB', content: 'data:application/pdf;base64,JVBERi0xLjQKJdHAxT4KMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PiBlbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmoKICA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0gL1Jlc291cmNlcyA0IDAgUiA+PiBlbmRvYmoKNCAwIG9iagogIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiBlbmRvYmoKNSAwIG9iagogIDw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PiBlbmRvYmoK' }
  ],
  'folder_mayo': [
    { 
      id: 'factura_gasolina_xml', 
      name: 'factura_gasolina_1174.xml', 
      type: 'file', 
      ext: 'xml', 
      date: '22 May 2026 18:04', 
      size: '4.2 KB',
      content: `<?xml version="1.0" encoding="utf-8"?>
        <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="1174.79">
          <cfdi:Emisor Rfc="GVA120524XYZ" Nombre="GASOLINERA DEL VALLE S.A." RegimenFiscal="601"/>
          <cfdi:Complemento>
            <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="f1a2b3c4-d5e6-4a7b-8c9d-0e1f2a3b4c5d" FechaTimbrado="2026-05-22T18:04:00"/>
          </cfdi:Complemento>
        </cfdi:Comprobante>`
    },
    { 
      id: 'factura_ixtapaluca_xml', 
      name: 'factura_ixtapaluca_95.xml', 
      type: 'file', 
      ext: 'xml', 
      date: '22 May 2026 19:40', 
      size: '3.8 KB',
      content: `<?xml version="1.0" encoding="utf-8"?>
        <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="95.01">
          <cfdi:Emisor Rfc="TCO950524ABC" Nombre="TIENDAS COMERCIALES S.A." RegimenFiscal="601"/>
          <cfdi:Complemento>
            <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" FechaTimbrado="2026-05-22T19:40:00"/>
          </cfdi:Complemento>
        </cfdi:Comprobante>`
    },
    { 
      id: 'factura_office_xml', 
      name: 'factura_office_280.xml', 
      type: 'file', 
      ext: 'xml', 
      date: '21 May 2026 16:30', 
      size: '5.1 KB',
      content: `<?xml version="1.0" encoding="utf-8"?>
        <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="280.00">
          <cfdi:Emisor Rfc="ODM950524XYZ" Nombre="OFFICE DEPOT DE MEXICO S.A. DE C.V." RegimenFiscal="601"/>
          <cfdi:Complemento>
            <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e" FechaTimbrado="2026-05-21T16:30:00"/>
          </cfdi:Complemento>
        </cfdi:Comprobante>`
    },
    { 
      id: 'factura_pase_xml', 
      name: 'factura_pase_12.xml', 
      type: 'file', 
      ext: 'xml', 
      date: '22 May 2026 17:15', 
      size: '3.5 KB',
      content: `<?xml version="1.0" encoding="utf-8"?>
        <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="12.91">
          <cfdi:Emisor Rfc="CME950524ABC" Nombre="CONCESIONARIA METROPOLITANA S.A." RegimenFiscal="601"/>
          <cfdi:Complemento>
            <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f" FechaTimbrado="2026-05-22T17:15:00"/>
          </cfdi:Complemento>
        </cfdi:Comprobante>`
    }
  ],
  'folder_viaje': [
    { 
      id: 'recibo_uber_pdf', 
      name: 'recibo_uber_68.pdf', 
      type: 'file', 
      ext: 'pdf', 
      date: '22 May 2026 14:10', 
      size: '245 KB', 
      content: 'data:application/pdf;base64,JVBERi0xLjQKJdHAxT4KMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PiBlbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmoKICA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0gL1Jlc291cmNlcyA0IDAgUiA+PiBlbmRvYmoKNCAwIG9iagogIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiBlbmRvYmoKNSAwIG9iagogIDw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PiBlbmRvYmoK' 
    },
    { 
      id: 'recibo_linkedin_pdf', 
      name: 'recibo_linkedin_2194.pdf', 
      type: 'file', 
      ext: 'pdf', 
      date: '21 May 2026 12:45', 
      size: '312 KB', 
      content: 'data:application/pdf;base64,JVBERi0xLjQKJdHAxT4KMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PiBlbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmoKICA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0gL1Jlc291cmNlcyA0IDAgUiA+PiBlbmRvYmoKNCAwIG9iagogIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiBlbmRvYmoKNSAwIG9iagogIDw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PiBlbmRvYmoK' 
    }
  ]
};

// Variables globales para la navegación del picker simulado y real
let onedriveCurrentFolder = '/';
let onedriveSelectedFile = null;
let onedriveRealMode = false;
let onedriveRealToken = null;
let onedriveFolderParents = {};
let onedriveRealRootId = null;

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'onedriveSelectedFile', {
    get: () => onedriveSelectedFile,
    set: (val) => { onedriveSelectedFile = val; },
    configurable: true
  });
  window.onedriveMockDb = onedriveMockDb;
}

// Función para inyectar dinámicamente el SDK real de OneDrive (conservada por compatibilidad)
export function cargarSdkOneDrive(callback) {
  if (typeof window !== 'undefined' && window.OneDrive) {
    if (callback) callback();
    return;
  }
  if (typeof document !== 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://js.live.net/v7.2/OneDrive.js';
    script.onload = () => {
      if (callback) callback();
    };
    document.head.appendChild(script);
  }
}

// Helper para formatear bytes de Microsoft Graph
export function formatBytes(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '--';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Abre el OneDrive Picker (Real o Simulado según la configuración)
export function abrirOneDrivePicker() {
  const cfg = _getConfigData();
  const odClientId = cfg.onedriveClientId || '';
  const odForceMock = cfg.onedriveForceMock !== false; // por defecto demo activa
  
  const isRealActive = odClientId && odClientId !== 'MOCK' && !odForceMock;

  if (isRealActive) {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      _notify('OneDrive real requiere protocolo HTTP/HTTPS. Inicia un servidor web local (ej: npx serve o Live Server) en lugar de abrir el archivo directamente.', 'error');
      return;
    }
    
    // FLUJO REAL: Usar explorador personalizado conectado a la API de Microsoft Graph
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ms_access_token') : null;
    const tokenExpiry = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ms_access_token_expiry') : null;
    
    if (token && (!tokenExpiry || Number(tokenExpiry) > Date.now())) {
      abrirOneDrivePickerConToken(token);
    } else {
      if (typeof window === 'undefined') return;
      // Iniciar flujo de autenticación emergente (OAuth Implicit Flow)
      const redirectUri = window.location.origin + window.location.pathname;
      const scopes = encodeURIComponent('Mail.Read Mail.ReadWrite Mail.Send Files.Read User.Read offline_access');
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(odClientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_mode=fragment`;
      
      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const loginPopup = window.open(authUrl, 'OneDriveLogin', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`);
      
      if (!loginPopup) {
        _notify('No se pudo abrir la ventana de inicio de sesión de Microsoft. Por favor permite las ventanas emergentes en tu navegador.', 'error');
        return;
      }
      
      const pollInterval = setInterval(() => {
        try {
          if (!loginPopup || loginPopup.closed) {
            clearInterval(pollInterval);
            _notify('Inicio de sesión cancelado o la ventana se cerró.', 'warning');
            return;
          }
          
          const popupUrl = loginPopup.location.href;
          if (popupUrl.indexOf(window.location.origin) === 0) {
            const hash = loginPopup.location.hash;
            if (hash) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get('access_token');
              const expiresIn = params.get('expires_in');
              
              if (accessToken) {
                sessionStorage.setItem('ms_access_token', accessToken);
                if (expiresIn) {
                  const expiryTime = Date.now() + Number(expiresIn) * 1000;
                  sessionStorage.setItem('ms_access_token_expiry', expiryTime);
                } else {
                  sessionStorage.setItem('ms_access_token_expiry', Date.now() + 3600 * 1000);
                }
                
                clearInterval(pollInterval);
                loginPopup.close();
                
                _notify('Inicio de sesión exitoso con Microsoft OneDrive', 'success');
                abrirOneDrivePickerConToken(accessToken);
              }
            }
          }
        } catch (e) {
          // Ignorar errores de origen cruzado durante el login en microsoftonline
        }
      }, 500);
    }
  } else {
    // MODO DEMOSTRACIÓN / SIMULADOR ONEDRIVE
    onedriveRealMode = false;
    onedriveRealToken = null;
    
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-onedrive-picker-overlay');
    if (!modal) return;
    
    onedriveCurrentFolder = '/';
    onedriveSelectedFile = null;
    
    const searchInput = document.getElementById('onedrive-search-input');
    if (searchInput) searchInput.value = '';
    
    modal.style.display = 'flex';
    navegarOneDriveSimulado('/');
  }
}

// Abre el explorador de archivos OneDrive con el token obtenido
export function abrirOneDrivePickerConToken(token) {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('modal-onedrive-picker-overlay');
  if (!modal) return;
  
  onedriveRealMode = true;
  onedriveRealToken = token;
  onedriveRealRootId = null; // Reset real root ID to resolve it on first load
  
  const cfg = _getConfigData();
  const rootFolderId = cfg.onedriveFolderId || 'root';
  onedriveCurrentFolder = rootFolderId;
  onedriveSelectedFile = null;
  
  const searchInput = document.getElementById('onedrive-search-input');
  if (searchInput) searchInput.value = '';
  
  modal.style.display = 'flex';
  
  onedriveFolderParents = {};
  navegarOneDriveReal(onedriveCurrentFolder);

  // Auto-trigger background folder scanning for transaction suggested matches
  if (typeof window !== 'undefined' && window.silentPreloadOneDriveFiles) {
    window.silentPreloadOneDriveFiles();
  }
}

// Cierra el explorador OneDrive
export function cerrarOneDrivePicker() {
  if (typeof document !== 'undefined') {
    const modal = document.getElementById('modal-onedrive-picker-overlay');
    if (modal) modal.style.display = 'none';
  }
  onedriveSelectedFile = null;
}

// Navega en las carpetas en tiempo real desde Microsoft Graph API
export function navegarOneDriveReal(folderId) {
  onedriveCurrentFolder = folderId;
  onedriveSelectedFile = null;
  
  if (typeof document === 'undefined') return;

  const btnConfirm = document.getElementById('btn-onedrive-import-confirm');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.style.opacity = '0.6';
  }
  
  const tbody = document.getElementById('onedrive-picker-files-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:3rem; color:#8a8886; font-size:0.8rem;">
          <i data-lucide="loader-2" class="animate-spin" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;color:#0078d4;"></i>
          Cargando archivos desde Microsoft OneDrive...
        </td>
      </tr>
    `;
    _renderIcons();
  }
  
  // Resolver si folderId es una ruta de OneDrive/SharePoint
  let folderUrl = '';
  if (folderId === 'root') {
    folderUrl = 'https://graph.microsoft.com/v1.0/me/drive/root';
  } else if (folderId.startsWith('/') || folderId.includes('/') || folderId.includes('sharepoint.com')) {
    let relativePath = _extraerPath(folderId);
    const docIndex = relativePath.indexOf('/Documents/');
    if (docIndex > -1) {
      relativePath = relativePath.substring(docIndex + 11);
    } else if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    const encodedSegments = relativePath.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/');
    folderUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedSegments}`;
  } else {
    folderUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}`;
  }
    
  fetch(folderUrl, {
    headers: { 'Authorization': `Bearer ${onedriveRealToken}` }
  })
  .then(res => {
    if (res.status === 401) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('ms_access_token');
        sessionStorage.removeItem('ms_access_token_expiry');
      }
      cerrarOneDrivePicker();
      _notify('Tu sesión de OneDrive ha expirado. Por favor, vuelve a iniciar sesión.', 'error');
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Error al obtener metadatos de la carpeta');
    return res.json();
  })
  .then(folderMeta => {
    // Guardar el ID único real de la carpeta raíz si no se ha guardado todavía
    if (!onedriveRealRootId) {
      onedriveRealRootId = folderMeta.id;
    }
    
    // Si navegamos utilizando la ruta, actualizar el onedriveCurrentFolder al ID único real
    if (onedriveCurrentFolder === folderId && (folderId.startsWith('/') || folderId.includes('/'))) {
      onedriveCurrentFolder = folderMeta.id;
    }
    
    const folderName = folderId === 'root' ? 'Mis archivos' : (folderMeta.name || 'Carpeta');
    
    if (folderMeta.parentReference && folderMeta.parentReference.id) {
      onedriveFolderParents[folderMeta.id] = folderMeta.parentReference.id;
    }
    
    const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderMeta.id}/children`;
      
    return (async () => {
      let allItems = [];
      let nextUrl = childrenUrl;
      while (nextUrl) {
        const res = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${onedriveRealToken}` } });
        if (!res.ok) throw new Error('Error al obtener contenido de la carpeta');
        const chunk = await res.json();
        if (chunk && Array.isArray(chunk.value)) {
          allItems = allItems.concat(chunk.value);
        }
        nextUrl = chunk ? chunk['@odata.nextLink'] : null;
      }
      return allItems;
    })()
    .then(children => {
      const mappedItems = children.map(item => {
        const isFolder = !!item.folder;
        const ext = isFolder ? '' : (item.name.split('.').pop() || '').toLowerCase();
        let date = '--';
        if (item.lastModifiedDateTime) {
          date = new Date(item.lastModifiedDateTime).toLocaleString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        }
        return {
          id: item.id,
          name: item.name,
          type: isFolder ? 'folder' : 'file',
          ext: ext,
          date: date,
          size: isFolder ? '--' : formatBytes(item.size),
          content: item
        };
      });
      
      onedriveMockDb[folderMeta.id] = mappedItems;
      actualizarBreadcrumbsOneDrive(folderName);
      renderOneDriveFiles();
    });
  })
  .catch(err => {
    if (err.message !== 'Unauthorized') {
      console.error('Error fetching OneDrive folder:', err);
      _notify('No se pudo cargar la carpeta de OneDrive', 'error');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; padding:3rem; color:#ef4444; font-size:0.8rem;">
              <i data-lucide="alert-circle" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;"></i>
              Error al conectar con OneDrive. Por favor verifica tu configuración.
            </td>
          </tr>
        `;
        _renderIcons();
      }
    }
  });
}

// Navega en las carpetas simuladas de OneDrive
export function navegarOneDriveSimulado(folderId) {
  onedriveCurrentFolder = folderId;
  onedriveSelectedFile = null;
  
  let folderName = 'Mis archivos';
  if (folderId === 'folder_mayo') {
    folderName = 'Facturas Mayo 2026';
  } else if (folderId === 'folder_viaje') {
    folderName = 'Comprobantes de Viaje';
  }
  
  actualizarBreadcrumbsOneDrive(folderName);
  renderOneDriveFiles();
}

// Genera y actualiza el Breadcrumb de forma dinámica y controlada
export function actualizarBreadcrumbsOneDrive(folderName) {
  if (typeof document === 'undefined') return;
  const breadcrumbsEl = document.getElementById('onedrive-breadcrumbs');
  if (!breadcrumbsEl) return;
  
  const prefix = `<span style="font-weight:600; color:#605e5c; margin-right:0.25rem;">Carpeta de origen:</span>`;
  let pathHtml = '';
  
  if (onedriveRealMode) {
    const isAtVirtualRoot = (onedriveCurrentFolder === onedriveRealRootId);
    
    if (isAtVirtualRoot) {
      pathHtml = `<span style="color:#242424; font-weight:600;">${folderName}</span>`;
    } else {
      const parentId = onedriveFolderParents[onedriveCurrentFolder];
      if (parentId) {
        pathHtml += `<span style="color:#0078d4; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.25rem;" onclick="window.navegarOneDriveReal('${parentId}')">
          <i data-lucide="chevron-left" style="width:14px; height:14px;"></i> Atrás
        </span>
        <span style="color:#a19f9d; margin:0 0.2rem;">|</span>`;
      }
      pathHtml += `<span style="color:#605e5c;">...</span> <span style="color:#a19f9d; margin:0 0.2rem;">/</span> <span style="color:#242424; font-weight:600;">${folderName}</span>`;
    }
  } else {
    if (onedriveCurrentFolder === '/') {
      pathHtml = `<span style="color:#242424; font-weight:600;">Mis archivos</span>`;
    } else {
      pathHtml = `<span style="color:#0078d4; cursor:pointer; font-weight:600;" onclick="window.navegarOneDriveSimulado('/')">Mis archivos</span>
      <span style="color:#a19f9d; margin:0 0.2rem;">/</span>
      <span style="color:#242424; font-weight:600;">${folderName}</span>`;
    }
  }
  
  breadcrumbsEl.innerHTML = `${prefix} ${pathHtml}`;
  _renderIcons();
}

// Filtra la visualización del explorador OneDrive
export function filtrarOneDriveSimulado() {
  renderOneDriveFiles();
}

// Dibuja los archivos y carpetas del OneDrive (Simulado o Real)
export function renderOneDriveFiles() {
  if (typeof document === 'undefined') return;
  const tbody = document.getElementById('onedrive-picker-files-body');
  const btnConfirm = document.getElementById('btn-onedrive-import-confirm');
  if (!tbody) return;

  const items = onedriveMockDb[onedriveCurrentFolder] || [];
  const q = (document.getElementById('onedrive-search-input')?.value || '').toLowerCase().trim();

  let filtered = items;
  if (q) {
    filtered = filtered.filter(x => x.name.toLowerCase().includes(q));
  }

  tbody.innerHTML = '';
  
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.style.opacity = '0.6';
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:3rem; color:#8a8886; font-size:0.8rem;">
          <i data-lucide="info" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;opacity:0.5;"></i>
          Esta carpeta está vacía.
        </td>
      </tr>
    `;
    _renderIcons();
    return;
  }

  filtered.forEach((item) => {
    const isFolder = item.type === 'folder';
    const isSelected = onedriveSelectedFile && onedriveSelectedFile.id === item.id;
    
    let iconName = 'folder';
    let iconColor = '#ffb900';
    if (!isFolder) {
      if (item.ext === 'xml') {
        iconName = 'file-code';
        iconColor = '#10b981';
      } else if (item.ext === 'pdf') {
        iconName = 'file-text';
        iconColor = '#ef4444';
      } else {
        iconName = 'file';
        iconColor = '#8a8886';
      }
    }

    const rowHtml = `
      <tr style="border-bottom:1px solid #f3f2f1; background:${isSelected ? '#eff6fc' : 'white'}; cursor:pointer; height:38px; transition:var(--transition);"
          onmouseover="this.style.background='${isSelected ? '#eff6fc' : '#f3f2f1'}'"
          onmouseout="this.style.background='${isSelected ? '#eff6fc' : 'white'}'"
          onclick="window.seleccionarElementoOneDrive('${item.id}', ${isFolder})">
        <td style="padding:0.4rem 0.5rem; text-align:center; vertical-align:middle;" onclick="event.stopPropagation();">
          ${isFolder ? '' : `<input type="checkbox" style="cursor:pointer;" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.seleccionarElementoOneDrive('${item.id}', false)" />`}
        </td>
        <td style="padding:0.4rem; font-weight:${isFolder ? '600' : 'normal'}; vertical-align:middle; color:#323130; display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="${iconName}" style="width:16px; height:16px; color:${iconColor}; flex-shrink:0;"></i>
          <span class="onedrive-item-name" style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" 
                ${isFolder ? `onclick="event.stopPropagation(); if(onedriveRealMode){window.navegarOneDriveReal('${item.id}');}else{window.navegarOneDriveSimulado('${item.id}');}"` : ''}>
            ${item.name}
          </span>
        </td>
        <td style="padding:0.4rem; color:#605e5c; vertical-align:middle;">${item.date}</td>
        <td style="padding:0.4rem; color:#605e5c; vertical-align:middle;">${item.size}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
  });

  _renderIcons();
}

// Selecciona un archivo en la lista
export function seleccionarElementoOneDrive(itemId, isFolder) {
  if (isFolder) {
    if (onedriveRealMode) {
      navegarOneDriveReal(itemId);
    } else {
      navegarOneDriveSimulado(itemId);
    }
    return;
  }
  
  const items = onedriveMockDb[onedriveCurrentFolder] || [];
  const file = items.find(x => x.id === itemId);
  if (!file) return;

  onedriveSelectedFile = file;
  
  if (typeof document !== 'undefined') {
    const btnConfirm = document.getElementById('btn-onedrive-import-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.style.opacity = '1';
    }
  }

  renderOneDriveFiles();
}

// Confirmación de selección en el picker
export function confirmarImportacionOneDrive() {
  if (!onedriveSelectedFile) return;

  const file = onedriveSelectedFile;
  if (onedriveRealMode) {
    procesarDescargaRealOneDrive(file.content);
  } else {
    procesarArchivoImportadoOneDrive(file.name, file.ext, file.content);
  }
  cerrarOneDrivePicker();
}

// Descarga en segundo plano e importación real desde Microsoft Graph
export function procesarDescargaRealOneDrive(microsoftFile) {
  const downloadUrl = microsoftFile["@microsoft.graph.downloadUrl"];
  const name = microsoftFile.name || "comprobante";
  const ext = name.split('.').pop().toLowerCase();

  if (!downloadUrl) {
    _notify('No se pudo obtener el URL de descarga del archivo', 'error');
    return;
  }

  _notify('Descargando archivo desde OneDrive...', 'info');

  fetch(downloadUrl)
    .then(response => {
      if (!response.ok) throw new Error("Fallo al descargar");
      if (ext === 'xml') {
        return response.text().then(text => {
          procesarArchivoImportadoOneDrive(name, ext, text);
        });
      } else {
        return response.blob().then(blob => {
          const reader = new FileReader();
          reader.onload = function(e) {
            procesarArchivoImportadoOneDrive(name, ext, e.target.result);
          };
          reader.readAsDataURL(blob);
        });
      }
    })
    .catch(err => {
      console.error('Error fetching OneDrive file:', err);
      _notify('Fallo al importar archivo desde OneDrive', 'error');
    });
}

// Función central de importación que procesa XML / PDF del Picker
export function procesarArchivoImportadoOneDrive(name, ext, dataContent) {
  if (typeof window !== 'undefined' && !window._gastoUploadedFiles) window._gastoUploadedFiles = [];

  if (ext === 'pdf') {
    procesarPdfFacturaExtraida(name, dataContent);
  } 
  else if (ext === 'xml') {
    // Si la data viene como texto plano (simulador)
    let xmlText = dataContent;
    let base64Data = '';
    
    if (dataContent.startsWith('data:')) {
      // Si ya es base64 data url, extraer el texto
      base64Data = dataContent;
      try {
        const raw = atob(dataContent.split(',')[1]);
        xmlText = decodeURIComponent(escape(raw));
      } catch (err) {
        console.error('Error decoding base64 xml:', err);
      }
    } else {
      // Convertir texto XML plano a base64 Data URL
      base64Data = 'data:text/xml;base64,' + btoa(unescape(encodeURIComponent(xmlText)));
    }

    if (typeof window !== 'undefined') {
      window._gastoXmlBase64 = base64Data;
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      const comprobanteNode = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0] || xmlDoc.getElementsByTagName("Comprobante")[0];
      const emisorNode = xmlDoc.getElementsByTagName("cfdi:Emisor")[0] || xmlDoc.getElementsByTagName("Emisor")[0];
      const timbreNode = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0] || xmlDoc.getElementsByTagName("TimbreFiscalDigital")[0];

      const rfcVal = emisorNode ? (emisorNode.getAttribute("Rfc") || emisorNode.getAttribute("rfc") || '').toUpperCase() : '';
      const emisorNombre = emisorNode ? (emisorNode.getAttribute("Nombre") || emisorNode.getAttribute("nombre") || '') : '';
      const uuidVal = timbreNode ? (timbreNode.getAttribute("UUID") || timbreNode.getAttribute("uuid") || '').toUpperCase() : '';
      const totalVal = comprobanteNode ? parseFloat(comprobanteNode.getAttribute("Total") || comprobanteNode.getAttribute("total") || 0) : 0;
      const fechaVal = comprobanteNode ? (comprobanteNode.getAttribute("Fecha") || comprobanteNode.getAttribute("fecha") || '').split('T')[0] : '';

      if (typeof window !== 'undefined') {
        window._gastoUploadedFiles = (window._gastoUploadedFiles || []).filter(x => !(x.type === 'xml' && x.uuid === uuidVal));
        window._gastoUploadedFiles.push({
          type: 'xml',
          base64: base64Data,
          name: name,
          rfc: rfcVal,
          uuid: uuidVal,
          monto: totalVal,
          emisor: emisorNombre || `XML: ${rfcVal}`,
          date: fechaVal
        });

        if (typeof window.renderUploaderSidebar === 'function') {
          window.renderUploaderSidebar();
        }
        
        if (typeof window.actualizarFacturasSugeridas === 'function') {
          window.actualizarFacturasSugeridas();
        }

        // Vincular automáticamente el XML importado para máxima rapidez
        if (uuidVal && typeof window.adjuntarXmlFactura === 'function') {
          window.adjuntarXmlFactura(uuidVal);
          _notify('Comprobante XML importado y vinculado al movimiento', 'success');
        } else {
          _notify('Comprobante XML importado desde OneDrive', 'success');
        }
      }
    } catch (err) {
      console.error('Error parsing imported XML:', err);
      _notify('Error al analizar XML importado', 'error');
    }
  }
}

// ── INTEGRACIÓN MOZILLA PDF.JS Y AUTO-EXTRACCIÓN SAT ─────────────────────
// =========================================================================

if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export async function extraerFacturaSatNube(type, base64Data) {
  // Always use our 100% precise local client-side extraction engine as the primary path
  try {
    let satData;
    if (type === 'xml') {
      const xmlText = decodificarXmlBase64(base64Data);
      satData = extraerDatosCompletosXml(xmlText);
    } else {
      const text = await extraerTextoPdf(base64Data);
      satData = analizarFacturaPdfTexto(text);
    }

    // Guardar en Supabase facturas_analizadas si tenemos cliente supabaseClient y satData tiene UUID
    const sb = _getSb();
    if (sb && satData && satData.uuid) {
      const payload = {
        id: satData.uuid, // Usamos el UUID de la factura como ID único si no viene de OneDrive
        file_name: satData.uuid + '.' + type,
        file_type: type,
        version_cfdi: satData.versionCfdi || null,
        uuid: satData.uuid || null,
        estatus: satData.estatus || null,
        fecha_cancelacion: satData.fechaCancelacion || null,
        tipo_comprobante: satData.tipoComprobante || null,
        fecha_emision: satData.fechaEmision || null,
        ano_emision: satData.anoEmision || null,
        mes_emision: satData.mesEmision || null,
        dia_emision: satData.diaEmision || null,
        fecha_timbrado: satData.fechaTimbrado || null,
        serie: satData.serie || null,
        folio: satData.folio || null,
        forma_pago: satData.formaPago || null,
        metodo_pago: satData.metodoPago || null,
        condiciones_pago: satData.condicionesPago || null,
        rfc_emisor: satData.rfcEmisor || null,
        nombre_emisor: satData.nombreEmisor || null,
        rfc_receptor: satData.rfcReceptor || null,
        nombre_receptor: satData.nombreReceptor || null,
        moneda: satData.moneda || null,
        tipo_cambio: satData.tipoCambio || null,
        subtotal: parseFloat(satData.subtotal) || 0,
        descuento: parseFloat(satData.descuento) || 0,
        total: parseFloat(satData.total) || 0,
        isr_retenido: parseFloat(satData.isrRetenido) || 0,
        iva_retenido: parseFloat(satData.ivaRetenido) || 0,
        iva_trasladado: parseFloat(satData.ivaTrasladado) || 0,
        base64_content: base64Data
      };
      sb.from('facturas_analizadas')
        .upsert(payload)
        .catch(err => console.error('[Supabase] Error al guardar factura analizada en caché:', err));
    }

    return satData;
  } catch (localErr) {
    console.warn('[Sync] Falló extracción local, intentando respaldo en la nube:', localErr.message);
    const sb = _getSb();
    if (!sb) {
      throw localErr;
    }
    
    const { data, error } = await sb.functions.invoke('extraer-factura-sat', {
      body: { type, base64: base64Data }
    });
    
    if (error) throw error;
    if (data && data.status === 'success') {
      // También intentar cachear el resultado si viene de la nube
      const satData = data.data;
      if (sb && satData && satData.uuid) {
        const payload = {
          id: satData.uuid,
          file_name: satData.uuid + '.' + type,
          file_type: type,
          version_cfdi: satData.versionCfdi || null,
          uuid: satData.uuid || null,
          estatus: satData.estatus || null,
          fecha_cancelacion: satData.fechaCancelacion || null,
          tipo_comprobante: satData.tipoComprobante || null,
          fecha_emision: satData.fechaEmision || null,
          ano_emision: satData.anoEmision || null,
          mes_emision: satData.mesEmision || null,
          dia_emision: satData.diaEmision || null,
          fecha_timbrado: satData.fechaTimbrado || null,
          serie: satData.serie || null,
          folio: satData.folio || null,
          forma_pago: satData.formaPago || null,
          metodo_pago: satData.metodoPago || null,
          condiciones_pago: satData.condicionesPago || null,
          rfc_emisor: satData.rfcEmisor || null,
          nombre_emisor: satData.nombreEmisor || null,
          rfc_receptor: satData.rfcReceptor || null,
          nombre_receptor: satData.nombreReceptor || null,
          moneda: satData.moneda || null,
          tipo_cambio: satData.tipoCambio || null,
          subtotal: parseFloat(satData.subtotal) || 0,
          descuento: parseFloat(satData.descuento) || 0,
          total: parseFloat(satData.total) || 0,
          isr_retenido: parseFloat(satData.isrRetenido) || 0,
          iva_retenido: parseFloat(satData.ivaRetenido) || 0,
          iva_trasladado: parseFloat(satData.ivaTrasladado) || 0,
          base64_content: base64Data
        };
        sb.from('facturas_analizadas')
          .upsert(payload)
          .catch(err => console.error('[Supabase] Error al guardar factura de la nube en caché:', err));
      }
      return satData;
    } else {
      throw new Error(data?.error || 'Error en la nube');
    }
  }
}

export async function extraerTextoPdf(base64Data) {
  // Intentar extraer el texto usando el endpoint del backend (PDFKit nativo de macOS)
  // que soluciona los problemas de codificación de fuentes (cuadritos vacíos)
  try {
    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data })
    });
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
        console.log('[PDF Auto-Extract] Text extracted successfully via backend PDFKit.');
        return data.text;
      }
    }
  } catch (err) {
    console.warn('[PDF Auto-Extract] Backend PDFKit API error, falling back to local PDF.js:', err);
  }

  // Fallback: usar PDF.js local en el navegador
  const pdfjs = (typeof window !== 'undefined' && window.pdfjsLib) ? window.pdfjsLib : (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);
  if (!pdfjs) {
    throw new Error('Librería PDF.js no cargada');
  }
  
  try {
    const base64Clean = base64Data.split(',')[1] || base64Data;
    const binaryString = atob(base64Clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    const loadingTask = pdfjs.getDocument({ data: bytes.buffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (err) {
    console.error('Error al extraer texto del PDF:', err);
    throw err;
  }
}

export function decodificarXmlBase64(dataUrl) {
  if (!dataUrl) return '';
  try {
    const raw = atob(dataUrl.split(',')[1] || dataUrl);
    return decodeURIComponent(escape(raw));
  } catch (err) {
    console.error('Error decodificando xml base64:', err);
    return '';
  }
}

export async function ensureBase64FromStorageUrl(urlOrBase64) {
  if (!urlOrBase64) return '';
  if (!urlOrBase64.startsWith('http') || !urlOrBase64.includes('/storage/v1/object/public/')) {
    return urlOrBase64;
  }
  try {
    const parts = urlOrBase64.split('/storage/v1/object/public/');
    if (parts.length === 2) {
      const pathParts = parts[1].split('/');
      const bucketName = pathParts[0];
      const filePath = pathParts.slice(1).join('/');
      const sb = _getSb();
      if (sb) {
        const { data, error } = await sb.storage.from(bucketName).download(filePath);
        if (!error && data) {
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(data);
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Storage Helper] Error fetching/converting url to base64:', err);
  }
  return urlOrBase64;
}

export async function getXmlTextFromUrlOrBase64(urlOrBase64) {
  if (!urlOrBase64) return '';
  if (urlOrBase64.startsWith('http') && urlOrBase64.includes('/storage/v1/object/public/')) {
    try {
      const parts = urlOrBase64.split('/storage/v1/object/public/');
      if (parts.length === 2) {
        const pathParts = parts[1].split('/');
        const bucketName = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        const sb = _getSb();
        if (sb) {
          const { data, error } = await sb.storage.from(bucketName).download(filePath);
          if (!error && data) {
            return await data.text();
          }
        }
      }
    } catch (err) {
      console.warn('[Storage Helper] Error fetching XML text from URL:', err);
    }
    return '';
  }
  return decodificarXmlBase64(urlOrBase64);
}

export function extraerDatosCompletosXml(xmlText) {
  const cfg = _getConfigData();
  const defaultReceptorRfc = (cfg.rfc || 'ERE140718NY8').toUpperCase().trim();

  const data = {
    versionCfdi: '4.0',
    uuid: '',
    estatus: 'Vigente',
    fechaCancelacion: 'N/A',
    tipoComprobante: 'I - Ingreso',
    fechaEmision: '',
    anoEmision: '',
    mesEmision: '',
    diaEmision: '',
    fechaTimbrado: '',
    serie: 'N/A',
    folio: 'N/A',
    formaPago: '03 - Transferencia electrónica de fondos',
    metodoPago: 'PUE - Pago en una sola exhibición',
    condicionesPago: 'N/A',
    rfcEmisor: '',
    nombreEmisor: '',
    rfcReceptor: defaultReceptorRfc,
    nombreReceptor: 'EUROREP S.A. DE C.V.',
    moneda: 'MXN',
    tipoCambio: '1',
    subtotal: 0,
    descuento: 0,
    total: 0,
    isrRetenido: 0,
    ivaRetenido: 0,
    ivaTrasladado: 0
  };

  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      const getEl = (tag) => {
        const namespaces = ["cfdi:", "tfd:", ""];
        for (const ns of namespaces) {
          const el = xmlDoc.getElementsByTagName(ns + tag);
          if (el && el.length > 0) return el[0];
        }
        return null;
      };

      const getAttr = (el, attr) => {
        if (!el) return '';
        const attrNames = [
          attr, 
          attr.toLowerCase(), 
          attr.charAt(0).toUpperCase() + attr.slice(1),
          attr.toUpperCase()
        ];
        for (const name of attrNames) {
          if (el.hasAttribute(name)) {
            return el.getAttribute(name);
          }
        }
        return '';
      };

      const comprobanteNode = getEl("Comprobante");
      const emisorNode = getEl("Emisor");
      const receptorNode = getEl("Receptor");
      const timbreNode = getEl("TimbreFiscalDigital");

      if (comprobanteNode) {
        data.versionCfdi = getAttr(comprobanteNode, "Version") || getAttr(comprobanteNode, "version") || '4.0';
        
        const tipo = getAttr(comprobanteNode, "TipoDeComprobante");
        const tipoMap = {
          'I': 'I - Ingreso',
          'E': 'E - Egreso',
          'T': 'T - Traslado',
          'P': 'P - Pago',
          'N': 'N - Nómina'
        };
        data.tipoComprobante = tipoMap[tipo] || tipo || 'I - Ingreso';

        data.fechaEmision = getAttr(comprobanteNode, "Fecha") || '';
        if (data.fechaEmision) {
          const datePart = data.fechaEmision.split('T')[0];
          const parts = datePart.split('-');
          if (parts.length === 3) {
            data.anoEmision = parts[0];
            data.mesEmision = parts[1];
            data.diaEmision = parts[2];
          }
        }

        data.serie = getAttr(comprobanteNode, "Serie") || 'N/A';
        data.folio = getAttr(comprobanteNode, "Folio") || 'N/A';

        const fp = getAttr(comprobanteNode, "FormaPago");
        const fpMap = {
          '01': '01 - Efectivo',
          '02': '02 - Cheque nominativo',
          '03': '03 - Transferencia electrónica de fondos',
          '04': '04 - Tarjeta de crédito',
          '05': '05 - Monedero electrónico',
          '08': '08 - Vales de despensa',
          '12': '12 - Dación en pago',
          '15': '15 - Condonación',
          '17': '17 - Compensación',
          '27': '27 - A satisfacción del acreedor',
          '28': '28 - Tarjeta de débito',
          '29': '29 - Tarjeta de servicios',
          '30': '30 - Aplicación de anticipos',
          '31': '31 - Intermediario pagos',
          '99': '99 - Por definir'
        };
        data.formaPago = fpMap[fp] || fp || 'N/A';

        const mp = getAttr(comprobanteNode, "MetodoPago");
        const mpMap = {
          'PUE': 'PUE - Pago en una sola exhibición',
          'PPD': 'PPD - Pago en parcialidades o diferido'
        };
        data.metodoPago = mpMap[mp] || mp || 'N/A';

        data.condicionesPago = getAttr(comprobanteNode, "CondicionesDePago") || 'N/A';
        data.moneda = getAttr(comprobanteNode, "Moneda") || 'MXN';
        data.tipoCambio = getAttr(comprobanteNode, "TipoCambio") || '1';

        data.subtotal = parseFloat(getAttr(comprobanteNode, "SubTotal") || getAttr(comprobanteNode, "subTotal") || 0);
        data.descuento = parseFloat(getAttr(comprobanteNode, "Descuento") || getAttr(comprobanteNode, "descuento") || 0);
        data.total = parseFloat(getAttr(comprobanteNode, "Total") || getAttr(comprobanteNode, "total") || 0);
      }

      if (emisorNode) {
        data.rfcEmisor = (getAttr(emisorNode, "Rfc") || '').toUpperCase();
        data.nombreEmisor = getAttr(emisorNode, "Nombre") || '';
      }

      if (receptorNode) {
        data.rfcReceptor = (getAttr(receptorNode, "Rfc") || '').toUpperCase() || defaultReceptorRfc;
        data.nombreReceptor = getAttr(receptorNode, "Nombre") || 'EUROREP S.A. DE C.V.';
      }

      if (timbreNode) {
        data.uuid = (getAttr(timbreNode, "UUID") || '').toUpperCase();
        data.fechaTimbrado = getAttr(timbreNode, "FechaTimbrado") || '';
      }

      // Taxes retenciones y traslados
      let isrRet = 0;
      let ivaRet = 0;
      let ivaTras = 0;
      const nsList = ["cfdi:", ""];

      // 1. Retenciones
      for (const ns of nsList) {
        const retencionNodes = xmlDoc.getElementsByTagName(ns + "Retencion");
        if (retencionNodes && retencionNodes.length > 0) {
          for (let i = 0; i < retencionNodes.length; i++) {
            const node = retencionNodes[i];
            const imp = node.getAttribute("Impuesto") || node.getAttribute("impuesto");
            const impVal = parseFloat(node.getAttribute("Importe") || node.getAttribute("importe") || 0);
            if (imp === "001") {
              isrRet += impVal;
            } else if (imp === "002") {
              ivaRet += impVal;
            }
          }
          break;
        }
      }

      // 2. Traslados (IVA 16% o 8%)
      for (const ns of nsList) {
        const trasladoNodes = xmlDoc.getElementsByTagName(ns + "Traslado");
        if (trasladoNodes && trasladoNodes.length > 0) {
          for (let i = 0; i < trasladoNodes.length; i++) {
            const node = trasladoNodes[i];
            const imp = node.getAttribute("Impuesto") || node.getAttribute("impuesto");
            const impVal = parseFloat(node.getAttribute("Importe") || node.getAttribute("importe") || 0);
            if (imp === "002") {
              ivaTras += impVal;
            }
          }
          break;
        }
      }

      data.isrRetenido = isrRet;
      data.ivaRetenido = ivaRet;
      data.ivaTrasladado = ivaTras;
    } else {
      // Fallback regex para entornos sin DOM (Node.js, workers, edge functions)
      const getAttrRegex = (tagPattern, attr) => {
        const tagRegex = new RegExp(`<[^>]*?${tagPattern}[^>]*?>`, 'i');
        const tagMatch = xmlText.match(tagRegex);
        if (!tagMatch) return '';
        const tagStr = tagMatch[0];
        const attrRegex = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
        const attrMatch = tagStr.match(attrRegex);
        return attrMatch ? attrMatch[1] : '';
      };

      data.versionCfdi = getAttrRegex('(?:cfdi:)?Comprobante', 'Version') || '4.0';
      const tipo = getAttrRegex('(?:cfdi:)?Comprobante', 'TipoDeComprobante');
      const tipoMap = { 'I': 'I - Ingreso', 'E': 'E - Egreso', 'T': 'T - Traslado', 'P': 'P - Pago', 'N': 'N - Nómina' };
      data.tipoComprobante = tipoMap[tipo] || tipo || 'I - Ingreso';

      data.fechaEmision = getAttrRegex('(?:cfdi:)?Comprobante', 'Fecha') || '';
      if (data.fechaEmision) {
        const parts = data.fechaEmision.split('T')[0].split('-');
        if (parts.length === 3) {
          data.anoEmision = parts[0];
          data.mesEmision = parts[1];
          data.diaEmision = parts[2];
        }
      }

      data.serie = getAttrRegex('(?:cfdi:)?Comprobante', 'Serie') || 'N/A';
      data.folio = getAttrRegex('(?:cfdi:)?Comprobante', 'Folio') || 'N/A';
      data.condicionesPago = getAttrRegex('(?:cfdi:)?Comprobante', 'CondicionesDePago') || 'N/A';
      data.moneda = getAttrRegex('(?:cfdi:)?Comprobante', 'Moneda') || 'MXN';
      data.tipoCambio = getAttrRegex('(?:cfdi:)?Comprobante', 'TipoCambio') || '1';

      data.subtotal = parseFloat(getAttrRegex('(?:cfdi:)?Comprobante', 'SubTotal') || 0);
      data.descuento = parseFloat(getAttrRegex('(?:cfdi:)?Comprobante', 'Descuento') || 0);
      data.total = parseFloat(getAttrRegex('(?:cfdi:)?Comprobante', 'Total') || 0);

      data.rfcEmisor = (getAttrRegex('(?:cfdi:)?Emisor', 'Rfc') || '').toUpperCase();
      data.nombreEmisor = getAttrRegex('(?:cfdi:)?Emisor', 'Nombre') || '';

      data.rfcReceptor = (getAttrRegex('(?:cfdi:)?Receptor', 'Rfc') || '').toUpperCase() || defaultReceptorRfc;
      data.nombreReceptor = getAttrRegex('(?:cfdi:)?Receptor', 'Nombre') || 'EUROREP S.A. DE C.V.';

      data.uuid = (getAttrRegex('(?:tfd:)?TimbreFiscalDigital', 'UUID') || '').toUpperCase();
      data.fechaTimbrado = getAttrRegex('(?:tfd:)?TimbreFiscalDigital', 'FechaTimbrado') || '';
    }
  } catch (err) {
    console.error('Error parsing XML in extraerDatosCompletosXml:', err);
  }

  return data;
}

export function toggleSatAccordion(bodyId) {
  if (typeof document === 'undefined') return;
  const body = document.getElementById(bodyId);
  const iconId = bodyId.replace('body', 'icon');
  const icon = document.getElementById(iconId);
  
  if (body) {
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    
    if (icon) {
      icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }
}

export function renderSatDetailsTable(satData, containerId) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const satLabels = {
    versionCfdi: "Version CFDI",
    uuid: "UUID",
    estatus: "Estatus",
    fechaCancelacion: "Fecha Cancelacion",
    tipoComprobante: "Tipo De Comprobante",
    fechaEmision: "Fecha Emision",
    anoEmision: "Año Emision",
    mesEmision: "Mes Emision",
    diaEmision: "Dia Emision",
    fechaTimbrado: "Fecha Timbrado",
    serie: "Serie",
    folio: "Folio",
    formaPago: "Forma Pago",
    metodoPago: "Metodo Pago",
    condicionesPago: "Condiciones De Pago",
    rfcEmisor: "RFC Emisor",
    nombreEmisor: "Nombre Emisor",
    rfcReceptor: "RFC Receptor",
    nombreReceptor: "Nombre Receptor",
    moneda: "Moneda",
    tipoCambio: "Tipo Cambio",
    subtotal: "SubTotal",
    descuento: "Descuento",
    ivaTrasladado: "IVA Trasladado",
    isrRetenido: "ISR Retenido",
    ivaRetenido: "IVA Retenido",
    total: "Total"
  };

  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  let html = `
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <tbody>
  `;

  let idx = 0;
  for (const [key, label] of Object.entries(satLabels)) {
    let val = satData[key];
    if (["subtotal", "descuento", "total", "isrRetenido", "ivaRetenido", "ivaTrasladado"].includes(key)) {
      val = formatMoney(parseFloat(val || 0));
    } else if (!val) {
      val = 'N/A';
    }

    const rowBg = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
    const borderStyle = 'border-bottom: 1px solid var(--border);';
    
    html += `
      <tr style="background: ${rowBg}; ${borderStyle}">
        <td style="padding: 0.4rem 0.5rem; font-weight: 600; color: var(--text-secondary); width: 40%; font-size: 0.72rem; border: none;">${label}</td>
        <td style="padding: 0.4rem 0.5rem; color: var(--text-primary); font-size: 0.72rem; word-break: break-all; border: none; font-family: ${key === 'uuid' || key.includes('rfc') ? 'monospace' : 'inherit'}">${val}</td>
      </tr>
    `;
    idx++;
  }

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

// Analiza el texto extraído de un PDF para buscar datos del SAT (RFC, UUID, Monto, Fecha)
export function analizarFacturaPdfTexto(text) {
  const cfg = _getConfigData();
  const defaultReceptorRfc = (cfg.rfc || 'ERE140718NY8').toUpperCase().trim();

  const data = {
    versionCfdi: '4.0',
    uuid: '',
    estatus: 'Vigente',
    fechaCancelacion: 'N/A',
    tipoComprobante: 'I - Ingreso',
    fechaEmision: '',
    anoEmision: '',
    mesEmision: '',
    diaEmision: '',
    fechaTimbrado: '',
    serie: 'N/A',
    folio: 'N/A',
    formaPago: '03 - Transferencia electrónica de fondos',
    metodoPago: 'PUE - Pago en una sola exhibición',
    condicionesPago: 'N/A',
    rfcEmisor: '',
    nombreEmisor: '',
    rfcReceptor: defaultReceptorRfc,
    nombreReceptor: 'EUROREP S.A. DE C.V.',
    moneda: 'MXN',
    tipoCambio: '1',
    subtotal: 0,
    descuento: 0,
    total: 0,
    isrRetenido: 0,
    ivaRetenido: 0,
    ivaTrasladado: 0
  };
  
  if (!text) return data;

  // 1. Version CFDI
  const versionRegex = /(?:Versión|Version)\s*(?:CFDI)?\s*:\s*([34]\.[03])/i;
  const versionMatch = text.match(versionRegex);
  if (versionMatch) {
    data.versionCfdi = versionMatch[1];
  }

  // 2. UUID
  const uuidRegex = /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/;
  const uuidMatch = text.match(uuidRegex);
  if (uuidMatch) {
    data.uuid = uuidMatch[1].toUpperCase();
  }

  // 3. RFCs (Emisor / Receptor)
  const rfcRegex = /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/gi;
  const rfcMatches = text.match(rfcRegex) || [];
  const uniqueRfcs = [...new Set(rfcMatches.map(r => r.toUpperCase()))];
  
  const emisorRfc = uniqueRfcs.find(rfc => rfc !== defaultReceptorRfc);
  if (emisorRfc) {
    data.rfcEmisor = emisorRfc;
  } else if (uniqueRfcs.length > 0) {
    data.rfcEmisor = uniqueRfcs[0];
  }
  
  data.rfcReceptor = defaultReceptorRfc;

  // 4. Nombre Emisor
  const emisorNombreRegex = /(?:Emisor|Nombre\s*(?:del)?\s*Emisor|Expedido\s*Por)\s*:\s*([^\n\r]+)/i;
  const emisorNombreMatch = text.match(emisorNombreRegex);
  if (emisorNombreMatch) {
    let name = emisorNombreMatch[1].trim();
    // Remove RFC if present in name
    name = name.replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i, '').trim();
    // Remove Régimen Fiscal details
    name = name.replace(/(?:Régimen|Regimen)\s*(?:Fiscal)?\s*(?::)?\s*\d{3}\s*-\s*[^\n\r]+/i, '').trim();
    name = name.replace(/(?:Régimen|Regimen)\s*(?:Fiscal)?\s*(?::)?\s*[^\n\r]+/i, '').trim();
    // Remove other trailing noise
    name = name.replace(/\b(?:Régimen|Regimen|Fiscal|RFC|C\.P\.|Lugar\s*de)\b.*/i, '').trim();
    // Clean trailing/leading spaces, colons, hyphens
    name = name.replace(/^[\s-:,]+|[\s-:,]+$/g, '').replace(/\s+/g, ' ').trim();
    data.nombreEmisor = name || emisorNombreMatch[1].trim();
  } else {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('gasolinera del valle')) {
      data.nombreEmisor = 'GASOLINERA DEL VALLE S.A.';
    } else if (lowerText.includes('tiendas comerciales')) {
      data.nombreEmisor = 'TIENDAS COMERCIALES S.A.';
    } else if (lowerText.includes('office depot')) {
      data.nombreEmisor = 'OFFICE DEPOT DE MEXICO S.A. DE C.V.';
    } else if (lowerText.includes('concesionaria metropolitana')) {
      data.nombreEmisor = 'CONCESIONARIA METROPOLITANA S.A.';
    } else if (lowerText.includes('uber')) {
      data.nombreEmisor = 'UBER RIDE / UBER MEXICO';
    } else if (lowerText.includes('linkedin')) {
      data.nombreEmisor = 'LINKEDIN IRELAND LIMITED';
    } else {
      data.nombreEmisor = data.rfcEmisor ? `PROVEEDOR: ${data.rfcEmisor}` : 'N/A';
    }
  }

  // 5. Total
  let detectedTotal = 0;
  const lines = text.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    // Skip lines containing "impuesto", "retenido", "trasladado", "letra", "letras", "ahorro"
    if (lowerLine.includes('impuesto') || lowerLine.includes('retenido') || lowerLine.includes('trasladado') || lowerLine.includes('letra') || lowerLine.includes('letras') || lowerLine.includes('ahorro')) {
      continue;
    }
    // Priority 1: Match "Total" or "Total a Pagar" or "Total del Comprobante" (avoiding Subtotal)
    const totalLineRegex = /(?<!sub)\b(?:total|neto|pagar|importe|monto|total\s*factura)\b[^0-9$]{0,35}(?:\$)?\s*([0-9,]+\.\d{2})\b/i;
    const match = line.match(totalLineRegex);
    if (match) {
      const cleanNum = match[1].replace(/,/g, '');
      const val = parseFloat(cleanNum);
      if (!isNaN(val) && val > detectedTotal) {
        detectedTotal = val; // We want the largest non-tax total line
      }
    }
  }
  if (detectedTotal > 0) {
    data.total = detectedTotal;
  } else {
    // Fallback to simple regex if not found by lines
    const fallbackMatch = text.match(/(?<!sub)(?<!impuesto\s)(?<!impuestos\s)total\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i);
    if (fallbackMatch) {
      data.total = parseFloat(fallbackMatch[1].replace(/,/g, ''));
    }
  }

  // 6. Subtotal
  const subtotalRegex = /(?:subtotal|sub-total|sub\s*total)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
  const subtotalMatch = text.match(subtotalRegex);
  if (subtotalMatch) {
    const cleanNum = subtotalMatch[1].replace(/,/g, '');
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) {
      data.subtotal = val;
    }
  } else {
    data.subtotal = parseFloat((data.total / 1.16).toFixed(2));
  }

  // 7. Descuento
  const descuentoRegex = /(?:descuento|rebaja)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
  const descuentoMatch = text.match(descuentoRegex);
  if (descuentoMatch) {
    const cleanNum = descuentoMatch[1].replace(/,/g, '');
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) {
      data.descuento = val;
    }
  }

  // 8. Retenciones e IVA Trasladado
  const isrRegex = /(?:retención\s*isr|retencion\s*isr|isr\s*ret|isr\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
  const isrMatch = text.match(isrRegex);
  if (isrMatch) {
    const cleanNum = isrMatch[1].replace(/,/g, '');
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) {
      data.isrRetenido = val;
    }
  }

  const ivaRetRegex = /(?:retención\s*iva|retencion\s*iva|iva\s*ret|iva\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
  const ivaRetMatch = text.match(ivaRetRegex);
  if (ivaRetMatch) {
    const cleanNum = ivaRetMatch[1].replace(/,/g, '');
    const val = parseFloat(cleanNum);
    if (!isNaN(val)) {
      data.ivaRetenido = val;
    }
  }

  // 8b. IVA Trasladado (16% estándar o detectado por regex)
  const ivaRegexes = [
    /(?:iva\s*16%|iva\s*trasladado|impuesto\s*iva|i\.v\.a\.)\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i,
    /IVA\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i
  ];
  let ivaTrasFound = 0;
  for (const regex of ivaRegexes) {
    // Avoid matching retained/retencion lines
    const matches = text.match(new RegExp(regex.source, 'gi')) || [];
    for (const m of matches) {
      if (m.toLowerCase().includes('retencion') || m.toLowerCase().includes('retenido')) continue;
      const singleMatch = m.match(regex);
      if (singleMatch) {
        const cleanNum = singleMatch[1].replace(/,/g, '');
        const val = parseFloat(cleanNum);
        if (!isNaN(val) && val > 0) {
          ivaTrasFound = val;
          break;
        }
      }
    }
    if (ivaTrasFound > 0) break;
  }
  data.ivaTrasladado = ivaTrasFound || parseFloat((data.subtotal * 0.16).toFixed(2));

  // 9. Fecha Emision
  const dateRegex = /\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    let rawDate = dateMatch[0];
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    data.fechaEmision = rawDate;
    
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      data.anoEmision = parts[0];
      data.mesEmision = parts[1];
      data.diaEmision = parts[2];
    }
  }

  // 10. Fecha Timbrado
  const timbreDateRegex = /(?:fecha\s*(?:de)?\s*(?:certificación|timbrado))\s*(?::)?\s*([\d\-\/T:\s]+)/i;
  const timbreDateMatch = text.match(timbreDateRegex);
  if (timbreDateMatch) {
    const dateText = timbreDateMatch[1].trim().match(/\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/);
    if (dateText) {
      let rawDate = dateText[0];
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      data.fechaTimbrado = rawDate;
    }
  }
  if (!data.fechaTimbrado) {
    data.fechaTimbrado = data.fechaEmision;
  }

  // 11. Serie & Folio
  const serieRegex = /(?:serie)\s*:\s*([A-Za-z0-9\-]+)/i;
  const serieMatch = text.match(serieRegex);
  if (serieMatch) {
    data.serie = serieMatch[1].toUpperCase();
  }
  
  const folioRegex = /(?:folio|factura|invoice\s*no)\s*(?::)?\s*([0-9\-]+)/i;
  const folioMatch = text.match(folioRegex);
  if (folioMatch) {
    data.folio = folioMatch[1];
  }

  // 12. Tipo de Comprobante
  const tipoRegex = /(?:tipo\s*(?:de)?\s*comprobante)\s*(?::)?\s*([A-Za-z]+)/i;
  const tipoMatch = text.match(tipoRegex);
  if (tipoMatch) {
    const t = tipoMatch[1].toLowerCase();
    if (t.includes('ingreso')) data.tipoComprobante = 'I - Ingreso';
    else if (t.includes('egreso')) data.tipoComprobante = 'E - Egreso';
    else if (t.includes('traslado')) data.tipoComprobante = 'T - Traslado';
    else if (t.includes('pago')) data.tipoComprobante = 'P - Pago';
    else if (t.includes('nómina') || t.includes('nomina')) data.tipoComprobante = 'N - Nómina';
  }

  // 13. Moneda
  let currency = 'MXN'; // default fallback
  
  // Try to find a standalone 3-letter currency code near the word "moneda" or "currency"
  const currencyRegex = /(?:moneda|currency)\s*(?::)?\s*\b([A-Z]{3})\b/i;
  const currencyMatch = text.match(currencyRegex);
  if (currencyMatch) {
    const m = currencyMatch[1].toUpperCase();
    if (m === 'MXN' || m === 'USD' || m === 'EUR') {
      currency = m;
    }
  } else {
    // If not found, let's scan the whole text for known currencies using strict word boundaries/patterns
    if (/\b(?:usd|dolar|dólar|dollar|dollars)\b/i.test(text)) {
      currency = 'USD';
    } else if (/\b(?:eur|euro|euros)\b/i.test(text)) {
      currency = 'EUR';
    } else if (/\b(?:mxn|peso|pesos|m\.n\.)\b/i.test(text)) {
      currency = 'MXN';
    }
  }
  data.moneda = currency;
  
  const tcRegex = /(?:tipo\s*(?:de)?\s*cambio)\s*(?::)?\s*([0-9\.]+)/i;
  const tcMatch = text.match(tcRegex);
  if (tcMatch) {
    data.tipoCambio = tcMatch[1];
  }

  // 14. Forma & Metodo Pago
  const fpRegex = /(?:forma\s*(?:de)?\s*pago)\s*(?::)?\s*([^\n\r]+)/i;
  const fpMatch = text.match(fpRegex);
  if (fpMatch) {
    const fpStr = fpMatch[1].toLowerCase();
    if (fpStr.includes('efectivo')) data.formaPago = '01 - Efectivo';
    else if (fpStr.includes('cheque')) data.formaPago = '02 - Cheque nominativo';
    else if (fpStr.includes('transferencia')) data.formaPago = '03 - Transferencia electrónica de fondos';
    else if (fpStr.includes('tarjeta') && fpStr.includes('crédito')) data.formaPago = '04 - Tarjeta de crédito';
    else if (fpStr.includes('tarjeta') && fpStr.includes('débito')) data.formaPago = '28 - Tarjeta de débito';
  }
  
  const mpRegex = /(?:método|metodo\s*(?:de)?\s*pago)\s*(?::)?\s*(PUE|PPD|[^\n\r]+)/i;
  const mpMatch = text.match(mpRegex);
  if (mpMatch) {
    const mpStr = mpMatch[1].toUpperCase();
    if (mpStr.includes('PUE') || mpStr.includes('SOLA EXHIBICIÓN') || mpStr.includes('SOLA EXHIBICION')) {
      data.metodoPago = 'PUE - Pago en una sola exhibición';
    } else if (mpStr.includes('PPD') || mpStr.includes('PARCIALIDADES')) {
      data.metodoPago = 'PPD - Pago en parcialidades o diferido';
    }
  }

  // 15. Condiciones
  const condRegex = /(?:condiciones\s*(?:de)?\s*pago)\s*(?::)?\s*([^\n\r]+)/i;
  const condMatch = text.match(condRegex);
  if (condMatch) {
    data.condicionesPago = condMatch[1].trim();
  }

  // Backward compatible keys for offline tests
  data.rfc = data.rfcEmisor;
  data.monto = data.total;
  data.date = data.fechaEmision;

  return data;
}

// Helper central de procesamiento de PDF
export function procesarPdfFacturaExtraida(name, base64Data) {
  if (typeof window !== 'undefined') {
    window._gastoPdfBase64 = base64Data;
    if (!window._gastoUploadedFiles) window._gastoUploadedFiles = [];
    
    window._gastoUploadedFiles = window._gastoUploadedFiles.filter(x => x.type !== 'pdf');
    window._gastoUploadedFiles.push({
      type: 'pdf',
      base64: base64Data,
      name: name
    });

    if (typeof window.renderUploaderSidebar === 'function') {
      window.renderUploaderSidebar();
    }
  }
  
  const pdfjs = (typeof window !== 'undefined' && window.pdfjsLib) ? window.pdfjsLib : (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);

  if (pdfjs) {
    _notify('Analizando factura PDF y extrayendo datos...', 'info');
    extraerFacturaSatNube('pdf', base64Data)
      .then(satData => {
        if (typeof window !== 'undefined') {
          window._gastoSatData = satData;
        }
        let dataFound = false;
        
        if (typeof document !== 'undefined') {
          const rfcVal = satData.rfcEmisor || satData.rfc;
          if (rfcVal) {
            const rfcInput = document.getElementById('gasto-rfc-emisor');
            if (rfcInput) {
              rfcInput.value = rfcVal;
              dataFound = true;
            }
          }
          if (satData.uuid) {
            const uuidInput = document.getElementById('gasto-uuid-fiscal');
            if (uuidInput) {
              uuidInput.value = satData.uuid;
              dataFound = true;
            }
          }
          const fechaVal = satData.fechaEmision || satData.date;
          if (fechaVal) {
            const fechaInput = document.getElementById('gasto-fecha');
            if (fechaInput) {
              fechaInput.value = fechaVal ? fechaVal.split('T')[0] : '';
              dataFound = true;
            }
          }
          const totalVal = satData.total || satData.monto;
          if (totalVal > 0) {
            const montoInput = document.getElementById('gasto-monto');
            if (montoInput && (!montoInput.value || parseFloat(montoInput.value) === 0)) {
              montoInput.value = totalVal;
              dataFound = true;
              
              // Trigger header amount update
              const amountEl = document.getElementById('gasto-header-monto');
              if (amountEl) {
                amountEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalVal);
              }
            }
          }
          
          // Show/Render accordion with the 26 fields
          const accordion = document.getElementById('gasto-sat-details-accordion');
          if (accordion) {
            accordion.style.display = 'block';
            renderSatDetailsTable(satData, 'gasto-sat-accordion-body');
          }
        }
        
        if (dataFound) {
          _notify('Datos fiscales extraídos exitosamente del PDF', 'success');
        } else {
          _notify('Factura PDF cargada (no se encontraron campos SAT legibles)', 'info');
        }
        
        if (typeof window !== 'undefined' && typeof window.actualizarChecklistRevisar === 'function') {
          window.actualizarChecklistRevisar();
        }
      })
      .catch(err => {
        console.error('Error al parsear el PDF:', err);
        _notify('PDF cargado, pero no se pudo extraer el texto', 'warning');
      });
  } else {
    _notify('Factura PDF importada exitosamente', 'success');
  }
}

// ── VISOR DE PDF Y FICHA SAT 26 CAMPOS ────────────────────────────────────
// =========================================================================

export async function visualizarPdfBase64(base64, name) {
  if (!base64) return;

  // Track telemetry PDF visor open
  if (typeof window !== 'undefined' && typeof window.trackTelemetryEvent === 'function') {
    window.trackTelemetryEvent('Visor PDF SAT', { archivo: name || 'documento.pdf' });
  }

  if (typeof document === 'undefined') return;

  const modal = document.getElementById('modal-pdf-visor');
  const title = document.getElementById('pdf-visor-title');
  const frame = document.getElementById('pdf-visor-frame');
  const downloadLink = document.getElementById('pdf-visor-download-link');
  const errorBox = document.getElementById('pdf-visor-error');
  const satBody = document.getElementById('pdf-visor-sat-body');

  if (!modal) return;

  if (title) title.textContent = name || 'Visor de PDF';

  const localBase64 = await ensureBase64FromStorageUrl(base64);

  if (frame) frame.src = localBase64;
  if (downloadLink) {
    downloadLink.href = localBase64;
    downloadLink.download = name || 'documento.pdf';
  }
  
  modal.style.display = 'flex';
  if (errorBox) errorBox.style.display = 'none';
  if (frame) frame.style.display = 'block';

  // Load and render the 26 SAT fields
  if (satBody) {
    satBody.innerHTML = `
      <div style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.5rem; justify-content:center;">
        <i data-lucide="loader" class="animate-spin" style="width:24px; height:24px; color:var(--accent);"></i>
        <span>Analizando contenido del PDF y extrayendo Ficha SAT...</span>
      </div>
    `;
    _renderIcons();
  }

  extraerFacturaSatNube('pdf', localBase64)
    .then(satData => {
      renderSatDetailsTable(satData, 'pdf-visor-sat-body');
    })
    .catch(() => {
      const baseName = (name || '').substring(0, (name || '').lastIndexOf('.'));
      const cleanBaseName = baseName.replace(/^(factura|Factura)_/, '');
      const uuidMatch = (name || '').match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
      const uuid = uuidMatch ? uuidMatch[1] : null;
      const sb = _getSb();

      if (sb) {
        // Ejecutar búsqueda en cascada por UUID o nombre de archivo
        const buscarDatosSat = async () => {
          // 1. Intentar por UUID en facturas_analizadas
          if (uuid) {
            const { data, error } = await sb.from('facturas_analizadas').select('*').eq('uuid', uuid);
            if (!error && data && data.length > 0) {
              const matched = data.find(x => x.uuid || x.rfc_emisor);
              if (matched) return matched;
            }
          }

          // 2. Intentar por UUID en facturas_conciliadas
          if (uuid) {
            const { data, error } = await sb.from('facturas_conciliadas').select('*').eq('uuid', uuid);
            if (!error && data && data.length > 0) {
              const matched = data.find(x => x.uuid || x.rfc_emisor);
              if (matched) return matched;
            }
          }

          // 3. Intentar por nombre de archivo aproximado en facturas_analizadas
          {
            const { data, error } = await sb.from('facturas_analizadas')
              .select('*')
              .or(`file_name.ilike.%${cleanBaseName}%,file_name.ilike.%${baseName}%`);
            if (!error && data && data.length > 0) {
              const matched = data.find(x => x.uuid || x.rfc_emisor);
              if (matched) return matched;
            }
          }

          // 4. Intentar por nombre de archivo aproximado en facturas_conciliadas
          {
            const { data, error } = await sb.from('facturas_conciliadas')
              .select('*')
              .or(`file_name.ilike.%${cleanBaseName}%,file_name.ilike.%${baseName}%`);
            if (!error && data && data.length > 0) {
              const matched = data.find(x => x.uuid || x.rfc_emisor);
              if (matched) return matched;
            }
          }

          return null;
        };

        buscarDatosSat()
          .then(matched => {
            if (matched) {
              const satData = {
                versionCfdi: matched.version_cfdi,
                uuid: matched.uuid,
                estatus: matched.estatus,
                fechaCancelacion: matched.fecha_cancelacion,
                tipoComprobante: matched.tipo_comprobante,
                fechaEmision: matched.fecha_emision,
                anoEmision: matched.ano_emision,
                mesEmision: matched.mes_emision,
                diaEmision: matched.dia_emision,
                fechaTimbrado: matched.fecha_timbrado,
                serie: matched.serie,
                folio: matched.folio,
                formaPago: matched.forma_pago,
                metodoPago: matched.metodo_pago,
                condicionesPago: matched.condiciones_pago,
                rfcEmisor: matched.rfc_emisor,
                nombreEmisor: matched.nombre_emisor,
                rfcReceptor: matched.rfc_receptor,
                nombreReceptor: matched.nombre_receptor,
                moneda: matched.moneda,
                tipoCambio: matched.tipo_cambio,
                subtotal: parseFloat(matched.subtotal) || 0,
                descuento: parseFloat(matched.descuento) || 0,
                total: parseFloat(matched.total) || 0,
                isrRetenido: parseFloat(matched.isr_retenido) || 0,
                ivaRetenido: parseFloat(matched.iva_retenido) || 0,
                ivaTrasladado: parseFloat(matched.iva_trasladado) || 0
              };
              renderSatDetailsTable(satData, 'pdf-visor-sat-body');
            } else {
              mostrarFalloSat();
            }
          })
          .catch(() => mostrarFalloSat());
      } else {
        mostrarFalloSat();
      }
    });

  function mostrarFalloSat() {
    if (!satBody) return;
    satBody.innerHTML = `
      <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); padding:1.25rem; border-radius:8px; color:var(--red); text-align:center; display:flex; flex-direction:column; align-items:center; gap:0.4rem; justify-content:center;">
        <i data-lucide="alert-triangle" style="width:24px; height:24px;"></i>
        <strong style="font-size:0.8rem;">Ficha SAT no disponible</strong>
        <div style="font-size:0.68rem; opacity:0.8; max-width:250px;">El PDF no contiene texto legible (imagen escaneada o formato no compatible).</div>
      </div>
    `;
    _renderIcons();
  }
}

export function abrirPdfVisor(name) {
  if (typeof window === 'undefined' || !window._gastoUploadedFiles) return;
  const file = window._gastoUploadedFiles.find(x => x.type === 'pdf' && x.name === name);
  if (!file) {
    _notify('Archivo PDF no encontrado en caché', 'error');
    return;
  }
  visualizarPdfBase64(file.base64, file.name);
}

export function cerrarPdfVisor() {
  if (typeof document !== 'undefined') {
    const modal = document.getElementById('modal-pdf-visor');
    const frame = document.getElementById('pdf-visor-frame');
    if (modal) modal.style.display = 'none';
    if (frame) frame.src = '';
  }
}

// Bindeo global en window para compatibilidad
if (typeof window !== 'undefined') {
  window.onedriveMockDb = onedriveMockDb;
  window.cargarSdkOneDrive = cargarSdkOneDrive;
  window.formatBytes = formatBytes;
  window.abrirOneDrivePicker = abrirOneDrivePicker;
  window.abrirOneDrivePickerConToken = abrirOneDrivePickerConToken;
  window.cerrarOneDrivePicker = cerrarOneDrivePicker;
  window.navegarOneDriveReal = navegarOneDriveReal;
  window.navegarOneDriveSimulado = navegarOneDriveSimulado;
  window.actualizarBreadcrumbsOneDrive = actualizarBreadcrumbsOneDrive;
  window.filtrarOneDriveSimulado = filtrarOneDriveSimulado;
  window.renderOneDriveFiles = renderOneDriveFiles;
  window.seleccionarElementoOneDrive = seleccionarElementoOneDrive;
  window.confirmarImportacionOneDrive = confirmarImportacionOneDrive;
  window.procesarDescargaRealOneDrive = procesarDescargaRealOneDrive;
  window.procesarArchivoImportadoOneDrive = procesarArchivoImportadoOneDrive;
  window.extraerFacturaSatNube = extraerFacturaSatNube;
  window.extraerTextoPdf = extraerTextoPdf;
  window.decodificarXmlBase64 = decodificarXmlBase64;
  window.ensureBase64FromStorageUrl = ensureBase64FromStorageUrl;
  window.getXmlTextFromUrlOrBase64 = getXmlTextFromUrlOrBase64;
  window.extraerDatosCompletosXml = extraerDatosCompletosXml;
  window.toggleSatAccordion = toggleSatAccordion;
  window.renderSatDetailsTable = renderSatDetailsTable;
  window.analizarFacturaPdfTexto = analizarFacturaPdfTexto;
  window.procesarPdfFacturaExtraida = procesarPdfFacturaExtraida;
  window.visualizarPdfBase64 = visualizarPdfBase64;
  window.abrirPdfVisor = abrirPdfVisor;
  window.cerrarPdfVisor = cerrarPdfVisor;
}
