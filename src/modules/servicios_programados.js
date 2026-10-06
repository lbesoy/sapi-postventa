/**
 * Módulo de Servicios Programados de Técnico y Gestión de Envíos en Tickets - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { normStr } from "../utils.js";

/**
 * Helper seguro para normalizar texto si normStr no está presente
 */
function safeNorm(s) {
  if (!s) return '';
  if (typeof normStr === 'function') return normStr(s);
  if (typeof window !== 'undefined' && typeof window.normStr === 'function') return window.normStr(s);
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Renderiza la tarjeta de servicios programados para el técnico en sesión
 */
function renderServiciosProgramadosTecnico() {
  if (typeof document === 'undefined') return;
  const card = document.getElementById('card-servicios-programados');
  const container = document.getElementById('servicios-programados-list');
  if (!card || !container) return;

  const session = (typeof currentSession !== 'undefined' ? currentSession : (typeof window !== 'undefined' ? window.currentSession : null)) || {};
  const isTecnico = session.viewMode === 'tecnico';
  if (!isTecnico) {
    card.style.display = 'none';
    return;
  }

  // Si es técnico, mostramos la tarjeta
  card.style.display = 'block';

  const userList = (typeof usuarios !== 'undefined' ? usuarios : (typeof window !== 'undefined' ? window.usuarios : null)) || [];
  const currentUser = userList.find(u => u && u.id === session.userId);
  const miTecnicoNombre = currentUser ? currentUser.nombre : '';
  const miNombreClean = miTecnicoNombre.trim().toLowerCase();

  if (!miNombreClean) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1.5rem; font-style:italic;">No se pudo resolver el nombre del técnico.</div>`;
    return;
  }

  const getOrders = typeof getFilteredOrders === 'function' ? getFilteredOrders : (typeof window !== 'undefined' && typeof window.getFilteredOrders === 'function' ? window.getFilteredOrders : () => (typeof ordenes !== 'undefined' ? ordenes : (typeof window !== 'undefined' ? window.ordenes : [])) || []);

  // Filtrar órdenes que no estén resueltas / finalizadas
  const pendingServices = (getOrders() || []).filter(o => {
    if (!o) return false;
    const estadoClean = String(o.estado || '').trim().toLowerCase();
    if (estadoClean === 'finalizado' || estadoClean === 'cerrada' || estadoClean === 'completada') return false;

    const orderTecnicoClean = String(o.tecnico || '').trim().toLowerCase();
    const isAssignedToOrder = orderTecnicoClean === miNombreClean ||
      (Array.isArray(o.tecnicosAsignados) && o.tecnicosAsignados.some(t => String(t).trim().toLowerCase() === miNombreClean)) ||
      orderTecnicoClean.split(',').map(s => s.trim()).includes(miNombreClean);

    let hasPendingBitacora = false;
    if (o.bitacora && Array.isArray(o.bitacora)) {
      hasPendingBitacora = o.bitacora.some(b => {
        const bTecnicoClean = String(b.tecnico || '').trim().toLowerCase();
        const esAsignacionPendiente = b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true);
        return bTecnicoClean === miNombreClean && esAsignacionPendiente;
      });
    }

    return isAssignedToOrder || hasPendingBitacora;
  });

  let html = '';
  if (pendingServices.length === 0) {
    html = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1.5rem; font-style:italic;">No tienes servicios programados pendientes. ¡Buen trabajo!</div>`;
  } else {
    pendingServices.forEach(o => {
      let scheduledTimeText = 'No especificada';
      let scheduledDateText = o.fecha ? new Date(o.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha';

      if (o.bitacora && Array.isArray(o.bitacora)) {
        const myBitacora = o.bitacora.find(b => String(b.tecnico || '').trim().toLowerCase() === miNombreClean);
        if (myBitacora) {
          if (myBitacora.fecha) {
            scheduledDateText = new Date(myBitacora.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
          }
          if (myBitacora.entrada) {
            scheduledTimeText = `${myBitacora.entrada} hs`;
            if (myBitacora.salida) {
              scheduledTimeText += ` - ${myBitacora.salida} hs`;
            }
          }
        }
      }
      if (scheduledTimeText === 'No especificada') {
        try {
          const localEvents = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('sapi_calendario_eventos') : null) || '[]');
          const myEv = localEvents.find(e => (e.ordenId === o.id || e.orden_id === o.id) && String(e.tecnicoNombre || e.tecnico_nombre || '').trim().toLowerCase() === miNombreClean);
          if (myEv) {
            const startVal = myEv.fechaInicio || myEv.fecha_inicio || myEv.start;
            if (startVal) {
              const dObj = new Date(startVal);
              scheduledDateText = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
              const ent = `${String(dObj.getHours()).padStart(2,'0')}:${String(dObj.getMinutes()).padStart(2,'0')}`;
              scheduledTimeText = `${ent} hs`;
              const endVal = myEv.fechaFin || myEv.fecha_fin || myEv.end;
              if (endVal) {
                const dEnd = new Date(endVal);
                scheduledTimeText += ` - ${String(dEnd.getHours()).padStart(2,'0')}:${String(dEnd.getMinutes()).padStart(2,'0')} hs`;
              }
            }
          }
        } catch(e){}
      }

      html += `
        <div class="service-item-card" onclick="window.abrirOrdenDesdePerfil('${o.id}')" style="background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; padding:0.75rem 1rem; display:flex; flex-direction:column; gap:0.4rem; cursor:pointer; transition:var(--transition);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:monospace; font-weight:600; color:var(--accent); font-size:0.85rem;">${o.folio}</span>
            <span class="badge" style="background:rgba(245,158,11,0.1); color:var(--orange); font-size:0.7rem; border:1px solid rgba(245,158,11,0.2);">${o.tipo || 'Servicio'}</span>
          </div>
          <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary);">${o.cliente}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${o.marca || ''} ${o.modelo || ''}</div>
          <div style="margin-top:0.25rem; display:flex; gap:0.75rem; flex-wrap:wrap; font-size:0.75rem; border-top:1px dashed var(--border); padding-top:0.4rem;">
            <div style="color:var(--text-muted); display:flex; align-items:center; gap:3px;"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${scheduledDateText}</div>
            <div style="color:var(--accent); display:flex; align-items:center; gap:3px; font-weight:500;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${scheduledTimeText}</div>
          </div>
        </div>
      `;
    });
  }
  container.innerHTML = html;
  const luc = typeof lucide !== 'undefined' ? lucide : (typeof window !== 'undefined' ? window.lucide : null);
  if (luc && typeof luc.createIcons === 'function') {
    luc.createIcons();
  }
}

/**
 * Renderiza la lista inferior de refacciones asociadas al ticket
 */
function renderTicketRefaccionesList(t) {
  if (typeof document === 'undefined') return;
  const refPartsBottom = document.getElementById('ref-ticket-parts-bottom');
  const refBottomPiezasList = document.getElementById('ref-bottom-piezas-list');
  if (refPartsBottom && refBottomPiezasList) {
    refPartsBottom.style.display = 'block';
    refBottomPiezasList.innerHTML = '';
    const parts = (t && t.refaccionesSeleccionadas) || [];
    if (parts.length > 0) {
      parts.forEach(p => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          font-size: 0.85rem;
        `;
        
        let pStatusColor = '#ef4444';
        let pStatusBg = 'rgba(239, 68, 68, 0.1)';
        if (p.estatusPedido === 'En Tránsito / Pedido') {
          pStatusColor = '#e8820c';
          pStatusBg = 'rgba(232, 130, 12, 0.1)';
        } else if (p.estatusPedido === 'Entregado al Técnico') {
          pStatusColor = '#22c55e';
          pStatusBg = 'rgba(34, 197, 94, 0.1)';
        }
        
        let detailsHtml = `(Clave: ${p.clave || p.codigo || 'S/C'})`;
        let extraInfo = [];
        if (p.proveedor) extraInfo.push(`Prov: ${p.proveedor}`);
        if (p.precio) {
          const val = parseFloat(p.precio);
          if (!isNaN(val)) {
            extraInfo.push(`Precio: $${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          } else {
            extraInfo.push(`Precio: $${p.precio}`);
          }
        }
        if (extraInfo.length > 0) {
          detailsHtml += ` • ${extraInfo.join(' | ')}`;
        }

        const ticketId = (t && t.id) || '';
        const descEscaped = (p.descripcion || p.nombre || '').replace(/'/g, "\\'");
        itemDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: 500; color: var(--text-primary);">
              <span style="color: var(--accent); font-weight: 700; margin-right: 4px;">${p.cantidad || p.qty || 1}x</span> 
              ${p.descripcion || p.nombre || 'Sin Descripción'}
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; display: inline-block; margin-left: 8px;">${detailsHtml}</span>
            </span>
            <span class="status-badge" style="font-size: 0.7rem; font-weight: 700; color: ${pStatusColor}; background: ${pStatusBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${pStatusColor}33; cursor: pointer;" onclick="event.stopPropagation(); window.abrirModalPiezaPendienteTicket('${ticketId}', '${p.clave || p.codigo || ''}', '${descEscaped}', '${p.estatusPedido || 'Por Pedir'}', ${p.cantidad || 1}, '${p.marca || ''}')">
              ${p.estatusPedido || 'Por Pedir'}
            </span>
          </div>
        `;
        refBottomPiezasList.appendChild(itemDiv);
      });
    } else {
      refBottomPiezasList.innerHTML = '<span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">Ninguna refacción registrada.</span>';
    }
  }
}

/**
 * Extrae las guías y tarjetas de envío configuradas en el formulario DOM del ticket
 */
function obtenerEnviosDesdeDOM() {
  if (typeof document === 'undefined') return [];
  const container = document.getElementById('envios-container');
  if (!container) return [];

  const cards = container.querySelectorAll('.envio-card');
  const envios = [];

  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    const paqueteria = card.querySelector('.envio-paqueteria')?.value.trim() || '';
    const guiaPedido = card.querySelector('.envio-guia')?.value.trim() || '';
    const fechaPedido = card.querySelector('.envio-fecha-pedido')?.value || '';
    const fechaEntrega = card.querySelector('.envio-fecha-entrega')?.value || '';
    const llego = card.querySelector('.envio-llego')?.checked || false;
    const fechaLlegada = card.querySelector('.envio-fecha-llegada')?.value || '';

    const parts = [];
    const checkboxes = card.querySelectorAll('.envio-part-checkbox:checked');
    checkboxes.forEach(cb => {
      parts.push({
        clave: cb.getAttribute('data-clave') || '',
        descripcion: cb.getAttribute('data-desc') || ''
      });
    });

    envios.push({
      id,
      paqueteria,
      guiaPedido,
      fechaPedido,
      fechaEntrega,
      llego,
      fechaLlegada,
      parts
    });
  });

  return envios;
}

/**
 * Controla la visibilidad de campos de destino cuando todas las piezas fueron entregadas
 */
function actualizarVisibilidadDestinoPiezas(t) {
  if (typeof document === 'undefined' || !t) return;
  let allEntregadas = false;
  if (t.refaccionesSeleccionadas && t.refaccionesSeleccionadas.length > 0) {
    allEntregadas = t.refaccionesSeleccionadas.every(p => p.estatusPedido === 'Entregado al Técnico');
  }

  const destContainer = document.getElementById('ref-ticket-destination-fields');
  const selectDest = document.getElementById('ref-destino-piezas');

  if (destContainer) {
    if (allEntregadas) {
      destContainer.style.display = 'block';
      if (selectDest && selectDest.value === '') {
        selectDest.value = t.destinoPiezas || '';
      }
    } else {
      destContainer.style.display = 'none';
      if (selectDest) selectDest.value = '';
    }
  }
}

/**
 * Actualiza reactivamente el estatus de las refacciones del ticket según las guías
 */
function actualizarEstatusRefaccionesDesdeGuias(t) {
  if (!t) return;
  const getEnvios = typeof obtenerEnviosDesdeDOM === 'function' ? obtenerEnviosDesdeDOM : (typeof window !== 'undefined' && typeof window.obtenerEnviosDesdeDOM === 'function' ? window.obtenerEnviosDesdeDOM : () => []);
  const envios = getEnvios();
  if (t.refaccionesSeleccionadas) {
    t.refaccionesSeleccionadas.forEach(p => {
      const pClave = p.clave || p.codigo || '';
      const pDesc = p.descripcion || p.nombre || '';

      // Find all guides that contain this part
      const matchingEnvios = envios.filter(env => 
        env.parts && env.parts.some(ep => ep.clave === pClave && ep.descripcion === pDesc)
      );

      if (matchingEnvios.length > 0) {
        // If at least one matching guide has llego === true
        const anyArrived = matchingEnvios.some(env => env.llego);
        if (anyArrived) {
          p.estatusPedido = 'Entregado al Técnico';
        } else {
          p.estatusPedido = 'En Tránsito / Pedido';
        }
      } else {
        // Not in any guide
        p.estatusPedido = 'Por Pedir';
      }
    });
  }
  const renderParts = typeof renderTicketRefaccionesList === 'function' ? renderTicketRefaccionesList : (typeof window !== 'undefined' && typeof window.renderTicketRefaccionesList === 'function' ? window.renderTicketRefaccionesList : () => {});
  renderParts(t);

  const updateDest = typeof actualizarVisibilidadDestinoPiezas === 'function' ? actualizarVisibilidadDestinoPiezas : (typeof window !== 'undefined' && typeof window.actualizarVisibilidadDestinoPiezas === 'function' ? window.actualizarVisibilidadDestinoPiezas : () => {});
  updateDest(t);
}

/**
 * Helper: Determina si un ticket requiere una Orden de Servicio en campo o si es solo despacho / refacciones / garantía
 */
function esTicketDeServicioEnCampo(t) {
  if (!t || typeof t !== 'object') return false;
  
  const norm = safeNorm;

  const cat = norm(t.categoria);
  const area = norm(t.area);
  const tipo = norm(t.tipo);
  const asunto = norm(t.asunto);
  const desc = norm(t.descripcion);
  const folio = String(t.folio || '').trim().toUpperCase();

  // 1. Subtickets de refacción (-A) o folios con prefijo de refacción
  if (folio.endsWith('-A') || folio.includes('-REF') || folio.includes('-A-') || folio.startsWith('REF-')) {
    return false;
  }

  // 2. Si el Área es Refacciones, Garantías, Piezas o Almacén
  if (area.includes('refacci') || area.includes('garant') || area.includes('pieza') || area.includes('almacen')) {
    return false;
  }

  // 3. Si la Categoría es Refacción, Refacciones, Garantía, Piezas, Despacho, Envío, Paquetería o Información
  const esCatRefOrGar = cat.includes('refacci') || cat.includes('garant') || cat.includes('pieza') || 
                        cat.includes('despacho') || cat.includes('envio') || cat.includes('paqueteri') || 
                        cat.includes('solicitud de informacion');
  if (esCatRefOrGar) {
    // Si el área o categoría es refacción/garantía sin ser servicio explícito
    if (!cat.includes('servicio') && !cat.includes('mantenimiento') && !cat.includes('puesta en marcha') && !cat.includes('pre-entrega') && !cat.includes('inspeccion') && !cat.includes('reparacion')) {
      return false;
    }
  }

  // 4. Si el Tipo es Refacción, Garantía o Despacho
  if (tipo.includes('refacci') || tipo.includes('garant') || tipo.includes('pieza') || tipo.includes('despacho')) {
    return false;
  }

  // 5. Si el Asunto contiene términos explícitos de refacciones o garantías (y no es servicio técnico en campo)
  const esAsuntoRef = (asunto.includes('refacci') || asunto.includes('garant') || asunto.includes('despacho')) &&
                      !asunto.includes('servicio') && !asunto.includes('mantenimiento') && !asunto.includes('puesta en marcha') && !asunto.includes('reparacion');
  if (esAsuntoRef) {
    return false;
  }

  // 6. Si el destino de las piezas es directo al cliente
  if (t.destinoPiezas === 'cliente') {
    return false;
  }

  // 7. Si el ticket tiene refacciones o envíos y no es un servicio técnico en campo explícito
  const esServicioTecnicoExplicito = cat.includes('servicio') || cat.includes('mantenimiento') || cat.includes('puesta en marcha') || cat.includes('pre-entrega') || cat.includes('inspeccion') || cat.includes('reparacion');
  const tieneRefacciones = (Array.isArray(t.refaccionesSeleccionadas) && t.refaccionesSeleccionadas.length > 0) || (Array.isArray(t.envios) && t.envios.length > 0) || (t.guiaPedido && String(t.guiaPedido).trim().length > 0);
  
  if (tieneRefacciones && !esServicioTecnicoExplicito) {
    return false;
  }

  // 8. Solo retornar true si existe indicación de servicio / mantenimiento / puesta en marcha / pre-entrega / soporte en campo
  const esServicio = esServicioTecnicoExplicito || 
                     cat.includes('soporte') || cat.includes('otro') ||
                     area.includes('servicio') || area.includes('operaciones') || area.includes('soporte') ||
                     tipo.includes('servicio') || tipo.includes('preventivo') || tipo.includes('correctivo');

  return esServicio;
}

/**
 * Renderiza las tarjetas de guías de envío dentro del formulario de tickets
 */
function renderEnvioCards(t) {
  if (typeof document === 'undefined' || !t) return;
  const container = document.getElementById('envios-container');
  if (!container) return;
  container.innerHTML = '';

  let envios = t.envios || [];
  
  // Backward compatibility: if envios is empty but legacy single shipment info exists, initialize
  if (envios.length === 0 && (t.paqueteria || t.guiaPedido || t.fechaPedido || t.fechaEntrega)) {
    envios.push({
      id: Math.random().toString(36).substring(2, 9),
      paqueteria: t.paqueteria || '',
      guiaPedido: t.guiaPedido || '',
      fechaPedido: t.fechaPedido || '',
      fechaEntrega: t.fechaEntrega || '',
      llego: false,
      fechaLlegada: '',
      parts: (t.refaccionesSeleccionadas || []).map(p => ({
        clave: p.clave || p.codigo || '',
        descripcion: p.descripcion || p.nombre || ''
      }))
    });
  }

  // If still empty, push one empty one so there is at least one input fields set visible
  if (envios.length === 0) {
    envios.push({
      id: Math.random().toString(36).substring(2, 9),
      paqueteria: '',
      guiaPedido: '',
      fechaPedido: '',
      fechaEntrega: '',
      llego: false,
      fechaLlegada: '',
      parts: []
    });
  }

  t.envios = envios;

  envios.forEach((envio, index) => {
    const card = document.createElement('div');
    card.className = 'envio-card';
    card.setAttribute('data-id', envio.id);
    card.style.cssText = 'background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; position: relative; display: flex; flex-direction: column; gap: 0.75rem; width: 100%; box-sizing: border-box;';
    
    // Checkbox items for all parts in the ticket
    const ticketParts = t.refaccionesSeleccionadas || [];
    let partsCheckboxesHtml = '';
    if (ticketParts.length > 0) {
      partsCheckboxesHtml = ticketParts.map(p => {
        const pClave = p.clave || p.codigo || '';
        const pDesc = p.descripcion || p.nombre || '';
        const isChecked = envio.parts && envio.parts.some(ep => ep.clave === pClave && ep.descripcion === pDesc);
        const checkedAttr = isChecked ? 'checked' : '';
        return `
          <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; user-select: none; padding: 2px 0;">
            <input type="checkbox" class="envio-part-checkbox" data-clave="${pClave}" data-desc="${pDesc}" ${checkedAttr} style="margin-top: 3px;" />
            <span><strong style="color: var(--accent);">${p.cantidad || p.qty || 1}x</strong> ${pDesc} <span style="color: var(--text-muted); font-size: 0.75rem; font-family: monospace;">(${pClave})</span></span>
          </label>
        `;
      }).join('');
    } else {
      partsCheckboxesHtml = '<span style="color: var(--text-muted); font-style: italic; font-size: 0.8rem;">No hay refacciones en este ticket.</span>';
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Guía / Envío #${index + 1}</span>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; user-select: none; margin-bottom: 0;">
            <input type="checkbox" class="envio-llego" ${envio.llego ? 'checked' : ''} style="margin-top: 2px;" />
            <span>¿Ya Llegó?</span>
          </label>
          <div class="envio-fecha-llegada-container" style="display: ${envio.llego ? 'flex' : 'none'}; align-items: center; gap: 4px;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">el:</span>
            <input type="date" class="envio-fecha-llegada" value="${envio.fechaLlegada || ''}" style="padding: 0.25rem; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
          </div>
          <button type="button" class="btn-delete-envio" style="background: none; border: none; color: #ef4444; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Eliminar
          </button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Paquetería</label>
          <input type="text" class="envio-paqueteria" value="${envio.paqueteria || ''}" placeholder="E.j. DHL, FedEx, RedPack" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Guía de Pedido</label>
          <input type="text" class="envio-guia" value="${envio.guiaPedido || ''}" placeholder="Número de Guía" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Fecha de Pedido</label>
          <input type="date" class="envio-fecha-pedido" value="${envio.fechaPedido || ''}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Fecha de Entrega</label>
          <input type="date" class="envio-fecha-entrega" value="${envio.fechaEntrega || ''}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit;" />
        </div>
      </div>
      
      <div class="envio-time-text" style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border);">
        <i data-lucide="clock" style="width: 14px; height: 14px; color: var(--accent);"></i>
        <span>El tiempo se calculará al ingresar las fechas.</span>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.25rem;">
        <label style="font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">Refacciones en este envío:</label>
        <div class="envio-parts-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; padding: 2px;">
          ${partsCheckboxesHtml}
        </div>
      </div>
    `;

    // Event listener for delete button
    const deleteBtn = card.querySelector('.btn-delete-envio');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        t.envios = t.envios.filter(x => x.id !== envio.id);
        const reRender = typeof renderEnvioCards === 'function' ? renderEnvioCards : (typeof window !== 'undefined' && typeof window.renderEnvioCards === 'function' ? window.renderEnvioCards : () => {});
        reRender(t);
        const updateStatus = typeof actualizarEstatusRefaccionesDesdeGuias === 'function' ? actualizarEstatusRefaccionesDesdeGuias : (typeof window !== 'undefined' && typeof window.actualizarEstatusRefaccionesDesdeGuias === 'function' ? window.actualizarEstatusRefaccionesDesdeGuias : () => {});
        updateStatus(t);
      };
    }

    // Calculate time helper
    const updateTime = () => {
      const fPedido = card.querySelector('.envio-fecha-pedido')?.value;
      const fEntrega = card.querySelector('.envio-fecha-entrega')?.value;
      const textSpan = card.querySelector('.envio-time-text span');
      if (!textSpan) return;

      let parts = [];
      if (fPedido) {
        const reqDate = new Date(fPedido);
        reqDate.setHours(0,0,0,0);
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const diffTranscurrido = Math.floor((hoy.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffTranscurrido >= 0) {
          parts.push(`Transcurrido: <strong style="color: var(--accent);">${diffTranscurrido}d</strong>`);
        }
      }

      if (fEntrega) {
        const estDate = new Date(fEntrega);
        estDate.setHours(0,0,0,0);
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const diffFaltante = Math.ceil((estDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffFaltante > 0) {
          parts.push(`Faltan: <strong style="color: var(--text-primary);">${diffFaltante}d</strong>`);
        } else if (diffFaltante === 0) {
          parts.push(`<span style="color: #f97316; font-weight: 700;">¡Se entrega HOY!</span>`);
        } else {
          parts.push(`<span style="color: #ef4444; font-weight: 700;">⚠️ Atrasado: ${Math.abs(diffFaltante)}d</span>`);
        }
      }

      if (parts.length > 0) {
        textSpan.innerHTML = parts.join(' | ');
      } else {
        textSpan.innerHTML = 'El tiempo se calculará al ingresar las fechas.';
      }
    };

    const inputFPedido = card.querySelector('.envio-fecha-pedido');
    if (inputFPedido) inputFPedido.onchange = updateTime;
    const inputFEntrega = card.querySelector('.envio-fecha-entrega');
    if (inputFEntrega) inputFEntrega.onchange = updateTime;
    updateTime();

    // Listen to changes to auto update refacciones statuses
    card.querySelectorAll('.envio-part-checkbox').forEach(cb => {
      cb.onchange = () => {
        const updateStatus = typeof actualizarEstatusRefaccionesDesdeGuias === 'function' ? actualizarEstatusRefaccionesDesdeGuias : (typeof window !== 'undefined' && typeof window.actualizarEstatusRefaccionesDesdeGuias === 'function' ? window.actualizarEstatusRefaccionesDesdeGuias : () => {});
        updateStatus(t);
      };
    });

    const chkLlego = card.querySelector('.envio-llego');
    const fLlegadaContainer = card.querySelector('.envio-fecha-llegada-container');
    const fLlegadaInput = card.querySelector('.envio-fecha-llegada');

    if (chkLlego) {
      chkLlego.onchange = () => {
        if (chkLlego.checked) {
          if (fLlegadaContainer) fLlegadaContainer.style.display = 'flex';
          if (fLlegadaInput && !fLlegadaInput.value) {
            const offset = new Date().getTimezoneOffset();
            const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
            fLlegadaInput.value = localDate.toISOString().split('T')[0];
          }
        } else {
          if (fLlegadaContainer) fLlegadaContainer.style.display = 'none';
          if (fLlegadaInput) fLlegadaInput.value = '';
        }
        const updateStatus = typeof actualizarEstatusRefaccionesDesdeGuias === 'function' ? actualizarEstatusRefaccionesDesdeGuias : (typeof window !== 'undefined' && typeof window.actualizarEstatusRefaccionesDesdeGuias === 'function' ? window.actualizarEstatusRefaccionesDesdeGuias : () => {});
        updateStatus(t);
      };
    }

    if (fLlegadaInput) {
      fLlegadaInput.onchange = () => {
        const updateStatus = typeof actualizarEstatusRefaccionesDesdeGuias === 'function' ? actualizarEstatusRefaccionesDesdeGuias : (typeof window !== 'undefined' && typeof window.actualizarEstatusRefaccionesDesdeGuias === 'function' ? window.actualizarEstatusRefaccionesDesdeGuias : () => {});
        updateStatus(t);
      };
    }

    container.appendChild(card);
  });

  const luc = typeof lucide !== 'undefined' ? lucide : (typeof window !== 'undefined' ? window.lucide : null);
  if (luc && typeof luc.createIcons === 'function') {
    luc.createIcons({ root: container });
  }
}

// Retrocompatibilidad con window si estamos en navegador
if (typeof window !== 'undefined') {
  window.renderServiciosProgramadosTecnico = renderServiciosProgramadosTecnico;
  window.renderTicketRefaccionesList = renderTicketRefaccionesList;
  window.obtenerEnviosDesdeDOM = obtenerEnviosDesdeDOM;
  window.actualizarVisibilidadDestinoPiezas = actualizarVisibilidadDestinoPiezas;
  window.actualizarEstatusRefaccionesDesdeGuias = actualizarEstatusRefaccionesDesdeGuias;
  window.esTicketDeServicioEnCampo = esTicketDeServicioEnCampo;
  window.renderEnvioCards = renderEnvioCards;
  window.ServiciosProgramados = {
    renderServiciosProgramadosTecnico,
    renderTicketRefaccionesList,
    obtenerEnviosDesdeDOM,
    actualizarVisibilidadDestinoPiezas,
    actualizarEstatusRefaccionesDesdeGuias,
    esTicketDeServicioEnCampo,
    renderEnvioCards
  };
}

export {
  renderServiciosProgramadosTecnico,
  renderTicketRefaccionesList,
  obtenerEnviosDesdeDOM,
  actualizarVisibilidadDestinoPiezas,
  actualizarEstatusRefaccionesDesdeGuias,
  esTicketDeServicioEnCampo,
  renderEnvioCards
};
