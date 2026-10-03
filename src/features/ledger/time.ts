const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function bangkokDayBounds(date = new Date()) {
  const { year, month, day } = bangkokParts(date);
  const start = new Date(Date.UTC(year, month - 1, day) - BANGKOK_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function bangkokMonthBounds(date = new Date()) {
  const { year, month } = bangkokParts(date);
  const start = new Date(Date.UTC(year, month - 1, 1) - BANGKOK_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, 1) - BANGKOK_OFFSET_MS);
  return { start, end };
}
