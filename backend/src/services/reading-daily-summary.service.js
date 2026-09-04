import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

export async function updateReadingDailySummary({ fridge, temperature, humidity, recordedAt }) {
  const day = new Date(Date.UTC(
    recordedAt.getUTCFullYear(),
    recordedAt.getUTCMonth(),
    recordedAt.getUTCDate()
  ));
  const hourMask = 1 << recordedAt.getUTCHours();
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