import {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPhoto } from '../../../api/types';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import Island, { IslandDescription } from '../../gili/layout/Island';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';

import styles from './SettingsPrivacyPublicPhoto.module.scss';

type OwnProps = {
  currentUserId: string;
  hasCurrentUserFullInfo?: boolean;
  currentUserFallbackPhoto?: ApiPhoto;
};

const SettingsPrivacyPublicProfilePhoto = ({
  currentUserId,
  hasCurrentUserFullInfo,
  currentUserFallbackPhoto,
}: OwnProps) => {
  const {
    loadFullUser, uploadProfilePhoto, deleteProfilePhoto, showNotification,
  } = getActions();

  const lang = useLang();

  const [isDeleteFallbackPhotoModalOpen, openDeleteFallbackPhotoModal, closeDeleteFallbackPhotoModal] = useFlag(false);

  const inputRef = useRef<HTMLInputElement>();

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
      message: lang('PrivacyProfilePhotoPublicPhotoSuccess'),
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
    <>
      <Island>
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
            ? 'PrivacyProfilePhotoUpdatePublicPhoto' : 'PrivacyProfilePhotoSetPublicPhoto')}
        </ListItem>
        {currentUserFallbackPhoto && (
          <ListItem
            narrow
            leftElement={<Avatar photo={currentUserFallbackPhoto} size="mini" className={styles.fallbackPhoto} />}
            onClick={openDeleteFallbackPhotoModal}
            destructive
          >
            {lang(currentUserFallbackPhoto.isVideo
              ? 'PrivacyProfilePhotoRemovePublicVideo' : 'PrivacyProfilePhotoRemovePublicPhoto')}
            <ConfirmDialog
              isOpen={isDeleteFallbackPhotoModalOpen}
              onClose={closeDeleteFallbackPhotoModal}
              text={lang('PrivacyResetPhotoConfirm')}
              confirmLabel={lang('Delete')}
              confirmHandler={handleConfirmDelete}
              confirmIsDestructive
            />
          </ListItem>
        )}
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('PrivacyProfilePhotoPublicPhotoInfo')}
      </IslandDescription>
    </>
  );
};

export default memo(SettingsPrivacyPublicProfilePhoto);
