import { createContext, use } from 'react';
import { lightColors, type AppearancePreference, type ThemeColors, type ThemeScheme } from '@/constants/theme';

export type AppearanceState = {
  preference: AppearancePreference;
  scheme: ThemeScheme;
  colors: ThemeColors;
  ready: boolean;
  saving: boolean;
  error: string;
  setPreference: (preference: AppearancePreference) => Promise<void>;
};

export const AppearanceContext = createContext<AppearanceState>({
  preference: 'auto', scheme: 'light', colors: lightColors, ready: false, saving: false, error: '',
  setPreference: async () => { throw new Error('AppearanceProvider is required.'); },
});

export function useTheme() {
  return use(AppearanceContext);
}
