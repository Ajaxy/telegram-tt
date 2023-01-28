import type { ChangeEvent, RefObject } from 'react';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';

import CropModal from './CropModal';

import styles from './SelectAvatar.module.scss';

type OwnProps = {
  onChange: (file: File) => void;
  inputRef: RefObject<HTMLInputElement>;
};

const SelectAvatar: FC<OwnProps> = ({
  onChange,
  inputRef,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();

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
  }, [onChange]);

  const handleModalClose = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  return (
    <>
      <input
        type="file"
        onChange={handleSelectFile}
        accept="image/png, image/jpeg"
        ref={inputRef}
        className={styles.input}
      />
      <CropModal file={selectedFile} onClose={handleModalClose} onChange={handleAvatarCrop} />
    </>
  );
};

export default memo(SelectAvatar);
