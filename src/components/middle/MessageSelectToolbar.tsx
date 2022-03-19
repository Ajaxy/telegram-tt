import React, {
  FC, memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { MessageListType } from '../../global/types';

import {
  selectCanDeleteSelectedMessages,
  selectCanDownloadSelectedMessages,
  selectCanReportSelectedMessages,
  selectCurrentMessageList,
  selectHasProtectedMessage,
  selectSelectedMessagesCount,
} from '../../global/selectors';
import useFlag from '../../hooks/useFlag';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import buildClassName from '../../util/buildClassName';
import usePrevious from '../../hooks/usePrevious';
import useLang from '../../hooks/useLang';
import useCopySelectedMessages from './hooks/useCopySelectedMessages';

import Button from '../ui/Button';

import DeleteSelectedMessageModal from './DeleteSelectedMessageModal';
import ReportMessageModal from '../common/ReportMessageModal';

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
  hasProtectedMessage?: boolean;
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
  hasProtectedMessage,
  selectedMessageIds,
}) => {
  const {
    exitMessageSelectMode,
    openForwardMenuForSelectedMessages,
    downloadSelectedMessages,
    copySelectedMessages,
  } = getActions();

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();

  useCopySelectedMessages(Boolean(isActive), copySelectedMessages);
  useEffect(() => {
    return isActive && !isDeleteModalOpen && !isReportModalOpen
      ? captureKeyboardListeners({
        onBackspace: openDeleteModal,
        onDelete: openDeleteModal,
        onEsc: exitMessageSelectMode,
      })
      : undefined;
  }, [isActive, isDeleteModalOpen, isReportModalOpen, openDeleteModal, exitMessageSelectMode]);

  const handleCopy = useCallback(() => {
    copySelectedMessages();
    exitMessageSelectMode();
  }, [copySelectedMessages, exitMessageSelectMode]);

  const handleDownload = useCallback(() => {
    downloadSelectedMessages();
    exitMessageSelectMode();
  }, [downloadSelectedMessages, exitMessageSelectMode]);

  const prevSelectedMessagesCount = usePrevious(selectedMessagesCount || undefined, true);
  const renderingSelectedMessagesCount = isActive ? selectedMessagesCount : prevSelectedMessagesCount;

  const lang = useLang();

  const formattedMessagesCount = lang('VoiceOver.Chat.MessagesSelected', renderingSelectedMessagesCount, 'i');

  const className = buildClassName(
    'MessageSelectToolbar',
    canPost && 'with-composer',
    isActive && 'shown',
  );

  const renderButton = (
    icon: string, label: string, onClick: AnyToVoidFunction, disabled?: boolean, destructive?: boolean,
  ) => {
    return (
      <div
        role="button"
        tabIndex={0}
        className={buildClassName(
          'item',
          disabled && 'disabled',
          destructive && 'destructive',
        )}
        onClick={!disabled ? onClick : undefined}
        title={label}
      >
        <i className={`icon-${icon}`} />
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="MessageSelectToolbar-inner">
        <Button
          color="translucent"
          round
          onClick={exitMessageSelectMode}
          ariaLabel="Exit select mode"
        >
          <i className="icon-close" />
        </Button>
        <span className="MessageSelectToolbar-count" title={formattedMessagesCount}>
          {formattedMessagesCount}
        </span>

        {Boolean(selectedMessagesCount) && (
          <div className="MessageSelectToolbar-actions">
            {messageListType !== 'scheduled' && (
              renderButton(
                'forward', lang('Chat.ForwardActionHeader'), openForwardMenuForSelectedMessages, hasProtectedMessage,
              )
            )}
            {canReportMessages && (
              renderButton('flag', lang('Conversation.ReportMessages'), openReportModal)
            )}
            {canDownloadMessages && (
              renderButton('download', lang('lng_media_download'), handleDownload, hasProtectedMessage)
            )}
            {renderButton('copy', lang('lng_context_copy_selected_items'), handleCopy, hasProtectedMessage)}
            {renderButton('delete', lang('EditAdminGroupDeleteMessages'), openDeleteModal, !canDeleteMessages, true)}
          </div>
        )}
      </div>
      <DeleteSelectedMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={isSchedule}
        onClose={closeDeleteModal}
      />
      <ReportMessageModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        messageIds={selectedMessageIds}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { type: messageListType, chatId } = selectCurrentMessageList(global) || {};
    const { canDelete } = selectCanDeleteSelectedMessages(global);
    const canReport = selectCanReportSelectedMessages(global);
    const canDownload = selectCanDownloadSelectedMessages(global);
    const { messageIds: selectedMessageIds } = global.selectedMessages || {};
    const hasProtectedMessage = chatId ? selectHasProtectedMessage(global, chatId, selectedMessageIds) : false;

    return {
      isSchedule: messageListType === 'scheduled',
      selectedMessagesCount: selectSelectedMessagesCount(global),
      canDeleteMessages: canDelete,
      canReportMessages: canReport,
      canDownloadMessages: canDownload,
      selectedMessageIds,
      hasProtectedMessage,
    };
  },
)(MessageSelectToolbar));
