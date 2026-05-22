const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const email = 'testuser_1779390841643@gmail.com';
  console.log(`Logging in as ${email}...`);
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: 'Password123!'
  });
  
  if (error) {
    console.error('Login failed:', error.message);
    return;
  }
  console.log('Login successful! User ID:', data.user.id);
  
  console.log('Querying own row from user_roles...');
  const { data: ownRole, error: ownErr } = await sb.from('user_roles').select('*').eq('id', data.user.id);
  console.log('Own role error:', ownErr);
  console.log('Own role data:', ownRole);

  console.log('Querying all rows from user_roles...');
  const { data: allRoles, error: allErr } = await sb.from('user_roles').select('*');
  console.log('All roles error:', allErr);
  console.log('All roles count:', allRoles ? allRoles.length : 0);
  console.log('All roles sample:', allRoles);

  await sb.auth.signOut();
}
main();
