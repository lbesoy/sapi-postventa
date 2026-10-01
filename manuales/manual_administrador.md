# Manual de Uso: Administrador y Supervisor Operativo (SAPI Postventa)

Esta guía te proporcionará el conocimiento completo y detallado para operar la consola administrativa y operativa de **SAPI Postventa (Eurorep CRM)**. Desde aquí coordinarás el parque de maquinaria, contratos de renta, asignación de órdenes de servicio, auditoría de reportes técnicos, cálculo de nómina semanal de viáticos, integración con SAP Business One y el control integral de accesos y seguridad.

---

## 📊 1. Monitoreo Global, Dashboards y Geolocalización

Al iniciar sesión con perfil `superadmin`, `admin` o `supervisor`, accederás al **Dashboard Administrativo**:

* **KPIs Operativos en Tiempo Real**:
  * **Tickets Abiertos**: Solicitudes de clientes pendientes de diagnóstico o cotización.
  * **Órdenes en Proceso**: Servicios de campo activos en ejecución técnica.
  * **Rentas Vigentes**: Equipos colocados en arrendamiento en obras y plantas.
  * **Técnicos Disponibles**: Técnicos sin asignación activa en el día en curso.
* **Mapa de Maquinaria y Sitios (Leaflet)**:
  * Visualización geográfica interactiva de todas las máquinas registradas y frentes de trabajo (obras, plantas y minas).
  * Los marcadores se colorean según el estado del equipo (*Operativo*, *En Mantenimiento*, *En Renta*, *Con Falla Reportada*).
* **Alertas de SLA y Compromiso**:
  * Notificaciones visuales si existen tickets de prioridad *Crítica* sin asignar o servicios que superan el tiempo límite comprometido.

---

## 📑 2. Módulo de Gestión de Rentas de Maquinaria

El módulo de rentas centraliza el control físico, temporal y contractual de los equipos en arrendamiento:

### 2.1 Alta de Contrato de Renta:
1. Dirígete a la sección **"Rentas"** en el menú lateral y haz clic en **"Nueva Renta"**.
2. Selecciona el **Cliente / Razón Social** y el **Sitio de Entrega**.
3. Elige la **Maquinaria** del inventario disponible (el sistema filtrará automáticamente los equipos que no tengan otro contrato activo).
4. Define la **Fecha de Inicio**, **Fecha Estimada de Devolución**, **Tarifa de Renta** y el límite de horas permitidas por turno/mes.
5. Haz clic en **"Crear Contrato de Renta"**.

### 2.2 Proceso de Entrega (Check-in):
Al entregar el equipo al cliente en sitio:
* Se ejecuta el checklist de inspección inicial de entrega.
* Se registra el **Horómetro de Entrega**, nivel de combustible (1/4, 1/2, 3/4, Lleno) y estado de limpieza.
* Se capturan fotografías del estado físico del equipo (frente, laterales, cabina, tren de rodaje/llantas, motor).
* Se recaba la firma digital de recepción del cliente.

### 2.3 Proceso de Recepción (Check-out) y Devolución:
Al concluir el contrato de renta:
1. Abre la renta activa y selecciona **"Procesar Devolución (Check-out)"**.
2. Captura el **Horómetro Final** de recepción y nivel de combustible.
3. El sistema calcula de forma automatizada las **Horas Totales Trabajadas** y si existen **Horas Excedentes** con respecto a la cuota contratada para su facturación adicional.
4. Se registran las fotos finales y reporte de daños o faltantes en caso de existir.
5. El equipo vuelve a quedar disponible en el catálogo general.

---

## 📍 3. Gestión Multi-Sitio y Catálogos de Clientes

Para garantizar que los técnicos lleguen con precisión al lugar del servicio:

* **Catálogo de Sitios por Cliente**: En la sección **"Sitios"**, cada empresa puede tener múltiples frentes de trabajo (ej. *Planta Monterrey*, *Mina El Rosario*, *Bodega Tultitlán*).
* **Georreferenciación**: Permite capturar coordenadas GPS (Latitud y Longitud) y referencias de acceso terrestre.
* **Asignación Automática**: Al seleccionar una máquina en un ticket u orden de servicio, el sistema sugiere automáticamente su último sitio asignado.

---

## 🎫 4. Gestión Integral del Ciclo de Tickets de Soporte

El módulo de tickets es el núcleo de la trazabilidad entre el cliente, ventas y servicio técnico:

### 4.1 Recepción y Asignación de Tickets:
1. Ve a **"Tickets"** en el menú lateral.
2. Abre cualquier ticket con estatus **Reportado**.
3. Revisa la descripción de la falla, evidencias fotográficas y horómetro reportado.
4. En el selector **"Asignado A"**, elige al técnico responsable. El sistema enviará el servicio al calendario personal del técnico.

### 4.2 Integración Comercial con SAP Business One:
1. Si el ticket requiere refacciones o cobro de servicio:
   * Realiza la cotización en SAP B1.
   * En la ficha del ticket, selecciona el número de **Cotización SAP** sincronizado, ingresa el monto total y sube el PDF de la cotización.
   * Cambia el estatus a **Cotizado** para que el cliente reciba la notificación en su portal.
2. **Aprobación del Cliente**:
   * Cuando el cliente aprueba la cotización desde su portal, el ticket pasa a estatus **En Proceso**.
   * El cliente puede adjuntar su **Orden de Compra (OC)** o ficha bancaria.
3. **Liberación con Pedido SAP**:
   * Genera el pedido de venta en SAP Business One.
   * Vincula el número de **Pedido SAP** en el ticket y sube el PDF del pedido para liberar la refacción en almacén.
   * El ticket avanza a estatus **Orden de Servicio** para programarse en campo.

### 4.3 Gestión de Tickets-A (Refacciones de Campo):
* Cuando un técnico reporta en campo refacciones adicionales necesarias (`Refacciones Necesarias` en su orden móvil), el sistema autogenera un **Ticket-A** con folio `TKT-[OS]-A`.
* Este ticket inicia directamente en estatus **Refacciones** con los equipos bloqueados para evitar desvinculaciones accidentales.
* El administrador procede a cotizar las piezas en SAP y continuar el ciclo comercial.

### 4.4 Comunicación: Chat Externo vs. Notas Internas:
* **Chat Externo**: Mensajes visibles para el cliente (acuerdos de visita, aclaraciones de cotización).
* **Notas Internas**: Comentarios privados protegidos por políticas RLS en Supabase, accesibles únicamente para administradores, supervisores y técnicos.

---

## 📅 5. Programación y Control del Calendario Operativo

El calendario central (basado en FullCalendar) permite coordinar la agenda operativa del equipo:

1. Ve a la sección **"Calendario"**.
2. **Creación de Asignaciones de Servicio**:
   * Haz clic sobre la fecha y técnico deseado.
   * Vincula la **Orden de Servicio (OS)** y el **Ticket** correspondiente.
   * Define la ventana de tiempo (fecha/hora inicio y fin).
   * Al guardar, la asignación se sincroniza de inmediato con el dispositivo móvil del técnico.
3. **Bloqueos de Agenda e Incidencias**:
   * Puedes programar eventos de tipo: *Vacaciones*, *Descanso*, *Incapacidad*, *Capacitación*, *Junta Operativa*.
   * Los técnicos con eventos de descanso o vacaciones quedan bloqueados para asignación de nuevos servicios en esas fechas.

---

## 📝 6. Auditoría, Depuración y Cierre de Órdenes de Servicio

Una vez que el técnico concluye una orden de servicio en campo (estatus **Completado**), el administrador debe auditarla:

### Puntos de Auditoría Obligatorios:
1. **Bitácoras Diarias y Tiempos**: Validar horas efectivas de trabajo en sitio, horas de traslado de ida y regreso, y descripción narrativa de actividades.
2. **Checklist de 15 Puntos de Inspección**: Verificar que el técnico haya evaluado el estado físico de los componentes mecánicos, hidráulicos y eléctricos.
3. **Horómetro Final y Kilometraje**: Comprobar congruencia en el horómetro capturado contra el historial previo del equipo.
4. **Refacciones Consumidas**: Verificar los códigos y cantidades de piezas tomadas del catálogo de SAP.
5. **Firmas Digitales**: Confirmar la presencia de la firma de conformidad del cliente en obra y la firma del técnico.

### Herramienta de Depuración de Órdenes (Solo Superadmin):
* En la barra superior y en preferencias, el Superadmin cuenta con el **Depurador de Órdenes y Tickets**.
* Permite auditar órdenes huérfanas, regenerar relaciones de tickets de refacciones faltantes y corregir inconsistencias en la base de datos de Supabase.

---

## 💵 7. Reporte Semanal de Técnicos y Control de Nómina de Viáticos

Esta herramienta automatiza la conciliación semanal de servicios y viáticos para el pago a técnicos:

1. En la vista de servicios o técnicos, haz clic en **"Reporte Semanal de Técnicos"**.
2. **Selector de Semana**: Selecciona cualquier fecha; el sistema calculará la semana de Lunes a Domingo.
3. **Matriz de Control**:
   * Muestra cada técnico en una fila y cada día de la semana en columnas.
   * **Indicadores por color**:
     * 🟡 *Amarillo*: Servicio realizado en campo.
     * 🔵 *Azul*: Servicio programado pendiente.
     * 🟣 *Morado*: Días de vacaciones o descanso.
   * **Días con Servicio**: Sumatoria automática de jornadas en campo.
   * **Pago Sugerido ($)**: Estimación económica basada en tarifas de servicio y viáticos aprobados.
   * **Observaciones**: Campo editable para notas contables.
4. **Exportación**: Haz clic en **"Exportar CSV"** para descargar el archivo compatible con Excel para el área de recursos humanos y finanzas.

---

## ⚙️ 8. Mapeo Dinámico de Columnas y Catálogos

Para personalizar cómo se presentan las tablas de datos sin modificar código:
1. Ve a **"Ajustes de Tablas / Mapeos"**.
2. Selecciona la entidad deseada (*Clientes*, *Maquinaria*, *Refacciones*, *Sitios*).
3. Configura qué campos de Supabase o SAP se muestran, su orden y sus etiquetas en pantalla.
4. Guarda la configuración para aplicarla instantáneamente a toda la organización.

---

## 🔄 9. Sincronización con SAP Business One (Service Layer)

El middleware de integración mantiene sincronizados los catálogos clave entre SAP B1 y Supabase:

* **Módulos Sincronizables**: Socios de Negocios (Clientes), Artículos y Refacciones (con listas de precios y marcas `@OK_MARCA`), Sitios de Entrega, Empleados Técnicos, Cotizaciones y Pedidos.
* **Sincronización Manual**: En **Preferencias > Integración SAP**, presiona **"Sincronizar Todo"** o el botón individual por módulo para forzar una actualización inmediata.
* **Manejo de Sesión SAP**: El sistema utiliza cookies de sesión reutilizables almacenadas en Supabase (`config > sap_session`) para evitar bloqueos por inicios de sesión concurrentes en SAP.

---

## 👥 10. Gestión de Usuarios, Roles y Modo Sandbox

### Control de Roles y Accesos:
* Asigna roles específicos a los usuarios:
  * `superadmin`: Acceso irrestricto a toda la plataforma, configuración de sistemas, depuradores y manuales de desarrollo.
  * `admin` / `supervisor`: Control operativo, asignación de órdenes, auditoría de tickets, rentas, finanzas y reportes.
  * `tecnico`: Vista móvil enfocada en órdenes asignadas, bitácoras, checklist y viáticos.
  * `cliente`: Acceso restringido a sus equipos, rentas, tickets y órdenes propias.
* **Simulador de Perfiles (Role Switcher)**: El Superadmin puede simular la vista de cualquier técnico o rol desde el selector superior para auditar su experiencia de usuario sin cerrar sesión.
* **Aprobación de Clientes**: Autoriza o rechaza los registros de nuevos clientes en la pestaña de usuarios.

### Modo Sandbox (Entorno de Pruebas):
* Permite activar un entorno aislado para capacitación de personal o pruebas operativas sin alterar la base de datos de producción de Supabase ni emitir peticiones reales a SAP.
