import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import useLang from '../../hooks/useLang';

import ConfirmDialog from '../ui/ConfirmDialog';

interface OwnProps {
  isOpen: boolean;
  storyId?: number;
  onClose: NoneToVoidFunction;
}

function StoryDeleteConfirmModal({ isOpen, storyId, onClose }: OwnProps) {
  const { deleteStory, openNextStory } = getActions();

  const lang = useLang();

  const handleDeleteStoryClick = useCallback(() => {
    if (!storyId) {
      return;
    }

    openNextStory();
    deleteStory({ storyId });
    onClose();
  }, [onClose, storyId]);

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
