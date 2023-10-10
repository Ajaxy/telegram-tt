import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiTypeStory } from '../../api/types';

import useLang from '../../hooks/useLang';

import ConfirmDialog from '../ui/ConfirmDialog';

interface OwnProps {
  isOpen: boolean;
  story?: ApiTypeStory;
  onClose: NoneToVoidFunction;
}

function StoryDeleteConfirmModal({
  isOpen, story, onClose,
}: OwnProps) {
  const { deleteStory, openNextStory } = getActions();

  const lang = useLang();

  const handleDeleteStoryClick = useCallback(() => {
    if (!story) {
      return;
    }

    openNextStory();
    deleteStory({ peerId: story.peerId, storyId: story.id });
    onClose();
  }, [onClose, story]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={lang('DeleteStoryTitle')}
      text={lang('DeleteStorySubtitle')}
      confirmLabel={lang('Delete')}
      confirmHandler={handleDeleteStoryClick}
      confirmIsDestructive
      className="component-theme-dark"
    />
  );
}

export default memo(StoryDeleteConfirmModal);
