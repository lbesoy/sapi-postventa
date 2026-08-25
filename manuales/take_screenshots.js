const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('🚀 Starting screenshot capture script...');
  
  // Ruta de Google Chrome en macOS
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    userDataDir: path.join(__dirname, 'chrome_profile'),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();
  
  // Interceptar window.cargarDatosDeSupabase para evitar que sobrescriba sapi_ordenes del localStorage
  await page.evaluateOnNewDocument(() => {
    let mockFunc = async function() {
      console.log('[Mocked Sync] Intercepted and bypassed cargarDatosDeSupabase to protect localStorage');
      // Disparar el evento indicando que se cargaron datos
      setTimeout(() => {
        window.dispatchEvent(new Event('supabase_datos_cargados'));
      }, 50);
      return Promise.resolve();
    };
    Object.defineProperty(window, 'cargarDatosDeSupabase', {
      get() {
        return mockFunc;
      },
      set(val) {
        console.log('[Mocked Sync] Prevented overwriting window.cargarDatosDeSupabase');
      },
      configurable: true
    });
  });
  
  // ─── 1. CAPTURAR CONTROL DE GASTOS (ADMIN) ───
  console.log('📸 Capturing Control de Gastos...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('eurorep_session', JSON.stringify({
      userId: 'superadmin',
      viewMode: 'superadmin',
      nombre: 'Pablo Besoy',
      empresa: 'EUROREP',
      realUserId: 'superadmin',
      realRol: 'superadmin'
    }));
    localStorage.setItem('eurorep_test_mode', 'true');
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(async () => {
    // Forzar cambio de vista a gastos
    const navGastos = document.getElementById('nav-gastos');
    if (navGastos) {
      navGastos.click();
    } else if (typeof window.switchMode === 'function' && typeof window.navegarA === 'function') {
      window.navegarA('gastos');
    }
  });
  
  // Esperar un momento a que rendericen los datos y gráficos
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.screenshot({ path: path.join(__dirname, 'images', 'control_gastos.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Control de Gastos captured.');

  // ─── 1b. CAPTURAR DETALLES DE TICKET EN SUS DIFERENTES ETAPAS (ADMIN) ───
  
  // 1. Etapa Abierto: Selección de Refacciones (admin_ticket_refacciones.jpg)
  console.log('📸 Capturing Detalle de Ticket: Refacciones (Abierto)...');
  await page.evaluate(() => {
    const mockTicket = {
      id: 'T-1001',
      folio: 'T-1001',
      cliente: 'CONCRETOS DEL ESTE',
      sitio: 'Planta Oriente',
      contacto: 'Ing. Carlos Mendoza',
      estado: 'Abierto',
      prioridad: 'Alta',
      solicitante: 'Carlos Mendoza',
      creadoPor: 'cliente_test',
      area: 'Mecánica',
      categoria: 'Correctivo',
      asignado: 'Sin asignar',
      equipo: 'Rubble Master RM100',
      descripcion: 'Falla en el encendido del motor secundario, se sospecha de un problema en el sistema de combustible.',
      fechaCreacion: '2026-08-20T12:00:00Z'
    };
    localStorage.setItem('sapi_tickets', JSON.stringify([mockTicket]));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const navTickets = document.getElementById('nav-tickets');
    if (navTickets) navTickets.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.evaluate(() => {
    if (typeof window.verDetalleTicket === 'function') {
      window.verDetalleTicket('T-1001');
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.evaluate(() => {
    if (typeof window.agregarFilaRefaccionTicket === 'function') {
      window.agregarFilaRefaccionTicket('T-1001');
    }
    // Inyectar marca y descripción ficticia
    setTimeout(() => {
      const row = document.querySelector('#ref-ticket-list .ref-row');
      if (row) {
        const marcaSel = row.querySelector('.ref-marca');
        if (marcaSel) marcaSel.value = 'RBM';
        const descSel = row.querySelector('.ref-desc');
        if (descSel) descSel.value = 'Filtro de Combustible RM';
        const cantInput = row.querySelector('.ref-cant');
        if (cantInput) cantInput.value = '1';
      }
    }, 100);
    
    const detailBody = document.getElementById('ticket-detalle-body');
    if (detailBody) {
      const sections = Array.from(detailBody.querySelectorAll('.detalle-section'));
      const refSec = sections.find(s => s.querySelector('.detalle-section-title')?.textContent.includes('Procesar Ticket'));
      if (refSec) {
        refSec.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        detailBody.scrollTop = detailBody.scrollHeight;
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'admin_ticket_refacciones.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Admin Ticket Refacciones captured.');
  await page.evaluate(() => {
    if (typeof window.cerrarDetalleTicket === 'function') window.cerrarDetalleTicket();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. Etapa Refacciones: Vinculación de Cotización (admin_ticket_cotizacion.jpg)
  console.log('📸 Capturing Detalle de Ticket: Cotización (Refacciones)...');
  await page.evaluate(() => {
    const mockTicket = {
      id: 'T-1002',
      folio: 'T-1002',
      cliente: 'CONCRETOS DEL ESTE',
      sitio: 'Planta Oriente',
      contacto: 'Ing. Carlos Mendoza',
      estado: 'Refacciones',
      prioridad: 'Alta',
      solicitante: 'Carlos Mendoza',
      creadoPor: 'cliente_test',
      area: 'Mecánica',
      categoria: 'Correctivo',
      asignado: 'Sin asignar',
      equipo: 'Rubble Master RM100',
      descripcion: 'Falla en el encendido del motor secundario, se sospecha de un problema en el sistema de combustible.',
      fechaCreacion: '2026-08-20T12:00:00Z',
      refaccionesSeleccionadas: [
        { marca: 'RBM', descripcion: 'Filtro de Combustible RM', codigo: 'RM-FC-102', cantidad: 1, estatusPedido: 'Por Pedir' }
      ]
    };
    localStorage.setItem('sapi_tickets', JSON.stringify([mockTicket]));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const navTickets = document.getElementById('nav-tickets');
    if (navTickets) navTickets.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.evaluate(() => {
    if (typeof window.verDetalleTicket === 'function') {
      window.verDetalleTicket('T-1002');
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.evaluate(() => {
    const detailBody = document.getElementById('ticket-detalle-body');
    if (detailBody) {
      const sections = Array.from(detailBody.querySelectorAll('.detalle-section'));
      const refSec = sections.find(s => s.querySelector('.detalle-section-title')?.textContent.includes('Etapa: Selección de Refacciones'));
      if (refSec) {
        refSec.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        detailBody.scrollTop = detailBody.scrollHeight;
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'admin_ticket_cotizacion.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Admin Ticket Cotización captured.');
  await page.evaluate(() => {
    if (typeof window.cerrarDetalleTicket === 'function') window.cerrarDetalleTicket();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Etapa Cotización: Vinculación de Pedido SAP (admin_ticket_procesar.jpg)
  console.log('📸 Capturing Detalle de Ticket: Pedido (Cotización)...');
  await page.evaluate(() => {
    const mockTicket = {
      id: 'T-1003',
      folio: 'T-1003',
      cliente: 'CONCRETOS DEL ESTE',
      sitio: 'Planta Oriente',
      contacto: 'Ing. Carlos Mendoza',
      estado: 'Cotización',
      prioridad: 'Alta',
      solicitante: 'Carlos Mendoza',
      creadoPor: 'cliente_test',
      area: 'Mecánica',
      categoria: 'Correctivo',
      asignado: 'Sin asignar',
      equipo: 'Rubble Master RM100',
      descripcion: 'Falla en el encendido del motor secundario, se sospecha de un problema en el sistema de combustible.',
      fechaCreacion: '2026-08-20T12:00:00Z',
      cotizacionSAP: 'COT-50012',
      montoCotizacion: 15450.00,
      cotAceptada: 'si',
      refaccionesSeleccionadas: [
        { marca: 'RBM', descripcion: 'Filtro de Combustible RM', codigo: 'RM-FC-102', cantidad: 1, estatusPedido: 'Por Pedir' }
      ]
    };
    localStorage.setItem('sapi_tickets', JSON.stringify([mockTicket]));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const navTickets = document.getElementById('nav-tickets');
    if (navTickets) navTickets.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.evaluate(() => {
    if (typeof window.verDetalleTicket === 'function') {
      window.verDetalleTicket('T-1003');
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.evaluate(() => {
    const detailBody = document.getElementById('ticket-detalle-body');
    if (detailBody) {
      const sections = Array.from(detailBody.querySelectorAll('.detalle-section'));
      const cotSec = sections.find(s => s.querySelector('.detalle-section-title')?.textContent.includes('Cierre de Cotización'));
      if (cotSec) {
        cotSec.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        detailBody.scrollTop = detailBody.scrollHeight;
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'admin_ticket_procesar.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Admin Ticket Procesar captured.');
  await page.evaluate(() => {
    if (typeof window.cerrarDetalleTicket === 'function') window.cerrarDetalleTicket();
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // ─── 2. CAPTURAR FORMULARIO NUEVO TICKET (CLIENTE) ───
  console.log('📸 Capturing Nuevo Ticket (Cliente)...');
  
  // Simular desconexión (offline) para evitar que cliente.js intente validar la sesión en el servidor Supabase
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false
    });
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/cliente.html', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('eurorep_session', JSON.stringify({
      userId: 'cliente_test',
      viewMode: 'cliente',
      nombre: 'Cliente de Prueba',
      empresa: 'CONCRETOS DEL ESTE',
      realUserId: 'cliente_test',
      realRol: 'cliente'
    }));
    localStorage.setItem('eurorep_test_mode', 'true');
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(async () => {
    // Navegar a vista de tickets del cliente
    const navItem = document.querySelector('.nav-item[data-target="tickets"]');
    if (navItem) {
      navItem.click();
    } else if (typeof window.navegarA === 'function') {
      window.navegarA('tickets');
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Scroll hacia el formulario de nuevo ticket
  await page.evaluate(() => {
    const form = document.getElementById('form-nuevo-ticket');
    if (form) {
      form.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'nuevo_ticket.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Nuevo Ticket captured.');

  // ─── 3. CAPTURAR VISTAS DEL TÉCNICO DE CAMPO (MÓVIL) ───
  console.log('📸 Capturing Técnico de Campo mobile screens...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('eurorep_session', JSON.stringify({
      userId: 'tecnico_test',
      viewMode: 'tecnico',
      nombre: 'Técnico de Pruebas',
      empresa: 'EUROREP',
      realUserId: 'tecnico_test',
      realRol: 'tecnico'
    }));
    localStorage.setItem('eurorep_test_mode', 'true');
    
    // Inyectar orden de servicio de prueba para que aparezca en la lista del técnico
    localStorage.setItem('sapi_ordenes', JSON.stringify([
      {
        id: 'OS-26001',
        folio: 'OS-26001',
        tecnico: 'Técnico de Pruebas',
        cliente: 'CONCRETOS DEL ESTE',
        maquina: 'Rubble Master RM100',
        sitio: 'Planta Monterrey',
        estado: 'En proceso',
        fecha: '2026-08-20',
        prioridad: 'Media',
        solicitante: 'Ing. Carlos Ortiz',
        horometro: '4500.5',
        categoria: 'Correctivo',
        diagnostico: 'Pérdida de presión en bomba hidráulica principal.',
        trabajos: 'Diagnóstico inicial realizado. Se requiere cambio de sellos y empaques.',
        ref_utilizadas: [],
        ref_necesarias: [],
        evidencias: { fotoInicio: null, fotoFin: null, adicionales: [] },
        firma_tecnico_base64: null,
        firma_cliente_base64: null,
        esPrueba: true
      }
    ]));
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const navItem = document.querySelector('.nav-item[data-view="servicios"]');
    if (navItem) {
      navItem.click();
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3a. Capturar lista de órdenes asignadas
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_ordenes_lista.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Lista de Órdenes captured.');

  // Abrir el detalle de la primera orden haciendo clic en el botón de ver (icono de ojo)
  await page.evaluate(() => {
    const tableBody = document.getElementById('tabla-body-servicios');
    if (tableBody) {
      const firstRow = tableBody.querySelector('tr');
      if (firstRow) {
        const viewBtn = firstRow.querySelector('button[onclick^="verDetalle"]') || firstRow.querySelector('.action-btn');
        if (viewBtn) {
          viewBtn.click();
        }
      }
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3b. Scroll hacia Evidencias Fotográficas (en el detalle modal) y capturar
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('.accordion-header, h4, h3, h2, label'));
    const evSec = sections.find(s => s.textContent.includes('Evidencias Fotográficas') || s.textContent.includes('Fotos'));
    if (evSec) {
      evSec.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_evidencias_seccion.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Sección de Evidencias captured.');

  // 3c. Scroll hacia Firmas de Conformidad (en el detalle modal) y capturar
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('.accordion-header, h4, h3, h2, label'));
    const sigSec = sections.find(s => s.textContent.includes('Firmas') || s.textContent.includes('Firma'));
    if (sigSec) {
      sigSec.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_firmas_seccion.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Sección de Firmas captured.');

  // 3d. Abrir y capturar modal de avance de bitacora diaria
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnAvance = btns.find(b => b.textContent.includes('Registrar Avance Diario') || b.textContent.includes('Registrar avance diario') || b.onclick?.toString().includes('abrirBitacora'));
    if (btnAvance) {
      btnAvance.click();
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_bitacora_modal.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Modal de Bitácora captured.');

  // Cerrar modal de bitácora
  await page.evaluate(() => {
    if (typeof window.cerrarBitacora === 'function') {
      window.cerrarBitacora();
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3e. Clic en "Completar Reporte" para abrir el formulario de llenado/edición de la orden
  await page.evaluate(() => {
    const btnCompletar = document.getElementById('btn-completar-reporte');
    if (btnCompletar) {
      btnCompletar.click();
    } else if (typeof window.abrirFormulario === 'function') {
      window.abrirFormulario('OS-26001', true);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Llenar datos de prueba en el formulario y hacer scroll a la sección de Diagnóstico y Trabajos
  await page.evaluate(() => {
    // Rellenar falla y trabajos
    const txtFalla = document.getElementById('f-falla');
    const txtTrabajos = document.getElementById('f-trabajos');
    const inputHorometroReal = document.getElementById('f-horometro-real');
    
    if (txtFalla) txtFalla.value = 'Pérdida de presión en bomba hidráulica principal.';
    if (txtTrabajos) txtTrabajos.value = 'Se desmontó la bomba, se detectó daño en sellos y desgaste. Se realizó el cambio de empaques y sellos nuevos, y se probó arranque con carga parcial.';
    if (inputHorometroReal) inputHorometroReal.value = '4508.3';

    // Scroll a Diagnóstico y Trabajos
    const sections = Array.from(document.querySelectorAll('#form-orden .form-section'));
    const trabajosSec = sections.find(s => s.querySelector('.form-section-title')?.textContent.includes('Diagnóstico y Trabajos'));
    if (trabajosSec) {
      trabajosSec.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  // Capturar formulario de llenado de la orden de servicio (Horómetro, Diagnóstico, Trabajos)
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_orden_detalle.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Llenado de Orden captured.');

  // 3f. Scroll hacia la sección de Refacciones en el formulario de edición, dar clic en +Agregar e inyectar valores mock
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('#form-orden .form-section'));
    const refSec = sections.find(s => s.querySelector('.form-section-title')?.textContent.includes('Refacciones'));
    if (refSec) {
      refSec.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    const addBtn = document.querySelector('#ref-utilizadas-list + .btn-add-ref');
    if (addBtn) {
      addBtn.click();
    } else if (typeof window.agregarRef === 'function') {
      window.agregarRef('utilizadas');
    }
    
    // Inyectar datos en la fila agregada para simular el llenado
    setTimeout(() => {
      const row = document.querySelector('#ref-utilizadas-list .ref-row');
      if (row) {
        const marcaDisplay = row.querySelector('.group-ref-marca span');
        if (marcaDisplay) marcaDisplay.textContent = 'Rubble Master';
        
        const descDisplay = row.querySelector('.group-ref-desc span');
        if (descDisplay) descDisplay.textContent = 'Filtro de Aire Primario';
        
        const claveInput = row.querySelector('.ref-clave');
        if (claveInput) {
          claveInput.value = 'RM-FL-1002';
        }
        
        const cantInput = row.querySelector('.ref-cant');
        if (cantInput) cantInput.value = '2';
      }
    }, 100);
  });

  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_orden_refacciones.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Llenado de Refacciones captured.');

  // Cerrar el formulario de edición
  await page.evaluate(() => {
    if (typeof window.cerrarFormulario === 'function') {
      window.cerrarFormulario();
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3g. Inyectar un cambio pendiente en la cola y abrir el modal de Sincronización Manual
  await page.evaluate(() => {
    localStorage.setItem('sapi_sync_queue', JSON.stringify([
      {
        table: 'bitacoras',
        action: 'insert',
        data: { folio: 'OS-26001', descripcion: 'Se inyectó avance de bitácora diaria offline' },
        lastError: 'Pendiente de conexión a internet'
      }
    ]));
    
    // Forzar actualización del indicador en el topbar
    if (typeof window.updateSyncStatusUI === 'function') {
      window.updateSyncStatusUI();
    }
    
    // Abrir el modal de detalles de sincronización
    if (typeof window.verDetallesSincronizacion === 'function') {
      window.verDetallesSincronizacion();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1500));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_sync_modal.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Modal de Sincronización Manual captured.');

  // Cerrar modal de sincronización manual
  await page.evaluate(() => {
    if (typeof window.cerrarModalSyncDetalles === 'function') {
      window.cerrarModalSyncDetalles();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3h. Inyectar levantamiento pendiente (cloud-off) y capturar la fila sin actualizar
  await page.evaluate(() => {
    localStorage.setItem('sapi_levantamientos', JSON.stringify([
      {
        id: 'L-26001',
        folio: 'L-26001',
        tecnico: 'Técnico de Pruebas',
        cliente: 'MINERA PEÑOLES',
        asunto: 'Inspección de pala hidráulica',
        estado: 'Completado',
        fecha: '2026-08-20',
        esPrueba: true,
        _synced: false // Mostrará el icono cloud-off en amarillo
      }
    ]));

    // Cambiar a la vista de Levantamientos
    const navItem = document.querySelector('.nav-item[data-view="levantamientos"]');
    if (navItem) {
      navItem.click();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(__dirname, 'images', 'tecnico_fila_pendiente.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Técnico: Fila Pendiente (cloud-off) captured.');

  // ─── 4. CAPTURAR MODAL PROGRAMAR ASIGNACIÓN (ADMIN CALENDARIO) ───
  console.log('📸 Capturing Programar Asignación Modal (Admin Calendario)...');
  await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
  await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('eurorep_session', JSON.stringify({
      userId: 'superadmin',
      viewMode: 'superadmin',
      nombre: 'Pablo Besoy',
      empresa: 'EUROREP',
      realUserId: 'superadmin',
      realRol: 'superadmin'
    }));
    localStorage.setItem('eurorep_test_mode', 'true');
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    if (typeof window.navegarA === 'function') {
      window.navegarA('calendario');
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await page.evaluate(() => {
    if (typeof window.abrirProgramarTecnico === 'function') {
      window.abrirProgramarTecnico();
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(__dirname, 'images', 'calendario_asignar.jpg'), type: 'jpeg', quality: 90 });
  console.log('✅ Programar Asignación Modal captured.');

  // ─── 5. CAPTURAR VISTA DE PREFERENCIAS (NUEVO DISEÑO DE MANUALES) ───
  console.log('📸 Capturing Preferencias View...');
  await page.evaluate(() => {
    // Cerrar modales que pudieran estar abiertos
    const closeBtns = document.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => btn.click());
    
    if (typeof window.navegarA === 'function') {
      window.navegarA('preferencias');
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: '/Users/pablobesoytrigueros/.gemini/antigravity/brain/47b2c24f-c611-4f63-8a3c-0e7778f7a7a8/preferencias_preview.jpg', type: 'jpeg', quality: 90 });
  console.log('✅ Preferencias Preview captured.');

  await browser.close();
  console.log('🎉 Screenshot capture complete!');
}

run().catch(err => {
  console.error('❌ Error during capture:', err);
  process.exit(1);
});
