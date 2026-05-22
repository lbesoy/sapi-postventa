const API_BASE = "https://eurorep-api.onrender.com/api";

// Simplest possible - only OITM, no joins
const cleanSQL = `SELECT "U_MARCA", "ItemCode", "ItemName", "ItmsGrpCod" FROM "OITM" WHERE "U_MARCA" IS NOT NULL ORDER BY "U_MARCA", "ItemName"`;

async function registerQuery() {
  const res = await fetch(`${API_BASE}/sap/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: cleanSQL })
  });
  const json = await res.json();
  console.log("Update result:", JSON.stringify(json));

  if (json.success) {
    const res2 = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
    const json2 = await res2.json();
    if (json2.data && json2.data.length > 0) {
      console.log(`Total: ${json2.data.length}`);
      console.log("First 5:", json2.data.slice(0,5).map(i => JSON.stringify(i)).join('\n'));
    } else {
      console.log("No data:", JSON.stringify(json2));
    }
  }
}
registerQuery();
