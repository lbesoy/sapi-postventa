const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuracion de SAP B1 Service Layer
const SAP_URL = process.env.SAP_SL_URL;
const SAP_DB = process.env.SAP_COMPANY_DB;
const SAP_USER = process.env.SAP_USER;
const SAP_PASS = process.env.SAP_PASSWORD;

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
            // Ignorar certificados autofirmados si SAP B1 está en red local sin HTTPS válido
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
            timeout: 15000 // 15 segundos máximo para evitar que se cuelgue
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
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 15000 // Timeout de 15 segundos
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
        if (error.response && error.response.status === 404) {
            console.log(`Query no encontrado. Usando Fallback a BusinessPartners...`);
            try {
                // Intento 2: Fallback a la tabla estándar si el query no se ha programado
                const fallbackResponse = await sapApi.get(`${SAP_URL}/BusinessPartners?$select=CardCode,CardName,LicTradNum,E_Mail,CurrentAccountBalance&$filter=CardType eq 'cCustomer'`, {
                    headers: { 'B1S-PageSize': 5000, 'Prefer': 'odata.maxpagesize=5000' }
                });
                
                // Mapear los campos del fallback para que coincidan con la estructura que espera app.js
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
        } else {
            console.error('Error en /api/clientes:', error.response?.data || error.message);
            res.status(500).json({ error: 'Error ejecutando Query de clientes en SAP', details: error.message });
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
        const response = await sapApi.get(`${SAP_URL}/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName,Remarks`);
        const tecnicos = (response.data.value || []).map(t => ({
            SlpCode: t.SalesEmployeeCode,
            SlpName: t.SalesEmployeeName,
            Memo: t.Remarks || ''
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
        const response = await sapApi.get(`${SAP_URL}/SQLQueries('${sqlCode}')/List`);
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

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor middleware Node.js corriendo en el puerto ${PORT}`);
    console.log('✅ Listo! Ya puedes ir a tu CRM y presionar "Sincronizar con SAP".');
});
