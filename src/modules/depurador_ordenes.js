/**
 * MÓDULO DE DEPURACIÓN DE ÓRDENES DE REFACCIONES, GARANTÍAS Y VISOR DE MANUALES
 * Eurorep / SAPI - ES Module
 */

const _normStr = (s) => {
  if (typeof normStr === "function") return normStr(s);
  if (typeof window !== "undefined" && typeof window.normStr === "function") return window.normStr(s);
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

const _notify = (msg, tipo = "info") => {
  if (typeof mostrarNotificacion === "function") return mostrarNotificacion(msg, tipo);
  if (typeof window !== "undefined" && typeof window.mostrarNotificacion === "function") return window.mostrarNotificacion(msg, tipo);
  console.log("[" + tipo.toUpperCase() + "] " + msg);
};

// ============================================================
// DEPURADOR DE ÓRDENES DE REFACCIONES Y GARANTÍAS (SUPERADMIN)
// ============================================================
let _depurarOrdenesCache = [];
let _depurarSeleccionadas = new Set();
let _depurarFiltradasActuales = [];

function contarOrdenesRefacciones() {
  let ords = typeof getFilteredOrders === 'function' ? getFilteredOrders() : ((typeof ordenes !== 'undefined' && ordenes && ordenes.length > 0) ? ordenes : ((typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('sapi_ordenes') || '[]') : []));
  let tkts = typeof getFilteredTickets === 'function' ? getFilteredTickets() : ((typeof tickets !== 'undefined' && tickets && tickets.length > 0) ? tickets : ((typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('sapi_tickets') || '[]') : []));

  // Filtrado estricto para excluir tickets y órdenes de la Sandbox / Modo de Pruebas
  if (typeof isTestData === 'function') {
    const activeSandbox = typeof isTestModeActive === 'function' ? isTestModeActive() : false;
    ords = ords.filter(o => isTestData(o) === activeSandbox);
    tkts = tkts.filter(t => isTestData(t) === activeSandbox);
  }

  const vinculadasRef = [];
  const vinculadasGar = [];

  ords.forEach(o => {
    const ticketId = o.soporte || o.ticket_id;
    if (!ticketId) return;
    const t = tkts.find(x => x.id === ticketId || x.folio === ticketId);
    if (t) {
      const norm = (s) => (typeof window.normStr === 'function' ? window.normStr(s) : String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      const cat = norm(t.categoria);
      const area = norm(t.area);
      const tipo = norm(t.tipo);
      const folio = String(t.folio || '').trim().toUpperCase();
      const clienteNom = o.cliente || t.cliente || 'Sin cliente';

      // Identificar si el ticket es de Garantía o Refacción/Despacho
      const isGarantia = cat.includes('garant') || area.includes('garant') || tipo.includes('garant');
      const isRefaccion = cat.includes('refacci') || cat.includes('pieza') || cat.includes('despacho') || 
                          cat.includes('envio') || cat.includes('paqueteri') || 
                          area.includes('refacci') || area.includes('almacen') || area.includes('pieza') ||
                          tipo.includes('refacci') || tipo.includes('despacho') ||
                          folio.endsWith('-A') || folio.includes('-REF') || folio.startsWith('REF-');

      // Si el ticket NO es de refacción ni de garantía (ej. es "Otro", "Servicio Técnico", "Soporte", etc.), NUNCA debe incluirse en este depurador
      if (!isGarantia && !isRefaccion) {
        return;
      }

      const isFieldService = typeof window.esTicketDeServicioEnCampo === 'function' ? window.esTicketDeServicioEnCampo(t) : (cat.includes('servicio') || cat.includes('mantenimiento'));

      if (!isFieldService) {
        if (isGarantia) {
          vinculadasGar.push({
            id: o.id,
            ordenFolio: o.folio || o.id,
            ordenEstado: o.estado || 'Pendiente',
            fechaOS: o.fecha || '',
            ticketFolio: t.folio || t.id,
            ticketCategoria: t.categoria || 'Garantía',
            asuntoTicket: t.asunto || '',
            cliente: clienteNom,
            isRef: false,
            isGar: true
          });
        } else if (isRefaccion) {
          vinculadasRef.push({
            id: o.id,
            ordenFolio: o.folio || o.id,
            ordenEstado: o.estado || 'Pendiente',
            fechaOS: o.fecha || '',
            ticketFolio: t.folio || t.id,
            ticketCategoria: t.categoria || (t.area && t.area.toLowerCase().includes('refacci') ? 'Refacciones' : 'Refacción'),
            asuntoTicket: t.asunto || '',
            cliente: clienteNom,
            isRef: true,
            isGar: false
          });
        }
      }
    }
  });

  return {
    totalOrdenes: ords.length,
    totalTickets: tkts.length,
    ordenesRefacciones: vinculadasRef.length,
    ordenesGarantias: vinculadasGar.length,
    detalleRefacciones: vinculadasRef,
    detalleGarantias: vinculadasGar,
    todas: [...vinculadasRef, ...vinculadasGar]
  };
};

function renderManualesPorRol() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('manuals-grid-container') || document.querySelector('.manuals-grid');
  if (!container) return;

  // Determinar el rol activo (simulado o real de la sesión)
  let rawRole = '';
  if (typeof currentSession !== 'undefined' && currentSession) {
    rawRole = String(currentSession.viewMode || currentSession.rol || currentSession.realRol || '').toLowerCase().trim();
  }
  if (!rawRole && typeof usuarios !== 'undefined' && Array.isArray(usuarios) && typeof currentSession !== 'undefined' && currentSession?.userId) {
    const u = usuarios.find(x => x && x.id === currentSession.userId);
    if (u) rawRole = String(u.rol || u.viewMode || '').toLowerCase().trim();
  }

  // Normalizar cadena de rol (remover acentos, espacios y caracteres especiales)
  const normRole = String(rawRole || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  // Evaluar jerarquía de roles
  const isSuperAdmin = (
    normRole.includes('super') ||
    (typeof currentSession !== 'undefined' && currentSession && (
      currentSession.userId === 'superadmin' ||
      String(currentSession.realRol || '').toLowerCase().includes('super') ||
      String(currentSession.viewMode || '').toLowerCase().includes('super') ||
      String(currentSession.rol || '').toLowerCase().includes('super')
    ))
  );

  const isAdminOrSupervisor = (
    isSuperAdmin ||
    normRole.includes('admin') ||
    normRole.includes('supervis') ||
    normRole.includes('gerent') ||
    normRole.includes('coord') ||
    normRole === 'consulta'
  );

  const isTecnico = (
    normRole.includes('tecnic') ||
    normRole.includes('instalad') ||
    normRole.includes('taller') ||
    normRole.includes('mecanic')
  );

  const isCliente = (
    normRole.includes('client') ||
    normRole.includes('empres')
  );

  // Catálogo completo global de manuales con permisos por rol y visores HTML interactivos
  window.CATALOGO_MANUALES = [
    {
      id: 'diagrama_flujo',
      titulo: 'Diagrama de Flujo del Proceso',
      subtitulo: 'Mapa interactivo: Euro SAPI vs. Portal Clientes',
      html: 'manuales/diagrama_flujo.html',
      link: 'manuales/diagrama_flujo.html',
      pdf: 'manuales/diagrama_flujo.html',
      icono: 'network',
      destacado: true,
      customStyle: 'border-color: rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.05);',
      customIconStyle: 'background: rgba(139, 92, 246, 0.15); color: #8b5cf6;',
      customTitleColor: '#a78bfa',
      isExternal: true
    },
    {
      id: 'flujo_completo',
      titulo: 'Flujo Completo',
      subtitulo: 'Ciclo completo del sistema',
      html: 'manuales/manual_flujo_completo.html',
      pdf: 'manuales/manual_flujo_completo.pdf',
      icono: 'git-branch',
      destacado: true
    },
    {
      id: 'admin',
      aliasId: 'administrador',
      titulo: 'Administrador',
      subtitulo: 'Gestión, calendario y roles',
      html: 'manuales/manual_administrador.html',
      pdf: 'manuales/manual_administrador.pdf',
      icono: 'user-cog',
      destacado: false
    },
    {
      id: 'tecnico',
      titulo: 'Técnico de Campo',
      subtitulo: 'Órdenes, bitácoras y offline',
      html: 'manuales/manual_tecnico.html',
      pdf: 'manuales/manual_tecnico.pdf',
      icono: 'wrench',
      destacado: false
    },
    {
      id: 'tickets',
      titulo: 'Gestión de Tickets',
      subtitulo: 'Ciclo, cotizaciones SAP y chat',
      html: 'manuales/manual_tickets.html',
      pdf: 'manuales/manual_tickets.pdf',
      icono: 'ticket',
      destacado: false
    },
    {
      id: 'gastos',
      titulo: 'Control de Gastos',
      subtitulo: 'Viáticos y conciliación Clara',
      html: 'manuales/manual_gastos.html',
      pdf: 'manuales/manual_gastos.pdf',
      icono: 'credit-card',
      destacado: false
    },
    {
      id: 'cliente',
      titulo: 'Manual del Cliente',
      subtitulo: 'Portal, rentas y solicitudes',
      html: 'manuales/manual_cliente.html',
      pdf: 'manuales/manual_cliente.pdf',
      icono: 'building',
      destacado: false
    },
    {
      id: 'desarrollador',
      titulo: 'Sistemas y Desarrollador',
      subtitulo: 'Estructura técnica, DB y APIs',
      html: 'manuales/manual_tecnico_desarrollador.html',
      pdf: 'manuales/manual_tecnico_desarrollador.pdf',
      icono: 'code-2',
      destacado: false,
      soloSuperAdmin: true
    }
  ];

  const catalogoManuales = window.CATALOGO_MANUALES;

  let manualesPermitidos = [];
  if (isSuperAdmin) {
    // Superadmin ve absolutamente TODOS los manuales
    manualesPermitidos = catalogoManuales;
  } else if (isAdminOrSupervisor) {
    // Admin / Supervisor ve todos excepto el de desarrollador
    manualesPermitidos = catalogoManuales.filter(m => !m.soloSuperAdmin);
  } else if (isTecnico) {
    // Técnico ve técnico, gastos, flujo_completo, diagrama_flujo
    manualesPermitidos = catalogoManuales.filter(m => ['tecnico', 'gastos', 'flujo_completo', 'diagrama_flujo'].includes(m.id));
  } else if (isCliente) {
    // Cliente solo ve manual del cliente
    manualesPermitidos = catalogoManuales.filter(m => m.id === 'cliente');
  } else {
    // Fallback general por defecto
    manualesPermitidos = catalogoManuales.filter(m => !m.soloSuperAdmin);
  }

  // Garantizar que nunca quede vacío
  if (!manualesPermitidos || manualesPermitidos.length === 0) {
    manualesPermitidos = catalogoManuales.filter(m => !m.soloSuperAdmin);
  }

  let html = '';
  manualesPermitidos.forEach(m => {
    const urlViewer = m.html || m.link || m.pdf;
    const featuredClass = m.destacado ? ' featured' : '';
    const styleAttr = m.customStyle ? ` style="${m.customStyle}"` : '';
    const iconStyleAttr = m.customIconStyle ? ` style="${m.customIconStyle}"` : '';
    const titleStyleAttr = m.customTitleColor ? ` style="color:${m.customTitleColor}; font-weight:700;"` : '';

    html += `
      <a href="${urlViewer}" target="_blank" 
         class="manual-download-card${featuredClass}"${styleAttr} 
         title="Ver en línea: ${m.titulo}">
        <div class="manual-card-icon"${iconStyleAttr}>
          <i data-lucide="${m.icono}" style="width:16px; height:16px;"></i>
        </div>
        <div class="manual-card-info">
          <div class="manual-card-title"${titleStyleAttr}>${m.titulo}</div>
          <div class="manual-card-sub">${m.subtitulo}</div>
        </div>
        <i data-lucide="external-link" class="manual-card-download-icon"${m.customIconStyle ? ` style="${m.customIconStyle}"` : ''}></i>
      </a>
    `;
  });

  container.innerHTML = html;
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch(e) {}
  }
};

function crearModalVisorManualSiNoExiste() {
  if (typeof document === 'undefined') return;
  let overlay = document.getElementById('modal-visor-manual-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-visor-manual-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'z-index: 999999; display: none;';
    overlay.setAttribute('onclick', 'window.cerrarVisorManual(event)');
    overlay.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 1150px; width: 95vw; height: 90vh; max-height: 90vh; display: flex; flex-direction: column; background: var(--bg-card, #1e293b); color: var(--text-primary, #f8fafc); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 14px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.6);">
        <div class="modal-header" style="padding: 0.85rem 1.25rem; background: var(--bg-secondary, #1a1d27); border-bottom: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
            <div id="modal-visor-manual-icon-container" style="width: 36px; height: 36px; border-radius: 8px; background: rgba(37,99,235,0.15); color: var(--primary, #2563eb); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i data-lucide="book-open" id="modal-visor-manual-icon" style="width: 18px; height: 18px;"></i>
            </div>
            <div style="min-width: 0;">
              <h2 id="modal-visor-manual-titulo" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary, #f8fafc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Manual del Sistema</h2>
              <div id="modal-visor-manual-sub" style="font-size: 0.75rem; color: var(--text-muted, #94a3b8); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Visor interactivo oficial</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <button type="button" class="btn-secondary" onclick="window.imprimirManualIframe()" title="Imprimir manual" style="padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 8px; cursor: pointer; border: 1px solid var(--border, rgba(255,255,255,0.1)); background: var(--bg-card, #1e293b); color: var(--text-primary, #f8fafc);">
              <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
              <span>Imprimir</span>
            </button>
            <a id="modal-visor-manual-btn-download" href="#" download class="btn-secondary" title="Descargar documento PDF" style="padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 8px; cursor: pointer; border: 1px solid var(--border, rgba(255,255,255,0.1)); background: var(--bg-card, #1e293b); color: var(--text-primary, #f8fafc);">
              <i data-lucide="download" style="width: 14px; height: 14px;"></i>
              <span>Descargar PDF</span>
            </a>
            <a id="modal-visor-manual-btn-tab" href="#" target="_blank" class="btn-secondary" title="Abrir en pestaña nueva" style="padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 8px; cursor: pointer; border: 1px solid var(--border, rgba(255,255,255,0.1)); background: var(--bg-card, #1e293b); color: var(--text-primary, #f8fafc);">
              <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
              <span>Pestaña Nueva</span>
            </a>
            <button type="button" class="modal-close" onclick="window.cerrarVisorManual()" style="background: transparent; border: none; color: var(--text-muted); font-size: 1.3rem; cursor: pointer; padding: 0.2rem 0.4rem; line-height: 1; border-radius: 6px; margin-left: 0.25rem;" title="Cerrar visor">✕</button>
          </div>
        </div>
        <div class="modal-body" style="flex: 1; padding: 0; overflow: hidden; background: #ffffff; position: relative; display: flex; flex-direction: column;">
          <div id="modal-visor-manual-loading" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #1e293b); color: var(--text-muted, #94a3b8); z-index: 2; transition: opacity 0.2s ease;">
            <div class="spinner" style="width: 32px; height: 32px; border: 3px solid rgba(37,99,235,0.2); border-top-color: var(--primary, #2563eb); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 0.75rem;"></div>
            <div style="font-size: 0.85rem; font-weight: 500;">Cargando documento en pantalla...</div>
          </div>
          <iframe id="modal-visor-manual-iframe" src="about:blank" style="width: 100%; height: 100%; border: none; flex: 1; background: #ffffff;" title="Visor de Manual Eurorep SAPI"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  return overlay;
};

function abrirVisorManualPorId(id) {
  if (typeof document === 'undefined') return;
  const catalogo = window.CATALOGO_MANUALES || [];
  const m = catalogo.find(item => item.id === id || item.aliasId === id);
  if (m) {
    abrirVisorManual(m.html || m.link || m.pdf, m.titulo, m.subtitulo, m.pdf || m.link, m.icono);
  } else {
    abrirVisorManual(`manuales/manual_${id}.html`, 'Manual del Sistema', 'Visor interactivo oficial', `manuales/manual_${id}.pdf`, 'book-open');
  }
};

function abrirVisorManual(urlHtml, arg2, arg3, arg4, arg5) {
  if (typeof document === 'undefined') return;
  const overlay = crearModalVisorManualSiNoExiste();
  const titleEl = document.getElementById('modal-visor-manual-titulo');
  const subEl = document.getElementById('modal-visor-manual-sub');
  const iconContainer = document.getElementById('modal-visor-manual-icon-container');
  const btnTab = document.getElementById('modal-visor-manual-btn-tab');
  const btnDownload = document.getElementById('modal-visor-manual-btn-download');
  const iframe = document.getElementById('modal-visor-manual-iframe');
  const loadingEl = document.getElementById('modal-visor-manual-loading');

  let titulo = 'Manual del Sistema';
  let subtitulo = 'Visor interactivo oficial';
  let urlPdf = '';
  let icono = arg5 || 'book-open';

  if (typeof arg2 === 'string') {
    if (arg2.endsWith('.pdf') || (arg2.includes('/') && !arg2.includes(' '))) {
      urlPdf = arg2;
      if (arg3) titulo = arg3;
      if (arg4) subtitulo = arg4;
    } else {
      titulo = arg2;
      if (arg3) subtitulo = arg3;
      if (arg4) urlPdf = arg4;
    }
  }

  const catalogo = window.CATALOGO_MANUALES || [];
  const matched = catalogo.find(item => item.titulo === titulo || item.html === urlHtml || item.pdf === urlPdf);
  if (matched && matched.icono) {
    icono = matched.icono;
  }

  let targetViewerUrl = (urlHtml || urlPdf || 'manuales/manual_flujo_completo.html').replace(/^\.?\//, '');
  if (!urlPdf && urlHtml) {
    urlPdf = urlHtml.endsWith('.html') ? urlHtml.replace(/\.html$/, '.pdf') : urlHtml;
  }
  if (urlPdf) urlPdf = urlPdf.replace(/^\.?\//, '');

  console.log('[VisorManual] Abriendo visor interactivo:', { targetViewerUrl, titulo, subtitulo });

  if (titleEl) titleEl.textContent = titulo;
  if (subEl) subEl.textContent = subtitulo;

  if (iconContainer) {
    iconContainer.innerHTML = `<i data-lucide="${icono}" style="width: 18px; height: 18px;"></i>`;
  }

  if (btnTab) {
    btnTab.href = targetViewerUrl;
  }
  if (btnDownload) {
    btnDownload.href = urlPdf || targetViewerUrl;
    btnDownload.style.display = (targetViewerUrl && targetViewerUrl.includes('diagrama_flujo')) ? 'none' : 'inline-flex';
  }

  // Cargar el documento en el iframe embebido
  if (iframe) {
    if (loadingEl) {
      loadingEl.style.display = 'flex';
      loadingEl.style.opacity = '1';
    }
    const hideLoading = function() {
      if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => { loadingEl.style.display = 'none'; }, 150);
      }
    };
    iframe.onload = hideLoading;
    setTimeout(hideLoading, 350);

    if (!iframe.src.endsWith(targetViewerUrl)) {
      iframe.src = targetViewerUrl;
    } else {
      hideLoading();
    }
  }

  if (overlay) {
    overlay.classList.add('open');
    overlay.style.display = 'flex';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = '999999';
    document.body.style.overflow = 'hidden';
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch(e) {}
  }
};

function cerrarVisorManual(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target) {
    const isOverlay = e.target.id === 'modal-visor-manual-overlay' || e.target.classList.contains('modal-overlay');
    const isCloseBtn = e.target.classList.contains('modal-close') || e.target.closest('.modal-close');
    if (!isOverlay && !isCloseBtn) return;
  }
  const overlay = document.getElementById('modal-visor-manual-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    overlay.style.visibility = 'hidden';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    document.body.style.overflow = '';
  }
  const iframe = document.getElementById('modal-visor-manual-iframe');
  if (iframe) {
    iframe.src = 'about:blank';
  }
};

function imprimirManualIframe() {
  if (typeof document === 'undefined') return;
  const iframe = document.getElementById('modal-visor-manual-iframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      return;
    } catch (e) {
      console.warn('[Visor Manual] Fallback de impresión:', e);
    }
  }
  window.print();
};

function actualizarBadgeDepuradorOrdenes() {
  if (typeof document === 'undefined') return;
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin');
  const cardSuperadmin = document.getElementById('card-superadmin-depuracion');
  if (cardSuperadmin) {
    cardSuperadmin.style.display = isSuperAdmin ? 'block' : 'none';
  }

  const btnDepurar = document.getElementById('btn-depurar-ordenes-ref');
  if (btnDepurar) {
    btnDepurar.style.display = isSuperAdmin ? 'flex' : 'none';
  }

  if (isSuperAdmin) {
    const res = contarOrdenesRefacciones();
    const countTotal = res.ordenesRefacciones + res.ordenesGarantias;
    const badgeServ = document.getElementById('badge-count-ordenes-ref');
    if (badgeServ) badgeServ.textContent = countTotal;
    const badgePref = document.getElementById('badge-count-pref-ref');
    if (badgePref) badgePref.textContent = countTotal;
  }

  // Actualizar también la lista de manuales según el rol actual
  if (typeof window.renderManualesPorRol === 'function') {
    renderManualesPorRol();
  }
};

function abrirModalDepurarOrdenes() {
  if (typeof document === 'undefined') return;
  const isSuperAdmin = currentSession && (currentSession.viewMode === 'superadmin' || currentSession.userId === 'superadmin');
  if (!isSuperAdmin) {
    mostrarNotificacion('Solo el Superadministrador puede acceder a la herramienta de depuración.', 'error');
    return;
  }

  const res = contarOrdenesRefacciones();
  _depurarOrdenesCache = res.todas;
  _depurarSeleccionadas.clear();

  // Actualizar stats
  const statRef = document.getElementById('depurar-stat-ref');
  if (statRef) statRef.textContent = res.ordenesRefacciones;
  const statGar = document.getElementById('depurar-stat-gar');
  if (statGar) statGar.textContent = res.ordenesGarantias;
  const statSel = document.getElementById('depurar-stat-selected');
  if (statSel) statSel.textContent = '0';

  // Reset filtros
  const searchInput = document.getElementById('depurar-search-input');
  if (searchInput) searchInput.value = '';
  const filterCat = document.getElementById('depurar-filter-categoria');
  if (filterCat) filterCat.value = 'all';
  const filterEst = document.getElementById('depurar-filter-estado');
  if (filterEst) filterEst.value = 'all';

  filtrarTablaDepurador();

  const modal = document.getElementById('modal-depurar-ordenes-overlay');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

function cerrarModalDepurarOrdenes(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target && e.target !== document.getElementById('modal-depurar-ordenes-overlay') && !e.target.classList.contains('modal-close') && !e.target.closest('.modal-close')) {
    return;
  }
  const modal = document.getElementById('modal-depurar-ordenes-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
};

function filtrarTablaDepurador() {
  if (typeof document === 'undefined') return;
  const q = (document.getElementById('depurar-search-input')?.value || '').toLowerCase().trim();
  const fCat = document.getElementById('depurar-filter-categoria')?.value || 'all';
  const fEst = document.getElementById('depurar-filter-estado')?.value || 'all';

  let filtradas = (_depurarOrdenesCache || []).filter(item => {
    if (fCat === 'refaccion' && !item.isRef) return false;
    if (fCat === 'garantia' && !item.isGar) return false;
    if (fEst !== 'all' && item.ordenEstado !== fEst) return false;

    if (q) {
      const matchFolioOS = (item.ordenFolio || '').toLowerCase().includes(q);
      const matchFolioTkt = (item.ticketFolio || '').toLowerCase().includes(q);
      const matchCliente = (item.cliente || '').toLowerCase().includes(q);
      const matchAsunto = (item.asuntoTicket || '').toLowerCase().includes(q);
      const matchCat = (item.ticketCategoria || '').toLowerCase().includes(q);
      if (!matchFolioOS && !matchFolioTkt && !matchCliente && !matchAsunto && !matchCat) {
        return false;
      }
    }
    return true;
  });

  _depurarFiltradasActuales = filtradas;

  const tbody = document.getElementById('depurar-tabla-body');
  if (!tbody) return;

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.9rem;">
          <i data-lucide="check-circle" style="width:32px; height:32px; color:#10b981; margin-bottom:0.5rem; display:block; margin-inline:auto;"></i>
          No hay órdenes de refacciones o garantías que coincidan con los filtros seleccionados.
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    actualizarBotonesAccionMasivaDepurador();
    return;
  }

  let html = '';
  filtradas.forEach(item => {
    const isChecked = _depurarSeleccionadas.has(item.id);
    const badgeColor = item.isGar ? '#0ea5e9' : '#ea580c';
    const badgeBg = item.isGar ? 'rgba(14,165,233,0.15)' : 'rgba(234,88,12,0.15)';
    const dateFormatted = item.fechaOS ? item.fechaOS.split('T')[0] : 'Sin fecha';

    let estadoBg = 'rgba(100,116,139,0.15)';
    let estadoColor = '#64748b';
    if (item.ordenEstado === 'Pendiente') { estadoBg = 'rgba(234,179,8,0.15)'; estadoColor = '#ca8a04'; }
    else if (item.ordenEstado === 'En proceso') { estadoBg = 'rgba(59,130,246,0.15)'; estadoColor = '#2563eb'; }
    else if (item.ordenEstado === 'Completado') { estadoBg = 'rgba(16,185,129,0.15)'; estadoColor = '#16a34a'; }
    else if (item.ordenEstado === 'Refacciones pendientes') { estadoBg = 'rgba(249,115,22,0.15)'; estadoColor = '#ea580c'; }

    html += `
      <tr style="border-bottom:1px solid var(--border); transition: background 0.15s; ${isChecked ? 'background:rgba(234,88,12,0.05);' : ''}">
        <td style="text-align:center; padding:0.6rem 0.4rem;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleDepurarRowCheck('${item.id}', this.checked)" style="cursor:pointer;" />
        </td>
        <td style="padding:0.6rem 0.75rem; font-weight:700; color:var(--text-primary);">
          <span style="display:inline-flex; align-items:center; gap:0.3rem;">
            <i data-lucide="file-text" style="width:13px; height:13px; color:var(--accent);"></i>
            ${item.ordenFolio}
          </span>
        </td>
        <td style="padding:0.6rem 0.75rem;">
          <span style="display:inline-block; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:10px; background:${estadoBg}; color:${estadoColor};">
            ${item.ordenEstado}
          </span>
        </td>
        <td style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.78rem;">
          ${dateFormatted}
        </td>
        <td style="padding:0.6rem 0.75rem; font-weight:600; color:var(--text-primary); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${item.cliente}
        </td>
        <td style="padding:0.6rem 0.75rem;">
          <span style="font-family:monospace; font-weight:600; background:var(--bg-body); border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-size:0.75rem;">
            ${item.ticketFolio}
          </span>
        </td>
        <td style="padding:0.6rem 0.75rem;">
          <span style="display:inline-block; font-size:0.72rem; font-weight:600; padding:2px 6px; border-radius:4px; background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeColor}33;">
            ${item.ticketCategoria}
          </span>
        </td>
        <td style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.78rem; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.asuntoTicket || ''}">
          ${item.asuntoTicket || '<i style="opacity:0.6;">Sin asunto</i>'}
        </td>
        <td style="padding:0.6rem 0.5rem; text-align:center;">
          <button type="button" class="action-btn del" onclick="window.eliminarOrdenDesdeDepurador('${item.id}')" title="Eliminar orden de servicio" style="padding:4px 8px; border:none; background:rgba(239,68,68,0.1); color:#ef4444; border-radius:4px; cursor:pointer;">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  actualizarBotonesAccionMasivaDepurador();
};

function toggleDepurarCheckAll(checked) {
  if (typeof document === 'undefined') return;
  (_depurarFiltradasActuales || []).forEach(item => {
    if (checked) {
      _depurarSeleccionadas.add(item.id);
    } else {
      _depurarSeleccionadas.delete(item.id);
    }
  });
  filtrarTablaDepurador();
};

function toggleDepurarRowCheck(id, checked) {
  if (checked) {
    _depurarSeleccionadas.add(id);
  } else {
    _depurarSeleccionadas.delete(id);
  }
  actualizarBotonesAccionMasivaDepurador();
};

function actualizarBotonesAccionMasivaDepurador() {
  if (typeof document === 'undefined') return;
  const count = _depurarSeleccionadas.size;
  const statSel = document.getElementById('depurar-stat-selected');
  if (statSel) statSel.textContent = count;

  const btnDel = document.getElementById('btn-depurar-delete-selected');
  const countLabel = document.getElementById('btn-depurar-del-count');
  if (countLabel) countLabel.textContent = count;

  if (btnDel) {
    if (count > 0) {
      btnDel.disabled = false;
      btnDel.style.opacity = '1';
      btnDel.style.cursor = 'pointer';
    } else {
      btnDel.disabled = true;
      btnDel.style.opacity = '0.5';
      btnDel.style.cursor = 'not-allowed';
    }
  }

  // Check master checkbox state
  const checkAll = document.getElementById('depurar-check-all');
  if (checkAll && _depurarFiltradasActuales && _depurarFiltradasActuales.length > 0) {
    const allVisibleChecked = _depurarFiltradasActuales.every(i => _depurarSeleccionadas.has(i.id));
    checkAll.checked = allVisibleChecked;
  } else if (checkAll) {
    checkAll.checked = false;
  }
};

async function eliminarOrdenDesdeDepurador(id) {
  const item = (_depurarOrdenesCache || []).find(x => x.id === id);
  const folio = item ? item.ordenFolio : id;

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Orden de Servicio',
    mensaje: `¿Deseas eliminar la orden ${folio}? El ticket comercial correspondiente (${item ? item.ticketFolio : ''}) seguirá conservándose.`,
    textoAceptar: 'Eliminar Orden',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  // 1. Eliminar de memoria local
  ordenes = ordenes.filter(o => o.id !== id);
  safeSetJSON('sapi_ordenes', ordenes);

  // 2. Eliminar de Supabase
  if (window.deleteFromSupabase) {
    window.deleteFromSupabase('ordenes', id);
  }

  _depurarSeleccionadas.delete(id);
  _depurarOrdenesCache = _depurarOrdenesCache.filter(x => x.id !== id);

  // Actualizar vistas
  if (typeof renderTabla === 'function') {
    renderTabla('servicios');
    renderTabla();
  }
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderCalendario === 'function') renderCalendario();

  actualizarBadgeDepuradorOrdenes();

  // Actualizar stats del modal
  const res = contarOrdenesRefacciones();
  const statRef = document.getElementById('depurar-stat-ref');
  if (statRef) statRef.textContent = res.ordenesRefacciones;
  const statGar = document.getElementById('depurar-stat-gar');
  if (statGar) statGar.textContent = res.ordenesGarantias;

  filtrarTablaDepurador();
  mostrarNotificacion(`Orden ${folio} eliminada con éxito.`, 'success');
};

async function eliminarSeleccionadasDepurador() {
  const ids = Array.from(_depurarSeleccionadas);
  if (ids.length === 0) return;

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Órdenes Seleccionadas',
    mensaje: `¿Estás seguro de que deseas eliminar permanentemente las ${ids.length} órdenes seleccionadas? Los tickets origen se conservarán intactos.`,
    textoAceptar: `Eliminar ${ids.length} Órdenes`,
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  const idSet = new Set(ids);
  ordenes = ordenes.filter(o => !idSet.has(o.id));
  safeSetJSON('sapi_ordenes', ordenes);

  if (window.deleteFromSupabase) {
    ids.forEach(id => window.deleteFromSupabase('ordenes', id));
  }

  _depurarSeleccionadas.clear();
  _depurarOrdenesCache = _depurarOrdenesCache.filter(x => !idSet.has(x.id));

  if (typeof renderTabla === 'function') {
    renderTabla('servicios');
    renderTabla();
  }
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderCalendario === 'function') renderCalendario();

  actualizarBadgeDepuradorOrdenes();

  const res = contarOrdenesRefacciones();
  const statRef = document.getElementById('depurar-stat-ref');
  if (statRef) statRef.textContent = res.ordenesRefacciones;
  const statGar = document.getElementById('depurar-stat-gar');
  if (statGar) statGar.textContent = res.ordenesGarantias;

  filtrarTablaDepurador();
  mostrarNotificacion(`Se eliminaron ${ids.length} órdenes seleccionadas.`, 'success');
};

async function eliminarTodasPendientesRefacciones() {
  const pendientes = (_depurarOrdenesCache || []).filter(x => x.isRef && x.ordenEstado === 'Pendiente');
  if (pendientes.length === 0) {
    mostrarNotificacion('No hay órdenes pendientes de refacciones para eliminar.', 'info');
    return;
  }

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Órdenes Pendientes de Refacciones',
    mensaje: `Se encontraron ${pendientes.length} órdenes con estado 'Pendiente' vinculadas a tickets de Refacciones. ¿Deseas eliminarlas todas?`,
    textoAceptar: `Eliminar ${pendientes.length} Pendientes`,
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  const idSet = new Set(pendientes.map(x => x.id));
  ordenes = ordenes.filter(o => !idSet.has(o.id));
  safeSetJSON('sapi_ordenes', ordenes);

  if (window.deleteFromSupabase) {
    pendientes.forEach(p => window.deleteFromSupabase('ordenes', p.id));
  }

  pendientes.forEach(p => _depurarSeleccionadas.delete(p.id));
  _depurarOrdenesCache = _depurarOrdenesCache.filter(x => !idSet.has(x.id));

  if (typeof renderTabla === 'function') {
    renderTabla('servicios');
    renderTabla();
  }
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderCalendario === 'function') renderCalendario();

  actualizarBadgeDepuradorOrdenes();

  const res = contarOrdenesRefacciones();
  const statRef = document.getElementById('depurar-stat-ref');
  if (statRef) statRef.textContent = res.ordenesRefacciones;
  const statGar = document.getElementById('depurar-stat-gar');
  if (statGar) statGar.textContent = res.ordenesGarantias;

  filtrarTablaDepurador();
  mostrarNotificacion(`Se eliminaron ${pendientes.length} órdenes pendientes de refacciones.`, 'success');
};

function exportarDepuradorAExcel() {
  const lista = _depurarFiltradasActuales || _depurarOrdenesCache || [];
  if (lista.length === 0) {
    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion('No hay órdenes en la lista para exportar a Excel.', 'warning');
    } else {
      alert('No hay órdenes en la lista para exportar a Excel.');
    }
    return;
  }

  const dataExport = lista.map((item, idx) => ({
    '#': idx + 1,
    'Folio OS': item.ordenFolio || item.id || '',
    'Estatus OS': item.ordenEstado || '',
    'Fecha OS': item.fechaOS ? item.fechaOS.split('T')[0] : '',
    'Cliente': item.cliente || '',
    'Ticket Origen': item.ticketFolio || '',
    'Categoría Ticket': item.ticketCategoria || '',
    'Asunto Ticket': item.asuntoTicket || ''
  }));

  const fechaHoy = new Date().toISOString().split('T')[0];
  const filename = `Depurador_Ordenes_Servicio_${fechaHoy}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(dataExport);
    
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 35 },
      { wch: 16 },
      { wch: 20 },
      { wch: 50 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Órdenes Depurables');
    XLSX.writeFile(wb, filename);

    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} órdenes a Excel (${filename}).`, 'success');
    }
  } else {
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
    a.download = filename.replace('.xlsx', '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(`Se exportaron ${lista.length} órdenes a CSV.`, 'success');
    }
  }
};

// Exponer funciones en window para retrocompatibilidad total
if (typeof window !== "undefined") {
  window._depurarOrdenesCache = _depurarOrdenesCache;
  window._depurarSeleccionadas = _depurarSeleccionadas;
  window._depurarFiltradasActuales = _depurarFiltradasActuales;
  window.contarOrdenesRefacciones = contarOrdenesRefacciones;
  window.renderManualesPorRol = renderManualesPorRol;
  window.crearModalVisorManualSiNoExiste = crearModalVisorManualSiNoExiste;
  window.abrirVisorManualPorId = abrirVisorManualPorId;
  window.abrirVisorManual = abrirVisorManual;
  window.cerrarVisorManual = cerrarVisorManual;
  window.imprimirManualIframe = imprimirManualIframe;
  window.actualizarBadgeDepuradorOrdenes = actualizarBadgeDepuradorOrdenes;
  window.abrirModalDepurarOrdenes = abrirModalDepurarOrdenes;
  window.cerrarModalDepurarOrdenes = cerrarModalDepurarOrdenes;
  window.filtrarTablaDepurador = filtrarTablaDepurador;
  window.toggleDepurarCheckAll = toggleDepurarCheckAll;
  window.toggleDepurarRowCheck = toggleDepurarRowCheck;
  window.actualizarBotonesAccionMasivaDepurador = actualizarBotonesAccionMasivaDepurador;
  window.eliminarOrdenDesdeDepurador = eliminarOrdenDesdeDepurador;
  window.eliminarSeleccionadasDepurador = eliminarSeleccionadasDepurador;
  window.eliminarTodasPendientesRefacciones = eliminarTodasPendientesRefacciones;
  window.exportarDepuradorAExcel = exportarDepuradorAExcel;
}

export {
  _depurarOrdenesCache,
  _depurarSeleccionadas,
  _depurarFiltradasActuales,
  contarOrdenesRefacciones,
  renderManualesPorRol,
  crearModalVisorManualSiNoExiste,
  abrirVisorManualPorId,
  abrirVisorManual,
  cerrarVisorManual,
  imprimirManualIframe,
  actualizarBadgeDepuradorOrdenes,
  abrirModalDepurarOrdenes,
  cerrarModalDepurarOrdenes,
  filtrarTablaDepurador,
  toggleDepurarCheckAll,
  toggleDepurarRowCheck,
  actualizarBotonesAccionMasivaDepurador,
  eliminarOrdenDesdeDepurador,
  eliminarSeleccionadasDepurador,
  eliminarTodasPendientesRefacciones,
  exportarDepuradorAExcel
};
