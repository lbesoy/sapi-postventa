const API_BASE = "https://eurorep-api.onrender.com/api";

async function test() {
  console.log("Testing CAT_REFACCIONES with new page size...");
  const res = await fetch(`${API_BASE}/sap/queries/CAT_REFACCIONES/execute`);
  const j = await res.json();
  console.log("Total items:", j.data?.length);
  if (j.data?.length > 0) {
    const groups = {};
    j.data.forEach(x => { groups[x.ItmsGrpCod] = (groups[x.ItmsGrpCod] || 0) + 1; });
    console.log("Items por grupo:", JSON.stringify(groups));
  }
}
test();
