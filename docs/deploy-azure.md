# Deploy en Azure (VM Linux, estilo EC2) — Inmunocenter / fridge-monitor

Esta guía asume que vas a levantar todo con `docker compose -f docker-compose.prod.yml up --build`
dentro de **una sola VM Linux**, que es lo más parecido a EC2. No usamos App Service acá.

---

## 0. Verificar/crear la suscripción de Azure

1. Entrá a **https://portal.azure.com** con tu cuenta Microsoft (o creá una en accounts.microsoft.com si no tenés).
2. En el buscador de arriba escribí **"Suscripciones"** y entrá.
   - Si ves alguna suscripción listada (ej. "Pay-As-You-Go", "Azure for Students", "Visual Studio Enterprise"), ya tenés una y podés saltar al paso 1.
   - Si no ves ninguna, Azure te va a ofrecer:
     - **Azure for Students** (si tenés email institucional `.edu` o similar): te da crédito gratis sin pedir tarjeta. Buscá "Azure for Students" en el portal o en azure.microsoft.com/free/students.
     - **Cuenta gratuita de Azure**: crédito inicial (usualmente ~$200 USD por 30 días) + algunos servicios free tier 12 meses, pero pide tarjeta de crédito para verificación (no cobra si no superás el límite del free trial, pero sí te puede pedir upgrade después).
3. Anotá el **nombre de la suscripción** — lo vas a necesitar al crear recursos.

> Tip: en **Cost Management + Billing** podés poner una alerta de presupuesto (ej. avisame si gasto más de $10) para no llevarte sorpresas.

---

## 1. Crear un Resource Group

Un resource group es una carpeta lógica para agrupar todos los recursos de este proyecto (VM, IP pública, disco, etc.) y poder borrarlos todos juntos si hace falta.

1. Buscá **"Grupos de recursos"** en el portal → **+ Crear**.
2. Suscripción: la que verificaste en el paso 0.
3. Nombre: `rg-fridge-monitor`.
4. Región: elegí la más cercana con buena latencia a Chile — normalmente **Brazil South** es la más cercana en LATAM (East US también es una opción común y suele ser más barata).
5. Crear.

---

## 2. Crear la Virtual Machine

1. Buscá **"Máquinas virtuales"** → **+ Crear** → **Máquina virtual de Azure**.
2. **Pestaña Básico:**
   - Resource group: `rg-fridge-monitor`.
   - Nombre de la VM: `vm-fridge-monitor`.
   - Región: la misma que el resource group.
   - Imagen: **Ubuntu Server 22.04 LTS - x64 Gen2**.
   - Tamaño: para este proyecto (Node + Postgres + React build, tráfico bajo/medio) alcanza con **B2s** (2 vCPU, 4GB RAM) o **B2ms** si querés margen. Es el equivalente a un `t3.small`/`t3.medium` de AWS.
   - Tipo de autenticación: **Clave pública SSH** (más seguro que contraseña).
     - Nombre de usuario: `azureuser`.
     - Generá un par de claves nuevo (Azure te deja descargar la `.pem` al crear) o pegá tu clave pública si ya tenés una (`~/.ssh/id_rsa.pub`).
   - Puertos de entrada públicos: **Permitir puertos seleccionados** → marcá **SSH (22)**. HTTP/HTTPS los vamos a abrir después a mano.
3. **Pestaña Discos:** dejá el default (disco SO tipo Premium SSD o Standard SSD, con 30GB alcanza de sobra).
4. **Pestaña Redes:** dejá que cree una VNet/subred nueva. Asegurate de que la **IP pública** esté en modo **Estático** (así no cambia si reiniciás la VM) — esto es importante porque el logger TRB245 y el DNS del frontend van a apuntar a esa IP.
5. **Pestaña Administración:** activá **Apagado automático** si querés (útil en pruebas para no gastar de más; en producción real lo dejás apagado/desactivado porque el logger manda datos 24/7).
6. **Revisar y crear** → **Crear**. Tarda 1-2 minutos en aprovisionarse.
7. Cuando termine, andá a la VM creada y copiá la **IP pública**.

---

## 3. Abrir los puertos necesarios (Network Security Group)

1. Andá a tu VM → **Redes** (o **Grupo de seguridad de red**) → **Agregar regla de puerto de entrada**.
2. Agregá estas reglas (además del 22/SSH que ya está):
   - **HTTP** — puerto 80
   - **HTTPS** — puerto 443
3. **No expongas el puerto 5432 (Postgres) ni el 3000 (API cruda) al público** — eso queda solo accesible dentro de la VM/red interna de Docker. El logger y el frontend van a hablar siempre a través del puerto 443 (HTTPS), nunca directo al backend.

---

## 4. Conectarte por SSH e instalar Docker

Desde tu máquina:

```bash
chmod 400 ~/Downloads/vm-fridge-monitor_key.pem   # si usaste clave descargada
ssh -i ~/Downloads/vm-fridge-monitor_key.pem azureuser@<IP_PUBLICA>
```

Ya dentro de la VM:

```bash
sudo apt update && sudo apt upgrade -y

# Instalar Docker Engine + Compose plugin (método oficial)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker azureuser
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## 5. Clonar el repo y configurar variables de entorno

```bash
cd ~
git clone <URL_DE_TU_REPO> fridge-monitor
cd fridge-monitor
cp .env.example .env
nano .env
```

Completá en `.env` (según lo definido en tu README):

- `DATABASE_URL` (apuntando al servicio `postgres` del compose)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generalos con `openssl rand -hex 32`
- `INGEST_API_KEY` — otra clave larga random, es la que vas a poner en el script del TRB245
- `SMTP_HOST/PORT/USER/PASS` — credenciales del proveedor de email para los reportes
- `FRONTEND_URL` — el dominio o IP pública que vas a usar (para CORS)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — para el usuario admin inicial

---

## 6. Levantar la aplicación

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Confirmá que las migraciones de Prisma corrieron solas (según tu Fase 10, el entrypoint del backend debe correr `prisma migrate deploy` antes de levantar). Si necesitás correr el seed manualmente la primera vez:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:seed
```

En este punto ya deberías poder entrar a `http://<IP_PUBLICA>` y ver el login.

---

## 7. (Recomendado) HTTPS con dominio propio

El TRB245 va a mandar datos por HTTPS obligatorio, así que necesitás un dominio + certificado. Dos caminos simples:

**Opción A — Caddy como reverse proxy (más simple, HTTPS automático):**

Agregá un servicio `caddy` al `docker-compose.prod.yml` que escuche en 80/443, apunte al frontend (nginx) y a `/api` al backend, con un `Caddyfile` tipo:

```
tudominio.com {
    handle /api/* {
        reverse_proxy backend:3000
    }
    handle {
        reverse_proxy frontend:80
    }
}
```

Caddy pide el certificado de Let's Encrypt solo, con solo tener el dominio apuntando a la IP pública de la VM.

**Opción B — Certbot manual sobre el nginx que ya sirve el frontend**, si preferís no agregar otro contenedor.

Para cualquiera de las dos, en tu proveedor de DNS creá un registro **A** de `tudominio.com` (o `inmunocenter.tudominio.com`) apuntando a la IP pública estática de la VM.

---

## 8. Apuntar el logger (TRB245) al endpoint público

Una vez que tengas HTTPS andando, el script del router debe pegarle a:

```
POST https://tudominio.com/api/ingest
Headers: X-API-Key: <INGEST_API_KEY del .env>
```

Probalo primero con `curl` desde tu máquina antes de tocar el router:

```bash
curl -X POST https://tudominio.com/api/ingest \
  -H "X-API-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fridgeId":"1","temperature":5.1,"humidity":45,"recordedAt":"2026-08-20T12:00:00Z"}'
```

---

## 9. Mantenimiento básico

- **Actualizar la app tras un cambio:**
  ```bash
  cd ~/fridge-monitor
  git pull
  docker compose -f docker-compose.prod.yml up --build -d
  ```
- **Backups de Postgres:** como Postgres corre en un contenedor dentro de la VM (no es un servicio administrado), armá un cron simple que corra `pg_dump` y suba el archivo a algún storage (Azure Blob Storage es la opción más simple, tiene tier gratis chico).
- **Reiniciar la VM:** con IP pública estática, la IP no cambia — los contenedores con `restart: always` en el compose deberían volver solos.
- **Ver costos:** Cost Management + Billing → Análisis de costos, filtrado por el resource group `rg-fridge-monitor`.

---

## Resumen de lo que creaste en Azure

| Recurso | Nombre sugerido | Para qué |
|---|---|---|
| Resource Group | `rg-fridge-monitor` | Agrupa todo, se borra todo junto si hace falta |
| Virtual Machine | `vm-fridge-monitor` | Corre Docker con backend + frontend + Postgres |
| IP pública | (asociada a la VM) | Estática, apunta el DNS acá |
| NSG | (asociado a la VM) | Reglas de firewall: 22 (SSH), 80, 443 abiertos |

Esto es equivalente a: lanzar una EC2, asignarle una Elastic IP, abrir el Security Group en 80/443/22, y correr tu `docker-compose` adentro por SSH — el flujo mental es el mismo.
