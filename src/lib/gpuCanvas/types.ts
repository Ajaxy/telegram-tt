export type GpuCanvasKind = 'text' | 'media';

// Edge fade from each side of a drawn text spoiler region in CSS pixels, which is larger by half of it
export const SPOILER_EDGE_FADE = 4;

// Side of the glyphs of text spoilers in pixels, which every WebGPU device supports for a texture
export const MAX_SPOILER_GLYPHS_SIZE = 8192;

// Text spoiler reveal timings in milliseconds. A particle waits for its distance from the click as a share
// of the farthest one times `spread` plus a random share of `jitter`, flies to its glyph for `fly`, then fades into
// the text for `fade`.
export const SPOILER_MORPH = {
  spread: 250,
  jitter: 120,
  fly: 450,
  fade: 200,
};
export const SPOILER_MORPH_DURATION = SPOILER_MORPH.spread + SPOILER_MORPH.jitter + SPOILER_MORPH.fly
  + SPOILER_MORPH.fade;

export type SpoilerRect = {
  // Left, top, width and height in CSS pixels relative to the canvas
  x: number;
  y: number;
  width: number;
  height: number;
  // Particle density, a word gets 1 and a line box gets less
  density: number;
  color: string;
  // Marks where a concealed custom emoji is drawn, without particles of its own
  isEmoji?: boolean;
};

export type GpuCanvasCommand =
  { type: 'create'; id: number; canvas: OffscreenCanvas; kind: GpuCanvasKind }
  | { type: 'resize'; id: number; width: number; height: number; dpr: number }
  | { type: 'setSpoilers'; id: number; rects: SpoilerRect[] }
  // The origin is in CSS pixels relative to the canvas. Text spoilers send their glyphs drawn in CSS pixels,
  // which particles fly to.
  | { type: 'reveal'; id: number; x: number; y: number; glyphs?: ImageBitmap }
  | { type: 'setVisible'; id: number; isVisible: boolean }
  | { type: 'destroy'; id: number }
  // `x` and `y` are fractions of the canvas size, `size` is in CSS pixels
  | { type: 'setEmoji'; id: number; viewId: string; renderId: string; x: number; y: number; size: number }
  | { type: 'drawEmoji'; id: number; viewId: string; frameIndex: number }
  | { type: 'removeEmoji'; id: number; viewId: string }
  | { type: 'clearFrames'; renderId: string; generation: number }
  | { type: 'dropFrame'; renderId: string; frameIndex: number }
  | { type: 'connectMediaWorker'; port: MessagePort }
  | { type: 'setPlayback'; isAnimated: boolean; isPaused: boolean; maxFps?: number };

// Sent by a media worker straight to the canvas worker, so the frames skip the main thread
export type GpuCanvasFrame = {
  renderId: string;
  generation: number;
  frameIndex: number;
  size: number;
  pixels: ArrayBuffer;
};

export type GpuCanvasWorkerMessage = { type: 'ready' } | { type: 'unavailable' };
