import { getActions } from '../../../../global';

import type { ApiChat, ApiTopic } from '../../../../api/types';

import { compact } from '../../../../util/iteratees';
import { getHasAdminRight } from '../../../../global/helpers';

import useLang from '../../../../hooks/useLang';
import { useMemo } from '../../../../lib/teact/teact';

export default function useTopicContextActions(
  topic: ApiTopic,
  chat: ApiChat,
  wasOpened?: boolean,
  canDelete?: boolean,
  handleDelete?: NoneToVoidFunction,
) {
  const lang = useLang();

  return useMemo(() => {
    const {
      isPinned, isMuted, isClosed, isOwner, id: topicId,
    } = topic;

    const chatId = chat.id;

    const {
      editTopic,
      toggleTopicPinned,
      markTopicRead,
      updateTopicMutedState,
    } = getActions();

    const canToggleClosed = isOwner || chat.isCreator || getHasAdminRight(chat, 'manageTopics');
    const canTogglePinned = chat.isCreator || getHasAdminRight(chat, 'manageTopics');

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
        title: lang('ChatList.Mute'),
        icon: 'mute',
        handler: () => updateTopicMutedState({ chatId, topicId, isMuted: true }),
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
      actionPin,
      actionUnreadMark,
      actionMute,
      actionCloseTopic,
      actionDelete,
    ]);
  }, [topic, chat, wasOpened, lang, canDelete, handleDelete]);
}
