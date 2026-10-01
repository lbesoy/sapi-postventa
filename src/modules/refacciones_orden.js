/**
 * MÓDULO DE REFACCIONES DE ÓRDENES DE SERVICIO Y TICKETS
 * Eurorep / SAPI - ES Module
 */

// Fallbacks y polyfills defensivos para Node.js y ambientes desacoplados
if (typeof globalThis.refaccionesDb === "undefined") {
  globalThis.refaccionesDb = (typeof localStorage !== "undefined")
    ? JSON.parse(localStorage.getItem("sapi_refacciones_db") || "[]")
    : [];
}
if (typeof globalThis.tickets === "undefined") {
  globalThis.tickets = (typeof localStorage !== "undefined")
    ? JSON.parse(localStorage.getItem("sapi_tickets") || "[]")
    : [];
}

const _notify = (msg, tipo = "info") => {
  if (typeof mostrarNotificacion === "function") return mostrarNotificacion(msg, tipo);
  if (typeof window !== "undefined" && typeof window.mostrarNotificacion === "function") return window.mostrarNotificacion(msg, tipo);
  console.log("[" + tipo.toUpperCase() + "] " + msg);
};

const _safeSet = (k, v) => {
  if (typeof safeSetJSON === "function") return safeSetJSON(k, v);
  if (typeof window !== "undefined" && typeof window.safeSetJSON === "function") return window.safeSetJSON(k, v);
  if (typeof localStorage !== "undefined") localStorage.setItem(k, JSON.stringify(v));
};

// ===== REFACCIONES (ORDEN SERVICIO & TICKETS) =====
const MARCAS_CATALOGO_OFICIAL = {
  'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
  'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
  'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
  'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
  'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER',
  'KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA',
  'EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
};

function popularSelectMarcas(comboIdMarca, comboIdDesc) {
  if (typeof document === "undefined") return;
  // Helper para resolver catálogo de refacciones desde cualquier fuente disponible
  const catalogo = (typeof window !== 'undefined' && Array.isArray(window.refaccionesDb) && window.refaccionesDb.length > 0)
    ? window.refaccionesDb
    : ((typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb) && refaccionesDb.length > 0)
      ? refaccionesDb
      : (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]') : []));

  if (typeof refaccionesDb !== 'undefined' && catalogo.length > 0) refaccionesDb = catalogo;
  if (typeof window !== 'undefined' && catalogo.length > 0) window.refaccionesDb = catalogo;

  // Soporte legacy si se pasa un elemento <select> directamente
  if (comboIdMarca && typeof comboIdMarca === 'object' && comboIdMarca.tagName === 'SELECT') {
    const marcasSet = new Set(Object.keys(MARCAS_CATALOGO_OFICIAL));
    catalogo.forEach(r => {
      const m = (r.marcaCodigo || r.marca || '').trim().toUpperCase();
      if (m && m !== 'N/A') marcasSet.add(m);
    });
    let html = '<option value="">Marca...</option>';
    [...marcasSet].sort().forEach(m => {
      const mFull = MARCAS_CATALOGO_OFICIAL[m] || m;
      html += `<option value="${m}">${mFull}</option>`;
    });
    comboIdMarca.innerHTML = html;
    return;
  }

  const optionsDiv = document.getElementById(comboIdMarca + '-options');
  if (!optionsDiv) return;

  // Mapa Código -> Nombre Completo (siempre contiene las 26 marcas oficiales más adicionales de la BD)
  const marcasMap = new Map();
  Object.entries(MARCAS_CATALOGO_OFICIAL).forEach(([code, name]) => {
    marcasMap.set(code, name);
  });

  catalogo.forEach(r => {
    const raw = (r.marcaCodigo || r.marca || '').trim();
    if (raw && raw !== 'N/A') {
      const code = raw.toUpperCase();
      if (!marcasMap.has(code)) {
        marcasMap.set(code, MARCAS_CATALOGO_OFICIAL[code] || raw);
      }
    }
  });

  // Ordenar alfabéticamente por nombre de marca
  const marcasOrdenadas = [...marcasMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  let html = '';
  marcasOrdenadas.forEach(([mCode, mFull]) => {
    html += `<div class="combo-option" data-code="${mCode}" onclick="window.seleccionarMarcaRefaccion(this, '${mCode}', '${mFull}', '${comboIdMarca}', '${comboIdDesc}')">${mFull}</div>`;
  });
  optionsDiv.innerHTML = html;

  // Si el catálogo está vacío en memoria, intentar cargar desde IndexedDB / Supabase reactivamente
  if (catalogo.length === 0 && typeof window !== 'undefined') {
    if (typeof window.loadRefaccionesLocal === 'function' && !window._cargandoRefaccionesLocal) {
      window._cargandoRefaccionesLocal = true;
      window.loadRefaccionesLocal().then(data => {
        window._cargandoRefaccionesLocal = false;
        if (data && data.length > 0) {
          window.refaccionesDb = data;
          if (typeof refaccionesDb !== 'undefined') refaccionesDb = data;
          console.log(`[popularSelectMarcas] Refacciones cargadas reactivamente desde IndexedDB (${data.length} registros).`);
        } else if (window.supabaseClient && !window._descargandoRefaccionesAuto) {
          window._descargandoRefaccionesAuto = true;
          window.supabaseClient.from('refacciones').select('*').limit(3500).then(({ data: sbData }) => {
            window._descargandoRefaccionesAuto = false;
            if (sbData && sbData.length > 0) {
              const mapped = sbData.map(r => ({
                id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, 
                marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
                grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
                ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
              }));
              window.refaccionesDb = mapped;
              if (typeof refaccionesDb !== 'undefined') refaccionesDb = mapped;
              if (typeof window.saveRefaccionesLocal === 'function') window.saveRefaccionesLocal(mapped);
              console.log(`[popularSelectMarcas] ⚡ Refacciones descargadas automáticamente desde Supabase (${mapped.length} registros).`);
            }
          }).catch(() => { window._descargandoRefaccionesAuto = false; });
        }
      }).catch(() => { window._cargandoRefaccionesLocal = false; });
    }
  }
};

function seleccionarMarcaRefaccion(optionEl, marcaCode, marcaFull, comboIdMarca, comboIdDesc) {
  if (typeof document === "undefined") return;
  const comboMenu = optionEl.closest('.combo-menu');
  
  // Close the menu
  if (comboMenu) comboMenu.classList.remove('open');
  const comboEl = document.getElementById(comboIdMarca + '-combo');
  if (comboEl) comboEl.classList.remove('focus');
  
  // Update hidden input and display text
  const hiddenInput = document.getElementById(comboIdMarca);
  const displaySpan = document.getElementById(comboIdMarca + '-display');
  if (hiddenInput) hiddenInput.value = marcaCode;
  if (displaySpan) displaySpan.textContent = marcaFull;
  
  // Trigger update descripciones
  window.actualizarDescripcionesCombo(comboIdMarca, comboIdDesc);
};

function actualizarDescripcionesCombo(comboIdMarca, comboIdDesc) {
  if (typeof document === "undefined") return;
  const hiddenMarca = document.getElementById(comboIdMarca);
  const marcaSel = hiddenMarca ? hiddenMarca.value : '';
  const optionsDiv = document.getElementById(comboIdDesc + '-options');
  const row = document.getElementById(comboIdDesc) ? document.getElementById(comboIdDesc).closest('.ref-row') : null;
  const inputClave = row ? row.querySelector('.ref-clave') : null;
  const inputPrecio = row ? row.querySelector('.ref-precio') : null;
  const hiddenDesc = document.getElementById(comboIdDesc);
  const displaySpan = document.getElementById(comboIdDesc + '-display');
  
  if (inputClave) inputClave.value = '';
  if (inputPrecio) inputPrecio.value = '';
  if (hiddenDesc) hiddenDesc.value = '';
  if (displaySpan) displaySpan.textContent = 'Descripción...';

  const catalogo = (typeof window !== 'undefined' && Array.isArray(window.refaccionesDb) && window.refaccionesDb.length > 0)
    ? window.refaccionesDb
    : ((typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb) && refaccionesDb.length > 0)
      ? refaccionesDb
      : (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('sapi_refacciones_db') || '[]') : []));

  if (typeof refaccionesDb !== 'undefined' && catalogo.length > 0) refaccionesDb = catalogo;
  if (typeof window !== 'undefined' && catalogo.length > 0) window.refaccionesDb = catalogo;

  let html = '';
  if (marcaSel) {
    const marcaSelNorm = marcaSel.trim().toLowerCase();
    const marcaSelFull = (MARCAS_CATALOGO_OFICIAL[marcaSel.toUpperCase()] || marcaSel).trim().toLowerCase();

    const refsPorMarca = catalogo.filter(r => {
      const rMarca = (r.marca || '').trim().toLowerCase();
      const rMarcaCodigo = (r.marcaCodigo || '').trim().toLowerCase();
      const rMarcaFull = (MARCAS_CATALOGO_OFICIAL[(r.marcaCodigo || r.marca || '').toUpperCase()] || r.marca || '').trim().toLowerCase();
      
      return rMarca === marcaSelNorm || 
             rMarca === marcaSelFull || 
             rMarcaCodigo === marcaSelNorm || 
             rMarcaCodigo === marcaSelFull ||
             rMarcaFull === marcaSelNorm || 
             rMarcaFull === marcaSelFull;
    }).sort((a,b) => (a.descripcion || a.nombre || '').localeCompare(b.descripcion || b.nombre || ''));

    if (refsPorMarca.length > 0) {
      refsPorMarca.forEach(r => {
        const clave = r.id || r.codigo || r.idInterno || '';
        const desc = r.descripcion || r.nombre || 'Sin descripción';
        html += `<div class="combo-option" data-desc="${desc}" data-clave="${clave}" onclick="window.seleccionarDescRefaccion(this, '${comboIdDesc}', '${clave}', ${r.precio || 0})">${desc} ${clave ? `[${clave}]` : ''}</div>`;
      });
    } else {
      html = `<div class="combo-option" style="color:var(--text-muted); cursor:default;">No hay refacciones en catálogo para esta marca</div>`;
    }
  } else {
    html = `<div class="combo-option" style="color:var(--text-muted); cursor:default;">Seleccione una marca primero</div>`;
  }
  if (optionsDiv) optionsDiv.innerHTML = html;

  // Si el catálogo está vacío y se seleccionó una marca, intentar auto-recuperar y re-renderizar
  if (catalogo.length === 0 && marcaSel && typeof window !== 'undefined' && window.supabaseClient && !window._descargandoRefaccionesAuto) {
    window._descargandoRefaccionesAuto = true;
    window.supabaseClient.from('refacciones').select('*').limit(3500).then(({ data: sbData }) => {
      window._descargandoRefaccionesAuto = false;
      if (sbData && sbData.length > 0) {
        const mapped = sbData.map(r => ({
          id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, 
          marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
          grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
          ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
        }));
        window.refaccionesDb = mapped;
        if (typeof refaccionesDb !== 'undefined') refaccionesDb = mapped;
        if (typeof window.saveRefaccionesLocal === 'function') window.saveRefaccionesLocal(mapped);
        console.log(`[actualizarDescripcionesCombo] ⚡ Refacciones descargadas automáticamente (${mapped.length} registros).`);
        window.actualizarDescripcionesCombo(comboIdMarca, comboIdDesc);
      }
    }).catch(() => { window._descargandoRefaccionesAuto = false; });
  }
};

function seleccionarDescRefaccion(optionEl, comboIdDesc, clave, precio) {
  if (typeof document === "undefined") return;
  const text = optionEl.dataset.desc || optionEl.textContent;
  const comboMenu = optionEl.closest('.combo-menu');
  
  // Close the menu
  if (comboMenu) comboMenu.classList.remove('open');
  const comboEl = document.getElementById(comboIdDesc + '-combo');
  if (comboEl) comboEl.classList.remove('focus');
  
  // Update hidden input and display text
  const hiddenInput = document.getElementById(comboIdDesc);
  const displaySpan = document.getElementById(comboIdDesc + '-display');
  if (hiddenInput) hiddenInput.value = text;
  if (displaySpan) displaySpan.textContent = text;
  
  // Update Clave and Precio
  const row = optionEl.closest('.ref-row');
  if (row) {
    const inputClave = row.querySelector('.ref-clave');
    const inputPrecio = row.querySelector('.ref-precio');
    if (inputClave) inputClave.value = clave || '';
    if (inputPrecio) inputPrecio.value = precio || '';

    // Auto-detect Sistema if row has .ref-sistema or .kit-row-sistema
    const selectSist = row.querySelector('.ref-sistema, .kit-row-sistema');
    if (selectSist && typeof window.detectarSistemaRefaccion === 'function') {
      selectSist.value = window.detectarSistemaRefaccion(text);
    }
  }
};

let refComboCounter = 0;

function agregarRef(section) {
  if (typeof document === "undefined") return;
  const list = document.getElementById(`ref-${section}-list`);
  const row = document.createElement('div');
  row.className = 'ref-row';
  row.dataset.section = section;
  
  refComboCounter++;
  const idComboMarca = `ref-marca-combo-${refComboCounter}`;
  const idComboDesc = `ref-desc-combo-${refComboCounter}`;
  
  let html = `
    <!-- MARCA COMBO -->
    <div style="flex: 1.2; min-width: 100px; position:relative;" class="group-ref-marca">
      <div class="combo-box" tabindex="0" id="${idComboMarca}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboMarca}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Marca...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboMarca}-menu" style="width: 250px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboMarca}-search" placeholder="Buscar..." oninput="filterCombo('${idComboMarca}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboMarca}-options">
          <!-- Populated by popularSelectMarcas -->
        </div>
      </div>
      <input type="hidden" class="ref-marca" id="${idComboMarca}" />
    </div>
    
    <!-- DESC COMBO -->
    <div style="flex: 2; position:relative; min-width: 120px;" class="group-ref-desc">
      <div class="combo-box" tabindex="0" id="${idComboDesc}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboDesc}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Descripción...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboDesc}-menu" style="width: 100%; min-width: 300px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboDesc}-search" placeholder="Buscar..." oninput="filterCombo('${idComboDesc}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboDesc}-options">
          <div class="combo-option" style="color:var(--text-muted)">Seleccione una marca primero</div>
        </div>
      </div>
      <input type="hidden" class="ref-desc-hidden ref-desc" id="${idComboDesc}" />
    </div>

    <input type="text" placeholder="Clave" class="ref-clave" style="width:70px; padding: 0.45rem 0.4rem; font-size:0.8rem;" readonly />
    <input type="number" placeholder="Cant." class="ref-cant" style="width:50px; padding: 0.45rem 0.4rem; font-size:0.8rem;" min="0" value="1"/>`;
    
  if (section === 'utilizadas') {
    html += `<input type="number" placeholder="Precio" class="ref-precio" style="width:70px; display:none; padding: 0.45rem 0.4rem; font-size:0.8rem;" step="0.01"/>
      <div class="ref-foto-container" style="display:flex; align-items:center; gap:0.25rem;">
        <input type="file" accept="image/*" class="ref-foto-input" style="display:none;" onchange="subirFotoRefaccion(this)" />
        <input type="hidden" class="ref-foto-url" value="" />
        <button type="button" class="btn-icon-only ref-foto-btn" onclick="this.parentElement.querySelector('.ref-foto-input').click()" style="padding: 0.45rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: pointer;" title="Subir foto de refacción (Obligatorio)">
          <i data-lucide="camera" style="width:16px;height:16px;"></i>
        </button>
        <div class="ref-foto-preview" style="display:none; color: #10b981; align-items:center; cursor:pointer;" title="Ver foto" onclick="previsualizarImagenCompleta(this.parentElement.querySelector('.ref-foto-url').value, 'Foto de Refacción')">
          <i data-lucide="check-circle" style="width:18px;height:18px;"></i>
        </div>
      </div>
      <div class="ref-discrepancia-msg" style="flex-basis: 100%; width: 100%; font-size: 0.72rem; font-weight: 500; margin-top: 0.3rem; margin-bottom: 0.15rem; padding: 0.25rem 0.6rem; border-radius: 6px; display: none; align-items: center; gap: 0.35rem; transition: all 0.2s ease;"></div>
      <div class="ref-discrepancia-justificacion-container" style="flex-basis: 100%; width: 100%; display: none; margin-top: 0.25rem; margin-bottom: 0.25rem;">
        <input type="text" class="ref-justificacion-discrepancia" placeholder="Explique el motivo de la discrepancia (Obligatorio)..." style="width: 100%; font-size: 0.75rem; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; box-sizing: border-box; background: var(--bg-hover); color: var(--text-primary);" />
      </div>`;
  }
  
  html += `<button type="button" class="btn-del-ref" onclick="eliminarRef(this)">✕</button>`;
  
  row.innerHTML = html;
  list.appendChild(row);
  
  if (window.lucide) window.lucide.createIcons({ root: row });
  
  // Attach Event Listeners dynamically
  const comboMarca = document.getElementById(`${idComboMarca}-combo`);
  if (comboMarca) {
    comboMarca.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboMarca);
    });
  }
  
  const comboDesc = document.getElementById(`${idComboDesc}-combo`);
  if (comboDesc) {
    comboDesc.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboDesc);
    });
  }
  
  // Prevent menu clicks from bubbling
  const menuMarca = document.getElementById(`${idComboMarca}-menu`);
  if (menuMarca) menuMarca.addEventListener('click', e => e.stopPropagation());
  
  const menuDesc = document.getElementById(`${idComboDesc}-menu`);
  if (menuDesc) menuDesc.addEventListener('click', e => e.stopPropagation());
  
  // Popular el select de marca en esta nueva fila
  window.popularSelectMarcas(idComboMarca, idComboDesc);
  
  const cantInput = row.querySelector('.ref-cant');
  if (cantInput) {
    cantInput.addEventListener('input', () => {
      window.actualizarFilaDiscrepanciaRefaccion(row);
    });
  }
}

function actualizarFilaDiscrepanciaRefaccion(row) {
  if (typeof document === "undefined") return;
  const cantInput = row.querySelector('.ref-cant');
  if (!cantInput) return;
  const cant = parseFloat(cantInput.value || 0);
  
  const fotoContainer = row.querySelector('.ref-foto-container');
  if (fotoContainer) {
    if (cant === 0) {
      fotoContainer.style.setProperty('display', 'none', 'important');
    } else {
      fotoContainer.style.setProperty('display', 'flex', 'important');
    }
  }
  
  if (row.hasAttribute('data-from-pdf')) {
    const originalCant = parseFloat(row.getAttribute('data-original-pdf-cantidad') || 0);
    const diff = cant - originalCant;
    const msgEl = row.querySelector('.ref-discrepancia-msg');
    const justEl = row.querySelector('.ref-discrepancia-justificacion-container');
    if (msgEl) {
      if (diff !== 0) {
        msgEl.style.display = 'inline-flex';
        if (justEl) justEl.style.display = 'block';
        if (cant === 0) {
          msgEl.style.background = '#fef2f2';
          msgEl.style.border = '1px solid #fee2e2';
          msgEl.style.color = '#dc2626';
          msgEl.innerHTML = `<i data-lucide="alert-triangle" style="width:13px; height:13px; flex-shrink:0;"></i> <span>Discrepancia: No se utilizó (Original PDF: ${originalCant})</span>`;
        } else {
          msgEl.style.background = '#fffbeb';
          msgEl.style.border = '1px solid #fef3c7';
          msgEl.style.color = '#d97706';
          msgEl.innerHTML = `<i data-lucide="info" style="width:13px; height:13px; flex-shrink:0;"></i> <span>Discrepancia PDF: ${diff > 0 ? '+' : ''}${diff} unidades (Original: ${originalCant} vs Reportado: ${cant})</span>`;
        }
        if (window.lucide) window.lucide.createIcons({ root: msgEl });
      } else {
        msgEl.style.display = 'none';
        if (justEl) {
          justEl.style.display = 'none';
          const justInput = justEl.querySelector('.ref-justificacion-discrepancia');
          if (justInput) justInput.value = '';
        }
      }
    }
  }
};

function eliminarRef(btn) {
  if (typeof document === "undefined") return;
  const row = btn.closest('.ref-row');
  const list = row.parentElement;
  if (list.querySelectorAll('.ref-row').length > 1) row.remove();
}

function getRefacciones(section) {
  if (typeof document === "undefined") return [];
  const rows = document.querySelectorAll(`#ref-${section}-list .ref-row`);
  const result = [];
  rows.forEach(row => {
    const desc = row.querySelector('.ref-desc')?.value?.trim();
    if (!desc) return;
    const item = {
      descripcion: desc,
      clave: row.querySelector('.ref-clave')?.value?.trim(),
      cantidad: row.querySelector('.ref-cant')?.value,
    };
    if (section === 'utilizadas') {
      item.precio = row.querySelector('.ref-precio')?.value;
      item.fotoUrl = row.querySelector('.ref-foto-url')?.value || '';
    }
    
    if (row.hasAttribute('data-from-pdf')) {
      item.isFromPdf = true;
      const originalCant = parseFloat(row.getAttribute('data-original-pdf-cantidad') || 0);
      item.originalPdfCantidad = originalCant;
      item.diferenciaCantidadPdf = item.cantidad - originalCant;
      item.justificacion_discrepancia = row.querySelector('.ref-justificacion-discrepancia')?.value?.trim() || null;
    }
    
    result.push(item);
  });
  return result;
}

function setRefacciones(section, items) {
  if (typeof document === "undefined") return;
  const list = document.getElementById(`ref-${section}-list`);
  list.innerHTML = '';
  const toSet = items.length ? items : [{}];
  toSet.forEach(item => {
    agregarRef(section);
    const row = list.lastElementChild;
    if (item.descripcion) {
      // Find marca from refaccionesDb
      let foundMarca = '';
      if (item.clave) {
        const match = refaccionesDb.find(r => r.id === item.clave || r.codigo === item.clave);
        if (match) foundMarca = match.marca;
      }
      if (!foundMarca) {
        const match = refaccionesDb.find(r => r.descripcion === item.descripcion);
        if (match) foundMarca = match.marca;
      }
      
      const hiddenMarca = row.querySelector('.ref-marca');
      const hiddenDesc = row.querySelector('.ref-desc-hidden');
      const comboSpanMarca = document.getElementById(hiddenMarca.id + '-display');
      const comboOptions = document.getElementById(hiddenDesc.id + '-options');
      const comboSpanDesc = document.getElementById(hiddenDesc.id + '-display');
      
      if (foundMarca) {
        hiddenMarca.value = foundMarca;
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[foundMarca.toUpperCase()] || foundMarca;
      }
      
      // Update descripciones based on the marca
      window.actualizarDescripcionesCombo(hiddenMarca.id, hiddenDesc.id);
      
      // Check if description exists in options
      let optExists = false;
      if (comboOptions) {
        comboOptions.querySelectorAll('.combo-option').forEach(opt => {
          if (opt.textContent === item.descripcion) optExists = true;
        });
      }
      
      // If the description is not in the options, add it as a legacy option
      if (!optExists && item.descripcion && comboOptions) {
        const legacyHtml = `<div class="combo-option" onclick="window.seleccionarDescRefaccion(this, '${hiddenDesc.id}', '${item.clave || ''}', ${item.precio || 0})">${item.descripcion}</div>`;
        if (comboOptions.innerHTML.includes('Seleccione una marca')) {
          comboOptions.innerHTML = legacyHtml;
        } else {
          comboOptions.innerHTML += legacyHtml;
        }
      }
      
      hiddenDesc.value = item.descripcion;
      if (comboSpanDesc) comboSpanDesc.textContent = item.descripcion;
    }
    
    if (item.clave) row.querySelector('.ref-clave').value = item.clave;
    if (item.cantidad) row.querySelector('.ref-cant').value = item.cantidad;
    if (section === 'utilizadas') {
      if (item.precio) row.querySelector('.ref-precio').value = item.precio;
      if (item.fotoUrl) {
        row.querySelector('.ref-foto-url').value = item.fotoUrl;
        row.querySelector('.ref-foto-btn').style.display = 'none';
        row.querySelector('.ref-foto-preview').style.display = 'flex';
      }
    }
    
    if (item.isFromPdf) {
      row.setAttribute('data-from-pdf', 'true');
      const originalCant = item.originalPdfCantidad !== undefined ? item.originalPdfCantidad : (item.cantidad || 1);
      row.setAttribute('data-original-pdf-cantidad', originalCant);
      
      const delBtn = row.querySelector('.btn-del-ref');
      if (delBtn) delBtn.style.display = 'none';
      
      // Bloquear edición de clave y combos, pero permitir cantidad
      row.querySelector('.ref-clave')?.setAttribute('readonly', 'true');
      
      const cantInput = row.querySelector('.ref-cant');
      if (cantInput) {
        cantInput.removeAttribute('readonly');
        cantInput.setAttribute('min', '0');
      }
      
      const combos = row.querySelectorAll('.combo-box');
      combos.forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.opacity = '0.7';
      });
      
      row.setAttribute('title', `Refacción extraída de PDF AI (Original: ${originalCant}. Se puede modificar la cantidad)`);
      if (item.justificacion_discrepancia) {
        const justInput = row.querySelector('.ref-justificacion-discrepancia');
        if (justInput) justInput.value = item.justificacion_discrepancia;
      }
    }
    
    // Ejecutar validación inicial de discrepancia y visibilidad de foto
    window.actualizarFilaDiscrepanciaRefaccion(row);
  });
}
window.refComboCounter = window.refComboCounter || 0;

function inicializarRefaccionesTicket(ticketId, refaccionesList) {
  if (typeof document === "undefined") return;
  const list = document.getElementById('ref-ticket-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (refaccionesList && refaccionesList.length > 0) {
    refaccionesList.forEach(item => {
      window.agregarFilaRefaccionTicket(ticketId, item);
    });
  } else {
    window.agregarFilaRefaccionTicket(ticketId, {});
  }
};

function agregarFilaRefaccionTicket(ticketId, initialData = {}) {
  if (typeof document === "undefined") return;
  const list = document.getElementById('ref-ticket-list');
  if (!list) return;
  
  const row = document.createElement('div');
  row.className = 'ref-row';
  row.style.margin = '0';
  row.style.borderBottom = '1px solid var(--border)';
  row.style.padding = '0.35rem 0';
  
  window.refComboCounter++;
  const idComboMarca = `ref-tkt-marca-${window.refComboCounter}`;
  const idComboDesc = `ref-tkt-desc-${window.refComboCounter}`;
  
  let html = `
    <!-- MARCA COMBO -->
    <div style="flex: 1.2; min-width: 100px; position:relative;" class="group-ref-marca">
      <div class="combo-box" tabindex="0" id="${idComboMarca}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboMarca}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Marca...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboMarca}-menu" style="width: 250px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboMarca}-search" placeholder="Buscar..." oninput="filterCombo('${idComboMarca}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboMarca}-options">
          <!-- Populated by popularSelectMarcas -->
        </div>
      </div>
      <input type="hidden" class="ref-marca" id="${idComboMarca}" />
    </div>
    
    <!-- DESC COMBO -->
    <div style="flex: 2; position:relative; min-width: 120px;" class="group-ref-desc">
      <div class="combo-box" tabindex="0" id="${idComboDesc}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboDesc}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Descripción...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboDesc}-menu" style="width: 100%; min-width: 300px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboDesc}-search" placeholder="Buscar..." oninput="filterCombo('${idComboDesc}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboDesc}-options">
          <div class="combo-option" style="color:var(--text-muted)">Seleccione una marca primero</div>
        </div>
      </div>
      <input type="hidden" class="ref-desc-hidden ref-desc" id="${idComboDesc}" />
    </div>

    <input type="text" placeholder="Clave" class="ref-clave" style="width:70px; padding: 0.45rem 0.4rem; font-size:0.8rem;" readonly />
    <input type="number" placeholder="Cant." class="ref-cant" style="width:50px; padding: 0.45rem 0.4rem; font-size:0.8rem;" min="1" value="1"/>
    <button type="button" class="btn-del-ref" onclick="window.eliminarFilaRefaccionTicket(this, '${ticketId}')">✕</button>
  `;
  
  row.innerHTML = html;
  list.appendChild(row);
  
  if (window.lucide) window.lucide.createIcons({ root: row });
  
  // Attach Event Listeners dynamically
  const comboMarca = document.getElementById(`${idComboMarca}-combo`);
  if (comboMarca) {
    comboMarca.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboMarca);
    });
  }
  
  const comboDesc = document.getElementById(`${idComboDesc}-combo`);
  if (comboDesc) {
    comboDesc.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboDesc);
    });
  }
  
  // Prevent menu clicks from bubbling
  const menuMarca = document.getElementById(`${idComboMarca}-menu`);
  if (menuMarca) menuMarca.addEventListener('click', e => e.stopPropagation());
  
  const menuDesc = document.getElementById(`${idComboDesc}-menu`);
  if (menuDesc) menuDesc.addEventListener('click', e => e.stopPropagation());
  
  // Populate marca options
  window.popularSelectMarcas(idComboMarca, idComboDesc);
  
  // Apply initialData if present
  if (initialData.marca) {
    const hiddenMarca = row.querySelector('.ref-marca');
    const hiddenDesc = row.querySelector('.ref-desc-hidden');
    const comboSpanMarca = document.getElementById(idComboMarca + '-display');
    const comboSpanDesc = document.getElementById(idComboDesc + '-display');
    
    hiddenMarca.value = initialData.marca;
    const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
    if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[initialData.marca.toUpperCase()] || initialData.marca;
    
    window.actualizarDescripcionesCombo(idComboMarca, idComboDesc);
    
    if (initialData.nombre) {
      hiddenDesc.value = initialData.nombre;
      if (comboSpanDesc) comboSpanDesc.textContent = initialData.nombre;
      
      const comboOptions = document.getElementById(idComboDesc + '-options');
      if (comboOptions) {
        let optExists = false;
        comboOptions.querySelectorAll('.combo-option').forEach(opt => {
          if (opt.textContent === initialData.nombre) optExists = true;
        });
        if (!optExists) {
          const legacyHtml = `<div class="combo-option" onclick="window.seleccionarDescRefaccion(this, '${idComboDesc}', '${initialData.codigo || ''}', 0)">${initialData.nombre}</div>`;
          if (comboOptions.innerHTML.includes('Seleccione una marca')) {
            comboOptions.innerHTML = legacyHtml;
          } else {
            comboOptions.innerHTML += legacyHtml;
          }
        }
      }
    }
  }
  
  if (initialData.codigo) row.querySelector('.ref-clave').value = initialData.codigo;
  if (initialData.cantidad) row.querySelector('.ref-cant').value = initialData.cantidad;
};

function eliminarFilaRefaccionTicket(btn, ticketId) {
  if (typeof document === "undefined") return;
  const row = btn.closest('.ref-row');
  if (row) {
    row.remove();
    const list = document.getElementById('ref-ticket-list');
    if (list && list.querySelectorAll('.ref-row').length === 0) {
      window.agregarFilaRefaccionTicket(ticketId, {});
    }
  }
};

function guardarRefaccionesTicketDesdeUI(ticketId, transitionToRefacciones = false) {
  if (typeof document === "undefined") return;
  const t = tickets.find(x => x.id === ticketId);
  if (!t) return;
  
  const rows = document.querySelectorAll('#ref-ticket-list .ref-row');
  const list = [];
  rows.forEach(row => {
    const marca = row.querySelector('.ref-marca')?.value;
    const nombre = row.querySelector('.ref-desc-hidden')?.value;
    const codigo = row.querySelector('.ref-clave')?.value;
    const cantidad = parseInt(row.querySelector('.ref-cant')?.value) || 1;
    if (codigo || nombre) {
      list.push({ marca, codigo, nombre, cantidad });
    }
  });
  
  t.refaccionesSeleccionadas = list;
  t.notas = window.inyectarRefaccionesEnNotas(t.notas || '', list);
  t.fechaModificacion = new Date().toISOString();
  t.modificadoPor = window.getCurrentUserDisplayName ? window.getCurrentUserDisplayName() : 'Usuario';
  
  if (transitionToRefacciones) {
    t.estado = 'Refacciones';
  }
  
  safeSetJSON('sapi_tickets', tickets);
  if (window.pushToSupabase) window.pushToSupabase('tickets', t);
  
  if (transitionToRefacciones) {
    mostrarNotificacion('Refacciones guardadas. Ticket enviado a etapa de Refacciones.', 'success');
  } else {
    mostrarNotificacion('Cambios en refacciones guardados.', 'success');
  }
  
  verDetalleTicket(ticketId);
  renderTickets();
};

async function cerrarGarantiaInternaDirecto(id) {
  if (typeof document === "undefined") return;
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  
  const confirmar = confirm('¿Estás seguro de que deseas finalizar y cerrar este ticket de Garantía Interna directamente?');
  if (!confirmar) return;
  
  const now = new Date().toISOString();
  t.estado = 'Cerrado';
  t.cotAceptada = 'si';
  t.fechaCierre = now;
  t.fechaModificacion = now;
  t.modificadoPor = window.getCurrentUserDisplayName ? window.getCurrentUserDisplayName() : 'Usuario';
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', t);
  }
  safeSetJSON('sapi_tickets', tickets);
  
  mostrarNotificacion('Ticket de Garantía Interna cerrado con éxito.', 'success');
  cerrarDetalleTicket();
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
};

// Exponer en window para retrocompatibilidad total con el navegador y eventos HTML inline
if (typeof window !== "undefined") {
  window.MARCAS_CATALOGO_OFICIAL = MARCAS_CATALOGO_OFICIAL;
  window.popularSelectMarcas = popularSelectMarcas;
  window.seleccionarMarcaRefaccion = seleccionarMarcaRefaccion;
  window.actualizarDescripcionesCombo = actualizarDescripcionesCombo;
  window.seleccionarDescRefaccion = seleccionarDescRefaccion;
  window.refComboCounter = refComboCounter;
  window.agregarRef = agregarRef;
  window.actualizarFilaDiscrepanciaRefaccion = actualizarFilaDiscrepanciaRefaccion;
  window.eliminarRef = eliminarRef;
  window.getRefacciones = getRefacciones;
  window.setRefacciones = setRefacciones;
  window.inicializarRefaccionesTicket = inicializarRefaccionesTicket;
  window.agregarFilaRefaccionTicket = agregarFilaRefaccionTicket;
  window.eliminarFilaRefaccionTicket = eliminarFilaRefaccionTicket;
  window.guardarRefaccionesTicketDesdeUI = guardarRefaccionesTicketDesdeUI;
  window.cerrarGarantiaInternaDirecto = cerrarGarantiaInternaDirecto;
}

export {
  MARCAS_CATALOGO_OFICIAL,
  popularSelectMarcas,
  seleccionarMarcaRefaccion,
  actualizarDescripcionesCombo,
  seleccionarDescRefaccion,
  refComboCounter,
  agregarRef,
  actualizarFilaDiscrepanciaRefaccion,
  eliminarRef,
  getRefacciones,
  setRefacciones,
  inicializarRefaccionesTicket,
  agregarFilaRefaccionTicket,
  eliminarFilaRefaccionTicket,
  guardarRefaccionesTicketDesdeUI,
  cerrarGarantiaInternaDirecto
};
