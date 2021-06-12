import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import { CONTENT_TYPES_FOR_QUICK_UPLOAD } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import { IAllowedAttachmentOptions } from '../../../modules/helpers';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './AttachMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  allowedAttachmentOptions: IAllowedAttachmentOptions;
  onFileSelect: (files: File[], isQuick: boolean) => void;
  onPollCreate: () => void;
  onClose: () => void;
};

const AttachMenu: FC<OwnProps> = ({
  isOpen, allowedAttachmentOptions, onFileSelect, onPollCreate, onClose,
}) => {
  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);

  const handleFileSelect = useCallback((e: Event, isQuick: boolean) => {
    const { files } = e.target as HTMLInputElement;

    if (files && files.length > 0) {
      onFileSelect(Array.from(files), isQuick);
    }
  }, [onFileSelect]);

  const handleQuickSelect = useCallback(() => {
    openSystemFilesDialog(
      CONTENT_TYPES_FOR_QUICK_UPLOAD,
      (e) => handleFileSelect(e, true),
    );
  }, [handleFileSelect]);

  const handleDocumentSelect = useCallback(() => {
    openSystemFilesDialog('*', (e) => handleFileSelect(e, false));
  }, [handleFileSelect]);

  const lang = useLang();

  const { canAttachMedia, canAttachPolls } = allowedAttachmentOptions;

  return (
    <Menu
      isOpen={isOpen}
      autoClose
      positionX="right"
      positionY="bottom"
      onClose={onClose}
      className="AttachMenu fluid"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
    >
      {/*
       ** Using ternary operator here causes some attributes from first clause
       ** transferring to the fragment content in the second clause
       */}
      {!canAttachMedia && (
        <MenuItem className="media-disabled" disabled>Posting media content is not allowed in this group.</MenuItem>
      )}
      {canAttachMedia && (
        <>
          <MenuItem icon="photo" onClick={handleQuickSelect}>
            {lang('AttachmentMenu.PhotoOrVideo')}
          </MenuItem>
          <MenuItem icon="document" onClick={handleDocumentSelect}>{lang('AttachDocument')}</MenuItem>
        </>
      )}
      {canAttachPolls && (
        <MenuItem icon="poll" onClick={onPollCreate}>{lang('Poll')}</MenuItem>
      )}
    </Menu>
  );
};

export default memo(AttachMenu);
