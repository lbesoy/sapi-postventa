const axios = require('axios');
const https = require('https');
require('dotenv').config();

const SAP_URL = process.env.SAP_SL_URL;
const COMPANY_DB = process.env.SAP_COMPANY_DB;
const USERNAME = process.env.SAP_USER;
const PASSWORD = process.env.SAP_PASSWORD;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const sapApi = axios.create({
    httpsAgent,
    headers: {
        'Content-Type': 'application/json',
        'Prefer': 'odata.maxpagesize=100'
    }
});

async function test() {
    try {
        console.log("Haciendo login a SAP...");
        const loginRes = await sapApi.post(`${SAP_URL}/Login`, {
            CompanyDB: COMPANY_DB,
            UserName: USERNAME,
            Password: PASSWORD
        });
        
        const cookie = loginRes.headers['set-cookie']?.join('; ') || `B1SESSION=${loginRes.data.SessionId}`;
        sapApi.defaults.headers.common['Cookie'] = cookie;
        
        console.log("Buscando Queries guardados en SAP...");
        const queriesRes = await sapApi.get(`${SAP_URL}/SQLQueries`);
        console.log(`Encontrados: ${queriesRes.data.value.length} queries`);
        console.log(queriesRes.data.value.slice(0, 3)); // Mostrar primeros 3
        
    } catch(e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

test();
