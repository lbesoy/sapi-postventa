/**
 * Módulo de Integración Microsoft OneDrive, Extracción Fiscal SAT y Visor de PDF - Eurorep / SAPI
 * Versión empaquetada para navegador vanilla.
 * Carga las utilidades de Microsoft OneDrive, motor SAT CFDI 4.0 y visor PDF
 * directamente en el objeto global (window).
 */

(function(global) {
  'use strict';

  // Helper para obtener cliente Supabase
  function _getSb() {
    if (typeof global !== 'undefined' && global.supabaseClient) return global.supabaseClient;
    return null;
  }

  // Helper para configuración global segura
  function _getConfigData() {
    if (typeof configData !== 'undefined' && configData) return configData;
    if (typeof global !== 'undefined' && global.configData) return global.configData;
    return {};
  }

  // Helper para notificaciones seguro
  function _notify(msg, type) {
    type = type || 'info';
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(msg, type);
    } else if (typeof global !== 'undefined' && typeof global.mostrarNotificacion === 'function') {
      global.mostrarNotificacion(msg, type);
    } else {
      console.log('[' + type + '] ' + msg);
    }
  }

  // Helper para renderizar iconos Lucide seguro
  function _renderIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    } else if (typeof global !== 'undefined' && global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  // Helper para extraer rutas relativas de OneDrive/SharePoint seguro
  function _extraerPath(folderId) {
    if (typeof global !== 'undefined' && typeof global.extraerPathOneDrive === 'function') {
      return global.extraerPathOneDrive(folderId);
    }
    if (typeof folderId !== 'string') return '';
    var docIndex = folderId.indexOf('/Documents/');
    if (docIndex > -1) {
      return folderId.substring(docIndex + 11);
    } else if (folderId.startsWith('/')) {
      return folderId.substring(1);
    }
    return folderId;
  }

  // Base de Datos de Archivos y Carpetas de OneDrive Simulado para Pruebas
  var onedriveMockDb = {
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
        content: '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="1174.79">\n' +
          '  <cfdi:Emisor Rfc="GVA120524XYZ" Nombre="GASOLINERA DEL VALLE S.A." RegimenFiscal="601"/>\n' +
          '  <cfdi:Complemento>\n' +
          '    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="f1a2b3c4-d5e6-4a7b-8c9d-0e1f2a3b4c5d" FechaTimbrado="2026-05-22T18:04:00"/>\n' +
          '  </cfdi:Complemento>\n' +
          '</cfdi:Comprobante>'
      },
      { 
        id: 'factura_ixtapaluca_xml', 
        name: 'factura_ixtapaluca_95.xml', 
        type: 'file', 
        ext: 'xml', 
        date: '22 May 2026 19:40', 
        size: '3.8 KB',
        content: '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="95.01">\n' +
          '  <cfdi:Emisor Rfc="TCO950524ABC" Nombre="TIENDAS COMERCIALES S.A." RegimenFiscal="601"/>\n' +
          '  <cfdi:Complemento>\n' +
          '    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" FechaTimbrado="2026-05-22T19:40:00"/>\n' +
          '  </cfdi:Complemento>\n' +
          '</cfdi:Comprobante>'
      },
      { 
        id: 'factura_office_xml', 
        name: 'factura_office_280.xml', 
        type: 'file', 
        ext: 'xml', 
        date: '21 May 2026 16:30', 
        size: '5.1 KB',
        content: '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="280.00">\n' +
          '  <cfdi:Emisor Rfc="ODM950524XYZ" Nombre="OFFICE DEPOT DE MEXICO S.A. DE C.V." RegimenFiscal="601"/>\n' +
          '  <cfdi:Complemento>\n' +
          '    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e" FechaTimbrado="2026-05-21T16:30:00"/>\n' +
          '  </cfdi:Complemento>\n' +
          '</cfdi:Comprobante>'
      },
      { 
        id: 'factura_pase_xml', 
        name: 'factura_pase_12.xml', 
        type: 'file', 
        ext: 'xml', 
        date: '22 May 2026 17:15', 
        size: '3.5 KB',
        content: '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfdi/4" Version="4.0" Total="12.91">\n' +
          '  <cfdi:Emisor Rfc="CME950524ABC" Nombre="CONCESIONARIA METROPOLITANA S.A." RegimenFiscal="601"/>\n' +
          '  <cfdi:Complemento>\n' +
          '    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f" FechaTimbrado="2026-05-22T17:15:00"/>\n' +
          '  </cfdi:Complemento>\n' +
          '</cfdi:Comprobante>'
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
  var onedriveCurrentFolder = '/';
  var onedriveSelectedFile = null;
  var onedriveRealMode = false;
  var onedriveRealToken = null;
  var onedriveFolderParents = {};
  var onedriveRealRootId = null;

  if (typeof global !== 'undefined') {
    Object.defineProperty(global, 'onedriveSelectedFile', {
      get: function() { return onedriveSelectedFile; },
      set: function(val) { onedriveSelectedFile = val; },
      configurable: true
    });
    global.onedriveMockDb = onedriveMockDb;
  }

  // Función para inyectar dinámicamente el SDK real de OneDrive
  function cargarSdkOneDrive(callback) {
    if (typeof global !== 'undefined' && global.OneDrive) {
      if (callback) callback();
      return;
    }
    if (typeof document !== 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://js.live.net/v7.2/OneDrive.js';
      script.onload = function() {
        if (callback) callback();
      };
      document.head.appendChild(script);
    }
  }

  // Helper para formatear bytes de Microsoft Graph
  function formatBytes(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '--';
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Abre el OneDrive Picker (Real o Simulado según la configuración)
  function abrirOneDrivePicker() {
    var cfg = _getConfigData();
    var odClientId = cfg.onedriveClientId || '';
    var odForceMock = cfg.onedriveForceMock !== false;
    
    var isRealActive = odClientId && odClientId !== 'MOCK' && !odForceMock;

    if (isRealActive) {
      if (typeof global !== 'undefined' && global.location && global.location.protocol === 'file:') {
        _notify('OneDrive real requiere protocolo HTTP/HTTPS. Inicia un servidor web local (ej: npx serve o Live Server) en lugar de abrir el archivo directamente.', 'error');
        return;
      }
      
      var token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ms_access_token') : null;
      var tokenExpiry = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ms_access_token_expiry') : null;
      
      if (token && (!tokenExpiry || Number(tokenExpiry) > Date.now())) {
        abrirOneDrivePickerConToken(token);
      } else {
        if (typeof global === 'undefined' || !global.open) return;
        var redirectUri = global.location.origin + global.location.pathname;
        var scopes = encodeURIComponent('Mail.Read Mail.ReadWrite Mail.Send Files.Read User.Read offline_access');
        var authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' + encodeURIComponent(odClientId) + '&response_type=token&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=' + scopes + '&response_mode=fragment';
        
        var width = 600;
        var height = 600;
        var left = global.screen.width / 2 - width / 2;
        var top = global.screen.height / 2 - height / 2;
        
        var loginPopup = global.open(authUrl, 'OneDriveLogin', 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',status=no,resizable=yes');
        
        if (!loginPopup) {
          _notify('No se pudo abrir la ventana de inicio de sesión de Microsoft. Por favor permite las ventanas emergentes en tu navegador.', 'error');
          return;
        }
        
        var pollInterval = setInterval(function() {
          try {
            if (!loginPopup || loginPopup.closed) {
              clearInterval(pollInterval);
              _notify('Inicio de sesión cancelado o la ventana se cerró.', 'warning');
              return;
            }
            
            var popupUrl = loginPopup.location.href;
            if (popupUrl.indexOf(global.location.origin) === 0) {
              var hash = loginPopup.location.hash;
              if (hash) {
                var params = new URLSearchParams(hash.substring(1));
                var accessToken = params.get('access_token');
                var expiresIn = params.get('expires_in');
                
                if (accessToken) {
                  sessionStorage.setItem('ms_access_token', accessToken);
                  if (expiresIn) {
                    var expiryTime = Date.now() + Number(expiresIn) * 1000;
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
            // Ignorar errores de origen cruzado durante el login
          }
        }, 500);
      }
    } else {
      onedriveRealMode = false;
      onedriveRealToken = null;
      
      if (typeof document === 'undefined') return;
      var modal = document.getElementById('modal-onedrive-picker-overlay');
      if (!modal) return;
      
      onedriveCurrentFolder = '/';
      onedriveSelectedFile = null;
      
      var searchInput = document.getElementById('onedrive-search-input');
      if (searchInput) searchInput.value = '';
      
      modal.style.display = 'flex';
      navegarOneDriveSimulado('/');
    }
  }

  // Abre el explorador de archivos OneDrive con el token obtenido
  function abrirOneDrivePickerConToken(token) {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('modal-onedrive-picker-overlay');
    if (!modal) return;
    
    onedriveRealMode = true;
    onedriveRealToken = token;
    onedriveRealRootId = null;
    
    var cfg = _getConfigData();
    var rootFolderId = cfg.onedriveFolderId || 'root';
    onedriveCurrentFolder = rootFolderId;
    onedriveSelectedFile = null;
    
    var searchInput = document.getElementById('onedrive-search-input');
    if (searchInput) searchInput.value = '';
    
    modal.style.display = 'flex';
    
    onedriveFolderParents = {};
    navegarOneDriveReal(onedriveCurrentFolder);

    if (typeof global !== 'undefined' && global.silentPreloadOneDriveFiles) {
      global.silentPreloadOneDriveFiles();
    }
  }

  // Cierra el explorador OneDrive
  function cerrarOneDrivePicker() {
    if (typeof document !== 'undefined') {
      var modal = document.getElementById('modal-onedrive-picker-overlay');
      if (modal) modal.style.display = 'none';
    }
    onedriveSelectedFile = null;
  }

  // Navega en las carpetas en tiempo real desde Microsoft Graph API
  function navegarOneDriveReal(folderId) {
    onedriveCurrentFolder = folderId;
    onedriveSelectedFile = null;
    
    if (typeof document === 'undefined') return;

    var btnConfirm = document.getElementById('btn-onedrive-import-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.6';
    }
    
    var tbody = document.getElementById('onedrive-picker-files-body');
    if (tbody) {
      tbody.innerHTML = '\n' +
        '<tr>\n' +
        '  <td colspan="4" style="text-align:center; padding:3rem; color:#8a8886; font-size:0.8rem;">\n' +
        '    <i data-lucide="loader-2" class="animate-spin" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;color:#0078d4;"></i>\n' +
        '    Cargando archivos desde Microsoft OneDrive...\n' +
        '  </td>\n' +
        '</tr>\n';
      _renderIcons();
    }
    
    var folderUrl = '';
    if (folderId === 'root') {
      folderUrl = 'https://graph.microsoft.com/v1.0/me/drive/root';
    } else if (folderId.startsWith('/') || folderId.includes('/') || folderId.includes('sharepoint.com')) {
      var relativePath = _extraerPath(folderId);
      var docIndex = relativePath.indexOf('/Documents/');
      if (docIndex > -1) {
        relativePath = relativePath.substring(docIndex + 11);
      } else if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
      var encodedSegments = relativePath.split('/').map(function(segment) {
        return encodeURIComponent(decodeURIComponent(segment));
      }).join('/');
      folderUrl = 'https://graph.microsoft.com/v1.0/me/drive/root:/' + encodedSegments;
    } else {
      folderUrl = 'https://graph.microsoft.com/v1.0/me/drive/items/' + folderId;
    }
      
    fetch(folderUrl, {
      headers: { 'Authorization': 'Bearer ' + onedriveRealToken }
    })
    .then(function(res) {
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
    .then(function(folderMeta) {
      if (!onedriveRealRootId) {
        onedriveRealRootId = folderMeta.id;
      }
      
      if (onedriveCurrentFolder === folderId && (folderId.startsWith('/') || folderId.includes('/'))) {
        onedriveCurrentFolder = folderMeta.id;
      }
      
      var folderName = folderId === 'root' ? 'Mis archivos' : (folderMeta.name || 'Carpeta');
      
      if (folderMeta.parentReference && folderMeta.parentReference.id) {
        onedriveFolderParents[folderMeta.id] = folderMeta.parentReference.id;
      }
      
      var childrenUrl = 'https://graph.microsoft.com/v1.0/me/drive/items/' + folderMeta.id + '/children';
        
      return (async function() {
        var allItems = [];
        var nextUrl = childrenUrl;
        while (nextUrl) {
          var res = await fetch(nextUrl, { headers: { 'Authorization': 'Bearer ' + onedriveRealToken } });
          if (!res.ok) throw new Error('Error al obtener contenido de la carpeta');
          var chunk = await res.json();
          if (chunk && Array.isArray(chunk.value)) {
            allItems = allItems.concat(chunk.value);
          }
          nextUrl = chunk ? chunk['@odata.nextLink'] : null;
        }
        return allItems;
      })()
      .then(function(children) {
        var mappedItems = children.map(function(item) {
          var isFolder = !!item.folder;
          var ext = isFolder ? '' : (item.name.split('.').pop() || '').toLowerCase();
          var date = '--';
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
    .catch(function(err) {
      if (err.message !== 'Unauthorized') {
        console.error('Error fetching OneDrive folder:', err);
        _notify('No se pudo cargar la carpeta de OneDrive', 'error');
        if (tbody) {
          tbody.innerHTML = '\n' +
            '<tr>\n' +
            '  <td colspan="4" style="text-align:center; padding:3rem; color:#ef4444; font-size:0.8rem;">\n' +
            '    <i data-lucide="alert-circle" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;"></i>\n' +
            '    Error al conectar con OneDrive. Por favor verifica tu configuración.\n' +
            '  </td>\n' +
            '</tr>\n';
          _renderIcons();
        }
      }
    });
  }

  // Navega en las carpetas simuladas de OneDrive
  function navegarOneDriveSimulado(folderId) {
    onedriveCurrentFolder = folderId;
    onedriveSelectedFile = null;
    
    var folderName = 'Mis archivos';
    if (folderId === 'folder_mayo') {
      folderName = 'Facturas Mayo 2026';
    } else if (folderId === 'folder_viaje') {
      folderName = 'Comprobantes de Viaje';
    }
    
    actualizarBreadcrumbsOneDrive(folderName);
    renderOneDriveFiles();
  }

  // Genera y actualiza el Breadcrumb de forma dinámica y controlada
  function actualizarBreadcrumbsOneDrive(folderName) {
    if (typeof document === 'undefined') return;
    var breadcrumbsEl = document.getElementById('onedrive-breadcrumbs');
    if (!breadcrumbsEl) return;
    
    var prefix = '<span style="font-weight:600; color:#605e5c; margin-right:0.25rem;">Carpeta de origen:</span>';
    var pathHtml = '';
    
    if (onedriveRealMode) {
      var isAtVirtualRoot = (onedriveCurrentFolder === onedriveRealRootId);
      
      if (isAtVirtualRoot) {
        pathHtml = '<span style="color:#242424; font-weight:600;">' + folderName + '</span>';
      } else {
        var parentId = onedriveFolderParents[onedriveCurrentFolder];
        if (parentId) {
          pathHtml += '<span style="color:#0078d4; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.25rem;" onclick="window.navegarOneDriveReal(\'' + parentId + '\')">' +
            '<i data-lucide="chevron-left" style="width:14px; height:14px;"></i> Atrás' +
          '</span>' +
          '<span style="color:#a19f9d; margin:0 0.2rem;">|</span>';
        }
        pathHtml += '<span style="color:#605e5c;">...</span> <span style="color:#a19f9d; margin:0 0.2rem;">/</span> <span style="color:#242424; font-weight:600;">' + folderName + '</span>';
      }
    } else {
      if (onedriveCurrentFolder === '/') {
        pathHtml = '<span style="color:#242424; font-weight:600;">Mis archivos</span>';
      } else {
        pathHtml = '<span style="color:#0078d4; cursor:pointer; font-weight:600;" onclick="window.navegarOneDriveSimulado(\'/\')">Mis archivos</span>' +
        '<span style="color:#a19f9d; margin:0 0.2rem;">/</span>' +
        '<span style="color:#242424; font-weight:600;">' + folderName + '</span>';
      }
    }
    
    breadcrumbsEl.innerHTML = prefix + ' ' + pathHtml;
    _renderIcons();
  }

  // Filtra la visualización del explorador OneDrive
  function filtrarOneDriveSimulado() {
    renderOneDriveFiles();
  }

  // Dibuja los archivos y carpetas del OneDrive (Simulado o Real)
  function renderOneDriveFiles() {
    if (typeof document === 'undefined') return;
    var tbody = document.getElementById('onedrive-picker-files-body');
    var btnConfirm = document.getElementById('btn-onedrive-import-confirm');
    if (!tbody) return;

    var items = onedriveMockDb[onedriveCurrentFolder] || [];
    var searchEl = document.getElementById('onedrive-search-input');
    var q = (searchEl ? searchEl.value : '').toLowerCase().trim();

    var filtered = items;
    if (q) {
      filtered = filtered.filter(function(x) { return x.name.toLowerCase().includes(q); });
    }

    tbody.innerHTML = '';
    
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.6';
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '\n' +
        '<tr>\n' +
        '  <td colspan="4" style="text-align:center; padding:3rem; color:#8a8886; font-size:0.8rem;">\n' +
        '    <i data-lucide="info" style="width:20px;height:20px;display:block;margin:0 auto 0.5rem;opacity:0.5;"></i>\n' +
        '    Esta carpeta está vacía.\n' +
        '  </td>\n' +
        '</tr>\n';
      _renderIcons();
      return;
    }

    filtered.forEach(function(item) {
      var isFolder = item.type === 'folder';
      var isSelected = onedriveSelectedFile && onedriveSelectedFile.id === item.id;
      
      var iconName = 'folder';
      var iconColor = '#ffb900';
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

      var navHandler = isFolder ? 'onclick="event.stopPropagation(); if(onedriveRealMode){window.navegarOneDriveReal(\'' + item.id + '\');}else{window.navegarOneDriveSimulado(\'' + item.id + '\');}"' : '';

      var rowHtml = '\n' +
        '<tr style="border-bottom:1px solid #f3f2f1; background:' + (isSelected ? '#eff6fc' : 'white') + '; cursor:pointer; height:38px; transition:var(--transition);"\n' +
        '    onmouseover="this.style.background=\'' + (isSelected ? '#eff6fc' : '#f3f2f1') + '\'"\n' +
        '    onmouseout="this.style.background=\'' + (isSelected ? '#eff6fc' : 'white') + '\'"\n' +
        '    onclick="window.seleccionarElementoOneDrive(\'' + item.id + '\', ' + isFolder + ')">\n' +
        '  <td style="padding:0.4rem 0.5rem; text-align:center; vertical-align:middle;" onclick="event.stopPropagation();">\n' +
        '    ' + (isFolder ? '' : '<input type="checkbox" style="cursor:pointer;" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); window.seleccionarElementoOneDrive(\'' + item.id + '\', false)" />') + '\n' +
        '  </td>\n' +
        '  <td style="padding:0.4rem; font-weight:' + (isFolder ? '600' : 'normal') + '; vertical-align:middle; color:#323130; display:flex; align-items:center; gap:0.5rem;">\n' +
        '    <i data-lucide="' + iconName + '" style="width:16px; height:16px; color:' + iconColor + '; flex-shrink:0;"></i>\n' +
        '    <span class="onedrive-item-name" style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" ' + navHandler + '>\n' +
        '      ' + item.name + '\n' +
        '    </span>\n' +
        '  </td>\n' +
        '  <td style="padding:0.4rem; color:#605e5c; vertical-align:middle;">' + item.date + '</td>\n' +
        '  <td style="padding:0.4rem; color:#605e5c; vertical-align:middle;">' + item.size + '</td>\n' +
        '</tr>\n';
      tbody.insertAdjacentHTML('beforeend', rowHtml);
    });

    _renderIcons();
  }

  // Selecciona un archivo en la lista
  function seleccionarElementoOneDrive(itemId, isFolder) {
    if (isFolder) {
      if (onedriveRealMode) {
        navegarOneDriveReal(itemId);
      } else {
        navegarOneDriveSimulado(itemId);
      }
      return;
    }
    
    var items = onedriveMockDb[onedriveCurrentFolder] || [];
    var file = items.find(function(x) { return x.id === itemId; });
    if (!file) return;

    onedriveSelectedFile = file;
    
    if (typeof document !== 'undefined') {
      var btnConfirm = document.getElementById('btn-onedrive-import-confirm');
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.style.opacity = '1';
      }
    }

    renderOneDriveFiles();
  }

  // Confirmación de selección en el picker
  function confirmarImportacionOneDrive() {
    if (!onedriveSelectedFile) return;

    var file = onedriveSelectedFile;
    if (onedriveRealMode) {
      procesarDescargaRealOneDrive(file.content);
    } else {
      procesarArchivoImportadoOneDrive(file.name, file.ext, file.content);
    }
    cerrarOneDrivePicker();
  }

  // Descarga en segundo plano e importación real desde Microsoft Graph
  function procesarDescargaRealOneDrive(microsoftFile) {
    var downloadUrl = microsoftFile["@microsoft.graph.downloadUrl"];
    var name = microsoftFile.name || "comprobante";
    var ext = name.split('.').pop().toLowerCase();

    if (!downloadUrl) {
      _notify('No se pudo obtener el URL de descarga del archivo', 'error');
      return;
    }

    _notify('Descargando archivo desde OneDrive...', 'info');

    fetch(downloadUrl)
      .then(function(response) {
        if (!response.ok) throw new Error("Fallo al descargar");
        if (ext === 'xml') {
          return response.text().then(function(text) {
            procesarArchivoImportadoOneDrive(name, ext, text);
          });
        } else {
          return response.blob().then(function(blob) {
            var reader = new FileReader();
            reader.onload = function(e) {
              procesarArchivoImportadoOneDrive(name, ext, e.target.result);
            };
            reader.readAsDataURL(blob);
          });
        }
      })
      .catch(function(err) {
        console.error('Error fetching OneDrive file:', err);
        _notify('Fallo al importar archivo desde OneDrive', 'error');
      });
  }

  // Función central de importación que procesa XML / PDF del Picker
  function procesarArchivoImportadoOneDrive(name, ext, dataContent) {
    if (typeof global !== 'undefined' && !global._gastoUploadedFiles) global._gastoUploadedFiles = [];

    if (ext === 'pdf') {
      procesarPdfFacturaExtraida(name, dataContent);
    } 
    else if (ext === 'xml') {
      var xmlText = dataContent;
      var base64Data = '';
      
      if (dataContent.startsWith('data:')) {
        base64Data = dataContent;
        try {
          var raw = atob(dataContent.split(',')[1]);
          xmlText = decodeURIComponent(escape(raw));
        } catch (err) {
          console.error('Error decoding base64 xml:', err);
        }
      } else {
        base64Data = 'data:text/xml;base64,' + btoa(unescape(encodeURIComponent(xmlText)));
      }

      if (typeof global !== 'undefined') {
        global._gastoXmlBase64 = base64Data;
      }

      try {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        var comprobanteNode = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0] || xmlDoc.getElementsByTagName("Comprobante")[0];
        var emisorNode = xmlDoc.getElementsByTagName("cfdi:Emisor")[0] || xmlDoc.getElementsByTagName("Emisor")[0];
        var timbreNode = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0] || xmlDoc.getElementsByTagName("TimbreFiscalDigital")[0];

        var rfcVal = emisorNode ? (emisorNode.getAttribute("Rfc") || emisorNode.getAttribute("rfc") || '').toUpperCase() : '';
        var emisorNombre = emisorNode ? (emisorNode.getAttribute("Nombre") || emisorNode.getAttribute("nombre") || '') : '';
        var uuidVal = timbreNode ? (timbreNode.getAttribute("UUID") || timbreNode.getAttribute("uuid") || '').toUpperCase() : '';
        var totalVal = comprobanteNode ? parseFloat(comprobanteNode.getAttribute("Total") || comprobanteNode.getAttribute("total") || 0) : 0;
        var fechaVal = comprobanteNode ? (comprobanteNode.getAttribute("Fecha") || comprobanteNode.getAttribute("fecha") || '').split('T')[0] : '';

        if (typeof global !== 'undefined') {
          global._gastoUploadedFiles = (global._gastoUploadedFiles || []).filter(function(x) {
            return !(x.type === 'xml' && x.uuid === uuidVal);
          });
          global._gastoUploadedFiles.push({
            type: 'xml',
            base64: base64Data,
            name: name,
            rfc: rfcVal,
            uuid: uuidVal,
            monto: totalVal,
            emisor: emisorNombre || ('XML: ' + rfcVal),
            date: fechaVal
          });

          if (typeof global.renderUploaderSidebar === 'function') {
            global.renderUploaderSidebar();
          }
          
          if (typeof global.actualizarFacturasSugeridas === 'function') {
            global.actualizarFacturasSugeridas();
          }

          if (uuidVal && typeof global.adjuntarXmlFactura === 'function') {
            global.adjuntarXmlFactura(uuidVal);
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
  if (typeof global !== 'undefined' && global.pdfjsLib) {
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  async function extraerFacturaSatNube(type, base64Data) {
    try {
      var satData;
      if (type === 'xml') {
        var xmlText = decodificarXmlBase64(base64Data);
        satData = extraerDatosCompletosXml(xmlText);
      } else {
        var text = await extraerTextoPdf(base64Data);
        satData = analizarFacturaPdfTexto(text);
      }

      var sb = _getSb();
      if (sb && satData && satData.uuid) {
        var payload = {
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
          .catch(function(err) { console.error('[Supabase] Error al guardar factura analizada en caché:', err); });
      }

      return satData;
    } catch (localErr) {
      console.warn('[Sync] Falló extracción local, intentando respaldo en la nube:', localErr.message);
      var sbClient = _getSb();
      if (!sbClient) {
        throw localErr;
      }
      
      var res = await sbClient.functions.invoke('extraer-factura-sat', {
        body: { type: type, base64: base64Data }
      });
      
      if (res.error) throw res.error;
      if (res.data && res.data.status === 'success') {
        var cloudSatData = res.data.data;
        if (sbClient && cloudSatData && cloudSatData.uuid) {
          var cloudPayload = {
            id: cloudSatData.uuid,
            file_name: cloudSatData.uuid + '.' + type,
            file_type: type,
            version_cfdi: cloudSatData.versionCfdi || null,
            uuid: cloudSatData.uuid || null,
            estatus: cloudSatData.estatus || null,
            fecha_cancelacion: cloudSatData.fechaCancelacion || null,
            tipo_comprobante: cloudSatData.tipoComprobante || null,
            fecha_emision: cloudSatData.fechaEmision || null,
            ano_emision: cloudSatData.anoEmision || null,
            mes_emision: cloudSatData.mesEmision || null,
            dia_emision: cloudSatData.diaEmision || null,
            fecha_timbrado: cloudSatData.fechaTimbrado || null,
            serie: cloudSatData.serie || null,
            folio: cloudSatData.folio || null,
            forma_pago: cloudSatData.formaPago || null,
            metodo_pago: cloudSatData.metodoPago || null,
            condiciones_pago: cloudSatData.condicionesPago || null,
            rfc_emisor: cloudSatData.rfcEmisor || null,
            nombre_emisor: cloudSatData.nombreEmisor || null,
            rfc_receptor: cloudSatData.rfcReceptor || null,
            nombre_receptor: cloudSatData.nombreReceptor || null,
            moneda: cloudSatData.moneda || null,
            tipo_cambio: cloudSatData.tipoCambio || null,
            subtotal: parseFloat(cloudSatData.subtotal) || 0,
            descuento: parseFloat(cloudSatData.descuento) || 0,
            total: parseFloat(cloudSatData.total) || 0,
            isr_retenido: parseFloat(cloudSatData.isrRetenido) || 0,
            iva_retenido: parseFloat(cloudSatData.ivaRetenido) || 0,
            iva_trasladado: parseFloat(cloudSatData.ivaTrasladado) || 0,
            base64_content: base64Data
          };
          sbClient.from('facturas_analizadas')
            .upsert(cloudPayload)
            .catch(function(err) { console.error('[Supabase] Error al guardar factura de la nube en caché:', err); });
        }
        return cloudSatData;
      } else {
        throw new Error((res.data && res.data.error) || 'Error en la nube');
      }
    }
  }

  async function extraerTextoPdf(base64Data) {
    try {
      var response = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ base64Data: base64Data })
      });
      if (response.ok) {
        var data = await response.json();
        if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
          console.log('[PDF Auto-Extract] Text extracted successfully via backend PDFKit.');
          return data.text;
        }
      }
    } catch (err) {
      console.warn('[PDF Auto-Extract] Backend PDFKit API error, falling back to local PDF.js:', err);
    }

    var pdfjs = (typeof global !== 'undefined' && global.pdfjsLib) ? global.pdfjsLib : (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);
    if (!pdfjs) {
      throw new Error('Librería PDF.js no cargada');
    }
    
    try {
      var base64Clean = base64Data.split(',')[1] || base64Data;
      var binaryString = atob(base64Clean);
      var len = binaryString.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      
      var loadingTask = pdfjs.getDocument({ data: bytes.buffer });
      var pdf = await loadingTask.promise;
      var fullText = '';
      
      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p);
        var textContent = await page.getTextContent();
        var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (err2) {
      console.error('Error al extraer texto del PDF:', err2);
      throw err2;
    }
  }

  function decodificarXmlBase64(dataUrl) {
    if (!dataUrl) return '';
    try {
      var raw = atob(dataUrl.split(',')[1] || dataUrl);
      return decodeURIComponent(escape(raw));
    } catch (err) {
      console.error('Error decodificando xml base64:', err);
      return '';
    }
  }

  async function ensureBase64FromStorageUrl(urlOrBase64) {
    if (!urlOrBase64) return '';
    if (!urlOrBase64.startsWith('http') || !urlOrBase64.includes('/storage/v1/object/public/')) {
      return urlOrBase64;
    }
    try {
      var parts = urlOrBase64.split('/storage/v1/object/public/');
      if (parts.length === 2) {
        var pathParts = parts[1].split('/');
        var bucketName = pathParts[0];
        var filePath = pathParts.slice(1).join('/');
        var sb = _getSb();
        if (sb) {
          var res = await sb.storage.from(bucketName).download(filePath);
          if (!res.error && res.data) {
            return await new Promise(function(resolve, reject) {
              var reader = new FileReader();
              reader.onloadend = function() { resolve(reader.result); };
              reader.onerror = reject;
              reader.readAsDataURL(res.data);
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Storage Helper] Error fetching/converting url to base64:', err);
    }
    return urlOrBase64;
  }

  async function getXmlTextFromUrlOrBase64(urlOrBase64) {
    if (!urlOrBase64) return '';
    if (urlOrBase64.startsWith('http') && urlOrBase64.includes('/storage/v1/object/public/')) {
      try {
        var parts = urlOrBase64.split('/storage/v1/object/public/');
        if (parts.length === 2) {
          var pathParts = parts[1].split('/');
          var bucketName = pathParts[0];
          var filePath = pathParts.slice(1).join('/');
          var sb = _getSb();
          if (sb) {
            var res = await sb.storage.from(bucketName).download(filePath);
            if (!res.error && res.data) {
              return await res.data.text();
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

  function extraerDatosCompletosXml(xmlText) {
    var cfg = _getConfigData();
    var defaultReceptorRfc = (cfg.rfc || 'ERE140718NY8').toUpperCase().trim();

    var data = {
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
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlText, "text/xml");

        var getEl = function(tag) {
          var namespaces = ["cfdi:", "tfd:", ""];
          for (var i = 0; i < namespaces.length; i++) {
            var ns = namespaces[i];
            var el = xmlDoc.getElementsByTagName(ns + tag);
            if (el && el.length > 0) return el[0];
          }
          return null;
        };

        var getAttr = function(el, attr) {
          if (!el) return '';
          var attrNames = [
            attr, 
            attr.toLowerCase(), 
            attr.charAt(0).toUpperCase() + attr.slice(1),
            attr.toUpperCase()
          ];
          for (var i = 0; i < attrNames.length; i++) {
            var name = attrNames[i];
            if (el.hasAttribute(name)) {
              return el.getAttribute(name);
            }
          }
          return '';
        };

        var comprobanteNode = getEl("Comprobante");
        var emisorNode = getEl("Emisor");
        var receptorNode = getEl("Receptor");
        var timbreNode = getEl("TimbreFiscalDigital");

        if (comprobanteNode) {
          data.versionCfdi = getAttr(comprobanteNode, "Version") || getAttr(comprobanteNode, "version") || '4.0';
          
          var tipo = getAttr(comprobanteNode, "TipoDeComprobante");
          var tipoMap = {
            'I': 'I - Ingreso',
            'E': 'E - Egreso',
            'T': 'T - Traslado',
            'P': 'P - Pago',
            'N': 'N - Nómina'
          };
          data.tipoComprobante = tipoMap[tipo] || tipo || 'I - Ingreso';

          data.fechaEmision = getAttr(comprobanteNode, "Fecha") || '';
          if (data.fechaEmision) {
            var datePart = data.fechaEmision.split('T')[0];
            var parts = datePart.split('-');
            if (parts.length === 3) {
              data.anoEmision = parts[0];
              data.mesEmision = parts[1];
              data.diaEmision = parts[2];
            }
          }

          data.serie = getAttr(comprobanteNode, "Serie") || 'N/A';
          data.folio = getAttr(comprobanteNode, "Folio") || 'N/A';

          var fp = getAttr(comprobanteNode, "FormaPago");
          var fpMap = {
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

          var mp = getAttr(comprobanteNode, "MetodoPago");
          var mpMap = {
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

        var isrRet = 0;
        var ivaRet = 0;
        var ivaTras = 0;
        var nsList = ["cfdi:", ""];

        for (var n = 0; n < nsList.length; n++) {
          var retencionNodes = xmlDoc.getElementsByTagName(nsList[n] + "Retencion");
          if (retencionNodes && retencionNodes.length > 0) {
            for (var i = 0; i < retencionNodes.length; i++) {
              var node = retencionNodes[i];
              var imp = node.getAttribute("Impuesto") || node.getAttribute("impuesto");
              var impVal = parseFloat(node.getAttribute("Importe") || node.getAttribute("importe") || 0);
              if (imp === "001") {
                isrRet += impVal;
              } else if (imp === "002") {
                ivaRet += impVal;
              }
            }
            break;
          }
        }

        for (var t = 0; t < nsList.length; t++) {
          var trasladoNodes = xmlDoc.getElementsByTagName(nsList[t] + "Traslado");
          if (trasladoNodes && trasladoNodes.length > 0) {
            for (var j = 0; j < trasladoNodes.length; j++) {
              var trNode = trasladoNodes[j];
              var trImp = trNode.getAttribute("Impuesto") || trNode.getAttribute("impuesto");
              var trImpVal = parseFloat(trNode.getAttribute("Importe") || trNode.getAttribute("importe") || 0);
              if (trImp === "002") {
                ivaTras += trImpVal;
              }
            }
            break;
          }
        }

        data.isrRetenido = isrRet;
        data.ivaRetenido = ivaRet;
        data.ivaTrasladado = ivaTras;
      } else {
        var getAttrRegex = function(tagPattern, attr) {
          var tagRegex = new RegExp('<[^>]*?' + tagPattern + '[^>]*?>', 'i');
          var tagMatch = xmlText.match(tagRegex);
          if (!tagMatch) return '';
          var tagStr = tagMatch[0];
          var attrRegex = new RegExp('\\b' + attr + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
          var attrMatch = tagStr.match(attrRegex);
          return attrMatch ? attrMatch[1] : '';
        };

        data.versionCfdi = getAttrRegex('(?:cfdi:)?Comprobante', 'Version') || '4.0';
        var tipoFallback = getAttrRegex('(?:cfdi:)?Comprobante', 'TipoDeComprobante');
        var tipoMapFallback = { 'I': 'I - Ingreso', 'E': 'E - Egreso', 'T': 'T - Traslado', 'P': 'P - Pago', 'N': 'N - Nómina' };
        data.tipoComprobante = tipoMapFallback[tipoFallback] || tipoFallback || 'I - Ingreso';

        data.fechaEmision = getAttrRegex('(?:cfdi:)?Comprobante', 'Fecha') || '';
        if (data.fechaEmision) {
          var partsFallback = data.fechaEmision.split('T')[0].split('-');
          if (partsFallback.length === 3) {
            data.anoEmision = partsFallback[0];
            data.mesEmision = partsFallback[1];
            data.diaEmision = partsFallback[2];
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

  function toggleSatAccordion(bodyId) {
    if (typeof document === 'undefined') return;
    var body = document.getElementById(bodyId);
    var iconId = bodyId.replace('body', 'icon');
    var icon = document.getElementById(iconId);
    
    if (body) {
      var isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      
      if (icon) {
        icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }

  function renderSatDetailsTable(satData, containerId) {
    if (typeof document === 'undefined') return;
    var container = document.getElementById(containerId);
    if (!container) return;

    var satLabels = {
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

    var formatMoney = function(val) {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    };

    var html = '<table style="width: 100%; border-collapse: collapse; text-align: left;"><tbody>';

    var idx = 0;
    for (var key in satLabels) {
      if (!Object.prototype.hasOwnProperty.call(satLabels, key)) continue;
      var label = satLabels[key];
      var val = satData[key];
      if (["subtotal", "descuento", "total", "isrRetenido", "ivaRetenido", "ivaTrasladado"].includes(key)) {
        val = formatMoney(parseFloat(val || 0));
      } else if (!val) {
        val = 'N/A';
      }

      var rowBg = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      var borderStyle = 'border-bottom: 1px solid var(--border);';
      
      html += '<tr style="background: ' + rowBg + '; ' + borderStyle + '">' +
        '<td style="padding: 0.4rem 0.5rem; font-weight: 600; color: var(--text-secondary); width: 40%; font-size: 0.72rem; border: none;">' + label + '</td>' +
        '<td style="padding: 0.4rem 0.5rem; color: var(--text-primary); font-size: 0.72rem; word-break: break-all; border: none; font-family: ' + (key === 'uuid' || key.includes('rfc') ? 'monospace' : 'inherit') + '">' + val + '</td>' +
      '</tr>';
      idx++;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Analiza el texto extraído de un PDF para buscar datos del SAT (RFC, UUID, Monto, Fecha)
  function analizarFacturaPdfTexto(text) {
    var cfg = _getConfigData();
    var defaultReceptorRfc = (cfg.rfc || 'ERE140718NY8').toUpperCase().trim();

    var data = {
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
    var versionRegex = /(?:Versión|Version)\s*(?:CFDI)?\s*:\s*([34]\.[03])/i;
    var versionMatch = text.match(versionRegex);
    if (versionMatch) {
      data.versionCfdi = versionMatch[1];
    }

    // 2. UUID
    var uuidRegex = /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/;
    var uuidMatch = text.match(uuidRegex);
    if (uuidMatch) {
      data.uuid = uuidMatch[1].toUpperCase();
    }

    // 3. RFCs (Emisor / Receptor)
    var rfcRegex = /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/gi;
    var rfcMatches = text.match(rfcRegex) || [];
    var uniqueRfcs = [];
    for (var i = 0; i < rfcMatches.length; i++) {
      var rUpper = rfcMatches[i].toUpperCase();
      if (uniqueRfcs.indexOf(rUpper) === -1) uniqueRfcs.push(rUpper);
    }
    
    var emisorRfc = uniqueRfcs.find(function(rfc) { return rfc !== defaultReceptorRfc; });
    if (emisorRfc) {
      data.rfcEmisor = emisorRfc;
    } else if (uniqueRfcs.length > 0) {
      data.rfcEmisor = uniqueRfcs[0];
    }
    
    data.rfcReceptor = defaultReceptorRfc;

    // 4. Nombre Emisor
    var emisorNombreRegex = /(?:Emisor|Nombre\s*(?:del)?\s*Emisor|Expedido\s*Por)\s*:\s*([^\n\r]+)/i;
    var emisorNombreMatch = text.match(emisorNombreRegex);
    if (emisorNombreMatch) {
      var name = emisorNombreMatch[1].trim();
      name = name.replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i, '').trim();
      name = name.replace(/(?:Régimen|Regimen)\s*(?:Fiscal)?\s*(?::)?\s*\d{3}\s*-\s*[^\n\r]+/i, '').trim();
      name = name.replace(/(?:Régimen|Regimen)\s*(?:Fiscal)?\s*(?::)?\s*[^\n\r]+/i, '').trim();
      name = name.replace(/\b(?:Régimen|Regimen|Fiscal|RFC|C\.P\.|Lugar\s*de)\b.*/i, '').trim();
      name = name.replace(/^[\s-:,]+|[\s-:,]+$/g, '').replace(/\s+/g, ' ').trim();
      data.nombreEmisor = name || emisorNombreMatch[1].trim();
    } else {
      var lowerText = text.toLowerCase();
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
        data.nombreEmisor = data.rfcEmisor ? ('PROVEEDOR: ' + data.rfcEmisor) : 'N/A';
      }
    }

    // 5. Total
    var detectedTotal = 0;
    var lines = text.split('\n');
    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      var lowerLine = line.toLowerCase();
      if (lowerLine.includes('impuesto') || lowerLine.includes('retenido') || lowerLine.includes('trasladado') || lowerLine.includes('letra') || lowerLine.includes('letras') || lowerLine.includes('ahorro')) {
        continue;
      }
      var totalLineRegex = /(?<!sub)\b(?:total|neto|pagar|importe|monto|total\s*factura)\b[^0-9$]{0,35}(?:\$)?\s*([0-9,]+\.\d{2})\b/i;
      var match = line.match(totalLineRegex);
      if (match) {
        var cleanNum = match[1].replace(/,/g, '');
        var val = parseFloat(cleanNum);
        if (!isNaN(val) && val > detectedTotal) {
          detectedTotal = val;
        }
      }
    }
    if (detectedTotal > 0) {
      data.total = detectedTotal;
    } else {
      var fallbackMatch = text.match(/(?<!sub)(?<!impuesto\s)(?<!impuestos\s)total\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i);
      if (fallbackMatch) {
        data.total = parseFloat(fallbackMatch[1].replace(/,/g, ''));
      }
    }

    // 6. Subtotal
    var subtotalRegex = /(?:subtotal|sub-total|sub\s*total)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
    var subtotalMatch = text.match(subtotalRegex);
    if (subtotalMatch) {
      var cleanSub = subtotalMatch[1].replace(/,/g, '');
      var subVal = parseFloat(cleanSub);
      if (!isNaN(subVal)) {
        data.subtotal = subVal;
      }
    } else {
      data.subtotal = parseFloat((data.total / 1.16).toFixed(2));
    }

    // 7. Descuento
    var descuentoRegex = /(?:descuento|rebaja)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
    var descuentoMatch = text.match(descuentoRegex);
    if (descuentoMatch) {
      var cleanDesc = descuentoMatch[1].replace(/,/g, '');
      var descVal = parseFloat(cleanDesc);
      if (!isNaN(descVal)) {
        data.descuento = descVal;
      }
    }

    // 8. Retenciones e IVA Trasladado
    var isrRegex = /(?:retención\s*isr|retencion\s*isr|isr\s*ret|isr\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
    var isrMatch = text.match(isrRegex);
    if (isrMatch) {
      var cleanIsr = isrMatch[1].replace(/,/g, '');
      var isrVal = parseFloat(cleanIsr);
      if (!isNaN(isrVal)) {
        data.isrRetenido = isrVal;
      }
    }

    var ivaRetRegex = /(?:retención\s*iva|retencion\s*iva|iva\s*ret|iva\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
    var ivaRetMatch = text.match(ivaRetRegex);
    if (ivaRetMatch) {
      var cleanIvaRet = ivaRetMatch[1].replace(/,/g, '');
      var ivaRetVal = parseFloat(cleanIvaRet);
      if (!isNaN(ivaRetVal)) {
        data.ivaRetenido = ivaRetVal;
      }
    }

    var ivaRegexes = [
      /(?:iva\s*16%|iva\s*trasladado|impuesto\s*iva|i\.v\.a\.)\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i,
      /IVA\s*(?::)?\s*(?:\$)?\s*([0-9,]+\.\d{2})\b/i
    ];
    var ivaTrasFound = 0;
    for (var r = 0; r < ivaRegexes.length; r++) {
      var rx = ivaRegexes[r];
      var matches = text.match(new RegExp(rx.source, 'gi')) || [];
      for (var mIdx = 0; mIdx < matches.length; mIdx++) {
        var mStr = matches[mIdx];
        if (mStr.toLowerCase().includes('retencion') || mStr.toLowerCase().includes('retenido')) continue;
        var singleMatch = mStr.match(rx);
        if (singleMatch) {
          var cleanIva = singleMatch[1].replace(/,/g, '');
          var parsedIva = parseFloat(cleanIva);
          if (!isNaN(parsedIva) && parsedIva > 0) {
            ivaTrasFound = parsedIva;
            break;
          }
        }
      }
      if (ivaTrasFound > 0) break;
    }
    data.ivaTrasladado = ivaTrasFound || parseFloat((data.subtotal * 0.16).toFixed(2));

    // 9. Fecha Emision
    var dateRegex = /\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/;
    var dateMatch = text.match(dateRegex);
    if (dateMatch) {
      var rawDate = dateMatch[0];
      if (rawDate.includes('/')) {
        var dParts = rawDate.split('/');
        if (dParts.length === 3) {
          rawDate = dParts[2] + '-' + dParts[1] + '-' + dParts[0];
        }
      }
      data.fechaEmision = rawDate;
      
      var dtParts = rawDate.split('-');
      if (dtParts.length === 3) {
        data.anoEmision = dtParts[0];
        data.mesEmision = dtParts[1];
        data.diaEmision = dtParts[2];
      }
    }

    // 10. Fecha Timbrado
    var timbreDateRegex = /(?:fecha\s*(?:de)?\s*(?:certificación|timbrado))\s*(?::)?\s*([\d\-\/T:\s]+)/i;
    var timbreDateMatch = text.match(timbreDateRegex);
    if (timbreDateMatch) {
      var dateText = timbreDateMatch[1].trim().match(/\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/);
      if (dateText) {
        var rawTDate = dateText[0];
        if (rawTDate.includes('/')) {
          var tParts = rawTDate.split('/');
          if (tParts.length === 3) {
            rawTDate = tParts[2] + '-' + tParts[1] + '-' + tParts[0];
          }
        }
        data.fechaTimbrado = rawTDate;
      }
    }
    if (!data.fechaTimbrado) {
      data.fechaTimbrado = data.fechaEmision;
    }

    // 11. Serie & Folio
    var serieRegex = /(?:serie)\s*:\s*([A-Za-z0-9\-]+)/i;
    var serieMatch = text.match(serieRegex);
    if (serieMatch) {
      data.serie = serieMatch[1].toUpperCase();
    }
    
    var folioRegex = /(?:folio|factura|invoice\s*no)\s*(?::)?\s*([0-9\-]+)/i;
    var folioMatch = text.match(folioRegex);
    if (folioMatch) {
      data.folio = folioMatch[1];
    }

    // 12. Tipo de Comprobante
    var tipoRegex = /(?:tipo\s*(?:de)?\s*comprobante)\s*(?::)?\s*([A-Za-z]+)/i;
    var tMatch = text.match(tipoRegex);
    if (tMatch) {
      var compType = tMatch[1].toLowerCase();
      if (compType.includes('ingreso')) data.tipoComprobante = 'I - Ingreso';
      else if (compType.includes('egreso')) data.tipoComprobante = 'E - Egreso';
      else if (compType.includes('traslado')) data.tipoComprobante = 'T - Traslado';
      else if (compType.includes('pago')) data.tipoComprobante = 'P - Pago';
      else if (compType.includes('nómina') || compType.includes('nomina')) data.tipoComprobante = 'N - Nómina';
    }

    // 13. Moneda
    var currency = 'MXN';
    var curRegex = /(?:moneda|currency)\s*(?::)?\s*\b([A-Z]{3})\b/i;
    var curMatch = text.match(curRegex);
    if (curMatch) {
      var curVal = curMatch[1].toUpperCase();
      if (curVal === 'MXN' || curVal === 'USD' || curVal === 'EUR') {
        currency = curVal;
      }
    } else {
      if (/\b(?:usd|dolar|dólar|dollar|dollars)\b/i.test(text)) {
        currency = 'USD';
      } else if (/\b(?:eur|euro|euros)\b/i.test(text)) {
        currency = 'EUR';
      } else if (/\b(?:mxn|peso|pesos|m\.n\.)\b/i.test(text)) {
        currency = 'MXN';
      }
    }
    data.moneda = currency;
    
    var tcRegex = /(?:tipo\s*(?:de)?\s*cambio)\s*(?::)?\s*([0-9\.]+)/i;
    var tcMatch = text.match(tcRegex);
    if (tcMatch) {
      data.tipoCambio = tcMatch[1];
    }

    // 14. Forma & Metodo Pago
    var fpRegex = /(?:forma\s*(?:de)?\s*pago)\s*(?::)?\s*([^\n\r]+)/i;
    var fpMatch = text.match(fpRegex);
    if (fpMatch) {
      var fpStr = fpMatch[1].toLowerCase();
      if (fpStr.includes('efectivo')) data.formaPago = '01 - Efectivo';
      else if (fpStr.includes('cheque')) data.formaPago = '02 - Cheque nominativo';
      else if (fpStr.includes('transferencia')) data.formaPago = '03 - Transferencia electrónica de fondos';
      else if (fpStr.includes('tarjeta') && fpStr.includes('crédito')) data.formaPago = '04 - Tarjeta de crédito';
      else if (fpStr.includes('tarjeta') && fpStr.includes('débito')) data.formaPago = '28 - Tarjeta de débito';
    }
    
    var mpRegex = /(?:método|metodo\s*(?:de)?\s*pago)\s*(?::)?\s*(PUE|PPD|[^\n\r]+)/i;
    var mpMatch = text.match(mpRegex);
    if (mpMatch) {
      var mpStr = mpMatch[1].toUpperCase();
      if (mpStr.includes('PUE') || mpStr.includes('SOLA EXHIBICIÓN') || mpStr.includes('SOLA EXHIBICION')) {
        data.metodoPago = 'PUE - Pago en una sola exhibición';
      } else if (mpStr.includes('PPD') || mpStr.includes('PARCIALIDADES')) {
        data.metodoPago = 'PPD - Pago en parcialidades o diferido';
      }
    }

    // 15. Condiciones
    var condRegex = /(?:condiciones\s*(?:de)?\s*pago)\s*(?::)?\s*([^\n\r]+)/i;
    var condMatch = text.match(condRegex);
    if (condMatch) {
      data.condicionesPago = condMatch[1].trim();
    }

    data.rfc = data.rfcEmisor;
    data.monto = data.total;
    data.date = data.fechaEmision;

    return data;
  }

  // Helper central de procesamiento de PDF
  function procesarPdfFacturaExtraida(name, base64Data) {
    if (typeof global !== 'undefined') {
      global._gastoPdfBase64 = base64Data;
      if (!global._gastoUploadedFiles) global._gastoUploadedFiles = [];
      
      global._gastoUploadedFiles = global._gastoUploadedFiles.filter(function(x) { return x.type !== 'pdf'; });
      global._gastoUploadedFiles.push({
        type: 'pdf',
        base64: base64Data,
        name: name
      });

      if (typeof global.renderUploaderSidebar === 'function') {
        global.renderUploaderSidebar();
      }
    }
    
    var pdfjs = (typeof global !== 'undefined' && global.pdfjsLib) ? global.pdfjsLib : (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);

    if (pdfjs) {
      _notify('Analizando factura PDF y extrayendo datos...', 'info');
      extraerFacturaSatNube('pdf', base64Data)
        .then(function(satData) {
          if (typeof global !== 'undefined') {
            global._gastoSatData = satData;
          }
          var dataFound = false;
          
          if (typeof document !== 'undefined') {
            var rfcVal = satData.rfcEmisor || satData.rfc;
            if (rfcVal) {
              var rfcInput = document.getElementById('gasto-rfc-emisor');
              if (rfcInput) {
                rfcInput.value = rfcVal;
                dataFound = true;
              }
            }
            if (satData.uuid) {
              var uuidInput = document.getElementById('gasto-uuid-fiscal');
              if (uuidInput) {
                uuidInput.value = satData.uuid;
                dataFound = true;
              }
            }
            var fechaVal = satData.fechaEmision || satData.date;
            if (fechaVal) {
              var fechaInput = document.getElementById('gasto-fecha');
              if (fechaInput) {
                fechaInput.value = fechaVal ? fechaVal.split('T')[0] : '';
                dataFound = true;
              }
            }
            var totalVal = satData.total || satData.monto;
            if (totalVal > 0) {
              var montoInput = document.getElementById('gasto-monto');
              if (montoInput && (!montoInput.value || parseFloat(montoInput.value) === 0)) {
                montoInput.value = totalVal;
                dataFound = true;
                
                var amountEl = document.getElementById('gasto-header-monto');
                if (amountEl) {
                  amountEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalVal);
                }
              }
            }
            
            var accordion = document.getElementById('gasto-sat-details-accordion');
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
          
          if (typeof global !== 'undefined' && typeof global.actualizarChecklistRevisar === 'function') {
            global.actualizarChecklistRevisar();
          }
        })
        .catch(function(err) {
          console.error('Error al parsear el PDF:', err);
          _notify('PDF cargado, pero no se pudo extraer el texto', 'warning');
        });
    } else {
      _notify('Factura PDF importada exitosamente', 'success');
    }
  }

  // ── VISOR DE PDF Y FICHA SAT 26 CAMPOS ────────────────────────────────────
  async function visualizarPdfBase64(base64, name) {
    if (!base64) return;

    if (typeof global !== 'undefined' && typeof global.trackTelemetryEvent === 'function') {
      global.trackTelemetryEvent('Visor PDF SAT', { archivo: name || 'documento.pdf' });
    }

    if (typeof document === 'undefined') return;

    var modal = document.getElementById('modal-pdf-visor');
    var title = document.getElementById('pdf-visor-title');
    var frame = document.getElementById('pdf-visor-frame');
    var downloadLink = document.getElementById('pdf-visor-download-link');
    var errorBox = document.getElementById('pdf-visor-error');
    var satBody = document.getElementById('pdf-visor-sat-body');

    if (!modal) return;

    if (title) title.textContent = name || 'Visor de PDF';

    var localBase64 = await ensureBase64FromStorageUrl(base64);

    if (frame) frame.src = localBase64;
    if (downloadLink) {
      downloadLink.href = localBase64;
      downloadLink.download = name || 'documento.pdf';
    }
    
    modal.style.display = 'flex';
    if (errorBox) errorBox.style.display = 'none';
    if (frame) frame.style.display = 'block';

    if (satBody) {
      satBody.innerHTML = '\n' +
        '<div style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.5rem; justify-content:center;">\n' +
        '  <i data-lucide="loader" class="animate-spin" style="width:24px; height:24px; color:var(--accent);"></i>\n' +
        '  <span>Analizando contenido del PDF y extrayendo Ficha SAT...</span>\n' +
        '</div>\n';
      _renderIcons();
    }

    extraerFacturaSatNube('pdf', localBase64)
      .then(function(satData) {
        renderSatDetailsTable(satData, 'pdf-visor-sat-body');
      })
      .catch(function() {
        var baseName = (name || '').substring(0, (name || '').lastIndexOf('.'));
        var cleanBaseName = baseName.replace(/^(factura|Factura)_/, '');
        var uuidMatch = (name || '').match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
        var uuid = uuidMatch ? uuidMatch[1] : null;
        var sb = _getSb();

        if (sb) {
          var buscarDatosSat = async function() {
            if (uuid) {
              var r1 = await sb.from('facturas_analizadas').select('*').eq('uuid', uuid);
              if (!r1.error && r1.data && r1.data.length > 0) {
                var m1 = r1.data.find(function(x) { return x.uuid || x.rfc_emisor; });
                if (m1) return m1;
              }
            }

            if (uuid) {
              var r2 = await sb.from('facturas_conciliadas').select('*').eq('uuid', uuid);
              if (!r2.error && r2.data && r2.data.length > 0) {
                var m2 = r2.data.find(function(x) { return x.uuid || x.rfc_emisor; });
                if (m2) return m2;
              }
            }

            var r3 = await sb.from('facturas_analizadas')
              .select('*')
              .or('file_name.ilike.%' + cleanBaseName + '%,file_name.ilike.%' + baseName + '%');
            if (!r3.error && r3.data && r3.data.length > 0) {
              var m3 = r3.data.find(function(x) { return x.uuid || x.rfc_emisor; });
              if (m3) return m3;
            }

            var r4 = await sb.from('facturas_conciliadas')
              .select('*')
              .or('file_name.ilike.%' + cleanBaseName + '%,file_name.ilike.%' + baseName + '%');
            if (!r4.error && r4.data && r4.data.length > 0) {
              var m4 = r4.data.find(function(x) { return x.uuid || x.rfc_emisor; });
              if (m4) return m4;
            }

            return null;
          };

          buscarDatosSat()
            .then(function(matched) {
              if (matched) {
                var satData = {
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
            .catch(function() { mostrarFalloSat(); });
        } else {
          mostrarFalloSat();
        }
      });

    function mostrarFalloSat() {
      if (!satBody) return;
      satBody.innerHTML = '\n' +
        '<div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); padding:1.25rem; border-radius:8px; color:var(--red); text-align:center; display:flex; flex-direction:column; align-items:center; gap:0.4rem; justify-content:center;">\n' +
        '  <i data-lucide="alert-triangle" style="width:24px; height:24px;"></i>\n' +
        '  <strong style="font-size:0.8rem;">Ficha SAT no disponible</strong>\n' +
        '  <div style="font-size:0.68rem; opacity:0.8; max-width:250px;">El PDF no contiene texto legible (imagen escaneada o formato no compatible).</div>\n' +
        '</div>\n';
      _renderIcons();
    }
  }

  function abrirPdfVisor(name) {
    if (typeof global === 'undefined' || !global._gastoUploadedFiles) return;
    var file = global._gastoUploadedFiles.find(function(x) { return x.type === 'pdf' && x.name === name; });
    if (!file) {
      _notify('Archivo PDF no encontrado en caché', 'error');
      return;
    }
    visualizarPdfBase64(file.base64, file.name);
  }

  function cerrarPdfVisor() {
    if (typeof document !== 'undefined') {
      var modal = document.getElementById('modal-pdf-visor');
      var frame = document.getElementById('pdf-visor-frame');
      if (modal) modal.style.display = 'none';
      if (frame) frame.src = '';
    }
  }

  // Bindeo global en window
  if (typeof global !== 'undefined') {
    global.onedriveMockDb = onedriveMockDb;
    global.cargarSdkOneDrive = cargarSdkOneDrive;
    global.formatBytes = formatBytes;
    global.abrirOneDrivePicker = abrirOneDrivePicker;
    global.abrirOneDrivePickerConToken = abrirOneDrivePickerConToken;
    global.cerrarOneDrivePicker = cerrarOneDrivePicker;
    global.navegarOneDriveReal = navegarOneDriveReal;
    global.navegarOneDriveSimulado = navegarOneDriveSimulado;
    global.actualizarBreadcrumbsOneDrive = actualizarBreadcrumbsOneDrive;
    global.filtrarOneDriveSimulado = filtrarOneDriveSimulado;
    global.renderOneDriveFiles = renderOneDriveFiles;
    global.seleccionarElementoOneDrive = seleccionarElementoOneDrive;
    global.confirmarImportacionOneDrive = confirmarImportacionOneDrive;
    global.procesarDescargaRealOneDrive = procesarDescargaRealOneDrive;
    global.procesarArchivoImportadoOneDrive = procesarArchivoImportadoOneDrive;
    global.extraerFacturaSatNube = extraerFacturaSatNube;
    global.extraerTextoPdf = extraerTextoPdf;
    global.decodificarXmlBase64 = decodificarXmlBase64;
    global.ensureBase64FromStorageUrl = ensureBase64FromStorageUrl;
    global.getXmlTextFromUrlOrBase64 = getXmlTextFromUrlOrBase64;
    global.extraerDatosCompletosXml = extraerDatosCompletosXml;
    global.toggleSatAccordion = toggleSatAccordion;
    global.renderSatDetailsTable = renderSatDetailsTable;
    global.analizarFacturaPdfTexto = analizarFacturaPdfTexto;
    global.procesarPdfFacturaExtraida = procesarPdfFacturaExtraida;
    global.visualizarPdfBase64 = visualizarPdfBase64;
    global.abrirPdfVisor = abrirPdfVisor;
    global.cerrarPdfVisor = cerrarPdfVisor;
  }

})(typeof window !== 'undefined' ? window : globalThis);
