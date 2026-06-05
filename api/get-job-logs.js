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

  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const ghToken = process.env.GITHUB_TOKEN || process.env.SAPI_GH_TOKEN;
  if (!ghToken) {
    return res.status(500).json({ error: 'Token not configured' });
  }

  const GH_REPO = 'lbesoy/sapi-postventa';

  try {
    const resp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/jobs/${jobId}/logs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SAPI-Get-Job-Logs'
      }
    });

    if (resp.ok) {
      const logsText = await resp.text();
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(logsText);
    } else {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
