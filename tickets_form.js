/**
 * Módulo de Formulario, Validación y Guardado de Tickets - Eurorep / SAPI
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

  let editandoTicketId = (typeof window !== "undefined" && window.editandoTicketId) || null;

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

// ===== TICKET FORM =====
function abrirTicket(id) {
  if (typeof document === 'undefined') return;
  if (!id && currentSession.viewMode === 'consulta') {
    mostrarNotificacion('El rol Consulta no puede generar tickets.', 'error');
    return;
  }
  editandoTicketId = id || null;
  if (typeof window !== 'undefined') window.editandoTicketId = editandoTicketId;
  document.getElementById('ticket-modal-title').textContent = id ? 'Editar Ticket' : 'Nuevo Ticket';
  
  const btnSubmit = document.getElementById('btn-submit-ticket');
  if (btnSubmit) {
    btnSubmit.innerHTML = id ? '<i data-lucide="save" class="btn-icon"></i> Guardar Cambios' : '<i data-lucide="save" class="btn-icon"></i> Emitir Ticket';
  }

  document.getElementById('form-ticket').reset();
  
  const statusDiv = document.getElementById('t-sap-validation-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
  }

  const pedidoStatusDiv = document.getElementById('t-pedido-sap-validation-status');
  if (pedidoStatusDiv) {
    pedidoStatusDiv.style.display = 'none';
    pedidoStatusDiv.innerHTML = '';
  }

  const pedidoPdfExtDiv = document.getElementById('pdf-pedido-extraction-table-container');
  if (pedidoPdfExtDiv) {
    pedidoPdfExtDiv.style.display = 'none';
    pedidoPdfExtDiv.innerHTML = '';
  }

  window._lastPdfPedidoExtracted = null;

  const t = id ? tickets.find(x => x.id === id) : null;

  window.editandoCotizaciones = [];
  if (t) {
    if (Array.isArray(t.cotizacionesAdicionales) && t.cotizacionesAdicionales.length > 0) {
      window.editandoCotizaciones = JSON.parse(JSON.stringify(t.cotizacionesAdicionales));
    } else if (t.cotizacionSAP) {
      window.editandoCotizaciones = [{
        sap: t.cotizacionSAP,
        monto: t.montoCotizacion || 0,
        pdf: t.pdfCotizacion || null
      }];
    }
  }

  setTimeout(() => {
    if (window.renderLinkedCotizaciones) {
      window.renderLinkedCotizaciones(true);
    }
  }, 100);

  if (window.poblarCotizacionesDropdown) {
    window.poblarCotizacionesDropdown(true, null, '');
  }

  if (window.poblarPedidosDropdown) {
    window.poblarPedidosDropdown(true, null, t ? t.pedidoSAP : '');
  }

  if (t && t.pedidoSAP) {
    const elPedMonto = document.getElementById('t-pedido-monto');
    // Si ya existe monto del pedido en el ticket lo mostramos, de lo contrario buscamos en la orden de SAP
    if (elPedMonto) {
      const order = (window._cachePedidosSap || []).find(o => o.numero_pedido === t.pedidoSAP);
      elPedMonto.value = t.montoPedido || (order ? order.monto : '');
    }
    setTimeout(() => {
      if (window.validarPedidoConSAP) {
        window.validarPedidoConSAP(true);
      }
    }, 200);
  } else {
    const elPedMonto = document.getElementById('t-pedido-monto');
    if (elPedMonto) elPedMonto.value = '';
  }

  // Reset file labels
  ['t-cotizacion-pdf', 't-pedido-pdf'].forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) {
      const textSpan = el.parentElement.querySelector('.file-label-text');
      const hasPdf = inputId === 't-cotizacion-pdf' ? t?.pdfCotizacion : t?.pdfPedido;
      
      if (textSpan) textSpan.textContent = hasPdf ? 'PDF guardado (Sube para reemplazar)' : (inputId === 't-cotizacion-pdf' ? 'Subir cotización en PDF' : 'Subir pedido en PDF');
      
      el.parentElement.style.borderColor = hasPdf ? 'var(--accent)' : 'var(--border)';
      el.parentElement.style.color = hasPdf ? 'var(--accent)' : 'var(--text-muted)';
      el.parentElement.style.background = hasPdf ? 'var(--accent-light)' : 'rgba(255,255,255,0.02)';
    }
  });

  const destPiezasEl = document.getElementById('ref-destino-piezas');
  if (destPiezasEl) destPiezasEl.value = '';

  const destPrecioEl = document.getElementById('ref-destino-precio');
  if (destPrecioEl) destPrecioEl.value = '';

  const destPdfInput = document.getElementById('ref-destino-pdf-file');
  if (destPdfInput) destPdfInput.value = '';

  const destPdfSpan = destPdfInput?.parentElement?.querySelector('.file-label-text');
  if (destPdfSpan) {
    destPdfSpan.textContent = 'Subir PDF';
    const parentLabel = destPdfSpan.parentElement;
    parentLabel.style.borderColor = 'var(--border)';
    parentLabel.style.color = 'var(--text-secondary)';
    parentLabel.style.background = 'var(--bg-primary)';
  }
  const destPdfVerBtn = document.getElementById('btn-ver-destino-pdf');
  if (destPdfVerBtn) destPdfVerBtn.style.display = 'none';
  
  // Llenar el combo de clientes
  const comboOptions = document.getElementById('t-cliente-options');
  const inputHidden = document.getElementById('t-cliente');
  const displaySpan = document.getElementById('t-cliente-display');
  
  const isEmpresa = currentSession.viewMode === 'empresa';
  const currentUser = usuarios.find(u => u.id === currentSession.userId);
  const nombreEmpresaLogged = isEmpresa && currentUser ? (currentUser.empresa || currentUser.nombre) : null;

  // Ocultar campos internos para el cliente
  const displayVal = isEmpresa ? 'none' : 'block';
  const displayValFlex = isEmpresa ? 'none' : 'flex';
  const elOrigen = document.getElementById('section-t-origen'); if (elOrigen) elOrigen.style.display = displayVal;
  const elCliente = document.getElementById('group-t-cliente'); if (elCliente) elCliente.style.display = displayVal;
  const elAsignado = document.getElementById('group-t-asignado'); if (elAsignado) elAsignado.style.display = displayVal;
  const elNotas = document.getElementById('group-t-notas'); if (elNotas) elNotas.style.display = displayVal;
  const elEstado = document.getElementById('section-t-estado'); if (elEstado) elEstado.style.display = (isEmpresa || !id) ? 'none' : 'block';
  const elEvidencias = document.getElementById('group-t-evidencias'); if (elEvidencias) elEvidencias.style.display = isEmpresa ? 'block' : 'none';

  if (comboOptions && !isEmpresa) {
    // Resetear valor inicial
    inputHidden.value = '';
    displaySpan.textContent = 'Ninguno / Uso Interno';
    
    // Generar opciones
    comboOptions.innerHTML = `<div class="combo-option" onclick="selectComboOption('t-cliente', '', 'Ninguno / Uso Interno')">Ninguno / Uso Interno</div>`;
    
    const legacyMap = new Map();
    ordenes.forEach(o => { if (o.cliente && !legacyMap.has(o.cliente)) legacyMap.set(o.cliente, o.cliente); });
    const mergedNames = [...new Set([...clientesDb.map(c => c.nombre), ...legacyMap.values()])].sort();
    
    mergedNames.forEach(nombre => {
      const escaped = nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      comboOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-cliente', '${escaped}', '${escaped}')">${nombre}</div>`;
    });
  }

  // Reset canal inputs
  ['correo','whatsapp','telefono'].forEach(c => {
    const box = document.getElementById('canal-input-' + c);
    if (box) box.style.display = 'none';
  });
  document.getElementById('t-sitio').value = '';
  document.getElementById('group-t-sitio').style.display = 'none';
  poblarMaquinasCliente('t-equipo', '');
  const selectedEquiposContainer = document.getElementById('t-equipos-seleccionados');
  if (selectedEquiposContainer) selectedEquiposContainer.innerHTML = '';

  const selectAsignado = document.getElementById('t-asignado');
  if (selectAsignado) {
    selectAsignado.innerHTML = '<option value="">Sin asignar</option>';
    usuarios.filter(u => u && ['supervisor', 'admin', 'superadmin'].includes(u.rol) && u.activo !== false && ((typeof isTestModeActive === 'function' && isTestModeActive()) || !(typeof isTestUser === 'function' && isTestUser(u)))).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.nombre;
      opt.textContent = u.nombre;
      selectAsignado.appendChild(opt);
    });
  }

  // Si es empresa y es un ticket nuevo, autocompletamos su perfil
  if (isEmpresa && !id) {
    document.getElementById('t-solicitante').value = currentUser ? currentUser.nombre : '';
    const cliName = currentUser ? (currentUser.empresa || currentUser.nombre) : '';
    if (cliName) {
      selectComboOption('t-cliente', cliName, cliName);
    }
  }

  // Ocultar campos internos si es Empresa
  const displayInternal = isEmpresa ? 'none' : '';
  ['section-t-origen', 'group-t-cliente', 'group-t-asignado', 'group-t-notas', 'section-t-estado', 'group-t-resolucion', 'group-t-cierre'].forEach(elId => {
    const el = document.getElementById(elId);
    if (el) {
      if (!isEmpresa && elId === 'group-t-cliente') {
        el.style.display = 'block'; // Ensure block for combo box wrapper
      } else if (elId === 'section-t-estado') {
        el.style.display = (id && !isEmpresa) ? 'block' : 'none'; // Only show if editing and not empresa
      } else {
        el.style.display = displayInternal;
      }
    }
  });

  if (id) {
    const t = tickets.find(x => x.id === id);
    if (t) {
      editandoTicketId = id;
      document.getElementById('ticket-modal-title').textContent = 'Editar Ticket: ' + t.folio;
      document.getElementById('t-asunto').value = t.asunto || '';
      document.getElementById('t-solicitante').value = t.solicitante || '';
      document.getElementById('t-area').value = t.area || 'Operaciones';
      document.getElementById('t-cliente').value = t.cliente || '';
      document.getElementById('t-sitio').value = t.sitio || '';
      document.getElementById('t-categoria').value = t.categoria || 'Refacción';
      document.getElementById('t-prioridad').value = t.prioridad || 'Media';
      const selectAsignado = document.getElementById('t-asignado');
      if (selectAsignado) {
        if (t.asignado && t.asignado !== 'Sin Asignar' && t.asignado !== 'sin_asignar' && t.asignado !== '-') {
          let exists = Array.from(selectAsignado.options).some(o => o.value === t.asignado);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = t.asignado;
            opt.textContent = t.asignado;
            selectAsignado.appendChild(opt);
          }
          selectAsignado.value = t.asignado;
        } else {
          selectAsignado.value = '';
        }
      }
      document.getElementById('t-descripcion').value = t.descripcion || '';
      document.getElementById('t-notas').value = t.notas || '';
      
      const horometroEl = document.getElementById('t-horometro');
      if (horometroEl) horometroEl.value = t.horometro || '';
      
      const rEstado = document.querySelector(`input[name="t-estado"][value="${t.estado}"]`);
      if (rEstado) rEstado.checked = true;

      const rCanal = document.querySelector(`input[name="t-canal"][value="${t.canal}"]`);
      if (rCanal) {
        rCanal.checked = true;
        seleccionarCanal(t.canal);
        if (t.canal === 'correo') document.getElementById('t-correo').value = t.contacto || '';
        if (t.canal === 'whatsapp') document.getElementById('t-whatsapp').value = t.contacto || '';
        if (t.canal === 'telefono') document.getElementById('t-telefono').value = t.contacto || '';
      } else {
        // Deseleccionar canales y ocultar inputs si es un canal del portal o vacío
        document.querySelectorAll('input[name="t-canal"]').forEach(el => el.checked = false);
        seleccionarCanal('');
      }
      
      const pTicket = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
      const assocOrd = typeof window.obtenerOrdenAsociadaTicket === 'function' ? window.obtenerOrdenAsociadaTicket(t) : null;
      const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(t) : '';
      const effectiveCliente = resolvedCli || t.cliente || (pTicket && pTicket.cliente ? pTicket.cliente : (assocOrd && assocOrd.cliente ? assocOrd.cliente : ''));
      const effectiveSitio = t.sitio || (pTicket && pTicket.sitio ? pTicket.sitio : (assocOrd && (assocOrd.ubicacion || assocOrd.ubicacion_sitio) ? (assocOrd.ubicacion || assocOrd.ubicacion_sitio) : ''));

      if (effectiveCliente) {
        selectComboOption('t-cliente', effectiveCliente, effectiveCliente);
      } else {
        selectComboOption('t-cliente', 'Ninguno / Uso Interno', 'Ninguno / Uso Interno');
      }
      if (effectiveSitio) {
        const escapedSitio = effectiveSitio.replace(/'/g, "\\'");
        selectComboOption('t-sitio', escapedSitio, escapedSitio, true);
      }

      poblarMaquinasCliente('t-equipo', '', effectiveCliente || t.cliente);
      const effectiveEquipo = (t.equipo && t.equipo !== 'Otra / No registrada') ? t.equipo : ((pTicket && pTicket.equipo && pTicket.equipo !== 'Otra / No registrada') ? pTicket.equipo : ((assocOrd && assocOrd.equipo) ? assocOrd.equipo : (t.equipo || '')));
      if (effectiveEquipo) {
        effectiveEquipo.split(', ').forEach(eqName => {
          if (eqName.trim()) {
            window.agregarMaquinaChip(eqName.trim());
          }
        });
      }
      
      const elCotSap = document.getElementById('t-cotizacion-sap');
      if (elCotSap) elCotSap.value = '';
      
      const elCotMonto = document.getElementById('t-cotizacion-monto');
      if (elCotMonto) elCotMonto.value = '';
      
      const elPedidoSap = document.getElementById('t-pedido-sap');
      if (elPedidoSap) elPedidoSap.value = t.pedidoSAP || '';
      
      const rAceptada = document.querySelector(`input[name="t-cot-aceptada"][value="${t.cotAceptada}"]`);
      if (rAceptada) rAceptada.checked = true;
      else {
        document.querySelectorAll('input[name="t-cot-aceptada"]').forEach(r => r.checked = false);
      }
      
      const elMotivo = document.getElementById('t-motivo-rechazo');
      if (elMotivo) elMotivo.value = t.motivoRechazo || '';

      const destPiezasEl = document.getElementById('ref-destino-piezas');
      if (destPiezasEl) destPiezasEl.value = t.destinoPiezas || '';

      const destPrecioEl = document.getElementById('ref-destino-precio');
      if (destPrecioEl) destPrecioEl.value = t.destinoPrecio || '';

      const destPdfInput = document.getElementById('ref-destino-pdf-file');
      const destPdfSpan = destPdfInput?.parentElement?.querySelector('.file-label-text');
      const hasDestinoPdf = !!t.destinoPdfUrl;
      const destPdfVerBtn = document.getElementById('btn-ver-destino-pdf');

      if (destPdfSpan) {
        destPdfSpan.textContent = hasDestinoPdf ? 'PDF guardado (Sube para reemplazar)' : 'Subir PDF';
        const parentLabel = destPdfSpan.parentElement;
        parentLabel.style.borderColor = hasDestinoPdf ? 'var(--accent)' : 'var(--border)';
        parentLabel.style.color = hasDestinoPdf ? 'var(--accent)' : 'var(--text-secondary)';
        parentLabel.style.background = hasDestinoPdf ? 'var(--accent-light)' : 'var(--bg-primary)';
      }
      if (destPdfVerBtn) {
        destPdfVerBtn.style.display = hasDestinoPdf ? 'inline-flex' : 'none';
      }
    }
  }

  // Cargar y mostrar la evidencia fotográfica del cliente si existe
  const elAdminEvidencia = document.getElementById('group-t-admin-evidencia');
  const imgAdminEvidencia = document.getElementById('t-admin-evidence-img');
  const loaderAdminEvidencia = document.getElementById('t-admin-evidence-loading');

  if (elAdminEvidencia && imgAdminEvidencia && loaderAdminEvidencia) {
    if (t && t.pdfCotizacion && !t.cotizacionSAP) {
      elAdminEvidencia.style.display = 'block';
      const isPlaceholder = t.pdfCotizacion === '__HAS_PDF__';
      if (isPlaceholder) {
        imgAdminEvidencia.src = '';
        imgAdminEvidencia.style.display = 'none';
        loaderAdminEvidencia.style.display = 'inline-block';
        
        // Descargar bajo demanda
        setTimeout(async () => {
          try {
            const { data, error } = await window.supabaseClient
              .from('tickets')
              .select('pdf_cotizacion')
              .eq('id', t.id)
              .single();
            if (error) throw error;
            const base64 = data ? data.pdf_cotizacion : null;
            if (base64) {
              t.pdfCotizacion = base64; // guardar localmente en caché
              imgAdminEvidencia.src = base64;
              imgAdminEvidencia.style.display = 'block';
              loaderAdminEvidencia.style.display = 'none';
            } else {
              loaderAdminEvidencia.innerHTML = '<span style="color:var(--text-muted);">Sin imagen</span>';
            }
          } catch (err) {
            console.error('Error cargando evidencia fotográfica en admin:', err);
            loaderAdminEvidencia.innerHTML = '<span style="color:var(--red);">Error al cargar imagen</span>';
          }
        }, 50);
      } else {
        imgAdminEvidencia.src = t.pdfCotizacion;
        imgAdminEvidencia.style.display = 'block';
        loaderAdminEvidencia.style.display = 'none';
      }
    } else {
      elAdminEvidencia.style.display = 'none';
      imgAdminEvidencia.src = '';
      imgAdminEvidencia.style.display = 'none';
      loaderAdminEvidencia.style.display = 'none';
    }
  }

  toggleResolucionTicket();
  toggleMotivoRechazo();

  // Control de campos y cabecera para Tickets de Refacciones / Garantías
  const isRefTicket = t && t.folio && t.folio.endsWith('-A');
  const catLower = (t && t.categoria ? t.categoria : (document.getElementById('t-categoria')?.value || '')).trim().toLowerCase();
  const isShippingCategory = !window.esTicketDeServicioEnCampo(t || { categoria: catLower });
  const refHeader = document.getElementById('ref-ticket-info-header');
  const refShippingFields = document.getElementById('ref-ticket-shipping-fields');

  if (isRefTicket) {
    if (refShippingFields) {
      refShippingFields.style.display = 'block';
      window.renderEnvioCards(t);

      const btnAdd = document.getElementById('btn-add-envio');
      if (btnAdd) {
        btnAdd.onclick = () => {
          const envios = t.envios || [];
          envios.push({
            id: Math.random().toString(36).substring(2, 9),
            paqueteria: '',
            guiaPedido: '',
            fechaPedido: '',
            fechaEntrega: '',
            parts: []
          });
          t.envios = envios;
          window.renderEnvioCards(t);
        };
      }
    }
    if (refHeader) {
      refHeader.style.display = 'block';
      document.getElementById('ref-info-cliente').textContent = t.cliente || 'Ninguno';
      document.getElementById('ref-info-sitio').textContent = t.sitio || 'Ninguno';
      document.getElementById('ref-info-solicitante').textContent = t.solicitante || 'Sistema';
      document.getElementById('ref-info-horometro').textContent = (t.horometro && t.horometro !== 'N/A') ? `${t.horometro} h` : 'Ninguno';
      
      const elRefInfoCat = document.getElementById('ref-info-categoria');
      if (elRefInfoCat) {
        elRefInfoCat.textContent = t.categoria || 'Refacción';
      }

      // Populate Service Order client signature date & Order link button
      const assocOrder = window.obtenerOrdenAsociadaTicket(t);
      const elRefCierre = document.getElementById('ref-info-fechacierre');
      if (elRefCierre) {
        let signatureDateStr = 'Pendiente';
        if (assocOrder && assocOrder.firma_cliente_fecha) {
          signatureDateStr = new Date(assocOrder.firma_cliente_fecha).toLocaleDateString();
        }
        elRefCierre.textContent = signatureDateStr;
      }

      const elRefOrdenBtn = document.getElementById('ref-info-orden-btn-container');
      if (elRefOrdenBtn) {
        if (assocOrder && assocOrder.id) {
          elRefOrdenBtn.innerHTML = `
            <button type="button" onclick="window.verOrdenDesdeTicket('${assocOrder.id}')" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.75rem; font-weight:600; color:#2563eb; border:1px solid rgba(37,99,235,0.3); background:rgba(37,99,235,0.08); border-radius:6px; cursor:pointer;">
              <i data-lucide="file-text" style="width:13px;height:13px;"></i> Ver Orden de Servicio (${assocOrder.folio || assocOrder.id})
            </button>
          `;
        } else {
          const parentTicket = typeof window.obtenerTicketPadre === 'function' ? window.obtenerTicketPadre(t) : null;
          if (parentTicket) {
            elRefOrdenBtn.innerHTML = `
              <button type="button" onclick="verDetalleTicket('${parentTicket.id}')" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.75rem; font-weight:600; color:#ea580c; border:1px solid rgba(234,88,12,0.3); background:rgba(234,88,12,0.08); border-radius:6px; cursor:pointer;">
                <i data-lucide="ticket" style="width:13px;height:13px;"></i> Ver Ticket Origen (${parentTicket.folio || parentTicket.id})
              </button>
            `;
          } else {
            elRefOrdenBtn.innerHTML = '';
          }
        }
      }

      // Populate machinery badges
      const refInfoMaq = document.getElementById('ref-info-maquinaria');
      if (refInfoMaq) {
        refInfoMaq.innerHTML = '';
        if (t.equipo) {
          t.equipo.split(', ').forEach(eqName => {
            if (eqName.trim()) {
              const badge = document.createElement('span');
              badge.style.cssText = `
                background: rgba(232, 130, 12, 0.08);
                color: var(--accent);
                border: 1px solid rgba(232, 130, 12, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 0.78rem;
              `;
              badge.textContent = eqName.trim();
              refInfoMaq.appendChild(badge);
            }
          });
        } else {
          refInfoMaq.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Ninguno</span>';
        }
      }
    }

    // Populate parts list in the bottom container
    window.renderTicketRefaccionesList(t);
    window.actualizarVisibilidadDestinoPiezas(t);

    // Hide input groups and generation section
    if (document.getElementById('group-t-cliente')) document.getElementById('group-t-cliente').style.display = 'none';
    if (document.getElementById('group-t-sitio')) document.getElementById('group-t-sitio').style.display = 'none';
    if (document.getElementById('group-t-solicitante')) document.getElementById('group-t-solicitante').style.display = 'none';
    if (document.getElementById('group-t-maquinaria')) document.getElementById('group-t-maquinaria').style.display = 'none';
    if (document.getElementById('group-t-horometro')) document.getElementById('group-t-horometro').style.display = 'none';
    if (document.getElementById('group-t-categoria')) document.getElementById('group-t-categoria').style.display = 'none';
    if (document.getElementById('section-t-origen')) document.getElementById('section-t-origen').style.display = 'none';
    
    // Hide status section for parts tickets
    if (document.getElementById('section-t-estado')) document.getElementById('section-t-estado').style.display = 'none';

    // Force category to 'Refacción' and disable selection
    const catSelect = document.getElementById('t-categoria');
    if (catSelect) {
      catSelect.value = 'Refacción';
      catSelect.disabled = true;
    }
  } else {
    if (refHeader) refHeader.style.display = 'none';
    
    // Los envíos ahora se gestionan centralizadamente desde el módulo de Envíos
    if (refShippingFields) {
      refShippingFields.style.display = 'none';
    }

    if (document.getElementById('ref-ticket-destination-fields')) {
      document.getElementById('ref-ticket-destination-fields').style.display = 'none';
    }
    const refPartsBottom = document.getElementById('ref-ticket-parts-bottom');
    if (refPartsBottom) refPartsBottom.style.display = 'none';

    // Restore input groups and generation section
    if (document.getElementById('group-t-cliente')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('group-t-cliente').style.display = isEmpresa ? 'none' : 'block';
    }
    if (document.getElementById('group-t-solicitante')) {
      document.getElementById('group-t-solicitante').style.display = 'block';
    }
    if (document.getElementById('group-t-maquinaria')) {
      document.getElementById('group-t-maquinaria').style.display = 'block';
    }
    if (document.getElementById('group-t-horometro')) {
      document.getElementById('group-t-horometro').style.display = 'block';
    }
    if (document.getElementById('group-t-categoria')) {
      document.getElementById('group-t-categoria').style.display = 'block';
      const catSelect = document.getElementById('t-categoria');
      if (catSelect) {
        catSelect.disabled = false;
      }
    }
    if (document.getElementById('section-t-origen')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('section-t-origen').style.display = isEmpresa ? 'none' : 'block';
    }
    
    // Restore status section
    if (document.getElementById('section-t-estado')) {
      const isEmpresa = currentSession.viewMode === 'empresa';
      document.getElementById('section-t-estado').style.display = (id && !isEmpresa) ? 'block' : 'none';
    }

    // Enable category selector
    const catSelect = document.getElementById('t-categoria');
    if (catSelect) {
      catSelect.disabled = false;
    }

    const selectEq = document.getElementById('t-equipo');
    if (selectEq) selectEq.style.display = 'block';
  }

  // Disparar sincronización de categoría y selector de kits para Servicio Técnico
  if (typeof window.alCambiarCategoriaTicket === 'function') {
    window.alCambiarCategoriaTicket();
    if (t && t.categoria === 'Servicio Técnico' && t.kitServicioId && typeof window.seleccionarMachoteTicket === 'function') {
      window.seleccionarMachoteTicket(t.kitServicioId);
    } else if (typeof window.seleccionarMachoteTicket === 'function') {
      window.seleccionarMachoteTicket('');
    }
  }

  document.getElementById('modal-ticket-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function abrirTicketPreloaded(datos) {
  if (typeof document === 'undefined') return;
  // 1. Abrir ticket en modo creación
  abrirTicket(null);
  
  // 2. Rellenar los campos con los datos
  if (datos.asunto) {
    document.getElementById('t-asunto').value = datos.asunto;
  }
  if (datos.solicitante) {
    document.getElementById('t-solicitante').value = datos.solicitante;
  }
  if (datos.cliente) {
    selectComboOption('t-cliente', datos.cliente, datos.cliente);
  }
  if (datos.sitio) {
    const escapedSitio = datos.sitio.replace(/'/g, "\\'");
    selectComboOption('t-sitio', escapedSitio, escapedSitio, true);
  }
  if (datos.descripcion) {
    document.getElementById('t-descripcion').value = datos.descripcion;
  }
  if (datos.notas) {
    document.getElementById('t-notas').value = datos.notas;
  }
  if (datos.prioridad) {
    document.getElementById('t-prioridad').value = datos.prioridad;
  }
  if (datos.area) {
    document.getElementById('t-area').value = datos.area;
  }
  if (datos.categoria) {
    document.getElementById('t-categoria').value = datos.categoria;
  }
  
  // 3. Seleccionar equipos (maquinaria) si vienen
  if (datos.equipo) {
    poblarMaquinasCliente('t-equipo', '', datos.cliente);
    datos.equipo.split(', ').forEach(eqName => {
      if (eqName.trim()) {
        window.agregarMaquinaChip(eqName.trim());
      }
    });
  }
  
  // 4. Inicializar refacciones si vienen
  if (datos.refaccionesSeleccionadas && window.inicializarRefaccionesTicket) {
    window.inicializarRefaccionesTicket(null, datos.refaccionesSeleccionadas);
  }
};

function toggleResolucionTicket() {
  if (typeof document === 'undefined') return;
  const estado = document.querySelector('input[name="t-estado"]:checked')?.value;
  const isCotizacion = estado === 'Cotización';
  const isCerrado = estado === 'Cerrado';
  
  const group = document.getElementById('group-t-resolucion');
  const groupCierre = document.getElementById('group-t-cierre');
  const inSap = document.getElementById('t-cotizacion-sap');
  
  if (group) group.style.display = (isCotizacion || isCerrado) ? 'block' : 'none';
  if (inSap) inSap.required = isCotizacion;
  
  if (groupCierre) groupCierre.style.display = isCerrado ? 'block' : 'none';
}

function toggleMotivoRechazo() {
  if (typeof document === 'undefined') return;
  const aceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
  const groupMotivo = document.getElementById('group-t-motivo-rechazo');
  const txtMotivo = document.getElementById('t-motivo-rechazo');
  const groupPedido = document.getElementById('group-t-pedido');
  const inPedidoSap = document.getElementById('t-pedido-sap');
  
  if (groupMotivo) groupMotivo.style.display = (aceptada === 'no') ? 'block' : 'none';
  if (txtMotivo) txtMotivo.required = (aceptada === 'no');
  
  if (groupPedido) groupPedido.style.display = (aceptada === 'si') ? 'block' : 'none';
  if (inPedidoSap) inPedidoSap.required = (aceptada === 'si');

  if (aceptada === 'si' && window.validarPedidoConSAP) {
    window.validarPedidoConSAP(true);
  }
}

function editarTicket(id) { abrirTicket(id); }

function cerrarTicket(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target !== document.getElementById('modal-ticket-overlay')) return;
  document.getElementById('modal-ticket-overlay').classList.remove('open');
  document.getElementById('t-cliente-menu')?.classList.remove('open');
  document.getElementById('t-cliente-combo')?.classList.remove('focus');
  document.body.style.overflow = '';
  editandoTicketId = null;
  window._levantamientoDeOrigen = null;
}

// ===== HELPER MAQUINARIA Y TICKETS =====
function poblarSoportesPorCliente(clienteNombre, selectedSoporte = '') {
  if (typeof document === 'undefined') return;
  const elSoporte = document.getElementById('f-soporte');
  if (!elSoporte) return;
  
  elSoporte.innerHTML = '<option value="">Ninguno</option>';
  
  const usedSoportes = ordenes.filter(x => x.id !== editandoId).map(x => x.soporte).filter(Boolean);
  const usedPedidos = ordenes.filter(x => x.id !== editandoId).map(x => x.pedido).filter(Boolean);
  
  let validTickets = [];
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno') {
    validTickets = tickets.filter(t => t.estado === 'Cerrado' && t.cotAceptada === 'si' && !usedSoportes.includes(t.id) && !usedPedidos.includes(t.pedidoSAP) && t.cliente === clienteNombre);
  }
  
  validTickets.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}`;
    if (t.id === selectedSoporte) opt.selected = true;
    elSoporte.appendChild(opt);
  });
  
  if (selectedSoporte && !Array.from(elSoporte.options).some(o => o.value === selectedSoporte)) {
    const opt = document.createElement('option');
    opt.value = selectedSoporte;
    const t = tickets.find(x => x.id === selectedSoporte);
    opt.textContent = t ? `${t.folio || t.id} - Pedido: ${t.pedidoSAP || 'S/N'}` : selectedSoporte;
    opt.selected = true;
    elSoporte.appendChild(opt);
  }
}

function poblarMaquinasCliente(selectId, selectedValue = '', clienteNombre = null) {
  if (typeof document === 'undefined') return;
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccione una máquina registrada...</option><option value="Otra / No registrada">Otra / Captura manual</option>';
  
  if (clienteNombre && clienteNombre !== 'Ninguno / Uso Interno' && clienteNombre !== 'Ninguno') {
    const c = clientesDb.find(x => x.nombre === clienteNombre);
    if (c && c.maquinas) {
      c.maquinas.forEach(m => {
        const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
        const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
        const cleanId = m.idInterno || m.id || '';
        const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
        const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
        const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
        const opt = document.createElement('option');
        opt.value = mName;
        opt.textContent = mName;
        if (mName === selectedValue) opt.selected = true;
        opt.setAttribute('data-marca', mFullName);
        opt.setAttribute('data-modelo', m.modelo || '');
        opt.setAttribute('data-serie', m.serie || '');
        opt.setAttribute('data-eco', m.no_economico || '');
        opt.setAttribute('data-ubicacion', m.ubicacion || m.sitio || '');
        select.appendChild(opt);
      });
    }
  }
  
  if (selectedValue && !Array.from(select.options).some(o => o.value === selectedValue) && selectedValue !== 'Otra / No registrada') {
    const opt = document.createElement('option');
    opt.value = selectedValue;
    opt.textContent = `${selectedValue} (Registrado previo)`;
    opt.selected = true;
    select.appendChild(opt);
  }
}

function onEquipoOrdenChange() {
  if (typeof document === 'undefined') return;
  const select = document.getElementById('f-equipo');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;
  
  if (opt.value === 'Otra / No registrada') {
      const cliente = document.getElementById('f-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
              if (typeof amCliente.onchange === 'function') {
                  amCliente.onchange({ target: amCliente });
              }
              const orderSitio = document.getElementById('f-ubicacion')?.value || '';
              if (orderSitio) {
                  const amUbicacionSelect = document.getElementById('am-ubicacion-select');
                  const amUbicacionOtra = document.getElementById('am-ubicacion-otra');
                  if (amUbicacionSelect) {
                      let exists = false;
                      for (let i = 0; i < amUbicacionSelect.options.length; i++) {
                          if (amUbicacionSelect.options[i].value === orderSitio) {
                              exists = true;
                              break;
                          }
                      }
                      if (exists) {
                          amUbicacionSelect.value = orderSitio;
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                      } else {
                          amUbicacionSelect.value = 'otra';
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                          if (amUbicacionOtra) {
                              amUbicacionOtra.value = orderSitio;
                          }
                      }
                  }
              }
          }
      }, 100);
      return;
  }
  
  const modelo = opt.getAttribute('data-modelo');
  const serie = opt.getAttribute('data-serie');
  const eco = opt.getAttribute('data-eco');
  const ubicacion = opt.getAttribute('data-ubicacion');
  
  if (modelo) document.getElementById('f-modelo').value = modelo;
  if (serie) document.getElementById('f-serie').value = serie;
  if (eco) document.getElementById('f-eco').value = eco;
  
  const inUbicacion = document.getElementById('f-ubicacion');
  if (inUbicacion && ubicacion && !inUbicacion.value) {
    inUbicacion.value = ubicacion;
  }
}

function onEquipoTicketChange() {
  if (typeof document === 'undefined') return;
  const select = document.getElementById('t-equipo');
  if (!select) return;
  if (select.value === 'Otra / No registrada') {
      const cliente = document.getElementById('t-cliente').value;
      if (!cliente || cliente === 'Ninguno / Uso Interno') {
          mostrarNotificacion('Seleccione primero una empresa para asociar la máquina.', 'warning');
          select.value = '';
          return;
      }
      abrirModalAgregarMaquina();
      setTimeout(() => {
          const amCliente = document.getElementById('am-cliente');
          if (amCliente) {
              amCliente.value = cliente;
              if (typeof amCliente.onchange === 'function') {
                  amCliente.onchange({ target: amCliente });
              }
              const ticketSitio = document.getElementById('t-sitio')?.value || '';
              if (ticketSitio) {
                  const amUbicacionSelect = document.getElementById('am-ubicacion-select');
                  const amUbicacionOtra = document.getElementById('am-ubicacion-otra');
                  if (amUbicacionSelect) {
                      let exists = false;
                      for (let i = 0; i < amUbicacionSelect.options.length; i++) {
                          if (amUbicacionSelect.options[i].value === ticketSitio) {
                              exists = true;
                              break;
                          }
                      }
                      if (exists) {
                          amUbicacionSelect.value = ticketSitio;
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                      } else {
                          amUbicacionSelect.value = 'otra';
                          amUbicacionSelect.dispatchEvent(new Event('change'));
                          if (amUbicacionOtra) {
                              amUbicacionOtra.value = ticketSitio;
                          }
                      }
                  }
              }
          }
      }, 100);
  }
}



function onEquipoTicketChangeMultiple() {
  if (typeof document === 'undefined') return;
  const select = document.getElementById('t-equipo');
  if (!select) return;
  const val = select.value;
  if (!val) return;
  
  if (val === 'Otra / No registrada') {
    onEquipoTicketChange(); // Abre modal de registro manual
    return;
  }
  
  window.agregarMaquinaChip(val);
  select.value = ''; // Reset select to let them select more
};

function actualizarCamposMaquinaOrden() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('f-equipos-seleccionados');
  if (!container) return;
  const chips = Array.from(container.querySelectorAll('.maquina-chip')).map(c => c.getAttribute('data-value'));
  
  if (chips.length === 0) {
    document.getElementById('f-modelo').value = '';
    document.getElementById('f-serie').value = '';
    document.getElementById('f-eco').value = '';
    return;
  }
  
  const modelos = [];
  const series = [];
  const ecos = [];
  
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
  const matchMaquina = (m, name) => {
    const cleanId = m.idInterno || m.id || '';
    const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
    const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
    const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
    const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
    return name === mName || name === cleanId || name === m.serie;
  };
  
  chips.forEach(cName => {
    let maq = null;
    clientesDb.forEach(c => {
      if (c.maquinas) {
        const found = c.maquinas.find(m => matchMaquina(m, cName));
        if (found) maq = found;
      }
    });
    if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, cName));
    
    if (maq) {
      if (maq.modelo) modelos.push(maq.modelo);
      if (maq.serie) series.push(maq.serie);
      if (maq.no_economico) ecos.push(maq.no_economico);
    } else {
      if (cName.includes('(SN: ')) {
        const parts = cName.split('(SN: ');
        const s = parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          left = left.substring(left.indexOf(']') + 1).trim();
        }
        modelos.push(left);
        series.push(s);
      } else {
        modelos.push(cName);
      }
    }
  });
  
  document.getElementById('f-modelo').value = [...new Set(modelos)].join(', ');
  document.getElementById('f-serie').value = [...new Set(series)].join(', ');
  document.getElementById('f-eco').value = [...new Set(ecos)].join(', ');
};

function agregarMaquinaChip(maquinaName) {
  if (typeof document === 'undefined') return;
  if (!maquinaName) return;
  const container = document.getElementById('t-equipos-seleccionados');
  if (!container) return;
  
  const existing = Array.from(container.querySelectorAll('.maquina-chip')).some(c => c.getAttribute('data-value') === maquinaName);
  if (existing) return;
  
  const currentTicket = (typeof editandoTicketId !== 'undefined' && editandoTicketId && typeof tickets !== 'undefined') ? tickets.find(x => x.id === editandoTicketId) : null;
  const isRefTicket = currentTicket && currentTicket.folio && currentTicket.folio.endsWith('-A');

  const chip = document.createElement('div');
  chip.className = 'maquina-chip';
  chip.setAttribute('data-value', maquinaName);
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    background: var(--bg-hover, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary, #1f2937);
    gap: 0.25rem;
    box-shadow: var(--shadow-sm);
  `;
  
  const deleteBtn = isRefTicket ? '' : `<span onclick="this.parentElement.remove(); if (typeof window.alCambiarCategoriaTicket === 'function' && document.getElementById('t-categoria')?.value === 'Servicio Técnico') window.alCambiarCategoriaTicket();" style="cursor:pointer; font-weight:bold; color:var(--red, #ef4444); margin-left:4px; font-size:1.1rem; line-height:1;">&times;</span>`;

  chip.innerHTML = `
    <span>${maquinaName}</span>
    ${deleteBtn}
  `;
  container.appendChild(chip);
  if (typeof window.alCambiarCategoriaTicket === 'function' && document.getElementById('t-categoria')?.value === 'Servicio Técnico') {
    window.alCambiarCategoriaTicket();
  }
}

function agregarMaquinaChipOrden(maquinaName) {
  if (typeof document === 'undefined') return;
  if (!maquinaName) return;
  const container = document.getElementById('f-equipos-seleccionados');
  if (!container) return;
  
  const existing = Array.from(container.querySelectorAll('.maquina-chip')).some(c => c.getAttribute('data-value') === maquinaName);
  if (existing) return;
  
  const chip = document.createElement('div');
  chip.className = 'maquina-chip';
  chip.setAttribute('data-value', maquinaName);
  chip.style.cssText = `
    display: inline-flex;
    align-items: center;
    background: var(--bg-hover, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary, #1f2937);
    gap: 0.25rem;
    box-shadow: var(--shadow-sm);
  `;
  chip.innerHTML = `
    <span>${maquinaName}</span>
    <span onclick="this.parentElement.remove(); window.actualizarCamposMaquinaOrden();" style="cursor:pointer; font-weight:bold; color:var(--red, #ef4444); margin-left:4px; font-size:1.1rem; line-height:1;">&times;</span>
  `;
  container.appendChild(chip);
  window.actualizarCamposMaquinaOrden();
};

function onEquipoOrdenChangeMultiple() {
  if (typeof document === 'undefined') return;
  const select = document.getElementById('f-equipo');
  if (!select) return;
  const val = select.value;
  if (!val) return;
  
  if (val === 'Otra / No registrada') {
    onEquipoOrdenChange();
    return;
  }
  
  window.agregarMaquinaChipOrden(val);
  select.value = '';
};

// ===== CUSTOM COMBOBOX LOGIC =====
function toggleCombo(id) {
  if (typeof document === 'undefined') return;
  if (id === 'f-cliente') {
    const isAdmin = ['superadmin', 'admin'].includes(currentSession.viewMode);
    const soporteId = document.getElementById('f-soporte')?.value;
    let isCerrado = false;
    if (soporteId) {
      const t = tickets.find(x => x.id === soporteId);
      if (t && t.estado === 'Cerrado') isCerrado = true;
    }

    if (!isAdmin) {
      mostrarNotificacion('Solo administradores pueden editar la empresa de la orden.', 'warning');
      return;
    }
    if (isCerrado && currentSession.viewMode !== 'superadmin') {
      mostrarNotificacion('No se puede modificar la empresa porque el ticket asociado ya está cerrado.', 'warning');
      return;
    }
  }

  const menu = document.getElementById(id + '-menu');
  const combo = document.getElementById(id + '-combo');
  const search = document.getElementById(id + '-search');
  
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    combo.classList.remove('focus');
  } else {
    // Cerrar otros menús si hubiera
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
    
    menu.classList.add('open');
    combo.classList.add('focus');
    search.value = '';
    filterCombo(id, ''); // Mostrar todo
    search.focus();
  }
}

function filterCombo(id, query) {
  if (typeof document === 'undefined') return;
  const q = query.toLowerCase().trim();
  const options = document.querySelectorAll(`#${id}-options .combo-option`);
  let foundMatch = false;
  
  options.forEach(opt => {
    const text = opt.textContent.toLowerCase();
    const code = (opt.dataset.code || '').toLowerCase();
    const desc = (opt.dataset.desc || '').toLowerCase();
    const clave = (opt.dataset.clave || '').toLowerCase();
    if (!q || text.includes(q) || code.includes(q) || desc.includes(q) || clave.includes(q)) {
      opt.style.display = 'block';
      foundMatch = true;
    } else {
      opt.style.display = 'none';
    }
  });

  const addTextSpan = document.getElementById(id + '-add-text');
  if (addTextSpan) {
    const isSitio = id.includes('sitio');
    const entityName = isSitio ? 'sitio' : 'empresa';
    
    if (q && !foundMatch) {
      addTextSpan.textContent = `Crear ${entityName}: "${query}"`;
    } else {
      addTextSpan.textContent = `Crear nuev${isSitio ? 'o' : 'a'} ${entityName}`;
    }
  }
}
window.filterCombo = filterCombo;
window.toggleCombo = toggleCombo;

function selectComboOption(id, value, label, isInitial = false) {
  if (typeof document === 'undefined') return;
  document.getElementById(id).value = value;
  const displayEl = document.getElementById(id + '-display');
  if (displayEl) displayEl.textContent = label;
  document.getElementById(id + '-menu').classList.remove('open');
  document.getElementById(id + '-combo').classList.remove('focus');

  if (id === 't-cliente') {
    const sitGroup = document.getElementById('group-t-sitio');
    const sitInput = document.getElementById('t-sitio');
    const sitDisplay = document.getElementById('t-sitio-display');
    const sitOptions = document.getElementById('t-sitio-options');
    
    if (!isInitial) {
      poblarMaquinasCliente('t-equipo', '', value);
      const selectedEquiposContainer = document.getElementById('t-equipos-seleccionados');
      if (selectedEquiposContainer) selectedEquiposContainer.innerHTML = '';
    }
    
    if (value && value !== 'Ninguno' && value !== 'Ninguno / Uso Interno') {
      if (sitGroup) sitGroup.style.display = 'block';
      if (sitInput && !isInitial) sitInput.value = '';
      if (sitDisplay && !isInitial) sitDisplay.textContent = 'Ninguno';
      
      if (sitOptions) {
        sitOptions.innerHTML = '<div class="combo-option" onclick="selectComboOption(\'t-sitio\', \'\', \'Ninguno\')">Ninguno</div>';
        const c = (clientesDb || []).find(x => x.nombre === value || x.id === value || x.idInterno === value || x.rfc === value);
        const sitios = getNombresDeSitiosParaCliente(c || value);
        sitios.forEach(sn => {
          const escapedSn = sn.replace(/'/g, "\\'").replace(/"/g, '&quot;');
          sitOptions.innerHTML += `<div class="combo-option" onclick="selectComboOption('t-sitio', '${escapedSn}', '${escapedSn}')">${sn}</div>`;
        });
      }
    } else {
      if (sitGroup) sitGroup.style.display = 'none';
      if (sitInput) sitInput.value = '';
      if (sitDisplay) sitDisplay.textContent = 'Ninguno';
    }
  } else if (id === 'f-cliente') {
    if (!isInitial) {
      poblarMaquinasCliente('f-equipo', '', value);
      poblarSoportesPorCliente(value, '');
      const ordSelectedEquiposContainer = document.getElementById('f-equipos-seleccionados');
      if (ordSelectedEquiposContainer) ordSelectedEquiposContainer.innerHTML = '';
    }
  } else if (id === 'pt-orden') {
    for (let i = 0; i <= 6; i++) {
      const sel = document.getElementById(`pt-orden-dia-${i}`);
      if (sel) {
        selectComboOption(`pt-orden-dia-${i}`, value, label, true);
      }
    }
  }
}
window.selectComboOption = selectComboOption;

function agregarSitioCombo(id) {
  if (typeof document === 'undefined') return;
  const cName = document.getElementById('t-cliente')?.value;
  if (!cName || cName === 'Ninguno' || cName === 'Ninguno / Uso Interno') {
    mostrarNotificacion('Primero selecciona una Empresa (Cliente).', 'warning');
    return;
  }
  const q = document.getElementById('t-sitio-search')?.value.trim() || '';
  agregarSitioCliente(cName);
  if (q) {
    document.getElementById('s-sitio-nombre').value = q;
  }
  document.getElementById('t-sitio-menu').classList.remove('open');
  document.getElementById('t-sitio-combo').classList.remove('focus');
  window._addingSiteFromTicket = true;
}

function agregarEmpresaCombo(id) {
  if (typeof document === 'undefined') return;
  const searchVal = document.getElementById(id + '-search').value.trim();
  const nombreEmpresa = searchVal || prompt('Ingresa el nombre de la nueva empresa:');
  
  if (!nombreEmpresa) return;

  // Registrar localmente como cliente legacy para que aparezca
  // Si desean crearle toda la metadata, deberán ir a Clientes > Nuevo Cliente
  // Aquí la damos de alta de forma rápida
  
  let clienteObj = clientesDb.find(c => c.nombre.toLowerCase() === nombreEmpresa.toLowerCase());
  if (!clienteObj) {
    clienteObj = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      nombre: nombreEmpresa,
      maquinas: []
    };
    clientesDb.push(clienteObj);
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }

  // Refrescar el combo y seleccionar
  abrirTicket(editandoTicketId); // Esto recargará las opciones con el valor previo mantenido
  selectComboOption(id, nombreEmpresa, nombreEmpresa);
}

// Cerrar combobox si hacen click fuera
if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e) {
  if (!e.target.closest('.form-group')) {
    document.querySelectorAll('.combo-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.combo-box').forEach(c => c.classList.remove('focus'));
  }
});
}

function readFileAsBase64(file) {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve('');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function guardarTicket(e) {
  if (typeof document === 'undefined') return;
  e.preventDefault();
  const t_existente = editandoTicketId ? tickets.find(x=>x.id===editandoTicketId) : null;
  const isEmpresa = currentSession.viewMode === 'empresa';
  const estado = (isEmpresa || !editandoTicketId) ? 'Abierto' : (document.querySelector('input[name="t-estado"]:checked')?.value || 'Abierto');
  // Preservar canal y contacto de portal si se edita desde el panel administrativo
  let canal = isEmpresa ? 'portal' : (document.querySelector('input[name="t-canal"]:checked')?.value || '');
  if (!isEmpresa && editandoTicketId && !canal && t_existente?.canal === 'portal') {
    canal = 'portal';
  }

  let contacto = '';
  if (!isEmpresa) {
    if (canal === 'correo') contacto = document.getElementById('t-correo')?.value?.trim();
    else if (canal === 'whatsapp') contacto = document.getElementById('t-whatsapp')?.value?.trim();
    else if (canal === 'telefono') contacto = document.getElementById('t-telefono')?.value?.trim();
    else if (canal === 'portal' && editandoTicketId && t_existente?.contacto) {
      contacto = t_existente.contacto;
    }
  } else {
    // Si es empresa, el contacto es su propio correo si existe
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    contacto = currentUser ? currentUser.email : '';
  }
  
  if (!isEmpresa) {
    const asignadoVal = document.getElementById('t-asignado').value.trim();
    if (!asignadoVal) {
      mostrarNotificacion('Debe seleccionar a quién va asignado el ticket.', 'error');
      return;
    }
    const clienteVal = document.getElementById('t-cliente').value.trim();
    if (!clienteVal) {
      mostrarNotificacion('Debe seleccionar la Empresa / Cliente afectada.', 'error');
      return;
    }
  }
  
  const categoriaVal = document.getElementById('t-categoria')?.value || '';
  const isGarantiaInterna = (categoriaVal === 'Garantía Interna' || t_existente?.categoria === 'Garantía Interna');
  
  if (!isEmpresa && (estado === 'Cotización' || estado === 'Cerrado') && !isGarantiaInterna) {
    // Si la lista de cotizaciones está vacía, intentar vincular los valores actuales de los inputs
    if (!window.editandoCotizaciones || window.editandoCotizaciones.length === 0) {
      const sapInputVal = document.getElementById('t-cotizacion-sap')?.value.trim();
      const montoInputVal = document.getElementById('t-cotizacion-monto')?.value.trim();
      if (sapInputVal || montoInputVal) {
        await window.vincularNuevaCotizacion(true);
      }
    }

    const bypassQuote = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
    if (!bypassQuote && (!window.editandoCotizaciones || window.editandoCotizaciones.length === 0)) {
      mostrarNotificacion('Debe vincular al menos una cotización de SAP para este ticket.', 'error');
      return;
    }
  }

  if (!isEmpresa && estado === 'Cerrado' && !isGarantiaInterna) {
    const cotAceptada = document.querySelector('input[name="t-cot-aceptada"]:checked')?.value;
    const motivoRechazo = document.getElementById('t-motivo-rechazo')?.value.trim() || '';
    const pedidoSAP = document.getElementById('t-pedido-sap')?.value.trim() || '';
    const pedidoPdfUpload = document.getElementById('t-pedido-pdf')?.files.length > 0;
    
    if (!cotAceptada) {
      mostrarNotificacion('Debe indicar si la cotización fue aceptada o rechazada para cerrar el ticket.', 'error');
      return;
    }
    
    if (cotAceptada === 'no' && !motivoRechazo) {
      mostrarNotificacion('Debe especificar el motivo del rechazo.', 'error');
      return;
    }
    
    if (cotAceptada === 'si') {
      const bypass = window.isTemporaryNoQuotePeriodActive && window.isTemporaryNoQuotePeriodActive();
      if (!bypass) {
        if (!pedidoSAP) {
          mostrarNotificacion('Debe ingresar el Número de Pedido SAP para cerrar una cotización aceptada.', 'error');
          return;
        }
        if (!pedidoPdfUpload && !t_existente?.pdfPedido) {
          mostrarNotificacion('Debe adjuntar el archivo PDF del pedido para cerrar la cotización aceptada.', 'error');
          return;
        }
        if (window._isPedidoSapBlocked) {
          mostrarNotificacion('No se puede guardar el ticket debido a una discrepancia crítica entre el PDF y SAP.', 'error');
          return;
        }
      }
    }
  }

  let pdfPedidoBase64 = t_existente ? t_existente.pdfPedido : null;
  const pedidoPdfInput = document.getElementById('t-pedido-pdf');
  if (pedidoPdfInput && pedidoPdfInput.files.length > 0) {
    try { pdfPedidoBase64 = await readFileAsBase64(pedidoPdfInput.files[0]); } catch(e){}
  }

  let pdfCotizacionBase64 = t_existente ? t_existente.pdfCotizacion : null;
  const cotPdfInput = document.getElementById('t-cotizacion-pdf');
  if (cotPdfInput && cotPdfInput.files.length > 0) {
    try { pdfCotizacionBase64 = await readFileAsBase64(cotPdfInput.files[0]); } catch(e){}
  }

  let newFolio = '';
  if (!editandoTicketId) {
    const isTest = isTestModeActive();
    if (typeof window.obtenerSiguienteFolioTicket === 'function') {
      newFolio = await window.obtenerSiguienteFolioTicket(isTest);
    } else {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const prefix = isTest ? `TKT-PRUEBA-` : `TKT-${yearStr}`;
      const ticketsDelAnio = tickets.filter(t => t && t.folio && t.folio.startsWith(prefix));
      let maxConsecutivo = 0;
      ticketsDelAnio.forEach(t => {
        const numStr = t.folio.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxConsecutivo) maxConsecutivo = num;
      });
      newFolio = `${prefix}${(maxConsecutivo + 1).toString().padStart(3, '0')}`;
    }
  }

  let asuntoVal = document.getElementById('t-asunto').value.trim();
  if (!editandoTicketId && isTestModeActive()) {
    if (asuntoVal && !asuntoVal.startsWith('[PRUEBA]')) {
      asuntoVal = `[PRUEBA] ${asuntoVal}`;
    }
  }

  let equipoVal = '';
  const chips = Array.from(document.querySelectorAll('#t-equipos-seleccionados .maquina-chip')).map(c => c.getAttribute('data-value'));
  if (chips.length > 0) {
    equipoVal = chips.join(', ');
  } else {
    equipoVal = document.getElementById('t-equipo')?.value?.trim() || '';
  }
  
  if (!equipoVal) {
    mostrarNotificacion('Debe seleccionar al menos una máquina afectada.', 'error');
    return;
  }

  let enviosVal = [];
  let paqueteriaVal = '';
  let guiaVal = '';
  let fPedidoVal = '';
  let fEntregaVal = '';

  let destinoPdfUrl = t_existente ? t_existente.destinoPdfUrl : '';
  const isRefTicket = t_existente && t_existente.folio && t_existente.folio.endsWith('-A');
  if (isRefTicket || (document.getElementById('ref-ticket-shipping-fields') && document.getElementById('ref-ticket-shipping-fields').style.display !== 'none')) {
    enviosVal = window.obtenerEnviosDesdeDOM();
    for (let i = 0; i < enviosVal.length; i++) {
      if (enviosVal[i].llego && !enviosVal[i].fechaLlegada) {
        mostrarNotificacion(`Debe seleccionar la fecha en la que fue entregada la Guía/Envío #${i + 1}`, 'error');
        return;
      }
    }
    const destContainer = document.getElementById('ref-ticket-destination-fields');
    const selectDest = document.getElementById('ref-destino-piezas');
    if (destContainer && destContainer.style.display !== 'none') {
      if (selectDest && !selectDest.value) {
        mostrarNotificacion('Debe seleccionar si las piezas entregadas serán instaladas o enviadas al cliente.', 'error');
        return;
      }
    }
    const first = enviosVal[0] || {};
    paqueteriaVal = first.paqueteria || '';
    guiaVal = first.guiaPedido || '';
    fPedidoVal = first.fechaPedido || '';
    fEntregaVal = first.fechaEntrega || '';

    const destinoPdfInput = document.getElementById('ref-destino-pdf-file');
    if (destinoPdfInput && destinoPdfInput.files.length > 0) {
      try {
        const file = destinoPdfInput.files[0];
        const base64 = await readFileAsBase64(file);
        mostrarNotificacion('Subiendo PDF de destino...', 'info');
        const filename = `destino_${editandoTicketId || crypto.randomUUID()}_${Date.now()}.pdf`;
        const fullPath = `tickets/destino_pdf/${filename}`;
        const publicUrl = await window.uploadBase64ToStorage(base64, 'evidencias', fullPath);
        if (publicUrl) {
          destinoPdfUrl = publicUrl;
        } else {
          throw new Error('No se pudo subir el archivo PDF.');
        }
      } catch (e) {
        console.error('[Destino PDF Upload] Error:', e);
        mostrarNotificacion('Falla al subir PDF de destino: ' + e.message, 'error');
        return;
      }
    }
  }

  const destinoPrecioVal = document.getElementById('ref-destino-precio')?.value || '';

  const catSeleccionada = document.getElementById('t-categoria')?.value || '';
  const kitIdSeleccionado = (catSeleccionada === 'Servicio Técnico') 
    ? (document.getElementById('t-kit-servicio-select')?.value || '') 
    : '';
  const kitObj = window._ticketKitSeleccionado || (kitIdSeleccionado ? (window.loadKitsServicio() || []).find(k => k.id === kitIdSeleccionado) : null);
  const kitNombreSeleccionado = (kitObj && kitIdSeleccionado) 
    ? kitObj.nombre 
    : (t_existente ? (t_existente.kitServicioNombre || '') : '');

  let refaccionesFinales = t_existente ? (t_existente.refaccionesSeleccionadas || []) : [];
  if (kitObj && kitIdSeleccionado && refaccionesFinales.length === 0) {
    refaccionesFinales = (kitObj.piezas || []).map(p => ({
      clave: p.codigo || p.clave || 'S/C',
      codigo: p.codigo || p.clave || 'S/C',
      nombre: p.descripcion || p.nombre || 'Sin Descripción',
      descripcion: p.descripcion || p.nombre || 'Sin Descripción',
      marca: p.marca || kitObj.marca || '',
      cantidad: parseInt(p.cantidad, 10) || 1,
      estatusPedido: 'Por Pedir'
    }));
  }

  const ticket = {
    id: editandoTicketId || crypto.randomUUID(),
    folio: editandoTicketId ? t_existente?.folio : newFolio,
    fecha: t_existente ? t_existente.fecha : new Date().toISOString(),
    fechaCreacion: t_existente ? t_existente.fechaCreacion : new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    modificadoPor: window.getCurrentUserDisplayName ? window.getCurrentUserDisplayName() : (usuarios.find(u => u.id === currentSession.userId)?.nombre || 'Usuario'),
    fechaCierre: estado === 'Cerrado' ? (t_existente?.fechaCierre || new Date().toISOString()) : null,
    canal,
    contacto,
    asunto: asuntoVal,
    cliente: document.getElementById('t-cliente')?.value || '',
    sitio: document.getElementById('t-sitio')?.value || '',
    solicitante: document.getElementById('t-solicitante').value.trim(),
    creadoPor: t_existente ? (t_existente.creadoPor || t_existente.solicitante) : (usuarios.find(u => u.id === currentSession.userId)?.nombre || ''),
    area: document.getElementById('t-area').value,
    categoria: catSeleccionada,
    prioridad: document.getElementById('t-prioridad').value,
    asignado: document.getElementById('t-asignado').value.trim(),
    descripcion: document.getElementById('t-descripcion').value.trim(),
    equipo: equipoVal,
    horometro: document.getElementById('t-horometro')?.value.trim() || '',
    notas: document.getElementById('t-notas').value.trim(),
    kitServicioId: kitIdSeleccionado || (t_existente ? (t_existente.kitServicioId || '') : ''),
    kitServicioNombre: kitNombreSeleccionado || (t_existente ? (t_existente.kitServicioNombre || '') : ''),
    estado,
    cotizacionSAP: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones[0].sap : '',
    montoCotizacion: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones.reduce((sum, c) => sum + (Number(c.monto) || 0), 0) : null,
    cotAceptada: document.querySelector('input[name="t-cot-aceptada"]:checked')?.value || '',
    motivoRechazo: document.getElementById('t-motivo-rechazo')?.value.trim() || '',
    pedidoSAP: document.getElementById('t-pedido-sap')?.value.trim() || '',
    tecnicosAsignados: [],
    pdfPedido: pdfPedidoBase64,
    pdfCotizacion: (window.editandoCotizaciones && window.editandoCotizaciones.length > 0) ? window.editandoCotizaciones[0].pdf : null,
    cotizacionesAdicionales: window.editandoCotizaciones || [],
    comentariosInternos: t_existente ? (t_existente.comentariosInternos || []) : [],
    esPrueba: t_existente ? (t_existente.esPrueba || false) : isTestModeActive(),
    refaccionesSeleccionadas: refaccionesFinales,
    guiaPedido: guiaVal || (t_existente ? (t_existente.guiaPedido || '') : ''),
    paqueteria: paqueteriaVal || (t_existente ? (t_existente.paqueteria || '') : ''),
    fechaPedido: fPedidoVal || (t_existente ? (t_existente.fechaPedido || '') : ''),
    fechaEntrega: fEntregaVal || (t_existente ? (t_existente.fechaEntrega || '') : ''),
    envios: (enviosVal && enviosVal.length > 0) ? enviosVal : (t_existente ? (t_existente.envios || []) : []),
    destinoPiezas: document.getElementById('ref-destino-piezas')?.value || '',
    destinoPrecio: destinoPrecioVal,
    destinoPdfUrl: destinoPdfUrl
  };

  // Actualizar ubicación de la máquina si es N/A o vacía
  if (ticket.equipo && ticket.equipo !== 'Otra / No registrada' && ticket.sitio && ticket.sitio !== 'Ninguno') {
    const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
    
    const matchMaquina = (m) => {
      const cleanId = m.idInterno || m.id || '';
      if (!cleanId) return false;
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
      const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      
      const equipoString = ticket.equipo || '';
      const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
      
      return names.some(name => {
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(`[${cleanId}]`) ||
          (m.serie && name.includes(`(SN: ${m.serie})`))
        );
      });
    };

    let maqModificada = false;

    // Buscar en clientesDb
    clientesDb.forEach(c => {
      if (c.maquinas) {
        c.maquinas.forEach(m => {
          if (matchMaquina(m)) {
            const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
            if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
              console.log(`[Ticket] Asignando ubicación '${ticket.sitio}' a máquina manual ${m.idInterno} según ticket`);
              m.ubicacion = ticket.sitio;
              
              // Resolver sitio_id
              let sitioId = m.sitio_id || null;
              const existSitio = sitiosDb.find(s => (s.cliente === c.id || s.cliente === c.nombre) && s.nombre === ticket.sitio);
              if (existSitio) sitioId = existSitio.id;
              m.sitio_id = sitioId;
              
              maqModificada = true;
              if (window.pushToSupabase) {
                window.pushToSupabase('maquinaria', { ...m, cliente: c.id });
              }
            }
          }
        });
      }
    });

    // Buscar en maquinariaDb
    maquinariaDb.forEach(m => {
      if (matchMaquina(m)) {
        const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
        if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
          console.log(`[Ticket] Asignando ubicación '${ticket.sitio}' a máquina SAP ${m.idInterno || m.id} según ticket`);
          m.ubicacion = ticket.sitio;
          
          // Resolver sitio_id
          let clientObj = clientesDb.find(c => c.nombre === m.cliente || c.id === m.cliente);
          let clientDbId = clientObj ? clientObj.id : m.cliente;
          let sitioId = m.sitio_id || null;
          const existSitio = sitiosDb.find(s => (s.cliente === clientDbId || s.cliente === m.cliente) && s.nombre === ticket.sitio);
          if (existSitio) sitioId = existSitio.id;
          m.sitio_id = sitioId;
          
          if (!m.customData) m.customData = {};
          m.customData.ubicacion = ticket.sitio;
          
          maqModificada = true;
          if (window.pushToSupabase) {
            window.pushToSupabase('maquinaria', m);
          }
        }
      }
    });

    if (maqModificada) {
      localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
      localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
    }
  }
  
  if (isEmpresa && !editandoTicketId && !ticket.asignado) {
    const c = clientesDb.find(x => x.nombre === ticket.cliente);
    if (c) {
      if (c.supervisoresAsignados && c.supervisoresAsignados.length > 0) {
        ticket.asignado = c.supervisoresAsignados.map(id => usuarios.find(u => u.id === id)?.nombre).filter(Boolean).join(', ');
      } else if (c.supervisorAsignado) {
        const supUser = usuarios.find(u => u.id === c.supervisorAsignado);
        if (supUser) ticket.asignado = supUser.nombre;
      }
    }
  }

  // Detectar cambio de responsable para notificaciones internas
  const oldAsignado = t_existente ? (t_existente.asignado || 'Sin asignar') : 'Sin asignar';
  const newAsignado = ticket.asignado || 'Sin asignar';
  if (String(oldAsignado).trim().toLowerCase() !== String(newAsignado).trim().toLowerCase()) {
    if (typeof window.generarNotificacionInterna === 'function') {
      window.generarNotificacionInterna(ticket, oldAsignado, newAsignado);
    }
  }

  if (editandoTicketId) {
    tickets = tickets.map(t => t.id === editandoTicketId ? ticket : t);
    if (typeof window !== 'undefined' && Array.isArray(window.tickets)) window.tickets = window.tickets.map(t => t.id === editandoTicketId ? ticket : t);
  } else {
    tickets.unshift(ticket);
    if (typeof window !== 'undefined' && Array.isArray(window.tickets)) window.tickets.unshift(ticket);
  }
  
  // Guardar SIEMPRE en local como respaldo (con try-catch para evitar que un PDF gigante rompa la subida a la nube)
  try {
    safeSetJSON('sapi_tickets', tickets);
  } catch (err) {
    console.error('Error al guardar en localStorage (¿exceso de cuota por PDF?):', err);
    mostrarNotificacion('El archivo adjunto es muy pesado para la memoria local, pero intentaremos subirlo a la nube.', 'error');
  }
  
  if (window.supabaseClient) {
    await window.pushToSupabase('tickets', ticket);
  }

  // Sincronizar automáticamente con la Orden de Servicio vinculada si existe
  try {
    const assocOrd = (typeof window.obtenerOrdenAsociadaTicket === 'function')
      ? window.obtenerOrdenAsociadaTicket(ticket)
      : (typeof ordenes !== 'undefined' && Array.isArray(ordenes) ? ordenes.find(o => o && (o.soporte === ticket.id || o.soporte === ticket.folio || o.id === ticket.ordenId || o.folio === ticket.ordenFolio)) : null);

    if (assocOrd) {
      let ordMod = false;
      const resolvedCli = typeof window.resolverClienteTicket === 'function' ? window.resolverClienteTicket(ticket) : '';
      const cliTarget = resolvedCli || ticket.cliente;
      if (cliTarget && assocOrd.cliente !== cliTarget) {
        assocOrd.cliente = cliTarget;
        ordMod = true;
      }
      if (ticket.sitio && assocOrd.ubicacion !== ticket.sitio) {
        assocOrd.ubicacion = ticket.sitio;
        ordMod = true;
      }
      if (ticket.asignado && ticket.asignado !== 'Sin asignar' && ticket.asignado !== '-') {
        if (assocOrd.tecnico !== ticket.asignado) {
          assocOrd.tecnico = ticket.asignado;
          assocOrd.tecnicosAsignados = ticket.asignado.split(',').map(s => s.trim()).filter(Boolean);
          ordMod = true;
        }
      }
      if (ticket.categoria) {
        const tipoTarget = ticket.categoria === 'Servicio Técnico' ? 'Servicio' : ticket.categoria;
        if (assocOrd.tipo !== tipoTarget) {
          assocOrd.tipo = tipoTarget;
          ordMod = true;
        }
      }
      if (ticket.equipo && assocOrd.equipo !== ticket.equipo) {
        assocOrd.equipo = ticket.equipo;
        ordMod = true;
      }
      if (!assocOrd.soporte) {
        assocOrd.soporte = ticket.id || ticket.folio;
        ordMod = true;
      }
      if (ordMod) {
        assocOrd._synced = false;
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          await window.pushToSupabase('ordenes', assocOrd);
        }
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    }
  } catch (errSyncOrd) {
    console.warn('[Ticket] Error al sincronizar orden vinculada:', errSyncOrd);
  }

  // Generar Orden de Servicio automáticamente solo si es de Servicio en campo (NO para Garantías ni Refacciones)
  if (estado === 'Cerrado' && ticket.cotAceptada === 'si') {
    if (window.esTicketDeServicioEnCampo(ticket)) {
      const ordenExistente = ordenes.find(o => o.soporte === ticket.id);
      if (!ordenExistente) {
        let modeloStr = '';
        let serieStr = '';
        let marcaStr = '';
        let ecoStr = '';
        let maquinariaId = null;

        if (ticket.equipo) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          
          const matchMaquina = (m, name) => {
            const cleanId = m.idInterno || m.id || '';
            const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
            const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
            const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
            const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
            
            return (
              name === mName ||
              name === cleanId ||
              name === m.serie ||
              name.includes(cleanId) ||
              (m.serie && name.includes(m.serie))
            );
          };

          const eqNames = ticket.equipo.split(', ');
          const modelosArr = [];
          const seriesArr = [];
          const marcasArr = [];
          const ecosArr = [];

          eqNames.forEach(eqName => {
            let maq = null;
            clientesDb.forEach(c => {
              if (c.maquinas) {
                const found = c.maquinas.find(m => matchMaquina(m, eqName));
                if (found) maq = found;
              }
            });
            if (!maq) maq = maquinariaDb.find(m => matchMaquina(m, eqName));

            if (maq) {
              if (maq.modelo) modelosArr.push(maq.modelo);
              if (maq.serie) seriesArr.push(maq.serie);
              if (maq.marca) marcasArr.push(maq.marca);
              if (maq.no_economico) ecosArr.push(maq.no_economico);
              if (!maquinariaId) maquinariaId = maq.id || maq.idInterno || null;
            } else {
              if (eqName.includes('(SN: ')) {
                const parts = eqName.split('(SN: ');
                const s = parts[1].replace(')', '').trim();
                let left = parts[0].trim();
                if (left.startsWith('[') && left.includes(']')) {
                  left = left.substring(left.indexOf(']') + 1).trim();
                }
                modelosArr.push(left);
                seriesArr.push(s);
              } else {
                modelosArr.push(eqName);
              }
            }
          });

          modeloStr = [...new Set(modelosArr)].join(', ');
          serieStr = [...new Set(seriesArr)].join(', ');
          marcaStr = [...new Set(marcasArr)].join(', ');
          ecoStr = [...new Set(ecosArr)].join(', ');
        }

        let newFolio = generarFolioConsecutivo();
        const isTest = isTestData(ticket) || isTestModeActive();
        if (isTest && newFolio && !newFolio.startsWith('[PRUEBA]')) {
          newFolio = `[PRUEBA] ${newFolio}`;
        }

        let orderTecnicos = [...(ticket.tecnicosAsignados || [])];
        if (orderTecnicos.length === 0 && ticket.asignado) {
          orderTecnicos = ticket.asignado.split(',').map(s => s.trim()).filter(Boolean);
        }

        const nuevaOrden = {
          id: newFolio,
          fecha: getLocalDateString(),
          folio: newFolio,
          pedido: ticket.pedidoSAP || '',
          cliente: ticket.cliente || '',
          ubicacion: ticket.sitio || '',
          ubicacion_sitio: '',
          operador: '',
          eco: ecoStr || '',
          horometro: '',
          modelo: modeloStr,
          serie: serieStr,
          marca: marcaStr || '',
          maquinaria_id: maquinariaId || null,
          equipo: ticket.equipo || '',
          tecnico: orderTecnicos.join(', '),
          tecnicosAsignados: orderTecnicos,
          soporte: ticket.id,
          km_ida: '', km_vuelta: '', km_total: '',
          tipo: 'Servicio',
          estado: 'Pendiente',
          falla: (ticket.asunto ? ticket.asunto + '\n' : '') + (ticket.descripcion || ''),
          trabajos: '', dictamen: '', condiciones: '',
          observaciones: '', pendientes: '',
          ref_utilizadas: [], ref_necesarias: [],
          factura_ref: '', factura_mo: '',
          noches: '', alimentacion: '', traslado_costo: '',
          dias: [],
          esPrueba: isTest,
        };

        ordenes.unshift(nuevaOrden);
        safeSetJSON('sapi_ordenes', ordenes);
        if (window.supabaseClient) {
          await window.pushToSupabase('ordenes', nuevaOrden);
        }
        mostrarNotificacion('Orden de servicio pre-cargada y generada.', 'success');
        if (typeof renderTabla === 'function') renderTabla('servicios');
      }
    } else {
      mostrarNotificacion(`Ticket de ${ticket.categoria || 'Garantía / Refacciones'} procesado para Guía de Envío / Despacho.`, 'info');
    }
  }

  // Asegurar generación automática de Guía de Envío si el ticket tiene refacciones
  if (typeof window.asegurarGuiaEnvioParaTicket === 'function') {
    const isRefCat = String(ticket.categoria || '').toLowerCase().includes('refacci') || String(ticket.categoria || '').toLowerCase().includes('garant') || (ticket.folio && ticket.folio.endsWith('-A'));
    if (isRefCat || (ticket.refaccionesSeleccionadas && ticket.refaccionesSeleccionadas.length > 0)) {
      window.asegurarGuiaEnvioParaTicket(ticket);
    }
  }

  if (window._levantamientoDeOrigen) {
    const lev = window._levantamientoDeOrigen;
    lev.estado = 'Completado';
    lev.ticket_generado_id = ticket.id;
    lev._synced = false;
    
    if (typeof safeSetJSON === 'function') safeSetJSON('sapi_levantamientos', levantamientos);
    if (window.supabaseClient) {
      // Actualizar solo el estado y el id del ticket generado en Supabase para no sobreescribir las evidencias
      await window.supabaseClient.from('levantamientos')
        .update({ estado: 'Completado', ticket_generado_id: ticket.id })
        .eq('id', lev.id);
    }
    if (typeof renderLevantamientos === 'function') {
      renderLevantamientos();
    }
    window._levantamientoDeOrigen = null;
    mostrarNotificacion('Levantamiento completado y vinculado al ticket.', 'success');
  }
  if (window.trackTelemetryEvent) {
    const act = editandoTicketId ? 'Edición de Ticket' : 'Creación de Ticket';
    window.trackTelemetryEvent(act, { folio: ticket.folio, asunto: ticket.asunto });
  }
  cerrarTicket();
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
  if (typeof renderRefaccionesPendientes === 'function') {
    renderRefaccionesPendientes();
  }
}

async function eliminarTicket(id) {
  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Ticket',
    mensaje: '¿Estás seguro de que deseas eliminar este ticket?',
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;
  const t = tickets.find(x => x.id === id);
  const folio = t ? t.folio : 'Desconocido';

  tickets = tickets.filter(t => t.id !== id);
  if (typeof window !== 'undefined' && Array.isArray(window.tickets)) window.tickets = window.tickets.filter(t => t.id !== id);
  safeSetJSON('sapi_tickets', tickets);
  
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('tickets', id);
  }
  if (window.trackTelemetryEvent) {
    window.trackTelemetryEvent('Eliminación de Ticket', { id, folio });
  }
  renderTickets();
  renderStats();
  updateTicketBadge(); updateOrdenesBadge();
}


  var exports = {
    editandoTicketId: editandoTicketId,
    abrirTicket: abrirTicket,
    abrirTicketPreloaded: abrirTicketPreloaded,
    toggleResolucionTicket: toggleResolucionTicket,
    toggleMotivoRechazo: toggleMotivoRechazo,
    editarTicket: editarTicket,
    cerrarTicket: cerrarTicket,
    poblarSoportesPorCliente: poblarSoportesPorCliente,
    poblarMaquinasCliente: poblarMaquinasCliente,
    onEquipoOrdenChange: onEquipoOrdenChange,
    onEquipoTicketChange: onEquipoTicketChange,
    onEquipoTicketChangeMultiple: onEquipoTicketChangeMultiple,
    actualizarCamposMaquinaOrden: actualizarCamposMaquinaOrden,
    agregarMaquinaChip: agregarMaquinaChip,
    agregarMaquinaChipOrden: agregarMaquinaChipOrden,
    onEquipoOrdenChangeMultiple: onEquipoOrdenChangeMultiple,
    toggleCombo: toggleCombo,
    filterCombo: filterCombo,
    selectComboOption: selectComboOption,
    agregarSitioCombo: agregarSitioCombo,
    agregarEmpresaCombo: agregarEmpresaCombo,
    readFileAsBase64: readFileAsBase64,
    guardarTicket: guardarTicket,
    eliminarTicket: eliminarTicket
  };

  if (typeof root !== "undefined") {
    root.TicketsForm = exports;
  }
  if (typeof window !== "undefined") {
    window.TicketsForm = exports;
    window.abrirTicket = abrirTicket;
    window.abrirTicketPreloaded = abrirTicketPreloaded;
    window.toggleResolucionTicket = toggleResolucionTicket;
    window.toggleMotivoRechazo = toggleMotivoRechazo;
    window.editarTicket = editarTicket;
    window.cerrarTicket = cerrarTicket;
    window.poblarSoportesPorCliente = poblarSoportesPorCliente;
    window.poblarMaquinasCliente = poblarMaquinasCliente;
    window.onEquipoOrdenChange = onEquipoOrdenChange;
    window.onEquipoTicketChange = onEquipoTicketChange;
    window.onEquipoTicketChangeMultiple = onEquipoTicketChangeMultiple;
    window.actualizarCamposMaquinaOrden = actualizarCamposMaquinaOrden;
    window.agregarMaquinaChip = agregarMaquinaChip;
    window.agregarMaquinaChipOrden = agregarMaquinaChipOrden;
    window.onEquipoOrdenChangeMultiple = onEquipoOrdenChangeMultiple;
    window.toggleCombo = toggleCombo;
    window.filterCombo = filterCombo;
    window.selectComboOption = selectComboOption;
    window.agregarSitioCombo = agregarSitioCombo;
    window.agregarEmpresaCombo = agregarEmpresaCombo;
    window.readFileAsBase64 = readFileAsBase64;
    window.guardarTicket = guardarTicket;
    window.eliminarTicket = eliminarTicket;
  }

  return exports;
});
