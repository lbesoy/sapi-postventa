const API_BASE = "https://eurorep-api.onrender.com/api";

// Filter by valid brand codes only (exact match with @OK_MARCA)
const validCodes = "('ETP','BCR','PTZ','SCH','CIF','MTM','MCN','LON','CAS','OTM','CNF','TFB','RBC','RBM','FIO','EVE','POR','SIM','TUR','MBC','DOR','KNK','HYU','HER','EBS','RCR')";

const sql = `SELECT "U_MARCA", "ItemCode", "ItemName", "ItmsGrpCod" FROM "OITM" WHERE "U_MARCA" IN ${validCodes} ORDER BY "U_MARCA", "ItemName"`;

async function test() {
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
    console.log("Total items:", j2.data?.length);
    // Show unique groups
    const groups = {};
    j2.data?.forEach(x => { groups[x.ItmsGrpCod] = (groups[x.ItmsGrpCod] || 0) + 1; });
    console.log("Items por ItmsGrpCod:", JSON.stringify(groups));
    console.log("Sample:", JSON.stringify(j2.data?.slice(0,2)));
  }
}
test();
