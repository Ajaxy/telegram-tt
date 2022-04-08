interface ICommonTagsResult {
  title?: string;
  artist?: string;
  picture?: IPicture[];
}

interface IFormat {
  duration?: number;
}

interface IAudioMetadata extends INativeAudioMetadata {
  common: ICommonTagsResult;
  format: IFormat;
}

interface IPicture {
  format: string;
  data: Buffer;
  description?: string;
  type?: string;
  name?: string;
}

interface IOptions {
  duration?: boolean;
  skipCovers?: boolean;
  skipPostHeaders?: boolean;
  includeChapters?: boolean;
}

export declare function selectCover(pictures?: IPicture[]): IPicture | null;

export declare function fetchFromUrl(audioTrackUrl: string, options?: IOptions): Promise<IAudioMetadata>;
