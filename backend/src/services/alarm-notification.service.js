import prisma from '../config/prisma.js';
import { sendEmail } from './mailer.service.js';

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Santiago'
  }).format(new Date(value));
}

function getAlarmDetails(alarmType, fridge, reading) {
  const details = {
    TEMP_HIGH: ['Temperatura', reading.temperature, `${fridge.tempMin} a ${fridge.tempMax} °C`],
    TEMP_LOW: ['Temperatura', reading.temperature, `${fridge.tempMin} a ${fridge.tempMax} °C`],
    HUM_HIGH: ['Humedad', reading.humidity, `${fridge.humMin} a ${fridge.humMax} %`],
    HUM_LOW: ['Humedad', reading.humidity, `${fridge.humMin} a ${fridge.humMax} %`]
  };

  return details[alarmType] || ['Desconocida', 'N/D', 'N/D'];
}

export async function notifyAlarmCreated({ alarm, fridge, reading }) {
  const recipients = await prisma.alarmRecipient.findMany({
    where: { active: true },
    select: { email: true }
  });

  if (recipients.length === 0) {
    return { sent: false, reason: 'no-active-recipients' };
  }

  const [variable, value, allowedRange] = getAlarmDetails(alarm.type, fridge, reading);
  const durationMinutes = Math.max(0, Math.round((new Date(reading.receivedAt).getTime() - new Date(alarm.startedAt).getTime()) / 60000));

  await sendEmail({
    to: recipients.map(({ email }) => email),
    subject: `[Alarma] ${fridge.name} - ${variable}`,
    text: [
      'Se generó una nueva alarma en Fridge Monitor.',
      '',
      `Refrigerador: ${fridge.name}`,
      `Ubicación: ${fridge.location || 'No especificada'}`,
      `Variable: ${variable}`,
      `Valor: ${value}`,
      `Rango permitido: ${allowedRange}`,
      `Fecha/hora: ${formatDateTime(reading.recordedAt)}`,
      `Sostenimiento detectado: ${durationMinutes} minutos`,
      `Tipo: ${alarm.type}`,
      `ID de alarma: ${alarm.id}`
    ].join('\n')
  });

  return { sent: true };
}