import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';
import type { Point, Size } from './helpers/cardStickers';
import type { CardStyle, StyleWave } from './helpers/cardStyleWave';
import type { WalletCardPatternItem } from './helpers/cardTint';
import type { StyleWaveSignal } from './useCardStyleWave';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getStickerMediaHash } from '../../../global/helpers';
import { preloadImage } from '../../../util/files';
import { getStylePatternApproach, getStylePatternScale, getStyleWaveCircle } from './helpers/cardStyleWave';
import { getWalletCardPatternItems, IOS_CARD_WIDTH } from './helpers/cardTint';

import useAsync from '../../../hooks/useAsync';
import useMedia from '../../../hooks/useMedia';
import useResizeObserver from '../../../hooks/useResizeObserver';
import { useSignalEffect } from '../../../hooks/useSignalEffect';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';

import styles from './WalletCardPattern.module.scss';

type OwnProps = {
  style?: CardStyle;
  // The style a color change takes away, whose symbols stay outside the wave or recede with it
  waveFrom?: CardStyle;
  styleWave?: StyleWaveSignal;
  // The pattern stops before the address column and leaves room around the QR button
  addressRef: ElementRef<HTMLElement>;
  qrRef: ElementRef<HTMLElement>;
};

type Layout = {
  size: Size;
  items: WalletCardPatternItem[];
  hole?: { x: number; y: number; width: number; height: number; radius: number };
};

type Symbol = {
  image: HTMLImageElement;
  color: string;
};

// In points of the iOS card, scaled by the card width: the QR hole is 2 wider than the button, with corners of 10
const QR_HOLE_INSET = 2;
const QR_HOLE_RADIUS = 10;

// The symbol of the background gift in staggered rows over the card face, as in the iOS app. A color change brings
// the new symbols in a circle, flying out of the sticker, over the old ones.
const WalletCardPattern = ({
  style, waveFrom, styleWave, addressRef, qrRef,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const [size, setSize] = useState<Size>();
  const [layout, setLayout] = useState<Layout>();
  const dpr = useDevicePixelRatio();

  const target = useSymbol(style);
  const previous = useSymbol(waveFrom);

  useResizeObserver(canvasRef, ({ contentRect: { width, height } }) => {
    setSize({ width, height });
  });

  useEffect(() => {
    if (!size) return;

    requestMeasure(() => {
      setLayout(measureLayout(size, addressRef.current, qrRef.current));
    });
  }, [size, addressRef, qrRef]);

  // Each frame of a color wave draws the pattern again; without a wave it is drawn once
  useSignalEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const wave = styleWave?.();
    requestMutation(() => drawPattern(canvas, dpr, layout, target, previous, wave));
  }, [styleWave, layout, dpr, target, previous]);

  return <canvas ref={canvasRef} className={styles.root} aria-hidden />;
};

// A symbol loaded once comes at once, so the old pattern of a color change does not wait for it
function useSymbol(style?: CardStyle): Symbol | undefined {
  const sticker: ApiSticker | undefined = style?.pattern?.sticker;
  const url = useMedia(sticker && getStickerMediaHash(sticker, 'preview'));
  // The loaded image comes from the cache, so a symbol of the previous `url` never shows in the new color
  useAsync(() => (url ? loadSymbolImage(url) : Promise.resolve(undefined)), [url]);
  const image = url ? symbolImages.get(url) : undefined;
  const color = style?.backdrop.patternColor;

  return useMemo(() => (image && color ? { image, color } : undefined), [image, color]);
}

// A color change draws two symbols, and two more spare a reload when the user switches back. An image that leaves
// takes its tinted canvases with it, as `tintedSymbols` holds them weakly.
const MAX_SYMBOL_IMAGES = 4;
const symbolImages = new Map<string, HTMLImageElement>();

async function loadSymbolImage(url: string) {
  const image = await preloadImage(url);
  symbolImages.delete(url);
  symbolImages.set(url, image);

  if (symbolImages.size > MAX_SYMBOL_IMAGES) {
    symbolImages.delete(symbolImages.keys().next().value!);
  }

  return image;
}

// Offsets are layout pixels of the face, which the canvas shares unlike the scaled client rects
function measureLayout(size: Size, address?: HTMLElement, qr?: HTMLElement): Layout {
  const scale = size.width / IOS_CARD_WIDTH;
  const inset = QR_HOLE_INSET * scale;

  return {
    size,
    items: getWalletCardPatternItems(size.width, size.height, address?.offsetLeft),
    hole: qr && {
      x: qr.offsetLeft - inset,
      y: qr.offsetTop - inset,
      width: qr.offsetWidth + inset * 2,
      height: qr.offsetHeight + inset * 2,
      radius: QR_HOLE_RADIUS * scale,
    },
  };
}

function drawPattern(
  canvas: HTMLCanvasElement, dpr: number, { size, items, hole }: Layout,
  target?: Symbol, previous?: Symbol, wave?: StyleWave,
) {
  const width = Math.round(size.width * dpr);
  const height = Math.round(size.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d')!;
  const baseSize = items[0]?.size ?? 0;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, size.width, size.height);

  if (!wave) {
    if (target) drawSymbols(context, target, items, baseSize);
  } else {
    const { frame, origin, radius } = getStyleWaveCircle(wave, size.width, size.height);
    const approach = getStylePatternApproach(frame);
    const scale = getStylePatternScale(frame, approach);
    // The new symbols, or the receding old ones, fly inside the circle
    const moving = wave.isRemoving ? previous : target;

    if (!wave.isRemoving && previous) {
      context.save();
      context.beginPath();
      context.rect(0, 0, size.width, size.height);
      context.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
      context.clip('evenodd');
      drawSymbols(context, previous, items, baseSize);
      context.restore();
    }

    if (moving && radius > 0) {
      context.save();
      context.beginPath();
      context.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
      context.clip();
      drawSymbols(context, moving, items.map((item) => moveItem(item, origin, approach, scale)), baseSize);
      context.restore();
    }
  }

  if (!hole) return;

  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.roundRect(hole.x, hole.y, hole.width, hole.height, hole.radius);
  context.fill();
  context.globalCompositeOperation = 'source-over';
}

// The symbol is tinted at the size of the grid, and a receding pattern scales it down
function drawSymbols(
  context: CanvasRenderingContext2D, { image, color }: Symbol, items: WalletCardPatternItem[], baseSize: number,
) {
  const tinted = getTintedSymbol(image, color, baseSize, context.getTransform().a);
  if (!tinted) return;

  items.forEach(({ x, y, size }) => {
    context.drawImage(tinted, x - size / 2, y - size / 2, size, size);
  });
}

function moveItem({ x, y, size }: WalletCardPatternItem, origin: Point, approach: number, scale: number) {
  return {
    x: origin.x + (x - origin.x) * approach,
    y: origin.y + (y - origin.y) * approach,
    size: size * scale,
  };
}

const tintedSymbols = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

// The symbol is tinted once per color and grid size, so each frame only places it
function getTintedSymbol(image: HTMLImageElement, color: string, size: number, dpr: number) {
  const side = Math.ceil(size * dpr);
  if (!side) return undefined;

  const key = `${color}:${side}`;
  let byKey = tintedSymbols.get(image);
  if (!byKey) {
    byKey = new Map();
    tintedSymbols.set(image, byKey);
  }

  let canvas = byKey.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, side, side);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, side, side);
    byKey.set(key, canvas);
  }

  return canvas;
}

export default memo(WalletCardPattern);
