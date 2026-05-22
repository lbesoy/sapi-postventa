const API_BASE = "https://eurorep-api.onrender.com/api";

const newSQL = `SELECT T0."ItemCode", T0."ItemName", T0."ItmsGrpCod", T1."ItmsGrpNam" AS "Grupo", T2."FirmName" AS "MarcaCode"
FROM "OITM" T0
LEFT JOIN "OITG" T1 ON T0."ItmsGrpCod" = T1."ItmsGrpCod"
LEFT JOIN "OMRC" T2 ON T0."FirmCode" = T2."FirmCode"
ORDER BY T2."FirmName", T0."ItemName"`;

async function updateQuery() {
  const res = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sqlText: newSQL, sqlName: 'CAT_REFACCIONES' })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.slice(0, 300));
}
updateQuery();
