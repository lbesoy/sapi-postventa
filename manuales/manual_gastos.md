# Manual de Uso: Control de Gastos, Viáticos e Integración Clara (SAPI Postventa)

Esta guía te guiará paso a paso en el uso del módulo de **Control de Gastos y Viáticos** de **SAPI Postventa**, desde la captura móvil de tickets en campo por parte de los técnicos, la vinculación y comprobación de tarjetas corporativas **Clara**, la lectura automática de facturas electrónicas XML/PDF del SAT, hasta la conciliación y auditoría financiera por parte de la administración.

---

## 🎯 1. Propósito del Módulo de Control de Gastos

El módulo de finanzas y viáticos de SAPI Postventa tiene como objetivo:
* Permitir a los técnicos de campo comprobar sus gastos de viaje de forma inmediata desde su celular sin esperar a regresar a la oficina.
* Eliminar la captura manual de datos fiscales mediante un extractor inteligente de facturas XML y PDF.
* Descargar y conciliar en tiempo real los cargos efectuados con las tarjetas de crédito corporativas **Clara**.
* Generar reportes contables auditados para el reembolso de viáticos y control de nómina semanal.

---

## 💵 2. Registro Manual de Gastos de Viaje (Técnicos)

Si realizaste un gasto en efectivo o con recursos propios durante una orden de servicio (gasolina, casetas, alimentos, hospedaje o refacciones de emergencia):

1. Ve a la sección **"Control de Gastos"** en el menú lateral.
2. Haz clic en el botón **"Registrar Gasto"**.
3. Completa los campos solicitados:
   * **Fecha del Gasto**: Día exacto de la compra.
   * **Concepto**: Breve descripción del consumo (ej. *"Combustible para camioneta de servicio en traslado a Mina Guanajuato"*).
   * **Categoría**: Selecciona entre:
     * *Gasolina / Combustible*
     * *Casetas de Peaje*
     * *Alimentos / Viáticos*
     * *Hospedaje / Hotel*
     * *Materiales / Herramientas Menores*
     * *Otros Gastos Operativos*
   * **Monto Total**: Importe numérico exacto con centavos.
   * **Moneda**: MXN (Pesos Mexicanos) o USD (Dólares).
   * **Evidencia Fotográfica**: Toma una fotografía nítida del ticket físico de compra o nota de remisión.
4. Haz clic en **"Guardar Gasto"**.
5. > [!NOTE]
   > El gasto quedará registrado con estatus **"Pendiente de Aprobación"** en tu lista personal hasta que sea auditado por el área administrativa.

---

## 💳 3. Integración con Tarjetas Corporativas Clara

Si Eurorep te ha asignado una tarjeta de crédito corporativa **Clara** (física o virtual), puedes vincularla para comprobar tus compras de forma directa:

### 3.1 Vincular tu Tarjeta Clara (Configuración única):
1. En el módulo de gastos, ingresa a la pestaña **"Mis Tarjetas Clara"**.
2. Haz clic en **"Vincular Tarjeta"**.
3. Captura los **últimos 4 dígitos** de la tarjeta y asigna un **Alias** identificador (ej. *"Tarjeta Campo - [Tu Nombre]"*).
4. Presiona **"Vincular"**. A partir de este momento, los cargos de dicha tarjeta se sincronizarán con tu cuenta.

### 3.2 Comprobar un Cargo de Tarjeta Clara:
1. Dirígete a la pestaña **"Transacciones Clara"**.
2. Verás el listado de cargos bancarios descargados en tiempo real (comercio, fecha y monto).
3. Localiza el cargo que deseas comprobar y presiona el botón **"Comprobar"**.
4. Sube la foto del ticket o, preferentemente, selecciona la factura electrónica XML/PDF previamente cargada.
5. Al guardar, el cargo cambiará a estatus **Comprobada** y estará listo para la conciliación contable.

---

## 📄 4. Extractor Inteligente de Facturas Electrónicas (CFDI XML y PDF)

Para agilizar la comprobación fiscal y evitar errores de dedo, el sistema cuenta con un motor de lectura automática de comprobantes digitales del SAT:

1. Ve a la pestaña **"Subir Facturas"**.
2. Arrastra o selecciona tus archivos de factura (**formatos .XML y .PDF**). Puedes cargar múltiples archivos de forma simultánea.
3. Haz clic en **"Procesar Facturas"**.
4. El motor analizará la estructura fiscal y extraerá automáticamente:
   * **Razón Social del Emisor (Proveedor)**.
   * **RFC del Emisor**.
   * **Fecha y Hora de Emisión**.
   * **Subtotal, Desglose de Impuestos (IVA, IEPS, Retenciones) y Monto Total**.
   * **Folio Fiscal Digital (UUID de 36 caracteres)**.
5. El sistema mostrará una tabla de previsualización con los datos extraídos. Verifica que todo sea correcto y presiona **"Guardar Facturas"**. Las facturas quedarán almacenadas en el inventario digital listas para ser enlazadas a los gastos.

---

## 🔄 5. Módulo de Conciliación de Gastos (Administración y Finanzas)

La conciliación es el proceso mediante el cual la oficina de administración audita y enlaza los cargos bancarios con sus facturas fiscales oficiales correspondientes:

1. Inicia sesión con perfil `admin`, `supervisor` o `superadmin` y entra a **"Control de Gastos"**.
2. Abre la pestaña **"Conciliación de Gastos"**.
3. La interfaz se divide en dos paneles interactivos:
   * **Panel Izquierdo (Transacciones y Gastos Reportados)**: Lista de cargos de tarjetas Clara y viáticos manuales en espera de auditoría.
   * **Panel Derecho (Facturas SAT Disponibles)**: Inventario de facturas XML/PDF procesadas por los técnicos.

### Auto-Conciliación Inteligente:
* El sistema ejecuta un algoritmo de coincidencia que analiza automáticamente montos idénticos, fechas cercanas (±3 días) y RFC del emisor.
* Si el sistema detecta una coincidencia certera, la resaltará con un borde **verde brillante** y mostrará el botón **"Aceptar Sugerencia de Conciliación"**.
* Al hacer clic, la transacción bancaria y la factura fiscal quedan automáticamente asociadas y validadas.

### Conciliación Manual:
* Si no hubo coincidencia automática (por ejemplo, propinas adicionales no facturadas o compras combinadas):
  1. Selecciona la transacción en la columna izquierda.
  2. Selecciona la factura fiscal correspondiente en la columna derecha.
  3. Presiona el botón **"Conciliar Registros Seleccionados"**.

---

## 📊 6. Ciclo de Estatus del Gasto y Reportes de Nómina

Cada gasto reportado transita por los siguientes estados:

```
[Pendiente / Reportado] ➔ [Comprobado] ➔ [Conciliado] ➔ [Aprobado]
```

* **Pendiente**: Registrado en campo sin comprobante adjunto.
* **Comprobado**: Cuenta con ticket fotográfico o factura preliminar.
* **Conciliado**: Enlazado con su comprobante fiscal CFDI (XML) validado en SAT.
* **Aprobado**: Validado por el administrador para su inclusión en la nómina semanal o reembolso.
* **Rechazado**: Si el comprobante es ilegible, no deducible o no corresponde a la operación (se envía notificación al técnico con el motivo).

### Exportación a Contabilidad:
* En cualquier momento, el administrador puede aplicar filtros por **Técnico**, **Rango de Fechas** o **Periodo de Nómina Semanal** y presionar **"Exportar a Excel / CSV"** para enviar la relación de gastos al departamento contable de Eurorep.
