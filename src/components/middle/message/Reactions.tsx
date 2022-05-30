import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ApiAvailableReaction, ApiMessage } from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';

import ReactionButton from './ReactionButton';

import './Reactions.scss';

type OwnProps = {
  message: ApiMessage;
  isOutside?: boolean;
  activeReaction?: ActiveReaction;
  availableReactions?: ApiAvailableReaction[];
  metaChildren?: React.ReactNode;
};

const Reactions: FC<OwnProps> = ({
  message,
  isOutside,
  activeReaction,
  availableReactions,
  metaChildren,
}) => {
  return (
    <div className={buildClassName('Reactions', isOutside && 'is-outside')}>
      {message.reactions!.results.map((reaction) => (
        <ReactionButton
          key={reaction.reaction}
          reaction={reaction}
          message={message}
          activeReaction={activeReaction}
          availableReactions={availableReactions}
        />
      ))}
      {metaChildren}
    </div>
  );
};

export default memo(Reactions);
