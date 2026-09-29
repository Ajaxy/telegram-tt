import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAudio,
  ApiDocument,
  ApiPhoto,
  ApiSticker,
  ApiVideo,
} from '../../types';

import { pick } from '../../../util/iteratees';
import localDb from '../localDb';

export function buildInputDocument(media: ApiAudio | ApiSticker | ApiVideo | ApiDocument) {
  if (!media.id) {
    return undefined;
  }

  const document = localDb.documents[media.id];
  if (!document) {
    return undefined;
  }

  return new GramJs.InputDocument(pick(document, [
    'id',
    'accessHash',
    'fileReference',
  ]));
}

export function buildInputPhoto(photo: ApiPhoto) {
  const localPhoto = localDb.photos[photo.id];
  if (!localPhoto) {
    return undefined;
  }

  return new GramJs.InputPhoto(pick(localPhoto, [
    'id',
    'accessHash',
    'fileReference',
  ]));
}
