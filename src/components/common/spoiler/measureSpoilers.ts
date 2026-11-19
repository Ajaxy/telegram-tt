import type { SpoilerRect } from '../../../lib/gpuCanvas/types';
import { MAX_SPOILER_GLYPHS_SIZE, SPOILER_EDGE_FADE } from '../../../lib/gpuCanvas/types';

import getOffsetToContainer from '../../../util/visibility/getOffsetToContainer';

const WORD_REGEX = /\S+/g;
// Particles are sparser between the words of a spoiler
const LINE_DENSITY = 0.5;
// Particles reach past the font size above and below in CSS pixels, still inside the canvas of a one-line text
const TEXT_OUTSET = 1;

// Words get dense particles and line boxes sparse ones, each spoiler in its own text color
export function measureSpoilers(canvas: HTMLCanvasElement, parent: HTMLElement, selector: string) {
  const { ownerDocument } = canvas;
  const { left, top, right } = canvas.getBoundingClientRect();
  const scale = getCanvasScale(canvas);
  const range = ownerDocument.createRange();
  const rects: SpoilerRect[] = [];

  const canvasOffset = getOffsetToContainer(canvas, parent);

  // The edge fade drawn outside a region would be cut by the canvas sides
  const clipInset = (SPOILER_EDGE_FADE / 2) * scale;

  // Text rects keep the font size height in the middle of the line box, so particles cover only the glyphs.
  // Client rects are scaled by transforms such as the message appearance animation, the canvas is not.
  function addRect(rect: DOMRect, density: number, color: string, textHeight = Infinity) {
    const height = Math.min(textHeight * scale, rect.height);
    const rectTop = rect.top + (rect.height - height) / 2;
    const rectLeft = Math.max(rect.left, left + clipInset);
    const rectRight = Math.min(rect.right, right - clipInset);
    if (rectRight <= rectLeft || !height) return;

    rects.push({
      x: (rectLeft - left) / scale,
      y: (rectTop - top) / scale,
      width: (rectRight - rectLeft) / scale,
      height: height / scale,
      density,
      color,
    });
  }

  // Marks an emoji to conceal where `useCoordsInSharedCanvas` places it, which ignores scrolling and clipping
  function addEmojiMarker(emoji: HTMLElement, color: string) {
    const target = emoji.querySelector('img') || emoji;
    const offset = getOffsetToContainer(target, parent);

    rects.push({
      x: offset.left - canvasOffset.left,
      y: offset.top - canvasOffset.top,
      width: target.offsetWidth,
      height: target.offsetHeight,
      density: 0,
      color,
      isEmoji: true,
    });
  }

  getCanvasSpoilers(canvas, parent, selector).forEach((spoiler) => {
    const { color, fontSize } = getComputedStyle(spoiler);
    const textHeight = parseFloat(fontSize) + TEXT_OUTSET * 2;
    Array.from(spoiler.getClientRects()).forEach((rect) => addRect(rect, LINE_DENSITY, color, textHeight));

    const walker = ownerDocument.createTreeWalker(spoiler, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of (node as Text).data.matchAll(WORD_REGEX)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        Array.from(range.getClientRects()).forEach((rect) => addRect(rect, 1, color, textHeight));
      }
    }

    spoiler.querySelectorAll<HTMLElement>('.emoji').forEach((emoji) => {
      addRect(emoji.getBoundingClientRect(), 1, color);
      addEmojiMarker(emoji, color);
    });
  });

  return rects;
}

// Draws the words and emoji of spoilers where they are laid out, in CSS pixels of the canvas, for particles to fly to
// and take colors from. Content beyond the largest texture is drawn smaller. Custom emoji of the GPU canvas are added
// by its worker.
export function drawSpoilerGlyphs(canvas: HTMLCanvasElement, parent: HTMLElement, selector: string) {
  const { ownerDocument } = canvas;
  const canvasRect = canvas.getBoundingClientRect();
  const scale = getCanvasScale(canvas);
  const range = ownerDocument.createRange();
  const canvasWidth = Math.max(canvas.offsetWidth, 1);
  const canvasHeight = Math.max(canvas.offsetHeight, 1);
  const glyphsScale = Math.min(1, MAX_SPOILER_GLYPHS_SIZE / canvasWidth, MAX_SPOILER_GLYPHS_SIZE / canvasHeight);
  const glyphs = new OffscreenCanvas(
    Math.min(Math.ceil(canvasWidth * glyphsScale), MAX_SPOILER_GLYPHS_SIZE),
    Math.min(Math.ceil(canvasHeight * glyphsScale), MAX_SPOILER_GLYPHS_SIZE),
  );
  const context = glyphs.getContext('2d')!;
  context.scale(glyphsScale, glyphsScale);
  context.textAlign = 'left';

  // Client rects are scaled by transforms such as the message appearance animation, the canvas is not
  function toCanvas(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
    return {
      x: (rect.left - canvasRect.left) / scale,
      y: (rect.top - canvasRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  }

  // A text rect is the content area of the font, so the baseline sits its ascent below the middle part
  function drawText(text: string, rect: DOMRect) {
    const { x, y, width, height } = toCanvas(rect);
    const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = context.measureText(text);
    context.fillText(text, x, y + (height - ascent - descent) / 2 + ascent, width);
  }

  getCanvasSpoilers(canvas, parent, selector).forEach((spoiler) => {
    const walker = ownerDocument.createTreeWalker(spoiler, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const style = getComputedStyle(node.parentElement!);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.direction = style.direction as CanvasDirection;
      context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      context.fillStyle = style.color;

      for (const match of (node as Text).data.matchAll(WORD_REGEX)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = range.getClientRects();
        if (rects.length === 1) {
          drawText(match[0], rects[0]);
          continue;
        }

        // A word broken between lines is drawn by characters
        let offset = match.index;
        for (const char of match[0]) {
          range.setStart(node, offset);
          range.setEnd(node, offset + char.length);
          offset += char.length;
          const charRect = range.getClientRects()[0];
          if (charRect) drawText(char, charRect);
        }
      }
    }

    spoiler.querySelectorAll<HTMLImageElement>('img.emoji, .emoji img').forEach((image) => {
      if (!image.complete || !image.naturalWidth) return;

      const { x, y, width, height } = toCanvas(image.getBoundingClientRect());
      context.drawImage(image, x, y, width, height);
    });
  });

  return glyphs.transferToImageBitmap();
}

export function findGpuSharedCanvas(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const canvas = parent.querySelector<HTMLCanvasElement>(':scope > .gpu-shared-canvas');
    if (canvas) return canvas;
  }

  return undefined;
}

function getCanvasSpoilers(canvas: HTMLCanvasElement, parent: HTMLElement, selector: string) {
  return Array.from(parent.querySelectorAll<HTMLElement>(selector))
    .filter((spoiler) => findGpuSharedCanvas(spoiler) === canvas);
}

// Rendered size of the canvas per its layout size, which differs while the message appearance animation scales it
function getCanvasScale(canvas: HTMLCanvasElement) {
  const { offsetWidth } = canvas;

  return (offsetWidth && canvas.getBoundingClientRect().width / offsetWidth) || 1;
}
