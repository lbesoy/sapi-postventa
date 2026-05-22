const API_BASE = "https://eurorep-api.onrender.com/api";

// The group name needs to come from OITG but we can't access it directly.
// Let's look at what groups the actual items belong to, and see if we can use 
// the ItemsGroupCode from a SAP Service Layer ItemGroups endpoint
// Also try a simpler query: look at what groups our items have and try SELECT with known columns
async function tryGroupQuery() {
  // Try ItemGroups via SAP Service Layer
  const res = await fetch(`${API_BASE}/sap/udo/ItemGroups`);
  const j = await res.json();
  console.log("ItemGroups:", JSON.stringify(j).slice(0, 300));
}
tryGroupQuery();
