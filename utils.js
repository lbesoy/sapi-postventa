// ===== SHARED UTILITY FUNCTIONS (Eurorep) =====

// smart UTF-8 decode and common Spanish Mojibake replacements
window.cleanMojibake = function(str) {
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
};

// Normalize strings for search/filtering
window.normStr = function(s) {
  return (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// Formatea fechas sin lanzar excepciones RangeError
window.safeFormatDate = function(fechaStr, options = { day:'numeric', month:'short' }, defaultVal = 'N/A') {
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
};

// Formatea fechas y horas de forma amigable (DD/MM/YYYY HH:MM o DD/MM/YYYY)
window.formatFechaHoraAmigable = function(dateStr) {
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
};

// Determina si un usuario es de prueba/sandbox
window.isTestUser = function(user) {
  if (!user) return false;
  const name = (user.nombre || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return name.includes('prueba') || name.includes('test') || email.includes('prueba') || email.includes('test');
};

// Obtiene la fecha de última modificación de un ticket con fallbacks inteligentes
window.getTicketFechaModificacion = function(t) {
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
};

// Obtiene el nombre del usuario actualmente autenticado o activo en el contexto
window.getCurrentUserDisplayName = function() {
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
};

// Obtiene el nombre del usuario que realizó la última modificación del ticket con fallbacks inteligentes
window.getTicketModificadoPor = function(t) {
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
};


