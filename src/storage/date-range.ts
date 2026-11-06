import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsDatePresets, isValidCustomRange, type AnalyticsDateRange } from '@/api/rybbit/date-range';

const dateRangeKey = 'myrabbit.date-range.v1';
let pendingSave = Promise.resolve();

function parseDateRange(value: unknown): AnalyticsDateRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const range = value as Record<string, unknown>;
  if (range.preset === 'custom') {
    return typeof range.startDate === 'string' && typeof range.endDate === 'string' &&
      isValidCustomRange(range.startDate, range.endDate)
      ? { preset: 'custom', startDate: range.startDate, endDate: range.endDate }
      : null;
  }
  const preset = analyticsDatePresets.find(preset => preset === range.preset);
  return preset ? { preset } : null;
}

export async function loadDateRange(): Promise<AnalyticsDateRange> {
  const value = await AsyncStorage.getItem(dateRangeKey);
  try {
    return value ? parseDateRange(JSON.parse(value)) ?? { preset: 'today' } : { preset: 'today' };
  } catch {
    return { preset: 'today' };
  }
}

export function saveDateRange(range: AnalyticsDateRange): Promise<void> {
  const parsed = parseDateRange(range);
  if (!parsed) return Promise.reject(new Error('Choose a valid analytics date range.'));
  const value = JSON.stringify(parsed);
  // Keep rapid selections in order even when storage writes finish slowly.
  const save = pendingSave.then(() => AsyncStorage.setItem(dateRangeKey, value));
  pendingSave = save.catch(() => {});
  return save;
}
