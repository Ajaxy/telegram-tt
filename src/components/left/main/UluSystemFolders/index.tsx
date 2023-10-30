import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ISettings } from '../../../../types';
import { LeftColumnContent } from '../../../../types';

import { ARCHIVED_FOLDER_ID } from '../../../../config';
import { selectIsChatWithSelf } from '../../../../global/selectors';
import { uluGetTranslatedString } from '../../../../util/fallbackLangPackInitial';

import { useFolderManagerForUnreadCounters } from '../../../../hooks/useFolderManager';

import UluChatFolder from '../UluChatFolder';

import styles from './UluSystemFolders.module.scss';

type OwnProps = {
  content: LeftColumnContent;
  chatId: string | undefined;
  userId: string | undefined;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

type StateProps = {
  isSavedMessages: boolean;
} & Pick<ISettings, 'language'>;

const INBOX_IS_ACTIVE = false; // TODO catch up with Niko
const NONE_TO_VOID: NoneToVoidFunction = () => void 0;

const UluSystemFolders: FC<OwnProps & StateProps> = ({
  userId, language, content, isSavedMessages, onLeftColumnContentChange,
}) => {
  const titleInbox = uluGetTranslatedString('Sidebar.SystemFolders.Inbox', language);
  const titleSavedMessages = uluGetTranslatedString('Sidebar.SystemFolders.SavedMessages', language);
  const titleArchivedChats = uluGetTranslatedString('Sidebar.SystemFolders.ArchivedChats', language);

  const { focusLastMessage, openChat } = getActions();

  const handleOpenSavedMessages = useCallback(() => {
    openChat({ id: userId, shouldReplaceHistory: true });
    focusLastMessage();
  }, [userId]);

  const handleOpenArchivedChats = useCallback(() => {
    onLeftColumnContentChange(LeftColumnContent.Archived);
  }, [onLeftColumnContentChange]);

  const unreadCounters = useFolderManagerForUnreadCounters();
  const archiveUnreadCount = unreadCounters[ARCHIVED_FOLDER_ID]?.activeChatsCount;
  const savedMessagesUnreadCount = userId ? unreadCounters[userId]?.chatsCount : 0;

  return (
    <div className={styles.wrapper}>
      <UluChatFolder
        active={INBOX_IS_ACTIVE}
        shouldStressUnreadMessages={false}
        type="inbox"
        title={titleInbox}
        messagesUnreadCount={0}
        onClick={NONE_TO_VOID}
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const isChatWithSelf = chatId ? selectIsChatWithSelf(global, chatId) : false;

    return ({
      language: global.settings.byKey.language,
      isSavedMessages: isChatWithSelf,
    });
  },
)(UluSystemFolders));
