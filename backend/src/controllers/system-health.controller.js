import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../config/prisma.js';

const execAsync = promisify(exec);

export async function getSystemHealth(req, res, next) {
  try {
    // 1. Estadísticas de uso de memoria del proceso Node.js
    const memoryUsage = process.memoryUsage();
    const nodeMemory = {
      rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      externalMB: (memoryUsage.external / 1024 / 1024).toFixed(2),
    };

    // 2. Información del disco principal (df -h /)
    let diskUsage = null;
    try {
      const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $2 \",\" $3 \",\" $4 \",\" $5}'");
      const [size, used, avail, capacity] = stdout.trim().split(',');
      diskUsage = {
        size,
        used,
        available: avail,
        capacityPercentage: capacity,
      };
    } catch (err) {
      diskUsage = { error: 'No se pudo obtener la información del disco.' };
    }

    // 3. Métrica de retención y lecturas en PostgreSQL
    const totalReadings = await prisma.reading.count();
    const oldestReading = await prisma.reading.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });

    // Consulta raw para el tamaño aproximado de la tabla Reading en Postgres
    let tableSize = 'Desconocido';
    try {
      const result = await prisma.$queryRaw`SELECT pg_size_pretty(pg_total_relation_size('"Reading"')) as size;`;
      if (result && result.length > 0) {
        tableSize = result[0].size;
      }
    } catch (err) {
      // Ignorar si falla la consulta del tamaño de tabla
    }

    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      nodeMemory,
      diskUsage,
      database: {
        totalReadings,
        oldestReadingTimestamp: oldestReading ? oldestReading.timestamp : null,
        readingTableSize: tableSize,
      },
    });
  } catch (error) {
    next(error);
  }
}