# Manual de la Aplicación Android para Técnicos — SAPI Eurorep

## 📱 Visión General

La aplicación Android de **SAPI Postventa** está diseñada para proporcionar a los técnicos en campo una herramienta de trabajo ágil, confiable y con capacidad **100% Offline**, permitiéndoles documentar servicios, órdenes y gastos incluso en zonas sin cobertura celular (tajos mineros, canteras, carreteras y obras remotas).

---

## 🏗️ Arquitectura y Tecnologías

* **Contenedor Nativo:** [Capacitor](https://capacitorjs.com/) v8 (motor nativo para Android).
* **ID de Paquete (Package Name):** `com.eurorep.sapi`
* **Nombre de la App:** `SAPI Postventa`
* **Directorio de Activos Web:** `dist/` sincronizado hacia `android/app/src/main/assets/public/`.
* **Plugins Nativos Integrados:**
  * `@capacitor/camera`: Captura fotográfica con compresión automática para bitácoras, evidencias y comprobantes.
  * `@capacitor/geolocation`: Coordenadas GPS de alta precisión en frentes de obra.
  * `@capacitor/network`: Monitoreo del estado de red y sincronización en segundo plano con Supabase.
  * `@capacitor/app`: Manejo del botón físico de retroceso ("Atrás") de Android para cerrar modales sin salir de la app.
  * `@capacitor/status-bar`: Integración visual con la paleta de Eurorep (`#12141c` y `#e8820c`).
  * `@capacitor/splash-screen`: Pantalla de carga nativa sin parpadeos.

---

## 📶 Modo 100% Offline en Campo

Para garantizar que la aplicación funcione en zonas remotas sin conexión a internet:
1. **Librerías Locales empaquetadas en el APK:** Las librerías que antes dependían de CDN (`lucide`, `fullcalendar`, `leaflet`, `chart.js`, `pdf.js`, `xlsx`, `supabase.js`) se encuentran empaquetadas localmente en `vendor/` dentro del APK.
2. **Persistencia Local con IndexedDB:** `localstorage-bridge.js` almacena órdenes, catálogos y bitácoras en almacenamiento permanente del dispositivo.
3. **Auto-Reconexión:** Al recuperar señal 4G/WiFi, el listener de red de Capacitor activa `sincronizarPendientesSupabase()` automáticamente.

---

## 🛠️ Comandos de Desarrollo y Compilación

| Comando | Función |
| :--- | :--- |
| `npm run build:mobile` | Compila plantillas HTML, reemplaza CDNs por librerías locales y empaqueta en `dist/`. |
| `npm run cap:sync` | Ejecuta `build:mobile` y transfiere los activos actualizados al proyecto nativo Android (`android/`). |
| `npm run cap:open` | Abre el proyecto en **Android Studio** para compilar, generar el APK o depurar en dispositivo. |
| `npm run cap:copy` | Copia rápidamente cambios web hacia Android sin re-sincronizar plugins. |

---

## 📲 Pasos para Generar el APK o Ejecutar en Teléfono

### Opción 1: Desde Android Studio (Recomendado)

1. Abre el proyecto Android:
   ```bash
   npm run cap:open
   ```
2. Conecta tu teléfono Android mediante cable USB (con la opción **Depuración por USB** activada en Opciones de Desarrollador).
3. En la barra superior de Android Studio, selecciona tu dispositivo.
4. Presiona el botón verde **Run** (▶) o `Shift + F10`. La app se instalará automáticamente en tu teléfono.
5. Para generar el archivo instalable **`.apk`**:
   * En el menú superior de Android Studio ve a: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   * Al finalizar, haz clic en **locate** para obtener el archivo `app-debug.apk` y enviarlo a los técnicos por WhatsApp o correo.

### Opción 2: Compilación directa por línea de comandos (Gradle)

Si tienes configurado Java y Android SDK en tu terminal:
```bash
cd android
./gradlew assembleDebug
```
El APK se generará en:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📋 Permisos Configurados en AndroidManifest.xml

* `android.permission.INTERNET`: Acceso a base de datos Supabase y sincronización SAP.
* `android.permission.ACCESS_NETWORK_STATE`: Detección en tiempo real de conexión online/offline.
* `android.permission.CAMERA`: Captura de fotos para bitácoras, órdenes y gastos con compresión automática.
* `android.permission.READ_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES`: Selección de fotos de galería.
* `android.permission.ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`: Geolocalización GPS en obras.
* `android.permission.POST_NOTIFICATIONS`: Alertas y avisos nativos en Android 13+.
* `android.permission.VIBRATE`: Retroalimentación háptica en sincronización y alertas.

---

## 🔔 Configuración de Notificaciones Push (Firebase Cloud Messaging - FCM)

La aplicación cuenta con el listener nativo de notificaciones push preparado en `capacitor-bridge.js`. Para activar el envío de alertas cuando se asigne una orden al técnico:

1. Ve a la consola de [Firebase Console](https://console.firebase.google.com/).
2. Crea o selecciona el proyecto de Eurorep.
3. Agrega una app Android con el package name `com.eurorep.sapi`.
4. Descarga el archivo de configuración **`google-services.json`**.
5. Coloca el archivo directamente en:
   ```text
   android/app/google-services.json
   ```
6. Al recompilar en Android Studio, Gradle detectará automáticamente el archivo y habilitará el servicio Google Play Services / FCM. Los tokens se registrarán automáticamente en el perfil del usuario.

---

## 🔄 Gesto Táctil "Deslizar para Actualizar" (Pull-to-Refresh)

En cualquier momento, el técnico puede deslizar con el dedo hacia abajo desde la parte superior de la pantalla en las vistas principales (**Órdenes**, **Levantamientos**, **Envíos**, **Gastos** o **Calendario**):
1. Aparecerá la píldora animada `[ Desliza para actualizar... ]`.
2. Al soltar (`Suelta para actualizar`), la app vibra levemente y ejecuta `sincronizarPendientesSupabase()` y descarga los datos frescos de Supabase.
3. Notifica con un check visual verde `¡Datos actualizados!`.

