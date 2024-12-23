import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPhoto } from '../../../api/types';

import useFlag from '../../../hooks/useFlag';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';

import styles from './SettingsPrivacyPublicPhoto.module.scss';

type OwnProps = {
  currentUserId: string;
  hasCurrentUserFullInfo?: boolean;
  currentUserFallbackPhoto?: ApiPhoto;
};

const SettingsPrivacyPublicProfilePhoto: FC<OwnProps> = ({
  currentUserId,
  hasCurrentUserFullInfo,
  currentUserFallbackPhoto,
}) => {
  const {
    loadFullUser, uploadProfilePhoto, deleteProfilePhoto, showNotification,
  } = getActions();

  const lang = useOldLang();

  const [isDeleteFallbackPhotoModalOpen, openDeleteFallbackPhotoModal, closeDeleteFallbackPhotoModal] = useFlag(false);

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasCurrentUserFullInfo) {
      loadFullUser({ userId: currentUserId });
    }
  }, [hasCurrentUserFullInfo, currentUserId, loadFullUser]);

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
    deleteProfilePhoto({ photo: currentUserFallbackPhoto! });
  }, [closeDeleteFallbackPhotoModal, deleteProfilePhoto, currentUserFallbackPhoto]);

  const handleOpenFileSelector = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="settings-item">
      <ListItem
        narrow
        icon="camera-add"
        onClick={handleOpenFileSelector}
      >
        <SelectAvatar
          onChange={handleSelectFile}
          inputRef={inputRef}
        />
        {lang(currentUserFallbackPhoto
          ? 'Privacy.ProfilePhoto.UpdatePublicPhoto'
          : 'Privacy.ProfilePhoto.SetPublicPhoto')}
      </ListItem>
      {currentUserFallbackPhoto && (
        <ListItem
          narrow
          leftElement={<Avatar photo={currentUserFallbackPhoto} size="mini" className={styles.fallbackPhoto} />}
          onClick={openDeleteFallbackPhotoModal}
          destructive
        >
          {lang(currentUserFallbackPhoto.isVideo
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
