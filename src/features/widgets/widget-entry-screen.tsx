import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/stores/session';

export default function WidgetEntryScreen() {
  const { ready, serverUrl, site, dateRange, filters, selectDateRange, selectFilters } = useSession();
  useEffect(() => {
    if (!ready) return;
    if (dateRange.preset !== 'today') selectDateRange({ preset: 'today' });
    if (filters.length) selectFilters([]);
  }, [ready, dateRange.preset, filters.length, selectDateRange, selectFilters]);
  if (!ready || dateRange.preset !== 'today' || filters.length) return null;
  return <Redirect href={serverUrl && site ? '/(tabs)/overview' : '/'} />;
}
