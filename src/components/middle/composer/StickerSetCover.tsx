import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { selectIsAlwaysHighPriorityEmoji } from '../../../global/selectors';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getFirstLetters } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';
import { getStickerPreviewHash } from '../../../global/helpers';

import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useBoundsInSharedCanvas from '../../../hooks/useBoundsInSharedCanvas';

import AnimatedSticker from '../../common/AnimatedSticker';
import OptimizedVideo from '../../ui/OptimizedVideo';

import styles from './StickerSetCover.module.scss';

type OwnProps = {
  stickerSet: ApiStickerSet;
  size?: number;
  noAnimate?: boolean;
  observeIntersection: ObserveFn;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
};

const StickerSetCover: FC<OwnProps> = ({
  stickerSet,
  size = STICKER_SIZE_PICKER_HEADER,
  noAnimate,
  observeIntersection,
  sharedCanvasRef,
}) => {
  const { loadStickers } = getActions();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const { hasThumbnail, isLottie, isVideos: isVideo } = stickerSet;

  const isIntersecting = useIsIntersecting(containerRef, observeIntersection);

  const shouldFallbackToStatic = stickerSet.stickers && isVideo && !IS_WEBM_SUPPORTED;
  const staticHash = shouldFallbackToStatic && getStickerPreviewHash(stickerSet.stickers![0].id);
  const staticMediaData = useMedia(staticHash, !isIntersecting);

  const mediaHash = ((hasThumbnail && !shouldFallbackToStatic) || isLottie) && `stickerSet${stickerSet.id}`;
  const mediaData = useMedia(mediaHash, !isIntersecting);
  const isReady = mediaData || staticMediaData;
  const transitionClassNames = useMediaTransition(isReady);

  const bounds = useBoundsInSharedCanvas(containerRef, sharedCanvasRef);

  useEffect(() => {
    if (isIntersecting && !stickerSet.stickers?.length) {
      loadStickers({
        stickerSetInfo: {
          id: stickerSet.id,
          accessHash: stickerSet.accessHash,
        },
      });
    }
  }, [isIntersecting, loadStickers, stickerSet]);

  return (
    <div ref={containerRef} className="sticker-set-cover">
      {isReady ? (
        isLottie ? (
          <AnimatedSticker
            className={transitionClassNames}
            tgsUrl={mediaData}
            size={size || bounds.size}
            play={isIntersecting && !noAnimate}
            isLowPriority={!selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet)}
            sharedCanvas={sharedCanvasRef?.current || undefined}
            sharedCanvasCoords={bounds.coords}
          />
        ) : (isVideo && !shouldFallbackToStatic) ? (
          <OptimizedVideo
            className={buildClassName(styles.video, transitionClassNames)}
            src={mediaData}
            canPlay={isIntersecting && !noAnimate}
            loop
            disablePictureInPicture
          />
        ) : (
          <img
            src={mediaData || staticMediaData}
            className={transitionClassNames}
            alt=""
          />
        )
      ) : (
        getFirstLetters(stickerSet.title, 2)
      )}
    </div>
  );
};

export default memo(StickerSetCover);
