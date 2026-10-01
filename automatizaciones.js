/**
 * MÓDULO DE AUTOMATIZACIONES, REGLAS DE EVENTOS Y PLANTILLAS DE CORREO
 * Eurorep / SAPI - Vanilla Browser Bundle
 */
(function(global) {
  "use strict";

  const _safeGetJSON = (key, defaultVal) => {
    if (typeof global !== "undefined" && typeof global.safeGetJSON === "function") {
      return global.safeGetJSON(key, defaultVal);
    }
    if (typeof localStorage !== "undefined") {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultVal;
      } catch (e) {
        return defaultVal;
      }
    }
    return defaultVal;
  };

  const _notify = (msg, tipo = "info") => {
    if (typeof global !== "undefined" && typeof global.mostrarNotificacion === "function") {
      global.mostrarNotificacion(msg, tipo);
    } else {
      console.log("[" + tipo.toUpperCase() + "] " + msg);
    }
  };

  // ===== AUTOMACIONES Y PLANTILLAS =====
  
  // Datos iniciales / cargados de localStorage
  let defaultTemplates = [
    {
      id: "welcome",
      nombre: "Bienvenida y Activación de Cuenta",
      asunto: "¡Bienvenido a SAPI Postventa de Eurorep!",
      cuerpo: "Hola {{nombre_usuario}},\n\nTu cuenta en el Portal de Clientes de Eurorep ha sido activada con éxito.\n\nYa puedes acceder para consultar tus equipos, dar seguimiento a tus tickets y autorizar cotizaciones.\n\nAcceder al portal: {{link}}\n\nSaludos,\nEquipo de Postventa Eurorep"
    },
    {
      id: "new_quote",
      nombre: "Nueva Cotización SAP Disponible",
      asunto: "Cotización SAP Lista para Aprobación - Folio {{folio_ticket}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nHemos cargado la cotización correspondiente al ticket {{folio_ticket}} por un monto de {{monto_cotizacion}}.\n\nTe solicitamos ingresar al portal para revisar el PDF adjunto y aprobar o rechazar la propuesta comercial.\n\nEnlace del ticket: {{link}}\n\nSaludos,\nPostventa Eurorep"
    },
    {
      id: "os_completed",
      nombre: "Orden de Servicio Completada",
      asunto: "Reporte de Servicio de Campo Completado - OS {{folio_os}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nEl servicio técnico en campo para tu equipo {{marca_modelo}} (SN: {{serie}}) ha sido completado y firmado de conformidad.\n\nSe ha generado el reporte técnico oficial y se ha guardado en tu carpeta compartida de OneDrive.\n\nSaludos,\nServicio Técnico Eurorep"
    },
    {
      id: "new_comment",
      nombre: "Notificación de Comentario Nuevo",
      asunto: "Nuevo mensaje en Ticket {{folio_ticket}}",
      cuerpo: "Hola {{nombre_usuario}},\n\nSe ha registrado un nuevo comentario en el ticket {{folio_ticket}}:\n\n\"{{comentario}}\"\n\nResponder en el portal: {{link}}\n\nSaludos,\nSoporte Eurorep"
    },
    {
      id: "new_internal_ticket",
      nombre: "Notificación de Nuevo Ticket Registrado (Interno)",
      asunto: "Eurorep SAPI - Se ha registrado un nuevo Ticket: {{folio_ticket}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nQueremos informarte que nuestro equipo técnico interno ha registrado un nuevo ticket de servicio bajo tu cuenta:\n\nDetalles del Ticket:\n- Folio: {{folio_ticket}}\n- Estatus actual: {{estatus_ticket}}\n\nPuedes dar seguimiento a esta solicitud, agregar comentarios o adjuntar evidencias a través de nuestro portal de clientes.\n\nAcceder al ticket: {{link}}\n\nSaludos,\nEquipo de Postventa Eurorep"
    },
    {
      id: "ticket_created_by_client",
      nombre: "Confirmación de Recepción de Ticket - Cliente",
      asunto: "Confirmación de Recepción - Ticket {{folio_ticket}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nHemos recibido tu solicitud de servicio correctamente.\n\nDetalles del Ticket:\n- Folio: {{folio_ticket}}\n- Asunto/Falla: {{asunto}}\n- Estatus: {{estatus_ticket}}\n\nNuestro equipo técnico revisará tu reporte a la brevedad y se pondrá en contacto contigo.\n\nPuedes dar seguimiento a tu ticket aquí: {{link}}\n\nSaludos,\nEquipo de Postventa Eurorep"
    },
    {
      id: "service_scheduled",
      nombre: "Notificación de Servicio Programado",
      asunto: "Servicio Técnico Programado en Campo - Folio {{folio_os}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nTe informamos que se ha programado una visita técnica para atender tu equipo.\n\nDetalles del Servicio:\n- Folio OS: {{folio_os}}\n- Ticket asociado: {{folio_ticket}}\n- Fecha programada: {{fecha_programada}}\n- Técnico asignado: {{tecnico_asignado}}\n\nPor favor asegúrate de tener el equipo disponible en el sitio indicado.\n\nSaludos,\nServicio Técnico Eurorep"
    },
    {
      id: "quote_accepted_by_client",
      nombre: "Cotización SAP Aceptada por Cliente",
      asunto: "Cotización Aceptada - Ticket {{folio_ticket}}",
      cuerpo: "Hola {{nombre_cliente}},\n\nConfirmamos la recepción de la aprobación de la cotización para el ticket {{folio_ticket}}.\n\nDetalles:\n- Folio Ticket: {{folio_ticket}}\n- Estatus: Aceptada\n\nNuestro equipo procederá con la gestión de refacciones o programación del servicio correspondiente.\n\nPuedes consultar el ticket en el portal: {{link}}\n\nSaludos,\nEquipo de Postventa Eurorep"
    }
  ];
  
  let defaultRules = [
    {
      id: "rule_welcome",
      nombre: "Enviar correo de bienvenida al activar usuario",
      evento: "Activación de usuario en panel",
      plantillaId: "welcome",
      destinatario: "Usuario registrado",
      activo: true
    },
    {
      id: "rule_quote",
      nombre: "Notificar al cliente sobre cotización SAP",
      evento: "Carga de Cotización SAP en ticket",
      plantillaId: "new_quote",
      destinatario: "Contactos de la empresa",
      activo: true
    },
    {
      id: "rule_os",
      nombre: "Enviar reporte técnico PDF al finalizar servicio",
      evento: "Finalización y firma de Orden de Servicio",
      plantillaId: "os_completed",
      destinatario: "Contactos de la empresa + Técnico",
      activo: true
    },
    {
      id: "rule_comment",
      nombre: "Enviar notificación de nuevo comentario",
      evento: "Comentario guardado en chat del ticket",
      plantillaId: "new_comment",
      destinatario: "Contraparte del ticket (Cliente o Staff)",
      activo: true
    },
    {
      id: "rule_internal_ticket",
      nombre: "Notificar al cliente sobre ticket creado por staff",
      evento: "Nuevo ticket registrado por equipo interno",
      plantillaId: "new_internal_ticket",
      destinatario: "Contactos de la empresa",
      activo: true
    },
    {
      id: "rule_client_ticket",
      nombre: "Confirmar recepción de ticket creado por el cliente",
      evento: "Nuevo ticket creado por el cliente",
      plantillaId: "ticket_created_by_client",
      destinatario: "Contactos de la empresa",
      activo: true
    },
    {
      id: "rule_service_scheduled",
      nombre: "Notificar al cliente cuando se programa visita técnica",
      evento: "Visita técnica en campo programada",
      plantillaId: "service_scheduled",
      destinatario: "Contactos de la empresa",
      activo: true
    },
    {
      id: "rule_quote_accepted",
      nombre: "Notificar aprobación de cotización SAP",
      evento: "Cotización SAP aceptada por el cliente",
      plantillaId: "quote_accepted_by_client",
      destinatario: "Contactos de la empresa",
      activo: true
    }
  ];
  
  // Inicializar memoria intermedia con valores por defecto
  let emailTemplates = [...defaultTemplates];
  let automationRules = [...defaultRules];
  
  // Guardar copia local en localStorage como respaldo/fallback
  function saveTemplatesToLocal() {
    localStorage.setItem('sapi_email_templates', JSON.stringify(emailTemplates));
  }
  function saveRulesToLocal() {
    localStorage.setItem('sapi_automation_rules', JSON.stringify(automationRules));
  }
  
  // Saber si la base de datos de Supabase tiene activada la sincronización
  function isCloudSyncActive() {
    return window.supabaseClient && !document.getElementById('supa-table-warning');
  };
  
  // Mostrar alerta visual con SQL si faltan tablas
  function mostrarAdvertenciaTablasNube() {
    const container = document.getElementById('portal-automatizaciones-subcontent');
    if (!container) return;
    if (document.getElementById('supa-table-warning')) return;
    
    const warningDiv = document.createElement('div');
    warningDiv.id = 'supa-table-warning';
    warningDiv.style = 'background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:1.25rem; margin-bottom:1.5rem; display:flex; flex-direction:column; gap:0.5rem; font-family:inherit;';
    
    warningDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; color:#ef4444; font-weight:700; font-size:0.85rem;">
        <span style="font-size:1.1rem; line-height:1;">⚠️</span> 
        <span>Persistencia en la Nube Inactiva (Faltan Tablas en Supabase)</span>
      </div>
      <p style="margin:0; font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
        Para que todos los colaboradores compartan las mismas plantillas y reglas en tiempo real, ingresa al <strong>SQL Editor</strong> de tu panel de Supabase y ejecuta el siguiente script:
      </p>
      <pre style="margin:0.25rem 0 0 0; background:var(--bg-hover, #f3f4f6); border:1px solid var(--border); border-radius:6px; padding:0.75rem; font-family:monospace; font-size:0.72rem; color:var(--text-primary); overflow-x:auto; user-select:all; line-height:1.3; max-height:220px; overflow-y:auto;">
  -- 1. Crear tabla de plantillas de correo
  CREATE TABLE IF NOT EXISTS sapi_email_templates (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    asunto TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- 2. Crear tabla de reglas de automatización
  CREATE TABLE IF NOT EXISTS sapi_automation_rules (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    evento TEXT NOT NULL,
    "plantillaId" TEXT REFERENCES sapi_email_templates(id) ON DELETE CASCADE,
    destinatario TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- 3. Habilitar seguridad de fila (RLS)
  ALTER TABLE sapi_email_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sapi_automation_rules ENABLE ROW LEVEL SECURITY;
  
  -- 4. Crear políticas públicas/autenticadas
  CREATE POLICY "Acceso total a autenticados" ON sapi_email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Acceso total a autenticados" ON sapi_automation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
      </pre>
    `;
    
    container.insertBefore(warningDiv, container.firstChild);
  }
  
  // Cargar configuraciones de Supabase o fallback a localStorage
  async function cargarConfiguracionesNube() {
    const safeRender = () => {
      if (typeof window.renderAutomationRules === 'function') window.renderAutomationRules();
      else if (typeof renderAutomationRules === 'function') renderAutomationRules();
      if (typeof window.renderEmailTemplates === 'function') window.renderEmailTemplates();
      else if (typeof renderEmailTemplates === 'function') renderEmailTemplates();
    };
  
    if (!window.supabaseClient) {
      emailTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
      automationRules = _safeGetJSON('sapi_automation_rules', defaultRules);
      safeRender();
      return;
    }
    
    // Si no hay sesión autenticada activa en Supabase, usar persistencia local sin disparar errores 401
    try {
      const sessionRes = await window.supabaseClient.auth.getSession().catch(() => null);
      if (!sessionRes || !sessionRes.data || !sessionRes.data.session) {
        emailTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
        automationRules = _safeGetJSON('sapi_automation_rules', defaultRules);
        safeRender();
        return;
      }
    } catch (eSes) {
      emailTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
      automationRules = _safeGetJSON('sapi_automation_rules', defaultRules);
      safeRender();
      return;
    }
    
    try {
      // 1. Cargar plantillas de Supabase
      const { data: templatesData, error: tErr } = await window.supabaseClient
        .from('sapi_email_templates')
        .select('*');
        
      if (tErr) {
        if (tErr.code === 'P0001' || tErr.message.includes('relation') || tErr.message.includes('does not exist')) {
          throw new Error('TABLES_NOT_CREATED');
        }
        throw tErr;
      }
      
      // 2. Cargar reglas de Supabase
      const { data: rulesData, error: rErr } = await window.supabaseClient
        .from('sapi_automation_rules')
        .select('*');
        
      if (rErr) throw rErr;
      
      // Si la base de datos está vacía, inicializarla con los valores por defecto
      if (!templatesData || templatesData.length === 0) {
        console.log('[Automation] Inicializando Supabase con plantillas por defecto...');
        await window.supabaseClient.from('sapi_email_templates').insert(defaultTemplates);
        emailTemplates = [...defaultTemplates];
      } else {
        emailTemplates = templatesData;
      }
      
      if (!rulesData || rulesData.length === 0) {
        console.log('[Automation] Inicializando Supabase con reglas por defecto...');
        await window.supabaseClient.from('sapi_automation_rules').insert(defaultRules);
        automationRules = [...defaultRules];
      } else {
        automationRules = rulesData;
      }
  
      console.log('[Automation] Datos cargados correctamente desde Supabase');
      
    } catch (err) {
      if (err.message === 'TABLES_NOT_CREATED') {
        console.warn('[Automation] Faltan tablas en la nube. Usando persistencia local (localStorage).');
        emailTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
        automationRules = _safeGetJSON('sapi_automation_rules', defaultRules);
        mostrarAdvertenciaTablasNube();
      } else {
        console.error('[Automation] Error al sincronizar con la nube:', err);
        emailTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
        automationRules = _safeGetJSON('sapi_automation_rules', defaultRules);
      }
    }
    
    if (typeof renderAutomationRules === 'function') renderAutomationRules();
    else if (typeof window.renderAutomationRules === 'function') window.renderAutomationRules();
  
    if (typeof renderEmailTemplates === 'function') renderEmailTemplates();
    else if (typeof window.renderEmailTemplates === 'function') window.renderEmailTemplates();
  };
  
  // Navegación de Sub-Vistas del Portal
  function setPortalSubView(viewId) {
    const btnUsr = document.getElementById('btn-subtab-usuarios');
    const btnAuto = document.getElementById('btn-subtab-automatizaciones');
    const cntUsr = document.getElementById('portal-usuarios-subcontent');
    const cntAuto = document.getElementById('portal-automatizaciones-subcontent');
    
    if (!btnUsr || !btnAuto || !cntUsr || !cntAuto) return;
    
    const userRole = currentSession?.viewMode || currentSession?.rol || '';
    const isSuperOrAdmin = ['superadmin', 'admin'].includes(userRole);
    
    if (viewId === 'automatizaciones' && !isSuperOrAdmin) {
      alert('Acceso denegado: Solo los administradores y superadministradores pueden configurar automatizaciones.');
      return;
    }
    
    if (viewId === 'usuarios') {
      btnUsr.classList.add('active');
      btnUsr.style.background = 'var(--accent-light)';
      btnUsr.style.borderColor = 'var(--accent)';
      btnUsr.style.color = 'var(--accent)';
      
      btnAuto.classList.remove('active');
      btnAuto.style.background = 'var(--bg-card)';
      btnAuto.style.borderColor = 'var(--border)';
      btnAuto.style.color = 'var(--text-primary)';
      
      cntUsr.style.display = 'block';
      cntAuto.style.display = 'none';
      renderPortalUsuariosList();
    } else {
      btnAuto.classList.add('active');
      btnAuto.style.background = 'var(--accent-light)';
      btnAuto.style.borderColor = 'var(--accent)';
      btnAuto.style.color = 'var(--accent)';
      
      btnUsr.classList.remove('active');
      btnUsr.style.background = 'var(--bg-card)';
      btnUsr.style.borderColor = 'var(--border)';
      btnUsr.style.color = 'var(--text-primary)';
      
      cntUsr.style.display = 'none';
      cntAuto.style.display = 'block';
      
      renderAutomationRules();
      renderEmailTemplates();
    }
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };
  
  // Renderizar Reglas
  function renderAutomationRules() {
    const list = document.getElementById('automation-rules-list');
    if (!list) return;
    
    if (automationRules.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem; background:var(--bg-hover); border-radius:8px;">No hay reglas de automatización creadas.</div>`;
      return;
    }
    
    list.innerHTML = automationRules.map(r => {
      const template = emailTemplates.find(t => t.id === r.plantillaId);
      const templateName = template ? template.nombre : 'Ninguna';
      
      return `
        <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); margin-bottom:0.15rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <span>${r.nombre}</span>
              <span style="font-size:0.65rem; font-weight:600; padding:0.1rem 0.35rem; border-radius:4px; background:rgba(232, 130, 12, 0.08); color:var(--orange); border:1px solid rgba(232, 130, 12, 0.15);">
                ${r.evento}
              </span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Envia plantilla: <span style="font-weight:500; color:var(--text-secondary); font-style:italic;">${templateName}</span> | Destinatario: <span style="font-weight:500;">${r.destinatario}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
            <label class="switch-toggle" style="position:relative; display:inline-block; width:34px; height:20px; margin:0;">
              <input type="checkbox" ${r.activo ? 'checked' : ''} onchange="toggleReglaActiva('${r.id}')" style="opacity:0; width:0; height:0;">
              <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:${r.activo ? 'var(--accent)' : '#ccc'}; transition:.2s; border-radius:20px;">
                <span style="position:absolute; content:''; height:14px; width:14px; left:3px; bottom:3px; background-color:white; transition:.2s; border-radius:50%; transform:${r.activo ? 'translateX(14px)' : 'none'};"></span>
              </span>
            </label>
            <button class="action-btn" onclick="abrirModalAutoRegla('${r.id}')" title="Editar Regla" style="padding:0.3rem 0.5rem; border:1px solid var(--border); border-radius:4px; display:inline-flex; align-items:center; background:var(--bg-card); cursor:pointer;"><i data-lucide="pencil" style="width:14px;height:14px;color:var(--text-secondary);"></i></button>
            <button class="action-btn del" onclick="eliminarAutoRegla('${r.id}')" title="Eliminar Regla" style="padding:0.3rem 0.5rem; border:1px solid var(--border); border-radius:4px; display:inline-flex; align-items:center; background:var(--bg-card); cursor:pointer;"><i data-lucide="trash-2" style="width:14px;height:14px;color:var(--red);"></i></button>
          </div>
        </div>
      `;
    }).join('');
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };
  
  // Renderizar Plantillas (Machotes)
  function renderEmailTemplates() {
    const list = document.getElementById('email-templates-list');
    if (!list) return;
    
    if (emailTemplates.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem; background:var(--bg-hover); border-radius:8px;">No hay plantillas de correo creadas.</div>`;
      return;
    }
    
    list.innerHTML = emailTemplates.map(t => {
      return `
        <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:1rem;">
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); margin-bottom:0.15rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${t.nombre}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t.asunto}">
              Asunto: ${t.asunto}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
            <button class="action-btn" onclick="abrirModalAutoPlantilla('${t.id}')" title="Editar Plantilla" style="padding:0.3rem 0.5rem; border:1px solid var(--border); border-radius:4px; display:inline-flex; align-items:center; background:var(--bg-card); cursor:pointer;"><i data-lucide="pencil" style="width:14px;height:14px;color:var(--text-secondary);"></i></button>
            <button class="action-btn del" onclick="eliminarAutoPlantilla('${t.id}')" title="Eliminar Plantilla" style="padding:0.3rem 0.5rem; border:1px solid var(--border); border-radius:4px; display:inline-flex; align-items:center; background:var(--bg-card); cursor:pointer;"><i data-lucide="trash-2" style="width:14px;height:14px;color:var(--red);"></i></button>
          </div>
        </div>
      `;
    }).join('');
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };
  
  // Toggle Regla Activa
  function toggleReglaActiva(id) {
    const match = automationRules.find(r => r.id === id);
    if (match) {
      match.activo = !match.activo;
      saveRulesToLocal();
      renderAutomationRules();
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Regla de automatización actualizada', 'success');
      }
    }
  };
  
  // --- Modals Plantilla ---
  function abrirModalAutoPlantilla(id = '') {
    const overlay = document.getElementById('modal-auto-plantilla-overlay');
    const inner = document.getElementById('modal-auto-plantilla-inner');
    const title = document.getElementById('auto-plantilla-modal-title');
    
    if (!overlay || !inner) return;
    
    document.getElementById('form-auto-plantilla').reset();
    document.getElementById('ap-id').value = id;
    
    if (id) {
      title.textContent = 'Editar Plantilla de Correo';
      const match = emailTemplates.find(t => t.id === id);
      if (match) {
        document.getElementById('ap-nombre').value = match.nombre;
        document.getElementById('ap-asunto').value = match.asunto;
        document.getElementById('ap-cuerpo').value = match.cuerpo;
      }
    } else {
      title.textContent = 'Crear Nueva Plantilla';
    }
    
    // Update live preview initial state
    actualizarVistaPreviaEmail();
    
    overlay.style.display = 'flex';
    setTimeout(() => {
      overlay.style.opacity = '1';
      inner.style.opacity = '1';
      inner.style.transform = 'translateY(0)';
    }, 50);
  };
  
  function cerrarModalAutoPlantilla() {
    const overlay = document.getElementById('modal-auto-plantilla-overlay');
    const inner = document.getElementById('modal-auto-plantilla-inner');
    if (!overlay || !inner) return;
    
    overlay.style.opacity = '0';
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(20px)';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
  };
  
  function insertarMergeTag(tag) {
    const txt = document.getElementById('ap-cuerpo');
    if (!txt) return;
    
    const start = txt.selectionStart;
    const end = txt.selectionEnd;
    const currentVal = txt.value;
    txt.value = currentVal.substring(0, start) + tag + currentVal.substring(end);
    txt.focus();
    txt.selectionStart = txt.selectionEnd = start + tag.length;
    
    actualizarVistaPreviaEmail();
  };
  
  async function guardarAutoPlantilla(e) {
    e.preventDefault();
    const id = document.getElementById('ap-id').value;
    const nombre = document.getElementById('ap-nombre').value.trim();
    const asunto = document.getElementById('ap-asunto').value.trim();
    const cuerpo = document.getElementById('ap-cuerpo').value.trim();
    
    const targetId = id || 'template_' + Date.now();
    const item = { id: targetId, nombre, asunto, cuerpo };
    
    if (window.isCloudSyncActive()) {
      try {
        const { error } = await window.supabaseClient
          .from('sapi_email_templates')
          .upsert(item);
        if (error) throw error;
      } catch (dbErr) {
        console.error('[Automation] Error al guardar plantilla en la nube:', dbErr);
        if (typeof mostrarNotificacion === 'function') {
          mostrarNotificacion('Error al guardar en la nube. Guardando localmente...', 'warning');
        }
      }
    }
    
    const idx = emailTemplates.findIndex(t => t.id === targetId);
    if (idx !== -1) {
      emailTemplates[idx] = item;
    } else {
      emailTemplates.push(item);
    }
    
    saveTemplatesToLocal();
    cerrarModalAutoPlantilla();
    renderEmailTemplates();
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Plantilla de correo guardada con éxito', 'success');
    }
  };
  
  async function eliminarAutoPlantilla(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla de correo?')) return;
    
    if (window.isCloudSyncActive()) {
      try {
        const { error } = await window.supabaseClient
          .from('sapi_email_templates')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (dbErr) {
        console.error('[Automation] Error al eliminar plantilla de la nube:', dbErr);
      }
    }
    
    emailTemplates = emailTemplates.filter(t => t.id !== id);
    saveTemplatesToLocal();
    renderEmailTemplates();
  };
  
  // --- Modals Regla ---
  function abrirModalAutoRegla(id = '') {
    const overlay = document.getElementById('modal-auto-regla-overlay');
    const inner = document.getElementById('modal-auto-regla-inner');
    const title = document.getElementById('auto-regla-modal-title');
    const comboPlantilla = document.getElementById('ar-plantilla');
    
    if (!overlay || !inner || !comboPlantilla) return;
    
    // Llenar combo de plantillas
    comboPlantilla.innerHTML = emailTemplates.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    
    document.getElementById('form-auto-regla').reset();
    document.getElementById('ar-id').value = id;
    document.getElementById('ar-activo').checked = true;
    
    if (id) {
      title.textContent = 'Editar Regla de Automatización';
      const match = automationRules.find(r => r.id === id);
      if (match) {
        document.getElementById('ar-nombre').value = match.nombre;
        document.getElementById('ar-evento').value = match.evento;
        document.getElementById('ar-plantilla').value = match.plantillaId;
        document.getElementById('ar-destinatario').value = match.destinatario;
        document.getElementById('ar-activo').checked = match.activo;
      }
    } else {
      title.textContent = 'Crear Nueva Regla';
    }
    
    overlay.style.display = 'flex';
    setTimeout(() => {
      overlay.style.opacity = '1';
      inner.style.opacity = '1';
      inner.style.transform = 'translateY(0)';
    }, 50);
  };
  
  function cerrarModalAutoRegla() {
    const overlay = document.getElementById('modal-auto-regla-overlay');
    const inner = document.getElementById('modal-auto-regla-inner');
    if (!overlay || !inner) return;
    
    overlay.style.opacity = '0';
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(20px)';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
  };
  
  async function guardarAutoRegla(e) {
    e.preventDefault();
    const id = document.getElementById('ar-id').value;
    const nombre = document.getElementById('ar-nombre').value.trim();
    const evento = document.getElementById('ar-evento').value;
    const plantillaId = document.getElementById('ar-plantilla').value;
    const destinatario = document.getElementById('ar-destinatario').value;
    const activo = document.getElementById('ar-activo').checked;
    
    const targetId = id || 'rule_' + Date.now();
    const item = { id: targetId, nombre, evento, plantillaId, destinatario, activo };
    
    if (window.isCloudSyncActive()) {
      try {
        const { error } = await window.supabaseClient
          .from('sapi_automation_rules')
          .upsert(item);
        if (error) throw error;
      } catch (dbErr) {
        console.error('[Automation] Error al guardar regla en la nube:', dbErr);
        if (typeof mostrarNotificacion === 'function') {
          mostrarNotificacion('Error al guardar en la nube. Guardando localmente...', 'warning');
        }
      }
    }
    
    const idx = automationRules.findIndex(r => r.id === targetId);
    if (idx !== -1) {
      automationRules[idx] = item;
    } else {
      automationRules.push(item);
    }
    
    saveRulesToLocal();
    cerrarModalAutoRegla();
    renderAutomationRules();
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Regla de automatización guardada con éxito', 'success');
    }
  };
  
  async function eliminarAutoRegla(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta regla de automatización?')) return;
    
    if (window.isCloudSyncActive()) {
      try {
        const { error } = await window.supabaseClient
          .from('sapi_automation_rules')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (dbErr) {
        console.error('[Automation] Error al eliminar regla de la nube:', dbErr);
      }
    }
    
    automationRules = automationRules.filter(r => r.id !== id);
    saveRulesToLocal();
    renderAutomationRules();
  };
  
  function obtenerHtmlPlantillaProfesional(cuerpoEmail) {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://eurorep.mx';
  const logoUrl = origin + '/logo_transparent.png';
    const hasSignature = (cuerpoEmail || '').includes('eurorep-signature-block');
    const signatureHtml = (typeof window !== 'undefined' && typeof window.obtenerHtmlFirmaOficialEurorep === 'function') ? window.obtenerHtmlFirmaOficialEurorep() : '';
    const finalBody = hasSignature ? cuerpoEmail : (cuerpoEmail + '<br/>' + signatureHtml);
  
    return `
      <div style="background-color: #f1f5f9; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Header con Logo -->
          <div style="padding: 18px 24px; background-color: #ffffff; border-bottom: 4px solid #e8820c; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <img src="${logoUrl}" alt="Eurorep Logo" style="height: 38px; width: auto; object-fit: contain; display: block;" />
            <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">SAPI Postventa</span>
          </div>
          
          <!-- Contenido principal -->
          <div style="padding: 30px 24px; font-size: 14.5px; line-height: 1.6; color: #334155;">
            ${finalBody}
          </div>
          
          <!-- Footer -->
          <div style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.5;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">Euro Representaciones S.A. de C.V.</p>
            <p style="margin: 0 0 12px 0;">Servicio Técnico Autorizado, Refacciones y Renta de Maquinaria</p>
            <div style="margin-bottom: 12px;">
              <a href="${origin}/cliente" target="_blank" style="color: #e8820c; text-decoration: none; font-weight: 600; margin: 0 8px;">Portal de Clientes</a> | 
              <a href="https://eurorep.mx" target="_blank" style="color: #e8820c; text-decoration: none; font-weight: 600; margin: 0 8px;">Sitio Web Oficial</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
            <p style="margin: 0; font-size: 10.5px; color: #94a3b8;">
              Este es un correo electrónico automático generado por el sistema SAPI Postventa.<br />
              Por favor no respondas directamente a este mensaje. Si requieres asistencia, contáctanos a soporte@eurorep.mx
            </p>
          </div>
        </div>
      </div>
    `;
  };
  
  function actualizarVistaPreviaEmail() {
    const asuntoInput = document.getElementById('ap-asunto')?.value || '';
    const cuerpoInput = document.getElementById('ap-cuerpo')?.value || '';
    
    const previewAsunto = document.getElementById('email-preview-asunto');
    const previewCuerpo = document.getElementById('email-preview-cuerpo');
    
    if (!previewAsunto || !previewCuerpo) return;
    
    // Mock data replacement dictionary
    const mockData = {
      '{{nombre_usuario}}': '<strong>Ing. Alejandro Gómez</strong>',
      '{{nombre_cliente}}': '<strong>ICA CONSTRUCTORA, S.A. DE C.V.</strong>',
      '{{folio_ticket}}': '<strong style="color:var(--accent);">TKT-26045-A</strong>',
      '{{monto_cotizacion}}': '<strong style="color:#10b981;">$14,580.00 MXN</strong>',
      '{{folio_os}}': '<strong>OS-26045</strong>',
      '{{marca_modelo}}': '<strong>GENIE GS-1930</strong>',
      '{{serie}}': '<strong>GS3015A-12345</strong>',
      '{{link}}': '<a href="#" onclick="return false;" style="display:inline-block; padding:0.5rem 1rem; background:var(--accent); color:white; text-decoration:none; border-radius:6px; font-weight:600; font-size:0.8rem; margin:0.5rem 0;">Ir al Portal de Clientes</a>',
      '{{comentario}}': '<em style="color:var(--text-secondary); background:var(--bg-hover); padding:0.5rem; display:block; border-left:3px solid var(--accent); margin:0.5rem 0;">"Estimados, favor de confirmar si las refacciones ya vienen en camino."</em>',
      '{{estatus_ticket}}': '<strong style="color:var(--orange);">En Proceso</strong>',
      '{{fecha_visita}}': '<strong>28 de Agosto, 2026 a las 10:00 AM</strong>',
      '{{tecnico_nombre}}': '<strong>Ing. Luis Gress</strong>',
      '{{maquinaria}}': '<strong>GENIE GS-1930 (Serie: GS3015A-12345)</strong>',
      '{{categoria_ticket}}': '<strong>Soporte Técnico / Correctivo</strong>',
      '{{solicitante}}': '<strong>Ing. Alejandro Gómez</strong>',
      '{{descripcion_ticket}}': '<em style="color:var(--text-secondary); display:block; padding-left:0.5rem; border-left:2px solid var(--border);">"La plataforma no enciende, marca código de error OL en el control."</em>',
      '{{asunto_ticket}}': '<strong>Falla de encendido en plataforma GS-1930</strong>'
    };
    
    let renderedAsunto = asuntoInput;
    let renderedCuerpo = cuerpoInput;
  
    // Replace mock data
    for (const [key, value] of Object.entries(mockData)) {
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedKey, 'g');
      renderedAsunto = renderedAsunto.replace(regex, key.replace('{{', '').replace('}}', '').toUpperCase());
      renderedCuerpo = renderedCuerpo.replace(regex, value);
    }
    
    // Convert newlines to HTML breaks
    renderedCuerpo = renderedCuerpo.replace(/\n/g, '<br>');
    
    previewAsunto.textContent = renderedAsunto || '(Sin Asunto)';
    previewCuerpo.innerHTML = window.obtenerHtmlPlantillaProfesional(
      renderedCuerpo || '<span style="color:var(--text-muted); font-style:italic;">Escribe el cuerpo del correo en el editor para ver la vista previa...</span>'
    );
  };
  
  function formatText(action) {
    const txt = document.getElementById('ap-cuerpo');
    if (!txt) return;
    
    const start = txt.selectionStart;
    const end = txt.selectionEnd;
    const selectedText = txt.value.substring(start, end);
    let replacement = '';
    
    switch(action) {
      case 'bold':
        replacement = `<strong>${selectedText || 'texto en negrita'}</strong>`;
        break;
      case 'italic':
        replacement = `<em>${selectedText || 'texto en cursiva'}</em>`;
        break;
      case 'underline':
        replacement = `<u style="text-decoration:underline;">${selectedText || 'texto subrayado'}</u>`;
        break;
      case 'h2':
        replacement = `<h2 style="font-size:1.25rem; font-weight:700; color:var(--text-primary); margin-top:1rem; margin-bottom:0.5rem;">${selectedText || 'Título'}</h2>`;
        break;
      case 'h3':
        replacement = `<h3 style="font-size:1.1rem; font-weight:600; color:var(--text-primary); margin-top:0.75rem; margin-bottom:0.35rem;">${selectedText || 'Subtítulo'}</h3>`;
        break;
      case 'p':
        replacement = `<p style="margin-bottom:0.75rem;">${selectedText || 'Párrafo de texto...'}</p>`;
        break;
      case 'ul':
        replacement = `<ul style="padding-left:1.25rem; margin-bottom:0.75rem; list-style-type:disc;">\n  <li>${selectedText || 'Elemento 1'}</li>\n  <li>Elemento 2</li>\n</ul>`;
        break;
      case 'link':
        window.abrirModalInsertarLink(selectedText, (url, text) => {
          const replacement = `<a href="${url}" target="_blank" style="color:var(--accent); text-decoration:underline; font-weight:600;">${text}</a>`;
          const currentVal = txt.value;
          txt.value = currentVal.substring(0, start) + replacement + currentVal.substring(end);
          txt.focus();
          actualizarVistaPreviaEmail();
        });
        return;
      case 'image':
        const imageUrl = prompt('Ingresa la URL de la imagen:', 'https://');
        if (imageUrl === null) return;
        replacement = `<img src="${imageUrl}" alt="Imagen" style="max-width:100%; height:auto; border-radius:6px; margin:0.5rem 0;" />`;
        break;
    }
    
    const currentVal = txt.value;
    txt.value = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    txt.focus();
    txt.selectionStart = txt.selectionEnd = start + replacement.length;
    
    actualizarVistaPreviaEmail();
  };
  
  async function ejecutarAutomatizacion(evento, contexto) {
    try {
      const savedRules = _safeGetJSON('sapi_automation_rules', defaultRules);
      const rules = [...savedRules];
      if (Array.isArray(defaultRules)) {
        defaultRules.forEach(dr => {
          if (!rules.some(r => r.id === dr.id || r.evento === dr.evento)) {
            rules.push(dr);
          }
        });
      }
  
      const savedTemplates = _safeGetJSON('sapi_email_templates', defaultTemplates);
      const templates = [...savedTemplates];
      if (Array.isArray(defaultTemplates)) {
        defaultTemplates.forEach(dt => {
          if (!templates.some(t => t.id === dt.id)) {
            templates.push(dt);
          }
        });
      }
      
      // Find active rules for this trigger event
      const activeRules = rules.filter(r => r.evento === evento && r.activo === true);
      if (activeRules.length === 0) return;
      
      console.log(`[Automation] Ejecutando ${activeRules.length} reglas activas para el evento "${evento}"...`);
      
      // Get authorization token
      let token = '';
      if (window.supabaseClient && window.supabaseClient.auth) {
        try {
          const { data: sessionData } = await window.supabaseClient.auth.getSession();
          token = sessionData?.session?.access_token || '';
        } catch (authErr) {
          console.warn('Could not read Supabase session token:', authErr);
        }
      }
      
      for (const rule of activeRules) {
        const template = templates.find(t => t.id === rule.plantillaId);
        if (!template) {
          console.warn(`[Automation] No se encontró la plantilla ${rule.plantillaId} para la regla ${rule.nombre}`);
          continue;
        }
        
        // Determine recipient email
        let toEmail = contexto.email || contexto.destinatario || '';
        if (!toEmail) {
          console.warn('[Automation] No se proporcionó correo del destinatario');
          continue;
        }
        
        // Interpolate Asunto
        let subject = template.asunto;
        // Interpolate Cuerpo
        let body = template.cuerpo;
        
        const placeholders = {
          '{{nombre_usuario}}': contexto.nombre_usuario || contexto.nombre || 'Usuario',
          '{{nombre_cliente}}': contexto.nombre_cliente || contexto.cliente || 'Cliente',
          '{{folio_ticket}}': contexto.folio_ticket || contexto.ticket || '',
          '{{monto_cotizacion}}': contexto.monto_cotizacion ? window.formatMontoConComas(contexto.monto_cotizacion) : '',
          '{{folio_os}}': contexto.folio_os || '',
          '{{marca_modelo}}': contexto.marca_modelo || '',
          '{{serie}}': contexto.serie || '',
          '{{link}}': contexto.link || ((typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://eurorep.mx') + '/cliente',
          '{{comentario}}': contexto.comentario || '',
          '{{estatus_ticket}}': contexto.estatus_ticket || '',
          '{{fecha_visita}}': contexto.fecha_visita || contexto.fecha_programada || '',
          '{{fecha_programada}}': contexto.fecha_programada || contexto.fecha_visita || '',
          '{{tecnico_nombre}}': contexto.tecnico_nombre || contexto.tecnico_asignado || '',
          '{{tecnico_asignado}}': contexto.tecnico_asignado || contexto.tecnico_nombre || '',
          '{{maquinaria}}': contexto.maquinaria || '',
          '{{categoria_ticket}}': contexto.categoria_ticket || '',
          '{{solicitante}}': contexto.solicitante || '',
          '{{descripcion_ticket}}': contexto.descripcion_ticket || '',
          '{{asunto_ticket}}': contexto.asunto_ticket || contexto.asunto || '',
          '{{asunto}}': contexto.asunto || contexto.asunto_ticket || ''
        };
        
        for (const [key, value] of Object.entries(placeholders)) {
          const targetStr = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(targetStr, 'g');
          subject = subject.replace(regex, value);
          body = body.replace(regex, value);
        }
        
        // Convert body breaks
        body = body.replace(/\n/g, '<br>');
        
        const payload = {
          to: toEmail,
          subject: subject,
          htmlBody: window.obtenerHtmlPlantillaProfesional(body)
        };
        
        // Dispatch email request
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Sapi-Client-Token': 'SapiSecuredClientToken'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          console.log(`[Automation] Correo enviado con éxito para la regla "${rule.nombre}" a ${toEmail}`);
        } else {
          const errJson = await response.json().catch(() => ({}));
          console.error(`[Automation] Error enviando correo para la regla "${rule.nombre}":`, errJson);
        }
  
        if (typeof window.registrarLogEmail === 'function') {
          window.registrarLogEmail({
            id: 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            de: 'Ptalctes@eurorep.mx',
            para: toEmail,
            cliente: contexto.nombre_cliente || contexto.cliente || 'Cliente',
            asunto: subject,
            cuerpo: body,
            htmlBody: payload.htmlBody,
            fecha: new Date().toISOString(),
            evento: evento || 'Automatización',
            regla: rule ? rule.nombre : 'Regla de Automatización',
            estatus: response.ok ? 'Enviado' : 'Fallido',
            folio_ticket: contexto.folio_ticket || '',
            folio_os: contexto.folio_os || ''
          });
        }
      }
    } catch (err) {
      console.error('[Automation] Error general al ejecutar automatización:', err);
    }
  };

  // Asignaciones globales
  global.isCloudSyncActive = isCloudSyncActive;
  global.cargarConfiguracionesNube = cargarConfiguracionesNube;
  global.setPortalSubView = setPortalSubView;
  global.renderAutomationRules = renderAutomationRules;
  global.renderEmailTemplates = renderEmailTemplates;
  global.toggleReglaActiva = toggleReglaActiva;
  global.abrirModalAutoPlantilla = abrirModalAutoPlantilla;
  global.cerrarModalAutoPlantilla = cerrarModalAutoPlantilla;
  global.insertarMergeTag = insertarMergeTag;
  global.guardarAutoPlantilla = guardarAutoPlantilla;
  global.eliminarAutoPlantilla = eliminarAutoPlantilla;
  global.abrirModalAutoRegla = abrirModalAutoRegla;
  global.cerrarModalAutoRegla = cerrarModalAutoRegla;
  global.guardarAutoRegla = guardarAutoRegla;
  global.eliminarAutoRegla = eliminarAutoRegla;
  global.obtenerHtmlPlantillaProfesional = obtenerHtmlPlantillaProfesional;
  global.actualizarVistaPreviaEmail = actualizarVistaPreviaEmail;
  global.formatText = formatText;
  global.ejecutarAutomatizacion = ejecutarAutomatizacion;

})(typeof window !== "undefined" ? window : this);
