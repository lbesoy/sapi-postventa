// ==========================================
// MÓDULO CALENDARIO FULLCALENDAR Y GESTIÓN DE EVENTOS
// Eurorep / SAPI
// ==========================================

// ─── CALENDARIO ────────────────────────────────────────────────────────────────
let calendarInstance = null;

function actualizarFiltrosCalendario() {
  const selCli = document.getElementById('filter-cal-cliente');
  const selTec = document.getElementById('filter-cal-tecnico');
  if (!selCli || !selTec) return;

  const currentCli = selCli.value;
  const currentTec = selTec.value;

  const isEmpresa = currentSession.viewMode === 'empresa';
  const isTecnico = currentSession.viewMode === 'tecnico';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const miEmpresa = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
  const miTecnicoNombre = isTecnico ? (currentSession.nombre || (currentUser ? currentUser.nombre : '')) : null;

  if (isTecnico) {
    selTec.style.display = 'none';
    const htmlTec = `<option value="${miTecnicoNombre}">${miTecnicoNombre}</option>`;
    if (selTec.innerHTML !== htmlTec) {
      selTec.innerHTML = htmlTec;
      selTec.value = miTecnicoNombre;
    }
  } else {
    selTec.style.display = '';
  }

  let clientesDisponibles = ordenes;
  if (isEmpresa) clientesDisponibles = clientesDisponibles.filter(o => o.cliente === miEmpresa);
  if (isTecnico && miTecnicoNombre) {
    clientesDisponibles = clientesDisponibles.filter(o => {
      const tieneBitacora = o.bitacora && o.bitacora.some(b => b.tecnico === miTecnicoNombre);
      const estaAsignado = o.tecnicosAsignados && o.tecnicosAsignados.includes(miTecnicoNombre);
      return tieneBitacora || estaAsignado;
    });
  }

  const clientesUnicos = [...new Set(clientesDisponibles.map(o => o.cliente).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  let htmlCli = '<option value="">Todos los Clientes</option>';
  clientesUnicos.forEach(c => htmlCli += `<option value="${c}">${c}</option>`);
  
  if (selCli.innerHTML !== htmlCli) {
    selCli.innerHTML = htmlCli;
    selCli.value = currentCli;
    if (!selCli.value && currentCli) selCli.value = ''; 
  }

  if (!isTecnico) {
    const tecnicosUnicos = new Set();
    clientesDisponibles.forEach(o => {
      if (o.tecnico) o.tecnico.split(',').forEach(t => tecnicosUnicos.add(t.trim()));
      if (o.tecnicosAsignados) o.tecnicosAsignados.forEach(t => tecnicosUnicos.add(t));
      if (o.bitacora) o.bitacora.forEach(b => { if(b.tecnico) tecnicosUnicos.add(b.tecnico) });
    });
    
    const tArr = [...tecnicosUnicos].filter(Boolean).sort((a,b) => a.localeCompare(b));
    let htmlTec = '<option value="">Todos los Técnicos</option>';
    tArr.forEach(t => htmlTec += `<option value="${t}">${t}</option>`);
    
    if (selTec.innerHTML !== htmlTec) {
      selTec.innerHTML = htmlTec;
      selTec.value = currentTec;
      if (!selTec.value && currentTec) selTec.value = ''; 
    }
  }
}

function getNthDayOfMonth(year, month, dayOfWeek, n) {
  const date = new Date(year, month, 1);
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    date.setDate(d);
    if (date.getMonth() !== month) break;
    if (date.getDay() === dayOfWeek) {
      count++;
      if (count === n) {
        const m = String(month + 1).padStart(2, '0');
        const day = String(d).padStart(2, '0');
        return `${year}-${m}-${day}`;
      }
    }
  }
  return null;
}

function getSemanaSanta(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month - 1, day);
  
  const jueves = new Date(easter);
  jueves.setDate(easter.getDate() - 3);
  
  const viernes = new Date(easter);
  viernes.setDate(easter.getDate() - 2);
  
  const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  return { jueves: format(jueves), viernes: format(viernes) };
}

function getFestivosMexico(year) {
  const ss = getSemanaSanta(year);
  const festivos = [
    { title: 'Año Nuevo', start: `${year}-01-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'party-popper' } },
    { title: 'Día de la Constitución', start: getNthDayOfMonth(year, 1, 1, 1), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'scroll' } },
    { title: 'Natalicio B. Juárez', start: getNthDayOfMonth(year, 2, 1, 3), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'user' } },
    { title: 'Jueves Santo', start: ss.jueves, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Viernes Santo', start: ss.viernes, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Día del Trabajo', start: `${year}-05-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'hard-hat' } },
    { title: 'Independencia', start: `${year}-09-16`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'flag' } },
    { title: 'Revolución Mex.', start: getNthDayOfMonth(year, 10, 1, 3), allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'swords' } },
    { title: 'Virgen de Guadalupe', start: `${year}-12-12`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'calendar-off' } },
    { title: 'Navidad', start: `${year}-12-25`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'gift' } }
  ];
  if (year === 2024 || year === 2030 || year === 2036) {
    festivos.push({ title: 'Transmisión de Poder', start: `${year}-10-01`, allDay: true, backgroundColor: '#f3f4f6', borderColor: '#d1d5db', textColor: '#4b5563', extendedProps: { isFestivo: true, icon: 'landmark' } });
  }
  return festivos;
}

function renderCalendario() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  if (typeof FullCalendar === 'undefined') {
    console.error("FullCalendar no está cargado.");
    return;
  }

  let prevView = null;
  let prevDate = null;
  if (calendarInstance) {
    try {
      prevView = calendarInstance.view?.type;
      prevDate = calendarInstance.getDate();
    } catch (e) {
      console.warn('Could not get calendar view/date:', e);
    }
    calendarInstance.destroy();
  }

  actualizarFiltrosCalendario();

  const filtroCliente = document.getElementById('filter-cal-cliente')?.value || '';
  let filtroTecnico = document.getElementById('filter-cal-tecnico')?.value || '';

  const isEmpresa = currentSession.viewMode === 'empresa';
  const isTecnico = currentSession.viewMode === 'tecnico';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const miEmpresa = currentUser ? (currentUser.empresa || currentUser.nombre) : null;
  const miTecnicoNombre = isTecnico ? (currentSession.nombre || (currentUser ? currentUser.nombre : '')) : null;

  if (isTecnico && miTecnicoNombre) {
    if (isTestModeActive()) {
      filtroTecnico = '';
    } else {
      filtroTecnico = miTecnicoNombre;
    }
  }

  const eventos = [];
  const pushedTraslados = new Set();
  const pushedBitacoras = new Set();

  const currentYear = new Date().getFullYear();
  eventos.push(...getFestivosMexico(currentYear - 1));
  eventos.push(...getFestivosMexico(currentYear));
  eventos.push(...getFestivosMexico(currentYear + 1));
  
  getFilteredOrders().filter(o => {
    if (isEmpresa && o.cliente !== miEmpresa) return false;
    if (filtroCliente && o.cliente !== filtroCliente) return false;
    return true;
  }).forEach(o => {
    let bgColor = '#3b82f6'; // Azul
    if (o.tipo === 'Mantenimiento' || o.tipo === 'Servicio preventivo') bgColor = '#10b981'; // Verde
    if (o.tipo === 'Reparación' || o.tipo === 'Inspección') bgColor = '#f59e0b'; // Naranja
    if (o.tipo === 'Garantía') bgColor = '#ef4444'; // Rojo
    if (o.tipo === 'Entrega y puesta en marcha') bgColor = '#8b5cf6'; // Morado
    if (o.tipo === 'Pre-entrega') bgColor = '#06b6d4'; // Cyan
    if (o.tipo === 'Entrega Refacciones') bgColor = '#ec4899'; // Rosa
    if (o.estado === 'Finalizado' || o.estado === 'Cerrada') bgColor = '#6b7280'; // Gris

    if (o.bitacora && o.bitacora.length > 0) {
      o.bitacora.forEach(b => {
        if (!b) return;
        if (filtroTecnico && b.tecnico !== filtroTecnico) return;

        let dateStr = b.fecha;
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
        
        const notaClean = (b.nota || '').trim();
        const notaLower = notaClean.toLowerCase();
        const hasRealContent = Boolean(
          (b.firma_tecnico_url && b.firma_tecnico_url !== '__DELETED__') ||
          (b.firma_tecnico_base64 && b.firma_tecnico_base64 !== '__DELETED__') ||
          (b.firma_cliente_url && b.firma_cliente_url !== '__DELETED__') ||
          (b.firma_cliente_base64 && b.firma_cliente_base64 !== '__DELETED__') ||
          (b.fotos && b.fotos.length > 0) ||
          (b.evidencias && Object.keys(b.evidencias).length > 0) ||
          b.cierre_papel_pdf
        );

        const esAsignacionPendiente = !hasRealContent || b.realizado === false || (notaLower.includes('programado') || notaLower.includes('pendiente de llenado'));

        let eventColor = '#ef4444'; // Rojo: Trabajo realizado sin asignación por defecto

        if (esAsignacionPendiente) {
          eventColor = '#8b5cf6'; // Morado: Asignación programada (Pendiente)
        } else {
          if (b.programadoEntrada) {
            const isAligned = !b.desviacion || b.desviacion === 'Alineado' || b.desviacion === '0m';
            if (isAligned) {
              eventColor = '#10b981'; // Verde: Asignación completada al 100%
            } else {
              eventColor = '#3b82f6'; // Azul: Asignación completada pero con horas distintas
            }
          } else {
            eventColor = '#ef4444'; // Rojo: Trabajo realizado sin asignación
          }
        }

        const isTrasladoEvent = b.tipo === 'Traslado' || (b.nota && b.nota.toLowerCase().includes('traslado'));
        if (isTrasladoEvent && b.realizado) {
          eventColor = '#475569'; // Gris pizarron (Slate) para traslados realizados
        }

        let isAllDay = true;
        let startVal = dateStr;
        let endVal = null;
        let endDateStr = dateStr;

        if (b.entrada && b.salida) {
          isAllDay = false;
          startVal = `${dateStr}T${b.entrada}:00`;
          
          if (b.salida < b.entrada) {
            const dObj = new Date(dateStr + 'T00:00:00');
            dObj.setDate(dObj.getDate() + 1);
            endDateStr = dObj.toISOString().split('T')[0];
          }
          endVal = `${endDateStr}T${b.salida}:00`;
        } else if (b.entrada) {
          isAllDay = false;
          startVal = `${dateStr}T${b.entrada}:00`;
        }

        let maqSuffix = '';
        if (o.modelo) {
          maqSuffix = ` | ${o.modelo}`;
          if (o.eco || o.maquinaria_id) {
            const idVal = o.eco || o.maquinaria_id;
            if (idVal && idVal.length < 15) {
              maqSuffix += ` (${idVal})`;
            }
          }
        } else if (o.equipo) {
          const eqClean = o.equipo.split(']')[1] || o.equipo;
          maqSuffix = ` | ${eqClean.split('(SN')[0].trim()}`;
        }

        const tipoPrefix = isTrasladoEvent ? (b.nota && b.nota.toLowerCase().includes('regreso') ? '🚗 Regreso - ' : '🚗 Ida - ') : (b.tipo && b.tipo !== 'Servicio' ? `${b.tipo.substring(0,3)} | ` : '');
        const ev = {
          id: `bit-${b.id || Math.random()}`,
          title: `${tipoPrefix}${(b.tecnico || 'Téc').split(' ')[0]} | ${o.cliente}${maqSuffix}`,
          start: startVal,
          allDay: isAllDay,
          backgroundColor: eventColor,
          borderColor: eventColor,
          extendedProps: {
            isBitacora: true,
            ordenId: o.id,
            tecnico: b.tecnico || 'Desconocido',
            cliente: o.cliente,
            ubicacion: o.ubicacion || 'Sin ubicación',
            equipo: o.equipo || o.modelo || 'N/A',
            nota: b.nota,
            entrada: b.entrada,
            salida: b.salida,
            creadoPorNombre: b.asignadoPorName || 'Supervisor'
          }
        };

        if (endVal) ev.end = endVal;

        const toLocalISO = (d) => {
          if (!d || isNaN(d.getTime())) return null;
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        };

        // Renderizar bloque de traslado de ida si existe duración (1 por técnico por día por orden)
        if (b.horas_traslado && parseFloat(b.horas_traslado) > 0 && !isTrasladoEvent) {
          try {
            let idaDateStr = b.fecha_inicio_traslado || dateStr;
            if (idaDateStr.includes('T')) idaDateStr = idaDateStr.split('T')[0];
            const keyIda = `ida_${o.id}_${b.tecnico || ''}_${idaDateStr}`;
            if (!pushedTraslados.has(keyIda)) {
              let startLlegada;
              let endLlegada;
              if (b.hora_inicio) {
                const hInicioClean = b.hora_inicio.split(':').slice(0,2).join(':');
                startLlegada = new Date(`${idaDateStr}T${hInicioClean}:00`);
                if (!isNaN(startLlegada.getTime())) {
                  endLlegada = new Date(startLlegada.getTime() + Math.round(parseFloat(b.horas_traslado) * 60 * 60000));
                }
              } else if (b.entrada) {
                endLlegada = new Date(`${idaDateStr}T${b.entrada}:00`);
                if (!isNaN(endLlegada.getTime())) {
                  startLlegada = new Date(endLlegada.getTime() - Math.round(parseFloat(b.horas_traslado) * 60 * 60000));
                }
              }

              if (startLlegada && endLlegada && !isNaN(startLlegada.getTime())) {
                pushedTraslados.add(keyIda);
                eventos.push({
                  id: `bit-traslado-ida-${b.id || Math.random()}`,
                  title: `🚗 Ida - ${(b.tecnico || 'Téc').split(' ')[0]} | ${o.folio || o.id.substring(0,8)}`,
                  start: toLocalISO(startLlegada),
                  end: toLocalISO(endLlegada),
                  allDay: false,
                  backgroundColor: (function() {
                    if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                    if (b.programadoHorasTraslado !== undefined && b.programadoHorasTraslado !== null) {
                      return parseFloat(b.horas_traslado) === parseFloat(b.programadoHorasTraslado) ? '#10b981' : '#3b82f6';
                    }
                    return '#ef4444';
                  })(),
                  borderColor: (function() {
                    if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                    if (b.programadoHorasTraslado !== undefined && b.programadoHorasTraslado !== null) {
                      return parseFloat(b.horas_traslado) === parseFloat(b.programadoHorasTraslado) ? '#10b981' : '#3b82f6';
                    }
                    return '#ef4444';
                  })(),
                  textColor: '#ffffff',
                  extendedProps: {
                    isBitacora: true,
                    isTraslado: true,
                    tipoTraslado: 'Ida',
                    duracion: b.horas_traslado,
                    ordenId: o.id,
                    tecnico: b.tecnico,
                    cliente: o.cliente,
                    ubicacion: o.ubicacion || 'Sin ubicación',
                    equipo: o.equipo || o.modelo || 'N/A'
                  }
                });
              }
            }
          } catch(e) { console.error('Error en traslado ida:', e); }
        }

        // Renderizar bloque de traslado de regreso si existe duración (1 por técnico por día por orden)
        if (b.horas_regreso && parseFloat(b.horas_regreso) > 0 && !isTrasladoEvent) {
          try {
            let regresoDateStr = b.fecha_fin_regreso || dateStr;
            if (regresoDateStr.includes('T')) regresoDateStr = regresoDateStr.split('T')[0];
            const keyRegreso = `regreso_${o.id}_${b.tecnico || ''}_${regresoDateStr}`;
            if (!pushedTraslados.has(keyRegreso)) {
              let startRegreso;
              let endRegreso;
              if (b.hora_fin_regreso) {
                const hRegresoClean = b.hora_fin_regreso.split(':').slice(0,2).join(':');
                startRegreso = new Date(`${regresoDateStr}T${hRegresoClean}:00`);
                if (!isNaN(startRegreso.getTime())) {
                  endRegreso = new Date(startRegreso.getTime() + Math.round(parseFloat(b.horas_regreso) * 60 * 60000));
                }
              } else if (b.salida) {
                startRegreso = new Date(`${regresoDateStr}T${b.salida}:00`);
                if (!isNaN(startRegreso.getTime())) {
                  endRegreso = new Date(startRegreso.getTime() + Math.round(parseFloat(b.horas_regreso) * 60 * 60000));
                }
              }

              if (startRegreso && endRegreso && !isNaN(startRegreso.getTime())) {
                pushedTraslados.add(keyRegreso);
                eventos.push({
                  id: `bit-traslado-regreso-${b.id || Math.random()}`,
                  title: `🚗 Regreso - ${(b.tecnico || 'Téc').split(' ')[0]} | ${o.folio || o.id.substring(0,8)}`,
                  start: toLocalISO(startRegreso),
                  end: toLocalISO(endRegreso),
                  allDay: false,
                  backgroundColor: (function() {
                    if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                    if (b.programadoHorasRegreso !== undefined && b.programadoHorasRegreso !== null) {
                      return parseFloat(b.horas_regreso) === parseFloat(b.programadoHorasRegreso) ? '#10b981' : '#3b82f6';
                    }
                    return '#ef4444';
                  })(),
                  borderColor: (function() {
                    if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                    if (b.programadoHorasRegreso !== undefined && b.programadoHorasRegreso !== null) {
                      return parseFloat(b.horas_regreso) === parseFloat(b.programadoHorasRegreso) ? '#10b981' : '#3b82f6';
                    }
                    return '#ef4444';
                  })(),
                  textColor: '#ffffff',
                  extendedProps: {
                    isBitacora: true,
                    isTraslado: true,
                    tipoTraslado: 'Regreso',
                    duracion: b.horas_regreso,
                    ordenId: o.id,
                    tecnico: b.tecnico,
                    cliente: o.cliente,
                    ubicacion: o.ubicacion || 'Sin ubicación',
                    equipo: o.equipo || o.modelo || 'N/A'
                  }
                });
              }
            }
          } catch(e) { console.error('Error en traslado regreso:', e); }
        }

        const cleanNota = (b.nota || '').trim();
        const keyBit = `bit_${o.id}_${(b.tecnico || '').trim().toLowerCase()}_${startVal}_${endVal || 'allday'}_${cleanNota}`;
        if (!pushedBitacoras.has(keyBit)) {
          pushedBitacoras.add(keyBit);
          eventos.push(ev);
        }
      });
    }
  });

  // Inject Levantamientos into calendar
  if (typeof levantamientos !== 'undefined' && Array.isArray(levantamientos)) {
    const activeSandbox = typeof isTestModeActive === 'function' ? isTestModeActive() : false;
    levantamientos.forEach(lev => {
      // Filtrar según el modo Sandbox activo
      if (typeof isTestData === 'function' && isTestData(lev) !== activeSandbox) return;
      
      // Filtrar por técnico si hay un filtro activo (y si está asignado)
      const asignadoVal = lev.tecnico_asignado || lev.asignado_a || null;
      if (filtroTecnico && asignadoVal !== filtroTecnico) return;
      
      // Filtrar por empresa si el usuario es empresa
      if (isEmpresa && lev.cliente !== miEmpresa) return;

      if (lev.fecha_esperada) {
        eventos.push({
          id: `lev-${lev.id}`,
          title: `📋 Levantamiento | ${lev.cliente} | ${asignadoVal ? asignadoVal.split(' ')[0] : 'Sin Asignar'}`,
          start: lev.fecha_esperada,
          allDay: true,
          backgroundColor: '#d946ef', // Fuchsia (distinct color for Levantamientos)
          borderColor: '#d946ef',
          textColor: '#ffffff',
          extendedProps: {
            isLevantamiento: true,
            levantamientoId: lev.id,
            cliente: lev.cliente,
            descripcion: lev.descripcion,
            asignado_a: asignadoVal || 'Sin Asignar',
            estado: lev.estado
          }
        });
      }
    });
  }

  // Inyectar eventos administrativos personalizados (Fase 9)
  try {
    const adminEvents = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
    adminEvents.forEach(e => {
      // Si tiene ordenId, solo omitir si este mismo evento ya fue renderizado previamente desde la bitácora de la orden
      if (e.ordenId) {
        const yaRenderizado = eventos.some(ev => 
          ev.id === e.id || 
          ev.id === `bit-${e.id}` || 
          ev.extendedProps?.id === e.id
        );
        if (yaRenderizado) return;
      }

      // Filtrar por técnico si hay filtro activo
      if (filtroTecnico) {
        const u = usuarios.find(usr => usr.nombre === filtroTecnico || usr.id === filtroTecnico);
        const uId = u ? u.id : filtroTecnico;
        if (e.tecnicoId !== uId && e.tecnicoNombre !== filtroTecnico) return;
      }

      let eventColor = '#3b82f6'; // Azul por defecto
      if (e.tipo === 'Junta' || e.tipo === 'Capacitación') eventColor = '#8b5cf6'; // Morado: Asignación Programada
      else if (e.tipo === 'Vacaciones') eventColor = '#f59e0b'; // Naranja: Vacaciones
      else if (e.tipo === 'Descanso') eventColor = '#10b981'; // Verde: Descanso (Completado/Tiempo libre)
      else if (e.tipo === 'Levantamiento') eventColor = '#ec4899'; // Rosa: Levantamiento
      else if (e.tipo === 'Servicio') eventColor = '#eab308'; // Amarillo: Servicio
      else eventColor = '#3b82f6'; // Azul: Trabajo/Actividad sin asignación

      const isAllDay = Boolean(e.todoElDia || e.allDay);
      let startVal = e.fechaInicio || e.start || '';
      let endVal = e.fechaFin || e.end || null;
      if (isAllDay && startVal) {
        startVal = startVal.substring(0, 10);
        if (endVal) endVal = endVal.substring(0, 10);
      }

      const tecPrefix = e.tecnicoNombre ? `${e.tecnicoNombre.split(' ')[0]} | ` : '';
      eventos.push({
        id: e.id,
        title: `${tecPrefix}${e.tipo} | ${e.titulo || ''}`,
        start: startVal,
        end: endVal,
        allDay: isAllDay,
        backgroundColor: eventColor,
        borderColor: eventColor,
        textColor: '#ffffff',
        extendedProps: {
          isAdminEvent: true,
          id: e.id,
          titulo: e.titulo,
          descripcion: e.descripcion,
          tipo: e.tipo,
          tecnicoId: e.tecnicoId,
          tecnicoNombre: e.tecnicoNombre,
          tecnico: e.tecnicoNombre || 'Sin asignar',
          creadoPor: e.creadoPor,
          ordenId: e.ordenId,
          entrada: e.entrada || '',
          salida: e.salida || '',
          color: e.color
        }
      });
    });
  } catch (err) {
    console.error('Error loading admin events for calendar:', err);
  }

  // Inyectar eventos de prueba si es el "Técnico de Pruebas"
  if (isTecnico && miTecnicoNombre === 'Técnico de Pruebas') {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    
    const ord1 = getFilteredOrders()[0] || { id: 'test-ord-1', cliente: 'Cliente Prueba S.A.', ubicacion: 'Av. Principal 123, CDMX' };
    const ord2 = getFilteredOrders()[1] || { id: 'test-ord-2', cliente: 'Industrias Eurorep', ubicacion: 'Bodega 4, Querétaro' };
    
    const diaHoy = String(hoy.getDate()).padStart(2, '0');
    eventos.push({
      id: 'test-event-1',
      title: `Téc | ${ord1.cliente}`,
      start: `${y}-${m}-${diaHoy}T09:00:00`,
      end: `${y}-${m}-${diaHoy}T12:00:00`,
      allDay: false,
      backgroundColor: '#10b981',
      borderColor: '#10b981',
      extendedProps: {
        isBitacora: true,
        ordenId: ord1.id,
        tecnico: 'Técnico de Pruebas',
        cliente: ord1.cliente,
        ubicacion: ord1.ubicacion || 'Sin ubicación',
        nota: 'Servicio de mantenimiento preventivo de prueba.',
        entrada: '09:00',
        salida: '12:00'
      }
    });

    const manana = new Date();
    manana.setDate(hoy.getDate() + 1);
    const yM = manana.getFullYear();
    const mM = String(manana.getMonth() + 1).padStart(2, '0');
    const diaManana = String(manana.getDate()).padStart(2, '0');
    eventos.push({
      id: 'test-event-2',
      title: `Téc | ${ord2.cliente}`,
      start: `${yM}-${mM}-${diaManana}T14:00:00`,
      end: `${yM}-${mM}-${diaManana}T17:00:00`,
      allDay: false,
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      extendedProps: {
        isBitacora: true,
        ordenId: ord2.id,
        tecnico: 'Técnico de Pruebas',
        cliente: ord2.cliente,
        ubicacion: ord2.ubicacion || 'Sin ubicación',
        nota: 'Revisión y calibración de maquinaria de prueba.',
        entrada: '14:00',
        salida: '17:00'
      }
    });
  }

  // Deduplicación final por huella digital de evento (para evitar duplicados en pantalla)
  const eventosUnicos = [];
  const seenFingerprints = new Set();

  eventos.forEach(ev => {
    const startStr = ev.start ? (typeof ev.start === 'string' ? ev.start : ev.start.toISOString()) : '';
    const endStr = ev.end ? (typeof ev.end === 'string' ? ev.end : ev.end.toISOString()) : '';
    const titleStr = (ev.title || '').trim().toLowerCase();
    const tecStr = (ev.extendedProps?.tecnico || '').trim().toLowerCase();
    const ordId = ev.extendedProps?.ordenId || '';
    
    const fingerprint = `${titleStr}::${tecStr}::${ordId}::${startStr}::${endStr}`;

    if (!seenFingerprints.has(fingerprint)) {
      seenFingerprints.add(fingerprint);
      eventosUnicos.push(ev);
    }
  });

  const isMobileCalendar = window.innerWidth <= 768;
  const initialViewType = prevView || (isMobileCalendar ? 'listWeek' : 'dayGridMonth');
  calendarInstance = new FullCalendar.Calendar(container, {
    locale: 'es',
    allDayText: 'Todo el día',
    noEventsText: 'No hay eventos para mostrar',
    initialView: initialViewType,
    initialDate: prevDate || undefined,
    firstDay: 1, // Start on Monday
    headerToolbar: isMobileCalendar ? {
      left: 'prev,next',
      center: 'title',
      right: 'listWeek,timeGridDay'
    } : {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista'
    },
    events: eventosUnicos,
    eventClick: function(info) {
      if (info.event.extendedProps.isFestivo) return; // No hacer nada al hacer clic en días festivos
      if (info.event.extendedProps.isBitacora) {
        mostrarPopupBitacora(info);
      } else if (info.event.extendedProps.isAdminEvent) {
        mostrarDetalleEventoAdministrativo(info.event.id);
      } else if (info.event.extendedProps.isLevantamiento) {
        if (typeof verDetalleLevantamiento === 'function') verDetalleLevantamiento(info.event.extendedProps.levantamientoId);
      } else {
        verDetalle(info.event.id);
      }
    },
    eventContent: function(arg) {
      const bgColor = arg.event.backgroundColor || 'var(--accent)';
      
      if (arg.event.extendedProps.isFestivo) {
        const iconName = arg.event.extendedProps.icon || 'calendar';
        return {
          html: `<div style="background-color:${bgColor}; border:1px solid ${arg.event.borderColor}; border-radius:3px; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:2px 4px; color:${arg.event.textColor}; width:100%; box-sizing:border-box; display:flex; align-items:center; gap:0.25rem;" title="${arg.event.title}">
                   <i data-lucide="${iconName}" style="width:12px; height:12px;"></i>
                   <b>${arg.event.title}</b>
                 </div>`
        };
      }

      let timeText = arg.timeText || '';
      if (arg.view.type === 'dayGridMonth') {
        const p = arg.event.extendedProps || {};
        let startHour = '';
        if (p.entrada) {
          startHour = p.entrada;
        } else if (p.isTraslado && arg.event.start) {
          const sDate = arg.event.start;
          const h = String(sDate.getHours()).padStart(2, '0');
          const m = String(sDate.getMinutes()).padStart(2, '0');
          startHour = `${h}:${m}`;
        } else if (arg.event.allDay) {
          startHour = '';
        } else if (arg.timeText && !arg.timeText.includes('a') && arg.timeText.length >= 4) {
          startHour = arg.timeText;
        }
        const timeHtml = startHour ? `<b>${startHour}</b> ` : '';
        return {
          html: `<div style="background-color:${bgColor}; border-radius:3px; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:2px 4px; color:white; width:100%; box-sizing:border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.15);" title="${arg.event.title}">
                   ${timeHtml}${arg.event.title}
                 </div>`
        };
      }

      if (!arg.event.allDay && arg.event.extendedProps.entrada) {
        timeText = arg.event.extendedProps.entrada;
        if (arg.event.extendedProps.salida) {
          timeText += ` a ${arg.event.extendedProps.salida}`;
        }
      }

      const timeHtml = timeText ? `<div style="font-weight:700; margin-bottom:1px; font-size:0.7rem; color:rgba(255,255,255,0.9);">${timeText}</div>` : '';
      
      return {
        html: `<div style="background-color:${bgColor}; border-radius:3px; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:3px 4px; color:white; width:100%; box-sizing:border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.2);" title="${arg.event.title}">
                 ${timeHtml}<b>${arg.event.title}</b><br/>
                 <span style="font-size:0.65rem; opacity:0.85;">${arg.event.extendedProps.tecnico || 'Sin asignar'}</span>
               </div>`
      };
    },
    eventDidMount: function(info) {
      if (window.lucide) {
        window.lucide.createIcons({ root: info.el });
      }
    }
  });
  
  calendarInstance.render();
}

// ===== ACTIVIDADES DE CALENDARIO ADMINISTRATIVAS (FASE 9) =====

function abrirRegistrarActividad() {
  document.getElementById('mra-id').value = '';
  document.getElementById('mra-titulo-modal').innerHTML = '<i data-lucide="calendar" style="width:20px; height:20px; color:var(--accent);"></i> Registrar Actividad';
  document.getElementById('mra-titulo').value = '';
  document.getElementById('mra-tipo').value = 'Junta';
  document.getElementById('mra-descripcion').value = '';
  document.getElementById('mra-inicio').value = '';
  document.getElementById('mra-fin').value = '';
  document.getElementById('mra-todo-el-dia').checked = false;
  document.getElementById('mra-btn-eliminar').style.display = 'none';

  // Llenar dropdown de técnicos
  const selectTec = document.getElementById('mra-tecnico');
  const tecs = usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && u.activo !== false && (isTestModeActive() || !isTestUser(u)));
  selectTec.innerHTML = '<option value="">Ninguno / Todos</option>' + tecs.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');

  // Llenar dropdown de órdenes
  const selectOrden = document.getElementById('mra-orden');
  const activeOrds = getFilteredOrders().filter(o => o.estado !== 'Finalizado');
  selectOrden.innerHTML = '<option value="">Ninguna</option>' + activeOrds.map(o => `<option value="${o.id}">[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}</option>`).join('');

  // Limpiar campos de traslado
  if (document.getElementById('mra-fecha-inicio-traslado')) {
    document.getElementById('mra-fecha-inicio-traslado').value = '';
    document.getElementById('mra-hora-inicio').value = '';
    document.getElementById('mra-horas-traslado').value = '';
    document.getElementById('mra-fecha-fin-regreso-date').value = '';
    document.getElementById('mra-hora-fin-regreso').value = '';
    document.getElementById('mra-horas-regreso').value = '';
    document.getElementById('mra-traslado-section').style.display = 'none';
    document.getElementById('mra-btn-toggle-traslado').style.display = 'none';
  }

  document.getElementById('modal-registrar-actividad-overlay').classList.add('open');
  if (window.lucide) {
    window.lucide.createIcons({ root: document.getElementById('modal-registrar-actividad') });
  }
};

function mostrarDetalleEventoAdministrativo(eventId) {
  const adminEvents = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
  const e = adminEvents.find(x => x.id === eventId);
  if (!e) return;

  // Llenar dropdown de técnicos
  const selectTec = document.getElementById('mra-tecnico');
  const tecs = usuarios.filter(u => ['tecnico', 'supervisor'].includes(u.rol) && u.activo !== false && (isTestModeActive() || !isTestUser(u)));
  selectTec.innerHTML = '<option value="">Ninguno / Todos</option>' + tecs.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');

  // Llenar dropdown de órdenes
  const selectOrden = document.getElementById('mra-orden');
  const activeOrds = getFilteredOrders().filter(o => o.estado !== 'Finalizado');
  selectOrden.innerHTML = '<option value="">Ninguna</option>' + activeOrds.map(o => `<option value="${o.id}">[${o.folio || 'S/N'}] ${o.cliente} - ${o.tipo}</option>`).join('');

  document.getElementById('mra-id').value = e.id;
  document.getElementById('mra-titulo-modal').innerHTML = '<i data-lucide="edit" style="width:20px; height:20px; color:var(--accent);"></i> Editar Actividad';
  document.getElementById('mra-titulo').value = e.titulo || '';
  document.getElementById('mra-tipo').value = e.tipo || 'Junta';
  document.getElementById('mra-tecnico').value = e.tecnicoId || '';
  document.getElementById('mra-orden').value = e.ordenId || '';
  document.getElementById('mra-descripcion').value = e.descripcion || '';
  document.getElementById('mra-todo-el-dia').checked = e.todoElDia || e.allDay || false;

  // Formatear fechas para datetime-local (conversión de UTC a hora local del navegador)
  const cleanDateForInput = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  document.getElementById('mra-inicio').value = cleanDateForInput(e.fechaInicio || e.start);
  document.getElementById('mra-fin').value = cleanDateForInput(e.fechaFin || e.end);

  // Llenar campos de traslado si existen
  if (document.getElementById('mra-fecha-inicio-traslado')) {
    let bitacoraEntry = null;
    if (e.ordenId) {
      const ord = ordenes.find(o => o.id === e.ordenId);
      if (ord && ord.bitacora) {
        bitacoraEntry = ord.bitacora.find(b => b.id === e.id);
      }
    }
    const hasTraslado = bitacoraEntry && (bitacoraEntry.horas_traslado || bitacoraEntry.horas_regreso || bitacoraEntry.fecha_inicio_traslado || bitacoraEntry.fecha_fin_regreso);
    if (hasTraslado) {
      document.getElementById('mra-fecha-inicio-traslado').value = bitacoraEntry.fecha_inicio_traslado || '';
      document.getElementById('mra-hora-inicio').value = bitacoraEntry.hora_inicio || '';
      document.getElementById('mra-horas-traslado').value = bitacoraEntry.horas_traslado || '';
      document.getElementById('mra-fecha-fin-regreso-date').value = bitacoraEntry.fecha_fin_regreso || '';
      document.getElementById('mra-hora-fin-regreso').value = bitacoraEntry.hora_fin_regreso || '';
      document.getElementById('mra-horas-regreso').value = bitacoraEntry.horas_regreso || '';
      
      document.getElementById('mra-traslado-section').style.display = 'block';
      document.getElementById('mra-btn-toggle-traslado').style.display = 'none';
    } else {
      document.getElementById('mra-fecha-inicio-traslado').value = '';
      document.getElementById('mra-hora-inicio').value = '';
      document.getElementById('mra-horas-traslado').value = '';
      document.getElementById('mra-fecha-fin-regreso-date').value = '';
      document.getElementById('mra-hora-fin-regreso').value = '';
      document.getElementById('mra-horas-regreso').value = '';
      
      document.getElementById('mra-traslado-section').style.display = 'none';
      document.getElementById('mra-btn-toggle-traslado').style.display = e.ordenId ? 'flex' : 'none';
    }
  }

  // Mostrar botón de eliminar solo para administradores y supervisores
  const isAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
  document.getElementById('mra-btn-eliminar').style.display = isAdmin ? 'inline-flex' : 'none';

  document.getElementById('modal-registrar-actividad-overlay').classList.add('open');
  if (window.lucide) {
    window.lucide.createIcons({ root: document.getElementById('modal-registrar-actividad') });
  }
};

async function guardarActividadCalendario() {
  const id = document.getElementById('mra-id').value;
  const titulo = document.getElementById('mra-titulo').value;
  const tipo = document.getElementById('mra-tipo').value;
  const tecnicoId = document.getElementById('mra-tecnico').value;
  const ordenId = document.getElementById('mra-orden').value;
  const inicio = document.getElementById('mra-inicio').value;
  const fin = document.getElementById('mra-fin').value;
  const todoElDia = document.getElementById('mra-todo-el-dia').checked;
  const descripcion = document.getElementById('mra-descripcion').value;

  if (!titulo || !inicio) {
    alert("Por favor completa los campos requeridos (Título y Fecha de Inicio).");
    return;
  }

  // Get travel inputs if they exist
  const mraFechaInicioTraslado = document.getElementById('mra-fecha-inicio-traslado') ? document.getElementById('mra-fecha-inicio-traslado').value : null;
  const mraHoraInicio = document.getElementById('mra-hora-inicio') ? document.getElementById('mra-hora-inicio').value : null;
  const mraHorasTraslado = document.getElementById('mra-horas-traslado') ? document.getElementById('mra-horas-traslado').value : null;
  const mraFechaFinRegresoDate = document.getElementById('mra-fecha-fin-regreso-date') ? document.getElementById('mra-fecha-fin-regreso-date').value : null;
  const mraHoraFinRegreso = document.getElementById('mra-hora-fin-regreso') ? document.getElementById('mra-hora-fin-regreso').value : null;
  const mraHorasRegreso = document.getElementById('mra-horas-regreso') ? document.getElementById('mra-horas-regreso').value : null;

  // Validations for travel times
  if (ordenId && (mraFechaInicioTraslado || mraHoraInicio || mraHorasTraslado)) {
    const fechaISO = inicio.substring(0, 10);
    let entrada = '';
    if (inicio) {
      const dIni = new Date(inicio);
      entrada = `${String(dIni.getHours()).padStart(2, '0')}:${String(dIni.getMinutes()).padStart(2, '0')}`;
    }
    const dEntrada = new Date(`${fechaISO}T${entrada || '23:59'}`);
    const dInicioTraslado = new Date(`${mraFechaInicioTraslado || fechaISO}T${mraHoraInicio || '00:00'}`);
    
    if (dInicioTraslado > dEntrada) {
      if (window.mostrarNotificacion) window.mostrarNotificacion("El inicio del traslado de ida no puede ser después de que comience el servicio.", "error");
      else alert("El inicio del traslado de ida no puede ser después de que comience el servicio.");
      return;
    }

    if (mraHoraInicio && mraHorasTraslado && entrada) {
      const minLlegada = horaAMinutos(mraHoraInicio) + (parseFloat(mraHorasTraslado) * 60);
      const dLlegada = new Date(`${mraFechaInicioTraslado || fechaISO}T00:00`);
      dLlegada.setMinutes(dLlegada.getMinutes() + minLlegada);

      if (dEntrada < dLlegada) {
        if (window.mostrarNotificacion) window.mostrarNotificacion("No se puede empezar el servicio antes de la llegada estimada del traslado de ida.", "error");
        else alert("No se puede empezar el servicio antes de la llegada estimada del traslado de ida.");
        return;
      }
    }
  }

  if (ordenId && (mraFechaFinRegresoDate || mraHoraFinRegreso || mraHorasRegreso)) {
    const fechaISO = inicio.substring(0, 10);
    let salida = '';
    if (fin) {
      const dFin = new Date(fin);
      salida = `${String(dFin.getHours()).padStart(2, '0')}:${String(dFin.getMinutes()).padStart(2, '0')}`;
    }
    const dSalida = new Date(`${fechaISO}T${salida || '00:00'}`);
    const dInicioRegreso = new Date(`${mraFechaFinRegresoDate || fechaISO}T${mraHoraFinRegreso || '23:59'}`);
    
    if (dInicioRegreso < dSalida) {
      if (window.mostrarNotificacion) window.mostrarNotificacion("No se puede iniciar el traslado de regreso antes de terminar el servicio.", "error");
      else alert("No se puede iniciar el traslado de regreso antes de terminar el servicio.");
      return;
    }
  }

  let tecnicoNombre = null;
  if (tecnicoId) {
    const u = usuarios.find(usr => usr.id === tecnicoId);
    if (u) tecnicoNombre = u.nombre;
  }

  const activeUserId = currentSession.userId || null;
  const activeUserName = obtenerNombreUsuarioActual();

  let cleanInicio = inicio;
  let cleanFin = fin || null;
  if (todoElDia) {
    cleanInicio = inicio.substring(0, 10);
    cleanFin = fin ? fin.substring(0, 10) : null;
  } else {
    if (inicio && inicio.length === 16) cleanInicio = `${inicio}:00`;
    if (fin && fin.length === 16) cleanFin = `${fin}:00`;
  }

  let entrada = '';
  let salida = '';
  if (!todoElDia && inicio && inicio.includes('T')) {
    entrada = inicio.split('T')[1].substring(0, 5);
  }
  if (!todoElDia && fin && fin.includes('T')) {
    salida = fin.split('T')[1].substring(0, 5);
  }

  const eventoObj = {
    id: id || crypto.randomUUID(),
    titulo: titulo,
    tipo: tipo,
    tecnicoId: tecnicoId || null,
    tecnicoNombre: tecnicoNombre,
    ordenId: ordenId || null,
    fechaInicio: cleanInicio,
    start: cleanInicio,
    fechaFin: cleanFin,
    end: cleanFin,
    entrada: entrada,
    salida: salida,
    todoElDia: todoElDia,
    allDay: todoElDia,
    descripcion: descripcion || null,
    creadoPor: activeUserId,
    creadoPorNombre: activeUserName,
    color: null
  };

  // Guardar de forma reactiva y offline-first
  const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
  const idx = localEventos.findIndex(x => x.id === eventoObj.id);
  if (idx > -1) {
    localEventos[idx] = { ...localEventos[idx], ...eventoObj };
  } else {
    localEventos.unshift(eventoObj);
  }
  localStorage.setItem('sapi_calendario_eventos', JSON.stringify(localEventos));

  // Sincronizar de regreso con la orden de servicio
  try {
    if (ordenId) {
      const oIndex = ordenes.findIndex(o => o.id === ordenId);
      if (oIndex > -1) {
        const o = ordenes[oIndex];
        if (!o.bitacora) o.bitacora = [];
        
        const existIdx = o.bitacora.findIndex(b => b.id === eventoObj.id);
        const fechaISO = inicio.substring(0, 10);

        const nuevaEntrada = {
          id: eventoObj.id,
          fecha: fechaISO,
          tecnico: tecnicoNombre || 'Sin Asignar',
          tipo: tipo,
          nota: descripcion || "Programado por supervisor. Pendiente de llenado por el técnico.",
          entrada: entrada,
          salida: salida,
          fecha_inicio_traslado: mraFechaInicioTraslado || null,
          hora_inicio: mraHoraInicio || null,
          horas_traslado: mraHorasTraslado ? parseFloat(mraHorasTraslado) : null,
          fecha_fin_regreso: mraFechaFinRegresoDate || null,
          hora_fin_regreso: mraHoraFinRegreso || null,
          horas_regreso: mraHorasRegreso ? parseFloat(mraHorasRegreso) : null,
          realizado: false,
          asignadoPorName: activeUserName,
          asignadoPorId: activeUserId
        };

        if (existIdx > -1) {
          if (o.bitacora[existIdx].realizado !== true) {
            const origAsignado = o.bitacora[existIdx].asignadoPorName || activeUserName;
            const origAsignadoId = o.bitacora[existIdx].asignadoPorId || activeUserId;
            o.bitacora[existIdx] = { 
              ...o.bitacora[existIdx], 
              ...nuevaEntrada,
              asignadoPorName: origAsignado,
              asignadoPorId: origAsignadoId
            };
          }
        } else {
          o.bitacora.push(nuevaEntrada);
        }

        if (tecnicoNombre) {
          if (!o.tecnicosAsignados) o.tecnicosAsignados = [];
          if (!o.tecnicosAsignados.includes(tecnicoNombre)) {
            o.tecnicosAsignados.push(tecnicoNombre);
            o.tecnico = o.tecnicosAsignados.join(', ');
          }
        }

        safeSetJSON('sapi_ordenes', ordenes);
        if (window.pushToSupabase) {
          window.pushToSupabase('ordenes', o);
        }
      }
    }
  } catch(e){}

  // Sincronizar asíncronamente con Supabase
  window.pushToSupabase('calendario_eventos', eventoObj);

  if (window.trackTelemetryEvent) {
    const o = ordenId ? ordenes.find(x => x.id === ordenId) : null;
    const folioStr = o ? (o.folio || 'Sin Folio') : 'Sin Folio';
    window.trackTelemetryEvent(id ? 'Edición de Asignación' : 'Creación de Asignación', { 
      tecnico: tecnicoNombre || 'Sin Asignar', 
      fecha: inicio ? inicio.substring(0, 10) : '', 
      folio: folioStr 
    });
  }

  // Cerrar modal y re-renderizar
  document.getElementById('modal-registrar-actividad-overlay').classList.remove('open');
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }
  if (window.mostrarNotificacion) {
    window.mostrarNotificacion("Actividad guardada exitosamente.", "success");
  }
};

async function eliminarActividadCalendario() {
  const id = document.getElementById('mra-id').value;
  if (!id) return;

  if (!confirm("¿Estás seguro de que deseas eliminar esta actividad?")) return;

  const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
  const filtrados = localEventos.filter(x => x.id !== id);
  localStorage.setItem('sapi_calendario_eventos', JSON.stringify(filtrados));

  // Eliminar asíncronamente en Supabase
  window.deleteFromSupabase('calendario_eventos', id);

  // Eliminar también de la bitácora de la orden correspondiente si estaba asociada
  try {
    const ordenesLocales = JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
    let ordenModificada = null;
    ordenesLocales.forEach(o => {
      if (o.bitacora && o.bitacora.some(b => b.id === id)) {
        o.bitacora = o.bitacora.filter(b => b.id !== id);
        ordenModificada = o;
      }
    });
    if (ordenModificada) {
      if (typeof ordenes !== 'undefined') {
        const idx = ordenes.findIndex(o => o.id === ordenModificada.id);
        if (idx > -1) ordenes[idx] = ordenModificada;
      }
      localStorage.setItem('sapi_ordenes', JSON.stringify(ordenesLocales));
      if (window.pushToSupabase) {
        window.pushToSupabase('ordenes', ordenModificada);
      }
      if (typeof window.currentDetalleOrdenId !== 'undefined' && window.currentDetalleOrdenId === ordenModificada.id) {
        verDetalle(ordenModificada.id);
      }
    }
  } catch(e) {
    console.error('Error al remover bitácora al eliminar evento:', e);
  }

  document.getElementById('modal-registrar-actividad-overlay').classList.remove('open');
  if (typeof renderCalendario === 'function') {
    renderCalendario();
  }

  if (window.trackTelemetryEvent) {
    window.trackTelemetryEvent('Eliminación de Asignación', { id });
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion("Actividad eliminada.", "info");
  }
};

function mostrarPopupBitacora(info) {
  const dObj = info.event.start;
  const fechaStr = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const p = info.event.extendedProps;
  
  const o = ordenes.find(x => x.id === p.ordenId);
  const folio = o ? (o.folio || 'Sin Folio') : 'Sin Folio';

  let horasStr = '';
  const isTraslado = p.isTraslado;

  if (isTraslado) {
    const dObjEnd = info.event.end;
    const endStrFormat = dObjEnd ? dObjEnd.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'}) : '--:--';
    horasStr = `<div style="margin-top: 1rem;">
                  <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Detalles de Traslado (${p.tipoTraslado}):</strong></p>
                  <p style="margin:0 0 0.5rem 0; font-size:0.85rem; padding-left:1rem;">• Duración: ${p.duracion} horas</p>
                  <p style="margin:0 0 0.5rem 0; font-size:0.85rem; padding-left:1rem;">• Salida: ${dObj.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p style="margin:0 0 0.5rem 0; font-size:0.85rem; padding-left:1rem;">• Llegada estimada: ${endStrFormat}</p>
                </div>`;
  } else if (p.entrada || p.salida) {
    horasStr = `<p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Horario de Servicio:</strong> ${p.entrada || '--:--'} a ${p.salida || '--:--'}</p>`;
  }

  const bitacoraId = String(info.event.id || '').replace('bit-', '').replace('traslado-ida-', '').replace('traslado-regreso-', '');
  const b = o?.bitacora?.find(x => x.id === bitacoraId);
  const esAsignacionPendiente = b && (b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true));
  const esSupervisorOrAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);

  const asignador = b?.asignadoPorName || p.creadoPorNombre || 'Supervisor';

  let actionButtonsHtml = '';
  if (esSupervisorOrAdmin && p.ordenId) {
    if (esAsignacionPendiente) {
      actionButtonsHtml += `
        <button class="btn-secondary-flex" onclick="this.closest('.modal-overlay').remove(); window.mostrarDetalleEventoAdministrativo('${bitacoraId}')" style="margin-right:0.5rem;">
          <i data-lucide="edit-2" class="btn-icon" style="width:14px; height:14px;"></i> Editar
        </button>
      `;
    }
    actionButtonsHtml += `
      <button class="btn-danger" onclick="this.closest('.modal-overlay').remove(); window.eliminarAsignacionProgramadaDirecto('${p.ordenId}', '${bitacoraId}')" style="margin-right:0.5rem;" title="Eliminar esta asignación/avance de este día">
        <i data-lucide="trash-2" class="btn-icon" style="width:14px; height:14px;"></i> Eliminar de este día
      </button>
      <button class="btn-danger" onclick="this.closest('.modal-overlay').remove(); window.eliminarTodasAsignacionesOrden('${p.ordenId}')" style="margin-right:0.5rem; background: #dc2626; color: white;" title="Eliminar todas las asignaciones programadas de esta orden">
        <i data-lucide="trash" class="btn-icon" style="width:14px; height:14px;"></i> Limpiar Orden
      </button>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div class="modal" style="max-width:450px; background:var(--bg-card); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding: 1rem 1.5rem;">
        <h3 id="modal-title" style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="${isTraslado ? 'map' : 'calendar-check'}" style="color:var(--accent);"></i> ${isTraslado ? 'Detalles de Traslado' : 'Avance Diario'}</h3>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-muted);"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body" style="padding:1.5rem;">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; text-transform:capitalize; font-weight:500;">${fechaStr}</div>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Orden de Servicio:</strong> ${folio}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Técnico:</strong> ${p.tecnico}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Asignado por:</strong> ${asignador}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Cliente:</strong> ${p.cliente}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Maquinaria:</strong> ${p.equipo || 'N/A'}</p>
        <p style="margin:0 0 0.5rem 0; font-size:0.85rem;"><strong style="color:var(--text-primary);">Ubicación:</strong> ${p.ubicacion}</p>
        ${horasStr}
        ${!isTraslado ? `<div style="margin-top:1rem; padding:1rem; background:var(--bg-body); border-radius:6px; font-size:0.85rem; border:1px solid var(--border); white-space:pre-wrap; line-height:1.5; color:var(--text-secondary); max-height:250px; overflow-y:auto;">${p.nota}</div>` : ''}
        <div style="margin-top:1.5rem; text-align:right; display:flex; justify-content:flex-end;">
          ${actionButtonsHtml}
          <button class="btn-primary" onclick="this.closest('.modal-overlay').remove(); verDetalle('${p.ordenId}')">Ver Orden Completa</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ root: overlay });
}


if (typeof window !== "undefined") {
  window.calendarInstance = typeof calendarInstance !== "undefined" ? calendarInstance : null;
  window.actualizarFiltrosCalendario = actualizarFiltrosCalendario;
  window.getNthDayOfMonth = getNthDayOfMonth;
  window.getSemanaSanta = getSemanaSanta;
  window.getFestivosMexico = getFestivosMexico;
  window.renderCalendario = renderCalendario;
  window.abrirRegistrarActividad = abrirRegistrarActividad;
  window.mostrarDetalleEventoAdministrativo = mostrarDetalleEventoAdministrativo;
  window.guardarActividadCalendario = guardarActividadCalendario;
  window.eliminarActividadCalendario = eliminarActividadCalendario;
  window.mostrarPopupBitacora = mostrarPopupBitacora;
}

