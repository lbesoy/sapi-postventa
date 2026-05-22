const API_BASE = "https://eurorep-api.onrender.com/api";

// Try with WHERE NOT NULL filter
async function tryFinalQuery() {
  const sql = `SELECT "U_MARCA", "ItemCode", "ItemName", "ItmsGrpCod" FROM "OITM" WHERE "U_MARCA" IS NOT NULL AND "U_MARCA" <> '' ORDER BY "U_MARCA", "ItemName"`;
  const res = await fetch(`${API_BASE}/sap/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: sql })
  });
  const j = await res.json();
  console.log("Save:", j.success ? 'OK' : j.details?.error?.message?.value);
  if (j.success) {
    const r2 = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
    const j2 = await r2.json();
    // Get unique ItmsGrpCod values so we can build a hardcoded map
    const groups = new Set(j2.data?.map(x => x.ItmsGrpCod));
    console.log("Total items:", j2.data?.length);
    console.log("Unique ItmsGrpCod values:", [...groups]);
    console.log("Sample:", JSON.stringify(j2.data?.[0]));
  }
}
tryFinalQuery();
