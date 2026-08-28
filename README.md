# Inmunocenter — Dashboard de Temperatura y Humedad

Web app para monitoreo, histórico, alarmas y reportes de temperatura/humedad de
refrigeradores, alimentada por un logger Modbus (Teltonika TRB245 + sensores XY-MD02).

## Características

- 📡 **Ingesta HTTP** de lecturas enviadas por el logger (API key auth), con **suavizado de ruido** por sensor mediante una ventana deslizante en memoria.
- 🔴 **Actualización en vivo** del dashboard vía Server-Sent Events: cada ráfaga de ingesta procesada notifica al frontend una sola vez, sin necesidad de refrescar la página.
- 📊 **Dashboard y Detalle Avanzado** con histórico continuo de 00:00 a 24:00 horas, visibilidad de series conmutables, métricas de % Time In Range (TIR) y líneas de valores extremos ($T_{max}$ y $T_{min}$) calculados sobre la curva promediada.
- 🚨 **Alarmas por sostenimiento** (≥20 min fuera de rango) registradas con inicio/fin.
- 📅 **Reportes programados** (cron) y exportación de informes PDF institucionales de 2 páginas con gráficos y estadísticas globales mensuales.
- 📤 **Exportación on-demand** a CSV, Excel y PDF desde el dashboard.
- 👤 **Usuarios** con 2 roles: `admin` (gestiona todo) y `user` (solo lectura + export).
- 🐳 **Containerizado** con Docker / docker-compose, listo para desplegar en Render, Azure App Service o AWS.

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
│       │   ├── system-health.routes.js
│       │   └── events.route.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── ingest.controller.js
│       │   ├── fridges.controller.js
│       │   ├── readings.controller.js
│       │   ├── alarms.controller.js
│       │   ├── reports.controller.js
│       │   ├── system-health.controller.js
│       │   └── users.controller.js
│       ├── services/
│       │   ├── auth.service.js
│       │   ├── alarm-detection.service.js
│       │   ├── reading_buffer.service.js
│       │   ├── realtime.service.js
│       │   ├── retention.service.js
│       │   ├── export.service.js          # Generación PDF / Excel / CSV
│       │   ├── report-scheduler.service.js
│       │   ├── reports.service.js
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
│       │   └── realtime.js
│       ├── assets/
│       │   └── logo.png                   # Logo institucional para PDF / UI
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

---

## ✅ Funcionalidades Implementadas

### 1. Histórico Continuo y Análisis Estadístico en Detalle de Refrigerador

* **Eje X Continuo (00:00 - 24:00):** Visualización fija del día completo con marcas cada 3 horas.
* **Resiliencia al Ruido:** Algoritmo de re-muestreo (bucketed resampling) que filtra ruidos espurios de los sensores.
* **Líneas de Extremos $T_{max}$ y $T_{min}$:** Trazado automático de líneas horizontales discontinuas intersectando las crestas y valles de la curva suavizada del día.
* **Métricas de % Time In Range (TIR):** Cálculo dinámico de porcentaje en rango óptimo y tiempo acumulado fuera de rango.
* **Controles de Visibilidad:** Toggles independientes para ocultar/mostrar las líneas de Temperatura y Humedad en tiempo real.

### 2. Gestión de Espacio y Memoria (Infraestructura & Backend)

* **Rotación de Logs:** Configurado en `docker-compose.prod.yml` (`max-size: "10m"`, `max-file: "5"`).
* **Purga Automática:** Cronjob diario (`retention.service.js`) a las 03:00 AM para registros más antiguos a `READING_RETENTION_MONTHS`.
* **Monitoreo Operativo:** Endpoint `GET /api/admin/system-health` con métricas de RAM, disco y tamaño de base de datos.

---

Aquí tienes la sección del **README.md** reescrita con un nivel de detalle arquitectónico y técnico exhaustivo. Incluye la guía archivo por archivo, el *por qué* de cada decisión técnica, los snippets de estructura del código, y la fórmula exacta para los cálculos de la BD y la generación del PDF.

---

### **Actualización para el `README.md` (Sección: Plan de Implementación Técnica del Revamp de Reportes)**

## 🛠️ Guía Detallada de Implementación Técnica: Revamp de Reportes PDF

Para evitar desviaciones durante el desarrollo, la reestructuración del módulo de reportes debe implementarse modificando y coordinando **4 archivos clave** en el Backend y Frontend.

---

### 📂 Resumen de Archivos a Modificar / Crear

| Archivo | Responsabilidad | Operación |
|---|---|---|
| `backend/assets/logo.png` | Recurso gráfico institucional (Logo Inmunocenter) | **Nuevo recurso** |
| `backend/src/services/reports.service.js` | Consultas SQL/Prisma, agrupamiento por día (30 días), cálculo de promedios, varianza y % uptime | **Modificar / Expandir** |
| `backend/src/services/export.service.js` | Renderizado vectorial con PDFKit, generación de gráficos (QuickChart/Canvas) y maquetación en 2 páginas | **Revamp completo** |
| `frontend/src/pages/ReportsPage.jsx` | UI de descarga e integración de la vista previa del reporte de 30 días | **Ajustar controles** |

---

### 📄 Detalle por Archivo: Qué cambiar, Cómo y Por Qué

---

#### 1. `backend/assets/logo.png`
* **¿Por qué?**  
  `pdfkit` requiere una ruta física local de la imagen en el servidor para incrustar el logo de Inmunocenter en la cabecera del documento sin depender de URLs externas que puedan fallar en entornos aislados o Docker.
* **¿Qué hacer?**  
  Colocar el logo corporativo (formato PNG transparente, dimensión recomendada: 400x120px) en `backend/assets/logo.png`.

---

#### 2. `backend/src/services/reports.service.js`

* **¿Por qué?**  
  El reporte no requiere lecturas crudas punto por punto (lo que saturaría el gráfico de 30 días con +43,000 registros), sino **1 agregación diaria por refrigerador** durante los últimos 30 días. Además, debe calcular métricas globales de uptime y varianza estadística.

* **¿Cómo implementarlo?**  
  Crear la función `getMonthlyReportData(endDate = new Date())` que ejecute la agregación:

  ```javascript
  // Lógica de cálculo requerida:
  // 1. Rango de fechas: [endDate - 30 días, endDate]
  // 2. Agrupación por DATE(recordedAt) y fridgeId:
  //    - T_max, T_min, T_avg por día.
  //    - RH_max, RH_min, RH_avg por día.
  // 3. Uptime diario por refrigerador:
  //    - Se cuentan cuántas horas distintas del día tienen al menos 1 lectura (COUNT(DISTINCT EXTRACT(HOUR FROM recordedAt))).
  //    - Si horas_distintas >= 24 (o lecturas cada 1h), día_online = true.
  //    - Uptime % = (días_online / 30) * 100.
  // 4. Varianza Global (σ²):
  //    - Calculada sobre todas las lecturas crudas o la media de desviaciones del periodo.
  // 5. Nomenclatura del tag:
  //    - Format: `${fridge.name} (Slave #${fridge.modbusSlaveId})`

```

* **Estructura del objeto retornado por el servicio:**
```javascript
{
  metadata: {
    title: "Inmunocenter - Reporte de temperatura y humedad Refrigeradores",
    subtitle: "Guardia Vieja 155 of 1206",
    generatedAt: "28/08/2026",
    period: "29/07/2026 - 28/08/2026"
  },
  fridgesData: [
    {
      id: "uuid",
      label: "Refrigerador Vacunas (Slave #1)",
      modbusSlaveId: 1,
      // Serie temporal de 30 puntos para los gráficos
      dailySeries: [
        { date: "2026-07-29", tempMax: 5.2, tempMin: 3.1, tempAvg: 4.1, rhMax: 55, rhMin: 40, rhAvg: 47.5 },
        // ... 30 días
      ],
      // Métricas tabulares globales
      statsTemp: {
        outOfRangeHoursPerDay: "0.2 h/día",
        globalAvg: 4.3,
        variance: 0.45,
        totalReadings: 720,
        uptimePercentage: 98.5,
        absoluteMax: 8.4,
        absoluteMin: 1.9
      },
      statsRH: {
        outOfRangeHoursPerDay: "0.0 h/día",
        globalAvg: 48.2,
        variance: 2.1,
        totalReadings: 720,
        uptimePercentage: 98.5,
        absoluteMax: 62.0,
        absoluteMin: 38.0
      }
    }
  ]
}

```



---

#### 3. `backend/src/services/export.service.js` (El Núcleo del Revamp)

* **¿Por qué?**
`pdfkit` no renderiza componentes React ni HTML. Para dibujar la grilla 2x2 de gráficos en el PDF, se requiere convertir la serie diaria de 30 puntos en una imagen (PNG/Buffer) antes de insertarla en el canvas del documento, asegurando una separación **estricta de 2 páginas** (`doc.addPage()`).
* **¿Cómo implementarlo?**
1. **Generación de Gráficos (QuickChart API / `quickchart-js` o Canvas Local):**
Para cada refrigerador, generar la imagen del gráfico de 30 días (Líneas para Max, Min y Avg + Banda sombreada de rango 2°C - 8°C para Temp).
2. **Estructura Estricta de Páginas (`PDFDocument`):**
```javascript
import PDFDocument from 'pdfkit';
import path from 'path';

export async function generateMonthlyPDFReport(dataStream, reportData) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 30, autoFirstPage: true });
  doc.pipe(dataStream);

  const logoPath = path.join(__dirname, '../../assets/logo.png');

  // ==========================================
  // PÁGINA 1: TEMPERATURA (30 DÍAS)
  // ==========================================
  renderHeader(doc, reportData.metadata, logoPath);

  // 1. Renderizar Grilla 2x2 de Gráficos de Temperatura (4 Refrigeradores)
  // Usar posiciones absolutas X, Y para encajar 4 cuadros en la mitad superior.
  await renderChartGrid(doc, reportData.fridgesData, 'temperature');

  // 2. Renderizar Tabla Estadística Global de Temperatura en la parte inferior
  renderStatsTable(doc, reportData.fridgesData, 'temperature');

  // ==========================================
  // PÁGINA 2: HUMEDAD (30 DÍAS)
  // ==========================================
  doc.addPage(); // SALTO DE PÁGINA FORZADO

  renderHeader(doc, reportData.metadata, logoPath);

  // 1. Renderizar Grilla 2x2 de Gráficos de Humedad
  await renderChartGrid(doc, reportData.fridgesData, 'humidity');

  // 2. Renderizar Tabla Estadística Global de Humedad
  renderStatsTable(doc, reportData.fridgesData, 'humidity');

  doc.end();
}

3. **Formato de Tablas Vectoriales (Pie de página de cada hoja):**
Construir las tablas con líneas delgadas (`doc.rect()`, `doc.stroke()`) definiendo anchos de columna fijos:
* **Col 1:** Refrigerador (`Nombre (Slave #i)`) — *Width: 25%*
* **Col 2:** Tiempo fuera de rango prom./día — *Width: 15%*
* **Col 3:** Temp/RH Global Promedio ± Varianza ($\mu \pm \sigma^2$) — *Width: 20%*
* **Col 4:** Lecturas Totales (% Uptime) — *Width: 20%*
* **Col 5:** Extremas del Mes ($T_{max}$ / $T_{min}$) — *Width: 20%*

---

#### 4. `frontend/src/pages/ReportsPage.jsx`

* **¿Por qué?**
La interfaz debe ofrecer la opción explícita de descargar este nuevo **"Reporte Mensual Integrado (2 Páginas PDF)"** además de los reportes por rango arbitrario de fechas.
* **¿Qué hacer?**
* Agregar un botón destacado: `[ 📄 Descargar Reporte Mensual PDF (30 días) ]`.
* Vincular el botón al endpoint `GET /api/reports/monthly-pdf`.
