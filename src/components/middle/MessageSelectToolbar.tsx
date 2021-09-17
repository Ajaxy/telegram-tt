import React, { FC, memo, useEffect } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, MessageListType } from '../../global/types';

import {
  selectCanDeleteSelectedMessages,
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
import MenuItem from '../ui/MenuItem';

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
  selectedMessageIds?: number[];
};

type DispatchProps = Pick<GlobalActions, 'exitMessageSelectMode' | 'openForwardMenuForSelectedMessages'>;

const MessageSelectToolbar: FC<OwnProps & StateProps & DispatchProps> = ({
  canPost,
  isActive,
  messageListType,
  isSchedule,
  selectedMessagesCount,
  canDeleteMessages,
  canReportMessages,
  selectedMessageIds,
  exitMessageSelectMode,
  openForwardMenuForSelectedMessages,
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

  const prevSelectedMessagesCount = usePrevious(selectedMessagesCount || undefined, true);
  const renderingSelectedMessagesCount = isActive ? selectedMessagesCount : prevSelectedMessagesCount;

  const lang = useLang();

  const formattedMessagesCount = lang('VoiceOver.Chat.MessagesSelected', renderingSelectedMessagesCount, 'i');

  const className = buildClassName(
    'MessageSelectToolbar',
    canPost && 'with-composer',
    isActive && 'shown',
  );

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
              <MenuItem
                icon="forward"
                ariaLabel="Forward Messages"
                onClick={openForwardMenuForSelectedMessages}
              >
                <span className="item-text">
                  {lang('Forward')}
                </span>
              </MenuItem>
            )}
            {canReportMessages && (
              <MenuItem
                icon="flag"
                onClick={openReportModal}
                disabled={!canReportMessages}
                ariaLabel={lang('Conversation.ReportMessages')}
              >
                <span className="item-text">
                  {lang('Report')}
                </span>
              </MenuItem>
            )}
            <MenuItem
              destructive
              icon="delete"
              onClick={openDeleteModal}
              disabled={!canDeleteMessages}
              ariaLabel={lang('EditAdminGroupDeleteMessages')}
            >
              <span className="item-text">
                {lang('Delete')}
              </span>
            </MenuItem>
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
    const { messageIds: selectedMessageIds } = global.selectedMessages || {};

    return {
      isSchedule: messageListType === 'scheduled',
      selectedMessagesCount: selectSelectedMessagesCount(global),
      canDeleteMessages: canDelete,
      canReportMessages: canReport,
      selectedMessageIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['exitMessageSelectMode', 'openForwardMenuForSelectedMessages']),
)(MessageSelectToolbar));
