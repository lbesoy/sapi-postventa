/**
 * Utilidades Compartidas - Eurorep / SAPI
 * Diseñado como módulo ES con compatibilidad global hacia window
 */

// smart UTF-8 decode and common Spanish Mojibake replacements
export function cleanMojibake(str) {
  if (typeof str !== 'string' || !str) return str;

  // 1. Try smart UTF-8 decode from character codes (bytes interpreted as Windows-1252/ISO-8859-1)
  if (str.includes('Ã') || str.includes('Â') || str.includes('Âº') || str.includes('Â±')) {
    try {
      const bytes = new Uint8Array(str.length);
      let valid = true;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 255) {
          valid = false;
          break;
        }
        bytes[i] = code;
      }
      if (valid) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decoded.trim();
      }
    } catch (e) {
      // Ignore error and fall back to replacements
    }
  }

  // 2. Fallback replacements for common Spanish Mojibake patterns
  let fixed = str;
  const replacements = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã\u00b1': 'ñ',
    'Ã ': 'Á', 'Ã‰': 'É', 'Ã ': 'Í', 'Ã“': 'Ó', 'Ãš': 'Ú', 'Ã‘': 'Ñ',
    'Ã¼': 'ü', 'Ãœ': 'Ü',
    'Ãa': 'ía', // Garcia correction
    'Âº': 'º',
    'Â±': '±',
    'Â': ''
  };

  for (const [bad, good] of Object.entries(replacements)) {
    fixed = fixed.split(bad).join(good);
  }

  return fixed.trim();
}

// Normalize strings for search/filtering
export function normStr(s) {
  return String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Crea una versión con debounce de una función para diferir su ejecución
 * hasta que hayan transcurrido 'delay' milisegundos desde la última llamada.
 * @param {Function} fn Función a ejecutar
 * @param {number} delay Tiempo de espera en milisegundos (por defecto 250ms)
 * @returns {Function} Función decorada con debounce
 */
export function debounce(fn, delay = 250) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Invoca una función de forma diferida identificada por una clave única.
 * @param {string} key Identificador único del temporizador
 * @param {Function} fn Función a ejecutar
 * @param {number} delay Tiempo de espera en ms (por defecto 250ms)
 */
export function debouncedCall(key, fn, delay = 250) {
  const globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!globalObj) {
    fn();
    return;
  }
  if (!globalObj._debouncedCallTimers) {
    globalObj._debouncedCallTimers = new Map();
  }
  if (globalObj._debouncedCallTimers.has(key)) {
    clearTimeout(globalObj._debouncedCallTimers.get(key));
  }
  const timer = setTimeout(() => {
    globalObj._debouncedCallTimers.delete(key);
    fn();
  }, delay);
  globalObj._debouncedCallTimers.set(key, timer);
}

/**
 * Comprime un archivo de imagen utilizando HTML5 Canvas para optimizar subidas y almacenamiento.
 * Si el archivo no es una imagen o el entorno no soporta Canvas/DOM, realiza fallback a FileReader tradicional.
 * @param {File|Blob} file Archivo a comprimir
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1600] Ancho máximo en píxeles
 * @param {number} [options.maxHeight=1600] Alto máximo en píxeles
 * @param {number} [options.quality=0.82] Calidad JPEG/WebP (0.1 a 1.0)
 * @param {string} [options.mimeType='image/jpeg'] Formato de salida
 * @returns {Promise<string>} Promesa que resuelve a la Data URL comprimida
 */
export function compressImageFile(file, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  if (typeof FileReader === 'undefined') {
    return Promise.resolve('');
  }

  const isImage = file && file.type && file.type.startsWith('image/') && !file.type.includes('svg');
  if (!isImage || typeof Image === 'undefined' || typeof document === 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = err => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = err => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve(e.target.result);
      };
      img.onload = () => {
        try {
          let width = img.width || 1;
          let height = img.height || 1;

          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target.result);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const compressedDataUrl = canvas.toDataURL(mimeType, quality);
          if (compressedDataUrl && compressedDataUrl.length > 0) {
            resolve(compressedDataUrl);
          } else {
            resolve(e.target.result);
          }
        } catch (canvasErr) {
          console.warn('[compressImageFile] Fallback a original por error en Canvas:', canvasErr);
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Formatea fechas sin lanzar excepciones RangeError
export function safeFormatDate(fechaStr, options = { day:'numeric', month:'short' }, defaultVal = 'N/A') {
  if (!fechaStr) return defaultVal;
  
  let cleanStr = String(fechaStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    cleanStr += 'T12:00:00';
  }
  
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return defaultVal;
  try {
    return d.toLocaleDateString('es-MX', options);
  } catch(e) {
    try {
      return d.toLocaleString('es-MX');
    } catch(e2) {
      return defaultVal;
    }
  }
}

// Helpers de fecha y hora local para México
export function getLocalDateString(date = new Date()) {
  const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return offsetDate.toISOString().split('T')[0];
}

// Formatea fechas y horas de forma amigable (DD/MM/YYYY HH:MM o DD/MM/YYYY)
export function formatFechaHoraAmigable(dateStr) {
  if (!dateStr) return '—';
  if (dateStr.includes('T00:00:00')) {
    const datePortion = dateStr.split('T')[0];
    const parts = datePortion.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (!isNaN(d)) {
      const pad = (num) => String(num).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function isTestUser(user) {
  if (!user) return false;
  const name = (typeof user === 'string' ? user : (user.nombre || user.name || '')).toLowerCase();
  const email = (typeof user === 'object' ? (user.email || user.correo || '') : '').toLowerCase();
  return name.includes('prueba') || name.includes('test') || email.includes('prueba') || email.includes('test');
}

// Obtiene la fecha de última modificación de un ticket con fallbacks inteligentes
export function getTicketFechaModificacion(t) {
  if (!t || typeof t !== 'object') return null;
  if (t.fechaModificacion) return t.fechaModificacion;
  if (t.fecha_modificacion) return t.fecha_modificacion;
  if (t.updated_at) return t.updated_at;
  
  // Si tiene comentarios internos recientes, verificar la última fecha
  if (Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
    const last = t.comentariosInternos[t.comentariosInternos.length - 1];
    if (last && last.fecha) return last.fecha;
  }
  
  // Si tiene comentarios de clientes recientes, verificar la última fecha
  if (Array.isArray(t.comentariosClientes) && t.comentariosClientes.length > 0) {
    const last = t.comentariosClientes[t.comentariosClientes.length - 1];
    if (last && last.fecha) return last.fecha;
  }
  
  return t.fechaCreacion || t.fecha || t.created_at || null;
}

// Obtiene el nombre del usuario actualmente autenticado o activo en el contexto
export function getCurrentUserDisplayName() {
  try {
    if (typeof currentSession !== 'undefined' && currentSession) {
      if (currentSession.nombre && String(currentSession.nombre).trim()) return String(currentSession.nombre).trim();
      if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
        const u = usuarios.find(x => x && (x.id === currentSession.userId || x.id === currentSession.realUserId));
        if (u && u.nombre && String(u.nombre).trim()) return String(u.nombre).trim();
      }
      if (currentSession.userId === 'superadmin' || currentSession.realRol === 'superadmin' || currentSession.viewMode === 'superadmin') {
        return 'Super Administrador';
      }
      if (currentSession.empresa && String(currentSession.empresa).trim()) return String(currentSession.empresa).trim();
    }
    if (typeof currentClienteSession !== 'undefined' && currentClienteSession) {
      if (currentClienteSession.contacto) return currentClienteSession.contacto;
      if (currentClienteSession.nombre) return currentClienteSession.nombre;
      if (currentClienteSession.empresa) return currentClienteSession.empresa;
    }
    const sess = (typeof safeGetJSON === 'function') ? safeGetJSON('eurorep_session', null) : JSON.parse(localStorage.getItem('eurorep_session') || 'null');
    if (sess) {
      if (sess.nombre && String(sess.nombre).trim()) return String(sess.nombre).trim();
      if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
        const u = usuarios.find(x => x && (x.id === sess.userId || x.id === sess.realUserId));
        if (u && u.nombre && String(u.nombre).trim()) return String(u.nombre).trim();
      }
      if (sess.userId === 'superadmin') return 'Super Administrador';
    }
  } catch (e) {}
  return 'Usuario';
}

// Determina con máxima certeza si el usuario activo es estrictamente Superadmin
export function esUsuarioSuperadmin() {
  try {
    let sess = null;
    if (typeof currentSession !== 'undefined' && currentSession) sess = currentSession;
    else if (typeof window !== 'undefined' && window.currentSession) sess = window.currentSession;
    else if (typeof safeGetJSON === 'function') sess = safeGetJSON('eurorep_session', null);
    else if (typeof localStorage !== 'undefined') {
      try { sess = JSON.parse(localStorage.getItem('eurorep_session') || 'null'); } catch (e) {}
    }
    if (!sess) return false;

    const viewMode = String(sess.viewMode || '').toLowerCase().trim();
    const realRol = String(sess.realRol || '').toLowerCase().trim();
    const userId = String(sess.userId || '').toLowerCase().trim();

    // 1. Si la vista activa actual NO es superadmin (o es admin, supervisor, tecnico, empresa, consulta), NUNCA autorizar
    if (viewMode !== 'superadmin') return false;

    // 2. Si el usuario existe en el catálogo de usuarios, verificar que su rol en base de datos sea superadmin
    const usersList = (typeof window !== 'undefined' && Array.isArray(window.usuarios))
      ? window.usuarios
      : ((typeof usuarios !== 'undefined' && Array.isArray(usuarios)) ? usuarios : (typeof safeGetJSON === 'function' ? safeGetJSON('eurorep_usuarios', []) : []));

    if (Array.isArray(usersList) && userId) {
      const userInDb = usersList.find(u => u && u.id === userId);
      if (userInDb && userInDb.rol) {
        const dbRol = String(userInDb.rol).toLowerCase().trim();
        if (dbRol !== 'superadmin') return false;
      }
    }

    // 3. Prohibición estricta si el rol real del usuario es cualquier rol operativo común
    if (['admin', 'supervisor', 'tecnico', 'empresa', 'cliente', 'cliente-consultor', 'consulta'].includes(realRol)) {
      return false;
    }

    // 4. Debe tener viewMode superadmin Y rol real o userId superadmin
    return (viewMode === 'superadmin' && (realRol === 'superadmin' || userId === 'superadmin' || !realRol));
  } catch (err) {
    console.error('[Auth] Error verificando rol superadmin:', err);
    return false;
  }
}


// Obtiene el nombre del usuario que realizó la última modificación del ticket con fallbacks inteligentes
export function getTicketModificadoPor(t) {
  if (!t || typeof t !== 'object') return '—';
  if (t.modificadoPor && String(t.modificadoPor).trim()) return String(t.modificadoPor).trim();
  if (t.modificado_por && String(t.modificado_por).trim()) return String(t.modificado_por).trim();
  if (t.ultimoModificadoPor && String(t.ultimoModificadoPor).trim()) return String(t.ultimoModificadoPor).trim();
  
  // Si tiene comentarios internos recientes, tomar el autor del último comentario
  if (Array.isArray(t.comentariosInternos) && t.comentariosInternos.length > 0) {
    const last = t.comentariosInternos[t.comentariosInternos.length - 1];
    if (last && (last.usuario || last.autor)) return (last.usuario || last.autor);
  }
  
  // Si tiene comentarios de clientes recientes, tomar el autor del último comentario
  if (Array.isArray(t.comentariosClientes) && t.comentariosClientes.length > 0) {
    const last = t.comentariosClientes[t.comentariosClientes.length - 1];
    if (last && (last.usuario || last.autor || last.cliente)) return (last.usuario || last.autor || last.cliente);
  }
  
  return t.creadoPor || t.solicitante || t.usuario || '—';
}

// Resuelve el creador original de un ticket con máxima fidelidad y fallbacks relacionales
export function resolverCreadorTicket(t) {
  if (!t || typeof t !== 'object') return '';

  // 1. Directo de creadoPor o creado_por
  if (t.creadoPor && String(t.creadoPor).trim() !== '' && t.creadoPor !== '—' && t.creadoPor !== 'null') {
    return String(t.creadoPor).trim();
  }
  if (t.creado_por && String(t.creado_por).trim() !== '' && t.creado_por !== '—' && t.creado_por !== 'null') {
    return String(t.creado_por).trim();
  }

  // 2. Si proviene o está asociado a una Orden de Servicio
  try {
    const ordenesList = (typeof ordenes !== 'undefined' && Array.isArray(ordenes))
      ? ordenes
      : ((typeof safeGetJSON === 'function') ? safeGetJSON('sapi_ordenes', []) : JSON.parse(localStorage.getItem('sapi_ordenes') || '[]'));

    if (Array.isArray(ordenesList) && ordenesList.length > 0) {
      const matchOrden = ordenesList.find(o => {
        if (!o) return false;
        if (t.folio && (o.id === t.folio || o.folio === t.folio)) return true;
        if (t.asunto && o.folio && t.asunto.includes(o.folio)) return true;
        if (t.descripcion && o.folio && t.descripcion.includes(o.folio)) return true;
        if (o.soporte && (o.soporte === t.id || o.soporte === t.folio)) return true;
        return false;
      });

      if (matchOrden) {
        if (matchOrden.creadoPor && String(matchOrden.creadoPor).trim() && matchOrden.creadoPor !== '—') {
          return String(matchOrden.creadoPor).trim();
        }
        if (matchOrden.tecnico && String(matchOrden.tecnico).trim() && matchOrden.tecnico !== '—') {
          return String(matchOrden.tecnico).trim();
        }
      }
    }
  } catch (e) {}

  // 3. Revisar primer comentario interno cronológico (quien registró la primera acción)
  try {
    const coms = t.comentariosInternos || t.comentarios_internos || [];
    if (Array.isArray(coms) && coms.length > 0) {
      const first = coms[0];
      if (first && (first.usuario || first.autor)) {
        const autorCom = String(first.usuario || first.autor).trim();
        if (autorCom && autorCom !== 'Sistema' && autorCom !== '—') {
          return autorCom;
        }
      }
    }
  } catch (e) {}

  // 4. Si el solicitante coincide con un usuario interno de la empresa (staff/técnico/admin)
  try {
    const usersList = (typeof usuarios !== 'undefined' && Array.isArray(usuarios))
      ? usuarios
      : ((typeof safeGetJSON === 'function') ? safeGetJSON('sapi_usuarios', []) : JSON.parse(localStorage.getItem('sapi_usuarios') || '[]'));

    if (t.solicitante && String(t.solicitante).trim()) {
      const solNorm = String(t.solicitante).trim().toLowerCase();
      const matchUser = usersList.find(u => u && u.nombre && u.nombre.toLowerCase().trim() === solNorm);
      if (matchUser && matchUser.nombre) return matchUser.nombre;
    }
  } catch (e) {}

  // 5. Fallback a modificadoPor si no tiene modificaciones posteriores
  if (t.modificadoPor && String(t.modificadoPor).trim() && t.modificadoPor !== '—' && t.modificadoPor !== 'Usuario') {
    const fc = t.fechaCreacion || t.fecha_creacion || t.fecha;
    const fm = t.fechaModificacion || t.fecha_modificacion;
    if (!fm || fc === fm) {
      return String(t.modificadoPor).trim();
    }
  }

  return '';
}

// Helper para convertir URLs de imágenes a Base64 Data URI con soporte Supabase Storage, Fetch Blob y Canvas
export async function urlToDataUri(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '__DELETED__') return null;
  if (trimmed.startsWith('data:image')) return trimmed;

  // Intento 1: Descarga directa mediante Supabase Storage Client (evita restricciones de CORS)
  if (typeof window !== 'undefined' && window.supabaseClient && trimmed.includes('/evidencias/')) {
    try {
      const parts = trimmed.split('/evidencias/');
      let filePath = parts[1] || '';
      if (filePath) {
        filePath = decodeURIComponent(filePath.split('?')[0]);
        const { data: blob, error } = await window.supabaseClient.storage.from('evidencias').download(filePath);
        if (!error && blob && blob.size > 0) {
          const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUri && dataUri.startsWith('data:image')) return dataUri;
        }
      }
    } catch (err) {
      console.warn('[urlToDataUri] Supabase storage download fallback:', err);
    }
  }

  // Intento 2: Fetch como Blob estándar
  try {
    const res = await fetch(trimmed, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        const dataUri = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (dataUri && dataUri.startsWith('data:image')) return dataUri;
      }
    }
  } catch (err) {
    console.warn('[urlToDataUri] Fetch blob fallback:', err);
  }

  // Intento 3: Fetch con cache-busting
  if (trimmed.startsWith('http')) {
    try {
      const cbUrl = trimmed.includes('?') ? `${trimmed}&_t=${Date.now()}` : `${trimmed}?_t=${Date.now()}`;
      const res = await fetch(cbUrl, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUri && dataUri.startsWith('data:image')) return dataUri;
        }
      }
    } catch (err) {
      console.warn('[urlToDataUri] Fetch cb fallback:', err);
    }
  }

  // Intento 4: Elemento Image con crossOrigin y Canvas
  if (typeof document !== 'undefined') {
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 300;
            canvas.height = img.naturalHeight || img.height || 200;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = trimmed;
      });
      if (dataUri && dataUri.startsWith('data:image')) return dataUri;
    } catch (err) {
      console.warn('[urlToDataUri] Canvas conversion fallback:', err);
    }
  }

  return trimmed;
}

// Escape HTML special characters
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper para calcular días transcurridos
export function calcularDiasJunta(fechaStr) {
  if (!fechaStr) return 0;
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return 0;
    const diffMs = new Date() - d;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch(e) {
    return 0;
  }
}

export function formatearTiempoRelativoJunta(dias, fechaStr) {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer (1 día)';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return `Hace ${dias} días (1 sem)`;
  if (dias < 30) return `Hace ${dias} días (${Math.floor(dias/7)} sem)`;
  return `Hace ${dias} días (${Math.floor(dias/30)} meses)`;
}

export function normalizarTextoJunta(str) {
  return String(str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function unificarNombreUsuario(rawNombre) {
  if (!rawNombre) return 'Sin Asignar';
  const norm = String(rawNombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!norm || norm === 'sin asignar' || norm === 'por definir' || norm === '-' || norm === 'sin_asignar') {
    return 'Sin Asignar';
  }

  // 1. Buscar coincidencia en array de usuarios
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    const userMatch = usuarios.find(u => u && u.nombre && String(u.nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === norm);
    if (userMatch && userMatch.nombre) return userMatch.nombre.trim();

    const normWords = norm.split(/\s+/).filter(w => w.length > 2);
    if (normWords.length >= 2) {
      const fuzzyUser = usuarios.find(u => {
        if (!u || !u.nombre) return false;
        const uNormWords = String(u.nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).filter(w => w.length > 2);
        const matches = normWords.filter(w => uNormWords.includes(w));
        return matches.length >= 2;
      });
      if (fuzzyUser && fuzzyUser.nombre) return fuzzyUser.nombre.trim();
    }
  }

  // 2. Buscar coincidencia en array de tecnicosDb
  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) {
    const tecMatch = tecnicosDb.find(t => t && t.nombre && String(t.nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === norm);
    if (tecMatch && tecMatch.nombre) return tecMatch.nombre.trim();

    const normWords = norm.split(/\s+/).filter(w => w.length > 2);
    if (normWords.length >= 2) {
      const fuzzyTec = tecnicosDb.find(t => {
        if (!t || !t.nombre) return false;
        const tNormWords = String(t.nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).filter(w => w.length > 2);
        const matches = normWords.filter(w => tNormWords.includes(w));
        return matches.length >= 2;
      });
      if (fuzzyTec && fuzzyTec.nombre) return fuzzyTec.nombre.trim();
    }
  }

  return String(rawNombre).trim();
}

export const PAQUETERIAS_CONOCIDAS = [
  'dhl', 'fedex', 'estafeta', 'paquetexpress', 'redpack', 'castores', 'tres guerras', 'tresguerras', 'ups', 'paqueteria', 'por definir'
];

export function esNombrePaqueteria(nombre) {
  if (!nombre) return false;
  const n = String(typeof nombre === 'object' ? (nombre.nombre || nombre.name || '') : nombre).toLowerCase().trim();
  if (!n) return false;
  return PAQUETERIAS_CONOCIDAS.some(p => n === p || n.startsWith(p + ' ') || n.startsWith(p + ' express'));
}

export function esResponsableExcluidoOperativo(nombre) {
  if (!nombre) return false;
  const str = typeof nombre === 'object' ? (nombre.nombre || nombre.name || nombre.usuario || '') : String(nombre);
  const n = normalizarTextoJunta(str);
  if (!n) return false;
  if (n === 'pablo besoy' || n === 'pablo besoy trigueros' || n === 'besoy') {
    return true;
  }
  if (esNombrePaqueteria(str)) return true;
  if (typeof isTestUser === 'function' && isTestUser({ nombre: str })) return true;
  return false;
}

export function obtenerInfoRolUsuario(nombre) {
  if (!nombre) return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
  
  const norm = normalizarTextoJunta(nombre);
  if (norm === 'sin asignar' || norm === 'por definir' || norm === '-' || norm === '' || norm === 'sin_asignar' || esNombrePaqueteria(nombre)) {
    return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
  }

  if (norm === 'pablo besoy' || norm === 'pablo besoy trigueros' || norm === 'besoy') {
    return { rol: 'superadmin', label: 'Super Admin', color: '#E8820C', icon: 'shield-alert' };
  }

  let user = null;
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    user = usuarios.find(u => u && u.nombre && normalizarTextoJunta(u.nombre) === norm);
    if (!user) {
      const normWords = norm.split(/\s+/).filter(w => w.length > 2);
      if (normWords.length > 0) {
        user = usuarios.find(u => {
          if (!u || !u.nombre) return false;
          const uNormWords = normalizarTextoJunta(u.nombre).split(/\s+/).filter(w => w.length > 2);
          const matches = normWords.filter(w => uNormWords.includes(w));
          return matches.length >= 2 || (normWords.length === 1 && matches.length === 1);
        });
      }
    }
  }

  if (user && user.rol) {
    const rolKey = String(user.rol).toLowerCase();
    let label = 'Técnico';
    let color = '#10b981';
    let icon = 'wrench';

    if (rolKey === 'superadmin') {
      label = 'Super Admin';
      color = '#E8820C';
      icon = 'shield-alert';
    } else if (rolKey === 'admin') {
      label = 'Administrador';
      color = '#4f8ef7';
      icon = 'shield';
    } else if (rolKey === 'supervisor') {
      label = 'Supervisor';
      color = '#ca8a04';
      icon = 'user-check';
    } else if (rolKey === 'tecnico') {
      label = 'Técnico';
      color = '#10b981';
      icon = 'wrench';
    } else if (rolKey === 'empresa') {
      label = 'Cliente';
      color = '#8b5cf6';
      icon = 'building';
    } else if (rolKey === 'consulta') {
      label = 'Solo Consulta';
      color = '#64748b';
      icon = 'eye';
    } else {
      const conf = (typeof ROLES !== 'undefined' && ROLES[rolKey]) ? ROLES[rolKey] : null;
      label = conf ? conf.label : (rolKey.charAt(0).toUpperCase() + rolKey.slice(1));
      color = conf ? conf.color : '#10b981';
    }

    return { rol: rolKey, label, color, icon };
  }

  if (typeof tecnicosDb !== 'undefined' && Array.isArray(tecnicosDb)) {
    let isTec = tecnicosDb.some(t => t && t.nombre && (
      normalizarTextoJunta(t.nombre) === norm || 
      normalizarTextoJunta(t.nombre).includes(norm) || 
      norm.includes(normalizarTextoJunta(t.nombre)) ||
      (typeof formatNombreCorto === 'function' && normalizarTextoJunta(formatNombreCorto(t.nombre)) === norm)
    ));
    if (!isTec) {
      const normWords = norm.split(/\s+/).filter(w => w.length > 2);
      if (normWords.length > 0) {
        isTec = tecnicosDb.some(t => {
          if (!t || !t.nombre) return false;
          const tNormWords = normalizarTextoJunta(t.nombre).split(/\s+/).filter(w => w.length > 2);
          const matches = normWords.filter(w => tNormWords.includes(w));
          return matches.length >= 2 || (normWords.length === 1 && matches.length === 1);
        });
      }
    }
    if (isTec) {
      return { rol: 'tecnico', label: 'Técnico', color: '#10b981', icon: 'wrench' };
    }
  }

  return { rol: 'tecnico', label: 'Técnico', color: '#10b981', icon: 'wrench' };
}

export function extraerListaResponsables(raw) {
  if (!raw) return ['Sin Asignar'];
  const rawStr = String(raw).trim();
  if (!rawStr || rawStr === '-' || rawStr.toLowerCase() === 'sin asignar' || rawStr.toLowerCase() === 'sin_asignar') {
    return ['Sin Asignar'];
  }
  const parts = rawStr.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  const validParts = parts.filter(s => s !== '-' && s.toLowerCase() !== 'sin asignar' && s.toLowerCase() !== 'sin_asignar' && !esNombrePaqueteria(s) && !esResponsableExcluidoOperativo(s));
  return validParts.length > 0 ? Array.from(new Set(validParts)) : ['Sin Asignar'];
}

// Vinculación automática a window y globalThis para 100% interoperabilidad
const _targetGlobal = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
if (_targetGlobal) {
  _targetGlobal.cleanMojibake = cleanMojibake;
  _targetGlobal.getLocalDateString = getLocalDateString;
  _targetGlobal.normStr = normStr;
  _targetGlobal.safeFormatDate = safeFormatDate;
  _targetGlobal.formatFechaHoraAmigable = formatFechaHoraAmigable;
  _targetGlobal.isTestUser = isTestUser;
  _targetGlobal.getTicketFechaModificacion = getTicketFechaModificacion;
  _targetGlobal.getCurrentUserDisplayName = getCurrentUserDisplayName;
  _targetGlobal.getTicketModificadoPor = getTicketModificadoPor;
  _targetGlobal.resolverCreadorTicket = resolverCreadorTicket;
  _targetGlobal.urlToDataUri = urlToDataUri;
  _targetGlobal.escapeHTML = escapeHTML;
  _targetGlobal.calcularDiasJunta = calcularDiasJunta;
  _targetGlobal.formatearTiempoRelativoJunta = formatearTiempoRelativoJunta;
  _targetGlobal.normalizarTextoJunta = normalizarTextoJunta;
  _targetGlobal.unificarNombreUsuario = unificarNombreUsuario;
  _targetGlobal._unificarNombreUsuarioBase = unificarNombreUsuario;
  _targetGlobal.obtenerInfoRolUsuario = obtenerInfoRolUsuario;
  _targetGlobal._obtenerInfoRolUsuarioBase = obtenerInfoRolUsuario;
  _targetGlobal.extraerListaResponsables = extraerListaResponsables;
  _targetGlobal._extraerListaResponsablesBase = extraerListaResponsables;
  _targetGlobal.esResponsableExcluidoOperativo = esResponsableExcluidoOperativo;
  _targetGlobal.esNombrePaqueteria = esNombrePaqueteria;
  _targetGlobal.PAQUETERIAS_CONOCIDAS = PAQUETERIAS_CONOCIDAS;
  _targetGlobal.loadScriptOnDemand = loadScriptOnDemand;
  _targetGlobal.solicitarBackgroundSync = solicitarBackgroundSync;
  _targetGlobal.registrarListenerBackgroundSync = registrarListenerBackgroundSync;
  _targetGlobal.verificarConexionRed = verificarConexionRed;
  _targetGlobal.obtenerEstadoOffline = obtenerEstadoOffline;
}

const _loadedScripts = new Set();
export function loadScriptOnDemand(src) {
  if (typeof document === 'undefined') return Promise.resolve();
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      _loadedScripts.add(src);
      return resolve();
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      _loadedScripts.add(src);
      resolve();
    };
    s.onerror = (err) => reject(err);
    document.body.appendChild(s);
  });
}

/**
 * Solicita el registro de una tarea de Background Sync en el Service Worker.
 * Si el navegador soporta SyncManager, el Service Worker despertará automáticamente
 * cuando la conexión a Internet se recupere para procesar la cola pendiente.
 * @param {string} [tag='sapi-background-sync'] - Etiqueta de la tarea de sincronización
 * @returns {Promise<boolean>} Retorna true si se registró exitosamente
 */
export async function solicitarBackgroundSync(tag = 'sapi-background-sync') {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.sync && typeof reg.sync.register === 'function') {
        await reg.sync.register(tag);
        console.log(`[Offline Sync] Tarea en segundo plano registrada: ${tag}`);
        return true;
      }
    } catch (err) {
      console.warn('[Offline Sync] Error al registrar Background Sync:', err);
    }
  }
  return false;
}

/**
 * Escucha los mensajes de Background Sync enviados por el Service Worker hacia la ventana activa.
 * @param {Function} callback - Función que se ejecuta cuando el SW notifica que la conexión se recuperó
 * @returns {Function} Función para desuscribirse del listener
 */
export function registrarListenerBackgroundSync(callback) {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const handler = (event) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        if (typeof callback === 'function') {
          callback(event.data);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }
  return () => {};
}

/**
 * Comprueba de forma activa si existe conectividad real a internet mediante un ping ligero.
 * @param {number} [timeoutMs=3000] - Tiempo de espera máximo en milisegundos
 * @returns {Promise<boolean>}
 */
export async function verificarConexionRed(timeoutMs = 3000) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  if (typeof fetch === 'undefined') {
    return true;
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const options = { method: 'HEAD', cache: 'no-store' };
    if (controller) options.signal = controller.signal;
    
    const res = await fetch('/sw.js?ping=' + Date.now(), options);
    if (timeoutId) clearTimeout(timeoutId);
    return res.ok || res.status === 304;
  } catch (err) {
    return typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : false;
  }
}

/**
 * Retorna el estado consolidado de la conectividad y de la cola de sincronización offline.
 * @returns {{ online: boolean, queueCount: number, backgroundSyncSupported: boolean }}
 */
export function obtenerEstadoOffline() {
  const isOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
  let queueCount = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      const q = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
      queueCount = Array.isArray(q) ? q.length : 0;
    } catch (e) {}
  }
  const bgSyncSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window;
  return {
    online: isOnline,
    queueCount,
    backgroundSyncSupported: Boolean(bgSyncSupported)
  };
}

if (typeof window !== 'undefined') {
  window.debounce = debounce;
  window.debouncedCall = debouncedCall;
  window.compressImageFile = compressImageFile;

  window.debouncedRenderRefacciones = debounce(() => {
    if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
    else if (typeof renderRefacciones === 'function') renderRefacciones();
  }, 250);

  window.debouncedRenderTickets = debounce(() => {
    if (typeof window.renderTickets === 'function') window.renderTickets();
    else if (typeof renderTickets === 'function') renderTickets();
  }, 250);

  window.debouncedRenderOrdenes = debounce(() => {
    if (typeof window.renderTabla === 'function') window.renderTabla();
    else if (typeof renderTabla === 'function') renderTabla();
  }, 250);

  window.debouncedFiltrarOrdenes = debounce((view) => {
    if (typeof window.filtrarOrdenes === 'function') window.filtrarOrdenes(view);
    else if (typeof filtrarOrdenes === 'function') filtrarOrdenes(view);
  }, 250);

  window.debouncedRenderMaquinaria = debounce(() => {
    if (typeof window.renderMaquinaria === 'function') window.renderMaquinaria();
    else if (typeof renderMaquinaria === 'function') renderMaquinaria();
  }, 250);

  window.debouncedRenderGastos = debounce(() => {
    if (typeof window.renderGastos === 'function') window.renderGastos();
    else if (typeof renderGastos === 'function') renderGastos();
  }, 250);

  window.debouncedRenderSitios = debounce(() => {
    if (typeof window.renderSitios === 'function') window.renderSitios();
    else if (typeof renderSitios === 'function') renderSitios();
  }, 250);

  window.debouncedRenderLevantamientos = debounce(() => {
    if (typeof window.renderLevantamientos === 'function') window.renderLevantamientos();
    else if (typeof renderLevantamientos === 'function') renderLevantamientos();
  }, 250);

  window.debouncedRenderRentas = debounce(() => {
    if (typeof window.renderRentas === 'function') window.renderRentas();
  }, 250);

  window.debouncedRenderEnvios = debounce(() => {
    if (typeof window.renderEnvios === 'function') window.renderEnvios();
  }, 250);

  window.esUsuarioSuperadmin = esUsuarioSuperadmin;
}

