const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://mupevytlssqcbhlmzmcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY');

async function run() {
  const { data, error } = await sb.from('user_roles').select('*');
  console.log('Error:', error);
  console.log('Count:', data ? data.length : 0);
  console.log('First 3 user_roles:', data ? data.slice(0, 3) : []);
}
run();
