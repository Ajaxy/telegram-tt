import {
  ApiAudio, ApiMediaFormat, ApiMessage, ApiMessageSearchType, ApiPhoto, ApiVideo,
} from '../../api/types';

import { IS_OPUS_SUPPORTED, IS_PROGRESSIVE_SUPPORTED, IS_SAFARI } from '../../util/environment';
import { getMessageKey, isMessageLocal, matchLinkInMessageText } from './messages';
import { getDocumentHasPreview } from '../../components/common/helpers/documentInfo';

export type IDimensions = {
  width: number;
  height: number;
};

type Target = 'micro' | 'pictogram' | 'inline' | 'viewerPreview' | 'viewerFull' | 'download';

const MAX_INLINE_VIDEO_SIZE = 10 * 1024 ** 2; // 10 MB

export function getMessageContent(message: ApiMessage) {
  return message.content;
}

export function hasMessageMedia(message: ApiMessage) {
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

export function getMessagePhoto(message: ApiMessage) {
  return message.content.photo;
}

export function getMessageVideo(message: ApiMessage) {
  return message.content.video;
}

export function getMessageRoundVideo(message: ApiMessage) {
  const { video } = message.content;

  return video && video.isRound ? video : undefined;
}

export function getMessageAction(message: ApiMessage) {
  return message.content.action;
}

export function getMessageAudio(message: ApiMessage) {
  return message.content.audio;
}

export function getMessageVoice(message: ApiMessage) {
  return message.content.voice;
}

export function getMessageSticker(message: ApiMessage) {
  return message.content.sticker;
}

export function getMessageDocument(message: ApiMessage) {
  return message.content.document;
}

export function getMessageContact(message: ApiMessage) {
  return message.content.contact;
}

export function getMessagePoll(message: ApiMessage) {
  return message.content.poll;
}

export function getMessageInvoice(message: ApiMessage) {
  return message.content.invoice;
}

export function getMessageWebPage(message: ApiMessage) {
  return message.content.webPage;
}

export function getMessageWebPagePhoto(message: ApiMessage) {
  const webPage = getMessageWebPage(message);
  return webPage ? webPage.photo : undefined;
}

export function getMessageMediaThumbnail(message: ApiMessage) {
  const media = getMessagePhoto(message)
    || getMessageVideo(message)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getMessageWebPagePhoto(message);

  if (!media) {
    return undefined;
  }

  return media.thumbnail;
}

export function getMessageMediaThumbDataUri(message: ApiMessage) {
  const thumbnail = getMessageMediaThumbnail(message);

  return thumbnail ? thumbnail.dataUri : undefined;
}

export function getMessageMediaHash(
  message: ApiMessage,
  target: Target,
) {
  const {
    photo, video, sticker, audio, voice, document,
  } = message.content;
  const webPagePhoto = getMessageWebPagePhoto(message);

  if (!(photo || video || sticker || webPagePhoto || audio || voice || document)) {
    return undefined;
  }

  const base = getMessageKey(message);

  if (photo || webPagePhoto) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return `${base}?size=m`;
      case 'inline':
        if (hasMessageLocalBlobUrl(message)) {
          return undefined;
        }

        return `${base}?size=x`;
      case 'viewerPreview':
        return `${base}?size=x`;
      case 'viewerFull':
        return `${base}?size=z`;
    }
  }

  if (video) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return `${base}?size=m`;
      case 'inline':
        if (hasMessageLocalBlobUrl(message)) {
          return undefined;
        }

        if (canMessagePlayVideoInline(video)) {
          return getVideoOrAudioBaseHash(video, base);
        }

        return `${base}?size=z`;
      case 'viewerPreview':
        return `${base}?size=m`;
      case 'viewerFull':
        return getVideoOrAudioBaseHash(video, base);
      case 'download':
        return `${base}?download`;
    }
  }

  if (document) {
    switch (target) {
      case 'micro':
      case 'pictogram':
      case 'inline':
        if (!getDocumentHasPreview(document) || hasMessageLocalBlobUrl(message)) {
          return undefined;
        }

        return `${base}?size=m`;
      default:
        return base;
    }
  }

  if (sticker) {
    switch (target) {
      case 'micro':
        return undefined;
      case 'pictogram':
        return `${base}?size=m`;
      default:
        return base;
    }
  }

  if (audio) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return undefined;
      default:
        return getVideoOrAudioBaseHash(audio, base);
    }
  }

  if (voice) {
    switch (target) {
      case 'micro':
      case 'pictogram':
        return undefined;
      default:
        return base;
    }
  }

  return undefined;
}

function getVideoOrAudioBaseHash(media: ApiAudio | ApiVideo, base: string) {
  if (IS_PROGRESSIVE_SUPPORTED && IS_SAFARI) {
    return `${base}?fileSize=${media.size}&mimeType=${media.mimeType}`;
  }

  return base;
}

export function getMessageMediaFormat(
  message: ApiMessage, target: Target,
): Exclude<ApiMediaFormat, ApiMediaFormat.Lottie>;
export function getMessageMediaFormat(message: ApiMessage, target: Target, canBeLottie: true): ApiMediaFormat;
export function getMessageMediaFormat(
  message: ApiMessage, target: Target,
): ApiMediaFormat {
  const {
    sticker, video, audio, voice,
  } = message.content;

  if (sticker && target === 'inline' && sticker.isAnimated) {
    return ApiMediaFormat.Lottie;
  } else if (video && IS_PROGRESSIVE_SUPPORTED && (
    (target === 'viewerFull') || (target === 'inline' && canMessagePlayVideoInline(video))
  )) {
    return ApiMediaFormat.Progressive;
  } else if (audio || voice) {
    // Safari
    if (voice && !IS_OPUS_SUPPORTED) {
      return ApiMediaFormat.BlobUrl;
    }

    return ApiMediaFormat.Progressive;
  }

  return ApiMediaFormat.BlobUrl;
}

export function getMessageMediaFilename(message: ApiMessage) {
  const { photo, video, webPage } = message.content;

  if (photo || (webPage && webPage.photo)) {
    return `photo${message.date}.jpeg`;
  }

  if (video) {
    return video.fileName;
  }

  return undefined;
}

export function hasMessageLocalBlobUrl(message: ApiMessage) {
  const { photo, video, document } = message.content;

  return (photo && photo.blobUrl) || (video && video.blobUrl) || (document && document.previewBlobUrl);
}

export function canMessagePlayVideoInline(video: ApiVideo): boolean {
  return video.isGif || video.isRound || video.size <= MAX_INLINE_VIDEO_SIZE;
}

export function getChatMediaMessageIds(
  messages: Record<number, ApiMessage>, listedIds: number[], reverseOrder = false,
) {
  const ids = getMessageContentIds(messages, listedIds, 'media');

  return reverseOrder ? ids.reverse() : ids;
}

export function getPhotoFullDimensions(photo: ApiPhoto): IDimensions | undefined {
  return (
    photo.sizes.find((size) => size.type === 'z')
    || photo.sizes.find((size) => size.type === 'y')
    || getPhotoInlineDimensions(photo)
  );
}

export function getPhotoInlineDimensions(photo: ApiPhoto): IDimensions | undefined {
  return (
    photo.sizes.find((size) => size.type === 'x')
    || photo.sizes.find((size) => size.type === 'm')
    || photo.sizes.find((size) => size.type === 's')
    || photo.thumbnail
  );
}

export function getVideoDimensions(video: ApiVideo): IDimensions | undefined {
  if (video.width && video.height) {
    return video as IDimensions;
  }

  return undefined;
}

export function getMediaTransferState(message: ApiMessage, progress?: number, isDownloadNeeded = false) {
  const isUploading = isMessageLocal(message);
  const isTransferring = isUploading || isDownloadNeeded;
  const transferProgress = Number(progress);

  return {
    isUploading, isTransferring, transferProgress,
  };
}

export function getMessageContentIds(
  messages: Record<number, ApiMessage>, messageIds: number[], contentType: ApiMessageSearchType,
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
  const media = audio || voice || video;
  if (!media) {
    return undefined;
  }

  return media.duration;
}
