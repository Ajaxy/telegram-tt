import { decompressSync } from 'fflate';

import type {
  ApiBaseTheme, ApiThemeSettings, ApiWallpaper, ApiWallpaperSettings,
} from '../../api/types';
import type { IThemeSettings, ThemeKey } from '../../types';
import type { ThemePalette } from '../theme';

import { DARK_THEME_BG_COLOR } from '../../config';
import {
  buildColorFromHex, buildDenseTint, getPatternColor, getServiceColor, mixAverageColor,
} from '../colors';
import int2hex from '../int2hex';

const DEFAULT_PATTERN_INTENSITY = 50;
const DEFAULT_LIGHT_PATTERN_COLOR = '#4A8E3A8C';
const DEFAULT_DARK_PATTERN_COLOR = '#48576166';
// The user slider scales the wallpaper's own intensity: 100 keeps it as is, 0 hides the pattern
const MAX_PATTERN_INTENSITY_FACTOR = 100;
// Multicolor patterns are drawn as tall as the view, but not shorter than this
export const MIN_PATTERN_VIEW_HEIGHT = 500;
export const DEFAULT_PATTERN_INTENSITY_FACTOR = 100;
const SVG_MIME = 'image/svg+xml';
const XML_OPEN_BRACKET = 0x3C; // `<`
const LIGHT_BASE_THEMES: ApiBaseTheme[] = ['classic', 'day'];
const DARK_BASE_THEMES: ApiBaseTheme[] = ['night', 'tinted'];
const LIGHT_SERVICE_BACKGROUND = '#00000040';
const DARK_SERVICE_BACKGROUND = '#00000080';
const ACTION_MESSAGE_BG_ALPHA = 0.85;

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
  patternDimming?: number;
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

// Dark multicolor patterns reveal the gradient through their doodles over a black base
export const DEFAULT_DARK_WALLPAPER: DefaultWallpaper = {
  colors: ['#4f5bd5', '#962fbf', '#dd6cb9', '#fec496'],
  patternColor: DEFAULT_DARK_PATTERN_COLOR,
  intensity: -DEFAULT_PATTERN_INTENSITY,
};

export const DEFAULT_LIGHT_WALLPAPER: DefaultWallpaper = {
  colors: ['#bdcd8c', '#8eba89', '#83b28f', '#c5d3b0'],
  patternColor: DEFAULT_LIGHT_PATTERN_COLOR,
  intensity: DEFAULT_PATTERN_INTENSITY,
};

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
  const effectivePatternIntensity = isDefault
    ? defaultWallpaper.intensity : (patternIntensity ?? DEFAULT_PATTERN_INTENSITY);
  const isCustomPattern = Boolean(isPattern) && Boolean(customBackground);
  const colors = isDefault ? defaultWallpaper.colors : customColors;
  const hasGradient = colors.length >= 2;
  const hasPattern = isCustomPattern || (isDefault && hasGradient);
  const isDark = theme === 'dark';
  // macOS chooses pattern compositing from the palette and color count, not the intensity sign
  const isMaskedPattern = hasPattern && isDark && hasGradient;
  const intensityFactor = patternIntensityFactor ?? DEFAULT_PATTERN_INTENSITY_FACTOR;
  const scaledPatternIntensity = Math.abs(effectivePatternIntensity) * intensityFactor / MAX_PATTERN_INTENSITY_FACTOR;
  // Single-color patterns keep their original colors and dark mode dims the entire result
  const isDimmedPattern = hasPattern && isDark && colors.length === 1;

  return {
    customBackground,
    colors,
    backgroundRotation,
    patternColor: effectivePatternColor,
    patternIntensity: hasGradient ? scaledPatternIntensity : isDark ? MAX_PATTERN_INTENSITY_FACTOR : intensityFactor,
    patternDimming: isDimmedPattern ? 1 - scaledPatternIntensity / MAX_PATTERN_INTENSITY_FACTOR : undefined,
    baseColor: isMaskedPattern ? DARK_THEME_BG_COLOR : colors[0],
    isImage,
    isBlurred: Boolean(isBlurred),
    isDefault,
    isPattern: hasPattern,
    isMaskedPattern,
  };
}

export function getWallpaperBaseColor(theme: ThemeKey, settings: IThemeSettings): string | undefined {
  return buildWallpaperRenderModel(theme, settings).baseColor;
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

export function getChatThemeEntry(settings: ApiThemeSettings[], isDark: boolean): ApiThemeSettings | undefined {
  const preferredBases = isDark ? DARK_BASE_THEMES : LIGHT_BASE_THEMES;
  return settings.find((entry) => preferredBases.includes(entry.baseTheme));
}

export function getThemeWallpaper(settings?: IThemeSettings): ApiWallpaper | undefined {
  if (settings?.background !== undefined || settings?.backgroundColor) return undefined;
  return settings?.serverThemeSettings?.wallpaper;
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

export function buildDefaultWallpaperSettings(theme: ThemeKey): Partial<IThemeSettings> {
  return {
    ...RESET_WALLPAPER_SETTINGS,
    background: '',
    isBlurred: true,
    patternColor: getDefaultPatternColor(theme),
  };
}

// Chips follow the wallpaper tint, densified against its average color to hide the doodles beneath them
export function getActionMessageBg(theme: ThemeKey, palette: ThemePalette, settings?: IThemeSettings): string {
  const model = buildWallpaperRenderModel(theme, settings || {});
  if (!model.patternColor) return theme === 'dark' ? DARK_SERVICE_BACKGROUND : LIGHT_SERVICE_BACKGROUND;

  if (theme !== 'dark' || !model.colors.length) {
    return buildDenseTint(model.patternColor, model.colors, ACTION_MESSAGE_BG_ALPHA);
  }

  if (model.isMaskedPattern) {
    // The pattern hides the gradient, so chips follow the incoming bubble color instead
    return buildDenseTint(palette.incomingColor, [model.baseColor!], ACTION_MESSAGE_BG_ALPHA);
  }

  // The pattern tint brightens dark colors, so dark chips darken the wallpaper instead
  return buildDenseTint(getServiceColor(mixAverageColor(model.colors)), model.colors, ACTION_MESSAGE_BG_ALPHA);
}

// Derives the translucent wallpaper tint; the doodle overlay controls its own opacity and blend
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
  const patternColor = backgroundColor ? getWallpaperPatternColor(backgroundColor) : undefined;

  return {
    background: wallpaper.document ? wallpaper.slug : undefined,
    backgroundColor,
    secondBackgroundColor,
    thirdBackgroundColor,
    fourthBackgroundColor,
    backgroundRotation: wallpaper.settings?.rotation,
    isPattern,
    isBlurred: wallpaper.settings?.isBlurred,
    patternColor,
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
