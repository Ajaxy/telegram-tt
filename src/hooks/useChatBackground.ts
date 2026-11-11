import { useRef } from '../lib/teact/teact';

import type { ApiWallpaper } from '../api/types';
import type { IThemeSettings, ThemeKey } from '../types';
import type { WallpaperStorageSource } from '../util/wallpaperStorage';

import { mixColors } from '../lib/color';
import buildClassName from '../util/buildClassName';
import buildStyle from '../util/buildStyle';
import { buildColorFromHex, buildHexFromColor } from '../util/colors';
import { buildGradientEdgeColors } from '../util/gradientBackground';
import { buildWallpaperRenderModel, type WallpaperRenderModel } from '../util/wallpaper';
import { getResolvedWallpaperEdgeColors, getResolvedWallpaperUrl } from '../util/wallpaperStorage';
import useCustomBackground from './useCustomBackground';
import useGradientBackground from './useGradientBackground';
import usePatternCanvas, { getIsPatternSettled, usePatternLoader } from './usePatternCanvas';

import backgroundStyles from '../styles/_patternBackground.module.scss';

import patternUrl from '../assets/pattern.svg';

type ChatBackgroundParams = {
  theme: ThemeKey;
  chatId?: string;
  wallpaper: IThemeSettings;
  serverWallpaper?: ApiWallpaper;
  fallbackWallpaper?: IThemeSettings;
  // Previews don't animate: draw the same gradient once on a 2D canvas instead of a live WebGL renderer.
  isStatic?: boolean;
  canAnimatePatternSwap?: boolean;
  source?: WallpaperStorageSource;
};

// Shared chat-background rendering: resolves the active wallpaper (custom image, color, gradient or
// pattern — falling back to the built-in default) into the class names, CSS variables and gradient
// canvas that `Main` and the preview modals all render identically.
export default function useChatBackground({
  theme,
  chatId,
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
  const selectedPattern = getPatternKey(selectedModel);
  const isSelectedPatternSettled = !selectedPattern || getIsPatternSettled(selectedPattern);
  const isFallback = (source === 'lockScreen' || serverWallpaper?.document)
    && selectedModel.customBackground && !customBackgroundValue && !(selectedPattern && isSelectedPatternSettled);
  const fallbackModel = isFallback ? buildWallpaperRenderModel(theme, fallbackWallpaper || {}) : undefined;
  // Only the selected wallpaper's media is resolved here, so a fallback that needs media of its own falls back further
  const targetModel = !fallbackModel ? selectedModel
    : fallbackModel.customBackground ? buildWallpaperRenderModel(theme, {})
      : fallbackModel;
  const targetPattern = getPatternKey(targetModel);
  usePatternLoader(targetPattern, targetPattern === patternUrl
    ? patternUrl
    : targetPattern && getResolvedWallpaperUrl(targetPattern, source));

  // The whole previous wallpaper stays until the next pattern is ready, so colors and doodles change together
  const displayedRef = useRef<{ model: WallpaperRenderModel; customBackground?: string }>();
  const previousModel = displayedRef.current?.model;
  if (!displayedRef.current || !targetPattern || getIsPatternSettled(targetPattern)) {
    displayedRef.current = { model: targetModel, customBackground: customBackgroundValue };
  }
  const { model, customBackground: displayedBackground } = displayedRef.current;

  const hasGradient = !model.isImage && model.colors.length >= 2;
  const wasMaskedPatternRef = useRef(model.isMaskedPattern);
  const shouldSnapGradient = model.isMaskedPattern && !wasMaskedPatternRef.current;
  wasMaskedPatternRef.current = model.isMaskedPattern;

  const backgroundChangeRef = useRef<{
    chatId?: string;
    theme: ThemeKey;
    wallpaper: IThemeSettings;
    shouldSnap: boolean;
  }>();
  const previousChange = backgroundChangeRef.current;
  // Modes differ in blending and in how the gradient is shown, so the real layers can't animate between them.
  // The new wallpaper appears at once under a fading snapshot of the previous one, which needs its own base color.
  const shouldCrossfadeTheme = Boolean(canAnimatePatternSwap && previousChange && previousModel
    && previousChange.theme !== theme && previousChange.chatId === chatId
    && !previousModel.isImage && previousModel.baseColor
    && !targetModel.isImage && (!targetPattern || getIsPatternSettled(targetPattern)));
  if (!previousChange || previousChange.chatId !== chatId
    || previousChange.theme !== theme || previousChange.wallpaper !== wallpaper) {
    backgroundChangeRef.current = {
      chatId,
      theme,
      wallpaper,
      // A pattern that still has to load can't appear with the chat, so it fades in instead.
      // The selected pattern decides, as a fallback only stands in until it's resolved.
      shouldSnap: shouldCrossfadeTheme || (previousChange?.chatId !== chatId && isSelectedPatternSettled),
    };
  }
  const shouldSnap = backgroundChangeRef.current!.shouldSnap;
  const canAnimatePattern = canAnimatePatternSwap && !shouldSnap;

  // Entering masked mode snaps away bright transition frames; masked wallpapers still morph between each other
  const gradientCanvasRef = useGradientBackground(
    hasGradient ? model.colors : undefined,
    shouldSnapGradient || !canAnimatePattern, isStatic, model.backgroundRotation,
  );

  const {
    patternLayerRef, isPatternFillReady,
  } = usePatternCanvas(getPatternKey(model), {
    fillColor: model.isMaskedPattern ? model.baseColor : undefined,
    shouldCover: model.colors.length === 1,
    shouldAnimate: canAnimatePattern,
    snapshotModel: shouldCrossfadeTheme ? previousModel : undefined,
  });
  // The gradient is marked ready as soon as it draws, but the layer covering all except the doodles
  // needs the pattern. Keep the gradient hidden until then, so it doesn't flash over the whole background.
  const isMaskedPatternPending = model.isMaskedPattern && !isPatternFillReady;

  const backgroundClassNames = buildClassName(
    backgroundStyles.background,
    model.isImage && backgroundStyles.customBgImage,
    (model.baseColor || hasGradient) && backgroundStyles.customBgColor,
    model.isPattern && !model.isMaskedPattern && backgroundStyles.withPattern,
    model.isPattern && model.colors.length === 1 && backgroundStyles.withPlainPattern,
    model.patternDimming !== undefined && backgroundStyles.withDimmedPattern,
    model.isPattern && model.isMaskedPattern && backgroundStyles.withMaskedPattern,
    isMaskedPatternPending && backgroundStyles.maskedPatternPending,
    model.isImage && model.isBlurred && backgroundStyles.blurred,
  );

  // Set on the shared ancestor of the background and the content: `--pattern-color` is also read by
  // message bubbles, the rest by the background layer itself.
  const rootStyle = buildStyle(
    model.patternColor && `--pattern-color: ${model.patternColor}`,
    model.baseColor && `--theme-background-color: ${model.baseColor}`,
    model.isPattern && model.patternIntensity !== undefined
    && `--pattern-intensity: ${Math.abs(model.patternIntensity) / 100}`,
    model.patternDimming !== undefined && `--pattern-dimming: ${model.patternDimming}`,
  );

  const backgroundStyle = model.isImage && displayedBackground
    ? `--custom-background: url(${displayedBackground})`
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
    patternLayerRef,
    hasGradient,
    isImage: model.isImage,
    edgeColors,
    shouldSnap: !canAnimatePattern,
  };
}

function getPatternKey(model: WallpaperRenderModel) {
  return model.isPattern ? model.customBackground || patternUrl : undefined;
}
