import { useMemo } from '@teact';
import { getActions } from '../../../../global';

import type { ApiChat, ApiTopic } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';

import { getCanManageTopic, getHasAdminRight } from '../../../../global/helpers';
import { IS_TAURI } from '../../../../util/browser/globalEnvironment';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import { compact } from '../../../../util/iteratees';

import useLang from '../../../../hooks/useLang';

export default function useTopicContextActions({
  topic,
  unreadCount,
  chat,
  isChatMuted,
  wasOpened,
  canDelete,
  handleDelete,
  handleMute,
  handleUnmute,
}: {
  topic: ApiTopic;
  chat: ApiChat;
  unreadCount?: number;
  isChatMuted?: boolean;
  wasOpened?: boolean;
  canDelete?: boolean;
  handleDelete?: NoneToVoidFunction;
  handleMute?: NoneToVoidFunction;
  handleUnmute?: NoneToVoidFunction;
}) {
  const lang = useLang();

  const preparedActions = useMemo(() => {
    const {
      isPinned, notifySettings, isClosed, id: topicId,
    } = topic;

    const chatId = chat.id;

    const {
      editTopic,
      toggleTopicPinned,
      markTopicRead,
      openChatInNewTab,
      openQuickPreview,
    } = getActions();

    const canToggleClosed = getCanManageTopic(chat, topic) && !chat.isBotForum;
    const canTogglePinned = getHasAdminRight(chat, 'manageTopics');

    const actionOpenInNewTab = IS_OPEN_IN_NEW_TAB_SUPPORTED && {
      title: IS_TAURI ? lang('ChatListOpenInNewWindow') : lang('ChatListOpenInNewTab'),
      icon: 'open-in-new-tab',
      handler: () => {
        openChatInNewTab({ chatId: chat.id, threadId: topicId });
      },
    };

    const actionQuickPreview = {
      title: lang('QuickPreview'),
      icon: 'eye-outline',
      handler: () => {
        openQuickPreview({ id: chatId, threadId: topicId });
      },
    };

    const actionUnreadMark = unreadCount || !wasOpened
      ? {
        title: lang('ChatListContextMarkAsRead'),
        icon: 'readchats',
        handler: () => {
          markTopicRead({ chatId, topicId });
        },
      }
      : undefined;

    const actionPin = canTogglePinned ? (isPinned
      ? {
        title: lang('ChatListUnpinFromTop'),
        icon: 'unpin',
        handler: () => toggleTopicPinned({ chatId, topicId, isPinned: false }),
      }
      : {
        title: lang('ChatListPinToTop'),
        icon: 'pin',
        handler: () => toggleTopicPinned({ chatId, topicId, isPinned: true }),
      }) : undefined;

    const actionMute = ((isChatMuted && notifySettings.mutedUntil === undefined) || notifySettings.mutedUntil)
      ? {
        title: lang('ChatsUnmute'),
        icon: 'unmute',
        handler: handleUnmute,
      }
      : {
        title: `${lang('ChatsMute')}...`,
        icon: 'mute',
        handler: handleMute,
      };

    const actionCloseTopic = canToggleClosed ? (isClosed
      ? {
        title: lang('ForumTopicReopen'),
        icon: 'reopen-topic',
        handler: () => editTopic({ chatId, topicId, isClosed: false }),
      }
      : {
        title: lang('ForumTopicClose'),
        icon: 'pause-circle',
        handler: () => editTopic({ chatId, topicId, isClosed: true }),
      }) : undefined;

    const actionDelete = canDelete ? {
      title: lang('Delete'),
      icon: 'delete',
      destructive: true,
      handler: handleDelete,
    } : undefined;

    return compact([
      actionOpenInNewTab,
      actionQuickPreview,
      actionPin,
      actionUnreadMark,
      actionMute,
      actionCloseTopic,
      actionDelete,
    ]) as MenuItemContextAction[];
  }, [
    chat, topic, unreadCount, wasOpened, isChatMuted, canDelete,
    handleDelete, handleMute, handleUnmute, lang,
  ]);

  return preparedActions;
}
