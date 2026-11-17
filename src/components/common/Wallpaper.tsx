import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { useLayoutEffect } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiWallpaper } from '../../api/types';
import type { IThemeSettings, ThemeKey } from '../../types';

import {
  selectCanAnimateInterface, selectChatWallpaper, selectChatWallpaperSettings,
  selectPeerWallpaper, selectPerformanceSettingsValue, selectTheme, selectThemeValues,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { updateBrowserThemeColors } from '../../util/switchTheme';

import useChatBackground from '../../hooks/useChatBackground';

import backgroundStyles from '../../styles/_patternBackground.module.scss';

type OwnProps = {
  children?: TeactNode;
  containerRef?: ElementRef<HTMLDivElement>;
  id?: string;
  className?: string;
  // Extra classes for the background layer itself (e.g. the chat's right-column transitions).
  bgClassName?: string;
  style?: string;
  // Disables interaction with the wrapped content (used for non-interactive message previews).
  inert?: boolean;
  // Previews don't animate: draw the same gradient once on a 2D canvas instead of a live WebGL renderer.
  isStatic?: boolean;
  backgroundMode?: 'default' | 'lockScreen';
  browserColorMode?: 'wallpaper' | 'surface';
  shouldExtendChatWallpaper?: boolean;
  withSnapshot?: boolean;
  chatId?: string;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  theme: ThemeKey;
  canAnimateGradient?: boolean;
  canAnimateInterface?: boolean;
  themeSettings?: IThemeSettings;
  serverWallpaper?: ApiWallpaper;
  fallbackThemeSettings?: IThemeSettings;
  hasChatWallpaper: boolean;
  isGlobalWallpaper: boolean;
  globalWallpaper?: IThemeSettings;
  shouldUseSystemTheme?: boolean;
};

const EMPTY_THEME_SETTINGS: IThemeSettings = {};

// Renders the resolved global or peer wallpaper behind the wrapped content
const Wallpaper = ({
  children,
  containerRef,
  id,
  className,
  bgClassName,
  style,
  inert,
  isStatic,
  backgroundMode,
  browserColorMode,
  shouldExtendChatWallpaper,
  withSnapshot,
  chatId,
  onClick,
  theme,
  canAnimateGradient,
  canAnimateInterface,
  themeSettings,
  serverWallpaper,
  fallbackThemeSettings,
  hasChatWallpaper,
  isGlobalWallpaper,
  globalWallpaper,
  shouldUseSystemTheme,
}: OwnProps & StateProps) => {
  // With the send animation disabled the gradient never moves, so the 2D render is identical
  // and no WebGL context is spent
  const isStaticGradient = isStatic || !canAnimateGradient;

  const background = useChatBackground({
    theme,
    chatId,
    wallpaper: themeSettings || EMPTY_THEME_SETTINGS,
    serverWallpaper,
    fallbackWallpaper: fallbackThemeSettings,
    isStatic: isStaticGradient,
    canAnimatePatternSwap: !isStatic && canAnimateInterface,
    source: backgroundMode === 'lockScreen' ? 'lockScreen' : undefined,
    withSnapshot,
    isGlobalWallpaper,
    globalWallpaper,
    shouldUseSystemTheme,
  });
  const shouldExtendWallpaper = shouldExtendChatWallpaper && hasChatWallpaper && background.isImage;

  const browserTopColor = browserColorMode === 'wallpaper' ? background.edgeColors?.top : undefined;
  const browserBottomColor = browserColorMode === 'wallpaper' ? background.edgeColors?.bottom : undefined;
  useLayoutEffect(() => {
    if (!browserColorMode) return undefined;

    updateBrowserThemeColors(browserTopColor ? { top: browserTopColor, bottom: browserBottomColor! } : undefined);
    return () => updateBrowserThemeColors();
  }, [browserColorMode, browserTopColor, browserBottomColor]);

  return (
    <div
      ref={containerRef}
      id={id}
      className={className}
      style={buildStyle(background.rootStyle, style) || undefined}
      inert={inert}
      onClick={onClick}
    >
      <div
        className={buildClassName(backgroundStyles.frame, shouldExtendWallpaper && backgroundStyles.chatWallpaperFrame)}
        style={background.backgroundStyle}
      >
        <div
          className={buildClassName(background.backgroundClassNames,
            background.shouldSnap && backgroundStyles.noAnimation, bgClassName)}
        >
          {background.hasGradient && (
            <canvas
              // A canvas can hold only one context type, so switching between the animated (WebGL)
              // and static (2D) renderers must recreate the element
              key={isStaticGradient ? 'static' : 'animated'}
              ref={background.gradientCanvasRef}
              className={backgroundStyles.gradientCanvas}
            />
          )}
          <div ref={background.patternLayerRef} className={backgroundStyles.patternLayer} />
          {background.isSnapshotShown && (
            <div className={buildClassName('wallpaper-snapshot', backgroundStyles.snapshot)} aria-hidden />
          )}
        </div>
        <div className={backgroundStyles.leftExtension} aria-hidden />
        <div className={backgroundStyles.rightExtension} aria-hidden />
      </div>
      {children}
    </div>
  );
};

// No `memo`: `children` change on nearly every parent render, so memoization would never apply
export default withGlobal<OwnProps>(
  (global, { backgroundMode, chatId }): Complete<StateProps> => {
    const theme = selectTheme(global);
    const globalSettings = selectChatWallpaperSettings(global);
    const themeSettings = backgroundMode === 'default' ? EMPTY_THEME_SETTINGS
      : backgroundMode === 'lockScreen' ? globalSettings
        : selectChatWallpaperSettings(global, chatId);

    return {
      theme,
      canAnimateGradient: selectPerformanceSettingsValue(global, 'messageSendingAnimations'),
      canAnimateInterface: selectCanAnimateInterface(global),
      themeSettings,
      serverWallpaper: backgroundMode ? undefined : selectChatWallpaper(global, chatId),
      fallbackThemeSettings: selectThemeValues(global, theme),
      hasChatWallpaper: Boolean(selectPeerWallpaper(global, chatId)),
      // Chat wallpapers and chat themes resolve to other settings objects
      isGlobalWallpaper: themeSettings === globalSettings,
      globalWallpaper: globalSettings,
      shouldUseSystemTheme: selectSharedSettings(global).shouldUseSystemTheme,
    };
  },
)(Wallpaper);
