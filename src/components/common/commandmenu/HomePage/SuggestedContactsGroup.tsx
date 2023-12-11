/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiChat, ApiUser } from '../../../../api/types';

import {
  getChatTitle, getChatTypeString, getMainUsername, getUserFullName, isDeletedUser,
} from '../../../../global/helpers';
import { throttle } from '../../../../util/schedulers';
import renderText from '../../helpers/renderText';

import { useJune } from '../../../../hooks/useJune';
import useLang from '../../../../hooks/useLang';

import '../../../main/CommandMenu.scss';

const SEARCH_CLOSE_TIMEOUT_MS = 250;

interface SuggestedContactsProps {
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  chatsById?: Record<string, ApiChat>;
  recentlyFoundChatIds?: string[];
  close: () => void; // Добавляем пропс close
}

const SuggestedContacts: FC<SuggestedContactsProps> = ({
  topUserIds, usersById, chatsById, recentlyFoundChatIds, close,
}) => {
  const {
    loadTopUsers, openChat, addRecentlyFoundChatId,
  } = getActions();
  const runThrottled = throttle(() => loadTopUsers(), 60000, true);
  const lang = useLang();
  const uniqueTopUserIds = topUserIds?.filter((id) => !recentlyFoundChatIds?.slice(0, 2).includes(id)) || [];
  function getGroupStatus(chat: ApiChat) {
    const chatTypeString = lang(getChatTypeString(chat));
    const { membersCount } = chat;

    if (chat.isRestricted) {
      return chatTypeString === 'Channel' ? 'channel is inaccessible' : 'group is inaccessible';
    }

    if (!membersCount) {
      return chatTypeString;
    }

    return chatTypeString === 'Channel'
      ? lang('Subscribers', membersCount, 'i')
      : lang('Members', membersCount, 'i');
  }

  useEffect(() => {
    runThrottled();
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [loadTopUsers]);

  const renderName = (id: string, isUser: boolean, isChat: boolean): { content: React.ReactNode; value: string } => {
    const NBSP = '\u00A0';
    let content: React.ReactNode;
    let value = '';

    if (isUser) {
      const user = usersById[id] as ApiUser;
      if (isDeletedUser(user)) {
        return { content: undefined, value: '' };
      }
      const name = getUserFullName(user) || NBSP;
      const handle = getMainUsername(user) || NBSP;
      const renderedName = renderText(name);
      content = React.isValidElement(renderedName) ? renderedName : (
        <span>
          <span className="entity-name">{name}</span>
          <span className="user-handle">{handle !== NBSP ? `@${handle}` : ''}</span>
        </span>
      );
      value = `${name} ${handle !== NBSP ? handle : ''}`.trim();
    } else if (isChat && chatsById) {
      const chat = chatsById[id] as ApiChat;
      if (chat) {
        const title = getChatTitle(lang, chat) || 'Unknown Chat';
        const groupStatus = getGroupStatus(chat);
        content = (
          <span>
            <span className="chat-title">{title}</span>
            <span className="chat-status">{groupStatus}</span>
          </span>
        );
        value = title;
      }
    }

    return { content, value };
  };
  const { track } = useJune();
  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
    track?.('Use suggestions in Сommand Menu', { chatId: id });
  }, [close, track]);

  return (
    <Command.Group heading="Suggestions">
      {recentlyFoundChatIds && recentlyFoundChatIds.slice(0, 2).map((id) => {
        const isUser = usersById.hasOwnProperty(id);
        const isChat = !!chatsById && chatsById.hasOwnProperty(id); // Используйте !! для приведения к boolean
        const { content, value } = renderName(id, isUser, isChat);

        return content && (
          <Command.Item key={id} value={value} onSelect={() => handleClick(id)}>
            {content}
          </Command.Item>
        );
      })}
      {uniqueTopUserIds && uniqueTopUserIds.slice(0, 3).map((id) => {
        const isUser = usersById.hasOwnProperty(id);
        const isChat = !!chatsById && chatsById.hasOwnProperty(id); // Используйте !! для приведения к boolean
        const { content, value } = renderName(id, isUser, isChat);
        return content && (
          <Command.Item key={id} value={value} onSelect={() => handleClick(id)}>
            {content}
          </Command.Item>
        );
      })}
    </Command.Group>
  );
};

export default SuggestedContacts;
