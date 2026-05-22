const API_BASE = "https://eurorep-api.onrender.com/api";

// In SAP HANA the OITG primary key is "ItmsGrpCod" but let's try "Number" or different
// Also try just OMRC join first - simpler
const newSQL = `SELECT T0."ItemCode", T0."ItemName", T2."FirmName" AS "MarcaCode" FROM "OITM" T0 LEFT JOIN "OMRC" T2 ON T0."FirmCode" = T2."FirmCode" ORDER BY T2."FirmName", T0."ItemName"`;

async function updateQuery() {
  const res = await fetch(`${API_BASE}/sap/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: newSQL })
  });
  const json = await res.json();
  console.log("Response:", JSON.stringify(json, null, 2));
}
updateQuery();
