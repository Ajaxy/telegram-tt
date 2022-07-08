import type { ApiPhoto } from '../../api/types';

export function getVideoAvatarMediaHash(photo: ApiPhoto) {
  return `videoAvatar${photo.id}?size=u`;
}
