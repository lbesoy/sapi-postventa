/**
 * MÓDULO DE MAPEO DE COLUMNAS SAP Y QUERIES SQL
 * Eurorep / SAPI - ES Module
 */

// Fallbacks y polyfills defensivos para Node.js y ambientes desacoplados
if (typeof globalThis.configData === "undefined") {
  globalThis.configData = (typeof localStorage !== "undefined")
    ? JSON.parse(localStorage.getItem("eurorep_config") || "{}")
    : { mappings: {} };
}

const _notify = (msg, tipo = "info") => {
  if (typeof mostrarNotificacion === "function") return mostrarNotificacion(msg, tipo);
  if (typeof window !== "undefined" && typeof window.mostrarNotificacion === "function") return window.mostrarNotificacion(msg, tipo);
  console.log("[" + tipo.toUpperCase() + "] " + msg);
};

const _fetchSap = (...args) => {
  if (typeof fetchSapApi === "function") return fetchSapApi(...args);
  if (typeof window !== "undefined" && typeof window.fetchSapApi === "function") return window.fetchSapApi(...args);
  return Promise.reject(new Error("fetchSapApi no disponible"));
};

// ==========================================
// MAPEO DE COLUMNAS SAP (NO-CODE)
// ==========================================
function abrirModalMapeo() {
  if (typeof document === "undefined") return;
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
  if (typeof document === "undefined") return {};
  const labels = {};
  document.querySelectorAll('input[id^="lbl-' + mod + '-"]').forEach(el => {
    const key = el.id.replace('lbl-' + mod + '-', '');
    labels[key] = el.value.trim();
  });
  return labels;
}

function applyTableHeaders() {
  if (typeof document === "undefined") return;
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
  if (typeof document === "undefined") return;
  document.getElementById('modal-mapeo-columnas').classList.remove('open');
}

function switchMapeoTab(tabId) {
  if (typeof document === "undefined") return;
  document.querySelectorAll('.mapeo-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="tab-mapeo-"]').forEach(el => el.classList.remove('active'));
  
  document.getElementById('mapeo-content-' + tabId).style.display = 'block';
  document.getElementById('tab-mapeo-' + tabId).classList.add('active');
}

function addCustomColumnUI(module, label = '', key = '') {
  if (typeof document === "undefined") return;
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
  if (typeof document === "undefined") return;
  const table = document.querySelector(`#mapeo-content-${module} table`);
  if (!table) return;
  const elements = table.querySelectorAll(`[data-col-id="${colId}"]`);
  elements.forEach(el => el.remove());
}

function getCustomColumnsForModule(module) {
  if (typeof document === "undefined") return [];
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
  if (typeof document === "undefined") return;
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
  if (typeof document === "undefined") return;
  try {
    const res = await fetchSapApi(`/sap/queries?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fallo al obtener queries');

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
  if (typeof document === "undefined") return;
  if (!sqlCode) {
    limpiarFormularioQuery();
    return;
  }
  const q = listaQueriesCargada.find(x => x.SqlCode === sqlCode);
  if (q) {
    const qCode = document.getElementById('query-code');
    const qName = document.getElementById('query-name');
    const qSql = document.getElementById('query-sql');
    const qResults = document.getElementById('query-results-container');
    
    if (qCode) qCode.value = q.SqlCode;
    if (qName) qName.value = q.SqlName || '';
    if (qSql) qSql.value = q.SqlText || '';
    if (qCode) qCode.readOnly = true;
    if (qResults) qResults.style.display = 'none';
  }
}

function limpiarFormularioQuery() {
  if (typeof document === "undefined") return;
  const qSelector = document.getElementById('query-selector');
  const qCode = document.getElementById('query-code');
  const qName = document.getElementById('query-name');
  const qSql = document.getElementById('query-sql');
  const qResults = document.getElementById('query-results-container');

  if (qSelector) qSelector.value = '';
  if (qCode) {
    qCode.value = '';
    qCode.readOnly = false;
  }
  if (qName) qName.value = '';
  if (qSql) qSql.value = '';
  if (qResults) qResults.style.display = 'none';
}

async function programarQuerySAP() {
  if (typeof document === "undefined") return;
  const qCode = document.getElementById('query-code');
  const qName = document.getElementById('query-name');
  const qSql = document.getElementById('query-sql');
  
  let sqlCode = qCode ? qCode.value.trim() : '';
  let sqlName = qName ? qName.value.trim() : '';
  let rawSqlText = qSql ? qSql.value.trim() : '';

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
    const res = await fetchSapApi(`/sap/queries`, {
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
    if (qCode) qCode.value = '';
    if (qName) qName.value = '';
    if (qSql) qSql.value = '';
    
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
  if (typeof document === "undefined") return;
  const qCode = document.getElementById('query-code');
  const sqlCode = qCode ? qCode.value.trim() : '';
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
  if (resultsContainer) resultsContainer.style.display = 'none';

  try {
    const res = await fetchSapApi(`/sap/queries/${encodeURIComponent(sqlCode)}/execute?_t=${Date.now()}`, {
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
    
    if (resultsOutput) resultsOutput.textContent = JSON.stringify(data.data, null, 2);
    if (resultsContainer) resultsContainer.style.display = 'block';
    mostrarNotificacion('Query ejecutado correctamente.', 'success');
  } catch (err) {
    console.error(err);
    // Verificar si el error es de que el query no existe
    let userMsg = err.message;
    if (userMsg.includes('does not exist') || userMsg.includes('Not Found') || userMsg.includes('-2028')) {
      userMsg = 'Este query NO existe en SAP. Asegúrate de presionar "Guardar y Enviar a SAP" primero y que se haya guardado con éxito (alerta verde en la esquina).';
    }
    if (resultsOutput) resultsOutput.textContent = `Fallo al Ejecutar:\n${userMsg}`;
    if (resultsContainer) resultsContainer.style.display = 'block';
    mostrarNotificacion('Error al ejecutar el query.', 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
    lucide.createIcons();
  }
}

async function eliminarQuerySAP() {
  if (typeof document === "undefined") return;
  const qCode = document.getElementById('query-code');
  const sqlCode = qCode ? qCode.value.trim() : '';
  if (!sqlCode) {
    mostrarNotificacion('Selecciona un Query para eliminar.', 'error');
    return;
  }
  
  const confirmado = await window.confirmarAccion({
    titulo: 'Eliminar Query',
    mensaje: `¿Estás seguro de que deseas eliminar el query "${sqlCode}" directamente de SAP? Esta acción no se puede deshacer.`,
    esPeligroso: true,
    icono: 'alert-triangle'
  });
  if (!confirmado) return;
  
  const btn = event.target.closest('button');
  const orig = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin-right:5px;"></div> Eliminando...';
  btn.disabled = true;

  try {
    const res = await fetchSapApi(`/sap/queries/${encodeURIComponent(sqlCode)}`, {
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

// Exponer en window para retrocompatibilidad total con el navegador y eventos HTML inline
if (typeof window !== "undefined") {
  window.abrirModalMapeo = abrirModalMapeo;
  window.getLabelsForModule = getLabelsForModule;
  window.applyTableHeaders = applyTableHeaders;
  window.cerrarModalMapeo = cerrarModalMapeo;
  window.switchMapeoTab = switchMapeoTab;
  window.addCustomColumnUI = addCustomColumnUI;
  window.removeCustomColumn = removeCustomColumn;
  window.getCustomColumnsForModule = getCustomColumnsForModule;
  window.guardarMapeoColumnas = guardarMapeoColumnas;
  window.listaQueriesCargada = listaQueriesCargada;
  window.cargarListaQueriesSAP = cargarListaQueriesSAP;
  window.cargarDetalleQuery = cargarDetalleQuery;
  window.limpiarFormularioQuery = limpiarFormularioQuery;
  window.programarQuerySAP = programarQuerySAP;
  window.probarQuerySAP = probarQuerySAP;
  window.eliminarQuerySAP = eliminarQuerySAP;
  const allModuleExports = {
    abrirModalMapeo,
    getLabelsForModule,
    applyTableHeaders,
    cerrarModalMapeo,
    switchMapeoTab,
    addCustomColumnUI,
    removeCustomColumn,
    getCustomColumnsForModule,
    guardarMapeoColumnas,
    listaQueriesCargada,
    cargarListaQueriesSAP,
    cargarDetalleQuery,
    limpiarFormularioQuery,
    programarQuerySAP,
    probarQuerySAP,
    eliminarQuerySAP
  };
  window.SapMapper = allModuleExports;
}

export {
  abrirModalMapeo,
  getLabelsForModule,
  applyTableHeaders,
  cerrarModalMapeo,
  switchMapeoTab,
  addCustomColumnUI,
  removeCustomColumn,
  getCustomColumnsForModule,
  guardarMapeoColumnas,
  listaQueriesCargada,
  cargarListaQueriesSAP,
  cargarDetalleQuery,
  limpiarFormularioQuery,
  programarQuerySAP,
  probarQuerySAP,
  eliminarQuerySAP
};
