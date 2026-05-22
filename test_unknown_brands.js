const API_BASE = "https://eurorep-api.onrender.com/api";

const KNOWN_CODES = new Set(['ETP','BCR','PTZ','SCH','CIF','MTM','MCN','LON','CAS','OTM','CNF','TFB','RBC','RBM','FIO','EVE','POR','SIM','TUR','MBC','DOR','KNK','HYU','HER','EBS','RCR']);

async function findUnknown() {
  const res = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
  const j = await res.json();
  const unknown = (j.data || []).filter(x => !KNOWN_CODES.has((x.U_MARCA || '').trim().toUpperCase()));
  console.log(`Unknown brand items: ${unknown.length}`);
  unknown.forEach(x => console.log(`  U_MARCA="${x.U_MARCA}" | ${x.ItemCode} | ${x.ItemName}`));
}
findUnknown();
