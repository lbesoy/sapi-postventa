const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, count, error } = await sb.from('refacciones').select('*', { count: 'exact', head: false });
  console.log("Supabase error:", error);
  console.log("Supabase refacciones length:", data?.length);
  console.log("Supabase exact count:", count);
}
test();
