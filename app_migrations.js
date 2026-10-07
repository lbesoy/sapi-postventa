/**
 * Eurorep SAPI - Módulo de Migraciones de Datos y Recuperación de Catálogos
 * Archivo: app_migrations.js (Bundle para Navegador)
 */
(function() {
  function safeGetJSON(key, defaultVal) {
    if (typeof window !== 'undefined' && typeof window.safeGetJSON === 'function') {
      return window.safeGetJSON(key, defaultVal);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultVal;
      }
      return defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  function safeSetJSON(key, val) {
    if (typeof window !== 'undefined' && typeof window.safeSetJSON === 'function') {
      return window.safeSetJSON(key, val);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(val));
      }
    } catch(e) {}
  }

  function safeGenerarIdInternoMaquina(marca, serie) {
    if (typeof window !== 'undefined' && typeof window.generarIdInternoMaquina === 'function') {
      return window.generarIdInternoMaquina(marca, serie);
    }
    if (typeof generarIdInternoMaquina === 'function') {
      return generarIdInternoMaquina(marca, serie);
    }
    return '';
  }

async function generarTicketsRefaccionesFaltantes() {
  console.log('[App] Iniciando escaneo y generación de tickets de refacciones faltantes para órdenes...');
  let creados = 0;
  
  for (const o of ordenes) {
    const refNecesarias = o.ref_necesarias || [];
    if (refNecesarias.length === 0) continue;
    
    // Calcular el targetFolio correspondiente
    let baseFolio = o.folio || '';
    let parentTicketId = o.soporte || null;
    let ticketPadre = parentTicketId ? tickets.find(t => t.id === parentTicketId) : null;
    
    let prefix = '';
    let cleanFolio = baseFolio.trim();
    if (cleanFolio.startsWith('[PRUEBA] ')) {
      prefix = '[PRUEBA] ';
      cleanFolio = cleanFolio.replace('[PRUEBA] ', '').trim();
    } else if (cleanFolio.startsWith('[TEST] ')) {
      prefix = '[TEST] ';
      cleanFolio = cleanFolio.replace('[TEST] ', '').trim();
    }
    
    if (!cleanFolio.toUpperCase().startsWith('TKT-')) {
      cleanFolio = 'TKT-' + cleanFolio;
    }
    
    const targetFolio = cleanFolio.endsWith('-A') ? `${prefix}${cleanFolio}` : `${prefix}${cleanFolio}-A`;
    
    // Verificar si ya existe un ticket local con este folio o vinculado a esta orden
    let ticketExistente = tickets.find(t => t && (t.folio === targetFolio || (t.ordenId && t.ordenId === o.id) || (t.ordenFolio && t.ordenFolio === o.folio)));
    if (ticketExistente) continue; // Ya existe, no hacemos nada
    
    // Crear el ticket autogenerado desde la orden
    console.log(`[App] Generando ticket faltante ${targetFolio} para la orden ${o.folio}...`);
    
    const now = new Date().toISOString();
    const refaccionesMapeadas = refNecesarias.map(r => ({
      marca: r.marca || '',
      codigo: r.clave || r.codigo || 'S/C',
      clave: r.clave || r.codigo || 'S/C',
      nombre: r.descripcion || r.nombre || 'Sin Descripción',
      descripcion: r.descripcion || r.nombre || 'Sin Descripción',
      cantidad: r.cantidad || 1,
      estatusPedido: r.estatusPedido || 'Por Pedir'
    }));

    const ticket = {
      id: crypto.randomUUID(),
      folio: targetFolio,
      ordenId: o.id,
      ordenFolio: o.folio,
      fecha: now,
      fechaCreacion: now,
      fechaCierre: null,
      canal: 'sistema',
      contacto: '',
      asunto: `Refacciones para ${baseFolio}`,
      cliente: o.cliente,
      sitio: o.ubicacion || o.ubicacion_sitio || '',
      solicitante: o.creadoPor || o.tecnico || 'Sistema',
      creadoPor: o.creadoPor || o.tecnico || 'Sistema',
      area: ticketPadre ? (ticketPadre.area || 'Operaciones') : 'Operaciones',
      categoria: 'Refacción',
      prioridad: ticketPadre ? (ticketPadre.prioridad || 'Media') : 'Media',
      asignado: (ticketPadre && ticketPadre.asignado) ? ticketPadre.asignado : '',
      descripcion: `Ticket de refacciones por pedir generado de la Orden de Servicio ${o.folio}.`,
      equipo: o.equipo,
      notas: '',
      refaccionesSeleccionadas: refaccionesMapeadas,
      cotizacionesAdicionales: [],
      estado: 'Refacciones',
      cotizacionSAP: '',
      montoCotizacion: null,
      cotAceptada: '',
      motivoRechazo: '',
      pedidoSAP: '',
      comentariosInternos: [],
      comentariosClientes: [],
      tecnicosAsignados: [],
      pdfPedido: null,
      pdfCotizacion: null,
      esPrueba: o.esPrueba || false
    };
    
    tickets.unshift(ticket);
    creados++;
    
    if (window.supabaseClient) {
      try {
        await window.pushToSupabase('tickets', ticket);
      } catch (err) {
        console.error(`[App] Error al sincronizar ticket faltante con Supabase:`, err);
      }
    }
  }
  
  if (creados > 0) {
    console.log(`[App] Se generaron ${creados} tickets de refacciones faltantes.`);
    safeSetJSON('sapi_tickets', tickets);
    if (typeof renderTickets === 'function') {
      renderTickets();
      renderTickets('dash-tickets');
    }
    if (typeof updateTicketBadge === 'function') updateTicketBadge(); updateOrdenesBadge();
  }
};

function migrarOrdenesExistentesMaquinaria() {
  console.log('[App] Ejecutando migración de maquinaria en órdenes existentes...');
  let modificados = 0;
  
  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  ordenes.forEach(o => {
    if (!o.soporte) return;
    if (o.maquinaria_id && o.modelo && o.serie && o.marca && o.eco && o.equipo) return;
    
    const t = tickets.find(x => x.id === o.soporte);
    if (!t || !t.equipo) return;
    
    const prevModelo = o.modelo;
    const prevSerie = o.serie;
    const prevMarca = o.marca;
    const prevEco = o.eco;
    const prevMaqId = o.maquinaria_id;
    const prevEquipo = o.equipo;

    const matchMaquina = (m) => {
      const cleanId = m.idInterno || m.id || '';
      if (!cleanId) return false;
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
      const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      
      const equipoString = t.equipo || '';
      const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
      
      return names.some(name => {
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(`[${cleanId}]`) ||
          (m.serie && name.includes(`(SN: ${m.serie})`))
        );
      });
    };

    let maq = null;
    clientesDb.forEach(c => {
      if (c.maquinas) {
        const found = c.maquinas.find(matchMaquina);
        if (found) maq = found;
      }
    });
    if (!maq) maq = maquinariaDb.find(matchMaquina);

    let modeloStr = o.modelo || '';
    let serieStr = o.serie || '';
    let marcaStr = o.marca || '';
    let ecoStr = o.eco || '';
    let maquinariaId = o.maquinaria_id || null;

    if (maq) {
      modeloStr = maq.modelo || modeloStr;
      serieStr = maq.serie || serieStr;
      marcaStr = maq.marca || marcaStr;
      ecoStr = maq.no_economico || ecoStr;
      maquinariaId = maq.id || maq.idInterno || maquinariaId;
    } else {
      if (t.equipo.includes('(SN: ')) {
        const parts = t.equipo.split('(SN: ');
        serieStr = serieStr || parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          left = left.substring(left.indexOf(']') + 1).trim();
        }
        modeloStr = modeloStr || left;
      } else {
        modeloStr = modeloStr || t.equipo;
      }
    }

    if (
      modeloStr !== prevModelo ||
      serieStr !== prevSerie ||
      marcaStr !== prevMarca ||
      ecoStr !== prevEco ||
      maquinariaId !== prevMaqId ||
      !o.equipo
    ) {
      o.modelo = modeloStr;
      o.serie = serieStr;
      o.marca = marcaStr;
      o.eco = ecoStr;
      o.maquinaria_id = maquinariaId;
      o.equipo = t.equipo;
      
      modificados++;
    }
  });

  if (modificados > 0) {
    console.log(`[App] Se migraron y corrigieron ${modificados} órdenes con datos de maquinaria.`);
    safeSetJSON('sapi_ordenes', ordenes);
  }
};

function migrarUbicacionesMaquinariaDesdeTickets() {
  console.log('[App] Ejecutando migración de ubicaciones de maquinaria desde tickets...');
  let modificadosMaquinariaDb = false;
  let modificadosClientesDb = false;
  let syncCount = 0;

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  // Ordenar tickets de más antiguo a más reciente para que prevalezca la ubicación del ticket más reciente
  const ticketsOrdenados = [...tickets].sort((a, b) => new Date(a.fechaCreacion || a.fecha || 0) - new Date(b.fechaCreacion || b.fecha || 0));

  ticketsOrdenados.forEach(t => {
    if (!t.equipo || t.equipo === 'Otra / No registrada') return;
    if (!t.sitio || t.sitio === 'Ninguno' || t.sitio.toLowerCase() === 'n/a') return;

    const matchMaquina = (m) => {
      const cleanId = m.idInterno || m.id || '';
      if (!cleanId) return false;
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
      const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      
      const equipoString = t.equipo || '';
      const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
      
      return names.some(name => {
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(`[${cleanId}]`) ||
          (m.serie && name.includes(`(SN: ${m.serie})`))
        );
      });
    };

    // Buscar en clientesDb (máquinas manuales)
    clientesDb.forEach(c => {
      if (c.maquinas) {
        c.maquinas.forEach(m => {
          if (matchMaquina(m)) {
            const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
            if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
              console.log(`[Migración] Asignando ubicación '${t.sitio}' a máquina manual ${m.idInterno} del cliente ${c.nombre} según ticket ${t.folio}`);
              m.ubicacion = t.sitio;
              
              // Resolver sitio_id
              let sitioId = m.sitio_id || null;
              const existSitio = sitiosDb.find(s => (s.cliente === c.id || s.cliente === c.nombre) && s.nombre === t.sitio);
              if (existSitio) sitioId = existSitio.id;
              m.sitio_id = sitioId;
              
              modificadosClientesDb = true;
              syncCount++;
            }
          }
        });
      }
    });

    // Buscar en maquinariaDb (máquinas de SAP/Supabase)
    maquinariaDb.forEach(m => {
      if (matchMaquina(m)) {
        const currentUbi = m.ubicacion || m.customData?.ubicacion || '';
        if (!currentUbi || currentUbi.toLowerCase() === 'n/a') {
          console.log(`[Migración] Asignando ubicación '${t.sitio}' a máquina SAP ${m.idInterno || m.id} según ticket ${t.folio}`);
          m.ubicacion = t.sitio;
          
          // Resolver sitio_id
          let clientObj = clientesDb.find(c => c.nombre === m.cliente || c.id === m.cliente);
          let clientDbId = clientObj ? clientObj.id : m.cliente;
          let sitioId = m.sitio_id || null;
          const existSitio = sitiosDb.find(s => (s.cliente === clientDbId || s.cliente === m.cliente) && s.nombre === t.sitio);
          if (existSitio) sitioId = existSitio.id;
          m.sitio_id = sitioId;
          
          if (!m.customData) m.customData = {};
          m.customData.ubicacion = t.sitio;
          
          modificadosMaquinariaDb = true;
          syncCount++;
        }
      }
    });
  });

  if (modificadosClientesDb) {
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }
  if (modificadosMaquinariaDb) {
    localStorage.setItem('sapi_maquinaria_db', JSON.stringify(maquinariaDb));
  }
  if (syncCount > 0) {
    console.log(`[Migración] Se corrigieron las ubicaciones de ${syncCount} máquinas y se enviaron a sincronización.`);
  }
};

function recuperarMaquinariaDesdeTickets() {
  console.log('[App] Ejecutando recuperación de maquinaria desaparecida desde tickets...');
  let modificadosClientesDb = false;
  let recoverCount = 0;

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  tickets.forEach(t => {
    if (!t.equipo || t.equipo === 'Otra / No registrada' || t.equipo.toLowerCase() === 'n/a') return;
    if (!t.cliente || t.cliente === 'Ninguno / Uso Interno' || t.cliente === 'Ninguno') return;

    const matchMaquina = (m) => {
      const cleanId = m.idInterno || m.id || '';
      if (!cleanId) return false;
      const isUUID = cleanId && cleanId.length > 30 && cleanId.includes('-');
      const idDisplay = (cleanId && !isUUID) ? `[${cleanId}] ` : '';
      const mFullName = MARCAS_RENDER[(m.marca || '').toUpperCase()] || m.marca || '';
      const mName = `${idDisplay}${mFullName} ${m.modelo || ''} (SN: ${m.serie || ''})`.trim();
      
      const equipoString = t.equipo || '';
      const names = equipoString.split(',').map(n => n.trim()).filter(Boolean);
      
      return names.some(name => {
        return (
          name === mName ||
          name === cleanId ||
          name === m.serie ||
          name.includes(`[${cleanId}]`) ||
          (m.serie && name.includes(`(SN: ${m.serie})`))
        );
      });
    };

    // 1. Verificar si la máquina ya existe en clientesDb
    let maqExiste = false;
    clientesDb.forEach(c => {
      if (c.maquinas && c.maquinas.some(matchMaquina)) maqExiste = true;
    });

    // 2. Verificar en maquinariaDb
    if (maquinariaDb.some(matchMaquina)) maqExiste = true;

    // 3. Si no existe en ningún lado, la recreamos
    if (!maqExiste) {
      console.log(`[Recuperación] Recreando máquina desaparecida '${t.equipo}' para el cliente '${t.cliente}'`);
      
      let idInterno = null;
      let marca = 'OTM';
      let modelo = 'Sin Modelo';
      let serie = 'N/A';

      let equipoStr = t.equipo.trim();
      if (equipoStr.includes('(SN: ')) {
        const parts = equipoStr.split('(SN: ');
        serie = parts[1].replace(')', '').trim();
        let left = parts[0].trim();
        if (left.startsWith('[') && left.includes(']')) {
          const idIndex = left.indexOf(']');
          idInterno = left.substring(1, idIndex).trim();
          left = left.substring(idIndex + 1).trim();
        }
        
        let foundMarcaKey = null;
        for (const [key, value] of Object.entries(MARCAS_RENDER)) {
          if (left.toUpperCase().startsWith(value.toUpperCase())) {
            foundMarcaKey = key;
            modelo = left.substring(value.length).trim();
            break;
          }
          if (left.toUpperCase().startsWith(key.toUpperCase())) {
            foundMarcaKey = key;
            modelo = left.substring(key.length).trim();
            break;
          }
        }
        
        if (foundMarcaKey) {
          marca = foundMarcaKey;
        } else {
          const words = left.split(' ');
          if (words.length > 0) {
            marca = words[0];
            modelo = words.slice(1).join(' ') || 'Sin Modelo';
          }
        }
      } else {
        modelo = equipoStr;
      }

      // Encontrar o crear clienteObj en clientesDb
      let clienteObj = clientesDb.find(c => c.nombre === t.cliente);
      if (!clienteObj) {
        clienteObj = {
          id: crypto.randomUUID(),
          nombre: t.cliente,
          maquinas: [],
          sitios: [],
          createdAt: new Date().toISOString()
        };
        clientesDb.push(clienteObj);
        modificadosClientesDb = true;
      }

      if (!clienteObj.maquinas) {
        clienteObj.maquinas = [];
      }

      const nuevaMaq = {
        idInterno: idInterno || safeGenerarIdInternoMaquina(marca, ''),
        id: crypto.randomUUID(),
        marca,
        modelo,
        serie,
        ubicacion: t.sitio || 'N/A',
        sitio_id: null,
        latitud: null,
        longitud: null,
        tipo: 'N/A',
        customData: {
          tipo: 'N/A',
          numeroEconomico: 'N/A',
          numeroMotor: 'N/A',
          venta: '',
          ubicacion: t.sitio || 'N/A'
        }
      };

      // Resolver sitio_id
      if (t.sitio && t.sitio !== 'Ninguno') {
        const existSitio = sitiosDb.find(s => (s.cliente === clienteObj.id || s.cliente === clienteObj.nombre) && s.nombre === t.sitio);
        if (existSitio) nuevaMaq.sitio_id = existSitio.id;
      }

      clienteObj.maquinas.push(nuevaMaq);
      modificadosClientesDb = true;
      recoverCount++;

      // Sincronizar nueva máquina con Supabase
      if (window.pushToSupabase) {
        window.pushToSupabase('maquinaria', { ...nuevaMaq, cliente: clienteObj.id });
      }
    }
  });

  if (modificadosClientesDb) {
    localStorage.setItem('sapi_clientes_db', JSON.stringify(clientesDb));
  }
  if (recoverCount > 0) {
    console.log(`[Recuperación] Se recuperaron con éxito ${recoverCount} máquinas desaparecidas desde los tickets.`);
  }
};

// Función para reintentar sincronizar gastos locales que no han subido a Supabase
function reintentarSincronizacionGastosLocales() {
  console.log('[App] Verificando gastos locales pendientes de sincronización...');
  const localGastos = safeGetJSON('sapi_gastos', []);
  let encolados = 0;
  localGastos.forEach(g => {
    if (g && g._synced !== true) {
      // Evitar reintentar sincronizar gastos de prueba/mock
      if (g.esPrueba === true || g.isTest === true || g.id === 'gasto_seed_1') {
        return;
      }
      console.log('[Sync] Re-sincronizando gasto local:', g.id);
      if (window.pushToSupabase) {
        window.pushToSupabase('gastos', g);
        encolados++;
      }
    }
  });
  if (encolados > 0) {
    console.log(`[App] Se re-encolaron ${encolados} gastos locales para subida.`);
  }
};

// Rutina de auto-reparación para asegurar que todos los tickets locales y en nube tengan su creador asignado
function repararCreadoresTicketsFaltantes() {
  try {
    const rawTickets = (typeof localStorage !== 'undefined') ? localStorage.getItem('sapi_tickets') : JSON.stringify(safeGetJSON('sapi_tickets', []));
    if (!rawTickets) return;
    let ticketsList = JSON.parse(rawTickets);
    if (!Array.isArray(ticketsList) || ticketsList.length === 0) return;

    let repairedCount = 0;
    const ticketsToPush = [];

    ticketsList.forEach(t => {
      if (!t) return;
      const tieneCreador = t.creadoPor && String(t.creadoPor).trim() !== '' && t.creadoPor !== '—' && t.creadoPor !== 'null';
      if (!tieneCreador) {
        const resCreador = (typeof window !== 'undefined' && typeof window.resolverCreadorTicket === 'function')
          ? window.resolverCreadorTicket(t)
          : ((typeof resolverCreadorTicket === 'function') ? resolverCreadorTicket(t) : (t.creado_por || null));

        if (resCreador && String(resCreador).trim()) {
          t.creadoPor = String(resCreador).trim();
          repairedCount++;
          if (t.id) {
            ticketsToPush.push({ id: t.id, creado_por: t.creadoPor });
          }
        }
      }
    });

    if (repairedCount > 0) {
      console.log(`[Auto-Repair] Se repararon ${repairedCount} tickets con creador faltante.`);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sapi_tickets', JSON.stringify(ticketsList));
      }
      if (typeof safeSetJSON === 'function') {
        safeSetJSON('sapi_tickets', ticketsList);
      }
      if (typeof window !== 'undefined' && window._supaTickets && Array.isArray(window._supaTickets)) {
        window._supaTickets = ticketsList;
      }
      if (typeof tickets !== 'undefined' && Array.isArray(tickets)) {
        ticketsList.forEach(rep => {
          const idx = tickets.findIndex(x => x.id === rep.id);
          if (idx !== -1) tickets[idx].creadoPor = rep.creadoPor;
        });
      }

      // Sincronizar actualización puntual a Supabase en segundo plano
      if (ticketsToPush.length > 0) {
        const sbClient = (typeof window !== 'undefined' && window.supabaseClient) ? window.supabaseClient : null;
        if (sbClient) {
          Promise.allSettled(ticketsToPush.map(p =>
            sbClient.from('tickets').update({ creado_por: p.creado_por }).eq('id', p.id)
          )).then(results => {
            console.log(`[Auto-Repair] Creadores sincronizados a Supabase: ${results.filter(r => r.status === 'fulfilled').length}/${ticketsToPush.length}`);
          }).catch(err => {
            console.warn('[Auto-Repair] Error al sincronizar creadores reparados con Supabase:', err);
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Auto-Repair] Error en repararCreadoresTicketsFaltantes:', err);
  }
}

  if (typeof window !== 'undefined') {
    window.AppMigrations = {
      generarTicketsRefaccionesFaltantes,
      migrarOrdenesExistentesMaquinaria,
      migrarUbicacionesMaquinariaDesdeTickets,
      recuperarMaquinariaDesdeTickets,
      reintentarSincronizacionGastosLocales,
      repararCreadoresTicketsFaltantes
    };
    window.generarTicketsRefaccionesFaltantes = generarTicketsRefaccionesFaltantes;
    window.migrarOrdenesExistentesMaquinaria = migrarOrdenesExistentesMaquinaria;
    window.migrarUbicacionesMaquinariaDesdeTickets = migrarUbicacionesMaquinariaDesdeTickets;
    window.recuperarMaquinariaDesdeTickets = recuperarMaquinariaDesdeTickets;
    window.reintentarSincronizacionGastosLocales = reintentarSincronizacionGastosLocales;
    window.repararCreadoresTicketsFaltantes = repararCreadoresTicketsFaltantes;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generarTicketsRefaccionesFaltantes,
      migrarOrdenesExistentesMaquinaria,
      migrarUbicacionesMaquinariaDesdeTickets,
      recuperarMaquinariaDesdeTickets,
      reintentarSincronizacionGastosLocales,
      repararCreadoresTicketsFaltantes
    };
  }
})();
