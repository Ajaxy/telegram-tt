import type { ThemeKey } from '../types';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import themeColors from '../styles/themes.json';
import { animate } from './animation';
import { hex2rgbaObj, lerpRgbaObj } from './colors.ts';

let isInitialized = false;

const DECIMAL_PLACES = 3;
const DURATION_MS = 200;
const ENABLE_ANIMATION_DELAY_MS = 500;
const RGB_VARIABLES = new Set([
  '--color-text',
  '--color-primary-shade',
  '--color-text-secondary',
  '--color-accent-own',
]);

const DISABLE_ANIMATION_CSS = `
.no-animations #root *,
.no-animations #root *::before,
.no-animations #root *::after {
  transition: none !important;
}`;

const colors = (Object.keys(themeColors) as Array<keyof typeof themeColors>).map((property) => ({
  property,
  colors: [hex2rgbaObj(themeColors[property][0]), hex2rgbaObj(themeColors[property][1])],
}));

const injectCss = (css: string) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return () => {
    document.head.removeChild(style);
  };
};

const switchTheme = (theme: ThemeKey, withAnimation: boolean) => {
  const themeClassName = `theme-${theme}`;
  if (document.documentElement.classList.contains(themeClassName)) {
    return;
  }
  const isDarkTheme = theme === 'dark';
  const shouldAnimate = isInitialized && withAnimation;
  const startIndex = isDarkTheme ? 0 : 1;
  const endIndex = isDarkTheme ? 1 : 0;
  const startAt = Date.now();
  const themeColorTag = document.querySelector('meta[name="theme-color"]');

  requestMutation(() => {
    document.documentElement.classList.remove(`theme-${isDarkTheme ? 'light' : 'dark'}`);
    let uninjectCss: (() => void) | undefined;
    if (isInitialized) {
      uninjectCss = injectCss(DISABLE_ANIMATION_CSS);
      document.documentElement.classList.add('no-animations');
    }
    document.documentElement.classList.add(themeClassName);
    if (themeColorTag) {
      themeColorTag.setAttribute('content', isDarkTheme ? '#212121' : '#fff');
    }

    setTimeout(() => {
      requestMutation(() => {
        uninjectCss?.();
        document.documentElement.classList.remove('no-animations');
      });
    }, ENABLE_ANIMATION_DELAY_MS);

    isInitialized = true;

    if (shouldAnimate) {
      animate(() => {
        const t = Math.min((Date.now() - startAt) / DURATION_MS, 1);

        applyColorAnimationStep(startIndex, endIndex, transition(t));

        return t < 1;
      }, requestMutation);
    } else {
      applyColorAnimationStep(startIndex, endIndex);
    }
  });
};

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}

function applyColorAnimationStep(startIndex: number, endIndex: number, interpolationRatio: number = 1) {
  colors.forEach(({ property, colors: propertyColors }) => {
    const {
      r, g, b, a,
    } = lerpRgbaObj(propertyColors[startIndex], propertyColors[endIndex], interpolationRatio);

    const roundedA = a !== undefined ? Math.round((a / 255) * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES : undefined;

    document.documentElement.style.setProperty(property, `rgb(${r},${g},${b}${roundedA ? `,${roundedA}` : ''})`);

    if (RGB_VARIABLES.has(property)) {
      document.documentElement.style.setProperty(`${property}-rgb`, `${r},${g},${b}`);
    }
  });
}

export default switchTheme;
