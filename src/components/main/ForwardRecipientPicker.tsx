import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { getChatTitle, getUserFirstOrLastName, isUserId } from '../../global/helpers';
import {
  selectChat,
  selectCurrentChat,
  selectDraft,
  selectTabState,
  selectUser,
} from '../../global/selectors';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  currentUserId?: string;
  isManyMessages?: boolean;
  isStory?: boolean;
  isReplying?: boolean;
}

const ForwardRecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  isManyMessages,
  isStory,
  isReplying,
}) => {
  const {
    openChatOrTopicWithReplyInDraft,
    setForwardChatOrTopic,
    exitForwardMode,
    forwardToSavedMessages,
    forwardStory,
    showNotification,
  } = getActions();

  const lang = useLang();

  const renderingIsStory = usePrevious(isStory, true);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  const handleSelectRecipient = useCallback((recipientId: string, threadId?: ThreadId) => {
    const isSelf = recipientId === currentUserId;
    if (isStory) {
      forwardStory({ toChatId: recipientId });
      const global = getGlobal();
      if (isUserId(recipientId)) {
        showNotification({
          message: isSelf
            ? lang('Conversation.StoryForwardTooltip.SavedMessages.One')
            : lang(
              'StorySharedTo',
              getUserFirstOrLastName(selectUser(global, recipientId)),
            ),
        });
      } else {
        const chat = selectChat(global, recipientId);
        if (!chat) return;

        showNotification({
          message: lang('StorySharedTo', getChatTitle(lang, chat)),
        });
      }
      return;
    }

    if (isSelf) {
      const message = lang(
        isManyMessages
          ? 'Conversation.ForwardTooltip.SavedMessages.Many'
          : 'Conversation.ForwardTooltip.SavedMessages.One',
      );

      forwardToSavedMessages();
      showNotification({ message });
    } else {
      const chatId = recipientId;
      const topicId = threadId ? Number(threadId) : undefined;
      if (isReplying) {
        openChatOrTopicWithReplyInDraft({ chatId, topicId });
      } else {
        setForwardChatOrTopic({ chatId, topicId });
      }
    }
  }, [currentUserId, isManyMessages, isStory, lang, isReplying]);

  const handleClose = useCallback(() => {
    exitForwardMode();
  }, [exitForwardMode]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  return (
    <RecipientPicker
      isOpen={isOpen}
      className={renderingIsStory ? 'component-theme-dark' : undefined}
      searchPlaceholder={lang('ForwardTo')}
      onSelectRecipient={handleSelectRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
    />
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { messageIds, storyId } = selectTabState(global).forwardMessages;
  const currentChatId = selectCurrentChat(global)?.id;
  const isReplying = currentChatId && selectDraft(global, currentChatId, MAIN_THREAD_ID)?.replyInfo;
  return {
    currentUserId: global.currentUserId,
    isManyMessages: (messageIds?.length || 0) > 1,
    isStory: Boolean(storyId),
    isReplying: Boolean(isReplying),
  };
})(ForwardRecipientPicker));
