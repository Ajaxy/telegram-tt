import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getFirstLetters } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

import AnimatedSticker from '../../common/AnimatedSticker';
import OptimizedVideo from '../../ui/OptimizedVideo';

import styles from './StickerSetCover.module.scss';

type OwnProps = {
  stickerSet: ApiStickerSet;
  size?: number;
  noAnimate?: boolean;
  observeIntersection: ObserveFn;
};

const StickerSetCover: FC<OwnProps> = ({
  stickerSet,
  size = STICKER_SIZE_PICKER_HEADER,
  noAnimate,
  observeIntersection,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const { hasThumbnail, isLottie, isVideos: isVideo } = stickerSet;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaData = useMedia((hasThumbnail || isLottie) && `stickerSet${stickerSet.id}`, !isIntersecting);
  const isReady = mediaData && (!isVideo || IS_WEBM_SUPPORTED);
  const transitionClassNames = useMediaTransition(isReady);

  return (
    <div ref={ref} className="sticker-set-cover">
      {isReady ? (
        isLottie ? (
          <AnimatedSticker
            className={transitionClassNames}
            tgsUrl={mediaData}
            size={size}
            play={isIntersecting && !noAnimate}
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
