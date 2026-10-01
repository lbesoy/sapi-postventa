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
  return (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

// Determina si un usuario es de prueba/sandbox
export function isTestUser(user) {
  if (!user) return false;
  const name = (user.nombre || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
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
      if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
        const u = usuarios.find(x => x && x.id === currentSession.userId);
        if (u && u.nombre) return u.nombre;
      }
      if (currentSession.nombre) return currentSession.nombre;
      if (currentSession.empresa) return currentSession.empresa;
    }
    if (typeof currentClienteSession !== 'undefined' && currentClienteSession) {
      if (currentClienteSession.contacto) return currentClienteSession.contacto;
      if (currentClienteSession.nombre) return currentClienteSession.nombre;
      if (currentClienteSession.empresa) return currentClienteSession.empresa;
    }
    const sess = (typeof safeGetJSON === 'function') ? safeGetJSON('eurorep_session', null) : JSON.parse(localStorage.getItem('eurorep_session') || 'null');
    if (sess && sess.nombre) return sess.nombre;
  } catch (e) {}
  return 'Usuario';
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

export function obtenerInfoRolUsuario(nombre) {
  if (!nombre) return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
  
  const norm = normalizarTextoJunta(nombre);
  if (norm === 'sin asignar' || norm === 'por definir' || norm === '-' || norm === '' || norm === 'sin_asignar') {
    return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
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
  const validParts = parts.filter(s => s !== '-' && s.toLowerCase() !== 'sin asignar' && s.toLowerCase() !== 'sin_asignar');
  return validParts.length > 0 ? Array.from(new Set(validParts)) : ['Sin Asignar'];
}

// Vinculación automática a window para 100% retrocompatibilidad con código existente
if (typeof window !== 'undefined') {
  window.cleanMojibake = cleanMojibake;
  window.getLocalDateString = getLocalDateString;
  window.normStr = normStr;
  window.safeFormatDate = safeFormatDate;
  window.formatFechaHoraAmigable = formatFechaHoraAmigable;
  window.isTestUser = isTestUser;
  window.getTicketFechaModificacion = getTicketFechaModificacion;
  window.getCurrentUserDisplayName = getCurrentUserDisplayName;
  window.getTicketModificadoPor = getTicketModificadoPor;
  window.urlToDataUri = urlToDataUri;
  window.escapeHTML = escapeHTML;
  window.calcularDiasJunta = calcularDiasJunta;
  window.formatearTiempoRelativoJunta = formatearTiempoRelativoJunta;
  window.normalizarTextoJunta = normalizarTextoJunta;
  window.unificarNombreUsuario = unificarNombreUsuario;
  window.obtenerInfoRolUsuario = obtenerInfoRolUsuario;
  window.extraerListaResponsables = extraerListaResponsables;
}
