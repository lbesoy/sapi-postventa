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
  return String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// Helpers de fecha y hora local para México
window.getLocalDateString = function(date = new Date()) {
  const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return offsetDate.toISOString().split('T')[0];
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
};

// Determina con máxima certeza si el usuario activo es estrictamente Superadmin
window.esUsuarioSuperadmin = function() {
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

// Resuelve el creador original de un ticket con máxima fidelidad y fallbacks relacionales
window.resolverCreadorTicket = function(t) {
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
};

// Helper para convertir URLs de imágenes a Base64 Data URI con soporte Supabase Storage, Fetch Blob y Canvas
window.urlToDataUri = async function(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '__DELETED__') return null;
  if (trimmed.startsWith('data:image')) return trimmed;

  // Intento 1: Descarga directa mediante Supabase Storage Client (evita restricciones de CORS)
  if (window.supabaseClient && trimmed.includes('/evidencias/')) {
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

  return trimmed;
};

// Escape HTML special characters
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper para calcular días transcurridos
window.calcularDiasJunta = function(fechaStr) {
  if (!fechaStr) return 0;
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return 0;
    const diffMs = new Date() - d;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch(e) {
    return 0;
  }
};

window.formatearTiempoRelativoJunta = function(dias, fechaStr) {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer (1 día)';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return `Hace ${dias} días (1 sem)`;
  if (dias < 30) return `Hace ${dias} días (${Math.floor(dias/7)} sem)`;
  return `Hace ${dias} días (${Math.floor(dias/30)} meses)`;
};

window.normalizarTextoJunta = function(str) {
  return String(str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

window.unificarNombreUsuario = function(rawNombre) {
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
};

window.obtenerInfoRolUsuario = function(nombre) {
  if (!nombre) return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
  
  const norm = window.normalizarTextoJunta(nombre);
  if (norm === 'sin asignar' || norm === 'por definir' || norm === '-' || norm === '' || norm === 'sin_asignar') {
    return { rol: 'sin_asignar', label: 'Sin Asignar', color: '#ef4444', icon: 'user-x' };
  }

  let user = null;
  if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
    user = usuarios.find(u => u && u.nombre && window.normalizarTextoJunta(u.nombre) === norm);
    if (!user) {
      const normWords = norm.split(/\s+/).filter(w => w.length > 2);
      if (normWords.length > 0) {
        user = usuarios.find(u => {
          if (!u || !u.nombre) return false;
          const uNormWords = window.normalizarTextoJunta(u.nombre).split(/\s+/).filter(w => w.length > 2);
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
      window.normalizarTextoJunta(t.nombre) === norm || 
      window.normalizarTextoJunta(t.nombre).includes(norm) || 
      norm.includes(window.normalizarTextoJunta(t.nombre)) ||
      (typeof formatNombreCorto === 'function' && window.normalizarTextoJunta(formatNombreCorto(t.nombre)) === norm)
    ));
    if (!isTec) {
      const normWords = norm.split(/\s+/).filter(w => w.length > 2);
      if (normWords.length > 0) {
        isTec = tecnicosDb.some(t => {
          if (!t || !t.nombre) return false;
          const tNormWords = window.normalizarTextoJunta(t.nombre).split(/\s+/).filter(w => w.length > 2);
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
};

window.extraerListaResponsables = function(raw) {
  if (!raw) return ['Sin Asignar'];
  const rawStr = String(raw).trim();
  if (!rawStr || rawStr === '-' || rawStr.toLowerCase() === 'sin asignar' || rawStr.toLowerCase() === 'sin_asignar') {
    return ['Sin Asignar'];
  }
  const parts = rawStr.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  const validParts = parts.filter(s => s !== '-' && s.toLowerCase() !== 'sin asignar' && s.toLowerCase() !== 'sin_asignar');
  return validParts.length > 0 ? Array.from(new Set(validParts)) : ['Sin Asignar'];
};

const _loadedScripts = new Set();
window.loadScriptOnDemand = function(src) {
  if (typeof document === 'undefined') return Promise.resolve();
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      _loadedScripts.add(src);
      return resolve();
    }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function() {
      _loadedScripts.add(src);
      resolve();
    };
    s.onerror = function(err) { reject(err); };
    document.body.appendChild(s);
  });
};

window.solicitarBackgroundSync = async function(tag) {
  tag = tag || 'sapi-background-sync';
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      var reg = await navigator.serviceWorker.ready;
      if (reg.sync && typeof reg.sync.register === 'function') {
        await reg.sync.register(tag);
        console.log('[Offline Sync] Tarea en segundo plano registrada:', tag);
        return true;
      }
    } catch (err) {
      console.warn('[Offline Sync] Error al registrar Background Sync:', err);
    }
  }
  return false;
};

window.registrarListenerBackgroundSync = function(callback) {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    var handler = function(event) {
      if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        if (typeof callback === 'function') {
          callback(event.data);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return function() {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }
  return function() {};
};

window.verificarConexionRed = async function(timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  if (typeof fetch === 'undefined') {
    return true;
  }
  try {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function() { controller.abort(); }, timeoutMs) : null;
    var options = { method: 'HEAD', cache: 'no-store' };
    if (controller) options.signal = controller.signal;
    
    var res = await fetch('/sw.js?ping=' + Date.now(), options);
    if (timeoutId) clearTimeout(timeoutId);
    return res.ok || res.status === 304;
  } catch (err) {
    return typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : false;
  }
};

window.obtenerEstadoOffline = function() {
  var isOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
  var queueCount = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      var q = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
      queueCount = Array.isArray(q) ? q.length : 0;
    } catch (e) {}
  }
  var bgSyncSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window;
  return {
    online: isOnline,
    queueCount: queueCount,
    backgroundSyncSupported: Boolean(bgSyncSupported)
  };
};

window.debounce = function(fn, delay) {
  if (typeof delay === 'undefined') delay = 250;
  var timer = null;
  return function() {
    var context = this;
    var args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null;
      fn.apply(context, args);
    }, delay);
  };
};

window.debouncedCall = function(key, fn, delay) {
  if (typeof delay === 'undefined') delay = 250;
  var globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
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
  var timer = setTimeout(function() {
    globalObj._debouncedCallTimers.delete(key);
    fn();
  }, delay);
  globalObj._debouncedCallTimers.set(key, timer);
};

window.compressImageFile = function(file, options) {
  if (!options) options = {};
  var maxWidth = options.maxWidth || 1600;
  var maxHeight = options.maxHeight || 1600;
  var quality = typeof options.quality === 'number' ? options.quality : 0.82;
  var mimeType = options.mimeType || 'image/jpeg';

  if (typeof FileReader === 'undefined') {
    return Promise.resolve('');
  }

  var isImage = file && file.type && file.type.indexOf('image/') === 0 && file.type.indexOf('svg') === -1;
  if (!isImage || typeof Image === 'undefined' || typeof document === 'undefined') {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function(err) { reject(err); };
      reader.readAsDataURL(file);
    });
  }

  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function(err) { reject(err); };
    reader.onload = function(e) {
      var img = new Image();
      img.onerror = function() {
        resolve(e.target.result);
      };
      img.onload = function() {
        try {
          var width = img.width || 1;
          var height = img.height || 1;

          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target.result);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          var compressedDataUrl = canvas.toDataURL(mimeType, quality);
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
};

if (typeof window !== 'undefined') {
  window.debouncedRenderRefacciones = window.debounce(function() {
    if (typeof window.renderRefacciones === 'function') window.renderRefacciones();
    else if (typeof renderRefacciones === 'function') renderRefacciones();
  }, 250);

  window.debouncedRenderTickets = window.debounce(function() {
    if (typeof window.renderTickets === 'function') window.renderTickets();
    else if (typeof renderTickets === 'function') renderTickets();
  }, 250);

  window.debouncedRenderOrdenes = window.debounce(function() {
    if (typeof window.renderTabla === 'function') window.renderTabla();
    else if (typeof renderTabla === 'function') renderTabla();
  }, 250);

  window.debouncedFiltrarOrdenes = window.debounce(function(view) {
    if (typeof window.filtrarOrdenes === 'function') window.filtrarOrdenes(view);
    else if (typeof filtrarOrdenes === 'function') filtrarOrdenes(view);
  }, 250);

  window.debouncedRenderMaquinaria = window.debounce(function() {
    if (typeof window.renderMaquinaria === 'function') window.renderMaquinaria();
    else if (typeof renderMaquinaria === 'function') renderMaquinaria();
  }, 250);

  window.debouncedRenderGastos = window.debounce(function() {
    if (typeof window.renderGastos === 'function') window.renderGastos();
    else if (typeof renderGastos === 'function') renderGastos();
  }, 250);

  window.debouncedRenderSitios = window.debounce(function() {
    if (typeof window.renderSitios === 'function') window.renderSitios();
    else if (typeof renderSitios === 'function') renderSitios();
  }, 250);

  window.debouncedRenderLevantamientos = window.debounce(function() {
    if (typeof window.renderLevantamientos === 'function') window.renderLevantamientos();
    else if (typeof renderLevantamientos === 'function') renderLevantamientos();
  }, 250);

  window.debouncedRenderRentas = window.debounce(function() {
    if (typeof window.renderRentas === 'function') window.renderRentas();
  }, 250);

  window.debouncedRenderEnvios = window.debounce(function() {
    if (typeof window.renderEnvios === 'function') window.renderEnvios();
  }, 250);
}


