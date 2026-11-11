import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '@teact';
import { setExtraStyles } from '@teact/teact-dom';
import { getActions, getGlobal } from '../../../global';

import type { ApiAvatarUpload } from '../../../api/types';
import type {
  CropState, DrawAction, DrawSettings, EditorLayer, MediaEditDocument, MediaEditState, TextSettings,
  VideoProcessingParams, VideoQualityLevel, VideoTrim,
} from '../../../types/mediaEditor';
import type { CancellableCallback } from '../../../util/PostMessageConnector';
import type { LayerFrames } from './render/layers';
import type { Size } from './render/transform';
import type { AvatarShape, EditorTabId, VideoQualityControl } from './types';

import {
  AVATAR_VIDEO_MAX_DURATION,
  AVATAR_VIDEO_MAX_FRAME_RATE,
  MAX_EDITABLE_VIDEO_OUTPUT_SIZE,
  MAX_EDITABLE_VIDEO_PIXELS,
  MAX_EDITABLE_VIDEO_SOURCE_SIZE,
  MIN_TRIMMABLE_VIDEO_DURATION,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  VIDEO_COVER_JPEG_QUALITY,
  VIDEO_COVER_MAX_SIDE,
  VIDEO_GIF_MAX_SOURCE_SIZE,
  VIDEO_THUMB_MAX_SIDE,
} from '../../../config';
import { requestForcedReflow, requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { selectAnimationLevel } from '../../../global/selectors/sharedState';
import { selectCanAnimateInterface } from '../../../global/selectors/ui';
import { selectCurrentUserId } from '../../../global/selectors/users';
import { areRecordsShallowEqual } from '../../../util/areShallowEqual';
import { getEditStateCoverUrls } from '../../../util/attachments';
import { IS_WINDOWS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getPointerPosition from '../../../util/events/getPointerPosition';
import isTextInputTarget from '../../../util/events/isTextInputTarget';
import { blobToFile, fetchBlob } from '../../../util/files';
import forceReflow from '../../../util/forceReflow';
import generateUniqueId from '../../../util/generateUniqueId';
import { omit } from '../../../util/iteratees';
import { cancelVideoProcessing, requestVideoProcessing } from '../../../util/launchVideoProcessingWorker';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { formatFileSize } from '../../../util/text/textFormat';
import { exportEditedMedia } from '../../../util/videoProcessingQueue';
import { REM } from '../../common/helpers/mediaDimensions';
import {
  discardMediaEditorGhost,
  fadeOutMediaEditorGhost,
  getMediaViewerMedia,
  landGhostInMediaEditor,
  prepareMediaEditorGhost,
} from '../../mediaViewer/helpers/ghostAnimation';
import { renderCoverImage } from './export/exportCover';
import { exportImage, getExtensionFromMimeType } from './export/exportImage';
import { renderVideoElementFrame } from './export/renderVideoElementFrame';
import { checkCanEncodeVideo } from './export/videoCapabilities';
import {
  estimateVideoSize,
  getAudioBitrateEstimate,
  getAvailableLevels,
  getAvatarSize,
  getCropSize,
  getGifLevel,
  getMaxLevel,
  getOriginalLevel,
  getOutputFrameRate,
  getOutputSize,
  getPhotoGifProcessing,
  getVideoBitrate,
} from './export/videoQuality';
import { getCanRenderAdjustments } from './render/adjustments/adjustmentsProgram';
import { hasColorAdjustments } from './render/adjustments/values';
import {
  hasAnimatedStickers, hasMissingStickerFrames, loadLayerFrames,
} from './render/layerFrames';
import { closeLayerFrames, getIsLayerVisible, TEXT_FONTS } from './render/layers';
import { computeRotationZoom, fitCropToMaxSide, getEffectiveDimensions } from './render/transform';
import { getTotalRotation } from './crop';
import {
  applyCrop, applyTrim, clampCoverTime, createAvatarVideoDocument, createEditDocument, EMPTY_EDIT_DOCUMENT,
  getVideoProcessingMode,
} from './editDocument';
import { getAvailableTabs } from './tabs';

import useSelector from '../../../hooks/data/useSelector';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import { dispatchPriorityPlaybackEvent } from '../../../hooks/usePriorityPlaybackCheck';
import useShowTransition from '../../../hooks/useShowTransition';
import useWindow from '../../../hooks/useWindow';
import { PREDEFINED_COLORS } from './hooks/useColorPicker';
import useCropper from './hooks/useCropper';
import useDisplaySize from './hooks/useDisplaySize';
import useDrawing, { DEFAULT_BRUSH_SIZE } from './hooks/useDrawing';
import useEditHistory from './hooks/useEditHistory';
import useEditorPreview from './hooks/useEditorPreview';
import useMediaSource, { getKnownMediaSize } from './hooks/useMediaSource';
import useVideoPlayback from './hooks/useVideoPlayback';

import Icon from '../../common/icons/Icon';
import Button from '../Button';
import ConfirmDialog from '../ConfirmDialog';
import FloatingActionButton from '../FloatingActionButton';
import Portal from '../Portal';
import ShowTransition from '../ShowTransition';
import Spinner from '../Spinner';
import TabList from '../TabList';
import Transition from '../Transition';
import CropOverlay from './canvas/CropOverlay';
import LayersOverlay from './canvas/LayersOverlay';
import RotationSlider from './canvas/RotationSlider';
import VideoControls from './video/VideoControls';

import styles from './MediaEditor.module.scss';

type MediaEditorSource = {
  blobUrl: string;
  mimeType: string;
  filename: string;
};

export type MediaEditorResult = {
  kind: 'photo';
  file: File;
  editState: MediaEditState;
  gifProcessing?: VideoProcessingParams;
} | {
  kind: 'video';
  editState: MediaEditState;
  processing?: VideoProcessingParams;
  qualityLevel?: VideoQualityLevel;
  outputSize: Size;
  outputDuration: number;
  previewBlob?: Blob;
  cover?: { blob: Blob; width: number; height: number };
  isGif?: boolean;
} | {
  kind: 'avatar';
  avatar: ApiAvatarUpload;
};

export type OwnProps = {
  isOpen: boolean;
  source?: MediaEditorSource;
  sourceSizeHint?: Size;
  hasOriginGhost?: boolean;
  initialVideoTime?: number;
  initialEditState?: MediaEditState;
  initialQualityLevel?: VideoQualityLevel;
  canSetCover?: boolean;
  canSendGifs?: boolean;
  isAsFile?: boolean;
  lockedAspectRatio?: number;
  avatarShape?: AvatarShape;
  isOwnAvatar?: boolean;
  initialCoverTime?: number;
  chatId?: string;
  onClose: VoidFunction;
  onApply: (result: MediaEditorResult) => void;
};

type VideoFrameRequest = {
  time: number;
  doc: MediaEditDocument;
  maxSide: number;
  quality: number;
  outputFrameRate?: number;
  layerFrames?: LayerFrames;
};

type RenderedFrame = {
  blob: Blob;
  width: number;
  height: number;
  time: number;
};

type CropTransition = 'enter' | 'leave';

type TransformAnimation = { kind: 'rotate' | 'flip' };

type StartTransforms = { canvas: string; layers: string };

type GhostPhase = 'flying' | 'landed' | 'revealing' | 'done';

const DEFAULT_FRAME_RATE = 30;
const DEFAULT_DRAW_COLOR = PREDEFINED_COLORS[1];
const THUMB_QUALITY = 0.8;
const CONTROLS_RESERVED_HEIGHT = 6.5 * REM;
const VIDEO_COVER_CONTROLS_RESERVED_HEIGHT = 7 * REM;
const AVATAR_VIDEO_CONTROLS_RESERVED_HEIGHT = 13.5 * REM;
const CANVAS_ANIMATION_FALLBACK = 1000;
const QUARTER_TURN_DEGREES = 90;
const GHOST_LANDING_MAX_WAIT = 1500;
const GHOST_HOLD_MAX_WAIT = 3000;
const LOADING_MAX_WAIT = 1000;
const MUTE_NOTIFICATION_ID = 'mediaEditorMute';
const DEFAULT_TEXT_SETTINGS: TextSettings = {
  font: 'roboto', style: 'plain', align: 'center', color: '#FFFFFF', size: 0.06,
};
const DEFAULT_DRAW_SETTINGS: DrawSettings = { tool: 'pen', color: DEFAULT_DRAW_COLOR, size: DEFAULT_BRUSH_SIZE };
const EMPTY_LAYERS: EditorLayer[] = [];

function waitForCanvasAnimationEnd(
  canvas: HTMLCanvasElement, eventType: 'animationend' | 'transitionend', onEnd: NoneToVoidFunction,
) {
  const handleEnd = (e: Event) => {
    if (e.target === canvas) onEnd();
  };

  canvas.addEventListener(eventType, handleEnd);
  const timeout = window.setTimeout(onEnd, CANVAS_ANIMATION_FALLBACK);

  return () => {
    canvas.removeEventListener(eventType, handleEnd);
    clearTimeout(timeout);
  };
}

const MediaEditor = ({
  isOpen,
  source: editorSource,
  sourceSizeHint,
  hasOriginGhost,
  initialVideoTime,
  initialEditState,
  initialQualityLevel,
  canSetCover,
  canSendGifs,
  isAsFile,
  lockedAspectRatio,
  avatarShape,
  isOwnAvatar,
  initialCoverTime,
  chatId,
  onClose,
  onApply,
}: OwnProps) => {
  const {
    closeMediaViewer, showNotification, loadRecentStickers, loadFeaturedStickers, loadEmojiStickerGroups,
    updateMediaEditorSettings,
  } = getActions();

  const lang = useLang();
  const renderingWindow = useWindow();
  const animationLevel = useSelector(selectAnimationLevel);
  const canAnimateInterface = useSelector(selectCanAnimateInterface);
  const currentUserId = useSelector(selectCurrentUserId);

  const {
    ref: rootRef,
    shouldRender,
  } = useShowTransition({
    isOpen,
    withShouldRender: true,
  });

  const transitionRef = useRef<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const canvasAreaRef = useRef<HTMLDivElement>();

  const isVideo = Boolean(editorSource && SUPPORTED_VIDEO_CONTENT_TYPES.has(editorSource.mimeType));
  const isAvatar = Boolean(avatarShape);
  const fixedAspectRatio = isAvatar ? 1 : lockedAspectRatio;
  const defaultTabId: EditorTabId = fixedAspectRatio && !isVideo ? 'crop' : 'adjust';
  const [activeTabId, setActiveTabId] = useState<EditorTabId>(defaultTabId);

  const [ghostPhase, setGhostPhase] = useState<GhostPhase | undefined>();
  const [isAboveMediaViewer, setIsAboveMediaViewer] = useState(false);
  const [cropTransition, setCropTransition] = useState<CropTransition | undefined>();
  const [transformAnimation, setTransformAnimation] = useState<TransformAnimation | undefined>();
  const isTransformAnimating = Boolean(transformAnimation);
  const getStartTransformsRef = useRef<(displaySize: Size) => StartTransforms>();
  const layersFrameRef = useRef<HTMLDivElement>();
  const [drawSettings, setDrawSettings] = useState<DrawSettings>(DEFAULT_DRAW_SETTINGS);

  const editorSourceUrl = editorSource?.blobUrl;
  const { source, isError: isSourceError } = useMediaSource(
    isOpen ? editorSourceUrl : undefined, editorSource?.mimeType, initialVideoTime,
  );
  const sourceSize = useCurrentOrPrev(source?.size, true, isOpen);
  const layoutSourceSize = sourceSize
    ?? (editorSourceUrl ? getKnownMediaSize(editorSourceUrl) : undefined) ?? sourceSizeHint;
  const videoSource = source?.kind === 'video' ? source : undefined;
  const probe = videoSource?.probe;
  const duration = probe?.duration ?? videoSource?.frame.duration ?? 0;
  const frameRate = probe?.frameRate || DEFAULT_FRAME_RATE;

  const {
    doc,
    presentDoc,
    canUndo,
    canRedo,
    getDoc,
    preview,
    commit,
    undo,
    redo,
    reset,
    restore,
    getEditState,
  } = useEditHistory(EMPTY_EDIT_DOCUMENT);
  const { crop } = doc;

  const [canEncodeVideo, setCanEncodeVideo] = useState<boolean | undefined>();
  const encodedSize = layoutSourceSize && (isVideo || canSendGifs || isAvatar) ? (
    isAvatar
      ? getAvatarSize(layoutSourceSize)
      : getOutputSize(layoutSourceSize, 'transcode', isVideo ? undefined : getGifLevel(layoutSourceSize))
  ) : undefined;
  const encodedWidth = encodedSize?.width;
  const encodedHeight = encodedSize?.height;
  useEffect(() => {
    setCanEncodeVideo(undefined);
    if (!encodedWidth || !encodedHeight) return undefined;

    let isCancelled = false;
    void checkCanEncodeVideo({ width: encodedWidth, height: encodedHeight }).then((canEncode) => {
      if (!isCancelled) setCanEncodeVideo(canEncode);
    });

    return () => {
      isCancelled = true;
    };
  }, [encodedWidth, encodedHeight]);

  const isVideoTooLarge = Boolean(videoSource && (
    videoSource.blob.size > MAX_EDITABLE_VIDEO_SOURCE_SIZE
    || videoSource.size.width * videoSource.size.height > MAX_EDITABLE_VIDEO_PIXELS
  ));
  const isAudioUnsupported = probe?.audioHandling === 'unsupported';
  const canProcessVideo = Boolean(
    probe?.canDecodeVideo && canEncodeVideo && !isVideoTooLarge && (!isAudioUnsupported || doc.isMuted),
  );
  const isVideoSupportPending = isVideo && !isSourceError && (!videoSource || canEncodeVideo === undefined);
  const shouldShowProcessingTools = canProcessVideo || isVideoSupportPending;
  const canConvertToGif = Boolean(isVideo && canSendGifs && probe && videoSource && (
    !getGifLevel(videoSource.size) || (probe.canDecodeVideo && canEncodeVideo && !isVideoTooLarge)
  ));
  const isTooLargeForGif = Boolean(videoSource && videoSource.blob.size > VIDEO_GIF_MAX_SOURCE_SIZE);
  const canSendAsGif = canConvertToGif && !isTooLargeForGif;
  const isGif = Boolean(canSendAsGif && doc.isGif);
  const canPhotoAnimate = Boolean(!isVideo && (canSendGifs || isAvatar) && canEncodeVideo !== false);

  const canAddStickers = Boolean(chatId || (isAvatar && currentUserId));
  const availableTabs = useMemo(() => getAvailableTabs({
    isVideo, canProcessVideo: shouldShowProcessingTools, canAddStickers,
  }), [isVideo, shouldShowProcessingTools, canAddStickers]);
  const activeTab = availableTabs.find((tab) => tab.id === activeTabId) || availableTabs[0];
  const activeTabIndex = availableTabs.indexOf(activeTab);
  const isCropMode = Boolean(activeTab.isCropMode);
  const isCropView = isCropMode || cropTransition === 'leave';
  const isDrawMode = activeTab.id === 'draw';
  const canDraw = isDrawMode && !isCropView;
  const isAdjustMode = activeTab.id === 'adjust';
  const isTextMode = activeTab.id === 'text';
  const isLayerMode = isTextMode || activeTab.id === 'stickers';
  const isCoverAvailable = Boolean(isVideo && canSetCover && !isGif);
  const reservedHeight = isVideo && isAvatar ? AVATAR_VIDEO_CONTROLS_RESERVED_HEIGHT
    : isVideo && canSetCover ? VIDEO_COVER_CONTROLS_RESERVED_HEIGHT : CONTROLS_RESERVED_HEIGHT;
  const canAnimate = animationLevel > 0 && canAnimateInterface;

  const tabs = useMemo(() => availableTabs.map((tab) => ({
    title: <Icon name={tab.icon} role="img" ariaLabel={lang(tab.labelKey)} />,
  })), [availableTabs, lang]);

  useEffect(() => (isOpen ? dispatchPriorityPlaybackEvent() : undefined), [isOpen]);

  useEffect(() => {
    if (!isOpen || !canAddStickers) return;

    loadRecentStickers();
    loadFeaturedStickers();
    loadEmojiStickerGroups();
  }, [isOpen, canAddStickers]);

  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [isDiscardDialogOpen, openDiscardDialog, closeDiscardDialog] = useFlag();
  const initialDocRef = useRef<MediaEditDocument>();
  const hasAdjustments = hasColorAdjustments(doc);
  const previewDoc = useMemo(() => (
    isShowingOriginal ? { ...doc, adjustments: undefined, tint: undefined, curves: undefined } : doc
  ), [doc, isShowingOriginal]);

  const [textSettings, setTextSettings] = useState<TextSettings>(DEFAULT_TEXT_SETTINGS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | undefined>();
  const [editingLayerId, setEditingLayerId] = useState<string | undefined>();
  const editingLayerIdRef = useRef<string>();
  const layers = doc.layers ?? EMPTY_LAYERS;
  const selectedText = layers.find((layer) => layer.id === selectedLayerId)?.text;
  const panelTextSettings = useMemo(
    () => (selectedText ? omit(selectedText, ['value']) : textSettings),
    [selectedText, textSettings],
  );

  const [coverImageSource, setCoverImageSource] = useState<MediaEditorSource | undefined>();
  const [coverThumbUrl, setCoverThumbUrl] = useState<string | undefined>();
  const createdCoverUrlsRef = useRef<string[]>([]);
  const sessionTokenRef = useRef(0);
  const [isExporting, setIsExporting] = useState(false);
  const exportCallbackRef = useRef<CancellableCallback>();

  const canMute = Boolean(probe && videoSource && !isAvatar);
  const isAvatarVideoBlocked = isAvatar && isVideo && !canProcessVideo;
  const isAvatarVideoUnsupported = isAvatarVideoBlocked && !isVideoSupportPending && !isSourceError && !isVideoTooLarge;
  const isRestricted = Boolean(
    probe && !isVideoSupportPending && !canProcessVideo && !isVideoTooLarge && !isAudioUnsupported,
  );
  const restrictedNoteKey = !isRestricted ? undefined
    : isCoverAvailable && canMute ? 'VideoEditingUnsupportedCoverMute'
      : isCoverAvailable ? 'VideoEditingUnsupportedCover'
        : canMute ? 'VideoEditingUnsupportedMute' : undefined;

  const handleToggleMute = useLastCallback(() => {
    const currentDoc = getDoc();
    if (!currentDoc.isMuted) {
      commit({ ...currentDoc, isMuted: true, isGif: undefined });
      showNotification({
        localId: MUTE_NOTIFICATION_ID,
        message: canConvertToGif && isTooLargeForGif
          ? { key: 'EditorMutedGifTooLarge', variables: { size: formatFileSize(lang, VIDEO_GIF_MAX_SOURCE_SIZE, 0) } }
          : { key: 'EditorMutedHint' },
      });
    } else if (canSendAsGif && !isGif) {
      commit({ ...currentDoc, isGif: true });
      showNotification({ localId: MUTE_NOTIFICATION_ID, message: { key: 'EditorGifHint' } });
    } else {
      commit({ ...currentDoc, isMuted: undefined, isGif: undefined });
      showNotification({ localId: MUTE_NOTIFICATION_ID, message: { key: 'EditorUnmutedHint' } });
    }
  });

  const hasGhost = Boolean(hasOriginGhost && isOpen) || isAboveMediaViewer;
  const isCanvasHiddenForGhost = (hasGhost && !ghostPhase) || ghostPhase === 'flying' || ghostPhase === 'landed';
  const isGhostShown = isCanvasHiddenForGhost || ghostPhase === 'revealing';
  const [isScrubbing, startScrubbing, stopScrubbing] = useFlag();

  const {
    isPlaying,
    isPausedByUser,
    getCurrentTime,
    toggle: togglePlayback,
    seek,
  } = useVideoPlayback({
    video: videoSource?.frame,
    duration,
    frameRate,
    trim: doc.trim,
    isActive: isOpen && !isGhostShown && !coverImageSource && !isScrubbing && !isDiscardDialogOpen,
    onToggleMute: canMute ? handleToggleMute : undefined,
  });

  useEffect(() => {
    if (videoSource) videoSource.frame.muted = Boolean(doc.isMuted);
  }, [videoSource, doc.isMuted]);

  const [qualityLevel, setQualityLevel] = useState<VideoQualityLevel | undefined>();
  const cropSize = useMemo(() => getCropSize(crop), [crop]);
  const canChooseQuality = canProcessVideo && !isAsFile && !isAvatar;
  const isProcessed = videoSource ? getVideoProcessingMode(doc, videoSource.size) !== 'none' : false;
  const qualityLevels = useMemo(() => (
    canChooseQuality ? getAvailableLevels(cropSize, isProcessed) : []
  ), [canChooseQuality, cropSize, isProcessed]);
  const userQualityLevel = qualityLevel && qualityLevels.includes(qualityLevel) ? qualityLevel : undefined;
  const effectiveQualityLevel = isGif ? getGifLevel(cropSize)
    : userQualityLevel ?? (canProcessVideo && isProcessed ? getMaxLevel(cropSize) : undefined);

  const processingMode = !videoSource ? 'none'
    : isAvatar ? 'transcode'
      : getVideoProcessingMode(doc, videoSource.size, effectiveQualityLevel, probe?.audioHandling === 'transcode');
  const outputSize = useMemo(
    () => (isAvatar ? getAvatarSize(cropSize) : getOutputSize(cropSize, processingMode, effectiveQualityLevel)),
    [isAvatar, cropSize, processingMode, effectiveQualityLevel],
  );
  const outputDuration = doc.trim ? doc.trim.end - doc.trim.start : duration;
  const outputFrameRate = isAvatar
    ? Math.min(frameRate, AVATAR_VIDEO_MAX_FRAME_RATE)
    : getOutputFrameRate(frameRate, effectiveQualityLevel);
  const videoBitrate = probe ? getVideoBitrate(outputSize, outputFrameRate, probe.videoBitrate) : 0;
  const estimatedSize = probe && videoSource ? estimateVideoSize({
    mode: processingMode,
    sourceSize: videoSource.blob.size,
    duration,
    outputDuration,
    videoBitrate,
    audioBitrate: doc.isMuted ? 0 : getAudioBitrateEstimate(probe.audioBitrate, probe.audioHandling === 'transcode'),
    discardedAudioBitrate: doc.isMuted ? probe.audioBitrate || 0 : 0,
  }) : 0;
  const isResultTooLarge = processingMode !== 'none' && estimatedSize > MAX_EDITABLE_VIDEO_OUTPUT_SIZE;
  const isAudioLost = isAudioUnsupported && !doc.isMuted && processingMode !== 'none';
  const isQualityChanged = !isVideoSupportPending && userQualityLevel !== initialQualityLevel;
  const isDirty = doc !== initialDocRef.current || isQualityChanged;

  const videoQuality = useMemo((): VideoQualityControl | undefined => (qualityLevels.length ? {
    levels: qualityLevels,
    level: effectiveQualityLevel,
    originalLevel: getOriginalLevel(cropSize, isProcessed),
    outputSize,
    estimatedSize,
    isGif,
    onChange: setQualityLevel,
  } : undefined), [
    qualityLevels, cropSize, isProcessed, effectiveQualityLevel, outputSize, estimatedSize, isGif,
  ]);

  // Before the media loads, the canvas is laid out from the expected size and edits, so the ghost can land
  const layoutCrop = crop.cropperWidth ? crop : initialEditState?.document.crop;
  const layoutQuarterTurns = layoutCrop?.quarterTurns ?? 0;
  const effectiveDims = useMemo(() => {
    if (!layoutSourceSize) return { width: 0, height: 0 };
    return getEffectiveDimensions(layoutSourceSize.width, layoutSourceSize.height, layoutQuarterTurns);
  }, [layoutSourceSize, layoutQuarterTurns]);

  // Display size hook - must be called before useCropper and useEditorPreview
  const { displaySize, displayScale } = useDisplaySize({
    canvasAreaRef,
    imageWidth: effectiveDims.width,
    imageHeight: effectiveDims.height,
    reservedHeight,
    isDisabled: !shouldRender,
  });

  const layerDisplaySize = useMemo(() => (layoutCrop ? {
    width: layoutCrop.cropperWidth * displayScale,
    height: layoutCrop.cropperHeight * displayScale,
  } : displaySize), [layoutCrop, displayScale, displaySize]);

  const isContentReady = Boolean(isSourceError)
    || (!isVideoSupportPending && displaySize.width > 0 && crop.cropperWidth > 0);
  const [isRevealed, setIsRevealed] = useState(false);
  const isLoading = !isContentReady && !isRevealed;
  useEffect(() => {
    if (!isOpen) {
      setIsRevealed(false);
      return undefined;
    }
    if (isContentReady) {
      setIsRevealed(true);
      return undefined;
    }

    const timeout = window.setTimeout(() => setIsRevealed(true), LOADING_MAX_WAIT);
    return () => clearTimeout(timeout);
  }, [isOpen, isContentReady]);

  // Get display coordinates for cropper
  const getDisplayCoordinates = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  });

  const getCrop = useLastCallback(() => getDoc().crop);

  const handlePreviewCrop = useLastCallback((newCrop: CropState) => {
    preview(applyCrop(getDoc(), newCrop, sourceSize!));
  });

  const handleCommitCrop = useLastCallback((newCrop: CropState) => {
    commit(applyCrop(getDoc(), newCrop, sourceSize!));
  });

  const {
    handleCropperDragStart,
    handleCornerResizeStart,
    handleRotationChange,
    handleRotationChangeEnd,
    handleQuarterRotate,
    handleFlip,
  } = useCropper({
    sourceSize,
    displayScale,
    getDisplayCoordinates,
    lockedAspectRatio: fixedAspectRatio,
    getCrop,
    onPreview: handlePreviewCrop,
    onCommit: handleCommitCrop,
  });

  // Get canvas coordinates for drawing
  const getCanvasCoordinates = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e);
    const { cropperWidth, cropperHeight } = getCrop();

    const scaleX = cropperWidth / rect.width;
    const scaleY = cropperHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  });

  const inverseTransformPoint = useLastCallback((
    x: number, y: number,
    effCenterX: number, effCenterY: number,
    imgCenterX: number, imgCenterY: number,
    zoom: number,
  ) => {
    const rotation = getTotalRotation(crop);
    const { flipH } = crop;

    // Translate to effective center
    let tx = x - effCenterX;
    let ty = y - effCenterY;

    // Inverse rotation
    if (rotation !== 0) {
      const rad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const newX = tx * cos - ty * sin;
      const newY = tx * sin + ty * cos;
      tx = newX;
      ty = newY;
    }

    // Divide by zoom
    tx /= zoom;
    ty /= zoom;

    // Inverse flip
    if (flipH) tx = -tx;

    // Translate back to image center
    return { x: tx + imgCenterX, y: ty + imgCenterY };
  });

  const canvasToImageCoords = useLastCallback((canvasX: number, canvasY: number) => {
    const currentCrop = getCrop();
    const effectiveX = currentCrop.cropperX + canvasX;
    const effectiveY = currentCrop.cropperY + canvasY;

    if (!sourceSize || !isDrawMode) return { x: effectiveX, y: effectiveY };

    const { width: effW, height: effH } = getEffectiveDimensions(
      sourceSize.width, sourceSize.height, crop.quarterTurns,
    );
    const rotation = getTotalRotation(crop);
    const { flipH } = crop;
    const zoom = computeRotationZoom(effW, effH, crop.rotation);

    if (rotation === 0 && !flipH && zoom === 1) {
      return { x: effectiveX, y: effectiveY };
    }

    return inverseTransformPoint(
      effectiveX, effectiveY,
      effW / 2, effH / 2,
      sourceSize.width / 2, sourceSize.height / 2,
      zoom,
    );
  });

  const handleDrawActionComplete = useLastCallback((action: DrawAction) => {
    const currentDoc = getDoc();
    commit({ ...currentDoc, paint: [...currentDoc.paint, action] });
  });

  const {
    currentDrawAction,
    handlePointerDown,
    resetDrawing,
  } = useDrawing({
    getCanvasCoordinates,
    canvasToImageCoords,
    settings: drawSettings,
    displayScale,
    onActionComplete: handleDrawActionComplete,
  });

  const canvasDisplaySize = isCropView ? displaySize : layerDisplaySize;
  // The preview shows the resolution of the selected quality, like the native editors
  const previewMaxPixelRatio = processingMode === 'transcode' && !isCropView && crop.cropperWidth
    && layerDisplaySize.width ? outputSize.width / layerDisplaySize.width : undefined;
  const { canvasSize, canvasCssSize } = useEditorPreview({
    canvasRef,
    frame: source?.frame,
    sourceSize,
    displaySize: canvasDisplaySize,
    doc: previewDoc,
    isCropMode: isCropView,
    currentAction: currentDrawAction,
    shouldRenderEveryFrame: isPlaying,
    maxPixelRatio: previewMaxPixelRatio,
  });
  const hasCanvasFrame = Boolean(source) && crop.cropperWidth > 0 && canvasSize.width > 0;

  const handleTrimPreview = useLastCallback((trim: VideoTrim) => {
    preview(applyTrim(getDoc(), trim, duration, 1 / frameRate));
  });

  const handleTrimCommit = useLastCallback((trim: VideoTrim) => {
    commit(applyTrim(getDoc(), trim, duration, 1 / frameRate));
  });

  const handleCoverUseCurrentFrame = useLastCallback(() => {
    const currentDoc = getDoc();
    const { start, end } = currentDoc.trim ?? { start: 0, end: duration };
    const time = clampCoverTime(getCurrentTime(), start, end, 1 / frameRate);
    commit({ ...currentDoc, cover: { type: 'frame', time } });
  });

  const handleCoverClear = useLastCallback(() => {
    commit({ ...getDoc(), cover: undefined });
  });

  const handleAvatarCoverChange = useLastCallback((time: number) => {
    commit({ ...getDoc(), cover: { type: 'frame', time } });
  });

  const handleCoverFileChoose = useLastCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showNotification({ message: { key: 'EditorCoverInvalidFile' } });
      return;
    }

    setCoverImageSource({ blobUrl: URL.createObjectURL(file), mimeType: file.type, filename: file.name });
  });

  const handleCoverDragOver = useLastCallback((e: React.DragEvent) => {
    e.preventDefault();
  });

  const handleCoverDrop = useLastCallback((e: React.DragEvent) => {
    const file = e.dataTransfer?.files[0];
    if (!file) return;

    e.preventDefault();
    handleCoverFileChoose(file);
  });

  const handleCoverImageClose = useLastCallback(() => {
    if (coverImageSource) URL.revokeObjectURL(coverImageSource.blobUrl);
    setCoverImageSource(undefined);
  });

  const handleCoverImageApply = useLastCallback((result: MediaEditorResult) => {
    if (result.kind !== 'photo') return;

    const blobUrl = URL.createObjectURL(result.file);
    createdCoverUrlsRef.current.push(blobUrl);
    commit({ ...getDoc(), cover: { type: 'image', blobUrl } });
  });

  // Covers that did not make it into the applied edit state are not owned by any attachment
  const revokeCreatedCoverUrls = useLastCallback((appliedEditState?: MediaEditState) => {
    const retainedUrls = new Set(appliedEditState ? getEditStateCoverUrls(appliedEditState) : []);
    createdCoverUrlsRef.current.forEach((url) => {
      if (!retainedUrls.has(url)) URL.revokeObjectURL(url);
    });
    createdCoverUrlsRef.current = [];
  });

  const renderVideoFrame = useLastCallback((request: VideoFrameRequest) => {
    if (!videoSource) return Promise.resolve(undefined);

    const params = { ...request, sourceSize: videoSource.size, mimeType: 'image/jpeg' };
    const frame = videoSource.probe?.canDecodeVideo
      ? requestVideoProcessing({ name: 'renderFrame', args: [videoSource.blob, params] }) as Promise<RenderedFrame>
      : renderVideoElementFrame(videoSource.frame.src, params);

    return frame.catch(() => undefined);
  });

  const { cover } = doc;
  const avatarCoverTime = cover?.type === 'frame' ? cover.time : undefined;
  const {
    cover: committedCover, crop: committedCrop, paint: committedPaint, layers: committedLayers,
    trim: committedTrim, adjustments, tint, curves,
  } = presentDoc;
  const coverThumbDoc = useMemo(() => ({
    crop: committedCrop,
    paint: committedPaint,
    layers: committedLayers,
    trim: committedTrim,
    adjustments,
    tint,
    curves,
  }), [committedCrop, committedPaint, committedLayers, committedTrim, adjustments, tint, curves]);
  const coverOutputFrameRate = isAvatar ? outputFrameRate : undefined;
  useEffect(() => {
    if (!committedCover || !videoSource) {
      setCoverThumbUrl(undefined);
      return undefined;
    }

    if (committedCover.type === 'image') {
      setCoverThumbUrl(committedCover.blobUrl);
      return undefined;
    }

    let thumbUrl: string | undefined;
    let isCancelled = false;
    void (async () => {
      const thumbSize = fitCropToMaxSide(coverThumbDoc.crop, VIDEO_THUMB_MAX_SIDE);
      const layerFrames = await loadLayerFrames(coverThumbDoc.layers, thumbSize, { shouldRenderText: true });
      const frame = isCancelled ? undefined : await renderVideoFrame({
        time: committedCover.time,
        doc: coverThumbDoc,
        maxSide: VIDEO_THUMB_MAX_SIDE,
        quality: THUMB_QUALITY,
        outputFrameRate: coverOutputFrameRate,
        layerFrames,
      });
      closeLayerFrames(layerFrames);
      if (isCancelled || !frame) return;
      thumbUrl = URL.createObjectURL(frame.blob);
      setCoverThumbUrl(thumbUrl);
    })();

    return () => {
      isCancelled = true;
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [committedCover, coverThumbDoc, coverOutputFrameRate, videoSource, renderVideoFrame]);

  const resetSession = useLastCallback(() => {
    revokeCreatedCoverUrls();
    reset(EMPTY_EDIT_DOCUMENT);
    initialDocRef.current = EMPTY_EDIT_DOCUMENT;
    resetDrawing();
    setActiveTabId(defaultTabId);
    setIsShowingOriginal(false);
    setSelectedLayerId(undefined);
    editingLayerIdRef.current = undefined;
    setEditingLayerId(undefined);
    setCropTransition(undefined);
    setTransformAnimation(undefined);
  });

  const restoreToolSettings = useLastCallback(() => {
    const { draw, text } = getGlobal().mediaEditorSettings ?? {};
    setDrawSettings(draw ?? DEFAULT_DRAW_SETTINGS);
    setTextSettings(text && TEXT_FONTS[text.font] ? text : DEFAULT_TEXT_SETTINGS);
  });

  useEffect(() => {
    if (shouldRender) {
      restoreToolSettings();
    } else {
      resetSession();
    }
  }, [shouldRender, resetSession, restoreToolSettings]);

  const handleDrawSettingsChange = useLastCallback((settings: DrawSettings, isPreview?: boolean) => {
    setDrawSettings(settings);
    if (!isPreview) updateMediaEditorSettings({ draw: settings });
  });

  // Reset state when editor opens
  useEffect(() => {
    if (isOpen && editorSourceUrl) {
      resetSession();
      setQualityLevel(initialQualityLevel);
      // Opened from the Media Viewer → morph its media into the canvas and fade in above it
      setIsAboveMediaViewer(!hasOriginGhost && Boolean(getMediaViewerMedia()));
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isOpen, editorSourceUrl]);

  useEffect(() => {
    sessionTokenRef.current++;
  }, [isOpen, editorSourceUrl]);

  useEffect(() => {
    if (!source) return;

    if (initialEditState) {
      restore(initialEditState);
    } else {
      reset(isAvatar && source.kind === 'video'
        ? createAvatarVideoDocument(source.size, duration, 1 / frameRate, initialCoverTime)
        : createEditDocument(source.size, fixedAspectRatio));
    }
    initialDocRef.current = getDoc();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [source]);

  // While landing, promote the editor to the top layer (a manual popover) so it renders — and fades
  // in — above the still-open Media Viewer modal.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !isAboveMediaViewer) return undefined;

    root.popover = 'manual';
    if (!root.matches(':popover-open')) {
      root.showPopover();
    }

    return () => {
      if (root.matches(':popover-open')) {
        root.hidePopover();
      }
      root.removeAttribute('popover');
    };
  }, [isAboveMediaViewer, rootRef]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    return () => {
      discardMediaEditorGhost();
      setGhostPhase(undefined);
    };
  }, [isOpen]);

  const handleGhostLand = useLastCallback(() => {
    setGhostPhase('landed');
    if (!isAboveMediaViewer) return;

    // Only once the ghost has landed is the editor guaranteed to be opaque above the viewer
    setIsAboveMediaViewer(false);
    closeMediaViewer({ shouldLandInMediaEditor: true });
  });

  const { width: canvasCssWidth, height: canvasCssHeight } = canvasCssSize;

  // A ghost from the attachment flies as soon as the canvas is laid out, the one from the viewer waits for the content
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!hasGhost || ghostPhase || !canvas || !canvasCssWidth) return;
    if (isAboveMediaViewer && !isContentReady) return;

    setGhostPhase('flying');
    requestMeasure(() => {
      if (isAboveMediaViewer) {
        const media = getMediaViewerMedia();
        if (!media || !prepareMediaEditorGhost(media, true)) {
          handleGhostLand();
          return;
        }
      }

      landGhostInMediaEditor(canvas, handleGhostLand);
    });
  }, [hasGhost, ghostPhase, isAboveMediaViewer, isContentReady, canvasCssWidth, handleGhostLand]);

  useLayoutEffectWithPrevDeps(([prevCanvasCssWidth, prevCanvasCssHeight]) => {
    const canvas = canvasRef.current;
    if ((ghostPhase !== 'flying' && ghostPhase !== 'landed') || !canvas) return;
    if (canvasCssWidth === prevCanvasCssWidth && canvasCssHeight === prevCanvasCssHeight) return;

    setGhostPhase('flying');
    requestMeasure(() => landGhostInMediaEditor(canvas, handleGhostLand));
  }, [canvasCssWidth, canvasCssHeight, ghostPhase, handleGhostLand]);

  // The ghost holds the place until the canvas has its first frame, then fades out above the opaque canvas
  useEffect(() => {
    if (ghostPhase !== 'landed') return undefined;
    if (hasCanvasFrame || isSourceError) {
      setGhostPhase('revealing');
      return undefined;
    }

    const timeout = window.setTimeout(() => setGhostPhase('revealing'), GHOST_HOLD_MAX_WAIT);
    return () => clearTimeout(timeout);
  }, [ghostPhase, hasCanvasFrame, isSourceError]);

  useLayoutEffect(() => {
    if (ghostPhase === 'revealing') {
      fadeOutMediaEditorGhost(() => setGhostPhase('done'));
    }
  }, [ghostPhase]);

  // Reveal the canvas and drop the backdrop viewer even if the ghost never starts (e.g. image failed)
  useEffect(() => {
    if (!isAboveMediaViewer || ghostPhase) return undefined;

    const timeout = window.setTimeout(() => {
      setIsAboveMediaViewer(false);
      closeMediaViewer({ shouldLandInMediaEditor: true });
    }, GHOST_LANDING_MAX_WAIT);
    return () => clearTimeout(timeout);
  }, [isAboveMediaViewer, ghostPhase]);

  const cancelExport = useLastCallback(() => {
    if (!exportCallbackRef.current) return;

    cancelVideoProcessing(exportCallbackRef.current);
    finishExport();
  });

  useEffect(() => (isOpen ? cancelExport : undefined), [isOpen, cancelExport]);

  const handleCloseRequest = useLastCallback(() => {
    if (isExporting) {
      cancelExport();
    } else if (isDirty) {
      openDiscardDialog();
    } else {
      onClose();
    }
  });

  const handleDiscard = useLastCallback(() => {
    closeDiscardDialog();
    onClose();
  });

  // Esc key handler via captureEscKeyListener (participates in shared handler stack)
  useEffect(() => {
    if (!isOpen) return undefined;

    return captureEscKeyListener(handleCloseRequest, renderingWindow.document);
  }, [isOpen, handleCloseRequest, renderingWindow]);

  const handleUndo = useLastCallback(() => {
    endTextEditing();
    undo();
  });

  const handleRedo = useLastCallback(() => {
    endTextEditing();
    redo();
  });

  function endTextEditing() {
    if (editingLayerIdRef.current) (renderingWindow.document.activeElement as HTMLElement | null)?.blur();
  }

  // Keyboard shortcuts (undo/redo)
  useEffect(() => {
    if (!isOpen || coverImageSource || isDiscardDialogOpen || isExporting) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;

      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isMeta && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((isMeta && key === 'z' && e.shiftKey) || (IS_WINDOWS && isMeta && key === 'y')) {
        e.preventDefault();
        handleRedo();
      } else if ((key === 'delete' || key === 'backspace') && selectedLayerId && !editingLayerId) {
        e.preventDefault();
        const currentLayers = getDoc().layers ?? EMPTY_LAYERS;
        if (currentLayers.some((layer) => layer.id === selectedLayerId)) {
          handleLayersCommit(currentLayers.filter((layer) => layer.id !== selectedLayerId));
        }
        setSelectedLayerId(undefined);
      }
    };

    renderingWindow.document.addEventListener('keydown', handleKeyDown);
    return () => renderingWindow.document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen, coverImageSource, isDiscardDialogOpen, isExporting, selectedLayerId, editingLayerId, getDoc,
    renderingWindow,
  ]);

  const handleQuarterRotateAnimated = useLastCallback(() => {
    if (canAnimate && sourceSize) {
      const { rotation, quarterTurns } = crop;
      const { width: effW, height: effH } = getEffectiveDimensions(sourceSize.width, sourceSize.height, quarterTurns);
      const startWidth = displaySize.width * computeRotationZoom(effW, effH, rotation);
      const startRotation = QUARTER_TURN_DEGREES + rotation;
      const canvasTransform = getInFlightTransform(canvasRef.current);
      const layersTransform = getInFlightTransform(layersFrameRef.current);

      getStartTransformsRef.current = (newDisplaySize) => {
        const turn = `rotate(${startRotation}deg) scale(${startWidth / newDisplaySize.height})`;
        return { canvas: `${canvasTransform} ${turn}`, layers: `${layersTransform} ${turn}` };
      };
      setTransformAnimation({ kind: 'rotate' });
    }

    handleQuarterRotate();
  });

  const handleFlipAnimated = useLastCallback(() => {
    if (canAnimate && sourceSize) {
      const canvasTransform = getInFlightTransform(canvasRef.current);
      const layersTransform = getInFlightTransform(layersFrameRef.current);

      getStartTransformsRef.current = () => ({ canvas: `${canvasTransform} scaleX(-1)`, layers: layersTransform });
      setTransformAnimation({ kind: 'flip' });
    }

    handleFlip();
  });

  function getInFlightTransform(element?: HTMLElement) {
    if (!isTransformAnimating || !element) return '';

    const { transform } = getComputedStyle(element);
    return transform === 'none' ? '' : transform;
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const layersFrame = layersFrameRef.current;
    const getStartTransforms = getStartTransformsRef.current;
    if (!canvas || !getStartTransforms) return;

    getStartTransformsRef.current = undefined;
    const startTransforms = getStartTransforms(displaySize);
    setExtraStyles(canvas, { transition: 'none', transform: startTransforms.canvas });
    if (layersFrame) setExtraStyles(layersFrame, { transition: 'none', transform: startTransforms.layers });
    requestForcedReflow(() => {
      forceReflow(canvas);

      return () => {
        setExtraStyles(canvas, { transition: '', transform: '' });
        if (layersFrame) setExtraStyles(layersFrame, { transition: '', transform: '' });
      };
    });
  }, [crop, displaySize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!transformAnimation || !canvas) return undefined;

    return waitForCanvasAnimationEnd(canvas, 'transitionend', () => setTransformAnimation(undefined));
  }, [transformAnimation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!cropTransition || !canvas) return undefined;

    return waitForCanvasAnimationEnd(
      canvas, cropTransition === 'enter' ? 'animationend' : 'transitionend', () => setCropTransition(undefined),
    );
  }, [cropTransition]);

  const handleSave = useLastCallback(async () => {
    if (exportCallbackRef.current) {
      cancelExport();
      return;
    }

    endTextEditing();
    if (!source || !editorSource) return;

    if (isAvatar) {
      await (videoSource ? saveAvatarVideo() : saveAvatarPhoto());
      return;
    }

    const sessionToken = sessionTokenRef.current;

    if (source.kind === 'video') {
      const { document: savedDoc, ...stacks } = getEditState();
      const editState = { ...stacks, document: { ...savedDoc, isGif: isGif || undefined } };
      const { trim } = editState.document;
      const processing: VideoProcessingParams | undefined = processingMode === 'none' ? undefined : {
        mode: processingMode,
        sourceSize: source.size,
        outputSize,
        bitrate: videoBitrate,
        frameRate: outputFrameRate,
      };

      const savedLayerFrames = await loadLayerFrames(
        editState.document.layers,
        fitCropToMaxSide(editState.document.crop, VIDEO_COVER_MAX_SIDE),
        { shouldRenderText: true },
      );
      if (hasMissingStickerFrames(editState.document.layers, savedLayerFrames)) {
        closeLayerFrames(savedLayerFrames);
        showNotification({ message: { key: 'EditorStickersLoadFailed' } });
        return;
      }
      const previewFrame = await renderVideoFrame({
        time: trim?.start ?? 0,
        doc: editState.document,
        maxSide: VIDEO_COVER_MAX_SIDE,
        quality: VIDEO_COVER_JPEG_QUALITY,
        layerFrames: savedLayerFrames,
      });
      const coverFrame = await renderCover(editState.document, savedLayerFrames);
      if (sessionToken !== sessionTokenRef.current) {
        closeLayerFrames(savedLayerFrames);
        return;
      }

      onApply({
        kind: 'video',
        editState,
        processing,
        qualityLevel: userQualityLevel,
        outputSize,
        outputDuration,
        previewBlob: previewFrame?.blob,
        cover: coverFrame,
        isGif,
      });
      revokeCreatedCoverUrls(editState);
      closeLayerFrames(savedLayerFrames);
      onClose();
      return;
    }

    const mimeTypeToUse = editorSource.mimeType || 'image/jpeg';
    const editState = getEditState();
    const photoDoc = editState.document;
    const photoCropSize = getCropSize(photoDoc.crop);
    const photoLayerFrames = await loadLayerFrames(photoDoc.layers, photoCropSize, { isFirstFrameOnly: true });
    if (hasMissingStickerFrames(photoDoc.layers, photoLayerFrames)) {
      closeLayerFrames(photoLayerFrames);
      showNotification({ message: { key: 'EditorStickersLoadFailed' } });
      return;
    }
    const blob = await exportImage(source.frame, source.size, photoDoc, mimeTypeToUse, photoLayerFrames);
    closeLayerFrames(photoLayerFrames);
    if (!blob || sessionToken !== sessionTokenRef.current) return;

    const resultFilename = editorSource.filename || `image.${getExtensionFromMimeType(mimeTypeToUse)}`;
    const visibleLayers = photoDoc.layers?.filter((layer) => getIsLayerVisible(layer, photoCropSize));
    const isGifResult = Boolean(canSendGifs && canEncodeVideo && hasAnimatedStickers(visibleLayers));
    onApply({
      kind: 'photo',
      file: blobToFile(blob, resultFilename),
      editState,
      gifProcessing: isGifResult ? getPhotoGifProcessing(source.size, photoCropSize) : undefined,
    });
    onClose();
  });

  const saveAvatarPhoto = useLastCallback(async () => {
    const sessionToken = sessionTokenRef.current;
    const progressCallback = startExport();
    const avatarDoc = getEditState().document;
    const avatarCropSize = getCropSize(avatarDoc.crop);
    const size = getAvatarSize(avatarCropSize);
    const layerFrames = await loadLayerFrames(avatarDoc.layers, size, { isFirstFrameOnly: true });
    if (progressCallback.isCanceled) {
      closeLayerFrames(layerFrames);
      return;
    }
    if (hasMissingStickerFrames(avatarDoc.layers, layerFrames)) {
      closeLayerFrames(layerFrames);
      finishExport();
      showNotification({ message: { key: 'EditorStickersLoadFailed' } });
      return;
    }
    const blob = await exportImage(source!.frame, source!.size, avatarDoc, 'image/jpeg', layerFrames, size);
    closeLayerFrames(layerFrames);
    if (progressCallback.isCanceled || sessionToken !== sessionTokenRef.current) return;
    if (!blob) {
      finishExport();
      return;
    }

    const file = blobToFile(blob, 'avatar.jpg');
    const visibleLayers = avatarDoc.layers?.filter((layer) => getIsLayerVisible(layer, avatarCropSize));
    if (!canEncodeVideo || !hasAnimatedStickers(visibleLayers)) {
      finishExport();
      onApply({ kind: 'avatar', avatar: { file } });
      onClose();
      return;
    }

    const processing: VideoProcessingParams = {
      mode: 'transcode',
      sourceSize: source!.size,
      outputSize: size,
      bitrate: getVideoBitrate(size, AVATAR_VIDEO_MAX_FRAME_RATE, Infinity),
      frameRate: AVATAR_VIDEO_MAX_FRAME_RATE,
    };
    const sourceBlob = await fetchBlob(editorSourceUrl!);
    if (progressCallback.isCanceled || sessionToken !== sessionTokenRef.current) return;
    const video = await exportEditedMedia(sourceBlob, avatarDoc, processing, progressCallback, true)
      .catch(() => undefined);
    if (progressCallback.isCanceled || sessionToken !== sessionTokenRef.current) return;

    finishExport();
    if (!video) {
      showNotification({ message: { key: 'VideoProcessingFailed' } });
      return;
    }

    onApply({ kind: 'avatar', avatar: { file, video: blobToFile(video.blob, 'avatar.mp4') } });
    onClose();
  });

  const saveAvatarVideo = useLastCallback(async () => {
    const sessionToken = sessionTokenRef.current;
    const avatarDoc = getEditState().document;
    const { trim, cover: avatarCover } = avatarDoc;
    const coverTime = avatarCover?.type === 'frame' ? avatarCover.time : trim?.start ?? 0;
    const processing: VideoProcessingParams = {
      mode: 'transcode',
      sourceSize: videoSource!.size,
      outputSize,
      bitrate: videoBitrate,
      frameRate: outputFrameRate,
    };
    const progressCallback = startExport();

    const coverLayerFrames = await loadLayerFrames(avatarDoc.layers, outputSize, { shouldRenderText: true });
    if (progressCallback.isCanceled) {
      closeLayerFrames(coverLayerFrames);
      return;
    }
    if (hasMissingStickerFrames(avatarDoc.layers, coverLayerFrames)) {
      closeLayerFrames(coverLayerFrames);
      finishExport();
      showNotification({ message: { key: 'EditorStickersLoadFailed' } });
      return;
    }

    const [coverFrame, video] = await Promise.all([
      renderVideoFrame({
        time: coverTime,
        doc: avatarDoc,
        maxSide: outputSize.width,
        quality: VIDEO_COVER_JPEG_QUALITY,
        outputFrameRate,
        layerFrames: coverLayerFrames,
      }),
      exportEditedMedia(videoSource!.blob, avatarDoc, processing, progressCallback).catch(() => undefined),
    ]);
    closeLayerFrames(coverLayerFrames);
    if (progressCallback.isCanceled || sessionToken !== sessionTokenRef.current) return;

    finishExport();
    if (!coverFrame || !video) {
      showNotification({ message: { key: 'VideoProcessingFailed' } });
      return;
    }

    onApply({
      kind: 'avatar',
      avatar: {
        file: blobToFile(coverFrame.blob, 'avatar.jpg'),
        video: blobToFile(video.blob, 'avatar.mp4'),
        videoStartTs: coverFrame.time,
      },
    });
    onClose();
  });

  function startExport() {
    const progressCallback: CancellableCallback = () => undefined;
    exportCallbackRef.current = progressCallback;
    setIsExporting(true);
    return progressCallback;
  }

  function finishExport() {
    exportCallbackRef.current = undefined;
    setIsExporting(false);
  }

  const renderCover = useLastCallback(async (document: MediaEditDocument, coverLayerFrames: LayerFrames) => {
    const { cover: coverSource } = document;
    if (!coverSource || !isCoverAvailable) return undefined;

    if (coverSource.type === 'image') {
      return renderCoverImage(
        coverSource.blobUrl, outputSize.width / outputSize.height, VIDEO_COVER_MAX_SIDE, VIDEO_COVER_JPEG_QUALITY,
      ).catch(() => undefined);
    }

    return renderVideoFrame({
      time: coverSource.time,
      doc: document,
      maxSide: VIDEO_COVER_MAX_SIDE,
      quality: VIDEO_COVER_JPEG_QUALITY,
      layerFrames: coverLayerFrames,
    });
  });

  const handleLayersPreview = useLastCallback((newLayers: EditorLayer[]) => {
    preview({ ...getDoc(), layers: newLayers });
  });

  const handleLayersCommit = useLastCallback((newLayers: EditorLayer[]) => {
    commit({ ...getDoc(), layers: newLayers.length ? newLayers : undefined });
  });

  const handleLayerSelect = useLastCallback((id?: string) => {
    setSelectedLayerId(id);
    const text = id ? getDoc().layers?.find((layer) => layer.id === id)?.text : undefined;
    if (text) setTextSettings(omit(text, ['value']));
  });

  const handleLayerEditStart = useLastCallback((id: string) => {
    handleLayerSelect(id);
    editingLayerIdRef.current = id;
    setEditingLayerId(id);
  });

  const handleTextLayerCreate = useLastCallback((x: number, y: number) => {
    const id = generateUniqueId();
    const currentDoc = getDoc();
    preview({
      ...currentDoc,
      layers: [...currentDoc.layers ?? EMPTY_LAYERS, {
        id, type: 'text', x, y, scale: 1, rotation: 0, text: { ...textSettings, value: '' },
      }],
    });
    handleLayerEditStart(id);
  });

  const handleLayerEditEnd = useLastCallback((id: string, value: string) => {
    editingLayerIdRef.current = undefined;
    setEditingLayerId(undefined);
    const committedLayer = getEditState().document.layers?.find((layer) => layer.id === id);
    const currentLayers = getDoc().layers ?? EMPTY_LAYERS;

    if (!value.trim()) {
      setSelectedLayerId(undefined);
      if (committedLayer) {
        handleLayersCommit(currentLayers.filter((layer) => layer.id !== id));
      } else {
        preview(getEditState().document);
      }
      return;
    }

    const editedLayer = currentLayers.find((layer) => layer.id === id);
    if (!editedLayer) return;

    const text = { ...editedLayer.text!, value };
    if (committedLayer && areRecordsShallowEqual(committedLayer.text!, text)) {
      preview(getEditState().document);
      return;
    }

    handleLayersCommit(currentLayers.map((layer) => (layer === editedLayer ? { ...layer, text } : layer)));
  });

  const handleTextSettingsChange = useLastCallback((settings: TextSettings, isPreview?: boolean) => {
    setTextSettings(settings);
    if (!isPreview) updateMediaEditorSettings({ text: settings });
    const currentLayers = getDoc().layers ?? EMPTY_LAYERS;
    const selectedLayer = currentLayers.find((layer) => layer.id === selectedLayerId);
    if (selectedLayer?.type !== 'text') return;

    const text = { ...settings, value: selectedLayer.text!.value };
    const newLayers = currentLayers.map((layer) => (layer === selectedLayer ? { ...layer, text } : layer));
    if (isPreview || selectedLayer.id === editingLayerIdRef.current) {
      handleLayersPreview(newLayers);
      return;
    }

    const committedDoc = getEditState().document;
    const committedText = committedDoc.layers?.find((layer) => layer.id === selectedLayer.id)?.text;
    if (committedText && areRecordsShallowEqual(committedText, text)) {
      preview(committedDoc);
      return;
    }

    handleLayersCommit(newLayers);
  });

  const handleShowOriginal = useLastCallback(() => {
    setIsShowingOriginal(true);
  });

  const handleHideOriginal = useLastCallback(() => {
    setIsShowingOriginal(false);
  });

  const handleTabSwitch = useLastCallback((index: number) => {
    const tab = availableTabs[index];
    if (!tab || index === activeTabIndex) return;

    if (canAnimate && Boolean(tab.isCropMode) !== isCropMode) {
      if (!tab.isCropMode) {
        setCropTransition('leave');
      } else {
        // An unfinished leave runs back from where it is instead of restarting
        setCropTransition(cropTransition === 'leave' ? undefined : 'enter');
      }
    }
    setActiveTabId(tab.id);
    if (tab.id !== 'text' && tab.id !== 'stickers') setSelectedLayerId(undefined);
  });

  const canvasStyle = useMemo(() => {
    if (displaySize.width === 0) return 'display: none';

    return buildStyle(`width: ${canvasCssWidth}px`, `height: ${canvasCssHeight}px`);
  }, [displaySize, canvasCssWidth, canvasCssHeight]);

  const cropOffsetStyle = isCropView ? buildStyle(
    `--crop-offset-x: ${displaySize.width / 2 - (crop.cropperX + crop.cropperWidth / 2) * displayScale}px`,
    `--crop-offset-y: ${displaySize.height / 2 - (crop.cropperY + crop.cropperHeight / 2) * displayScale}px`,
  ) : undefined;

  if (!shouldRender) return undefined;

  const { Panel } = activeTab;

  function renderPanel(isActive: boolean) {
    return (
      <Panel
        isActive={isActive}
        doc={doc}
        sourceSize={sourceSize}
        drawSettings={drawSettings}
        videoQuality={videoQuality}
        isVideo={isVideo}
        canAdjustColors={(!isVideo || shouldShowProcessingTools) && getCanRenderAdjustments()}
        isAspectRatioLocked={Boolean(fixedAspectRatio)}
        isAvatar={isAvatar}
        chatId={chatId}
        textSettings={panelTextSettings}
        getDoc={getDoc}
        onTextSettingsChange={handleTextSettingsChange}
        onPreview={preview}
        onCommit={commit}
        onDrawSettingsChange={handleDrawSettingsChange}
      />
    );
  }

  return (
    <Portal>
      <div
        ref={rootRef}
        className={buildClassName(
          styles.root,
          'component-theme-dark',
          hasOriginGhost && isOpen && styles.withGhost,
          isAboveMediaViewer && styles.landingGhost,
          isLoading && styles.loading,
        )}
      >
        <div
          ref={canvasAreaRef}
          className={buildClassName(
            styles.canvasArea,
            canAnimate && isCropView && styles.canvasAnimated,
            cropTransition === 'enter' && styles.cropEntering,
            cropTransition === 'leave' && styles.cropCollapsed,
            isTransformAnimating && styles.cropGeometryAnimated,
          )}
          onDragOver={isCoverAvailable && isAdjustMode ? handleCoverDragOver : undefined}
          onDrop={isCoverAvailable && isAdjustMode ? handleCoverDrop : undefined}
        >
          <div
            className={buildClassName(styles.canvasContainer, isCanvasHiddenForGhost && styles.hiddenForGhost)}
            style={cropOffsetStyle}
            inert={isExporting}
          >
            <canvas
              ref={canvasRef}
              className={buildClassName(styles.canvas, canDraw && styles.drawMode)}
              width={canvasSize.width || undefined}
              height={canvasSize.height || undefined}
              style={canvasStyle}
              onMouseDown={canDraw ? handlePointerDown : undefined}
              onTouchStart={canDraw ? handlePointerDown : undefined}
              onClick={videoSource && isAdjustMode ? togglePlayback : undefined}
            />
            {displaySize.width > 0 && (layers.length > 0 || isLayerMode) && (
              <div
                ref={layersFrameRef}
                className={buildClassName(styles.layersFrame, transformAnimation?.kind === 'flip' && styles.flipping)}
              >
                <LayersOverlay
                  layers={layers}
                  frameSize={cropSize}
                  displaySize={layerDisplaySize}
                  selectedId={selectedLayerId}
                  editingId={editingLayerId}
                  isInteractive={isLayerMode && !isCropView}
                  isCropView={isCropView}
                  shouldAnimateStickers={isVideo || canPhotoAnimate}
                  onSelect={handleLayerSelect}
                  onEmptyClick={isTextMode ? handleTextLayerCreate : undefined}
                  onLayersPreview={handleLayersPreview}
                  onLayersCommit={handleLayersCommit}
                  onEditStart={handleLayerEditStart}
                  onEditEnd={handleLayerEditEnd}
                />
              </div>
            )}
            {avatarShape && !isCropView && displaySize.width > 0 && (
              <div
                className={buildClassName(
                  styles.avatarMask,
                  styles.canvasAvatarMask,
                  avatarShape === 'roundedSquare' && styles.roundedSquare,
                )}
                style={`width: ${canvasCssWidth}px; height: ${canvasCssHeight}px`}
              />
            )}
            {isCropView && displaySize.width > 0 && (
              <CropOverlay
                cropState={crop}
                avatarShape={avatarShape}
                displaySize={displaySize}
                scale={displayScale}
                onCropperDragStart={handleCropperDragStart}
                onCornerResizeStart={handleCornerResizeStart}
              />
            )}
          </div>

          <div
            className={buildClassName(styles.canvasControls, !isCropMode && styles.hidden)}
            aria-hidden={!isCropMode}
            inert={!isCropMode || isExporting}
          >
            <Button
              round
              color="translucent"
              size="smaller"
              onClick={handleQuarterRotateAnimated}
              iconName="rotate"
            />

            <RotationSlider
              value={crop.rotation}
              onChange={handleRotationChange}
              onChangeEnd={handleRotationChangeEnd}
            />

            <Button
              round
              color="translucent"
              size="smaller"
              onClick={handleFlipAnimated}
              iconName="flip"
            />
          </div>

          {videoSource && (
            <VideoControls
              blob={videoSource.blob}
              blobUrl={videoSource.frame.src}
              aspectRatio={videoSource.size.width / videoSource.size.height}
              duration={duration}
              frameRate={frameRate}
              canDecodeVideo={Boolean(probe?.canDecodeVideo)}
              isHidden={!isAdjustMode}
              isDisabled={isExporting}
              trim={doc.trim}
              isPlaying={!isPausedByUser}
              canTrim={canProcessVideo && duration >= MIN_TRIMMABLE_VIDEO_DURATION}
              maxTrimDuration={isAvatar ? AVATAR_VIDEO_MAX_DURATION : undefined}
              canMute={canMute}
              isMuted={doc.isMuted}
              isGif={isGif}
              canSendAsGif={canSendAsGif}
              canSetCover={canSetCover}
              cover={doc.cover}
              coverThumbUrl={coverThumbUrl}
              getCurrentTime={getCurrentTime}
              onTogglePlay={togglePlayback}
              onSeek={seek}
              onScrubStart={startScrubbing}
              onScrubEnd={stopScrubbing}
              onTrimPreview={handleTrimPreview}
              onTrimCommit={handleTrimCommit}
              onToggleMute={handleToggleMute}
              onCoverFileChoose={handleCoverFileChoose}
              onCoverUseCurrentFrame={handleCoverUseCurrentFrame}
              onCoverClear={handleCoverClear}
              avatarCoverTime={isAvatar ? avatarCoverTime : undefined}
              hint={isAvatar ? lang(isOwnAvatar ? 'AvatarChooseFrame' : 'AvatarChooseFrameOther') : undefined}
              onAvatarCoverChange={handleAvatarCoverChange}
            />
          )}

          {isVideo && !source && !isSourceError && !isGhostShown && (
            <div className={styles.editorStatus}>
              <Spinner color="white" />
            </div>
          )}
          {isVideo && isSourceError && (
            <div className={styles.editorStatus}>{lang('VideoEditorLoadFailed')}</div>
          )}

          <FloatingActionButton
            isShown={isDirty || Boolean(fixedAspectRatio)}
            iconName="check"
            className={styles.saveButton}
            disabled={isResultTooLarge || isAudioLost || isAvatarVideoBlocked}
            isLoading={isExporting}
            onClick={handleSave}
            ariaLabel={lang('Save')}
          />
        </div>

        <div className={styles.editPanel}>
          <div className={styles.panelHeader}>
            <Button round color="translucent" size="smaller" onClick={handleCloseRequest}>
              <Icon name="close" />
            </Button>
            <div className={styles.headerTitle}>
              {lang(isAvatar ? 'ChatSetPhotoOrVideo' : lockedAspectRatio ? 'EditorSetCover' : 'EditMedia')}
            </div>
            <div className={styles.headerActions} inert={isExporting}>
              <ShowTransition isOpen={hasAdjustments && isAdjustMode} isCustom className={styles.scaleFade}>
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  iconName="eye-outline"
                  ariaLabel={lang('EditorShowOriginal')}
                  onMouseDown={handleShowOriginal}
                  onMouseUp={handleHideOriginal}
                  onMouseLeave={handleHideOriginal}
                />
              </ShowTransition>
              <Button
                round
                color="translucent"
                size="smaller"
                onClick={handleUndo}
                disabled={!canUndo}
                iconName="undo"
              />
              <Button
                round
                color="translucent"
                size="smaller"
                onClick={handleRedo}
                disabled={!canRedo}
                iconName="redo"
              />
            </div>
          </div>

          {(isVideoTooLarge || isResultTooLarge) && (
            <div className={styles.panelNote}>{lang('VideoTooLargeToEdit')}</div>
          )}
          {isAudioUnsupported && !isAvatar && <div className={styles.panelNote}>{lang('VideoAudioUnsupported')}</div>}
          {isAvatarVideoUnsupported && <div className={styles.panelNote}>{lang('AvatarVideoUnsupported')}</div>}
          {restrictedNoteKey && <div className={styles.panelNote}>{lang(restrictedNoteKey)}</div>}

          <div className={styles.panelTabs} inert={isExporting}>
            <Transition
              ref={transitionRef}
              name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
              activeKey={activeTabIndex}
              shouldRestoreHeight
              className={buildClassName(styles.panelContent, 'custom-scroll')}
            >
              {renderPanel}
            </Transition>
            <TabList
              tabs={tabs}
              activeTab={activeTabIndex}
              stretched
              withFadeMask
              fadeMaskClassName={styles.modeTabsFade}
              onSwitchTab={handleTabSwitch}
              className={styles.modeTabs}
              tabClassName={styles.modeTab}
            />
          </div>
        </div>

        <ConfirmDialog
          isOpen={isDiscardDialogOpen}
          className="component-theme-dark"
          title={lang('DiscardChanges')}
          text={lang('PhotoEditorDiscardAlert')}
          confirmLabel={lang('Discard')}
          confirmIsDestructive
          confirmHandler={handleDiscard}
          onClose={closeDiscardDialog}
        />
        {isCoverAvailable && (
          <MediaEditor
            isOpen={Boolean(coverImageSource)}
            source={coverImageSource}
            lockedAspectRatio={outputSize.width / outputSize.height}
            onClose={handleCoverImageClose}
            onApply={handleCoverImageApply}
          />
        )}
      </div>
    </Portal>
  );
};

export default memo(MediaEditor);
