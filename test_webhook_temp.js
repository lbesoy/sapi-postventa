import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2MTQzNSwiZXhwIjoyMDkzMzM3NDM1fQ.Q9-xHh3bago5shMju8QQN1bXDWMytrIRfADCFDLC4aI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', 'CL052')
    .single();

  console.log('Cliente CL052 query result:', { cliente, error });
}

run();
