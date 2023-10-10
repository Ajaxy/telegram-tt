import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiPeerStories, ApiTypeStory } from '../../api/types';

import { ANIMATION_END_DELAY } from '../../config';
import { getStoryKey } from '../../global/helpers';
import { selectIsStoryViewerOpen, selectPeer, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { IS_FIREFOX, IS_SAFARI } from '../../util/windowEnvironment';
import { calculateOffsetX } from './helpers/dimensions';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useSignal from '../../hooks/useSignal';
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
const FROM_ACTIVE_SCALE_VALUE = 0.333;
const ANIMATION_TO_ACTIVE_SCALE = '3';
const ANIMATION_FROM_ACTIVE_SCALE = `${FROM_ACTIVE_SCALE_VALUE}`;

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
  const [renderingPeerId, setRenderingPeerId] = useState(currentPeerId);
  const [renderingStoryId, setRenderingStoryId] = useState(currentStoryId);
  const prevPeerId = usePrevious(currentPeerId);
  const renderingIsArchive = useCurrentOrPrev(isArchive, true);
  const renderingIsPrivate = useCurrentOrPrev(isPrivate, true);
  const renderingIsSinglePeer = useCurrentOrPrev(isSinglePeer, true);
  const renderingIsSingleStory = useCurrentOrPrev(isSingleStory, true);
  const slideSizes = useSlideSizes();

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
    }, ANIMATION_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPeerId]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (renderingPeerId !== currentPeerId) {
      timeOutId = window.setTimeout(() => {
        setRenderingStoryId(currentStoryId);
      }, ANIMATION_DURATION_MS);
    } else if (currentStoryId !== renderingStoryId) {
      setRenderingStoryId(currentStoryId);
    }

    return () => {
      window.clearTimeout(timeOutId);
    };
  }, [renderingPeerId, currentStoryId, currentPeerId, renderingStoryId]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (prevPeerId && prevPeerId !== currentPeerId) {
      setIsAnimating(true);
      timeOutId = window.setTimeout(() => {
        setIsAnimating(false);
      }, ANIMATION_DURATION_MS);
    }

    return () => {
      setIsAnimating(false);
      window.clearTimeout(timeOutId);
    };
  }, [prevPeerId, currentPeerId, setIsAnimating]);

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

  useLayoutEffect(() => {
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

      const scale = currentPeerId === peerId
        ? ANIMATION_TO_ACTIVE_SCALE
        : peerId === renderingPeerId ? ANIMATION_FROM_ACTIVE_SCALE : '1';

      let offsetY = 0;
      if (peerId === renderingPeerId) {
        offsetY = -ACTIVE_SLIDE_VERTICAL_CORRECTION_REM * FROM_ACTIVE_SCALE_VALUE;
        current.classList.add(styles.slideAnimationFromActive);
      }
      if (peerId === currentPeerId) {
        offsetY = ACTIVE_SLIDE_VERTICAL_CORRECTION_REM;
        current.classList.add(styles.slideAnimationToActive);
      }

      current.classList.add(styles.slideAnimation);
      current.style.setProperty('--slide-translate-x', `${transformX[peerId] || 0}px`);
      current.style.setProperty('--slide-translate-y', `${offsetY}rem`);
      current.style.setProperty('--slide-translate-scale', scale);
    });
  }, [currentPeerId, getIsAnimating, renderingPeerId]);

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
    const style = buildStyle(
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
    <div className={styles.wrapper} style={`--story-viewer-scale: ${slideSizes.scale}`}>
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
