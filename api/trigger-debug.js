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

  const ghToken = process.env.GITHUB_TOKEN || process.env.SAPI_GH_TOKEN;
  if (!ghToken) {
    return res.status(500).json({ error: 'Token not configured' });
  }

  const GH_REPO = 'lbesoy/sapi-postventa';
  const GH_WORKFLOW = 'debug-tickets.yml';

  try {
    const resp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SAPI-Debug-Trigger'
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (resp.status === 204) {
      return res.status(200).json({ success: true, message: 'Debug workflow triggered' });
    } else {
      const errData = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: errData.message || 'Error' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
