const API_BASE = "https://eurorep-api.onrender.com/api";

// ItmsGrpNam might exist directly in OITM
async function tryGroupFromOITM() {
  const sql = `SELECT "U_MARCA", "ItemCode", "ItemName", "ItmsGrpNam" FROM "OITM" WHERE "U_MARCA" IS NOT NULL AND "U_MARCA" <> '' ORDER BY "U_MARCA", "ItemName"`;
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
    console.log("Keys:", Object.keys(j2.data?.[0] || {}));
    console.log("Sample:", JSON.stringify(j2.data?.[0]));
    console.log("Total:", j2.data?.length);
  }
}
tryGroupFromOITM();
