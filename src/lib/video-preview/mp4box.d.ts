declare module 'mp4box' {

  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;

  }

  export interface MP4VideoData {
    width: number;
    height: number;
  }

  export interface MP4VideoTrack extends MP4MediaTrack {
    video: MP4VideoData;
    [key: string]: any;
  }

  export interface MP4AudioData {
    sample_rate: number;
    channel_count: number;
    sample_size: number;
  }

  export interface MP4AudioTrack extends MP4MediaTrack {
    audio: MP4AudioData;
    [key: string]: any;
  }

  export type MP4Track = MP4VideoTrack | MP4AudioTrack;

  export class DataStream {
    buffer: ArrayBuffer;

    static BIG_ENDIAN: number;
    constructor(buffer?: ArrayBuffer, offset?: number, endianness?: number);
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    fragment_duration: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4Track[];
    videoTracks: MP4VideoTrack[];
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

  export interface MP4File {

    onMoovStart?: () => void;
    onReady?: (info: MP4Info) => void;
    onSamples?: (trackId: number, ref: any, samples: any) => void;
    onError?: (e: string) => void;

    processSamples(last: boolean): void;

    getTrackById(id: number): MP4Track;

    setExtractionOptions(id: number, user?: any, options?: any): void;

    appendBuffer(data: MP4ArrayBuffer): number;
    start(): void;
    stop(): void;
    flush(): void;
    seek(time: number, useRap?: boolean): { offset: number; time: number };
    releaseUsedSamples(id: number, sampleNumber: number): void;
  }

  export function createFile(): MP4File;

  export {};

}
