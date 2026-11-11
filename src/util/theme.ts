import type { ApiPeerColors, ApiThemeSettings } from '../api/types';
import type { IThemeSettings, ThemeKey } from '../types';

import { PEER_COLOR_BG_ACTIVE_OPACITY, PEER_COLOR_BG_OPACITY, PEER_COLOR_GRADIENT_STEP } from '../config';
import { buildColor, convertColor, mixColors } from '../lib/color';
import themeColors from '../styles/themes.json';
import { buildColorFromHex, buildHexFromColor, deriveOutgoingBubbleFill } from './colors';
import { fastRaf } from './schedulers';

const GENERAL_VARIABLES = new Map<string, string>();
const LIGHT_VARIABLES = new Map<string, string>();
const DARK_VARIABLES = new Map<string, string>();
const COLOR_PERCENT_MAX = 100;
const HUE_MAX = 360;
const RGB_CHANNEL_MAX = 255;
const MESSAGE_SELECTION_OPACITY = 0.1;
const TEXT_SELECTION_ALPHA = '4d';
const TEXT_SELECTION_EMOJI_ALPHA = 'b3';
const PRIMARY_SHADE_WEIGHT = 0.08;
const PRIMARY_DARKER_SHADE_WEIGHT = 0.16;
const PRIMARY_GREYED_WEIGHT = 0.2;
const LIGHT_BRIGHTNESS_THRESHOLD = 0.705;
const NIGHT_BRIGHTNESS_THRESHOLD = 0.735;
const TINTED_BRIGHTNESS_THRESHOLD = 0.7;
const OUTGOING_BRIGHTNESS_THRESHOLD = 0.75;
const BLACK = '#000000';
const WHITE = '#ffffff';
const ERROR_BACKGROUND = '#b3261e';
const LIGHT_INCOMING_COLOR = WHITE;
const NIGHT_INCOMING_COLOR = '#1d1d1d';
const DEFAULT_CLASSIC_OUTGOING_COLOR = '#e1ffc7';
const DEFAULT_OUTGOING_TEXT_SELECTION = '#bbde9f';
const MONOCHROME_NIGHT_OUTGOING_COLOR = '#313131';
const DEFAULT_NIGHT_ACCENT = '#3e88f7';
const DEFAULT_NIGHT_OUTGOING_COLORS = ['#a256bf', '#9047ff', '#0771ff'];
const LUMA_COEFFICIENTS = [0.2126, 0.7152, 0.0722];
const DAY_HSV_MULTIPLIERS = [0.966, 0.61, 0.98];
const TINTED_HSV_MULTIPLIERS = [1.019, 0.731, 0.59];
const INCOMING_HSV_MULTIPLIERS = [1.024, 0.585, 0.25];
const TINTED_ADDITIONAL_HSV_MULTIPLIERS = [1.024, 0.573, 0.18];
const TINTED_SELECTION_HSV_MULTIPLIERS = [1.03, 0.585, 0.12];
const TINTED_SECONDARY_HSV_MULTIPLIERS = [0.956, 0.17, 1];
const LIGHT_ACCENT_BRIGHTNESS = 60;
const NIGHT_ACCENT_MIN_BRIGHTNESS = 55;
const TINTED_ACCENT_MIN_BRIGHTNESS = 18;
const LIGHT_ACCENT_SATURATION_WEIGHT = 1.1;
const OUTGOING_SECONDARY_HSV_MULTIPLIERS = [1.344 * 0.75, 4.554 * 1.1, 0.549];
const OUTGOING_SELECTION_HSV_MULTIPLIERS = [1.013 * 0.75, 1.292, 0.871];
// Bubble secondary text keeps the translucency iOS and macOS use
const LIGHT_INCOMING_SECONDARY = '#52525299';
const DARK_TEXT_SECONDARY_ALPHA = 'cc';
const LIGHT_TEXT_SECONDARY_ALPHA = 'a6';
// Day bubble links keep the default theme blue regardless of the theme accent, like iOS
const DAY_LINK_COLOR = themeColors['--color-links'][0];
const CLASSIC_SATURATION = 14;
const CLASSIC_BASE_BRIGHTNESS = 79;
const CLASSIC_ACCENT_BRIGHTNESS_WEIGHT = 0.21;
const PALETTE_CACHE = new WeakMap<ApiThemeSettings, Partial<Record<ThemeKey, ThemePalette>>>();
const DEFAULT_PALETTE_CACHE: Partial<Record<ThemeKey, ThemePalette>> = {};

export type ThemePalette = {
  variables: Record<string, string>;
  incomingColor: string;
  outgoingColor: string;
  outgoingColors?: string[];
  outgoingAccentColor: string;
  incomingTextColor: string;
  outgoingTextColor: string;
};

type BubblePalette = {
  colors: string[];
  fill: string;
  text: string;
  accent: string;
  accentForeground: string;
  control: string;
  controlForeground: string;
  links: string;
  secondary: string;
  fileTitle: string;
  fileDescription: string;
  selected: string;
};

const style = document.createElement('style');
document.head.appendChild(style);

export function setVariable(name: string, generalValue: string): void;
export function setVariable(name: string, lightValue: string, darkValue?: string): void;
export function setVariable(name: string, lightValueOrGeneral: string, darkValue?: string) {
  if (!darkValue) {
    GENERAL_VARIABLES.set(name, lightValueOrGeneral);
    LIGHT_VARIABLES.delete(name);
    DARK_VARIABLES.delete(name);
  } else {
    GENERAL_VARIABLES.delete(name);
    LIGHT_VARIABLES.set(name, lightValueOrGeneral);
    DARK_VARIABLES.set(name, darkValue);
  }

  scheduleVariableUpdate();
}

// These variables are applied inline alongside the base theme colors
export function buildThemeColorOverrides(settings?: IThemeSettings, theme: ThemeKey = 'light'): Record<string, string> {
  return buildThemePalette(theme, settings?.serverThemeSettings).variables;
}

export function buildThemePalette(theme: ThemeKey, settings?: ApiThemeSettings): ThemePalette {
  const cached = settings ? PALETTE_CACHE.get(settings)?.[theme] : DEFAULT_PALETTE_CACHE[theme];
  if (cached) return cached;

  const isDark = theme === 'dark';
  const themeIndex = isDark ? 1 : 0;
  const appText = isDark ? WHITE : BLACK;
  const appSurfaces = [
    themeColors['--color-background'][themeIndex],
    themeColors['--color-background-secondary'][themeIndex],
    themeColors['--color-background-selected'][themeIndex],
    themeColors['--color-background-secondary-accent'][themeIndex],
  ];
  const accent = settings ? buildThemeAccent(settings) : themeColors['--color-primary'][themeIndex];
  const chatActive = accent;
  const isTinted = settings?.baseTheme === 'tinted';
  if (isTinted) {
    appSurfaces[0] = multiplyHsv(accent, INCOMING_HSV_MULTIPLIERS);
    appSurfaces[1] = multiplyHsv(accent, TINTED_ADDITIONAL_HSV_MULTIPLIERS);
    appSurfaces[2] = multiplyHsv(accent, TINTED_SELECTION_HSV_MULTIPLIERS);
    appSurfaces[3] = appSurfaces[1];
  }
  const secondary = isTinted ? `${multiplyHsv(accent, TINTED_SECONDARY_HSV_MULTIPLIERS)}80`
    : themeColors['--color-text-secondary'][themeIndex];
  const error = settings?.baseTheme === 'tinted' ? '#ff6767' : isDark ? '#eb5545' : '#ff3b30';
  const incomingFill = settings ? buildDefaultIncomingColor(settings, accent)
    : themeColors['--color-background'][themeIndex];
  const outgoingFills = settings?.outgoingColors?.length ? settings.outgoingColors
    : settings ? buildDefaultOutgoingColors(settings) : [themeColors['--color-background-own'][themeIndex]];
  const primaryForeground = isDark
    ? getFilledForeground(accent, isTinted ? TINTED_BRIGHTNESS_THRESHOLD : NIGHT_BRIGHTNESS_THRESHOLD) : WHITE;
  const incoming = buildBubblePalette([incomingFill], appText, accent,
    isTinted ? secondary : isDark ? `${WHITE}80` : LIGHT_INCOMING_SECONDARY);
  if (!isDark) {
    incoming.fileDescription = '#999999';
    incoming.links = DAY_LINK_COLOR;
  }
  incoming.accentForeground = primaryForeground;
  incoming.controlForeground = primaryForeground;
  const outgoing = buildOutgoingBubblePalette(outgoingFills, isDark, settings?.outboxAccentColor);
  // Same as iOS: a deeper bubble shade under dark text, translucent white under light text
  const outgoingTextSelection = outgoing.text !== BLACK ? `${WHITE}${TEXT_SELECTION_ALPHA}`
    : settings ? multiplyHsv(outgoing.fill, OUTGOING_SELECTION_HSV_MULTIPLIERS) : DEFAULT_OUTGOING_TEXT_SELECTION;
  const variables: Record<string, string> = {};
  buildBubbleVariables(variables, 'incoming', incoming);
  buildBubbleVariables(variables, 'outgoing', outgoing);
  const shadeNeutral = primaryForeground === BLACK ? WHITE : BLACK;
  const shade = mixHexColors(accent, shadeNeutral, PRIMARY_SHADE_WEIGHT);
  const darkerShade = mixHexColors(accent, shadeNeutral, PRIMARY_DARKER_SHADE_WEIGHT);
  const greyed = mixHexColors(accent, shadeNeutral, PRIMARY_GREYED_WEIGHT);
  Object.assign(variables, {
    '--color-background': appSurfaces[0],
    '--color-background-secondary': appSurfaces[1],
    '--color-background-selected': appSurfaces[2],
    '--color-background-secondary-accent': appSurfaces[3],
    '--color-text': appText,
    '--color-text-rgb': toRgbTriplet(buildColorFromHex(appText)),
    '--color-text-secondary': secondary,
    '--color-text-secondary-rgb': toRgbTriplet(buildColorFromHex(secondary)),
    '--color-text-secondary-apple': secondary,
    '--color-icon-secondary': secondary,
    '--color-text-meta': secondary,
    '--color-text-meta-rgb': toRgbTriplet(buildColorFromHex(secondary)),
    '--color-text-meta-apple': secondary,
    '--color-error': error,
    '--color-error-rgb': toRgbTriplet(buildColorFromHex(error)),
    '--color-error-background': ERROR_BACKGROUND,
    '--color-error-shade': ERROR_BACKGROUND,
    '--color-error-foreground': WHITE,
    '--color-primary': accent,
    '--color-primary-foreground': primaryForeground,
    '--color-primary-shade': shade,
    '--color-primary-shade-darker': darkerShade,
    '--color-primary-shade-rgb': toRgbTriplet(buildColorFromHex(shade)),
    '--color-primary-opacity': `${accent}1e`,
    '--color-primary-opacity-hover': `${accent}40`,
    '--color-primary-tint': `${accent}1a`,
    '--color-text-selection': `${accent}${TEXT_SELECTION_ALPHA}`,
    '--color-selection-highlight-emoji': `${accent}${TEXT_SELECTION_ALPHA}`,
    '--color-chat-active': chatActive,
    '--color-chat-active-greyed': greyed,
    '--color-links': accent,
    '--color-active': accent,
    '--color-active-darker': shade,
    '--color-background-own': outgoing.fill,
    '--color-background-own-selected': outgoing.selected,
    '--color-text-own': outgoing.text,
    '--color-text-own-rgb': toRgbTriplet(buildColorFromHex(outgoing.text)),
    '--color-text-secondary-own': outgoing.secondary,
    '--color-text-secondary-own-rgb': toRgbTriplet(buildColorFromHex(outgoing.secondary)),
    '--color-accent-own': outgoing.accent,
    '--color-accent-own-rgb': toRgbTriplet(buildColorFromHex(outgoing.accent)),
    '--color-poll-check-own': outgoing.accentForeground,
    '--color-message-meta-own': outgoing.secondary,
    '--color-own-links': outgoing.links,
    '--color-code-own': outgoing.accent,
    '--color-message-reaction-chosen-hover-own': outgoing.accent,
    '--message-incoming-checkbox-fill': accent,
    '--message-incoming-checkbox-foreground': primaryForeground,
    '--message-outgoing-checkbox-fill': outgoing.control,
    '--message-outgoing-checkbox-foreground': outgoing.controlForeground,
    '--message-incoming-table-background': isDark ? `${incoming.control}1a` : '#0000000d',
    '--message-incoming-table-border': isDark ? `${incoming.control}40` : '#0000001a',
    '--message-outgoing-table-background': `${outgoing.control}1a`,
    '--message-outgoing-table-border': `${outgoing.control}40`,
    '--message-outgoing-text-selection': outgoingTextSelection,
    // Emoji are painted under the selection, so an opaque one turns see-through over them
    '--message-outgoing-text-selection-emoji': outgoing.text === BLACK
      ? `${outgoingTextSelection}${TEXT_SELECTION_EMOJI_ALPHA}` : outgoingTextSelection,
    '--message-service-background': 'var(--action-message-bg)',
    '--message-service-text': WHITE,
    '--message-call-success': isDark ? '#49ad51' : '#63da6e',
    '--message-media-background': '#000000b3',
    '--message-media-text': WHITE,
    '--message-paid-background': '#ffb727',
    '--message-paid-text': WHITE,
    '--message-code-dark': variables['--message-incoming-code-dark'],
  });

  const palette: ThemePalette = {
    variables,
    incomingColor: incoming.fill,
    outgoingColor: outgoing.fill,
    outgoingColors: outgoing.colors.some((color) => color !== outgoing.colors[0]) ? outgoing.colors : undefined,
    outgoingAccentColor: outgoing.accent,
    incomingTextColor: incoming.text,
    outgoingTextColor: outgoing.text,
  };
  if (settings) PALETTE_CACHE.set(settings, { ...PALETTE_CACHE.get(settings), [theme]: palette });
  else DEFAULT_PALETTE_CACHE[theme] = palette;
  return palette;
}

// Text polarity changes snap together with the bubble and filled-control colors
export function isThemePaletteTransitionSafe(previous: ThemePalette, next: ThemePalette): boolean {
  return previous.incomingTextColor === next.incomingTextColor
    && previous.outgoingTextColor === next.outgoingTextColor
    && previous.variables['--color-primary-foreground'] === next.variables['--color-primary-foreground']
    && previous.variables['--message-outgoing-control-foreground']
    === next.variables['--message-outgoing-control-foreground'];
}

function buildBubbleVariables(
  variables: Record<string, string>, direction: string, bubble: BubblePalette,
) {
  const prefix = `--message-${direction}-`;
  const roles = { text: bubble.text, secondary: bubble.secondary, meta: bubble.secondary, accent: bubble.accent };
  Object.entries(roles).forEach(([role, value]) => {
    variables[`${prefix}${role}`] = value;
    variables[`${prefix}${role}-rgb`] = toRgbTriplet(buildColorFromHex(value));
  });
  Object.assign(variables, {
    [`${prefix}background`]: bubble.fill,
    [`${prefix}links`]: bubble.links,
    [`${prefix}links-decoration`]: bubble.links === bubble.text ? 'underline' : 'none',
    [`${prefix}accent-foreground`]: bubble.accentForeground,
    [`${prefix}control`]: bubble.control,
    [`${prefix}control-foreground`]: bubble.controlForeground,
    [`${prefix}file-title`]: bubble.fileTitle,
    [`${prefix}file-description`]: bubble.fileDescription,
    [`${prefix}tint`]: `${bubble.accent}1f`,
    [`${prefix}tint-hover`]: `${bubble.accent}3d`,
    [`${prefix}ripple`]: `${bubble.text === BLACK ? WHITE : BLACK}14`,
    [`${prefix}selected`]: bubble.selected,
    [`${prefix}selected-text`]: bubble.text,
    [`${prefix}code-dark`]: bubble.text === WHITE ? '1' : '0',
  });
}

function buildOutgoingBubblePalette(colors: string[], isDark: boolean, outboxAccent?: string): BubblePalette {
  const fill = deriveOutgoingBubbleFill(colors)!;
  const hasDarkText = getPerceivedBrightness(fill) > OUTGOING_BRIGHTNESS_THRESHOLD;
  const text = hasDarkText ? BLACK : WHITE;
  const accent = hasDarkText ? multiplyHsv(fill, OUTGOING_SECONDARY_HSV_MULTIPLIERS) : WHITE;
  const secondary = `${accent}${hasDarkText ? DARK_TEXT_SECONDARY_ALPHA : LIGHT_TEXT_SECONDARY_ALPHA}`;
  const links = isDark || !hasDarkText ? text : outboxAccent || DAY_LINK_COLOR;
  return buildBubblePalette(colors, text, accent, secondary, accent, links);
}

function buildBubblePalette(
  colors: string[], text: string, accent: string, secondary: string, control = accent, links = accent,
): BubblePalette {
  const fill = deriveOutgoingBubbleFill(colors)!;
  return {
    colors,
    fill,
    text,
    accent,
    accentForeground: getFilledForeground(accent),
    control,
    controlForeground: getFilledForeground(control),
    links,
    secondary,
    fileTitle: text,
    fileDescription: secondary,
    selected: mixHexColors(fill, BLACK, MESSAGE_SELECTION_OPACITY),
  };
}

function buildThemeAccent(settings: ApiThemeSettings) {
  const { accentColor, baseTheme } = settings;
  const lightness = getPerceivedBrightness(accentColor);
  const [hue, saturation, brightness] = convertColor(buildColorFromHex(accentColor), 'hsv').coords;
  if ((baseTheme === 'classic' || baseTheme === 'day') && lightness > LIGHT_BRIGHTNESS_THRESHOLD) {
    return buildHexFromColor(buildColor({ space: 'hsv', coords: [hue || 0,
      Math.min(COLOR_PERCENT_MAX, saturation! * LIGHT_ACCENT_SATURATION_WEIGHT),
      Math.min(brightness!, LIGHT_ACCENT_BRIGHTNESS)] }));
  }
  const minimumBrightness = baseTheme === 'tinted' ? TINTED_ACCENT_MIN_BRIGHTNESS
    : baseTheme === 'night' && lightness <= NIGHT_BRIGHTNESS_THRESHOLD ? NIGHT_ACCENT_MIN_BRIGHTNESS : 0;
  if (brightness! >= minimumBrightness) return accentColor;
  return buildHexFromColor(buildColor({ space: 'hsv', coords: [hue || 0, saturation!, minimumBrightness] }));
}

function getFilledForeground(fill: string, threshold = LIGHT_BRIGHTNESS_THRESHOLD) {
  return getPerceivedBrightness(fill) > threshold ? BLACK : WHITE;
}

function buildDefaultIncomingColor(settings: ApiThemeSettings, accent: string) {
  if (settings.baseTheme === 'night') return NIGHT_INCOMING_COLOR;
  if (settings.baseTheme === 'tinted') return multiplyHsv(accent, INCOMING_HSV_MULTIPLIERS);
  return LIGHT_INCOMING_COLOR;
}

function buildDefaultOutgoingColors(settings: ApiThemeSettings): string[] {
  const { accentColor, baseTheme } = settings;
  if (baseTheme === 'classic') {
    if (!accentColor) return [DEFAULT_CLASSIC_OUTGOING_COLOR];
    const [hue, saturation, brightness] = convertColor(buildColorFromHex(accentColor), 'hsv').coords;
    return [buildHexFromColor(buildColor({ space: 'hsv', coords: [
      hue || 0,
      saturation! > 0 && brightness! > 0 ? CLASSIC_SATURATION : 0,
      CLASSIC_BASE_BRIGHTNESS + brightness! * CLASSIC_ACCENT_BRIGHTNESS_WEIGHT,
    ] }))];
  }
  if (baseTheme === 'night' && accentColor.toLowerCase() === WHITE) return [MONOCHROME_NIGHT_OUTGOING_COLOR];
  if (baseTheme === 'night' && accentColor.toLowerCase() === DEFAULT_NIGHT_ACCENT) return DEFAULT_NIGHT_OUTGOING_COLORS;
  const bottom = baseTheme === 'tinted' ? multiplyHsv(accentColor, TINTED_HSV_MULTIPLIERS) : accentColor;
  return [multiplyHsv(bottom, DAY_HSV_MULTIPLIERS), bottom];
}

function getPerceivedBrightness(hex: string) {
  const channels = convertColor(buildColorFromHex(hex), 'srgb').coords;
  return channels.reduce<number>((sum, channel, index) => sum + channel! * LUMA_COEFFICIENTS[index], 0);
}

function multiplyHsv(hex: string, multipliers: number[]) {
  const coords = convertColor(buildColorFromHex(hex), 'hsv').coords.map((value, index) => (
    Math.min(index ? COLOR_PERCENT_MAX : HUE_MAX, (value || 0) * multipliers[index])
  ));
  return buildHexFromColor(buildColor({ space: 'hsv', coords: [coords[0], coords[1], coords[2]] }));
}

function mixHexColors(first: string, second: string, amount: number) {
  return buildHexFromColor(mixColors(buildColorFromHex(first), buildColorFromHex(second), amount, { space: 'srgb' }));
}

function toRgbTriplet(color: ReturnType<typeof buildColorFromHex>) {
  const [r, g, b] = convertColor(color, 'srgb').coords.map((channel) => Math.round((channel || 0) * RGB_CHANNEL_MAX));
  return `${r}, ${g}, ${b}`;
}

let isUpdateScheduled = false;
function scheduleVariableUpdate() {
  if (isUpdateScheduled) return;
  isUpdateScheduled = true;
  fastRaf(updateVariables);
}

function updateVariables() {
  isUpdateScheduled = false;

  const generalVariables = buildVariables(GENERAL_VARIABLES);
  const lightVariables = buildVariables(LIGHT_VARIABLES);
  const darkVariables = buildVariables(DARK_VARIABLES);

  style.textContent = `
    html {
      ${generalVariables}
    }

    html.theme-light {
      ${lightVariables}
    }

    html.theme-dark {
      ${darkVariables}
    }
  `;
}

function buildVariables(map: Map<string, string>) {
  return Array.from(map.entries()).map(([name, value]) => `--${name}: ${value};`).join(' ');
}

// The first server color belongs at the bottom of the viewport
export function buildOwnBubbleGradientCss(colors: string[]): string {
  return `linear-gradient(180deg in srgb, ${[...colors].reverse().join(', ')})`;
}

export function updatePeerColors(
  peerColors: ApiPeerColors['general'],
) {
  setPeerColor('0', ['#D45246']);
  setPeerColor('1', ['#F68136']);
  setPeerColor('2', ['#6C61DF']);
  setPeerColor('3', ['#46BA43']);
  setPeerColor('4', ['#5CAFFA']);
  setPeerColor('5', ['#408ACF']);
  setPeerColor('6', ['#D95574']);

  Object.entries(peerColors).forEach(([key, value]) => {
    if (!value.colors) return;
    setPeerColor(key, value.colors, value.darkColors);
  });
}

function setPeerColor(n: string, colors: string[], darkColors?: string[]) {
  const mainLightColor = colors[0];
  const mainDarkColor = darkColors?.[0];
  if (!mainLightColor) return;

  const { bg: lightBgColor, bgActive: lightBgActiveColor } = generateColorVariations(mainLightColor);
  const { bg: darkBgColor, bgActive: darkBgActiveColor } = mainDarkColor
    ? generateColorVariations(mainDarkColor) : { bg: undefined, bgActive: undefined };

  setVariable(`color-peer-${n}`, mainLightColor, mainDarkColor);
  setVariable(`color-peer-bg-${n}`, lightBgColor, darkBgColor);
  setVariable(`color-peer-bg-active-${n}`, lightBgActiveColor, darkBgActiveColor);

  if (colors.length > 1) {
    const lightGradient = generatePeerColorGradient(colors);
    const darkGradient = darkColors ? generatePeerColorGradient(darkColors) : undefined;
    setVariable(`color-peer-gradient-${n}`, lightGradient, darkGradient);
  }
}

export function generateColorVariations(baseColor: string) {
  return {
    bg: `${baseColor}${PEER_COLOR_BG_OPACITY}`,
    bgActive: `${baseColor}${PEER_COLOR_BG_ACTIVE_OPACITY}`,
  };
}

export function generatePeerColorGradient(colors: string[]) {
  if (colors.length === 1) return colors[0];

  const gradientColors = colors.map((color, i) => (
    `${color} ${i * PEER_COLOR_GRADIENT_STEP}px, ${color} ${(i + 1) * PEER_COLOR_GRADIENT_STEP}px`
  ));

  return `repeating-linear-gradient(-45deg, ${gradientColors.join(', ')})`;
}
