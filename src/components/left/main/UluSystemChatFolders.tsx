import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ISettings } from '../../../types';
import { LeftColumnContent } from '../../../types';

import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID } from '../../../config';
import { selectIsChatWithSelf, selectTabState } from '../../../global/selectors';
import { uluGetTranslatedString } from '../../../util/fallbackLangPackInitial';

import useCommands from '../../../hooks/useCommands';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';

import UluChatFolder from './UluChatFolder';
import UluChatFoldersWrapper from './UluChatFoldersWrapper';

type OwnProps = {
  ref: RefObject<HTMLDivElement>;
  content: LeftColumnContent;
  chatId: string | undefined;
  userId: string | undefined;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

type StateProps = {
  isSavedMessages: boolean;
  isInbox: boolean;
} & Pick<ISettings, 'language'>;

const UluSystemFolders: FC<OwnProps & StateProps> = ({
  userId, language, content, isSavedMessages, onLeftColumnContentChange, isInbox, ref,
}) => {
  const titleInbox = uluGetTranslatedString('Sidebar.SystemFolders.Inbox', language);
  const titleSavedMessages = uluGetTranslatedString('Sidebar.SystemFolders.SavedMessages', language);
  const titleArchivedChats = uluGetTranslatedString('Sidebar.SystemFolders.ArchivedChats', language);

  const { focusLastMessage, openChat, setActiveChatFolder } = getActions();

  const handleOpenSavedMessages = useCallback(() => {
    openChat({ id: userId, shouldReplaceHistory: true });
    focusLastMessage();
  }, [userId]);

  const handleOpenArchivedChats = useCallback(() => {
    onLeftColumnContentChange(LeftColumnContent.Archived);
  }, [onLeftColumnContentChange]);

  const handleOpenInbox = useCallback(() => {
    setActiveChatFolder({ activeChatFolder: ALL_FOLDER_ID });
  }, [setActiveChatFolder]);

  const { useCommand } = useCommands();
  useCommand('OPEN_INBOX', handleOpenInbox);
  useCommand('OPEN_SAVED', handleOpenSavedMessages);

  const unreadCounters = useFolderManagerForUnreadCounters();
  const archiveUnreadCount = unreadCounters[ARCHIVED_FOLDER_ID]?.activeChatsCount;
  const savedMessagesUnreadCount = userId ? unreadCounters[userId]?.chatsCount : 0;
  const inboxUnreadCount = unreadCounters[ALL_FOLDER_ID]?.chatsCount;

  return (
    <UluChatFoldersWrapper ref={ref}>
      <UluChatFolder
        active={isInbox}
        shouldStressUnreadMessages={false}
        type="inbox"
        title={titleInbox}
        messagesUnreadCount={inboxUnreadCount}
        onClick={handleOpenInbox}
      />
      <UluChatFolder
        active={isSavedMessages}
        shouldStressUnreadMessages={false}
        type="saved-messages"
        title={titleSavedMessages}
        messagesUnreadCount={savedMessagesUnreadCount}
        onClick={handleOpenSavedMessages}
      />
      <UluChatFolder
        active={content === LeftColumnContent.Archived}
        shouldStressUnreadMessages={false}
        type="archived-chats"
        title={titleArchivedChats}
        messagesUnreadCount={archiveUnreadCount}
        onClick={handleOpenArchivedChats}
      />
    </UluChatFoldersWrapper>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { activeChatFolder } = selectTabState(global);
    const isChatWithSelf = chatId ? selectIsChatWithSelf(global, chatId) : false;

    return ({
      language: global.settings.byKey.language,
      isSavedMessages: isChatWithSelf,
      isInbox: activeChatFolder === ALL_FOLDER_ID && chatId === undefined,
    });
  },
)(UluSystemFolders));
