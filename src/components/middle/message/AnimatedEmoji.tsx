import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ActiveEmojiInteraction } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import { LIKE_STICKER_ID } from '../../common/helpers/mediaDimensions';
import {
  selectAnimatedEmoji,
  selectAnimatedEmojiEffect,
  selectAnimatedEmojiSound,
  selectLocalAnimatedEmoji,
  selectLocalAnimatedEmojiEffect,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useAnimatedEmoji from '../../common/hooks/useAnimatedEmoji';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';

import './AnimatedEmoji.scss';

type OwnProps = {
  emoji: string;
  withEffects: boolean;
  isOwn?: boolean;
  observeIntersection?: ObserveFn;
  size?: 'large' | 'medium' | 'small';
  lastSyncTime?: number;
  forceLoadPreview?: boolean;
  messageId?: number;
  chatId?: string;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
};

interface StateProps {
  sticker?: ApiSticker;
  effect?: ApiSticker;
  localSticker?: keyof typeof LOCAL_TGS_URLS;
  localEffect?: string;
  soundId?: string;
}

const QUALITY = 1;

const AnimatedEmoji: FC<OwnProps & StateProps> = ({
  isOwn,
  observeIntersection,
  lastSyncTime,
  forceLoadPreview,
  messageId,
  chatId,
  activeEmojiInteractions,
  sticker,
  effect,
  localSticker,
  localEffect,
  soundId,
}) => {
  const {
    ref,
    size,
    style,
    handleClick,
  } = useAnimatedEmoji(chatId, messageId, soundId, activeEmojiInteractions, isOwn, localEffect, effect?.emoji);
  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  return localSticker ? (
    <AnimatedIconWithPreview
      tgsUrl={LOCAL_TGS_URLS[localSticker]}
      size={size}
      quality={QUALITY}
      play={isIntersecting}
      forceOnHeavyAnimation
      ref={ref}
      className="AnimatedEmoji media-inner"
      style={style}
      onClick={handleClick}
    />
  ) : (
    <AnimatedIconFromSticker
      sticker={sticker}
      size={size}
      quality={QUALITY}
      noLoad={!isIntersecting}
      forcePreview={forceLoadPreview}
      lastSyncTime={lastSyncTime}
      play={isIntersecting}
      forceOnHeavyAnimation
      ref={ref}
      className={buildClassName('AnimatedEmoji media-inner', sticker?.id === LIKE_STICKER_ID && 'like-sticker-thumb')}
      style={style}
      onClick={handleClick}
    />
  );
};

export default memo(withGlobal<OwnProps>((global, { emoji, withEffects }) => {
  const localSticker = selectLocalAnimatedEmoji(global, emoji);

  return {
    sticker: selectAnimatedEmoji(global, emoji),
    effect: withEffects ? selectAnimatedEmojiEffect(global, emoji) : undefined,
    soundId: selectAnimatedEmojiSound(global, emoji),
    localSticker,
    localEffect: localSticker && withEffects ? selectLocalAnimatedEmojiEffect(localSticker) : undefined,
  };
})(AnimatedEmoji));
