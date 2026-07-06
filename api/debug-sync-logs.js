export default async function handler(req, res) {
  const ghToken = process.env.GITHUB_TOKEN || process.env.SAPI_GH_TOKEN;
  if (!ghToken) {
    return res.status(500).json({ error: 'GitHub Actions Token no configurado.' });
  }

  const GH_REPO = 'lbesoy/sapi-postventa';

  try {
    const runsResp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/runs?per_page=1`, {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SAPI-Postventa-Debugger'
      }
    });

    if (!runsResp.ok) {
      return res.status(runsResp.status).json({ error: 'Failed to fetch runs from GitHub' });
    }

    const runsData = await runsResp.json();
    const latestRun = runsData.workflow_runs?.[0];
    if (!latestRun) {
      return res.status(404).json({ error: 'No workflow runs found' });
    }

    const jobsResp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/runs/${latestRun.id}/jobs`, {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SAPI-Postventa-Debugger'
      }
    });

    if (!jobsResp.ok) {
      return res.status(jobsResp.status).json({ error: `Failed to fetch jobs for run ${latestRun.id}` });
    }

    const jobsData = await jobsResp.json();
    const job = jobsData.jobs?.[0];
    if (!job) {
      return res.status(404).json({ error: 'No jobs found in this run' });
    }

    const jobLogsResp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/jobs/${job.id}/logs`, {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SAPI-Postventa-Debugger'
      }
    });

    if (!jobLogsResp.ok) {
      return res.status(jobLogsResp.status).json({ error: `Failed to fetch logs for job ${job.id}` });
    }

    const logsText = await jobLogsResp.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(logsText);

  } catch (error) {
    console.error('Error debugging sync logs:', error);
    return res.status(500).json({ error: error.message });
  }
}
