/**
 * Módulo de Asignación Semanal y Programación de Técnicos - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { safeFormatDate, getLocalDateString, normStr } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";

// Helpers de acceso seguro a colecciones y utilidades
function _getOrdenes() {
  if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) return ordenes;
  if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) return window.ordenes;
  return [];
}

function _getUsuarios() {
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) return usuarios;
  if (typeof window !== 'undefined' && Array.isArray(window.usuarios)) return window.usuarios;
  return [];
}

function _getTickets() {
  if (typeof tickets !== 'undefined' && Array.isArray(tickets)) return tickets;
  if (typeof window !== 'undefined' && Array.isArray(window.tickets)) return window.tickets;
  return [];
}

function _getSession() {
  if (typeof currentSession !== 'undefined' && currentSession) return currentSession;
  if (typeof window !== 'undefined' && window.currentSession) return window.currentSession;
  return { viewMode: 'tecnico', userId: null };
}

function _notify(msg, tipo = 'success') {
  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(msg, tipo);
  } else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') {
    window.mostrarNotificacion(msg, tipo);
  } else {
    alert(msg);
  }
}

function _saveJSON(key, value) {
  if (typeof safeSetJSON === 'function') {
    safeSetJSON(key, value);
  } else if (typeof window !== 'undefined' && typeof window.safeSetJSON === 'function') {
    window.safeSetJSON(key, value);
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function _isTestMode() {
  if (typeof isTestModeActive === 'function') return isTestModeActive();
  if (typeof window !== 'undefined' && typeof window.isTestModeActive === 'function') return window.isTestModeActive();
  return false;
}

function _isTestUser(u) {
  if (typeof isTestUser === 'function') return isTestUser(u);
  if (typeof window !== 'undefined' && typeof window.isTestUser === 'function') return window.isTestUser(u);
  return false;
}

function _getUserName() {
  if (typeof obtenerNombreUsuarioActual === 'function') return obtenerNombreUsuarioActual();
  if (typeof window !== 'undefined' && typeof window.obtenerNombreUsuarioActual === 'function') return window.obtenerNombreUsuarioActual();
  return '';
}

function _getLocalDate(date = new Date()) {
  if (typeof getLocalDateString === 'function') return getLocalDateString(date);
  if (typeof window !== 'undefined' && typeof window.getLocalDateString === 'function') return window.getLocalDateString(date);
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function _getFilteredOrds() {
  if (typeof getFilteredOrders === 'function') return getFilteredOrders();
  if (typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function') return window.getFilteredOrders();
  return _getOrdenes();
}

// ===== ASIGNACIÓN DIRECTA DE TÉCNICOS =====
function abrirAsignarTecnicos() {
  const ordenesList = _getOrdenes();
  const ordId = typeof window !== 'undefined' ? window.currentDetalleOrdenId : null;
  const o = ordenesList.find(x => x.id === ordId);
  if (!o) return;

  const container = document.getElementById('at-tecnicos-container');
  if (container) {
    container.innerHTML = '';
    const assigned = o.tecnicosAsignados || [];
    const userList = _getUsuarios();
    userList.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && (_isTestMode() || !_isTestUser(u))).forEach(u => {
      const isChecked = assigned.includes(u.nombre);
      container.innerHTML += `
        <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; background: var(--bg-body); padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
          <input type="checkbox" name="at-tecnicos" value="${u.nombre}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; margin:0; margin-top:1px; flex-shrink:0;"/>
          <span style="flex:1; text-align:left; font-weight:normal; color:var(--text-primary);">${u.nombre}</span>
        </label>
      `;
    });
  }
  const modal = document.getElementById('modal-asignar-tecnicos-overlay');
  if (modal) modal.classList.add('open');
}

function cerrarAsignarTecnicos(e) {
  if (e && e.target !== document.getElementById('modal-asignar-tecnicos-overlay')) return;
  const modal = document.getElementById('modal-asignar-tecnicos-overlay');
  if (modal) modal.classList.remove('open');
}

function guardarAsignacionTecnicos() {
  const ordenesList = _getOrdenes();
  const ordId = typeof window !== 'undefined' ? window.currentDetalleOrdenId : null;
  const o = ordenesList.find(x => x.id === ordId);
  if (!o) return;

  const selectedT = Array.from(document.querySelectorAll('input[name="at-tecnicos"]:checked')).map(cb => cb.value);
  o.tecnicosAsignados = selectedT;
  o.tecnico = selectedT.join(', ');

  _saveJSON('sapi_ordenes', ordenesList);
  if (typeof window !== 'undefined' && window.pushToSupabase) {
    window.pushToSupabase('ordenes', o);
  }

  _notify('Técnicos asignados correctamente.', 'success');
  cerrarAsignarTecnicos();

  if (typeof verDetalle === 'function') {
    verDetalle(o.id);
  } else if (typeof window !== 'undefined' && typeof window.verDetalle === 'function') {
    window.verDetalle(o.id);
  }

  if (typeof renderCalendario === 'function' && document.getElementById('view-calendario')?.classList.contains('active')) {
    renderCalendario();
  } else if (typeof window !== 'undefined' && typeof window.renderCalendario === 'function' && document.getElementById('view-calendario')?.classList.contains('active')) {
    window.renderCalendario();
  } else if (typeof filtrarOrdenes === 'function') {
    filtrarOrdenes();
  } else if (typeof window !== 'undefined' && typeof window.filtrarOrdenes === 'function') {
    window.filtrarOrdenes();
  }
}

// ===== HELPERS DE CÁLCULO DE FECHAS Y SEMANAS =====
function obtenerDiaDeSemanaLocal(fechaStr) {
  if (!fechaStr) return -1;
  const [year, month, day] = fechaStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
}

function calcularFechaParaDiaDeSemana(baseFechaStr, targetDayIndex) {
  const [year, month, day] = baseFechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  const baseDay = baseDate.getDay();
  // Normalizar semana laboral de lunes (1) a domingo (7)
  const normBase = baseDay === 0 ? 7 : baseDay;
  const normTarget = targetDayIndex === 0 ? 7 : targetDayIndex;
  const diff = normTarget - normBase;
  const targetDate = new Date(year, month - 1, day + diff);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function horaAMinutos(hora) {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function hayTraslapoHorario(entrada1, salida1, entrada2, salida2) {
  const e1 = horaAMinutos(entrada1);
  const s1 = horaAMinutos(salida1);
  const e2 = horaAMinutos(entrada2);
  const s2 = horaAMinutos(salida2);
  if (e1 === null || s1 === null || e2 === null || s2 === null) return true;
  return e1 < s2 && e2 < s1;
}

// ===== RENDER DEL CALENDARIO SEMANAL MODAL =====
function renderCalendarioSemanalModal(baseFechaStr) {
  if (!baseFechaStr) return;
  const [year, month, day] = baseFechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  const baseDay = baseDate.getDay();

  // Encontrar el lunes (día 1) de la semana correspondiente
  const diffToMonday = 1 - (baseDay === 0 ? 7 : baseDay);
  const mondayDate = new Date(year, month - 1, day + diffToMonday);

  const mY = mondayDate.getFullYear();
  const mM = String(mondayDate.getMonth() + 1).padStart(2, '0');
  const mD = String(mondayDate.getDate()).padStart(2, '0');
  const mondayStr = `${mY}-${mM}-${mD}`;
  const inputFecha = document.getElementById('pt-fecha');
  if (inputFecha) inputFecha.value = mondayStr;

  if (typeof window !== 'undefined') {
    if (!window.weeklyDayBlocks) {
      window.weeklyDayBlocks = {};
      for (let i = 0; i <= 6; i++) {
        window.weeklyDayBlocks[i] = [{
          id: `${i}-0`,
          tipo: 'Servicio',
          ordenId: '',
          entrada: '',
          salida: '',
          idaHora: '',
          idaHoras: '',
          regresoHora: '',
          regresoHoras: '',
          trasladoOpen: false
        }];
      }
    }
  }

  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);

  const options = { month: 'short', day: 'numeric' };
  const labelText = `Semana del ${mondayDate.toLocaleDateString('es-MX', options)} al ${sundayDate.toLocaleDateString('es-MX', { ...options, year: 'numeric' })}`;

  const labelEl = document.getElementById('pt-semana-label');
  if (labelEl) labelEl.textContent = labelText;

  const grid = document.getElementById('pt-calendario-semanal-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const orderOfDays = [1, 2, 3, 4, 5, 6, 0];

  orderOfDays.forEach(dayIdx => {
    const targetDate = new Date(mondayDate);
    const diff = dayIdx === 0 ? 6 : dayIdx - 1;
    targetDate.setDate(mondayDate.getDate() + diff);

    const dateNum = targetDate.getDate();
    const dayName = diasNombres[dayIdx];

    const cb = document.getElementById(`pt-rep-${dayIdx}`);
    const isChecked = cb ? cb.checked : false;

    const todayStr = _getLocalDate();
    const targetStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
    const isToday = (todayStr === targetStr);

    const card = document.createElement('div');
    card.className = `pt-dia-card ${isChecked ? 'active' : ''} ${isToday ? 'today' : ''}`;
    card.setAttribute('onclick', `toggleDiaSemanaModal(${dayIdx})`);

    card.innerHTML = `
      <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">${dayName}</div>
      <div style="font-size: 1.1rem; font-weight: 700; margin: 0.15rem 0; color: ${isChecked ? 'var(--accent)' : 'var(--text-primary)'};">${dateNum}</div>
      <div style="font-size: 0.55rem; font-weight: 600; padding: 0.1rem 0.2rem; border-radius: 3px; background: ${isChecked ? 'var(--accent-light)' : 'rgba(255,255,255,0.03)'}; color: ${isChecked ? 'var(--accent)' : 'var(--text-muted)'}; text-align: center;">
        ${isChecked ? 'Sí' : 'No'}
      </div>
    `;

    grid.appendChild(card);
  });

  // Generar lista de personalización de orden por día
  const activeDays = orderOfDays.filter(dayIdx => {
    const cb = document.getElementById(`pt-rep-${dayIdx}`);
    return cb ? cb.checked : false;
  });

  const detailsContainer = document.getElementById('pt-detalles-dias-container');
  const detailsList = document.getElementById('pt-detalles-dias-list');
  const listWrapper = document.getElementById('pt-detalles-dias-list-wrapper');

  if (detailsContainer && detailsList && listWrapper) {
    if (activeDays.length > 0) {
      detailsContainer.style.display = 'block';

      const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
      const mismaOrden = mismaOrdenCb ? mismaOrdenCb.checked : true;
      listWrapper.style.display = mismaOrden ? 'none' : 'flex';

      const mainOrderGroup = document.getElementById('pt-grupo-orden-principal');
      if (mainOrderGroup) mainOrderGroup.style.display = mismaOrden ? 'block' : 'none';

      const mainTypeGroup = document.getElementById('pt-grupo-tipo-principal');
      if (mainTypeGroup) mainTypeGroup.style.display = mismaOrden ? 'block' : 'none';

      const mainHoursGroup = document.getElementById('pt-grupo-horario-principal');
      if (mainHoursGroup) mainHoursGroup.style.display = mismaOrden ? 'grid' : 'none';

      const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
      activeDays.forEach(dayIdx => {
        const blocks = weeklyBlocks[dayIdx] || [];
        blocks.forEach((block, blockIdx) => {
          const sel = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}`);
          if (sel) block.ordenId = sel.value;
          const selTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`);
          if (selTipo) block.tipo = selTipo.value;
          const selEntrada = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`);
          if (selEntrada) block.entrada = selEntrada.value;
          const selSalida = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`);
          if (selSalida) block.salida = selSalida.value;

          const selIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}`);
          if (selIdaHora) block.idaHora = selIdaHora.value;
          const selIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}`);
          if (selIdaHoras) block.idaHoras = selIdaHoras.value;
          const selRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}`);
          if (selRegresoHora) block.regresoHora = selRegresoHora.value;
          const selRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}`);
          if (selRegresoHoras) block.regresoHoras = selRegresoHoras.value;

          const container = document.getElementById(`pt-traslado-dia-container-${dayIdx}-${blockIdx}`);
          if (container) block.trasladoOpen = (container.style.display !== 'none');
        });
      });

      // Obtener órdenes abiertas
      const openOrds = _getFilteredOrds().filter(o => o.estado !== 'Finalizado');
      const mainOrdenInput = document.getElementById('pt-orden');
      const mainOrdenId = mainOrdenInput ? mainOrdenInput.value : '';
      const mainTipoInput = document.getElementById('pt-tipo');
      const mainTipo = mainTipoInput ? mainTipoInput.value || 'Servicio' : 'Servicio';
      const mainEntradaInput = document.getElementById('pt-entrada');
      const mainEntrada = mainEntradaInput ? mainEntradaInput.value || '' : '';
      const mainSalidaInput = document.getElementById('pt-salida');
      const mainSalida = mainSalidaInput ? mainSalidaInput.value || '' : '';

      detailsList.innerHTML = activeDays.map(dayIdx => {
        const targetDate = new Date(mondayDate);
        const diff = dayIdx === 0 ? 6 : dayIdx - 1;
        targetDate.setDate(mondayDate.getDate() + diff);

        const dateStr = `${diasNombres[dayIdx]} ${targetDate.getDate()} de ${targetDate.toLocaleDateString('es-MX', { month: 'short' })}`;
        const blocks = weeklyBlocks[dayIdx] || [];

        const blocksHtml = blocks.map((block, blockIdx) => {
          const dayOptionsHtml = openOrds.map(o => {
            const displayStr = `[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}`.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const htmlStr = `[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}`.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="combo-option" style="padding: 0.35rem 0.5rem; font-size: 0.75rem;" onclick="selectComboOption('pt-orden-dia-${dayIdx}-${blockIdx}', '${o.id}', '${displayStr}')">${htmlStr}</div>`;
          }).join('');

          const deleteBtnHtml = blockIdx > 0
            ? `<a href="#" onclick="window.quitarActividadSemanal(${dayIdx}, ${blockIdx}); return false;" style="font-size:0.7rem; color:var(--red); text-decoration:underline; font-weight:600;">Quitar</a>`
            : '';

          return `
            <div class="pt-dia-bloque" style="${blockIdx > 0 ? 'margin-top:0.6rem; padding-top:0.6rem; border-top:1px dashed var(--border);' : ''}">
              <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between; margin-bottom:0.25rem;">
                <span style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Actividad #${blockIdx + 1}</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  ${deleteBtnHtml}
                  <select id="pt-tipo-dia-${dayIdx}-${blockIdx}" class="form-select" onchange="window.onTipoDiaChange(${dayIdx}, ${blockIdx})" style="font-size:0.75rem; padding:0.2rem 0.4rem; width:125px; height:28px;">
                    <option value="Servicio">Servicio</option>
                    <option value="Levantamiento">Levantamiento</option>
                    <option value="Capacitación">Capacitación</option>
                    <option value="Traslado">Traslado</option>
                    <option value="Junta">Junta</option>
                    <option value="Vacaciones">Vacaciones</option>
                    <option value="Descanso">Descanso</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div id="pt-horas-dia-container-${dayIdx}-${blockIdx}" style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                <div style="display:flex; align-items:center; gap:0.25rem; flex:1;">
                  <span style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">Entrada:</span>
                  <input type="time" id="pt-entrada-dia-${dayIdx}-${blockIdx}" class="form-control" onchange="actualizarTecnicosDisponibles()" style="font-size:0.75rem; padding:0.15rem 0.3rem; height:26px; width:100%;">
                </div>
                <div style="display:flex; align-items:center; gap:0.25rem; flex:1;">
                  <span style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">Salida:</span>
                  <input type="time" id="pt-salida-dia-${dayIdx}-${blockIdx}" class="form-control" onchange="actualizarTecnicosDisponibles()" style="font-size:0.75rem; padding:0.15rem 0.3rem; height:26px; width:100%;">
                </div>
              </div>

              <a href="#" id="pt-traslado-dia-link-${dayIdx}-${blockIdx}" onclick="window.toggleTrasladoDia(${dayIdx}, ${blockIdx}); return false;" style="font-size:0.7rem; color:var(--accent); text-decoration:underline; display:none; margin-top:0.1rem; align-self:flex-start;">+ Traslado (Opcional)</a>

              <div id="pt-traslado-dia-container-${dayIdx}-${blockIdx}" style="display:none; margin-top:0.25rem; border-top:1px dashed var(--border); padding-top:0.25rem; flex-direction:column; gap:0.25rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem; align-items:center;">
                  <span style="font-size:0.68rem; font-weight:600; color:var(--text-secondary);">Ida Hora:</span>
                  <span style="font-size:0.68rem; font-weight:600; color:var(--text-secondary);">Ida Hrs:</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
                  <input type="time" id="pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}" class="form-control" style="font-size:0.75rem; padding:0.15rem; height:24px; width:100%;">
                  <input type="number" id="pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}" step="0.5" min="0" placeholder="Ej. 1.5" class="form-control" style="font-size:0.75rem; padding:0.15rem; height:24px; width:100%;">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem; align-items:center; margin-top:0.15rem;">
                  <span style="font-size:0.68rem; font-weight:600; color:var(--text-secondary);">Regreso Hora:</span>
                  <span style="font-size:0.68rem; font-weight:600; color:var(--text-secondary);">Regreso Hrs:</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
                  <input type="time" id="pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}" class="form-control" style="font-size:0.75rem; padding:0.15rem; height:24px; width:100%;">
                  <input type="number" id="pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}" step="0.5" min="0" placeholder="Ej. 1.5" class="form-control" style="font-size:0.75rem; padding:0.15rem; height:24px; width:100%;">
                </div>
              </div>

              <div id="pt-orden-dia-${dayIdx}-${blockIdx}-container" style="position:relative; width:100%; margin-top: 0.25rem;">
                <input type="hidden" id="pt-orden-dia-${dayIdx}-${blockIdx}" value="">
                <div class="combo-box" tabindex="0" id="pt-orden-dia-${dayIdx}-${blockIdx}-combo" onclick="toggleCombo('pt-orden-dia-${dayIdx}-${blockIdx}')" style="font-size:0.75rem; padding:0.25rem 0.5rem; display:flex; justify-content:space-between; align-items:center; height:28px;">
                  <span id="pt-orden-dia-${dayIdx}-${blockIdx}-display" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 15px);">Selecciona una orden...</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="combo-menu" id="pt-orden-dia-${dayIdx}-${blockIdx}-menu" style="left:0; right:0; width:auto; max-height:220px;">
                  <div class="combo-search" style="padding:0.25rem 0.4rem;">
                    <input type="text" id="pt-orden-dia-${dayIdx}-${blockIdx}-search" placeholder="Buscar..." oninput="filterCombo('pt-orden-dia-${dayIdx}-${blockIdx}', this.value)" onclick="event.stopPropagation()" style="font-size:0.75rem; padding:0.15rem 0.3rem;">
                  </div>
                  <div class="combo-options" id="pt-orden-dia-${dayIdx}-${blockIdx}-options" style="max-height:160px; padding:0.15rem;">
                    ${dayOptionsHtml}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div style="display:flex; flex-direction:column; gap:0.4rem; background:rgba(255,255,255,0.01); border:1px solid var(--border); padding:0.6rem; border-radius:var(--radius-sm);">
            <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-bottom:0.25rem;">
              <span style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${dateStr}</span>
              <a href="#" onclick="window.agregarActividadSemanal(${dayIdx}); return false;" style="font-size:0.72rem; color:var(--accent); font-weight:600; text-decoration:none;">+ Añadir Actividad</a>
            </div>
            ${blocksHtml}
          </div>
        `;
      }).join('');

      // Restaurar valores e inicializar visibilidades
      activeDays.forEach(dayIdx => {
        const blocks = weeklyBlocks[dayIdx] || [];
        blocks.forEach((block, blockIdx) => {
          const selTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`);
          if (selTipo) {
            if (block.tipo) {
              selTipo.value = block.tipo;
            } else {
              selTipo.value = mainTipo;
            }
          }

          const selEntrada = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`);
          if (selEntrada) {
            if (block.entrada) {
              selEntrada.value = block.entrada;
            } else if (mainEntrada) {
              selEntrada.value = mainEntrada;
            }
          }

          const selSalida = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`);
          if (selSalida) {
            if (block.salida) {
              selSalida.value = block.salida;
            } else if (mainSalida) {
              selSalida.value = mainSalida;
            }
          }

          const selIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}`);
          if (selIdaHora && block.idaHora !== undefined) selIdaHora.value = block.idaHora;
          const selIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}`);
          if (selIdaHoras && block.idaHoras !== undefined) selIdaHoras.value = block.idaHoras;
          const selRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}`);
          if (selRegresoHora && block.regresoHora !== undefined) selRegresoHora.value = block.regresoHora;
          const selRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}`);
          if (selRegresoHoras && block.regresoHoras !== undefined) selRegresoHoras.value = block.regresoHoras;

          const container = document.getElementById(`pt-traslado-dia-container-${dayIdx}-${blockIdx}`);
          if (container && block.trasladoOpen) {
            container.style.display = 'flex';
          }

          let targetId = '';
          if (block.ordenId && openOrds.some(o => o.id === block.ordenId)) {
            targetId = block.ordenId;
          } else if (mainOrdenId) {
            targetId = mainOrdenId;
          }

          if (targetId) {
            const matchingOrd = openOrds.find(o => o.id === targetId);
            if (matchingOrd) {
              const displayStr = `[${matchingOrd.folio || 'S/N'}] ${matchingOrd.cliente} - ${matchingOrd.tipo}`;
              const hiddenVal = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}`);
              if (hiddenVal) hiddenVal.value = targetId;
              const display = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}-display`);
              if (display) display.textContent = displayStr;
            }
          }

          // Trigger type change to toggle layout visibility (link and order dropdown)
          if (typeof window !== 'undefined' && typeof window.onTipoDiaChange === 'function') {
            window.onTipoDiaChange(dayIdx, blockIdx);
          } else {
            onTipoDiaChange(dayIdx, blockIdx);
          }
        });
      });

    } else {
      detailsContainer.style.display = 'none';
      listWrapper.style.display = 'none';
      detailsList.innerHTML = '';

      const mainOrderGroup = document.getElementById('pt-grupo-orden-principal');
      if (mainOrderGroup) mainOrderGroup.style.display = 'block';

      const mainTypeGroup = document.getElementById('pt-grupo-tipo-principal');
      if (mainTypeGroup) mainTypeGroup.style.display = 'block';

      const mainHoursGroup = document.getElementById('pt-grupo-horario-principal');
      if (mainHoursGroup) mainHoursGroup.style.display = 'grid';
    }
  }
}

// ===== ACCIONES DEL CALENDARIO SEMANAL =====
function toggleDiaSemanaModal(dayIdx) {
  const cb = document.getElementById(`pt-rep-${dayIdx}`);
  if (cb) {
    cb.checked = !cb.checked;
  }
  const inputFecha = document.getElementById('pt-fecha');
  const baseFechaStr = inputFecha ? inputFecha.value : '';
  renderCalendarioSemanalModal(baseFechaStr);
  actualizarTecnicosDisponibles();
}

function agregarActividadSemanal(dayIdx) {
  const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
  const activeDays = [0, 1, 2, 3, 4, 5, 6].filter(idx => document.getElementById(`pt-rep-${idx}`)?.checked);
  activeDays.forEach(idx => {
    const blocks = weeklyBlocks[idx] || [];
    blocks.forEach((block, blockIdx) => {
      const sel = document.getElementById(`pt-orden-dia-${idx}-${blockIdx}`);
      if (sel) block.ordenId = sel.value;
      const selTipo = document.getElementById(`pt-tipo-dia-${idx}-${blockIdx}`);
      if (selTipo) block.tipo = selTipo.value;
      const selEntrada = document.getElementById(`pt-entrada-dia-${idx}-${blockIdx}`);
      if (selEntrada) block.entrada = selEntrada.value;
      const selSalida = document.getElementById(`pt-salida-dia-${idx}-${blockIdx}`);
      if (selSalida) block.salida = selSalida.value;

      const selIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${idx}-${blockIdx}`);
      if (selIdaHora) block.idaHora = selIdaHora.value;
      const selIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${idx}-${blockIdx}`);
      if (selIdaHoras) block.idaHoras = selIdaHoras.value;
      const selRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${idx}-${blockIdx}`);
      if (selRegresoHora) block.regresoHora = selRegresoHora.value;
      const selRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${idx}-${blockIdx}`);
      if (selRegresoHoras) block.regresoHoras = selRegresoHoras.value;

      const container = document.getElementById(`pt-traslado-dia-container-${idx}-${blockIdx}`);
      if (container) block.trasladoOpen = (container.style.display !== 'none');
    });
  });

  if (!weeklyBlocks[dayIdx]) {
    weeklyBlocks[dayIdx] = [];
  }
  const nextSeq = weeklyBlocks[dayIdx].length;
  weeklyBlocks[dayIdx].push({
    id: `${dayIdx}-${nextSeq}`,
    tipo: 'Servicio',
    ordenId: '',
    entrada: document.getElementById('pt-entrada')?.value || '',
    salida: document.getElementById('pt-salida')?.value || '',
    idaHora: '',
    idaHoras: '',
    regresoHora: '',
    regresoHoras: '',
    trasladoOpen: false
  });

  const baseFechaStr = document.getElementById('pt-fecha').value;
  renderCalendarioSemanalModal(baseFechaStr);
  actualizarTecnicosDisponibles();
}

function quitarActividadSemanal(dayIdx, blockIdx) {
  const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
  const activeDays = [0, 1, 2, 3, 4, 5, 6].filter(idx => document.getElementById(`pt-rep-${idx}`)?.checked);
  activeDays.forEach(idx => {
    const blocks = weeklyBlocks[idx] || [];
    blocks.forEach((block, bIdx) => {
      const sel = document.getElementById(`pt-orden-dia-${idx}-${bIdx}`);
      if (sel) block.ordenId = sel.value;
      const selTipo = document.getElementById(`pt-tipo-dia-${idx}-${bIdx}`);
      if (selTipo) block.tipo = selTipo.value;
      const selEntrada = document.getElementById(`pt-entrada-dia-${idx}-${bIdx}`);
      if (selEntrada) block.entrada = selEntrada.value;
      const selSalida = document.getElementById(`pt-salida-dia-${idx}-${bIdx}`);
      if (selSalida) block.salida = selSalida.value;

      const selIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${idx}-${bIdx}`);
      if (selIdaHora) block.idaHora = selIdaHora.value;
      const selIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${idx}-${bIdx}`);
      if (selIdaHoras) block.idaHoras = selIdaHoras.value;
      const selRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${idx}-${blockIdx}`);
      if (selRegresoHora) block.regresoHora = selRegresoHora.value;
      const selRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${idx}-${blockIdx}`);
      if (selRegresoHoras) block.regresoHoras = selRegresoHoras.value;

      const container = document.getElementById(`pt-traslado-dia-container-${idx}-${bIdx}`);
      if (container) block.trasladoOpen = (container.style.display !== 'none');
    });
  });

  if (weeklyBlocks[dayIdx] && weeklyBlocks[dayIdx].length > blockIdx) {
    weeklyBlocks[dayIdx].splice(blockIdx, 1);
  }

  const baseFechaStr = document.getElementById('pt-fecha').value;
  renderCalendarioSemanalModal(baseFechaStr);
  actualizarTecnicosDisponibles();
}

function onOrdenDiaChange(dayIdx) {
  // Placeholder en caso de validaciones adicionales
}

function toggleTrasladoDia(dayIdx, blockIdx) {
  const container = document.getElementById(`pt-traslado-dia-container-${dayIdx}-${blockIdx}`);
  if (container) {
    const isHidden = (container.style.display === 'none');
    container.style.display = isHidden ? 'flex' : 'none';
  }
}

function toggleMainTraslado() {
  const container = document.getElementById('pt-main-traslado-container');
  if (container) {
    const isHidden = (container.style.display === 'none');
    container.style.display = isHidden ? 'flex' : 'none';
  }
}

function onTipoDiaChange(dayIdx, blockIdx) {
  const selTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`);
  if (selTipo) {
    const valTipo = selTipo.value;
    const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(valTipo);
    const orderContainer = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}-container`);
    if (orderContainer) {
      orderContainer.style.display = sinOrden ? 'none' : 'block';
    }

    const isFullDay = ['Vacaciones', 'Descanso'].includes(valTipo);
    const hoursContainer = document.getElementById(`pt-horas-dia-container-${dayIdx}-${blockIdx}`);
    if (hoursContainer) {
      hoursContainer.style.display = isFullDay ? 'none' : 'flex';
    }
    if (isFullDay) {
      const elEnt = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`);
      if (elEnt) elEnt.value = '';
      const elSal = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`);
      if (elSal) elSal.value = '';
      const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
      if (weeklyBlocks && weeklyBlocks[dayIdx] && weeklyBlocks[dayIdx][blockIdx]) {
        weeklyBlocks[dayIdx][blockIdx].entrada = '';
        weeklyBlocks[dayIdx][blockIdx].salida = '';
      }
    }

    const isClientType = ['Servicio', 'Levantamiento', 'Capacitación'].includes(valTipo);
    const trasladoLink = document.getElementById(`pt-traslado-dia-link-${dayIdx}-${blockIdx}`);
    if (trasladoLink) {
      trasladoLink.style.display = isClientType ? 'inline-block' : 'none';
    }
    if (!isClientType) {
      const trasladoContainer = document.getElementById(`pt-traslado-dia-container-${dayIdx}-${blockIdx}`);
      if (trasladoContainer) {
        trasladoContainer.style.display = 'none';
      }
      const elIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}`);
      if (elIdaHora) elIdaHora.value = '';
      const elIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}`);
      if (elIdaHoras) elIdaHoras.value = '';
      const elRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}`);
      if (elRegresoHora) elRegresoHora.value = '';
      const elRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}`);
      if (elRegresoHoras) elRegresoHoras.value = '';
    }
  }
}

function onTipoPrincipalChange() {
  const mainTipoInput = document.getElementById('pt-tipo');
  const mainTipo = mainTipoInput ? mainTipoInput.value || 'Servicio' : 'Servicio';
  const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
  const mismaOrden = mismaOrdenCb ? mismaOrdenCb.checked : true;

  const mainOrderGroup = document.getElementById('pt-grupo-orden-principal');
  if (mainOrderGroup) {
    const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(mainTipo);
    mainOrderGroup.style.display = (mismaOrden && !sinOrden) ? 'block' : 'none';
  }

  const mainHoursGroup = document.getElementById('pt-grupo-horario-principal');
  const isFullDay = ['Vacaciones', 'Descanso'].includes(mainTipo);
  if (mainHoursGroup) {
    mainHoursGroup.style.display = (mismaOrden && !isFullDay) ? 'grid' : 'none';
  }
  if (isFullDay) {
    const mainEnt = document.getElementById('pt-entrada');
    if (mainEnt) mainEnt.value = '';
    const mainSal = document.getElementById('pt-salida');
    if (mainSal) mainSal.value = '';
  }

  const isClientType = ['Servicio', 'Levantamiento', 'Capacitación'].includes(mainTipo);
  const mainTrasladoLink = document.getElementById('pt-main-traslado-link');
  if (mainTrasladoLink) {
    mainTrasladoLink.style.display = (mismaOrden && isClientType) ? 'inline-block' : 'none';
  }
  if (!isClientType || !mismaOrden) {
    const mainTrasladoContainer = document.getElementById('pt-main-traslado-container');
    if (mainTrasladoContainer) mainTrasladoContainer.style.display = 'none';
    const mainIdaHora = document.getElementById('pt-main-traslado-ida-hora');
    if (mainIdaHora) mainIdaHora.value = '';
    const mainIdaHoras = document.getElementById('pt-main-traslado-ida-horas');
    if (mainIdaHoras) mainIdaHoras.value = '';
    const mainRegresoHora = document.getElementById('pt-main-traslado-regreso-hora');
    if (mainRegresoHora) mainRegresoHora.value = '';
    const mainRegresoHoras = document.getElementById('pt-main-traslado-regreso-horas');
    if (mainRegresoHoras) mainRegresoHoras.value = '';
  }

  const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
  for (let i = 0; i <= 6; i++) {
    const blocks = weeklyBlocks[i] || [];
    blocks.forEach((block, blockIdx) => {
      block.tipo = mainTipo;
      const selTipo = document.getElementById(`pt-tipo-dia-${i}-${blockIdx}`);
      if (selTipo) {
        selTipo.value = mainTipo;
        if (typeof window !== 'undefined' && typeof window.onTipoDiaChange === 'function') {
          window.onTipoDiaChange(i, blockIdx);
        } else {
          onTipoDiaChange(i, blockIdx);
        }
      }
    });
  }
}

function toggleMismaOrden() {
  const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
  const mismaOrden = mismaOrdenCb ? mismaOrdenCb.checked : true;
  const listWrapper = document.getElementById('pt-detalles-dias-list-wrapper');
  if (listWrapper) {
    listWrapper.style.display = mismaOrden ? 'none' : 'flex';
  }

  const mainTipoInput = document.getElementById('pt-tipo');
  const mainTipo = mainTipoInput ? mainTipoInput.value || 'Servicio' : 'Servicio';
  const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(mainTipo);

  const mainOrderGroup = document.getElementById('pt-grupo-orden-principal');
  if (mainOrderGroup) {
    mainOrderGroup.style.display = (mismaOrden && !sinOrden) ? 'block' : 'none';
  }
  const mainTypeGroup = document.getElementById('pt-grupo-tipo-principal');
  if (mainTypeGroup) {
    mainTypeGroup.style.display = mismaOrden ? 'block' : 'none';
  }
  const mainHoursGroup = document.getElementById('pt-grupo-horario-principal');
  const isFullDay = ['Vacaciones', 'Descanso'].includes(mainTipo);
  if (mainHoursGroup) {
    mainHoursGroup.style.display = (mismaOrden && !isFullDay) ? 'grid' : 'none';
  }

  const isClientType = ['Servicio', 'Levantamiento', 'Capacitación'].includes(mainTipo);
  const mainTrasladoLink = document.getElementById('pt-main-traslado-link');
  if (mainTrasladoLink) {
    mainTrasladoLink.style.display = (mismaOrden && isClientType) ? 'inline-block' : 'none';
  }
  if (!mismaOrden || !isClientType) {
    const mainTrasladoContainer = document.getElementById('pt-main-traslado-container');
    if (mainTrasladoContainer) mainTrasladoContainer.style.display = 'none';
    const mainIdaHora = document.getElementById('pt-main-traslado-ida-hora');
    if (mainIdaHora) mainIdaHora.value = '';
    const mainIdaHoras = document.getElementById('pt-main-traslado-ida-horas');
    if (mainIdaHoras) mainIdaHoras.value = '';
    const mainRegresoHora = document.getElementById('pt-main-traslado-regreso-hora');
    if (mainRegresoHora) mainRegresoHora.value = '';
    const mainRegresoHoras = document.getElementById('pt-main-traslado-regreso-horas');
    if (mainRegresoHoras) mainRegresoHoras.value = '';
  }

  actualizarTecnicosDisponibles();
}

function navegarSemana(weeksOffset) {
  const inputFecha = document.getElementById('pt-fecha');
  const baseFechaStr = inputFecha ? inputFecha.value : '';
  if (!baseFechaStr) return;
  const [year, month, day] = baseFechaStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);
  baseDate.setDate(baseDate.getDate() + (weeksOffset * 7));

  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getDate()).padStart(2, '0');
  const newDateStr = `${y}-${m}-${d}`;

  for (let i = 0; i <= 6; i++) {
    const cb = document.getElementById(`pt-rep-${i}`);
    if (cb) cb.checked = (i === 1);
  }

  renderCalendarioSemanalModal(newDateStr);
  actualizarTecnicosDisponibles();
}

function seleccionarDiasSemana(opcion) {
  const inputFecha = document.getElementById('pt-fecha');
  const fechaVal = inputFecha ? inputFecha.value : '';
  if (!fechaVal && opcion !== 'ninguno') {
    _notify("Selecciona una fecha de programación primero para definir la semana.", "warning");
    return;
  }

  for (let i = 0; i <= 6; i++) {
    const cb = document.getElementById(`pt-rep-${i}`);
    if (cb) {
      if (opcion === 'todos') {
        cb.checked = (i >= 1 && i <= 5);
      } else if (opcion === 'todos-sab') {
        cb.checked = (i >= 1 && i <= 6);
      } else if (opcion === 'ninguno') {
        const dayIndex = obtenerDiaDeSemanaLocal(fechaVal);
        cb.checked = (i === dayIndex);
      }
    }
  }
  renderCalendarioSemanalModal(fechaVal);
  actualizarTecnicosDisponibles();
}

// ===== PROGRAMACIÓN DE TÉCNICOS DESDE CALENDARIO =====
function abrirProgramarTecnico() {
  if (typeof window !== 'undefined') window.weeklyDayBlocks = null;
  const todayStr = _getLocalDate();
  const todayDayIdx = obtenerDiaDeSemanaLocal(todayStr);

  for (let i = 0; i <= 6; i++) {
    const cb = document.getElementById(`pt-rep-${i}`);
    if (cb) cb.checked = (i === todayDayIdx);
  }

  renderCalendarioSemanalModal(todayStr);

  const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
  if (mismaOrdenCb) mismaOrdenCb.checked = true;
  toggleMismaOrden();

  const entInput = document.getElementById('pt-entrada');
  if (entInput) entInput.value = '';
  const salInput = document.getElementById('pt-salida');
  if (salInput) salInput.value = '';
  const tipoInput = document.getElementById('pt-tipo');
  if (tipoInput) tipoInput.value = 'Servicio';

  const mainTrasladoContainer = document.getElementById('pt-main-traslado-container');
  if (mainTrasladoContainer) mainTrasladoContainer.style.display = 'none';
  const mainIdaHora = document.getElementById('pt-main-traslado-ida-hora');
  if (mainIdaHora) mainIdaHora.value = '';
  const mainIdaHoras = document.getElementById('pt-main-traslado-ida-horas');
  if (mainIdaHoras) mainIdaHoras.value = '';
  const mainRegresoHora = document.getElementById('pt-main-traslado-regreso-hora');
  if (mainRegresoHora) mainRegresoHora.value = '';
  const mainRegresoHoras = document.getElementById('pt-main-traslado-regreso-horas');
  if (mainRegresoHoras) mainRegresoHoras.value = '';

  actualizarTecnicosDisponibles();

  const ptOrdenOptions = document.getElementById('pt-orden-options');
  const openOrds = _getFilteredOrds().filter(o => o.estado !== 'Finalizado');

  if (ptOrdenOptions) {
    if (openOrds.length === 0) {
      ptOrdenOptions.innerHTML = '<div class="combo-option" style="color:var(--text-muted)">No hay órdenes abiertas</div>';
    } else {
      ptOrdenOptions.innerHTML = openOrds.map(o => {
        const displayStr = `[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}`.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const htmlStr = `[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}`.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="combo-option" onclick="selectComboOption('pt-orden', '${o.id}', '${displayStr}')">${htmlStr}</div>`;
      }).join('');
    }
  }

  const ordDisplay = document.getElementById('pt-orden-display');
  if (ordDisplay) ordDisplay.textContent = 'Selecciona una orden...';
  const ordVal = document.getElementById('pt-orden');
  if (ordVal) ordVal.value = '';

  const modal = document.getElementById('modal-programar-tecnico-overlay');
  if (modal) modal.classList.add('open');
}

function calcularLlegadaTraslados() {
  const formatTime = (totalMin) => {
    let h = Math.floor(totalMin / 60) % 24;
    if (h < 0) h += 24;
    const m = Math.floor(totalMin % 60);
    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Ida
  const elHoraInicio = document.getElementById('pt-hora-inicio');
  if (!elHoraInicio) return;
  const horasTrasladoInput = document.getElementById('pt-horas-traslado');
  const horasTraslado = horasTrasladoInput ? parseFloat(horasTrasladoInput.value) : NaN;
  const refIda = document.getElementById('pt-ref-llegada-ida');
  const horaEntradaServicio = document.getElementById('pt-entrada')?.value || '';

  const horaInicioFinal = elHoraInicio.value;
  const fechaInicioTraslado = document.getElementById('pt-fecha-inicio-traslado')?.value || '';
  const fechaServicio = document.getElementById('pt-fecha')?.value || '';

  let isIdaInvalid = false;
  let isRegresoInvalid = false;

  if (refIda) {
    let html = '';
    if (horaEntradaServicio && fechaServicio && (fechaInicioTraslado || horaInicioFinal)) {
      const dEntrada = new Date(`${fechaServicio}T${horaEntradaServicio}`);
      const dInicioTraslado = new Date(`${fechaInicioTraslado || fechaServicio}T${horaInicioFinal || '00:00'}`);

      if (dInicioTraslado > dEntrada) {
        html = `<span style="color:var(--red);"><i data-lucide="alert-triangle" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> El traslado inicia después del servicio</span>`;
        isIdaInvalid = true;

        if (typeof window !== 'undefined' && !window._idaAlertaPop) {
          window._idaAlertaPop = true;
          _notify("Error: El traslado de ida no puede iniciar después de que comience el servicio.", "error");
          setTimeout(() => { window._idaAlertaPop = false; }, 3000);
        }
      }
    }

    if (!isIdaInvalid && horaInicioFinal && !isNaN(horasTraslado)) {
      const min = horaAMinutos(horaInicioFinal) + (horasTraslado * 60);

      if (horaEntradaServicio && fechaServicio) {
        const dEntrada = new Date(`${fechaServicio}T${horaEntradaServicio}`);
        const dLlegada = new Date(`${fechaInicioTraslado || fechaServicio}T00:00`);
        dLlegada.setMinutes(dLlegada.getMinutes() + min);

        if (dLlegada > dEntrada) {
          html = `<span style="color:var(--red);"><i data-lucide="alert-triangle" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> Llega a las ${formatTime(min)} (Después de la entrada)</span>`;
          isIdaInvalid = true;
        } else {
          html = `<span style="color:var(--green);"><i data-lucide="check-circle" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> Llega a tiempo: <strong>${formatTime(min)}</strong></span>`;
        }
      } else {
        html = `<i data-lucide="clock" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> Llegada estimada: <strong>${formatTime(min)}</strong>`;
      }
    }

    refIda.innerHTML = html;
    if (typeof window !== 'undefined' && window.lucide && refIda.parentElement) {
      window.lucide.createIcons({root: refIda.parentElement});
    }
  }

  // Regreso
  const elHoraFinRegreso = document.getElementById('pt-hora-fin-regreso');
  if (!elHoraFinRegreso) return;
  const horaSalidaServicio = document.getElementById('pt-salida')?.value || '';
  const horasRegresoInput = document.getElementById('pt-horas-regreso');
  const horasRegreso = horasRegresoInput ? parseFloat(horasRegresoInput.value) : NaN;
  const refRegreso = document.getElementById('pt-ref-llegada-regreso');

  const horaFinRegresoFinal = elHoraFinRegreso.value;
  const fechaFinRegresoDate = document.getElementById('pt-fecha-fin-regreso-date')?.value || '';

  if (refRegreso) {
    let html = '';
    if (horaSalidaServicio && fechaServicio && (fechaFinRegresoDate || horaFinRegresoFinal)) {
      const dSalida = new Date(`${fechaServicio}T${horaSalidaServicio}`);
      const dInicioRegreso = new Date(`${fechaFinRegresoDate || fechaServicio}T${horaFinRegresoFinal || '23:59'}`);

      if (dInicioRegreso < dSalida) {
        html = `<span style="color:var(--red);"><i data-lucide="alert-triangle" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> Inicia antes de terminar el servicio</span>`;
        isRegresoInvalid = true;

        if (typeof window !== 'undefined' && !window._regresoAlertaPop) {
          window._regresoAlertaPop = true;
          _notify("Error: El traslado de regreso no puede iniciar antes de terminar el servicio.", "error");
          setTimeout(() => { window._regresoAlertaPop = false; }, 3000);
        }
      }
    }

    if (!isRegresoInvalid && horaFinRegresoFinal && !isNaN(horasRegreso)) {
      const min = horaAMinutos(horaFinRegresoFinal) + (horasRegreso * 60);
      html = `<span style="color:var(--text-muted);"><i data-lucide="clock" style="width:10px; height:10px; margin-right:2px; vertical-align:middle;"></i> Llegada estimada: <strong>${formatTime(min)}</strong></span>`;
    }

    refRegreso.innerHTML = html;
    if (typeof window !== 'undefined' && window.lucide && refRegreso.parentElement) {
      window.lucide.createIcons({root: refRegreso.parentElement});
    }
  }

  const btnProgramar = document.getElementById('btn-guardar-programacion');
  if (btnProgramar) {
    if (isIdaInvalid || isRegresoInvalid) {
      btnProgramar.disabled = true;
      btnProgramar.style.opacity = '0.5';
      btnProgramar.style.cursor = 'not-allowed';
    } else {
      btnProgramar.disabled = false;
      btnProgramar.style.opacity = '1';
      btnProgramar.style.cursor = 'pointer';
    }
  }
}

function actualizarTecnicosDisponibles() {
  const inputFecha = document.getElementById('pt-fecha');
  const fecha = inputFecha ? inputFecha.value : '';
  const entrada = document.getElementById('pt-entrada')?.value || '';
  const salida = document.getElementById('pt-salida')?.value || '';
  const selectTec = document.getElementById('pt-tecnico');
  if (!selectTec) return;

  if (!fecha) {
    selectTec.innerHTML = '<option value="">Selecciona una fecha primero...</option>';
    selectTec.disabled = true;
    return;
  }

  const selectedDays = [];
  for (let i = 0; i <= 6; i++) {
    const cb = document.getElementById(`pt-rep-${i}`);
    if (cb && cb.checked) {
      selectedDays.push(i);
    }
  }

  let fechasAValidar = [];
  if (selectedDays.length > 0) {
    fechasAValidar = selectedDays.map(dayIndex => calcularFechaParaDiaDeSemana(fecha, dayIndex));
  } else {
    fechasAValidar = [fecha];
  }

  const tecnicosConTraslape = new Set();
  const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
  const mismaOrden = mismaOrdenCb ? mismaOrdenCb.checked : true;
  const localEventos = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]') : [];
  const ordenesList = _getOrdenes();
  const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};

  fechasAValidar.forEach(f => {
    const dayIdx = obtenerDiaDeSemanaLocal(f);
    const schedulesToValidate = [];

    if (mismaOrden) {
      schedulesToValidate.push({
        entrada: entrada || null,
        salida: salida || null
      });
    } else {
      const blocks = weeklyBlocks[dayIdx] || [];
      blocks.forEach((block, blockIdx) => {
        const blockEntrada = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`)?.value || '';
        const blockSalida = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`)?.value || '';
        schedulesToValidate.push({
          entrada: blockEntrada || null,
          salida: blockSalida || null
        });
      });
    }

    schedulesToValidate.forEach(sched => {
      const ent = sched.entrada;
      const sal = sched.salida;

      // 1. Validar contra bitácora de órdenes
      ordenesList.forEach(o => {
        if (o.bitacora && o.bitacora.length > 0) {
          o.bitacora.forEach(b => {
            if (b.fecha && b.fecha.startsWith(f) && b.tecnico) {
              const hasExistingTimes = b.entrada && b.salida;
              if (ent && sal) {
                if (hasExistingTimes) {
                  if (hayTraslapoHorario(ent, sal, b.entrada, b.salida)) {
                    tecnicosConTraslape.add(b.tecnico);
                  }
                } else {
                  tecnicosConTraslape.add(b.tecnico);
                }
              } else {
                if (!hasExistingTimes) {
                  tecnicosConTraslape.add(b.tecnico);
                }
              }
            }
          });
        }
      });

      // 2. Validar contra eventos administrativos sin ordenId
      localEventos.forEach(ev => {
        if (!ev.ordenId && ev.tecnicoNombre && ev.start) {
          const evStartDate = new Date(ev.start);
          const evY = evStartDate.getFullYear();
          const evM = String(evStartDate.getMonth() + 1).padStart(2, '0');
          const evD = String(evStartDate.getDate()).padStart(2, '0');
          const evFecha = `${evY}-${evM}-${evD}`;

          if (evFecha === f) {
            const evEntrada = String(evStartDate.getHours()).padStart(2, '0') + ':' + String(evStartDate.getMinutes()).padStart(2, '0');
            const evEndDate = ev.end ? new Date(ev.end) : null;
            const isTodoElDia = ev.todoElDia || ev.allDay || !evEndDate;

            if (ent && sal) {
              if (!isTodoElDia && evEndDate) {
                const evSalida = String(evEndDate.getHours()).padStart(2, '0') + ':' + String(evEndDate.getMinutes()).padStart(2, '0');
                if (hayTraslapoHorario(ent, sal, evEntrada, evSalida)) {
                  tecnicosConTraslape.add(ev.tecnicoNombre);
                }
              } else {
                tecnicosConTraslape.add(ev.tecnicoNombre);
              }
            } else {
              if (isTodoElDia) {
                tecnicosConTraslape.add(ev.tecnicoNombre);
              }
            }
          }
        }
      });
    });
  });

  const userList = _getUsuarios();
  const disponibles = userList.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && !tecnicosConTraslape.has(u.nombre) && u.activo !== false && (_isTestMode() || !_isTestUser(u)));

  if (disponibles.length === 0) {
    selectTec.innerHTML = '<option value="">Sin técnicos disponibles en ese horario/días</option>';
    selectTec.disabled = true;
  } else {
    const currentVal = selectTec.value;
    selectTec.innerHTML = '<option value="">Selecciona un técnico disponible...</option>' + disponibles.map(u => `<option value="${u.nombre}">${u.nombre}</option>`).join('');
    if (currentVal && disponibles.some(d => d.nombre === currentVal)) {
      selectTec.value = currentVal;
    }
    selectTec.disabled = false;
  }
}

async function guardarProgramacionTecnico() {
  const inputFecha = document.getElementById('pt-fecha');
  const fecha = inputFecha ? inputFecha.value : '';
  const selectTec = document.getElementById('pt-tecnico');
  const tecnico = selectTec ? selectTec.value : '';
  const inputOrden = document.getElementById('pt-orden');
  const ordenId = inputOrden ? inputOrden.value : '';
  const entrada = document.getElementById('pt-entrada')?.value || '';
  const salida = document.getElementById('pt-salida')?.value || '';
  const mismaOrdenCb = document.getElementById('pt-usar-misma-orden');
  const mismaOrden = mismaOrdenCb ? mismaOrdenCb.checked : true;

  const mainTipoInput = document.getElementById('pt-tipo');
  const mainTipoVal = mainTipoInput ? mainTipoInput.value || 'Servicio' : 'Servicio';
  const isClientTypeVal = ['Servicio', 'Levantamiento', 'Capacitación'].includes(mainTipoVal);

  const horaInicio = (mismaOrden && isClientTypeVal) ? (document.getElementById('pt-main-traslado-ida-hora')?.value || '') : '';
  const horasTraslado = (mismaOrden && isClientTypeVal) ? (document.getElementById('pt-main-traslado-ida-horas')?.value || '') : '';
  const horaFinRegreso = (mismaOrden && isClientTypeVal) ? (document.getElementById('pt-main-traslado-regreso-hora')?.value || '') : '';
  const horasRegreso = (mismaOrden && isClientTypeVal) ? (document.getElementById('pt-main-traslado-regreso-horas')?.value || '') : '';

  if (!fecha || !tecnico) {
    alert("Por favor completa los campos requeridos (Fecha, Técnico).");
    return;
  }

  const selectedDays = [];
  for (let i = 0; i <= 6; i++) {
    const cb = document.getElementById(`pt-rep-${i}`);
    if (cb && cb.checked) {
      selectedDays.push(i);
    }
  }

  if (mismaOrden) {
    const mainTipo = mainTipoVal;
    const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(mainTipo);
    if (!sinOrden && !ordenId) {
      alert("Por favor selecciona la orden de servicio principal.");
      return;
    }
    const isFullDay = ['Vacaciones', 'Descanso'].includes(mainTipo);
    if (!isFullDay && (!entrada || !salida)) {
      alert("Por favor completa las horas de entrada y salida.");
      return;
    }
  } else {
    if (selectedDays.length === 0) {
      alert("Por favor selecciona al menos un día de la semana.");
      return;
    }
    const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
    for (const dayIdx of selectedDays) {
      const blocks = weeklyBlocks[dayIdx] || [];
      if (blocks.length === 0) {
        alert("Cada día activo debe tener al menos una actividad.");
        return;
      }
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const valTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`)?.value || 'Servicio';
        const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(valTipo);
        if (!sinOrden) {
          const valDia = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}`)?.value;
          if (!valDia) {
            alert(`Por favor selecciona una orden para la actividad #${blockIdx + 1} del día.`);
            return;
          }
        }
        const isFullDay = ['Vacaciones', 'Descanso'].includes(valTipo);
        const entVal = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`)?.value;
        const salVal = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`)?.value;
        if (!isFullDay && (!entVal || !salVal)) {
          alert(`Por favor completa las horas de entrada y salida para la actividad #${blockIdx + 1} del día.`);
          return;
        }
      }
    }
  }

  let fehasAGuardar = [];
  if (selectedDays.length > 0) {
    fehasAGuardar = selectedDays.map(dayIndex => calcularFechaParaDiaDeSemana(fecha, dayIndex));
  } else {
    fehasAGuardar = [fecha];
  }

  // Validaciones de tiempo para cada día
  for (const f of fehasAGuardar) {
    const dayIdx = obtenerDiaDeSemanaLocal(f);

    if (mismaOrden) {
      const mainTipo = mainTipoVal;
      const isFullDay = ['Vacaciones', 'Descanso'].includes(mainTipo);
      if (isFullDay) continue;

      let specificEntrada = entrada;
      let specificSalida = salida;

      let fInicioTraslado = null;
      let hInicio = null;
      let hTraslado = null;
      let fFinRegreso = null;
      let hFinRegreso = null;
      let hRegreso = null;

      if (horaInicio || horasTraslado) {
        fInicioTraslado = f;
        hInicio = horaInicio || null;
        hTraslado = horasTraslado ? parseFloat(horasTraslado) : null;
      }
      if (horaFinRegreso || horasRegreso) {
        fFinRegreso = f;
        hFinRegreso = horaFinRegreso || null;
        hRegreso = horasRegreso ? parseFloat(horasRegreso) : null;
      }

      if (fInicioTraslado || hInicio || hTraslado) {
        const dEntrada = new Date(`${f}T${specificEntrada || '23:59'}`);
        const dInicioTraslado = new Date(`${fInicioTraslado || f}T${hInicio || '00:00'}`);
        if (dInicioTraslado > dEntrada) {
          _notify(`El inicio del traslado de ida no puede ser después de que comience el servicio (${f}).`, "error");
          return;
        }
        if (hInicio && hTraslado && specificEntrada) {
          const minLlegada = horaAMinutos(hInicio) + (hTraslado * 60);
          const dLlegada = new Date(`${fInicioTraslado || f}T00:00`);
          dLlegada.setMinutes(dLlegada.getMinutes() + minLlegada);
          if (dEntrada < dLlegada) {
            _notify(`No se puede empezar el servicio antes de la llegada estimada del traslado de ida (${f}).`, "error");
            return;
          }
        }
      }
      if (fFinRegreso || hFinRegreso || hRegreso) {
        const dSalida = new Date(`${f}T${specificSalida || '00:00'}`);
        const dInicioRegreso = new Date(`${fFinRegreso || f}T${hFinRegreso || '23:59'}`);
        if (dInicioRegreso < dSalida) {
          _notify(`No se puede iniciar el traslado de regreso antes de terminar el servicio (${f}).`, "error");
          return;
        }
      }
    } else {
      const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
      const blocks = weeklyBlocks[dayIdx] || [];
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const specificTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`)?.value || 'Servicio';
        const specificEntrada = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`)?.value;
        const specificSalida = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`)?.value;

        let fInicioTraslado = null;
        let hInicio = null;
        let hTraslado = null;
        let fFinRegreso = null;
        let hFinRegreso = null;
        let hRegreso = null;

        const isClientType = ['Servicio', 'Levantamiento', 'Capacitación'].includes(specificTipo);
        if (isClientType) {
          const valIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}`)?.value;
          const valIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}`)?.value;
          const valRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}`)?.value;
          const valRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}`)?.value;

          if (valIdaHora || valIdaHoras) {
            fInicioTraslado = f;
            hInicio = valIdaHora || null;
            hTraslado = valIdaHoras ? parseFloat(valIdaHoras) : null;
          }
          if (valRegresoHora || valRegresoHoras) {
            fFinRegreso = f;
            hFinRegreso = valRegresoHora || null;
            hRegreso = valRegresoHoras ? parseFloat(valRegresoHoras) : null;
          }
        }

        if (fInicioTraslado || hInicio || hTraslado) {
          const dEntrada = new Date(`${f}T${specificEntrada || '23:59'}`);
          const dInicioTraslado = new Date(`${fInicioTraslado || f}T${hInicio || '00:00'}`);
          if (dInicioTraslado > dEntrada) {
            _notify(`El inicio del traslado de ida no puede ser después de que comience el servicio (${f}, Actividad #${blockIdx + 1}).`, "error");
            return;
          }
          if (hInicio && hTraslado && specificEntrada) {
            const minLlegada = horaAMinutos(hInicio) + (hTraslado * 60);
            const dLlegada = new Date(`${fInicioTraslado || f}T00:00`);
            dLlegada.setMinutes(dLlegada.getMinutes() + minLlegada);
            if (dEntrada < dLlegada) {
              _notify(`No se puede empezar el servicio antes de la llegada estimada del traslado de ida (${f}, Actividad #${blockIdx + 1}).`, "error");
              return;
            }
          }
        }
        if (fFinRegreso || hFinRegreso || hRegreso) {
          const dSalida = new Date(`${f}T${specificSalida || '00:00'}`);
          const dInicioRegreso = new Date(`${fFinRegreso || f}T${hFinRegreso || '23:59'}`);
          if (dInicioRegreso < dSalida) {
            _notify(`No se puede iniciar el traslado de regreso antes de terminar el servicio (${f}, Actividad #${blockIdx + 1}).`, "error");
            return;
          }
        }
      }
    }
  }

  // Validar traslape de horario consolidado antes de guardar
  const conflictos = [];
  const localEventos = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]') : [];
  const ordenesList = _getOrdenes();
  const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};

  for (const f of fehasAGuardar) {
    const dayIdx = obtenerDiaDeSemanaLocal(f);
    if (mismaOrden) {
      if (entrada && salida) {
        for (const ord of ordenesList) {
          if (!ord.bitacora) continue;
          for (const b of ord.bitacora) {
            if (b.fecha && b.fecha.startsWith(f) && b.tecnico === tecnico && b.entrada && b.salida) {
              if (hayTraslapoHorario(entrada, salida, b.entrada, b.salida)) {
                const folioConflicto = ord.folio || ord.id.slice(0,8);
                const horaConflicto = `${b.entrada} – ${b.salida}`;
                conflictos.push(`${f}: orden ${folioConflicto} (${horaConflicto})`);
              }
            }
          }
        }

        for (const ev of localEventos) {
          if (!ev.ordenId && ev.tecnicoNombre === tecnico && ev.start) {
            const evStartDate = new Date(ev.start);
            const evY = evStartDate.getFullYear();
            const evM = String(evStartDate.getMonth() + 1).padStart(2, '0');
            const evD = String(evStartDate.getDate()).padStart(2, '0');
            const evFecha = `${evY}-${evM}-${evD}`;

            if (evFecha === f) {
              const evEntrada = String(evStartDate.getHours()).padStart(2, '0') + ':' + String(evStartDate.getMinutes()).padStart(2, '0');
              const evEndDate = ev.end ? new Date(ev.end) : null;
              if (evEndDate) {
                const evSalida = String(evEndDate.getHours()).padStart(2, '0') + ':' + String(evEndDate.getMinutes()).padStart(2, '0');
                if (hayTraslapoHorario(entrada, salida, evEntrada, evSalida)) {
                  conflictos.push(`${f}: evento interno "${ev.tipo}" (${evEntrada} – ${evSalida})`);
                }
              }
            }
          }
        }
      }
    } else {
      const blocks = weeklyBlocks[dayIdx] || [];
      for (let i = 0; i < blocks.length; i++) {
        const ent1 = document.getElementById(`pt-entrada-dia-${dayIdx}-${i}`)?.value || '';
        const sal1 = document.getElementById(`pt-salida-dia-${dayIdx}-${i}`)?.value || '';

        if (ent1 && sal1) {
          for (let j = i + 1; j < blocks.length; j++) {
            const ent2 = document.getElementById(`pt-entrada-dia-${dayIdx}-${j}`)?.value || '';
            const sal2 = document.getElementById(`pt-salida-dia-${dayIdx}-${j}`)?.value || '';
            if (ent2 && sal2 && hayTraslapoHorario(ent1, sal1, ent2, sal2)) {
              conflictos.push(`${f}: Conflicto interno entre bloques (${ent1} – ${sal1} y ${ent2} – ${sal2})`);
            }
          }

          for (const ord of ordenesList) {
            if (!ord.bitacora) continue;
            for (const b of ord.bitacora) {
              if (b.fecha && b.fecha.startsWith(f) && b.tecnico === tecnico && b.entrada && b.salida) {
                if (hayTraslapoHorario(ent1, sal1, b.entrada, b.salida)) {
                  const folioConflicto = ord.folio || ord.id.slice(0,8);
                  const horaConflicto = `${b.entrada} – ${b.salida}`;
                  conflictos.push(`${f}: orden ${folioConflicto} (${horaConflicto}) se traslapa con la actividad de ${ent1} – ${sal1}`);
                }
              }
            }
          }

          for (const ev of localEventos) {
            if (!ev.ordenId && ev.tecnicoNombre === tecnico && ev.start) {
              const evStartDate = new Date(ev.start);
              const evY = evStartDate.getFullYear();
              const evM = String(evStartDate.getMonth() + 1).padStart(2, '0');
              const evD = String(evStartDate.getDate()).padStart(2, '0');
              const evFecha = `${evY}-${evM}-${evD}`;

              if (evFecha === f) {
                const evEntrada = String(evStartDate.getHours()).padStart(2, '0') + ':' + String(evStartDate.getMinutes()).padStart(2, '0');
                const evEndDate = ev.end ? new Date(ev.end) : null;
                if (evEndDate) {
                  const evSalida = String(evEndDate.getHours()).padStart(2, '0') + ':' + String(evEndDate.getMinutes()).padStart(2, '0');
                  if (hayTraslapoHorario(ent1, sal1, evEntrada, evSalida)) {
                    conflictos.push(`${f}: evento interno "${ev.tipo}" (${evEntrada} – ${evSalida}) se traslapa con la actividad de ${ent1} – ${sal1}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (conflictos.length > 0) {
    _notify(
      `⚠️ ${tecnico} ya tiene asignación en ese horario en los siguientes días:\n` + conflictos.map(c => `• ${c}`).join('\n'),
      'error'
    );
    return;
  }

  const tipoAsignacion = document.getElementById('pt-tipo') ? document.getElementById('pt-tipo').value : 'Servicio';
  const modifiedOrders = new Set();
  const session = _getSession();

  async function guardarBloqueAsignacion(f, specificTipo, specificOrdenId, specificEntrada, specificSalida, isBaseDate, dayIdx, blockIdx) {
    const sinOrden = ['Junta', 'Vacaciones', 'Descanso'].includes(specificTipo);
    let o = null;
    let nuevaEntradaId = crypto.randomUUID();

    const isSandbox = _isTestMode() || (o && (typeof isTestData === 'function' ? isTestData(o) : false));

    if (!sinOrden) {
      o = ordenesList.find(ord => ord.id === specificOrdenId);
      if (o) {
        if (!o.bitacora) o.bitacora = [];

        let fInicioTraslado = null;
        let hInicio = null;
        let hTraslado = null;
        let fFinRegreso = null;
        let hFinRegreso = null;
        let hRegreso = null;

        const isClientType = ['Servicio', 'Levantamiento', 'Capacitación'].includes(specificTipo);
        if (isClientType) {
          if (blockIdx !== null) {
            const valIdaHora = document.getElementById(`pt-traslado-ida-hora-dia-${dayIdx}-${blockIdx}`)?.value;
            const valIdaHoras = document.getElementById(`pt-traslado-ida-horas-dia-${dayIdx}-${blockIdx}`)?.value;
            const valRegresoHora = document.getElementById(`pt-traslado-regreso-hora-dia-${dayIdx}-${blockIdx}`)?.value;
            const valRegresoHoras = document.getElementById(`pt-traslado-regreso-horas-dia-${dayIdx}-${blockIdx}`)?.value;

            if (valIdaHora || valIdaHoras) {
              fInicioTraslado = f;
              hInicio = valIdaHora || null;
              hTraslado = valIdaHoras ? parseFloat(valIdaHoras) : null;
            }
            if (valRegresoHora || valRegresoHoras) {
              fFinRegreso = f;
              hFinRegreso = valRegresoHora || null;
              hRegreso = valRegresoHoras ? parseFloat(valRegresoHoras) : null;
            }
          } else {
            const valIdaHora = document.getElementById('pt-main-traslado-ida-hora')?.value;
            const valIdaHoras = document.getElementById('pt-main-traslado-ida-horas')?.value;
            const valRegresoHora = document.getElementById('pt-main-traslado-regreso-hora')?.value;
            const valRegresoHoras = document.getElementById('pt-main-traslado-regreso-horas')?.value;

            if (valIdaHora || valIdaHoras) {
              fInicioTraslado = f;
              hInicio = valIdaHora || null;
              hTraslado = valIdaHoras ? parseFloat(valIdaHoras) : null;
            }
            if (valRegresoHora || valRegresoHoras) {
              fFinRegreso = f;
              hFinRegreso = valRegresoHora || null;
              hRegreso = valRegresoHoras ? parseFloat(valRegresoHoras) : null;
            }
          }
        }

        const nuevaEntrada = {
          id: nuevaEntradaId,
          fecha: f,
          tecnico: tecnico,
          tipo: specificTipo,
          nota: isSandbox ? "[PRUEBA] Programado por supervisor. Pendiente de llenado por el técnico." : "Programado por supervisor. Pendiente de llenado por el técnico.",
          entrada: specificEntrada,
          salida: specificSalida,
          fecha_inicio_traslado: fInicioTraslado,
          hora_inicio: hInicio,
          horas_traslado: hTraslado,
          fecha_fin_regreso: fFinRegreso,
          hora_fin_regreso: hFinRegreso,
          horas_regreso: hRegreso,
          realizado: false,
          esPrueba: isSandbox,
          isTest: isSandbox,
          asignadoPorName: _getUserName(),
          asignadoPorId: session.userId || null
        };

        o.bitacora.push(nuevaEntrada);

        if (!o.tecnicosAsignados) o.tecnicosAsignados = [];
        if (!o.tecnicosAsignados.includes(tecnico)) {
          o.tecnicosAsignados.push(tecnico);
        }

        modifiedOrders.add(o);
      }
    }

    try {
      const userList = _getUsuarios();
      const usr = userList.find(u => u.nombre === tecnico);
      const tecnicoId = usr ? usr.id : null;

      const entradaHora = specificEntrada || '08:00';
      const salidaHora = specificSalida || '18:00';

      const inicioISO = `${f}T${entradaHora}:00`;
      const finISO = `${f}T${salidaHora}:00`;

      const isTodoElDiaType = ['Vacaciones', 'Descanso'].includes(specificTipo);
      const startDateTime = isTodoElDiaType ? f : inicioISO;
      const endDateTime = isTodoElDiaType ? f : finISO;

      const effectiveSandbox = isSandbox || (usr && _isTestUser(usr)) || (tecnico && _isTestUser({ nombre: tecnico }));

      const eventoObj = {
        id: nuevaEntradaId,
        titulo: sinOrden ? `${specificTipo}: ${tecnico}` : `${specificTipo}: ${(o && o.cliente) || 'Cliente'}`,
        tipo: specificTipo,
        tecnicoId: tecnicoId,
        tecnicoNombre: tecnico,
        ordenId: sinOrden ? null : (o ? o.id : null),
        fechaInicio: startDateTime,
        start: startDateTime,
        fechaFin: endDateTime,
        end: endDateTime,
        entrada: specificEntrada || '',
        salida: specificSalida || '',
        todoElDia: isTodoElDiaType,
        allDay: isTodoElDiaType,
        descripcion: sinOrden ? (effectiveSandbox ? `[PRUEBA] Evento administrativo: ${specificTipo}` : `Evento administrativo: ${specificTipo}`) : (effectiveSandbox ? "[PRUEBA] Programado por supervisor." : "Programado por supervisor. Pendiente de llenado por el técnico."),
        creadoPor: session.userId || null,
        creadoPorNombre: _getUserName(),
        color: (specificTipo === 'Vacaciones') ? '#f59e0b' : (specificTipo === 'Descanso' ? '#10b981' : '#3b82f6'),
        esPrueba: effectiveSandbox,
        isTest: effectiveSandbox
      };

      const idx = localEventos.findIndex(x => x.id === eventoObj.id);
      if (idx > -1) {
        localEventos[idx] = eventoObj;
      } else {
        localEventos.push(eventoObj);
      }
      if (typeof window !== 'undefined' && window.pushToSupabase) {
        window.pushToSupabase('calendario_eventos', eventoObj);
      }
    } catch(e){}

    if (typeof window !== 'undefined' && window.trackTelemetryEvent) {
      window.trackTelemetryEvent('Creación de Asignación', { tecnico, fecha: f, folio: sinOrden ? 'Sin Orden' : ((o && o.folio) || 'Sin Folio') });
    }
  }

  for (const f of fehasAGuardar) {
    const isBaseDate = (f === fecha);
    const dayIdx = obtenerDiaDeSemanaLocal(f);

    if (mismaOrden) {
      await guardarBloqueAsignacion(f, tipoAsignacion, ordenId, entrada, salida, isBaseDate, dayIdx, null);
    } else {
      const weeklyBlocks = (typeof window !== 'undefined' && window.weeklyDayBlocks) ? window.weeklyDayBlocks : {};
      const blocks = weeklyBlocks[dayIdx] || [];
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const specificTipo = document.getElementById(`pt-tipo-dia-${dayIdx}-${blockIdx}`)?.value || 'Servicio';
        const specificOrdenId = document.getElementById(`pt-orden-dia-${dayIdx}-${blockIdx}`)?.value || '';
        const specificEntrada = document.getElementById(`pt-entrada-dia-${dayIdx}-${blockIdx}`)?.value || '';
        const specificSalida = document.getElementById(`pt-salida-dia-${dayIdx}-${blockIdx}`)?.value || '';

        await guardarBloqueAsignacion(f, specificTipo, specificOrdenId, specificEntrada, specificSalida, isBaseDate, dayIdx, blockIdx);
      }
    }
  }

  // Actualizar técnicos asignados string en cada orden modificada
  for (const o of modifiedOrders) {
    o.tecnico = o.tecnicosAsignados.join(', ');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('sapi_calendario_eventos', JSON.stringify(localEventos));
  }
  _saveJSON('sapi_ordenes', ordenesList);

  if (typeof window !== 'undefined' && window.pushToSupabase) {
    for (const o of modifiedOrders) {
      await window.pushToSupabase('ordenes', o);
    }
  }

  if (typeof window !== 'undefined' && typeof window.ejecutarAutomatizacion === 'function') {
    const ticketsList = _getTickets();
    for (const o of modifiedOrders) {
      const t = ticketsList.find(x => x.id === o.soporte || x.folio === o.soporte);
      const toEmail = t?.contacto || '';
      const ultimaBitacora = (o.bitacora && o.bitacora.length > 0) ? o.bitacora[o.bitacora.length - 1] : null;
      window.ejecutarAutomatizacion('Visita técnica en campo programada', {
        email: toEmail,
        nombre_cliente: o.cliente || t?.cliente || 'Cliente',
        folio_os: o.id || '',
        folio_ticket: t ? t.folio : (o.soporte || ''),
        fecha_programada: ultimaBitacora ? ultimaBitacora.fecha : '',
        fecha_visita: ultimaBitacora ? ultimaBitacora.fecha : '',
        tecnico_asignado: o.tecnico || '',
        tecnico_nombre: o.tecnico || '',
        link: window.location ? (window.location.origin + '/cliente') : '/cliente'
      });
    }
  }

  _notify('Asignación programada con éxito', 'success');
  const modalProg = document.getElementById('modal-programar-tecnico-overlay');
  if (modalProg) modalProg.classList.remove('open');

  if (typeof renderCalendario === 'function') {
    renderCalendario();
  } else if (typeof window !== 'undefined' && typeof window.renderCalendario === 'function') {
    window.renderCalendario();
  }
}

// Bindeo a window para entornos en navegador
if (typeof window !== 'undefined') {
  window.abrirAsignarTecnicos = abrirAsignarTecnicos;
  window.cerrarAsignarTecnicos = cerrarAsignarTecnicos;
  window.guardarAsignacionTecnicos = guardarAsignacionTecnicos;
  window.obtenerDiaDeSemanaLocal = obtenerDiaDeSemanaLocal;
  window.calcularFechaParaDiaDeSemana = calcularFechaParaDiaDeSemana;
  window.horaAMinutos = horaAMinutos;
  window.hayTraslapoHorario = hayTraslapoHorario;
  window.renderCalendarioSemanalModal = renderCalendarioSemanalModal;
  window.toggleDiaSemanaModal = toggleDiaSemanaModal;
  window.agregarActividadSemanal = agregarActividadSemanal;
  window.quitarActividadSemanal = quitarActividadSemanal;
  window.onOrdenDiaChange = onOrdenDiaChange;
  window.toggleTrasladoDia = toggleTrasladoDia;
  window.toggleMainTraslado = toggleMainTraslado;
  window.onTipoDiaChange = onTipoDiaChange;
  window.onTipoPrincipalChange = onTipoPrincipalChange;
  window.toggleMismaOrden = toggleMismaOrden;
  window.navegarSemana = navegarSemana;
  window.seleccionarDiasSemana = seleccionarDiasSemana;
  window.abrirProgramarTecnico = abrirProgramarTecnico;
  window.calcularLlegadaTraslados = calcularLlegadaTraslados;
  window.actualizarTecnicosDisponibles = actualizarTecnicosDisponibles;
  window.guardarProgramacionTecnico = guardarProgramacionTecnico;
}

export {
  abrirAsignarTecnicos,
  cerrarAsignarTecnicos,
  guardarAsignacionTecnicos,
  obtenerDiaDeSemanaLocal,
  calcularFechaParaDiaDeSemana,
  horaAMinutos,
  hayTraslapoHorario,
  renderCalendarioSemanalModal,
  toggleDiaSemanaModal,
  agregarActividadSemanal,
  quitarActividadSemanal,
  onOrdenDiaChange,
  toggleTrasladoDia,
  toggleMainTraslado,
  onTipoDiaChange,
  onTipoPrincipalChange,
  toggleMismaOrden,
  navegarSemana,
  seleccionarDiasSemana,
  abrirProgramarTecnico,
  calcularLlegadaTraslados,
  actualizarTecnicosDisponibles,
  guardarProgramacionTecnico
};
