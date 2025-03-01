import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { getStickerMediaHash } from '../../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getFirstLetters } from '../../../util/textFormat';
import { IS_WEBM_SUPPORTED } from '../../../util/windowEnvironment';

import useColorFilter from '../../../hooks/stickers/useColorFilter';
import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import useCoordsInSharedCanvas from '../../../hooks/useCoordsInSharedCanvas';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMedia from '../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';
import useCustomEmoji from '../../common/hooks/useCustomEmoji';

import AnimatedSticker from '../../common/AnimatedSticker';
import CustomEmoji from '../../common/CustomEmoji';
import OptimizedVideo from '../../ui/OptimizedVideo';

import styles from './StickerSetCover.module.scss';

type OwnProps = {
  stickerSet: ApiStickerSet;
  size?: number;
  noPlay?: boolean;
  forcePlayback?: boolean;
  observeIntersection: ObserveFn;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
};

const StickerSetCover: FC<OwnProps> = ({
  stickerSet,
  size = STICKER_SIZE_PICKER_HEADER,
  noPlay,
  forcePlayback,
  observeIntersection,
  sharedCanvasRef,
}) => {
  const { loadStickers } = getActions();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    hasThumbnail, hasVideoThumb, hasAnimatedThumb, hasStaticThumb, thumbCustomEmojiId,
  } = stickerSet;

  const { customEmoji } = useCustomEmoji(thumbCustomEmojiId);
  const hasCustomColor = customEmoji?.shouldUseTextColor;
  const customColor = useDynamicColorListener(containerRef, undefined, !hasCustomColor);
  const colorFilter = useColorFilter(customColor);

  const isIntersecting = useIsIntersecting(containerRef, observeIntersection);
  const shouldPlay = isIntersecting && !noPlay;

  const hasOnlyStaticThumb = hasStaticThumb && !hasVideoThumb && !hasAnimatedThumb && !thumbCustomEmojiId;

  const shouldFallbackToStatic = hasOnlyStaticThumb || (hasVideoThumb && !IS_WEBM_SUPPORTED && !hasAnimatedThumb);
  const staticHash = shouldFallbackToStatic && getStickerMediaHash(stickerSet.stickers![0], 'preview');
  const staticMediaData = useMedia(staticHash, !isIntersecting);

  const mediaHash = ((hasThumbnail && !shouldFallbackToStatic) || hasAnimatedThumb) && `stickerSet${stickerSet.id}`;
  const mediaData = useMedia(mediaHash, !isIntersecting);
  const isReady = thumbCustomEmojiId || mediaData || staticMediaData;
  const transitionClassNames = useMediaTransitionDeprecated(isReady);

  const coords = useCoordsInSharedCanvas(containerRef, sharedCanvasRef);

  useEffect(() => {
    if (isIntersecting && !stickerSet.stickers?.length) {
      loadStickers({
        stickerSetInfo: stickerSet,
      });
    }
  }, [isIntersecting, loadStickers, stickerSet]);

  return (
    <div ref={containerRef} className={buildClassName(styles.root, 'sticker-set-cover')}>
      {isReady ? (
        thumbCustomEmojiId ? (
          <CustomEmoji
            documentId={thumbCustomEmojiId}
            size={size}
            observeIntersectionForPlaying={observeIntersection}
            noPlay={noPlay}
          />
        ) : hasAnimatedThumb ? (
          <AnimatedSticker
            className={transitionClassNames}
            tgsUrl={mediaData}
            size={size}
            play={shouldPlay}
            isLowPriority={!selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet)}
            sharedCanvas={sharedCanvasRef?.current || undefined}
            sharedCanvasCoords={coords}
            forceAlways={forcePlayback}
          />
        ) : (hasVideoThumb && !shouldFallbackToStatic) ? (
          <OptimizedVideo
            className={buildClassName(styles.video, transitionClassNames)}
            src={mediaData}
            canPlay={shouldPlay}
            style={colorFilter}
            isPriority={forcePlayback}
            loop
            disablePictureInPicture
          />
        ) : (
          <img
            src={mediaData || staticMediaData}
            style={colorFilter}
            className={buildClassName(styles.image, transitionClassNames)}
            alt=""
            draggable={false}
          />
        )
      ) : (
        getFirstLetters(stickerSet.title, 2)
      )}
    </div>
  );
};

export default memo(StickerSetCover);
