import 'dotenv/config';
import app from './app.js';
import { reloadReportSchedules } from './services/report-scheduler.service.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // attempt a DB connection early to surface Prisma/DB errors
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('Prisma connected successfully');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Prisma failed to connect at startup', err && (err.stack || err.message || err));
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
    reloadReportSchedules().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load report schedules', error);
    });
  });
}

start();
