import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ActiveEmojiInteraction } from '../../../types';

import {
  selectAnimatedEmoji,
  selectAnimatedEmojiEffect,
  selectAnimatedEmojiSound,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LIKE_STICKER_ID } from '../../common/helpers/mediaDimensions';

import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useAnimatedEmoji from '../../common/hooks/useAnimatedEmoji';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';

import './AnimatedEmoji.scss';

type OwnProps = {
  emoji: string;
  withEffects?: boolean;
  isOwn?: boolean;
  observeIntersection?: ObserveFn;
  forceLoadPreview?: boolean;
  messageId?: number;
  chatId?: string;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
};

interface StateProps {
  sticker?: ApiSticker;
  effect?: ApiSticker;
  soundId?: string;
}

const QUALITY = 1;

const AnimatedEmoji: FC<OwnProps & StateProps> = ({
  isOwn,
  observeIntersection,
  forceLoadPreview,
  messageId,
  chatId,
  activeEmojiInteractions,
  sticker,
  effect,
  soundId,
}) => {
  const {
    ref,
    size,
    style,
    handleClick,
  } = useAnimatedEmoji(chatId, messageId, soundId, activeEmojiInteractions, isOwn, effect?.emoji);
  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  return (
    <AnimatedIconFromSticker
      sticker={sticker}
      size={size}
      quality={QUALITY}
      noLoad={!isIntersecting}
      forcePreview={forceLoadPreview}
      play={isIntersecting}
      forceAlways
      ref={ref}
      className={buildClassName('AnimatedEmoji media-inner', sticker?.id === LIKE_STICKER_ID && 'like-sticker-thumb')}
      style={style}
      onClick={handleClick}
    />
  );
};

export default memo(withGlobal<OwnProps>((global, { emoji, withEffects }) => {
  return {
    sticker: selectAnimatedEmoji(global, emoji),
    effect: withEffects ? selectAnimatedEmojiEffect(global, emoji) : undefined,
    soundId: selectAnimatedEmojiSound(global, emoji),
  };
})(AnimatedEmoji));
