import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import {
  getPrivateChatUserId,
  getUserFirstOrLastName,
  isChatBasicGroup,
  isChatSuperGroup,
  isUserId,
} from '../../global/helpers';
import {
  selectCanDeleteSelectedMessages, selectCurrentChat, selectTabState, selectUser,
} from '../../global/selectors';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

export type OwnProps = {
  isOpen: boolean;
  isSchedule: boolean;
  onClose: () => void;
};

type StateProps = {
  selectedMessageIds?: number[];
  canDeleteForAll?: boolean;
  contactName?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
};

const DeleteSelectedMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  isSchedule,
  selectedMessageIds,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onClose,
}) => {
  const {
    deleteMessages,
    deleteScheduledMessages,
    exitMessageSelectMode,
  } = getActions();

  const prevIsOpen = usePrevious(isOpen);

  const handleDeleteMessageForAll = useLastCallback(() => {
    onClose();
    deleteMessages({ messageIds: selectedMessageIds!, shouldDeleteForAll: true });
  });

  const handleDeleteMessageForSelf = useLastCallback(() => {
    if (isSchedule) {
      deleteScheduledMessages({ messageIds: selectedMessageIds! });
    } else {
      deleteMessages({ messageIds: selectedMessageIds!, shouldDeleteForAll: false });
    }

    onClose();
  });

  const lang = useLang();

  // Returning `undefined` from FC instead of `<Modal>` doesn't trigger useHistoryBack
  useEffect(() => {
    if (!isOpen && prevIsOpen) {
      exitMessageSelectMode();
    }
  }, [exitMessageSelectMode, isOpen, prevIsOpen]);

  if (!selectedMessageIds) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={canDeleteForAll ? undefined : handleDeleteMessageForSelf}
      className="delete"
      title={lang('Conversation.DeleteManyMessages')}
    >
      <p>{lang('AreYouSureDeleteFewMessages')}</p>
      {willDeleteForCurrentUserOnly && (
        <p>This will delete them just for you, not for other participants in the chat.</p>
      )}
      {willDeleteForAll && (
        <p>This will delete them for everyone in this chat.</p>
      )}
      <div className={canDeleteForAll ? 'dialog-buttons-column' : 'dialog-buttons'}>
        {canDeleteForAll && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
            {contactName
              ? renderText(lang('ChatList.DeleteForEveryone', contactName))
              : lang('Conversation.DeleteMessagesForEveryone')}
          </Button>
        )}
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForSelf}>
          {lang(canDeleteForAll ? 'ChatList.DeleteForCurrentUser' : 'Delete')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isSchedule }): StateProps => {
    const { messageIds: selectedMessageIds } = selectTabState(global).selectedMessages || {};
    const { canDeleteForAll } = selectCanDeleteSelectedMessages(global);
    const chat = selectCurrentChat(global);
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    const willDeleteForCurrentUserOnly = chat && isChatBasicGroup(chat) && !canDeleteForAll;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      selectedMessageIds,
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
    };
  },
)(DeleteSelectedMessageModal));
