import React, {
  FC, memo,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiSticker } from '../../api/types';
import { ActiveEmojiInteraction } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useAnimatedEmoji from './hooks/useAnimatedEmoji';
import { LIKE_STICKER_ID } from './helpers/mediaDimensions';

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
  activeEmojiInteractions?: ActiveEmojiInteraction[];
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
  activeEmojiInteractions,
}) => {
  const {
    markAnimationLoaded,
    isAnimationLoaded,
    ref,
    width,
    style,
    handleClick,
    playKey,
  } = useAnimatedEmoji(size, chatId, messageId, soundId, activeEmojiInteractions, isOwn, undefined, effect?.emoji);

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
      className={buildClassName('AnimatedEmoji media-inner', sticker.id === LIKE_STICKER_ID && 'like-sticker-thumb')}
      style={style}
      onClick={handleClick}
    >
      {!isAnimationLoaded && thumbDataUri && (
        <img src={thumbDataUri} alt="" />
      )}
      {!isAnimationLoaded && previewBlobUrl && (
        <img src={previewBlobUrl} className={transitionClassNames} alt="" />
      )}
      {isMediaLoaded && localMediaHash && (
        <AnimatedSticker
          key={localMediaHash}
          id={localMediaHash}
          animationData={mediaData!}
          size={width}
          quality={QUALITY}
          play={isIntersecting && playKey}
          forceOnHeavyAnimation
          noLoop
          onLoad={markAnimationLoaded}
        />
      )}
    </div>
  );
};

export default memo(AnimatedEmoji);
