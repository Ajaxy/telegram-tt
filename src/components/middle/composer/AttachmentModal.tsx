import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAttachment, ApiChatMember, ApiSticker } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EDITABLE_INPUT_MODAL_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';
import { getHtmlTextLength } from './helpers/getHtmlTextLength';
import { selectChat, selectIsChatWithSelf } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import buildClassName from '../../../util/buildClassName';
import { validateFiles } from '../../../util/files';

import usePrevious from '../../../hooks/usePrevious';
import useMentionTooltip from './hooks/useMentionTooltip';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useStateRef } from '../../../hooks/useStateRef';
import useCustomEmojiTooltip from './hooks/useCustomEmojiTooltip';
import useAppLayout from '../../../hooks/useAppLayout';
import useScrolledState from '../../../hooks/useScrolledState';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import MessageInput from './MessageInput';
import MentionTooltip from './MentionTooltip';
import EmojiTooltip from './EmojiTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';
import CustomEmojiTooltip from './CustomEmojiTooltip.async';
import AttachmentModalItem from './AttachmentModalItem';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';

import './AttachmentModal.scss';

export type OwnProps = {
  chatId: string;
  threadId: number;
  attachments: ApiAttachment[];
  caption: string;
  canShowCustomSendMenu?: boolean;
  isReady?: boolean;
  shouldSchedule?: boolean;
  shouldSuggestCompression?: boolean;
  onCaptionUpdate: (html: string) => void;
  onSend: (sendCompressed: boolean, sendGrouped: boolean) => void;
  onFileAppend: (files: File[], isSpoiler?: boolean) => void;
  onAttachmentsUpdate: (attachments: ApiAttachment[]) => void;
  onClear: NoneToVoidFunction;
  onSendSilent: (sendCompressed: boolean, sendGrouped: boolean) => void;
  onSendScheduled: (sendCompressed: boolean, sendGrouped: boolean) => void;
};

type StateProps = {
  isChatWithSelf?: boolean;
  currentUserId?: string;
  groupChatMembers?: ApiChatMember[];
  recentEmojis: string[];
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  shouldSuggestCustomEmoji?: boolean;
  customEmojiForEmoji?: ApiSticker[];
  captionLimit: number;
  attachmentSettings: GlobalState['attachmentSettings'];
};

const DROP_LEAVE_TIMEOUT_MS = 150;
const CAPTION_SYMBOLS_LEFT_THRESHOLD = 100;

const AttachmentModal: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  attachments,
  caption,
  canShowCustomSendMenu,
  captionLimit,
  isReady,
  isChatWithSelf,
  currentUserId,
  groupChatMembers,
  recentEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  shouldSchedule,
  shouldSuggestCustomEmoji,
  customEmojiForEmoji,
  attachmentSettings,
  shouldSuggestCompression,
  onAttachmentsUpdate,
  onCaptionUpdate,
  onSend,
  onFileAppend,
  onClear,
  onSendSilent,
  onSendScheduled,
}) => {
  const { addRecentCustomEmoji, addRecentEmoji, updateAttachmentSettings } = getActions();
  const lang = useLang();
  const captionRef = useStateRef(caption);
  // eslint-disable-next-line no-null/no-null
  const mainButtonRef = useStateRef<HTMLButtonElement | null>(null);
  const hideTimeoutRef = useRef<number>();
  const prevAttachments = usePrevious(attachments);
  const renderingAttachments = attachments.length ? attachments : prevAttachments;

  const [shouldSendCompressed, setShouldSendCompressed] = useState(
    shouldSuggestCompression ?? attachmentSettings.shouldCompress,
  );
  const [shouldSendGrouped, setShouldSendGrouped] = useState(attachmentSettings.shouldSendGrouped);

  const {
    handleScroll: handleAttachmentsScroll,
    isAtBeginning: areAttachmentsNotScrolled,
    isAtEnd: areAttachmentsScrolledToBottom,
  } = useScrolledState();

  const { handleScroll: handleCaptionScroll, isAtBeginning: isCaptionNotScrolled } = useScrolledState();

  const isOpen = Boolean(attachments.length);
  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const [hasMedia, hasOnlyMedia] = useMemo(() => {
    const onlyMedia = Boolean(renderingAttachments?.every((a) => a.quick || a.audio));
    if (onlyMedia) return [true, true];
    const oneMedia = Boolean(renderingAttachments?.some((a) => a.quick || a.audio));
    return [oneMedia, false];
  }, [renderingAttachments]);

  const [hasSpoiler, isEverySpoiler] = useMemo(() => {
    const areAllSpoilers = Boolean(renderingAttachments?.every((a) => a.shouldSendAsSpoiler));
    if (areAllSpoilers) return [true, true];
    const hasOneSpoiler = Boolean(renderingAttachments?.some((a) => a.shouldSendAsSpoiler));
    return [hasOneSpoiler, false];
  }, [renderingAttachments]);

  const {
    isMentionTooltipOpen, closeMentionTooltip, insertMention, mentionFilteredUsers,
  } = useMentionTooltip(
    isOpen,
    `#${EDITABLE_INPUT_MODAL_ID}`,
    onCaptionUpdate,
    groupChatMembers,
    undefined,
    currentUserId,
  );

  const { isCustomEmojiTooltipOpen, insertCustomEmoji } = useCustomEmojiTooltip(
    Boolean(shouldSuggestCustomEmoji) && isOpen,
    `#${EDITABLE_INPUT_MODAL_ID}`,
    caption,
    onCaptionUpdate,
    customEmojiForEmoji,
    !isReady,
  );

  const {
    isEmojiTooltipOpen,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
    insertCustomEmoji: insertCustomEmojiFromEmojiTooltip,
    closeEmojiTooltip,
  } = useEmojiTooltip(
    isOpen,
    captionRef,
    recentEmojis,
    EDITABLE_INPUT_MODAL_ID,
    onCaptionUpdate,
    baseEmojiKeywords,
    emojiKeywords,
    !isReady,
  );

  useEffect(() => (isOpen ? captureEscKeyListener(onClear) : undefined), [isOpen, onClear]);

  useEffect(() => {
    if (isOpen) {
      setShouldSendCompressed(shouldSuggestCompression ?? attachmentSettings.shouldCompress);
      setShouldSendGrouped(attachmentSettings.shouldSendGrouped);
    }
  }, [attachmentSettings, isOpen, shouldSuggestCompression]);

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !canShowCustomSendMenu || !isOpen);

  const sendAttachments = useCallback((isSilent?: boolean, shouldSendScheduled?: boolean) => {
    if (isOpen) {
      const send = (shouldSchedule || shouldSendScheduled) ? onSendScheduled
        : isSilent ? onSendSilent : onSend;
      send(shouldSendCompressed, shouldSendGrouped);
      updateAttachmentSettings({
        shouldCompress: shouldSendCompressed,
        shouldSendGrouped,
      });
    }
  }, [
    isOpen, shouldSchedule, onSendScheduled, onSend, updateAttachmentSettings, shouldSendCompressed, shouldSendGrouped,
    onSendSilent,
  ]);

  const handleSendSilent = useCallback(() => {
    sendAttachments(true);
  }, [sendAttachments]);

  const handleSendClick = useCallback(() => {
    sendAttachments();
  }, [sendAttachments]);

  const handleScheduleClick = useCallback(() => {
    sendAttachments(false, true);
  }, [sendAttachments]);

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    const { relatedTarget: toTarget, target: fromTarget } = e;

    // Esc button pressed during drag event
    if ((fromTarget as HTMLDivElement).matches('.drop-target') && !toTarget) {
      hideTimeoutRef.current = window.setTimeout(unmarkHovered, DROP_LEAVE_TIMEOUT_MS);
    }

    // Prevent DragLeave event from firing when the pointer moves inside the AttachmentModal drop target
    if (fromTarget && (fromTarget as HTMLElement).closest('.AttachmentModal.hovered')) {
      return;
    }

    if (toTarget) {
      e.stopPropagation();
    }

    unmarkHovered();
  };

  const handleFilesDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    unmarkHovered();

    const { dataTransfer } = e;

    const files = await getFilesFromDataTransferItems(dataTransfer.items);
    if (files?.length) {
      onFileAppend(files, isEverySpoiler);
    }
  }, [isEverySpoiler, onFileAppend, unmarkHovered]);

  function handleDragOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();

    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }

  const handleFileSelect = useCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;
    const validatedFiles = validateFiles(files);

    if (validatedFiles?.length) {
      onFileAppend(validatedFiles, isEverySpoiler);
    }
  }, [isEverySpoiler, onFileAppend]);

  const handleDocumentSelect = useCallback(() => {
    openSystemFilesDialog('*', (e) => handleFileSelect(e));
  }, [handleFileSelect]);

  const handleDelete = useCallback((index: number) => {
    onAttachmentsUpdate(attachments.filter((a, i) => i !== index));
  }, [attachments, onAttachmentsUpdate]);

  const handleEnableSpoilers = useCallback(() => {
    onAttachmentsUpdate(attachments.map((a) => ({ ...a, shouldSendAsSpoiler: true })));
  }, [attachments, onAttachmentsUpdate]);

  const handleDisableSpoilers = useCallback(() => {
    onAttachmentsUpdate(attachments.map((a) => ({ ...a, shouldSendAsSpoiler: undefined })));
  }, [attachments, onAttachmentsUpdate]);

  const handleToggleSpoiler = useCallback((index: number) => {
    onAttachmentsUpdate(attachments.map((attachment, i) => {
      if (i === index) {
        return {
          ...attachment,
          shouldSendAsSpoiler: !attachment.shouldSendAsSpoiler || undefined,
        };
      }

      return attachment;
    }));
  }, [attachments, onAttachmentsUpdate]);

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  const leftChars = useMemo(() => {
    const captionLeftBeforeLimit = captionLimit - getHtmlTextLength(caption);
    return captionLeftBeforeLimit <= CAPTION_SYMBOLS_LEFT_THRESHOLD ? captionLeftBeforeLimit : undefined;
  }, [caption, captionLimit]);

  const isQuickGallery = shouldSendCompressed && hasOnlyMedia;

  const [areAllPhotos, areAllVideos, areAllAudios] = useMemo(() => {
    if (!isQuickGallery || !renderingAttachments) return [false, false, false];
    const everyPhoto = renderingAttachments.every((a) => SUPPORTED_IMAGE_CONTENT_TYPES.has(a.mimeType));
    const everyVideo = renderingAttachments.every((a) => SUPPORTED_VIDEO_CONTENT_TYPES.has(a.mimeType));
    const everyAudio = renderingAttachments.every((a) => SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType));
    return [everyPhoto, everyVideo, everyAudio];
  }, [renderingAttachments, isQuickGallery]);

  if (!renderingAttachments) {
    return undefined;
  }

  const isMultiple = renderingAttachments.length > 1;

  let title = '';
  if (areAllPhotos) {
    title = lang('PreviewSender.SendPhoto', renderingAttachments.length, 'i');
  } else if (areAllVideos) {
    title = lang('PreviewSender.SendVideo', renderingAttachments.length, 'i');
  } else if (areAllAudios) {
    title = lang('PreviewSender.SendAudio', renderingAttachments.length, 'i');
  } else {
    title = lang('PreviewSender.SendFile', renderingAttachments.length, 'i');
  }

  function renderHeader() {
    if (!renderingAttachments) {
      return undefined;
    }

    return (
      <div className="modal-header-condensed" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button round color="translucent" size="smaller" ariaLabel="Cancel attachments" onClick={onClear}>
          <i className="icon-close" />
        </Button>
        <div className="modal-title">{title}</div>
        <DropdownMenu
          className="attachment-modal-more-menu"
          trigger={MoreMenuButton}
          positionX="right"
        >
          <MenuItem icon="add" onClick={handleDocumentSelect}>{lang('Add')}</MenuItem>
          {hasMedia && (
            <>
              {
                shouldSendCompressed ? (
                  // eslint-disable-next-line react/jsx-no-bind
                  <MenuItem icon="document" onClick={() => setShouldSendCompressed(false)}>
                    {lang(isMultiple ? 'Attachment.SendAsFiles' : 'Attachment.SendAsFile')}
                  </MenuItem>
                ) : (
                  // eslint-disable-next-line react/jsx-no-bind
                  <MenuItem icon="photo" onClick={() => setShouldSendCompressed(true)}>
                    {isMultiple ? 'Send All as Media' : 'Send as Media'}
                  </MenuItem>
                )
              }
              {shouldSendCompressed && (
                hasSpoiler ? (
                  <MenuItem icon="spoiler-disable" onClick={handleDisableSpoilers}>
                    {lang('Attachment.DisableSpoiler')}
                  </MenuItem>
                ) : (
                  <MenuItem icon="spoiler" onClick={handleEnableSpoilers}>
                    {lang('Attachment.EnableSpoiler')}
                  </MenuItem>
                )
              )}
            </>
          )}
          {isMultiple && (
            shouldSendGrouped ? (
              <MenuItem
                icon="grouped-disable"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => setShouldSendGrouped(false)}
              >
                Ungroup All Media
              </MenuItem>
            ) : (
              // eslint-disable-next-line react/jsx-no-bind
              <MenuItem icon="grouped" onClick={() => setShouldSendGrouped(true)}>
                Group All Media
              </MenuItem>
            )
          )}
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClear}
      header={renderHeader()}
      className={buildClassName(
        'AttachmentModal',
        isHovered && 'hovered',
        !areAttachmentsNotScrolled && 'modal-header-border',
      )}
      noBackdropClose
    >
      <div
        className="drop-target"
        onDragEnter={markHovered}
        onDrop={handleFilesDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={unmarkHovered}
        data-attach-description={lang('Preview.Dragging.AddItems', 10)}
        data-dropzone
      >
        <div
          className="attachments-wrapper custom-scroll"
          onScroll={handleAttachmentsScroll}
        >
          {renderingAttachments.map((attachment, i) => (
            <AttachmentModalItem
              attachment={attachment}
              className="attachment-modal-item"
              shouldDisplayCompressed={shouldSendCompressed}
              shouldDisplayGrouped={shouldSendGrouped}
              isSingle={renderingAttachments.length === 1}
              index={i}
              key={attachment.uniqueId || i}
              onDelete={handleDelete}
              onToggleSpoiler={handleToggleSpoiler}
            />
          ))}
        </div>
        <div
          className={buildClassName(
            'attachment-caption-wrapper',
            (!areAttachmentsScrolledToBottom || !isCaptionNotScrolled) && 'caption-top-border',
          )}
        >
          <MentionTooltip
            isOpen={isMentionTooltipOpen}
            onClose={closeMentionTooltip}
            onInsertUserName={insertMention}
            filteredUsers={mentionFilteredUsers}
          />
          <EmojiTooltip
            isOpen={isEmojiTooltipOpen}
            emojis={filteredEmojis}
            customEmojis={filteredCustomEmojis}
            onClose={closeEmojiTooltip}
            onEmojiSelect={insertEmoji}
            onCustomEmojiSelect={insertCustomEmojiFromEmojiTooltip}
            addRecentEmoji={addRecentEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
          />
          <CustomEmojiTooltip
            chatId={chatId}
            isOpen={isCustomEmojiTooltipOpen}
            onCustomEmojiSelect={insertCustomEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
          />
          <div className="attachment-caption">
            <MessageInput
              id="caption-input-text"
              chatId={chatId}
              threadId={threadId}
              isAttachmentModalInput
              html={caption}
              editableInputId={EDITABLE_INPUT_MODAL_ID}
              placeholder={lang('AddCaption')}
              onUpdate={onCaptionUpdate}
              onSend={handleSendClick}
              onScroll={handleCaptionScroll}
              canAutoFocus={Boolean(isReady && attachments.length)}
              captionLimit={leftChars}
            />
            <div className="AttachmentModal--send-wrapper">
              <Button
                ref={mainButtonRef}
                className="AttachmentModal--send"
                onClick={handleSendClick}
                onContextMenu={canShowCustomSendMenu ? handleContextMenu : undefined}
              >
                {lang('Send')}
              </Button>
              {canShowCustomSendMenu && (
                <CustomSendMenu
                  isOpen={isCustomSendMenuOpen}
                  onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
                  onSendSchedule={handleScheduleClick}
                  onClose={handleContextMenuClose}
                  onCloseAnimationEnd={handleContextMenuHide}
                  isSavedMessages={isChatWithSelf}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const {
      currentUserId,
      recentEmojis,
      customEmojis,
      attachmentSettings,
    } = global;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const { language, shouldSuggestCustomEmoji } = global.settings.byKey;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;

    return {
      isChatWithSelf,
      currentUserId,
      groupChatMembers: chat?.fullInfo?.members,
      recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      shouldSuggestCustomEmoji,
      customEmojiForEmoji: customEmojis.forEmoji.stickers,
      captionLimit: selectCurrentLimit(global, 'captionLength'),
      attachmentSettings,
    };
  },
)(AttachmentModal));
