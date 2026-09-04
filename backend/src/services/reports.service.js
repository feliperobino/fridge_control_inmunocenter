import prisma from '../config/prisma.js';

function countBits(value) {
  let count = 0;
  for (let bits = value; bits > 0; bits >>= 1) count += bits & 1;
  return count;
}

function round(value, decimals = 1) {
  return Number(value.toFixed(decimals));
}

/**
 * Obtiene y procesa los datos agregados de los últimos 30 días para todos los refrigeradores.
 * @param {Date} [endDate=new Date()] Fecha de fin para el reporte (por defecto la fecha actual).
 */
export async function getMonthlyReportData(endDate = new Date()) {
  const to = new Date(endDate);
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  const [fridges, summaries] = await Promise.all([
    prisma.fridge.findMany({ orderBy: { modbusSlaveId: 'asc' } }),
    prisma.readingDailySummary.findMany({
      where: { day: { gte: from, lte: to } },
      orderBy: [{ fridgeId: 'asc' }, { day: 'asc' }]
    })
  ]);

  const fridgesData = fridges.map((fridge) => {
    const fridgeSummaries = summaries.filter((summary) => summary.fridgeId === fridge.id);
    const dailyMap = new Map(
      fridgeSummaries.map((summary) => [summary.day.toISOString().slice(0, 10), summary])
    );
    const readingCount = fridgeSummaries.reduce((sum, summary) => sum + summary.readingCount, 0);
    const temperatureSum = fridgeSummaries.reduce((sum, summary) => sum + summary.temperatureSum, 0);
    const humiditySum = fridgeSummaries.reduce((sum, summary) => sum + summary.humiditySum, 0);
    const temperatureSumSq = fridgeSummaries.reduce((sum, summary) => sum + summary.temperatureSumSq, 0);
    const humiditySumSq = fridgeSummaries.reduce((sum, summary) => sum + summary.humiditySumSq, 0);
    const temperatureAvg = readingCount > 0 ? temperatureSum / readingCount : 0;
    const humidityAvg = readingCount > 0 ? humiditySum / readingCount : 0;
    const temperatureVariance = readingCount > 0
      ? Math.max(0, temperatureSumSq / readingCount - temperatureAvg ** 2)
      : 0;
    const humidityVariance = readingCount > 0
      ? Math.max(0, humiditySumSq / readingCount - humidityAvg ** 2)
      : 0;
    const temperatureOutCount = fridgeSummaries.reduce((sum, summary) => sum + summary.temperatureOutCount, 0);
    const humidityOutCount = fridgeSummaries.reduce((sum, summary) => sum + summary.humidityOutCount, 0);
    const daysOnline = fridgeSummaries.filter((summary) => countBits(summary.hoursMask) >= 20).length;
    const uptimePercentage = (daysOnline / 30) * 100;

    const dailySeries = [];
    for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const summary = dailyMap.get(date);

      dailySeries.push(summary
        ? {
            date,
            tempMax: round(summary.temperatureMax),
            tempMin: round(summary.temperatureMin),
            tempAvg: round(summary.temperatureSum / summary.readingCount),
            rhMax: round(summary.humidityMax),
            rhMin: round(summary.humidityMin),
            rhAvg: round(summary.humiditySum / summary.readingCount)
          }
        : {
            date,
            tempMax: null,
            tempMin: null,
            tempAvg: null,
            rhMax: null,
            rhMin: null,
            rhAvg: null
          });
    }

    const temperatureMax = readingCount > 0
      ? Math.max(...fridgeSummaries.map((summary) => summary.temperatureMax))
      : 0;
    const temperatureMin = readingCount > 0
      ? Math.min(...fridgeSummaries.map((summary) => summary.temperatureMin))
      : 0;
    const humidityMax = readingCount > 0
      ? Math.max(...fridgeSummaries.map((summary) => summary.humidityMax))
      : 0;
    const humidityMin = readingCount > 0
      ? Math.min(...fridgeSummaries.map((summary) => summary.humidityMin))
      : 0;

    return {
      id: fridge.id,
      label: `${fridge.name} (Slave #${fridge.modbusSlaveId})`,
      modbusSlaveId: fridge.modbusSlaveId,
      tempLimits: { min: fridge.tempMin, max: fridge.tempMax },
      rhLimits: { min: fridge.humMin, max: fridge.humMax },
      dailySeries,
      statsTemp: {
        outOfRangeHoursPerDay: `${(readingCount > 0 ? (temperatureOutCount / readingCount) * 24 : 0).toFixed(1)} h/día`,
        globalAvg: round(temperatureAvg),
        variance: round(temperatureVariance, 2),
        totalReadings: readingCount,
        uptimePercentage: round(uptimePercentage),
        absoluteMax: temperatureMax,
        absoluteMin: temperatureMin
      },
      statsRH: {
        outOfRangeHoursPerDay: `${(readingCount > 0 ? (humidityOutCount / readingCount) * 24 : 0).toFixed(1)} h/día`,
        globalAvg: round(humidityAvg),
        variance: round(humidityVariance, 2),
        totalReadings: readingCount,
        uptimePercentage: round(uptimePercentage),
        absoluteMax: humidityMax,
        absoluteMin: humidityMin
      }
    };
  });

  const formatDate = (date) => date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return {
    metadata: {
      title: 'Inmunocenter - Reporte de temperatura y humedad Refrigeradores',
      subtitle: 'Guardia Vieja 155 of 1206',
      generatedAt: formatDate(new Date()),
      period: `${formatDate(from)} - ${formatDate(to)}`
    },
    fridgesData
  };
}
