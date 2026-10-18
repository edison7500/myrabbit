import { StyleSheet } from 'react-native';
import { palettes, type ThemeColors } from '@/constants/theme';

// Build once per palette. Components subscribe to the theme, then select a set
// without mutating shared colors, remounting screens, or recreating styles.
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: ThemeColors) => T) {
  return {
    light: StyleSheet.create(factory(palettes.light)),
    dark: StyleSheet.create(factory(palettes.dark)),
  };
}
