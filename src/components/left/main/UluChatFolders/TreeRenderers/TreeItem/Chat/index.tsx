/* eslint-disable react/jsx-props-no-spreading */
import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import type { TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../../lib/teact/teact';
import { getActions } from '../../../../../../../global';

import type { TreeItemChat } from '../../../types';

import { ULU_APP } from '../../../../../../../config';
import buildClassName from '../../../../../../../util/buildClassName';
import { MouseButton } from '../../../../../../../util/windowEnvironment';
import renderText from '../../../../../../common/helpers/renderText.react';

import useChatContextActions from '../../../../../../../hooks/useChatContextActions.react';
// import useAppLayout from '../../../../../../../hooks/useAppLayout.react';
import useContextMenuHandlers from '../../../../../../../hooks/useContextMenuHandlers.react';
import { useFastClick } from '../../../../../../../hooks/useFastClick.react';
import useFlag from '../../../../../../../hooks/useFlag.react';
import useLastCallback from '../../../../../../../hooks/useLastCallback.react';
import useMenuPosition from '../../../../../../../hooks/useMenuPosition.react';

import DeleteChatModal from '../../../../../../common/DeleteChatModal.react';
import ReportModal from '../../../../../../common/ReportModal.react';
import Menu from '../../../../../../ui/Menu.react';
import MenuItem from '../../../../../../ui/MenuItem.react';
import MenuSeparator from '../../../../../../ui/MenuSeparator.react';
import ChatFolderModal from '../../../../../ChatFolderModal.react';
import MuteChatModal from '../../../../../MuteChatModal.react';
import ChatAvatar from './ChatAvatar';
import SvgPin from './SvgPin';

import stylesUluChatFolder from '../../../../UluChatFolder/UluChatFolder.module.scss';
import stylesTreeFolder from '../ChatFolder.module.scss';
import styles from './Chat.module.scss';

const Chat: FC<{
  children: ReactNode;
  item: TreeItemChat<any>;
  context: TreeItemRenderContext<never>;
  title: string | ReactNode;
  active: boolean | undefined;
  expanded?: boolean;
  isPinned?: boolean;
  folderId?: number;
  shouldStressUnreadMessages: boolean;
  contextRootElementSelector?: string;
}> = ({
  children, active, title, shouldStressUnreadMessages, item, context, isPinned, folderId,
}) => {
  const {
    unreadCount: messagesUnreadCount, ref,
  } = item;

  const classNameWrapper = buildClassName(
    stylesUluChatFolder.wrapper,
    active && stylesUluChatFolder.active,
    !!messagesUnreadCount && shouldStressUnreadMessages && stylesUluChatFolder['has-unread-messages'],
  );

  // const { isMobile } = useAppLayout(); TODO use this
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();
  const [shouldRenderReportModal, markRenderReportModal, unmarkRenderReportModal] = useFlag();

  const handleDelete = useLastCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  });

  const handleMute = useLastCallback(() => {
    markRenderMuteModal();
    openMuteModal();
  });

  const handleChatFolderChange = useLastCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  });

  const handleReport = useLastCallback(() => {
    markRenderReportModal();
    openReportModal();
  });

  const contextActions = useChatContextActions({
    chat: item.chat,
    user: item.user, // TODO
    handleDelete,
    handleMute,
    handleChatFolderChange,
    handleReport,
    folderId,
    isPinned,
    isMuted: item.chat?.isMuted,
    canChangeFolder: item.canChangeFolder, // TODO
  });

  const {
    handleContextMenu, handleBeforeContextMenu,
    contextMenuPosition, handleContextMenuClose, handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(ref!, !contextActions);

  const {
    closeForumPanel, openForumPanel, openChat, focusLastMessage,
  } = getActions();

  // TODO
  const isForumPanelOpen = false;
  const isSelected = true;
  const canScrollDown = true;

  const handleClickChat = useCallback(() => {
    const chatId = item.id as string;
    if (item.isFolder) {
      if (isForumPanelOpen) {
        closeForumPanel(undefined, { forceOnHeavyAnimation: true });
      } else {
        openForumPanel({ chatId }, { forceOnHeavyAnimation: true });
      }

      return;
    }

    openChat({ id: chatId, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  }, [canScrollDown, isForumPanelOpen, isSelected, item.id, item.isFolder]);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    handleClickChat();
  });

  const getTriggerElement = useLastCallback(() => ref!.current);
  const getRootElement = useLastCallback(() => ref!.current!.closest('.custom-scroll'));
  const getMenuElement = useLastCallback(() => {
    return (document.querySelector('#chat-folders-tree-context-menu-root'))!
      .querySelector('.ListItem-context-menu .bubble');
  });
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const shouldRenderPin = isPinned;
  const shouldRenderControl = shouldRenderPin;

  // TODO use <ListItem/> with <Ripple/>
  return (
    <>
      <div
        className={classNameWrapper}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        {...context.itemContainerWithChildrenProps}
        {...context.interactiveElementProps}
        // @ts-ignore
        style={{ maxHeight: `${ULU_APP.SIDEBAR_CHAT_FOLDERS_TREE_ITEM_HEIGHT_REM}rem` }}
      >
        <div className={buildClassName(stylesUluChatFolder.info, stylesTreeFolder.info)}>
          <div className={stylesUluChatFolder.iconWrapper}>
            <ChatAvatar chat={item.chat!} />
          </div>
          <div className={buildClassName(stylesTreeFolder.title, stylesTreeFolder.dots)}>
            {title}
          </div>
          { shouldRenderControl && (
            <div className={styles.control}>
              { shouldRenderPin && (
                <SvgPin className={styles.pin} width={13} height={13} fill="var(--color-text-secondary)" />
              ) }
            </div>
          ) }
        </div>
        { !!messagesUnreadCount && (<div className={stylesUluChatFolder.unread}>{ messagesUnreadCount }</div>) }
        {contextActions && contextMenuPosition !== undefined && (
          <Menu
            isOpen={isContextMenuOpen}
            transformOriginX={transformOriginX}
            transformOriginY={transformOriginY}
            positionX={positionX}
            positionY={positionY}
            style={menuStyle}
            className="ListItem-context-menu with-menu-transitions"
            autoClose
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
            withPortal
            // bubbleClassName={menuBubbleClassName}
          >
            {contextActions.map((action) => (
              ('isSeparator' in action) ? (
                <MenuSeparator key={action.key || 'separator'} />
              ) : (
                <MenuItem
                  key={action.title}
                  icon={action.icon}
                  destructive={action.destructive}
                  disabled={!action.handler}
                  onClick={action.handler}
                >
                  <span className="list-item-ellipsis">
                    {renderText(action.title)}
                  </span>
                </MenuItem>
              )
            ))}
          </Menu>
        )}
        {shouldRenderDeleteModal && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            onCloseAnimationEnd={unmarkRenderDeleteModal}
            chat={item.chat!}
          />
        )}
        {shouldRenderMuteModal && (
          <MuteChatModal
            isOpen={isMuteModalOpen}
            onClose={closeMuteModal}
            onCloseAnimationEnd={unmarkRenderMuteModal}
            chatId={item.chat!.id}
          />
        )}
        {shouldRenderChatFolderModal && (
          <ChatFolderModal
            isOpen={isChatFolderModalOpen}
            onClose={closeChatFolderModal}
            onCloseAnimationEnd={unmarkRenderChatFolderModal}
            chatId={item.chat!.id}
          />
        )}
        {shouldRenderReportModal && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={closeReportModal}
            onCloseAnimationEnd={unmarkRenderReportModal}
            peerId={item.chat!.id}
            subject="peer"
          />
        )}
      </div>
      {children}
    </>
  );
};

export default Chat;
