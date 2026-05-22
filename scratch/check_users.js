const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- Querying table "usuarios" ---');
  const { data: usuarios, error: err1 } = await sb.from('usuarios').select('*');
  if (err1) {
    console.error('Error querying "usuarios":', err1);
  } else {
    console.log(`Found ${usuarios.length} users in "usuarios":`);
    usuarios.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.nombre}, Email: ${u.email}, Role: ${u.rol}, Active: ${u.activo}`));
  }

  console.log('\n--- Querying table "user_roles" ---');
  const { data: userRoles, error: err2 } = await sb.from('user_roles').select('*');
  if (err2) {
    console.error('Error querying "user_roles":', err2);
  } else {
    console.log(`Found ${userRoles.length} users in "user_roles":`);
    userRoles.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.nombre}, Email: ${u.email}, Role: ${u.rol}, Active: ${u.activo}`));
  }
}

main();
