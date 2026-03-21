import type { FC } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { isSameReaction } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useThumbnail from '../../../hooks/media/useThumbnail';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

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
  const staticIcon = availableReaction?.staticIcon;
  const staticIconId = staticIcon?.id;
  const mediaHash = staticIconId ? `document${staticIconId}` : undefined;
  const cacheBuster = availableReaction?.isLocalCache ? 0 : 1;
  const mediaData = useMedia(mediaHash, false, undefined, undefined, cacheBuster);
  const thumbDataUri = useThumbnail(staticIcon?.thumbnail);

  const { ref: thumbRef } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(thumbDataUri && !mediaData),
  });
  const { ref: mediaRef } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(mediaData),
  });

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
    <div
      className={buildClassName('ReactionStaticEmoji', className)}
      style={size ? `width: ${size}px; height: ${size}px` : undefined}
    >
      <img
        ref={thumbRef}
        className="thumb"
        src={thumbDataUri}
        alt=""
        draggable={false}
      />
      <img
        ref={mediaRef}
        className={buildClassName('media', shouldApplySizeFix && 'with-unicorn-fix')}
        src={mediaData || blankUrl}
        alt={availableReaction?.title}
        draggable={false}
      />
    </div>
  );
};

export default memo(ReactionStaticEmoji);
