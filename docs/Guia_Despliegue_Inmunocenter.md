# Guía de Despliegue en VPS para Inmunocenter — Dashboard de Temperatura y Humedad

Esta guía contiene las instrucciones paso a paso para desplegar la plataforma **Inmunocenter** en un Servidor Privado Virtual (VPS) por un costo de **~$5 USD/mes**, manteniendo el 100% de las funcionalidades (Docker, PostgreSQL, Prisma, cron continuo y endpoints de ingesta HTTPS 24/7 con URL o IP fija).

---

## 1. Resumen de Precios y Costos Estimados

| Concepto | Proveedor Recomendado | Especificaciones | Costo Aproximado (USD) | Costo Aproximado (CLP)* |
| :--- | :--- | :--- | :--- | :--- |
| **VPS (Servidor Nube)** | Vultr / Hetzner / DigitalOcean | 1 vCPU, 1 GB - 2 GB RAM, 25 GB SSD | ~$4.00 – $5.00 / mes | ~$3.800 – $4.800 / mes |
| **Dominio Custom (Opcional)** | NIC Chile / Namecheap | `.cl` o `.com` | ~$1.00 / mes ($12/año) | ~$1.000 / mes |
| **Certificado SSL (HTTPS)** | Let's Encrypt | Certificado SSL/TLS automatizado | **$0.00 (Gratis)** | **$0 CLP** |
| **Base de Datos & Storage** | Incluido en VPS (PostgreSQL en Docker) | Integrado en el almacenamiento local | **$0.00 (Gratis)** | **$0 CLP** |
| **Total Estimado** | — | **Infraestructura Completa 24/7** | **~$5.00 / mes** | **~$4.800 CLP / mes** |

*\*Valores calculados con un tipo de cambio de referencia ($950 CLP/USD).*

---

## 2. Paso a Paso para la Instalación y Despliegue

### Paso 1: Creación del Servidor (VPS)
1. Regístrate en **Vultr**, **Hetzner Cloud** o **DigitalOcean**.
2. Despliega una nueva instancia/droplet con las siguientes características:
   * **Sistema Operativo:** Ubuntu 22.04 LTS o Ubuntu 24.04 LTS.
   * **Plan:** $4 a $5 USD/mes (1 vCPU, 1GB RAM).
   * **Ubicación:** Escoge la región más cercana (ej. Santiago en AWS/GCP, o Miami/US East en Vultr/DigitalOcean para baja latencia).
3. Anota la **Dirección IP pública** asignada a tu servidor (ej. `203.0.113.45`).

---

### Paso 2: Configuración del Dominio (DNS)
1. Si tienes un dominio propio (ej. `inmunocenter.cl` o `api.tudominio.cl`), ingresa al panel de tu proveedor de DNS (NIC Chile, Cloudflare, Namecheap, etc.).
2. Agrega un **Registro A**:
   * **Nombre/Host:** `api` (o `@` para el dominio raíz).
   * **Valor/IP:** La IP pública de tu VPS (`203.0.113.45`).

---

### Paso 3: Acceso e Instalación de Docker en el VPS
Conéctate por SSH desde tu terminal:

```bash
ssh root@203.0.113.45
```

Actualiza el sistema e instala Docker y Docker Compose:

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Docker usando el script oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verificar instalación de Docker y Docker Compose
docker --version
docker compose version
```

---

### Paso 4: Clonar Repositorio y Configurar Variables de Entorno
1. Clona el proyecto en el servidor:
   ```bash
   cd /var/www
   git clone https://github.com/tu-usuario/fridge-monitor.git
   cd fridge-monitor
   ```

2. Crea el archivo `.env` de producción a partir de la plantilla:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Completa los valores requeridos en el `.env`:
   ```env
   DATABASE_URL="postgresql://prisma:prisma_pass@postgres:5432/fridge_db?schema=public"
   JWT_ACCESS_SECRET="clave_secreta_para_jwt_access_tokens_compleja"
   JWT_REFRESH_SECRET="clave_secreta_para_jwt_refresh_tokens_compleja"
   INGEST_API_KEY="tu_api_key_segura_para_el_logger"
   SMTP_HOST="smtp.tu-proveedor.com"
   SMTP_PORT=587
   SMTP_USER="reportes@tudominio.cl"
   SMTP_PASS="tu_contraseña_smtp"
   FRONTEND_URL="https://api.tudominio.cl"
   ```

---

### Paso 5: Despliegue de Contenedores con Docker
Ejecuta el archivo `docker-compose.prod.yml` para compilar y levantar los servicios (PostgreSQL, Backend Node.js, Frontend React + Nginx):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Esto ejecutará automáticamente las migraciones de Prisma (`prisma migrate deploy`) y dejará la aplicación en ejecución continua.

---

### Paso 6: Configuración de Certificado SSL (HTTPS Gratis)
Si vas a usar un dominio con HTTPS, instala Certbot en el servidor para proteger el tráfico HTTP enviado por el logger y el panel web:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.tudominio.cl
```

---

## 3. Configuración del Logger Teltonika TRB245

En la interfaz web del equipo Teltonika TRB245 (o vía RMS), configura la sección **Services -> Data to Server**:

* **Service Status:** Enabled
* **Server Type:** HTTP / HTTPS
* **URL:** `https://api.tudominio.cl/api/ingest` (o `http://203.0.113.45/api/ingest` si usas IP directa)
* **HTTP Method:** `POST`
* **Custom Headers:**
  ```text
  X-API-Key: <TU_INGEST_API_KEY>
  Content-Type: application/json
  ```
* **Payload Format (JSON):**
  ```json
  {
    "fridgeId": "refrigerador_1",
    "temperature": %s,
    "humidity": %s,
    "recordedAt": "%t"
  }
  ```

---

## 4. Verificación y Mantenimiento

* **Ver estado de los contenedores:**
  ```bash
  docker compose -f docker-compose.prod.yml ps
  ```
* **Ver logs de la aplicación backend:**
  ```bash
  docker compose -f docker-compose.prod.yml logs -f backend
  ```
* **Reiniciar servicios:**
  ```bash
  docker compose -f docker-compose.prod.yml restart
  ```
