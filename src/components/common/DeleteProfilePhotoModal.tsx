import { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPhoto } from '../../api/types';

import { isUserId } from '../../util/entities/ids';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

export type OwnProps = {
  isOpen: boolean;
  photo: ApiPhoto;
  profileId: string;
  onConfirm?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const DeleteProfilePhotoModal = ({
  isOpen,
  photo,
  profileId,
  onClose,
  onConfirm,
}: OwnProps) => {
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
          {lang('PreviewDeletePhoto')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(DeleteProfilePhotoModal);
