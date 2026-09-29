import type { TeactNode } from '../../lib/teact/teact';
import { useMemo } from '../../lib/teact/teact';

import type {
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThemeKey } from '../../types';

import { getMediaDimensions } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { calculateAlbumLayout } from '../middle/message/helpers/calculateAlbumLayout';
import { getPageMediaBlockId, getPageMediaBlockMedia } from './helpers/pageMedia';

import useLastCallback from '../../hooks/useLastCallback';

import AlbumItem from '../middle/message/AlbumItem';
import Photo from '../middle/message/Photo';
import Video from '../middle/message/Video';

import styles from './Collage.module.scss';

type CollageItem = ApiPageBlockPhoto | ApiPageBlockVideo;

type OwnProps = {
  items: CollageItem[];
  canAutoLoadMedia?: boolean;
  isProtected?: boolean;
  noSpoilerReveal?: boolean;
  theme: ThemeKey;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sourceIds: string[];
  className?: string;
  getUploadProgress?: (item: CollageItem, index: number) => number | undefined;
  renderOverlay?: (item: CollageItem, index: number) => TeactNode;
  onCancelUpload?: (index: number) => void;
  onMediaClick: (index: number) => void;
};

const Collage = ({
  items,
  canAutoLoadMedia,
  isProtected,
  noSpoilerReveal,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  sourceIds,
  className,
  getUploadProgress,
  renderOverlay,
  onCancelUpload,
  onMediaClick,
}: OwnProps) => {
  const albumLayout = useMemo(() => {
    const ratios = items.map((item) => {
      const { width, height } = getMediaDimensions(getPageMediaBlockMedia(item));
      return width / height;
    });

    return calculateAlbumLayout(ratios);
  }, [items]);

  const handleMediaClick = useLastCallback((index: number) => {
    onMediaClick(index);
  });

  return (
    <div
      className={buildClassName(styles.root, className)}
      style={buildStyle(
        `--album-aspect-ratio: ${albumLayout.aspectRatio}`,
      )}
    >
      {items.map((item, index) => {
        const layoutItem = albumLayout.items[index];

        return (
          <AlbumItem
            key={`${getPageMediaBlockId(item)}-${index}`}
            item={layoutItem}
          >
            <>
              {item.type === 'photo' ? (
                <Photo
                  id={sourceIds[index]}
                  photo={getPageMediaBlockMedia(item)}
                  canAutoLoad={canAutoLoadMedia}
                  isProtected={isProtected}
                  noSpoilerReveal={noSpoilerReveal}
                  theme={theme}
                  observeIntersection={observeIntersectionForLoading}
                  uploadProgress={getUploadProgress?.(item, index)}
                  layout="fill"
                  className={styles.media}
                  clickArg={index}
                  onClick={handleMediaClick}
                  onCancelUpload={onCancelUpload}
                />
              ) : (
                <Video
                  id={sourceIds[index]}
                  video={getPageMediaBlockMedia(item)}
                  canAutoLoad={canAutoLoadMedia}
                  canAutoPlay={item.isAutoplay && canAutoLoadMedia}
                  isProtected={isProtected}
                  noSpoilerReveal={noSpoilerReveal}
                  observeIntersectionForLoading={observeIntersectionForLoading}
                  observeIntersectionForPlaying={observeIntersectionForPlaying}
                  uploadProgress={getUploadProgress?.(item, index)}
                  layout="fill"
                  className={styles.media}
                  clickArg={index}
                  onClick={handleMediaClick}
                  onCancelUpload={onCancelUpload}
                />
              )}
              {renderOverlay?.(item, index)}
            </>
          </AlbumItem>
        );
      })}
    </div>
  );
};

export default Collage;
