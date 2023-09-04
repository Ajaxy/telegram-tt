import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectIsStoryViewerOpen, selectTabState } from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';

import ShowTransition from '../ui/ShowTransition';
import Button from '../ui/Button';
import StorySlides from './StorySlides';
import StoryDeleteConfirmModal from './StoryDeleteConfirmModal';
import StoryViewers from './StoryViewers';
import ReportModal from '../common/ReportModal';
import StorySettings from './StorySettings';

import styles from './StoryViewer.module.scss';

interface StateProps {
  isOpen: boolean;
  userId?: string;
  storyId?: number;
  shouldSkipHistoryAnimations?: boolean;
  isPrivacyModalOpen?: boolean;
}

function StoryViewer({
  isOpen,
  userId,
  storyId,
  shouldSkipHistoryAnimations,
  isPrivacyModalOpen,
}: StateProps) {
  const { closeStoryViewer, closeStoryPrivacyEditor } = getActions();

  const lang = useLang();
  const [idStoryForDelete, setIdStoryForDelete] = useState<number | undefined>(undefined);
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag(false);

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
      stopPriorityPlayback();
      enableDirectTextInput();
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

  useHistoryBack({
    isActive: isOpen,
    onBack: handleClose,
    shouldBeReplaced: true,
  });

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    handleClose();
  }) : undefined), [handleClose, isOpen]);

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
        <i className="icon icon-close" aria-hidden />
      </Button>

      <StorySlides
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
      <StoryViewers />
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
  const { shouldSkipHistoryAnimations, storyViewer: { storyId, userId, isPrivacyModalOpen } } = selectTabState(global);

  return {
    isOpen: selectIsStoryViewerOpen(global),
    shouldSkipHistoryAnimations,
    userId,
    storyId,
    isPrivacyModalOpen,
  };
})(StoryViewer));
