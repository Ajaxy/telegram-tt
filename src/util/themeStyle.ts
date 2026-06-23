import Color from 'colorjs.io';

import type { ApiThemeParameters } from '../api/types';

const HEX_COLOR_LENGTH = 7;

const FALLBACK_THEME_PARAMS: ApiThemeParameters = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#707579',
  link_color: '#3390ec',
  button_color: '#3390ec',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f4f4f5',
  header_bg_color: '#ffffff',
  accent_text_color: '#3390ec',
  section_bg_color: '#ffffff',
  section_header_text_color: '#707579',
  subtitle_text_color: '#707579',
  destructive_text_color: '#e53935',
  section_separator_color: '#c8c6cc',
};

export function extractCurrentThemeParams(): ApiThemeParameters {
  const style = getComputedStyle(document.documentElement);

  const backgroundColor = getPropertyHexColor(style, '--color-background') || FALLBACK_THEME_PARAMS.bg_color;
  const secondaryTextColor = getPropertyHexColor(style, '--color-text-secondary') || FALLBACK_THEME_PARAMS.hint_color;

  const bgColor = backgroundColor;
  const textColor = getPropertyHexColor(style, '--color-text') || FALLBACK_THEME_PARAMS.text_color;
  const buttonColor = getPropertyHexColor(style, '--color-primary') || FALLBACK_THEME_PARAMS.button_color;
  const buttonTextColor = getPropertyHexColor(style, '--color-white') || FALLBACK_THEME_PARAMS.button_text_color;
  const linkColor = getPropertyHexColor(style, '--color-links') || FALLBACK_THEME_PARAMS.link_color;
  const hintColor = secondaryTextColor;
  const secondaryBgColor = getPropertyHexColor(style, '--color-background-secondary')
    || FALLBACK_THEME_PARAMS.secondary_bg_color;
  const sectionSeparatorColor = getPropertyHexColor(style, '--color-dividers')
    || FALLBACK_THEME_PARAMS.section_separator_color;

  const headerBgColor = backgroundColor;
  const accentTextColor = getPropertyHexColor(style, '--color-primary') || FALLBACK_THEME_PARAMS.accent_text_color;
  const sectionBgColor = backgroundColor;
  const sectionHeaderTextColor = secondaryTextColor;
  const subtitleTextColor = hintColor;
  const destructiveTextColor = getPropertyHexColor(style, '--color-error')
    || FALLBACK_THEME_PARAMS.destructive_text_color;

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
  return prepareHexColor(value.trim())?.slice(0, HEX_COLOR_LENGTH);
}

export function prepareHexColor(color: string) {
  try {
    return new Color(color)
      .toGamut({ space: 'srgb', method: 'clip' })
      .toString({ format: 'hex', collapse: false, alpha: false });
  } catch {
    return undefined;
  }
}
