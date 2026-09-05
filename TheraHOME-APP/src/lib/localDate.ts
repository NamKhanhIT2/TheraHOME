/** YYYY-MM-DD in the DEVICE's timezone. `toISOString().slice(0, 10)` is UTC,
 * which put a US user's 6 pm water log on tomorrow's row and made the
 * reminder-backfill dedupe key flip at 5 pm local (audit 2026-09-05). */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
