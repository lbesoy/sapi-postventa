/**
 * Eurorep SAPI - Módulo de Gestión de Ideas, Fallas y Mejoras (Priorización & Feedback)
 * Archivo: src/modules/ideas_fallas.js
 */

import { escapeHTML } from '../utils.js';

function safeEscapeHTML(str) {
  if (typeof escapeHTML === 'function') return escapeHTML(str);
  if (typeof window !== 'undefined' && typeof window.escapeHTML === 'function') return window.escapeHTML(str);
  return String(str || '');
}

function safeMostrarNotificacion(msg, tipo) {
  if (typeof mostrarNotificacion === 'function') mostrarNotificacion(msg, tipo);
  else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') window.mostrarNotificacion(msg, tipo);
}

// ─── IDEAS Y FALLAS MODULE ──────────────────────────────────────────────────
let editandoIdeaFallaId = null;
let ifArchivosAdjuntosTemp = [];

function renderIfArchivosPreview() {
  if (typeof document === "undefined") return;
  const container = document.getElementById('if-archivos-preview');
  if (!container) return;
  if (ifArchivosAdjuntosTemp.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = ifArchivosAdjuntosTemp.map((arch, idx) => {
    const isImg = arch.tipo && arch.tipo.startsWith('image/');
    return `
      <div style="display:flex; align-items:center; gap:0.4rem; background:var(--bg-card); border:1px solid var(--border); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.75rem; max-width:220px; box-shadow:var(--shadow-sm);">
        ${isImg 
          ? `<img src="${arch.url}" style="width:26px; height:26px; object-fit:cover; border-radius:4px;" />` 
          : `<i data-lucide="file-text" style="width:20px; height:20px; color:var(--accent);"></i>`
        }
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;" title="${arch.nombre}">${arch.nombre}</span>
        <button type="button" onclick="window.eliminarIfArchivoTemp(${idx})" style="background:none; border:none; color:var(--red); cursor:pointer; font-weight:bold; font-size:0.9rem; padding:0 2px;">✕</button>
      </div>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}
window.renderIfArchivosPreview = renderIfArchivosPreview;

function eliminarIfArchivoTemp(idx) {
  if (typeof document === "undefined") return;
  if (idx > -1 && idx < ifArchivosAdjuntosTemp.length) {
    ifArchivosAdjuntosTemp.splice(idx, 1);
    renderIfArchivosPreview();
  }
};

function handleIfFilesSelect(e) {
  if (typeof document === "undefined") return;
  const files = Array.from(e.target.files || []);
  procesarFilesIf(files);
  e.target.value = '';
};

function handleIfFilesDrop(e) {
  if (typeof document === "undefined") return;
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files || []);
  procesarFilesIf(files);
};

function procesarFilesIf(files) {
  if (typeof document === "undefined") return;
  files.forEach(file => {
    if (file.size > 8 * 1024 * 1024) {
      alert(`El archivo "${file.name}" supera el límite recomendado de 8MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      ifArchivosAdjuntosTemp.push({
        nombre: file.name,
        tipo: file.type,
        url: evt.target.result,
        fecha: new Date().toISOString()
      });
      renderIfArchivosPreview();
    };
    reader.readAsDataURL(file);
  });
}
    window.toggleIfResolucionInput = function() {
  const estadoVal = document.getElementById('if-estado')?.value;
  const resContainer = document.getElementById('if-resolucion-container');
  if (resContainer) {
    resContainer.style.display = (estadoVal === 'Resuelto') ? 'block' : 'none';
  }
};

function abrirModalResolucionIdeaFalla(id) {
  if (typeof document === "undefined") return;
  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  const inputId = document.getElementById('if-res-id');
  const inputExp = document.getElementById('if-res-explicacion');
  if (inputId) inputId.value = id;
  if (inputExp) inputExp.value = item.resolucion || '';

  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();
};

function cerrarModalResolucionIdeaFalla(e) {
  if (typeof document === "undefined") return;
  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (e && e.target !== modalOverlay) return;
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  renderIdeasFallas();
};

async function guardarResolucionIdeaFalla(e) {
  if (typeof document === "undefined") return;
  if (e) e.preventDefault();

  const id = document.getElementById('if-res-id')?.value;
  const explicacion = document.getElementById('if-res-explicacion')?.value || '';

  if (!id) return;
  if (!explicacion.trim()) {
    alert('Por favor escribe la explicación o conclusión de la solución.');
    return;
  }

  const idx = ideasFallasDb.findIndex(x => x.id === id);
  if (idx === -1) return;

  const user = usuarios.find(u => u.id === currentSession?.userId);
  const userNombre = user ? user.nombre : (currentSession?.nombre || 'Superadmin');

  ideasFallasDb[idx] = {
    ...ideasFallasDb[idx],
    estado: 'Resuelto',
    resolucion: explicacion.trim(),
    resuelto_por: userNombre,
    fecha_resolucion: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const item = ideasFallasDb[idx];
  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  
  const modalOverlay = document.getElementById('modal-resolucion-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';

  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro marcado como Resuelto con conclusión.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al guardar resolución en Supabase:', err);
    }
  }
};

function puedeEditarIdeaFalla(item) {
  if (!item) return false;
  if (!currentSession) return false;
  
  // Superadmin en la vista activa tiene permisos completos de edición
  if (currentSession.viewMode === 'superadmin') return true;
  
  const currentUserId = currentSession.userId;
  const user = usuarios.find(u => u.id === currentUserId);
  const currentUserName = (user ? user.nombre : (currentSession.nombre || '')).trim().toLowerCase();
  
  // 1. Comparar por ID de usuario creador
  if (item.creado_por_id && currentUserId && String(item.creado_por_id) === String(currentUserId)) {
    return true;
  }
  
  // 2. Comparar por nombre de usuario creador (para compatibilidad)
  const itemAuthorName = (item.creado_por || '').trim().toLowerCase();
  if (currentUserName && itemAuthorName && currentUserName === itemAuthorName) {
    return true;
  }
  
  return false;
}

function abrirModalIdeaFalla(id = null) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  
  if (id) {
    const item = ideasFallasDb.find(x => x.id === id);
    if (!item) return;
    if (!puedeEditarIdeaFalla(item)) {
      alert('Acceso denegado: Solo puedes editar los registros de ideas o fallas creados por ti.');
      return;
    }
  }

  editandoIdeaFallaId = id || null;
  const modalTitle = document.getElementById('idea-falla-modal-title');
  const formEl = document.getElementById('form-idea-falla');
  const estadoContainer = document.getElementById('if-estado-container');

  if (formEl) formEl.reset();

  if (id) {
    if (modalTitle) modalTitle.textContent = 'Editar Registro';
    if (estadoContainer) estadoContainer.style.display = isSuperadmin ? 'block' : 'none';

    const item = ideasFallasDb.find(x => x.id === id);
    if (item) {
      const radio = document.querySelector(`input[name="if-tipo"][value="${item.tipo}"]`);
      if (radio) radio.checked = true;
      
      const tituloInput = document.getElementById('if-titulo');
      if (tituloInput) tituloInput.value = item.titulo || '';

      const descTextarea = document.getElementById('if-descripcion');
      if (descTextarea) descTextarea.value = item.descripcion || '';

      const moduloSelect = document.getElementById('if-modulo');
      if (moduloSelect) moduloSelect.value = item.modulo || 'General';

      const prioridadSelect = document.getElementById('if-prioridad');
      if (prioridadSelect) prioridadSelect.value = item.prioridad || 'Media';

      const estadoSelect = document.getElementById('if-estado');
      if (estadoSelect) estadoSelect.value = item.estado || 'Pendiente';

      const resolucionTextarea = document.getElementById('if-resolucion');
      if (resolucionTextarea) resolucionTextarea.value = item.resolucion || '';

      ifArchivosAdjuntosTemp = item.archivos ? JSON.parse(JSON.stringify(item.archivos)) : [];
      window.toggleIfResolucionInput();
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Reportar Idea / Falla';
    if (estadoContainer) estadoContainer.style.display = 'none';
    const moduloSelect = document.getElementById('if-modulo');
    if (moduloSelect) moduloSelect.value = 'General';
    ifArchivosAdjuntosTemp = [];
    window.toggleIfResolucionInput();
  }

  renderIfArchivosPreview();

  const modalOverlay = document.getElementById('modal-idea-falla-overlay');
  if (modalOverlay) modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function cerrarModalIdeaFalla(e) {
  if (typeof document === "undefined") return;
  const modalOverlay = document.getElementById('modal-idea-falla-overlay');
  if (e && e.target !== modalOverlay) return;
  if (modalOverlay) modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  editandoIdeaFallaId = null;
  ifArchivosAdjuntosTemp = [];
}

async function guardarIdeaFalla(e) {
  if (typeof document === "undefined") return;
  if (e) e.preventDefault();

  const tipo = document.querySelector('input[name="if-tipo"]:checked')?.value || 'Idea';
  const titulo = document.getElementById('if-titulo')?.value || '';
  const descripcion = document.getElementById('if-descripcion')?.value || '';
  const modulo = document.getElementById('if-modulo')?.value || 'General';
  const prioridad = document.getElementById('if-prioridad')?.value || 'Media';
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');

  if (!titulo.trim()) {
    alert('Por favor introduce un título válido.');
    return;
  }

  const user = usuarios.find(u => u.id === currentSession.userId);
  const userNombre = user ? user.nombre : (currentSession.nombre || 'Usuario');

  let item;
  if (editandoIdeaFallaId) {
    const idx = ideasFallasDb.findIndex(x => x.id === editandoIdeaFallaId);
    if (idx > -1) {
      const existingItem = ideasFallasDb[idx];
      if (!puedeEditarIdeaFalla(existingItem)) {
        alert('Acceso denegado: Solo puedes editar los registros creados por ti.');
        return;
      }

      const nuevoEstado = isSuperadmin && document.getElementById('if-estado')
        ? (document.getElementById('if-estado').value || existingItem.estado || 'Pendiente')
        : (existingItem.estado || 'Pendiente');

      const resolucionText = document.getElementById('if-resolucion')?.value || '';
      let resueltoPor = existingItem.resuelto_por;
      let fechaResolucion = existingItem.fecha_resolucion;

      if (nuevoEstado === 'Resuelto' && (!existingItem.estado || existingItem.estado !== 'Resuelto' || !fechaResolucion)) {
        resueltoPor = userNombre;
        fechaResolucion = new Date().toISOString();
      }

      ideasFallasDb[idx] = {
        ...existingItem,
        tipo,
        modulo,
        titulo,
        descripcion,
        archivos: [...ifArchivosAdjuntosTemp],
        prioridad,
        estado: nuevoEstado,
        resolucion: resolucionText.trim(),
        resuelto_por: resueltoPor,
        fecha_resolucion: fechaResolucion,
        updated_at: new Date().toISOString()
      };
      item = ideasFallasDb[idx];
    }
  } else {
    item = {
      id: 'IF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      tipo,
      modulo,
      titulo,
      descripcion,
      archivos: [...ifArchivosAdjuntosTemp],
      prioridad,
      estado: 'Pendiente',
      creado_por: userNombre,
      creado_por_id: currentSession.userId || currentSession.realUserId,
      orden: ideasFallasDb.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    ideasFallasDb.push(item);
  }

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();
  cerrarModalIdeaFalla();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro guardado y sincronizado con éxito.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al sincronizar con Supabase:', err);
    }
  }
}

async function cambiarEstadoIdeaFalla(id, nuevoEstado) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) {
    alert('Acceso denegado: Solo los superadministradores pueden cambiar el estado de una idea o falla.');
    renderIdeasFallas();
    return;
  }

  if (nuevoEstado === 'Resuelto') {
    window.abrirModalResolucionIdeaFalla(id);
    return;
  }

  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  item.estado = nuevoEstado;
  item.updated_at = new Date().toISOString();

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Estado actualizado y sincronizado.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al cambiar estado en Supabase:', err);
    }
  }
}

async function eliminarIdeaFalla(id) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) {
    alert('Acceso denegado: Solo los superadministradores pueden eliminar registros de ideas y fallas.');
    return;
  }

  if (!confirm('¿Estás seguro de que deseas eliminar este registro de Ideas/Fallas?')) {
    return;
  }

  const idx = ideasFallasDb.findIndex(x => x.id === id);
  if (idx > -1) {
    ideasFallasDb.splice(idx, 1);
  }

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.deleteFromSupabase) {
    try {
      await window.deleteFromSupabase('ideas_fallas', id);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Registro eliminado de la base de datos.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al eliminar de Supabase:', err);
    }
  }
}

function filtrarIdeaFallaPorKpi(tipo, val) {
  if (typeof document === "undefined") return;
  const elTipo = document.getElementById('filtro-tipo-idea-falla');
  const elEstado = document.getElementById('filtro-estado-idea-falla');

  if (tipo === 'tipo') {
    if (elTipo) {
      elTipo.value = (elTipo.value === val) ? 'todos' : val;
    }
    if (elEstado) elEstado.value = 'pendientes_en_curso';
  } else if (tipo === 'estado') {
    if (elEstado) {
      elEstado.value = (elEstado.value === val) ? 'pendientes_en_curso' : val;
    }
    if (elTipo) elTipo.value = 'todos';
  }
  
  renderIdeasFallas();
};

function renderIdeasFallas() {
  if (typeof document === "undefined") return;
  const tbody = document.getElementById('tabla-ideas-fallas-body');
  if (!tbody) return;

  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');

  // Actualizar recuadros KPI
  const ideasCount = ideasFallasDb.filter(x => x.tipo === 'Idea' && x.estado !== 'Resuelto' && x.estado !== 'Rechazado').length;
  const fallasCount = ideasFallasDb.filter(x => x.tipo === 'Falla' && x.estado !== 'Resuelto' && x.estado !== 'Rechazado').length;
  const pendientesCount = ideasFallasDb.filter(x => ['Pendiente', 'En Análisis', 'En Desarrollo', 'En Pruebas', 'En Progreso'].includes(x.estado || 'Pendiente')).length;
  const completadosCount = ideasFallasDb.filter(x => x.estado === 'Resuelto').length;

  const kpiIdeas = document.getElementById('kpi-if-ideas');
  if (kpiIdeas) kpiIdeas.textContent = ideasCount;

  const kpiFallas = document.getElementById('kpi-if-fallas');
  if (kpiFallas) kpiFallas.textContent = fallasCount;

  const kpiPendientes = document.getElementById('kpi-if-pendientes');
  if (kpiPendientes) kpiPendientes.textContent = pendientesCount;

  const kpiCompletados = document.getElementById('kpi-if-completados');
  if (kpiCompletados) kpiCompletados.textContent = completadosCount;

  const query = (document.getElementById('busqueda-idea-falla')?.value || '').toLowerCase().trim();
  const filtroModulo = document.getElementById('filtro-modulo-idea-falla')?.value || 'todos';
  const filtroTipo = document.getElementById('filtro-tipo-idea-falla')?.value || 'todos';
  const filtroPrioridad = document.getElementById('filtro-prioridad-idea-falla')?.value || 'todos';
  const filtroEstado = document.getElementById('filtro-estado-idea-falla')?.value || 'pendientes_en_curso';

  // Resaltado visual del recuadro KPI activo
  const cardIdeas = document.getElementById('card-kpi-if-ideas');
  const cardFallas = document.getElementById('card-kpi-if-fallas');
  const cardPendientes = document.getElementById('card-kpi-if-pendientes');
  const cardCompletados = document.getElementById('card-kpi-if-completados');

  [cardIdeas, cardFallas, cardPendientes, cardCompletados].forEach(c => {
    if (c) {
      c.style.borderColor = 'var(--border)';
      c.style.boxShadow = 'var(--shadow-sm)';
      c.style.transform = 'none';
    }
  });

  if (filtroTipo === 'Idea' && cardIdeas) {
    cardIdeas.style.borderColor = '#10b981';
    cardIdeas.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
    cardIdeas.style.transform = 'translateY(-2px)';
  } else if (filtroTipo === 'Falla' && cardFallas) {
    cardFallas.style.borderColor = '#ef4444';
    cardFallas.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
    cardFallas.style.transform = 'translateY(-2px)';
  } else if (filtroEstado === 'pendientes_en_curso' && cardPendientes) {
    cardPendientes.style.borderColor = '#f59e0b';
    cardPendientes.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.25)';
    cardPendientes.style.transform = 'translateY(-2px)';
  } else if (filtroEstado === 'Resuelto' && cardCompletados) {
    cardCompletados.style.borderColor = '#10b981';
    cardCompletados.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
    cardCompletados.style.transform = 'translateY(-2px)';
  }

  const filtrados = ideasFallasDb.filter(item => {
    const matchQuery = !query || 
      (item.titulo || '').toLowerCase().includes(query) || 
      (item.descripcion || '').toLowerCase().includes(query);

    const matchModulo = filtroModulo === 'todos' || (item.modulo || 'General') === filtroModulo;
    const matchTipo = filtroTipo === 'todos' || item.tipo === filtroTipo;
    const matchPrioridad = filtroPrioridad === 'todos' || item.prioridad === filtroPrioridad;

    let matchEstado = true;
    if (filtroEstado === 'pendientes_en_curso') {
      matchEstado = ['Pendiente', 'En Análisis', 'En Desarrollo', 'En Pruebas', 'En Progreso'].includes(item.estado || 'Pendiente');
    } else if (filtroEstado !== 'todos') {
      matchEstado = item.estado === filtroEstado;
    } else if (filtroTipo === 'Idea' || filtroTipo === 'Falla') {
      // Excluir automáticamente las resueltas y rechazadas al ver el catálogo activo de Ideas o Fallas
      matchEstado = item.estado !== 'Resuelto' && item.estado !== 'Rechazado';
    }

    return matchQuery && matchModulo && matchTipo && matchPrioridad && matchEstado;
  });

  // Ordenar por orden de priorización (campo orden) y luego por fecha descendente
  filtrados.sort((a, b) => {
    const ordenA = a.orden !== undefined ? a.orden : 999999;
    const ordenB = b.orden !== undefined ? b.orden : 999999;
    if (ordenA !== ordenB) {
      return ordenA - ordenB;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.88rem;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
            <i data-lucide="inbox" style="width:28px; height:28px; opacity:0.4;"></i>
            <span>No se encontraron registros de Ideas y Fallas.</span>
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  const MODULE_CONFIG = {
    'Tickets': { label: 'Tickets', color: '#4f8ef7', bg: 'rgba(79, 142, 247, 0.1)' },
    'Levantamientos': { label: 'Levantamientos', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    'Órdenes': { label: 'Órdenes', color: '#E8820C', bg: 'rgba(232, 130, 12, 0.1)' },
    'Clientes': { label: 'Clientes / SAP', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Gastos': { label: 'Gastos / Clara', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
    'Portal': { label: 'Portal Clientes', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    'Calendario': { label: 'Calendario', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'UI': { label: 'UI / Interfaz', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    'General': { label: 'General', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' }
  };

  tbody.innerHTML = filtrados.map((item, idx) => {
    const canEdit = puedeEditarIdeaFalla(item);

    // Tag para Módulo
    const modKey = item.modulo || 'General';
    const modCfg = MODULE_CONFIG[modKey] || MODULE_CONFIG['General'];

    // Badge de estado / etapa
    let badgeStyle = 'background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3);'; // Pendiente
    if (item.estado === 'En Análisis') {
      badgeStyle = 'background: rgba(168, 85, 247, 0.1); color: #9333ea; border: 1px solid rgba(168, 85, 247, 0.3);';
    } else if (item.estado === 'En Desarrollo' || item.estado === 'En Progreso') {
      badgeStyle = 'background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3);';
    } else if (item.estado === 'En Pruebas') {
      badgeStyle = 'background: rgba(6, 182, 212, 0.1); color: #0891b2; border: 1px solid rgba(6, 182, 212, 0.3);';
    } else if (item.estado === 'Resuelto') {
      badgeStyle = 'background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);';
    } else if (item.estado === 'Rechazado') {
      badgeStyle = 'background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);';
    }

    // Prioridad del elemento y estilo
    const prioVal = item.prioridad || 'Media';
    let prioStyle = 'background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25);';
    if (prioVal === 'Baja') {
      prioStyle = 'background: rgba(100, 116, 139, 0.08); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.25);';
    } else if (prioVal === 'Alta') {
      prioStyle = 'background: rgba(245, 158, 11, 0.08); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25);';
    } else if (prioVal === 'Crítica') {
      prioStyle = 'background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 700;';
    }

    // Formatear fecha
    const fecha = item.created_at ? new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    const archivosHTML = (item.archivos && item.archivos.length > 0) ? `
      <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem;">
        ${item.archivos.map(arch => {
          const isImg = arch.tipo && arch.tipo.startsWith('image/');
          return `
            <a href="${arch.url}" target="_blank" download="${arch.nombre}" onclick="event.stopPropagation();" 
               style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--bg-secondary); border:1px solid var(--border); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.72rem; color:var(--accent); text-decoration:none; font-weight:600; transition:all 0.15s;"
               onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
              ${isImg ? `<i data-lucide="image" style="width:12px; height:12px;"></i>` : `<i data-lucide="paperclip" style="width:12px; height:12px;"></i>`}
              <span style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${arch.nombre}</span>
            </a>
          `;
        }).join('')}
      </div>
    ` : '';

    const fechaRes = item.fecha_resolucion ? `• ${new Date(item.fecha_resolucion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}` : '';
    const resolucionHTML = (item.resolucion && (item.estado === 'Resuelto' || item.resolucion.trim().length > 0)) ? `
      <div style="margin-top:0.45rem; background:rgba(16, 185, 129, 0.06); border:1px solid rgba(16, 185, 129, 0.2); border-left:3px solid #10b981; padding:0.45rem 0.65rem; border-radius:6px; font-size:0.78rem; word-break:break-word;">
        <div style="font-weight:700; color:#10b981; display:flex; align-items:center; gap:0.3rem; margin-bottom:0.15rem;">
          <i data-lucide="check-circle-2" style="width:13px; height:13px;"></i>
          <span>Solución:</span>
        </div>
        <div style="color:var(--text-primary); white-space:pre-wrap; font-size:0.78rem; line-height:1.4;">${item.resolucion}</div>
        ${item.resuelto_por ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Resuelto por <b>${item.resuelto_por}</b> ${fechaRes}</div>` : ''}
      </div>
    ` : '';

    const dragAttrs = isSuperadmin 
      ? `draggable="true" 
         ondragstart="window.handleDragStart(event, '${item.id}')" 
         ondragover="window.handleDragOver(event)" 
         ondragenter="window.handleDragEnter(event, this)" 
         ondragleave="window.handleDragLeave(event, this)" 
         ondrop="window.handleDrop(event, '${item.id}')" 
         style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s; cursor: grab;"`
      : `style="border-bottom: 1px solid var(--border-light, #f1f5f9); transition: background-color 0.15s;"`;

    return `
      <tr ${dragAttrs}
          class="idea-falla-row"
          onmouseover="this.style.backgroundColor='var(--bg-hover, #f8fafc)'" 
          onmouseout="this.style.backgroundColor='transparent'">
        <td style="text-align: center; vertical-align: middle; padding: 0.75rem 0.5rem;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.78rem; background: var(--bg-hover, #e2e8f0); padding: 0.15rem 0.45rem; border-radius: 4px; min-width: 22px; text-align: center;">${idx + 1}</span>
            ${isSuperadmin ? '<i data-lucide="grip-vertical" style="width: 14px; height: 14px; color: var(--text-muted); opacity: 0.65; cursor: grab;"></i>' : ''}
          </div>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle;">
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem;">
            ${item.tipo === 'Idea' 
              ? `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:5px; font-size:0.73rem; font-weight:700; background:rgba(16, 185, 129, 0.1); color:#10b981; border: 1px solid rgba(16, 185, 129, 0.25);"><i data-lucide="sparkles" style="width:12px; height:12px;"></i> Idea</span>`
              : `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.55rem; border-radius:5px; font-size:0.73rem; font-weight:700; background:rgba(239, 68, 68, 0.1); color:#ef4444; border: 1px solid rgba(239, 68, 68, 0.25);"><i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> Falla</span>`
            }
            <div style="display:inline-flex; align-items:center; gap:0.3rem; font-size:0.72rem; font-weight:600; color:var(--text-secondary); background:var(--bg-secondary); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid var(--border); white-space:nowrap;">
              <i data-lucide="layers" style="width:11px; height:11px; opacity:0.7; flex-shrink:0;"></i>
              <span>${modCfg.label}</span>
            </div>
          </div>
        </td>
        <td style="padding: 0.75rem 1rem; vertical-align: middle; word-break: break-word;">
          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem; line-height: 1.35; margin-bottom: 0.2rem;">${item.titulo || ''}</div>
          ${item.descripcion ? `<div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin-top: 0.25rem; word-break: break-word;">${item.descripcion}</div>` : ''}
          ${archivosHTML}
          ${resolucionHTML}
        </td>
        <td style="padding: 0.75rem 0.5rem; vertical-align: middle; text-align: center;">
          <select ${canEdit ? '' : 'disabled'} style="font-size: 0.76rem; font-weight: 600; padding: 0.32rem 0.6rem; border-radius: 6px; outline: none; ${canEdit ? 'cursor: pointer;' : 'cursor: default; opacity: 0.9;'} ${prioStyle} text-align: center; transition: all 0.15s;"
            onchange="cambiarPrioridadIdeaFalla('${item.id}', this.value)">
            <option value="Baja" ${prioVal === 'Baja' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Baja</option>
            <option value="Media" ${prioVal === 'Media' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Media</option>
            <option value="Alta" ${prioVal === 'Alta' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Alta</option>
            <option value="Crítica" ${prioVal === 'Crítica' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Crítica</option>
          </select>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle;">
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;" title="${item.creado_por || 'Sistema'}">
              <i data-lucide="user" style="width: 12px; height: 12px; opacity: 0.65; color: var(--text-muted); flex-shrink:0;"></i>
              <span>${item.creado_por || 'Sistema'}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;">
              <i data-lucide="calendar" style="width: 11px; height: 11px; opacity: 0.65; color: var(--text-muted); flex-shrink:0;"></i>
              <span>${fecha}</span>
            </div>
          </div>
        </td>
        <td style="padding: 0.75rem 0.5rem; vertical-align: middle; text-align: center;">
          <select ${isSuperadmin ? '' : 'disabled'} onchange="cambiarEstadoIdeaFalla('${item.id}', this.value)" 
                  style="font-size: 0.74rem; font-weight: 700; padding: 0.32rem 0.7rem; border-radius: 20px; outline: none; ${isSuperadmin ? 'cursor: pointer;' : 'cursor: default; opacity: 0.95;'} text-align: center; ${badgeStyle} transition: all 0.2s;">
            <option value="Pendiente" ${item.estado === 'Pendiente' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Pendiente</option>
            <option value="En Análisis" ${item.estado === 'En Análisis' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Análisis</option>
            <option value="En Desarrollo" ${(item.estado === 'En Desarrollo' || item.estado === 'En Progreso') ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Desarrollo</option>
            <option value="En Pruebas" ${item.estado === 'En Pruebas' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">En Pruebas</option>
            <option value="Resuelto" ${item.estado === 'Resuelto' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Resuelto</option>
            <option value="Rechazado" ${item.estado === 'Rechazado' ? 'selected' : ''} style="background: var(--bg-card); color: var(--text-primary);">Rechazado</option>
          </select>
        </td>
        <td style="padding: 0.75rem 0.6rem; vertical-align: middle; text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 0.35rem; align-items: center; justify-content: flex-end;">
            ${canEdit ? `
              <button class="action-btn" title="Editar" onclick="abrirModalIdeaFalla('${item.id}')"
                style="padding: 0.35rem 0.45rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;"
                onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)';"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-secondary)';">
                <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
              </button>
            ` : ''}
            ${isSuperadmin ? `
              <button class="action-btn del" title="Eliminar" onclick="eliminarIdeaFalla('${item.id}')"
                style="padding: 0.35rem 0.45rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--red, #ef4444); display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;"
                onmouseover="this.style.background='rgba(239, 68, 68, 0.1)';"
                onmouseout="this.style.background='var(--bg-secondary)';">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            ` : ''}
            ${!canEdit && !isSuperadmin ? `
              <span style="color: var(--text-muted); font-size: 0.72rem; font-style: italic; padding: 0.2rem 0.4rem;">Solo lectura</span>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

async function cambiarPrioridadIdeaFalla(id, nuevaPrioridad) {
  if (typeof document === "undefined") return;
  const item = ideasFallasDb.find(x => x.id === id);
  if (!item) return;

  if (!puedeEditarIdeaFalla(item)) {
    alert('Acceso denegado: Solo puedes modificar la prioridad de tus propios registros.');
    renderIdeasFallas();
    return;
  }

  item.prioridad = nuevaPrioridad;
  item.updated_at = new Date().toISOString();

  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();

  if (window.pushToSupabase) {
    try {
      await window.pushToSupabase('ideas_fallas', item);
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Prioridad actualizada y sincronizada.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al cambiar prioridad en Supabase:', err);
    }
  }
}

// --- Drag & Drop Prioritization ---
let draggedId = null;

function handleDragStart(e, id) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  draggedId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
};

function handleDragOver(e) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return false;
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
};

function handleDragEnter(e, row) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  row.style.borderTop = '2px solid var(--accent)';
};

function handleDragLeave(e, row) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;
  row.style.borderTop = '';
};

async function handleDrop(e, targetId) {
  if (typeof document === "undefined") return;
  const isSuperadmin = (currentSession && currentSession.viewMode === 'superadmin');
  if (!isSuperadmin) return;

  e.stopPropagation();
  e.preventDefault();
  
  const row = e.currentTarget;
  if (row) row.style.borderTop = '';
  
  if (draggedId === targetId) return;
  
  const dragIdx = ideasFallasDb.findIndex(x => x.id === draggedId);
  const targetIdx = ideasFallasDb.findIndex(x => x.id === targetId);
  
  if (dragIdx === -1 || targetIdx === -1) return;
  
  const temp = ideasFallasDb[dragIdx];
  ideasFallasDb.splice(dragIdx, 1);
  ideasFallasDb.splice(targetIdx, 0, temp);
  
  // Recalculate order indices
  ideasFallasDb.forEach((item, idx) => {
    item.orden = idx;
  });
  
  localStorage.setItem('sapi_ideas_fallas', JSON.stringify(ideasFallasDb));
  renderIdeasFallas();
  
  if (window.pushToSupabase) {
    try {
      for (const item of ideasFallasDb) {
        await window.pushToSupabase('ideas_fallas', item);
      }
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Orden de priorización actualizado y sincronizado en la nube.', 'success');
      }
    } catch (err) {
      console.error('[IdeasFallas] Error al sincronizar nuevo orden con Supabase:', err);
    }
  }
};

// Exponer funciones al objeto global window para que funcionen los onclicks del HTML
window.puedeEditarIdeaFalla = puedeEditarIdeaFalla;
window.abrirModalIdeaFalla = abrirModalIdeaFalla;
window.cerrarModalIdeaFalla = cerrarModalIdeaFalla;
window.guardarIdeaFalla = guardarIdeaFalla;
window.cambiarEstadoIdeaFalla = cambiarEstadoIdeaFalla;
window.cambiarPrioridadIdeaFalla = cambiarPrioridadIdeaFalla;
window.eliminarIdeaFalla = eliminarIdeaFalla;
window.renderIdeasFallas = renderIdeasFallas;

// ── Sync SAP vía GitHub Actions (funciona desde cualquier dispositivo) ────────
// El workflow corre en servidores de GitHub (Azure) que SÍ pueden llegar a SAP.
// El token se guarda en localStorage del superadmin y se comparte en Supabase config.
const GH_REPO = 'lbesoy/sapi-postventa';
const GH_WORKFLOW = 'sync-sap.yml';

async function sincronizarConGitHub(modulo = 'all', btnEl = null) {
  if (typeof document === "undefined") return;
  if (typeof window !== 'undefined' && window._sapSyncRunning) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('⏳ Ya hay una sincronización en curso. Por favor espera un momento.', 'info');
    return;
  }
  if (typeof window !== 'undefined') window._sapSyncRunning = true;

  const origHTML = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { 
    btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Conectando SAP...'; 
    btnEl.disabled = true;
    lucide.createIcons(); 
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Sapi-Client-Token': 'SapiSecuredClientToken'
    };
    
    if (window.supabaseClient) {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    const triggerTime = new Date().getTime();

    const resp = await fetch('/api/trigger-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ modulo })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${resp.status}`);
    }

    mostrarNotificacion(`⏳ Sincronización iniciada en SAP. Procesando datos...`, 'info');
    if (btnEl) {
      btnEl.innerHTML = '<i data-lucide="loader" class="btn-icon rotating"></i> Procesando SAP...';
      lucide.createIcons();
    }

    let targetRunId = null;
    let attempts = 0;
    const maxAttempts = 40; // max ~3 minutos (5s por intento)

    const pollStatus = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollStatus);
        mostrarNotificacion('⚠️ Tiempo de espera agotado. Verifica la actualización en unos minutos.', 'warning');
        finishSync();
        return;
      }

      try {
        const statusResp = await fetch('/api/sync-status', {
          method: 'POST',
          headers
        });

        if (statusResp.ok) {
          const run = await statusResp.json();
          const runCreatedTime = new Date(run.created_at).getTime();

          if (!targetRunId) {
            if (run.status !== 'completed' || (runCreatedTime > triggerTime - 120000)) {
              targetRunId = run.id;
              console.log(`[Sync] Detectado workflow run activo: ID ${targetRunId}, Estado: ${run.status}`);
            }
          }

          if (targetRunId && run.id === targetRunId) {
            if (btnEl) {
              btnEl.innerHTML = `<i data-lucide="loader" class="btn-icon rotating"></i> SAP: ${run.status === 'in_progress' ? 'Procesando' : run.status}...`;
              lucide.createIcons();
            }

            if (run.status === 'completed') {
              clearInterval(pollStatus);
              if (run.conclusion === 'success') {
                mostrarNotificacion('⏳ Recargando base de datos...', 'info');
                if (window.cargarDatosDeSupabase) {
                  await window.cargarDatosDeSupabase();
                }
                mostrarNotificacion('✅ Sincronización SAP finalizada con éxito.', 'success');
                if (window.validarCotizacionConSAP) {
                  window.validarCotizacionConSAP(true);
                  const activeInlineStatusEl = document.querySelector('[id^="quick-sap-validation-status-"]');
                  if (activeInlineStatusEl) {
                    const activeInlineTransitionId = activeInlineStatusEl.id.replace('quick-sap-validation-status-', '');
                    window.validarCotizacionConSAP(false, activeInlineTransitionId);
                  }
                }
                if (window.poblarPedidosDropdown) {
                  window.poblarPedidosDropdown(true, null, document.getElementById('t-pedido-sap')?.value || '');
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.poblarPedidosDropdown(false, activeQuickTicketId, activeQuickPedEl.value || '');
                  }
                }
                if (window.validarPedidoConSAP) {
                  window.validarPedidoConSAP(true);
                  const activeQuickPedEl = document.querySelector('[id^="quick-ped-sap-"]');
                  if (activeQuickPedEl) {
                    const activeQuickTicketId = activeQuickPedEl.id.replace('quick-ped-sap-', '');
                    window.validarPedidoConSAP(false, activeQuickTicketId);
                  }
                }
              } else {
                mostrarNotificacion(`❌ Sincronización SAP fallida: ${run.conclusion || 'desconocido'}`, 'error');
              }
              finishSync();
            }
          }
        }
      } catch (err) {
        console.warn('Error sondeando estado de sync:', err);
      }
    }, 5000);

    function finishSync() {
      if (typeof window !== 'undefined') window._sapSyncRunning = false;
      if (btnEl) {
        btnEl.innerHTML = origHTML;
        btnEl.disabled = false;
        lucide.createIcons();
      }
    }

  } catch(e) {
    if (typeof window !== 'undefined') window._sapSyncRunning = false;
    mostrarNotificacion(`❌ Error al disparar sync: ${e.message}`, 'error');
    if (btnEl) {
      btnEl.innerHTML = origHTML;
      btnEl.disabled = false;
      lucide.createIcons();
    }
  }
}
window.sincronizarConGitHub = sincronizarConGitHub;


// Asignación explícita a window para compatibilidad
if (typeof window !== 'undefined') {
  window.editandoIdeaFallaId = editandoIdeaFallaId;
  window.ifArchivosAdjuntosTemp = ifArchivosAdjuntosTemp;
  window.renderIfArchivosPreview = renderIfArchivosPreview;
  window.eliminarIfArchivoTemp = eliminarIfArchivoTemp;
  window.handleIfFilesSelect = handleIfFilesSelect;
  window.handleIfFilesDrop = handleIfFilesDrop;
  window.procesarFilesIf = procesarFilesIf;
  window.abrirModalResolucionIdeaFalla = abrirModalResolucionIdeaFalla;
  window.cerrarModalResolucionIdeaFalla = cerrarModalResolucionIdeaFalla;
  window.guardarResolucionIdeaFalla = guardarResolucionIdeaFalla;
  window.puedeEditarIdeaFalla = puedeEditarIdeaFalla;
  window.abrirModalIdeaFalla = abrirModalIdeaFalla;
  window.cerrarModalIdeaFalla = cerrarModalIdeaFalla;
  window.guardarIdeaFalla = guardarIdeaFalla;
  window.cambiarEstadoIdeaFalla = cambiarEstadoIdeaFalla;
  window.eliminarIdeaFalla = eliminarIdeaFalla;
  window.filtrarIdeaFallaPorKpi = filtrarIdeaFallaPorKpi;
  window.renderIdeasFallas = renderIdeasFallas;
  window.cambiarPrioridadIdeaFalla = cambiarPrioridadIdeaFalla;
  window.handleDragStart = handleDragStart;
  window.handleDragOver = handleDragOver;
  window.handleDragEnter = handleDragEnter;
  window.handleDragLeave = handleDragLeave;
  window.handleDrop = handleDrop;
  window.sincronizarConGitHub = sincronizarConGitHub;
}

export {
  editandoIdeaFallaId,
  ifArchivosAdjuntosTemp,
  renderIfArchivosPreview,
  eliminarIfArchivoTemp,
  handleIfFilesSelect,
  handleIfFilesDrop,
  procesarFilesIf,
  abrirModalResolucionIdeaFalla,
  cerrarModalResolucionIdeaFalla,
  guardarResolucionIdeaFalla,
  puedeEditarIdeaFalla,
  abrirModalIdeaFalla,
  cerrarModalIdeaFalla,
  guardarIdeaFalla,
  cambiarEstadoIdeaFalla,
  eliminarIdeaFalla,
  filtrarIdeaFallaPorKpi,
  renderIdeasFallas,
  cambiarPrioridadIdeaFalla,
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  sincronizarConGitHub
};
