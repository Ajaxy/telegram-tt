import { ISettings } from '../types';

import { animateSingle } from './animation';

import themeColors from '../styles/themes.json';

type RGBAColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

let isInitialized = false;

const HEX_COLOR_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i;
const DURATION_MS = 200;
const ENABLE_ANIMATION_DELAY_MS = 500;

const lerp = (start: number, end: number, interpolationRatio: number) => {
  return (1 - interpolationRatio) * start + interpolationRatio * end;
};

const colors = (Object.keys(themeColors) as Array<keyof typeof themeColors>).map((property) => ({
  property,
  colors: [hexToRgb(themeColors[property][0]), hexToRgb(themeColors[property][1])],
}));

export default (theme: ISettings['theme'], withAnimation: boolean) => {
  const isDarkTheme = theme === 'dark';
  const shouldAnimate = isInitialized && withAnimation;
  const startIndex = isDarkTheme ? 0 : 1;
  const endIndex = isDarkTheme ? 1 : 0;
  const startAt = Date.now();
  const themeColorTag = document.querySelector('meta[name="theme-color"]');

  document.documentElement.classList.remove(`theme-${isDarkTheme ? 'light' : 'dark'}`);
  if (isInitialized) {
    document.documentElement.classList.add('disable-animations');
  }
  document.documentElement.classList.add(`theme-${theme}`);
  if (themeColorTag) {
    themeColorTag.setAttribute('content', isDarkTheme ? '#212121' : '#fff');
  }

  setTimeout(() => {
    document.documentElement.classList.remove('disable-animations');
  }, ENABLE_ANIMATION_DELAY_MS);

  isInitialized = true;

  if (shouldAnimate) {
    animateSingle(() => {
      const t = Math.min((Date.now() - startAt) / DURATION_MS, 1);

      applyColorAnimationStep(startIndex, endIndex, transition(t));

      return t < 1;
    });
  } else {
    applyColorAnimationStep(startIndex, endIndex);
  }
};

function transition(t: number) {
  return 1 - ((1 - t) ** 3.5);
}

function hexToRgb(hex: string): RGBAColor {
  const result = HEX_COLOR_REGEX.exec(hex)!;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: result[4] ? parseInt(result[4], 16) : undefined,
  };
}

function applyColorAnimationStep(startIndex: number, endIndex: number, interpolationRatio: number = 1) {
  colors.forEach(({ property, colors: propertyColors }) => {
    const r = Math.round(lerp(propertyColors[startIndex].r, propertyColors[endIndex].r, interpolationRatio));
    const g = Math.round(lerp(propertyColors[startIndex].g, propertyColors[endIndex].g, interpolationRatio));
    const b = Math.round(lerp(propertyColors[startIndex].b, propertyColors[endIndex].b, interpolationRatio));
    const a = propertyColors[startIndex].a
      && Math.round(lerp(propertyColors[startIndex].a!, propertyColors[endIndex].a!, interpolationRatio));

    document.documentElement.style.setProperty(property, a ? `rgba(${r},${g},${b},${a / 255})` : `rgb(${r},${g},${b})`);
  });
}
