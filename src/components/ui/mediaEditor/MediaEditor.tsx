import { memo, useEffect, useMemo, useRef, useState } from '@teact';

import type { DrawAction } from './canvasUtils';
import type { CropAction, CropState } from './hooks/useCropper';

import { selectTheme } from '../../../global/selectors';
import { selectAnimationLevel } from '../../../global/selectors/sharedState';
import { IS_WINDOWS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getPointerPosition from '../../../util/events/getPointerPosition';
import { blobToFile, preloadImage } from '../../../util/files';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { REM } from '../../common/helpers/mediaDimensions';
import {
  applyCanvasTransform, computeRotationZoom, getEffectiveDimensions, renderActionsToCanvas,
} from './canvasUtils';

import useSelector from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import useCanvasRenderer from './hooks/useCanvasRenderer';
import useColorPicker, { getPredefinedColors } from './hooks/useColorPicker';
import useCropper, { DEFAULT_CROP_STATE, getTotalRotation } from './hooks/useCropper';
import useDisplaySize from './hooks/useDisplaySize';
import useDrawing from './hooks/useDrawing';

import Icon from '../../common/icons/Icon';
import Button from '../Button';
import FloatingActionButton from '../FloatingActionButton';
import Portal from '../Portal';
import TabList from '../TabList';
import Transition from '../Transition';
import CropOverlay from './CropOverlay';
import CropPanel from './CropPanel';
import DrawPanel from './DrawPanel';
import RotationSlider from './RotationSlider';

import styles from './MediaEditor.module.scss';

type OwnProps = {
  isOpen: boolean;
  imageUrl?: string;
  mimeType?: string;
  filename?: string;
  onClose: VoidFunction;
  onSave: (file: File) => void;
};

type EditorMode = 'crop' | 'draw';

type EditorAction = DrawAction | CropAction;

const EDITOR_TABS = [
  { type: 'draw' as const, icon: 'brush' as const },
  { type: 'crop' as const, icon: 'crop' as const },
];

const INITIAL_MODE = 'draw';
const TABS = EDITOR_TABS.map((tab) => ({
  title: <Icon name={tab.icon} />,
}));

const TRANSITION_DURATION = 300;

const MediaEditor = ({
  isOpen,
  imageUrl,
  mimeType,
  filename,
  onClose,
  onSave,
}: OwnProps) => {
  const lang = useLang();
  const animationLevel = useSelector(selectAnimationLevel);
  const theme = useSelector(selectTheme);

  const predefinedColors = useMemo(() => getPredefinedColors(theme), [theme]);

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
  const originalImageRef = useRef<HTMLImageElement | undefined>(undefined);

  const [mode, setMode] = useState<EditorMode>(INITIAL_MODE);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState<string | undefined>();
  const [snapshotStyle, setSnapshotStyle] = useState('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const [cropState, setCropState] = useState<CropState>(DEFAULT_CROP_STATE);

  const effectiveDims = useMemo(() => {
    if (imageDimensions.width === 0) return { width: 0, height: 0 };
    return getEffectiveDimensions(imageDimensions.width, imageDimensions.height, cropState.quarterTurns);
  }, [imageDimensions.width, imageDimensions.height, cropState.quarterTurns]);

  const [transformAnimType, setTransformAnimType] = useState<'rotate' | 'flip' | undefined>();

  const [actions, setActions] = useState<EditorAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditorAction[]>([]);

  const actionsRef = useRef<EditorAction[]>([]);
  const redoStackRef = useRef<EditorAction[]>([]);
  actionsRef.current = actions;
  redoStackRef.current = redoStack;

  // Display size hook - must be called before useCropper and useCanvasRenderer
  const {
    displaySize,
    getDisplayScale,
    resetDisplaySize,
  } = useDisplaySize({
    canvasAreaRef,
    imageWidth: effectiveDims.width,
    imageHeight: effectiveDims.height,
    reservedHeight: 6.5 * REM,
  });

  // Color picker hook
  const {
    hueSliderRef,
    satBrightRef,
    selectedColor,
    setSelectedColor,
    isColorPickerOpen,
    openColorPicker,
    closeColorPicker,
    hue,
    saturation,
    brightness,
    pickerColor,
    hexInputValue,
    rgbInputValue,
    handleHueChange,
    handleSatBrightChange,
    handleHexInput,
    handleHexInputBlur,
    handleRgbInput,
    handleRgbInputBlur,
    handleColorSelect,
    handleHueSliderMouseDown,
    handleSatBrightMouseDown,
  } = useColorPicker({ initialColor: predefinedColors[1] });

  // Get display coordinates for cropper
  const getDisplayCoordinates = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e as React.MouseEvent);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  });

  // Handle crop actions
  const handleCropAction = useLastCallback((action: CropAction) => {
    setActions((prev) => [...prev, action]);
    setRedoStack([]);
  });

  // Cropper hook
  const {
    getCroppedRegion,
    initCropState,
    handleCropperDragStart,
    handleCornerResizeStart,
    handleAspectRatioChange,
    handleRotationChange,
    handleRotationChangeEnd,
    handleQuarterRotate,
    handleFlip,
  } = useCropper({
    imageRef: originalImageRef,
    displaySize,
    getDisplayScale,
    getDisplayCoordinates,
    onAction: handleCropAction,
    cropState,
    setCropState,
  });

  // Memoize drawActions to avoid filtering on every render
  const drawActions = useMemo(
    () => actions.filter((a): a is DrawAction => a.type === 'draw'),
    [actions],
  );

  // Get canvas coordinates for drawing
  const getCanvasCoordinates = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerPosition(e as React.MouseEvent);

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

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
    const rotation = getTotalRotation(cropState);
    const { flipH } = cropState;

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
    const crop = getCroppedRegion();
    const img = originalImageRef.current;
    const effectiveX = crop.x + canvasX;
    const effectiveY = crop.y + canvasY;

    if (!img || mode !== 'draw') return { x: effectiveX, y: effectiveY };

    const { width: effW, height: effH } = getEffectiveDimensions(
      img.width, img.height, cropState.quarterTurns,
    );
    const rotation = getTotalRotation(cropState);
    const { flipH } = cropState;
    const zoom = computeRotationZoom(effW, effH, cropState.rotation);

    if (rotation === 0 && !flipH && zoom === 1) {
      return { x: effectiveX, y: effectiveY };
    }

    return inverseTransformPoint(
      effectiveX, effectiveY,
      effW / 2, effH / 2,
      img.width / 2, img.height / 2,
      zoom,
    );
  });

  // Handle draw action complete
  const handleDrawActionComplete = useLastCallback((action: DrawAction) => {
    setActions((prev) => [...prev, action]);
    setRedoStack([]);
  });

  // Drawing hook
  const {
    drawTool,
    setDrawTool,
    brushSize,
    setBrushSize,
    currentDrawAction,
    handlePointerDown,
    resetDrawing,
  } = useDrawing({
    getCanvasCoordinates,
    canvasToImageCoords,
    selectedColor,
    onActionComplete: handleDrawActionComplete,
  });

  // Canvas renderer hook
  const {
    canvasSize,
    renderCanvas,
    resetCanvasSize,
  } = useCanvasRenderer({
    canvasRef,
    imageRef: originalImageRef,
    mode,
    cropState,
    drawActions,
    currentDrawAction,
  });

  // Reset state when editor opens
  useEffect(() => {
    if (isOpen && imageUrl) {
      setActions([]);
      setRedoStack([]);
      resetDrawing();
      setMode(INITIAL_MODE);
      setSnapshotSrc(undefined);
      setIsTransitioning(false);
      setTransformAnimType(undefined);
      setSelectedColor(predefinedColors[1]);
      setCropState(DEFAULT_CROP_STATE);
      resetCanvasSize();
      resetDisplaySize();
      setImageDimensions({ width: 0, height: 0 });
      originalImageRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isOpen, imageUrl]);

  // Initialize canvas when image loads
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const initCanvas = async () => {
      let image: HTMLImageElement;
      try {
        image = await preloadImage(imageUrl);
      } catch {
        return;
      }

      originalImageRef.current = image;
      setImageDimensions({ width: image.width, height: image.height });
      initCropState(image.width, image.height);
      renderCanvas();
    };

    initCanvas();
  }, [isOpen, imageUrl, renderCanvas, initCropState]);

  // Esc key handler via captureEscKeyListener (participates in shared handler stack)
  useEffect(() => {
    if (!isOpen) return undefined;

    return captureEscKeyListener(() => {
      if (isColorPickerOpen) {
        closeColorPicker();
      } else {
        onClose();
      }
    });
  }, [isOpen, isColorPickerOpen, closeColorPicker, onClose]);

  // Keyboard shortcuts (undo/redo)
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isMeta && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((isMeta && key === 'z' && e.shiftKey) || (IS_WINDOWS && isMeta && key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleUndo = useLastCallback(() => {
    const actionList = actionsRef.current;
    if (actionList.length === 0) return;

    const lastAction = actionList[actionList.length - 1];
    const newActions = actionList.slice(0, -1);

    if (lastAction.type === 'crop') {
      const currentState = { ...cropState };
      setCropState(lastAction.previousState);
      setRedoStack((prev) => [...prev, { type: 'crop', previousState: currentState }]);
    } else {
      setRedoStack((prev) => [...prev, lastAction]);
    }
    setActions(newActions);
  });

  const handleRedo = useLastCallback(() => {
    const redo = redoStackRef.current;
    if (redo.length === 0) return;

    const actionToRedo = redo[redo.length - 1];
    const newRedoStack = redo.slice(0, -1);

    if (actionToRedo.type === 'crop') {
      const currentState = { ...cropState };
      setCropState(actionToRedo.previousState);
      setActions((prev) => [...prev, { type: 'crop', previousState: currentState }]);
    } else {
      setActions((prev) => [...prev, actionToRedo]);
    }
    setRedoStack(newRedoStack);
  });

  const captureCanvasSnapshot = useLastCallback((
    computeStyle?: (displayWidth: number, displayHeight: number) => string,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    try {
      const displayWidth = canvas.offsetWidth;
      const displayHeight = canvas.offsetHeight;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = displayWidth;
      tempCanvas.height = displayHeight;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, displayWidth, displayHeight);
        setSnapshotSrc(tempCanvas.toDataURL());
        setSnapshotStyle(
          computeStyle
            ? computeStyle(displayWidth, displayHeight)
            : `width: ${displayWidth}px; height: ${displayHeight}px`,
        );
      }
    } catch {
      // Canvas might be tainted
    }
  });

  const handleQuarterRotateAnimated = useLastCallback(() => {
    if (animationLevel > 0) {
      captureCanvasSnapshot((oldW, oldH) => {
        // Compute scale factors so the rotated snapshot matches the new canvas size
        const canvasArea = canvasAreaRef.current;
        if (!canvasArea) return `width: ${oldW}px; height: ${oldH}px`;

        const newEffDims = getEffectiveDimensions(
          imageDimensions.width, imageDimensions.height,
          (cropState.quarterTurns + 1) % 4,
        );
        const areaRect = canvasArea.getBoundingClientRect();
        const areaStyle = getComputedStyle(canvasArea);
        const padX = parseFloat(areaStyle.paddingLeft) + parseFloat(areaStyle.paddingRight);
        const padY = parseFloat(areaStyle.paddingTop) + parseFloat(areaStyle.paddingBottom);
        const scaleToFit = Math.min(
          (areaRect.width - padX) / newEffDims.width,
          (areaRect.height - padY - 6.5 * REM) / newEffDims.height,
          1,
        );
        const newW = newEffDims.width * scaleToFit;
        const newH = newEffDims.height * scaleToFit;

        // After CSS rotate(-90deg) scale(sx, sy), visual bounds = (oldH*sy, oldW*sx)
        const sx = newH / oldW;
        const sy = newW / oldH;
        return `width: ${oldW}px; height: ${oldH}px; --end-sx: ${sx}; --end-sy: ${sy}`;
      });
      setTransformAnimType('rotate');
    }
    handleQuarterRotate();
    if (animationLevel > 0) {
      setTimeout(() => {
        setTransformAnimType(undefined);
        setSnapshotSrc(undefined);
      }, TRANSITION_DURATION);
    }
  });

  const handleFlipAnimated = useLastCallback(() => {
    if (animationLevel > 0) {
      captureCanvasSnapshot();
      setTransformAnimType('flip');
    }
    handleFlip();
    if (animationLevel > 0) {
      setTimeout(() => {
        setTransformAnimType(undefined);
        setSnapshotSrc(undefined);
      }, TRANSITION_DURATION);
    }
  });

  const handleSave = useLastCallback(() => {
    const img = originalImageRef.current;
    if (!img) return;

    const crop = getCroppedRegion();
    if (crop.width <= 0 || crop.height <= 0) return;

    const rotation = getTotalRotation(cropState);
    const { flipH } = cropState;
    const { width: effW, height: effH } = getEffectiveDimensions(
      img.width, img.height, cropState.quarterTurns,
    );
    const zoom = computeRotationZoom(effW, effH, cropState.rotation);
    const hasTransforms = rotation !== 0 || flipH || cropState.quarterTurns !== 0 || zoom !== 1;

    // Stage 1: Render full image with transforms at effective dims
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = effW;
    fullCanvas.height = effH;
    const fullCtx = fullCanvas.getContext('2d');
    if (!fullCtx) return;

    if (hasTransforms) {
      fullCtx.save();
      applyCanvasTransform(fullCtx, img, rotation, flipH, cropState.quarterTurns, zoom);
    }

    fullCtx.drawImage(img, 0, 0);
    renderActionsToCanvas(fullCtx, drawActions, 0, 0, undefined, img.width, img.height);

    if (hasTransforms) {
      fullCtx.restore();
    }

    // Stage 2: Crop from effective space
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = Math.round(crop.width);
    finalCanvas.height = Math.round(crop.height);
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(fullCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

    const mimeTypeToUse = mimeType || 'image/jpeg';
    finalCanvas.toBlob((blob) => {
      if (blob) {
        const resultFilename = filename || `image.${getExtensionFromMimeType(mimeTypeToUse)}`;
        const file = blobToFile(blob, resultFilename);
        onSave(file);
        onClose();
      }
    }, mimeTypeToUse);
  });

  const activeTabIndex = EDITOR_TABS.findIndex((tab) => tab.type === mode);

  const handleTabSwitch = useLastCallback((index: number) => {
    const tab = EDITOR_TABS[index];
    if (tab && tab.type !== mode) {
      if (animationLevel > 0) {
        if (tab.type === 'draw') {
          // Crop → Draw: compute crop frame for zoom animation
          captureCanvasSnapshot((displayWidth, displayHeight) => {
            const scale = getDisplayScale();
            const fW = cropState.cropperWidth * scale;
            const fH = cropState.cropperHeight * scale;
            const fX = cropState.cropperX * scale;
            const fY = cropState.cropperY * scale;

            return buildStyle(
              `width: ${displayWidth}px`,
              `height: ${displayHeight}px`,
              `--crop-top: ${fY}px`,
              `--crop-right: ${displayWidth - (fX + fW)}px`,
              `--crop-bottom: ${displayHeight - (fY + fH)}px`,
              `--crop-left: ${fX}px`,
              `--offset-x: ${(displayWidth / 2) - (fX + fW / 2)}px`,
              `--offset-y: ${(displayHeight / 2) - (fY + fH / 2)}px`,
            );
          });
        } else {
          captureCanvasSnapshot();
        }
        setIsTransitioning(true);
        setTimeout(() => {
          setIsTransitioning(false);
          setSnapshotSrc(undefined);
        }, TRANSITION_DURATION);
      }
      setMode(tab.type);
    }
  });

  const canUndo = actions.length > 0;
  const canRedo = redoStack.length > 0;

  if (!shouldRender) return undefined;

  const renderPanelContent = () => {
    switch (mode) {
      case 'crop':
        return (
          <CropPanel
            currentRatio={cropState.aspectRatio}
            onRatioChange={handleAspectRatioChange}
          />
        );
      case 'draw':
        return (
          <DrawPanel
            predefinedColors={predefinedColors}
            selectedColor={selectedColor}
            isColorPickerOpen={isColorPickerOpen}
            hue={hue}
            saturation={saturation}
            brightness={brightness}
            pickerColor={pickerColor}
            hexInputValue={hexInputValue}
            rgbInputValue={rgbInputValue}
            brushSize={brushSize}
            drawTool={drawTool}
            hueSliderRef={hueSliderRef}
            satBrightRef={satBrightRef}
            onColorSelect={handleColorSelect}
            onOpenColorPicker={openColorPicker}
            onCloseColorPicker={closeColorPicker}
            onHueSliderMouseDown={handleHueSliderMouseDown}
            onHueChange={handleHueChange}
            onSatBrightMouseDown={handleSatBrightMouseDown}
            onSatBrightChange={handleSatBrightChange}
            onHexInput={handleHexInput}
            onHexInputBlur={handleHexInputBlur}
            onRgbInput={handleRgbInput}
            onRgbInputBlur={handleRgbInputBlur}
            onBrushSizeChange={setBrushSize}
            onToolChange={setDrawTool}
          />
        );
      default:
        return undefined;
    }
  };

  const isTransitioningToDraw = isTransitioning && mode === 'draw';
  const isTransitioningToCrop = isTransitioning && mode === 'crop';
  const shouldShowCropOverlay = mode === 'crop' || isTransitioningToDraw;
  const displayScale = getDisplayScale();

  const canvasStyle = useMemo(() => {
    if (displaySize.width === 0) return '';

    if (mode === 'crop') {
      const baseStyle = buildStyle(
        `width: ${displaySize.width}px`,
        `height: ${displaySize.height}px`,
      );

      if (isTransitioning) {
        // Draw → Crop: pass crop frame vars for zoom-out animation
        const fW = cropState.cropperWidth * displayScale;
        const fH = cropState.cropperHeight * displayScale;
        const fX = cropState.cropperX * displayScale;
        const fY = cropState.cropperY * displayScale;

        return buildStyle(
          baseStyle,
          `--crop-top: ${fY}px`,
          `--crop-right: ${displaySize.width - (fX + fW)}px`,
          `--crop-bottom: ${displaySize.height - (fY + fH)}px`,
          `--crop-left: ${fX}px`,
          `--offset-x: ${(displaySize.width / 2) - (fX + fW / 2)}px`,
          `--offset-y: ${(displaySize.height / 2) - (fY + fH / 2)}px`,
        );
      }

      return baseStyle;
    }

    const frameWidth = cropState.cropperWidth * displayScale;
    const frameHeight = cropState.cropperHeight * displayScale;

    return buildStyle(
      `width: ${frameWidth}px`,
      `height: ${frameHeight}px`,
    );
  }, [displaySize, cropState, displayScale, mode, isTransitioning]);

  return (
    <Portal>
      <div ref={rootRef} className={styles.root}>
        <div ref={canvasAreaRef} className={styles.canvasArea}>
          <div className={styles.canvasContainer}>
            <canvas
              ref={canvasRef}
              className={buildClassName(
                styles.canvas,
                isTransitioningToDraw && styles.transitioningToDraw,
                isTransitioningToCrop && styles.transitioningToCrop,
                mode === 'draw' && !isTransitioning && styles.drawMode,
                transformAnimType === 'rotate' && styles.transformAnimating,
                transformAnimType === 'flip' && styles.flipAnimating,
              )}
              width={canvasSize.width || undefined}
              height={canvasSize.height || undefined}
              style={canvasStyle}
              onMouseDown={mode === 'draw' ? handlePointerDown : undefined}
              onTouchStart={mode === 'draw' ? handlePointerDown : undefined}
            />
            {snapshotSrc && (
              <img
                className={buildClassName(
                  styles.canvasSnapshot,
                  isTransitioningToDraw && styles.zoomIn,
                  isTransitioningToCrop && styles.fadeOut,
                  transformAnimType === 'rotate' && styles.rotateFade,
                  transformAnimType === 'flip' && styles.flipFade,
                )}
                src={snapshotSrc}
                style={snapshotStyle}
                alt=""
                draggable={false}
              />
            )}
            {shouldShowCropOverlay && !transformAnimType && displaySize.width > 0 && (
              <CropOverlay
                cropState={cropState}
                displaySize={displaySize}
                scale={displayScale}
                isFadingOut={isTransitioningToDraw}
                onCropperDragStart={handleCropperDragStart}
                onCornerResizeStart={handleCornerResizeStart}
              />
            )}
          </div>

          <div
            className={buildClassName(
              styles.canvasControls,
              isTransitioningToDraw && styles.fadingOut,
              isTransitioningToCrop && styles.fadingIn,
              mode === 'draw' && !isTransitioning && styles.hidden,
            )}
          >
            <Button
              round
              color="translucent"
              size="smaller"
              onClick={handleQuarterRotateAnimated}
              iconName="rotate"
            />

            <RotationSlider
              value={cropState.rotation}
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
        </div>

        <div className={styles.editPanel}>
          <div className={styles.panelHeader}>
            <Button round color="translucent" size="smaller" onClick={onClose}>
              <Icon name="close" />
            </Button>
            <div className={styles.headerTitle}>{lang('EditMedia')}</div>
            <div className={styles.headerActions}>
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

          <div className={styles.panelTabs}>
            <Transition
              ref={transitionRef}
              name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
              activeKey={activeTabIndex}
              shouldRestoreHeight
              className={styles.panelContent}
            >
              {renderPanelContent()}
            </Transition>
            <TabList
              tabs={TABS}
              activeTab={activeTabIndex}
              onSwitchTab={handleTabSwitch}
              className={styles.modeTabs}
              tabClassName={styles.modeTab}
            />
          </div>
        </div>

        <FloatingActionButton
          isShown={actions.length > 0}
          iconName="check"
          className={styles.saveButton}
          onClick={handleSave}
          ariaLabel={lang('Save')}
        />
      </div>
    </Portal>
  );
};

function getExtensionFromMimeType(mimeType: string): string {
  return mimeType.split('/')[1];
}

export default memo(MediaEditor);
