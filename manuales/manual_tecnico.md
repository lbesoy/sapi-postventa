# Manual de Uso: Técnico de Campo y Taller (SAPI Postventa)

Esta guía te explicará detalladamente cómo utilizar la plataforma **SAPI Postventa** en tu dispositivo móvil o tableta durante tus servicios de campo, inspecciones de renta y diagnósticos en taller, incluso cuando trabajes en zonas remotas, minas o sótanos **sin conexión a internet**.

---

## 📱 1. Acceso e Instalación de la Aplicación en tu Celular (PWA)

La plataforma está diseñada como una Aplicación Web Progresiva (PWA) optimizada para dispositivos móviles:

1. Abre el navegador web en tu celular (Google Chrome en Android o Safari en iPhone/iPad).
2. Ingresa a la dirección del portal provista por tu supervisor.
3. Inicia sesión con tu correo institucional y contraseña.
4. > [!TIP]
   > **Instálala como aplicación nativa en tu pantalla de inicio**:
   > * **En Android (Chrome)**: Toca el menú de tres puntos (arriba a la derecha) y presiona **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
   > * **En iOS / iPhone (Safari)**: Toca el botón de Compartir (icono cuadrado con flecha hacia arriba) y selecciona **"Agregar al inicio"**.
   > De esta manera tendrás un acceso directo en tu celular que abrirá a pantalla completa y almacenará datos de forma ultrarrápida.

---

## 📶 2. Preparación Obligatoria Offline (¡Antes de Salir al Servicio!)

> [!IMPORTANT]
> **PROTOCOLO DE PRECARGA EN TALLER**:
> Si vas a viajar a una obra, mina, sótano o carretera donde la cobertura celular sea nula o inestable:
> 1. **Mientras sigues en el taller o tengas conexión Wi-Fi/4G estable**, abre la aplicación en tu celular.
> 2. Entra a la sección **"Órdenes de Servicio"** y abre cada una de las órdenes que tengas asignadas para tu jornada o viaje.
> 3. Al abrir la orden con señal, el sistema descarga automáticamente a la base de datos interna de tu teléfono (IndexedDB / LocalStorage) los datos del cliente, la máquina, el historial de fallas y el catálogo completo de refacciones de SAP.
> 4. **Si no precargas la orden con internet antes de salir**: Al llegar a la obra sin señal no podrás abrir el formato de servicio ni registrar tu reporte técnico.

---

## 📅 3. Mi Agenda (Calendario de Actividades)

En la sección **"Calendario"** verás tus actividades y servicios organizados:
* **Servicios de Campo (Órdenes)**: Días y horas estimadas de tus mantenimientos. Al tocar el evento podrás ver la dirección de la obra y el contacto del cliente.
* **Inspecciones (Levantamientos y Rentas)**: Revisiones técnicas o entregas de maquinaria.
* **Eventos Administrativos**: Juntas de equipo, capacitaciones, descansos y periodos de vacaciones programados.

---

## 🛠️ 4. Flujo Operativo de la Orden de Servicio en Campo (Paso a Paso)

El flujo de trabajo técnico es obligatorio y debe completarse con precisión para garantizar la validez del reporte:

```
[Foto de Entrada] ➔ [Bitácora Diaria] ➔ [Checklist 15 Puntos] ➔ [Horómetro] ➔ [Refacciones SAP] ➔ [Foto de Salida] ➔ [Firmas]
```

---

### Paso 4.1: ¡Lo Primero al Llegar! Evidencia Inicial (Foto de Entrada)
> [!IMPORTANT]
> **Antes de tocar la máquina, desarmar componentes o iniciar cualquier maniobra**:
> 1. Abre el detalle de la **Orden de Servicio** en tu celular.
> 2. Desplázate a la sección **"Evidencias Fotográficas"**.
> 3. Toca en la tarjeta **"Foto de Inicio (Entrada)"** y haz clic en **"Cargar Foto"**.
> 4. Toma la fotografía que muestre el estado general y físico en que recibes el equipo en obra.

---

### Paso 4.2: Registro de Bitácora Diaria y Tiempos de Traslado
Al terminar la jornada de cada día (incluso si el servicio dura varios días y aún no se concluye):
1. En la orden, ve a la sección **"Bitácora Diaria"** y toca **"Registrar Avance Diario"**.
2. Completa los campos:
   * **Resumen del Avance**: Describe detalladamente las maniobras efectuadas en el día (ej. *"Se desmontó bomba principal, se limpiaron líneas y se cambiaron sellos desgastados"*).
   * **Hora de Entrada / Salida**: Hora exacta de inicio y fin de labores en el sitio.
   * **Horas de Traslado (Ida y Vuelta)**: Horas invertidas en el traslado hacia y desde la obra.
3. Guarda la nota. La información se sumará automáticamente a tu reporte semanal de horas laboradas.

---

### Paso 4.3: Checklist Técnico de 15 Puntos de Inspección
Durante el servicio debes realizar la inspección técnica preventiva de 15 puntos clave del equipo:
1. **Nivel de Aceite de Motor**.
2. **Nivel de Líquido Refrigerante / Anticongelante**.
3. **Nivel de Aceite Hidráulico**.
4. **Filtros de Aire (Primario y Secundario)**.
5. **Filtros de Combustible y Trampa de Agua**.
6. **Estado de Mangueras y Conexiones Hidráulicas**.
7. **Detección de Fugas Visibles de Fluidos**.
8. **Estado y Carga de la Batería / Bornes**.
9. **Sistema Eléctrico y Luces de Trabajo**.
10. **Presión y Desgaste de Neumáticos / Orugas**.
11. **Mandos, Palancas y Joysticks de Control**.
12. **Sistemas de Seguridad y Paro de Emergencia**.
13. **Estructura, Chasis y Pasadores de Articulación**.
14. **Engrase General de Puntos de Pivote**.
15. **Limpieza General del Compartimento de Motor**.

Marca el estado de cada punto (*Correcto*, *Atención Requerida*, *No Aplica*) e incluye comentarios si detectas anomalías.

---

### Paso 4.4: Horómetro Real y Ciclos de Mantenimiento Preventivo
1. **Lectura del Horómetro Físico**: Captura el número exacto de horas acumuladas que marca el contador del horómetro de la máquina.
2. **Foto de Respaldo**: Sube una foto nítida del display o reloj del horómetro.
3. **Cálculo de Ciclos**: El sistema registrará el horómetro para programar automáticamente las alertas de los ciclos de mantenimiento preventivo subsecuentes (250h, 500h, 1000h, 2000h).

---

### Paso 4.5: Consumo de Refacciones y Solicitud de Piezas Faltantes

#### A. Refacciones Utilizadas (Consumidas en sitio):
1. En la sección **"Refacciones Utilizadas"**, presiona **"+ Agregar Refacción"**.
2. Utiliza el buscador en tiempo real para localizar la pieza por código o descripción en el catálogo oficial de SAP.
3. Ingresa la **Cantidad** instalada y confirma. Estas piezas se descontarán automáticamente del inventario.

#### B. Refacciones Necesarias (Piezas Faltantes para Futura Reparación):
* Si durante la inspección detectas que la máquina requiere piezas adicionales que no llevabas en tu unidad móvil, agrégalas en **"Refacciones Necesarias"**.
* > [!NOTE]
  > Al registrar refacciones necesarias, el sistema generará automáticamente un **Ticket-A de Refacciones** para que el área de administración y ventas cotice las piezas al cliente y programe una segunda visita.

---

### Paso 4.6: Evidencias Fotográficas Finales (Foto de Salida)
1. Ve a **"Evidencias Fotográficas"**.
2. En la tarjeta **"Foto de Fin (Salida)"**, sube la fotografía del equipo reparado, limpio y listo para operar.
3. Agrega fotos adicionales de los componentes reemplazados o piezas dañadas en **"Fotos Adicionales"**.

---

### Paso 4.7: Firmas Digitales de Conformidad y Cierre
Una vez completados todos los apartados anteriores:
1. Dirígete a la sección **"Firmas de Conformidad"**.
2. Escribe el **Nombre Completo** y **Cargo / Puesto** del encargado del cliente en obra.
3. Pídele que dibuje su firma de aceptación con el dedo sobre el recuadro blanco de la pantalla.
4. Escribe tu nombre de técnico y plasma tu propia firma digital en el recuadro correspondiente.
5. Haz clic en **"Finalizar y Cerrar Orden"**. El estatus pasará a **Completado**.

---

## 📑 5. Levantamientos Técnicos e Inspección de Rentas (Check-in / Check-out)

Si acudes a una obra a entregar o recibir una máquina en renta:
* **Check-in (Entrega)**: Llena la hoja de inspección, anota el horómetro y combustible de inicio, toma las fotografías perimetrales y recaba la firma de recepción del cliente.
* **Check-out (Devolución)**: Realiza la revisión final, captura el horómetro de entrega, registra posibles daños o componentes faltantes y recaba la firma de entrega.

---

## 💵 6. Control de Gastos y Viáticos en Campo

Para registrar tus consumos durante el viaje de servicio:
1. Entra a la sección **"Control de Gastos"**.
2. Toca en **"Registrar Gasto"**.
3. Captura la fecha, concepto (*Gasolina*, *Casetas*, *Comidas*, *Hotel*), monto exacto y toma una foto clara del ticket de compra.
4. Si cuentas con factura electrónica (archivos XML o PDF), puedes subirlos directamente desde tu celular en la pestaña **"Subir Facturas"**.
5. Si utilizas la tarjeta corporativa **Clara**, entra a **"Transacciones Clara"**, busca el cargo y presiona **"Comprobar"** adjuntando el ticket o factura.

---

## 🔄 7. Indicadores Visuales y Sincronización Fuera de Línea

Cuando trabajes sin señal de internet:
* **Nube Amarilla Tachada (`cloud-off`)**: Indica que tus bitácoras, fotos, firmas o refacciones están guardadas de forma 100% segura en la memoria local de tu teléfono, pero pendientes de subirse al servidor.
* **Nube Verde (`cloud-check`)**: Indica que todos tus datos ya fueron transferidos con éxito a la nube de Supabase.
* **Forzar Sincronización Manual**:
  1. Al regresar a una zona con señal o Wi-Fi, toca el **icono de conexión** en la barra superior.
  2. Se abrirá la ventana **"Cambios Pendientes de Sincronizar"**.
  3. Presiona el botón **"Intentar Sincronizar Ahora"**.
  4. La lista se procesará y quedará vacía con el estatus en color verde.
* > [!CAUTION]
  > **Nunca borres el historial ni los datos del navegador de tu teléfono** si tienes cambios pendientes con la nube amarilla, para evitar la pérdida accidental de evidencias no sincronizadas.
