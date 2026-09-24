const relativeFormat = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
const dateTimeFormat = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const RELATIVE_UNITS = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

// Formato YYYY-MM-DDTHH:mm en hora local, el que usa <input type="datetime-local">.
export function toLocalInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatDateTime(date) {
  return dateTimeFormat.format(date);
}

export function formatRelative(date, now = new Date()) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return 'recién';
  const [unit, size] = RELATIVE_UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds);
  return relativeFormat.format(Math.round(seconds / size), unit);
}
