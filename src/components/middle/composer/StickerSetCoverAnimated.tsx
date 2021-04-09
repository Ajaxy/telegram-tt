import React, { FC, memo, useRef } from '../../../lib/teact/teact';

import { ApiMediaFormat, ApiStickerSet } from '../../../api/types';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import { getFirstLetters } from '../../../util/textFormat';

import AnimatedSticker from '../../common/AnimatedSticker';

type OwnProps = {
  size?: number;
  stickerSet: ApiStickerSet;
  observeIntersection: ObserveFn;
};

const StickerSetCoverAnimated: FC<OwnProps> = ({
  size = STICKER_SIZE_PICKER_HEADER,
  stickerSet,
  observeIntersection,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaHash = `stickerSet${stickerSet.id}`;
  const lottieData = useMedia(mediaHash, !isIntersecting, ApiMediaFormat.Lottie);
  const { shouldRenderFullMedia, transitionClassNames } = useTransitionForMedia(lottieData, 'slow');

  return (
    <div ref={ref} className="sticker-set-cover">
      {!shouldRenderFullMedia && getFirstLetters(stickerSet.title, 2)}
      {shouldRenderFullMedia && lottieData && (
        <AnimatedSticker
          id={mediaHash}
          size={size}
          animationData={lottieData}
          className={transitionClassNames}
        />
      )}
    </div>
  );
};

export default memo(StickerSetCoverAnimated);
