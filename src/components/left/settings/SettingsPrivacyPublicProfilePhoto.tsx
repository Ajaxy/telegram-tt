import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiUser } from '../../../api/types';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';
import Avatar from '../../common/Avatar';
import ConfirmDialog from '../../ui/ConfirmDialog';

import styles from './SettingsPrivacyPublicPhoto.module.scss';

type OwnProps = {
  currentUser: ApiUser;
};

const SettingsPrivacyPublicProfilePhoto: FC<OwnProps> = ({
  currentUser,
}) => {
  const {
    loadFullUser, uploadProfilePhoto, deleteProfilePhoto, showNotification,
  } = getActions();

  const lang = useLang();

  const fallbackPhoto = currentUser.fullInfo?.fallbackPhoto;
  const [isDeleteFallbackPhotoModalOpen, openDeleteFallbackPhotoModal, closeDeleteFallbackPhotoModal] = useFlag(false);

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser.fullInfo) {
      loadFullUser({ userId: currentUser.id });
    }
  }, [currentUser.fullInfo, currentUser.id, loadFullUser]);

  const handleSelectFile = useCallback((file: File) => {
    uploadProfilePhoto({
      file,
      isFallback: true,
    });
    showNotification({
      message: lang('Privacy.ProfilePhoto.PublicPhotoSuccess'),
    });
  }, [lang, showNotification, uploadProfilePhoto]);

  const handleConfirmDelete = useCallback(() => {
    closeDeleteFallbackPhotoModal();
    deleteProfilePhoto({ photo: fallbackPhoto! });
  }, [closeDeleteFallbackPhotoModal, deleteProfilePhoto, fallbackPhoto]);

  const handleOpenFileSelector = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="settings-item">
      <ListItem
        icon="camera-add"
        onClick={handleOpenFileSelector}
      >
        <SelectAvatar
          onChange={handleSelectFile}
          inputRef={inputRef}
        />
        {lang(fallbackPhoto ? 'Privacy.ProfilePhoto.UpdatePublicPhoto' : 'Privacy.ProfilePhoto.SetPublicPhoto')}
      </ListItem>
      {fallbackPhoto && (
        <ListItem
          leftElement={<Avatar photo={fallbackPhoto} size="mini" className={styles.fallbackPhoto} />}
          onClick={openDeleteFallbackPhotoModal}
          destructive
        >
          {lang(fallbackPhoto.isVideo
            ? 'Privacy.ProfilePhoto.RemovePublicVideo'
            : 'Privacy.ProfilePhoto.RemovePublicPhoto')}
          <ConfirmDialog
            isOpen={isDeleteFallbackPhotoModalOpen}
            onClose={closeDeleteFallbackPhotoModal}
            text={lang('Privacy.ResetPhoto.Confirm')}
            confirmLabel={lang('Delete')}
            confirmHandler={handleConfirmDelete}
            confirmIsDestructive
          />
        </ListItem>
      )}
      <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('Privacy.ProfilePhoto.PublicPhotoInfo')}
      </p>
    </div>
  );
};

export default memo(SettingsPrivacyPublicProfilePhoto);
