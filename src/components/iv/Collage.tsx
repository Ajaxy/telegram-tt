import { useMemo } from '../../lib/teact/teact';

import type {
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../types';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import {
  calculateAlbumLayoutByRatios,
  getMediaRatio,
} from '../middle/message/helpers/calculateAlbumLayout';
import { getPageMediaBlockId, getPageMediaBlockMedia } from './helpers/pageMedia';

import useAppLayout from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';

import Photo from '../middle/message/Photo';
import Video from '../middle/message/Video';

import styles from './Collage.module.scss';

type CollageItem = ApiPageBlockPhoto | ApiPageBlockVideo;

type OwnProps = {
  items: CollageItem[];
  isOwn?: boolean;
  noAvatars?: boolean;
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sourceIds: string[];
  className?: string;
  onMediaClick: (index: number) => void;
};

const Collage = ({
  items,
  isOwn,
  noAvatars,
  canAutoLoadMedia,
  isProtected,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  sourceIds,
  className,
  onMediaClick,
}: OwnProps) => {
  const { isMobile } = useAppLayout();

  const albumLayout = useMemo(() => {
    const ratios = items.map((item) => {
      return getMediaRatio(getPageMediaBlockMedia(item), Boolean(isOwn), isMobile, noAvatars, true);
    });

    return calculateAlbumLayoutByRatios(Boolean(isOwn), Boolean(noAvatars), ratios, isMobile);
  }, [items, isMobile, isOwn, noAvatars]);

  const { width: containerWidth, height: containerHeight } = albumLayout.containerStyle;

  const nestedDimensions = useMemo(() => {
    return albumLayout.layout.map(({ dimensions }) => ({
      ...dimensions,
      x: 0,
      y: 0,
    }));
  }, [albumLayout]);

  const handleMediaClick = useLastCallback((index: number) => {
    onMediaClick(index);
  });

  return (
    <div
      className={buildClassName(styles.root, className)}
      style={buildStyle(
        `width: ${containerWidth}px`,
        `height: ${containerHeight}px`,
      )}
    >
      {items.map((item, index) => {
        const { dimensions } = albumLayout.layout[index];
        const mediaDimensions = nestedDimensions[index];

        return (
          <div
            key={`${getPageMediaBlockId(item)}-${index}`}
            className={styles.item}
            style={buildStyle(
              `left: ${dimensions.x}px`,
              `top: ${dimensions.y}px`,
              `width: ${dimensions.width}px`,
              `height: ${dimensions.height}px`,
            )}
          >
            {item.type === 'photo' ? (
              <Photo
                id={sourceIds[index]}
                photo={getPageMediaBlockMedia(item)}
                isOwn={isOwn}
                noAvatars={noAvatars}
                canAutoLoad={canAutoLoadMedia}
                isProtected={isProtected}
                theme={theme}
                observeIntersection={observeIntersectionForLoading}
                dimensions={mediaDimensions}
                className={styles.media}
                clickArg={index}
                onClick={handleMediaClick}
              />
            ) : (
              <Video
                id={sourceIds[index]}
                video={getPageMediaBlockMedia(item)}
                isOwn={isOwn}
                noAvatars={noAvatars}
                canAutoLoad={canAutoLoadMedia}
                canAutoPlay={item.isAutoplay && canAutoLoadMedia}
                isProtected={isProtected}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
                dimensions={mediaDimensions}
                className={styles.media}
                clickArg={index}
                onClick={handleMediaClick}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Collage;
