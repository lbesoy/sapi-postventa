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
    
    const res = await sapApi.get(`${SAP_URL}/Orders?$filter=CardCode eq 'CL052' and DocumentStatus eq 'bost_Open'&$top=1`, {
      headers: { 'Cookie': `B1SESSION=${loginRes.data.SessionId}` }
    });
    
    if(res.data.value.length > 0) {
      const order = res.data.value[0];
      const keys = Object.keys(order).filter(k => k.toLowerCase().includes('open') || k.toLowerCase().includes('total') || k.toLowerCase().includes('sum') || k.toLowerCase().includes('bal'));
      keys.forEach(k => console.log(k, ":", order[k]));
    }
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
test();
