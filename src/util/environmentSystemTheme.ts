import { ThemeKey } from '../types';

let systemThemeCache: ThemeKey = (
  window && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
) ? 'dark' : 'light';

export function getSystemTheme() {
  return systemThemeCache;
}

function handleSystemThemeChange(e: MediaQueryListEventMap['change']) {
  systemThemeCache = e.matches ? 'dark' : 'light';
}

const mql = window.matchMedia('(prefers-color-scheme: dark)');
if (typeof mql.addEventListener === 'function') {
  mql.addEventListener('change', handleSystemThemeChange);
} else if (typeof mql.addListener === 'function') {
  mql.addListener(handleSystemThemeChange);
}
