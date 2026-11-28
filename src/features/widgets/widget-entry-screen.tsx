import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/stores/session';

export default function WidgetEntryScreen() {
  const { ready, serverUrl, site, filters, selectFilters } = useSession();
  useEffect(() => {
    if (!ready) return;
    if (filters.length) selectFilters([]);
  }, [ready, filters.length, selectFilters]);
  if (!ready || filters.length) return null;
  return <Redirect href={serverUrl && site ? '/(tabs)/overview' : '/'} />;
}
