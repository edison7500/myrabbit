import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { palettes, resolveColorScheme, type AppearancePreference } from '@/constants/theme';
import { loadAppearance, saveAppearance } from '@/storage/appearance';
import { AppearanceContext } from '@/stores/theme';
import { syncBrowserAppearance } from '@/stores/browser-appearance';

export function AppearanceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setSavedPreference] = useState<AppearancePreference>('auto');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const scheme = resolveColorScheme(preference, systemScheme);
  const colors = palettes[scheme];

  useEffect(() => {
    let active = true;
    mounted.current = true;
    loadAppearance().then(value => { if (active) setSavedPreference(value); })
      .catch(() => { if (active) setError('Could not load appearance. Using Auto.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; mounted.current = false; };
  }, []);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !ready) return;
    // Reset the native override for Auto so future system changes are observed.
    Appearance.setColorScheme(preference === 'auto' ? 'unspecified' : preference);
  }, [preference, ready]);

  useEffect(() => {
    syncBrowserAppearance(scheme);
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [scheme, colors.background]);

  const setPreference = useCallback(async (next: AppearancePreference) => {
    if (!ready || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await saveAppearance(next);
      if (mounted.current) setSavedPreference(next);
    } catch {
      if (mounted.current) setError('Could not save appearance. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [ready]);

  const value = useMemo(() => ({ preference, scheme, colors, ready, saving, error, setPreference }),
    [preference, scheme, colors, ready, saving, error, setPreference]);
  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}
