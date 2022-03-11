import { DPR } from './constants';
import { createElement } from './minifiers';

export function setupCanvas(container, { width, height }) {
  const canvas = createElement('canvas');

  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;

  const context = canvas.getContext('2d');
  context.scale(DPR, DPR);

  container.appendChild(canvas);

  return { canvas, context };
}

export function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}
