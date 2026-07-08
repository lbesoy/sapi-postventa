export default async function handler(req, res) {
  // Configurar CORS dinámico y seguro idéntico a send-email.js
  const allowedOrigins = [
    'https://sapi-postventa.vercel.app',
    'https://portal.eurorep.mx',
    'https://plataforma.eurorep.mx',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
  
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
  const isAllowedOrigin = allowedOrigins.some(o => origin.startsWith(o) || referer.startsWith(o)) || isLocal(origin) || isLocal(referer);
  
  if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Access Denied: Forbidden Origin' });
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : 'https://plataforma.eurorep.mx');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Sapi-Client-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Validar autenticación de Supabase (Bearer Token) o Token del Cliente Seguro
  const authHeader = req.headers.authorization || '';
  const clientToken = req.headers['x-sapi-client-token'];
  
  // En producción se requiere estrictamente definir SAPI_CLIENT_TOKEN en el panel de Vercel.
  // En desarrollo se permite el token por defecto para facilitar pruebas.
  const expectedToken = process.env.SAPI_CLIENT_TOKEN || (process.env.NODE_ENV !== 'production' ? 'SapiSecuredClientToken' : undefined);

  const isSupabaseAuth = authHeader.startsWith('Bearer ');
  const isTokenAuth = expectedToken && clientToken === expectedToken;

  if (!isSupabaseAuth && !isTokenAuth) {
    return res.status(401).json({ error: 'Unauthorized: Missing or Invalid Security Token' });
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
          return res.status(401).json({ error: 'Unauthorized: Invalid Security Token' });
        }
      } catch (err) {
        console.error('Auth verification error in trigger-sync:', err);
      }
    }
  }

  const { modulo } = req.body;

  // Cargar el token de GitHub desde las variables de entorno del servidor
  const ghToken = process.env.GITHUB_TOKEN || process.env.SAPI_GH_TOKEN;
  if (!ghToken) {
    console.error('[Sync API] GitHub Actions Token no configurado en el servidor.');
    return res.status(500).json({ error: 'Internal Server Error: Sync Token is not configured' });
  }

  const GH_REPO = 'lbesoy/sapi-postventa';
  const GH_WORKFLOW = 'sync-sap.yml';

  try {
    const resp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SAPI-Postventa-Serverless-Function'
      },
      body: JSON.stringify({ ref: 'main', inputs: { modulo: modulo || 'all' } })
    });

    if (resp.status === 204) {
      return res.status(200).json({ success: true, message: 'Sync SAP triggered successfully via GitHub Actions' });
    } else {
      const errData = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: errData.message || `GitHub API responded with status ${resp.status}` });
    }
  } catch (error) {
    console.error('Error triggering GitHub Actions sync:', error);
    return res.status(500).json({ error: 'Failed to trigger sync' });
  }
}
