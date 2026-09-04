-- CreateTable
CREATE TABLE "ReadingDailySummary" (
    "id" TEXT NOT NULL,
    "fridgeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "readingCount" INTEGER NOT NULL DEFAULT 0,
    "temperatureSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temperatureSumSq" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temperatureMin" DOUBLE PRECISION NOT NULL,
    "temperatureMax" DOUBLE PRECISION NOT NULL,
    "temperatureOutCount" INTEGER NOT NULL DEFAULT 0,
    "humiditySum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "humiditySumSq" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "humidityMin" DOUBLE PRECISION NOT NULL,
    "humidityMax" DOUBLE PRECISION NOT NULL,
    "humidityOutCount" INTEGER NOT NULL DEFAULT 0,
    "hoursMask" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingDailySummary_pkey" PRIMARY KEY ("id")
);

-- Backfill summaries before the application starts writing new ones.
INSERT INTO "ReadingDailySummary" (
    "id", "fridgeId", "day", "readingCount",
    "temperatureSum", "temperatureSumSq", "temperatureMin", "temperatureMax", "temperatureOutCount",
    "humiditySum", "humiditySumSq", "humidityMin", "humidityMax", "humidityOutCount",
    "hoursMask", "createdAt", "updatedAt"
)
SELECT
    md5(r."fridgeId" || r."recordedAt"::date::text),
    r."fridgeId",
    r."recordedAt"::date,
    COUNT(*)::integer,
    SUM(r."temperature"),
    SUM(r."temperature" * r."temperature"),
    MIN(r."temperature"),
    MAX(r."temperature"),
    COUNT(*) FILTER (WHERE r."temperature" < f."tempMin" OR r."temperature" > f."tempMax")::integer,
    SUM(r."humidity"),
    SUM(r."humidity" * r."humidity"),
    MIN(r."humidity"),
    MAX(r."humidity"),
    COUNT(*) FILTER (WHERE r."humidity" < f."humMin" OR r."humidity" > f."humMax")::integer,
    bit_or(1 << EXTRACT(HOUR FROM r."recordedAt")::integer),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Reading" r
JOIN "Fridge" f ON f."id" = r."fridgeId"
GROUP BY r."fridgeId", r."recordedAt"::date;

-- CreateIndex
CREATE UNIQUE INDEX "ReadingDailySummary_fridgeId_day_key" ON "ReadingDailySummary"("fridgeId", "day");
CREATE INDEX "ReadingDailySummary_day_idx" ON "ReadingDailySummary"("day");

-- AddForeignKey
ALTER TABLE "ReadingDailySummary" ADD CONSTRAINT "ReadingDailySummary_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
