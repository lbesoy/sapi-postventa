/**
 * Módulo de Formulario, Días Panels, KM y Guardado de Órdenes de Servicio - Eurorep / SAPI
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

  var DIAS = (typeof window !== "undefined" && window.DIAS) || ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  var editandoId = (typeof window !== "undefined" && window.editandoId) || null;

  function safeIsTestModeActive() {
    if (typeof isTestModeActive === "function") return isTestModeActive();
    if (typeof window !== "undefined" && typeof window.isTestModeActive === "function") return window.isTestModeActive();
    return false;
  }

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

// ===== DIAS PANELS =====
function initDiasPanels() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('dia-panels');
  container.innerHTML = DIAS.map((dia, i) => `
    <div class="dia-panel ${i===0?'active':''}" id="panel-${dia}">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="${dia}-fecha" onchange="autoCompletarFechas('${dia}', this.value)"/>
      </div>
      <div class="form-group">
        <label>Origen → Trabajo (hrs)</label>
        <input type="number" id="${dia}-traslado-ida" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Trabajo → Origen (hrs)</label>
        <input type="number" id="${dia}-traslado-vuelta" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Entrada</label>
        <input type="time" id="${dia}-entrada" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Salida</label>
        <input type="time" id="${dia}-salida" oninput="calcularHorasDia('${dia}')"/>
      </div>
      <div class="form-group">
        <label>Horas Normales</label>
        <input type="number" id="${dia}-normales" min="0" step="0.5"/>
      </div>
      <div class="form-group">
        <label>Horas Extra</label>
        <input type="number" id="${dia}-extras" min="0" step="0.5"/>
      </div>
    </div>
  `).join('');
}

function calcularHorasDia(dia) {
  if (typeof document === 'undefined') return;
  const entrada = document.getElementById(`${dia}-entrada`).value;
  const salida = document.getElementById(`${dia}-salida`).value;
  if (!entrada || !salida) return;
  
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  
  let totalMinutos = (sh * 60 + sm) - (eh * 60 + em);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  
  let totalHoras = totalMinutos / 60;
  let normales = Math.min(totalHoras, 8);
  let extras = totalHoras > 8 ? totalHoras - 8 : 0;
  
  document.getElementById(`${dia}-normales`).value = normales > 0 ? parseFloat(normales.toFixed(2)) : '';
  document.getElementById(`${dia}-extras`).value = extras > 0 ? parseFloat(extras.toFixed(2)) : '';
}

function autoCompletarFechas(diaOrigen, fechaStr) {
  if (typeof document === 'undefined') return;
  if (!fechaStr) return;
  const origenIndex = DIAS.indexOf(diaOrigen);
  if (origenIndex === -1) return;
  
  const [year, month, day] = fechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  
  const dayOfWeek = baseDate.getDay();
  const expectedDayOfWeek = origenIndex === 6 ? 0 : origenIndex + 1;
  
  if (dayOfWeek !== expectedDayOfWeek) {
    mostrarNotificacion(`La fecha seleccionada no corresponde al día ${diaOrigen.toUpperCase()}.`, 'warning');
    document.getElementById(`${diaOrigen}-fecha`).value = '';
    return;
  }
  
  DIAS.forEach((dia, i) => {
    if (i === origenIndex) return;
    const diff = i - origenIndex;
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + diff);
    
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(newDate.getDate()).padStart(2, '0');
    
    const el = document.getElementById(`${dia}-fecha`);
    if (el && !el.value) { // Solo si está vacío
      el.value = `${y}-${m}-${d}`;
    }
  });
}

function selDia(btn, dia) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.dia-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dia-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + dia).classList.add('active');
}

// ===== KM CALC =====
function calcKmTotal() {
  if (typeof document === 'undefined') return;
  const ida = parseFloat(document.getElementById('f-km-ida').value) || 0;
  const vuelta = parseFloat(document.getElementById('f-km-vuelta').value) || 0;
  document.getElementById('f-km-total').value = ida + vuelta;
}


// ===== DIAS DATA =====
function getDiasData() {
  if (typeof document === 'undefined') return {};
  const data = {};
  DIAS.forEach(dia => {
    data[dia] = {
      fecha: document.getElementById(`${dia}-fecha`)?.value,
      trasladoIda: document.getElementById(`${dia}-traslado-ida`)?.value,
      trasladoVuelta: document.getElementById(`${dia}-traslado-vuelta`)?.value,
      entrada: document.getElementById(`${dia}-entrada`)?.value,
      salida: document.getElementById(`${dia}-salida`)?.value,
      normales: document.getElementById(`${dia}-normales`)?.value,
      extras: document.getElementById(`${dia}-extras`)?.value,
    };
  });
  return data;
}

function setDiasData(data) {
  if (typeof document === 'undefined') return;
  if (!data) return;
  DIAS.forEach(dia => {
    if (!data[dia]) return;
    const d = data[dia];
    if (d.fecha) document.getElementById(`${dia}-fecha`).value = d.fecha;
    if (d.trasladoIda) document.getElementById(`${dia}-traslado-ida`).value = d.trasladoIda;
    if (d.trasladoVuelta) document.getElementById(`${dia}-traslado-vuelta`).value = d.trasladoVuelta;
    if (d.entrada) document.getElementById(`${dia}-entrada`).value = d.entrada;
    if (d.salida) document.getElementById(`${dia}-salida`).value = d.salida;
    if (d.normales) document.getElementById(`${dia}-normales`).value = d.normales;
    if (d.extras) document.getElementById(`${dia}-extras`).value = d.extras;
  });
}

// ===== FORM =====
function generarFolioConsecutivo() {
  const isTest = safeIsTestModeActive();
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = isTest ? `OS-PRUEBA-` : `OS-${currentYear}`;
  let maxConsecutivo = 0;
  
  ordenes.forEach(o => {
    if (o.folio && typeof o.folio === 'string') {
      const cleanFolio = o.folio.replace('[PRUEBA] ', '').replace('[TEST] ', '').trim();
      if (cleanFolio.startsWith(prefix)) {
        const numStr = cleanFolio.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxConsecutivo) {
          maxConsecutivo = num;
        }
      }
    }
  });
  
  maxConsecutivo++;
  const padded = maxConsecutivo.toString().padStart(3, '0');
  return `${prefix}${padded}`;
}

function abrirFormulario(id, modoReporte = false) {
  if (typeof document === 'undefined') return;
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar órdenes.', 'error');
    return;
  }
  editandoId = id || null;
  if (typeof window !== 'undefined') window.editandoId = editandoId;
  document.getElementById('modal-title').textContent = modoReporte ? 'Llenar Reporte Técnico' : (id ? 'Editar Orden' : 'Nueva Orden de Servicio');
  document.getElementById('form-orden').reset();

  // Restaurar estilos y propiedades habilitadas por defecto (evita que se queden bloqueadas de sesiones anteriores)
  const todosCamposTexto = [
    'f-folio', 'f-pedido', 'f-ubicacion', 'f-ubicacion-sitio', 'f-operador', 'f-eco',
    'f-horometro', 'f-horometro-real', 'f-modelo', 'f-serie',
    'f-km-ida', 'f-km-vuelta'
  ];
  todosCamposTexto.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.readOnly = false;
      el.style.background = '';
      el.style.cursor = '';
      el.style.opacity = '';
    }
  });

  const todosSelects = ['f-soporte', 'f-equipo', 'f-estado'];
  todosSelects.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.disabled = false;
      el.style.background = '';
      el.style.opacity = '';
    }
  });

  const fClienteComboReset = document.getElementById('f-cliente-combo');
  if (fClienteComboReset) {
    fClienteComboReset.style.pointerEvents = 'auto';
    fClienteComboReset.style.background = '';
    fClienteComboReset.style.opacity = '';
  }

  document.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.disabled = false;
  });

  document.querySelectorAll('input[name="f-tecnicos"]').forEach(cb => {
    cb.disabled = false;
  });

  const elFallaReset = document.getElementById('f-falla');
  if (elFallaReset) {
    elFallaReset.readOnly = false;
    elFallaReset.style.background = '';
    elFallaReset.style.cursor = '';
  }
  
  const sectionEstado = document.getElementById('section-estado-orden');
  if (sectionEstado) {
    if (currentSession.viewMode === 'superadmin') {
      sectionEstado.style.display = 'block';
    } else {
      sectionEstado.style.display = 'none';
    }
  }
  
  if (!id) {
    document.getElementById('f-folio').value = generarFolioConsecutivo();
  }
  
  initDiasPanels();
  setRefacciones('utilizadas', []);
  setRefacciones('necesarias', []);
  
  const elSoporte = document.getElementById('f-soporte');
  if (elSoporte) {
    elSoporte.innerHTML = '<option value="">Ninguno</option>';
  }

  // Llenar combo de clientes para Orden de Servicio
  const fClienteOptions = document.getElementById('f-cliente-options');
  const fClienteHidden = document.getElementById('f-cliente');
  const fClienteDisplay = document.getElementById('f-cliente-display');
  
  if (fClienteOptions) {
    fClienteHidden.value = '';
    fClienteDisplay.textContent = 'Seleccionar cliente...';
    fClienteOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('f-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      fClienteOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('f-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (!o) return;
    const fields = ['folio','pedido','ubicacion','ubicacion-sitio','operador','eco','horometro','horometro-real',
      'modelo','serie','soporte','km-ida','km-vuelta','km-total',
      'falla','trabajos','dictamen','condiciones','observaciones','pendientes',
      'noches','alimentacion','traslado-costo'];
    
    // Checkbox especial
    const elReembolso = document.getElementById('f-reembolso-km');
    if (elReembolso) elReembolso.checked = !!o.reembolso_km;
    fields.forEach(f => {
      const el = document.getElementById('f-' + f);
      if (el && o[f.replace(/-/g,'_')] !== undefined) el.value = o[f.replace(/-/g,'_')];
    });
    
    if (o.cliente) {
      if (fClienteOptions) {
        selectComboOption('f-cliente', o.cliente, o.cliente, true); // true = isInitial
      } else {
        const elCliente = document.getElementById('f-cliente');
        if (elCliente) elCliente.value = o.cliente;
      }
    }
    poblarSoportesPorCliente(o.cliente, o.soporte);
    // tipo radio
    const radio = document.querySelector(`input[name="tipo"][value="${o.tipo}"]`);
    if (radio) radio.checked = true;
    // estado
    const sel = document.getElementById('f-estado');
    if (sel && o.estado) sel.value = o.estado;
    
    // Poblar tickets para la edición
    if (elSoporte && o.soporte) {
      const t = tickets.find(x => x.id === o.soporte);
      if (t && !Array.from(elSoporte.options).some(opt => opt.value === t.id)) {
        elSoporte.innerHTML += `<option value="${t.id}">${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}</option>`;
      }
      elSoporte.value = o.soporte;
    }
    
    // refacciones
    if (o.ref_utilizadas?.length) setRefacciones('utilizadas', o.ref_utilizadas);
    if (o.ref_necesarias?.length) setRefacciones('necesarias', o.ref_necesarias);
    // dias
    setDiasData(o.dias);
  } else {
    // Nueva Orden
    poblarSoportesPorCliente('');
    const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
    if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
  }
  
  // Los técnicos se extraen automáticamente del ticket al guardar
  const oSel = id ? ordenes.find(x => x.id === id) : null;
  poblarMaquinasCliente('f-equipo', '', oSel ? oSel.cliente : '');
  
  const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
  if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
  
  if (oSel && oSel.equipo) {
    oSel.equipo.split(', ').forEach(eqName => {
      if (eqName.trim() && window.agregarMaquinaChipOrden) {
        window.agregarMaquinaChipOrden(eqName.trim());
      }
    });
  }
  
  if (id) {
    const o = ordenes.find(x => x.id === id);
    if (o && o.soporte) {
      const elSoporte = document.getElementById('f-soporte');
      if (elSoporte) elSoporte.value = o.soporte;
    }
  }

  onSoporteChange(); // Sincroniza el pedido y metadata

  // Bloquear campos base si la orden viene de un ticket o si es técnico
  const isTecnico = currentSession.viewMode === 'tecnico';
  const soporteActual = document.getElementById('f-soporte').value;
  const lockFields = (isTecnico || soporteActual);

  const camposBloqueados = ['f-folio', 'f-pedido', 'f-ubicacion', 'f-modelo', 'f-serie', 'f-soporte', 'f-equipo'];
  camposBloqueados.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      if (el.tagName === 'SELECT') {
        el.disabled = !!lockFields;
      } else {
        el.readOnly = !!lockFields;
      }
      el.style.background = lockFields ? 'var(--bg-secondary)' : '';
    }
  });

  // Bloquear falla reportada si es técnico
  const elFalla = document.getElementById('f-falla');
  if (elFalla) {
    elFalla.readOnly = !!isTecnico;
    elFalla.style.background = isTecnico ? 'var(--bg-secondary)' : '';
    elFalla.style.cursor = isTecnico ? 'not-allowed' : '';
  }

  const fClienteCombo = document.getElementById('f-cliente-combo');
  if (fClienteCombo) {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    let lockCliente = false;
    let isCerrado = false;

    if (soporteActual) {
      const t = tickets.find(x => x.id === soporteActual);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      lockCliente = true; // Solo admins pueden editar la empresa
    } else {
      if (currentSession.viewMode === 'superadmin') {
        lockCliente = false; // Superadmin nunca se bloquea
      } else {
        lockCliente = isCerrado; // Admin se bloquea solo si el ticket asociado ya está cerrado
      }
    }

    fClienteCombo.style.pointerEvents = lockCliente ? 'none' : 'auto';
    fClienteCombo.style.background = lockCliente ? 'var(--bg-secondary)' : '';
  }
  
  document.querySelectorAll('input[name="tipo"]').forEach(radio => {
    radio.disabled = !!lockFields;
  });

  // ===== MODO REPORTE: bloquear campos de información general =====
  if (modoReporte) {
    // Campos de texto/number bloqueados (info general + km)
    const camposInfoGeneral = [
      'f-folio', 'f-pedido', 'f-ubicacion', 'f-eco',
      'f-horometro', 'f-modelo', 'f-serie',
      'f-km-total'
    ];
    camposInfoGeneral.forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.readOnly = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.cursor = 'not-allowed';
        el.style.opacity = '0.7';
      }
    });
    // Selects bloqueados
    ['f-soporte', 'f-equipo', 'f-estado'].forEach(f => {
      const el = document.getElementById(f);
      if (el) {
        el.disabled = true;
        el.style.background = 'var(--bg-secondary)';
        el.style.opacity = '0.7';
      }
    });
    // Combo cliente bloqueado
    const fClienteComboReporte = document.getElementById('f-cliente-combo');
    if (fClienteComboReporte) {
      fClienteComboReporte.style.pointerEvents = 'none';
      fClienteComboReporte.style.background = 'var(--bg-secondary)';
      fClienteComboReporte.style.opacity = '0.7';
    }
    // Radios de tipo bloqueados
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
      radio.disabled = true;
    });
    // Checkboxes de técnicos bloqueados
    document.querySelectorAll('input[name="f-tecnicos"]').forEach(cb => {
      cb.disabled = true;
    });
    // Banner visual en el header del modal
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.id = 'reporte-modo-banner';
      banner.style.cssText = 'border-left: 3px solid var(--accent, #e8850a); background: var(--bg-card); color: var(--text-secondary); padding: 0.55rem 0.9rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; border-radius: 0 4px 4px 0;';
      banner.innerHTML = '<i data-lucide="lock" style="width:14px;height:14px;flex-shrink:0;color:var(--accent,#e8850a);"></i><span>Solo puedes editar el diagnostico y trabajos. Para modificar los datos generales usa el boton <strong>Editar</strong> (lapiz).</span>';
      const modalBody = document.querySelector('#modal-form .modal-body');
      if (modalBody) modalBody.insertBefore(banner, modalBody.firstChild);
      if (window.lucide) window.lucide.createIcons({ root: banner });
    }
  } else {
    // Asegurarse de remover el banner si existe (al abrir en modo edición normal)
    const existingBanner = document.getElementById('reporte-modo-banner');
    if (existingBanner) existingBanner.remove();
  }

  // ===== Lógica de Autollenado de "Fecha de Servicio" desde PDF Extraído =====
  if (soporteActual) {
    window.autoFillFromPdfExtraction(soporteActual, !id);
  }

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function autoFillFromPdfExtraction(ticketId, force = false) {
  if (typeof document === 'undefined') return;
  if (!window.supabaseClient || !ticketId) return;

  const elNoches = document.getElementById('f-noches');
  const elAlimento = document.getElementById('f-alimentacion');
  
  const nocVal = elNoches ? elNoches.value : '';
  const isNewOrEmpty = force || (nocVal === '' || nocVal === '0');
  console.log('[Auto-fill PDF] Evaluando ticket_id:', ticketId, 'isNewOrEmpty:', isNewOrEmpty);
  
  if (isNewOrEmpty) {
    window.supabaseClient
      .from('pdf_extracciones_ai')
      .select('extras, conceptos')
      .eq('ticket_id', ticketId)
      .order('fecha_extraccion', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const ext = data[0].extras || [];
          const viajeData = ext.find(x => x.isViajeData);
          console.log('[Auto-fill PDF] Datos de logística encontrados:', viajeData);
          if (viajeData) {
            if (elNoches && (elNoches.value === '' || elNoches.value === '0')) {
               elNoches.value = viajeData.num_hospedaje || 0;
               console.log('[Auto-fill PDF] Llenado f-noches con:', viajeData.num_hospedaje);
            }
            if (elAlimento && (elAlimento.value === '' || elAlimento.value === '0')) {
               elAlimento.value = viajeData.num_alimento || 0;
               console.log('[Auto-fill PDF] Llenado f-alimentacion con:', viajeData.num_alimento);
            }
            const elTraslado = document.getElementById('f-traslado-costo');
            if (elTraslado && (elTraslado.value === '' || elTraslado.value === '0')) {
               elTraslado.value = viajeData.num_traslado || 0;
               console.log('[Auto-fill PDF] Llenado f-traslado-costo con:', viajeData.num_traslado);
            }
          }
          
          // Auto-check Reembolso KM
          const elReembolso = document.getElementById('f-reembolso-km');
          if (elReembolso) {
            const allItems = [...ext, ...(data[0].conceptos || [])];
            const hasReembolso = allItems.some(x => !x.isViajeData && x.descripcion && x.descripcion.toLowerCase().includes('reembolso') && x.descripcion.toLowerCase().includes('km'));
            if (hasReembolso) {
              elReembolso.checked = true;
              console.log('[Auto-fill PDF] Reembolso KM detectado y marcado.');
            }
          }
        } else {
           console.log('[Auto-fill PDF] No se encontró extracción en BD o hubo error', error);
        }
      })
      .catch(err => console.warn('[Auto-fill PDF] Error:', err));
  }
};

function onSoporteChange() {
  if (typeof document === 'undefined') return;
  const soporteId = document.getElementById('f-soporte').value;
  const inPedido = document.getElementById('f-pedido');
  const metaDiv = document.getElementById('soporte-meta');
  const inTecnico = document.getElementById('f-tecnico');
  
  if (soporteId) {
    const t = tickets.find(x => x.id === soporteId);
    if (t) {
      if (t.pedidoSAP) {
        inPedido.value = t.pedidoSAP;
        inPedido.readOnly = true;
        inPedido.style.background = 'var(--bg-secondary)';
      }
      metaDiv.innerHTML = `<i data-lucide="info" style="width:12px;height:12px;vertical-align:middle;"></i> <strong>Ticket ${t.folio}</strong> ligado &bull; Cotización SAP: ${t.cotizacionSAP || 'N/A'}`;
      metaDiv.style.display = 'block';
      
      const comboEquipo = document.getElementById('f-equipo');
      if (comboEquipo && t.equipo && (!editandoId || !comboEquipo.value)) {
        if (!Array.from(comboEquipo.options).some(o => o.value === t.equipo)) {
           const opt = document.createElement('option');
           opt.value = t.equipo;
           opt.textContent = `${t.equipo} (Del Ticket)`;
           let parsedSerie = '';
           if (t.equipo.includes('(SN: ')) {
             parsedSerie = t.equipo.split('(SN: ')[1].replace(')', '').trim();
           }
           opt.setAttribute('data-serie', parsedSerie);
           opt.setAttribute('data-modelo', t.equipo.split('(SN:')[0].trim());
           opt.setAttribute('data-ubicacion', t.sitio || '');
           comboEquipo.appendChild(opt);
        }
        comboEquipo.value = t.equipo;
        if (typeof onEquipoOrdenChange === 'function') onEquipoOrdenChange();
        
        // Si f-ubicacion sigue vacío, llenarlo con el sitio del ticket si existe
        const inUbicacion = document.getElementById('f-ubicacion');
        if (inUbicacion && !inUbicacion.value && t.sitio) {
          inUbicacion.value = t.sitio;
        }
      }
      
      const inHorometro = document.getElementById('f-horometro');
      if (inHorometro && t.horometro && (!editandoId || !inHorometro.value)) {
        inHorometro.value = t.horometro;
      }
      
      // Auto-fill logística and Reembolso KM from PDF
      window.autoFillFromPdfExtraction(t.id, true);
      
      // Técnicos se extraen en background durante el guardado
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } else {
    inPedido.value = '';
    inPedido.readOnly = false;
    inPedido.style.background = '';
    if (metaDiv) metaDiv.style.display = 'none';
  }
}

function editarOrden(id) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === id);
  if (o && (((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf)) && !['superadmin', 'admin'].includes(currentSession.viewMode)) {
    mostrarNotificacion('Esta orden ya fue firmada o cerrada en papel. Solo administradores pueden editarla.', 'error');
    return;
  }
  abrirFormulario(id);
}

function cerrarFormulario(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editandoId = null;
  // Limpiar banner de modo reporte si existe
  const banner = document.getElementById('reporte-modo-banner');
  if (banner) banner.remove();
}

function guardarOrdenes() {
  if (typeof document === 'undefined') return;
  // Ya no se guardan en localStorage
}

async function guardarOrden(e) {
  if (typeof document === 'undefined') return;
  e.preventDefault();
  
  const btnGuardar = document.querySelector('#modal-reporte button[type="submit"]') || e.target.querySelector('button[type="submit"]');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    if (!btnGuardar.dataset.originalText) btnGuardar.dataset.originalText = btnGuardar.textContent;
    btnGuardar.textContent = 'Guardando...';
  }

  const restoreBtn = () => {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = btnGuardar.dataset.originalText;
    }
  };

  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'Servicio';
  let tecnicosSeleccionados = [];
  const soporteIdGuardar = document.getElementById('f-soporte').value.trim();
  const oVieja = editandoId ? (ordenes.find(x => x.id === editandoId) || {}) : null;

  // VALIDACIÓN: Avisar si cambiaron los días de hospedaje/alimentos vs ticket extraído
  const inputNoches = Number(document.getElementById('f-noches')?.value || 0);
  const inputAlimentacion = Number(document.getElementById('f-alimentacion')?.value || 0);
  
  if (soporteIdGuardar && window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('pdf_extracciones_ai')
        .select('extras')
        .eq('ticket_id', soporteIdGuardar)
        .order('fecha_extraccion', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const ext = data[0].extras || [];
        const viajeData = ext.find(x => x.isViajeData);
        if (viajeData) {
          const extHospedaje = Number(viajeData.num_hospedaje || 0);
          const extAlimento = Number(viajeData.num_alimento || 0);
          
          let advertencias = [];
          if (inputNoches !== extHospedaje) {
            const dif = inputNoches - extHospedaje;
            const diffText = dif > 0 ? `+${dif}` : `${dif}`;
            advertencias.push(`- Noches/Hospedajes: Extraídas ${extHospedaje}, Capturadas ${inputNoches} (Cambio: ${diffText})`);
          }
          if (inputAlimentacion !== extAlimento) {
            const dif = inputAlimentacion - extAlimento;
            const diffText = dif > 0 ? `+${dif}` : `${dif}`;
            advertencias.push(`- Alimentos: Extraídos ${extAlimento}, Capturados ${inputAlimentacion} (Cambio: ${diffText})`);
          }
          
          if (advertencias.length > 0) {
            const msj = `⚠️ ADVERTENCIA DE VIÁTICOS ⚠️\n\nHas modificado los viáticos respecto a lo que se extrajo automáticamente del Ticket:\n\n${advertencias.join('\n')}\n\n¿Estás seguro de que deseas guardar la orden con estos valores modificados?`;
            if (!confirm(msj)) {
              restoreBtn();
              return; // Detiene el guardado
            } else {
               window._viaticosWarningToSave = `⚠️ Se modificaron los viáticos manualmente respecto a los extraídos del Ticket. ${advertencias.join(' | ')}`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Validation] Error al verificar viáticos:', err);
    }
  }

  if (oVieja && (oVieja.tecnicosAsignados?.length > 0 || oVieja.tecnico)) {
    tecnicosSeleccionados = oVieja.tecnicosAsignados || oVieja.tecnico.split(',').map(s => s.trim());
  } else if (soporteIdGuardar) {
    const t = tickets.find(x => x.id === soporteIdGuardar);
    if (t) {
      if (t.tecnicosAsignados && t.tecnicosAsignados.length > 0) {
        tecnicosSeleccionados = t.tecnicosAsignados;
      } else if (t.asignado && t.asignado !== 'Sin asignar') {
        tecnicosSeleccionados = t.asignado.split(',').map(s => s.trim());
      }
    }
  }

  // Si el usuario que guarda es técnico, nos aseguramos de que esté asignado a la orden
  if (currentSession.viewMode === 'tecnico') {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';
    if (miTecnicoNombre && !tecnicosSeleccionados.includes(miTecnicoNombre)) {
      tecnicosSeleccionados.push(miTecnicoNombre);
    }
  }

  let folioVal = document.getElementById('f-folio').value.trim();
  if (!editandoId && safeIsTestModeActive()) {
    if (folioVal && !folioVal.startsWith('[PRUEBA]')) {
      folioVal = `[PRUEBA] ${folioVal}`;
    }
  }

  let equipoVal = '';
  const chips = Array.from(document.querySelectorAll('#f-equipos-seleccionados .maquina-chip')).map(c => c.getAttribute('data-value'));
  if (chips.length > 0) {
    equipoVal = chips.join(', ');
  } else {
    equipoVal = document.getElementById('f-equipo')?.value || '';
  }

  if (!equipoVal) {
    mostrarNotificacion('Debe seleccionar al menos una máquina.', 'error');
    restoreBtn();
    return;
  }

  let marcasVal = '';
  let maquinariaId = null;
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const matchMaquina = (m, name) => {
    const cleanId = m.idInterno || m.id || '';
    const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
    const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
    const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
    const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
    return name === mName || name === cleanId || name === m.serie;
  };

  if (chips.length > 0) {
    const marcasArr = [];
    chips.forEach(cName => {
      let maq = null;
      clientesDb.forEach(c => {
        if (c.maquinas) {
          const found = c.maquinas.find(m => matchMaquina(m, cName));
          if (found) maq = found;
        }
      });
      if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, cName));
      if (maq) {
        if (maq.marca) marcasArr.push(maq.marca);
        if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
      }
    });
    marcasVal = [...new Set(marcasArr)].join(', ');
  } else {
    marcasVal = document.getElementById('f-equipo')?.options[document.getElementById('f-equipo')?.selectedIndex]?.getAttribute('data-marca') || '';
    maquinariaId = oVieja ? oVieja.maquinaria_id : null;
  }

  const autorActual = (typeof window.getCurrentUserDisplayName === 'function')
    ? window.getCurrentUserDisplayName()
    : ((typeof getCurrentUserDisplayName === 'function') ? getCurrentUserDisplayName() : (currentSession?.nombre || 'Usuario'));

  let autorCreador = autorActual;
  if (oVieja) {
    if (oVieja.creadoPor && String(oVieja.creadoPor).trim()) {
      autorCreador = String(oVieja.creadoPor).trim();
    } else if (oVieja.tecnico && String(oVieja.tecnico).trim()) {
      autorCreador = String(oVieja.tecnico).trim();
    }
  }

  const orden = {
    id: editandoId || folioVal,
    fecha: oVieja ? oVieja.fecha : getLocalDateString(),
    folio: folioVal,
    pedido: document.getElementById('f-pedido').value.trim(),
    cliente: document.getElementById('f-cliente').value.trim(),
    ubicacion: document.getElementById('f-ubicacion').value.trim(),
    ubicacion_sitio: document.getElementById('f-ubicacion-sitio').value.trim(),
    operador: document.getElementById('f-operador').value.trim(),
    eco: document.getElementById('f-eco').value.trim(),
    horometro: document.getElementById('f-horometro').value.trim(),
    horometro_real: document.getElementById('f-horometro-real').value.trim(),
    equipo: equipoVal,
    marca: marcasVal,
    maquinaria_id: maquinariaId,
    modelo: document.getElementById('f-modelo').value.trim(),
    serie: document.getElementById('f-serie').value.trim(),
    tecnico: tecnicosSeleccionados.join(', '),
    tecnicosAsignados: tecnicosSeleccionados,
    creadoPor: autorCreador,
    soporte: document.getElementById('f-soporte').value.trim(),
    km_ida: document.getElementById('f-km-ida').value,
    km_vuelta: document.getElementById('f-km-vuelta').value,
    km_total: document.getElementById('f-km-total').value,
    tipo,
    estado: document.getElementById('f-estado').value,
    falla: document.getElementById('f-falla').value.trim(),
    trabajos: document.getElementById('f-trabajos').value.trim(),
    dictamen: document.getElementById('f-dictamen').value.trim(),
    condiciones: document.getElementById('f-condiciones').value.trim(),
    observaciones: document.getElementById('f-observaciones').value.trim(),
    pendientes: document.getElementById('f-pendientes').value.trim(),
    ref_utilizadas: getRefacciones('utilizadas'),
    ref_necesarias: getRefacciones('necesarias'),
    factura_ref: '',
    factura_mo: '',
    noches: document.getElementById('f-noches').value,
    alimentacion: document.getElementById('f-alimentacion').value,
    traslado_costo: document.getElementById('f-traslado-costo').value,
    reembolso_km: document.getElementById('f-reembolso-km') ? document.getElementById('f-reembolso-km').checked : false,
    dias: getDiasData(),
    esPrueba: oVieja ? (oVieja.esPrueba || false) : safeIsTestModeActive(),
    evidencias: oVieja ? (oVieja.evidencias || { fotoInicio: null, fotoFin: null, adicionales: [] }) : { fotoInicio: null, fotoFin: null, adicionales: [] }
  };
  
  // VALIDACIÓN: Refacciones utilizadas obligatorias con foto (omitir si cantidad es 0)
  const refSinFoto = orden.ref_utilizadas.find(ref => !ref.fotoUrl && ref.descripcion && parseFloat(ref.cantidad || 0) > 0);
  if (refSinFoto) {
    if (currentSession.viewMode === 'tecnico') {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`Es obligatorio subir la fotografía para la refacción: ${refSinFoto.descripcion}`, 'error');
      }
      restoreBtn();
      return;
    } else {
      const continuar = confirm(`⚠️ Falta la fotografía para la refacción: ${refSinFoto.descripcion}.\n\n¿Estás seguro de que deseas guardar la orden sin esta evidencia fotográfica?`);
      if (!continuar) {
        restoreBtn();
        return;
      }
    }
  }

  // VALIDACIÓN: Justificación de discrepancia obligatoria
  const refConDiscrepanciaSinJustificar = orden.ref_utilizadas.find(ref => 
    ref.isFromPdf && 
    parseFloat(ref.cantidad || 0) !== parseFloat(ref.originalPdfCantidad || 0) && 
    (!ref.justificacion_discrepancia || !ref.justificacion_discrepancia.trim())
  );

  if (refConDiscrepanciaSinJustificar) {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Es obligatorio ingresar el motivo de la discrepancia para la refacción: ${refConDiscrepanciaSinJustificar.descripcion}`, 'error');
    } else {
      alert(`Es obligatorio ingresar el motivo de la discrepancia para la refacción: ${refConDiscrepanciaSinJustificar.descripcion}`);
    }
    restoreBtn();
    return;
  }

  if (oVieja) {
    orden.bitacora = oVieja.bitacora || [];
    orden.firma_tecnico_base64 = oVieja.firma_tecnico_base64;
    orden.firma_tecnico_nombre = oVieja.firma_tecnico_nombre;
    orden.firma_tecnico_fecha = oVieja.firma_tecnico_fecha;
    orden.firma_cliente_base64 = oVieja.firma_cliente_base64;
    orden.firma_cliente_nombre = oVieja.firma_cliente_nombre;
    orden.firma_cliente_fecha = oVieja.firma_cliente_fecha;
    orden.evidenciaBase64 = oVieja.evidenciaBase64 || oVieja.evidencia_base64;
  } else {
    orden.bitacora = [];
  }

  if (window._viaticosWarningToSave) {
    orden.bitacora.push({
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      tecnico: currentSession.viewMode === 'tecnico' ? (usuarios.find(u => u.id === currentSession.userId)?.nombre || 'Sistema') : 'Sistema',
      tipo: 'Aviso del Sistema',
      nota: window._viaticosWarningToSave
    });
    window._viaticosWarningToSave = null;
  }
  
  // Computar estado automático o manual si es superadmin
  if (currentSession.viewMode === 'superadmin') {
    orden.estado = document.getElementById('f-estado').value;
  } else {
    orden.estado = calcularEstadoOrden(orden);
    document.getElementById('f-estado').value = orden.estado; // update UI state
  }

  if (oVieja) {
    ordenes = ordenes.map(o => o.id === editandoId ? orden : o);
    if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) window.ordenes = window.ordenes.map(o => o.id === editandoId ? orden : o);
  } else {
    const existeEnOrdenes = ordenes.some(o => o && (o.id === orden.id || (o.folio && orden.folio && o.folio === orden.folio)));
    if (!existeEnOrdenes) {
      ordenes.unshift(orden);
    }
    if (typeof window !== 'undefined' && Array.isArray(window.ordenes) && window.ordenes !== ordenes) {
      const existeEnWin = window.ordenes.some(o => o && (o.id === orden.id || (o.folio && orden.folio && o.folio === orden.folio)));
      if (!existeEnWin) {
        window.ordenes.unshift(orden);
      }
    }
  }
  
  // Auto-cerrar el ticket relacionado
  if (orden.soporte) {
    const tIndex = tickets.findIndex(t => t.id === orden.soporte);
    if (tIndex >= 0 && tickets[tIndex].estado !== 'Cerrado') {
      tickets[tIndex].estado = 'Cerrado';
      safeSetJSON('sapi_tickets', tickets);
      if (window.supabaseClient) {
        window.pushToSupabase('tickets', tickets[tIndex]);
      }
      updateTicketBadge(); updateOrdenesBadge();
      if (typeof renderTickets === 'function') renderTickets();
    }
  }

  // Guardar siempre en local como respaldo
  safeSetJSON('sapi_ordenes', ordenes);

  if (window.supabaseClient) {
    window.pushToSupabase('ordenes', orden);
  }
  
  if (typeof window.crearOActualizarTicketRefacciones === 'function') {
    try {
      await window.crearOActualizarTicketRefacciones(orden);
    } catch (err) {
      console.error('[App] Error al generar/actualizar el ticket de refacciones:', err);
    }
  }
  if (window.trackTelemetryEvent) {
    let act = editandoId ? 'Edición de Orden' : 'Creación de Orden';
    if (editandoId && currentSession.viewMode === 'tecnico') {
      act = 'Llenado de Orden (Técnico)';
    }
    window.trackTelemetryEvent(act, { folio: orden.folio, cliente: orden.cliente });
  }
  
  restoreBtn();
  cerrarFormulario();
  renderTabla();
  renderTabla('servicios');
  renderStats();
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}

// ===== ELIMINAR =====
async function eliminarOrden(id) {
  if (typeof document === 'undefined') return;
  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Orden de Servicio',
    mensaje: '¿Estás seguro de que deseas eliminar esta orden de servicio?',
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;
  const o = ordenes.find(x => x.id === id);
  const folio = o ? o.folio : 'Desconocido';

  ordenes = ordenes.filter(o => o.id !== id);
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) window.ordenes = window.ordenes.filter(o => o.id !== id);
  safeSetJSON('sapi_ordenes', ordenes);
  
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('ordenes', id);
  }
  if (window.trackTelemetryEvent) {
    window.trackTelemetryEvent('Eliminación de Orden', { id, folio });
  }
  renderTabla();
  renderTabla('servicios');
  renderStats();
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}

function completarReporteDesdeDetalle(id) {
  if (typeof document === 'undefined') return;
  cerrarDetalle();
  setTimeout(() => {
    abrirFormulario(id, true); // true = modoReporte: solo permite editar el reporte técnico
  }, 100);
}


  var exports = {
    DIAS: DIAS,
    editandoId: editandoId,
    initDiasPanels: initDiasPanels,
    calcularHorasDia: calcularHorasDia,
    autoCompletarFechas: autoCompletarFechas,
    selDia: selDia,
    calcKmTotal: calcKmTotal,
    getDiasData: getDiasData,
    setDiasData: setDiasData,
    generarFolioConsecutivo: generarFolioConsecutivo,
    abrirFormulario: abrirFormulario,
    autoFillFromPdfExtraction: autoFillFromPdfExtraction,
    onSoporteChange: onSoporteChange,
    editarOrden: editarOrden,
    cerrarFormulario: cerrarFormulario,
    guardarOrdenes: guardarOrdenes,
    guardarOrden: guardarOrden,
    eliminarOrden: eliminarOrden,
    completarReporteDesdeDetalle: completarReporteDesdeDetalle
  };

  if (typeof window !== "undefined") {
    window.DIAS = DIAS;
    window.editandoId = editandoId;
    window.initDiasPanels = initDiasPanels;
    window.calcularHorasDia = calcularHorasDia;
    window.autoCompletarFechas = autoCompletarFechas;
    window.selDia = selDia;
    window.calcKmTotal = calcKmTotal;
    window.getDiasData = getDiasData;
    window.setDiasData = setDiasData;
    window.generarFolioConsecutivo = generarFolioConsecutivo;
    window.abrirFormulario = abrirFormulario;
    window.autoFillFromPdfExtraction = autoFillFromPdfExtraction;
    window.onSoporteChange = onSoporteChange;
    window.editarOrden = editarOrden;
    window.cerrarFormulario = cerrarFormulario;
    window.guardarOrdenes = guardarOrdenes;
    window.guardarOrden = guardarOrden;
    window.eliminarOrden = eliminarOrden;
    window.completarReporteDesdeDetalle = completarReporteDesdeDetalle;
    window.OrdenesForm = exports;
  }

  return exports;
});
