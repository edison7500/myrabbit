import type { TextStyle } from 'react-native';

// Opaque data surfaces; native materials are reserved for navigation.
export const darkColors = {
  background: '#212121',
  surface: '#2C2C2E',
  surfaceElevated: '#38383A',
  text: '#F5F5F7',
  muted: '#A8A8AD',
  accent: '#A78BFA',
  border: '#48484A',
  secondarySurface: '#38383A',
  accentSurface: '#393248',
  onAccent: '#21182F',
  positive: '#75CDA7',
  danger: '#FF9B95',
  dangerSurface: '#472F31',
  destructive: '#B52C36',
  onDestructive: '#F5F5F7',
  warning: '#E7BE77',
  chartSecondary: '#D2C5F8',
  chartComparison: '#A8A8AD',
  glass: 'rgba(44, 44, 46, 0.96)',
  glassBorder: 'rgba(245, 245, 247, 0.10)',
  avatars: ['#C3A0FA', '#75CDA7', '#E7BE77', '#91B8F5', '#EA9CC0', '#B0AEFA'],
} as const;


export type ThemeColors = { [K in keyof typeof darkColors]: K extends 'avatars' ? readonly string[] : string };
export type ThemeScheme = 'light' | 'dark';
export type AppearancePreference = 'auto' | ThemeScheme;

export const lightColors: ThemeColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#EAEAEE',
  text: '#1C1C1E',
  muted: '#636366',
  accent: '#7051C4',
  border: '#D1D1D6',
  secondarySurface: '#EAEAEE',
  accentSurface: '#EDE7FA',
  onAccent: '#FFFFFF',
  positive: '#26734F',
  danger: '#B52C36',
  dangerSurface: '#FCEAEC',
  destructive: '#B52C36',
  onDestructive: '#FFFFFF',
  warning: '#855600',
  chartSecondary: '#9979D1',
  chartComparison: '#74747A',
  glass: 'rgba(255, 255, 255, 0.96)',
  glassBorder: 'rgba(28, 28, 30, 0.10)',
  avatars: ['#7051C4', '#26734F', '#855600', '#3265AC', '#A54370', '#5758AD'],
};

export const palettes: Record<ThemeScheme, ThemeColors> = { light: lightColors, dark: darkColors };
export function resolveColorScheme(preference: AppearancePreference, systemScheme: string | null | undefined): ThemeScheme {
  return preference === 'auto' ? systemScheme === 'dark' ? 'dark' : 'light' : preference;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 } as const;
export const radii = { sm: 8, control: 12, card: 20, pill: 999 } as const;
export const layout = { screenPadding: spacing.xl, contentWidth: 640, touchTarget: 44 } as const;
export const typography = {
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
  section: { fontSize: 20, fontWeight: '600', letterSpacing: -0.4 },
  metric: { fontSize: 32, fontWeight: '600', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  body: { fontSize: 16, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
} satisfies Record<string, TextStyle>;
