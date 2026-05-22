const API_BASE = "https://eurorep-api.onrender.com/api";

// Just try with U_MARCA and SuppCatNum, no join - cleanest option
const newSQL = `SELECT "ItemCode", "ItemName", "U_MARCA" AS "MarcaCode", "SuppCatNum" AS "RefProveedor", "ItmsGrpCod" AS "GrupoCode" FROM "OITM" ORDER BY "U_MARCA", "ItemName"`;

async function updateQuery() {
  const res = await fetch(`${API_BASE}/sap/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: newSQL })
  });
  const json = await res.json();
  console.log("Response:", JSON.stringify(json, null, 2));
  
  if (json.success) {
    // Test it
    console.log("\nTesting the updated query...");
    const res2 = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
    const json2 = await res2.json();
    if (json2.data && json2.data.length > 0) {
      console.log("Keys:", Object.keys(json2.data[0]));
      console.log("First 3:");
      json2.data.slice(0, 3).forEach(i => console.log(JSON.stringify(i)));
    }
  }
}
updateQuery();
