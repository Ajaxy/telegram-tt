import React, {
  FC, memo,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';
import { ActiveEmojiInteraction } from '../../global/types';

import { LIKE_STICKER_ID } from './helpers/mediaDimensions';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useAnimatedEmoji from './hooks/useAnimatedEmoji';

import AnimatedSticker from './AnimatedSticker';

import './AnimatedEmoji.scss';

type OwnProps = {
  sticker: ApiSticker;
  effect?: ApiSticker;
  isOwn?: boolean;
  soundId?: string;
  observeIntersection?: ObserveFn;
  size?: 'large' | 'medium' | 'small';
  lastSyncTime?: number;
  forceLoadPreview?: boolean;
  messageId?: number;
  chatId?: string;
  activeEmojiInteraction?: ActiveEmojiInteraction;
};

const QUALITY = 1;

const AnimatedEmoji: FC<OwnProps> = ({
  sticker,
  effect,
  isOwn,
  soundId,
  size = 'medium',
  observeIntersection,
  lastSyncTime,
  forceLoadPreview,
  messageId,
  chatId,
  activeEmojiInteraction,
}) => {
  const {
    markAnimationLoaded,
    isAnimationLoaded,
    ref,
    width,
    style,
    handleClick,
    playKey,
  } = useAnimatedEmoji(size, chatId, messageId, soundId, activeEmojiInteraction, isOwn, undefined, effect?.emoji);

  const localMediaHash = `sticker${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const thumbDataUri = sticker.thumbnail?.dataUri;
  const previewBlobUrl = useMedia(
    `${localMediaHash}?size=m`,
    !isIntersecting && !forceLoadPreview,
    ApiMediaFormat.BlobUrl,
    lastSyncTime,
  );
  const transitionClassNames = useMediaTransition(previewBlobUrl);

  const mediaData = useMedia(localMediaHash, !isIntersecting, ApiMediaFormat.Lottie, lastSyncTime);
  const isMediaLoaded = Boolean(mediaData);

  return (
    <div
      ref={ref}
      className="AnimatedEmoji media-inner"
      // @ts-ignore teact feature
      style={style}
      onClick={handleClick}
    >
      {!isAnimationLoaded && thumbDataUri && (
        <img src={thumbDataUri} className={sticker.id === LIKE_STICKER_ID ? 'like-sticker-thumb' : undefined} alt="" />
      )}
      {!isAnimationLoaded && previewBlobUrl && (
        <img src={previewBlobUrl} className={transitionClassNames} alt="" />
      )}
      {isMediaLoaded && localMediaHash && (
        <AnimatedSticker
          key={localMediaHash}
          id={localMediaHash}
          animationData={mediaData as AnyLiteral}
          size={width}
          quality={QUALITY}
          play={isIntersecting && playKey}
          noLoop
          onLoad={markAnimationLoaded}
        />
      )}
    </div>
  );
};

export default memo(AnimatedEmoji);
