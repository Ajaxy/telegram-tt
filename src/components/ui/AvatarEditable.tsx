import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import CropModal from './CropModal';

import './AvatarEditable.scss';

interface OwnProps {
  title?: string;
  disabled?: boolean;
  isForForum?: boolean;
  currentAvatarBlobUrl?: string;
  onChange: (file: File) => void;
}

const AvatarEditable: FC<OwnProps> = ({
  title,
  disabled,
  isForForum,
  currentAvatarBlobUrl,
  onChange,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [croppedBlobUrl, setCroppedBlobUrl] = useState<string | undefined>(currentAvatarBlobUrl);

  const lang = useLang();

  useEffect(() => {
    setCroppedBlobUrl(currentAvatarBlobUrl);
  }, [currentAvatarBlobUrl]);

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target as HTMLInputElement;

    if (!target?.files?.[0]) {
      return;
    }

    setSelectedFile(target.files[0]);
    target.value = '';
  }

  const handleAvatarCrop = useCallback((croppedImg: File) => {
    setSelectedFile(undefined);
    onChange(croppedImg);

    if (croppedBlobUrl && croppedBlobUrl !== currentAvatarBlobUrl) {
      URL.revokeObjectURL(croppedBlobUrl);
    }
    setCroppedBlobUrl(URL.createObjectURL(croppedImg));
  }, [croppedBlobUrl, currentAvatarBlobUrl, onChange]);

  const handleModalClose = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  const labelClassName = buildClassName(
    croppedBlobUrl && 'filled',
    disabled && 'disabled',
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
          accept="image/png, image/jpeg"
        />
        <Icon name="camera-add" />
        {croppedBlobUrl && <img src={croppedBlobUrl} draggable={false} alt="" />}
      </label>
      <CropModal file={selectedFile} onClose={handleModalClose} onChange={handleAvatarCrop} />
    </div>
  );
};

export default memo(AvatarEditable);
