import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ApiReaction, ApiReactionCustomEmoji } from '../../../api/types';

import { createClassNameBuilder } from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import CustomEmoji from '../../common/CustomEmoji';

import './ReactionSelectorReaction.scss';

const REACTION_SIZE = 2 * REM;

type OwnProps = {
  reaction: ApiReactionCustomEmoji;
  chosen?: boolean;
  isReady?: boolean;
  noAppearAnimation?: boolean;
  style?: string;
  onToggleReaction: (reaction: ApiReaction) => void;
};

const cn = createClassNameBuilder('ReactionSelectorReaction');

const ReactionSelectorCustomReaction: FC<OwnProps> = ({
  reaction,
  chosen,
  isReady,
  noAppearAnimation,
  style,
  onToggleReaction,
}) => {
  function handleClick() {
    onToggleReaction(reaction);
  }

  return (
    <div
      className={cn(
        '&',
        'custom',
        chosen && 'chosen',
        !noAppearAnimation && isReady && 'custom-animated',
        noAppearAnimation && 'visible',
      )}
      style={style}
      onClick={handleClick}
    >
      <CustomEmoji
        documentId={reaction.documentId}
        size={REACTION_SIZE}
      />
    </div>
  );
};

export default memo(ReactionSelectorCustomReaction);
