import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { ApiAttachment, ApiChatMember } from '../../../api/types';

import {
  CONTENT_TYPES_WITH_PREVIEW,
  EDITABLE_INPUT_MODAL_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getFileExtension } from '../../common/helpers/documentInfo';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import usePrevious from '../../../hooks/usePrevious';
import useMentionTooltip from './hooks/useMentionTooltip';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useStateRef } from '../../../hooks/useStateRef';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import File from '../../common/File';
import MessageInput from './MessageInput';
import MentionTooltip from './MentionTooltip';
import EmojiTooltip from './EmojiTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';

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
  addRecentEmoji: AnyToVoidFunction;
  onCaptionUpdate: (html: string) => void;
  onSend: () => void;
  onFileAppend: (files: File[], isQuick: boolean) => void;
  onClear: () => void;
  onSendSilent: () => void;
  onSendScheduled: () => void;
};

const DROP_LEAVE_TIMEOUT_MS = 150;

const AttachmentModal: FC<OwnProps> = ({
  chatId,
  threadId,
  attachments,
  caption,
  canShowCustomSendMenu,
  isReady,
  isChatWithSelf,
  currentUserId,
  groupChatMembers,
  recentEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  shouldSchedule,
  addRecentEmoji,
  onCaptionUpdate,
  onSend,
  onFileAppend,
  onClear,
  onSendSilent,
  onSendScheduled,
}) => {
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
    captionRef,
    onCaptionUpdate,
    EDITABLE_INPUT_MODAL_ID,
    groupChatMembers,
    undefined,
    currentUserId,
  );
  const {
    isEmojiTooltipOpen, closeEmojiTooltip, filteredEmojis, insertEmoji,
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

  const handleFilesDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    unmarkHovered();

    const { dataTransfer: { files } } = e;

    if (files?.length) {
      const newFiles = isQuick
        ? Array.from(files).filter((file) => {
          return file.type && CONTENT_TYPES_WITH_PREVIEW.has(file.type);
        })
        : Array.from(files);

      onFileAppend(newFiles, isQuick);
    }
  }, [isQuick, onFileAppend, unmarkHovered]);

  function handleDragOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();
    e.stopPropagation();

    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }

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
      >
        {isQuick ? (
          <div className="media-wrapper custom-scroll">
            {renderingAttachments.map((attachment) => (
              attachment.mimeType.startsWith('image/')
                ? <img src={attachment.blobUrl} alt="" />
                : <video src={attachment.blobUrl} autoPlay muted loop />
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
            onClose={closeEmojiTooltip}
            onEmojiSelect={insertEmoji}
            addRecentEmoji={addRecentEmoji}
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
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(AttachmentModal);
