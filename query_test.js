const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mupevytlssqcbhlmzmcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY');

async function test() {
  const { data, error } = await supabase.from('user_roles').select('*');
  console.log('user_roles count:', data ? data.length : error);
  const { data: u2, error: e2 } = await supabase.from('usuarios').select('*');
  console.log('usuarios count:', u2 ? u2.length : e2);
}
test();
