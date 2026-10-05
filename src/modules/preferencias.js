/**
 * Eurorep SAPI - Módulo de Preferencias, Configuración y Herramientas del Sistema
 * Archivo: src/modules/preferencias.js
 *
 * Contiene:
 * 1. Carga y persistencia de configuración general de la empresa y OneDrive
 * 2. Redimensionamiento dinámico de columnas de tablas (.data-table)
 * 3. Flujo de recuperación y actualización de contraseña (Auth Recovery)
 * 4. Modal de Diagrama de Flujo Interactivo con Zoom y Filtros de Ruta
 */

import { safeGetJSON } from '../utils.js';

let currentDiagramZoom = 1;

function safeMostrarNotificacion(msg, tipo) {
  if (typeof mostrarNotificacion === 'function') mostrarNotificacion(msg, tipo);
  else if (typeof window !== 'undefined' && typeof window.mostrarNotificacion === 'function') window.mostrarNotificacion(msg, tipo);
}

function getConfigData() {
  if (typeof window !== 'undefined' && window.configData) return window.configData;
  if (typeof configData !== 'undefined') return configData;
  return {};
}

function setConfigData(data) {
  if (typeof window !== 'undefined') window.configData = data;
}

// ─── 1. CONFIGURACIÓN GENERAL & ONEDRIVE ──────────────────────────────────────

function cargarConfig() {
  if (typeof document === 'undefined') return;

  const configData = getConfigData();
  if (configData.empresa && document.getElementById('cfg-empresa')) document.getElementById('cfg-empresa').value = configData.empresa;
  if (configData.rfc && document.getElementById('cfg-rfc')) document.getElementById('cfg-rfc').value = configData.rfc;
  if (configData.tel && document.getElementById('cfg-tel')) document.getElementById('cfg-tel').value = configData.tel;
  if (configData.email && document.getElementById('cfg-email')) document.getElementById('cfg-email').value = configData.email;
  if (configData.direccion && document.getElementById('cfg-direccion')) document.getElementById('cfg-direccion').value = configData.direccion;
  if (configData.queryMaquinaria && document.getElementById('cfg-query-maquinaria')) document.getElementById('cfg-query-maquinaria').value = configData.queryMaquinaria;
  if (configData.querySitios && document.getElementById('cfg-query-sitios')) document.getElementById('cfg-query-sitios').value = configData.querySitios;
  if (configData.queryOrdenes && document.getElementById('cfg-query-ordenes')) document.getElementById('cfg-query-ordenes').value = configData.queryOrdenes;
  if (configData.queryRefacciones && document.getElementById('cfg-query-refacciones')) document.getElementById('cfg-query-refacciones').value = configData.queryRefacciones;

  const dmToggle = document.getElementById('cfg-darkmode');
  if (dmToggle) {
    dmToggle.checked = localStorage.getItem('eurorep_darkmode') !== 'false';
    dmToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.remove('light-mode');
        localStorage.setItem('eurorep_darkmode', 'true');
      } else {
        document.body.classList.add('light-mode');
        localStorage.setItem('eurorep_darkmode', 'false');
      }
    });
  }

  // Cargar configuración de OneDrive
  const odClientId = configData.onedriveClientId || 'MOCK';
  const odForceMock = configData.onedriveForceMock !== false;
  const odFolderId = configData.onedriveFolderId || '';
  const odFolderConciliadosId = configData.onedriveFolderConciliadosId || '';
  
  const inputOdClientId = document.getElementById('cfg-onedrive-client-id');
  const inputOdForceMock = document.getElementById('cfg-onedrive-force-mock');
  const inputOdFolderId = document.getElementById('cfg-onedrive-folder-id');
  const inputOdFolderConciliadosId = document.getElementById('cfg-onedrive-folder-conciliados-id');
  
  if (inputOdClientId) inputOdClientId.value = odClientId;
  if (inputOdFolderId) inputOdFolderId.value = odFolderId;
  if (inputOdFolderConciliadosId) inputOdFolderConciliadosId.value = odFolderConciliadosId;
  if (inputOdForceMock) {
    inputOdForceMock.checked = odForceMock;
    setTimeout(() => { toggleOneDriveDemoMode(); }, 0);
  }
  
  if (typeof renderIdeasFallas === 'function') {
    renderIdeasFallas();
  } else if (typeof window !== 'undefined' && typeof window.renderIdeasFallas === 'function') {
    window.renderIdeasFallas();
  }
}

function guardarConfig(event) {
  if (typeof document === 'undefined') return;

  const cfg = {
    empresa: document.getElementById('cfg-empresa')?.value.trim() || '',
    rfc: document.getElementById('cfg-rfc')?.value.trim() || '',
    tel: document.getElementById('cfg-tel')?.value.trim() || '',
    email: document.getElementById('cfg-email')?.value.trim() || '',
    direccion: document.getElementById('cfg-direccion')?.value.trim() || '',
    queryClientes: document.getElementById('cfg-query-clientes')?.value.trim() || '',
    queryMaquinaria: document.getElementById('cfg-query-maquinaria')?.value.trim() || '',
    querySitios: document.getElementById('cfg-query-sitios')?.value.trim() || '',
    queryOrdenes: document.getElementById('cfg-query-ordenes')?.value.trim() || '',
    queryRefacciones: document.getElementById('cfg-query-refacciones')?.value.trim() || ''
  };

  const current = getConfigData();
  const updated = Object.assign({}, current, cfg);
  setConfigData(updated);

  localStorage.setItem('eurorep_config', JSON.stringify(updated));
  if (typeof window !== 'undefined' && window.pushToSupabase) window.pushToSupabase('config', updated);

  const btn = event ? event.target : document.getElementById('btn-guardar-config');
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
    btn.style.background = 'var(--green)';
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); }, 2000);
  }
}

function toggleOneDriveDemoMode() {
  if (typeof document === 'undefined') return;

  const checkbox = document.getElementById('cfg-onedrive-force-mock');
  const container = document.getElementById('onedrive-redirect-uri-container');
  const folderContainer = document.getElementById('onedrive-folder-id-container');
  const conciliadosContainer = document.getElementById('onedrive-folder-conciliados-id-container');
  const text = document.getElementById('onedrive-redirect-uri-text');
  
  if (!checkbox) return;
  
  if (checkbox.checked) {
    if (container) container.style.display = 'none';
    if (folderContainer) folderContainer.style.display = 'none';
    if (conciliadosContainer) conciliadosContainer.style.display = 'none';
  } else {
    if (container) container.style.display = 'block';
    if (folderContainer) folderContainer.style.display = 'block';
    if (conciliadosContainer) conciliadosContainer.style.display = 'block';
    if (text && typeof window !== 'undefined') {
      text.textContent = window.location.origin;
    }
  }
}

function guardarOneDriveConfig(event) {
  if (typeof document === 'undefined') return;

  const clientId = document.getElementById('cfg-onedrive-client-id')?.value.trim() || '';
  const forceMock = document.getElementById('cfg-onedrive-force-mock')?.checked || false;
  const folderId = document.getElementById('cfg-onedrive-folder-id')?.value.trim() || '';
  const folderConciliadosId = document.getElementById('cfg-onedrive-folder-conciliados-id')?.value.trim() || '';

  const current = getConfigData();
  current.onedriveClientId = clientId || 'MOCK';
  current.onedriveForceMock = forceMock;
  current.onedriveFolderId = folderId;
  current.onedriveFolderConciliadosId = folderConciliadosId;

  setConfigData(current);
  localStorage.setItem('eurorep_config', JSON.stringify(current));
  if (typeof window !== 'undefined' && window.pushToSupabase) window.pushToSupabase('config', current);

  const btn = event ? event.target : document.getElementById('btn-guardar-onedrive-config');
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="btn-icon"></i> Guardado';
    btn.style.background = 'var(--green)';
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    setTimeout(() => { 
      btn.innerHTML = orig; 
      btn.style.background = ''; 
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); 
    }, 2000);
  }
  
  safeMostrarNotificacion('Configuración de OneDrive guardada correctamente.', 'success');
}

// ─── 2. REDIMENSIONAMIENTO DE TABLAS (COLUMN RESIZERS) ───────────────────────

function initTableResizers() {
  if (typeof document === 'undefined') return;

  const tables = document.querySelectorAll('.data-table');
  tables.forEach((table, tableIndex) => {
    const theadRow = table.querySelector('thead tr');
    if (!theadRow) return;

    const storageKey = `table_widths_${tableIndex}`;
    const savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

    Array.from(theadRow.children).forEach((th, thIndex) => {
      if (th.querySelector('.column-resizer')) {
        th.querySelector('.column-resizer').remove();
      }

      th.style.position = 'relative';
      
      if (savedWidths[thIndex]) {
        th.style.width = savedWidths[thIndex];
        th.style.minWidth = savedWidths[thIndex];
      } else {
        const currentWidth = window.getComputedStyle(th).width;
        if (currentWidth && currentWidth !== '0px' && currentWidth !== 'auto') {
          th.style.minWidth = currentWidth;
        }
      }

      const resizer = document.createElement('div');
      resizer.classList.add('column-resizer');
      resizer.style.width = '6px';
      resizer.style.height = '100%';
      resizer.style.position = 'absolute';
      resizer.style.right = '0';
      resizer.style.top = '0';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      resizer.style.zIndex = '1';
      
      resizer.addEventListener('mouseenter', () => resizer.style.borderRight = '2px solid var(--accent)');
      resizer.addEventListener('mouseleave', () => resizer.style.borderRight = 'none');
      
      th.appendChild(resizer);
      
      let startX = 0;
      let startWidth = 0;
      
      const mouseMoveHandler = function(e) {
        const dx = e.clientX - startX;
        const newWidth = `${startWidth + dx}px`;
        th.style.width = newWidth;
        th.style.minWidth = newWidth;
      };
      
      const mouseUpHandler = function() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        savedWidths[thIndex] = th.style.width;
        localStorage.setItem(storageKey, JSON.stringify(savedWidths));
      };
      
      resizer.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        e.stopPropagation();
      });
    });
  });
}

function inicializarTableResizersEvent() {
  setTimeout(initTableResizers, 500);
}

// ─── 3. RECUPERACIÓN DE CONTRASEÑA ───────────────────────────────────────────

function inicializarPasswordRecovery() {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof document !== 'undefined') {
          const s1 = document.getElementById('login-screen');
          if (s1) s1.style.display = 'flex';
          const s2 = document.getElementById('login-step-form');
          if (s2) s2.style.display = 'none';
          const s3 = document.getElementById('login-step-recovery');
          if (s3) s3.style.display = 'none';
          const s4 = document.getElementById('login-step-crear');
          if (s4) s4.style.display = 'none';
          const s5 = document.getElementById('login-step-update-password');
          if (s5) s5.style.display = 'block';
        }
        safeMostrarNotificacion('Sesión verificada. Ya puedes cambiar tu contraseña.', 'success');
      }
    });
  }
}

function abrirRecuperarPassword(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof document === 'undefined') return;

  const f1 = document.getElementById('login-step-form');
  if (f1) f1.style.display = 'none';
  const f2 = document.getElementById('login-step-recovery');
  if (f2) f2.style.display = 'block';
  const recEmail = document.getElementById('recovery-email');
  const logEmail = document.getElementById('login-email');
  if (recEmail && logEmail) recEmail.value = logEmail.value || '';
}

function volverLoginDesdeRecovery() {
  if (typeof document === 'undefined') return;
  const f1 = document.getElementById('login-step-recovery');
  if (f1) f1.style.display = 'none';
  const f2 = document.getElementById('login-step-form');
  if (f2) f2.style.display = 'block';
  const errEl = document.getElementById('recovery-error');
  if (errEl) errEl.textContent = '';
}

async function enviarRecoveryLink(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof document === 'undefined') return;

  const errEl = document.getElementById('recovery-error');
  let email = document.getElementById('recovery-email')?.value.trim() || '';
  
  if (!email) return;
  
  const partBeforeAt = email.split('@')[0];
  const esTelefono = !email.includes('@') || (email.toLowerCase().endsWith('@eurorep.mx') && /^\d+$/.test(partBeforeAt));
  
  if (esTelefono) {
    const telefonoLimpio = partBeforeAt.replace(/\s+/g, '');
    if (errEl) {
      errEl.innerHTML = `Las cuentas registradas con número celular no pueden recibir correos de recuperación.<br><br>Por favor, contacta al administrador de Eurorep por WhatsApp para restablecer tu contraseña:<br><br><a href="https://wa.me/525512345678?text=Hola,%20necesito%20restablecer%20mi%20contrase%C3%B1a%20para%20la%20cuenta%20de%20tel%C3%A9fono%20${telefonoLimpio}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; padding:0.5rem 1rem; border-radius:6px; font-weight:600; margin-top:0.5rem; justify-content:center; width:100%; box-sizing:border-box;"><i data-lucide="message-circle" style="width:1.2rem; height:1.2rem; color:#fff;"></i> Solicitar por WhatsApp</a>`;
      errEl.style.color = 'var(--text-primary)';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
    return;
  }
  
  if (errEl) {
    errEl.textContent = 'Enviando enlace...';
    errEl.style.color = 'var(--text-secondary)';
  }
  
  try {
    if (typeof window !== 'undefined' && window.supabaseClient) {
      const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      
      if (error) {
        if (errEl) {
          errEl.textContent = 'Error: ' + error.message;
          errEl.style.color = 'var(--red)';
        }
      } else {
        if (errEl) {
          errEl.textContent = '¡Enlace enviado! Revisa tu bandeja de entrada o spam. Ya puedes cerrar esta ventana.';
          errEl.style.color = 'var(--green)';
        }
      }
    }
  } catch (error) {
    if (errEl) {
      errEl.textContent = 'Error de red. Intenta de nuevo.';
      errEl.style.color = 'var(--red)';
    }
  }
}

async function guardarNuevaPassword(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof document === 'undefined') return;

  const errEl = document.getElementById('update-pass-error');
  const newPass = document.getElementById('new-password')?.value || '';
  
  if (newPass.length < 6) {
    if (errEl) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errEl.style.color = 'var(--red)';
    }
    return;
  }
  
  if (errEl) {
    errEl.textContent = 'Actualizando contraseña...';
    errEl.style.color = 'var(--text-secondary)';
  }
  
  try {
    if (typeof window !== 'undefined' && window.supabaseClient) {
      const { data, error } = await window.supabaseClient.auth.updateUser({
        password: newPass
      });
      
      if (error) {
        if (errEl) {
          errEl.textContent = 'Error al actualizar: ' + error.message;
          errEl.style.color = 'var(--red)';
        }
      } else {
        safeMostrarNotificacion('¡Contraseña actualizada exitosamente!', 'success');
        const s1 = document.getElementById('login-step-update-password');
        if (s1) s1.style.display = 'none';
        const s2 = document.getElementById('login-step-form');
        if (s2) s2.style.display = 'block';
        const pInput = document.getElementById('login-password');
        if (pInput) pInput.value = '';
      }
    }
  } catch (error) {
    if (errEl) {
      errEl.textContent = 'Error de red. Intenta de nuevo.';
      errEl.style.color = 'var(--red)';
    }
  }
}

// ─── 4. DIAGRAMA DE FLUJO INTERACTIVO ────────────────────────────────────────

function abrirModalDiagramaFlujo() {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('modal-diagrama-flujo-overlay');
  const mainContent = document.getElementById('flowchart-main-content');
  const modalContent = document.getElementById('flowchart-modal-content');
  if (modal && mainContent && modalContent) {
    modalContent.innerHTML = mainContent.innerHTML;
    modal.classList.add('open');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

function cerrarModalDiagramaFlujo(e) {
  if (e && e.target && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('close-btn') && !e.target.closest('.close-btn')) return;
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('modal-diagrama-flujo-overlay');
  if (modal) modal.classList.remove('open');
}

function zoomDiagramaFlujo(delta) {
  currentDiagramZoom = Math.max(0.6, Math.min(1.8, currentDiagramZoom + delta));
  if (typeof document !== 'undefined') {
    const content = document.getElementById('flowchart-modal-content');
    if (content) {
      content.style.transform = `scale(${currentDiagramZoom})`;
      content.style.transformOrigin = 'top center';
    }
    const label = document.getElementById('diagrama-zoom-label');
    if (label) label.textContent = `${Math.round(currentDiagramZoom * 100)}%`;
  }
  return currentDiagramZoom;
}

function resetZoomDiagramaFlujo() {
  currentDiagramZoom = 1;
  if (typeof document !== 'undefined') {
    const content = document.getElementById('flowchart-modal-content');
    if (content) content.style.transform = 'scale(1)';
    const label = document.getElementById('diagrama-zoom-label');
    if (label) label.textContent = '100%';
  }
  return currentDiagramZoom;
}

function toggleSimbologiaFlujo() {
  if (typeof document === 'undefined') return;
  const legend = document.getElementById('flowchart-legend-box');
  if (legend) {
    legend.style.display = legend.style.display === 'none' ? 'flex' : 'none';
  }
}

function filtrarRutaDiagrama(ruta, btn) {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('.flowchart-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const container = document.getElementById('flowchart-main-content');
  const modalContainer = document.getElementById('flowchart-modal-content');
  
  [container, modalContainer].forEach(root => {
    if (!root) return;
    const nodes = root.querySelectorAll('.flowchart-card-node, .flow-connector-bridge, .flow-connector-v');
    nodes.forEach(n => {
      n.style.opacity = '1';
      n.style.filter = 'none';
    });

    if (ruta === 'normal') {
      root.querySelectorAll('.step-levantamiento, .step-garantia, .step-subticket').forEach(el => {
        el.style.opacity = '0.25';
        el.style.filter = 'grayscale(80%)';
      });
    } else if (ruta === 'levantamiento') {
      nodes.forEach(el => {
        if (!el.closest('.step-levantamiento') && !el.closest('.step-entrada')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    } else if (ruta === 'garantia') {
      nodes.forEach(el => {
        if (!el.closest('.step-garantia') && !el.closest('.step-os') && !el.closest('.step-cierre')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    } else if (ruta === 'subticket') {
      nodes.forEach(el => {
        if (!el.closest('.step-subticket') && !el.closest('.step-cotizacion') && !el.closest('.step-os')) {
          el.style.opacity = '0.25';
          el.style.filter = 'grayscale(80%)';
        }
      });
    }
  });
}

// Interoperabilidad en navegador clásico
if (typeof window !== 'undefined') {
  window.cargarConfig = cargarConfig;
  window.guardarConfig = guardarConfig;
  window.toggleOneDriveDemoMode = toggleOneDriveDemoMode;
  window.guardarOneDriveConfig = guardarOneDriveConfig;
  window.initTableResizers = initTableResizers;
  window.inicializarTableResizersEvent = inicializarTableResizersEvent;
  window.inicializarPasswordRecovery = inicializarPasswordRecovery;
  window.abrirRecuperarPassword = abrirRecuperarPassword;
  window.volverLoginDesdeRecovery = volverLoginDesdeRecovery;
  window.enviarRecoveryLink = enviarRecoveryLink;
  window.guardarNuevaPassword = guardarNuevaPassword;
  window.abrirModalDiagramaFlujo = abrirModalDiagramaFlujo;
  window.cerrarModalDiagramaFlujo = cerrarModalDiagramaFlujo;
  window.zoomDiagramaFlujo = zoomDiagramaFlujo;
  window.resetZoomDiagramaFlujo = resetZoomDiagramaFlujo;
  window.toggleSimbologiaFlujo = toggleSimbologiaFlujo;
  window.filtrarRutaDiagrama = filtrarRutaDiagrama;
}

export {
  cargarConfig,
  guardarConfig,
  toggleOneDriveDemoMode,
  guardarOneDriveConfig,
  initTableResizers,
  inicializarTableResizersEvent,
  inicializarPasswordRecovery,
  abrirRecuperarPassword,
  volverLoginDesdeRecovery,
  enviarRecoveryLink,
  guardarNuevaPassword,
  abrirModalDiagramaFlujo,
  cerrarModalDiagramaFlujo,
  zoomDiagramaFlujo,
  resetZoomDiagramaFlujo,
  toggleSimbologiaFlujo,
  filtrarRutaDiagrama
};
