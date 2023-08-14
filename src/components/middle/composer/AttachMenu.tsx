import React, {
  memo, useMemo, useEffect,
} from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { GlobalState } from '../../../global/types';
import type { ApiAttachMenuPeerType } from '../../../api/types';
import type { ISettings } from '../../../types';

import {
  CONTENT_TYPES_WITH_PREVIEW, DEBUG_LOG_FILENAME, SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import { validateFiles } from '../../../util/files';
import { getDebugLogs } from '../../../util/debugConsole';

import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import AttachBotItem from './AttachBotItem';

import './AttachMenu.scss';

export type OwnProps = {
  chatId: string;
  threadId?: number;
  isButtonVisible: boolean;
  canAttachMedia: boolean;
  canAttachPolls: boolean;
  canSendPhotos: boolean;
  canSendVideos: boolean;
  canSendDocuments: boolean;
  canSendAudios: boolean;
  isScheduled?: boolean;
  attachBots?: GlobalState['attachMenu']['bots'];
  peerType?: ApiAttachMenuPeerType;
  shouldCollectDebugLogs?: boolean;
  onFileSelect: (files: File[], shouldSuggestCompression?: boolean) => void;
  onPollCreate: NoneToVoidFunction;
  onMenuOpen: NoneToVoidFunction;
  onMenuClose: NoneToVoidFunction;
  theme: ISettings['theme'];
};

const AttachMenu: FC<OwnProps> = ({
  chatId,
  threadId,
  isButtonVisible,
  canAttachMedia,
  canAttachPolls,
  canSendPhotos,
  canSendVideos,
  canSendDocuments,
  canSendAudios,
  attachBots,
  peerType,
  isScheduled,
  onFileSelect,
  onMenuOpen,
  onMenuClose,
  onPollCreate,
  theme,
  shouldCollectDebugLogs,
}) => {
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isAttachMenuOpen, closeAttachMenu);

  const canSendVideoAndPhoto = canSendPhotos && canSendVideos;
  const canSendVideoOrPhoto = canSendPhotos || canSendVideos;

  const [isAttachmentBotMenuOpen, markAttachmentBotMenuOpen, unmarkAttachmentBotMenuOpen] = useFlag();
  const isMenuOpen = isAttachMenuOpen || isAttachmentBotMenuOpen;

  useEffect(() => {
    if (isAttachMenuOpen) {
      markMouseInside();
    }
  }, [isAttachMenuOpen, markMouseInside]);

  useEffect(() => {
    if (isMenuOpen) {
      onMenuOpen();
    } else {
      onMenuClose();
    }
  }, [isMenuOpen, onMenuClose, onMenuOpen]);

  const handleToggleAttachMenu = useLastCallback(() => {
    if (isAttachMenuOpen) {
      closeAttachMenu();
    } else {
      openAttachMenu();
    }
  });

  const handleFileSelect = useLastCallback((e: Event, shouldSuggestCompression?: boolean) => {
    const { files } = e.target as HTMLInputElement;
    const validatedFiles = validateFiles(files);

    if (validatedFiles?.length) {
      onFileSelect(validatedFiles, shouldSuggestCompression);
    }
  });

  const handleQuickSelect = useLastCallback(() => {
    openSystemFilesDialog(
      Array.from(canSendVideoAndPhoto ? CONTENT_TYPES_WITH_PREVIEW : (
        canSendPhotos ? SUPPORTED_IMAGE_CONTENT_TYPES : SUPPORTED_VIDEO_CONTENT_TYPES
      )).join(','),
      (e) => handleFileSelect(e, true),
    );
  });

  const handleDocumentSelect = useLastCallback(() => {
    openSystemFilesDialog(!canSendDocuments && canSendAudios
      ? Array.from(SUPPORTED_AUDIO_CONTENT_TYPES).join(',') : (
        '*'
      ), (e) => handleFileSelect(e, false));
  });

  const handleSendLogs = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    onFileSelect([file]);
  });

  const bots = useMemo(() => {
    return attachBots
      ? Object.values(attachBots).filter((bot) => {
        if (!peerType) return false;
        if (peerType === 'bots' && bot.id === chatId && bot.peerTypes.includes('self')) {
          return true;
        }
        return bot.peerTypes.includes(peerType);
      })
      : undefined;
  }, [attachBots, chatId, peerType]);

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
        <i className="icon icon-attach" />
      </ResponsiveHoverButton>
      <Menu
        id="attach-menu-controls"
        isOpen={isMenuOpen}
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
            {canSendVideoOrPhoto && (
              <MenuItem icon="photo" onClick={handleQuickSelect}>
                {lang(canSendVideoAndPhoto ? 'AttachmentMenu.PhotoOrVideo'
                  : (canSendPhotos ? 'InputAttach.Popover.Photo' : 'InputAttach.Popover.Video'))}
              </MenuItem>
            )}
            {(canSendDocuments || canSendAudios)
              && (
                <MenuItem icon="document" onClick={handleDocumentSelect}>
                  {lang(!canSendDocuments && canSendAudios ? 'InputAttach.Popover.Music' : 'AttachDocument')}
                </MenuItem>
              )}
            {canSendDocuments && shouldCollectDebugLogs && (
              <MenuItem icon="bug" onClick={handleSendLogs}>
                {lang('DebugSendLogs')}
              </MenuItem>
            )}
          </>
        )}
        {canAttachPolls && (
          <MenuItem icon="poll" onClick={onPollCreate}>{lang('Poll')}</MenuItem>
        )}

        {canAttachMedia && !isScheduled && bots?.map((bot) => (
          <AttachBotItem
            bot={bot}
            chatId={chatId}
            threadId={threadId}
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
