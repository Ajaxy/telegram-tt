import type MTProtoSender from '../network/MTProtoSender';
import type TelegramClient from './TelegramClient';
import type { SizeType } from './TelegramClient';

import { getDcBandwidthManager } from '../../../util/dcBandwithManager';
import Deferred from '../../../util/Deferred';
import { concat } from '../../../util/encoding/buffer';
import { FloodPremiumWaitError, FloodWaitError, RPCError } from '../errors';
import Api from '../tl/api';

import LocalUpdatePremiumFloodWait from '../../../api/gramjs/updates/UpdatePremiumFloodWait';
import { sleep } from '../Helpers';
import { getDownloadPartSize } from '../Utils';

interface OnProgress {
  isCanceled?: boolean;
  (
    progress: number, // Float between 0 and 1.
    ...args: any[]
  ): void;
}

export interface DownloadFileParams {
  fileSize?: number;
  workers?: number;
  partSizeKb?: number;
  start?: number;
  end?: number;
  progressCallback?: OnProgress;
  isPriority?: boolean;
}

export type DownloadFileWithDcParams = DownloadFileParams & { dcId: number };

export interface DownloadMediaParams {
  sizeType?: SizeType;
  progressCallback?: OnProgress;
}

// Chunk sizes for `upload.getFile` must be multiple of the smallest size
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_CHUNK_SIZE = 64; // kb
const ONE_MB = 1024 * 1024;
const DISCONNECT_SLEEP = 1000;

// Reconnect stalled download requests after one minute
const SENDER_TIMEOUT = 60 * 1000;
const DOWNLOAD_TIMEOUT_ERROR = 'DOWNLOAD_TIMEOUT';
// Telegram may have server issues so we try several times
const SENDER_RETRIES = 5;

class FileView {
  private type: 'memory' | 'opfs';

  private size?: number;

  private buffer?: Uint8Array;

  private largeFile?: FileSystemFileHandle;

  private largeFileAccessHandle?: FileSystemSyncAccessHandle;

  constructor(size?: number) {
    this.size = size;

    this.type = (size && size > (self as any).maxBufferSize) ? 'opfs' : 'memory';
  }

  async init() {
    if (this.type === 'opfs') {
      if (!FileSystemFileHandle?.prototype.createSyncAccessHandle) {
        throw new Error('`createSyncAccessHandle` is not available. Cannot download files larger than 2GB.');
      }
      const directory = await navigator.storage.getDirectory();
      const downloadsFolder = await directory.getDirectoryHandle('downloads', { create: true });
      this.largeFile = await downloadsFolder.getFileHandle(Math.random().toString(), { create: true });
      this.largeFileAccessHandle = await this.largeFile.createSyncAccessHandle();
    } else {
      this.buffer = new Uint8Array(this.size || 0);
    }
  }

  write(data: Uint8Array, offset: number) {
    if (this.type === 'opfs') {
      this.largeFileAccessHandle!.write(data, { at: offset });
      return;
    }

    if (this.size) {
      const endOffset = offset + data.length;
      if (endOffset > this.buffer!.length) { // Slow path for potential overflow
        if (offset >= this.buffer!.length) return; // Ignore writes past the end
        const writeLength = this.buffer!.length - offset;
        this.buffer!.set(data.subarray(0, writeLength), offset);
        return;
      }

      this.buffer!.set(data, offset);
      return;
    }

    this.buffer = concat(this.buffer!, data);
  }

  async getData(): Promise<Uint8Array | File> {
    if (this.type === 'opfs') {
      return this.largeFile!.getFile();
    } else {
      return Promise.resolve(this.buffer!);
    }
  }
}

export async function downloadFile(
  client: TelegramClient,
  inputLocation: Api.TypeInputFileLocation,
  fileParams: DownloadFileWithDcParams,
  shouldDebugExportedSenders?: boolean,
) {
  let {
    partSizeKb, end = 0,
  } = fileParams;
  const {
    fileSize, dcId, progressCallback, isPriority, start = 0,
  } = fileParams;

  const fileId = 'id' in inputLocation ? inputLocation.id : undefined;
  const logWithId = (...args: any[]) => {
    if (!shouldDebugExportedSenders) return;
    // eslint-disable-next-line no-console
    console.log(`⬇️ [${fileId?.toString()}/${fileParams.dcId}]`, ...args);
  };

  logWithId('Downloading file...');
  const isPremium = Boolean(client.isPremium);

  if (fileSize) {
    end = end && end < fileSize ? end : fileSize - 1;
  }

  const rangeSize = end ? end - start + 1 : undefined;

  if (!partSizeKb) {
    partSizeKb = fileSize ? getDownloadPartSize(rangeSize || fileSize) : DEFAULT_CHUNK_SIZE;
  }

  const partSize = partSizeKb * 1024;
  const partsCount = rangeSize ? Math.ceil(rangeSize / partSize) : 1;
  const noParallel = !end;
  let deferred: Deferred | undefined;

  if (partSize % MIN_CHUNK_SIZE !== 0) {
    throw new Error(`The part size must be evenly divisible by ${MIN_CHUNK_SIZE}`);
  }

  client._log.info(`Downloading file in chunks of ${partSize} bytes`);

  const fileView = new FileView(rangeSize);
  const promises: Promise<any>[] = [];
  const abortController = new AbortController();
  const { signal } = abortController;
  const canceled = new Deferred<never>();
  void canceled.promise.catch(() => undefined);
  let offset = start;
  // Used for files with unknown size and for manual cancellations
  let hasEnded = false;

  let progress = 0;
  progressCallback?.(progress);

  // Limit updates to one per file
  let isPremiumFloodWaitSent = false;

  // Allocate memory
  await fileView.init();

  const dcManager = getDcBandwidthManager(dcId, isPremium);

  while (true) {
    let limit = partSize;
    let isPrecise = false;

    if (Math.floor(offset / ONE_MB) !== Math.floor((offset + limit - 1) / ONE_MB)) {
      limit = ONE_MB - (offset % ONE_MB);
      isPrecise = true;
    }

    if (offset % MIN_CHUNK_SIZE !== 0 || limit % MIN_CHUNK_SIZE !== 0) {
      isPrecise = true;
    }

    if (deferred) await deferred.promise;

    if (noParallel) deferred = new Deferred();

    if (hasEnded) {
      break;
    }

    const senderIndex = await dcManager.requestWorker(Boolean(isPriority), limit);
    const logWithSenderIndex = (...args: unknown[]) => {
      logWithId(`[${senderIndex}/${dcId}]`, ...args);
    };

    // Check again after waiting for capacity
    if (hasEnded || progressCallback?.isCanceled) {
      dcManager.releaseWorker(senderIndex, limit);
      deferred?.resolve();
      break;
    }

    const promise = (async (offsetMemo: number, limitMemo: number, senderIndexMemo: number) => {
      try {
        let failedAttempts = 0;
        while (true) {
          let sender: MTProtoSender | undefined;
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const requestAbortController = new AbortController();
          try {
            let isDone = false;
            if (shouldDebugExportedSenders) {
              setTimeout(() => {
                if (isDone) return;
                logWithSenderIndex(`❗️️ getSender took too long ${offsetMemo}`);
              }, 8000);
            }
            sender = await Promise.race([
              client.getSender(dcId, senderIndexMemo, isPremium, signal).then((acquiredSender) => {
                if (signal.aborted) {
                  client.releaseExportedSender(acquiredSender);
                  throw signal.reason;
                }
                return acquiredSender;
              }),
              canceled.promise,
            ]);
            isDone = true;

            let isDone2 = false;
            if (shouldDebugExportedSenders) {
              setTimeout(() => {
                if (isDone2) return;
                logWithSenderIndex(`❗️️ sender.send took too long ${offsetMemo}`);
              }, 6000);
            }
            // A stalled sender may never resolve the download request
            const result = (await Promise.race([
              sender.send(new Api.upload.GetFile({
                location: inputLocation,
                offset: BigInt(offsetMemo),
                limit: limitMemo,
                precise: isPrecise || undefined,
              }), requestAbortController.signal),
              canceled.promise,
              new Promise<never>((resolve, reject) => {
                timeoutId = setTimeout(() => {
                  logWithSenderIndex(`Download timed out ${offsetMemo}`);
                  // Main-DC timeouts cancel the download so the user can retry later
                  reject(new Error(dcId === client.session.dcId ? 'USER_CANCELED' : DOWNLOAD_TIMEOUT_ERROR));
                }, SENDER_TIMEOUT);
              }),
            ]))!;
            if (signal.aborted) return;

            if (result instanceof Api.upload.FileCdnRedirect) {
              throw new Error('CDN download not supported');
            }

            isDone2 = true;
            if (progressCallback) {
              if (progressCallback.isCanceled) {
                throw new Error('USER_CANCELED');
              }

              progress += (1 / partsCount);
              logWithSenderIndex(`⬇️️ ${progress * 100}%`);
              progressCallback(progress);
            }

            if (!end && (result.bytes.length < limitMemo)) {
              hasEnded = true;
            }

            fileView.write(result.bytes, offsetMemo - start);

            return;
          } catch (err) {
            if (signal.aborted) throw err;
            if (err instanceof FloodWaitError) {
              if (err instanceof FloodPremiumWaitError && !isPremiumFloodWaitSent) {
                sender?._updateCallback(new LocalUpdatePremiumFloodWait(false));
                isPremiumFloodWaitSent = true;
              }
              await Promise.race([sleep(err.seconds * 1000), canceled.promise]);
              continue;
            }

            const isDownloadTimeout = err instanceof Error && err.message === DOWNLOAD_TIMEOUT_ERROR;
            const isRetryableRpcError = err instanceof RPCError && (
              err.errorMessage.startsWith('SESSION_REVOKED')
              || err.errorMessage.startsWith('CONNECTION_NOT_INITED')
            );
            if (isDownloadTimeout || isRetryableRpcError || (sender && !sender.isConnected())) {
              if (isDownloadTimeout) {
                requestAbortController.abort();
                sender!.reconnect();
              } else if (isRetryableRpcError && sender && !sender.userDisconnected) {
                sender.disconnect();
                await client._cleanupExportedSender(dcId, senderIndexMemo);
              }
              failedAttempts += 1;
              if (failedAttempts >= SENDER_RETRIES) throw err;
              await Promise.race([sleep(DISCONNECT_SLEEP), canceled.promise]);
              continue;
            }

            logWithSenderIndex(`Ended not gracefully ${offsetMemo}`);
            throw err;
          } finally {
            clearTimeout(timeoutId);
            requestAbortController.abort();
            if (sender) client.releaseExportedSender(sender);
          }
        }
      } finally {
        dcManager.releaseWorker(senderIndexMemo, limitMemo);
        deferred?.resolve();
      }
    })(offset, limit, senderIndex);
    // Stop the remaining parts only when the download cannot recover
    void promise.catch((err: unknown) => {
      hasEnded = true;
      abortController.abort(err);
      canceled.reject(err);
    });
    promises.push(promise);

    offset += limit;

    if (end && (offset > end)) {
      break;
    }
  }
  await Promise.allSettled(promises);
  if (signal.aborted) throw signal.reason;
  return fileView.getData();
}
