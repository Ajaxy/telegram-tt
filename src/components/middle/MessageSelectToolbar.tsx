import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { IconName } from '../../types/icons';

import {
  selectCanDeleteSelectedMessages,
  selectCanDownloadSelectedMessages,
  selectCanForwardMessages,
  selectCanReportSelectedMessages, selectCurrentChat,
  selectCurrentMessageList, selectHasProtectedMessage,
  selectSelectedMessagesCount,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useCopySelectedMessages from './hooks/useCopySelectedMessages';

import Button from '../ui/Button';
import DeleteSelectedMessageModal from './DeleteSelectedMessageModal';

import './MessageSelectToolbar.scss';

export type OwnProps = {
  isActive?: boolean;
  canPost?: boolean;
  messageListType?: MessageListType;
};

type StateProps = {
  chat?: ApiChat;
  isSchedule: boolean;
  selectedMessagesCount?: number;
  canDeleteMessages?: boolean;
  canReportMessages?: boolean;
  canDownloadMessages?: boolean;
  canForwardMessages?: boolean;
  hasProtectedMessage?: boolean;
  isAnyModalOpen?: boolean;
  selectedMessageIds?: number[];
};

const MessageSelectToolbar: FC<OwnProps & StateProps> = ({
  chat,
  canPost,
  isActive,
  messageListType,
  isSchedule,
  selectedMessagesCount,
  canDeleteMessages,
  canReportMessages,
  canDownloadMessages,
  canForwardMessages,
  hasProtectedMessage,
  isAnyModalOpen,
  selectedMessageIds,
}) => {
  const {
    exitMessageSelectMode,
    openForwardMenuForSelectedMessages,
    downloadSelectedMessages,
    copySelectedMessages,
    showNotification,
    reportMessages,
  } = getActions();
  const lang = useOldLang();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();

  useCopySelectedMessages(isActive);

  const handleExitMessageSelectMode = useLastCallback(() => {
    exitMessageSelectMode();
  });

  useEffect(() => {
    return isActive && !isDeleteModalOpen && !isAnyModalOpen
      ? captureKeyboardListeners({
        onBackspace: canDeleteMessages ? openDeleteModal : undefined,
        onDelete: canDeleteMessages ? openDeleteModal : undefined,
        onEsc: handleExitMessageSelectMode,
      })
      : undefined;
  }, [
    isActive, isDeleteModalOpen, openDeleteModal, handleExitMessageSelectMode, isAnyModalOpen,
    canDeleteMessages,
  ]);

  const handleCopy = useLastCallback(() => {
    copySelectedMessages();
    showNotification({
      message: lang('Share.Link.Copied'),
    });
    exitMessageSelectMode();
  });

  const handleDownload = useLastCallback(() => {
    downloadSelectedMessages();
    exitMessageSelectMode();
  });

  const prevSelectedMessagesCount = usePreviousDeprecated(selectedMessagesCount || undefined, true);
  const renderingSelectedMessagesCount = isActive ? selectedMessagesCount : prevSelectedMessagesCount;

  const formattedMessagesCount = lang('VoiceOver.Chat.MessagesSelected', renderingSelectedMessagesCount, 'i');

  const openMessageReport = useLastCallback(() => {
    if (!selectedMessageIds || !chat) return;
    reportMessages({
      chatId: chat.id,
      messageIds: selectedMessageIds,
    });
    exitMessageSelectMode();
  });

  const className = buildClassName(
    'MessageSelectToolbar',
    canPost && 'with-composer',
    isActive && 'shown',
  );

  const renderButton = (
    icon: IconName, label: string, onClick: AnyToVoidFunction, destructive?: boolean,
  ) => {
    return (
      <div
        role="button"
        tabIndex={0}
        className={buildClassName(
          'div-button',
          'item',
          destructive && 'destructive',
        )}
        onClick={onClick}
        title={label}
        aria-label={label}
      >
        <i className={buildClassName('icon', `icon-${icon}`)} />
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="MessageSelectToolbar-inner">
        <Button
          color="translucent"
          round
          onClick={handleExitMessageSelectMode}
          ariaLabel="Exit select mode"
        >
          <i className="icon icon-close" />
        </Button>
        <span className="MessageSelectToolbar-count" title={formattedMessagesCount}>
          {formattedMessagesCount}
        </span>

        {Boolean(selectedMessagesCount) && (
          <div className="MessageSelectToolbar-actions">
            {messageListType !== 'scheduled' && canForwardMessages && (
              renderButton(
                'forward', lang('Chat.ForwardActionHeader'), openForwardMenuForSelectedMessages,
              )
            )}
            {canReportMessages && (
              renderButton('flag', lang('Conversation.ReportMessages'), openMessageReport)
            )}
            {canDownloadMessages && !hasProtectedMessage && (
              renderButton('download', lang('lng_media_download'), handleDownload)
            )}
            {!hasProtectedMessage && (
              renderButton('copy', lang('lng_context_copy_selected_items'), handleCopy)
            )}
            {canDeleteMessages && (
              renderButton('delete', lang('EditAdminGroupDeleteMessages'), openDeleteModal, true)
            )}
          </div>
        )}
      </div>
      {canDeleteMessages && (
        <DeleteSelectedMessageModal
          isOpen={isDeleteModalOpen}
          isSchedule={isSchedule}
          onClose={closeDeleteModal}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const chat = selectCurrentChat(global);
    const { type: messageListType, chatId } = selectCurrentMessageList(global) || {};
    const isSchedule = messageListType === 'scheduled';
    const { canDelete } = selectCanDeleteSelectedMessages(global);
    const canReport = Boolean(!isSchedule && selectCanReportSelectedMessages(global));
    const canDownload = selectCanDownloadSelectedMessages(global);
    const { messageIds: selectedMessageIds } = tabState.selectedMessages || {};
    const hasProtectedMessage = chatId ? selectHasProtectedMessage(global, chatId, selectedMessageIds) : false;
    const canForward = !isSchedule && chatId ? selectCanForwardMessages(global, chatId, selectedMessageIds) : false;
    const isShareMessageModalOpen = tabState.isShareMessageModalShown;
    const isAnyModalOpen = Boolean(isShareMessageModalOpen || tabState.requestedDraft
      || tabState.requestedAttachBotInChat || tabState.requestedAttachBotInstall || tabState.reportModal);

    return {
      chat,
      isSchedule,
      selectedMessagesCount: selectSelectedMessagesCount(global),
      canDeleteMessages: canDelete,
      canReportMessages: canReport,
      canDownloadMessages: canDownload,
      canForwardMessages: canForward,
      selectedMessageIds,
      hasProtectedMessage,
      isAnyModalOpen,
    };
  },
)(MessageSelectToolbar));
