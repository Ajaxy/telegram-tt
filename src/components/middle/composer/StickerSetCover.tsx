import React, {
  FC, memo, useMemo, useRef,
} from '../../../lib/teact/teact';

import { ApiStickerSet } from '../../../api/types';

import { IS_WEBM_SUPPORTED } from '../../../util/environment';
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
  const isGif = stickerSet.isGifs;

  const firstLetters = useMemo(() => {
    if ((isGif && !IS_WEBM_SUPPORTED) || !mediaData) return getFirstLetters(stickerSet.title, 2);
  }, [isGif, mediaData, stickerSet.title]);

  return (
    <div ref={ref} className="sticker-set-cover">
      {firstLetters}
      {isGif ? (
        <video src={mediaData} className={transitionClassNames} loop autoPlay />
      ) : (
        <img src={mediaData} className={transitionClassNames} alt="" />
      )}
    </div>
  );
};

export default memo(StickerSetCover);
