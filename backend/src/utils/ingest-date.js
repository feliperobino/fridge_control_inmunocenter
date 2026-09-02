const LOCAL_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

function getTimeZoneOffsetMs(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const displayedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return displayedAsUtc - timestamp;
}

export function parseLoggerLocalDate(value, timeZone) {
  const match = LOCAL_DATE_PATTERN.exec(value || '');
  if (!match) return null;

  const [, day, month, year, hours, minutes, seconds] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds)
  );

  const normalized = new Date(localAsUtc);
  if (
    normalized.getUTCFullYear() !== Number(year) ||
    normalized.getUTCMonth() !== Number(month) - 1 ||
    normalized.getUTCDate() !== Number(day) ||
    normalized.getUTCHours() !== Number(hours) ||
    normalized.getUTCMinutes() !== Number(minutes) ||
    normalized.getUTCSeconds() !== Number(seconds)
  ) {
    return null;
  }

  // Recalculate after applying the first offset so DST transitions are handled.
  const firstGuess = localAsUtc - getTimeZoneOffsetMs(localAsUtc, timeZone);
  const timestamp = localAsUtc - getTimeZoneOffsetMs(firstGuess, timeZone);
  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}