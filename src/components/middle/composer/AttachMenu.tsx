import {
  memo, useEffect,
  useMemo,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAttachMenuPeerType, ApiMessage } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { MessageListType, ThemeKey, ThreadId } from '../../../types';

import {
  CONTENT_TYPES_WITH_PREVIEW, DEBUG_LOG_FILENAME, SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import {
  getMessageAudio, getMessageDocument,
  getMessagePhoto,
  getMessageVideo, getMessageVoice,
} from '../../../global/helpers';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getDebugLogs } from '../../../util/debugConsole';
import { validateFiles } from '../../../util/files';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import AttachBotItem from './AttachBotItem';

import './AttachMenu.scss';

export type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  isButtonVisible: boolean;
  canAttachMedia: boolean;
  canAttachPolls: boolean;
  canAttachToDoLists: boolean;
  canSendPhotos: boolean;
  canSendVideos: boolean;
  canSendDocuments: boolean;
  canSendAudios: boolean;
  isScheduled?: boolean;
  attachBots?: GlobalState['attachMenu']['bots'];
  peerType?: ApiAttachMenuPeerType;
  shouldCollectDebugLogs?: boolean;
  theme: ThemeKey;
  canEditMedia?: boolean;
  editingMessage?: ApiMessage;
  messageListType?: MessageListType;
  paidMessagesStars?: number;
  onFileSelect: (files: File[]) => void;
  onPollCreate: NoneToVoidFunction;
  onTodoListCreate: NoneToVoidFunction;
  onMenuOpen: NoneToVoidFunction;
  onMenuClose: NoneToVoidFunction;
};

const AttachMenu = ({
  chatId,
  threadId,
  isButtonVisible,
  canAttachMedia,
  canAttachPolls,
  canAttachToDoLists,
  canSendPhotos,
  canSendVideos,
  canSendDocuments,
  canSendAudios,
  attachBots,
  peerType,
  isScheduled,
  theme,
  shouldCollectDebugLogs,
  canEditMedia,
  editingMessage,
  messageListType,
  paidMessagesStars,
  onFileSelect,
  onMenuOpen,
  onMenuClose,
  onPollCreate,
  onTodoListCreate,
}: OwnProps) => {
  const {
    updateAttachmentSettings,
  } = getActions();
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isAttachMenuOpen, closeAttachMenu);

  const canSendVideoAndPhoto = canSendPhotos && canSendVideos;
  const canSendVideoOrPhoto = canSendPhotos || canSendVideos;

  const [isAttachmentBotMenuOpen, markAttachmentBotMenuOpen, unmarkAttachmentBotMenuOpen] = useFlag();
  const isMenuOpen = isAttachMenuOpen || isAttachmentBotMenuOpen;

  const isPhotoOrVideo = editingMessage && editingMessage?.groupedId
    && Boolean(getMessagePhoto(editingMessage)
      || Boolean(getMessageVideo(editingMessage)));
  const isFile = editingMessage && editingMessage?.groupedId && Boolean(getMessageAudio(editingMessage)
    || getMessageVoice(editingMessage) || getMessageDocument(editingMessage));

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

  const handleFileSelect = useLastCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;
    const validatedFiles = validateFiles(files);

    if (validatedFiles?.length) {
      onFileSelect(validatedFiles);
    }
  });

  const handleQuickSelect = useLastCallback(() => {
    updateAttachmentSettings({ shouldCompress: true });
    openSystemFilesDialog(
      Array.from(canSendVideoAndPhoto ? CONTENT_TYPES_WITH_PREVIEW : (
        canSendPhotos ? SUPPORTED_PHOTO_CONTENT_TYPES : SUPPORTED_VIDEO_CONTENT_TYPES
      )).join(','),
      (e) => handleFileSelect(e),
    );
  });

  const handleDocumentSelect = useLastCallback(() => {
    updateAttachmentSettings({ shouldCompress: false });
    openSystemFilesDialog(!canSendDocuments && canSendAudios
      ? Array.from(SUPPORTED_AUDIO_CONTENT_TYPES).join(',') : (
        '*'
      ), (e) => handleFileSelect(e));
  });

  const handleSendLogs = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    onFileSelect([file]);
  });

  const bots = useMemo(() => {
    return attachBots
      ? Object.values(attachBots).filter((bot) => {
        if (!peerType || !bot.isForAttachMenu) return false;
        if (peerType === 'bots' && bot.id === chatId
          && bot.attachMenuPeerTypes && bot.attachMenuPeerTypes.includes('self')) {
          return true;
        }
        return bot.attachMenuPeerTypes!.includes(peerType);
      })
      : undefined;
  }, [attachBots, chatId, peerType]);

  const oldLang = useOldLang();
  const lang = useLang();

  if (!isButtonVisible) {
    return undefined;
  }

  return (
    <div className="AttachMenu">
      {
        editingMessage && canEditMedia ? (
          <ResponsiveHoverButton
            id="replace-menu-button"
            className={buildClassName('AttachMenu--button composer-action-button', isAttachMenuOpen && 'activated')}
            round
            color="translucent"
            onActivate={handleToggleAttachMenu}
            ariaLabel="Replace an attachment"
            ariaControls="replace-menu-controls"
            hasPopup
          >
            <Icon name="replace" />
          </ResponsiveHoverButton>
        ) : (
          <ResponsiveHoverButton
            id="attach-menu-button"
            disabled={Boolean(editingMessage)}
            className={buildClassName('AttachMenu--button composer-action-button', isAttachMenuOpen && 'activated')}
            round
            color="translucent"
            onActivate={handleToggleAttachMenu}
            ariaLabel="Add an attachment"
            ariaControls="attach-menu-controls"
            hasPopup
          >
            <Icon name="attach" />
          </ResponsiveHoverButton>
        )
      }
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
          <MenuItem className="media-disabled" disabled>
            {lang(messageListType === 'scheduled' && paidMessagesStars
              ? 'DescriptionScheduledPaidMediaNotAllowed'
              : 'DescriptionRestrictedMedia')}
          </MenuItem>
        )}
        {canAttachMedia && (
          <>
            {canSendVideoOrPhoto && !isFile && (
              <MenuItem icon="photo" onClick={handleQuickSelect}>
                {oldLang(canSendVideoAndPhoto ? 'AttachmentMenu.PhotoOrVideo'
                  : (canSendPhotos ? 'InputAttach.Popover.Photo' : 'InputAttach.Popover.Video'))}
              </MenuItem>
            )}
            {((canSendDocuments || canSendAudios) && !isPhotoOrVideo)
              && (
                <MenuItem icon="document" onClick={handleDocumentSelect}>
                  {oldLang(!canSendDocuments && canSendAudios ? 'InputAttach.Popover.Music' : 'AttachDocument')}
                </MenuItem>
              )}
            {canSendDocuments && shouldCollectDebugLogs && (
              <MenuItem icon="bug" onClick={handleSendLogs}>
                {oldLang('DebugSendLogs')}
              </MenuItem>
            )}
          </>
        )}
        {canAttachPolls && !editingMessage && (
          <MenuItem icon="poll" onClick={onPollCreate}>{oldLang('Poll')}</MenuItem>
        )}
        {canAttachToDoLists && !editingMessage && (
          <MenuItem icon="select" onClick={onTodoListCreate}>{lang('TitleToDoList')}</MenuItem>
        )}

        {!editingMessage && !canEditMedia && !isScheduled && bots?.map((bot) => (
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
