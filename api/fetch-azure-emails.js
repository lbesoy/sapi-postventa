import { createClient } from '@supabase/supabase-js';

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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let graphToken = req.headers['x-ms-graph-token'] || '';
    const authHeader = req.headers.authorization || '';
    
    // Check if auth header contains ms graph token
    if (!graphToken && authHeader.startsWith('Bearer ')) {
      const candidateToken = authHeader.split(' ')[1];
      if (candidateToken && candidateToken.length > 50) {
        graphToken = candidateToken;
      }
    }

    const azureClientId = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
    const azureClientSecret = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
    const azureTenantId = process.env.AZURE_TENANT_ID || process.env.MICROSOFT_TENANT_ID || 'common';
    const azureUserMail = process.env.AZURE_MAIL_USER || process.env.SMTP_EMAIL || 'Ptalctes@eurorep.mx';

    let endpointBase = 'https://graph.microsoft.com/v1.0/me';
    let headers = {};

    // 1. If no delegated token, try client credentials grant from Azure AD
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
          endpointBase = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(azureUserMail)}`;
        }
      } catch (tokenErr) {
        console.warn('[Azure Graph] Error obteniendo token por client_credentials:', tokenErr);
      }
    }

    if (!graphToken) {
      return res.status(401).json({
        error: 'NO_AZURE_TOKEN',
        message: 'No se recibió un token de Microsoft Graph activo ni credenciales de Azure AD en el servidor. Inicia sesión con Microsoft en la aplicación para sincronizar los correos de Azure.'
      });
    }

    headers = {
      'Authorization': `Bearer ${graphToken}`,
      'Accept': 'application/json',
      'Prefer': 'outlook.body-content-type="html"'
    };

    // 2. Consultar mensajes recibidos y enviados desde Microsoft Graph
    const selectFields = 'id,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead,conversationId';
    
    const [inboxRes, sentRes] = await Promise.all([
      fetch(`${endpointBase}/mailFolders/inbox/messages?$top=50&$select=${selectFields}&$orderby=receivedDateTime desc`, { headers }).catch(e => ({ ok: false, error: e })),
      fetch(`${endpointBase}/mailFolders/sentitems/messages?$top=50&$select=${selectFields}&$orderby=sentDateTime desc`, { headers }).catch(e => ({ ok: false, error: e }))
    ]);

    let rawMessages = [];

    if (inboxRes && inboxRes.ok) {
      const inboxJson = await inboxRes.json();
      if (Array.isArray(inboxJson.value)) {
        rawMessages = rawMessages.concat(inboxJson.value.map(m => ({ ...m, _folder: 'inbox' })));
      }
    } else {
      // Fallback a /messages general
      const allRes = await fetch(`${endpointBase}/messages?$top=50&$select=${selectFields}&$orderby=receivedDateTime desc`, { headers }).catch(() => null);
      if (allRes && allRes.ok) {
        const allJson = await allRes.json();
        if (Array.isArray(allJson.value)) {
          rawMessages = rawMessages.concat(allJson.value);
        }
      }
    }

    if (sentRes && sentRes.ok) {
      const sentJson = await sentRes.json();
      if (Array.isArray(sentJson.value)) {
        rawMessages = rawMessages.concat(sentJson.value.map(m => ({ ...m, _folder: 'sentitems' })));
      }
    }

    // 3. Normalizar correos de Microsoft a formato SAPI
    const emailMap = new Map();

    rawMessages.forEach(m => {
      if (!m || !m.id || emailMap.has(m.id)) return;

      const fromAddress = m.from?.emailAddress?.address || '';
      const fromName = m.from?.emailAddress?.name || fromAddress;
      
      const toRecipients = Array.isArray(m.toRecipients) ? m.toRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];
      const ccRecipients = Array.isArray(m.ccRecipients) ? m.ccRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];
      const bccRecipients = Array.isArray(m.bccRecipients) ? m.bccRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];

      const isSent = m._folder === 'sentitems' || fromAddress.toLowerCase().includes('ptalctes@eurorep.mx') || fromAddress.toLowerCase().includes('eurorep');
      const clientName = isSent ? (m.toRecipients?.[0]?.emailAddress?.name || toRecipients.join(', ') || 'Cliente') : fromName;

      const mappedItem = {
        id: `ms_${m.id}`,
        msId: m.id,
        tipo: isSent ? 'enviado' : 'recibido',
        de: fromAddress || fromName || 'Ptalctes@eurorep.mx',
        para: toRecipients.join(', '),
        cc: ccRecipients.join(', '),
        bcc: bccRecipients.join(', '),
        cliente: clientName,
        asunto: m.subject || '(Sin Asunto)',
        cuerpo: m.bodyPreview || '',
        htmlBody: m.body?.contentType === 'html' ? m.body?.content : (m.body?.content || '').replace(/\n/g, '<br/>'),
        fecha: m.receivedDateTime || m.sentDateTime || new Date().toISOString(),
        evento: 'Microsoft Azure 365',
        regla: 'Bandeja Exchange',
        estatus: isSent ? 'Enviado' : 'Recibido',
        archivos: m.hasAttachments ? ['Adjuntos en Microsoft 365'] : [],
        isRead: m.isRead,
        origen: 'azure_ms_graph'
      };

      emailMap.set(m.id, mappedItem);
    });

    const emails = Array.from(emailMap.values());
    emails.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // 4. Guardar respaldo en Supabase si está disponible
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey && emails.length > 0) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Guardar los últimos 30 en Supabase para persistencia compartida
        const toSave = emails.slice(0, 30).map(e => ({
          id: e.id,
          tipo: e.tipo,
          de: e.de,
          para: e.para,
          cc: e.cc,
          bcc: e.bcc,
          cliente: e.cliente,
          asunto: e.asunto,
          cuerpo: (e.cuerpo || '').substring(0, 1500),
          htmlBody: e.htmlBody,
          fecha: e.fecha,
          evento: e.evento,
          regla: e.regla,
          estatus: e.estatus,
          archivos: e.archivos
        }));
        await supabase.from('sapi_email_logs').upsert(toSave, { onConflict: 'id' }).catch(() => {});
      } catch (dbErr) {
        console.warn('[Azure Sync] Error guardando en Supabase:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      count: emails.length,
      emails: emails
    });

  } catch (err) {
    console.error('[Fetch Azure Emails Error]:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Error al conectar con Microsoft Azure'
    });
  }
}
