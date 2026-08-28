# Inmunocenter — Dashboard de Temperatura y Humedad

Web app para monitoreo, histórico, alarmas y reportes de temperatura/humedad de
refrigeradores, alimentada por un logger Modbus (Teltonika TRB245 + sensores XY-MD02).

## Características

- 📡 **Ingesta HTTP** de lecturas enviadas por el logger (API key auth), con
  **suavizado de ruido** por sensor mediante una ventana deslizante en memoria.
- 🔴 **Actualización en vivo** del dashboard vía Server-Sent Events: cada ráfaga de
  ingesta procesada notifica al frontend una sola vez, sin necesidad de refrescar la
  página.
- 📊 **Dashboard** con estado actual, histórico por rango de fechas y min/max por
  refrigerador.
- 🚨 **Alarmas por sostenimiento** (≥20 min fuera de rango) registradas con inicio/fin.
- 📅 **Reportes programados** (cron) enviados por email en CSV/Excel/PDF.
- 📤 **Exportación on-demand** a CSV, Excel y PDF desde el dashboard.
- 👤 **Usuarios** con 2 roles: `admin` (gestiona todo) y `user` (solo lectura + export).
- 🐳 **Containerizado** con Docker / docker-compose, listo para desplegar en Render, Azure
  App Service o AWS.

## Stack

| Capa          | Tecnología                                                      |
|---------------|-----------------------------------------------------------------|
| Frontend      | React + Vite (JavaScript)                                       |
| Backend       | Node.js + Express (JavaScript, ESM)                             |
| DB            | PostgreSQL + Prisma ORM                                         |
| Auth          | JWT (access + refresh) + bcrypt                                 |
| Realtime      | Server-Sent Events (EventEmitter en memoria, single-container)  |
| Cron          | node-cron                                                       |
| Exports       | exceljs, fast-csv, pdfkit                                       |
| Charts        | recharts                                                        |
| Contenedores  | Docker (`node:20-alpine3.19`), docker-compose                   |
| CI            | GitHub Actions                                                  |

## Estructura del proyecto


```

fridge-monitor/
├── CLAUDE.md
├── PROMPTS.md
├── README.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       │   └── env.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── ingest.routes.js
│       │   ├── fridges.routes.js
│       │   ├── readings.routes.js
│       │   ├── alarms.routes.js
│       │   ├── reports.routes.js
│       │   ├── users.routes.js
│       │   ├── system-health.routes.js # nuevo — monitoreo de memoria/disco/bd
│       │   └── events.route.js          # SSE de actualizaciones en vivo
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── ingest.controller.js
│       │   ├── fridges.controller.js
│       │   ├── readings.controller.js
│       │   ├── alarms.controller.js
│       │   ├── reports.controller.js
│       │   ├── system-health.controller.js # nuevo — métricas operativas
│       │   └── users.controller.js
│       ├── services/
│       │   ├── auth.service.js
│       │   ├── alarm-detection.service.js
│       │   ├── reading_buffer.service.js   # suavizado de ruido por sensor
│       │   ├── realtime.service.js         # bus de eventos en memoria
│       │   ├── retention.service.js        # nuevo — purga automática de lecturas
│       │   ├── export.service.js
│       │   ├── report-scheduler.service.js
│       │   └── mailer.service.js
│       ├── middlewares/
│       │   ├── auth.middleware.js
│       │   ├── role.middleware.js
│       │   ├── api-key.middleware.js
│       │   └── error-handler.middleware.js
│       └── utils/
│           └── logger.js
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   ├── client.js
│       │   ├── fridges.js
│       │   └── realtime.js              # cliente SSE compartido
│       ├── auth/
│       │   ├── AuthContext.jsx
│       │   └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── FridgeDetailPage.jsx
│       │   ├── AlarmsPage.jsx
│       │   ├── ReportsPage.jsx
│       │   └── UsersPage.jsx
│       ├── components/
│       │   ├── FridgeCard.jsx
│       │   ├── TempHistoryChart.jsx
│       │   ├── AlarmsList.jsx
│       │   ├── ExportButtons.jsx
│       │   └── Layout.jsx
│       └── styles/
└── docs/
└── api.md

```

## Quickstart (desarrollo local)

```bash
cp .env.example .env
docker compose up --build

```

* Frontend: http://localhost:5173
* Backend API: http://localhost:3000
* Postgres: localhost:5432

## Docker

### Desarrollo

```bash
docker compose up --build

```

Esto levanta Postgres, backend y frontend con hot reload.

### Producción

```bash
docker compose -f docker-compose.prod.yml up --build

```

En producción el frontend se sirve con nginx y el backend corre `prisma migrate deploy` antes de iniciar.

## CI y deploy

* El workflow de CI está en [.github/workflows/ci.yml](https://www.google.com/search?q=.github/workflows/ci.yml).
* La guía de despliegue está en [docs/deploy.md](https://www.google.com/search?q=docs/deploy.md).
* Para Azure App Service, el workflow manual de despliegue está en [.github/workflows/deploy-azure.yml](https://www.google.com/search?q=.github/workflows/deploy-azure.yml).

## Variables de entorno principales

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Connection string de Postgres |
| `JWT_ACCESS_SECRET` | Secreto para firmar access tokens |
| `JWT_REFRESH_SECRET` | Secreto para firmar refresh tokens |
| `INGEST_API_KEY` | API key que debe mandar el logger en `X-API-Key` |
| `SMTP_HOST/PORT/USER/PASS` | Credenciales de envío de email de reportes |
| `FRONTEND_URL` | URL pública del frontend (para CORS) |
| `READING_RETENTION_MONTHS` | Meses de conservación para purga de lecturas (Default: `18`) |

## Endpoint de ingesta (para el logger)

```
POST /api/ingest
Headers: X-API-Key: <INGEST_API_KEY>
Body: {
  "modbus_temp_RH": [
    { "ID": "1", "data": [211, 538], "D": "27/08/2026 17:52:27" },
    { "ID": "2", "data": [212, 540], "D": "27/08/2026 17:52:27" }
  ]
}

```

---

## ✅ Funcionalidades e Infraestructura Implementadas

### 1. Gestión de Espacio y Memoria (Infraestructura & Backend)

* **Rotación y límites de logs en Docker:** Configurado en `docker-compose.prod.yml` (`max-size: "10m"`, `max-file: "5"`) previniendo saturación por logs del sistema.
* **Cronjob de retención automática de lecturas:** `retention.service.js` ejecuta una purga diaria a las 03:00 AM borrando registros en la tabla `Reading` anteriores al periodo configurado en `READING_RETENTION_MONTHS` (default 18 meses).
* **Endpoint de Salud y Monitoreo:** `GET /api/admin/system-health` (exclusivo para `admin`) exponiendo en tiempo real uso de disco (`df`), estado de la memoria Node.js, cantidad total de registros en la BD y peso exacto de la tabla de lecturas en Postgres.

### 2. Sistema de Reportes Programados

* **Formulario Visual de Cronjobs:** Configuración de frecuencia (Diaria, Semanal, Mensual) y hora sin requerir sintaxis manual, traduciendo dinámicamente a expresiones CRON de 5 campos.
* **Decodificador en Lenguaje Natural:** Traducción automática de expresiones CRON en el listado de reportes.
* **Selector Visual de Refrigeradores:** Tarjetas de verificación individual con botón de acción rápida para incluir/desmarcar todos los equipos.

---

## 📋 Por Implementar (Pendientes)

### 1. Fix & Revamp de Gráficos de Detalle por Refrigerador

* **Ventana de Tiempo Escada & Unidades Claras:** Eje horizontal ($X$) configurado dinámicamente con unidades explícitas en horas (`6h`, `12h`, `24h`, `48h`) y marcas de tiempo proporcionales.
* **Límites y Dimensiones Fijas en Eje Y:** Escala vertical fijada con márgenes de tolerancia para evitar saltos de escala al actualizar datos.
* **Bandas de Tolerancia y Alertas Visuales:** Sombreado de área del rango óptimo y resaltado diferenciado (alerta) cuando una variable sale de los umbrales permitidos.
* **Auditoría de Lecturas Constantes:** Corrección del flujo de datos ante lecturas planas o constantes incoherentes frente al comportamiento real del equipo.

### 2. Gestión y Limpieza UI basada en Roles (RBAC)

* **Filtrado Silencioso de Navegación:** Ocultamiento proactivo de menús, botones y componentes según el rol del usuario en lugar de desplegar bloqueos o errores `403 Forbidden`.
* **Guards Centralizados en Frontend:** Abstracción de hooks (`useAuth` / `hasPermission`) para gestionar renderizado condicional de vistas.

### 3. Alertas Proactivas a Nivel Servidor (VPS)

* Script de alerta por correo/webhook en la VPS (`/etc/cron.weekly/disk-alert`) notificando si el uso de disco en el servidor supera el 70% de capacidad.

---

## 🛠️ Tecnologías Empleadas

* **Frontend:** React, React Router, CSS3.
* **Backend:** Node.js, Express, Cron Runner, Prisma ORM.
* **Persistencia & Datos:** PostgreSQL, Integración Modbus RTU/TCP.

## Licencia

Uso interno / privado.