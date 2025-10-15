import type TelegramClient from './TelegramClient';
import type { SizeType } from './TelegramClient';

import Deferred from '../../../util/Deferred';
import { Foreman } from '../../../util/foreman';
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

const NEW_CONNECTION_QUEUE_THRESHOLD = 5;

// when the sender requests hangs for 60 second we will reimport
const SENDER_TIMEOUT = 60 * 1000;
// Telegram may have server issues so we try several times
const SENDER_RETRIES = 5;

class FileView {
  private type: 'memory' | 'opfs';

  private size?: number;

  private buffer?: Buffer<ArrayBuffer>;

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
      this.buffer = this.size ? Buffer.alloc(this.size) : Buffer.alloc(0);
    }
  }

  write(data: Uint8Array, offset: number) {
    if (this.type === 'opfs') {
      this.largeFileAccessHandle!.write(data, { at: offset });
    } else if (this.size) {
      for (let i = 0; i < data.length; i++) {
        if (offset + i >= this.buffer!.length) return;
        this.buffer!.writeUInt8(data[i], offset + i);
      }
    } else {
      this.buffer = Buffer.concat([this.buffer!, data]);
    }
  }

  async getData(): Promise<Buffer<ArrayBuffer> | File> {
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
  const { dcId } = fileParams;
  for (let i = 0; i < SENDER_RETRIES; i++) {
    try {
      return await downloadFile2(client, inputLocation, fileParams, shouldDebugExportedSenders);
    } catch (err: unknown) {
      if (err instanceof RPCError && (
        err.errorMessage.startsWith('SESSION_REVOKED')
        || err.errorMessage.startsWith('CONNECTION_NOT_INITED')
      ) && i < SENDER_RETRIES - 1) {
        await client._cleanupExportedSenders(dcId);
      } else {
        throw err;
      }
    }
  }

  return undefined;
}

const MAX_CONCURRENT_CONNECTIONS = 3;
const MAX_CONCURRENT_CONNECTIONS_PREMIUM = 6;
const MAX_WORKERS_PER_CONNECTION = 10;
const MULTIPLE_CONNECTIONS_MIN_FILE_SIZE = 10485760; // 10MB

const foremans = Array(MAX_CONCURRENT_CONNECTIONS_PREMIUM).fill(undefined)
  .map(() => new Foreman(MAX_WORKERS_PER_CONNECTION));

async function downloadFile2(
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
  const shouldUseMultipleConnections = Boolean(fileSize)
    && fileSize >= MULTIPLE_CONNECTIONS_MIN_FILE_SIZE
    && !noParallel;
  let deferred: Deferred | undefined;

  if (partSize % MIN_CHUNK_SIZE !== 0) {
    throw new Error(`The part size must be evenly divisible by ${MIN_CHUNK_SIZE}`);
  }

  client._log.info(`Downloading file in chunks of ${partSize} bytes`);

  const fileView = new FileView(rangeSize);
  const promises: Promise<any>[] = [];
  let offset = start;
  // Used for files with unknown size and for manual cancellations
  let hasEnded = false;

  let progress = 0;
  if (progressCallback) {
    progressCallback(progress);
  }

  // Limit updates to one per file
  let isPremiumFloodWaitSent = false;

  // Allocate memory
  await fileView.init();

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

    const senderIndex = getFreeForemanIndex(isPremium, shouldUseMultipleConnections);

    await foremans[senderIndex].requestWorker(isPriority);

    if (deferred) await deferred.promise;

    if (noParallel) deferred = new Deferred();

    if (hasEnded) {
      foremans[senderIndex].releaseWorker();
      break;
    }
    const logWithSenderIndex = (...args: any[]) => {
      logWithId(`[${senderIndex}/${dcId}]`, ...args);
    };

    promises.push((async (offsetMemo: number) => {
      while (true) {
        let sender;
        try {
          let isDone = false;
          if (shouldDebugExportedSenders) {
            setTimeout(() => {
              if (isDone) return;
              logWithSenderIndex(`❗️️ getSender took too long ${offsetMemo}`);
            }, 8000);
          }
          sender = await client.getSender(dcId, senderIndex, isPremium);
          isDone = true;

          let isDone2 = false;
          if (shouldDebugExportedSenders) {
            setTimeout(() => {
              if (isDone2) return;
              logWithSenderIndex(`❗️️ sender.send took too long ${offsetMemo}`);
            }, 6000);
          }
          // sometimes a session is revoked and will cause this to hang.
          const result = (await Promise.race([
            sender.send(new Api.upload.GetFile({
              location: inputLocation,
              offset: BigInt(offsetMemo),
              limit,
              precise: isPrecise || undefined,
            })),
            sleep(SENDER_TIMEOUT).then(() => {
              // If we're on the main DC we just cancel the download and let the user retry later
              if (dcId === client.session.dcId) {
                logWithSenderIndex(`Download timed out ${offsetMemo}`);
                return Promise.reject(new Error('USER_CANCELED'));
              } else {
                logWithSenderIndex(`Download timed out [not main] ${offsetMemo}`);
                return Promise.reject(new Error('SESSION_REVOKED'));
              }
            }),
          ]))!;
          client.releaseExportedSender(sender);

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

          if (!end && (result.bytes.length < limit)) {
            hasEnded = true;
          }

          foremans[senderIndex].releaseWorker();
          if (deferred) deferred.resolve();

          fileView.write(result.bytes, offsetMemo - start);

          return;
        } catch (err) {
          if (sender && !sender.isConnected()) {
            await sleep(DISCONNECT_SLEEP);
            continue;
          } else if (err instanceof FloodWaitError) {
            if (err instanceof FloodPremiumWaitError && !isPremiumFloodWaitSent) {
              sender?._updateCallback(new LocalUpdatePremiumFloodWait(false));
              isPremiumFloodWaitSent = true;
            }
            await sleep(err.seconds * 1000);
            continue;
          }

          logWithSenderIndex(`Ended not gracefully ${offsetMemo}`);
          foremans[senderIndex].releaseWorker();
          if (deferred) deferred.resolve();

          hasEnded = true;
          if (sender) client.releaseExportedSender(sender);
          throw err;
        }
      }
    })(offset));

    offset += limit;

    if (end && (offset > end)) {
      break;
    }
  }
  await Promise.all(promises);
  return fileView.getData();
}

function getFreeForemanIndex(isPremium: boolean, forceNewConnection?: boolean) {
  const availableConnections = isPremium ? MAX_CONCURRENT_CONNECTIONS_PREMIUM : MAX_CONCURRENT_CONNECTIONS;
  let foremanIndex = 0;
  let minQueueLength = Infinity;
  for (let i = 0; i < availableConnections; i++) {
    const foreman = foremans[i];
    // If worker is free, return it
    if (!foreman.queueLength) return i;

    // Potentially create a new connection if the current queue is too long
    if (!forceNewConnection && foreman.queueLength <= NEW_CONNECTION_QUEUE_THRESHOLD) {
      return i;
    }

    // If every connection is equally busy, prefer the last one in the list
    if (foreman.queueLength <= minQueueLength) {
      foremanIndex = i;
      minQueueLength = foreman.activeWorkers;
    }
  }

  return foremanIndex;
}
