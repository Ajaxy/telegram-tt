import type MTProtoSender from '../network/MTProtoSender';
import type TelegramClient from './TelegramClient';

import { getDcBandwidthManager } from '../../../util/dcBandwithManager';
import { FloodPremiumWaitError, FloodWaitError } from '../errors';
import Api from '../tl/api';

import LocalUpdatePremiumFloodWait from '../../../api/gramjs/updates/UpdatePremiumFloodWait';
import { generateRandomBytes, readBigIntFromBuffer, sleep } from '../Helpers';
import { getUploadPartSize } from '../Utils';

interface OnProgress {
  isCanceled?: boolean;

  // Float between 0 and 1.
  (progress: number): void;
}

export interface UploadFileParams {
  file: File;
  workers: number;
  onProgress?: OnProgress;
}

const KB_TO_BYTES = 1024;
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
const DISCONNECT_SLEEP = 1000;
const UPLOAD_TIMEOUT = 60 * 1000;
const UPLOAD_TIMEOUT_ERROR = 'UPLOAD_TIMEOUT';
const MAX_UPLOAD_ATTEMPTS = 5;

export async function uploadFile(
  client: TelegramClient,
  fileParams: UploadFileParams,
  shouldDebugExportedSenders?: boolean,
): Promise<Api.InputFile | Api.InputFileBig> {
  const { file, onProgress } = fileParams;

  const isPremium = Boolean(client.isPremium);

  const { name, size } = file;
  const fileId = readBigIntFromBuffer(generateRandomBytes(8), true, true);
  const isLarge = size > LARGE_FILE_THRESHOLD;

  const logWithId = (...args: any[]) => {
    if (!shouldDebugExportedSenders) return;
    // eslint-disable-next-line no-console
    console.log(`⬆️ [${fileId.toString()}]`, ...args);
  };

  logWithId('Uploading file...');
  const partSize = getUploadPartSize(size) * KB_TO_BYTES;
  const partCount = Math.floor((size + partSize - 1) / partSize);

  const dcManager = getDcBandwidthManager(client.session.dcId, isPremium);

  let progress = 0;
  if (onProgress) {
    onProgress(progress);
  }

  // Limit updates to one per file
  let isPremiumFloodWaitSent = false;
  let hasFailed = false;

  const promises: Promise<any>[] = [];

  for (let i = 0; i < partCount; i++) {
    const senderIndex = await dcManager.requestWorker(false, partSize);

    if (hasFailed || onProgress?.isCanceled) {
      dcManager.releaseWorker(senderIndex, partSize);
      break;
    }

    const logWithSenderIndex = (...args: any[]) => {
      logWithId(`[${senderIndex}]`, ...args);
    };

    const blobSlice = file.slice(i * partSize, (i + 1) * partSize);

    const promise = (async (jMemo: number, blobSliceMemo: Blob) => {
      try {
        const partBytes = new Uint8Array(await blobSliceMemo.arrayBuffer());
        const request = isLarge
          ? new Api.upload.SaveBigFilePart({
            fileId,
            filePart: jMemo,
            fileTotalParts: partCount,
            bytes: partBytes,
          })
          : new Api.upload.SaveFilePart({
            fileId,
            filePart: jMemo,
            bytes: partBytes,
          });
        let failedAttempts = 0;

        while (true) {
          if (hasFailed) return;
          if (onProgress?.isCanceled) throw new Error('USER_CANCELED');

          let sender: MTProtoSender | undefined;
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          let retryDelay = DISCONNECT_SLEEP;
          const abortController = new AbortController();
          const { signal } = abortController;

          try {
            const result = await Promise.race([
              client.getSender(client.session.dcId, senderIndex, isPremium, signal).then((acquiredSender) => {
                // A connection acquired after the timeout still needs to be released
                if (signal.aborted || hasFailed || onProgress?.isCanceled) {
                  client.releaseExportedSender(acquiredSender);
                  return undefined;
                }
                sender = acquiredSender;
                return sender.send(request, signal);
              }),
              new Promise<never>((resolve, reject) => {
                timeoutId = setTimeout(() => reject(new Error(UPLOAD_TIMEOUT_ERROR)), UPLOAD_TIMEOUT);
              }),
            ]);
            if (result === false) throw new Error('UPLOAD_PART_FAILED');
            break;
          } catch (err) {
            logWithSenderIndex(`❗️️️Upload part failed ${err?.toString()} j=${jMemo}`);
            const isTimeout = err instanceof Error && err.message === UPLOAD_TIMEOUT_ERROR;
            if (isTimeout && sender?.isConnected()) {
              sender.reconnect();
            }

            if (err instanceof FloodWaitError) {
              if (err instanceof FloodPremiumWaitError && !isPremiumFloodWaitSent) {
                sender?._updateCallback(new LocalUpdatePremiumFloodWait(true));
                isPremiumFloodWaitSent = true;
              }
              retryDelay = err.seconds * 1000;
            } else if (isTimeout || (sender && !sender.isConnected())) {
              failedAttempts += 1;
              if (failedAttempts >= MAX_UPLOAD_ATTEMPTS) throw err;
              retryDelay *= 2 ** (failedAttempts - 1);
            } else {
              throw err;
            }
          } finally {
            clearTimeout(timeoutId);
            // Prevent expired requests from being replayed when the sender reconnects
            abortController.abort();
            if (sender) client.releaseExportedSender(sender);
          }

          await sleep(retryDelay);
        }

        if (hasFailed) return;
        if (onProgress) {
          if (onProgress.isCanceled) {
            throw new Error('USER_CANCELED');
          }

          progress += (1 / partCount);
          logWithSenderIndex(`${progress * 100}%`);
          onProgress(progress);
        }
      } finally {
        dcManager.releaseWorker(senderIndex, partSize);
      }
    })(i, blobSlice);
    // Parts can fail while the scheduling loop waits for upload capacity
    void promise.catch(() => {
      hasFailed = true;
    });
    promises.push(promise);
  }

  await Promise.all(promises);
  if (onProgress?.isCanceled) throw new Error('USER_CANCELED');

  return isLarge
    ? new Api.InputFileBig({
      id: fileId,
      parts: partCount,
      name,
    })
    : new Api.InputFile({
      id: fileId,
      parts: partCount,
      name,
      md5Checksum: '', // This is not a "flag", so not sure if we can make it optional.
    });
}
