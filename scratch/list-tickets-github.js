const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function run() {
  console.log('Consultando Supabase en:', SUPABASE_URL);
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/tickets?select=id,folio,asunto,fecha_creacion,estado&order=folio.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    console.log('Total tickets recuperados:', res.data.length);
    
    const ticketList = res.data.map(t => ({
      folio: t.folio,
      asunto: t.asunto,
      estado: t.estado,
      es_prueba: false, // no exist en bd
      created_at: t.fecha_creacion
    }));
    
    // Guardar en la tabla config de Supabase
    console.log('Guardando resultados en config (debug_tickets_result)...');
    await axios.post(`${SUPABASE_URL}/rest/v1/config`, {
      id: 'debug_tickets_result',
      data: {
        total: res.data.length,
        tickets: ticketList
      }
    }, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    });
    console.log('✅ Resultados de diagnóstico guardados con éxito.');
  } catch (err) {
    console.error('Error:', err.message, err.response?.data);
  }
}

run();
