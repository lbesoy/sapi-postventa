const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const emails = [
    'arturocaloca@eurorep.mx',
    'admon@eurorep.mx'
  ];
  
  for (const email of emails) {
    console.log(`Trying login for: ${email}`);
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: '0000'
    });
    
    if (error) {
      console.log(`Login failed for ${email}:`, error.message);
    } else {
      console.log(`Login SUCCESS for ${email}! User ID: ${data.user.id}`);
      // Now query user_roles
      const { data: roles, error: rolesErr } = await sb.from('user_roles').select('*');
      if (rolesErr) {
        console.error('Error querying user_roles:', rolesErr.message);
      } else {
        console.log(`Found ${roles.length} roles:`);
        roles.forEach(r => console.log(`- ${r.nombre} (${r.rol}): active=${r.activo}`));
      }
      await sb.auth.signOut();
    }
  }
}

main();
