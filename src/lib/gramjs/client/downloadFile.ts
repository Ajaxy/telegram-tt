import { default as Api } from '../tl/api';
import TelegramClient from './TelegramClient';
import { getAppropriatedPartSize } from '../Utils';
import { sleep } from '../Helpers';

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
const REQUEST_TIMEOUT = 15000;

export async function downloadFile(
    client: TelegramClient,
    inputLocation: Api.InputFileLocation,
    fileParams: DownloadFileParams,
) {
    let {
        partSizeKb, fileSize, workers = 1, end,
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

    let sender: any;
    if (dcId) {
        try {
            sender = await client._borrowExportedSender(dcId);
        } catch (e) {
            // This should never raise
            client._log.error(e);
            if (e.message === 'DC_ID_INVALID') {
                // Can't export a sender for the ID we are currently in
                sender = client._sender;
            } else {
                throw e;
            }
        }
    } else {
        sender = client._sender;
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

    while (true) {
        let limit = partSize;
        let isPrecise = false;

        if (Math.floor(offset / ONE_MB) !== Math.floor((offset + limit - 1) / ONE_MB)) {
            limit = ONE_MB - offset % ONE_MB;
            isPrecise = true;
        }

        await foreman.requestWorker();

        if (hasEnded) {
            await foreman.releaseWorker();
            break;
        }

        promises.push((async () => {
            try {
                const result = await Promise.race([
                    await sender.send(new Api.upload.GetFile({
                        location: inputLocation,
                        offset,
                        limit,
                        precise: isPrecise || undefined,
                    })),
                    sleep(REQUEST_TIMEOUT).then(() => Promise.reject(new Error('REQUEST_TIMEOUT'))),
                ]);

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
                hasEnded = true;
                throw err;
            } finally {
                foreman.releaseWorker();
            }
        })());

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

class Foreman {
    private deferred: Deferred | undefined;

    private activeWorkers = 0;

    constructor(private maxWorkers: number) {
    }

    requestWorker() {
        this.activeWorkers++;

        if (this.activeWorkers > this.maxWorkers) {
            this.deferred = createDeferred();
            return this.deferred.promise;
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

function createDeferred(): Deferred {
    let resolve: Deferred['resolve'];
    const promise = new Promise((_resolve) => {
        resolve = _resolve;
    });

    return {
        promise,
        resolve: resolve!,
    };
}
