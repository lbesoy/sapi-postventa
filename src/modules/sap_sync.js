/**
 * Módulo de Integración y Sincronización SAP Business One - Eurorep / SAPI
 * Gestiona catálogos maestros (clientes, refacciones, técnicos, sitios, maquinaria),
 * consultas hacia el backend/túnel SAP, validación y sincronización de cotizaciones y pedidos,
 * extracción OCR/IA de PDFs y componentes UI asociados.
 */

import { supabaseClient } from "../supabaseClient.js";

// Configuración de API SAP
const API_CONFIG = {
  USE_SAP_BACKEND: true,
  BASE_URL: 'https://eurorep-api.onrender.com/api',
  // URL del backend local expuesto via Cloudflare Tunnel
  LOCAL_URL: typeof localStorage !== 'undefined' ? (localStorage.getItem('eurorep_local_api_url') || null) : null
};

// Helpers de acceso seguro
function _getSb() {
  if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
  return supabaseClient;
}

function _getConfigData() {
  if (typeof configData !== 'undefined' && configData) return configData;
  if (typeof window !== 'undefined' && window.configData) return window.configData;
  return {};
}

function _getClientesDb() {
  if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) return clientesDb;
  if (typeof window !== 'undefined' && Array.isArray(window.clientesDb)) return window.clientesDb;
  return [];
}

function _setClientesDb(val) {
  if (typeof clientesDb !== 'undefined') clientesDb = val;
  if (typeof window !== 'undefined') window.clientesDb = val;
}

function _getRefaccionesDb() {
  if (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb)) return refaccionesDb;
  if (typeof window !== 'undefined' && Array.isArray(window.refaccionesDb)) return window.refaccionesDb;
  return [];
}

function _setRefaccionesDb(val) {
  if (typeof refaccionesDb !== 'undefined') refaccionesDb = val;
  if (typeof window !== 'undefined') window.refaccionesDb = val;
}

function _getTecnicosDb() {
  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) return tecnicosDb;
  if (typeof window !== 'undefined' && Array.isArray(window.tecnicosDb)) return window.tecnicosDb;
  return [];
}

function _setTecnicosDb(val) {
  if (typeof tecnicosDb !== 'undefined') tecnicosDb = val;
  if (typeof window !== 'undefined') window.tecnicosDb = val;
}

function _getSitiosDb() {
  if (typeof sitiosDb !== 'undefined' && Array.isArray(sitiosDb)) return sitiosDb;
  if (typeof window !== 'undefined' && Array.isArray(window.sitiosDb)) return window.sitiosDb;
  return [];
}

function _setSitiosDb(val) {
  if (typeof sitiosDb !== 'undefined') sitiosDb = val;
  if (typeof window !== 'undefined') window.sitiosDb = val;
}

function _getMaquinariaDb() {
  if (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) return maquinariaDb;
  if (typeof window !== 'undefined' && Array.isArray(window.maquinariaDb)) return window.maquinariaDb;
  return [];
}

function _setMaquinariaDb(val) {
  if (typeof maquinariaDb !== 'undefined') maquinariaDb = val;
  if (typeof window !== 'undefined') window.maquinariaDb = val;
}

function _getTickets() {
  if (typeof tickets !== 'undefined' && Array.isArray(tickets)) return tickets;
  if (typeof window !== 'undefined' && Array.isArray(window.tickets)) return window.tickets;
  return [];
}

function _notify(msg, tipo = 'info') {
  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(msg, tipo);
  } else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
    window.mostrarNotificacion(msg, tipo);
  } else {
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
  }
}

// ==========================================
// 1. CLIENTE Y COMUNICACIÓN SAP API
// ==========================================

async function fetchSapApi(endpoint, options = {}) {
  const localUrl = API_CONFIG.LOCAL_URL;
  if (localUrl) {
    try {
      const url = `${localUrl}${endpoint}`;
      let opt = { ...options };
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        opt.signal = controller.signal;
        const res = await fetch(url, opt);
        clearTimeout(timeoutId);
        if (res.ok) return res;
      } else {
        const res = await fetch(url, opt);
        if (res.ok) return res;
      }
    } catch (e) {
      console.warn(`Local SAP API failed for ${endpoint}:`, e.message);
    }
  }
  
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  return fetch(url, options);
}

async function fetchClientesSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return _getClientesDb();
  
  try {
    const cfg = _getConfigData();
    let path = `/clientes`;
    if (cfg && cfg.queryClientes) {
      path += `?queryCode=${encodeURIComponent(cfg.queryClientes)}`;
    }
    const response = await fetchSapApi(path);
    const sapData = await response.json();
    
    if (!response.ok || !Array.isArray(sapData)) {
      const errMsg = sapData?.error || sapData?.message || `Error del servidor: ${response.status}`;
      throw new Error(errMsg);
    }
    
    const map = (cfg.mappings && cfg.mappings.clientes) ? cfg.mappings.clientes : {
      id: 'CardCode', nombre: 'CardName', rfc: 'LicTradNum', email: 'E_Mail', grupoSinergia: 'U_OK_Grupo', saldoCuenta: 'Balance'
    };

    const clientesMapeados = sapData.map(bp => {
      const clienteObj = {
        id: bp[map.id] || '',
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
        maquinas: [],
        supervisoresAsignados: [],
        tecnicosAsignados: []
      };

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
    _notify(`⚠️ SAP: ${error.message}`, 'warning');
    return null;
  }
}

async function fetchRefaccionesSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return _getRefaccionesDb();
  
  try {
    const cfg = _getConfigData();
    if (!cfg || !cfg.queryRefacciones) {
      return _getRefaccionesDb();
    }

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
      const marcaRes = await fetchSapApi(`/sap/udo/OK_MARCA`);
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

    const path = `/sap/queries/${encodeURIComponent(cfg.queryRefacciones)}/execute?_t=${Date.now()}`;
    const response = await fetchSapApi(path);
    const jsonRes = await response.json();
    const sapData = jsonRes.data || [];
    
    const map = (cfg.mappings && cfg.mappings.refacciones) ? cfg.mappings.refacciones : {
      id: 'ItemCode', nombre: 'ItemName', grupo: 'ItmsGrpNam', precio: 'Price', stock: 'OnHand', origen: 'Origen'
    };

    const refaccionesMapeadas = sapData.map(item => {
      const idInternoVal = item[map.id] || item.ItemCode || '';
      
      const marcaCodigo = (item.U_MARCA || item.MarcaCode || '').trim().toUpperCase();
      const marcaNombre = item.Name || marcaMap[marcaCodigo] || (marcaCodigo || 'N/A');

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
    return _getRefaccionesDb();
  }
}

async function fetchTecnicosSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return _getTecnicosDb();
  
  try {
    const path = `/tecnicos?_t=${Date.now()}`;
    const response = await fetchSapApi(path);
    if (!response.ok) return _getTecnicosDb();
    const sapData = await response.json();
    
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
    return _getTecnicosDb();
  }
}

async function fetchSitiosSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return _getSitiosDb();
  const cfg = _getConfigData();
  if (!cfg || !cfg.querySitios) return _getSitiosDb();
  
  try {
    const queryCode = encodeURIComponent(cfg.querySitios);
    const path = `/sap/queries/${queryCode}/execute?_t=${Date.now()}`;
    const response = await fetchSapApi(path);
    if (!response.ok) return _getSitiosDb();
    const jsonRes = await response.json();
    const sapData = jsonRes.data || (Array.isArray(jsonRes) ? jsonRes : []);
    
    const map = (cfg.mappings && cfg.mappings.sitios) ? cfg.mappings.sitios : {
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
    return _getSitiosDb();
  }
}

async function fetchMaquinariaSAP() {
  if (!API_CONFIG.USE_SAP_BACKEND) return _getMaquinariaDb();
  const cfg = _getConfigData();
  if (!cfg || !cfg.queryMaquinaria) return _getMaquinariaDb();
  
  try {
    const queryCode = encodeURIComponent(cfg.queryMaquinaria);
    const path = `/sap/queries/${queryCode}/execute?_t=${Date.now()}`;
    const response = await fetchSapApi(path);
    if (!response.ok) return _getMaquinariaDb();
    const jsonRes = await response.json();
    const sapData = jsonRes.data || (Array.isArray(jsonRes) ? jsonRes : []);
    
    const map = (cfg.mappings && cfg.mappings.maquinaria) ? cfg.mappings.maquinaria : {
      id: 'ManufacturerSerialNum', itemcode: 'ItemCode', desc: 'ItemDescription', cliente: 'CustomerCode'
    };
    
    const maquinariaMapeada = sapData.map(m => {
      const maqObj = {
        serie: m[map.id] || '',
        marca: '',
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
    return _getMaquinariaDb();
  }
}

// ==========================================
// 2. SINCRONIZACIÓN DE CATÁLOGOS SAP
// ==========================================

let hasSyncedSAPThisSession = false;
let isSincronizandoSAP = false;
const _syncingModules = {};

async function forzarSincronizacionSAP() {
  if (isSincronizandoSAP) return;
  
  const icons = typeof document !== 'undefined' ? document.querySelectorAll('.icon-sync-sap') : [];
  icons.forEach(i => i.classList.add('rotating'));
  isSincronizandoSAP = true;
  
  try {
    const currentCli = _getClientesDb();
    const newDataCli = await fetchClientesSAP();
    if (newDataCli) {
      newDataCli.forEach(newCli => {
        const oldCli = currentCli.find(c => c.nombre === newCli.nombre || c.id === newCli.id);
        if (oldCli) {
          if (oldCli.maquinas) newCli.maquinas = oldCli.maquinas;
          if (oldCli.sitios) newCli.sitios = oldCli.sitios;
          if (oldCli.contactos) newCli.contactos = oldCli.contactos;
          if (oldCli.logo) newCli.logo = oldCli.logo;
        }
      });
      currentCli.forEach(oldCli => {
        if (!newDataCli.some(nc => nc.nombre === oldCli.nombre || nc.id === oldCli.id)) {
          newDataCli.push(oldCli);
        }
      });
      _setClientesDb(newDataCli);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sapi_clientes_db', JSON.stringify(newDataCli));
      }
      if (typeof window !== 'undefined' && window.pushToSupabase) {
        for (const c of newDataCli) window.pushToSupabase('clientes', c);
      }
      hasSyncedSAPThisSession = true;
    } else {
      _notify('⚠️ Fallo al sincronizar clientes con SAP.', 'error');
    }

    const newDataRef = await fetchRefaccionesSAP();
    if (newDataRef && newDataRef.length > 0) {
      _setRefaccionesDb(newDataRef);
      if (typeof window !== 'undefined' && typeof window.saveRefaccionesLocal === 'function') {
        await window.saveRefaccionesLocal(newDataRef);
      }
      if (typeof window !== 'undefined' && window.pushToSupabase) {
        for (const r of newDataRef) {
          if (r.id) window.pushToSupabase('refacciones', r);
        }
      }
    }
    
    const newDataTec = await fetchTecnicosSAP();
    if (newDataTec && newDataTec.length > 0) {
      _setTecnicosDb(newDataTec);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sapi_tecnicos_db', JSON.stringify(newDataTec));
      }
    }
    
    const newDataSitios = await fetchSitiosSAP();
    if (newDataSitios && newDataSitios.length > 0) {
      _setSitiosDb(newDataSitios);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sapi_sitios_db', JSON.stringify(newDataSitios));
      }
      if (typeof window !== 'undefined' && window.pushToSupabase) {
        for (const s of newDataSitios) if (s.id) window.pushToSupabase('sitios', s);
      }
    }
    
    const newDataMaquinaria = await fetchMaquinariaSAP();
    if (newDataMaquinaria && newDataMaquinaria.length > 0) {
      _setMaquinariaDb(newDataMaquinaria);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sapi_maquinaria_db', JSON.stringify(newDataMaquinaria));
      }
      if (typeof window !== 'undefined' && window.pushToSupabase) {
        for (const m of newDataMaquinaria) if (m.id) window.pushToSupabase('maquinaria', m);
      }
    }
    
    _notify('✅ Catálogos sincronizados con SAP y guardados en la nube.', 'success');
  } catch (error) {
    console.error("Error SAP:", error);
    _notify('⚠️ Error al conectar con SAP B1. Usando caché de Supabase.', 'error');
  } finally {
    isSincronizandoSAP = false;
    icons.forEach(i => i.classList.remove('rotating'));
    if (typeof renderClientes === 'function') renderClientes();
    else if (typeof window !== 'undefined' && typeof window.renderClientes === 'function') window.renderClientes();
    if (typeof window !== 'undefined' && typeof window.renderRefacciones === 'function') window.renderRefacciones();
    else if (typeof renderRefacciones === 'function') renderRefacciones();
    if (typeof renderTecnicos === 'function') renderTecnicos();
    else if (typeof window !== 'undefined' && typeof window.renderTecnicos === 'function') window.renderTecnicos();
    if (typeof renderSitios === 'function') renderSitios();
    else if (typeof window !== 'undefined' && typeof window.renderSitios === 'function') window.renderSitios();
    if (typeof renderMaquinaria === 'function') renderMaquinaria();
    else if (typeof window !== 'undefined' && typeof window.renderMaquinaria === 'function') window.renderMaquinaria();
    if (typeof renderUsuariosList === 'function') renderUsuariosList();
    else if (typeof window !== 'undefined' && typeof window.renderUsuariosList === 'function') window.renderUsuariosList();
  }
}

async function sincronizarModuloSAP(modulo, btnEl) {
  if (_syncingModules[modulo]) return;
  _syncingModules[modulo] = true;
  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Sincronizando SAP...';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  const localUrl = API_CONFIG.LOCAL_URL;
  if (localUrl) {
    try {
      _notify(`⏳ Conectando a SAP vía servidor local...`, 'info');
      const resp = await fetch(`${localUrl}/sync-all?modulo=${modulo}`, { signal: AbortSignal.timeout(90000) });
      if (resp.ok) {
        const result = await resp.json();
        if (typeof window !== 'undefined' && window.cargarDatosDeSupabase) {
          await window.cargarDatosDeSupabase();
        }
        const total = result[modulo] || 0;
        _notify(`✅ ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}: ${total} registros actualizados desde SAP.`, 'success');
        _syncingModules[modulo] = false;
        if (btnEl) { btnEl.innerHTML = origHTML; if (typeof lucide !== 'undefined') lucide.createIcons(); }
        return;
      }
    } catch (localErr) {
      console.warn('Backend local no disponible, usando método directo:', localErr.message);
    }
  }

  try {
    if (modulo === 'clientes') {
      const currentCli = _getClientesDb();
      const data = await fetchClientesSAP();
      if (data && data.length > 0) {
        data.forEach(nc => {
          const old = currentCli.find(c => c.id === nc.id || c.nombre === nc.nombre);
          if (old) { if (old.maquinas) nc.maquinas = old.maquinas; if (old.logo) nc.logo = old.logo; }
        });
        currentCli.forEach(old => { if (!data.some(nc => nc.id === old.id || nc.nombre === old.nombre)) data.push(old); });
        _setClientesDb(data);
        if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_clientes_db', JSON.stringify(data));
        if (typeof window !== 'undefined' && window.pushToSupabase) for (const c of data) window.pushToSupabase('clientes', c);
        if (typeof renderClientes === 'function') renderClientes();
        else if (typeof window !== 'undefined' && typeof window.renderClientes === 'function') window.renderClientes();
        _notify(`✅ Clientes actualizados (${data.length} registros) y guardados en la nube.`, 'success');
      }
    } else if (modulo === 'refacciones') {
      const data = await fetchRefaccionesSAP();
      if (data && data.length > 0) {
        _setRefaccionesDb(data);
        if (typeof window !== 'undefined' && typeof window.saveRefaccionesLocal === 'function') {
          await window.saveRefaccionesLocal(data);
        }
        if (typeof window !== 'undefined' && window.pushToSupabase) for (const r of data) if (r.id) window.pushToSupabase('refacciones', r);
        if (typeof window !== 'undefined' && typeof window.renderRefacciones === 'function') window.renderRefacciones();
        else if (typeof renderRefacciones === 'function') renderRefacciones();
        _notify(`✅ Refacciones actualizadas (${data.length} registros) y guardadas en la nube.`, 'success');
      }
    } else if (modulo === 'maquinaria') {
      const data = await fetchMaquinariaSAP();
      if (data && data.length > 0) {
        _setMaquinariaDb(data);
        if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_maquinaria_db', JSON.stringify(data));
        if (typeof window !== 'undefined' && window.pushToSupabase) for (const m of data) if (m.id) window.pushToSupabase('maquinaria', m);
        if (typeof renderMaquinaria === 'function') renderMaquinaria();
        else if (typeof window !== 'undefined' && typeof window.renderMaquinaria === 'function') window.renderMaquinaria();
        _notify(`✅ Maquinaria actualizada (${data.length} registros) y guardada en la nube.`, 'success');
      }
    } else if (modulo === 'sitios') {
      const data = await fetchSitiosSAP();
      if (data && data.length > 0) {
        _setSitiosDb(data);
        if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_sitios_db', JSON.stringify(data));
        if (typeof window !== 'undefined' && window.pushToSupabase) for (const s of data) if (s.id) window.pushToSupabase('sitios', s);
        if (typeof renderSitios === 'function') renderSitios();
        else if (typeof window !== 'undefined' && typeof window.renderSitios === 'function') window.renderSitios();
        _notify(`✅ Sitios actualizados (${data.length} registros) y guardados en la nube.`, 'success');
      }
    } else if (modulo === 'tecnicos') {
      const data = await fetchTecnicosSAP();
      if (data && data.length > 0) {
        _setTecnicosDb(data);
        if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_tecnicos_db', JSON.stringify(data));
        if (typeof renderUsuariosList === 'function') renderUsuariosList();
        else if (typeof window !== 'undefined' && typeof window.renderUsuariosList === 'function') window.renderUsuariosList();
        _notify(`✅ Técnicos actualizados (${data.length} registros).`, 'success');
      }
    }
  } catch (err) {
    _notify(`⚠️ No se pudo actualizar ${modulo} desde SAP. Usando caché de Supabase.`, 'error');
  } finally {
    _syncingModules[modulo] = false;
    if (btnEl) { btnEl.innerHTML = origHTML; if (typeof lucide !== 'undefined') lucide.createIcons(); }
  }
}

async function sincronizarUnCliente() {
  const clientName = (typeof currentViewClientName !== 'undefined' && currentViewClientName)
    ? currentViewClientName
    : (typeof window !== 'undefined' ? window.currentViewClientName : '');

  if (!clientName) return;
  const icon = typeof document !== 'undefined' ? document.getElementById('icon-sync-single') : null;
  if (icon) icon.classList.add('rotating');
  
  try {
    const newData = await fetchClientesSAP();
    if (newData && newData.length > 0) {
      _setClientesDb(newData);
      if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_clientes_db', JSON.stringify(newData));
      _notify('Datos del cliente actualizados desde SAP.', 'success');
      if (typeof verDetalleCliente === 'function') verDetalleCliente(clientName);
      else if (typeof window !== 'undefined' && typeof window.verDetalleCliente === 'function') window.verDetalleCliente(clientName);
      if (typeof renderClientes === 'function') renderClientes();
      else if (typeof window !== 'undefined' && typeof window.renderClientes === 'function') window.renderClientes();
    }
  } catch (error) {
    console.error("Error SAP single:", error);
    _notify('Error al actualizar desde SAP B1.', 'error');
  } finally {
    if (icon) icon.classList.remove('rotating');
  }
}

// Sincronización en GitHub Actions / Serverless
const GH_WORKFLOW = 'sync-sap.yml';

async function sincronizarConGitHub(modulo = 'all', btnEl = null) {
  if (typeof window !== 'undefined' && window._sapSyncRunning) {
    if (typeof _notify === 'function') _notify('⏳ Ya hay una sincronización en curso. Por favor espera un momento.', 'info');
    return;
  }
  if (typeof window !== 'undefined') window._sapSyncRunning = true;

  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { 
    btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Conectando SAP...'; 
    btnEl.disabled = true;
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Sapi-Client-Token': 'SapiSecuredClientToken'
    };
    
    const sb = _getSb();
    if (sb && sb.auth) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const triggerTime = new Date().getTime();

    const resp = await fetch('/api/trigger-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ modulo })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${resp.status}`);
    }

    _notify(`⏳ Sincronización iniciada en SAP. Procesando datos...`, 'info');
    if (btnEl) {
      btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Procesando SAP...';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    let targetRunId = null;
    let attempts = 0;
    const maxAttempts = 40;

    const pollStatus = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollStatus);
        _notify('⚠️ Tiempo de espera agotado. Verifica la actualización en unos minutos.', 'warning');
        finishSync();
        return;
      }

      try {
        const statusResp = await fetch('/api/sync-status', {
          method: 'POST',
          headers
        });

        if (statusResp.ok) {
          const run = await statusResp.json();
          const runCreatedTime = new Date(run.created_at).getTime();

          if (!targetRunId) {
            if (run.status !== 'completed' || (runCreatedTime > triggerTime - 120000)) {
              targetRunId = run.id;
              console.log(`[Sync] Detectado workflow run activo: ID ${targetRunId}, Estado: ${run.status}`);
            }
          }

          if (targetRunId && run.id === targetRunId) {
            if (btnEl) {
              btnEl.innerHTML = `<i data-lucide="loader" class="btn-icon rotating"></i> SAP: ${run.status === 'in_progress' ? 'Procesando' : run.status}...`;
              if (typeof lucide !== 'undefined') lucide.createIcons();
            }

            if (run.status === 'completed') {
              clearInterval(pollStatus);
              if (run.conclusion === 'success') {
                _notify('⏳ Recargando base de datos...', 'info');
                if (typeof window !== 'undefined' && window.cargarDatosDeSupabase) {
                  await window.cargarDatosDeSupabase();
                }
                if (modulo === 'refacciones' && typeof window !== 'undefined' && typeof window.descargarRefaccionesSupabase === 'function') {
                  const data = await window.descargarRefaccionesSupabase();
                  if (data && data.length > 0 && typeof window.renderRefacciones === 'function') {
                    window.renderRefacciones();
                  }
                }
                _notify('✅ Sincronización SAP finalizada con éxito.', 'success');
                if (typeof window !== 'undefined' && window.validarCotizacionConSAP) {
                  window.validarCotizacionConSAP(true);
                  const activeInlineStatusEl = document.querySelector('[id^="quick-sap-validation-status-"]');
                  if (activeInlineStatusEl) {
                    const activeInlineTransitionId = activeInlineStatusEl.id.replace('quick-sap-validation-status-', '');
                    window.validarCotizacionConSAP(false, activeInlineTransitionId);
                  }
                }
                if (typeof window !== 'undefined' && window.poblarPedidosDropdown) {
                  window.poblarPedidosDropdown(true, null, document.getElementById('t-pedido-sap')?.value || '');
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.poblarPedidosDropdown(false, activeQuickTicketId, activeQuickPedEl.value || '');
                  }
                }
                if (typeof window !== 'undefined' && window.validarPedidoConSAP) {
                  window.validarPedidoConSAP(true);
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.validarPedidoConSAP(false, activeQuickTicketId);
                  }
                }
              } else {
                _notify(`❌ Sincronización SAP fallida: ${run.conclusion || 'desconocido'}`, 'error');
              }
              finishSync();
            }
          }
        }
      } catch (err) {
        console.warn('Error sondeando estado de sync:', err);
      }
    }, 5000);

    function finishSync() {
      if (typeof window !== 'undefined') window._sapSyncRunning = false;
      if (btnEl) {
        btnEl.innerHTML = origHTML;
        btnEl.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }

  } catch(e) {
    if (typeof window !== 'undefined') window._sapSyncRunning = false;
    if (modulo === 'refacciones' && typeof window !== 'undefined' && typeof window.descargarRefaccionesSupabase === 'function') {
      _notify('Recargando catálogo directamente desde Supabase...', 'info');
      try {
        const data = await window.descargarRefaccionesSupabase();
        if (data && data.length > 0) {
          _notify(`✅ Catálogo actualizado desde Supabase (${data.length} refacciones).`, 'success');
          if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
          if (btnEl) {
            btnEl.innerHTML = origHTML;
            btnEl.disabled = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }
          return;
        }
      } catch (subErr) {
        console.warn('[sincronizarConGitHub] Falló recarga directa de refacciones:', subErr);
      }
    }
    _notify(`❌ Error al disparar sync: ${e.message}`, 'error');
    if (btnEl) {
      btnEl.innerHTML = origHTML;
      btnEl.disabled = false;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// ==========================================
// 3. VALIDACIÓN, VINCULACIÓN Y COTIZACIONES
// ==========================================

let _cacheCotizacionesSap = [];
let _cachePedidosSap = [];

if (typeof window !== 'undefined') {
  window._cacheCotizacionesSap = window._cacheCotizacionesSap || [];
  window._cachePedidosSap = window._cachePedidosSap || [];
  _cacheCotizacionesSap = window._cacheCotizacionesSap;
  _cachePedidosSap = window._cachePedidosSap;

  (async () => {
    try {
      if (typeof window.loadCatalogOffline === 'function') {
        if (!_cacheCotizacionesSap || _cacheCotizacionesSap.length === 0) {
          window._cacheCotizacionesSap = await window.loadCatalogOffline('eurorep_cotizaciones_sap', []);
          _cacheCotizacionesSap = window._cacheCotizacionesSap;
        }
        if (!_cachePedidosSap || _cachePedidosSap.length === 0) {
          window._cachePedidosSap = await window.loadCatalogOffline('eurorep_pedidos_sap', []);
          _cachePedidosSap = window._cachePedidosSap;
        }
      }
    } catch (e) {}
  })();
}

function renderLinkedCotizaciones(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const containerId = isModal ? 'linked-cotizaciones-container' : `quick-linked-cotizaciones-container-${ticketId}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = isModal ? (typeof window !== 'undefined' ? window.editandoCotizaciones : []) : (typeof window !== 'undefined' && window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[ticketId] : []);
  if (!Array.isArray(list)) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:1rem; border:1px dashed var(--border); border-radius:6px; font-size:0.8rem; font-style:italic; width:100%;">
        No hay cotizaciones vinculadas aún.
      </div>
    `;
    togglePasarCotizacionBtn(isModal, ticketId, false);
    return;
  }

  let html = '<div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.75rem; width:100%;">';
  list.forEach((c, idx) => {
    const formatMonto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(c.monto || 0);
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.5rem 0.75rem; width:100%;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary); font-family:monospace;">
            ${c.sap}
          </div>
          <div style="font-size:0.74rem; color:var(--text-secondary);">
            Monto: <span style="font-weight:600; color:var(--text-primary);">${formatMonto}</span>
            ${c.pdf ? ` &bull; <span style="color:#10b981; font-weight:600;"><i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> PDF</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:0.25rem;">
          ${c.pdf ? `<button type="button" onclick="window.viewLinkedCotizacionPdf(${isModal}, '${ticketId}', ${idx})" class="btn-icon" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); border-radius:4px; padding:0.3rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Ver PDF"><i data-lucide="eye" style="width:14px; height:14px;"></i></button>` : ''}
          <button type="button" onclick="window.deleteLinkedCotizacion(${isModal}, '${ticketId}', ${idx})" class="btn-icon" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:4px; padding:0.3rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar Cotización"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  togglePasarCotizacionBtn(isModal, ticketId, true);
}

function togglePasarCotizacionBtn(isModal, ticketId, enable) {
  if (typeof document === 'undefined') return;
  const btnId = isModal ? null : `btn-pasar-cotizacion-${ticketId}`;
  if (!isModal && btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
      const bypass = typeof window !== 'undefined' && window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      const finalEnable = enable || bypass;
      btn.disabled = !finalEnable;
      btn.style.opacity = finalEnable ? '1' : '0.5';
      btn.style.cursor = finalEnable ? 'pointer' : 'not-allowed';
    }
  }
}

async function deleteLinkedCotizacion(isModal, ticketId, index) {
  let confirmed = false;
  if (typeof window !== 'undefined' && typeof window.confirmarAccion === 'function') {
    confirmed = await window.confirmarAccion({
      titulo: 'Desvincular Cotización',
      mensaje: '¿Está seguro de desvincular esta cotización?',
      textoCancelar: 'Cancelar',
      textoAceptar: 'Desvincular',
      esPeligroso: true
    });
  } else if (typeof confirm === 'function') {
    confirmed = confirm('¿Está seguro de desvincular esta cotización?');
  } else {
    confirmed = true;
  }
  
  if (!confirmed) return;
  
  const list = isModal
    ? (typeof window !== 'undefined' ? window.editandoCotizaciones : [])
    : (typeof window !== 'undefined' && window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[ticketId] : []);
  if (list && list[index]) {
    list.splice(index, 1);
    renderLinkedCotizaciones(isModal, ticketId);
    _notify('Cotización desvinculada.', 'info');
  }
}

function viewLinkedCotizacionPdf(isModal, ticketId, index) {
  const list = isModal
    ? (typeof window !== 'undefined' ? window.editandoCotizaciones : [])
    : (typeof window !== 'undefined' && window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[ticketId] : []);
  if (list && list[index] && list[index].pdf) {
    const pdfData = list[index].pdf;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
      const base64Content = pdfData.split(',')[1];
      const binary = atob(base64Content);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        buffer[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } else {
      if (typeof window !== 'undefined') window.open(pdfData, '_blank');
    }
  }
}

async function vincularNuevaCotizacion(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const sapInputId = isModal ? 't-cotizacion-sap' : `quick-cot-sap-${ticketId}`;
  const montoInputId = isModal ? 't-cotizacion-monto' : `quick-cot-monto-${ticketId}`;
  const pdfInputId = isModal ? 't-cotizacion-pdf' : `quick-cot-pdf-${ticketId}`;

  const sapVal = document.getElementById(sapInputId)?.value.trim();
  const montoVal = parseFloat(document.getElementById(montoInputId)?.value) || 0;

  if (!sapVal || montoVal <= 0) {
    _notify('Debe seleccionar una cotización de SAP válida y especificar un monto mayor a cero.', 'warning');
    return;
  }

  const list = isModal
    ? (typeof window !== 'undefined' ? window.editandoCotizaciones : [])
    : (typeof window !== 'undefined' && window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[ticketId] : []);
  if (list && list.some(c => c.sap === sapVal)) {
    _notify('Esta cotización ya ha sido vinculada.', 'warning');
    return;
  }

  const statusDivId = isModal ? 't-sap-validation-status' : `quick-sap-validation-status-${ticketId}`;
  const statusDiv = document.getElementById(statusDivId);
  const isBlocked = statusDiv && statusDiv.innerHTML.includes('🚫 Acceso Bloqueado');
  if (isBlocked) {
    _notify('No se puede vincular: la validación con el PDF está bloqueada.', 'error');
    return;
  }

  let pdfBase64 = null;
  const fileInput = document.getElementById(pdfInputId);
  if (fileInput && fileInput.files.length > 0) {
    pdfBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileInput.files[0]);
    });
  } else {
    if (typeof window !== 'undefined' && window._lastPdfExtracted && String(window._lastPdfExtracted.doc).trim() === String(sapVal).trim() && window._lastPdfExtracted.base64) {
      pdfBase64 = window._lastPdfExtracted.base64;
    }
  }

  if (!pdfBase64) {
    const tId = isModal ? (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null) : ticketId;
    const tkts = _getTickets();
    const t = tId ? tkts.find(x => x.id === tId) : null;
    if (t && t.cotizacionSAP === sapVal && t.pdfCotizacion) {
      pdfBase64 = t.pdfCotizacion;
    }
  }

  if (!pdfBase64) {
    _notify('Debes subir el archivo PDF de la cotización.', 'warning');
    return;
  }

  const newCot = {
    sap: sapVal,
    monto: montoVal,
    pdf: pdfBase64
  };
  
  if (typeof window !== 'undefined') {
    if (isModal) {
      if (!window.editandoCotizaciones) window.editandoCotizaciones = [];
      window.editandoCotizaciones.push(newCot);
    } else {
      if (!window.quickEditandoCotizaciones) window.quickEditandoCotizaciones = {};
      if (!window.quickEditandoCotizaciones[ticketId]) window.quickEditandoCotizaciones[ticketId] = [];
      window.quickEditandoCotizaciones[ticketId].push(newCot);
    }
  }

  const sapEl = document.getElementById(sapInputId);
  if (sapEl) sapEl.value = '';
  const montoEl = document.getElementById(montoInputId);
  if (montoEl) montoEl.value = '';
  if (fileInput) fileInput.value = '';
  
  const labelTextSpan = document.getElementById(pdfInputId)?.parentElement.querySelector('.file-label-text');
  if (labelTextSpan) {
    labelTextSpan.textContent = 'Subir cotización en PDF';
  }
  const labelParent = document.getElementById(pdfInputId)?.parentElement;
  if (labelParent) {
    labelParent.style.borderColor = 'var(--border)';
    labelParent.style.color = 'var(--text-muted)';
    labelParent.style.background = 'rgba(255,255,255,0.02)';
  }

  const clearBtnId = isModal ? 'btn-clear-pdf-modal' : `btn-clear-pdf-quick-${ticketId}`;
  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) clearBtn.style.display = 'none';

  const extTableId = isModal ? 'pdf-extraction-table-container' : `quick-pdf-extraction-table-container-${ticketId}`;
  const extTable = document.getElementById(extTableId);
  if (extTable) {
    extTable.style.display = 'none';
    extTable.innerHTML = '';
  }

  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
  }

  renderLinkedCotizaciones(isModal, ticketId);
  _notify('Cotización vinculada correctamente.', 'success');
}

// Selector buscable reutilizable
function initSearchableSelect(selectId, placeholder = 'Escribe para buscar...', allowCustom = false) {
  if (typeof document === 'undefined') return;
  const originalSelect = document.getElementById(selectId);
  if (!originalSelect) return;

  let wrapper = originalSelect.parentElement.querySelector(`.custom-select-search-container[data-select-id="${selectId}"]`);
  if (wrapper) {
    wrapper.remove();
  }

  originalSelect.style.display = 'none';

  wrapper = document.createElement('div');
  wrapper.className = 'custom-select-search-container';
  wrapper.setAttribute('data-select-id', selectId);

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-search-trigger';
  
  const triggerLabel = document.createElement('span');
  triggerLabel.id = `${selectId}-custom-label`;
  
  const selectedOption = originalSelect.options[originalSelect.selectedIndex];
  triggerLabel.textContent = selectedOption ? selectedOption.textContent : '— Seleccione una opción —';
  
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', 'chevron-down');
  icon.style.width = '14px';
  icon.style.height = '14px';
  
  trigger.appendChild(triggerLabel);
  trigger.appendChild(icon);
  wrapper.appendChild(trigger);

  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-search-dropdown';
  dropdown.style.display = 'none';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = placeholder;
  dropdown.appendChild(searchInput);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-select-search-options';
  dropdown.appendChild(optionsContainer);

  wrapper.appendChild(dropdown);

  originalSelect.parentNode.insertBefore(wrapper, originalSelect.nextSibling);
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e){}

  const populateOptions = (filterText = '') => {
    optionsContainer.innerHTML = '';
    const query = filterText.toLowerCase().trim();
    let count = 0;

    Array.from(originalSelect.options).forEach(opt => {
      const text = opt.textContent;
      const val = opt.value;
      
      if (!val) return;
      
      if (query && !text.toLowerCase().includes(query) && !val.toLowerCase().includes(query)) {
        return;
      }

      count++;
      const optionEl = document.createElement('div');
      optionEl.className = 'custom-select-search-option';
      if (opt.selected) optionEl.classList.add('selected');
      optionEl.textContent = text;
      optionEl.title = text;
      optionEl.onclick = (e) => {
        e.stopPropagation();
        originalSelect.value = val;
        triggerLabel.textContent = text;
        
        const event = new Event('change', { bubbles: true });
        originalSelect.dispatchEvent(event);
        
        dropdown.style.display = 'none';
        wrapper.classList.remove('open');
      };
      optionsContainer.appendChild(optionEl);
    });

    if (allowCustom) {
      if (query) {
        const addOptionEl = document.createElement('div');
        addOptionEl.className = 'custom-select-search-option';
        addOptionEl.style.fontWeight = 'bold';
        addOptionEl.style.color = 'var(--primary)';
        addOptionEl.innerHTML = `+ Agregar y usar "${query}"`;
        addOptionEl.onclick = (e) => {
          e.stopPropagation();
          
          const newOpt = document.createElement('option');
          newOpt.value = query;
          newOpt.textContent = query;
          originalSelect.appendChild(newOpt);
          
          originalSelect.value = query;
          triggerLabel.textContent = query;
          
          const event = new Event('change', { bubbles: true });
          originalSelect.dispatchEvent(event);
          
          dropdown.style.display = 'none';
          wrapper.classList.remove('open');
        };
        optionsContainer.appendChild(addOptionEl);
        count++;
      } else {
        const hintEl = document.createElement('div');
        hintEl.className = 'custom-select-search-option';
        hintEl.style.fontStyle = 'italic';
        hintEl.style.color = 'var(--text-muted)';
        hintEl.style.cursor = 'default';
        hintEl.style.background = 'transparent';
        hintEl.textContent = 'Escriba arriba para agregar un sitio nuevo...';
        optionsContainer.appendChild(hintEl);
        count++;
      }
    }

    if (count === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'custom-select-search-option no-results';
      noResults.textContent = 'No se encontraron resultados';
      optionsContainer.appendChild(noResults);
    }
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    
    document.querySelectorAll('.custom-select-search-container').forEach(c => {
      if (c !== wrapper) {
        c.classList.remove('open');
        const d = c.querySelector('.custom-select-search-dropdown');
        if (d) d.style.display = 'none';
      }
    });

    const isOpen = wrapper.classList.toggle('open');
    if (isOpen) {
      dropdown.style.display = 'flex';
      searchInput.value = '';
      populateOptions();
      setTimeout(() => searchInput.focus(), 50);
    } else {
      dropdown.style.display = 'none';
    }
  };

  searchInput.oninput = (e) => {
    populateOptions(e.target.value);
  };
  searchInput.onclick = (e) => {
    e.stopPropagation();
  };

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
      wrapper.classList.remove('open');
    }
  });
}

// Poblar desplegables de cotizaciones y pedidos
async function poblarCotizacionesDropdown(isModal = true, ticketId = null, selectedValue = '') {
  if (typeof document === 'undefined') return;
  const sb = _getSb();
  if (!sb) return;

  const selectId = isModal ? 't-cotizacion-sap' : `quick-cot-sap-${ticketId}`;
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;

  try {
    let cache = (typeof window !== 'undefined' && window._cacheCotizacionesSap) ? window._cacheCotizacionesSap : _cacheCotizacionesSap;
    if (!cache || cache.length === 0) {
      let data = [];
      let error = null;
      try {
        if (typeof window !== 'undefined' && typeof window.fetchTablePaginated === 'function') {
          data = await window.fetchTablePaginated('cotizaciones_sap', '*', 'numero_cotizacion', false);
        } else {
          const res = await sb.from('cotizaciones_sap').select('*').order('numero_cotizacion', { ascending: false }).limit(200);
          data = res.data || [];
          error = res.error;
        }
      } catch (err) {
        error = err;
      }
      if (!error && data) {
        cache = data;
        _cacheCotizacionesSap = data;
        if (typeof window !== 'undefined') {
          window._cacheCotizacionesSap = data;
          if (typeof window.saveCatalogOffline === 'function') {
            await window.saveCatalogOffline('eurorep_cotizaciones_sap', data);
          }
        }
      }
    }

    let quotes = cache || [];
    
    const tId = isModal ? (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null) : ticketId;
    const tkts = _getTickets();
    const ticketObj = tkts.find(x => x.id === tId);
    
    if (ticketObj && ticketObj.cliente) {
      const tClientClean = String(ticketObj.cliente).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (tClientClean) {
        const filtered = quotes.filter(q => {
          if (!q.cliente) return false;
          const sClientClean = String(q.cliente).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          return tClientClean.includes(sClientClean) || sClientClean.includes(tClientClean);
        });
        
        if (filtered.length > 0) {
          quotes = filtered;
        }
      }
    }

    selectEl.innerHTML = '<option value="">— Seleccione una cotización —</option>';
    
    if (selectedValue && !quotes.some(q => q.numero_cotizacion === selectedValue)) {
      const tempOpt = document.createElement('option');
      tempOpt.value = selectedValue;
      tempOpt.textContent = `${selectedValue} (Ingresado manualmente)`;
      selectEl.appendChild(tempOpt);
    }

    quotes.forEach(q => {
      const option = document.createElement('option');
      option.value = q.numero_cotizacion;
      const montoFormateado = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(q.monto || 0);
      const fechaFormateada = q.fecha ? new Date(q.fecha).toLocaleDateString('es-MX') : '—';
      option.textContent = `${q.numero_cotizacion} - ${q.cliente || 'Sin cliente'} (${montoFormateado} | ${fechaFormateada})`;
      selectEl.appendChild(option);
    });

    if (selectedValue) {
      selectEl.value = selectedValue;
    }
    initSearchableSelect(selectId, 'Buscar cotización SAP...');
  } catch (err) {
    console.error('[SAP Autocomplete] Error populating select dropdown:', err);
  }
}

async function poblarPedidosDropdown(isModal = true, ticketId = null, selectedValue = '') {
  if (typeof document === 'undefined') return;
  const sb = _getSb();
  if (!sb) return;

  const selectId = isModal ? 't-pedido-sap' : `quick-ped-sap-${ticketId}`;
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;

  try {
    let cache = (typeof window !== 'undefined' && window._cachePedidosSap) ? window._cachePedidosSap : _cachePedidosSap;
    if (!cache || cache.length === 0) {
      let data = [];
      let error = null;
      try {
        if (typeof window !== 'undefined' && typeof window.fetchTablePaginated === 'function') {
          data = await window.fetchTablePaginated('pedidos_sap', '*', 'numero_pedido', false);
        } else {
          const res = await sb.from('pedidos_sap').select('*').order('numero_pedido', { ascending: false }).limit(200);
          data = res.data || [];
          error = res.error;
        }
      } catch (err) {
        error = err;
      }
      if (!error && data) {
        cache = data;
        _cachePedidosSap = data;
        if (typeof window !== 'undefined') {
          window._cachePedidosSap = data;
          if (typeof window.saveCatalogOffline === 'function') {
            await window.saveCatalogOffline('eurorep_pedidos_sap', data);
          }
        }
      }
    }

    let orders = cache || [];
    
    const tId = isModal ? (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null) : ticketId;
    const tkts = _getTickets();
    const ticketObj = tkts.find(x => x.id === tId);
    
    if (ticketObj && ticketObj.cliente) {
      const tClientClean = String(ticketObj.cliente).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (tClientClean) {
        const filtered = orders.filter(o => {
          if (!o.cliente_nombre) return false;
          const sClientClean = String(o.cliente_nombre).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          return tClientClean.includes(sClientClean) || sClientClean.includes(tClientClean);
        });
        if (filtered.length > 0) {
          orders = filtered;
        }
      }
    }

    selectEl.innerHTML = '<option value="">— Seleccione un pedido —</option>';
    
    if (selectedValue && !orders.some(o => o.numero_pedido === selectedValue)) {
      const tempOpt = document.createElement('option');
      tempOpt.value = selectedValue;
      tempOpt.textContent = `${selectedValue} (Ingresado manualmente)`;
      selectEl.appendChild(tempOpt);
    }

    orders.forEach(o => {
      const option = document.createElement('option');
      option.value = o.numero_pedido;
      const montoFormateado = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(o.monto || 0);
      const fechaFormateada = o.fecha ? new Date(o.fecha).toLocaleDateString('es-MX') : '—';
      option.textContent = `${o.numero_pedido} - ${o.cliente_nombre || 'Sin cliente'} (${montoFormateado} | ${fechaFormateada})`;
      selectEl.appendChild(option);
    });

    if (selectedValue) {
      selectEl.value = selectedValue;
    }
    initSearchableSelect(selectId, 'Buscar pedido SAP...');
  } catch (err) {
    console.error('[SAP Autocomplete Pedidos] Error populating select dropdown:', err);
  }
}

function onModalPedidoSelected() {
  if (typeof document === 'undefined') return;
  const sapVal = document.getElementById('t-pedido-sap')?.value.trim();
  if (!sapVal) return;
  
  const cache = (typeof window !== 'undefined' && window._cachePedidosSap) ? window._cachePedidosSap : _cachePedidosSap;
  const order = (cache || []).find(o => o.numero_pedido === sapVal);
  if (order) {
    const montoInput = document.getElementById('t-pedido-monto');
    if (montoInput) {
      montoInput.value = order.monto || '';
    }
  }
  
  validarPedidoConSAP(true);
}

function onQuickPedidoSelected(ticketId) {
  if (typeof document === 'undefined') return;
  const sapVal = document.getElementById(`quick-ped-sap-${ticketId}`)?.value.trim();
  if (!sapVal) return;
  
  const cache = (typeof window !== 'undefined' && window._cachePedidosSap) ? window._cachePedidosSap : _cachePedidosSap;
  const order = (cache || []).find(o => o.numero_pedido === sapVal);
  if (order) {
    const montoInput = document.getElementById(`quick-ped-monto-${ticketId}`);
    if (montoInput) {
      montoInput.value = order.monto || '';
    }
  }
  
  validarPedidoConSAP(false, ticketId);
}

function onModalCotizacionSelected() {
  if (typeof document === 'undefined') return;
  const sapVal = document.getElementById('t-cotizacion-sap')?.value.trim();
  if (!sapVal) return;
  
  const cache = (typeof window !== 'undefined' && window._cacheCotizacionesSap) ? window._cacheCotizacionesSap : _cacheCotizacionesSap;
  const quote = (cache || []).find(q => q.numero_cotizacion === sapVal);
  if (quote) {
    const montoInput = document.getElementById('t-cotizacion-monto');
    if (montoInput) {
      montoInput.value = quote.monto || '';
    }
  }
  
  validarCotizacionConSAP(true);
}

function onQuickCotizacionSelected(ticketId) {
  if (typeof document === 'undefined') return;
  const sapVal = document.getElementById(`quick-cot-sap-${ticketId}`)?.value.trim();
  if (!sapVal) return;
  
  const cache = (typeof window !== 'undefined' && window._cacheCotizacionesSap) ? window._cacheCotizacionesSap : _cacheCotizacionesSap;
  const quote = (cache || []).find(q => q.numero_cotizacion === sapVal);
  if (quote) {
    const montoInput = document.getElementById(`quick-cot-monto-${ticketId}`);
    if (montoInput) {
      montoInput.value = quote.monto || '';
    }
  }
  
  validarCotizacionConSAP(false, ticketId);
}

// ==========================================
// 4. PARSING IA / OCR Y VALIDACIÓN DE PDFS
// ==========================================

async function autoExtraerDesdePdfPedido(file, isModal = true, ticketId = null) {
  if (!file || typeof document === 'undefined') return;
  
  _notify('Analizando PDF de pedido...', 'info');
  
  const tableContainerId = isModal ? 'pdf-pedido-extraction-table-container' : `quick-pdf-pedido-extraction-table-container-${ticketId}`;
  const tableContainer = document.getElementById(tableContainerId);
  if (tableContainer) {
    tableContainer.style.display = 'block';
    tableContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem; text-align:center; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; margin-top:1rem;">
        <img src="logo_transparent.png" onerror="this.src='https://cdn-icons-png.flaticon.com/512/2885/2885417.png'" style="width:70px; height:70px; object-fit:contain; animation: pulse-opacity-pdf 1.5s ease-in-out infinite;" alt="Loading..." />
        <div style="margin-top:1.5rem; color:var(--text-primary); font-weight:600; font-size:0.95rem;">
          Analizando Documento...
        </div>
        <div style="margin-top:0.5rem; color:var(--text-muted); font-size:0.8rem;">
          La Inteligencia Artificial está leyendo las partidas del pedido
        </div>
        <style>
          @keyframes pulse-opacity-pdf {
            0% { opacity: 0.3; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 0.3; transform: scale(0.9); }
          }
        </style>
      </div>
    `;
  }
  
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    
    let extractedDoc = null;
    let extractedMonto = null;
    let detectedClientName = null;
    let isSapMatch = false;
    let cleanText = '';
    let isFileNameMatch = false;
    let extractedArticulos = [];
    let detallesViaje = null;
    let mainArticulos = [];
    let extrasArticulos = [];

    const orders = (typeof window !== 'undefined' && window._cachePedidosSap) ? window._cachePedidosSap : _cachePedidosSap;

    if (file.name) {
      const fnMatch = file.name.match(/\b([123]10[0-9]{4})\b/) || file.name.match(/\b([0-9]{5,8})\b/);
      if (fnMatch) {
        const docNum = fnMatch[1];
        const found = (orders || []).find(o => o.numero_pedido === docNum);
        if (found) {
          isFileNameMatch = true;
          isSapMatch = true;
          extractedDoc = found.numero_pedido;
          extractedMonto = found.monto;
          detectedClientName = found.cliente_nombre;
          console.log('[PDF Auto-Extract Pedido] Matched pedido from filename via SAP cache:', found);
        } else {
          extractedDoc = docNum;
        }
      }
    }

    let isAiExtracted = false;
    try {
      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: base64 })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.ai && result.data) {
          isAiExtracted = true;
          extractedDoc = extractedDoc || result.data.numero_cotizacion || result.data.numero_pedido || null;
          extractedMonto = extractedMonto || result.data.monto || null;
          detectedClientName = detectedClientName || result.data.cliente || null;
          detallesViaje = result.data.detalles_viaje || null;
          extractedArticulos = result.data.articulos || [];
          console.log('[PDF Auto-Extract Pedido] AI Extracted Data:', result.data);
        } else if (result.text) {
          cleanText = result.text.replace(/\s+/g, ' ').trim();
        }
      }
    } catch (apiErr) {
      console.warn('[PDF Auto-Extract Pedido] Local backend extraction failed:', apiErr);
    }

    if (!cleanText && !isAiExtracted && typeof window !== 'undefined' && typeof window.extraerTextoPdf === 'function') {
      try {
        const text = await window.extraerTextoPdf(base64);
        cleanText = text.replace(/\s+/g, ' ').trim();
      } catch (pdfjsErr) {
        console.error('[PDF Auto-Extract Pedido] Browser PDF.js failed:', pdfjsErr);
      }
    }

    let detectedOrder = null;
    if (cleanText && orders) {
      for (const o of orders) {
        if (o.numero_pedido && cleanText.includes(o.numero_pedido)) {
          detectedOrder = o;
          break;
        }
      }
    }

    if (detectedOrder) {
      isSapMatch = true;
      extractedDoc = detectedOrder.numero_pedido;
      extractedMonto = detectedOrder.monto;
      detectedClientName = detectedOrder.cliente_nombre;
    } else if (cleanText) {
      const docMatch = cleanText.match(/\b([123]10[0-9]{4})\b/) || cleanText.match(/\b([0-9]{5,8})\b/);
      extractedDoc = docMatch ? docMatch[1] : (extractedDoc || null);
      
      const totalRegex = /(?:importe\s+total|total|importe|monto|neto)[:\s\$\-]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))/gi;
      let match;
      let maxMonto = 0;
      while ((match = totalRegex.exec(cleanText)) !== null) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (val > maxMonto) {
          maxMonto = val;
        }
      }
      if (maxMonto > 0) {
        extractedMonto = extractedMonto || maxMonto;
      }

      if (!extractedArticulos || extractedArticulos.length === 0) {
        const itemRegex = /\b(\d{3})\s+(.*?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\b/g;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(cleanText)) !== null) {
          extractedArticulos.push({
            descripcion: itemMatch[2].trim(),
            cantidad: parseFloat(itemMatch[3]),
            unidad_medida: itemMatch[4],
            x_surtir: parseFloat(itemMatch[5]),
            almacen: itemMatch[6],
            precio: parseFloat(itemMatch[7].replace(/,/g, '')),
            impuesto_porcentaje: parseFloat(itemMatch[8].replace(/,/g, '')),
            total: parseFloat(itemMatch[9].replace(/,/g, ''))
          });
        }
        if (extractedArticulos.length > 0) {
          console.log('[PDF Auto-Extract Pedido] Extraídos articulos con Regex fallback:', extractedArticulos);
        }
      }
    }

    if (extractedDoc && !isSapMatch && orders) {
      const matchInCache = orders.find(o => o.numero_pedido === extractedDoc);
      if (matchInCache) {
        isSapMatch = true;
        extractedMonto = matchInCache.monto;
        detectedClientName = detectedClientName || matchInCache.cliente_nombre;
      }
    }

    const extraKeywords = ['consumibles', 'asistencia', 'casetas', 'viaticos', 'viáticos', 'reembolso', 'km'];
    if (extractedArticulos && extractedArticulos.length > 0) {
      extractedArticulos.forEach(art => {
        const desc = (art.descripcion || '').toLowerCase();
        if (extraKeywords.some(kw => desc.includes(kw))) {
          extrasArticulos.push(art);
        } else {
          mainArticulos.push(art);
        }
      });
    }

    const lastPdfData = {
      doc: extractedDoc,
      monto: extractedMonto,
      cliente: detectedClientName,
      detallesViaje: detallesViaje,
      isFileNameMatch: isFileNameMatch,
      isSapMatch: isSapMatch,
      cleanText: cleanText,
      articulos: extractedArticulos,
      mainArticulos: mainArticulos
    };
    if (typeof window !== 'undefined') {
      window._lastPdfPedidoExtracted = lastPdfData;
    }

    if (isFileNameMatch) {
      _notify(`✅ Datos de pedido ${extractedDoc} extraídos del nombre del archivo.`, 'success');
    } else if (extractedDoc || extractedMonto) {
      let clientMsg = detectedClientName ? ` | Cliente: "${detectedClientName}"` : '';
      _notify(`⚠️ Datos extraídos del PDF (Pedido: ${extractedDoc || '?'}, Monto: $${extractedMonto || '?'}${clientMsg}).`, 'warning');
    } else {
      _notify('No se pudo extraer el folio o monto del PDF del pedido.', 'info');
    }

    if (tableContainer) {
      const generateTable = (title, icon, items) => {
        return `
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
            <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">${icon} ${title} (${items.length})</div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                    <th style="padding:4px;">Descripción</th>
                    <th style="padding:4px; text-align:center;">Cant</th>
                    <th style="padding:4px; text-align:center;">UM</th>
                    <th style="padding:4px; text-align:center;">X Surtir</th>
                    <th style="padding:4px; text-align:center;">Almacén</th>
                    <th style="padding:4px; text-align:right;">Precio</th>
                    <th style="padding:4px; text-align:center;">Imp %</th>
                    <th style="padding:4px; text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length > 0 ? items.map(art => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:4px;" title="${art.descripcion || ''}">${art.descripcion || '—'}</td>
                      <td style="padding:4px; text-align:center; font-weight:600;">${art.cantidad || 0}</td>
                      <td style="padding:4px; text-align:center;">${art.unidad_medida || '—'}</td>
                      <td style="padding:4px; text-align:center;">${art.x_surtir || 0}</td>
                      <td style="padding:4px; text-align:center;">${art.almacen || '—'}</td>
                      <td style="padding:4px; text-align:right;">${art.precio ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.precio) : '—'}</td>
                      <td style="padding:4px; text-align:center;">${art.impuesto_porcentaje || 0}%</td>
                      <td style="padding:4px; text-align:right; font-weight:600;">${art.total ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.total) : '—'}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="8" style="padding:12px 4px; text-align:center; color:var(--text-muted); font-style:italic;">No se pudieron extraer datos de la tabla.</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `;
      };

      const articulosHtml = generateTable('Refacciones Necesarias', '📦', mainArticulos) + 
                            generateTable('Extras Extraídos', '📋', extrasArticulos);

      tableContainer.style.display = 'block';
      tableContainer.innerHTML = `
        <div class="pdf-data-table" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.75rem; font-size:0.8rem; margin-top:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
          <div style="font-weight:600; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
            <span>📋 Datos Extraídos del Archivo</span>
            <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${isFileNameMatch ? 'background:rgba(16,185,129,0.1); color:#10b981;' : (isSapMatch ? 'background:rgba(16,185,129,0.1); color:#10b981;' : 'background:rgba(245,158,11,0.1); color:#f59e0b;')} font-weight:600;">
              ${isFileNameMatch ? 'Nombre de Archivo + SAP' : (isSapMatch ? 'Coincidencia SAP' : 'Lectura AI/Texto')}
            </span>
          </div>
          <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); color:var(--text-muted);">
                <th style="padding:4px 8px; font-weight:500;">Dato</th>
                <th style="padding:4px 8px; font-weight:500;">Valor Extraído</th>
                <th style="padding:4px 8px; font-weight:500;">Origen</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 8px; font-weight:600;">Folio / Doc SAP</td>
                <td style="padding:6px 8px; font-family:monospace; color:var(--text-primary);">${extractedDoc || '—'}</td>
                <td style="padding:6px 8px;"><span style="font-size:0.7rem;">${isFileNameMatch ? 'Nombre del archivo' : 'PDF AI'}</span></td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 8px; font-weight:600;">Monto Total</td>
                <td style="padding:6px 8px; color:var(--text-primary); font-weight:600;">${extractedMonto ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(extractedMonto) : '—'}</td>
                <td style="padding:6px 8px;"><span style="font-size:0.7rem;">${isSapMatch ? 'Catálogo SAP' : 'PDF AI'}</span></td>
              </tr>
            </tbody>
          </table>
          ${articulosHtml}
          ${detallesViaje ? `
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
            <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">✈️ Logística Extraída (Viáticos y Ruta)</div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                    <th style="padding:4px 8px; font-weight:500;">Origen</th>
                    <th style="padding:4px 8px; font-weight:500;">Destino</th>
                    <th style="padding:4px 8px; font-weight:500;">Hospedajes</th>
                    <th style="padding:4px 8px; font-weight:500;">Alimentos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                    <td style="padding:6px 8px;">${detallesViaje.origen || '—'}</td>
                    <td style="padding:6px 8px;">${detallesViaje.destino || '—'}</td>
                    <td style="padding:6px 8px;">${detallesViaje.num_hospedaje || 0}</td>
                    <td style="padding:6px 8px;">${detallesViaje.num_alimento || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}
        </div>
      `;
    }

    const clearBtnId = isModal ? 'btn-clear-pdf-pedido-modal' : `btn-clear-pdf-pedido-quick-${ticketId}`;
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) clearBtn.style.display = 'flex';

    const sb = _getSb();
    if (sb) {
      setTimeout(async () => {
        try {
          const origenDatos = isFileNameMatch ? 'Nombre de Archivo + SAP' : (isSapMatch ? 'Catálogo SAP' : 'PDF AI');
          const finalTicketId = ticketId || (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null);
          
          let extrasParaGuardar = [...extrasArticulos];
          if (detallesViaje) {
             extrasParaGuardar.push({ isViajeData: true, ...detallesViaje });
          }
          
          const insertData = {
            ticket_id: finalTicketId || null,
            folio_sap: extractedDoc,
            monto_total: extractedMonto,
            cliente: detectedClientName,
            ruta_servicio: cleanText,
            conceptos: mainArticulos,
            extras: extrasParaGuardar,
            origen_datos: origenDatos
          };
          
          const { error } = await sb
            .from('pdf_extracciones_ai')
            .insert([insertData]);
            
          if (error) {
            console.error('[PDF Auto-Extract] Error guardando en Supabase (pdf_extracciones_ai):', error);
          } else {
            console.log('[PDF Auto-Extract] Datos guardados exitosamente en Supabase (pdf_extracciones_ai).');
          }
        } catch (dbErr) {
          console.error('[PDF Auto-Extract] Excepción guardando en Supabase:', dbErr);
        }
      }, 500);
    }

    validarPedidoConSAP(isModal, ticketId);
  } catch (err) {
    console.error('[PDF Auto-Extract Pedido] Error:', err);
    _notify('Error al leer el archivo PDF: ' + err.message, 'error');
  }
}

function clearPdfPedidoInput(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const fileInputId = isModal ? 't-pedido-pdf' : `quick-ped-pdf-${ticketId}`;
  const fileInput = document.getElementById(fileInputId);
  if (fileInput) {
    fileInput.value = '';
    const textSpan = fileInput.parentElement.querySelector('.file-label-text');
    if (textSpan) textSpan.textContent = 'Subir pedido en PDF';
    fileInput.parentElement.style.borderColor = 'var(--border)';
    fileInput.parentElement.style.color = 'var(--text-muted)';
    fileInput.parentElement.style.background = 'rgba(255,255,255,0.02)';
  }

  const tableContainerId = isModal ? 'pdf-pedido-extraction-table-container' : `quick-pdf-pedido-extraction-table-container-${ticketId}`;
  const tableContainer = document.getElementById(tableContainerId);
  if (tableContainer) {
    tableContainer.innerHTML = '';
    tableContainer.style.display = 'none';
  }

  const clearBtnId = isModal ? 'btn-clear-pdf-pedido-modal' : `btn-clear-pdf-pedido-quick-${ticketId}`;
  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) clearBtn.style.display = 'none';

  if (typeof window !== 'undefined') {
    window._lastPdfPedidoExtracted = null;
  }

  validarPedidoConSAP(isModal, ticketId);
  _notify('Archivo PDF de pedido removido.', 'info');
}

async function validarPedidoConSAP(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const sb = _getSb();
  if (!sb) return;

  const sapInputId = isModal ? 't-pedido-sap' : `quick-ped-sap-${ticketId}`;
  const sapVal = document.getElementById(sapInputId)?.value.trim();

  const montoInputId = isModal ? 't-pedido-monto' : `quick-ped-monto-${ticketId}`;
  const montoInput = document.getElementById(montoInputId);
  const montoVal = montoInput ? parseFloat(montoInput.value) || 0 : 0;

  const statusDivId = isModal ? 't-pedido-sap-validation-status' : `quick-pedido-sap-validation-status-${ticketId}`;
  const statusDiv = document.getElementById(statusDivId);
  if (!statusDiv) return;

  const tId = ticketId || (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null);
  const tkts = _getTickets();
  const ticket = tId ? tkts.find(t => t.id === tId) : null;

  if (typeof window !== 'undefined') {
    window._pedidoSapBlockedState = window._pedidoSapBlockedState || {};
  }

  if (!sapVal) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
    if (typeof window !== 'undefined') {
      window._isPedidoSapBlocked = false;
      if (tId) window._pedidoSapBlockedState[tId] = false;
    }
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;"><i data-lucide="loader" class="rotating" style="width:12px; height:12px;"></i> Validando pedido con SAP...</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  try {
    const { data, error } = await sb.from('pedidos_sap').select('*').eq('numero_pedido', sapVal).maybeSingle();
    if (error) throw error;

    if (!data) {
      statusDiv.innerHTML = `
        <div style="padding:0.5rem 0.75rem; border-radius:6px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); font-size:0.78rem; color:#ef4444; display:flex; flex-direction:column; gap:0.25rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px; height:14px;"></i> Pedido no encontrado en SAP</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">Verifique el número ingresado o presione "Sincronizar con SAP".</div>
        </div>
      `;
      if (typeof window !== 'undefined') {
        window._isPedidoSapBlocked = true;
        if (tId) window._pedidoSapBlockedState[tId] = true;
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const sapMonto = Number(data.monto) || 0;
    const sapCliente = data.cliente_nombre || '';
    const sapFecha = data.fecha ? new Date(data.fecha).toLocaleDateString('es-MX') : '—';
    
    let isMontoMatch = Math.abs(montoVal - sapMonto) < 0.05;
    
    const tClientName = isModal
      ? (document.getElementById('t-cliente')?.value || (ticket ? ticket.cliente : ''))
      : (ticket ? ticket.cliente : '');

    let isClientMatch = true;
    if (tClientName) {
      const tClientClean = String(tClientName).toLowerCase().replace(/[^a-z0-9]/g, '');
      const sClientClean = String(sapCliente).toLowerCase().replace(/[^a-z0-9]/g, '');
      isClientMatch = tClientClean.includes(sClientClean) || sClientClean.includes(tClientClean);
    }

    const pdfData = typeof window !== 'undefined' ? window._lastPdfPedidoExtracted : null;
    const hasPdf = !!pdfData;
    
    let isPdfDocMatch = true;
    let isPdfMontoMatch = true;
    let isPdfClientMatch = true;

    if (hasPdf) {
      isPdfDocMatch = String(pdfData.doc || '').trim() === String(sapVal).trim();
      isPdfMontoMatch = pdfData.monto ? Math.abs(Number(pdfData.monto) - sapMonto) < 0.05 : true;
      if (pdfData.cliente) {
        const pClientClean = String(pdfData.cliente).toLowerCase().replace(/[^a-z0-9]/g, '');
        const sClientClean = String(sapCliente).toLowerCase().replace(/[^a-z0-9]/g, '');
        isPdfClientMatch = pClientClean.includes(sClientClean) || sClientClean.includes(pClientClean);
      }
    }

    let matchCount = 0;
    if (isPdfDocMatch) matchCount++;
    if (isPdfMontoMatch) matchCount++;
    if (isPdfClientMatch) matchCount++;

    const isBlocked = hasPdf && (matchCount < 2);
    if (typeof window !== 'undefined') {
      window._isPedidoSapBlocked = isBlocked;
      if (tId) window._pedidoSapBlockedState[tId] = isBlocked;
    }

    let comparisonTableHtml = '';
    if (hasPdf) {
      comparisonTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:0.4rem; font-size:0.7rem; text-align:left; border:1px solid ${isBlocked ? 'rgba(239,68,68,0.2)' : 'var(--border)'}; background:rgba(0,0,0,0.15); border-radius:6px; overflow:hidden;">
          <thead>
            <tr style="background:rgba(255,255,255,0.02); color:var(--text-muted); border-bottom:1px solid ${isBlocked ? 'rgba(239,68,68,0.2)' : 'var(--border)'};">
              <th style="padding:4px 6px; font-weight:500;">Dato</th>
              <th style="padding:4px 6px; font-weight:500;">En Formulario</th>
              <th style="padding:4px 6px; font-weight:500;">Extraído de PDF</th>
              <th style="padding:4px 6px; font-weight:500;">Registrado en SAP</th>
              <th style="padding:4px 6px; font-weight:500; text-align:center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Folio / Doc</td>
              <td style="padding:5px 6px; font-family:monospace;">${sapVal}</td>
              <td style="padding:5px 6px; font-family:monospace; color:${isPdfDocMatch ? '#10b981' : '#ef4444'};">${pdfData.doc || '—'}</td>
              <td style="padding:5px 6px; font-family:monospace;">${sapVal}</td>
              <td style="padding:5px 6px; text-align:center; color:${isPdfDocMatch ? '#10b981' : '#ef4444'};"><i data-lucide="${isPdfDocMatch ? 'check-circle' : 'alert-triangle'}" style="width:14px; height:14px; display:inline-block;"></i></td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Monto Total</td>
              <td style="padding:5px 6px;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(montoVal)}</td>
              <td style="padding:5px 6px; color:${isPdfMontoMatch ? 'var(--text-primary)' : '#ef4444'};">${pdfData.monto ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(pdfData.monto) : '—'}</td>
              <td style="padding:5px 6px;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sapMonto)}</td>
              <td style="padding:5px 6px; text-align:center; color:${isMontoMatch && isPdfMontoMatch ? '#10b981' : '#ef4444'};"><i data-lucide="${isMontoMatch && isPdfMontoMatch ? 'check-circle' : 'alert-triangle'}" style="width:14px; height:14px; display:inline-block;"></i></td>
            </tr>
            <tr>
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Cliente</td>
              <td style="padding:5px 6px; white-space:nowrap; max-width:80px; overflow:hidden; text-overflow:ellipsis;" title="${tClientName || ''}">${tClientName || '—'}</td>
              <td style="padding:5px 6px; white-space:nowrap; max-width:80px; overflow:hidden; text-overflow:ellipsis; color:${isPdfClientMatch ? 'var(--text-primary)' : '#f59e0b'};" title="${pdfData.cliente || ''}">${pdfData.cliente || '—'}</td>
              <td style="padding:5px 6px; white-space:nowrap; max-width:80px; overflow:hidden; text-overflow:ellipsis;" title="${sapCliente}">${sapCliente}</td>
              <td style="padding:5px 6px; text-align:center; color:${isClientMatch && isPdfClientMatch ? '#10b981' : '#f59e0b'};"><i data-lucide="${isClientMatch && isPdfClientMatch ? 'check-circle' : 'alert-triangle'}" style="width:14px; height:14px; display:inline-block;"></i></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    if (isBlocked) {
      statusDiv.innerHTML = `
        <div style="padding:0.6rem 0.8rem; border-radius:8px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.15); font-size:0.78rem; color:#ef4444; display:flex; flex-direction:column; gap:0.3rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="alert-octagon" style="width:14px; height:14px;"></i> Discrepancia Crítica Detectada</div>
          <div style="font-size:0.74rem; color:var(--text-muted);">Los datos del PDF subido no coinciden con la información oficial de SAP. Verifique el archivo.</div>
          ${comparisonTableHtml}
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Fecha SAP: ${sapFecha}</div>
        </div>
      `;
    } else {
      statusDiv.innerHTML = `
        <div style="padding:0.6rem 0.8rem; border-radius:8px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); font-size:0.78rem; color:#10b981; display:flex; flex-direction:column; gap:0.3rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Pedido Validado con SAP</div>
          <div style="font-size:0.74rem; color:var(--text-muted);">El formulario, el archivo PDF y SAP coinciden plenamente.</div>
          ${comparisonTableHtml}
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Fecha SAP: ${sapFecha}</div>
        </div>
      `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (errVal) {
    console.error('[SAP Validation Pedido] Error querying Supabase:', errVal);
    statusDiv.style.display = 'none';
    if (typeof window !== 'undefined') {
      window._isPedidoSapBlocked = true;
      if (tId) window._pedidoSapBlockedState[tId] = true;
    }
  }
}

async function syncSapPedidoManual(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const btnId = isModal ? 'btn-sync-sap-ped-modal' : `btn-sync-sap-ped-quick-${ticketId}`;
  const btn = document.getElementById(btnId);
  try {
    await sincronizarConGitHub('pedidos', btn);
  } catch (err) {
    console.error('[SAP Sync Manual Pedidos] Error:', err);
    _notify('Error al sincronizar pedidos con SAP: ' + err.message, 'error');
  }
}

async function autoExtraerDesdePdfCotizacion(file, isModal = true, ticketId = null) {
  if (!file || typeof document === 'undefined') return;
  
  _notify('Analizando PDF de cotización...', 'info');
  
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    
    let extractedDoc = null;
    let extractedMonto = null;
    let detectedClientName = null;
    let isSapMatch = false;
    let cleanText = '';
    let isFileNameMatch = false;

    const quotes = (typeof window !== 'undefined' && window._cacheCotizacionesSap) ? window._cacheCotizacionesSap : _cacheCotizacionesSap;

    if (file.name) {
      const fnMatch = file.name.match(/\b([123]10[0-9]{4})\b/) || file.name.match(/\b([0-9]{7})\b/);
      if (fnMatch) {
        const docNum = fnMatch[1];
        const found = (quotes || []).find(q => q.numero_cotizacion === docNum);
        if (found) {
          isFileNameMatch = true;
          isSapMatch = true;
          extractedDoc = found.numero_cotizacion;
          extractedMonto = found.monto;
          detectedClientName = found.cliente;
          console.log('[PDF Auto-Extract] Matched quotation from filename via SAP cache:', found);
        } else {
          extractedDoc = docNum;
        }
      }
    }

    if (!isFileNameMatch) {
      try {
        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ base64Data: base64 })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.text) {
            cleanText = result.text.replace(/\s+/g, ' ').trim();
          }
        }
      } catch (apiErr) {
        console.warn('[PDF Auto-Extract] Local backend extraction failed:', apiErr);
      }

      if (!cleanText && typeof window !== 'undefined' && typeof window.extraerTextoPdf === 'function') {
        try {
          const text = await window.extraerTextoPdf(base64);
          cleanText = text.replace(/\s+/g, ' ').trim();
        } catch (pdfjsErr) {
          console.error('[PDF Auto-Extract] Browser PDF.js failed:', pdfjsErr);
        }
      }

      console.log('[PDF Auto-Extract] Processing text parsing via Regex rules...');
      
      let detectedQuote = null;
      if (cleanText && quotes) {
        for (const q of quotes) {
          if (q.numero_cotizacion && cleanText.includes(q.numero_cotizacion)) {
            detectedQuote = q;
            break;
          }
        }
      }

      if (detectedQuote) {
        isSapMatch = true;
        extractedDoc = detectedQuote.numero_cotizacion;
        extractedMonto = detectedQuote.monto;
        detectedClientName = detectedQuote.cliente;
      } else if (cleanText) {
        const docMatch = cleanText.match(/\b([123]10[0-9]{4})\b/) || cleanText.match(/\b([0-9]{7})\b/);
        extractedDoc = docMatch ? docMatch[1] : (extractedDoc || null);
        
        const totalRegex = /(?:importe\s+total|total|importe|monto|neto)[:\s\$\-]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))/gi;
        let match;
        let maxMonto = 0;
        while ((match = totalRegex.exec(cleanText)) !== null) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (val > maxMonto) {
            maxMonto = val;
          }
        }
        if (maxMonto > 0) {
          extractedMonto = maxMonto;
        }
        
        try {
          const clients = _getClientesDb();
          const ccMatch = cleanText.match(/\b(CL[0-9]{2,6})\b/i);
          if (ccMatch) {
            const found = clients.find(c => String(c.id).toLowerCase() === ccMatch[1].toLowerCase());
            if (found) {
              detectedClientName = found.nombre;
            }
          }
          if (!detectedClientName) {
            for (const c of clients) {
              if (c.nombre && cleanText.toLowerCase().includes(c.nombre.toLowerCase())) {
                detectedClientName = c.nombre;
                break;
              }
            }
          }
        } catch(e) {}
      }
    }

    if (extractedDoc && !isSapMatch && quotes) {
      const matchInCache = quotes.find(q => q.numero_cotizacion === extractedDoc);
      if (matchInCache) {
        isSapMatch = true;
        extractedMonto = matchInCache.monto;
        detectedClientName = matchInCache.cliente;
      }
    }

    const lastPdfData = {
      doc: extractedDoc,
      monto: extractedMonto,
      cliente: detectedClientName,
      isFileNameMatch: isFileNameMatch,
      isSapMatch: isSapMatch,
      cleanText: cleanText
    };
    if (typeof window !== 'undefined') {
      window._lastPdfExtracted = lastPdfData;
    }

    if (isFileNameMatch) {
      _notify(`✅ Datos de cotización ${extractedDoc} extraídos del nombre del archivo.`, 'success');
    } else if (extractedDoc || extractedMonto) {
      let clientMsg = detectedClientName ? ` | Cliente: "${detectedClientName}"` : '';
      _notify(`⚠️ Datos extraídos del PDF (Doc: ${extractedDoc || '?'}, Monto: $${extractedMonto || '?'}${clientMsg}).`, 'warning');
    } else {
      _notify('No se pudo extraer el folio o monto del PDF.', 'info');
    }

    const tableContainerId = isModal ? 'pdf-extraction-table-container' : `quick-pdf-extraction-table-container-${ticketId}`;
    const tableContainer = document.getElementById(tableContainerId);
    if (tableContainer) {
      tableContainer.style.display = 'block';
      tableContainer.innerHTML = `
        <div class="pdf-data-table" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.75rem; font-size:0.8rem; margin-top:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
          <div style="font-weight:600; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
            <span>📋 Datos Extraídos del Archivo</span>
            <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${isFileNameMatch ? 'background:rgba(16,185,129,0.1); color:#10b981;' : (isSapMatch ? 'background:rgba(16,185,129,0.1); color:#10b981;' : 'background:rgba(245,158,11,0.1); color:#f59e0b;')} font-weight:600;">
              ${isFileNameMatch ? 'Nombre de Archivo + SAP' : (isSapMatch ? 'Coincidencia SAP' : 'Lectura de Texto')}
            </span>
          </div>
          <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); color:var(--text-muted);">
                <th style="padding:4px 8px; font-weight:500;">Dato</th>
                <th style="padding:4px 8px; font-weight:500;">Valor Extraído</th>
                <th style="padding:4px 8px; font-weight:500;">Origen</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 8px; font-weight:600;">Folio / Doc SAP</td>
                <td style="padding:6px 8px; font-family:monospace; color:var(--text-primary);">${extractedDoc || '—'}</td>
                <td style="padding:6px 8px;"><span style="font-size:0.7rem;">${isFileNameMatch ? 'Nombre del archivo' : 'Texto del PDF'}</span></td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 8px; font-weight:600;">Monto Total</td>
                <td style="padding:6px 8px; color:var(--text-primary); font-weight:600;">${extractedMonto ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(extractedMonto) : '—'}</td>
                <td style="padding:6px 8px;"><span style="font-size:0.7rem;">${isSapMatch ? 'Catálogo SAP' : 'Texto del PDF'}</span></td>
              </tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 8px; font-weight:600;">Cliente</td>
                <td style="padding:6px 8px; color:var(--text-primary);">${detectedClientName || '—'}</td>
                <td style="padding:6px 8px;"><span style="font-size:0.7rem;">${isSapMatch ? 'Catálogo SAP' : 'Texto del PDF'}</span></td>
              </tr>
            </tbody>
          </table>
          <details style="margin-top:0.25rem; color:var(--text-muted); font-size:0.72rem;">
            <summary style="cursor:pointer; user-select:none; font-weight:500;">🔍 Ver texto extraído (Diagnóstico)</summary>
            <pre style="margin-top:0.25rem; white-space:pre-wrap; background:rgba(0,0,0,0.15); padding:0.5rem; border-radius:4px; max-height:150px; overflow-y:auto; font-family:monospace; color:var(--text-secondary); border:1px solid var(--border);">${cleanText || (isFileNameMatch ? '(Sincronizado directamente desde catálogo SAP usando el nombre del archivo)' : '(Vacío)')}</pre>
          </details>
        </div>
      `;
    }

    validarCotizacionConSAP(isModal, ticketId);
  } catch (err) {
    console.error('[PDF Auto-Extract] Error reading/parsing PDF:', err);
    _notify('Error al leer el archivo PDF.', 'error');
  }
}

function clearPdfInput(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const inputId = isModal ? 't-cotizacion-pdf' : `quick-cot-pdf-${ticketId}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    if (typeof updateFileLabel === 'function') updateFileLabel(input);
    else if (typeof window !== 'undefined' && typeof window.updateFileLabel === 'function') window.updateFileLabel(input);
  }
  
  const tableId = isModal ? 'pdf-extraction-table-container' : `quick-pdf-extraction-table-container-${ticketId}`;
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    tableContainer.style.display = 'none';
    tableContainer.innerHTML = '';
  }
  
  if (typeof window !== 'undefined') {
    window._lastPdfExtracted = null;
  }

  validarCotizacionConSAP(isModal, ticketId);
  _notify('Archivo PDF removido.', 'info');
}

function checkPdfSapMatchCount(sapVal, montoVal, tClientName) {
  const pdfData = typeof window !== 'undefined' ? window._lastPdfExtracted : null;
  if (!pdfData) return 3;
  
  const quotes = (typeof window !== 'undefined' && window._cacheCotizacionesSap) ? window._cacheCotizacionesSap : _cacheCotizacionesSap;
  const found = (quotes || []).find(q => q.numero_cotizacion === sapVal);
  if (!found) return 0;
  
  const sapMonto = Number(found.monto) || 0;
  const sapCliente = found.cliente || '';
  
  let isPdfDocMatch = String(pdfData.doc || '').trim() === String(sapVal).trim();
  let isPdfMontoMatch = pdfData.monto ? Math.abs(Number(pdfData.monto) - sapMonto) < 0.05 : true;
  
  let isPdfClientMatch = true;
  if (pdfData.cliente) {
    const pClientClean = String(pdfData.cliente).toLowerCase().replace(/[^a-z0-9]/g, '');
    const sClientClean = String(sapCliente).toLowerCase().replace(/[^a-z0-9]/g, '');
    isPdfClientMatch = pClientClean.includes(sClientClean) || sClientClean.includes(pClientClean);
  }
  
  let matchCount = 0;
  if (isPdfDocMatch) matchCount++;
  if (isPdfMontoMatch) matchCount++;
  if (isPdfClientMatch) matchCount++;
  
  return matchCount;
}

async function validarCotizacionConSAP(isModal = true, ticketId = null) {
  if (typeof document === 'undefined') return;
  const sb = _getSb();
  if (!sb) return;

  const sapInputId = isModal ? 't-cotizacion-sap' : `quick-cot-sap-${ticketId}`;
  const montoInputId = isModal ? 't-cotizacion-monto' : `quick-cot-monto-${ticketId}`;
  const statusDivId = isModal ? 't-sap-validation-status' : `quick-sap-validation-status-${ticketId}`;

  const sapVal = document.getElementById(sapInputId)?.value.trim();
  const montoVal = parseFloat(document.getElementById(montoInputId)?.value) || 0;
  const statusDiv = document.getElementById(statusDivId);

  if (!statusDiv) return;

  const tId = ticketId || (typeof editandoTicketId !== 'undefined' ? editandoTicketId : null);
  const btnId = `btn-pasar-cotizacion-${tId}`;
  const btn = document.getElementById(btnId);

  const pdfInputId = isModal ? 't-cotizacion-pdf' : `quick-cot-pdf-${tId}`;
  const fileInput = document.getElementById(pdfInputId);
  
  const tkts = _getTickets();
  const ticket = tId ? tkts.find(t => t.id === tId) : null;
  const hasUploadedFile = (fileInput && fileInput.files.length > 0) || (ticket && ticket.pdfCotizacion);

  if (!sapVal) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
    if (btn) {
      const bypass = typeof window !== 'undefined' && window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      btn.disabled = !bypass;
      btn.style.opacity = bypass ? '1' : '0.5';
      btn.style.cursor = bypass ? 'pointer' : 'not-allowed';
    }
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;"><i data-lucide="loader" class="rotating" style="width:12px; height:12px;"></i> Validando con SAP...</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  try {
    const { data, error } = await sb.from('cotizaciones_sap').select('*').eq('numero_cotizacion', sapVal).maybeSingle();
    
    if (error) throw error;

    if (!data) {
      statusDiv.innerHTML = `
        <div style="padding:0.5rem 0.75rem; border-radius:6px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); font-size:0.78rem; color:#ef4444; display:flex; flex-direction:column; gap:0.25rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px; height:14px;"></i> Cotización no encontrada en SAP</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">Verifique el número ingresado o presione "Sincronizar con SAP".</div>
        </div>
      `;
      if (btn) {
        const bypass = typeof window !== 'undefined' && window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
        btn.disabled = !bypass;
        btn.style.opacity = bypass ? '1' : '0.5';
        btn.style.cursor = bypass ? 'pointer' : 'not-allowed';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const sapMonto = Number(data.monto) || 0;
    const sapCliente = data.cliente || '';
    const sapFecha = data.fecha ? new Date(data.fecha).toLocaleDateString('es-MX') : '—';
    
    let isMontoMatch = Math.abs(montoVal - sapMonto) < 0.05;
    
    const tClientName = isModal
      ? (document.getElementById('t-cliente')?.value || (ticket ? ticket.cliente : ''))
      : (ticket ? ticket.cliente : '');

    let isClientMatch = true;
    if (tClientName) {
      const tClientClean = String(tClientName).toLowerCase().replace(/[^a-z0-9]/g, '');
      const sClientClean = String(sapCliente).toLowerCase().replace(/[^a-z0-9]/g, '');
      isClientMatch = tClientClean.includes(sClientClean) || sClientClean.includes(tClientClean);
    }

    const pdfData = typeof window !== 'undefined' ? window._lastPdfExtracted : null;
    const hasPdf = !!pdfData;
    
    let isPdfDocMatch = true;
    let isPdfMontoMatch = true;
    let isPdfClientMatch = true;

    if (hasPdf) {
      isPdfDocMatch = String(pdfData.doc || '').trim() === String(sapVal).trim();
      isPdfMontoMatch = pdfData.monto ? Math.abs(Number(pdfData.monto) - sapMonto) < 0.05 : true;
      if (pdfData.cliente) {
        const pClientClean = String(pdfData.cliente).toLowerCase().replace(/[^a-z0-9]/g, '');
        const sClientClean = String(sapCliente).toLowerCase().replace(/[^a-z0-9]/g, '');
        isPdfClientMatch = pClientClean.includes(sClientClean) || sClientClean.includes(pClientClean);
      }
    }

    let matchCount = 0;
    if (isPdfDocMatch) matchCount++;
    if (isPdfMontoMatch) matchCount++;
    if (isPdfClientMatch) matchCount++;

    const isBlocked = hasPdf && (matchCount < 2);

    let comparisonTableHtml = '';
    if (hasPdf) {
      comparisonTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:0.4rem; font-size:0.7rem; text-align:left; border:1px solid ${isBlocked ? 'rgba(239,68,68,0.2)' : 'var(--border)'}; background:rgba(0,0,0,0.15); border-radius:6px; overflow:hidden;">
          <thead>
            <tr style="background:rgba(255,255,255,0.02); color:var(--text-muted); border-bottom:1px solid ${isBlocked ? 'rgba(239,68,68,0.2)' : 'var(--border)'};">
              <th style="padding:4px 6px; font-weight:500;">Dato</th>
              <th style="padding:4px 6px; font-weight:500;">En Formulario</th>
              <th style="padding:4px 6px; font-weight:500;">Extraído de PDF</th>
              <th style="padding:4px 6px; font-weight:500;">Registrado en SAP</th>
              <th style="padding:4px 6px; font-weight:500; text-align:center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Folio / Doc</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${sapVal || '—'}</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${pdfData.doc || '—'}</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${sapVal || '—'}</td>
              <td style="padding:5px 6px; text-align:center; font-weight:600; color:${isPdfDocMatch ? '#10b981' : '#ef4444'};">
                ${isPdfDocMatch ? '✔️ Coincide' : '❌ Difiere'}
              </td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Monto</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(montoVal)}</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${pdfData.monto ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(pdfData.monto) : '—'}</td>
              <td style="padding:5px 6px; font-family:monospace; color:var(--text-primary);">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sapMonto)}</td>
              <td style="padding:5px 6px; text-align:center; font-weight:600; color:${(isMontoMatch && isPdfMontoMatch) ? '#10b981' : '#ef4444'};">
                ${(isMontoMatch && isPdfMontoMatch) ? '✔️ Coincide' : '❌ Difiere'}
              </td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:5px 6px; font-weight:600; color:var(--text-secondary);">Cliente</td>
              <td style="padding:5px 6px; color:var(--text-primary);">${tClientName || '—'}</td>
              <td style="padding:5px 6px; color:var(--text-primary);">${pdfData.cliente || '—'}</td>
              <td style="padding:5px 6px; color:var(--text-primary);">${sapCliente || '—'}</td>
              <td style="padding:5px 6px; text-align:center; font-weight:600; color:${(isClientMatch && isPdfClientMatch) ? '#10b981' : '#ef4444'};">
                ${(isClientMatch && isPdfClientMatch) ? '✔️ Coincide' : '❌ Difiere'}
              </td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      comparisonTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:0.4rem; font-size:0.72rem; text-align:left; border:1px solid var(--border); background:rgba(0,0,0,0.15); border-radius:6px; overflow:hidden;">
          <thead>
            <tr style="background:rgba(255,255,255,0.02); color:var(--text-muted); border-bottom:1px solid var(--border);">
              <th style="padding:4px 6px; font-weight:500;">Concepto</th>
              <th style="padding:4px 6px; font-weight:500;">En Formulario / Ticket</th>
              <th style="padding:4px 6px; font-weight:500;">Registrado en SAP</th>
              <th style="padding:4px 6px; font-weight:500; text-align:center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:4px 6px; font-weight:600; color:var(--text-secondary);">Monto</td>
              <td style="padding:4px 6px; font-family:monospace; color:var(--text-primary);">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(montoVal)}</td>
              <td style="padding:4px 6px; font-family:monospace; color:var(--text-primary);">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(sapMonto)}</td>
              <td style="padding:4px 6px; text-align:center; font-weight:600; color:${isMontoMatch ? '#10b981' : '#ef4444'};">
                ${isMontoMatch ? '✔️ Coincide' : '❌ Difiere'}
              </td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
              <td style="padding:4px 6px; font-weight:600; color:var(--text-secondary);">Cliente</td>
              <td style="padding:4px 6px; color:var(--text-primary);">${tClientName || '—'}</td>
              <td style="padding:4px 6px; color:var(--text-primary);">${sapCliente || '—'}</td>
              <td style="padding:4px 6px; text-align:center; font-weight:600; color:${isClientMatch ? '#10b981' : '#ef4444'};">
                ${isClientMatch ? '✔️ Coincide' : '❌ Difiere'}
              </td>
            </tr>
          </tbody>
        </table>
      `;
    }

    let alertHtml = '';
    if (!isMontoMatch && montoVal > 0) {
      alertHtml += `<div>⚠️ El monto ingresado no coincide con el registrado en SAP.</div>`;
    }
    if (!isClientMatch) {
      alertHtml += `<div>⚠️ El cliente del ticket no coincide con el cliente de la cotización en SAP.</div>`;
    }
    if (hasPdf) {
      if (!isPdfDocMatch) {
        alertHtml += `<div>⚠️ El número de cotización del PDF (${pdfData.doc || '?'}) difiere de la seleccionada (${sapVal}).</div>`;
      }
      if (!isPdfMontoMatch && pdfData.monto > 0) {
        alertHtml += `<div>⚠️ El monto extraído del PDF (${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(pdfData.monto)}) difiere de SAP.</div>`;
      }
      if (!isPdfClientMatch) {
        alertHtml += `<div>⚠️ El cliente extraído del PDF (${pdfData.cliente || '?'}) difiere de SAP.</div>`;
      }
    }

    if (alertHtml || isBlocked) {
      const bg = isBlocked ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)';
      const border = isBlocked ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
      const color = isBlocked ? '#ef4444' : '#f59e0b';
      const icon = isBlocked ? 'x-circle' : 'alert-triangle';
      const title = isBlocked ? 'Validación Bloqueada' : 'Coincidencia Parcial con SAP';
      
      let blockedMessage = '';
      if (isBlocked) {
        blockedMessage = `<div style="font-weight:700; margin-top:0.35rem; border-top:1px dashed rgba(239,68,68,0.15); padding-top:0.35rem; color:#ef4444;">🚫 Acceso Bloqueado: Deben coincidir al menos 2 parámetros del PDF para avanzar a Cotización.</div>`;
      }

      statusDiv.innerHTML = `
        <div style="padding:0.6rem 0.8rem; border-radius:8px; background:${bg}; border:1px solid ${border}; font-size:0.78rem; color:${color}; display:flex; flex-direction:column; gap:0.3rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="${icon}" style="width:14px; height:14px;"></i> ${title}</div>
          <div style="font-size:0.74rem; color:${isBlocked ? '#ef4444' : '#d97706'}; display:flex; flex-direction:column; gap:1px;">
            ${alertHtml}
            ${blockedMessage}
          </div>
          ${comparisonTableHtml}
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Fecha SAP: ${sapFecha}</div>
        </div>
      `;
    } else {
      statusDiv.innerHTML = `
        <div style="padding:0.6rem 0.8rem; border-radius:8px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); font-size:0.78rem; color:#10b981; display:flex; flex-direction:column; gap:0.3rem;">
          <div style="font-weight:600; display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Cotización Validada con SAP</div>
          <div style="font-size:0.74rem; color:var(--text-muted);">El formulario, el archivo PDF y SAP coinciden plenamente.</div>
          ${comparisonTableHtml}
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Fecha SAP: ${sapFecha}</div>
        </div>
      `;
    }

    if (btn) {
      const bypass = typeof window !== 'undefined' && window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      if (isBlocked || !hasUploadedFile) {
        btn.disabled = !bypass;
        btn.style.opacity = bypass ? '1' : '0.5';
        btn.style.cursor = bypass ? 'pointer' : 'not-allowed';
      } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (errVal) {
    console.error('[SAP Validation] Error querying Supabase:', errVal);
    statusDiv.style.display = 'none';
    if (btn) {
      const bypass = typeof window !== 'undefined' && window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      btn.disabled = !bypass;
      btn.style.opacity = bypass ? '1' : '0.5';
      btn.style.cursor = bypass ? 'pointer' : 'not-allowed';
    }
  }
}

function syncSapCotizacionManual(ticketId = null) {
  if (typeof document === 'undefined') return;
  const isModal = !ticketId;
  const btnId = isModal ? 'btn-sync-sap-cot' : `btn-sync-sap-cot-${ticketId}`;
  const btn = document.getElementById(btnId);
  sincronizarConGitHub('cotizaciones', btn);
}

// ==========================================
// EXPOSICIÓN GLOBAL HACIA WINDOW
// ==========================================

if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
  window.fetchSapApi = fetchSapApi;
  window.fetchClientesSAP = fetchClientesSAP;
  window.fetchRefaccionesSAP = fetchRefaccionesSAP;
  window.fetchTecnicosSAP = fetchTecnicosSAP;
  window.fetchSitiosSAP = fetchSitiosSAP;
  window.fetchMaquinariaSAP = fetchMaquinariaSAP;
  window.forzarSincronizacionSAP = forzarSincronizacionSAP;
  window.sincronizarModuloSAP = sincronizarModuloSAP;
  window.sincronizarUnCliente = sincronizarUnCliente;
  window.sincronizarConGitHub = sincronizarConGitHub;
  window.renderLinkedCotizaciones = renderLinkedCotizaciones;
  window.togglePasarCotizacionBtn = togglePasarCotizacionBtn;
  window.deleteLinkedCotizacion = deleteLinkedCotizacion;
  window.viewLinkedCotizacionPdf = viewLinkedCotizacionPdf;
  window.vincularNuevaCotizacion = vincularNuevaCotizacion;
  window.initSearchableSelect = initSearchableSelect;
  window.poblarCotizacionesDropdown = poblarCotizacionesDropdown;
  window.poblarPedidosDropdown = poblarPedidosDropdown;
  window.onModalPedidoSelected = onModalPedidoSelected;
  window.onQuickPedidoSelected = onQuickPedidoSelected;
  window.autoExtraerDesdePdfPedido = autoExtraerDesdePdfPedido;
  window.clearPdfPedidoInput = clearPdfPedidoInput;
  window.validarPedidoConSAP = validarPedidoConSAP;
  window.syncSapPedidoManual = syncSapPedidoManual;
  window.onModalCotizacionSelected = onModalCotizacionSelected;
  window.onQuickCotizacionSelected = onQuickCotizacionSelected;
  autoExtraerDesdePdfCotizacion && (window.autoExtraerDesdePdfCotizacion = autoExtraerDesdePdfCotizacion);
  window.clearPdfInput = clearPdfInput;
  window.checkPdfSapMatchCount = checkPdfSapMatchCount;
  window.validarCotizacionConSAP = validarCotizacionConSAP;
  window.syncSapCotizacionManual = syncSapCotizacionManual;
  const allModuleExports = {
    API_CONFIG,
    fetchSapApi,
    fetchClientesSAP,
    fetchRefaccionesSAP,
    fetchTecnicosSAP,
    fetchSitiosSAP,
    fetchMaquinariaSAP,
    forzarSincronizacionSAP,
    sincronizarModuloSAP,
    sincronizarUnCliente,
    sincronizarConGitHub,
    renderLinkedCotizaciones,
    togglePasarCotizacionBtn,
    deleteLinkedCotizacion,
    viewLinkedCotizacionPdf,
    vincularNuevaCotizacion,
    initSearchableSelect,
    poblarCotizacionesDropdown,
    poblarPedidosDropdown,
    onModalPedidoSelected,
    onQuickPedidoSelected,
    autoExtraerDesdePdfPedido,
    clearPdfPedidoInput,
    validarPedidoConSAP,
    syncSapPedidoManual,
    onModalCotizacionSelected,
    onQuickCotizacionSelected,
    autoExtraerDesdePdfCotizacion,
    clearPdfInput,
    checkPdfSapMatchCount,
    validarCotizacionConSAP,
    syncSapCotizacionManual
  };
  window.SapSync = allModuleExports;
}

export {
  API_CONFIG,
  fetchSapApi,
  fetchClientesSAP,
  fetchRefaccionesSAP,
  fetchTecnicosSAP,
  fetchSitiosSAP,
  fetchMaquinariaSAP,
  forzarSincronizacionSAP,
  sincronizarModuloSAP,
  sincronizarUnCliente,
  sincronizarConGitHub,
  renderLinkedCotizaciones,
  togglePasarCotizacionBtn,
  deleteLinkedCotizacion,
  viewLinkedCotizacionPdf,
  vincularNuevaCotizacion,
  initSearchableSelect,
  poblarCotizacionesDropdown,
  poblarPedidosDropdown,
  onModalPedidoSelected,
  onQuickPedidoSelected,
  autoExtraerDesdePdfPedido,
  clearPdfPedidoInput,
  validarPedidoConSAP,
  syncSapPedidoManual,
  onModalCotizacionSelected,
  onQuickCotizacionSelected,
  autoExtraerDesdePdfCotizacion,
  clearPdfInput,
  checkPdfSapMatchCount,
  validarCotizacionConSAP,
  syncSapCotizacionManual
};
