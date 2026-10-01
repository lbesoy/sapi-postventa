/**
 * Módulo de Rentas de Maquinaria y Equipos - Eurorep / SAPI
 * Control de contratos, control de horómetros, check-in, check-out, alertas de vencimiento y reportería.
 */

(function() {
  'use strict';

  let currentRentasFilter = 'todas';
  let rentaEnEdicionId = null;
  let rentaEnDevolucionId = null;

  // Inicializar almacenamiento y memoria
  window.rentas = window.rentas || [];
  try {
    const stored = localStorage.getItem('sapi_rentas');
    if (stored) {
      window.rentas = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[Rentas] Error al cargar sapi_rentas de localStorage:', e);
  }

  /**
   * Determinar el estado dinámico de una renta en función de sus fechas
   */
  window.calcularEstadoRenta = function(renta) {
    if (!renta) return 'Activa';
    if (renta.estado === 'Finalizada' || renta.estado === 'Cancelada') {
      return renta.estado;
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (renta.fecha_inicio) {
      const fInicio = new Date(renta.fecha_inicio + 'T00:00:00');
      if (fInicio > hoy) {
        return 'Reservada';
      }
    }

    if (renta.fecha_fin_estimada) {
      const fFin = new Date(renta.fecha_fin_estimada + 'T23:59:59');
      const diffDias = Math.ceil((fFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) {
        return 'Vencida';
      } else if (diffDias <= 7) {
        return 'Por Vencer';
      }
    }

    return renta.estado || 'Activa';
  };

  /**
   * Obtener clase y etiqueta de badge según estado
   */
  window.obtenerBadgeRenta = function(estado) {
    switch (estado) {
      case 'Activa':
      case 'En Renta':
        return '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:600;"><i data-lucide="check-circle-2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Activa</span>';
      case 'Reservada':
        return '<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Reservada</span>';
      case 'Por Vencer':
        return '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:600;"><i data-lucide="alert-triangle" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Por Vencer</span>';
      case 'Vencida':
        return '<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:600;"><i data-lucide="alert-octagon" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Vencida</span>';
      case 'Finalizada':
        return '<span class="badge" style="background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3);font-weight:600;"><i data-lucide="archive" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> Finalizada</span>';
      case 'Cancelada':
        return '<span class="badge" style="background:rgba(239,68,68,0.1);color:#991b1b;border:1px solid rgba(239,68,68,0.2);font-weight:600;">Cancelada</span>';
      default:
        return `<span class="badge badge-secondary">${estado || 'Pendiente'}</span>`;
    }
  };

  /**
   * Cambiar filtro rápido de rentas
   */
  window.setFiltroEstadoRentas = function(filtro) {
    currentRentasFilter = filtro;
    document.querySelectorAll('.rentas-filter-pill').forEach(btn => {
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
    renderRentas();
  };

  /**
   * Renderizado principal de la vista de Rentas
   */
  window.renderRentas = function() {
    const tbody = document.getElementById('rentas-table-body');
    if (!tbody) return;

    let list = Array.isArray(window.rentas) ? [...window.rentas] : [];

    // Filtro por Sandbox / Modo Pruebas
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      const activeSandbox = isTestModeActive();
      list = list.filter(r => isTestData(r) === activeSandbox);
    }

    // Filtro por Rol de Empresa / Cliente
    const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(
      String((typeof currentSession !== 'undefined' && currentSession && currentSession.viewMode) || '').toLowerCase().trim()
    );
    if (isEmpresa && typeof usuarios !== 'undefined' && typeof currentSession !== 'undefined' && currentSession) {
      const currentUser = Array.isArray(usuarios) ? usuarios.find(u => u && u.id === currentSession.userId) : null;
      let nombreEmpresaLogged = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
      if (nombreEmpresaLogged) {
        nombreEmpresaLogged = String(nombreEmpresaLogged).toLowerCase().trim();
        list = list.filter(r => {
          const cli = String((r && r.cliente) || '').toLowerCase().trim();
          return cli === nombreEmpresaLogged;
        });
      } else {
        list = [];
      }
    }

    // Calcular estado dinámico para cada renta
    list.forEach(r => {
      r._estadoCalculado = calcularEstadoRenta(r);
    });

    // Calcular KPIs
    const totalContratos = list.length;
    const activas = list.filter(r => r._estadoCalculado === 'Activa' || r._estadoCalculado === 'Por Vencer').length;
    const porVencer = list.filter(r => r._estadoCalculado === 'Por Vencer').length;
    const vencidas = list.filter(r => r._estadoCalculado === 'Vencida').length;
    const reservadas = list.filter(r => r._estadoCalculado === 'Reservada').length;
    const finalizadas = list.filter(r => r._estadoCalculado === 'Finalizada').length;

    // Calcular ingresos mensuales estimados en rentas activas
    const ingresosEstimados = list
      .filter(r => r._estadoCalculado === 'Activa' || r._estadoCalculado === 'Por Vencer' || r._estadoCalculado === 'Vencida')
      .reduce((sum, r) => sum + (Number(r.monto_renta) || 0), 0);

    // Actualizar elementos de KPIs en el DOM
    if (document.getElementById('stat-rentas-total')) document.getElementById('stat-rentas-total').textContent = totalContratos;
    if (document.getElementById('stat-rentas-activas')) document.getElementById('stat-rentas-activas').textContent = activas;
    if (document.getElementById('stat-rentas-por-vencer')) document.getElementById('stat-rentas-por-vencer').textContent = porVencer;
    if (document.getElementById('stat-rentas-vencidas')) document.getElementById('stat-rentas-vencidas').textContent = vencidas;
    if (document.getElementById('stat-rentas-ingresos')) {
      document.getElementById('stat-rentas-ingresos').textContent = `$${Number(ingresosEstimados).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Conteo en píldoras de filtros
    if (document.getElementById('count-pill-rentas-todas')) document.getElementById('count-pill-rentas-todas').textContent = totalContratos;
    if (document.getElementById('count-pill-rentas-activas')) document.getElementById('count-pill-rentas-activas').textContent = activas;
    if (document.getElementById('count-pill-rentas-reservadas')) document.getElementById('count-pill-rentas-reservadas').textContent = reservadas;
    if (document.getElementById('count-pill-rentas-por-vencer')) document.getElementById('count-pill-rentas-por-vencer').textContent = porVencer;
    if (document.getElementById('count-pill-rentas-vencidas')) document.getElementById('count-pill-rentas-vencidas').textContent = vencidas;
    if (document.getElementById('count-pill-rentas-finalizadas')) document.getElementById('count-pill-rentas-finalizadas').textContent = finalizadas;

    // Aplicar filtro de estado seleccionado
    if (currentRentasFilter === 'activas') {
      list = list.filter(r => r._estadoCalculado === 'Activa');
    } else if (currentRentasFilter === 'reservadas') {
      list = list.filter(r => r._estadoCalculado === 'Reservada');
    } else if (currentRentasFilter === 'por_vencer') {
      list = list.filter(r => r._estadoCalculado === 'Por Vencer');
    } else if (currentRentasFilter === 'vencidas') {
      list = list.filter(r => r._estadoCalculado === 'Vencida');
    } else if (currentRentasFilter === 'finalizadas') {
      list = list.filter(r => r._estadoCalculado === 'Finalizada');
    }

    // Búsqueda por texto
    const searchTerm = (document.getElementById('search-rentas')?.value || '').toLowerCase().trim();
    if (searchTerm) {
      list = list.filter(r =>
        (r.folio || '').toLowerCase().includes(searchTerm) ||
        (r.cliente || '').toLowerCase().includes(searchTerm) ||
        (r.sitio || '').toLowerCase().includes(searchTerm) ||
        (r.equipo || '').toLowerCase().includes(searchTerm) ||
        (r.serie || '').toLowerCase().includes(searchTerm) ||
        (r.asesor_comercial || '').toLowerCase().includes(searchTerm)
      );
    }

    // Ordenar: primero las activas/vencidas, más recientes arriba
    list.sort((a, b) => new Date(b.created_at || b.fecha_inicio || 0) - new Date(a.created_at || a.fecha_inicio || 0));

    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
              <i data-lucide="key-round" style="width:42px; height:42px; stroke-width:1.5; opacity:0.4;"></i>
              <span style="font-size:1rem; font-weight:600;">No se encontraron contratos de renta</span>
              <span style="font-size:0.85rem;">Puedes registrar una nueva renta utilizando el botón superior.</span>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      actualizarBadgeRentasSidebar();
      return;
    }

    const canEdit = !isEmpresa && (typeof currentSession === 'undefined' || !currentSession || currentSession.viewMode !== 'consulta');

    list.forEach(r => {
      const tr = document.createElement('tr');
      const badgeHtml = obtenerBadgeRenta(r._estadoCalculado);
      const syncIcon = (r._synced === false) ? '<i data-lucide="cloud-off" style="width:13px;height:13px;color:var(--warning);margin-left:4px;" title="Pendiente de sincronizar con Supabase"></i>' : '';

      // Formatear periodo
      const fIni = r.fecha_inicio ? r.fecha_inicio.substring(0, 10).split('-').reverse().join('/') : '-';
      const fFin = r.fecha_fin_estimada ? r.fecha_fin_estimada.substring(0, 10).split('-').reverse().join('/') : 'Indefinido';
      const periodoTexto = `<div style="font-weight:600; font-size:0.84rem;">${fIni} ➔ ${fFin}</div>`;

      // Tarifa
      const tarifaMonto = Number(r.monto_renta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tipoTarifa = r.tarifa_tipo ? `/${r.tarifa_tipo}` : '';

      // Horómetro actual o de devolución
      const horometroInfo = r.horometro_final != null
        ? `<div style="font-size:0.82rem;"><strong>Fin:</strong> ${r.horometro_final} hrs <br/><span style="color:var(--text-muted); font-size:0.75rem;">(Uso: ${(Number(r.horometro_final) - Number(r.horometro_inicial || 0)).toFixed(1)} hrs)</span></div>`
        : `<div style="font-size:0.82rem;"><strong>Ini:</strong> ${r.horometro_inicial || 0} hrs</div>`;

      tr.innerHTML = `
        <td data-label="Acciones" style="white-space:nowrap; width:100px;">
          <div style="display:flex; gap:0.3rem; align-items:center;">
            <button class="action-btn" onclick="window.verDetalleRenta('${r.id}')" title="Ver Ficha Completa">
              <i data-lucide="eye"></i>
            </button>
            ${canEdit ? `
              <button class="action-btn" onclick="window.abrirModalNuevaRenta('${r.id}')" title="Editar Contrato">
                <i data-lucide="edit-3"></i>
              </button>
              ${r._estadoCalculado !== 'Finalizada' ? `
                <button class="action-btn" style="color:var(--accent);" onclick="window.abrirModalDevolucionRenta('${r.id}')" title="Registrar Devolución / Check-out">
                  <i data-lucide="check-square"></i>
                </button>
              ` : ''}
            ` : ''}
            <button class="action-btn" onclick="window.generarContratoRentaPDF('${r.id}')" title="Generar Contrato / Ficha PDF">
              <i data-lucide="file-text"></i>
            </button>
          </div>
        </td>
        <td data-label="Folio">
          <strong style="color:var(--text-primary); font-family:var(--font-mono, monospace); font-size:0.88rem;">${r.folio || 'REN-0000'}</strong> ${syncIcon}
        </td>
        <td data-label="Cliente">
          <div style="font-weight:600; color:var(--text-primary);">${r.cliente || 'Sin Cliente'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline-block;"></i> ${r.sitio || 'Ubicación General'}</div>
        </td>
        <td data-label="Equipo">
          <div style="font-weight:600; color:var(--text-primary);">${r.equipo || 'Maquinaria en Renta'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono, monospace);">SN: ${r.serie || 'S/N'}</div>
        </td>
        <td data-label="Periodo">${periodoTexto}</td>
        <td data-label="Horómetro">${horometroInfo}</td>
        <td data-label="Tarifa">
          <div style="font-weight:700; color:var(--text-primary);">$${tarifaMonto} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">${tipoTarifa}</span></div>
          ${r.deposito_garantia ? `<div style="font-size:0.72rem; color:var(--text-secondary);">Dep: $${Number(r.deposito_garantia).toLocaleString('es-MX')}</div>` : ''}
        </td>
        <td data-label="Estado">${badgeHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
    actualizarBadgeRentasSidebar();
  };

  /**
   * Actualizar contador de badge en barra lateral
   */
  function actualizarBadgeRentasSidebar() {
    const badge = document.getElementById('nav-badge-rentas');
    if (!badge) return;
    let list = Array.isArray(window.rentas) ? window.rentas : [];
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      const activeSandbox = isTestModeActive();
      list = list.filter(r => isTestData(r) === activeSandbox);
    }
    const activasOVencidas = list.filter(r => {
      const st = calcularEstadoRenta(r);
      return st === 'Vencida' || st === 'Por Vencer';
    }).length;

    if (activasOVencidas > 0) {
      badge.textContent = activasOVencidas;
      badge.classList.add('visible');
      badge.style.display = 'inline-flex';
      badge.style.background = '#ef4444';
      badge.style.color = '#fff';
    } else {
      badge.style.display = 'none';
      badge.classList.remove('visible');
    }
  }
  window.actualizarBadgeRentasSidebar = actualizarBadgeRentasSidebar;

  /**
   * Generar siguiente Folio consecutivo (REN-0001 o REN-PRUEBA-0001)
   */
  window.generarSiguienteFolioRenta = function() {
    const isTest = (typeof isTestModeActive === 'function' && isTestModeActive());
    const prefix = isTest ? 'REN-PRUEBA-' : 'REN-';
    const list = Array.isArray(window.rentas) ? window.rentas : [];
    let maxNum = 0;
    list.forEach(r => {
      if (r && r.folio && typeof r.folio === 'string') {
        const fUpper = r.folio.trim().toUpperCase();
        if (fUpper.startsWith(prefix.toUpperCase())) {
          const numStr = fUpper.substring(prefix.length);
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  };

  /**
   * Obtener la lista depurada y ordenada de clientes registrados (exclusivamente clientes reales de clientesDb)
   */
  window.obtenerListaSoloClientesRentas = function() {
    let list = [];
    try {
      if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0) {
        list = clientesDb;
      } else {
        const stored = localStorage.getItem('sapi_clientes_db');
        if (stored) list = JSON.parse(stored);
      }
    } catch (e) {}

    const nombresSet = new Set();
    list.forEach(c => {
      if (!c) return;
      const nom = (c.nombre || c.cliente || '').trim();
      if (!nom) return;
      const nomLower = nom.toLowerCase();
      if (nomLower.includes('duplicado') || nomLower.includes('re usar') || nomLower.includes('reusar')) return;
      if (nomLower === 'ninguno' || nomLower === 'sin cliente') return;
      nombresSet.add(nom);
    });

    return Array.from(nombresSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  };

  /**
   * Control de apertura y cierre de comboboxes personalizados en el modal de Rentas
   */
  window.toggleRentaCombo = function(id) {
    const menu = document.getElementById(id + '-menu');
    const combo = document.getElementById(id + '-combo');
    const search = document.getElementById(id + '-search');
    if (!menu || !combo) return;

    const isCurrentlyOpen = (menu.style.display === 'flex');

    // Cerrar cualquier otro combobox abierto
    document.querySelectorAll('#modal-nueva-renta .combo-menu').forEach(m => { m.style.display = 'none'; });
    document.querySelectorAll('#modal-nueva-renta .combo-box').forEach(c => { c.classList.remove('focus'); });

    if (!isCurrentlyOpen) {
      menu.style.display = 'flex';
      combo.classList.add('focus');
      if (search) {
        search.value = '';
        window.filterRentaCombo(id, '');
        setTimeout(() => search.focus(), 60);
      }
    }
  };

  /**
   * Filtrar opciones del combobox al escribir en el buscador
   */
  window.filterRentaCombo = function(id, query) {
    const q = (query || '').toLowerCase().trim();
    const container = document.getElementById(id + '-options');
    if (!container) return;

    const options = container.querySelectorAll('.combo-option:not(.combo-action-create)');
    let matchCount = 0;

    options.forEach(opt => {
      const text = opt.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        opt.style.display = 'flex';
        matchCount++;
      } else {
        opt.style.display = 'none';
      }
    });

    // Para renta-sitio: si no hay coincidencias o se está buscando y hay cliente seleccionado, permitir crear rápidamente
    const existingQuick = container.querySelector('.combo-action-create');
    if (existingQuick) existingQuick.remove();

    if (id === 'renta-sitio' && q) {
      const inputCli = document.getElementById('renta-cliente');
      const cliVal = inputCli ? inputCli.value.trim() : '';
      if (cliVal) {
        const escapedQ = query.trim().replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const quickAdd = document.createElement('div');
        quickAdd.className = 'combo-option combo-action-create';
        quickAdd.style.cssText = 'padding: 0.6rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--accent, #E8820C); font-weight: 600; display: flex; align-items: center; gap: 0.4rem; background: rgba(232,130,12,0.08); border: 1px dashed var(--accent, #E8820C); margin: 0.35rem 0.25rem;';
        quickAdd.innerHTML = `<i data-lucide="plus-circle" style="width:15px;height:15px;flex-shrink:0;"></i> <span>+ Registrar "<strong>${escapedQ}</strong>" como nuevo sitio</span>`;
        quickAdd.onclick = () => window.abrirModalNuevoSitioRentas(cliVal, query.trim());
        container.appendChild(quickAdd);
        if (window.lucide) window.lucide.createIcons();
      }
    }
  };

  /**
   * Seleccionar una opción del combobox
   */
  window.selectRentaComboOption = function(id, value, label) {
    const inputHidden = document.getElementById(id);
    const displaySpan = document.getElementById(id + '-display');
    const menu = document.getElementById(id + '-menu');
    const combo = document.getElementById(id + '-combo');

    if (inputHidden) inputHidden.value = value;
    if (displaySpan) {
      displaySpan.textContent = label || value || (id === 'renta-cliente' ? '-- Seleccionar Cliente --' : '-- Seleccione o busque un Sitio --');
      displaySpan.style.color = value ? 'var(--text-primary)' : 'var(--text-muted)';
    }
    if (menu) menu.style.display = 'none';
    if (combo) combo.classList.remove('focus');

    if (id === 'renta-cliente') {
      window.poblarRentaSitiosCombo(value, '');
      window.poblarRentaMaquinas(value, '');
    }
  };

  /**
   * Poblar opciones del combobox de clientes
   */
  window.poblarRentaClientesCombo = function(clienteSeleccionado = '') {
    const optionsContainer = document.getElementById('renta-cliente-options');
    const inputHidden = document.getElementById('renta-cliente');
    const displaySpan = document.getElementById('renta-cliente-display');
    if (!optionsContainer) return;

    const clientes = window.obtenerListaSoloClientesRentas();

    let html = '';
    clientes.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const isSel = (nombre === clienteSeleccionado);
      html += `
        <div class="combo-option ${isSel ? 'selected' : ''}" 
             style="padding: 0.55rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--text-primary); transition: background 0.15s; display: flex; align-items: center; justify-content: space-between;" 
             onmouseover="this.style.background='var(--bg-hover)'; this.style.color='var(--accent)';" 
             onmouseout="this.style.background='transparent'; this.style.color='var(--text-primary)';" 
             onclick="window.selectRentaComboOption('renta-cliente', '${escaped}', '${escaped}')">
          <span>${nombre}</span>
          ${isSel ? '<i data-lucide="check" style="width:14px;height:14px;color:var(--accent);"></i>' : ''}
        </div>
      `;
    });

    if (clientes.length === 0) {
      html = '<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">No hay clientes registrados</div>';
    }

    optionsContainer.innerHTML = html;

    if (clienteSeleccionado) {
      if (inputHidden) inputHidden.value = clienteSeleccionado;
      if (displaySpan) {
        displaySpan.textContent = clienteSeleccionado;
        displaySpan.style.color = 'var(--text-primary)';
      }
    } else {
      if (inputHidden) inputHidden.value = '';
      if (displaySpan) {
        displaySpan.textContent = '-- Seleccionar Cliente --';
        displaySpan.style.color = 'var(--text-muted)';
      }
    }
    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Obtener lista de sitios registrados exclusivamente para un cliente dado
   */
  window.obtenerListaSitiosPorClienteRentas = function(clienteNombre) {
    if (!clienteNombre || !String(clienteNombre).trim()) return [];

    let cDb = [];
    try {
      if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0) {
        cDb = clientesDb;
      } else {
        const stored = localStorage.getItem('sapi_clientes_db');
        if (stored) cDb = JSON.parse(stored);
      }
    } catch (e) {}

    let sDb = [];
    try {
      if (typeof sitiosDb !== 'undefined' && Array.isArray(sitiosDb) && sitiosDb.length > 0) {
        sDb = sitiosDb;
      } else {
        const stored = localStorage.getItem('sapi_sitios_db');
        if (stored) sDb = JSON.parse(stored);
      }
    } catch (e) {}

    const cliLower = String(clienteNombre).toLowerCase().trim();

    // 1. Localizar objeto de cliente en clientesDb
    const clienteObj = (cDb || []).find(c => {
      if (!c) return false;
      const cNom = String(c.nombre || c.cliente || '').toLowerCase().trim();
      const cRazon = String(c.razon_social || '').toLowerCase().trim();
      const cId = String(c.id || '').toLowerCase().trim();
      const cInt = String(c.idInterno || '').toLowerCase().trim();
      const cRfc = String(c.rfc || '').toLowerCase().trim();
      return cNom === cliLower || cRazon === cliLower || cId === cliLower || cInt === cliLower || cRfc === cliLower;
    });

    const candidateKeys = new Set([cliLower]);
    if (clienteObj) {
      if (clienteObj.id) candidateKeys.add(String(clienteObj.id).toLowerCase().trim());
      if (clienteObj.idInterno) candidateKeys.add(String(clienteObj.idInterno).toLowerCase().trim());
      if (clienteObj.rfc) candidateKeys.add(String(clienteObj.rfc).toLowerCase().trim());
      if (clienteObj.nombre) candidateKeys.add(String(clienteObj.nombre).toLowerCase().trim());
      if (clienteObj.razon_social) candidateKeys.add(String(clienteObj.razon_social).toLowerCase().trim());
      if (clienteObj.alias) candidateKeys.add(String(clienteObj.alias).toLowerCase().trim());
    }

    const sitiosUnicos = new Set();

    // 2. Sitios en tabla / array global de sitios (sitiosDb)
    (sDb || []).forEach(s => {
      if (!s) return;
      const sCli = String(s.cliente || '').toLowerCase().trim();
      const sCliCustom = String(s.customData?.clienteNombre || s.clienteNombre || '').toLowerCase().trim();
      if (candidateKeys.has(sCli) || (sCliCustom && candidateKeys.has(sCliCustom))) {
        const nom = String(s.nombre || s.direccion || '').trim();
        if (nom && !nom.toLowerCase().includes('duplicado') && !nom.toLowerCase().includes('re usar') && nom.toLowerCase() !== 'n/a' && nom.toLowerCase() !== 'ninguno') {
          sitiosUnicos.add(nom);
        }
      }
    });

    // 3. Sitios incrustados en el propio cliente (c.sitios)
    if (clienteObj && Array.isArray(clienteObj.sitios)) {
      clienteObj.sitios.forEach(s => {
        let nom = '';
        if (typeof s === 'string') {
          nom = s.trim();
        } else if (s && typeof s === 'object') {
          nom = String(s.nombre || s.direccion || '').trim();
        }
        if (nom && !nom.toLowerCase().includes('duplicado') && !nom.toLowerCase().includes('re usar') && nom.toLowerCase() !== 'n/a' && nom.toLowerCase() !== 'ninguno') {
          sitiosUnicos.add(nom);
        }
      });
    }

    // 4. Ubicación principal/matriz si existe
    if (clienteObj && clienteObj.ubicacion && typeof clienteObj.ubicacion === 'string') {
      const u = clienteObj.ubicacion.trim();
      if (u && !u.toLowerCase().includes('duplicado') && !u.toLowerCase().includes('re usar') && u.toLowerCase() !== 'n/a' && u.toLowerCase() !== 'ninguno') {
        sitiosUnicos.add(u);
      }
    }

    return Array.from(sitiosUnicos).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  };

  /**
   * Poblar opciones del combobox de sitios según cliente
   */
  window.poblarRentaSitiosCombo = function(clienteNombre = '', sitioSeleccionado = '') {
    const optionsContainer = document.getElementById('renta-sitio-options');
    const inputHidden = document.getElementById('renta-sitio');
    const displaySpan = document.getElementById('renta-sitio-display');
    if (!optionsContainer) return;

    if (!clienteNombre || !String(clienteNombre).trim()) {
      optionsContainer.innerHTML = `
        <div style="padding: 1rem; color: var(--text-muted, #94a3b8); font-size: 0.85rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.4rem;">
          <i data-lucide="info" style="width: 18px; height: 18px; color: var(--accent, #E8820C);"></i>
          <span>Primero selecciona un <strong>Cliente</strong> para ver sus sitios dados de alta.</span>
        </div>
      `;
      if (inputHidden) inputHidden.value = '';
      if (displaySpan) {
        displaySpan.textContent = '-- Seleccione primero un Cliente --';
        displaySpan.style.color = 'var(--text-muted)';
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const sitios = window.obtenerListaSitiosPorClienteRentas(clienteNombre);

    const escapedCli = clienteNombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    let html = `
      <div class="combo-option ${!sitioSeleccionado ? 'selected' : ''}" 
           style="padding: 0.55rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--text-muted); font-style: italic; transition: background 0.15s; display: flex; align-items: center; justify-content: space-between;" 
           onmouseover="this.style.background='var(--bg-hover)';" 
           onmouseout="this.style.background='transparent';" 
           onclick="window.selectRentaComboOption('renta-sitio', '', 'Ubicación General (Sin sitio específico)')">
        <span>Ubicación General (Sin sitio específico)</span>
        ${!sitioSeleccionado ? '<i data-lucide="check" style="width:14px;height:14px;color:var(--accent);"></i>' : ''}
      </div>
    `;

    sitios.forEach(sitio => {
      const escaped = sitio.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const isSel = (sitio === sitioSeleccionado);
      html += `
        <div class="combo-option ${isSel ? 'selected' : ''}" 
             style="padding: 0.55rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--text-primary); transition: background 0.15s; display: flex; align-items: center; justify-content: space-between;" 
             onmouseover="this.style.background='var(--bg-hover)'; this.style.color='var(--accent)';" 
             onmouseout="this.style.background='transparent'; this.style.color='var(--text-primary)';" 
             onclick="window.selectRentaComboOption('renta-sitio', '${escaped}', '${escaped}')">
          <span>${sitio}</span>
          ${isSel ? '<i data-lucide="check" style="width:14px;height:14px;color:var(--accent);"></i>' : ''}
        </div>
      `;
    });

    if (sitios.length === 0) {
      html += `
        <div style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">
          Este cliente no tiene sucursales o sitios dados de alta.
        </div>
        <div class="combo-option" 
             style="padding: 0.6rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--accent, #E8820C); font-weight: 600; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.4rem; border: 1px dashed var(--accent, #E8820C); margin: 0.35rem 0.25rem;" 
             onmouseover="this.style.background='rgba(232,130,12,0.1)';" 
             onmouseout="this.style.background='transparent';" 
             onclick="window.abrirModalNuevoSitioRentas('${escapedCli}')">
          <i data-lucide="plus-circle" style="width:15px; height:15px;"></i>
          <span>+ Registrar Nuevo Sitio para este Cliente</span>
        </div>
      `;
    } else {
      html += `
        <div class="combo-option" 
             style="padding: 0.55rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; color: var(--accent, #E8820C); font-weight: 600; transition: background 0.15s; display: flex; align-items: center; gap: 0.4rem; border-top: 1px solid var(--border, #334155); margin-top: 0.35rem;" 
             onmouseover="this.style.background='rgba(232,130,12,0.1)';" 
             onmouseout="this.style.background='transparent';" 
             onclick="window.abrirModalNuevoSitioRentas('${escapedCli}')">
          <i data-lucide="plus" style="width:14px; height:14px;"></i>
          <span>+ Registrar otro sitio para este cliente</span>
        </div>
      `;
    }

    optionsContainer.innerHTML = html;

    if (sitioSeleccionado) {
      if (inputHidden) inputHidden.value = sitioSeleccionado;
      if (displaySpan) {
        displaySpan.textContent = sitioSeleccionado;
        displaySpan.style.color = 'var(--text-primary)';
      }
    } else {
      if (inputHidden) inputHidden.value = '';
      if (displaySpan) {
        displaySpan.textContent = '-- Seleccione o busque un Sitio --';
        displaySpan.style.color = 'var(--text-muted)';
      }
    }
    if (window.lucide) window.lucide.createIcons();
  };

  /**
   * Abrir modal para registrar un nuevo sitio / sucursal para un cliente
   */
  window.abrirModalNuevoSitioRentas = function(clienteNombre = '', prefillNombre = '') {
    const inputCli = document.getElementById('renta-cliente');
    const cli = clienteNombre || (inputCli ? inputCli.value.trim() : '');
    if (!cli) {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Por favor selecciona primero un cliente antes de registrar un sitio', 'warning');
      }
      return;
    }

    // Cerrar el menú del combo si estaba abierto
    const sitioMenu = document.getElementById('renta-sitio-menu');
    if (sitioMenu) sitioMenu.style.display = 'none';

    // Remover modal previo si existe
    const prevModal = document.getElementById('modal-nuevo-sitio-rentas');
    if (prevModal) prevModal.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-nuevo-sitio-rentas';
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:99999999; padding:1rem; backdrop-filter:blur(4px); animation: fadeIn 0.15s ease-out;';

    const escapedCli = cli.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const escapedPrefill = (prefillNombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    modal.innerHTML = `
      <div style="background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); border-radius:12px; border:1px solid var(--border, #334155); width:100%; max-width:480px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6); padding:1.5rem; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border, #334155); padding-bottom:0.75rem; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:32px; height:32px; border-radius:6px; background:rgba(232,130,12,0.15); color:var(--accent, #E8820C); display:flex; align-items:center; justify-content:center;">
              <i data-lucide="map-pin" style="width:18px; height:18px;"></i>
            </div>
            <div>
              <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary, #f8fafc);">Nuevo Sitio / Sucursal</h4>
              <span style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">Cliente: <strong style="color:var(--text-primary, #f8fafc);">${escapedCli}</strong></span>
            </div>
          </div>
          <button type="button" onclick="window.cerrarModalNuevoSitioRentas()" style="background:transparent; border:none; color:var(--text-muted, #94a3b8); cursor:pointer; padding:0.3rem;" title="Cerrar">
            <i data-lucide="x" style="width:18px; height:18px;"></i>
          </button>
        </div>

        <form id="form-nuevo-sitio-rentas" onsubmit="window.guardarNuevoSitioRentasSubmit(event, '${escapedCli}')" style="display:flex; flex-direction:column; gap:0.85rem;">
          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.3rem; color:var(--text-secondary, #cbd5e1);">Nombre del Sitio / Sucursal / Obra *</label>
            <input type="text" id="nuevo-sitio-nombre" required value="${escapedPrefill}" placeholder="Ej. Planta Querétaro / Obra Periférico" style="width:100%; box-sizing:border-box; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; outline:none;">
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.3rem; color:var(--text-secondary, #cbd5e1);">Dirección / Calle y Número</label>
            <input type="text" id="nuevo-sitio-direccion" placeholder="Calle, número exterior/interior, colonia" style="width:100%; box-sizing:border-box; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; outline:none;">
          </div>

          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
            <div>
              <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.3rem; color:var(--text-secondary, #cbd5e1);">Ciudad / Municipio</label>
              <input type="text" id="nuevo-sitio-ciudad" placeholder="Ciudad o Municipio" style="width:100%; box-sizing:border-box; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; outline:none;">
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.3rem; color:var(--text-secondary, #cbd5e1);">Estado</label>
              <input type="text" id="nuevo-sitio-estado" placeholder="Estado" style="width:100%; box-sizing:border-box; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; outline:none;">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.6rem; border-top:1px solid var(--border, #334155); padding-top:0.85rem; margin-top:0.4rem;">
            <button type="button" class="btn-secondary" onclick="window.cerrarModalNuevoSitioRentas()" style="padding:0.5rem 1rem; font-size:0.85rem;">Cancelar</button>
            <button type="submit" class="btn-primary" style="padding:0.5rem 1.25rem; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="check" style="width:15px; height:15px;"></i> Guardar y Seleccionar
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      const inputNom = document.getElementById('nuevo-sitio-nombre');
      if (inputNom) inputNom.focus();
    }, 80);
  };

  /**
   * Cerrar modal de nuevo sitio
   */
  window.cerrarModalNuevoSitioRentas = function() {
    const modal = document.getElementById('modal-nuevo-sitio-rentas');
    if (modal) modal.remove();
  };

  /**
   * Guardar nuevo sitio y asignarlo directamente en el formulario de Rentas
   */
  window.guardarNuevoSitioRentasSubmit = async function(event, clienteNombre) {
    if (event) event.preventDefault();

    const inputNombre = document.getElementById('nuevo-sitio-nombre');
    const inputDir = document.getElementById('nuevo-sitio-direccion');
    const inputCiudad = document.getElementById('nuevo-sitio-ciudad');
    const inputEstado = document.getElementById('nuevo-sitio-estado');

    const nombre = inputNombre ? inputNombre.value.trim() : '';
    if (!nombre) {
      if (typeof mostrarNotificacion === 'function') mostrarNotificacion('El nombre del sitio es obligatorio', 'error');
      return;
    }

    const direccion = inputDir ? inputDir.value.trim() : '';
    const ciudad = inputCiudad ? inputCiudad.value.trim() : '';
    const estado = inputEstado ? inputEstado.value.trim() : '';

    let cDb = [];
    try {
      if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0) cDb = clientesDb;
      else cDb = JSON.parse(localStorage.getItem('sapi_clientes_db') || '[]');
    } catch (e) {}

    const cliLower = String(clienteNombre).toLowerCase().trim();
    const clienteObj = (cDb || []).find(c => {
      if (!c) return false;
      const cNom = String(c.nombre || c.cliente || '').toLowerCase().trim();
      const cRazon = String(c.razon_social || '').toLowerCase().trim();
      const cId = String(c.id || '').toLowerCase().trim();
      const cInt = String(c.idInterno || '').toLowerCase().trim();
      const cRfc = String(c.rfc || '').toLowerCase().trim();
      return cNom === cliLower || cRazon === cliLower || cId === cliLower || cInt === cliLower || cRfc === cliLower;
    });

    const sitioId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'sit_' + Date.now();
    const clienteIdVinc = clienteObj ? (clienteObj.id || clienteObj.nombre) : clienteNombre;

    const nuevoSitioObj = {
      id: sitioId,
      nombre: nombre,
      cliente: clienteIdVinc,
      direccion: direccion,
      ciudad: ciudad,
      estado: estado,
      cp: '',
      customData: {
        clienteNombre: clienteNombre,
        creadoDesde: 'rentas'
      }
    };

    // 1. Guardar en sitiosDb
    let sDb = [];
    try {
      if (typeof sitiosDb !== 'undefined' && Array.isArray(sitiosDb)) sDb = sitiosDb;
      else sDb = JSON.parse(localStorage.getItem('sapi_sitios_db') || '[]');
    } catch (e) {}

    sDb.push(nuevoSitioObj);
    if (typeof sitiosDb !== 'undefined') sitiosDb = sDb;
    localStorage.setItem('sapi_sitios_db', JSON.stringify(sDb));

    // 2. Guardar en clienteObj.sitios si existe
    if (clienteObj) {
      if (!clienteObj.sitios) clienteObj.sitios = [];
      clienteObj.sitios.push({
        id: sitioId,
        nombre: nombre,
        direccion: direccion,
        ciudad: ciudad,
        estado: estado
      });
      localStorage.setItem('sapi_clientes_db', JSON.stringify(cDb));
      if (typeof clientesDb !== 'undefined') clientesDb = cDb;
      if (window.pushToSupabase) window.pushToSupabase('clientes', clienteObj);
    }

    // 3. Empujar a Supabase
    if (window.pushToSupabase) {
      window.pushToSupabase('sitios', nuevoSitioObj);
    }

    // 4. Cerrar modal de nuevo sitio
    window.cerrarModalNuevoSitioRentas();

    // 5. Re-poblar combobox de sitios y seleccionar el nuevo sitio
    window.poblarRentaSitiosCombo(clienteNombre, nombre);
    window.selectRentaComboOption('renta-sitio', nombre, nombre);

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`✅ Sitio "${nombre}" registrado y seleccionado con éxito.`, 'success');
    }
  };

  const MARCAS_RENDER = {
    'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
    'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
    'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
    'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
    'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG',
    'HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
  };

  /**
   * Obtener lista de maquinarias asignadas exclusivamente al cliente dado
   */
  window.obtenerListaMaquinasPorClienteRentas = function(clienteNombre) {
    if (!clienteNombre || !String(clienteNombre).trim()) return [];

    let cDb = [];
    try {
      if (typeof clientesDb !== 'undefined' && Array.isArray(clientesDb) && clientesDb.length > 0) {
        cDb = clientesDb;
      } else {
        const stored = localStorage.getItem('sapi_clientes_db');
        if (stored) cDb = JSON.parse(stored);
      }
    } catch (e) {}

    let mDb = [];
    try {
      if (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb) && maquinariaDb.length > 0) {
        mDb = maquinariaDb;
      } else {
        const stored = localStorage.getItem('sapi_maquinaria_db') || localStorage.getItem('sapi_maquinaria');
        if (stored) mDb = JSON.parse(stored);
      }
    } catch (e) {}

    const cliLower = String(clienteNombre).toLowerCase().trim();

    // 1. Localizar objeto de cliente en clientesDb
    const clienteObj = (cDb || []).find(c => {
      if (!c) return false;
      const cNom = String(c.nombre || c.cliente || '').toLowerCase().trim();
      const cRazon = String(c.razon_social || '').toLowerCase().trim();
      const cId = String(c.id || '').toLowerCase().trim();
      const cInt = String(c.idInterno || '').toLowerCase().trim();
      const cRfc = String(c.rfc || '').toLowerCase().trim();
      return cNom === cliLower || cRazon === cliLower || cId === cliLower || cInt === cliLower || cRfc === cliLower;
    });

    const candidateKeys = new Set([cliLower]);
    if (clienteObj) {
      if (clienteObj.id) candidateKeys.add(String(clienteObj.id).toLowerCase().trim());
      if (clienteObj.idInterno) candidateKeys.add(String(clienteObj.idInterno).toLowerCase().trim());
      if (clienteObj.rfc) candidateKeys.add(String(clienteObj.rfc).toLowerCase().trim());
      if (clienteObj.nombre) candidateKeys.add(String(clienteObj.nombre).toLowerCase().trim());
      if (clienteObj.razon_social) candidateKeys.add(String(clienteObj.razon_social).toLowerCase().trim());
      if (clienteObj.alias) candidateKeys.add(String(clienteObj.alias).toLowerCase().trim());
    }

    const resultado = [];
    const idsVistos = new Set();

    // 2. Máquinas en maquinariaDb
    (mDb || []).forEach(m => {
      if (!m) return;
      const mCli = String(m.cliente || '').toLowerCase().trim();
      const mCliCustom = String(m.customData?.clienteNombre || m.clienteNombre || '').toLowerCase().trim();
      if (candidateKeys.has(mCli) || (mCliCustom && candidateKeys.has(mCliCustom))) {
        const idInt = m.idInterno || m.id || m.serie || '';
        const serie = m.serie || '';
        const uniqueKey = idInt ? `id:${idInt}` : (serie ? `sn:${serie}` : `idx:${resultado.length}`);
        if (!idsVistos.has(uniqueKey)) {
          idsVistos.add(uniqueKey);
          if (serie) idsVistos.add(`sn:${serie}`);
          if (idInt) idsVistos.add(`id:${idInt}`);
          resultado.push(m);
        }
      }
    });

    // 3. Máquinas incrustadas en el objeto del cliente (clienteObj.maquinas)
    if (clienteObj && Array.isArray(clienteObj.maquinas)) {
      clienteObj.maquinas.forEach(m => {
        if (!m) return;
        const idInt = m.idInterno || m.id || m.serie || '';
        const serie = m.serie || '';
        const uniqueKey = idInt ? `id:${idInt}` : (serie ? `sn:${serie}` : `idx:${resultado.length}`);
        if (!idsVistos.has(uniqueKey)) {
          idsVistos.add(uniqueKey);
          if (serie) idsVistos.add(`sn:${serie}`);
          if (idInt) idsVistos.add(`id:${idInt}`);
          resultado.push(m);
        }
      });
    }

    return resultado;
  };

  /**
   * Abrir modal global de agregar maquinaria a un cliente desde el módulo de rentas
   */
  window.abrirModalAgregarMaquinaParaRenta = function(clienteNombre = '') {
    const clienteInput = document.getElementById('renta-cliente');
    const cli = (clienteNombre || (clienteInput ? clienteInput.value.trim() : '')).trim();

    if (typeof abrirModalAgregarMaquina === 'function' || typeof window.abrirModalAgregarMaquina === 'function') {
      const overlay = document.getElementById('modal-agregar-maquina-overlay');
      if (overlay) overlay.style.zIndex = '99999999';

      const fnAbrir = window.abrirModalAgregarMaquina || abrirModalAgregarMaquina;
      fnAbrir();

      if (cli) {
        setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
            amCliente.value = cli;
            if (typeof amCliente.onchange === 'function') {
              amCliente.onchange({ target: amCliente });
            }
            const rentaSitio = document.getElementById('renta-sitio')?.value || '';
            if (rentaSitio) {
              const amUbicacionSelect = document.getElementById('am-ubicacion-select');
              const amUbicacionOtra = document.getElementById('am-ubicacion-otra');
              if (amUbicacionSelect) {
                let exists = false;
                for (let i = 0; i < amUbicacionSelect.options.length; i++) {
                  if (amUbicacionSelect.options[i].value === rentaSitio) {
                    exists = true;
                    break;
                  }
                }
                if (exists) {
                  amUbicacionSelect.value = rentaSitio;
                  amUbicacionSelect.dispatchEvent(new Event('change'));
                } else if (amUbicacionOtra) {
                  amUbicacionSelect.value = 'otra';
                  amUbicacionSelect.dispatchEvent(new Event('change'));
                  amUbicacionOtra.value = rentaSitio;
                }
              }
            }
          }
        }, 120);
      }
    } else {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('El módulo de registro de maquinaria no está disponible.', 'warning');
      }
    }
  };

  /**
   * Poblar select de maquinaria según el cliente seleccionado
   */
  window.poblarRentaMaquinas = function(clienteNombre = '', maquinaSeleccionadaId = '') {
    const selectMaq = document.getElementById('renta-maquina');
    const customDiv = document.getElementById('renta-equipo-manual-container');
    if (!selectMaq) return;

    if (!clienteNombre || !String(clienteNombre).trim()) {
      selectMaq.innerHTML = `
        <option value="">-- Selecciona primero un Cliente para ver su maquinaria --</option>
        <option value="__REGISTRAR__">➕ Registrar nueva maquinaria en catálogo...</option>
      `;
      if (customDiv) customDiv.style.display = 'none';
      return;
    }

    const maquinas = window.obtenerListaMaquinasPorClienteRentas(clienteNombre);

    // Máquinas en renta activa para señalizarlas
    const currentEdicionId = rentaEnEdicionId;
    const rentasActivas = (window.rentas || []).filter(x => x && x.id !== currentEdicionId && (x.estado === 'Activa' || x.estado === 'Por Vencer' || x.estado === 'Reservada'));
    const rentasActivasMaqIds = rentasActivas.map(x => x.maquina_id || x.serie).filter(Boolean);

    let html = '';

    if (maquinas.length === 0) {
      html += `<option value="">(Este cliente no tiene maquinaria registrada en catálogo)</option>`;
      html += `<option value="__REGISTRAR__" selected>➕ Registrar nueva maquinaria para este cliente...</option>`;
      selectMaq.innerHTML = html;
      selectMaq.value = '__REGISTRAR__';
      if (customDiv) customDiv.style.display = 'grid';
      window.onSeleccionarMaquinaRenta(false);
      return;
    }

    html += `<option value="">-- Seleccionar Equipo (${maquinas.length} registrado${maquinas.length > 1 ? 's' : ''} para este cliente) --</option>`;

    let matchFound = false;

    maquinas.forEach(m => {
      const cleanId = m.idInterno || m.id || '';
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const brandCode = (m.marca || '').toUpperCase();
      const mFullName = MARCAS_RENDER[brandCode] || m.marca || '';
      const modelo = m.modelo || m.descripcion || '';
      const serie = m.serie || '';
      const tipo = m.tipo || 'Equipo';

      const desc = `${idDisplay}${tipo} ${mFullName} ${modelo} (SN: ${serie || 'S/N'})`.trim();
      const estaEnRenta = rentasActivasMaqIds.includes(cleanId) || (serie && rentasActivasMaqIds.includes(serie));
      const estadoTag = estaEnRenta ? ' [⚠️ EN RENTA ACTIVA]' : ' [Disponible]';

      const horoVal = (m.horometro != null ? m.horometro : (m.customData && m.customData.horometro != null ? m.customData.horometro : (m.horometro_actual != null ? m.horometro_actual : 0)));

      const isSelected = maquinaSeleccionadaId && (
        cleanId === maquinaSeleccionadaId ||
        serie === maquinaSeleccionadaId ||
        desc === maquinaSeleccionadaId ||
        m.id === maquinaSeleccionadaId
      );

      if (isSelected) matchFound = true;

      const escapedDesc = desc.replace(/"/g, '&quot;');
      const optVal = cleanId || serie || m.id || desc;

      html += `<option value="${optVal}" data-id="${cleanId}" data-serie="${serie}" data-nombre="${escapedDesc}" data-horometro="${horoVal}" ${isSelected ? 'selected' : ''}>${desc}${estadoTag}</option>`;
    });

    const isManualSelected = maquinaSeleccionadaId === '__REGISTRAR__' || maquinaSeleccionadaId === '__MANUAL__' || (!matchFound && Boolean(maquinaSeleccionadaId));
    html += `<option value="__REGISTRAR__" ${isManualSelected ? 'selected' : ''}>➕ Registrar nueva maquinaria / Otro equipo...</option>`;

    selectMaq.innerHTML = html;

    if (isManualSelected) {
      selectMaq.value = '__REGISTRAR__';
    }

    window.onSeleccionarMaquinaRenta(false);
  };

  /**
   * Manejar selección de máquina en el formulario
   */
  window.onSeleccionarMaquinaRenta = function(isUserChange = false) {
    try {
      const selectMaq = document.getElementById('renta-maquina');
      const customDiv = document.getElementById('renta-equipo-manual-container');
      const inputHorometro = document.getElementById('renta-horometro-inicial');
      const inputSerie = document.getElementById('renta-serie-manual');
      const inputEquipoManual = document.getElementById('renta-equipo-manual');

      if (!selectMaq) return;

      const val = selectMaq.value;
      if (val === '__REGISTRAR__' || val === '__MANUAL__') {
        if (customDiv) customDiv.style.display = 'grid';
        if (isUserChange) {
          const clienteInput = document.getElementById('renta-cliente');
          const cli = clienteInput ? clienteInput.value.trim() : '';
          window.abrirModalAgregarMaquinaParaRenta(cli);
        }
      } else {
        if (customDiv) customDiv.style.display = 'none';
        const opt = selectMaq.options[selectMaq.selectedIndex];
        if (opt && val) {
          const horo = opt.dataset.horometro;
          const serie = opt.dataset.serie;
          const nombre = opt.dataset.nombre;
          if (inputHorometro && horo !== undefined && horo !== null && horo !== '') {
            inputHorometro.value = horo;
          }
          if (inputSerie && serie) {
            inputSerie.value = serie;
          }
          if (inputEquipoManual && nombre) {
            inputEquipoManual.value = nombre;
          }
        }
      }
    } catch (err) {
      console.warn('[Rentas] Error en onSeleccionarMaquinaRenta:', err);
    }
  };

  /**
   * ABRIR MODAL NUEVA RENTA (100% DINÁMICO E INYECTADO EN BODY CON COMBOBOX PERSONALIZADO)
   */
  window.abrirModalNuevaRenta = function(idRenta = null) {
    try {
      rentaEnEdicionId = idRenta;

      // Remover cualquier instancia previa
      const prev = document.getElementById('modal-nueva-renta');
      if (prev) prev.remove();

      // Cargar datos si es edición
      let r = null;
      if (idRenta) {
        r = (window.rentas || []).find(x => x && x.id === idRenta);
      }

      // Valores por defecto
      const hoyStr = new Date().toISOString().substring(0, 10);
      const unMesStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      const sessionUser = (typeof currentSession !== 'undefined' && currentSession && currentSession.nombre) ? currentSession.nombre : '';

      const valFolio = r ? (r.folio || '') : generarSiguienteFolioRenta();
      const valCliente = r ? (r.cliente || '') : '';
      const valSitio = r ? (r.sitio || '') : '';
      const valMaquinaId = r ? (r.maquina_id || '') : '';
      const valEquipo = r ? (r.equipo || '') : '';
      const valSerie = r ? (r.serie || '') : '';
      const valFechaIni = r ? (r.fecha_inicio ? r.fecha_inicio.substring(0, 10) : hoyStr) : hoyStr;
      const valFechaFin = r ? (r.fecha_fin_estimada ? r.fecha_fin_estimada.substring(0, 10) : unMesStr) : unMesStr;
      const valTarifaTipo = r ? (r.tarifa_tipo || 'mensual') : 'mensual';
      const valMonto = r ? (r.monto_renta || '') : '';
      const valDeposito = r ? (r.deposito_garantia || '') : '';
      const valHoroIni = r ? (r.horometro_inicial != null ? r.horometro_inicial : '0') : '0';
      const valLimiteHoras = r ? (r.limite_horas_mes || '200') : '200';
      const valCostoHoraExtra = r ? (r.costo_hora_excedente || '0') : '0';
      const valAsesor = r ? (r.asesor_comercial || sessionUser) : sessionUser;
      const valNotas = r ? (r.notas || '') : '';
      const valCondicion = (r && r.checklist_entrega) ? (r.checklist_entrega.condicion || 'Excelente') : 'Excelente';
      const valCombustible = (r && r.checklist_entrega) ? (r.checklist_entrega.combustible || '100%') : '100%';
      const valAccesorios = (r && r.checklist_entrega) ? (r.checklist_entrega.accesorios || 'Llaves de encendido, manual de operación') : 'Llaves de encendido, manual de operación';

      const isManual = r ? (!valMaquinaId || valMaquinaId === '__MANUAL__' || valMaquinaId === '__REGISTRAR__') : false;

      // Crear contenedor Modal
      const modal = document.createElement('div');
      modal.id = 'modal-nueva-renta';
      modal.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:1rem;box-sizing:border-box;';

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); border-radius:14px; border:1px solid var(--border, #334155); width:100%; max-width:860px; max-height:92vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); padding:1.75rem; box-sizing:border-box; animation: modalFadeIn 0.2s ease-out;">
          
          <!-- Encabezado del Modal -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border, #334155); padding-bottom:1rem; margin-bottom:1.25rem;">
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <div style="width:36px; height:36px; border-radius:8px; background:rgba(232,130,12,0.15); color:var(--accent, #E8820C); display:flex; align-items:center; justify-content:center;">
                <i data-lucide="key-round" style="width:20px; height:20px;"></i>
              </div>
              <div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary, #f8fafc);">${r ? 'Editar Contrato de Renta' : 'Nuevo Contrato de Renta de Maquinaria'}</h3>
                <span style="font-size:0.8rem; color:var(--text-muted, #94a3b8); font-family:var(--font-mono, monospace);">Folio: <strong style="color:var(--accent, #E8820C);">${valFolio}</strong></span>
              </div>
            </div>
            <button type="button" onclick="window.cerrarModalNuevaRenta()" style="background:transparent; border:none; color:var(--text-muted, #94a3b8); cursor:pointer; padding:0.4rem; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Cerrar">
              <i data-lucide="x" style="width:20px; height:20px;"></i>
            </button>
          </div>

          <!-- Formulario -->
          <form onsubmit="window.guardarRentaSubmit(event)" style="display:flex; flex-direction:column; gap:1.25rem;">
            
            <input type="hidden" id="renta-folio" value="${valFolio}">

            <!-- SECCIÓN 1: Cliente y Sitio con Comboboxes Personalizados -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:1rem;">
              <div style="font-size:0.85rem; font-weight:700; color:var(--accent, #E8820C); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="building" style="width:14px; height:14px;"></i> 1. Cliente y Ubicación del Servicio
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
                
                <!-- Custom Combobox Cliente -->
                <div class="form-group" style="position:relative; margin:0;">
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Cliente *</label>
                  <input type="hidden" id="renta-cliente" value="${valCliente}">
                  
                  <div class="combo-box" id="renta-cliente-combo" onclick="window.toggleRentaCombo('renta-cliente')" style="width:100%; box-sizing:border-box; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); padding:0.55rem 0.75rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                    <span id="renta-cliente-display" style="font-size:0.85rem; color:var(--text-primary, #f8fafc); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${valCliente || '-- Seleccionar Cliente --'}</span>
                    <i data-lucide="chevron-down" style="width:16px; height:16px; color:var(--text-muted, #94a3b8); flex-shrink:0;"></i>
                  </div>

                  <div class="combo-menu" id="renta-cliente-menu" style="position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:9999999; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:8px; box-shadow:0 12px 28px rgba(0,0,0,0.5); display:none; flex-direction:column; overflow:hidden;">
                    <div class="combo-search" style="padding:0.5rem 0.75rem; border-bottom:1px solid var(--border, #334155); display:flex; align-items:center; gap:0.5rem; background:var(--bg-primary, #0f172a);">
                      <i data-lucide="search" style="width:14px; height:14px; color:var(--text-muted, #94a3b8);"></i>
                      <input type="text" id="renta-cliente-search" placeholder="Buscar cliente..." onkeyup="window.filterRentaCombo('renta-cliente', this.value)" onclick="event.stopPropagation()" style="border:none; background:transparent; width:100%; font-size:0.85rem; color:var(--text-primary, #f8fafc); outline:none;">
                    </div>
                    <div class="combo-options" id="renta-cliente-options" style="max-height:220px; overflow-y:auto; padding:0.25rem;">
                      <!-- Llenado dinámicamente -->
                    </div>
                  </div>
                </div>

                <!-- Custom Combobox Sitio -->
                <div class="form-group" style="position:relative; margin:0;">
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Sitio / Ubicación Operativa</label>
                  <input type="hidden" id="renta-sitio" value="${valSitio}">
                  
                  <div class="combo-box" id="renta-sitio-combo" onclick="window.toggleRentaCombo('renta-sitio')" style="width:100%; box-sizing:border-box; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); padding:0.55rem 0.75rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                    <span id="renta-sitio-display" style="font-size:0.85rem; color:${valSitio ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${valSitio || (valCliente ? '-- Seleccione o busque un Sitio --' : '-- Seleccione primero un Cliente --')}</span>
                    <i data-lucide="chevron-down" style="width:16px; height:16px; color:var(--text-muted, #94a3b8); flex-shrink:0;"></i>
                  </div>

                  <div class="combo-menu" id="renta-sitio-menu" style="position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:9999999; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:8px; box-shadow:0 12px 28px rgba(0,0,0,0.5); display:none; flex-direction:column; overflow:hidden;">
                    <div class="combo-search" style="padding:0.5rem 0.75rem; border-bottom:1px solid var(--border, #334155); display:flex; align-items:center; gap:0.5rem; background:var(--bg-primary, #0f172a);">
                      <i data-lucide="search" style="width:14px; height:14px; color:var(--text-muted, #94a3b8);"></i>
                      <input type="text" id="renta-sitio-search" placeholder="Buscar sitio..." onkeyup="window.filterRentaCombo('renta-sitio', this.value)" onclick="event.stopPropagation()" style="border:none; background:transparent; width:100%; font-size:0.85rem; color:var(--text-primary, #f8fafc); outline:none;">
                    </div>
                    <div class="combo-options" id="renta-sitio-options" style="max-height:220px; overflow-y:auto; padding:0.25rem;">
                      <!-- Llenado dinámicamente -->
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <!-- SECCIÓN 2: Equipo y Horómetro -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:1rem;">
              <div style="font-size:0.85rem; font-weight:700; color:var(--accent, #E8820C); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="wrench" style="width:14px; height:14px;"></i> 2. Maquinaria y Control de Horómetro
              </div>
              <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary, #cbd5e1); margin:0;">Equipo del Catálogo *</label>
                    <button type="button" onclick="window.abrirModalAgregarMaquinaParaRenta()" style="background:transparent; border:none; color:var(--accent, #E8820C); font-size:0.75rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:0.25rem; padding:0;" title="Dar de alta nueva maquinaria a este cliente">
                      <i data-lucide="plus-circle" style="width:13px; height:13px;"></i> Registrar maquinaria
                    </button>
                  </div>
                  <select id="renta-maquina" required onchange="window.onSeleccionarMaquinaRenta(true)" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Horómetro Inicial (hrs) *</label>
                  <input type="number" step="0.1" min="0" id="renta-horometro-inicial" value="${valHoroIni}" required placeholder="0.0" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem; font-weight:700;">
                </div>
              </div>

              <!-- Contenedor Manual Si no está en catálogo -->
              <div id="renta-equipo-manual-container" style="display:${isManual ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:0.85rem; padding-top:0.85rem; border-top:1px dashed var(--border, #334155);">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Nombre / Descripción del Equipo</label>
                  <input type="text" id="renta-equipo-manual" value="${valEquipo}" placeholder="Ej. Generador CATERPILLAR 150 kVA" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Número de Serie</label>
                  <input type="text" id="renta-serie-manual" value="${valSerie}" placeholder="Ej. CAT-2024-889" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem; font-family:monospace;">
                </div>
              </div>
            </div>

            <!-- SECCIÓN 3: Vigencia y Condiciones Comerciales -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:1rem;">
              <div style="font-size:0.85rem; font-weight:700; color:var(--accent, #E8820C); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="calendar" style="width:14px; height:14px;"></i> 3. Vigencia y Tarifas del Contrato
              </div>
              
              <!-- Fechas y Modalidad -->
              <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.85rem; margin-bottom:0.85rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Fecha de Entrega / Inicio *</label>
                  <input type="date" id="renta-fecha-inicio" value="${valFechaIni}" required style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Fecha Fin Estimada</label>
                  <input type="date" id="renta-fecha-fin" value="${valFechaFin}" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Modalidad de Cobro</label>
                  <select id="renta-tarifa-tipo" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                    <option value="mensual" ${valTarifaTipo === 'mensual' ? 'selected' : ''}>Mensual</option>
                    <option value="quincenal" ${valTarifaTipo === 'quincenal' ? 'selected' : ''}>Quincenal</option>
                    <option value="semanal" ${valTarifaTipo === 'semanal' ? 'selected' : ''}>Semanal</option>
                    <option value="diaria" ${valTarifaTipo === 'diaria' ? 'selected' : ''}>Diaria</option>
                    <option value="por hora" ${valTarifaTipo === 'por hora' ? 'selected' : ''}>Por Hora</option>
                  </select>
                </div>
              </div>

              <!-- Montos y Horas -->
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:0.85rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Monto Renta ($ MXN) *</label>
                  <input type="number" step="0.01" min="0" id="renta-monto" value="${valMonto}" required placeholder="0.00" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem; font-weight:700;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Depósito Garantía ($ MXN)</label>
                  <input type="number" step="0.01" min="0" id="renta-deposito" value="${valDeposito}" placeholder="0.00" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Límite Horas / Periodo</label>
                  <input type="number" min="0" id="renta-limite-horas" value="${valLimiteHoras}" placeholder="200" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Costo Hora Extra ($/hr)</label>
                  <input type="number" step="0.01" min="0" id="renta-costo-hora-excedente" value="${valCostoHoraExtra}" placeholder="0.00" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
              </div>
            </div>

            <!-- SECCIÓN 4: Checklist Check-in y Asesor -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:1rem;">
              <div style="font-size:0.85rem; font-weight:700; color:var(--accent, #E8820C); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="clipboard-check" style="width:14px; height:14px;"></i> 4. Checklist de Entrega y Observaciones
              </div>
              <div style="display:grid; grid-template-columns: 1fr 1fr 2fr; gap:0.85rem; margin-bottom:0.85rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Condición Física</label>
                  <select id="renta-chk-condicion" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                    <option value="Excelente" ${valCondicion === 'Excelente' ? 'selected' : ''}>Excelente</option>
                    <option value="Muy Buena" ${valCondicion === 'Muy Buena' ? 'selected' : ''}>Muy Buena</option>
                    <option value="Buena" ${valCondicion === 'Buena' ? 'selected' : ''}>Buena</option>
                    <option value="Regular" ${valCondicion === 'Regular' ? 'selected' : ''}>Regular</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Combustible</label>
                  <select id="renta-chk-combustible" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                    <option value="100%" ${valCombustible === '100%' ? 'selected' : ''}>100% (Lleno)</option>
                    <option value="75%" ${valCombustible === '75%' ? 'selected' : ''}>75% (3/4)</option>
                    <option value="50%" ${valCombustible === '50%' ? 'selected' : ''}>50% (1/2)</option>
                    <option value="25%" ${valCombustible === '25%' ? 'selected' : ''}>25% (1/4)</option>
                    <option value="Vacío / Eléctrico" ${valCombustible === 'Vacío / Eléctrico' ? 'selected' : ''}>Vacío / Eléctrico</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Accesorios Entregados</label>
                  <input type="text" id="renta-chk-accesorios" value="${valAccesorios}" placeholder="Ej. Llaves, manual de operación, mangueras" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 2fr; gap:0.85rem;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Asesor Comercial</label>
                  <input type="text" id="renta-asesor" value="${valAsesor}" placeholder="Nombre del Asesor" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Notas / Términos Particulares</label>
                  <textarea id="renta-notas" rows="2" placeholder="Observaciones, acuerdos de traslado, etc." style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); font-size:0.85rem; resize:vertical;">${valNotas}</textarea>
                </div>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--border, #334155); padding-top:1rem; margin-top:0.25rem;">
              <button type="button" class="btn-secondary" onclick="window.cerrarModalNuevaRenta()" style="padding:0.55rem 1.25rem; font-size:0.85rem;">Cancelar</button>
              <button type="submit" class="btn-primary" style="padding:0.55rem 1.5rem; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="check" style="width:16px; height:16px;"></i> ${r ? 'Guardar Cambios' : 'Registrar Contrato'}
              </button>
            </div>
          </form>
        </div>
      `;

      // Event listener para cerrar comboboxes al hacer clic en cualquier parte del modal fuera de ellos
      modal.addEventListener('click', function(e) {
        if (!e.target.closest('.combo-box') && !e.target.closest('.combo-menu')) {
          modal.querySelectorAll('.combo-menu').forEach(m => { m.style.display = 'none'; });
          modal.querySelectorAll('.combo-box').forEach(c => { c.classList.remove('focus'); });
        }
      });

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      // Poblar comboboxes de Cliente, Sitio y Maquinaria
      window.poblarRentaClientesCombo(valCliente);
      window.poblarRentaSitiosCombo(valCliente, valSitio);
      window.poblarRentaMaquinas(valCliente, valMaquinaId || valEquipo || valSerie);

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[Rentas] Error al abrir modal nueva renta:', err);
    }
  };

  /**
   * Cerrar modal de nueva renta
   */
  window.cerrarModalNuevaRenta = function() {
    const modal = document.getElementById('modal-nueva-renta');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    rentaEnEdicionId = null;
  };

  /**
   * Guardar / Registrar contrato de renta
   */
  window.guardarRentaSubmit = async function(event) {
    if (event) event.preventDefault();

    try {
      const inputFolio = document.getElementById('renta-folio');
      const inputCliente = document.getElementById('renta-cliente');
      const inputSitio = document.getElementById('renta-sitio');
      const selectMaq = document.getElementById('renta-maquina');
      const inputEquipoManual = document.getElementById('renta-equipo-manual');
      const inputSerieManual = document.getElementById('renta-serie-manual');
      const inputFechaInicio = document.getElementById('renta-fecha-inicio');
      const inputFechaFin = document.getElementById('renta-fecha-fin');
      const selectTarifaTipo = document.getElementById('renta-tarifa-tipo');
      const inputMontoRenta = document.getElementById('renta-monto');
      const inputDeposito = document.getElementById('renta-deposito');
      const inputHorometroInicial = document.getElementById('renta-horometro-inicial');
      const inputLimiteHoras = document.getElementById('renta-limite-horas');
      const inputCostoHoraExcedente = document.getElementById('renta-costo-hora-excedente');
      const inputAsesor = document.getElementById('renta-asesor');
      const inputNotas = document.getElementById('renta-notas');
      const selectCondicion = document.getElementById('renta-chk-condicion');
      const selectCombustible = document.getElementById('renta-chk-combustible');
      const inputAccesorios = document.getElementById('renta-chk-accesorios');

      const cliente = inputCliente?.value?.trim();
      if (!cliente) {
        mostrarNotificacion('Por favor ingresa o selecciona un cliente', 'error');
        return;
      }

      let equipoDesc = '';
      let serieVal = inputSerieManual?.value?.trim() || '';
      let maquinaId = selectMaq?.value || '';

      if (maquinaId && maquinaId !== '__MANUAL__' && maquinaId !== '__REGISTRAR__') {
        const opt = selectMaq.options[selectMaq.selectedIndex];
        equipoDesc = opt ? (opt.dataset.nombre || (opt.textContent || '').replace(/ \[(Disponible|⚠️ EN RENTA ACTIVA)\]/g, '').trim()) : maquinaId;
        if (!serieVal && opt && opt.dataset.serie) serieVal = opt.dataset.serie;
      } else {
        equipoDesc = inputEquipoManual?.value?.trim() || 'Equipo de Renta';
      }

      const folio = inputFolio?.value?.trim() || generarSiguienteFolioRenta();
      const fechaInicio = inputFechaInicio?.value || new Date().toISOString().substring(0, 10);
      const fechaFin = inputFechaFin?.value || null;

      const checklistEntrega = {
        condicion: selectCondicion?.value || 'Excelente',
        combustible: selectCombustible?.value || '100%',
        accesorios: inputAccesorios?.value?.trim() || '',
        fecha_entrega: new Date().toISOString(),
        responsable: (typeof currentSession !== 'undefined' && currentSession && currentSession.nombre) || 'Eurorep'
      };

      const isTest = (typeof isTestModeActive === 'function' ? isTestModeActive() : false);

      const rentaObj = {
        id: rentaEnEdicionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ren_' + Date.now()),
        folio: folio,
        cliente: cliente,
        sitio: inputSitio?.value?.trim() || '',
        maquina_id: (maquinaId && maquinaId !== '__MANUAL__' && maquinaId !== '__REGISTRAR__') ? maquinaId : null,
        equipo: equipoDesc,
        serie: serieVal,
        fecha_inicio: fechaInicio,
        fecha_fin_estimada: fechaFin,
        fecha_devolucion_real: null,
        estado: 'Activa',
        tarifa_tipo: selectTarifaTipo?.value || 'mensual',
        monto_renta: parseFloat(inputMontoRenta?.value) || 0,
        deposito_garantia: parseFloat(inputDeposito?.value) || 0,
        horometro_inicial: parseFloat(inputHorometroInicial?.value) || 0,
        horometro_final: null,
        limite_horas_mes: parseFloat(inputLimiteHoras?.value) || 200,
        costo_hora_excedente: parseFloat(inputCostoHoraExcedente?.value) || 0,
        asesor_comercial: inputAsesor?.value?.trim() || '',
        notas: inputNotas?.value?.trim() || '',
        checklist_entrega: checklistEntrega,
        checklist_devolucion: null,
        esPrueba: isTest,
        _synced: false,
        updated_at: new Date().toISOString()
      };

      if (rentaEnEdicionId) {
        const idx = window.rentas.findIndex(x => x && x.id === rentaEnEdicionId);
        if (idx >= 0) {
          rentaObj.created_at = window.rentas[idx].created_at || new Date().toISOString();
          rentaObj.estado = window.rentas[idx].estado || 'Activa';
          rentaObj.esPrueba = window.rentas[idx].esPrueba !== undefined ? window.rentas[idx].esPrueba : isTest;
          rentaObj.fecha_devolucion_real = window.rentas[idx].fecha_devolucion_real || null;
          rentaObj.horometro_final = window.rentas[idx].horometro_final != null ? window.rentas[idx].horometro_final : null;
          rentaObj.checklist_devolucion = window.rentas[idx].checklist_devolucion || null;
          window.rentas[idx] = rentaObj;
        } else {
          rentaObj.created_at = new Date().toISOString();
          window.rentas.push(rentaObj);
        }
      } else {
        rentaObj.created_at = new Date().toISOString();
        window.rentas.push(rentaObj);
      }

      // Persistir localmente
      localStorage.setItem('sapi_rentas', JSON.stringify(window.rentas));

      // Sincronizar con Supabase si está disponible
      if (window.pushToSupabase) {
        window.pushToSupabase('rentas', rentaObj).then(() => {
          rentaObj._synced = true;
          localStorage.setItem('sapi_rentas', JSON.stringify(window.rentas));
          renderRentas();
        }).catch(err => console.warn('[Rentas] Push Supabase:', err));
      } else if (typeof window.syncGuardarRenta === 'function') {
        window.syncGuardarRenta(rentaObj);
      }

      cerrarModalNuevaRenta();
      renderRentas();
      mostrarNotificacion(`✅ Contrato de Renta ${folio} guardado con éxito`, 'success');
    } catch (err) {
      console.error('[Rentas] Error guardando renta:', err);
      mostrarNotificacion('Error al guardar contrato de renta', 'error');
    }
  };

  /**
   * VER FICHA DE DETALLE (100% DINÁMICO E INYECTADO EN BODY)
   */
  window.verDetalleRenta = function(idRenta) {
    try {
      const r = (window.rentas || []).find(x => x && x.id === idRenta);
      if (!r) return;

      // Remover cualquier instancia previa
      const prev = document.getElementById('modal-detalle-renta');
      if (prev) prev.remove();

      const estadoCalc = calcularEstadoRenta(r);
      const badgeHtml = obtenerBadgeRenta(estadoCalc);
      const fIni = r.fecha_inicio ? r.fecha_inicio.substring(0, 10).split('-').reverse().join('/') : 'N/A';
      const fFin = r.fecha_fin_estimada ? r.fecha_fin_estimada.substring(0, 10).split('-').reverse().join('/') : 'Indefinida';
      const fDev = r.fecha_devolucion_real ? r.fecha_devolucion_real.substring(0, 10).split('-').reverse().join('/') : '-';

      // Cálculo de horas trabajadas y excedentes
      let horasUso = 0;
      if (r.horometro_final != null) {
        horasUso = Math.max(0, Number(r.horometro_final) - Number(r.horometro_inicial || 0));
      }
      const horasExcedentes = (r.limite_horas_mes && horasUso > r.limite_horas_mes) ? (horasUso - r.limite_horas_mes) : 0;
      const cargoExcedente = horasExcedentes * (Number(r.costo_hora_excedente) || 0);

      const isEmpresa = ['empresa', 'cliente', 'cliente-consultor'].includes(
        String((typeof currentSession !== 'undefined' && currentSession && currentSession.viewMode) || '').toLowerCase().trim()
      );

      const modal = document.createElement('div');
      modal.id = 'modal-detalle-renta';
      modal.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:1rem;box-sizing:border-box;';

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); border-radius:14px; border:1px solid var(--border, #334155); width:100%; max-width:850px; max-height:92vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); padding:1.75rem; box-sizing:border-box;">
          
          <!-- Encabezado de la Ficha -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px solid var(--border, #334155); padding-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted, #94a3b8); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Contrato de Arrendamiento</span>
              <h2 style="margin:0.15rem 0 0.25rem 0; font-size:1.4rem; color:var(--text-primary, #f8fafc); font-family:var(--font-mono, monospace);">${r.folio || 'REN-0000'}</h2>
              <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary, #cbd5e1);">
                <span><i data-lucide="building" style="width:13px;height:13px;display:inline-block;"></i> ${r.cliente || 'Sin Cliente'}</span>
                <span>•</span>
                <span><i data-lucide="map-pin" style="width:13px;height:13px;display:inline-block;"></i> ${r.sitio || 'Ubicación General'}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="margin-bottom:0.4rem;">${badgeHtml}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">Asesor: <strong>${r.asesor_comercial || 'No especificado'}</strong></div>
            </div>
          </div>

          <!-- Grid de Ficha Informativa -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
            <!-- Card Equipo -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:1rem;">
              <h4 style="margin:0 0 0.75rem 0; font-size:0.88rem; color:var(--accent, #E8820C); display:flex; align-items:center; gap:0.35rem;">
                <i data-lucide="settings-2" style="width:15px;height:15px;"></i> Información del Equipo
              </h4>
              <div style="font-size:0.85rem; line-height:1.6;">
                <div><strong>Equipo:</strong> ${r.equipo || 'Maquinaria'}</div>
                <div><strong>No. de Serie:</strong> <span style="font-family:var(--font-mono, monospace);">${r.serie || 'S/N'}</span></div>
                <div><strong>ID Catálogo:</strong> ${r.maquina_id || 'Manual'}</div>
                <div><strong>Horómetro Inicial:</strong> ${r.horometro_inicial || 0} hrs</div>
                ${r.horometro_final != null ? `<div><strong>Horómetro Final:</strong> ${r.horometro_final} hrs</div>` : ''}
                ${r.horometro_final != null ? `<div style="color:#10b981; font-weight:700;"><strong>Horas Utilizadas:</strong> ${horasUso.toFixed(1)} hrs</div>` : ''}
              </div>
            </div>

            <!-- Card Condiciones Económicas -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:1rem;">
              <h4 style="margin:0 0 0.75rem 0; font-size:0.88rem; color:var(--accent, #E8820C); display:flex; align-items:center; gap:0.35rem;">
                <i data-lucide="dollar-sign" style="width:15px;height:15px;"></i> Condiciones Comerciales
              </h4>
              <div style="font-size:0.85rem; line-height:1.6;">
                <div><strong>Tarifa:</strong> $${Number(r.monto_renta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${r.tarifa_tipo || 'mensual'})</div>
                <div><strong>Depósito en Garantía:</strong> $${Number(r.deposito_garantia || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <div><strong>Límite de Uso:</strong> ${r.limite_horas_mes || 200} hrs/${r.tarifa_tipo || 'mes'}</div>
                <div><strong>Costo por Hora Extra:</strong> $${Number(r.costo_hora_excedente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/hr</div>
                ${horasExcedentes > 0 ? `<div style="color:#ef4444; font-weight:700;"><strong>Excedente (${horasExcedentes.toFixed(1)} hrs):</strong> $${cargoExcedente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>` : ''}
              </div>
            </div>

            <!-- Card Periodo -->
            <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:1rem;">
              <h4 style="margin:0 0 0.75rem 0; font-size:0.88rem; color:var(--accent, #E8820C); display:flex; align-items:center; gap:0.35rem;">
                <i data-lucide="calendar" style="width:15px;height:15px;"></i> Periodo del Contrato
              </h4>
              <div style="font-size:0.85rem; line-height:1.6;">
                <div><strong>Fecha Inicio:</strong> ${fIni}</div>
                <div><strong>Fecha Fin Acordada:</strong> ${fFin}</div>
                <div><strong>Fecha Devolución Real:</strong> ${fDev}</div>
                <div><strong>Creado en Sistema:</strong> ${r.created_at ? r.created_at.substring(0, 10) : '-'}</div>
              </div>
            </div>
          </div>

          <!-- Checklists Entrega vs Devolución -->
          <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:1rem; margin-bottom:1.25rem;">
            <h4 style="margin:0 0 0.75rem 0; font-size:0.88rem; color:var(--accent, #E8820C); display:flex; align-items:center; gap:0.35rem;">
              <i data-lucide="clipboard-check" style="width:15px;height:15px;"></i> Checklist de Inspección Física
            </h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; font-size:0.85rem;">
              <div style="border-right:1px solid var(--border, #334155); padding-right:0.5rem;">
                <strong style="color:var(--text-primary, #f8fafc); display:block; margin-bottom:0.25rem;">🚀 Entrega al Cliente (Check-in):</strong>
                <div><strong>Condición:</strong> ${r.checklist_entrega?.condicion || 'Excelente'}</div>
                <div><strong>Combustible:</strong> ${r.checklist_entrega?.combustible || '100%'}</div>
                <div><strong>Accesorios:</strong> ${r.checklist_entrega?.accesorios || 'Ninguno especificado'}</div>
                <div><strong>Responsable:</strong> ${r.checklist_entrega?.responsable || 'Eurorep'}</div>
              </div>
              <div>
                <strong style="color:var(--text-primary, #f8fafc); display:block; margin-bottom:0.25rem;">🏁 Recepción / Retorno (Check-out):</strong>
                ${r.checklist_devolucion ? `
                  <div><strong>Condición:</strong> ${r.checklist_devolucion.condicion || 'Buen estado'}</div>
                  <div><strong>Combustible:</strong> ${r.checklist_devolucion.combustible || 'N/A'}</div>
                  <div><strong>Daños o Faltantes:</strong> ${r.checklist_devolucion.danos || 'Ninguno reportado'}</div>
                  <div><strong>Recibido por:</strong> ${r.checklist_devolucion.recibido_por || 'Eurorep'}</div>
                ` : '<div style="color:var(--text-muted, #94a3b8); font-style:italic;">Equipo actualmente en posesión del cliente.</div>'}
              </div>
            </div>
          </div>

          ${r.notas ? `
            <div style="background:rgba(232,130,12,0.06); border:1px dashed var(--accent, #E8820C); border-radius:8px; padding:0.75rem 1rem; margin-bottom:1.25rem; font-size:0.85rem;">
              <strong style="color:var(--accent, #E8820C); display:block; margin-bottom:0.2rem;">Observaciones y Condiciones Especiales:</strong>
              <p style="margin:0; color:var(--text-secondary, #cbd5e1); white-space:pre-wrap;">${r.notas}</p>
            </div>
          ` : ''}

          <!-- Botones de Acción -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; border-top:1px solid var(--border, #334155); padding-top:1rem;">
            <div style="display:flex; gap:0.5rem;">
              <button class="btn-secondary" onclick="window.generarContratoRentaPDF('${r.id}')" style="font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="printer" style="width:15px; height:15px;"></i> Imprimir Contrato PDF
              </button>
              ${!isEmpresa ? `
                <button class="btn-secondary" onclick="window.crearServicioDesdeRenta('${r.id}')" title="Crear orden de servicio para este equipo" style="font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                  <i data-lucide="wrench" style="width:15px; height:15px;"></i> Generar Orden de Servicio
                </button>
              ` : ''}
            </div>
            <div style="display:flex; gap:0.5rem;">
              ${(!isEmpresa && estadoCalc !== 'Finalizada') ? `
                <button class="btn-primary" style="background:#10b981; border-color:#10b981; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;" onclick="window.abrirModalDevolucionRenta('${r.id}')">
                  <i data-lucide="check-square" style="width:15px; height:15px;"></i> Registrar Devolución
                </button>
                <button class="btn-secondary" onclick="window.cerrarModalDetalleRenta(); window.abrirModalNuevaRenta('${r.id}');" style="font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                  <i data-lucide="edit-3" style="width:15px; height:15px;"></i> Editar
                </button>
              ` : ''}
              <button class="btn-secondary" onclick="window.cerrarModalDetalleRenta()" style="font-size:0.85rem;">Cerrar</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[Rentas] Error abriendo detalle de renta:', err);
    }
  };

  /**
   * Cerrar modal de detalle
   */
  window.cerrarModalDetalleRenta = function() {
    const modal = document.getElementById('modal-detalle-renta');
    if (modal) modal.remove();
    document.body.style.overflow = '';
  };

  /**
   * ABRIR MODAL DEVOLUCIÓN / CHECK-OUT (100% DINÁMICO E INYECTADO EN BODY)
   */
  window.abrirModalDevolucionRenta = function(idRenta) {
    try {
      rentaEnDevolucionId = idRenta;
      const r = (window.rentas || []).find(x => x && x.id === idRenta);
      if (!r) return;

      cerrarModalDetalleRenta();

      // Remover cualquier instancia previa
      const prev = document.getElementById('modal-devolucion-renta');
      if (prev) prev.remove();

      const hoyStr = new Date().toISOString().substring(0, 10);
      const horoIni = Number(r.horometro_inicial) || 0;
      const horoFinDefault = r.horometro_final != null ? r.horometro_final : horoIni;

      const modal = document.createElement('div');
      modal.id = 'modal-devolucion-renta';
      modal.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:1rem;box-sizing:border-box;';

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); color:var(--text-primary, #f8fafc); border-radius:14px; border:1px solid var(--border, #334155); width:100%; max-width:650px; max-height:92vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); padding:1.75rem; box-sizing:border-box;">
          
          <!-- Encabezado -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border, #334155); padding-bottom:1rem; margin-bottom:1.25rem;">
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <div style="width:36px; height:36px; border-radius:8px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="check-square" style="width:20px; height:20px;"></i>
              </div>
              <div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary, #f8fafc);">Devolución / Check-out de Maquinaria</h3>
                <span style="font-size:0.8rem; color:var(--text-muted, #94a3b8);">Contrato: <strong style="color:var(--accent, #E8820C); font-family:monospace;">${r.folio || ''}</strong></span>
              </div>
            </div>
            <button type="button" onclick="window.cerrarModalDevolucionRenta()" style="background:transparent; border:none; color:var(--text-muted, #94a3b8); cursor:pointer; padding:0.4rem; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Cerrar">
              <i data-lucide="x" style="width:20px; height:20px;"></i>
            </button>
          </div>

          <!-- Resumen del Equipo -->
          <div style="background:var(--bg-primary, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:0.85rem 1rem; margin-bottom:1.25rem; font-size:0.85rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
            <div><strong>Cliente:</strong> ${r.cliente || 'Sin Cliente'}</div>
            <div><strong>Equipo:</strong> ${r.equipo || 'Maquinaria'}</div>
            <div><strong>Serie:</strong> <span style="font-family:monospace;">${r.serie || 'S/N'}</span></div>
            <div><strong>Horómetro Inicial:</strong> <span style="color:#10b981; font-weight:700;">${horoIni} hrs</span></div>
          </div>

          <!-- Formulario de Check-out -->
          <form onsubmit="window.confirmarDevolucionRentaSubmit(event)" style="display:flex; flex-direction:column; gap:1.25rem;">
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Fecha de Retorno / Recepción *</label>
                <input type="date" id="dev-renta-fecha" value="${hoyStr}" required style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Horómetro Final (hrs) *</label>
                <input type="number" step="0.1" min="${horoIni}" id="dev-renta-horometro-fin" value="${horoFinDefault}" required oninput="window.calcularResumenDevolucion()" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; font-weight:700;">
              </div>
            </div>

            <!-- Panel de Cálculo en Vivo -->
            <div style="background:rgba(232,130,12,0.06); border:1px solid rgba(232,130,12,0.25); border-radius:10px; padding:0.85rem 1rem;">
              <div style="font-size:0.78rem; font-weight:700; color:var(--accent, #E8820C); margin-bottom:0.5rem; text-transform:uppercase;">Cálculo de Uso y Posibles Excedentes</div>
              <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem; font-size:0.85rem;">
                <div>
                  <span style="color:var(--text-muted, #94a3b8); font-size:0.75rem; display:block;">Horas Utilizadas:</span>
                  <strong id="dev-calc-horas-trabajadas" style="font-size:1rem; color:var(--text-primary, #f8fafc);">0.0 hrs</strong>
                </div>
                <div>
                  <span style="color:var(--text-muted, #94a3b8); font-size:0.75rem; display:block;">Horas Excedentes:</span>
                  <strong id="dev-calc-horas-excedentes" style="font-size:1rem;">0.0 hrs</strong>
                </div>
                <div>
                  <span style="color:var(--text-muted, #94a3b8); font-size:0.75rem; display:block;">Cargo Extra ($ MXN):</span>
                  <strong id="dev-calc-cargo-extra" style="font-size:1rem; color:#10b981;">$0.00</strong>
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Estado Físico al Recibir</label>
                <select id="dev-renta-condicion" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                  <option value="Buen estado">Buen estado (Operativo)</option>
                  <option value="Daño menor / Desgaste normal">Daño menor / Desgaste normal</option>
                  <option value="Requiere servicio / Limpieza">Requiere servicio / Limpieza</option>
                  <option value="Dañado / Inoperativo">Dañado / Inoperativo</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Nivel de Combustible al Recibir</label>
                <select id="dev-renta-combustible" style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem;">
                  <option value="100%">100% (Lleno)</option>
                  <option value="75%">75% (3/4)</option>
                  <option value="50%">50% (1/2)</option>
                  <option value="25%">25% (1/4)</option>
                  <option value="Vacío / Faltante">Vacío / Faltante</option>
                  <option value="N/A (Eléctrico)">N/A (Eléctrico)</option>
                </select>
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-secondary, #cbd5e1);">Observaciones / Daños o Faltantes</label>
              <textarea id="dev-renta-danos" rows="2" placeholder="Describir condición de recepción, accesorios devueltos o faltantes..." style="width:100%; padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border, #334155); background:var(--bg-primary, #0f172a); color:var(--text-primary, #f8fafc); font-size:0.85rem; resize:vertical;"></textarea>
            </div>

            <!-- Botones -->
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--border, #334155); padding-top:1rem;">
              <button type="button" class="btn-secondary" onclick="window.cerrarModalDevolucionRenta()" style="padding:0.55rem 1.25rem; font-size:0.85rem;">Cancelar</button>
              <button type="submit" class="btn-primary" style="background:#10b981; border-color:#10b981; padding:0.55rem 1.5rem; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="check" style="width:16px; height:16px;"></i> Finalizar Renta y Liberar Equipo
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      window.calcularResumenDevolucion();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[Rentas] Error abriendo modal de devolución:', err);
    }
  };

  /**
   * Cerrar modal de devolución
   */
  window.cerrarModalDevolucionRenta = function() {
    const modal = document.getElementById('modal-devolucion-renta');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    rentaEnDevolucionId = null;
  };

  /**
   * Calcular en tiempo real las horas trabajadas en el modal de devolución
   */
  window.calcularResumenDevolucion = function() {
    try {
      if (!rentaEnDevolucionId) return;
      const r = (window.rentas || []).find(x => x && x.id === rentaEnDevolucionId);
      if (!r) return;

      const inputHoroFin = document.getElementById('dev-renta-horometro-fin');
      const horoFin = parseFloat(inputHoroFin?.value) || 0;
      const horoIni = parseFloat(r.horometro_inicial) || 0;

      const horasTrabajadas = Math.max(0, horoFin - horoIni);
      const limiteHoras = parseFloat(r.limite_horas_mes) || 200;
      const horasExcedentes = Math.max(0, horasTrabajadas - limiteHoras);
      const costoHoraExtra = parseFloat(r.costo_hora_excedente) || 0;
      const cargoExtra = horasExcedentes * costoHoraExtra;

      const resHoras = document.getElementById('dev-calc-horas-trabajadas');
      const resExcedente = document.getElementById('dev-calc-horas-excedentes');
      const resCargo = document.getElementById('dev-calc-cargo-extra');

      if (resHoras) resHoras.textContent = `${horasTrabajadas.toFixed(1)} hrs`;
      if (resExcedente) {
        resExcedente.textContent = `${horasExcedentes.toFixed(1)} hrs`;
        resExcedente.style.color = horasExcedentes > 0 ? '#ef4444' : 'var(--text-primary)';
      }
      if (resCargo) {
        resCargo.textContent = `$${cargoExtra.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        resCargo.style.color = cargoExtra > 0 ? '#ef4444' : '#10b981';
      }
    } catch (err) {
      console.warn('[Rentas] Error en cálculo de resumen de devolución:', err);
    }
  };

  /**
   * Confirmar y guardar la devolución / cierre de renta
   */
  window.confirmarDevolucionRentaSubmit = async function(event) {
    if (event) event.preventDefault();
    if (!rentaEnDevolucionId) return;

    try {
      const r = (window.rentas || []).find(x => x && x.id === rentaEnDevolucionId);
      if (!r) return;

      const inputFechaDev = document.getElementById('dev-renta-fecha');
      const inputHoroFin = document.getElementById('dev-renta-horometro-fin');
      const inputDanos = document.getElementById('dev-renta-danos');
      const selectCombustible = document.getElementById('dev-renta-combustible');
      const selectCondicion = document.getElementById('dev-renta-condicion');

      const horoFin = parseFloat(inputHoroFin?.value);
      if (isNaN(horoFin) || horoFin < (r.horometro_inicial || 0)) {
        if (!confirm('El horómetro final ingresado es menor o igual al horómetro inicial. ¿Deseas continuar de todos modos?')) {
          return;
        }
      }

      const checklistDev = {
        condicion: selectCondicion?.value || 'Buen estado',
        combustible: selectCombustible?.value || '100%',
        danos: inputDanos?.value?.trim() || 'Sin daños',
        recibido_por: (typeof currentSession !== 'undefined' && currentSession && currentSession.nombre) || 'Eurorep',
        fecha_recepcion: new Date().toISOString()
      };

      r.estado = 'Finalizada';
      r.fecha_devolucion_real = inputFechaDev?.value || new Date().toISOString().substring(0, 10);
      r.horometro_final = horoFin || r.horometro_inicial || 0;
      r.checklist_devolucion = checklistDev;
      r.updated_at = new Date().toISOString();
      r._synced = false;

      // Actualizar horómetro en el registro de la maquinaria si está vinculado
      if (r.maquina_id && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
        const maq = maquinariaDb.find(m => m && (m.idInterno === r.maquina_id || m.id === r.maquina_id || m.serie === r.serie));
        if (maq) {
          maq.horometro = r.horometro_final;
          if (!maq.customData) maq.customData = {};
          maq.customData.horometro = r.horometro_final;
          try {
            localStorage.setItem('sapi_maquinaria', JSON.stringify(maquinariaDb));
          } catch (e) {}
        }
      }

      localStorage.setItem('sapi_rentas', JSON.stringify(window.rentas));

      if (window.pushToSupabase) {
        window.pushToSupabase('rentas', r).then(() => {
          r._synced = true;
          localStorage.setItem('sapi_rentas', JSON.stringify(window.rentas));
          renderRentas();
        }).catch(err => console.warn('[Rentas] Error sincronizando devolución:', err));
      } else if (typeof window.syncGuardarRenta === 'function') {
        window.syncGuardarRenta(r);
      }

      cerrarModalDevolucionRenta();
      renderRentas();
      mostrarNotificacion(`✅ Renta ${r.folio} finalizada exitosamente. Maquinaria liberada.`, 'success');
    } catch (err) {
      console.error('[Rentas] Error confirmando devolución:', err);
      mostrarNotificacion('Error al registrar devolución de maquinaria', 'error');
    }
  };

  /**
   * Crear Orden de Servicio vinculada a la maquinaria en renta
   */
  window.crearServicioDesdeRenta = function(idRenta) {
    const r = (window.rentas || []).find(x => x.id === idRenta);
    if (!r) return;

    cerrarModalDetalleRenta();

    // Redirigir a vista servicios y abrir formulario
    const navServicios = document.querySelector('.nav-item[data-view="servicios"]');
    if (navServicios) navServicios.click();

    setTimeout(() => {
      if (typeof abrirFormulario === 'function') {
        abrirFormulario();
        // Prellenar campos
        setTimeout(() => {
          const selCli = document.getElementById('orden-cliente');
          const selSit = document.getElementById('orden-sitio');
          const selMaq = document.getElementById('orden-maquina');
          const inpFalla = document.getElementById('orden-falla');
          const inpTipo = document.getElementById('orden-tipo-servicio');

          if (selCli) selCli.value = r.cliente || '';
          if (selSit) selSit.value = r.sitio || '';
          if (selMaq) selMaq.value = r.equipo || r.maquina_id || '';
          if (inpTipo) inpTipo.value = 'Mantenimiento Preventivo';
          if (inpFalla) inpFalla.value = `Mantenimiento preventivo / revisión para equipo en renta activa (${r.folio || ''}). Horómetro actual: ${r.horometro_inicial || 0} hrs.`;
        }, 200);
      }
    }, 150);
  };

  /**
   * Generar Contrato / Ficha de Renta PDF oficial
   */
  window.generarContratoRentaPDF = function(idRenta) {
    const r = (window.rentas || []).find(x => x.id === idRenta);
    if (!r) return;

    const fIni = r.fecha_inicio ? r.fecha_inicio.substring(0, 10).split('-').reverse().join('/') : 'N/A';
    const fFin = r.fecha_fin_estimada ? r.fecha_fin_estimada.substring(0, 10).split('-').reverse().join('/') : 'Indefinida';
    const estadoCalc = calcularEstadoRenta(r);

    const docContent = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 24px; line-height: 1.5; background: #ffffff;">
        <!-- Encabezado Corporativo -->
        <table style="width: 100%; border-bottom: 3px solid #E8820C; padding-bottom: 12px; margin-bottom: 20px;">
          <tr>
            <td style="width: 50%; vertical-align: middle;">
              <div style="font-size: 24px; font-weight: 800; color: #E8820C; letter-spacing: -0.5px;">EUROREP</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600;">SERVICIOS Y MAQUINARIA INDUSTRIAL</div>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: middle;">
              <div style="font-size: 18px; font-weight: 700; color: #0f172a;">CONTRATO DE ARRENDAMIENTO</div>
              <div style="font-size: 14px; font-weight: 700; color: #E8820C; font-family: monospace;">FOLIO: ${r.folio || 'REN-0000'}</div>
              <div style="font-size: 11px; color: #64748b;">Fecha Emisión: ${new Date().toLocaleDateString('es-MX')}</div>
            </td>
          </tr>
        </table>

        <!-- Datos Principales -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <tr>
            <td style="width: 50%; vertical-align: top; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="font-weight: 700; color: #E8820C; margin-bottom: 6px; text-transform: uppercase; font-size: 11px;">ARRENDATARIO (CLIENTE)</div>
              <div><strong>Razón Social:</strong> ${r.cliente || 'Sin Especificar'}</div>
              <div><strong>Ubicación / Sitio:</strong> ${r.sitio || 'General'}</div>
              <div><strong>Asesor Eurorep:</strong> ${r.asesor_comercial || 'Equipo de Rentas'}</div>
            </td>
            <td style="width: 50%; vertical-align: top; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-left: 8px;">
              <div style="font-weight: 700; color: #E8820C; margin-bottom: 6px; text-transform: uppercase; font-size: 11px;">VIGENCIA Y CONDICIONES</div>
              <div><strong>Fecha de Inicio:</strong> ${fIni}</div>
              <div><strong>Fecha Término Estimada:</strong> ${fFin}</div>
              <div><strong>Estatus del Contrato:</strong> ${estadoCalc}</div>
            </td>
          </tr>
        </table>

        <!-- Ficha de la Maquinaria -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. ESPECIFICACIONES DE LA MAQUINARIA ARRENDADA</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; font-weight: 700;">
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Descripción del Equipo</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">No. Serie</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">ID Interno</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Horómetro Entrega</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${r.equipo || 'Equipo'}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${r.serie || 'S/N'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${r.maquina_id || '-'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${r.horometro_inicial || 0} hrs</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Condiciones Económicas -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. CONDICIONES ECONÓMICAS Y TARIFAS</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1;">
            <tr style="background: #f8fafc;">
              <td style="padding: 8px; border: 1px solid #cbd5e1; width: 50%;"><strong>Tarifa de Arrendamiento:</strong></td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; width: 50%; font-weight: 700; color: #0f172a;">$${Number(r.monto_renta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (${r.tarifa_tipo || 'mensual'}) + IVA</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Depósito en Garantía:</strong></td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">$${Number(r.deposito_garantia || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Límite de Uso Incluido:</strong></td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${r.limite_horas_mes || 200} horas por periodo</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>Costo por Hora Extra Excedente:</strong></td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">$${Number(r.costo_hora_excedente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN/hora</td>
            </tr>
          </table>
        </div>

        <!-- Checklist de Entrega Inicial -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. CONDICIÓN DE ENTREGA (CHECK-IN)</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1;">
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 25%;"><strong>Estado Físico:</strong> ${r.checklist_entrega?.condicion || 'Excelente'}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 25%;"><strong>Combustible:</strong> ${r.checklist_entrega?.combustible || '100%'}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 50%;"><strong>Accesorios Entregados:</strong> ${r.checklist_entrega?.accesorios || 'Estándar'}</td>
            </tr>
          </table>
        </div>

        <!-- Firmas -->
        <table style="width: 100%; margin-top: 40px; font-size: 11px;">
          <tr>
            <td style="width: 45%; text-align: center; border-top: 1px solid #64748b; padding-top: 8px;">
              <strong>POR EL ARRENDADOR</strong><br/>
              EUROREP INDUSTRIAL SERVICES<br/>
              Nombre y Firma
            </td>
            <td style="width: 10%;"></td>
            <td style="width: 45%; text-align: center; border-top: 1px solid #64748b; padding-top: 8px;">
              <strong>POR EL ARRENDATARIO</strong><br/>
              ${r.cliente || 'CLIENTE'}<br/>
              Nombre, Firma y Sello de Recepción
            </td>
          </tr>
        </table>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Contrato de Renta ${r.folio || ''} - Eurorep</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${docContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } else {
      mostrarNotificacion('Por favor permite las ventanas emergentes para generar el documento PDF.', 'warning');
    }
  };

  /**
   * Exportar lista de contratos a archivo Excel
   */
  window.exportarRentasExcel = function() {
    if (typeof XLSX === 'undefined') {
      mostrarNotificacion('Librería XLSX no cargada', 'error');
      return;
    }

    const list = Array.isArray(window.rentas) ? window.rentas : [];
    if (list.length === 0) {
      mostrarNotificacion('No hay contratos de renta para exportar', 'warning');
      return;
    }

    const rows = list.map(r => ({
      'Folio': r.folio || '',
      'Cliente': r.cliente || '',
      'Sitio / Ubicación': r.sitio || '',
      'Equipo': r.equipo || '',
      'No. Serie': r.serie || '',
      'ID Maquinaria': r.maquina_id || '',
      'Fecha Inicio': r.fecha_inicio || '',
      'Fecha Fin Estimada': r.fecha_fin_estimada || '',
      'Fecha Devolución Real': r.fecha_devolucion_real || '',
      'Estado': calcularEstadoRenta(r),
      'Tipo Tarifa': r.tarifa_tipo || 'mensual',
      'Monto Renta ($)': r.monto_renta || 0,
      'Depósito Garantía ($)': r.deposito_garantia || 0,
      'Horómetro Inicial': r.horometro_inicial || 0,
      'Horómetro Final': r.horometro_final || '',
      'Horas Trabajadas': (r.horometro_final != null) ? (Number(r.horometro_final) - Number(r.horometro_inicial || 0)) : '',
      'Límite Horas': r.limite_horas_mes || 200,
      'Costo Hora Extra ($)': r.costo_hora_excedente || 0,
      'Asesor Comercial': r.asesor_comercial || '',
      'Notas': r.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rentas_Eurorep');
    const fechaStr = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `Rentas_Maquinaria_Eurorep_${fechaStr}.xlsx`);
    mostrarNotificacion('✅ Exportación a Excel completada con éxito', 'success');
  };

  // Inicializar al cargar el script
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(actualizarBadgeRentasSidebar, 500);
  }
})();
