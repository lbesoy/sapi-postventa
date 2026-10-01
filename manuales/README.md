# Centro de Documentación y Ayuda Oficial — SAPI Postventa (Eurorep CRM)

¡Bienvenido al Centro de Documentación y Ayuda de **SAPI Postventa (Eurorep CRM)**!

Esta biblioteca técnica y operativa contiene las guías paso a paso diseñadas para capacitar a todos los actores del ecosistema Eurorep: desde clientes que gestionan sus parques de maquinaria y contratos de arrendamiento, hasta técnicos de campo que operan en condiciones sin conexión a internet y administradores que auditan la operación y la sincronización con SAP Business One.

---

## 🔒 Matriz de Acceso y Visibilidad de Manuales por Rol

El sistema implementa un **filtrado inteligente de manuales por rol** en el panel de usuario, garantizando que cada perfil consulte únicamente la información correspondiente a sus responsabilidades:

| Manual / Guía Oficial | Formato | Superadmin | Admin / Supervisor | Técnico de Campo | Cliente / Empresa |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Manual del Cliente** | PDF / MD | ✅ | ✅ | ❌ | ✅ *(Exclusivo)* |
| **Manual del Administrador** | PDF / MD | ✅ | ✅ | ❌ | ❌ |
| **Manual del Técnico de Campo** | PDF / MD | ✅ | ✅ | ✅ | ❌ |
| **Manual de Gestión de Tickets** | PDF / MD | ✅ | ✅ | ❌ | ❌ |
| **Manual de Control de Gastos y Clara** | PDF / MD | ✅ | ✅ | ✅ | ❌ |
| **Manual de Flujo Completo End-to-End** | PDF / MD | ✅ | ✅ | ✅ | ❌ |
| **Diagrama de Flujo Interactivo** | HTML | ✅ | ✅ | ✅ | ❌ *(Oculto)* |
| **Manual Técnico para Desarrolladores** | PDF / MD | ✅ *(Único)* | ❌ | ❌ | ❌ |

---

## 📚 Índice de Manuales Disponibles

### 📘 1. [Manual del Cliente (Portal de Clientes)](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_cliente.md)
* **Destinatarios**: Clientes externos, jefes de mantenimiento y compras en empresas socias.
* **Contenido**: Auto-registro, panel de salud de flota (anillo de horómetros), gestión de maquinaria propia, nuevo módulo de contratos de renta (check-in / check-out), levantamiento de tickets de avería, aprobación y rechazo de cotizaciones SAP, carga de Órdenes de Compra (OC), descarga de reportes técnicos PDF y chat de soporte en vivo.

### 📙 2. [Manual de Administrador y Supervisor Operativo](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_administrador.md)
* **Destinatarios**: Coordinadores de servicio, supervisores de taller y gerentes de operaciones.
* **Contenido**: KPIs operativos, mapa de flota en tiempo real (Leaflet), gestión integral de contratos de renta y actas de entrega/devolución, administración de frentes de trabajo (sitios multi-obra), ciclo de tickets, programación del calendario operativo y bloqueos de agenda, auditoría técnica de órdenes terminadas (checklist 15 puntos y refacciones SAP), reporte semanal de nómina y viáticos, mapeo dinámico de columnas, sincronización con SAP B1 Service Layer y modo Sandbox de pruebas.

### 📗 3. [Manual del Técnico de Campo y Taller](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_tecnico.md)
* **Destinatarios**: Técnicos de servicio en campo, mecánicos de taller y cuadrillas móviles.
* **Contenido**: Instalación de la aplicación en celulares Android / iOS (PWA), protocolo obligatorio de precarga de órdenes para trabajo 100% Offline (sin señal en minas o sótanos), flujo secuencial de la orden de servicio (foto de entrada obligatoria, bitácora diaria de avance, tiempos de traslado, checklist de 15 puntos de inspección, lectura de horómetro y ciclos preventivos de 250h, catálogo de refacciones SAP, foto de salida y recolección de firmas digitales en pantalla), levantamientos de rentas, registro de viáticos y sincronización manual.

### 🎫 4. [Manual de Gestión y Ciclo de Vida de Tickets](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_tickets.md)
* **Destinatarios**: Mesa de ayuda, administradores, personal de ventas y supervisores.
* **Contenido**: Las 6 etapas del ciclo de vida del ticket (*Reportado*, *En Curso*, *Cotizado*, *En Proceso*, *Orden de Servicio*, *Cerrado*), gatillos y roles responsables de cada transición, cotizaciones de venta SAP B1 y subida de PDFs, carga de órdenes de compra del cliente, gestión de **Tickets-A de refacciones de campo** autogenerados desde órdenes de servicio, canales de chat público vs notas internas confidenciales protegidas por políticas RLS en Supabase, y herramientas de diagnóstico y depuración.

### 📕 5. [Manual de Control de Gastos, Viáticos e Integración Clara](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_gastos.md)
* **Destinatarios**: Técnicos de campo, supervisores y personal de administración y finanzas.
* **Contenido**: Captura móvil de tickets de combustible, casetas, alimentos y hotel, vinculación de tarjetas corporativas Clara, extractor inteligente de facturas electrónicas XML (CFDI 4.0) y PDF del SAT, módulo de auto-conciliación de dos columnas (cargos bancarios vs facturas fiscales), ciclo de estados del gasto y exportación de reportes de nómina semanal a Excel/CSV.

### 🔄 6. [Manual de Flujo Completo End-to-End](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_flujo_completo.md)
* **Destinatarios**: Todo el personal operativo, comercial, técnico y directivo.
* **Contenido**: Recorrido integral de las 8 fases del servicio técnico desde la solicitud del cliente o contrato de renta, cotización en SAP B1, autorización y OC, asignación en calendario, preparación offline, ejecución en obra con bitácoras y checklist, rendición de viáticos, compilación del reporte PDF oficial, almacenamiento en Microsoft OneDrive y cierre comercial en SAP B1.

### 📓 7. [Manual Técnico de Arquitectura y Referencia para Desarrolladores](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_tecnico_desarrollador.md)
* **Destinatarios**: Exclusivamente `superadmin`, ingenieros de software y administradores de sistemas.
* **Contenido**: Arquitectura distribuida SPA/PWA, diccionario completo de tablas y schemas de PostgreSQL en Supabase, funciones STABLE y políticas de seguridad RLS (Row-Level Security), persistencia de cookies de sesión en SAP Service Layer y batching de 500 registros, arquitectura offline con IndexedDB y cola de sincronización de imágenes Base64, compilador de documentación a PDF con Puppeteer, y lineamientos de versionado y despliegue local.

---

## 💡 Recomendaciones Técnicas Generales

1. **Navegadores Soportados**: Se recomienda **Google Chrome** (en Windows, Mac y Android) o **Apple Safari** (en iOS/iPadOS).
2. **PWA y Acceso Rápido**: Instalar la aplicación en la pantalla de inicio del dispositivo móvil para habilitar el almacenamiento en caché ultrarrápido y soporte de pantalla completa.
3. **Seguridad y Confidencialidad**: Todas las transacciones e imágenes están cifradas y respaldadas en Supabase Storage con políticas de acceso basadas en roles. No compartir contraseñas institucionales.
