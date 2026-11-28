import { getOverview, getPreviousOverview, type Overview, type Site } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { buildAnalyticsQuery, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { getFavicon, getWebsiteFavicon } from '@/api/rybbit/favicon';
import { saveWidgetRefreshCredential, widgetBridge } from './native-widget';
import { createWidgetSnapshot, sameDateRange, widgetContextKey, widgetDateRange, widgetReportDate } from './widget-snapshot';
import type { WidgetDateRange } from './widget-types';

let activeContext: string | null = null;
let selectedDateRange: WidgetDateRange = { preset: 'today' };
let rangeRequest: AbortController | undefined;
let revision = 0;
let requestSequence = 0;
let savedFavicon: string | undefined;
let faviconRequest: AbortController | undefined;
let registeredRevision: number | undefined;

export function setWidgetContext(serverUrl: string | null, site: Site | null, timeZone: string) {
  const next = serverUrl && site ? widgetContextKey(serverUrl, site.id, timeZone) : null;
  activeContext = next;
  revision++;
  rangeRequest?.abort();
  rangeRequest = undefined;
  savedFavicon = undefined;
  faviconRequest?.abort();
  faviconRequest = undefined;
  try { widgetBridge?.setContext(next); } catch {
    // Widget storage is optional. Invalidate pending app writes even if the
    // shared container is temporarily unavailable, and retry on the next sync.
  }
}

export function setWidgetDateRange(range: AnalyticsDateRange, selection?: { context: AnalyticsQueryContext; site: Site }) {
  const next = widgetDateRange(range);
  if (!next || sameDateRange(next, selectedDateRange)) return;
  selectedDateRange = next;
  requestSequence++;
  rangeRequest?.abort();
  rangeRequest = undefined;
  if (widgetBridge && selection) {
    const controller = new AbortController();
    rangeRequest = controller;
    void syncWidget(selection.context, selection.site, controller.signal, revision).finally(() => {
      if (rangeRequest === controller) rangeRequest = undefined;
    });
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

export function syncDashboardWidget(result: DashboardResult) {
  return syncWidget(result.context, result.site, result.signal, result.widgetRevision, result);
}

async function syncWidget(context: AnalyticsQueryContext, site: Site, signal: AbortSignal, version: number, dashboard?: DashboardResult) {
  if (!widgetBridge || site.id !== context.siteId) return;
  const key = widgetContextKey(context.serverUrl, context.siteId, context.timeZone);
  if (activeContext !== key || revision !== version || signal.aborted) return;
  const range = widgetDateRange(context.dateRange);
  if (!range || !sameDateRange(range, selectedDateRange)) return;
  const sequence = ++requestSequence;
  const isCurrent = () => !signal.aborted && revision === version && activeContext === key && sequence === requestSequence;
  try {
    const now = new Date();
    const reportDate = widgetReportDate(context.timeZone, now);
    let overview: Overview;
    let previous: Overview | null;
    let updatedAt: number;
    if (dashboard && context.filters.length === 0 && sameDateRange(context.dateRange, range) &&
        widgetReportDate(context.timeZone, new Date(dashboard.requestedAt)) === reportDate) {
      ({ overview, previous, updatedAt } = dashboard);
    } else {
      // Pin calendar ranges so both requests use the same bounds across midnight.
      const query = buildAnalyticsQuery(range, context.timeZone, now);
      const startDate = query.get('start_date');
      const endDate = query.get('end_date');
      const widgetQuery: AnalyticsQueryContext = {
        ...context, filters: [], dateRange: startDate && endDate ? { preset: 'custom', startDate, endDate } : range,
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
    const snapshot = createWidgetSnapshot(range, context.timeZone, site, overview, previous, updatedAt, reportDate);
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
