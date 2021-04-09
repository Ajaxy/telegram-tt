import React, { FC, memo, useRef } from '../../../lib/teact/teact';

import { ApiStickerSet } from '../../../api/types';

import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import { getFirstLetters } from '../../../util/textFormat';

type OwnProps = {
  stickerSet: ApiStickerSet;
  observeIntersection: ObserveFn;
};

const StickerSetCover: FC<OwnProps> = ({ stickerSet, observeIntersection }) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaData = useMedia(stickerSet.hasThumbnail && `stickerSet${stickerSet.id}`, !isIntersecting);
  const { shouldRenderFullMedia, transitionClassNames } = useTransitionForMedia(mediaData, 'slow');

  return (
    <div ref={ref} className="sticker-set-cover">
      {!shouldRenderFullMedia && getFirstLetters(stickerSet.title, 2)}
      {shouldRenderFullMedia && (
        <img src={mediaData} className={transitionClassNames} alt="" />
      )}
    </div>
  );
};

export default memo(StickerSetCover);
