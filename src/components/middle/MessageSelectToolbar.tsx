import type { FC } from '../../lib/teact/teact';
import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { MessageListType } from '../../types';
import type { IconName } from '../../types/icons';

import {
  selectCanDeleteSelectedMessages,
  selectCanDownloadSelectedMessages,
  selectCanForwardMessages,
  selectCanReportSelectedMessages, selectCurrentChat,
  selectCurrentMessageList, selectHasIpRevealingMedia,
  selectHasProtectedMessage,
  selectSelectedMessagesCount,
  selectTabState,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useCopySelectedMessages from './hooks/useCopySelectedMessages';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';

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
  shouldWarnAboutFiles?: boolean;
  hasIpRevealingMedia?: boolean;
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
  shouldWarnAboutFiles,
  hasIpRevealingMedia,
}) => {
  const {
    exitMessageSelectMode,
    openForwardMenuForSelectedMessages,
    downloadSelectedMessages,
    copySelectedMessages,
    showNotification,
    reportMessages,
    openDeleteMessageModal,
    setSharedSettingOption,
  } = getActions();
  const lang = useOldLang();

  useCopySelectedMessages(isActive);

  const [isFileIpDialogOpen, openFileIpDialog, closeFileIpDialog] = useFlag();
  const [shouldNotWarnAboutFiles, setShouldNotWarnAboutFiles] = useState(false);

  const handleExitMessageSelectMode = useLastCallback(() => {
    exitMessageSelectMode();
  });

  const handleDelete = useLastCallback(() => {
    if (!selectedMessageIds || !chat) return;
    openDeleteMessageModal({
      chatId: chat.id,
      messageIds: selectedMessageIds,
      isSchedule,
    });
  });

  useEffect(() => {
    return isActive && !isAnyModalOpen
      ? captureKeyboardListeners({
        onBackspace: canDeleteMessages ? handleDelete : undefined,
        onDelete: canDeleteMessages ? handleDelete : undefined,
        onEsc: handleExitMessageSelectMode,
      })
      : undefined;
  }, [
    isActive, handleDelete, handleExitMessageSelectMode, isAnyModalOpen,
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

  const handleMessageDownload = useLastCallback(() => {
    if (shouldWarnAboutFiles && hasIpRevealingMedia) {
      openFileIpDialog();
      return;
    }

    handleDownload();
  });

  const handleFileIpConfirm = useLastCallback(() => {
    setSharedSettingOption({ shouldWarnAboutFiles: !shouldNotWarnAboutFiles });
    closeFileIpDialog();
    handleDownload();
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
        <Icon name={icon} />
      </div>
    );
  };

  return (
    <>
      <div className={className}>
        <div className="MessageSelectToolbar-inner">
          <Button
            color="translucent"
            round
            onClick={handleExitMessageSelectMode}
            ariaLabel="Exit select mode"
            iconName="close"
          />
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
                renderButton('download', lang('lng_media_download'), handleMessageDownload)
              )}
              {!hasProtectedMessage && (
                renderButton('copy', lang('lng_context_copy_selected_items'), handleCopy)
              )}
              {canDeleteMessages && (
                renderButton('delete', lang('EditAdminGroupDeleteMessages'), handleDelete, true)
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={isFileIpDialogOpen}
        onClose={closeFileIpDialog}
        confirmHandler={handleFileIpConfirm}
      >
        {lang('lng_launch_svg_warning')}
        <Checkbox
          className="dialog-checkbox"
          checked={shouldNotWarnAboutFiles}
          label={lang('lng_launch_exe_dont_ask')}
          onCheck={setShouldNotWarnAboutFiles}
        />
      </ConfirmDialog>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const { shouldWarnAboutFiles } = selectSharedSettings(global);
    const chat = selectCurrentChat(global);

    const { type: messageListType, chatId } = selectCurrentMessageList(global) || {};
    const isSchedule = messageListType === 'scheduled';
    const { canDelete } = selectCanDeleteSelectedMessages(global);
    const canReport = Boolean(!isSchedule && selectCanReportSelectedMessages(global));
    const canDownload = selectCanDownloadSelectedMessages(global);
    const { messageIds: selectedMessageIds } = tabState.selectedMessages || {};
    const hasProtectedMessage = chatId ? selectHasProtectedMessage(global, chatId, selectedMessageIds) : false;
    const canForward = !isSchedule && chatId ? selectCanForwardMessages(global, chatId, selectedMessageIds) : false;
    const hasIpRevealingMedia = selectedMessageIds && chatId
      ? selectHasIpRevealingMedia(global, chatId, selectedMessageIds) : false;
    const isShareMessageModalOpen = tabState.isShareMessageModalShown;
    const isAnyModalOpen = Boolean(isShareMessageModalOpen || tabState.requestedDraft
      || tabState.requestedAttachBotInChat || tabState.requestedAttachBotInstall || tabState.reportModal
      || tabState.deleteMessageModal);

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
      shouldWarnAboutFiles,
      hasIpRevealingMedia,
    };
  },
)(MessageSelectToolbar));
