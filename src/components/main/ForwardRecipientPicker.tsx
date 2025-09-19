import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ThreadId } from '../../types';

import { getChatTitle, getUserFirstOrLastName } from '../../global/helpers';
import {
  selectChat,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import { isUserId } from '../../util/entities/ids';

import useFlag from '../../hooks/useFlag';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import RecipientPicker from '../common/RecipientPicker';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  currentUserId?: string;
  isManyMessages?: boolean;
  isStory?: boolean;
  isForwarding?: boolean;
}

const ForwardRecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  isManyMessages,
  isStory,
  isForwarding,
}) => {
  const {
    openChatOrTopicWithReplyInDraft,
    setForwardChatOrTopic,
    exitForwardMode,
    forwardToSavedMessages,
    forwardStory,
    showNotification,
  } = getActions();

  const lang = useOldLang();

  const renderingIsStory = usePreviousDeprecated(isStory, true);
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
      if (isForwarding) {
        setForwardChatOrTopic({ chatId, topicId });
      } else {
        openChatOrTopicWithReplyInDraft({ chatId, topicId });
      }
    }
  }, [currentUserId, isManyMessages, isStory, lang, isForwarding]);

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
      searchPlaceholder={lang(isForwarding ? 'ForwardTo' : 'ReplyToDialog')}
      onSelectRecipient={handleSelectRecipient}
      onClose={handleClose}
      onCloseAnimationEnd={unmarkIsShown}
      isForwarding={isForwarding}
    />
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const { messageIds, storyId } = selectTabState(global).forwardMessages;
  const isForwarding = (messageIds && messageIds.length > 0);
  return {
    currentUserId: global.currentUserId,
    isManyMessages: (messageIds?.length || 0) > 1,
    isStory: Boolean(storyId),
    isForwarding,
  };
})(ForwardRecipientPicker));
