const API_BASE = "https://eurorep-api.onrender.com/api";

// First: try to get the OITG structure to find the correct field name
async function tryOITG() {
  // Try updating query with OITG - different field names
  const tests = [
    `SELECT T0."U_MARCA", T0."ItemCode", T0."ItemName", T1."ItmsGrpNam" AS "GrupoNombre" FROM "OITM" T0 INNER JOIN "OITG" T1 ON T0."ItmsGrpCod" = T1."ItmsGrpCod" WHERE T0."U_MARCA" IS NOT NULL AND T0."U_MARCA" <> '' ORDER BY T0."U_MARCA", T0."ItemName"`,
    `SELECT T0."U_MARCA", T0."ItemCode", T0."ItemName", T1."ItmsGrpNam" AS "GrupoNombre" FROM "OITM" T0 LEFT JOIN "OITG" T1 ON T0."ItmsGrpCod" = T1."ItmsGrpCod" WHERE T0."U_MARCA" IS NOT NULL AND T0."U_MARCA" <> '' ORDER BY T0."U_MARCA", T0."ItemName"`,
  ];

  for (let i = 0; i < tests.length; i++) {
    console.log(`\nTrying SQL ${i+1}...`);
    const res = await fetch(`${API_BASE}/sap/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlCode: 'CAT_REFACCIONES', sqlName: 'CAT_REFACCIONES', sqlText: tests[i] })
    });
    const json = await res.json();
    console.log("Save:", json.success ? 'OK' : json.details?.error?.message?.value);
    
    if (json.success) {
      const res2 = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
      const json2 = await res2.json();
      if (json2.data && json2.data.length > 0) {
        console.log("Keys:", Object.keys(json2.data[0]));
        console.log("Sample:", JSON.stringify(json2.data[0]));
      } else {
        console.log("Execute error:", JSON.stringify(json2));
      }
      break;
    }
  }
}
tryOITG();
