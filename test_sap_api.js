const API_URL = "https://eurorep-api.onrender.com/api/sap/queries/CAT_REFACCIONES/execute";

async function test() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    if (json.data && json.data.length > 0) {
      console.log(`Total items: ${json.data.length}`);
      
      let itemsWithoutMarca = 0;
      for (let i = 0; i < json.data.length; i++) {
        const item = json.data[i];
        if (!item.U_MARCA && !item.Marca && !item.FirmName) {
          itemsWithoutMarca++;
          if (itemsWithoutMarca <= 3) {
             console.log(`Item with no brand: ${item.ItemCode} - ${item.ItemName}`);
             console.log("Keys available:", Object.keys(item));
          }
        }
      }
      console.log(`Total items missing U_MARCA: ${itemsWithoutMarca}`);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
