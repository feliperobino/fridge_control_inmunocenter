function parseDateParts(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

const CHILE_TIME_ZONE = 'America/Santiago';

function getTimeZoneParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function getChileInstant(dateString, hour, minute, second, millisecond) {
  const parts = parseDateParts(dateString) || parseDateParts(getLocalDateString());
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond);
  let instant = desiredUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = getTimeZoneParts(new Date(instant));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      millisecond
    );
    instant += desiredUtc - actualAsUtc;
  }

  return new Date(instant);
}

export function getLocalDateString(date = new Date()) {
  const parts = getTimeZoneParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function shiftLocalDate(dateString, dayOffset) {
  const parts = parseDateParts(dateString) || parseDateParts(getLocalDateString());
  const date = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateString(date);
}

export function getLocalDayRange(dateString = getLocalDateString()) {
  const from = getChileInstant(dateString, 0, 0, 0, 0);
  const endOfDay = getChileInstant(dateString, 23, 59, 59, 999);
  const to = dateString === getLocalDateString()
    ? new Date(Math.min(endOfDay.getTime(), Date.now()))
    : endOfDay;

  return {
    fromDate: getLocalDateString(from),
    from: from.toISOString(),
    to: to.toISOString()
  };
}