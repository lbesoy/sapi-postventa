/**
 * Módulo de Detalle, Comentarios y Adjuntos de Tickets - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { normStr, formatFechaHoraAmigable, escapeHTML, esUsuarioSuperadmin } from "../utils.js";

function safeEsUsuarioSuperadmin() {
  if (typeof esUsuarioSuperadmin === 'function') return esUsuarioSuperadmin();
  if (typeof window !== 'undefined' && typeof window.esUsuarioSuperadmin === 'function') return window.esUsuarioSuperadmin();
  let sess = null;
  if (typeof currentSession !== 'undefined' && currentSession) sess = currentSession;
  else if (typeof window !== 'undefined' && window.currentSession) sess = window.currentSession;
  else if (typeof safeGetJSON === 'function') sess = safeGetJSON('eurorep_session', null);
  else if (typeof localStorage !== 'undefined') {
    try { sess = JSON.parse(localStorage.getItem('eurorep_session') || 'null'); } catch (e) {}
  }
  if (!sess) return false;
  const viewMode = String(sess.viewMode || '').toLowerCase().trim();
  const realRol = String(sess.realRol || '').toLowerCase().trim();
  const userId = String(sess.userId || '').toLowerCase().trim();
  if (viewMode !== 'superadmin') return false;
  const usersList = (typeof window !== 'undefined' && Array.isArray(window.usuarios))
    ? window.usuarios
    : ((typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : (typeof safeGetJSON === 'function' ? safeGetJSON('eurorep_usuarios', []) : []));
  if (Array.isArray(usersList) && userId) {
    const userInDb = usersList.find(u => u && u.id === userId);
    if (userInDb && userInDb.rol) {
      const dbRol = String(userInDb.rol).toLowerCase().trim();
      if (dbRol !== 'superadmin') return false;
    }
  }
  if (['admin', 'supervisor', 'tecnico', 'empresa', 'cliente', 'cliente-consultor', 'consulta'].includes(realRol)) {
    return false;
  }
  return (viewMode === 'superadmin' && (realRol === 'superadmin' || userId === 'superadmin' || !realRol));
}


function safeNorm(s) {
  if (!s) return "";
  if (typeof normStr === "function") return normStr(s);
  if (typeof window !== "undefined" && typeof window.normStr === "function") return window.normStr(s);
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function safeFormatFechaHoraAmigable(dateStr) {
  if (typeof formatFechaHoraAmigable === "function") return formatFechaHoraAmigable(dateStr);
  if (typeof window !== "undefined" && typeof window.formatFechaHoraAmigable === "function") return window.formatFechaHoraAmigable(dateStr);
  return String(dateStr || "");
}

function safeEscapeHTML(str) {
  if (typeof escapeHTML === "function") return escapeHTML(str);
  if (typeof window !== "undefined" && typeof window.escapeHTML === "function") return window.escapeHTML(str);
  return String(str || "").replace(/[&<>'"]/g, tag => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[tag] || tag));
}

// Resiliencia para variables maestras de memoria
if (typeof window !== "undefined") {
  if (typeof window.tickets === "undefined") window.tickets = [];
  if (typeof window.ordenes === "undefined") window.ordenes = [];
  if (typeof window.usuarios === "undefined") window.usuarios = [];
  if (typeof window.maquinaria === "undefined") window.maquinaria = [];
  if (typeof window.clientes === "undefined") window.clientes = [];
  if (typeof window.currentSession === "undefined") window.currentSession = { userId: "", viewMode: "consulta" };
}

// ===== COMENTARIOS INTERNOS Y EXTERNOS HELPER FUNCTIONS =====
function renderComentariosInternosHtml(t) {
  const isClientView = ['empresa', 'cliente', 'cliente-consultor'].includes(window.currentSession?.viewMode);
  
  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const currentUserName = currentUser ? currentUser.nombre : '';

  // 1. Renderizar lista de comentarios internos (para staff)
  let listInternosHtml = '';
  if (!isClientView) {
    listInternosHtml = (t.comentariosInternos && t.comentariosInternos.length > 0)
      ? t.comentariosInternos.map(c => {
          const isMe = c.usuario === currentUserName;
          const alignStyle = isMe
            ? 'align-self: flex-end; background: rgba(232, 130, 12, 0.08); border-left: 3px solid var(--accent);'
            : 'align-self: flex-start; background: var(--bg-card); border-left: 3px solid var(--border);';
          
          const lectores = Array.isArray(c.leidoPor)
            ? c.leidoPor.map(l => {
                if (typeof l === 'string') return l;
                if (l && l.usuario) {
                  const fStr = l.fecha ? formatFechaHoraAmigable(l.fecha) : '';
                  return fStr ? `${l.usuario} (${fStr})` : l.usuario;
                }
                return null;
              }).filter(Boolean)
            : [];
          
          const otrosLectores = lectores.filter(l => !l.startsWith(c.usuario));
          let leidoHtml = '';
          if (otrosLectores.length > 0) {
            leidoHtml = `
              <div style="margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: #10b981; font-weight: 500;">
                <i data-lucide="check-check" style="width: 12px; height: 12px; color: #10b981; flex-shrink:0;"></i>
                <span>Leído por: <strong style="color: var(--text-primary);">${otrosLectores.join(', ')}</strong></span>
              </div>
            `;
          } else {
            leidoHtml = `
              <div style="margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: var(--text-muted); opacity: 0.7;">
                <i data-lucide="check" style="width: 12px; height: 12px; flex-shrink:0;"></i>
                <span>No leído aún por otros</span>
              </div>
            `;
          }

          return `
            <div style="max-width: 85%; padding: 0.6rem 0.8rem; border-radius: 8px; box-shadow: var(--shadow-sm); ${alignStyle}">
              <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; align-items: center;">
                <span style="font-weight: 700; font-size: 0.75rem; color: ${isMe ? 'var(--accent)' : 'var(--text-primary)'};">${c.usuario}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${formatFechaHoraAmigable(c.fecha)}</span>
              </div>
              <div style="font-size: 0.85rem; white-space: pre-wrap; color: var(--text-primary); line-height: 1.35; font-family: inherit;">${c.texto}</div>
              ${leidoHtml}
            </div>
          `;
        }).join('')
      : `<div style="text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.8rem; padding: 1.5rem 0;">No hay comentarios de seguimiento registrados en este ticket.</div>`;
  }

  // 2. Renderizar lista de comentarios externos (clientes)
  const listClientesHtml = (t.comentariosClientes && t.comentariosClientes.length > 0)
    ? t.comentariosClientes.map(c => {
        const isMe = c.usuario === currentUserName || c.usuario === 'Soporte' || c.usuario === 'EuroRep';
        const alignStyle = isMe
          ? 'align-self: flex-end; background: rgba(232, 130, 12, 0.08); border-left: 3px solid var(--accent);'
          : 'align-self: flex-start; background: var(--bg-card); border-left: 3px solid var(--border);';
        
        return `
          <div style="max-width: 85%; padding: 0.6rem 0.8rem; border-radius: 8px; box-shadow: var(--shadow-sm); ${alignStyle}">
            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; align-items: center;">
              <span style="font-weight: 700; font-size: 0.75rem; color: ${isMe ? 'var(--accent)' : 'var(--text-primary)'};">${c.usuario}</span>
              <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${formatFechaHoraAmigable(c.fecha)}</span>
            </div>
            <div style="font-size: 0.85rem; white-space: pre-wrap; color: var(--text-primary); line-height: 1.35; font-family: inherit;">${c.texto}</div>
          </div>
        `;
      }).join('')
    : `<div style="text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.8rem; padding: 1.5rem 0;">No hay comentarios de cliente registrados en este ticket.</div>`;

  if (isClientView) {
    // Si es vista cliente, mostrar únicamente los externos
    return `
      <div class="detalle-section" style="border-top:1px dashed var(--border); padding-top:1.25rem; margin-top:1.5rem;">
        <div class="detalle-section-title" style="display:flex; align-items:center; gap:0.5rem; text-transform: uppercase;"><i data-lucide="message-square" style="width:16px;height:16px;"></i> Comentarios y Mensajes</div>
        
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listClientesHtml}
        </div>

        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment-externo" placeholder="Escribe un mensaje para soporte..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioExterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>
    `;
  }

  // Vista staff: Mostrar interfaz con pestañas
  const activeTab = window._activeCommentTab || 'internos';
  const isInternosActive = activeTab === 'internos';
  
  const tabInternosBtnStyle = isInternosActive
    ? 'color: var(--accent); border-bottom: 2px solid var(--accent); font-weight: 700;'
    : 'color: var(--text-muted); border-bottom: 2px solid transparent; font-weight: 600;';
    
  const tabExternosBtnStyle = !isInternosActive
    ? 'color: var(--accent); border-bottom: 2px solid var(--accent); font-weight: 700;'
    : 'color: var(--text-muted); border-bottom: 2px solid transparent; font-weight: 600;';

  const containerInternosDisplay = isInternosActive ? 'block' : 'none';
  const containerExternosDisplay = !isInternosActive ? 'block' : 'none';

  return `
    <div class="detalle-section" style="border-top:1px dashed var(--border); padding-top:1.25rem; margin-top:1.5rem;">
      <!-- Cabecera de Pestañas -->
      <div class="comments-tab-header" style="display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1rem; gap: 1rem;">
        <button type="button" id="tab-btn-internos" onclick="window.switchCommentTab('internos')" style="background: none; border: none; padding: 0.5rem 1rem; ${tabInternosBtnStyle} font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem; outline: none;">
          <i data-lucide="lock" style="width:14px; height:14px;"></i> Comentarios Internos
        </button>
        <button type="button" id="tab-btn-externos" onclick="window.switchCommentTab('externos')" style="background: none; border: none; padding: 0.5rem 1rem; ${tabExternosBtnStyle} font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem; outline: none;">
          <i data-lucide="message-square" style="width:14px; height:14px;"></i> Visibles para Cliente
        </button>
      </div>

      <!-- Contenedor Comentarios Internos -->
      <div id="comments-container-internos" style="display: ${containerInternosDisplay};">
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listInternosHtml}
        </div>
        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment" placeholder="Escribe un comentario interno..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioInterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>

      <!-- Contenedor Comentarios Externos -->
      <div id="comments-container-externos" style="display: ${containerExternosDisplay};">
        <div class="chat-container" style="max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          ${listClientesHtml}
        </div>
        <div class="chat-input-wrapper" style="display: flex; gap: 0.5rem; align-items: stretch;">
          <textarea id="chat-new-comment-externo" placeholder="Escribe un comentario visible para el cliente..." rows="2" style="flex: 1; resize: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button type="button" class="btn-primary" onclick="window.agregarComentarioExterno('${t.id}')" style="background: var(--accent); border-color: var(--accent); border-radius: 8px; padding: 0 1rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; color: white;">
            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Enviar
          </button>
        </div>
      </div>
    </div>
  `;
};

function switchCommentTab(tab) {
  if (typeof document === 'undefined') return;
  const btnInternos = document.getElementById('tab-btn-internos');
  const btnExternos = document.getElementById('tab-btn-externos');
  const contInternos = document.getElementById('comments-container-internos');
  const contExternos = document.getElementById('comments-container-externos');
  
  if (!btnInternos || !btnExternos || !contInternos || !contExternos) return;
  
  if (tab === 'internos') {
    btnInternos.style.color = 'var(--accent)';
    btnInternos.style.borderBottom = '2px solid var(--accent)';
    btnInternos.style.fontWeight = '700';
    
    btnExternos.style.color = 'var(--text-muted)';
    btnExternos.style.borderBottom = '2px solid transparent';
    btnExternos.style.fontWeight = '600';
    
    contInternos.style.display = 'block';
    contExternos.style.display = 'none';
    window._activeCommentTab = 'internos';
  } else {
    btnExternos.style.color = 'var(--accent)';
    btnExternos.style.borderBottom = '2px solid var(--accent)';
    btnExternos.style.fontWeight = '700';
    
    btnInternos.style.color = 'var(--text-muted)';
    btnInternos.style.borderBottom = '2px solid transparent';
    btnInternos.style.fontWeight = '600';
    
    contInternos.style.display = 'none';
    contExternos.style.display = 'block';
    window._activeCommentTab = 'externos';
  }
};

async function agregarComentarioInterno(ticketId) {
  if (typeof document === 'undefined') return;
  const textarea = document.getElementById('chat-new-comment');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const userName = currentUser ? currentUser.nombre : 'Usuario';

  const now = new Date().toISOString();
  const nuevoComentario = {
    usuario: userName,
    fecha: now,
    texto: text
  };

  if (!t.comentariosInternos) {
    t.comentariosInternos = [];
  }
  t.fechaModificacion = now;
  t.modificadoPor = userName;

  if (window.supabaseClient) {
    try {
      const tClone = JSON.parse(JSON.stringify(t));
      if (!tClone.comentariosInternos) tClone.comentariosInternos = [];
      tClone.comentariosInternos.push(nuevoComentario);
      tClone.fechaModificacion = now;
      tClone.modificadoPor = userName;
      
      await window.pushToSupabase('tickets', tClone);
      
      t.comentariosInternos.push(nuevoComentario);
      safeSetJSON('sapi_tickets', tickets);
      if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
      mostrarNotificacion('Comentario agregado.', 'success');
      
      if (typeof window.ejecutarAutomatizacion === 'function') {
        window.ejecutarAutomatizacion('Comentario guardado en chat del ticket', {
          email: t.clienteEmail || t.solicitanteEmail || '',
          nombre_cliente: t.cliente || '',
          folio_ticket: t.folio || t.id,
          comentario: nuevoComentario.texto,
          link: window.location.origin + '/cliente'
        });
      }

      verDetalleTicket(ticketId);
    } catch (err) {
      console.error('Error al guardar comentario en Supabase:', err);
      mostrarNotificacion('Error al guardar el comentario. Verifica tus permisos o conexión.', 'error');
    }
  } else {
    t.comentariosInternos.push(nuevoComentario);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof window.sincronizarNotificacionesInternas === 'function') window.sincronizarNotificacionesInternas();
    mostrarNotificacion('Comentario guardado localmente.', 'success');
    
    if (typeof window.ejecutarAutomatizacion === 'function') {
      window.ejecutarAutomatizacion('Comentario guardado en chat del ticket', {
        email: t.clienteEmail || t.solicitanteEmail || '',
        nombre_cliente: t.cliente || '',
        folio_ticket: t.folio || t.id,
        comentario: nuevoComentario.texto,
        link: window.location.origin + '/cliente'
      });
    }

    verDetalleTicket(ticketId);
  }
};

async function agregarComentarioExterno(ticketId) {
  if (typeof document === 'undefined') return;
  const textarea = document.getElementById('chat-new-comment-externo');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Ticket no encontrado.', 'error');
    } else {
      alert('Ticket no encontrado.');
    }
    return;
  }

  const currentUser = usuarios.find(u => u && u.id === window.currentSession?.userId);
  const userName = currentUser ? currentUser.nombre : (window.nombreEmpresaLogged || window.currentSession?.nombre || 'Soporte');

  const now = new Date().toISOString();
  const nuevoMensaje = {
    usuario: userName,
    fecha: now,
    texto: text
  };

  if (!t.comentariosClientes) {
    t.comentariosClientes = [];
  }
  t.fechaModificacion = now;
  t.modificadoPor = userName;

  if (window.supabaseClient) {
    try {
      const tClone = JSON.parse(JSON.stringify(t));
      if (!tClone.comentariosClientes) tClone.comentariosClientes = [];
      tClone.comentariosClientes.push(nuevoMensaje);
      tClone.fechaModificacion = now;
      tClone.modificadoPor = userName;
      
      await window.pushToSupabase('tickets', tClone);
      
      t.comentariosClientes.push(nuevoMensaje);
      safeSetJSON('sapi_tickets', tickets);
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Comentario externo enviado.', 'success');
      }
      
      if (typeof verDetalleTicket === 'function') {
        verDetalleTicket(ticketId);
      }
    } catch (err) {
      console.error('Error al guardar comentario en Supabase:', err);
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Error al guardar el comentario. Verifica tus permisos o conexión.', 'error');
      }
    }
  } else {
    t.comentariosClientes.push(nuevoMensaje);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Comentario guardado localmente.', 'success');
    }
    if (typeof verDetalleTicket === 'function') {
      verDetalleTicket(ticketId);
    }
  }
};



// ===== DETALLE TICKET =====
function verDetalleTicket(id) {
  if (typeof document === 'undefined') return;
  let t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x && (x.id === id || x.folio === id)) : null;
  if (!t) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const targetNorm = norm(id);
    const targetNum = String(id).replace(/[^0-9]/g, '');
    let pool = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? [...tickets] : [];
    if (typeof window !== 'undefined' && Array.isArray(window.tickets)) pool = pool.concat(window.tickets);
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      if (Array.isArray(local)) pool = pool.concat(local);
    } catch (e) {}
    t = pool.find(x => x && (x.id === id || x.folio === id || norm(x.folio || x.id) === targetNorm || (targetNum.length >= 4 && String(x.folio || '').replace(/[^0-9]/g, '') === targetNum)));
  }
  if (!t) {
    const navTickets = document.querySelector('.nav-item[data-view="tickets"]');
    if (navTickets) navTickets.click();
    setTimeout(() => {
      const searchInput = document.getElementById('search-tickets');
      if (searchInput) {
        searchInput.value = id;
        if (typeof renderTickets === 'function') renderTickets();
      }
    }, 150);
    return;
  }

  // Registrar lectura de comentarios internos por el usuario actual
  const currentUserObj = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios.find(u => u && u.id === window.currentSession?.userId) : null;
  const currentUserName = currentUserObj ? currentUserObj.nombre : '';

  if (currentUserName && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
    let modified = false;
    const nowIso = new Date().toISOString();
    t.comentariosInternos.forEach(c => {
      if (!c) return;
      if (!Array.isArray(c.leidoPor)) {
        c.leidoPor = [];
      }
      const yaLeido = c.leidoPor.some(l => (typeof l === 'string' ? l === currentUserName : l && l.usuario === currentUserName));
      if (!yaLeido) {
        c.leidoPor.push({
          usuario: currentUserName,
          fecha: nowIso
        });
        modified = true;
      }
    });

    if (modified) {
      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        window.pushToSupabase('tickets', t).catch(err => console.warn('[Sync] Error al actualizar lectura de comentarios:', err));
      }
      if (typeof window.sincronizarNotificacionesInternas === 'function') {
        window.sincronizarNotificacionesInternas();
      }
    }
  }

  const assocOrder = window.obtenerOrdenAsociadaTicket(t);
  const parentTicket = !assocOrder ? (typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null) : null;
  const isSuperadmin = safeEsUsuarioSuperadmin();
  const isDecisionLocked = ['si', 'aprobada', 'no', 'rechazada'].includes(String(t.cotAceptada || '').toLowerCase().trim());
  document.getElementById('ticket-detalle-title').textContent = `Ticket ${t.folio}`;

  const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '';
  const clienteDisplay = resolvedCli || t.cliente || (parentTicket && parentTicket.cliente ? `${parentTicket.cliente} <span style="font-size:0.75rem; color:var(--accent); font-weight:normal;">(Heredado de Ticket Origen ${parentTicket.folio || parentTicket.id})</span>` : (assocOrder && assocOrder.cliente ? `${assocOrder.cliente} <span style="font-size:0.75rem; color:#2563eb; font-weight:normal;">(Heredado de OS ${assocOrder.folio || assocOrder.id})</span>` : ''));
  const sitioDisplay = t.sitio || (parentTicket && parentTicket.sitio ? parentTicket.sitio : (assocOrder && (assocOrder.ubicacion || assocOrder.ubicacion_sitio) ? (assocOrder.ubicacion || assocOrder.ubicacion_sitio) : ''));
  const equipoDisplay = (t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo : ((parentTicket && parentTicket.equipo && parentTicket.equipo !== 'Otra / No registrada') ? `${parentTicket.equipo} <span style="font-size:0.75rem; color:var(--accent); font-weight:normal;">(Ticket Origen)</span>` : ((assocOrder && assocOrder.equipo) ? `${assocOrder.equipo} <span style="font-size:0.75rem; color:#2563eb; font-weight:normal;">(Orden de Servicio)</span>` : (t.equipo || '—')));

  const field = (label, val, fullWidth = false) => `
    <div class="detalle-field" ${fullWidth ? 'style="grid-column: 1 / -1;"' : ''}>
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;
  document.getElementById('ticket-detalle-body').innerHTML = `
    ${assocOrder ? `
    <div class="detalle-section" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%); border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 8px; padding: 0.85rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(37, 99, 235, 0.15); color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="file-text" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #2563eb;">Orden de Servicio Vinculada</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
            <span>${assocOrder.folio || assocOrder.id}</span>
            ${assocOrder.tipoServicio ? `<span class="badge" style="font-size: 0.68rem; background: var(--bg-card); border: 1px solid var(--border);">${assocOrder.tipoServicio}</span>` : ''}
            ${assocOrder.estado ? `<span class="badge badge-${String(assocOrder.estado).toLowerCase()}">${assocOrder.estado}</span>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
            ${assocOrder.cliente ? `<span style="margin-right: 8px;"><i data-lucide="building-2" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${assocOrder.cliente}</span>` : ''}
            ${assocOrder.equipo ? `<span><i data-lucide="wrench" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${assocOrder.equipo}</span>` : ''}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #2563eb; color: #ffffff; border: none;">
          <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Ver Orden de Servicio
        </button>
      </div>
    </div>
    ` : (parentTicket ? `
    <div class="detalle-section" style="background: linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(234, 88, 12, 0.03) 100%); border: 1px solid rgba(234, 88, 12, 0.25); border-radius: 8px; padding: 0.85rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(234, 88, 12, 0.15); color: #ea580c; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="ticket" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #ea580c;">Ticket de Origen Vinculado</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
            <span>${parentTicket.folio || parentTicket.id}</span>
            ${parentTicket.categoria ? `<span class="badge" style="font-size: 0.68rem; background: var(--bg-card); border: 1px solid var(--border);">${parentTicket.categoria}</span>` : ''}
            ${parentTicket.estado ? `<span class="badge badge-${badgeTicketEstado(parentTicket)}">${getTicketEstadoLabel(parentTicket)}</span>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
            ${parentTicket.asunto ? `<span>${parentTicket.asunto}</span>` : (parentTicket.cliente ? `<span>${parentTicket.cliente}</span>` : '')}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="verDetalleTicket('${parentTicket.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #ea580c; color: #ffffff; border: none;">
          <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Ver Ticket Origen
        </button>
      </div>
    </div>
    ` : (isSuperadmin ? `
    <div class="detalle-section" style="background: rgba(37, 99, 235, 0.04); border: 1px dashed rgba(37, 99, 235, 0.35); border-radius: 8px; padding: 0.75rem 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(37, 99, 235, 0.12); color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #2563eb;">Sin Orden de Servicio</div>
          <div style="font-size: 0.82rem; color: var(--text-secondary);">Este ticket no cuenta con una orden de servicio generada.</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-primary" onclick="forzarCrearOrdenServicio('${t.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.4rem 0.85rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 6px; background: #2563eb; color: #ffffff; border: none;">
          <i data-lucide="file-plus" style="width: 14px; height: 14px;"></i> Forzar Orden de Servicio
        </button>
      </div>
    </div>
    ` : ''))}
    <div class="detalle-section">
      <div class="detalle-section-title">Datos del Ticket</div>
      <div class="detalle-grid">
        ${field('Folio', t.folio)}
        ${assocOrder ? field('Orden de Servicio', `<a href="javascript:void(0)" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" style="color:#2563eb; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> ${assocOrder.folio || assocOrder.id} <i data-lucide="external-link" style="width:11px;height:11px;"></i></a>`) : (parentTicket ? field('Ticket Origen', `<a href="javascript:void(0)" onclick="verDetalleTicket('${parentTicket.id}')" style="color:#ea580c; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="ticket" style="width:13px;height:13px;"></i> ${parentTicket.folio || parentTicket.id} <i data-lucide="external-link" style="width:11px;height:11px;"></i></a>`) : '')}
        ${field('Fecha Creación', formatFechaHoraAmigable(t.fechaCreacion || t.fecha))}
        ${field('Última Modificación', formatFechaHoraAmigable(window.getTicketFechaModificacion ? window.getTicketFechaModificacion(t) : (t.fechaModificacion || t.fechaCreacion || t.fecha)))}
        ${field('Modificado por', window.getTicketModificadoPor ? window.getTicketModificadoPor(t) : (t.modificadoPor || t.creadoPor || '—'))}
        ${field('Asunto', `<strong style="color:var(--text-primary); font-size:0.95rem;">${t.asunto || '—'}</strong>`, true)}
        ${field('Cliente', clienteDisplay ? `${clienteDisplay}${sitioDisplay ? ` (Sitio: ${sitioDisplay})` : ''}` : '—')}
        ${field('Canal', t.canal ? ({correo:'Correo',whatsapp:'WhatsApp',telefono:'Llamada Tel.'}[t.canal]||t.canal) : '—')}
        ${field('Contacto', t.contacto)}
        ${field('Estado', `<span class="badge badge-${badgeTicketEstado(t)}">${getTicketEstadoLabel(t)}</span>`)}
        ${!['empresa', 'cliente', 'cliente-consultor'].includes(currentSession.viewMode) ? field('Prioridad', `<span class="badge badge-${(t.prioridad||'media').toLowerCase()}">${t.prioridad}</span>`) : ''}
        ${field('Solicitante', t.solicitante)}
        ${field('Creado por', (typeof window.resolverCreadorTicket === 'function' ? window.resolverCreadorTicket(t) : (t.creadoPor || t.creado_por)) || '—')}
        ${field('Área', t.area)}
        ${field('Categoría', t.categoria)}
        ${field('Asignado a', t.asignado)}
        ${field('Equipo / Máquina', equipoDisplay, true)}
      </div>
    </div>
    <div class="detalle-section">
      <div class="detalle-section-title">Descripción</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.descripcion||'—'}</div></div>
    </div>
    ${(t.notes || t.notas && currentSession.viewMode !== 'empresa') ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Notas Internas</div>
      <div class="detalle-field"><div class="detalle-value" style="white-space:pre-wrap;">${t.notas}</div></div>
    </div>` : ''}

    ${((t.pdfCotizacion && !t.cotizacionSAP) || t.foto || t.evidencia || (t.evidencias && (Array.isArray(t.evidencias) ? t.evidencias.length > 0 : Object.keys(t.evidencias).length > 0)) || (t.notas && String(t.notas).toLowerCase().includes('evidencia fotográfica'))) ? `
    <div class="detalle-section" id="section-detalle-evidencia-${t.id}">
      <div class="detalle-section-title" style="display:flex; align-items:center; gap:0.5rem; color:var(--accent);"><i data-lucide="camera"></i> Evidencia Fotográfica</div>
      <div class="detalle-field" style="display:flex; flex-direction:column; gap:0.5rem;">
        <div id="detalle-evidence-container-${t.id}" style="width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--border); background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; min-height:180px; max-height:380px; position:relative; padding:0.5rem;">
          <img id="detalle-evidence-img-${t.id}" src="${(t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') ? t.pdfCotizacion : (t.foto || t.evidencia || '')}" alt="Evidencia de Falla" style="max-width:100%; max-height:360px; object-fit:contain; border-radius:6px; cursor:pointer; display:${(t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') || t.foto || t.evidencia ? 'block' : 'none'}; box-shadow:0 4px 15px rgba(0,0,0,0.25);" onclick="window.previsualizarImagenCompleta(this.src, 'Evidencia Fotográfica - Ticket ${t.folio || ''}')" title="Clic para ver en pantalla completa" onerror="this.style.display='none'; const sec=document.getElementById('section-detalle-evidencia-${t.id}'); if(sec) sec.style.display='none';" />
          <span id="detalle-evidence-loading-${t.id}" style="font-size:0.82rem; color:var(--text-muted); display:${(!t.pdfCotizacion || t.pdfCotizacion === '__HAS_PDF__') && !t.foto && !t.evidencia ? 'inline-flex' : 'none'}; align-items:center; gap:6px;">
            <i data-lucide="loader" class="rotating" style="width:16px;height:16px;color:var(--accent);"></i> Cargando evidencia fotográfica...
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); padding:0 0.2rem;">
          <span><i data-lucide="maximize-2" style="width:12px;height:12px;vertical-align:middle;margin-right:3px;"></i> Haz clic en la imagen para ampliar en pantalla completa</span>
          <button type="button" onclick="window.abrirImagenEnPestana('${t.id}')" style="background:none; border:none; color:var(--accent); font-size:0.75rem; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="external-link" style="width:12px;height:12px;"></i> Abrir original</button>
        </div>
      </div>
    </div>
    ` : ''}

    ${t.estado === 'Cerrado' ? `
    <div class="detalle-section">
      <div class="detalle-section-title">Resolución Final</div>
      
      <!-- Elegant metadata cards -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
        <!-- SAP Card -->
        <div style="flex: 1; min-width: 150px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Cotización SAP</span>
          <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${t.cotizacionSAP || '—'}</span>
        </div>
        <!-- Monto Card -->
        <div style="flex: 1; min-width: 150px; background: linear-gradient(135deg, rgba(232, 130, 12, 0.08) 0%, rgba(232, 130, 12, 0.02) 100%); border: 1px solid rgba(232, 130, 12, 0.2); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--accent); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Monto Total</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent);">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</span>
        </div>
      </div>

      <div class="detalle-grid">
        ${t.pdfCotizacion ? field('PDF Cotización', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : ''}
        ${t.cotAceptada ? field('Resultado', t.cotAceptada === 'si' ? '<span style="color:var(--green); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Aprobada</span>' : '<span style="color:var(--red); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> Rechazada</span>') : ''}
        ${t.motivoRechazo ? field('Motivo Rechazo', t.motivoRechazo) : ''}
        ${t.pedidoSAP ? field('Pedido SAP', t.pedidoSAP) : ''}
        ${t.pdfPedido ? field('PDF Pedido', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : ''}
        ${t.tecnicosAsignados && t.tecnicosAsignados.length > 0 ? field('Técnicos Asignados', t.tecnicosAsignados.join(', ')) : ''}
      </div>
      <div id="closed-pdf-extraction-${t.id}" style="margin-top: 1rem;"></div>
    </div>
    ` : ''}

    ${t.estado === 'Abierto' && currentSession.viewMode !== 'empresa' ? (t.categoria === 'Garantía Interna' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; display:flex; flex-direction:column; gap:1rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Procesar Garantía Interna</div>
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Este ticket es de categoría <strong>Garantía Interna</strong>. No se requiere ingresar refacciones, cotización ni pedido SAP.</p>
        <button type="button" class="btn-primary" style="background:var(--green); border-color:var(--green); margin-top:0.5rem; justify-content:center; display:inline-flex; align-items:center; gap:4px;" onclick="window.cerrarGarantiaInternaDirecto('${t.id}')"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Finalizar y Cerrar Ticket</button>
      </div>
    </div>
    ` : `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; display:flex; flex-direction:column; gap:1rem;">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="settings"></i> Procesar Ticket: Selección de Refacciones</div>
      
      <!-- Listado/Editor inline de Refacciones (idéntico a órdenes de servicio) -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
        <div style="font-weight:600; font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.25rem;">Refacciones Requeridas</div>
        <div id="ref-ticket-list" style="display:flex; flex-direction:column; gap:0.5rem;">
          <!-- Las filas se insertan dinámicamente -->
        </div>
        ${['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) ? `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; flex-wrap:wrap; gap:0.5rem;">
            <button type="button" class="btn-add-ref" style="width:fit-content; margin:0;" onclick="window.agregarFilaRefaccionTicket('${t.id}')">+ Agregar Refacción</button>
            <button type="button" class="btn-primary" style="background:var(--green); border-color:var(--green);" onclick="window.guardarRefaccionesTicketDesdeUI('${t.id}', true)">Guardar Refacciones</button>
          </div>
        ` : ''}
      </div>
    </div>
    `) : ''}

    ${t.estado === 'Refacciones' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1.25rem; border-radius: 8px; display:flex; flex-direction:column; gap:1.25rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Etapa: Selección de Refacciones</div>
      
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow: var(--shadow-sm);">
        <div style="font-weight:600; font-size:0.85rem; color:var(--text-secondary); border-bottom:1px solid var(--border); padding-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;"><i data-lucide="lock" style="width:14px;height:14px;color:var(--text-muted);"></i> Refacciones Solicitadas (Bloqueado / Lectura)</div>
        
        ${t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border); text-align:left; color:var(--text-muted); font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:0.5rem 0.25rem; width:15%;">Marca</th>
                  <th style="padding:0.5rem 0.25rem; width:40%;">Descripción</th>
                  <th style="padding:0.5rem 0.25rem; width:15%;">Clave</th>
                  <th style="padding:0.5rem 0.25rem; width:10%; text-align:center;">Cant.</th>
                  <th style="padding:0.5rem 0.25rem; width:20%; text-align:center;">Estatus</th>
                </tr>
              </thead>
              <tbody>
                ${t.refaccionesSeleccionadas.map(ref => {
                  const brandName = {
                    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                    'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                    'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                    'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
                  }[String(ref.marca).toUpperCase()] || ref.marca || '—';
                  
                  let pStatusColor = '#ef4444';
                  let pStatusBg = 'rgba(239, 68, 68, 0.1)';
                  if (ref.estatusPedido === 'En Tránsito / Pedido') {
                    pStatusColor = '#e8820c';
                    pStatusBg = 'rgba(232, 130, 12, 0.1)';
                  } else if (ref.estatusPedido === 'Entregado al Técnico') {
                    pStatusColor = '#22c55e';
                    pStatusBg = 'rgba(34, 197, 94, 0.1)';
                  }
                  
                  const safeClave = (ref.clave || ref.codigo || 'S/C').replace(/'/g, "\\'");
                  const safeNombre = (ref.descripcion || ref.nombre || 'Sin Descripción').replace(/'/g, "\\'");
                  
                  return `
                    <tr style="border-bottom:1px solid var(--border); color:var(--text-primary);">
                      <td style="padding:0.6rem 0.25rem; font-weight:600; color:var(--orange);">${brandName}</td>
                      <td style="padding:0.6rem 0.25rem; line-height:1.3; font-weight:500;">${ref.nombre || ref.descripcion || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${ref.codigo || ref.clave || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center; font-weight:700; color:var(--text-primary);">${ref.cantidad || 1}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center;">
                        <span class="status-badge" style="font-size:0.7rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:2px 6px; border-radius:4px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${safeClave}', '${safeNombre}', '${ref.estatusPedido || 'Por Pedir'}', ${ref.cantidad || 1}, '${ref.marca || ''}')">
                          ${ref.estatusPedido || 'Por Pedir'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-style:italic;">No hay refacciones solicitadas.</div>
        `}
      </div>

      <!-- Avanzar a Cotización -->
      ${['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) ? `
      <div style="border-top:1px dashed var(--border); padding-top:1rem; margin-top:0.25rem; display:flex; flex-direction:column; gap:0.75rem;">
        <!-- Contenedor para múltiples cotizaciones vinculadas en panel rápido -->
        <div id="quick-linked-cotizaciones-container-${t.id}" style="margin-bottom:0.5rem; width:100%;"></div>
        
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <label style="font-weight:600; font-size:0.85rem; display:block; margin:0; color:var(--text-secondary);">No. Cotización SAP *</label>
            <button type="button" id="btn-sync-sap-cot-${t.id}" onclick="window.syncSapCotizacionManual('${t.id}')" class="btn-text-action" style="font-size:0.7rem; color:var(--accent); background:none; border:none; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> Sincronizar con SAP</button>
          </div>
          <select id="quick-cot-sap-${t.id}" onchange="window.onQuickCotizacionSelected('${t.id}')" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;"></select>
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:0.4rem; color:var(--text-secondary);">Monto de Cotización ($) *</label>
          <input type="number" id="quick-cot-monto-${t.id}" value="" oninput="window.validarCotizacionConSAP(false, '${t.id}')" step="0.01" min="0" placeholder="Ej. 12500.00" style="width:100%; padding:0.55rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;">
        </div>
        <div>
          <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:0.4rem; color:var(--text-secondary);">Archivo Cotización (PDF) *</label>
          <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
            <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
              <label class="custom-file-upload" style="flex:1; margin:0;">
                <input type="file" id="quick-cot-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfCotizacion(this.files[0], false, '${t.id}');"/>
                <i data-lucide="upload" style="width:24px; height:24px; margin-bottom:0.4rem;"></i>
                <span class="file-label-text">Subir cotización en PDF</span>
              </label>
              <button type="button" id="btn-clear-pdf-quick-${t.id}" onclick="window.clearPdfInput(false, '${t.id}')" class="btn-icon" style="display:none; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:0.6rem; cursor:pointer; height:45px; width:45px; align-items:center; justify-content:center;" title="Eliminar archivo"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
            </div>
            <div id="quick-pdf-extraction-table-container-${t.id}" style="display:none;"></div>
          </div>
        </div>
        <div id="quick-sap-validation-status-${t.id}" style="display:none; margin-top: 0.25rem;"></div>
        
        <button type="button" class="btn-secondary" id="btn-quick-vincular-cotizacion-${t.id}" style="width:100%; margin-top:0.25rem; justify-content:center; display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;" onclick="window.vincularNuevaCotizacion(false, '${t.id}')"><i data-lucide="plus-circle" style="width:14px; height:14px;"></i> Vincular esta Cotización</button>
        
        <button id="btn-pasar-cotizacion-${t.id}" class="btn-primary" style="background:var(--accent); border-color:var(--accent); margin-top:0.5rem; justify-content:center; ${(!t.cotizacionSAP && !(window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive())) ? 'opacity:0.5; cursor:not-allowed;' : ''}" ${(!t.cotizacionSAP && !(window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive())) ? 'disabled' : ''} onclick="avanzarCotizacionTicket('${t.id}')">Pasar a Cotización</button>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${t.estado === 'Cotización' && currentSession.viewMode !== 'empresa' ? `
    <div class="detalle-section" style="background: var(--bg-hover); padding: 1.25rem; border-radius: 8px; display:flex; flex-direction:column; gap:1.25rem; border: 1px solid var(--border);">
      <div class="detalle-section-title" style="margin-bottom:0; color:var(--accent); display:flex; align-items:center; gap:0.5rem;"><i data-lucide="check-square"></i> Cierre de Cotización</div>
      
      <!-- Elegant metadata cards -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <!-- SAP Card -->
        <div style="flex: 1; min-width: 150px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Cotización SAP</span>
          <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${t.cotizacionSAP || '—'}</span>
        </div>
        <!-- Monto Card -->
        <div style="flex: 1; min-width: 150px; background: linear-gradient(135deg, rgba(232, 130, 12, 0.08) 0%, rgba(232, 130, 12, 0.02) 100%); border: 1px solid rgba(232, 130, 12, 0.2); border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: var(--shadow-sm);">
          <span style="font-size: 0.75rem; color: var(--accent); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Monto Total</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent);">${(t.montoCotizacion !== undefined && t.montoCotizacion !== null) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(t.montoCotizacion) : '—'}</span>
        </div>
      </div>
      
      ${t.pdfCotizacion ? `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; align-items:center; justify-content:space-between; box-shadow: var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.85rem; color:var(--text-secondary);">
          <i data-lucide="file-text" style="width:16px;height:16px;color:var(--accent);"></i> Archivo de Cotización
        </div>
        <div style="display:flex; gap:0.25rem;">
          <button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button>
          <button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button>
        </div>
      </div>
      ` : ''}
      
      <!-- Refacciones Solicitadas (Bloqueado / Lectura) -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow: var(--shadow-sm);">
        <div style="font-weight:600; font-size:0.85rem; color:var(--text-secondary); border-bottom:1px solid var(--border); padding-bottom:0.5rem; display:flex; align-items:center; gap:0.35rem;"><i data-lucide="lock" style="width:14px;height:14px;color:var(--text-muted);"></i> Refacciones Solicitadas (Bloqueado / Lectura)</div>
        
        ${t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border); text-align:left; color:var(--text-muted); font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:0.5rem 0.25rem; width:15%;">Marca</th>
                  <th style="padding:0.5rem 0.25rem; width:40%;">Descripción</th>
                  <th style="padding:0.5rem 0.25rem; width:15%;">Clave</th>
                  <th style="padding:0.5rem 0.25rem; width:10%; text-align:center;">Cant.</th>
                  <th style="padding:0.5rem 0.25rem; width:20%; text-align:center;">Estatus</th>
                </tr>
              </thead>
              <tbody>
                ${t.refaccionesSeleccionadas.map(ref => {
                  const brandName = {
                    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM',
                    'MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS',
                    'TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM',
                    'POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
                    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
                  }[String(ref.marca).toUpperCase()] || ref.marca || '—';
                  
                  let pStatusColor = '#ef4444';
                  let pStatusBg = 'rgba(239, 68, 68, 0.1)';
                  if (ref.estatusPedido === 'En Tránsito / Pedido') {
                    pStatusColor = '#e8820c';
                    pStatusBg = 'rgba(232, 130, 12, 0.1)';
                  } else if (ref.estatusPedido === 'Entregado al Técnico') {
                    pStatusColor = '#22c55e';
                    pStatusBg = 'rgba(34, 197, 94, 0.1)';
                  }
                  
                  const safeClave = (ref.clave || ref.codigo || 'S/C').replace(/'/g, "\\'");
                  const safeNombre = (ref.descripcion || ref.nombre || 'Sin Descripción').replace(/'/g, "\\'");
                  
                  return `
                    <tr style="border-bottom:1px solid var(--border); color:var(--text-primary);">
                      <td style="padding:0.6rem 0.25rem; font-weight:600; color:var(--orange);">${brandName}</td>
                      <td style="padding:0.6rem 0.25rem; line-height:1.3; font-weight:500;">${ref.nombre || ref.descripcion || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${ref.codigo || ref.clave || '—'}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center; font-weight:700; color:var(--text-primary);">${ref.cantidad || 1}</td>
                      <td style="padding:0.6rem 0.25rem; text-align:center;">
                        <span class="status-badge" style="font-size:0.7rem; font-weight:700; color:${pStatusColor}; background:${pStatusBg}; padding:2px 6px; border-radius:4px; white-space:nowrap; border: 1px solid ${pStatusColor}33; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${t.id}', '${safeClave}', '${safeNombre}', '${ref.estatusPedido || 'Por Pedir'}', ${ref.cantidad || 1}, '${ref.marca || ''}')">
                          ${ref.estatusPedido || 'Por Pedir'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-style:italic;">No hay refacciones solicitadas.</div>
        `}
      </div>

      <div class="form-group full-width" style="margin-bottom:0; border-top: 1px dashed var(--border); padding-top: 1rem;">
        <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; display:flex; align-items:center; gap:0.35rem; margin-bottom:0.5rem;">
          ¿El cliente aceptó la cotización?
          ${isDecisionLocked ? `<span style="font-size:0.72rem; color:var(--green); font-weight:600; display:inline-flex; align-items:center; gap:3px; background:rgba(16,185,129,0.1); padding:1px 6px; border-radius:4px;"><i data-lucide="info" style="width:11px;height:11px;"></i> Definido por el cliente</span>` : ''}
        </label>
        <div style="display:flex; gap:1rem; margin-top:0.5rem; margin-bottom: 0.75rem;">
          <label style="cursor:${isDecisionLocked ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; font-weight:500; color:var(--text-primary); ${isDecisionLocked ? 'opacity:0.7;' : ''}">
            <input type="radio" name="quick-cot-acep-${t.id}" value="si" ${t.cotAceptada === 'si' || t.cotAceptada === 'aprobada' ? 'checked' : ''} ${isDecisionLocked ? 'disabled' : ''} onchange="document.getElementById('quick-motivo-${t.id}').style.display='none'; document.getElementById('quick-pedido-${t.id}').style.display='block';"> 
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--green);"></i> Sí, aprobada
          </label>
          <label style="cursor:${isDecisionLocked ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; font-weight:500; color:var(--text-primary); ${isDecisionLocked ? 'opacity:0.7;' : ''}">
            <input type="radio" name="quick-cot-acep-${t.id}" value="no" ${t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'checked' : ''} ${isDecisionLocked ? 'disabled' : ''} onchange="document.getElementById('quick-motivo-${t.id}').style.display='block'; document.getElementById('quick-pedido-${t.id}').style.display='none';"> 
            <i data-lucide="x-circle" style="width:16px;height:16px;color:var(--red);"></i> No, rechazada
          </label>
        </div>
        <div id="quick-motivo-${t.id}" style="display: ${t.cotAceptada === 'no' || t.cotAceptada === 'rechazada' ? 'block' : 'none'}; margin-bottom:0.75rem;">
          <textarea id="quick-motivo-text-${t.id}" rows="2" placeholder="Especifica el motivo por el cual fue rechazada..." ${isDecisionLocked ? 'disabled style="background:rgba(255,255,255,0.01); color:var(--text-secondary); cursor:not-allowed;"' : ''}>${t.motivoRechazo || ''}</textarea>
        </div>
        <div id="quick-pedido-${t.id}" style="display: ${t.cotAceptada === 'si' || t.cotAceptada === 'aprobada' ? 'block' : 'none'}; margin-bottom:0.75rem;">
          <div class="form-group full-width">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem; margin:0;">No. Pedido SAP *</label>
              <button type="button" id="btn-sync-sap-ped-quick-${t.id}" onclick="window.syncSapPedidoManual(false, '${t.id}')" class="btn-text-action" style="font-size:0.75rem; color:var(--accent); background:none; border:none; cursor:pointer; font-weight:600; padding:0; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> Sincronizar con SAP</button>
            </div>
            <select id="quick-ped-sap-${t.id}" onchange="window.onQuickPedidoSelected('${t.id}')" style="width:100%; border:1px solid var(--border); border-radius:6px; background:rgba(255,255,255,0.02); color:var(--text-primary); padding:0.6rem; font-size:0.85rem;"></select>
          </div>
          <div class="form-group full-width" style="margin-top:0.5rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Monto de Pedido ($) *</label>
            <input type="number" id="quick-ped-monto-${t.id}" oninput="window.validarPedidoConSAP(false, '${t.id}')" step="0.01" min="0" placeholder="Ej. 12500.00" style="width:100%; border:1px solid var(--border); border-radius:6px; background:rgba(255,255,255,0.02); color:var(--text-primary); padding:0.6rem; font-size:0.85rem;" />
          </div>
          <div class="form-group full-width" style="margin-top:0.5rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Archivo Pedido (PDF) *</label>
            <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
              <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
                <label class="custom-file-upload" style="flex:1; margin:0;">
                  <input type="file" id="quick-ped-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfPedido(this.files[0], false, '${t.id}');" />
                  <i data-lucide="upload" style="width:24px; height:24px; margin-bottom:0.4rem;"></i>
                  <span class="file-label-text">Subir pedido en PDF</span>
                </label>
                <button type="button" id="btn-clear-pdf-pedido-quick-${t.id}" onclick="window.clearPdfPedidoInput(false, '${t.id}')" class="btn-icon" style="display:none; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:0.6rem; cursor:pointer; height:45px; width:45px; align-items:center; justify-content:center;" title="Eliminar archivo"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
              </div>
              <div id="quick-pdf-pedido-extraction-table-container-${t.id}" style="display:none;"></div>
            </div>
          </div>
          <div id="quick-pedido-sap-validation-status-${t.id}" style="margin-top: 0.75rem; display: none;"></div>
          <div class="form-group full-width" style="margin-top:0.75rem;">
            <label style="font-weight:600; color:var(--text-secondary); font-size:0.85rem;">Tipo de Visita *</label>
            <select id="quick-tipo-${t.id}">
              <option value="Servicio preventivo">Servicio preventivo</option>
              <option value="Garantía">Garantía</option>
              <option value="Inspección">Inspección</option>
              <option value="Entrega y puesta en marcha">Entrega y puesta en marcha</option>
              <option value="Pre-entrega">Pre-entrega</option>
              <option value="Entrega Refacciones">Entrega Refacciones</option>
            </select>
          </div>
        </div>
        <button class="btn-primary full-width" style="justify-content:center; margin-top: 1rem;" onclick="cerrarCotizacionTicket('${t.id}')">Finalizar y Cerrar Ticket</button>
      </div>
    </div>
    ` : ''}

    ${window.renderComentariosInternosHtml(t)}

    <div style="display:flex; justify-content:center; gap: 4px; height: 35px; width: 80%; margin: 2rem auto 0.5rem auto; opacity: 0.2; color: var(--text-primary);">
      <div style="width:2px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:3px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:1px; background:currentColor;"></div><div style="width:4px; background:currentColor;"></div>
      <div style="width:2px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:5px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
      <div style="width:4px; background:currentColor;"></div><div style="width:1px; background:currentColor;"></div>
      <div style="width:3px; background:currentColor;"></div><div style="width:2px; background:currentColor;"></div>
    </div>
    <div style="font-family: monospace; font-size: 0.6rem; color: var(--text-muted); letter-spacing: 5px; text-align: center; margin-bottom: 1rem;">* ${t.folio} *</div>

    <div class="form-actions" style="border-top:2px dashed var(--border);padding-top:1rem;margin-top:0.5rem; justify-content:center; gap:0.5rem; flex-wrap:wrap;">
      <button class="btn-secondary" onclick="cerrarDetalleTicket()">Cerrar Vista</button>
      <button class="btn-primary" onclick="cerrarDetalleTicket();editarTicket('${t.id}')"><i data-lucide="pencil" style="width:16px;height:16px;"></i> Editar</button>
      ${isSuperadmin ? `
        <button class="btn-secondary" style="border-color:var(--accent); color:var(--accent);" onclick="forzarEstadoTicket('${t.id}')">
          <i data-lucide="zap" style="width:16px;height:16px;margin-right:4px;"></i> Forzar Estado
        </button>
        ${!assocOrder ? `
          <button class="btn-secondary" style="border-color:#2563eb; color:#2563eb;" onclick="forzarCrearOrdenServicio('${t.id}')">
            <i data-lucide="file-plus" style="width:16px;height:16px;margin-right:4px;"></i> Forzar Orden de Servicio
          </button>
        ` : ''}
      ` : ''}
    </div>
  `;
  document.getElementById('modal-ticket-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  
  // Auto-scroll chat to bottom
  setTimeout(() => {
    const chatContainer = document.querySelector('#modal-ticket-detalle .chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, 100);

  // Carga asíncrona de evidencia fotográfica si viene como placeholder o si existe en base de datos
  const hasPendingEvidence = t.pdfCotizacion === '__HAS_PDF__' || (!t.pdfCotizacion && t.notas && String(t.notas).toLowerCase().includes('evidencia fotográfica'));
  if (hasPendingEvidence && window.supabaseClient) {
    setTimeout(async () => {
      try {
        const { data, error } = await window.supabaseClient
          .from('tickets')
          .select('pdf_cotizacion')
          .eq('id', t.id)
          .single();
        if (error) throw error;
        const base64 = data ? data.pdf_cotizacion : null;
        const imgEl = document.getElementById(`detalle-evidence-img-${t.id}`);
        const loadEl = document.getElementById(`detalle-evidence-loading-${t.id}`);
        if (base64) {
          t.pdfCotizacion = base64;
          if (imgEl) {
            imgEl.src = base64;
            imgEl.style.display = 'block';
          }
          if (loadEl) loadEl.style.display = 'none';
        } else {
          if (loadEl) loadEl.innerHTML = '<span style="color:var(--text-muted);"><i data-lucide="image-off" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> No se encontró imagen adjunta en la base de datos</span>';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (err) {
        console.error('Error cargando evidencia fotográfica en verDetalleTicket:', err);
        const loadEl = document.getElementById(`detalle-evidence-loading-${t.id}`);
        if (loadEl) loadEl.innerHTML = '<span style="color:var(--red); font-size:0.8rem;">Error al descargar imagen de evidencia</span>';
      }
    }, 30);
  }

  if (t.estado === 'Cerrado' && t.cotAceptada === 'si' && window.supabaseClient) {
    setTimeout(async () => {
      const container = document.getElementById(`closed-pdf-extraction-${t.id}`);
      if (!container) return;
      
      try {
        const { data, error } = await window.supabaseClient
          .from('pdf_extracciones_ai')
          .select('*')
          .eq('ticket_id', t.id)
          .order('fecha_extraccion', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          const ex = data[0];
          const mainArticulos = Array.isArray(ex.conceptos) ? ex.conceptos : [];
          const extrasArticulos = Array.isArray(ex.extras) ? ex.extras : [];
          
          let logisticaHtml = '';
          const logisticaObj = extrasArticulos.find(e => e.isViajeData);
          if (logisticaObj) {
            logisticaHtml = `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">✈️ Logística Extraída (Viáticos y Ruta)</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                        <th style="padding:4px;">Origen</th>
                        <th style="padding:4px;">Destino</th>
                        <th style="padding:4px;">Hospedajes</th>
                        <th style="padding:4px;">Alimentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                        <td style="padding:4px;" title="${logisticaObj.origen || ''}">${logisticaObj.origen || '—'}</td>
                        <td style="padding:4px;" title="${logisticaObj.destino || ''}">${logisticaObj.destino || '—'}</td>
                        <td style="padding:4px;">${logisticaObj.num_hospedaje || 0}</td>
                        <td style="padding:4px;">${logisticaObj.num_alimento || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          } else if (ex.ruta_servicio) {
             logisticaHtml = `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">✈️ Logística Extraída (Ruta)</div>
                <div style="font-size:0.75rem; padding:0 8px;">${ex.ruta_servicio}</div>
              </div>
            `;
          }

          const generateTable = (title, icon, items) => {
            const filteredItems = items.filter(i => !i.isViajeData);
            if (filteredItems.length === 0) return '';
            return `
              <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem;">${icon} ${title} (${filteredItems.length})</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.75rem;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); white-space:nowrap;">
                        <th style="padding:4px;">Descripción</th>
                        <th style="padding:4px; text-align:center;">Cant</th>
                        <th style="padding:4px; text-align:center;">UM</th>
                        <th style="padding:4px; text-align:center;">X Surtir</th>
                        <th style="padding:4px; text-align:center;">Almacén</th>
                        <th style="padding:4px; text-align:right;">Precio</th>
                        <th style="padding:4px; text-align:center;">Imp %</th>
                        <th style="padding:4px; text-align:right;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredItems.map(art => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                          <td style="padding:4px;" title="${art.descripcion || ''}">${art.descripcion || '—'}</td>
                          <td style="padding:4px; text-align:center; font-weight:600;">${art.cantidad || 0}</td>
                          <td style="padding:4px; text-align:center;">${art.unidad_medida || '—'}</td>
                          <td style="padding:4px; text-align:center;">${art.x_surtir || 0}</td>
                          <td style="padding:4px; text-align:center;">${art.almacen || '—'}</td>
                          <td style="padding:4px; text-align:right;">${art.precio ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.precio) : '—'}</td>
                          <td style="padding:4px; text-align:center;">${art.impuesto_porcentaje || 0}%</td>
                          <td style="padding:4px; text-align:right; font-weight:600;">${art.total ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.total) : '—'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          };

          const allExtractedItems = [...mainArticulos, ...extrasArticulos];
          const hasReembolsoKm = allExtractedItems.some(x => !x.isViajeData && x.descripcion && x.descripcion.toLowerCase().includes('reembolso') && x.descripcion.toLowerCase().includes('km'));

          container.innerHTML = `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.75rem; font-size:0.8rem;">
              <div style="font-weight:600; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <span>📋 Datos Históricos Extraídos del Archivo</span>
                ${hasReembolsoKm ? `<span style="background:rgba(232, 130, 12, 0.1); color:var(--accent); padding:2px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:4px; border:1px solid rgba(232, 130, 12, 0.2);">Reembolso KM Detectado</span>` : ''}
              </div>
              ${generateTable('Refacciones Extraídas', '📦', mainArticulos)}
              ${generateTable('Extras Extraídos', '📋', extrasArticulos)}
              ${logisticaHtml}
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: container });
        }
      } catch (err) {
        console.error('Error fetching AI extraction:', err);
      }
    }, 100);
  }

  if (t.estado === 'Abierto' && currentSession.viewMode !== 'empresa') {
    window.inicializarRefaccionesTicket(t.id, t.refaccionesSeleccionadas || []);
  }
  if (t.estado === 'Refacciones' && currentSession.viewMode !== 'empresa') {
    if (!window.quickEditandoCotizaciones) window.quickEditandoCotizaciones = {};
    window.quickEditandoCotizaciones[t.id] = [];
    if (Array.isArray(t.cotizacionesAdicionales) && t.cotizacionesAdicionales.length > 0) {
      window.quickEditandoCotizaciones[t.id] = JSON.parse(JSON.stringify(t.cotizacionesAdicionales));
    } else if (t.cotizacionSAP) {
      window.quickEditandoCotizaciones[t.id] = [{
        sap: t.cotizacionSAP,
        monto: t.montoCotizacion || 0,
        pdf: t.pdfCotizacion || null
      }];
    }

    setTimeout(() => {
      if (window.renderLinkedCotizaciones) {
        window.renderLinkedCotizaciones(false, t.id);
      }
    }, 100);

    if (window.poblarCotizacionesDropdown) {
      window.poblarCotizacionesDropdown(false, t.id, '');
    }
  }
  if (t.estado === 'Cotización' && currentSession.viewMode !== 'empresa') {
    if (window.poblarPedidosDropdown) {
      window.poblarPedidosDropdown(false, t.id, t.pedidoSAP || '');
    }
    if (t.pedidoSAP) {
      const elPedMonto = document.getElementById(`quick-ped-monto-${t.id}`);
      if (elPedMonto) {
        const order = (window._cachePedidosSap || []).find(o => o.numero_pedido === t.pedidoSAP);
        elPedMonto.value = t.montoPedido || (order ? order.monto : '');
      }
      setTimeout(() => {
        if (window.validarPedidoConSAP) {
          window.validarPedidoConSAP(false, t.id);
        }
      }, 200);
    }
  }
  lucide.createIcons();
}

// Visualización de PDF bajo demanda en una pestaña nueva
async function visualizarPdfOnDemand(ticketId, tipo) {
  if (typeof document === 'undefined') return;
  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const label = tipo === 'pedido' ? 'pdfPedido' : 'pdfCotizacion';
  const dbCol = tipo === 'pedido' ? 'pdf_pedido' : 'pdf_cotizacion';

  const showPdf = (base64Data) => {
    let base64Pure = base64Data;
    if (base64Data.startsWith('data:')) {
      base64Pure = base64Data.split(',')[1];
    }
    try {
      const byteCharacters = atob(base64Pure);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (e) {
      console.error('Error al decodificar Base64:', e);
      window.open(base64Data, '_blank');
    }
  };

  const localVal = t[label];
  if (localVal && localVal.startsWith('data:')) {
    showPdf(localVal);
    return;
  }

  if (!window.supabaseClient) {
    mostrarNotificacion('No hay conexión con la base de datos para visualizar el PDF.', 'error');
    return;
  }

  mostrarNotificacion('Cargando archivo PDF...', 'info');

  try {
    const { data, error } = await window.supabaseClient
      .from('tickets')
      .select(dbCol)
      .eq('id', ticketId)
      .single();

    if (error) throw error;

    const dbVal = data ? data[dbCol] : null;
    if (!dbVal) {
      mostrarNotificacion('El archivo no está disponible en el servidor.', 'error');
      return;
    }

    showPdf(dbVal);
  } catch (err) {
    console.error('[PDF View] Error:', err);
    mostrarNotificacion('Error al cargar el archivo: ' + err.message, 'error');
  }
};

function visualizarDestinoPdfActual() {
  if (typeof document === 'undefined') return;
  const currentTicketId = window.soporteActual;
  if (!currentTicketId) return;
  const t = tickets.find(x => x.id === currentTicketId);
  if (!t || !t.destinoPdfUrl) {
    const fileInput = document.getElementById('ref-destino-pdf-file');
    if (fileInput && fileInput.files.length > 0) {
      const fileURL = URL.createObjectURL(fileInput.files[0]);
      window.open(fileURL, '_blank');
    } else {
      mostrarNotificacion('No hay ningún PDF cargado.', 'warning');
    }
    return;
  }
  
  if (t.destinoPdfUrl.startsWith('data:')) {
    let base64Pure = t.destinoPdfUrl;
    if (t.destinoPdfUrl.startsWith('data:')) {
      base64Pure = t.destinoPdfUrl.split(',')[1];
    }
    try {
      const byteCharacters = atob(base64Pure);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (e) {
      window.open(t.destinoPdfUrl, '_blank');
    }
  } else {
    window.open(t.destinoPdfUrl, '_blank');
  }
};

// Descarga de PDF bajo demanda desde Supabase para evitar saturación de localStorage
async function descargarPdfOnDemand(ticketId, tipo) {
  if (typeof document === 'undefined') return;
  const t = tickets.find(x => x.id === ticketId);
  if (!t) {
    mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const label = tipo === 'pedido' ? 'pdfPedido' : 'pdfCotizacion';
  const dbCol = tipo === 'pedido' ? 'pdf_pedido' : 'pdf_cotizacion';
  const folio = t.folio || 'ticket';

  // 1. Si el archivo ya está en memoria local (ej. recién subido/editado y no sincronizado)
  const localVal = t[label];
  if (localVal && localVal.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = localVal;
    link.download = `${tipo === 'pedido' ? 'Pedido' : 'Cotizacion'}_${folio}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // 2. Si es el marcador, se requiere estar online para descargarlo de Supabase
  if (!window.supabaseClient) {
    mostrarNotificacion('No hay conexión con la base de datos para descargar el PDF.', 'error');
    return;
  }

  mostrarNotificacion('Descargando archivo PDF...', 'info');

  try {
    const { data, error } = await window.supabaseClient
      .from('tickets')
      .select(dbCol)
      .eq('id', ticketId)
      .single();

    if (error) throw error;

    const dbVal = data ? data[dbCol] : null;
    if (!dbVal) {
      mostrarNotificacion('El archivo no está disponible en el servidor.', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = dbVal;
    link.download = `${tipo === 'pedido' ? 'Pedido' : 'Cotizacion'}_${folio}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion('Descarga iniciada con éxito.', 'success');
  } catch (err) {
    console.error('[PDF Download] Error:', err);
    mostrarNotificacion('Error al descargar el archivo: ' + err.message, 'error');
  }
};

async function avanzarCotizacionTicket(id) {
  if (typeof document === 'undefined') return;
  const t = tickets.find(x => x.id === id);
  if (!t) return;

  // Si la lista está vacía, intentar vincular los valores actuales
  if (!window.quickEditandoCotizaciones || !window.quickEditandoCotizaciones[id] || window.quickEditandoCotizaciones[id].length === 0) {
    const quickSap = document.getElementById(`quick-cot-sap-${id}`)?.value.trim();
    const quickMontoInput = document.getElementById(`quick-cot-monto-${id}`);
    const quickMontoVal = quickMontoInput ? parseFloat(quickMontoInput.value) : 0;
    if (quickSap || quickMontoVal > 0) {
      await window.vincularNuevaCotizacion(false, id);
    }
  }

  const list = window.quickEditandoCotizaciones ? window.quickEditandoCotizaciones[id] : [];
  const bypassQuote = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
  if (!bypassQuote && (!Array.isArray(list) || list.length === 0)) {
    mostrarNotificacion('Debe vincular al menos una cotización de SAP para este ticket.', 'error');
    return;
  }

  const primaryCot = list[0] || { sap: '', pdf: null };
  const totalMonto = list.length > 0 ? list.reduce((sum, c) => sum + (Number(c.monto) || 0), 0) : null;

  t.cotizacionSAP = primaryCot.sap;
  t.montoCotizacion = totalMonto;
  t.pdfCotizacion = primaryCot.pdf;
  t.cotizacionesAdicionales = list;
  t.estado = 'Cotización';

  safeSetJSON('sapi_tickets', tickets);
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  mostrarNotificacion('Ticket avanzado a Cotización.', 'success');

  if (typeof window.ejecutarAutomatizacion === 'function') {
    window.ejecutarAutomatizacion('Carga de Cotización SAP en ticket', {
      email: t.clienteEmail || t.solicitanteEmail || '',
      nombre_cliente: t.cliente || '',
      folio_ticket: t.folio || t.id,
      monto_cotizacion: totalMonto ? `$${Number(totalMonto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '',
      link: window.location.origin + '/cliente'
    });
  }

  cerrarDetalleTicket();
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
}

async function cerrarCotizacionTicket(id) {
  if (typeof document === 'undefined') return;
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const isGarantiaInterna = t.categoria === 'Garantía Interna';
  let aceptada = 'si';
  if (!isGarantiaInterna) {
    const selAcep = document.querySelector(`input[name="quick-cot-acep-${id}"]:checked`)?.value;
    if (!selAcep) {
      mostrarNotificacion('Debes indicar si fue aceptada o rechazada.', 'warning');
      return;
    }
    aceptada = selAcep;
  }
  let motivo = '';
  let pedidoSAP = '';
  let pdfPedidoBase64 = t.pdfPedido || null;
  let tecnicosAsignados = t.tecnicosAsignados || [];
  let tipoVisitaSeleccionado = 'Servicio';
  
  if (aceptada === 'no') {
    motivo = document.getElementById(`quick-motivo-text-${id}`)?.value.trim();
    if (!motivo) {
      mostrarNotificacion('Debes especificar el motivo del rechazo.', 'warning');
      return;
    }
  } else if (aceptada === 'si') {
    pedidoSAP = document.getElementById(`quick-ped-sap-${id}`)?.value.trim() || '';
    const pdfUpload = document.getElementById(`quick-ped-pdf-${id}`)?.files.length > 0;
    
    const selTipo = document.getElementById(`quick-tipo-${id}`)?.value;
    if (selTipo) {
      tipoVisitaSeleccionado = selTipo;
    }
    
    const bypass = isGarantiaInterna || (window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive()) || (window.currentSession && window.currentSession.viewMode === 'superadmin');
    if (!bypass) {
      if (!pedidoSAP) {
        mostrarNotificacion('Debes ingresar el Número de Pedido SAP.', 'warning');
        return;
      }
      if (!pdfUpload && !pdfPedidoBase64) {
        mostrarNotificacion('Debes adjuntar el archivo PDF del pedido.', 'warning');
        return;
      }
      
      const isBlocked = window._pedidoSapBlockedState && window._pedidoSapBlockedState[id];
      if (isBlocked) {
        mostrarNotificacion('No se puede cerrar el ticket debido a una discrepancia crítica entre el PDF y SAP.', 'error');
        return;
      }
    }
    
    if (pdfUpload) {
      try { pdfPedidoBase64 = await readFileAsBase64(document.getElementById(`quick-ped-pdf-${id}`).files[0]); } catch(e){}
    }
  }
  
  t.cotAceptada = aceptada;
  t.motivoRechazo = motivo;
  t.pedidoSAP = pedidoSAP;
  t.tecnicosAsignados = tecnicosAsignados;
  t.pdfPedido = pdfPedidoBase64;
  t.estado = 'Cerrado';
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  safeSetJSON('sapi_tickets', tickets);
  
  if (aceptada === 'si') {
    if (typeof window.ejecutarAutomatizacion === 'function') {
      window.ejecutarAutomatizacion('Cotización SAP aceptada por el cliente', {
        email: t.contacto || '',
        nombre_cliente: t.cliente || 'Cliente',
        folio_ticket: t.folio,
        monto_cotizacion: t.montoCotizacion ? window.formatMontoConComas(t.montoCotizacion) : '',
        estatus_ticket: t.estado,
        link: window.location.origin + '/cliente'
      });
    }
    if (window.esTicketDeServicioEnCampo(t)) {
      const ordenExistente = ordenes.find(o => o.soporte === t.id);
      if (!ordenExistente) {
        let modeloStr = '';
        let serieStr = '';
        let marcaStr = '';
        let ecoStr = '';
        let maquinariaId = null;

        if (t.equipo) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          
          const matchMaquina = (m) => {
            const cleanId = m.idInterno || m.id || '';
            if (!cleanId) return false;
            const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
            const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
            const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
            const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
            
            const equipoString = t.equipo || '';
            const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
            
            return names.some(name => {
              return (
                name === mName ||
                name === cleanId ||
                name === m.serie ||
                name.includes(`[${cleanId}]`) ||
                (m.serie && name.includes(`(SN: ${m.serie})`))
              );
            });
          };

          let maq = null;
          clientesDb.forEach(c => {
            if (c.maquinas) {
              const found = c.maquinas.find(matchMaquina);
              if (found) maq = found;
            }
          });
          if (!maq) maq = maquinariaDb.find(matchMaquina);

          if (maq) {
            modeloStr = maq.modelo || '';
            serieStr = maq.serie || '';
            marcaStr = maq.marca || '';
            ecoStr = maq.no_economico || '';
            maquinariaId = maq.id || maq.idInterno || null;
          } else {
            if (t.equipo.includes('(SN: ')) {
              const parts = t.equipo.split('(SN: ');
              serieStr = parts[1].replace(')', '').trim();
              let left = parts[0].trim();
              if (left.startsWith('[') && left.includes(']')) {
                left = left.substring(left.indexOf(']') + 1).trim();
              }
              modeloStr = left;
            } else {
              modeloStr = t.equipo;
            }
          }
        }

        let newFolio = generarFolioConsecutivo();
        const isTest = isTestData(t) || isTestModeActive();
        if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
          newFolio = `[PRUEBA] ${newFolio}`;
        }

        let refUtilizadasExtraidas = [];
        if (window.supabaseClient) {
          try {
            const { data: dbEx } = await window.supabaseClient
              .from('pdf_extracciones_ai')
              .select('conceptos')
              .eq('ticket_id', id)
              .order('fecha_extraccion', { ascending: false })
              .limit(1);
            if (dbEx && dbEx.length > 0 && dbEx[0].conceptos) {
              refUtilizadasExtraidas = dbEx[0].conceptos.map(c => {
                let matchedClave = '';
                const descUpper = (c.descripcion || '').trim().toUpperCase();
                if (descUpper && typeof refaccionesDb !== 'undefined') {
                  const match = refaccionesDb.find(r => (r.descripcion || '').toUpperCase().trim() === descUpper);
                  if (match) matchedClave = match.codigo || match.id || '';
                }
                return {
                  descripcion: c.descripcion || '',
                  cantidad: (c.cantidad || 1).toString(),
                  clave: matchedClave,
                  isFromPdf: true
                };
              });
            }
          } catch(err) {}
        }
        if (refUtilizadasExtraidas.length === 0 && window._lastPdfPedidoExtracted && window._lastPdfPedidoExtracted.mainArticulos) {
          refUtilizadasExtraidas = window._lastPdfPedidoExtracted.mainArticulos.map(c => {
            let matchedClave = '';
            const descUpper = (c.descripcion || '').trim().toUpperCase();
            if (descUpper && typeof refaccionesDb !== 'undefined') {
              const match = refaccionesDb.find(r => (r.descripcion || '').toUpperCase().trim() === descUpper);
              if (match) matchedClave = match.codigo || match.id || '';
            }
            return {
              descripcion: c.descripcion || '',
              cantidad: (c.cantidad || 1).toString(),
              clave: matchedClave,
              isFromPdf: true
            };
          });
        }

        let refNecesariasManuales = [];
        if (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
          refNecesariasManuales = t.refaccionesSeleccionadas.map(r => ({
            descripcion: r.nombre || r.descripcion || '',
            cantidad: (r.cantidad || 1).toString(),
            clave: r.codigo || r.clave || ''
          }));
        }

        const nuevaOrden = {
          id: newFolio,
          fecha: getLocalDateString(),
          folio: newFolio,
          pedido: pedidoSAP || '',
          cliente: t.cliente || '',
          ubicacion: t.sitio || '',
          ubicacion_sitio: '',
          operador: '', // Se preguntará en sitio
          eco: ecoStr || '',
          horometro: '',
          modelo: modeloStr,
          serie: serieStr,
          marca: marcaStr || '',
          maquinaria_id: maquinariaId || null,
          equipo: t.equipo || '',
          tecnico: tecnicosAsignados.join(', '),
          tecnicosAsignados: tecnicosAsignados,
          soporte: t.id,
          km_ida: '', km_vuelta: '', km_total: '',
          tipo: tipoVisitaSeleccionado,
          estado: 'Pendiente',
          falla: (t.asunto ? t.asunto + '\n' : '') + (t.descripcion || ''),
          trabajos: '', dictamen: '', condiciones: '',
          observaciones: '', pendientes: '',
          ref_utilizadas: refUtilizadasExtraidas, ref_necesarias: refNecesariasManuales,
          factura_ref: '', factura_mo: '',
          noches: '', alimentacion: '', traslado_costo: '',
          dias: [],
          esPrueba: isTest,
        };

        ordenes.unshift(nuevaOrden);
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          window.pushToSupabase('ordenes', nuevaOrden);
        }
        mostrarNotificacion('Orden de servicio pre-cargada y generada.', 'success');
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    } else {
      mostrarNotificacion(`Ticket de ${t.categoria || 'Garantía / Refacciones'} procesado para Guía de Envío.`, 'info');
    }
  }

  // Asegurar generación automática de Guía de Envío si el ticket tiene refacciones
  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    const isRefCat = String(t.categoria || '').toLowerCase().includes('refacci') || String(t.categoria || '').toLowerCase().includes('garant') || (t.folio && t.folio.endsWith('-A'));
    if (isRefCat || (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0)) {
      window.asegurarGuiaEnvioParaTicket(t);
    }
  }
  
  mostrarNotificacion('Ticket cerrado con éxito.', 'success');
  cerrarDetalleTicket();
  renderTickets();
  updateTicketBadge(); updateOrdenesBadge();
}

function cerrarDetalleTicket(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target !== document.getElementById('modal-ticket-detalle-overlay')) return;
  document.getElementById('modal-ticket-detalle-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function forzarEstadoTicket(id) {
  if (typeof document === 'undefined') return;
  const isSuperadmin = safeEsUsuarioSuperadmin();
  if (!isSuperadmin) {
    mostrarNotificacion('Acción restringida: Solo los usuarios con rol Superadmin pueden forzar estados de tickets.', 'error');
    return;
  }
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  overlay.innerHTML = `
    <div class="modal" style="max-width: 440px; width: 100%; background: var(--bg-card, #1e2130); border: 1px solid var(--border, #2e3248); border-radius: var(--radius, 12px); box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.2s ease;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--border); background: var(--bg-secondary); flex-shrink: 0;">
        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="zap" style="color: var(--accent); width: 18px; height: 18px;"></i> Forzar Estado (Superadmin)
        </h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); transition: var(--transition);">
          <i data-lucide="x" style="width: 18px; height: 18px;"></i>
        </button>
      </div>
      
      <div class="modal-body" style="padding: 1.25rem 1.4rem;">
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.25rem; line-height: 1.4;">
          Cambiarás el estado del ticket <strong style="color: var(--text-primary);">${t.folio}</strong> saltando todas las validaciones.
        </p>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Nuevo Estado:</label>
          <select id="forzar-estado-select" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.88rem;">
            <option value="Abierto" ${t.estado === 'Abierto' ? 'selected' : ''}>Abierto</option>
            <option value="Refacciones" ${t.estado === 'Refacciones' ? 'selected' : ''}>Refacciones</option>
            <option value="Cotización" ${t.estado === 'Cotización' ? 'selected' : ''}>Cotización</option>
            <option value="Cerrado" ${t.estado === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
          </select>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border); padding-top: 1rem;">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.6rem 1.25rem; font-weight: 500; cursor: pointer; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-sm); transition: var(--transition);">Cancelar</button>
          <button type="button" class="btn-primary" style="padding: 0.6rem 1.35rem; font-weight: 600; cursor: pointer; background: var(--accent); border: 1px solid var(--accent); color: #ffffff; border-radius: var(--radius-sm);" id="btn-forzar-confirmar">Confirmar Cambio</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });

  overlay.querySelector('#btn-forzar-confirmar').addEventListener('click', async () => {
    const nuevoEstado = overlay.querySelector('#forzar-estado-select').value;
    const btn = overlay.querySelector('#btn-forzar-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="spin" data-lucide="loader"></i> Aplicando...';
    if (window.lucide) window.lucide.createIcons({ root: btn });

    t.estado = nuevoEstado;
    if (window.supabaseClient) {
      await window.pushToSupabase('tickets', t);
    }
    safeSetJSON('sapi_tickets', tickets);
    mostrarNotificacion(`Estado del ticket forzado a ${nuevoEstado}`, 'success');
    
    overlay.remove();
    cerrarDetalleTicket();
    renderTickets();
    updateTicketBadge(); updateOrdenesBadge();
  });
};

async function forzarCrearOrdenServicio(id) {
  if (typeof document === 'undefined') return;
  const isSuperadmin = safeEsUsuarioSuperadmin();
  
  if (!isSuperadmin) {
    mostrarNotificacion('Acción restringida: Solo los usuarios con rol Superadmin pueden forzar órdenes de servicio.', 'error');
    return;
  }

  let t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x && (x.id === id || x.folio === id)) : null;
  if (!t) {
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      t = local.find(x => x && (x.id === id || x.folio === id));
    } catch(e){}
  }
  if (!t) {
    mostrarNotificacion('No se encontró el ticket seleccionado.', 'error');
    return;
  }

  const existingOrder = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
  if (existingOrder) {
    const continuar = confirm(`Este ticket ya tiene una Orden de Servicio asociada (${existingOrder.folio || existingOrder.id}). ¿Estás seguro de que deseas forzar la creación de OTRA orden de servicio para este ticket?`);
    if (!continuar) return;
  }

  // Obtener lista de máquinas del cliente o catálogo general
  let maquinasOptions = [];
  const clienteNombre = t.cliente || '';
  if (clienteNombre && typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) {
    const cObj = clientesDb.find(c => c.nombre === clienteNombre || c.id === clienteNombre || c.idInterno === clienteNombre || c.rfc === clienteNombre);
    if (cObj && Array.isArray(cObj.maquinas)) {
      maquinasOptions = cObj.maquinas;
    }
  }
  if (maquinasOptions.length === 0 && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
    const normCli = String(clienteNombre).toLowerCase().trim();
    if (normCli) {
      maquinasOptions = maquinariaDb.filter(m => String(m.cliente || '').toLowerCase().trim() === normCli);
    }
  }

  // Obtener lista de técnicos disponibles
  const tecsSet = new Set();
  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) {
    tecnicosDb.forEach(tec => {
      const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(tec.nombre) : tec.nombre;
      if (n) tecsSet.add(n);
    });
  }
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    usuarios.filter(u => ['tecnico', 'supervisor', 'admin', 'superadmin'].includes(u.rol)).forEach(u => {
      const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(u.nombre) : u.nombre;
      if (n) tecsSet.add(n);
    });
  }
  const listaTecnicos = Array.from(tecsSet).sort();

  // Técnicos preasignados en el ticket
  let tecsAsignadosTicket = [];
  if (Array.isArray(t.tecnicosAsignados) && t.tecnicosAsignados.length > 0) {
    tecsAsignadosTicket = t.tecnicosAsignados;
  } else if (t.asignado) {
    tecsAsignadosTicket = String(t.asignado).split(',').map(s => s.trim()).filter(Boolean);
  }

  const tieneRefacciones = Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  overlay.innerHTML = `
    <div class="modal" style="max-width: 580px; width: 100%; max-height: 92vh; background: var(--bg-card, #1e2130); border: 1px solid var(--border, #2e3248); border-radius: var(--radius, 12px); box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.2s ease;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--border); background: var(--bg-secondary); flex-shrink: 0;">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="file-plus" style="color: #2563eb; width: 20px; height: 20px;"></i> Forzar Orden de Servicio (Superadmin)
        </h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); transition: var(--transition);">
          <i data-lucide="x" style="width: 18px; height: 18px;"></i>
        </button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 1.4rem; overflow-y: auto; flex: 1;">
        <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-secondary); font-weight: 500;">Ticket:</span> <strong style="color: var(--text-primary); font-weight: 700;">${t.folio || t.id}</strong></div>
            <div><span style="color: var(--text-secondary); font-weight: 500;">Estado:</span> <span class="badge badge-${typeof badgeTicketEstado === 'function' ? badgeTicketEstado(t) : 'abierto'}">${typeof getTicketEstadoLabel === 'function' ? getTicketEstadoLabel(t) : (t.estado || 'Abierto')}</span></div>
            <div style="grid-column: 1 / -1;"><span style="color: var(--text-secondary); font-weight: 500;">Cliente:</span> <strong style="color: var(--text-primary);">${t.cliente || 'Sin cliente especificado'}</strong> ${t.sitio ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(Sitio: ${t.sitio})</span>` : ''}</div>
            <div style="grid-column: 1 / -1;"><span style="color: var(--text-secondary); font-weight: 500;">Asunto:</span> <span style="color: var(--text-primary); font-weight: 500;">${t.asunto || '—'}</span></div>
          </div>
        </div>

        <form id="form-forzar-orden" onsubmit="event.preventDefault();">
          <div class="form-group" style="margin-bottom: 1.1rem;">
            <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Tipo de Visita / Servicio <span style="color: var(--red, #ef4444);">*</span></label>
            <select id="forzar-tipo-servicio" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-size: 0.88rem;">
              <option value="Servicio" ${(!t.tipo || t.tipo === 'Servicio') ? 'selected' : ''}>Servicio</option>
              <option value="Servicio preventivo" ${(t.tipo === 'Servicio preventivo' || (t.categoria && t.categoria.includes('Preventivo'))) ? 'selected' : ''}>Servicio preventivo</option>
              <option value="Servicio correctivo" ${(t.tipo === 'Servicio correctivo' || (t.categoria && t.categoria.includes('Correctivo'))) ? 'selected' : ''}>Servicio correctivo</option>
              <option value="Inspección" ${t.tipo === 'Inspección' ? 'selected' : ''}>Inspección</option>
              <option value="Entrega y puesta en marcha" ${(t.tipo === 'Entrega y puesta en marcha' || (t.categoria && t.categoria.includes('Puesta en Marcha'))) ? 'selected' : ''}>Entrega y puesta en marcha</option>
              <option value="Pre-entrega" ${(t.tipo === 'Pre-entrega' || (t.categoria && t.categoria.includes('Pre-Entrega'))) ? 'selected' : ''}>Pre-entrega</option>
              <option value="Garantía" ${(t.tipo === 'Garantía' || (t.categoria && t.categoria.includes('Garantía'))) ? 'selected' : ''}>Garantía</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.1rem;">
            <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Equipo / Maquinaria</label>
            <input type="text" id="forzar-equipo" value="${(t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo.replace(/"/g, '&quot;') : ''}" placeholder="Ej. [1234] CIFA K40H (SN: 9876)" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-size: 0.88rem;" />
            ${maquinasOptions.length > 0 ? `
              <div style="margin-top: 0.45rem; font-size: 0.78rem; color: var(--text-secondary);">
                <span style="font-weight: 500;">Sugerencias del cliente:</span> 
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                  ${maquinasOptions.slice(0, 6).map(m => {
                    const label = `${m.idInterno ? `[${m.idInterno}] ` : ''}${m.marca || ''} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
                    const safeLabel = label.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `<button type="button" style="cursor: pointer; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); font-size: 0.74rem; padding: 4px 8px; border-radius: 4px; font-weight: 500; transition: all 0.15s ease;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'" onclick="document.getElementById('forzar-equipo').value='${safeLabel}'">${label}</button>`;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="form-group" style="margin-bottom: 1.1rem;">
            <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Técnicos Asignados</label>
            <div style="max-height: 140px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.4rem; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 2px;">
              ${listaTecnicos.length > 0 ? listaTecnicos.map(tec => {
                const checked = tecsAsignadosTicket.some(st => String(st).toLowerCase().trim() === String(tec).toLowerCase().trim() || String(st).includes(tec));
                return `
                  <label style="display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; color: var(--text-primary); transition: background 0.15s ease;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" name="forzar-tecnicos" value="${tec.replace(/"/g, '&quot;')}" ${checked ? 'checked' : ''} style="width: 16px !important; height: 16px !important; min-width: 16px; margin: 0 !important; cursor: pointer; accent-color: #2563eb; flex-shrink: 0;" />
                    <span style="font-weight: 500;">${tec}</span>
                  </label>
                `;
              }).join('') : '<span style="font-size: 0.82rem; color: var(--text-muted); padding: 0.5rem;">No hay técnicos disponibles en la base de datos</span>'}
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.1rem;">
            <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">No. Pedido SAP <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(Opcional)</span></label>
            <input type="text" id="forzar-pedido-sap" value="${(t.pedidoSAP || '').replace(/"/g, '&quot;')}" placeholder="Ej. 10245" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-size: 0.88rem;" />
          </div>

          <div class="form-group" style="margin-bottom: 1.1rem;">
            <label style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Falla / Descripción del Servicio</label>
            <textarea id="forzar-falla" rows="3" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-size: 0.88rem; resize: vertical;">${((t.asunto ? t.asunto + '\n' : '') + (t.descripcion || '')).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
          </div>

          ${tieneRefacciones ? `
            <div class="form-group" style="margin-bottom: 1.2rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem 1rem;">
              <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                <input type="checkbox" id="forzar-incluir-refacciones" checked style="width: 16px !important; height: 16px !important; min-width: 16px; margin: 0 !important; cursor: pointer; accent-color: #2563eb; flex-shrink: 0;" />
                <span>Copiar ${t.refaccionesSeleccionadas.length} refacción(es) del ticket a la Orden de Servicio</span>
              </label>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.6rem 1.25rem; font-weight: 500; cursor: pointer; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); border-radius: var(--radius-sm); transition: var(--transition);">Cancelar</button>
            <button type="button" class="btn-primary" style="padding: 0.6rem 1.35rem; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; background: #2563eb; border: 1px solid #1d4ed8; color: #ffffff; border-radius: var(--radius-sm); box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);" id="btn-forzar-orden-confirmar">
              <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i> Crear y Vincular Orden
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });

  overlay.querySelector('#btn-forzar-orden-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-forzar-orden-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="spin" data-lucide="loader" style="width:16px;height:16px;"></i> Creando Orden...';
    if (window.lucide) window.lucide.createIcons({ root: btn });

    try {
      const tipoVal = overlay.querySelector('#forzar-tipo-servicio').value;
      const equipoVal = overlay.querySelector('#forzar-equipo').value.trim();
      const pedidoVal = overlay.querySelector('#forzar-pedido-sap').value.trim();
      const fallaVal = overlay.querySelector('#forzar-falla').value.trim();
      const incluirRef = overlay.querySelector('#forzar-incluir-refacciones')?.checked;

      const checkedTecs = Array.from(overlay.querySelectorAll('input[name="forzar-tecnicos"]:checked')).map(cb => cb.value);

      // 1. Extraer o asociar datos de maquinaria
      let modeloStr = '';
      let serieStr = '';
      let marcaStr = '';
      let ecoStr = '';
      let maquinariaId = null;

      const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
      
      const matchMaquina = (m, name) => {
        if (!m || !name) return false;
        const cleanId = m.idInterno || m.id || '';
        const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
        const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(cleanId) ||
          (m.serie && name.includes(m.serie))
        );
      };

      if (equipoVal) {
        const eqNames = equipoVal.split(',').map(s => s.trim()).filter(Boolean);
        const modelosArr = [];
        const seriesArr = [];
        const marcasArr = [];
        const ecosArr = [];

        eqNames.forEach(eqName => {
          let maq = null;
          if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb)) {
            clientesDb.forEach(c => {
              if (c.maquinas) {
                const found = c.maquinas.find(m => matchMaquina(m, eqName));
                if (found) maq = found;
              }
            });
          }
          if (!maq && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
            maq = maquinariaDb.find(m => matchMaquina(m, eqName));
          }

          if (maq) {
            if (maq.modelo) modelosArr.push(maq.modelo);
            if (maq.serie) seriesArr.push(maq.serie);
            if (maq.marca) marcasArr.push(maq.marca);
            if (maq.no_economico) ecosArr.push(maq.no_economico);
            if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
          } else {
            if (eqName.includes('(SN: ')) {
              const parts = eqName.split('(SN: ');
              const s = parts[1].replace(')', '').trim();
              let left = parts[0].trim();
              if (left.startsWith('[') && left.includes(']')) {
                left = left.substring(left.indexOf(']') + 1).trim();
              }
              modelosArr.push(left);
              seriesArr.push(s);
            } else {
              modelosArr.push(eqName);
            }
          }
        });

        modeloStr = [...new Set(modelosArr)].join(', ');
        serieStr = [...new Set(seriesArr)].join(', ');
        marcaStr = [...new Set(marcasArr)].join(', ');
        ecoStr = [...new Set(ecosArr)].join(', ');
      }

      // 2. Refacciones
      let refNecesariasManuales = [];
      if (incluirRef && t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
        refNecesariasManuales = t.refaccionesSeleccionadas.map(r => ({
          descripcion: r.nombre || r.descripcion || '',
          cantidad: (r.cantidad || 1).toString(),
          clave: r.codigo || r.clave || ''
        }));
      }

      // 3. Folio consecutivo
      let newFolio = (typeof generarFolioConsecutivo === 'function') ? generarFolioConsecutivo() : `OS-${Date.now()}`;
      const isTest = (typeof isTestData === 'function' && isTestData(t)) || (typeof isTestModeActive === 'function' && isTestModeActive());
      if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
        newFolio = `[PRUEBA] ${newFolio}`;
      }

      // 4. Crear objeto de Orden de Servicio
      const nuevaOrden = {
        id: newFolio,
        fecha: t.fechaCierre || t.fecha || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]),
        folio: newFolio,
        pedido: pedidoVal || t.pedidoSAP || '',
        cliente: t.cliente || '',
        ubicacion: t.sitio || '',
        ubicacion_sitio: '',
        operador: '',
        eco: ecoStr || '',
        horometro: t.horometro || '',
        modelo: modeloStr || '',
        serie: serieStr || '',
        marca: marcaStr || '',
        maquinaria_id: maquinariaId || null,
        equipo: equipoVal || t.equipo || '',
        tecnico: checkedTecs.join(', '),
        tecnicosAsignados: checkedTecs,
        soporte: t.id,
        creadoPor: (typeof window.getCurrentUserDisplayName === 'function') ? window.getCurrentUserDisplayName() : (currentSession?.nombre || 'Usuario'),
        km_ida: '', km_vuelta: '', km_total: '',
        tipo: tipoVal || 'Servicio',
        estado: 'Pendiente',
        falla: fallaVal || ((t.asunto ? t.asunto + '\n' : '') + (t.descripcion || '')),
        trabajos: '', dictamen: '', condiciones: '',
        observaciones: '', pendientes: '',
        ref_utilizadas: [],
        ref_necesarias: refNecesariasManuales,
        factura_ref: '', factura_mo: '',
        noches: '', alimentacion: '', traslado_costo: '',
        dias: [],
        esPrueba: isTest,
        _synced: false
      };

      // 5. Guardar orden
      if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
        ordenes.unshift(nuevaOrden);
      }
      safeSetJSON('sapi_ordenes', ordenes);

      if (window.supabaseClient) {
        await window.pushToSupabase('ordenes', nuevaOrden);
      }

      // 6. Actualizar ticket
      t.ordenId = nuevaOrden.id;
      t.ordenFolio = nuevaOrden.folio;
      
      const adminName = (currentSession && currentSession.nombre) ? currentSession.nombre : 'Superadmin';
      if (!Array.isArray(t.comentariosInternos)) t.comentariosInternos = [];
      t.comentariosInternos.push({
        id: 'com-' + Date.now(),
        usuario: adminName,
        rol: 'superadmin',
        texto: `Se forzó la creación de la Orden de Servicio ${nuevaOrden.folio} vinculada a este ticket.`,
        fecha: new Date().toISOString(),
        leidoPor: [{ usuario: adminName, fecha: new Date().toISOString() }]
      });

      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        await window.pushToSupabase('tickets', t);
      }

      mostrarNotificacion(`Orden de Servicio ${nuevaOrden.folio} generada y vinculada exitosamente.`, 'success');

      overlay.remove();

      // Refrescar UI
      if (typeof renderTickets === 'function') renderTickets();
      if (typeof renderTabla === 'function') renderTabla('servicios');
      if (typeof updateTicketBadge === 'function') updateTicketBadge();
      if (typeof updateOrdenesBadge === 'function') updateOrdenesBadge();

      // Si el detalle del ticket está abierto, refrescarlo para mostrar el banner de la nueva orden
      const overlayDetalle = document.getElementById('modal-ticket-detalle-overlay');
      if (overlayDetalle && overlayDetalle.classList.contains('open') && typeof verDetalleTicket === 'function') {
        verDetalleTicket(t.id);
      }

    } catch (err) {
      console.error('[ForzarCrearOrden] Error:', err);
      mostrarNotificacion('Error al generar la orden de servicio: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="file-plus" style="width:16px;height:16px;"></i> Reintentar Creación';
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  });
};

export {
  renderComentariosInternosHtml,
  switchCommentTab,
  agregarComentarioInterno,
  agregarComentarioExterno,
  verDetalleTicket,
  visualizarPdfOnDemand,
  visualizarDestinoPdfActual,
  descargarPdfOnDemand,
  avanzarCotizacionTicket,
  cerrarCotizacionTicket,
  cerrarDetalleTicket,
  forzarEstadoTicket,
  forzarCrearOrdenServicio
};

if (typeof window !== "undefined") {
  window.TicketsDetalle = {
    renderComentariosInternosHtml,
    switchCommentTab,
    agregarComentarioInterno,
    agregarComentarioExterno,
    verDetalleTicket,
    visualizarPdfOnDemand,
    visualizarDestinoPdfActual,
    descargarPdfOnDemand,
    avanzarCotizacionTicket,
    cerrarCotizacionTicket,
    cerrarDetalleTicket,
    forzarEstadoTicket,
    forzarCrearOrdenServicio
  };
  window.renderComentariosInternosHtml = renderComentariosInternosHtml;
  window.switchCommentTab = switchCommentTab;
  window.agregarComentarioInterno = agregarComentarioInterno;
  window.agregarComentarioExterno = agregarComentarioExterno;
  window.verDetalleTicket = verDetalleTicket;
  window.visualizarPdfOnDemand = visualizarPdfOnDemand;
  window.visualizarDestinoPdfActual = visualizarDestinoPdfActual;
  window.descargarPdfOnDemand = descargarPdfOnDemand;
  window.avanzarCotizacionTicket = avanzarCotizacionTicket;
  window.cerrarCotizacionTicket = cerrarCotizacionTicket;
  window.cerrarDetalleTicket = cerrarDetalleTicket;
  window.forzarEstadoTicket = forzarEstadoTicket;
  window.forzarCrearOrdenServicio = forzarCrearOrdenServicio;
}
