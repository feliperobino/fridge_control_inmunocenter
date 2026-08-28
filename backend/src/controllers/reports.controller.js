import { getMonthlyReportData } from '../services/reports.service.js';
import { exportMonthlyPdfReport } from '../services/export.service.js';

export async function downloadMonthlyPdfReport(req, res) {
  try {
    const reportData = await getMonthlyReportData();
    const { buffer, filename, contentType } = await exportMonthlyPdfReport(reportData);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error al generar reporte PDF mensual:', error);
    return res.status(500).json({ error: 'Error al generar el reporte mensual en PDF' });
  }
}