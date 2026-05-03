const ordenes = [];
const clientesDb = [];
const usuarios = [];
const API_CONFIG = { USE_SAP_BACKEND: true };
const document = {
  getElementById: () => ({ value: '', innerHTML: '' })
};
const CLIENTES_PER_PAGE = 25;
let currentPageClientes = 1;

function renderClientes() {
  const grid = document.getElementById('clientes-grid');
  const paginationContainer = document.getElementById('clientes-pagination');
  
  const legacyMap = new Map();
  ordenes.forEach(o => {
    if (o.cliente) {
      if (!legacyMap.has(o.cliente)) {
        legacyMap.set(o.cliente, { nombre: o.cliente, ubicacion: o.ubicacion, legacy: true });
      }
    }
  });

  const mergedClientes = [...clientesDb];
  
  usuarios.forEach(u => {
    if (u.rol === 'empresa' || u.rol === 'cliente') {
      const nomEmpresa = u.empresa || u.nombre; // Fallback for old users
      if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (nomEmpresa || '').toLowerCase())) {
        mergedClientes.push({ nombre: nomEmpresa, id: u.id, ubicacion: 'Usuario registrado' });
      }
    }
  });

  legacyMap.forEach((legacyClient) => {
    if (!mergedClientes.find(c => (c.nombre || '').toLowerCase() === (legacyClient.nombre || '').toLowerCase())) {
      mergedClientes.push(legacyClient);
    }
  });

  const searchText = (document.getElementById('busqueda-cliente')?.value || '').toLowerCase().trim();
  let filtrados = mergedClientes;
  
  if (searchText) {
    filtrados = filtrados.filter(c => 
      (c.nombre || '').toLowerCase().includes(searchText) || 
      (c.rfc || '').toLowerCase().includes(searchText) ||
      (c.email && c.email.toLowerCase().includes(searchText))
    );
  }

  if (!filtrados.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">No se encontraron clientes.</div>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }
  
  // PAGINACIÓN
  const totalPages = Math.ceil(filtrados.length / CLIENTES_PER_PAGE);
  if (currentPageClientes > totalPages) currentPageClientes = totalPages;
  if (currentPageClientes < 1) currentPageClientes = 1;
  
  const startIndex = (currentPageClientes - 1) * CLIENTES_PER_PAGE;
  const paginatedClientes = filtrados.slice(startIndex, startIndex + CLIENTES_PER_PAGE);
  
  // RENDERIZAR CUADRÍCULA
  grid.innerHTML = paginatedClientes.map(c => {
    const qtyOrdenes = ordenes.filter(x => x.cliente === c.nombre).length;
    let maquinasText = '';
    if (c.maquinas && c.maquinas.length > 0) {
      maquinasText = `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;"><i data-lucide="settings-2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:0.2rem;"></i> ${c.maquinas.length} máquina(s)</div>`;
    }
    
    // Formatear moneda (SAP)
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    
    return `
      <div class="card-person" style="cursor:pointer;" onclick="verDetalleCliente(this.dataset.nombre)" data-nombre="${(c.nombre || 'Sin nombre').replace(/"/g, '&quot;')}">
        <div class="card-person-name" style="font-weight:700; margin-bottom: 0.2rem;">${c.nombre || 'Sin nombre'}</div>
        ${c.id && c.id !== 'Usuario registrado' ? `<div style="font-size:0.72rem; color:var(--accent); font-weight:600; margin-bottom:0.4rem;">${c.id} ${c.rfc && c.rfc !== 'Genérico' ? `• ${c.rfc}` : ''}</div>` : ''}
        
        <div class="card-person-sub" style="margin-bottom:0.6rem;">
          ${c.email ? `<div style="margin-bottom:0.2rem;"><i data-lucide="mail" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>${c.email}</div>` : ''}
          ${c.grupoSinergia && c.grupoSinergia !== 'N/A' ? `<div><i data-lucide="users" style="width:11px;height:11px;vertical-align:middle;margin-right:0.3rem;"></i>Grupo: ${c.grupoSinergia}</div>` : ''}
        </div>
        
        ${API_CONFIG.USE_SAP_BACKEND ? `
        <div style="background: var(--bg-secondary); padding: 0.6rem; border-radius: var(--radius-sm); margin-bottom: 0.6rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Saldo SAP:</span>
            <span style="font-size:0.75rem; font-weight:600; color:${c.saldoCuenta > 0 ? 'var(--red)' : 'var(--text-primary)'};">${formatMoney(c.saldoCuenta)}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:0.7rem; color:var(--text-muted);">Órdenes Abiertas:</span>
            <span style="font-size:0.75rem; font-weight:600; color:var(--accent);">${formatMoney(c.saldoOrdenes)}</span>
          </div>
        </div>` : ''}
        
        <div class="card-person-sub" style="border-top: 1px dashed var(--border); padding-top:0.6rem;">
          ${qtyOrdenes} ticket(s) en CRM
        </div>
        ${maquinasText}
      </div>
    `;
  }).join('');
  
  if (paginationContainer) {
    if (totalPages > 1) {
      paginationContainer.innerHTML = `Paginacion`;
    } else {
      paginationContainer.innerHTML = '';
    }
  }

  // lucide.createIcons();
}

renderClientes();
console.log("No crash!");
