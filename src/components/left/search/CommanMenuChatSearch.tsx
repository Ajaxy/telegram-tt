/* eslint-disable no-console */
/* eslint-disable react/jsx-no-bind */
import React, {
  memo, useEffect, useMemo, useState,
} from 'react';
import { Command } from 'cmdk';
import { useCallback } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat, ApiChatFolder, ApiUser } from '../../../api/types';

import {
  filterUsersByName,
  getChatLink, getChatTitle,
  getChatTypeString,
  getMainUsername, getUserFullName, isDeletedUser,
  sortChatIds,
} from '../../../global/helpers';
import { selectTabState } from '../../../global/selectors';
import { convertLayout } from '../../../util/convertLayout';
import { unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import renderText from '../../common/helpers/renderText';

import { useJune } from '../../../hooks/useJune';
import useLang from '../../../hooks/useLang';

import '../../main/CommandMenu.scss';

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
};

interface StateProps {
  currentUserId?: string;
  localContactIds?: string[];
  localChatIds?: string[];
  localUserIds?: string[];
  chatsById: Record<string, ApiChat>;
}

interface OwnProps {
  close: () => void;
  searchQuery: string;
  recentlyFoundChatIds?: string[];
  folders: ApiChatFolder[];
  openFolderPage: (folderId: number) => void;
  setInputValue: (value: string) => void;
  topUserIds?: string[];
}

const CommanMenuChatSearch: React.FC<OwnProps & StateProps> = ({
  close, searchQuery, topUserIds, folders, openFolderPage, setInputValue, recentlyFoundChatIds, currentUserId,
  localContactIds, localChatIds, localUserIds, chatsById,
}) => {
  console.log('Props:', {
    close,
    searchQuery,
    topUserIds,
    folders,
    openFolderPage,
    setInputValue,
    recentlyFoundChatIds,
    currentUserId,
    localContactIds,
    localChatIds,
    localUserIds,
    chatsById,
  });
  const { openChat, addRecentlyFoundChatId } = getActions();
  const SEARCH_CLOSE_TIMEOUT_MS = 250;
  const [shouldShowMore, setShouldShowMore] = useState(false);
  const LESS_LIST_ITEMS_AMOUNT = 5;

  const toggleShowMore = useCallback(() => {
    setShouldShowMore((prev) => !prev);
  }, []);

  const { track } = useJune();

  const lang = useLang();
  const usersById = getGlobal().users.byId;
  const localResults = useMemo(() => {
    if (!searchQuery || (searchQuery.startsWith('@') && searchQuery.length < 2)) {
      return MEMO_EMPTY_ARRAY;
    }

    const contactIdsWithMe = [
      ...(currentUserId ? [currentUserId] : []),
      ...(localContactIds || []),
    ];
    // No need for expensive global updates on users, so we avoid them
    const foundContactIds = filterUsersByName(
      contactIdsWithMe, usersById, searchQuery, currentUserId, lang('SavedMessages'),
    );
    console.log('Local Results:', localResults);
    return [
      ...sortChatIds(unique([
        ...(foundContactIds || []),
        ...(localChatIds || []),
        ...(localUserIds || []),
      ]), chatsById, undefined, currentUserId ? [currentUserId] : undefined),
    ];
  }, [searchQuery, currentUserId, localContactIds, usersById, lang, localChatIds, localUserIds, chatsById]);

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
      value = `${title} ${groupStatus} ${link !== NBSP ? link : ''}`.trim();
    }
    console.log('Render Name:', {
      id, isUser, content, value,
    });
    return { content, value };
  };

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
    if (track) {
      track('Use global search in Сommand Menu');
    }
  }, [close, track]);

  const handeSelect = useCallback((id: string) => () => handleClick(id), [handleClick]);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // Задержка в 300 мс
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const combinedResults = useMemo(() => {
    const allResults = [...localResults];
    const uniqueResults = unique(allResults);

    return uniqueResults.filter((id) => {
      const isUser = usersById.hasOwnProperty(id);
      if (isUser) {
        const user = usersById[id];
        if (isDeletedUser(user)) return false;
        if (topUserIds && topUserIds.slice(0, 3).includes(id)) return false;
      } else if (recentlyFoundChatIds && recentlyFoundChatIds.slice(0, 2).includes(id)) return false;

      return true;
    });
  }, [localResults, usersById, topUserIds, recentlyFoundChatIds]);

  const ids = useMemo(() => {
    const convertedSearchQuery = convertLayout(debouncedSearchQuery).toLowerCase();
    return combinedResults.filter((id) => {
      const title = getChatTitle(lang, chatsById[id]) || getUserFullName(usersById[id]) || '';
      return title.toLowerCase().includes(convertedSearchQuery);
    });
  }, [combinedResults, debouncedSearchQuery, chatsById, usersById, lang]);

  const idsToShow = useMemo(() => {
    return shouldShowMore ? ids : ids.slice(0, LESS_LIST_ITEMS_AMOUNT);
  }, [ids, shouldShowMore]);

  if (!searchQuery) {
    console.log('Render: null for no searchQuery');
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  /*  const nothingFound = fetchingStatus && !fetchingStatus.chats && !fetchingStatus.messages
  && !localResults.length; */

  if (!searchQuery) {
    return undefined;
  }

  return (
    <>
      <Command.Group heading={`Search for "${searchQuery}"`}>
        {idsToShow.map((id) => {
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
        {ids.length > LESS_LIST_ITEMS_AMOUNT && (
          <Command.Item
            onSelect={toggleShowMore}
          >
            {lang(shouldShowMore ? 'Show Less' : 'Show More')}
          </Command.Item>
        )}
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

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    console.log('Global State:', global);
    const { byId: chatsById } = global.chats;

    const { userIds: localContactIds } = global.contactList || {};
    const {
      currentUserId,
    } = global;

    if (!localContactIds) {
      return {
        chatsById,
      };
    }

    const { localResults } = selectTabState(global).globalSearch;
    const { chatIds: localChatIds, userIds: localUserIds } = localResults || {};

    return {
      currentUserId,
      localContactIds,
      localChatIds,
      localUserIds,
      chatsById,
    };
  },
)(CommanMenuChatSearch));

/* export default CommanMenuChatSearch; */
