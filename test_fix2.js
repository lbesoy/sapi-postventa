const API_BASE = "https://eurorep-api.onrender.com/api";

// Try to query OITG directly to find field names
async function findOITGFields() {
  const queries = [
    `SELECT TOP 1 * FROM "OITG"`,
    `SELECT "Code", "Name" FROM "OITG"`,
    `SELECT "GroupCode", "GroupName" FROM "OITG"`,
    `SELECT "ItemsGroupCode", "ItemsGroupName" FROM "OITG"`,
  ];
  
  for (let i = 0; i < queries.length; i++) {
    const sql = queries[i];
    const res = await fetch(`${API_BASE}/sap/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlCode: 'TEST_OITG', sqlName: 'TEST_OITG', sqlText: sql })
    });
    const json = await res.json();
    if (json.success) {
      const res2 = await fetch(`${API_BASE}/sap/queries/TEST_OITG/execute`);
      const json2 = await res2.json();
      console.log(`SQL ${i+1} WORKS! Keys: ${json2.data ? Object.keys(json2.data[0]) : 'no data'}`);
      if (json2.data) console.log("Sample:", JSON.stringify(json2.data[0]));
      break;
    } else {
      console.log(`SQL ${i+1} FAIL: ${json.details?.error?.message?.value}`);
    }
  }
}
findOITGFields();
