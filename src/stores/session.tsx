import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { analyticsTimeZone, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { isValidAnalyticsTimeZone, type AnalyticsFilter, type AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { getSites, type Site } from '@/api/rybbit/client';
import { clearConnection, loadConnection } from '@/storage/connection';
import { clearSelectedSite, restoreSelectedSite, saveSelectedSite } from '@/storage/selected-site';

type Session = {
  ready: boolean;
  serverUrl: string | null;
  site: Site | null;
  dateRange: AnalyticsDateRange;
  timeZone: string;
  filters: readonly AnalyticsFilter[];
  analyticsContext: AnalyticsQueryContext | null;
  selectDateRange: (range: AnalyticsDateRange) => void;
  selectTimeZone: (timeZone: string) => void;
  selectFilters: (filters: readonly AnalyticsFilter[]) => void;
  selectSite: (site: Site) => Promise<void>;
  disconnect: () => Promise<void>;
  connected: (serverUrl: string) => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>({ preset: 'today' });
  const [timeZone, setTimeZone] = useState(analyticsTimeZone);
  const [filters, setFilters] = useState<readonly AnalyticsFilter[]>([]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function restore() {
      const config = await loadConnection();
      if (!active || !config?.apiKey.trim()) return;
      setServerUrl(config.baseUrl);
      const restored = await restoreSelectedSite(config.baseUrl, getSites, controller.signal);
      if (active) setSite(restored);
    }
    restore().catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; controller.abort(); };
  }, []);

  const selectSite = useCallback(async (nextSite: Site) => {
    if (!serverUrl) throw new Error('Configure your Rybbit connection first.');
    await saveSelectedSite(serverUrl, nextSite);
    setFilters([]);
    setSite(nextSite);
  }, [serverUrl]);

  async function disconnect() {
    // Keep the active connection until both local stores have been cleared.
    await clearSelectedSite();
    await clearConnection();
    setSite(null);
    setServerUrl(null);
    setFilters([]);
    setDateRange({ preset: 'today' });
  }

  function selectTimeZone(nextTimeZone: string) {
    if (!isValidAnalyticsTimeZone(nextTimeZone)) throw new Error('Choose a valid analytics timezone.');
    setTimeZone(nextTimeZone);
  }

  async function connected(url: string) {
    setSite(null);
    setDateRange({ preset: 'today' });
    setFilters([]);
    setServerUrl(url);
    await clearSelectedSite().catch(() => {});
  }

  const analyticsContext = useMemo<AnalyticsQueryContext | null>(() => serverUrl && site ? ({
    serverUrl, siteId: site.id, dateRange, timeZone, filters,
  }) : null, [dateRange, filters, serverUrl, site, timeZone]);

  return <SessionContext value={{ ready, serverUrl, site, dateRange, timeZone, filters, analyticsContext,
    selectDateRange: setDateRange, selectTimeZone, selectFilters: setFilters, selectSite, disconnect, connected }}>{children}</SessionContext>;
}

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('SessionProvider is required.');
  return session;
}
