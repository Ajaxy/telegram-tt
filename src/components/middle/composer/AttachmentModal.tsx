import { memo, type StateHookSetter, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAttachment, ApiChatMember, ApiMessage, ApiSticker,
} from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { MessageListType, ThreadId } from '../../../types';
import type { RichEditorTooltipsConfig } from '../../common/tooltips/types';
import type { RichEditor } from './richEditorTypes';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EDITABLE_INPUT_MODAL_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getAttachmentMediaType } from '../../../global/helpers';
import {
  selectCanSetVideoCover, selectChatFullInfo, selectIsChatWithSelf, selectIsCurrentUserPremium, selectTabState,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { selectLanguageCode } from '../../../global/selectors/settings';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import calcTextLineHeightAndCount from '../../../util/element/calcTextLineHeightAndCount';
import { validateFiles } from '../../../util/files';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { removeAllSelections } from '../../../util/selection';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import { getAttachedStickers } from '../../ui/mediaEditor/editDocument';
import { checkCanEncodeVideo } from '../../ui/mediaEditor/export/videoCapabilities';
import { fetchVideoProbe } from '../../ui/mediaEditor/export/videoProbe';
import { getGifLevel, getOutputSize } from '../../ui/mediaEditor/export/videoQuality';
import { buildRichMessageFromFormatted, getRichInputAsFormatted } from '../../ui/textInput/richText';
import buildAttachment, { applyVideoEdit } from './helpers/buildAttachment';
import getFilesFromDataTransferItems from './helpers/getFilesFromDataTransferItems';
import { getRichMessageText } from './helpers/richEditorComposer';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useResizeObserver from '../../../hooks/useResizeObserver';

import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MediaEditor, { type MediaEditorResult } from '../../ui/mediaEditor/MediaEditor';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';
import AttachmentModalItem from './AttachmentModalItem';
import CustomSendMenu from './CustomSendMenu.async';
import MessageInput from './MessageInput.async';
import SymbolMenuButton from './SymbolMenuButton';

import styles from './AttachmentModal.module.scss';

export type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  richEditor: RichEditor;
  attachments: ApiAttachment[];
  editingMessage?: ApiMessage;
  messageListType?: MessageListType;
  canShowCustomSendMenu?: boolean;
  isReady: boolean;
  isForMessage?: boolean;
  shouldSchedule?: boolean;
  shouldForceCompression?: boolean;
  shouldForceAsFile?: boolean;
  isForCurrentMessageList?: boolean;
  forceDarkTheme?: boolean;
  canScheduleUntilOnline?: boolean;
  canSchedule?: boolean;
  canSendGifs?: boolean;
  paidMessagesStars?: number;
  onSend: (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => void;
  onFileAppend: (files: File[], isSpoiler?: boolean) => void;
  onAttachmentsUpdate: StateHookSetter<ApiAttachment[]>;
  onClear: NoneToVoidFunction;
  onSendSilent: (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => void;
  onSendScheduled: (
    sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true,
    scheduledAt?: number, scheduleRepeatPeriod?: number,
  ) => void;
  onSendWhenOnline?: NoneToVoidFunction;
};

type StateProps = {
  isChatWithSelf?: boolean;
  currentUserId?: string;
  groupChatMembers?: ApiChatMember[];
  recentEmojis: string[];
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  shouldSuggestCustomEmoji?: boolean;
  topGuestBotIds?: string[];
  captionLimit: number;
  attachmentSettings: GlobalState['attachmentSettings'];
  shouldSaveAttachmentsCompression?: boolean;
  shouldOpenMessageMediaEditor?: boolean;
  messageMediaEditorVideoTime?: number;
  aiMessageEditorPendingResult?: TabState['aiMessageEditorPendingResult'];
  isCurrentUserPremium?: boolean;
  canSetVideoCover?: boolean;
};

const ATTACHMENT_MODAL_INPUT_ID = 'caption-input-text';
const VIDEO_ENCODER_CHECK_SIZE = { width: 1920, height: 1080 };
const DROP_LEAVE_TIMEOUT_MS = 150;
const CLOSE_MENU_ANIMATION_DURATION = 200;

const AttachmentModal = ({
  chatId,
  threadId,
  richEditor,
  attachments,
  editingMessage,
  canShowCustomSendMenu,
  captionLimit,
  isReady,
  isChatWithSelf,
  currentUserId,
  groupChatMembers,
  topGuestBotIds,
  recentEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  isCurrentUserPremium,
  isForMessage,
  shouldSchedule,
  shouldSuggestCustomEmoji,
  attachmentSettings,
  shouldSaveAttachmentsCompression,
  shouldForceCompression,
  shouldForceAsFile,
  isForCurrentMessageList,
  forceDarkTheme,
  canScheduleUntilOnline,
  canSchedule,
  canSendGifs,
  paidMessagesStars,
  shouldOpenMessageMediaEditor,
  messageMediaEditorVideoTime,
  aiMessageEditorPendingResult,
  canSetVideoCover,
  onAttachmentsUpdate,
  onSend,
  onFileAppend,
  onClear,
  onSendSilent,
  onSendScheduled,
  onSendWhenOnline,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>();
  const {
    addRecentCustomEmoji, addRecentEmoji, updateAttachmentSettings, resetMessageMediaEditorRequest,
    updateShouldSaveAttachmentsCompression, openAiMessageEditorModal, clearAiMessageEditorPendingResult,
  } = getActions();

  const lang = useLang();
  const richValue = richEditor.value;

  const mainButtonRef = useRef<HTMLButtonElement>();
  const inputRef = useRef<HTMLDivElement>();
  const captionRef = useRef<HTMLDivElement>();
  const attachmentsRef = useRef<HTMLDivElement>();

  const hideTimeoutRef = useRef<number>();
  const prevAttachments = usePreviousDeprecated(attachments);
  const renderingAttachments = attachments.length ? attachments : prevAttachments;
  const { isMobile } = useAppLayout();

  const isEditing = editingMessage && Boolean(editingMessage);
  const isInAlbum = editingMessage && editingMessage?.groupedId;
  const isEditingMessageFile = isEditing && attachments?.length && getAttachmentMediaType(attachments[0]);
  const notEditingFile = isEditingMessageFile !== 'file';
  const hasGifFromPicker = renderingAttachments?.some((a) => a.gif);

  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | undefined>(undefined);
  const [hasEditorGhost, setHasEditorGhost] = useState<boolean | undefined>();
  const [editorVideoTime, setEditorVideoTime] = useState<number | undefined>();
  // `true` when the modal was opened straight into the editor (from the Media Viewer / reply), so the
  // attachment only exists to be edited — cancelling the editor should dismiss the whole modal.
  const wasOpenedAsEditorRef = useRef(false);
  const [shouldShowAiButton, setShouldShowAiButton] = useState(false);
  const richText = useMemo(() => getRichMessageText(richValue), [richValue]);
  const editingAttachment = editingAttachmentIndex !== undefined
    ? attachments[editingAttachmentIndex] : undefined;
  const editorSource = useMemo(() => (editingAttachment ? {
    blobUrl: editingAttachment.sourceBlobUrl ?? editingAttachment.blobUrl,
    mimeType: editingAttachment.mimeType,
    filename: editingAttachment.filename,
  } : undefined), [editingAttachment]);
  const editorSourceSizeHint = editingAttachment && !editingAttachment.editState
    ? editingAttachment.sourceDimensions ?? editingAttachment.quick : undefined;

  useEffect(() => {
    if (shouldOpenMessageMediaEditor && attachments.length) {
      setEditingAttachmentIndex(0);
      setHasEditorGhost(undefined);
      setEditorVideoTime(messageMediaEditorVideoTime);
      wasOpenedAsEditorRef.current = true;
      resetMessageMediaEditorRequest();
    }
  }, [shouldOpenMessageMediaEditor, attachments.length, messageMediaEditorVideoTime]);

  const shouldSendCompressed = attachmentSettings.shouldCompress;
  const isSendingCompressed = Boolean(
    (shouldSendCompressed || shouldForceCompression || isInAlbum || hasGifFromPicker) && !shouldForceAsFile,
  );
  const [shouldSendGrouped, setShouldSendGrouped] = useState(attachmentSettings.shouldSendGrouped);
  const [canEncodeVideo, setCanEncodeVideo] = useState<boolean | undefined>();
  const hasVideoAttachments = attachments.some(({ mimeType }) => SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType));
  useEffect(() => {
    if (!hasVideoAttachments || canEncodeVideo !== undefined) return;
    void checkCanEncodeVideo(VIDEO_ENCODER_CHECK_SIZE).then(setCanEncodeVideo);
  }, [hasVideoAttachments, canEncodeVideo]);

  useEffect(() => {
    if (isMobile) return;

    attachments.forEach(({
      mimeType, blobUrl, sourceBlobUrl, quick, editState,
    }) => {
      if (!blobUrl || !SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) return;

      void fetchVideoProbe(sourceBlobUrl ?? blobUrl);
      if (quick && !editState) void checkCanEncodeVideo(getOutputSize(quick, 'transcode'));
    });
  }, [attachments, isMobile]);

  // A picker GIF is sent by its server reference, so edits would be lost
  const getCanEditAttachment = (attachment: ApiAttachment) => !attachment.gif && (
    !SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType) || canEncodeVideo !== false
    || Boolean(canSetVideoCover && isSendingCompressed)
    || Boolean(attachment.quick && !getGifLevel(attachment.quick))
  );

  const shouldShowGifSeparateHint = shouldSendGrouped && isSendingCompressed && attachments.length > 1
    && attachments.some(({ shouldSendAsGif }) => shouldSendAsGif);
  const isInvertedMedia = attachmentSettings.isInvertedMedia;
  const [shouldSendInHighQuality, setShouldSendInHighQuality] = useState(
    attachmentSettings.shouldSendInHighQuality,
  );
  const [renderingShouldSendInHighQuality, setRenderingShouldSendInHighQuality] = useState(shouldSendInHighQuality);

  const isOpen = Boolean(attachments.length);
  const { observe: observeIntersection } = useIntersectionObserver({ rootRef: attachmentsRef, isDisabled: !isOpen });
  const renderingIsOpen = Boolean(renderingAttachments?.length);
  const hasPreparingAttachments = attachments.some(({ isPreparing }) => isPreparing);
  const [isHovered, markHovered, unmarkHovered] = useFlag();

  const timerRef = useRef<number | undefined>();

  useEffect(() => {
    if (!isOpen) {
      closeSymbolMenu();
      updateAttachmentSettings({ isInvertedMedia: undefined });
    }
  }, [closeSymbolMenu, isOpen]);

  useEffect(() => {
    if (hasGifFromPicker) {
      updateShouldSaveAttachmentsCompression({ shouldSave: false });
      setShouldSendGrouped(false);
    }
  }, [hasGifFromPicker, updateShouldSaveAttachmentsCompression]);

  const [hasMedia, hasOnlyMedia] = useMemo(() => {
    const onlyMedia = Boolean(renderingAttachments?.every((a) => a.quick || a.audio));
    if (onlyMedia) return [true, true];
    const oneMedia = Boolean(renderingAttachments?.some((a) => a.quick || a.audio));
    return [oneMedia, false];
  }, [renderingAttachments]);

  const areAllItemsAudio = useMemo(() => (
    Boolean(renderingAttachments?.length
      && renderingAttachments.every((a) => SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType)))
  ), [renderingAttachments]);

  const [hasSpoiler, isEverySpoiler] = useMemo(() => {
    const areAllSpoilers = Boolean(renderingAttachments?.every((a) => a.shouldSendAsSpoiler));
    if (areAllSpoilers) return [true, true];
    const hasOneSpoiler = Boolean(renderingAttachments?.some((a) => a.shouldSendAsSpoiler));
    return [hasOneSpoiler, false];
  }, [renderingAttachments]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    richEditor.insertContent({ type: 'customEmoji', emoji });
  });

  const handleRemoveSymbol = useLastCallback(() => {
    richEditor.deleteCharacterBeforeSelection();
  });

  const handleEmojiSelect = useLastCallback((emoji: string) => {
    richEditor.insertContent({ type: 'text', text: emoji });
  });

  const getTooltipBoundary = useLastCallback(() => captionRef.current);
  const getRichEditorTooltipContext = useLastCallback(() => ({
    chatId,
    threadId,
    currentUserId,
    groupChatMembers,
    topGuestBotIds,
    recentEmojiIds: recentEmojis,
    baseEmojiKeywords,
    emojiKeywords,
    isCurrentUserPremium,
  }));
  const getIsCaptionTooltipEnabled = useLastCallback(() => Boolean(
    isReady && (isForCurrentMessageList || !isForMessage) && renderingIsOpen,
  ));
  const getIsCaptionCustomEmojiEnabled = useLastCallback(() => Boolean(
    getIsCaptionTooltipEnabled() && shouldSuggestCustomEmoji,
  ));
  const getIsCaptionMentionEnabled = useLastCallback(() => Boolean(
    isReady && (isForCurrentMessageList || !isForMessage) && renderingIsOpen,
  ));
  const richEditorTooltips = useMemo<RichEditorTooltipsConfig>(() => ({
    emoji: {
      isEnabled: getIsCaptionTooltipEnabled,
      addRecentEmoji,
      addRecentCustomEmoji,
    },
    customEmoji: {
      isEnabled: getIsCaptionCustomEmojiEnabled,
      addRecentCustomEmoji,
    },
    mention: { isEnabled: getIsCaptionMentionEnabled },
    formatter: {
      isEnabled: getIsCaptionTooltipEnabled,
      capabilities: 'basic',
    },
    getTooltipBoundary,
    getContext: getRichEditorTooltipContext,
  }), [
    addRecentCustomEmoji, addRecentEmoji, getIsCaptionCustomEmojiEnabled,
    getIsCaptionMentionEnabled, getIsCaptionTooltipEnabled, getRichEditorTooltipContext, getTooltipBoundary,
  ]);

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
  } = useContextMenuHandlers(
    mainButtonRef, !canShowCustomSendMenu || !isOpen || hasPreparingAttachments,
  );

  useEffect(() => {
    requestMeasure(() => {
      const input = inputRef.current;
      if (!isForMessage || !richText || !input) {
        setShouldShowAiButton(false);
        return;
      }
      const { totalLines } = calcTextLineHeightAndCount(input, true);
      setShouldShowAiButton(totalLines >= 3);
    });
  }, [isForMessage, richText, isOpen]);

  const handleOpenAiEditor = useLastCallback(() => {
    if (!isForMessage) return;
    const { text, entities } = richValue ? getRichInputAsFormatted(richValue) || { text: '' } : { text: '' };
    openAiMessageEditorModal({
      chatId,
      threadId,
      content: { type: 'text', text: { text, entities } },
      isFromAttachment: true,
      isEditing: Boolean(editingMessage),
    });
  });

  const sendAttachments = useLastCallback((
    isSilent?: boolean, scheduledAt?: number | true, scheduleRepeatPeriod?: number,
  ) => {
    if (!isOpen || hasPreparingAttachments) return;

    const shouldSendScheduled = (shouldSchedule || scheduledAt) && isForMessage && !editingMessage;
    if (shouldSendScheduled) {
      const actualScheduledAt = typeof scheduledAt === 'number' ? scheduledAt : undefined;
      onSendScheduled(isSendingCompressed, shouldSendGrouped, isInvertedMedia, actualScheduledAt, scheduleRepeatPeriod);
    } else if (isSilent) {
      onSendSilent(isSendingCompressed, shouldSendGrouped, isInvertedMedia);
    } else {
      onSend(isSendingCompressed, shouldSendGrouped, isInvertedMedia);
    }

    updateAttachmentSettings({
      ...(shouldSaveAttachmentsCompression && {
        defaultAttachmentCompression: attachmentSettings.shouldCompress ? 'compress' : 'original',
      }),
      shouldSendGrouped,
      isInvertedMedia,
      shouldSendInHighQuality,
    });
  });

  const handleSendWithAiResult = useLastCallback(() => {
    if (!isForMessage || !aiMessageEditorPendingResult?.shouldSendWithAttachments
      || !isOpen || hasPreparingAttachments) return;
    if (aiMessageEditorPendingResult.chatId !== chatId || aiMessageEditorPendingResult.threadId !== threadId) return;

    const { content, isSilent, scheduledAt, scheduleRepeatPeriod } = aiMessageEditorPendingResult;

    if (content.type === 'text') {
      richEditor.setValue(buildRichMessageFromFormatted(content.text));
    }

    sendAttachments(isSilent, scheduledAt, scheduleRepeatPeriod);
    clearAiMessageEditorPendingResult();
  });

  useEffect(() => {
    handleSendWithAiResult();
  }, [aiMessageEditorPendingResult, hasPreparingAttachments, handleSendWithAiResult]);

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
    const { sourceBlobUrl } = attachments[index];
    if (sourceBlobUrl) URL.revokeObjectURL(sourceBlobUrl);
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

  const handleEdit = useLastCallback((index: number, hasGhost?: boolean, videoTime?: number) => {
    setEditingAttachmentIndex(index);
    setHasEditorGhost(hasGhost);
    setEditorVideoTime(videoTime);
  });

  const handleCloseEditor = useLastCallback(() => {
    setEditingAttachmentIndex(undefined);
    // Exiting the editor without applying: if the modal only existed to host it, close it entirely
    if (wasOpenedAsEditorRef.current) {
      wasOpenedAsEditorRef.current = false;
      onClear();
    }
  });

  const handleApplyEdit = useLastCallback(async (result: MediaEditorResult) => {
    if (editingAttachmentIndex === undefined || result.kind === 'avatar') return;

    wasOpenedAsEditorRef.current = false;
    setEditingAttachmentIndex(undefined);

    const editedAttachment = attachments[editingAttachmentIndex];
    const newAttachment = result.kind === 'photo'
      ? await buildAttachment(result.file.name, result.file, {
        shouldSendAsFile: editedAttachment.shouldSendAsFile,
        shouldSendAsSpoiler: editedAttachment.shouldSendAsSpoiler,
        shouldSendInHighQuality: editedAttachment.shouldSendInHighQuality,
        sourceBlobUrl: editedAttachment.sourceBlobUrl ?? editedAttachment.blobUrl,
        editState: result.editState,
        videoProcessing: result.gifProcessing,
        shouldSendAsGif: result.gifProcessing ? true : undefined,
        attachedStickers: getAttachedStickers(result.editState.document),
      })
      : applyVideoEdit(editedAttachment, result);

    onAttachmentsUpdate((currentAttachments) => currentAttachments.map((attachment) => (
      attachment.uniqueId === editedAttachment.uniqueId ? newAttachment : attachment
    )));
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
  }, [lang, isOpen]);

  const MoreMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }: { isOpen?: boolean; onTrigger: () => void }) => (
      <Button
        round
        ripple={!isMobile}
        size="tiny"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel={lang('AccDescrMoreOptions')}
        iconName="more"
      />
    );
  }, [isMobile, lang]);

  const isQuickGallery = isSendingCompressed && hasOnlyMedia;

  const shouldPreviewAsFile = !isSendingCompressed || areAllItemsAudio;

  const {
    areAllPhotos, areAllVideos, areAllAudios, hasAnyPhoto,
  } = useMemo(() => {
    if (!isQuickGallery || !renderingAttachments) {
      return {
        areAllPhotos: false,
        areAllVideos: false,
        areAllAudios: false,
        hasAnyPhoto: false,
      };
    }
    return {
      areAllPhotos: renderingAttachments.every((a) => (
        SUPPORTED_PHOTO_CONTENT_TYPES.has(a.mimeType) && !a.shouldSendAsGif
      )),
      areAllVideos: renderingAttachments.every((a) => (
        SUPPORTED_VIDEO_CONTENT_TYPES.has(a.mimeType) || a.shouldSendAsGif
      )),
      areAllAudios: renderingAttachments.every((a) => SUPPORTED_AUDIO_CONTENT_TYPES.has(a.mimeType)),
      hasAnyPhoto: renderingAttachments.some((a) => (
        SUPPORTED_PHOTO_CONTENT_TYPES.has(a.mimeType) && !a.shouldSendAsGif
      )),
    };
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
    title = lang(
      `Attachment${isEditing ? 'Replace' : 'Send'}Photo`,
      { count: attachmentsLength },
      { pluralValue: attachmentsLength },
    );
  } else if (areAllVideos) {
    title = lang(
      `Attachment${isEditing ? 'Replace' : 'Send'}Video`,
      { count: attachmentsLength },
      { pluralValue: attachmentsLength },
    );
  } else if (areAllAudios) {
    title = lang(
      `Attachment${isEditing ? 'Replace' : 'Send'}Audio`,
      { count: attachmentsLength },
      { pluralValue: attachmentsLength },
    );
  } else {
    title = lang(
      `Attachment${isEditing ? 'Replace' : 'Send'}File`,
      { count: attachmentsLength },
      { pluralValue: attachmentsLength },
    );
  }

  function renderHeader() {
    if (!renderingAttachments) {
      return undefined;
    }

    return (
      <div className="modal-header-condensed-wide" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel={lang('AriaCloseAttachmentModal')}
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
              {Boolean(!editingMessage) && !hasGifFromPicker && (
                <MenuItem icon="add" onClick={handleDocumentSelect}>{lang('Add')}</MenuItem>
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
                    !shouldForceAsFile && !shouldForceCompression && !hasGifFromPicker && !areAllItemsAudio
                    && (isSendingCompressed ? (

                      <MenuItem icon="document" onClick={handleToggleShouldCompress}>
                        {lang(isMultiple ? 'AttachmentMenuSendAllAsFiles' : 'AttachmentMenuSendAsFiles')}
                      </MenuItem>
                    ) : (

                      <MenuItem icon="media" onClick={handleToggleShouldCompress}>
                        {lang(isMultiple ? 'AttachmentMenuSendAllAsMedia' : 'AttachmentMenuSendAsMedia')}
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
                        {lang('AttachmentMenuDisableSpoiler')}
                      </MenuItem>
                    ) : (
                      <MenuItem icon="spoiler" onClick={handleEnableSpoilers}>
                        {lang('AttachmentMenuEnableSpoiler')}
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
                    {lang('AttachmentMenuUngroupAllMedia')}
                  </MenuItem>
                ) : (

                  <MenuItem icon="grouped" onClick={() => setShouldSendGrouped(true)}>
                    {lang('AttachmentMenuGroupAllMedia')}
                  </MenuItem>
                )
              )}
            </DropdownMenu>
          )}
      </div>
    );
  }

  const paidSendButtonCaption = paidMessagesStars ? formatStarsAsIcon(
    lang,
    attachmentsLength * paidMessagesStars,
    {
      asFont: true,
    },
  ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      header={renderHeader()}
      className={buildClassName(
        styles.root,
        isHovered && styles.hovered,
        isMobile && styles.mobile,
        isSymbolMenuOpen && styles.symbolMenuOpen,
        editingAttachment && styles.editorActive,
        forceDarkTheme && 'component-theme-dark',
      )}
      hasAbsoluteCloseButton={Boolean(renderingAttachments)}
      noBackdropClose
      isLowStackPriority
      noFreezeOnClose
      onClose={onClear}
    >
      <div
        className={styles.dropTarget}
        onDragEnter={markHovered}
        onDrop={handleFilesDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={unmarkHovered}
        data-attach-description={lang('AttachmentDragAddItems')}
        data-dropzone
      >
        <svg className={styles.dropOutlineContainer}>
          <rect className={styles.dropOutline} x="0" y="0" width="100%" height="100%" rx="8" />
        </svg>
        <div
          ref={attachmentsRef}
          className={buildClassName(
            styles.attachments,
            'custom-scroll',
            shouldPreviewAsFile && styles.asFile,
          )}
        >
          {renderingAttachments.map((attachment, i) => (
            <AttachmentModalItem
              attachment={attachment}
              shouldDisplayCompressed={isSendingCompressed}
              shouldDisplayGrouped={shouldSendGrouped}
              isSingle={renderingAttachments.length === 1}
              isEditing={hasEditorGhost && i === editingAttachmentIndex}
              index={i}
              key={attachment.uniqueId}
              observeIntersection={observeIntersection}
              onDelete={handleDelete}
              onToggleSpoiler={handleToggleSpoiler}
              onEdit={!isMobile && getCanEditAttachment(attachment) ? handleEdit : undefined}
            />
          ))}
        </div>
        {shouldShowGifSeparateHint && (
          <div className={styles.gifSeparateHint}>{lang('AttachmentGifSeparateHint')}</div>
        )}
        <div
          ref={captionRef}
          className={buildClassName(
            styles.captionWrapper,
          )}
        >
          <Button
            round
            size="tiny"
            color="translucent"
            tabIndex={shouldShowAiButton ? 0 : -1}
            className={buildClassName(styles.aiButton, !shouldShowAiButton && styles.aiButtonHidden)}
            onClick={handleOpenAiEditor}
            ariaLabel={lang('AiMessageEditor')}
            iconName="ai"
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
              onCustomEmojiSelect={handleCustomEmojiSelect}
              onRemoveSymbol={handleRemoveSymbol}
              onEmojiSelect={handleEmojiSelect}
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
              richEditor={richEditor}
              tooltips={richEditorTooltips}
              isAttachmentModalInput
              isActive={isOpen}
              editableInputId={EDITABLE_INPUT_MODAL_ID}
              placeholder={lang('AttachmentCaptionPlaceholder')}
              onSend={handleSendClick}
              canAutoFocus={Boolean(isReady && isForCurrentMessageList && attachments.length)}
              maxLength={captionLimit}
              shouldSuppressFocus={isMobile && isSymbolMenuOpen}
              onSuppressedFocus={closeSymbolMenu}
            />
            <div className={styles.sendWrapper}>
              <Button
                ref={mainButtonRef}
                className={styles.send}
                size="smaller"
                inline
                disabled={hasPreparingAttachments}
                onClick={handleSendClick}
                onContextMenu={canShowCustomSendMenu ? handleContextMenu : undefined}
                iconName={!editingMessage && !shouldSchedule && !paidMessagesStars ? 'new-send' : undefined}
                iconClassName={styles.sendIcon}
              >
                {shouldSchedule && !editingMessage ? lang('Next')
                  : editingMessage ? lang('Save') : paidSendButtonCaption}
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
      <MediaEditor
        isOpen={Boolean(editingAttachment)}
        source={editorSource}
        sourceSizeHint={editorSourceSizeHint}
        hasOriginGhost={hasEditorGhost}
        initialVideoTime={editorVideoTime}
        initialEditState={editingAttachment?.editState}
        initialQualityLevel={editingAttachment?.videoQualityLevel}
        canSetCover={canSetVideoCover && isSendingCompressed && !editingAttachment?.shouldSendAsFile}
        canSendGifs={canSendGifs && isSendingCompressed && !isInAlbum && !editingAttachment?.shouldSendAsFile}
        isAsFile={!isSendingCompressed}
        chatId={chatId}
        onClose={handleCloseEditor}
        onApply={handleApplyEdit}
      />
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const {
      currentUserId,
      recentEmojis,
      attachmentSettings,
    } = global;

    const {
      shouldSaveAttachmentsCompression,
      messageMediaEditorRequest,
      aiMessageEditorPendingResult,
    } = selectTabState(global);
    const chatFullInfo = selectChatFullInfo(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const { shouldSuggestCustomEmoji } = global.settings.byKey;
    const language = selectLanguageCode(global);
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;

    return {
      isChatWithSelf,
      currentUserId,
      groupChatMembers: chatFullInfo?.members,
      topGuestBotIds: global.topPeerCategories.botsGuestChat?.peerIds,
      recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      shouldSuggestCustomEmoji,
      captionLimit: selectCurrentLimit(global, 'captionLength'),
      attachmentSettings,
      shouldSaveAttachmentsCompression,
      shouldOpenMessageMediaEditor: messageMediaEditorRequest?.chatId === chatId,
      messageMediaEditorVideoTime: messageMediaEditorRequest?.chatId === chatId
        ? messageMediaEditorRequest.videoTime : undefined,
      aiMessageEditorPendingResult,
      canSetVideoCover: selectCanSetVideoCover(global, chatId),
    };
  },
)(AttachmentModal));
