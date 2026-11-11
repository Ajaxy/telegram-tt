import type { ChangeEvent } from 'react';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';

import type { ApiAvatarUpload, ApiPhoto } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { SUPPORTED_AVATAR_CONTENT_TYPES } from '../../config';
import { getVideoProfilePhotoMediaHash, getVideoProfilePhotoStartTs } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';

import Icon from '../common/icons/Icon';
import AvatarEditor from './AvatarEditor';
import OptimizedVideo from './OptimizedVideo';

import './AvatarEditable.scss';

interface OwnProps {
  title?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isForForum?: boolean;
  isOwn?: boolean;
  currentAvatarHash?: string;
  currentAvatarPhoto?: ApiPhoto;
  onChange: (avatar: ApiAvatarUpload) => void;
}

type SelectedAvatar = {
  blobUrl: string;
  videoUrl?: string;
  videoStartTs?: number;
  replacedAvatarHash?: string;
};

const AvatarEditable = ({
  title,
  disabled,
  isLoading,
  isForForum,
  isOwn,
  currentAvatarHash,
  currentAvatarPhoto,
  onChange,
}: OwnProps) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [selectedAvatar, setSelectedAvatar] = useState<SelectedAvatar | undefined>();

  const lang = useLang();

  const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);
  const currentAvatarPhotoUrl = useMedia(
    currentAvatarPhoto && getVideoProfilePhotoMediaHash(currentAvatarPhoto), false, ApiMediaFormat.BlobUrl,
  );
  const isSelectedAvatarReplaced = selectedAvatar && selectedAvatar.replacedAvatarHash !== currentAvatarHash
    && (!currentAvatarHash || currentAvatarBlobUrl);
  const isSelectedAvatarShown = selectedAvatar && !isSelectedAvatarReplaced;
  const blobUrl = isSelectedAvatarShown ? selectedAvatar.blobUrl : currentAvatarBlobUrl;
  const videoUrl = isSelectedAvatarShown
    ? selectedAvatar.videoUrl
    : (currentAvatarBlobUrl ? currentAvatarPhotoUrl : undefined);
  const videoStartTs = isSelectedAvatarShown
    ? selectedAvatar.videoStartTs
    : (currentAvatarPhoto && getVideoProfilePhotoStartTs(currentAvatarPhoto));

  useEffect(() => (selectedAvatar ? () => {
    URL.revokeObjectURL(selectedAvatar.blobUrl);
    if (selectedAvatar.videoUrl) URL.revokeObjectURL(selectedAvatar.videoUrl);
  } : undefined), [selectedAvatar]);

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;

    if (!target?.files?.[0]) {
      return;
    }

    setSelectedFile(target.files[0]);
    target.value = '';
  }

  const handleAvatarChange = useLastCallback((avatar: ApiAvatarUpload) => {
    setSelectedFile(undefined);
    setSelectedAvatar({
      blobUrl: URL.createObjectURL(avatar.file),
      videoUrl: avatar.video && URL.createObjectURL(avatar.video),
      videoStartTs: avatar.videoStartTs,
      replacedAvatarHash: currentAvatarHash,
    });
    onChange(avatar);
  });

  const handleVideoLoadedMetadata = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (videoStartTs) e.currentTarget.currentTime = videoStartTs;
  });

  const handleModalClose = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  const labelClassName = buildClassName(
    blobUrl && 'filled',
    disabled && 'disabled',
    isLoading && 'loading',
    isForForum && 'rounded-square',
  );

  return (
    <div className="AvatarEditable">
      <label
        className={labelClassName}
        role="button"
        tabIndex={0}
        title={title || lang('ChangeYourProfilePicture')}
      >
        <input
          type="file"
          onChange={handleSelectFile}
          accept={SUPPORTED_AVATAR_CONTENT_TYPES}
        />
        <Icon name="camera-add" />
        {blobUrl && <img src={blobUrl} draggable={false} alt="" />}
        {videoUrl && (
          <OptimizedVideo
            canPlay
            src={videoUrl}
            className="avatar-video"
            muted
            loop
            disablePictureInPicture
            playsInline
            onLoadedMetadata={handleVideoLoadedMetadata}
          />
        )}
      </label>
      <AvatarEditor
        file={selectedFile}
        isForForum={isForForum}
        isOwn={isOwn}
        onChange={handleAvatarChange}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default memo(AvatarEditable);
