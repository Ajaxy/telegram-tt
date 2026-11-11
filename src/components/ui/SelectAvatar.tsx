import type { ElementRef } from '../../lib/teact/teact';
import { memo, useCallback, useState } from '../../lib/teact/teact';

import type { ApiAvatarUpload } from '../../api/types';

import { SUPPORTED_AVATAR_CONTENT_TYPES } from '../../config';
import { openSystemFilesDialog } from '../../util/systemFilesDialog';

import AvatarEditor from './AvatarEditor';

import styles from './SelectAvatar.module.scss';

type OwnProps = {
  inputRef: ElementRef<HTMLInputElement>;
  isOwn?: boolean;
  onChange: (avatar: ApiAvatarUpload) => void;
};

const SelectAvatar = ({
  inputRef,
  isOwn,
  onChange,
}: OwnProps) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();

  const handleAvatarChange = useCallback((avatar: ApiAvatarUpload) => {
    setSelectedFile(undefined);
    onChange(avatar);
  }, [onChange]);

  const handleModalClose = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  const handleClick = useCallback(() => {
    openSystemFilesDialog(SUPPORTED_AVATAR_CONTENT_TYPES, (event) => {
      const target = event.target as HTMLInputElement;
      if (!target?.files?.[0]) {
        return;
      }
      setSelectedFile(target.files[0]);
    }, true);
  }, []);

  return (
    <>
      <input ref={inputRef} className={styles.input} onClick={handleClick} />
      <AvatarEditor file={selectedFile} isOwn={isOwn} onChange={handleAvatarChange} onClose={handleModalClose} />
    </>
  );
};

export default memo(SelectAvatar);
