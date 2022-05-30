import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';

import type { GlobalState } from '../../../global/types';
import type { ISettings } from '../../../types';

import { CONTENT_TYPES_WITH_PREVIEW } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import AttachmentMenuBotItem from './AttachmentMenuBotItem';

import './AttachMenu.scss';

export type OwnProps = {
  chatId: string;
  isButtonVisible: boolean;
  canAttachMedia: boolean;
  canAttachPolls: boolean;
  isScheduled?: boolean;
  isPrivateChat?: boolean;
  attachMenuBots: GlobalState['attachMenu']['bots'];
  onFileSelect: (files: File[], isQuick: boolean) => void;
  onPollCreate: () => void;
  theme: ISettings['theme'];
};

const AttachMenu: FC<OwnProps> = ({
  chatId,
  isButtonVisible,
  canAttachMedia,
  canAttachPolls,
  attachMenuBots,
  isScheduled,
  isPrivateChat,
  onFileSelect,
  onPollCreate,
  theme,
}) => {
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isAttachMenuOpen, closeAttachMenu);

  const [isAttachmentBotMenuOpen, markAttachmentBotMenuOpen, unmarkAttachmentBotMenuOpen] = useFlag();
  useEffect(() => {
    if (isAttachMenuOpen) {
      markMouseInside();
    }
  }, [isAttachMenuOpen, markMouseInside]);

  const handleToggleAttachMenu = useCallback(() => {
    if (isAttachMenuOpen) {
      closeAttachMenu();
    } else {
      openAttachMenu();
    }
  }, [isAttachMenuOpen, openAttachMenu, closeAttachMenu]);

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
    return undefined;
  }

  return (
    <div className="AttachMenu">
      <ResponsiveHoverButton
        id="attach-menu-button"
        className={isAttachMenuOpen ? 'AttachMenu--button activated' : 'AttachMenu--button'}
        round
        color="translucent"
        onActivate={handleToggleAttachMenu}
        ariaLabel="Add an attachment"
        ariaControls="attach-menu-controls"
        hasPopup
      >
        <i className="icon-attach" />
      </ResponsiveHoverButton>
      <Menu
        id="attach-menu-controls"
        isOpen={isAttachMenuOpen || isAttachmentBotMenuOpen}
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
            <MenuItem icon="photo" onClick={handleQuickSelect}>{lang('AttachmentMenu.PhotoOrVideo')}</MenuItem>
            <MenuItem icon="document" onClick={handleDocumentSelect}>{lang('AttachDocument')}</MenuItem>
          </>
        )}
        {canAttachPolls && (
          <MenuItem icon="poll" onClick={onPollCreate}>{lang('Poll')}</MenuItem>
        )}

        {canAttachMedia && !isScheduled && isPrivateChat && Object.values(attachMenuBots).map((bot) => (
          <AttachmentMenuBotItem
            bot={bot}
            chatId={chatId}
            theme={theme}
            onMenuOpened={markAttachmentBotMenuOpen}
            onMenuClosed={unmarkAttachmentBotMenuOpen}
          />
        ))}
      </Menu>
    </div>
  );
};

export default memo(AttachMenu);
