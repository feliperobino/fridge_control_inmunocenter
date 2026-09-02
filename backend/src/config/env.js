import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
  ingestApiKey: process.env.INGEST_API_KEY || 'dev-ingest-api-key',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpFrom: process.env.SMTP_FROM || 'no-reply@fridge-monitor.local',
  timezone: process.env.TZ || 'UTC',
  ingestTimezone: process.env.INGEST_TIMEZONE || process.env.TZ || 'America/Santiago',
  readingRetentionMonths: Number(process.env.READING_RETENTION_MONTHS || 24) // <-- 2 años de logs hacia atrás
};

export default env;