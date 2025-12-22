import type React from '../../../lib/teact/teact';
import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAttachment, ApiChatMember, ApiMessage, ApiSticker } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { MessageListType, ThreadId } from '../../../types';
import type { Signal } from '../../../util/signals';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EDITABLE_INPUT_MODAL_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getAttachmentMediaType } from '../../../global/helpers';
import { selectChatFullInfo, selectIsChatWithSelf, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { validateFiles } from '../../../util/files';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { removeAllSelections } from '../../../util/selection';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';
import { getHtmlTextLength } from './helpers/getHtmlTextLength';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useDerivedState from '../../../hooks/useDerivedState';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useFlag from '../../../hooks/useFlag';
import useGetSelectionRange from '../../../hooks/useGetSelectionRange';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useScrolledState from '../../../hooks/useScrolledState';
import useCustomEmojiTooltip from './hooks/useCustomEmojiTooltip';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useMentionTooltip from './hooks/useMentionTooltip';

import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import AttachmentModalItem from './AttachmentModalItem';
import CustomEmojiTooltip from './CustomEmojiTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';
import EmojiTooltip from './EmojiTooltip.async';
import MentionTooltip from './MentionTooltip';
import MessageInput from './MessageInput';
import SymbolMenuButton from './SymbolMenuButton';

import styles from './AttachmentModal.module.scss';

export type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  attachments: ApiAttachment[];
  editingMessage?: ApiMessage;
  messageListType?: MessageListType;
  getHtml: Signal<string>;
  canShowCustomSendMenu?: boolean;
  isReady: boolean;
  isForMessage?: boolean;
  shouldSchedule?: boolean;
  shouldForceCompression?: boolean;
  shouldForceAsFile?: boolean;
  isForCurrentMessageList?: boolean;
  forceDarkTheme?: boolean;
  onCaptionUpdate: (html: string) => void;
  onSend: (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => void;
  onFileAppend: (files: File[], isSpoiler?: boolean) => void;
  onAttachmentsUpdate: (attachments: ApiAttachment[]) => void;
  onClear: NoneToVoidFunction;
  onSendSilent: (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => void;
  onSendScheduled: (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onRemoveSymbol: VoidFunction;
  onEmojiSelect: (emoji: string) => void;
  canScheduleUntilOnline?: boolean;
  canSchedule?: boolean;
  onSendWhenOnline?: NoneToVoidFunction;
  paidMessagesStars?: number;
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
  shouldSaveAttachmentsCompression?: boolean;
};

const ATTACHMENT_MODAL_INPUT_ID = 'caption-input-text';
const DROP_LEAVE_TIMEOUT_MS = 150;
const MAX_LEFT_CHARS_TO_SHOW = 100;
const CLOSE_MENU_ANIMATION_DURATION = 200;

const AttachmentModal: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  attachments,
  getHtml,
  editingMessage,
  canShowCustomSendMenu,
  captionLimit,
  isReady,
  isChatWithSelf,
  currentUserId,
  groupChatMembers,
  recentEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  isForMessage,
  shouldSchedule,
  shouldSuggestCustomEmoji,
  customEmojiForEmoji,
  attachmentSettings,
  shouldSaveAttachmentsCompression,
  shouldForceCompression,
  shouldForceAsFile,
  isForCurrentMessageList,
  forceDarkTheme,
  onAttachmentsUpdate,
  onCaptionUpdate,
  onSend,
  onFileAppend,
  onClear,
  onSendSilent,
  onSendScheduled,
  onCustomEmojiSelect,
  onRemoveSymbol,
  onEmojiSelect,
  canScheduleUntilOnline,
  canSchedule,
  onSendWhenOnline,
  paidMessagesStars,
}) => {
  const ref = useRef<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>();
  const { addRecentCustomEmoji, addRecentEmoji, updateAttachmentSettings } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const mainButtonRef = useRef<HTMLButtonElement>();
  const inputRef = useRef<HTMLDivElement>();

  const hideTimeoutRef = useRef<number>();
  const prevAttachments = usePreviousDeprecated(attachments);
  const renderingAttachments = attachments.length ? attachments : prevAttachments;
  const { isMobile } = useAppLayout();

  const isEditing = editingMessage && Boolean(editingMessage);
  const isInAlbum = editingMessage && editingMessage?.groupedId;
  const isEditingMessageFile = isEditing && attachments?.length && getAttachmentMediaType(attachments[0]);
  const notEditingFile = isEditingMessageFile !== 'file';

  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();

  const shouldSendCompressed = attachmentSettings.shouldCompress;
  const isSendingCompressed = Boolean(
    (shouldSendCompressed || shouldForceCompression || isInAlbum) && !shouldForceAsFile,
  );
  const [shouldSendGrouped, setShouldSendGrouped] = useState(attachmentSettings.shouldSendGrouped);
  const isInvertedMedia = attachmentSettings.isInvertedMedia;
  const [shouldSendInHighQuality, setShouldSendInHighQuality] = useState(
    attachmentSettings.shouldSendInHighQuality,
  );
  const [renderingShouldSendInHighQuality, setRenderingShouldSendInHighQuality] = useState(shouldSendInHighQuality);

  const {
    handleScroll: handleAttachmentsScroll,
    isAtBeginning: areAttachmentsNotScrolled,
    isAtEnd: areAttachmentsScrolledToBottom,
  } = useScrolledState();

  const { handleScroll: handleCaptionScroll, isAtBeginning: isCaptionNotScrolled } = useScrolledState();

  const isOpen = Boolean(attachments.length);
  const renderingIsOpen = Boolean(renderingAttachments?.length);
  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const timerRef = useRef<number | undefined>();

  useEffect(() => {
    if (!isOpen) {
      closeSymbolMenu();
      updateAttachmentSettings({ isInvertedMedia: undefined });
    }
  }, [closeSymbolMenu, isOpen]);

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

  const getSelectionRange = useGetSelectionRange(`#${EDITABLE_INPUT_MODAL_ID}`);

  const {
    isEmojiTooltipOpen,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
    closeEmojiTooltip,
  } = useEmojiTooltip(
    Boolean(isReady && (isForCurrentMessageList || !isForMessage) && renderingIsOpen),
    getHtml,
    onCaptionUpdate,
    EDITABLE_INPUT_MODAL_ID,
    recentEmojis,
    baseEmojiKeywords,
    emojiKeywords,
  );

  const {
    isCustomEmojiTooltipOpen,
    insertCustomEmoji,
    closeCustomEmojiTooltip,
  } = useCustomEmojiTooltip(
    Boolean(isReady && (isForCurrentMessageList || !isForMessage) && renderingIsOpen && shouldSuggestCustomEmoji),
    getHtml,
    onCaptionUpdate,
    getSelectionRange,
    inputRef,
    customEmojiForEmoji,
  );

  const {
    isMentionTooltipOpen,
    closeMentionTooltip,
    insertMention,
    mentionFilteredUsers,
  } = useMentionTooltip(
    Boolean(isReady && isForCurrentMessageList && renderingIsOpen),
    getHtml,
    onCaptionUpdate,
    getSelectionRange,
    inputRef,
    groupChatMembers,
    undefined,
    currentUserId,
  );

  useEffect(() => (isOpen ? captureEscKeyListener(onClear) : undefined), [isOpen, onClear]);

  useEffect(() => {
    if (isOpen) {
      setShouldSendGrouped(attachmentSettings.shouldSendGrouped);
      setShouldSendInHighQuality(attachmentSettings.shouldSendInHighQuality);
    }
  }, [attachmentSettings, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      updateAttachmentSettings({ isInvertedMedia: undefined });
    }
  }, [updateAttachmentSettings, isOpen]);

  function setIsInvertedMedia(value?: true) {
    updateAttachmentSettings({ isInvertedMedia: value });
  }

  useEffect(() => {
    if (isOpen && isMobile) {
      removeAllSelections();
    }
  }, [isMobile, isOpen]);

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !canShowCustomSendMenu || !isOpen);

  const sendAttachments = useLastCallback((isSilent?: boolean, shouldSendScheduled?: boolean) => {
    if (isOpen) {
      const send = ((shouldSchedule || shouldSendScheduled) && isForMessage && !editingMessage) ? onSendScheduled
        : isSilent ? onSendSilent : onSend;
      send(isSendingCompressed, shouldSendGrouped, isInvertedMedia);
      updateAttachmentSettings({
        ...(shouldSaveAttachmentsCompression && {
          defaultAttachmentCompression: attachmentSettings.shouldCompress ? 'compress' : 'original',
        }),
        shouldSendGrouped,
        isInvertedMedia,
        shouldSendInHighQuality,
      });
    }
  });

  const handleSendSilent = useLastCallback(() => {
    sendAttachments(true);
  });

  const handleSendClick = useLastCallback(() => {
    sendAttachments();
  });

  const handleScheduleClick = useLastCallback(() => {
    sendAttachments(false, true);
  });

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    const { relatedTarget: toTarget, target: fromTarget } = e;

    // Esc button pressed during drag event
    if ((fromTarget as HTMLDivElement).matches(`.${styles.dropTarget}`) && !toTarget) {
      hideTimeoutRef.current = window.setTimeout(unmarkHovered, DROP_LEAVE_TIMEOUT_MS);
    }

    // Prevent DragLeave event from firing when the pointer moves inside the AttachmentModal drop target
    if (fromTarget && (fromTarget as HTMLElement).closest(`.${styles.hovered}`)) {
      return;
    }

    if (toTarget) {
      e.stopPropagation();
    }

    unmarkHovered();
  };

  const handleFilesDrop = useLastCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    unmarkHovered();

    const { dataTransfer } = e;

    const files = await getFilesFromDataTransferItems(dataTransfer.items);
    if (files?.length) {
      onFileAppend(files, isEverySpoiler);
    }
  });

  function handleDragOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();

    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
  }

  const handleFileSelect = useLastCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;
    const validatedFiles = validateFiles(files);

    if (validatedFiles?.length) {
      onFileAppend(validatedFiles, isEverySpoiler);
    }
  });

  const handleDocumentSelect = useLastCallback(() => {
    openSystemFilesDialog('*', (e) => handleFileSelect(e));
  });

  const handleDelete = useLastCallback((index: number) => {
    onAttachmentsUpdate(attachments.filter((a, i) => i !== index));
  });

  const handleEnableSpoilers = useLastCallback(() => {
    onAttachmentsUpdate(attachments.map((a) => ({
      ...a,
      shouldSendAsSpoiler: true,
    })));
  });

  const handleToggleShouldCompress = useLastCallback(() => {
    const newValue = !shouldSendCompressed;
    updateAttachmentSettings({ shouldCompress: newValue });
  });

  const handleToggleQuality = useLastCallback(() => {
    const newValue = !shouldSendInHighQuality;
    setShouldSendInHighQuality(newValue);
    updateAttachmentSettings({ shouldSendInHighQuality: newValue });
  });

  const handleDisableSpoilers = useLastCallback(() => {
    onAttachmentsUpdate(attachments.map((a) => ({ ...a, shouldSendAsSpoiler: undefined })));
  });

  const handleToggleSpoiler = useLastCallback((index: number) => {
    onAttachmentsUpdate(attachments.map((attachment, i) => {
      if (i === index) {
        return {
          ...attachment,
          shouldSendAsSpoiler: !attachment.shouldSendAsSpoiler || undefined,
        };
      }

      return attachment;
    }));
  });

  const handleResize = useLastCallback(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const { width, height } = svg.getBoundingClientRect();
    svg.viewBox.baseVal.width = width;
    svg.viewBox.baseVal.height = height;
  });

  // Can't listen for SVG resize
  useResizeObserver(ref, handleResize);

  useEffectOnce(handleResize);

  useEffect(() => {
    const mainButton = mainButtonRef.current;
    const input = document.getElementById(ATTACHMENT_MODAL_INPUT_ID);

    if (!mainButton || !input) return;

    const { width } = mainButton.getBoundingClientRect();

    requestMutation(() => {
      input.style.setProperty('--margin-for-scrollbar', `${width}px`);
    });
  }, [oldLang, isOpen]);

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="tiny"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
        iconName="more"
      />
    );
  }, [isMobile]);

  const leftChars = useDerivedState(() => {
    if (!renderingIsOpen) return undefined;

    const leftCharsBeforeLimit = captionLimit - getHtmlTextLength(getHtml());
    return leftCharsBeforeLimit <= MAX_LEFT_CHARS_TO_SHOW ? leftCharsBeforeLimit : undefined;
  }, [captionLimit, getHtml, renderingIsOpen]);

  const isQuickGallery = isSendingCompressed && hasOnlyMedia;

  const [areAllPhotos, areAllVideos, areAllAudios, hasAnyPhoto] = useMemo(() => {
    if (!isQuickGallery || !renderingAttachments) return [false, false, false];
    const everyPhoto = renderingAttachments.every((a) => SUPPORTED_PHOTO_CONTENT_TYPES.has(a.mimeType));
    const everyVideo = renderingAttachments.every((a) => SUPPORTED_VIDEO_CONTENT_TYPES.has(a.mimeType));
    const everyAudio = renderingAttachments.every((a) => SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType));
    const anyPhoto = renderingAttachments.some((a) => SUPPORTED_PHOTO_CONTENT_TYPES.has(a.mimeType));
    return [everyPhoto, everyVideo, everyAudio, anyPhoto];
  }, [renderingAttachments, isQuickGallery]);

  const hasAnySpoilerable = useMemo(() => {
    if (!renderingAttachments) return false;
    return renderingAttachments.some((a) => !SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType));
  }, [renderingAttachments]);

  useEffect(() => {
    if (shouldSendInHighQuality === renderingShouldSendInHighQuality) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setRenderingShouldSendInHighQuality(shouldSendInHighQuality);
    }, CLOSE_MENU_ANIMATION_DURATION);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [shouldSendInHighQuality, renderingShouldSendInHighQuality]);

  if (!renderingAttachments) {
    return undefined;
  }

  const isMultiple = renderingAttachments.length > 1;

  const canInvertMedia = (() => {
    if (isEditing) return false;
    if (!hasMedia) return false;
    if (!shouldForceAsFile && !shouldForceCompression && !isSendingCompressed) return false;
    if (isMultiple && shouldSendGrouped) return false;
    return true;
  })();

  let title = '';
  const attachmentsLength = renderingAttachments.length;
  if (areAllPhotos) {
    title = oldLang(isEditing ? 'EditMessageReplacePhoto' : 'PreviewSender.SendPhoto', attachmentsLength, 'i');
  } else if (areAllVideos) {
    title = oldLang(isEditing ? 'EditMessageReplaceVideo' : 'PreviewSender.SendVideo', attachmentsLength, 'i');
  } else if (areAllAudios) {
    title = oldLang(isEditing ? 'EditMessageReplaceAudio' : 'PreviewSender.SendAudio', attachmentsLength, 'i');
  } else {
    title = oldLang(isEditing ? 'EditMessageReplaceFile' : 'PreviewSender.SendFile', attachmentsLength, 'i');
  }

  function renderHeader() {
    if (!renderingAttachments) {
      return undefined;
    }

    return (
      <div className="modal-header-condensed" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel="Cancel attachments"
          onClick={onClear}
          iconName="close"
        />
        <div className="modal-title">{title}</div>
        {notEditingFile && !isInAlbum
          && (
            <DropdownMenu
              className="with-menu-transitions"
              trigger={MoreMenuButton}
              positionX="right"
            >
              {Boolean(!editingMessage) && (
                <MenuItem icon="add" onClick={handleDocumentSelect}>{oldLang('Add')}</MenuItem>
              )}
              {hasMedia && (
                <>
                  {
                    canInvertMedia && (!isInvertedMedia ? (

                      <MenuItem icon="move-caption-up" onClick={() => setIsInvertedMedia(true)}>
                        {lang('ContextMoveTextUp')}
                      </MenuItem>
                    ) : (

                      <MenuItem icon="move-caption-down" onClick={() => setIsInvertedMedia(undefined)}>
                        {lang('ContextMoveTextDown')}
                      </MenuItem>
                    ))
                  }
                  {
                    !shouldForceAsFile && !shouldForceCompression && (isSendingCompressed ? (

                      <MenuItem icon="document" onClick={handleToggleShouldCompress}>
                        {oldLang(isMultiple ? 'Attachment.SendAsFiles' : 'Attachment.SendAsFile')}
                      </MenuItem>
                    ) : (

                      <MenuItem icon="photo" onClick={handleToggleShouldCompress}>
                        {isMultiple ? 'Send All as Media' : 'Send as Media'}
                      </MenuItem>
                    ))
                  }
                  {isSendingCompressed && !editingMessage && hasAnyPhoto && (
                    <MenuItem
                      icon={renderingShouldSendInHighQuality ? 'sd-photo' : 'hd-photo'}
                      onClick={handleToggleQuality}
                    >
                      {lang(renderingShouldSendInHighQuality ? 'SendInStandardQuality' : 'SendInHighQuality')}
                    </MenuItem>
                  )}
                  {isSendingCompressed && hasAnySpoilerable && Boolean(!editingMessage) && (
                    hasSpoiler ? (
                      <MenuItem icon="spoiler-disable" onClick={handleDisableSpoilers}>
                        {oldLang('Attachment.DisableSpoiler')}
                      </MenuItem>
                    ) : (
                      <MenuItem icon="spoiler" onClick={handleEnableSpoilers}>
                        {oldLang('Attachment.EnableSpoiler')}
                      </MenuItem>
                    )
                  )}
                </>
              )}
              {isMultiple && (
                shouldSendGrouped ? (
                  <MenuItem
                    icon="grouped-disable"

                    onClick={() => setShouldSendGrouped(false)}
                  >
                    Ungroup All Media
                  </MenuItem>
                ) : (

                  <MenuItem icon="grouped" onClick={() => setShouldSendGrouped(true)}>
                    Group All Media
                  </MenuItem>
                )
              )}
            </DropdownMenu>
          )}
      </div>
    );
  }

  const isBottomDividerShown = !areAttachmentsScrolledToBottom || !isCaptionNotScrolled;
  const buttonSendCaption = paidMessagesStars ? formatStarsAsIcon(
    lang,
    attachmentsLength * paidMessagesStars,
    {
      className: styles.sendButtonStar,
      asFont: true,
    },
  ) : oldLang('Send');

  return (
    <Modal
      isOpen={isOpen}
      header={renderHeader()}
      className={buildClassName(
        styles.root,
        isHovered && styles.hovered,
        !areAttachmentsNotScrolled && styles.headerBorder,
        isMobile && styles.mobile,
        isSymbolMenuOpen && styles.symbolMenuOpen,
        forceDarkTheme && 'component-theme-dark',
      )}
      hasAbsoluteCloseButton={Boolean(renderingAttachments)}
      noBackdropClose
      isLowStackPriority
      onClose={onClear}
    >
      <div
        className={styles.dropTarget}
        onDragEnter={markHovered}
        onDrop={handleFilesDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={unmarkHovered}
        data-attach-description={oldLang('Preview.Dragging.AddItems', 10)}
        data-dropzone
      >
        <svg className={styles.dropOutlineContainer}>
          <rect className={styles.dropOutline} x="0" y="0" width="100%" height="100%" rx="8" />
        </svg>
        <div
          className={buildClassName(
            styles.attachments,
            'custom-scroll',
            isBottomDividerShown && styles.attachmentsBottomPadding,
          )}
          onScroll={handleAttachmentsScroll}
        >
          {renderingAttachments.map((attachment, i) => (
            <AttachmentModalItem
              attachment={attachment}
              shouldDisplayCompressed={isSendingCompressed}
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
            styles.captionWrapper,
            isBottomDividerShown && styles.captionTopBorder,
          )}
        >
          <MentionTooltip
            isOpen={isMentionTooltipOpen}
            filteredUsers={mentionFilteredUsers}
            onInsertUserName={insertMention}
            onClose={closeMentionTooltip}
          />
          <EmojiTooltip
            isOpen={isEmojiTooltipOpen}
            emojis={filteredEmojis}
            customEmojis={filteredCustomEmojis}
            addRecentEmoji={addRecentEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onEmojiSelect={insertEmoji}
            onCustomEmojiSelect={insertEmoji}
            onClose={closeEmojiTooltip}
          />
          <CustomEmojiTooltip
            chatId={chatId}
            isOpen={isCustomEmojiTooltipOpen}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onCustomEmojiSelect={insertCustomEmoji}
            onClose={closeCustomEmojiTooltip}
          />
          <div className={styles.caption}>
            <SymbolMenuButton
              chatId={chatId}
              threadId={threadId}
              isMobile={isMobile}
              isReady={isReady}
              isSymbolMenuOpen={isSymbolMenuOpen}
              openSymbolMenu={openSymbolMenu}
              closeSymbolMenu={closeSymbolMenu}
              onCustomEmojiSelect={onCustomEmojiSelect}
              onRemoveSymbol={onRemoveSymbol}
              onEmojiSelect={onEmojiSelect}
              isAttachmentModal
              canSendPlainText
              className="attachment-modal-symbol-menu with-menu-transitions"
              idPrefix="attachment"
              forceDarkTheme={forceDarkTheme}
            />
            <MessageInput
              ref={inputRef}
              id={ATTACHMENT_MODAL_INPUT_ID}
              chatId={chatId}
              threadId={threadId}
              isAttachmentModalInput
              customEmojiPrefix="attachment"
              isReady={isReady}
              isActive={isOpen}
              getHtml={getHtml}
              editableInputId={EDITABLE_INPUT_MODAL_ID}
              placeholder={oldLang('AddCaption')}
              onUpdate={onCaptionUpdate}
              onSend={handleSendClick}
              onScroll={handleCaptionScroll}
              canAutoFocus={Boolean(isReady && isForCurrentMessageList && attachments.length)}
              captionLimit={leftChars}
              shouldSuppressFocus={isMobile && isSymbolMenuOpen}
              onSuppressedFocus={closeSymbolMenu}
            />
            <div className={styles.sendWrapper}>
              <Button
                ref={mainButtonRef}
                className={styles.send}
                size="smaller"
                onClick={handleSendClick}
                onContextMenu={canShowCustomSendMenu ? handleContextMenu : undefined}
              >
                {shouldSchedule && !editingMessage ? oldLang('Next')
                  : editingMessage ? oldLang('Save') : buttonSendCaption}
              </Button>
              {canShowCustomSendMenu && (
                <CustomSendMenu
                  isOpen={isCustomSendMenuOpen}
                  canSchedule={canSchedule && isForMessage}
                  onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
                  onSendSchedule={handleScheduleClick}
                  onClose={handleContextMenuClose}
                  onCloseAnimationEnd={handleContextMenuHide}
                  isSavedMessages={isChatWithSelf}
                  onSendWhenOnline={onSendWhenOnline}
                  canScheduleUntilOnline={canScheduleUntilOnline}
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
  (global, { chatId }): Complete<StateProps> => {
    const {
      currentUserId,
      recentEmojis,
      customEmojis,
      attachmentSettings,
    } = global;

    const { shouldSaveAttachmentsCompression } = selectTabState(global);
    const chatFullInfo = selectChatFullInfo(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const { shouldSuggestCustomEmoji } = global.settings.byKey;
    const { language } = selectSharedSettings(global);
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;

    return {
      isChatWithSelf,
      currentUserId,
      groupChatMembers: chatFullInfo?.members,
      recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      shouldSuggestCustomEmoji,
      customEmojiForEmoji: customEmojis.forEmoji.stickers,
      captionLimit: selectCurrentLimit(global, 'captionLength'),
      attachmentSettings,
      shouldSaveAttachmentsCompression,
    };
  },
)(AttachmentModal));
