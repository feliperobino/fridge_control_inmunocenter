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

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftLocalDate(dateString, dayOffset) {
  const parts = parseDateParts(dateString) || parseDateParts(getLocalDateString());
  const date = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateString(date);
}

export function getLocalDayRange(dateString = getLocalDateString()) {
  const parts = parseDateParts(dateString) || parseDateParts(getLocalDateString());
  const from = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  const to = new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);

  return {
    fromDate: getLocalDateString(from),
    from: from.toISOString(),
    to: to.toISOString()
  };
}