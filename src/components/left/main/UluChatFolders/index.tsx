import type { RefObject } from 'react';
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { FC } from '../../../../lib/teact/teact';
import { useState } from '../../../../lib/teact/teact';
import {
  getActions, getGlobal, withGlobal,
} from '../../../../global';

import type { ApiChat, ApiChatFolder, ApiChatlistExportedInvite } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TreeItemFolder } from './types';

import { ALL_FOLDER_ID } from '../../../../config';
import { selectCanShareFolder } from '../../../../global/selectors';
import { selectCurrentLimit } from '../../../../global/selectors/limits';

import { useFolderManagerForUnreadCounters } from '../../../../hooks/useFolderManager';
import useLang from '../../../../hooks/useLang';

import ChatFoldersTree from './ChatFoldersTree';

import 'react-complex-tree/lib/style-modern.css';

const uluChatFoldersRootId = 'chat-folders-root';

const uluChatFoldersElement = document.getElementById(uluChatFoldersRootId);
const uluChatFoldersRoot = createRoot(uluChatFoldersElement!);

// TODO clean-up

type OwnProps = {
  portalRef: RefObject<HTMLDivElement>;
};

type StateProps = {
  orderedFolderIds?: number[];
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  chatFoldersById: Record<number, ApiChatFolder>;
  chatsById: Record<number, ApiChat>;
  maxFolderInvites: number;
  maxChatLists: number;
  maxFolders: number;
};

const UluChatFolders: FC<OwnProps & StateProps> = ({
  chatsById,
  chatFoldersById,
  folderInvitesById,
  orderedFolderIds,
  maxChatLists,
  maxFolders,
  maxFolderInvites,
  portalRef,
}) => {
  const lang = useLang();

  const folderCountersById = useFolderManagerForUnreadCounters();

  const {
    // loadChatFolders,
    // setActiveChatFolder,
    // openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  const displayedFolders = (() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  })();

  const folderTabs = (() => {
    if (!displayedFolders || !displayedFolders.length) {
      return [];
    }

    return displayedFolders.map((folder, i) => {
      const { id, title, includedChatIds = [] } = folder;
      const isBlocked = i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('ChatList.ContextMenuShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
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

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDeleteItem'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
        chatIds: includedChatIds,
        chats: Object.values(chatsById)
          .filter((chat) => includedChatIds.includes(chat.id))
          .reduce((p, c) => {
            p[c.id] = c;
            return p;
          }, {} as Record<string, ApiChat>),
      } satisfies TreeItemFolder;
    }).filter((folder) => typeof folder.id === 'number');
  })();

  const [hookedToPortalRefState, setHookedToPortalRefState] = useState(false);
  const hookToPortalRefInterval = setInterval(() => {
    if (portalRef.current) {
      setHookedToPortalRefState(true);
      clearInterval(hookToPortalRefInterval);
    }
  }, 0);

  if (hookedToPortalRefState) {
    uluChatFoldersRoot.render(
      createPortal(<ChatFoldersTree folders={folderTabs} />, portalRef.current!),
    );
  }

  return undefined;
};

export default withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      chats: {
        byId: chatsById,
      },
      // activeSessions: {
      //   byHash: sessions,
      // },
      // currentUserId,
      // archiveSettings,
    } = global;
    // const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      chatsById,
      folderInvitesById,
      orderedFolderIds,
      // activeChatFolder,
      // currentUserId,
      // shouldSkipHistoryAnimations,
      // hasArchivedChats: Boolean(archived?.length),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      // archiveSettings,
      // sessions,
    };
  },
)(UluChatFolders);
