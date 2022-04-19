import { ApiThemeParameters } from '../api/types';

export function extractCurrentThemeParams(): ApiThemeParameters {
  const style = getComputedStyle(document.documentElement);
  const backgroundColor = getPropertyWrapped(style, '--color-background');
  const textColor = getPropertyWrapped(style, '--color-text');
  const buttonColor = getPropertyWrapped(style, '--color-primary');
  const buttonTextColor = getPropertyWrapped(style, '--color-white');
  const linkColor = getPropertyWrapped(style, '--color-links');
  const hintColor = getPropertyWrapped(style, '--color-text-secondary');
  return {
    bg_color: backgroundColor,
    text_color: textColor,
    hint_color: hintColor,
    link_color: linkColor,
    button_color: buttonColor,
    button_text_color: buttonTextColor,
  };
}

export function validateHexColor(color: string) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

function getPropertyWrapped(style: CSSStyleDeclaration, property: string) {
  const value = style.getPropertyValue(property);
  return wrapColor(value.trim());
}

function wrapColor(color: string) {
  if (validateHexColor(color)) return color;
  return `#${color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)!
    .slice(1)
    .map((n: string, i: number) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n))
      .toString(16)
      .padStart(2, '0')
      .replace('NaN', ''))
    .join('')}`;
}
