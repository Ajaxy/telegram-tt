import type { JSONContent as TiptapJsonContent } from '@tiptap/core';

import type {
  ApiAttachment,
  ApiAudio,
  ApiDocument,
  ApiPageBlockAudio,
  ApiPageBlockDocument,
  ApiPageBlockPhoto,
  ApiPageBlockVideo,
  ApiPageCaption,
  ApiPhoto,
  ApiRichText,
  ApiVideo,
} from '../../api/types';

import { revokeAttachmentUrls } from '../attachments';
import { MEDIA_NODE_NAME } from './constants';

export type RichEditorMediaKind = 'photo' | 'video' | 'audio' | 'document' | 'collage' | 'slideshow';

export type RichEditorMediaItem = {
  type: 'photo' | 'video' | 'audio' | 'document';
  media?: ApiPhoto | ApiVideo | ApiAudio | ApiDocument;
  uploadId?: string;
  isSpoiler?: true;
  caption: ApiPageCaption;
  url?: string;
  webPageId?: string;
  isAutoplay?: true;
  isLoop?: true;
};

export type RichEditorMediaAttrs = {
  kind: RichEditorMediaKind;
  items: RichEditorMediaItem[];
  credit: ApiRichText;
};

export type RichEditorMediaUpload = {
  attachment: ApiAttachment;
  previousAttachment?: ApiAttachment;
  preview: ApiPhoto | ApiVideo | ApiAudio | ApiDocument;
  progress: number;
  status: 'preparing' | 'pending' | 'failed' | 'resolved' | 'canceled';
  cancel: NoneToVoidFunction;
  cancelReplacement?: NoneToVoidFunction;
  retry: NoneToVoidFunction;
};

const EMPTY_RICH_TEXT: ApiRichText = { type: 'empty' };
const MAX_RICH_MEDIA_ATTRS = 100;
const MAX_RICH_MEDIA_REFS = 500;
const MAX_UINT64 = 18446744073709551615n;
const RE_WEB_PAGE_ID = /^-?\d+$/;
const mediaByRef = new Map<string, ApiPhoto | ApiVideo | ApiAudio | ApiDocument>();
const mediaAttrsById = new Map<string, RichEditorMediaAttrs>();
const uploadsById = new Map<string, RichEditorMediaUpload>();
const uploadListenersById = new Map<string, Set<NoneToVoidFunction>>();
let nextMediaAttrsId = 0;

export const EMPTY_RICH_MEDIA_CAPTION: ApiPageCaption = {
  text: EMPTY_RICH_TEXT,
  credit: EMPTY_RICH_TEXT,
};
export const RICH_MEDIA_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/quicktime',
]);

export function buildRichMediaItemBlock(
  item: RichEditorMediaItem,
  media = item.media,
): ApiPageBlockPhoto | ApiPageBlockVideo | ApiPageBlockAudio | ApiPageBlockDocument | undefined {
  if (item.type === 'audio' && media?.mediaType === 'audio') {
    return { type: 'audio', audio: media, caption: item.caption };
  }

  if (item.type === 'document' && media?.mediaType === 'document') {
    return { type: 'document', document: media, caption: item.caption };
  }

  if (item.type === 'photo' && media?.mediaType === 'photo') {
    return {
      type: 'photo',
      photo: media,
      caption: item.caption,
      isSpoiler: item.isSpoiler,
      url: item.url,
      webPageId: item.webPageId,
    };
  }

  if (item.type === 'video' && media?.mediaType === 'video') {
    return {
      type: 'video',
      video: media,
      caption: item.caption,
      isSpoiler: item.isSpoiler,
      isAutoplay: item.isAutoplay,
      isLoop: item.isLoop,
    };
  }

  return undefined;
}

export function getRichMediaRef(type: RichEditorMediaItem['type'], id: string) {
  const unsignedId = BigInt.asUintN(64, BigInt(id));
  return `tg://${type}?id=${unsignedId}`;
}

export function registerRichEditorMediaAttrs(attrs: RichEditorMediaAttrs) {
  nextMediaAttrsId += 1;
  const id = String(nextMediaAttrsId);
  mediaAttrsById.set(id, attrs);
  if (mediaAttrsById.size > MAX_RICH_MEDIA_ATTRS) {
    mediaAttrsById.delete(mediaAttrsById.keys().next().value!);
  }
  return id;
}

export function resolveRichEditorMediaAttrs(id?: string) {
  return id ? mediaAttrsById.get(id) : undefined;
}

export function registerRichMedia(media: ApiPhoto | ApiVideo | ApiAudio | ApiDocument) {
  const ref = getRichMediaRef(media.mediaType, media.id!);
  mediaByRef.delete(ref);
  mediaByRef.set(ref, media);

  if (mediaByRef.size > MAX_RICH_MEDIA_REFS) {
    mediaByRef.delete(mediaByRef.keys().next().value!);
  }
}

export function resolveRichMediaRef(value: string, expectedType?: RichEditorMediaItem['type']) {
  const ref = parseRichMediaRef(value);
  if (!ref || (expectedType && ref.type !== expectedType)) {
    return undefined;
  }

  const media = mediaByRef.get(getRichMediaRef(ref.type, ref.id));
  if (!media || ref.type !== media.mediaType) {
    return undefined;
  }

  registerRichMedia(media);
  return { type: ref.type, media };
}

export function parseRichMediaRef(value: string) {
  const match = /^tg:\/\/(photo|video|audio|document)\?id=(\d{1,20})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const id = BigInt(match[2]);
  if (id === 0n || id > MAX_UINT64) {
    return undefined;
  }

  return {
    type: match[1] as RichEditorMediaItem['type'],
    id: id.toString(),
  };
}

export function setRichMediaUpload(uploadId: string, upload: RichEditorMediaUpload) {
  uploadsById.set(uploadId, upload);
  notifyRichMediaUpload(uploadId);
}

export function updateRichMediaUpload(uploadId: string, update: Partial<RichEditorMediaUpload>) {
  const current = uploadsById.get(uploadId);
  if (!current) {
    return;
  }

  uploadsById.set(uploadId, { ...current, ...update });
  notifyRichMediaUpload(uploadId);
}

export function getRichMediaUpload(uploadId?: string) {
  return uploadId ? uploadsById.get(uploadId) : undefined;
}

export function subscribeToRichMediaUpload(uploadId: string, listener: NoneToVoidFunction) {
  const listeners = uploadListenersById.get(uploadId) || new Set<NoneToVoidFunction>();
  listeners.add(listener);
  uploadListenersById.set(uploadId, listeners);

  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      uploadListenersById.delete(uploadId);
    }
  };
}

export function removeRichMediaUpload(uploadId?: string) {
  if (!uploadId) {
    return;
  }

  const upload = uploadsById.get(uploadId);
  upload?.cancel();
  uploadsById.delete(uploadId);
  revokeAttachmentUrls(upload?.attachment);
  revokeAttachmentUrls(upload?.previousAttachment);
  notifyRichMediaUpload(uploadId);
}

export function cancelRichMediaUpload(uploadId: string) {
  const upload = getRichMediaUpload(uploadId);
  if (!upload || upload.status === 'resolved') return;

  upload.cancel();
  updateRichMediaUpload(uploadId, { status: 'canceled', progress: 0 });
}

export function getRichMediaUploadIds(doc: TiptapJsonContent) {
  const result = new Set<string>();
  visitTiptapNode(doc, (node) => {
    if (node.type !== MEDIA_NODE_NAME) {
      return;
    }

    getRichEditorMediaAttrs(node)?.items.forEach(({ uploadId }) => {
      if (uploadId) result.add(uploadId);
    });
  });
  return result;
}

export function getRichEditorMediaAttrs(node: TiptapJsonContent): RichEditorMediaAttrs | undefined {
  const kind = node.attrs?.kind;
  const items = node.attrs?.items;
  const credit = node.attrs?.credit;
  if (!isRichMediaKind(kind) || !Array.isArray(items) || !isApiRichText(credit)) {
    return undefined;
  }

  if (!items.every(isRichMediaItem)) return undefined;
  if (kind === 'document' || kind === 'audio'
    ? items.length !== 1 || items[0].type !== kind
    : items.some((item) => item.type === 'document' || item.type === 'audio')) return undefined;

  return {
    kind,
    items: items.map((item) => {
      // History snapshots can precede upload completion
      const upload = getRichMediaUpload(item.uploadId);
      return !item.media && upload?.status === 'resolved' ? { ...item, media: upload.preview } : item;
    }),
    credit,
  };
}

function visitTiptapNode(node: TiptapJsonContent, callback: (node: TiptapJsonContent) => void) {
  callback(node);
  node.content?.forEach((child) => visitTiptapNode(child, callback));
}

function notifyRichMediaUpload(uploadId: string) {
  uploadListenersById.get(uploadId)?.forEach((listener) => listener());
}

export function isRichMediaKind(value: unknown): value is RichEditorMediaKind {
  return value === 'photo' || value === 'video' || value === 'audio'
    || value === 'document' || value === 'collage' || value === 'slideshow';
}

function isRichMediaItem(value: unknown): value is RichEditorMediaItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<RichEditorMediaItem>;
  return (item.type === 'photo' || item.type === 'video' || item.type === 'audio' || item.type === 'document')
    && (item.uploadId === undefined || typeof item.uploadId === 'string')
    && (item.isSpoiler === undefined || item.isSpoiler === true)
    && (item.url === undefined || typeof item.url === 'string')
    && (item.webPageId === undefined || (
      typeof item.webPageId === 'string' && RE_WEB_PAGE_ID.test(item.webPageId)
    ))
    && (item.isAutoplay === undefined || item.isAutoplay === true)
    && (item.isLoop === undefined || item.isLoop === true)
    && isApiRichText(item.caption?.text)
    && isApiRichText(item.caption?.credit);
}

export function isApiRichText(value: unknown): value is ApiRichText {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');
}
