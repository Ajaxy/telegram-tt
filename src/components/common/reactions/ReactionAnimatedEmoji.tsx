import React, {
  memo, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAvailableReaction, ApiReaction, ApiStickerSet } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { isSameReaction } from '../../../global/helpers';
import { selectPerformanceSettingsValue, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { roundToNearestEven } from '../../../util/math';
import { REM } from '../helpers/mediaDimensions';

import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useCustomEmoji from '../hooks/useCustomEmoji';

import AnimatedSticker from '../AnimatedSticker';
import CustomEmoji from '../CustomEmoji';
import ReactionStaticEmoji from '../ReactionStaticEmoji';
import CustomEmojiEffect from './CustomEmojiEffect';

import styles from './ReactionAnimatedEmoji.module.scss';

type OwnProps = {
  containerId: string;
  reaction: ApiReaction;
  className?: string;
  size?: number;
  effectSize?: number;
  withEffectOnly?: boolean;
  observeIntersection?: ObserveFn;
};

type StateProps = {
  activeReactions?: ApiReaction[];
  availableReactions?: ApiAvailableReaction[];
  genericEffects?: ApiStickerSet;
  withEffects?: boolean;
};

const ICON_SIZE = 1.5 * REM;
const CENTER_ICON_MULTIPLIER = 1.9;
const EFFECT_SIZE = 6.5 * REM;

const ReactionAnimatedEmoji = ({
  containerId,
  reaction,
  className,
  size = ICON_SIZE,
  effectSize = EFFECT_SIZE,
  activeReactions,
  availableReactions,
  genericEffects,
  withEffects,
  withEffectOnly,
  observeIntersection,
}: OwnProps & StateProps) => {
  const { stopActiveReaction } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isCustom = 'documentId' in reaction;

  const availableReaction = useMemo(() => (
    availableReactions?.find((r) => isSameReaction(r.reaction, reaction))
  ), [availableReactions, reaction]);
  const centerIconId = availableReaction?.centerIcon?.id;

  const { customEmoji } = useCustomEmoji(isCustom ? reaction.documentId : undefined);

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
    activeReactions?.find((active) => isSameReaction(active, reaction))
  ), [activeReactions, reaction]);

  const shouldPlay = Boolean(withEffects && activeReaction && (isCustom || mediaDataCenterIcon) && mediaDataEffect);
  const {
    shouldRender: shouldRenderAnimation,
    transitionClassNames: animationClassNames,
  } = useShowTransition(shouldPlay, undefined, true, 'slow');

  const handleEnded = useLastCallback(() => {
    stopActiveReaction({ containerId, reaction });
  });

  const [isAnimationLoaded, markAnimationLoaded, unmarkAnimationLoaded] = useFlag();
  const shouldShowStatic = !isCustom && (!shouldPlay || !isAnimationLoaded);
  const {
    shouldRender: shouldRenderStatic,
    transitionClassNames: staticClassNames,
  } = useShowTransition(shouldShowStatic, undefined, true);

  const rootClassName = buildClassName(
    styles.root,
    shouldRenderAnimation && styles.animating,
    withEffectOnly && styles.withEffectOnly,
    className,
  );

  return (
    <div className={rootClassName} ref={ref}>
      {!withEffectOnly && shouldRenderStatic && (
        <ReactionStaticEmoji
          className={staticClassNames}
          reaction={reaction}
          availableReactions={availableReactions}
          size={size}
          observeIntersection={observeIntersection}
        />
      )}
      {!withEffectOnly && isCustom && (
        <CustomEmoji
          documentId={reaction.documentId}
          className={styles.customEmoji}
          size={size}
          observeIntersectionForPlaying={observeIntersection}
        />
      )}
      {shouldRenderAnimation && (
        <>
          <AnimatedSticker
            key={effectId}
            className={buildClassName(styles.effect, animationClassNames)}
            size={effectSize}
            tgsUrl={mediaDataEffect}
            play={isIntersecting}
            noLoop
            forceAlways
            onEnded={handleEnded}
          />
          {isCustom && !assignedEffectId && isIntersecting && <CustomEmojiEffect reaction={reaction} />}
          {!isCustom && !withEffectOnly && (
            <AnimatedSticker
              key={centerIconId}
              className={buildClassName(styles.animatedIcon, animationClassNames)}
              size={roundToNearestEven(size * CENTER_ICON_MULTIPLIER)}
              tgsUrl={mediaDataCenterIcon}
              play={isIntersecting}
              noLoop
              forceAlways
              onLoad={markAnimationLoaded}
              onEnded={unmarkAnimationLoaded}
            />
          )}
        </>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { containerId }) => {
    const { availableReactions, genericEmojiEffects } = global;
    const { activeReactions } = selectTabState(global);

    const withEffects = selectPerformanceSettingsValue(global, 'reactionEffects');

    return {
      activeReactions: activeReactions?.[containerId],
      availableReactions,
      genericEffects: genericEmojiEffects,
      withEffects,
    };
  },
)(ReactionAnimatedEmoji));
