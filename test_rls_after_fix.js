const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2MTQzNSwiZXhwIjoyMDkzMzM3NDM1fQ.Q9-xHh3bago5shMju8QQN1bXDWMytrIRfADCFDLC4aI';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const email = 'temp_tecnico_test_rls_after@example.com';
  const password = 'Password123!';
  
  console.log('1. Creating temporary user...');
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (createError) {
    console.error('Error creating user:', createError);
    return;
  }

  const userId = userData.user.id;
  console.log(`User created with ID: ${userId}`);

  try {
    console.log('2. Inserting role "tecnico" for user in user_roles...');
    const { error: roleError } = await adminClient
      .from('user_roles')
      .update({ rol: 'tecnico', nombre: 'Usuario prueba', activo: true })
      .eq('id', userId);

    if (roleError) {
      console.error('Error setting user role:', roleError);
      return;
    }

    console.log('3. Logging in as temporary user...');
    const { data: sessionData, error: loginError } = await anonClient.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      console.error('Error logging in:', loginError);
      return;
    }

    const userToken = sessionData.session.access_token;
    console.log('Logged in successfully!');

    console.log('4. Querying config table to check get_my_name()...');
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    });

    console.log('5. Querying ordenes table as the authenticated user...');
    const { data: ordenesData, error: ordenesError } = await userClient
      .from('ordenes')
      .select('id, folio, tecnico, notas');

    if (ordenesError) {
      console.error('Error fetching ordenes as user:', ordenesError);
    } else {
      console.log('Ordenes data fetched successfully as user:', JSON.stringify(ordenesData, null, 2));
    }

  } finally {
    console.log('6. Cleaning up temporary user...');
    await adminClient.auth.admin.deleteUser(userId);
    console.log('Temporary user deleted.');
  }
}

run();
