import type { DrawAction } from '../../../../types/mediaEditor';
import type { Context2D } from './transform';

export const ARROW_ANIMATION_DURATION = 200;

function renderDrawAction(
  ctx: Context2D,
  action: DrawAction,
  pixelScale: number,
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
    ctx.shadowBlur = action.brushSize * 2 * pixelScale;
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
    renderArrow(ctx, action, isComplete);
  } else {
    renderPath(ctx, action);
  }

  ctx.restore();
}

function renderArrow(
  ctx: Context2D,
  action: DrawAction,
  isComplete: boolean,
) {
  if (action.points.length < 2) return;

  const lastPoint = action.points[action.points.length - 1];

  renderPath(ctx, action);

  // Only draw arrowhead when drawing is complete
  if (!isComplete) return;

  const referencePoint = action.points.findLast((point) => (
    Math.hypot(lastPoint.x - point.x, lastPoint.y - point.y) > action.brushSize / 2
  )) ?? action.points[0];

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
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(
    lastPoint.x - headLength * Math.cos(angle - Math.PI / 6),
    lastPoint.y - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(
    lastPoint.x - headLength * Math.cos(angle + Math.PI / 6),
    lastPoint.y - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function renderPath(
  ctx: Context2D,
  action: DrawAction,
) {
  const { points } = action;
  const lastIndex = points.length - 1;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < lastIndex - 1; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];
    ctx.quadraticCurveTo(point.x, point.y, (point.x + nextPoint.x) / 2, (point.y + nextPoint.y) / 2);
  }

  const controlPoint = points[lastIndex - 1];
  ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, points[lastIndex].x, points[lastIndex].y);
  ctx.stroke();
}

export function renderActionsToCanvas(
  ctx: Context2D,
  paintCanvas: OffscreenCanvas,
  actions: DrawAction[],
  sourceTransform: DOMMatrix,
  currentAction?: DrawAction,
) {
  const hasCurrentAction = currentAction && !actions.includes(currentAction);
  if (actions.length === 0 && !hasCurrentAction) return;

  const { width, height } = ctx.canvas;
  if (paintCanvas.width !== width || paintCanvas.height !== height) {
    paintCanvas.width = width;
    paintCanvas.height = height;
  }
  const offCtx = paintCanvas.getContext('2d')!;
  offCtx.resetTransform();
  offCtx.clearRect(0, 0, width, height);
  offCtx.setTransform(sourceTransform);
  const pixelScale = Math.hypot(sourceTransform.a, sourceTransform.b);

  actions.forEach((action) => {
    renderDrawAction(offCtx, action, pixelScale);
  });

  if (hasCurrentAction) {
    renderDrawAction(offCtx, currentAction, pixelScale, false);
  }

  ctx.drawImage(paintCanvas, 0, 0);
}
