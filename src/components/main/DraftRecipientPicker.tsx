import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { TabState } from '../../global/types';
import type { ThreadId } from '../../types';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  requestedDraft?: TabState['requestedDraft'];
};

const DraftRecipientPicker: FC<OwnProps> = ({
  requestedDraft,
}) => {
  const isOpen = Boolean(requestedDraft && !requestedDraft.chatId);
  const {
    openChatWithDraft,
    resetOpenChatWithDraft,
  } = getActions();

  const lang = useLang();

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const handleSelectRecipient = useCallback((recipientId: string, threadId?: ThreadId) => {
    openChatWithDraft({
      chatId: recipientId,
      threadId,
      text: requestedDraft!.text,
      files: requestedDraft!.files,
    });
  }, [openChatWithDraft, requestedDraft]);

  const handleClose = useCallback(() => {
    resetOpenChatWithDraft();
  }, [resetOpenChatWithDraft]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      searchPlaceholder={lang('ForwardTo')}
      filter={requestedDraft?.filter}
      onSelectRecipient={handleSelectRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(DraftRecipientPicker);
