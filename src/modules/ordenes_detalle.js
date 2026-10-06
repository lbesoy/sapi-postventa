/**
 * Módulo de Detalle, Evidencias Fotográficas y Canvas de Firmas de Órdenes - Eurorep / SAPI
 * Diseñado como módulo ES con retrocompatibilidad global hacia window.
 */

import { normStr, formatFechaHoraAmigable, escapeHTML } from "../utils.js";

function safeNorm(s) {
  if (!s) return "";
  if (typeof normStr === "function") return normStr(s);
  if (typeof window !== "undefined" && typeof window.normStr === "function") return window.normStr(s);
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function safeFormatFechaHoraAmigable(dateStr) {
  if (typeof formatFechaHoraAmigable === "function") return formatFechaHoraAmigable(dateStr);
  if (typeof window !== "undefined" && typeof window.formatFechaHoraAmigable === "function") return window.formatFechaHoraAmigable(dateStr);
  return String(dateStr || "");
}

function safeEscapeHTML(str) {
  if (typeof escapeHTML === "function") return escapeHTML(str);
  if (typeof window !== "undefined" && typeof window.escapeHTML === "function") return window.escapeHTML(str);
  return String(str || "").replace(/[&<>'"]/g, tag => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[tag] || tag));
}

// Resiliencia para variables maestras de memoria
if (typeof window !== "undefined") {
  if (typeof window.tickets === "undefined") window.tickets = [];
  if (typeof window.ordenes === "undefined") window.ordenes = [];
  if (typeof window.usuarios === "undefined") window.usuarios = [];
  if (typeof window.maquinaria === "undefined") window.maquinaria = [];
  if (typeof window.clientes === "undefined") window.clientes = [];
  if (typeof window.currentSession === "undefined") window.currentSession = { userId: "", viewMode: "consulta" };
}

// ===== EVIDENCIA FOTOGRÁFICA Y STORAGE =====
function renderEvidenciasFotograficas(o) {
  if (typeof document === 'undefined' && !o) return '';
  const ev = o.evidencias || { fotoInicio: null, fotoFin: null, adicionales: [] };
  const adicionales = ev.adicionales || [];
  const isClosed = (
    (o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || 
    o.estado === 'Cerrado' || 
    o.estado === 'Cerrada' || 
    o.estado === 'Finalizado' || 
    o.estado === 'Refacciones pendientes' || 
    o.cierre_papel_pdf ||
    (!(!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__') && o.firma_cliente_base64 !== '__DELETED__') || 
    (!(!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__') && o.firma_tecnico_base64 !== '__DELETED__')
  );
  
  const tieneInicio = !!ev.fotoInicio;
  const tieneFin = !!ev.fotoFin;
  const tieneUbicacionSitio = !!(o.ubicacion_sitio && o.ubicacion_sitio.trim());
  const tieneOperador = !!(o.operador && o.operador.trim());
  const listos = tieneInicio && tieneFin && tieneUbicacionSitio && tieneOperador;

  let alertHtml = '';
  if (listos) {
    alertHtml = `
      <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); color:#10b981; border-radius:8px; padding:0.75rem 1rem; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;">
        <i data-lucide="check-circle" style="width:16px;height:16px;"></i> Requisitos y evidencias cargadas correctamente. Firma de conformidad habilitada.
      </div>
    `;
  } else {
    let faltantes = [];
    if (!tieneUbicacionSitio) faltantes.push("la Ubicación en Sitio");
    if (!tieneOperador) faltantes.push("el Operador");
    if (!tieneInicio || !tieneFin) faltantes.push("la Foto de Inicio y Fin");

    alertHtml = `
      <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); color:#d97706; border-radius:8px; padding:0.75rem 1rem; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;">
        <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i> Se requiere registrar: ${faltantes.join(', ')} para poder firmar y completar el servicio.
      </div>
    `;
  }

  const renderTarjetaFoto = (titulo, tipo, url, obligatoria) => {
    const isConsulta = currentSession.viewMode === 'consulta' || isClosed;
    const uploadBtn = isConsulta ? '' : `
      <label class="btn-primary" style="font-size:0.72rem; min-height:auto; padding:0.35rem 0.75rem; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem; margin-top:0.5rem;">
        <i data-lucide="upload" style="width:12px;height:12px;"></i> ${url ? 'Reemplazar' : 'Cargar Foto'}
        <input type="file" accept="image/*" onchange="subirEvidenciaFoto('${o.id}', '${tipo}', this)" style="display:none;" />
      </label>
    `;

    const hasImage = !!url;

    return `
      <div style="flex:1; min-width:200px; background:var(--bg-body); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; align-items:center; gap:0.5rem; box-shadow:0 2px 5px rgba(0,0,0,0.02); transition:var(--transition); position:relative;">
        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:0.25rem;">
          ${obligatoria ? '<span style="color:var(--red); font-size:1.1rem; line-height:0.5; margin-right:2px;">*</span>' : ''} ${titulo}
        </div>
        <div style="width:100%; height:130px; border-radius:6px; border:1px solid var(--border); overflow:hidden; background:var(--bg-card); display:flex; justify-content:center; align-items:center; position:relative;">
          ${hasImage 
            ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.previsualizarImagenCompleta('${url}', '${titulo}')" title="Haga clic para ver en pantalla completa" />
               ${isConsulta ? '' : `
                 <button type="button" onclick="eliminarEvidenciaFoto('${o.id}', '${tipo}', '${url}')" style="position:absolute; top:4px; right:4px; width:24px; height:24px; border-radius:50%; background:rgba(239,68,68,0.9); border:none; color:white; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.15);" title="Eliminar evidencia">
                   <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                 </button>
               `}
              ` 
            : `<div style="color:var(--text-muted); opacity:0.5; text-align:center; font-size:0.75rem; display:flex; flex-direction:column; gap:0.25rem; align-items:center; justify-content:center;">
                 <i data-lucide="camera" style="width:24px;height:24px;"></i>
                 <span>Sin imagen cargada</span>
               </div>`
          }
        </div>
        ${uploadBtn}
      </div>
    `;
  };

  const renderAdicionalesHtml = () => {
    const isConsulta = currentSession.viewMode === 'consulta' || isClosed;
    const uploadBtn = isConsulta ? '' : `
      <label style="display:flex; flex-shrink:0; width:100px; height:100px; border:2px dashed var(--border); border-radius:6px; background:var(--bg-body); flex-direction:column; gap:0.25rem; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted); transition:var(--transition); position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.01); margin:0;" onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
        <i data-lucide="plus" style="width:16px;height:16px;"></i>
        <span style="font-size:0.65rem; font-weight:600;">Subir foto</span>
        <input type="file" accept="image/*" onchange="subirEvidenciaFoto('${o.id}', 'adicional', this)" style="display:none;" />
      </label>
    `;

    const fotosList = adicionales.map((url, idx) => `
      <div style="width:100px; height:100px; border-radius:6px; border:1px solid var(--border); overflow:hidden; position:relative; background:var(--bg-card); flex-shrink:0;">
        <img src="${url}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.previsualizarImagenCompleta('${url}', 'Evidencia Adicional ${idx + 1}')" />
        ${isConsulta ? '' : `
          <button type="button" onclick="eliminarEvidenciaFoto('${o.id}', 'adicional', '${url}')" style="position:absolute; top:3px; right:3px; width:18px; height:18px; border-radius:50%; background:rgba(239,68,68,0.95); border:none; color:white; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2);" title="Eliminar foto">
            <i data-lucide="trash-2" style="width:10px;height:10px;"></i>
          </button>
        `}
      </div>
    `).join('');

    return `
      <div style="display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:0.75rem; align-items:center;">
        ${fotosList}
        ${uploadBtn}
      </div>
    `;
  };

  // === VISTA DE IMPRESIÓN PARA EVIDENCIAS (FOTOS GRANDES Y LIMPIAS) ===
  let printEvidenciasHtml = '';
  if (tieneInicio || tieneFin || adicionales.length > 0) {
    printEvidenciasHtml += `
      <div style="display:flex; flex-direction:column; gap:1.5rem; margin-top:0.5rem;">
        <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
    `;

    if (tieneInicio) {
      printEvidenciasHtml += `
        <div style="flex:1; min-width:280px; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Inicio (Entrada)</div>
          <div style="height:220px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
            <img src="${ev.fotoInicio}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
        </div>
      `;
    }

    if (tieneFin) {
      printEvidenciasHtml += `
        <div style="flex:1; min-width:280px; border:1px solid #d1d5db; border-radius:6px; padding:0.75rem; background:#f9fafb; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.5rem; text-transform:uppercase;">Foto de Fin (Salida)</div>
          <div style="height:220px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
            <img src="${ev.fotoFin}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
        </div>
      `;
    }

    printEvidenciasHtml += `
        </div>
    `;

    if (adicionales.length > 0) {
      printEvidenciasHtml += `
        <div style="margin-top:0.5rem;">
          <div style="font-size:0.75rem; font-weight:700; color:#374151; margin-bottom:0.75rem; text-transform:uppercase;">Evidencias Adicionales</div>
          <div style="display:flex; flex-wrap:wrap; gap:1rem; justify-content:flex-start;">
      `;

      adicionales.forEach((url, idx) => {
        printEvidenciasHtml += `
          <div style="border:1px solid #d1d5db; border-radius:6px; padding:0.5rem; background:#f9fafb; text-align:center; width:200px;">
            <div style="font-size:0.65rem; font-weight:600; color:#4b5563; margin-bottom:0.35rem;">Adicional ${idx + 1}</div>
            <div style="height:140px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; display:flex; justify-content:center; align-items:center; overflow:hidden;">
              <img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </div>
          </div>
        `;
      });

      printEvidenciasHtml += `
          </div>
        </div>
      `;
    }

    printEvidenciasHtml += `
      </div>
    `;
  } else {
    printEvidenciasHtml = '<p style="color:#000; font-size:0.8rem; font-style:italic;">Sin fotos de evidencia cargadas.</p>';
  }

  return `
    <div class="no-print" style="margin-top:0.5rem;">
      ${alertHtml}
      <div style="display:flex; flex-wrap:wrap; gap:1.25rem;">
        ${renderTarjetaFoto('FOTO DE INICIO (Entrada)', 'fotoInicio', ev.fotoInicio, true)}
        ${renderTarjetaFoto('FOTO DE FIN (Salida)', 'fotoFin', ev.fotoFin, true)}
      </div>
      <div style="margin-top:1.5rem; border-top:1px solid var(--border); padding-top:1rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Evidencias Adicionales (Opcionales)</div>
        ${renderAdicionalesHtml()}
      </div>
    </div>
    <div class="print-only">
      ${printEvidenciasHtml}
    </div>
  `;
}

function previsualizarImagenCompleta(url, titulo) {
  if (typeof document === 'undefined') return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '100000';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.innerHTML = `
    <div style="position:relative; max-width:90%; max-height:90%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; outline:none;">
      <h3 style="color:white; margin:0; font-size:1.1rem; text-shadow:0 2px 4px rgba(0,0,0,0.5);">${titulo}</h3>
      <img src="${url}" style="max-width:100%; max-height:80vh; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); object-fit:contain;" />
      <button onclick="this.closest('.modal-overlay').remove()" style="position:absolute; top:-35px; right:-15px; background:none; border:none; color:white; font-size:2rem; cursor:pointer;" title="Cerrar">&times;</button>
    </div>
  `;
  document.body.appendChild(overlay);
};

function abrirImagenEnPestana(ticketId) {
  if (typeof window === 'undefined') return;
  const t = (window.tickets || []).find(x => x.id === ticketId);
  const src = (t && t.pdfCotizacion && t.pdfCotizacion !== '__HAS_PDF__') ? t.pdfCotizacion : (t?.foto || t?.evidencia);
  if (src) {
    const win = window.open();
    if (win) {
      win.document.write(`<title>Evidencia Fotográfica Ticket ${t?.folio || ''}</title><body style="margin:0; background:#111; display:flex; align-items:center; justify-content:center; min-height:100vh;"><img src="${src}" style="max-width:100%; max-height:100vh; object-fit:contain;" /></body>`);
    }
  }
};

async function subirEvidenciaFoto(ordenId, tipo, inputEl) {
  if (typeof document === 'undefined') return;
  const file = inputEl.files[0];
  if (!file) return;

  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;

  const hasTecnicoFirma = o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__';
  const hasClienteFirma = o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__';
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf) || hasTecnicoFirma || hasClienteFirma) {
    mostrarNotificacion('No se pueden modificar evidencias en una orden cerrada o con firmas.', 'error');
    return;
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Comprimiendo y preparando imagen...', 'info');
  }

  const compressImage = (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = (e) => reject(e);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 1200;
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("La compresión de imagen falló (Blob vacío)"));
              }, 'image/jpeg', 0.85);
            } else {
              // Fallback para navegadores antiguos/Safari que no soportan toBlob directamente
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while(n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              const blob = new Blob([u8arr], {type:mime});
              resolve(blob);
            }
          } catch (err) {
            reject(err);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(imageFile);
    });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  try {
    const compressedBlob = await compressImage(file);
    const uniqueName = `${tipo}_${Date.now()}_${Math.random().toString(36).substring(2,7)}.jpg`;
    const filePath = `ordenes/${ordenId}/${uniqueName}`.replace(/[\[\]\*?]/g, '');

    let publicUrl = null;
    let savedOffline = false;

    // Si estamos offline o no hay supabaseClient, guardar directo en base64
    if (!navigator.onLine || !window.supabaseClient) {
      const base64Data = await blobToBase64(compressedBlob);
      publicUrl = base64Data;
      savedOffline = true;
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Imagen guardada localmente (Modo Offline)', 'info');
      }
    } else {
      try {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Subiendo imagen a Supabase Storage...', 'info');
        }

        const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
          .from('evidencias')
          .upload(filePath, compressedBlob, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadErr) {
          throw uploadErr;
        }

        const { data: urlData } = window.supabaseClient.storage
          .from('evidencias')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Fallo la subida directa (guardando como base64 local para sincronizar después):", err);
        const base64Data = await blobToBase64(compressedBlob);
        publicUrl = base64Data;
        savedOffline = true;
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Guardado localmente (Fallo de red al subir)', 'warning');
        }
      }
    }

    if (!o.evidencias) o.evidencias = { fotoInicio: null, fotoFin: null, adicionales: [] };
    
    if (tipo === 'fotoInicio') {
      o.evidencias.fotoInicio = publicUrl;
    } else if (tipo === 'fotoFin') {
      o.evidencias.fotoFin = publicUrl;
    } else if (tipo === 'adicional') {
      if (!o.evidencias.adicionales) o.evidencias.adicionales = [];
      o.evidencias.adicionales.push(publicUrl);
    }

    safeSetJSON('sapi_ordenes', ordenes);
    if (window.pushToSupabase) {
      await window.pushToSupabase('ordenes', o);
    }

    if (window.trackTelemetryEvent) {
      const labelFoto = tipo === 'fotoInicio' ? 'Foto de Inicio' : (tipo === 'fotoFin' ? 'Foto de Fin' : 'Foto Adicional');
      window.trackTelemetryEvent('Carga de Evidencia', { id: ordenId, folio: o.folio, tipo: labelFoto });
    }

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(savedOffline ? 'Evidencia guardada localmente (Offline)' : 'Evidencia fotográfica subida correctamente.', 'success');
    }

    verDetalle(ordenId);
  } catch (err) {
    console.error("Error en subirEvidenciaFoto:", err);
    alert("Ocurrió un error inesperado al subir la imagen.");
  }
};

async function subirFotoRefaccion(inputEl) {
  if (typeof document === 'undefined') return;
  const file = inputEl.files[0];
  if (!file) return;

  const container = inputEl.parentElement;
  const btn = container.querySelector('.ref-foto-btn');
  const preview = container.querySelector('.ref-foto-preview');
  const urlHidden = container.querySelector('.ref-foto-url');

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Comprimiendo y preparando imagen...', 'info');
  }

  const compressImage = (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = (e) => reject(e);
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1200;
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("La compresión falló"));
              }, 'image/jpeg', 0.85);
            } else {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while(n--) { u8arr[n] = bstr.charCodeAt(n); }
              resolve(new Blob([u8arr], {type:mime}));
            }
          } catch (err) { reject(err); }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(imageFile);
    });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  try {
    const compressedBlob = await compressImage(file);
    let publicUrl = null;
    let savedOffline = false;

    if (!navigator.onLine || !window.supabaseClient) {
      publicUrl = await blobToBase64(compressedBlob);
      savedOffline = true;
    } else {
      try {
        if (window.mostrarNotificacion) window.mostrarNotificacion('Subiendo a la nube...', 'info');
        const uniqueName = `refaccion_${Date.now()}_${Math.random().toString(36).substring(2,7)}.jpg`;
        // Put in a general 'refacciones' path inside evidencias
        const filePath = `refacciones/${uniqueName}`;
        
        const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
          .from('evidencias')
          .upload(filePath, compressedBlob, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = window.supabaseClient.storage
          .from('evidencias')
          .getPublicUrl(filePath);

        publicUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Fallo subida directa:", err);
        publicUrl = await blobToBase64(compressedBlob);
        savedOffline = true;
      }
    }

    urlHidden.value = publicUrl;
    btn.style.display = 'none';
    preview.style.display = 'flex';
    
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(savedOffline ? 'Guardado localmente' : 'Foto de refacción lista', 'success');
    }
  } catch (err) {
    console.error("Error al procesar foto de refacción:", err);
    alert("Ocurrió un error al procesar la fotografía.");
  }
};

async function eliminarEvidenciaFoto(ordenId, tipo, url) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o || !o.evidencias) return;

  const hasTecnicoFirma = o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__';
  const hasClienteFirma = o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__';
  if (((o.estado === 'Completado' || o.estado === 'Cerrada' || o.estado === 'Cerrado') || o.estado === 'Cerrado' || o.estado === 'Cerrada' || o.estado === 'Finalizado' || o.cierre_papel_pdf) || hasTecnicoFirma || hasClienteFirma) {
    mostrarNotificacion('No se pueden modificar evidencias en una orden cerrada o con firmas.', 'error');
    return;
  }

  const confirmado = await window.confirmarAccion({
    titulo: 'Quitar Evidencia',
    mensaje: '¿Estás seguro de que deseas quitar esta foto de evidencia?',
    esPeligroso: true,
    icono: 'trash-2'
  });
  if (!confirmado) return;

  if (tipo === 'fotoInicio') {
    o.evidencias.fotoInicio = null;
  } else if (tipo === 'fotoFin') {
    o.evidencias.fotoFin = null;
  } else if (tipo === 'adicional') {
    o.evidencias.adicionales = (o.evidencias.adicionales || []).filter(x => x !== url);
  }

  safeSetJSON('sapi_ordenes', ordenes);
  if (window.pushToSupabase) {
    await window.pushToSupabase('ordenes', o);
  }

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Foto removida correctamente.', 'info');
  }

  verDetalle(ordenId);
};

// ===== DETALLE =====
function verDetalle(id) {
  if (typeof document === 'undefined') return;
  let o = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? ordenes.find(x => x && x.id === id) : null;
  if (!o) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const targetNorm = norm(id);
    const targetNum = String(id).replace(/[^0-9]/g, '');
    let pool = (typeof ordenes !== 'undefined' && Array.isArray(ordenes)) ? [...ordenes] : [];
    if (typeof window !== 'undefined' && Array.isArray(window.ordenes)) pool = pool.concat(window.ordenes);
    try {
      const local = (typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]');
      if (Array.isArray(local)) pool = pool.concat(local);
    } catch (e) {}
    o = pool.find(x => x && (x.id === id || x.folio === id || norm(x.folio || x.id) === targetNorm || (targetNum.length >= 4 && String(x.folio || '').replace(/[^0-9]/g, '') === targetNum)));
  }
  if (!o) return;
  const actualId = o.id || id;
  document.getElementById('detalle-title').textContent = `Orden ${o.folio || o.id.slice(0,8)}`;
  
  const btnCierrePapel = document.getElementById('btn-cierre-papel');
  if (btnCierrePapel) {
    const isAllowedRole = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
    const orderClosed = ['completado', 'cerrada', 'cerrado', 'finalizado'].includes(String(o.estado || '').toLowerCase()) || o.cierre_papel_pdf;
    if (isAllowedRole && !orderClosed) {
      btnCierrePapel.style.display = 'flex';
      btnCierrePapel.setAttribute('onclick', `abrirCierrePapel('${actualId}')`);
    } else {
      btnCierrePapel.style.display = 'none';
    }
  }

  const btnCompletar = document.getElementById('btn-completar-reporte');
  if (btnCompletar) {
    const hasCierrePapel = !!o.cierre_papel_pdf;
    if (currentSession.viewMode !== 'consulta' && !hasCierrePapel && (!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__')) {
      btnCompletar.style.display = 'flex';
      btnCompletar.setAttribute('onclick', `completarReporteDesdeDetalle('${actualId}')`);
    } else {
      btnCompletar.style.display = 'none';
    }
  }

  const btnAsignarTecs = document.getElementById('btn-asignar-tecnicos');
  if (btnAsignarTecs) {
    if (['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode) && o.estado !== 'Finalizado') {
      btnAsignarTecs.style.display = 'flex';
    } else {
      btnAsignarTecs.style.display = 'none';
    }
  }

  const btnEnviarCorreo = document.getElementById('btn-enviar-correo');
  if (btnEnviarCorreo) {
    if (currentSession.viewMode === 'tecnico') {
      btnEnviarCorreo.style.display = 'none';
    } else {
      btnEnviarCorreo.style.display = 'flex';
      btnEnviarCorreo.setAttribute('onclick', `enviarCorreoOrden('${actualId}')`);
    }
  }

  const btnImprimir = document.getElementById('btn-imprimir-orden');
  if (btnImprimir) {
    if (currentSession.viewMode === 'tecnico') {
      btnImprimir.style.display = 'none';
    } else {
      btnImprimir.style.display = 'flex';
    }
  }

  window.currentDetalleOrdenId = actualId;

  const renderBitacora = (o) => {
    let html = '';
    const isClosed = (['completado', 'cerrada', 'cerrado', 'finalizado'].includes(String(o.estado || '').toLowerCase())) && ((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') || o.cierre_papel_pdf);
    const isTecnico = currentSession.viewMode === 'tecnico';
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const miTecnicoNombre = currentUser ? currentUser.nombre : '';

    let items = [...(o.bitacora || [])];
    // Mostrar todo el historial de la orden sin ocultar las bitácoras registradas por otros compañeros de equipo

    // Unificación inteligente reactiva con eventos de calendario
    try {
      const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
      const normStr = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      localEventos.forEach(ev => {
        if (ev.ordenId === o.id) {
          if (isTecnico && miTecnicoNombre && normStr(ev.tecnicoNombre) !== normStr(miTecnicoNombre)) {
            return;
          }
          // Extraer fecha local simple (YYYY-MM-DD)
          let fISO = '';
          if (ev.fechaInicio || ev.start) {
            const dateVal = ev.fechaInicio || ev.start;
            if (dateVal.includes('T')) {
              const dI = new Date(dateVal);
              fISO = `${dI.getFullYear()}-${String(dI.getMonth() + 1).padStart(2, '0')}-${String(dI.getDate()).padStart(2, '0')}`;
            } else {
              fISO = dateVal.substring(0, 10);
            }
          }
          if (!fISO) return;

          // Extraer horas de entrada y salida locales
          let ent = '';
          let sal = '';
          try {
            if (ev.fechaInicio || ev.start) {
              const dateVal = ev.fechaInicio || ev.start;
              if (dateVal.includes('T')) {
                const dI = new Date(dateVal);
                ent = `${String(dI.getHours()).padStart(2, '0')}:${String(dI.getMinutes()).padStart(2, '0')}`;
              }
            }
            if (ev.fechaFin || ev.end) {
              const dateVal = ev.fechaFin || ev.end;
              if (dateVal.includes('T')) {
                const dF = new Date(dateVal);
                sal = `${String(dF.getHours()).padStart(2, '0')}:${String(dF.getMinutes()).padStart(2, '0')}`;
              }
            }
          } catch(e){}

          // Verificar si ya existe en la bitácora
          const existe = items.some(b => b.id === ev.id || (b.fecha === fISO && b.tecnico === ev.tecnicoNombre && b.entrada === ent));
          
          if (!existe) {
            items.push({
              id: ev.id,
              fecha: fISO,
              tecnico: ev.tecnicoNombre || 'Sin Asignar',
              nota: ev.descripcion || "Programado por supervisor. Pendiente de llenado por el técnico.",
              entrada: ent,
              salida: sal,
              realizado: false,
              asignadoPorName: ev.creadoPorNombre || 'Supervisor'
            });
          }
        }
      });
    } catch(e){}

    // Separar pendientes de realizados
    const pendientes = items.filter(b => b.realizado === false || (b.nota && b.nota.includes('Programado por supervisor') && b.realizado !== true));
    const realizados = items.filter(b => b.realizado === true || (!pendientes.some(p => p.id === b.id)));

    // 1. Renderizar Asignaciones Programadas (Pendientes)
    if (pendientes.length > 0) {
      html += `
        <div style="margin-bottom:1.5rem; background:rgba(139, 92, 246, 0.02); border: 1px solid rgba(139, 92, 246, 0.1); border-radius:10px; padding:1.25rem;">
          <h4 style="font-size:0.82rem; font-weight:700; color:#8b5cf6; text-transform:uppercase; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; border-bottom:1px solid rgba(139, 92, 246, 0.15); padding-bottom:0.5rem; margin-top:0;">
            <i data-lucide="calendar" style="width:16px; height:16px;"></i> Asignaciones Programadas (Pendientes)
          </h4>
          <div style="display:flex; flex-direction:column; gap:0.85rem;">
      `;
      
      pendientes.forEach(b => {
        let horasHtml = '';
        if (b.entrada && b.salida) {
          horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(139, 92, 246, 0.1); color:#8b5cf6; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida}</span>`;
        }
        
        const btnReportar = (['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode) && !isClosed) ? `
          <div style="margin-top:0.6rem; text-align:right;">
            <button class="btn-primary" onclick="iniciarReporteDesdeAsignacion('${o.id}', '${b.id}')" style="font-size:0.75rem; padding:0.3rem 0.6rem; display:inline-flex; align-items:center; gap:0.3rem; background:#8b5cf6; border-color:#8b5cf6; box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);">
              <i data-lucide="file-signature" style="width:12px; height:12px;"></i> Reportar Trabajo Realizado
            </button>
          </div>
        ` : '';

        // Formatear fecha legible
        let fechaFormateada = b.fecha;
        try {
          const dObj = new Date(b.fecha);
          if (!isNaN(dObj)) {
            fechaFormateada = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
            fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
          }
        } catch(e){}

        const esSupervisorOrAdmin = ['superadmin', 'admin', 'supervisor'].includes(currentSession.viewMode);
        const actionButtons = (esSupervisorOrAdmin && !isClosed) ? `
          <button class="action-btn" onclick="window.mostrarDetalleEventoAdministrativo('${b.id}')" style="margin-left:0.5rem;" title="Editar Asignación">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="action-btn del" onclick="window.eliminarAsignacionProgramadaDirecto('${o.id}', '${b.id}')" title="Eliminar Asignación">
            <i data-lucide="trash-2"></i>
          </button>
        ` : '';

        html += `
          <div style="background:var(--bg-body); border: 1px solid var(--border); border-left: 4px solid #8b5cf6; border-radius:8px; padding:0.85rem 1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:24px; height:24px; border-radius:50%; background:#8b5cf6; color:white; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">
                  ${(b.tecnico || 'T').charAt(0).toUpperCase()}
                </div>
                <div>
                  <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Sin asignar'}</span>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${fechaFormateada}${b.asignadoPorName ? ` &bull; Asignado por: ${b.asignadoPorName}` : ''}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span class="badge" style="background:rgba(139, 92, 246, 0.1); color:#8b5cf6; border-radius:99px; padding:0.15rem 0.45rem; font-size:0.65rem; font-weight:700;">PROGRAMADO</span>
                ${horasHtml}
                ${actionButtons}
              </div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:2.2rem; line-height:1.4; font-style:italic;">${b.nota}</div>
            ${btnReportar}
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }

    // 2. Renderizar Historial de Trabajo (Realizados)
    html += `
      <h4 style="font-size:0.82rem; font-weight:700; color:#10b981; text-transform:uppercase; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.4rem; letter-spacing:0.5px; margin-top: 1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
        <i data-lucide="clipboard-check" style="width:16px; height:16px;"></i> Historial de Trabajo (Realizado)
      </h4>
    `;

    if (realizados.length === 0) {
      html += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;text-align:center;padding:1.5rem;background:var(--bg-body);border-radius:6px;border:1px dashed var(--border);">Aún no hay reportes de trabajo diarios realizados.</p>';
    } else {
      // Agrupar por día
      const agrupado = {};
      realizados.forEach(b => {
        let fechaDia = 'Fecha Desconocida';
        let fechaDObj = null;
        try {
          fechaDObj = new Date(b.fecha);
          if (!isNaN(fechaDObj)) {
            const partes = fechaDObj.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).split('/');
            fechaDia = `${partes[2]}-${partes[1]}-${partes[0]}`; // YYYY-MM-DD
          }
        } catch(e){}
        if (!agrupado[fechaDia]) agrupado[fechaDia] = { objDate: fechaDObj, entries: [] };
        agrupado[fechaDia].entries.push(b);
      });

      // Ordenar días del más reciente al más antiguo
      const diasSorted = Object.keys(agrupado).sort((a, b) => b.localeCompare(a));

      html += '<div style="display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.5rem;">';
      
      diasSorted.forEach(diaKey => {
        const diaData = agrupado[diaKey];
        let displayDia = diaKey;
        let mesAbrev = '';
        let numDia = '';
        if (diaData.objDate && !isNaN(diaData.objDate)) {
          const dObj = diaData.objDate;
          displayDia = dObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
          displayDia = displayDia.charAt(0).toUpperCase() + displayDia.slice(1);
          mesAbrev = dObj.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');
          numDia = dObj.getUTCDate();
        }

        // Ordenar entradas dentro del día (por hora de entrada si existe)
        diaData.entries.sort((a,b) => (a.entrada || '').localeCompare(b.entrada || ''));

        let entriesHtml = diaData.entries.map(b => {
          let horasHtml = '';
          let desvHtml = '';

          if (b.desviacion) {
            if (b.desviacion === 'Alineado') {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(16, 185, 129, 0.08); color:#10b981; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(16, 185, 129, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="check-circle" style="width:11px;height:11px;"></i> Alineado</span>`;
            } else if (b.desviacion.startsWith('+')) {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(59, 130, 246, 0.08); color:#3b82f6; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(59, 130, 246, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-up" style="width:11px;height:11px;"></i> Desviación: ${b.desviacion}</span>`;
            } else {
              desvHtml = `<span style="display:inline-flex; align-items:center; gap:0.25rem; background:rgba(239, 68, 68, 0.08); color:#ef4444; padding:0.15rem 0.45rem; border-radius:12px; font-size:0.65rem; font-weight:600; border:1px solid rgba(239, 68, 68, 0.2); margin-left:0.4rem;" title="Programado original: ${b.programadoEntrada} a ${b.programadoSalida}"><i data-lucide="trending-down" style="width:11px;height:11px;"></i> Desviación: ${b.desviacion}</span>`;
            }
          }

          const isTrasladoRegreso = b.nota && b.nota.toLowerCase().includes('traslado de regreso');
          if (b.entrada && b.salida) {
            const [hE, mE] = b.entrada.split(':').map(Number);
            const [hS, mS] = b.salida.split(':').map(Number);
            let diff = (hS * 60 + mS) - (hE * 60 + mE);
            if (diff < 0) diff += 24 * 60; // Si pasa de medianoche
            const diffH = (diff / 60).toFixed(1);
            
            if (isTrasladoRegreso) {
              horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(232, 130, 12, 0.1); color:var(--accent); padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="car" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida} (${diffH}h)</span>`;
            } else {
              const hrs = Math.floor(diff / 60);
              const mns = diff % 60;
              const durStr = `${hrs}h ${mns > 0 ? mns + 'm' : ''}`.trim();
              horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(16, 185, 129, 0.1); color:#10b981; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${b.entrada} - ${b.salida} (${durStr})</span>${desvHtml}`;
            }
          } else if (b.entrada || b.salida) {
            horasHtml = `<span style="font-size:0.7rem; color:var(--text-muted);"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;"></i> ${b.entrada || '--:--'} a ${b.salida || '--:--'}</span>${desvHtml}`;
          } else if (b.horas_traslado || b.horas_regreso || isTrasladoRegreso) {
            const totalTraslado = (parseFloat(b.horas_traslado) || 0) + (parseFloat(b.horas_regreso) || 0);
            horasHtml = `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(71, 85, 105, 0.1); color:#475569; padding:0.15rem 0.5rem; border-radius:12px; font-size:0.7rem; font-weight:600;"><i data-lucide="car" style="width:12px;height:12px;"></i> Traslado: ${totalTraslado.toFixed(1)}h</span>${desvHtml}`;
          }

          const borderColor = isTrasladoRegreso ? '#475569' : '#10b981';
          const badgeBg = isTrasladoRegreso ? 'rgba(71, 85, 105, 0.1)' : 'rgba(16, 185, 129, 0.1)';
          const badgeText = isTrasladoRegreso ? '#475569' : '#10b981';

          return `
            <div style="background:var(--bg-body); border-left: 3px solid ${borderColor}; border-radius:4px; padding:0.75rem 1rem; margin-top:0.6rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div style="width:24px; height:24px; border-radius:50%; background:${borderColor}; color:white; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">
                    ${(b.tecnico || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${b.tecnico || 'Desconocido'}</span>
                  ${(['superadmin', 'admin'].includes(currentSession.viewMode) && (!isClosed || isTrasladoRegreso)) ? `<button class="action-btn" onclick="editarBitacora('${o.id}', '${b.id}')" title="Editar Bitácora" style="padding:0.15rem; margin-left:0.5rem;"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span class="badge" style="background:${badgeBg}; color:${badgeText}; border-radius:99px; padding:0.15rem 0.45rem; font-size:0.65rem; font-weight:700;">REPORTADO</span>
                  ${horasHtml}
                </div>
              </div>
              <div style="font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap; padding-left:2.2rem; line-height:1.4;">${b.nota}</div>
            </div>
          `;
        }).join('');

        html += `
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            <!-- Calendario Icono -->
            <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:center; width:50px; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="background:#10b981; color:white; width:100%; text-align:center; font-size:0.65rem; font-weight:bold; padding:0.25rem 0; letter-spacing:0.5px;">${mesAbrev}</div>
              <div style="font-size:1.3rem; font-weight:700; color:var(--text-primary); padding:0.3rem 0;">${numDia}</div>
            </div>
            <!-- Contenido del día -->
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:0.2rem; margin-top:0.2rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem;">${displayDia}</div>
              ${entriesHtml}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    const puedeLlenarBitacora = ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode);
    if (!isClosed && puedeLlenarBitacora) {
      html += `<div style="text-align:right; margin-top: 1rem;"><button class="btn-primary" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="abrirBitacora('${o.id}')"><i data-lucide="plus" style="width:14px;height:14px;"></i> Registrar Avance Diario</button></div>`;
    }
    
    // === VISTA DE IMPRESIÓN (TABLA COMPACTA) ===
    let tableHtml = '';
    if (items.length === 0) {
      tableHtml = '<p style="color:#000; font-size:0.8rem; font-style:italic;">Sin registros en la bitácora.</p>';
    } else {
      const sorted = [...items].sort((a, b) => {
        const dateA = a.fecha || '';
        const dateB = b.fecha || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.entrada || '';
        const timeB = b.entrada || '';
        return timeA.localeCompare(timeB);
      });

      tableHtml += `
        <table class="bitacora-print-table" style="width:100%; border-collapse:collapse; font-size:0.7rem; margin-top:0.5rem; color:#000; border:1px solid #d1d5db;">
          <thead>
            <tr style="background:#f3f4f6; text-align:left; border-bottom:1.5px solid #9ca3af;">
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:15%;">Fecha</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:20%;">Técnico</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:20%;">Horario</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:12%;">Estado</th>
              <th style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:600; width:33%;">Actividad / Avances Reportados</th>
            </tr>
          </thead>
          <tbody>
      `;

      sorted.forEach(b => {
        let fFormateada = b.fecha;
        try {
          const dObj = new Date(b.fecha);
          if (!isNaN(dObj)) {
            fFormateada = dObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
            fFormateada = fFormateada.replace('.', '');
          }
        } catch(e){}

        let hrsStr = '—';
        if (b.entrada && b.salida) {
          hrsStr = `${b.entrada} - ${b.salida}`;
          if (b.realizado) {
            try {
              const [hE, mE] = b.entrada.split(':').map(Number);
              const [hS, mS] = b.salida.split(':').map(Number);
              let diff = (hS * 60 + mS) - (hE * 60 + mE);
              if (diff < 0) diff += 24 * 60;
              const hrs = Math.floor(diff / 60);
              const mns = diff % 60;
              hrsStr += ` (${hrs}h${mns > 0 ? ' ' + mns + 'm' : ''})`;
            } catch(e){}
          }
        } else if (b.entrada || b.salida) {
          hrsStr = `${b.entrada || '--:--'} - ${b.salida || '--:--'}`;
        } else if (b.horas_traslado || b.horas_regreso) {
          const totalTraslado = (parseFloat(b.horas_traslado) || 0) + (parseFloat(b.horas_regreso) || 0);
          hrsStr = `Traslado: ${totalTraslado.toFixed(1)}h`;
        }

        let estadoStr = b.realizado ? 'REPORTADO' : 'PROGRAMADO';
        if (b.realizado && b.desviacion) {
          estadoStr += ` (${b.desviacion})`;
        }

        tableHtml += `
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:nowrap;">${fFormateada}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-weight:500;">${b.tecnico || '—'}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:nowrap;">${hrsStr}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; font-size:0.65rem; font-weight:600;">${estadoStr}</td>
            <td style="padding:0.35rem 0.5rem; border:1px solid #d1d5db; white-space:pre-wrap; line-height:1.3;">${b.nota || '—'}</td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
      `;
    }

    return `
      <div class="no-print">${html}</div>
      <div class="print-only">${tableHtml}</div>
    `;
  };

  const field = (label, val) => `
    <div class="detalle-field">
      <div class="detalle-label">${label}</div>
      <div class="detalle-value">${val || '—'}</div>
    </div>`;

  const seccion = (title, content) => `
    <div class="detalle-section">
      <div class="detalle-section-title">${title}</div>
      ${content}
    </div>`;

  const refTable = (items, hasPrice) => {
    if (!items?.length) return '<p style="color:var(--text-muted);font-size:0.82rem;">Sin refacciones</p>';
    return `<table class="detalle-ref-table">
      <thead><tr>
        <th>Descripción</th><th>Clave</th><th>Cant.</th>
        ${hasPrice ? '<th>Precio</th>' : ''}
      </tr></thead>
      <tbody>${items.map(r => `<tr>
        <td>${r.descripcion||'—'}</td>
        <td>${r.clave||'—'}</td>
        <td>${r.cantidad||'—'}</td>
        ${hasPrice ? `<td>$${r.precio||'0'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>`;
  };

  const diasRows = DIAS.map((dia, i) => {
    const d = o.dias?.[dia];
    if (!d || !d.fecha) return '';
    return `<tr>
      <td>${DIAS_LABEL[i]}</td>
      <td>${d.fecha||'—'}</td>
      <td>${d.entrada||'—'}</td>
      <td>${d.salida||'—'}</td>
      <td>${d.normales||'—'}</td>
      <td>${d.extras||'—'}</td>
    </tr>`;
  }).join('');

  const formatFecha = (fStr) => {
    if (!fStr) return '—';
    if (fStr.includes('T')) {
      const parts = fStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fStr;
  };

  document.getElementById('detalle-body').innerHTML = `
    <div class="print-only" style="text-align:center; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border);">
      <img src="logo_transparent.png" alt="Eurorep Logo" style="height:60px; object-fit:contain; margin-bottom:0.5rem;"/>
      <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary);">Orden de Servicio ${o.folio || ''}</h2>
      <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${formatFecha(o.fecha)}</p>
    </div>
    ${seccion('Información General', `
      <div class="detalle-grid">
        ${field('Folio', o.folio)} ${field('Pedido', o.pedido)} ${field('Fecha', formatFecha(o.fecha))}
        ${field('Cliente', o.cliente)} ${field('Ubicación (Ticket)', o.ubicacion)} ${field('Ubicación en Sitio', o.ubicacion_sitio)} ${field('Operador', o.operador)}
        ${field('No. ECO', o.eco)} ${field('Horómetro (Ticket)', o.horometro)} ${field('Horómetro Real', o.horometro_real)}
        ${field('Marca', (() => { 
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let m = o.marca || (o.equipo ? o.equipo.split(' ')[0] : '');
          return MARCAS_RENDER[m.toUpperCase()] || m || '—';
        })())} ${field('Modelo', o.modelo)} ${field('Serie', o.serie)}
        ${field('ID Máquina', (() => {
          let maq = null;
          if (o.maquinaria_id) {
            maq = maquinariaDb.find(m => m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas) {
                  const found = c.maquinas.find(m => m.id === o.maquinaria_id || m.idInterno === o.maquinaria_id);
                  if (found) maq = found;
                }
              });
            }
          } else if (o.serie) {
            maq = maquinariaDb.find(m => m.serie === o.serie);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas) {
                  const found = c.maquinas.find(m => m.serie === o.serie);
                  if (found) maq = found;
                }
              });
            }
          } else if (o.modelo && o.cliente) {
            maq = maquinariaDb.find(m => m.modelo === o.modelo && m.cliente === o.cliente);
            if (!maq) {
              clientesDb.forEach(c => {
                if (c.maquinas && c.nombre === o.cliente) {
                  const found = c.maquinas.find(m => m.modelo === o.modelo);
                  if (found) maq = found;
                }
              });
            }
          }
          return maq && (maq.idInterno || maq.id) ? `<span style="font-family:monospace; font-weight:600; color:var(--accent); background:var(--blue-light); padding:0.15rem 0.4rem; border-radius:4px; border:1px solid rgba(232, 133, 10, 0.3);">${maq.idInterno || maq.id}</span>` : '—';
        })())}
        ${field('Técnico', o.tecnico)} ${field('Ticket Soporte', (() => { const t = tickets.find(x => x.id === o.soporte); return t ? (t.folio || t.id.slice(0,8)) : o.soporte || null; })())}
      </div>`)}
    ${seccion('Kilómetros / Tipo', `
      <div class="detalle-grid">
        ${field('Origen → Trabajo', (o.km_ida != null && o.km_ida !== '') ? o.km_ida + ' km' : null)}
        ${field('Trabajo → Origen', (o.km_vuelta != null && o.km_vuelta !== '') ? o.km_vuelta + ' km' : null)}
        ${field('Total Km', (o.km_total != null && o.km_total !== '') ? o.km_total + ' km' : null)}
        ${field('Tipo de Visita', `<span class="badge badge-${(o.tipo||'otro').toLowerCase().replace(/ /g, '-').replace('é','e').replace('í','i')}">${o.tipo}</span>`)}
        ${field('Estado', `<span class="badge ${badgeEstado(o.estado)}">${o.estado}</span>`)}
      </div>
      ${o.reembolso_km ? `
        <div style="margin-top:1rem; display:flex; flex-direction:row; align-items:center; gap:1rem; flex-wrap:wrap;">
          ${(() => {
            const hasTrasladoRegreso = o.bitacora && o.bitacora.some(b => b.nota === 'Traslado de regreso desde el sitio de trabajo');
            return `
            <div style="display:flex; flex-direction:column; gap:0.25rem; padding:0.5rem 0.75rem; border-left:3px solid var(--accent); background:rgba(232, 130, 12, 0.08); border-radius:0 6px 6px 0; width:fit-content;">
              <div style="display:flex; align-items:center; gap:0.4rem; color:var(--accent); font-weight:700; font-size:0.85rem;">
                <i data-lucide="check-circle" style="width:14px;height:14px;"></i>
                Aplica Reembolso de KM
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem; color:var(--accent); font-size:0.75rem; font-weight:600; opacity:0.85;">
                <i data-lucide="${hasTrasladoRegreso ? 'check-check' : 'clock'}" style="width:13px;height:13px;"></i>
                ${hasTrasladoRegreso ? 'Traslado de regreso registrado' : 'A la espera de traslado de regreso'}
              </div>
            </div>
            ${(!hasTrasladoRegreso && ['tecnico', 'supervisor', 'superadmin', 'admin'].includes(currentSession.viewMode)) ? `
            <button class="btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.6rem; display:flex; align-items:center; gap:0.3rem;" onclick="abrirBitacora('${o.id}', 'Traslado de regreso desde el sitio de trabajo', true)">
              <i data-lucide="plus" style="width:12px;height:12px;"></i> Registrar Regreso
            </button>
            ` : ''}
            `;
          })()}
        </div>
      ` : `
        <div style="margin-top:1rem; display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.6rem; border:1px solid var(--border); background:var(--bg-secondary); border-radius:6px; width:fit-content;">
          <i data-lucide="x-circle" style="width:13px;height:13px;color:var(--text-muted);"></i>
          <span style="color:var(--text-muted); font-size:0.75rem; font-weight:500;">No aplica Reembolso de KM</span>
        </div>
      `}
    `)}
    ${seccion('Diagnóstico y Trabajos', `
      ${field('Falla reportada', o.falla)}
      <div style="margin-top:0.5rem">${field('Trabajos realizados', o.trabajos)}</div>
      <div style="margin-top:0.5rem">${field('Dictamen', o.dictamen)}</div>
      <div style="margin-top:0.5rem">${field('Condiciones del equipo', o.condiciones)}</div>
      <div style="margin-top:0.5rem">${field('Observaciones', o.observaciones)}</div>
      <div style="margin-top:0.5rem">${field('Pendientes', o.pendientes)}</div>`)}
    ${seccion('Refacciones Utilizadas', refTable(o.ref_utilizadas, false))}
    ${seccion('Refacciones Necesarias', refTable(o.ref_necesarias, false))}
    ${(o.noches || o.alimentacion || o.traslado_costo) ? seccion('Fecha de Servicio', `
      <div class="detalle-grid">
        ${field('No. Noches', o.noches)} ${field('Alimentación', o.alimentacion)} ${field('Traslado', o.traslado_costo)}
      </div>`) : ''}
    ${seccion('Bitácora Diaria', renderBitacora(o))}
    ${seccion('Evidencias Fotográficas', renderEvidenciasFotograficas(o))}
    
    ${o.cierre_papel_pdf ? (() => {
      let tecnicosHorasHtml = '';
      if (o.cierre_papel_tecnicos_horas && o.cierre_papel_tecnicos_horas.length > 0) {
        let rowsHtml = o.cierre_papel_tecnicos_horas.map(item => {
          const horasVal = item.horas !== undefined && item.horas !== '' ? `${item.horas} hrs` : '—';
          const trayectosVal = item.trayectos !== undefined && item.trayectos !== '' ? `${item.trayectos} tray.` : '—';
          const idaVal = item.ida !== undefined && item.ida !== '' ? `${item.ida} hrs` : '—';
          const regresoVal = item.regreso !== undefined && item.regreso !== '' ? `${item.regreso} hrs` : '—';
          
          let fechaVal = '—';
          if (item.fecha_inicio && item.fecha_fin && item.fecha_inicio !== item.fecha_fin) {
            const pIni = item.fecha_inicio.split('-');
            const pFin = item.fecha_fin.split('-');
            const fIniFormateada = pIni.length === 3 ? `${pIni[2]}/${pIni[1]}` : item.fecha_inicio;
            const fFinFormateada = pFin.length === 3 ? `${pFin[2]}/${pFin[1]}/${pFin[0]}` : item.fecha_fin;
            fechaVal = `${fIniFormateada} al ${fFinFormateada}`;
          } else {
            const rawFecha = item.fecha_inicio || item.fecha || item.dias;
            if (rawFecha && rawFecha !== '') {
              if (rawFecha.includes('-')) {
                const parts = rawFecha.split('-');
                if (parts.length === 3) {
                  fechaVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                  fechaVal = rawFecha;
                }
              } else {
                fechaVal = rawFecha;
              }
            }
          }
          
          return `
            <tr style="border-bottom:1px solid rgba(79, 70, 229, 0.1);">
              <td style="padding:0.5rem; font-weight:600; color:var(--text-primary); text-align:left;">${item.tecnico}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${horasVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${fechaVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${idaVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${regresoVal}</td>
              <td style="padding:0.5rem; text-align:center; font-weight:700; color:var(--accent);">${trayectosVal}</td>
            </tr>
          `;
        }).join('');
        
        tecnicosHorasHtml = `
          <div style="margin-top:0.75rem;">
            <strong style="font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Personal de Trabajo Detallado:</strong>
            <div style="border:1px solid rgba(79, 70, 229, 0.15); border-radius:8px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; background:rgba(255,255,255,0.01);">
                <thead>
                  <tr style="background:rgba(79, 70, 229, 0.08); text-align:left; color:#4f46e5; font-weight:700; font-size:0.8rem; border-bottom:1px solid rgba(79, 70, 229, 0.15);">
                    <th style="padding:0.5rem; text-align:left; width: 32%;">Técnico</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Horas</th>
                    <th style="padding:0.5rem; text-align:center; width: 18%;">Fecha</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Ida</th>
                    <th style="padding:0.5rem; text-align:center; width: 12%;">Regreso</th>
                    <th style="padding:0.5rem; text-align:center; width: 14%;">Trayectos</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      
      return seccion('Cierre de Orden en Papel', `
        <div style="background:rgba(79, 70, 229, 0.04); border:1px solid rgba(79, 70, 229, 0.15); border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:0.5rem; color:#4f46e5; font-weight:700; font-size:1rem; border-bottom:1px solid rgba(79, 70, 229, 0.15); padding-bottom:0.4rem; margin-bottom:0.2rem;">
            <i data-lucide="file-check" style="width:18px; height:18px;"></i>
            Esta orden fue cerrada físicamente (formato papel)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem; font-size:0.85rem;">
            <div><strong>Autorizado por:</strong> ${o.cierre_papel_usuario || '—'}</div>
            <div><strong>Fecha de cierre:</strong> ${o.cierre_papel_fecha ? new Date(o.cierre_papel_fecha).toLocaleString('es-MX', {dateStyle: 'medium', timeStyle: 'short'}) : '—'}</div>
          </div>
          <div style="font-size:0.85rem; margin-top:0.25rem; background:var(--bg-secondary); padding:0.6rem; border-radius:6px; border-left:4px solid #4f46e5;">
            <strong>Justificación / Motivo:</strong><br>
            <span style="font-style:italic; color:var(--text-secondary); display:block; margin-top:0.2rem;">${o.cierre_papel_motivo || '—'}</span>
          </div>
          
          ${tecnicosHorasHtml}
          
          <div style="margin-top:0.4rem; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <a href="${o.cierre_papel_pdf}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:0.35rem; text-decoration:none; background:#4f46e5; border-color:#4f46e5; color:white; padding:0.4rem 0.8rem; border-radius:6px; font-size:0.8rem; font-weight:600;">
                <i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir PDF
              </a>
              <button class="btn-secondary" onclick="document.getElementById('cp-pdf-iframe-container').style.display = document.getElementById('cp-pdf-iframe-container').style.display === 'none' ? 'block' : 'none';" style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.8rem; padding:0.4rem 0.8rem; border:1px solid var(--border); background:var(--bg-card); cursor:pointer;">
                <i data-lucide="eye" style="width:14px;height:14px;"></i> Vista Previa
              </button>
            </div>
            <div id="cp-pdf-iframe-container" style="display:none; margin-top:0.5rem; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:white;">
              <iframe src="${o.cierre_papel_pdf}" style="width:100%; height:550px; border:none; display:block;"></iframe>
            </div>
          </div>
        </div>
      `);
    })() : seccion('Firmas de Conformidad', `
      <div style="display:flex; flex-wrap:wrap; gap:2rem; margin-top:1rem; justify-content:center;">
        
        <!-- TECNICO -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Técnico</h4>
          ${(o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__')
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_tecnico_base64}" alt="Firma del técnico" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_tecnico_nombre || o.tecnico || 'Técnico'}</p>
                 ${o.firma_tecnico_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_tecnico_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               ${currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin' ? `<button class="btn-secondary" onclick="console.log('Borrando tecnico...'); limpiarFirma('${o.id}', 'tecnico')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Borrar firma (Admin)</button>` : ''}` 
            : (() => {
                const ev = o.evidencias || {};
                const tieneObligatorias = !!(ev.fotoInicio && ev.fotoFin);
                const tieneUbicacionSitio = !!(o.ubicacion_sitio && o.ubicacion_sitio.trim());
                const tieneOperador = !!(o.operador && o.operador.trim());
                if (!tieneObligatorias || !tieneUbicacionSitio || !tieneOperador) {
                  let faltantes = [];
                  if (!tieneUbicacionSitio) faltantes.push("la <strong>Ubicación en Sitio</strong>");
                  if (!tieneOperador) faltantes.push("el <strong>Operador</strong>");
                  if (!tieneObligatorias) faltantes.push("la <strong>Foto de Inicio y Fin</strong>");
                  
                  let msg = `Debes registrar ${faltantes.join(', ')} para habilitar la firma del técnico.`;
                  const lastCommaIdx = msg.lastIndexOf(', ');
                  if (lastCommaIdx !== -1) {
                    msg = msg.substring(0, lastCommaIdx) + ' y ' + msg.substring(lastCommaIdx + 2);
                  }
                  
                  return `
                    <div style="width:100%; text-align:center; padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 0.85rem; background:var(--bg-body); display:flex; flex-direction:column; align-items:center; gap:0.4rem;">
                      <i data-lucide="alert-circle" style="width:24px;height:24px;color:var(--accent);opacity:0.7;"></i>
                      <span>${msg}</span>
                    </div>
                  `;
                }
                return `
                  <div style="width:100%;">
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                    <canvas id="firma-tecnico-canvas" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                      <button class="btn-secondary" onclick="borrarCanvasFirma('tecnico')" style="flex:1;">Borrar</button>
                      <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'tecnico')" style="flex:2;">Guardar Firma Técnico</button>
                    </div>
                  </div>
                `;
              })()
          }
        </div>

        <!-- CLIENTE -->
        <div style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; align-items:center;">
          <h4 style="margin-bottom:1rem; color:var(--text-primary); font-size:1rem;">Firma del Cliente</h4>
          ${(o.firma_cliente_base64 && o.firma_cliente_base64 !== '__DELETED__')
            ? `<div style="border:1px solid var(--border); border-radius:8px; padding:1rem; background:white; width:100%;">
                 <img src="${o.firma_cliente_base64}" alt="Firma del cliente" style="max-width:100%; max-height:150px; display:block; margin:0 auto;"/>
                 <p style="text-align:center; color:var(--text-primary); font-weight:600; font-size:0.85rem; margin-top:0.5rem; margin-bottom:0;">${o.firma_cliente_nombre || o.cliente || 'Cliente'}</p>
                 ${o.firma_cliente_fecha ? `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; margin-bottom:0;">${new Date(o.firma_cliente_fecha).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</p>` : ''}
               </div>
               ${currentSession.viewMode === 'admin' || currentSession.viewMode === 'superadmin' ? `<button class="btn-secondary" onclick="console.log('Borrando cliente...'); limpiarFirma('${o.id}', 'cliente')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Volver a firmar</button>` : `<button class="btn-secondary" onclick="limpiarFirma('${o.id}', 'cliente')" style="font-size:0.8rem; margin-top:1rem;"><i data-lucide="eraser" style="width:14px;height:14px;"></i> Volver a firmar</button>`}` 
            : ((!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__') 
               ? `<div style="width:100%; text-align:center; padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 0.9rem;">
                    <i data-lucide="lock" style="width:24px;height:24px;margin-bottom:0.5rem;"></i><br>
                    El técnico debe firmar primero para habilitar la firma del cliente.
                  </div>`
               : `<div style="width:100%;">
                 <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Firme en el recuadro blanco usando el dedo o mouse:</p>
                 <input type="text" id="nombre-firma-cliente" class="form-control" placeholder="Nombre completo de quien firma" style="margin-bottom:0.5rem; font-size:0.85rem; padding:0.4rem;"/>
                 <canvas id="firma-cliente-canvas" style="width:100%; height:150px; background:white; border:2px dashed var(--border); border-radius:8px; cursor:crosshair; touch-action:none;"></canvas>
                 <div style="display:flex; gap:0.5rem; margin-top:0.5rem; justify-content:space-between;">
                   <button class="btn-secondary" onclick="borrarCanvasFirma('cliente')" style="flex:1;">Borrar</button>
                   <button class="btn-primary" onclick="guardarFirmaCanvas('${o.id}', 'cliente')" style="flex:2;">Guardar Firma Cliente</button>
                 </div>
               </div>`)
          }
        </div>
        
      </div>
    `)}
  `;

  document.getElementById('modal-detalle-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
  
  setTimeout(() => {
    if (!o.cierre_papel_pdf) {
      if ((!o.firma_tecnico_base64 || o.firma_tecnico_base64 === '__DELETED__')) inicializarCanvasFirma('tecnico');
      if ((o.firma_tecnico_base64 && o.firma_tecnico_base64 !== '__DELETED__') && (!o.firma_cliente_base64 || o.firma_cliente_base64 === '__DELETED__')) inicializarCanvasFirma('cliente');
    }
  }, 100);
}

function agregarRenglonTecnicoCierre(tecnicoNombre = '', horas = '', fecha_inicio = '', fecha_fin = '', trayectos = '', ida = '', regreso = '', existingId = '') {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('cp-tecnicos-lista');
  if (!container) return;
  const rowId = existingId || ('cp-' + crypto.randomUUID());
  const div = document.createElement('div');
  div.id = rowId;
  div.style.display = 'flex';
  div.style.gap = '0.35rem';
  div.style.alignItems = 'center';
  div.style.marginBottom = '0.25rem';
  
  let options = '<option value="">-- Seleccionar Técnico --</option>';
  const sortedUsers = [...usuarios].sort((a,b) => a.nombre.localeCompare(b.nombre));
  sortedUsers.forEach(u => {
    const selected = u.nombre === tecnicoNombre ? 'selected' : '';
    options += `<option value="${u.nombre}" ${selected}>${u.nombre}</option>`;
  });
  
  div.innerHTML = `
    <select class="cp-tecnico-select" required style="flex:2; min-width:130px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;">
      ${options}
    </select>
    <input type="number" class="cp-tecnico-horas" step="0.5" min="0" value="${horas}" placeholder="Hrs/Día" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Horas Trabajadas por Día" />
    <input type="date" class="cp-tecnico-fecha-inicio" value="${fecha_inicio}" required style="flex:1.8; min-width:115px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Fecha de Inicio" />
    <input type="date" class="cp-tecnico-fecha-fin" value="${fecha_fin}" style="flex:1.8; min-width:115px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Fecha de Fin (Opcional)" />
    <input type="number" class="cp-tecnico-ida" step="0.5" min="0" value="${ida}" placeholder="Ida" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Ida (Horas de Traslado)" />
    <input type="number" class="cp-tecnico-regreso" step="0.5" min="0" value="${regreso}" placeholder="Regreso" required style="flex:1; min-width:60px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Regreso (Horas de Retorno)" />
    <input type="number" class="cp-tecnico-trayectos" step="0.5" min="0" value="${trayectos}" placeholder="Tray." required style="flex:1.2; min-width:75px; padding:0.4rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.85rem;" title="Número de Trayectos" />
    <div style="display:flex; gap:0.25rem; flex-shrink:0;">
      <button type="button" onclick="window.agregarRenglonTecnicoCierre(document.querySelector('#${rowId} .cp-tecnico-select').value)" class="action-btn" style="padding:0.35rem; display:inline-flex; align-items:center; justify-content:center; background:rgba(79, 70, 229, 0.08); color:#4f46e5; border:1px solid rgba(79, 70, 229, 0.15);" title="Copiar técnico"><i data-lucide="copy" style="width:14px; height:14px;"></i></button>
      <button type="button" onclick="document.getElementById('${rowId}').remove()" class="action-btn del" style="padding:0.35rem; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
    </div>
  `;
  container.appendChild(div);
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

function abrirCierrePapel(ordenId) {
  if (typeof document === 'undefined') return;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  // Guardar ID
  document.getElementById('cp-orden-id').value = ordenId;
  
  // Resetear el formulario
  document.getElementById('form-cierre-papel').reset();
  
  // Limpiar lista de técnicos y pre-poblar
  const container = document.getElementById('cp-tecnicos-lista');
  if (container) container.innerHTML = '';
  
  let tecnicosLista = [];
  if (o.cierre_papel_tecnicos_horas && o.cierre_papel_tecnicos_horas.length > 0) {
    tecnicosLista = o.cierre_papel_tecnicos_horas.map(item => ({
      id: item.id || ('cp-' + crypto.randomUUID()),
      tecnico: item.tecnico,
      horas: item.horas,
      fecha_inicio: item.fecha_inicio || item.fecha || item.dias || '',
      fecha_fin: item.fecha_fin || item.fecha_inicio || item.fecha || item.dias || '',
      trayectos: item.trayectos,
      ida: item.ida !== undefined ? item.ida : '',
      regreso: item.regreso !== undefined ? item.regreso : ''
    }));
  } else if (o.tecnicosAsignados && o.tecnicosAsignados.length > 0) {
    tecnicosLista = o.tecnicosAsignados.map(t => ({ id: 'cp-' + crypto.randomUUID(), tecnico: t, horas: '', fecha_inicio: '', fecha_fin: '', trayectos: '', ida: '', regreso: '' }));
  } else if (o.tecnico) {
    tecnicosLista = o.tecnico.split(',').map(t => t.trim()).filter(Boolean).map(t => ({ id: 'cp-' + crypto.randomUUID(), tecnico: t, horas: '', fecha_inicio: '', fecha_fin: '', trayectos: '', ida: '', regreso: '' }));
  }
  
  tecnicosLista.forEach(item => {
    window.agregarRenglonTecnicoCierre(item.tecnico, item.horas, item.fecha_inicio, item.fecha_fin, item.trayectos, item.ida, item.regreso, item.id);
  });
  
  // Abrir modal
  document.getElementById('modal-cierre-papel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
};

function cerrarCierrePapel(e) {
  if (typeof document === 'undefined') return;
  if (e && e.target !== document.getElementById('modal-cierre-papel-overlay') && e.target !== document.querySelector('#modal-cierre-papel .modal-close') && e.target.tagName !== 'BUTTON') {
    if (e.target.closest('#modal-cierre-papel')) return;
  }
  document.getElementById('modal-cierre-papel-overlay').classList.remove('open');
  if (!document.getElementById('modal-detalle-overlay').classList.contains('open')) {
    document.body.style.overflow = '';
  }
};

async function confirmarCierrePapel(e) {
  if (typeof document === 'undefined') return;
  e.preventDefault();
  
  const ordenId = document.getElementById('cp-orden-id').value;
  const o = ordenes.find(x => x.id === ordenId);
  if (!o) return;
  
  const fileInput = document.getElementById('cp-pdf-file');
  const file = fileInput.files[0];
  if (!file) {
    mostrarNotificacion('Por favor, seleccione un archivo PDF.', 'warning');
    return;
  }
  
  const nuevoEstado = document.getElementById('cp-estado').value;
  const motivo = document.getElementById('cp-motivo').value.trim();
  if (motivo.length < 5) {
    mostrarNotificacion('Por favor, ingrese un motivo de al menos 5 caracteres.', 'warning');
    return;
  }

  const rows = document.querySelectorAll('#cp-tecnicos-lista > div');
  const tecnicosHoras = [];
  let isInvalid = false;
  for (const row of rows) {
    const rowId = row.id;
    const tecnicoSelect = row.querySelector('.cp-tecnico-select');
    const horasInput = row.querySelector('.cp-tecnico-horas');
    const fechaInicioInput = row.querySelector('.cp-tecnico-fecha-inicio');
    const fechaFinInput = row.querySelector('.cp-tecnico-fecha-fin');
    const trayectosInput = row.querySelector('.cp-tecnico-trayectos');
    const idaInput = row.querySelector('.cp-tecnico-ida');
    const regresoInput = row.querySelector('.cp-tecnico-regreso');
    
    if (tecnicoSelect && horasInput && fechaInicioInput && fechaFinInput && trayectosInput && idaInput && regresoInput) {
      const tecnico = tecnicoSelect.value;
      const horasVal = horasInput.value.trim();
      const fechaInicioVal = fechaInicioInput.value.trim();
      const fechaFinVal = fechaFinInput.value.trim() || fechaInicioVal;
      const trayectosVal = trayectosInput.value.trim();
      const idaVal = idaInput.value.trim();
      const regresoVal = regresoInput.value.trim();
      
      const hasAnyVal = horasVal || fechaInicioVal || fechaFinInput.value.trim() || trayectosVal || idaVal || regresoVal;
      
      if (!tecnico && hasAnyVal) {
        mostrarNotificacion('Debe seleccionar un técnico para los datos ingresados.', 'warning');
        isInvalid = true;
        break;
      }
      if (tecnico && (!horasVal || !fechaInicioVal || !trayectosVal || !idaVal || !regresoVal)) {
        mostrarNotificacion('Debe ingresar las horas, la fecha de inicio, la ida, el regreso y los trayectos para el técnico seleccionado.', 'warning');
        isInvalid = true;
        break;
      }
      
      if (tecnico && horasVal && fechaInicioVal && trayectosVal && idaVal && regresoVal) {
        const hrs = parseFloat(horasVal);
        const trs = parseFloat(trayectosVal);
        const ida = parseFloat(idaVal);
        const regreso = parseFloat(regresoVal);
        
        if (isNaN(hrs) || hrs < 0 || isNaN(trs) || trs < 0 || isNaN(ida) || ida < 0 || isNaN(regreso) || regreso < 0) {
          mostrarNotificacion('Los valores de horas, ida, regreso y trayectos deben ser números mayores o iguales a cero.', 'warning');
          isInvalid = true;
          break;
        }
        
        if (new Date(fechaFinVal) < new Date(fechaInicioVal)) {
          mostrarNotificacion('La fecha de fin no puede ser anterior a la fecha de inicio.', 'warning');
          isInvalid = true;
          break;
        }
        
        tecnicosHoras.push({
          id: rowId,
          tecnico,
          horas: hrs,
          fecha_inicio: fechaInicioVal,
          fecha_fin: fechaFinVal,
          trayectos: trs,
          ida,
          regreso
        });
      }
    }
  }
  if (isInvalid) return;
  
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  let originalBtnText = '';
  if (btnSubmit) {
    originalBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="rotating" data-lucide="loader-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Guardando...';
    lucide.createIcons();
  }
  
  let publicUrl = null;
  const timestamp = Date.now();
  const uniqueName = `cierre_papel_${timestamp}_${Math.random().toString(36).substring(2,7)}.pdf`;
  const filePath = `ordenes/${ordenId}/${uniqueName}`;
  
  if (!navigator.onLine || !window.supabaseClient) {
    try {
      mostrarNotificacion('Guardando archivo localmente (Modo Offline)...', 'info');
      const blobToBase64 = (blob) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      };
      publicUrl = await blobToBase64(file);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Fallo al procesar el archivo en modo offline.', 'error');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
        lucide.createIcons();
      }
      return;
    }
  } else {
    try {
      mostrarNotificacion('Subiendo PDF a Supabase Storage...', 'info');
      const { data: uploadData, error: uploadErr } = await window.supabaseClient.storage
        .from('evidencias')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (uploadErr) throw uploadErr;
      
      const { data: urlData } = window.supabaseClient.storage
        .from('evidencias')
        .getPublicUrl(filePath);
        
      publicUrl = urlData.publicUrl;
    } catch (err) {
      console.warn("Fallo la subida directa a Supabase. Guardando offline:", err);
      try {
        const blobToBase64 = (blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        };
        publicUrl = await blobToBase64(file);
      } catch (baseErr) {
        console.error(baseErr);
        mostrarNotificacion('Error al guardar el archivo localmente.', 'error');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalBtnText;
          lucide.createIcons();
        }
        return;
      }
    }
  }
  
  const idx = ordenes.findIndex(x => x.id === ordenId);
  if (idx !== -1) {
    const currentUser = usuarios.find(u => u.id === currentSession.userId);
    const usuarioNombre = currentUser ? currentUser.nombre : (currentSession.nombre || 'Supervisor');
    
    ordenes[idx].cierre_papel_pdf = publicUrl;
    ordenes[idx].cierre_papel_motivo = motivo;
    ordenes[idx].cierre_papel_usuario = usuarioNombre;
    ordenes[idx].cierre_papel_fecha = new Date().toISOString();
    ordenes[idx].cierre_papel_tecnicos_horas = tecnicosHoras;
    ordenes[idx].estado = nuevoEstado;

    // Sincronizar con la bitácora para reflejar en el calendario
    if (!ordenes[idx].bitacora) ordenes[idx].bitacora = [];

    // Expandir cada rango en entradas de un día individuales
    const obtenerFechasEnRango = (inicio, fin) => {
      const fechas = [];
      let current = new Date(inicio + 'T00:00:00');
      const end = new Date(fin + 'T00:00:00');
      while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        fechas.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
      }
      return fechas;
    };

    const expandedEntries = [];
    tecnicosHoras.forEach(row => {
      const fechas = obtenerFechasEnRango(row.fecha_inicio, row.fecha_fin);
      fechas.forEach(f => {
        expandedEntries.push({
          id: `${row.id}-${f}`,
          tecnico: row.tecnico,
          horas: row.horas,
          fecha: f,
          trayectos: row.trayectos,
          ida: row.ida,
          regreso: row.regreso
        });
      });
    });

    // Filtrar entradas obsoletas de cierre en papel en o.bitacora
    ordenes[idx].bitacora = ordenes[idx].bitacora.filter(b => {
      if (b.cierre_papel) {
        return expandedEntries.some(ee => ee.id === b.id);
      }
      return true;
    });

    // Limpiar eventos eliminados del calendario
    try {
      const localEventos = JSON.parse(localStorage.getItem('sapi_calendario_eventos') || '[]');
      const updatedEventos = [];
      for (const ev of localEventos) {
        if (ev.ordenId === ordenId && ev.id) {
          const cleanEvId = String(ev.id).replace('bit-', '');
          const isPaperClosureEvent = cleanEvId.startsWith('cp-');
          if (isPaperClosureEvent) {
            const stillExists = ordenes[idx].bitacora.some(b => b.id === cleanEvId || b.id === ev.id || `bit-${b.id}` === ev.id);
            if (!stillExists) {
              if (window.deleteFromSupabase) {
                window.deleteFromSupabase('calendario_eventos', ev.id);
              }
              if (window.deleteFromSupabase) {
                window.deleteFromSupabase('calendario_eventos', `bit-traslado-ida-${cleanEvId}`);
                window.deleteFromSupabase('calendario_eventos', `bit-traslado-regreso-${cleanEvId}`);
              }
              continue;
            }
          }
        }
        updatedEventos.push(ev);
      }
      localStorage.setItem('sapi_calendario_eventos', JSON.stringify(updatedEventos));
    } catch (e) {
      console.error('Error al limpiar eventos del calendario:', e);
    }

    // Crear/actualizar entradas y actualizar calendario
    expandedEntries.forEach(ee => {
      let bEntry = ordenes[idx].bitacora.find(b => b.id === ee.id);
      
      const entrada = '08:00';
      const baseHour = 8;
      const totalHours = parseFloat(ee.horas);
      const endHour = baseHour + totalHours;
      const endHH = Math.floor(endHour).toString().padStart(2, '0');
      const endMM = Math.round((endHour % 1) * 60).toString().padStart(2, '0');
      const salida = `${endHH}:${endMM}`;
      
      if (bEntry) {
        bEntry.fecha = ee.fecha;
        bEntry.tecnico = ee.tecnico;
        bEntry.realizado = true;
        bEntry.entrada = entrada;
        bEntry.salida = salida;
        bEntry.horas_traslado = ee.ida || null;
        bEntry.horas_regreso = ee.regreso || null;
        if (!bEntry.nota || !bEntry.nota.includes('Cierre en papel')) {
          bEntry.nota = `Cierre en papel: ${motivo}. ` + (bEntry.nota || '');
        }
        bEntry.cierre_papel = true;
      } else {
        bEntry = {
          id: ee.id,
          fecha: ee.fecha,
          tecnico: ee.tecnico,
          tipo: 'Servicio',
          nota: `Cierre en papel: ${motivo}`,
          entrada: entrada,
          salida: salida,
          horas_traslado: ee.ida || null,
          horas_regreso: ee.regreso || null,
          realizado: true,
          cierre_papel: true,
          asignadoPorName: usuarioNombre,
          asignadoPorId: currentSession.userId || null
        };
        ordenes[idx].bitacora.push(bEntry);
      }
      
      if (typeof actualizarEventoCalendarioDesdeBitacora === 'function') {
        actualizarEventoCalendarioDesdeBitacora(ordenes[idx], bEntry);
      }
    });

    try {
      safeSetJSON('sapi_ordenes', ordenes);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error al guardar en almacenamiento local.', 'error');
    }
    
    if (window.pushToSupabase) {
      window.pushToSupabase('ordenes', ordenes[idx]).catch(err => {
        console.error('Error al sincronizar con la nube:', err);
      });
    }
    
    mostrarNotificacion('Orden cerrada correctamente.', 'success');
    
    cerrarCierrePapel();
    verDetalle(ordenId);
    
    try {
      renderTabla();
      renderTabla('servicios');
    } catch (e) {
      console.error('Error al refrescar tablas:', e);
    }
  }
};

// ===== LOGICA DEL CANVAS DE FIRMA =====
let canvasesFirma = {
  tecnico: { canvas: null, ctx: null, dibujando: false },
  cliente: { canvas: null, ctx: null, dibujando: false }
};

function inicializarCanvasFirma(tipo) {
  if (typeof document === 'undefined') return;
  const c = document.getElementById(`firma-${tipo}-canvas`);
  if (!c) return;
  const ctx = c.getContext('2d');
  
  canvasesFirma[tipo].canvas = c;
  canvasesFirma[tipo].ctx = ctx;
  
  // Asegurar dimensiones reales de renderizado para evitar deformación por escala CSS y desfases de toque
  const parentWidth = c.parentElement ? c.parentElement.clientWidth : 0;
  c.width = c.offsetWidth || c.clientWidth || parentWidth || 320;
  c.height = c.offsetHeight || c.clientHeight || 150;
  
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000000';

  // Manejo responsivo y fluido ante rotación o redimensionamiento del celular del técnico
  if (canvasesFirma[tipo].resizeHandler) {
    window.removeEventListener('resize', canvasesFirma[tipo].resizeHandler);
  }
  
  const resizeHandler = () => {
    if (!c) return;
    const currentWidth = c.offsetWidth || c.clientWidth || (c.parentElement ? c.parentElement.clientWidth : 0) || 320;
    if (c.width !== currentWidth) {
      let tempImage = null;
      try {
        tempImage = ctx.getImageData(0, 0, c.width, c.height);
      } catch(e) {}
      
      c.width = currentWidth;
      c.height = c.offsetHeight || c.clientHeight || 150;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
      
      if (tempImage) {
        try {
          ctx.putImageData(tempImage, 0, 0);
        } catch(e) {}
      }
    }
  };
  
  canvasesFirma[tipo].resizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  const startDraw = (e) => { canvasesFirma[tipo].dibujando = true; ctx.beginPath(); ctx.moveTo(getX(e, c), getY(e, c)); e.preventDefault(); };
  const draw = (e) => { if(!canvasesFirma[tipo].dibujando) return; ctx.lineTo(getX(e, c), getY(e, c)); ctx.stroke(); e.preventDefault(); };
  const stopDraw = () => { canvasesFirma[tipo].dibujando = false; ctx.closePath(); };

  const getX = (e, canvas) => e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.clientX - canvas.getBoundingClientRect().left;
  const getY = (e, canvas) => e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.clientY - canvas.getBoundingClientRect().top;

  c.addEventListener('mousedown', startDraw);
  c.addEventListener('mousemove', draw);
  c.addEventListener('mouseup', stopDraw);
  c.addEventListener('mouseout', stopDraw);
  
  c.addEventListener('touchstart', startDraw, {passive: false});
  c.addEventListener('touchmove', draw, {passive: false});
  c.addEventListener('touchend', stopDraw);
}

function borrarCanvasFirma(tipo) {
  if (typeof document === 'undefined') return;
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (ctx && c) {
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

function guardarFirmaCanvas(ordenId, tipo) {
  if (typeof document === 'undefined') return;
  const c = canvasesFirma[tipo].canvas;
  const ctx = canvasesFirma[tipo].ctx;
  if (!c) return;
  
  const isBlank = !ctx.getImageData(0, 0, c.width, c.height).data.some(channel => channel !== 0);
  if (isBlank) {
    mostrarNotificacion(`Por favor firme como ${tipo} antes de guardar.`, 'warning');
    return;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = c.width;
  tempCanvas.height = c.height;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.fillStyle = '#FFFFFF';
  tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tCtx.drawImage(c, 0, 0);
  
  const base64Firma = tempCanvas.toDataURL('image/jpeg', 0.5);
  
  const idx = ordenes.findIndex(o => o.id === ordenId);
  if (idx !== -1) {
    if (ordenes[idx].cierre_papel_pdf) {
      mostrarNotificacion('No se pueden registrar firmas en una orden cerrada en papel.', 'error');
      return;
    }
    const fechaFirma = new Date().toISOString();
    
    const ev = ordenes[idx].evidencias || {};
    const oObj = ordenes[idx];
    const tieneUbicacionSitio = !!(oObj.ubicacion_sitio && oObj.ubicacion_sitio.trim());
    const tieneOperador = !!(oObj.operador && oObj.operador.trim());
    const tieneObligatorias = !!(ev.fotoInicio && ev.fotoFin);
    
    if (!tieneObligatorias || !tieneUbicacionSitio || !tieneOperador) {
      let faltantes = [];
      if (!tieneUbicacionSitio) faltantes.push("Ubicación en Sitio");
      if (!tieneOperador) faltantes.push("Operador");
      if (!tieneObligatorias) faltantes.push("Fotos de Inicio y Fin");
      mostrarNotificacion('Debes registrar: ' + faltantes.join(', ') + ' antes de guardar la firma.', 'error');
      return;
    }

    if (tipo === 'tecnico') {
      const currentUser = usuarios.find(u => u.id === currentSession.userId);
      ordenes[idx].firma_tecnico_base64 = base64Firma;
      ordenes[idx].firma_tecnico_nombre = currentUser ? currentUser.nombre : (currentSession.nombre || ordenes[idx].tecnico || 'Técnico');
      ordenes[idx].firma_tecnico_fecha = fechaFirma;
    } else {
      ordenes[idx].firma_cliente_base64 = base64Firma;
      ordenes[idx].firma_cliente_nombre = document.getElementById('nombre-firma-cliente')?.value || ordenes[idx].cliente || 'Cliente';
      ordenes[idx].firma_cliente_fecha = fechaFirma;
    }
    
    ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
    
    try {
      safeSetJSON('sapi_ordenes', ordenes);
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error de almacenamiento local. La firma puede no guardarse si no hay espacio.', 'error');
    }
    
    if (window.pushToSupabase) {
      window.pushToSupabase('ordenes', ordenes[idx]).catch(err => {
         console.error('Error supabase:', err);
         mostrarNotificacion('Error guardando en la nube', 'error');
      });
    }

    if (window.trackTelemetryEvent) {
      const act = tipo === 'tecnico' ? 'Firma de Técnico (Orden Completada)' : 'Firma de Cliente (Orden Firmada)';
      window.trackTelemetryEvent(act, { id: ordenId, folio: ordenes[idx].folio, cliente: ordenes[idx].cliente });
    }
    
    mostrarNotificacion(`Firma del ${tipo} guardada`, 'success');
    verDetalle(ordenId); 
    renderTabla();
    renderTabla('servicios');
  }
}

async function limpiarFirma(ordenId, tipo) {
  if (typeof document === 'undefined') return;
  try {
    const confirmado = await window.confirmarAccion({
      titulo: 'Borrar Firma',
      mensaje: `¿Estás seguro de que deseas borrar la firma del ${tipo === 'tecnico' ? 'técnico' : 'cliente'}?`,
      esPeligroso: true,
      icono: 'eraser'
    });
    if (!confirmado) return;
    const idx = ordenes.findIndex(o => o.id === ordenId);
    if (idx !== -1) {
      if (ordenes[idx].cierre_papel_pdf) {
        mostrarNotificacion('No se pueden modificar firmas en una orden cerrada en papel.', 'error');
        return;
      }
      if (tipo === 'tecnico') ordenes[idx].firma_tecnico_base64 = '__DELETED__';
      else ordenes[idx].firma_cliente_base64 = '__DELETED__';
      
      ordenes[idx].estado = calcularEstadoOrden(ordenes[idx]);
      
      safeSetJSON('sapi_ordenes', ordenes);
      if (window.pushToSupabase) window.pushToSupabase('ordenes', ordenes[idx]);
      verDetalle(ordenId); 
    }
  } catch (err) {
    console.error('Error en limpiarFirma:', err);
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Error al borrar firma: ' + err.message, 'error');
    } else {
      alert('Error: ' + err.message);
    }
  }
}

export {
  renderEvidenciasFotograficas,
  previsualizarImagenCompleta,
  abrirImagenEnPestana,
  subirEvidenciaFoto,
  subirFotoRefaccion,
  eliminarEvidenciaFoto,
  verDetalle,
  agregarRenglonTecnicoCierre,
  abrirCierrePapel,
  cerrarCierrePapel,
  confirmarCierrePapel,
  inicializarCanvasFirma,
  borrarCanvasFirma,
  guardarFirmaCanvas,
  limpiarFirma
};

if (typeof window !== "undefined") {
  window.renderEvidenciasFotograficas = renderEvidenciasFotograficas;
  window.previsualizarImagenCompleta = previsualizarImagenCompleta;
  window.abrirImagenEnPestana = abrirImagenEnPestana;
  window.subirEvidenciaFoto = subirEvidenciaFoto;
  window.subirFotoRefaccion = subirFotoRefaccion;
  window.eliminarEvidenciaFoto = eliminarEvidenciaFoto;
  window.verDetalle = verDetalle;
  window.agregarRenglonTecnicoCierre = agregarRenglonTecnicoCierre;
  window.abrirCierrePapel = abrirCierrePapel;
  window.cerrarCierrePapel = cerrarCierrePapel;
  window.confirmarCierrePapel = confirmarCierrePapel;
  window.inicializarCanvasFirma = inicializarCanvasFirma;
  window.borrarCanvasFirma = borrarCanvasFirma;
  window.guardarFirmaCanvas = guardarFirmaCanvas;
  window.limpiarFirma = limpiarFirma;
  const allModuleExports = {
    renderEvidenciasFotograficas,
    previsualizarImagenCompleta,
    abrirImagenEnPestana,
    subirEvidenciaFoto,
    subirFotoRefaccion,
    eliminarEvidenciaFoto,
    verDetalle,
    agregarRenglonTecnicoCierre,
    abrirCierrePapel,
    cerrarCierrePapel,
    confirmarCierrePapel,
    inicializarCanvasFirma,
    borrarCanvasFirma,
    guardarFirmaCanvas,
    limpiarFirma
  };
  window.OrdenesDetalle = allModuleExports;
}
