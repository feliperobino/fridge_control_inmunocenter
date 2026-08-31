import cron from 'node-cron';
import prisma from '../config/prisma.js';
import env from '../config/env.js';

/**
 * Inicia el cronjob diario de purga/retención de lecturas.
 */
export function initRetentionScheduler() {
  // Se ejecuta todos los días a las 3:00 AM ('0 3 * * *')
  cron.schedule('0 3 * * *', async () => {
    try {
      // Forzar parseo a entero con valor por defecto de resguardo (6 meses)
      const retentionMonths = parseInt(env.readingRetentionMonths, 10) || 6;
      
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

      // Verificación de seguridad para evitar "Invalid Date"
      if (isNaN(cutoffDate.getTime())) {
        console.error('[retention] La fecha límite calculada no es válida. Proceso abortado.');
        return;
      }

      const result = await prisma.reading.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`[retention] Borradas ${result.count} lecturas anteriores a ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('[retention] Error durante el proceso de limpieza de lecturas:', error);
    }
  });

  const parsedMonths = parseInt(env.readingRetentionMonths, 10) || 6;
  console.log(`Retention scheduler initialized (Retención: ${parsedMonths} meses)`);
}