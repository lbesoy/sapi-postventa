/**
 * Módulo de Detalle, Comentarios y Adjuntos de Tickets - Eurorep / SAPI
 * Vanilla Browser Bundle (retrocompatibilidad total con llamadas globales y eventos HTML)
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.keys(exports).forEach(function(k) {
      root[k] = exports[k];
      if (typeof window !== 'undefined') window[k] = exports[k];
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function() {
  "use strict";

  function safeNorm(s) {
    if (!s) return "";
    if (typeof window !== "undefined" && typeof window.normStr === "function") return window.normStr(s);
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function safeFormatFechaHoraAmigable(dateStr) {
    if (typeof window !== "undefined" && typeof window.formatFechaHoraAmigable === "function") return window.formatFechaHoraAmigable(dateStr);
    return String(dateStr || "");
  }

  function safeEscapeHTML(str) {
    if (typeof window !== "undefined" && typeof window.escapeHTML === "function") return window.escapeHTML(str);
    return String(str || "").replace(/[&<>'"]/g, function(tag) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[tag] || tag;
    });
  }

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



// ===== TOGGLE DESCRIPCIÓN TICKET =====
function toggleDescripcionTicket(ticketId) {
  if (typeof document === 'undefined') return;
  const body = document.getElementById(`body-detalle-desc-${ticketId}`);
  const preview = document.getElementById(`preview-detalle-desc-${ticketId}`);
  const text = document.getElementById(`text-toggle-desc-${ticketId}`);
  const icon = document.getElementById(`icon-toggle-desc-${ticketId}`);
  if (!body) return;

  const isCollapsed = body.style.display === 'none';
  if (isCollapsed) {
    body.style.display = 'block';
    if (preview) preview.style.display = 'none';
    if (text) text.textContent = 'Contraer';
    if (icon) {
      icon.setAttribute('data-lucide', 'chevron-up');
    }
  } else {
    body.style.display = 'none';
    if (preview) preview.style.display = 'block';
    if (text) text.textContent = 'Expandir';
    if (icon) {
      icon.setAttribute('data-lucide', 'chevron-down');
    }
  }
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  } else if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ===== COTIZADOR INTERNO (BETA PRIVADA) =====
if (typeof window !== 'undefined' && !window._tempCotizaciones) {
  window._tempCotizaciones = {};
}

const COTIZADOR_LINEAS = [
  { id: 'CON', nombre: 'CON · Concreto' },
  { id: 'TRI', nombre: 'TRI · Trituración' },
  { id: 'CIM', nombre: 'CIM · Cimentación' }
];

const COTIZADOR_DESCUENTOS_CLIENTE = {
  'Externo': { mo: 0, viaticos: 0, label: 'Externo' },
  'Externo AAA': { mo: 10, viaticos: 5, label: 'Externo AAA' },
  'Socio': { mo: 25, viaticos: 10, label: 'Socio' },
  'Interno': { mo: 35, viaticos: 15, label: 'Interno' }
};

const COTIZADOR_TARIFAS_CUADRILLA = {
  1: { titulo: '1 Ingeniero', externo: 3690.20, euro: 2398.63, socio: 2767.65 },
  2: { titulo: 'Ingeniero + Auxiliar', externo: 6642.35, euro: 4317.53, socio: 4981.76 },
  3: { titulo: 'Ingeniero + 2 Auxiliares', externo: 9594.52, euro: 6236.44, socio: 7195.89 },
  4: { titulo: 'Ingeniero + 3 Auxiliares', externo: 12546.68, euro: 8155.34, socio: 9410.01 },
  5: { titulo: 'Ingeniero + 4 Auxiliares', externo: 15498.84, euro: 10074.25, socio: 11624.13 },
  6: { titulo: 'Ingeniero + 5 Auxiliares', externo: 18451.00, euro: 11993.15, socio: 13838.25 }
};

const COTIZADOR_TARIFAS_HOSPEDAJE = {
  1: 1000,
  2: 1500,
  3: 2500,
  4: 3000,
  5: 4000,
  6: 4500
};

function renderCotizadorInternoTicketHtml(t) {
  const isSuperadmin = safeEsUsuarioSuperadmin();
  const isStaffAdmin = isSuperadmin || (typeof currentSession !== 'undefined' && currentSession && ['superadmin', 'admin', 'supervisor'].includes(String(currentSession.viewMode || currentSession.realRol || currentSession.rol || '').toLowerCase().trim()));
  const isClientView = ['empresa', 'cliente', 'cliente-consultor'].includes(window.currentSession?.viewMode);
  if (!isStaffAdmin || isClientView) return '';

  // No mostrar cotizador si el ticket está en estado inicial/pendiente de refacciones (solo en etapa 'Refacciones', 'Cotización' o 'Cerrado')
  const estadoNorm = String(t && t.estado || '').trim().toLowerCase();
  if (!t || estadoNorm === 'abierto' || estadoNorm === 'pendiente' || !estadoNorm) return '';

  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  if (!window._tempCotizaciones) window._tempCotizaciones = {};
  if (!window._tempCotizaciones[t.id]) {
    if (t.cotizacionInterna && Array.isArray(t.cotizacionInterna.items)) {
      window._tempCotizaciones[t.id] = JSON.parse(JSON.stringify(t.cotizacionInterna));
      window._tempCotizaciones[t.id].guardada = true;
    } else {
      window._tempCotizaciones[t.id] = {
        linea: 'CON',
        tipoCliente: 'Externo',
        asistente: {
          diasProyecto: 1,
          numPersonas: 2,
          tipoTarifaMo: 'externo',
          descripcionServicio: '',
          origen: 'CDMX',
          destino: t.ubicacion || t.obra || '',
          km: 0,
          idaYVueltaKm: true,
          factorKm: 11,
          casetasMonto: 0,
          idaYVueltaCasetas: true,
          diasAlimentos: 1,
          nochesHospedaje: 1,
          precioHospedajeManual: 0,
          nochesPorFuera: 0,
          rendimientoKml: 9,
          precioCombustible: 30,
          mostrarAsistente: false
        },
        items: [],
        incluirIva: true,
        tasaIva: 0.16,
        subtotalLista: 0,
        descuentoTotal: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
        claraTotal: 0,
        guardada: false
      };
    }
  }

  const draft = window._tempCotizaciones[t.id];
  if (!draft.linea) draft.linea = 'CON';
  if (!draft.tipoCliente) draft.tipoCliente = 'Externo AAA';
  if (!draft.asistente || typeof draft.asistente !== 'object') {
    draft.asistente = {
      diasProyecto: 1,
      numPersonas: 2,
      tipoTarifaMo: 'externo',
      descripcionServicio: '',
      origen: 'CDMX',
      destino: t.ubicacion || t.obra || '',
      km: 0,
      idaYVueltaKm: true,
      factorKm: 11,
      casetasMonto: 0,
      idaYVueltaCasetas: true,
      diasAlimentos: 1,
      nochesHospedaje: 1,
      precioHospedajeManual: 0,
      nochesPorFuera: 0,
      rendimientoKml: 9,
      precioCombustible: 30,
      mostrarAsistente: false
    };
  }

  // Recalcular montos preliminares
  window.recalcularCotizacionTicket(t.id);

  const asis = draft.asistente;
  const descPolicy = COTIZADOR_DESCUENTOS_CLIENTE[draft.tipoCliente] || COTIZADOR_DESCUENTOS_CLIENTE['Externo AAA'];
  const countPiezas = (t.refaccionesSeleccionadas && Array.isArray(t.refaccionesSeleccionadas)) ? t.refaccionesSeleccionadas.length : 0;

  return `
    <datalist id="list-sugerencias-servicios">
      <option value="Instalación de refacciones en Camión Revolvedor"></option>
      <option value="Mano de obra correctiva"></option>
      <option value="Mano de obra preventiva"></option>
      <option value="Diagnóstico técnico en sitio"></option>
      <option value="Puesta en marcha y calibración"></option>
      <option value="Servicio especializado hidroneumático"></option>
    </datalist>
    <datalist id="list-sugerencias-viaticos">
      <option value="Kilometraje de traslado"></option>
      <option value="Casetas de autopista"></option>
      <option value="Viáticos de alimentos"></option>
      <option value="Hospedaje de técnicos"></option>
      <option value="Noches por fuera"></option>
    </datalist>

    <div class="detalle-section" id="section-cotizador-interno-${t.id}" style="background: var(--bg-hover); padding: 1.1rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.85rem; border: 1px solid rgba(232, 130, 12, 0.35); box-shadow: var(--shadow-sm); margin-top: 0.5rem; margin-bottom: 1rem;">
      
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.65rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(232, 130, 12, 0.15); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="calculator" style="width: 17px; height: 17px;"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>Cotizador Interno</span>
              <span style="font-size: 0.65rem; background: rgba(232, 130, 12, 0.12); color: var(--accent); border: 1px solid rgba(232, 130, 12, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 3px;">
                <i data-lucide="lock" style="width: 10px; height: 10px;"></i> Beta · Privado
              </span>
              <span id="cotizador-badge-saved-${t.id}" style="font-size: 0.65rem; background: ${draft.guardada ? 'rgba(34, 197, 94, 0.12)' : 'rgba(100, 116, 139, 0.1)'}; color: ${draft.guardada ? '#22c55e' : 'var(--text-muted)'}; border: 1px solid ${draft.guardada ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}; padding: 2px 6px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                <i data-lucide="${draft.guardada ? 'check' : 'clock'}" style="width: 10px; height: 10px;"></i> ${draft.guardada ? 'Guardada' : 'Borrador'}
              </span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
              Presupuesto estructurado: Refacciones, Cuadrilla MO, Traslados y Viáticos Clara.
            </div>
          </div>
        </div>

        <!-- Header Right: Quick Total & Toggle -->
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="text-align: right;">
            <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Cotizado</div>
            <div id="cotizador-header-total-${t.id}" style="font-weight: 800; font-size: 1.1rem; color: var(--accent);">
              ${formatMoney(draft.total || 0)}
            </div>
          </div>
          <button type="button" onclick="window.toggleCotizadorInterno('${t.id}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;" title="Mostrar / Ocultar Cotizador">
            <span id="cotizador-toggle-text-${t.id}">Contraer</span>
            <i data-lucide="chevron-up" id="cotizador-toggle-icon-${t.id}" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </div>

      <!-- BODY CONTAINER (Collapsible) -->
      <div id="cotizador-body-container-${t.id}" style="display: flex; flex-direction: column; gap: 0.75rem;">

        <!-- BARRA DE PARÁMETROS GLOBALES (Paso 1 y 2) -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem; background: var(--bg-card); border: 1px solid var(--border); padding: 0.55rem 0.85rem; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
            <!-- Paso 1: Línea -->
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Línea:</span>
              <select 
                id="cot-param-linea-${t.id}"
                onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'global', 'linea', this.value)"
                style="padding: 0.28rem 0.45rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-hover); color: var(--text-primary); font-size: 0.78rem; font-weight: 600;"
              >
                ${COTIZADOR_LINEAS.map(l => `<option value="${l.id}" ${draft.linea === l.id ? 'selected' : ''}>${l.nombre}</option>`).join('')}
              </select>
            </div>

            <!-- Paso 2: Tipo de Cliente -->
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Tipo de Cliente:</span>
              <select 
                id="cot-param-tipo-cliente-${t.id}"
                onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'global', 'tipoCliente', this.value)"
                style="padding: 0.28rem 0.45rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-hover); color: var(--text-primary); font-size: 0.78rem; font-weight: 600;"
              >
                <option value="Externo" ${draft.tipoCliente === 'Externo' ? 'selected' : ''}>Externo (Sin desc.)</option>
                <option value="Externo AAA" ${draft.tipoCliente === 'Externo AAA' ? 'selected' : ''}>Externo AAA (10% MO / 5% Viát.)</option>
                <option value="Socio" ${draft.tipoCliente === 'Socio' ? 'selected' : ''}>Socio (25% MO / 10% Viát.)</option>
                <option value="Interno" ${draft.tipoCliente === 'Interno' ? 'selected' : ''}>Interno (35% MO / 15% Viát.)</option>
              </select>
            </div>

            <!-- Badge Descuento -->
            <div id="cot-badge-desc-${t.id}" style="font-size: 0.72rem; background: rgba(37, 99, 235, 0.08); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.2); padding: 3px 8px; border-radius: 4px;">
              Desc. Política: MO: <strong>${descPolicy.mo}%</strong> | Viáticos: <strong>${descPolicy.viaticos}%</strong>
            </div>
          </div>

          <!-- Botón abrir Asistente Lateral (Drawer) -->
          <button 
            type="button" 
            onclick="window.toggleAsistenteCotizadorTicket('${t.id}')"
            class="btn-primary" 
            style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 700; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-color: #2563eb; color: #ffffff; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);"
            title="Abrir panel lateral para calcular cuadrilla, traslados y viáticos"
          >
            <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
            <span>🪄 Asistente Cuadrilla y Viáticos</span>
          </button>
        </div>

        <!-- TOOLBAR DE BOTONES RÁPIDOS -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: var(--bg-card); border: 1px solid var(--border); padding: 0.45rem 0.65rem; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span style="font-size: 0.74rem; font-weight: 600; color: var(--text-secondary); margin-right: 0.25rem;">Concepto manual:</span>
            <button type="button" class="btn-secondary" onclick="window.agregarItemCotizacionTicket('${t.id}', 'refaccion')" style="padding: 0.28rem 0.6rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; background: rgba(232, 130, 12, 0.08); border: 1px solid rgba(232, 130, 12, 0.25); color: var(--accent);">
              <i data-lucide="package" style="width: 13px; height: 13px;"></i> + Refacción
            </button>
            <button type="button" class="btn-secondary" onclick="window.agregarItemCotizacionTicket('${t.id}', 'servicio')" style="padding: 0.28rem 0.6rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); color: #2563eb;">
              <i data-lucide="wrench" style="width: 13px; height: 13px;"></i> + Servicio / MO
            </button>
            <button type="button" class="btn-secondary" onclick="window.agregarItemCotizacionTicket('${t.id}', 'viaticos')" style="padding: 0.28rem 0.6rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); color: #10b981;">
              <i data-lucide="map-pin" style="width: 13px; height: 13px;"></i> + Viáticos / KM
            </button>
            ${countPiezas > 0 ? `
              <button type="button" class="btn-secondary" onclick="window.importarRefaccionesEnCotizacionTicket('${t.id}')" style="padding: 0.28rem 0.65rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary);" title="Copiar refacciones solicitadas en el ticket">
                <i data-lucide="download" style="width: 13px; height: 13px; color: var(--accent);"></i> Cargar Refacciones (${countPiezas})
              </button>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <button type="button" class="btn-primary" onclick="window.copiarTablaCotizacionExcel('${t.id}')" style="padding: 0.32rem 0.75rem; font-size: 0.76rem; font-weight: 700; background: #16a34a; border-color: #16a34a; color: #ffffff; border-radius: 5px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.12);" title="Copiar tabla completa formateada para pegar en Excel o Sheets con Ctrl+V">
              <i data-lucide="clipboard-copy" style="width: 14px; height: 14px;"></i> 📋 Copiar para Excel
            </button>
            <button type="button" class="btn-secondary" onclick="window.descargarCsvCotizacionExcel('${t.id}')" style="padding: 0.32rem 0.65rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); cursor: pointer;" title="Descargar archivo CSV compatible con Excel">
              <i data-lucide="download" style="width: 13px; height: 13px;"></i> CSV
            </button>
            <button type="button" class="btn-secondary" onclick="window.mostrarModalVistaExcel('${t.id}')" style="padding: 0.32rem 0.65rem; font-size: 0.74rem; font-weight: 600; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer;" title="Ver tabla en texto plano para copiar manualmente">
              <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Vista Texto
            </button>
          </div>
        </div>

        <!-- TABLA DE PARTIDAS -->
        <div id="cotizador-table-wrapper-${t.id}" style="overflow-x: auto; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border);">
          ${renderTablaCotizacionTicket(t.id)}
        </div>

        <!-- TOTALES Y DESGLOSE FINANCIERO -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.35rem;">
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
            <span id="cot-margen-estimado-${t.id}" style="background: rgba(0,0,0,0.04); border: 1px solid var(--border); padding: 3px 8px; border-radius: 4px; font-weight: 600;">
              Margen est.: Calculado al guardar
            </span>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: stretch; flex-wrap: wrap;">
            <!-- Subtotal Lista -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; min-width: 105px;">
              <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Subtotal Lista</span>
              <span id="cotizador-val-subtotal-lista-${t.id}" style="font-weight: 700; font-size: 0.88rem; color: var(--text-secondary);">${formatMoney(draft.subtotalLista || draft.subtotal || 0)}</span>
            </div>
            <!-- Descuentos -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; min-width: 105px;">
              <span style="font-size: 0.65rem; color: #ef4444; text-transform: uppercase; font-weight: 600;">Descuentos</span>
              <span id="cotizador-val-descuento-${t.id}" style="font-weight: 700; font-size: 0.88rem; color: #ef4444;">-${formatMoney(draft.descuentoTotal || 0)}</span>
            </div>
            <!-- Subtotal Neto -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; min-width: 110px;">
              <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Subtotal Neto</span>
              <span id="cotizador-val-subtotal-${t.id}" style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary);">${formatMoney(draft.subtotal || 0)}</span>
            </div>
            <!-- IVA 16% -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; align-items: flex-end; min-width: 120px;">
              <label style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0;">
                <input type="checkbox" id="cotizador-chk-iva-${t.id}" ${draft.incluirIva !== false ? 'checked' : ''} onchange="window.toggleIvaCotizacionTicket('${t.id}', this.checked)" style="margin: 0; cursor: pointer;" />
                IVA (16%)
              </label>
              <span id="cotizador-val-iva-${t.id}" style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary);">${formatMoney(draft.iva || 0)}</span>
            </div>
            <!-- Total Cotizado -->
            <div style="background: linear-gradient(135deg, rgba(232, 130, 12, 0.12) 0%, rgba(232, 130, 12, 0.03) 100%); border: 1px solid rgba(232, 130, 12, 0.35); border-radius: 6px; padding: 0.4rem 0.95rem; display: flex; flex-direction: column; align-items: flex-end; min-width: 140px;">
              <span style="font-size: 0.66rem; color: var(--accent); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Total Cotizado</span>
              <span id="cotizador-val-total-${t.id}" style="font-weight: 800; font-size: 1.15rem; color: var(--accent);">${formatMoney(draft.total || 0)}</span>
            </div>
          </div>
        </div>

        <!-- FOOTER ACTIONS -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.65rem; margin-top: 0.25rem; flex-wrap: wrap; gap: 0.5rem;">
          <button type="button" class="btn-secondary" onclick="window.limpiarCotizacionInternaTicket('${t.id}')" style="padding: 0.35rem 0.75rem; font-size: 0.76rem; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.05); cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Limpiar
          </button>
          
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="btn-primary" id="btn-guardar-cot-interna-${t.id}" onclick="window.guardarCotizacionInternaTicket('${t.id}')" style="background: var(--green); border-color: var(--green); padding: 0.45rem 1.15rem; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 6px;">
              <i data-lucide="save" style="width: 15px; height: 15px;"></i> Guardar Cotización Interna
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- BACKDROP Y DRAWER LATERAL: ASISTENTE CUADRILLA, TRASLADOS Y VIÁTICOS -->
    <div id="cotizador-drawer-backdrop-${t.id}" class="cotizador-drawer-backdrop" onclick="window.toggleAsistenteCotizadorTicket('${t.id}')"></div>

    <div id="cotizador-drawer-${t.id}" class="cotizador-drawer">
      <div class="cotizador-drawer-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(37, 99, 235, 0.12); color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); line-height: 1.2;">Asistente de Presupuesto</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Cuadrilla MO, Traslado y Viáticos Clara</div>
          </div>
        </div>
        <button type="button" onclick="window.toggleAsistenteCotizadorTicket('${t.id}')" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1.3rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; line-height: 1;">✕</button>
      </div>

      <div class="cotizador-drawer-body">
        <div style="font-size: 0.74rem; color: var(--text-secondary); background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(37, 99, 235, 0.2); padding: 0.5rem 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="info" style="width: 14px; height: 14px; color: #2563eb; flex-shrink: 0;"></i>
          <span>Ajusta las variables operativas y haz clic en <strong>"Cargar a la Tabla de Excel"</strong> para transferir las partidas a la cotización.</span>
        </div>

        <!-- TARJETA 1: MANO DE OBRA (ZFAC02) -->
        <div style="background: var(--bg-hover); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 6px; padding: 0.65rem; display: flex; flex-direction: column; gap: 0.45rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #2563eb; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(37, 99, 235, 0.15); padding-bottom: 0.35rem;">
            <i data-lucide="users" style="width: 13px; height: 13px;"></i> Paso 3 · Cuadrilla MO (ZFAC02)
          </div>
          <div style="display: flex; gap: 0.45rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Días Proyecto</label>
              <input 
                type="number" 
                min="0.5" 
                step="0.5" 
                value="${asis.diasProyecto || 1}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.78rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'diasProyecto', this.value)"
              />
            </div>
            <div style="flex: 2;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Cuadrilla Personas</label>
              <select 
                style="width: 100%; padding: 0.25rem 0.3rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'numPersonas', this.value)"
              >
                ${[1, 2, 3, 4, 5, 6].map(n => `
                  <option value="${n}" ${parseInt(asis.numPersonas, 10) === n ? 'selected' : ''}>
                    ${n} Pers: ${COTIZADOR_TARIFAS_CUADRILLA[n].titulo} (${formatMoney(COTIZADOR_TARIFAS_CUADRILLA[n].externo)}/d)
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
          <div>
            <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Tarifa Aplicada</label>
            <select 
              style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
              onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'tipoTarifaMo', this.value)"
            >
              <option value="externo" ${(asis.tipoTarifaMo || 'externo') === 'externo' ? 'selected' : ''}>Tarifa Lista (M.O. Externo)</option>
              <option value="euro" ${asis.tipoTarifaMo === 'euro' ? 'selected' : ''}>Tarifa Euro / Interno</option>
              <option value="socio" ${asis.tipoTarifaMo === 'socio' ? 'selected' : ''}>Tarifa Socio</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Descripción del Servicio</label>
            <input 
              type="text" 
              value="${(asis.descripcionServicio || '').replace(/"/g, '&quot;')}" 
              placeholder="ej. Instalación de refacciones en Camión Revolvedor" 
              style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
              oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'descripcionServicio', this.value)"
            />
          </div>
        </div>

        <!-- TARJETA 2: TRASLADO, KM Y CASETAS (ZFAC10) -->
        <div style="background: var(--bg-hover); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 0.65rem; display: flex; flex-direction: column; gap: 0.45rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(16, 185, 129, 0.15); padding-bottom: 0.35rem;">
            <i data-lucide="map-pin" style="width: 13px; height: 13px;"></i> Paso 4 · Traslado y Casetas (ZFAC10)
          </div>
          <div style="display: flex; gap: 0.45rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Origen</label>
              <input 
                type="text" 
                value="${(asis.origen || 'CDMX').replace(/"/g, '&quot;')}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'origen', this.value)"
              />
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Destino</label>
              <input 
                type="text" 
                value="${(asis.destino || '').replace(/"/g, '&quot;')}" 
                placeholder="Ubicación/Obra" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'destino', this.value)"
              />
            </div>
          </div>
          <div style="display: flex; gap: 0.45rem; align-items: flex-end;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Distancia (KM)</label>
              <input 
                type="number" 
                min="0" 
                value="${asis.km || 0}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'km', this.value)"
              />
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Factor $/KM</label>
              <input 
                type="number" 
                min="1" 
                step="0.5" 
                value="${asis.factorKm || 11}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'factorKm', this.value)"
              />
            </div>
            <div style="display: flex; align-items: center; gap: 3px; padding-bottom: 0.35rem;">
              <input 
                type="checkbox" 
                id="cot-asis-idavuelta-km-${t.id}"
                ${asis.idaYVueltaKm !== false ? 'checked' : ''} 
                onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'idaYVueltaKm', this.checked)"
                style="margin: 0; cursor: pointer;"
              />
              <label for="cot-asis-idavuelta-km-${t.id}" style="font-size: 0.68rem; color: var(--text-muted); cursor: pointer; white-space: nowrap;">Ida y vta (x2)</label>
            </div>
          </div>
          <div style="display: flex; gap: 0.45rem; align-items: flex-end;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Casetas Peaje ($)</label>
              <input 
                type="number" 
                min="0" 
                step="50" 
                value="${asis.casetasMonto || 0}" 
                placeholder="0.00"
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'casetasMonto', this.value)"
              />
            </div>
            <div style="display: flex; align-items: center; gap: 3px; padding-bottom: 0.35rem;">
              <input 
                type="checkbox" 
                id="cot-asis-idavuelta-cas-${t.id}"
                ${asis.idaYVueltaCasetas !== false ? 'checked' : ''} 
                onchange="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'idaYVueltaCasetas', this.checked)"
                style="margin: 0; cursor: pointer;"
              />
              <label for="cot-asis-idavuelta-cas-${t.id}" style="font-size: 0.68rem; color: var(--text-muted); cursor: pointer; white-space: nowrap;">Ida y vta (x2)</label>
            </div>
          </div>
        </div>

        <!-- TARJETA 3: VIÁTICOS Y HOSPEDAJE (ZFAC05) -->
        <div style="background: var(--bg-hover); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 6px; padding: 0.65rem; display: flex; flex-direction: column; gap: 0.45rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #8b5cf6; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(139, 92, 246, 0.15); padding-bottom: 0.35rem;">
            <i data-lucide="hotel" style="width: 13px; height: 13px;"></i> Paso 5 · Viáticos Campo (ZFAC05)
          </div>
          <div style="display: flex; gap: 0.45rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Días Alimentos ($550 pp)</label>
              <input 
                type="number" 
                min="0" 
                value="${asis.diasAlimentos !== undefined ? asis.diasAlimentos : 1}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'diasAlimentos', this.value)"
              />
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Noches Hospedaje</label>
              <input 
                type="number" 
                min="0" 
                value="${asis.nochesHospedaje !== undefined ? asis.nochesHospedaje : 1}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'nochesHospedaje', this.value)"
              />
            </div>
          </div>
          <div style="display: flex; gap: 0.45rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Hospedaje Tarifa/Noche ($)</label>
              <input 
                type="number" 
                min="0" 
                step="100" 
                value="${asis.precioHospedajeManual || COTIZADOR_TARIFAS_HOSPEDAJE[parseInt(asis.numPersonas, 10) || 2] || 1500}" 
                placeholder="Auto por personas"
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'precioHospedajeManual', this.value)"
              />
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">Noches Fuera ($300 pp)</label>
              <input 
                type="number" 
                min="0" 
                value="${asis.nochesPorFuera || 0}" 
                style="width: 100%; padding: 0.25rem 0.4rem; font-size: 0.76rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); box-sizing: border-box;"
                oninput="window.actualizarParametroCotizadorTicket('${t.id}', 'asistente', 'nochesPorFuera', this.value)"
              />
            </div>
          </div>
          <div style="font-size: 0.68rem; color: var(--text-muted); line-height: 1.3;">
            Tarifa ref. hospedaje: 1p: $1k, 2p: $1.5k, 3p: $2.5k, 4p: $3k.
          </div>
        </div>

        <!-- BANNER VERDE: SOLICITUD DE FONDEO CLARA (ANTICIPO OPERATIVO) -->
        <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 6px; padding: 0.65rem 0.85rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 24px; height: 24px; border-radius: 5px; background: rgba(34, 197, 94, 0.2); color: #16a34a; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="credit-card" style="width: 13px; height: 13px;"></i>
              </div>
              <div style="font-size: 0.72rem; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                Solicitud de Clara (Fondeo Técnico)
              </div>
            </div>
            <button 
              type="button" 
              onclick="window.copiarResumenClaraTicket('${t.id}')"
              class="btn-secondary" 
              style="padding: 0.25rem 0.5rem; font-size: 0.7rem; font-weight: 600; border-radius: 4px; border: 1px solid rgba(34, 197, 94, 0.4); background: #ffffff; color: #16a34a; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
              title="Copiar desglose para solicitud de tarjeta Clara"
            >
              <i data-lucide="copy" style="width: 11px; height: 11px;"></i> Copiar
            </button>
          </div>

          <div style="font-size: 0.74rem; color: var(--text-secondary); line-height: 1.4;">
            Gasolina: <strong id="cot-clara-gas-${t.id}">${formatMoney(draft.claraCombustible || 0)}</strong> · 
            Casetas: <strong id="cot-clara-casetas-${t.id}">${formatMoney(draft.claraCasetas || 0)}</strong> · 
            Viáticos: <strong id="cot-clara-viaticos-${t.id}">${formatMoney(draft.claraViaticos || (draft.claraHospedaje + draft.claraAlimentos) || 0)}</strong>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(34, 197, 94, 0.2); padding-top: 0.35rem; margin-top: 0.15rem;">
            <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Fondeo Clara</span>
            <span id="cot-clara-total-${t.id}" style="font-size: 1.05rem; font-weight: 800; color: #16a34a;">${formatMoney(draft.claraTotal || 0)}</span>
          </div>
        </div>

      </div>

      <div class="cotizador-drawer-footer">
        <button type="button" class="btn-secondary" onclick="window.toggleAsistenteCotizadorTicket('${t.id}')" style="padding: 0.45rem 0.85rem; font-size: 0.78rem;">
          Cerrar
        </button>
        <button 
          type="button" 
          onclick="window.cargarConceptosAsistenteEnCotizacion('${t.id}')"
          class="btn-primary" 
          style="padding: 0.48rem 1.15rem; font-size: 0.82rem; font-weight: 700; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-color: #2563eb; color: #ffffff; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);"
        >
          <i data-lucide="sparkles" style="width: 15px; height: 15px;"></i>
          ⚡ Cargar a la Tabla de Excel
        </button>
      </div>
    </div>
  `;
}

function generarDatosExportacionExcel(ticketId) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return null;

  const items = draft.items || [];
  const asis = draft.asistente || {};
  const linea = draft.linea || 'CON';

  const headers = [
    'No artic',
    'Descr',
    'Descr Larga',
    'Unidad de N',
    'Canti',
    'PxU',
    'Descuento',
    'Precio Neto',
    'Total',
    'Costo unit',
    'Total costo'
  ];

  const rows = [];
  let sumCanti = 0;
  let sumTotalNeto = 0;
  let sumTotalCosto = 0;

  items.forEach(it => {
    const cant = parseFloat(it.cantidad) || 0;
    const pu = parseFloat(it.precioUnitario) || 0;
    const descPct = (it.descuento !== undefined && it.descuento !== null && it.descuento !== '')
      ? (parseFloat(it.descuento) || 0)
      : 0;
    const pNeto = pu * (1 - descPct / 100);
    const totNeto = cant * pNeto;
    const cUnit = parseFloat(it.costoUnitario) || 0;
    const totCosto = cant * cUnit;

    sumCanti += cant;
    sumTotalNeto += totNeto;
    sumTotalCosto += totCosto;

    rows.push([
      it.codigo || '',
      it.marca || '',
      it.descripcion || '',
      it.unidad || linea,
      cant.toFixed(2),
      pu.toFixed(2),
      descPct > 0 ? (descPct.toFixed(2) + '%') : '0.00%',
      pNeto.toFixed(2),
      totNeto.toFixed(2),
      cUnit.toFixed(2),
      totCosto.toFixed(2)
    ]);
  });

  // TSV representation
  let tsv = headers.join('\t') + '\r\n';
  rows.forEach(r => {
    tsv += r.join('\t') + '\r\n';
  });
  tsv += `TOTALES\t\t\t\t${sumCanti.toFixed(2)}\t\t\t\t${sumTotalNeto.toFixed(2)}\t\t${sumTotalCosto.toFixed(2)}\r\n`;
  tsv += `\r\n`;
  tsv += `RESUMEN FINANCIERO\r\n`;
  tsv += `Subtotal Lista:\t${(draft.subtotalLista || sumTotalNeto).toFixed(2)}\r\n`;
  tsv += `Descuentos:\t-${(draft.descuentoTotal || 0).toFixed(2)}\r\n`;
  tsv += `Subtotal Neto:\t${(draft.subtotal || sumTotalNeto).toFixed(2)}\r\n`;
  tsv += `IVA (16%):\t${(draft.iva || 0).toFixed(2)}\r\n`;
  tsv += `TOTAL COTIZADO:\t${(draft.total || sumTotalNeto).toFixed(2)}\r\n`;

  // Clara table
  const kmTotal = (parseFloat(asis.km) || 0) * (asis.idaYVueltaKm !== false ? 2 : 1);
  tsv += `\r\n`;
  tsv += `SOLICITUD DE CLARA (CÁLCULO DE VIÁTICOS)\r\n`;
  tsv += `Kilometraje\tPrecio combustible\tRendimiento km/l\tCasetas\tViaticos hospedaje\tAlimentos / Noches fuera\tTotal a pedir\r\n`;
  tsv += `${kmTotal} KM\t$${(parseFloat(asis.precioCombustible) || 30).toFixed(2)}\t${parseFloat(asis.rendimientoKml) || 9}\t${(draft.claraCasetas || 0).toFixed(2)}\t${(draft.claraHospedaje || 0).toFixed(2)}\t${(draft.claraAlimentos || 0).toFixed(2)}\t${(draft.claraTotal || 0).toFixed(2)}\r\n`;

  // HTML representation for Excel copy/paste
  let html = `<table border="1" style="border-collapse:collapse; font-family:Calibri,Arial,sans-serif; font-size:11pt;">`;
  html += `<thead><tr style="background:#F2F2F2; font-weight:bold;">`;
  headers.forEach(h => {
    const align = ['Canti','PxU','Descuento','Precio Neto','Total','Costo unit','Total costo'].includes(h) ? 'right' : (['Unidad de N'].includes(h) ? 'center' : 'left');
    html += `<th style="border:1px solid #000; padding:4px 8px; text-align:${align};">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  rows.forEach(r => {
    html += `<tr>`;
    r.forEach((cell, idx) => {
      const isYellow = idx === 4;
      const isNum = idx >= 4;
      const align = isNum ? 'right' : (idx === 3 ? 'center' : 'left');
      const bg = isYellow ? 'background:#FFFF00;' : '';
      html += `<td style="border:1px solid #000; padding:4px 8px; text-align:${align}; ${bg}">${cell}</td>`;
    });
    html += `</tr>`;
  });

  html += `<tr style="font-weight:bold; background:#EAEAEA;">`;
  html += `<td colspan="4" style="border:1px solid #000; padding:4px 8px;">TOTALES</td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px; text-align:right; background:#FFFF00;">${sumCanti.toFixed(2)}</td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px;"></td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px;"></td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px;"></td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px; text-align:right;">${sumTotalNeto.toFixed(2)}</td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px;"></td>`;
  html += `<td style="border:1px solid #000; padding:4px 8px; text-align:right;">${sumTotalCosto.toFixed(2)}</td>`;
  html += `</tr>`;

  html += `<tr><td colspan="11" style="height:10px; border:none;"></td></tr>`;
  html += `<tr style="font-weight:bold;"><td colspan="8" style="border:1px solid #000; text-align:right;">SUBTOTAL LISTA:</td><td colspan="3" style="border:1px solid #000; text-align:right;">$${(draft.subtotalLista || sumTotalNeto).toFixed(2)}</td></tr>`;
  html += `<tr style="font-weight:bold;"><td colspan="8" style="border:1px solid #000; text-align:right;">DESCUENTOS:</td><td colspan="3" style="border:1px solid #000; text-align:right; color:red;">-$${(draft.descuentoTotal || 0).toFixed(2)}</td></tr>`;
  html += `<tr style="font-weight:bold;"><td colspan="8" style="border:1px solid #000; text-align:right;">SUBTOTAL NETO:</td><td colspan="3" style="border:1px solid #000; text-align:right;">$${(draft.subtotal || sumTotalNeto).toFixed(2)}</td></tr>`;
  html += `<tr style="font-weight:bold;"><td colspan="8" style="border:1px solid #000; text-align:right;">IVA (16%):</td><td colspan="3" style="border:1px solid #000; text-align:right;">$${(draft.iva || 0).toFixed(2)}</td></tr>`;
  html += `<tr style="font-weight:bold; background:#D9E1F2;"><td colspan="8" style="border:2px solid #000; text-align:right; font-size:12pt;">TOTAL COTIZADO:</td><td colspan="3" style="border:2px solid #000; text-align:right; font-size:12pt; color:#1F4E79;">$${(draft.total || sumTotalNeto).toFixed(2)}</td></tr>`;

  html += `<tr><td colspan="11" style="height:15px; border:none;"></td></tr>`;
  html += `<tr><td colspan="7" style="border:2px solid #000; background:#C6EFCE; font-weight:bold; text-align:center; padding:6px; font-size:11pt;">SOLICITUD DE CLARA (Cálculo de viáticos)</td><td colspan="4" style="border:none;"></td></tr>`;
  html += `<tr style="background:#E2EFDA; font-weight:bold; text-align:center;">`;
  html += `<th style="border:1px solid #000; padding:4px;">Kilometraje</th>`;
  html += `<th style="border:1px solid #000; padding:4px;">Precio combustible</th>`;
  html += `<th style="border:1px solid #000; padding:4px;">Rendimiento km/l</th>`;
  html += `<th style="border:1px solid #000; padding:4px;">Casetas</th>`;
  html += `<th style="border:1px solid #000; padding:4px;">Viaticos hospedaje</th>`;
  html += `<th style="border:1px solid #000; padding:4px;">Alimentos / Fuera</th>`;
  html += `<th style="border:1px solid #000; padding:4px; background:#A9D08E;">Total a pedir</th>`;
  html += `<td colspan="4" style="border:none;"></td>`;
  html += `</tr>`;
  html += `<tr>`;
  html += `<td style="border:1px solid #000; text-align:center; padding:4px;">${kmTotal} KM</td>`;
  html += `<td style="border:1px solid #000; text-align:right; padding:4px;">$${(parseFloat(asis.precioCombustible) || 30).toFixed(2)}</td>`;
  html += `<td style="border:1px solid #000; text-align:center; padding:4px;">${parseFloat(asis.rendimientoKml) || 9} km/l</td>`;
  html += `<td style="border:1px solid #000; text-align:right; padding:4px;">$${(draft.claraCasetas || 0).toFixed(2)}</td>`;
  html += `<td style="border:1px solid #000; text-align:right; padding:4px;">$${(draft.claraHospedaje || 0).toFixed(2)}</td>`;
  html += `<td style="border:1px solid #000; text-align:right; padding:4px;">$${(draft.claraAlimentos || 0).toFixed(2)}</td>`;
  html += `<td style="border:2px solid #000; text-align:right; padding:4px; font-weight:bold; background:#A9D08E;">$${(draft.claraTotal || 0).toFixed(2)}</td>`;
  html += `<td colspan="4" style="border:none;"></td>`;
  html += `</tr>`;
  html += `</tbody></table>`;

  return { tsv, html, sumCanti, sumTotalNeto, sumTotalCosto };
}

async function copiarTablaCotizacionExcel(ticketId) {
  const data = generarDatosExportacionExcel(ticketId);
  if (!data) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('No hay datos en la cotización para copiar.', 'warning');
    return;
  }

  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
    try {
      const typeText = 'text/plain';
      const typeHtml = 'text/html';
      const blobText = new Blob([data.tsv], { type: typeText });
      const blobHtml = new Blob([data.html], { type: typeHtml });
      const item = new ClipboardItem({ [typeText]: blobText, [typeHtml]: blobHtml });
      await navigator.clipboard.write([item]);
      copied = true;
    } catch (e) {
      console.warn('[CopiarExcel] Error ClipboardItem:', e);
    }
  }

  if (!copied && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(data.tsv);
      copied = true;
    } catch (e) {
      console.warn('[CopiarExcel] Error writeText:', e);
    }
  }

  if (copied) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('📋 Tabla copiada con formato Excel. Pégala directamente en Excel o Sheets con Ctrl+V.', 'success');
    }
  } else {
    mostrarModalVistaExcel(ticketId);
  }
}

function descargarCsvCotizacionExcel(ticketId) {
  if (typeof document === 'undefined') return;
  const data = generarDatosExportacionExcel(ticketId);
  if (!data) return;

  const csvContent = '\uFEFF' + data.tsv.replace(/\t/g, ',');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cotizacion_Ticket_${ticketId}_SAP_Excel.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion('Archivo CSV para Excel descargado.', 'success');
  }
}

function mostrarModalVistaExcel(ticketId) {
  if (typeof document === 'undefined') return;
  const data = generarDatosExportacionExcel(ticketId);
  if (!data) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('No hay datos en la cotización.', 'warning');
    return;
  }

  const existing = document.getElementById('modal-vista-excel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-vista-excel-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:999999; display:flex; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(3px);';

  overlay.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; width:100%; max-width:850px; max-height:90vh; display:flex; flex-direction:column; box-shadow:var(--shadow-xl); overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; color:#ffffff; padding:0.75rem 1rem;">
        <span style="font-weight:700; font-size:0.9rem; display:inline-flex; align-items:center; gap:6px;">
          <i data-lucide="sheet" style="width:16px;height:16px;color:#4ade80;"></i> Vista y Copiado de Tabla para Excel (TSV)
        </span>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color:#ffffff; cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>
      </div>
      <div style="padding:1rem; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:0.75rem;">
        <div style="font-size:0.8rem; color:var(--text-secondary);">
          Haz clic en <strong>"Copiar Todo"</strong> para transferir la tabla directamente a tu portapapeles y pegarla con <code>Ctrl+V</code> en Excel, Google Sheets o SAP. También puedes seleccionar el texto directamente.
        </div>
        <textarea id="txt-area-excel-${ticketId}" readonly style="width:100%; height:280px; font-family:monospace; font-size:0.75rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border); border-radius:4px; padding:0.6rem; white-space:pre; overflow:auto; box-sizing:border-box;">${data.tsv}</textarea>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border-top:1px solid var(--border); padding:0.65rem 1rem;">
        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding:0.4rem 0.85rem; font-size:0.8rem;">Cerrar</button>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" onclick="const ta=document.getElementById('txt-area-excel-${ticketId}'); if(ta){ta.select(); document.execCommand('copy'); if(typeof mostrarNotificacion==='function') mostrarNotificacion('Copiado al portapapeles.', 'success');}" class="btn-secondary" style="padding:0.4rem 0.85rem; font-size:0.8rem; font-weight:600;">
            Seleccionar y Copiar
          </button>
          <button type="button" onclick="window.copiarTablaCotizacionExcel('${ticketId}'); this.closest('.modal-overlay').remove();" class="btn-primary" style="background:#16a34a; border-color:#16a34a; padding:0.4rem 1rem; font-size:0.8rem; font-weight:700;">
            Copiar con Formato Excel
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons({ root: overlay });
}

function renderTablaCotizacionTicket(ticketId) {
  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  const draft = (window._tempCotizaciones && window._tempCotizaciones[ticketId]) || { items: [] };
  const items = draft.items || [];
  const asis = draft.asistente || {};

  if (items.length === 0) {
    return `
      <div class="empty-state" style="text-align: center; color: var(--text-muted); padding: 2.2rem 1rem;">
        <i data-lucide="calculator" style="width: 24px; height: 24px; color: var(--text-muted); opacity: 0.5; margin-bottom: 0.4rem; display: block; margin-left: auto; margin-right: auto;"></i>
        <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.2rem;">Sin partidas en la cotización</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Utiliza el <strong>🪄 Asistente Cuadrilla y Viáticos</strong> o agrega conceptos con los botones superiores.
        </div>
      </div>
    `;
  }

  let sumCanti = 0;
  let sumTotalCosto = 0;

  let rowsHtml = '';
  items.forEach((item, index) => {
    const isRef = item.tipo === 'refaccion';
    const safeCodigo = (item.codigo || '').replace(/"/g, '&quot;');
    const safeMarca = (item.marca || '').replace(/"/g, '&quot;');
    const safeDesc = (item.descripcion || '').replace(/"/g, '&quot;');
    const safeUnidad = (item.unidad || draft.linea || 'CON').replace(/"/g, '&quot;');
    const cantVal = item.cantidad !== undefined ? item.cantidad : 1;
    const precioVal = item.precioUnitario !== undefined ? item.precioUnitario : 0;
    const descPct = item.descuento !== undefined ? item.descuento : 0;
    const costoVal = item.costoUnitario !== undefined ? item.costoUnitario : 0;

    const cantNum = parseFloat(cantVal) || 0;
    const puNum = parseFloat(precioVal) || 0;
    const descNum = parseFloat(descPct) || 0;
    const costoNum = parseFloat(costoVal) || 0;

    const precioNeto = puNum * (1 - (descNum / 100));
    const subtotal = cantNum * precioNeto;
    const totalCosto = cantNum * costoNum;

    sumCanti += cantNum;
    sumTotalCosto += totalCosto;

    rowsHtml += `
      <tr style="border-bottom: 1px solid var(--border); font-size: 0.82rem; color: var(--text-primary); transition: background 0.15s;">
        <!-- Clave SAP -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; width: 90px;">
          <input 
            type="text" 
            id="cot-item-code-${ticketId}-${index}"
            value="${safeCodigo}" 
            placeholder="ZFAC..."
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-family: var(--font-mono, monospace); font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #2563eb; padding: 4px 6px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'codigo', this.value.toUpperCase());"
          />
        </td>

        <!-- Marca -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; width: 85px;">
          <input 
            type="text" 
            value="${safeMarca}" 
            placeholder="Ref/Marca"
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.78rem; color: var(--text-secondary); padding: 4px 6px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'marca', this.value);"
          />
        </td>

        <!-- Descripción / Alcance -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; position: relative;">
          <input 
            type="text" 
            class="input-cot-desc"
            id="cot-item-desc-${ticketId}-${index}"
            value="${safeDesc}" 
            placeholder="${isRef ? 'Buscar o escribir refacción...' : 'Descripción detallada de partida...'}"
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.8rem; color: var(--text-primary); padding: 4px 6px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'descripcion', this.value); ${isRef ? `window.buscarRefaccionCatalogoCotizador('${ticketId}', ${index}, this.value);` : ''}"
            onfocus="${isRef ? `window.buscarRefaccionCatalogoCotizador('${ticketId}', ${index}, this.value);` : ''}"
            autocomplete="off"
          />
          ${isRef ? `
            <div id="cot-dropdown-ref-${ticketId}-${index}" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; box-shadow: var(--shadow-md); z-index: 99999; max-height: 200px; overflow-y: auto;"></div>
          ` : ''}
        </td>

        <!-- Unidad -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: center; width: 65px;">
          <input 
            type="text" 
            value="${safeUnidad}" 
            placeholder="CON"
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.78rem; text-align: center; text-transform: uppercase; font-weight: 600; color: var(--text-secondary); padding: 4px 4px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'unidad', this.value.toUpperCase());"
          />
        </td>

        <!-- Cantidad -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: center; width: 65px;">
          <input 
            type="number" 
            step="any" 
            min="0" 
            value="${cantVal}" 
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.8rem; text-align: center; font-weight: 700; color: var(--text-primary); padding: 4px 4px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'cantidad', this.value);"
          />
        </td>

        <!-- P. Unitario -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: right; width: 95px;">
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            id="cot-item-precio-${ticketId}-${index}"
            value="${precioVal}" 
            placeholder="0.00"
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.8rem; text-align: right; font-weight: 600; color: var(--text-primary); padding: 4px 6px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'precioUnitario', this.value);"
          />
        </td>

        <!-- Descuento (%) -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: center; width: 70px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
            <input 
              type="number" 
              step="0.5" 
              min="0" 
              max="100"
              value="${descPct}" 
              style="width: 42px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.78rem; text-align: center; font-weight: 600; color: ${descNum > 0 ? '#dc2626' : 'var(--text-secondary)'}; padding: 4px 2px; box-sizing: border-box;"
              oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'descuento', this.value);"
            />
            <span style="font-size: 0.7rem; color: var(--text-muted);">%</span>
          </div>
        </td>

        <!-- Precio Neto (calculado) -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: right; width: 95px; font-weight: 600; color: var(--text-primary); font-family: var(--font-mono, monospace);">
          <span id="cot-item-precioneto-${ticketId}-${index}">${formatMoney(precioNeto)}</span>
        </td>

        <!-- Subtotal / Importe (calculado) -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: right; width: 105px; font-weight: 700; color: var(--accent); font-family: var(--font-mono, monospace);">
          <span id="cot-item-subtotal-${ticketId}-${index}">${formatMoney(subtotal)}</span>
        </td>

        <!-- Costo unit -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: right; width: 90px;">
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            value="${costoVal}" 
            placeholder="0.00"
            style="width: 100%; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-hover); font-size: 0.78rem; text-align: right; color: var(--text-muted); padding: 4px 6px; box-sizing: border-box;"
            oninput="window.actualizarItemCotizacionTicket('${ticketId}', ${index}, 'costoUnitario', this.value);"
          />
        </td>

        <!-- Total costo (calculado) -->
        <td style="padding: 0.55rem 0.65rem; vertical-align: middle; text-align: right; width: 95px; font-weight: 600; color: var(--text-secondary); font-family: var(--font-mono, monospace);">
          <span id="cot-item-totalcosto-${ticketId}-${index}">${formatMoney(totalCosto)}</span>
        </td>

        <!-- Eliminar -->
        <td style="padding: 0.55rem 0.4rem; vertical-align: middle; text-align: center; width: 36px;">
          <button type="button" onclick="window.eliminarItemCotizacionTicket('${ticketId}', ${index})" class="action-btn" style="color: var(--red); cursor: pointer; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;" title="Eliminar partida">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      </tr>
    `;
  });

  const kmTotal = (parseFloat(asis.km) || 0) * (asis.idaYVueltaKm !== false ? 2 : 1);

  return `
    <div class="table-container desktop-only-table" style="border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; background: var(--bg-card); margin-bottom: 0.75rem; box-shadow: var(--shadow-sm);">
      <!-- TABLA ESTILO EUROREP (ORDERS-TABLE / DATA-TABLE) -->
      <table class="orders-table data-table" style="width: 100%; border-collapse: collapse; min-width: 980px; text-align: left;">
        <thead>
          <tr>
            <th style="width: 90px;">Clave SAP</th>
            <th style="width: 85px;">Marca</th>
            <th>Descripción / Alcance</th>
            <th style="width: 65px; text-align: center;">Unidad</th>
            <th style="width: 65px; text-align: center;">Cant.</th>
            <th style="width: 95px; text-align: right;">P. Unitario</th>
            <th style="width: 70px; text-align: center;">Desc.</th>
            <th style="width: 95px; text-align: right;">P. Neto</th>
            <th style="width: 105px; text-align: right;">Subtotal</th>
            <th style="width: 90px; text-align: right;">Costo Unit.</th>
            <th style="width: 95px; text-align: right;">Total Costo</th>
            <th style="width: 36px; text-align: center;"></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: var(--bg-secondary); font-weight: 700; border-top: 2px solid var(--border); color: var(--text-primary); font-size: 0.8rem;">
            <td colspan="4" style="padding: 0.75rem 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); font-size: 0.75rem;">Totales Generales</td>
            <td style="padding: 0.75rem 0.65rem; text-align: center;" id="cot-footer-canti-${ticketId}">
              ${sumCanti.toFixed(2)}
            </td>
            <td style="padding: 0.75rem 0.65rem; text-align: right; color: var(--text-secondary); font-family: var(--font-mono, monospace);" id="cot-footer-pu-lista-${ticketId}">
              ${formatMoney(draft.subtotalLista || 0)}
            </td>
            <td style="padding: 0.75rem 0.65rem; text-align: center; color: #dc2626; font-family: var(--font-mono, monospace);" id="cot-footer-desc-total-${ticketId}">
              -${formatMoney(draft.descuentoTotal || 0)}
            </td>
            <td style="padding: 0.75rem 0.65rem; text-align: right;"></td>
            <td style="padding: 0.75rem 0.65rem; text-align: right; color: var(--accent); font-size: 0.88rem; font-family: var(--font-mono, monospace);" id="cot-footer-tot-neto-${ticketId}">
              ${formatMoney(draft.subtotal || 0)}
            </td>
            <td style="padding: 0.75rem 0.65rem; text-align: right;"></td>
            <td style="padding: 0.75rem 0.65rem; text-align: right; color: var(--text-secondary); font-size: 0.82rem; font-family: var(--font-mono, monospace);" id="cot-footer-tot-costo-${ticketId}">
              ${formatMoney(sumTotalCosto || 0)}
            </td>
            <td style="padding: 0.75rem 0.4rem;"></td>
          </tr>
        </tfoot>
      </table>

      <!-- SOLICITUD DE CLARA (ESTILO CARD EUROREP) -->
      <div style="border-top: 1px dashed var(--border); background: var(--bg-card); padding: 0.85rem 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <i data-lucide="credit-card" style="width: 15px; height: 15px; color: var(--accent);"></i>
            <span>Solicitud de Clara (Viáticos y Fondeo)</span>
          </div>
          <button type="button" class="btn-secondary" onclick="window.copiarResumenClaraTicket('${ticketId}')" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copiar Resumen Clara
          </button>
        </div>
        <div style="overflow-x: auto;">
          <table class="orders-table data-table" style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: left; min-width: 760px;">
            <thead>
              <tr>
                <th>Kilometraje</th>
                <th>Precio Combustible</th>
                <th>Rendimiento</th>
                <th>Casetas</th>
                <th>Hospedaje</th>
                <th>Alimentos</th>
                <th style="text-align: right;">Total a Pedir</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 0.65rem 0.85rem; font-weight: 600;">${kmTotal} KM</td>
                <td style="padding: 0.65rem 0.85rem;">$${(parseFloat(asis.precioCombustible) || 30).toFixed(2)}/L</td>
                <td style="padding: 0.65rem 0.85rem;">${parseFloat(asis.rendimientoKml) || 9} km/l</td>
                <td style="padding: 0.65rem 0.85rem;" id="cot-clara-casetas-tbl-${ticketId}">${formatMoney(draft.claraCasetas || 0)}</td>
                <td style="padding: 0.65rem 0.85rem;" id="cot-clara-hospedaje-tbl-${ticketId}">${formatMoney(draft.claraHospedaje || 0)}</td>
                <td style="padding: 0.65rem 0.85rem;" id="cot-clara-alimentos-tbl-${ticketId}">${formatMoney(draft.claraAlimentos || 0)}</td>
                <td style="padding: 0.65rem 0.85rem; text-align: right; font-weight: 800; font-size: 0.95rem; color: var(--accent); font-family: var(--font-mono, monospace);" id="cot-clara-total-tbl-${ticketId}">
                  ${formatMoney(draft.claraTotal || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function buscarRefaccionCatalogoCotizador(ticketId, index, query) {
  const dropdown = document.getElementById(`cot-dropdown-ref-${ticketId}-${index}`);
  if (!dropdown) return;

  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  const catalog = (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb) && refaccionesDb.length > 0)
    ? refaccionesDb
    : ((typeof window !== 'undefined' && Array.isArray(window.refaccionesDb) && window.refaccionesDb.length > 0)
        ? window.refaccionesDb
        : []);

  if (catalog.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const matches = [];
  for (let i = 0; i < catalog.length && matches.length < 8; i++) {
    const r = catalog[i];
    if (!r) continue;
    const c = String(r.codigo || '').toLowerCase();
    const d = String(r.descripcion || r.nombre || '').toLowerCase();
    if (c.includes(q) || d.includes(q)) {
      matches.push(r);
    }
  }

  if (matches.length === 0) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  let optsHtml = '';
  matches.forEach(m => {
    const safeCod = (m.codigo || '').replace(/'/g, "\\'");
    const safeDesc = (m.descripcion || m.nombre || '').replace(/'/g, "\\'");
    const safeMarca = (m.marca || m.marcaCodigo || '').replace(/'/g, "\\'");
    const precio = parseFloat(m.precio) || 0;

    optsHtml += `
      <div 
        style="padding: 0.45rem 0.65rem; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.78rem; transition: background 0.15s;"
        onmouseover="this.style.background='var(--bg-hover)'"
        onmouseout="this.style.background='transparent'"
        onclick="window.seleccionarRefaccionCatalogoCotizador('${ticketId}', ${index}, '${safeCod}', '${safeDesc}', '${safeMarca}', ${precio})"
      >
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong style="color: var(--accent); font-family: monospace;">${m.codigo || 'S/C'}</strong>
          <span style="color: var(--text-primary); margin-left: 4px;">${m.descripcion || m.nombre}</span>
          ${m.marca ? `<span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 4px;">(${m.marca})</span>` : ''}
        </div>
        <div style="font-weight: 700; color: var(--green); flex-shrink: 0;">
          ${formatMoney(precio)}
        </div>
      </div>
    `;
  });

  dropdown.innerHTML = optsHtml;
  dropdown.style.display = 'block';
}

function seleccionarRefaccionCatalogoCotizador(ticketId, index, codigo, descripcion, marca, precio) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft || !draft.items || !draft.items[index]) return;

  const item = draft.items[index];
  item.codigo = codigo;
  item.descripcion = descripcion;
  item.marca = marca || '';
  item.precioUnitario = parseFloat(precio) || 0;

  const cant = parseFloat(item.cantidad) || 1;
  const descPct = parseFloat(item.descuento) || 0;
  item.subtotalLista = cant * item.precioUnitario;
  item.descuentoMonto = item.subtotalLista * (descPct / 100);
  item.subtotal = item.subtotalLista - item.descuentoMonto;
  draft.guardada = false;

  if (typeof document !== 'undefined') {
    const descInput = document.getElementById(`cot-item-desc-${ticketId}-${index}`);
    if (descInput) descInput.value = descripcion;

    const codeInput = document.getElementById(`cot-item-code-${ticketId}-${index}`);
    if (codeInput) codeInput.value = codigo;

    const precioInput = document.getElementById(`cot-item-precio-${ticketId}-${index}`);
    if (precioInput) precioInput.value = item.precioUnitario.toFixed(2);

    const subtotalEl = document.getElementById(`cot-item-subtotal-${ticketId}-${index}`);
    if (subtotalEl) {
      subtotalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.subtotal);
    }

    const dropdown = document.getElementById(`cot-dropdown-ref-${ticketId}-${index}`);
    if (dropdown) dropdown.style.display = 'none';
  }

  window.recalcularCotizacionTicket(ticketId);
}

function actualizarParametroCotizadorTicket(ticketId, seccion, campo, valor) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return;

  if (seccion === 'global') {
    draft[campo] = valor;
    if (campo === 'tipoCliente') {
      const policy = COTIZADOR_DESCUENTOS_CLIENTE[valor] || COTIZADOR_DESCUENTOS_CLIENTE['Externo AAA'];
      if (typeof document !== 'undefined') {
        const badgeDescEl = document.getElementById(`cot-badge-desc-${ticketId}`);
        if (badgeDescEl) {
          badgeDescEl.innerHTML = `Desc. Política: MO: <strong>${policy.mo}%</strong> | Viáticos: <strong>${policy.viaticos}%</strong>`;
        }
      }
    }
  } else if (seccion === 'asistente') {
    if (!draft.asistente) draft.asistente = {};
    draft.asistente[campo] = valor;
  }

  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);
}

function toggleAsistenteCotizadorTicket(ticketId) {
  if (typeof document === 'undefined') return;
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  const drawer = document.getElementById(`cotizador-drawer-${ticketId}`);
  const backdrop = document.getElementById(`cotizador-drawer-backdrop-${ticketId}`);
  if (!drawer) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    if (draft && draft.asistente) draft.asistente.mostrarAsistente = false;
  } else {
    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    if (draft && draft.asistente) draft.asistente.mostrarAsistente = true;
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons({ root: drawer });
  }
}

function cargarConceptosAsistenteEnCotizacion(ticketId) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return;

  const asis = draft.asistente || {};
  const linea = draft.linea || 'CON';
  const descPolicy = COTIZADOR_DESCUENTOS_CLIENTE[draft.tipoCliente] || COTIZADOR_DESCUENTOS_CLIENTE['Externo AAA'];
  const descMo = descPolicy.mo || 0;
  const descViat = descPolicy.viaticos || 0;

  // Preservar refacciones agregadas manualmente o importadas
  const refaccionesPreservadas = (draft.items || []).filter(it => it.tipo === 'refaccion' && it.origen !== 'asistente');
  const itemsNuevos = [...refaccionesPreservadas];

  // 1. MANO DE OBRA (ZFAC02)
  const numPers = parseInt(asis.numPersonas, 10) || 2;
  const dias = parseFloat(asis.diasProyecto) || 1;
  const tarifaInfo = COTIZADOR_TARIFAS_CUADRILLA[numPers] || COTIZADOR_TARIFAS_CUADRILLA[2];
  const precioUnitMo = tarifaInfo[asis.tipoTarifaMo || 'externo'] || tarifaInfo.externo;
  
  const descMoCustom = (asis.descripcionServicio && asis.descripcionServicio.trim())
    ? asis.descripcionServicio.trim()
    : 'Instalación y mantenimiento especializado';
  const descLargaMo = `${descMoCustom} - Cuadrilla: ${tarifaInfo.titulo}`;

  itemsNuevos.push({
    id: 'it-mo-' + Date.now(),
    origen: 'asistente',
    tipo: 'servicio',
    codigo: 'ZFAC02',
    unidad: linea,
    descripcion: descLargaMo,
    cantidad: dias,
    precioUnitario: precioUnitMo,
    descuento: descMo,
    subtotalLista: dias * precioUnitMo,
    descuentoMonto: (dias * precioUnitMo) * (descMo / 100),
    subtotal: (dias * precioUnitMo) * (1 - descMo / 100),
    costoUnitario: tarifaInfo.euro
  });

  // 2. KILOMETRAJE / TRASLADO (ZFAC10)
  const km = parseFloat(asis.km) || 0;
  if (km > 0) {
    const idaYVuelta = asis.idaYVueltaKm !== false;
    const factorKm = parseFloat(asis.factorKm) || 11;
    const kmTotal = km * (idaYVuelta ? 2 : 1);
    const montoKmTotal = kmTotal * factorKm;
    const orig = (asis.origen || 'CDMX').trim();
    const dest = (asis.destino || 'Destino').trim();
    const descLargaKm = `${orig} - ${dest} - ${kmTotal} KM (${idaYVuelta ? 'Ida y vuelta' : 'Un sentido'}) - Factor $${factorKm}/KM`;

    itemsNuevos.push({
      id: 'it-km-' + Date.now(),
      origen: 'asistente',
      tipo: 'viaticos',
      codigo: 'ZFAC10',
      unidad: linea,
      descripcion: descLargaKm,
      cantidad: kmTotal,
      precioUnitario: factorKm,
      descuento: descViat,
      subtotalLista: montoKmTotal,
      descuentoMonto: montoKmTotal * (descViat / 100),
      subtotal: montoKmTotal * (1 - descViat / 100),
      costoUnitario: draft.claraCombustible || 0
    });
  }

  // 3. CASETAS (ZFAC10)
  const casetas = parseFloat(asis.casetasMonto || asis.casetas) || 0;
  if (casetas > 0) {
    const idaYVueltaCasetas = asis.idaYVueltaCasetas !== false;
    const totalCasetas = casetas * (idaYVueltaCasetas ? 2 : 1);
    const descCasetas = `Casetas de peaje autopista (${idaYVueltaCasetas ? 'Ida y vuelta' : 'Un sentido'})`;

    itemsNuevos.push({
      id: 'it-cas-' + Date.now(),
      origen: 'asistente',
      tipo: 'viaticos',
      codigo: 'ZFAC10',
      unidad: linea,
      descripcion: descCasetas,
      cantidad: 1,
      precioUnitario: totalCasetas,
      descuento: descViat,
      subtotalLista: totalCasetas,
      descuentoMonto: totalCasetas * (descViat / 100),
      subtotal: totalCasetas * (1 - descViat / 100),
      costoUnitario: totalCasetas
    });
  }

  // 4. ALIMENTOS (ZFAC05)
  const diasAlim = parseFloat(asis.diasAlimentos) || 0;
  if (diasAlim > 0) {
    const puAlim = numPers * 550; // $550 por persona/dia
    const subLista = diasAlim * puAlim;
    itemsNuevos.push({
      id: 'it-alim-' + Date.now(),
      origen: 'asistente',
      tipo: 'viaticos',
      codigo: 'ZFAC05',
      unidad: linea,
      descripcion: `Viáticos Alimentos (${numPers} persona${numPers > 1 ? 's' : ''} x $550/día)`,
      cantidad: diasAlim,
      precioUnitario: puAlim,
      descuento: descViat,
      subtotalLista: subLista,
      descuentoMonto: subLista * (descViat / 100),
      subtotal: subLista * (1 - descViat / 100),
      costoUnitario: puAlim * 0.8
    });
  }

  // 5. HOSPEDAJE (ZFAC05)
  const nochesHosp = parseFloat(asis.nochesHospedaje) || 0;
  if (nochesHosp > 0) {
    const tarifaHosp = parseFloat(asis.precioHospedajeManual) > 0 
      ? parseFloat(asis.precioHospedajeManual)
      : (COTIZADOR_TARIFAS_HOSPEDAJE[numPers] || 1500);
    const subLista = nochesHosp * tarifaHosp;
    itemsNuevos.push({
      id: 'it-hosp-' + Date.now(),
      origen: 'asistente',
      tipo: 'viaticos',
      codigo: 'ZFAC05',
      unidad: linea,
      descripcion: `Viáticos Hospedaje (${numPers} persona${numPers > 1 ? 's' : ''})`,
      cantidad: nochesHosp,
      precioUnitario: tarifaHosp,
      descuento: descViat,
      subtotalLista: subLista,
      descuentoMonto: subLista * (descViat / 100),
      subtotal: subLista * (1 - descViat / 100),
      costoUnitario: tarifaHosp
    });
  }

  // 6. NOCHES POR FUERA (ZFAC05)
  const nochesFuera = parseFloat(asis.nochesPorFuera) || 0;
  if (nochesFuera > 0) {
    const puFuera = numPers * 300;
    const subLista = nochesFuera * puFuera;
    itemsNuevos.push({
      id: 'it-fuer-' + Date.now(),
      origen: 'asistente',
      tipo: 'viaticos',
      codigo: 'ZFAC05',
      unidad: linea,
      descripcion: `Noches por fuera (${numPers} pers x $300/noche)`,
      cantidad: nochesFuera,
      precioUnitario: puFuera,
      descuento: descViat,
      subtotalLista: subLista,
      descuentoMonto: subLista * (descViat / 100),
      subtotal: subLista * (1 - descViat / 100),
      costoUnitario: puFuera
    });
  }

  draft.items = itemsNuevos;
  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById(`cotizador-table-wrapper-${ticketId}`);
    if (wrapper) {
      wrapper.innerHTML = renderTablaCotizacionTicket(ticketId);
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: wrapper });
    }

    const drawer = document.getElementById(`cotizador-drawer-${ticketId}`);
    const backdrop = document.getElementById(`cotizador-drawer-backdrop-${ticketId}`);
    if (drawer && drawer.classList.contains('open')) {
      drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    }
  }

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`Se cargaron las partidas calculadas con descuentos de ${descPolicy.label}.`, 'success');
  }
}

function copiarResumenClaraTicket(ticketId) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return;
  const asis = draft.asistente || {};
  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  const kmTotal = (parseFloat(asis.km) || 0) * (asis.idaYVueltaKm !== false ? 2 : 1);
  const texto = [
    `=== SOLICITUD DE FONDEO CLARA (TICKET ${ticketId}) ===`,
    `• Destino: ${asis.origen || 'CDMX'} ➔ ${asis.destino || 'Destino'} (${kmTotal} KM tot)`,
    `• Combustible: ${formatMoney(draft.claraCombustible || 0)} (${kmTotal} km / ${asis.rendimientoKml || 9} km/l @ $${asis.precioCombustible || 30}/L)`,
    `• Casetas: ${formatMoney(draft.claraCasetas || 0)}`,
    `• Hospedaje: ${formatMoney(draft.claraHospedaje || 0)} (${asis.nochesHospedaje || 0} noches)`,
    `• Alimentos / Noches fuera: ${formatMoney(draft.claraAlimentos || 0)} (${asis.diasAlimentos || 0} días, ${asis.numPersonas || 2} personas)`,
    `----------------------------------------`,
    `TOTAL A PEDIR EN CLARA: ${formatMoney(draft.claraTotal || 0)} MXN`
  ].join('\n');

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Resumen de Solicitud Clara copiado al portapapeles.', 'success');
      }
    }).catch(() => {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Total Clara: ' + formatMoney(draft.claraTotal || 0), 'info');
      }
    });
  } else {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Total Clara: ' + formatMoney(draft.claraTotal || 0), 'info');
    }
  }
}

function agregarItemCotizacionTicket(ticketId, tipo = 'refaccion') {
  if (!window._tempCotizaciones) window._tempCotizaciones = {};
  if (!window._tempCotizaciones[ticketId]) {
    window._tempCotizaciones[ticketId] = {
      linea: 'CON',
      tipoCliente: 'Externo',
      items: [],
      incluirIva: true,
      tasaIva: 0.16,
      subtotalLista: 0,
      descuentoTotal: 0,
      subtotal: 0,
      iva: 0,
      total: 0,
      guardada: false
    };
  }

  const draft = window._tempCotizaciones[ticketId];
  if (!draft.items) draft.items = [];

  const descPolicy = COTIZADOR_DESCUENTOS_CLIENTE[draft.tipoCliente] || COTIZADOR_DESCUENTOS_CLIENTE['Externo AAA'];
  let defCodigo = '';
  let defDesc = '';
  let defPrecio = 0;
  let defDescPct = 0;

  if (tipo === 'servicio') {
    defCodigo = 'ZFAC02';
    defDesc = 'Mano de obra técnica';
    defPrecio = 3690.20;
    defDescPct = descPolicy.mo || 0;
  } else if (tipo === 'viaticos') {
    defCodigo = 'ZFAC10';
    defDesc = 'Traslado y kilometraje';
    defPrecio = 0;
    defDescPct = descPolicy.viaticos || 0;
  }

  draft.items.push({
    id: 'it-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    tipo: tipo,
    codigo: defCodigo,
    unidad: draft.linea || 'CON',
    descripcion: defDesc,
    marca: '',
    cantidad: 1,
    precioUnitario: defPrecio,
    descuento: defDescPct,
    subtotalLista: defPrecio,
    descuentoMonto: defPrecio * (defDescPct / 100),
    subtotal: defPrecio * (1 - defDescPct / 100)
  });

  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById(`cotizador-table-wrapper-${ticketId}`);
    if (wrapper) {
      wrapper.innerHTML = renderTablaCotizacionTicket(ticketId);
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: wrapper });
    }

    setTimeout(() => {
      const newIdx = draft.items.length - 1;
      const input = document.getElementById(`cot-item-desc-${ticketId}-${newIdx}`);
      if (input) input.focus();
    }, 50);
  }
}

function eliminarItemCotizacionTicket(ticketId, index) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft || !draft.items) return;

  draft.items.splice(index, 1);
  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById(`cotizador-table-wrapper-${ticketId}`);
    if (wrapper) {
      wrapper.innerHTML = renderTablaCotizacionTicket(ticketId);
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: wrapper });
    }
  }
}

function actualizarItemCotizacionTicket(ticketId, index, campo, valor) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft || !draft.items || !draft.items[index]) return;

  const item = draft.items[index];
  if (campo === 'cantidad') {
    item.cantidad = parseFloat(valor) || 0;
  } else if (campo === 'precioUnitario') {
    item.precioUnitario = parseFloat(valor) || 0;
  } else if (campo === 'descuento') {
    item.descuento = parseFloat(valor) || 0;
  } else if (campo === 'costoUnitario') {
    item.costoUnitario = parseFloat(valor) || 0;
  } else {
    item[campo] = valor;
  }

  const cant = parseFloat(item.cantidad) || 0;
  const pu = parseFloat(item.precioUnitario) || 0;
  const descPct = parseFloat(item.descuento) || 0;
  const costoU = parseFloat(item.costoUnitario) || 0;

  item.precioNeto = pu * (1 - descPct / 100);
  item.subtotalLista = cant * pu;
  item.descuentoMonto = item.subtotalLista * (descPct / 100);
  item.subtotal = cant * item.precioNeto;
  item.totalCosto = cant * costoU;
  draft.guardada = false;

  if (typeof document !== 'undefined') {
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

    const precioNetoEl = document.getElementById(`cot-item-precioneto-${ticketId}-${index}`);
    if (precioNetoEl) precioNetoEl.textContent = formatMoney(item.precioNeto);

    const subtotalEl = document.getElementById(`cot-item-subtotal-${ticketId}-${index}`);
    if (subtotalEl) subtotalEl.textContent = formatMoney(item.subtotal);

    const totalCostoEl = document.getElementById(`cot-item-totalcosto-${ticketId}-${index}`);
    if (totalCostoEl) totalCostoEl.textContent = formatMoney(item.totalCosto);
  }

  window.recalcularCotizacionTicket(ticketId);
}

function toggleIvaCotizacionTicket(ticketId, checked) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return;

  draft.incluirIva = !!checked;
  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);
}

function importarRefaccionesEnCotizacionTicket(ticketId) {
  const t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x.id === ticketId) : null;
  if (!t || !Array.isArray(t.refaccionesSeleccionadas) || t.refaccionesSeleccionadas.length === 0) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('El ticket no tiene refacciones solicitadas para importar.', 'warning');
    }
    return;
  }

  if (!window._tempCotizaciones) window._tempCotizaciones = {};
  if (!window._tempCotizaciones[ticketId]) {
    window._tempCotizaciones[ticketId] = {
      linea: 'CON',
      tipoCliente: 'Externo',
      items: [],
      incluirIva: true,
      tasaIva: 0.16,
      subtotalLista: 0,
      descuentoTotal: 0,
      subtotal: 0,
      iva: 0,
      total: 0,
      guardada: false
    };
  }

  const draft = window._tempCotizaciones[ticketId];
  if (!draft.items) draft.items = [];

  const catalog = (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb) && refaccionesDb.length > 0)
    ? refaccionesDb
    : ((typeof window !== 'undefined' && Array.isArray(window.refaccionesDb)) ? window.refaccionesDb : []);

  let importedCount = 0;
  t.refaccionesSeleccionadas.forEach(ref => {
    const cod = String(ref.codigo || ref.clave || '').trim();
    const desc = String(ref.descripcion || ref.nombre || '').trim();
    const cant = parseFloat(ref.cantidad) || 1;

    let precio = 0;
    let costo = 0;
    if (catalog.length > 0) {
      const match = catalog.find(c => {
        if (cod && c.codigo && String(c.codigo).toUpperCase().trim() === cod.toUpperCase()) return true;
        if (desc && (c.descripcion || c.nombre) && String(c.descripcion || c.nombre).toUpperCase().trim() === desc.toUpperCase()) return true;
        return false;
      });
      if (match && match.precio) {
        precio = parseFloat(match.precio) || 0;
        costo = parseFloat(match.costo) || (precio * 0.7);
      }
    }

    draft.items.push({
      id: 'it-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      tipo: 'refaccion',
      codigo: cod,
      unidad: draft.linea || 'CON',
      descripcion: desc,
      marca: ref.marca || '',
      cantidad: cant,
      precioUnitario: precio,
      descuento: 0,
      precioNeto: precio,
      subtotalLista: cant * precio,
      descuentoMonto: 0,
      subtotal: cant * precio,
      costoUnitario: costo,
      totalCosto: cant * costo
    });
    importedCount++;
  });

  draft.guardada = false;
  window.recalcularCotizacionTicket(ticketId);

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById(`cotizador-table-wrapper-${ticketId}`);
    if (wrapper) {
      wrapper.innerHTML = renderTablaCotizacionTicket(ticketId);
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: wrapper });
    }
  }

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`Se importaron ${importedCount} refacciones del ticket al cotizador.`, 'success');
  }
}

function recalcularCotizacionTicket(ticketId) {
  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft) return;

  let sumCanti = 0;
  let subtotalLista = 0;
  let descuentoTotal = 0;
  let subtotalNeto = 0;
  let sumTotalCosto = 0;

  (draft.items || []).forEach(it => {
    const cant = parseFloat(it.cantidad) || 0;
    const pu = parseFloat(it.precioUnitario) || 0;
    const descPct = (it.descuento !== undefined && it.descuento !== null && it.descuento !== '')
      ? (parseFloat(it.descuento) || 0)
      : 0;
    const costoU = parseFloat(it.costoUnitario) || 0;

    it.precioNeto = pu * (1 - descPct / 100);
    it.subtotalLista = cant * pu;
    it.descuentoMonto = it.subtotalLista * (descPct / 100);
    it.subtotal = cant * it.precioNeto;
    it.totalCosto = cant * costoU;

    sumCanti += cant;
    subtotalLista += it.subtotalLista;
    descuentoTotal += it.descuentoMonto;
    subtotalNeto += it.subtotal;
    sumTotalCosto += it.totalCosto;
  });

  draft.sumCanti = sumCanti;
  draft.subtotalLista = subtotalLista;
  draft.descuentoTotal = descuentoTotal;
  draft.subtotal = subtotalNeto;
  draft.sumTotalCosto = sumTotalCosto;
  draft.iva = draft.incluirIva !== false ? subtotalNeto * (draft.tasaIva || 0.16) : 0;
  draft.total = draft.subtotal + draft.iva;

  // Calculo Clara (Fondeo Operativo / Anticipo)
  const asis = draft.asistente || {};
  const km = parseFloat(asis.km) || 0;
  const kmTotal = km * (asis.idaYVueltaKm !== false ? 2 : 1);
  const rend = parseFloat(asis.rendimientoKml) || 9;
  const precioGas = parseFloat(asis.precioCombustible) || 30;
  const combustibleClara = (kmTotal > 0 && rend > 0) ? Math.round(((kmTotal / rend) * precioGas) * 100) / 100 : 0;

  const casetas = parseFloat(asis.casetasMonto || asis.casetas) || 0;
  const casetasClara = casetas * (asis.idaYVueltaCasetas !== false ? 2 : 1);

  const numPers = parseInt(asis.numPersonas, 10) || 2;
  const noches = parseFloat(asis.nochesHospedaje) || 0;
  const precioHospNoche = parseFloat(asis.precioHospedajeManual) > 0
    ? parseFloat(asis.precioHospedajeManual)
    : (COTIZADOR_TARIFAS_HOSPEDAJE[numPers] || 1500);
  const hospedajeClara = noches * precioHospNoche;

  const diasAlim = parseFloat(asis.diasAlimentos) || 0;
  const alimentosClara = diasAlim * numPers * 550;

  const nochesFuera = parseFloat(asis.nochesPorFuera) || 0;
  const nochesFueraClara = nochesFuera * numPers * 300;

  draft.claraCombustible = combustibleClara;
  draft.claraCasetas = casetasClara;
  draft.claraHospedaje = hospedajeClara;
  draft.claraAlimentos = alimentosClara + nochesFueraClara;
  draft.claraTotal = combustibleClara + casetasClara + hospedajeClara + alimentosClara + nochesFueraClara;

  if (typeof document !== 'undefined') {
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

    const subtotalListaEl = document.getElementById(`cotizador-val-subtotal-lista-${ticketId}`);
    if (subtotalListaEl) subtotalListaEl.textContent = formatMoney(draft.subtotalLista);

    const descuentoEl = document.getElementById(`cotizador-val-descuento-${ticketId}`);
    if (descuentoEl) descuentoEl.textContent = `-${formatMoney(draft.descuentoTotal)}`;

    const subtotalEl = document.getElementById(`cotizador-val-subtotal-${ticketId}`);
    if (subtotalEl) subtotalEl.textContent = formatMoney(draft.subtotal);

    const ivaEl = document.getElementById(`cotizador-val-iva-${ticketId}`);
    if (ivaEl) ivaEl.textContent = formatMoney(draft.iva);

    const totalEl = document.getElementById(`cotizador-val-total-${ticketId}`);
    if (totalEl) totalEl.textContent = formatMoney(draft.total);

    const headerTotalEl = document.getElementById(`cotizador-header-total-${ticketId}`);
    if (headerTotalEl) headerTotalEl.textContent = formatMoney(draft.total);

    // Totales en el pie de la tabla Excel
    const footerCantiEl = document.getElementById(`cot-footer-canti-${ticketId}`);
    if (footerCantiEl) footerCantiEl.textContent = sumCanti.toFixed(2);

    const footerPuEl = document.getElementById(`cot-footer-pu-lista-${ticketId}`);
    if (footerPuEl) footerPuEl.textContent = formatMoney(draft.subtotalLista);

    const footerDescEl = document.getElementById(`cot-footer-desc-total-${ticketId}`);
    if (footerDescEl) footerDescEl.textContent = `-${formatMoney(draft.descuentoTotal)}`;

    const footerTotNetoEl = document.getElementById(`cot-footer-tot-neto-${ticketId}`);
    if (footerTotNetoEl) footerTotNetoEl.textContent = formatMoney(draft.subtotal);

    const footerTotCostoEl = document.getElementById(`cot-footer-tot-costo-${ticketId}`);
    if (footerTotCostoEl) footerTotCostoEl.textContent = formatMoney(sumTotalCosto);

    // Bloque Clara
    const claraTotalEl = document.getElementById(`cot-clara-total-${ticketId}`);
    if (claraTotalEl) claraTotalEl.textContent = formatMoney(draft.claraTotal);

    const claraGasEl = document.getElementById(`cot-clara-gas-${ticketId}`);
    if (claraGasEl) claraGasEl.textContent = formatMoney(combustibleClara);

    const claraCasetasEl = document.getElementById(`cot-clara-casetas-${ticketId}`);
    if (claraCasetasEl) claraCasetasEl.textContent = formatMoney(casetasClara);

    const claraViaticosEl = document.getElementById(`cot-clara-viaticos-${ticketId}`);
    if (claraViaticosEl) claraViaticosEl.textContent = formatMoney(hospedajeClara + alimentosClara + nochesFueraClara);

    const claraCasTbl = document.getElementById(`cot-clara-casetas-tbl-${ticketId}`);
    if (claraCasTbl) claraCasTbl.textContent = formatMoney(casetasClara);

    const claraHospTbl = document.getElementById(`cot-clara-hospedaje-tbl-${ticketId}`);
    if (claraHospTbl) claraHospTbl.textContent = formatMoney(hospedajeClara);

    const claraAlimTbl = document.getElementById(`cot-clara-alimentos-tbl-${ticketId}`);
    if (claraAlimTbl) claraAlimTbl.textContent = formatMoney(alimentosClara + nochesFueraClara);

    const claraTotTbl = document.getElementById(`cot-clara-total-tbl-${ticketId}`);
    if (claraTotTbl) claraTotTbl.textContent = formatMoney(draft.claraTotal);

    const margenEl = document.getElementById(`cot-margen-estimado-${ticketId}`);
    if (margenEl) {
      const margenMonto = draft.subtotal - sumTotalCosto;
      const margenPct = draft.subtotal > 0 ? (margenMonto / draft.subtotal * 100) : 0;
      margenEl.innerHTML = `Margen Bruto: <strong>${formatMoney(margenMonto)} (${margenPct.toFixed(1)}%)</strong>`;
    }
  }
}

async function guardarCotizacionInternaTicket(ticketId) {
  const t = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets.find(x => x.id === ticketId) : null;
  if (!t) return;

  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (!draft || !draft.items || draft.items.length === 0) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Agrega al menos un concepto a la cotización antes de guardar.', 'warning');
    }
    return;
  }

  window.recalcularCotizacionTicket(ticketId);

  const nowIso = new Date().toISOString();
  const userName = (typeof window.getCurrentUserDisplayName === 'function')
    ? window.getCurrentUserDisplayName()
    : 'Admin';

  const sumTotalCosto = draft.sumTotalCosto || (Array.isArray(draft.items) ? draft.items.reduce((acc, it) => acc + (Number(it.totalCosto) || 0), 0) : 0);
  const margenMonto = (draft.subtotal || 0) - sumTotalCosto;
  const margenPct = draft.subtotal > 0 ? (margenMonto / draft.subtotal * 100) : 0;

  t.cotizacionInterna = {
    linea: draft.linea || 'CON',
    tipoCliente: draft.tipoCliente || 'Externo AAA',
    asistente: draft.asistente ? JSON.parse(JSON.stringify(draft.asistente)) : null,
    items: JSON.parse(JSON.stringify(draft.items)),
    incluirIva: draft.incluirIva !== false,
    tasaIva: draft.tasaIva || 0.16,
    subtotalLista: draft.subtotalLista || 0,
    descuentoTotal: draft.descuentoTotal || 0,
    subtotal: draft.subtotal,
    iva: draft.iva,
    total: draft.total,
    moneda: 'MXN',
    totalCosto: sumTotalCosto,
    margenEstimado: margenMonto,
    margenPct: margenPct,
    claraCombustible: draft.claraCombustible || 0,
    claraCasetas: draft.claraCasetas || 0,
    claraHospedaje: draft.claraHospedaje || 0,
    claraAlimentos: draft.claraAlimentos || 0,
    claraTotal: draft.claraTotal || 0,
    fechaActualizacion: nowIso,
    modificadoPor: userName
  };

  t.montoCotizacion = draft.total;
  t.cotLinea = draft.linea || 'CON';
  t.cotTipoCliente = draft.tipoCliente || 'Externo AAA';
  t.cotSubtotal = draft.subtotal;
  t.cotIva = draft.iva;
  t.cotTotal = draft.total;
  t.claraTotal = draft.claraTotal || 0;
  t.fechaModificacion = nowIso;
  t.modificadoPor = userName;
  draft.guardada = true;

  if (typeof document !== 'undefined') {
    const quickMontoInput = document.getElementById(`quick-cot-monto-${ticketId}`);
    if (quickMontoInput) {
      quickMontoInput.value = draft.total.toFixed(2);
      quickMontoInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const badgeSaved = document.getElementById(`cotizador-badge-saved-${ticketId}`);
    if (badgeSaved) {
      badgeSaved.style.background = 'rgba(34, 197, 94, 0.12)';
      badgeSaved.style.color = '#22c55e';
      badgeSaved.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      badgeSaved.innerHTML = '<i data-lucide="check" style="width: 10px; height: 10px;"></i> Guardada';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: badgeSaved });
    }
  }

  if (typeof safeSetJSON === 'function' && typeof tickets !== 'undefined') {
    safeSetJSON('sapi_tickets', tickets);
  }
  if (typeof window !== 'undefined' && window.supabaseClient && typeof window.pushToSupabase === 'function') {
    try {
      await window.pushToSupabase('tickets', t);
    } catch (err) {
      console.warn('[Cotizador Interno] Error al sincronizar con Supabase:', err);
    }
  }

  const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`Cotización interna guardada correctamente (${formatMoney(draft.total)} MXN).`, 'success');
  }

  if (typeof renderTickets === 'function') {
    renderTickets();
  }
}

function limpiarCotizacionInternaTicket(ticketId) {
  if (typeof confirm === 'function') {
    const confirmar = confirm('¿Estás seguro de que deseas limpiar todos los conceptos de esta cotización interna?');
    if (!confirmar) return;
  }

  const draft = window._tempCotizaciones && window._tempCotizaciones[ticketId];
  if (draft) {
    draft.items = [];
    draft.subtotalLista = 0;
    draft.descuentoTotal = 0;
    draft.subtotal = 0;
    draft.iva = 0;
    draft.total = 0;
    draft.guardada = false;
  }

  window.recalcularCotizacionTicket(ticketId);

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById(`cotizador-table-wrapper-${ticketId}`);
    if (wrapper) {
      wrapper.innerHTML = renderTablaCotizacionTicket(ticketId);
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: wrapper });
    }
  }

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion('Cotización interna reiniciada.', 'info');
  }
}

function toggleCotizadorInterno(ticketId) {
  if (typeof document === 'undefined') return;
  const body = document.getElementById(`cotizador-body-container-${ticketId}`);
  const toggleText = document.getElementById(`cotizador-toggle-text-${ticketId}`);
  const toggleIcon = document.getElementById(`cotizador-toggle-icon-${ticketId}`);
  if (!body) return;

  const isCollapsed = body.style.display === 'none';
  if (isCollapsed) {
    body.style.display = 'flex';
    if (toggleText) toggleText.textContent = 'Contraer';
    if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-up');
  } else {
    body.style.display = 'none';
    if (toggleText) toggleText.textContent = 'Mostrar';
    if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-down');
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons({ root: toggleIcon?.parentElement });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.input-cot-desc') && !e.target.closest('[id^="cot-dropdown-ref-"]')) {
      const dropdowns = document.querySelectorAll('[id^="cot-dropdown-ref-"]');
      dropdowns.forEach(d => {
        d.style.display = 'none';
      });
    }
  });
}

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
    if (typeof window !== 'undefined' && window.supabaseClient && id) {
      window.supabaseClient.from('tickets').select('*').or(`id.eq.${id},folio.eq.${id}`).maybeSingle().then(({ data: remoteTicket, error }) => {
        if (!error && remoteTicket) {
          const loadedTkt = (typeof window.rowToTicket === 'function') ? window.rowToTicket(remoteTicket) : remoteTicket;
          if (typeof tickets !== 'undefined' && Array.isArray(tickets) && !tickets.some(x => x.id === loadedTkt.id)) {
            tickets.push(loadedTkt);
          }
          if (typeof window !== 'undefined' && Array.isArray(window.tickets) && !window.tickets.some(x => x.id === loadedTkt.id)) {
            window.tickets.push(loadedTkt);
          }
          verDetalleTicket(loadedTkt.id);
          return;
        }
        const navTickets = document.querySelector('.nav-item[data-view="tickets"]');
        if (navTickets) navTickets.click();
        setTimeout(() => {
          const searchInput = document.getElementById('search-tickets');
          if (searchInput) {
            searchInput.value = id;
            if (typeof renderTickets === 'function') renderTickets();
          }
        }, 150);
      }).catch(() => {
        const navTickets = document.querySelector('.nav-item[data-view="tickets"]');
        if (navTickets) navTickets.click();
      });
      return;
    }

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
  const isStaffAdmin = isSuperadmin || (typeof currentSession !== 'undefined' && currentSession && ['superadmin', 'admin', 'supervisor'].includes(String(currentSession.viewMode || currentSession.realRol || currentSession.rol || '').toLowerCase().trim()));
  const isClientView = ['empresa', 'cliente', 'cliente-consultor'].includes(window.currentSession?.viewMode);
  const canAccessCotizadorInterno = isStaffAdmin && !isClientView;
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
    ` : (isStaffAdmin ? `
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
          <i data-lucide="file-plus" style="width: 14px; height: 14px;"></i> Generar Orden de Servicio
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
    <div class="detalle-section" id="section-detalle-desc-${t.id}">
      <div class="detalle-section-title" onclick="window.toggleDescripcionTicket('${t.id}')" style="cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between;" title="Clic para contraer o expandir la descripción">
        <span>Descripción</span>
        <button type="button" id="btn-toggle-desc-${t.id}" onclick="event.stopPropagation(); window.toggleDescripcionTicket('${t.id}')" onmouseenter="this.style.background='rgba(232, 130, 12, 0.16)'" onmouseleave="this.style.background='rgba(232, 130, 12, 0.08)'" style="background: rgba(232, 130, 12, 0.08); border: 1px solid rgba(232, 130, 12, 0.25); border-radius: 4px; padding: 2px 8px; font-size: 0.7rem; font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif); font-weight: 600; color: var(--accent); text-transform: none; letter-spacing: normal; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s;">
          <span id="text-toggle-desc-${t.id}">Contraer</span>
          <i data-lucide="chevron-up" id="icon-toggle-desc-${t.id}" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
      <div id="preview-detalle-desc-${t.id}" onclick="window.toggleDescripcionTicket('${t.id}')" style="display: none; font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; padding: 0.2rem 0.1rem; font-style: italic; font-family: var(--font-sans, inherit); letter-spacing: normal;" title="Clic para expandir descripción completa">
        ${safeEscapeHTML((t.descripcion || '—').replace(/\s+/g, ' ').trim())}
      </div>
      <div class="detalle-field" id="body-detalle-desc-${t.id}">
        <div class="detalle-value" style="white-space: pre-wrap;">${t.descripcion || '—'}</div>
      </div>
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
        ${t.pdfCotizacion ? field('PDF Cotización', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : (t.cotizacionSAP ? field('PDF Cotización', `<div style="display:inline-flex; align-items:center; gap:0.4rem;"><span style="color:var(--text-muted); font-size:0.78rem;">Sin adjunto</span><input type="file" id="input-grid-pdf-cot-${t.id}" accept=".pdf" style="display:none;" onchange="window.adjuntarDocumentoTicketDirecto('${t.id}', 'cotizacion', this)" /><button type="button" onclick="document.getElementById('input-grid-pdf-cot-${t.id}').click()" class="btn-secondary" style="padding:0.15rem 0.45rem; font-size:0.72rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.2rem;"><i data-lucide="upload" style="width:12px;height:12px;"></i> Adjuntar</button></div>`) : '')}
        ${t.cotAceptada ? field('Resultado', t.cotAceptada === 'si' ? '<span style="color:var(--green); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Aprobada</span>' : '<span style="color:var(--red); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> Rechazada</span>') : ''}
        ${t.motivoRechazo ? field('Motivo Rechazo', t.motivoRechazo) : ''}
        ${t.pedidoSAP ? field('Pedido SAP', t.pedidoSAP) : ''}
        ${t.pdfPedido ? field('PDF Pedido', `<div style="display:inline-flex; gap:0.25rem;"><button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button><button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'pedido')" class="btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button></div>`) : (t.pedidoSAP ? field('PDF Pedido', `<div style="display:inline-flex; align-items:center; gap:0.4rem;"><span style="color:var(--text-muted); font-size:0.78rem;">Sin adjunto</span><input type="file" id="input-grid-pdf-ped-${t.id}" accept=".pdf" style="display:none;" onchange="window.adjuntarDocumentoTicketDirecto('${t.id}', 'pedido', this)" /><button type="button" onclick="document.getElementById('input-grid-pdf-ped-${t.id}').click()" class="btn-secondary" style="padding:0.15rem 0.45rem; font-size:0.72rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.2rem;"><i data-lucide="upload" style="width:12px;height:12px;"></i> Adjuntar</button></div>`) : '')}
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

      <!-- Cotizador Interno: solo en etapa de refacciones una vez guardadas las refacciones -->
      ${canAccessCotizadorInterno ? renderCotizadorInternoTicketHtml(t) : ''}

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
              <label class="custom-file-upload" style="flex:1; margin:0;" data-drop-zone="cotizacion" title="Arrastra tu PDF aquí o haz clic para seleccionarlo">
                <input type="file" id="quick-cot-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfCotizacion(this.files[0], false, '${t.id}');"/>
                <i data-lucide="upload-cloud" style="width:24px; height:24px; margin-bottom:0.3rem;"></i>
                <span class="file-label-text">Arrastra aquí o selecciona tu cotización (PDF)</span>
                <span class="file-sublabel-text">Haz clic o suelta el archivo PDF aquí</span>
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
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; box-shadow: var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.85rem; color:var(--text-secondary);">
          <i data-lucide="file-text" style="width:16px;height:16px;color:var(--accent);"></i> Archivo de Cotización
        </div>
        <div style="display:flex; gap:0.25rem; align-items:center;">
          <button type="button" onclick="window.visualizarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button>
          <button type="button" onclick="window.descargarPdfOnDemand('${t.id}', 'cotizacion')" class="btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="download" style="width:14px;height:14px;"></i> Descargar</button>
          <input type="file" id="input-replace-pdf-cot-${t.id}" accept=".pdf" style="display:none;" onchange="window.adjuntarDocumentoTicketDirecto('${t.id}', 'cotizacion', this)" />
          <button type="button" onclick="document.getElementById('input-replace-pdf-cot-${t.id}').click()" class="btn-secondary" title="Reemplazar archivo PDF" style="padding:0.25rem 0.5rem; font-size:0.78rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;"><i data-lucide="upload" style="width:14px;height:14px;"></i></button>
        </div>
      </div>
      ` : `
      <div style="background:var(--bg-card); border:1px dashed var(--border); border-radius:8px; padding:0.85rem 1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; box-shadow: var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-muted);">
          <i data-lucide="file-question" style="width:16px;height:16px;color:#f59e0b;"></i>
          <span>Sin archivo PDF de cotización adjunto</span>
        </div>
        <div>
          <input type="file" id="input-adjuntar-pdf-cot-${t.id}" accept=".pdf" style="display:none;" onchange="window.adjuntarDocumentoTicketDirecto('${t.id}', 'cotizacion', this)" />
          <button type="button" onclick="document.getElementById('input-adjuntar-pdf-cot-${t.id}').click()" class="btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem; border:1px solid var(--accent); color:var(--accent); background:rgba(232, 130, 12, 0.06); cursor:pointer; display:inline-flex; align-items:center; gap:0.35rem; font-weight:600; border-radius:6px;">
            <i data-lucide="upload" style="width:14px;height:14px;"></i> Adjuntar PDF
          </button>
        </div>
      </div>
      `}
      
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

      ${canAccessCotizadorInterno ? renderCotizadorInternoTicketHtml(t) : ''}

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
                <label class="custom-file-upload" style="flex:1; margin:0;" data-drop-zone="pedido" title="Arrastra tu PDF aquí o haz clic para seleccionarlo">
                  <input type="file" id="quick-ped-pdf-${t.id}" accept="application/pdf" onchange="updateFileLabel(this); if(this.files[0]) window.autoExtraerDesdePdfPedido(this.files[0], false, '${t.id}');" />
                  <i data-lucide="upload-cloud" style="width:24px; height:24px; margin-bottom:0.3rem;"></i>
                  <span class="file-label-text">Arrastra aquí o selecciona tu pedido (PDF)</span>
                  <span class="file-sublabel-text">Haz clic o suelta el archivo PDF aquí</span>
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
      ${isStaffAdmin ? `
        ${isSuperadmin ? `
        <button class="btn-secondary" style="border-color:var(--accent); color:var(--accent);" onclick="forzarEstadoTicket('${t.id}')">
          <i data-lucide="zap" style="width:16px;height:16px;margin-right:4px;"></i> Forzar Estado
        </button>
        ` : ''}
        ${!assocOrder ? `
          <button class="btn-secondary" style="border-color:#2563eb; color:#2563eb;" onclick="forzarCrearOrdenServicio('${t.id}')">
            <i data-lucide="file-plus" style="width:16px;height:16px;margin-right:4px;"></i> Generar Orden de Servicio
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

  function safeExtraerArticulosDeTexto(text) {
    if (!text || typeof text !== 'string') return { articulos: [], extras: [], logisticaTexto: '' };
    const articulos = [];
    
    // Intento 1: Formato SAP Pedido Cliente / PED_TRI (ej: 1 4,113.11 16.00 4,113.11 001 1 MET SENSOR...)
    const itemRegexSap = /(?:(\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+)?(\d{3})\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+(.*?)(?=\s+(?:ZFAC\d+|Item Code:|\d+(?:\.\d+)?\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+\d{3}|\d{3}\s+\d+|\bSubtotal:|\bImporte total:|$))/gi;
    let sapMatch;
    while ((sapMatch = itemRegexSap.exec(text)) !== null) {
      const desc = (sapMatch[8] || '').trim();
      if (desc && desc.length > 2) {
        articulos.push({
          partida: sapMatch[5],
          cantidad: parseFloat(sapMatch[6] || sapMatch[1] || '1'),
          unidad_medida: sapMatch[7] || 'MET',
          descripcion: desc,
          precio: sapMatch[2] ? parseFloat(sapMatch[2].replace(/,/g, '')) : 0,
          impuesto_porcentaje: sapMatch[3] ? parseFloat(sapMatch[3].replace(/,/g, '')) : 16,
          total: sapMatch[4] ? parseFloat(sapMatch[4].replace(/,/g, '')) : 0
        });
      }
    }

    // Intento 2: Formato estándar partida descripcion cant um x_surtir almacen precio imp total
    if (articulos.length === 0) {
      const itemRegex = /\b(\d{3})\s+(.*?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\b/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(text)) !== null) {
        articulos.push({
          partida: itemMatch[1],
          descripcion: itemMatch[2].trim(),
          cantidad: parseFloat(itemMatch[3]),
          unidad_medida: itemMatch[4],
          x_surtir: parseFloat(itemMatch[5]),
          almacen: itemMatch[6],
          precio: parseFloat(itemMatch[7].replace(/,/g, '')),
          impuesto_porcentaje: parseFloat(itemMatch[8].replace(/,/g, '')),
          total: parseFloat(itemMatch[9].replace(/,/g, ''))
        });
      }
    }

    const extraKeywords = ['consumibles', 'asistencia', 'casetas', 'viaticos', 'viáticos', 'reembolso', 'km', 'kilometraje', 'hospedaje', 'alimentos', 'traslado', 'logistica', 'logística', 'entrega', 'envio', 'envío', 'ocurre', 'flete'];
    const mainArt = [];
    const extArt = [];
    articulos.forEach(art => {
      const descLower = (art.descripcion || '').toLowerCase();
      if (extraKeywords.some(kw => descLower.includes(kw))) {
        extArt.push(art);
      } else {
        mainArt.push(art);
      }
    });

    let logText = '';
    const expMatch = text.match(/(?:Clase de expedición\s*:\s*|Dirección de entrega\s*:\s*|Envío a ocurre\s*:\s*)([^█\n\r]+)/i) ||
                     text.match(/(?:Envío\s+(?:inmediato|a\s+ocurre)[^█\n\r]*)/i) ||
                     text.match(/([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)\s*-\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s,]+)\s*-\s*(\d+)\s*-\s*KM/i);
    if (expMatch) {
      let rawLog = expMatch[1] ? expMatch[1].trim() : expMatch[0].trim();
      rawLog = rawLog.split(/(?:Basado en|Permitir|Impreso por|Fecha de|Total|Subtotal)/i)[0].trim().replace(/[\.\s]+$/, '');
      logText = rawLog;
    }

    return { articulos: mainArt, extras: extArt, logisticaTexto: logText };
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
          let mainArticulos = Array.isArray(ex.conceptos) ? [...ex.conceptos] : [];
          let extrasArticulos = Array.isArray(ex.extras) ? [...ex.extras] : [];
          
          // Si los conceptos/extras estaban vacíos y ex.ruta_servicio contiene texto del PDF, recuperar los artículos
          if (mainArticulos.length === 0 && extrasArticulos.filter(x => !x.isViajeData).length === 0 && ex.ruta_servicio) {
            const parsed = safeExtraerArticulosDeTexto(ex.ruta_servicio);
            if (parsed.articulos.length > 0 || parsed.extras.length > 0) {
              mainArticulos = parsed.articulos;
              const viajeItem = extrasArticulos.find(x => x.isViajeData);
              extrasArticulos = parsed.extras;
              if (viajeItem) extrasArticulos.push(viajeItem);
            }
          }
          
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
            let rutaLimpia = ex.ruta_servicio;
            if (rutaLimpia.length > 80 || /CFDI|PEDIDO|Subtotal|RFC:|Impreso por/i.test(rutaLimpia)) {
              const expMatch = rutaLimpia.match(/(?:Clase de expedición\s*:\s*|Dirección de entrega\s*:\s*|Envío a ocurre\s*:\s*)([^█\n\r]+)/i) ||
                               rutaLimpia.match(/(?:Envío\s+(?:inmediato|a\s+ocurre)[^█\n\r]*)/i) ||
                               rutaLimpia.match(/([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)\s*-\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s,]+)\s*-\s*(\d+)\s*-\s*KM/i);
              if (expMatch) {
                let rawLog = expMatch[1] ? expMatch[1].trim() : expMatch[0].trim();
                rutaLimpia = rawLog.split(/(?:Basado en|Permitir|Impreso por|Fecha de|Total|Subtotal)/i)[0].trim().replace(/[\.\s]+$/, '');
              } else {
                rutaLimpia = '';
              }
            }
            if (rutaLimpia) {
              logisticaHtml = `
                <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                  <div style="font-weight:600; color:var(--text-secondary); margin-bottom: 0.5rem; display:flex; align-items:center; gap:6px;">
                    <span>✈️ Logística Extraída (Ruta / Envío)</span>
                  </div>
                  <div style="padding:0.5rem 0.75rem; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border); font-size:0.75rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <i data-lucide="truck" style="width:16px; height:16px; color:var(--accent); flex-shrink:0;"></i>
                    <span>${rutaLimpia}</span>
                  </div>
                </div>
              `;
            }
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
          const rawTextLower = (ex.ruta_servicio || '').toLowerCase();
          const hasReembolsoInText = (rawTextLower.includes('reembolso') && (rawTextLower.includes('km') || rawTextLower.includes('casetas') || rawTextLower.includes('kilometraje'))) || rawTextLower.includes('reembolso km');
          const hasReembolsoKm = allExtractedItems.some(x => !x.isViajeData && x.descripcion && ((x.descripcion.toLowerCase().includes('reembolso') && (x.descripcion.toLowerCase().includes('km') || x.descripcion.toLowerCase().includes('casetas') || x.descripcion.toLowerCase().includes('kilometraje'))) || x.descripcion.toLowerCase().includes('reembolso km') || x.descripcion.toLowerCase().includes('km de traslado'))) || hasReembolsoInText;

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

async function adjuntarDocumentoTicketDirecto(ticketId, tipo, fileInput) {
  if (typeof document === 'undefined') return;
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Por favor, selecciona un archivo en formato PDF.', 'warning');
    return;
  }

  const list = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : ((typeof window !== 'undefined' && Array.isArray(window.tickets)) ? window.tickets : []);
  const t = list.find(x => x && (x.id === ticketId || x.folio === ticketId));
  if (!t) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Ticket no encontrado.', 'error');
    return;
  }

  const isPedido = tipo === 'pedido';
  const label = isPedido ? 'pdfPedido' : 'pdfCotizacion';
  const colName = isPedido ? 'pdf_pedido' : 'pdf_cotizacion';
  const docName = isPedido ? 'pedido' : 'cotización';

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`Procesando y guardando PDF de ${docName}...`, 'info');
  }

  try {
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    t[label] = base64;

    if (typeof safeSetJSON === 'function') {
      safeSetJSON('sapi_tickets', list);
    }

    if (window.supabaseClient) {
      const updatePayload = {};
      updatePayload[colName] = base64;
      const { error } = await window.supabaseClient
        .from('tickets')
        .update(updatePayload)
        .eq('id', t.id);

      if (error) {
        console.warn(`Error al actualizar ${colName} en Supabase:`, error);
      }
    }

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`PDF de ${docName} adjuntado correctamente.`, 'success');
    }

    if (typeof verDetalleTicket === 'function') {
      verDetalleTicket(t.id);
    }
  } catch (err) {
    console.error(`Error al adjuntar PDF de ${docName}:`, err);
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Error al adjuntar archivo: ' + (err.message || err), 'error');
    }
  }
}

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
    const isRefCat = String(t.categoria || '').toLowerCase().includes('refacci') || (t.folio && t.folio.endsWith('-A'));
    const hasParts = Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0;
    if ((isRefCat || hasParts) && typeof window.asegurarGuiaEnvioParaTicket === 'function') {
      window.asegurarGuiaEnvioParaTicket(t);
    }
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
        let autoReembolsoKm = false;
        let autoNoches = '';
        let autoAlimentacion = '';
        let autoTrasladoCosto = '';

        if (window.supabaseClient) {
          try {
            const orFilters = [`ticket_id.eq.${id}`];
            if (t.folio) orFilters.push(`ticket_id.eq.${t.folio}`);
            if (pedidoSAP) orFilters.push(`folio_sap.eq.${pedidoSAP}`);

            const { data: dbEx } = await window.supabaseClient
              .from('pdf_extracciones_ai')
              .select('conceptos, extras, ruta_servicio, folio_sap')
              .or(orFilters.join(','))
              .order('fecha_extraccion', { ascending: false })
              .limit(1);

            if (dbEx && dbEx.length > 0) {
              const exRow = dbEx[0];
              if (exRow.conceptos && Array.isArray(exRow.conceptos)) {
                refUtilizadasExtraidas = exRow.conceptos.map(c => {
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

              const ext = exRow.extras || [];
              const allItems = [...(exRow.conceptos || []), ...ext];
              const rawTxt = (exRow.ruta_servicio || '').toLowerCase();
              autoReembolsoKm = allItems.some(x => !x.isViajeData && x.descripcion && ((x.descripcion.toLowerCase().includes('reembolso') && (x.descripcion.toLowerCase().includes('km') || x.descripcion.toLowerCase().includes('casetas') || x.descripcion.toLowerCase().includes('kilometraje'))) || x.descripcion.toLowerCase().includes('reembolso km') || x.descripcion.toLowerCase().includes('km de traslado'))) ||
                (rawTxt.includes('reembolso') && (rawTxt.includes('km') || rawTxt.includes('casetas') || rawTxt.includes('kilometraje'))) || rawTxt.includes('reembolso km');

              const viajeData = ext.find(x => x && x.isViajeData);
              if (viajeData) {
                if (viajeData.num_hospedaje) autoNoches = viajeData.num_hospedaje;
                if (viajeData.num_alimento) autoAlimentacion = viajeData.num_alimento;
                if (viajeData.num_traslado) autoTrasladoCosto = viajeData.num_traslado;
              }
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
        if (!autoReembolsoKm && window._lastPdfPedidoExtracted) {
          const lpe = window._lastPdfPedidoExtracted;
          const allLpeItems = [...(lpe.articulos || []), ...(lpe.mainArticulos || [])];
          const rawLpe = (lpe.cleanText || '').toLowerCase();
          autoReembolsoKm = allLpeItems.some(x => x.descripcion && ((x.descripcion.toLowerCase().includes('reembolso') && (x.descripcion.toLowerCase().includes('km') || x.descripcion.toLowerCase().includes('casetas') || x.descripcion.toLowerCase().includes('kilometraje'))) || x.descripcion.toLowerCase().includes('reembolso km'))) ||
            (rawLpe.includes('reembolso') && (rawLpe.includes('km') || rawLpe.includes('casetas') || rawLpe.includes('kilometraje'))) || rawLpe.includes('reembolso km');
          if (lpe.detallesViaje) {
            if (!autoNoches && lpe.detallesViaje.num_hospedaje) autoNoches = lpe.detallesViaje.num_hospedaje;
            if (!autoAlimentacion && lpe.detallesViaje.num_alimento) autoAlimentacion = lpe.detallesViaje.num_alimento;
            if (!autoTrasladoCosto && lpe.detallesViaje.num_traslado) autoTrasladoCosto = lpe.detallesViaje.num_traslado;
          }
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
          soporte: t.folio || t.id,
          ticket_id: t.id,
          ticket_folio: t.folio,
          km_ida: '', km_vuelta: '', km_total: '',
          tipo: tipoVisitaSeleccionado,
          estado: 'Pendiente',
          falla: (t.asunto ? t.asunto + '\n' : '') + (t.descripcion || ''),
          trabajos: '', dictamen: '', condiciones: '',
          observaciones: '', pendientes: '',
          ref_utilizadas: refUtilizadasExtraidas, ref_necesarias: refNecesariasManuales,
          factura_ref: '', factura_mo: '',
          noches: autoNoches,
          alimentacion: autoAlimentacion,
          traslado_costo: autoTrasladoCosto,
          reembolso_km: !!autoReembolsoKm,
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

  // Asegurar generación automática de Guía de Envío SOLO si el ticket tiene refacciones y pedido confirmado
  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    const isRefCat = String(t.categoria || '').toLowerCase().includes('refacci') || String(t.categoria || '').toLowerCase().includes('garant') || (t.folio && t.folio.endsWith('-A'));
    const hasOrder = (typeof window.ticketTienePedidoOEnvioValido === 'function') ? window.ticketTienePedidoOEnvioValido(t) : (t.pedidoSAP || t.pdfPedido || t.guiaPedido);
    if ((isRefCat || (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0)) && hasOrder) {
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
  if (e && (e.target === document.getElementById('modal-ticket-detalle-overlay') || e.target?.classList?.contains('modal-overlay'))) return;
  const overlay = document.getElementById('modal-ticket-detalle-overlay');
  if (overlay) overlay.classList.remove('open');
  if (typeof document.querySelectorAll === 'function') {
    const openDrawers = document.querySelectorAll('.cotizador-drawer.open, .cotizador-drawer-backdrop.open');
    openDrawers.forEach(el => el.classList?.remove('open'));
  }
  document.body.style.overflow = '';
  const fab = document.getElementById('mobile-fab-container');
  if (fab) fab.classList.remove('hidden');
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
  const sess = (typeof currentSession !== 'undefined' && currentSession) ? currentSession : (typeof window !== 'undefined' ? window.currentSession : null);
  const isStaff = isSuperadmin || (sess && ['superadmin', 'admin', 'supervisor'].includes(String(sess.viewMode || sess.realRol || sess.rol || '').toLowerCase().trim()));
  
  if (!isStaff) {
    mostrarNotificacion('Acción restringida: Solo administradores y supervisores pueden generar órdenes de servicio.', 'error');
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
          <i data-lucide="file-plus" style="color: #2563eb; width: 20px; height: 20px;"></i> Generar Orden de Servicio
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
        soporte: t.folio || t.id,
        ticket_id: t.id,
        ticket_folio: t.folio,
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

  var exports = {
    renderComentariosInternosHtml: renderComentariosInternosHtml,
    renderCotizadorInternoTicketHtml: renderCotizadorInternoTicketHtml,
    renderTablaCotizacionTicket: renderTablaCotizacionTicket,
    toggleCotizadorInterno: toggleCotizadorInterno,
    toggleAsistenteCotizadorTicket: toggleAsistenteCotizadorTicket,
    actualizarParametroCotizadorTicket: actualizarParametroCotizadorTicket,
    cargarConceptosAsistenteEnCotizacion: cargarConceptosAsistenteEnCotizacion,
    copiarResumenClaraTicket: copiarResumenClaraTicket,
    agregarItemCotizacionTicket: agregarItemCotizacionTicket,
    eliminarItemCotizacionTicket: eliminarItemCotizacionTicket,
    actualizarItemCotizacionTicket: actualizarItemCotizacionTicket,
    toggleIvaCotizacionTicket: toggleIvaCotizacionTicket,
    buscarRefaccionCatalogoCotizador: buscarRefaccionCatalogoCotizador,
    seleccionarRefaccionCatalogoCotizador: seleccionarRefaccionCatalogoCotizador,
    importarRefaccionesEnCotizacionTicket: importarRefaccionesEnCotizacionTicket,
    recalcularCotizacionTicket: recalcularCotizacionTicket,
    guardarCotizacionInternaTicket: guardarCotizacionInternaTicket,
    limpiarCotizacionInternaTicket: limpiarCotizacionInternaTicket,
    COTIZADOR_LINEAS: COTIZADOR_LINEAS,
    COTIZADOR_DESCUENTOS_CLIENTE: COTIZADOR_DESCUENTOS_CLIENTE,
    COTIZADOR_TARIFAS_CUADRILLA: COTIZADOR_TARIFAS_CUADRILLA,
    COTIZADOR_TARIFAS_HOSPEDAJE: COTIZADOR_TARIFAS_HOSPEDAJE,
    generarDatosExportacionExcel: generarDatosExportacionExcel,
    copiarTablaCotizacionExcel: copiarTablaCotizacionExcel,
    descargarCsvCotizacionExcel: descargarCsvCotizacionExcel,
    mostrarModalVistaExcel: mostrarModalVistaExcel,
    switchCommentTab: switchCommentTab,
    agregarComentarioInterno: agregarComentarioInterno,
    agregarComentarioExterno: agregarComentarioExterno,
    verDetalleTicket: verDetalleTicket,
    visualizarPdfOnDemand: visualizarPdfOnDemand,
    visualizarDestinoPdfActual: visualizarDestinoPdfActual,
    descargarPdfOnDemand: descargarPdfOnDemand,
    avanzarCotizacionTicket: avanzarCotizacionTicket,
    cerrarCotizacionTicket: cerrarCotizacionTicket,
    cerrarDetalleTicket: cerrarDetalleTicket,
    forzarEstadoTicket: forzarEstadoTicket,
    forzarCrearOrdenServicio: forzarCrearOrdenServicio,
    adjuntarDocumentoTicketDirecto: adjuntarDocumentoTicketDirecto,
    toggleDescripcionTicket: toggleDescripcionTicket
  };

  if (typeof root !== "undefined") {
    root.TicketsDetalle = exports;
  }
  if (typeof window !== "undefined") {
    window.TicketsDetalle = exports;
    window.renderComentariosInternosHtml = renderComentariosInternosHtml;
    window.renderCotizadorInternoTicketHtml = renderCotizadorInternoTicketHtml;
    window.renderTablaCotizacionTicket = renderTablaCotizacionTicket;
    window.toggleCotizadorInterno = toggleCotizadorInterno;
    window.toggleAsistenteCotizadorTicket = toggleAsistenteCotizadorTicket;
    window.actualizarParametroCotizadorTicket = actualizarParametroCotizadorTicket;
    window.cargarConceptosAsistenteEnCotizacion = cargarConceptosAsistenteEnCotizacion;
    window.copiarResumenClaraTicket = copiarResumenClaraTicket;
    window.generarDatosExportacionExcel = generarDatosExportacionExcel;
    window.copiarTablaCotizacionExcel = copiarTablaCotizacionExcel;
    window.descargarCsvCotizacionExcel = descargarCsvCotizacionExcel;
    window.mostrarModalVistaExcel = mostrarModalVistaExcel;
    window.agregarItemCotizacionTicket = agregarItemCotizacionTicket;
    window.eliminarItemCotizacionTicket = eliminarItemCotizacionTicket;
    window.actualizarItemCotizacionTicket = actualizarItemCotizacionTicket;
    window.toggleIvaCotizacionTicket = toggleIvaCotizacionTicket;
    window.buscarRefaccionCatalogoCotizador = buscarRefaccionCatalogoCotizador;
    window.seleccionarRefaccionCatalogoCotizador = seleccionarRefaccionCatalogoCotizador;
    window.importarRefaccionesEnCotizacionTicket = importarRefaccionesEnCotizacionTicket;
    window.recalcularCotizacionTicket = recalcularCotizacionTicket;
    window.guardarCotizacionInternaTicket = guardarCotizacionInternaTicket;
    window.limpiarCotizacionInternaTicket = limpiarCotizacionInternaTicket;
    window.COTIZADOR_LINEAS = COTIZADOR_LINEAS;
    window.COTIZADOR_DESCUENTOS_CLIENTE = COTIZADOR_DESCUENTOS_CLIENTE;
    window.COTIZADOR_TARIFAS_CUADRILLA = COTIZADOR_TARIFAS_CUADRILLA;
    window.COTIZADOR_TARIFAS_HOSPEDAJE = COTIZADOR_TARIFAS_HOSPEDAJE;
    window.switchCommentTab = switchCommentTab;
    window.agregarComentarioInterno = agregarComentarioInterno;
    window.agregarComentarioExterno = agregarComentarioExterno;
    window.verDetalleTicket = verDetalleTicket;
    window.toggleDescripcionTicket = toggleDescripcionTicket;
    window.visualizarPdfOnDemand = visualizarPdfOnDemand;
    window.visualizarDestinoPdfActual = visualizarDestinoPdfActual;
    window.descargarPdfOnDemand = descargarPdfOnDemand;
    window.avanzarCotizacionTicket = avanzarCotizacionTicket;
    window.cerrarCotizacionTicket = cerrarCotizacionTicket;
    window.cerrarDetalleTicket = cerrarDetalleTicket;
    window.forzarEstadoTicket = forzarEstadoTicket;
    window.forzarCrearOrdenServicio = forzarCrearOrdenServicio;
    window.adjuntarDocumentoTicketDirecto = adjuntarDocumentoTicketDirecto;
  }

  return exports;
});
