/* eslint-disable no-console */
/* eslint-disable react/jsx-no-bind */
import React, { useMemo } from 'react';
import { Command } from 'cmdk';
import { useCallback } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiChat, ApiChatFolder, ApiUser } from '../../../api/types';

import {
  getChatLink, getChatTitle,
  getChatTypeString,
  getMainUsername, getUserFullName, isDeletedUser,
  sortChatIds,
} from '../../../global/helpers';
import { convertLayout } from '../../../util/convertLayout';
import { unique } from '../../../util/iteratees';
import { transliterate } from '../../../util/transliterate';
import renderText from '../../common/helpers/renderText';

import { useJune } from '../../../hooks/useJune';
import useLang from '../../../hooks/useLang';

import CommandMenuListItem from '../../common/commandmenu/CommanMenuListItem';

import '../../main/CommandMenu.scss';

const CommanMenuChatSearch: React.FC<{
  close: () => void;
  searchQuery: string;
  folders: ApiChatFolder[];
  openFolderPage: (folderId: number) => void;
  setInputValue: (value: string) => void;
  topUserIds?: string[];
  recentlyFoundChatIds?: string[];
  pinnedIds?: string[];
  currentUserId?: string;
}> = ({
  close, searchQuery, folders, openFolderPage, setInputValue, topUserIds, recentlyFoundChatIds, pinnedIds,
  currentUserId,
}) => {
  const global = getGlobal();
  const usersById: Record<string, ApiUser> = global.users.byId;
  const chatsById: Record<string, ApiChat> = global.chats.byId;
  const { openChat, addRecentlyFoundChatId } = getActions();
  const SEARCH_CLOSE_TIMEOUT_MS = 250;
  const { track } = useJune();
  const lang = useLang();
  const handleSelectFolder = useCallback((folderId) => {
    openFolderPage(folderId);
    setInputValue('');
  }, [openFolderPage, setInputValue]);
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
      value = `${name} ${handle !== NBSP ? handle : ''} @${handle !== NBSP ? handle : ''}`.trim();
    } else {
      const chat = chatsById[id] as ApiChat;
      if (!chat) {
        return { content: undefined, value: '' };
      }
      const title = getChatTitle(lang, chat) || 'Unknown Chat';
      const link = getChatLink(chat);
      const groupStatus = getGroupStatus(chat);
      content = (
        <span>
          <span className="chat-title">{title}</span>
          <span className="chat-status">{groupStatus}</span>
        </span>
      );
      value = `${title} ${groupStatus} ${link !== NBSP ? link : ''}`.trim();
    }
    return { content, value };
  };
  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
    if (typeof track === 'function') {
      track('Use global search in Сommand Menu');
    }
  }, [close, track]);
  const handeSelect = useCallback((id: string) => () => handleClick(id), [handleClick]);

  const ids = useMemo(() => {
    const convertedSearchQuery = convertLayout(searchQuery).toLowerCase();
    const transliteratedSearchQuery = transliterate(searchQuery).toLowerCase();

    let priorityIds = unique([...(pinnedIds ?? []), ...(recentlyFoundChatIds ?? []), ...(topUserIds ?? [])]);
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    const chatIds = Object.keys(chatsById).filter((id) => {
      const chat = chatsById[id];
      const title = getChatTitle(lang, chat) || '';
      return title.toLowerCase().includes(searchQuery.toLowerCase())
      || title.toLowerCase().includes(transliteratedSearchQuery)
      || title.toLowerCase().includes(convertedSearchQuery);
    });

    const userIds = Object.keys(usersById).filter((id) => {
      const user = usersById[id];
      if (!user || isDeletedUser(user)) return false;
      const name = getUserFullName(user) || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase())
      || name.toLowerCase().includes(transliteratedSearchQuery)
      || name.toLowerCase().includes(convertedSearchQuery);
    });

    const allIds = unique([...chatIds, ...userIds]);
    const sortedIds = sortChatIds(allIds, chatsById);

    // Удаление приоритетных ID из отсортированных ID
    const finalIds = sortedIds.filter((id) => !priorityIds.includes(id));

    if (searchQuery.length < 2) {
      return [];
    }

    // Объединение приоритетных и отсортированных остальных чатов
    return unique([...priorityIds, ...finalIds]);
  }, [searchQuery, chatsById, usersById, pinnedIds, recentlyFoundChatIds, topUserIds, currentUserId, lang]);

  if (!searchQuery) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  return (
    <>
      <Command.Group heading={`Search for "${searchQuery}"`}>
        {ids.map((id) => {
          const isUser = usersById.hasOwnProperty(id);
          const { content, value } = renderName(id, isUser);
          if (!content) return undefined;
          return (
            <CommandMenuListItem key={id} value={value} onSelect={handeSelect(id)} content={content} />
          );
        })}
      </Command.Group>
      <Command.Group heading="Folders">
        {folders.map((folder) => (
          <Command.Item
            key={folder.id}
            onSelect={() => folder && handleSelectFolder(folder.id)}
            value={`${folder?.title} ${folder?.id}`}
          >
            <i className="icon icon-folder" /><span>{folder?.title || `Folder ${folder?.id}`}</span>
          </Command.Item>
        ))}
      </Command.Group>
    </>
  );
};
export default CommanMenuChatSearch;
