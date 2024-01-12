import type { ThemeKey } from '../types';

let systemThemeCache: ThemeKey = (
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
) ? 'dark' : 'light';

let themeChangeCallback: ((newTheme: ThemeKey) => void) | undefined;

export function getSystemTheme() {
  return systemThemeCache;
}

function handleSystemThemeChange(e: MediaQueryListEventMap['change']) {
  systemThemeCache = e.matches ? 'dark' : 'light';

  themeChangeCallback?.(systemThemeCache);
}

export function setSystemThemeChangeCallback(callback: (newTheme: ThemeKey) => void) {
  themeChangeCallback = callback;
}

window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', handleSystemThemeChange);
