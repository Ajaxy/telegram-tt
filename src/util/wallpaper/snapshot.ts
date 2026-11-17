// The main wallpaper as a stylesheet: its layers composed by CSS the way the canvases and
// `_patternBackground.module.scss` compose them, so it fits any window size. `index.html` links it
// and the service worker serves it from the cache, so a page load paints it before any script runs.
// Like other wallpaper caches, it is not kept while a passcode is set.
import type { ThemeKey } from '../../types';
import type { WallpaperRenderModel } from './index';

import { WALLPAPER_SNAPSHOT_CACHE_NAME, WALLPAPER_SNAPSHOT_PATH } from '../../config';
import { loadPasscodeMeta, requestPasscodeStateLock } from '../passcode';
import { renderStaticGradient } from './gradient';
import { MIN_PATTERN_VIEW_HEIGHT } from './index';

type SnapshotLayers = {
  aspectRatio: number;
  patternTile?: HTMLCanvasElement;
  // Set when the theme follows the system, which may switch before the next page load
  systemTheme?: ThemeKey;
};

// The CSS layers the pre-render page, then any element with this class until the canvases draw
const HOST_SELECTORS = ['html.initial body', '.wallpaper-snapshot'];
// Safari encodes PNG instead, which keeps the transparency the pattern needs
const IMAGE_TYPE = 'image/webp';
// Encodes lossless: lossy alpha breaks doodle edges into blocks, which soft-light blending makes visible
const IMAGE_QUALITY = 1;
const KEY_HEADER = 'X-Snapshot-Key';

export async function saveWallpaperSnapshot(
  model: WallpaperRenderModel, { aspectRatio, patternTile, systemTheme }: SnapshotLayers,
) {
  if (!self.caches || await loadPasscodeMeta()) return;

  // Images load asynchronously anyway, and a stale snapshot would show before them
  if (model.isImage || !model.baseColor || (model.isPattern && !patternTile)) {
    await clearWallpaperSnapshot();
    return;
  }

  // The gradient direction depends on the aspect ratio only when rotated
  const key = JSON.stringify([
    model, model.backgroundRotation ? aspectRatio : undefined, patternTile?.width, patternTile?.height, systemTheme,
  ]);
  // Read on each save, as logout and passcode purges delete the cache from elsewhere
  if (await loadSavedKey() === key) return;

  let gradientUrl: string | undefined;
  if (model.colors.length >= 2) {
    const gradient = document.createElement('canvas');
    renderStaticGradient(gradient, model.colors, model.backgroundRotation, aspectRatio);
    gradientUrl = await encodeCanvas(gradient);
  }
  const patternUrl = patternTile && await encodeCanvas(patternTile);

  const css = buildSnapshotCss(model, gradientUrl, patternUrl);
  const response = new Response(systemTheme ? `@media (prefers-color-scheme: ${systemTheme}) {\n${css}\n}` : css, {
    headers: { 'Content-Type': 'text/css', [KEY_HEADER]: key },
  });

  await requestPasscodeStateLock(async () => {
    if (await loadPasscodeMeta()) return;

    const cache = await self.caches.open(WALLPAPER_SNAPSHOT_CACHE_NAME);
    await cache.put(buildSnapshotUrl(), response);
  });
}

export function clearWallpaperSnapshot() {
  return self.caches?.delete(WALLPAPER_SNAPSHOT_CACHE_NAME);
}

async function loadSavedKey() {
  const response = await self.caches.match(buildSnapshotUrl(), { cacheName: WALLPAPER_SNAPSHOT_CACHE_NAME });
  return response?.headers.get(KEY_HEADER) || undefined;
}

// The URL `index.html` requests, relative to the app root
function buildSnapshotUrl() {
  return new URL(WALLPAPER_SNAPSHOT_PATH, document.baseURI).href;
}

function buildSnapshotCss(model: WallpaperRenderModel, gradientUrl?: string, patternUrl?: string) {
  const { baseColor, isMaskedPattern, patternDimming } = model;
  const intensity = Math.abs(model.patternIntensity!) / 100;
  const rules = [
    `${select('')} { overflow: hidden; background-color: ${baseColor}; }`,
    `${select('::before')}, ${select('::after')} { content: ""; position: absolute; top: 0; right: 0; left: 0; }`,
  ];

  if (gradientUrl) {
    rules.push(`${select('::before')} { bottom: 0; background: url("${gradientUrl}") 0 0 / 100% 100%;`
      + ` opacity: ${isMaskedPattern ? intensity : 1}; }`);
  } else if (patternDimming !== undefined) {
    // Dimming applies to single-color patterns only, so the gradient layer is free for it
    rules.push(`${select('::before')} { z-index: 1; bottom: 0; background-color: #000; opacity: ${patternDimming}; }`);
  }

  if (patternUrl) {
    // Mirrors `drawPattern`: single-color patterns cover the view, others repeat from the left edge
    // or are centered when wider than it
    const layout = model.colors.length === 1 ? 'center / cover no-repeat' : 'min(0px, 50%) 0 / auto 100% repeat-x';
    const layer = isMaskedPattern
      ? `background-color: ${baseColor}; mask: linear-gradient(#000 0 0), url("${patternUrl}") ${layout};`
      + ' mask-composite: exclude;'
      : `background: url("${patternUrl}") ${layout}; opacity: ${intensity};`
        + ` mix-blend-mode: ${model.colors.length === 1 ? 'normal' : 'soft-light'};`;
    rules.push(`${select('::after')} { height: max(${MIN_PATTERN_VIEW_HEIGHT}px, 100%); ${layer} }`);
  }

  return rules.join('\n');
}

function select(pseudo: string) {
  return HOST_SELECTORS.map((selector) => `${selector}${pseudo}`).join(', ');
}

async function encodeCanvas(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, IMAGE_TYPE, IMAGE_QUALITY));
  if (!blob) throw new Error('WALLPAPER_SNAPSHOT_ENCODE_FAILED');

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
