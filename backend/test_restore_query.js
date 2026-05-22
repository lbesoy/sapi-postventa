const axios = require('axios');
const API_BASE = "https://eurorep-api.onrender.com/api";

const sql = `SELECT T0."U_MARCA", T1."Name" AS "MarcaName", T0."ItemCode", T0."ItemName", T2."ItmsGrpNam", T0."ItmsGrpCod", T0."Price", T0."Currency", T0."OnHand" FROM OITM T0 INNER JOIN "SBO_SAPI"."@OK_MARCA" T1 ON T0."U_MARCA" = T1."Code" INNER JOIN OITB T2 ON T0."ItmsGrpCod" = T2."ItmsGrpCod" ORDER BY T0."U_MARCA", T0."ItemName"`;

async function test() {
  try {
      const res = await axios.post(`${API_BASE}/sap/queries`, {
        sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: sql
      });
      console.log("Save:", res.data);
      if (res.data.success) {
        const r2 = await axios.get(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
        console.log("Total items:", r2.data.data?.length);
        console.log("Sample:", r2.data.data?.[0]);
      }
  } catch(e) {
      console.log("Error:", e.response?.data || e.message);
  }
}
test();
