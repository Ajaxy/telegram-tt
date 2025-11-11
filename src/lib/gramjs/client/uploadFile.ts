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

  const promises: Promise<any>[] = [];

  for (let i = 0; i < partCount; i++) {
    const senderIndex = await dcManager.requestWorker(false, partSize);

    if (onProgress?.isCanceled) {
      dcManager.releaseWorker(senderIndex, partSize);
      break;
    }

    const logWithSenderIndex = (...args: any[]) => {
      logWithId(`[${senderIndex}]`, ...args);
    };

    const blobSlice = file.slice(i * partSize, (i + 1) * partSize);

    promises.push((async (jMemo: number, blobSliceMemo: Blob) => {
      while (true) {
        let sender;
        try {
          // We always upload from the DC we are in
          let isDone = false;
          if (shouldDebugExportedSenders) {
            setTimeout(() => {
              if (isDone) return;
              logWithSenderIndex(`❗️️ getSender took too long j=${jMemo}`);
            }, 8000);
          }
          sender = await client.getSender(client.session.dcId, senderIndex, isPremium);
          isDone = true;

          let isDone2 = false;
          const partBytes = await blobSliceMemo.arrayBuffer();
          if (shouldDebugExportedSenders) {
            setTimeout(() => {
              if (isDone2) return;
              logWithSenderIndex(`❗️️ sender.send took too long j=${jMemo}`);
            }, 6000);
          }
          await sender.send(
            isLarge
              ? new Api.upload.SaveBigFilePart({
                fileId,
                filePart: jMemo,
                fileTotalParts: partCount,
                bytes: Buffer.from(partBytes),
              })
              : new Api.upload.SaveFilePart({
                fileId,
                filePart: jMemo,
                bytes: Buffer.from(partBytes),
              }),
          );
          client.releaseExportedSender(sender);
          isDone2 = true;
        } catch (err) {
          logWithSenderIndex(`❗️️️Upload part failed ${err?.toString()} j=${jMemo}`);
          if (sender && !sender.isConnected()) {
            await sleep(DISCONNECT_SLEEP);
            continue;
          } else if (err instanceof FloodWaitError) {
            if (err instanceof FloodPremiumWaitError && !isPremiumFloodWaitSent) {
              sender?._updateCallback(new LocalUpdatePremiumFloodWait(true));
              isPremiumFloodWaitSent = true;
            }
            await sleep(err.seconds * 1000);
            continue;
          }
          dcManager.releaseWorker(senderIndex, partSize);
          if (sender) client.releaseExportedSender(sender);

          throw err;
        }

        dcManager.releaseWorker(senderIndex, partSize);

        if (onProgress) {
          if (onProgress.isCanceled) {
            throw new Error('USER_CANCELED');
          }

          progress += (1 / partCount);
          logWithSenderIndex(`${progress * 100}%`);
          onProgress(progress);
        }
        break;
      }
    })(i, blobSlice));
  }

  await Promise.all(promises);

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
