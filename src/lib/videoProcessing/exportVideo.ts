import type {
  ConversionAudioOptions, ConversionOptions, ConversionVideoOptions, InputAudioTrack,
} from 'mediabunny';
import {
  BufferTarget, Conversion, Mp4OutputFormat, Output, Quality,
} from 'mediabunny';

import type { LayerFrames } from '../../components/ui/mediaEditor/render/layers';
import type { Size } from '../../components/ui/mediaEditor/render/transform';
import type { MediaEditDocument } from '../../types/mediaEditor';
import type { CancellableCallback } from '../../util/PostMessageConnector';

import { composeFrame, createFrameScratch } from '../../components/ui/mediaEditor/render/composeFrame';
import { createInput } from './input';
import { getAudioHandling } from './probe';
import { getUprightFrame } from './renderFrame';

type ExportVideoParams = {
  doc: MediaEditDocument;
  sourceSize: Size;
  outputSize: Size;
  mode: 'remux' | 'transcode';
  bitrate: number;
  frameRate?: number;
  trim?: { start: number; end: number };
  isMuted?: boolean;
  layerFrames?: LayerFrames;
};

export const KEY_FRAME_INTERVAL = 1; // s
const PROGRESS_STEP = 0.01;
const AAC_BITRATE_PER_CHANNEL = 64_000;
const AAC_SAMPLE_RATE = 48_000;
const AAC_MAX_CHANNELS = 2;

export async function exportVideo(file: Blob, {
  doc, sourceSize, outputSize, mode, bitrate, frameRate, trim, isMuted, layerFrames,
}: ExportVideoParams, onProgress: CancellableCallback) {
  const input = createInput(file);
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  try {
    const videoTrackId = (await input.getPrimaryVideoTrack())?.id;
    const audioTrackId = isMuted ? undefined : (await input.getPrimaryAudioTrack())?.id;
    let videoOptions: ConversionVideoOptions | undefined;
    const options: ConversionOptions = {
      input,
      output,
      trim,
      video: (track) => (track.id === videoTrackId ? videoOptions : { discard: true }),
      audio: async (track) => {
        if (track.id !== audioTrackId) return { discard: true };
        return mode === 'transcode' && await getAudioHandling(track) === 'transcode' ? getAacOptions(track) : undefined;
      },
      showWarnings: false,
    };

    if (mode === 'transcode') {
      const frameCanvas = new OffscreenCanvas(sourceSize.width, sourceSize.height);
      const resultCanvas = new OffscreenCanvas(outputSize.width, outputSize.height);
      const resultCtx = resultCanvas.getContext('2d')!;
      const scratch = createFrameScratch();

      videoOptions = {
        forceTranscode: true,
        allowTransformationMetadata: false,
        codec: 'avc',
        quality: new Quality({ bitrate }),
        keyFrameInterval: KEY_FRAME_INTERVAL,
        frameRate,
        processedWidth: outputSize.width,
        processedHeight: outputSize.height,
        process: (sample) => {
          composeFrame({
            ctx: resultCtx,
            frame: getUprightFrame(sample, frameCanvas),
            sourceSize,
            doc,
            scratch,
            shouldRequireAdjustments: true,
            layerFrames,
            time: Math.max(0, sample.timestamp),
          });
          return resultCanvas;
        },
      };
      options.copy = { boundaryPolicy: 'shrink' };
    } else {
      options.copy = { mode: 'forced', boundaryPolicy: 'shrink' };
    }

    const conversion = await Conversion.init(options);
    assertConversion(conversion, isMuted);

    let lastProgress = 0;
    conversion.onProgress = (progress) => {
      if (onProgress.isCanceled) {
        void conversion.cancel();
        return;
      }

      if (progress - lastProgress >= PROGRESS_STEP) {
        lastProgress = progress;
        onProgress(progress);
      }
    };

    try {
      await conversion.execute();
    } catch (err) {
      if (onProgress.isCanceled) return undefined;
      throw err;
    }
    if (conversion.state === 'canceled' || onProgress.isCanceled) return undefined;

    return {
      blob: new Blob([output.target.buffer!], { type: 'video/mp4' }),
      width: outputSize.width,
      height: outputSize.height,
    };
  } finally {
    input.dispose();
  }
}

function getAacOptions(track: InputAudioTrack): ConversionAudioOptions {
  const numberOfChannels = Math.min(track.numberOfChannels, AAC_MAX_CHANNELS);

  return {
    codec: 'aac',
    numberOfChannels,
    sampleRate: AAC_SAMPLE_RATE,
    bitrate: AAC_BITRATE_PER_CHANNEL * numberOfChannels,
  };
}

function assertConversion(conversion: Conversion, isMuted?: boolean) {
  const lostTrack = conversion.discardedTracks.find(({ track, reason }) => (
    reason !== 'discarded_by_user' && (track.type === 'video' || !isMuted)
  ));
  if (!lostTrack && conversion.isValid) return;

  throw new Error(lostTrack?.track.type === 'audio' ? 'unsupportedAudio' : 'decodeFailed');
}
