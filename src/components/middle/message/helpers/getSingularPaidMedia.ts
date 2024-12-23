import type { ApiPaidMedia } from '../../../../api/types';

export default function getSingularPaidMedia(media?: ApiPaidMedia) {
  if (!media || media.extendedMedia.length !== 1) {
    return {
      photo: undefined,
      video: undefined,
    };
  }

  const singularMedia = media.extendedMedia[0];
  const isPreview = 'mediaType' in singularMedia;
  const photo = isPreview ? (!singularMedia.duration ? singularMedia : undefined) : singularMedia.photo;
  const video = isPreview ? (singularMedia.duration ? singularMedia : undefined) : singularMedia.video;

  return { photo, video };
}
