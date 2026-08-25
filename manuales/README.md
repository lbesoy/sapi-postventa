# Centro de Ayuda SAPI Postventa — Eurorep CRM

¡Bienvenido al Centro de Documentación y Ayuda de **SAPI Postventa (Eurorep CRM)**!

Este espacio está diseñado para que cualquier usuario de la plataforma (ya sea un cliente externo, un técnico de servicio en campo o un administrador de oficina) pueda comprender y operar el sistema de forma completamente autónoma, rápida y sin necesidad de capacitaciones complejas.

---

## 🎯 ¿Cuál es tu rol? Encuentra tu manual

Para facilitar la consulta, hemos dividido la documentación en manuales específicos según la actividad que realizas en la plataforma:

| Rol de Usuario | Tipo de Acceso | Manual Recomendado | ¿Qué aprenderás aquí? |
| :--- | :--- | :--- | :--- |
| **Cliente / Empresa** | Portal Externo (`cliente.html`) | 📘 [Manual del Cliente](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_cliente.md) | Consultar equipos, levantar reportes de falla (tickets), ver cotizaciones de SAP y chatear con soporte. |
| **Técnico de Campo** | App Móvil/PWA (`index.html`) | 📗 [Manual del Técnico](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_tecnico.md) | Registrar horas de viaje y trabajo, redactar bitácoras de servicio, tomar evidencias fotográficas, reportar refacciones y capturar la firma del cliente en el celular. |
| **Administrador / Supervisor** | Panel de Control Web (`index.html`) | 📙 [Manual del Administrador](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_administrador.md) | Asignar tickets a técnicos, coordinar el calendario de campo, auditar reportes, controlar catálogos, generar reportes semanales de nómina y sincronizar con SAP B1. |
| **Todo el Personal (Gastos)** | Módulo de Finanzas | 📕 [Manual de Control de Gastos](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_gastos.md) | Registrar viáticos, subir comprobantes, vincular tarjetas corporativas Clara y realizar la conciliación automatizada. |
| **Equipo de TI / Sistemas** | Código Fuente y Base de Datos | 📓 [Manual Técnico para Desarrolladores](file:///Users/pablobesoytrigueros/Library/CloudStorage/Dropbox/DESARROLLOS/Eurorep/manuales/manual_tecnico_desarrollador.md) | Arquitectura, funcionamiento del script de sincronización con SAP, middleware API, y políticas de seguridad (RLS) en Supabase. |

---

## 💡 Recomendaciones Generales de Uso

Antes de comenzar a navegar en la plataforma, te sugerimos tener en cuenta los siguientes lineamientos técnicos básicos para asegurar una experiencia óptima:

1. **Navegador Recomendado**: Utiliza **Google Chrome** o **Safari** (en dispositivos iOS) actualizados a su última versión. La plataforma aprovecha funciones web avanzadas que podrían no responder correctamente en navegadores obsoletos.
2. **Conexión a Internet**:
   * Si eres administrador o cliente, necesitas una conexión estable a internet (Wi-Fi o datos móviles).
   * Si eres técnico en campo, el sistema cuenta con **Modo Offline** (funciona sin conexión a internet). Podrás capturar toda la información en sitio y el sistema guardará todo localmente para subirlo a la nube automáticamente cuando recuperes señal.
3. **Seguridad y Cuentas**:
   * Tu cuenta está ligada a un rol específico con políticas de seguridad estrictas (Row-Level Security). Esto significa que un técnico solo verá los servicios que tiene asignados, y un cliente solo verá la información de su propia empresa.
   * Nunca compartas tus credenciales de acceso.
