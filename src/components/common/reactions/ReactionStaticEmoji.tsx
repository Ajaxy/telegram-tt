import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { isSameReaction } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useMedia from '../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';

import CustomEmoji from '../CustomEmoji';
import Icon from '../icons/Icon';

import './ReactionStaticEmoji.scss';

import blankUrl from '../../../assets/blank.png';

type OwnProps = {
  reaction: ApiReaction;
  availableReactions?: ApiAvailableReaction[];
  className?: string;
  size?: number;
  withIconHeart?: boolean;
  observeIntersection?: ObserveFn;
};

const ReactionStaticEmoji: FC<OwnProps> = ({
  reaction,
  availableReactions,
  className,
  size,
  withIconHeart,
  observeIntersection,
}) => {
  const availableReaction = useMemo(() => (
    availableReactions?.find((available) => isSameReaction(available.reaction, reaction))
  ), [availableReactions, reaction]);
  const staticIconId = availableReaction?.staticIcon?.id;
  const mediaHash = staticIconId ? `document${staticIconId}` : undefined;
  const mediaData = useMedia(mediaHash);

  const transitionClassNames = useMediaTransitionDeprecated(mediaData);

  const shouldApplySizeFix = reaction.type === 'emoji' && reaction.emoticon === '🦄';
  const shouldReplaceWithHeartIcon = withIconHeart && reaction.type === 'emoji' && reaction.emoticon === '❤';

  if (reaction.type === 'custom') {
    return (
      <CustomEmoji
        documentId={reaction.documentId}
        className={buildClassName('ReactionStaticEmoji', className)}
        size={size}
        observeIntersectionForPlaying={observeIntersection}
      />
    );
  }

  if (shouldReplaceWithHeartIcon) {
    return (
      <Icon name="heart" className="ReactionStaticEmoji" style={`font-size: ${size}px; width: ${size}px`} />
    );
  }

  return (
    <img
      className={buildClassName(
        'ReactionStaticEmoji',
        shouldApplySizeFix && 'with-unicorn-fix',
        transitionClassNames,
        className,
      )}
      style={size ? `width: ${size}px; height: ${size}px` : undefined}
      src={mediaData || blankUrl}
      alt={availableReaction?.title}
      draggable={false}
    />
  );
};

export default memo(ReactionStaticEmoji);
