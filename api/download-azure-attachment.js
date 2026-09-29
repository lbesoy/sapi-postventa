export default async function handler(req, res) {
  // CORS configuration
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
  const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
  const isAllowedOrigin = allowedOrigins.some(o => origin.startsWith(o) || referer.startsWith(o)) || isLocal(origin) || isLocal(referer);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : 'https://plataforma.eurorep.mx');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Sapi-Client-Token, X-Ms-Graph-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const msId = req.query.msId || req.body?.msId;
  const attachmentId = req.query.attachmentId || req.body?.attachmentId;
  const fileName = req.query.fileName || req.body?.fileName;

  if (!msId) {
    return res.status(400).json({ error: 'MISSING_MS_ID', message: 'Falta el parámetro msId' });
  }

  try {
    let graphToken = req.headers['x-ms-graph-token'] || '';
    const authHeader = req.headers.authorization || '';
    if (!graphToken && authHeader.startsWith('Bearer ')) {
      const candidateToken = authHeader.split(' ')[1];
      if (candidateToken && candidateToken.length > 50) graphToken = candidateToken;
    }

    const azureClientId = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
    const azureClientSecret = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
    const azureTenantId = process.env.AZURE_TENANT_ID || process.env.MICROSOFT_TENANT_ID || 'common';
    const azureUserMail = (process.env.AZURE_MAIL_USER || process.env.SMTP_EMAIL || 'Ptalctes@eurorep.mx').toLowerCase();

    if (!graphToken && azureClientId && azureClientSecret && azureTenantId !== 'common') {
      try {
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', azureClientId);
        tokenParams.append('client_secret', azureClientSecret);
        tokenParams.append('scope', 'https://graph.microsoft.com/.default');
        tokenParams.append('grant_type', 'client_credentials');

        const tokenResp = await fetch(`https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString()
        });

        if (tokenResp.ok) {
          const tokenJson = await tokenResp.json();
          graphToken = tokenJson.access_token;
        }
      } catch (e) {}
    }

    if (!graphToken) {
      return res.status(401).json({ error: 'NO_AZURE_TOKEN', message: 'No hay token de Microsoft Graph disponible' });
    }

    const headers = {
      'Authorization': `Bearer ${graphToken}`,
      'Accept': 'application/json'
    };

    let attachmentData = null;

    // Intentar buscar adjunto directo
    if (attachmentId && attachmentId !== 'undefined' && attachmentId !== 'null') {
      const endpoints = [
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(azureUserMail)}/messages/${msId}/attachments/${attachmentId}`,
        `https://graph.microsoft.com/v1.0/me/messages/${msId}/attachments/${attachmentId}`
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, { headers });
          if (r.ok) {
            attachmentData = await r.json();
            break;
          }
        } catch (e) {}
      }
    }

    // Si no se encontró por ID o no se proporcionó ID, listar adjuntos del mensaje
    if (!attachmentData && msId && !msId.startsWith('email_rep_') && !msId.startsWith('log_')) {
      const listEndpoints = [
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(azureUserMail)}/messages/${msId}/attachments`,
        `https://graph.microsoft.com/v1.0/me/messages/${msId}/attachments`
      ];
      for (const lep of listEndpoints) {
        try {
          const r = await fetch(lep, { headers });
          if (r.ok) {
            const listJson = await r.json();
            const items = listJson.value || [];
            const match = items.find(a => (fileName && a.name === fileName) || (attachmentId && a.id === attachmentId)) || items[0];
            if (match && match.contentBytes) {
              attachmentData = match;
              break;
            }
          }
        } catch (e) {}
      }
    }

    // Si aún no se encontró, buscar en buzones sentitems e inbox por nombre de archivo
    if (!attachmentData && fileName) {
      const searchBases = [
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(azureUserMail)}`,
        `https://graph.microsoft.com/v1.0/me`
      ];
      const folders = ['sentitems', 'inbox'];
      for (const base of searchBases) {
        if (attachmentData) break;
        for (const f of folders) {
          try {
            const sUrl = `${base}/mailFolders/${f}/messages?$top=30&$expand=attachments&$orderby=${f === 'inbox' ? 'receivedDateTime' : 'sentDateTime'} desc`;
            const sRes = await fetch(sUrl, { headers });
            if (sRes.ok) {
              const sJson = await sRes.json();
              const msgs = Array.isArray(sJson.value) ? sJson.value : [];
              for (const m of msgs) {
                const atts = Array.isArray(m.attachments) ? m.attachments : [];
                const matchedAtt = atts.find(a => (a.name && (a.name === fileName || a.name.toLowerCase() === fileName.toLowerCase())) || (attachmentId && a.id === attachmentId));
                if (matchedAtt && matchedAtt.contentBytes) {
                  attachmentData = matchedAtt;
                  break;
                }
              }
              if (attachmentData) break;
            }
          } catch (e) {}
        }
      }
    }

    if (!attachmentData || !attachmentData.contentBytes) {
      return res.status(404).json({ error: 'ATTACHMENT_NOT_FOUND', message: 'No se encontró el contenido del archivo adjunto en Microsoft Graph' });
    }

    return res.status(200).json({
      success: true,
      name: attachmentData.name || fileName || 'adjunto',
      contentType: attachmentData.contentType || 'application/octet-stream',
      size: attachmentData.size || 0,
      contentBytes: attachmentData.contentBytes
    });
  } catch (err) {
    console.error('[Download Attachment Error]:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
}
