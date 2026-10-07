/**
 * MÓDULO DE RESUMEN SEMANAL OPERATIVO Y REPORTES EJECUTIVOS
 * Eurorep / SAPI - ES Module
 */

const _escapeHTML = (str) => {
  if (typeof escapeHTML === "function") return escapeHTML(str);
  if (typeof window !== "undefined" && typeof window.escapeHTML === "function") return window.escapeHTML(str);
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const _unify = (name) => {
  if (typeof unificarNombreUsuario === "function") return unificarNombreUsuario(name);
  if (typeof window !== "undefined" && typeof window.unificarNombreUsuario === "function") return window.unificarNombreUsuario(name);
  return (name || "").trim();
};

const _isTestMode = () => {
  if (typeof isTestModeActive === "function") return isTestModeActive();
  if (typeof window !== "undefined" && typeof window.isTestModeActive === "function") return window.isTestModeActive();
  return false;
};

const _isTestItem = (item) => {
  if (typeof isTestData === "function") return isTestData(item);
  if (typeof window !== "undefined" && typeof window.isTestData === "function") return window.isTestData(item);
  return false;
};

const _getTickets = () => {
  if (typeof tickets !== "undefined" && Array.isArray(tickets)) return tickets;
  if (typeof window !== "undefined" && Array.isArray(window.tickets)) return window.tickets;
  return [];
};

const _getOrdenes = () => {
  if (typeof ordenes !== "undefined" && Array.isArray(ordenes)) return ordenes;
  if (typeof window !== "undefined" && Array.isArray(window.ordenes)) return window.ordenes;
  return [];
};

const _getLevantamientos = () => {
  if (typeof levantamientos !== "undefined" && Array.isArray(levantamientos)) return levantamientos;
  if (typeof window !== "undefined" && Array.isArray(window.levantamientos)) return window.levantamientos;
  return [];
};

const _esUsuarioPrueba = (userOrName) => {
  if (!userOrName) return false;
  if (typeof isTestUser === 'function' && isTestUser(userOrName)) return true;
  if (typeof window !== 'undefined' && typeof window.isTestUser === 'function' && window.isTestUser(userOrName)) return true;
  const name = (typeof userOrName === 'string' ? userOrName : (userOrName.nombre || userOrName.name || '')).toLowerCase().trim();
  const email = (typeof userOrName === 'object' ? (userOrName.email || userOrName.correo || '') : '').toLowerCase().trim();
  return name.includes('prueba') || name.includes('test') || email.includes('prueba') || email.includes('test');
};

const _resolverNombreDeIdOUsuario = (val) => {
  if (!val) return '';
  if (typeof val === 'object') {
    return val.nombre || val.name || val.usuario || val.tecnico || val.id || '';
  }
  const str = String(val).trim();
  if (!str) return '';

  const getArr = (key) => {
    if (typeof window !== 'undefined' && Array.isArray(window[key])) return window[key];
    if (typeof global !== 'undefined' && Array.isArray(global[key])) return global[key];
    if (typeof globalThis !== 'undefined' && Array.isArray(globalThis[key])) return globalThis[key];
    return [];
  };

  const uList = (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : getArr('usuarios');
  const uFound = uList.find(u => u && (u.id === str || u.usuarioId === str));
  if (uFound && uFound.nombre) return uFound.nombre;

  const tList = (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) ? tecnicosDb : getArr('tecnicosDb');
  const tFound = tList.find(t => t && (t.id === str || t.idTecnico === str));
  if (tFound && tFound.nombre) return tFound.nombre;

  return str;
};

const _extraerResponsablesIndividuales = (input) => {
  if (!input) return [];
  const list = [];
  const processStr = (rawStr) => {
    if (!rawStr) return;
    const str = _resolverNombreDeIdOUsuario(rawStr);
    if (!str || typeof str !== 'string') return;
    str.split(/[,;/]+/).forEach(part => {
      const resolvedPart = _resolverNombreDeIdOUsuario(part.trim());
      const u = _unify(resolvedPart);
      if (u && u !== 'Sin Asignar' && u !== '-' && u !== 'sin_asignar' && u !== 'por definir' && !_esUsuarioPrueba(u) && !list.includes(u)) {
        list.push(u);
      }
    });
  };

  if (Array.isArray(input)) {
    input.forEach(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        processStr(item);
      } else if (item && typeof item === 'object') {
        processStr(item.nombre || item.name || item.usuario || item.tecnico || item.id || '');
      }
    });
  } else if (typeof input === 'string' || typeof input === 'number') {
    processStr(input);
  }
  return list;
};

const _getTecnicosJunta = () => {
  const result = [];
  const add = (arr) => {
    if (!arr) return;
    _extraerResponsablesIndividuales(arr).forEach(name => {
      const u = _unify(name);
      if (u && u !== 'Sin Asignar' && u !== 'todos' && !_esUsuarioPrueba(u) && !result.includes(u)) {
        result.push(u);
      }
    });
  };

  const getTarget = (fnName) => {
    if (typeof window !== "undefined" && typeof window[fnName] === "function") return window[fnName];
    if (typeof global !== "undefined" && typeof global[fnName] === "function") return global[fnName];
    if (typeof globalThis !== "undefined" && typeof globalThis[fnName] === "function") return globalThis[fnName];
    return null;
  };

  const fnJunta = getTarget('obtenerListaTecnicosJunta');
  if (fnJunta) {
    try {
      add(fnJunta());
    } catch(e) {}
  }

  const getArr = (key) => {
    if (typeof window !== 'undefined' && Array.isArray(window[key])) return window[key];
    if (typeof global !== 'undefined' && Array.isArray(global[key])) return global[key];
    if (typeof globalThis !== 'undefined' && Array.isArray(globalThis[key])) return globalThis[key];
    return [];
  };

  const uList = (typeof usuarios !== "undefined" && Array.isArray(usuarios)) ? usuarios : getArr('usuarios');
  if (uList.length > 0) {
    add(uList.filter(u => u && (u.rol === "tecnico" || u.rol === "supervisor") && !_esUsuarioPrueba(u)).map(u => u.nombre));
  }

  const tList = (typeof tecnicosDb !== "undefined" && Array.isArray(tecnicosDb)) ? tecnicosDb : getArr('tecnicosDb');
  if (tList.length > 0) {
    add(tList.filter(t => t && !_esUsuarioPrueba(t)).map(t => t.nombre).filter(Boolean));
  }

  return result;
};

/* ==========================================================================
   RESUMEN SEMANAL OPERATIVO
   ========================================================================== */

let _resumenSemanalOffset = 0;
let _resumenSemanalTicketTab = 'cerrados'; // 'cerrados' | 'abiertos'
let _resumenSemanalCacheData = null;

function abrirModalResumenSemanal() {
  try {
    const overlay = document.getElementById('modal-resumen-semanal-overlay');
    if (overlay) {
      overlay.classList.add('open');
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
      overlay.style.visibility = 'visible';
      cargarResumenSemanal(0);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        setTimeout(() => lucide.createIcons(), 50);
      }
    } else {
      console.warn('modal-resumen-semanal-overlay no fue encontrado en el DOM.');
    }
  } catch(err) {
    console.error('Error al abrir resumen semanal:', err);
  }
};

function cerrarModalResumenSemanal() {
  const overlay = document.getElementById('modal-resumen-semanal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
};

function obtenerRangoSemana(offsetSemanas = 0) {
  const now = new Date();
  const currentDay = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const distanceToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
  
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday + (offsetSemanas * 7), 0, 0, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

  return { monday, sunday };
};

function parseFechaResumenMs(fechaVal) {
  if (!fechaVal) return null;
  if (fechaVal instanceof Date) return isNaN(fechaVal.getTime()) ? null : fechaVal.getTime();
  if (typeof fechaVal === 'number') return fechaVal;
  if (typeof fechaVal === 'string') {
    const d = new Date(fechaVal);
    if (!isNaN(d.getTime())) return d.getTime();
    const parts = fechaVal.split(/[-/ T]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      } else if (parts[2].length === 4) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
    }
  }
  return null;
}

function obtenerTodosLosElementosGlobales() {
  const all = [];
  const isTest = typeof isTestModeActive === 'function' && typeof isTestData === 'function';

  // 1. TICKETS
  const tkts = _getTickets();
  tkts.forEach(t => {
    if (!t) return;
    if (isTest && isTestData(t) !== isTestModeActive()) return;

    const fechaCreacionMs = parseFechaResumenMs(t.fechaCreacion || t.fecha || t.created_at || t.fecha_creacion);
    const est = String(t.estado || '').trim();
    const esCerrado = (est === 'Cerrado' || est === 'Cancelado');
    const fechaCierreMs = esCerrado ? parseFechaResumenMs(t.fechaCierre || t.fecha_cierre || t.closed_at || t.updated_at || t.fechaModificacion) : null;

    let resps = [];
    if (Array.isArray(t.responsablesList) && t.responsablesList.length > 0) {
      resps = _extraerResponsablesIndividuales(t.responsablesList);
    }
    if (resps.length === 0 && Array.isArray(t.tecnicosAsignados) && t.tecnicosAsignados.length > 0) {
      resps = _extraerResponsablesIndividuales(t.tecnicosAsignados);
    }
    if (resps.length === 0) {
      resps = _extraerResponsablesIndividuales(t.asignado || t.asignadoA || t.responsable || t.tecnico || '');
    }
    if (resps.length === 0) resps = ['Sin Asignar'];

    all.push({
      tipo: 'ticket',
      folio: t.folio || (t.id ? String(t.id).substring(0, 8) : 'N/A'),
      titulo: t.titulo || t.asunto || t.descripcion || 'Ticket de Servicio',
      cliente: t.cliente || t.nombreCliente || 'N/A',
      equipo: t.maquina || t.equipo || 'N/A',
      estado: est || 'Abierto',
      fechaCreacionMs,
      fechaCierreMs,
      esCerrado,
      responsables: resps,
      rawItem: t
    });
  });

  // 2. ÓRDENES DE SERVICIO
  const ords = _getOrdenes();
  ords.forEach(o => {
    if (!o) return;
    if (isTest && isTestData(o) !== isTestModeActive()) return;

    const fechaCreacionMs = parseFechaResumenMs(o.fechaCreacion || o.fecha || o.created_at || o.fecha_creacion);
    const est = String(o.estado || o.estatus || '').trim();
    const esCerrado = (est === 'Completada' || est === 'Cerrada' || est === 'Cerrado' || est === 'Finalizado');
    const fechaCierreMs = esCerrado ? parseFechaResumenMs(o.fechaCierre || o.fecha_cierre || o.closed_at || o.updated_at) : null;

    let resps = [];
    if (Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.length > 0) {
      resps = _extraerResponsablesIndividuales(o.tecnicosAsignados);
    }
    if (resps.length === 0 && Array.isArray(o.responsablesList) && o.responsablesList.length > 0) {
      resps = _extraerResponsablesIndividuales(o.responsablesList);
    }
    if (resps.length === 0) {
      resps = _extraerResponsablesIndividuales(o.tecnicoAsignado || o.tecnico || o.responsable || '');
    }
    if (resps.length === 0) resps = ['Sin Asignar'];

    all.push({
      tipo: 'orden',
      folio: o.folio || o.id || 'N/A',
      titulo: o.trabajoSolicitado || o.descripcion || 'Orden de Servicio',
      cliente: o.cliente || 'N/A',
      equipo: o.equipo || o.maquina || 'N/A',
      estado: est || 'Abierta',
      fechaCreacionMs,
      fechaCierreMs,
      esCerrado,
      responsables: resps,
      rawItem: o
    });
  });

  // 3. LEVANTAMIENTOS
  const levs = _getLevantamientos();
  levs.forEach(l => {
    if (!l) return;
    if (isTest && isTestData(l) !== isTestModeActive()) return;

    const fechaCreacionMs = parseFechaResumenMs(l.fechaCreacion || l.fecha || l.created_at);
    const est = String(l.estado || '').trim();
    const esCerrado = (est === 'Completado' || est === 'Cerrado' || est === 'Cotizado');
    const fechaCierreMs = esCerrado ? parseFechaResumenMs(l.fechaCierre || l.fecha_cierre || l.closed_at || l.updated_at) : null;

    let resps = [];
    if (Array.isArray(l.responsablesList) && l.responsablesList.length > 0) {
      resps = _extraerResponsablesIndividuales(l.responsablesList);
    }
    if (resps.length === 0 && Array.isArray(l.tecnicosAsignados) && l.tecnicosAsignados.length > 0) {
      resps = _extraerResponsablesIndividuales(l.tecnicosAsignados);
    }
    if (resps.length === 0) {
      resps = _extraerResponsablesIndividuales(l.responsable || l.tecnico || l.asignado || '');
    }
    if (resps.length === 0) resps = ['Sin Asignar'];

    all.push({
      tipo: 'levantamiento',
      folio: l.folio || l.id || 'N/A',
      titulo: l.titulo || l.descripcion || 'Levantamiento técnico',
      cliente: l.cliente || 'N/A',
      equipo: l.equipo || l.maquina || 'N/A',
      estado: est || 'Pendiente',
      fechaCreacionMs,
      fechaCierreMs,
      esCerrado,
      responsables: resps,
      rawItem: l
    });
  });

  return all;
};

function cargarResumenSemanal(offsetSemanas = 0) {
  _resumenSemanalOffset = offsetSemanas; if (typeof window !== 'undefined') window._resumenSemanalOffset = offsetSemanas;
  const { monday, sunday } = obtenerRangoSemana(offsetSemanas);
  const tInicio = monday.getTime();
  const tFin = sunday.getTime();

  // Formatear texto de rango
  const opciones = { day: 'numeric', month: 'short', year: 'numeric' };
  const strInicio = monday.toLocaleDateString('es-MX', opciones);
  const strFin = sunday.toLocaleDateString('es-MX', opciones);
  const tagSemana = offsetSemanas === 0 ? ' (Semana Actual)' : (offsetSemanas === -1 ? ' (Semana Pasada)' : '');
  
  const elRango = document.getElementById('resumen-semanal-rango-txt');
  if (elRango) elRango.textContent = `Del ${strInicio} al ${strFin}${tagSemana}`;

  const elThFin = document.getElementById('th-resumen-semanal-fin');
  if (elThFin) {
    elThFin.textContent = offsetSemanas === 0 ? 'Actualmente' : 'Fin Semana';
  }

  const todos = obtenerTodosLosElementosGlobales();

  // 1. MÉTRICAS CLAVE (KPIs)
  const ticketsAbiertosSemana = todos.filter(x => x.tipo === 'ticket' && x.fechaCreacionMs && x.fechaCreacionMs >= tInicio && x.fechaCreacionMs <= tFin);
  const ticketsCerradosSemana = todos.filter(x => x.tipo === 'ticket' && x.fechaCierreMs && x.fechaCierreMs >= tInicio && x.fechaCierreMs <= tFin);
  const osCerradasSemana = todos.filter(x => x.tipo === 'orden' && x.fechaCierreMs && x.fechaCierreMs >= tInicio && x.fechaCierreMs <= tFin);

  const elTktsAb = document.getElementById('resumen-kpi-tickets-abiertos');
  if (elTktsAb) elTktsAb.textContent = ticketsAbiertosSemana.length;
  const elTktsCe = document.getElementById('resumen-kpi-tickets-cerrados');
  if (elTktsCe) elTktsCe.textContent = ticketsCerradosSemana.length;
  const elOsCe = document.getElementById('resumen-kpi-os-cerradas');
  if (elOsCe) elOsCe.textContent = osCerradasSemana.length;

  // 2. BALANCE POR USUARIO
  const usuariosMap = {};
  const tecnicosSet = new Set();
  
  const tecs = _getTecnicosJunta();
  if (Array.isArray(tecs)) {
    tecs.forEach(t => {
      const u = _unify(t);
      if (u && u !== 'Sin Asignar' && u !== 'todos' && !u.includes(',') && !_esUsuarioPrueba(u)) {
        tecnicosSet.add(u);
        if (!usuariosMap[u]) usuariosMap[u] = { nombre: u, inicio: 0, entrantes: 0, cerrados: 0, fin: 0 };
      }
    });
  }

  function registrarActividadUsuario(uRaw, item) {
    if (!uRaw || uRaw === 'todos') return;
    const u = _unify(uRaw);
    if (!u || u === 'todos' || _esUsuarioPrueba(u)) return;

    if (u.includes(',')) {
      _extraerResponsablesIndividuales(u).forEach(subU => registrarActividadUsuario(subU, item));
      return;
    }

    if (!usuariosMap[u]) {
      usuariosMap[u] = { nombre: u, inicio: 0, entrantes: 0, cerrados: 0, fin: 0 };
    }

    const fCreac = item.fechaCreacionMs || 0;
    const fCierre = item.fechaCierreMs;

    // PENDIENTES AL INICIO DE LA SEMANA: Creados antes de tInicio Y (no cerrados aún O cerrados a partir de tInicio)
    const estabaAbiertoInicio = (fCreac < tInicio) && (!item.esCerrado || (fCierre && fCierre >= tInicio));
    if (estabaAbiertoInicio) {
      usuariosMap[u].inicio++;
    }

    // ENTRANTES EN LA SEMANA: Creados durante esta semana
    const fueCreadoEnSemana = (fCreac >= tInicio && fCreac <= tFin);
    if (fueCreadoEnSemana) {
      usuariosMap[u].entrantes++;
    }

    // RESUELTOS EN LA SEMANA: Cerrados durante esta semana
    const fueCerradoEnSemana = (item.esCerrado && fCierre && fCierre >= tInicio && fCierre <= tFin);
    if (fueCerradoEnSemana) {
      usuariosMap[u].cerrados++;
    }

    // PENDIENTES AL FINAL DE LA SEMANA: Creados antes o durante esta semana Y (no cerrados aún O cerrados después de tFin)
    const estabaAbiertoFin = (fCreac <= tFin) && (!item.esCerrado || (fCierre && fCierre > tFin));
    if (estabaAbiertoFin) {
      usuariosMap[u].fin++;
    }
  }

  todos.forEach(item => {
    const rawResps = (Array.isArray(item.responsables) && item.responsables.length > 0)
      ? item.responsables
      : [item.responsables || 'Sin Asignar'];
    const itemResps = _extraerResponsablesIndividuales(rawResps);
    const effectiveResps = itemResps.length > 0 ? itemResps : ['Sin Asignar'];

    effectiveResps.forEach(uRaw => {
      registrarActividadUsuario(uRaw, item);
    });
  });

  // Renderizar Tabla de Balance por Usuario (Excluye 'Sin Asignar' y usuarios de prueba)
  const listaUsuarios = Object.values(usuariosMap).filter(u => {
    if (!u || !u.nombre || u.nombre.includes(',') || _esUsuarioPrueba(u.nombre)) return false;
    if (u.nombre === 'Sin Asignar') return false;
    const tieneActividad = (u.inicio > 0 || u.entrantes > 0 || u.cerrados > 0 || u.fin > 0);
    if (tieneActividad) return true;
    return tecnicosSet.has(u.nombre);
  });
  listaUsuarios.sort((a, b) => b.fin - a.fin || b.inicio - a.inicio);

  let totInicio = 0, totEntrantes = 0, totCerrados = 0, totFin = 0;

  const tbodyUsers = document.getElementById('resumen-semanal-usuarios-tbody');
  if (tbodyUsers) {
    if (listaUsuarios.length === 0) {
      tbodyUsers.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.25rem; color:var(--text-muted);">Sin actividad de personal técnico en este período.</td></tr>';
    } else {
      tbodyUsers.innerHTML = listaUsuarios.map(u => {
        totInicio += u.inicio;
        totEntrantes += u.entrantes;
        totCerrados += u.cerrados;
        totFin += u.fin;

        const delta = u.fin - u.inicio;
        let deltaHtml = '<span style="color:var(--text-muted); font-weight:600;">0</span>';
        if (delta < 0) {
          deltaHtml = `<span style="color:#22c55e; font-weight:700;">${delta}</span>`;
        } else if (delta > 0) {
          deltaHtml = `<span style="color:#ef4444; font-weight:700;">+${delta}</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.65rem 0.85rem; font-weight: 600; color: var(--text);">${_escapeHTML(u.nombre)}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; background: rgba(0,0,0,0.02);">${u.inicio}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; color: #3b82f6;">+${u.entrantes}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; color: #22c55e;">-${u.cerrados}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 700; background: rgba(0,0,0,0.02);">${u.fin}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center;">${deltaHtml}</td>
          </tr>
        `;
      }).join('');

      const deltaTotal = totFin - totInicio;
      let deltaTotalHtml = '<span style="color:var(--text-muted); font-weight:700;">0</span>';
      if (deltaTotal < 0) deltaTotalHtml = `<span style="color:#22c55e; font-weight:800;">${deltaTotal}</span>`;
      else if (deltaTotal > 0) deltaTotalHtml = `<span style="color:#ef4444; font-weight:800;">+${deltaTotal}</span>`;

      tbodyUsers.innerHTML += `
        <tr style="background: var(--bg-body, #f1f5f9); font-weight: 800; border-top: 2px solid var(--border);">
          <td style="padding: 0.75rem 0.85rem;">TOTAL EQUIPO TÉCNICO</td>
          <td style="padding: 0.75rem 0.85rem; text-align: center;">${totInicio}</td>
          <td style="padding: 0.75rem 0.85rem; text-align: center; color: #3b82f6;">+${totEntrantes}</td>
          <td style="padding: 0.75rem 0.85rem; text-align: center; color: #22c55e;">-${totCerrados}</td>
          <td style="padding: 0.75rem 0.85rem; text-align: center;">${totFin}</td>
          <td style="padding: 0.75rem 0.85rem; text-align: center;">${deltaTotalHtml}</td>
        </tr>
      `;
    }
  }

  // 2.1 TABLA DEDICADA DE PENDIENTES SIN ASIGNAR
  const sinAsignarObj = usuariosMap['Sin Asignar'] || { nombre: 'Sin Asignar', inicio: 0, entrantes: 0, cerrados: 0, fin: 0 };
  const tbodySinAsignar = document.getElementById('resumen-semanal-sin-asignar-tbody');
  const elThSinAsignarFin = document.getElementById('th-resumen-semanal-sin-asignar-fin');
  if (elThSinAsignarFin) {
    elThSinAsignarFin.textContent = offsetSemanas === 0 ? 'Actualmente' : 'Fin Semana';
  }

  if (tbodySinAsignar) {
    const deltaSA = sinAsignarObj.fin - sinAsignarObj.inicio;
    let deltaHtmlSA = '<span style="color:var(--text-muted); font-weight:600;">0</span>';
    if (deltaSA < 0) {
      deltaHtmlSA = `<span style="color:#22c55e; font-weight:700;">${deltaSA}</span>`;
    } else if (deltaSA > 0) {
      deltaHtmlSA = `<span style="color:#ef4444; font-weight:700;">+${deltaSA}</span>`;
    }

    if (sinAsignarObj.inicio === 0 && sinAsignarObj.entrantes === 0 && sinAsignarObj.cerrados === 0 && sinAsignarObj.fin === 0) {
      tbodySinAsignar.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.25rem; color:var(--text-muted);">Sin elementos sin asignar en este período (100% asignados al equipo técnico).</td></tr>';
    } else {
      tbodySinAsignar.innerHTML = `
        <tr style="border-bottom: 1px solid var(--border); background: rgba(245, 158, 11, 0.04);">
          <td style="padding: 0.65rem 0.85rem; font-weight: 700; color: #d97706; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="help-circle" style="width: 16px; height: 16px;"></i> Tickets y Órdenes Sin Asignar
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; background: rgba(0,0,0,0.02);">${sinAsignarObj.inicio}</td>
          <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; color: #3b82f6;">+${sinAsignarObj.entrantes}</td>
          <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 600; color: #22c55e;">-${sinAsignarObj.cerrados}</td>
          <td style="padding: 0.65rem 0.85rem; text-align: center; font-weight: 700; background: rgba(0,0,0,0.02); color: #d97706;">${sinAsignarObj.fin}</td>
          <td style="padding: 0.65rem 0.85rem; text-align: center;">${deltaHtmlSA}</td>
        </tr>
      `;
    }
  }

  // KPI Balance Global Delta (Total sistema: equipo técnico + sin asignar)
  const totGlobalFin = totFin + sinAsignarObj.fin;
  const totGlobalInicio = totInicio + sinAsignarObj.inicio;
  const deltaTotalGlobal = totGlobalFin - totGlobalInicio;

  const elDeltaKpi = document.getElementById('resumen-kpi-variacion-neto');
  const elDeltaIconBg = document.getElementById('resumen-kpi-variacion-icon-bg');
  if (elDeltaKpi) {
    if (deltaTotalGlobal < 0) {
      elDeltaKpi.textContent = `${deltaTotalGlobal} Reducción`;
      elDeltaKpi.style.color = '#22c55e';
      if (elDeltaIconBg) { elDeltaIconBg.style.background = 'rgba(34, 197, 94, 0.1)'; elDeltaIconBg.style.color = '#22c55e'; }
    } else if (deltaTotalGlobal > 0) {
      elDeltaKpi.textContent = `+${deltaTotalGlobal} Acumulados`;
      elDeltaKpi.style.color = '#ef4444';
      if (elDeltaIconBg) { elDeltaIconBg.style.background = 'rgba(239, 68, 68, 0.1)'; elDeltaIconBg.style.color = '#ef4444'; }
    } else {
      elDeltaKpi.textContent = `0 Sin cambio`;
      elDeltaKpi.style.color = 'var(--text)';
      if (elDeltaIconBg) { elDeltaIconBg.style.background = 'rgba(100, 116, 139, 0.1)'; elDeltaIconBg.style.color = 'var(--text-muted)'; }
    }
  }

  // 3. ÓRDENES DE SERVICIO CERRADAS EN LA SEMANA
  const tbodyOS = document.getElementById('resumen-os-cerradas-tbody');
  const badgeOS = document.getElementById('resumen-os-badge');
  if (badgeOS) badgeOS.textContent = osCerradasSemana.length;

  if (tbodyOS) {
    if (osCerradasSemana.length === 0) {
      tbodyOS.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.25rem; color:var(--text-muted);">Sin órdenes cerradas en esta semana</td></tr>';
    } else {
      tbodyOS.innerHTML = osCerradasSemana.map(o => {
        const fechaStr = o.fechaCierreMs ? new Date(o.fechaCierreMs).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Reciente';
        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.5rem 0.75rem; font-weight: 700; color: var(--accent);">${_escapeHTML(o.folio)}</td>
            <td style="padding: 0.5rem 0.75rem;">${_escapeHTML(o.cliente)}</td>
            <td style="padding: 0.5rem 0.75rem; color: var(--text-muted);">${_escapeHTML(o.equipo)}</td>
            <td style="padding: 0.5rem 0.75rem; font-weight: 600; color: #22c55e;">${fechaStr}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. RENDERIZAR GRÁFICAS ANALÍTICAS
  try {
    renderizarGraficasResumenSemanal(listaUsuarios, ticketsAbiertosSemana.length, ticketsCerradosSemana.length, osCerradasSemana.length);
  } catch(errG) {
    console.warn('Error al renderizar gráficas del resumen semanal:', errG);
  }

  // Cache para las pestañas de tickets
  _resumenSemanalCacheData = {
    ticketsAbiertos: ticketsAbiertosSemana,
    ticketsCerrados: ticketsCerradosSemana
  };

  setResumenTicketTab(_resumenSemanalTicketTab || 'cerrados');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    setTimeout(() => lucide.createIcons(), 50);
  }
};

let _resumenChartBarras = null;
let _resumenChartDonut = null;

function renderizarGraficasResumenSemanal(listaUsuarios, ticketsAbiertosCount, ticketsCerradosCount, osCerradasCount) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no está cargado');
    return;
  }

  if (_resumenChartBarras) {
    _resumenChartBarras.destroy();
    let _resumenChartBarras = null;
  }
  if (_resumenChartDonut) {
    _resumenChartDonut.destroy();
    let _resumenChartDonut = null;
  }

  // 1. GRÁFICA BARRAS POR USUARIO
  const canvasBarras = document.getElementById('chart-resumen-usuarios-barras');
  if (canvasBarras && listaUsuarios && listaUsuarios.length > 0) {
    const topUsuarios = [...listaUsuarios].sort((a, b) => b.fin - a.fin).slice(0, 10);
    const labels = topUsuarios.map(u => u.nombre.length > 18 ? u.nombre.substring(0, 16) + '...' : u.nombre);
    const dataInicio = topUsuarios.map(u => u.inicio);
    const dataEntrantes = topUsuarios.map(u => u.entrantes);
    const dataCerrados = topUsuarios.map(u => u.cerrados);
    const dataActual = topUsuarios.map(u => u.fin);

    const ctxBarras = canvasBarras.getContext('2d');
    _resumenChartBarras = new Chart(ctxBarras, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Inicio Semana',
            data: dataInicio,
            backgroundColor: 'rgba(148, 163, 184, 0.65)',
            borderColor: '#94a3b8',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '+ Entrantes',
            data: dataEntrantes,
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '- Cerrados',
            data: dataCerrados,
            backgroundColor: 'rgba(34, 197, 94, 0.75)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Actualmente / Fin',
            data: dataActual,
            backgroundColor: 'rgba(234, 179, 8, 0.85)',
            borderColor: '#eab308',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 10, weight: '600' } }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 9.5 } }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { size: 10 } }
          }
        }
      }
    });
  }

  // 2. GRÁFICA DONUT MOVIMIENTO SEMANAL
  const canvasDonut = document.getElementById('chart-resumen-movimiento-donut');
  if (canvasDonut) {
    const ctxDonut = canvasDonut.getContext('2d');
    const totalMov = ticketsAbiertosCount + ticketsCerradosCount + osCerradasCount;

    _resumenChartDonut = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Tickets Abiertos', 'Tickets Cerrados', 'Órdenes OS Cerradas'],
        datasets: [{
          data: totalMov > 0 ? [ticketsAbiertosCount, ticketsCerradosCount, osCerradasCount] : [0, 0, 0],
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)',
            'rgba(34, 197, 94, 0.85)',
            'rgba(168, 85, 247, 0.85)'
          ],
          borderColor: [
            '#3b82f6',
            '#22c55e',
            '#a855f7'
          ],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 10.5, weight: '600' }, padding: 12 }
          }
        },
        cutout: '65%'
      }
    });
  }
}

function setResumenTicketTab(tab) {
  _resumenSemanalTicketTab = tab; if (typeof window !== 'undefined') _resumenSemanalTicketTab = tab;

  const btnCerrados = document.getElementById('tab-btn-tickets-cerrados');
  const btnAbiertos = document.getElementById('tab-btn-tickets-abiertos');

  if (btnCerrados) {
    btnCerrados.className = tab === 'cerrados' ? 'btn-primary' : 'btn-secondary';
    btnCerrados.style.background = tab === 'cerrados' ? 'var(--accent)' : 'transparent';
    btnCerrados.style.color = tab === 'cerrados' ? 'white' : 'var(--text)';
  }
  if (btnAbiertos) {
    btnAbiertos.className = tab === 'abiertos' ? 'btn-primary' : 'btn-secondary';
    btnAbiertos.style.background = tab === 'abiertos' ? 'var(--accent)' : 'transparent';
    btnAbiertos.style.color = tab === 'abiertos' ? 'white' : 'var(--text)';
  }

  const tbody = document.getElementById('resumen-tickets-tbody');
  if (!tbody) return;

  const cache = _resumenSemanalCacheData || { ticketsAbiertos: [], ticketsCerrados: [] };
  const lista = tab === 'abiertos' ? cache.ticketsAbiertos : cache.ticketsCerrados;

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.25rem; color:var(--text-muted);">Sin tickets ${tab === 'abiertos' ? 'abiertos' : 'cerrados'} en esta semana</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(t => {
    const fMs = tab === 'abiertos' ? t.fechaCreacionMs : t.fechaCierreMs;
    const fechaStr = fMs ? new Date(fMs).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Semana';
    const respStr = t.responsables.join(', ');

    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 0.5rem 0.75rem; font-weight: 700; color: var(--accent);">${_escapeHTML(t.folio)}</td>
        <td style="padding: 0.5rem 0.75rem;">
          <div style="font-weight: 600; color: var(--text);">${_escapeHTML(t.cliente)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${_escapeHTML(t.titulo)}</div>
        </td>
        <td style="padding: 0.5rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">${_escapeHTML(respStr)}</td>
        <td style="padding: 0.5rem 0.75rem; font-weight: 600; color: ${tab === 'abiertos' ? '#3b82f6' : '#22c55e'};">${fechaStr}</td>
      </tr>
    `;
  }).join('');
};

// Exponer funciones en window para retrocompatibilidad total
if (typeof window !== "undefined") {
  window._resumenSemanalOffset = _resumenSemanalOffset;
  window._resumenSemanalTicketTab = _resumenSemanalTicketTab;
  window._resumenSemanalCacheData = _resumenSemanalCacheData;
  window._resumenChartBarras = _resumenChartBarras;
  window._resumenChartDonut = _resumenChartDonut;
  window._extraerResponsablesIndividuales = _extraerResponsablesIndividuales;
  window.abrirModalResumenSemanal = abrirModalResumenSemanal;
  window.cerrarModalResumenSemanal = cerrarModalResumenSemanal;
  window.obtenerRangoSemana = obtenerRangoSemana;
  window.parseFechaResumenMs = parseFechaResumenMs;
  window.obtenerTodosLosElementosGlobales = obtenerTodosLosElementosGlobales;
  window.cargarResumenSemanal = cargarResumenSemanal;
  window.renderizarGraficasResumenSemanal = renderizarGraficasResumenSemanal;
  window.setResumenTicketTab = setResumenTicketTab;
}

export {
  _resumenSemanalOffset,
  _resumenSemanalTicketTab,
  _resumenSemanalCacheData,
  _resumenChartBarras,
  _resumenChartDonut,
  _extraerResponsablesIndividuales,
  abrirModalResumenSemanal,
  cerrarModalResumenSemanal,
  obtenerRangoSemana,
  parseFechaResumenMs,
  obtenerTodosLosElementosGlobales,
  cargarResumenSemanal,
  renderizarGraficasResumenSemanal,
  setResumenTicketTab
};
