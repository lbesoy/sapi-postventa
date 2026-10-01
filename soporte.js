// ==========================================
// MÓDULO CHAT DE SOPORTE Y BANDEJA DE CORREO
// Eurorep / SAPI
// ==========================================

// ===== CHAT DE SOPORTE GENERAL & BANDEJA DE CORREO (EMPRESA SIDE) =====
let activeChatTicketId = null;
let activeSoporteTab = 'chats'; // 'chats' | 'correos'
let activeEmailLogId = null;
let isComposingEmail = false;
let activeEmailFilter = 'todos'; // 'todos' | 'recibidos' | 'enviados'

function formatMontoConComas(val) {
  if (val === undefined || val === null || val === '') return '$0.00';
  let str = String(val).trim();
  if (str.startsWith('$')) str = str.substring(1).trim();
  str = str.replace(/,/g, '');
  const num = Number(str);
  if (isNaN(num)) return String(val);
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function switchSoporteTab(tab) {
  activeSoporteTab = tab;
  
  const btnChats = document.getElementById('btn-tab-soporte-chats');
  const btnCorreos = document.getElementById('btn-tab-soporte-correos');
  
  if (btnChats && btnCorreos) {
    if (tab === 'chats') {
      btnChats.style.background = 'var(--accent)';
      btnChats.style.color = 'white';
      btnCorreos.style.background = 'transparent';
      btnCorreos.style.color = 'var(--text-secondary)';
    } else {
      btnCorreos.style.background = 'var(--accent)';
      btnCorreos.style.color = 'white';
      btnChats.style.background = 'transparent';
      btnChats.style.color = 'var(--text-secondary)';
    }
  }
  
  window.renderChatSoporteEmpresa();
};

function setMailFilter(filter) {
  activeEmailFilter = filter;
  window.renderBandejaCorreoEmpresa();
};

function registrarLogEmail(logItem) {
  try {
    if (!logItem) return;
    if (!logItem.id) {
      logItem.id = 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    if (!logItem.fecha) {
      logItem.fecha = new Date().toISOString();
    }
    const logs = safeGetJSON('sapi_email_logs', []);
    const idx = logs.findIndex(l => l.id === logItem.id);
    if (idx > -1) {
      logs[idx] = logItem;
    } else {
      logs.unshift(logItem);
    }
    safeSetJSON('sapi_email_logs', logs);
  } catch (e) {
    console.error('Error guardando log de email:', e);
  }
};

function renderChatSoporteEmpresa() {
  const listContainer = document.getElementById('chat-client-list');
  if (!listContainer) return;

  if (activeSoporteTab === 'correos') {
    window.renderBandejaCorreoEmpresa();
    return;
  }

  const activeSandbox = isTestModeActive();
  const chatTickets = (typeof tickets !== 'undefined' ? tickets : []).filter(t => t.categoria === 'Soporte General' && isTestData(t) === activeSandbox);

  if (chatTickets.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.85rem; font-style:italic;">
        No hay chats de soporte activos.
      </div>
    `;
    document.getElementById('chat-active-pane').innerHTML = `
      <div style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--text-muted); gap:0.5rem;">
        <i data-lucide="message-square" style="width:48px; height:48px; opacity:0.5;"></i>
        <p style="font-size:0.9rem; font-weight:500; margin:0;">No hay chats de soporte disponibles</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Ordenar chats por la fecha del último mensaje
  chatTickets.sort((a, b) => {
    const lastA = a.comentariosClientes && a.comentariosClientes.length > 0 
      ? new Date(a.comentariosClientes[a.comentariosClientes.length - 1].fecha) 
      : new Date(a.fechaCreacion || 0);
    const lastB = b.comentariosClientes && b.comentariosClientes.length > 0 
      ? new Date(b.comentariosClientes[b.comentariosClientes.length - 1].fecha) 
      : new Date(b.fechaCreacion || 0);
    return lastB - lastA;
  });

  let listHtml = '';
  chatTickets.forEach(t => {
    const isSelected = t.id === activeChatTicketId;
    const lastMsg = t.comentariosClientes && t.comentariosClientes.length > 0
      ? t.comentariosClientes[t.comentariosClientes.length - 1]
      : null;
    
    const previewText = lastMsg ? lastMsg.texto : 'Canal abierto';
    const previewTime = lastMsg ? formatFechaHoraAmigable(lastMsg.fecha) : '';
    const authorName = lastMsg ? lastMsg.usuario : '';
    const displayAuthor = authorName ? `${authorName}: ` : '';

    const bgStyle = isSelected ? 'background:rgba(232, 130, 12, 0.12); border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;';
    
    listHtml += `
      <div onclick="window.seleccionarChatTicket('${t.id}')" style="padding:1rem; cursor:pointer; display:flex; flex-direction:column; gap:0.25rem; border-bottom:1px solid var(--border); transition:all 0.2s; ${bgStyle}">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${t.cliente || 'Cliente'}</span>
          <span style="font-size:0.65rem; color:var(--text-muted);">${previewTime}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:280px; text-align:left;">
          <span style="color:var(--text-muted);">${displayAuthor}</span>${previewText}
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = listHtml;

  // Si hay un chat activo, renderizar el panel derecho
  if (activeChatTicketId) {
    const activeTicket = chatTickets.find(t => t.id === activeChatTicketId);
    if (activeTicket) {
      window.renderChatActivePane(activeTicket);
    } else {
      activeChatTicketId = null;
    }
  }

  if (window.lucide) lucide.createIcons();
};

let mailSearchQuery = '';
function setMailSearch(query) {
  mailSearchQuery = (query || '').toLowerCase().trim();
  window.renderBandejaCorreoEmpresa();
};

function esCorreoValidoPtalctes(l) {
  if (!l || !l.id) return false;
  if (String(l.id).startsWith('email_tk_')) return false; // Descartar sintéticos
  
  if (l.esDeBuzonPtalctes) return true;

  const isTarget = (str) => {
    const s = String(str || '').toLowerCase().trim();
    if (!s) return false;
    return s.includes('ptalctes') || s.includes('portal tickets');
  };

  const de = String(l.de || '');
  const para = String(l.para || '');
  const cc = String(l.cc || '');
  const bcc = String(l.bcc || '');
  const cliente = String(l.cliente || '');
  const asunto = String(l.asunto || '');
  const cuerpo = String(l.cuerpo || '');

  return isTarget(de) || 
         isTarget(para) || 
         isTarget(cc) || 
         isTarget(bcc) || 
         isTarget(cliente) ||
         isTarget(asunto) ||
         cuerpo.toLowerCase().includes('ptalctes') ||
         (String(l.id).startsWith('email_') && !String(l.id).startsWith('ms_') && l.tipo === 'enviado');
};

function obtenerEmailLogsSoporte() {
  const localLogs = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_email_logs', []) : JSON.parse(localStorage.getItem('sapi_email_logs') || '[]');
  const logMap = new Map();
  const validLocalLogs = [];

  // Filtrar exclusivamente correos pertenecientes a ptalctes@eurorep.mx / Portal Tickets
  (localLogs || []).forEach(l => {
    if (window.esCorreoValidoPtalctes(l)) {
      logMap.set(l.id, l);
      validLocalLogs.push(l);
    }
  });

  // Purgar inmediatamente cualquier correo ajeno descargado previamente (ej. de luciano, axel, etc.)
  if (validLocalLogs.length !== (localLogs || []).length) {
    if (typeof safeSetJSON === 'function') {
      safeSetJSON('sapi_email_logs', validLocalLogs);
    } else {
      localStorage.setItem('sapi_email_logs', JSON.stringify(validLocalLogs));
    }
  }

  // Filtrar también cualquier registro en memoria
  if (Array.isArray(window._azureEmailLogs)) {
    window._azureEmailLogs = window._azureEmailLogs.filter(e => window.esCorreoValidoPtalctes(e));
    window._azureEmailLogs.forEach(l => {
      logMap.set(l.id, l);
    });
  }

  const merged = Array.from(logMap.values());
  merged.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return merged;
};

function iniciarSesionMicrosoftAzureMail() {
  // Limpiar tokens anteriores para forzar a Microsoft a solicitar consentimiento de los nuevos scopes compartidos
  sessionStorage.removeItem('ms_access_token');
  sessionStorage.removeItem('ms_access_token_expiry');

  const odClientId = (typeof configData !== 'undefined' && configData.onedriveClientId && configData.onedriveClientId !== 'MOCK') 
    ? configData.onedriveClientId 
    : '';

  let targetClientId = odClientId;
  if (!targetClientId) {
    const customId = prompt('Ingresa tu Client ID de Microsoft Azure (o configúralo en el menú de Configuración):', '');
    if (customId && customId.trim()) {
      targetClientId = customId.trim();
      if (typeof configData !== 'undefined') {
        configData.onedriveClientId = targetClientId;
        safeSetJSON('eurorep_config', configData);
      }
    } else {
      mostrarNotificacion('Se requiere un Client ID de Microsoft Azure para conectar la cuenta.', 'warning');
      return;
    }
  }

  const redirectUri = window.location.origin + window.location.pathname;
  const scopes = encodeURIComponent('Mail.Read Mail.Read.Shared Mail.ReadWrite Mail.ReadWrite.Shared Mail.Send Mail.Send.Shared Files.Read User.Read offline_access');
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(targetClientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&prompt=select_account&response_mode=fragment`;

  const width = 600;
  const height = 650;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  
  const loginPopup = window.open(authUrl, 'MicrosoftAzureMailLogin', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`);
  
  if (!loginPopup) {
    mostrarNotificacion('Por favor permite las ventanas emergentes para iniciar sesión con Microsoft Azure.', 'error');
    return;
  }

  mostrarNotificacion('Abriendo inicio de sesión seguro de Microsoft Azure (Ptalctes@eurorep.mx)...', 'info');

  const pollInterval = setInterval(() => {
    try {
      if (!loginPopup || loginPopup.closed) {
        clearInterval(pollInterval);
        return;
      }
      
      const popupUrl = loginPopup.location.href;
      if (popupUrl.indexOf(window.location.origin) === 0) {
        const hash = loginPopup.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const expiresIn = params.get('expires_in');
          
          if (accessToken) {
            sessionStorage.setItem('ms_access_token', accessToken);
            if (expiresIn) {
              sessionStorage.setItem('ms_access_token_expiry', Date.now() + Number(expiresIn) * 1000);
            } else {
              sessionStorage.setItem('ms_access_token_expiry', Date.now() + 3600 * 1000);
            }
            if (typeof onedriveRealToken !== 'undefined') {
              onedriveRealToken = accessToken;
            }
            
            clearInterval(pollInterval);
            loginPopup.close();
            
            mostrarNotificacion('¡Conexión exitosa con Microsoft Azure! Sincronizando correos de Ptalctes@eurorep.mx...', 'success');
            window.sincronizarCorreosAzure(false);
          }
        }
      }
    } catch (e) {
      // Ignorar Cross-Origin durante el proceso en microsoftonline.com
    }
  }, 500);
};

async function sincronizarCorreosAzure(silent = false) {
  const token = sessionStorage.getItem('ms_access_token');
  const expiry = sessionStorage.getItem('ms_access_token_expiry');
  const isTokenValid = token && (!expiry || Number(expiry) > Date.now());

  if (!silent) {
    mostrarNotificacion('Sincronizando correos de Ptalctes@eurorep.mx desde Microsoft Azure...', 'info');
  }

  window._isSyncingAzureMail = true;
  if (typeof window.renderBandejaCorreoEmpresa === 'function') {
    window.renderBandejaCorreoEmpresa();
  }

  try {
    let rawEmails = [];

    // 1. Consultar endpoint serverless
    try {
      const resp = await fetch('/api/fetch-azure-emails', {
        headers: {
          'X-Ms-Graph-Token': isTokenValid ? token : '',
          'X-Sapi-Client-Token': 'SapiSecuredClientToken'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.emails) && data.emails.length > 0) {
          rawEmails = data.emails.filter(e => window.esCorreoValidoPtalctes(e));
        }
      }
    } catch (srvErr) {
      console.warn('[Azure] Endpoint serverless no disponible:', srvErr);
    }

    // 2. Si hay token en cliente y el backend no trajo datos, consultar directamente a Microsoft Graph API
    if (rawEmails.length === 0 && isTokenValid) {
      const selectFields = 'id,subject,bodyPreview,body,from,sender,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead';
      const expandQuery = '&$expand=attachments($select=id,name,contentType,size,isInline)';
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Prefer': 'outlook.body-content-type="html"'
      };

      // Detectar si la sesión actual pertenece directamente a Ptalctes@eurorep.mx
      let isDirectPtalctesAccount = false;
      try {
        const meProfileRes = await fetch('https://graph.microsoft.com/v1.0/me', { headers });
        if (meProfileRes.ok) {
          const meProfile = await meProfileRes.json();
          const meMail = (meProfile.mail || meProfile.userPrincipalName || '').toLowerCase();
          const meName = (meProfile.displayName || '').toLowerCase();
          if (meMail.includes('ptalctes') || meName.includes('portal tickets')) {
            isDirectPtalctesAccount = true;
          }
        }
      } catch (e) {}

      const fetchGraphFolder = async (base, folder) => {
        try {
          const res = await fetch(`${base}/mailFolders/${folder}/messages?$top=50&$select=${selectFields}${expandQuery}&$orderby=${folder === 'inbox' ? 'receivedDateTime' : 'sentDateTime'} desc`, { headers });
          if (res.ok) {
            const j = await res.json();
            const isDirect = isDirectPtalctesAccount || base.toLowerCase().includes('ptalctes');
            return Array.isArray(j.value) ? j.value.map(m => ({ ...m, _folder: folder, _isDirectPtalctes: isDirect })) : [];
          } else {
            console.warn(`[Azure Graph] ${base}/${folder} status:`, res.status);
          }
        } catch (e) {
          console.warn(`[Azure Graph] Error fetching ${base}/${folder}:`, e);
        }
        return null;
      };

      // Intentar primero con el buzón directo de ptalctes@eurorep.mx (Buzón compartido / secundario)
      let [inboxMsgs, sentMsgs] = await Promise.all([
        fetchGraphFolder('https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx', 'inbox'),
        fetchGraphFolder('https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx', 'sentitems')
      ]);

      // Si no devolvió datos por permisos delegados, consultar /me
      if (!Array.isArray(inboxMsgs) || !Array.isArray(sentMsgs) || (inboxMsgs.length === 0 && sentMsgs.length === 0)) {
        const [meInbox, meSent] = await Promise.all([
          fetchGraphFolder('https://graph.microsoft.com/v1.0/me', 'inbox'),
          fetchGraphFolder('https://graph.microsoft.com/v1.0/me', 'sentitems')
        ]);
        if (Array.isArray(meInbox) && meInbox.length > 0) inboxMsgs = meInbox;
        if (Array.isArray(meSent) && meSent.length > 0) sentMsgs = meSent;
      }

      let msgs = [];
      if (Array.isArray(inboxMsgs)) msgs = msgs.concat(inboxMsgs);
      if (Array.isArray(sentMsgs)) msgs = msgs.concat(sentMsgs);

      if (msgs.length === 0) {
        const allRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=${selectFields}${expandQuery}&$orderby=receivedDateTime desc`, { headers }).catch(() => null);
        if (allRes && allRes.ok) {
          const j = await allRes.json();
          const isDirect = isDirectPtalctesAccount;
          if (Array.isArray(j.value)) msgs = msgs.concat(j.value.map(m => ({ ...m, _isDirectPtalctes: isDirect })));
        }
      }

      // Filtro estricto: Únicamente correos pertenecientes a ptalctes@eurorep.mx / Portal Tickets
      const isTarget = (str) => {
        const s = String(str || '').toLowerCase().trim();
        if (!s) return false;
        return s.includes('ptalctes') || s.includes('portal tickets');
      };

      msgs = msgs.filter(m => {
        if (!m) return false;
        if (m._isDirectPtalctes) return true; // Viene del buzón directo de ptalctes@eurorep.mx
        const fromAddr = (m.from?.emailAddress?.address || m.sender?.emailAddress?.address || '').toLowerCase();
        const fromName = (m.from?.emailAddress?.name || m.sender?.emailAddress?.name || '').toLowerCase();
        const toAddrs = Array.isArray(m.toRecipients) ? m.toRecipients.map(r => (r.emailAddress?.address || r.emailAddress?.name || '').toLowerCase()) : [];
        const ccAddrs = Array.isArray(m.ccRecipients) ? m.ccRecipients.map(r => (r.emailAddress?.address || r.emailAddress?.name || '').toLowerCase()) : [];
        const bccAddrs = Array.isArray(m.bccRecipients) ? m.bccRecipients.map(r => (r.emailAddress?.address || r.emailAddress?.name || '').toLowerCase()) : [];
        const subject = (m.subject || '').toLowerCase();
        const preview = (m.bodyPreview || '').toLowerCase();

        return isTarget(fromAddr) || 
               isTarget(fromName) ||
               toAddrs.some(isTarget) || 
               ccAddrs.some(isTarget) || 
               bccAddrs.some(isTarget) ||
               isTarget(subject) ||
               preview.includes('ptalctes');
      });

      rawEmails = msgs.map(m => {
        const fromAddr = m.from?.emailAddress?.address || m.sender?.emailAddress?.address || '';
        const fromName = m.from?.emailAddress?.name || m.sender?.emailAddress?.name || fromAddr;
        const toRecipients = Array.isArray(m.toRecipients) ? m.toRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];
        const ccRecipients = Array.isArray(m.ccRecipients) ? m.ccRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];
        const bccRecipients = Array.isArray(m.bccRecipients) ? m.bccRecipients.map(r => r.emailAddress?.address || r.emailAddress?.name).filter(Boolean) : [];

        let isSent = false;
        if (m._folder === 'sentitems') {
          isSent = true;
        } else if (m._folder === 'inbox') {
          isSent = false;
        } else {
          const fromAddrLower = (fromAddr || '').toLowerCase();
          const fromNameLower = (fromName || '').toLowerCase();
          const isFromTarget = fromAddrLower.includes('ptalctes') || fromNameLower.includes('portal tickets');
          const toAddrsLower = toRecipients.join(' ').toLowerCase();
          const isToTarget = toAddrsLower.includes('ptalctes') || toAddrsLower.includes('portal tickets');
          isSent = (isFromTarget && !isToTarget);
        }

        const clientName = isSent ? (m.toRecipients?.[0]?.emailAddress?.name || toRecipients.join(', ') || 'Cliente') : fromName;

        const rawAtts = Array.isArray(m.attachments) ? m.attachments : [];
        const archivosDetalle = rawAtts.map(att => ({
          id: att.id,
          name: att.name || 'archivo_adjunto',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          isInline: !!att.isInline,
          msId: m.id
        }));

        const archivos = archivosDetalle.length > 0
          ? archivosDetalle.map(a => a.name)
          : (m.hasAttachments ? ['Adjuntos en Microsoft 365'] : []);

        return {
          id: `ms_${m.id}`,
          msId: m.id,
          tipo: isSent ? 'enviado' : 'recibido',
          de: fromAddr || fromName || 'Ptalctes@eurorep.mx',
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
          archivos: archivos,
          archivosDetalle: archivosDetalle,
          isRead: m.isRead,
          origen: 'azure_ms_graph',
          esDeBuzonPtalctes: !!m._isDirectPtalctes
        };
      });

      rawEmails = rawEmails.filter(e => window.esCorreoValidoPtalctes(e));
    }

    if (rawEmails.length > 0) {
      window._azureEmailLogs = rawEmails;
      const currentLogs = safeGetJSON('sapi_email_logs', []);
      const map = new Map();
      rawEmails.forEach(e => {
        if (window.esCorreoValidoPtalctes(e)) {
          map.set(e.id, e);
        }
      });
      currentLogs.forEach(e => {
        if (!map.has(e.id) && window.esCorreoValidoPtalctes(e)) {
          map.set(e.id, e);
        }
      });
      const merged = Array.from(map.values());
      merged.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      safeSetJSON('sapi_email_logs', merged);

      if (!silent) {
        mostrarNotificacion(`✅ Sincronizados ${rawEmails.length} correos de Ptalctes@eurorep.mx desde Microsoft Azure`, 'success');
      }
    } else {
      // Si no se encontraron correos de ptalctes en este lote, purgar la memoria y storage local de cualquier correo ajeno
      const currentLogs = safeGetJSON('sapi_email_logs', []);
      const cleanLogs = currentLogs.filter(e => window.esCorreoValidoPtalctes(e));
      safeSetJSON('sapi_email_logs', cleanLogs);
      window._azureEmailLogs = [];
      if (!silent && isTokenValid) {
        mostrarNotificacion('No se encontraron correos nuevos para Ptalctes@eurorep.mx en Microsoft Azure.', 'info');
      } else if (!silent && !isTokenValid) {
        mostrarNotificacion('Conecta tu cuenta de Microsoft Azure para descargar los correos de Ptalctes@eurorep.mx.', 'warning');
        window.iniciarSesionMicrosoftAzureMail();
      }
    }
  } catch (err) {
    console.error('Error sincronizando correos con Azure:', err);
    if (!silent) {
      mostrarNotificacion('Error al conectar con Microsoft Azure: ' + (err.message || err), 'error');
    }
  } finally {
    window._isSyncingAzureMail = false;
    if (typeof window.renderBandejaCorreoEmpresa === 'function') {
      window.renderBandejaCorreoEmpresa();
    }
  }
};

function renderBandejaCorreoEmpresa() {
  const listContainer = document.getElementById('chat-client-list');
  const paneContainer = document.getElementById('chat-active-pane');
  if (!listContainer || !paneContainer) return;

  const msToken = sessionStorage.getItem('ms_access_token');
  const msExpiry = sessionStorage.getItem('ms_access_token_expiry');
  const isMsConnected = !!(msToken && (!msExpiry || Number(msExpiry) > Date.now()));

  // Auto-sincronizar en segundo plano si hay sesión activa de Microsoft y no se ha sincronizado en esta vista
  if (isMsConnected && !window._hasAutoSyncedAzure && !window._isSyncingAzureMail) {
    window._hasAutoSyncedAzure = true;
    setTimeout(() => { window.sincronizarCorreosAzure(true); }, 300);
  }

  const logs = window.obtenerEmailLogsSoporte();

  // Filtrado por pestaña Todos | Recibidos | Enviados
  let filteredLogs = logs;
  if (activeEmailFilter === 'recibidos') {
    filteredLogs = logs.filter(l => l.tipo === 'recibido' || l.estatus === 'Recibido');
  } else if (activeEmailFilter === 'enviados') {
    filteredLogs = logs.filter(l => l.tipo !== 'recibido' && l.estatus !== 'Recibido');
  }

  // Filtrado por búsqueda de texto
  if (mailSearchQuery) {
    filteredLogs = filteredLogs.filter(l => {
      const asunto = (l.asunto || '').toLowerCase();
      const de = (l.de || '').toLowerCase();
      const para = (l.para || '').toLowerCase();
      const cliente = (l.cliente || '').toLowerCase();
      const cuerpo = (l.cuerpo || '').toLowerCase();
      const folio = (l.folio_ticket || l.folio_os || '').toLowerCase();
      return asunto.includes(mailSearchQuery) ||
             de.includes(mailSearchQuery) ||
             para.includes(mailSearchQuery) ||
             cliente.includes(mailSearchQuery) ||
             cuerpo.includes(mailSearchQuery) ||
             folio.includes(mailSearchQuery);
    });
  }

  const azureStatusHtml = isMsConnected
    ? `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,120,212,0.08); border:1px solid rgba(0,120,212,0.25); border-radius:6px; padding:0.25rem 0.5rem; font-size:0.72rem;">
        <span style="display:inline-flex; align-items:center; gap:0.35rem; color:#0078d4; font-weight:600;">
          <svg viewBox="0 0 23 23" style="width:12px; height:12px;"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
          Azure Conectado (Ptalctes@eurorep.mx)
        </span>
        <div style="display:inline-flex; align-items:center; gap:0.45rem;">
          <button type="button" onclick="window.sincronizarCorreosAzure(false)" style="border:none; background:transparent; color:#0078d4; cursor:pointer; font-weight:700; font-size:0.72rem; display:inline-flex; align-items:center; gap:0.2rem;" title="Sincronizar ahora con Microsoft Azure">
            <i data-lucide="${window._isSyncingAzureMail ? 'loader-2' : 'refresh-cw'}" class="${window._isSyncingAzureMail ? 'spin' : ''}" style="width:12px; height:12px;"></i> Sincronizar
          </button>
          <button type="button" onclick="window.iniciarSesionMicrosoftAzureMail()" style="border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.68rem; text-decoration:underline;" title="Reconectar y actualizar permisos de Microsoft Azure">
            Reconectar
          </button>
        </div>
      </div>
    `
    : `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,120,212,0.06); border:1px solid rgba(0,120,212,0.2); border-radius:6px; padding:0.3rem 0.5rem; font-size:0.72rem;">
        <span style="display:inline-flex; align-items:center; gap:0.35rem; color:var(--text-secondary); font-weight:600;">
          <svg viewBox="0 0 23 23" style="width:12px; height:12px;"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
          Microsoft Azure (Ptalctes)
        </span>
        <button type="button" onclick="window.iniciarSesionMicrosoftAzureMail()" class="btn-primary" style="padding:0.2rem 0.55rem; font-size:0.7rem; border-radius:4px; display:inline-flex; align-items:center; gap:0.25rem; background:#0078d4; color:white; border:none; cursor:pointer; font-weight:600;">
          <i data-lucide="log-in" style="width:11px; height:11px;"></i> Conectar
        </button>
      </div>
    `;
  
  let headerHtml = `
    <div style="padding:0.6rem 0.8rem; border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; flex-direction:column; gap:0.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase;">Historial de Correos (${filteredLogs.length})</span>
        <button class="btn-primary" onclick="window.redactarNuevoCorreoSoporte()" style="padding:0.25rem 0.55rem; font-size:0.75rem; border-radius:6px; display:inline-flex; align-items:center; gap:0.3rem; cursor:pointer;">
          <i data-lucide="plus" style="width:12px; height:12px;"></i> Redactar
        </button>
      </div>

      <!-- Barra de Estado Microsoft Azure -->
      ${azureStatusHtml}

      <!-- Buscador de Correos -->
      <div style="position:relative; display:flex; align-items:center;">
        <i data-lucide="search" style="position:absolute; left:0.5rem; width:13px; height:13px; color:var(--text-muted); pointer-events:none;"></i>
        <input type="text" value="${mailSearchQuery}" oninput="window.setMailSearch(this.value)" placeholder="Buscar por asunto, cliente, email o folio..." style="width:100%; padding:0.3rem 0.5rem 0.3rem 1.8rem; font-size:0.75rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); outline:none;" />
        ${mailSearchQuery ? `<button onclick="window.setMailSearch('')" style="position:absolute; right:0.4rem; border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">✕</button>` : ''}
      </div>

      <!-- Pestañas Filtros -->
      <div style="display:flex; gap:0.25rem; background:var(--bg-primary); padding:0.2rem; border-radius:6px; border:1px solid var(--border);">
        <button onclick="window.setMailFilter('todos')" style="flex:1; padding:0.25rem 0.3rem; font-size:0.7rem; font-weight:600; border-radius:4px; border:none; cursor:pointer; ${activeEmailFilter === 'todos' ? 'background:var(--accent); color:white;' : 'background:transparent; color:var(--text-secondary);'}">Todos</button>
        <button onclick="window.setMailFilter('recibidos')" style="flex:1; padding:0.25rem 0.3rem; font-size:0.7rem; font-weight:600; border-radius:4px; border:none; cursor:pointer; ${activeEmailFilter === 'recibidos' ? 'background:var(--accent); color:white;' : 'background:transparent; color:var(--text-secondary);'}">Recibidos</button>
        <button onclick="window.setMailFilter('enviados')" style="flex:1; padding:0.25rem 0.3rem; font-size:0.7rem; font-weight:600; border-radius:4px; border:none; cursor:pointer; ${activeEmailFilter === 'enviados' ? 'background:var(--accent); color:white;' : 'background:transparent; color:var(--text-secondary);'}">Enviados</button>
      </div>
    </div>
  `;

  if (filteredLogs.length === 0) {
    if (!isMsConnected) {
      listContainer.innerHTML = headerHtml + `
        <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
          <svg viewBox="0 0 23 23" style="width:38px; height:38px;"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
          <p style="font-size:0.85rem; margin:0; max-width:240px; color:var(--text-secondary); line-height:1.4;">Conecta la cuenta de <strong>Microsoft Azure (Ptalctes@eurorep.mx)</strong> para cargar los correos reales.</p>
          <button class="btn-primary" onclick="window.iniciarSesionMicrosoftAzureMail()" style="background:#0078d4; border:none; padding:0.4rem 0.9rem; font-size:0.78rem; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer; color:white;">
            <i data-lucide="cloud" style="width:13px; height:13px;"></i> Conectar Microsoft Azure
          </button>
        </div>
      `;
    } else {
      listContainer.innerHTML = headerHtml + `
        <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.85rem; font-style:italic;">
          ${mailSearchQuery ? 'No se encontraron correos que coincidan con la búsqueda.' : activeEmailFilter === 'recibidos' ? 'No hay correos recibidos en la cuenta de Microsoft.' : activeEmailFilter === 'enviados' ? 'No hay correos enviados registrados.' : 'No hay correos registrados en la bandeja.'}
        </div>
      `;
    }
  } else {
    let itemsHtml = '';
    filteredLogs.forEach(log => {
      const isSelected = !isComposingEmail && log.id === activeEmailLogId;
      const bgStyle = isSelected ? 'background:rgba(232, 130, 12, 0.12); border-left:3px solid var(--accent);' : 'border-left:3px solid transparent;';
      const timeStr = formatFechaHoraAmigable(log.fecha);
      const isRecibido = log.tipo === 'recibido' || log.estatus === 'Recibido';
      const isSuccess = log.estatus !== 'Fallido';

      const statusBadge = isRecibido
        ? `<span style="padding:0.1rem 0.35rem; border-radius:4px; font-weight:600; font-size:0.65rem; background:rgba(59,130,246,0.15); color:#2563eb;">Recibido</span>`
        : `<span style="padding:0.1rem 0.35rem; border-radius:4px; font-weight:600; font-size:0.65rem; ${isSuccess ? 'background:rgba(34,197,94,0.15); color:#16a34a;' : 'background:rgba(239,68,68,0.15); color:#ef4444;'}">${isSuccess ? 'Enviado' : 'Fallido'}</span>`;

      const mainContact = isRecibido ? (log.de || log.cliente) : (log.para || log.cliente);
      const folioBadge = log.folio_ticket ? `<span style="background:rgba(232,130,12,0.12); color:var(--accent); padding:0.05rem 0.3rem; border-radius:3px; font-size:0.65rem; font-weight:700;">${log.folio_ticket}</span>` : (log.folio_os ? `<span style="background:rgba(16,185,129,0.12); color:#10b981; padding:0.05rem 0.3rem; border-radius:3px; font-size:0.65rem; font-weight:700;">${log.folio_os}</span>` : '');

      const hasAttachments = (Array.isArray(log.archivos) && log.archivos.length > 0) || (Array.isArray(log.archivosDetalle) && log.archivosDetalle.length > 0) || log.hasAttachments;
      const attIcon = hasAttachments ? `<i data-lucide="paperclip" style="width:11px; height:11px; color:var(--text-muted); margin-left:0.25rem;" title="Tiene archivos adjuntos"></i>` : '';

      itemsHtml += `
        <div onclick="window.seleccionarEmailLog('${log.id}')" style="padding:0.85rem 1rem; cursor:pointer; display:flex; flex-direction:column; gap:0.25rem; border-bottom:1px solid var(--border); transition:all 0.2s; ${bgStyle}">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; align-items:center; max-width:180px; overflow:hidden;">
              <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${mainContact}</span>
              ${attIcon}
            </div>
            <span style="font-size:0.65rem; color:var(--text-muted); font-family:monospace;">${timeStr}</span>
          </div>
          <div style="font-size:0.8rem; font-weight:600; color:var(--accent); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:270px; text-align:left;">
            ${log.asunto || 'Sin asunto'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; color:var(--text-muted);">
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <span>${log.regla || log.evento || 'Microsoft Azure'}</span>
              ${folioBadge}
            </div>
            ${statusBadge}
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = headerHtml + `<div style="flex:1; overflow-y:auto;">${itemsHtml}</div>`;
  }

  // Render Right Pane
  if (isComposingEmail) {
    if (!document.getElementById('form-componer-correo-soporte')) {
      window.renderCorreoComposerPane();
    }
  } else if (activeEmailLogId) {
    const activeLog = logs.find(l => l.id === activeEmailLogId);
    if (activeLog) {
      window.renderCorreoDetailPane(activeLog);
    } else {
      activeEmailLogId = null;
      window.renderCorreoEmptyPane();
    }
  } else {
    window.renderCorreoEmptyPane();
  }

  if (window.lucide) lucide.createIcons();
};

function renderCorreoDetailPane(log) {
  const pane = document.getElementById('chat-active-pane');
  if (!pane || !log) return;

  const isRecibido = log.tipo === 'recibido' || log.estatus === 'Recibido';
  const isSuccess = log.estatus !== 'Fallido';
  const timeFormatted = formatFechaHoraAmigable(log.fecha);
  const fullDate = log.fecha ? new Date(log.fecha).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium' }) : '';
  
  const senderDisplay = log.de || 'Ptalctes@eurorep.mx';
  const recipientDisplay = log.para || log.cliente || '-';
  const clientName = log.cliente || (isRecibido ? senderDisplay : recipientDisplay);
  
  // Iniciales del contacto
  const contactNameForInitials = isRecibido ? (log.cliente || log.de || 'C') : (log.cliente || log.para || 'S');
  const initials = contactNameForInitials.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ER';

  const statusBadge = isRecibido
    ? `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.25rem 0.6rem; border-radius:12px; font-weight:700; font-size:0.75rem; background:rgba(59,130,246,0.12); color:#2563eb; border:1px solid rgba(59,130,246,0.25);"><i data-lucide="inbox" style="width:12px; height:12px;"></i> Recibido</span>`
    : `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.25rem 0.6rem; border-radius:12px; font-weight:700; font-size:0.75rem; ${isSuccess ? 'background:rgba(34,197,94,0.12); color:#16a34a; border:1px solid rgba(34,197,94,0.25);' : 'background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25);'}"><i data-lucide="${isSuccess ? 'send' : 'alert-triangle'}" style="width:12px; height:12px;"></i> ${isSuccess ? 'Enviado' : 'Fallido'}</span>`;

  let linkedBadgesHtml = '';
  if (log.folio_ticket) {
    linkedBadgesHtml += `
      <button type="button" onclick="window.abrirTicketDesdeCorreo('${log.folio_ticket}')" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:6px; background:rgba(232, 130, 12, 0.12); border:1px solid rgba(232, 130, 12, 0.3); color:var(--accent); font-size:0.75rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
        <i data-lucide="tag" style="width:12px; height:12px;"></i> Ticket ${log.folio_ticket}
      </button>
    `;
  }
  if (log.folio_os) {
    linkedBadgesHtml += `
      <button type="button" onclick="window.abrirOrdenDesdeCorreo('${log.folio_os}')" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:6px; background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); color:#10b981; font-size:0.75rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
        <i data-lucide="file-check" style="width:12px; height:12px;"></i> OS ${log.folio_os}
      </button>
    `;
  }

  // Attachments
  let attachmentsHtml = '';
  const attachmentsList = Array.isArray(log.archivosDetalle) && log.archivosDetalle.length > 0
    ? log.archivosDetalle
    : (Array.isArray(log.archivos) ? log.archivos.map(a => typeof a === 'string' ? { name: a } : a) : []);

  if (attachmentsList.length > 0) {
    const formatSize = (bytes) => {
      if (!bytes || bytes <= 0) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileMeta = (fileName, contentType) => {
      const fn = String(fileName || '').toLowerCase();
      const ct = String(contentType || '').toLowerCase();
      if (fn.endsWith('.pdf') || ct.includes('pdf')) {
        return { icon: 'file-text', color: '#ef4444', label: 'PDF' };
      }
      if (fn.endsWith('.xlsx') || fn.endsWith('.xls') || fn.endsWith('.csv') || ct.includes('spreadsheet') || ct.includes('excel')) {
        return { icon: 'file-spreadsheet', color: '#10b981', label: 'Excel' };
      }
      if (fn.endsWith('.docx') || fn.endsWith('.doc') || ct.includes('word') || ct.includes('officedocument')) {
        return { icon: 'file-text', color: '#2563eb', label: 'Word' };
      }
      if (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.webp') || fn.endsWith('.gif') || ct.includes('image')) {
        return { icon: 'image', color: '#8b5cf6', label: 'Imagen' };
      }
      if (fn.endsWith('.zip') || fn.endsWith('.rar') || fn.endsWith('.7z') || fn.endsWith('.tar') || fn.endsWith('.gz') || ct.includes('zip') || ct.includes('compressed')) {
        return { icon: 'archive', color: '#f59e0b', label: 'Archivo ZIP' };
      }
      return { icon: 'paperclip', color: 'var(--accent)', label: 'Adjunto' };
    };

    attachmentsHtml = `
      <div style="padding:0.75rem 1.25rem; background:var(--bg-hover); border-top:1px solid var(--border); border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:0.5rem;">
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="paperclip" style="width:13px; height:13px; color:var(--accent);"></i> Archivos Adjuntos (${attachmentsList.length})
        </span>
        <div style="display:flex; flex-wrap:wrap; gap:0.6rem;">
          ${attachmentsList.map((att) => {
            const name = att.name || 'Archivo Adjunto';
            const attId = att.id || '';
            const sizeStr = formatSize(att.size);
            const meta = getFileMeta(name, att.contentType);
            const safeMsId = (log.msId || log.id || '').replace(/^ms_/, '');
            const safeName = encodeURIComponent(name);
            const safeAttId = encodeURIComponent(attId);
            const safeContentType = encodeURIComponent(att.contentType || '');

            return `
              <div style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.4rem 0.65rem; border-radius:8px; background:var(--bg-card); border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="width:28px; height:28px; border-radius:6px; background:var(--bg-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;" onclick="window.previsualizarAdjuntoMicrosoftGraph('${safeMsId}', '${safeAttId}', '${safeName}', '${safeContentType}')" title="Ver ${name}">
                  <i data-lucide="${meta.icon}" style="width:15px; height:15px; color:${meta.color};"></i>
                </div>
                <div style="display:flex; flex-direction:column; max-width:180px; overflow:hidden; cursor:pointer;" onclick="window.previsualizarAdjuntoMicrosoftGraph('${safeMsId}', '${safeAttId}', '${safeName}', '${safeContentType}')" title="Clic para ver ${name}">
                  <span style="font-size:0.78rem; font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${name}</span>
                  ${sizeStr ? `<span style="font-size:0.68rem; color:var(--text-muted);">${sizeStr}</span>` : `<span style="font-size:0.68rem; color:var(--text-muted);">${meta.label}</span>`}
                </div>
                <div style="display:inline-flex; align-items:center; gap:0.25rem; margin-left:0.3rem;">
                  <button type="button" onclick="window.previsualizarAdjuntoMicrosoftGraph('${safeMsId}', '${safeAttId}', '${safeName}', '${safeContentType}')" style="padding:0.25rem 0.55rem; border-radius:6px; background:var(--accent); border:none; color:white; font-size:0.72rem; font-weight:700; display:inline-flex; align-items:center; gap:0.25rem; cursor:pointer; transition:all 0.2s;" title="Ver archivo sin descargar">
                    <i data-lucide="eye" style="width:12px; height:12px;"></i> Ver
                  </button>
                  <button type="button" onclick="window.descargarAdjuntoMicrosoftGraph('${safeMsId}', '${safeAttId}', '${safeName}', '${safeContentType}')" style="padding:0.25rem 0.45rem; border-radius:6px; background:var(--bg-hover); border:1px solid var(--border); color:var(--text-secondary); font-size:0.72rem; font-weight:600; display:inline-flex; align-items:center; cursor:pointer; transition:all 0.2s;" title="Descargar copia">
                    <i data-lucide="download" style="width:12px; height:12px;"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Body rendering
  let contentHtml = '';
  if (log.htmlBody) {
    contentHtml = log.htmlBody;
  } else if (log.cuerpo) {
    contentHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:0.92rem; color:var(--text-primary); line-height:1.65; white-space:pre-wrap;">${log.cuerpo}</div>`;
  } else {
    contentHtml = `<em style="color:var(--text-muted); font-size:0.85rem;">(Mensaje sin contenido de texto)</em>`;
  }

  pane.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-primary); overflow:hidden;">
      <!-- Top Actions Bar -->
      <div style="padding:0.75rem 1.25rem; border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button type="button" class="btn-primary" onclick="window.responderCorreoSoporte('${log.id}')" style="padding:0.4rem 0.9rem; font-size:0.8rem; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <i data-lucide="reply" style="width:14px; height:14px;"></i> Responder
          </button>
          <button type="button" class="btn-secondary" onclick="window.reenviarCorreoSoporte('${log.id}')" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:600; border-radius:6px; display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);">
            <i data-lucide="forward" style="width:14px; height:14px;"></i> Reenviar
          </button>
          <button type="button" class="btn-secondary" onclick="window.copiarCuerpoCorreo('${log.id}')" style="padding:0.4rem 0.75rem; font-size:0.8rem; font-weight:600; border-radius:6px; display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);">
            <i data-lucide="copy" style="width:14px; height:14px;"></i> Copiar
          </button>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${linkedBadgesHtml}
          ${statusBadge}
        </div>
      </div>

      <!-- Email Details Header -->
      <div style="padding:1.25rem 1.5rem; background:var(--bg-card); border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
          <h2 style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin:0; line-height:1.35; flex:1;">
            ${log.asunto || 'Sin Asunto'}
          </h2>
          <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; white-space:nowrap;" title="${fullDate}">
            ${timeFormatted}
          </span>
        </div>

        <div style="display:flex; align-items:flex-start; gap:0.75rem; margin-top:0.25rem;">
          <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, var(--accent) 0%, #d97706 100%); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15);">
            ${initials}
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:0.2rem; font-size:0.82rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
              <div>
                <strong style="color:var(--text-primary); font-size:0.9rem;">${clientName}</strong>
                <span style="color:var(--text-secondary); margin-left:0.35rem;">&lt;${senderDisplay}&gt;</span>
              </div>
              <span style="font-size:0.72rem; color:var(--text-muted); background:var(--bg-hover); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid var(--border);">
                ${log.regla || log.evento || 'Soporte'}
              </span>
            </div>
            <div style="color:var(--text-secondary);">
              <span style="font-weight:600; color:var(--text-muted);">Para:</span> ${recipientDisplay}
              ${log.cc ? `<span style="margin-left:0.75rem;"><span style="font-weight:600; color:var(--text-muted);">CC:</span> ${log.cc}</span>` : ''}
              ${log.bcc ? `<span style="margin-left:0.75rem;"><span style="font-weight:600; color:var(--text-muted);">CCO:</span> ${log.bcc}</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Attachments Strip if any -->
      ${attachmentsHtml}

      <!-- Email Body Scroll Area -->
      <div style="flex:1; overflow-y:auto; padding:1.5rem; background:var(--bg-primary);">
        <div style="max-width:900px; margin:0 auto; background:var(--bg-card); padding:1.5rem 2rem; border-radius:10px; border:1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,0.04); word-break:break-word;">
          ${contentHtml}
        </div>
      </div>

      <!-- Quick Reply Footer Box -->
      <div style="padding:0.75rem 1.25rem; background:var(--bg-card); border-top:1px solid var(--border); display:flex; flex-direction:column; gap:0.5rem;">
        <form onsubmit="window.enviarRespuestaRapidaCorreo(event, '${log.id}')" style="display:flex; gap:0.5rem; align-items:flex-end;">
          <textarea id="mail-quick-reply-text" placeholder="Escribe una respuesta rápida a este correo..." rows="2" style="flex:1; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem; font-family:inherit; resize:none; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="submit" id="btn-mail-quick-reply-send" class="btn-primary" style="padding:0.55rem 1.1rem; height:42px; border-radius:8px; font-size:0.82rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <i data-lucide="send" style="width:14px; height:14px;"></i> Enviar
          </button>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
};

function responderCorreoSoporte(logId) {
  const logs = window.obtenerEmailLogsSoporte();
  const log = logs.find(l => l.id === logId);
  if (!log) return;

  const isRecibido = log.tipo === 'recibido' || log.estatus === 'Recibido';
  const targetEmail = isRecibido ? (log.de || '') : (log.para || '');
  const subject = log.asunto ? (log.asunto.startsWith('Re:') ? log.asunto : `Re: ${log.asunto}`) : 'Re: Seguimiento';

  window.redactarNuevoCorreoSoporte(targetEmail, log.cliente || '', subject);

  setTimeout(() => {
    const bodyElem = document.getElementById('mail-composer-body');
    if (bodyElem) {
      const quoteHeader = `<br/><br/><blockquote><hr style="border:none; border-top:1px solid #cbd5e1; margin:14px 0;"/><strong style="color:#64748b; font-size:12px;">El ${new Date(log.fecha).toLocaleString('es-MX')}, ${log.de || log.cliente || 'Remitente'} escribió:</strong><br/>${log.htmlBody || (log.cuerpo || '').replace(/\n/g, '<br/>')}</blockquote>`;
      if (bodyElem.isContentEditable) {
        bodyElem.innerHTML = quoteHeader;
      } else {
        bodyElem.value = quoteHeader;
      }
      bodyElem.focus();
    }
  }, 100);
};

function reenviarCorreoSoporte(logId) {
  const logs = window.obtenerEmailLogsSoporte();
  const log = logs.find(l => l.id === logId);
  if (!log) return;

  const subject = log.asunto ? (log.asunto.startsWith('Fwd:') ? log.asunto : `Fwd: ${log.asunto}`) : 'Fwd: Correo reenviado';
  window.redactarNuevoCorreoSoporte('', log.cliente || '', subject);

  setTimeout(() => {
    const bodyElem = document.getElementById('mail-composer-body');
    if (bodyElem) {
      const forwardHeader = `<br/><br/>---------- Mensaje reenviado ----------<br/><b>De:</b> ${log.de || '-'}<br/><b>Fecha:</b> ${new Date(log.fecha).toLocaleString('es-MX')}<br/><b>Asunto:</b> ${log.asunto || '-'}<br/><b>Para:</b> ${log.para || '-'}<br/><br/>${log.htmlBody || (log.cuerpo || '').replace(/\n/g, '<br/>')}`;
      if (bodyElem.isContentEditable) {
        bodyElem.innerHTML = forwardHeader;
      } else {
        bodyElem.value = forwardHeader;
      }
      bodyElem.focus();
    }
  }, 100);
};

function copiarCuerpoCorreo(logId) {
  const logs = window.obtenerEmailLogsSoporte();
  const log = logs.find(l => l.id === logId);
  if (!log) return;

  const textToCopy = log.cuerpo || (log.htmlBody ? log.htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
  navigator.clipboard.writeText(textToCopy).then(() => {
    mostrarNotificacion('Contenido del correo copiado al portapapeles.', 'success');
  }).catch(() => {
    mostrarNotificacion('No se pudo copiar el texto.', 'warning');
  });
};

function abrirTicketDesdeCorreo(folio) {
  if (!folio) return;
  const t = (typeof tickets !== 'undefined' ? tickets : []).find(tk => tk.folio === folio || tk.id === folio);
  if (t) {
    if (typeof abrirTicket === 'function') {
      abrirTicket(t.id);
    } else if (typeof window.abrirTicketPreloaded === 'function') {
      window.abrirTicketPreloaded(t);
    }
  } else {
    mostrarNotificacion(`No se encontró el ticket con folio ${folio}`, 'info');
  }
};

function abrirOrdenDesdeCorreo(folio) {
  if (!folio) return;
  const o = (typeof ordenes !== 'undefined' ? ordenes : []).find(ord => ord.folio === folio || ord.id === folio);
  if (o) {
    if (typeof editarOrden === 'function') {
      editarOrden(o.id);
    } else if (typeof window.abrirOrdenDesdePerfil === 'function') {
      window.abrirOrdenDesdePerfil(o.id);
    }
  } else {
    mostrarNotificacion(`No se encontró la orden de servicio con folio ${folio}`, 'info');
  }
};

async function obtenerContenidoAdjuntoMicrosoftGraph(msId, attachmentId, fileName, contentType) {
  const cleanMsId = decodeURIComponent(msId || '').trim();
  let cleanAttId = decodeURIComponent(attachmentId || '').trim();
  const cleanFileName = decodeURIComponent(fileName || 'archivo_adjunto').trim();
  let cleanContentType = decodeURIComponent(contentType || 'application/octet-stream').trim();

  let base64Content = null;

  // Helper fetch with timeout
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      return null;
    }
  };

  // 1. OBTENER TOKEN DE MICROSOFT AZURE (SESSIONSTORAGE, ONEDRIVE, MSAL)
  let token = sessionStorage.getItem('ms_access_token') || 
              localStorage.getItem('ms_access_token') || 
              (typeof onedriveRealToken !== 'undefined' ? onedriveRealToken : '') ||
              localStorage.getItem('sapi_ms_graph_token') || 
              sessionStorage.getItem('sapi_ms_graph_token');

  if (!token && window.msalInstance) {
    const activeAccount = window.msalInstance.getActiveAccount() || (window.msalInstance.getAllAccounts ? window.msalInstance.getAllAccounts()[0] : null);
    if (activeAccount) {
      try {
        const response = await window.msalInstance.acquireTokenSilent({
          scopes: ['Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'User.Read'],
          account: activeAccount
        });
        token = response.accessToken;
      } catch (e) {
        console.warn('[Azure Graph] acquireTokenSilent error:', e);
      }
    }
  }

  // 2. CONSULTAR DIRECTAMENTE A MICROSOFT GRAPH API SI TENEMOS TOKEN Y MS_ID DE GRAPH REAL
  const isRealGraphId = cleanMsId && !cleanMsId.startsWith('email_rep_') && !cleanMsId.startsWith('log_');
  if (token && isRealGraphId) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    if (cleanAttId && cleanAttId !== 'undefined' && cleanAttId !== 'null') {
      const endpoints = [
        `https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx/messages/${cleanMsId}/attachments/${cleanAttId}`,
        `https://graph.microsoft.com/v1.0/me/messages/${cleanMsId}/attachments/${cleanAttId}`,
        `https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx/messages/${cleanMsId}/attachments/${encodeURIComponent(cleanAttId)}`,
        `https://graph.microsoft.com/v1.0/me/messages/${cleanMsId}/attachments/${encodeURIComponent(cleanAttId)}`
      ];
      for (const ep of endpoints) {
        try {
          const res = await fetchWithTimeout(ep, { headers }, 5000);
          if (res && res.ok) {
            const data = await res.json();
            if (data.contentBytes) {
              base64Content = data.contentBytes;
              if (data.contentType) cleanContentType = data.contentType;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!base64Content) {
      const listEndpoints = [
        `https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx/messages/${cleanMsId}/attachments`,
        `https://graph.microsoft.com/v1.0/me/messages/${cleanMsId}/attachments`
      ];
      for (const lep of listEndpoints) {
        try {
          const res = await fetchWithTimeout(lep, { headers }, 6000);
          if (res && res.ok) {
            const listData = await res.json();
            const items = Array.isArray(listData.value) ? listData.value : [];
            const match = items.find(a => (cleanFileName && (a.name === cleanFileName || a.name.toLowerCase() === cleanFileName.toLowerCase())) || (cleanAttId && a.id === cleanAttId)) || items[0];
            if (match && match.contentBytes) {
              base64Content = match.contentBytes;
              if (match.contentType) cleanContentType = match.contentType;
              break;
            }
          }
        } catch (e) {}
      }
    }
  }

  // 2.5 BUSCAR EN BANDEJAS DE GRAPH SI TENEMOS TOKEN PERO EL ID ERA LOCAL O NO SE ENCONTRÓ
  if (!base64Content && token && cleanFileName) {
    const searchBases = ['https://graph.microsoft.com/v1.0/users/Ptalctes@eurorep.mx', 'https://graph.microsoft.com/v1.0/me'];
    const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };
    const folders = ['sentitems', 'inbox'];

    for (const base of searchBases) {
      if (base64Content) break;
      for (const f of folders) {
        try {
          const sUrl = `${base}/mailFolders/${f}/messages?$top=25&$expand=attachments&$orderby=${f === 'inbox' ? 'receivedDateTime' : 'sentDateTime'} desc`;
          const res = await fetchWithTimeout(sUrl, { headers }, 5000);
          if (res && res.ok) {
            const sJson = await res.json();
            const msgs = Array.isArray(sJson.value) ? sJson.value : [];
            for (const m of msgs) {
              const atts = Array.isArray(m.attachments) ? m.attachments : [];
              const matchedAtt = atts.find(a => (a.name && (a.name === cleanFileName || a.name.toLowerCase() === cleanFileName.toLowerCase())) || (cleanAttId && a.id === cleanAttId));
              if (matchedAtt && matchedAtt.contentBytes) {
                base64Content = matchedAtt.contentBytes;
                if (matchedAtt.contentType) cleanContentType = matchedAtt.contentType;
                break;
              }
            }
            if (base64Content) break;
          }
        } catch (e) {}
      }
    }
  }

  // 3. CONSULTAR AL ENDPOINT SERVERLESS
  if (!base64Content) {
    try {
      const bkHeaders = { 'X-Sapi-Client-Token': 'SapiSecuredClientToken' };
      if (token) bkHeaders['X-Ms-Graph-Token'] = token;
      const qUrl = `/api/download-azure-attachment?msId=${encodeURIComponent(cleanMsId || '')}&attachmentId=${encodeURIComponent(cleanAttId || '')}&fileName=${encodeURIComponent(cleanFileName || '')}`;
      const bkRes = await fetchWithTimeout(qUrl, { headers: bkHeaders }, 6000);
      if (bkRes && bkRes.ok) {
        const bkData = await bkRes.json();
        if (bkData.contentBytes) {
          base64Content = bkData.contentBytes;
          if (bkData.contentType) cleanContentType = bkData.contentType;
        }
      }
    } catch (e) {
      console.warn('[Download Proxy] Fallo al invocar endpoint serverless:', e);
    }
  }

  // 4. FALLBACK PARA REPORTES DE SERVICIO DE SAPI (OS-*) SI NO SE OBTUVO DE GRAPH O ES LOCAL
  if (!base64Content && (cleanFileName.toLowerCase().includes('reporte_servicio') || /OS-?(\d+)/i.test(cleanFileName))) {
    const matchOs = cleanFileName.match(/OS-?(\d+)/i);
    if (matchOs) {
      const numericPart = matchOs[1];
      const fullFolio = `OS-${numericPart}`;
      
      let ordList = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? [...ordenes] : [];
      if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) ordList = ordList.concat(window.ordenes);
      try {
        const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
        if (Array.isArray(local)) ordList = ordList.concat(local);
      } catch (e) {}

      const ord = ordList.find(o => {
        if (!o) return false;
        const f = String(o.folio || '').trim();
        const idStr = String(o.id || '').trim();
        return f === fullFolio || f === numericPart || idStr === fullFolio || idStr === numericPart || f.replace(/\D/g, '') === numericPart || idStr.replace(/\D/g, '') === numericPart;
      });

      if (ord) {
        try {
          if (typeof verDetalle === 'function') {
            verDetalle(ord.id);
            const overlayDetalle = document.getElementById('modal-detalle-overlay');
            if (overlayDetalle) overlayDetalle.classList.remove('open');
          }
          if (typeof generarBase64Pdf === 'function') {
            const genPromise = generarBase64Pdf(ord.id);
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000));
            const pdfB64 = await Promise.race([genPromise, timeoutPromise]);
            if (pdfB64) {
              base64Content = pdfB64.includes(',') ? pdfB64.split(',')[1] : pdfB64;
              cleanContentType = 'application/pdf';
            }
          }
        } catch (pdfErr) {
          console.warn('[PDF OS Generator] Error generando PDF de orden:', pdfErr);
        }
      }
    }
  }

  // 5. Ajustar contentType si está genérico según extensión
  const fnLower = cleanFileName.toLowerCase();
  if (cleanContentType === 'application/octet-stream' || !cleanContentType) {
    if (fnLower.endsWith('.pdf')) cleanContentType = 'application/pdf';
    else if (fnLower.endsWith('.png')) cleanContentType = 'image/png';
    else if (fnLower.endsWith('.jpg') || fnLower.endsWith('.jpeg')) cleanContentType = 'image/jpeg';
    else if (fnLower.endsWith('.webp')) cleanContentType = 'image/webp';
    else if (fnLower.endsWith('.gif')) cleanContentType = 'image/gif';
    else if (fnLower.endsWith('.svg')) cleanContentType = 'image/svg+xml';
    else if (fnLower.endsWith('.txt') || fnLower.endsWith('.log')) cleanContentType = 'text/plain';
    else if (fnLower.endsWith('.csv')) cleanContentType = 'text/csv';
    else if (fnLower.endsWith('.json')) cleanContentType = 'application/json';
    else if (fnLower.endsWith('.xml')) cleanContentType = 'application/xml';
    else if (fnLower.endsWith('.html') || fnLower.endsWith('.htm')) cleanContentType = 'text/html';
  }

  if (!base64Content) {
    throw new Error('No se pudo recuperar el archivo adjunto desde Microsoft Azure.');
  }

  return {
    base64Content: base64Content,
    contentType: cleanContentType,
    fileName: cleanFileName
  };
};

async function previsualizarAdjuntoMicrosoftGraph(msId, attachmentId, fileName, contentType) {
  const decodedFileName = decodeURIComponent(fileName || 'Archivo Adjunto').trim();

  // Crear modal overlay inmediatamente con estado de carga
  const modalId = `modal-preview-attachment-${Date.now()}`;
  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(5px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:1.5rem; box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="background:var(--bg-card, #ffffff); width:95%; max-width:1100px; height:90vh; max-height:900px; border-radius:12px; border:1px solid var(--border, #e2e8f0); box-shadow:0 20px 45px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden; animation:fadeIn 0.2s ease-out;">
      <!-- Modal Header -->
      <div style="padding:0.9rem 1.25rem; border-bottom:1px solid var(--border, #e2e8f0); background:var(--bg-primary, #f8fafc); display:flex; justify-content:space-between; align-items:center; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.6rem; min-width:0;">
          <div style="width:32px; height:32px; border-radius:6px; background:rgba(232, 130, 12, 0.12); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i data-lucide="file-text" style="width:16px; height:16px; color:var(--accent, #e8820c);"></i>
          </div>
          <div style="min-width:0;">
            <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary, #0f172a); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${decodedFileName}">${decodedFileName}</h3>
            <span id="${modalId}-status" style="font-size:0.72rem; color:var(--text-muted, #64748b);">Cargando vista previa...</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
          <button id="${modalId}-btn-newtab" type="button" style="display:none; padding:0.35rem 0.7rem; border-radius:6px; background:var(--bg-hover, #f1f5f9); border:1px solid var(--border, #cbd5e1); font-size:0.75rem; font-weight:600; color:var(--text-primary, #0f172a); cursor:pointer; align-items:center; gap:0.3rem;" title="Abrir en pestaña completa">
            <i data-lucide="external-link" style="width:13px; height:13px;"></i> Nueva pestaña
          </button>
          <button id="${modalId}-btn-download" type="button" style="display:none; padding:0.35rem 0.7rem; border-radius:6px; background:var(--accent, #e8820c); border:none; font-size:0.75rem; font-weight:700; color:white; cursor:pointer; align-items:center; gap:0.3rem;" title="Descargar archivo">
            <i data-lucide="download" style="width:13px; height:13px;"></i> Descargar
          </button>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove()" style="background:transparent; border:none; color:var(--text-muted, #64748b); font-size:1.4rem; cursor:pointer; padding:0.2rem 0.5rem; border-radius:6px; line-height:1;" title="Cerrar (Esc)">&times;</button>
        </div>
      </div>
      <!-- Modal Content Body -->
      <div id="${modalId}-body" style="flex:1; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1e293b; overflow:auto; position:relative;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem; color:#94a3b8;">
          <i data-lucide="loader-2" class="spin" style="width:36px; height:36px; color:var(--accent, #e8820c);"></i>
          <span style="font-size:0.88rem; font-weight:500;">Obteniendo documento desde Microsoft 365...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }
  };
  document.addEventListener('keydown', handleKey);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }
  });

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Tiempo de espera agotado al obtener el archivo desde Microsoft Azure. Verifica tu conexión o intenta nuevamente.')), 12000)
    );
    const data = await Promise.race([
      window.obtenerContenidoAdjuntoMicrosoftGraph(msId, attachmentId, fileName, contentType),
      timeoutPromise
    ]);

    const cleanB64 = data.base64Content.replace(/\s/g, '');
    const byteCharacters = atob(cleanB64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: data.contentType });
    const blobUrl = URL.createObjectURL(blob);

    const bodyEl = document.getElementById(`${modalId}-body`);
    const statusEl = document.getElementById(`${modalId}-status`);
    const btnNewTab = document.getElementById(`${modalId}-btn-newtab`);
    const btnDownload = document.getElementById(`${modalId}-btn-download`);

    if (statusEl) {
      const sizeKb = Math.round(blob.size / 1024);
      statusEl.textContent = `${data.contentType} • ${sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb + ' KB'}`;
    }

    if (btnNewTab) {
      btnNewTab.style.display = 'inline-flex';
      btnNewTab.onclick = () => window.open(blobUrl, '_blank');
    }

    if (btnDownload) {
      btnDownload.style.display = 'inline-flex';
      btnDownload.onclick = () => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 500);
      };
    }

    if (!bodyEl) return;

    const fn = (data.fileName || '').toLowerCase();
    const ct = (data.contentType || '').toLowerCase();

    // 1. PDF
    if (ct.includes('pdf') || fn.endsWith('.pdf')) {
      bodyEl.style.background = '#525659';
      bodyEl.innerHTML = `
        <object data="${blobUrl}" type="application/pdf" style="width:100%; height:100%; border:none; display:block;">
          <iframe src="${blobUrl}#toolbar=1&navpanes=1" style="width:100%; height:100%; border:none;" title="${data.fileName}">
            <div style="padding:2rem; text-align:center; color:white;">
              <p>Tu navegador no permite embeber este visor de PDF directamente.</p>
              <a href="${blobUrl}" target="_blank" class="btn-primary" style="padding:0.5rem 1rem; color:white; text-decoration:none; border-radius:6px; background:var(--accent);">Abrir en pestaña nueva</a>
            </div>
          </iframe>
        </object>
      `;
    }
    // 2. Imágenes
    else if (ct.startsWith('image/') || fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.webp') || fn.endsWith('.gif') || fn.endsWith('.svg')) {
      bodyEl.style.background = '#0f172a';
      bodyEl.innerHTML = `
        <div style="padding:1.5rem; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
          <img src="${blobUrl}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5);" alt="${data.fileName}" />
        </div>
      `;
    }
    // 3. Archivos de texto, código, JSON, XML, CSV
    else if (ct.startsWith('text/') || fn.endsWith('.txt') || fn.endsWith('.log') || fn.endsWith('.json') || fn.endsWith('.xml') || fn.endsWith('.csv')) {
      const textDecoder = new TextDecoder('utf-8');
      const textContent = textDecoder.decode(byteArray);
      const escaped = textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bodyEl.style.background = 'var(--bg-primary, #f8fafc)';
      bodyEl.style.display = 'block';
      bodyEl.innerHTML = `
        <div style="padding:1.5rem; width:100%; height:100%; box-sizing:border-box;">
          <pre style="width:100%; height:100%; margin:0; padding:1.25rem; background:var(--bg-card, #ffffff); color:var(--text-primary, #0f172a); border:1px solid var(--border, #e2e8f0); border-radius:8px; overflow:auto; font-family:monospace; font-size:0.85rem; line-height:1.5; white-space:pre-wrap; box-sizing:border-box;">${escaped}</pre>
        </div>
      `;
    }
    // 4. Otros archivos
    else {
      bodyEl.style.background = 'var(--bg-primary, #f8fafc)';
      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; text-align:center; padding:2rem; color:var(--text-primary);">
          <div style="width:64px; height:64px; border-radius:12px; background:rgba(232, 130, 12, 0.12); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="file-check" style="width:32px; height:32px; color:var(--accent);"></i>
          </div>
          <div style="max-width:400px;">
            <h4 style="margin:0 0 0.5rem 0; font-size:1.05rem;">${data.fileName}</h4>
            <p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">Este tipo de archivo no cuenta con previsualización directa en el navegador, pero puedes descargarlo o abrirlo externamente.</p>
          </div>
          <button type="button" onclick="document.getElementById('${modalId}-btn-download')?.click()" class="btn-primary" style="padding:0.5rem 1.25rem; font-size:0.85rem; font-weight:700; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <i data-lucide="download" style="width:15px; height:15px;"></i> Descargar Archivo
          </button>
        </div>
      `;
    }

    if (window.lucide) lucide.createIcons();

  } catch (err) {
    console.error('Error previsualizando adjunto:', err);
    const bodyEl = document.getElementById(`${modalId}-body`);
    const statusEl = document.getElementById(`${modalId}-status`);
    if (statusEl) statusEl.textContent = 'Error al cargar vista previa';
    if (bodyEl) {
      bodyEl.style.background = 'var(--bg-primary, #f8fafc)';
      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.85rem; text-align:center; padding:2.5rem; color:#ef4444; max-width:440px;">
          <div style="width:48px; height:48px; border-radius:50%; background:rgba(239,68,68,0.1); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="alert-triangle" style="width:24px; height:24px; color:#ef4444;"></i>
          </div>
          <h4 style="margin:0; font-size:1.05rem; color:var(--text-primary); font-weight:700;">No se pudo cargar la vista previa</h4>
          <p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.45;">${err.message || 'No se pudo recuperar el archivo desde Microsoft Azure.'}</p>
          <div style="display:flex; gap:0.6rem; margin-top:0.5rem;">
            <button type="button" onclick="document.getElementById('${modalId}')?.remove(); window.previsualizarAdjuntoMicrosoftGraph('${msId}', '${attachmentId}', '${fileName}', '${contentType}')" class="btn-primary" style="padding:0.45rem 1rem; font-size:0.8rem; font-weight:700; border-radius:6px; cursor:pointer;">
              <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Reintentar
            </button>
            <button type="button" onclick="document.getElementById('${modalId}')?.remove(); window.descargarAdjuntoMicrosoftGraph('${msId}', '${attachmentId}', '${fileName}', '${contentType}')" class="btn-secondary" style="padding:0.45rem 0.9rem; font-size:0.8rem; font-weight:600; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); cursor:pointer;">
              <i data-lucide="download" style="width:13px; height:13px;"></i> Descargar
            </button>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
  }
};

async function descargarAdjuntoMicrosoftGraph(msId, attachmentId, fileName, contentType) {
  const cleanFileName = decodeURIComponent(fileName || 'archivo_adjunto').trim();
  mostrarNotificacion(`Descargando "${cleanFileName}"...`, 'info');

  try {
    const data = await window.obtenerContenidoAdjuntoMicrosoftGraph(msId, attachmentId, fileName, contentType);
    const cleanB64 = data.base64Content.replace(/\s/g, '');
    const byteCharacters = atob(cleanB64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: data.contentType });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = data.fileName || cleanFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    mostrarNotificacion(`Descarga completada: ${data.fileName || cleanFileName}`, 'success');
  } catch (err) {
    console.error('Error descargando adjunto:', err);
    mostrarNotificacion(`Error al descargar: ${err.message || err}`, 'error');
  }
};

async function enviarRespuestaRapidaCorreo(event, logId) {
  if (event) event.preventDefault();
  const textarea = document.getElementById('mail-quick-reply-text');
  const btn = document.getElementById('btn-mail-quick-reply-send');
  const replyText = textarea?.value.trim();
  if (!replyText) {
    mostrarNotificacion('Por favor escribe un mensaje para responder.', 'warning');
    return;
  }

  const logs = window.obtenerEmailLogsSoporte();
  const log = logs.find(l => l.id === logId);
  if (!log) return;

  const isRecibido = log.tipo === 'recibido' || log.estatus === 'Recibido';
  const toEmail = isRecibido ? (log.de || '') : (log.para || '');
  if (!toEmail || !toEmail.includes('@')) {
    mostrarNotificacion('No hay una dirección de correo válida para responder automáticamente.', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:13px; height:13px;"></i> Enviando...`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    let token = '';
    if (window.supabaseClient && window.supabaseClient.auth) {
      try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        token = sessionData?.session?.access_token || '';
      } catch (authErr) {}
    }

    const subject = log.asunto ? (log.asunto.startsWith('Re:') ? log.asunto : `Re: ${log.asunto}`) : 'Re: Seguimiento';
    const formattedBody = replyText.replace(/\n/g, '<br>');
    const htmlPayload = window.obtenerHtmlPlantillaProfesional ? window.obtenerHtmlPlantillaProfesional(formattedBody) : formattedBody;

    const payload = {
      to: toEmail,
      subject: subject,
      htmlBody: htmlPayload,
      cliente: log.cliente || 'Cliente',
      folio_ticket: log.folio_ticket || '',
      folio_os: log.folio_os || ''
    };

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Sapi-Client-Token': 'SapiSecuredClientToken'
      },
      body: JSON.stringify(payload)
    });

    const isOk = response.ok;
    const newLogItem = {
      id: 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      tipo: 'enviado',
      de: 'Ptalctes@eurorep.mx',
      para: toEmail,
      cliente: log.cliente || 'Cliente',
      asunto: subject,
      cuerpo: replyText,
      htmlBody: htmlPayload,
      fecha: new Date().toISOString(),
      evento: 'Respuesta Rápida',
      regla: 'Bandeja Soporte',
      estatus: isOk ? 'Enviado' : 'Fallido',
      folio_ticket: log.folio_ticket || '',
      folio_os: log.folio_os || ''
    };

    window.registrarLogEmail(newLogItem);

    if (isOk) {
      mostrarNotificacion('Respuesta enviada con éxito desde Ptalctes@eurorep.mx', 'success');
      if (textarea) textarea.value = '';
      activeEmailLogId = newLogItem.id;
      window.renderChatSoporteEmpresa();
    } else {
      mostrarNotificacion('Error al enviar la respuesta.', 'error');
    }
  } catch (err) {
    console.error('Error en respuesta rápida:', err);
    mostrarNotificacion('Error al conectar con servidor de correos: ' + (err.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="send" style="width:14px; height:14px;"></i> Enviar`;
      if (window.lucide) lucide.createIcons();
    }
  }
};

function renderCorreoEmptyPane() {
  const paneContainer = document.getElementById('chat-active-pane');
  if (!paneContainer) return;
  paneContainer.innerHTML = `
    <div style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--text-muted); gap:0.75rem; padding:2rem;">
      <i data-lucide="mail" style="width:54px; height:54px; opacity:0.4;"></i>
      <h3 style="font-size:1rem; font-weight:600; margin:0; color:var(--text-secondary);">Bandeja de Correo de Soporte</h3>
      <p style="font-size:0.85rem; max-width:400px; text-align:center; margin:0;">Selecciona un correo del historial para inspeccionar sus detalles o redacta un nuevo mensaje desde <strong>Ptalctes@eurorep.mx</strong>.</p>
      <button class="btn-primary" onclick="window.redactarNuevoCorreoSoporte()" style="margin-top:0.5rem; border-radius:8px; padding:0.5rem 1.25rem; font-size:0.85rem; display:inline-flex; align-items:center; gap:0.4rem;">
        <i data-lucide="plus" style="width:14px; height:14px;"></i> Redactar Nuevo Correo
      </button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
};

function seleccionarEmailLog(logId) {
  isComposingEmail = false;
  activeEmailLogId = logId;
  window.renderChatSoporteEmpresa();
};

function redactarNuevoCorreoSoporte(emailTo = '', clienteNombre = '', subject = '') {
  activeSoporteTab = 'correos';
  isComposingEmail = true;
  activeEmailLogId = null;
  window._currentMailAttachments = [];

  const existingForm = document.getElementById('form-componer-correo-soporte');
  if (existingForm) {
    existingForm.remove();
  }

  window.renderChatSoporteEmpresa();

  setTimeout(() => {
    const toInput = document.getElementById('mail-composer-to');
    const clientInput = document.getElementById('mail-composer-cliente');
    const subjectInput = document.getElementById('mail-composer-subject');
    if (toInput && emailTo) toInput.value = emailTo;
    if (clientInput && clienteNombre) clientInput.value = clienteNombre;
    if (subjectInput && subject) subjectInput.value = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  }, 50);
};

function toggleMailField(field) {
  const row = document.getElementById('row-mail-composer-' + field);
  if (!row) return;
  if (row.style.display === 'none' || !row.style.display) {
    row.style.display = 'flex';
    const input = document.getElementById('mail-composer-' + field);
    if (input) input.focus();
  } else {
    row.style.display = 'none';
    const input = document.getElementById('mail-composer-' + field);
    if (input) input.value = '';
  }
};

async function manejarArchivosAdjuntosCorreo(event) {
  if (!event.target.files || event.target.files.length === 0) return;
  window._currentMailAttachments = window._currentMailAttachments || [];
  const files = Array.from(event.target.files);
  for (const file of files) {
    try {
      const base64Str = await readFileAsBase64(file);
      const cleanBase64 = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
      window._currentMailAttachments.push({
        filename: file.name,
        content: cleanBase64,
        size: file.size
      });
    } catch (err) {
      console.error('Error cargando adjunto:', err);
    }
  }
  window.renderMailAttachmentChips();
};

function removerAdjuntoCorreo(index) {
  if (window._currentMailAttachments && window._currentMailAttachments[index]) {
    window._currentMailAttachments.splice(index, 1);
    window.renderMailAttachmentChips();
  }
};

function renderMailAttachmentChips() {
  const container = document.getElementById('mail-composer-attachment-chips');
  if (!container) return;
  const list = window._currentMailAttachments || [];
  if (list.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = list.map((a, idx) => {
    const sizeKb = Math.round((a.size || 0) / 1024);
    return `
      <span style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.2rem 0.55rem; border-radius:14px; background:var(--bg-hover); border:1px solid var(--border); font-size:0.75rem; color:var(--text-primary);">
        <i data-lucide="file-text" style="width:13px; height:13px; color:var(--accent);"></i>
        <span>${a.filename}</span>
        <span style="color:var(--text-muted); font-size:0.68rem;">(${sizeKb} KB)</span>
        <button type="button" onclick="window.removerAdjuntoCorreo(${idx})" style="border:none; background:transparent; cursor:pointer; color:var(--red); font-size:0.8rem; line-height:1; padding:0 0.1rem; margin-left:0.2rem;">✕</button>
      </span>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
};

function aplicarPlantillaEnCompositor(templateId) {
  if (!templateId) return;
  const template = (emailTemplates || []).find(t => t.id === templateId);
  if (!template) return;
  
  const subjectInput = document.getElementById('mail-composer-subject');
  const bodyElem = document.getElementById('mail-composer-body');
  const clientInput = document.getElementById('mail-composer-cliente');
  const clienteName = clientInput?.value.trim() || 'Cliente';

  let subject = template.asunto || '';
  let body = template.cuerpo || '';

  subject = subject.replace(/{{nombre_cliente}}/g, clienteName).replace(/{{folio_ticket}}/g, '');
  body = body.replace(/{{nombre_cliente}}/g, clienteName).replace(/{{folio_ticket}}/g, '').replace(/\n/g, '<br>');

  if (subjectInput) subjectInput.value = subject;
  if (bodyElem) {
    if (bodyElem.isContentEditable) {
      bodyElem.innerHTML = body;
    } else {
      bodyElem.value = template.cuerpo || '';
    }
    window.insertarFirmaOficialEurorep();
  }
};

if (typeof window !== 'undefined') window._linkModalCallback = null;

function abrirModalInsertarLink(defaultText = '', callback) {
  let modalOverlay = document.getElementById('modal-insertar-link-overlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modal-insertar-link-overlay';
    modalOverlay.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
    modalOverlay.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:1.25rem 1.5rem; width:100%; max-width:420px; box-shadow:0 10px 25px rgba(0,0,0,0.25); text-align:left;">
        <h4 style="font-size:0.95rem; font-weight:700; margin:0 0 1rem 0; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="link" style="width:16px; height:16px; color:var(--accent);"></i> Insertar Enlace Web
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div>
            <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Texto visible del enlace</label>
            <input type="text" id="modal-link-text-input" placeholder="Ej. Portal de Clientes o Haz clic aquí" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem;" />
          </div>
          <div>
            <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Dirección Web (URL)</label>
            <input type="url" id="modal-link-url-input" placeholder="https://eurorep.mx" value="https://" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem;" />
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" onclick="document.getElementById('modal-insertar-link-overlay').style.display='none';" class="btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; cursor:pointer;">Cancelar</button>
          <button type="button" onclick="window.confirmarModalInsertarLink()" class="btn-primary" style="padding:0.4rem 1.1rem; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600;">Insertar Enlace</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    if (window.lucide) lucide.createIcons();
  }

  window._linkModalCallback = callback;
  const textInput = document.getElementById('modal-link-text-input');
  const urlInput = document.getElementById('modal-link-url-input');
  if (textInput) textInput.value = defaultText || 'Haz clic aquí';
  if (urlInput) urlInput.value = 'https://';

  modalOverlay.style.display = 'flex';
  setTimeout(() => { if (urlInput) { urlInput.focus(); urlInput.select(); } }, 50);
};

function confirmarModalInsertarLink() {
  const textInput = document.getElementById('modal-link-text-input')?.value.trim();
  const urlInput = document.getElementById('modal-link-url-input')?.value.trim();
  const overlay = document.getElementById('modal-insertar-link-overlay');
  
  if (overlay) overlay.style.display = 'none';

  if (urlInput && window._linkModalCallback) {
    window._linkModalCallback(urlInput, textInput || 'Haz clic aquí');
  }
  window._linkModalCallback = null;
};

function abrirModalInsertarTabla() {
  let modalOverlay = document.getElementById('modal-insertar-tabla-overlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modal-insertar-tabla-overlay';
    modalOverlay.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
    modalOverlay.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:1.25rem 1.5rem; width:100%; max-width:440px; box-shadow:0 10px 25px rgba(0,0,0,0.25); text-align:left;">
        <h4 style="font-size:0.95rem; font-weight:700; margin:0 0 1rem 0; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="table" style="width:16px; height:16px; color:var(--accent);"></i> Configurar e Insertar Tabla
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div>
              <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Columnas</label>
              <input type="number" id="modal-table-cols" min="1" max="10" value="3" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Filas</label>
              <input type="number" id="modal-table-rows" min="1" max="15" value="3" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem;" />
            </div>
          </div>
          <div>
            <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Estilo Visual</label>
            <select id="modal-table-style" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem; outline:none;">
              <option value="classic-gray" selected>Gris Corporativo Clásico</option>
              <option value="modern-orange">Naranja SAPI Eurorep</option>
              <option value="navy-blue">Azul Profesional</option>
              <option value="minimal">Mínimo / Limpio (Sin Fondo)</option>
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; align-items:center;">
            <div>
              <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">Ancho de Tabla</label>
              <select id="modal-table-width" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-size:0.85rem; outline:none;">
                <option value="100%" selected>Ancho Completo (100%)</option>
                <option value="auto">Ajustar a Contenido</option>
              </select>
            </div>
            <div style="margin-top:1rem;">
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-primary); display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
                <input type="checkbox" id="modal-table-header-check" checked style="accent-color:var(--accent); cursor:pointer;" />
                Fila Encabezado
              </label>
            </div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" onclick="document.getElementById('modal-insertar-tabla-overlay').style.display='none';" class="btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; cursor:pointer;">Cancelar</button>
          <button type="button" onclick="window.confirmarModalInsertarTabla()" class="btn-primary" style="padding:0.4rem 1.1rem; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:600;">Insertar Tabla</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    if (window.lucide) lucide.createIcons();
  }

  modalOverlay.style.display = 'flex';
};

function confirmarModalInsertarTabla() {
  const cols = Math.max(1, Math.min(10, parseInt(document.getElementById('modal-table-cols')?.value || 3)));
  const rows = Math.max(1, Math.min(15, parseInt(document.getElementById('modal-table-rows')?.value || 3)));
  const hasHeader = document.getElementById('modal-table-header-check')?.checked ?? true;
  const stylePreset = document.getElementById('modal-table-style')?.value || 'classic-gray';
  const widthVal = document.getElementById('modal-table-width')?.value || '100%';

  const overlay = document.getElementById('modal-insertar-tabla-overlay');
  if (overlay) overlay.style.display = 'none';

  let headerBg = '#f8fafc';
  let headerColor = '#334155';
  let borderColor = '#cbd5e1';
  let altRowBg = '#f8fafc';

  if (stylePreset === 'modern-orange') {
    headerBg = '#e8820c';
    headerColor = '#ffffff';
    borderColor = '#fdba74';
    altRowBg = '#fff7ed';
  } else if (stylePreset === 'navy-blue') {
    headerBg = '#1e293b';
    headerColor = '#ffffff';
    borderColor = '#94a3b8';
    altRowBg = '#f8fafc';
  } else if (stylePreset === 'minimal') {
    headerBg = 'transparent';
    headerColor = 'var(--text-primary)';
    borderColor = '#e2e8f0';
    altRowBg = 'transparent';
  }

  let tableHtml = `<table style="width:${widthVal}; border-collapse:collapse; margin:14px 0; border:1px solid ${borderColor}; font-size:0.85rem; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`;
  
  if (hasHeader) {
    tableHtml += `<thead><tr style="background:${headerBg}; color:${headerColor};">`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="border:1px solid ${borderColor}; padding:8px 12px; font-weight:700; text-align:left;">Encabezado ${c}</th>`;
    }
    tableHtml += `</tr></thead>`;
  }

  tableHtml += `<tbody>`;
  for (let r = 1; r <= rows; r++) {
    const rowBg = (r % 2 === 0 && altRowBg !== 'transparent') ? `background:${altRowBg};` : '';
    tableHtml += `<tr style="${rowBg}">`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<td style="border:1px solid ${borderColor}; padding:8px 12px;">Dato ${r}.${c}</td>`;
    }
    tableHtml += `</tr>`;
  }
  tableHtml += `</tbody></table><br/>`;

  const bodyElem = document.getElementById('mail-composer-body');
  if (bodyElem) {
    bodyElem.focus();
    document.execCommand('insertHTML', false, tableHtml);
  }
};

function formatMailBody(action) {
  const bodyElem = document.getElementById('mail-composer-body');
  if (!bodyElem) return;
  bodyElem.focus();

  if (action === 'bold') {
    document.execCommand('bold', false, null);
  } else if (action === 'italic') {
    document.execCommand('italic', false, null);
  } else if (action === 'underline') {
    document.execCommand('underline', false, null);
  } else if (action === 'h2') {
    document.execCommand('formatBlock', false, '<h2>');
  } else if (action === 'ul') {
    document.execCommand('insertUnorderedList', false, null);
  } else if (action === 'link') {
    const selText = window.getSelection() ? window.getSelection().toString() : '';
    window.abrirModalInsertarLink(selText, (url, text) => {
      bodyElem.focus();
      if (selText) {
        document.execCommand('createLink', false, url);
      } else {
        const linkHtml = `<a href="${url}" target="_blank" style="color:#e8820c; text-decoration:underline; font-weight:600;">${text}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
      }
    });
  }
};

function obtenerHtmlFirmaOficialEurorep() {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://eurorep.mx';
  const logoSrc = origin + '/logo_transparent.png';
  return `
<div class="eurorep-signature-block" style="margin-top: 24px; padding-top: 14px; border-top: 2px solid #e8820c; display: flex; align-items: center; gap: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: left;">
  <img src="${logoSrc}" alt="Eurorep Logo" style="height: 44px; width: auto; max-width: 140px; object-fit: contain; display: block;" />
  <div style="border-left: 2px solid #cbd5e1; padding-left: 12px; font-size: 12px; color: #475569; line-height: 1.4;">
    <strong style="font-size: 13px; color: #0f172a; display: block;">Equipo de Postventa & Soporte Técnico</strong>
    <span style="font-weight: 700; color: #e8820c;">Euro Representaciones S.A. de C.V.</span><br />
    <span><a href="mailto:Ptalctes@eurorep.mx" style="color:#2563eb; text-decoration:none;">Ptalctes@eurorep.mx</a> &nbsp;|&nbsp; <a href="https://eurorep.mx" target="_blank" style="color: #e8820c; text-decoration: none; font-weight: 600;">www.eurorep.mx</a></span>
  </div>
</div>`;
};

function insertarFirmaOficialEurorep() {
  const bodyElem = document.getElementById('mail-composer-body');
  if (!bodyElem) return;
  
  const firmaHtml = window.obtenerHtmlFirmaOficialEurorep();

  if (bodyElem.isContentEditable) {
    if (!bodyElem.innerHTML.includes('eurorep-signature-block')) {
      bodyElem.innerHTML += '<br/>' + firmaHtml;
    }
  } else {
    if (!bodyElem.value.includes('eurorep-signature-block')) {
      bodyElem.value += firmaHtml;
    }
  }
  bodyElem.focus();
};

function actualizarEstadoBotonesWord() {
  const mapBtnCmd = {
    'btn-word-bold': 'bold',
    'btn-word-italic': 'italic',
    'btn-word-underline': 'underline',
    'btn-word-strikethrough': 'strikethrough',
    'btn-word-justifyLeft': 'justifyLeft',
    'btn-word-justifyCenter': 'justifyCenter',
    'btn-word-justifyRight': 'justifyRight',
    'btn-word-insertUnorderedList': 'insertUnorderedList',
    'btn-word-insertOrderedList': 'insertOrderedList'
  };

  for (const [id, cmd] of Object.entries(mapBtnCmd)) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    let isActive = false;
    try {
      isActive = document.queryCommandState(cmd);
    } catch (e) {}

    if (isActive) {
      btn.style.background = 'var(--accent, #e8820c)';
      btn.style.color = '#ffffff';
      btn.style.borderColor = 'var(--accent, #e8820c)';
      btn.querySelectorAll('svg, i').forEach(el => el.style.color = '#ffffff');
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-primary)';
      btn.style.borderColor = 'var(--border)';
      btn.querySelectorAll('svg, i').forEach(el => el.style.color = '');
    }
  }
};


function getMailComposerSelectedCell() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentNode;
  while (node && node.id !== 'mail-composer-body') {
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      return node;
    }
    node = node.parentNode;
  }
  return null;
};

function toggleMenuHerramientasTabla(forceShow = null) {
  const menu = document.getElementById('dropdown-menu-herramientas-tabla');
  if (!menu) return;
  if (typeof forceShow === 'boolean') {
    menu.style.display = forceShow ? 'block' : 'none';
  } else {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
};

function cambiarColorCeldaTabla(color) {
  const cell = window.getMailComposerSelectedCell();
  if (cell) {
    cell.style.backgroundColor = color;
  } else {
    mostrarNotificacion('Haz clic dentro de una celda de la tabla para cambiar su color.', 'info');
  }
};

function combinarCeldasTabla() {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) {
    mostrarNotificacion('Haz clic dentro de la celda de la tabla que deseas combinar.', 'info');
    return;
  }
  const nextCell = cell.nextElementSibling;
  if (!nextCell) {
    mostrarNotificacion('No hay una celda adyacente a la derecha para combinar.', 'warning');
    return;
  }
  const currentColspan = parseInt(cell.getAttribute('colspan') || '1');
  const nextColspan = parseInt(nextCell.getAttribute('colspan') || '1');
  
  cell.setAttribute('colspan', (currentColspan + nextColspan).toString());
  if (nextCell.innerHTML.trim() && nextCell.innerHTML !== '&nbsp;') {
    cell.innerHTML += ' ' + nextCell.innerHTML;
  }
  nextCell.remove();
  mostrarNotificacion('Celdas combinadas exitosamente.', 'success');
};

function dividirCeldaTabla() {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) return;
  const currentColspan = parseInt(cell.getAttribute('colspan') || '1');
  if (currentColspan <= 1) {
    mostrarNotificacion('Esta celda no está combinada.', 'info');
    return;
  }
  cell.setAttribute('colspan', '1');
  for (let i = 1; i < currentColspan; i++) {
    const newCell = document.createElement(cell.tagName);
    newCell.style.cssText = cell.style.cssText;
    newCell.innerHTML = '&nbsp;';
    cell.parentNode.insertBefore(newCell, cell.nextSibling);
  }
  mostrarNotificacion('Celda dividida.', 'success');
};

function insertarFilaTabla(posicion = 'abajo') {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) {
    mostrarNotificacion('Haz clic dentro de una celda para insertar una fila.', 'info');
    return;
  }
  const row = cell.closest('tr');
  if (!row) return;
  const newRow = row.cloneNode(true);
  Array.from(newRow.children).forEach(c => {
    c.innerHTML = '&nbsp;';
    c.removeAttribute('colspan');
    c.removeAttribute('rowspan');
  });
  if (posicion === 'arriba') {
    row.parentNode.insertBefore(newRow, row);
  } else {
    row.parentNode.insertBefore(newRow, row.nextSibling);
  }
};

function insertarColumnaTabla(posicion = 'derecha') {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) {
    mostrarNotificacion('Haz clic dentro de una celda para insertar una columna.', 'info');
    return;
  }
  const colIdx = cell.cellIndex;
  const table = cell.closest('table');
  if (!table) return;

  Array.from(table.rows).forEach(r => {
    const targetCell = r.cells[colIdx];
    if (targetCell) {
      const newCell = document.createElement(targetCell.tagName);
      newCell.style.cssText = targetCell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      if (posicion === 'izquierda') {
        r.insertBefore(newCell, targetCell);
      } else {
        r.insertBefore(newCell, targetCell.nextSibling);
      }
    }
  });
};

function eliminarFilaTabla() {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) return;
  const row = cell.closest('tr');
  if (row) row.remove();
};

function eliminarColumnaTabla() {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) return;
  const colIdx = cell.cellIndex;
  const table = cell.closest('table');
  if (!table) return;

  Array.from(table.rows).forEach(r => {
    if (r.cells[colIdx]) r.cells[colIdx].remove();
  });
};

function eliminarTablaCompleta() {
  const cell = window.getMailComposerSelectedCell();
  if (!cell) return;
  const table = cell.closest('table');
  if (table) table.remove();
};

function execWordCommand(cmd, value = null) {
  const bodyElem = document.getElementById('mail-composer-body');
  if (!bodyElem) return;

  const sel = window.getSelection();
  let isInside = false;
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (bodyElem.contains(range.commonAncestorContainer)) {
      isInside = true;
    }
  }

  if (!isInside) {
    bodyElem.focus();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(bodyElem);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  if (cmd === 'insertTable') {
    window.abrirModalInsertarTabla();
    return;
  } else if (cmd === 'backColor' || cmd === 'hiliteColor') {
    const ok = document.execCommand('hiliteColor', false, value);
    if (!ok) document.execCommand('backColor', false, value);
  } else if (cmd === 'insertUnorderedList' || cmd === 'insertOrderedList') {
    const isAlreadyActive = document.queryCommandState(cmd);
    const execOk = document.execCommand(cmd, false, value);
    if (!execOk || (!isAlreadyActive && !bodyElem.innerHTML.includes('<li') && !bodyElem.innerHTML.includes('<ul') && !bodyElem.innerHTML.includes('<ol'))) {
      const tag = cmd === 'insertUnorderedList' ? 'ul' : 'ol';
      const selectedText = sel ? sel.toString() : '';
      const listHtml = `<${tag} style="margin:8px 0; padding-left:24px; list-style-type:${cmd === 'insertUnorderedList' ? 'disc' : 'decimal'};"><li style="margin-bottom:4px;">${selectedText || 'Elemento 1'}</li></${tag}><br/>`;
      document.execCommand('insertHTML', false, listHtml);
    }
  } else {
    document.execCommand(cmd, false, value);
  }
  window.actualizarEstadoBotonesWord();
};

function renderCorreoComposerPane() {
  const paneContainer = document.getElementById('chat-active-pane');
  if (!paneContainer) return;

  paneContainer.innerHTML = `
    <style>
      #mail-composer-body ul { list-style-type: disc !important; padding-left: 24px !important; margin: 8px 0 !important; }
      #mail-composer-body ol { list-style-type: decimal !important; padding-left: 24px !important; margin: 8px 0 !important; }
      #mail-composer-body li { display: list-item !important; margin-bottom: 4px !important; }
    </style>
    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-primary); border-radius:10px; overflow:hidden;">
      <!-- Top Action Ribbon (Estilo Outlook / Mail Client Toolbar) -->
      <div style="padding:0.6rem 1rem; border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <!-- Primary Send Button -->
          <button type="button" onclick="document.getElementById('form-componer-correo-soporte').requestSubmit()" id="btn-send-manual-mail" class="btn-primary" style="padding:0.45rem 1.1rem; border-radius:6px; font-size:0.82rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer; background:var(--accent); color:white; border:none; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <i data-lucide="send" style="width:14px; height:14px;"></i> Enviar Correo
          </button>

          <!-- Attach File Button -->
          <button type="button" onclick="document.getElementById('mail-composer-file-input').click()" class="btn-secondary" style="padding:0.45rem 0.8rem; border-radius:6px; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);">
            <i data-lucide="paperclip" style="width:14px; height:14px; color:var(--text-secondary);"></i> Adjuntar
          </button>

          <!-- Template Selector Dropdown -->
          <div style="position:relative; display:inline-block;">
            <select onchange="window.aplicarPlantillaEnCompositor(this.value); this.value='';" style="padding:0.45rem 0.8rem; border-radius:6px; font-size:0.8rem; font-weight:600; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); cursor:pointer; outline:none;">
              <option value="">Cargar Plantilla...</option>
              ${(typeof emailTemplates !== 'undefined' ? emailTemplates : []).map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
            </select>
          </div>

          <!-- CC / CCO toggles -->
          <button type="button" onclick="window.toggleMailField('cc')" style="padding:0.4rem 0.6rem; font-size:0.75rem; font-weight:600; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-secondary); cursor:pointer;">
            + CC
          </button>
          <button type="button" onclick="window.toggleMailField('bcc')" style="padding:0.4rem 0.6rem; font-size:0.75rem; font-weight:600; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-secondary); cursor:pointer;">
            + CCO
          </button>
        </div>

        <!-- Discard / Cancel Button -->
        <button type="button" onclick="isComposingEmail=false; window._currentMailAttachments=[]; window.renderChatSoporteEmpresa();" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:600; border-radius:6px; border:1px solid var(--border); background:transparent; color:var(--text-muted); cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem;">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Descartar
        </button>
      </div>

      <!-- Hidden File Input for Attachments -->
      <input type="file" id="mail-composer-file-input" multiple onchange="window.manejarArchivosAdjuntosCorreo(event)" style="display:none;" />

      <!-- Form & Mail Client Header Fields -->
      <form id="form-componer-correo-soporte" onsubmit="window.enviarCorreoManualSoporte(event)" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
        <div style="padding:0.75rem 1.25rem; background:var(--bg-card); border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:0.4rem;">
          
          <!-- Field: De (From) -->
          <div style="display:flex; align-items:center; font-size:0.82rem; min-height:30px;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">De:</span>
            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.2rem 0.65rem; border-radius:16px; background:rgba(232, 130, 12, 0.1); border:1px solid rgba(232, 130, 12, 0.25); font-weight:600; font-size:0.8rem; color:var(--accent);">
              <i data-lucide="shield-check" style="width:13px; height:13px;"></i> Ptalctes@eurorep.mx <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">(SAPI Eurorep Postventa)</span>
            </div>
          </div>

          <!-- Field: Para (To) -->
          <div style="display:flex; align-items:center; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:0.2rem;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">Para:</span>
            <input type="email" id="mail-composer-to" required placeholder="correo@cliente.com" style="flex:1; border:none; background:transparent; font-size:0.88rem; color:var(--text-primary); outline:none; padding:0.3rem 0;" />
          </div>

          <!-- Field: CC (Collapsible) -->
          <div id="row-mail-composer-cc" style="display:none; align-items:center; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:0.2rem;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">CC:</span>
            <input type="text" id="mail-composer-cc" placeholder="copia@empresa.com" style="flex:1; border:none; background:transparent; font-size:0.88rem; color:var(--text-primary); outline:none; padding:0.3rem 0;" />
            <button type="button" onclick="window.toggleMailField('cc')" style="border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">✕</button>
          </div>

          <!-- Field: CCO (Collapsible) -->
          <div id="row-mail-composer-bcc" style="display:none; align-items:center; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:0.2rem;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">CCO:</span>
            <input type="text" id="mail-composer-bcc" placeholder="copiaoculta@empresa.com" style="flex:1; border:none; background:transparent; font-size:0.88rem; color:var(--text-primary); outline:none; padding:0.3rem 0;" />
            <button type="button" onclick="window.toggleMailField('bcc')" style="border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">✕</button>
          </div>

          <!-- Field: Cliente / Empresa -->
          <div style="display:flex; align-items:center; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:0.2rem;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">Cliente:</span>
            <input type="text" id="mail-composer-cliente" placeholder="Nombre de la Empresa o Cliente (ej. Concretos del Norte)" style="flex:1; border:none; background:transparent; font-size:0.88rem; color:var(--text-primary); outline:none; padding:0.3rem 0;" />
          </div>

          <!-- Field: Asunto (Subject) -->
          <div style="display:flex; align-items:center; font-size:0.85rem;">
            <span style="width:75px; font-weight:700; color:var(--text-muted);">Asunto:</span>
            <input type="text" id="mail-composer-subject" required placeholder="Agregar un asunto..." style="flex:1; border:none; background:transparent; font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:0.3rem 0;" />
          </div>

          <!-- Attachment chips container -->
          <div id="mail-composer-attachment-chips" style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.25rem;"></div>
        </div>

        <!-- Word-Style Formatting Ribbon Toolbar -->
        <div style="padding:0.4rem 0.8rem; background:var(--bg-hover); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap; font-size:0.8rem;">
          <!-- Undo / Redo -->
          <button type="button" title="Deshacer (Ctrl+Z)" onmousedown="event.preventDefault()" onclick="window.execWordCommand('undo')" style="padding:0.25rem 0.45rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="undo" style="width:13px; height:13px;"></i></button>
          <button type="button" title="Rehacer (Ctrl+Y)" onmousedown="event.preventDefault()" onclick="window.execWordCommand('redo')" style="padding:0.25rem 0.45rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="redo" style="width:13px; height:13px;"></i></button>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Font Family -->
          <select onchange="window.execWordCommand('fontName', this.value)" title="Fuente" style="padding:0.25rem 0.4rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.78rem; cursor:pointer; outline:none;">
            <option value="Segoe UI" selected>Segoe UI</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
          </select>

          <!-- Font Size -->
          <select onchange="window.execWordCommand('fontSize', this.value)" title="Tamaño de Fuente" style="padding:0.25rem 0.4rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.78rem; cursor:pointer; outline:none;">
            <option value="2">Pequeño (12px)</option>
            <option value="3" selected>Normal (14px)</option>
            <option value="4">Mediano (16px)</option>
            <option value="5">Grande (18px)</option>
            <option value="6">Título (24px)</option>
          </select>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Styles -->
          <button type="button" id="btn-word-bold" title="Negrita (Ctrl+B)" onmousedown="event.preventDefault()" onclick="window.execWordCommand('bold')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); font-weight:bold; cursor:pointer; font-size:0.8rem; transition:all 0.15s ease;">B</button>
          <button type="button" id="btn-word-italic" title="Cursiva (Ctrl+I)" onmousedown="event.preventDefault()" onclick="window.execWordCommand('italic')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); font-style:italic; cursor:pointer; font-size:0.8rem; transition:all 0.15s ease;">I</button>
          <button type="button" id="btn-word-underline" title="Subrayado (Ctrl+U)" onmousedown="event.preventDefault()" onclick="window.execWordCommand('underline')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); text-decoration:underline; cursor:pointer; font-size:0.8rem; transition:all 0.15s ease;">U</button>
          <button type="button" id="btn-word-strikethrough" title="Tachado" onmousedown="event.preventDefault()" onclick="window.execWordCommand('strikethrough')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); text-decoration:line-through; cursor:pointer; font-size:0.8rem; transition:all 0.15s ease;">S</button>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Text Color -->
          <label title="Color de Texto" style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.2rem 0.4rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.75rem;">
            <i data-lucide="palette" style="width:13px; height:13px; color:var(--text-secondary);"></i> <input type="color" onchange="window.execWordCommand('foreColor', this.value)" style="width:16px; height:16px; border:none; padding:0; background:transparent; cursor:pointer;" value="#0f172a" />
          </label>

          <!-- Highlight Color -->
          <label title="Color de Resaltador" style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.2rem 0.4rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.75rem;">
            <i data-lucide="highlighter" style="width:13px; height:13px; color:var(--text-secondary);"></i> <input type="color" onchange="window.execWordCommand('backColor', this.value)" style="width:16px; height:16px; border:none; padding:0; background:transparent; cursor:pointer;" value="#fef08a" />
          </label>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Alignments -->
          <button type="button" id="btn-word-justifyLeft" title="Izquierda" onmousedown="event.preventDefault()" onclick="window.execWordCommand('justifyLeft')" style="padding:0.25rem 0.45rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s ease;"><i data-lucide="align-left" style="width:13px; height:13px;"></i></button>
          <button type="button" id="btn-word-justifyCenter" title="Centrar" onmousedown="event.preventDefault()" onclick="window.execWordCommand('justifyCenter')" style="padding:0.25rem 0.45rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s ease;"><i data-lucide="align-center" style="width:13px; height:13px;"></i></button>
          <button type="button" id="btn-word-justifyRight" title="Derecha" onmousedown="event.preventDefault()" onclick="window.execWordCommand('justifyRight')" style="padding:0.25rem 0.45rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s ease;"><i data-lucide="align-right" style="width:13px; height:13px;"></i></button>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Lists -->
          <button type="button" id="btn-word-insertUnorderedList" title="Lista con Viñetas" onmousedown="event.preventDefault()" onclick="window.execWordCommand('insertUnorderedList')" style="padding:0.25rem 0.55rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:0.25rem; transition:all 0.15s ease;"><i data-lucide="list" style="width:13px; height:13px;"></i> Viñetas</button>
          <button type="button" id="btn-word-insertOrderedList" title="Lista Numerada" onmousedown="event.preventDefault()" onclick="window.execWordCommand('insertOrderedList')" style="padding:0.25rem 0.55rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:0.25rem; transition:all 0.15s ease;"><i data-lucide="list-ordered" style="width:13px; height:13px;"></i> Números</button>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Link & Table & Format Clear -->
          <button type="button" title="Insertar Enlace Web" onmousedown="event.preventDefault()" onclick="window.formatMailBody('link')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.78rem; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="link" style="width:13px; height:13px;"></i> Enlace</button>
          <button type="button" title="Insertar Tabla" onmousedown="event.preventDefault()" onclick="window.execWordCommand('insertTable')" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.78rem; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="table" style="width:13px; height:13px;"></i> Tabla</button>

          <!-- Table Tools Dropdown -->
          <div style="position:relative; display:inline-block;">
            <button type="button" id="btn-word-table-tools" title="Herramientas y Edición de Tabla" onmousedown="event.preventDefault()" onclick="window.toggleMenuHerramientasTabla()" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; font-size:0.78rem; display:inline-flex; align-items:center; gap:0.25rem;">
              <i data-lucide="table-properties" style="width:13px; height:13px;"></i> Edición de Tabla <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
            </button>

            <div id="dropdown-menu-herramientas-tabla" style="display:none; position:absolute; top:100%; left:0; margin-top:4px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:1000; min-width:210px; padding:0.3rem 0; font-size:0.78rem;">
              <div style="padding:0.3rem 0.6rem; font-weight:700; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; border-bottom:1px solid var(--border);">Celdas</div>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.combinarCeldasTabla(); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="combine" style="width:13px; height:13px;"></i> Combinar Celdas
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.dividirCeldaTabla(); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="split" style="width:13px; height:13px;"></i> Dividir Celda
              </button>
              <label style="padding:0.4rem 0.75rem; display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-size:0.78rem; color:var(--text-primary);">
                <span style="display:inline-flex; align-items:center; gap:0.5rem;"><i data-lucide="paint-bucket" style="width:13px; height:13px;"></i> Color de Fondo</span>
                <input type="color" onchange="window.cambiarColorCeldaTabla(this.value); window.toggleMenuHerramientasTabla(false);" style="width:18px; height:18px; border:none; padding:0; background:transparent; cursor:pointer;" value="#f8fafc" />
              </label>

              <div style="padding:0.3rem 0.6rem; font-weight:700; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; border-top:1px solid var(--border); border-bottom:1px solid var(--border); margin-top:0.2rem;">Filas y Columnas</div>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.insertarFilaTabla('arriba'); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="arrow-up" style="width:13px; height:13px;"></i> Insertar Fila Arriba
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.insertarFilaTabla('abajo'); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="arrow-down" style="width:13px; height:13px;"></i> Insertar Fila Abajo
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.insertarColumnaTabla('izquierda'); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="arrow-left" style="width:13px; height:13px;"></i> Insertar Col. Izquierda
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.insertarColumnaTabla('derecha'); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="arrow-right" style="width:13px; height:13px;"></i> Insertar Col. Derecha
              </button>

              <div style="padding:0.3rem 0.6rem; font-weight:700; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; border-top:1px solid var(--border); border-bottom:1px solid var(--border); margin-top:0.2rem;">Eliminar</div>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.eliminarFilaTabla(); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="rows" style="width:13px; height:13px; color:#ef4444;"></i> Eliminar Fila
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.eliminarColumnaTabla(); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="columns" style="width:13px; height:13px; color:#ef4444;"></i> Eliminar Columna
              </button>
              <button type="button" onmousedown="event.preventDefault()" onclick="window.eliminarTablaCompleta(); window.toggleMenuHerramientasTabla(false);" style="width:100%; text-align:left; padding:0.4rem 0.75rem; border:none; background:transparent; color:#ef4444; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
                <i data-lucide="trash" style="width:13px; height:13px; color:#ef4444;"></i> Eliminar Tabla Completa
              </button>
            </div>
          </div>

          <span style="width:1px; height:18px; background:var(--border); margin:0 0.15rem;"></span>

          <!-- Eurorep Logo Signature Button -->
          <button type="button" title="Insertar Pie de Firma Oficial Eurorep" onmousedown="event.preventDefault()" onclick="window.insertarFirmaOficialEurorep()" style="padding:0.25rem 0.65rem; border-radius:4px; border:1px solid rgba(232, 130, 12, 0.3); background:rgba(232, 130, 12, 0.12); color:var(--accent); font-weight:600; cursor:pointer; font-size:0.78rem; display:inline-flex; align-items:center; gap:0.3rem;">
            <i data-lucide="file-signature" style="width:13px; height:13px;"></i> Firma Oficial Eurorep
          </button>
        </div>

        <!-- Message Body Area (WYSIWYG Rich Editor Container) -->
        <div style="flex:1; padding:1rem 1.25rem; display:flex; flex-direction:column; background:var(--bg-primary); overflow:hidden;">
          <div id="mail-composer-body" contenteditable="true" style="width:100%; flex:1; border:none; background:transparent; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:0.9rem; line-height:1.6; color:var(--text-primary); outline:none; overflow-y:auto; padding:0.25rem 0;" placeholder="Escribe el cuerpo del correo aquí..."></div>
        </div>
      </form>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  const bodyElem = document.getElementById('mail-composer-body');
  if (bodyElem) {
    ['keyup', 'mouseup', 'click', 'focus', 'input', 'select'].forEach(evt => {
      bodyElem.addEventListener(evt, window.actualizarEstadoBotonesWord);
    });
  }
};

async function enviarCorreoManualSoporte(event) {
  if (event) event.preventDefault();
  
  const to = document.getElementById('mail-composer-to')?.value.trim();
  const cc = document.getElementById('mail-composer-cc')?.value.trim() || '';
  const bcc = document.getElementById('mail-composer-bcc')?.value.trim() || '';
  const clienteName = document.getElementById('mail-composer-cliente')?.value.trim();
  const subject = document.getElementById('mail-composer-subject')?.value.trim();
  const bodyElem = document.getElementById('mail-composer-body');
  const rawBody = bodyElem?.isContentEditable ? bodyElem.innerHTML : (bodyElem?.value || '');
  const textBody = bodyElem?.isContentEditable ? bodyElem.innerText.trim() : rawBody.trim();
  const btn = document.getElementById('btn-send-manual-mail');
  const rawAttachments = window._currentMailAttachments || [];

  if (!to || !subject || (!rawBody && !textBody)) {
    mostrarNotificacion('Por favor completa los campos obligatorios del correo.', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:14px; height:14px;"></i> Enviando...`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    let token = '';
    if (window.supabaseClient && window.supabaseClient.auth) {
      try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        token = sessionData?.session?.access_token || '';
      } catch (authErr) {}
    }

    const formattedBody = rawBody.includes('<') ? rawBody : rawBody.replace(/\n/g, '<br>');
    const htmlPayload = window.obtenerHtmlPlantillaProfesional ? window.obtenerHtmlPlantillaProfesional(formattedBody) : formattedBody;

    const payload = {
      to: to,
      subject: subject,
      htmlBody: htmlPayload
    };
    if (cc) payload.cc = cc;
    if (bcc) payload.bcc = bcc;
    if (rawAttachments.length > 0) {
      payload.attachments = rawAttachments.map(a => ({
        filename: a.filename,
        content: a.content,
        encoding: 'base64'
      }));
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Sapi-Client-Token': 'SapiSecuredClientToken'
      },
      body: JSON.stringify(payload)
    });

    const isOk = response.ok;
    const logEntry = {
      id: 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      tipo: 'enviado',
      de: 'Ptalctes@eurorep.mx',
      para: to,
      cc: cc,
      bcc: bcc,
      cliente: clienteName || 'Cliente',
      asunto: subject,
      cuerpo: body,
      htmlBody: htmlPayload,
      fecha: new Date().toISOString(),
      evento: 'Envío Directo',
      regla: 'Manual Soporte',
      estatus: isOk ? 'Enviado' : 'Fallido',
      archivos: rawAttachments.map(a => a.filename)
    };

    window.registrarLogEmail(logEntry);

    if (isOk) {
      mostrarNotificacion('Correo enviado con éxito desde Ptalctes@eurorep.mx', 'success');
      isComposingEmail = false;
      window._currentMailAttachments = [];
      activeEmailLogId = logEntry.id;
    } else {
      mostrarNotificacion('Error al enviar correo. Se registró el intento en la bandeja.', 'error');
    }
  } catch (err) {
    console.error('Error enviando correo manual:', err);
    mostrarNotificacion('Error al conectar con servidor de correos: ' + (err.message || err), 'error');
  } finally {
    if (btn) btn.disabled = false;
    window.renderChatSoporteEmpresa();
  }
};

function seleccionarChatTicket(ticketId) {
  activeChatTicketId = ticketId;
  window.renderChatSoporteEmpresa();
};

function renderChatActivePane(t) {
  const pane = document.getElementById('chat-active-pane');
  if (!pane) return;

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const currentUserName = currentUser ? currentUser.nombre : 'Soporte';

  const listHtml = (t.comentariosClientes && t.comentariosClientes.length > 0)
    ? t.comentariosClientes.map(c => {
        const isClient = c.usuario !== currentUserName && !usuarios.some(u => u.nombre === c.usuario);
        const alignStyle = !isClient
          ? 'align-self: flex-end; background: rgba(232, 130, 12, 0.08); border-left: 3px solid var(--accent);'
          : 'align-self: flex-start; background: var(--bg-hover); border-left: 3px solid var(--border);';
        
        return `
          <div style="max-width: 85%; padding: 0.6rem 0.8rem; border-radius: 8px; box-shadow: var(--shadow-sm); ${alignStyle}">
            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; align-items: center;">
              <span style="font-weight: 700; font-size: 0.75rem; color: ${!isClient ? 'var(--accent)' : 'var(--blue)'};">${c.usuario}</span>
              <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${formatFechaHoraAmigable(c.fecha)}</span>
            </div>
            <div style="font-size: 0.85rem; white-space: pre-wrap; color: var(--text-primary); line-height: 1.35; font-family: inherit;">${c.texto}</div>
          </div>
        `;
      }).join('')
    : `<div style="text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.85rem; padding: 2rem 0;">No hay mensajes registrados. Escribe una respuesta abajo para iniciar.</div>`;

  pane.innerHTML = `
    <!-- Header -->
    <div style="padding:1rem; border-bottom:1px solid var(--border); background:var(--bg-hover); display:flex; justify-content:space-between; align-items:center;">
      <div style="text-align:left;">
        <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin:0;">${t.cliente || 'Cliente'}</h4>
        <span style="font-size:0.75rem; color:var(--text-secondary);">Canal de Soporte General</span>
      </div>
      <button class="btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem; min-height:auto;" onclick="verDetalleTicket('${t.id}')">
        <i data-lucide="eye" style="width:13px; height:13px; vertical-align:middle; margin-right:2px;"></i> Ver Ficha Ticket
      </button>
    </div>
    
    <!-- Messages Body -->
    <div id="support-general-chat-messages-container" style="flex:1; overflow-y:auto; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem; background:var(--bg-primary); text-align:left;">
      ${listHtml}
    </div>
    
    <!-- Input Footer -->
    <div style="padding:1rem; border-top:1px solid var(--border); background:var(--bg-hover); display:flex; gap:0.5rem; align-items:stretch;">
      <textarea id="chat-new-general-support-msg" placeholder="Escribe un mensaje para el cliente..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.enviarMensajeSoporteEmpresa('${t.id}'); }"></textarea>
      <button type="button" class="btn-primary" onclick="window.enviarMensajeSoporteEmpresa('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1.25rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
        <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
      </button>
    </div>
  `;

  // Scroll to bottom
  const container = document.getElementById('support-general-chat-messages-container');
  if (container) container.scrollTop = container.scrollHeight;

  if (window.lucide) lucide.createIcons();
};

async function enviarMensajeSoporteEmpresa(ticketId) {
  const textarea = document.getElementById('chat-new-general-support-msg');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const userName = currentUser ? currentUser.nombre : 'Soporte';

  const nuevoMensaje = {
    usuario: userName,
    fecha: new Date().toISOString(),
    texto: text
  };

  if (!t.comentariosClientes) {
    t.comentariosClientes = [];
  }

  if (window.supabaseClient) {
    try {
      const tClone = JSON.parse(JSON.stringify(t));
      if (!tClone.comentariosClientes) tClone.comentariosClientes = [];
      tClone.comentariosClientes.push(nuevoMensaje);
      
      await window.pushToSupabase('tickets', tClone);
      
      t.comentariosClientes.push(nuevoMensaje);
      safeSetJSON('sapi_tickets', tickets);
      mostrarNotificacion('Mensaje enviado al cliente.', 'success');
      
      textarea.value = '';
      window.renderChatSoporteEmpresa();
    } catch (err) {
      console.error('Error al guardar mensaje en Supabase:', err);
      mostrarNotificacion('Error al enviar el mensaje. Verifica tus permisos o conexión.', 'error');
    }
  } else {
    t.comentariosClientes.push(nuevoMensaje);
    safeSetJSON('sapi_tickets', tickets);
    mostrarNotificacion('Mensaje guardado localmente.', 'success');
    textarea.value = '';
    window.renderChatSoporteEmpresa();
  }
};


if (typeof window !== "undefined") {
  window.activeChatTicketId = typeof activeChatTicketId !== "undefined" ? activeChatTicketId : null;
  window.activeSoporteTab = typeof activeSoporteTab !== "undefined" ? activeSoporteTab : "chats";
  window.activeEmailLogId = typeof activeEmailLogId !== "undefined" ? activeEmailLogId : null;
  window.isComposingEmail = typeof isComposingEmail !== "undefined" ? isComposingEmail : false;
  window.activeEmailFilter = typeof activeEmailFilter !== "undefined" ? activeEmailFilter : "todos";
  window.mailSearchQuery = typeof mailSearchQuery !== "undefined" ? mailSearchQuery : "";
  window._linkModalCallback = typeof _linkModalCallback !== "undefined" ? _linkModalCallback : null;
  window.formatMontoConComas = formatMontoConComas;
  window.switchSoporteTab = switchSoporteTab;
  window.setMailFilter = setMailFilter;
  window.registrarLogEmail = registrarLogEmail;
  window.renderChatSoporteEmpresa = renderChatSoporteEmpresa;
  window.setMailSearch = setMailSearch;
  window.esCorreoValidoPtalctes = esCorreoValidoPtalctes;
  window.obtenerEmailLogsSoporte = obtenerEmailLogsSoporte;
  window.iniciarSesionMicrosoftAzureMail = iniciarSesionMicrosoftAzureMail;
  window.sincronizarCorreosAzure = sincronizarCorreosAzure;
  window.renderBandejaCorreoEmpresa = renderBandejaCorreoEmpresa;
  window.renderCorreoDetailPane = renderCorreoDetailPane;
  window.responderCorreoSoporte = responderCorreoSoporte;
  window.reenviarCorreoSoporte = reenviarCorreoSoporte;
  window.copiarCuerpoCorreo = copiarCuerpoCorreo;
  window.abrirTicketDesdeCorreo = abrirTicketDesdeCorreo;
  window.abrirOrdenDesdeCorreo = abrirOrdenDesdeCorreo;
  window.obtenerContenidoAdjuntoMicrosoftGraph = obtenerContenidoAdjuntoMicrosoftGraph;
  window.previsualizarAdjuntoMicrosoftGraph = previsualizarAdjuntoMicrosoftGraph;
  window.descargarAdjuntoMicrosoftGraph = descargarAdjuntoMicrosoftGraph;
  window.enviarRespuestaRapidaCorreo = enviarRespuestaRapidaCorreo;
  window.renderCorreoEmptyPane = renderCorreoEmptyPane;
  window.seleccionarEmailLog = seleccionarEmailLog;
  window.redactarNuevoCorreoSoporte = redactarNuevoCorreoSoporte;
  window.toggleMailField = toggleMailField;
  window.manejarArchivosAdjuntosCorreo = manejarArchivosAdjuntosCorreo;
  window.removerAdjuntoCorreo = removerAdjuntoCorreo;
  window.renderMailAttachmentChips = renderMailAttachmentChips;
  window.aplicarPlantillaEnCompositor = aplicarPlantillaEnCompositor;
  window.abrirModalInsertarLink = abrirModalInsertarLink;
  window.confirmarModalInsertarLink = confirmarModalInsertarLink;
  window.abrirModalInsertarTabla = abrirModalInsertarTabla;
  window.confirmarModalInsertarTabla = confirmarModalInsertarTabla;
  window.formatMailBody = formatMailBody;
  window.obtenerHtmlFirmaOficialEurorep = obtenerHtmlFirmaOficialEurorep;
  window.insertarFirmaOficialEurorep = insertarFirmaOficialEurorep;
  window.actualizarEstadoBotonesWord = actualizarEstadoBotonesWord;
  window.getMailComposerSelectedCell = getMailComposerSelectedCell;
  window.toggleMenuHerramientasTabla = toggleMenuHerramientasTabla;
  window.cambiarColorCeldaTabla = cambiarColorCeldaTabla;
  window.combinarCeldasTabla = combinarCeldasTabla;
  window.dividirCeldaTabla = dividirCeldaTabla;
  window.insertarFilaTabla = insertarFilaTabla;
  window.insertarColumnaTabla = insertarColumnaTabla;
  window.eliminarFilaTabla = eliminarFilaTabla;
  window.eliminarColumnaTabla = eliminarColumnaTabla;
  window.eliminarTablaCompleta = eliminarTablaCompleta;
  window.execWordCommand = execWordCommand;
  window.renderCorreoComposerPane = renderCorreoComposerPane;
  window.enviarCorreoManualSoporte = enviarCorreoManualSoporte;
  window.seleccionarChatTicket = seleccionarChatTicket;
  window.renderChatActivePane = renderChatActivePane;
  window.enviarMensajeSoporteEmpresa = enviarMensajeSoporteEmpresa;
}

