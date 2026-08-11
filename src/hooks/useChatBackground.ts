import { useRef } from '../lib/teact/teact';

import type { IThemeSettings, ThemeKey } from '../types';

import buildClassName from '../util/buildClassName';
import buildStyle from '../util/buildStyle';
import { buildWallpaperRenderModel } from '../util/wallpaper';
import useCustomBackground from './useCustomBackground';
import useGradientBackground from './useGradientBackground';

import backgroundStyles from '../styles/_patternBackground.module.scss';

type ChatBackgroundParams = {
  theme: ThemeKey;
  wallpaper: IThemeSettings;
  // Previews don't animate: draw the same gradient once on a 2D canvas instead of a live WebGL renderer.
  isStatic?: boolean;
};

// Shared chat-background rendering: resolves the active wallpaper (custom image, color, gradient or
// pattern — falling back to the built-in default) into the class names, CSS variables and gradient
// canvas that `Main` and the preview modals all render identically.
export default function useChatBackground({
  theme,
  wallpaper,
  isStatic,
}: ChatBackgroundParams) {
  const model = buildWallpaperRenderModel(theme, wallpaper);
  const hasGradient = !model.isImage && model.colors.length >= 2;
  const wasMaskedPatternRef = useRef(model.isMaskedPattern);
  const shouldSnapGradient = model.isMaskedPattern && !wasMaskedPatternRef.current;
  wasMaskedPatternRef.current = model.isMaskedPattern;

  const customBackgroundValue = useCustomBackground(theme, model.customBackground, model.isPattern);
  // Entering masked mode snaps away bright transition frames; masked wallpapers still morph between each other
  const gradientCanvasRef = useGradientBackground(
    hasGradient ? model.colors : undefined, shouldSnapGradient, isStatic, model.backgroundRotation,
  );

  // A custom pattern renders once its mask blob or the previous pattern mask is ready. The built-in
  // default uses `pattern.svg` and is always ready.
  const isPatternVisible = model.isPattern && (model.isDefault || Boolean(customBackgroundValue));
  // The canvas is marked ready as soon as the gradient draws, but a masked pattern's mask only
  // applies once its blob loads. Keep the canvas hidden until then, so its full unmasked gradient
  // doesn't flash over the whole background in the gap.
  const isMaskedPatternPending = model.isMaskedPattern && !isPatternVisible;

  const backgroundClassNames = buildClassName(
    backgroundStyles.background,
    model.isImage && backgroundStyles.customBgImage,
    (model.baseColor || hasGradient) && backgroundStyles.customBgColor,
    isPatternVisible && !model.isMaskedPattern && backgroundStyles.withPattern,
    isPatternVisible && model.isMaskedPattern && backgroundStyles.withMaskedPattern,
    isMaskedPatternPending && backgroundStyles.maskedPatternPending,
    model.isImage && model.isBlurred && backgroundStyles.blurred,
  );

  // Set on the shared ancestor of the background and the content: `--pattern-color` is also read by
  // message bubbles, the rest by the background layer itself.
  const rootStyle = buildStyle(
    model.patternColor && `--pattern-color: ${model.patternColor}`,
    model.baseColor && `--theme-background-color: ${model.baseColor}`,
    model.isPattern && customBackgroundValue && `--custom-pattern: ${customBackgroundValue}`,
    model.isPattern && model.patternIntensity !== undefined
    && `--pattern-intensity: ${Math.abs(model.patternIntensity) / 100}`,
  );

  const backgroundStyle = model.isImage && customBackgroundValue
    ? `--custom-background: ${customBackgroundValue}`
    : undefined;

  return {
    backgroundClassNames,
    rootStyle,
    backgroundStyle,
    gradientCanvasRef,
    hasGradient,
  };
}
