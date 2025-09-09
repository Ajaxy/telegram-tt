import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ActiveEmojiInteraction } from '../../../types';

import {
  selectAnimatedEmojiEffect,
  selectAnimatedEmojiSound,
  selectCanPlayAnimatedEmojis,
  selectCustomEmoji,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { LIKE_STICKER_ID } from '../../common/helpers/mediaDimensions';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';

import useAnimatedEmoji from '../../common/hooks/useAnimatedEmoji';

import CustomEmoji from '../../common/CustomEmoji';

import './AnimatedEmoji.scss';

type OwnProps = {
  customEmojiId: string;
  withEffects?: boolean;
  isOwn?: boolean;
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
  noPlay?: boolean;
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
  noPlay,
  observeIntersection,
}) => {
  const {
    ref,
    size,
    style,
    handleClick,
  } = useAnimatedEmoji(
    chatId, messageId, soundId, activeEmojiInteractions, isOwn, effect?.emoji, getCustomEmojiSize(1),
  );

  return (
    <CustomEmoji
      ref={ref}
      documentId={customEmojiId}
      className={buildClassName('AnimatedEmoji media-inner', sticker?.id === LIKE_STICKER_ID && 'like-sticker-thumb')}
      style={style}
      size={size}
      isBig
      noPlay={noPlay}
      withSharedAnimation
      forceOnHeavyAnimation={Boolean(effect && activeEmojiInteractions?.length)}
      observeIntersectionForLoading={observeIntersection}
      onClick={handleClick}
    />
  );
};

export default memo(withGlobal<OwnProps>((global, { customEmojiId, withEffects }) => {
  const sticker = selectCustomEmoji(global, customEmojiId);

  return {
    sticker,
    effect: sticker?.emoji && withEffects ? selectAnimatedEmojiEffect(global, sticker.emoji) : undefined,
    soundId: sticker?.emoji && selectAnimatedEmojiSound(global, sticker.emoji),
    noPlay: !selectCanPlayAnimatedEmojis(global),
  };
})(AnimatedCustomEmoji));
