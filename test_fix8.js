const API_BASE = "https://eurorep-api.onrender.com/api";

// Try to fetch ItemGroups via SAP Service Layer OData (not SQL)
// Let's add it to server.js via our udo endpoint using different entity name
async function tryGetGroupName() {
  // Check SAP Service Layer endpoints for ItemGroups 
  // These are standard Service Layer entities
  const endpoints = ['ItemGroups', 'ItemsGroupCodes', 'GroupItems'];
  for (const ep of endpoints) {
    const res = await fetch(`${API_BASE}/sap/udo/${ep}`);
    const j = await res.json();
    if (j.success && j.data?.length > 0) {
      console.log(`✅ ${ep} WORKS! Keys:`, Object.keys(j.data[0]));
      j.data.slice(0,3).forEach(x => console.log(JSON.stringify(x)));
    } else {
      console.log(`❌ ${ep}:`, j.error || 'no data');
    }
  }
}
tryGetGroupName();
