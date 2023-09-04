import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type { ApiUserStories } from '../../api/types';

import { IS_FIREFOX, IS_SAFARI } from '../../util/windowEnvironment';
import { ANIMATION_END_DELAY } from '../../config';
import { selectIsStoryViewerOpen, selectTabState, selectUser } from '../../global/selectors';
import { calculateOffsetX } from './helpers/dimensions';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useSignal from '../../hooks/useSignal';
import { useSlideSizes } from './hooks/useSlideSizes';

import Story from './Story';
import StoryPreview from './StoryPreview';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  isReportModalOpen?: boolean;
  isDeleteModalOpen?: boolean;
  onDelete: (storyId: number) => void;
  onReport: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  userIds: string[];
  currentUserId?: string;
  currentStoryId?: number;
  byUserId?: Record<string, ApiUserStories>;
  isSingleUser?: boolean;
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
  userIds, currentUserId, currentStoryId, isSingleUser, isSingleStory, isPrivate, isArchive, byUserId,
  isReportModalOpen, isDeleteModalOpen, onDelete, onClose, onReport,
}: OwnProps & StateProps) {
  const [renderingUserId, setRenderingUserId] = useState(currentUserId);
  const [renderingStoryId, setRenderingStoryId] = useState(currentStoryId);
  const prevUserId = usePrevious(currentUserId);
  const renderingIsArchive = useCurrentOrPrev(isArchive, true);
  const renderingIsPrivate = useCurrentOrPrev(isPrivate, true);
  const renderingIsSingleUser = useCurrentOrPrev(isSingleUser, true);
  const renderingIsSingleStory = useCurrentOrPrev(isSingleStory, true);
  const slideSizes = useSlideSizes();

  const rendersRef = useRef<Record<string, { current: HTMLDivElement | null }>>({});
  const [getIsAnimating, setIsAnimating] = useSignal(false);

  function setRef(ref: HTMLDivElement | null, userId: string) {
    if (!ref) {
      return;
    }
    if (!rendersRef.current[userId]) {
      rendersRef.current[userId] = { current: ref };
    } else {
      rendersRef.current[userId].current = ref;
    }
  }

  const renderingUserIds = useMemo(() => {
    if (renderingUserId && (renderingIsSingleUser || renderingIsSingleStory)) {
      return [renderingUserId];
    }

    const index = renderingUserId ? userIds.indexOf(renderingUserId) : -1;
    if (!renderingUserId || index === -1) {
      return [];
    }

    const start = Math.max(index - 4, 0);
    const end = Math.min(index + 5, userIds.length);

    return userIds.slice(start, end);
  }, [renderingIsSingleStory, renderingIsSingleUser, renderingUserId, userIds]);

  const renderingUserPosition = useMemo(() => {
    if (!renderingUserIds.length || !renderingUserId) {
      return -1;
    }

    return renderingUserIds.indexOf(renderingUserId);
  }, [renderingUserId, renderingUserIds]);

  const currentUserPosition = useMemo(() => {
    if (!renderingUserIds.length || !currentUserId) {
      return -1;
    }
    return renderingUserIds.indexOf(currentUserId);
  }, [currentUserId, renderingUserIds]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRenderingUserId(currentUserId);
    }, ANIMATION_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (renderingUserId !== currentUserId) {
      timeOutId = window.setTimeout(() => {
        setRenderingStoryId(currentStoryId);
      }, ANIMATION_DURATION_MS);
    } else if (currentStoryId !== renderingStoryId) {
      setRenderingStoryId(currentStoryId);
    }

    return () => {
      window.clearTimeout(timeOutId);
    };
  }, [renderingUserId, currentStoryId, currentUserId, renderingStoryId]);

  useEffect(() => {
    let timeOutId: number | undefined;

    if (prevUserId && prevUserId !== currentUserId) {
      setIsAnimating(true);
      timeOutId = window.setTimeout(() => {
        setIsAnimating(false);
      }, ANIMATION_DURATION_MS);
    }

    return () => {
      setIsAnimating(false);
      window.clearTimeout(timeOutId);
    };
  }, [prevUserId, currentUserId, setIsAnimating]);

  const slideAmount = currentUserPosition - renderingUserPosition;
  const isBackward = renderingUserPosition > currentUserPosition;

  const calculateTransformX = useLastCallback(() => {
    return userIds.reduce<Record<string, number>>((transformX, userId, index) => {
      if (userId === renderingUserId) {
        transformX[userId] = calculateOffsetX({
          scale: slideSizes.scale,
          slideAmount,
          isBackward,
          isActiveSlideSize: isBackward,
        });
      } else {
        let isMoveThroughActiveSlide = false;
        if (!isBackward && index > 0 && userIds[index - 1] === renderingUserId) {
          isMoveThroughActiveSlide = true;
        }
        if (isBackward && index < userIds.length - 1 && userIds[index + 1] === renderingUserId) {
          isMoveThroughActiveSlide = true;
        }

        transformX[userId] = calculateOffsetX({
          scale: slideSizes.scale,
          slideAmount,
          isBackward,
          isActiveSlideSize: currentUserId === userId && !isBackward,
          isMoveThroughActiveSlide,
        });
      }

      return transformX;
    }, {});
  });

  useLayoutEffect(() => {
    const transformX = calculateTransformX();

    Object.entries(rendersRef.current).forEach(([userId, { current }]) => {
      if (!current) return;

      if (!getIsAnimating()) {
        current.classList.remove(styles.slideAnimation, styles.slideAnimationToActive, styles.slideAnimationFromActive);
        current.style.setProperty('--slide-translate-x', '0px');
        current.style.setProperty('--slide-translate-y', '0px');
        current.style.setProperty('--slide-translate-scale', '1');

        return;
      }

      const scale = currentUserId === userId
        ? ANIMATION_TO_ACTIVE_SCALE
        : userId === renderingUserId ? ANIMATION_FROM_ACTIVE_SCALE : '1';

      let offsetY = 0;
      if (userId === renderingUserId) {
        offsetY = -ACTIVE_SLIDE_VERTICAL_CORRECTION_REM * FROM_ACTIVE_SCALE_VALUE;
        current.classList.add(styles.slideAnimationFromActive);
      }
      if (userId === currentUserId) {
        offsetY = ACTIVE_SLIDE_VERTICAL_CORRECTION_REM;
        current.classList.add(styles.slideAnimationToActive);
      }

      current.classList.add(styles.slideAnimation);
      current.style.setProperty('--slide-translate-x', `${transformX[userId] || 0}px`);
      current.style.setProperty('--slide-translate-y', `${offsetY}rem`);
      current.style.setProperty('--slide-translate-scale', scale);
    });
  }, [currentUserId, getIsAnimating, renderingUserId]);

  function renderStoryPreview(userId: string, index: number, position: number) {
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
        key={userId}
        ref={(ref) => setRef(ref, userId)}
        className={className}
        style={style}
      >
        <StoryPreview
          user={selectUser(getGlobal(), userId)}
          userStories={byUserId?.[userId]}
        />
      </div>
    );
  }

  function renderStory(userId: string) {
    const style = buildStyle(
      `width: ${slideSizes.activeSlide.width}px`,
      `--slide-media-height: ${slideSizes.activeSlide.height}px`,
    );

    return (
      <div
        key={userId}
        ref={(ref) => setRef(ref, userId)}
        className={buildClassName(styles.slide, styles.activeSlide)}
        style={style}
      >
        <Story
          userId={userId}
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
      {renderingUserIds.length > 1 && (
        <div className={styles.backdropNonInteractive} style={`height: ${slideSizes.slide.height}px`} />
      )}
      {renderingUserIds.map((userId, index) => {
        if (userId === renderingUserId) {
          return renderStory(renderingUserId);
        }

        return renderStoryPreview(userId, index, index - renderingUserPosition);
      })}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    storyViewer: {
      userId: currentUserId, storyId: currentStoryId, isSingleUser, isSingleStory, isPrivate, isArchive,
    },
  } = selectTabState(global);
  const { byUserId, orderedUserIds: { archived, active } } = global.stories;
  const user = currentUserId ? selectUser(global, currentUserId) : undefined;

  return {
    byUserId,
    userIds: user?.areStoriesHidden ? archived : active,
    currentUserId,
    currentStoryId,
    isSingleUser,
    isSingleStory,
    isPrivate,
    isArchive,
  };
}, (global) => selectIsStoryViewerOpen(global))(StorySlides));
