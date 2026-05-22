const API_URL = "https://eurorep-api.onrender.com/api/sap/queries/Cat%C3%A1logo%20Productos%20Tickets/execute";

async function test() {
  const res = await fetch(API_URL);
  const json = await res.json();
  if (!json.data) { console.log("Error:", JSON.stringify(json)); return; }
  console.log(`Total items: ${json.data.length}`);
  if (json.data.length > 0) {
    console.log("Keys:", Object.keys(json.data[0]));
    console.log("First 3 items:");
    json.data.slice(0, 3).forEach(item => console.log(JSON.stringify(item)));
  }
}
test();
