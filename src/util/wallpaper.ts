import { decompressSync } from 'fflate';

import type { ApiWallpaper, ApiWallpaperSettings } from '../api/types';
import type { IThemeSettings, ThemeKey } from '../types';

import { DARK_THEME_BG_COLOR } from '../config';
import { buildColorFromHex, getPatternColor, int2hex } from './colors';

const DEFAULT_PATTERN_INTENSITY = 50;
const DEFAULT_LIGHT_ACTION_MESSAGE_BG = '#4A8E3A8C';
const DEFAULT_DARK_ACTION_MESSAGE_BG = '#48576166';
// The user slider scales the wallpaper's own intensity: 100 keeps it as is, 0 hides the pattern
const MAX_PATTERN_INTENSITY_FACTOR = 100;
export const DEFAULT_PATTERN_INTENSITY_FACTOR = 75;
const SVG_MIME = 'image/svg+xml';
const XML_OPEN_BRACKET = 0x3C; // `<`

export type DefaultWallpaper = {
  colors: string[];
  patternColor: string;
  intensity: number;
};

export type WallpaperRenderModel = {
  customBackground?: string;
  colors: string[];
  backgroundRotation?: number;
  patternColor?: string;
  patternIntensity?: number;
  baseColor?: string;
  isImage: boolean;
  isBlurred: boolean;
  isDefault: boolean;
  isPattern: boolean;
  isMaskedPattern: boolean;
};

// Clears every wallpaper-related field. Spread it in any path that resets the background,
// so newly added fields only need to be registered here.
export const RESET_WALLPAPER_SETTINGS: Partial<IThemeSettings> = {
  background: undefined,
  backgroundColor: undefined,
  secondBackgroundColor: undefined,
  thirdBackgroundColor: undefined,
  fourthBackgroundColor: undefined,
  backgroundRotation: undefined,
  isPattern: undefined,
  patternColor: undefined,
  patternIntensity: undefined,
  patternIntensityFactor: undefined,
};

// Dark default chat wallpaper rendered through the same gradient engine as any picked wallpaper
// Negative intensity => the pattern masks the gradient (doodles reveal the animated gradient over
// a dark base), matching Telegram's dark-wallpaper convention.
export const DEFAULT_DARK_WALLPAPER: DefaultWallpaper = {
  colors: ['#4f5bd5', '#962fbf', '#dd6cb9', '#fec496'],
  patternColor: getWallpaperPatternColor('#4f5bd5'),
  intensity: -DEFAULT_PATTERN_INTENSITY,
};

export const DEFAULT_LIGHT_WALLPAPER: DefaultWallpaper = {
  colors: ['#bdcd8c', '#8eba89', '#83b28f', '#c5d3b0'],
  patternColor: getWallpaperPatternColor('#bdcd8c'),
  intensity: DEFAULT_PATTERN_INTENSITY,
};

// Negative intensity means the pattern masks the gradient (doodles reveal it over a dark base),
// as opposed to a positive-intensity doodle overlay. Shared so `App` and `useChatBackground` agree.
export function getIsMaskedPattern(isPattern?: boolean, patternIntensity?: number): boolean {
  return Boolean(isPattern) && (patternIntensity ?? 0) < 0;
}

export function buildWallpaperRenderModel(theme: ThemeKey, settings: IThemeSettings): WallpaperRenderModel {
  const {
    background: customBackground,
    backgroundColor,
    secondBackgroundColor,
    thirdBackgroundColor,
    fourthBackgroundColor,
    backgroundRotation,
    patternColor,
    patternIntensity,
    patternIntensityFactor,
    isPattern,
    isBlurred,
  } = settings;
  const customColors = [
    backgroundColor, secondBackgroundColor, thirdBackgroundColor, fourthBackgroundColor,
  ].filter(Boolean);
  const isImage = Boolean(customBackground) && !isPattern;
  const isDefault = getIsDefaultWallpaper(settings);
  const defaultWallpaper = getDefaultWallpaper(theme);
  const effectivePatternColor = isDefault ? defaultWallpaper.patternColor : patternColor;
  const effectivePatternIntensity = isDefault ? defaultWallpaper.intensity : patternIntensity;
  const isCustomPattern = Boolean(isPattern) && Boolean(customBackground);
  // Masked mode is decided by the unscaled sign, so dialing the factor down to 0 keeps the dark
  // wallpaper masked (fully dimmed) instead of flipping it into a bright unmasked gradient
  const isMaskedPattern = getIsMaskedPattern(isCustomPattern || isDefault, effectivePatternIntensity);
  const scaledPatternIntensity = effectivePatternIntensity !== undefined
    ? (effectivePatternIntensity * (patternIntensityFactor ?? DEFAULT_PATTERN_INTENSITY_FACTOR))
    / MAX_PATTERN_INTENSITY_FACTOR
    : undefined;
  const rawColors = isDefault ? defaultWallpaper.colors : customColors;
  const colors = isMaskedPattern && rawColors.length === 1 ? [rawColors[0], rawColors[0]] : rawColors;
  const hasGradient = colors.length >= 2;

  return {
    customBackground,
    colors,
    backgroundRotation,
    patternColor: effectivePatternColor,
    patternIntensity: scaledPatternIntensity,
    baseColor: getWallpaperBaseColor(theme, settings),
    isImage,
    isBlurred: Boolean(isBlurred),
    isDefault,
    isPattern: isCustomPattern || (isDefault && hasGradient),
    isMaskedPattern,
  };
}

export function getWallpaperBaseColor(theme: ThemeKey, settings: IThemeSettings): string | undefined {
  const isDefault = getIsDefaultWallpaper(settings);
  const defaultWallpaper = getDefaultWallpaper(theme);
  const patternIntensity = isDefault ? defaultWallpaper.intensity : settings.patternIntensity;
  const isCustomPattern = Boolean(settings.isPattern && settings.background);
  const isMaskedPattern = getIsMaskedPattern(isCustomPattern || isDefault, patternIntensity);

  return isMaskedPattern
    ? DARK_THEME_BG_COLOR
    : (settings.backgroundColor || (isDefault ? defaultWallpaper.colors[0] : undefined));
}

export function getWallpaperColors(settings?: ApiWallpaperSettings): string[] {
  if (!settings) return [];

  return [
    settings.backgroundColor,
    settings.secondBackgroundColor,
    settings.thirdBackgroundColor,
    settings.fourthBackgroundColor,
  ].filter((color): color is number => color !== undefined).map(int2hex);
}

// Telegram pattern documents are gzip-compressed SVG, unusable as an image until inflated.
export async function decodeWallpaperPatternBlob(blob: Blob): Promise<Blob> {
  const buffer = new Uint8Array(await blob.arrayBuffer());

  // Already-plain SVG/XML text needs only the correct mime type.
  if (buffer[0] === XML_OPEN_BRACKET) {
    return new Blob([buffer.buffer], { type: SVG_MIME });
  }

  const svg = decompressSync(buffer);
  return new Blob([svg.buffer as ArrayBuffer], { type: SVG_MIME });
}

// Returns the tint used by wallpaper-aware surfaces with the built-in wallpaper
export function getDefaultPatternColor(theme: ThemeKey): string {
  return theme === 'dark' ? DEFAULT_DARK_WALLPAPER.patternColor : DEFAULT_LIGHT_WALLPAPER.patternColor;
}

// Built-in wallpapers use their stable chip colors; custom wallpapers follow their derived tint
export function getActionMessageBg(theme: ThemeKey, settings?: IThemeSettings): string | undefined {
  if (!settings || getIsDefaultWallpaper(settings)) {
    return theme === 'dark' ? DEFAULT_DARK_ACTION_MESSAGE_BG : DEFAULT_LIGHT_ACTION_MESSAGE_BG;
  }

  return settings.patternColor;
}

// Derives the translucent tint used for `--pattern-color` (message/embedded bubbles) and
// `--action-message-bg` (service-message chips). The alpha is kept: those chips must stay
// see-through over the wallpaper. The background doodle overlay controls its own opacity/blend.
export function getWallpaperPatternColor(baseColorHex: string): string {
  return getPatternColor(buildColorFromHex(baseColorHex));
}

// A file-backed pattern with no colors has nothing to render beneath its mask, so it's unusable.
export function isRenderableWallpaper(wallpaper: ApiWallpaper): boolean {
  if (wallpaper.document && wallpaper.isPattern) {
    return getWallpaperColors(wallpaper.settings).length > 0;
  }

  return true;
}

// The same pattern document is served over several color variants, so the slug alone is not unique.
export function getWallpaperKey(wallpaper: ApiWallpaper): string {
  const { intensity, rotation } = wallpaper.settings || {};
  return [
    wallpaper.slug,
    wallpaper.isPattern ? 'p' : 'i',
    wallpaper.isPattern ? (intensity ?? DEFAULT_PATTERN_INTENSITY) : '',
    rotation ?? 0,
    ...getWallpaperColors(wallpaper.settings),
  ].join('|');
}

export function isWallpaperSelected(wallpaper: ApiWallpaper, settings?: IThemeSettings): boolean {
  if (!settings) return false;

  // Photo wallpapers have a unique slug and their color is derived on selection, so match by slug.
  if (wallpaper.document && !wallpaper.isPattern) {
    return settings.background === wallpaper.slug && !settings.isPattern;
  }

  const colors = getWallpaperColors(wallpaper.settings);
  const currentColors = [
    settings.backgroundColor, settings.secondBackgroundColor,
    settings.thirdBackgroundColor, settings.fourthBackgroundColor,
  ].filter(Boolean);
  const areColorsEqual = colors.length === currentColors.length && colors.every((c, i) => c === currentColors[i]);
  const isRotationEqual = (settings.backgroundRotation ?? 0) === (wallpaper.settings?.rotation ?? 0);

  if (wallpaper.isPattern) {
    const intensity = wallpaper.settings?.intensity ?? DEFAULT_PATTERN_INTENSITY;
    return Boolean(settings.isPattern)
      && settings.background === wallpaper.slug
      && settings.patternIntensity === intensity
      && isRotationEqual
      && areColorsEqual;
  }

  return !settings.background && !settings.isPattern && isRotationEqual && areColorsEqual;
}

export function buildThemeSettingsFromWallpaper(wallpaper: ApiWallpaper): Partial<IThemeSettings> {
  const colors = getWallpaperColors(wallpaper.settings);
  const [backgroundColor, secondBackgroundColor, thirdBackgroundColor, fourthBackgroundColor] = colors;

  const isPattern = Boolean(wallpaper.isPattern);
  // Derive the chip/bubble tint from any wallpaper that has a base color — not just patterns —
  // otherwise selecting a plain color/gradient leaves the service-message chips on the previous
  // wallpaper's color.
  const patternColor = backgroundColor
    ? getWallpaperPatternColor(backgroundColor)
    : undefined;

  return {
    background: wallpaper.document ? wallpaper.slug : undefined,
    backgroundColor,
    secondBackgroundColor,
    thirdBackgroundColor,
    fourthBackgroundColor,
    backgroundRotation: wallpaper.settings?.rotation,
    isPattern,
    patternColor,
    // The sign is preserved: negative intensity switches `Main` into masked rendering (dark patterns)
    patternIntensity: isPattern
      ? (wallpaper.settings?.intensity ?? DEFAULT_PATTERN_INTENSITY)
      : undefined,
  };
}

function getDefaultWallpaper(theme: ThemeKey) {
  return theme === 'dark' ? DEFAULT_DARK_WALLPAPER : DEFAULT_LIGHT_WALLPAPER;
}

function getIsDefaultWallpaper(settings: IThemeSettings) {
  return !settings.background
    && !settings.isPattern
    && !settings.backgroundColor
    && !settings.secondBackgroundColor
    && !settings.thirdBackgroundColor
    && !settings.fourthBackgroundColor;
}
