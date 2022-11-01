import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ActiveEmojiInteraction } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { LIKE_STICKER_ID } from '../../common/helpers/mediaDimensions';
import {
  selectAnimatedEmojiEffect,
  selectAnimatedEmojiSound,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';
import useAnimatedEmoji from '../../common/hooks/useAnimatedEmoji';

import CustomEmoji from '../../common/CustomEmoji';

import './AnimatedEmoji.scss';

type OwnProps = {
  customEmojiId: string;
  withEffects: boolean;
  isOwn?: boolean;
  size?: 'large' | 'medium' | 'small';
  lastSyncTime?: number;
  forceLoadPreview?: boolean;
  messageId?: number;
  chatId?: string;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  observeIntersection?: ObserveFn;
};

interface StateProps {
  sticker?: ApiSticker;
  effect?: ApiSticker;
  soundId?: string;
}

const AnimatedCustomEmoji: FC<OwnProps & StateProps> = ({
  isOwn,
  customEmojiId,
  messageId,
  chatId,
  activeEmojiInteractions,
  sticker,
  effect,
  soundId,
  observeIntersection,
}) => {
  const {
    ref,
    size,
    style,
    handleClick,
  } = useAnimatedEmoji(
    chatId, messageId, soundId, activeEmojiInteractions, isOwn, undefined, effect?.emoji, getCustomEmojiSize(1),
  );

  return (
    <CustomEmoji
      ref={ref}
      documentId={customEmojiId}
      size={size}
      forceOnHeavyAnimation
      observeIntersection={observeIntersection}
      className={buildClassName('AnimatedEmoji media-inner', sticker?.id === LIKE_STICKER_ID && 'like-sticker-thumb')}
      onClick={handleClick}
      style={style}
    />
  );
};

export default memo(withGlobal<OwnProps>((global, { customEmojiId, withEffects }) => {
  const sticker = global.customEmojis.byId[customEmojiId];
  return {
    sticker,
    effect: sticker?.emoji && withEffects ? selectAnimatedEmojiEffect(global, sticker.emoji) : undefined,
    soundId: sticker?.emoji && selectAnimatedEmojiSound(global, sticker.emoji),
  };
})(AnimatedCustomEmoji));
