import type { ApiThemeParameters } from '../api/types';

export function extractCurrentThemeParams(): ApiThemeParameters {
  const style = getComputedStyle(document.documentElement);
  const backgroundColor = getPropertyHexColor(style, '--color-background')!;
  const textColor = getPropertyHexColor(style, '--color-text')!;
  const buttonColor = getPropertyHexColor(style, '--color-primary')!;
  const buttonTextColor = getPropertyHexColor(style, '--color-white')!;
  const linkColor = getPropertyHexColor(style, '--color-links')!;
  const hintColor = getPropertyHexColor(style, '--color-text-secondary')!;
  const secondaryBgColor = getPropertyHexColor(style, '--color-background-secondary')!;
  return {
    bg_color: backgroundColor,
    text_color: textColor,
    hint_color: hintColor,
    link_color: linkColor,
    button_color: buttonColor,
    button_text_color: buttonTextColor,
    secondary_bg_color: secondaryBgColor,
  };
}

export function validateHexColor(color: string) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

export function getPropertyHexColor(style: CSSStyleDeclaration, property: string) {
  const value = style.getPropertyValue(property);
  if (!value) return undefined;
  return prepareHexColor(value.trim());
}

function prepareHexColor(color: string) {
  if (validateHexColor(color)) return color;
  return `#${color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)!
    .slice(1)
    .map((n: string, i: number) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n))
      .toString(16)
      .padStart(2, '0')
      .replace('NaN', ''))
    .join('')}`;
}
