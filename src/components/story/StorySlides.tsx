import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiPeerStories, ApiTypeStory } from '../../api/types';
import type { RealTouchEvent } from '../../util/captureEvents';

import { ANIMATION_END_DELAY, EDITABLE_STORY_INPUT_ID } from '../../config';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getStoryKey } from '../../global/helpers';
import {
  selectIsStoryViewerOpen,
  selectPeer,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import {
  captureEvents,
  IOS_SCREEN_EDGE_THRESHOLD,
  SWIPE_DIRECTION_THRESHOLD,
  SWIPE_DIRECTION_TOLERANCE,
} from '../../util/captureEvents';
import focusEditableElement from '../../util/focusEditableElement';
import { clamp } from '../../util/math';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';
import {
  IS_FIREFOX, IS_IOS, IS_SAFARI,
} from '../../util/windowEnvironment';
import { calculateOffsetX } from './helpers/dimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useSignal from '../../hooks/useSignal';
import useWindowSize from '../../hooks/window/useWindowSize';
import useSlideSizes from './hooks/useSlideSizes';

import Story from './Story';
import StoryPreview from './StoryPreview';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  isOpen?: boolean;
  isReportModalOpen?: boolean;
  isDeleteModalOpen?: boolean;
  onDelete: (story: ApiTypeStory) => void;
  onReport: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  peerIds: string[];
  currentPeerId?: string;
  currentStoryId?: number;
  byPeerId?: Record<string, ApiPeerStories>;
  isSinglePeer?: boolean;
  isSingleStory?: boolean;
  isPrivate?: boolean;
  isArchive?: boolean;
}

const ANIMATION_DURATION_MS = 350 + (IS_SAFARI || IS_FIREFOX ? ANIMATION_END_DELAY : 20);
const ACTIVE_SLIDE_VERTICAL_CORRECTION_REM = 1.75;
const SWIPE_Y_THRESHOLD = 50;
const SCROLL_RELEASE_DELAY = 1500;

enum SwipeDirection {
  Horizontal,
  Vertical,
}

function StorySlides({
  peerIds,
  currentPeerId,
  currentStoryId,
  isOpen,
  isSinglePeer,
  isSingleStory,
  isPrivate,
  isArchive,
  byPeerId,
  isReportModalOpen,
  isDeleteModalOpen,
  onDelete,
  onClose,
  onReport,
}: OwnProps & StateProps) {
  const { stopActiveReaction } = getActions();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderingPeerId, setRenderingPeerId] = useState(currentPeerId);
  const [renderingStoryId, setRenderingStoryId] = useState(currentStoryId);
  const prevPeerId = usePrevious(currentPeerId);
  const renderingIsArchive = useCurrentOrPrev(isArchive, true);
  const renderingIsPrivate = useCurrentOrPrev(isPrivate, true);
  const renderingIsSinglePeer = useCurrentOrPrev(isSinglePeer, true);
  const renderingIsSingleStory = useCurrentOrPrev(isSingleStory, true);
  const slideSizes = useSlideSizes();
  const { height: windowHeight, width: windowWidth } = useWindowSize();
  const swipeDirectionRef = useRef<SwipeDirection | undefined>(undefined);
  const isReleasedRef = useRef(false);
  const { isMobile } = useAppLayout();
  const animationDuration = isMobile ? 0 : ANIMATION_DURATION_MS;

  const rendersRef = useRef<Record<string, { current: HTMLDivElement | null }>>({});
  const [getIsAnimating, setIsAnimating] = useSignal(false);

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
    shouldBeReplaced: true,
  });

  function setRef(ref: HTMLDivElement | null, peerId: string) {
    if (!ref) {
      return;
    }
    if (!rendersRef.current[peerId]) {
      rendersRef.current[peerId] = { current: ref };
    } else {
      rendersRef.current[peerId].current = ref;
    }
  }

  const renderingPeerIds = useMemo(() => {
    if (renderingPeerId && (renderingIsSinglePeer || renderingIsSingleStory)) {
      return [renderingPeerId];
    }

    const index = renderingPeerId ? peerIds.indexOf(renderingPeerId) : -1;
    if (!renderingPeerId || index === -1) {
      return [];
    }

    const start = Math.max(index - 4, 0);
    const end = Math.min(index + 5, peerIds.length);

    return peerIds.slice(start, end);
  }, [renderingIsSingleStory, renderingIsSinglePeer, renderingPeerId, peerIds]);

  const renderingPeerPosition = useMemo(() => {
    if (!renderingPeerIds.length || !renderingPeerId) {
      return -1;
    }

    return renderingPeerIds.indexOf(renderingPeerId);
  }, [renderingPeerId, renderingPeerIds]);

  const currentPeerPosition = useMemo(() => {
    if (!renderingPeerIds.length || !currentPeerId) {
      return -1;
    }
    return renderingPeerIds.indexOf(currentPeerId);
  }, [currentPeerId, renderingPeerIds]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRenderingPeerId(currentPeerId);
    }, animationDuration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [animationDuration, currentPeerId]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (renderingPeerId !== currentPeerId) {
      timeOutId = window.setTimeout(() => {
        setRenderingStoryId(currentStoryId);
      }, animationDuration);
    } else if (currentStoryId !== renderingStoryId) {
      setRenderingStoryId(currentStoryId);
    }

    return () => {
      window.clearTimeout(timeOutId);
    };
  }, [renderingPeerId, currentStoryId, currentPeerId, renderingStoryId, animationDuration]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (prevPeerId && prevPeerId !== currentPeerId) {
      setIsAnimating(true);
      timeOutId = window.setTimeout(() => {
        setIsAnimating(false);
      }, animationDuration);
    }

    return () => {
      setIsAnimating(false);
      window.clearTimeout(timeOutId);
    };
  }, [prevPeerId, currentPeerId, setIsAnimating, animationDuration]);

  useEffect(() => {
    return () => {
      if (!currentStoryId || !currentPeerId) return;
      stopActiveReaction({
        containerId: getStoryKey(currentPeerId, currentStoryId),
      });
    };
  }, [currentStoryId, currentPeerId]);

  const slideAmount = currentPeerPosition - renderingPeerPosition;
  const isBackward = renderingPeerPosition > currentPeerPosition;

  const calculateTransformX = useLastCallback(() => {
    return peerIds.reduce<Record<string, number>>((transformX, peerId, index) => {
      if (peerId === renderingPeerId) {
        transformX[peerId] = calculateOffsetX({
          scale: slideSizes.scale,
          slideAmount,
          isBackward,
          isActiveSlideSize: isBackward,
        });
      } else {
        let isMoveThroughActiveSlide = false;
        if (!isBackward && index > 0 && peerIds[index - 1] === renderingPeerId) {
          isMoveThroughActiveSlide = true;
        }
        if (isBackward && index < peerIds.length - 1 && peerIds[index + 1] === renderingPeerId) {
          isMoveThroughActiveSlide = true;
        }

        transformX[peerId] = calculateOffsetX({
          scale: slideSizes.scale,
          slideAmount,
          isBackward,
          isActiveSlideSize: currentPeerId === peerId && !isBackward,
          isMoveThroughActiveSlide,
        });
      }

      return transformX;
    }, {});
  });

  useEffect(() => {
    if (!containerRef.current || !isOpen) {
      return undefined;
    }

    let offsetY = 0;

    const getCurrentStoryRef = () => {
      return renderingPeerId ? rendersRef.current[renderingPeerId]?.current : undefined;
    };

    const onRelease = (event: MouseEvent | TouchEvent | WheelEvent) => {
      // This allows to prevent onRelease triggered by debounced wheel event
      // after onRelease was triggered manually in onDrag
      if (isReleasedRef.current) {
        isReleasedRef.current = false;
        return;
      }
      const current = getCurrentStoryRef();
      if (!current) return;

      if (offsetY < -SWIPE_Y_THRESHOLD) {
        const composer = document.getElementById(EDITABLE_STORY_INPUT_ID);
        if (composer) {
          requestMutation(() => {
            focusEditableElement(composer);
          });
        }
        return;
      }

      if (offsetY > SWIPE_Y_THRESHOLD) {
        onClose();
        if (event.type === 'wheel') {
          disableScrolling();
          setTimeout(enableScrolling, SCROLL_RELEASE_DELAY);
        }
      } else {
        requestMutation(() => {
          current.style.setProperty('--slide-translate-y', '0px');
        });
      }
    };

    return captureEvents(containerRef.current, {
      isNotPassive: true,
      withNativeDrag: true,
      withWheelDrag: true,
      excludedClosestSelector: '.Composer',
      onDrag: (event, captureEvent, {
        dragOffsetX, dragOffsetY,
      }) => {
        if (isReleasedRef.current) return;
        // Avoid conflicts with swipe-to-back gestures
        if (IS_IOS && captureEvent.type === 'touchstart') {
          const { pageX } = (captureEvent as RealTouchEvent).touches[0];
          if (pageX <= IOS_SCREEN_EDGE_THRESHOLD || pageX >= windowWidth - IOS_SCREEN_EDGE_THRESHOLD) {
            return;
          }
        }
        if (event.type === 'mousemove') return;
        const absOffsetX = Math.abs(dragOffsetX);
        const absOffsetY = Math.abs(dragOffsetY);
        const current = getCurrentStoryRef();
        if (!current) return;
        // If vertical shift is dominant we change only vertical position
        if (swipeDirectionRef.current === SwipeDirection.Vertical
          || Math.abs(absOffsetY) > SWIPE_DIRECTION_THRESHOLD || absOffsetY / absOffsetX > SWIPE_DIRECTION_TOLERANCE) {
          swipeDirectionRef.current = SwipeDirection.Vertical;
          const limit = windowHeight;
          offsetY = clamp(dragOffsetY, -limit, limit);
          if (offsetY > 0) {
            requestMutation(() => {
              current.style.setProperty('--slide-translate-y', `${offsetY * (isMobile ? 1 : -1)}px`);
            });
          }
          if (event.type === 'wheel' && Math.abs(offsetY) > SWIPE_Y_THRESHOLD * 2) {
            onRelease(event);
            isReleasedRef.current = true;
          }
        }
      },
      onRelease,
    });
  }, [isOpen, onClose, windowWidth, windowHeight, isMobile, renderingPeerId]);

  useLayoutEffect(() => {
    if (isMobile) return;
    const transformX = calculateTransformX();

    Object.entries(rendersRef.current).forEach(([peerId, { current }]) => {
      if (!current) return;

      if (!getIsAnimating()) {
        current.classList.remove(styles.slideAnimation, styles.slideAnimationToActive, styles.slideAnimationFromActive);
        current.style.setProperty('--slide-translate-x', '0px');
        current.style.setProperty('--slide-translate-y', '0px');
        current.style.setProperty('--slide-translate-scale', '1');

        return;
      }

      const getScale = () => {
        if (currentPeerId === peerId) {
          return String(slideSizes.toActiveScale);
        }
        if (peerId === renderingPeerId) {
          return String(slideSizes.fromActiveScale);
        }
        return '1';
      };

      let offsetY = 0;
      if (peerId === renderingPeerId) {
        offsetY = -ACTIVE_SLIDE_VERTICAL_CORRECTION_REM * slideSizes.fromActiveScale;
        current.classList.add(styles.slideAnimationFromActive);
      }
      if (peerId === currentPeerId) {
        offsetY = ACTIVE_SLIDE_VERTICAL_CORRECTION_REM;
        current.classList.add(styles.slideAnimationToActive);
      }

      current.classList.add(styles.slideAnimation);
      current.style.setProperty('--slide-translate-x', `${transformX[peerId] || 0}px`);
      current.style.setProperty('--slide-translate-y', `${offsetY}rem`);
      current.style.setProperty('--slide-translate-scale', getScale());
    });
  }, [currentPeerId, getIsAnimating, renderingPeerId, slideSizes, isMobile]);

  if (isMobile) {
    return (
      <div className={styles.wrapper} ref={containerRef}>
        <div
          className={styles.mobileSlide}
          ref={(ref) => setRef(ref, renderingPeerId!)}
        >
          <Story
            peerId={renderingPeerId!}
            storyId={renderingStoryId!}
            onDelete={onDelete}
            dimensions={slideSizes.activeSlide}
            isPrivateStories={renderingIsPrivate}
            isArchivedStories={renderingIsArchive}
            isReportModalOpen={isReportModalOpen}
            isDeleteModalOpen={isDeleteModalOpen}
            isSingleStory={isSingleStory}
            getIsAnimating={getIsAnimating}
            onClose={onClose}
            onReport={onReport}
          />
        </div>
      </div>
    );
  }

  function renderStoryPreview(peerId: string, index: number, position: number) {
    const style = buildStyle(
      `width: ${slideSizes.slide.width}px`,
      `height: ${slideSizes.slide.height}px`,
    );
    const className = buildClassName(
      styles.slide,
      styles.slidePreview,
      `slide-${position}`,
    );

    return (
      <div
        key={peerId}
        ref={(ref) => setRef(ref, peerId)}
        className={className}
        style={style}
      >
        <StoryPreview
          peer={selectPeer(getGlobal(), peerId)}
          peerStories={byPeerId?.[peerId]}
        />
      </div>
    );
  }

  function renderStory(peerId: string) {
    const style = isMobile ? undefined : buildStyle(
      `width: ${slideSizes.activeSlide.width}px`,
      `--slide-media-height: ${slideSizes.activeSlide.height}px`,
    );

    return (
      <div
        key={peerId}
        ref={(ref) => setRef(ref, peerId)}
        className={buildClassName(styles.slide, styles.activeSlide)}
        style={style}
      >
        <Story
          peerId={peerId}
          storyId={renderingStoryId!}
          onDelete={onDelete}
          dimensions={slideSizes.activeSlide}
          isPrivateStories={renderingIsPrivate}
          isArchivedStories={renderingIsArchive}
          isReportModalOpen={isReportModalOpen}
          isDeleteModalOpen={isDeleteModalOpen}
          isSingleStory={isSingleStory}
          getIsAnimating={getIsAnimating}
          onClose={onClose}
          onReport={onReport}
        />
      </div>
    );
  }

  return (
    <div
      className={styles.wrapper}
      ref={containerRef}
      style={`--story-viewer-scale: ${slideSizes.scale}`}
    >
      <div className={styles.fullSize} onClick={onClose} />
      {renderingPeerIds.length > 1 && (
        <div className={styles.backdropNonInteractive} style={`height: ${slideSizes.slide.height}px`} />
      )}
      {renderingPeerIds.map((peerId, index) => {
        if (peerId === renderingPeerId) {
          return renderStory(renderingPeerId);
        }

        return renderStoryPreview(peerId, index, index - renderingPeerPosition);
      })}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    storyViewer: {
      peerId: currentPeerId, storyId: currentStoryId, isSinglePeer, isSingleStory, isPrivate, isArchive,
    },
  } = selectTabState(global);
  const { byPeerId, orderedPeerIds: { archived, active } } = global.stories;
  const peer = currentPeerId ? selectPeer(global, currentPeerId) : undefined;

  return {
    byPeerId,
    peerIds: peer?.areStoriesHidden ? archived : active,
    currentPeerId,
    currentStoryId,
    isSinglePeer,
    isSingleStory,
    isPrivate,
    isArchive,
  };
}, (global) => selectIsStoryViewerOpen(global))(StorySlides));
