import type { ApiAttachment } from '../api/types';
import type { CancellableCallback } from './PostMessageConnector';

import { SUPPORTED_PHOTO_CONTENT_TYPES } from '../config';
import {
  getLayerFramesDuration, hasMissingStickerFrames, loadLayerFrames,
} from '../components/ui/mediaEditor/render/layerFrames';
import { closeLayerFrames } from '../components/ui/mediaEditor/render/layers';
import { revokeAttachmentUrls } from './attachments';
import { fetchBlob } from './files';
import { cancelVideoProcessing, requestVideoProcessing } from './launchVideoProcessingWorker';

type Job = {
  key: string;
  attachment: ApiAttachment;
  onProgress: (progress: number) => void;
  resolve: (attachment?: ApiAttachment) => void;
  reject: (err: Error) => void;
  progressCallback?: CancellableCallback;
};

const FILE_EXTENSION_REGEX = /\.[^/.]+$/;

const queue: Job[] = [];
let activeJob: Job | undefined;

export function processVideoAttachment(
  key: string, attachment: ApiAttachment, onProgress: (progress: number) => void,
) {
  return new Promise<ApiAttachment | undefined>((resolve, reject) => {
    queue.push({
      key, attachment, onProgress, resolve, reject,
    });
    if (queue.length === 1 && !activeJob) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    void runNextJob();
  });
}

export function cancelVideoAttachmentProcessing(key: string) {
  if (activeJob?.key === key) {
    if (activeJob.progressCallback) cancelVideoProcessing(activeJob.progressCallback);
    return;
  }

  const index = queue.findIndex((job) => job.key === key);
  if (index !== -1) {
    const [job] = queue.splice(index, 1);
    job.resolve(undefined);
  }
}

async function runNextJob() {
  if (activeJob) return;

  activeJob = queue.shift();
  if (!activeJob) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    return;
  }

  const job = activeJob;
  try {
    job.resolve(await exportAttachment(job));
  } catch (err) {
    job.reject(err as Error);
  } finally {
    activeJob = undefined;
    void runNextJob();
  }
}

async function exportAttachment(job: Job) {
  const { attachment, onProgress } = job;
  const { videoProcessing, editState } = attachment;
  if (!videoProcessing || !editState) return attachment;

  const progressCallback: CancellableCallback = (progress: number) => onProgress(progress);
  job.progressCallback = progressCallback;
  onProgress(0);

  const isPhoto = SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType);
  const blob = isPhoto
    ? await fetchBlob(attachment.sourceBlobUrl!)
    : attachment.blob || await fetchBlob(attachment.blobUrl);
  const layerFrames = await loadLayerFrames(editState.document.layers, videoProcessing.outputSize, {
    shouldRenderText: true,
  });
  if (progressCallback.isCanceled) {
    closeLayerFrames(layerFrames);
    return undefined;
  }
  if (hasMissingStickerFrames(editState.document.layers, layerFrames)) {
    closeLayerFrames(layerFrames);
    throw new Error('decodeFailed');
  }
  const duration = isPhoto ? getLayerFramesDuration(layerFrames) : attachment.quick?.duration;
  const params = { ...videoProcessing, doc: editState.document, layerFrames };
  const result = await (requestVideoProcessing(isPhoto ? {
    name: 'exportAnimation',
    args: [blob, { ...params, duration: duration! }, progressCallback],
  } : {
    name: 'exportVideo',
    args: [blob, {
      ...params,
      trim: editState.document.trim,
      isMuted: editState.document.isMuted,
    }, progressCallback],
  }) as Promise<{ blob: Blob; width: number; height: number } | undefined>).finally(() => {
    closeLayerFrames(layerFrames);
  });
  if (!result || progressCallback.isCanceled) return undefined;

  const processedAttachment: ApiAttachment = {
    ...attachment,
    blob: result.blob,
    blobUrl: URL.createObjectURL(result.blob),
    mimeType: 'video/mp4',
    filename: attachment.filename.replace(FILE_EXTENSION_REGEX, '.mp4'),
    size: result.blob.size,
    quick: { width: result.width, height: result.height, duration },
    sourceBlobUrl: undefined,
    editState: undefined,
    videoProcessing: undefined,
  };
  revokeAttachmentUrls(attachment, [processedAttachment]);

  return processedAttachment;
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
}
