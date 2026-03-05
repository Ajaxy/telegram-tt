export type DrawTool = 'pen' | 'arrow' | 'brush' | 'neon' | 'eraser';

export const ARROW_ANIMATION_DURATION = 200;
const offscreen = document.createElement('canvas');

export function getEffectiveDimensions(imgWidth: number, imgHeight: number, quarterTurns: number) {
  const isSideways = quarterTurns % 2 === 1;
  return {
    width: isSideways ? imgHeight : imgWidth,
    height: isSideways ? imgWidth : imgHeight,
  };
}

export function computeRotationZoom(effectiveW: number, effectiveH: number, fineRotation: number) {
  if (fineRotation === 0 || effectiveW <= 0 || effectiveH <= 0) return 1;
  const rad = Math.abs(fineRotation * Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return Math.max(
    cos + (effectiveH / effectiveW) * sin,
    (effectiveW / effectiveH) * sin + cos,
  );
}

export interface DrawAction {
  type: 'draw';
  tool: DrawTool;
  points: Array<{ x: number; y: number }>;
  color: string;
  brushSize: number;
  completedAt?: number;
  isShiftPressed?: boolean;
}

export function renderDrawAction(
  ctx: CanvasRenderingContext2D,
  action: DrawAction,
  offsetX = 0,
  offsetY = 0,
  isComplete = true,
) {
  if (action.points.length < 2) return;

  ctx.save();

  if (action.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = action.brushSize * 2;
  } else if (action.tool === 'neon') {
    ctx.shadowColor = action.color;
    ctx.shadowBlur = action.brushSize * 2;
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.brushSize * 0.5;
  } else if (action.tool === 'brush') {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.brushSize * 2;
  } else {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.brushSize;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (action.tool === 'arrow') {
    renderArrow(ctx, action, offsetX, offsetY, isComplete);
  } else {
    renderPath(ctx, action, offsetX, offsetY);
  }

  ctx.restore();
}

function renderArrow(
  ctx: CanvasRenderingContext2D,
  action: DrawAction,
  offsetX: number,
  offsetY: number,
  isComplete: boolean,
) {
  if (action.points.length < 2) return;

  const firstPoint = action.points[0];
  const lastPoint = action.points[action.points.length - 1];

  // Draw the path
  ctx.beginPath();
  ctx.moveTo(firstPoint.x + offsetX, firstPoint.y + offsetY);

  for (let i = 1; i < action.points.length; i++) {
    const point = action.points[i];
    ctx.lineTo(point.x + offsetX, point.y + offsetY);
  }
  ctx.stroke();

  // Only draw arrowhead when drawing is complete
  if (!isComplete) return;

  // Calculate angle from a point further back for stable direction that follows the path
  // Use a point 10 steps back, or the first point if path is shorter
  const lookbackIndex = Math.max(0, action.points.length - 10);
  const referencePoint = action.points[lookbackIndex];

  const angle = Math.atan2(
    lastPoint.y - referencePoint.y,
    lastPoint.x - referencePoint.x,
  );

  // Animate arrowhead appearance
  const elapsed = action.completedAt ? Date.now() - action.completedAt : ARROW_ANIMATION_DURATION;
  const progress = Math.min(elapsed / ARROW_ANIMATION_DURATION, 1);
  // Ease out cubic for smooth animation
  const easedProgress = 1 - ((1 - progress) ** 3);

  const headLength = action.brushSize * 3 * easedProgress;

  ctx.beginPath();
  ctx.moveTo(lastPoint.x + offsetX, lastPoint.y + offsetY);
  ctx.lineTo(
    lastPoint.x + offsetX - headLength * Math.cos(angle - Math.PI / 6),
    lastPoint.y + offsetY - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(lastPoint.x + offsetX, lastPoint.y + offsetY);
  ctx.lineTo(
    lastPoint.x + offsetX - headLength * Math.cos(angle + Math.PI / 6),
    lastPoint.y + offsetY - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function renderPath(
  ctx: CanvasRenderingContext2D,
  action: DrawAction,
  offsetX: number,
  offsetY: number,
) {
  ctx.beginPath();
  const firstPoint = action.points[0];
  ctx.moveTo(firstPoint.x + offsetX, firstPoint.y + offsetY);

  for (let i = 1; i < action.points.length; i++) {
    const point = action.points[i];
    ctx.lineTo(point.x + offsetX, point.y + offsetY);
  }
  ctx.stroke();
}

export function applyCanvasTransform(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rotation: number,
  flipH: boolean,
  quarterTurns = 0,
  scale = 1,
) {
  const { width: effW, height: effH } = getEffectiveDimensions(image.width, image.height, quarterTurns);
  ctx.translate(effW / 2, effH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale * (flipH ? -1 : 1), scale);
  ctx.translate(-image.width / 2, -image.height / 2);
}

export function renderImageToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  targetWidth: number,
  targetHeight: number,
  isCropMode: boolean,
  rotation = 0,
  flipH = false,
  quarterTurns = 0,
  scale = 1,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();

  if (rotation !== 0 || flipH || quarterTurns !== 0 || scale !== 1) {
    applyCanvasTransform(ctx, img, rotation, flipH, quarterTurns, scale);
  }

  if (isCropMode) {
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(
      img,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, targetWidth, targetHeight,
    );
  }

  ctx.restore();
}

export function renderActionsToCanvas(
  ctx: CanvasRenderingContext2D,
  actions: DrawAction[],
  offsetX = 0,
  offsetY = 0,
  currentAction?: DrawAction,
  offscreenWidth?: number,
  offscreenHeight?: number,
) {
  const hasCurrentAction = currentAction && !actions.includes(currentAction);
  if (actions.length === 0 && !hasCurrentAction) return;

  const width = offscreenWidth || ctx.canvas.width;
  const height = offscreenHeight || ctx.canvas.height;
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d')!;
  offCtx.clearRect(0, 0, width, height);

  actions.forEach((action) => {
    renderDrawAction(offCtx, action, offsetX, offsetY, true);
  });

  if (hasCurrentAction) {
    renderDrawAction(offCtx, currentAction, offsetX, offsetY, false);
  }

  ctx.drawImage(offscreen, 0, 0);
}
