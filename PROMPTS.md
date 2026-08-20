# PROMPTS.md — Desarrollo por fases

Cómo usar este archivo: copiá el prompt de **una fase a la vez** en el chat del agente
(VSCode Agent / Claude Code), dejá que termine, revisá el checklist de esa fase, y recién
ahí pasá a la siguiente. No le pegues varias fases juntas — el objetivo es ir construyendo
sobre una base verificada en cada paso.

Antes de la Fase 0, asegurate de que `CLAUDE.md` y `README.md` ya estén en la raíz del
repo (son el contexto que el agente debe leer primero).

---

## Fase 0 — Scaffolding del repo

```
Leé CLAUDE.md y README.md completos antes de escribir código.

Quiero que armes el esqueleto inicial del repo "fridge-monitor" con esta estructura
(la estructura completa de carpetas ya está detallada en README.md, seguila
exactamente).

Tareas de esta fase:
1. Inicializar el repo con package.json en backend/ y frontend/ por separado
   (monorepo simple, sin workspaces todavía).
2. Backend: Express mínimo con un endpoint GET /health que responda { status: "ok" }.
   Usar ES Modules. Configurar ESLint + Prettier.
3. Frontend: proyecto Vite + React mínimo, con ESLint + Prettier, que muestre una
   pantalla placeholder "Inmunocenter".
4. Crear .env.example con todas las variables listadas en README.md (con valores
   placeholder, nunca reales).
5. Crear .gitignore apropiado (node_modules, .env, dist, build, etc).
6. Configurar Vitest (o Jest, elegí uno y decilo) en el backend con un test trivial
   que pegue a GET /health.
7. NO toques Docker todavía, eso es la Fase 10.

Al terminar, dejame un resumen de: comandos para correr backend y frontend en local,
y confirmame que los tests pasan.
```

**Checklist de salida:**
- [ ] `backend/` corre con `npm run dev` y responde `/health`
- [ ] `frontend/` corre con `npm run dev` y muestra la pantalla placeholder
- [ ] Lint sin errores en ambos
- [ ] Test trivial del backend pasa
- [ ] `.env.example` completo y `.env` en `.gitignore`

---

## Fase 1 — Esquema de base de datos (Prisma)

```
Leé CLAUDE.md sección 3 (Modelo de datos) antes de empezar.

Instalá y configurá Prisma en backend/ apuntando a PostgreSQL vía DATABASE_URL.

Definí el schema.prisma con estos modelos (ajustá tipos/campos si ves algo raro, pero
avisame el porqué del cambio):

- User: id, email (unique), passwordHash, role (enum: ADMIN, USER), createdAt, updatedAt
- Fridge: id, name, location (nullable), modbusSlaveId (unique), tempMin, tempMax,
  humMin, humMax, createdAt, updatedAt
- Reading: id, fridgeId (FK), temperature (float), humidity (float), recordedAt
  (timestamp que manda el logger), receivedAt (timestamp del server), createdAt.
  Indexar (fridgeId, recordedAt) para queries de histórico rápidas.
- AlarmEvent: id, fridgeId (FK), type (enum: TEMP_HIGH, TEMP_LOW, HUM_HIGH, HUM_LOW,
  SENSOR_OFFLINE), startedAt, resolvedAt (nullable), notified (boolean, default false),
  createdAt
- ReportSchedule: id, name, cronExpression, format (enum: CSV, XLSX, PDF),
  recipients (string[]), fridgeIds (string[] o tabla intermedia, elegí lo más simple),
  active (boolean, default true), createdBy (FK a User), createdAt, updatedAt

Generá la migración inicial. Escribí un seed.js que cree:
- 1 usuario admin (email y password desde variables de entorno SEED_ADMIN_EMAIL /
  SEED_ADMIN_PASSWORD, hasheada con bcrypt)
- 4 registros de Fridge (Refrigerador_1 a 4, slaveId 1-4, rango temp 2-8, rango hum 20-90)

Agregá scripts en package.json: "db:migrate", "db:seed", "db:studio".
```

**Checklist de salida:**
- [ ] `npx prisma migrate dev` corre sin error contra Postgres local
- [ ] `npm run db:seed` crea el admin y los 4 fridges
- [ ] `npx prisma studio` muestra los datos correctamente

---

## Fase 2 — Auth y gestión de usuarios

```
Leé CLAUDE.md secciones 4 y 5 antes de empezar.

Implementá autenticación JWT en el backend:

1. POST /api/auth/login — recibe email/password, valida contra Prisma, devuelve
   access token (15 min) y refresh token (7 días, httpOnly cookie).
2. POST /api/auth/refresh — renueva el access token usando la cookie de refresh.
3. POST /api/auth/logout — invalida la cookie de refresh.
4. Middleware auth.middleware.js que valide el access token en rutas protegidas y
   agregue req.user.
5. Middleware role.middleware.js que reciba roles permitidos (ej. role(['ADMIN'])) y
   devuelva 403 si no corresponde.
6. Rutas de gestión de usuarios (solo ADMIN):
   - GET /api/users
   - POST /api/users (crear, con role)
   - PATCH /api/users/:id (cambiar role o resetear password)
   - DELETE /api/users/:id
7. Nunca devolver passwordHash en ninguna respuesta JSON.

Escribí tests de: login exitoso, login con password incorrecta, acceso a ruta
protegida sin token, acceso a ruta de ADMIN con usuario role USER (debe dar 403).
```

**Checklist de salida:**
- [ ] Login devuelve tokens válidos y funcionales
- [ ] Rutas protegidas rechazan sin token / con token vencido
- [ ] Rutas ADMIN-only rechazan a usuarios `USER`
- [ ] Tests pasan

---

## Fase 3 — Endpoint de ingesta + detección de alarmas

```
Leé CLAUDE.md secciones 3 y 4 (reglas de negocio de alarmas) antes de empezar.

1. POST /api/ingest — protegido con api-key.middleware.js (header X-API-Key contra
   INGEST_API_KEY de env, NO con JWT). Body: { fridgeId, temperature, humidity,
   recordedAt }. Validar payload (usar zod o joi, elegí uno). Buscar el Fridge por
   modbusSlaveId (fridgeId del payload = modbusSlaveId). Si no existe, 404. Guardar
   el Reading.

2. Después de guardar cada Reading, correr alarm-detection.service.js:
   - Determinar si el valor (temp y humedad, por separado) está fuera de rango del
     Fridge.
   - Si está fuera de rango: buscar si ya existe un AlarmEvent abierto (resolvedAt
     null) del mismo type para ese fridge.
     - Si no existe, y hay evidencia de que viene fuera de rango de forma continua
       hace >= 20 minutos (revisando los Readings de los últimos 20 min: todos deben
       estar fuera de rango, sin ninguno dentro de rango en el medio), crear el
       AlarmEvent con startedAt = timestamp del primer Reading fuera de rango de esa
       racha.
     - Si ya existe abierto, no hacer nada (evitar duplicados).
   - Si está dentro de rango: si había un AlarmEvent abierto de ese type, cerrarlo
     (resolvedAt = ahora).

3. Este servicio debe ser una función pura y testeable por separado de la ruta HTTP
   (recibe fridgeId + lecturas recientes, devuelve qué AlarmEvents crear/cerrar) para
   poder testear la lógica de los 20 minutos sin levantar el servidor entero.

Escribí tests unitarios de alarm-detection.service.js cubriendo: racha sostenida que
sí dispara alarma, racha corta que NO dispara, racha con una lectura intermedia
dentro de rango que resetea el conteo, cierre de alarma al volver a rango.
```

**Checklist de salida:**
- [ ] POST /api/ingest guarda Readings correctamente y rechaza sin API key válida
- [ ] Tests de `alarm-detection.service.js` cubren los 4 casos y pasan
- [ ] Probado manualmente con curl/Postman simulando una racha de 20+ min (podés
      insertar Readings con recordedAt manual para simular el tiempo)

---

## Fase 4 — APIs de dashboard (lecturas, min/max, alarmas)

```
Implementá las rutas de lectura para el dashboard (protegidas con auth, cualquier
role autenticado puede leer):

1. GET /api/fridges — lista todos los fridges con su última lectura embebida
   (temperatura/humedad actual + timestamp).
2. GET /api/fridges/:id — detalle de un fridge + rango configurado.
3. GET /api/fridges/:id/readings?from=&to=&limit= — histórico paginado, ordenado por
   recordedAt.
4. GET /api/fridges/:id/stats?from=&to= — min, max, avg de temp y humedad en el rango
   de fechas dado.
5. GET /api/alarms?status=open|resolved|all&fridgeId= — lista de AlarmEvents con
   filtros.
6. PATCH /api/fridges/:id — solo ADMIN, actualiza nombre/rangos.

Agregá paginación simple (limit/offset o cursor, elegí lo más simple) en el endpoint
de readings para no traer históricos gigantes de una.

Tests: al menos uno por endpoint verificando shape de la respuesta y que respeta
auth/roles.
```

**Checklist de salida:**
- [ ] Todos los endpoints devuelven datos correctos contra el seed de la Fase 1
- [ ] Paginación de readings funciona
- [ ] Tests pasan

---

## Fase 5 — Frontend: scaffolding, auth y layout

```
Leé CLAUDE.md antes de empezar. Trabajá solo en frontend/.

1. Configurá React Router con estas rutas: /login, /dashboard, /fridges/:id,
   /alarms, /reports, /users (esta última solo visible/accesible si role === ADMIN).
2. AuthContext.jsx: maneja login/logout, guarda el access token en memoria (no en
   localStorage por seguridad — usar refresh vía cookie httpOnly y reintentar en el
   client de API cuando el access token expira).
3. api/client.js: wrapper de fetch con base URL desde env (VITE_API_URL), que agregue
   el Authorization header y maneje el refresh automático en un 401.
4. ProtectedRoute.jsx: redirige a /login si no hay sesión, y a /dashboard si el role
   no alcanza para una ruta ADMIN-only.
5. LoginPage.jsx: formulario simple de email/password.
6. Layout.jsx: sidebar/topbar con navegación entre las secciones, mostrando el
   nombre/role del usuario logueado y botón de logout.

Todavía NO implementes el contenido real de Dashboard/Fridges/Alarms/Reports/Users,
dejalos como placeholders "en construcción" — eso es de la Fase 6 en adelante.
```

**Checklist de salida:**
- [ ] Login funciona end-to-end contra el backend de la Fase 2
- [ ] Rutas protegidas redirigen correctamente según sesión/role
- [ ] Refresh automático de token funciona (probar dejando expirar el access token)

---

## Fase 6 — Dashboard UI (estado actual, histórico, min/max)

```
Implementá DashboardPage.jsx y FridgeDetailPage.jsx usando las APIs de la Fase 4.

1. DashboardPage: grilla de FridgeCard.jsx, uno por refrigerador, mostrando
   temperatura y humedad actual, un indicador visual (verde/rojo) si está dentro o
   fuera de rango, y hace cuánto fue la última lectura (si hace más de X minutos que
   no hay lectura, marcarlo como "sin datos").
2. FridgeDetailPage: al entrar desde un FridgeCard, mostrar:
   - TempHistoryChart.jsx (recharts, line chart) de temperatura y humedad con
     selector de rango de fechas (últimas 24h, 7 días, 30 días, custom).
   - Card de min/max/avg del período seleccionado.
   - Lista de AlarmEvents de ese fridge (usando AlarmsList.jsx, reutilizable).
3. AlarmsPage: vista global de alarmas (todas las fridges), con filtro por estado
   (abiertas/resueltas) y por fridge.

Cuidá loading states y error states (qué se muestra si la API falla o no hay datos
todavía).
```

**Checklist de salida:**
- [ ] Dashboard muestra los 4 fridges con datos reales del seed/ingesta de prueba
- [ ] El chart de histórico se ve bien y responde al selector de fechas
- [ ] AlarmsPage lista alarmas y filtra correctamente

---

## Fase 7 — Exportación (CSV / Excel / PDF)

```
Backend: export.service.js con 3 funciones — exportReadingsToCsv, 
exportReadingsToXlsx, exportReadingsToPdf — todas reciben (fridgeId o "all", from,
to) y devuelven un stream/buffer.

Rutas:
- GET /api/exports/readings?fridgeId=&from=&to=&format=csv|xlsx|pdf

El PDF debe incluir: nombre del fridge, rango de fechas, tabla de lecturas
(o resumen si el rango es muy largo — definí un umbral razonable, ej. si son más de
500 registros mostrar solo resumen diario en el PDF y ofrecer el detalle vía CSV/XLSX),
y un resumen de min/max/avg.

Frontend: ExportButtons.jsx component reutilizable (botones CSV/Excel/PDF) que se
usa en FridgeDetailPage y en AlarmsPage, dispara la descarga del archivo con el
nombre apropiado (ej. refrigerador-1_2026-08-01_2026-08-06.csv).
```

**Checklist de salida:**
- [ ] Los 3 formatos se descargan correctamente y abren sin errores
- [ ] El PDF se ve prolijo (no solo texto plano sin formato)
- [ ] Botones de export funcionan desde el frontend

---

## Fase 8 — Reportes programados (cron)

```
Leé CLAUDE.md sección 2 (node-cron, sin cola externa) antes de empezar.

1. CRUD de ReportSchedule (solo ADMIN): GET/POST/PATCH/DELETE /api/report-schedules.
   Validar la expresión cron (usar una librería de validación, ej. cron-validate).
2. report-scheduler.service.js: al arrancar el server, lee todos los ReportSchedule
   activos y registra un job de node-cron por cada uno. Al crear/editar/borrar un
   schedule desde la API, actualizar los jobs en caliente (sin reiniciar el server).
3. Cada job ejecutado genera el reporte (reutilizando export.service.js) del período
   correspondiente (ej. si es diario, el día anterior completo) para los fridgeIds
   configurados, y lo manda por mailer.service.js (nodemailer con SMTP_* de env) a
   los recipients configurados, adjuntando el archivo en el formato configurado.
4. Loggear cada ejecución (éxito/error) — un log simple por ahora está bien, no hace
   falta una tabla de auditoría todavía.
5. ReportsPage.jsx (frontend): ADMIN puede crear/editar/borrar schedules desde una
   tabla simple con formulario (nombre, cron expression con ayuda de formato tipo
   "0 8 * * *", formato, fridges, destinatarios).

Test: mockeando node-cron o llamando directamente a la función de "ejecutar reporte
ahora" (separá esa lógica del registro del cron para poder testearla sin esperar).
```

**Checklist de salida:**
- [ ] Crear un schedule con cron "cada minuto" (para probar) y confirmar que el email
      llega con el adjunto correcto
- [ ] Editar/borrar un schedule actualiza los jobs corriendo sin reiniciar el server
- [ ] UI de ReportsPage funcional para ADMIN

---

## Fase 9 — Gestión de usuarios y fridges desde UI (ADMIN)

```
UsersPage.jsx (solo ADMIN): tabla de usuarios con crear/editar role/borrar,
reutilizando las rutas de la Fase 2.

Agregá también en algún lugar accesible para ADMIN (puede ser dentro de
FridgeDetailPage o una sección aparte) la edición de nombre/rangos de un Fridge,
usando PATCH /api/fridges/:id de la Fase 4.

Validaciones de formulario en frontend (no mandar rangos inválidos, email válido,
etc) además de las validaciones de backend que ya deberían existir.
```

**Checklist de salida:**
- [ ] ADMIN puede crear/editar/borrar usuarios desde la UI
- [ ] ADMIN puede editar rangos de un fridge desde la UI y el dashboard refleja el
      cambio

---

## Fase 10 — Dockerización

```
1. backend/Dockerfile: multi-stage, imagen final liviana (node:alpine), corre
   `prisma generate` en build, expone el puerto de la API.
2. frontend/Dockerfile: multi-stage — build con Vite, serví el resultado estático con
   nginx (o con el propio backend Express sirviendo /frontend/dist, elegí uno y
   documentá por qué en README).
3. docker-compose.yml (desarrollo): servicios backend, frontend, postgres, con
   volumes para hot-reload en dev.
4. docker-compose.prod.yml: versión de producción (sin hot-reload, variables de env
   inyectadas, sin exponer el puerto de Postgres al host).
5. Asegurate de que las migraciones de Prisma corran automáticamente al levantar el
   contenedor de backend en producción (entrypoint script que corre
   `prisma migrate deploy` antes de arrancar el server).

Actualizá el README.md con las instrucciones de docker-compose actualizadas si algo
cambió respecto a lo que ya está documentado.
```

**Checklist de salida:**
- [ ] `docker compose up --build` levanta todo (frontend, backend, db) desde cero
- [ ] Migraciones corren solas al levantar el contenedor
- [ ] `docker-compose.prod.yml` no expone Postgres al host

---

## Fase 11 — CI y guía de deploy

```
1. .github/workflows/ci.yml: en cada push/PR a main, correr lint + tests de
   backend y frontend, y build de ambas imágenes Docker (sin pushearlas todavía).
2. Escribí docs/deploy.md con instrucciones paso a paso para desplegar en (elegí
   documentar las que apliquen, no hace falta las 3):
   - Render (usando render.yaml, blueprint con web service + postgres)
   - Azure App Service (usando Azure for Students — App Service + Azure Database for
     PostgreSQL, con GitHub Actions haciendo el deploy)
   Incluí qué variables de entorno hay que configurar en el proveedor y cómo se
   maneja el INGEST_API_KEY para que el router (TRB245) le pueda pegar al endpoint
   público de forma segura (HTTPS obligatorio).
3. Si elegís Render, agregá el render.yaml al repo. Si elegís Azure, agregá el
   workflow de GitHub Actions correspondiente en .github/workflows/deploy-azure.yml.
```

**Checklist de salida:**
- [ ] CI corre en verde en un PR de prueba
- [ ] docs/deploy.md permite a alguien nuevo desplegar sin ayuda externa
- [ ] Deploy de prueba funcionando en el proveedor elegido, con el endpoint de
      ingesta accesible por HTTPS

---

## Fase 12 — Hardening y pulido final

```
Pasada final de calidad sobre todo el proyecto:

1. Rate limiting en /api/ingest y /api/auth/login (express-rate-limit).
2. Helmet en el backend para headers de seguridad.
3. Validación exhaustiva de inputs en todas las rutas (revisar que ninguna quedó sin
   validar).
4. Revisar que ningún endpoint devuelva más información de la necesaria (ej. no
   filtrar stack traces en producción — error-handler.middleware.js debe diferenciar
   dev/prod).
5. Agregar índices de DB faltantes si hay queries lentas evidentes.
6. Revisar accesibilidad básica del frontend (labels en forms, contraste de colores
   en los indicadores rojo/verde).
7. Actualizar README.md y CLAUDE.md con cualquier decisión que haya cambiado durante
   el desarrollo respecto a lo planeado originalmente.

Dejame un resumen final de arquitectura y de qué quedó pendiente como "nice to have"
para el futuro (si algo quedó afuera del scope).
```

**Checklist de salida:**
- [ ] Rate limiting activo en endpoints sensibles
- [ ] Sin fugas de información en errores de producción
- [ ] README.md y CLAUDE.md reflejan el estado real final del proyecto

---

## Notas generales para todas las fases

- Si el agente propone desviarse del stack definido en `CLAUDE.md`, pedile que
  justifique el cambio y, si lo aceptás, actualizá `CLAUDE.md` vos mismo (o
  pedíselo explícitamente como último paso de esa fase).
- Conviene hacer commit al cerrar cada fase (`git commit -m "Fase N: ..."`) para
  poder volver atrás si una fase posterior rompe algo.
- El endpoint `/api/ingest` es el punto de integración con el script del TRB245 que
  ya tenés corriendo en el router — en algún momento (podés hacerlo como una mini
  fase extra) hay que modificar ese script para que además de evaluar sus propias
  alarmas locales, haga un POST a este endpoint en cada ciclo de lectura.
