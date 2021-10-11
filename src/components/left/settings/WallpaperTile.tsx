import React, {
  FC, memo, useCallback, useEffect, useState, useRef,
} from '../../../lib/teact/teact';
import { ApiWallpaper } from '../../../api/types';
import { ThemeKey, UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { CUSTOM_BG_CACHE_NAME } from '../../../config';
import * as cacheApi from '../../../util/cacheApi';
import { fetchBlob } from '../../../util/files';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import buildClassName from '../../../util/buildClassName';
import useMedia from '../../../hooks/useMedia';
import useMediaWithDownloadProgress from '../../../hooks/useMediaWithDownloadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useCanvasBlur from '../../../hooks/useCanvasBlur';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './WallpaperTile.scss';

type OwnProps = {
  wallpaper: ApiWallpaper;
  theme: ThemeKey;
  isSelected: boolean;
  onClick: (slug: string) => void;
};

const WallpaperTile: FC<OwnProps> = ({
  wallpaper,
  theme,
  isSelected,
  onClick,
}) => {
  const { slug, document } = wallpaper;
  const localMediaHash = `wallpaper${document.id!}`;
  const localBlobUrl = document.previewBlobUrl;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`);
  const thumbRef = useCanvasBlur(document.thumbnail?.dataUri, Boolean(previewBlobUrl), true);
  const {
    shouldRenderThumb, shouldRenderFullMedia, transitionClassNames,
  } = useTransitionForMedia(previewBlobUrl || localBlobUrl, 'slow');
  const [isDownloadAllowed, setIsDownloadAllowed] = useState(false);
  const {
    mediaData: fullMedia, downloadProgress,
  } = useMediaWithDownloadProgress(localMediaHash, !isDownloadAllowed);
  const wasDownloadDisabled = usePrevious(isDownloadAllowed) === false;
  const { shouldRender: shouldRenderSpinner, transitionClassNames: spinnerClassNames } = useShowTransition(
    (isDownloadAllowed && !fullMedia) || slug === UPLOADING_WALLPAPER_SLUG,
    undefined,
    wasDownloadDisabled,
    'slow',
  );
  // To prevent triggering of the effect for useCallback
  const cacheKeyRef = useRef<string>();
  cacheKeyRef.current = theme;

  const handleSelect = useCallback(() => {
    (async () => {
      const blob = await fetchBlob(fullMedia!);
      await cacheApi.save(CUSTOM_BG_CACHE_NAME, cacheKeyRef.current!, blob);
      onClick(slug);
    })();
  }, [fullMedia, onClick, slug]);

  useEffect(() => {
    if (fullMedia) {
      handleSelect();
    }
  }, [fullMedia, handleSelect]);

  const handleClick = useCallback(() => {
    if (fullMedia) {
      handleSelect();
    } else {
      setIsDownloadAllowed((isAllowed) => !isAllowed);
    }
  }, [fullMedia, handleSelect]);

  const className = buildClassName(
    'WallpaperTile',
    isSelected && 'selected',
  );

  return (
    <div className={className} onClick={handleClick}>
      <div className="media-inner">
        {shouldRenderThumb && (
          <canvas
            ref={thumbRef}
            className="thumbnail"
          />
        )}
        {shouldRenderFullMedia && (
          <img
            src={previewBlobUrl || localBlobUrl}
            className={`full-media ${transitionClassNames}`}
            alt=""
          />
        )}
        {shouldRenderSpinner && (
          <div className={buildClassName('spinner-container', spinnerClassNames)}>
            <ProgressSpinner progress={downloadProgress} onClick={handleClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(WallpaperTile);
