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
│       │   └── events.route.js          # nuevo — SSE de actualizaciones en vivo
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
│       │   ├── reading_buffer.service.js   # nuevo — suavizado de ruido por sensor
│       │   ├── realtime.service.js         # nuevo — bus de eventos en memoria
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
│       │   └── realtime.js              # nuevo — cliente SSE compartido
│       ├── auth/
│       │   ├── AuthContext.jsx
│       │   └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx        # ahora se suscribe a realtime
│       │   ├── FridgeDetailPage.jsx
│       │   ├── AlarmsPage.jsx
│       │   ├── ReportsPage.jsx
│       │   └── UsersPage.jsx
│       ├── components/
│       │   ├── FridgeCard.jsx           # ahora se suscribe a realtime
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

> **Nota de compatibilidad:** la imagen base del backend está fijada a
> `node:20-alpine3.19` (no `node:20-alpine` a secas). Un tag flotante como
> `node:20-alpine` puede resolver a una versión de Alpine más nueva en cada
> rebuild, y las versiones recientes de Alpine traen OpenSSL 3.x en vez de 1.1.x
> — lo que rompe el motor de Prisma si no coincide con `binaryTargets` en
> `schema.prisma` (ver más abajo). Si actualizas la versión de Node, actualiza
> ambos lugares a la vez.

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
  "modbus_temp_RH": [
    { "ID": "1", "data": [211, 538], "D": "27/08/2026 17:52:27" },
    { "ID": "2", "data": [212, 540], "D": "27/08/2026 17:52:27" }
  ]
}
```

`data` viene como `[tempX10, humX10]` (ej. `211` = 21.1°C). El `ID` mapea al
`modbusSlaveId` del refrigerador (`Fridge.modbusSlaveId`).

### Suavizado de ruido (`reading_buffer.service.js`)

El logger reenvía cada ~5s la misma muestra por sensor mientras el valor no
cambia demasiado, y el ruido de línea produce pequeñas variaciones entre
lecturas consecutivas. Antes de persistir, cada muestra entra a un buffer en
memoria por `modbusSlaveId` y se promedia contra una **ventana deslizante por
tiempo** (no por cantidad fija de muestras):

- Cada `pushSample()` descarta del buffer las muestras más viejas que la
  ventana configurada y promedia lo que quede.
- Esto es **resiliente a muestras faltantes**: si un sensor deja de reportar a
  mitad de una ráfaga, no se queda "esperando" una 4ª muestra que nunca llega
  — el siguiente request simplemente promedia con lo que haya.
- Es 100% en memoria y autocontenido (sin Redis): apto para el único container
  de backend actual. Si en el futuro se escala a más de una instancia del
  backend, este buffer necesitaría moverse a un store compartido (Redis) para
  que todas las instancias vean las mismas muestras.

## Actualización en vivo del dashboard

El dashboard ya no depende de refrescar la página ni de polling agresivo:

1. `POST /api/ingest` procesa el batch completo y, si al menos una lectura se
   guardó, emite **un solo evento** `readings-updated` (independiente de
   cuántos sensores traía la ráfaga) a través de `realtime.service.js` (un
   `EventEmitter` en memoria, sin dependencias externas).
2. `GET /api/events` expone ese bus como Server-Sent Events.
3. El frontend (`api/realtime.js`) mantiene **una sola conexión `EventSource`
   compartida** entre `DashboardPage` y todos los `FridgeCard` montados, y
   re-emite el evento como un `CustomEvent` de `window`.
4. `DashboardPage` vuelve a pedir `GET /api/fridges` (refresco silencioso, sin
   spinner) y cada `FridgeCard` vuelve a pedir sus estadísticas del día si está
   viendo "Hoy".

> **Nota de seguridad:** `/api/events` está montado **sin** `authMiddleware`,
> a diferencia del resto de rutas bajo `/api`. Esto es intencional:
> `EventSource` no permite adjuntar headers custom (no hay forma nativa de
> mandar `Authorization: Bearer ...`), así que no puede pasar por el mismo
> middleware que las rutas REST. Lo que expone el endpoint es únicamente
> `{ fridgeIds, at }` — ningún dato de temperatura/humedad. Ver la sección de
> roadmap más abajo para la migración a un canal autenticado.

## Desarrollo por fases

Este proyecto se construye siguiendo `PROMPTS.md` — una serie ordenada de prompts para el
agente de IA (VSCode Agent / Claude Code), fase por fase, cada una verificable antes de
avanzar a la siguiente. Ver `CLAUDE.md` para el contexto persistente que el agente debe
respetar en todas las fases.

## Roadmap / próximos pasos

Cambios planeados, en orden de prioridad sugerido. Ninguno está implementado
todavía — se documentan acá para que la siguiente fase de `PROMPTS.md` los
retome con contexto.

### 1. Modo fullscreen del dashboard

Un botón que colapse el `Layout` (sidebar, header de sesión) y muestre
únicamente la grilla de `FridgeCard` en su estado actual — pensado para dejarlo
proyectado en una pantalla fija de sala de servidores/bodega, sin navegación.

Enfoque sugerido:
- Un `?fullscreen=1` en la ruta de `DashboardPage`, o un estado local +
  `document.documentElement.requestFullscreen()` para usar el fullscreen nativo
  del navegador.
- En modo fullscreen, ocultar `Layout` completo y renderizar una variante
  "reducida" de `FridgeCard` (o un nuevo `FridgeTile`) que muestre solo
  temperatura, humedad y estado — sin edición de nombre, sin navegación de
  días, sin botones. Evitar bifurcar toda la lógica de `FridgeCard`: extraer
  primero la parte de "estado actual" a un subcomponente compartido.
- Salir de fullscreen con `Esc` (ya lo maneja el navegador) y con un botón
  visible al hacer hover/tap.
- Considerar auto-activar este modo vía una ruta dedicada (`/dashboard/kiosk`)
  para que se pueda dejar abierta directamente en una Smart TV o mini-PC sin
  pasar por un clic manual cada vez que se reinicia el dispositivo.

### 2. Revamp de Reportes/Cronjobs (drag-and-drop, sin sintaxis cron)

Reemplazar el formulario actual de `ReportSchedule` (que expone `cronExpression`
en crudo) por un builder visual. Nadie debería tener que escribir `0 8 * * 1`
a mano.

Enfoque sugerido:
- Librería de cron visual (ej. `react-js-cron` o equivalente) para traducir
  clics ("todos los lunes a las 8am") a la expresión cron internamente — el
  backend (`report-scheduler.service.js`, basado en `node-cron`) no cambia,
  solo cambia cómo se genera el string.
- Selección de refrigeradores (`fridgeIds`) y destinatarios (`recipients`) como
  chips arrastrables/reordenables en vez de inputs de texto separados por coma
  — `dnd-kit` es liviano y no requiere backend.
- Selector de formato (`CSV`/`XLSX`/`PDF`) como tarjetas grandes con ícono en
  vez de `<select>`.
- Vista previa en lenguaje natural del schedule antes de guardar ("Cada lunes
  a las 08:00, envía PDF de Bodega 1 y Bodega 2 a sistemas@inmunocenter.cl").
- No requiere cambios de esquema en `ReportSchedule` — es 100% una capa de UI
  sobre el modelo que ya existe.

### 3. Mejorar la confiabilidad del realtime

El SSE implementado en esta fase cubre el caso feliz, pero tiene puntos
frágiles que conviene resolver antes de depender de él en producción sin red
de respaldo:

- **Sin fallback si el SSE se cae:** si `EventSource` pierde la conexión (red
  inestable, proxy que corta conexiones idle, restart del backend) y no
  reconecta a tiempo, el dashboard queda "congelado" sin avisar. Agregar un
  **polling de respaldo** (ej. cada 30–60s, independiente del SSE) que
  refresque igual, para que el peor caso sea "un poco más lento", no "roto".
- **Sin indicador de estado de conexión:** el usuario no tiene forma de saber
  si el dashboard está actualizándose en vivo o quedó desconectado. Agregar un
  indicador visual (punto verde/gris) basado en los eventos `onopen`/`onerror`
  de `EventSource`.
- **Sin autenticación en `/api/events`** (ver nota de seguridad arriba). Si se
  quiere cerrar esto, la opción estándar para SSE es pasar el JWT como query
  param (`/api/events?token=...`) y validarlo a mano en el route handler, ya
  que el header `Authorization` no es una opción con `EventSource`.
- **No sobrevive a múltiples instancias del backend:** el bus de eventos es un
  `EventEmitter` en memoria de un solo proceso. Si en algún momento se escala
  el backend a más de un container, cada instancia tendría su propia copia del
  bus y los clientes conectados a una instancia no verían los eventos
  emitidos por otra. Requeriría migrar a Redis pub-sub (`realtimeBus` pasaría
  a publicar/suscribirse vía Redis en vez de `EventEmitter` nativo) — mismo
  cambio que ya se anticipó para `reading_buffer.service.js` si se escala
  horizontalmente.
- **Reconexión sin backoff:** `EventSource` reconecta solo, pero sin control
  sobre el intervalo. Si el backend está caído por un rato largo, vale la pena
  un backoff exponencial manual en `realtime.js` en vez de dejarlo al default
  del navegador.

## Licencia

Uso interno / privado.