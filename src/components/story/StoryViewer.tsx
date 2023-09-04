import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTypeStory } from '../../api/types';
import type { StoryViewerOrigin } from '../../types';

import {
  selectIsStoryViewerOpen,
  selectTabState,
  selectUserStory,
  selectPerformanceSettingsValue,
} from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { animateOpening, animateClosing } from './helpers/ghostAnimation';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import buildClassName from '../../util/buildClassName';
import { ANIMATION_END_DELAY } from '../../config';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useStoryProps from './hooks/useStoryProps';
import useSlideSizes from './hooks/useSlideSizes';

import ShowTransition from '../ui/ShowTransition';
import Button from '../ui/Button';
import StorySlides from './StorySlides';
import StoryDeleteConfirmModal from './StoryDeleteConfirmModal';
import StoryViewModal from './StoryViewModal';
import ReportModal from '../common/ReportModal';
import StorySettings from './StorySettings';
import StealthModeModal from './StealthModeModal';

import styles from './StoryViewer.module.scss';

const ANIMATION_DURATION = 250;

interface StateProps {
  isOpen: boolean;
  userId?: string;
  storyId?: number;
  story?: ApiTypeStory;
  origin?: StoryViewerOrigin;
  shouldSkipHistoryAnimations?: boolean;
  withAnimation?: boolean;
  isPrivacyModalOpen?: boolean;
}

function StoryViewer({
  isOpen,
  userId,
  storyId,
  story,
  origin,
  shouldSkipHistoryAnimations,
  withAnimation,
  isPrivacyModalOpen,
}: StateProps) {
  const { closeStoryViewer, closeStoryPrivacyEditor } = getActions();

  const lang = useLang();
  const [idStoryForDelete, setIdStoryForDelete] = useState<number | undefined>(undefined);
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag(false);

  const { bestImageData, thumbnail } = useStoryProps(story);
  const slideSizes = useSlideSizes();
  const isPrevOpen = usePrevious(isOpen);
  const prevBestImageData = usePrevious(bestImageData);
  const prevUserId = usePrevious(userId);
  const prevOrigin = usePrevious(origin);
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  useEffect(() => {
    if (!isOpen) {
      setIdStoryForDelete(undefined);
      closeReportModal();
      closeDeleteModal();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    disableDirectTextInput();
    const stopPriorityPlayback = dispatchPriorityPlaybackEvent();

    return () => {
      enableDirectTextInput();
      stopPriorityPlayback();
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    closeStoryViewer();
  }, [closeStoryViewer]);

  const handleOpenDeleteModal = useCallback((id: number) => {
    setIdStoryForDelete(id);
    openDeleteModal();
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    closeDeleteModal();
    setIdStoryForDelete(undefined);
  }, []);

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    handleClose();
  }) : undefined), [handleClose, isOpen]);

  useEffect(() => {
    if (isGhostAnimation && !isPrevOpen && isOpen && userId && thumbnail && origin !== undefined) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(userId, origin, thumbnail, bestImageData, slideSizes.activeSlide);
    }
    if (isGhostAnimation && isPrevOpen && !isOpen && prevUserId && prevBestImageData && prevOrigin !== undefined) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevUserId, prevOrigin, prevBestImageData);
    }
  }, [
    isGhostAnimation,
    bestImageData,
    prevBestImageData,
    isOpen,
    isPrevOpen,
    slideSizes.activeSlide,
    thumbnail,
    userId,
    prevUserId,
    origin,
    prevOrigin,
  ]);

  return (
    <ShowTransition
      id="StoryViewer"
      className={styles.root}
      isOpen={isOpen}
      shouldAnimateFirstRender
      noCloseTransition={shouldSkipHistoryAnimations}
    >
      <div className={styles.backdrop} onClick={handleClose} />
      <Button
        className={styles.close}
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('Close')}
        onClick={handleClose}
      >
        <i className={buildClassName('icon icon-close', styles.topIcon)} aria-hidden />
      </Button>

      <StorySlides
        isOpen={isOpen}
        isReportModalOpen={isReportModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onReport={openReportModal}
        onClose={handleClose}
        onDelete={handleOpenDeleteModal}
      />

      <StoryDeleteConfirmModal
        isOpen={isDeleteModalOpen}
        storyId={idStoryForDelete}
        onClose={handleCloseDeleteModal}
      />
      <StoryViewModal />
      <StealthModeModal />
      <StorySettings isOpen={isPrivacyModalOpen} onClose={closeStoryPrivacyEditor} />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        subject="story"
        userId={userId}
        storyId={storyId}
      />
    </ShowTransition>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    shouldSkipHistoryAnimations, storyViewer: {
      storyId, userId, isPrivacyModalOpen, origin,
    },
  } = selectTabState(global);
  const story = userId && storyId ? selectUserStory(global, userId, storyId) : undefined;
  const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

  return {
    isOpen: selectIsStoryViewerOpen(global),
    shouldSkipHistoryAnimations,
    userId,
    storyId,
    story,
    origin,
    withAnimation,
    isPrivacyModalOpen,
  };
})(StoryViewer));
