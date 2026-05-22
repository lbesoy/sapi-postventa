const API_URL = "https://eurorep-api.onrender.com/api/sap/queries";

async function test() {
  const res = await fetch(API_URL);
  const json = await res.json();
  console.log("Available queries:", JSON.stringify(json, null, 2));
}
test();
