import type {
  CropState, EditorLayer, MediaEditDocument, VideoQualityLevel, VideoTrim,
} from '../../../types/mediaEditor';
import type { VideoProcessingMode } from './export/videoQuality';
import type { Size } from './render/transform';

import { AVATAR_VIDEO_MAX_DURATION, MIN_VIDEO_TRIM_DURATION } from '../../../config';
import { compact, uniqueByField } from '../../../util/iteratees';
import { clamp } from '../../../util/math';
import { getCropSize } from './export/videoQuality';
import { hasColorAdjustments } from './render/adjustments/values';
import { getIsLayerVisible } from './render/layers';
import { computeCenteredCrop, DEFAULT_CROP_STATE, getFrameMatrix } from './crop';

export const EMPTY_EDIT_DOCUMENT: MediaEditDocument = {
  crop: DEFAULT_CROP_STATE,
  paint: [],
};

export function createEditDocument(sourceSize: Size, lockedAspectRatio?: number): MediaEditDocument {
  return {
    crop: {
      ...DEFAULT_CROP_STATE,
      ...computeCenteredCrop(sourceSize.width, sourceSize.height, lockedAspectRatio),
    },
    paint: [],
  };
}

export function clampCoverTime(time: number, start: number, end: number, frameDuration: number) {
  return clamp(time, start, Math.max(start, end - frameDuration));
}

export function createAvatarVideoDocument(
  sourceSize: Size, duration: number, frameDuration: number, coverTime = 0,
): MediaEditDocument {
  const trim = duration > AVATAR_VIDEO_MAX_DURATION ? { start: 0, end: AVATAR_VIDEO_MAX_DURATION } : undefined;

  return {
    ...createEditDocument(sourceSize, 1),
    trim,
    cover: { type: 'frame', time: clampCoverTime(coverTime, 0, trim?.end ?? duration, frameDuration) },
    isMuted: true,
  };
}

export function applyTrim(
  doc: MediaEditDocument, trim: VideoTrim, duration: number, frameDuration: number,
): MediaEditDocument {
  const start = clamp(trim.start, 0, duration - MIN_VIDEO_TRIM_DURATION);
  const end = clamp(trim.end, start + MIN_VIDEO_TRIM_DURATION, duration);
  let { cover } = doc;
  if (cover?.type === 'frame') {
    const time = clampCoverTime(cover.time, start, end, frameDuration);
    if (time !== cover.time) cover = { type: 'frame', time };
  }

  return {
    ...doc,
    trim: start <= 0 && end >= duration ? undefined : { start, end },
    cover,
  };
}

// Layers keep their place on the image, like the paint, which lives in source pixels
export function applyCrop(doc: MediaEditDocument, crop: CropState, sourceSize: Size): MediaEditDocument {
  const { crop: prevCrop, layers } = doc;
  if (crop === prevCrop || !layers?.length) return { ...doc, crop };

  const matrix = getFrameMatrix(crop, sourceSize).multiply(getFrameMatrix(prevCrop, sourceSize).inverse());
  const { a, b } = matrix;
  const determinant = a * matrix.d - b * matrix.c;
  const isMirrored = determinant < 0;
  const angle = (Math.atan2(isMirrored ? -b : b, isMirrored ? -a : a) * 180) / Math.PI;
  const scale = Math.sqrt(Math.abs(determinant));

  return {
    ...doc,
    crop,
    layers: layers.map((layer) => {
      const { x, y } = matrix.transformPoint({
        x: layer.x * prevCrop.cropperWidth,
        y: layer.y * prevCrop.cropperHeight,
      });

      return {
        ...layer,
        x: x / crop.cropperWidth,
        y: y / crop.cropperHeight,
        rotation: isMirrored ? angle - layer.rotation : layer.rotation + angle,
        scale: layer.scale * scale * (getLayerBaseSize(layer, prevCrop) / getLayerBaseSize(layer, crop)),
      };
    }),
  };
}

function getLayerBaseSize(layer: EditorLayer, crop: CropState) {
  return layer.type === 'sticker' ? Math.min(crop.cropperWidth, crop.cropperHeight) : crop.cropperWidth;
}

export function getAttachedStickers({ layers, crop }: MediaEditDocument) {
  const frameSize = getCropSize(crop);
  const stickers = compact(layers?.map((layer) => (
    layer.sticker && getIsLayerVisible(layer, frameSize) ? layer.sticker : undefined
  )) ?? []);
  return stickers.length ? uniqueByField(stickers, 'id') : undefined;
}

export function getVideoProcessingMode(
  doc: MediaEditDocument, sourceSize: Size, qualityLevel?: VideoQualityLevel, shouldTranscodeAudio?: boolean,
): VideoProcessingMode {
  if (qualityLevel || hasPictureEdits(doc, sourceSize) || (doc.trim && doc.trim.start > 0)) {
    return 'transcode';
  }

  if (!doc.trim && !doc.isMuted) return 'none';

  return shouldTranscodeAudio && !doc.isMuted ? 'transcode' : 'remux';
}

export function hasPictureEdits(doc: MediaEditDocument, sourceSize: Size) {
  return Boolean(
    doc.paint.length || doc.layers?.length || hasColorAdjustments(doc) || isCropChanged(doc.crop, sourceSize),
  );
}

function isCropChanged(crop: CropState, sourceSize: Size) {
  return crop.rotation !== 0 || crop.quarterTurns !== 0 || crop.flipH
    || Math.round(crop.cropperX) !== 0 || Math.round(crop.cropperY) !== 0
    || Math.round(crop.cropperWidth) !== sourceSize.width || Math.round(crop.cropperHeight) !== sourceSize.height;
}
