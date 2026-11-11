import type { ThemeKey } from '../types';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import themeColors from '../styles/themes.json';

export const THEME_SWITCH_DURATION_MS = 200;
const MESSAGE_DURATION_PROPERTY = '--message-color-transition-duration';
const DECORATIVE_COLOR_PROPERTIES = new Set(['--color-default-shadow', '--color-light-shadow']);
const REGISTERED_COLOR_PROPERTIES = new Set<string>();

type ThemeColorOverrides = Record<string, string>;
type BrowserThemeColors = { top: string; bottom: string };
type ThemeStyleState = {
  variables: ThemeColorOverrides;
  transition: string;
  baseTransition?: string;
  timeout?: number;
  isAnimating?: boolean;
};

const THEME_STYLE_STATES = new WeakMap<HTMLElement, ThemeStyleState>();
let isInitialized = false;
let browserThemeColors: BrowserThemeColors | undefined;
let baseBrowserColor = '#ffffff';

export default function switchTheme(
  theme: ThemeKey,
  withAnimation: boolean,
  overrides: ThemeColorOverrides = {},
  shouldSnapMessageColors?: boolean,
) {
  const root = document.documentElement;
  const isDarkTheme = theme === 'dark';
  const colors = Object.fromEntries(Object.entries(themeColors).map(([property, values]) => [
    property, values[isDarkTheme ? 1 : 0],
  ]));

  applyThemeStyle(root, { ...colors, ...overrides }, isInitialized && withAnimation, shouldSnapMessageColors);
  requestMutation(() => {
    root.classList.toggle('theme-light', !isDarkTheme);
    root.classList.toggle('theme-dark', isDarkTheme);
    baseBrowserColor = overrides['--color-background'] || colors['--color-background'];
    applyBrowserThemeColors();
    isInitialized = true;
  });
}

export function updateBrowserThemeColors(colors?: BrowserThemeColors) {
  browserThemeColors = colors;
  requestMutation(applyBrowserThemeColors);
}

function applyBrowserThemeColors() {
  const root = document.documentElement;
  root.classList.toggle('has-browser-colors', Boolean(browserThemeColors));
  if (browserThemeColors) {
    root.style.setProperty('--browser-top-color', browserThemeColors.top);
    root.style.setProperty('--browser-bottom-color', browserThemeColors.bottom);
  } else {
    root.style.removeProperty('--browser-top-color');
    root.style.removeProperty('--browser-bottom-color');
  }
  const themeColorTag = document.querySelector('meta[name="theme-color"]');
  themeColorTag?.setAttribute('content', browserThemeColors?.top || baseBrowserColor);
}

export function applyThemeStyle(
  element: HTMLElement,
  variables: ThemeColorOverrides,
  withAnimation?: boolean,
  shouldSnapMessageColors?: boolean,
) {
  const previous = THEME_STYLE_STATES.get(element);
  if (previous?.variables === variables) return;
  const entries = Object.entries(variables);
  if (previous && entries.length === Object.keys(previous.variables).length
    && entries.every(([property, value]) => value === previous.variables[property])) {
    previous.variables = variables;
    return;
  }
  const state: ThemeStyleState = {
    variables,
    transition: previous?.timeout ? previous.transition : element.style.transition,
  };
  window.clearTimeout(previous?.timeout);
  THEME_STYLE_STATES.set(element, state);
  const properties = entries.filter(([property, value]) => value !== previous?.variables[property]
    && CSS.supports('color', value)
    && (!shouldSnapMessageColors || DECORATIVE_COLOR_PROPERTIES.has(property)
      || property.startsWith('--color-borders') || property.startsWith('--color-dividers')))
    .map(([property]) => property);
  const shouldAnimate = Boolean('registerProperty' in CSS && properties.length && previous
    && withAnimation && document.hasFocus()
    && document.visibilityState === 'visible');
  state.isAnimating = shouldAnimate;

  if (!shouldAnimate) {
    requestMutation(applyVariables);
    return;
  }

  properties.forEach(registerColorProperty);
  requestMeasure(() => {
    if (THEME_STYLE_STATES.get(element) !== state) return;
    state.baseTransition = previous?.baseTransition ?? getComputedStyle(element).transition;
    requestMutation(applyVariables);
  });

  function applyVariables() {
    if (THEME_STYLE_STATES.get(element) !== state) return;
    element.style.transition = shouldAnimate ? [state.baseTransition, ...properties.map((property) => (
      `${property} ${THEME_SWITCH_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
    ))].join(', ') : state.transition;
    // Descendant controls follow the animated variables without starting a second color transition
    element.style.setProperty(MESSAGE_DURATION_PROPERTY, '0ms');
    Object.keys(previous?.variables || {}).forEach((property) => {
      if (!(property in variables)) element.style.removeProperty(property);
    });
    entries.forEach(([property, value]) => element.style.setProperty(property, value));
    state.timeout = window.setTimeout(() => {
      requestMutation(() => {
        if (THEME_STYLE_STATES.get(element) !== state) return;
        element.style.transition = state.transition;
        element.style.removeProperty(MESSAGE_DURATION_PROPERTY);
        state.baseTransition = undefined;
        state.timeout = undefined;
        state.isAnimating = false;
      });
    }, THEME_SWITCH_DURATION_MS);
  }
}

function registerColorProperty(property: string) {
  if (REGISTERED_COLOR_PROPERTIES.has(property)) return;
  try {
    CSS.registerProperty({ name: property, syntax: '<color>', inherits: true, initialValue: 'transparent' });
  } catch (err) {
    // Hot reload preserves registrations from the previous module instance
    if (!(err instanceof DOMException && err.name === 'InvalidModificationError')) throw err;
  }
  REGISTERED_COLOR_PROPERTIES.add(property);
}

export function hasActiveThemeTransition(element?: HTMLElement) {
  return Boolean(element && THEME_STYLE_STATES.get(element)?.isAnimating);
}

export function easeThemeSwitch(t: number) {
  return 1 - ((1 - t) ** 3.5);
}
