/**
 * MÓDULO DE GESTIÓN DE USUARIOS, SESIONES Y ROLES CRUD
 * Eurorep / SAPI - ES Module
 */
import { supabaseClient } from "../supabaseClient.js";

// Fallbacks y polyfills defensivos para Node.js y ambientes desacoplados
if (typeof globalThis.usuarios === "undefined") globalThis.usuarios = [];
if (typeof globalThis.clientesDb === "undefined") globalThis.clientesDb = [];
if (typeof globalThis.currentSession === "undefined") globalThis.currentSession = { userId: "admin", viewMode: "admin", realRol: "superadmin" };
if (typeof globalThis.ROLES === "undefined") {
  globalThis.ROLES = {
    superadmin: { label: "SuperAdmin", views: [] },
    admin: { label: "Admin", views: [] },
    supervisor: { label: "Supervisor", views: [] },
    tecnico: { label: "Técnico", views: [] },
    empresa: { label: "Empresa", views: [] },
    consulta: { label: "Consulta", views: [] }
  };
}

let editandoUserId = null;

// ===== USUARIOS CRUD =====
function renderUsuariosList() {
  if (typeof document === "undefined") return;
  if (typeof renderPortalUsuariosList === 'function') {
    renderPortalUsuariosList();
  }
  const list = document.getElementById('usuarios-list');
  if (!list) return;

  const searchText = (document.getElementById('busqueda-usuario')?.value || '').toLowerCase().trim();
  const filterRole = document.getElementById('filtro-rol-usuario')?.value || 'todos';

  const doRender = () => {
    let filtered = [...usuarios];
    filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    
    if (filterRole !== 'todos') {
      filtered = filtered.filter(u => u.rol === filterRole);
    }
    
    if (searchText) {
      filtered = filtered.filter(u => 
        (u.nombre && u.nombre.toLowerCase().includes(searchText)) || 
        (u.email && u.email.toLowerCase().includes(searchText)) ||
        (u.empresa && u.empresa.toLowerCase().includes(searchText))
      );
    }

    const ROLE_COLORS = { superadmin:'#E8820C', admin:'#4f8ef7', supervisor:'#eab308', tecnico:'#10b981', empresa:'#8b5cf6', consulta: '#64748b' };
    
    if (filtered.length === 0) {
      list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No se encontraron usuarios que coincidan con la búsqueda.</div>';
      return;
    }

    list.innerHTML = filtered.map(u => {
      let empNamesDisplay = '';
      if (u.empresas && u.empresas.length > 0) {
        empNamesDisplay = u.empresas.map(empId => {
          const match = clientesDb.find(c => c.id === empId);
          return match ? match.nombre : empId;
        }).join(', ');
      } else {
        empNamesDisplay = u.empresa || '';
      }

      return `
        <div class="usuario-row-full" style="${u.activo === false ? 'opacity: 0.6;' : ''}">
          <div class="usuario-avatar" style="background:${ROLE_COLORS[u.rol]||'var(--accent)'};">${(u.nombre||'?')[0].toUpperCase()}</div>
          <div class="usuario-info">
            <div class="usuario-name">${u.nombre} ${u.activo === false ? '<span style="color:var(--red); font-size:0.7rem;">(Inactivo / Pendiente)</span>' : ''}</div>
            <div class="usuario-email">${u.email || ''} ${empNamesDisplay ? `| ${empNamesDisplay}` : ''}</div>
          </div>
          <span class="badge" style="background:${ROLE_COLORS[u.rol]}22;color:${ROLE_COLORS[u.rol]};border-radius:99px;padding:0.2rem 0.6rem;font-size:0.72rem;font-weight:600;">${ROLES[u.rol]?.label || u.rol}</span>
          <div style="display:flex; gap:0.25rem;">
            <button class="action-btn" onclick="window._modalUsuarioContexto = 'config'; editarUsuario('${u.id}')" title="Editar"><i data-lucide="pencil"></i></button>
            ${u.rol !== 'superadmin' ? `
              <button class="action-btn del" onclick="eliminarUsuario('${u.id}')" title="Desactivar / Borrar"><i data-lucide="trash-2"></i></button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    lucide.createIcons();
  };

  // Renderizar de inmediato usando caché
  doRender();

  // Traer actualizaciones asíncronamente en segundo plano
  if (window.supabaseClient && !window._isFetchingUsuarios) {
    window._isFetchingUsuarios = true;
    
    const fetchUsersAndCompanies = async () => {
      try {
        const { data: supaUsers, error: usersErr } = await window.supabaseClient.from('user_roles').select('*');
        if (usersErr) throw usersErr;
        
        let cUsrs = [];
        try {
          const { data: relData, error: relErr } = await window.supabaseClient.from('cliente_usuarios').select('*');
          if (!relErr && relData) cUsrs = relData;
        } catch (e) {
          console.warn('[Supabase] Error al cargar cliente_usuarios en segundo plano:', e);
        }
        
        const mappedUsers = supaUsers.map(u => {
          const myCompanies = cUsrs.filter(cu => cu.usuario_id === u.id).map(cu => cu.cliente_id);
          return { ...u, empresas: myCompanies };
        });
        
        window._isFetchingUsuarios = false;
        if (mappedUsers && mappedUsers.length > 0) {
          const isCurrentAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.viewMode);
          if (mappedUsers.length > 1 || isCurrentAdmin) {
            const newUsuarios = ensureBackdoorUsersFallback(mappedUsers);
            if (JSON.stringify(newUsuarios) !== JSON.stringify(usuarios)) {
              usuarios = newUsuarios;
              localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
              doRender();
            }
          }
        }
      } catch (err) {
        window._isFetchingUsuarios = false;
        console.warn('[Supabase] Error en segundo plano al cargar usuarios:', err.message);
      }
    };
    
    fetchUsersAndCompanies();
  }
}

function abrirModalUsuario(id) {
  if (typeof document === "undefined") return;
  editandoUserId = id || null;
  const titleEl = document.getElementById('usuario-modal-title');
  if (titleEl) titleEl.textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
  
  const formEl = document.getElementById('form-usuario');
  if (formEl) formEl.reset();
  
  // Limpiar y ocultar sección de restablecer contraseña
  const uResetPassSection = document.getElementById('u-reset-pass-section');
  const uNewPassword = document.getElementById('u-new-password');
  const uResetPassError = document.getElementById('u-reset-pass-error');
  if (uNewPassword) uNewPassword.value = '';
  if (uResetPassError) {
    uResetPassError.textContent = '';
    uResetPassError.style.color = '';
  }
  if (uResetPassSection) {
    uResetPassSection.style.display = id ? 'block' : 'none';
  }

  // Limpiar y configurar sección de fusión de cuenta
  const uFusionSection = document.getElementById('u-fusion-section');
  const uFusionDestinoSelect = document.getElementById('u-fusion-destino-select');
  const uFusionPreviewBox = document.getElementById('u-fusion-preview-box');
  const uFusionOrigenLabel = document.getElementById('u-fusion-origen-label');
  if (uFusionPreviewBox) uFusionPreviewBox.style.display = 'none';
  if (uFusionDestinoSelect) uFusionDestinoSelect.value = '';

  const u = id ? usuarios.find(x => x.id === id) : null;
  const assocEmpresas = u ? (u.empresas || []) : [];
  const legacyEmp = (u && u.empresa) ? u.empresa.toLowerCase().trim() : '';
  
  const isClientAssociated = (c) => {
    const valNorm = c.id.toLowerCase().trim();
    const textNorm = c.nombre.toLowerCase().trim();
    return assocEmpresas.includes(c.id) || (legacyEmp && (valNorm === legacyEmp || textNorm === legacyEmp));
  };

  // Rellenar checkboxes de empresas con los datos de clientesDb
  const uEmpresaContainer = document.getElementById('u-empresa-container');
  const uEmpresaCheckboxes = document.getElementById('u-empresa-checkboxes');
  const uEmpresaSearch = document.getElementById('u-empresa-search');
  
  if (uEmpresaSearch) {
    uEmpresaSearch.value = '';
  }

  if (uEmpresaCheckboxes) {
    const sortedClientes = [...clientesDb].sort((a, b) => {
      const aAssoc = isClientAssociated(a);
      const bAssoc = isClientAssociated(b);
      if (aAssoc && !bAssoc) return -1;
      if (!aAssoc && bAssoc) return 1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

    uEmpresaCheckboxes.innerHTML = sortedClientes.map(c => {
      const checked = isClientAssociated(c);
      const bgStyle = checked ? 'background: rgba(79, 142, 247, 0.12) !important; font-weight: 600 !important;' : '';
      return `
        <label class="checkbox-row" style="display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:flex-start !important; gap:0.5rem !important; font-size:0.85rem !important; cursor:pointer !important; color:var(--text-primary) !important; font-weight:normal !important; width:100% !important; text-align:left !important; margin:0 !important; padding:0.35rem 0.5rem !important; border-radius:var(--radius-sm) !important; ${bgStyle}">
          <input type="checkbox" value="${c.id}" ${checked ? 'checked' : ''} style="width:16px !important; height:16px !important; margin:0 !important; cursor:pointer !important; flex-shrink:0 !important;" />
          <span style="font-size:0.85rem !important; color:var(--text-primary) !important; text-align:left !important; line-height:1.2 !important;">${c.nombre}</span>
        </label>
      `;
    }).join('');

    // Agregar evento de búsqueda
    if (uEmpresaSearch) {
      const newSearch = uEmpresaSearch.cloneNode(true);
      uEmpresaSearch.parentNode.replaceChild(newSearch, uEmpresaSearch);
      newSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const rows = uEmpresaCheckboxes.querySelectorAll('.checkbox-row');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          if (!q || text.includes(q)) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    // Evento para cambiar de color al marcar/desmarcar
    uEmpresaCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const row = cb.closest('.checkbox-row');
        if (cb.checked) {
          row.style.setProperty('background', 'rgba(79, 142, 247, 0.12)', 'important');
          row.style.setProperty('font-weight', '600', 'important');
        } else {
          row.style.setProperty('background', 'transparent', 'important');
          row.style.setProperty('font-weight', 'normal', 'important');
        }
      });
    });
  }

  const uNombre = document.getElementById('u-nombre');
  const uEmail = document.getElementById('u-email');
  const uTelefono = document.getElementById('u-telefono');
  const uActivo = document.getElementById('u-activo');
  const uModalOverlay = document.getElementById('modal-usuario-overlay');

  if (uEmpresaContainer) uEmpresaContainer.style.display = 'none';

  const rolRadios = document.querySelectorAll('input[name="u-rol"]');
  rolRadios.forEach(r => r.disabled = false);
  if (uActivo) uActivo.disabled = false;

  // Filter roles based on context (Portal context only shows 'empresa' and 'cliente-consultor')
  const userContext = window._modalUsuarioContexto || 'config';
  const rolCards = document.querySelectorAll('.rol-card');
  rolCards.forEach(card => {
    const radio = card.querySelector('input[name="u-rol"]');
    if (!radio) return;
    
    if (userContext === 'portal') {
      const isPortalRole = ['empresa', 'cliente-consultor'].includes(radio.value);
      card.style.display = isPortalRole ? 'block' : 'none';
    } else {
      card.style.display = 'block';
    }
  });

  // Default value for portal mode when creating a new user
  if (userContext === 'portal' && !id) {
    const radioEmpresa = document.querySelector('input[name="u-rol"][value="empresa"]');
    if (radioEmpresa) {
      radioEmpresa.checked = true;
      if (uEmpresaContainer) uEmpresaContainer.style.display = 'block';
    }
  }

  if (id) {
    if (!u) return;
    if (uNombre) uNombre.value = u.nombre || '';
    if (uEmail) uEmail.value = u.email || '';
    if (uTelefono) uTelefono.value = u.telefono || '';
    if (uActivo) uActivo.checked = u.activo !== false;

    // Mostrar sugerencia de empresa si la tiene
    const uEmpresaSugerida = document.getElementById('u-empresa-sugerida');
    if (u.empresa) {
      if (uEmpresaSugerida) {
        uEmpresaSugerida.innerHTML = `<i data-lucide="info" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> Empresa indicada al registrarse: <strong>${u.empresa}</strong>`;
        uEmpresaSugerida.style.display = 'block';
      }
    } else {
      if (uEmpresaSugerida) uEmpresaSugerida.style.display = 'none';
    }
    
    const radio = document.querySelector(`input[name="u-rol"][value="${u.rol}"]`);
    if (radio) {
      radio.checked = true;
      if (u.rol === 'empresa' || u.rol === 'cliente' || u.rol === 'cliente-consultor') {
        if (uEmpresaContainer) uEmpresaContainer.style.display = 'block';
      }
    }

    // Si es superadmin, bloquear el cambio de rol y de activo para evitar desastres
    if (u.rol === 'superadmin') {
      rolRadios.forEach(r => r.disabled = true);
      if (uActivo) uActivo.disabled = true;
    }

    // Configurar Fusión de Cuenta en el modal
    const isSuperOrAdmin = currentSession && ['superadmin', 'admin'].includes(currentSession.realRol || currentSession.viewMode);
    if (uFusionSection) {
      if (isSuperOrAdmin) {
        uFusionSection.style.display = 'block';
        if (uFusionOrigenLabel) {
          uFusionOrigenLabel.textContent = `${u.nombre || 'Sin nombre'} (${u.email || u.correo || 'Sin correo'})`;
        }
        if (uFusionDestinoSelect) {
          const validUsers = (Array.isArray(usuarios) ? usuarios : []).filter(x => x && x.id !== id && (x.email || x.correo) !== (u.email || u.correo));
          validUsers.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
          let optsHtml = '<option value="">-- Selecciona el usuario destino --</option>';
          validUsers.forEach(other => {
            const otherId = other.id || '';
            const otherNom = other.nombre || 'Sin nombre';
            const otherEmail = other.email || other.correo || 'Sin correo';
            const rolKey = other.rol || 'tecnico';
            const rolLabel = (typeof ROLES !== 'undefined' && ROLES && ROLES[rolKey]?.label) || rolKey;
            const inactivo = other.activo === false ? ' [Inactivo]' : '';
            optsHtml += `<option value="${otherId}">${otherNom} (${otherEmail}) - ${rolLabel}${inactivo}</option>`;
          });
          uFusionDestinoSelect.innerHTML = optsHtml;
          uFusionDestinoSelect.value = '';
        }
      } else {
        uFusionSection.style.display = 'none';
      }
    }
  } else {
    if (uFusionSection) uFusionSection.style.display = 'none';
  }
  if (uModalOverlay) uModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function toggleEmpresaField(radio) {
  if (typeof document === "undefined") return;
  const container = document.getElementById('u-empresa-container');
  if (!container) return;
  if (radio.value === 'empresa' || radio.value === 'cliente' || radio.value === 'cliente-consultor') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function cerrarModalUsuario(e) {
  if (typeof document === "undefined") return;
  const uModalOverlay = document.getElementById('modal-usuario-overlay');
  if (e && e.target !== uModalOverlay) return;
  if (uModalOverlay) uModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  editandoUserId = null;
  const uFusionPreviewBox = document.getElementById('u-fusion-preview-box');
  if (uFusionPreviewBox) uFusionPreviewBox.style.display = 'none';
  const uFusionDestinoSelect = document.getElementById('u-fusion-destino-select');
  if (uFusionDestinoSelect) uFusionDestinoSelect.value = '';
}

function onCambioFusionDestinoModal() {
  if (typeof document === "undefined") return;
  const selectDest = document.getElementById('u-fusion-destino-select');
  const previewBox = document.getElementById('u-fusion-preview-box');
  const previewText = document.getElementById('u-fusion-preview-text');

  if (!selectDest || !previewBox || !previewText) return;
  const destId = selectDest.value;
  if (!destId || !editandoUserId) {
    previewBox.style.display = 'none';
    return;
  }

  const uOrig = (Array.isArray(usuarios) ? usuarios : []).find(x => x && (x.id === editandoUserId || x.email === editandoUserId));
  const uDest = (Array.isArray(usuarios) ? usuarios : []).find(x => x && (x.id === destId || x.email === destId));

  if (!uOrig || !uDest) {
    previewBox.style.display = 'none';
    return;
  }

  const rolKey = uOrig.rol || 'tecnico';
  const rolLabel = (typeof ROLES !== 'undefined' && ROLES && ROLES[rolKey]?.label) || rolKey;
  const emailOrig = uOrig.email || uOrig.correo || 'Sin correo';
  const emailDest = uDest.email || uDest.correo || 'Sin correo';

  previewBox.style.display = 'block';
  previewText.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.35rem;">
      <div><strong style="color:var(--red, #ef4444);">❌ Cuenta a eliminar:</strong> ${uOrig.nombre || 'Sin nombre'} (${emailOrig})</div>
      <div><strong style="color:var(--green, #10b981);">✅ Cuenta que conservará el historial:</strong> ${uDest.nombre || uOrig.nombre || 'Sin nombre'} (${emailDest})</div>
      <div style="margin-top:0.25rem; font-size:0.75rem; color:var(--text-secondary); border-top:1px dashed rgba(232,130,12,0.3); padding-top:0.35rem;">
        Se transferirán todas las órdenes de servicio, bitácoras, tickets, gastos, tarjetas Clara, calendario y permisos del rol <strong>${rolLabel}</strong> a <strong>${emailDest}</strong>.
      </div>
    </div>
  `;
}
window.onCambioFusionDestinoModal = onCambioFusionDestinoModal;

async function ejecutarFusionDesdeEditarUsuario(e) {
  if (typeof document === "undefined") return;
  if (e) e.preventDefault();
  if (!editandoUserId) {
    mostrarNotificacion('Error: No hay ningún usuario seleccionado para editar.', 'error');
    return;
  }

  const selectDest = document.getElementById('u-fusion-destino-select');
  const destId = selectDest ? selectDest.value : null;

  if (!destId) {
    mostrarNotificacion('Por favor, selecciona la cuenta destino receptora.', 'warning');
    return;
  }

  if (destId === editandoUserId) {
    mostrarNotificacion('La cuenta destino no puede ser la misma que la de origen.', 'error');
    return;
  }

  const uOrig = (Array.isArray(usuarios) ? usuarios : []).find(x => x && (x.id === editandoUserId || x.email === editandoUserId));
  const uDest = (Array.isArray(usuarios) ? usuarios : []).find(x => x && (x.id === destId || x.email === destId));

  if (!uOrig || !uDest) {
    mostrarNotificacion('No se encontró alguna de las cuentas seleccionadas.', 'error');
    return;
  }

  const emailOrig = (uOrig.email || uOrig.correo || '').trim().toLowerCase();
  const emailDest = (uDest.email || uDest.correo || '').trim().toLowerCase();

  const confirmMsg = `¿Estás completamente seguro de que deseas fusionar estas cuentas?\n\n` +
    `❌ ORIGEN (Se eliminará): ${uOrig.nombre || 'Sin nombre'} (${emailOrig})\n` +
    `✅ DESTINO (Recibirá todo el historial): ${uDest.nombre || uOrig.nombre || 'Sin nombre'} (${emailDest})\n\n` +
    `Esta acción transferirá todas las órdenes de servicio, bitácoras, gastos, calendario y tickets al nuevo usuario.`;

  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('btn-ejecutar-fusion-modal');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:sapi-spin 0.8s linear infinite;margin-right:6px;vertical-align:middle;"></span> Fusionando...';
  }

  try {
    mostrarNotificacion('Iniciando transferencia y fusión de cuentas...', 'info');

    let serverSuccess = false;

    // 1. Intentar vía API serverless segura con Service Role
    try {
      const session = window.supabaseClient ? (await window.supabaseClient.auth.getSession())?.data?.session : null;
      const token = session ? session.access_token : '';
      if (token) {
        const response = await fetch('/api/admin-merge-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            originUserId: uOrig.id,
            targetUserId: uDest.id
          })
        });

        const resJson = await response.json();
        if (response.ok && resJson.success) {
          serverSuccess = true;
        } else {
          console.warn('[Fusion API] Fallback necesario:', resJson.error);
        }
      }
    } catch (apiErr) {
      console.warn('[Fusion API] Error invocando API endpoint:', apiErr);
    }

    // 2. Si la API falló (o estamos offline/local sin endpoints), intentar RPC
    if (!serverSuccess && window.supabaseClient && emailOrig && emailDest) {
      try {
        const { data: rpcRes, error: rpcErr } = await window.supabaseClient.rpc('fusionar_cuentas_usuario', {
          p_email_viejo: emailOrig,
          p_email_nuevo: emailDest
        });
        if (!rpcErr) {
          serverSuccess = true;
        } else {
          console.warn('[Fusion RPC] Error llamando RPC:', rpcErr.message);
        }
      } catch (rpcEx) {
        console.warn('[Fusion RPC] Excepción llamando RPC:', rpcEx);
      }
    }

    // 3. Fallback directo con el cliente autenticado
    if (!serverSuccess && window.supabaseClient) {
      console.log('[Fusion Direct] Ejecutando migración de datos directa...');
      const targetNombre = (uDest.nombre && uDest.nombre.trim() !== '') ? uDest.nombre : uOrig.nombre;

      // Actualizar perfil y rol en user_roles para la nueva cuenta
      await window.supabaseClient
        .from('user_roles')
        .update({
          nombre: targetNombre,
          rol: uOrig.rol || uDest.rol || 'tecnico',
          telefono: uDest.telefono || uOrig.telefono || null,
          empresa: uDest.empresa || uOrig.empresa || null,
          activo: true
        })
        .eq('id', uDest.id);

      // Traspasar asociaciones de empresas (cliente_usuarios)
      try {
        const { data: relOld } = await window.supabaseClient.from('cliente_usuarios').select('*').eq('usuario_id', uOrig.id);
        if (relOld && relOld.length > 0) {
          for (const rel of relOld) {
            await window.supabaseClient.from('cliente_usuarios').upsert({
              cliente_id: rel.cliente_id,
              usuario_id: uDest.id
            }, { onConflict: 'cliente_id,usuario_id' });
          }
          await window.supabaseClient.from('cliente_usuarios').delete().eq('usuario_id', uOrig.id);
        }
      } catch (e) {}

      // Traspasar otras relaciones
      try { await window.supabaseClient.from('cliente_tecnicos').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('cliente_supervisores').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('gastos').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('gastos_aprobados').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('gastos_rechazados').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('clara_cards').update({ usuario_vinculado_id: uDest.id }).eq('usuario_vinculado_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('calendario_eventos').update({ tecnico_id: uDest.id, creado_por: uDest.id, tecnico_nombre: targetNombre }).eq('tecnico_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('maquinaria_horometros').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('auditoria_logs').update({ usuario_id: uDest.id }).eq('usuario_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('sapi_telemetry').update({ user_id: uDest.id }).eq('user_id', uOrig.id); } catch(e){}
      try { await window.supabaseClient.from('ideas_fallas').update({ creado_por_id: String(uDest.id) }).eq('creado_por_id', String(uOrig.id)); } catch(e){}

      if (uOrig.nombre) {
        try { await window.supabaseClient.from('ordenes').update({ tecnico: targetNombre }).eq('tecnico', uOrig.nombre); } catch(e){}
        try { await window.supabaseClient.from('orden_bitacora').update({ tecnico: targetNombre }).eq('tecnico', uOrig.nombre); } catch(e){}
        try { await window.supabaseClient.from('tickets').update({ asignado: targetNombre }).eq('asignado', uOrig.nombre); } catch(e){}
        try { await window.supabaseClient.from('tickets').update({ solicitante: targetNombre }).eq('solicitante', uOrig.nombre); } catch(e){}
      }

      // Eliminar registro del rol viejo
      try {
        await window.supabaseClient.from('user_roles').delete().eq('id', uOrig.id);
      } catch (e) {}
    }

    // 4. Actualizar estado local en memoria
    if (Array.isArray(usuarios)) {
      usuarios = usuarios.filter(u => u.id !== uOrig.id);
      const destIndex = usuarios.findIndex(u => u.id === uDest.id);
      if (destIndex !== -1) {
        usuarios[destIndex].rol = uOrig.rol || uDest.rol;
        usuarios[destIndex].activo = true;
      }
      window.usuarios = usuarios;
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
    }

    mostrarNotificacion('¡Cuentas fusionadas exitosamente! Todo el historial está en el nuevo correo.', 'success');
    cerrarModalUsuario();

    // Recargar datos desde la nube y refrescar UI
    window._syncPromise = null;
    if (typeof window.cargarDatosDeSupabase === 'function') {
      window.cargarDatosDeSupabase().catch(e => console.warn(e));
    }
    if (typeof renderUsuariosList === 'function') {
      renderUsuariosList();
    }
  } catch (err) {
    console.error('[Fusion] Error durante la fusión de cuentas:', err);
    mostrarNotificacion('Error al fusionar cuentas: ' + (err.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="git-merge" style="width:15px; height:15px;"></i> Transferir Historial y Fusionar';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }
}
window.ejecutarFusionDesdeEditarUsuario = ejecutarFusionDesdeEditarUsuario;

async function adminRestablecerPasswordClick(e) {
  if (typeof document === "undefined") return;
  if (e) e.preventDefault();
  const newPassEl = document.getElementById('u-new-password');
  const errorEl = document.getElementById('u-reset-pass-error');
  const newPass = newPassEl ? newPassEl.value : '';

  if (!editandoUserId) {
    alert('Error: No se ha seleccionado ningún usuario para editar.');
    return;
  }

  if (newPass.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.style.color = 'var(--red)';
    return;
  }

  errorEl.textContent = 'Estableciendo nueva contraseña...';
  errorEl.style.color = 'var(--text-secondary)';

  try {
    const session = window.supabaseClient ? (await window.supabaseClient.auth.getSession())?.data?.session : null;
    const token = session ? session.access_token : '';

    if (!token) {
      errorEl.textContent = 'Error: Sesión de administrador no válida. Vuelve a iniciar sesión.';
      errorEl.style.color = 'var(--red)';
      return;
    }

    const response = await fetch('/api/admin-reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetUserId: editandoUserId,
        newPassword: newPass
      })
    });

    const resData = await response.json();

    if (!response.ok || resData.error) {
      errorEl.textContent = 'Error: ' + (resData.error || 'No se pudo actualizar la contraseña.');
      errorEl.style.color = 'var(--red)';
    } else {
      errorEl.textContent = '¡Contraseña restablecida exitosamente!';
      errorEl.style.color = 'var(--green)';
      newPassEl.value = '';
      mostrarNotificacion('Contraseña del usuario actualizada con éxito.', 'success');
    }
  } catch (err) {
    console.error('Error al restablecer contraseña por el admin:', err);
    errorEl.textContent = 'Error de conexión. Intente de nuevo.';
    errorEl.style.color = 'var(--red)';
  }
}
window.adminRestablecerPasswordClick = adminRestablecerPasswordClick;

async function guardarUsuario(e) {
  if (typeof document === "undefined") return;
  e.preventDefault();
  const uNombre = document.getElementById('u-nombre');
  const uEmail = document.getElementById('u-email');
  const uTelefono = document.getElementById('u-telefono');
  const nombre = uNombre ? uNombre.value.trim() : '';
  let email = uEmail ? uEmail.value.trim() : '';
  if (email && !email.includes('@')) {
    email = email.replace(/\s+/g, '') + '@eurorep.mx';
  }
  const telefono = uTelefono ? uTelefono.value.trim() : '';
  
  // Seguridad extra para superadmin: no cambiar su rol ni desactivarlo
  const existingUser = editandoUserId ? usuarios.find(x => x.id === editandoUserId) : null;
  const rol = existingUser && existingUser.rol === 'superadmin' ? 'superadmin' : document.querySelector('input[name="u-rol"]:checked')?.value;
  const selectedEmpresas = Array.from(document.querySelectorAll('#u-empresa-checkboxes input[type="checkbox"]:checked')).map(cb => cb.value);
  const activo = existingUser && existingUser.rol === 'superadmin' ? true : document.getElementById('u-activo')?.checked;

  if (!rol) { alert('Selecciona un rol para el usuario.'); return; }
  if (!window.supabaseClient) { alert('Error: no hay conexión con Supabase.'); return; }

  // Verificar sesión activa en Supabase Auth antes de escribir
  try {
    const { data: { session }, error: sessionErr } = await window.supabaseClient.auth.getSession();
    if (sessionErr || !session) {
      alert('Error de Autenticación: Tu sesión de Supabase Auth ha expirado o no es válida. Por favor, cierra sesión en la app (con el botón "Cerrar Sesión" en la esquina inferior izquierda) y vuelve a ingresar.');
      return;
    }
  } catch(e) {
    console.error('Error al verificar sesión de Supabase Auth:', e);
  }

  let firstEmpName = null;
  if (selectedEmpresas.length > 0) {
    const match = clientesDb.find(c => c.id === selectedEmpresas[0]);
    firstEmpName = match ? match.nombre : selectedEmpresas[0];
  }

  const updateData = { nombre, email, telefono, rol, activo: activo === true };
  if (rol === 'empresa' || rol === 'cliente' || rol === 'cliente-consultor') {
    if (selectedEmpresas.length === 0) { alert('Selecciona al menos una empresa asociada.'); return; }
    updateData.empresa = firstEmpName;
  } else {
    updateData.empresa = null;
  }

  if (editandoUserId) {
    // Intentar actualizar el registro de rol existente
    const { data: updateRes, error: updateErr } = await window.supabaseClient
      .from('user_roles')
      .update(updateData)
      .eq('id', editandoUserId)
      .select();

    if (updateErr) {
      alert('Error al actualizar rol en la nube: ' + updateErr.message);
      return;
    }

    if (!updateRes || updateRes.length === 0) {
      alert('Error de Seguridad: No se actualizó ningún registro en Supabase (0 filas afectadas). Esto indica que la base de datos bloqueó la edición por políticas de seguridad RLS (por ejemplo, si no tienes el rol adecuado) o que el ID del usuario no coincide. Por favor, reporta este error.');
      return;
    }

    // Actualizar relación en la tabla relacional cliente_usuarios
    const { error: delErr } = await window.supabaseClient
      .from('cliente_usuarios')
      .delete()
      .eq('usuario_id', editandoUserId);

    if (delErr) {
      console.warn('[Supabase] Error al limpiar empresas anteriores:', delErr.message);
    } else if (selectedEmpresas.length > 0 && (rol === 'empresa' || rol === 'cliente' || rol === 'cliente-consultor')) {
      const insertRows = selectedEmpresas.map(empId => ({
        usuario_id: editandoUserId,
        cliente_id: empId
      }));
      const { error: insErr } = await window.supabaseClient
        .from('cliente_usuarios')
        .insert(insertRows);
      if (insErr) {
        console.warn('[Supabase] Error al asociar empresas nuevas:', insErr.message);
      }
    }

    // Actualizar en el array local en memoria para refrescar la UI de inmediato
    const localUIndex = usuarios.findIndex(x => x.id === editandoUserId);
    if (localUIndex !== -1) {
      usuarios[localUIndex] = { 
        ...usuarios[localUIndex], 
        ...updateData,
        empresas: selectedEmpresas 
      };
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
    }

    // SI EL USUARIO EDITADO ES EL ACTUALMENTE LOGUEADO, ACTUALIZAMOS LA SESIÓN EN LOCAL DE INMEDIATO
    if (editandoUserId === currentSession.userId) {
      currentSession.nombre = nombre || 'Usuario';
      if (currentSession.userId === currentSession.realUserId) {
        currentSession.realRol = rol;
      }
      localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
      applyRole(currentSession.viewMode);
    }

  } else {
    alert('Para crear un usuario nuevo, la persona debe registrarse primero desde la pantalla principal de Login usando "Registrar nuevo usuario". Una vez creado, aparecerá aquí para que lo apruebes.');
    return;
  }
  
  cerrarModalUsuario();
  // Llamada no bloqueante a renderUsuariosList (ya es asíncrona pero ahora sin await para no bloquear la UI)
  renderUsuariosList();
}

function editarUsuario(id) { abrirModalUsuario(id); }

async function eliminarUsuario(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar a este usuario? Ya no podrá acceder al sistema.')) return;
  if (!window.supabaseClient) return;
  
  const { error } = await window.supabaseClient.from('user_roles').delete().eq('id', id);
  if (error) {
    alert('Error al eliminar: ' + error.message);
  } else {
    await renderUsuariosList();
  }
}

// ===== SESSION MODAL =====
function abrirSesionModal() {
  if (typeof document === "undefined") return;
  const body = document.getElementById('sesion-usuarios-list');
  const isSuper = (currentSession.realRol === 'superadmin');
  
  let htmlStr = '';
  
  // Si el usuario logueado real es superadmin, mostramos el simulador de vistas de rol
  if (isSuper) {
    htmlStr += `
      <div class="simulador-vistas-mobile-container" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.5rem; letter-spacing: 0.5px;">Simular vista como:</span>
        <div style="position: relative; margin-bottom: 0.75rem;">
          <select id="role-select-modal" onchange="switchMode(this.value); cerrarSesionModal();" style="width: 100%; padding: 0.6rem 2rem 0.6rem 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.875rem; font-weight: 600; appearance: none; -webkit-appearance: none; cursor: pointer;">
            <option value="superadmin" ${currentSession.viewMode === 'superadmin' ? 'selected' : ''}>SuperAdmin</option>
            <option value="admin" ${currentSession.viewMode === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="supervisor" ${currentSession.viewMode === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="tecnico" ${currentSession.viewMode === 'tecnico' ? 'selected' : ''}>Técnico</option>
            <option value="empresa" ${currentSession.viewMode === 'empresa' ? 'selected' : ''}>Empresa</option>
            <option value="cliente-consultor" ${currentSession.viewMode === 'cliente-consultor' ? 'selected' : ''}>Cliente Consultor</option>
            <option value="consulta" ${currentSession.viewMode === 'consulta' ? 'selected' : ''}>Consulta</option>
          </select>
          <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); font-size: 0.85rem;">▼</div>
        </div>
        <div style="border-top: 1px dashed var(--border); padding-top: 0.75rem; text-align: center;">
          <a href="cliente.html" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.45rem 0.75rem; text-decoration: none; border-radius: 6px; font-weight: 600; background: var(--accent); color: white; width: 100%;">
            <i data-lucide="external-link" style="width: 13px; height: 13px;"></i> Ir al Portal de Clientes
          </a>
        </div>
      </div>
      <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.5rem; letter-spacing: 0.5px; padding-left: 0.2rem;">O cambiar de usuario:</div>
    `;
  }
  
  const ROLE_COLORS = { superadmin:'#E8820C', admin:'#4f8ef7', supervisor:'#eab308', tecnico:'#10b981', empresa:'#8b5cf6' };
  
  if (isSuper) {
    htmlStr += usuarios.filter(u => u.activo !== false).map(u => `
      <button class="sesion-user-btn ${currentSession.userId === u.id ? 'current' : ''}" onclick="cambiarUsuario('${u.id}')">
        <div class="usuario-avatar" style="background:${ROLE_COLORS[u.rol]||'var(--accent)'};">${(u.nombre||'?')[0].toUpperCase()}</div>
        <div class="sesion-user-info">
          <div class="sesion-user-name">${u.nombre || 'Sin Nombre'} ${currentSession.userId === u.id ? '✓' : ''}</div>
          <div class="sesion-user-role">${ROLES[u.rol]?.label || u.rol}</div>
        </div>
      </button>
    `).join('');
  } else {
    // Si no es superadmin, solo mostramos su propia información de forma no interactiva
    const u = usuarios.find(x => x.id === currentSession.userId);
    if (u) {
      htmlStr += `
        <div class="sesion-user-btn current" style="cursor: default; background: var(--bg-secondary); border: 1px solid var(--border);">
          <div class="usuario-avatar" style="background:${ROLE_COLORS[u.rol]||'var(--accent)'};">${(u.nombre||'?')[0].toUpperCase()}</div>
          <div class="sesion-user-info">
            <div class="sesion-user-name">${u.nombre || 'Sin Nombre'}</div>
            <div class="sesion-user-role">${ROLES[u.rol]?.label || u.rol}</div>
          </div>
        </div>
      `;
    }
  }
  
  htmlStr += `
    <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:1rem;">
      <button class="logout-btn" style="justify-content:center; background:var(--red-light); color:var(--red); border:1px solid var(--red);" onclick="cerrarSesion()">
        <i data-lucide="log-out" style="width:1rem; height:1rem;"></i>
        <span style="font-weight:600;">Cerrar Sesión por completo</span>
      </button>
    </div>
  `;
  body.innerHTML = htmlStr;
  
  // Sincronizar el select del modal con el viewMode actual
  const roleSelectModal = document.getElementById('role-select-modal');
  if (roleSelectModal) roleSelectModal.value = currentSession.viewMode;
  
  document.getElementById('modal-sesion-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function cerrarSesionModal(e) {
  if (typeof document === "undefined") return;
  if (e && e.target !== document.getElementById('modal-sesion-overlay')) return;
  document.getElementById('modal-sesion-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function cambiarUsuario(userId) {
  if (currentSession.realRol !== 'superadmin') {
    alert('Acceso denegado: Solo los superadministradores pueden cambiar de usuario.');
    return;
  }
  const user = usuarios.find(u => u.id === userId);
  if (!user) return;
  
  const realUserId = currentSession.realUserId || currentSession.userId;
  const realRol = currentSession.realRol || currentSession.viewMode;
  
  currentSession = { 
    userId, 
    viewMode: user.rol, 
    nombre: user.nombre || 'Usuario',
    realUserId,
    realRol
  };
  localStorage.setItem('eurorep_session', JSON.stringify(currentSession));
  cerrarSesionModal();
  actualizarVistaActual();
  renderUsuariosList();
}

function agregarUsuario() { abrirModalUsuario(); }

// ===== CONFIG TÉCNICOS (Eurorep) =====
if (typeof globalThis.tecnicosConfig === "undefined") {
  globalThis.tecnicosConfig = (typeof localStorage !== "undefined")
    ? JSON.parse(localStorage.getItem("eurorep_tecnicos") || "[]")
    : [];
}

function renderTecnicosConfig() {
  if (typeof document === "undefined") return;
  const list = document.getElementById("cfg-tecnicos-list");
  if (!list) return;
  const tecs = (typeof tecnicosConfig !== "undefined" && Array.isArray(tecnicosConfig)) ? tecnicosConfig : (window.tecnicosConfig || []);
  if (!tecs.length) {
    list.innerHTML = "<p style=\"color:var(--text-muted);font-size:0.82rem;\">Sin técnicos registrados aún.</p>";
    return;
  }
  list.innerHTML = tecs.map((t, i) => `
    <div class="usuario-row" style="margin-bottom:0.4rem;">
      <div class="usuario-avatar">${(t || "?")[0].toUpperCase()}</div>
      <div><div class="usuario-name">${t}</div></div>
      <button onclick="eliminarTecnicoConfig(${i})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0.25rem;border-radius:4px;" title="Eliminar">
        <i data-lucide="x" style="width:0.85rem;height:0.85rem;stroke:currentColor;stroke-width:2;"></i>
      </button>
    </div>
  `).join("");
  if (window.lucide) lucide.createIcons();
}

function agregarTecnicoConfig() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("cfg-nuevo-tecnico");
  if (!input) return;
  const nombre = input.value.trim();
  if (!nombre) return;
  if (typeof tecnicosConfig !== "undefined" && Array.isArray(tecnicosConfig)) {
    tecnicosConfig.push(nombre);
    if (typeof localStorage !== "undefined") localStorage.setItem("eurorep_tecnicos", JSON.stringify(tecnicosConfig));
  } else if (typeof window !== "undefined" && Array.isArray(window.tecnicosConfig)) {
    window.tecnicosConfig.push(nombre);
    if (typeof localStorage !== "undefined") localStorage.setItem("eurorep_tecnicos", JSON.stringify(window.tecnicosConfig));
  }
  input.value = "";
  renderTecnicosConfig();
}

function eliminarTecnicoConfig(i) {
  if (typeof tecnicosConfig !== "undefined" && Array.isArray(tecnicosConfig)) {
    tecnicosConfig.splice(i, 1);
    if (typeof localStorage !== "undefined") localStorage.setItem("eurorep_tecnicos", JSON.stringify(tecnicosConfig));
  } else if (typeof window !== "undefined" && Array.isArray(window.tecnicosConfig)) {
    window.tecnicosConfig.splice(i, 1);
    if (typeof localStorage !== "undefined") localStorage.setItem("eurorep_tecnicos", JSON.stringify(window.tecnicosConfig));
  }
  renderTecnicosConfig();
}



// Exponer en window para retrocompatibilidad total con el navegador y eventos HTML inline
if (typeof window !== "undefined") {
  window.renderUsuariosList = renderUsuariosList;
  window.abrirModalUsuario = abrirModalUsuario;
  window.toggleEmpresaField = toggleEmpresaField;
  window.cerrarModalUsuario = cerrarModalUsuario;
  window.onCambioFusionDestinoModal = onCambioFusionDestinoModal;
  window.ejecutarFusionDesdeEditarUsuario = ejecutarFusionDesdeEditarUsuario;
  window.adminRestablecerPasswordClick = adminRestablecerPasswordClick;
  window.guardarUsuario = guardarUsuario;
  window.editarUsuario = editarUsuario;
  window.eliminarUsuario = eliminarUsuario;
  window.abrirSesionModal = abrirSesionModal;
  window.cerrarSesionModal = cerrarSesionModal;
  window.cambiarUsuario = cambiarUsuario;
  window.agregarUsuario = agregarUsuario;
  window.editandoUserId = editandoUserId;
  window.renderTecnicosConfig = renderTecnicosConfig;
  window.agregarTecnicoConfig = agregarTecnicoConfig;
  window.eliminarTecnicoConfig = eliminarTecnicoConfig;
}

export {
  renderUsuariosList,
  abrirModalUsuario,
  toggleEmpresaField,
  cerrarModalUsuario,
  onCambioFusionDestinoModal,
  ejecutarFusionDesdeEditarUsuario,
  adminRestablecerPasswordClick,
  guardarUsuario,
  editarUsuario,
  eliminarUsuario,
  abrirSesionModal,
  cerrarSesionModal,
  cambiarUsuario,
  agregarUsuario,
  renderTecnicosConfig,
  agregarTecnicoConfig,
  eliminarTecnicoConfig
};
