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
    console.log("Login OK. Obteniendo clientes...");
    
    const clientsRes = await sapApi.get(`${SAP_URL}/SQLQueries('eurorep_clientes')/List`, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'B1S-PageSize': 5000,
        'Prefer': 'odata.maxpagesize=5000'
      }
    });
    
    console.log("Clientes obtenidos:", clientsRes.data.value.length);
    console.log("Primer cliente:", clientsRes.data.value[0]);
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
test();
