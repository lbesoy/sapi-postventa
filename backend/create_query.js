require('dotenv').config();
const axios = require('axios');
const https = require('https');

async function test() {
  try {
    const SAP_URL = process.env.SAP_SL_URL;
    const sapApi = axios.create({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log("Logueando a", process.env.SAP_COMPANY_DB);
    const loginRes = await sapApi.post(`${SAP_URL}/Login`, {
      CompanyDB: process.env.SAP_COMPANY_DB,
      UserName: process.env.SAP_USER,
      Password: process.env.SAP_PASSWORD
    });
    
    const sessionId = loginRes.data.SessionId;
    console.log("Login OK. Creando Query sin U_OK_Grupo...");
    
    const queryPayload = {
      "SqlCode": "eurorep_clientes",
      "SqlName": "Clientes Eurorep CRM",
      "SqlText": "SELECT T0.\"CardCode\", T0.\"CardName\", T0.\"LicTradNum\", T0.\"E_Mail\", T0.\"OrdersBal\", T0.\"Balance\" FROM OCRD T0 where T0.\"GroupCode\" = '100'"
    };
    
    const res = await sapApi.post(`${SAP_URL}/SQLQueries`, queryPayload, {
      headers: { 'Cookie': `B1SESSION=${sessionId}` }
    });
    
    console.log("Query creado exitosamente:", res.data);
  } catch (e) {
    console.error("Error al crear query:", e.response ? e.response.data : e.message);
  }
}
test();
