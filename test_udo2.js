const API_BASE = "https://eurorep-api.onrender.com";

async function test() {
  console.log("Testing /api/sap/udo/OK_MARCA ...");
  const res = await fetch(`${API_BASE}/api/sap/udo/OK_MARCA`);
  console.log("Status:", res.status);
  const json = await res.json();
  if (json.data && json.data.length > 0) {
    console.log(`Got ${json.data.length} marcas:`);
    json.data.forEach(m => console.log(JSON.stringify(m)));
  } else {
    console.log("Response:", JSON.stringify(json, null, 2));
  }
}
test();
