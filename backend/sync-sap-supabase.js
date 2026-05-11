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

// ── Configuración ─────────────────────────────────────────────────
const SAP_URL      = process.env.SAP_SL_URL;
const SAP_DB       = process.env.SAP_COMPANY_DB;
const SAP_USER     = process.env.SAP_USER;
const SAP_PASS     = process.env.SAP_PASSWORD;
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

// Queries configurados (se sobreescriben con la config de Supabase)
let QUERIES = {
  clientes:    'eurorep_clientes',
  refacciones: 'CAT_REFACCIONES',
  sitios:      'CAT_Sitos',
  maquinaria:  'CAT_MAQUINARIA',
  tecnicos:    'eurorep_tecnicos'
};

// Mapeos configurados (se sobreescriben con la config de Supabase)
let MAPPINGS = {
  sitios: null,
  maquinaria: null
};

const agent = new https.Agent({ rejectUnauthorized: false });
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

// ── 4. Mapear y sincronizar cada módulo ───────────────────────────
async function syncClientes() {
  log('Sincronizando Clientes...');
  const raw = await fetchQuery(QUERIES.clientes);
  const rows = raw.map(bp => ({
    id:          bp.CardCode || null,
    nombre:      bp.CardName || 'Sin Nombre',
    rfc:         bp.LicTradNum || '',
    email:       bp.E_Mail || '',
    telefono:    '',
    id_fiscal:   bp.LicTradNum || ''
  })).filter(r => r.id);  // Solo los que tienen ID válido
  const n = await upsertSupabase('clientes', rows);
  log(`✅ Clientes: ${n} registros sincronizados a Supabase.`);
}

async function syncRefacciones() {
  log('Sincronizando Refacciones...');
  const raw = await fetchQuery(QUERIES.refacciones);
  const rows = raw.map(r => ({
    id:          r.ItemCode || null,
    codigo:      r.ItemCode || '',
    descripcion: r.ItemName || r.Dscription || '',
    precio:      parseFloat(r.Price) || 0,
    moneda:      r.Currency || 'MXN',
    stock:       parseInt(r.OnHand) || 0,
    custom_data: {}
  })).filter(r => r.id);
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

async function syncMaquinaria() {
  log('Sincronizando Maquinaria...');
  const raw = await fetchQuery(QUERIES.maquinaria);
  const m = MAPPINGS.maquinaria || {};
  
  const rows = raw.map(maq => {
    return {
      id:          maq[m.id] || maq.ManufacturerSerialNum || maq.InternalSN || null,
      serie:       maq[m.id] || maq.ManufacturerSerialNum || maq.InternalSN || '',
      marca:       '',
      modelo:      maq[m.itemcode] || maq.ItemCode || '',
      anio:        maq.MnfDate || '',
      cliente:     maq[m.cliente] || maq.CustomerCode || maq.CardCode || '',
      id_interno:  maq[m.itemcode] || maq.ItemCode || '',
      descripcion: maq[m.desc] || maq.ItemDescription || maq.ItemName || '',
      custom_data: {}
    };
  }).filter(r => r.id);
  
  const n = await upsertSupabase('maquinaria', rows);
  log(`✅ Maquinaria: ${n} registros sincronizados a Supabase.`);
}

async function syncTecnicos() {
  log('Sincronizando Técnicos...');
  const raw = await fetchQuery(QUERIES.tecnicos);
  
  const rows = raw.map(t => {
    return {
      id:          t.empID || t.EmployeeID || t.firstName || null,
      nombre:      t.firstName ? `${t.firstName} ${t.lastName || ''}`.trim() : t.Name || 'Sin Nombre',
      tipoUsuario: t.jobTitle || t.Position || 'tecnico',
      departamento: t.dept || t.Department || '',
      email:       t.email || '',
      telefono:    t.mobile || t.officeExt || '',
      activo:      true,
      custom_data: {}
    };
  }).filter(r => r.id);
  
  const n = await upsertSupabase('tecnicos', rows);
  log(`✅ Técnicos: ${n} registros sincronizados a Supabase.`);
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
      if (config.queryMaquinaria) QUERIES.maquinaria = config.queryMaquinaria;
      if (config.queryTecnicos) QUERIES.tecnicos = config.queryTecnicos;
      // if (config.mappings && config.mappings.sitios) MAPPINGS.sitios = config.mappings.sitios; // DESHABILITADO temporalmente
      // if (config.mappings && config.mappings.maquinaria) MAPPINGS.maquinaria = config.mappings.maquinaria; // DESHABILITADO temporalmente
      log('⚙️ Configuración de queries cargada desde la nube.');
    }
  } catch (err) {
    log(`⚠️ Advertencia: No se pudo cargar config de la nube (${err.message}). Usando defaults.`);
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

    const resultados = await Promise.allSettled([
      syncClientes(),
      syncRefacciones(),
      syncSitios(),
      syncMaquinaria(),
      syncTecnicos()
    ]);

    resultados.forEach((r, i) => {
      if (r.status === 'rejected') err(`Módulo ${i}: ${r.reason?.message}`);
    });

    const seg = ((Date.now() - inicio) / 1000).toFixed(1);
    log('═══════════════════════════════════════════');
    log(`✅ Sincronización completa en ${seg}s`);
    log('═══════════════════════════════════════════');
    process.exit(0);
  } catch (e) {
    err(`Error fatal: ${e.message}`);
    process.exit(1);
  }
}

main();
