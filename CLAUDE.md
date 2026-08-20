# CLAUDE.md — Contexto del proyecto para el agente

Este archivo es la fuente de verdad que el agente (Claude Code / Copilot Agent en VSCode)
debe leer antes de tocar código. Contiene el propósito del proyecto, decisiones de stack,
convenciones y reglas de negocio del dominio. Si algo en un prompt puntual contradice este
archivo, este archivo gana — y hay que actualizarlo si la decisión cambió a propósito.

## 1. Qué es este proyecto

Web app de **monitoreo de temperatura y humedad de refrigeradores** en una instalación
(actualmente 4 refrigeradores, sensores XY-MD02 vía Modbus RTU, conectados a un router
industrial Teltonika TRB245 que actúa como *logger/gateway*).

El router envía lecturas periódicas a esta app (endpoint HTTP de ingesta). La app:
- Persiste el historial de lecturas.
- Calcula y expone estado actual, min/max, histórico por refrigerador.
- Detecta y registra alarmas (fuera de rango sostenido, sensor caído).
- Genera reportes exportables (CSV/Excel/PDF) y los envía por email en forma programada (cron).
- Tiene un dashboard web con auth de 2 roles: `admin` y `user`.

**No** reemplaza las alarmas SMS/Email inmediatas que ya corren directo en el router
(power outage, alarmas nativas Modbus) — esta app es la capa de histórico, reporting y
visualización, más una segunda línea de alarmas por sostenimiento en el tiempo con contexto
histórico (útil para auditoría / cumplimiento, no solo para notificar en caliente).

## 2. Stack (decisiones ya tomadas, no re-discutir salvo pedido explícito)

- **Backend**: Node.js + Express, JavaScript (no TypeScript), ES Modules.
- **Frontend**: React (Vite), JavaScript, sin TypeScript.
- **Base de datos**: PostgreSQL. ORM: Prisma.
- **Auth**: JWT (access + refresh token), bcrypt para passwords. Roles: `admin`, `user`.
- **Cron / jobs programados**: `node-cron` dentro del propio backend (sin cola externa tipo
  Redis/Bull por ahora — el volumen no lo justifica; si crece, se migra a BullMQ).
- **Exportación**: `exceljs` (Excel), `json2csv` o `fast-csv` (CSV), `pdfkit` o
  `puppeteer` (PDF — preferir pdfkit por ser más liviano en contenedor).
- **Charts dashboard**: `recharts`.
- **Contenedores**: Docker multi-stage (uno para backend, uno para frontend servido por
  nginx o servido por el propio Express en prod), `docker-compose` para desarrollo local
  (app + Postgres).
- **Deploy objetivo**: Render o Azure App Service (el usuario tiene GitHub Student — Azure
  for Students da créditos). Diseñar todo para que sea deploy-agnóstico (variables de
  entorno, sin hardcodear paths de un proveedor).
- **CI**: GitHub Actions (lint + test + build en cada PR/push a main).

## 2b. Estado final de entrega

- El deploy documentado y automatizado quedó orientado a Azure App Service.
- El frontend de producción se sirve con nginx; el desarrollo usa `docker-compose` con hot reload.
- Los reportes programados usan `node-cron` + `nodemailer` + `pdfkit`/`exceljs`.

## 3. Modelo de datos (referencia — el detalle exacto se define en la Fase 1)

Entidades esperadas:
- `User` (id, email, passwordHash, role[admin|user], createdAt)
- `Fridge` (id, name, location, tempMin, tempMax, humMin, humMax, modbusSlaveId)
- `Reading` (id, fridgeId, temperature, humidity, recordedAt, receivedAt)
- `AlarmEvent` (id, fridgeId, type[temp_high|temp_low|hum_high|hum_low|sensor_offline],
  startedAt, resolvedAt nullable, notified boolean)
- `ReportSchedule` (id, name, cronExpression, format[csv|xlsx|pdf], recipients[], fridgeIds[],
  active boolean, createdBy)

## 4. Reglas de negocio clave

- **Alarma por sostenimiento**: un valor fuera de rango debe persistir **≥ 20 minutos
  continuos** (con lecturas evaluadas cada 1-2 min) antes de crear/cerrar un `AlarmEvent`.
  Esta lógica de debounce ya se resolvió en un script standalone en el router (fuera de
  este repo) — en esta app se puede reimplementar de forma más simple porque acá SÍ
  tenemos historial completo en BD: basta con consultar "¿hay N minutos de lecturas
  consecutivas fuera de rango sin ninguna lectura dentro de rango en el medio?" en cada
  ingesta nueva.
- **Ingesta**: el endpoint de ingesta es machine-to-machine (el router llama a la app), no
  usa JWT de usuario — usa un API key estático en header (`X-API-Key`), configurable por
  env var. Debe ser idempotente y tolerante a payloads duplicados/fuera de orden (usar
  `recordedAt` que manda el logger, no solo `receivedAt` del servidor).
- **Roles**: `admin` puede gestionar usuarios, refrigeradores, rangos, y reportes
  programados. `user` solo puede ver dashboard, histórico y descargar exports. No hay
  roles intermedios — mantenerlo simple.
- **Rangos por refrigerador**: configurables desde la UI (no hardcodeados), current default
  2–8°C temperatura, 20–90% humedad (ver `Fridge` model).

## 5. Convenciones de código

- ES Modules (`import`/`export`), no `require`.
- Backend: arquitectura por capas simple — `routes/` → `controllers/` → `services/` →
  `prisma` (sin repository pattern extra, no sobre-ingenierizar).
- Nombres de archivos: `kebab-case.js`. Componentes React: `PascalCase.jsx`.
- Variables de entorno centralizadas en `config/env.js`, nunca `process.env.X` disperso
  por el código.
- Toda ruta de API válida solo request JSON, responde JSON, con manejo de errores
  centralizado (middleware de error al final de Express).
- Tests: Vitest o Jest (definir en Fase 0) — no es necesario 100% de cobertura, sí cubrir
  la lógica de negocio (debounce de alarmas, cálculo de min/max, exports).

## 6. Cómo debe trabajar el agente en este repo

- Leer este archivo y el `README.md` antes de generar código nuevo.
- Trabajar **fase por fase** según `PROMPTS.md` — no adelantarse a fases futuras aunque
  parezca "fácil hacerlo ahora". Cada fase termina en un estado funcional y testeable.
- Al terminar una fase: correr lint + tests, y dejar un resumen corto de qué se hizo y qué
  falta antes de pasar a la siguiente.
- No commitear secretos. Usar `.env.example` con placeholders, `.env` real en
  `.gitignore`.
- Si una decisión de este archivo se vuelve inviable (ej. una librería no sirve), actualizar
  este archivo explicando el cambio antes de seguir.
