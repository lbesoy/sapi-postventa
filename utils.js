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
