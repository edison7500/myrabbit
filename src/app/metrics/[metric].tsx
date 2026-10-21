import { Redirect, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import MetricDetailScreen from '@/features/metrics/metric-detail-screen';
import { isMetricType, metricDefinitions } from '@/features/metrics/metric-types';

export default function MetricRoute() {
  const { metric } = useLocalSearchParams<{ metric: string }>();
  if (!metric || !isMetricType(metric)) return <Redirect href="/(tabs)/overview" />;
  return <><Stack.Screen options={{ title: metricDefinitions[metric].title }} /><MetricDetailScreen key={metric} metric={metric} /></>;
}
