export const analyticsDatePresets = [
  'last-30-minutes',
  'last-24-hours',
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'this-week',
  'this-month',
  'this-year',
  'all-time',
] as const;

export type AnalyticsDatePreset = (typeof analyticsDatePresets)[number];
export type AnalyticsBucket = 'minute' | 'hour' | 'day' | 'week' | 'month';
export type AnalyticsDateRange =
  | { preset: AnalyticsDatePreset }
  | { preset: 'custom'; startDate: string; endDate: string };

export const analyticsDateLabels: Record<AnalyticsDatePreset | 'custom', string> = {
  'last-30-minutes': 'Last 30 Minutes',
  'last-24-hours': 'Last 24 Hours',
  today: 'Today',
  yesterday: 'Yesterday',
  'last-7-days': 'Last 7 Days',
  'last-30-days': 'Last 30 Days',
  'this-week': 'This Week',
  'this-month': 'This Month',
  'this-year': 'This Year',
  'all-time': 'All Time',
  custom: 'Custom Range',
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function zonedDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function endOfMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function analyticsTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidCustomRange(startDate: string, endDate: string) {
  if (!isoDatePattern.test(startDate) || !isoDatePattern.test(endDate) || startDate > endDate) return false;
  const validDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  };
  return validDate(startDate) && validDate(endDate);
}

export function buildAnalyticsQuery(range: AnalyticsDateRange, timeZone: string, now = new Date()) {
  const query = new URLSearchParams({ time_zone: timeZone });
  if (range.preset === 'custom') {
    if (!isValidCustomRange(range.startDate, range.endDate)) throw new Error('Choose a valid start and end date.');
    query.set('start_date', range.startDate);
    query.set('end_date', range.endDate);
    return query;
  }
  if (range.preset === 'last-30-minutes' || range.preset === 'last-24-hours') {
    query.set('past_minutes_start', range.preset === 'last-30-minutes' ? '30' : '1440');
    query.set('past_minutes_end', '0');
    return query;
  }
  if (range.preset === 'all-time') {
    query.set('start_date', '');
    query.set('end_date', '');
    return query;
  }

  const today = zonedDate(now, timeZone);
  let startDate = today;
  let endDate = today;
  switch (range.preset) {
    case 'yesterday':
      startDate = endDate = shiftDate(today, -1);
      break;
    case 'last-7-days':
      startDate = shiftDate(today, -6);
      break;
    case 'last-30-days':
      startDate = shiftDate(today, -29);
      break;
    case 'this-week': {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      startDate = shiftDate(today, -(weekday === 0 ? 6 : weekday - 1));
      endDate = shiftDate(startDate, 6);
      break;
    }
    case 'this-month':
      startDate = `${today.slice(0, 8)}01`;
      endDate = endOfMonth(today);
      break;
    case 'this-year':
      startDate = `${today.slice(0, 4)}-01-01`;
      endDate = `${today.slice(0, 4)}-12-31`;
      break;
    case 'today':
      break;
  }
  query.set('start_date', startDate);
  query.set('end_date', endDate);
  return query;
}

export function buildPreviousAnalyticsQuery(range: AnalyticsDateRange, timeZone: string, now = new Date()) {
  const current = buildAnalyticsQuery(range, timeZone, now);
  if (range.preset === 'all-time') return null;
  const query = new URLSearchParams({ time_zone: timeZone });
  const pastMinutes = Number(current.get('past_minutes_start'));
  if (pastMinutes) {
    query.set('past_minutes_start', String(pastMinutes * 2));
    query.set('past_minutes_end', String(pastMinutes));
    return query;
  }

  const startDate = current.get('start_date')!;
  const endDate = current.get('end_date')!;
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
  query.set('start_date', shiftDate(startDate, -days));
  query.set('end_date', shiftDate(startDate, -1));
  return query;
}

export function dateRangeLabel(range: AnalyticsDateRange) {
  return range.preset === 'custom' ? `${range.startDate} – ${range.endDate}` : analyticsDateLabels[range.preset];
}

export function analyticsBucket(range: AnalyticsDateRange): AnalyticsBucket {
  if (range.preset === 'last-30-minutes') return 'minute';
  if (range.preset === 'today' || range.preset === 'yesterday' || range.preset === 'last-24-hours') return 'hour';
  if (range.preset === 'this-year') return 'month';
  if (range.preset !== 'custom') return 'day';
  const start = Date.parse(`${range.startDate}T00:00:00Z`);
  const end = Date.parse(`${range.endDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days > 180) return 'month';
  if (days > 31) return 'week';
  return 'day';
}
