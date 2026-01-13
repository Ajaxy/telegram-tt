import { type TeactNode, useMemo } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import type { ApiMessageEntity, ApiMessageEntityCustomEmoji } from '../api/types';
import type { MenuItemContextAction } from '../components/ui/ListItem';
import type { TabWithProperties } from '../components/ui/TabList';
import { type ApiChatFolder, type ApiChatlistExportedInvite, ApiMessageEntityTypes } from '../api/types';
import { SettingsScreens } from '../types';

import { ALL_FOLDER_ID } from '../config';
import { selectCanShareFolder } from '../global/selectors';
import { MEMO_EMPTY_ARRAY } from '../util/memo';
import { renderTextWithEntities } from '../components/common/helpers/renderTextWithEntities';
import useAppLayout from './useAppLayout';
import { useFolderManagerForUnreadChatsByFolder, useFolderManagerForUnreadCounters } from './useFolderManager';
import useLang from './useLang';
import useLastCallback from './useLastCallback';

type FolderNameOptions = {
  text: string;
  entities?: ApiMessageEntity[];
  noCustomEmojiPlayback?: boolean;
  emojiSize?: number;
};

type Params = {
  sidebarMode: boolean;
  orderedFolderIds?: number[];
  chatFoldersById: Record<number, ApiChatFolder>;
  maxFolders: number;
} & ({
  isReadOnly?: false;
  maxChatLists: number;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  maxFolderInvites: number;
} | {
  isReadOnly: true;
});

const useFolderTabs = (params: Params) => {
  const {
    sidebarMode,
    orderedFolderIds,
    chatFoldersById,
    maxFolders,
    isReadOnly,
  } = params;

  const {
    maxChatLists,
    folderInvitesById,
    maxFolderInvites,
  } = !isReadOnly ? params : {};

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const {
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
    markChatMessagesRead,
    openSettingsScreen,
    setSharedSettingOption,
  } = getActions();

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
      emoticon: '💬',
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const folderUnreadChatsCountersById = useFolderManagerForUnreadChatsByFolder();
  const handleReadAllChats = useLastCallback((folderId: number) => {
    const unreadChatIds = folderUnreadChatsCountersById[folderId];
    if (!unreadChatIds?.length) return;

    unreadChatIds.forEach((chatId) => {
      markChatMessagesRead({ id: chatId });
    });
  });

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder, i) => {
      const { id, title } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (!isReadOnly) {
        if (canShareFolder) {
          contextActions.push({
            title: lang('FilterShare'),
            icon: 'link',
            handler: () => {
              const chatListCount = Object.values(chatFoldersById)
                .reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
              if (chatListCount >= maxChatLists! && !folder.isChatList) {
                openLimitReachedModal({
                  limit: 'chatlistJoined',
                });
                return;
              }

              // Greater amount can be after premium downgrade
              if (folderInvitesById![id]?.length >= maxFolderInvites!) {
                openLimitReachedModal({
                  limit: 'chatlistInvites',
                });
                return;
              }

              openShareChatFolderModal({
                folderId: id,
              });
            },
          });
        }

        if (id === ALL_FOLDER_ID) {
          contextActions.push({
            title: lang('FilterEditFolders'),
            icon: 'edit',
            handler: () => {
              openSettingsScreen({ screen: SettingsScreens.Folders });
            },
          });

          if (folderUnreadChatsCountersById[id]?.length) {
            contextActions.push({
              title: lang('ChatListMarkAllAsRead'),
              icon: 'readchats',
              handler: () => handleReadAllChats(folder.id),
            });
          }
        } else {
          contextActions.push({
            title: lang('EditFolder'),
            icon: 'edit',
            handler: () => {
              openEditChatFolder({ folderId: id });
            },
          });

          if (folderUnreadChatsCountersById[id]?.length) {
            contextActions.push({
              title: lang('ChatListMarkAllAsRead'),
              icon: 'readchats',
              handler: () => handleReadAllChats(folder.id),
            });
          }

          contextActions.push({
            title: lang('FilterMenuDelete'),
            icon: 'delete',
            destructive: true,
            handler: () => {
              openDeleteChatFolderModal({ folderId: id });
            },
          });
        }

        if (!isMobile) {
          contextActions.push({
            isSeparator: true,
          });

          contextActions.push({
            title: sidebarMode ? lang('TabsPositionTop') : lang('TabsPositionLeft'),
            icon: 'forums',
            handler: () => {
              setSharedSettingOption({ foldersPosition: sidebarMode ? 'top' : 'left' });
            },
          });
        }
      }

      const folderNameOptions: FolderNameOptions = {
        text: title.text,
        entities: title.entities,
        noCustomEmojiPlayback: folder.noTitleAnimations,
      };

      let folderIcon: string | ApiMessageEntityCustomEmoji | undefined = folder.emoticon;

      if (sidebarMode) {
        folderNameOptions.emojiSize = 10;
        const currentCustomEmoji = title.entities?.find(
          (entity): entity is ApiMessageEntityCustomEmoji =>
            entity.type === ApiMessageEntityTypes.CustomEmoji && entity.offset === 0);
        if (currentCustomEmoji) {
          folderIcon = currentCustomEmoji;
          const { offset, length } = currentCustomEmoji;

          folderNameOptions.text = title.text.replace(title.text.substring(offset, offset + length), '');
          folderNameOptions.entities = title.entities?.filter((entity) => entity.offset !== offset).map((entity) => ({
            ...entity,
            offset: entity.offset - length,
          }));
        }
      }

      const folderName: TeactNode[] | string = renderTextWithEntities(folderNameOptions);

      return {
        id,
        title: folderName,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions.length ? contextActions : undefined,
        emoticon: folderIcon,
        noTitleAnimations: folder.noTitleAnimations,
      } satisfies TabWithProperties;
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites, folderUnreadChatsCountersById, isReadOnly, sidebarMode, isMobile,
  ]);

  return {
    displayedFolders,
    folderTabs,
  };
};

export default useFolderTabs;
