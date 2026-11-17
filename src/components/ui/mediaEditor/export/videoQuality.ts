import type { CropState, VideoProcessingParams, VideoQualityLevel } from '../../../../types/mediaEditor';
import type { Size } from '../render/transform';

import {
  AVATAR_MAX_SIDE, AVATAR_MIN_SIDE, VIDEO_GIF_LEVEL, VIDEO_LOW_LEVEL_MAX_FRAME_RATE, VIDEO_MAX_FRAME_RATE,
} from '../../../../config';
import { clamp } from '../../../../util/math';

export type VideoProcessingMode = 'none' | 'remux' | 'transcode';

const MAX_PROCESSED_LEVEL: VideoQualityLevel = 1080;
const QUALITY_LEVELS: VideoQualityLevel[] = [240, 360, 480, 600, 720, 1080];
const LEVEL_ASPECT = 16 / 9;
const BITS_PER_PIXEL = 0.07;
const MIN_VIDEO_BITRATE = 200_000;
const MAX_VIDEO_BITRATE = 6_800_000;
const TRANSCODED_AUDIO_BITRATE = 128_000;
const CONTAINER_OVERHEAD = 1.01;
const PHOTO_GIF_FRAME_RATE = 30;

export function getCropSize(crop: CropState): Size {
  return { width: Math.round(crop.cropperWidth), height: Math.round(crop.cropperHeight) };
}

function fitIntoLevel(size: Size, level: number): Size {
  const scale = getLevelScale(size, level);

  return {
    width: toEven(size.width * scale),
    height: toEven(size.height * scale),
  };
}

function getLevelScale(size: Size, level: number) {
  const isPortrait = size.height > size.width;
  const maxWidth = isPortrait ? level : level * LEVEL_ASPECT;
  const maxHeight = isPortrait ? level * LEVEL_ASPECT : level;
  return Math.min(1, maxWidth / size.width, maxHeight / size.height);
}

export function getOutputSize(cropSize: Size, mode: VideoProcessingMode, level?: VideoQualityLevel) {
  if (mode !== 'transcode') return cropSize;
  return fitIntoLevel(cropSize, level ?? MAX_PROCESSED_LEVEL);
}

export function getAvatarSize(cropSize: Size): Size {
  const side = toEven(clamp(Math.min(cropSize.width, cropSize.height), AVATAR_MIN_SIDE, AVATAR_MAX_SIDE));
  return { width: side, height: side };
}

export function getAvailableLevels(cropSize: Size, isProcessed: boolean) {
  const originalLevel = getOriginalLevel(cropSize, isProcessed);
  return QUALITY_LEVELS.filter((level) => level < originalLevel);
}

export function getOriginalLevel(cropSize: Size, isProcessed: boolean) {
  const { width, height } = isProcessed ? getOutputSize(cropSize, 'transcode') : cropSize;
  return Math.min(width, height);
}

export function getMaxLevel(cropSize: Size) {
  return getDownscalingLevel(cropSize, MAX_PROCESSED_LEVEL);
}

export function getGifLevel(cropSize: Size) {
  return getDownscalingLevel(cropSize, VIDEO_GIF_LEVEL);
}

export function getPhotoGifProcessing(sourceSize: Size, cropSize: Size): VideoProcessingParams {
  const outputSize = getOutputSize(cropSize, 'transcode', getGifLevel(cropSize));

  return {
    mode: 'transcode',
    sourceSize,
    outputSize,
    bitrate: getVideoBitrate(outputSize, PHOTO_GIF_FRAME_RATE, Infinity),
    frameRate: PHOTO_GIF_FRAME_RATE,
  };
}

function getDownscalingLevel(cropSize: Size, level: VideoQualityLevel) {
  return getLevelScale(cropSize, level) < 1 ? level : undefined;
}

export function getOutputFrameRate(sourceFrameRate: number, level?: VideoQualityLevel) {
  const maxFrameRate = level && level <= 480 ? VIDEO_LOW_LEVEL_MAX_FRAME_RATE : VIDEO_MAX_FRAME_RATE;
  return Math.min(sourceFrameRate, maxFrameRate);
}

export function getVideoBitrate(size: Size, frameRate: number, sourceBitrate: number) {
  const bitrate = Math.min(
    Math.max(size.width * size.height * frameRate * BITS_PER_PIXEL, MIN_VIDEO_BITRATE),
    MAX_VIDEO_BITRATE,
  );

  return Math.round(Math.min(bitrate, sourceBitrate));
}

export function estimateVideoSize({
  mode,
  sourceSize,
  duration,
  outputDuration,
  videoBitrate,
  audioBitrate,
  discardedAudioBitrate,
}: {
  mode: VideoProcessingMode;
  sourceSize: number;
  duration: number;
  outputDuration: number;
  videoBitrate: number;
  audioBitrate: number;
  discardedAudioBitrate: number;
}) {
  if (mode !== 'transcode') {
    return Math.round(sourceSize * (outputDuration / duration) - (discardedAudioBitrate / 8) * outputDuration);
  }

  return Math.round(((videoBitrate + audioBitrate) / 8) * outputDuration * CONTAINER_OVERHEAD);
}

export function getAudioBitrateEstimate(sourceAudioBitrate: number | undefined, isTranscoded: boolean) {
  return isTranscoded ? TRANSCODED_AUDIO_BITRATE : sourceAudioBitrate || 0;
}

function toEven(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}
