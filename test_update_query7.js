const API_BASE = "https://eurorep-api.onrender.com/api";

// Try just OITM with U_MARCA + ItmsGrpNam via OITG using "ItmsGrpNam" field
// The issue before was ItmsGrpCod column in OITG - in some SAP HANA versions it's "Number"
const newSQL = `SELECT T0."ItemCode", T0."ItemName", T0."U_MARCA" AS "MarcaCode", T0."SuppCatNum" AS "RefProveedor", T1."ItmsGrpNam" AS "Grupo" FROM "OITM" T0 INNER JOIN "OITG" T1 ON T0."ItmsGrpCod" = T1."Number" ORDER BY T0."U_MARCA", T0."ItemName"`;

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
