import type { EditorLayer } from '../../../../types/mediaEditor';
import type { Size } from '../render/transform';

import { measureLayer } from '../render/layers';

export type SnapAnchor = 'start' | 'center' | 'end';

type SnapTarget = {
  anchor: SnapAnchor;
  position: number;
};

type AxisSnap = {
  value: number;
  anchor?: SnapAnchor;
};

const HOLD_DISTANCE = 6;
const RELEASE_DISTANCE = 18;
const MIN_TARGETS_GAP = RELEASE_DISTANCE * 2;
const EDGE_INSET_RATIO = 0.03;

export function getSnapInset({ width, height }: Size) {
  return Math.round(Math.min(width, height) * EDGE_INSET_RATIO);
}

export function getLayerHalfExtents(layer: EditorLayer, frameSize: Size, displayScale: number): Size {
  const { width, height } = measureLayer(layer, frameSize);
  const angle = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  return {
    width: ((width * cos + height * sin) * displayScale) / 2,
    height: ((width * sin + height * cos) * displayScale) / 2,
  };
}

export function createAxisSnap(start: number, halfExtent: number, length: number, inset: number) {
  const targets = buildTargets(halfExtent, length, inset);
  let skippedTarget = findTarget(targets, start);

  return (value: number): AxisSnap => {
    const target = findTarget(targets, value);
    if (target !== skippedTarget) skippedTarget = undefined;
    if (!target || target === skippedTarget) return { value };

    const offset = value - target.position;
    const distance = Math.abs(offset);
    if (distance <= HOLD_DISTANCE) return { value: target.position, anchor: target.anchor };

    const pull = ((distance - HOLD_DISTANCE) * RELEASE_DISTANCE) / (RELEASE_DISTANCE - HOLD_DISTANCE);
    return { value: target.position + Math.sign(offset) * pull };
  };
}

function buildTargets(halfExtent: number, length: number, inset: number): SnapTarget[] {
  const center = length / 2;
  const start = inset + halfExtent;
  const centerTarget: SnapTarget = { anchor: 'center', position: center };
  if (center - start < MIN_TARGETS_GAP) return [centerTarget];

  return [
    { anchor: 'start', position: start },
    centerTarget,
    { anchor: 'end', position: length - start },
  ];
}

function findTarget(targets: SnapTarget[], value: number) {
  return targets.find(({ position }) => Math.abs(value - position) < RELEASE_DISTANCE);
}
