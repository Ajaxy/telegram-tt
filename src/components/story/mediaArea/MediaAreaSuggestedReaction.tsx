import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMediaAreaSuggestedReaction, ApiStory } from '../../../api/types';

import { getStoryKey, isSameReaction, isUserId } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

import ReactionAnimatedEmoji from '../../common/reactions/ReactionAnimatedEmoji';

import styles from './MediaArea.module.scss';

type OwnProps = {
  story: ApiStory;
  mediaArea: ApiMediaAreaSuggestedReaction;
  index: number;
  isPreview?: boolean;
  className?: string;
  style?: string;
};

const REACTION_SIZE_MULTIPLIER = 0.6;
const EFFECT_SIZE_MULTIPLIER = 4;

const MediaAreaSuggestedReaction = ({
  story,
  mediaArea,
  index,
  className,
  style,
  isPreview,
}: OwnProps) => {
  const { sendStoryReaction } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const [customEmojiSize, setCustomEmojiSize] = useState(1.5 * REM);

  const { peerId, id, views } = story;
  const { reactions } = views || {};
  const { reaction, isDark, isFlipped } = mediaArea;

  const isChannel = !isUserId(peerId);
  const containerId = `${getStoryKey(peerId, id)}-${index}-${isPreview ? 'preview' : 'viewer'}`;

  const reactionCount = useMemo(() => (
    reactions?.find((r) => isSameReaction(r.reaction, reaction))?.count
  ), [reaction, reactions]);
  const shouldDisplayCount = !isPreview && Boolean(reactionCount) && isChannel;

  const updateCustomEmojiSize = useLastCallback(() => {
    if (!ref.current) return;
    const height = ref.current.clientHeight;
    setCustomEmojiSize(Math.round(height * REACTION_SIZE_MULTIPLIER));
  });

  useEffectWithPrevDeps(([prevReactionCount]) => {
    if (Boolean(reactionCount) !== Boolean(prevReactionCount)) {
      updateCustomEmojiSize();
    }
  }, [reactionCount]);

  useResizeObserver(ref, updateCustomEmojiSize);

  const handleClick = useLastCallback(() => {
    sendStoryReaction({
      peerId,
      storyId: id,
      containerId,
      reaction,
    });
  });

  return (
    <div
      ref={ref}
      className={buildClassName(styles.suggestedReaction, isDark && styles.dark, className)}
      style={buildStyle(style, `--custom-emoji-size: ${customEmojiSize}px`)}
      onClick={handleClick}
    >
      <div
        className={buildClassName(styles.background, isFlipped && styles.flipped)}
      />
      {Boolean(customEmojiSize) && (
        <ReactionAnimatedEmoji
          className={buildClassName(styles.reaction, shouldDisplayCount && styles.withCount)}
          reaction={reaction}
          containerId={containerId}
          size={customEmojiSize}
          effectSize={customEmojiSize * EFFECT_SIZE_MULTIPLIER}
          shouldPause={isPreview}
          shouldLoop={!isPreview}
        />
      )}
      {shouldDisplayCount && (
        <span className={styles.reactionCount}>{reactionCount}</span>
      )}
    </div>
  );
};

export default memo(MediaAreaSuggestedReaction);
