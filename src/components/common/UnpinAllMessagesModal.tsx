import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { selectPinnedIds } from '../../modules/selectors';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  chatId?: number;
  onClose: () => void;
  onUnpin: () => void;
};

type StateProps = {
  pinnedMessagesCount: number;
};

const UnpinAllMessagesModal: FC<OwnProps & StateProps> = ({
  isOpen,
  pinnedMessagesCount,
  onClose,
  onUnpin,
}) => {
  const lang = useLang();

  function renderModalHeader() {
    return (
      <div className="modal-header">
        <h3 className="modal-title">{lang('UnpinAllMessages')}</h3>
      </div>
    );
  }

  function renderMessage() {
    return <p>Do you want to unpin all {pinnedMessagesCount} messages in this chat?</p>;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="unpin-all"
      header={renderModalHeader()}
    >
      {renderMessage()}
      <Button className="confirm-dialog-button" isText onClick={onUnpin}>
        {lang('DialogUnpin')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const pinnedIds = chatId ? selectPinnedIds(global, chatId) : [];

    return {
      pinnedMessagesCount: pinnedIds ? pinnedIds.length : 0,
    };
  },
)(UnpinAllMessagesModal));
