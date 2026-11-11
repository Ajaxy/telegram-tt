import type {
  ApiAttachment,
  ApiAudio,
  ApiDimensions,
  ApiDocument,
  ApiGame,
  ApiLocation,
  ApiMediaExtendedPreview,
  ApiMessage,
  ApiMessageSearchType,
  ApiPhoto,
  ApiRichMessage,
  ApiSticker,
  ApiVideo,
  ApiVoice,
  ApiWebDocument,
  ApiWebPage,
  MediaContainer,
  MediaContent,
  SizeTarget,
  StatefulMediaContent,
} from '../../api/types';
import type { ActiveDownloads, SharedMediaType } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { SUPPORTED_VIDEO_CONTENT_TYPES } from '../../config';
import {
  IS_OPFS_SUPPORTED,
  IS_OPUS_SUPPORTED,
  IS_PROGRESSIVE_SUPPORTED,
  IS_SAFARI,
  MAX_BUFFER_SIZE,
} from '../../util/browser/windowEnvironment';
import { buildCollectionByKey } from '../../util/iteratees';
import { getDocumentHasPreview } from '../../components/common/helpers/documentInfo';
import { getPageMediaBlockMedia } from '../../components/iv/helpers/pageMedia';
import { getPageBlocksAudios, getPageBlocksWithMedia, type PageBlockWithMedia } from './buildPageAudioById';
import { getAttachmentMediaType, matchLinkInMessageText } from './messages';
import { WINDOWED_MEDIA_SEARCH_TYPES } from './middleSearch';

export type MediaWithThumbs = ApiPhoto | ApiVideo | ApiDocument | ApiSticker | ApiMediaExtendedPreview;
export type DownloadableMedia = ApiPhoto | ApiVideo | ApiDocument | ApiSticker | ApiAudio | ApiVoice | ApiWebDocument;
export type SharedMediaKey = number | string;

const MIN_STATIC_MAP_ZOOM = 13;
const MAX_STATIC_MAP_ZOOM = 20;
const FALLBACK_MEDIA_DIMENSIONS: ApiDimensions = { width: 100, height: 100 };
const RICH_MEDIA_KEY_SEPARATOR = ':';
const MEDIA_BLOCKS_BY_RICH_MESSAGE = new WeakMap<ApiRichMessage, PageBlockWithMedia[]>();
const RICH_MEDIA_MESSAGES_BY_MESSAGE = new WeakMap<ApiMessage, ApiMessage[]>();

export function getMessageContent(message: MediaContainer) {
  return message.content;
}

export function hasMessageMedia(message: MediaContainer) {
  return Boolean((
    getMessagePhoto(message)
    || getMessageVideo(message)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getMessageContact(message)
    || getMessagePollId(message)
    || getMessageTodo(message)
    || getMessageAction(message)
    || getMessageAudio(message)
    || getMessageVoice(message)
    || getMessagePaidMedia(message)
  ));
}

export function canEditMedia(message: MediaContainer) {
  const {
    photo, video, audio, document, text, webPage, ...otherMedia
  } = message.content;

  return !video?.isRound && !Object.keys(otherMedia).length;
}

export function canEditMediaInEditor(message: MediaContainer) {
  const video = getMessageVideo(message);
  return canEditMedia(message) && Boolean(
    getMessagePhoto(message) || getMessageDocumentPhoto(message)
    || (video && !video.isRound && !video.isGif && SUPPORTED_VIDEO_CONTENT_TYPES.has(video.mimeType)),
  );
}

export function getMessagePhoto(message: MediaContainer) {
  return message.content.photo;
}

export function getMessageActionPhoto(message: MediaContainer) {
  return message.content.action?.type === 'suggestProfilePhoto' ? message.content.action.photo : undefined;
}

export function getMessageVideo(message: MediaContainer) {
  return message.content.video;
}

export function getMessageRoundVideo(message: MediaContainer) {
  const { video } = message.content;

  return video?.isRound ? video : undefined;
}

export function getMessageAction(message: MediaContainer) {
  return message.content.action;
}

export function getMessageAudio(message: MediaContainer) {
  return message.content.audio;
}

export function getMessageVoice(message: MediaContainer) {
  return message.content.voice;
}

export function getMessageSticker(message: MediaContainer) {
  return message.content.sticker;
}

export function getMessageDocument(message: MediaContainer) {
  return message.content.document;
}

export function isDocumentPhoto(document: ApiDocument) {
  return document.innerMediaType === 'photo';
}

export function isDocumentVideo(document: ApiDocument) {
  return document.innerMediaType === 'video';
}

export function isMessageDocumentSticker(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document ? document.mimeType === 'image/webp' : undefined;
}

export function getMessageContact(message: MediaContainer) {
  return message.content.contact;
}

export function getMessagePollId(message: MediaContainer) {
  return message.content.pollId;
}

export function getMessageTodo(message: MediaContainer) {
  return message.content.todo;
}

export function getMessageInvoice(message: MediaContainer) {
  return message.content.invoice;
}

export function getMessageLocation(message: MediaContainer) {
  return message.content.location;
}

export function getMessageWebPage(message: MediaContainer) {
  return message.content.webPage;
}

export function getMessagePaidMedia(message: MediaContainer) {
  return message.content.paidMedia;
}

export function getMessageDocumentPhoto(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document && isDocumentPhoto(document) ? document : undefined;
}

export function getWebPagePhoto(webPage?: ApiWebPage) {
  return webPage?.webpageType === 'full' ? webPage.photo : undefined;
}

export function getWebPageVideo(webPage?: ApiWebPage) {
  return webPage?.webpageType === 'full' ? webPage.video : undefined;
}

export function getWebPageAudio(webPage?: ApiWebPage) {
  return webPage?.webpageType === 'full' ? webPage.audio : undefined;
}

const AUDIOS_BY_RICH_MESSAGE = new WeakMap<ApiRichMessage, { byId: Record<string, ApiAudio>; ids: string[] }>();

export function getRichMessageAudios(richMessage: ApiRichMessage) {
  let memoized = AUDIOS_BY_RICH_MESSAGE.get(richMessage);
  if (!memoized) {
    const byId = buildCollectionByKey(getPageBlocksAudios(richMessage.blocks), 'id');
    memoized = { byId, ids: Object.keys(byId) };
    AUDIOS_BY_RICH_MESSAGE.set(richMessage, memoized);
  }

  return memoized;
}

export function getWebPageDocument(webPage?: ApiWebPage) {
  return webPage?.webpageType === 'full' ? webPage.document : undefined;
}

export function getMessageDocumentVideo(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document && isDocumentVideo(document) ? document : undefined;
}

export function getMediaThumbUri(media: MediaWithThumbs) {
  return media.thumbnail?.dataUri;
}

export function getMessageIsSpoiler(message: MediaContainer) {
  const media = getMessagePhoto(message)
    || getMessageVideo(message);

  const invoiceMedia = getMessageInvoice(message)?.extendedMedia;
  return Boolean(invoiceMedia || media?.isSpoiler);
}

export function buildStaticMapHash(
  geo: ApiLocation['geo'],
  width: number,
  height: number,
  zoom: number,
  scale: number,
) {
  const {
    long, lat, accessHash, accuracyRadius,
  } = geo;
  const staticMapZoom = Math.min(Math.max(zoom, MIN_STATIC_MAP_ZOOM), MAX_STATIC_MAP_ZOOM);

  const urlParams = new URLSearchParams();
  urlParams.set('lat', lat.toString());
  urlParams.set('long', long.toString());
  urlParams.set('w', width.toString());
  urlParams.set('h', height.toString());
  urlParams.set('zoom', staticMapZoom.toString());
  urlParams.set('scale', scale.toString());
  if (accuracyRadius) urlParams.set('accuracyRadius', accuracyRadius.toString());

  return `staticMap:${accessHash}?${urlParams.toString()}`;
}

export function getPhotoMediaHash(photo: ApiPhoto | ApiDocument, target: SizeTarget, isAction?: boolean) {
  const base = `photo${photo.id}`;
  const isVideo = photo.mediaType === 'photo' && photo.isVideo;

  switch (target) {
    case 'micro':
    case 'pictogram':
      return !hasMediaLocalBlobUrl(photo) ? `${base}?size=${isAction ? 'a' : 'm'}` : undefined;
    case 'inline':
    case 'preview':
      return !hasMediaLocalBlobUrl(photo) ? `${base}?size=${isAction ? 'b' : 'x'}` : undefined;
    case 'download':
      return !isVideo ? base : getVideoProfilePhotoMediaHash(photo);
    case 'full':
    default:
      return base;
  }
}

export function getProfilePhotoMediaHash(photo: ApiPhoto) {
  return `photo${photo.id}?size=c`;
}

export function getVideoProfilePhotoMediaHash(photo: ApiPhoto) {
  if (!photo.isVideo) return undefined;
  return `photo${photo.id}?size=u`;
}

export function getVideoProfilePhotoStartTs(photo: ApiPhoto) {
  return photo.videoSizes?.find((size) => size.videoStartTs !== undefined)?.videoStartTs;
}

export function getVideoMediaHash(video: ApiVideo | ApiDocument, target: SizeTarget) {
  const base = `document${video.id}`;

  switch (target) {
    case 'micro':
    case 'pictogram':
      return !hasMediaLocalBlobUrl(video) ? `${base}?size=m` : undefined;
    case 'inline':
      return !hasMediaLocalBlobUrl(video) ? appendProgressiveQueryParameters(video, base) : undefined;
    case 'preview':
      return !hasMediaLocalBlobUrl(video) ? `${base}?size=x` : undefined;
    case 'download':
      return `${base}?download`;
    case 'full':
    default:
      return appendProgressiveQueryParameters(video, base);
  }
}

export function getVideoPreviewMediaHash(video: ApiVideo) {
  return video.hasVideoPreview ? `document${video.id}?size=v` : undefined;
}

export function getDocumentMediaHash(document: ApiDocument, target: SizeTarget) {
  const base = `document${document.id}`;

  switch (target) {
    case 'micro':
    case 'pictogram':
    case 'inline':
    case 'preview':
      if (!getDocumentHasPreview(document) || hasMediaLocalBlobUrl(document)) {
        return undefined;
      }

      return `${base}?size=m`;
    case 'full':
    case 'download':
    default:
      return base;
  }
}

export function getAudioMediaHash(audio: ApiAudio, target: SizeTarget) {
  const base = `document${audio.id}`;

  switch (target) {
    case 'micro':
    case 'pictogram':
      return getAudioHasCover(audio) ? `${base}?size=m` : undefined;
    case 'inline':
      return appendProgressiveQueryParameters(audio, base);
    case 'download':
      return `${base}?download`;
    default:
      return base;
  }
}

export function getVoiceMediaHash(voice: ApiVoice, target: SizeTarget) {
  const base = `document${voice.id}`;

  switch (target) {
    case 'micro':
    case 'pictogram':
      return undefined;
    case 'download':
      return `${base}?download`;
    case 'inline':
    default:
      return base;
  }
}

export function getWebDocumentHash(webDocument?: ApiWebDocument) {
  if (!webDocument) return undefined;
  return `webDocument:${webDocument.url}`;
}

export function getStickerMediaHash(sticker: ApiSticker, target: SizeTarget) {
  const base = `document${sticker.id}`;

  switch (target) {
    case 'micro':
    case 'pictogram':
      if (!sticker.previewPhotoSizes?.some((size) => size.type === 's')) {
        return getStickerMediaHash(sticker, 'preview');
      }
      return `${base}?size=s`;
    case 'preview':
      return `${base}?size=m`;
    case 'download':
      return `${base}?download`;
    case 'inline':
    default:
      return base;
  }
}

export function getMediaHash(media: DownloadableMedia, target: SizeTarget) {
  switch (media.mediaType) {
    case 'photo':
      return getPhotoMediaHash(media, target);
    case 'video':
      return getVideoMediaHash(media, target);
    case 'document':
      return getDocumentMediaHash(media, target);
    case 'audio':
      return getAudioMediaHash(media, target);
    case 'voice':
      return getVoiceMediaHash(media, target);
    case 'sticker':
      return getStickerMediaHash(media, target);
    case 'webDocument':
      return getWebDocumentHash(media);
    default:
      return undefined;
  }
}

export function getGamePreviewPhotoHash(game: ApiGame) {
  const { photo } = game;

  if (photo) {
    return `photo${photo.id}?size=x`;
  }

  return undefined;
}

export function getGamePreviewVideoHash(game: ApiGame) {
  const { document } = game;

  if (document) {
    return `document${document.id}`;
  }

  return undefined;
}

export function appendProgressiveQueryParameters(
  media: Pick<ApiAudio | ApiVideo | ApiDocument, 'mimeType' | 'size'>, base: string,
) {
  if (IS_PROGRESSIVE_SUPPORTED && IS_SAFARI) {
    const [path, query = ''] = base.split('?');
    const params = new URLSearchParams(query);
    params.append('fileSize', media.size.toString());
    params.append('mimeType', media.mimeType);

    return `${path}?${params.toString()}`;
  }

  return base;
}

export function getAudioHasCover(media: ApiAudio) {
  return media.thumbnailSizes && media.thumbnailSizes.length > 0;
}

export function getMediaFormat(
  media: DownloadableMedia, target: SizeTarget,
): ApiMediaFormat {
  const isDocument = media.mediaType === 'document';
  const hasInnerVideo = isDocument && media.innerMediaType === 'video';
  const isVideo = media.mediaType === 'video' || hasInnerVideo;
  const isAudio = media.mediaType === 'audio';
  const isVoice = media.mediaType === 'voice';

  const size = getMediaFileSize(media) || 0; // Media types that do not have `size` are smaller than `MAX_BUFFER_SIZE`

  if (target === 'download') {
    if (IS_PROGRESSIVE_SUPPORTED && size > MAX_BUFFER_SIZE && !IS_OPFS_SUPPORTED) {
      return ApiMediaFormat.DownloadUrl;
    }
    return ApiMediaFormat.BlobUrl;
  }

  if (isVideo && IS_PROGRESSIVE_SUPPORTED && (
    target === 'full' || target === 'inline'
  )) {
    return ApiMediaFormat.Progressive;
  }

  if (isAudio || isVoice) {
    // Safari versions that support Opus are not working with streaming
    if (isVoice && (IS_SAFARI || !IS_OPUS_SUPPORTED)) {
      return ApiMediaFormat.BlobUrl;
    }

    return ApiMediaFormat.Progressive;
  }

  return ApiMediaFormat.BlobUrl;
}

export function getMediaFileSize(media: DownloadableMedia) {
  return 'size' in media ? media.size : undefined;
}

export function hasMediaLocalBlobUrl(media: ApiPhoto | ApiVideo | ApiDocument) {
  if ('blobUrl' in media) {
    return Boolean(media.blobUrl);
  }

  if ('previewBlobUrl' in media) {
    return Boolean(media.previewBlobUrl);
  }

  return false;
}

export function getPhotoFullDimensions(photo: Pick<ApiPhoto, 'sizes' | 'thumbnail'>): ApiDimensions | undefined {
  return (
    photo.sizes.find((size) => size.type === 'w')
    || photo.sizes.find((size) => size.type === 'y')
    || getPhotoInlineDimensions(photo)
  );
}

export function getMediaDimensions(
  media: ApiPhoto | ApiVideo | ApiMediaExtendedPreview | ApiWebDocument,
): ApiDimensions & { isFallback?: true } {
  let dimensions: ApiDimensions | undefined;

  if (media.mediaType === 'photo') {
    dimensions = media.sizes.reduce<ApiDimensions | undefined>((largest, size) => {
      if (!areMediaDimensionsValid(size)) return largest;
      if (!largest || size.width * size.height > largest.width * largest.height) return size;
      return largest;
    }, undefined) || media.thumbnail;
  } else if (media.mediaType === 'webDocument') {
    dimensions = media.dimensions;
  } else {
    dimensions = areMediaDimensionsValid(media)
      ? { width: media.width, height: media.height }
      : media.thumbnail;
  }

  if (dimensions && areMediaDimensionsValid(dimensions)) {
    return dimensions;
  }

  return {
    ...FALLBACK_MEDIA_DIMENSIONS,
    isFallback: true,
  };
}

function areMediaDimensionsValid(
  dimensions: { width?: number; height?: number },
): dimensions is ApiDimensions {
  const { width, height } = dimensions;
  return typeof width === 'number' && typeof height === 'number'
    && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

export function getPhotoInlineDimensions(photo: Pick<ApiPhoto, 'sizes' | 'thumbnail'>): ApiDimensions | undefined {
  return (
    photo.sizes.find((size) => size.type === 'x')
    || photo.sizes.find((size) => size.type === 'm')
    || photo.sizes.find((size) => size.type === 's')
    || photo.thumbnail
  );
}

export function getVideoDimensions(video: ApiVideo): ApiDimensions | undefined {
  if (video.width && video.height) {
    return video as ApiDimensions;
  }

  return undefined;
}

export function getMediaTransferState(
  progress?: number, isLoadNeeded = false, isUploading = false,
) {
  const isTransferring = isUploading || isLoadNeeded;
  const transferProgress = progress || 0;

  return {
    isUploading, isTransferring, transferProgress,
  };
}

export function getMediaSearchType(media: DownloadableMedia):
  Extract<ApiMessageSearchType, 'gif' | 'media' | 'documents' | 'audio' | 'voice'> | undefined {
  if (media.mediaType === 'video') {
    if (media.isRound) return 'voice';
    return media.isGif ? 'gif' : 'media';
  }

  if (media.mediaType === 'audio') {
    return 'audio';
  }

  if (media.mediaType === 'voice') {
    return 'voice';
  }

  if (media.mediaType === 'document') {
    return 'documents';
  }

  if (media.mediaType === 'photo') {
    return 'media';
  }

  return undefined;
}

export function getMessageContentIds(
  messages: Record<number, ApiMessage>, messageIds: number[], contentType: ApiMessageSearchType,
) {
  const validator = getMessageContentValidator(contentType);
  if (!validator) return [] as Array<number>;

  return messageIds.reduce((result, messageId) => {
    if (messages[messageId] && validator(messages[messageId])) {
      result.push(messageId);
    }

    return result;
  }, [] as Array<number>);
}

// One entry per shared media tile. A plain message is its numeric id. A rich message has a `messageId:blockIndex`
// string per matching media, so a tab virtualizes tiles instead of messages.
export function getSharedMediaKeys(
  messages: Record<number, ApiMessage>, messageIds: number[], contentType: ApiMessageSearchType,
) {
  const validator = getMessageContentValidator(contentType);
  const keys: SharedMediaKey[] = [];
  if (!validator) return keys;

  messageIds.forEach((messageId) => {
    const message = messages[messageId];
    if (!message) return;

    if (validator(message)) {
      keys.push(messageId);
      return;
    }

    if (!isRichMediaMessage(message)) return;

    getRichMessageMediaBlocks(message.content.richMessage!).forEach((block, index) => {
      if (doesPageBlockMatchSearchType(block, contentType)) {
        keys.push(buildRichMediaKey(messageId, index));
      }
    });
  });

  return keys;
}

export function parseSharedMediaKey(key: SharedMediaKey): { messageId: number; mediaIndex?: number } {
  if (typeof key === 'number') return { messageId: key };

  const [messageId, mediaIndex] = key.split(RICH_MEDIA_KEY_SEPARATOR).map(Number);
  return { messageId, mediaIndex };
}

export function getSharedMediaKey(message: ApiMessage, mediaIndex?: number): SharedMediaKey {
  return isRichMediaMessage(message) ? buildRichMediaKey(message.id, mediaIndex || 0) : message.id;
}

// Rich messages keep their media in page blocks. The ones that also have regular media are shown by that media.
export function isRichMediaMessage(message: ApiMessage) {
  const {
    richMessage, photo, video, document, audio,
  } = message.content;

  return Boolean(richMessage && !photo && !video && !document && !audio);
}

// A partial rich message lists only the media before its cutoff, until media search loads it in full
export function getRichMessageMediaBlocks(richMessage: ApiRichMessage) {
  let blocks = MEDIA_BLOCKS_BY_RICH_MESSAGE.get(richMessage);
  if (!blocks) {
    blocks = getPageBlocksWithMedia(richMessage.blocks);
    MEDIA_BLOCKS_BY_RICH_MESSAGE.set(richMessage, blocks);
  }

  return blocks;
}

// Returns a copy of the message holding only one media, which lets shared media components render it as a regular one.
// It is derived on demand and never stored in the global state.
export function getRichMediaMessage(message: ApiMessage, mediaIndex: number): ApiMessage | undefined {
  let mediaMessages = RICH_MEDIA_MESSAGES_BY_MESSAGE.get(message);
  if (!mediaMessages) {
    mediaMessages = getRichMessageMediaBlocks(message.content.richMessage!).map((block) => ({
      ...message,
      content: buildPageBlockMediaContent(block),
    }));
    RICH_MEDIA_MESSAGES_BY_MESSAGE.set(message, mediaMessages);
  }

  return mediaMessages[mediaIndex];
}

function buildRichMediaKey(messageId: number, mediaIndex: number) {
  return `${messageId}${RICH_MEDIA_KEY_SEPARATOR}${mediaIndex}`;
}

function buildPageBlockMediaContent(block: PageBlockWithMedia): MediaContent {
  switch (block.type) {
    case 'photo':
      return { photo: getPageMediaBlockMedia(block) };
    case 'video':
      return { video: getPageMediaBlockMedia(block) };
    case 'audio':
      return { audio: block.audio };
    case 'document':
      return { document: block.document };
  }
}

function doesPageBlockMatchSearchType(block: PageBlockWithMedia, contentType: ApiMessageSearchType) {
  switch (contentType) {
    case 'media':
      return block.type === 'photo' || (block.type === 'video' && !block.video.isRound && !block.video.isGif);
    case 'gif':
      return block.type === 'video' && block.video.isGif;
    case 'documents':
      return block.type === 'document';
    case 'audio':
      return block.type === 'audio';
    default:
      return false;
  }
}

function getMessageContentValidator(contentType: ApiMessageSearchType): ((message: ApiMessage) => unknown) | undefined {
  switch (contentType) {
    case 'media':
      return (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return getMessagePhoto(message) || (video && !video.isRound && !video.isGif);
      };

    case 'documents':
      return getMessageDocument;

    case 'gif':
      return (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return video?.isGif;
      };

    case 'links':
      return (message: ApiMessage) => getMessageWebPage(message) || matchLinkInMessageText(message);

    case 'audio':
      return getMessageAudio;

    case 'voice':
      return (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return getMessageVoice(message) || (video && video.isRound);
      };

    case 'polls':
      return getMessagePollId;

    default:
      return undefined;
  }
}

export function isMediaLoadableInViewer(newMessage: ApiMessage) {
  if (!newMessage.content) return false;
  if (newMessage.content.photo) return true;
  if (newMessage.content.video && !newMessage.content.video.isRound && !newMessage.content.video.isGif) return true;
  return hasRichMediaOfType(newMessage, 'media');
}

function hasRichMediaOfType(message: ApiMessage, contentType: ApiMessageSearchType) {
  return isRichMediaMessage(message) && getRichMessageMediaBlocks(message.content.richMessage!)
    .some((block) => doesPageBlockMatchSearchType(block, contentType));
}

export function isMessageInMediaWindow(message: ApiMessage, mediaType: SharedMediaType) {
  switch (mediaType) {
    case 'media':
      return isMediaLoadableInViewer(message);
    case 'gif':
      return Boolean(message.content?.video?.isGif) || hasRichMediaOfType(message, 'gif');
    case 'audio':
      return Boolean(message.content?.audio) || hasRichMediaOfType(message, 'audio');
    case 'voice':
      return Boolean(message.content?.voice || message.content?.video?.isRound);
    default:
      return false;
  }
}

export function hasWindowedMediaContent(message: ApiMessage) {
  return WINDOWED_MEDIA_SEARCH_TYPES.some((mediaType) => isMessageInMediaWindow(message, mediaType));
}

export function getMediaFilename(media: DownloadableMedia) {
  if ('fileName' in media && media.fileName) {
    return media.fileName;
  }

  if (media.mediaType === 'sticker') {
    const extension = media.isLottie ? 'tgs' : media.isVideo ? 'webm' : 'webp';
    return `${media.id}.${extension}`;
  }

  if (media.mediaType === 'photo') {
    return `${media.id}.${media.isVideo ? 'mp4' : 'jpg'}`;
  }

  if (media.mediaType === 'voice') {
    return `${media.id}.${IS_OPUS_SUPPORTED ? 'ogg' : 'wav'}`;
  }

  if ('id' in media && media.id) {
    return media.id;
  }

  return `${media.mediaType}-${Math.random().toString(36).slice(4)}`;
}

export function getIsDownloading(activeDownloads: ActiveDownloads, media: DownloadableMedia) {
  const hash = getMediaHash(media, 'download');
  if (!hash) return false;
  return Boolean(activeDownloads[hash]);
}

export function getMessageMediaHash(
  message: MediaContainer,
  statefulMedia: StatefulMediaContent,
  target: SizeTarget,
) {
  const {
    video, sticker, audio, voice, document,
  } = message.content;
  const { webPage } = statefulMedia;

  const messagePhoto = getMessagePhoto(message) || getWebPagePhoto(webPage);
  const actionPhoto = getMessageActionPhoto(message);
  const messageVideo = video || getWebPageVideo(webPage);
  const messageDocument = document || getWebPageDocument(webPage);
  const messageAudio = audio || getWebPageAudio(webPage);

  if (messageVideo) {
    return getVideoMediaHash(messageVideo, target);
  }

  if (messagePhoto || actionPhoto) {
    return getPhotoMediaHash(messagePhoto || actionPhoto!, target, Boolean(actionPhoto));
  }

  if (messageDocument) {
    return getDocumentMediaHash(messageDocument, target);
  }

  if (sticker) {
    return getStickerMediaHash(sticker, target);
  }

  if (messageAudio) {
    return getAudioMediaHash(messageAudio, target);
  }

  if (voice) {
    return getVoiceMediaHash(voice, target);
  }

  return undefined;
}

export function getAllMessageMediaHashes(
  message: MediaContainer,
  statefulMedia: StatefulMediaContent,
) {
  const targets: SizeTarget[] = ['micro', 'pictogram', 'inline', 'preview', 'full', 'download'];
  const hashes = new Set<string>();

  targets.forEach((target) => {
    const hash = getMessageMediaHash(message, statefulMedia, target);
    if (hash) {
      hashes.add(hash);
    }
  });

  return Array.from(hashes);
}

export function canReplaceMessageMedia(
  message: MediaContainer, attachment: ApiAttachment,
) {
  const isPhotoOrVideo = Boolean(getMessagePhoto(message) || getMessageVideo(message));
  const isFile = Boolean(getMessageAudio(message)
    || getMessageVoice(message) || getMessageDocument(message));

  const fileType = getAttachmentMediaType(attachment);

  return (
    (isPhotoOrVideo && (fileType === 'photo' || fileType === 'video'))
    || (isFile && (fileType === 'audio' || fileType === 'file'))
  );
}
