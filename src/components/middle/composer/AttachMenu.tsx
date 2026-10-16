import {
  memo, useEffect,
  useMemo,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAttachMenuPeerType, ApiFormattedText, ApiMessage } from '../../../api/types';
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
import { selectReplacedWalletBotId } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getDebugLogs } from '../../../util/debugConsole';
import { validateFiles } from '../../../util/files';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useSelector from '../../../hooks/data/useSelector';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import AttachBotItem from './AttachBotItem';
import FormattedDateModal from './FormattedDateModal';

import './AttachMenu.scss';

export type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  isButtonVisible: boolean;
  canAttachMedia: boolean;
  canAttachFiles: boolean;
  canAttachPolls: boolean;
  canAttachToDoLists: boolean;
  canSendPhotos: boolean;
  canSendVideos: boolean;
  canSendDocuments: boolean;
  canSendAudios: boolean;
  isScheduled?: boolean;
  attachBots?: GlobalState['attachMenu']['bots'];
  canSendMoney?: boolean;
  peerType?: ApiAttachMenuPeerType;
  shouldCollectDebugLogs?: boolean;
  theme: ThemeKey;
  canEditMedia?: boolean;
  isRichInputExpanded?: boolean;
  editingMessage?: ApiMessage;
  messageListType: MessageListType;
  paidMessagesStars?: number;
  canInsertDate?: boolean;
  canExpandRichInput?: boolean;
  menuPositionX: 'left' | 'right';
  onFileSelect: (files: File[], shouldSendAsFile?: boolean) => void;
  onDateInsert: (text: ApiFormattedText) => void;
  onTodoListCreate: NoneToVoidFunction;
  onRichInputExpand: NoneToVoidFunction;
  onMenuOpen: NoneToVoidFunction;
  onMenuClose: NoneToVoidFunction;
};

const AttachMenu = ({
  chatId,
  threadId,
  isButtonVisible,
  canAttachMedia,
  canAttachFiles,
  canAttachPolls,
  canAttachToDoLists,
  canSendPhotos,
  canSendVideos,
  canSendDocuments,
  canSendAudios,
  attachBots,
  canSendMoney,
  peerType,
  isScheduled,
  theme,
  shouldCollectDebugLogs,
  canEditMedia,
  isRichInputExpanded,
  editingMessage,
  messageListType,
  paidMessagesStars,
  canInsertDate,
  canExpandRichInput,
  menuPositionX,
  onFileSelect,
  onDateInsert,
  onMenuOpen,
  onMenuClose,
  onTodoListCreate,
  onRichInputExpand,
}: OwnProps) => {
  const {
    openPollModal,
    openMusicPicker,
    updateAttachmentSettings,
    openWalletTransferLink,
  } = getActions();
  const replacedWalletBotId = useSelector(selectReplacedWalletBotId);
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isAttachMenuOpen, closeAttachMenu);
  const [isDateModalOpen, openDateModal, closeDateModal] = useFlag();

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

  const handleFileSelect = useLastCallback((e: Event, shouldSendAsFile?: boolean) => {
    const { files } = e.target as HTMLInputElement;
    const validatedFiles = validateFiles(files);

    if (validatedFiles?.length) {
      onFileSelect(validatedFiles, shouldSendAsFile);
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
      ), (e) => handleFileSelect(e, true));
  });

  const handleSendLogs = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    onFileSelect([file]);
  });

  const bots = useMemo(() => {
    return attachBots
      ? Object.values(attachBots).filter((bot) => {
        if (!peerType || !bot.isForAttachMenu || bot.id === replacedWalletBotId) return false;

        if (peerType === 'bots' && bot.id === chatId
          && bot.attachMenuPeerTypes && bot.attachMenuPeerTypes.includes('self')) {
          return true;
        }
        return bot.attachMenuPeerTypes!.includes(peerType);
      })
      : undefined;
  }, [attachBots, chatId, peerType, replacedWalletBotId]);

  const lang = useLang();

  const handleDateMenuClick = useLastCallback(() => {
    closeAttachMenu();
    openDateModal();
  });

  const handleMusicSelect = useLastCallback(() => {
    closeAttachMenu();
    openMusicPicker({
      chatId, threadId, messageListType, shouldInsertToRichInput: isRichInputExpanded,
    });
  });

  const handlePollCreate = useLastCallback(() => {
    closeAttachMenu();
    openPollModal({ chatId, threadId, messageListType });
  });

  const handleSendGram = useLastCallback(() => {
    closeAttachMenu();
    openWalletTransferLink({ userId: chatId, shouldCloseAfterSend: true });
  });

  if (!isButtonVisible && !isDateModalOpen) {
    return undefined;
  }

  return (
    <div className="AttachMenu">
      {isButtonVisible && (
        <>
          {
            editingMessage && canEditMedia && !isRichInputExpanded ? (
              <ResponsiveHoverButton
                id="replace-menu-button"
                className={buildClassName('AttachMenu--button composer-action-button', isAttachMenuOpen && 'activated')}
                round
                color="translucent"
                onActivate={handleToggleAttachMenu}
                ariaLabel={lang('AriaReplaceAttachment')}
                ariaControls="replace-menu-controls"
                hasPopup
              >
                <Icon name="replace" />
              </ResponsiveHoverButton>
            ) : (
              <ResponsiveHoverButton
                id="attach-menu-button"
                disabled={Boolean(editingMessage && (!isRichInputExpanded || canEditMedia))}
                className={buildClassName('AttachMenu--button composer-action-button', isAttachMenuOpen && 'activated')}
                round
                color="translucent"
                onActivate={handleToggleAttachMenu}
                ariaLabel={lang('AriaAddAttachment')}
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
            positionX={menuPositionX}
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
            {canAttachMedia && canAttachFiles && (
              <>
                {canSendVideoOrPhoto && !isFile && (
                  <MenuItem icon="media" onClick={handleQuickSelect}>
                    {lang(canSendVideoAndPhoto ? 'AttachmentMenuPhotoOrVideo'
                      : (canSendPhotos ? 'AttachPhoto' : 'AttachVideo'))}
                  </MenuItem>
                )}
                {((canSendDocuments || canSendAudios) && !isPhotoOrVideo)
                  && (
                    <MenuItem icon="document" onClick={handleDocumentSelect}>
                      {lang(!canSendDocuments && canSendAudios ? 'InputAttachPopoverMusic' : 'AttachDocument')}
                    </MenuItem>
                  )}
                {canSendAudios && !editingMessage && (
                  <MenuItem icon="music" onClick={handleMusicSelect}>{lang('AttachMusic')}</MenuItem>
                )}
                {canSendDocuments && shouldCollectDebugLogs && (
                  <MenuItem icon="bug" onClick={handleSendLogs}>
                    {lang('DebugSendLogs')}
                  </MenuItem>
                )}
              </>
            )}
            {canAttachPolls && !editingMessage && (
              <MenuItem icon="poll" onClick={handlePollCreate}>{lang('Poll')}</MenuItem>
            )}
            {canAttachToDoLists && !editingMessage && (
              <MenuItem icon="select" onClick={onTodoListCreate}>{lang('TitleToDoList')}</MenuItem>
            )}
            {canInsertDate && !editingMessage && (
              <MenuItem icon="calendar" onClick={handleDateMenuClick}>{lang('GiftInfoDate')}</MenuItem>
            )}
            {canExpandRichInput && (
              <MenuItem icon="article" onClick={onRichInputExpand}>{lang('AttachmentMenuArticle')}</MenuItem>
            )}
            {canSendMoney && !editingMessage && (
              <MenuItem icon="gram-outline" onClick={handleSendGram}>{lang('WalletSendMoney')}</MenuItem>
            )}

            {!editingMessage && !canEditMedia && !isScheduled && Boolean(bots?.length) && (
              <>
                <MenuSeparator />
                {bots.map((bot) => (
                  <AttachBotItem
                    bot={bot}
                    chatId={chatId}
                    threadId={threadId}
                    theme={theme}
                    onMenuOpened={markAttachmentBotMenuOpen}
                    onMenuClosed={unmarkAttachmentBotMenuOpen}
                  />
                ))}
              </>
            )}
          </Menu>
        </>
      )}
      <FormattedDateModal
        isOpen={isDateModalOpen}
        onClose={closeDateModal}
        onSubmit={onDateInsert}
      />
    </div>
  );
};

export default memo(AttachMenu);
