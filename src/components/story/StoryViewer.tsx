import {
  beginHeavyAnimation,
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTypeStory } from '../../api/types';
import type { StoryViewerOrigin } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import {
  selectIsStoryViewerOpen,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectTabState,
} from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import useSlideSizes from './hooks/useSlideSizes';
import useStoryProps from './hooks/useStoryProps';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import ShowTransition from '../ui/ShowTransition';
import StealthModeModal from './StealthModeModal';
import StoryDeleteConfirmModal from './StoryDeleteConfirmModal';
import StorySettings from './StorySettings';
import StorySlides from './StorySlides';
import StoryViewModal from './StoryViewModal';

import styles from './StoryViewer.module.scss';

const ANIMATION_DURATION = 250;

interface StateProps {
  isOpen: boolean;
  peerId: string;
  storyId?: number;
  story?: ApiTypeStory;
  origin?: StoryViewerOrigin;
  shouldSkipHistoryAnimations?: boolean;
  withAnimation?: boolean;
  isPrivacyModalOpen?: boolean;
}

function StoryViewer({
  isOpen,
  peerId,
  storyId,
  story,
  origin,
  shouldSkipHistoryAnimations,
  withAnimation,
  isPrivacyModalOpen,
}: StateProps) {
  const { closeStoryViewer, closeStoryPrivacyEditor, reportStory } = getActions();

  const lang = useOldLang();
  const [storyToDelete, setStoryToDelete] = useState<ApiTypeStory | undefined>(undefined);
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);

  const { bestImageData, thumbnail } = useStoryProps(story);
  const slideSizes = useSlideSizes();
  const isPrevOpen = usePreviousDeprecated(isOpen);
  const prevBestImageData = usePreviousDeprecated(bestImageData);
  const prevPeerId = usePreviousDeprecated(peerId);
  const prevOrigin = usePreviousDeprecated(origin);
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  useEffect(() => {
    if (!isOpen) {
      setStoryToDelete(undefined);
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

  const handleOpenDeleteModal = useLastCallback((s: ApiTypeStory) => {
    setStoryToDelete(s);
    openDeleteModal();
  });

  const handleCloseDeleteModal = useLastCallback(() => {
    closeDeleteModal();
    setStoryToDelete(undefined);
  });

  const openMessageReport = useLastCallback(() => {
    if (!storyId) return;
    reportStory({ storyId, peerId });
  });

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    handleClose();
  }) : undefined), [handleClose, isOpen]);

  useEffect(() => {
    if (isGhostAnimation && !isPrevOpen && isOpen && peerId && thumbnail && origin !== undefined) {
      beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(peerId, origin, thumbnail, bestImageData, slideSizes.activeSlide);
    }
    if (isGhostAnimation && isPrevOpen && !isOpen && prevPeerId && prevBestImageData && prevOrigin !== undefined) {
      beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevPeerId, prevOrigin, prevBestImageData);
    }
  }, [
    isGhostAnimation,
    bestImageData,
    prevBestImageData,
    isOpen,
    isPrevOpen,
    slideSizes.activeSlide,
    thumbnail,
    peerId,
    prevPeerId,
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
        <Icon name="close" />
      </Button>

      <StorySlides
        isOpen={isOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onReport={openMessageReport}
        onClose={handleClose}
        onDelete={handleOpenDeleteModal}
      />

      <StoryDeleteConfirmModal
        isOpen={isDeleteModalOpen}
        story={storyToDelete}
        onClose={handleCloseDeleteModal}
      />
      <StoryViewModal />
      <StealthModeModal />
      <StorySettings isOpen={isPrivacyModalOpen} onClose={closeStoryPrivacyEditor} />
    </ShowTransition>
  );
}

export default memo(withGlobal((global): Complete<StateProps> => {
  const {
    shouldSkipHistoryAnimations, storyViewer: {
      storyId, peerId, isPrivacyModalOpen, origin,
    },
  } = selectTabState(global);
  const story = peerId && storyId ? selectPeerStory(global, peerId, storyId) : undefined;
  const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

  return {
    isOpen: selectIsStoryViewerOpen(global),
    shouldSkipHistoryAnimations,
    peerId: peerId!,
    storyId,
    story,
    origin,
    withAnimation,
    isPrivacyModalOpen,
  };
})(StoryViewer));
