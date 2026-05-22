const API_BASE = "https://eurorep-api.onrender.com/api";

// Try without schema prefix but with brackets notation instead of quotes
// Also try the UDO table with different notation
const cleanSQL = `SELECT T0."U_MARCA", T0."ItemCode", T0."ItemName", T2."ItmsGrpNam" FROM "OITM" T0 INNER JOIN "OITB" T2 ON T0."ItmsGrpCod" = T2."ItmsGrpCod" WHERE T0."U_MARCA" IS NOT NULL ORDER BY T0."U_MARCA", T0."ItemName"`;

async function registerQuery() {
  const res = await fetch(`${API_BASE}/sap/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: cleanSQL })
  });
  const json = await res.json();
  console.log("Update result:", JSON.stringify(json, null, 2));

  if (json.success) {
    console.log("\nTesting...");
    const res2 = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
    const json2 = await res2.json();
    if (json2.data && json2.data.length > 0) {
      console.log(`Total: ${json2.data.length} items`);
      console.log("Keys:", Object.keys(json2.data[0]));
      console.log("First 5:");
      json2.data.slice(0, 5).forEach(i => console.log(JSON.stringify(i)));
    } else {
      console.log("Error/Empty:", JSON.stringify(json2));
    }
  }
}
registerQuery();
