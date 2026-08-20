import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../config/prisma.js';

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