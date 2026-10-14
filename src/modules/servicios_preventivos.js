/**
 * Módulo de Servicios Preventivos en Rentas - Eurorep / SAPI
 * Control de mantenimiento preventivo, horario de entrada/salida,
 * bitácora diaria, técnico/operador, quién paga el servicio, control de refacciones
 * y operación 100% offline para móviles y tablets.
 */

(function() {
  'use strict';

  let currentSPFilter = 'todos';
  let servicioEnEdicionId = null;
  let spFotosAdjuntas = [];

  // Variables para firmas táctiles
  let canvasOp = null;
  let ctxOp = null;
  let dibujandoOp = false;
  let canvasCli = null;
  let ctxCli = null;
  let dibujandoCli = false;

  // Inicializar almacenamiento local y memoria
  window.serviciosPreventivos = window.serviciosPreventivos || [];
  try {
    const stored = localStorage.getItem('sapi_servicios_preventivos');
    if (stored) {
      window.serviciosPreventivos = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[ServiciosPreventivos] Error al cargar sapi_servicios_preventivos:', e);
  }

  /**
   * Cambiar entre subpestañas de Rentas: Contratos vs Servicios Preventivos
   */
  window.cambiarSubTabRentas = function(subtab) {
    const btnContratos = document.getElementById('tab-rentas-contratos-btn');
    const btnPreventivos = document.getElementById('tab-rentas-preventivos-btn');
    const contContratos = document.getElementById('rentas-subtab-contratos');
    const contPreventivos = document.getElementById('rentas-subtab-preventivos');

    if (subtab === 'preventivos') {
      if (btnContratos) {
        btnContratos.classList.remove('active');
        btnContratos.style.borderBottomColor = 'transparent';
        btnContratos.style.color = 'var(--text-secondary)';
      }
      if (btnPreventivos) {
        btnPreventivos.classList.add('active');
        btnPreventivos.style.borderBottomColor = 'var(--accent, #E8820C)';
        btnPreventivos.style.color = 'var(--accent, #E8820C)';
      }
      if (contContratos) contContratos.style.display = 'none';
      if (contPreventivos) contPreventivos.style.display = 'block';

      window.renderServiciosPreventivos();
    } else {
      if (btnPreventivos) {
        btnPreventivos.classList.remove('active');
        btnPreventivos.style.borderBottomColor = 'transparent';
        btnPreventivos.style.color = 'var(--text-secondary)';
      }
      if (btnContratos) {
        btnContratos.classList.add('active');
        btnContratos.style.borderBottomColor = 'var(--accent, #E8820C)';
        btnContratos.style.color = 'var(--accent, #E8820C)';
      }
      if (contPreventivos) contPreventivos.style.display = 'none';
      if (contContratos) contContratos.style.display = 'block';

      if (typeof window.renderRentas === 'function') {
        window.renderRentas();
      }
    }

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Formatear moneda MXN
   */
  function formatMoney(num) {
    const val = parseFloat(num) || 0;
    return '$' + val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Obtener badge visual según quién paga el servicio
   */
  window.obtenerBadgePagadorSP = function(pagador) {
    switch (String(pagador || '').toLowerCase()) {
      case 'cliente':
        return '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:700;"><i data-lucide="file-text" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Facturable Cliente</span>';
      case 'eurorep':
        return '<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:700;"><i data-lucide="wrench" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Cubierto Eurorep</span>';
      case 'garantia':
        return '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:700;"><i data-lucide="award" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Garantía Fabricante</span>';
      case 'compartido':
        return '<span class="badge" style="background:rgba(139,92,246,0.15);color:#8b5cf6;border:1px solid rgba(139,92,246,0.3);font-weight:700;"><i data-lucide="split" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Compartido / Otro</span>';
      default:
        return `<span class="badge badge-secondary">${pagador || 'No asignado'}</span>`;
    }
  };

  /**
   * Obtener badge visual según el estado del equipo
   */
  window.obtenerBadgeEstadoEquipoSP = function(estado) {
    switch (estado) {
      case 'Operativo':
        return '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:600;">🟢 Operativo</span>';
      case 'Operativo con Observaciones':
        return '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:600;">🟡 Con Obs.</span>';
      case 'Fuera de Servicio':
        return '<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:600;">🔴 Fuera de Servicio</span>';
      default:
        return `<span class="badge badge-secondary">${estado || 'Operativo'}</span>`;
    }
  };

  /**
   * Cambiar filtro rápido de servicios preventivos
   */
  window.setFiltroServiciosPreventivos = function(filtro) {
    currentSPFilter = filtro;
    document.querySelectorAll('.sp-filter-pill').forEach(btn => {
      if (btn.dataset.filtro === filtro) {
        btn.classList.add('active');
        btn.style.background = 'var(--accent, #E8820C)';
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
      }
    });
    window.renderServiciosPreventivos();
  };

  /**
   * Debounce para búsqueda en tiempo real
   */
  let debounceTimeoutSP = null;
  window.debouncedRenderServiciosPreventivos = function() {
    clearTimeout(debounceTimeoutSP);
    debounceTimeoutSP = setTimeout(() => {
      window.renderServiciosPreventivos();
    }, 200);
  };

  /**
   * Calcular diferencia en horas entre hora de entrada y salida
   */
  window.recalcularHorasTrabajadasSP = function() {
    const hIn = document.getElementById('sp-hora-entrada')?.value;
    const hOut = document.getElementById('sp-hora-salida')?.value;
    const badge = document.getElementById('sp-horas-calculadas-badge');

    if (!hIn || !hOut) {
      if (badge) badge.textContent = 'Horas Servicio: 0.0 hrs';
      return 0;
    }

    const [inH, inM] = hIn.split(':').map(Number);
    const [outH, outM] = hOut.split(':').map(Number);

    let minIn = inH * 60 + inM;
    let minOut = outH * 60 + outM;

    // Si la salida es menor a la entrada, asumimos cruce de medianoche
    if (minOut < minIn) {
      minOut += 24 * 60;
    }

    const diffMin = Math.max(0, minOut - minIn);
    const diffHoras = Math.round((diffMin / 60) * 100) / 100;

    if (badge) {
      badge.textContent = `Horas Servicio: ${diffHoras.toFixed(1)} hrs`;
    }
    return diffHoras;
  };

  /**
   * Botón táctil para fijar la hora actual (HH:MM)
   */
  window.fijarHoraActualSP = function(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    input.value = `${hh}:${mm}`;
    window.recalcularHorasTrabajadasSP();
  };

  /**
   * Sugerir próximo horómetro sumando intervalo según tipo de preventivo
   */
  window.calcularProximoHorometroSP = function() {
    const horometroInput = document.getElementById('sp-horometro');
    const proximoInput = document.getElementById('sp-proximo-horometro');
    const tipo = document.getElementById('sp-tipo-mantenimiento')?.value || '250h';

    if (!horometroInput || !proximoInput) return;
    const horo = parseFloat(horometroInput.value);
    if (isNaN(horo) || horo < 0) return;

    let delta = 250;
    if (tipo === '500h') delta = 500;
    else if (tipo === '1000h') delta = 1000;
    else if (tipo === '2000h') delta = 2000;

    proximoInput.value = (horo + delta).toFixed(1);
  };

  /**
   * Plantillas de Checklist interactivo
   */
  const CHECKLIST_TEMPLATES = {
    '250h': [
      { id: 'aceite_motor', label: 'Cambio / Nivel de Aceite de Motor' },
      { id: 'filtro_aceite', label: 'Reemplazo de Filtro de Aceite de Motor' },
      { id: 'filtro_combustible', label: 'Revisión / Cambio Filtro Combustible' },
      { id: 'filtro_aire', label: 'Limpieza / Inspección Filtro de Aire' },
      { id: 'refrigerante', label: 'Inspección de Nivel de Refrigerante y Mangueras' },
      { id: 'baterias', label: 'Verificación de Bornes y Carga de Baterías' },
      { id: 'engrase', label: 'Engrase General de Articulaciones y Bujes' },
      { id: 'fugas', label: 'Inspección Visual de Fugas Hidráulicas / Motor' },
      { id: 'seguridad', label: 'Prueba de Paro de Emergencia y Luces' }
    ],
    '500h': [
      { id: 'aceite_motor', label: 'Cambio de Aceite de Motor' },
      { id: 'filtro_aceite', label: 'Reemplazo de Filtro de Aceite' },
      { id: 'filtro_combustible', label: 'Reemplazo de Filtro Combustible y Separador' },
      { id: 'filtro_aire', label: 'Cambio de Filtro de Aire Primario' },
      { id: 'filtro_hidraulico', label: 'Reemplazo Filtro Hidráulico de Retorno' },
      { id: 'radiador', label: 'Soplado y Limpieza de Radiador / Post-enfriador' },
      { id: 'bandas', label: 'Ajuste e Inspección de Tensión de Bandas' },
      { id: 'frenos', label: 'Prueba Operativa de Frenos y Dirección' },
      { id: 'engrase', label: 'Engrase Integral de Chasis y Accesorios' }
    ],
    '1000h': [
      { id: 'aceite_motor', label: 'Cambio de Aceite de Motor' },
      { id: 'todos_filtros', label: 'Reemplazo de TODOS los Filtros (Aire, Aceite, Comb, Hidr)' },
      { id: 'aceite_hidraulico', label: 'Cambio / Análisis de Aceite Hidráulico' },
      { id: 'transmision', label: 'Revisión y Nivel de Aceite de Mandos Finales / Transmisión' },
      { id: 'refrigerante', label: 'Drenado y Reemplazo de Refrigerante' },
      { id: 'torque', label: 'Torque de Pernos de Montaje y Ruedas / Orugas' },
      { id: 'calibracion', label: 'Calibración y Presión de Sistema Hidráulico' },
      { id: 'seguridad_completa', label: 'Inspección Integral de Seguridad y Alarma Retroceso' }
    ],
    '2000h': [
      { id: 'overhaul_filtros', label: 'Mantenimiento Mayor Integral (Todos los Fluidos)' },
      { id: 'inyectores', label: 'Inspección y Limpieza de Inyectores / Bomba' },
      { id: 'valvulas', label: 'Ajuste de Luz de Válvulas de Motor' },
      { id: 'mandos_finales', label: 'Cambio de Aceite Mandos Finales y Diferenciales' },
      { id: 'hidrostatico', label: 'Prueba Hidrostática y Rendimiento de Bombas' },
      { id: 'estructural', label: 'Revisión Estructural de Fisuras y Soldaduras' }
    ],
    'inspeccion': [
      { id: 'inspec_niveles', label: 'Niveles de Fluidos (Motor, Hidráulico, Agua)' },
      { id: 'inspec_fugas', label: 'Revisión de Fugas y Derrames en Obra' },
      { id: 'inspec_mandos', label: 'Mandos y Controles de la Cabina' },
      { id: 'inspec_horometro', label: 'Verificación de Horómetro y Odómetro' },
      { id: 'inspec_limpieza', label: 'Limpieza y Aseo General de la Máquina' }
    ],
    'otro': [
      { id: 'rev_general', label: 'Revisión General del Sistema' },
      { id: 'pruebas_operacion', label: 'Pruebas de Operación y Carga' },
      { id: 'bitacora_personalizada', label: 'Servicio Específico según Bitácora' }
    ]
  };

  /**
   * Generar checkboxes para el checklist interactivo
   */
  window.generarChecklistActividadesSP = function(actividadesExistentes = null) {
    const container = document.getElementById('sp-checklist-container');
    if (!container) return;

    const tipo = document.getElementById('sp-tipo-mantenimiento')?.value || '250h';
    const items = CHECKLIST_TEMPLATES[tipo] || CHECKLIST_TEMPLATES['250h'];

    const existMap = {};
    if (Array.isArray(actividadesExistentes)) {
      actividadesExistentes.forEach(a => {
        if (a && a.id) existMap[a.id] = a.completado;
      });
    }

    container.innerHTML = items.map(it => {
      const isChecked = actividadesExistentes ? !!existMap[it.id] : false;
      return `
        <label class="sp-check-item" style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 6px; cursor: pointer; user-select: none; font-size: 0.8rem; line-height: 1.3; background: var(--bg-primary);">
          <input type="checkbox" class="sp-checklist-input" data-id="${it.id}" data-label="${it.label}" ${isChecked ? 'checked' : ''} style="margin-top: 2px; accent-color: var(--accent); transform: scale(1.15);" />
          <span style="color: var(--text-primary);">${it.label}</span>
        </label>
      `;
    }).join('');

    window.calcularProximoHorometroSP();
  };

  /**
   * Agregar fila a la tabla dinámica de refacciones
   */
  window.agregarFilaRefaccionSP = function(datos = null) {
    const tbody = document.getElementById('sp-refacciones-tbody');
    if (!tbody) return;

    const rowId = 'ref_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const dClave = datos?.clave || '';
    const dDesc = datos?.descripcion || '';
    const dCant = (datos?.cantidad != null) ? datos.cantidad : 1;
    const dUnidad = datos?.unidad || 'Pza';
    const dCosto = (datos?.costo_unitario != null) ? datos.costo_unitario : 0;
    const dSubtotal = (parseFloat(dCant) * parseFloat(dCosto)) || 0;
    const dPagador = datos?.pagado_por || document.querySelector('input[name="sp_pagado_por"]:checked')?.value || 'cliente';

    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding: 0.4rem 0.5rem;">
        <input type="text" class="sp-ref-clave" value="${dClave}" placeholder="Clave" oninput="window.autocompletarRefaccionSP('${rowId}')" list="datalist-refacciones-claves" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.78rem; font-family: var(--font-mono, monospace);" />
      </td>
      <td style="padding: 0.4rem 0.5rem;">
        <input type="text" class="sp-ref-desc" value="${dDesc}" placeholder="Descripción de la pieza / filtro / lubricante" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.78rem;" />
      </td>
      <td style="padding: 0.4rem 0.5rem;">
        <input type="number" class="sp-ref-cant" value="${dCant}" min="0.1" step="0.5" oninput="window.recalcularTotalesServicioPreventivo()" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.78rem;" />
      </td>
      <td style="padding: 0.4rem 0.5rem;">
        <select class="sp-ref-unidad" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.78rem;">
          <option value="Pza" ${dUnidad === 'Pza' ? 'selected' : ''}>Pza</option>
          <option value="Lts" ${dUnidad === 'Lts' ? 'selected' : ''}>Lts</option>
          <option value="Kit" ${dUnidad === 'Kit' ? 'selected' : ''}>Kit</option>
          <option value="Jgo" ${dUnidad === 'Jgo' ? 'selected' : ''}>Jgo</option>
          <option value="Cub" ${dUnidad === 'Cub' ? 'selected' : ''}>Cubeta</option>
          <option value="Serv" ${dUnidad === 'Serv' ? 'selected' : ''}>Serv</option>
        </select>
      </td>
      <td style="padding: 0.4rem 0.5rem;">
        <input type="number" class="sp-ref-costo" value="${dCosto}" min="0" step="10" oninput="window.recalcularTotalesServicioPreventivo()" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.78rem;" />
      </td>
      <td style="padding: 0.4rem 0.5rem; font-weight: 700; color: #10b981;">
        <span class="sp-ref-subtotal-label">${formatMoney(dSubtotal)}</span>
      </td>
      <td style="padding: 0.4rem 0.5rem;">
        <select class="sp-ref-pagador" style="width: 100%; padding: 0.35rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 0.75rem;">
          <option value="cliente" ${dPagador === 'cliente' ? 'selected' : ''}>Cliente</option>
          <option value="eurorep" ${dPagador === 'eurorep' ? 'selected' : ''}>Eurorep</option>
          <option value="garantia" ${dPagador === 'garantia' ? 'selected' : ''}>Garantía</option>
        </select>
      </td>
      <td style="padding: 0.4rem 0.5rem; text-align: center;">
        <button type="button" onclick="document.getElementById('${rowId}')?.remove(); window.recalcularTotalesServicioPreventivo();" title="Eliminar fila" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 0.2rem 0.4rem; font-size: 1rem;">✕</button>
      </td>
    `;

    tbody.appendChild(tr);
    window.recalcularTotalesServicioPreventivo();
  };

  /**
   * Autocompletar refacción desde catálogo si existe
   */
  window.autocompletarRefaccionSP = function(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const claveVal = tr.querySelector('.sp-ref-clave')?.value?.trim().toUpperCase();
    if (!claveVal) return;

    // Buscar en refacciones globales
    const refs = (typeof window.refaccionesGlobales !== 'undefined' && Array.isArray(window.refaccionesGlobales)) ? window.refaccionesGlobales : [];
    const match = refs.find(r => r && (r.codigo === claveVal || r.clave === claveVal || r.id === claveVal));
    if (match) {
      const descInput = tr.querySelector('.sp-ref-desc');
      const costoInput = tr.querySelector('.sp-ref-costo');
      if (descInput && !descInput.value) descInput.value = match.nombre || match.descripcion || '';
      if (costoInput && (!costoInput.value || Number(costoInput.value) === 0)) {
        costoInput.value = match.costo || match.precio || match.precio_unitario || 0;
      }
      window.recalcularTotalesServicioPreventivo();
    }
  };

  /**
   * Recalcular total de refacciones y gran total del servicio
   */
  window.recalcularTotalesServicioPreventivo = function() {
    let totalRef = 0;
    const rows = document.querySelectorAll('#sp-refacciones-tbody tr');

    rows.forEach(tr => {
      const cant = parseFloat(tr.querySelector('.sp-ref-cant')?.value) || 0;
      const costo = parseFloat(tr.querySelector('.sp-ref-costo')?.value) || 0;
      const sub = cant * costo;
      totalRef += sub;
      const subLabel = tr.querySelector('.sp-ref-subtotal-label');
      if (subLabel) subLabel.textContent = formatMoney(sub);
    });

    const totalRefLabel = document.getElementById('sp-refacciones-total-label');
    if (totalRefLabel) totalRefLabel.textContent = formatMoney(totalRef);

    const manoObra = parseFloat(document.getElementById('sp-monto-mano-obra')?.value) || 0;
    const granTotal = totalRef + manoObra;

    const granTotalLabel = document.getElementById('sp-gran-total-label');
    if (granTotalLabel) granTotalLabel.textContent = formatMoney(granTotal);

    return { totalRef, manoObra, granTotal };
  };

  /**
   * Sincronizar pagador seleccionado con las refacciones agregadas
   */
  window.alCambiarPagadorServicioPreventivo = function() {
    const pagador = document.querySelector('input[name="sp_pagado_por"]:checked')?.value || 'cliente';
    document.querySelectorAll('#sp-refacciones-tbody .sp-ref-pagador').forEach(sel => {
      sel.value = pagador;
    });
  };

  /**
   * Manejar cambio de renta seleccionada en el combo
   */
  window.alCambiarRentaEnServicioPreventivo = function() {
    const rId = document.getElementById('sp-renta-id')?.value;
    const renta = (window.rentas || []).find(r => r && (r.id === rId || r.folio === rId));

    if (!renta) return;

    const cliInput = document.getElementById('sp-cliente');
    const sitioInput = document.getElementById('sp-sitio');
    const eqInput = document.getElementById('sp-equipo');
    const serInput = document.getElementById('sp-serie');
    const horoInput = document.getElementById('sp-horometro');

    if (cliInput) cliInput.value = renta.cliente || '';
    if (sitioInput) sitioInput.value = renta.sitio || '';
    if (eqInput) eqInput.value = renta.equipo || '';
    if (serInput) serInput.value = renta.serie || '';
    if (horoInput && (!horoInput.value || Number(horoInput.value) === 0)) {
      horoInput.value = (renta.horometro_final != null) ? renta.horometro_final : (renta.horometro_inicial || 0);
      window.calcularProximoHorometroSP();
    }
  };

  /**
   * Configurar los canvas táctiles de firmas
   */
  function inicializarCanvasesFirmas() {
    canvasOp = document.getElementById('sp-canvas-firma-operador');
    canvasCli = document.getElementById('sp-canvas-firma-cliente');

    if (canvasOp) {
      ctxOp = canvasOp.getContext('2d');
      setupCanvasListeners(canvasOp, ctxOp, () => dibujandoOp, v => { dibujandoOp = v; });
    }
    if (canvasCli) {
      ctxCli = canvasCli.getContext('2d');
      setupCanvasListeners(canvasCli, ctxCli, () => dibujandoCli, v => { dibujandoCli = v; });
    }
  }

  function setupCanvasListeners(canvas, ctx, getDibujando, setDibujando) {
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches && e.touches[0]) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      e.preventDefault();
      setDibujando(true);
      const pos = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function moveDraw(e) {
      if (!getDibujando()) return;
      e.preventDefault();
      const pos = getCoords(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    function stopDraw(e) {
      if (getDibujando()) {
        e.preventDefault();
        setDibujando(false);
      }
    }

    canvas.onmousedown = startDraw;
    canvas.onmousemove = moveDraw;
    window.addEventListener('mouseup', stopDraw);

    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = moveDraw;
    canvas.ontouchend = stopDraw;
  }

  window.limpiarFirmaOperadorSP = function() {
    if (canvasOp && ctxOp) {
      ctxOp.clearRect(0, 0, canvasOp.width, canvasOp.height);
    }
  };

  window.limpiarFirmaClienteSP = function() {
    if (canvasCli && ctxCli) {
      ctxCli.clearRect(0, 0, canvasCli.width, canvasCli.height);
    }
  };

  /**
   * Manejo de subida de fotos (Cámara / Galería)
   */
  window.manejarSubidaFotosSP = function(event) {
    const files = event.target.files;
    if (!files || !files.length) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const base64 = e.target.result;
        spFotosAdjuntas.push({
          id: 'foto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          url: base64,
          nombre: file.name || 'Evidencia'
        });
        renderGaleriaFotosSP();
      };
      reader.readAsDataURL(file);
    });
  };

  function renderGaleriaFotosSP() {
    const container = document.getElementById('sp-galeria-fotos');
    if (!container) return;

    if (!spFotosAdjuntas.length) {
      container.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Sin fotos adjuntas aún.</span>';
      return;
    }

    container.innerHTML = spFotosAdjuntas.map((f, i) => `
      <div style="position: relative; width: 70px; height: 70px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);">
        <img src="${f.url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto ${i+1}" />
        <button type="button" onclick="window.eliminarFotoSP(${i})" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
    `).join('');
  }

  window.eliminarFotoSP = function(index) {
    spFotosAdjuntas.splice(index, 1);
    renderGaleriaFotosSP();
  };

  /**
   * Poblar selector de rentas en el modal
   */
  function poblarRentasDropdownSP(selectedRentaId = null) {
    const select = document.getElementById('sp-renta-id');
    if (!select) return;

    const rentas = (window.rentas || []).filter(r => r && r.estado !== 'Cancelada');
    select.innerHTML = '<option value="">-- Seleccionar Renta Activa --</option>' +
      rentas.map(r => {
        const sel = (r.id === selectedRentaId || r.folio === selectedRentaId) ? 'selected' : '';
        return `<option value="${r.id}" ${sel}>${r.folio || 'REN'} - ${r.cliente || 'Sin Cliente'} (${r.equipo || 'Maquinaria'})</option>`;
      }).join('');
  }

  /**
   * Poblar datalist de técnicos
   */
  function poblarTecnicosDatalistSP() {
    const datalist = document.getElementById('sp-lista-tecnicos-datalist');
    if (!datalist) return;

    const tecs = new Set();
    if (Array.isArray(window.tecnicos)) {
      window.tecnicos.forEach(t => {
        if (typeof t === 'string') tecs.add(t);
        else if (t && t.nombre) tecs.add(t.nombre);
      });
    }
    if (Array.isArray(window.USUARIOS)) {
      window.USUARIOS.forEach(u => {
        if (u && u.nombre) tecs.add(u.nombre);
      });
    }

    datalist.innerHTML = Array.from(tecs).map(nombre => `<option value="${nombre}"></option>`).join('');
  }

  /**
   * Abrir modal de Servicio Preventivo (Nuevo o Editar)
   */
  window.abrirModalServicioPreventivo = function(options = {}) {
    const overlay = document.getElementById('modal-servicio-preventivo-overlay');
    if (!overlay) return;

    servicioEnEdicionId = options.id || null;
    spFotosAdjuntas = [];

    // Limpiar campos
    document.getElementById('sp-id').value = servicioEnEdicionId || '';
    document.getElementById('modal-sp-title').textContent = servicioEnEdicionId ? 'Editar Servicio Preventivo' : 'Nuevo Servicio Preventivo';
    
    // Poblar combos
    poblarRentasDropdownSP(options.rentaId || null);
    poblarTecnicosDatalistSP();

    // Valores por defecto
    const hoy = new Date().toISOString().substring(0, 10);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    document.getElementById('sp-fecha').value = hoy;
    document.getElementById('sp-hora-entrada').value = `${hh}:${mm}`;
    document.getElementById('sp-hora-salida').value = '';
    document.getElementById('sp-monto-mano-obra').value = '0';
    document.getElementById('sp-justificacion-pago').value = '';
    document.getElementById('sp-numero-factura-sap').value = '';
    document.getElementById('sp-horometro').value = '';
    document.getElementById('sp-proximo-horometro').value = '';
    document.getElementById('sp-operador-nombre').value = '';
    document.getElementById('sp-supervisor').value = '';
    document.getElementById('sp-bitacora-notas').value = '';
    document.getElementById('sp-nombre-recibe').value = '';
    document.getElementById('sp-estado-equipo').value = 'Operativo';
    document.getElementById('sp-tipo-operador').value = 'eurorep';
    document.getElementById('sp-tipo-mantenimiento').value = '250h';

    // Limpiar tabla refacciones
    const tbody = document.getElementById('sp-refacciones-tbody');
    if (tbody) tbody.innerHTML = '';

    // Si es edición, cargar datos existentes
    if (servicioEnEdicionId) {
      const sp = (window.serviciosPreventivos || []).find(x => x.id === servicioEnEdicionId);
      if (sp) {
        document.getElementById('modal-sp-folio-badge').textContent = sp.folio || 'SP-EDIT';
        document.getElementById('sp-renta-id').value = sp.renta_id || '';
        document.getElementById('sp-cliente').value = sp.cliente || '';
        document.getElementById('sp-sitio').value = sp.sitio || '';
        document.getElementById('sp-equipo').value = sp.equipo || '';
        document.getElementById('sp-serie').value = sp.serie || '';
        document.getElementById('sp-fecha').value = sp.fecha_servicio || hoy;
        document.getElementById('sp-hora-entrada').value = sp.hora_entrada || '';
        document.getElementById('sp-hora-salida').value = sp.hora_salida || '';
        document.getElementById('sp-monto-mano-obra').value = sp.monto_mano_obra || 0;
        document.getElementById('sp-justificacion-pago').value = sp.justificacion_pago || '';
        document.getElementById('sp-numero-factura-sap').value = sp.numero_factura_sap || '';
        document.getElementById('sp-horometro').value = sp.horometro_servicio || '';
        document.getElementById('sp-proximo-horometro').value = sp.proximo_servicio_horometro || '';
        document.getElementById('sp-operador-nombre').value = sp.operador_nombre || '';
        document.getElementById('sp-supervisor').value = sp.supervisor_responsable || '';
        document.getElementById('sp-bitacora-notas').value = sp.bitacora_notas || '';
        document.getElementById('sp-nombre-recibe').value = sp.nombre_recibe || '';
        document.getElementById('sp-estado-equipo').value = sp.estado_equipo || 'Operativo';
        document.getElementById('sp-tipo-operador').value = sp.tipo_operador || 'eurorep';
        document.getElementById('sp-tipo-mantenimiento').value = sp.tipo_mantenimiento || '250h';

        // Radio pagador
        const pagadorVal = sp.pagado_por || 'cliente';
        const radioP = document.querySelector(`input[name="sp_pagado_por"][value="${pagadorVal}"]`);
        if (radioP) radioP.checked = true;

        // Refacciones
        if (Array.isArray(sp.refacciones)) {
          sp.refacciones.forEach(r => window.agregarFilaRefaccionSP(r));
        }

        // Fotos
        if (Array.isArray(sp.evidencias)) {
          spFotosAdjuntas = [...sp.evidencias];
        }

        window.generarChecklistActividadesSP(sp.checklist_actividades);
      }
    } else {
      document.getElementById('modal-sp-folio-badge').textContent = 'SP-AUTO';
      const radioCliente = document.querySelector('input[name="sp_pagado_por"][value="cliente"]');
      if (radioCliente) radioCliente.checked = true;

      // Si viene con renta preseleccionada
      if (options.rentaId) {
        document.getElementById('sp-renta-id').value = options.rentaId;
        window.alCambiarRentaEnServicioPreventivo();
      }

      window.generarChecklistActividadesSP();
    }

    renderGaleriaFotosSP();
    window.recalcularHorasTrabajadasSP();
    window.recalcularTotalesServicioPreventivo();

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Inicializar canvas después de mostrar modal para que tome dimensiones correctas
    setTimeout(() => {
      inicializarCanvasesFirmas();
      window.limpiarFirmaOperadorSP();
      window.limpiarFirmaClienteSP();

      // Cargar firmas previas si existen
      if (servicioEnEdicionId) {
        const sp = (window.serviciosPreventivos || []).find(x => x.id === servicioEnEdicionId);
        if (sp) {
          if (sp.firma_operador && canvasOp && ctxOp) {
            const img = new Image();
            img.onload = () => ctxOp.drawImage(img, 0, 0);
            img.src = sp.firma_operador;
          }
          if (sp.firma_cliente && canvasCli && ctxCli) {
            const img = new Image();
            img.onload = () => ctxCli.drawImage(img, 0, 0);
            img.src = sp.firma_cliente;
          }
        }
      }
    }, 150);

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Cerrar modal de Servicio Preventivo
   */
  window.cerrarModalServicioPreventivo = function() {
    const overlay = document.getElementById('modal-servicio-preventivo-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
  };

  /**
   * Guardar Servicio Preventivo (100% Offline con sincronización)
   */
  window.guardarServicioPreventivo = function() {
    const rentaId = document.getElementById('sp-renta-id')?.value;
    const fecha = document.getElementById('sp-fecha')?.value;
    const horaEntrada = document.getElementById('sp-hora-entrada')?.value;
    const horaSalida = document.getElementById('sp-hora-salida')?.value;
    const horometro = parseFloat(document.getElementById('sp-horometro')?.value);
    const operadorNombre = document.getElementById('sp-operador-nombre')?.value?.trim();

    if (!rentaId) {
      if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion('Selecciona un contrato de renta para el servicio.', 'warning');
      } else {
        alert('Selecciona un contrato de renta para el servicio.');
      }
      return;
    }

    if (!fecha || !horaEntrada) {
      alert('Por favor registra la fecha y hora de entrada del servicio.');
      return;
    }

    if (isNaN(horometro) || horometro < 0) {
      alert('Por favor ingresa un horómetro válido.');
      return;
    }

    if (!operadorNombre) {
      alert('Por favor indica quién realizó el servicio (Operador / Técnico).');
      return;
    }

    const renta = (window.rentas || []).find(r => r && (r.id === rentaId || r.folio === rentaId));
    const pagadoPor = document.querySelector('input[name="sp_pagado_por"]:checked')?.value || 'cliente';
    const horasTrabajadas = window.recalcularHorasTrabajadasSP();
    const { totalRef, manoObra, granTotal } = window.recalcularTotalesServicioPreventivo();

    // Recoger Checklist
    const checklistActividades = [];
    document.querySelectorAll('.sp-checklist-input').forEach(chk => {
      checklistActividades.push({
        id: chk.dataset.id,
        label: chk.dataset.label,
        completado: chk.checked
      });
    });

    // Recoger Refacciones
    const refacciones = [];
    document.querySelectorAll('#sp-refacciones-tbody tr').forEach(tr => {
      const clave = tr.querySelector('.sp-ref-clave')?.value?.trim();
      const desc = tr.querySelector('.sp-ref-desc')?.value?.trim();
      const cant = parseFloat(tr.querySelector('.sp-ref-cant')?.value) || 0;
      const unid = tr.querySelector('.sp-ref-unidad')?.value || 'Pza';
      const costo = parseFloat(tr.querySelector('.sp-ref-costo')?.value) || 0;
      const pag = tr.querySelector('.sp-ref-pagador')?.value || pagadoPor;
      if (clave || desc) {
        refacciones.push({
          clave: clave || 'REF',
          descripcion: desc || 'Refacción sin descripción',
          cantidad: cant,
          unidad: unid,
          costo_unitario: costo,
          subtotal: cant * costo,
          pagado_por: pag
        });
      }
    });

    // Recoger firmas en base64
    let firmaOpBase64 = null;
    let firmaCliBase64 = null;
    if (canvasOp) {
      try { firmaOpBase64 = canvasOp.toDataURL('image/png'); } catch (e) {}
    }
    if (canvasCli) {
      try { firmaCliBase64 = canvasCli.toDataURL('image/png'); } catch (e) {}
    }

    // Generar UUID si es nuevo
    const id = servicioEnEdicionId || (crypto.randomUUID ? crypto.randomUUID() : 'sp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

    // Generar Folio si es nuevo (SP-2026-0001)
    let folio = document.getElementById('modal-sp-folio-badge')?.textContent;
    if (!folio || folio === 'SP-AUTO') {
      const year = new Date().getFullYear();
      const nextNum = (window.serviciosPreventivos || []).length + 1;
      folio = `SP-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    const nuevoSP = {
      id: id,
      folio: folio,
      renta_id: rentaId,
      renta_folio: renta?.folio || '',
      cliente: document.getElementById('sp-cliente')?.value || renta?.cliente || '',
      sitio: document.getElementById('sp-sitio')?.value || renta?.sitio || '',
      equipo: document.getElementById('sp-equipo')?.value || renta?.equipo || '',
      serie: document.getElementById('sp-serie')?.value || renta?.serie || '',
      maquina_id: renta?.maquina_id || null,
      pagado_por: pagadoPor,
      justificacion_pago: document.getElementById('sp-justificacion-pago')?.value || '',
      monto_mano_obra: manoObra,
      monto_refacciones: totalRef,
      monto_total_servicio: granTotal,
      numero_factura_sap: document.getElementById('sp-numero-factura-sap')?.value || '',
      fecha_servicio: fecha,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida || '',
      horas_trabajadas: horasTrabajadas,
      horometro_servicio: horometro,
      proximo_servicio_horometro: parseFloat(document.getElementById('sp-proximo-horometro')?.value) || null,
      operador_nombre: operadorNombre,
      operador_id: null,
      tipo_operador: document.getElementById('sp-tipo-operador')?.value || 'eurorep',
      supervisor_responsable: document.getElementById('sp-supervisor')?.value || '',
      tipo_mantenimiento: document.getElementById('sp-tipo-mantenimiento')?.value || '250h',
      checklist_actividades: checklistActividades,
      bitacora_notas: document.getElementById('sp-bitacora-notas')?.value || '',
      estado_equipo: document.getElementById('sp-estado-equipo')?.value || 'Operativo',
      refacciones: refacciones,
      evidencias: spFotosAdjuntas,
      firma_operador: firmaOpBase64,
      firma_cliente: firmaCliBase64,
      nombre_recibe: document.getElementById('sp-nombre-recibe')?.value || '',
      es_prueba: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Actualizar horómetro del contrato de renta si es mayor
    if (renta) {
      if (renta.horometro_final == null || horometro > Number(renta.horometro_final)) {
        renta.horometro_final = horometro;
        try {
          localStorage.setItem('sapi_rentas', JSON.stringify(window.rentas));
          if (window.pushToSupabase) window.pushToSupabase('rentas', renta);
        } catch (eH) {
          console.warn('[ServiciosPreventivos] Error actualizando horómetro de renta:', eH);
        }
      }
    }

    // Guardar en array de memoria
    const idx = (window.serviciosPreventivos || []).findIndex(x => x.id === id);
    if (idx >= 0) {
      window.serviciosPreventivos[idx] = nuevoSP;
    } else {
      window.serviciosPreventivos.unshift(nuevoSP);
    }

    // Persistir 100% en IndexedDB / localStorage bridge
    try {
      localStorage.setItem('sapi_servicios_preventivos', JSON.stringify(window.serviciosPreventivos));
    } catch (eS) {
      console.error('[ServiciosPreventivos] Error persistiendo en localStorage:', eS);
    }

    // Sincronizar en segundo plano con Supabase si está disponible
    if (typeof window.pushToSupabase === 'function') {
      try {
        window.pushToSupabase('servicios_preventivos', nuevoSP);
      } catch (eSync) {
        console.warn('[ServiciosPreventivos] Pendiente de sincronización a Supabase:', eSync);
      }
    }

    window.cerrarModalServicioPreventivo();

    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Servicio preventivo ${folio} guardado correctamente.`, 'success');
    }

    window.renderServiciosPreventivos();
    window.actualizarBadgesServiciosPreventivos();
  };

  /**
   * Eliminar servicio preventivo
   */
  window.eliminarServicioPreventivo = function(id) {
    const sp = (window.serviciosPreventivos || []).find(x => x.id === id);
    if (!sp) return;

    if (!confirm(`¿Estás seguro de eliminar el servicio preventivo ${sp.folio || ''}?`)) {
      return;
    }

    window.serviciosPreventivos = (window.serviciosPreventivos || []).filter(x => x.id !== id);
    try {
      localStorage.setItem('sapi_servicios_preventivos', JSON.stringify(window.serviciosPreventivos));
    } catch (e) {}

    if (typeof window.deleteFromSupabase === 'function') {
      try { window.deleteFromSupabase('servicios_preventivos', id); } catch (e) {}
    }

    window.renderServiciosPreventivos();
    window.actualizarBadgesServiciosPreventivos();
  };

  /**
   * Actualizar contadores y badges de servicios preventivos
   */
  window.actualizarBadgesServiciosPreventivos = function() {
    const items = window.serviciosPreventivos || [];
    const badgeCount = document.getElementById('badge-count-preventivos');
    if (badgeCount) badgeCount.textContent = items.length;

    const countTodos = document.getElementById('count-pill-sp-todos');
    if (countTodos) countTodos.textContent = items.length;

    const countCli = document.getElementById('count-pill-sp-cliente');
    if (countCli) countCli.textContent = items.filter(x => x.pagado_por === 'cliente').length;

    const countEur = document.getElementById('count-pill-sp-eurorep');
    if (countEur) countEur.textContent = items.filter(x => x.pagado_por === 'eurorep').length;

    const countGar = document.getElementById('count-pill-sp-garantia');
    if (countGar) countGar.textContent = items.filter(x => x.pagado_por === 'garantia' || x.pagado_por === 'compartido').length;

    // Actualizar KPIs superiores
    const statTotal = document.getElementById('stat-sp-total');
    if (statTotal) statTotal.textContent = items.length;

    const statCli = document.getElementById('stat-sp-cliente');
    if (statCli) statCli.textContent = items.filter(x => x.pagado_por === 'cliente').length;

    const statEur = document.getElementById('stat-sp-eurorep');
    if (statEur) statEur.textContent = items.filter(x => x.pagado_por === 'eurorep').length;

    const statGar = document.getElementById('stat-sp-garantia');
    if (statGar) statGar.textContent = items.filter(x => x.pagado_por === 'garantia' || x.pagado_por === 'compartido').length;

    const statRef = document.getElementById('stat-sp-refacciones');
    if (statRef) {
      const sumRef = items.reduce((acc, curr) => acc + (parseFloat(curr.monto_refacciones) || 0), 0);
      statRef.textContent = formatMoney(sumRef);
    }
  };

  /**
   * Renderizado principal de la vista de Servicios Preventivos
   */
  window.renderServiciosPreventivos = function() {
    window.actualizarBadgesServiciosPreventivos();

    const tbody = document.getElementById('preventivos-table-body');
    const mobileContainer = document.getElementById('preventivos-cards-mobile');
    if (!tbody && !mobileContainer) return;

    let items = [...(window.serviciosPreventivos || [])];

    // Filtro rápido de pagador
    if (currentSPFilter !== 'todos') {
      if (currentSPFilter === 'garantia') {
        items = items.filter(x => x.pagado_por === 'garantia' || x.pagado_por === 'compartido');
      } else {
        items = items.filter(x => x.pagado_por === currentSPFilter);
      }
    }

    // Filtro por caja de búsqueda
    const query = document.getElementById('search-preventivos')?.value?.trim().toLowerCase();
    if (query) {
      items = items.filter(x => {
        return (x.folio && x.folio.toLowerCase().includes(query)) ||
               (x.cliente && x.cliente.toLowerCase().includes(query)) ||
               (x.sitio && x.sitio.toLowerCase().includes(query)) ||
               (x.equipo && x.equipo.toLowerCase().includes(query)) ||
               (x.serie && x.serie.toLowerCase().includes(query)) ||
               (x.operador_nombre && x.operador_nombre.toLowerCase().includes(query)) ||
               (x.renta_folio && x.renta_folio.toLowerCase().includes(query));
      });
    }

    // Ordenar por fecha y creación descendente
    items.sort((a, b) => new Date(b.created_at || b.fecha_servicio) - new Date(a.created_at || a.fecha_servicio));

    // Si no hay registros
    if (items.length === 0) {
      const emptyMsg = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
              <i data-lucide="shield-alert" style="width: 38px; height: 38px; opacity: 0.4;"></i>
              <span style="font-size: 0.95rem; font-weight: 600;">No se encontraron servicios preventivos</span>
              <p style="margin: 0; font-size: 0.8rem; max-width: 320px;">Registra el primer servicio preventivo para dar seguimiento a horarios, bitácora diaria y refacciones.</p>
              <button class="btn-primary" onclick="window.abrirModalServicioPreventivo()" style="margin-top: 0.5rem; font-size: 0.82rem;">
                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Nuevo Servicio Preventivo
              </button>
            </div>
          </td>
        </tr>
      `;
      if (tbody) tbody.innerHTML = emptyMsg;
      if (mobileContainer) {
        mobileContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted);">
            <i data-lucide="shield-alert" style="width: 36px; height: 36px; opacity: 0.4; margin-bottom: 0.5rem;"></i>
            <div style="font-weight: 600; font-size: 0.9rem;">Sin servicios preventivos registrados</div>
          </div>
        `;
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Render Desktop Table
    if (tbody) {
      tbody.innerHTML = items.map(sp => {
        const pagadorBadge = window.obtenerBadgePagadorSP(sp.pagado_por);
        const estadoBadge = window.obtenerBadgeEstadoEquipoSP(sp.estado_equipo);
        const refCount = Array.isArray(sp.refacciones) ? sp.refacciones.length : 0;
        const totalRefMoney = formatMoney(sp.monto_refacciones || 0);
        const fechaStr = sp.fecha_servicio ? sp.fecha_servicio.substring(0, 10).split('-').reverse().join('/') : '-';

        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.75rem 0.5rem; white-space: nowrap;">
              <div style="display: flex; gap: 0.25rem;">
                <button class="action-btn" onclick="window.verDetalleServicioPreventivo('${sp.id}')" title="Ver Detalle y Reporte" style="padding: 0.3rem 0.45rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-hover); cursor: pointer; color: var(--text-primary);">
                  <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="action-btn" onclick="window.imprimirServicioPreventivoPDF('${sp.id}')" title="Imprimir Bitácora" style="padding: 0.3rem 0.45rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-hover); cursor: pointer; color: var(--text-primary);">
                  <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="action-btn" onclick="window.abrirModalServicioPreventivo({ id: '${sp.id}' })" title="Editar" style="padding: 0.3rem 0.45rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-hover); cursor: pointer; color: var(--text-primary);">
                  <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="action-btn" onclick="window.eliminarServicioPreventivo('${sp.id}')" title="Eliminar" style="padding: 0.3rem 0.45rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-hover); cursor: pointer; color: #ef4444;">
                  <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              <strong style="font-family: var(--font-mono, monospace); color: var(--accent, #E8820C); font-size: 0.85rem;">${sp.folio || 'SP-0000'}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${fechaStr}</div>
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              <strong style="color: var(--text-primary); font-size: 0.85rem; display: block;">${sp.cliente || 'Sin Cliente'}</strong>
              <span style="font-size: 0.75rem; color: var(--text-secondary);">${sp.sitio || 'Sin Sitio'}</span>
              ${sp.renta_folio ? `<div style="font-size: 0.7rem; color: var(--accent); font-family: var(--font-mono, monospace);">Contrato: ${sp.renta_folio}</div>` : ''}
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              <div style="font-size: 0.85rem; font-weight: 600;">${sp.equipo || 'Maquinaria'}</div>
              <div style="font-size: 0.75rem; font-family: var(--font-mono, monospace); color: var(--text-muted);">${sp.serie || 'S/N'}</div>
            </td>
            <td style="padding: 0.75rem 0.5rem; font-size: 0.82rem;">
              <span style="color: #10b981;">${sp.hora_entrada || '--:--'}</span> &rarr; <span style="color: #ef4444;">${sp.hora_salida || '--:--'}</span>
            </td>
            <td style="padding: 0.75rem 0.5rem; font-weight: 700; color: #3b82f6; font-size: 0.85rem;">
              ${(parseFloat(sp.horas_trabajadas) || 0).toFixed(1)} hrs
            </td>
            <td style="padding: 0.75rem 0.5rem; font-size: 0.85rem;">
              <strong>${sp.horometro_servicio || 0} hrs</strong>
              ${sp.proximo_servicio_horometro ? `<div style="font-size: 0.72rem; color: var(--text-muted);">Próx: ${sp.proximo_servicio_horometro} hrs</div>` : ''}
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              ${pagadorBadge}
              ${sp.justificacion_pago ? `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sp.justificacion_pago}">${sp.justificacion_pago}</div>` : ''}
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              <div style="font-size: 0.85rem; font-weight: 600;">${sp.operador_nombre || 'No asignado'}</div>
              <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: capitalize;">${sp.tipo_operador || 'Eurorep'}</span>
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              <div style="font-weight: 700; font-size: 0.85rem; color: #10b981;">${totalRefMoney}</div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${refCount} refacciones</span>
            </td>
            <td style="padding: 0.75rem 0.5rem;">
              ${estadoBadge}
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Mobile & Tablet Cards
    if (mobileContainer) {
      mobileContainer.innerHTML = items.map(sp => {
        const pagadorBadge = window.obtenerBadgePagadorSP(sp.pagado_por);
        const estadoBadge = window.obtenerBadgeEstadoEquipoSP(sp.estado_equipo);
        const refCount = Array.isArray(sp.refacciones) ? sp.refacciones.length : 0;
        const totalRefMoney = formatMoney(sp.monto_refacciones || 0);
        const fechaStr = sp.fecha_servicio ? sp.fecha_servicio.substring(0, 10).split('-').reverse().join('/') : '-';

        return `
          <div class="sp-mobile-card" style="background: var(--bg-card); border-radius: 14px; border: 1px solid var(--border); padding: 1.15rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Header Card -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 0.65rem;">
              <div>
                <span style="font-family: var(--font-mono, monospace); font-weight: 800; font-size: 1rem; color: var(--accent, #E8820C);">${sp.folio || 'SP-0000'}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">📅 ${fechaStr}</span>
                <div style="font-size: 0.88rem; font-weight: 700; margin-top: 2px;">${sp.cliente || 'Sin Cliente'}</div>
              </div>
              <div>${pagadorBadge}</div>
            </div>

            <!-- Equipo y Sitio -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem; background: var(--bg-primary); padding: 0.65rem; border-radius: 8px;">
              <div>
                <span style="color: var(--text-muted); display: block; font-size: 0.72rem;">EQUIPO:</span>
                <strong>${sp.equipo || 'Maquinaria'}</strong>
                <div style="font-family: var(--font-mono, monospace); font-size: 0.75rem; color: var(--text-muted);">${sp.serie || 'S/N'}</div>
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-size: 0.72rem;">UBICACIÓN / SITIO:</span>
                <span>${sp.sitio || 'Obra general'}</span>
              </div>
            </div>

            <!-- Horarios y Horómetro -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem;">HORARIO DE TRABAJO:</span>
                <div>
                  <strong style="color: #10b981;">⏱️ ${sp.hora_entrada || '--:--'}</strong> &rarr; <strong style="color: #ef4444;">${sp.hora_salida || '--:--'}</strong>
                  <span style="background: rgba(59,130,246,0.15); color: #3b82f6; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 6px; margin-left: 4px; font-size: 0.75rem;">${(parseFloat(sp.horas_trabajadas) || 0).toFixed(1)} hrs</span>
                </div>
              </div>
              <div style="text-align: right;">
                <span style="color: var(--text-muted); font-size: 0.72rem;">HORÓMETRO:</span>
                <div><strong>${sp.horometro_servicio || 0} hrs</strong></div>
              </div>
            </div>

            <!-- Operador y Refacciones -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border); padding-top: 0.65rem; font-size: 0.82rem;">
              <div>
                <span style="color: var(--text-muted); font-size: 0.72rem;">OPERADOR / TÉCNICO:</span>
                <div><strong>👤 ${sp.operador_nombre || 'No asignado'}</strong></div>
              </div>
              <div style="text-align: right;">
                <span style="color: var(--text-muted); font-size: 0.72rem;">REFACCIONES (${refCount}):</span>
                <div style="color: #10b981; font-weight: 700;">${totalRefMoney}</div>
              </div>
            </div>

            <!-- Botones de Acción Táctiles Grandes -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn-secondary" onclick="window.verDetalleServicioPreventivo('${sp.id}')" style="font-size: 0.82rem; padding: 0.6rem 0.5rem; justify-content: center; display: flex; align-items: center; gap: 0.3rem;">
                <i data-lucide="eye" style="width: 15px; height: 15px;"></i> Ver Ficha
              </button>
              <button type="button" class="btn-secondary" onclick="window.imprimirServicioPreventivoPDF('${sp.id}')" style="font-size: 0.82rem; padding: 0.6rem 0.5rem; justify-content: center; display: flex; align-items: center; gap: 0.3rem;">
                <i data-lucide="printer" style="width: 15px; height: 15px;"></i> Imprimir
              </button>
              <button type="button" class="btn-primary" onclick="window.abrirModalServicioPreventivo({ id: '${sp.id}' })" style="font-size: 0.82rem; padding: 0.6rem 0.5rem; justify-content: center; display: flex; align-items: center; gap: 0.3rem; background: var(--accent); border-color: var(--accent);">
                <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i> Editar
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    ajustarVisibilidadResponsiveSP();

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Conmutar entre tabla y tarjetas móviles según el ancho
   */
  function ajustarVisibilidadResponsiveSP() {
    const desktopTable = document.querySelector('.sp-desktop-table');
    const mobileCards = document.getElementById('preventivos-cards-mobile');

    if (!desktopTable || !mobileCards) return;

    if (window.innerWidth <= 768) {
      desktopTable.style.display = 'none';
      mobileCards.style.display = 'flex';
    } else {
      desktopTable.style.display = 'block';
      mobileCards.style.display = 'none';
    }
  }

  window.addEventListener('resize', ajustarVisibilidadResponsiveSP);

  /**
   * Ver detalle completo del servicio preventivo en modal
   */
  window.verDetalleServicioPreventivo = function(id) {
    const sp = (window.serviciosPreventivos || []).find(x => x.id === id);
    if (!sp) return;

    const prev = document.getElementById('modal-detalle-sp');
    if (prev) prev.remove();

    const pagadorBadge = window.obtenerBadgePagadorSP(sp.pagado_por);
    const estadoBadge = window.obtenerBadgeEstadoEquipoSP(sp.estado_equipo);
    const fechaStr = sp.fecha_servicio ? sp.fecha_servicio.substring(0, 10).split('-').reverse().join('/') : '-';
    const totalRefMoney = formatMoney(sp.monto_refacciones || 0);
    const totalManoObraMoney = formatMoney(sp.monto_mano_obra || 0);
    const granTotalMoney = formatMoney(sp.monto_total_servicio || 0);

    const modal = document.createElement('div');
    modal.id = 'modal-detalle-sp';
    modal.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:1rem;box-sizing:border-box;';

    modal.innerHTML = `
      <div style="background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); border-radius:16px; border:1px solid var(--border, #334155); width:100%; max-width:850px; max-height:92vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6); padding:1.75rem; box-sizing:border-box;">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px solid var(--border, #334155); padding-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <span style="font-size:0.75rem; color:var(--text-muted, #94a3b8); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Bitácora de Servicio Preventivo</span>
            <h2 style="margin:0.15rem 0 0.25rem 0; font-size:1.35rem; font-family:var(--font-mono, monospace); color:var(--accent, #E8820C);">${sp.folio || 'SP-0000'}</h2>
            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
              <span><strong>${sp.cliente || 'Sin Cliente'}</strong></span>
              <span>•</span>
              <span>${sp.sitio || 'Ubicación General'}</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="margin-bottom:0.4rem;">${pagadorBadge}</div>
            <div>${estadoBadge}</div>
          </div>
        </div>

        <!-- Grid de información operativa -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
          <!-- Card Maquinaria y Horómetro -->
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:1rem; font-size:0.85rem;">
            <h4 style="margin:0 0 0.5rem 0; color:var(--accent); font-size:0.88rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="settings-2" style="width:15px;height:15px;"></i> Maquinaria y Horómetro
            </h4>
            <div><strong>Equipo:</strong> ${sp.equipo || 'Maquinaria'}</div>
            <div><strong>Serie:</strong> <span style="font-family:var(--font-mono, monospace);">${sp.serie || 'S/N'}</span></div>
            <div><strong>Contrato Renta:</strong> ${sp.renta_folio || 'Directo'}</div>
            <div><strong>Horómetro del Servicio:</strong> <strong style="color:#10b981;">${sp.horometro_servicio || 0} hrs</strong></div>
            <div><strong>Próximo Servicio Sugerido:</strong> ${sp.proximo_servicio_horometro ? sp.proximo_servicio_horometro + ' hrs' : 'No especificado'}</div>
          </div>

          <!-- Card Horario y Quién Realizó -->
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:1rem; font-size:0.85rem;">
            <h4 style="margin:0 0 0.5rem 0; color:var(--accent); font-size:0.88rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="clock" style="width:15px;height:15px;"></i> Horario y Personal
            </h4>
            <div><strong>Fecha:</strong> ${fechaStr}</div>
            <div><strong>Hora de Entrada:</strong> <span style="color:#10b981; font-weight:700;">${sp.hora_entrada || '--:--'}</span></div>
            <div><strong>Hora de Salida:</strong> <span style="color:#ef4444; font-weight:700;">${sp.hora_salida || '--:--'}</span></div>
            <div><strong>Horas Trabajadas:</strong> <strong style="color:#3b82f6;">${(parseFloat(sp.horas_trabajadas) || 0).toFixed(1)} hrs</strong></div>
            <div><strong>Operador / Técnico:</strong> ${sp.operador_nombre || 'No asignado'} (${sp.tipo_operador || 'Eurorep'})</div>
            ${sp.supervisor_responsable ? `<div><strong>Supervisor:</strong> ${sp.supervisor_responsable}</div>` : ''}
          </div>

          <!-- Card Económica / Responsable de Pago -->
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:1rem; font-size:0.85rem;">
            <h4 style="margin:0 0 0.5rem 0; color:var(--accent); font-size:0.88rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="dollar-sign" style="width:15px;height:15px;"></i> Liquidación y Costos
            </h4>
            <div><strong>Pagado por:</strong> <span style="text-transform:capitalize; font-weight:700;">${sp.pagado_por || 'Cliente'}</span></div>
            ${sp.justificacion_pago ? `<div><strong>Motivo:</strong> ${sp.justificacion_pago}</div>` : ''}
            <div><strong>Mano de Obra:</strong> ${totalManoObraMoney}</div>
            <div><strong>Refacciones:</strong> ${totalRefMoney}</div>
            <div style="font-size:1rem; font-weight:800; color:var(--accent); margin-top:0.4rem;"><strong>Total Inversión:</strong> ${granTotalMoney}</div>
            ${sp.numero_factura_sap ? `<div><strong>SAP / Factura:</strong> ${sp.numero_factura_sap}</div>` : ''}
          </div>
        </div>

        <!-- Checklist y Bitácora -->
        <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:1rem; margin-bottom:1.25rem;">
          <h4 style="margin:0 0 0.65rem 0; color:var(--accent); font-size:0.88rem; display:flex; align-items:center; gap:0.35rem;">
            <i data-lucide="clipboard-check" style="width:15px;height:15px;"></i> Actividades de Mantenimiento (${sp.tipo_mantenimiento || '250h'})
          </h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.4rem; font-size:0.8rem; margin-bottom:0.75rem;">
            ${(Array.isArray(sp.checklist_actividades) && sp.checklist_actividades.length) ? sp.checklist_actividades.map(a => `
              <div style="display:flex; align-items:center; gap:0.4rem; color:${a.completado ? '#10b981' : 'var(--text-muted)'};">
                <i data-lucide="${a.completado ? 'check-circle' : 'circle'}" style="width:13px;height:13px;"></i>
                <span style="${a.completado ? '' : 'text-decoration:line-through; opacity:0.6;'}">${a.label || a.id}</span>
              </div>
            `).join('') : '<span style="color:var(--text-muted); font-style:italic;">No se registraron items específicos en checklist.</span>'}
          </div>

          ${sp.bitacora_notas ? `
            <div style="border-top:1px dashed var(--border); padding-top:0.65rem; font-size:0.82rem;">
              <strong style="color:var(--text-secondary); display:block; margin-bottom:0.25rem;">Notas de la Bitácora Diaria:</strong>
              <div style="white-space:pre-wrap; color:var(--text-primary); background:var(--bg-card); padding:0.65rem; border-radius:6px;">${sp.bitacora_notas}</div>
            </div>
          ` : ''}
        </div>

        <!-- Tabla de Refacciones -->
        ${(Array.isArray(sp.refacciones) && sp.refacciones.length) ? `
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:1rem; margin-bottom:1.25rem;">
            <h4 style="margin:0 0 0.65rem 0; color:var(--accent); font-size:0.88rem; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="package" style="width:15px;height:15px;"></i> Refacciones e Insumos Consumidos
            </h4>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:left;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border); color:var(--text-muted);">
                    <th style="padding:0.4rem;">Clave</th>
                    <th style="padding:0.4rem;">Descripción</th>
                    <th style="padding:0.4rem; width:60px;">Cant.</th>
                    <th style="padding:0.4rem; width:80px;">Costo U.</th>
                    <th style="padding:0.4rem; font-weight:700; color:#10b981;">Subtotal</th>
                    <th style="padding:0.4rem; width:90px;">Pagador</th>
                  </tr>
                </thead>
                <tbody>
                  ${sp.refacciones.map(r => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                      <td style="padding:0.4rem; font-family:var(--font-mono, monospace);">${r.clave || '-'}</td>
                      <td style="padding:0.4rem;">${r.descripcion || '-'}</td>
                      <td style="padding:0.4rem;">${r.cantidad} ${r.unidad || ''}</td>
                      <td style="padding:0.4rem;">${formatMoney(r.costo_unitario)}</td>
                      <td style="padding:0.4rem; font-weight:700; color:#10b981;">${formatMoney(r.subtotal)}</td>
                      <td style="padding:0.4rem;"><span style="text-transform:capitalize;">${r.pagado_por || sp.pagado_por}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- Firmas -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.35rem;">Firma Operador / Técnico</div>
            ${sp.firma_operador ? `<img src="${sp.firma_operador}" style="max-height:80px; width:auto; max-width:100%; background:#fff; border-radius:6px; padding:4px;" alt="Firma Operador" />` : '<div style="height:60px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.75rem;">Sin firma registrada</div>'}
            <div style="font-size:0.8rem; font-weight:700; margin-top:0.35rem;">${sp.operador_nombre || ''}</div>
          </div>

          <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:10px; padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.35rem;">Firma de Recibido en Sitio</div>
            ${sp.firma_cliente ? `<img src="${sp.firma_cliente}" style="max-height:80px; width:auto; max-width:100%; background:#fff; border-radius:6px; padding:4px;" alt="Firma Cliente" />` : '<div style="height:60px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.75rem;">Sin firma registrada</div>'}
            <div style="font-size:0.8rem; font-weight:700; margin-top:0.35rem;">${sp.nombre_recibe || 'Responsable Cliente'}</div>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:1rem; flex-wrap:wrap; gap:0.5rem;">
          <button class="btn-secondary" onclick="window.imprimirServicioPreventivoPDF('${sp.id}')" style="font-size:0.85rem; display:flex; align-items:center; gap:0.35rem;">
            <i data-lucide="printer" style="width:15px;height:15px;"></i> Imprimir Ficha / Bitácora
          </button>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-primary" onclick="document.getElementById('modal-detalle-sp')?.remove(); window.abrirModalServicioPreventivo({ id: '${sp.id}' });" style="font-size:0.85rem; display:flex; align-items:center; gap:0.35rem; background:var(--accent); border-color:var(--accent);">
              <i data-lucide="edit-3" style="width:15px;height:15px;"></i> Editar
            </button>
            <button class="btn-secondary" onclick="document.getElementById('modal-detalle-sp')?.remove(); document.body.style.overflow='auto';" style="font-size:0.85rem;">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Imprimir Ficha de Servicio Preventivo en formato PDF
   */
  window.imprimirServicioPreventivoPDF = function(id) {
    const sp = (window.serviciosPreventivos || []).find(x => x.id === id);
    if (!sp) return;

    const fechaStr = sp.fecha_servicio ? sp.fecha_servicio.substring(0, 10).split('-').reverse().join('/') : '-';
    const totalRefMoney = formatMoney(sp.monto_refacciones || 0);
    const totalManoObraMoney = formatMoney(sp.monto_mano_obra || 0);
    const granTotalMoney = formatMoney(sp.monto_total_servicio || 0);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Por favor permite ventanas emergentes para imprimir el reporte.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bitácora de Servicio Preventivo - ${sp.folio}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; padding: 2rem; margin: 0; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E8820C; padding-bottom: 1rem; margin-bottom: 1.5rem; }
          .logo { font-size: 20px; font-weight: 900; color: #E8820C; letter-spacing: 0.5px; }
          .folio { font-size: 16px; font-weight: 700; font-family: monospace; color: #0f172a; text-align: right; }
          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
          .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.85rem; background: #f8fafc; }
          .card h4 { margin: 0 0 0.5rem 0; font-size: 12px; color: #E8820C; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
          .card div { margin-bottom: 0.25rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 0.45rem; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
          .sig-box { border-top: 1px solid #0f172a; text-align: center; padding-top: 0.5rem; }
          @media print {
            body { padding: 0.5cm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">EUROREP &bull; SAPI</div>
            <div style="font-size: 11px; color: #64748b;">REPORTE DE BITÁCORA DIARIA Y SERVICIO PREVENTIVO DE RENTAS</div>
          </div>
          <div class="folio">
            FOLIO: ${sp.folio || 'SP-0000'}<br>
            <span style="font-size: 11px; font-weight: 400; color: #64748b;">Fecha: ${fechaStr}</span>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h4>Datos del Cliente y Renta</h4>
            <div><strong>Cliente:</strong> ${sp.cliente || 'N/A'}</div>
            <div><strong>Sitio / Obra:</strong> ${sp.sitio || 'N/A'}</div>
            <div><strong>Contrato Renta:</strong> ${sp.renta_folio || 'Directo'}</div>
            <div><strong>Estado Equipo:</strong> ${sp.estado_equipo || 'Operativo'}</div>
          </div>

          <div class="card">
            <h4>Maquinaria y Horómetro</h4>
            <div><strong>Equipo:</strong> ${sp.equipo || 'Maquinaria'}</div>
            <div><strong>Serie:</strong> ${sp.serie || 'S/N'}</div>
            <div><strong>Horómetro Actual:</strong> ${sp.horometro_servicio || 0} hrs</div>
            <div><strong>Próximo Servicio:</strong> ${sp.proximo_servicio_horometro ? sp.proximo_servicio_horometro + ' hrs' : '-'}</div>
          </div>

          <div class="card">
            <h4>Horario y Responsabilidad</h4>
            <div><strong>Entrada:</strong> ${sp.hora_entrada || '--:--'} | <strong>Salida:</strong> ${sp.hora_salida || '--:--'}</div>
            <div><strong>Horas Trabajadas:</strong> ${(parseFloat(sp.horas_trabajadas) || 0).toFixed(1)} hrs</div>
            <div><strong>Operador:</strong> ${sp.operador_nombre || 'N/A'}</div>
            <div><strong>¿Quién Paga?:</strong> <strong style="text-transform:uppercase;">${sp.pagado_por || 'Cliente'}</strong></div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
          <h4>Bitácora Diaria y Checklist (${sp.tipo_mantenimiento || '250h'})</h4>
          <div style="margin-bottom: 0.5rem; font-style: italic;">${sp.bitacora_notas || 'Sin notas adicionales.'}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; font-size: 11px;">
            ${(Array.isArray(sp.checklist_actividades) ? sp.checklist_actividades : []).map(a => `
              <div>[${a.completado ? 'X' : ' '}] ${a.label || a.id}</div>
            `).join('')}
          </div>
        </div>

        ${(Array.isArray(sp.refacciones) && sp.refacciones.length) ? `
          <div class="card" style="margin-bottom: 1.5rem;">
            <h4>Refacciones e Insumos Utilizados</h4>
            <table>
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Descripción</th>
                  <th>Cant.</th>
                  <th>Costo U.</th>
                  <th>Importe</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                ${sp.refacciones.map(r => `
                  <tr>
                    <td>${r.clave || ''}</td>
                    <td>${r.descripcion || ''}</td>
                    <td>${r.cantidad} ${r.unidad || ''}</td>
                    <td>${formatMoney(r.costo_unitario)}</td>
                    <td>${formatMoney(r.subtotal)}</td>
                    <td>${r.pagado_por || sp.pagado_por}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 700;">Total Refacciones:</td>
                  <td colspan="2" style="font-weight: 700;">${totalRefMoney}</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 700;">Mano de Obra:</td>
                  <td colspan="2">${totalManoObraMoney}</td>
                </tr>
                <tr style="font-size: 12px;">
                  <td colspan="4" style="text-align: right; font-weight: 800;">TOTAL INVERSIÓN:</td>
                  <td colspan="2" style="font-weight: 800; color: #E8820C;">${granTotalMoney}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : ''}

        <div class="signatures">
          <div class="sig-box">
            ${sp.firma_operador ? `<img src="${sp.firma_operador}" style="max-height: 60px; margin-bottom: 5px;" /><br>` : '<div style="height: 50px;"></div>'}
            <strong>${sp.operador_nombre || 'Operador / Técnico'}</strong><br>
            <span>Realizó Servicio</span>
          </div>
          <div class="sig-box">
            ${sp.firma_cliente ? `<img src="${sp.firma_cliente}" style="max-height: 60px; margin-bottom: 5px;" /><br>` : '<div style="height: 50px;"></div>'}
            <strong>${sp.nombre_recibe || 'Responsable Cliente'}</strong><br>
            <span>Conformidad en Obra</span>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  /**
   * Exportar servicios preventivos a archivo Excel (CSV compatible)
   */
  window.exportarServiciosPreventivosExcel = function() {
    const items = window.serviciosPreventivos || [];
    if (!items.length) {
      alert('No hay servicios preventivos registrados para exportar.');
      return;
    }

    const headers = [
      'Folio', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Horas Trabajadas',
      'Renta Folio', 'Cliente', 'Sitio', 'Equipo', 'Serie', 'Horometro',
      'Proximo Horometro', 'Quien Paga', 'Justificacion Pago', 'Mano de Obra',
      'Refacciones Total', 'Total Servicio', 'Operador', 'Tipo Operador',
      'Supervisor', 'Estado Equipo', 'Factura SAP', 'Refacciones Detalle'
    ];

    const rows = items.map(sp => {
      const refDetalle = (Array.isArray(sp.refacciones) ? sp.refacciones : [])
        .map(r => `${r.clave} (${r.cantidad} ${r.unidad}): $${r.subtotal}`)
        .join('; ');

      return [
        sp.folio || '',
        sp.fecha_servicio || '',
        sp.hora_entrada || '',
        sp.hora_salida || '',
        sp.horas_trabajadas || 0,
        sp.renta_folio || '',
        sp.cliente || '',
        sp.sitio || '',
        sp.equipo || '',
        sp.serie || '',
        sp.horometro_servicio || 0,
        sp.proximo_servicio_horometro || '',
        sp.pagado_por || '',
        sp.justificacion_pago || '',
        sp.monto_mano_obra || 0,
        sp.monto_refacciones || 0,
        sp.monto_total_servicio || 0,
        sp.operador_nombre || '',
        sp.tipo_operador || '',
        sp.supervisor_responsable || '',
        sp.estado_equipo || '',
        sp.numero_factura_sap || '',
        refDetalle
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `servicios_preventivos_rentas_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Inicializar al cargar el DOM o si ya está listo
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.actualizarBadgesServiciosPreventivos === 'function') {
          window.actualizarBadgesServiciosPreventivos();
        }
      });
    } else {
      if (typeof window.actualizarBadgesServiciosPreventivos === 'function') {
        window.actualizarBadgesServiciosPreventivos();
      }
    }
  }

})();

// Exportar funciones para uso como módulo ES
export const cambiarSubTabRentas = (typeof window !== 'undefined') ? window.cambiarSubTabRentas : undefined;
export const recalcularHorasTrabajadasSP = (typeof window !== 'undefined') ? window.recalcularHorasTrabajadasSP : undefined;
export const obtenerBadgePagadorSP = (typeof window !== 'undefined') ? window.obtenerBadgePagadorSP : undefined;
export const obtenerBadgeEstadoEquipoSP = (typeof window !== 'undefined') ? window.obtenerBadgeEstadoEquipoSP : undefined;
export const abrirModalServicioPreventivo = (typeof window !== 'undefined') ? window.abrirModalServicioPreventivo : undefined;
export const guardarServicioPreventivo = (typeof window !== 'undefined') ? window.guardarServicioPreventivo : undefined;
export const renderServiciosPreventivos = (typeof window !== 'undefined') ? window.renderServiciosPreventivos : undefined;
export const exportarServiciosPreventivosExcel = (typeof window !== 'undefined') ? window.exportarServiciosPreventivosExcel : undefined;
