# SAPI — Sistema Integral de Postventa (Eurorep)

[![CI Tests & Quality](https://github.com/lbesoy/sapi-postventa/actions/workflows/ci.yml/badge.svg)](https://github.com/lbesoy/sapi-postventa/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-2.0.0-orange.svg)](CHANGELOG.md)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg)](package.json)

**SAPI** es la plataforma empresarial de gestión de postventa, servicio técnico en campo, control de refacciones, maquinaria pesada y seguimiento operativo desarrollada para **Eurorep México**.

---

## 🌟 Características Principales

* **Gestión Integral de Tickets:** Recepción, categorización, asignación y seguimiento de tickets de servicio con control de estados y soporte drag & drop de cotizaciones/pedidos en PDF.
* **Órdenes de Servicio en Campo:** Levantamiento de evidencias fotográficas, bitácora de avances, captura de firmas digitales y reporte técnico móvil.
* **Dashboard Ejecutivo y KPIs Reactivos:** Métricas en tiempo real de tickets abiertos, refacciones requeridas, cotizaciones pendientes, aceptadas y rechazadas.
* **Sincronización Ultrarrápida con Supabase:** Arquitectura de doble canal paralelo (`Promise.all`) que descarga catálogos e historiales masivos en ~1.3 segundos sin saturar PostgreSQL.
* **Integración con SAP Business One:** Sincronización bidireccional de clientes, maquinaria, refacciones y sitios de obra vía SAP Service Layer.
* **Auditoría y Telemetría SuperAdmin:** Registro granular en tiempo real de operaciones críticas (creaciones, ediciones y eliminaciones de folios con quién, cuándo y motivo).
* **Arquitectura Offline-First:** Almacenamiento local puenteado con IndexedDB (`localstorage-bridge.js`) para trabajo ininterrumpido en campo sin conexión a internet.

---

## 🛠️ Stack Tecnológico

* **Frontend:** JavaScript Vanilla Modular (ES Modules + IIFE shims), HTML5 semántico modularizado (`src/html/`) y Tailwind/CSS custom.
* **Bundler & Dev Server:** [Vite](https://vitejs.dev/) v8 para recarga ultrarrápida en desarrollo.
* **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL 15 + PostgREST + Row Level Security).
* **Integración ERP:** SAP Business One Service Layer (Node.js backend + Axios).
* **Integración Continua:** GitHub Actions (`.github/workflows/ci.yml`) con verificación preventiva de integridad y 56 suites de pruebas automatizadas.
* **Hosting / Despliegue:** [Vercel](https://vercel.com/) con compilación automática de plantillas HTML.

---

## 🚀 Inicio Rápido (Entorno Local)

### 1. Requisitos Previos
* [Node.js](https://nodejs.org/) v22.x o superior.
* `npm` v10.x o superior.

### 2. Instalación

```bash
# 1. Clonar el repositorio
git clone git@github.com:lbesoy/sapi-postventa.git
cd sapi-postventa

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con las credenciales correspondientes de Supabase y SAP

# 3. Instalar dependencias
npm install
```

### 3. Ejecución en Desarrollo

```bash
# Iniciar servidor de desarrollo en el puerto 3005
npm run dev:3005
```

Abre tu navegador en: **`http://localhost:3005`**

---

## 📜 Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev:3005` | Inicia el servidor de desarrollo Vite en el puerto `3005`. |
| `npm run build:html` | Compila las vistas y modales de `src/html/` hacia el `index.html` raíz. |
| `npm run watch:html` | Observa cambios en `src/html/` y recompila `index.html` automáticamente. |
| `npm run check` | Ejecuta la **Auditoría Preventiva SAPI** (sincronización HTML, activos en Git y sintaxis JS). |
| `npm test` | Corre las **56 suites de pruebas** unitarias y de integración del sistema. |
| `npm run build:mobile` | Compila y empaqueta la versión móvil offline (reemplaza CDNs por librerías locales). |
| `npm run cap:sync` | Sincroniza los activos web compilados (`dist/`) hacia el proyecto nativo Android. |
| `npm run cap:open` | Abre el proyecto Android nativo en Android Studio para depurar o generar el APK. |

---

## 📁 Estructura del Proyecto

```text
├── .github/                # Flujos de CI y automatizaciones de GitHub Actions
│   └── workflows/
│       ├── ci.yml          # Pipeline de validación de pruebas en push/PR
│       └── sync-sap.yml    # Sincronizador periódico SAP -> Supabase
├── src/                    # Código fuente modular
│   ├── html/               # Plantillas modulares (app_shell, views/, modals/)
│   ├── modules/            # Módulos ES de lógica de negocio
│   ├── storage/            # Bridge a IndexedDB
│   └── types/              # Definiciones JSDoc y modelos de negocio
├── scripts/                # Scripts de compilación, verificación y pruebas
│   ├── build-html.mjs      # Compilador de plantillas HTML
│   ├── verify-assets.js    # Auditoría preventiva de integridad
│   └── test-utils.mjs      # Suite de pruebas unitarias/integración
├── index.html              # Shell compilado de la aplicación
├── supabaseSync.js         # Motor de sincronización en segundo plano
├── vercel.json             # Configuración de despliegue en Vercel
├── CHANGELOG.md            # Registro histórico de versiones
└── LICENSE                 # Licencia de uso propietario Eurorep México
```

---

## 🔒 Licencia y Confidencialidad

Este software es **PROPIETARIO Y CONFIDENCIAL**. Derechos reservados © 2026 Eurorep México.
Queda estrictamente prohibida su copia, distribución o uso sin autorización expresa.
