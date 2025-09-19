import { getGlobal, setGlobal } from '../../../global';

import type { ApiDocument, ApiMessage } from '../../../api/types';

import {
  getDocumentMediaHash, getMediaFormat, getMessageDocumentPhoto, getMessageDocumentVideo,
} from '../../../global/helpers';
import { updateChatMessage } from '../../../global/reducers';
import { selectChatMessage } from '../../../global/selectors';
import { IS_PROGRESSIVE_SUPPORTED } from '../../../util/browser/windowEnvironment';
import { preloadImage, preloadVideo } from '../../../util/files';
import { fetch } from '../../../util/mediaLoader';
import LimitedMap from '../../../util/primitives/LimitedMap';

const preloadedHashes = new LimitedMap<string, void>(100);

export async function preloadDocumentMedia(mediaContainer: ApiMessage) {
  const video = getMessageDocumentVideo(mediaContainer);
  const photo = getMessageDocumentPhoto(mediaContainer);

  const media = video || photo;

  // Skip large photos that were not processed by the server
  const shouldSkipPhoto = photo && photo.mediaSize && !photo.mediaSize.fromDocumentAttribute;
  if (!media || media.previewBlobUrl || shouldSkipPhoto) {
    return;
  }

  const hash = getDocumentMediaHash(media, 'full');
  if (!hash || preloadedHashes.has(hash)) {
    return;
  }

  preloadedHashes.set(hash, undefined);

  const url = await fetch(hash, getMediaFormat(media, 'full'));
  if (!url) {
    return;
  }

  let dimensions: ApiDocument['mediaSize'] | undefined;

  if (video && IS_PROGRESSIVE_SUPPORTED) {
    const videoEl = await preloadVideo(url);
    dimensions = { width: videoEl.videoWidth, height: videoEl.videoHeight, fromPreload: true };
  }

  if (photo) {
    const img = await preloadImage(url);
    dimensions = { width: img.naturalWidth, height: img.naturalHeight, fromPreload: true };
  }

  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return;
  }

  let global = getGlobal();
  const message = selectChatMessage(global, mediaContainer.chatId, mediaContainer.id);
  if (!message || !message.content.document) return;
  global = updateChatMessage(global, mediaContainer.chatId, mediaContainer.id, {
    content: {
      ...message.content,
      document: {
        ...message.content.document,
        mediaSize: dimensions,
      },
    },
  });
  setGlobal(global);
}
