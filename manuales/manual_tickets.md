# Manual de Gestión: Ciclo de Vida y Etapas de Tickets

Esta guía describe el funcionamiento detallado del sistema de **Tickets de Soporte** en la plataforma de Eurorep (SAPI Postventa), explicando cómo se originan (cómo salen), sus etapas (estatus), y los detonantes que los guían hacia el cierre del servicio técnico.

---

## 🎯 ¿Qué es un Ticket en SAPI?

Un ticket es el punto de inicio de cualquier solicitud de asistencia técnica en Eurorep. Actúa como el canal central de comunicación y trazabilidad que une al **Cliente**, al **Administrador / Coordinador** y al **Técnico de Campo**.

El ticket agrupa toda la información de una incidencia: datos de la máquina, horómetro de la avería, ubicación geográfica del fallo, cotizaciones comerciales asociadas en SAP, órdenes de servicio generadas y la conversación histórica entre el cliente y el personal de soporte.

---

## 🔌 Origen del Ticket: ¿Cómo se crean ("cómo salen")?

Los tickets de servicio pueden generarse por dos vías independientes dentro del sistema:

### 1. Creación Autónoma por el Cliente (Portal de Clientes)
El cliente detecta un fallo o requiere mantenimiento y genera la solicitud ingresando a su portal (`cliente.html`):
* Va a la pestaña **Tickets** y presiona **Nueva Solicitud**.
* Selecciona la **Ubicación (Sitio)** y la **Maquinaria** de su catálogo de equipos enlazados.
* > [!NOTE]
  > Si la máquina seleccionada está registrada, el sistema le pedirá capturar el **Horómetro Actual** físico de la máquina. Esto es crítico para calcular los ciclos de mantenimiento preventivo automáticos.
* Captura la **Categoría** (*Correctivo*, *Preventivo*, *Refacciones* u *Otros*), la **Prioridad** (*Baja*, *Media*, *Alta*), un **Asunto Breve** y una **Descripción Detallada** del fallo.
* Adjunta una fotografía como evidencia directa del problema (opcional).

### 2. Creación por Administración (Portal del Administrador)
Si el cliente reporta el problema de forma externa (por teléfono, correo de postventa o WhatsApp), el administrador lo registra manualmente en el Panel de Control (`index.html`):
* Selecciona **Tickets** y hace clic en **Registrar Ticket**.
* Asocia el cliente, equipo, ubicación y captura la descripción y evidencias reportadas.

---

## 🔄 El Ciclo de Vida y las 6 Etapas (Estatus) del Ticket

Una vez creado, el ticket avanza por un flujo estructurado de **6 etapas**. Cada etapa representa el estado actual de la solicitud y define quién es el responsable de realizar la siguiente acción:

```
[Reportado] ➔ [En Curso] ➔ [Cotizado] ➔ [En Proceso] ➔ [Orden de Servicio] ➔ [Cerrado]
```

### 1. Reportado (o Abierto)
* **¿Qué significa?** El ticket ha sido registrado en Supabase y está en fila de espera. No cuenta con técnicos asignados, cotizaciones vinculadas ni órdenes de servicio activas.
* **Detonante:** Creación del ticket (por cliente o administración).
* **Rol Responsable:** Administrador (debe revisar el fallo, validar que no sea duplicado y decidir la asignación).

### 2. En Curso (Asignado)
* **¿Qué significa?** Se ha asignado un técnico de campo responsable de atender el reporte.
* **Detonante:** El administrador selecciona un nombre en la lista **"Asignado A"** dentro del detalle del ticket en su panel.
* **Rol Responsable:** Técnico de Campo (debe coordinarse con la obra para realizar la visita y el diagnóstico preliminar en sitio).

### 3. Cotizado
* **¿Qué significa?** El área comercial o de refacciones de Eurorep ha elaborado una cotización en SAP Business One por los trabajos o refacciones necesarias, y la ha vinculado al ticket.
* **Detonante:** El administrador selecciona la **Cotización SAP** desde el listado sincronizado del ticket, ingresa el monto en pesos y sube el PDF de la cotización.
* **Rol Responsable:** Cliente (debe revisar la propuesta comercial y el PDF desde su portal).

### 4. En Proceso (Aprobado)
* **¿Qué significa?** El cliente ha revisado la cotización asociada y la ha autorizado de forma oficial en la plataforma.
* **Detonante:** El cliente presiona el botón **Aceptar Cotización** en su portal de tickets.
* **Rol Responsable:** Administrador (debe validar la aprobación e ingresar a SAP Business One para generar el **Pedido de Venta** u Orden de Compra formal para liberar las refacciones en almacén).
* > [!WARNING]
  > Si el cliente presiona **Rechazar Cotización**, el ticket no pasará a *En Proceso*. El cliente deberá escribir obligatoriamente un motivo de rechazo y el ticket volverá a bandeja administrativa en espera de una re-cotización.

### 5. Orden de Servicio (Pedido / En Servicio)
* **¿Qué significa?** Se ha formalizado el pedido en SAP y el servicio de campo está en fase de ejecución técnica o programación en el calendario.
* **Detonante:** El administrador vincula el número de **Pedido SAP** en el ticket, sube el PDF del pedido y programa una **Orden de Servicio (OS)** en el Calendario asignando fechas y técnicos en campo.
* **Rol Responsable:** Técnico de Campo (debe acudir a la obra, registrar bitácoras, evidencias fotográficas, refacciones usadas en campo y recabar la firma digital del cliente).

### 6. Cerrado
* **¿Qué significa?** El servicio técnico ha finalizado por completo, las refacciones fueron descargadas de inventario y el reporte técnico ha sido guardado.
* **Detonante:** Todas las órdenes de servicio asociadas al ticket han sido firmadas de conformidad y marcadas como **Completadas**. El administrador cambia el estatus del ticket a **Cerrado**.
* **Resultado:** El sistema genera el **Reporte Técnico PDF definitivo**, lo almacena automáticamente en la carpeta de **Microsoft OneDrive** del cliente y actualiza el estatus final en SAP Business One.

---

## 📉 Resumen de Transiciones de Estatus (Gatillos)

| Estatus Inicial | Estatus Destino | Acción / Detonante Requerido | Rol Responsable |
| :--- | :--- | :--- | :--- |
| **-** | **Reportado** | Crear ticket en portal de clientes o administrador | Cliente / Oficina |
| **Reportado** | **En Curso** | Asignar un técnico de campo en la ficha del ticket | Administrador |
| **En Curso** | **Cotizado** | Vincular Cotización SAP, monto y PDF en el ticket | Administrador |
| **Cotizado** | **En Proceso** | El cliente presiona "Aceptar Cotización" en su portal | Cliente |
| **En Proceso** | **Orden de Servicio** | Vincular Pedido SAP y generar la asignación en el calendario | Administrador |
| **Orden de Servicio** | **Cerrado** | Finalizar órdenes de servicio con firma digital y cerrar ticket | Técnico / Admin |

---

## 🎫 4. Tickets de Refacciones de Campo ("Tickets-A")

Los **Tickets-A** son un tipo especial de ticket autogenerado por el sistema. Nacen de la necesidad de dar seguimiento comercial y logístico a las **refacciones adicionales** que un técnico detecta que hacen falta durante una visita de campo.

### ¿Cómo se originan?
1. Durante la ejecución de un servicio en la obra (Fase 5), el técnico inspecciona la máquina y determina que se requieren refacciones complementarias (que no se tenían presupuestadas o que se necesitarán para una futura reparación).
2. El técnico registra estas refacciones en la sección de **"Refacciones Necesarias"** de su Orden de Servicio (OS) móvil.
3. Al guardarse y sincronizarse la orden, el sistema corre un proceso automático de escaneo en segundo plano (`generarTicketsRefaccionesFaltantes`).
4. Si el sistema encuentra una orden con refacciones solicitadas en campo y detecta que aún no hay un ticket de seguimiento comercial para ellas, **crea el ticket de forma automática**.

### Características y Reglas Especiales de los Tickets-A:
* **Nomenclatura (Sufijo `-A`):** El folio de estos tickets se genera automáticamente a partir del folio de la orden de servicio de origen, agregando el prefijo `TKT-` y el sufijo `-A` (ejemplo: `TKT-26045-A` para la orden `26045`).
* **Asunto Automatizado:** Se titula siempre bajo el formato: `Refacciones para [Folio de la OS]`.
* **Estado Inicial Directo:** A diferencia de los tickets normales que inician en *Reportado*, los Tickets-A inician directamente en el estatus **Refacciones**, con las piezas mapeadas como "Por Pedir".
* **Bloqueo de Modificación de Equipos:** Dado que este ticket proviene de un diagnóstico técnico de campo sobre máquinas específicas previamente validadas por el técnico en su orden, el sistema **no permite remover o eliminar las máquinas asociadas** en la interfaz administrativa (el botón de borrado `&times;` de los chips de máquina se bloquea automáticamente).

### ¿Qué se hace con un Ticket-A después de que se genera?
Una vez creado el Ticket-A, el administrador continúa con el flujo estándar de procesamiento de postventa:
1. Cotiza las refacciones en SAP Business One.
2. Sube y vincula la cotización al ticket (pasa a estatus **Cotizado**).
3. El cliente la aprueba desde su portal (pasa a estatus **En Proceso**).
4. El administrador vincula el pedido SAP (pasa a estatus **Orden de Servicio**).
5. Se programa una nueva asignación en el calendario para que el técnico acuda a instalar las refacciones solicitadas.

---

## 💬 Chat del Ticket: Externo vs. Notas Internas (Staff)

El ticket sirve también como el diario de comunicación del servicio. Para evitar filtraciones de información logística o comentarios técnicos preliminares, el chat está dividido en dos pestañas con permisos estrictos:

### 1. Comentarios de Seguimiento (Chat Externo)
* **Visibilidad:** Visible tanto para el Cliente como para todo el Staff de Eurorep.
* **Propósito:** Compartir actualizaciones directas (ej. *"Ya vamos en camino a la mina"*, *"¿Nos pueden confirmar si ya hay acceso al sitio?"*) y responder dudas sobre la cotización.

### 2. Notas Internas (Chat Privado de Staff)
* **Visibilidad:** Oculto para el cliente. Solo visible para Administradores, Supervisores y Técnicos de Eurorep.
* **Propósito:** Coordinación interna del staff (ej. *"El equipo se retrasará porque el técnico está en mina sin señal"*, *"Revisar si esta refacción entra por garantía o cargo al cliente"*).
* > [!IMPORTANT]
  > Los comentarios en esta sección están protegidos a nivel de base de datos en Supabase mediante políticas RLS, asegurando que un cliente nunca pueda descargarlos interceptando las consultas de la API.
