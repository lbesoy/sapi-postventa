const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const {data: t, error: et} = await supabase.from('tickets').select('id');
  console.log('Tickets Error:', et);
  const {data: u, error: eu} = await supabase.from('usuarios').select('id');
  console.log('Usuarios Error:', eu);
}
check();
