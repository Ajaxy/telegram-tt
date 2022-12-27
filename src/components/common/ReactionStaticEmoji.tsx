import React, { memo, useMemo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';
import type { ApiAvailableReaction, ApiReaction } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { ApiMediaFormat } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { isSameReaction } from '../../global/helpers';

import useMediaTransition from '../../hooks/useMediaTransition';
import useMedia from '../../hooks/useMedia';

import CustomEmoji from './CustomEmoji';

import blankUrl from '../../assets/blank.png';
import './ReactionStaticEmoji.scss';

type OwnProps = {
  reaction: ApiReaction;
  availableReactions?: ApiAvailableReaction[];
  className?: string;
  size?: number;
  observeIntersection?: ObserveFn;
};

const ReactionStaticEmoji: FC<OwnProps> = ({
  reaction,
  availableReactions,
  className,
  size,
  observeIntersection,
}) => {
  const isCustom = 'documentId' in reaction;
  const availableReaction = useMemo(() => (
    availableReactions?.find((available) => isSameReaction(available.reaction, reaction))
  ), [availableReactions, reaction]);
  const staticIconId = availableReaction?.staticIcon?.id;
  const mediaData = useMedia(`document${staticIconId}`, !staticIconId, ApiMediaFormat.BlobUrl);

  const transitionClassNames = useMediaTransition(mediaData);

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

  return (
    <img
      className={buildClassName('ReactionStaticEmoji', transitionClassNames, className)}
      style={size ? `width: ${size}px; height: ${size}px` : undefined}
      src={mediaData || blankUrl}
      alt={availableReaction?.title}
    />
  );
};

export default memo(ReactionStaticEmoji);
