import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAttachment, ApiChatMember, ApiSticker } from '../../../api/types';

import {
  EDITABLE_INPUT_MODAL_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getFileExtension } from '../../common/helpers/documentInfo';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';
import { hasPreview } from '../../../util/files';
import { getHtmlTextLength } from './helpers/getHtmlTextLength';

import usePrevious from '../../../hooks/usePrevious';
import useMentionTooltip from './hooks/useMentionTooltip';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useStateRef } from '../../../hooks/useStateRef';
import useCustomEmojiTooltip from './hooks/useCustomEmojiTooltip';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import File from '../../common/File';
import MessageInput from './MessageInput';
import MentionTooltip from './MentionTooltip';
import EmojiTooltip from './EmojiTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';
import CustomEmojiTooltip from './CustomEmojiTooltip.async';

import './AttachmentModal.scss';

export type OwnProps = {
  chatId: string;
  threadId: number;
  attachments: ApiAttachment[];
  caption: string;
  canShowCustomSendMenu?: boolean;
  isReady?: boolean;
  isChatWithSelf?: boolean;
  currentUserId?: string;
  groupChatMembers?: ApiChatMember[];
  recentEmojis: string[];
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  shouldSchedule?: boolean;
  shouldSuggestCustomEmoji?: boolean;
  customEmojiForEmoji?: ApiSticker[];
  captionLimit: number;
  onCaptionUpdate: (html: string) => void;
  onSend: () => void;
  onFileAppend: (files: File[], isQuick: boolean) => void;
  onClear: () => void;
  onSendSilent: () => void;
  onSendScheduled: () => void;
};

const DROP_LEAVE_TIMEOUT_MS = 150;
const CAPTION_SYMBOLS_LEFT_THRESHOLD = 100;

const AttachmentModal: FC<OwnProps> = ({
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
  onCaptionUpdate,
  onSend,
  onFileAppend,
  onClear,
  onSendSilent,
  onSendScheduled,
}) => {
  const { addRecentCustomEmoji, addRecentEmoji } = getActions();
  const captionRef = useStateRef(caption);
  // eslint-disable-next-line no-null/no-null
  const mainButtonRef = useStateRef<HTMLButtonElement | null>(null);
  const hideTimeoutRef = useRef<number>();
  const prevAttachments = usePrevious(attachments);
  const renderingAttachments = attachments.length ? attachments : prevAttachments;
  const isOpen = Boolean(attachments.length);
  const [isHovered, markHovered, unmarkHovered] = useFlag();
  const isQuick = Boolean(renderingAttachments && renderingAttachments.every((a) => a.quick));
  const lang = useLang();

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

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !canShowCustomSendMenu || !isOpen);

  const sendAttachments = useCallback(() => {
    if (isOpen) {
      if (shouldSchedule) {
        onSendScheduled();
      } else {
        onSend();
      }
    }
  }, [isOpen, onSendScheduled, onSend, shouldSchedule]);

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
      const newFiles = Array.from(files).filter((file) => !isQuick || hasPreview(file));

      onFileAppend(newFiles, isQuick);
    }
  }, [isQuick, onFileAppend, unmarkHovered]);

  function handleDragOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();

    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }

  const leftChars = useMemo(() => {
    const captionLeftBeforeLimit = captionLimit - getHtmlTextLength(caption);
    return captionLeftBeforeLimit <= CAPTION_SYMBOLS_LEFT_THRESHOLD ? captionLeftBeforeLimit : undefined;
  }, [caption, captionLimit]);

  if (!renderingAttachments) {
    return undefined;
  }

  const areAllPhotos = renderingAttachments.every((a) => SUPPORTED_IMAGE_CONTENT_TYPES.has(a.mimeType));
  const areAllVideos = renderingAttachments.every((a) => SUPPORTED_VIDEO_CONTENT_TYPES.has(a.mimeType));
  const areAllAudios = renderingAttachments.every((a) => SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType));

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
        <div className="AttachmentModal--send-wrapper">
          <Button
            ref={mainButtonRef}
            color="primary"
            size="smaller"
            className="modal-action-button"
            onClick={sendAttachments}
            onContextMenu={canShowCustomSendMenu ? handleContextMenu : undefined}
          >
            {lang('Send')}
          </Button>
          {canShowCustomSendMenu && (
            <CustomSendMenu
              isOpen={isCustomSendMenuOpen}
              isOpenToBottom
              onSendSilent={!isChatWithSelf ? onSendSilent : undefined}
              onSendSchedule={onSendScheduled}
              onClose={handleContextMenuClose}
              onCloseAnimationEnd={handleContextMenuHide}
              isSavedMessages={isChatWithSelf}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClear}
      header={renderHeader()}
      className={`AttachmentModal ${isHovered ? 'hovered' : ''}`}
    >
      <div
        className="drop-target"
        onDragEnter={markHovered}
        onDrop={handleFilesDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-attach-description={lang('Preview.Dragging.AddItems', 10)}
        data-dropzone
      >
        {isQuick ? (
          <div className="media-wrapper custom-scroll">
            {renderingAttachments.map((attachment) => (
              attachment.mimeType.startsWith('image/')
                ? <img src={attachment.blobUrl} alt="" />
                : <video src={attachment.blobUrl} autoPlay muted loop disablePictureInPicture />
            ))}
          </div>
        ) : (
          <div className="document-wrapper custom-scroll">
            {renderingAttachments.map((attachment) => (
              <File
                name={attachment.filename}
                extension={getFileExtension(attachment.filename, attachment.mimeType)}
                previewData={attachment.previewBlobUrl}
                size={attachment.size}
                smaller
              />
            ))}
          </div>
        )}

        <div className="attachment-caption-wrapper">
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
          <MessageInput
            id="caption-input-text"
            chatId={chatId}
            threadId={threadId}
            isAttachmentModalInput
            html={caption}
            editableInputId={EDITABLE_INPUT_MODAL_ID}
            placeholder={lang('Caption')}
            onUpdate={onCaptionUpdate}
            onSend={sendAttachments}
            canAutoFocus={Boolean(isReady && attachments.length)}
            captionLimit={leftChars}
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(AttachmentModal);
