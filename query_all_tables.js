const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const tables = ['usuarios', 'config', 'clientes', 'tickets', 'ordenes', 'sitios', 'maquinaria', 'refacciones'];
  for (const table of tables) {
    try {
      const { data, error } = await sb.from(table).select('*').limit(1);
      if (error) {
        console.error(`Table "${table}" error:`, error.message);
      } else {
        console.log(`Table "${table}" success: retrieved ${data.length} sample row(s)`);
      }
    } catch (e) {
      console.error(`Table "${table}" exception:`, e.message);
    }
  }
}
run();
