import type { OverviewMetric } from '@/api/rybbit/client';
import type { metricChange } from '@/features/overview/overview-state';

export type WidgetSnapshot = {
  version: 1;
  siteId: string;
  siteDomain: string;
  reportDate: string;
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
};
