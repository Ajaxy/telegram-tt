import { ApiDocument } from './messages';

export interface ApiInitialArgs {
  userAgent: string;
  platform?: string;
  sessionData?: ApiSessionData;
}

export interface ApiOnProgress {
  (
    progress: number, // Float between 0 and 1.
    ...args: any[]
  ): void;

  isCanceled?: boolean;
  acceptsBuffer?: boolean;
}

export interface ApiAttachment {
  blobUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  quick?: {
    width: number;
    height: number;
    duration?: number;
  };
  voice?: {
    duration: number;
    waveform: number[];
  };
  previewBlobUrl?: string;
}

export interface ApiWallpaper {
  slug: string;
  document: ApiDocument;
}

export interface ApiSession {
  hash: string;
  isCurrent: boolean;
  isOfficialApp: boolean;
  isPasswordPending: boolean;
  deviceModel: string;
  platform: string;
  systemVersion: string;
  appName: string;
  appVersion: string;
  dateCreated: number;
  dateActive: number;
  ip: string;
  country: string;
  region: string;
}

export interface ApiSessionData {
  mainDcId: number;
  keys: Record<number, string | number[]>;
  hashes: Record<number, string | number[]>;
}

export type ApiNotifyException = {
  chatId: number;
  isMuted: boolean;
  isSilent?: boolean;
  shouldShowPreviews?: boolean;
};
