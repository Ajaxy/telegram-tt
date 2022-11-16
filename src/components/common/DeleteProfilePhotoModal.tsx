import type { FC } from '../../lib/teact/teact';
import React, { useCallback, memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPhoto } from '../../api/types';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  photo: ApiPhoto;
  profileId: string;
  onConfirm?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const DeleteProfilePhotoModal: FC<OwnProps> = ({
  isOpen,
  photo,
  profileId,
  onClose,
  onConfirm,
}) => {
  const {
    deleteProfilePhoto,
  } = getActions();

  const handleDeletePhoto = useCallback(() => {
    onConfirm?.();
    deleteProfilePhoto({ photo, profileId });
    onClose();
  }, [onConfirm, deleteProfilePhoto, photo, profileId, onClose]);

  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleDeletePhoto}
      className="delete"
      title="Are you sure?"
    >
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeletePhoto}>
        {lang('Preview.DeletePhoto')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(DeleteProfilePhotoModal);
