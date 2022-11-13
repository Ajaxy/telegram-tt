import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { selectIsAlwaysHighPriorityEmoji } from '../../../global/selectors';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getFirstLetters } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';
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
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const { hasThumbnail, isLottie, isVideos: isVideo } = stickerSet;

  const isIntersecting = useIsIntersecting(containerRef, observeIntersection);

  const mediaData = useMedia((hasThumbnail || isLottie) && `stickerSet${stickerSet.id}`, !isIntersecting);
  const isReady = mediaData && (!isVideo || IS_WEBM_SUPPORTED);
  const transitionClassNames = useMediaTransition(isReady);

  const bounds = useBoundsInSharedCanvas(containerRef, sharedCanvasRef);

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
        ) : isVideo ? (
          <OptimizedVideo
            className={buildClassName(styles.video, transitionClassNames)}
            src={mediaData}
            canPlay={isIntersecting && !noAnimate}
            loop
            disablePictureInPicture
          />
        ) : (
          <img
            src={mediaData}
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
