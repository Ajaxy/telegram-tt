import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, {
  useState, useEffect, memo, useCallback,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import CropModal from './CropModal';

import './AvatarEditable.scss';

interface OwnProps {
  title?: string;
  disabled?: boolean;
  currentAvatarBlobUrl?: string;
  onChange: (file: File) => void;
}

const AvatarEditable: FC<OwnProps> = ({
  title = 'Change your profile picture',
  disabled,
  currentAvatarBlobUrl,
  onChange,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [croppedBlobUrl, setCroppedBlobUrl] = useState<string | undefined>(currentAvatarBlobUrl);

  useEffect(() => {
    setCroppedBlobUrl(currentAvatarBlobUrl);
  }, [currentAvatarBlobUrl]);

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target as HTMLInputElement;

    if (!target || !target.files || !target.files[0]) {
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
  );

  return (
    <div className="AvatarEditable">
      <label
        className={labelClassName}
        role="button"
        tabIndex={0}
        title={title}
      >
        <input
          type="file"
          onChange={handleSelectFile}
          accept="image/png, image/jpeg"
        />
        <i className="icon-camera-add" />
        {croppedBlobUrl && <img src={croppedBlobUrl} alt="Avatar" />}
      </label>
      <CropModal file={selectedFile} onClose={handleModalClose} onChange={handleAvatarCrop} />
    </div>
  );
};

export default memo(AvatarEditable);
