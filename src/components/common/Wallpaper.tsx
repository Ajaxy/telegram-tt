import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { IThemeSettings, ThemeKey } from '../../types';

import { selectPerformanceSettingsValue, selectTheme, selectThemeValues } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

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
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  theme: ThemeKey;
  canAnimateGradient?: boolean;
  themeSettings?: IThemeSettings;
};

// Wraps the chat content and renders the wallpaper behind it: the animated gradient + doodle pattern
// (or a custom image / solid color), plus the CSS variables message bubbles read. Pulls the active
// active theme's wallpaper from global.
const Wallpaper = ({
  children,
  containerRef,
  id,
  className,
  bgClassName,
  style,
  inert,
  isStatic,
  onClick,
  theme,
  canAnimateGradient,
  themeSettings,
}: OwnProps & StateProps) => {
  // With the send animation disabled the gradient never moves, so the 2D render is identical
  // and no WebGL context is spent
  const isStaticGradient = isStatic || !canAnimateGradient;

  const background = useChatBackground({
    theme,
    wallpaper: themeSettings || {},
    isStatic: isStaticGradient,
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={className}
      style={buildStyle(background.rootStyle, style) || undefined}
      inert={inert}
      onClick={onClick}
    >
      <div className={buildClassName(background.backgroundClassNames, bgClassName)} style={background.backgroundStyle}>
        {background.hasGradient && (
          <canvas
            // A canvas can hold only one context type, so switching between the animated (WebGL)
            // and static (2D) renderers must recreate the element
            key={isStaticGradient ? 'static' : 'animated'}
            ref={background.gradientCanvasRef}
            className={backgroundStyles.gradientCanvas}
          />
        )}
      </div>
      {children}
    </div>
  );
};

// No `memo`: `children` change on nearly every parent render, so memoization would never apply
export default withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);

    return {
      theme,
      canAnimateGradient: selectPerformanceSettingsValue(global, 'messageSendingAnimations'),
      themeSettings: selectThemeValues(global, theme),
    };
  },
)(Wallpaper);
