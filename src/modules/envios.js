/**
 * Módulo de Envíos y Guías de Paquetería - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { cleanMojibake, normStr, safeFormatDate, formatFechaHoraAmigable, urlToDataUri } from "../utils.js";
import { supabaseClient } from "../supabaseClient.js";
/**
 * Módulo de Envíos y Guías de Paquetería - Eurorep / SAPI
 * Generador de rastreo multicarrier, vinculación de guías con tickets y modales operativos.
 */
// ============================================================
// MÓDULO DE ENVÍOS Y GUÍAS DE PAQUETERÍA (EURO SAPI)
// ============================================================
let currentEnviosFiltroEstado = 'todos';
let currentEnviosFiltroPaqueteria = 'todas';
let _enviosFiltradosActuales = null;
let currentEnviosSearchQuery = '';
let editandoEnvioId = null;

function setFiltroEstadoEnviosChip(estado, btnEl) {
  currentEnviosFiltroEstado = estado || 'todos';
  if (typeof window !== 'undefined') window.currentEnviosFiltroEstado = currentEnviosFiltroEstado;

  const selectEstado = document.getElementById('filter-envios-estado');
  if (selectEstado) {
    selectEstado.value = currentEnviosFiltroEstado;
  }

  const chips = document.querySelectorAll('#mobile-envios-chips .status-chip');
  if (chips && chips.length > 0) {
    chips.forEach(chip => {
      const chipEstado = chip.getAttribute('data-estado');
      if (chipEstado === currentEnviosFiltroEstado) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  renderEnvios();
}

function syncSearchEnvios(val) {
  const deskInput = document.getElementById('search-envios');
  const mobInput = document.getElementById('mobile-search-envios');
  const clearBtn = document.getElementById('btn-clear-search-envios');

  if (deskInput && deskInput.value !== val) deskInput.value = val;
  if (mobInput && mobInput.value !== val) mobInput.value = val;
  if (clearBtn) {
    clearBtn.style.display = (val && val.length > 0) ? 'flex' : 'none';
  }

  if (typeof window !== 'undefined' && typeof window.debouncedRenderEnvios === 'function') {
    window.debouncedRenderEnvios();
  } else {
    renderEnvios();
  }
}

function clearSearchEnvios() {
  const deskInput = document.getElementById('search-envios');
  const mobInput = document.getElementById('mobile-search-envios');
  const clearBtn = document.getElementById('btn-clear-search-envios');

  if (mobInput) mobInput.value = '';
  if (deskInput) deskInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';

  renderEnvios();
}

// Generador de URLs inteligentes de rastreo según la transportista
function obtenerUrlRastreoPaqueteria(paqueteria, guia) {
  if (!guia) return '';
  const g = String(guia).trim();
  const paq = String(paqueteria || '').toLowerCase().trim();

  if (paq.includes('dhl')) {
    return `https://www.dhl.com/mx-es/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(g)}`;
  } else if (paq.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(g)}`;
  } else if (paq.includes('estafeta')) {
    return `https://www.estafeta.com/Herramientas/Rastreo?guia=${encodeURIComponent(g)}`;
  } else if (paq.includes('paquetexpress') || paq.includes('paquete express')) {
    return `https://www.paquetexpress.com.mx/rastreo-de-guias?guias=${encodeURIComponent(g)}`;
  } else if (paq.includes('redpack')) {
    return `https://www.redpack.com.mx/rastreo-de-envios/?guia=${encodeURIComponent(g)}`;
  } else if (paq.includes('castores')) {
    return `https://www.castores.com.mx/rastreo?guia=${encodeURIComponent(g)}`;
  } else if (paq.includes('tresguerras') || paq.includes('tres guerras') || paq.includes('3g')) {
    return `https://www.tresguerras.com.mx/3G/tracking.php?guia=${encodeURIComponent(g)}`;
  } else if (paq.includes('sendex')) {
    return `https://www.sendex.mx/rastreo/?guia=${encodeURIComponent(g)}`;
  } else if (paq.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(g)}`;
  }
  return '';
};

// Comprueba si un ticket cuenta con piezas reales por despachar y un pedido formal o guía explícita
function ticketTienePedidoOEnvioValido(ticket) {
  if (!ticket) return false;

  const cat = String(ticket.categoria || '').toLowerCase();
  const hasDirectParts = Array.isArray(ticket.refaccionesSeleccionadas) && ticket.refaccionesSeleccionadas.length > 0;
  const isSubticketA = ticket.folio && String(ticket.folio).endsWith('-A');
  const hasExplicitGuia = !!(ticket.guiaPedido && String(ticket.guiaPedido).trim());
  const hasExplicitEnvios = Array.isArray(ticket.envios) && ticket.envios.length > 0;
  const hasRealEnvio = hasExplicitEnvios && ticket.envios.some(e => {
    if (!e) return false;
    const tieneGuia = String(e.guiaPedido || '').trim().length > 0;
    const paqDefinida = String(e.paqueteria || '').trim().toLowerCase();
    const tienePaqReal = paqDefinida && paqDefinida !== 'por definir' && paqDefinida !== 'sin definir';
    return tieneGuia || tienePaqReal;
  });

  // Verificar si tiene refacciones asociadas en orden de servicio
  let hasAssocParts = false;
  if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
    const assocOrder = typeof window.obtenerOrdenAsociadaATicketRefacciones === 'function'
      ? window.obtenerOrdenAsociadaATicketRefacciones(ticket)
      : ordenes.find(o => o.soporte === ticket.id || o.folio === (ticket.folio || '').replace('-A', ''));
    if (assocOrder && Array.isArray(assocOrder.ref_necesarias) && assocOrder.ref_necesarias.length > 0) {
      hasAssocParts = true;
    }
  }

  // REGLA FUNDAMENTAL: Para que exista un envío, debe haber piezas que enviar (o una guía/paquetería explícita ya capturada)
  const tienePiezasParaEnviar = hasDirectParts || hasAssocParts || isSubticketA || hasExplicitGuia || hasRealEnvio;
  if (!tienePiezasParaEnviar) {
    return false;
  }

  const isRefaccionTicket = cat.includes('refacci') || cat.includes('garant') || isSubticketA || hasDirectParts || hasAssocParts || hasExplicitGuia || hasRealEnvio;
  if (!isRefaccionTicket) return false;

  // Si ya tiene una guía explícita o envío real capturado por el usuario, califica de inmediato
  if (hasExplicitGuia || hasRealEnvio) return true;

  // Comprobar si tiene pedido confirmado (SAP, PDF, paquetería o piezas en proceso)
  const pedSAP = String(ticket.pedidoSAP || ticket.pedido_sap || '').trim();
  const tienePedidoSAP = pedSAP && pedSAP !== '-' && pedSAP.toLowerCase() !== 'sin pedido' && pedSAP.toLowerCase() !== 's/n';
  
  const pdfPed = String(ticket.pdfPedido || ticket.pdf_pedido || '').trim();
  const tienePdfPedido = pdfPed && pdfPed !== '-' && pdfPed.toLowerCase() !== 'null';

  const paq = String(ticket.paqueteria || '').trim().toLowerCase();
  const tienePaqueteria = paq && paq !== 'por definir' && paq !== 'sin definir';

  const parts = Array.isArray(ticket.refaccionesSeleccionadas) ? ticket.refaccionesSeleccionadas : [];
  const algunaPiezaPedida = parts.some(p => {
    const est = String(p.estatusPedido || '').toLowerCase().trim();
    return est && est !== 'por pedir' && est !== 'sin pedir' && est !== 'en cotizacion' && est !== 'en cotización' && est !== 'pendiente';
  });

  const estado = String(ticket.estado || '').toLowerCase().trim();
  const esCotizacion = estado === 'cotización' || estado === 'cotizacion';

  // Si el ticket está en fase de Cotización y NO tiene pedido SAP, ni PDF, ni piezas pedidas, NO genera envío
  if (esCotizacion && !tienePedidoSAP && !tienePdfPedido && !algunaPiezaPedida) {
    return false;
  }

  // Si tiene Pedido SAP, PDF de Pedido, Paquetería o Piezas en proceso, califica
  if (tienePedidoSAP || tienePdfPedido || tienePaqueteria || algunaPiezaPedida) {
    return true;
  }

  // Si es subticket de refacciones (-A) o está en estado de Refacciones en proceso
  if (isSubticketA || estado === 'refacciones') {
    return true;
  }

  // Si está cerrado pero tenía refacciones confirmadas en catálogo
  if (estado === 'cerrado' && (hasDirectParts || hasAssocParts)) {
    return true;
  }

  return false;
}

// Genera o asegura una guía de envío en estado 'En Preparación' ÚNICAMENTE cuando el ticket ya tiene pedido confirmado
function asegurarGuiaEnvioParaTicket(ticket) {
  if (!ticket) return null;
  const parts = ticket.refaccionesSeleccionadas || [];
  const cat = String(ticket.categoria || '').toLowerCase();
  const isRef = cat.includes('refacci') || cat.includes('garant') || (ticket.folio && ticket.folio.endsWith('-A')) || parts.length > 0;
  if (!isRef) return null;

  // REGLA CLAVE DE NEGOCIO: No generar guía si el ticket aún está en cotización sin pedido
  if (!ticketTienePedidoOEnvioValido(ticket)) {
    return null;
  }

  if (!ticket.envios) ticket.envios = [];

  // Si ya tiene al menos una guía de envío registrada, no duplicar
  if (ticket.envios.length > 0) {
    if (ticket.envios[0] && (!ticket.envios[0].parts || ticket.envios[0].parts.length === 0) && parts.length > 0) {
      ticket.envios[0].parts = parts.map(p => ({
        clave: p.clave || p.codigo || '',
        descripcion: p.descripcion || p.nombre || '',
        cantidad: p.cantidad || 1
      }));
      if (window.pushToSupabase) window.pushToSupabase('envios', ticket.envios[0]).catch(err => console.warn('[Envios Auto Sync] Error:', err));
    }
    return ticket.envios[0];
  }

  // Generar nueva guía de envío automática
  const nuevoEnvio = {
    id: `env-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ticketId: ticket.id,
    ticketFolio: ticket.folio || ticket.id,
    ticketAsunto: ticket.asunto || '',
    cliente: ticket.cliente || 'Sin cliente',
    sitio: ticket.sitio || 'General',
    paqueteria: 'Por Definir',
    guiaPedido: '',
    urlRastreo: '',
    fechaEnvio: new Date().toISOString().split('T')[0],
    fechaPedido: new Date().toISOString().split('T')[0],
    fechaEntrega: '',
    fechaLlegada: '',
    llego: false,
    estatus: 'En Preparación',
    parts: parts.map(p => ({
      clave: p.clave || p.codigo || '',
      descripcion: p.descripcion || p.nombre || '',
      cantidad: p.cantidad || 1
    })),
    pdfGuia: '',
    notas: 'Guía generada automáticamente al confirmar solicitud de refacciones.'
  };

  ticket.envios.push(nuevoEnvio);

  // Guardar en sapi_envios_db y sincronizar a Supabase
  try {
    const dbEnvios = JSON.parse(localStorage.getItem('sapi_envios_db') || '[]');
    if (!dbEnvios.some(e => e.id === nuevoEnvio.id)) {
      dbEnvios.unshift(nuevoEnvio);
      localStorage.setItem('sapi_envios_db', JSON.stringify(dbEnvios));
    }
    if (typeof safeSetJSON === 'function' && typeof tickets !== 'undefined') {
      safeSetJSON('sapi_tickets', tickets);
    }
  } catch(e) {}

  if (window.pushToSupabase) {
    window.pushToSupabase('envios', nuevoEnvio).catch(err => console.warn('[Envios Auto] Error al sincronizar:', err));
  }

  if (typeof window.renderEnvios === 'function') {
    window.renderEnvios();
  }

  return nuevoEnvio;
};

// Obtiene la lista unificada de todas las guías de envío registradas
function obtenerTodosLosEnvios() {
  let tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets) && tickets.length > 0) 
    ? tickets 
    : ((Array.isArray(window.tickets) && window.tickets.length > 0)
      ? window.tickets
      : ((typeof safeGetJSON === 'function' ? safeGetJSON('sapi_tickets', []) : (typeof window.safeGetJSON === 'function' ? window.safeGetJSON('sapi_tickets', []) : JSON.parse(localStorage.getItem('sapi_tickets') || '[]'))) || []));

  if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
    const activeSandbox = isTestModeActive();
    tkts = tkts.filter(t => isTestData(t) === activeSandbox);
  }

  const enviosList = [];

  tkts.forEach(t => {
    // REGLA FUNDAMENTAL DE NEGOCIO:
    // Los tickets en fase de cotización sin pedido en firme NO deben generar ni mostrar guías de envío
    if (!ticketTienePedidoOEnvioValido(t)) return;

    let envios = t.envios || [];
    const cat = String(t.categoria || '').toLowerCase();
    const hasDirectParts = Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0;
    const isSubticketA = t.folio && t.folio.endsWith('-A');
    const hasExplicitGuia = !!(t.guiaPedido && t.guiaPedido.trim());
    const isRef = cat.includes('refacci') || cat.includes('garant') || isSubticketA;

    // Buscar refacciones en orden de servicio asociada si no las tiene directamente
    let partsList = (t.refaccionesSeleccionadas || []).map(p => ({
      clave: p.clave || p.codigo || '',
      descripcion: p.descripcion || p.nombre || '',
      cantidad: p.cantidad || 1,
      estatusPedido: p.estatusPedido || 'Por Pedir'
    }));

    if (partsList.length === 0 && typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
      const assocOrder = typeof window.obtenerOrdenAsociadaATicketRefacciones === 'function'
        ? window.obtenerOrdenAsociadaATicketRefacciones(t)
        : ordenes.find(o => o.soporte === t.id || o.folio === (t.folio || '').replace('-A', ''));
      if (assocOrder && Array.isArray(assocOrder.ref_necesarias) && assocOrder.ref_necesarias.length > 0) {
        partsList = assocOrder.ref_necesarias.map(p => ({
          clave: p.clave || p.codigo || '',
          descripcion: p.descripcion || p.nombre || '',
          cantidad: p.cantidad || 1,
          estatusPedido: p.estatusPedido || 'Por Pedir'
        }));
      }
    }

    // Fallback inteligente: SOLO para subtickets -A o tickets con guía que describan la pieza en asunto
    if (partsList.length === 0 && (isSubticketA || hasExplicitGuia)) {
      const fallbackDesc = (t.asunto || t.descripcion || t.concepto || '').trim();
      if (fallbackDesc) {
        partsList = [{
          clave: 'S/C',
          descripcion: fallbackDesc,
          cantidad: 1,
          estatusPedido: t.estatusPedido || 'Por Pedir'
        }];
      }
    }

    const hasAnyParts = partsList.length > 0;

    // Solo incluir tickets que realmente tengan refacciones, guías o sean subticket de refacciones (-A)
    const shouldHaveEnvio = (envios.length > 0) || hasDirectParts || hasAnyParts || isSubticketA || hasExplicitGuia;

    if (!shouldHaveEnvio) return;

    // Si es un ticket de refacciones pero no tiene aún un array explícito de envíos, generar su guía inicial
    if (envios.length === 0) {
      const isEntregado = (hasAnyParts && partsList.every(p => p.estatusPedido === 'Entregado al Técnico')) || t.estatusPedido === 'Entregado al Técnico';

      envios = [{
        id: `auto-${t.id}`,
        paqueteria: t.paqueteria || 'Por Definir',
        guiaPedido: t.guiaPedido || '',
        urlRastreo: window.obtenerUrlRastreoPaqueteria(t.paqueteria, t.guiaPedido),
        fechaPedido: t.fechaPedido || (t.fechaCreacion ? t.fechaCreacion.split('T')[0] : (t.fecha ? t.fecha.split('T')[0] : '')),
        fechaEntrega: t.fechaEntrega || '',
        llego: !!isEntregado,
        fechaLlegada: t.fechaEntrega || (isEntregado ? (t.fechaCierre ? t.fechaCierre.split('T')[0] : '') : ''),
        parts: partsList,
        pdfGuia: t.pdfGuia || '',
        notas: t.notas || ''
      }];
    }

    envios.forEach(e => {
      // Determinar estatus del envío con precisión
      let estatus = 'En Preparación';
      const guiaValida = e.guiaPedido && String(e.guiaPedido).trim().length > 0;
      const partesEntregadas = Array.isArray(e.parts) && e.parts.length > 0 && e.parts.every(p => p.estatusPedido === 'Entregado al Técnico');

      if (e.llego || partesEntregadas) {
        estatus = 'Entregado';
      } else if (guiaValida) {
        estatus = 'En Tránsito';
      } else {
        estatus = 'En Preparación';
      }

      enviosList.push({
        id: e.id || Math.random().toString(36).substring(2, 9),
        ticketId: t.id,
        ticketFolio: t.folio || t.id,
        ticketAsunto: t.asunto || '',
        ticketCategoria: t.categoria || 'Refacción',
        cliente: t.cliente || 'Sin cliente',
        sitio: t.sitio || 'General',
        paqueteria: e.paqueteria || 'Por Definir',
        guiaPedido: e.guiaPedido || '',
        urlRastreo: e.urlRastreo || window.obtenerUrlRastreoPaqueteria(e.paqueteria, e.guiaPedido),
        fechaEnvio: e.fechaPedido || e.fechaEnvio || '',
        fechaPedido: e.fechaPedido || e.fechaEnvio || '',
        fechaEntrega: e.fechaEntrega || '',
        fechaLlegada: e.fechaLlegada || '',
        llego: estatus === 'Entregado',
        estatus: estatus,
        parts: (e.parts && e.parts.length > 0) ? e.parts : partsList,
        pdfGuia: e.pdfGuia || '',
        notas: e.notas || ''
      });
    });
  });

  // Incluir envíos independientes desde sapi_envios_db si no están ya en la lista
  try {
    let dbEnvios = JSON.parse(localStorage.getItem('sapi_envios_db') || '[]');
    if (typeof isTestModeActive === 'function' && typeof isTestData === 'function') {
      const activeSandbox = isTestModeActive();
      dbEnvios = dbEnvios.filter(dbe => isTestData(dbe) === activeSandbox);
    }
    dbEnvios.forEach(dbe => {
      // Si el envío pertenece a un ticket, verificar que el ticket realmente tenga pedido válido
      if (dbe.ticketId) {
        const associatedTicket = tkts.find(tk => tk.id === dbe.ticketId || tk.folio === dbe.ticketFolio);
        if (associatedTicket && !ticketTienePedidoOEnvioValido(associatedTicket)) {
          return; // Omitir envío dummy de ticket en cotización sin pedido
        }
        if (associatedTicket) {
          if (!dbe.parts || dbe.parts.length === 0) {
            if (Array.isArray(associatedTicket.refaccionesSeleccionadas) && associatedTicket.refaccionesSeleccionadas.length > 0) {
              dbe.parts = associatedTicket.refaccionesSeleccionadas;
            } else if (associatedTicket.asunto || associatedTicket.descripcion) {
              dbe.parts = [{
                clave: 'S/C',
                descripcion: (associatedTicket.asunto || associatedTicket.descripcion).trim(),
                cantidad: 1,
                estatusPedido: associatedTicket.estatusPedido || 'Por Pedir'
              }];
            }
          }
          if (!dbe.ticketAsunto) dbe.ticketAsunto = associatedTicket.asunto || '';
        }
      }
      if (!enviosList.some(x => x.id === dbe.id)) {
        enviosList.push(dbe);
      }
    });
  } catch(e) {}

  return enviosList;
};

// Limpia envíos ficticios generados en tickets que aún están en cotización sin pedido
function purgarEnviosEnCotizacionSinPedido() {
  try {
    let tkts = (typeof tickets !== 'undefined' && Array.isArray(tickets) && tickets.length > 0)
      ? tickets
      : (typeof window !== 'undefined' && Array.isArray(window.tickets) ? window.tickets : null);
    
    let dbEnvios = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('sapi_envios_db') || '[]') : [];
    let modified = false;

    if (tkts && Array.isArray(tkts)) {
      tkts.forEach(t => {
        if (!ticketTienePedidoOEnvioValido(t) && Array.isArray(t.envios) && t.envios.length > 0) {
          const reales = t.envios.filter(e => {
            const tieneGuia = String(e.guiaPedido || '').trim().length > 0;
            const paq = String(e.paqueteria || '').trim().toLowerCase();
            return tieneGuia || (paq && paq !== 'por definir');
          });
          if (reales.length !== t.envios.length) {
            t.envios = reales;
            modified = true;
          }
        }
      });
      if (modified) {
        if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tkts);
        else if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_tickets', JSON.stringify(tkts));
      }
    }

    if (dbEnvios.length > 0 && tkts && Array.isArray(tkts)) {
      const dbLimpios = dbEnvios.filter(dbe => {
        if (!dbe.ticketId) return true;
        const associatedTicket = tkts.find(tk => tk.id === dbe.ticketId || tk.folio === dbe.ticketFolio);
        if (associatedTicket && !ticketTienePedidoOEnvioValido(associatedTicket)) {
          const tieneGuia = String(dbe.guiaPedido || '').trim().length > 0;
          const paq = String(dbe.paqueteria || '').trim().toLowerCase();
          const esDummy = !tieneGuia && (!paq || paq === 'por definir');
          return !esDummy;
        }
        return true;
      });
      if (dbLimpios.length !== dbEnvios.length) {
        if (typeof localStorage !== 'undefined') localStorage.setItem('sapi_envios_db', JSON.stringify(dbLimpios));
      }
    }
  } catch (e) {
    console.warn('[Envios] Error al purgar envíos huérfanos:', e);
  }
}

// Renderiza la tabla y KPIs de la vista Envíos (Desktop y Tarjetas Mobile App)
function renderEnvios() {
  purgarEnviosEnCotizacionSinPedido();
  if (typeof document === 'undefined') return;
  const tbody = document.getElementById('tabla-body-envios');
  const mobContainer = document.getElementById('mobile-envios-cards-container');
  if (!tbody && !mobContainer) return;

  const mobileSearchVal = document.getElementById('mobile-search-envios')?.value || '';
  const desktopSearchVal = document.getElementById('search-envios')?.value || '';
  const q = (mobileSearchVal || desktopSearchVal || '').toLowerCase().trim();

  const clearBtn = document.getElementById('btn-clear-search-envios');
  if (clearBtn) {
    clearBtn.style.display = (mobileSearchVal && mobileSearchVal.length > 0) ? 'flex' : 'none';
  }

  // Sincronizar y obtener filtro de estado
  const selectEstado = document.getElementById('filter-envios-estado');
  let fEstado = selectEstado ? selectEstado.value : (window.currentEnviosFiltroEstado || 'todos');
  if (!fEstado) fEstado = 'todos';
  window.currentEnviosFiltroEstado = fEstado;
  currentEnviosFiltroEstado = fEstado;
  if (selectEstado && selectEstado.value !== fEstado) selectEstado.value = fEstado;

  // Sincronizar y obtener filtro de paquetería
  const selectPaq = document.getElementById('filter-envios-paqueteria');
  let fPaq = selectPaq ? selectPaq.value : (window.currentEnviosFiltroPaqueteria || 'todas');
  if (!fPaq) fPaq = 'todas';
  window.currentEnviosFiltroPaqueteria = fPaq;
  currentEnviosFiltroPaqueteria = fPaq;
  if (selectPaq && selectPaq.value !== fPaq) selectPaq.value = fPaq;

  const todos = window.obtenerTodosLosEnvios();

  // Actualizar KPIs superiores (Desktop)
  const countTotal = todos.length;
  const countTransito = todos.filter(e => e.estatus === 'En Tránsito').length;
  const countEntregados = todos.filter(e => e.estatus === 'Entregado').length;
  const countPreparando = todos.filter(e => e.estatus === 'En Preparación').length;

  const statTot = document.getElementById('stat-envios-total');
  if (statTot) statTot.textContent = countTotal;
  const statTra = document.getElementById('stat-envios-transito');
  if (statTra) statTra.textContent = countTransito;
  const statEnt = document.getElementById('stat-envios-entregados');
  if (statEnt) statEnt.textContent = countEntregados;
  const statPrep = document.getElementById('stat-envios-preparando');
  if (statPrep) statPrep.textContent = countPreparando;

  // Actualizar KPIs superiores (Mobile Chips)
  const mobTot = document.getElementById('mob-env-total');
  if (mobTot) mobTot.textContent = countTotal;
  const mobTra = document.getElementById('mob-env-transito');
  if (mobTra) mobTra.textContent = countTransito;
  const mobPrep = document.getElementById('mob-env-preparando');
  if (mobPrep) mobPrep.textContent = countPreparando;
  const mobEnt = document.getElementById('mob-env-entregados');
  if (mobEnt) mobEnt.textContent = countEntregados;

  // Sincronizar estado de chips móviles
  document.querySelectorAll('#mobile-envios-chips .status-chip').forEach(btn => {
    const e = btn.getAttribute('data-estado');
    if (e === fEstado) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Actualizar badge en el menú lateral
  window.updateEnviosBadge(countTransito);

  // Filtrar envíos
  let filtrados = todos.filter(e => {
    if (fEstado !== 'todos' && e.estatus !== fEstado) return false;
    if (fPaq !== 'todas' && !String(e.paqueteria).toLowerCase().includes(fPaq.toLowerCase())) return false;

    if (q) {
      const matchGuia = String(e.guiaPedido || '').toLowerCase().includes(q);
      const matchTicket = String(e.ticketFolio || '').toLowerCase().includes(q);
      const matchAsunto = String(e.ticketAsunto || '').toLowerCase().includes(q);
      const matchCliente = String(e.cliente || '').toLowerCase().includes(q);
      const matchSitio = String(e.sitio || '').toLowerCase().includes(q);
      const matchPaq = String(e.paqueteria || '').toLowerCase().includes(q);
      const matchParts = (e.parts || []).some(p => 
        String(p.clave || '').toLowerCase().includes(q) || 
        String(p.descripcion || '').toLowerCase().includes(q)
      );

      if (!matchGuia && !matchTicket && !matchAsunto && !matchCliente && !matchSitio && !matchPaq && !matchParts) {
        return false;
      }
    }
    return true;
  });

  // Ordenar: primero En Preparación, luego En Tránsito, al final Entregados (y dentro de cada grupo por fecha más reciente)
  filtrados.sort((a, b) => {
    const statusWeight = {
      'En Preparación': 1,
      'En Tránsito': 2,
      'Entregado': 3
    };
    const wA = statusWeight[a.estatus] || 99;
    const wB = statusWeight[b.estatus] || 99;
    if (wA !== wB) return wA - wB;
    const fA = a.fechaEnvio ? new Date(a.fechaEnvio).getTime() : 0;
    const fB = b.fechaEnvio ? new Date(b.fechaEnvio).getTime() : 0;
    return fB - fA;
  });

  _enviosFiltradosActuales = filtrados;
  window._enviosFiltradosActuales = filtrados;

  if (filtrados.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="empty-state" style="padding:3rem 1rem; text-align:center; color:var(--text-muted);">
            <i data-lucide="package" style="width:36px; height:36px; stroke-width:1.5; color:var(--accent); margin-bottom:0.5rem; display:block; margin-inline:auto;"></i>
            ${q || fEstado !== 'todos' || fPaq !== 'todas' ? 'No se encontraron envíos que coincidan con los filtros aplicados.' : 'No hay guías de envío registradas aún.'}
          </td>
        </tr>
      `;
    }
    if (mobContainer) {
      mobContainer.innerHTML = `
        <div class="empty-state" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <i data-lucide="package-search" style="width:40px; height:40px; margin-bottom:0.75rem; opacity:0.35; display:block; margin-left:auto; margin-right:auto;"></i>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.25rem;">No hay guías de envío</div>
          <div style="font-size:0.8rem; opacity:0.75;">${q || fEstado !== 'todos' || fPaq !== 'todas' ? 'No se encontraron resultados para los filtros seleccionados.' : 'Aún no se han registrado guías.'}</div>
        </div>
      `;
    }
    if (typeof lucide !== 'undefined') {
      const viewEnv = document.getElementById('view-envios');
      lucide.createIcons({ root: viewEnv || undefined });
    }
    return;
  }

  let html = '';
  let htmlMobileCards = '';

  const safeEscape = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  filtrados.forEach(e => {
    // Estatus Badge
    let statusBg = 'rgba(234, 179, 8, 0.15)';
    let statusColor = '#eab308';
    let statusBorder = 'rgba(234, 179, 8, 0.3)';
    let statusIcon = 'clock';

    if (e.estatus === 'En Tránsito') {
      statusBg = 'rgba(14, 165, 233, 0.15)';
      statusColor = '#0ea5e9';
      statusBorder = 'rgba(14, 165, 233, 0.3)';
      statusIcon = 'navigation';
    } else if (e.estatus === 'Entregado') {
      statusBg = 'rgba(16, 185, 129, 0.15)';
      statusColor = '#10b981';
      statusBorder = 'rgba(16, 185, 129, 0.3)';
      statusIcon = 'check-circle-2';
    }

    // Piezas resumen Desktop
    let partsSummary = 'Sin piezas especificadas';
    const partsCount = (e.parts && Array.isArray(e.parts)) ? e.parts.length : 0;
    if (partsCount > 0) {
      if (partsCount === 1) {
        partsSummary = e.parts[0].descripcion || e.parts[0].clave || '1 refacción';
      } else {
        partsSummary = `<b>${partsCount} refacciones:</b> ${e.parts[0].descripcion || e.parts[0].clave} +${partsCount - 1} más`;
      }
    } else if (e.ticketAsunto || e.notas) {
      partsSummary = safeEscape(e.ticketAsunto || e.notas);
    }

    // Piezas resumen Mobile
    let partsSummaryShort = 'Sin refacciones especificadas';
    if (partsCount > 0) {
      const firstPart = e.parts[0];
      const firstDesc = firstPart.descripcion || firstPart.clave || firstPart.nombre || 'Pieza';
      if (partsCount === 1) {
        partsSummaryShort = `${firstPart.cantidad || 1}x ${firstDesc}`;
      } else {
        partsSummaryShort = `${firstPart.cantidad || 1}x ${firstDesc} +${partsCount - 1} más`;
      }
    } else if (e.ticketAsunto || e.notas) {
      partsSummaryShort = safeEscape(e.ticketAsunto || e.notas);
    }

    // Tracking link
    const trackingUrl = e.urlRastreo || window.obtenerUrlRastreoPaqueteria(e.paqueteria, e.guiaPedido);
    const trackingBtn = trackingUrl 
      ? `<a href="${trackingUrl}" target="_blank" class="action-btn" title="Rastrear en web de paquetería" style="color:#0ea5e9; text-decoration:none;"><i data-lucide="external-link"></i></a>` 
      : '';

    // Mobile tracking pill button
    const trackingBtnMob = trackingUrl
      ? `<a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="mec-track-btn" onclick="event.stopPropagation();" title="Rastrear en ${e.paqueteria}"><i data-lucide="external-link"></i><span>Rastrear</span></a>`
      : '';

    // PDF botón
    const pdfBtn = e.pdfGuia 
      ? `<button type="button" class="action-btn" onclick="window.visualizarPdfGuia('${e.ticketId}', '${e.id}')" title="Ver Comprobante / PDF"><i data-lucide="file-text" style="color:var(--accent);"></i></button>` 
      : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>';

    // Fecha label Mobile
    let dateLabel = '';
    if (e.estatus === 'Entregado') {
      dateLabel = `Entregado: ${e.fechaLlegada || e.fechaEntrega || 'Fecha no esp.'}`;
    } else if (e.fechaEntrega) {
      dateLabel = `Est. Entrega: ${e.fechaEntrega}`;
    } else if (e.fechaEnvio) {
      dateLabel = `Envío: ${e.fechaEnvio}`;
    } else {
      dateLabel = 'Fecha no especificada';
    }

    // 1. Fila para Escritorio
    html += `
      <tr style="cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <td data-label="Acciones" style="white-space:nowrap; width:75px; text-align:center;" onclick="event.stopPropagation();">
          <div style="display:inline-flex; gap:0.25rem; align-items:center; justify-content:center;">
            <button class="action-btn" onclick="window.abrirDetalleEnvio('${e.id}')" title="Ver Detalle" style="padding:4px; display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="eye" style="width:14px; height:14px;"></i></button>
            <button class="action-btn" onclick="window.abrirModalNuevoEnvio('${e.ticketId}', '${e.id}')" title="Editar Guía" style="padding:4px; display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="pencil" style="width:14px; height:14px;"></i></button>
            ${trackingBtn}
            <button class="action-btn del" onclick="window.eliminarEnvio('${e.id}', '${e.ticketId}')" title="Eliminar" style="padding:4px; display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
          </div>
        </td>
        <td data-label="Guía" onclick="window.abrirDetalleEnvio('${e.id}')" style="white-space:nowrap;">
          <span style="font-family:monospace; font-weight:700; color:var(--text-primary); font-size:0.88rem;">
            ${e.guiaPedido || '<i style="color:var(--text-muted); font-weight:normal;">Sin guía</i>'}
          </span>
        </td>
        <td data-label="Paquetería" onclick="window.abrirDetalleEnvio('${e.id}')" style="white-space:nowrap;">
          <span style="display:inline-flex; align-items:center; gap:0.35rem; padding:3px 8px; border-radius:6px; background:var(--bg-card); border:1px solid var(--border); font-size:0.8rem; font-weight:600;">
            <i data-lucide="truck" style="width:13px; height:13px; color:var(--accent);"></i>
            ${e.paqueteria}
          </span>
        </td>
        <td data-label="Ticket" onclick="event.stopPropagation();" style="white-space:nowrap;">
          <a href="#" onclick="verDetalleTicket('${e.ticketId}'); return false;" style="color:var(--accent); font-weight:700; text-decoration:underline; font-size:0.85rem;" title="${e.ticketAsunto || ''}">
            ${e.ticketFolio}
          </a>
        </td>
        <td data-label="Cliente" onclick="window.abrirDetalleEnvio('${e.id}')" style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <strong style="font-size:0.85rem; color:var(--text-primary);" title="${e.cliente}">${e.cliente}</strong>
        </td>
        <td data-label="Destino" onclick="window.abrirDetalleEnvio('${e.id}')" style="max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <span style="font-size:0.82rem; color:var(--text-secondary);" title="${e.sitio || 'General'}">${e.sitio || 'General'}</span>
        </td>
        <td data-label="Contenido" style="max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="window.abrirDetalleEnvio('${e.id}')" title="${(e.parts||[]).map(p=>p.descripcion||p.clave).join(', ')}">
          <span style="font-size:0.82rem; color:var(--text-secondary);">${partsSummary}</span>
        </td>
        <td data-label="Fecha Envío" onclick="window.abrirDetalleEnvio('${e.id}')" style="font-size:0.82rem; color:var(--text-muted); white-space:nowrap;">
          ${e.fechaEnvio || '—'}
        </td>
        <td data-label="Fecha Entrega" onclick="window.abrirDetalleEnvio('${e.id}')" style="font-size:0.82rem; color:var(--text-muted); white-space:nowrap;">
          ${e.fechaLlegada || e.fechaEntrega || '—'}
        </td>
        <td data-label="Estatus" onclick="window.abrirDetalleEnvio('${e.id}')" style="white-space:nowrap;">
          <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px; background:${statusBg}; color:${statusColor};">
            <i data-lucide="${statusIcon}" style="width:12px; height:12px;"></i>
            ${e.estatus}
          </span>
        </td>
        <td data-label="PDF" style="text-align:center; width:50px;" onclick="event.stopPropagation();">
          ${pdfBtn}
        </td>
      </tr>
    `;

    // 2. Tarjeta Nativa para App Móvil (Diseño minimalista unificado con Órdenes de Servicio)
    const rawGuia = String(e.guiaPedido || '').trim();
    const isGenericGuia = !rawGuia || ['-', 's/g', 'sin guia', 'sin guía', 'por asignar', 'n/a', 'na', 'null', 'undefined'].includes(rawGuia.toLowerCase());
    const guiaDisplay = isGenericGuia
      ? '# Sin guía'
      : (rawGuia.startsWith('#') ? safeEscape(rawGuia) : `# ${safeEscape(rawGuia)}`);

    let statusKey = 'preparacion';
    const stLower = String(e.estatus || '').toLowerCase();
    if (stLower.includes('tránsito') || stLower.includes('transito') || stLower.includes('camino') || stLower.includes('ruta')) {
      statusKey = 'transito';
    } else if (stLower.includes('entreg') || stLower.includes('complet')) {
      statusKey = 'entregado';
    } else if (stLower.includes('cancel')) {
      statusKey = 'cancelado';
    }

    const clienteDisplay = safeEscape(String(e.cliente || 'Sin cliente asignado').trim());

    const rawDestino = String(e.sitio || e.destino || e.direccion || '').trim();
    const isDestinoEmpty = !rawDestino || ['-', 'n/a', 'na', 's/n', 'null', 'undefined', 'general', 'por definir', 'sin destino'].includes(rawDestino.toLowerCase());
    const destinoDisplay = safeEscape(isDestinoEmpty ? 'Destino por confirmar' : rawDestino);

    const paqRaw = String(e.paqueteria || '').trim();
    const paqDisplay = (paqRaw && !['por definir', 'sin paqueteria', 'sin paquetería', 'n/a', 'na', '-'].includes(paqRaw.toLowerCase())) 
      ? paqRaw 
      : 'Paquetería por definir';
    const tktOrParts = e.ticketFolio 
      ? e.ticketFolio 
      : (partsCount > 0 ? (partsCount === 1 ? '1 refacción' : `${partsCount} pzas`) : '');
    const fechaRef = e.fechaEntrega || e.fechaLlegada || e.fechaEnvio || '';
    const subParts = [paqDisplay, tktOrParts, fechaRef].filter(Boolean);
    const subInfo = safeEscape(subParts.join(' • ') || 'Guía de Envío');

    htmlMobileCards += `
      <div class="mec-card" onclick="window.abrirDetalleEnvio('${e.id}')">
        <div class="mec-header">
          <span class="mec-guia">${guiaDisplay}</span>
          <span class="mec-status status-${statusKey}" style="color:${statusColor}; background:${statusBg}; border-color:${statusBorder};">
            ${safeEscape(e.estatus || 'En Preparación')}
          </span>
        </div>
        <div class="mec-cliente">${clienteDisplay}</div>
        <div class="mec-location">
          <i data-lucide="map-pin" class="mec-pin"></i>
          <span class="mec-location-text">${destinoDisplay}</span>
        </div>
        <div class="mec-footer">
          <span class="mec-sub">${subInfo}</span>
          <div class="mec-actions">
            ${trackingBtnMob}
            <i data-lucide="chevron-right" class="mec-arrow"></i>
          </div>
        </div>
      </div>
    `;
  });

  if (tbody) tbody.innerHTML = html;
  if (mobContainer) mobContainer.innerHTML = htmlMobileCards;
  if (typeof lucide !== 'undefined') {
    const viewEnv = document.getElementById('view-envios');
    lucide.createIcons({ root: viewEnv || undefined });
  }
};

// Exportar guías de envío a archivo Excel (.xlsx)
function exportarEnviosAExcel() {
  const lista = window._enviosFiltradosActuales || window.obtenerTodosLosEnvios() || [];
  if (lista.length === 0) {
    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion('No hay guías de envío en la lista para exportar.', 'warning');
    } else {
      alert('No hay guías de envío en la lista para exportar.');
    }
    return;
  }

  const dataExport = lista.map((e, idx) => {
    let partsStr = '';
    if (Array.isArray(e.parts) && e.parts.length > 0) {
      partsStr = e.parts.map(p => {
        const cant = p.cantidad || 1;
        const desc = p.descripcion || p.nombre || '';
        const clave = p.clave || p.codigo || '';
        return `${cant}x ${desc}${clave ? ` [${clave}]` : ''}`;
      }).join('; ');
    } else {
      partsStr = 'Sin refacciones especificadas';
    }

    return {
      '#': idx + 1,
      'No. de Guía': e.guiaPedido || 'Sin guía',
      'Paquetería': e.paqueteria || 'Por Definir',
      'Estatus': e.estatus || 'En Preparación',
      'Folio Ticket': e.ticketFolio || '',
      'Asunto Ticket': e.ticketAsunto || '',
      'Categoría Ticket': e.ticketCategoria || 'Refacción',
      'Cliente': e.cliente || '',
      'Destino / Sitio': e.sitio || 'General',
      'Refacciones / Contenido': partsStr,
      'Cant. Partes': (e.parts && Array.isArray(e.parts)) ? e.parts.length : 0,
      'Fecha Envío': e.fechaEnvio || e.fechaPedido || '',
      'Fecha Entrega': e.fechaLlegada || e.fechaEntrega || '',
      'URL Rastreo': e.urlRastreo || '',
      'Notas': e.notas || ''
    };
  });

  const fechaHoy = new Date().toISOString().split('T')[0];
  const filename = `Guias_Envio_Eurorep_${fechaHoy}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(dataExport);

    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 18 },  // No. de Guía
      { wch: 16 },  // Paquetería
      { wch: 16 },  // Estatus
      { wch: 16 },  // Folio Ticket
      { wch: 30 },  // Asunto Ticket
      { wch: 20 },  // Categoría
      { wch: 30 },  // Cliente
      { wch: 22 },  // Destino / Sitio
      { wch: 45 },  // Refacciones / Contenido
      { wch: 12 },  // Cant. Partes
      { wch: 14 },  // Fecha Envío
      { wch: 14 },  // Fecha Entrega
      { wch: 35 },  // URL Rastreo
      { wch: 30 }   // Notas
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guías de Envío');
    XLSX.writeFile(wb, filename);

    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} guías de envío a Excel (${filename}).`, 'success');
    }
  } else {
    // Fallback a CSV si XLSX no está disponible
    const headers = Object.keys(dataExport[0]);
    let csv = '\uFEFF' + headers.join(',') + '\n';
    dataExport.forEach(row => {
      const line = headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',');
      csv += line + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Guias_Envio_Eurorep_${fechaHoy}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} guías de envío a CSV.`, 'success');
    }
  }
};

// Actualiza el badge en la barra lateral
function updateEnviosBadge(count) {
  if (typeof document === 'undefined') return;
  const badge = document.getElementById('nav-badge-envios');
  if (!badge) return;
  const num = (count !== undefined) ? count : window.obtenerTodosLosEnvios().filter(e => e.estatus === 'En Tránsito').length;
  if (num > 0) {
    badge.textContent = num;
    badge.classList.add('visible');
    badge.style.display = 'inline-flex';
  } else {
    badge.classList.remove('visible');
    badge.style.display = 'none';
  }
};

// Abre el modal para crear o editar una guía de envío
function abrirModalNuevoEnvio(ticketId, envioId) {
  // Asegurar que el modal de detalle esté cerrado
  const modalDetalle = document.getElementById('modal-detalle-envio-overlay');
  if (modalDetalle) {
    modalDetalle.style.display = 'none';
    modalDetalle.classList.remove('open');
  }

  const modal = document.getElementById('modal-envio-overlay');
  if (!modal) return;

  const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
  const selectTkt = document.getElementById('envio-input-ticket');
  
  // Poblar select de tickets — Solo tickets/órdenes con refacciones necesarias
  const tktsConRefacciones = tkts.filter(t => {
    if (!t) return false;
    // 1. Refacciones directamente en el ticket
    if (Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0) return true;
    
    // 2. Refacciones en la orden de servicio asociada
    if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
      const assocOrder = typeof window.obtenerOrdenAsociadaATicketRefacciones === 'function'
        ? window.obtenerOrdenAsociadaATicketRefacciones(t)
        : ordenes.find(o => o.soporte === t.id || o.folio === (t.folio || '').replace('-A', ''));
      if (assocOrder && Array.isArray(assocOrder.ref_necesarias) && assocOrder.ref_necesarias.length > 0) return true;
    }

    // 3. Subticket de refacción generado (-A) o categoría Refacción
    const cat = String(t.categoria || '').toLowerCase();
    if (cat.includes('refacci') || (t.folio && t.folio.endsWith('-A'))) return true;

    // 4. Si estamos editando y este ticket ya tiene este envío asociado
    if (ticketId && t.id === ticketId) return true;

    return false;
  });

  if (selectTkt) {
    let opts = '<option value="">-- Seleccionar Ticket / Orden con Refacciones --</option>';
    tktsConRefacciones.forEach(t => {
      const partsCount = (t.refaccionesSeleccionadas || []).length;
      opts += `<option value="${t.id}">${t.folio || t.id} - ${t.cliente || 'Sin cliente'} (${t.categoria || 'Refacción'}${partsCount > 0 ? ` · ${partsCount} pza(s)` : ''}) - ${t.asunto || ''}</option>`;
    });
    selectTkt.innerHTML = opts;
  }

  // Limpiar campos
  document.getElementById('envio-modal-id').value = envioId || '';
  document.getElementById('envio-modal-ticket-id').value = ticketId || '';
  document.getElementById('envio-input-paqueteria').value = 'DHL';
  document.getElementById('envio-input-guia').value = '';
  document.getElementById('envio-input-url-rastreo').value = '';
  document.getElementById('envio-input-fecha-envio').value = new Date().toISOString().split('T')[0];
  document.getElementById('envio-input-fecha-entrega').value = '';
  document.getElementById('envio-input-fecha-llegada').value = '';
  document.getElementById('envio-input-llego').checked = false;
  document.getElementById('envio-input-notas').value = '';
  document.getElementById('envio-container-fecha-llegada').style.display = 'none';

  let selectedTicket = null;
  if (ticketId) {
    selectedTicket = tkts.find(t => t.id === ticketId);
    if (selectTkt) selectTkt.value = ticketId;
  }

  // Si estamos editando una guía existente
  if (envioId && selectedTicket && selectedTicket.envios) {
    const env = selectedTicket.envios.find(e => e.id === envioId);
    if (env) {
      document.getElementById('envio-input-paqueteria').value = env.paqueteria || 'DHL';
      document.getElementById('envio-input-guia').value = env.guiaPedido || '';
      document.getElementById('envio-input-url-rastreo').value = env.urlRastreo || window.obtenerUrlRastreoPaqueteria(env.paqueteria, env.guiaPedido);
      document.getElementById('envio-input-fecha-envio').value = env.fechaPedido || '';
      document.getElementById('envio-input-fecha-entrega').value = env.fechaEntrega || '';
      document.getElementById('envio-input-fecha-llegada').value = env.fechaLlegada || '';
      document.getElementById('envio-input-llego').checked = !!env.llego;
      document.getElementById('envio-input-notas').value = env.notas || '';
      if (env.llego) {
        document.getElementById('envio-container-fecha-llegada').style.display = 'block';
      }
    }
  }

  window.onCambioTicketEnvio(selectedTicket ? selectedTicket.id : '');

  modal.style.display = 'flex';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

function cerrarModalEnvio(e) {
  if (e && (e.target === document.getElementById('modal-envio-overlay') || e.target?.classList?.contains('modal-overlay'))) return;
  const modal = document.getElementById('modal-envio-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
};

// Evento al seleccionar un ticket en el modal de envío
function onCambioTicketEnvio(ticketId) {
  const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
  const t = tkts.find(x => x.id === ticketId);

  const inpCli = document.getElementById('envio-input-cliente');
  const inpSit = document.getElementById('envio-input-destino');
  const partsBox = document.getElementById('envio-parts-selection');

  if (!t) {
    if (inpCli) inpCli.value = '';
    if (inpSit) inpSit.value = '';
    if (partsBox) partsBox.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">Selecciona un ticket para ver sus refacciones asociadas.</div>';
    return;
  }

  if (inpCli) inpCli.value = t.cliente || '';
  if (inpSit) inpSit.value = t.sitio ? `${t.sitio}` : '';

  // Renderizar checkboxes de refacciones del ticket o de su orden asociada
  if (partsBox) {
    let parts = t.refaccionesSeleccionadas || [];
    if (parts.length === 0 && typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
      const assocOrder = typeof window.obtenerOrdenAsociadaATicketRefacciones === 'function'
        ? window.obtenerOrdenAsociadaATicketRefacciones(t)
        : ordenes.find(o => o.soporte === t.id || o.folio === (t.folio || '').replace('-A', ''));
      if (assocOrder && Array.isArray(assocOrder.ref_necesarias) && assocOrder.ref_necesarias.length > 0) {
        parts = assocOrder.ref_necesarias;
      }
    }

    if (parts.length === 0) {
      partsBox.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">El ticket no tiene refacciones cargadas actualmente.</div>';
    } else {
      let pHtml = '<div style="display:flex; flex-direction:column; gap:0.4rem; max-height:160px; overflow-y:auto; padding:0.25rem;">';
      parts.forEach((p, idx) => {
        pHtml += `
          <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; cursor:pointer; background:var(--bg-body); padding:0.35rem 0.6rem; border-radius:6px; border:1px solid var(--border);">
            <input type="checkbox" class="envio-part-cb" data-clave="${p.clave || p.codigo || ''}" data-desc="${p.descripcion || p.nombre || ''}" checked />
            <span style="font-weight:600; color:var(--text-primary);">${p.clave || p.codigo ? `[${p.clave || p.codigo}]` : ''} ${p.descripcion || p.nombre || 'Pieza'}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">Cant: ${p.cantidad || 1}</span>
          </label>
        `;
      });
      pHtml += '</div>';
      partsBox.innerHTML = pHtml;
    }
  }
};

function onCambioPaqueteriaEnvio() {
  const paq = document.getElementById('envio-input-paqueteria')?.value || '';
  const guia = document.getElementById('envio-input-guia')?.value || '';
  const urlInp = document.getElementById('envio-input-url-rastreo');
  if (urlInp && (!urlInp.value || urlInp.dataset.autogen === 'true')) {
    const generated = window.obtenerUrlRastreoPaqueteria(paq, guia);
    urlInp.value = generated;
    urlInp.dataset.autogen = 'true';
  }
};

function onToggleLlegoEnvio(checked) {
  const container = document.getElementById('envio-container-fecha-llegada');
  const inpFecha = document.getElementById('envio-input-fecha-llegada');
  if (container) {
    container.style.display = checked ? 'block' : 'none';
    if (checked && inpFecha && !inpFecha.value) {
      inpFecha.value = new Date().toISOString().split('T')[0];
    }
  }
};

// Guarda la guía de envío en el ticket y en la base de datos
async function guardarModalEnvio(event) {
  if (event) event.preventDefault();

  const envioId = document.getElementById('envio-modal-id').value;
  const ticketId = document.getElementById('envio-input-ticket').value;
  const paqueteria = document.getElementById('envio-input-paqueteria').value;
  const guiaPedido = document.getElementById('envio-input-guia').value.trim();
  const urlRastreo = document.getElementById('envio-input-url-rastreo').value.trim();
  const fechaPedido = document.getElementById('envio-input-fecha-envio').value;
  const fechaEntrega = document.getElementById('envio-input-fecha-entrega').value;
  const llego = document.getElementById('envio-input-llego').checked;
  const fechaLlegada = document.getElementById('envio-input-fecha-llegada').value;
  const notas = document.getElementById('envio-input-notas').value.trim();

  if (!ticketId) {
    alert('Por favor selecciona un ticket comercial para asociar este envío.');
    return;
  }

  // Recolectar refacciones marcadas
  const parts = [];
  document.querySelectorAll('.envio-part-cb:checked').forEach(cb => {
    parts.push({
      clave: cb.getAttribute('data-clave') || '',
      descripcion: cb.getAttribute('data-desc') || ''
    });
  });

  const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
  const t = tkts.find(x => x.id === ticketId);
  if (!t) {
    alert('No se encontró el ticket seleccionado.');
    return;
  }

  if (!t.envios) t.envios = [];

  const nuevoEnvioObj = {
    id: envioId || Math.random().toString(36).substring(2, 9),
    paqueteria,
    guiaPedido,
    urlRastreo: urlRastreo || window.obtenerUrlRastreoPaqueteria(paqueteria, guiaPedido),
    fechaPedido,
    fechaEntrega,
    llego,
    fechaLlegada: llego ? (fechaLlegada || new Date().toISOString().split('T')[0]) : '',
    parts,
    notas
  };

  const existingIdx = t.envios.findIndex(e => e.id === nuevoEnvioObj.id);
  if (existingIdx >= 0) {
    t.envios[existingIdx] = nuevoEnvioObj;
  } else {
    t.envios.push(nuevoEnvioObj);
  }

  // Actualizar datos legacy principales en el ticket
  t.paqueteria = paqueteria;
  t.guiaPedido = guiaPedido;
  t.fechaPedido = fechaPedido;
  t.fechaEntrega = fechaEntrega;

  // Actualizar estatus de refacciones asociadas
  if (t.refaccionesSeleccionadas) {
    t.refaccionesSeleccionadas.forEach(p => {
      const pClave = p.clave || p.codigo || '';
      const pDesc = p.descripcion || p.nombre || '';
      const isIncluded = parts.some(ep => ep.clave === pClave && ep.descripcion === pDesc);

      if (isIncluded) {
        p.estatusPedido = llego ? 'Entregado al Técnico' : 'En Tránsito / Pedido';
        p.guiaPedido = guiaPedido;
      }
    });
  }

  // Guardar en Storage y Supabase
  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
  if (window.pushToSupabase) {
    window.pushToSupabase('tickets', t);
    window.pushToSupabase('envios', nuevoEnvioObj).catch(err => console.warn('[Envios Sync] Error al sincronizar en tabla envios:', err));
  }

  window.cerrarModalEnvio();
  window.renderEnvios();
  if (typeof renderTickets === 'function') renderTickets();

  mostrarNotificacion(`Guía de envío ${guiaPedido || 'guardada'} con éxito.`, 'success');
};

// Abre el detalle de una guía de envío en modal visual enriquecido como la tarjeta del ticket
function abrirDetalleEnvio(envioId) {
  // Asegurar que el modal de creación/edición esté cerrado
  const modalEnvio = document.getElementById('modal-envio-overlay');
  if (modalEnvio) {
    modalEnvio.style.display = 'none';
    modalEnvio.classList.remove('open');
  }

  const todos = window.obtenerTodosLosEnvios();
  const env = todos.find(e => e.id === envioId);
  if (!env) return;

  const modal = document.getElementById('modal-detalle-envio-overlay');
  const body = document.getElementById('detalle-envio-body');
  const title = document.getElementById('detalle-envio-title');

  if (title) title.innerHTML = `<span style="font-family:monospace; font-weight:800;">${env.guiaPedido ? `Guía: ${env.guiaPedido}` : 'Guía de Envío'}</span>`;

  const trackingUrl = env.urlRastreo || window.obtenerUrlRastreoPaqueteria(env.paqueteria, env.guiaPedido);

  // Cálculo de tiempos
  let tiempoText = 'El tiempo se calculará al ingresar las fechas.';
  let tiempoColor = 'var(--text-secondary)';
  let tiempoIcon = 'clock';

  if (env.llego) {
    tiempoText = `✅ <strong style="color:#10b981;">Entregado / Recibido</strong> ${env.fechaLlegada ? `el ${env.fechaLlegada}` : ''}`;
    tiempoColor = '#10b981';
    tiempoIcon = 'check-circle-2';
  } else {
    let partsTiempo = [];
    if (env.fechaEnvio) {
      const reqDate = new Date(env.fechaEnvio);
      reqDate.setHours(0,0,0,0);
      const hoy = new Date();
      hoy.setHours(0,0,0,0);
      const diffTranscurrido = Math.floor((hoy.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffTranscurrido >= 0) {
        partsTiempo.push(`Transcurrido: <strong style="color:var(--accent);">${diffTranscurrido}d</strong>`);
      }
    }

    if (env.fechaEntrega) {
      const estDate = new Date(env.fechaEntrega);
      estDate.setHours(0,0,0,0);
      const hoy = new Date();
      hoy.setHours(0,0,0,0);
      const diffFaltante = Math.ceil((estDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffFaltante > 0) {
        partsTiempo.push(`Faltan: <strong style="color:var(--text-primary);">${diffFaltante}d</strong>`);
      } else if (diffFaltante === 0) {
        partsTiempo.push(`<span style="color:#f97316; font-weight:700;">¡Se entrega HOY!</span>`);
      } else {
        partsTiempo.push(`<span style="color:#ef4444; font-weight:700;">⚠️ Atrasado: ${Math.abs(diffFaltante)}d</span>`);
      }
    }

    if (partsTiempo.length > 0) {
      tiempoText = partsTiempo.join(' | ');
    }
  }

  // Lista de Refacciones
  let partsHtml = '';
  if (env.parts && env.parts.length > 0) {
    partsHtml = `
      <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:0.75rem;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>Refacciones en este Envío (${env.parts.length})</span>
          <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">Estatus de pieza: ${env.llego ? 'Entregado al Técnico' : 'En Tránsito / Pedido'}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:180px; overflow-y:auto; padding:2px;">
          ${env.parts.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:var(--bg-body); padding:0.45rem 0.75rem; border-radius:6px; border:1px solid var(--border);">
              <div>
                <strong style="color:var(--accent); margin-right:4px;">${p.cantidad || 1}x</strong>
                <span style="font-weight:600; color:var(--text-primary);">${p.descripcion || p.nombre || 'Pieza'}</span>
                ${p.clave || p.codigo ? `<span style="color:var(--text-muted); font-size:0.75rem; font-family:monospace; margin-left:4px;">(${p.clave || p.codigo})</span>` : ''}
              </div>
              <span class="badge badge-${env.llego ? 'completado' : 'proceso'}" style="font-size:0.72rem; padding:2px 8px;">
                ${env.llego ? 'Entregada' : 'En Tránsito'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    const fallbackTxt = env.ticketAsunto || env.notas;
    if (fallbackTxt) {
      partsHtml = `
        <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">
            <span>Contenido / Pieza Solicitada</span>
          </div>
          <div style="background:var(--bg-body); padding:0.5rem 0.75rem; border-radius:6px; border:1px solid var(--border); font-size:0.85rem; font-weight:600; color:var(--text-primary);">
            ${fallbackTxt}
          </div>
        </div>
      `;
    } else {
      partsHtml = `
        <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:0.75rem;">
          <span style="color:var(--text-muted); font-style:italic; font-size:0.82rem;">No hay refacciones desglosadas en este envío.</span>
        </div>
      `;
    }
  }

  if (body) {
    body.innerHTML = `
      <!-- Header Info Card -->
      <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:8px; padding:0.85rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div style="background:rgba(234, 88, 12, 0.15); color:var(--accent); padding:0.5rem; border-radius:8px; display:flex;">
            <i data-lucide="truck" style="width:22px; height:22px;"></i>
          </div>
          <div>
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Paquetería / Transportista</div>
            <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">${env.paqueteria || 'Por Definir'}</div>
          </div>
        </div>

        <!-- Toggle ¿Ya Llegó? interactivo -->
        <div style="display:flex; align-items:center; gap:0.6rem; background:var(--bg-card); padding:0.4rem 0.75rem; border-radius:6px; border:1px solid var(--border);">
          <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:700; color:var(--text-primary); cursor:pointer; user-select:none; margin:0;">
            <input type="checkbox" id="modal-detalle-envio-llego" ${env.llego ? 'checked' : ''} onchange="window.toggleLlegoDesdeDetalle('${env.id}', '${env.ticketId}', this.checked)" style="width:16px; height:16px; cursor:pointer;" />
            <span>¿Ya Llegó?</span>
          </label>
        </div>
      </div>

      <!-- Barra de tiempo / cálculo de días -->
      <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; color:${tiempoColor}; background:var(--bg-body); padding:0.6rem 0.85rem; border-radius:6px; border:1px solid var(--border); margin-bottom:1rem;">
        <i data-lucide="${tiempoIcon}" style="width:16px; height:16px; color:var(--accent);"></i>
        <span>${tiempoText}</span>
      </div>

      <!-- Grid de Datos Clave -->
      <div class="detalle-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:0.85rem 1rem;">
        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Número de Guía</div>
          <div class="detalle-value" style="font-family:monospace; font-weight:700; font-size:0.95rem; color:var(--text-primary);">${env.guiaPedido || '<i style="color:var(--text-muted); font-weight:normal;">Sin guía</i>'}</div>
        </div>

        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Ticket Comercial</div>
          <div class="detalle-value">
            <a href="#" onclick="verDetalleTicket('${env.ticketId}'); return false;" style="color:var(--accent); font-weight:700; text-decoration:underline; font-size:0.92rem;">
              ${env.ticketFolio}
            </a>
          </div>
        </div>

        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Cliente / Destinatario</div>
          <div class="detalle-value" style="font-weight:700; color:var(--text-primary);">${env.cliente}</div>
        </div>

        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Sitio / Ubicación</div>
          <div class="detalle-value" style="color:var(--text-secondary);">${env.sitio || 'General'}</div>
        </div>

        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Fecha de Pedido / Embarque</div>
          <div class="detalle-value" style="font-weight:600; color:var(--text-primary);">${env.fechaEnvio || '—'}</div>
        </div>

        <div class="detalle-field">
          <div class="detalle-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${env.llego ? 'Fecha Real de Llegada' : 'Fecha Estimada de Entrega'}</div>
          <div class="detalle-value" style="font-weight:600; color:${env.llego ? '#10b981' : 'var(--text-primary)'};">${env.fechaLlegada || env.fechaEntrega || '—'}</div>
        </div>
      </div>

      ${partsHtml}

      ${env.notas ? `
        <div style="margin-top:0.85rem; padding:0.6rem 0.85rem; background:var(--bg-body); border-radius:6px; border:1px solid var(--border); font-size:0.82rem; color:var(--text-secondary);">
          <strong style="color:var(--text-primary);">Notas del Despacho:</strong> ${env.notas}
        </div>
      ` : ''}

      <!-- Acciones Inferiores -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:1.25rem; border-top:1px solid var(--border); padding-top:1rem;">
        <button type="button" class="btn-secondary" onclick="window.eliminarEnvio('${env.id}', '${env.ticketId}')" style="color:#ef4444; border-color:rgba(239,68,68,0.3); font-size:0.85rem; display:inline-flex; align-items:center; gap:0.35rem;">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Eliminar
        </button>

        <div style="display:flex; gap:0.5rem;">
          ${trackingUrl ? `
            <a href="${trackingUrl}" target="_blank" class="btn-primary" style="text-decoration:none; display:inline-flex; align-items:center; gap:0.4rem; font-size:0.85rem;">
              <i data-lucide="external-link" style="width:14px; height:14px;"></i> Rastrear en ${env.paqueteria}
            </a>
          ` : ''}
          <button type="button" class="btn-secondary" onclick="window.abrirModalNuevoEnvio('${env.ticketId}', '${env.id}')" style="font-size:0.85rem; display:inline-flex; align-items:center; gap:0.35rem;">
            <i data-lucide="pencil" style="width:14px; height:14px;"></i> Editar
          </button>
        </div>
      </div>
    `;
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// Permite cambiar el estado de llegada directamente desde el modal de detalle
function toggleLlegoDesdeDetalle(envioId, ticketId, checked) {
  const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
  const t = tkts.find(x => x.id === ticketId);
  if (!t) return;

  if (t.envios) {
    const env = t.envios.find(e => e.id === envioId);
    if (env) {
      env.llego = checked;
      if (checked && !env.fechaLlegada) {
        env.fechaLlegada = new Date().toISOString().split('T')[0];
      }
    }
  }

  // Actualizar refacciones vinculadas
  if (t.refaccionesSeleccionadas && t.envios) {
    const env = t.envios.find(e => e.id === envioId);
    if (env && env.parts) {
      t.refaccionesSeleccionadas.forEach(p => {
        const isIncluded = env.parts.some(ep => ep.clave === (p.clave || p.codigo) && ep.descripcion === (p.descripcion || p.nombre));
        if (isIncluded) {
          p.estatusPedido = checked ? 'Entregado al Técnico' : 'En Tránsito / Pedido';
        }
      });
    }
  }

  if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
  if (window.pushToSupabase) {
    window.pushToSupabase('tickets', t);
    const envActualizado = t.envios ? t.envios.find(e => e.id === envioId) : null;
    if (envActualizado) {
      window.pushToSupabase('envios', envActualizado).catch(err => console.warn('[Envios Sync] Error al sincronizar en tabla envios:', err));
    }
  }

  window.renderEnvios();
  window.abrirDetalleEnvio(envioId);
  mostrarNotificacion(checked ? 'Envío marcado como Entregado.' : 'Envío marcado en Tránsito.', 'success');
};

function cerrarDetalleEnvio(e) {
  if (e && (e.target === document.getElementById('modal-detalle-envio-overlay') || e.target?.classList?.contains('modal-overlay'))) return;
  const modal = document.getElementById('modal-detalle-envio-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
};

// Elimina una guía de envío de su ticket
async function eliminarEnvio(envioId, ticketId) {
  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Guía de Envío',
    mensaje: '¿Estás seguro de que deseas eliminar esta guía de envío? Las refacciones volverán al estatus por pedir si no están en otra guía.',
    textoAceptar: 'Eliminar Guía',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  const tkts = (typeof tickets !== 'undefined' && tickets) ? tickets : [];
  const t = tkts.find(x => x.id === ticketId);
  if (t && t.envios) {
    t.envios = t.envios.filter(e => e.id !== envioId);
    if (typeof safeSetJSON === 'function') safeSetJSON('sapi_tickets', tickets);
    if (window.pushToSupabase) window.pushToSupabase('tickets', t);
  }

  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('envios', envioId).catch(err => console.warn('[Envios Sync] Error al eliminar de tabla envios:', err));
  }

  window.renderEnvios();
  mostrarNotificacion('Guía de envío eliminada.', 'success');
};


if (typeof window !== 'undefined') {
  window.ticketTienePedidoOEnvioValido = ticketTienePedidoOEnvioValido;
  window.purgarEnviosEnCotizacionSinPedido = purgarEnviosEnCotizacionSinPedido;
  window.obtenerUrlRastreoPaqueteria = obtenerUrlRastreoPaqueteria;
  window.asegurarGuiaEnvioParaTicket = asegurarGuiaEnvioParaTicket;
  window.obtenerTodosLosEnvios = obtenerTodosLosEnvios;
  window.setFiltroEstadoEnviosChip = setFiltroEstadoEnviosChip;
  window.syncSearchEnvios = syncSearchEnvios;
  window.clearSearchEnvios = clearSearchEnvios;
  window.renderEnvios = renderEnvios;
  window.exportarEnviosAExcel = exportarEnviosAExcel;
  window.updateEnviosBadge = updateEnviosBadge;
  window.abrirModalNuevoEnvio = abrirModalNuevoEnvio;
  window.cerrarModalEnvio = cerrarModalEnvio;
  window.onCambioTicketEnvio = onCambioTicketEnvio;
  window.onCambioPaqueteriaEnvio = onCambioPaqueteriaEnvio;
  window.onToggleLlegoEnvio = onToggleLlegoEnvio;
  window.guardarModalEnvio = guardarModalEnvio;
  window.abrirDetalleEnvio = abrirDetalleEnvio;
  window.toggleLlegoDesdeDetalle = toggleLlegoDesdeDetalle;
  window.cerrarDetalleEnvio = cerrarDetalleEnvio;
  window.eliminarEnvio = eliminarEnvio;
  window.currentEnviosFiltroEstado = currentEnviosFiltroEstado;
  window.currentEnviosFiltroPaqueteria = currentEnviosFiltroPaqueteria;
  window.currentEnviosSearchQuery = currentEnviosSearchQuery;
  window._enviosFiltradosActuales = _enviosFiltradosActuales;
  window.editandoEnvioId = editandoEnvioId;

  // Actualizar badge inmediatamente al cargar el script
  if (typeof document !== 'undefined' && typeof updateEnviosBadge === 'function') {
    try {
      updateEnviosBadge();
    } catch (e) {
      console.warn('[Envios] Error al actualizar badge al iniciar:', e);
    }
  }
}

export {
  ticketTienePedidoOEnvioValido,
  purgarEnviosEnCotizacionSinPedido,
  setFiltroEstadoEnviosChip,
  syncSearchEnvios,
  clearSearchEnvios,
  obtenerUrlRastreoPaqueteria,
  asegurarGuiaEnvioParaTicket,
  obtenerTodosLosEnvios,
  renderEnvios,
  exportarEnviosAExcel,
  updateEnviosBadge,
  abrirModalNuevoEnvio,
  cerrarModalEnvio,
  onCambioTicketEnvio,
  onCambioPaqueteriaEnvio,
  onToggleLlegoEnvio,
  guardarModalEnvio,
  abrirDetalleEnvio,
  toggleLlegoDesdeDetalle,
  cerrarDetalleEnvio,
  eliminarEnvio,
  currentEnviosFiltroEstado,
  currentEnviosFiltroPaqueteria,
  currentEnviosSearchQuery,
  _enviosFiltradosActuales,
  editandoEnvioId
};
