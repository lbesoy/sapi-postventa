const API_BASE = "https://eurorep-api.onrender.com/api";

// OMRC not accessible in SAP SL. Try OITB (Item Groups) and get group name instead
// Also try U_Marca field directly or OITM.SuppCatNum
const newSQL = `SELECT T0."ItemCode", T0."ItemName", T0."U_MARCA" AS "MarcaCode", T0."SuppCatNum" AS "RefProveedor", T1."ItmsGrpNam" AS "Grupo" FROM "OITM" T0 INNER JOIN "OITB" T1 ON T0."ItmsGrpCod" = T1."ItmsGrpCod" ORDER BY T0."U_MARCA", T0."ItemName"`;

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
