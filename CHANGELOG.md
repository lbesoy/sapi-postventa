# Changelog - SAPI (Sistema de Postventa Eurorep)

Todos los cambios notables en este proyecto serán documentados en este archivo.
El formato sigue las directrices de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [2.0.0] - 2026-10-12

### Añadido
- **Descarga ultrarrápida en Doble Canal Paralelo (`supabaseSync.js`):** Separación concurrente de columnas ligeras y campos JSONB de comentarios con `Promise.all`, reduciendo el tiempo de sincronización de tickets de >25s a 1.38s para el 100% de los registros (592 tickets).
- **Auditoría enriquecida de eliminaciones (`telemetria.js`):** Registro detallado de quién, cuándo, folio, cliente y motivo de eliminación para tickets y órdenes con pestañas de filtro dedicadas "Tickets" y "Eliminaciones".
- **Navegación bajo demanda a tickets en órdenes:** Folios `TKT-` con formato naranja activo uniforme y carga asíncrona bajo demanda desde Supabase al hacer clic.
- **Pipeline de Integración Continua (CI):** Flujo de GitHub Actions (`ci.yml`) para validación automática de auditoría preventiva (`npm run check`) y 56 suites de pruebas (`npm test`) ante cada push o PR.
- **Autocompilación en Vercel (`vercel.json`):** Configuración de `buildCommand` para ensamblado automático de `index.html` fresco en la nube.
- **Archivos de gobernanza profesional:** `README.md`, `.env.example`, `.editorconfig`, `LICENSE` y `CHANGELOG.md`.

### Corregido
- **Eliminación del error HTTP 500 (`statement timeout`) en PostgreSQL:** Se erradicó el ordenamiento no indexado sobre campos JSONB masivos.
- **Sincronización total de métricas KPI:** Las tarjetas de estado en la vista de tickets y dashboard ahora se actualizan de forma reactiva con `renderStats()` manteniéndose alineadas con el conteo real del encabezado (554 tickets).
- **Prevención de colisiones de escritura en arranque:** Migración de tickets v9 fijada a `localStorage` para evitar 7 escrituras concurrentes compitiendo con la lectura inicial.

---

## [1.9.0] - 2026-10-10

### Añadido
- Soporte para drag & drop de cotizaciones y pedidos en formato PDF dentro del detalle de tickets.
- Blindaje contra cierre accidental de ventanas modales (detección de arrastre, gestos horizontales y clics exteriores).
- Visor interactivo y manuales de usuario integrados con diseño Eurorep.

### Corregido
- Deduplicación estricta de tickets y órdenes de servicio.
- Recuperación y blindaje de evidencias fotográficas en órdenes previniendo sobreescrituras vacías.
