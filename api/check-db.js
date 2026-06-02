export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mupevytlssqcbhlmzmcp.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Verificar si existe CL190
    const { data: cl190, error: err1 } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', 'CL190');

    // 2. Contar clientes totales en Supabase
    const { count, error: err2 } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });

    // 3. Obtener los 5 últimos clientes por created_at o id
    const { data: latest, error: err3 } = await supabase
      .from('clientes')
      .select('id,nombre,created_at')
      .order('id', { ascending: false })
      .limit(5);

    return res.status(200).json({
      supabaseUrl,
      supabaseKeyLength: supabaseKey ? supabaseKey.length : 0,
      supabaseKeySnippet: supabaseKey ? supabaseKey.substring(0, 15) + '...' : null,
      cl190,
      totalCount: count,
      latest,
      errors: { err1, err2, err3 }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
