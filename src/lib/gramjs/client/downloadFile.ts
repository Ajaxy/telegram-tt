// eslint-disable-next-line import/no-named-default
import { default as Api } from '../tl/api';
import TelegramClient from './TelegramClient';
import { getAppropriatedPartSize } from '../Utils';
import { sleep, createDeferred } from '../Helpers';
import errors from '../errors';

export interface progressCallback {
    isCanceled?: boolean;
    acceptsBuffer?: boolean;

    (
        progress: number, // Float between 0 and 1.
        ...args: any[]
    ): void;
}

export interface DownloadFileParams {
    dcId: number;
    fileSize: number;
    workers?: number;
    partSizeKb?: number;
    start?: number;
    end?: number;
    progressCallback?: progressCallback;
}

interface Deferred {
    promise: Promise<any>;
    resolve: (value?: any) => void;
}

// Chunk sizes for `upload.getFile` must be multiple of the smallest size
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_CHUNK_SIZE = 64; // kb
const ONE_MB = 1024 * 1024;
const DISCONNECT_SLEEP = 1000;


class Foreman {
    private deferred: Deferred | undefined;

    private activeWorkers = 0;

    constructor(private maxWorkers: number) {
    }

    requestWorker() {
        this.activeWorkers++;

        if (this.activeWorkers > this.maxWorkers) {
            this.deferred = createDeferred();
            return this.deferred!.promise;
        }

        return Promise.resolve();
    }

    releaseWorker() {
        this.activeWorkers--;

        if (this.deferred && (this.activeWorkers <= this.maxWorkers)) {
            this.deferred.resolve();
        }
    }
}

export async function downloadFile(
    client: TelegramClient,
    inputLocation: Api.InputFileLocation,
    fileParams: DownloadFileParams,
) {
    let {
        partSizeKb, end,
    } = fileParams;
    const {
        fileSize, workers = 1,
    } = fileParams;
    const { dcId, progressCallback, start = 0 } = fileParams;

    end = end && end < fileSize ? end : fileSize - 1;

    if (!partSizeKb) {
        partSizeKb = fileSize ? getAppropriatedPartSize(fileSize) : DEFAULT_CHUNK_SIZE;
    }

    const partSize = partSizeKb * 1024;
    const partsCount = end ? Math.ceil((end - start) / partSize) : 1;

    if (partSize % MIN_CHUNK_SIZE !== 0) {
        throw new Error(`The part size must be evenly divisible by ${MIN_CHUNK_SIZE}`);
    }

    client._log.info(`Downloading file in chunks of ${partSize} bytes`);

    const foreman = new Foreman(workers);
    const promises: Promise<any>[] = [];
    let offset = start;
    // Used for files with unknown size and for manual cancellations
    let hasEnded = false;

    let progress = 0;
    if (progressCallback) {
        progressCallback(progress);
    }

    // used to populate the sender
    await client.getSender(dcId);


    // eslint-disable-next-line no-constant-condition
    while (true) {
        let limit = partSize;
        let isPrecise = false;

        if (Math.floor(offset / ONE_MB) !== Math.floor((offset + limit - 1) / ONE_MB)) {
            limit = ONE_MB - (offset % ONE_MB);
            isPrecise = true;
        }

        await foreman.requestWorker();

        if (hasEnded) {
            await foreman.releaseWorker();
            break;
        }

        // eslint-disable-next-line no-loop-func
        promises.push((async (offsetMemo: number) => {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const sender = await client.getSender(dcId);
                try {
                    if (!sender._user_connected) {
                        await sleep(DISCONNECT_SLEEP);
                        continue;
                    }
                    const result = await sender.send(new Api.upload.GetFile({
                        location: inputLocation,
                        offset: offsetMemo,
                        limit,
                        precise: isPrecise || undefined,
                    }));

                    if (progressCallback) {
                        if (progressCallback.isCanceled) {
                            throw new Error('USER_CANCELED');
                        }

                        progress += (1 / partsCount);
                        progressCallback(progress);
                    }

                    if (!end && (result.bytes.length < limit)) {
                        hasEnded = true;
                    }

                    return result.bytes;
                } catch (err) {
                    if (err.message === 'Disconnect') {
                        await sleep(DISCONNECT_SLEEP);
                        continue;
                    } else if (err instanceof errors.FloodWaitError) {
                        await sleep(err.seconds * 1000);
                        continue;
                    } else if (err.message !== 'USER_CANCELED') {
                        // eslint-disable-next-line no-console
                        console.error(err);
                    }

                    hasEnded = true;
                    throw err;
                } finally {
                    foreman.releaseWorker();
                }
            }
        })(offset));

        offset += limit;

        if (end && (offset > end)) {
            break;
        }
    }
    const results = await Promise.all(promises);
    const buffers = results.filter(Boolean);
    const totalLength = end ? (end + 1) - start : undefined;
    return Buffer.concat(buffers, totalLength);
}
