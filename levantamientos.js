// Lógica para Levantamientos de Campo
function renderLevantamientos() {
  const tbody = document.getElementById('levantamientos-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const filterEstado = document.getElementById('filter-lev-estado')?.value || 'todos';
  const searchTerm = (document.getElementById('search-levantamientos')?.value || '').toLowerCase();
  
  let list = levantamientos || [];
  
  if (filterEstado !== 'todos') {
    list = list.filter(l => l.estado === filterEstado);
  }
  
  if (searchTerm) {
    list = list.filter(l => 
      (l.folio || '').toLowerCase().includes(searchTerm) ||
      (l.cliente || '').toLowerCase().includes(searchTerm) ||
      (l.sitio || '').toLowerCase().includes(searchTerm) ||
      (l.solicitante || '').toLowerCase().includes(searchTerm)
    );
  }
  
  list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay levantamientos que coincidan con la búsqueda.</td></tr>`;
    return;
  }
  
  list.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600; color:var(--text-primary);">${l.folio || 'N/A'}</td>
      <td>${l.cliente || 'No especificado'}</td>
      <td>${l.sitio || 'No especificado'}</td>
      <td>${l.solicitante || 'N/A'}</td>
      <td>${l.fecha_esperada ? l.fecha_esperada.substring(0,10) : 'N/A'}</td>
      <td>
        <span style="font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:999px; ${l.estado === 'Completado' ? 'background:rgba(16, 185, 129, 0.1); color:#10b981;' : 'background:rgba(239, 68, 68, 0.1); color:#ef4444;'}">${l.estado || 'Pendiente'}</span>
      </td>
      <td>
        <button class="btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="verDetalleLevantamiento('${l.id}')">Ver Detalle</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Update badge in sidebar
  const badge = document.getElementById('nav-badge-levantamientos');
  if (badge) {
    const pendientes = (levantamientos || []).filter(l => l.estado !== 'Completado').length;
    badge.textContent = pendientes > 0 ? pendientes : '';
    badge.style.display = pendientes > 0 ? 'inline-block' : 'none';
  }
}

function window_abrirModalNuevoLevantamiento() {
  const id = (typeof uuidv4 === 'function') ? uuidv4() : crypto.randomUUID();
  const folio = 'LEV-' + new Date().getFullYear().toString().slice(-2) + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  const m = document.createElement('div');
  m.id = 'modal-nuevo-levantamiento';
  m.style.position = 'fixed';
  m.style.top = '0'; m.style.left = '0'; m.style.width = '100vw'; m.style.height = '100vh';
  m.style.background = 'rgba(0,0,0,0.5)'; m.style.display = 'flex';
  m.style.alignItems = 'center'; m.style.justifyContent = 'center'; m.style.zIndex = '99999';
  
  m.innerHTML = `
    <div style="background:var(--bg-card); padding:1.5rem; border-radius:12px; width:100%; max-width:500px; box-shadow:var(--shadow-lg);">
      <h3 style="margin-top:0;">Nuevo Levantamiento</h3>
      <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:1rem;">Folio: <strong>${folio}</strong></p>
      
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Cliente *</label>
        <select id="nl-cliente" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);" required>
          <option value="">Seleccione un cliente...</option>
          ${(typeof clientesDb !== 'undefined' ? clientesDb : []).map(c => '<option value="' + c.nombre + '">' + c.nombre + '</option>').join('')}
        </select>
      </div>
      
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Sitio</label>
        <input type="text" id="nl-sitio" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);" placeholder="Ej. Planta Monterrey">
      </div>
      
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Solicitante</label>
        <input type="text" id="nl-solicitante" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);" placeholder="Nombre de quien solicita">
      </div>
      
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Descripción *</label>
        <textarea id="nl-descripcion" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); min-height:80px;" required placeholder="Detalles de la inspección requerida..."></textarea>
      </div>
      
      <div style="margin-bottom:1.5rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Fecha Esperada</label>
        <input type="date" id="nl-fecha" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);">
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-nuevo-levantamiento').remove()">Cancelar</button>
        <button type="button" class="btn-primary" onclick="guardarNuevoLevantamiento('${id}', '${folio}')">Crear Levantamiento</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  
  // Convert native select to custom searchable select
  if (typeof window.initSearchableSelect === 'function') {
    window.initSearchableSelect('nl-cliente', 'Buscar cliente...');
  }
}

function guardarNuevoLevantamiento(id, folio) {
  const cliente = document.getElementById('nl-cliente').value;
  const descripcion = document.getElementById('nl-descripcion').value;
  
  if (!cliente || !descripcion) {
    alert('Cliente y Descripción son obligatorios');
    return;
  }
  
  const lev = {
    id,
    folio,
    cliente,
    sitio: document.getElementById('nl-sitio').value,
    solicitante: document.getElementById('nl-solicitante').value,
    descripcion,
    fecha_esperada: document.getElementById('nl-fecha').value,
    estado: 'Pendiente',
    created_at: new Date().toISOString()
  };
  
  if (typeof levantamientos === 'undefined') window.levantamientos = [];
  levantamientos.push(lev);
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  if (window.supabaseClient && window.pushToSupabase) {
    window.pushToSupabase('levantamientos', lev);
  }
  
  document.getElementById('modal-nuevo-levantamiento').remove();
  renderLevantamientos();
  if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Levantamiento creado', 'success');
}

function verDetalleLevantamiento(id) {
  const lev = (typeof levantamientos !== 'undefined' ? levantamientos : []).find(l => l.id === id);
  if (!lev) return;
  
  const m = document.createElement('div');
  m.id = 'modal-detalle-levantamiento';
  m.style.position = 'fixed';
  m.style.top = '0'; m.style.left = '0'; m.style.width = '100vw'; m.style.height = '100vh';
  m.style.background = 'rgba(0,0,0,0.5)'; m.style.display = 'flex';
  m.style.alignItems = 'center'; m.style.justifyContent = 'center'; m.style.zIndex = '99999';
  
  const isCompleted = lev.estado === 'Completado';
  
  m.innerHTML = `
    <div style="background:var(--bg-card); padding:2rem; border-radius:12px; width:100%; max-width:600px; box-shadow:var(--shadow-lg); max-height:90vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:1rem;">
        <h2 style="margin:0;">Levantamiento ${lev.folio}</h2>
        <span style="font-size:0.8rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:999px; ${isCompleted ? 'background:rgba(16, 185, 129, 0.1); color:#10b981;' : 'background:rgba(239, 68, 68, 0.1); color:#ef4444;'}">${lev.estado}</span>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Cliente</strong><br>${lev.cliente}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Sitio</strong><br>${lev.sitio || '-'}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Solicitante</strong><br>${lev.solicitante || '-'}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Fecha Esperada</strong><br>${lev.fecha_esperada || '-'}</div>
      </div>
      
      <div style="margin-bottom:1.5rem;">
        <strong style="color:var(--text-secondary);font-size:0.8rem;">Descripción</strong>
        <div style="background:var(--bg-body); padding:0.75rem; border-radius:6px; margin-top:0.25rem; white-space:pre-wrap;">${lev.descripcion}</div>
      </div>
      
      <div style="margin-bottom:1.5rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Notas del Técnico</label>
        <textarea id="det-lev-notas" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); min-height:80px;" ${isCompleted ? 'disabled' : ''}>${lev.notas_tecnico || ''}</textarea>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-detalle-levantamiento').remove()">Cerrar</button>
        ${!isCompleted ? `<button type="button" class="btn-primary" onclick="completarLevantamiento('${id}')">Completar y Generar Ticket</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(m);
}

function completarLevantamiento(id) {
  const lev = levantamientos.find(l => l.id === id);
  if (!lev) return;
  
  if (!confirm('¿Estás seguro de completar este levantamiento? Se generará un ticket automáticamente para seguimiento y cierre.')) return;
  
  lev.notas_tecnico = document.getElementById('det-lev-notas').value;
  lev.estado = 'Completado';
  
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  if (window.supabaseClient && window.pushToSupabase) {
    window.pushToSupabase('levantamientos', lev);
  }
  
  // Generar Ticket Automático
  const ticketId = (typeof uuidv4 === 'function') ? uuidv4() : crypto.randomUUID();
  const ticketFolio = 'TCK-' + lev.folio;
  const newTicket = {
    id: ticketId,
    folio: ticketFolio,
    cliente: lev.cliente,
    sitio: lev.sitio,
    solicitante: lev.solicitante,
    asunto: 'Visita de Levantamiento - ' + lev.folio,
    descripcion: lev.descripcion + '\\n\\nNotas: ' + lev.notas_tecnico,
    categoria: 'Otro',
    prioridad: 'Media',
    estado: 'Cerrado (Aceptado)', // Para permitir generar orden de servicio
    fecha: new Date().toISOString(),
    fecha_creacion: new Date().toISOString(),
    canal: 'Sistema',
    notas: 'Ticket generado automáticamente desde módulo de Levantamientos.'
  };
  
  if (typeof tickets !== 'undefined') {
    tickets.push(newTicket);
    if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
    if (window.supabaseClient && window.pushToSupabase) {
      window.pushToSupabase('tickets', newTicket);
    }
    if (typeof renderTickets === 'function') renderTickets();
    if (typeof renderStats === 'function') renderStats();
    if (typeof updateTicketBadge === 'function') updateTicketBadge();
  }
  
  document.getElementById('modal-detalle-levantamiento').remove();
  renderLevantamientos();
  
  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion('Levantamiento completado. Ticket generado: ' + ticketFolio, 'success');
  }
}

// Hook it to window
window.abrirModalNuevoLevantamiento = window_abrirModalNuevoLevantamiento;
window.renderLevantamientos = renderLevantamientos;
window.verDetalleLevantamiento = verDetalleLevantamiento;
window.completarLevantamiento = completarLevantamiento;
window.guardarNuevoLevantamiento = guardarNuevoLevantamiento;
