import {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '@teact';

import type { EditorLayer } from '../../../../types/mediaEditor';
import type { TextLayout } from '../render/layers';
import type { Size } from '../render/transform';
import type { SnapAnchor } from './snapLayer';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';
import {
  getTextFill, getTextWidthLimits, layoutText, loadTextLayerFonts, measureLayer, TEXT_FONTS,
} from '../render/layers';
import { createAxisSnap, getLayerHalfExtents, getSnapInset } from './snapLayer';

import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

import Icon from '../../../common/icons/Icon';
import StickerLayer from './StickerLayer';

import '../../../../assets/fonts/mediaEditor.css';
import styles from '../MediaEditor.module.scss';

type OwnProps = {
  layers: EditorLayer[];
  frameSize: Size;
  displaySize: Size;
  selectedId?: string;
  editingId?: string;
  isInteractive: boolean;
  isCropView?: boolean;
  shouldAnimateStickers?: boolean;
  onSelect: (id?: string) => void;
  onEmptyClick?: (x: number, y: number) => void;
  onLayersPreview: (layers: EditorLayer[]) => void;
  onLayersCommit: (layers: EditorLayer[]) => void;
  onEditStart: (id: string) => void;
  onEditEnd: (id: string, value: string) => void;
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;
const SNAP_ANCHORS: SnapAnchor[] = ['start', 'center', 'end'];
const BLOCK_TAGS = new Set(['DIV', 'P']);

function LayersOverlay({
  layers,
  frameSize,
  displaySize,
  selectedId,
  editingId,
  isInteractive,
  isCropView,
  shouldAnimateStickers,
  onSelect,
  onEmptyClick,
  onLayersPreview,
  onLayersCommit,
  onEditStart,
  onEditEnd,
}: OwnProps) {
  const lang = useLang();
  const renderingWindow = useWindow();
  const rootRef = useRef<HTMLDivElement>();
  const editorRef = useRef<HTMLDivElement>();
  const forceUpdate = useForceUpdate();
  const [liveText, setLiveText] = useState<string>();
  const [guideX, setGuideX] = useState<SnapAnchor>();
  const [guideY, setGuideY] = useState<SnapAnchor>();
  const [initialLayerIds] = useState(() => new Set(layers.map(({ id }) => id)));
  const displayScale = displaySize.width / frameSize.width;
  const snapInset = getSnapInset(displaySize);

  useEffect(() => {
    void loadTextLayerFonts(layers)?.then(forceUpdate);
  }, [layers, forceUpdate]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    requestMeasure(() => {
      editor.focus();
      const selection = renderingWindow.getSelection();
      selection?.selectAllChildren(editor);
      selection?.collapseToEnd();
    });
  }, [editingId, renderingWindow]);

  useEffect(() => (
    editingId ? captureEscKeyListener(() => editorRef.current?.blur(), renderingWindow.document) : undefined
  ), [editingId, renderingWindow]);

  const updateLayer = (id: string, update: Partial<EditorLayer>) => (
    layers.map((layer) => (layer.id === id ? { ...layer, ...update } : layer))
  );

  const trackPointer = (onMove: (x: number, y: number) => EditorLayer[]) => {
    const targetDocument = renderingWindow.document;
    let lastLayers: EditorLayer[] | undefined;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const { x, y } = getPointerPosition(e);
      lastLayers = onMove(x, y);
      onLayersPreview(lastLayers);
    };

    const handleUp = () => {
      targetDocument.removeEventListener('mousemove', handleMove);
      targetDocument.removeEventListener('mouseup', handleUp);
      targetDocument.removeEventListener('touchmove', handleMove);
      targetDocument.removeEventListener('touchend', handleUp);
      targetDocument.removeEventListener('touchcancel', handleUp);
      setGuideX(undefined);
      setGuideY(undefined);
      if (lastLayers) onLayersCommit(lastLayers);
    };

    targetDocument.addEventListener('mousemove', handleMove);
    targetDocument.addEventListener('mouseup', handleUp);
    targetDocument.addEventListener('touchmove', handleMove);
    targetDocument.addEventListener('touchend', handleUp);
    targetDocument.addEventListener('touchcancel', handleUp);
  };

  const handleRootPointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.target !== rootRef.current) return;

    if (editingId || selectedId) {
      onSelect(undefined);
      return;
    }

    if (!onEmptyClick) return;
    const rect = rootRef.current.getBoundingClientRect();
    const { x, y } = getPointerPosition(e);
    onEmptyClick((x - rect.left) / rect.width, (y - rect.top) / rect.height);
  });

  const handleLayerPointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent, layer: EditorLayer) => {
    if (layer.id === editingId) return;

    e.preventDefault();
    e.stopPropagation();

    if (editingId) {
      editorRef.current?.blur();
      onSelect(layer.id);
      return;
    }

    onSelect(layer.id);

    const start = getPointerPosition(e);
    const { width, height } = displaySize;
    const halfExtents = getLayerHalfExtents(layer, frameSize, displayScale);
    const snapX = createAxisSnap(layer.x * width, halfExtents.width, width, snapInset);
    const snapY = createAxisSnap(layer.y * height, halfExtents.height, height, snapInset);

    trackPointer((x, y) => {
      const snappedX = snapX(layer.x * width + x - start.x);
      const snappedY = snapY(layer.y * height + y - start.y);
      setGuideX(snappedX.anchor);
      setGuideY(snappedY.anchor);

      return updateLayer(layer.id, {
        x: clamp(snappedX.value / width, Math.min(0, layer.x), Math.max(1, layer.x)),
        y: clamp(snappedY.value / height, Math.min(0, layer.y), Math.max(1, layer.y)),
      });
    });
  });

  const handleTransformPointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent, layer: EditorLayer) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = rootRef.current!.getBoundingClientRect();
    const centerX = rect.left + layer.x * rect.width;
    const centerY = rect.top + layer.y * rect.height;
    const start = getPointerPosition(e);
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    const startDistance = Math.hypot(start.x - centerX, start.y - centerY) || 1;

    trackPointer((x, y) => {
      const angle = Math.atan2(y - centerY, x - centerX);
      const distance = Math.hypot(x - centerX, y - centerY);
      return updateLayer(layer.id, {
        scale: clamp(
          layer.scale * (distance / startDistance),
          Math.min(MIN_SCALE, layer.scale),
          Math.max(MAX_SCALE, layer.scale),
        ),
        rotation: layer.rotation + ((angle - startAngle) * 180) / Math.PI,
      });
    });
  });

  const handleDelete = useLastCallback((id: string) => {
    onLayersCommit(layers.filter((layer) => layer.id !== id));
    onSelect(undefined);
  });

  const handleDeletePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  });

  const handleEditorInput = useLastCallback((e: React.FormEvent<HTMLDivElement>) => {
    setLiveText(readEditorText(e.currentTarget));
  });

  const handleEditorBlur = useLastCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!editingId) return;

    setLiveText(undefined);
    onEditEnd(editingId, readEditorText(e.currentTarget).replace(/\n+$/, ''));
  });

  const layouts = layers.map((layer) => (
    layer.type === 'text' ? layoutText(layer, frameSize, layer.id === editingId ? liveText : undefined) : undefined
  ));

  function renderSnapGuides(axis: 'x' | 'y', activeAnchor?: SnapAnchor) {
    const isVertical = axis === 'x';
    const length = isVertical ? displaySize.width : displaySize.height;

    return SNAP_ANCHORS.map((anchor) => {
      const position = anchor === 'start' ? snapInset : anchor === 'end' ? length - snapInset : length / 2;

      return (
        <div
          key={`guide-${axis}-${anchor}`}
          className={buildClassName(
            styles.snapGuide,
            isVertical ? styles.snapGuideVertical : styles.snapGuideHorizontal,
            anchor === activeAnchor && styles.visible,
          )}
          style={`${isVertical ? 'left' : 'top'}: ${position}px`}
        />
      );
    });
  }

  function renderText(layer: EditorLayer, layout: TextLayout) {
    const text = layer.text!;
    const isEditing = layer.id === editingId;
    const { family, weight } = TEXT_FONTS[text.font];
    const { color, background } = getTextFill(text);
    const className = buildClassName(
      styles.textLayer,
      text.style === 'plain' && styles.withShadow,
      isEditing && styles.editing,
    );
    const textStyle = [
      ...buildPositionStyle(layer),
      `font-family: ${family}`,
      `font-weight: ${weight}`,
      `font-size: ${layout.fontSize * displayScale}px`,
      `text-align: ${text.align}`,
      `color: ${color}`,
    ];

    const { minWidth, maxWidth } = getTextWidthLimits(layer, frameSize);
    const textElement = isEditing ? (
      <div
        ref={editorRef}
        key={`${layer.id}-editor`}
        className={className}
        contentEditable="plaintext-only"
        role="textbox"
        aria-multiline
        style={[
          ...textStyle,
          `min-width: ${minWidth * displayScale}px`,
          `max-width: ${maxWidth * displayScale}px`,
        ].join('; ')}
        onInput={handleEditorInput}
        onBlur={handleEditorBlur}
      >
        {text.value}
      </div>
    ) : (
      <div key={layer.id} className={className} style={[...textStyle, ...buildSizeStyle(layout)].join('; ')}>
        {layout.lines.map((line) => line.text).join('\n')}
      </div>
    );

    if (!layout.backgroundPath) return textElement;

    return [
      <svg
        key={`${layer.id}-background`}
        className={buildClassName(styles.textBackground, isEditing && styles.editing)}
        style={[...buildPositionStyle(layer), ...buildSizeStyle(layout)].join('; ')}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <path d={layout.backgroundPath} fill={background} />
      </svg>,
      textElement,
    ];
  }

  function renderBox(layer: EditorLayer, size: Size) {
    const isSelected = isInteractive && layer.id === selectedId;
    return (
      <div
        key={layer.id}
        className={buildClassName(styles.layerBox, isSelected && styles.selected)}
        style={[...buildPositionStyle(layer), ...buildSizeStyle(size)].join('; ')}
        onMouseDown={(e) => handleLayerPointerDown(e, layer)}
        onTouchStart={(e) => handleLayerPointerDown(e, layer)}
        onDoubleClick={layer.type === 'text' ? () => onEditStart(layer.id) : undefined}
      >
        {isSelected && (
          <>
            <button
              type="button"
              className={styles.layerDelete}
              aria-label={lang('EditorDeleteLayer')}
              onMouseDown={handleDeletePointerDown}
              onTouchStart={handleDeletePointerDown}
              onClick={() => handleDelete(layer.id)}
            >
              <Icon name="close" />
            </button>
            <div
              className={styles.layerHandle}
              onMouseDown={(e) => handleTransformPointerDown(e, layer)}
              onTouchStart={(e) => handleTransformPointerDown(e, layer)}
            />
          </>
        )}
      </div>
    );
  }

  function buildPositionStyle(layer: EditorLayer) {
    return [
      `left: ${layer.x * displaySize.width}px`,
      `top: ${layer.y * displaySize.height}px`,
      `transform: translate(-50%, -50%) rotate(${layer.rotation}deg)`,
    ];
  }

  function buildSizeStyle({ width, height }: Size) {
    return [`width: ${width * displayScale}px`, `height: ${height * displayScale}px`];
  }

  return (
    <div
      ref={rootRef}
      className={buildClassName(
        styles.layersOverlay,
        isInteractive && styles.interactive,
        isCropView && styles.cropView,
      )}
      style={`width: ${displaySize.width}px; height: ${displaySize.height}px`}
      onMouseDown={isInteractive ? handleRootPointerDown : undefined}
      onTouchStart={isInteractive ? handleRootPointerDown : undefined}
    >
      <div className={styles.layersContent} teactFastList>
        {renderSnapGuides('x', guideX)}
        {renderSnapGuides('y', guideY)}
        {layers.map((layer, i) => (layer.type === 'text' ? renderText(layer, layouts[i]!) : (
          <StickerLayer
            key={layer.id}
            layer={layer}
            displaySize={displaySize}
            shouldAnimate={shouldAnimateStickers}
            noAppearAnimation={initialLayerIds.has(layer.id)}
          />
        )))}
      </div>
      {layers.map((layer, i) => (
        layer.id !== editingId && renderBox(layer, layouts[i] ?? measureLayer(layer, frameSize))
      ))}
    </div>
  );
}

function readEditorText(editor: HTMLElement) {
  const lines: string[] = [];
  let blockText: string | undefined;

  editor.childNodes.forEach(readNode);
  flushBlock();

  return lines.join('\n');

  function readNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) blockText = (blockText ?? '') + node.textContent;
    } else if (node.nodeName === 'BR') {
      blockText = `${blockText ?? ''}\n`;
    } else if (BLOCK_TAGS.has(node.nodeName)) {
      flushBlock();
      node.childNodes.forEach(readNode);
      flushBlock();
    } else {
      node.childNodes.forEach(readNode);
    }
  }

  function flushBlock() {
    if (blockText !== undefined) lines.push(blockText.replace(/\n$/, ''));
    blockText = undefined;
  }
}

export default memo(LayersOverlay);
