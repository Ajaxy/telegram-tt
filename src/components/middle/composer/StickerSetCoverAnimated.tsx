import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';

import type { ApiStickerSet } from '../../../api/types';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';
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
  const lottieData = useMedia(mediaHash, !isIntersecting);
  const transitionClassNames = useMediaTransition(lottieData);

  const firstLetters = useMemo(() => {
    if (lottieData) return undefined;

    return getFirstLetters(stickerSet.title, 2);
  }, [lottieData, stickerSet.title]);

  return (
    <div ref={ref} className="sticker-set-cover">
      {firstLetters}
      {lottieData && (
        <AnimatedSticker
          size={size}
          tgsUrl={lottieData}
          className={transitionClassNames}
        />
      )}
    </div>
  );
};

export default memo(StickerSetCoverAnimated);
