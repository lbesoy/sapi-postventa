export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const ghToken = process.env.GITHUB_TOKEN || process.env.SAPI_GH_TOKEN;
  if (!ghToken) {
    return res.status(500).json({ error: 'GitHub Token not configured' });
  }

  const GH_REPO = 'lbesoy/sapi-postventa';
  const GH_WORKFLOW = 'sync-sap.yml';

  try {
    const resp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/runs?per_page=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SAPI-Check-Script'
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      return res.status(200).json(data.workflow_runs || []);
    } else {
      const errData = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: errData.message || 'GitHub API error' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
