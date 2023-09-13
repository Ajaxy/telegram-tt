import type { MP4ArrayBuffer, MP4Info, MP4VideoTrack } from 'mp4box';
import MP4Box, { DataStream } from 'mp4box';

import { requestPart } from './requestPart';

const META_PART_SIZE = 128 * 1024;
const MIN_PART_SIZE = 1024;
enum Status {
  loading = 'loading',
  ready = 'ready',
  closed = 'closed',
}

export type MP4DecoderConfig = {
  codec: string;
  codedHeight: number;
  codedWidth: number;
  description: Uint8Array;
};

type MP4DemuxerConfig = {
  stepOffset: number;
  stepMultiplier: number;
  isPolyfill: boolean;
  maxFrames: number;
  onConfig: (config: any) => void;
  onChunk: (chunk: any) => void;
};

export class MP4Demuxer {
  private readonly url: string;

  private file: MP4Box.MP4File;

  private status = Status.loading;

  private readonly stepOffset: number;

  private readonly stepMultiplier: number;

  private readonly maxFrames: number;

  private readonly isPolyfill: boolean;

  private decodedSamples = new Set<string>();

  private lastSample = 0;

  private readonly onConfig: (config: MP4DecoderConfig) => void;

  private readonly onChunk: (chunk: any) => void;

  constructor(url: string, {
    onConfig,
    onChunk,
    stepOffset,
    stepMultiplier,
    isPolyfill,
    maxFrames,
  }: MP4DemuxerConfig) {
    this.url = url;
    this.stepOffset = stepOffset;
    this.stepMultiplier = stepMultiplier;
    this.maxFrames = maxFrames;
    this.isPolyfill = isPolyfill;
    this.onConfig = onConfig;
    this.onChunk = onChunk;

    this.file = MP4Box.createFile();
    this.file.onError = (e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    };
    this.file.onReady = this.onReady.bind(this);
    this.file.onSamples = this.onSamples.bind(this);

    void this.loadMetadata();
  }

  private async loadMetadata() {
    let offset: number | undefined = 0;
    while (offset !== undefined) {
      try {
        offset = await this.requestPart(offset, META_PART_SIZE);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
      if (this.status === Status.ready) break;
    }
  }

  private async loadNextFrames(step: number, duration: number, partSize: number) {
    let tick = step * this.stepOffset;
    let lastSample = 0;
    let rap = this.file.seek(tick, true);
    while (this.status !== Status.closed) {
      try {
        await this.requestPart(rap.offset, partSize);
        if (tick > duration) break;
        if (this.lastSample > 1 && lastSample < this.lastSample) {
          tick += step * this.stepMultiplier;
          lastSample = this.lastSample;
        }
        rap = this.file.seek(tick, true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
    this.file.flush();
  }

  private async requestPart(offset: number, partSize: number, useRap = true) {
    const reminder = (offset % MIN_PART_SIZE);
    const start = offset - reminder;
    const end = start + partSize - 1;
    let arrayBuffer = await requestPart({ url: this.url, start, end }) as MP4ArrayBuffer;
    if (!arrayBuffer) {
      return undefined;
    }
    if (reminder) {
      arrayBuffer = arrayBuffer.slice(reminder) as MP4ArrayBuffer;
    }
    arrayBuffer.fileStart = offset;
    const nextOffset = this.file.appendBuffer(arrayBuffer);
    if (!useRap) return offset + arrayBuffer.byteLength;
    return nextOffset;
  }

  private description(track: MP4VideoTrack) {
    const t = this.file.getTrackById(track.id);
    for (const entry of t.mdia.minf.stbl.stsd.entries) {
      if (entry.avcC || entry.hvcC || entry.av1C) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        if (entry.avcC) {
          entry.avcC.write(stream);
        } else if (entry.hvcC) {
          entry.hvcC.write(stream);
        } else if (entry.av1C) {
          entry.av1C.write(stream);
        }
        return new Uint8Array(stream.buffer, 8); // Remove the box header.
      }
    }
    throw new Error('avcC, hvcC ro av1C not found');
  }

  private onReady(info: MP4Info) {
    const track = info.videoTracks[0];

    let codec = track.codec;
    if (codec.startsWith('avc1')) {
      // Somehow this is the only avc1 codec that works.
      codec = 'avc1.4d001f';
    }

    // Generate and emit an appropriate VideoDecoderConfig.
    this.onConfig({
      codec,
      codedHeight: track.video.height,
      codedWidth: track.video.width,
      description: this.description(track),
    });

    const duration = info.duration / info.timescale;

    // If we set a part size too small, the onSamples callback is not called.
    // If we use polyfill, we need to set a smaller part size to avoid decoding multiple frames.
    const partSizeDivider = this.isPolyfill ? 24 : 12;
    const partSize = roundPartSize(track.bitrate / partSizeDivider);
    const step = calculateStep(duration, this.maxFrames);

    // Start demuxing.
    this.file.setExtractionOptions(track.id, undefined, { nbSamples: 1 });
    this.file.start();

    this.status = Status.ready;

    // // Load frames
    void this.loadNextFrames(step, duration, partSize);
  }

  private onSamples(trackId: number, ref: any, samples: any) {
    if (this.status !== Status.ready) return;
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
      const time = sample.cts / sample.timescale;
      const type = sample.is_sync ? 'key' : 'delta';
      const id = `${type}${sample.number}`;

      // Skip already decoded samples.
      if (this.decodedSamples.has(id)) continue;

      // @ts-ignore
      this.onChunk(new EncodedVideoChunk({
        type,
        timestamp: (1e6 * time),
        duration: (1e6 * sample.duration) / sample.timescale,
        data: sample.data,
      }));

      this.decodedSamples.add(id);
      this.lastSample = parseInt(sample.number, 10);

      if (sample.is_sync) {
        this.file.releaseUsedSamples(trackId, sample.number);
      }
    }
  }

  close() {
    this.file.flush();
    this.file.stop();
    this.status = Status.closed;
  }
}

function roundPartSize(size: number) {
  return size + MIN_PART_SIZE - (size % MIN_PART_SIZE);
}

function calculateStep(duration: number, max: number): number {
  return Math.round((duration + max) / max);
}
