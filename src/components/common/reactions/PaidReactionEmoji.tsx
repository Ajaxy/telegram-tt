import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiReaction, ApiReactionPaid } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { isSameReaction } from '../../../global/helpers';
import { selectPerformanceSettingsValue, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_ANDROID, IS_IOS } from '../../../util/windowEnvironment';
import { LOCAL_TGS_URLS } from '../helpers/animatedAssets';
import { REM } from '../helpers/mediaDimensions';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import AnimatedIcon from '../AnimatedIcon';
import StarIcon from '../icons/StarIcon';

import styles from './ReactionAnimatedEmoji.module.scss';

type OwnProps = {
  containerId: string;
  reaction: ApiReactionPaid;
  className?: string;
  size?: number;
  effectSize?: number;
  localAmount?: number;
  observeIntersection?: ObserveFn;
};

type StateProps = {
  activeReactions?: ApiReaction[];
  withEffects?: boolean;
};

const ICON_SIZE = 1.5 * REM;
const EFFECT_SIZE = 6.5 * REM;
const MAX_EFFECT_COUNT = (IS_IOS || IS_ANDROID) ? 2 : 5;
const QUALITY = (IS_IOS || IS_ANDROID) ? 2 : 3;

const PaidReactionEmoji = ({
  containerId,
  reaction,
  className,
  size = ICON_SIZE,
  effectSize = EFFECT_SIZE,
  activeReactions,
  localAmount,
  withEffects,
  observeIntersection,
}: OwnProps & StateProps) => {
  const { stopActiveReaction } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const effectRef = useRef<HTMLDivElement>(null);

  const [effectsIds, setEffectsIds] = useState<number[]>([]);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const activeReaction = useMemo(() => (
    activeReactions?.find((active) => isSameReaction(active, reaction))
  ), [activeReactions, reaction]);

  const shouldPlayEffect = Boolean(
    withEffects && activeReaction,
  );
  const canAddMoreEffects = effectsIds.length < MAX_EFFECT_COUNT;

  useEffectWithPrevDeps(([prevLocalAmount]) => {
    if (!shouldPlayEffect) {
      setEffectsIds([]);
      return;
    }

    if (!localAmount || localAmount <= (prevLocalAmount || 0)) {
      return;
    }

    if (canAddMoreEffects) {
      setEffectsIds((prev) => [...prev, Date.now()]);
    }
  }, [localAmount, canAddMoreEffects, shouldPlayEffect]);

  const {
    shouldRender: shouldRenderEffect,
  } = useShowTransition({
    ref: effectRef,
    noMountTransition: true,
    isOpen: shouldPlayEffect,
    className: 'slow',
    withShouldRender: true,
  });

  const handleEnded = useLastCallback(() => {
    const newEffectsIds = effectsIds.slice(1);
    setEffectsIds(newEffectsIds);
    if (!newEffectsIds.length) {
      stopActiveReaction({ containerId, reaction });
    }
  });

  const rootClassName = buildClassName(
    styles.root,
    shouldRenderEffect && styles.animating,
    className,
  );

  return (
    <div className={rootClassName} ref={ref} teactFastList>
      <StarIcon key="icon" type="gold" size="adaptive" style={`width: ${size}px; height: ${size}px`} />
      {shouldRenderEffect && effectsIds.map((id) => (
        <AnimatedIcon
          key={id}
          ref={effectRef}
          className={styles.effect}
          size={effectSize}
          tgsUrl={LOCAL_TGS_URLS.StarReactionEffect}
          play={isIntersecting}
          noLoop
          forceAlways
          nonInteractive
          quality={QUALITY}
          onEnded={handleEnded}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { containerId }) => {
    const { activeReactions } = selectTabState(global);

    const withEffects = selectPerformanceSettingsValue(global, 'reactionEffects');

    return {
      activeReactions: activeReactions?.[containerId],
      withEffects,
    };
  },
)(PaidReactionEmoji));
