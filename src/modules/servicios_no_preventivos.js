/**
 * Módulo de Servicios NO Preventivos en Rentas - Eurorep / SAPI
 * Servicios en Sitio / Correctivos / Soporte en Proyecto para técnicos asignados a obra.
 * Permite registrar intervenciones en 3-4 máquinas al día por técnico,
 * control de Bolsa de Horas contratadas, bitácora diaria y reporte semanal para facturación.
 * Opera 100% Offline con resiliencia IndexedDB y sincronización con Supabase.
 */

(function() {
  'use strict';

  let currentSNPFilter = 'todos';
  let currentSNPSemana = 'todas';
  let snpEnEdicionId = null;
  let snpFotosAdjuntas = [];

  // Variables para firmas táctiles
  let canvasTecnico = null;
  let ctxTecnico = null;
  let dibujandoTecnico = false;
  let canvasCliente = null;
  let ctxCliente = null;
  let dibujandoCliente = false;

  // Clave de almacenamiento dinámico según Sandbox
  function getStorageKey() {
    const isSandbox = typeof isTestModeActive === 'function' ? isTestModeActive() : (window.modoPruebas === true);
    return isSandbox ? 'sapi_servicios_no_preventivos_sandbox' : 'sapi_servicios_no_preventivos';
  }

  // Inicializar almacenamiento local y memoria
  window.serviciosNoPreventivos = window.serviciosNoPreventivos || [];

  function cargarServiciosNoPreventivosDesdeStorage() {
    try {
      const key = getStorageKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        window.serviciosNoPreventivos = JSON.parse(stored);
      } else {
        // Fallback a la clave general si no hay datos sandbox
        const legacy = localStorage.getItem('sapi_servicios_no_preventivos');
        if (legacy) {
          window.serviciosNoPreventivos = JSON.parse(legacy);
        } else {
          window.serviciosNoPreventivos = [];
        }
      }
    } catch (e) {
      console.warn('[ServiciosNoPreventivos] Error al cargar storage:', e);
      window.serviciosNoPreventivos = [];
    }
  }

  cargarServiciosNoPreventivosDesdeStorage();

  // Escuchar cambios de entorno / sandbox
  window.addEventListener('modoPruebasCambiado', function() {
    cargarServiciosNoPreventivosDesdeStorage();
    if (typeof window.renderServiciosNoPreventivos === 'function') {
      window.renderServiciosNoPreventivos();
    }
  });

  /**
   * Formatear moneda MXN
   */
  function formatMoney(num) {
    const val = parseFloat(num) || 0;
    return '$' + val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Obtener número de semana ISO (1-53) y año correspondiente a una fecha
   */
  function getNumeroSemanaISO(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { semana: 1, ano: new Date().getFullYear(), clave: 'S01' };
    d.setHours(0, 0, 0, 0);
    // Jueves de la semana actual determina el año de la semana ISO
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const semana1 = new Date(d.getFullYear(), 0, 4);
    const numSemana = 1 + Math.round(((d.getTime() - semana1.getTime()) / 86400000 - 3 + ((semana1.getDay() + 6) % 7)) / 7);
    const semPadded = String(numSemana).padStart(2, '0');
    return {
      semana: numSemana,
      ano: d.getFullYear(),
      clave: `${d.getFullYear()}-W${semPadded}`,
      label: `Semana ${semPadded} (${d.getFullYear()})`
    };
  }

  /**
   * Calcular rango de fechas (Lunes a Domingo) para una semana ISO
   */
  function getRangoFechasSemanaISO(ano, semana) {
    const simple = new Date(Date.UTC(ano, 0, 1 + (semana - 1) * 7));
    const dow = simple.getUTCDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
      ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }
    const lunes = new Date(ISOweekStart);
    const domingo = new Date(ISOweekStart);
    domingo.setDate(lunes.getDate() + 6);
    return {
      lunes: lunes.toISOString().substring(0, 10),
      domingo: domingo.toISOString().substring(0, 10)
    };
  }

  /**
   * Generar el siguiente Folio para Servicio No Preventivo
   */
  window.generarSiguienteFolioSNP = function() {
    const isSandbox = typeof isTestModeActive === 'function' ? isTestModeActive() : (window.modoPruebas === true);
    const ano = new Date().getFullYear();
    const prefix = isSandbox ? `SNP-PRUEBA-${ano}-` : `SNP-${ano}-`;
    
    const lista = Array.isArray(window.serviciosNoPreventivos) ? window.serviciosNoPreventivos : [];
    let maxNum = 0;
    
    lista.forEach(s => {
      const fol = s.folio || '';
      if (fol.startsWith(prefix)) {
        const numPart = parseInt(fol.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    
    const siguiente = maxNum + 1;
    return `${prefix}${String(siguiente).padStart(4, '0')}`;
  };

  /**
   * Obtener badge visual según el estado final del equipo intervenido
   */
  window.obtenerBadgeEstadoEquipoSNP = function(estado) {
    switch (estado) {
      case 'Operativo':
        return '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:700;display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;"></span>Operativo</span>';
      case 'Operativo con Observaciones':
        return '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:700;display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span>Con Observaciones</span>';
      case 'Fuera de Servicio':
        return '<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:700;display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;"></span>Fuera de Servicio</span>';
      default:
        return `<span class="badge badge-secondary">${estado || 'Operativo'}</span>`;
    }
  };

  /**
   * Obtener badge visual para tipo de trabajo / intervención
   */
  window.obtenerBadgeTipoTrabajoSNP = function(tipo) {
    switch (tipo) {
      case 'Correctivo Mecanico':
        return '<span class="badge" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:600;"><i data-lucide="wrench" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Correctivo</span>';
      case 'Falla Electrica':
        return '<span class="badge" style="background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:600;"><i data-lucide="zap" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Eléctrico</span>';
      case 'Falla Hidraulica':
        return '<span class="badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:600;"><i data-lucide="droplet" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Hidráulico</span>';
      case 'Calibracion Ajuste':
        return '<span class="badge" style="background:rgba(139,92,246,0.12);color:#8b5cf6;border:1px solid rgba(139,92,246,0.3);font-weight:600;"><i data-lucide="sliders" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Calibración</span>';
      case 'Capacitacion Operadores':
        return '<span class="badge" style="background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:600;"><i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Capacitación</span>';
      default:
        return `<span class="badge badge-secondary">${tipo || 'Soporte Técnico'}</span>`;
    }
  };

  /**
   * Cambiar filtro rápido por tipo de trabajo
   */
  window.setFiltroTipoServiciosSNP = function(filtro) {
    currentSNPFilter = filtro;
    document.querySelectorAll('.snp-filter-pill').forEach(btn => {
      if (btn.dataset.filtro === filtro) {
        btn.classList.add('active');
        btn.style.background = '#2563eb';
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
      }
    });
    window.renderServiciosNoPreventivos();
  };

  /**
   * Cambiar filtro por semana
   */
  window.alCambiarFiltroSemanaSNP = function(semana) {
    currentSNPSemana = semana;
    window.renderServiciosNoPreventivos();
  };

  /**
   * Debounce para búsqueda
   */
  let snpSearchTimeout = null;
  window.debouncedRenderServiciosNoPreventivos = function() {
    clearTimeout(snpSearchTimeout);
    snpSearchTimeout = setTimeout(() => {
      window.renderServiciosNoPreventivos();
    }, 200);
  };

  /**
   * Calcular diferencia en horas entre hora de inicio y fin (soporta noche y fracciones de hora)
   */
  window.recalcularHorasTrabajadasSNP = function() {
    const hIn = document.getElementById('snp-hora-inicio')?.value;
    const hOut = document.getElementById('snp-hora-fin')?.value;
    const badge = document.getElementById('snp-horas-calculadas-badge');

    if (!hIn || !hOut) {
      if (badge) badge.textContent = 'Horas Trabajadas: 0.0 hrs';
      return 0;
    }

    const [inH, inM] = hIn.split(':').map(Number);
    const [outH, outM] = hOut.split(':').map(Number);

    let minIn = inH * 60 + inM;
    let minOut = outH * 60 + outM;

    // Si la hora de salida es menor a la de entrada, asumimos turno de noche que cruzó medianoche
    if (minOut < minIn) {
      minOut += 24 * 60;
    }

    const diffMin = Math.max(0, minOut - minIn);
    const diffHoras = Math.round((diffMin / 60) * 100) / 100;

    if (badge) {
      badge.textContent = `Horas Trabajadas: ${diffHoras.toFixed(1)} hrs`;
    }
    return diffHoras;
  };

  /**
   * Fijar hora actual (HH:MM) en un input de hora
   */
  window.fijarHoraActualSNP = function(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    input.value = `${hh}:${mm}`;
    window.recalcularHorasTrabajadasSNP();
  };

  /**
   * Al cambiar la renta seleccionada en el formulario de servicio
   */
  window.alCambiarRentaEnServicioNoPreventivo = function() {
    const rentaId = document.getElementById('snp-renta-id')?.value;
    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const r = rentas.find(x => String(x.id) === String(rentaId));

    const inputCli = document.getElementById('snp-cliente');
    const inputSit = document.getElementById('snp-sitio');
    const inputEq = document.getElementById('snp-equipo');
    const inputSer = document.getElementById('snp-serie');
    const inputHoro = document.getElementById('snp-horometro');
    const datalistMaq = document.getElementById('snp-lista-maquinas-proyecto');

    if (r) {
      if (inputCli) inputCli.value = r.cliente || '';
      if (inputSit) inputSit.value = r.sitio || r.obra || '';
      
      // Si el equipo está vacío, sugerir el del contrato
      if (inputEq && !inputEq.value) inputEq.value = r.equipo || '';
      if (inputSer && !inputSer.value) inputSer.value = r.serie || '';
      if (inputHoro && (!inputHoro.value || inputHoro.value === '0')) {
        inputHoro.value = r.horometro_final || r.horometro_inicial || '';
      }

      // Llenar datalist con las máquinas registradas en este proyecto o en las rentas del cliente
      if (datalistMaq) {
        const maquinasProyecto = new Set();
        if (r.equipo) maquinasProyecto.add(r.equipo);
        rentas.filter(x => x.cliente === r.cliente).forEach(x => {
          if (x.equipo) maquinasProyecto.add(x.equipo);
        });

        // Buscar máquinas en servicios anteriores de esta renta
        (window.serviciosNoPreventivos || []).filter(x => String(x.renta_id) === String(r.id)).forEach(x => {
          if (x.equipo) maquinasProyecto.add(x.equipo);
        });

        datalistMaq.innerHTML = Array.from(maquinasProyecto)
          .map(m => `<option value="${m}">`)
          .join('');
      }
    }
  };

  /**
   * Al escribir o seleccionar máquina en el modal
   */
  window.alCambiarMaquinaSNP = function() {
    const rentaId = document.getElementById('snp-renta-id')?.value;
    const eqName = document.getElementById('snp-equipo')?.value?.trim();
    if (!eqName) return;

    // Buscar si existe un servicio previo con este equipo para autorellenar serie u horómetro
    const servicios = Array.isArray(window.serviciosNoPreventivos) ? window.serviciosNoPreventivos : [];
    const prev = servicios.find(s => (s.equipo || '').toLowerCase() === eqName.toLowerCase());

    const inputSer = document.getElementById('snp-serie');
    const inputHoro = document.getElementById('snp-horometro');

    if (prev) {
      if (inputSer && !inputSer.value) inputSer.value = prev.serie || '';
      if (inputHoro && !inputHoro.value && prev.horometro_servicio) {
        inputHoro.value = prev.horometro_servicio;
      }
    } else {
      // Buscar en el catálogo de inventario si existe
      const inv = Array.isArray(window.inventario) ? window.inventario : [];
      const matchInv = inv.find(i => (i.nombre || i.equipo || '').toLowerCase().includes(eqName.toLowerCase()));
      if (matchInv && inputSer && !inputSer.value) {
        inputSer.value = matchInv.serie || matchInv.numero_serie || '';
      }
    }
  };

  /**
   * Al cambiar la fecha del servicio
   */
  window.alCambiarFechaSNP = function() {
    // Si se requiere alguna lógica de semana específica
  };

  /**
   * Manejo dinámico de refacciones en el servicio no preventivo
   */
  window.agregarFilaRefaccionSNP = function(item = null) {
    const tbody = document.getElementById('snp-refacciones-tbody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';

    const clave = item?.clave || '';
    const desc = item?.descripcion || '';
    const cant = item?.cantidad != null ? item.cantidad : 1;
    const unidad = item?.unidad || 'PZA';
    const costo = item?.costo_unitario != null ? item.costo_unitario : 0;
    const pagador = item?.pagado_por || 'cliente';

    tr.innerHTML = `
      <td style="padding: 0.35rem 0.5rem;">
        <input type="text" class="snp-ref-clave" value="${clave}" placeholder="REF-00" style="width:100%; padding:0.3rem 0.4rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); font-family:var(--font-mono, monospace);" />
      </td>
      <td style="padding: 0.35rem 0.5rem;">
        <input type="text" class="snp-ref-desc" value="${desc}" placeholder="Descripción de refacción o insumo" required style="width:100%; padding:0.3rem 0.4rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);" />
      </td>
      <td style="padding: 0.35rem 0.5rem;">
        <input type="number" class="snp-ref-cant" value="${cant}" min="0.1" step="any" onchange="window.recalcularTotalesRefaccionesSNP()" style="width:100%; padding:0.3rem 0.4rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); text-align:center;" />
      </td>
      <td style="padding: 0.35rem 0.5rem;">
        <select class="snp-ref-unidad" style="width:100%; padding:0.3rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);">
          <option value="PZA" ${unidad === 'PZA' ? 'selected' : ''}>PZA</option>
          <option value="LTS" ${unidad === 'LTS' ? 'selected' : ''}>LTS</option>
          <option value="MTS" ${unidad === 'MTS' ? 'selected' : ''}>MTS</option>
          <option value="KGS" ${unidad === 'KGS' ? 'selected' : ''}>KGS</option>
          <option value="JGO" ${unidad === 'JGO' ? 'selected' : ''}>JGO</option>
          <option value="SERV" ${unidad === 'SERV' ? 'selected' : ''}>SERV</option>
        </select>
      </td>
      <td style="padding: 0.35rem 0.5rem;">
        <input type="number" class="snp-ref-costo" value="${costo}" min="0" step="any" onchange="window.recalcularTotalesRefaccionesSNP()" style="width:100%; padding:0.3rem 0.4rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary); text-align:right;" />
      </td>
      <td style="padding: 0.35rem 0.5rem; text-align:right; font-weight:600; color:var(--text-primary);">
        <span class="snp-ref-subtotal">$0.00</span>
      </td>
      <td style="padding: 0.35rem 0.5rem;">
        <select class="snp-ref-pagador" style="width:100%; padding:0.3rem; font-size:0.78rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-primary); color:var(--text-primary);">
          <option value="cliente" ${pagador === 'cliente' ? 'selected' : ''}>Cliente</option>
          <option value="eurorep" ${pagador === 'eurorep' ? 'selected' : ''}>Eurorep</option>
          <option value="garantia" ${pagador === 'garantia' ? 'selected' : ''}>Garantía</option>
        </select>
      </td>
      <td style="padding: 0.35rem 0.5rem; text-align:center;">
        <button type="button" onclick="window.eliminarFilaRefaccionSNP(this)" style="background:transparent; border:none; color:#ef4444; cursor:pointer; padding:0.2rem; border-radius:4px; display:inline-flex; align-items:center; justify-content:center;">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
    if (window.lucide) window.lucide.createIcons();
    window.recalcularTotalesRefaccionesSNP();
  };

  window.eliminarFilaRefaccionSNP = function(btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
    window.recalcularTotalesRefaccionesSNP();
  };

  window.recalcularTotalesRefaccionesSNP = function() {
    const tbody = document.getElementById('snp-refacciones-tbody');
    const labelTotal = document.getElementById('snp-refacciones-total-label');
    if (!tbody) return 0;

    let sumaTotal = 0;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(tr => {
      const cant = parseFloat(tr.querySelector('.snp-ref-cant')?.value) || 0;
      const costo = parseFloat(tr.querySelector('.snp-ref-costo')?.value) || 0;
      const subtotal = cant * costo;
      sumaTotal += subtotal;

      const subtotalEl = tr.querySelector('.snp-ref-subtotal');
      if (subtotalEl) {
        subtotalEl.textContent = formatMoney(subtotal);
      }
    });

    if (labelTotal) {
      labelTotal.textContent = formatMoney(sumaTotal);
    }
    return sumaTotal;
  };

  /**
   * Manejo de Evidencias Fotográficas
   */
  window.manejarSubidaFotosSNP = function(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(evt) {
        snpFotosAdjuntas.push({
          url: evt.target.result,
          fecha: new Date().toISOString(),
          nombre: file.name
        });
        renderGaleriaFotosSNP();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  function renderGaleriaFotosSNP() {
    const cont = document.getElementById('snp-galeria-fotos');
    if (!cont) return;

    if (!snpFotosAdjuntas.length) {
      cont.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Sin fotos adjuntas aún.</span>';
      return;
    }

    cont.innerHTML = snpFotosAdjuntas.map((f, i) => `
      <div style="position: relative; width: 68px; height: 68px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
        <img src="${f.url}" alt="Foto ${i+1}" style="width: 100%; height: 100%; object-fit: cover;" />
        <button type="button" onclick="window.eliminarFotoSNP(${i})" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.85); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; padding: 0;">&times;</button>
      </div>
    `).join('');
  }

  window.eliminarFotoSNP = function(idx) {
    snpFotosAdjuntas.splice(idx, 1);
    renderGaleriaFotosSNP();
  };

  /**
   * Inicialización de Canvases de Firmas Táctiles
   */
  function inicializarCanvasesFirmasSNP() {
    canvasTecnico = document.getElementById('snp-canvas-firma-tecnico');
    canvasCliente = document.getElementById('snp-canvas-firma-cliente');

    function setupCanvas(canvas, isTecnico) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: (clientX - rect.left) * (canvas.width / rect.width),
          y: (clientY - rect.top) * (canvas.height / rect.height)
        };
      }

      function startDraw(e) {
        e.preventDefault();
        if (isTecnico) dibujandoTecnico = true;
        else dibujandoCliente = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }

      function draw(e) {
        if (isTecnico && !dibujandoTecnico) return;
        if (!isTecnico && !dibujandoCliente) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      function stopDraw(e) {
        if (isTecnico) dibujandoTecnico = false;
        else dibujandoCliente = false;
      }

      canvas.onmousedown = startDraw;
      canvas.onmousemove = draw;
      canvas.onmouseup = stopDraw;
      canvas.onmouseleave = stopDraw;

      canvas.ontouchstart = startDraw;
      canvas.ontouchmove = draw;
      canvas.ontouchend = stopDraw;
    }

    setupCanvas(canvasTecnico, true);
    setupCanvas(canvasCliente, false);
  }

  window.limpiarFirmaTecnicoSNP = function() {
    if (canvasTecnico) {
      const ctx = canvasTecnico.getContext('2d');
      ctx.clearRect(0, 0, canvasTecnico.width, canvasTecnico.height);
    }
  };

  window.limpiarFirmaClienteSNP = function() {
    if (canvasCliente) {
      const ctx = canvasCliente.getContext('2d');
      ctx.clearRect(0, 0, canvasCliente.width, canvasCliente.height);
    }
  };

  /**
   * Abrir modal para Captura / Edición de Servicio No Preventivo
   */
  window.abrirModalServicioNoPreventivo = function(snpId = null, defaults = {}) {
    snpEnEdicionId = snpId;
    snpFotosAdjuntas = [];

    const overlay = document.getElementById('modal-servicio-no-preventivo-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    // Helper funciones de valor
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v != null ? v : ''; };

    // Llenar contratos de renta activos
    const selRenta = document.getElementById('snp-renta-id');
    if (selRenta) {
      selRenta.innerHTML = '<option value="">-- Seleccionar Renta Activa --</option>';
      const rentas = Array.isArray(window.rentas) ? window.rentas : [];
      rentas.forEach(r => {
        const label = `${r.folio || 'REN'} - ${r.cliente || 'Sin Cliente'} (${r.equipo || 'Equipo'})`;
        selRenta.innerHTML += `<option value="${r.id}">${label}</option>`;
      });
    }

    // Llenar datalist de técnicos disponibles
    const dlTecnicos = document.getElementById('snp-tecnicos-datalist');
    if (dlTecnicos) {
      const tecnicosSet = new Set();
      (window.serviciosNoPreventivos || []).forEach(s => {
        if (s.tecnico_nombre) tecnicosSet.add(s.tecnico_nombre);
      });
      (window.serviciosPreventivos || []).forEach(s => {
        if (s.operador_nombre) tecnicosSet.add(s.operador_nombre);
      });
      // Agregar usuario actual si existe
      if (window.currentUser?.nombre) tecnicosSet.add(window.currentUser.nombre);
      dlTecnicos.innerHTML = Array.from(tecnicosSet).map(t => `<option value="${t}">`).join('');
    }

    // Valores por defecto
    const hoy = new Date().toISOString().substring(0, 10);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    setVal('snp-id', '');
    setVal('snp-fecha', defaults.fecha || hoy);
    setVal('snp-hora-inicio', defaults.horaInicio || `${hh}:${mm}`);
    setVal('snp-hora-fin', defaults.horaFin || '');
    setVal('snp-tecnico-nombre', defaults.tecnico || (window.currentUser?.nombre || ''));
    setVal('snp-equipo', defaults.equipo || '');
    setVal('snp-serie', defaults.serie || '');
    setVal('snp-horometro', defaults.horometro || '');
    setVal('snp-tipo-trabajo', 'Correctivo Mecanico');
    setVal('snp-sistema', 'General');
    setVal('snp-estado-equipo', 'Operativo');
    setVal('snp-descripcion-falla', '');
    setVal('snp-solucion-aplicada', '');
    setVal('snp-nombre-recibe', '');

    const checkBolsa = document.getElementById('snp-aplica-bolsa');
    if (checkBolsa) checkBolsa.checked = true;

    // Limpiar tabla refacciones
    const tbody = document.getElementById('snp-refacciones-tbody');
    if (tbody) tbody.innerHTML = '';

    if (snpId) {
      // Modo Edición
      const snp = (window.serviciosNoPreventivos || []).find(x => x.id === snpId);
      if (snp) {
        setText('modal-snp-title', 'Editar Servicio No Preventivo');
        setText('modal-snp-folio-badge', snp.folio || 'SNP-EDIT');
        setVal('snp-id', snp.id);
        setVal('snp-renta-id', snp.renta_id || '');
        setVal('snp-cliente', snp.cliente || '');
        setVal('snp-sitio', snp.sitio || '');
        setVal('snp-equipo', snp.equipo || '');
        setVal('snp-serie', snp.serie || '');
        setVal('snp-horometro', snp.horometro_servicio || '');
        setVal('snp-tecnico-nombre', snp.tecnico_nombre || '');
        setVal('snp-fecha', snp.fecha_servicio || hoy);
        setVal('snp-hora-inicio', snp.hora_inicio || '');
        setVal('snp-hora-fin', snp.hora_fin || '');
        setVal('snp-tipo-trabajo', snp.tipo_trabajo || 'Correctivo Mecanico');
        setVal('snp-sistema', snp.sistema_afectado || 'General');
        setVal('snp-estado-equipo', snp.estado_equipo || 'Operativo');
        setVal('snp-descripcion-falla', snp.descripcion_falla || '');
        setVal('snp-solucion-aplicada', snp.solucion_aplicada || '');
        setVal('snp-nombre-recibe', snp.nombre_recibe || '');

        if (checkBolsa) checkBolsa.checked = snp.aplica_bolsa_horas !== false;

        // Cargar refacciones
        if (Array.isArray(snp.refacciones)) {
          snp.refacciones.forEach(r => window.agregarFilaRefaccionSNP(r));
        }

        // Cargar fotos
        if (Array.isArray(snp.evidencias)) {
          snpFotosAdjuntas = [...snp.evidencias];
        }
      }
    } else {
      // Modo Nuevo
      setText('modal-snp-title', 'Servicio NO Preventivo / Soporte en Sitio');
      setText('modal-snp-folio-badge', window.generarSiguienteFolioSNP ? window.generarSiguienteFolioSNP() : 'SNP-AUTO');

      if (defaults.rentaId) {
        setVal('snp-renta-id', defaults.rentaId);
        window.alCambiarRentaEnServicioNoPreventivo();
      } else {
        // Preseleccionar renta del filtro si hay una seleccionada
        const selFiltro = document.getElementById('snp-filtro-renta-bolsa');
        if (selFiltro && selFiltro.value && selFiltro.value !== 'todas') {
          setVal('snp-renta-id', selFiltro.value);
          window.alCambiarRentaEnServicioNoPreventivo();
        }
      }
    }

    renderGaleriaFotosSNP();
    window.recalcularHorasTrabajadasSNP();
    window.recalcularTotalesRefaccionesSNP();

    // Inicializar canvas de firmas
    setTimeout(() => {
      inicializarCanvasesFirmasSNP();
      window.limpiarFirmaTecnicoSNP();
      window.limpiarFirmaClienteSNP();

      if (snpId) {
        const snp = (window.serviciosNoPreventivos || []).find(x => x.id === snpId);
        if (snp?.firma_tecnico && canvasTecnico) {
          const img = new Image();
          img.onload = () => canvasTecnico.getContext('2d').drawImage(img, 0, 0);
          img.src = snp.firma_tecnico;
        }
        if (snp?.firma_cliente && canvasCliente) {
          const img = new Image();
          img.onload = () => canvasCliente.getContext('2d').drawImage(img, 0, 0);
          img.src = snp.firma_cliente;
        }
      }
    }, 150);

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Cerrar modal de Servicio No Preventivo
   */
  window.cerrarModalServicioNoPreventivo = function() {
    const overlay = document.getElementById('modal-servicio-no-preventivo-overlay');
    if (overlay) overlay.style.display = 'none';
    snpEnEdicionId = null;
    snpFotosAdjuntas = [];
  };

  /**
   * Guardar Servicio No Preventivo
   * @param {Object} options - { capturarOtra: boolean }
   */
  window.guardarServicioNoPreventivo = function(options = {}) {
    const rentaId = document.getElementById('snp-renta-id')?.value;
    const equipo = document.getElementById('snp-equipo')?.value?.trim();
    const tecnicoNombre = document.getElementById('snp-tecnico-nombre')?.value?.trim();
    const fecha = document.getElementById('snp-fecha')?.value;
    const horaInicio = document.getElementById('snp-hora-inicio')?.value;
    const horaFin = document.getElementById('snp-hora-fin')?.value;
    const descFalla = document.getElementById('snp-descripcion-falla')?.value?.trim();
    const solucion = document.getElementById('snp-solucion-aplicada')?.value?.trim();

    if (!rentaId) {
      if (typeof window.showToast === 'function') window.showToast('Selecciona el contrato de renta del proyecto.', 'warning');
      else alert('Por favor selecciona el contrato de renta del proyecto.');
      return;
    }

    if (!equipo) {
      if (typeof window.showToast === 'function') window.showToast('Indica la maquinaria intervenida.', 'warning');
      else alert('Por favor indica la maquinaria intervenida.');
      return;
    }

    if (!tecnicoNombre) {
      if (typeof window.showToast === 'function') window.showToast('Indica el nombre del técnico responsable.', 'warning');
      else alert('Por favor indica el nombre del técnico.');
      return;
    }

    if (!fecha || !horaInicio || !horaFin) {
      if (typeof window.showToast === 'function') window.showToast('Completa la fecha, hora de inicio y fin.', 'warning');
      else alert('Por favor completa fecha, hora de inicio y hora de fin.');
      return;
    }

    if (!descFalla || !solucion) {
      if (typeof window.showToast === 'function') window.showToast('Describe la falla y la solución aplicada.', 'warning');
      else alert('Por favor describe la falla y las tareas realizadas.');
      return;
    }

    const horasTrabajadas = window.recalcularHorasTrabajadasSNP() || 0;
    const horometro = parseFloat(document.getElementById('snp-horometro')?.value) || null;
    const aplicaBolsa = document.getElementById('snp-aplica-bolsa')?.checked !== false;

    // Buscar contrato de renta
    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const renta = rentas.find(x => String(x.id) === String(rentaId));

    // Recolectar refacciones
    const refacciones = [];
    const tbody = document.getElementById('snp-refacciones-tbody');
    let totalRefacciones = 0;
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(tr => {
        const desc = tr.querySelector('.snp-ref-desc')?.value?.trim();
        if (desc) {
          const cant = parseFloat(tr.querySelector('.snp-ref-cant')?.value) || 1;
          const costo = parseFloat(tr.querySelector('.snp-ref-costo')?.value) || 0;
          const sub = cant * costo;
          totalRefacciones += sub;
          refacciones.push({
            clave: tr.querySelector('.snp-ref-clave')?.value?.trim() || '',
            descripcion: desc,
            cantidad: cant,
            unidad: tr.querySelector('.snp-ref-unidad')?.value || 'PZA',
            costo_unitario: costo,
            subtotal: sub,
            pagado_por: tr.querySelector('.snp-ref-pagador')?.value || 'cliente'
          });
        }
      });
    }

    // Firmas digitales en Base64
    let firmaTecBase64 = null;
    let firmaCliBase64 = null;
    if (canvasTecnico) {
      try { firmaTecBase64 = canvasTecnico.toDataURL('image/png'); } catch (e) {}
    }
    if (canvasCliente) {
      try { firmaCliBase64 = canvasCliente.toDataURL('image/png'); } catch (e) {}
    }

    // Identificador único
    const id = snpEnEdicionId || (crypto.randomUUID ? crypto.randomUUID() : 'snp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

    // Detección de Sandbox
    const activeSandbox = (typeof isTestModeActive === 'function' && isTestModeActive());
    const rentaEsPrueba = Boolean(renta && typeof isTestData === 'function' && isTestData(renta));
    const isTest = activeSandbox || rentaEsPrueba;

    // Folio
    let folio = document.getElementById('modal-snp-folio-badge')?.textContent;
    if (!folio || folio === 'SNP-AUTO') {
      folio = window.generarSiguienteFolioSNP ? window.generarSiguienteFolioSNP() : `SNP-${new Date().getFullYear()}-0001`;
    }

    const isoWeek = getNumeroSemanaISO(fecha);

    const snpExistente = snpEnEdicionId ? (window.serviciosNoPreventivos || []).find(x => x.id === snpEnEdicionId) : null;
    const finalEsPrueba = snpExistente ? (snpExistente.esPrueba === true || snpExistente.es_prueba === true || isTest) : isTest;

    const nuevoSNP = {
      id: id,
      folio: folio,
      renta_id: rentaId,
      renta_folio: renta?.folio || '',
      cliente: document.getElementById('snp-cliente')?.value || renta?.cliente || '',
      sitio: document.getElementById('snp-sitio')?.value || renta?.sitio || '',
      equipo: equipo,
      serie: document.getElementById('snp-serie')?.value || '',
      horometro_servicio: horometro,
      tecnico_nombre: tecnicoNombre,
      tecnico_id: null,
      fecha_servicio: fecha,
      semana_ano: isoWeek.clave,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      horas_trabajadas: horasTrabajadas,
      aplica_bolsa_horas: aplicaBolsa,
      tipo_trabajo: document.getElementById('snp-tipo-trabajo')?.value || 'Correctivo Mecanico',
      sistema_afectado: document.getElementById('snp-sistema')?.value || 'General',
      estado_equipo: document.getElementById('snp-estado-equipo')?.value || 'Operativo',
      descripcion_falla: descFalla,
      solucion_aplicada: solucion,
      refacciones: refacciones,
      monto_refacciones: totalRefacciones,
      evidencias: snpFotosAdjuntas,
      firma_tecnico: firmaTecBase64,
      firma_cliente: firmaCliBase64,
      nombre_recibe: document.getElementById('snp-nombre-recibe')?.value || '',
      es_prueba: finalEsPrueba,
      esPrueba: finalEsPrueba,
      created_at: snpExistente?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Actualizar horómetro en el contrato de renta si corresponde
    if (renta && horometro) {
      if (renta.horometro_final == null || horometro > Number(renta.horometro_final)) {
        renta.horometro_final = horometro;
        try {
          const rKey = (typeof isTestModeActive === 'function' && isTestModeActive()) ? 'sapi_rentas_sandbox' : 'sapi_rentas';
          localStorage.setItem(rKey, JSON.stringify(window.rentas));
          if (window.pushToSupabase) window.pushToSupabase('rentas', renta);
        } catch (eH) {
          console.warn('[ServiciosNoPreventivos] Error actualizando horómetro de renta:', eH);
        }
      }
    }

    // Guardar en memoria
    const idx = (window.serviciosNoPreventivos || []).findIndex(x => x.id === id);
    if (idx >= 0) {
      window.serviciosNoPreventivos[idx] = nuevoSNP;
    } else {
      window.serviciosNoPreventivos.unshift(nuevoSNP);
    }

    // Persistir en LocalStorage / Bridge
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(window.serviciosNoPreventivos));
    } catch (eS) {
      console.error('[ServiciosNoPreventivos] Error al guardar en storage:', eS);
    }

    // Sincronizar en segundo plano con Supabase si está disponible
    if (typeof window.pushToSupabase === 'function') {
      try {
        window.pushToSupabase('servicios_no_preventivos', nuevoSNP);
      } catch (eSync) {
        console.warn('[ServiciosNoPreventivos] Pendiente de sincronización Supabase:', eSync);
      }
    }

    // Actualizar UI de fondo
    window.renderServiciosNoPreventivos();

    // Comportamiento según acción rápida: ¿Capturar otra máquina hoy?
    if (options.capturarOtra) {
      if (typeof window.showToast === 'function') {
        window.showToast(`Servicio ${folio} guardado. Listo para capturar la siguiente máquina de la jornada.`, 'success');
      } else {
        alert(`Servicio ${folio} guardado. Puedes registrar la siguiente máquina.`);
      }

      // Reiniciar campos específicos de la máquina, pero conservar Proyecto, Cliente, Sitio, Fecha y Técnico
      snpEnEdicionId = null;
      snpFotosAdjuntas = [];

      document.getElementById('snp-id').value = '';
      document.getElementById('modal-snp-title').textContent = 'Servicio NO Preventivo / Siguiente Máquina';
      document.getElementById('modal-snp-folio-badge').textContent = window.generarSiguienteFolioSNP ? window.generarSiguienteFolioSNP() : 'SNP-AUTO';
      
      document.getElementById('snp-equipo').value = '';
      document.getElementById('snp-serie').value = '';
      document.getElementById('snp-horometro').value = '';
      document.getElementById('snp-descripcion-falla').value = '';
      document.getElementById('snp-solucion-aplicada').value = '';
      document.getElementById('snp-estado-equipo').value = 'Operativo';

      // Siguiente horario sugerido: el fin del anterior pasa a ser el inicio del nuevo
      if (horaFin) {
        document.getElementById('snp-hora-inicio').value = horaFin;
        document.getElementById('snp-hora-fin').value = '';
      }

      const tbodyRef = document.getElementById('snp-refacciones-tbody');
      if (tbodyRef) tbodyRef.innerHTML = '';
      window.recalcularTotalesRefaccionesSNP();
      window.recalcularHorasTrabajadasSNP();
      renderGaleriaFotosSNP();

      window.limpiarFirmaTecnicoSNP();
      window.limpiarFirmaClienteSNP();

      // Enfocar selector de equipo
      setTimeout(() => {
        document.getElementById('snp-equipo')?.focus();
      }, 100);

    } else {
      if (typeof window.showToast === 'function') {
        window.showToast(`Servicio ${folio} registrado con éxito.`, 'success');
      }
      window.cerrarModalServicioNoPreventivo();
    }
  };

  /**
   * Acción rápida: Guardar y Capturar Otra Máquina de la Jornada
   */
  window.guardarYCapturarOtraMaquinaSNP = function() {
    window.guardarServicioNoPreventivo({ capturarOtra: true });
  };

  /**
   * Iniciar captura rápida multimáquina de la jornada
   */
  window.abrirCapturaMultimaquinaSNP = function() {
    window.abrirModalServicioNoPreventivo(null, {
      fecha: new Date().toISOString().substring(0, 10),
      tecnico: window.currentUser?.nombre || ''
    });
    if (typeof window.showToast === 'function') {
      window.showToast('Jornada Multimáquina iniciada. Usa "Guardar y Registrar Otra Máquina Hoy" entre cada equipo.', 'info');
    }
  };

  /**
   * Eliminar Servicio No Preventivo
   */
  window.eliminarServicioNoPreventivo = function(snpId) {
    if (!confirm('¿Estás seguro de eliminar este registro de servicio no preventivo?')) return;

    const idx = (window.serviciosNoPreventivos || []).findIndex(x => x.id === snpId);
    if (idx >= 0) {
      const eliminado = window.serviciosNoPreventivos.splice(idx, 1)[0];
      try {
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(window.serviciosNoPreventivos));
      } catch (e) {}

      // Si existe supabaseSync y soporte offline de eliminación
      if (window.deleteFromSupabase) {
        window.deleteFromSupabase('servicios_no_preventivos', snpId);
      }

      if (typeof window.showToast === 'function') {
        window.showToast(`Servicio ${eliminado.folio || ''} eliminado.`, 'info');
      }
      window.renderServiciosNoPreventivos();
    }
  };

  /**
   * Actualizar el Dashboard y Termómetro de Bolsa de Horas
   */
  window.actualizarBolsaHorasDashboard = function(rentaIdFiltro = null) {
    const selRenta = document.getElementById('snp-filtro-renta-bolsa');
    const rentaId = rentaIdFiltro || (selRenta ? selRenta.value : '');

    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const todosServicios = Array.isArray(window.serviciosNoPreventivos) ? window.serviciosNoPreventivos : [];

    // Poblar selector de rentas si está vacío
    if (selRenta && selRenta.options.length <= 1) {
      selRenta.innerHTML = '<option value="todas">-- Todos los Proyectos / Global --</option>';
      rentas.forEach(r => {
        selRenta.innerHTML += `<option value="${r.id}">${r.folio || 'REN'} - ${r.cliente || 'Cliente'} (${r.equipo || 'Equipo'})</option>`;
      });
      if (rentaId) selRenta.value = rentaId;
    }

    let rentaActiva = null;
    let serviciosFiltrados = todosServicios;

    if (rentaId && rentaId !== 'todas') {
      rentaActiva = rentas.find(x => String(x.id) === String(rentaId));
      serviciosFiltrados = todosServicios.filter(s => String(s.renta_id) === String(rentaId));
    }

    // Calcular bolsa contratada
    let bolsaContratada = 0;
    if (rentaActiva) {
      bolsaContratada = parseFloat(rentaActiva.bolsa_horas_total) || 50.0;
    } else {
      // Suma global de todas las bolsas de contratos activos
      bolsaContratada = rentas.reduce((acc, r) => acc + (parseFloat(r.bolsa_horas_total) || 50.0), 0);
      if (bolsaContratada === 0) bolsaContratada = 100.0;
    }

    // Horas consumidas (solo las que aplican para bolsa de horas)
    const horasConsumidas = serviciosFiltrados
      .filter(s => s.aplica_bolsa_horas !== false)
      .reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);

    const saldo = bolsaContratada - horasConsumidas;
    const porcentaje = bolsaContratada > 0 ? Math.round((horasConsumidas / bolsaContratada) * 100) : 0;

    // Actualizar KPI de Bolsa
    const elContratada = document.getElementById('stat-bolsa-contratada');
    const elConsumida = document.getElementById('stat-bolsa-consumida');
    const elSaldo = document.getElementById('stat-bolsa-saldo');
    const elStatusLabel = document.getElementById('stat-bolsa-status-label');
    const elPorcentaje = document.getElementById('stat-bolsa-porcentaje');
    const elProgressBar = document.getElementById('stat-bolsa-progress-bar');

    if (elContratada) elContratada.textContent = `${bolsaContratada.toFixed(1)} hrs`;
    if (elConsumida) elConsumida.textContent = `${horasConsumidas.toFixed(1)} hrs`;
    
    if (elSaldo) {
      if (saldo >= 0) {
        elSaldo.textContent = `${saldo.toFixed(1)} hrs`;
        elSaldo.style.color = '#10b981';
      } else {
        elSaldo.textContent = `-${Math.abs(saldo).toFixed(1)} hrs (Excedente)`;
        elSaldo.style.color = '#ef4444';
      }
    }

    // Colores y barra de progreso
    let barColor = '#10b981';
    let statusTexto = `Dentro de la bolsa (${porcentaje}%)`;

    if (porcentaje >= 100) {
      barColor = '#ef4444';
      statusTexto = `<span style="color:#ef4444; font-weight:800;">Agotada: +${Math.abs(saldo).toFixed(1)} hrs extra</span>`;
    } else if (porcentaje >= 85) {
      barColor = '#f59e0b';
      statusTexto = `<span style="color:#f59e0b; font-weight:700;">Por agotarse (${porcentaje}%)</span>`;
    } else {
      barColor = '#10b981';
      statusTexto = `<span style="color:#10b981; font-weight:700;">Dentro de la bolsa (${porcentaje}%)</span>`;
    }

    if (elStatusLabel) elStatusLabel.innerHTML = statusTexto;
    if (elPorcentaje) elPorcentaje.textContent = `${porcentaje}%`;

    if (elProgressBar) {
      elProgressBar.style.width = `${Math.min(100, Math.max(0, porcentaje))}%`;
      elProgressBar.style.background = barColor;
    }

    // Desglose de horas por maquinaria intervenida (Chips)
    const chipsCont = document.getElementById('snp-bolsa-maquinas-chips');
    if (chipsCont) {
      const horasPorMaquina = {};
      serviciosFiltrados.forEach(s => {
        const maq = (s.equipo || 'Sin Equipo').trim();
        horasPorMaquina[maq] = (horasPorMaquina[maq] || 0) + (parseFloat(s.horas_trabajadas) || 0);
      });

      const maquinasKeys = Object.keys(horasPorMaquina);
      if (maquinasKeys.length === 0) {
        chipsCont.innerHTML = '<span style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">Sin horas registradas en este contrato aún.</span>';
      } else {
        chipsCont.innerHTML = maquinasKeys.map(maq => {
          const hrs = horasPorMaquina[maq];
          return `
            <div style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 20px; padding: 0.25rem 0.65rem; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 0.4rem; color: var(--text-primary);">
              <i data-lucide="truck" style="width: 12px; height: 12px; color: #3b82f6;"></i>
              <span style="font-weight: 600;">${maq}:</span>
              <strong style="color: #3b82f6;">${hrs.toFixed(1)} hrs</strong>
            </div>
          `;
        }).join('');
      }
    }
  };

  /**
   * Al cambiar la renta en el selector de la Bolsa de Horas
   */
  window.alCambiarRentaBolsaHorasSNP = function() {
    window.actualizarBolsaHorasDashboard();
    window.renderServiciosNoPreventivos();
  };

  /**
   * Renderizar la lista principal de Servicios No Preventivos (Desktop y Móvil)
   */
  window.renderServiciosNoPreventivos = function() {
    cargarServiciosNoPreventivosDesdeStorage();

    const tbody = document.getElementById('no-preventivos-table-body');
    const mobileCards = document.getElementById('no-preventivos-cards-mobile');
    const searchInput = document.getElementById('search-no-preventivos');
    const term = (searchInput?.value || '').toLowerCase().trim();

    const selRentaBolsa = document.getElementById('snp-filtro-renta-bolsa');
    const rentaFiltro = selRentaBolsa?.value || '';

    let lista = Array.isArray(window.serviciosNoPreventivos) ? [...window.serviciosNoPreventivos] : [];

    // Poblar selector de semanas en la barra de filtros
    const selSemana = document.getElementById('snp-filtro-semana');
    if (selSemana) {
      const semanasSet = new Map();
      lista.forEach(s => {
        if (s.fecha_servicio) {
          const iso = getNumeroSemanaISO(s.fecha_servicio);
          if (!semanasSet.has(iso.clave)) {
            semanasSet.set(iso.clave, iso.label);
          }
        }
      });

      const valorPrevio = selSemana.value || 'todas';
      selSemana.innerHTML = '<option value="todas">Todas las Semanas</option>';
      Array.from(semanasSet.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([clave, label]) => {
          selSemana.innerHTML += `<option value="${clave}">${label}</option>`;
        });
      selSemana.value = valorPrevio;
    }

    // Filtrar por término de búsqueda
    if (term) {
      lista = lista.filter(s => {
        return (s.folio || '').toLowerCase().includes(term) ||
               (s.cliente || '').toLowerCase().includes(term) ||
               (s.equipo || '').toLowerCase().includes(term) ||
               (s.serie || '').toLowerCase().includes(term) ||
               (s.tecnico_nombre || '').toLowerCase().includes(term) ||
               (s.descripcion_falla || '').toLowerCase().includes(term) ||
               (s.solucion_aplicada || '').toLowerCase().includes(term);
      });
    }

    // Filtrar por renta seleccionada en el módulo
    if (rentaFiltro && rentaFiltro !== 'todas') {
      lista = lista.filter(s => String(s.renta_id) === String(rentaFiltro));
    }

    // Filtrar por semana ISO
    if (currentSNPSemana && currentSNPSemana !== 'todas') {
      lista = lista.filter(s => s.semana_ano === currentSNPSemana || getNumeroSemanaISO(s.fecha_servicio).clave === currentSNPSemana);
    }

    // Conteo para pills de filtro
    const countTodos = lista.length;
    const countCorrectivo = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('correctivo')).length;
    const countElectrico = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('electrica') || (s.tipo_trabajo || '').toLowerCase().includes('electrico')).length;
    const countHidraulico = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('hidraulica') || (s.tipo_trabajo || '').toLowerCase().includes('hidraulico')).length;
    const countCalibracion = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('calibracion') || (s.tipo_trabajo || '').toLowerCase().includes('ajuste')).length;

    const setBadge = (id, c) => { const el = document.getElementById(id); if (el) el.textContent = c; };
    setBadge('count-pill-snp-todos', countTodos);
    setBadge('count-pill-snp-correctivo', countCorrectivo);
    setBadge('count-pill-snp-electrico', countElectrico);
    setBadge('count-pill-snp-hidraulico', countHidraulico);
    setBadge('count-pill-snp-calibracion', countCalibracion);

    const badgeGeneral = document.getElementById('badge-count-no-preventivos');
    if (badgeGeneral) badgeGeneral.textContent = (window.serviciosNoPreventivos || []).length;

    // Aplicar filtro de tipo
    if (currentSNPFilter === 'correctivo') {
      lista = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('correctivo'));
    } else if (currentSNPFilter === 'electrico') {
      lista = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('electrica') || (s.tipo_trabajo || '').toLowerCase().includes('electrico'));
    } else if (currentSNPFilter === 'hidraulico') {
      lista = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('hidraulica') || (s.tipo_trabajo || '').toLowerCase().includes('hidraulico'));
    } else if (currentSNPFilter === 'calibracion') {
      lista = lista.filter(s => (s.tipo_trabajo || '').toLowerCase().includes('calibracion') || (s.tipo_trabajo || '').toLowerCase().includes('ajuste'));
    }

    // Actualizar KPI Cards
    const totalHoras = lista.reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);
    const maquinasUnicas = new Set(lista.map(s => s.equipo).filter(Boolean)).size;
    const horasBolsa = lista.filter(s => s.aplica_bolsa_horas !== false).reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);
    const totalRefacciones = lista.reduce((acc, s) => acc + (parseFloat(s.monto_refacciones) || 0), 0);

    setBadge('stat-snp-total', lista.length);
    setBadge('stat-snp-horas', `${totalHoras.toFixed(1)} hrs`);
    setBadge('stat-snp-maquinas', maquinasUnicas);
    setBadge('stat-snp-bolsa-horas', `${horasBolsa.toFixed(1)} hrs`);
    setBadge('stat-snp-refacciones', formatMoney(totalRefacciones));

    // Actualizar termómetro de bolsa
    window.actualizarBolsaHorasDashboard(rentaFiltro);

    // Renderizar Desktop Table
    if (tbody) {
      if (lista.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
              <i data-lucide="wrench" style="width: 38px; height: 38px; margin-bottom: 0.5rem; opacity: 0.4;"></i>
              <p style="margin: 0; font-size: 0.9rem; font-weight: 600;">No se encontraron servicios no preventivos</p>
              <span style="font-size: 0.8rem;">Registra las intervenciones diarias del técnico asignado a obra.</span>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = lista.map(s => {
          const badgeTipo = window.obtenerBadgeTipoTrabajoSNP(s.tipo_trabajo);
          const badgeEstado = window.obtenerBadgeEstadoEquipoSNP(s.estado_equipo);
          const cantRef = Array.isArray(s.refacciones) ? s.refacciones.length : 0;
          const refTexto = cantRef > 0 ? `${cantRef} pzas (${formatMoney(s.monto_refacciones)})` : '<span style="color:var(--text-muted);">Sin ref.</span>';
          const horario = `${s.hora_inicio || '--:--'} a ${s.hora_fin || '--:--'}`;
          const bolsaBadge = s.aplica_bolsa_horas !== false 
            ? '<span title="Descontado de Bolsa de Horas" style="color:#3b82f6; font-size:0.75rem; font-weight:700;"><i data-lucide="pie-chart" style="width:11px;height:11px;display:inline-block;vertical-align:middle;"></i> Bolsa</span>'
            : '<span title="Facturable Extraordinario" style="color:#f59e0b; font-size:0.75rem;"><i data-lucide="alert-circle" style="width:11px;height:11px;display:inline-block;vertical-align:middle;"></i> Extra</span>';

          return `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 0.65rem 0.5rem; white-space: nowrap;">
                <div style="display: flex; gap: 0.25rem;">
                  <button type="button" class="btn-icon" onclick="window.abrirModalServicioNoPreventivo('${s.id}')" title="Editar Servicio" style="padding: 0.3rem; border-radius: 6px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; cursor: pointer;">
                    <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                  </button>
                  <button type="button" class="btn-icon" onclick="window.eliminarServicioNoPreventivo('${s.id}')" title="Eliminar Registro" style="padding: 0.3rem; border-radius: 6px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; cursor: pointer;">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                  </button>
                </div>
              </td>
              <td style="padding: 0.65rem 0.5rem;">
                <strong style="color: #3b82f6; font-size: 0.82rem; font-family: var(--font-mono, monospace);">${s.folio || 'SNP-AUTO'}</strong>
                ${s.es_prueba ? '<span class="badge" style="background:#ef4444;color:#fff;font-size:0.65rem;margin-left:4px;">PRUEBA</span>' : ''}
              </td>
              <td style="padding: 0.65rem 0.5rem; white-space: nowrap; font-size: 0.82rem;">
                ${s.fecha_servicio || '---'}
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.82rem; font-weight: 600;">
                ${s.tecnico_nombre || '---'}
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.82rem;">
                <div style="font-weight: 600;">${s.cliente || '---'}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">${s.sitio || s.renta_folio || ''}</div>
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.82rem;">
                <strong style="color: var(--text-primary);">${s.equipo || '---'}</strong>
                ${s.serie ? `<div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">S/N: ${s.serie}</div>` : ''}
                ${s.horometro_servicio ? `<div style="font-size: 0.72rem; color: #10b981; font-weight: 700;">${s.horometro_servicio} hrs</div>` : ''}
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.8rem; white-space: nowrap; color: var(--text-muted);">
                ${horario}
              </td>
              <td style="padding: 0.65rem 0.5rem; white-space: nowrap;">
                <strong style="font-size: 0.88rem; color: #10b981;">${(parseFloat(s.horas_trabajadas) || 0).toFixed(1)} hrs</strong>
                <div>${bolsaBadge}</div>
              </td>
              <td style="padding: 0.65rem 0.5rem;">
                ${badgeTipo}
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.8rem; max-width: 200px;">
                <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.descripcion_falla || ''}">${s.descripcion_falla || '---'}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.solucion_aplicada || ''}">${s.solucion_aplicada || ''}</div>
              </td>
              <td style="padding: 0.65rem 0.5rem; font-size: 0.78rem;">
                ${refTexto}
              </td>
              <td style="padding: 0.65rem 0.5rem; white-space: nowrap;">
                ${badgeEstado}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Renderizar Mobile Cards
    if (mobileCards) {
      if (lista.length === 0) {
        mobileCards.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);">
            <i data-lucide="wrench" style="width: 32px; height: 32px; opacity: 0.4; margin-bottom: 0.5rem;"></i>
            <p style="margin: 0; font-size: 0.85rem; font-weight: 600;">Sin servicios no preventivos registrados</p>
          </div>
        `;
      } else {
        mobileCards.innerHTML = lista.map(s => {
          const badgeTipo = window.obtenerBadgeTipoTrabajoSNP(s.tipo_trabajo);
          const badgeEstado = window.obtenerBadgeEstadoEquipoSNP(s.estado_equipo);
          const cantRef = Array.isArray(s.refacciones) ? s.refacciones.length : 0;

          return `
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <strong style="color: #3b82f6; font-size: 0.88rem; font-family: monospace;">${s.folio || 'SNP-AUTO'}</strong>
                  ${s.es_prueba ? '<span class="badge" style="background:#ef4444;color:#fff;font-size:0.65rem;">PRUEBA</span>' : ''}
                </div>
                <div>${badgeEstado}</div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <strong style="font-size: 0.95rem; color: var(--text-primary);">${s.equipo || 'Sin Equipo'}</strong>
                <span style="font-size: 0.82rem; color: #10b981; font-weight: 800;">${(parseFloat(s.horas_trabajadas) || 0).toFixed(1)} hrs</span>
              </div>

              <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">
                <div><i data-lucide="calendar" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i> ${s.fecha_servicio || ''} (${s.hora_inicio || ''} - ${s.hora_fin || ''})</div>
                <div><i data-lucide="user" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i> Técnico: <strong>${s.tecnico_nombre || '---'}</strong></div>
                <div><i data-lucide="map-pin" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i> ${s.cliente || ''} &bull; ${s.sitio || ''}</div>
              </div>

              <div style="background: var(--bg-primary); border-radius: 8px; padding: 0.65rem; border: 1px solid var(--border); font-size: 0.78rem;">
                <div style="font-weight: 700; color: #ef4444; margin-bottom: 2px;">Falla: ${s.descripcion_falla || '---'}</div>
                <div style="color: var(--text-secondary);">${s.solucion_aplicada || '---'}</div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; pt-1; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                <div>${badgeTipo}</div>
                <div style="display: flex; gap: 0.4rem;">
                  <button type="button" class="btn-secondary" onclick="window.abrirModalServicioNoPreventivo('${s.id}')" style="font-size: 0.78rem; padding: 0.25rem 0.6rem;">
                    Editar
                  </button>
                  <button type="button" class="btn-secondary" onclick="window.eliminarServicioNoPreventivo('${s.id}')" style="font-size: 0.78rem; padding: 0.25rem 0.6rem; color: #ef4444;">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Modal de Configuración de Bolsa de Horas
   */
  window.abrirModalConfigurarBolsaHoras = function(rentaIdParam = null) {
    const overlay = document.getElementById('modal-configurar-bolsa-horas-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    // Poblar contratos de renta
    const selRenta = document.getElementById('cfg-bolsa-renta-id');
    const rentas = Array.isArray(window.rentas) ? window.rentas : [];

    if (selRenta) {
      selRenta.innerHTML = '';
      rentas.forEach(r => {
        selRenta.innerHTML += `<option value="${r.id}">${r.folio || 'REN'} - ${r.cliente || 'Sin Cliente'} (${r.equipo || 'Equipo'})</option>`;
      });

      if (rentaIdParam) {
        selRenta.value = rentaIdParam;
      } else {
        const selFiltro = document.getElementById('snp-filtro-renta-bolsa');
        if (selFiltro && selFiltro.value && selFiltro.value !== 'todas') {
          selRenta.value = selFiltro.value;
        }
      }
    }

    window.alSeleccionarRentaEnConfigBolsa();
    if (window.lucide) window.lucide.createIcons();
  };

  window.cerrarModalConfigurarBolsaHoras = function() {
    const overlay = document.getElementById('modal-configurar-bolsa-horas-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  window.alSeleccionarRentaEnConfigBolsa = function() {
    const rentaId = document.getElementById('cfg-bolsa-renta-id')?.value;
    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const r = rentas.find(x => String(x.id) === String(rentaId));

    if (r) {
      document.getElementById('cfg-bolsa-horas-total').value = r.bolsa_horas_total != null ? r.bolsa_horas_total : 50;
      document.getElementById('cfg-bolsa-tarifa-excedente').value = r.bolsa_tarifa_excedente != null ? r.bolsa_tarifa_excedente : 650;
      document.getElementById('cfg-bolsa-fecha-inicio').value = r.bolsa_fecha_inicio || r.fecha_inicio || new Date().toISOString().substring(0, 10);
      document.getElementById('cfg-bolsa-notas').value = r.bolsa_notas || '';
    }
  };

  window.guardarConfiguracionBolsaHoras = function() {
    const rentaId = document.getElementById('cfg-bolsa-renta-id')?.value;
    const horasTotal = parseFloat(document.getElementById('cfg-bolsa-horas-total')?.value);
    const tarifa = parseFloat(document.getElementById('cfg-bolsa-tarifa-excedente')?.value) || 0;
    const fechaIni = document.getElementById('cfg-bolsa-fecha-inicio')?.value;
    const notas = document.getElementById('cfg-bolsa-notas')?.value?.trim();

    if (!rentaId || isNaN(horasTotal) || horasTotal <= 0) {
      alert('Por favor especifica un número válido de horas contratadas.');
      return;
    }

    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const r = rentas.find(x => String(x.id) === String(rentaId));

    if (r) {
      r.bolsa_horas_total = horasTotal;
      r.bolsa_tarifa_excedente = tarifa;
      r.bolsa_fecha_inicio = fechaIni;
      r.bolsa_notas = notas;

      // Guardar en Storage
      try {
        const isSandbox = (typeof isTestModeActive === 'function' && isTestModeActive());
        const rKey = isSandbox ? 'sapi_rentas_sandbox' : 'sapi_rentas';
        localStorage.setItem(rKey, JSON.stringify(window.rentas));
        if (typeof window.pushToSupabase === 'function') {
          window.pushToSupabase('rentas', r);
        }
      } catch (e) {
        console.error('[ServiciosNoPreventivos] Error guardando config de bolsa:', e);
      }

      if (typeof window.showToast === 'function') {
        window.showToast(`Bolsa de ${horasTotal} horas guardada para ${r.cliente || 'el contrato'}.`, 'success');
      }

      window.cerrarModalConfigurarBolsaHoras();
      window.actualizarBolsaHorasDashboard(rentaId);
      window.renderServiciosNoPreventivos();
    }
  };

  /**
   * Modal y Generador de Bitácora / Documento Semanal para Facturación
   */
  window.abrirModalReporteSemanalSNP = function() {
    const overlay = document.getElementById('modal-reporte-semanal-snp-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    // Poblar selector de rentas en el reporte
    const selRenta = document.getElementById('snp-reporte-filtro-renta');
    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    if (selRenta) {
      selRenta.innerHTML = '<option value="">-- Todos los Contratos / Proyectos --</option>';
      rentas.forEach(r => {
        selRenta.innerHTML += `<option value="${r.id}">${r.folio || 'REN'} - ${r.cliente || 'Sin Cliente'} (${r.equipo || 'Equipo'})</option>`;
      });

      // Preseleccionar renta activa si la hay
      const selBolsa = document.getElementById('snp-filtro-renta-bolsa');
      if (selBolsa && selBolsa.value && selBolsa.value !== 'todas') {
        selRenta.value = selBolsa.value;
      }
    }

    // Poblar selector de semanas del año
    const selSemana = document.getElementById('snp-reporte-filtro-semana');
    if (selSemana) {
      const semanasSet = new Map();
      (window.serviciosNoPreventivos || []).forEach(s => {
        if (s.fecha_servicio) {
          const iso = getNumeroSemanaISO(s.fecha_servicio);
          if (!semanasSet.has(iso.clave)) {
            semanasSet.set(iso.clave, iso);
          }
        }
      });

      // Si no hay ninguna, agregar la semana actual
      const actual = getNumeroSemanaISO(new Date());
      if (!semanasSet.has(actual.clave)) {
        semanasSet.set(actual.clave, actual);
      }

      selSemana.innerHTML = '';
      Array.from(semanasSet.values())
        .sort((a, b) => b.clave.localeCompare(a.clave))
        .forEach(iso => {
          const rango = getRangoFechasSemanaISO(iso.ano, iso.semana);
          selSemana.innerHTML += `<option value="${iso.clave}">${iso.label} (${rango.lunes} al ${rango.domingo})</option>`;
        });
    }

    // Poblar máquinas disponibles
    window.actualizarSelectorMaquinasReporteSNP();
    window.actualizarReporteSemanalSNP();
    if (window.lucide) window.lucide.createIcons();
  };

  window.cerrarModalReporteSemanalSNP = function() {
    const overlay = document.getElementById('modal-reporte-semanal-snp-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  window.actualizarSelectorMaquinasReporteSNP = function() {
    const selMaq = document.getElementById('snp-reporte-filtro-maquina');
    const rentaId = document.getElementById('snp-reporte-filtro-renta')?.value;
    if (!selMaq) return;

    let lista = Array.isArray(window.serviciosNoPreventivos) ? window.serviciosNoPreventivos : [];
    if (rentaId) {
      lista = lista.filter(s => String(s.renta_id) === String(rentaId));
    }

    const maquinas = new Set();
    lista.forEach(s => {
      if (s.equipo) maquinas.add(s.equipo);
    });

    selMaq.innerHTML = '<option value="">-- Todas las Máquinas --</option>';
    Array.from(maquinas).forEach(m => {
      selMaq.innerHTML += `<option value="${m}">${m}</option>`;
    });
  };

  /**
   * Generar contenido formal de la Bitácora Semanal
   */
  window.actualizarReporteSemanalSNP = function() {
    const docCont = document.getElementById('snp-reporte-semanal-documento');
    if (!docCont) return;

    const rentaId = document.getElementById('snp-reporte-filtro-renta')?.value;
    const semanaClave = document.getElementById('snp-reporte-filtro-semana')?.value;
    const maquinaFiltro = document.getElementById('snp-reporte-filtro-maquina')?.value;

    const rentas = Array.isArray(window.rentas) ? window.rentas : [];
    const renta = rentas.find(x => String(x.id) === String(rentaId));

    let lista = Array.isArray(window.serviciosNoPreventivos) ? [...window.serviciosNoPreventivos] : [];

    if (rentaId) {
      lista = lista.filter(s => String(s.renta_id) === String(rentaId));
    }
    if (semanaClave) {
      lista = lista.filter(s => s.semana_ano === semanaClave || getNumeroSemanaISO(s.fecha_servicio).clave === semanaClave);
    }
    if (maquinaFiltro) {
      lista = lista.filter(s => s.equipo === maquinaFiltro);
    }

    // Ordenar cronológicamente
    lista.sort((a, b) => (a.fecha_servicio || '').localeCompare(b.fecha_servicio || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

    // Fechas de la semana
    let rangoStr = 'Semana Actual';
    if (semanaClave && semanaClave.includes('-W')) {
      const parts = semanaClave.split('-W');
      const ano = parseInt(parts[0], 10);
      const sem = parseInt(parts[1], 10);
      const rango = getRangoFechasSemanaISO(ano, sem);
      rangoStr = `Periodo del ${rango.lunes} al ${rango.domingo} (${semanaClave})`;
    }

    // Estadísticas
    const totalHorasSemana = lista.reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);
    const horasBolsaSemana = lista.filter(s => s.aplica_bolsa_horas !== false).reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);
    const totalRefacciones = lista.reduce((acc, s) => acc + (parseFloat(s.monto_refacciones) || 0), 0);

    // Bolsa de Horas Balance antes y después
    const bolsaTotal = renta ? (parseFloat(renta.bolsa_horas_total) || 50.0) : 50.0;
    
    // Horas consumidas acumuladas en total para este contrato
    const horasConsumidasTotal = (window.serviciosNoPreventivos || [])
      .filter(s => String(s.renta_id) === String(rentaId) && s.aplica_bolsa_horas !== false)
      .reduce((acc, s) => acc + (parseFloat(s.horas_trabajadas) || 0), 0);

    const saldoRestante = bolsaTotal - horasConsumidasTotal;

    docCont.innerHTML = `
      <!-- Encabezado Oficial Eurorep -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">EUROREP S.A. DE C.V.</div>
          <div style="font-size: 0.85rem; color: #475569; font-weight: 600;">Maquinaria Pesada, Renta y Soporte Técnico Especializado en Sitio</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">RFC: EUR120315XX0 &bull; Av. Central 450, Parque Industrial &bull; Tel: (55) 4160-8000</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.1rem; font-weight: 800; color: #2563eb; text-transform: uppercase;">Bitácora Semanal de Servicio</div>
          <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a;">Control en Campo y Facturación de Bolsa</div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Fecha Emisión: ${new Date().toLocaleDateString('es-MX')}</div>
        </div>
      </div>

      <!-- Resumen del Proyecto y Arrendatario -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.84rem;">
        <div>
          <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; display: block;">Cliente / Arrendatario:</span>
          <strong style="color: #0f172a; font-size: 0.95rem;">${renta?.cliente || (lista[0]?.cliente || 'Varios Clientes')}</strong>
          <div style="color: #475569; font-size: 0.8rem; margin-top: 2px;">Obra / Frente: ${renta?.sitio || (lista[0]?.sitio || 'Obra en Campo')}</div>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; display: block;">Contrato / Semana:</span>
          <strong style="color: #0f172a;">Folio Renta: ${renta?.folio || 'GENERAL'}</strong>
          <div style="color: #2563eb; font-weight: 700; font-size: 0.82rem; margin-top: 2px;">${rangoStr}</div>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; display: block;">Estado de Bolsa de Horas:</span>
          <div>Bolsa Contratada: <strong>${bolsaTotal.toFixed(1)} hrs</strong></div>
          <div>Horas en esta Semana: <strong style="color: #2563eb;">${horasBolsaSemana.toFixed(1)} hrs</strong></div>
          <div>Saldo Restante: <strong style="color: ${saldoRestante >= 0 ? '#10b981' : '#ef4444'};">${saldoRestante.toFixed(1)} hrs</strong></div>
        </div>
      </div>

      <!-- Tabla Detallada de Intervenciones en la Semana -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
          Registro Diario de Intervenciones por Maquinaria
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 0.5rem; border: 1px solid #334155;">Folio</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Fecha</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Maquinaria y Serie</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Horómetro</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Técnico</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Tipo / Falla Reportada</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Trabajos Realizados</th>
              <th style="padding: 0.5rem; border: 1px solid #334155; text-align: right; width: 65px;">Horas</th>
              <th style="padding: 0.5rem; border: 1px solid #334155;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${lista.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; padding: 1.5rem; color: #64748b;">
                  No hay registros de servicio no preventivo para los filtros seleccionados.
                </td>
              </tr>
            ` : lista.map(s => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700; color: #2563eb;">${s.folio}</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; white-space: nowrap;">${s.fecha_servicio}<div style="font-size: 0.72rem; color: #64748b;">${s.hora_inicio || ''}-${s.hora_fin || ''}</div></td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0;"><strong>${s.equipo || ''}</strong>${s.serie ? `<div style="font-size:0.72rem; color:#64748b;">S/N: ${s.serie}</div>` : ''}</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-weight: 600;">${s.horometro_servicio ? `${s.horometro_servicio} h` : '---'}</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${s.tecnico_nombre || ''}</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0;"><strong style="color: #0f172a;">${s.tipo_trabajo || ''}</strong><div style="font-size: 0.74rem; color: #ef4444;">${s.descripcion_falla || ''}</div></td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-size: 0.76rem; color: #334155;">${s.solucion_aplicada || ''}</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #0f172a;">${(parseFloat(s.horas_trabajadas) || 0).toFixed(1)} h</td>
                <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-size: 0.74rem;">${s.estado_equipo || 'Operativo'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a;">
              <td colspan="7" style="padding: 0.6rem; text-align: right; color: #0f172a;">Total Horas de Servicio Técnico en la Semana:</td>
              <td style="padding: 0.6rem; text-align: right; color: #2563eb; font-size: 0.95rem;">${totalHorasSemana.toFixed(1)} h</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Resumen de Refacciones Utilizadas en la Semana -->
      ${totalRefacciones > 0 ? `
        <div style="margin-bottom: 1.5rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.85rem;">
          <h5 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            Refacciones e Insumos Aplicados en la Semana: Total ${formatMoney(totalRefacciones)}
          </h5>
          <div style="font-size: 0.78rem; color: #475569;">
            ${lista.flatMap(s => (s.refacciones || []).map(r => `&bull; <strong>${s.equipo}:</strong> ${r.cantidad} ${r.unidad} - ${r.descripcion} (${formatMoney(r.subtotal)} - Pagador: ${r.pagado_por})`)).join('<br/>')}
          </div>
        </div>
      ` : ''}

      <!-- Firmas de Conformidad para la Bitácora del Equipo -->
      <div style="margin-top: 2rem; border-top: 1px dashed #cbd5e1; padding-top: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; text-align: center;">
          <div>
            <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 0.25rem;">
              ${lista[0]?.firma_tecnico ? `<img src="${lista[0].firma_tecnico}" style="max-height: 55px; max-width: 180px;" />` : ''}
            </div>
            <div style="border-top: 1px solid #0f172a; padding-top: 0.4rem; font-size: 0.82rem; font-weight: 700;">
              ${lista[0]?.tecnico_nombre || 'Técnico Especialista Eurorep'}
            </div>
            <div style="font-size: 0.72rem; color: #64748b;">Firma Técnico Responsable en Sitio</div>
          </div>
          <div>
            <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 0.25rem;">
              ${lista[0]?.firma_cliente ? `<img src="${lista[0].firma_cliente}" style="max-height: 55px; max-width: 180px;" />` : ''}
            </div>
            <div style="border-top: 1px solid #0f172a; padding-top: 0.4rem; font-size: 0.82rem; font-weight: 700;">
              ${lista[0]?.nombre_recibe || 'Residente / Encargado de Maquinaria en Obra'}
            </div>
            <div style="font-size: 0.72rem; color: #64748b;">Vo.Bo. Arrendatario / Conformidad de Horas</div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 1.5rem; font-size: 0.7rem; color: #94a3b8;">
          Este documento avala las intervenciones técnicas realizadas en el proyecto y forma parte de la bitácora física de los equipos para efectos de conciliación y facturación de la Bolsa de Horas contratada.
        </div>
      </div>
    `;
  };

  /**
   * Imprimir o Guardar PDF del Reporte Semanal
   */
  window.imprimirReporteSemanalSNP = function() {
    const docEl = document.getElementById('snp-reporte-semanal-documento');
    if (!docEl) return;

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bitacora_Semanal_Maquinaria_Eurorep</title>
          <style>
            @page { size: letter portrait; margin: 12mm; }
            body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #000; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${docEl.outerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 350);
  };

  /**
   * Exportar Reporte Semanal a Excel (CSV)
   */
  window.exportarReporteSemanalExcelSNP = function() {
    const semanaClave = document.getElementById('snp-reporte-filtro-semana')?.value || 'Semana';
    const rentaId = document.getElementById('snp-reporte-filtro-renta')?.value;
    const maquinaFiltro = document.getElementById('snp-reporte-filtro-maquina')?.value;

    let lista = Array.isArray(window.serviciosNoPreventivos) ? [...window.serviciosNoPreventivos] : [];
    if (rentaId) lista = lista.filter(s => String(s.renta_id) === String(rentaId));
    if (semanaClave) lista = lista.filter(s => s.semana_ano === semanaClave || getNumeroSemanaISO(s.fecha_servicio).clave === semanaClave);
    if (maquinaFiltro) lista = lista.filter(s => s.equipo === maquinaFiltro);

    if (!lista.length) {
      alert('No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    const headers = ['Folio', 'Fecha', 'Semana', 'Técnico', 'Cliente', 'Sitio', 'Maquinaria', 'Serie', 'Horómetro', 'Hora Inicio', 'Hora Fin', 'Horas', 'Aplica Bolsa', 'Tipo Trabajo', 'Falla Reportada', 'Solución', 'Refacciones $', 'Estado'];
    const rows = lista.map(s => [
      s.folio || '',
      s.fecha_servicio || '',
      s.semana_ano || '',
      `"${(s.tecnico_nombre || '').replace(/"/g, '""')}"`,
      `"${(s.cliente || '').replace(/"/g, '""')}"`,
      `"${(s.sitio || '').replace(/"/g, '""')}"`,
      `"${(s.equipo || '').replace(/"/g, '""')}"`,
      s.serie || '',
      s.horometro_servicio || '',
      s.hora_inicio || '',
      s.hora_fin || '',
      s.horas_trabajadas || 0,
      s.aplica_bolsa_horas !== false ? 'SI' : 'NO',
      `"${(s.tipo_trabajo || '').replace(/"/g, '""')}"`,
      `"${(s.descripcion_falla || '').replace(/"/g, '""')}"`,
      `"${(s.solucion_aplicada || '').replace(/"/g, '""')}"`,
      s.monto_refacciones || 0,
      s.estado_equipo || 'Operativo'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bitacora_Semanal_SNP_${semanaClave}_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Exportar lista completa de Servicios No Preventivos a Excel
   */
  window.exportarServiciosNoPreventivosExcel = function() {
    const lista = Array.isArray(window.serviciosNoPreventivos) ? window.serviciosNoPreventivos : [];
    if (!lista.length) {
      alert('No hay registros de servicios no preventivos para exportar.');
      return;
    }

    const headers = ['Folio', 'Fecha', 'Semana', 'Técnico', 'Cliente', 'Sitio', 'Maquinaria', 'Serie', 'Horómetro', 'Horas', 'Aplica Bolsa', 'Tipo Trabajo', 'Falla', 'Solución', 'Costo Refacciones', 'Estado', 'Es Prueba'];
    const rows = lista.map(s => [
      s.folio || '',
      s.fecha_servicio || '',
      s.semana_ano || '',
      `"${(s.tecnico_nombre || '').replace(/"/g, '""')}"`,
      `"${(s.cliente || '').replace(/"/g, '""')}"`,
      `"${(s.sitio || '').replace(/"/g, '""')}"`,
      `"${(s.equipo || '').replace(/"/g, '""')}"`,
      s.serie || '',
      s.horometro_servicio || '',
      s.horas_trabajadas || 0,
      s.aplica_bolsa_horas !== false ? 'SI' : 'NO',
      `"${(s.tipo_trabajo || '').replace(/"/g, '""')}"`,
      `"${(s.descripcion_falla || '').replace(/"/g, '""')}"`,
      `"${(s.solucion_aplicada || '').replace(/"/g, '""')}"`,
      s.monto_refacciones || 0,
      s.estado_equipo || 'Operativo',
      s.es_prueba ? 'SI' : 'NO'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Servicios_No_Preventivos_Eurorep_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Inicialización al cargar el DOM
  document.addEventListener('DOMContentLoaded', function() {
    cargarServiciosNoPreventivosDesdeStorage();
    if (typeof window.renderServiciosNoPreventivos === 'function') {
      // Si la subpestaña está visible o al cambiar de pestaña
      const subtabSNP = document.getElementById('rentas-subtab-no-preventivos');
      if (subtabSNP && subtabSNP.style.display !== 'none') {
        window.renderServiciosNoPreventivos();
      }
    }
  });

})();
