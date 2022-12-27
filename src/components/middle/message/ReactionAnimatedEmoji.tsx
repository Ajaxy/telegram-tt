import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ActiveReaction } from '../../../global/types';
import type { ApiAvailableReaction, ApiReaction, ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import buildClassName from '../../../util/buildClassName';
import { isSameReaction } from '../../../global/helpers';
import { REM } from '../../common/helpers/mediaDimensions';

import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useCustomEmoji from '../../common/hooks/useCustomEmoji';

import CustomEmoji from '../../common/CustomEmoji';
import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import AnimatedSticker from '../../common/AnimatedSticker';
import CustomReactionAnimation from './CustomReactionAnimation';

import styles from './ReactionAnimatedEmoji.module.scss';

type OwnProps = {
  reaction: ApiReaction;
  activeReactions?: ActiveReaction[];
  availableReactions?: ApiAvailableReaction[];
  genericEffects?: ApiStickerSet;
  observeIntersection?: ObserveFn;
};

const CENTER_ICON_SIZE = 1.875 * REM;
const EFFECT_SIZE = 6.25 * REM;

const ReactionAnimatedEmoji: FC<OwnProps> = ({
  reaction,
  genericEffects,
  activeReactions,
  availableReactions,
  observeIntersection,
}) => {
  const { stopActiveReaction } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isCustom = 'documentId' in reaction;

  const availableReaction = useMemo(() => (
    availableReactions?.find((r) => isSameReaction(r.reaction, reaction))
  ), [availableReactions, reaction]);
  const centerIconId = availableReaction?.centerIcon?.id;

  const customEmoji = useCustomEmoji(isCustom ? reaction.documentId : undefined);

  const assignedEffectId = useMemo(() => {
    if (!isCustom) return availableReaction?.aroundAnimation?.id;

    if (!customEmoji) return undefined;
    const assignedId = availableReactions?.find((available) => available.reaction.emoticon === customEmoji.emoji)
      ?.aroundAnimation?.id;
    return assignedId;
  }, [availableReaction, availableReactions, customEmoji, isCustom]);

  const effectId = useMemo(() => {
    if (assignedEffectId) {
      return assignedEffectId;
    }

    if (!genericEffects?.stickers) {
      return undefined;
    }

    const { stickers } = genericEffects;
    const randomIndex = Math.floor(Math.random() * stickers.length);

    return stickers[randomIndex].id;
  }, [assignedEffectId, genericEffects]);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const mediaHashCenterIcon = centerIconId && `sticker${centerIconId}`;
  const mediaHashEffect = effectId && `sticker${effectId}`;

  const mediaDataCenterIcon = useMedia(mediaHashCenterIcon, !centerIconId);
  const mediaDataEffect = useMedia(mediaHashEffect, !effectId);

  const activeReaction = useMemo(() => (
    activeReactions?.find((active) => isSameReaction(active.reaction, reaction))
  ), [activeReactions, reaction]);

  const shouldPlay = Boolean(activeReaction && (isCustom || mediaDataCenterIcon) && mediaDataEffect);
  const {
    shouldRender: shouldRenderAnimation,
    transitionClassNames: animationClassNames,
  } = useShowTransition(shouldPlay, undefined, true, 'slow');

  const handleEnded = useCallback(() => {
    if (!activeReaction?.messageId) return;
    stopActiveReaction({ messageId: activeReaction.messageId, reaction });
  }, [activeReaction?.messageId, reaction, stopActiveReaction]);

  const [isAnimationLoaded, markAnimationLoaded, unmarkAnimationLoaded] = useFlag();
  const shouldRenderStatic = !isCustom && (!shouldPlay || !isAnimationLoaded);

  const className = buildClassName(
    styles.root,
    shouldRenderAnimation && styles.animating,
    isCustom && styles.isCustomEmoji,
  );

  return (
    <div className={className} ref={ref}>
      {shouldRenderStatic && <ReactionStaticEmoji reaction={reaction} availableReactions={availableReactions} />}
      {isCustom && (
        <CustomEmoji
          documentId={reaction.documentId}
          className={styles.customEmoji}
          observeIntersectionForPlaying={observeIntersection}
        />
      )}
      {shouldRenderAnimation && (
        <>
          <AnimatedSticker
            key={effectId}
            className={buildClassName(styles.effect, animationClassNames)}
            size={EFFECT_SIZE}
            tgsUrl={mediaDataEffect}
            play={isIntersecting}
            noLoop
            forceOnHeavyAnimation
            onEnded={handleEnded}
          />
          {isCustom ? (
            !assignedEffectId && isIntersecting && <CustomReactionAnimation reaction={reaction} />
          ) : (
            <AnimatedSticker
              key={centerIconId}
              className={buildClassName(styles.animatedIcon, animationClassNames)}
              size={CENTER_ICON_SIZE}
              tgsUrl={mediaDataCenterIcon}
              play={isIntersecting}
              noLoop
              forceOnHeavyAnimation
              onLoad={markAnimationLoaded}
              onEnded={unmarkAnimationLoaded}
            />
          )}
        </>
      )}
    </div>
  );
};

export default memo(ReactionAnimatedEmoji);
