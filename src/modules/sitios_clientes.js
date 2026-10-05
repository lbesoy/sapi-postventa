/**
 * Eurorep SAPI - Módulo de Gestión de Sitios de Obra, Subvistas de Clientes y Portal de Usuarios
 * Archivo: src/modules/sitios_clientes.js
 */

function safeMostrarNotificacion(msg, tipo) {
  if (typeof mostrarNotificacion === 'function') mostrarNotificacion(msg, tipo);
  else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') window.mostrarNotificacion(msg, tipo);
}

function getSitioNombre(s) { return typeof s === 'string' ? s : (s?.nombre || ''); }
function getNombresDeSitiosParaCliente(clienteObj) {
  if (!clienteObj) return [];
  let cObj = typeof clienteObj === 'object' ? clienteObj : null;
  let rawVal = typeof clienteObj === 'string' ? clienteObj.trim() : '';

  if (!cObj && rawVal) {
    cObj = (clientesDb || []).find(c => c.nombre === rawVal || c.id === rawVal || c.idInterno === rawVal || c.rfc === rawVal);
  }

  const candidateKeys = new Set();
  if (rawVal) candidateKeys.add(rawVal.toLowerCase());
  if (cObj) {
    if (cObj.id) candidateKeys.add(String(cObj.id).toLowerCase());
    if (cObj.idInterno) candidateKeys.add(String(cObj.idInterno).toLowerCase());
    if (cObj.rfc) candidateKeys.add(String(cObj.rfc).toLowerCase());
    if (cObj.nombre) candidateKeys.add(String(cObj.nombre).toLowerCase());
  }

  // 1. Buscar en sitiosDb
  const sitiosFromDb = (sitiosDb || []).filter(s => {
    if (!s) return false;
    const sCli = String(s.cliente || '').toLowerCase();
    const sCliCustom = String(s.customData?.clienteNombre || '').toLowerCase();
    return candidateKeys.has(sCli) || (sCliCustom && candidateKeys.has(sCliCustom));
  }).map(s => s.nombre).filter(Boolean);

  // 2. Buscar en clienteObj.sitios
  let localSitios = [];
  if (cObj) {
    if (Array.isArray(cObj.sitios)) {
      localSitios = cObj.sitios.map(getSitioNombre).filter(Boolean);
    }
    if (cObj.ubicacion && !localSitios.includes(cObj.ubicacion)) {
      localSitios = [cObj.ubicacion, ...localSitios];
    }
  }

  // 3. Buscar en maquinariaDb
  const sitiosFromMaq = (maquinariaDb || []).filter(m => {
    if (!m) return false;
    const mCli = String(m.cliente || '').toLowerCase();
    return candidateKeys.has(mCli);
  }).map(m => m.ubicacion || m.sitio).filter(Boolean);

  const merged = [...new Set([...sitiosFromDb, ...localSitios, ...sitiosFromMaq])];
  return merged.filter(s => s && s.trim() !== '');
}

function generarIdInternoMaquina(marca, anioVenta) {
  const m = marca ? marca.trim().toUpperCase() : 'XX';
  let iniciales = m.replace(/[^A-Z]/g, '');
  if (iniciales.length < 2) {
    iniciales = (iniciales + 'XX').substring(0, 2);
  } else {
    iniciales = iniciales.substring(0, 2);
  }
  
  let yy = '';
  if (anioVenta) {
    if (anioVenta.includes('-')) {
      yy = anioVenta.split('-')[0].substring(2, 4);
    } else {
      yy = anioVenta.toString().substring(2, 4);
    }
  }
  if (!yy || yy.length !== 2) {
    yy = new Date().getFullYear().toString().substring(2, 4);
  }
  
  const prefix = iniciales + yy;
  
  let max = 0;
  
  // Revisar en clientesDb (manuales)
  clientesDb.forEach(c => {
    if (c.maquinas) {
      c.maquinas.forEach(maq => {
        if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
          const num = parseInt(maq.idInterno.substring(prefix.length), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    }
  });

  // Revisar también en maquinariaDb (SAP)
  maquinariaDb.forEach(maq => {
    if (maq.idInterno && maq.idInterno.startsWith(prefix)) {
      const num = parseInt(maq.idInterno.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  
  return prefix + (max + 1).toString().padStart(3, '0');
}

function agregarSitioClienteDesdeEmpresa() {
  if (typeof document === "undefined") return;
  const isEmpresa = currentSession.viewMode === 'empresa';
  if (isEmpresa) {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    agregarSitioCliente(currentUser ? (currentUser.empresa || currentUser.nombre) : '');
  } else {
    agregarSitioCliente('');
  }
}

function agregarSitioCliente(nombre) {
  if (typeof document === "undefined") return;
  document.getElementById('form-agregar-sitio').reset();
  const clientGroup = document.getElementById('s-cliente-group');
  const clientSelect = document.getElementById('s-cliente-select');
  const clientHidden = document.getElementById('s-cliente-nombre');
  const modalTitle = document.getElementById('modal-sitio-title');

  if (clientSelect) {
    clientSelect.innerHTML = '<option value="">-- Selecciona un cliente / empresa --</option>';
    const allClients = new Map();
    (clientesDb || []).forEach(c => {
      if (c && c.nombre && c.nombre.trim()) {
        allClients.set(c.nombre.trim(), c.id || c.nombre.trim());
      }
    });
    (maquinariaDb || []).forEach(m => {
      if (m && m.cliente && m.cliente.trim() && !allClients.has(m.cliente.trim())) {
        allClients.set(m.cliente.trim(), m.cliente.trim());
      }
    });

    const sortedNames = Array.from(allClients.keys()).sort((a, b) => a.localeCompare(b));
    sortedNames.forEach(cName => {
      const opt = document.createElement('option');
      opt.value = cName;
      opt.textContent = cName;
      clientSelect.appendChild(opt);
    });
  }

  const isEmpresa = currentSession.viewMode === 'empresa';

  if (nombre && String(nombre).trim()) {
    const cleanNombre = String(nombre).trim();
    if (clientHidden) clientHidden.value = cleanNombre;
    if (clientSelect) clientSelect.value = cleanNombre;
    if (clientGroup) clientGroup.style.display = 'none';
    if (modalTitle) modalTitle.textContent = 'Nuevo Sitio: ' + cleanNombre;
  } else {
    if (isEmpresa) {
      const currentUser = usuarios.find(u => u.id === currentSession.userId);
      const empName = currentUser ? (currentUser.empresa || currentUser.nombre) : '';
      if (clientHidden) clientHidden.value = empName;
      if (clientSelect) clientSelect.value = empName;
      if (clientGroup) clientGroup.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Nuevo Sitio: ' + (empName || 'Mi Empresa');
    } else {
      if (clientHidden) clientHidden.value = '';
      if (clientSelect) clientSelect.value = '';
      if (clientGroup) clientGroup.style.display = 'block';
      if (modalTitle) modalTitle.textContent = 'Nuevo Sitio / Obra';
    }
  }

  document.getElementById('modal-agregar-sitio-overlay').classList.add('open');
  setTimeout(() => {
    if (clientGroup && clientGroup.style.display !== 'none' && clientSelect) {
      clientSelect.focus();
    } else {
      document.getElementById('s-sitio-nombre')?.focus();
    }
  }, 50);
}

function cerrarModalSitio(e) {
  if (typeof document === "undefined") return;
  if (e && e.target !== document.getElementById('modal-agregar-sitio-overlay')) return;
  document.getElementById('modal-agregar-sitio-overlay').classList.remove('open');
}

async function guardarSitioCliente(e) {
  if (typeof document === "undefined") return;
  if (typeof document === "undefined") return;
  e.preventDefault();
  let nombre = (document.getElementById('s-cliente-nombre')?.value || '').trim();
  const selectVal = (document.getElementById('s-cliente-select')?.value || '').trim();
  const clientGroup = document.getElementById('s-cliente-group');

  if (clientGroup && clientGroup.style.display !== 'none' && selectVal) {
    nombre = selectVal;
  } else if (!nombre && selectVal) {
    nombre = selectVal;
  }

  if (!nombre) {
    mostrarNotificacion('Por favor selecciona o especifica una Empresa / Cliente.', 'warning');
    return;
  }

  const nuevoSitio = document.getElementById('s-sitio-nombre').value.trim();
  const cp = document.getElementById('s-sitio-cp')?.value.trim() || '';
  const ciudad = document.getElementById('s-sitio-ciudad')?.value.trim() || '';
  const estado = document.getElementById('s-sitio-estado')?.value.trim() || '';
  const direccion = document.getElementById('s-sitio-direccion')?.value.trim() || '';
  
  if (!nuevoSitio || nuevoSitio === '') {
    mostrarNotificacion('El nombre del sitio es obligatorio.', 'warning');
    return;
  }

  let clienteObj = clientesDb.find(c => c.nombre === nombre || c.id === nombre || c.idInterno === nombre || c.rfc === nombre);
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombre,
      maquinas: [],
      sitios: []
    };
    clientesDb.push(clienteObj);
  }

  if (!clienteObj.sitios) clienteObj.sitios = [];

  const clientDbId = clienteObj.id || nombre;
  const clientDbName = clienteObj.nombre || nombre;

  // 1. Guardar/Actualizar en sitiosDb
  let existSitioDb = (sitiosDb || []).find(s => {
    if (!s) return false;
    const sameCli = s.cliente === clienteObj.id || s.cliente === clienteObj.idInterno || s.cliente === clienteObj.rfc || s.cliente === clienteObj.nombre || s.cliente === nombre || s.customData?.clienteNombre === clientDbName;
    return sameCli && (s.nombre || '').toLowerCase() === nuevoSitio.toLowerCase();
  });

  if (!existSitioDb) {
    existSitioDb = {
      id: crypto.randomUUID(),
      nombre: nuevoSitio,
      cliente: clientDbId,
      direccion: direccion,
      cp: cp,
      ciudad: ciudad,
      estado: estado,
      customData: {
        ubicacion: nuevoSitio,
        clienteNombre: clientDbName,
        'Código Postal': cp,
        'Ciudad': ciudad,
        'Estado': estado,
        'Dirección': direccion
      },
      createdAt: new Date().toISOString()
    };
    sitiosDb.push(existSitioDb);
  } else {
    existSitioDb.direccion = direccion || existSitioDb.direccion;
    existSitioDb.cp = cp || existSitioDb.cp;
    existSitioDb.ciudad = ciudad || existSitioDb.ciudad;
    existSitioDb.estado = estado || existSitioDb.estado;
    if (!existSitioDb.customData) existSitioDb.customData = {};
    existSitioDb.customData.ubicacion = nuevoSitio;
    existSitioDb.customData.clienteNombre = clientDbName;
    if (cp) existSitioDb.customData['Código Postal'] = cp;
    if (ciudad) existSitioDb.customData['Ciudad'] = ciudad;
    if (estado) existSitioDb.customData['Estado'] = estado;
    if (direccion) existSitioDb.customData['Dirección'] = direccion;
  }

  localStorage.setItem('sapi_sitios_db', JSON.stringify(sitiosDb));
  if (window.pushToSupabase) {
    await window.pushToSupabase('sitios', existSitioDb);
  }

  // 2. Guardar en clienteObj.sitios para compatibilidad
  const siteInLegacyIdx = clienteObj.sitios.findIndex(s => getSitioNombre(s).toLowerCase() === nuevoSitio.toLowerCase());
  const siteObjLegacy = {
    nombre: nuevoSitio,
    direccion, cp, ciudad, estado
  };
  if (siteInLegacyIdx === -1) {
    clienteObj.sitios.push(siteObjLegacy);
  } else {
    clienteObj.sitios[siteInLegacyIdx] = Object.assign({}, clienteObj.sitios[siteInLegacyIdx], siteObjLegacy);
  }
  localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  if (window.pushToSupabase) {
    await window.pushToSupabase('clientes', clienteObj);
  }

  cerrarModalSitio();
  mostrarNotificacion(`Sitio "${nuevoSitio}" guardado correctamente.`, 'success');
  
  if (window._addingSiteFromTicket) {
    const clientLabel = document.getElementById('t-cliente-display')?.textContent || clientDbName;
    selectComboOption('t-cliente', clientDbName, clientLabel, true);
    selectComboOption('t-sitio', nuevoSitio, nuevoSitio);
    window._addingSiteFromTicket = false;
  } else if (currentSession.viewMode === 'empresa') {
    renderSitios();
  } else {
    if (document.getElementById('view-sitios')?.classList.contains('active')) {
      renderSitios();
    }
    if (document.getElementById('detalle-cliente-modal')?.classList.contains('open') || document.getElementById('modal-detalle-cliente')?.classList.contains('open')) {
      verDetalleCliente(clientDbName);
    }
  }
}

function setClientesSubView(subView) {
  if (typeof document === "undefined") return;
  const btnCatalogo = document.getElementById('btn-tab-cli-catalogo');
  const btnPortal = document.getElementById('btn-tab-cli-portal');
  const cntCatalogo = document.getElementById('clientes-catalogo-container');
  const cntPortal = document.getElementById('clientes-portal-container');
  
  if (!btnCatalogo || !btnPortal || !cntCatalogo || !cntPortal) return;
  
  if (subView === 'catalogo') {
    btnCatalogo.classList.add('active');
    btnCatalogo.style.background = 'var(--accent)';
    btnCatalogo.style.color = '#fff';
    btnCatalogo.style.borderColor = 'var(--accent)';
    
    btnPortal.classList.remove('active');
    btnPortal.style.background = 'var(--bg-card)';
    btnPortal.style.color = 'var(--text-primary)';
    btnPortal.style.borderColor = 'var(--border)';
    
    cntCatalogo.style.display = 'block';
    cntPortal.style.display = 'none';
  } else {
    btnPortal.classList.add('active');
    btnPortal.style.background = 'var(--accent)';
    btnPortal.style.color = '#fff';
    btnPortal.style.borderColor = 'var(--accent)';
    
    btnCatalogo.classList.remove('active');
    btnCatalogo.style.background = 'var(--bg-card)';
    btnCatalogo.style.color = 'var(--text-primary)';
    btnCatalogo.style.borderColor = 'var(--border)';
    
    cntCatalogo.style.display = 'none';
    cntPortal.style.display = 'block';
    
    renderPortalUsuariosList();
  }
  
  if (currentSession && typeof updateTopbarButtons === 'function') {
    updateTopbarButtons('clientes', currentSession.viewMode);
  }
};

function renderPortalUsuariosList() {
  if (typeof document === "undefined") return;
  const tbody = document.getElementById('clientes-portal-table-body');
  if (!tbody) return;
  
  // Populate company select dropdown dynamically
  const selectEmpresa = document.getElementById('filtro-empresa-usuario-portal');
  if (selectEmpresa) {
    const currentSelected = selectEmpresa.value;
    selectEmpresa.innerHTML = '<option value="todas">Todas las Empresas</option>';
    const sortedClientes = [...clientesDb].sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));
    sortedClientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      selectEmpresa.appendChild(opt);
    });
    if (Array.from(selectEmpresa.options).some(o => o.value === currentSelected)) {
      selectEmpresa.value = currentSelected;
    }
  }

  const searchText = (document.getElementById('busqueda-usuario-portal')?.value || '').toLowerCase().trim();
  const filterEstado = document.getElementById('filtro-estado-usuario-portal')?.value || 'todos';
  const filterRol = document.getElementById('filtro-rol-usuario-portal')?.value || 'todos';
  const filterEmpresa = selectEmpresa?.value || 'todas';
  
  // Filter portal users (client-related roles only) and sort alphabetically
  let portalUsers = usuarios.filter(u => ['empresa', 'cliente', 'cliente-consultor'].includes(u.rol));
  portalUsers.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
  
  // Apply Search
  if (searchText) {
    portalUsers = portalUsers.filter(u => 
      (u.nombre && u.nombre.toLowerCase().includes(searchText)) || 
      (u.email && u.email.toLowerCase().includes(searchText)) ||
      (u.empresa && u.empresa.toLowerCase().includes(searchText))
    );
  }
  
  // Apply Estado Filter
  if (filterEstado === 'activos') {
    portalUsers = portalUsers.filter(u => u.activo !== false);
  } else if (filterEstado === 'pendientes') {
    portalUsers = portalUsers.filter(u => u.activo === false);
  }
  
  // Apply Rol Filter
  if (filterRol !== 'todos') {
    portalUsers = portalUsers.filter(u => u.rol === filterRol);
  }
  
  // Apply Empresa Filter
  if (filterEmpresa !== 'todas') {
    portalUsers = portalUsers.filter(u => {
      if (u.empresas && u.empresas.length > 0) {
        return u.empresas.includes(filterEmpresa);
      }
      return u.empresa && (u.empresa === filterEmpresa || u.empresa.toLowerCase() === filterEmpresa.toLowerCase());
    });
  }
  
  if (portalUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
          No se encontraron usuarios del portal de clientes.
        </td>
      </tr>
    `;
    return;
  }
  
  const ROLE_LABELS = {
    'empresa': 'Cliente',
    'cliente': 'Cliente',
    'cliente-consultor': 'Cliente Consultor'
  };
  
  const ROLE_COLORS = {
    'empresa': '#8b5cf6',
    'cliente': '#8b5cf6',
    'cliente-consultor': '#ec4899'
  };
  
  tbody.innerHTML = portalUsers.map(u => {
    // Resolve Associated Companies Display as modern chips/tags
    let empHtml = '';
    let empNamesDisplay = '';
    
    if (u.empresas && u.empresas.length > 0) {
      empNamesDisplay = u.empresas.map(empId => {
        const match = clientesDb.find(c => c.id === empId);
        return match ? match.nombre : empId;
      }).join(', ');
      
      empHtml = u.empresas.map(empId => {
        const match = clientesDb.find(c => c.id === empId);
        const name = match ? match.nombre : empId;
        return `<span style="display: inline-flex; align-items: center; background: var(--bg-hover, #f1f5f9); border: 1px solid var(--border, #e2e8f0); border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.72rem; color: var(--text-primary); font-weight: 600; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.1rem;" title="${name}">${name}</span>`;
      }).join('');
    } else {
      const fallbackName = u.empresa || 'Ninguna';
      empNamesDisplay = fallbackName;
      empHtml = `<span style="display: inline-flex; align-items: center; background: rgba(232, 130, 12, 0.08); border: 1px solid rgba(232, 130, 12, 0.15); border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.72rem; color: var(--orange, #e8820c); font-weight: 600; margin: 0.1rem;" title="${fallbackName}">${fallbackName}</span>`;
    }
    
    const isPending = (u.activo === false);
    const badgeColor = isPending ? 'background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);' : 'background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
    const badgeText = isPending ? 'Pendiente' : 'Activo';
    
    // Actions HTML
    const approveBtn = isPending ? `
      <button class="action-btn" onclick="aprobarUsuarioPortal('${u.id}')" title="Aprobar Acceso" style="color: #10b981; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: var(--radius-sm); padding: 0.3rem 0.5rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
        <i data-lucide="check" style="width:14px;height:14px;"></i>
      </button>
    ` : '';
    
    return `
      <tr style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s;" onmouseover="this.style.backgroundColor='var(--bg-hover, #f8fafc)'" onmouseout="this.style.backgroundColor='transparent'">
        <td style="padding: 0.85rem 1rem; vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${ROLE_COLORS[u.rol] || 'var(--accent)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              ${(u.nombre || '?')[0].toUpperCase()}
            </div>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">${u.nombre || 'Sin Nombre'}</div>
          </div>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; color: var(--text-secondary); font-family: monospace; font-size: 0.82rem;">
          ${u.email || ''}
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle;">
          <span class="badge" style="background: ${ROLE_COLORS[u.rol]}12; color: ${ROLE_COLORS[u.rol]}; border-radius: 20px; padding: 0.25rem 0.65rem; font-size: 0.72rem; font-weight: 700; border: 1px solid ${ROLE_COLORS[u.rol]}22; letter-spacing: 0.3px;">
            ${ROLE_LABELS[u.rol] || u.rol}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; line-height: 1.45;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center;" title="${empNamesDisplay}">
            ${empHtml}
          </div>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; text-align: center;">
          <span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.65rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; ${badgeColor} letter-spacing: 0.3px;">
            ${badgeText}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; vertical-align: middle; text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
            ${approveBtn}
            <button class="action-btn" onclick="window._modalUsuarioContexto = 'portal'; editarUsuario('${u.id}')" title="Editar" style="background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
              <i data-lucide="pencil" style="width:14px;height:14px; color: var(--text-secondary);"></i>
            </button>
            <button class="action-btn del" onclick="eliminarUsuario('${u.id}')" title="Borrar" style="background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
              <i data-lucide="trash-2" style="width:14px;height:14px; color: var(--red);"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
};

async function aprobarUsuarioPortal(id) {
  if (typeof document === "undefined") return;
  if (typeof document === "undefined") return;
  if (!confirm('¿Estás seguro de que deseas aprobar el acceso a este usuario del portal?')) return;
  if (!window.supabaseClient) {
    alert('No hay conexión con Supabase');
    return;
  }
  
  try {
    const { error } = await window.supabaseClient
      .from('user_roles')
      .update({ activo: true })
      .eq('id', id);
      
    if (error) throw error;
    
    // Update local cache
    const match = usuarios.find(u => u.id === id);
    if (match) {
      match.activo = true;
      localStorage.setItem('eurorep_usuarios', JSON.stringify(usuarios));
      
      // Trigger Automation
      if (typeof window.ejecutarAutomatizacion === 'function') {
        window.ejecutarAutomatizacion('Activación de usuario en panel', {
          email: match.email,
          nombre_usuario: match.nombre,
          nombre_cliente: match.empresa || 'Cliente',
          link: window.location.origin + '/cliente'
        });
      }
    }
    
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Usuario aprobado con éxito', 'success');
    } else {
      alert('Usuario aprobado con éxito');
    }
    
    renderPortalUsuariosList();
    
    // Also refresh the general user list if the function exists
    if (typeof renderUsuariosList === 'function') {
      renderUsuariosList();
    }
  } catch (err) {
    console.error('Error approving user:', err);
    alert('Error al aprobar usuario: ' + err.message);
  }
};

// Interoperabilidad con window
if (typeof window !== 'undefined') {
  window.getSitioNombre = getSitioNombre;
  window.getNombresDeSitiosParaCliente = getNombresDeSitiosParaCliente;
  window.generarIdInternoMaquina = generarIdInternoMaquina;
  window.agregarSitioClienteDesdeEmpresa = agregarSitioClienteDesdeEmpresa;
  window.agregarSitioCliente = agregarSitioCliente;
  window.cerrarModalSitio = cerrarModalSitio;
  window.guardarSitioCliente = guardarSitioCliente;
  window.setClientesSubView = setClientesSubView;
  window.renderPortalUsuariosList = renderPortalUsuariosList;
  window.aprobarUsuarioPortal = aprobarUsuarioPortal;
}

export {
  getSitioNombre,
  getNombresDeSitiosParaCliente,
  generarIdInternoMaquina,
  agregarSitioClienteDesdeEmpresa,
  agregarSitioCliente,
  cerrarModalSitio,
  guardarSitioCliente,
  setClientesSubView,
  renderPortalUsuariosList,
  aprobarUsuarioPortal
};
