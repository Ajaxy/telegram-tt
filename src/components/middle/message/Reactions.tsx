import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getReactionUniqueKey } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import ReactionButton from './ReactionButton';

import './Reactions.scss';

type OwnProps = {
  message: ApiMessage;
  isOutside?: boolean;
  maxWidth?: number;
  metaChildren?: React.ReactNode;
  observeIntersection?: ObserveFn;
  noRecentReactors?: boolean;
};

const MAX_RECENT_AVATARS = 3;

const Reactions: FC<OwnProps> = ({
  message,
  isOutside,
  maxWidth,
  metaChildren,
  observeIntersection,
  noRecentReactors,
}) => {
  const lang = useLang();

  const totalCount = useMemo(() => (
    message.reactions!.results.reduce((acc, reaction) => acc + reaction.count, 0)
  ), [message]);

  return (
    <div
      className={buildClassName('Reactions', isOutside && 'is-outside')}
      style={maxWidth ? `max-width: ${maxWidth}px` : undefined}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {message.reactions!.results.map((reaction) => (
        <ReactionButton
          key={getReactionUniqueKey(reaction.reaction)}
          reaction={reaction}
          message={message}
          withRecentReactors={totalCount <= MAX_RECENT_AVATARS && !noRecentReactors}
          observeIntersection={observeIntersection}
        />
      ))}
      {metaChildren}
    </div>
  );
};

export default memo(Reactions);
