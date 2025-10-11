import type { MockTypes } from './MockTypes';

import { toJSNumber } from '../../../../util/numbers';
import Api from '../../tl/api';

import { MOCK_STARTING_DATE } from './MockTypes';

export default function createMockedPhoto(documentId: number, mockData: MockTypes): Api.Photo {
  const document = mockData.documents.find((doc) => doc.id === documentId);

  if (!document) throw Error('No such document ' + documentId);

  const {
    accessHash = 1n,
    fileReference = Buffer.from([0]),
    date = MOCK_STARTING_DATE,
    dcId = 2,
    url,
    size,
    ...rest
  } = document;

  return new Api.Photo({
    ...rest,
    id: BigInt(documentId),
    accessHash,
    fileReference,
    date,
    sizes: [
      new Api.PhotoSize({
        type: 'm',
        w: 100,
        h: 100,
        size: toJSNumber(size),
      }),
      new Api.PhotoSize({
        type: 'x',
        w: 100,
        h: 100,
        size: toJSNumber(size),
      }),
    ],
    // thumbs?: Api.TypePhotoSize[];
    // videoThumbs?: Api.TypeVideoSize[];
    dcId,
  });
}
