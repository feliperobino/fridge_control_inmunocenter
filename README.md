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
## 🚀 Cambios Recientes (Revamps Implementados)

### 1. Sistema de Reportes Programados (Revamp #2)
* **Formulario Visual de Cronjobs (Sin sintaxis manual):**
  * Configuración intuitiva de frecuencia (Diaria, Semanal, Mensual) y selección directa de hora/día.
  * Traductor dinámico a expresiones CRON de 5 campos en tiempo real (`0 8 * * *`).
  * Modo **Avanzado / Personalizado** mantenido para usuarios experimentados.
* **Decodificador en Lenguaje Natural:**
  * Traducción automática de expresiones CRON en la tabla de listado (e.g., *"Todos los Lunes a las 09:30"* o *"Todos los días a las 08:00"*).
* **Selector Visual de Refrigeradores (Checkboxes):**
  * Sustitución del `<select multiple>` por tarjetas interactivas de verificación individual.
  * Botón global de acción rápida para **"Incluir todos / Desmarcar todos"** los equipos con un solo clic.

---

## 📋 Próximos Proyectos

### Proyecto 1: Fix & Revamp de Gráficos de Detalle por Refrigerador

#### 1. Objetivos del Fix y Mejoras
* **Ventana de Tiempo Escada & Unidades Claras:**
  * Eje horizontal ($X$) configurado dinámicamente con unidades explícitas en horas (e.g., `Últimas 6h`, `12h`, `24h`, `48h`).
  * Marcas de tiempo (*timestamps*) formateadas de manera legible y proporcional al intervalo seleccionado.
* **Límites y Dimensiones Fijas en Eje Y:**
  * Escala del eje vertical ($Y$) fijada con márgenes de tolerancia (*padding* superior e inferior) para evitar saltos repentinos de escala al actualizar datos.
* **Visualización Visual de Rangos y Umbrales Fuera de Control:**
  * Sombreado de área / bandas de tolerancia visuales indicando el rango óptimo por variable (Temperatura, Humedad, etc.).
  * Resaltado automático en color diferenciado (rojo/alerta) cuando una variable sale del rango permitido, mostrando claramente **cuándo y durante cuánto tiempo** ocurrió la excursión.
* **Auditoría e Investigación de Datos Constantes:**
  * Diagnóstico y corrección del flujo de datos en Frontend/Backend/Modbus ante la presencia de lecturas planas/constantes incoherentes frente al comportamiento real del equipo.

#### 2. Componentes y Capas Involucradas
* `frontend/src/pages/FridgeDetailPage.jsx` (o componentes de gráficos asociados tipo Chart.js / Recharts).
* `backend/src/services/telemetryService.js` (Revisión de la consulta y mapeo de lecturas).
* Modbus/Poller Worker (Verificación del ciclo de refresco e ingesta de datos en DB).

---

### Proyecto 2: Gestión y Limpieza UI basada en Roles (RBAC)

#### 1. Objetivos del Fix y Mejoras
* **Filtrado Silencioso de Navegación y Vistas:**
  * Eliminación de elementos de la barra de navegación, menús laterales, botones o páginas completas a los que el usuario no tenga permisos de acceso.
  * Reemplazar los mensajes de error/bloqueo tipo `403 Forbidden` en la interfaz por un filtrado proactivo a nivel de UI: si el usuario no tiene acceso, el elemento **simplemente no existe ni se despliega**.
* **Condicionales Guard Centralizados:**
  * Abstracción de un helper/hook de verificación de roles (`useAuth` / `hasPermission`) para renderizar componentes de forma limpia y mantenible.

#### 2. Componentes e Interfaces Involucradas
* `frontend/src/components/Navbar.jsx` / `Sidebar.jsx` (Filtrado de ítems de navegación según rol).
* `frontend/src/routes/AppRoutes.jsx` (Redirección limpia de rutas no autorizadas sin renderizar componentes vacíos).
* `frontend/src/context/AuthContext.jsx` (Manejo de permisos y perfil de usuario activo).

---

## 🛠️ Tecnologías Empleadas

* **Frontend:** React, React Router, CSS3 (CSS Modules / Custom Properties).
* **Backend:** Node.js, Express, Cron Runner.
* **Persistencia & Datos:** Base de datos relacional / Integración Modbus RTU/TCP.
## 🗄️ Trabajo Futuro: Gestión de Espacio en Disco (Retención, Logs y Pruning)

> **Contexto:** el VPS de producción (Vultr, `inmunocenter-vps`) tiene **25 GB SSD**
> totales. Con la ingesta actual (4 sensores cada 30s) la tabla `Reading` crece a un
> ritmo aproximado de **~14 MB/día (~5 GB/año)**, medido empíricamente en las primeras
> 12h de operación. A ese ritmo el disco no es un problema inmediato, pero **sin
> ninguna política de limpieza, tres cosas compiten por el mismo espacio de forma
> indefinida**: los datos de `Reading`, las imágenes/logs de Docker, y los backups
> automáticos de Vultr. Ninguna de las tres se autolimita sola. Esta sección documenta
> qué falta implementar, por qué, y con qué prioridad.

### 0. Por qué esto no es "auto-gestionado" por defecto

Es un malentendido común (y peligroso) asumir que una base de datos funciona como un
buffer circular donde el dato más viejo se pisa solo cuando se llena el disco. **Eso
no pasa.** Lo que realmente ocurre si el disco se llena:

- PostgreSQL empieza a rechazar `INSERT` (`could not extend file: No space left on
  device`), y en el peor caso puede quedarse sin espacio para el WAL y rechazar
  también transacciones de lectura.
- El proceso de ingesta (`POST /api/ingest`) empieza a devolver 500 al TRB245, y se
  pierden lecturas nuevas silenciosamente hasta que alguien interviene a mano.
- Si el disco se llena a mitad de un checkpoint o de un `autovacuum`, Postgres puede
  quedar en un estado que requiere intervención manual para levantar de nuevo.

Por eso las tres piezas de abajo son necesarias: no para "ahorrar espacio" de forma
prematura, sino para que el sistema se degrade de forma controlada y visible en vez
de fallar en silencio.

### 1. Retención y pruning de `Reading` (prioridad: media, no urgente)

**Objetivo:** que la tabla de lecturas nunca crezca sin límite, sin perder capacidad
de auditoría de cadena de frío.

- Agregar `backend/src/services/retention.service.js` con un job `node-cron` diario
  (reutilizando la infraestructura de cron que ya existe para `report-scheduler.service.js`)
  que borre lecturas más viejas que un umbral configurable:

  ```js
  import cron from 'node-cron';
  import { prisma } from '../config/db.js';

  const RETENTION_MONTHS = Number(process.env.READING_RETENTION_MONTHS ?? 18);

  cron.schedule('0 3 * * *', async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

    const { count } = await prisma.reading.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    logger.info(`[retention] borradas ${count} lecturas anteriores a ${cutoff.toISOString()}`);
  });
  ```

- Exponer `READING_RETENTION_MONTHS` en `.env.example` y `config/env.js`.
- **Pendiente de definición de negocio, no técnica:** confirmar si existe un
  requisito normativo/sanitario de tiempo mínimo de conservación de registros de
  temperatura (trazabilidad de insumos biológicos/vacunas) antes de fijar el valor
  default. Hasta confirmar, usar 18-24 meses como default conservador.
- **Antes de borrar, considerar archivado en frío:** en vez de un `DELETE`
  destructivo, exportar el rango a borrar a CSV/Parquet comprimido (reutilizando
  `export.service.js`) a un bucket S3-compatible (Vultr Object Storage) antes de
  eliminarlo de Postgres. Mantiene la trazabilidad a costo mínimo sin inflar la BD
  activa.
- Correr `VACUUM ANALYZE "Reading";` después de cada corrida de borrado masivo (o
  confiar en `autovacuum`, que Postgres tiene activado por defecto) para que el
  espacio liberado por los `DELETE` se recicle a nivel de páginas en vez de quedar
  fragmentado dentro del datafile.

### 2. Logs de Docker sin límite (prioridad: alta, más urgente que lo anterior)

**Este es, en la práctica, el riesgo de espacio más inmediato del stack actual** —
más que el crecimiento de `Reading`. Por defecto, Docker usa el driver `json-file`
**sin rotación**, así que los logs de cualquier container (`backend`, `postgres`,
`frontend`/`nginx`) pueden crecer indefinidamente, especialmente si algo empieza a
loguear en loop por un bug o una reconexión fallida del logger.

- Agregar límites de rotación a **todos** los servicios en `docker-compose.prod.yml`:

  ```yaml
  services:
    backend:
      logging:
        driver: json-file
        options:
          max-size: "10m"
          max-file: "5"
    postgres:
      logging:
        driver: json-file
        options:
          max-size: "10m"
          max-file: "5"
    # aplicar el mismo bloque a frontend/nginx
  ```

  Esto acota cada servicio a 50 MB de logs como máximo (5 archivos × 10 MB), en vez
  de sin límite.
- Alternativa/complemento a nivel de sistema operativo: configurar rotación global
  en `/etc/docker/daemon.json` como default para containers futuros:

  ```json
  {
    "log-driver": "json-file",
    "log-opts": { "max-size": "10m", "max-file": "5" }
  }
  ```

  (requiere `systemctl restart docker`; no afecta containers ya corriendo, solo
  nuevos — por eso conviene hacer ambas cosas: el `daemon.json` como red de
  seguridad general, y el `docker-compose.prod.yml` explícito para este proyecto).

### 3. Limpieza periódica de imágenes/capas de Docker (prioridad: media)

Cada `docker compose up --build` en producción deja atrás imágenes intermedias y
capas huérfanas de builds anteriores, que `docker system df` puede acumular con el
tiempo sin que nadie las note.

- Agregar un cron **a nivel de sistema operativo** (no de la app) semanal:

  ```bash
  # /etc/cron.weekly/docker-prune (chmod +x)
  #!/bin/bash
  docker image prune -af --filter "until=168h"   # imágenes sin usar de +7 días
  docker container prune -f
  docker builder prune -af --filter "until=168h"
  ```

  Deliberadamente **no** se incluye `docker volume prune`, para no arriesgar el
  volumen de datos de Postgres por error humano/de script.

### 4. Monitoreo proactivo de espacio en disco (prioridad: alta, es la red de seguridad)

Independientemente de qué tan bien se ajusten los puntos 1-3, siempre conviene un
aviso temprano en vez de descubrir el problema cuando el `INSERT` ya está fallando.

- Cron semanal simple que alerte si el uso de disco supera un umbral (ajustar canal
  de notificación real — email vía `mailer.service.js` que ya existe en el
  backend, o un webhook de Telegram/Slack si se prefiere algo más inmediato):

  ```bash
  # /etc/cron.weekly/disk-alert
  #!/bin/bash
  UMBRAL=70
  USO=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  if [ "$USO" -ge "$UMBRAL" ]; then
    echo "Disco de inmunocenter-vps al ${USO}% (umbral ${UMBRAL}%)" | \
      mail -s "⚠️ Alerta de disco - inmunocenter-vps" admin@dominio.com
  fi
  ```

- A mediano plazo, considerar un endpoint interno `GET /api/admin/system-health`
  (protegido con `role.middleware.js`, solo `admin`) que exponga `df`, tamaño de
  `Reading` y fecha de la lectura más antigua conservada, visible desde el
  dashboard — para que el estado de salud del disco no dependa únicamente de
  revisar la VPS por SSH.

### 5. Resumen de prioridad de implementación

| # | Ítem                        | Prioridad | Por qué                                                                                                                         |
|---|-----------------------------|-----------|---------------------------------------------------------------------------------------------------------------------------------|
| 2 | Rotación de logs de Docker  | **Alta**  | Es el riesgo de espacio más inmediato y silencioso; un bug de logging en loop puede llenar el disco en horas, no en años.       |
| 4 | Monitoreo/alerta de disco   | **Alta**  | Red de seguridad barata que cubre errores en cualquiera de los otros puntos.                                                    |
| 3 | Pruning de imágenes Docker  | Media     | Se acumula con cada deploy, pero a un ritmo lento y predecible.                                                                 | 
| 1 | Retención de `Reading`      | Media     | Al ritmo actual (~5 GB/año) da ~2 años de margen; no es urgente, resolverlo con tiempo y con la política de archivado definida. |

No implementar nada de esto todavía es una opción válida a corto plazo — el disco
no está en riesgo inminente — pero **los puntos 2 y 4 son de bajo costo/alto
retorno** y conviene priorizarlos antes que el pruning de la tabla `Reading` en sí.

## Licencia

Uso interno / privado.