const API_BASE = "https://eurorep-api.onrender.com/api";

// Try SAP Service Layer OData endpoint for ItemGroups directly
async function tryItemGroupsOData() {
  // Try via a proxy - add a temp endpoint test
  // Use our existing queries endpoint to test OITG with different column name guesses
  const colTests = ['Number', 'ItmsGrpCod', 'GroupCode', 'ItemGroupCode', 'AbsEntry', 'Code'];
  
  for (const col of colTests) {
    const sql = `SELECT "${col}" FROM "OITG"`;
    const res = await fetch(`${API_BASE}/sap/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlCode: 'TEST_OITG2', sqlName: 'TEST', sqlText: sql })
    });
    const j = await res.json();
    if (j.success) {
      console.log(`✅ Column "${col}" EXISTS in OITG`);
      const r2 = await fetch(`${API_BASE}/sap/queries/TEST_OITG2/execute`);
      const j2 = await r2.json();
      console.log("Data:", JSON.stringify(j2.data?.slice(0,3)));
    } else {
      console.log(`❌ "${col}": ${j.details?.error?.message?.value?.slice(0,60)}`);
    }
  }
}
tryItemGroupsOData();
