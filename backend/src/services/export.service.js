import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../config/prisma.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_SUMMARY_THRESHOLD = 500;

function parseDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return date;
}

function formatFileDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatPdfDate(date) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function buildWhere(fridgeId, from, to, options = {}) {
  const where = {
    recordedAt: {
      gte: from,
      lte: to
    }
  };

  if (Array.isArray(options.fridgeIds) && options.fridgeIds.length > 0) {
    where.fridgeId = {
      in: options.fridgeIds
    };
  } else if (fridgeId && fridgeId !== 'all') {
    where.fridgeId = fridgeId;
  }

  return where;
}

async function getExportData(fridgeId, from, to, options = {}) {
  const startDate = parseDate(from);
  const endDate = parseDate(to);
  const readings = await prisma.reading.findMany({
    where: buildWhere(fridgeId, startDate, endDate, options),
    orderBy: { recordedAt: 'asc' },
    include: {
      fridge: {
        select: { id: true, name: true, modbusSlaveId: true }
      }
    }
  });

  const fridges = Array.isArray(options.fridgeIds) && options.fridgeIds.length > 0
    ? await prisma.fridge.findMany({ where: { id: { in: options.fridgeIds } } })
    : fridgeId && fridgeId !== 'all'
      ? await prisma.fridge.findMany({ where: { id: fridgeId } })
      : await prisma.fridge.findMany({ orderBy: { createdAt: 'asc' } });

  return { readings, fridges, startDate, endDate };
}

function escapeCsvCell(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildCsv(rows) {
  const header = ['fridgeName', 'fridgeId', 'temperature', 'humidity', 'recordedAt', 'receivedAt'];
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.fridge?.name || '',
        row.fridgeId,
        row.temperature,
        row.humidity,
        row.recordedAt.toISOString(),
        row.receivedAt?.toISOString?.() || ''
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return `${lines.join('\n')}\n`;
}

function buildSummary(rows) {
  const summaryByDay = new Map();

  for (const row of rows) {
    const day = row.recordedAt.toISOString().slice(0, 10);
    const current = summaryByDay.get(day) || {
      day,
      count: 0,
      tempMin: Number.POSITIVE_INFINITY,
      tempMax: Number.NEGATIVE_INFINITY,
      tempSum: 0,
      humMin: Number.POSITIVE_INFINITY,
      humMax: Number.NEGATIVE_INFINITY,
      humSum: 0
    };

    current.count += 1;
    current.tempMin = Math.min(current.tempMin, row.temperature);
    current.tempMax = Math.max(current.tempMax, row.temperature);
    current.tempSum += row.temperature;
    current.humMin = Math.min(current.humMin, row.humidity);
    current.humMax = Math.max(current.humMax, row.humidity);
    current.humSum += row.humidity;

    summaryByDay.set(day, current);
  }

  return [...summaryByDay.values()].map((item) => ({
    day: item.day,
    count: item.count,
    tempMin: item.tempMin,
    tempMax: item.tempMax,
    tempAvg: item.tempSum / item.count,
    humMin: item.humMin,
    humMax: item.humMax,
    humAvg: item.humSum / item.count
  }));
}

function formatSummaryText(summaryRows) {
  return summaryRows.map((row) => ({
    day: row.day,
    count: row.count,
    temperature: `${row.tempMin.toFixed(1)} - ${row.tempMax.toFixed(1)} (avg ${row.tempAvg.toFixed(1)})`,
    humidity: `${row.humMin.toFixed(1)} - ${row.humMax.toFixed(1)} (avg ${row.humAvg.toFixed(1)})`
  }));
}

async function buildPdfBuffer({ title, subtitle, rows, summaryRows }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks = [];

  const bufferPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).fillColor('#08111f').text(title);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#475569').text(subtitle);
  doc.moveDown(1);

  const tableData = summaryRows ? formatSummaryText(summaryRows) : rows;
  const headers = summaryRows
    ? ['Día', 'Lecturas', 'Temperatura', 'Humedad']
    : ['Refrigerador', 'Temperatura', 'Humedad', 'Registrado'];

  const columnWidths = summaryRows ? [90, 70, 170, 170] : [150, 90, 90, 180];

  function drawRow(cells, y, isHeader = false) {
    let cursorX = doc.x;
    const rowHeight = isHeader ? 26 : 34;

    cells.forEach((cell, index) => {
      const width = columnWidths[index];
      doc
        .lineWidth(0.5)
        .strokeColor('#cbd5e1')
        .rect(cursorX, y, width, rowHeight)
        .stroke();

      doc
        .fillColor(isHeader ? '#08111f' : '#0f172a')
        .fontSize(isHeader ? 10 : 9)
        .text(cell, cursorX + 6, y + 8, { width: width - 12, align: 'left' });

      cursorX += width;
    });

    return y + rowHeight;
  }

  let cursorY = doc.y;
  cursorY = drawRow(headers, cursorY, true);

  if (summaryRows) {
    for (const row of tableData) {
      cursorY = drawRow([row.day, String(row.count), row.temperature, row.humidity], cursorY);
    }
  } else {
    for (const row of tableData) {
      const cells = [
        row.fridge?.name || 'all',
        `${row.temperature.toFixed(1)}°C`,
        `${row.humidity.toFixed(1)}%`,
        formatPdfDate(row.recordedAt)
      ];
      cursorY = drawRow(cells, cursorY);
    }
  }

  cursorY += 18;
  doc.fontSize(12).fillColor('#08111f').text('Resumen', doc.x, cursorY);
  cursorY += 20;
  doc.fontSize(10).fillColor('#334155');
  doc.text(`Lecturas: ${rows.length}`, doc.x, cursorY);
  cursorY += 16;

  if (rows.length > 0) {
    const temperatureValues = rows.map((row) => row.temperature);
    const humidityValues = rows.map((row) => row.humidity);
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

    doc.text(
      `Temperatura min/max/avg: ${Math.min(...temperatureValues).toFixed(1)} / ${Math.max(...temperatureValues).toFixed(1)} / ${average(temperatureValues).toFixed(1)}`
    , doc.x, cursorY);
    cursorY += 16;
    doc.text(
      `Humedad min/max/avg: ${Math.min(...humidityValues).toFixed(1)} / ${Math.max(...humidityValues).toFixed(1)} / ${average(humidityValues).toFixed(1)}`
    , doc.x, cursorY);
  }

  doc.end();
  return bufferPromise;
}

export async function exportReadingsToCsv(fridgeId, from, to, options = {}) {
  const { readings, fridges, startDate, endDate } = await getExportData(fridgeId, from, to, options);
  const rows = readings.map((reading) => ({
    ...reading,
    fridge: reading.fridge || fridges.find((fridge) => fridge.id === reading.fridgeId)
  }));

  return {
    buffer: Buffer.from(buildCsv(rows), 'utf8'),
    rows,
    startDate,
    endDate,
    filename: `${fridgeId && fridgeId !== 'all' ? 'refrigerador' : 'all-fridges'}_${formatFileDate(startDate)}_${formatFileDate(endDate)}.csv`,
    contentType: 'text/csv; charset=utf-8'
  };
}

export async function exportReadingsToXlsx(fridgeId, from, to, options = {}) {
  const { readings, fridges, startDate, endDate } = await getExportData(fridgeId, from, to, options);
  const rows = readings.map((reading) => ({
    ...reading,
    fridge: reading.fridge || fridges.find((fridge) => fridge.id === reading.fridgeId)
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Readings');

  sheet.columns = [
    { header: 'Fridge', key: 'fridgeName', width: 24 },
    { header: 'Temperature', key: 'temperature', width: 14 },
    { header: 'Humidity', key: 'humidity', width: 14 },
    { header: 'Recorded At', key: 'recordedAt', width: 24 },
    { header: 'Received At', key: 'receivedAt', width: 24 }
  ];

  for (const row of rows) {
    sheet.addRow({
      fridgeName: row.fridge?.name || 'all',
      temperature: row.temperature,
      humidity: row.humidity,
      recordedAt: row.recordedAt,
      receivedAt: row.receivedAt
    });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = 'A1:E1';

  return {
    buffer: await workbook.xlsx.writeBuffer(),
    rows,
    startDate,
    endDate,
    filename: `${fridgeId && fridgeId !== 'all' ? 'refrigerador' : 'all-fridges'}_${formatFileDate(startDate)}_${formatFileDate(endDate)}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
}

export async function exportReadingsToPdf(fridgeId, from, to, options = {}) {
  const { readings, fridges, startDate, endDate } = await getExportData(fridgeId, from, to, options);
  const rows = readings.map((reading) => ({
    ...reading,
    fridge: reading.fridge || fridges.find((fridge) => fridge.id === reading.fridgeId)
  }));

  const useSummary = rows.length > PDF_SUMMARY_THRESHOLD;
  const summaryRows = useSummary ? buildSummary(rows) : null;
  const fridgeLabel = fridgeId && fridgeId !== 'all' ? fridges[0]?.name || fridgeId : 'Todos los refrigeradores';

  const buffer = await buildPdfBuffer({
    title: `Lecturas - ${fridgeLabel}`,
    subtitle: `${formatPdfDate(startDate)} a ${formatPdfDate(endDate)}`,
    rows,
    summaryRows
  });

  return {
    buffer,
    rows,
    startDate,
    endDate,
    filename: `${fridgeId && fridgeId !== 'all' ? 'refrigerador' : 'all-fridges'}_${formatFileDate(startDate)}_${formatFileDate(endDate)}.pdf`,
    contentType: 'application/pdf'
  };
}


async function fetchChartBuffer(labels, maxSeries, minSeries, avgSeries, title, unit, isTemperature = true, limits = { min: 2, max: 8 }) {
  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Max',
          borderColor: '#ef4444',
          borderWidth: 1.5,
          fill: false,
          pointRadius: 1,
          data: maxSeries
        },
        {
          label: 'Prom',
          borderColor: isTemperature ? '#2563eb' : '#0d9488',
          borderWidth: 2,
          fill: false,
          pointRadius: 2,
          data: avgSeries
        },
        {
          label: 'Min',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          fill: false,
          pointRadius: 1,
          data: minSeries
        }
      ]
    },
    options: {
      title: { display: true, text: title, fontSize: 10 },
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, fontSize: 8 } },
      scales: {
        xAxes: [{ ticks: { fontSize: 7, maxRotation: 45 } }],
        yAxes: [{ ticks: { fontSize: 8, callback: (val) => `${val}${unit}` } }]
      }
    }
  };

  const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=350&h=180&bkg=white`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    // Si falla QuickChart, continúa sin la imagen (fallback vectorial)
  }
  return null;
}

/**
 * Renderiza el encabezado común para las páginas 1 y 2
 */
function renderHeader(doc, metadata, logoPath) {
  // Intentar cargar logo si existe
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 40, 30, { width: 120 });
    } catch (e) {
      // Fallback si la imagen está corrupta o falla
      doc.fontSize(16).fillColor('#08111f').text('INMUNOCENTER', 40, 35);
    }
  } else {
    doc.fontSize(16).fillColor('#08111f').text('INMUNOCENTER', 40, 35);
  }

  doc.fontSize(12).fillColor('#08111f').text(metadata.title, 180, 30, { width: 375, align: 'right' });
  doc.fontSize(9).fillColor('#64748b').text(metadata.subtitle, 180, 48, { width: 375, align: 'right' });
  doc.fontSize(8).fillColor('#64748b').text(`Período: ${metadata.period} | Generado: ${metadata.generatedAt}`, 180, 62, { width: 375, align: 'right' });

  doc.moveTo(40, 78).lineTo(555, 78).strokeColor('#cbd5e1').lineWidth(1).stroke();
}

/**
 * Dibujar la tabla estadística al pie de cada página
 */
function renderStatsTable(doc, fridgesData, metricType, startY) {
  const isTemp = metricType === 'temperature';
  const unit = isTemp ? '°C' : '%';
  const title = isTemp ? 'Estadísticas Globales de Temperatura (30 Días)' : 'Estadísticas Globales de Humedad (30 Días)';

  doc.fontSize(10).fillColor('#0f172a').text(title, 40, startY);

  const headers = ['Refrigerador', 'Tiempo Fuera Rango', `Prom. Global ± σ²`, 'Lecturas (% Uptime)', `Extremas (${unit})`];
  const colWidths = [140, 100, 105, 90, 80];
  let cursorY = startY + 14;

  // Header Row
  let cursorX = 40;
  headers.forEach((h, idx) => {
    const w = colWidths[idx];
    doc.rect(cursorX, cursorY, w, 18).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').fontSize(8).text(h, cursorX + 4, cursorY + 5, { width: w - 8, align: 'left' });
    cursorX += w;
  });

  cursorY += 18;

  // Data Rows
  fridgesData.forEach((fridge) => {
    const stats = isTemp ? fridge.statsTemp : fridge.statsRH;
    const cells = [
      fridge.label,
      stats.outOfRangeHoursPerDay,
      `${stats.globalAvg}${unit} ± ${stats.variance}`,
      `${stats.totalReadings} (${stats.uptimePercentage}%)`,
      `${stats.absoluteMin} / ${stats.absoluteMax} ${unit}`
    ];

    cursorX = 40;
    cells.forEach((cell, idx) => {
      const w = colWidths[idx];
      doc.rect(cursorX, cursorY, w, 16).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#334155').fontSize(7.5).text(cell, cursorX + 4, cursorY + 4, { width: w - 8, align: 'left' });
      cursorX += w;
    });

    cursorY += 16;
  });
}

/**
 * Genera y exporta el reporte mensual en PDF (Exactamente 2 páginas)
 */
export async function exportMonthlyPdfReport(reportData) {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER', autoFirstPage: true });
  const chunks = [];

  const bufferPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const logoPath = path.join(__dirname, '../../assets/logo.png');
  const labels = reportData.fridgesData[0]?.dailySeries.map((d) => d.date.slice(5)) || [];

  // =========================================================================
  // PÁGINA 1: TEMPERATURA (30 DÍAS)
  // =========================================================================
  renderHeader(doc, reportData.metadata, logoPath);
  doc.fontSize(11).fillColor('#1e293b').text('Monitoreo Mensual de Temperatura (°C)', 40, 86);

  // Renderizar Grilla 2x2 de gráficos (4 posiciones fijas)
  const gridPositions = [
    { x: 40, y: 102 },
    { x: 300, y: 102 },
    { x: 40, y: 292 },
    { x: 300, y: 292 }
  ];

  for (let i = 0; i < Math.min(reportData.fridgesData.length, 4); i++) {
    const fridge = reportData.fridgesData[i];
    const pos = gridPositions[i];
    const maxSeries = fridge.dailySeries.map((s) => s.tempMax);
    const minSeries = fridge.dailySeries.map((s) => s.tempMin);
    const avgSeries = fridge.dailySeries.map((s) => s.tempAvg);

    const imgBuffer = await fetchChartBuffer(
      labels,
      maxSeries,
      minSeries,
      avgSeries,
      fridge.label,
      '°C',
      true,
      fridge.tempLimits
    );

    if (imgBuffer) {
      doc.image(imgBuffer, pos.x, pos.y, { width: 250, height: 170 });
    } else {
      // Fallback en cuadro vectorial si no hay conexión
      doc.rect(pos.x, pos.y, 250, 170).strokeColor('#cbd5e1').stroke();
      doc.fontSize(9).fillColor('#64748b').text(fridge.label, pos.x + 10, pos.y + 10);
    }
  }

  // Tabla Estadística al pie de Página 1
  renderStatsTable(doc, reportData.fridgesData, 'temperature', 485);

  // =========================================================================
  // PÁGINA 2: HUMEDAD RELATIVA (30 DÍAS)
  // =========================================================================
  doc.addPage({ margin: 40, size: 'LETTER' });

  renderHeader(doc, reportData.metadata, logoPath);
  doc.fontSize(11).fillColor('#1e293b').text('Monitoreo Mensual de Humedad Relativa (%RH)', 40, 86);

  for (let i = 0; i < Math.min(reportData.fridgesData.length, 4); i++) {
    const fridge = reportData.fridgesData[i];
    const pos = gridPositions[i];
    const maxSeries = fridge.dailySeries.map((s) => s.rhMax);
    const minSeries = fridge.dailySeries.map((s) => s.rhMin);
    const avgSeries = fridge.dailySeries.map((s) => s.rhAvg);

    const imgBuffer = await fetchChartBuffer(
      labels,
      maxSeries,
      minSeries,
      avgSeries,
      fridge.label,
      '%',
      false,
      fridge.rhLimits
    );

    if (imgBuffer) {
      doc.image(imgBuffer, pos.x, pos.y, { width: 250, height: 170 });
    } else {
      doc.rect(pos.x, pos.y, 250, 170).strokeColor('#cbd5e1').stroke();
      doc.fontSize(9).fillColor('#64748b').text(fridge.label, pos.x + 10, pos.y + 10);
    }
  }

  // Tabla Estadística al pie de Página 2
  renderStatsTable(doc, reportData.fridgesData, 'humidity', 485);

  doc.end();

  const buffer = await bufferPromise;
  return {
    buffer,
    filename: `Reporte_Mensual_Inmunocenter_${reportData.metadata.period.replace(/\//g, '-').replace(/\s/g, '')}.pdf`,
    contentType: 'application/pdf'
  };
}