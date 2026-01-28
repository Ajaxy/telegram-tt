import { memo, useCallback, useState } from '@teact';

import useLang from '../../../../hooks/useLang';

import Button from '../../../../components/ui/Button';
import Checkbox from '../../../../components/ui/Checkbox';
import Modal from '../../../../components/ui/Modal';

type OwnProps = {
  isOpen: boolean;
  title?: string;
  onConfirm: (deleteFromProvider: boolean) => void;
  onClose: NoneToVoidFunction;
};

const RemoveEntityFromChatConfirm = ({
  isOpen,
  title,
  onConfirm,
  onClose,
}: OwnProps) => {
  const lang = useLang();
  const [deleteFromProvider, setDeleteFromProvider] = useState(false);

  const handleConfirm = useCallback(() => {
    onConfirm(deleteFromProvider);
    setDeleteFromProvider(false);
  }, [onConfirm, deleteFromProvider]);

  const handleClose = useCallback(() => {
    setDeleteFromProvider(false);
    onClose();
  }, [onClose]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteFromProvider(e.target.checked);
  }, []);

  return (
    <Modal
      title="Remove From Chat"
      isOpen={isOpen}
      onClose={handleClose}
    >
      <p>
        Are you sure you want to remove
        {' '}
        {title ? `"${title}"` : ''}
        ?
      </p>

      <Checkbox
        className="dialog-checkbox"
        checked={deleteFromProvider}
        onChange={handleCheckboxChange}
        label="Also delete from provider"
      />

      <div className="dialog-buttons mt-2">
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleConfirm}
          color="danger"
        >
          Confirm
        </Button>
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleClose}
        >
          {lang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(RemoveEntityFromChatConfirm);
