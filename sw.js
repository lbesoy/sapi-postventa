const CACHE_NAME = 'eurorep-postventa-v418';
const ASSETS = [
  '/',
  '/index.html',
  '/localstorage-bridge.js',
  '/theme-base.css',
  '/store.js',
  '/utils.js',
  '/sap_sync.js',
  '/sap_mapper.js',
  '/notificaciones.js',
  '/config_tecnicos.js',
  '/ordenes_estados.js',
  '/ordenes_listado.js',
  '/ordenes_form.js',
  '/ordenes_detalle.js',
  '/ordenes_bitacora.js',
  '/servicios_programados.js',
  '/tickets_listado.js',
  '/tickets_form.js',
  '/tickets_detalle.js',
  '/app_migrations.js',
  '/app.js',
  '/dashboard.js',
  '/usuarios.js',
  '/refacciones_orden.js',
  '/gastos.js',
  '/onedrive.js',
  '/telemetria.js',
  '/automatizaciones.js',
  '/resumen_semanal.js',
  '/ideas_fallas.js',
  '/preferencias.js',
  '/sitios_clientes.js',
  '/clientes.js',
  '/maquinaria.js',
  '/calendario.js',
  '/soporte.js',
  '/kits.js',
  '/juntas.js',
  '/depurador_tickets.js',
  '/depurador_ordenes.js',
  '/envios.js',
  '/asignacion_tecnicos.js',
  '/rentas.js',
  '/style.css',
  '/cliente.html',
  '/cliente.css',
  '/cliente.js',
  '/supabaseSync.js',
  '/supabaseClient.js',
  '/levantamientos.js',
  '/tecnicos_reporte.js',
  '/logo_transparent.png',
  '/Logo_de_Clara.svg',
  '/manuales/manual_flujo_completo.html',
  '/manuales/manual_administrador.html',
  '/manuales/manual_tecnico.html',
  '/manuales/manual_tickets.html',
  '/manuales/manual_gastos.html',
  '/manuales/diagrama_flujo.html',
  '/manuales/manual_cliente.html',
  '/manuales/manual_tecnico_desarrollador.html',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// Instalación del Service Worker
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('[PWA] Precargando recursos estáticos indispensables...');
        await Promise.allSettled(
          ASSETS.map(url => cache.add(url).catch(err => {
            console.warn('[PWA] No se pudo precargar:', url, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[PWA] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones de red
self.addEventListener('fetch', e => {
  // Evitar interceptar llamadas a la API de Supabase o servicios externos asíncronos en tiempo real
  if (e.request.url.includes('supabase.co') || e.request.url.includes('github') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Clonar e insertar en caché si la respuesta es válida (incluyendo CORS de CDNs)
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Estrategia Offline Fallback en caché (ignorar parámetros de consulta como ?v=...)
        return caches.match(e.request, { ignoreSearch: true }).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
        });
      })
  );
});

// Sincronización en segundo plano (Background Sync API)
self.addEventListener('sync', e => {
  if (e.tag === 'sapi-background-sync' || e.tag === 'sync-queue') {
    console.log('[PWA SW] Evento de sincronización en segundo plano recibido:', e.tag);
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED', tag: e.tag, timestamp: Date.now() });
        });
      })
    );
  }
});

// Recepción de mensajes desde clientes de la aplicación
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
