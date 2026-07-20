import re

with open("app.js", "r") as f:
    content = f.read()

# 1. Remove pointer styles from card
content = re.sub(
    r"    card.style.position = 'relative';\n    card.style.cursor = 'pointer';\n    card.style.transition = 'transform 0.2s, box-shadow 0.2s';\n    card.onmouseover = \(\) => \{ card.style.transform = 'translateY\(-2px\)'; card.style.boxShadow = 'var\(--shadow-md\)'; \};\n    card.onmouseout = \(\) => \{ card.style.transform = 'none'; card.style.boxShadow = 'var\(--shadow\)'; \};\n",
    "    card.style.position = 'relative';\n",
    content
)

# 2. Replace the bottom badge with a select dropdown
badge_old = r"""        <div style="width: 100%; display: flex; align-items: center; justify-content: flex-end; margin-top: auto;">
          <div style="display: flex; align-items: center; gap: 0.4rem; color: \$\{badgeColor\}; background: \$\{badgeBg\}; padding: 0.35rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
            <i data-lucide="\$\{badgeIcon\}" style="width:14px; height:14px;"></i>
            \$\{p.estatusPedido \|\| 'Por Pedir'\}
          </div>
        </div>"""

badge_new = r"""        <div style="width: 100%; display: flex; align-items: center; justify-content: flex-end; margin-top: auto;">
          <select onchange="window.cambiarEstatusEnLinea('${p.ordenId}', '${p.clave}', '${p.descripcion.replace(/'/g, "\\'")}', this.value)" style="color: ${badgeColor}; background: ${badgeBg}; padding: 0.35rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; border: none; outline: none; cursor: pointer; appearance: none; text-align: center; font-family: inherit;">
            <option value="Por Pedir" style="color: initial; background: initial;" ${(!p.estatusPedido || p.estatusPedido === 'Por Pedir') ? 'selected' : ''}>Por Pedir</option>
            <option value="En Tránsito / Pedido" style="color: initial; background: initial;" ${p.estatusPedido === 'En Tránsito / Pedido' ? 'selected' : ''}>En Tránsito / Pedido</option>
            <option value="Entregado al Técnico" style="color: initial; background: initial;" ${p.estatusPedido === 'Entregado al Técnico' ? 'selected' : ''}>Entregado al Técnico</option>
          </select>
        </div>"""

content = content.replace(badge_old, badge_new)

# 3. Remove the data-refaccion-json attribute
content = re.sub(
    r"    const partDataStr = btoa\(encodeURIComponent\(JSON.stringify\(\{\n      ordenId: p.ordenId,\n      clave: p.clave,\n      descripcion: p.descripcion,\n      estatusPedido: p.estatusPedido,\n      cantidad: p.cantidad,\n      marca: p.marca\n    \}\)\)\);\n    \n    card.setAttribute\('data-refaccion-json', partDataStr\);\n    \n",
    "",
    content
)

# 4. Remove the modal functions and add cambiarEstatusEnLinea
modal_funcs_old = r"""// Variable global para mantener referencia a la pieza que se está editando en el modal
let piezaPendienteActualEditando = null;

document.addEventListener('click', function(e) {
  const card = e.target.closest('.stat-card');
  if (!card) return;
  
  const dataStr = card.getAttribute('data-refaccion-json');
  if (!dataStr) return;
  
  if (e.target.closest('.status-badge')) return; // ignore order link click
  
  try {
    const data = JSON.parse(decodeURIComponent(atob(dataStr)));
    if (window.abrirModalPiezaPendiente) {
      window.abrirModalPiezaPendiente(data.ordenId, data.clave, data.descripcion, data.estatusPedido, data.cantidad, data.marca);
    }
  } catch (err) {
    alert("Error procesando click en la pieza: " + err.message);
  }
});

window.abrirModalPiezaPendiente = function(ordenId, clave, descripcion, estatusActual, cantidad, marca) {
  try {
    piezaPendienteActualEditando = { ordenId, clave, descripcion };
    
    let orden = null;
    if (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) {
      orden = ordenes.find(o => o.id === ordenId);
    }
    const folioText = orden ? (orden.folio || 'S/N') : 'S/N';

    const infoDiv = document.getElementById('modal-pieza-pendiente-info');
    infoDiv.innerHTML = `
      <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin-bottom:0.25rem;">${cantidad}x ${descripcion}</div>
      <div style="font-size:0.95rem; color:var(--accent); font-weight:600; margin-bottom:0.5rem;">${marca || '-'}</div>
      <div style="font-size:0.85rem; color:var(--text-muted); font-family:monospace; margin-bottom:0.25rem;">Clave: ${clave}</div>
      <div style="font-size:0.85rem; color:var(--text-muted);">Orden #${folioText}</div>
    `;
    
    document.getElementById('modal-pieza-pendiente-estatus').value = estatusActual || 'Por Pedir';
    
    const modalEl = document.getElementById('modal-pieza-pendiente');
    modalEl.classList.add('open');
    modalEl.style.setProperty('display', 'flex', 'important');
    modalEl.style.setProperty('visibility', 'visible', 'important');
    modalEl.style.setProperty('opacity', '1', 'important');
    
  } catch(e) {
    console.error("Error al abrir modal de pieza pendiente:", e);
    alert("Hubo un error al abrir la pieza: " + e.message);
  }
};

window.cerrarModalPiezaPendiente = function() {
  const modalEl = document.getElementById('modal-pieza-pendiente');
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.style.display = 'none';
  }
  piezaPendienteActualEditando = null;
};

window.guardarEstatusModalPiezaPendiente = async function() {
  if (!piezaPendienteActualEditando) return;
  const nuevoEstatus = document.getElementById('modal-pieza-pendiente-estatus').value;
  const { ordenId, clave, descripcion } = piezaPendienteActualEditando;
  
  window.cerrarModalPiezaPendiente();
  await window.cambiarEstatusPiezaPendiente(ordenId, clave, descripcion, nuevoEstatus);
};

window.cambiarEstatusPiezaPendiente = async function(ordenId, clave, descripcion, nuevoEstatus) {
  if (typeof ordenes === 'undefined' || typeof window.pushToSupabase === 'undefined') {
    alert("Error: datos de órdenes no disponibles en el entorno.");
    return;
  }
  
  const ordenIdx = ordenes.findIndex(o => o.id === ordenId);
  if (ordenIdx === -1) {
    alert("No se encontró la Orden de Servicio en memoria.");
    return;
  }
  
  const orden = ordenes[ordenIdx];
  if (!orden.ref_necesarias || !Array.isArray(orden.ref_necesarias)) return;
  
  const ref = orden.ref_necesarias.find(r => r.clave === clave && r.descripcion === descripcion);
  if (ref) {
    ref.estatusPedido = nuevoEstatus;
    
    const btn = document.getElementById('nav-piezas-pendientes');
    const oldText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Guardando...';
    if (window.lucide && btn) window.lucide.createIcons({ root: btn });
    
    try {
      await window.pushToSupabase('ordenes', orden);
      renderRefaccionesPendientes();
      if (typeof renderOrdenDetalle === 'function' && document.getElementById('detalle-orden-view')?.style.display !== 'none') {
         renderOrdenDetalle(orden.id);
      }
    } catch(err) {
      console.error("Error al cambiar estatus de pieza:", err);
      alert("Hubo un error al guardar en la base de datos.");
    } finally {
      if (btn) btn.innerHTML = oldText;
      if (window.lucide && btn) window.lucide.createIcons({ root: btn });
    }
  }
}"""

cambiar_estatus_en_linea = r"""// Limpieza de funciones modales
if (window.abrirModalPiezaPendiente) delete window.abrirModalPiezaPendiente;

window.cambiarEstatusEnLinea = async function(ordenId, clave, descripcion, nuevoEstatus) {
  if (typeof ordenes === 'undefined' || typeof window.pushToSupabase === 'undefined') {
    alert("Error: datos de órdenes no disponibles en el entorno.");
    return;
  }
  
  const ordenIdx = ordenes.findIndex(o => o.id === ordenId);
  if (ordenIdx === -1) {
    alert("No se encontró la Orden de Servicio en memoria.");
    return;
  }
  
  const orden = ordenes[ordenIdx];
  if (!orden.ref_necesarias || !Array.isArray(orden.ref_necesarias)) return;
  
  const ref = orden.ref_necesarias.find(r => r.clave === clave && r.descripcion === descripcion);
  if (ref) {
    ref.estatusPedido = nuevoEstatus;
    
    try {
      await window.pushToSupabase('ordenes', orden);
      renderRefaccionesPendientes();
      if (typeof renderOrdenDetalle === 'function' && document.getElementById('detalle-orden-view')?.style.display !== 'none') {
         renderOrdenDetalle(orden.id);
      }
    } catch(err) {
      console.error("Error al cambiar estatus de pieza:", err);
      alert("Hubo un error al guardar en la base de datos.");
    }
  }
};"""

content = content.replace(modal_funcs_old, cambiar_estatus_en_linea)

with open("app.js", "w") as f:
    f.write(content)

