// Lógica para Levantamientos de Campo
let currentLevantamientosFilter = 'todos';

window.setFiltroEstadoLevantamientos = function(estado) {
  currentLevantamientosFilter = estado;
  renderLevantamientos();
};

function renderLevantamientos() {
  const tbody = document.getElementById('levantamientos-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const searchTerm = (document.getElementById('search-levantamientos')?.value || '').toLowerCase();
  
  let list = levantamientos || [];
  
  // Filter by Sandbox mode
  if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
    const activeSandbox = isTestModeActive();
    list = list.filter(l => isTestData(l) === activeSandbox);
  }
  
  // Update stats before filtering
  const total = list.length;
  const pendientes = list.filter(l => l.estado !== 'Completado').length;
  const completados = list.filter(l => l.estado === 'Completado').length;
  
  if (document.getElementById('stat-lev-total')) document.getElementById('stat-lev-total').textContent = total;
  if (document.getElementById('stat-lev-pendientes')) document.getElementById('stat-lev-pendientes').textContent = pendientes;
  if (document.getElementById('stat-lev-completados')) document.getElementById('stat-lev-completados').textContent = completados;
  
  if (currentLevantamientosFilter !== 'todos') {
    list = list.filter(l => l.estado === currentLevantamientosFilter || (currentLevantamientosFilter === 'Pendiente' && l.estado !== 'Completado'));
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
    const syncIcon = (l._synced === false) ? '<i data-lucide="cloud-off" style="width:14px;height:14px;color:var(--warning);margin-left:0.5rem;" title="Pendiente de sincronizar"></i>' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Folio" style="font-weight:600; color:var(--text-primary); display:flex; align-items:center;">${l.folio || 'N/A'} ${syncIcon}</td>
      <td data-label="Cliente">${l.cliente || 'No especificado'}</td>
      <td data-label="Sitio">${l.sitio || 'No especificado'}</td>
      <td data-label="Solicitante">${l.solicitante || 'N/A'}</td>
      <td data-label="Asignado A">${l.tecnico_asignado || '-'}</td>
      <td data-label="Fecha Esperada">${l.fecha_esperada ? l.fecha_esperada.substring(0,10) : 'N/A'}</td>
      <td data-label="Estado">
        <span style="font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:999px; ${l.estado === 'Completado' ? 'background:rgba(16, 185, 129, 0.1); color:#10b981;' : 'background:rgba(239, 68, 68, 0.1); color:#ef4444;'}">${l.estado || 'Pendiente'}</span>
      </td>
      <td data-label="Acciones">
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
  
  const isTest = (typeof isTestModeActive === 'function' && isTestModeActive());
  const yearStr = new Date().getFullYear().toString().slice(-2);
  const prefix = isTest ? `[PRUEBA] OL-${yearStr}` : `OL-${yearStr}`;
  
  const list = typeof levantamientos !== 'undefined' ? levantamientos : [];
  const levantamientosDelAnio = list.filter(l => l.folio && l.folio.startsWith(prefix));
  let maxConsecutivo = 0;
  levantamientosDelAnio.forEach(l => {
    const numStr = l.folio.substring(prefix.length);
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
  });
  const folio = `${prefix}${(maxConsecutivo + 1).toString().padStart(3, '0')}`;
  
  
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
        <select id="nl-cliente" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);" required onchange="window.actualizarSitiosNuevoLevantamiento(this.value)">
          <option value="">Seleccione un cliente...</option>
          ${(typeof clientesDb !== 'undefined' ? clientesDb : []).map(c => '<option value="' + c.nombre + '">' + c.nombre + '</option>').join('')}
        </select>
      </div>
      
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Sitio</label>
        <select id="nl-sitio" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border);">
          <option value="">Seleccione o busque un sitio...</option>
        </select>
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

      <div style="margin-bottom:1.5rem;">
        <label style="display:flex; justify-content:space-between; align-items:center; font-weight:600; margin-bottom:0.5rem;">
          Asignado A *
          <div style="position:relative; width:200px;">
            <i data-lucide="search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--text-muted);"></i>
            <input type="text" placeholder="Buscar técnico..." style="width:100%; padding:0.25rem 0.5rem 0.25rem 1.75rem; border-radius:4px; border:1px solid var(--border); font-size:0.75rem;" onkeyup="
              const q = this.value.toLowerCase();
              const container = document.getElementById('nl-asignado');
              const labels = container.querySelectorAll('label');
              labels.forEach(lbl => {
                const text = lbl.textContent.toLowerCase();
                if(text.includes(q)) lbl.style.display = 'inline-flex';
                else lbl.style.display = 'none';
              });
            ">
          </div>
        </label>
        <div id="nl-asignado" style="display:flex; flex-wrap:wrap; gap:0.5rem; max-height:120px; overflow-y:auto; padding:0.25rem;">
          ${(typeof usuarios !== 'undefined' ? usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && u.activo !== false && ((typeof isTestModeActive === 'function' && isTestModeActive()) || !(typeof isTestUser === 'function' && isTestUser(u)))) : []).map(u => `
            <label style="display:inline-flex; align-items:center; padding:0.4rem 0.8rem; background:var(--bg-body); border:1px solid var(--border); border-radius:99px; cursor:pointer; font-size:0.8rem; transition:all 0.2s;" onmouseover="if(!this.querySelector('input').checked) this.style.borderColor='var(--primary)'" onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='var(--border)'">
              <input type="checkbox" value="${u.nombre}" class="nl-asignado-cb" style="display:none;" onchange="this.parentElement.style.borderColor = this.checked ? 'var(--primary)' : 'var(--border)'; this.parentElement.style.background = this.checked ? 'var(--primary-light, #e0e7ff)' : 'var(--bg-body)'; this.parentElement.style.color = this.checked ? 'var(--primary)' : 'inherit';">
              ${u.nombre}
            </label>
          `).join('')}
        </div>
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
    window.initSearchableSelect('nl-sitio', 'Buscar sitio...', true);
  }
}

window.actualizarSitiosNuevoLevantamiento = function(cliName) {
  const sitSelect = document.getElementById('nl-sitio');
  if (!sitSelect) return;
  
  sitSelect.innerHTML = '<option value="">Seleccione o busque un sitio...</option>';
  
  if (cliName && typeof sitiosDb !== 'undefined') {
    const cliObj = (typeof clientesDb !== 'undefined' ? clientesDb.find(c => c.nombre === cliName) : null);
    const cliId = cliObj ? cliObj.id : null;
    const sit = sitiosDb.filter(s => s.cliente === cliName || s.cliente === cliId);
    sit.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.nombre;
      opt.textContent = s.nombre;
      sitSelect.appendChild(opt);
    });
  }
  
  if (typeof window.initSearchableSelect === 'function') {
    window.initSearchableSelect('nl-sitio', 'Buscar sitio...', true);
  }
};

function guardarNuevoLevantamiento(id, folio) {
  const cliente = document.getElementById('nl-cliente').value;
  const descripcion = document.getElementById('nl-descripcion').value;
  
  const checkboxes = Array.from(document.querySelectorAll('.nl-asignado-cb'));
  const asignados = checkboxes.filter(cb => cb.checked).map(cb => cb.value).join(', ');

  if (!cliente || !descripcion) {
    alert('Cliente y Descripción son obligatorios');
    return;
  }
  
  if (!asignados) {
    alert('Debes asignar el levantamiento a por lo menos un técnico o supervisor');
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
    tecnico_asignado: asignados,
    estado: 'Pendiente',
    created_at: new Date().toISOString(),
    _synced: false,
    esPrueba: (typeof isTestModeActive === 'function' ? isTestModeActive() : false)
  };
  
  if (typeof levantamientos === 'undefined') window.levantamientos = [];
  levantamientos.push(lev);
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  if (window.supabaseClient && window.pushToSupabase) {
    window.pushToSupabase('levantamientos', lev);
  }
  
  document.getElementById('modal-nuevo-levantamiento').remove();
  renderLevantamientos();
  if (window.lucide) window.lucide.createIcons();
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
    <div style="background:var(--bg-card); border-radius:12px; width:100%; max-width:600px; box-shadow:var(--shadow-lg); max-height:90vh; display:flex; flex-direction:column; overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding:1.5rem 2rem;">
        <h2 style="margin:0;">Levantamiento ${lev.folio}</h2>
        <span style="font-size:0.8rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:999px; ${isCompleted ? 'background:rgba(16, 185, 129, 0.1); color:#10b981;' : 'background:rgba(239, 68, 68, 0.1); color:#ef4444;'}">${lev.estado}</span>
      </div>
      
      <div style="padding:1.5rem 2rem; overflow-y:auto; flex:1;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Cliente</strong><br>${lev.cliente}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Sitio</strong><br>${lev.sitio || '-'}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Solicitante</strong><br>${lev.solicitante || '-'}</div>
        <div><strong style="color:var(--text-secondary);font-size:0.8rem;">Fecha Esperada</strong><br>${lev.fecha_esperada || '-'}</div>
        <div style="grid-column: 1 / -1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <strong style="color:var(--text-secondary);font-size:0.8rem;">Asignado A</strong>
            ${!isCompleted ? `
            <div style="position:relative; width:150px;">
              <i data-lucide="search" style="position:absolute; left:6px; top:50%; transform:translateY(-50%); width:12px; height:12px; color:var(--text-muted);"></i>
              <input type="text" placeholder="Buscar..." style="width:100%; padding:0.2rem 0.5rem 0.2rem 1.5rem; border-radius:4px; border:1px solid var(--border); font-size:0.75rem;" onkeyup="
                const q = this.value.toLowerCase();
                const container = document.getElementById('det-lev-asignado-container');
                const labels = container.querySelectorAll('label');
                labels.forEach(lbl => {
                  const text = lbl.textContent.toLowerCase();
                  if(text.includes(q)) lbl.style.display = 'inline-flex';
                  else lbl.style.display = 'none';
                });
              ">
            </div>` : ''}
          </div>
          ${isCompleted ? (lev.tecnico_asignado || '-') : `
            <div id="det-lev-asignado-container" style="display:flex; flex-wrap:wrap; gap:0.5rem; max-height:120px; overflow-y:auto; padding:0.25rem;">
              ${(typeof usuarios !== 'undefined' ? usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && u.activo !== false && ((typeof isTestModeActive === 'function' && isTestModeActive()) || !(typeof isTestUser === 'function' && isTestUser(u)))) : []).map(u => {
                const assignedList = (lev.tecnico_asignado || '').split(',').map(s => s.trim());
                const isChecked = assignedList.includes(u.nombre);
                return `
                <label style="display:inline-flex; align-items:center; padding:0.4rem 0.8rem; background:${isChecked ? 'var(--primary-light, #e0e7ff)' : 'var(--bg-body)'}; color:${isChecked ? 'var(--primary)' : 'inherit'}; border:1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}; border-radius:99px; cursor:pointer; font-size:0.8rem; transition:all 0.2s;" onmouseover="if(!this.querySelector('input').checked) this.style.borderColor='var(--primary)'" onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='var(--border)'">
                  <input type="checkbox" value="${u.nombre}" class="det-lev-asignado-cb" ${isChecked ? 'checked' : ''} onchange="actualizarAsignadosLevantamiento('${id}'); this.parentElement.style.borderColor = this.checked ? 'var(--primary)' : 'var(--border)'; this.parentElement.style.background = this.checked ? 'var(--primary-light, #e0e7ff)' : 'var(--bg-body)'; this.parentElement.style.color = this.checked ? 'var(--primary)' : 'inherit';" style="display:none;"> 
                  ${u.nombre}
                </label>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
      
      <div style="margin-bottom:1.5rem;">
        <strong style="color:var(--text-secondary);font-size:0.8rem;">Descripción</strong>
        <div style="background:var(--bg-body); padding:0.75rem; border-radius:6px; margin-top:0.25rem; white-space:pre-wrap;">${lev.descripcion}</div>
      </div>
      
      <div style="margin-bottom:1.5rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.25rem;">Notas del Técnico</label>
        <textarea id="det-lev-notas" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid var(--border); min-height:80px;" ${isCompleted ? 'disabled' : ''}>${lev.notas_tecnico || ''}</textarea>
      </div>

      <div style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <label style="font-weight:600; margin:0;">Evidencia Fotográfica</label>
          ${!isCompleted ? `
          <button type="button" class="btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="agregarEvidenciaLevantamiento()">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> Añadir
          </button>
          ` : ''}
        </div>
        
        ${!isCompleted ? `
          <div id="det-lev-ev-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-bottom:0.5rem;">
            ${[1, 2].map(i => `
              <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.5rem 1rem; border:2px dashed var(--border); border-radius:12px; cursor:pointer; background:var(--bg-body); transition:all 0.2s; position:relative; overflow:hidden;" onmouseover="if(!this.style.backgroundImage) { this.style.borderColor='var(--primary)'; this.style.background='var(--primary-light, #f8fafc)'; }" onmouseout="if(!this.style.backgroundImage) { this.style.borderColor='var(--border)'; this.style.background='var(--bg-body)'; }">
                <i data-lucide="upload-cloud" style="width:24px; height:24px; color:var(--text-muted); margin-bottom:0.5rem; transition:color 0.2s;"></i>
                <span style="font-size:0.75rem; color:var(--text-secondary); text-align:center; font-weight:500; line-height:1.2;">Seleccionar<br>Archivo ${i}</span>
                <input type="file" class="det-lev-ev-file" accept="image/*" style="display:none;" onchange="window.handleEvidenciaFileChange(this, '${i}')">
              </label>
            `).join('')}
          </div>
          <small style="display:flex; align-items:center; gap:0.25rem; color:var(--text-muted); font-size:0.75rem; margin-top:0.5rem;">
            <i data-lucide="info" style="width:12px; height:12px;"></i> Las evidencias actuales se conservarán. Puedes añadir tantas fotografías como necesites.
          </small>
        ` : ''}
        ${lev.evidencias && Object.keys(lev.evidencias).length > 0 ? `
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
            ${Object.entries(lev.evidencias).map(([k, url]) => `
              <a href="${url}" target="_blank" style="display:block; width:80px; height:80px; border-radius:6px; overflow:hidden; border:1px solid var(--border);">
                <img src="${url}" style="width:100%; height:100%; object-fit:cover;" title="${k}" />
              </a>
            `).join('')}
          </div>
        ` : (isCompleted ? '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">No se adjuntaron evidencias.</div>' : '')}
      </div>

      <div style="margin-bottom:1.5rem;">
        <label style="display:block; font-weight:600; margin-bottom:0.5rem;">Refacciones Necesarias</label>
        <div id="det-lev-refacciones-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.75rem;">
          ${(lev.refacciones || []).map((r, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-body); padding:0.5rem 0.75rem; border:1px solid var(--border); border-radius:6px; font-size:0.8rem;">
              <div><strong>${r.cantidad}x</strong> [${r.refaccion}] ${r.descripcion}</div>
              ${!isCompleted ? `<button type="button" onclick="eliminarRefaccionLevantamiento('${id}', ${i})" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>` : ''}
            </div>
          `).join('')}
          ${(!lev.refacciones || lev.refacciones.length === 0) ? '<div style="font-size:0.8rem; color:var(--text-muted);">No se han agregado refacciones.</div>' : ''}
        </div>
        
        ${!isCompleted ? `
        <div style="display:flex; gap:0.5rem; align-items:center; background:var(--bg-body); padding:0.5rem; border-radius:6px; border:1px dashed var(--border);">
          <select id="det-lev-nueva-ref" style="flex:1; padding:0.4rem; border-radius:4px; border:1px solid var(--border); font-size:0.8rem;">
            <option value="">-- Seleccionar Refacción --</option>
            ${(typeof refaccionesDb !== 'undefined' ? refaccionesDb : []).map(r => '<option value="' + (r.material || r.id) + '|' + (r.descripcion_material || r.nombre || '') + '">' + (r.material || r.id) + ' - ' + (r.descripcion_material || r.nombre || '') + '</option>').join('')}
          </select>
          <input type="number" id="det-lev-nueva-ref-cant" placeholder="Cant." min="1" value="1" style="width:70px; padding:0.4rem; border-radius:4px; border:1px solid var(--border); font-size:0.8rem;">
          <button type="button" class="btn-secondary" onclick="agregarRefaccionLevantamiento('${id}')" style="padding:0.4rem 0.75rem; font-size:0.8rem;">Agregar</button>
        </div>
        ` : ''}
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 2rem; border-top:1px solid var(--border); background:var(--bg-card);">
        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-detalle-levantamiento').remove()">Cerrar</button>
        ${!isCompleted ? `<button type="button" class="btn-primary" onclick="completarLevantamiento('${id}')">Completar y Generar Ticket</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(m);
  
  if (!isCompleted && typeof window.initSearchableSelect === 'function') {
    window.initSearchableSelect('det-lev-nueva-ref', 'Buscar refacción...');
  }
}

window.agregarEvidenciaLevantamiento = function() {
  const grid = document.getElementById('det-lev-ev-grid');
  if (!grid) return;
  const newIndex = grid.children.length + 1;
  const newEv = document.createElement('label');
  newEv.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.5rem 1rem; border:2px dashed var(--border); border-radius:12px; cursor:pointer; background:var(--bg-body); transition:all 0.2s; position:relative; overflow:hidden;';
  newEv.onmouseover = function() { if(!this.style.backgroundImage) { this.style.borderColor='var(--primary)'; this.style.background='var(--primary-light, #f8fafc)'; } };
  newEv.onmouseout = function() { if(!this.style.backgroundImage) { this.style.borderColor='var(--border)'; this.style.background='var(--bg-body)'; } };
  newEv.innerHTML = `
    <button type="button" onclick="event.preventDefault(); this.parentElement.remove();" style="position:absolute; top:4px; right:4px; background:rgba(255,255,255,0.8); border-radius:4px; padding:2px; border:none; color:var(--danger); cursor:pointer; z-index:10;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
    <i data-lucide="upload-cloud" style="width:24px; height:24px; color:var(--text-muted); margin-bottom:0.5rem; transition:color 0.2s;"></i>
    <span style="font-size:0.75rem; color:var(--text-secondary); text-align:center; font-weight:500; line-height:1.2;">Seleccionar<br>Archivo ${newIndex}</span>
    <input type="file" class="det-lev-ev-file" accept="image/*" style="display:none;" onchange="window.handleEvidenciaFileChange(this, '${newIndex}')">
  `;
  grid.appendChild(newEv);
  if (window.lucide) window.lucide.createIcons();
};

window.handleEvidenciaFileChange = function(input, indexStr) {
  const file = input.files[0];
  const label = input.parentElement;
  
  // Encontrar el span y el icono
  let icon = null;
  let span = null;
  Array.from(label.children).forEach(c => {
    if (c.tagName === 'I' || c.tagName === 'svg') icon = c;
    if (c.tagName === 'SPAN') span = c;
  });

  // Borrar el botón de eliminar extra si ya lo habíamos creado
  const oldDel = label.querySelector('.ev-del-extra-btn');
  if (oldDel) oldDel.remove();

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      label.style.backgroundImage = `url(${e.target.result})`;
      label.style.backgroundSize = 'cover';
      label.style.backgroundPosition = 'center';
      label.style.borderColor = 'var(--border)';
      if (icon) icon.style.display = 'none';
      if (span) span.style.display = 'none';
      
      // Si el label NO tiene un botón de cerrar por defecto (los primeros 2 no lo tienen)
      if (!label.querySelector('button')) {
        const delBtn = document.createElement('button');
        delBtn.className = 'ev-del-extra-btn';
        delBtn.type = 'button';
        delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px; height:14px;"></i>';
        delBtn.style.cssText = 'position:absolute; top:4px; right:4px; background:rgba(255,255,255,0.8); border-radius:4px; padding:2px; border:none; color:var(--danger); cursor:pointer; z-index:10;';
        delBtn.onclick = (ev) => {
          ev.preventDefault();
          input.value = '';
          label.style.backgroundImage = '';
          if (icon) icon.style.display = '';
          if (span) span.style.display = '';
          span.innerHTML = 'Seleccionar<br>Archivo ' + indexStr;
          delBtn.remove();
        };
        label.appendChild(delBtn);
        if (window.lucide) window.lucide.createIcons();
      }
    };
    reader.readAsDataURL(file);
  } else {
    label.style.backgroundImage = '';
    if (icon) icon.style.display = '';
    if (span) span.style.display = '';
    if (span) span.innerHTML = 'Seleccionar<br>Archivo ' + indexStr;
  }
};

window.agregarRefaccionLevantamiento = function(id) {
  const lev = levantamientos.find(l => l.id === id);
  if (!lev) return;
  
  const select = document.getElementById('det-lev-nueva-ref');
  const cantInput = document.getElementById('det-lev-nueva-ref-cant');
  
  if (!select.value) {
    alert('Por favor selecciona una refacción.');
    return;
  }
  
  const parts = select.value.split('|');
  const ref = {
    refaccion: parts[0],
    descripcion: parts[1] || '',
    cantidad: parseInt(cantInput.value) || 1
  };
  
  lev.refacciones = lev.refacciones || [];
  lev.refacciones.push(ref);
  
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  
  // Re-render modal details
  document.getElementById('modal-detalle-levantamiento').remove();
  verDetalleLevantamiento(id);
};

window.eliminarRefaccionLevantamiento = function(id, index) {
  const lev = levantamientos.find(l => l.id === id);
  if (!lev || !lev.refacciones) return;
  
  lev.refacciones.splice(index, 1);
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  
  // Re-render modal details
  document.getElementById('modal-detalle-levantamiento').remove();
  verDetalleLevantamiento(id);
};

function actualizarLevantamiento(id, campo, valor) {
  const lev = levantamientos.find(l => l.id === id);
  if (!lev) return;
  
  lev[campo] = valor;
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  if (window.supabaseClient && window.updateInSupabase) {
    window.updateInSupabase('levantamientos', lev.id, { [campo]: valor });
  }
  // No re-render here to avoid losing focus/state if they are typing or checking multiple boxes
}

window.actualizarAsignadosLevantamiento = function(id) {
  const checkboxes = Array.from(document.querySelectorAll('.det-lev-asignado-cb:checked'));
  const asignados = checkboxes.map(cb => cb.value).join(', ');
  actualizarLevantamiento(id, 'tecnico_asignado', asignados);
};

window.completarLevantamiento = async function(id) {
  const lev = levantamientos.find(l => l.id === id);
  if (!lev) return;
  
  if (!confirm('¿Estás seguro de completar este levantamiento? Se generará un ticket automáticamente para seguimiento y cierre.')) return;
  
  lev.notas_tecnico = document.getElementById('det-lev-notas').value;
  lev.estado = 'Completado';
  
  // Read evidences if any
  let filePromises = [];
  const fileInputs = Array.from(document.querySelectorAll('.det-lev-ev-file'));
  
  if (!lev.evidencias) lev.evidencias = {};
  if (!lev.evidencias_base64) lev.evidencias_base64 = {};
  
  // Find the highest existing index to prevent overwriting
  let highestExistingIndex = 0;
  if (lev.evidencias) {
    Object.keys(lev.evidencias).forEach(k => {
      if (k.startsWith('foto_')) {
        const num = parseInt(k.replace('foto_', ''), 10);
        if (!isNaN(num) && num > highestExistingIndex) highestExistingIndex = num;
      }
    });
  }

  let nextIndex = highestExistingIndex + 1;

  fileInputs.forEach(input => {
    if (input.files && input.files.length > 0) {
      const idx = nextIndex++;
      filePromises.push(readFileAsBase64(input.files[0]).then(b64 => { 
        lev.evidencias_base64[`foto_${idx}`] = b64; 
      }));
    }
  });
  
  if (filePromises.length > 0) {
    try {
      await Promise.all(filePromises);
    } catch (e) {
      console.error("Error reading evidence files:", e);
    }
  }
  
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
  if (window.supabaseClient && window.updateInSupabase) {
    window.updateInSupabase('levantamientos', lev.id, { 
      estado: lev.estado, 
      notas_tecnico: lev.notas_tecnico,
      refacciones: lev.refacciones || []
    });
  }
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
