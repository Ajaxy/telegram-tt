import BigInt from 'big-integer';
import Api from '../tl/api';
import type TelegramClient from './TelegramClient';
import { sleep } from '../Helpers';
import { getDownloadPartSize } from '../Utils';
import errors from '../errors';
import Deferred from '../../../util/Deferred';

interface OnProgress {
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
    progressCallback?: OnProgress;
}

// Chunk sizes for `upload.getFile` must be multiple of the smallest size
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_CHUNK_SIZE = 64; // kb
const ONE_MB = 1024 * 1024;
const DISCONNECT_SLEEP = 1000;

// when the sender requests hangs for 60 second we will reimport
const SENDER_TIMEOUT = 60 * 1000;
// Telegram may have server issues so we try several times
const SENDER_RETRIES = 5;

class Foreman {
    private deferreds: Deferred[] = [];

    activeWorkers = 0;

    constructor(private maxWorkers: number) {
    }

    requestWorker() {
        if (this.activeWorkers === this.maxWorkers) {
            const deferred = new Deferred();
            this.deferreds.push(deferred);
            return deferred.promise;
        } else {
            this.activeWorkers++;
        }

        return Promise.resolve();
    }

    releaseWorker() {
        if (this.deferreds.length && (this.activeWorkers === this.maxWorkers)) {
            const deferred = this.deferreds.shift()!;
            deferred.resolve();
        } else {
            this.activeWorkers--;
        }
    }
}

class FileView {
    private type: 'memory' | 'opfs';

    private size?: number;

    private buffer?: Buffer;

    private largeFile?: FileSystemFileHandle;

    private largeFileAccessHandle?: FileSystemSyncAccessHandle;

    constructor(size?: number) {
        this.size = size;
        // eslint-disable-next-line no-restricted-globals
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

    getData(): Promise<Buffer | File> {
        if (this.type === 'opfs') {
            return this.largeFile!.getFile();
        } else {
            return Promise.resolve(this.buffer!);
        }
    }
}

export async function downloadFile(
    client: TelegramClient,
    inputLocation: Api.InputFileLocation,
    fileParams: DownloadFileParams,
) {
    const { dcId } = fileParams;
    for (let i = 0; i < SENDER_RETRIES; i++) {
        try {
            return await downloadFile2(client, inputLocation, fileParams);
        } catch (err: any) {
            if (i === SENDER_RETRIES - 1 || !err.message.startsWith('SESSION_REVOKED')) {
                throw err;
            }
            await client._cleanupExportedSender(dcId);
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
    inputLocation: Api.InputFileLocation,
    fileParams: DownloadFileParams,
) {
    let {
        partSizeKb, end,
    } = fileParams;
    const {
        fileSize,
    } = fileParams;
    const isPremium = Boolean(client.isPremium);
    const { dcId, progressCallback, start = 0 } = fileParams;

    end = end && end < fileSize ? end : fileSize - 1;

    if (!partSizeKb) {
        partSizeKb = fileSize ? getDownloadPartSize(fileSize) : DEFAULT_CHUNK_SIZE;
    }

    const partSize = partSizeKb * 1024;
    const partsCount = end ? Math.ceil((end - start) / partSize) : 1;
    const noParallel = !end;
    const shouldUseMultipleConnections = fileSize
        && fileSize >= MULTIPLE_CONNECTIONS_MIN_FILE_SIZE
        && !noParallel;
    let deferred: Deferred | undefined;

    if (partSize % MIN_CHUNK_SIZE !== 0) {
        throw new Error(`The part size must be evenly divisible by ${MIN_CHUNK_SIZE}`);
    }

    client._log.info(`Downloading file in chunks of ${partSize} bytes`);

    const fileView = new FileView(end - start + 1);
    const promises: Promise<any>[] = [];
    let offset = start;
    // Pick the least busy foreman
    // For some reason, fresh connections give out a higher speed for the first couple of seconds
    // I have no idea why, but this may speed up the download of small files
    const activeCounts = foremans.map((l) => l.activeWorkers);
    let currentForemanIndex = activeCounts.indexOf(Math.min(...activeCounts));
    // Used for files with unknown size and for manual cancellations
    let hasEnded = false;

    let progress = 0;
    if (progressCallback) {
        progressCallback(progress);
    }

    // Allocate memory
    await fileView.init();

    // eslint-disable-next-line no-constant-condition
    while (true) {
        let limit = partSize;
        let isPrecise = false;

        if (Math.floor(offset / ONE_MB) !== Math.floor((offset + limit - 1) / ONE_MB)) {
            limit = ONE_MB - (offset % ONE_MB);
            isPrecise = true;
        }

        // Use only first connection for avatars, because no size is known and we don't want to
        // download empty parts using all connections at once
        const senderIndex = !shouldUseMultipleConnections ? 0 : currentForemanIndex % (
            isPremium ? MAX_CONCURRENT_CONNECTIONS_PREMIUM : MAX_CONCURRENT_CONNECTIONS
        );

        await foremans[senderIndex].requestWorker();

        if (deferred) await deferred.promise;

        if (noParallel) deferred = new Deferred();

        if (hasEnded) {
            foremans[senderIndex].releaseWorker();
            break;
        }

        // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
        promises.push((async (offsetMemo: number) => {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                let sender;
                try {
                    sender = await client.getSender(dcId, senderIndex, isPremium);
                    // sometimes a session is revoked and will cause this to hang.
                    const result = await Promise.race([
                        sender.send(new Api.upload.GetFile({
                            location: inputLocation,
                            offset: BigInt(offsetMemo),
                            limit,
                            precise: isPrecise || undefined,
                        })),
                        sleep(SENDER_TIMEOUT).then(() => {
                            // if we're on the main DC we just cancel the download and let the user retry later.
                            if (dcId === client.session.dcId) {
                                return Promise.reject(new Error('USER_CANCELED'));
                            } else {
                                return Promise.reject(new Error('SESSION_REVOKED'));
                            }
                        }),
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

                    foremans[senderIndex].releaseWorker();
                    if (deferred) deferred.resolve();

                    fileView.write(result.bytes, offsetMemo - start);

                    return;
                } catch (err) {
                    if (sender && !sender.isConnected()) {
                        await sleep(DISCONNECT_SLEEP);
                        continue;
                    } else if (err instanceof errors.FloodWaitError) {
                        await sleep(err.seconds * 1000);
                        continue;
                    }

                    foremans[senderIndex].releaseWorker();
                    if (deferred) deferred.resolve();

                    hasEnded = true;
                    throw err;
                }
            }
        })(offset));

        offset += limit;
        currentForemanIndex++;

        if (end && (offset > end)) {
            break;
        }
    }
    await Promise.all(promises);
    return fileView.getData();
}
