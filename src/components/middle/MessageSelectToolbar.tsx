import React, { FC, memo, useEffect } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, MessageListType } from '../../global/types';

import {
  selectCanDeleteSelectedMessages,
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

import DeleteSelectedMessagesModal from './DeleteSelectedMessagesModal';

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
};

type DispatchProps = Pick<GlobalActions, 'exitMessageSelectMode' | 'openForwardMenuForSelectedMessages'>;

const MessageSelectToolbar: FC<OwnProps & StateProps & DispatchProps> = ({
  canPost,
  isActive,
  messageListType,
  isSchedule,
  selectedMessagesCount,
  canDeleteMessages,
  exitMessageSelectMode,
  openForwardMenuForSelectedMessages,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();

  useEffect(() => {
    return isActive && !isDeleteModalOpen
      ? captureKeyboardListeners({
        onBackspace: openDeleteModal,
        onDelete: openDeleteModal,
        onEsc: exitMessageSelectMode,
      })
      : undefined;
  }, [isActive, isDeleteModalOpen, openDeleteModal, exitMessageSelectMode]);

  const prevSelectedMessagesCount = usePrevious(selectedMessagesCount || undefined, true);
  const renderingSelectedMessagesCount = isActive ? selectedMessagesCount : prevSelectedMessagesCount;

  const lang = useLang();

  const formattedMessagesCount = lang('VoiceOver.Chat.MessagesSelected', renderingSelectedMessagesCount);

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
      <DeleteSelectedMessagesModal
        isOpen={isDeleteModalOpen}
        isSchedule={isSchedule}
        onClose={closeDeleteModal}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { type: messageListType } = selectCurrentMessageList(global) || {};
    const { canDelete } = selectCanDeleteSelectedMessages(global);

    return {
      isSchedule: messageListType === 'scheduled',
      selectedMessagesCount: selectSelectedMessagesCount(global),
      canDeleteMessages: canDelete,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['exitMessageSelectMode', 'openForwardMenuForSelectedMessages']),
)(MessageSelectToolbar));
