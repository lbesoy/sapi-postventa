/**
 * Módulo de Juntas de Revisión, Panel Operativo Semanal y Rescate Histórico - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */


function _safeGet(key, fallback) {
  if (typeof safeGetJSON === 'function') return safeGetJSON(key, fallback);
  if (typeof window !== 'undefined' && typeof window.safeGetJSON === 'function') return window.safeGetJSON(key, fallback);
  if (typeof localStorage !== 'undefined') {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch(e) { return fallback; }
  }
  return fallback;
}
import { cleanMojibake, normStr, safeFormatDate, formatFechaHoraAmigable, urlToDataUri, escapeHTML, calcularDiasJunta, formatearTiempoRelativoJunta, normalizarTextoJunta, unificarNombreUsuario, obtenerInfoRolUsuario, extraerListaResponsables } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";

function _escapeHTML(str) {
  if (typeof escapeHTML === 'function') return escapeHTML(str);
  if (typeof window !== 'undefined' && typeof window.escapeHTML === 'function') return window.escapeHTML(str);
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function _calcularDiasJunta(fechaStr) {
  if (typeof calcularDiasJunta === 'function') return calcularDiasJunta(fechaStr);
  if (typeof window !== 'undefined' && typeof window.calcularDiasJunta === 'function') return window.calcularDiasJunta(fechaStr);
  if (!fechaStr) return 0;
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((new Date() - d) / (1000 * 60 * 60 * 24)));
  } catch(e) { return 0; }
}

function _formatearTiempoRelativoJunta(dias, fechaStr) {
  if (typeof formatearTiempoRelativoJunta === 'function') return formatearTiempoRelativoJunta(dias, fechaStr);
  if (typeof window !== 'undefined' && typeof window.formatearTiempoRelativoJunta === 'function') return window.formatearTiempoRelativoJunta(dias, fechaStr);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer (1 día)';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return `Hace ${dias} días (1 sem)`;
  if (dias < 30) return `Hace ${dias} días (${Math.floor(dias/7)} sem)`;
  return `Hace ${dias} días (${Math.floor(dias/30)} meses)`;
}

function _normalizarTextoJunta(str) {
  if (typeof normalizarTextoJunta === 'function') return normalizarTextoJunta(str);
  if (typeof window !== 'undefined' && typeof window.normalizarTextoJunta === 'function') return window.normalizarTextoJunta(str);
  return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function _unificarNombreUsuario(rawNombre) {
  if (typeof unificarNombreUsuario === 'function') return unificarNombreUsuario(rawNombre);
  if (typeof window !== 'undefined' && typeof window.unificarNombreUsuario === 'function') return window.unificarNombreUsuario(rawNombre);
  return String(rawNombre || 'Sin Asignar').trim();
}

function _obtenerInfoRolUsuario(nombre) {
  if (typeof obtenerInfoRolUsuario === 'function') return obtenerInfoRolUsuario(nombre);
  if (typeof window !== 'undefined' && typeof window.obtenerInfoRolUsuario === 'function') return window.obtenerInfoRolUsuario(nombre);
  return { rol: 'tecnico', label: 'Técnico', color: '#10b981', icon: 'wrench' };
}

function _extraerListaResponsables(raw) {
  if (typeof extraerListaResponsables === 'function') return extraerListaResponsables(raw);
  if (typeof window !== 'undefined' && typeof window.extraerListaResponsables === 'function') return window.extraerListaResponsables(raw);
  if (!raw) return ['Sin Asignar'];
  const parts = String(raw).trim().split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['Sin Asignar'];
}

/**
 * Módulo de Juntas de Revisión, Panel Operativo Semanal y Rescate Histórico - Eurorep / SAPI
 * Cubre análisis de cuellos de botella, tabla de responsables, modo proyector/pantalla completa,
 * filtros por causa, reasignación rápida de técnicos, notas rápidas y minuta para portapapeles.
 */
// ===== RESTABLECER TICKET TKT-26477 Y SU ORDEN DE SERVICIO (RUBBLE MASTER HMH GMB) =====
async function reestablecerTicket26477() {
  try {
    let tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];
    if (tkts.length === 0) {
      try {
        tkts = (typeof safeGetJSON === 'function') ? _safeGet('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]');
      } catch (e) { tkts = []; }
    }
    
    let t = tkts.find(x => x && (x.folio === 'TKT-26477' || x.id === '48c975ea-de3d-4857-bc2f-3bc98569f708' || String(x.folio || '').includes('26477')));
    
    let ords = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes : [];
    if (ords.length === 0) {
      try {
        ords = (typeof safeGetJSON === 'function') ? _safeGet('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      } catch (e) { ords = []; }
    }

    let ord = ords.find(o => o && (o.id === 'OS-26256' || o.folio === 'OS-26256' || o.soporte === 'TKT-26477' || (t && o.soporte === t.id) || String(o.folio || '').includes('26256') || (t && t.ordenId && o.id === t.ordenId)));

    let ticketUpdated = false;
    let ordUpdated = false;

    if (t) {
      const clienteEsperado = 'RUBBLE MASTER HMH GMB';
      const sitioEsperado = 'San Jose del Marques, Hidalgo';
      const catEsperada = 'Servicio Técnico';
      const tecEsperado = 'Juan carlos Ramírez';

      if (t.cliente !== clienteEsperado || t.sitio !== sitioEsperado || t.categoria !== catEsperada || t.asignado !== tecEsperado) {
        t.cliente = clienteEsperado;
        t.sitio = sitioEsperado;
        t.categoria = catEsperada;
        t.asignado = tecEsperado;
        t.tecnicosAsignados = [tecEsperado];
        t.modificadoPor = 'Rodrigo Alonso Narvaez';
        t.fechaModificacion = '2026-09-30T16:41:00.000Z';
        t.updated_at = new Date().toISOString();
        t._synced = false;
        ticketUpdated = true;
      }
    }

    if (ord) {
      const clienteEsperado = 'RUBBLE MASTER HMH GMB';
      const ubicacionEsperada = 'San Jose del Marques, Hidalgo';
      const tecEsperado = 'Juan carlos Ramírez';

      if (ord.cliente !== clienteEsperado || ord.ubicacion !== ubicacionEsperada || ord.tecnico !== tecEsperado) {
        ord.cliente = clienteEsperado;
        ord.ubicacion = ubicacionEsperada;
        ord.tipo = 'Servicio';
        ord.tecnico = tecEsperado;
        ord.tecnicosAsignados = [tecEsperado];
        if (t) {
          ord.soporte = t.id || t.folio;
          t.ordenId = ord.id;
          t.ordenFolio = ord.folio;
        }
        ord._synced = false;
        ordUpdated = true;
      }
    }

    if (ticketUpdated) {
      if (typeof tickets !== 'undefined' && Array.isArray(tickets)) {
        tickets = tkts;
      }
      safeSetJSON('sapi_tickets', tkts);
      if (window.supabaseClient) {
        try {
          await window.pushToSupabase('tickets', t);
        } catch (e) {
          console.warn('[Patch] Error al persistir TKT-26477 en Supabase:', e);
        }
      }
    }

    if (ordUpdated) {
      if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
        ordenes = ords;
      }
      safeSetJSON('sapi_ordenes', ords);
      if (window.supabaseClient) {
        try {
          await window.pushToSupabase('ordenes', ord);
        } catch (e) {
          console.warn('[Patch] Error al persistir orden OS-26256 en Supabase:', e);
        }
      }
    }

    if (ticketUpdated || ordUpdated) {
      console.log('[Patch] TKT-26477 y su Orden de Servicio reestablecidos a RUBBLE MASTER HMH GMB.');
      if (typeof renderTickets === 'function') renderTickets();
      if (typeof renderTabla === 'function') renderTabla('servicios');
    }
  } catch (err) {
    console.warn('[Patch] Error en reestablecerTicket26477:', err);
  }
};

// Obtiene supervisores y coordinadores activos disponibles para asignación de tickets
function obtenerListaSupervisoresJunta() {
  const lista = [];
  const nombresSet = new Set();

  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    usuarios.forEach(u => {
      if (!u || !u.nombre || u.activo === false) return;
      if (!['supervisor', 'admin', 'superadmin'].includes(u.rol)) return;
      if (typeof isTestModeActive === 'function' && isTestModeActive()) {
        // En modo pruebas permitimos
      } else if (typeof isTestUser === 'function' && isTestUser(u)) {
        return;
      }
      u.nombre.split(/[,;/]+/).forEach(part => {
        const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(part.trim()) : part.trim();
        if (n && n !== '-' && n.toLowerCase() !== 'sin asignar' && !nombresSet.has(n)) {
          nombresSet.add(n);
          lista.push(n);
        }
      });
    });
  }

  return lista.sort((a, b) => a.localeCompare(b));
};

// Obtiene todos los técnicos y operativos activos disponibles para órdenes y levantamientos
function obtenerListaTecnicosJunta() {
  const lista = [];
  const nombresSet = new Set();

  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) {
    tecnicosDb.forEach(t => {
      if (t && t.nombre) {
        t.nombre.split(/[,;/]+/).forEach(part => {
          const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(part.trim()) : part.trim();
          if (n && n !== '-' && n.toLowerCase() !== 'sin asignar' && !nombresSet.has(n)) {
            nombresSet.add(n);
            lista.push(n);
          }
        });
      }
    });
  }

  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    usuarios.forEach(u => {
      if (!u || !u.nombre || u.activo === false) return;
      if (!['tecnico', 'supervisor'].includes(u.rol)) return;
      if (typeof isTestModeActive === 'function' && isTestModeActive()) {
        // En modo pruebas permitimos
      } else if (typeof isTestUser === 'function' && isTestUser(u)) {
        return;
      }
      u.nombre.split(/[,;/]+/).forEach(part => {
        const n = (typeof formatNombreCorto === 'function') ? formatNombreCorto(part.trim()) : part.trim();
        if (n && n !== '-' && n.toLowerCase() !== 'sin asignar' && !nombresSet.has(n)) {
          nombresSet.add(n);
          lista.push(n);
        }
      });
    });
  }

  return lista.sort((a, b) => a.localeCompare(b));
};

// Obtiene todos los pendientes consolidados de tickets, órdenes, envíos y levantamientos
function obtenerTodosLosPendientes() {
  if (typeof window.sanitizarAsignacionesTickets === 'function') {
    window.sanitizarAsignacionesTickets();
  }

  const lista = [];

  // 1. TICKETS ABIERTOS / PENDIENTES
  const tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets)) ? tickets : [];
  tkts.forEach(t => {
    if (!t) return;
    if (t.estado === 'Cerrado' || t.estado === 'Cancelado') return;
    
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      if (isTestData(t) !== isTestModeActive()) return;
    }

    const fechaCreacion = t.fechaCreacion || t.fecha || t.created_at || '';
    const dias = calcularDiasJunta(fechaCreacion);
    
    let cuelloDeBotella = '';
    let cuelloNivel = 'normal';
    let tipoEspecifico = 'Ticket';
    let causaId = 'en_diagnostico';

    const montoVal = Number(t.montoCotizacion || t.monto || 0);

    if (t.estado === 'Cotización' || t.categoria === 'Refacción' || t.requiereCotizacion) {
      tipoEspecifico = 'Cotización';
      if (!t.cotizacionSAP) {
        cuelloDeBotella = 'Falta generar / capturar cotización en SAP';
        cuelloNivel = 'warning';
        causaId = 'cotizacion_pendiente_generar';
      } else if (!t.cotAceptada || t.cotAceptada === 'pendiente') {
        const montoStr = montoVal > 0 ? ` ($${new Intl.NumberFormat('es-MX').format(montoVal)})` : '';
        cuelloDeBotella = `Cotización SAP #${t.cotizacionSAP} enviada${montoStr}: pendiente decisión / OC de cliente`;
        cuelloNivel = 'normal';
        causaId = 'cotizacion_espera_cliente';
      } else if (t.cotAceptada === 'si') {
        cuelloDeBotella = 'Cotización aceptada: pendiente de generar OS o enviar refacciones';
        cuelloNivel = 'warning';
        causaId = 'refaccion_proveedor';
      }
    } else if (t.estado === 'Abierto') {
      if (!t.asignado && !t.asignadoA) {
        cuelloDeBotella = 'Ticket abierto: supervisor / responsable sin asignar';
        cuelloNivel = 'warning';
        causaId = 'sin_asignar';
      } else {
        cuelloDeBotella = 'Ticket abierto: en espera de diagnóstico inicial';
        cuelloNivel = 'normal';
        causaId = 'en_diagnostico';
      }
    } else if (t.estado === 'En Proceso' || t.estado === 'En Espera') {
      if (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
        cuelloDeBotella = `En espera de refacciones (${t.refaccionesSeleccionadas.length} piezas)`;
        cuelloNivel = 'warning';
        causaId = 'refaccion_proveedor';
      } else {
        cuelloDeBotella = 'En proceso de atención técnica';
        cuelloNivel = 'normal';
        causaId = 'en_diagnostico';
      }
    } else {
      cuelloDeBotella = `Estado: ${t.estado}`;
      causaId = 'en_diagnostico';
    }

    if (dias >= 14) {
      cuelloNivel = 'danger';
    } else if (dias >= 7 && cuelloNivel !== 'danger') {
      cuelloNivel = 'warning';
    }

    let ultimoComentario = null;
    if (t.comentariosInternos && Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
      const c = t.comentariosInternos[t.comentariosInternos.length - 1];
      if (c && c.texto && String(c.texto).trim()) {
        ultimoComentario = {
          usuario: c.usuario || 'Staff',
          fecha: c.fecha || '',
          texto: String(c.texto).trim()
        };
      }
    }

    // Responsable asignado del ticket (preservar nombre sin borrarlo)
    const rawParts = extraerListaResponsables(t.asignado || t.asignadoA || t.supervisor || (Array.isArray(t.tecnicosAsignados) && t.tecnicosAsignados.length > 0 ? t.tecnicosAsignados.join(', ') : '') || t.tecnico || '');
    const listaResp = rawParts.length > 0 ? rawParts : ['Sin Asignar'];

    const assocOrder = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
    const parentTicket = !assocOrder && typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;

    const clienteDisplay = t.cliente || (parentTicket && parentTicket.cliente ? parentTicket.cliente : (assocOrder && assocOrder.cliente ? assocOrder.cliente : 'Sin Cliente'));
    const sitioDisplay = t.sitio || (parentTicket && parentTicket.sitio ? parentTicket.sitio : (assocOrder && (assocOrder.ubicacion || assocOrder.ubicacion_sitio) ? (assocOrder.ubicacion || assocOrder.ubicacion_sitio) : 'General'));

    let serieValTkt = t.serie || t.numeroSerie || t.serie_equipo || t.noSerie || t.numero_serie || t.maquinaSerie || (parentTicket && parentTicket.serie ? parentTicket.serie : (assocOrder && assocOrder.serie ? assocOrder.serie : ''));
    let equipoValTkt = t.maquina || t.equipo || t.numeroEconomico || t.noEconomico || t.modelo || (parentTicket && parentTicket.equipo ? parentTicket.equipo : (assocOrder && assocOrder.equipo ? assocOrder.equipo : ''));
    
    if (!serieValTkt && equipoValTkt && equipoValTkt.includes('(SN: ')) {
      const parts = equipoValTkt.split('(SN: ');
      if (parts[1]) {
        serieValTkt = parts[1].replace(')', '').trim();
        equipoValTkt = parts[0].trim();
      }
    }
    
    if ((!serieValTkt || !equipoValTkt) && (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb))) {
      const match = maquinariaDb.find(m => 
        (t.maquinaId && (m.id === t.maquinaId || m.idInterno === t.maquinaId)) ||
        (equipoValTkt && (m.idInterno === equipoValTkt || m.modelo === equipoValTkt || m.serie === equipoValTkt || m.numeroEconomico === equipoValTkt)) ||
        (clienteDisplay && m.cliente === clienteDisplay && (m.idInterno === equipoValTkt || m.modelo === equipoValTkt))
      );
      if (match) {
        if (!serieValTkt && match.serie && match.serie !== 'N/A') serieValTkt = match.serie;
        if (!equipoValTkt) equipoValTkt = match.numeroEconomico || match.modelo || match.idInterno || '';
      }
    }

    lista.push({
      id: t.id,
      tipo: 'ticket',
      tipoLabel: tipoEspecifico === 'Cotización' ? 'Cotización' : 'Ticket',
      tipoEspecifico: tipoEspecifico,
      tipoIcon: tipoEspecifico === 'Cotización' ? 'receipt' : 'ticket',
      tipoColor: tipoEspecifico === 'Cotización' ? '#3b82f6' : '#8b5cf6',
      folio: t.folio || `TKT-${t.id}`,
      titulo: t.asunto || t.titulo || 'Ticket de servicio',
      cliente: clienteDisplay,
      sitio: sitioDisplay,
      equipo: equipoValTkt,
      serie: serieValTkt,
      responsable: listaResp.join(', '),
      responsablesList: listaResp,
      prioridad: t.prioridad || (dias > 7 ? 'Alta' : 'Media'),
      estado: t.estado || 'Abierto',
      fecha: fechaCreacion,
      fechaCompromiso: t.fechaCompromiso || null,
      diasAntiguedad: dias,
      monto: montoVal,
      refaccionesCount: (t.refaccionesSeleccionadas || []).length,
      tiempoRelativo: formatearTiempoRelativoJunta(dias, fechaCreacion),
      cuelloDeBotella: cuelloDeBotella,
      cuelloNivel: cuelloNivel,
      causaId: causaId,
      ultimoComentario: ultimoComentario,
      comentariosCount: (t.comentariosInternos || []).length,
      rawItem: t
    });
  });

  // 2. ÓRDENES DE SERVICIO PENDIENTES
  const ords = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes : [];
  ords.forEach(o => {
    if (!o) return;
    if (o.estado === 'Cerrada' || o.estado === 'Cancelada') return;
    
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      if (isTestData(o) !== isTestModeActive()) return;
    }

    const fechaCreacion = o.fecha_creacion || o.fecha || o.created_at || '';
    const dias = calcularDiasJunta(fechaCreacion);

    const faltaFirmaTecnico = !o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__';
    const faltaFirmaCliente = !o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__';
    const faltaBitacora = !o.bitacora || !String(o.bitacora).trim();
    const tieneRefNecesarias = Array.isArray(o.ref_necesarias) && o.ref_necesarias.length > 0;
    const refCount = tieneRefNecesarias ? o.ref_necesarias.length : 0;

    let cuelloDeBotella = '';
    let cuelloNivel = 'normal';
    let causaId = 'en_diagnostico';

    if (faltaFirmaTecnico && faltaFirmaCliente) {
      cuelloDeBotella = 'Faltan firmas de Técnico y de Cliente para validar servicio';
      cuelloNivel = 'warning';
      causaId = 'falta_firma';
    } else if (faltaFirmaCliente) {
      cuelloDeBotella = 'Falta firma / conformidad del Cliente';
      cuelloNivel = 'warning';
      causaId = 'falta_firma';
    } else if (faltaFirmaTecnico) {
      cuelloDeBotella = 'Falta firma del Técnico responsable';
      cuelloNivel = 'warning';
      causaId = 'falta_firma';
    } else if (faltaBitacora) {
      cuelloDeBotella = 'Bitácora técnica vacía o sin reporte capturado';
      cuelloNivel = 'warning';
      causaId = 'en_diagnostico';
    } else if (tieneRefNecesarias) {
      cuelloDeBotella = `Requiere refacciones pendientes (${o.ref_necesarias.length} piezas)`;
      cuelloNivel = 'warning';
      causaId = 'refaccion_proveedor';
    } else if (!o.tecnico || o.tecnico === 'Sin asignar' || o.tecnico === '-') {
      cuelloDeBotella = 'Técnico sin asignar para ejecutar orden';
      cuelloNivel = 'warning';
      causaId = 'sin_asignar';
    } else {
      cuelloDeBotella = `Orden en estado "${o.estado || 'Abierta'}" en ejecución`;
      cuelloNivel = 'normal';
      causaId = 'en_diagnostico';
    }

    if (dias >= 14) {
      cuelloNivel = 'danger';
    } else if (dias >= 7 && cuelloNivel !== 'danger') {
      cuelloNivel = 'warning';
    }

    const responsableRaw = (Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.length > 0)
      ? o.tecnicosAsignados.join(', ')
      : (o.tecnico || 'Sin Asignar');
    const listaResp = extraerListaResponsables(responsableRaw);

    let serieValOrd = o.serie || o.no_serie || o.numero_serie || o.serie_equipo || '';
    let equipoValOrd = o.numero_economico || o.equipo || o.maquina || o.modelo || '';

    if (!serieValOrd && equipoValOrd && equipoValOrd.includes('(SN: ')) {
      const parts = equipoValOrd.split('(SN: ');
      if (parts[1]) {
        serieValOrd = parts[1].replace(')', '').trim();
        equipoValOrd = parts[0].trim();
      }
    }

    if ((!serieValOrd || !equipoValOrd) && (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb))) {
      const match = maquinariaDb.find(m => 
        (o.maquinaria_id && (m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id)) ||
        (equipoValOrd && (m.idInterno === equipoValOrd || m.modelo === equipoValOrd || m.serie === equipoValOrd || m.numeroEconomico === equipoValOrd)) ||
        (o.cliente && m.cliente === o.cliente && (m.idInterno === equipoValOrd || m.modelo === equipoValOrd))
      );
      if (match) {
        if (!serieValOrd && match.serie && match.serie !== 'N/A') serieValOrd = match.serie;
        if (!equipoValOrd) equipoValOrd = match.numeroEconomico || match.modelo || match.idInterno || '';
      }
    }

    lista.push({
      id: o.id,
      tipo: 'orden',
      tipoLabel: 'Órden de Servicio',
      tipoEspecifico: 'Órden',
      tipoIcon: 'clipboard-list',
      tipoColor: '#10b981',
      folio: o.folio || `OS-${o.id}`,
      titulo: o.tipo_servicio ? `${o.tipo_servicio}: ${o.falla_reportada || o.trabajo_realizado || 'Servicio de campo'}` : (o.falla_reportada || o.trabajo_realizado || 'Servicio de campo'),
      cliente: o.cliente || 'Sin Cliente',
      sitio: o.sitio || o.ubicacion || 'General',
      equipo: equipoValOrd,
      serie: serieValOrd,
      responsable: listaResp.join(', '),
      responsablesList: listaResp,
      prioridad: o.prioridad || (dias > 7 ? 'Alta' : 'Media'),
      estado: o.estado || 'Abierta',
      fecha: fechaCreacion,
      fechaCompromiso: o.fechaCompromiso || null,
      diasAntiguedad: dias,
      monto: Number(o.monto || o.monto_total || 0),
      refaccionesCount: refCount,
      tiempoRelativo: formatearTiempoRelativoJunta(dias, fechaCreacion),
      cuelloDeBotella: cuelloDeBotella,
      cuelloNivel: cuelloNivel,
      causaId: causaId,
      ultimoComentario: null,
      comentariosCount: 0,
      rawItem: o
    });
  });

  // 3. ENVÍOS PENDIENTES
  if (typeof window.obtenerTodosLosEnvios === 'function') {
    const envs = window.obtenerTodosLosEnvios();
    envs.forEach(e => {
      if (!e) return;
      if (e.estatus === 'Entregado' || e.llego) return;

      const fechaEnvio = e.fechaEnvio || e.fechaPedido || '';
      const dias = calcularDiasJunta(fechaEnvio);

      let cuelloDeBotella = '';
      let cuelloNivel = 'normal';
      let causaId = 'envio_sin_guia';

      if (!e.guiaPedido || !String(e.guiaPedido).trim()) {
        cuelloDeBotella = `Guía pendiente de registrar (${e.paqueteria || 'Paquetería'})`;
        cuelloNivel = 'warning';
        causaId = 'envio_sin_guia';
      } else {
        cuelloDeBotella = `En camino con ${e.paqueteria || 'Paquetería'} (Guía: ${e.guiaPedido})`;
        cuelloNivel = 'normal';
        causaId = 'refaccion_proveedor';
      }

      if (dias >= 7) {
        cuelloNivel = 'danger';
        cuelloDeBotella += ` - ¡Posible rezago de paquetería! (${dias} días)`;
      }

      const partesTexto = (Array.isArray(e.parts) && e.parts.length > 0)
        ? e.parts.map(p => `${p.cantidad || 1}x ${p.descripcion || p.codigo || 'Pieza'}`).join(', ')
        : 'Refacciones varias';

      const responsableRaw = e.paqueteria || 'Logística';
      const listaResp = extraerListaResponsables(responsableRaw);

      lista.push({
        id: e.id,
        tipo: 'envio',
        tipoLabel: 'Envío',
        tipoEspecifico: 'Envío',
        tipoIcon: 'truck',
        tipoColor: '#f59e0b',
        folio: e.guiaPedido ? `GUÍA: ${e.guiaPedido}` : `ENV-${String(e.id).substring(0,8)}`,
        titulo: `Refacciones para ${e.ticketFolio || 'Ticket'}: ${partesTexto}`,
        cliente: e.cliente || 'Sin Cliente',
        sitio: e.sitio || 'General',
        equipo: e.equipo || '',
        serie: e.serie || '',
        responsable: listaResp.join(', '),
        responsablesList: listaResp,
        prioridad: dias > 5 ? 'Alta' : 'Media',
        estado: e.estatus || 'En Tránsito',
        fecha: fechaEnvio,
        fechaCompromiso: e.fechaCompromiso || null,
        diasAntiguedad: dias,
        monto: 0,
        refaccionesCount: (e.parts || []).length,
        tiempoRelativo: formatearTiempoRelativoJunta(dias, fechaEnvio),
        cuelloDeBotella: cuelloDeBotella,
        cuelloNivel: cuelloNivel,
        causaId: causaId,
        ultimoComentario: null,
        comentariosCount: 0,
        rawItem: e
      });
    });
  }

  // 4. LEVANTAMIENTOS ABIERTOS
  const levs = (typeof levantamientos !== 'undefined' && Array.isArray(levantamientos)) ? levantamientos : (_safeGet('sapi_levantamientos', []));
  levs.forEach(l => {
    if (!l) return;
    if (l.estado === 'Completado' || l.estado === 'Cerrado' || l.estado === 'Cancelado') return;
    
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      if (isTestData(l) !== isTestModeActive()) return;
    }

    const fechaCreacion = l.created_at || l.fecha_esperada || '';
    const dias = calcularDiasJunta(fechaCreacion);

    let cuelloDeBotella = '';
    let cuelloNivel = 'normal';
    let causaId = 'en_diagnostico';

    if (!l.tecnico_asignado || l.tecnico_asignado === '-' || l.tecnico_asignado === 'Sin asignar') {
      cuelloDeBotella = 'Levantamiento nuevo: técnico sin asignar';
      cuelloNivel = 'warning';
      causaId = 'sin_asignar';
    } else if (l.estado === 'Por Cotizar' || l.estado === 'Pendiente') {
      cuelloDeBotella = 'Pendiente de cotizar refacciones en SAP';
      cuelloNivel = 'warning';
      causaId = 'cotizacion_pendiente_generar';
    } else if (l.estado === 'Cotizado') {
      cuelloDeBotella = 'Cotización enviada a cliente: en espera de confirmación';
      cuelloNivel = 'normal';
      causaId = 'cotizacion_espera_cliente';
    } else {
      cuelloDeBotella = `Estado del levantamiento: ${l.estado || 'Pendiente'}`;
      cuelloNivel = 'normal';
      causaId = 'en_diagnostico';
    }

    if (dias >= 14) {
      cuelloNivel = 'danger';
    } else if (dias >= 7 && cuelloNivel !== 'danger') {
      cuelloNivel = 'warning';
    }

    const responsableRaw = l.tecnico_asignado || l.solicitante || 'Sin Asignar';
    const listaResp = extraerListaResponsables(responsableRaw);

    let serieValLev = l.serie || l.no_serie || l.numero_serie || l.serie_equipo || l.maquina_serie || '';
    let equipoValLev = l.maquina || l.equipo || l.modelo || l.numero_economico || '';

    if (!serieValLev && equipoValLev && equipoValLev.includes('(SN: ')) {
      const parts = equipoValLev.split('(SN: ');
      if (parts[1]) {
        serieValLev = parts[1].replace(')', '').trim();
        equipoValLev = parts[0].trim();
      }
    }

    if ((!serieValLev || !equipoValLev) && (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb))) {
      const match = maquinariaDb.find(m => 
        (equipoValLev && (m.idInterno === equipoValLev || m.modelo === equipoValLev || m.serie === equipoValLev || m.numeroEconomico === equipoValLev)) ||
        (l.cliente && m.cliente === l.cliente && (m.idInterno === equipoValLev || m.modelo === equipoValLev))
      );
      if (match) {
        if (!serieValLev && match.serie && match.serie !== 'N/A') serieValLev = match.serie;
        if (!equipoValLev) equipoValLev = match.numeroEconomico || match.modelo || match.idInterno || '';
      }
    }

    lista.push({
      id: l.id,
      tipo: 'levantamiento',
      tipoLabel: 'Levantamiento',
      tipoEspecifico: 'Levantamiento',
      tipoIcon: 'clipboard-check',
      tipoColor: '#06b6d4',
      folio: l.folio || `LEV-${l.id}`,
      titulo: l.observaciones || l.notas || `Levantamiento en ${l.sitio || l.cliente || 'sitio'}`,
      cliente: l.cliente || 'Sin Cliente',
      sitio: l.sitio || 'General',
      equipo: equipoValLev,
      serie: serieValLev,
      responsable: listaResp.join(', '),
      responsablesList: listaResp,
      prioridad: dias > 7 ? 'Alta' : 'Media',
      estado: l.estado || 'Pendiente',
      fecha: fechaCreacion,
      fechaCompromiso: l.fechaCompromiso || null,
      diasAntiguedad: dias,
      monto: 0,
      refaccionesCount: 0,
      tiempoRelativo: formatearTiempoRelativoJunta(dias, fechaCreacion),
      cuelloDeBotella: cuelloDeBotella,
      cuelloNivel: cuelloNivel,
      causaId: causaId,
      ultimoComentario: null,
      comentariosCount: 0,
      rawItem: l
    });
  });

  return lista;
};

// Abre la pestaña de revisión de juntas dentro del Dashboard
function abrirModalJuntaRevision() {
  if (typeof switchView === 'function') {
    switchView('dashboard');
  }
  if (typeof setDashView === 'function') {
    setDashView('junta');
  }
};

// Cierra o restablece pantalla completa
function cerrarModalJuntaRevision(e) {
  if (window.currentJuntaFullscreen) {
    window.toggleFullscreenJunta();
  }
};

// Modo pantalla completa para el panel de juntas dentro de dashboard
function toggleFullscreenJunta() {
  const panel = document.getElementById('dash-content-junta');
  const icon = document.getElementById('icon-junta-fullscreen');
  if (!panel) return;

  window.currentJuntaFullscreen = !window.currentJuntaFullscreen;
  if (window.currentJuntaFullscreen) {
    panel.classList.add('junta-fullscreen');
    if (icon) icon.setAttribute('data-lucide', 'minimize-2');
    document.body.style.overflow = 'hidden';
  } else {
    panel.classList.remove('junta-fullscreen');
    if (icon) icon.setAttribute('data-lucide', 'maximize-2');
    document.body.style.overflow = '';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Toggle de la sección de diagnóstico de cuellos de botella
function toggleJuntaAnalytics() {
  const container = document.getElementById('junta-bottleneck-bars-container');
  const chevron = document.getElementById('icon-junta-analytics-chevron');
  const textEl = document.getElementById('junta-analytics-toggle-text');
  if (!container) return;

  window.juntaAnalyticsVisible = !window.juntaAnalyticsVisible;
  if (window.juntaAnalyticsVisible) {
    container.style.display = 'flex';
    if (textEl) textEl.textContent = 'Ocultar Diagnóstico';
    if (chevron) chevron.setAttribute('data-lucide', 'chevron-up');
  } else {
    container.style.display = 'none';
    if (textEl) textEl.textContent = 'Ver Diagnóstico';
    if (chevron) chevron.setAttribute('data-lucide', 'chevron-down');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Toggle de la sección de tabla de responsables con más pendientes
let juntaRespTableVisible = true;
function toggleJuntaResponsablesTable() {
  const container = document.getElementById('junta-responsables-table-container');
  const chevron = document.getElementById('icon-junta-resp-table-chevron');
  const textEl = document.getElementById('junta-resp-table-toggle-text');
  if (!container) return;

  window.juntaRespTableVisible = !window.juntaRespTableVisible;
  if (window.juntaRespTableVisible) {
    container.style.display = 'block';
    if (textEl) textEl.textContent = 'Ocultar Tabla';
    if (chevron) chevron.setAttribute('data-lucide', 'chevron-up');
  } else {
    container.style.display = 'none';
    if (textEl) textEl.textContent = 'Ver Tabla';
    if (chevron) chevron.setAttribute('data-lucide', 'chevron-down');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Filtrar por causa raíz específica desde el diagnóstico
function juntaFiltrarPorCausa(causaId) {
  window.currentJuntaFilterCausa = causaId || 'todos';
  
  const badge = document.getElementById('junta-causa-active-badge');
  const textSpan = document.getElementById('junta-causa-active-text');

  const nombresCausas = {
    'refaccion_proveedor': '📦 En espera de refacciones (compras/almacén)',
    'cotizacion_espera_cliente': '📄 Cotización enviada: esperando decisión / OC cliente',
    'cotizacion_pendiente_generar': '📝 Pendiente de cotizar / generar cotización SAP',
    'falta_firma': '✍️ Falta firma de técnico y/o cliente',
    'sin_asignar': '👤 Responsable / Técnico sin asignar',
    'en_diagnostico': '🛠️ En diagnóstico técnico o taller',
    'envio_sin_guia': '🚚 Guía de envío pendiente'
  };

  if (window.currentJuntaFilterCausa !== 'todos' && badge && textSpan) {
    textSpan.textContent = nombresCausas[window.currentJuntaFilterCausa] || window.currentJuntaFilterCausa;
    badge.style.display = 'inline-flex';
  } else if (badge) {
    badge.style.display = 'none';
  }

  window.renderJuntaRevision();
};

// Selector de modo de visualización: Tarjetas vs Ronda de Responsables
function setJuntaViewMode(mode) {
  window.currentJuntaViewMode = mode || 'tarjetas';

  const btnTarjetas = document.getElementById('junta-mode-tarjetas');
  const btnResp = document.getElementById('junta-mode-responsables');

  if (btnTarjetas && btnResp) {
    if (window.currentJuntaViewMode === 'tarjetas') {
      btnTarjetas.classList.add('active');
      btnResp.classList.remove('active');
    } else {
      btnResp.classList.add('active');
      btnTarjetas.classList.remove('active');
    }
  }

  window.renderJuntaRevision();
};

// Poblar selectores de clientes y responsables (sin combinaciones, usuarios únicos individuales)
function poblarFiltrosJuntaSelectores() {
  const todos = window.obtenerTodosLosPendientes();
  
  // Clientes únicos
  const selectCliente = document.getElementById('junta-filter-cliente');
  if (selectCliente) {
    const valActual = selectCliente.value || 'todos';
    const clientesSet = new Set();
    todos.forEach(item => {
      if (item.cliente && item.cliente !== 'Sin Cliente') clientesSet.add(item.cliente.trim());
    });
    const clientesOrdenados = Array.from(clientesSet).sort((a, b) => a.localeCompare(b));
    
    let html = '<option value="todos">Todos los Clientes</option>';
    clientesOrdenados.forEach(c => {
      html += `<option value="${escapeHTML(c)}" ${valActual === c ? 'selected' : ''}>${escapeHTML(c)}</option>`;
    });
    selectCliente.innerHTML = html;
  }

  // Responsables únicos individuales (desglosados por persona)
  const selectResp = document.getElementById('junta-filter-responsable');
  if (selectResp) {
    const valActual = window.currentJuntaFilterResponsable || selectResp.value || 'todos';
    const respSet = new Set();
    todos.forEach(item => {
      (item.responsablesList || []).forEach(r => {
        const rTrim = String(r).trim();
        if (rTrim && rTrim !== 'Sin Asignar' && rTrim !== '-' && rTrim.toLowerCase() !== 'sin asignar' && rTrim.toLowerCase() !== 'sin_asignar') {
          respSet.add(rTrim);
        }
      });
    });
    const respOrdenados = Array.from(respSet).sort((a, b) => a.localeCompare(b));
    
    let html = '<option value="todos">Todos los Responsables</option>';
    html += `<option value="Sin Asignar" ${valActual === 'Sin Asignar' ? 'selected' : ''}>⚠️ Sin Asignar / Por Definir</option>`;
    respOrdenados.forEach(r => {
      const rolInfo = window.obtenerInfoRolUsuario(r);
      const rolLabelStr = rolInfo && rolInfo.label && rolInfo.rol !== 'usuario' ? ` (${rolInfo.label})` : '';
      html += `<option value="${escapeHTML(r)}" ${valActual === r ? 'selected' : ''}>${escapeHTML(r)}${escapeHTML(rolLabelStr)}</option>`;
    });
    selectResp.innerHTML = html;
  }
};

// Renderizado del diagnóstico analítico de cuellos de botella
function renderJuntaBottleneckAnalytics(todos) {
  const container = document.getElementById('junta-bottleneck-bars-container');
  if (!container) return;

  const total = todos.length;
  if (total === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">Sin datos para diagnosticar.</div>';
    return;
  }

  const defs = [
    { id: 'refaccion_proveedor', label: 'En espera de refacciones de proveedor / compras', icon: 'package', color: '#ec4899' },
    { id: 'cotizacion_espera_cliente', label: 'Cotización enviada: espera de decisión u OC cliente', icon: 'receipt', color: '#3b82f6' },
    { id: 'cotizacion_pendiente_generar', label: 'Falta cotizar refacciones / capturar en SAP', icon: 'file-text', color: '#f59e0b' },
    { id: 'falta_firma', label: 'Falta firma de técnico y/o cliente (bloqueo administrativo)', icon: 'file-signature', color: '#10b981' },
    { id: 'sin_asignar', label: 'Responsable / Técnico sin asignar', icon: 'user-x', color: '#ef4444' },
    { id: 'en_diagnostico', label: 'En diagnóstico técnico / proceso de taller', icon: 'wrench', color: '#8b5cf6' },
    { id: 'envio_sin_guia', label: 'Guía de envío pendiente de capturar', icon: 'truck', color: '#06b6d4' }
  ];

  let html = '';
  defs.forEach(d => {
    const count = todos.filter(x => x.causaId === d.id).length;
    if (count === 0) return;
    const pct = Math.round((count / total) * 100);
    const isActive = window.currentJuntaFilterCausa === d.id;

    html += `
      <div class="junta-bar-row ${isActive ? 'active' : ''}" onclick="window.juntaFiltrarPorCausa('${isActive ? 'todos' : d.id}')" title="Haz clic para filtrar los ${count} casos por esta causa">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; font-size: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 600; color: var(--text-primary);">
            <i data-lucide="${d.icon}" style="width: 14px; height: 14px; color: ${d.color};"></i>
            <span>${escapeHTML(d.label)}</span>
          </div>
          <div style="font-weight: 700; color: var(--text-primary);">
            <span>${count}</span> <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">(${pct}%)</span>
          </div>
        </div>
        <div style="width: 100%; height: 7px; background: var(--bg-hover); border-radius: 999px; overflow: hidden; border: 1px solid var(--border);">
          <div style="width: ${pct}%; height: 100%; background: ${d.color}; border-radius: 999px; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div style="font-size:0.8rem; color:var(--text-muted);">Sin cuellos de botella detectados.</div>';
};

// Renderizado de la tabla analítica de responsables con más pendientes
function renderJuntaResponsablesTable(todos) {
  const container = document.getElementById('junta-responsables-table-container');
  if (!container) return;

  const total = todos.length;
  if (total === 0) {
    container.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">Sin pendientes registrados.</div>';
    return;
  }

  // Agrupar items por cada responsable individual único
  const grupos = {};
  todos.forEach(item => {
    const rList = (item.responsablesList && item.responsablesList.length > 0) ? item.responsablesList : ['Sin Asignar'];
    rList.forEach(respKey => {
      const rName = (typeof unificarNombreUsuario === 'function') ? unificarNombreUsuario(respKey) : (String(respKey || '').trim() || 'Sin Asignar');
      if (!grupos[rName]) {
        grupos[rName] = {
          nombre: rName,
          items: [],
          total: 0,
          ticketsCount: 0,
          ticketsMas15: 0,
          ordenesCount: 0,
          ordenesSinFirma: 0,
          enviosCount: 0,
          levantamientosCount: 0,
          urgentesCount: 0,
          maxDias: 0
        };
      }
      if (!grupos[rName].items.some(x => x.tipo === item.tipo && x.id === item.id)) {
        grupos[rName].items.push(item);
        grupos[rName].total++;
        if (item.tipo === 'ticket') {
          grupos[rName].ticketsCount++;
          if (item.diasAntiguedad > 15) grupos[rName].ticketsMas15++;
        } else if (item.tipo === 'orden') {
          grupos[rName].ordenesCount++;
          if (item.rawItem && (item.rawItem.firma_cliente_base64 === '__DELETED__' || !item.rawItem.firma_cliente_base64 || !item.rawItem.firma_tecnico_base64 || item.rawItem.firma_tecnico_base64 === '__DELETED__')) {
            grupos[rName].ordenesSinFirma++;
          }
        } else if (item.tipo === 'envio') {
          grupos[rName].enviosCount++;
        } else if (item.tipo === 'levantamiento') {
          grupos[rName].levantamientosCount++;
        }
        if (item.prioridad === 'Urgente' || item.cuelloNivel === 'danger') {
          grupos[rName].urgentesCount++;
        }
        if (item.diasAntiguedad > grupos[rName].maxDias) {
          grupos[rName].maxDias = item.diasAntiguedad;
        }
      }
    });
  });

  const respArray = Object.values(grupos).sort((a, b) => {
    if (a.nombre === 'Sin Asignar') return 1;
    if (b.nombre === 'Sin Asignar') return -1;
    return b.total - a.total;
  });

  const maxTotal = respArray.length > 0 ? Math.max(...respArray.map(r => r.total), 1) : 1;

  let html = `
    <table style="width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left; min-width:760px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em;">
          <th style="padding:0.6rem 0.75rem; font-weight:700; width:40px; text-align:center;">#</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700;">Responsable</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center; width:130px;">Rol</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; width:160px;">Total Pendientes</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center;">Tickets</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center;">Órdenes</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center;">Levantamientos</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center;">Envíos</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:center;">Mayor Rezago</th>
          <th style="padding:0.6rem 0.75rem; font-weight:700; text-align:right;">Acción</th>
        </tr>
      </thead>
      <tbody>
  `;

  respArray.forEach((r, idx) => {
    const isUnassigned = r.nombre === 'Sin Asignar';
    const pct = Math.round((r.total / maxTotal) * 100);
    const barColor = isUnassigned ? '#ef4444' : (r.total >= 10 ? '#ef4444' : (r.total >= 5 ? '#f59e0b' : '#3b82f6'));
    const medal = idx === 0 && !isUnassigned ? '🥇 ' : (idx === 1 && !isUnassigned ? '🥈 ' : (idx === 2 && !isUnassigned ? '🥉 ' : ''));
    const initial = isUnassigned ? '?' : (r.nombre[0] || '?').toUpperCase();
    const avatarBg = isUnassigned ? 'rgba(239,68,68,0.15)' : 'rgba(79,142,247,0.15)';
    const avatarColor = isUnassigned ? '#ef4444' : '#4f8ef7';

    // Highlight current filter if active
    const fRespCurrent = window.currentJuntaFilterResponsable || document.getElementById('junta-filter-responsable')?.value || 'todos';
    const isActiveFilter = fRespCurrent !== 'todos' && (
      normalizarTextoJunta(fRespCurrent) === normalizarTextoJunta(r.nombre)
    );

    const safeNombreArg = escapeHTML(r.nombre).replace(/'/g, "\\'");
    const rolInfo = window.obtenerInfoRolUsuario(r.nombre);

    html += `
      <tr style="border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.15s ease; ${isActiveFilter ? 'background:rgba(232,130,12,0.08);' : ''}" 
          onclick="window.filtrarSoloEsteTecnico('${safeNombreArg}')" 
          title="Haz clic para enfocar los pendientes de ${escapeHTML(r.nombre)}"
          onmouseenter="if(!${isActiveFilter}) this.style.background='var(--bg-hover)'" 
          onmouseleave="if(!${isActiveFilter}) this.style.background=''">
        <td style="padding:0.55rem 0.75rem; text-align:center; font-weight:700; color:var(--text-muted); font-size:0.78rem;">
          ${medal ? medal : (idx + 1)}
        </td>
        <td style="padding:0.55rem 0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:26px; height:26px; border-radius:50%; background:${avatarBg}; color:${avatarColor}; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; flex-shrink:0;">
              ${isUnassigned ? '<i data-lucide="user-x" style="width:13px; height:13px;"></i>' : initial}
            </div>
            <div>
              <span style="font-weight:700; color:${isUnassigned ? 'var(--red, #ef4444)' : 'var(--text-primary)'};">${escapeHTML(r.nombre)}</span>
              ${r.urgentesCount > 0 ? `<span style="margin-left:4px; font-size:0.68rem; color:#ef4444; font-weight:700;">🔥 ${r.urgentesCount} urgentes</span>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span class="badge" style="background:${rolInfo.color}18; color:${rolInfo.color}; border:1px solid ${rolInfo.color}40; border-radius:99px; padding:0.18rem 0.55rem; font-size:0.7rem; font-weight:700; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;">
            <i data-lucide="${rolInfo.icon}" style="width:11px; height:11px;"></i>
            <span>${escapeHTML(rolInfo.label)}</span>
          </span>
        </td>
        <td style="padding:0.55rem 0.75rem;">
          <div style="display:flex; flex-direction:column; gap:0.2rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; color:var(--text-primary);">
              <span>${r.total} pendientes</span>
              <span style="color:var(--text-muted); font-size:0.7rem; font-weight:normal;">${Math.round((r.total / total) * 100)}%</span>
            </div>
            <div style="width:100%; height:6px; background:var(--bg-hover); border-radius:999px; overflow:hidden; border:1px solid var(--border);">
              <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:999px;"></div>
            </div>
          </div>
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span style="font-weight:700; color:#8b5cf6;">${r.ticketsCount}</span>
          ${r.ticketsMas15 > 0 ? `<div style="font-size:0.68rem; color:#ef4444; font-weight:600;">+${r.ticketsMas15} (+15d)</div>` : ''}
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span style="font-weight:700; color:#10b981;">${r.ordenesCount}</span>
          ${r.ordenesSinFirma > 0 ? `<div style="font-size:0.68rem; color:#f59e0b; font-weight:600;">${r.ordenesSinFirma} s/firma</div>` : ''}
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span style="font-weight:700; color:#6366f1;">${r.levantamientosCount}</span>
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span style="font-weight:700; color:#f59e0b;">${r.enviosCount}</span>
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:center;">
          <span class="badge" style="background:${r.maxDias > 14 ? 'rgba(239,68,68,0.15)' : (r.maxDias > 7 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)')}; color:${r.maxDias > 14 ? '#ef4444' : (r.maxDias > 7 ? '#f59e0b' : '#10b981')}; font-weight:700; padding:0.15rem 0.45rem; border-radius:6px; font-size:0.72rem;">
            ${r.maxDias} días
          </span>
        </td>
        <td style="padding:0.55rem 0.75rem; text-align:right;">
          <button type="button" class="btn-secondary" onclick="event.stopPropagation(); window.filtrarSoloEsteTecnico('${safeNombreArg}')" style="font-size:0.72rem; padding:0.25rem 0.55rem; display:inline-flex; align-items:center; gap:3px; font-weight:600;">
            <i data-lucide="filter" style="width:11px; height:11px;"></i> <span>Ver casos</span>
          </button>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Generador HTML para una tarjeta individual de pendiente con acciones rápidas
function generarHtmlTarjetaJunta(item, tecnicosDisponibles) {
  let cardClass = 'junta-card-item';
  if (item.prioridad === 'Urgente' || item.cuelloNivel === 'danger') {
    cardClass += ' critico-card';
  } else if (item.diasAntiguedad >= 7 || item.cuelloNivel === 'warning') {
    cardClass += ' alerta-card';
  }

  // Badge de antigüedad
  let delayBadgeClass = 'normal';
  let delayIcon = 'clock';
  let delayText = `Hace ${item.diasAntiguedad} ${item.diasAntiguedad === 1 ? 'día' : 'días'}`;
  if (item.diasAntiguedad > 14) {
    delayBadgeClass = 'danger';
    delayIcon = 'alert-triangle';
    delayText = `⚠️ Crítico: ${item.diasAntiguedad} días`;
  } else if (item.diasAntiguedad >= 7) {
    delayBadgeClass = 'warning';
    delayIcon = 'clock';
    delayText = `⏳ Alerta: ${item.diasAntiguedad} días`;
  }

  // Badge de fecha compromiso acordada
  let deadlineHtml = '';
  if (item.fechaCompromiso) {
    const dComp = new Date(item.fechaCompromiso);
    const hoyMs = new Date().setHours(0,0,0,0);
    const esVencido = !isNaN(dComp.getTime()) && dComp.getTime() < hoyMs;
    const txtFmt = !isNaN(dComp.getTime()) ? dComp.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : item.fechaCompromiso;
    deadlineHtml = `
      <span class="junta-deadline-pill ${esVencido ? 'vencido' : ''}" title="Fecha límite acordada en junta: ${item.fechaCompromiso}">
        <i data-lucide="calendar-check" style="width:11px; height:11px;"></i>
        <span>${esVencido ? 'Vencido: ' : 'Compromiso: '}${txtFmt}</span>
      </span>
    `;
  }

  // Monto si existe
  let montoHtml = '';
  if (item.monto > 0) {
    montoHtml = `
      <span style="font-weight: 800; color: #10b981; font-family: monospace; font-size: 0.78rem; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); padding: 1px 6px; border-radius: 5px;">
        $${new Intl.NumberFormat('es-MX').format(item.monto)} MXN
      </span>
    `;
  }

  // Selector de reasignación rápida (Supervisores para tickets, Técnicos para órdenes/levantamientos/envíos)
  const listaDisponibles = (item.tipo === 'ticket') 
    ? (typeof window.obtenerListaSupervisoresJunta === 'function' ? window.obtenerListaSupervisoresJunta() : [])
    : (tecnicosDisponibles && tecnicosDisponibles.length > 0 ? tecnicosDisponibles : (typeof window.obtenerListaTecnicosJunta === 'function' ? window.obtenerListaTecnicosJunta() : []));

  let primerResp = (item.responsablesList && item.responsablesList[0]) ? item.responsablesList[0] : 'Sin Asignar';
  if (item.tipo === 'ticket' && primerResp !== 'Sin Asignar') {
    const isSup = listaDisponibles.some(s => normalizarTextoJunta(s) === normalizarTextoJunta(primerResp));
    if (!isSup) primerResp = 'Sin Asignar';
  }

  let tecOptionsHtml = `<option value="${escapeHTML(primerResp)}" selected>${escapeHTML(primerResp)}</option>`;
  if (primerResp !== 'Sin Asignar') {
    tecOptionsHtml += `<option value="Sin Asignar">Sin Asignar</option>`;
  }
  listaDisponibles.forEach(tec => {
    if (normalizarTextoJunta(tec) !== normalizarTextoJunta(primerResp) && tec !== 'Sin Asignar') {
      tecOptionsHtml += `<option value="${escapeHTML(tec)}">${escapeHTML(tec)}</option>`;
    }
  });

  // Último comentario o acuerdo interno (visibilidad garantizada ÚNICAMENTE en Tickets)
  let commentHtml = '';
  if (item.tipo === 'ticket') {
    if (item.ultimoComentario && item.ultimoComentario.texto) {
      const uNom = escapeHTML(item.ultimoComentario.usuario || 'Staff');
      const uTxt = escapeHTML(item.ultimoComentario.texto);
      const uFec = item.ultimoComentario.fecha ? (typeof formatFechaHoraAmigable === 'function' ? formatFechaHoraAmigable(item.ultimoComentario.fecha) : (typeof formatFechaAmigable === 'function' ? formatFechaAmigable(item.ultimoComentario.fecha) : item.ultimoComentario.fecha.substring(0, 10))) : '';
      const tooltipText = escapeHTML(`${item.ultimoComentario.usuario || 'Staff'}${uFec ? ' (' + uFec + ')' : ''}: ${item.ultimoComentario.texto}`);

      commentHtml = `
        <div style="background: var(--bg-hover); border: 1px solid var(--border); border-left: 3.5px solid var(--accent); border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);" title="${tooltipText}">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.72rem;">
            <span style="color: var(--accent); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <i data-lucide="message-square" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${uNom}</span>
            </span>
            ${uFec ? `<span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 500; white-space: nowrap; flex-shrink: 0;">• ${escapeHTML(uFec)}</span>` : ''}
          </div>
          <div style="color: var(--text-primary); font-size: 0.79rem; line-height: 1.38; font-weight: 500; word-break: break-word; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${uTxt}
          </div>
        </div>
      `;
    } else {
      commentHtml = `
        <div style="background: var(--bg-hover); border: 1px dashed var(--border); border-radius: 8px; padding: 0.42rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.73rem; color: var(--text-muted);">
          <span style="display: inline-flex; align-items: center; gap: 5px; opacity: 0.75;">
            <i data-lucide="message-square" style="width: 12px; height: 12px;"></i>
            <span>Sin comentarios internos</span>
          </span>
          <button type="button" onclick="event.stopPropagation(); window.toggleNotaRapidaJunta('${item.tipo}', '${item.id}')" style="font-size: 0.72rem; color: var(--accent); background: none; border: none; cursor: pointer; font-weight: 600; padding: 0; display: inline-flex; align-items: center; gap: 3px;" title="Registrar nuevo acuerdo o comentario">
            <i data-lucide="plus" style="width: 11px; height: 11px;"></i> Comentar
          </button>
        </div>
      `;
    }
  }

  const isUrgente = item.prioridad === 'Urgente';

  let assocOrderHtml = '';
  if (item.tipo === 'ticket') {
    const rawT = item.rawItem || { id: item.id, folio: item.folio };
    const assocOrder = window.obtenerOrdenAsociadaTicket(rawT);
    const parentTicket = !assocOrder ? (typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(rawT) : null) : null;
    if (assocOrder) {
      assocOrderHtml = `
        <button type="button" class="junta-quick-action-btn" onclick="event.stopPropagation(); window.verOrdenDesdeTicket('${assocOrder.id}')" title="Ver Orden de Servicio vinculada (${escapeHTML(assocOrder.folio || assocOrder.id)})" style="background: rgba(37, 99, 235, 0.1); color: #2563eb; border-color: rgba(37, 99, 235, 0.3); font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
          <i data-lucide="file-text" style="width: 11px; height: 11px;"></i>
          <span>${escapeHTML(assocOrder.folio || 'Ver OS')}</span>
        </button>
      `;
    } else if (parentTicket) {
      assocOrderHtml = `
        <button type="button" class="junta-quick-action-btn" onclick="event.stopPropagation(); verDetalleTicket('${parentTicket.id}')" title="Ver Ticket Origen (${escapeHTML(parentTicket.folio || parentTicket.id)})" style="background: rgba(234, 88, 12, 0.1); color: #ea580c; border-color: rgba(234, 88, 12, 0.3); font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
          <i data-lucide="ticket" style="width: 11px; height: 11px;"></i>
          <span>${escapeHTML(parentTicket.folio || parentTicket.id)}</span>
        </button>
      `;
    }
  }

  return `
    <div class="${cardClass}" id="junta-card-${item.tipo}-${item.id}" onclick="if(!event.target.closest('button, select, input, textarea, a, .junta-quicknote-drawer, .junta-quick-action-btn, option')){ window.abrirDetalleElementoJunta('${item.tipo}', '${item.id}'); }" title="Haz clic para abrir detalle de ${item.tipoLabel} (${escapeHTML(item.folio)})">
      
      <!-- HEADER TARJETA: TIPO, FOLIO, TIEMPO, DEADLINE, MONTO, PRIORIDAD RÁPIDA -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
          <span style="background: ${item.tipoColor}18; color: ${item.tipoColor}; border: 1px solid ${item.tipoColor}35; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="${item.tipoIcon}" style="width: 12px; height: 12px;"></i> ${item.tipoLabel}
          </span>
          <strong style="font-size: 0.85rem; color: var(--text-primary); font-family: monospace; letter-spacing: -0.2px;">${escapeHTML(item.folio)}</strong>
          ${assocOrderHtml}
          ${montoHtml}
          ${deadlineHtml}
        </div>

        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <!-- Botón de Fuego Urgente en 1 Clic -->
          <button type="button" class="junta-quick-action-btn ${isUrgente ? 'active-flame' : ''}" onclick="event.stopPropagation(); window.juntaToggleUrgente('${item.tipo}', '${item.id}')" title="Alternar Prioridad Urgente">
            <i data-lucide="flame" style="width: 12px; height: 12px;"></i>
            <span>${isUrgente ? 'Urgente' : 'Normal'}</span>
          </button>

          <div class="junta-delay-badge ${delayBadgeClass}" title="Fecha: ${item.fecha ? item.fecha.substring(0,10) : 'N/A'}">
            <i data-lucide="${delayIcon}" style="width: 11px; height: 11px;"></i>
            <span>${item.tiempoRelativo}</span>
          </div>
        </div>
      </div>

      <!-- INFO CLIENTE Y UBICACIÓN -->
      <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); line-height: 1.3;">
          ${escapeHTML(item.cliente)}
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.76rem; color: var(--text-muted); flex-wrap: wrap;">
          <span style="display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${escapeHTML(item.sitio)}</span>
          ${(() => {
            const eq = item.equipo ? escapeHTML(item.equipo) : '';
            const sn = item.serie && item.serie !== 'N/A' && item.serie !== item.equipo ? escapeHTML(item.serie) : '';
            if (!eq && !sn) return '';
            if (eq && sn) {
              return `<span style="display: inline-flex; align-items: center; gap: 3px;" title="Maquinaria: ${eq} | S/N: ${sn}"><i data-lucide="cpu" style="width: 12px; height: 12px;"></i> ${eq} <span style="opacity:0.85; font-weight:normal; font-size:0.72rem;">(S/N: ${sn})</span></span>`;
            }
            if (eq) {
              return `<span style="display: inline-flex; align-items: center; gap: 3px;" title="Maquinaria: ${eq}"><i data-lucide="cpu" style="width: 12px; height: 12px;"></i> ${eq}</span>`;
            }
            return `<span style="display: inline-flex; align-items: center; gap: 3px;" title="Serie: ${sn}"><i data-lucide="cpu" style="width: 12px; height: 12px;"></i> S/N: ${sn}</span>`;
          })()}
          
          <!-- Reasignación rápida de responsable/técnico en 1 clic -->
          <div style="display: inline-flex; align-items: center; gap: 3px; background: var(--bg-hover); padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border);" title="${item.tipo === 'ticket' ? 'Reasignar supervisor' : 'Reasignar técnico'}" onclick="event.stopPropagation();">
            <i data-lucide="${item.tipo === 'ticket' ? 'user-check' : 'user'}" style="width: 12px; height: 12px; color: var(--accent);"></i>
            <select onclick="event.stopPropagation();" onchange="event.stopPropagation(); window.juntaReasignarTecnico('${item.tipo}', '${item.id}', this.value)" style="border: none; background: transparent; color: var(--text-primary); font-size: 0.74rem; font-weight: 600; cursor: pointer; outline: none; max-width: 150px;">
              ${tecOptionsHtml}
            </select>
          </div>
        </div>
      </div>

      <!-- ASUNTO / TRABAJO -->
      <div style="font-size: 0.82rem; color: var(--text-primary); line-height: 1.4; font-weight: 500;">
        ${escapeHTML(item.titulo)}
      </div>

      <!-- CUELLO DE BOTELLA OPERATIVO -->
      <div class="junta-bottleneck-box ${item.cuelloNivel}">
        <i data-lucide="alert-circle" style="width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px;"></i>
        <div style="flex: 1;">
          <strong style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 2px;">Cuello de botella:</strong>
          <span>${escapeHTML(item.cuelloDeBotella)}</span>
        </div>
      </div>

      <!-- ÚLTIMO COMENTARIO -->
      ${commentHtml}

      <!-- BOTONES DE ACCIÓN INFERIOR -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.65rem; margin-top: 0.2rem; flex-wrap: wrap; gap: 0.4rem;">
        <span style="font-size: 0.7rem; color: var(--text-muted);">Estatus: <strong>${escapeHTML(item.estado)}</strong></span>
        <div style="display: flex; gap: 0.35rem; align-items: center;">
          <!-- Botón Fecha Compromiso -->
          <button type="button" class="btn-secondary" onclick="event.stopPropagation(); window.juntaSetDeadlinePrompt('${item.tipo}', '${item.id}', '${item.fechaCompromiso || ''}')" style="font-size:0.73rem; padding:0.3rem 0.55rem; display:inline-flex; align-items:center; gap:3px;" title="Definir fecha límite / compromiso acordada en junta">
            <i data-lucide="calendar-plus" style="width:12px;height:12px;"></i> <span>Compromiso</span>
          </button>

          <!-- Botón Acuerdo de Junta -->
          <button type="button" class="btn-secondary" onclick="event.stopPropagation(); window.toggleNotaRapidaJunta('${item.tipo}', '${item.id}')" style="font-size:0.73rem; padding:0.3rem 0.55rem; display:inline-flex; align-items:center; gap:3px;" title="Capturar acuerdo inmediato">
            <i data-lucide="message-square-plus" style="width:12px;height:12px;"></i> <span>Acuerdo</span>
          </button>

          <!-- Botón Ver Detalle -->
          <button type="button" class="btn-primary" onclick="event.stopPropagation(); window.abrirDetalleElementoJunta('${item.tipo}', '${item.id}')" style="font-size:0.73rem; padding:0.3rem 0.6rem; display:inline-flex; align-items:center; gap:3px; background:var(--bg-secondary); border:1px solid var(--border); color:var(--text-primary);">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i> <span>Detalle</span>
          </button>
        </div>
      </div>

      <!-- DRAWER NOTA RÁPIDA DE JUNTA -->
      <div id="junta-quicknote-box-${item.tipo}-${item.id}" class="junta-quicknote-drawer" style="display: none; flex-direction: column; gap: 0.4rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; margin-top: 0.5rem;" onclick="event.stopPropagation();">
        <label style="font-size: 0.72rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 4px;">
          <i data-lucide="pen-line" style="width: 12px; height: 12px;"></i> Registrar Acuerdo de Junta (se añadirá al historial):
        </label>
        <textarea id="junta-quicknote-input-${item.tipo}-${item.id}" rows="2" placeholder="Ej: Se acuerda enviar refacción el jueves y Rodrigo concluye el viernes..." style="width: 100%; font-size: 0.75rem; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 0.35rem;">
          <button type="button" class="btn-secondary" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" onclick="event.stopPropagation(); window.toggleNotaRapidaJunta('${item.tipo}', '${item.id}')">Cancelar</button>
          <button type="button" class="btn-primary" style="font-size: 0.7rem; padding: 0.2rem 0.6rem;" onclick="event.stopPropagation(); window.guardarNotaRapidaJunta('${item.tipo}', '${item.id}')">Guardar Acuerdo</button>
        </div>
      </div>

    </div>
  `;
}

// Renderizado principal del panel de juntas
function renderJuntaRevision() {
  const container = document.getElementById('junta-cards-container');
  if (!container) return;

  const todos = window.obtenerTodosLosPendientes();
  const tecnicosDisponibles = window.obtenerListaTecnicosJunta();

  // 1. CALCULAR MÉTRICAS KPI DE VOLUMEN
  const countTotal = todos.length;
  const countTickets = todos.filter(x => x.tipo === 'ticket').length;
  const countTicketsMas15Dias = todos.filter(x => x.tipo === 'ticket' && x.diasAntiguedad > 15).length;
  
  const countOrdenes = todos.filter(x => x.tipo === 'orden').length;
  const countOrdenesSinFirma = todos.filter(x => x.tipo === 'orden' && (x.rawItem.firma_cliente_base64 === '__DELETED__' || !x.rawItem.firma_cliente_base64 || !x.rawItem.firma_tecnico_base64 || x.rawItem.firma_tecnico_base64 === '__DELETED__')).length;
  
  const countEnvios = todos.filter(x => x.tipo === 'envio').length;
  const countEnviosSinGuia = todos.filter(x => x.tipo === 'envio' && (!x.rawItem.guiaPedido || !String(x.rawItem.guiaPedido).trim())).length;
  
  const countCotizaciones = todos.filter(x => x.tipoEspecifico === 'Cotización').length;
  const countLevantamientos = todos.filter(x => x.tipo === 'levantamiento').length;
  const countLevPorRealizar = todos.filter(x => x.tipo === 'levantamiento' && (x.rawItem.estado === 'Por Cotizar' || x.rawItem.estado === 'Pendiente' || x.rawItem.estado === 'Por Realizar' || !x.rawItem.estado)).length;
  
  const countCriticos = todos.filter(x => x.diasAntiguedad >= 7).length;

  // Actualizar KPI DOM
  const elTot = document.getElementById('junta-kpi-total');
  if (elTot) elTot.textContent = countTotal;
  const elTkt = document.getElementById('junta-kpi-tickets');
  if (elTkt) elTkt.textContent = countTickets;
  const elTktSub = document.getElementById('junta-kpi-tickets-sub');
  if (elTktSub) elTktSub.textContent = `${countTicketsMas15Dias} +15 días`;

  const elOrd = document.getElementById('junta-kpi-ordenes');
  if (elOrd) elOrd.textContent = countOrdenes;
  const elOrdSub = document.getElementById('junta-kpi-ordenes-sub');
  if (elOrdSub) elOrdSub.textContent = `${countOrdenesSinFirma} sin firma`;

  const elEnv = document.getElementById('junta-kpi-envios');
  if (elEnv) elEnv.textContent = countEnvios;
  const elEnvSub = document.getElementById('junta-kpi-envios-sub');
  if (elEnvSub) elEnvSub.textContent = `${countEnviosSinGuia} sin guía`;

  const elLev = document.getElementById('junta-kpi-levantamientos');
  if (elLev) elLev.textContent = countLevantamientos;
  const elLevSub = document.getElementById('junta-kpi-levantamientos-sub');
  if (elLevSub) elLevSub.textContent = `${countLevPorRealizar} por realizar`;

  const elCrit = document.getElementById('junta-kpi-criticos');
  if (elCrit) elCrit.textContent = countCriticos;

  // 2. CALCULAR MÉTRICAS FINANCIERAS (OPCIÓN 2)
  const sumMontoCotizaciones = todos.filter(x => x.tipoEspecifico === 'Cotización').reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  const totalRefaccionesPendientes = todos.reduce((sum, item) => sum + (Number(item.refaccionesCount) || 0), 0);

  const elFinCot = document.getElementById('junta-fin-cotizaciones');
  if (elFinCot) elFinCot.textContent = `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sumMontoCotizaciones)} MXN`;
  const elFinCotSub = document.getElementById('junta-fin-cotizaciones-sub');
  if (elFinCotSub) elFinCotSub.textContent = `${countCotizaciones} cotizaciones abiertas esperando OC/Autorización`;

  const elFinOrd = document.getElementById('junta-fin-ordenes');
  if (elFinOrd) elFinOrd.textContent = `${countOrdenesSinFirma} órdenes`;

  const elFinRef = document.getElementById('junta-fin-refacciones');
  if (elFinRef) elFinRef.textContent = `${totalRefaccionesPendientes} piezas`;

  // 3. ACTUALIZAR PÍLDORAS DE TIPO
  const cpTodos = document.getElementById('count-pill-todos');
  if (cpTodos) cpTodos.textContent = countTotal;
  const cpTkt = document.getElementById('count-pill-ticket');
  if (cpTkt) cpTkt.textContent = countTickets;
  const cpOrd = document.getElementById('count-pill-orden');
  if (cpOrd) cpOrd.textContent = countOrdenes;
  const cpEnv = document.getElementById('count-pill-envio');
  if (cpEnv) cpEnv.textContent = countEnvios;
  const cpCot = document.getElementById('count-pill-cotizacion');
  if (cpCot) cpCot.textContent = countCotizaciones;
  const cpLev = document.getElementById('count-pill-levantamiento');
  if (cpLev) cpLev.textContent = countLevantamientos;

  // Header & sidebar badges
  const headerBadge = document.getElementById('junta-badge-total-header');
  if (headerBadge) headerBadge.textContent = `${countTotal} pendientes`;
  window.actualizarBadgeJuntaRevision(countTotal);

  // 4. RENDERIZAR DIAGNÓSTICO Y TABLA DE RESPONSABLES
  window.renderJuntaBottleneckAnalytics(todos);
  window.renderJuntaResponsablesTable(todos);

  // 5. APLICAR FILTROS MULTICRITERIO
  const fTipo = window.currentJuntaFilterTipo || 'todos';
  const fAntiguedad = document.getElementById('junta-filter-antiguedad')?.value || window.currentJuntaFilterAntiguedad || 'todos';
  const fCliente = document.getElementById('junta-filter-cliente')?.value || 'todos';
  const fResp = document.getElementById('junta-filter-responsable')?.value || 'todos';
  const fUrgente = !!window.currentJuntaFilterUrgente;
  const fCausa = window.currentJuntaFilterCausa || 'todos';
  const q = (document.getElementById('junta-search-input')?.value || '').toLowerCase().trim();
  const sortBy = document.getElementById('junta-sort-by')?.value || window.currentJuntaSortBy || 'antiguedad_desc';

  let filtrados = todos.filter(item => {
    // Tipo
    if (fTipo === 'ticket' && item.tipo !== 'ticket') return false;
    if (fTipo === 'orden' && item.tipo !== 'orden') return false;
    if (fTipo === 'envio' && item.tipo !== 'envio') return false;
    if (fTipo === 'cotizacion' && item.tipoEspecifico !== 'Cotización') return false;
    if (fTipo === 'levantamiento' && item.tipo !== 'levantamiento') return false;

    // Causa raíz seleccionada en el diagnóstico
    if (fCausa !== 'todos' && item.causaId !== fCausa) return false;

    // Antigüedad
    if (fAntiguedad === 'hoy' && item.diasAntiguedad > 1) return false;
    if (fAntiguedad === 'mayor_3' && item.diasAntiguedad < 3) return false;
    if (fAntiguedad === 'alerta_7' && item.diasAntiguedad < 7) return false;
    if (fAntiguedad === 'critico_14' && item.diasAntiguedad < 14) return false;

    // Cliente
    if (fCliente !== 'todos' && item.cliente !== fCliente) return false;

    // Responsable (comprueba si el usuario seleccionado está asignado individualmente al item)
    if (fResp && fResp !== 'todos') {
      const fNorm = normalizarTextoJunta(fResp);
      const isUnassigned = fNorm === 'sin asignar' || fNorm === 'por definir' || fNorm === '-' || fNorm === 'sin_asignar';
      
      if (isUnassigned) {
        const isItemUnassigned = !item.responsable || 
          item.responsable === '-' || 
          normalizarTextoJunta(item.responsable).includes('sin asignar') || 
          normalizarTextoJunta(item.responsable).includes('por definir') ||
          (item.responsablesList || []).some(r => {
            const rN = normalizarTextoJunta(r);
            return rN === 'sin asignar' || rN === 'por definir' || rN === '-' || rN === '';
          });
        if (!isItemUnassigned) return false;
      } else {
        const itemRespListNorm = (item.responsablesList || []).map(r => normalizarTextoJunta(r));
        const itemRespNorm = normalizarTextoJunta(item.responsable);
        
        const match = itemRespListNorm.some(r => r.includes(fNorm) || fNorm.includes(r)) ||
                      itemRespNorm.includes(fNorm) || 
                      fNorm.includes(itemRespNorm);
        if (!match) return false;
      }
    }

    // Urgente
    if (fUrgente && item.prioridad !== 'Urgente' && item.prioridad !== 'Alta' && item.cuelloNivel !== 'danger') return false;

    // Búsqueda de texto
    if (q) {
      const matchFolio = (item.folio || '').toLowerCase().includes(q);
      const matchCli = (item.cliente || '').toLowerCase().includes(q);
      const matchSit = (item.sitio || '').toLowerCase().includes(q);
      const matchEq = (item.equipo || '').toLowerCase().includes(q);
      const matchSerie = (item.serie || '').toLowerCase().includes(q);
      const matchResp = (item.responsable || '').toLowerCase().includes(q);
      const matchTit = (item.titulo || '').toLowerCase().includes(q);
      const matchCuello = (item.cuelloDeBotella || '').toLowerCase().includes(q);
      const matchNota = item.ultimoComentario ? (String(item.ultimoComentario.texto || '').toLowerCase().includes(q) || String(item.ultimoComentario.usuario || '').toLowerCase().includes(q)) : false;

      if (!matchFolio && !matchCli && !matchSit && !matchEq && !matchSerie && !matchResp && !matchTit && !matchCuello && !matchNota) {
        return false;
      }
    }

    return true;
  });

  // 6. ORDENAMIENTO
  filtrados.sort((a, b) => {
    if (sortBy === 'antiguedad_desc') {
      return b.diasAntiguedad - a.diasAntiguedad;
    } else if (sortBy === 'antiguedad_asc') {
      return a.diasAntiguedad - b.diasAntiguedad;
    } else if (sortBy === 'prioridad') {
      const peso = { 'Urgente': 4, 'Alta': 3, 'Media': 2, 'Baja': 1 };
      const pesoA = peso[a.prioridad] || (a.diasAntiguedad > 14 ? 4 : (a.diasAntiguedad > 7 ? 3 : 2));
      const pesoB = peso[b.prioridad] || (b.diasAntiguedad > 14 ? 4 : (b.diasAntiguedad > 7 ? 3 : 2));
      if (pesoB !== pesoA) return pesoB - pesoA;
      return b.diasAntiguedad - a.diasAntiguedad;
    } else if (sortBy === 'cliente') {
      return (a.cliente || '').localeCompare(b.cliente || '');
    } else if (sortBy === 'responsable') {
      return (a.responsable || '').localeCompare(b.responsable || '');
    }
    return b.diasAntiguedad - a.diasAntiguedad;
  });

  window.juntaItemsFiltradosCache = filtrados;

  // Actualizar contador
  const countLabel = document.getElementById('junta-items-count-label');
  if (countLabel) countLabel.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'pendiente' : 'pendientes'}`;

  // 7. RENDERIZAR SEGÚN MODO DE VISTA (TARJETAS O RONDA DE RESPONSABLES)
  if (filtrados.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background: var(--bg-card); border: 1px dashed var(--border); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
          <i data-lucide="check-circle" style="width: 26px; height: 26px; color: var(--green);"></i>
        </div>
        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">¡Sin pendientes con estos filtros!</h3>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); max-width: 420px;">No se encontraron elementos activos que coincidan con la búsqueda o filtros aplicados.</p>
        <button type="button" class="btn-secondary" onclick="window.resetFiltrosJunta()" style="margin-top: 0.5rem; font-size: 0.8rem;">Restablecer Filtros</button>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // MODO 1: RONDA DE RESPONSABLES / STANDUP (OPCIÓN 3) - AGRUPADOS POR USUARIO INDIVIDUAL
  if (window.currentJuntaViewMode === 'responsables') {
    // Agrupar filtrados por cada responsable individual único
    const grupos = {};
    filtrados.forEach(item => {
      const rList = (item.responsablesList && item.responsablesList.length > 0) ? item.responsablesList : ['Sin Asignar'];
      rList.forEach(respKey => {
        if (!grupos[respKey]) grupos[respKey] = [];
        if (!grupos[respKey].some(x => x.tipo === item.tipo && x.id === item.id)) {
          grupos[respKey].push(item);
        }
      });
    });

    // Ordenar grupos por cantidad de pendientes (más saturados primero)
    const respOrdenados = Object.keys(grupos).sort((a, b) => {
      if (a === 'Sin Asignar') return 1;
      if (b === 'Sin Asignar') return -1;
      return grupos[b].length - grupos[a].length;
    });

    let htmlGroups = '';
    respOrdenados.forEach(resp => {
      const itemsResp = grupos[resp];
      const countResp = itemsResp.length;
      const countUrgentes = itemsResp.filter(x => x.prioridad === 'Urgente' || x.cuelloNivel === 'danger').length;
      const maxDias = Math.max(...itemsResp.map(x => x.diasAntiguedad));

      // Nivel de saturación
      let satClass = 'baja';
      let satText = 'Carga Ligera';
      if (countResp >= 5) {
        satClass = 'alta';
        satText = 'Alta Saturación';
      } else if (countResp >= 3) {
        satClass = 'media';
        satText = 'Carga Moderada';
      }

      let cardsResp = '';
      itemsResp.forEach(item => {
        cardsResp += generarHtmlTarjetaJunta(item, tecnicosDisponibles);
      });

      htmlGroups += `
        <div class="junta-tech-group-container ${countUrgentes > 0 ? 'has-criticos' : ''}" style="grid-column: 1 / -1;">
          
          <!-- HEADER DEL TÉCNICO / RESPONSABLE INDIVIDUAL -->
          <div class="junta-tech-group-header">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: ${resp === 'Sin Asignar' ? 'rgba(239,68,68,0.15)' : 'rgba(232,130,12,0.15)'}; color: ${resp === 'Sin Asignar' ? '#ef4444' : 'var(--accent)'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
                <i data-lucide="${resp === 'Sin Asignar' ? 'user-x' : 'user'}" style="width: 17px; height: 17px;"></i>
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.45rem;">
                  <span>${escapeHTML(resp)}</span>
                  <span class="junta-sat-badge ${satClass}">${satText}</span>
                </h4>
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.6rem; margin-top: 2px;">
                  <span><strong>${countResp}</strong> ${countResp === 1 ? 'pendiente asignado' : 'pendientes asignados'}</span>
                  ${countUrgentes > 0 ? `<span style="color: #ef4444; font-weight: 700;">• 🔥 ${countUrgentes} urgentes</span>` : ''}
                  <span>• ⏳ Mayor rezago: ${maxDias} días</span>
                </div>
              </div>
            </div>

            <button type="button" class="btn-secondary" onclick="window.filtrarSoloEsteTecnico('${escapeHTML(resp)}')" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="filter" style="width: 12px; height: 12px;"></i> <span>Enfocar</span>
            </button>
          </div>

          <!-- GRID DE TARJETAS DE ESTE TÉCNICO -->
          <div class="junta-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 0.75rem;">
            ${cardsResp}
          </div>

        </div>
      `;
    });

    container.innerHTML = htmlGroups;
  } else {
    // MODO 2: VISTA TARJETAS ESTÁNDAR
    let htmlCards = '';
    filtrados.forEach(item => {
      htmlCards += generarHtmlTarjetaJunta(item, tecnicosDisponibles);
    });
    container.innerHTML = htmlCards;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Enfocar en un técnico / responsable específico
function filtrarSoloEsteTecnico(respNombre) {
  if (!respNombre) return;

  window.currentJuntaFilterResponsable = respNombre;
  
  // Si no hay selector poblado aún, poblarlo o asegurar la opción
  const selResp = document.getElementById('junta-filter-responsable');
  if (selResp) {
    let exists = Array.from(selResp.options).some(o => o.value === respNombre || normalizarTextoJunta(o.value) === normalizarTextoJunta(respNombre));
    if (!exists && respNombre !== 'todos') {
      const opt = document.createElement('option');
      opt.value = respNombre;
      opt.textContent = respNombre;
      selResp.appendChild(opt);
    }
    selResp.value = respNombre;
  }
  
  // Limpiar filtros conflictivos para garantizar que se vean los casos del técnico
  window.currentJuntaFilterCausa = 'todos';
  const inSearch = document.getElementById('junta-search-input');
  if (inSearch) inSearch.value = '';
  
  // Limpiar filtro de tipo para mostrar todos sus tickets, órdenes y envíos
  window.currentJuntaFilterTipo = 'todos';
  document.querySelectorAll('.junta-type-btn').forEach(btn => {
    if (btn.getAttribute('data-tipo') === 'todos') btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Limpiar filtro urgencia si estuviera activo
  window.currentJuntaFilterUrgente = false;
  const btnUrg = document.getElementById('junta-urgente-toggle-btn');
  if (btnUrg) btnUrg.classList.remove('active');

  // Actualizar badges
  const badgeCausa = document.getElementById('junta-causa-active-badge');
  if (badgeCausa) badgeCausa.style.display = 'none';

  const badgeResp = document.getElementById('junta-resp-active-badge');
  const textResp = document.getElementById('junta-resp-active-text');
  if (badgeResp && textResp) {
    textResp.textContent = respNombre;
    badgeResp.style.display = 'inline-flex';
  }

  // Asegurar vista de tarjetas para ver los casos
  window.setJuntaViewMode('tarjetas');
  window.renderJuntaRevision();

  // Desplazar la vista suavemente hacia la barra de filtros/tarjetas
  setTimeout(() => {
    const targetEl = document.querySelector('.junta-filter-bar') || document.getElementById('junta-cards-container');
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 60);
};

// Quitar filtro activo de responsable
function quitarFiltroResponsableJunta() {
  window.currentJuntaFilterResponsable = 'todos';
  const selResp = document.getElementById('junta-filter-responsable');
  if (selResp) selResp.value = 'todos';
  const badgeResp = document.getElementById('junta-resp-active-badge');
  if (badgeResp) badgeResp.style.display = 'none';
  window.renderJuntaRevision();
};

// ACCIÓN RÁPIDA 1: Reasignar Responsable/Técnico al vuelo (Opción 4)
async function juntaReasignarTecnico(tipo, id, nuevoResponsable) {
  if (!nuevoResponsable) return;

  try {
    const valFinal = (nuevoResponsable === 'Sin Asignar' || nuevoResponsable === '-') ? '' : nuevoResponsable;

    if (tipo === 'ticket') {
      const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
      const t = tkts.find(x => x.id === id);
      if (t) {
        const oldAsignado = t.asignado || t.asignadoA || 'Sin asignar';
        t.asignado = valFinal;
        t.asignadoA = valFinal;
        delete t.tecnico;
        t.tecnicosAsignados = [];
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
        if (window.pushToSupabase) await window.pushToSupabase('tickets', t);
        if (typeof window.generarNotificacionInterna === 'function') {
          window.generarNotificacionInterna(t, oldAsignado, nuevoResponsable);
        }
      }
    } else if (tipo === 'orden') {
      const ords = (typeof ordenes !== 'undefined' && ordenes) ? ordenes : [];
      const o = ords.find(x => x.id === id);
      if (o) {
        o.tecnico = valFinal;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_ordenes', ordenes);
        if (window.pushToSupabase) await window.pushToSupabase('ordenes', o);
      }
    } else if (tipo === 'levantamiento') {
      const levs = (typeof levantamientos !== 'undefined' && levantamientos) ? levantamientos : (_safeGet('sapi_levantamientos', []));
      const l = levs.find(x => x.id === id);
      if (l) {
        l.tecnico_asignado = valFinal;
        l.asignado_a = valFinal;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
        if (window.pushToSupabase) await window.pushToSupabase('levantamientos', l);
      }
    } else if (tipo === 'envio') {
      const envs = (typeof envios !== 'undefined' && envios) ? envios : (_safeGet('sapi_envios_db', []));
      const e = envs.find(x => x.id === id);
      if (e) {
        e.responsable = valFinal;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_envios_db', envs);
        if (window.pushToSupabase) await window.pushToSupabase('envios', e);
      }
    }

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`✅ Reasignado a ${nuevoResponsable} con éxito.`, 'success');
    }
    window.poblarFiltrosJuntaSelectores();
    window.renderJuntaRevision();
  } catch(err) {
    console.error('Error al reasignar responsable:', err);
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Error al reasignar: ' + err.message, 'error');
  }
};

// ACCIÓN RÁPIDA 2: Alternar Prioridad Urgente en 1 Clic (Opción 4)
async function juntaToggleUrgente(tipo, id) {
  try {
    let nuevaPrioridad = 'Urgente';

    if (tipo === 'ticket') {
      const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
      const t = tkts.find(x => x.id === id);
      if (t) {
        nuevaPrioridad = (t.prioridad === 'Urgente') ? 'Media' : 'Urgente';
        t.prioridad = nuevaPrioridad;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
        if (window.pushToSupabase) await window.pushToSupabase('tickets', t);
      }
    } else if (tipo === 'orden') {
      const ords = (typeof ordenes !== 'undefined' && ordenes) ? ordenes : [];
      const o = ords.find(x => x.id === id);
      if (o) {
        nuevaPrioridad = (o.prioridad === 'Urgente') ? 'Media' : 'Urgente';
        o.prioridad = nuevaPrioridad;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_ordenes', ordenes);
        if (window.pushToSupabase) await window.pushToSupabase('ordenes', o);
      }
    } else if (tipo === 'levantamiento') {
      const levs = (typeof levantamientos !== 'undefined' && levantamientos) ? levantamientos : (_safeGet('sapi_levantamientos', []));
      const l = levs.find(x => x.id === id);
      if (l) {
        nuevaPrioridad = (l.prioridad === 'Urgente') ? 'Media' : 'Urgente';
        l.prioridad = nuevaPrioridad;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
        if (window.pushToSupabase) await window.pushToSupabase('levantamientos', l);
      }
    }

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(`Prioridad actualizada a: ${nuevaPrioridad}`, 'info');
    }
    window.renderJuntaRevision();
  } catch(err) {
    console.error('Error al cambiar prioridad:', err);
  }
};

// ACCIÓN RÁPIDA 3: Definir Fecha Compromiso / Deadline (Opción 4)
function juntaSetDeadlinePrompt(tipo, id, fechaActual) {
  const inputFecha = prompt('Fecha límite / compromiso acordada en junta (AAAA-MM-DD):', fechaActual ? fechaActual.substring(0,10) : new Date().toISOString().substring(0,10));
  if (inputFecha === null) return;
  window.juntaGuardarFechaCompromiso(tipo, id, inputFecha.trim());
};

async function juntaGuardarFechaCompromiso(tipo, id, fechaStr) {
  try {
    if (tipo === 'ticket') {
      const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
      const t = tkts.find(x => x.id === id);
      if (t) {
        t.fechaCompromiso = fechaStr || null;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
        if (window.pushToSupabase) await window.pushToSupabase('tickets', t);
      }
    } else if (tipo === 'orden') {
      const ords = (typeof ordenes !== 'undefined' && ordenes) ? ordenes : [];
      const o = ords.find(x => x.id === id);
      if (o) {
        o.fechaCompromiso = fechaStr || null;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_ordenes', ordenes);
        if (window.pushToSupabase) await window.pushToSupabase('ordenes', o);
      }
    } else if (tipo === 'levantamiento') {
      const levs = (typeof levantamientos !== 'undefined' && levantamientos) ? levantamientos : (_safeGet('sapi_levantamientos', []));
      const l = levs.find(x => x.id === id);
      if (l) {
        l.fechaCompromiso = fechaStr || null;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
        if (window.pushToSupabase) await window.pushToSupabase('levantamientos', l);
      }
    }

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion(fechaStr ? `📅 Compromiso fijado para el ${fechaStr}` : 'Compromiso eliminado', 'success');
    }
    window.renderJuntaRevision();
  } catch(err) {
    console.error('Error al fijar fecha compromiso:', err);
  }
};

// Acciones de filtrado
function aplicarFiltrosJunta() {
  const selResp = document.getElementById('junta-filter-responsable');
  if (selResp) {
    window.currentJuntaFilterResponsable = selResp.value || 'todos';
    const badgeResp = document.getElementById('junta-resp-active-badge');
    const textResp = document.getElementById('junta-resp-active-text');
    if (badgeResp && textResp) {
      if (selResp.value && selResp.value !== 'todos') {
        textResp.textContent = selResp.options[selResp.selectedIndex]?.text || selResp.value;
        badgeResp.style.display = 'inline-flex';
      } else {
        badgeResp.style.display = 'none';
      }
    }
  }
  window.renderJuntaRevision();
};

function setJuntaTipoFiltro(tipo) {
  window.currentJuntaFilterTipo = tipo || 'todos';
  
  // Actualizar botones de tipo
  document.querySelectorAll('.junta-type-btn').forEach(btn => {
    if (btn.getAttribute('data-tipo') === window.currentJuntaFilterTipo) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Actualizar KPI cards
  document.querySelectorAll('.junta-kpi-card').forEach(c => c.classList.remove('active'));
  const targetKpi = document.getElementById(`kpi-card-${window.currentJuntaFilterTipo}`);
  if (targetKpi) targetKpi.classList.add('active');

  window.renderJuntaRevision();
};

function setJuntaAntiguedadFiltro(antiguedad) {
  window.currentJuntaFilterAntiguedad = antiguedad || 'todos';
  const sel = document.getElementById('junta-filter-antiguedad');
  if (sel) sel.value = window.currentJuntaFilterAntiguedad;

  // Si se hizo clic en KPI de Alerta > 7 días, activar su card
  if (antiguedad === 'alerta_7') {
    document.querySelectorAll('.junta-kpi-card').forEach(c => c.classList.remove('active'));
    const kpiAlert = document.getElementById('kpi-card-alertas');
    if (kpiAlert) kpiAlert.classList.add('active');
  }

  window.renderJuntaRevision();
};

function toggleJuntaUrgenteFiltro() {
  window.currentJuntaFilterUrgente = !window.currentJuntaFilterUrgente;
  const btn = document.getElementById('junta-urgente-toggle-btn');
  if (btn) {
    if (window.currentJuntaFilterUrgente) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  window.renderJuntaRevision();
};

function resetFiltrosJunta() {
  window.currentJuntaFilterTipo = 'todos';
  window.currentJuntaFilterAntiguedad = 'todos';
  window.currentJuntaFilterUrgente = false;
  window.currentJuntaFilterCausa = 'todos';
  window.currentJuntaFilterResponsable = 'todos';
  
  const inSearch = document.getElementById('junta-search-input');
  if (inSearch) inSearch.value = '';
  const selCli = document.getElementById('junta-filter-cliente');
  if (selCli) selCli.value = 'todos';
  const selResp = document.getElementById('junta-filter-responsable');
  if (selResp) selResp.value = 'todos';
  const selAnt = document.getElementById('junta-filter-antiguedad');
  if (selAnt) selAnt.value = 'todos';
  const selSort = document.getElementById('junta-sort-by');
  if (selSort) selSort.value = 'antiguedad_desc';

  const badgeCausa = document.getElementById('junta-causa-active-badge');
  if (badgeCausa) badgeCausa.style.display = 'none';

  const badgeResp = document.getElementById('junta-resp-active-badge');
  if (badgeResp) badgeResp.style.display = 'none';

  const btnUrg = document.getElementById('junta-urgente-toggle-btn');
  if (btnUrg) btnUrg.classList.remove('active');

  document.querySelectorAll('.junta-type-btn').forEach(btn => {
    if (btn.getAttribute('data-tipo') === 'todos') btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.querySelectorAll('.junta-kpi-card').forEach(c => c.classList.remove('active'));
  const kpiTodos = document.getElementById('kpi-card-todos');
  if (kpiTodos) kpiTodos.classList.add('active');

  window.renderJuntaRevision();
};

// Abre modal de detalle nativo sin romper el contexto
function abrirDetalleElementoJunta(tipo, id) {
  if (tipo === 'ticket') {
    if (typeof verDetalleTicket === 'function') verDetalleTicket(id);
  } else if (tipo === 'orden') {
    if (typeof verDetalle === 'function') verDetalle(id);
  } else if (tipo === 'envio') {
    if (typeof window.abrirDetalleEnvio === 'function') window.abrirDetalleEnvio(id);
  } else if (tipo === 'levantamiento') {
    if (typeof verDetalleLevantamiento === 'function') verDetalleLevantamiento(id);
  }
};

// Toggle caja de acuerdo rápido
function toggleNotaRapidaJunta(tipo, id) {
  const box = document.getElementById(`junta-quicknote-box-${tipo}-${id}`);
  if (!box) return;

  const isHidden = box.style.display === 'none';
  box.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    const input = document.getElementById(`junta-quicknote-input-${tipo}-${id}`);
    if (input) setTimeout(() => input.focus(), 50);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// Guardar nota rápida de junta
async function guardarNotaRapidaJunta(tipo, id) {
  const input = document.getElementById(`junta-quicknote-input-${tipo}-${id}`);
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Escribe el texto del acuerdo antes de guardar.', 'warning');
    return;
  }

  const uNom = (typeof currentSession !== 'undefined' && currentSession.nombre) 
    ? currentSession.nombre 
    : ((typeof usuarios !== 'undefined' && currentSession && currentSession.userId) 
        ? (usuarios.find(u => u.id === currentSession.userId)?.nombre || 'Usuario') 
        : 'Equipo Operativo');

  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const textoFormateado = `[Acuerdo Junta ${fechaHoy}]: ${texto}`;

  const nuevoComentario = {
    usuario: uNom,
    fecha: new Date().toISOString(),
    texto: textoFormateado
  };

  try {
    if (tipo === 'ticket') {
      const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
      const t = tkts.find(x => x.id === id);
      if (t) {
        if (!t.comentariosInternos) t.comentariosInternos = [];
        t.comentariosInternos.push(nuevoComentario);
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
        if (window.pushToSupabase) await window.pushToSupabase('tickets', t);
      }
    } else if (tipo === 'orden') {
      const ords = (typeof ordenes !== 'undefined' && ordenes) ? ordenes : [];
      const o = ords.find(x => x.id === id);
      if (o) {
        if (!o.comentariosInternos) o.comentariosInternos = [];
        o.comentariosInternos.push(nuevoComentario);
        // También anexar a bitácora para visibilidad en campo
        o.bitacora = (o.bitacora ? `${o.bitacora}\n\n` : '') + `[Acuerdo Junta ${fechaHoy} - ${uNom}]: ${texto}`;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_ordenes', ordenes);
        if (window.pushToSupabase) await window.pushToSupabase('ordenes', o);
      }
    } else if (tipo === 'envio') {
      const todosEnv = (typeof window.obtenerTodosLosEnvios === 'function') ? window.obtenerTodosLosEnvios() : [];
      const e = todosEnv.find(x => x.id === id);
      if (e) {
        e.notas = (e.notas ? `${e.notas}\n` : '') + `[Acuerdo Junta ${fechaHoy}]: ${texto}`;
        if (e.ticketId) {
          const t = (typeof tickets !== 'undefined' && tickets) ? tickets.find(x => x.id === e.ticketId) : null;
          if (t && t.envios) {
            const envObj = t.envios.find(x => x.id === id);
            if (envObj) envObj.notas = e.notas;
            if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
            if (window.pushToSupabase) await window.pushToSupabase('tickets', t);
          }
        }
      }
    } else if (tipo === 'levantamiento') {
      const levs = (typeof levantamientos !== 'undefined' && levantamientos) ? levantamientos : (_safeGet('sapi_levantamientos', []));
      const l = levs.find(x => x.id === id);
      if (l) {
        l.notas = (l.notas ? `${l.notas}\n\n` : '') + `[Acuerdo Junta ${fechaHoy} - ${uNom}]: ${texto}`;
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
        if (window.pushToSupabase) await window.pushToSupabase('levantamientos', l);
      }
    }

    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Acuerdo de junta guardado correctamente.', 'success');
    }
    input.value = '';
    window.renderJuntaRevision();
  } catch(err) {
    console.error('Error al guardar acuerdo de junta:', err);
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('Error al guardar el acuerdo: ' + err.message, 'error');
  }
};

// Generador y copia de Minuta de Junta al portapapeles
function copiarMinutaJunta() {
  const lista = window.juntaItemsFiltradosCache || window.obtenerTodosLosPendientes();
  if (lista.length === 0) {
    if (typeof mostrarNotificacion === 'function') mostrarNotificacion('No hay pendientes visibles para generar la minuta.', 'warning');
    return;
  }

  const fechaStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const horaStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  let minuta = `📋 *MINUTA DE REVISIÓN OPERATIVA - EUROREP*\n`;
  minuta += `📅 *Fecha:* ${fechaStr} - ${horaStr}\n`;
  minuta += `👥 *Total de Pendientes Analizados:* ${lista.length}\n`;
  minuta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Agrupar por tipo
  const tks = lista.filter(x => x.tipo === 'ticket');
  const ords = lista.filter(x => x.tipo === 'orden');
  const envs = lista.filter(x => x.tipo === 'envio');
  const levs = lista.filter(x => x.tipo === 'levantamiento');

  if (tks.length > 0) {
    minuta += `🎫 *TICKETS Y COTIZACIONES PENDIENTES (${tks.length})*\n`;
    tks.forEach((t, i) => {
      minuta += `${i+1}. [${t.folio}] *${t.cliente}* (${t.sitio})\n`;
      minuta += `   • *Asunto:* ${t.titulo}\n`;
      minuta += `   • *Antigüedad:* ${t.tiempoRelativo} | *Asignado:* ${t.responsable}\n`;
      minuta += `   • ⚠️ *Cuello de Botella:* ${t.cuelloDeBotella}\n`;
      if (t.fechaCompromiso) {
        minuta += `   • 📅 *Compromiso Acordado:* ${t.fechaCompromiso}\n`;
      }
      if (t.ultimoComentario) {
        minuta += `   • 💬 *Último Comentario (${t.ultimoComentario.usuario}):* ${t.ultimoComentario.texto}\n`;
      }
      minuta += `\n`;
    });
    minuta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  if (ords.length > 0) {
    minuta += `🛠️ *ÓRDENES DE SERVICIO PENDIENTES (${ords.length})*\n`;
    ords.forEach((o, i) => {
      minuta += `${i+1}. [${o.folio}] *${o.cliente}* (${o.sitio})\n`;
      minuta += `   • *Servicio:* ${o.titulo}\n`;
      minuta += `   • *Antigüedad:* ${o.tiempoRelativo} | *Técnico:* ${o.responsable}\n`;
      minuta += `   • ⚠️ *Cuello de Botella:* ${o.cuelloDeBotella}\n`;
      if (o.fechaCompromiso) {
        minuta += `   • 📅 *Compromiso Acordado:* ${o.fechaCompromiso}\n`;
      }
      if (o.ultimoComentario) {
        minuta += `   • 💬 *Último Reporte:* ${o.ultimoComentario.texto}\n`;
      }
      minuta += `\n`;
    });
    minuta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  if (envs.length > 0) {
    minuta += `🚚 *ENVÍOS Y GUÍAS DE REFACCIONES (${envs.length})*\n`;
    envs.forEach((e, i) => {
      minuta += `${i+1}. [${e.folio}] *${e.cliente}*\n`;
      minuta += `   • *Detalle:* ${e.titulo}\n`;
      minuta += `   • *Antigüedad:* ${e.tiempoRelativo} | *Paquetería:* ${e.responsable}\n`;
      minuta += `   • ⚠️ *Estatus:* ${e.cuelloDeBotella}\n\n`;
    });
    minuta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  if (levs.length > 0) {
    minuta += `📋 *LEVANTAMIENTOS DE CAMPO (${levs.length})*\n`;
    levs.forEach((l, i) => {
      minuta += `${i+1}. [${l.folio}] *${l.cliente}* (${l.sitio})\n`;
      minuta += `   • *Antigüedad:* ${l.tiempoRelativo} | *Responsable:* ${l.responsable}\n`;
      minuta += `   • ⚠️ *Cuello de Botella:* ${l.cuelloDeBotella}\n\n`;
    });
    minuta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  minuta += `📌 *Generado automáticamente desde Eurorep SAPI Platform*`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(minuta).then(() => {
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('¡Minuta de junta copiada al portapapeles! Lista para pegar en WhatsApp o Teams.', 'success');
      } else {
        alert('Minuta copiada al portapapeles.');
      }
    }).catch(err => {
      console.warn('Error al copiar minuta:', err);
      prompt('Copia el texto de la minuta:', minuta);
    });
  } else {
    prompt('Copia el texto de la minuta:', minuta);
  }
};

// Actualiza el badge en la pestaña del dashboard
function actualizarBadgeJuntaRevision(totalCount) {
  let count = totalCount;
  if (count === undefined) {
    const todos = window.obtenerTodosLosPendientes();
    count = todos.length;
  }
  const badgeTab = document.getElementById('dash-tab-badge-junta');
  if (badgeTab) {
    if (count > 0) {
      badgeTab.textContent = count;
      badgeTab.style.display = 'inline-flex';
    } else {
      badgeTab.style.display = 'none';
    }
  }
};

// Atajo de teclado Alt + J para ir directo a la pestaña de Revisión de Juntas
if (typeof document !== 'undefined') document.addEventListener('keydown', function(e) {
  if (e.altKey && (e.key === 'j' || e.key === 'J')) {
    e.preventDefault();
    window.abrirModalJuntaRevision();
  } else if (e.key === 'Escape') {
    if (window.currentJuntaFullscreen) {
      window.toggleFullscreenJunta();
    }
  }
});

if (typeof window !== 'undefined') {
  window.reestablecerTicket26477 = reestablecerTicket26477;
  window.obtenerListaSupervisoresJunta = obtenerListaSupervisoresJunta;
  window.obtenerListaTecnicosJunta = obtenerListaTecnicosJunta;
  window.obtenerTodosLosPendientes = obtenerTodosLosPendientes;
  window.abrirModalJuntaRevision = abrirModalJuntaRevision;
  window.cerrarModalJuntaRevision = cerrarModalJuntaRevision;
  window.toggleFullscreenJunta = toggleFullscreenJunta;
  window.toggleJuntaAnalytics = toggleJuntaAnalytics;
  window.toggleJuntaResponsablesTable = toggleJuntaResponsablesTable;
  window.juntaFiltrarPorCausa = juntaFiltrarPorCausa;
  window.setJuntaViewMode = setJuntaViewMode;
  window.poblarFiltrosJuntaSelectores = poblarFiltrosJuntaSelectores;
  window.renderJuntaBottleneckAnalytics = renderJuntaBottleneckAnalytics;
  window.renderJuntaResponsablesTable = renderJuntaResponsablesTable;
  window.generarHtmlTarjetaJunta = generarHtmlTarjetaJunta;
  window.renderJuntaRevision = renderJuntaRevision;
  window.filtrarSoloEsteTecnico = filtrarSoloEsteTecnico;
  window.quitarFiltroResponsableJunta = quitarFiltroResponsableJunta;
  window.juntaReasignarTecnico = juntaReasignarTecnico;
  window.juntaToggleUrgente = juntaToggleUrgente;
  window.juntaSetDeadlinePrompt = juntaSetDeadlinePrompt;
  window.juntaGuardarFechaCompromiso = juntaGuardarFechaCompromiso;
  window.aplicarFiltrosJunta = aplicarFiltrosJunta;
  window.setJuntaTipoFiltro = setJuntaTipoFiltro;
  window.setJuntaAntiguedadFiltro = setJuntaAntiguedadFiltro;
  window.toggleJuntaUrgenteFiltro = toggleJuntaUrgenteFiltro;
  window.resetFiltrosJunta = resetFiltrosJunta;
  window.abrirDetalleElementoJunta = abrirDetalleElementoJunta;
  window.toggleNotaRapidaJunta = toggleNotaRapidaJunta;
  window.guardarNotaRapidaJunta = guardarNotaRapidaJunta;
  window.copiarMinutaJunta = copiarMinutaJunta;
  window.actualizarBadgeJuntaRevision = actualizarBadgeJuntaRevision;
  window.juntaRespTableVisible = juntaRespTableVisible;
}

export {
  reestablecerTicket26477,
  obtenerListaSupervisoresJunta,
  obtenerListaTecnicosJunta,
  obtenerTodosLosPendientes,
  abrirModalJuntaRevision,
  cerrarModalJuntaRevision,
  toggleFullscreenJunta,
  toggleJuntaAnalytics,
  toggleJuntaResponsablesTable,
  juntaFiltrarPorCausa,
  setJuntaViewMode,
  poblarFiltrosJuntaSelectores,
  renderJuntaBottleneckAnalytics,
  renderJuntaResponsablesTable,
  generarHtmlTarjetaJunta,
  renderJuntaRevision,
  filtrarSoloEsteTecnico,
  quitarFiltroResponsableJunta,
  juntaReasignarTecnico,
  juntaToggleUrgente,
  juntaSetDeadlinePrompt,
  juntaGuardarFechaCompromiso,
  aplicarFiltrosJunta,
  setJuntaTipoFiltro,
  setJuntaAntiguedadFiltro,
  toggleJuntaUrgenteFiltro,
  resetFiltrosJunta,
  abrirDetalleElementoJunta,
  toggleNotaRapidaJunta,
  guardarNotaRapidaJunta,
  copiarMinutaJunta,
  actualizarBadgeJuntaRevision,
  juntaRespTableVisible
};
