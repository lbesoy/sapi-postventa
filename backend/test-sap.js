require('dotenv').config();
const axios = require('axios');

async function testConnection() {
    console.log('Probando conexión a SAP...');
    console.log(`URL: ${process.env.SAP_SL_URL}`);
    console.log(`DB: ${process.env.SAP_COMPANY_DB}`);
    console.log(`USER: ${process.env.SAP_USER}`);
    
    try {
        const response = await axios.post(`${process.env.SAP_SL_URL}/Login`, {
            CompanyDB: process.env.SAP_COMPANY_DB,
            UserName: process.env.SAP_USER,
            Password: process.env.SAP_PASSWORD
        }, {
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
            timeout: 10000 // 10 segundos de timeout
        });
        
        console.log('✅ ÉXITO! Sesión obtenida:', response.data.SessionId);
    } catch (error) {
        console.log('❌ FALLO LA CONEXIÓN:');
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error message:', error.message);
        }
    }
}

testConnection();
