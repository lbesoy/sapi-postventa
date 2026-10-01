# Manual de Flujo Completo del Sistema (SAPI Postventa)

Este manual documenta de forma exhaustiva el **ciclo de vida completo end-to-end** de un requerimiento técnico o contrato de renta dentro de la plataforma **SAPI Postventa (Eurorep CRM)**, detallando la interacción coordinada entre el **Cliente**, la **Mesa de Ayuda Comercial**, la **Coordinación Operativa**, los **Técnicos de Campo**, el departamento de **Contabilidad / Nómina** y la integración automatizada con **Supabase**, **Microsoft OneDrive** y **SAP Business One**.

---

## 🔄 1. Mapa General del Flujo de Trabajo End-to-End

El ciclo operativo de SAPI sigue una secuencia estructurada y validada para garantizar la calidad en el servicio, la disponibilidad del parque de maquinaria y la precisión fiscal y contable:

```
[1. Requerimiento / Renta] ➔ [2. Cotización SAP] ➔ [3. Autorización y OC] ➔ [4. Calendario]
                                                                                │
                                                                                ▼
[8. OneDrive & SAP B1] ◄── [7. Control Gastos] ◄── [6. Ejecución Campo] ◄── [5. Carga Offline]
        │
        ▼
[9. Tickets-A de Refacciones de Campo]
```

---

## 📱 2. Las 8 Fases del Ciclo Operativo

---

### Fase 1: Entrada de Requerimiento (Cliente o Mesa de Ayuda)
Todo servicio inicia con la detección de una necesidad operativa por dos vías:
* **Vía A: Ticket de Soporte Técnico**:
  1. El cliente entra a su portal (`cliente.html`) o el coordinador atiende una llamada en la oficina.
  2. Se selecciona la **Maquinaria**, la **Ubicación (Sitio/Obra)** y se captura el **Horómetro Actual**.
  3. Se define la categoría (*Correctivo*, *Preventivo*, *Refacciones*, *Garantía*) y se suben fotos de la falla.
  4. El ticket se guarda con estatus **Reportado**.
* **Vía B: Contrato de Renta de Maquinaria**:
  1. La administración genera el contrato de arrendamiento vinculando el cliente, sitio y equipo disponible.
  2. Se programa la entrega y se emite la hoja de inspección inicial (**Check-in**).

---

### Fase 2: Diagnóstico y Cotización Comercial en SAP B1
Antes de enviar personal a campo (a excepción de diagnósticos de urgencia):
1. El equipo técnico y comercial evalúa las piezas requeridas y tiempos estimados.
2. Se elabora la **Cotización de Venta en SAP Business One**.
3. En la ficha del ticket en SAPI, el administrador vincula el número de cotización sincronizado, captura el monto y sube el PDF comercial oficial.
4. El ticket cambia a estatus **Cotizado** y se envía una notificación al portal del cliente.

---

### Fase 3: Autorización del Cliente, Carga de OC y Generación de Pedido SAP
1. El cliente revisa la cotización y los conceptos desglosados en su portal.
2. Si está de acuerdo, presiona el botón **"Aceptar Cotización"** y el ticket pasa a estatus **En Proceso**.
3. El cliente puede adjuntar de forma inmediata el PDF de su **Orden de Compra interna (OC)** o el comprobante de transferencia bancaria.
4. Con esta aprobación, la administración ingresa a SAP Business One y genera el **Pedido de Venta (Sales Order)** para apartar las refacciones en almacén.
5. El administrador vincula el número de pedido y su PDF en el ticket, avanzando a estatus **Orden de Servicio**.

---

### Fase 4: Programación y Asignación en el Calendario Operativo
1. El coordinador abre el **Calendario Operativo** en SAPI.
2. Selecciona la fecha y asigna a uno o más técnicos de campo.
3. Vincula la **Orden de Servicio (OS)** y el Ticket liberado.
4. El sistema notifica al técnico y coloca el servicio en su agenda móvil personal.

---

### Fase 5: Preparación y Descarga Offline (¡OBLIGATORIO ANTES DE SALIR!)
> [!IMPORTANT]
> **Protocolo de Precarga en Taller**:
> Si el técnico se trasladará a una zona con poca o nula cobertura celular (minas, sótanos, autopistas remotas):
> * **Mientras permanezca en el taller o tenga señal Wi-Fi**, el técnico debe abrir la aplicación en su teléfono y cargar la Orden de Servicio asignada.
> * Esto almacena toda la información del cliente, especificaciones de la máquina y el catálogo completo de refacciones de SAP en la memoria local (IndexedDB) de su dispositivo móvil.

---

### Fase 6: Ejecución Técnica del Servicio en Obra
En el frente de trabajo, el técnico sigue el protocolo obligatorio paso a paso en su aplicación móvil:

1. **Foto de Inicio (Entrada)**: Toma y subida de la evidencia fotográfica del estado del equipo antes de iniciar cualquier maniobra.
2. **Bitácora Diaria y Tiempos de Traslado**: Registro diario de horas de entrada/salida a la obra, horas de traslado de ida y vuelta, y descripción del trabajo ejecutado.
3. **Checklist Técnico de 15 Puntos**: Evaluación visual y funcional de motor, niveles de fluidos, sistema hidráulico, sistema eléctrico, mangueras, fugas, batería y seguridad.
4. **Horómetro Real**: Captura obligatoria de las horas de trabajo acumuladas y foto del marcador físico.
5. **Consumo de Refacciones de SAP**: Búsqueda e incorporación de las piezas instaladas tomadas del inventario oficial.
6. **Evidencias Finales (Foto de Salida)**: Fotografías del trabajo terminado y de componentes reemplazados.
7. **Firmas Digitales de Conformidad**: Captura en pantalla de la firma digital del encargado del cliente y del técnico de servicio. Al guardar, la orden cambia a **Completado**.

---

### Fase 7: Rendición de Gastos de Viaje y Conciliación Clara
Durante o al finalizar el servicio:
1. El técnico captura sus comprobantes de viáticos (gasolina, casetas, alimentos, hotel) en el módulo de **Control de Gastos**.
2. Si utilizó la tarjeta de crédito corporativa **Clara**, localiza la transacción bancaria y presiona **"Comprobar"** adjuntando el ticket o factura electrónica XML/PDF.
3. El administrador utiliza el módulo de **Conciliación de Gastos** para validar las transacciones contra los archivos del SAT y autorizar los reembolsos o integrarlos a la nómina semanal.

---

### Fase 8: Cierre Técnico, Reporte PDF, OneDrive y Sincronización SAP
Al validarse la orden de servicio en campo:
1. **Generación del Reporte Oficial**: El motor del sistema compila automáticamente el **Reporte Técnico de Servicio Eurorep en formato PDF**, integrando logotipos, bitácoras, evidencias fotográficas, refacciones y firmas digitales vectoriales.
2. **Almacenamiento Corporativo en OneDrive**: El archivo PDF se deposita de manera automatizada en el repositorio de **Microsoft OneDrive** bajo la estructura:
   `OneDrive/Eurorep CRM/Clientes/[Nombre del Cliente]/[Folio OS].pdf`
3. **Sincronización con SAP B1**: Las refacciones consumidas se descargan del inventario de SAP y el ticket se marca como **Cerrado** para proceder a su facturación final.
4. **Disponibilidad para el Cliente**: El cliente puede visualizar y descargar su reporte técnico oficial directamente desde su portal.

---

## 🧩 3. Ciclo Post-Servicio: Autogeneración de Tickets-A de Refacciones

Si durante la inspección en campo el técnico detectó piezas con desgaste prematuro y las anotó en la sección de **"Refacciones Necesarias"**:
1. El sistema crea de forma automática un **Ticket-A** (folio `TKT-[OS]-A`) en estatus **Refacciones**.
2. Los equipos quedan protegidos contra desvinculación accidental.
3. El área de ventas cotiza de inmediato estas refacciones en SAP B1 y el ciclo comercial se reinicia de forma proactiva, evitando que la máquina sufra un paro no programado en el futuro.

---

## 👥 4. Matriz de Roles y Responsabilidades

| Rol | Pantallas Clave | Responsabilidades Principales |
| :--- | :--- | :--- |
| **Cliente** | `cliente.html` | Reportar tickets, monitorear rentas, autorizar cotizaciones, subir Órdenes de Compra y descargar reportes PDF. |
| **Coordinador / Admin** | `index.html` (Admin) | Asignar tickets, programar calendario, gestionar rentas, auditar órdenes completadas, conciliar gastos y sincronizar SAP. |
| **Técnico de Campo** | `index.html` (Móvil) | Precargar órdenes offline, tomar foto de inicio, registrar bitácoras, checklist de 15 puntos, horómetro, refacciones, firmas y viáticos. |
| **Superadministrador** | `index.html` (Superadmin) | Auditoría global, gestión de roles y accesos, depurador de inconsistencias de base de datos, sandbox de pruebas y soporte técnico. |
