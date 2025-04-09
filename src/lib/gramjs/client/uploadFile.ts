import type TelegramClient from './TelegramClient';

import { Foreman } from '../../../util/foreman';
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
const MAX_CONCURRENT_CONNECTIONS = 3;
const MAX_CONCURRENT_CONNECTIONS_PREMIUM = 6;
const MAX_WORKERS_PER_CONNECTION = 10;

const foremans = Array(MAX_CONCURRENT_CONNECTIONS_PREMIUM).fill(undefined)
    .map(() => new Foreman(MAX_WORKERS_PER_CONNECTION));

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
        console.log(`⬆️ [${fileId}]`, ...args);
    };

    logWithId('Uploading file...');
    const partSize = getUploadPartSize(size) * KB_TO_BYTES;
    const partCount = Math.floor((size + partSize - 1) / partSize);

    // Pick the least busy foreman
    // For some reason, fresh connections give out a higher speed for the first couple of seconds
    // I have no idea why, but this may speed up the download of small files
    const activeCounts = foremans.map(({ activeWorkers }) => activeWorkers);
    let currentForemanIndex = activeCounts.indexOf(Math.min(...activeCounts));

    let progress = 0;
    if (onProgress) {
        onProgress(progress);
    }

    // Limit updates to one per file
    let isPremiumFloodWaitSent = false;

    const promises: Promise<any>[] = [];

    for (let i = 0; i < partCount; i++) {
        const senderIndex = currentForemanIndex % (
            isPremium ? MAX_CONCURRENT_CONNECTIONS_PREMIUM : MAX_CONCURRENT_CONNECTIONS
        );

        await foremans[senderIndex].requestWorker();

        if (onProgress?.isCanceled) {
            foremans[senderIndex].releaseWorker();
            break;
        }

        const logWithSenderIndex = (...args: any[]) => {
            logWithId(`[${senderIndex}]`, ...args);
        };

        const blobSlice = file.slice(i * partSize, (i + 1) * partSize);
        // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
        promises.push((async (jMemo: number, blobSliceMemo: Blob) => {
            // eslint-disable-next-line no-constant-condition
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
                    foremans[senderIndex].releaseWorker();
                    if (sender) client.releaseExportedSender(sender);

                    throw err;
                }

                foremans[senderIndex].releaseWorker();

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

        currentForemanIndex++;
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
