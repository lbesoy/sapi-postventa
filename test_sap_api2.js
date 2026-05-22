const API_URL = "https://eurorep-api.onrender.com/api/sap/queries/CAT_REFACCIONES/execute";

async function test() {
  const res = await fetch(API_URL);
  const json = await res.json();
  console.log("All items:");
  json.data.forEach(item => console.log(JSON.stringify(item)));
}
test();
