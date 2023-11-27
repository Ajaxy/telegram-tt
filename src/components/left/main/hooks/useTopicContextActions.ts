import { useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiChat, ApiTopic } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';

import { getCanManageTopic, getHasAdminRight } from '../../../../global/helpers';
import { compact } from '../../../../util/iteratees';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../../util/windowEnvironment';

import useLang from '../../../../hooks/useLang';
import useSnooze from '../../../../hooks/useSnooze';

export default function useTopicContextActions({
  topic,
  chat,
  wasOpened,
  canDelete,
  handleDelete,
  handleMute,
}: {
  topic: ApiTopic;
  chat: ApiChat;
  wasOpened?: boolean;
  canDelete?: boolean;
  handleDelete?: NoneToVoidFunction;
  handleMute?: NoneToVoidFunction;
}) {
  const lang = useLang();
  const { snooze } = useSnooze();

  return useMemo(() => {
    const {
      isPinned, isMuted, isClosed, id: topicId,
    } = topic;

    const chatId = chat.id;

    const {
      editTopic,
      toggleTopicPinned,
      markTopicRead,
      updateTopicMutedState,
      openChatInNewTab,
    } = getActions();

    const canToggleClosed = getCanManageTopic(chat, topic);
    const canTogglePinned = chat.isCreator || getHasAdminRight(chat, 'manageTopics');

    const actionNotifyMe = {
      title: lang('NotifyMeHotkey'),
      icon: 'schedule',
      handler: () => {
        snooze({ chatId, topicId });
      },
    };

    const actionOpenInNewTab = IS_OPEN_IN_NEW_TAB_SUPPORTED && {
      title: 'Open in new tab',
      icon: 'open-in-new-tab',
      handler: () => {
        openChatInNewTab({ chatId: chat.id, threadId: topicId });
      },
    };

    const actionUnreadMark = topic.unreadCount || !wasOpened
      ? {
        title: lang('MarkAsRead'),
        icon: 'readchats',
        handler: () => {
          markTopicRead({ chatId, topicId });
        },
      }
      : undefined;

    const actionPin = canTogglePinned ? (isPinned
      ? {
        title: lang('UnpinFromTop'),
        icon: 'unpin',
        handler: () => toggleTopicPinned({ chatId, topicId, isPinned: false }),
      }
      : {
        title: lang('PinToTop'),
        icon: 'pin',
        handler: () => toggleTopicPinned({ chatId, topicId, isPinned: true }),
      }) : undefined;

    const actionMute = ((chat.isMuted && isMuted !== false) || isMuted === true)
      ? {
        title: lang('ChatList.Unmute'),
        icon: 'unmute',
        handler: () => updateTopicMutedState({ chatId, topicId, isMuted: false }),
      }
      : {
        title: `${lang('ChatList.Mute')}...`,
        icon: 'mute',
        handler: handleMute,
      };

    const actionCloseTopic = canToggleClosed ? (isClosed
      ? {
        title: lang('lng_forum_topic_reopen'),
        icon: 'reopen-topic',
        handler: () => editTopic({ chatId, topicId, isClosed: false }),
      }
      : {
        title: lang('lng_forum_topic_close'),
        icon: 'close-topic',
        handler: () => editTopic({ chatId, topicId, isClosed: true }),
      }) : undefined;

    const actionDelete = canDelete ? {
      title: lang('lng_forum_topic_delete'),
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    } : undefined;

    return compact([
      actionNotifyMe,
      actionOpenInNewTab,
      actionPin,
      actionUnreadMark,
      actionMute,
      actionCloseTopic,
      actionDelete,
    ]) as MenuItemContextAction[];
  }, [topic, chat, wasOpened, lang, canDelete, handleDelete, handleMute, snooze]);
}
