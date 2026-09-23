import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

export async function updateReadingDailySummary({ fridge, temperature, humidity, recordedAt }) {
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(recordedAt);
  const values = Object.fromEntries(
    localParts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
  );
  const day = new Date(Date.UTC(values.year, values.month - 1, values.day));
  const hourMask = 1 << values.hour;
  const temperatureOut = temperature < fridge.tempMin || temperature > fridge.tempMax ? 1 : 0;
  const humidityOut = humidity < fridge.humMin || humidity > fridge.humMax ? 1 : 0;

  await prisma.$executeRaw`
    INSERT INTO "ReadingDailySummary" (
      "id", "fridgeId", "day", "readingCount",
      "temperatureSum", "temperatureSumSq", "temperatureMin", "temperatureMax", "temperatureOutCount",
      "humiditySum", "humiditySumSq", "humidityMin", "humidityMax", "humidityOutCount",
      "hoursMask", "createdAt", "updatedAt"
    ) VALUES (
      ${crypto.randomUUID()}, ${fridge.id}, ${day}, 1,
      ${temperature}, ${temperature * temperature}, ${temperature}, ${temperature}, ${temperatureOut},
      ${humidity}, ${humidity * humidity}, ${humidity}, ${humidity}, ${humidityOut},
      ${hourMask}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("fridgeId", "day") DO UPDATE SET
      "readingCount" = "ReadingDailySummary"."readingCount" + 1,
      "temperatureSum" = "ReadingDailySummary"."temperatureSum" + EXCLUDED."temperatureSum",
      "temperatureSumSq" = "ReadingDailySummary"."temperatureSumSq" + EXCLUDED."temperatureSumSq",
      "temperatureMin" = LEAST("ReadingDailySummary"."temperatureMin", EXCLUDED."temperatureMin"),
      "temperatureMax" = GREATEST("ReadingDailySummary"."temperatureMax", EXCLUDED."temperatureMax"),
      "temperatureOutCount" = "ReadingDailySummary"."temperatureOutCount" + EXCLUDED."temperatureOutCount",
      "humiditySum" = "ReadingDailySummary"."humiditySum" + EXCLUDED."humiditySum",
      "humiditySumSq" = "ReadingDailySummary"."humiditySumSq" + EXCLUDED."humiditySumSq",
      "humidityMin" = LEAST("ReadingDailySummary"."humidityMin", EXCLUDED."humidityMin"),
      "humidityMax" = GREATEST("ReadingDailySummary"."humidityMax", EXCLUDED."humidityMax"),
      "humidityOutCount" = "ReadingDailySummary"."humidityOutCount" + EXCLUDED."humidityOutCount",
      "hoursMask" = "ReadingDailySummary"."hoursMask" | EXCLUDED."hoursMask",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}