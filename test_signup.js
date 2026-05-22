const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mupevytlssqcbhlmzmcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY');

async function testSignup() {
  const email = `testuser_${Date.now()}@gmail.com`;
  console.log(`Testing signup with ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: 'Password123!',
    options: {
      data: { nombre: 'Test User' }
    }
  });
  console.log('Signup result:', data, error);
}

testSignup();
