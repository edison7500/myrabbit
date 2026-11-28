import type { OverviewMetric } from '@/api/rybbit/client';
import type { AnalyticsDateRange } from '@/api/rybbit/date-range';
import type { metricChange } from '@/features/overview/overview-state';

export type WidgetDateRange =
  | { preset: 'today' | 'yesterday' | 'last-7-days' | 'this-week' | 'last-30-minutes' | 'last-24-hours' }
  | Extract<AnalyticsDateRange, { preset: 'custom' }>;

export type WidgetSnapshot = {
  version: 1;
  siteId: string;
  siteDomain: string;
  reportDate: string;
  dateRange: WidgetDateRange;
  timeZone: string;
  updatedAt: number;
  metrics: {
    id: OverviewMetric;
    label: string;
    value: string;
    change: ReturnType<typeof metricChange>;
  }[];
};

export type WidgetBridge = {
  setContext: (context: string | null) => void;
  writeSnapshot: (context: string, json: string) => void;
  writeFavicon?: (context: string, domain: string, base64: string) => Promise<boolean>;
  refreshRegistration?: (context: string) => { id: string; accessGroup: string } | null;
  reloadWidget?: () => void;
};
