type Glyph = {
  text: string;
  font: string;
  color: string;
  opacity: number;
  // Canvas pixels: the text box, and the box of its element, which clips it as on the screen
  box: number[];
  clip: number[];
  isEllipsized: boolean;
};

const ELLIPSIS = '\u2026';

// A weaker lens cannot be seen, so it is not drawn
export const MIN_LENS_STRENGTH = 0.002;

const keys = new WeakMap<HTMLCanvasElement, string>();

// Draws the text inside `elements` into a square canvas of `size` pixels where it stands on the screen. A screen point
// lands `scale` canvas pixels per screen pixel from (`left`, `top`). Returns whether the drawing changed, so a still
// one is not uploaded again.
export function drawLensText(
  canvas: HTMLCanvasElement,
  size: number,
  elements: HTMLElement[],
  {
    left, top, scale, ink,
  }: { left: number; top: number; scale: number; ink?: string },
) {
  function convertRectToCanvas({
    left: x, top: y, width, height,
  }: DOMRect) {
    return [(x - left) * scale, (y - top) * scale, width * scale, height * scale];
  }

  const glyphs: Glyph[] = [];

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    // The element may be scaled to fit, and its text scales with it
    const elementScale = element.offsetWidth ? rect.width / element.offsetWidth : 1;
    const clip = convertRectToCanvas(rect);
    const hasEllipsis = getComputedStyle(element).textOverflow === 'ellipsis';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement!;
      const style = getComputedStyle(parent);
      if (!node.textContent || style.visibility !== 'visible') continue;

      const range = document.createRange();
      range.selectNodeContents(node);

      const box = convertRectToCanvas(range.getBoundingClientRect());

      glyphs.push({
        text: node.textContent,
        font: `${style.fontWeight} ${parseFloat(style.fontSize) * elementScale * scale}px ${style.fontFamily}`,
        color: ink ?? style.color,
        opacity: getOpacity(parent, Number(style.opacity), element),
        box,
        clip,
        isEllipsized: (hasEllipsis || style.textOverflow === 'ellipsis') && box[0] + box[2] > clip[0] + clip[2],
      });
    }
  });

  const key = JSON.stringify([size, glyphs]);
  if (keys.get(canvas) === key) return false;

  keys.set(canvas, key);

  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, size, size);

  glyphs.forEach(({
    text, font, color, opacity, box: [x, y, width, height], clip, isEllipsized,
  }) => {
    context.save();
    context.beginPath();
    context.rect(clip[0], clip[1], clip[2], clip[3]);
    context.clip();
    context.font = font;
    context.fillStyle = color;
    context.globalAlpha = opacity;

    let shownText = text;
    if (isEllipsized) {
      const room = clip[0] + clip[2] - x;
      while (shownText && context.measureText(shownText + ELLIPSIS).width > room) shownText = shownText.slice(0, -1);
      shownText += ELLIPSIS;
    }

    const { width: textWidth, fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = context
      .measureText(shownText);

    // Centered in its box and on its line, as the browser lays it out. A cut text keeps its start.
    const textX = isEllipsized ? x : x + (width - textWidth) / 2;
    context.fillText(shownText, textX, y + (height - descent + ascent) / 2);
    context.restore();
  });

  return true;
}

// The text fades with every element from its parent up to `element`, the root of the walk
function getOpacity(parent: Element, parentOpacity: number, element: Element) {
  let opacity = parentOpacity;

  for (let node = parent; node !== element;) {
    node = node.parentElement!;
    opacity *= Number(getComputedStyle(node).opacity);
  }

  return opacity;
}
