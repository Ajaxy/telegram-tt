import React, {
  FC, memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, MessageListType } from '../../global/types';

import {
  selectCanDeleteSelectedMessages,
  selectCanDownloadSelectedMessages,
  selectCanReportSelectedMessages,
  selectCurrentMessageList,
  selectSelectedMessagesCount,
} from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import useFlag from '../../hooks/useFlag';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import buildClassName from '../../util/buildClassName';
import usePrevious from '../../hooks/usePrevious';
import useLang from '../../hooks/useLang';

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
  selectedMessageIds?: number[];
};

type DispatchProps = Pick<GlobalActions, (
  'exitMessageSelectMode' | 'openForwardMenuForSelectedMessages' | 'downloadSelectedMessages'
)>;

const MessageSelectToolbar: FC<OwnProps & StateProps & DispatchProps> = ({
  canPost,
  isActive,
  messageListType,
  isSchedule,
  selectedMessagesCount,
  canDeleteMessages,
  canReportMessages,
  canDownloadMessages,
  selectedMessageIds,
  exitMessageSelectMode,
  openForwardMenuForSelectedMessages,
  downloadSelectedMessages,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();

  useEffect(() => {
    return isActive && !isDeleteModalOpen && !isReportModalOpen
      ? captureKeyboardListeners({
        onBackspace: openDeleteModal,
        onDelete: openDeleteModal,
        onEsc: exitMessageSelectMode,
      })
      : undefined;
  }, [isActive, isDeleteModalOpen, isReportModalOpen, openDeleteModal, exitMessageSelectMode]);

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

        {!!selectedMessagesCount && (
          <div className="MessageSelectToolbar-actions">
            {messageListType !== 'scheduled' && (
              renderButton('forward', lang('Chat.ForwardActionHeader'), openForwardMenuForSelectedMessages)
            )}
            {canReportMessages && (
              renderButton('flag', lang('Conversation.ReportMessages'), openReportModal)
            )}
            {canDownloadMessages && (
              renderButton('download', lang('lng_media_download'), handleDownload)
            )}
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
    const { type: messageListType } = selectCurrentMessageList(global) || {};
    const { canDelete } = selectCanDeleteSelectedMessages(global);
    const canReport = selectCanReportSelectedMessages(global);
    const canDownload = selectCanDownloadSelectedMessages(global);
    const { messageIds: selectedMessageIds } = global.selectedMessages || {};

    return {
      isSchedule: messageListType === 'scheduled',
      selectedMessagesCount: selectSelectedMessagesCount(global),
      canDeleteMessages: canDelete,
      canReportMessages: canReport,
      canDownloadMessages: canDownload,
      selectedMessageIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'exitMessageSelectMode', 'openForwardMenuForSelectedMessages', 'downloadSelectedMessages',
  ]),
)(MessageSelectToolbar));
