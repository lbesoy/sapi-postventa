const API_BASE = "https://eurorep-api.onrender.com/api";

// We need to test accessing the @OK_MARCA UDO table via Service Layer
// Let's add a test endpoint to the backend temporarily
// First check if the backend has a generic SAP proxy endpoint

async function testEndpoints() {
  // Test 1: Try accessing UDO via the standard user table endpoint
  const endpoints = [
    '/api/sap/udo/OK_MARCA',
    '/api/sap/tabla/OK_MARCA',
    '/api/sap/marcas',
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${API_BASE.replace('/api','')}${ep}`);
      console.log(`${ep}: ${res.status}`);
    } catch(e) {
      console.log(`${ep}: ERROR - ${e.message}`);
    }
  }
}
testEndpoints();
