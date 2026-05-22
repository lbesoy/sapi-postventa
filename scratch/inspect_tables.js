const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mupevytlssqcbhlmzmcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY');

async function test() {
  try {
    const { data: users, error: err1 } = await supabase.from('usuarios').select('*').limit(2);
    console.log('--- USUARIOS ---');
    console.log('Error:', err1);
    console.log('Sample rows:', JSON.stringify(users, null, 2));

    const { data: roles, error: err2 } = await supabase.from('user_roles').select('*').limit(2);
    console.log('--- USER_ROLES ---');
    console.log('Error:', err2);
    console.log('Sample rows:', JSON.stringify(roles, null, 2));
  } catch (e) {
    console.error('Exception:', e);
  }
  process.exit(0);
}
test();
