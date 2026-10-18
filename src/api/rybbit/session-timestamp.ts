// Rybbit's ClickHouse sessions return SQL timestamps in UTC without a zone.
// Normalize at the API boundary so display and activity checks use the same instant.
export function normalizeSessionTimestamp(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected session timestamp from Rybbit.');
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/i.exec(value.trim());
  if (!match) throw new Error('Unexpected session timestamp from Rybbit.');
  const [, year, month, day, hour, minute, second, fraction = '', zone = 'Z'] = match;
  const monthEnd = new Date(0);
  monthEnd.setUTCFullYear(Number(year), Number(month), 0);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > monthEnd.getUTCDate() ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error('Unexpected session timestamp from Rybbit.');
  }
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction.slice(0, 4)}${zone.toUpperCase()}`);
  if (!Number.isFinite(timestamp)) throw new Error('Unexpected session timestamp from Rybbit.');
  return new Date(timestamp).toISOString();
}
