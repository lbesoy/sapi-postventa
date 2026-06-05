const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function run() {
  console.log('Consultando Supabase en:', SUPABASE_URL);
  console.log('SUPABASE_KEY length:', SUPABASE_KEY ? SUPABASE_KEY.length : 0);
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/tickets?select=id,folio,asunto,fecha_creacion,es_prueba,estado&order=folio.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    console.log('Total tickets en Supabase:', res.data.length);
    console.log('Lista completa de tickets ordenados por folio:');
    res.data.forEach(t => {
      console.log(`- Folio: ${t.folio} | Asunto: ${t.asunto} | Estado: ${t.estado} | esPrueba: ${t.es_prueba} | Creado: ${t.fecha_creacion}`);
    });
    
    // Buscar específicamente si hay folios que contengan "24" o similares
    const t24 = res.data.filter(t => t.folio && t.folio.includes('24'));
    console.log('\nTickets que contienen "24" en su folio:');
    if (t24.length > 0) {
      t24.forEach(t => {
        console.log(`- Folio: ${t.folio} | ID: ${t.id} | Asunto: ${t.asunto} | Estado: ${t.estado} | esPrueba: ${t.es_prueba}`);
      });
    } else {
      console.log('No se encontró ningún ticket con "24" en el folio.');
    }
  } catch (err) {
    console.error('Error:', err.message, err.response?.data);
  }
}

run();
