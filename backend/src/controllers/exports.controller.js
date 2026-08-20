import {
  exportReadingsToCsv,
  exportReadingsToPdf,
  exportReadingsToXlsx
} from '../services/export.service.js';

function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function normalizeFridgeId(value) {
  if (!value || value === 'all') {
    return 'all';
  }

  return value;
}

export async function exportReadings(req, res) {
  const { format = 'csv', fridgeId = 'all', from, to } = req.query || {};

  if (!isValidDate(from) || !isValidDate(to)) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  try {
    const normalizedFridgeId = normalizeFridgeId(fridgeId);
    let result;

    if (format === 'xlsx') {
      result = await exportReadingsToXlsx(normalizedFridgeId, from, to);
    } else if (format === 'pdf') {
      result = await exportReadingsToPdf(normalizedFridgeId, from, to);
    } else {
      result = await exportReadingsToCsv(normalizedFridgeId, from, to);
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  } catch (error) {
    // Log the error for debugging tests
    // eslint-disable-next-line no-console
    console.error('Export error:', error);
    if (error?.message === 'Invalid date') {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    return res.status(500).json({ error: 'Export failed' });
  }
}