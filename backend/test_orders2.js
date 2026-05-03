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
    
    const loginRes = await sapApi.post(`${SAP_URL}/Login`, {
      CompanyDB: process.env.SAP_COMPANY_DB,
      UserName: process.env.SAP_USER,
      Password: process.env.SAP_PASSWORD
    });
    
    const sessionId = loginRes.data.SessionId;
    console.log("Login OK. Obteniendo Ordenes Abiertas de CL052...");
    
    const res = await sapApi.get(`${SAP_URL}/Orders?$filter=CardCode eq 'CL052' and DocumentStatus eq 'bost_Open'&$select=DocDate,DocNum,Comments,DocTotal,PaidToDate,CreationDate,UpdateDate,DownPayment`, {
      headers: { 'Cookie': `B1SESSION=${sessionId}` }
    });
    
    if(res.data.value.length > 0) {
      console.log(res.data.value[0]);
    }
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
test();
