import { useEffect, useRef } from '../lib/teact/teact';

import type { ApiWallpaper } from '../api/types';
import type { IThemeSettings, ThemeKey } from '../types';
import type { WallpaperStorageSource } from '../util/wallpaperStorage';

import { mixColors } from '../lib/color';
import buildClassName from '../util/buildClassName';
import buildStyle from '../util/buildStyle';
import { buildColorFromHex, buildHexFromColor } from '../util/colors';
import { buildGradientEdgeColors } from '../util/gradientBackground';
import { buildWallpaperRenderModel } from '../util/wallpaper';
import { getResolvedWallpaperEdgeColors } from '../util/wallpaperStorage';
import useCustomBackground from './useCustomBackground';
import useForceUpdate from './useForceUpdate';
import useGradientBackground from './useGradientBackground';

import backgroundStyles from '../styles/_patternBackground.module.scss';

import patternUrl from '../assets/pattern.svg';

type ChatBackgroundParams = {
  theme: ThemeKey;
  wallpaper: IThemeSettings;
  serverWallpaper?: ApiWallpaper;
  fallbackWallpaper?: IThemeSettings;
  // Previews don't animate: draw the same gradient once on a 2D canvas instead of a live WebGL renderer.
  isStatic?: boolean;
  canAnimatePatternSwap?: boolean;
  source?: WallpaperStorageSource;
};

// A mask can't crossfade, so a pattern change dips the doodles out, swaps the mask and lets them fade back in
const PATTERN_SWAP_OUT_MS = 150;
const DEFAULT_PATTERN = `url(${patternUrl})`;

// Shared chat-background rendering: resolves the active wallpaper (custom image, color, gradient or
// pattern — falling back to the built-in default) into the class names, CSS variables and gradient
// canvas that `Main` and the preview modals all render identically.
export default function useChatBackground({
  theme,
  wallpaper,
  serverWallpaper,
  fallbackWallpaper,
  isStatic,
  canAnimatePatternSwap,
  source,
}: ChatBackgroundParams) {
  const selectedModel = buildWallpaperRenderModel(theme, wallpaper);
  const customBackgroundValue = useCustomBackground(
    theme, selectedModel.customBackground, selectedModel.isPattern, source, serverWallpaper,
  );
  const isFallback = (source === 'lockScreen' || serverWallpaper?.document)
    && selectedModel.customBackground && !customBackgroundValue;
  const fallbackModel = isFallback ? buildWallpaperRenderModel(theme, fallbackWallpaper || {}) : undefined;
  // Only the selected wallpaper's media is resolved here, so a fallback that needs media of its own falls back further
  const model = !fallbackModel ? selectedModel
    : fallbackModel.customBackground ? buildWallpaperRenderModel(theme, {})
      : fallbackModel;
  const hasGradient = !model.isImage && model.colors.length >= 2;
  const wasMaskedPatternRef = useRef(model.isMaskedPattern);
  const shouldSnapGradient = model.isMaskedPattern && !wasMaskedPatternRef.current;
  wasMaskedPatternRef.current = model.isMaskedPattern;

  // Entering masked mode snaps away bright transition frames; masked wallpapers still morph between each other
  const gradientCanvasRef = useGradientBackground(
    hasGradient ? model.colors : undefined,
    shouldSnapGradient || !canAnimatePatternSwap, isStatic, model.backgroundRotation,
  );

  const prevTargetPatternRef = useRef<string>();
  const targetPattern = model.isPattern
    ? customBackgroundValue ?? (model.isDefault ? DEFAULT_PATTERN : prevTargetPatternRef.current)
    : undefined;
  // The previous pattern is held on screen while the doodles dip out
  const heldPatternRef = useRef<string>();
  if (prevTargetPatternRef.current !== targetPattern) {
    heldPatternRef.current = canAnimatePatternSwap && prevTargetPatternRef.current && targetPattern
      ? heldPatternRef.current ?? prevTargetPatternRef.current
      : undefined;
    prevTargetPatternRef.current = targetPattern;
  }
  if (!canAnimatePatternSwap) heldPatternRef.current = undefined;
  const isPatternSwapping = Boolean(heldPatternRef.current);
  const displayedPattern = heldPatternRef.current ?? targetPattern;

  const forceUpdate = useForceUpdate();
  useEffect(() => {
    if (!isPatternSwapping) return undefined;

    const timeout = window.setTimeout(() => {
      heldPatternRef.current = undefined;
      forceUpdate();
    }, PATTERN_SWAP_OUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isPatternSwapping, targetPattern, forceUpdate]);

  // Keep the current mask visible while the next one loads
  const wasPatternVisibleRef = useRef(false);
  const isPatternVisible = model.isPattern
    && (model.isDefault || Boolean(displayedPattern) || wasPatternVisibleRef.current);
  wasPatternVisibleRef.current = isPatternVisible;
  // The canvas is marked ready as soon as the gradient draws, but a masked pattern's mask only
  // applies once its blob loads. Keep the canvas hidden until then, so its full unmasked gradient
  // doesn't flash over the whole background in the gap.
  const isMaskedPatternPending = model.isMaskedPattern && !isPatternVisible;

  const backgroundClassNames = buildClassName(
    backgroundStyles.background,
    model.isImage && backgroundStyles.customBgImage,
    (model.baseColor || hasGradient) && backgroundStyles.customBgColor,
    isPatternVisible && !model.isMaskedPattern && backgroundStyles.withPattern,
    isPatternVisible && model.colors.length === 1 && backgroundStyles.withPlainPattern,
    model.patternDimming !== undefined && backgroundStyles.withDimmedPattern,
    isPatternVisible && model.isMaskedPattern && backgroundStyles.withMaskedPattern,
    isMaskedPatternPending && backgroundStyles.maskedPatternPending,
    isPatternSwapping && backgroundStyles.patternSwapping,
    model.isImage && model.isBlurred && backgroundStyles.blurred,
  );

  // Set on the shared ancestor of the background and the content: `--pattern-color` is also read by
  // message bubbles, the rest by the background layer itself.
  const rootStyle = buildStyle(
    model.patternColor && `--pattern-color: ${model.patternColor}`,
    model.baseColor && `--theme-background-color: ${model.baseColor}`,
    displayedPattern && `--custom-pattern: ${displayedPattern}`,
    model.isPattern && model.patternIntensity !== undefined
    && `--pattern-intensity: ${Math.abs(model.patternIntensity) / 100}`,
    model.patternDimming !== undefined && `--pattern-dimming: ${model.patternDimming}`,
  );

  const backgroundStyle = model.isImage && customBackgroundValue
    ? `--custom-background: ${customBackgroundValue}`
    : undefined;

  const dimmedBaseColor = model.patternDimming !== undefined
    ? buildHexFromColor(mixColors(
      buildColorFromHex(model.baseColor!), buildColorFromHex('#000000'), model.patternDimming, { space: 'srgb' },
    )) : undefined;
  const edgeColors = dimmedBaseColor ? { top: dimmedBaseColor, bottom: dimmedBaseColor }
    : model.isImage ? getResolvedWallpaperEdgeColors(model.customBackground!, source)
      : model.isMaskedPattern ? { top: model.baseColor!, bottom: model.baseColor! }
        : model.colors.length ? buildGradientEdgeColors(model.colors, model.backgroundRotation) : undefined;

  return {
    backgroundClassNames,
    rootStyle,
    backgroundStyle,
    gradientCanvasRef,
    hasGradient,
    isImage: model.isImage,
    edgeColors,
  };
}
