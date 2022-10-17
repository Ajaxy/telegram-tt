import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';

import type { ApiStickerSet } from '../../../api/types';

import { IS_WEBM_SUPPORTED } from '../../../util/environment';
import { getFirstLetters } from '../../../util/textFormat';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

import OptimizedVideo from '../../ui/OptimizedVideo';

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
  const isVideo = stickerSet.isVideos;

  const firstLetters = useMemo(() => {
    if ((isVideo && !IS_WEBM_SUPPORTED) || !mediaData) return getFirstLetters(stickerSet.title, 2);
    return undefined;
  }, [isVideo, mediaData, stickerSet.title]);

  return (
    <div ref={ref} className="sticker-set-cover">
      {firstLetters}
      {isVideo ? (
        <OptimizedVideo canPlay src={mediaData} className={transitionClassNames} loop disablePictureInPicture />
      ) : (
        <img src={mediaData} className={transitionClassNames} alt="" />
      )}
    </div>
  );
};

export default memo(StickerSetCover);
