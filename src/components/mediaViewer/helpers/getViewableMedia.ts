import type {
  ApiMessage, ApiPeer, ApiPeerPhotos, ApiSponsoredMessage,
} from '../../../api/types';
import type { MediaViewerMedia } from '../../../types';

import { getMessageContent, isDocumentPhoto, isDocumentVideo } from '../../../global/helpers';

export type MediaViewerItem = {
  type: 'message';
  message: ApiMessage;
  mediaIndex?: number;
} | {
  type: 'avatar';
  avatarOwner: ApiPeer;
  profilePhotos: ApiPeerPhotos;
  mediaIndex: number;
} | {
  type: 'standalone';
  media: MediaViewerMedia[];
  mediaIndex: number;
} | {
  type: 'sponsoredMessage';
  message: ApiSponsoredMessage;
  mediaIndex?: number;
};

type ViewableMedia = {
  media: MediaViewerMedia;
  isSingle?: boolean;
};

export function getMediaViewerItem({
  message, avatarOwner, profilePhotos, standaloneMedia, mediaIndex, sponsoredMessage,
}: {
  message?: ApiMessage;
  avatarOwner?: ApiPeer;
  profilePhotos?: ApiPeerPhotos;
  standaloneMedia?: MediaViewerMedia[];
  sponsoredMessage?: ApiSponsoredMessage;
  mediaIndex?: number;
}): MediaViewerItem | undefined {
  if (avatarOwner && profilePhotos) {
    return {
      type: 'avatar',
      avatarOwner,
      profilePhotos,
      mediaIndex: mediaIndex!,
    };
  }

  if (standaloneMedia) {
    return {
      type: 'standalone',
      media: standaloneMedia!,
      mediaIndex: mediaIndex!,
    };
  }

  if (message) {
    return {
      type: 'message',
      message,
      mediaIndex,
    };
  }

  if (sponsoredMessage) {
    return {
      type: 'sponsoredMessage',
      message: sponsoredMessage,
      mediaIndex,
    };
  }

  return undefined;
}

export default function getViewableMedia(params?: MediaViewerItem): ViewableMedia | undefined {
  if (!params) return undefined;

  if (params.type === 'standalone') {
    return {
      media: params.media[params.mediaIndex],
      isSingle: params.media.length === 1,
    };
  }

  if (params.type === 'avatar') {
    const avatar = params.profilePhotos?.photos[params.mediaIndex];
    if (avatar) {
      return {
        media: avatar,
      };
    }
    return undefined;
  }

  const {
    action, document, photo, video, webPage, paidMedia,
  } = getMessageContent(params.message);

  if (action?.photo) {
    return {
      media: action.photo,
      isSingle: true,
    };
  }

  if (document && (isDocumentPhoto(document) || isDocumentVideo(document))) {
    return {
      media: document,
    };
  }

  if (webPage) {
    const { photo: webPagePhoto, video: webPageVideo, document: webPageDocument } = webPage;
    const isDocumentMedia = webPageDocument && (isDocumentPhoto(webPageDocument) || isDocumentVideo(webPageDocument));
    const mediaDocument = isDocumentMedia ? webPageDocument : undefined;
    const media = webPageVideo || mediaDocument || webPagePhoto;
    if (media) {
      return {
        media,
        isSingle: true,
      };
    }
  }

  if (paidMedia) {
    const extendedMedia = paidMedia.extendedMedia[params.mediaIndex || 0];
    if (!('mediaType' in extendedMedia)) {
      const { photo: extendedPhoto, video: extendedVideo } = extendedMedia;
      return {
        media: (extendedPhoto || extendedVideo)!,
      };
    }
  }

  const media = video || photo;

  if (media) {
    return {
      media,
      isSingle: video?.isGif,
    };
  }

  return undefined;
}
