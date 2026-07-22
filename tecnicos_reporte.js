// Reporte Resumen Semanal de Técnicos
(function() {
  window.abrirModalReporteSemanalTecnicos = function() {
    const isAllowed = (typeof currentSession !== 'undefined') && ['superadmin', 'admin'].includes(currentSession.viewMode);
    if (!isAllowed) {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Acceso denegado: Solo administradores y superadmins pueden ver este reporte.', 'error');
      } else {
        alert('Acceso denegado: Solo administradores y superadmins pueden ver este reporte.');
      }
      return;
    }

    const isTest = (typeof isTestModeActive === 'function' && isTestModeActive());
    
    // Obtener lunes de la semana actual por defecto
    const hoy = new Date();
    const lunesActual = obtenerLunes(hoy);
    
    const m = document.createElement('div');
    m.id = 'modal-reporte-semanal';
    m.className = 'modal-overlay';
    m.style.position = 'fixed';
    m.style.top = '0'; m.style.left = '0'; m.style.width = '100vw'; m.style.height = '100vh';
    m.style.background = 'rgba(0,0,0,0.6)'; m.style.display = 'flex';
    m.style.alignItems = 'center'; m.style.justifyContent = 'center'; m.style.zIndex = '99999';
    
    m.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; width:95%; max-width:1200px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
        <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-primary);">Resumen Semanal de Técnicos</h3>
            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Genera la tabla de servicios semanales y descárgala en formato CSV.</p>
          </div>
          <button type="button" class="btn-secondary" style="padding:0.4rem; min-width:unset; border-radius:50%;" onclick="document.getElementById('modal-reporte-semanal').remove()">
            <i data-lucide="x" style="width:16px; height:16px;"></i>
          </button>
        </div>
        
        <div style="padding:1rem 1.5rem; background:rgba(255,255,255,0.02); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <label style="font-size:0.85rem; font-weight:600;">Seleccionar Semana (Cualquier día de la semana):</label>
            <input type="date" id="rep-semana-fecha" value="${hoy.toISOString().split('T')[0]}" style="padding:0.35rem 0.5rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-body); color:var(--text-primary); font-size:0.85rem;" onchange="window.actualizarTablaReporteSemanal()">
            <span id="rep-semana-numero" style="font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-left:0.25rem;"></span>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div id="rep-tecnicos-libres" style="font-size:0.85rem; font-weight:700; color:var(--accent); background:var(--accent-light); padding:0.3rem 0.6rem; border-radius:6px;">
              0 Técnicos libres
            </div>
            <button class="btn-primary" onclick="window.descargarReporteSemanalCSV()" style="display:flex; align-items:center; gap:0.4rem; padding:0.45rem 0.9rem; font-size:0.85rem;">
              <i data-lucide="download" style="width:15px; height:15px;"></i> Exportar CSV
            </button>
          </div>
        </div>
        
        <div style="flex:1; overflow-y:auto; padding:1.5rem;">
          <div class="table-wrapper" style="margin-top:0; border-radius:8px; border:1px solid var(--border);">
            <table class="orders-table" id="tabla-reporte-semanal" style="width:100%;">
              <thead>
                <tr id="rep-header-row">
                  <th style="text-align:left;">Técnico</th>
                  <th style="text-align:center;">Lunes</th>
                  <th style="text-align:center;">Martes</th>
                  <th style="text-align:center;">Miércoles</th>
                  <th style="text-align:center;">Jueves</th>
                  <th style="text-align:center;">Viernes</th>
                  <th style="text-align:center;">Sábado</th>
                  <th style="text-align:center;">Domingo</th>
                  <th style="text-align:center; width:100px;">Reporte Enviado</th>
                  <th style="text-align:center; width:80px;">Días con servicio</th>
                  <th style="text-align:center; width:120px;">Pago sugerido ($)</th>
                  <th style="text-align:center;">Observaciones</th>
                </tr>
              </thead>
              <tbody id="rep-body-rows">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(m);
    if (window.lucide) lucide.createIcons();
    
    window.actualizarTablaReporteSemanal();
  };

  function obtenerLunes(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  function formatShortDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatISODate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }

  const formatNombreCorto = (nombre) => {
    if (!nombre) return '';
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return `${partes[0]} ${partes[1]}`;
    return nombre.trim();
  };

  window.actualizarTablaReporteSemanal = function() {
    const fechaVal = document.getElementById('rep-semana-fecha').value;
    if (!fechaVal) return;
    
    const lunes = obtenerLunes(new Date(fechaVal + 'T00:00:00'));
    
    // Calcular número de semana
    const obtenerSemanaAno = (fecha) => {
      const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };
    const nSemana = obtenerSemanaAno(lunes);
    const spanSemana = document.getElementById('rep-semana-numero');
    if (spanSemana) {
      spanSemana.textContent = `(Semana ${nSemana})`;
    }
    
    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(lunes);
      next.setDate(lunes.getDate() + i);
      diasSemana.push(next);
    }
    
    // Actualizar encabezados de los días
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const headerRow = document.getElementById('rep-header-row');
    if (headerRow) {
      headerRow.innerHTML = `
        <th style="text-align:left;">Técnico</th>
        ${diasSemana.map((d, idx) => `<th style="text-align:center;">${nombresDias[idx]}<br><span style="font-size:0.7rem; font-weight:normal; opacity:0.7;">${formatShortDate(d)}</span></th>`).join('')}
        <th style="text-align:center;">Reporte Enviado</th>
        <th style="text-align:center;">Días con servicio</th>
        <th style="text-align:center;">Pago sugerido ($)</th>
        <th style="text-align:center;">Observaciones</th>
      `;
    }
    
    // Obtener técnicos
    const legacyTecs = getFilteredOrders().map(o => o.tecnico).filter(Boolean).map(formatNombreCorto);
    const userTecs = usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && ((typeof isTestModeActive === 'function' && isTestModeActive()) || !(typeof isTestUser === 'function' && isTestUser(u)))).map(u => formatNombreCorto(u.nombre));
    const sapTecs = (typeof tecnicosDb !== 'undefined' ? tecnicosDb.map(t => formatNombreCorto(t.nombre)).filter(Boolean) : []);
    
    let tecsArr = [];
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.USE_SAP_BACKEND && sapTecs.length > 0) {
      tecsArr = [...sapTecs, ...userTecs];
    } else {
      tecsArr = [...legacyTecs, ...userTecs, ...sapTecs];
    }
    
    const tecs = [...new Set(tecsArr)]
      .filter(t => !t.toUpperCase().includes('N/A') && t.trim() !== '' && !['LAURA PAZ', 'ADRIAN FRANCO'].includes(t.toUpperCase()))
      .filter(t => {
        const tecObj = (typeof tecnicosDb !== 'undefined' ? tecnicosDb.find(x => formatNombreCorto(x.nombre) === t) : null) || usuarios.find(u => formatNombreCorto(u.nombre) === t);
        if (tecObj && !(typeof isTestModeActive === 'function' && isTestModeActive()) && (typeof isTestUser === 'function' && isTestUser(tecObj))) return false;
        const tRol = (tecObj?.tipoUsuario || tecObj?.rol || '').toLowerCase();
        return !tRol.includes('consulta');
      })
      .sort();
      
    const resolveFullName = (shortName) => {
      const match = (typeof tecnicosDb !== 'undefined' ? tecnicosDb.find(x => formatNombreCorto(x.nombre) === shortName) : null) || usuarios.find(u => formatNombreCorto(u.nombre) === shortName);
      return match ? match.nombre.toUpperCase() : shortName.toUpperCase();
    };
    
    const isTest = (typeof isTestModeActive === 'function' && isTestModeActive());
    const orders = getFilteredOrders();
    const weekIsoDates = diasSemana.map(d => formatISODate(d));
    
    let libresCount = 0;
    const tbody = document.getElementById('rep-body-rows');
    tbody.innerHTML = '';
    
    tecs.forEach(tShort => {
      const full = resolveFullName(tShort);
      
      // Obtener estatus de cada día
      const statuses = weekIsoDates.map(isoDate => {
        let conServicio = false;
        let conVacaciones = false;
        let infoServicios = [];
        
        orders.forEach(o => {
          if (typeof isTestData === 'function' && isTestData(o) !== isTest) return;
          
          let matchesOrder = false;
          // Verificar bitácora
          if (o.bitacora && Array.isArray(o.bitacora)) {
            o.bitacora.forEach(b => {
              if (b.tecnico && formatNombreCorto(b.tecnico) === formatNombreCorto(tShort)) {
                let bDate = b.fecha || '';
                if (bDate.includes('T')) bDate = bDate.split('T')[0];
                if (bDate === isoDate) {
                  matchesOrder = true;
                }
              }
            });
          }
          
          // Verificar asignación directa por fecha
          let oDate = o.fecha || '';
          if (oDate.includes('T')) oDate = oDate.split('T')[0];
          if (oDate === isoDate) {
            let assigned = [];
            if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
              assigned = o.tecnicosAsignados.map(id => formatNombreCorto(resolveTecnicoNombre(id)));
            } else if (o.tecnico) {
              assigned = o.tecnico.split(',').map(s => formatNombreCorto(s.trim()));
            }
            if (assigned.includes(formatNombreCorto(tShort))) {
              matchesOrder = true;
            }
          }

          if (matchesOrder) {
            conServicio = true;
            const folioText = o.folio || 'Sin Folio';
            const clienteText = o.cliente || 'Sin Cliente';
            infoServicios.push(`${clienteText} (${folioText})`);
          }
        });

        // Verificar vacaciones en el calendario
        const calendarEvents = window._supaCalendarioEventos || [];
        calendarEvents.forEach(e => {
          if (e.tipo === 'Vacaciones') {
            let isThisTec = false;
            if (e.tecnicoNombre && formatNombreCorto(e.tecnicoNombre) === formatNombreCorto(tShort)) {
              isThisTec = true;
            } else if (e.tecnicoId) {
              const matchedUser = usuarios.find(u => u.id === e.tecnicoId);
              if (matchedUser && formatNombreCorto(matchedUser.nombre) === formatNombreCorto(tShort)) {
                isThisTec = true;
              }
            }
            
            if (isThisTec) {
              let eStart = e.fechaInicio || '';
              if (eStart.includes('T')) eStart = eStart.split('T')[0];
              let eEnd = e.fechaFin || '';
              if (eEnd.includes('T')) eEnd = eEnd.split('T')[0];
              if (!eEnd) eEnd = eStart;
              
              if (isoDate >= eStart && isoDate <= eEnd) {
                conVacaciones = true;
              }
            }
          }
        });
        
        if (conServicio) {
          if (conVacaciones) infoServicios.push('Vacaciones');
          return { text: infoServicios.join(', '), isCon: true, isVac: conVacaciones };
        } else if (conVacaciones) {
          return { text: 'Vacaciones', isCon: false, isVac: true };
        } else {
          return { text: 'Sin servicio', isCon: false, isVac: false };
        }
      });
      
      const diasConServicio = statuses.filter(s => s.isCon).length;
      const diasOcupados = statuses.filter(s => s.isCon || s.isVac).length;
      if (diasOcupados === 0) {
        libresCount++;
      }
      
      // Calcular reporte enviado
      let totalEntries = 0;
      let completedEntries = 0;
      orders.forEach(o => {
        if (typeof isTestData === 'function' && isTestData(o) !== isTest) return;
        if (o.bitacora && Array.isArray(o.bitacora)) {
          o.bitacora.forEach(b => {
            if (b.tecnico && formatNombreCorto(b.tecnico) === formatNombreCorto(tShort)) {
              let bDate = b.fecha || '';
              if (bDate.includes('T')) bDate = bDate.split('T')[0];
              if (weekIsoDates.includes(bDate)) {
                totalEntries++;
                if (b.realizado === true) completedEntries++;
              }
            }
          });
        }
      });
      
      const reporteEnviado = totalEntries > 0 && completedEntries === totalEntries ? 'Sí' : 'No';
      
      // Pago sugerido: 400 por día con servicio
      const pagoSugerido = diasConServicio * 400;
      
      // Auto-detectar observaciones comunes (ej. si hay zona metropolitana)
      let defaultObs = '';
      if (diasConServicio > 0) {
        // Check if all services in this week were in CDMX or EdoMex or specified as metropolitan
        let hasMetro = false;
        orders.forEach(o => {
          if (typeof isTestData === 'function' && isTestData(o) !== isTest) return;
          let hasTec = false;
          if (o.bitacora && Array.isArray(o.bitacora)) {
            hasTec = o.bitacora.some(b => b.tecnico && formatNombreCorto(b.tecnico) === formatNombreCorto(tShort) && weekIsoDates.includes((b.fecha || '').split('T')[0]));
          }
          if (hasTec) {
            const loc = (o.ubicacion || '').toLowerCase();
            if (loc.includes('cdmx') || loc.includes('df') || loc.includes('edo. mex') || loc.includes('estado de mexico') || loc.includes('metropolitana') || loc.includes('naucalpan') || loc.includes('tlanepantla')) {
              hasMetro = true;
            }
          }
        });
        if (hasMetro) {
          defaultObs = 'Zona metropolitana';
        }
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700; color:var(--text-primary); text-align:left;">${full}</td>
        ${statuses.map(s => {
          const isCon = s.isCon;
          const isVac = s.isVac;
          let bg = 'transparent';
          let fg = 'var(--text-muted)';
          if (isCon) {
            bg = 'rgba(234, 179, 8, 0.15)';
            fg = 'var(--accent)';
          } else if (isVac) {
            bg = 'rgba(245, 158, 11, 0.15)';
            fg = '#f59e0b';
          }
          return `<td style="background:${bg}; color:${fg}; font-weight:${(isCon || isVac) ? '700' : 'normal'}; text-align:center; font-size:${(isCon || isVac) ? '0.72rem' : '0.8rem'}; line-height: 1.2; padding: 0.4rem 0.25rem;">${s.text}</td>`;
        }).join('')}
        <td style="text-align:center; font-weight:600; color:${reporteEnviado === 'Sí' ? 'var(--green)' : 'var(--red)'};">${reporteEnviado}</td>
        <td style="text-align:center; font-weight:700;">${diasConServicio}</td>
        <td style="text-align:center; padding: 0.25rem;">
          <input type="number" class="rep-pago-input" data-tec="${tShort}" value="${pagoSugerido}" style="width:90px; text-align:center; padding:0.3rem; border:1px solid var(--border); background:var(--bg-body); color:var(--text-primary); border-radius:4px; font-weight:700;">
        </td>
        <td style="text-align:center; padding: 0.25rem;">
          <input type="text" class="rep-obs-input" data-tec="${tShort}" value="${defaultObs}" placeholder="Observaciones..." style="width:100%; min-width:140px; padding:0.3rem; border:1px solid var(--border); background:var(--bg-body); color:var(--text-primary); border-radius:4px;">
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Actualizar contador
    document.getElementById('rep-tecnicos-libres').textContent = `${libresCount} Técnicos libres`;
  };

  window.descargarReporteSemanalCSV = function() {
    const fechaVal = document.getElementById('rep-semana-fecha').value;
    if (!fechaVal) return;
    
    const lunes = obtenerLunes(new Date(fechaVal + 'T00:00:00'));
    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(lunes);
      next.setDate(lunes.getDate() + i);
      diasSemana.push(next);
    }
    
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    // Crear encabezados CSV
    const headers = [
      'Tecnico',
      ...diasSemana.map((d, idx) => `${nombresDias[idx]} ${formatShortDate(d)}`),
      'Reporte Enviado',
      'Dias con servicio',
      'Pago sugerido',
      'Observaciones'
    ];
    
    const rows = [headers];
    
    const trs = document.querySelectorAll('#rep-body-rows tr');
    trs.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 12) return;
      
      const tecNombre = tds[0].textContent.trim();
      const lunesVal = tds[1].textContent.trim();
      const martesVal = tds[2].textContent.trim();
      const miercolesVal = tds[3].textContent.trim();
      const juevesVal = tds[4].textContent.trim();
      const viernesVal = tds[5].textContent.trim();
      const sabadoVal = tds[6].textContent.trim();
      const domingoVal = tds[7].textContent.trim();
      const reporteVal = tds[8].textContent.trim();
      const diasVal = tds[9].textContent.trim();
      
      // Obtener inputs editados
      const tecKey = tr.querySelector('.rep-pago-input').getAttribute('data-tec');
      const pagoVal = tr.querySelector(`.rep-pago-input[data-tec="${tecKey}"]`).value;
      const obsVal = tr.querySelector(`.rep-obs-input[data-tec="${tecKey}"]`).value;
      
      rows.push([
        tecNombre,
        lunesVal,
        martesVal,
        miercolesVal,
        juevesVal,
        viernesVal,
        sabadoVal,
        domingoVal,
        reporteVal,
        diasVal,
        pagoVal,
        obsVal
      ]);
    });
    
    // Generar archivo CSV (con codificación UTF-8 con BOM para Excel)
    const csvContent = "\uFEFF" + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const lunesFormatted = formatShortDate(lunes).replace(/\//g, '-');
    link.setAttribute("download", `Reporte_Semanal_Tecnicos_${lunesFormatted}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion('CSV descargado con éxito', 'success');
  };
})();
