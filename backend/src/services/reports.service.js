import prisma from '../config/prisma.js';

/**
 * Obtiene y procesa los datos agregados de los últimos 30 días para todos los refrigeradores.
 * @param {Date} [endDate=new Date()] Fecha de fin para el reporte (por defecto la fecha actual).
 */
export async function getMonthlyReportData(endDate = new Date()) {
  const to = new Date(endDate);
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  // 1. Obtener todos los refrigeradores activos con sus configuraciones
  const fridges = await prisma.fridge.findMany({
    orderBy: { modbusSlaveId: 'asc' }
  });

  // 2. Obtener todas las lecturas en el rango de 30 días
  const readings = await prisma.reading.findMany({
    where: {
      recordedAt: {
        gte: from,
        lte: to
      }
    },
    orderBy: { recordedAt: 'asc' }
  });

  // 3. Agrupar lecturas por refrigerador
  const fridgesData = fridges.map((fridge) => {
    const fridgeReadings = readings.filter((r) => r.fridgeId === fridge.id);

    // Agrupar por fechaYYYY-MM-DD
    const dailyMap = new Map();

    fridgeReadings.forEach((r) => {
      const dateStr = r.recordedAt.toISOString().split('T')[0];
      const hour = r.recordedAt.getHours();

      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          date: dateStr,
          temps: [],
          rhs: [],
          hoursSet: new Set()
        });
      }

      const dayData = dailyMap.get(dateStr);
      if (r.temperature != null) dayData.temps.push(Number(r.temperature));
      if (r.humidity != null) dayData.rhs.push(Number(r.humidity));
      dayData.hoursSet.add(hour);
    });

    // Construir la serie temporal diaria (30 días)
    const dailySeries = [];
    let daysOnline = 0;

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateStr);

      if (dayData && dayData.temps.length > 0) {
        const tMax = Math.max(...dayData.temps);
        const tMin = Math.min(...dayData.temps);
        const tAvg = dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length;

        const rhMax = dayData.rhs.length > 0 ? Math.max(...dayData.rhs) : 0;
        const rhMin = dayData.rhs.length > 0 ? Math.min(...dayData.rhs) : 0;
        const rhAvg = dayData.rhs.length > 0 ? dayData.rhs.reduce((a, b) => a + b, 0) / dayData.rhs.length : 0;

        dailySeries.push({
          date: dateStr,
          tempMax: Number(tMax.toFixed(1)),
          tempMin: Number(tMin.toFixed(1)),
          tempAvg: Number(tAvg.toFixed(1)),
          rhMax: Number(rhMax.toFixed(1)),
          rhMin: Number(rhMin.toFixed(1)),
          rhAvg: Number(rhAvg.toFixed(1))
        });

        // Día online si registró lecturas en al menos 20 horas distintas
        if (dayData.hoursSet.size >= 20) {
          daysOnline++;
        }
      } else {
        dailySeries.push({
          date: dateStr,
          tempMax: null,
          tempMin: null,
          tempAvg: null,
          rhMax: null,
          rhMin: null,
          rhAvg: null
        });
      }
    }

    // Cálculos globales de temperatura
    const allTemps = fridgeReadings.map((r) => Number(r.temperature)).filter((t) => !isNaN(t));
    const globalTempAvg = allTemps.length > 0 ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : 0;
    const tempVariance = allTemps.length > 0 
      ? allTemps.reduce((acc, t) => acc + Math.pow(t - globalTempAvg, 2), 0) / allTemps.length 
      : 0;

    // Horas fuera de rango usando los límites configurados del refrigerador.
    const outOfRangeTempReadings = allTemps.filter((t) => t < fridge.tempMin || t > fridge.tempMax);
    // Estimación en horas/día considerando lecturas periódicas
    const hoursOutOfRangeTemp = allTemps.length > 0 
      ? ((outOfRangeTempReadings.length / allTemps.length) * 24).toFixed(1) 
      : '0.0';

    // Cálculos globales de humedad
    const allRHs = fridgeReadings.map((r) => Number(r.humidity)).filter((h) => !isNaN(h));
    const globalRHAvg = allRHs.length > 0 ? allRHs.reduce((a, b) => a + b, 0) / allRHs.length : 0;
    const rhVariance = allRHs.length > 0 
      ? allRHs.reduce((acc, h) => acc + Math.pow(h - globalRHAvg, 2), 0) / allRHs.length 
      : 0;

    const outOfRangeRHReadings = allRHs.filter((h) => h < fridge.humMin || h > fridge.humMax);
    const hoursOutOfRangeRH = allRHs.length > 0 
      ? ((outOfRangeRHReadings.length / allRHs.length) * 24).toFixed(1) 
      : '0.0';

    const uptimePercentage = ((daysOnline / 30) * 100).toFixed(1);

    return {
      id: fridge.id,
      label: `${fridge.name} (Slave #${fridge.modbusSlaveId})`,
      modbusSlaveId: fridge.modbusSlaveId,
      tempLimits: { min: fridge.tempMin, max: fridge.tempMax },
      rhLimits: { min: fridge.humMin, max: fridge.humMax },
      dailySeries,
      statsTemp: {
        outOfRangeHoursPerDay: `${hoursOutOfRangeTemp} h/día`,
        globalAvg: Number(globalTempAvg.toFixed(1)),
        variance: Number(tempVariance.toFixed(2)),
        totalReadings: allTemps.length,
        uptimePercentage: Number(uptimePercentage),
        absoluteMax: allTemps.length > 0 ? Math.max(...allTemps) : 0,
        absoluteMin: allTemps.length > 0 ? Math.min(...allTemps) : 0
      },
      statsRH: {
        outOfRangeHoursPerDay: `${hoursOutOfRangeRH} h/día`,
        globalAvg: Number(globalRHAvg.toFixed(1)),
        variance: Number(rhVariance.toFixed(2)),
        totalReadings: allRHs.length,
        uptimePercentage: Number(uptimePercentage),
        absoluteMax: allRHs.length > 0 ? Math.max(...allRHs) : 0,
        absoluteMin: allRHs.length > 0 ? Math.min(...allRHs) : 0
      }
    };
  });

  const formatDate = (date) => date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

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