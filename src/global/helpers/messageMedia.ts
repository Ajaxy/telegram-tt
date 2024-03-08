import type {
  ApiAttachment,
  ApiAudio,
  ApiDimensions,
  ApiDocument,
  ApiGame,
  ApiLocation,
  ApiMessage,
  ApiMessageSearchType,
  ApiPhoto,
  ApiVideo,
  ApiWebDocument,
  MediaContent,
} from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { getMessageKey } from '../../util/messageKey';
import {
  IS_OPFS_SUPPORTED,
  IS_OPUS_SUPPORTED,
  IS_PROGRESSIVE_SUPPORTED,
  IS_SAFARI,
  MAX_BUFFER_SIZE,
} from '../../util/windowEnvironment';
import { getDocumentHasPreview } from '../../components/common/helpers/documentInfo';
import { getAttachmentType, matchLinkInMessageText } from './messages';

type MediaContainer = {
  content: MediaContent;
};

type Target =
  'micro'
  | 'pictogram'
  | 'inline'
  | 'preview'
  | 'full'
  | 'download';

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
    || getMessagePoll(message)
    || getMessageAction(message)
    || getMessageAudio(message)
    || getMessageVoice(message)
  ));
}

export function hasReplaceableMedia(message: MediaContainer) {
  const video = getMessageVideo(message);
  return Boolean((
    getMessagePhoto(message)
    || (video && !video?.isRound)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getMessageAudio(message)
  ));
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

export function getMessageWebPageDocument(message: MediaContainer) {
  return getMessageWebPage(message)?.document;
}

export function isMessageDocumentPhoto(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document ? document.mediaType === 'photo' : undefined;
}

export function isMessageDocumentVideo(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document ? document.mediaType === 'video' : undefined;
}

export function isMessageDocumentSticker(message: MediaContainer) {
  const document = getMessageDocument(message);
  return document ? document.mimeType === 'image/webp' : undefined;
}

export function getMessageContact(message: MediaContainer) {
  return message.content.contact;
}

export function getMessagePoll(message: MediaContainer) {
  return message.content.poll;
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

export function getMessageWebPagePhoto(message: MediaContainer) {
  return getMessageWebPage(message)?.photo;
}

export function getMessageDocumentPhoto(message: MediaContainer) {
  return isMessageDocumentPhoto(message) ? getMessageDocument(message) : undefined;
}

export function getMessageWebPageVideo(message: MediaContainer) {
  return getMessageWebPage(message)?.video;
}

export function getMessageWebPageAudio(message: MediaContainer) {
  return getMessageWebPage(message)?.audio;
}

export function getMessageDocumentVideo(message: MediaContainer) {
  return isMessageDocumentVideo(message) ? getMessageDocument(message) : undefined;
}

export function getMessageMediaThumbnail(message: MediaContainer) {
  const media = getMessagePhoto(message)
    || getMessageVideo(message)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getMessageWebPagePhoto(message)
    || getMessageWebPageVideo(message)
    || getMessageInvoice(message)?.extendedMedia;

  if (!media) {
    return undefined;
  }

  return media.thumbnail;
}

export function getMessageMediaThumbDataUri(message: MediaContainer) {
  return getMessageMediaThumbnail(message)?.dataUri;
}

export function getMessageIsSpoiler(message: MediaContainer) {
  const media = getMessagePhoto(message)
    || getMessageVideo(message);

  const invoiceMedia = getMessageInvoice(message)?.extendedMedia;
  return Boolean(invoiceMedia || media?.isSpoiler);
}

export function getDocumentMediaHash(document: ApiDocument) {
  return `document${document.id}`;
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

  // eslint-disable-next-line max-len
  return `staticMap:${accessHash}?lat=${lat}&long=${long}&w=${width}&h=${height}&zoom=${zoom}&scale=${scale}&accuracyRadius=${accuracyRadius}`;
}

export function getMessageMediaHash(
  message: ApiMessage,
  target: Target,
) {
  const {
    video, sticker, audio, voice, document,
  } = message.content;

  const messagePhoto = getMessagePhoto(message) || getMessageWebPagePhoto(message) || getMessageDocumentPhoto(message);
  const actionPhoto = getMessageActionPhoto(message);
  const messageVideo = video || getMessageWebPageVideo(message) || getMessageDocumentVideo(message);
  const messageDocument = document || getMessageWebPageDocument(message);
  const messageAudio = audio || getMessageWebPageAudio(message);

  const content = actionPhoto || messagePhoto || messageVideo || sticker || messageAudio || voice || messageDocument;
  if (!content) {
    return undefined;
  }

  const mediaId = content.id;
  const base = `${getMessageKey(message)}${mediaId ? `:${mediaId}` : ''}`;

  if (messageVideo) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return `${base}?size=m`;
      case 'inline':
        return !hasMessageLocalBlobUrl(message) ? getVideoOrAudioBaseHash(messageVideo, base) : undefined;
      case 'preview':
        return `${base}?size=x`;
      case 'full':
        return getVideoOrAudioBaseHash(messageVideo, base);
      case 'download':
        return `${base}?download`;
    }
  }

  if (messagePhoto || actionPhoto) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return `${base}?size=${actionPhoto ? 'a' : 'm'}`;
      case 'inline':
        return !hasMessageLocalBlobUrl(message) ? `${base}?size=${actionPhoto ? 'b' : 'x'}` : undefined;
      case 'preview':
        return `${base}?size=${actionPhoto ? 'b' : 'x'}`;
      case 'full':
      case 'download':
        return messageDocument ? base : `${base}?size=${actionPhoto ? 'c' : 'z'}`;
    }
  }

  if (messageDocument) {
    switch (target) {
      case 'micro':
      case 'pictogram':
      case 'inline':
      case 'preview':
        if (!getDocumentHasPreview(messageDocument) || hasMessageLocalBlobUrl(message)) {
          return undefined;
        }

        return `${base}?size=m`;
      case 'full':
      case 'download':
        return base;
    }
  }

  if (sticker) {
    switch (target) {
      case 'micro':
        return undefined;
      case 'pictogram':
        return `${base}?size=m`;
      case 'inline':
        return base;
      case 'download':
        return `${base}?download`;
    }
  }

  if (messageAudio) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return getAudioHasCover(messageAudio) ? `${base}?size=m` : undefined;
      case 'inline':
        return getVideoOrAudioBaseHash(messageAudio, base);
      case 'download':
        return `${base}?download`;
    }
  }

  if (voice) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return undefined;
      case 'inline':
        return base;
      case 'download':
        return `${base}?download`;
    }
  }

  return undefined;
}

export function getWebDocumentHash(webDocument?: ApiWebDocument) {
  if (!webDocument) return undefined;
  return `webDocument:${webDocument.url}`;
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

export function getVideoOrAudioBaseHash(media: ApiAudio | ApiVideo | ApiDocument, base: string) {
  if (IS_PROGRESSIVE_SUPPORTED && IS_SAFARI) {
    return `${base}?fileSize=${media.size}&mimeType=${media.mimeType}`;
  }

  return base;
}

export function getAudioHasCover(media: ApiAudio) {
  return media.thumbnailSizes && media.thumbnailSizes.length > 0;
}

export function getMessageMediaFormat(
  message: ApiMessage, target: Target,
): ApiMediaFormat {
  const {
    video, audio, voice, document,
  } = message.content;
  const messageDocument = document || getMessageWebPageDocument(message);
  const isVideo = Boolean(video || getMessageWebPageVideo(message) || isMessageDocumentVideo(message));
  const size = (video || audio || messageDocument)?.size!;
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

  if (audio || voice) {
    // Safari
    if (voice && !IS_OPUS_SUPPORTED) {
      return ApiMediaFormat.BlobUrl;
    }

    return ApiMediaFormat.Progressive;
  }

  return ApiMediaFormat.BlobUrl;
}

export function getMessageFileName(message: ApiMessage) {
  const {
    photo, video, document,
  } = message.content;
  const webPagePhoto = getMessageWebPagePhoto(message);
  const webPageVideo = getMessageWebPageVideo(message);

  if (photo || webPagePhoto) {
    return `photo${message.date}.jpeg`;
  }

  const { fileName } = video || webPageVideo || document || {};

  return fileName;
}

export function getMessageFileSize(message: ApiMessage) {
  const { video, document } = message.content;
  const webPageVideo = getMessageWebPageVideo(message);
  const { size } = video || webPageVideo || document || {};

  return size;
}

export function hasMessageLocalBlobUrl(message: ApiMessage) {
  const { photo, video, document } = message.content;

  return (photo?.blobUrl) || (video?.blobUrl) || (document?.previewBlobUrl);
}

export function getChatMediaMessageIds(
  messages: Record<number, ApiMessage>, listedIds: number[], isFromSharedMedia = false,
) {
  return getMessageContentIds(messages, listedIds, isFromSharedMedia ? 'media' : 'inlineMedia');
}

export function getPhotoFullDimensions(photo: Pick<ApiPhoto, 'sizes' | 'thumbnail'>): ApiDimensions | undefined {
  return (
    photo.sizes.find((size) => size.type === 'z')
    || photo.sizes.find((size) => size.type === 'y')
    || getPhotoInlineDimensions(photo)
  );
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
  message: ApiMessage, progress?: number, isLoadNeeded = false, isUploading = false,
) {
  const isTransferring = isUploading || isLoadNeeded;
  const transferProgress = Number(progress);

  return {
    isUploading, isTransferring, transferProgress,
  };
}

export function getMessageContentIds(
  messages: Record<number, ApiMessage>, messageIds: number[], contentType: ApiMessageSearchType | 'inlineMedia',
) {
  let validator: Function;

  switch (contentType) {
    case 'media':
      validator = (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return getMessagePhoto(message) || (video && !video.isRound && !video.isGif);
      };
      break;

    case 'documents':
      validator = getMessageDocument;
      break;

    case 'links':
      validator = (message: ApiMessage) => getMessageWebPage(message) || matchLinkInMessageText(message);
      break;

    case 'audio':
      validator = getMessageAudio;
      break;

    case 'voice':
      validator = (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return getMessageVoice(message) || (video && video.isRound);
      };
      break;

    case 'inlineMedia':
      validator = (message: ApiMessage) => {
        const video = getMessageVideo(message);
        return (
          getMessagePhoto(message)
          || (video && !video.isRound && !video.isGif)
          || isMessageDocumentPhoto(message)
          || isMessageDocumentVideo(message)
        );
      };
      break;

    default:
      return [] as Array<number>;
  }

  return messageIds.reduce((result, messageId) => {
    if (messages[messageId] && validator(messages[messageId])) {
      result.push(messageId);
    }

    return result;
  }, [] as Array<number>);
}

export function getMediaDuration(message: ApiMessage) {
  const { audio, voice, video } = getMessageContent(message);
  const media = audio || voice || video || getMessageWebPageVideo(message) || getMessageWebPageAudio(message);
  if (!media) {
    return undefined;
  }

  return media.duration;
}

export function canReplaceMessageMedia(message: ApiMessage, attachment: ApiAttachment) {
  const isPhotoOrVideo = Boolean(getMessagePhoto(message)
    || getMessageWebPagePhoto(message) || Boolean(getMessageVideo(message)
      || getMessageWebPageVideo(message)));
  const isFile = Boolean(getMessageAudio(message)
    || getMessageVoice(message) || getMessageDocument(message));

  const fileType = getAttachmentType(attachment);

  return (
    (isPhotoOrVideo && (fileType === 'image' || fileType === 'video'))
    || (isFile && (fileType === 'audio' || fileType === 'file'))
  );
}
