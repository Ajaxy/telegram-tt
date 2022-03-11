import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';

import { CONTENT_TYPES_WITH_PREVIEW } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './AttachMenu.scss';

export type OwnProps = {
  isButtonVisible: boolean;
  canAttachMedia: boolean;
  canAttachPolls: boolean;
  onFileSelect: (files: File[], isQuick: boolean) => void;
  onPollCreate: () => void;
};

const AttachMenu: FC<OwnProps> = ({
  isButtonVisible, canAttachMedia, canAttachPolls, onFileSelect, onPollCreate,
}) => {
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isAttachMenuOpen, closeAttachMenu);

  useEffect(() => {
    if (isAttachMenuOpen) {
      markMouseInside();
    }
  }, [isAttachMenuOpen, markMouseInside]);

  const handleFileSelect = useCallback((e: Event, isQuick: boolean) => {
    const { files } = e.target as HTMLInputElement;

    if (files && files.length > 0) {
      onFileSelect(Array.from(files), isQuick);
    }
  }, [onFileSelect]);

  const handleQuickSelect = useCallback(() => {
    openSystemFilesDialog(
      Array.from(CONTENT_TYPES_WITH_PREVIEW).join(','),
      (e) => handleFileSelect(e, true),
    );
  }, [handleFileSelect]);

  const handleDocumentSelect = useCallback(() => {
    openSystemFilesDialog('*', (e) => handleFileSelect(e, false));
  }, [handleFileSelect]);

  const lang = useLang();

  if (!isButtonVisible) {
    return;
  }

  return (
    <div className="AttachMenu">
      <ResponsiveHoverButton
        id="attach-menu-button"
        className={isAttachMenuOpen ? 'AttachMenu--button activated' : 'AttachMenu--button'}
        round
        color="translucent"
        onActivate={openAttachMenu}
        ariaLabel="Add an attachment"
        ariaControls="attach-menu-controls"
        hasPopup
      >
        <i className="icon-attach" />
      </ResponsiveHoverButton>
      <Menu
        id="attach-menu-controls"
        isOpen={isAttachMenuOpen}
        autoClose
        positionX="right"
        positionY="bottom"
        onClose={closeAttachMenu}
        className="AttachMenu--menu fluid"
        onCloseAnimationEnd={closeAttachMenu}
        onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
        onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
        noCloseOnBackdrop={!IS_TOUCH_ENV}
        ariaLabelledBy="attach-menu-button"
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
    </div>
  );
};

export default memo(AttachMenu);
