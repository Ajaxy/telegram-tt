import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { ApiMediaFormat } from '../../api/types';

import { isSameReaction } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import CustomEmoji from './CustomEmoji';

import './ReactionStaticEmoji.scss';

import blankUrl from '../../assets/blank.png';

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
  const isCustom = 'documentId' in reaction;
  const availableReaction = useMemo(() => (
    availableReactions?.find((available) => isSameReaction(available.reaction, reaction))
  ), [availableReactions, reaction]);
  const staticIconId = availableReaction?.staticIcon?.id;
  const mediaData = useMedia(`document${staticIconId}`, !staticIconId, ApiMediaFormat.BlobUrl);

  const transitionClassNames = useMediaTransition(mediaData);

  const shouldApplySizeFix = 'emoticon' in reaction && reaction.emoticon === '🦄';
  const shouldReplaceWithHeartIcon = withIconHeart && 'emoticon' in reaction && reaction.emoticon === '❤';

  if (isCustom) {
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
      <i className="ReactionStaticEmoji icon icon-heart" style={`font-size: ${size}px; width: ${size}px`} />
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
