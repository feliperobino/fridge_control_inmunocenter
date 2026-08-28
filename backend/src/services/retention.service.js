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
      const retentionMonths = env.readingRetentionMonths;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

      const result = await prisma.reading.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      // eslint-disable-next-line no-console
      console.log(`[retention] Borradas ${result.count} lecturas anteriores a ${cutoffDate.toISOString()}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[retention] Error durante el proceso de limpieza de lecturas:', error);
    }
  });

  // eslint-disable-next-line no-console
  console.log(`Retention scheduler initialized (Retención: ${env.readingRetentionMonths} meses)`);
}