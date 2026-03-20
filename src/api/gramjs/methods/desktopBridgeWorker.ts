import type { WorkerPayload } from '../worker/types';

export type TgDownloadChunkPayload = Extract<WorkerPayload, { type: 'tgDownloadChunk' }>;

let chunkPoster: ((payload: TgDownloadChunkPayload, transferable?: Transferable) => void) | undefined;

export function setDesktopBridgeChunkPoster(
  fn: (payload: TgDownloadChunkPayload, transferable?: Transferable) => void,
) {
  chunkPoster = fn;
}

export function emitDownloadChunk(payload: TgDownloadChunkPayload, transferable?: Transferable) {
  chunkPoster?.(payload, transferable);
}
