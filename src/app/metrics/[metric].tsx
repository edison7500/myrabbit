import { Redirect, useLocalSearchParams } from 'expo-router';
import MetricDetailScreen from '@/features/metrics/metric-detail-screen';
import { isMetricType } from '@/features/metrics/metric-types';

export default function MetricRoute() {
  const { metric } = useLocalSearchParams<{ metric: string }>();
  if (!metric || !isMetricType(metric)) return <Redirect href="/(tabs)/overview" />;
  return <MetricDetailScreen metric={metric} />;
}
