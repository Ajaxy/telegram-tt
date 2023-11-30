import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType } from '../../global/types';
import type { IconName } from '../../types/icons';

import {
  selectCanDeleteSelectedMessages,
  selectCanDownloadSelectedMessages,
  selectCanForwardMessages,
  selectCanReportSelectedMessages,
  selectCurrentMessageList, selectHasProtectedMessage,
  selectSelectedMessagesCount,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useCopySelectedMessages from './hooks/useCopySelectedMessages';

import ReportModal from '../common/ReportModal';
import Button from '../ui/Button';
import DeleteSelectedMessageModal from './DeleteSelectedMessageModal';

import './MessageSelectToolbar.scss';

export type OwnProps = {
  isActive?: boolean;
  canPost?: boolean;
  messageListType?: MessageListType;
};

type StateProps = {
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
  } = getActions();
  const lang = useLang();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();

  useCopySelectedMessages(isActive);

  const handleExitMessageSelectMode = useLastCallback(() => {
    exitMessageSelectMode();
  });

  useEffect(() => {
    return isActive && !isDeleteModalOpen && !isReportModalOpen && !isAnyModalOpen
      ? captureKeyboardListeners({
        onBackspace: canDeleteMessages ? openDeleteModal : undefined,
        onDelete: canDeleteMessages ? openDeleteModal : undefined,
        onEsc: handleExitMessageSelectMode,
      })
      : undefined;
  }, [
    isActive, isDeleteModalOpen, isReportModalOpen, openDeleteModal, handleExitMessageSelectMode, isAnyModalOpen,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive || isDeleteModalOpen || isReportModalOpen || isAnyModalOpen) {
        return;
      }

      switch (e.code) {
        case 'KeyF':
          if (canForwardMessages) {
            openForwardMenuForSelectedMessages();
          }
          break;
        case 'KeyR':
          if (canReportMessages) {
            openReportModal();
          }
          break;
        case 'KeyD':
          if (canDownloadMessages && !hasProtectedMessage) {
            handleDownload();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isActive, isDeleteModalOpen, isReportModalOpen, isAnyModalOpen,
    canForwardMessages, openForwardMenuForSelectedMessages,
    canReportMessages, openReportModal,
    canDownloadMessages, hasProtectedMessage, handleDownload,
    handleCopy,
  ]);

  const prevSelectedMessagesCount = usePrevious(selectedMessagesCount || undefined, true);
  const renderingSelectedMessagesCount = isActive ? selectedMessagesCount : prevSelectedMessagesCount;

  const formattedMessagesCount = lang('VoiceOver.Chat.MessagesSelected', renderingSelectedMessagesCount, 'i');

  const className = buildClassName(
    'MessageSelectToolbar',
    canPost && 'with-composer',
    isActive && 'shown',
  );

  const renderButton = (
    icon: IconName, label: string, onClick: AnyToVoidFunction, hotkey?: string, destructive?: boolean,
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
      >
        <i className={buildClassName('icon', `icon-${icon}`)} />
        {hotkey && (
          <div className="hotkey-frame">
            <div className="hotkey-text">{hotkey}</div>
          </div>
        )}
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
          <div className="hotkey-frame">
            <div className="hotkey-text">Esc</div>
          </div>
        </Button>
        <span className="MessageSelectToolbar-count" title={formattedMessagesCount}>
          {formattedMessagesCount}
        </span>

        {Boolean(selectedMessagesCount) && (
          <div className="MessageSelectToolbar-actions">
            {messageListType !== 'scheduled' && canForwardMessages && (
              renderButton(
                'forward', lang('Chat.ForwardActionHeader'), openForwardMenuForSelectedMessages, 'F',
              )
            )}
            {canReportMessages && (
              renderButton('flag', lang('Conversation.ReportMessages'), openReportModal, 'R')
            )}
            {canDownloadMessages && !hasProtectedMessage && (
              renderButton('download', lang('lng_media_download'), handleDownload, 'D')
            )}
            {!hasProtectedMessage && (
              renderButton('copy', lang('lng_context_copy_selected_items'), handleCopy)
            )}
            {canDeleteMessages && (
              renderButton('delete', lang('EditAdminGroupDeleteMessages'), openDeleteModal, '⌫', true)
            )}
          </div>
        )}
      </div>
      <DeleteSelectedMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={isSchedule}
        onClose={closeDeleteModal}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        messageIds={selectedMessageIds}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const { type: messageListType, chatId } = selectCurrentMessageList(global) || {};
    const isSchedule = messageListType === 'scheduled';
    const { canDelete } = selectCanDeleteSelectedMessages(global);
    const canReport = Boolean(!isSchedule && selectCanReportSelectedMessages(global));
    const canDownload = selectCanDownloadSelectedMessages(global);
    const { messageIds: selectedMessageIds } = tabState.selectedMessages || {};
    const hasProtectedMessage = chatId ? selectHasProtectedMessage(global, chatId, selectedMessageIds) : false;
    const canForward = !isSchedule && chatId ? selectCanForwardMessages(global, chatId, selectedMessageIds) : false;
    const isForwardModalOpen = tabState.forwardMessages.isModalShown;
    const isSnoozeCalendarShown = tabState.forwardMessages.isSnoozeCalendarShown;
    const isAnyModalOpen = Boolean(isForwardModalOpen || isSnoozeCalendarShown || tabState.requestedDraft
      || tabState.requestedAttachBotInChat || tabState.requestedAttachBotInstall);

    return {
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
