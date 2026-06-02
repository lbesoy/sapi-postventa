const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'https://sapi-postventa.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (por ejemplo, herramientas como curl o llamadas servidor a servidor)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Configuracion de SAP B1 Service Layer
const SAP_URL = process.env.SAP_SL_URL;
const SAP_DB = process.env.SAP_COMPANY_DB;
const SAP_USER = process.env.SAP_USER;
const SAP_PASS = process.env.SAP_PASSWORD;

const fs = require('fs');
const https = require('https');

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
        console.log('🔒 Certificado CA cargado exitosamente para la conexión segura con SAP.');
    } catch (err) {
        console.error('❌ Error al cargar el certificado CA de SAP desde la ruta:', process.env.SAP_CA_CERT_PATH, err.message);
    }
}

const sapHttpsAgent = new https.Agent(agentOptions);

// Almacenar el sessionId en memoria (en produccion se debe manejar mejor, e.g. redis o base de datos)
let sessionId = null;

// ==========================================
// 1. AUTENTICACIÓN CON SAP BUSINESS ONE
// ==========================================
async function loginToSAP() {
    try {
        const response = await axios.post(`${SAP_URL}/Login`, {
            CompanyDB: SAP_DB,
            UserName: SAP_USER,
            Password: SAP_PASS
        }, {
            httpsAgent: sapHttpsAgent,
            timeout: 60000 // 60 segundos máximo
        });
        
        sessionId = response.data.SessionId;
        console.log('✅ Conectado a SAP Business One exitosamente.');
        return sessionId;
    } catch (error) {
        console.error('❌ Error conectando a SAP:', error.response?.data?.error?.message?.value || error.message);
        throw new Error('No se pudo autenticar con SAP');
    }
}

// Middleware para asegurar que estamos conectados a SAP antes de cada petición
async function ensureSAPConnection(req, res, next) {
    if (!sessionId) {
        try {
            await loginToSAP();
        } catch (error) {
            return res.status(500).json({ error: 'Fallo de conexión con el servidor SAP.' });
        }
    }
    next();
}

// Configuración de instancia de Axios para peticiones a SAP
const sapApi = axios.create({
    httpsAgent: sapHttpsAgent,
    timeout: 60000 // Timeout de 60 segundos
});

// Interceptor para inyectar la cookie de B1SESSION
sapApi.interceptors.request.use(config => {
    if (sessionId) {
        config.headers['Cookie'] = `B1SESSION=${sessionId}`;
    }
    return config;
});

// Interceptor para reconectar si la sesión expira (Error 401)
sapApi.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 401) {
            console.log('🔄 Sesión de SAP expirada. Reconectando...');
            await loginToSAP();
            // Reintentar la petición original con la nueva sesión
            error.config.headers['Cookie'] = `B1SESSION=${sessionId}`;
            return axios(error.config);
        }
        return Promise.reject(error);
    }
);

// ==========================================
// 2. RUTAS DE INTEGRACIÓN (EJEMPLOS)
// ==========================================

// Obtener Clientes (Mediante Query Personalizado de SAP o Fallback)
app.get('/api/clientes', ensureSAPConnection, async (req, res) => {
    try {
        const queryCode = req.query.queryCode || 'eurorep_clientes';
        const response = await sapApi.get(`${SAP_URL}/SQLQueries('${queryCode}')/List`, {
            headers: {
                'B1S-PageSize': 5000,
                'Prefer': 'odata.maxpagesize=5000'
            }
        });
        
        res.json(response.data.value || []);
    } catch (error) {
        console.log(`Query ${req.query.queryCode || 'eurorep_clientes'} falló. Status: ${error.response?.status}. Usando Fallback a BusinessPartners...`);
        try {
            // Fallback a la tabla estándar si el query falla por cualquier razón
            const fallbackResponse = await sapApi.get(`${SAP_URL}/BusinessPartners?$select=CardCode,CardName,LicTradNum,E_Mail,CurrentAccountBalance&$filter=CardType eq 'cCustomer'`, {
                headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' }
            });
            
            // Mapear los campos del fallback
            const fallbackData = fallbackResponse.data.value.map(bp => ({
                CardCode: bp.CardCode,
                CardName: bp.CardName,
                LicTradNum: bp.LicTradNum,
                E_Mail: bp.E_Mail,
                Balance: bp.CurrentAccountBalance,
                U_OK_Grupo: 'N/A' // Como es fallback, no exigimos el UDF
            }));
            
            return res.json(fallbackData);
        } catch (fallbackError) {
            console.error('Error en fallback de BusinessPartners:', fallbackError.response?.data || fallbackError.message);
            res.status(500).json({ error: 'Error obteniendo clientes de SAP (Fallback falló)', details: fallbackError.message });
        }
    }
});

// Obtener Órdenes Abiertas de un Cliente (Desglose SAP)
app.get('/api/clientes/:id/ordenes', ensureSAPConnection, async (req, res) => {
    try {
        const cardCode = req.params.id;
        const response = await sapApi.get(`${SAP_URL}/Orders?$filter=CardCode eq '${cardCode}' and DocumentStatus eq 'bost_Open'&$select=DocDate,DocNum,Comments,DocTotal,DocumentLines&$orderby=DocDate asc`);
        res.json(response.data.value || []);
    } catch (error) {
        console.error(`Error obteniendo órdenes para ${req.params.id}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Error obteniendo órdenes de SAP', details: error.message });
    }
});

// Obtener Técnicos (Empleados de Ventas / OSLP) nativamente de Service Layer
app.get('/api/tecnicos', ensureSAPConnection, async (req, res) => {
    try {
        // En SQL, T0."Fax" <> 'N/A' excluye automáticamente los valores NULL. 
        // En OData, 'ne' sobre un null devuelve true, por lo que debemos excluir null explícitamente.
        // Además, el caracter '/' en 'N/A' debe ir codificado en la URL.
        const filterStr = "SalesEmployeeCode ne -1 and Active eq 'tYES' and Fax ne 'N/A' and Fax ne null";
        const queryParams = `$select=Remarks,SalesEmployeeCode,SalesEmployeeName,Fax,Mobile&$filter=${encodeURIComponent(filterStr)}&$orderby=Remarks asc`;
        
        const response = await sapApi.get(`${SAP_URL}/SalesPersons?${queryParams}`);
        
        const tecnicos = (response.data.value || []).map(t => ({
            SlpCode: t.SalesEmployeeCode,
            SlpName: t.SalesEmployeeName,
            Memo: t.Remarks || '',
            TipoUsuario: t.Fax || '',
            Celular: t.Mobile || ''
        }));
        res.json(tecnicos);
    } catch (error) {
        console.error('Error obteniendo Técnicos de OSLP:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error obteniendo técnicos de SAP', details: error.message });
    }
});

// Obtener todos los Queries SQL registrados en SAP
app.get('/api/sap/queries', ensureSAPConnection, async (req, res) => {
    try {
        const response = await sapApi.get(`${SAP_URL}/SQLQueries?$select=SqlCode,SqlName,SqlText`, {
            headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' }
        });
        res.json({ success: true, data: response.data.value || [] });
    } catch (error) {
        console.error('Error obteniendo lista de queries:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error obteniendo queries de SAP' });
    }
});

// Crear o actualizar un Query SQL en SAP
app.post('/api/sap/queries', ensureSAPConnection, async (req, res) => {
    try {
        const { sqlCode, sqlName, sqlText } = req.body;
        
        if (!sqlCode || !sqlText) {
            return res.status(400).json({ error: 'sqlCode y sqlText son requeridos' });
        }

        // Verificar si existe
        let exists = false;
        try {
            await sapApi.get(`${SAP_URL}/SQLQueries('${sqlCode}')`);
            exists = true;
        } catch(e) {
            exists = false;
        }

        const payload = {
            SqlCode: sqlCode,
            SqlName: sqlName || sqlCode,
            SqlText: sqlText
        };

        let response;
        if (exists) {
            response = await sapApi.patch(`${SAP_URL}/SQLQueries('${sqlCode}')`, payload);
        } else {
            response = await sapApi.post(`${SAP_URL}/SQLQueries`, payload);
        }
        
        res.json({ success: true, message: 'Query programado correctamente en SAP', data: response?.data });
    } catch (error) {
        console.error(`Error programando query ${req.body.sqlCode}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Error programando query en SAP', details: error.response?.data || error.message });
    }
});

// Ejecutar un Query SQL en SAP
app.get('/api/sap/queries/:id/execute', ensureSAPConnection, async (req, res) => {
    try {
        const sqlCode = req.params.id;
        const response = await sapApi.get(`${SAP_URL}/SQLQueries('${sqlCode}')/List`, {
            headers: {
                'B1S-PageSize': 5000,
                'Prefer': 'odata.maxpagesize=5000'
            }
        });
        res.json({ success: true, data: response.data.value || [] });
    } catch (error) {
        console.error(`Error ejecutando query ${req.params.id}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Error ejecutando query en SAP', details: error.response?.data || error.message });
    }
});

// Eliminar un Query SQL en SAP
app.delete('/api/sap/queries/:id', ensureSAPConnection, async (req, res) => {
    try {
        const sqlCode = req.params.id;
        await sapApi.delete(`${SAP_URL}/SQLQueries('${sqlCode}')`);
        res.json({ success: true, message: 'Query eliminado correctamente en SAP' });
    } catch (error) {
        console.error(`Error eliminando query ${req.params.id}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Error eliminando query en SAP', details: error.response?.data || error.message });
    }
});

// Acceder a tablas de usuario UDO de SAP (ej. @OK_MARCA → /api/sap/udo/OK_MARCA)
app.get('/api/sap/udo/:tableName', ensureSAPConnection, async (req, res) => {
    try {
        const tableName = req.params.tableName; // sin el "@"
        const response = await sapApi.get(`${SAP_URL}/U_${tableName}`, {
            headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' }
        });
        res.json({ success: true, data: response.data.value || [] });
    } catch (error) {
        console.error(`Error accediendo UDO ${req.params.tableName}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Error accediendo tabla UDO de SAP', details: error.response?.data || error.message });
    }
});

// Obtener Máquinas (Equipments / Activos Fijos)
// Nota: En SAP B1 la maquinaria de servicio usualmente está en "CustomerEquipmentCards"
app.get('/api/maquinaria', ensureSAPConnection, async (req, res) => {
    try {
        const response = await sapApi.get(`${SAP_URL}/CustomerEquipmentCards?$select=EquipmentCardNum,ItemCode,ItemDescription,ManufacturerSerialNum,CustomerCode`);
        res.json(response.data.value);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo maquinaria de SAP', details: error.message });
    }
});

// ── /api/sync-all: Sincroniza todos los catálogos SAP → Supabase ────────────
const SUPABASE_URL_SRV = process.env.SUPABASE_URL;
const SUPABASE_KEY_SRV = process.env.SUPABASE_KEY;

if (!SUPABASE_URL_SRV || !SUPABASE_KEY_SRV) {
    console.error('CRITICAL: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.');
}

async function upsertSupa(tabla, rows) {
    if (!rows || rows.length === 0) return 0;
    const BATCH = 500;
    let n = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        await axios.post(`${SUPABASE_URL_SRV}/rest/v1/${tabla}`, chunk, {
            headers: {
                'apikey': SUPABASE_KEY_SRV,
                'Authorization': `Bearer ${SUPABASE_KEY_SRV}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            }
        });
        n += chunk.length;
    }
    return n;
}

app.get('/api/sync-all', ensureSAPConnection, async (req, res) => {
    const modulo = req.query.modulo || 'all';
    const inicio = Date.now();
    const resultado = {};

    try {
        if (modulo === 'all' || modulo === 'clientes') {
            try {
                const qc = process.env.QUERY_CLIENTES || 'eurorep_clientes';
                const r = await sapApi.get(`${SAP_URL}/SQLQueries('${qc}')/List`, { headers: { 'B1S-PageSize': 5000 } });
                const rows = (r.data.value || []).map(bp => {
                    return {
                        id: bp.CardCode || null, 
                        nombre: bp.CardName || '', 
                        rfc: bp.LicTradNum || '',
                        email: bp.E_Mail || '', 
                        telefono: '', 
                        id_fiscal: bp.LicTradNum || ''
                    };
                }).filter(x => x.id);
                resultado.clientes = await upsertSupa('clientes', rows);
            } catch(e) { resultado.clientes_error = e.message; }
        }

        if (modulo === 'all' || modulo === 'refacciones') {
            try {
                const qc = process.env.QUERY_REFACCIONES || 'CAT_REFACCIONES';
                const r = await sapApi.get(`${SAP_URL}/SQLQueries('${qc}')/List`, { headers: { 'B1S-PageSize': 5000 } });
                const rows = (r.data.value || []).map(x => ({
                    id: x.ItemCode || null, codigo: x.ItemCode || '', descripcion: x.ItemName || x.Dscription || '',
                    precio: parseFloat(x.Price) || 0, moneda: x.Currency || 'MXN',
                    stock: parseInt(x.OnHand) || 0, custom_data: {}
                })).filter(x => x.id);
                resultado.refacciones = await upsertSupa('refacciones', rows);
            } catch(e) { resultado.refacciones_error = e.message; }
        }

        if (modulo === 'all' || modulo === 'sitios') {
            try {
                const qc = process.env.QUERY_SITIOS || 'CAT_Sitos';
                const r = await sapApi.get(`${SAP_URL}/SQLQueries('${qc}')/List`, { headers: { 'B1S-PageSize': 5000 } });
                const rows = (r.data.value || []).map(x => ({
                    id: x.Address || null, nombre: x.Street || x.Address || '', cliente: x.BPCode || '',
                    direccion: x.Block || '', cp: x.ZipCode || '', ciudad: x.City || '',
                    estado: x.State || '', custom_data: {}
                })).filter(x => x.id);
                resultado.sitios = await upsertSupa('sitios', rows);
            } catch(e) { resultado.sitios_error = e.message; }
        }

        resultado.duracion_ms = Date.now() - inicio;
        resultado.ok = true;
        console.log(`✅ sync-all [${modulo}] en ${resultado.duracion_ms}ms`, resultado);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para ver la IP pública del servidor
app.get('/api/myip', async (req, res) => {
    try {
        const r = await axios.get('https://api.ipify.org?format=json', { timeout: 10000 });
        res.json({ ip: r.data.ip });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor middleware Node.js corriendo en el puerto ${PORT}`);
    console.log('✅ Listo! Ya puedes ir a tu CRM y presionar "Sincronizar con SAP".');
});
