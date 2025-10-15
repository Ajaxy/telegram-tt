import type { ApiThemeParameters } from '../api/types';

export function extractCurrentThemeParams(): ApiThemeParameters {
  const style = getComputedStyle(document.documentElement);

  const backgroundColor = getPropertyHexColor(style, '--color-background')!;
  const secondaryTextColor = getPropertyHexColor(style, '--color-text-secondary')!;

  const bgColor = backgroundColor;
  const textColor = getPropertyHexColor(style, '--color-text')!;
  const buttonColor = getPropertyHexColor(style, '--color-primary')!;
  const buttonTextColor = getPropertyHexColor(style, '--color-white')!;
  const linkColor = getPropertyHexColor(style, '--color-links')!;
  const hintColor = secondaryTextColor;
  const secondaryBgColor = getPropertyHexColor(style, '--color-background-secondary')!;
  const sectionSeparatorColor = getPropertyHexColor(style, '--color-divider')!;

  const headerBgColor = backgroundColor;
  const accentTextColor = getPropertyHexColor(style, '--color-primary')!;
  const sectionBgColor = backgroundColor;
  const sectionHeaderTextColor = secondaryTextColor;
  const subtitleTextColor = hintColor;
  const destructiveTextColor = getPropertyHexColor(style, '--color-error')!;

  return {
    bg_color: bgColor,
    text_color: textColor,
    hint_color: hintColor,
    link_color: linkColor,
    button_color: buttonColor,
    button_text_color: buttonTextColor,
    secondary_bg_color: secondaryBgColor,
    header_bg_color: headerBgColor,
    accent_text_color: accentTextColor,
    section_bg_color: sectionBgColor,
    section_header_text_color: sectionHeaderTextColor,
    subtitle_text_color: subtitleTextColor,
    destructive_text_color: destructiveTextColor,
    section_separator_color: sectionSeparatorColor,
  };
}

export function validateHexColor(color: string) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

export function getPropertyHexColor(style: CSSStyleDeclaration, property: string) {
  const value = style.getPropertyValue(property);
  if (!value) return undefined;
  return prepareHexColor(value.trim()).slice(0, 7);
}

export function prepareHexColor(color: string) {
  if (validateHexColor(color)) return color;
  return `#${color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)!
    .slice(1)
    .map((n: string, i: number) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n))
      .toString(16)
      .padStart(2, '0')
      .replace('NaN', ''))
    .join('')}`;
}
