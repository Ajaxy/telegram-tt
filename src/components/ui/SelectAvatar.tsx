import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import { openSystemFilesDialog } from '../../util/systemFilesDialog';

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

  const handleAvatarCrop = useCallback((croppedImg: File) => {
    setSelectedFile(undefined);
    onChange(croppedImg);
  }, [onChange]);

  const handleModalClose = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  const handleClick = useCallback(() => {
    openSystemFilesDialog('image/png, image/jpeg', ((event) => {
      const target = event.target as HTMLInputElement;
      if (!target?.files?.[0]) {
        return;
      }
      setSelectedFile(target.files[0]);
    }), true);
  }, []);

  return (
    <>
      <input ref={inputRef} className={styles.input} onClick={handleClick} />
      <CropModal file={selectedFile} onClose={handleModalClose} onChange={handleAvatarCrop} />
    </>
  );
};

export default memo(SelectAvatar);
