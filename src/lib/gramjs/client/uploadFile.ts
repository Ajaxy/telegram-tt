// eslint-disable-next-line import/no-named-default
import { default as Api } from '../tl/api';

import type TelegramClient from './TelegramClient';
import { generateRandomBytes, readBigIntFromBuffer, sleep } from '../Helpers';
import { getAppropriatedPartSize } from '../Utils';
import errors from '../errors';

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
): Promise<Api.InputFile | Api.InputFileBig> {
    const { file, onProgress } = fileParams;
    let { workers } = fileParams;

    const { name, size } = file;
    const fileId = readBigIntFromBuffer(generateRandomBytes(8), true, true);
    const isLarge = size > LARGE_FILE_THRESHOLD;

    const partSize = getAppropriatedPartSize(size) * KB_TO_BYTES;
    const partCount = Math.floor((size + partSize - 1) / partSize);

    // Make sure a new sender can be created before starting upload
    await client.getSender(client.session.dcId);

    if (!workers || !size) {
        workers = 1;
    }
    if (workers >= partCount) {
        workers = partCount;
    }

    let progress = 0;
    if (onProgress) {
        onProgress(progress);
    }

    for (let i = 0; i < partCount; i += workers) {
        const sendingParts = [];
        let end = i + workers;
        if (end > partCount) {
            end = partCount;
        }

        for (let j = i; j < end; j++) {
            const blobSlice = file.slice(j * partSize, (j + 1) * partSize);

            // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
            sendingParts.push((async (jMemo: number, blobSliceMemo: Blob) => {
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    let sender;
                    try {
                        // We always upload from the DC we are in
                        sender = await client.getSender(client.session.dcId);
                        const partBytes = await blobSliceMemo.arrayBuffer();
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
                    } catch (err) {
                        if (sender && !sender.isConnected()) {
                            await sleep(DISCONNECT_SLEEP);
                            continue;
                        } else if (err instanceof errors.FloodWaitError) {
                            await sleep(err.seconds * 1000);
                            continue;
                        }
                        throw err;
                    }

                    if (onProgress) {
                        if (onProgress.isCanceled) {
                            throw new Error('USER_CANCELED');
                        }

                        progress += (1 / partCount);
                        onProgress(progress);
                    }
                    break;
                }
            })(j, blobSlice));
        }

        await Promise.all(sendingParts);
    }

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
