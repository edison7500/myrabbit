import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Site } from '@/api/rybbit/client';

const selectedSiteKey = 'myrabbit.selected-site.v1';

export type SavedSite = Site & { serverUrl: string };

export async function loadSelectedSite(): Promise<SavedSite | null> {
  const value = await AsyncStorage.getItem(selectedSiteKey);
  if (!value) return null;
  try {
    const site = JSON.parse(value) as Partial<SavedSite>;
    if (typeof site.id !== 'string' || typeof site.name !== 'string' || typeof site.domain !== 'string' ||
      typeof site.organization !== 'string' || typeof site.serverUrl !== 'string') return null;
    return site as SavedSite;
  } catch {
    return null;
  }
}

export function saveSelectedSite(serverUrl: string, site: Site) {
  return AsyncStorage.setItem(selectedSiteKey, JSON.stringify({ ...site, serverUrl } satisfies SavedSite));
}

export function clearSelectedSite() {
  return AsyncStorage.removeItem(selectedSiteKey);
}

export async function restoreSelectedSite(
  serverUrl: string,
  loadSites: (signal: AbortSignal) => Promise<Site[]>,
  signal: AbortSignal,
): Promise<Site | null> {
  const saved = await loadSelectedSite();
  if (!saved) return null;
  if (saved.serverUrl !== serverUrl) {
    await clearSelectedSite();
    return null;
  }
  try {
    const sites = await loadSites(signal);
    const current = sites.find(site => site.id === saved.id);
    if (!current) {
      await clearSelectedSite();
      return null;
    }
    await saveSelectedSite(serverUrl, current);
    return current;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    const { serverUrl: _serverUrl, ...snapshot } = saved;
    return snapshot;
  }
}
