const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function count() {
  const { data: c } = await supabase.from('clientes').select('id');
  const { data: s } = await supabase.from('sitios').select('id');
  const { data: m } = await supabase.from('maquinaria').select('id');
  console.log('Clientes:', c ? c.length : 0);
  console.log('Sitios:', s ? s.length : 0);
  console.log('Maq:', m ? m.length : 0);
}
count();
