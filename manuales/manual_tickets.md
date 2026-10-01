# Manual de Gestión: Ciclo de Vida, Cotizaciones y Etapas de Tickets (SAPI Postventa)

Esta guía describe a fondo el funcionamiento, arquitectura y operación del sistema de **Tickets de Soporte** en la plataforma **SAPI Postventa (Eurorep CRM)**, detallando sus vías de creación, las 6 etapas obligatorias de su ciclo de vida, la integración de cotizaciones y pedidos de SAP Business One, la autogeneración de Tickets-A de refacciones de campo y los canales de comunicación seguros.

---

## 🎯 1. Concepto y Propósito del Ticket en SAPI

Un ticket es el punto de inicio de cualquier solicitud de soporte técnico, mantenimiento preventivo, reclamación de garantía o suministro de refacciones en Eurorep. Actúa como el expediente digital unificado que enlaza al **Cliente**, al **Equipo Comercial/Administrativo** y al **Técnico de Campo**.

El ticket agrupa y preserva toda la trazabilidad de una incidencia:
* Datos de la máquina y ubicación del sitio/obra.
* Horómetro físico registrado al momento de la falla.
* Diagnóstico preliminar y evidencias fotográficas.
* Cotizaciones oficiales emitidas en SAP Business One.
* Órdenes de Compra (OC) y comprobantes de pago bancarios del cliente.
* Pedidos formales de venta y hojas de servicio (Órdenes de Servicio) programadas en campo.
* Bitácoras de chat público y notas internas confidenciales del staff.

---

## 🔌 2. Vías de Creación de Tickets ("¿Cómo se originan?")

Los tickets pueden generarse en el sistema mediante tres mecanismos independientes:

### 2.1 Creación Autónoma por el Cliente (Portal de Clientes)
El cliente detecta una avería o requiere un servicio preventivo e ingresa a su portal web (`cliente.html`):
1. Selecciona la pestaña **"Tickets"** y hace clic en **"Nuevo Ticket"**.
2. Elige el **Sitio / Obra** y la **Maquinaria** de su catálogo de equipos vinculados.
3. Ingresa el **Horómetro Actual** de la máquina.
4. Selecciona la **Categoría** (*Servicio Correctivo*, *Servicio Preventivo*, *Refacciones*, *Garantía*), define la **Prioridad** y redacta la descripción del fallo.
5. Adjunta fotografías del problema.
6. Al presionar **"Enviar Solicitud"**, el ticket se guarda en Supabase con estatus **Reportado** y notifica al área de postventa.

### 2.2 Creación Administrativa (Mesa de Ayuda Interna)
Si el cliente realiza el reporte por vía telefónica, correo electrónico o mensajería instantánea:
1. El personal de oficina ingresa al panel administrativo (`index.html`) en la sección **"Tickets"**.
2. Presiona **"Nuevo Ticket"**, asocia la empresa, máquina, sitio y captura las notas recibidas.

### 2.3 Creación Automatizada: Tickets-A de Refacciones de Campo
* Cuando un técnico ejecuta un servicio en una obra y detecta componentes con desgaste que requieren reemplazo futuro, los captura en el apartado **"Refacciones Necesarias"** de su orden móvil.
* Al sincronizarse la orden, el motor en segundo plano (`generarTicketsRefaccionesFaltantes`) detecta los requerimientos y crea de forma automática un **Ticket-A** para gestionar la cotización y suministro comercial de dichas refacciones.

---

## 🔄 3. El Ciclo de Vida y las 6 Etapas (Estatus) del Ticket

Todo ticket avanza por un flujo estructurado de **6 etapas secuenciales**:

```
[Reportado] ➔ [En Curso] ➔ [Cotizado] ➔ [En Proceso] ➔ [Orden de Servicio] ➔ [Cerrado]
```

---

### Etapa 1: Reportado (Abierto)
* **Significado**: El ticket ha sido registrado y se encuentra en la bandeja de entrada pendiente de revisión. No tiene técnico asignado ni cotización asociada.
* **Detonante de Entrada**: Creación del ticket (por cliente o mesa de ayuda).
* **Rol Responsable**: Administrador / Coordinador de Servicio (debe evaluar la falla, verificar disponibilidad de personal y determinar la prioridad).

---

### Etapa 2: En Curso (Asignado)
* **Significado**: Se ha designado un técnico de campo o taller como responsable directo de atender el diagnóstico o servicio.
* **Detonante de Entrada**: El administrador selecciona al técnico en el campo **"Asignado A"** dentro del detalle del ticket.
* **Rol Responsable**: Técnico de Campo (revisa los antecedentes del equipo y se coordina con el sitio).

---

### Etapa 3: Cotizado (Con Cotización SAP B1)
* **Significado**: El área comercial o de refacciones ha elaborado la cotización formal en SAP Business One y la ha publicado en el ticket para revisión del cliente.
* **Detonante de Entrada**: El administrador vincula el número de **Cotización SAP**, ingresa el monto total (en MXN o USD), sube el archivo PDF oficial de la cotización y guarda los cambios.
* **Rol Responsable**: Cliente (recibe la notificación en su portal y debe evaluar la propuesta económica).

---

### Etapa 4: En Proceso (Aprobado por el Cliente)
* **Significado**: El cliente ha revisado la cotización y ha otorgado su autorización formal para proceder con los trabajos o suministro de piezas.
* **Detonante de Entrada**: El cliente hace clic en el botón **"Aceptar Cotización"** dentro de su portal de tickets. Opcionalmente puede adjuntar el PDF de su **Orden de Compra (OC)** o comprobante de pago bancario.
* **Rol Responsable**: Administrador (debe capturar el Pedido de Venta formal en SAP Business One para apartar las refacciones en almacén).
* > [!WARNING]
  > Si el cliente presiona **"Rechazar Cotización"**, el ticket no avanzará a *En Proceso*. El cliente deberá indicar obligatoriamente el motivo de rechazo y el ticket regresará a la mesa comercial para una re-cotización o aclaración técnica.

---

### Etapa 5: Orden de Servicio (Pedido / En Ejecución Técnica)
* **Significado**: El pedido de SAP ha sido generado, las refacciones han sido liberadas por el almacén y se ha programado formalmente la **Orden de Servicio (OS)** en el calendario operativo.
* **Detonante de Entrada**: El administrador vincula el número de **Pedido SAP**, sube el PDF del pedido y programa la fecha del servicio en el Calendario asignando a los técnicos en campo.
* **Rol Responsable**: Técnico de Campo (acude a la obra, realiza la intervención física, captura bitácoras, checklist de 15 puntos, horómetro, refacciones consumidas y recaba la firma digital de conformidad).

---

### Etapa 6: Cerrado (Concluido y Facturado)
* **Significado**: El servicio técnico ha finalizado al 100%, el reporte técnico oficial ha sido generado y firmado, las refacciones fueron descontadas de inventario y se procede al cierre administrativo y contable.
* **Detonante de Entrada**: La orden de servicio asociada pasa a estatus **Completado** con firmas de cliente y técnico. El administrador verifica la consistencia de los datos y cambia el estatus del ticket a **Cerrado**.
* **Efectos Automatizados**:
  1. El sistema genera el **Reporte Técnico Oficial en PDF**.
  2. El PDF se almacena automáticamente en el repositorio corporativo de **Microsoft OneDrive** (`OneDrive/Eurorep CRM/Clientes/[Cliente]/[Folio].pdf`).
  3. El cliente puede descargar su hoja de servicio desde su portal en cualquier momento.

---

## 📊 4. Matriz de Transiciones y Gatillos de Estatus

| Estatus Inicial | Estatus Destino | Acción / Gatillo Requerido | Rol Ejecutor |
| :--- | :--- | :--- | :--- |
| **-** | **Reportado** | Creación inicial del ticket en portal o panel | Cliente / Admin |
| **Reportado** | **En Curso** | Asignación de técnico responsable | Administrador |
| **En Curso** | **Cotizado** | Vinculación de Cotización SAP, monto y PDF | Administrador |
| **Cotizado** | **En Proceso** | Aprobación de cotización (botón en portal) | Cliente |
| **En Proceso** | **Orden de Servicio** | Registro de Pedido SAP y fecha en Calendario | Administrador |
| **Orden de Servicio** | **Cerrado** | Cierre de OS con firmas digitales completas | Técnico / Admin |

---

## 🎫 5. Gestión Especial de Tickets-A (Refacciones de Campo)

Los **Tickets-A** son expedientes creados de manera automatizada para dar seguimiento comercial y logístico a las piezas complementarias solicitadas por los técnicos durante una visita a obra:

* **Nomenclatura Específica**: Se generan con el prefijo `TKT-`, el número de orden de servicio origen y el sufijo `-A` (ejemplo: `TKT-26058-A`).
* **Asunto Automatizado**: Título estándar: `Refacciones para OS [Folio]`.
* **Estatus de Inicio Inmediato**: Inician de forma directa en estatus **Refacciones** con las piezas listadas como "Por Pedir".
* **Protección de Maquinaria Vinculada**: Para asegurar la integridad técnica del diagnóstico emitido en obra, el sistema **bloquea la eliminación de las máquinas asociadas** (los chips de maquinaria no muestran el botón de remoción).
* **Ciclo Comercial de un Ticket-A**: El administrador toma este ticket, cotiza las refacciones en SAP B1, sube el PDF comercial, el cliente lo aprueba y se programa una segunda visita para la instalación final.

---

## 💬 6. Canales de Comunicación en el Ticket (Chat Externo vs. Notas Internas)

Cada ticket cuenta con dos áreas de mensajería claramente diferenciadas para garantizar la privacidad de los procesos internos de Eurorep:

### 1. Comentarios de Seguimiento (Chat Externo con el Cliente):
* **Visibilidad**: Accesible tanto para los usuarios de la empresa cliente como para todo el staff de Eurorep.
* **Uso**: Coordinar horarios de acceso a la planta, resolver dudas técnicas sobre la cotización y confirmar llegadas de refacciones.

### 2. Notas Internas (Chat Privado de Staff):
* **Visibilidad**: Estrictamente confidencial. Oculto para el cliente. Solo visible para usuarios con rol `superadmin`, `admin`, `supervisor` o `tecnico`.
* **Uso**: Anotaciones de logística interna (ej. *"Validar si el cliente tiene saldo vencido en SAP antes de mandar al técnico"*, *"Verificar si la bomba entra por garantía de fábrica"*).
* > [!IMPORTANT]
  > Las notas internas están protegidas directamente en la base de datos de PostgreSQL mediante políticas **Row-Level Security (RLS)** en Supabase. Aunque un cliente intente inspeccionar las peticiones HTTP de la API, la base de datos nunca entregará los registros clasificados como notas internas.

---

## 🔍 7. Herramientas de Depuración y Diagnóstico (Superadmin)

Para garantizar que no existan inconsistencias en la base de datos:
* El Superadmin dispone del botón **"Depurar Tickets y Órdenes"** en la barra superior.
* La herramienta analiza todos los folios, detecta órdenes con refacciones pendientes que no cuenten con su Ticket-A correspondiente y ofrece la opción de regenerarlos automáticamente en un solo clic.
