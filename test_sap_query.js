const API_URL = "https://eurorep-api.onrender.com/api/sap/queries/CAT_REFACCIONES/execute";

async function test() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    console.log("Status:", res.status);
    if (json.data && json.data.length > 0) {
      console.log("Keys available in first item:", Object.keys(json.data[0]));
      console.log("First item sample:", json.data[0]);
    } else {
      console.log("No data returned or error:", json);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
