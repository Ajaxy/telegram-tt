import { DEBUG } from '../config';
import { requestPart } from './progressive';

const DOWNLOAD_PART_SIZE = 1024 * 1024;
const TEST_PART_SIZE = 64 * 1024;

const QUEUE_SIZE = 8;

class FilePartQueue<T> {
  queue: Promise<T>[];

  constructor() {
    this.queue = [];
  }

  push(task: Promise<T>) {
    this.queue.push(task);
  }

  async pop(): Promise<T> {
    const result = await this.queue.shift()!;
    return result;
  }

  get size() {
    return this.queue.length;
  }
}

export async function respondForDownload(e: FetchEvent) {
  const { url } = e.request;

  let partInfo;
  try {
    partInfo = await requestPart(e, { url, start: 0, end: TEST_PART_SIZE });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('FETCH DOWNLOAD', err);
    }
  }

  if (!partInfo) {
    return new Response('', {
      status: 500,
      statusText: 'Failed to fetch file to download',
    });
  }

  const matchedFilename = e.request.url.match(/filename=(.*)/);
  const filenameHeader = matchedFilename ? `filename="${decodeURIComponent(matchedFilename[1])}"` : '';
  const { fullSize, mimeType } = partInfo;

  const headers: [string, string][] = [
    ['Content-Length', String(fullSize)],
    ['Content-Type', mimeType],
    ['Content-Disposition', `attachment; ${filenameHeader}`],
  ];

  const queue = new FilePartQueue<ArrayBuffer | undefined>();
  const enqueue = (offset: number) => {
    queue.push(requestPart(e, {
      url, start: offset, end: offset + DOWNLOAD_PART_SIZE - 1,
    })
      .then((part) => part?.arrayBuffer));
    return offset + DOWNLOAD_PART_SIZE;
  };
  let lastOffset = 0;
  const stream = new ReadableStream({
    start() {
      for (let i = 0; i < QUEUE_SIZE; i++) {
        if (lastOffset >= fullSize) break;
        lastOffset = enqueue(lastOffset);
      }
    },

    async pull(controller) {
      const buffer = await queue.pop();
      if (!buffer) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(buffer));

      if (buffer.byteLength < DOWNLOAD_PART_SIZE) {
        controller.close();
        return;
      }

      if (lastOffset < fullSize) {
        lastOffset = enqueue(lastOffset);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    statusText: 'OK',
    headers,
  });
}
