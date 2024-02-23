import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiReaction, ApiReactionCustomEmoji } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import CustomEmoji from '../../../common/CustomEmoji';
import Icon from '../../../common/Icon';

import styles from './ReactionSelectorReaction.module.scss';

const REACTION_SIZE = 2 * REM;

type OwnProps = {
  reaction: ApiReactionCustomEmoji;
  chosen?: boolean;
  isReady?: boolean;
  noAppearAnimation?: boolean;
  style?: string;
  isLocked?: boolean;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const ReactionSelectorCustomReaction: FC<OwnProps> = ({
  reaction,
  chosen,
  isReady,
  noAppearAnimation,
  style,
  isLocked,
  onToggleReaction,
}) => {
  function handleClick() {
    onToggleReaction(reaction);
  }

  return (
    <div
      className={buildClassName(
        styles.root,
        styles.custom,
        chosen && styles.chosen,
        !noAppearAnimation && isReady && styles.customAnimated,
        noAppearAnimation && styles.visible,
      )}
      style={style}
      onClick={handleClick}
    >
      <CustomEmoji
        documentId={reaction.documentId}
        size={REACTION_SIZE}
      />
      {isLocked && (
        <Icon className={styles.lock} name="lock-badge" />
      )}
    </div>
  );
};

export default memo(ReactionSelectorCustomReaction);
