const API_BASE = "https://eurorep-api.onrender.com/api";

// Get group names via SAP Service Layer OData endpoint (not SQL)
// Also try UDO approach for OITG
async function testOData() {
  // Test Item Groups via Service Layer OData
  const res = await fetch(`${API_BASE.replace('/api','')}/api/sap/udo/OITG`).catch(() => null);
  if (res) {
    const j = await res.json();
    console.log("UDO OITG:", JSON.stringify(j).slice(0,200));
  }
}

// Also test with the UDO endpoint we built
async function testItemGroups() {
  try {
    // Try via the backend with a direct GET to SAP OData endpoint
    const res = await fetch(`${API_BASE}/sap/udo/OITG`);
    const j = await res.json();
    console.log("UDO OITG response:", JSON.stringify(j).slice(0, 400));
  } catch(e) {
    console.log("Error:", e.message);
  }
}
testItemGroups();
