import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import useFlag from '../../../../hooks/useFlag';
import useMedia from '../../../../hooks/useMedia';

import AnimatedSticker from '../../../common/AnimatedSticker';
import Icon from '../../../common/Icon';

import styles from './ReactionSelectorReaction.module.scss';

const REACTION_SIZE = 2 * REM;

type OwnProps = {
  reaction: ApiAvailableReaction;
  isReady?: boolean;
  chosen?: boolean;
  noAppearAnimation?: boolean;
  isLocked?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const ReactionSelectorReaction: FC<OwnProps> = ({
  reaction,
  isReady,
  noAppearAnimation,
  chosen,
  isLocked,
  onToggleReaction,
}) => {
  const mediaAppearData = useMedia(`sticker${reaction.appearAnimation?.id}`, !isReady || noAppearAnimation);
  const mediaData = useMedia(`document${reaction.selectAnimation?.id}`, !isReady || noAppearAnimation);
  const staticIconData = useMedia(`document${reaction.staticIcon?.id}`, !noAppearAnimation);
  const [isAnimationLoaded, markAnimationLoaded] = useFlag();

  const [isFirstPlay, , unmarkIsFirstPlay] = useFlag(true);
  const [isActivated, activate, deactivate] = useFlag();

  function handleClick() {
    onToggleReaction(reaction.reaction);
  }

  return (
    <div
      className={buildClassName(styles.root, chosen && styles.chosen)}
      onClick={handleClick}
      onMouseEnter={isReady && !isFirstPlay ? activate : undefined}
    >
      {noAppearAnimation && (
        <img
          className={styles.staticIcon}
          src={staticIconData}
          alt={reaction.reaction.emoticon}
          draggable={false}
        />
      )}
      {!isAnimationLoaded && !noAppearAnimation && (
        <AnimatedSticker
          key={reaction.appearAnimation?.id}
          tgsUrl={mediaAppearData}
          play={isFirstPlay}
          noLoop
          size={REACTION_SIZE}
          onEnded={unmarkIsFirstPlay}
          forceAlways
        />
      )}
      {!isFirstPlay && !noAppearAnimation && (
        <AnimatedSticker
          key={reaction.selectAnimation?.id}
          tgsUrl={mediaData}
          play={isActivated}
          noLoop
          size={REACTION_SIZE}
          onLoad={markAnimationLoaded}
          onEnded={deactivate}
          forceAlways
        />
      )}
      {isLocked && (
        <Icon className={styles.lock} name="lock-badge" />
      )}
    </div>
  );
};

export default memo(ReactionSelectorReaction);
