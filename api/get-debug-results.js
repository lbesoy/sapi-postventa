export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sapi-Client-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const clientToken = req.headers['x-sapi-client-token'];
  if (clientToken !== 'SapiSecuredClientToken') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://mupevytlssqcbhlmzmcp.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!supabaseKey) {
    return res.status(500).json({ error: 'Supabase Key not configured' });
  }

  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.debug_tickets_result`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      return res.status(200).json(data);
    } else {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
