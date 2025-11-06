import type { FC } from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { REM } from './helpers/mediaDimensions';

import { useTransitionActiveKey } from '../../hooks/animations/useTransitionActiveKey';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useResizeObserver from '../../hooks/useResizeObserver';
import useSyncEffect from '../../hooks/useSyncEffect';

import Transition from '../ui/Transition';
import Icon from './icons/Icon';

import styles from './PremiumProgress.module.scss';

export type AnimationDirection = 'forward' | 'backward' | 'none';

type OwnProps = {
  leftText?: string;
  rightText?: string;
  floatingBadgeIcon?: IconName;
  floatingBadgeText?: string;
  progress?: number;
  isPrimary?: boolean;
  isNegative?: boolean;
  animationDirection?: AnimationDirection;
  className?: string;
};

const PremiumProgress: FC<OwnProps> = ({
  leftText,
  rightText,
  floatingBadgeText,
  floatingBadgeIcon,
  progress = 0,
  isPrimary,
  isNegative,
  animationDirection = 'none',
  className,
}) => {
  const floatingBadgeContentRef = useRef<HTMLDivElement>();
  const parentContainerRef = useRef<HTMLDivElement>();

  const [shiftX, setShiftX] = useState(0);
  const [beakPosition, setBeakPosition] = useState(0);
  const [badgeWidth, setBadgeWidth] = useState(0);
  const prevBadgeWidth = usePrevious(badgeWidth);
  const [positiveProgress, setPositiveProgress] = useState(isNegative ? 0 : progress);
  const [negativeProgress, setNegativeProgress] = useState(isNegative ? progress : 0);
  const [badgeProgress, setBadgeProgress] = useState(progress);

  const [layerProgress, setLayerProgress] = useState(0);
  const [showLayer, setShowLayer] = useState(false);
  const [disableMainProgressTransition, setDisableMainProgressTransition] = useState(false);
  const [disableLayerProgressTransition, setDisableLayerProgressTransition] = useState(false);
  const [hideMainLayer, setHideMainLayer] = useState(false);
  const [isCycling, setIsCycling] = useState(false);

  const badgeActiveKey = useTransitionActiveKey([floatingBadgeText, floatingBadgeIcon]);

  const shouldAnimateCaptionsRef = useRef(false);
  const prevLeftText = usePrevious(leftText);
  const prevRightText = usePrevious(rightText);
  const prevIsNegative = usePrevious(isNegative);

  const lang = useLang();

  const BEAK_WIDTH_PX = 28;
  const PROGRESS_BORDER_RADIUS_PX = REM;
  const CORNER_BEAK_THRESHOLD = BEAK_WIDTH_PX / 2 + PROGRESS_BORDER_RADIUS_PX;
  const BADGE_HORIZONTAL_PADDING_PX = 0.75 * 2 * REM;

  const LAYER_PROGRESS_TRANSITION_MS = 400;
  const FULL_CYCLE_TRANSITION_MS = LAYER_PROGRESS_TRANSITION_MS * 2;
  const APPLY_TRANSITION_DELAY_MS = 50;

  const updateBadgePosition = () => {
    if (floatingBadgeContentRef.current && parentContainerRef.current) {
      const parentWidth = parentContainerRef.current.offsetWidth;
      const halfBadgeWidth = badgeWidth / 2;
      const minBadgeShift = halfBadgeWidth;
      const maxBadgeShift = parentWidth - halfBadgeWidth;
      const halfBeakWidth = BEAK_WIDTH_PX / 2;
      const currentShift = isNegative ? (1 - badgeProgress) * parentWidth : badgeProgress * parentWidth;

      let safeShift = Math.max(minBadgeShift, Math.min(currentShift, maxBadgeShift));
      if (currentShift < CORNER_BEAK_THRESHOLD) {
        safeShift = currentShift + halfBadgeWidth;
      }
      if (currentShift > parentWidth - CORNER_BEAK_THRESHOLD) {
        safeShift = currentShift - halfBadgeWidth;
      }

      const beakOffsetFromCenter = currentShift - safeShift;
      const newBeakPositionPx = halfBadgeWidth + beakOffsetFromCenter - halfBeakWidth;

      setShiftX(safeShift / parentWidth);
      setBeakPosition(newBeakPositionPx);
    }
  };

  useEffect(updateBadgePosition, [badgeProgress, badgeWidth, isNegative, CORNER_BEAK_THRESHOLD]);

  useResizeObserver(parentContainerRef, updateBadgePosition);

  useEffect(() => {
    const width = floatingBadgeContentRef?.current?.clientWidth || 0;
    setBadgeWidth(width + BADGE_HORIZONTAL_PADDING_PX);
  }, [floatingBadgeText, floatingBadgeIcon, BADGE_HORIZONTAL_PADDING_PX]);

  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    let timeoutId: number | undefined;

    const isNegativeTransition = prevIsNegative !== undefined && prevIsNegative !== isNegative;
    const shouldAnimateCaptions = (prevLeftText || prevRightText) && (isNegativeTransition || isCycling);

    if (shouldAnimateCaptions && !shouldAnimateCaptionsRef.current) {
      shouldAnimateCaptionsRef.current = true;

      const timeoutMs = isCycling ? LAYER_PROGRESS_TRANSITION_MS * 2 : LAYER_PROGRESS_TRANSITION_MS;
      timeoutId = window.setTimeout(() => {
        shouldAnimateCaptionsRef.current = false;
        forceUpdate();
      }, timeoutMs);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        shouldAnimateCaptionsRef.current = false;
      }
    };
  }, [
    leftText, prevLeftText, rightText, prevRightText,
    prevIsNegative, isNegative, animationDirection, isCycling,
  ]);

  const shouldAnimateCaptions = shouldAnimateCaptionsRef.current;

  useEffect(() => {
    if (isNegative) {
      setPositiveProgress(0);
      setNegativeProgress(progress);
    } else {
      setNegativeProgress(0);
      setPositiveProgress(progress);
    }
    setBadgeProgress(progress);
  }, [progress, isNegative]);

  const hasFloatingBadge = Boolean(floatingBadgeIcon || floatingBadgeText);

  const displayLeftText = shouldAnimateCaptions ? prevLeftText : leftText;
  const displayRightText = shouldAnimateCaptions ? prevRightText : rightText;

  const prevProgress = usePrevious(progress);

  useEffect(() => {
    const timers: number[] = [];

    if (animationDirection === 'none' || prevProgress === undefined) {
      return;
    }

    const targetProgress = progress;

    const setMainProgress = (value: number) => {
      if (isNegative) {
        setNegativeProgress(value);
      } else {
        setPositiveProgress(value);
      }
    };

    if (animationDirection === 'forward' || animationDirection === 'backward') {
      const isForward = animationDirection === 'forward';

      setIsCycling(true);
      setMainProgress(isForward ? 1 : 0);

      setDisableLayerProgressTransition(true);
      setLayerProgress(isForward ? 0 : 1);

      timers.push(window.setTimeout(() => {
        setDisableLayerProgressTransition(false);
        setShowLayer(true);
        setLayerProgress(targetProgress);
        if (isForward) {
          setDisableMainProgressTransition(true);
          setMainProgress(0);
        }
      }, LAYER_PROGRESS_TRANSITION_MS));

      timers.push(window.setTimeout(() => {
        setDisableMainProgressTransition(true);
        setDisableLayerProgressTransition(true);
        setHideMainLayer(false);
        setMainProgress(targetProgress);
        setShowLayer(false);

        timers.push(window.setTimeout(() => {
          setDisableMainProgressTransition(false);
          setDisableLayerProgressTransition(false);
          setIsCycling(false);
        }, APPLY_TRANSITION_DELAY_MS));
      }, FULL_CYCLE_TRANSITION_MS));
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [
    progress, animationDirection, isNegative,
    prevProgress, FULL_CYCLE_TRANSITION_MS,
  ]);

  const renderProgressLayer = (
    isPositive: boolean,
    currentProgress: number,
    layerClassName?: string,
    disableTransition?: boolean,
  ) => {
    const typeClass = isPositive ? styles.positiveProgress : styles.negativeProgress;
    const progressVar = '--layer-progress';

    return (
      <div
        className={buildClassName(
          typeClass,
          layerClassName,
          disableTransition && styles.noTransition,
        )}
        style={`${progressVar}: ${currentProgress}`}
      >
        <div className={styles.left}>
          <span>{displayLeftText}</span>
        </div>
        <div className={styles.right}>
          <span>{displayRightText}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={parentContainerRef}
      className={buildClassName(
        styles.root,
        hasFloatingBadge && styles.withBadge,
        isPrimary && styles.primary,
        isNegative && styles.negative,
        shouldAnimateCaptions && styles.transitioning,
        isCycling && styles.cycling,
        className,
      )}
      style={buildStyle(
        `--positive-progress: ${positiveProgress}`,
        `--negative-progress: ${negativeProgress}`,
        `--layer-progress: ${layerProgress}`,
        `--shift-x: ${shiftX}`,
        `--cycling-animation-badge-position: ${FULL_CYCLE_TRANSITION_MS}ms`,
        `--cycling-animation-progress: ${LAYER_PROGRESS_TRANSITION_MS}ms`,
      )}
    >
      {hasFloatingBadge && (
        <div className={styles.badgeContainer}>
          <div className={styles.floatingBadgeWrapper}>
            <div
              className={
                buildClassName(styles.floatingBadge,
                  (!prevBadgeWidth || prevBadgeWidth === 0)
                  && styles.noTransition)
              }
              style={`width: ${badgeWidth}px;`}
            >
              <Transition
                activeKey={badgeActiveKey}
                name="fade"
                shouldCleanup
              >
                <div
                  ref={floatingBadgeContentRef}
                  className={styles.floatingBadgeContent}
                >
                  {floatingBadgeIcon && <Icon name={floatingBadgeIcon} className={styles.floatingBadgeIcon} />}
                  {floatingBadgeText && (
                    <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                      {floatingBadgeText}
                    </div>
                  )}
                </div>
              </Transition>
            </div>
            <div className={styles.floatingBadgeTriangle} style={`left: ${beakPosition}px`}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="m 28,4 v 9 c 0.0089,7.283278 -3.302215,5.319646 -6.750951,8.589815 l -5.8284,5.82843 c -0.781,0.78105 -2.0474,0.78104 -2.8284,0 L 6.7638083,21.589815 C 2.8288652,17.959047 0.04527024,20.332086 0,13 V 4 C 0,4 0.00150581,0.97697493 3,1 5.3786658,1.018266 22.594519,0.9142007 25,1 c 2.992326,0.1067311 3,3 3,3 z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <div className={styles.left}>
        <span>{displayLeftText}</span>
      </div>
      <div className={styles.right}>
        <span>{displayRightText}</span>
      </div>

      <div className={styles.progressWrapper}>
        {renderProgressLayer(
          true,
          positiveProgress,
          buildClassName(hideMainLayer && styles.hidden),
          disableMainProgressTransition,
        )}

        {renderProgressLayer(
          false,
          negativeProgress,
          buildClassName(hideMainLayer && styles.hidden),
          disableMainProgressTransition,
        )}

        {renderProgressLayer(
          !isNegative,
          layerProgress,
          buildClassName(
            isNegative ? styles.negativeLayer : styles.positiveLayer,
            showLayer && styles.show,
          ),
          disableLayerProgressTransition,
        )}
      </div>
    </div>
  );
};

export default memo(PremiumProgress);
