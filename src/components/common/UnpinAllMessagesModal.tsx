import React, { FC, memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  chatId?: number;
  pinnedMessagesCount?: number;
  onClose: () => void;
  onUnpin: () => void;
};

const UnpinAllMessagesModal: FC<OwnProps> = ({
  isOpen,
  pinnedMessagesCount = 0,
  onClose,
  onUnpin,
}) => {
  const lang = useLang();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="unpin-all"
      title={lang('Chat.PanelUnpinAllMessages')}
    >
      <p>{lang('Chat.UnpinAllMessagesConfirmation', pinnedMessagesCount, 'i')}</p>
      <Button className="confirm-dialog-button" isText onClick={onUnpin}>
        {lang('DialogUnpin')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(UnpinAllMessagesModal);
