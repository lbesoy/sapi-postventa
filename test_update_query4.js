const API_BASE = "https://eurorep-api.onrender.com/api";

// Try with correct OITG join column - it uses ItmsGrpCod but the alias is different in HANA
const newSQL = `SELECT T0."ItemCode", T0."ItemName", T1."ItmsGrpNam" AS "Grupo", T2."FirmName" AS "MarcaCode" FROM "OITM" T0 LEFT JOIN "OITG" T1 ON T0."ItmsGrpCod" = T1."ItmsGrpCod" LEFT JOIN "OMRC" T2 ON T0."FirmCode" = T2."FirmCode" ORDER BY T2."FirmName", T0."ItemName"`;

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
