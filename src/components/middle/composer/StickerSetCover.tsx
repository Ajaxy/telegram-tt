import React, {
  FC, memo, useMemo, useRef,
} from '../../../lib/teact/teact';

import { ApiStickerSet } from '../../../api/types';

import { getFirstLetters } from '../../../util/textFormat';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

type OwnProps = {
  stickerSet: ApiStickerSet;
  observeIntersection: ObserveFn;
};

const StickerSetCover: FC<OwnProps> = ({ stickerSet, observeIntersection }) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaData = useMedia(stickerSet.hasThumbnail && `stickerSet${stickerSet.id}`, !isIntersecting);
  const transitionClassNames = useMediaTransition(mediaData);

  const firstLetters = useMemo(() => {
    if (mediaData) return undefined;

    return getFirstLetters(stickerSet.title, 2);
  }, [mediaData, stickerSet.title]);

  return (
    <div ref={ref} className="sticker-set-cover">
      {firstLetters}
      <img src={mediaData} className={transitionClassNames} alt="" />
    </div>
  );
};

export default memo(StickerSetCover);
