import type { ThemeScheme } from '@/constants/theme';

export function syncBrowserAppearance(scheme: ThemeScheme) {
  // Expo UI's web controls inherit CSS variables from :root. Marking the root
  // also prevents its system-dark media rule from overriding an explicit Light.
  document.documentElement.dataset.theme = scheme;
  document.documentElement.style.colorScheme = scheme;
}
