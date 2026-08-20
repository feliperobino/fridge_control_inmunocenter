# Inmunocenter — Dashboard de Temperatura y Humedad

Web app para monitoreo, histórico, alarmas y reportes de temperatura/humedad de
refrigeradores, alimentada por un logger Modbus (Teltonika TRB245 + sensores XY-MD02).

## Características

- 📡 **Ingesta HTTP** de lecturas enviadas por el logger (API key auth).
- 📊 **Dashboard** con estado actual, histórico por rango de fechas y min/max por
  refrigerador.
- 🚨 **Alarmas por sostenimiento** (≥20 min fuera de rango) registradas con inicio/fin.
- 📅 **Reportes programados** (cron) enviados por email en CSV/Excel/PDF.
- 📤 **Exportación on-demand** a CSV, Excel y PDF desde el dashboard.
- 👤 **Usuarios** con 2 roles: `admin` (gestiona todo) y `user` (solo lectura + export).
- 🐳 **Containerizado** con Docker / docker-compose, listo para desplegar en Render, Azure
  App Service o AWS.

## Stack

| Capa       | Tecnología                                |
|------------|--------------------------------------------|
| Frontend   | React + Vite (JavaScript)                  |
| Backend    | Node.js + Express (JavaScript, ESM)        |
| DB         | PostgreSQL + Prisma ORM                    |
| Auth       | JWT (access + refresh) + bcrypt            |
| Cron       | node-cron                                  |
| Exports    | exceljs, fast-csv, pdfkit                  |
| Charts     | recharts                                   |
| Contenedores | Docker, docker-compose                   |
| CI         | GitHub Actions                             |

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
│       │   └── users.routes.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── ingest.controller.js
│       │   ├── fridges.controller.js
│       │   ├── readings.controller.js
│       │   ├── alarms.controller.js
│       │   ├── reports.controller.js
│       │   └── users.controller.js
│       ├── services/
│       │   ├── auth.service.js
│       │   ├── alarm-detection.service.js
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
│       │   └── client.js
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

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Postgres: localhost:5432

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

- El workflow de CI está en [.github/workflows/ci.yml](.github/workflows/ci.yml).
- La guía de despliegue está en [docs/deploy.md](docs/deploy.md).
- Para Azure App Service, el workflow manual de despliegue está en [.github/workflows/deploy-azure.yml](.github/workflows/deploy-azure.yml).

## Variables de entorno principales

| Variable              | Descripción                                      |
|-----------------------|---------------------------------------------------|
| `DATABASE_URL`        | Connection string de Postgres                     |
| `JWT_ACCESS_SECRET`   | Secreto para firmar access tokens                 |
| `JWT_REFRESH_SECRET`  | Secreto para firmar refresh tokens                |
| `INGEST_API_KEY`      | API key que debe mandar el logger en `X-API-Key`  |
| `SMTP_HOST/PORT/USER/PASS` | Credenciales de envío de email de reportes  |
| `FRONTEND_URL`        | URL pública del frontend (para CORS)              |

(ver `.env.example` completo en el repo)

## Endpoint de ingesta (para el logger)

```
POST /api/ingest
Headers: X-API-Key: <INGEST_API_KEY>
Body: {
  "fridgeId": "refrigerador_1",
  "temperature": 5.2,
  "humidity": 48.3,
  "recordedAt": "2026-08-06T14:32:00Z"
}
```

## Desarrollo por fases

Este proyecto se construye siguiendo `PROMPTS.md` — una serie ordenada de prompts para el
agente de IA (VSCode Agent / Claude Code), fase por fase, cada una verificable antes de
avanzar a la siguiente. Ver `CLAUDE.md` para el contexto persistente que el agente debe
respetar en todas las fases.

## Licencia

Uso interno / privado.
