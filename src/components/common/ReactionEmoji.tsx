import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiAvailableReaction, ApiReaction } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { EMOJI_SIZE_PICKER } from '../../config';
import { getDocumentMediaHash, isSameReaction } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useCoordsInSharedCanvas from '../../hooks/useCoordsInSharedCanvas';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';
import CustomEmoji from './CustomEmoji';

import styles from './ReactionEmoji.module.scss';

type OwnProps = {
  reaction: ApiReaction;
  availableReactions?: ApiAvailableReaction[];
  className?: string;
  isSelected?: boolean;
  loadAndPlay?: boolean;
  observeIntersection?: ObserveFn;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: React.RefObject<HTMLCanvasElement>;
  forcePlayback?: boolean;
  onClick: (reaction: ApiReaction) => void;
};

const ReactionEmoji: FC<OwnProps> = ({
  reaction,
  availableReactions,
  isSelected,
  loadAndPlay,
  observeIntersection,
  sharedCanvasRef,
  sharedCanvasHqRef,
  forcePlayback,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const isCustom = 'documentId' in reaction;
  const availableReaction = useMemo(() => (
    availableReactions?.find((available) => isSameReaction(available.reaction, reaction))
  ), [availableReactions, reaction]);
  const thumbDataUri = availableReaction?.staticIcon?.thumbnail?.dataUri;
  const animationId = availableReaction?.selectAnimation?.id;
  const coords = useCoordsInSharedCanvas(ref, sharedCanvasRef);
  const mediaData = useMedia(
    availableReaction?.selectAnimation ? getDocumentMediaHash(availableReaction.selectAnimation) : undefined,
    !animationId,
  );
  const handleClick = useLastCallback(() => {
    onClick(reaction);
  });

  const transitionClassNames = useMediaTransition(mediaData);
  const fullClassName = buildClassName(
    styles.root,
    isSelected && styles.selected,
    !isCustom && 'sticker-reaction',
  );

  return (
    <div
      ref={ref}
      className={fullClassName}
      onClick={handleClick}
      title={availableReaction?.title}
      data-sticker-id={isCustom ? reaction.documentId : undefined}
    >
      {isCustom ? (
        <CustomEmoji
          ref={ref}
          documentId={reaction.documentId}
          size={EMOJI_SIZE_PICKER}
          noPlay={!loadAndPlay}
          observeIntersectionForPlaying={observeIntersection}
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          withTranslucentThumb
          forceAlways={forcePlayback}
        />
      ) : (
        <AnimatedIconWithPreview
          tgsUrl={mediaData}
          thumbDataUri={thumbDataUri}
          play={loadAndPlay}
          noLoop={false}
          size={EMOJI_SIZE_PICKER}
          isLowPriority
          className={transitionClassNames}
          sharedCanvas={sharedCanvasRef!.current || undefined}
          sharedCanvasCoords={coords}
          forceAlways={forcePlayback}
        />
      )}
    </div>
  );
};

export default memo(ReactionEmoji);
