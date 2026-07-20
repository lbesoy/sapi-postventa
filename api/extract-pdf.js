export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'No base64Data provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      console.log('[PDF Auto-Extract Vercel] Using Gemini API for multimodal extraction...');
      const base64Clean = base64Data.split(',')[1] || base64Data;
      
      const payload = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Clean
              }
            },
            {
              text: `Extract the following fields from this quotation/order PDF:
1. Document Number (Número de documento / Folio / Número de cotización). It's usually a 7-digit number (e.g. 1100001).
2. Total Amount (Importe TOTAL / Total / Monto / Subtotal + Impuestos). Decimal number, e.g. 135043.49.
3. Client Code or Name (e.g. Concretos Delese).
4. Items (Artículos/Conceptos). Extract each item from the main table, including description, quantity, unit, pending (x surtir), warehouse (almacén), unit price, tax %, and total.
5. Travel Details (Detalles de Viaje / Logística). Look for keywords like "Viáticos", "Hospedaje", "Alimentos", "Origen", "Destino", "Ruta", "Traslado" in the items or text and infer travel logistics. Specifically extract num_hospedaje, num_alimento, and num_traslado if present.

Return a JSON object matching exactly this structure:
{
  "numero_cotizacion": "1100001",
  "monto": 135043.49,
  "cliente": "Concretos Delese",
  "detalles_viaje": {
    "origen": "CDMX",
    "destino": "Nuevo Laredo",
    "num_hospedaje": 1,
    "num_alimento": 2,
    "num_traslado": 1
  },
  "articulos": [
    {
      "descripcion": "FILTRO DE ACEITE",
      "cantidad": 1,
      "unidad_medida": "H87",
      "x_surtir": 0,
      "almacen": "ARZ",
      "precio": 391.33,
      "impuesto_porcentaje": 16,
      "total": 391.33
    }
  ]
}`
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const result = JSON.parse(jsonText.trim());
          console.log('[PDF Auto-Extract Vercel] Gemini API Result:', result);
          return res.json({ ai: true, data: result });
        }
      } else {
        const errText = await response.text();
        console.error('[PDF Auto-Extract Vercel] Gemini API error response:', errText);
      }
    }

    return res.status(500).json({ error: 'Gemini API Key not configured or call failed on Vercel.' });
  } catch (err) {
    console.error('[PDF Auto-Extract Vercel] Critical Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
