/**
 * Módulo de Bitácora de Avances y Reportes de Órdenes - Eurorep / SAPI
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

// Calcula el rango de fechas hábiles permitido para la bitácora
function calcularRangoFechasLaboral(diasHabilAtras) {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset()); // ajuste zona horaria local

  const maxDate = new Date(ahora); // El máximo siempre es hoy (incluso en fin de semana)

  // Retroceder N días hábiles para el mínimo
  const minDate = new Date(ahora);
  let retrocedidos = 0;
  while (retrocedidos < diasHabilAtras) {
    minDate.setDate(minDate.getDate() - 1);
    const d = minDate.getDay();
    if (d !== 0 && d !== 6) retrocedidos++; // Solo cuenta lunes-viernes para el límite inferior
  }

  return {
    min: minDate.toISOString().slice(0, 10),
    max: maxDate.toISOString().slice(0, 10),
  };
}

function abrirBitacora(id, defaultNote = '', isOnlyTraslado = false) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === id);
  if (o && !isOnlyTraslado && (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf))) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  window.currentBitacoraOrdenId = id;
  window.currentBitacoraEntryId = null;
  const rango = calcularRangoFechasLaboral(10);

  // Lógica para mostrar/ocultar campos si es solo traslado
  const modalTitle = document.getElementById('modal-bitacora-title');
  const grupoHoras = document.getElementById('grupo-bitacora-horas');
  const grupoTraslados = document.getElementById('grupo-bitacora-traslados');
  const colTrasladoIda = document.getElementById('col-traslado-ida');
  const inputEntrada = document.getElementById('bitacora-entrada');
  const inputSalida = document.getElementById('bitacora-salida');

  if (isOnlyTraslado) {
    if (modalTitle) modalTitle.textContent = 'Registrar Traslado de Regreso';
    
    // Ocultar grupo de traslados numéricos
    if (grupoTraslados) grupoTraslados.style.display = 'none';
    
    // Mostrar grupo de horas y cambiar etiquetas
    if (grupoHoras) grupoHoras.style.display = 'flex';
    const lblEntrada = document.getElementById('lbl-bitacora-entrada');
    const lblSalida = document.getElementById('lbl-bitacora-salida');
    if (lblEntrada) lblEntrada.textContent = 'Hora de Salida *';
    if (lblSalida) lblSalida.textContent = 'Hora de Llegada *';
    
    // Asegurar que sean requeridos
    if (inputEntrada) inputEntrada.setAttribute('required', 'true');
    if (inputSalida) inputSalida.setAttribute('required', 'true');
  } else {
    if (modalTitle) modalTitle.textContent = 'Registrar Avance Diario';
    
    // Mostrar ambos grupos
    if (grupoHoras) grupoHoras.style.display = 'flex';
    if (grupoTraslados) grupoTraslados.style.display = 'flex';
    if (colTrasladoIda) colTrasladoIda.style.display = 'block';
    
    // Restaurar etiquetas originales
    const lblEntrada = document.getElementById('lbl-bitacora-entrada');
    const lblSalida = document.getElementById('lbl-bitacora-salida');
    if (lblEntrada) lblEntrada.textContent = 'Hora de Entrada *';
    if (lblSalida) lblSalida.textContent = 'Hora de Salida *';
    
    // Asegurar que sean requeridos
    if (inputEntrada) inputEntrada.setAttribute('required', 'true');
    if (inputSalida) inputSalida.setAttribute('required', 'true');
  }

  const fechaInput = document.getElementById('bitacora-fecha');
  fechaInput.value = rango.max; // pre-selecciona el último día hábil (hoy o viernes si es fin de semana)
  fechaInput.min = rango.min;
  fechaInput.max = rango.max;

  document.getElementById('bitacora-nota').value = defaultNote || '';
  document.getElementById('bitacora-entrada').value = '';
  document.getElementById('bitacora-salida').value = '';
  document.getElementById('bitacora-horas-traslado').value = '';
  document.getElementById('bitacora-horas-regreso').value = '';
  
  if (defaultNote) {
    const tipoSelect = document.getElementById('bitacora-tipo');
    if (tipoSelect) {
      Array.from(tipoSelect.options).forEach(opt => {
        if (opt.value.toLowerCase().includes('traslado')) opt.selected = true;
      });
    }
  }
  
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function iniciarReporteDesdeAsignacion(ordenId, bitacoraId) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado')) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  const b = o.bitacora?.find(x => x.id === bitacoraId);
  if (!b) return;

  if (currentSession.viewMode === 'tecnico') {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';
    const normStr = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normStr(b.tecnico) !== normStr(miTecnicoNombre)) {
      mostrarNotificacion('Solo puedes reportar tus propias asignaciones programadas.', 'error');
      return;
    }
  }

  window.currentBitacoraOrdenId = ordenId;
  window.currentBitacoraEntryId = bitacoraId;

  // Modificar título del modal para contextualizar
  const modalTitle = document.getElementById('modal-bitacora-title');
  if (modalTitle) modalTitle.textContent = 'Reportar Trabajo de Asignación';

  const fechaInput = document.getElementById('bitacora-fecha');
  if (fechaInput) {
    let dateStr = b.fecha;
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    fechaInput.value = dateStr;
    // Permitir al técnico registrar la fecha programada
    fechaInput.min = '';
    fechaInput.max = '';
  }

  // Pre-rellenar horas de la asignación y limpiar la nota por defecto del supervisor
  document.getElementById('bitacora-nota').value = '';
  document.getElementById('bitacora-entrada').value = b.entrada || '';
  document.getElementById('bitacora-salida').value = b.salida || '';
  document.getElementById('bitacora-horas-traslado').value = b.horas_traslado || '';
  document.getElementById('bitacora-horas-regreso').value = b.horas_regreso || '';
  
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}
window.iniciarReporteDesdeAsignacion = iniciarReporteDesdeAsignacion;

function editarBitacora(ordenId, bitacoraId) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf)) {
    mostrarNotificacion('No se pueden editar avances en una orden cerrada o completada.', 'error');
    return;
  }
  const b = o.bitacora?.find(x => x.id === bitacoraId);
  if (!b) return;

  window.currentBitacoraOrdenId = ordenId;
  window.currentBitacoraEntryId = bitacoraId;

  // Establecer título del modal
  const modalTitle = document.getElementById('modal-bitacora-title');
  if (modalTitle) modalTitle.textContent = 'Editar Entrada de Bitácora';

  const fechaInput = document.getElementById('bitacora-fecha');
  const dObj = new Date(b.fecha);
  const dateStr = !isNaN(dObj) ? dObj.toISOString().split('T')[0] : '';
  fechaInput.value = dateStr;
  
  // Como admin, quitamos las restricciones de fecha para poder editar fechas pasadas
  fechaInput.min = '';
  fechaInput.max = '';

  document.getElementById('bitacora-nota').value = b.nota || '';
  document.getElementById('bitacora-entrada').value = b.entrada || '';
  document.getElementById('bitacora-salida').value = b.salida || '';
  document.getElementById('bitacora-horas-traslado').value = b.horas_traslado || '';
  document.getElementById('bitacora-horas-regreso').value = b.horas_regreso || '';
  document.getElementById('modal-bitacora-overlay').classList.add('open');
}

function cerrarBitacora(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target !== document.getElementById('modal-bitacora-overlay')) return;
  document.getElementById('modal-bitacora-overlay').classList.remove('open');
}

function actualizarEventoCalendarioDesdeBitacora(orden, bitacoraEntry) {
  if (typeof localStorage === 'undefined' || !orden || !bitacoraEntry) return;
  try {
    const localEventos = (typeof safeGetJSON === 'function')
      ? safeGetJSON('sapi_calendario_eventos', [])
      : JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    
    // Buscar si ya existe el evento por ID
    let idx = localEventos.findIndex(x => x.id === bitacoraEntry.id || x.id === `bit-${bitacoraEntry.id}`);
    
    // Si no existe por ID, buscamos si hay algún evento de esta orden en el mismo día y técnico
    if (idx === -1 && bitacoraEntry.fecha) {
      const bitDate = bitacoraEntry.fecha.substring(0, 10);
      idx = localEventos.findIndex(x => 
        x.ordenId === orden.id && 
        (x.start && x.start.substring(0, 10) === bitDate) &&
        (x.tecnicoNombre === bitacoraEntry.tecnico)
      );
    }

    let color = '#ef4444'; // Rojo: Trabajo realizado sin asignación
    if (bitacoraEntry.realizado === false || (bitacoraEntry.nota && bitacoraEntry.nota.includes('Programado por supervisor') && bitacoraEntry.realizado !== true)) {
      color = '#8b5cf6'; // Morado: Asignación programada (Pendiente)
    } else if (bitacoraEntry.realizado === true) {
      if (bitacoraEntry.programadoEntrada) {
        const isAligned = !bitacoraEntry.desviacion || bitacoraEntry.desviacion === 'Alineado' || bitacoraEntry.desviacion === '0m';
        color = isAligned ? '#10b981' : '#3b82f6'; // Verde o Azul
      } else {
        color = '#ef4444'; // Rojo: Trabajo realizado sin asignación
      }
    }

    const entradaHora = bitacoraEntry.entrada || '08:00';
    const salidaHora = bitacoraEntry.salida || '18:00';
    const dateStr = bitacoraEntry.fecha ? bitacoraEntry.fecha.substring(0, 10) : new Date().toISOString().split('T')[0];
    const startISO = `${dateStr}T${entradaHora}:00`;
    
    let endDateStr = dateStr;
    if (bitacoraEntry.salida && bitacoraEntry.entrada && bitacoraEntry.salida < bitacoraEntry.entrada) {
      const dObj = new Date(dateStr + 'T00:00:00');
      dObj.setDate(dObj.getDate() + 1);
      endDateStr = dObj.toISOString().split('T')[0];
    }
    const endISO = `${endDateStr}T${salidaHora}:00`;

    const usr = usuarios.find(u => u.nombre === bitacoraEntry.tecnico);
    const tecnicoId = usr ? usr.id : null;

    const eventTitle = `${(bitacoraEntry.tecnico || 'Téc').split(' ')[0]} | ${orden.cliente}`;

    const eventoObj = {
      id: idx > -1 ? localEventos[idx].id : bitacoraEntry.id,
      titulo: eventTitle,
      start: new Date(startISO).toISOString(),
      end: new Date(endISO).toISOString(),
      tipo: 'Servicio',
      tecnicoId: tecnicoId,
      tecnicoNombre: bitacoraEntry.tecnico,
      ordenId: orden.id,
      descripcion: bitacoraEntry.nota || '',
      color: color,
      todoElDia: false,
      allDay: false
    };

    if (idx > -1) {
      localEventos[idx] = eventoObj;
    } else {
      localEventos.push(eventoObj);
    }

    localStorage.setItem('sapi_calendario_eventos', JSON.stringify(localEventos));
    if (window.pushToSupabase) {
      window.pushToSupabase('calendario_eventos', eventoObj);
    }
  } catch(e) {
    console.error('Error al sincronizar evento en calendario_eventos:', e);
  }
}

function guardarNotaBitacora() {
  if (typeof document === 'undefined') return;
  const puedeLlenar = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
  if (!puedeLlenar) {
    mostrarNotificacion('Solo los técnicos, supervisores y superadmins pueden registrar avances o llenar la bitácora.', 'error');
    return;
  }
  const o = ordenes.find(x => x.id === window.currentBitacoraOrdenId);
  if (!o) return;
  if (o.cierre_papel_pdf) {
    mostrarNotificacion('No se pueden registrar avances en una orden cerrada o completada.', 'error');
    return;
  }
  
  const fecha = document.getElementById('bitacora-fecha').value;
  const nota = document.getElementById('bitacora-nota').value.trim();
  const entrada = document.getElementById('bitacora-entrada').value;
  const salida = document.getElementById('bitacora-salida').value;
  const horasTraslado = document.getElementById('bitacora-horas-traslado').value;
  const horasRegreso = document.getElementById('bitacora-horas-regreso').value;
  
  if (!fecha || !nota || !entrada || !salida) {
    mostrarNotificacion('Todos los campos son obligatorios (fecha, nota, hora de salida y hora de llegada).', 'warning');
    return;
  }

  const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
  const isTraslado = document.getElementById('modal-bitacora-title')?.textContent === 'Registrar Traslado de Regreso';
  let hrsRegCalc = horasRegreso ? parseFloat(horasRegreso) : null;
  if (isTraslado && entrada && salida) {
    const [hE, mE] = entrada.split(':').map(Number);
    const [hS, mS] = salida.split(':').map(Number);
    let diff = (hS * 60 + mS) - (hE * 60 + mE);
    if (diff < 0) diff += 24 * 60;
    hrsRegCalc = parseFloat((diff / 60).toFixed(2));
  }

  if (!isAdmin) {
    if (isTraslado) {
      let lastDateStr = o.firma_cliente_fecha || o.firma_tecnico_fecha;
      if (!lastDateStr) {
        if (o.bitacora && o.bitacora.length > 0) {
          const validEntries = o.bitacora.filter(b => b.id !== window.currentBitacoraEntryId && b.tipo !== 'Aviso del Sistema');
          if (validEntries.length > 0) {
            validEntries.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
            lastDateStr = validEntries[0].fecha;
          }
        }
      }
      if (!lastDateStr) lastDateStr = o.fecha;
      
      if (lastDateStr) {
        const dCierre = new Date(lastDateStr);
        dCierre.setHours(0,0,0,0);
        
        const dSeleccionada = new Date(fecha + 'T00:00:00'); // Tratar la fecha seleccionada en local
        const diffTime = dSeleccionada.getTime() - dCierre.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0 || diffDays > 2) {
          mostrarNotificacion('La fecha del traslado no puede exceder los 2 días después de la firma o el último trabajo reportado.', 'error');
          return;
        }
      }
    } else {
      // Validar que esté dentro del rango hábil permitido (que ahora permite fines de semana si caen en el rango)
      const rango = calcularRangoFechasLaboral(10);
      if (fecha < rango.min || fecha > rango.max) {
        mostrarNotificacion('La fecha seleccionada está fuera del rango permitido.', 'error');
        return;
      }
    }
  }
  
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreTecnico = currentUser ? currentUser.nombre : 'Usuario';
  const tecnicoDestino = window.currentBitacoraEntryId && o.bitacora ? 
      (o.bitacora.find(x => x.id === window.currentBitacoraEntryId)?.tecnico || nombreTecnico) : 
      nombreTecnico;

  // Validación de empalme de horarios (no permitir que el técnico repita horario)
  if (entrada && salida) {
    const doOverlap = (e1, s1, e2, s2) => {
      if (!e1 || !s1 || !e2 || !s2) return false;
      const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      let mE1 = toMin(e1), mS1 = toMin(s1);
      let mE2 = toMin(e2), mS2 = toMin(s2);
      if (mS1 <= mE1) mS1 += 24*60;
      if (mS2 <= mE2) mS2 += 24*60;
      return (mE1 < mS2 && mE2 < mS1);
    };

    let empalme = null;
    for (const ord of ordenes) {
      if (!ord.bitacora) continue;
      for (const bit of ord.bitacora) {
        if (bit.id === window.currentBitacoraEntryId) continue; // Ignorar el mismo registro si estamos editando
        if (bit.tecnico !== tecnicoDestino) continue; // Solo validar registros del mismo técnico
        
        try {
          const bitDateObj = new Date(bit.fecha);
          if (isNaN(bitDateObj)) continue;
          const bitDate = bitDateObj.toISOString().split('T')[0];
          
          if (bitDate === fecha) { // Si están en la misma fecha
            if (doOverlap(entrada, salida, bit.entrada, bit.salida)) {
              empalme = { ordenFolio: ord.folio || ord.id, entrada: bit.entrada, salida: bit.salida };
              break;
            }
          }
        } catch(e){}
      }
      if (empalme) break;
    }

    if (empalme) {
      mostrarNotificacion(`Horario empalmado con otro registro tuyo de ${empalme.entrada} a ${empalme.salida} (Orden: ${empalme.ordenFolio}).`, 'error');
      return;
    }
  }
  
  if (!o.bitacora) o.bitacora = [];

  let esAsignacionPendiente = false;
  if (window.currentBitacoraEntryId) {
    const bIndex = o.bitacora.findIndex(x => x.id === window.currentBitacoraEntryId);
    if (bIndex >= 0) {
      const bObj = o.bitacora[bIndex];
      if (bObj.realizado === false || (bObj.nota && bObj.nota.includes('Programado por supervisor') && bObj.realizado !== true)) {
        esAsignacionPendiente = true;
      }
    }
  }

  if (window.currentBitacoraEntryId && !esAsignacionPendiente) {
    // MODO EDICIÓN REAL (de una bitácora ya reportada previamente)
    const bIndex = o.bitacora.findIndex(x => x.id === window.currentBitacoraEntryId);
    if (bIndex >= 0) {
      o.bitacora[bIndex].fecha = new Date(fecha).toISOString();
      o.bitacora[bIndex].nota = nota;
      o.bitacora[bIndex].entrada = entrada;
      o.bitacora[bIndex].salida = salida;
      o.bitacora[bIndex].horas_traslado = horasTraslado ? parseFloat(horasTraslado) : null;
      o.bitacora[bIndex].horas_regreso = hrsRegCalc !== null ? hrsRegCalc : (horasRegreso ? parseFloat(horasRegreso) : null);
      o.bitacora[bIndex].realizado = true;
      actualizarEventoCalendarioDesdeBitacora(o, o.bitacora[bIndex]);
    }
  } else {
    // MODO CREACIÓN NUEVA (o reporte de asignación pendiente)
    let progEntrada = '';
    let progSalida = '';
    let desviacionStr = null;
    let bObjRef = null;

    if (esAsignacionPendiente) {
      const bObj = o.bitacora.find(x => x.id === window.currentBitacoraEntryId);
      if (bObj) {
        bObjRef = bObj;
        progEntrada = bObj.entrada || '';
        progSalida = bObj.salida || '';
        
        if (progEntrada && progSalida && entrada && salida) {
          const toMin = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          let minReal = toMin(salida) - toMin(entrada);
          if (minReal < 0) minReal += 24 * 60;
          
          let minProg = toMin(progSalida) - toMin(progEntrada);
          if (minProg < 0) minProg += 24 * 60;
          
          const diffMin = minReal - minProg;
          
          if (diffMin === 0) {
            desviacionStr = 'Alineado';
          } else {
            const absMin = Math.abs(diffMin);
            const hrs = Math.floor(absMin / 60);
            const mns = absMin % 60;
            const sign = diffMin > 0 ? '+' : '-';
            desviacionStr = `${sign}${hrs > 0 ? hrs + 'h ' : ''}${mns > 0 ? mns + 'm' : ''}`.trim();
            if (desviacionStr === sign) desviacionStr = 'Alineado'; // fallback
          }
        }
      }
      // Eliminar el pendiente programado original
      o.bitacora = o.bitacora.filter(x => x.id !== window.currentBitacoraEntryId);
    }

    // Insertar reporte de trabajo limpio y realizado
    const nuevaEntrada = {
      id: esAsignacionPendiente ? window.currentBitacoraEntryId : crypto.randomUUID(),
      fecha: new Date(fecha).toISOString(),
      nota: nota,
      entrada: entrada,
      salida: salida,
      tecnico: tecnicoDestino,
      realizado: true,
      programadoEntrada: progEntrada || null,
      programadoSalida: progSalida || null,
      desviacion: desviacionStr || null,
      programadoHorasTraslado: bObjRef ? bObjRef.horas_traslado : null,
      programadoHorasRegreso: bObjRef ? bObjRef.horas_regreso : null,
      fecha_inicio_traslado: bObjRef ? bObjRef.fecha_inicio_traslado : null,
      hora_inicio: bObjRef ? bObjRef.hora_inicio : null,
      fecha_fin_regreso: bObjRef ? bObjRef.fecha_fin_regreso : null,
      hora_fin_regreso: bObjRef ? bObjRef.hora_fin_regreso : null,
      horas_traslado: horasTraslado ? parseFloat(horasTraslado) : (bObjRef ? bObjRef.horas_traslado : null),
      horas_regreso: hrsRegCalc !== null ? hrsRegCalc : (horasRegreso ? parseFloat(horasRegreso) : (bObjRef ? bObjRef.horas_regreso : null)),
      tipo: bObjRef ? bObjRef.tipo : (isTraslado ? 'Traslado' : 'Servicio')
    };
    o.bitacora.push(nuevaEntrada);
    actualizarEventoCalendarioDesdeBitacora(o, nuevaEntrada);
  }
  
  o.estado = calcularEstadoOrden(o);
  
  safeSetJSON('sapi_ordenes', ordenes);
  if (window.pushToSupabase) {
    window.pushToSupabase('ordenes', o);
  }

  if (window.trackTelemetryEvent) {
    const act = window.currentBitacoraEntryId ? 'Edición de Avance (Bitácora)' : 'Registro de Avance (Bitácora)';
    window.trackTelemetryEvent(act, { id: o.id, folio: o.folio, cliente: o.cliente });
  }
  
  mostrarNotificacion(window.currentBitacoraEntryId ? 'Bitácora actualizada.' : 'Entrada de bitácora guardada.', 'success');
  cerrarBitacora();
  verDetalle(o.id); // Recargar modal
  renderTabla();
  renderTabla('servicios');
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
}


  var exports = {
    calcularRangoFechasLaboral: calcularRangoFechasLaboral,
    abrirBitacora: abrirBitacora,
    iniciarReporteDesdeAsignacion: iniciarReporteDesdeAsignacion,
    editarBitacora: editarBitacora,
    cerrarBitacora: cerrarBitacora,
    actualizarEventoCalendarioDesdeBitacora: actualizarEventoCalendarioDesdeBitacora,
    guardarNotaBitacora: guardarNotaBitacora
  };

  if (typeof window !== "undefined") {
    window.calcularRangoFechasLaboral = calcularRangoFechasLaboral;
    window.abrirBitacora = abrirBitacora;
    window.iniciarReporteDesdeAsignacion = iniciarReporteDesdeAsignacion;
    window.editarBitacora = editarBitacora;
    window.cerrarBitacora = cerrarBitacora;
    window.actualizarEventoCalendarioDesdeBitacora = actualizarEventoCalendarioDesdeBitacora;
    window.guardarNotaBitacora = guardarNotaBitacora;
  }

  return exports;
});
