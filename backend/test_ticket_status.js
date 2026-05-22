const axios = require('axios');
const https = require('https');

async function check() {
  try {
    const sapApi = axios.create({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: { 'Content-Type': 'application/json' }
    });

    const loginRes = await sapApi.post(`https://sldsinergiam9db01.rsgcloud.com:50000/b1s/v1/Login`, {
      CompanyDB: 'SBO_SAPI',
      UserName: 'sinergia\\sap_malipo01',
      Password: 'U3A5StChkJ.byGn9XRc1'
    });
    
    const sessionId = loginRes.data.SessionId;
    const cookie = `B1SESSION=${sessionId}; ROUTEID=.node1`;
    sapApi.defaults.headers.common['Cookie'] = cookie;

    const r = await sapApi.get(`https://sldsinergiam9db01.rsgcloud.com:50000/b1s/v1/SQLQueries('eurorep_clientes')/List`);
    console.log("Count from SAP:", r.data.value.length);
    console.log("First 3:", r.data.value.slice(0, 3));
  } catch(e) {
    console.log("Error:", e.response ? e.response.data : e.message);
  }
}
check();
