const API_BASE = "https://eurorep-api.onrender.com/api";

async function findQueries() {
  const res = await fetch(`${API_BASE}/sap/queries`);
  const json = await res.json();
  console.log("ALL queries in SAP:");
  (json.data || []).forEach(q => {
    console.log(`SqlCode: "${q.SqlCode}" | SqlName: "${q.SqlName}"`);
  });
}
findQueries();
