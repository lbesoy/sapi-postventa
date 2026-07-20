require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
async function run() {
  const { data, error } = await supabase.from('ordenes').update({ reembolso_km: true }).eq('folio', 'OS-PRUEBA-002').select();
  if (error) console.error(error);
  else console.log('Updated:', data);
}
run();
