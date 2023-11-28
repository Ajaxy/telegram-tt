/* eslint-disable no-null/no-null */
import React from 'react';
import { Command } from 'cmdk';
import { useCallback, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';

import {
  getChatLink,
  getChatTitle, getChatTypeString,
  getMainUsername, getUserFullName, isDeletedUser,
} from '../../global/helpers';
import renderText from './helpers/renderText';

import { useJune } from '../../hooks/useJune';
import useLang from '../../hooks/useLang';

interface FolderPageProps {
  folderId: number;
  close: () => void;
}

const FolderPage: React.FC<FolderPageProps> = ({
  folderId,
  close,
}) => {
  const global = getGlobal();
  const chatFoldersById = global.chatFolders.byId;
  const chatsById = global.chats.byId;
  const usersById: Record<string, ApiUser> = global.users.byId;
  const { openChat } = getActions();
  const { track } = useJune();

  const lang = useLang();

  const folder = chatFoldersById[folderId];

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    close();
    if (track) {
      track('Use folder search in Сommand Menu');
    }
  }, [close, track]);

  const handeSelect = useCallback((id: string) => () => handleClick(id), [handleClick]);

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
      const link = getChatLink(chat);
      const groupStatus = getGroupStatus(chat);
      content = (
        <span>
          <span className="chat-title">{title}</span>
          <span className="chat-status">{groupStatus}</span>
        </span>
      );
      value = `${title} ${link !== NBSP ? link : ''}`.trim();
    }

    return { content, value };
  };

  const chatsInFolder = useMemo(() => {
    if (!folder) {
      //
    }
    const includedChatIds = folder?.includedChatIds || [];
    return includedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean);
  }, [chatsById, folder]);

  const pinnedChats = useMemo(() => {
    if (!folder) {
      return [];
    }
    const pinnedChatIds = folder.pinnedChatIds || [];
    return pinnedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean);
  }, [chatsById, folder]);

  return (
    <Command.Group>
      {pinnedChats.map((chat) => {
        const isUser = usersById.hasOwnProperty(chat.id);
        const { content, value } = renderName(chat.id, isUser);
        if (!content) return null;

        return (
          <Command.Item
            key={chat.id} // Используйте chat.id как ключ
            value={value}
            onSelect={handeSelect(chat.id)}
          >
            <span>{content}</span><i className="icon icon-pinned-chat" cmdk-pinned="" />
          </Command.Item>
        );
      })}
      {chatsInFolder.map((chat) => {
        const isUser = usersById.hasOwnProperty(chat.id);
        const { content, value } = renderName(chat.id, isUser);
        if (!content) return null;

        return (
          <Command.Item
            key={chat.id} // Используйте chat.id как ключ
            value={value}
            onSelect={handeSelect(chat.id)} // Передайте chat.id как строку
          >
            {content}
          </Command.Item>
        );
      })}
    </Command.Group>
  );
};

export default FolderPage;
