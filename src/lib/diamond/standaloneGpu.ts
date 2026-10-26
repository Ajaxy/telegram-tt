import type { GpuCanvas, GpuDrawGroup, GpuRenderer } from './gpu';
import type StandaloneDiamond from './standalone';

import { getOpenModalCount } from '../../util/openModals';
import {
  addGpuDrawGroup, createGpuCanvas, getCanUseGpu, removeGpuDrawGroup, requestGpuRenderer, updateGpuPlayback,
} from './gpu';
import { getIsDiamond3dDegraded } from './performance';

// Standalone diamonds drawn with WebGPU straight into their canvases. Without WebGPU, or when it cannot start, a
// diamond falls back.

type Entry = {
  renderer: GpuRenderer;
  gpu: GpuCanvas;
  isInDialog: boolean;
  isReady: boolean;
};

const DIALOG_SELECTOR = 'dialog, [role="dialog"]';
// Up to 60 frames per second
const MIN_FRAME_INTERVAL = 9.5;

const entries = new Map<StandaloneDiamond, Entry>();
const pendingDiamonds = new Set<StandaloneDiamond>();
const visibleCanvases = new Set<HTMLCanvasElement>();
let observer: IntersectionObserver | undefined;

// A standalone diamond goes on during heavy animations, such as the slide of a screen
const group: GpuDrawGroup = {
  getMinInterval: () => MIN_FRAME_INTERVAL,
  getIsPlaying: getIsAnyDiamondDrawn,
  draw: drawDiamonds,
};

getIsDiamond3dDegraded.subscribe(() => {
  if (!getIsDiamond3dDegraded()) return;

  const diamonds = [...entries.keys(), ...pendingDiamonds];
  diamonds.forEach(removeEntry);
  pendingDiamonds.clear();
  diamonds.forEach(({ onFallback }) => onFallback?.());
});
getOpenModalCount.subscribe(updateGpuPlayback);

export function registerStandaloneDiamond(diamond: StandaloneDiamond) {
  if (!getCanUseGpu()) {
    diamond.onFallback?.();
    return;
  }

  pendingDiamonds.add(diamond);

  void requestGpuRenderer().then((renderer) => {
    // The diamond may be gone already, or have fallen back with the others
    if (!pendingDiamonds.delete(diamond)) return;

    const gpu = renderer && createGpuCanvas(renderer, diamond.canvas, 'icon');
    if (!renderer || !gpu) {
      diamond.onFallback?.();
      return;
    }

    entries.set(diamond, {
      renderer, gpu, isInDialog: Boolean(diamond.canvas.closest(DIALOG_SELECTOR)), isReady: false,
    });
    if (entries.size === 1) addGpuDrawGroup(group);
    getObserver().observe(diamond.canvas);
    updateGpuPlayback();
  });
}

export function unregisterStandaloneDiamond(diamond: StandaloneDiamond) {
  pendingDiamonds.delete(diamond);
  removeEntry(diamond);
  updateGpuPlayback();
}

export { updateGpuPlayback as updateStandaloneDiamondPlayback };

function removeEntry(diamond: StandaloneDiamond) {
  const entry = entries.get(diamond);
  if (!entry) return;

  entries.delete(diamond);
  visibleCanvases.delete(diamond.canvas);
  observer?.unobserve(diamond.canvas);
  entry.gpu.destroy();
  if (!entries.size) removeGpuDrawGroup(group);
}

function getIsAnyDiamondDrawn() {
  for (const [diamond, entry] of entries) {
    if (getShouldDrawDiamond(diamond, entry)) return true;
  }

  return false;
}

function getShouldDrawDiamond(diamond: StandaloneDiamond, { isInDialog }: Entry) {
  return !diamond.isPaused && visibleCanvases.has(diamond.canvas)
    && getOpenModalCount() <= (isInDialog ? 1 : 0);
}

function drawDiamonds(encoder: GPUCommandEncoder, frameTime: number) {
  const drawn: StandaloneDiamond[] = [];

  entries.forEach((entry, diamond) => {
    if (!getShouldDrawDiamond(diamond, entry)) return;

    drawDiamond(encoder, diamond, entry, frameTime);
    drawn.push(diamond);
  });

  drawn.forEach((diamond) => {
    const entry = entries.get(diamond)!;
    if (entry.isReady) return;

    entry.isReady = true;
    diamond.onReady?.();
  });
}

// The salute goes first and the diamond over it
function drawDiamond(encoder: GPUCommandEncoder, diamond: StandaloneDiamond, entry: Entry, frameTime: number) {
  const { scene, stars } = entry.renderer;
  const { gpu } = entry;

  diamond.advance(frameTime);

  const size = diamond.canvas.width;
  const pass = gpu.beginPass(encoder);

  if (diamond.bursts.length) {
    stars.draw(
      pass, gpu.starTarget, { x: 0, y: 0, size }, diamond.bursts, diamond.elapsed, diamond.starOpacity,
      diamond.burstSize,
    );
  }

  const frameSize = Math.min(size, Math.round(diamond.frameSize * diamond.scale));

  if (!diamond.isStoneHidden && frameSize > 0) {
    const offset = Math.floor((size - frameSize) / 2);

    scene.draw(
      pass, gpu.sceneTarget, diamond.drawState, { x: offset, y: size - offset - frameSize, size: frameSize },
      diamond.elapsed, frameTime, diamond.motion.yaw, diamond.motion.pitch,
    );
  }

  pass.end();
}

// A slide left behind by `Transition` is hidden with `display: none` and a row scrolled away is clipped, so neither
// intersects the viewport
function getObserver() {
  observer ??= new IntersectionObserver((observed) => {
    observed.forEach(({ target, isIntersecting }) => {
      const canvas = target as HTMLCanvasElement;

      if (isIntersecting) {
        visibleCanvases.add(canvas);
      } else {
        visibleCanvases.delete(canvas);
      }
    });

    updateGpuPlayback();
  });

  return observer;
}
