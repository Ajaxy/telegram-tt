import React from 'react';
import { Command } from 'cmdk';
import { useCallback, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';

import {
  getChatTitle,
  getChatTypeString,
  getMainUsername, getUserFullName, isDeletedUser,
} from '../../global/helpers';
import { convertLayout } from '../../util/convertLayout';
import { unique } from '../../util/iteratees';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

const AllUsersAndChats: React.FC<
{ close: () => void; searchQuery: string; topUserIds: string[] }> = ({ close, searchQuery, topUserIds }) => {
  const global = getGlobal();
  const usersById: Record<string, ApiUser> = global.users.byId;
  const chatsById: Record<string, ApiChat> = global.chats.byId;
  const { openChat, addRecentlyFoundChatId } = getActions();
  const SEARCH_CLOSE_TIMEOUT_MS = 250;

  const lang = useLang();

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

  const renderName = (id: string, isUser: boolean): { content: React.ReactNode; value: string } => {
    const NBSP = '\u00A0';
    let content: React.ReactNode;
    let value: string;

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
    } else {
      const chat = chatsById[id] as ApiChat;
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

    return { content, value };
  };

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
  }, [openChat, addRecentlyFoundChatId, close]);

  const handeSelect = useCallback((id: string) => () => handleClick(id), [handleClick]);

  const ids = useMemo(() => {
    const convertedSearchQuery = convertLayout(searchQuery).toLowerCase();
    const userAndChatIds = unique([...Object.keys(usersById), ...Object.keys(chatsById)]);
    return userAndChatIds.filter((id) => {
      if (topUserIds && topUserIds.slice(0, 3).includes(id)) {
        return false;
      }
      const isUser = usersById.hasOwnProperty(id);
      if (isUser) {
        const user = usersById[id];
        if (isDeletedUser(user)) return false;
        const name = getUserFullName(user) || ''; // Запасной вариант для 'undefined'
        return name.toLowerCase().includes(searchQuery.toLowerCase())
        || name.toLowerCase().includes(convertedSearchQuery);
      } else {
        const chat = chatsById[id];
        const title = getChatTitle(lang, chat) || ''; // Запасной вариант для 'undefined'
        return title.toLowerCase().includes(searchQuery.toLowerCase())
        || title.toLowerCase().includes(convertedSearchQuery);
      }
    });
  }, [usersById, chatsById, searchQuery, lang, topUserIds]);

  if (!searchQuery) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  return (
    <Command.Group heading={`Search for "${searchQuery}"`}>
      {ids.map((id) => {
        const isUser = usersById.hasOwnProperty(id);
        const { content, value } = renderName(id, isUser);
        // eslint-disable-next-line no-null/no-null
        if (!content) return null;

        return (
          <Command.Item
            key={id}
            value={value}
            onSelect={handeSelect(id)}
          >
            {content}
          </Command.Item>
        );
      })}
    </Command.Group>
  );
};

export default AllUsersAndChats;
