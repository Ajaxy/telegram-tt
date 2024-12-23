import { pause } from './schedulers';

type PendingDownload = {
  url: string;
  filename: string;
};

// Chrome prevents more than 10 downloads per second
const LIMIT_PER_BATCH = 10;
const BATCH_INTERVAL = 1000;

let pendingDownloads: PendingDownload[] = [];
let planned = false;

export default function download(url: string, filename: string) {
  pendingDownloads.push({ url, filename });
  if (!planned) {
    planned = true;
    setTimeout(async () => {
      await processQueue();
      planned = false;
    }, BATCH_INTERVAL);
  }
}

async function processQueue() {
  let count = 0;
  for (const pendingDownload of pendingDownloads) {
    downloadOne(pendingDownload);
    count++;
    if (count === LIMIT_PER_BATCH) {
      await pause(BATCH_INTERVAL);
      count = 0;
    }
  }
  pendingDownloads = [];
}

function downloadOne({ url, filename }: PendingDownload) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = filename;
  try {
    link.click();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err); // Suppress redundant "Blob loading failed" error popup on IOS
  }
}
