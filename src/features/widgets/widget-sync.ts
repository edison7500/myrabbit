import { getOverview, getPreviousOverview, type Overview, type Site } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { getFavicon, getWebsiteFavicon } from '@/api/rybbit/favicon';
import { saveWidgetRefreshCredential, widgetBridge } from './native-widget';
import { createWidgetSnapshot, isWidgetReportingContext, widgetContextKey, widgetReportDate } from './widget-snapshot';

let activeContext: string | null = null;
let revision = 0;
let requestSequence = 0;
let savedFavicon: string | undefined;
let faviconRequest: AbortController | undefined;
let registeredRevision: number | undefined;

export function setWidgetContext(serverUrl: string | null, site: Site | null, timeZone: string) {
  const next = serverUrl && site ? widgetContextKey(serverUrl, site.id, timeZone) : null;
  activeContext = next;
  revision++;
  savedFavicon = undefined;
  faviconRequest?.abort();
  faviconRequest = undefined;
  try { widgetBridge?.setContext(next); } catch {
    // Widget storage is optional. Invalidate pending app writes even if the
    // shared container is temporarily unavailable, and retry on the next sync.
  }
}

export function currentWidgetRevision() { return revision; }

async function registerWidgetRefresh(context: string, serverUrl: string, version: number) {
  if (!widgetBridge?.refreshRegistration || registeredRevision === version) return;
  registeredRevision = version;
  try {
    const saved = await saveWidgetRefreshCredential(context, serverUrl, () => revision === version && activeContext === context);
    if (!saved && registeredRevision === version) registeredRevision = undefined;
  } catch {
    // Analytics and the existing snapshot remain available if Keychain sharing fails.
    if (registeredRevision === version) registeredRevision = undefined;
  }
}

async function syncFavicon(contextKey: string, serverUrl: string, domain: string, version: number) {
  if (!widgetBridge?.writeFavicon || !domain || savedFavicon === domain || faviconRequest) return;
  const controller = new AbortController();
  faviconRequest = controller;
  try {
    const { signal } = controller;
    const isCurrent = () => !signal.aborted && revision === version;
    const writeFavicon = widgetBridge.writeFavicon;
    const save = (uri: string) => writeFavicon.call(widgetBridge, contextKey, domain, uri.slice(uri.indexOf(',') + 1));
    const serverIcon = await getFavicon(serverUrl, domain, signal).catch(() => null);
    if (!isCurrent()) return;
    let stored = serverIcon !== null && await save(serverIcon);
    if (!stored && isCurrent()) {
      const websiteIcon = await getWebsiteFavicon(domain, signal);
      if (isCurrent()) stored = await save(websiteIcon);
    }
    if (stored && isCurrent()) savedFavicon = domain;
  } catch {
    // The site's metrics and any previous icon remain available.
  } finally {
    if (faviconRequest === controller) faviconRequest = undefined;
  }
}

type DashboardResult = {
  context: AnalyticsQueryContext;
  site: Site;
  overview: Overview;
  previous: Overview | null;
  requestedAt: number;
  updatedAt: number;
  signal: AbortSignal;
  widgetRevision: number;
};

// This is deliberately best effort: widget storage must not turn a successful
// Dashboard request into a network error, or discard a previous good snapshot.
export async function syncDashboardWidget(result: DashboardResult) {
  if (!widgetBridge) return;
  const { context, site, signal } = result;
  const key = widgetContextKey(context.serverUrl, context.siteId, context.timeZone);
  const version = result.widgetRevision;
  if (activeContext !== key || revision !== version || signal.aborted) return;
  const sequence = ++requestSequence;
  const isCurrent = () => !signal.aborted && revision === version && activeContext === key && sequence === requestSequence;
  try {
    let { overview, previous, updatedAt } = result;
    let reportDate = widgetReportDate(context.timeZone, new Date(result.requestedAt));
    const today = widgetReportDate(context.timeZone, new Date());
    // Other Dashboard ranges and filters must never be labeled Today in a widget.
    // Reuse the existing API client with a pinned calendar day for both requests.
    if (!isWidgetReportingContext(context) || reportDate !== today) {
      reportDate = today;
      const widgetQuery: AnalyticsQueryContext = {
        ...context, filters: [], dateRange: { preset: 'custom', startDate: today, endDate: today },
      };
      const [currentResult, priorResult] = await Promise.allSettled([
        getOverview(widgetQuery, signal), getPreviousOverview(widgetQuery, signal),
      ]);
      if (currentResult.status !== 'fulfilled') return;
      overview = currentResult.value;
      previous = priorResult.status === 'fulfilled' ? priorResult.value : null;
      updatedAt = Date.now();
    }
    if (!isCurrent()) return;
    const snapshot = createWidgetSnapshot({ ...context, filters: [], dateRange: { preset: 'today' } }, site, overview, previous, updatedAt, reportDate);
    if (snapshot) {
      widgetBridge.setContext(key);
      widgetBridge.writeSnapshot(key, JSON.stringify(snapshot));
      void registerWidgetRefresh(key, context.serverUrl, version);
      void syncFavicon(key, context.serverUrl, site.domain.trim(), version);
    }
  } catch {
    // Preserve the cached snapshot on API, cancellation, or shared-container failure.
  }
}
