const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mupevytlssqcbhlmzmcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY');

async function test() {
  const { data, error } = await supabase.from('user_roles').insert({ id: '00000000-0000-0000-0000-000000000000', nombre: 'Test Columns' });
  console.log('insert test result:', data, error);
}
test();
