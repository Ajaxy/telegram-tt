import type { ApiAttachment } from '../api/types';
import type { MediaEditState } from '../types/mediaEditor';

export function revokeAttachmentUrls(
  attachment?: ApiAttachment,
  retainedAttachments: ApiAttachment[] = [],
) {
  if (!attachment) return;

  const retainedUrls = new Set(retainedAttachments.flatMap(getAttachmentUrls));
  new Set(getAttachmentUrls(attachment).filter((url): url is string => Boolean(url) && !retainedUrls.has(url)))
    .forEach((url) => URL.revokeObjectURL(url));
}

export function getEditStateCoverUrls({ document, undoStack, redoStack }: MediaEditState) {
  return [document, ...undoStack, ...redoStack].flatMap(({ cover }) => (
    cover?.type === 'image' ? [cover.blobUrl] : []
  ));
}

function getAttachmentUrls(attachment: ApiAttachment) {
  const { editState } = attachment;

  return [
    attachment.blobUrl,
    attachment.compressedBlobUrl,
    attachment.previewBlobUrl,
    attachment.sourceBlobUrl,
    attachment.videoCover?.blobUrl,
    ...(editState ? getEditStateCoverUrls(editState) : []),
  ];
}
