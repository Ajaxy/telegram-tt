import { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

export type OwnProps = {
  isOpen: boolean;
  chatId?: string;
  pinnedMessagesCount?: number;
  onClose: () => void;
  onUnpin: () => void;
};

const UnpinAllMessagesModal = ({
  isOpen,
  pinnedMessagesCount = 0,
  onClose,
  onUnpin,
}: OwnProps) => {
  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="unpin-all"
      title={lang('ChatPanelUnpinAllMessages')}
    >
      <p>
        {lang('ChatUnpinAllMessagesConfirmation', {
          count: lang.number(pinnedMessagesCount),
        }, { pluralValue: pinnedMessagesCount })}
      </p>
      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" isText onClick={onUnpin}>
          {lang('DialogUnpin')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(UnpinAllMessagesModal);
