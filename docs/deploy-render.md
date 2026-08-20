# Deploy en Render — Inmunocenter / fridge-monitor

Con Render no armás una VM: cada pieza de tu stack es un "servicio" separado que Render
construye y corre por vos. Nada de SSH, Docker manual, ni cuotas.

Mapeo de tu proyecto a servicios de Render:

| Tu proyecto | Servicio en Render | Plan sugerido |
|---|---|---|
| `backend/` (Express + node-cron) | **Web Service** | Starter ($7/mes) — necesita estar siempre activo por el cron y el endpoint de ingesta 24/7 |
| `frontend/` (React build) | **Static Site** | Gratis |
| PostgreSQL | **Render Postgres** | Basic-1gb (~$19/mes) o Basic-256mb (~$6/mes) si el volumen de datos es chico al inicio |

**Costo total estimado: ~$13-26 USD/mes**, sin sysadmin de por medio.

> Nota importante: el cron de reportes (Fase 8, `node-cron` corriendo dentro del proceso del backend) **necesita que el Web Service esté siempre activo**, así que el plan Starter (no el free tier, que se duerme a los 15 min de inactividad) es obligatorio para esa parte, no opcional.

---

## 0. Prerrequisito: el código tiene que estar en GitHub

Render se conecta directo a tu repo y hace auto-deploy en cada push.

```bash
cd fridge-monitor
git init                      # si todavía no es un repo git
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<tu-usuario>/fridge-monitor.git
git push -u origin main
```

Si el repo ya existe y solo le faltaba subir, saltá este paso.

---

## 1. Crear la cuenta

1. Andá a **https://dashboard.render.com** → **Get Started** → registrate con tu cuenta de GitHub (así te autoriza el acceso a repos directo, sin pasos extra después).
2. No pide tarjeta para el free tier ni para crear el workspace — te la va a pedir recién cuando actives un servicio pago.

---

## 2. Crear la base de datos PostgreSQL

1. En el dashboard → **New +** → **PostgreSQL**.
2. Nombre: `fridge-monitor-db`.
3. Región: **Oregon** o **Ohio** (US) suelen ser las de menor latencia/costo por defecto; no importa mucho para tu caso de uso.
4. Plan: **Basic-256mb** para arrancar (podés subir de plan después sin downtime si crece el volumen de lecturas).
5. Creá. Cuando esté lista, andá a la página de la DB y copiá el **Internal Database URL** (la vas a usar en el paso 4 — es más rápida y no cuenta bandwidth porque backend y DB quedan en la misma red interna de Render).

---

## 3. Crear el Web Service (backend)

1. **New +** → **Web Service** → conectá el repo `fridge-monitor`.
2. Configuración:
   - **Name:** `fridge-monitor-api`
   - **Region:** la misma que elegiste para la DB (importante para que se comuniquen por red interna).
   - **Root Directory:** `backend` (porque tu repo es un monorepo con `backend/` y `frontend/` separados).
   - **Runtime:** Node.
   - **Build Command:**
     ```
     npm install && npx prisma generate && npx prisma migrate deploy
     ```
   - **Start Command:**
     ```
     node src/server.js
     ```
   - **Plan:** **Starter** ($7/mes) — no elijas Free, se duerme y te rompe el cron y el endpoint de ingesta.
3. **Variables de entorno** (sección Environment antes de crear, o después en Settings → Environment):
   - `DATABASE_URL` → pegá el **Internal Database URL** del paso 2
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → generalos con `openssl rand -hex 32`
   - `INGEST_API_KEY` → otra clave larga random
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
   - `FRONTEND_URL` → lo vas a completar en el paso 5, con la URL que te da el Static Site
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
   - `NODE_ENV` → `production`
4. **Create Web Service.** Render clona el repo, instala, corre las migraciones y levanta el server. Mirá el log de deploy — al final te da una URL tipo `https://fridge-monitor-api.onrender.com`.

---

## 4. Correr el seed (una sola vez)

Render no te da SSH directo al contenedor en planes chicos, pero tenés **Shell** desde el dashboard del servicio:

1. Andá al Web Service → pestaña **Shell** (arriba a la derecha).
2. Ejecutá:
   ```bash
   npm run db:seed
   ```
3. Esto crea tu usuario admin y los 4 fridges del seed.

---

## 5. Crear el Static Site (frontend)

1. **New +** → **Static Site** → mismo repo.
2. Configuración:
   - **Name:** `fridge-monitor-app`
   - **Root Directory:** `frontend`
   - **Build Command:**
     ```
     npm install && npm run build
     ```
   - **Publish Directory:** `dist`
3. **Variable de entorno:**
   - `VITE_API_URL` → la URL del backend del paso 3 (`https://fridge-monitor-api.onrender.com`)
4. **Create Static Site.** Te da una URL tipo `https://fridge-monitor-app.onrender.com` — HTTPS ya incluido, sin hacer nada.
5. Volvé al Web Service (backend) → Environment → actualizá `FRONTEND_URL` con esta URL nueva (para que el CORS del backend la acepte) → guardá (esto redeploya el backend solo).

---

## 6. Apuntar el logger (TRB245) al endpoint

Con el backend ya andando en HTTPS por defecto, el script del router debe pegarle a:

```
POST https://fridge-monitor-api.onrender.com/api/ingest
Headers: X-API-Key: <INGEST_API_KEY>
```

Probalo primero con curl:

```bash
curl -X POST https://fridge-monitor-api.onrender.com/api/ingest \
  -H "X-API-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fridgeId":"1","temperature":5.1,"humidity":45,"recordedAt":"2026-08-20T12:00:00Z"}'
```

---

## 7. (Opcional pero recomendado) Dominio propio

1. En cualquiera de los dos servicios (Web Service o Static Site) → **Settings** → **Custom Domain** → agregá tu dominio (ej. `app.inmunocenter.cl` para el frontend, `api.inmunocenter.cl` para el backend).
2. Render te da el registro DNS (CNAME) que tenés que crear en tu proveedor de dominio.
3. El certificado HTTPS se emite automático (Let's Encrypt) apenas el DNS propaga — no hay que hacer nada más.

---

## 8. Auto-deploy en cada cambio

Ya está activado por default: cada `git push` a `main` dispara un nuevo deploy tanto del backend como del frontend (Render detecta cambios en cada carpeta del monorepo por separado). Si querés confirmarlo o desactivarlo por servicio: **Settings → Build & Deploy → Auto-Deploy**.

---

## 9. (Opcional) Automatizar todo con `render.yaml`

Si más adelante querés versionar la infra como código (útil para la Fase 11 de tu PROMPTS.md), podés crear un `render.yaml` en la raíz del repo describiendo los 3 servicios (Postgres, Web Service, Static Site) y Render los crea todos juntos desde un "Blueprint" — te ahorra repetir los pasos 2-5 si alguna vez necesitás recrear el entorno (ej. un ambiente de staging).

---

## Resumen de costos

| Servicio | Plan | Costo |
|---|---|---|
| Web Service (backend) | Starter | $7/mes |
| PostgreSQL | Basic-256mb | $6/mes |
| Static Site (frontend) | Free | $0 |
| **Total** | | **~$13/mes** |

Si más adelante el volumen de lecturas crece mucho (miles de fridges o retención larga de histórico), subís solo el plan de Postgres — el resto no cambia.
