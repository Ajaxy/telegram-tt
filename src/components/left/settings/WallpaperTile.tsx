import {
  memo, useEffect, useRef,
  useState,
} from '../../../lib/teact/teact';

import type { ApiWallpaper } from '../../../api/types';
import { UPLOADING_WALLPAPER_SLUG } from '../../../types';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { getIsMaskedPattern, getWallpaperColors } from '../../../util/wallpaper';
import { cacheWallpaperMedia } from '../../../util/wallpaperStorage';

import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useGradientBackground from '../../../hooks/useGradientBackground';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './WallpaperTile.scss';

type OwnProps = {
  wallpaper: ApiWallpaper;
  isSelected: boolean;
  onRequest: (wallpaper: ApiWallpaper) => void;
  onClick: (wallpaper: ApiWallpaper) => void;
};

const WallpaperTile = ({
  wallpaper,
  isSelected,
  onRequest,
  onClick,
}: OwnProps) => {
  const {
    slug, document, isPattern, settings,
  } = wallpaper;
  const isColorOnly = !document;
  const isImage = Boolean(document) && !isPattern;

  const colors = getWallpaperColors(settings);
  const intensity = settings?.intensity;
  const isMaskedPattern = getIsMaskedPattern(isPattern, intensity);
  const gradientColors = isMaskedPattern && colors.length === 1 ? [colors[0], colors[0]] : colors;
  const hasGradient = gradientColors.length >= 2;

  const gradientCanvasRef = useGradientBackground(
    hasGradient ? gradientColors : undefined, undefined, true, settings?.rotation,
  );

  const localMediaHash = document ? `wallpaper${document.id!}` : undefined;
  const localBlobUrl = document?.previewBlobUrl;
  const previewBlobUrl = useMedia(localMediaHash && `${localMediaHash}?size=m`);
  const patternMaskUrl = previewBlobUrl || localBlobUrl;
  const thumbRef = useCanvasBlur(document?.thumbnail?.dataUri, Boolean(previewBlobUrl), true);
  const { transitionClassNames } = useShowTransitionDeprecated(
    Boolean(previewBlobUrl || localBlobUrl),
    undefined,
    undefined,
    'slow',
  );
  const isLoadingRef = useRef(false);
  const [isLoadAllowed, setIsLoadAllowed] = useState(false);
  const {
    mediaData: fullMedia, loadProgress,
  } = useMediaWithLoadProgress(localMediaHash, !isLoadAllowed);
  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;
  const { shouldRender: shouldRenderSpinner, transitionClassNames: spinnerClassNames } = useShowTransitionDeprecated(
    (isLoadAllowed && !fullMedia) || slug === UPLOADING_WALLPAPER_SLUG,
    undefined,
    wasLoadDisabled,
    'slow',
  );
  const handleSelect = useLastCallback(() => {
    (async () => {
      try {
        const isSaved = await cacheWallpaperMedia(wallpaper, fullMedia!);
        if (!isSaved) return;

        onClick(wallpaper);
      } catch (err) {
        // Selecting without a cached blob would render nothing and then reset — better to keep
        // the current wallpaper
        // eslint-disable-next-line no-console
        console.error('[WallpaperTile] Failed to cache wallpaper blob', err);
      }
    })();
  });

  useEffect(() => {
    // If we've clicked on a wallpaper, select it when full media is loaded
    if (fullMedia && isLoadingRef.current) {
      handleSelect();
      isLoadingRef.current = false;
    }
  }, [fullMedia, handleSelect]);

  const handleClick = useLastCallback(() => {
    onRequest(wallpaper);
    if (isColorOnly) {
      onClick(wallpaper);
    } else if (fullMedia) {
      handleSelect();
    } else {
      isLoadingRef.current = true;
      setIsLoadAllowed((isAllowed) => !isAllowed);
    }
  });

  const className = buildClassName(
    'WallpaperTile',
    isSelected && 'selected',
  );

  return (
    <div className={className} onClick={handleClick}>
      <div
        className={buildClassName(
          'media-inner',
          isMaskedPattern && 'masked',
          isMaskedPattern && patternMaskUrl && 'maskReady',
        )}
        style={buildStyle(
          !isMaskedPattern && colors.length === 1 && `background: ${colors[0]}`,
          isMaskedPattern && patternMaskUrl && `--pattern-mask: url(${patternMaskUrl})`,
          isPattern && intensity !== undefined && `--pattern-intensity: ${Math.abs(intensity) / 100}`,
        )}
      >
        {hasGradient && <canvas ref={gradientCanvasRef} className="gradient" />}
        {isImage && (
          <>
            <canvas
              ref={thumbRef}
              className="thumbnail"
            />
            {patternMaskUrl && (
              <img
                src={patternMaskUrl}
                className={buildClassName('full-media', transitionClassNames)}
                alt=""
                draggable={false}
              />
            )}
          </>
        )}
        {isPattern && !isMaskedPattern && patternMaskUrl && (
          <div
            className="pattern"
            style={`--pattern-mask: url(${patternMaskUrl})`}
          />
        )}
        {shouldRenderSpinner && (
          <div className={buildClassName('spinner-container', spinnerClassNames)}>
            <ProgressSpinner progress={loadProgress} onClick={handleClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(WallpaperTile);
