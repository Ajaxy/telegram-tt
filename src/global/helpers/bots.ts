import type { ApiPhoto } from '../../api/types';

export function getBotCoverMediaHash(photo: ApiPhoto) {
  return `photo${photo.id}?size=x`;
}
