import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppearancePreference } from '@/constants/theme';

const appearanceKey = 'myrabbit.appearance.v1';

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export async function loadAppearance(): Promise<AppearancePreference> {
  const value = await AsyncStorage.getItem(appearanceKey);
  return isAppearancePreference(value) ? value : 'auto';
}

export async function saveAppearance(value: AppearancePreference) {
  if (!isAppearancePreference(value)) throw new Error('Choose Auto, Light, or Dark.');
  await AsyncStorage.setItem(appearanceKey, value);
}
