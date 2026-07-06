/**
 * sync-sap-supabase.js
 * ─────────────────────────────────────────────────────────────────
 * Script de sincronización automática SAP → Supabase.
 * Corre desde cualquier máquina con acceso a la red de SAP.
 * 
 * Uso manual:    node sync-sap-supabase.js
 * Cron diario:   0 7 * * 1-5  (lunes-viernes a las 7am)
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const axios = require('axios');
const https = require('https');
const fs = require('fs');

// ── Configuración ─────────────────────────────────────────────────
const SAP_URL      = process.env.SAP_SL_URL;
const SAP_DB       = process.env.SAP_COMPANY_DB;
const SAP_USER     = process.env.SAP_USER;
const SAP_PASS     = process.env.SAP_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mupevytlssqcbhlmzmcp.supabase.co';
// Preferir la Service Role Key si está presente para evitar restricciones de RLS en el servidor
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.warn('[Sync] Advertencia: Usando credenciales de Supabase por defecto (no provistas en entorno).');
}

// Queries configurados (se sobreescriben con la config de Supabase)
let QUERIES = {
  clientes:    'eurorep_clientes',
  refacciones: 'CAT_REFACCIONES',
  sitios:      'CAT_Sitos',
  tecnicos:    'eurorep_tecnicos',
  cotizaciones: 'eurorep_cotizaciones',
  pedidos:     'eurorep_pedidos'
};

// Mapeos configurados (se sobreescriben con la config de Supabase)
let MAPPINGS = {
  sitios: null,
  maquinaria: null
};

// Configuración segura del HTTPS Agent para conectar con SAP Business One (Service Layer)
// En producción valida los certificados estrictamente (rejectUnauthorized: true) por defecto.
// Permite deshabilitarlo localmente mediante la variable SAP_REJECT_UNAUTHORIZED=false en el archivo .env privado.
const agentOptions = {
  rejectUnauthorized: process.env.SAP_REJECT_UNAUTHORIZED === 'true'
};

// Carga segura del certificado CA en caso de usar un certificado SAP autofirmado
if (process.env.SAP_CA_CERT_PATH) {
  try {
    agentOptions.ca = fs.readFileSync(process.env.SAP_CA_CERT_PATH);
  } catch (err) {
    console.error('❌ Error al cargar el certificado CA de SAP desde la ruta:', process.env.SAP_CA_CERT_PATH, err.message);
  }
}

const agent = new https.Agent(agentOptions);
const sapApi = axios.create({ httpsAgent: agent, timeout: 60000 });
let sessionId = null;

// ── Helper: log con timestamp ─────────────────────────────────────
const log = (msg) => console.log(`[${new Date().toLocaleTimeString('es-MX')}] ${msg}`);
const err = (msg) => console.error(`[${new Date().toLocaleTimeString('es-MX')}] ❌ ${msg}`);

// ── 1. Login a SAP ────────────────────────────────────────────────
async function loginSAP() {
  log('Iniciando sesión en SAP B1...');
  const res = await axios.post(`${SAP_URL}/Login`, {
    CompanyDB: SAP_DB, UserName: SAP_USER, Password: SAP_PASS
  }, { httpsAgent: agent, timeout: 30000 });
  sessionId = res.data.SessionId;
  sapApi.defaults.headers.common['Cookie'] = `B1SESSION=${sessionId}`;
  log(`✅ Login SAP exitoso.`);
}

// ── 2. Obtener datos de un query SAP ─────────────────────────────
async function fetchQuery(queryCode) {
  const res = await sapApi.get(`${SAP_URL}/SQLQueries('${queryCode}')/List`, {
    headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' }
  });
  return res.data.value || [];
}

// ── 3. Upsert batch a Supabase ────────────────────────────────────
async function upsertSupabase(tabla, rows) {
  if (!rows || rows.length === 0) return;
  // Supabase REST API acepta arrays de hasta 1000 filas por request
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const chunk = rows.slice(i, i + BATCH);
    const res = await axios.post(
      `${SUPABASE_URL}/rest/v1/${tabla}`,
      chunk,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        }
      }
    );
    if (res.status >= 400) throw new Error(`Supabase error ${res.status}: ${JSON.stringify(res.data)}`);
    inserted += chunk.length;
  }
  return inserted;
}

async function fetchClientesFromSAP() {
  try {
    log('Consultando clientes vía SQL Query...');
    const res = await sapApi.get(`${SAP_URL}/SQLQueries('${QUERIES.clientes}')/List`, {
      headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' },
      timeout: 8000
    });
    if (res.data && res.data.value) {
      log(`✅ Clientes obtenidos vía SQL Query (${res.data.value.length} registros).`);
      return res.data.value;
    }
  } catch (errQ) {
    log(`⚠️ SQL Query falló o dio timeout: ${errQ.message}. Intentando fallback nativo OData...`);
  }

  try {
    let url = `${SAP_URL}/BusinessPartners?$filter=CardType eq 'cCustomer' and GroupCode eq 100`;
    let allClients = [];
    let page = 1;

    while (url) {
      log(`- Fetching OData page ${page}...`);
      const bpRes = await sapApi.get(url, { timeout: 15000 });
      const items = bpRes.data.value || [];
      allClients = allClients.concat(items);
      url = bpRes.data['odata.nextLink'] ? `${SAP_URL}/${bpRes.data['odata.nextLink']}` : null;
      page++;
    }

    log(`✅ Clientes obtenidos vía OData nativo (${allClients.length} registros).`);
    return allClients.map(c => ({
      CardCode: c.CardCode,
      CardName: c.CardName,
      LicTradNum: c.FederalTaxID,
      E_Mail: c.EmailAddress,
      Phone1: c.Phone1,
      Balance: c.Balance,
      OrdersBal: c.OrdersBal
    }));
  } catch (errO) {
    log(`❌ Fallback nativo OData también falló: ${errO.message}`);
    throw new Error('No se pudieron obtener clientes de SAP usando ningún método.');
  }
}

async function syncClientes() {
  log('Sincronizando Clientes...');
  
  const raw = await fetchClientesFromSAP();
  const rows = raw.map(bp => {
    const idVal = bp.CardCode || null;
    
    return {
      id:          idVal,
      nombre:      bp.CardName || 'Sin Nombre',
      rfc:         bp.LicTradNum || '',
      email:       bp.E_Mail || '',
      telefono:    bp.Phone1 || '',
      id_fiscal:   bp.LicTradNum || ''
    };
  }).filter(r => r.id);  // Solo los que tienen ID válido
  
  const n = await upsertSupabase('clientes', rows);
  log(`✅ Clientes: ${n} registros sincronizados a Supabase.`);

  // Guardar saldos en la tabla config (id: 'saldos_sap') para evitar problemas de schema
  try {
    const saldosData = {};
    raw.forEach(bp => {
      const idVal = bp.CardCode;
      if (idVal) {
        saldosData[idVal] = {
          saldoCuenta: bp.Balance || 0,
          saldoOrdenes: bp.OrdersBal || 0
        };
      }
    });
    
    await axios.post(
      `${SUPABASE_URL}/rest/v1/config`,
      { id: 'saldos_sap', data: saldosData },
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        }
      }
    );
    log(`✅ Saldos de clientes guardados en config ('saldos_sap').`);
  } catch (e) {
    err(`Error al guardar saldos en config: ${e.message}`);
  }
}

async function syncRefacciones() {
  log('Sincronizando Refacciones...');
  
  // Como OITB está bloqueado en SQLQueries, obtenemos los grupos vía OData estándar
  let groupMap = {};
  try {
    const grpRes = await sapApi.get(`${SAP_URL}/ItemGroups`, { headers: { 'Cookie': sessionId } });
    if (grpRes.data && grpRes.data.value) {
      grpRes.data.value.forEach(g => {
        groupMap[g.Number] = g.GroupName;
      });
    }
  } catch (err) {
    log(`⚠️ Advertencia: No se pudieron obtener los grupos de SAP (${err.message})`);
  }

  // Obtener marcas vía UserTableRows (endpoint correcto para UDTs en SAP Service Layer)
  let marcaMap = {};
  try {
    const marcaRes = await sapApi.get(`${SAP_URL}/UserTableRows('OK_MARCA')?$select=Code,Name&$top=500`);
    if (marcaRes.data && marcaRes.data.value) {
      marcaRes.data.value.forEach(m => {
        if (m.Code) marcaMap[m.Code] = m.Name;
      });
      log(`✅ Marcas cargadas: ${Object.keys(marcaMap).length} registros.`);
    }
  } catch (e1) {
    log(`⚠️ UserTableRows falló: ${e1.message}. Intentando via query SAP...`);
    // Fallback: intentar un query SAP dedicado solo para marcas
    try {
      await sapApi.post(`${SAP_URL}/SQLQueries`, { SqlCode: 'TMP_MARCAS', SqlName: 'TMP_MARCAS', SqlText: 'SELECT "Code", "Name" FROM "SBO_SAPI"."@OK_MARCA"' });
    } catch (_) {}
    try {
      const r2 = await sapApi.get(`${SAP_URL}/SQLQueries('TMP_MARCAS')/List`);
      if (r2.data && r2.data.value) {
        r2.data.value.forEach(m => { if (m.Code) marcaMap[m.Code] = m.Name; });
        log(`✅ Marcas cargadas (fallback query): ${Object.keys(marcaMap).length} registros.`);
      }
    } catch (e2) {
      log(`⚠️ No se pudieron obtener marcas (${e2.message}). Usando código como nombre.`);
    }
  }

  const raw = await fetchQuery(QUERIES.refacciones);
  const rows = raw.map(r => {
    const idVal = r.ItemCode || r.CodigoArticulo || r.Codigo || r.ItemNum || r.ID || null;
    const origen = (idVal && (idVal.endsWith('N') || idVal.endsWith('n'))) ? 'Nacional' : 'Importado';
    const itmsGrpNam = groupMap[r.ItmsGrpCod] || r.ItmsGrpNam || '';
    const marcaCode = r.MarcaCode || r.U_MARCA || '';
    const marcaName = marcaMap[marcaCode] || marcaCode || 'N/A';
    
    return {
      id:          idVal,
      codigo:      idVal || '',
      descripcion: r.ItemName || r.NombreArticulo || r.Dscription || r.Nombre || r.Descripcion || r.Desc || '',
      precio:      parseFloat(r.Price || r.Precio || r.PriceList || 0) || 0,
      moneda:      r.Currency || r.Moneda || 'MXN',
      stock:       parseInt(r.OnHand || r.Stock || r.EnAlmacen || r.Cantidad || 0) || 0,
      custom_data: {
        marca: marcaName,
        grupo: itmsGrpNam,
        ItmsGrpCod: r.ItmsGrpCod,
        origen: origen,
        nombre: r.ItemName || r.Descripcion || ''
      }
    };
  }).filter(r => r.id);
  const n = await upsertSupabase('refacciones', rows);
  log(`✅ Refacciones: ${n} registros sincronizados a Supabase.`);
}

async function syncSitios() {
  log('Sincronizando Sitios...');
  const raw = await fetchQuery(QUERIES.sitios);
  const m = MAPPINGS.sitios || {};
  
  const rows = raw.map(s => {
    return {
      id:       s[m.id] || s.Address || s.AddressName || null,
      nombre:   s[m.nombre] || s.AddressName || s.Street || s.Address || 'Sitio Sin Nombre',
      cliente:  s[m.cliente] || s.BPCode || s.CardCode || s.Cliente || '',
      direccion:s[m.direccion] || s.Block || s.Street || '',
      cp:       s[m.cp] || s.ZipCode || '',
      ciudad:   s[m.ciudad] || s.City || '',
      estado:   s[m.estado] || s.State || '',
      custom_data: {}
    };
  }).filter(r => r.id);
  
  const n = await upsertSupabase('sitios', rows);
  log(`✅ Sitios: ${n} registros sincronizados a Supabase.`);
}

async function fetchTecnicosFromSAP() {
  try {
    log('Consultando técnicos vía SQL Query...');
    const res = await sapApi.get(`${SAP_URL}/SQLQueries('${QUERIES.tecnicos}')/List`, {
      headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' },
      timeout: 8000
    });
    if (res.data && res.data.value) {
      log(`✅ Técnicos obtenidos vía SQL Query (${res.data.value.length} registros).`);
      return res.data.value.map(t => ({
        id:          (t.empID || t.EmployeeID || t.firstName || '').toString(),
        nombre:      t.firstName ? `${t.firstName} ${t.lastName || ''}`.trim() : t.Name || 'Sin Nombre',
        tipoUsuario: t.jobTitle || t.Position || 'tecnico',
        departamento: t.dept || t.Department || '',
        email:       t.email || '',
        telefono:    t.mobile || t.officeExt || '',
        activo:      true,
        custom_data: {}
      }));
    }
  } catch (errQ) {
    log(`⚠️ SQL Query de técnicos falló o no existe: ${errQ.message}. Intentando fallback nativo a SalesPersons...`);
  }

  try {
    const filterStr = "SalesEmployeeCode ne -1 and Active eq 'tYES' and Fax ne 'N/A' and Fax ne null";
    const queryParams = `$select=Remarks,SalesEmployeeCode,SalesEmployeeName,Fax,Mobile&$filter=${encodeURIComponent(filterStr)}&$orderby=Remarks asc`;
    
    log('Consultando técnicos vía OData SalesPersons...');
    const response = await sapApi.get(`${SAP_URL}/SalesPersons?${queryParams}`, { timeout: 15000 });
    const items = response.data.value || [];
    log(`✅ Técnicos obtenidos vía SalesPersons nativo (${items.length} registros).`);
    
    return items.map(t => ({
      id:          t.SalesEmployeeCode ? t.SalesEmployeeCode.toString() : null,
      nombre:      t.SalesEmployeeName || 'Sin Nombre',
      tipoUsuario: t.Fax || 'tecnico',
      departamento: t.Remarks || 'Ventas',
      email:       '',
      telefono:    t.Mobile || '',
      activo:      true,
      custom_data: {}
    }));
  } catch (errO) {
    log(`❌ Fallback nativo de técnicos también falló: ${errO.message}`);
    throw new Error('No se pudieron obtener técnicos de SAP usando ningún método.');
  }
}

async function syncTecnicos() {
  log('Sincronizando Técnicos...');
  try {
    const rows = await fetchTecnicosFromSAP();
    const validRows = rows.filter(r => r.id);
    
    try {
      const n = await upsertSupabase('tecnicos', validRows);
      log(`✅ Técnicos: ${n} registros sincronizados a Supabase.`);
    } catch (supaErr) {
      if (supaErr.message?.includes('404') || (supaErr.response && supaErr.response.status === 404)) {
        log(`⚠️ Advertencia: La tabla 'tecnicos' no existe en Supabase (404). Omitiendo persistencia en Supabase.`);
      } else {
        throw supaErr;
      }
    }
  } catch (err) {
    log(`⚠️ Advertencia: Sincronización de técnicos falló de forma no crítica: ${err.message}`);
    // No relanzamos el error para evitar romper la sincronización general (ej. clientes/refacciones/sitios)
  }
}

async function loadConfigFromSupabase() {
  try {
    const res = await axios.get(
      `${SUPABASE_URL}/rest/v1/config?id=eq.main&select=data`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (res.data && res.data.length > 0 && res.data[0].data) {
      const config = res.data[0].data;
      if (config.queryClientes) QUERIES.clientes = config.queryClientes;
      if (config.queryRefacciones) QUERIES.refacciones = config.queryRefacciones;
      if (config.querySitios) QUERIES.sitios = config.querySitios;
      if (config.queryTecnicos) QUERIES.tecnicos = config.queryTecnicos;
      if (config.queryCotizaciones) QUERIES.cotizaciones = config.queryCotizaciones;
      if (config.queryPedidos) QUERIES.pedidos = config.queryPedidos;
      // if (config.mappings && config.mappings.sitios) MAPPINGS.sitios = config.mappings.sitios; // DESHABILITADO temporalmente
      // if (config.mappings && config.mappings.maquinaria) MAPPINGS.maquinaria = config.mappings.maquinaria; // DESHABILITADO temporalmente
      log('⚙️ Configuración de queries cargada desde la nube.');
    }
  } catch (err) {
    log(`⚠️ Advertencia: No se pudo cargar config de la nube (${err.message}). Usando defaults.`);
  }
}

async function fetchCotizacionesFromSAP() {
  try {
    log(`Consultando cotizaciones vía SQL Query '${QUERIES.cotizaciones}'...`);
    const res = await sapApi.get(`${SAP_URL}/SQLQueries('${QUERIES.cotizaciones}')/List`, {
      headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' },
      timeout: 15000
    });
    if (res.data && res.data.value) {
      log(`✅ Cotizaciones obtenidas vía SQL Query (${res.data.value.length} registros).`);
      return res.data.value.map(q => ({
        numero_cotizacion: (q['Folio Pedido'] || q.DocNum || '').toString(),
        fecha: q.DocDate ? new Date(q.DocDate).toISOString() : null,
        monto: q['Importe MXN'] !== undefined ? Number(q['Importe MXN']) : (q.DocTotal !== undefined ? Number(q.DocTotal) : null),
        cliente: q.Nombre || q.CardName || null
      }));
    }
  } catch (errQ) {
    log(`⚠️ SQL Query de cotizaciones falló o no existe: ${errQ.message}. Intentando fallback nativo a OData Quotations...`);
  }

  // Fallback a OData estándar de SAP (Quotations)
  try {
    log('Consultando cotizaciones de SAP (OData)...');
    let url = `${SAP_URL}/Quotations?$select=DocNum,DocDate,DocTotal,CardName,Cancelled&$filter=Cancelled eq 'tNO'`;
    let allQuotes = [];
    let page = 1;

    while (url) {
      log(`- Obteniendo página ${page} de cotizaciones...`);
      const qRes = await sapApi.get(url, { timeout: 15000 });
      const items = qRes.data.value || [];
      allQuotes = allQuotes.concat(items);
      url = qRes.data['odata.nextLink'] ? `${SAP_URL}/${qRes.data['odata.nextLink']}` : null;
      page++;
      if (page > 100) break;
    }

    log(`✅ Cotizaciones obtenidas de SAP (${allQuotes.length} registros).`);
    return allQuotes.map(q => ({
      numero_cotizacion: q.DocNum ? q.DocNum.toString() : null,
      fecha: q.DocDate ? new Date(q.DocDate).toISOString() : null,
      monto: q.DocTotal !== undefined ? Number(q.DocTotal) : null,
      cliente: q.CardName || null
    }));
  } catch (errFallback) {
    log(`❌ Fallback nativo de cotizaciones también falló: ${errFallback.message}`);
    throw errFallback;
  }
}

async function syncCotizaciones() {
  log('Sincronizando Cotizaciones SAP...');
  try {
    const rows = await fetchCotizacionesFromSAP();
    const validRows = rows.filter(r => r.numero_cotizacion);
    
    try {
      const n = await upsertSupabase('cotizaciones_sap', validRows);
      log(`✅ Cotizaciones SAP: ${n} registros sincronizados a Supabase.`);
    } catch (supaErr) {
      if (supaErr.message?.includes('404') || (supaErr.response && supaErr.response.status === 404)) {
        log(`⚠️ Advertencia: La tabla 'cotizaciones_sap' no existe en Supabase (404). Omitiendo persistencia.`);
      } else {
        throw supaErr;
      }
    }
  } catch (err) {
    log(`⚠️ Advertencia: Sincronización de cotizaciones SAP falló de forma no crítica: ${err.message}`);
  }
}

async function fetchPedidosFromSAP() {
  let res;
  try {
    log(`Consultando pedidos vía SQL Query '${QUERIES.pedidos}'...`);
    try {
      res = await sapApi.get(`${SAP_URL}/SQLQueries('${QUERIES.pedidos}')/List`, {
        headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' },
        timeout: 15000
      });
    } catch (errGet) {
      if (errGet.response && errGet.response.status === 404) {
        log(`ℹ️ La Query '${QUERIES.pedidos}' no existe en SAP. Intentando crearla automáticamente...`);
        const sqlText = `SELECT T0."DocEntry" AS "ID DocInternal", T0."DocNum" AS "Folio Pedido", T0."CardCode" AS "ID_Cliente", T0."CardName" AS "Nombre", T0."DocDate", T0."DocDueDate" AS "Fecha Entrega", T0."DocCur", T0."DocTotalFC" as "Importe ME", T0."DocTotal" as "Importe MXN", CASE WHEN T0."SlpCode" = '-1' THEN 'SIN Vendedor' ELSE T2."SlpName" END AS "Vendedor" FROM ORDR T0 LEFT JOIN OSLP T2 ON T0."SlpCode" = T2."SlpCode" WHERE T0."CANCELED" = 'N' ORDER BY T0."DocDate", T0."DocNum"`;
        await sapApi.post(`${SAP_URL}/SQLQueries`, {
          SqlCode: QUERIES.pedidos,
          SqlName: "Eurorep Pedidos",
          SqlText: sqlText
        });
        log(`✅ Query '${QUERIES.pedidos}' creada con éxito en SAP. Volviendo a consultar...`);
        res = await sapApi.get(`${SAP_URL}/SQLQueries('${QUERIES.pedidos}')/List`, {
          headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' },
          timeout: 15000
        });
      } else {
        throw errGet;
      }
    }

    if (res && res.data && res.data.value) {
      log(`✅ Pedidos obtenidos vía SQL Query (${res.data.value.length} registros).`);
      return res.data.value.map(q => ({
        numero_pedido: (q['Folio Pedido'] || q.DocNum || '').toString(),
        fecha: q.DocDate ? new Date(q.DocDate).toISOString() : null,
        fecha_entrega: q.DocDueDate || q['Fecha Entrega'] ? new Date(q.DocDueDate || q['Fecha Entrega']).toISOString() : null,
        monto: q['Importe MXN'] !== undefined ? Number(q['Importe MXN']) : (q.DocTotal !== undefined ? Number(q.DocTotal) : null),
        moneda: q.DocCur || null,
        cliente_id: q.CardCode || q['ID_Cliente'] || null,
        cliente_nombre: q.CardName || q.Nombre || null,
        vendedor: q.Vendedor || null
      }));
    }
  } catch (errQ) {
    log(`⚠️ SQL Query de pedidos falló o no se pudo crear: ${errQ.message}. Intentando fallback nativo a OData Orders...`);
  }

  // Fallback a OData estándar de SAP (Orders)
  try {
    log('Consultando pedidos de SAP (OData)...');
    let url = `${SAP_URL}/Orders?$select=DocNum,DocDate,DocDueDate,DocTotal,DocTotalFC,DocCur,CardCode,CardName,SalesPersonCode,Cancelled&$filter=Cancelled eq 'tNO'`;
    let allOrders = [];
    let page = 1;

    while (url) {
      log(`- Obteniendo página ${page} de pedidos...`);
      const qRes = await sapApi.get(url, { timeout: 15000 });
      const items = qRes.data.value || [];
      allOrders = allOrders.concat(items);
      url = qRes.data['odata.nextLink'] ? `${SAP_URL}/${qRes.data['odata.nextLink']}` : null;
      page++;
      if (page > 100) break;
    }

    log(`✅ Pedidos obtenidos de SAP (${allOrders.length} registros).`);
    return allOrders.map(q => ({
      numero_pedido: q.DocNum ? q.DocNum.toString() : null,
      fecha: q.DocDate ? new Date(q.DocDate).toISOString() : null,
      fecha_entrega: q.DocDueDate ? new Date(q.DocDueDate).toISOString() : null,
      monto: q.DocTotal !== undefined ? Number(q.DocTotal) : null,
      moneda: q.DocCur || null,
      cliente_id: q.CardCode || null,
      cliente_nombre: q.CardName || null,
      vendedor: q.SalesPersonCode ? q.SalesPersonCode.toString() : null
    }));
  } catch (errFallback) {
    log(`❌ Fallback nativo de pedidos también falló: ${errFallback.message}`);
    throw errFallback;
  }
}

async function syncPedidos() {
  log('Sincronizando Pedidos SAP...');
  try {
    const rows = await fetchPedidosFromSAP();
    const validRows = rows.filter(r => r.numero_pedido);
    
    try {
      const n = await upsertSupabase('pedidos_sap', validRows);
      log(`✅ Pedidos SAP: ${n} registros sincronizados a Supabase.`);
    } catch (supaErr) {
      if (supaErr.message?.includes('404') || (supaErr.response && supaErr.response.status === 404)) {
        log(`⚠️ Advertencia: La tabla 'pedidos_sap' no existe en Supabase (404). Omitiendo persistencia.`);
      } else {
        throw supaErr;
      }
    }
  } catch (err) {
    log(`⚠️ Advertencia: Sincronización de pedidos SAP falló de forma no crítica: ${err.message}`);
  }
}

// ── 5. Main ───────────────────────────────────────────────────────
async function main() {
  const inicio = Date.now();
  log('═══════════════════════════════════════════');
  log('   SYNC SAP → SUPABASE (Eurorep CRM)');
  log(`   ${new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`);
  log('═══════════════════════════════════════════');

  try {
    await loadConfigFromSupabase();
    await loginSAP();

    const argModulo = process.argv[2] || 'all';
    let algunFallo = false;

    const runTask = async (name, fn) => {
      try {
        await fn();
      } catch (e) {
        err(`Tarea fallida (${name}): ${e.message}`);
        algunFallo = true;
      }
    };
    
    if (argModulo === 'all' || argModulo === 'clientes') await runTask('clientes', syncClientes);
    if (argModulo === 'all' || argModulo === 'refacciones') await runTask('refacciones', syncRefacciones);
    if (argModulo === 'all' || argModulo === 'sitios') await runTask('sitios', syncSitios);
    if (argModulo === 'all' || argModulo === 'tecnicos') await runTask('tecnicos', syncTecnicos);
    if (argModulo === 'all' || argModulo === 'cotizaciones') await runTask('cotizaciones', syncCotizaciones);
    if (argModulo === 'all' || argModulo === 'pedidos') await runTask('pedidos', syncPedidos);

    const seg = ((Date.now() - inicio) / 1000).toFixed(1);
    log('═══════════════════════════════════════════');
    if (algunFallo) {
      err(`❌ Sincronización finalizada con ERRORES en ${seg}s`);
      log('═══════════════════════════════════════════');
      process.exit(1);
    } else {
      log(`✅ Sincronización completa en ${seg}s`);
      log('═══════════════════════════════════════════');
      process.exit(0);
    }
  } catch (e) {
    err(`Error fatal: ${e.message}`);
    process.exit(1);
  }
}

main();
