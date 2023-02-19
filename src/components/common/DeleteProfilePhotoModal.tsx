import type { FC } from '../../lib/teact/teact';
import React, { useCallback, memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPhoto } from '../../api/types';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { isUserId } from '../../global/helpers';

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
    deleteChatPhoto,
  } = getActions();

  const handleDeletePhoto = useCallback(() => {
    onConfirm?.();
    if (isUserId(profileId)) {
      deleteProfilePhoto({ photo });
    } else {
      deleteChatPhoto({
        photo,
        chatId: profileId,
      });
    }
    onClose();
  }, [onConfirm, profileId, onClose, deleteProfilePhoto, photo, deleteChatPhoto]);

  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleDeletePhoto}
      className="delete dialog-buttons-column"
      title={lang('AreYouSure')}
    >
      <div className="dialog-buttons mt-2">
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeletePhoto}>
          {lang('Preview.DeletePhoto')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(DeleteProfilePhotoModal);
