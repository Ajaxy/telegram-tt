import type { ApiAttachment } from '../api/types';

export function revokeAttachmentUrls(
  attachment?: ApiAttachment,
  retainedAttachments: ApiAttachment[] = [],
) {
  if (!attachment) return;

  const retainedUrls = new Set(retainedAttachments.flatMap((retainedAttachment) => [
    retainedAttachment.blobUrl,
    retainedAttachment.compressedBlobUrl,
    retainedAttachment.previewBlobUrl,
  ]));
  new Set([
    attachment.blobUrl,
    attachment.compressedBlobUrl,
    attachment.previewBlobUrl,
  ].filter((url): url is string => Boolean(url) && !retainedUrls.has(url)))
    .forEach((url) => URL.revokeObjectURL(url));
}
