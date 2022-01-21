import React, {
  FC, memo, useEffect, useState,
} from '../../lib/teact/teact';

import { ActiveEmojiInteraction } from '../../global/types';

import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import getAnimationData, { ANIMATED_STICKERS_PATHS } from './helpers/animatedAssets';
import useAnimatedEmoji from './hooks/useAnimatedEmoji';

import AnimatedSticker from './AnimatedSticker';

const QUALITY = 1;

type OwnProps = {
  localSticker?: string;
  localEffect?: string;
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

const LocalAnimatedEmoji: FC<OwnProps> = ({
  localSticker,
  localEffect,
  isOwn,
  soundId,
  size = 'medium',
  observeIntersection,
  messageId,
  chatId,
  activeEmojiInteraction,
}) => {
  const {
    playKey,
    ref,
    style,
    width,
    handleClick,
    markAnimationLoaded,
  } = useAnimatedEmoji(size, chatId, messageId, soundId, activeEmojiInteraction, isOwn, localEffect);
  const id = `local_emoji_${localSticker}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [localStickerAnimationData, setLocalStickerAnimationData] = useState<AnyLiteral>();
  useEffect(() => {
    if (localSticker) {
      getAnimationData(localSticker as keyof typeof ANIMATED_STICKERS_PATHS).then((data) => {
        setLocalStickerAnimationData(data);
      });
    }
  }, [localSticker]);

  return (
    <div
      ref={ref}
      className="AnimatedEmoji media-inner"
      // @ts-ignore teact feature
      style={style}
      onClick={handleClick}
    >
      {localStickerAnimationData && (
        <AnimatedSticker
          key={id}
          id={id}
          animationData={localStickerAnimationData}
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

export default memo(LocalAnimatedEmoji);
