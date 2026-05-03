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
    console.log("Login OK. Actualizando Query...");
    
    const queryPayload = {
      "SqlText": "SELECT T0.\"CardCode\", T0.\"CardName\", T0.\"U_OK_Grupo\", T0.\"LicTradNum\", T0.\"E_Mail\", T0.\"OrdersBal\", T0.\"Balance\" FROM OCRD T0 where T0.\"GroupCode\" = '100'"
    };
    
    const res = await sapApi.patch(`${SAP_URL}/SQLQueries('eurorep_clientes')`, queryPayload, {
      headers: { 'Cookie': `B1SESSION=${sessionId}` }
    });
    
    console.log("Query actualizado exitosamente! Status:", res.status);
  } catch (e) {
    console.error("Error al actualizar query:", e.response ? e.response.data : e.message);
  }
}
test();
