import type { ApiAttachment, ApiVideo, MediaContent } from '../api/types';

import {
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../config';
import { generateWaveform } from './generateWaveform';
import { omit } from './iteratees';
import { interpolateArray } from './waveform';

const LOCAL_MEDIA_UPLOADING_TEMP_ID = 'temp';
const INPUT_WAVEFORM_LENGTH = 63;

export default function buildUploadingMedia(attachment: ApiAttachment): MediaContent {
  if (attachment.gif) {
    return { video: attachment.gif };
  }

  const {
    filename: fileName,
    blobUrl,
    previewBlobUrl,
    mimeType,
    size,
    audio,
    shouldSendAsFile,
    shouldSendAsSpoiler,
    ttlSeconds,
    isRoundVideo,
    shouldSendAsGif,
    videoCover,
  } = attachment;

  if (!shouldSendAsFile) {
    if (attachment.quick) {
      const isPhoto = SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType);
      if (isPhoto && !shouldSendAsGif) {
        const { width, height } = attachment.quick;
        return {
          photo: {
            mediaType: 'photo',
            id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
            sizes: [],
            thumbnail: { width, height, dataUri: previewBlobUrl || blobUrl },
            blobUrl,
            date: Math.round(Date.now() / 1000),
            isSpoiler: shouldSendAsSpoiler,
          },
        };
      }
      if (isRoundVideo || isPhoto || SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
        const { width, height, duration } = attachment.quick;
        const video: ApiVideo = {
          mediaType: 'video',
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          mimeType,
          duration: duration || 0,
          fileName,
          width,
          height,
          blobUrl,
          thumbnail: previewBlobUrl ? { width, height, dataUri: previewBlobUrl } : undefined,
          size,
          isSpoiler: shouldSendAsSpoiler,
          isRound: isRoundVideo,
          isGif: shouldSendAsGif,
          waveform: isRoundVideo ? generateWaveform(duration || 0) : undefined,
          cover: videoCover && !shouldSendAsGif ? {
            mediaType: 'photo',
            id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
            sizes: [],
            thumbnail: { width: videoCover.width, height: videoCover.height, dataUri: videoCover.blobUrl },
            blobUrl: videoCover.blobUrl,
            date: Math.round(Date.now() / 1000),
          } : undefined,
        };

        const editDocument = attachment.editState?.document;
        return {
          video: attachment.videoProcessing
            ? {
              ...omit(video, ['blobUrl']),
              previewBlobUrl: isPhoto ? blobUrl : previewBlobUrl,
              editPreview: !isPhoto && !videoCover && editDocument
                ? { blobUrl, mimeType, document: editDocument } : undefined,
            }
            : video,
          ttlSeconds,
        };
      }
    }
    if (attachment.voice) {
      const { duration, waveform } = attachment.voice;
      const inputWaveform = waveform.length === INPUT_WAVEFORM_LENGTH
        ? waveform
        : interpolateArray(waveform, INPUT_WAVEFORM_LENGTH).data;
      return {
        voice: {
          mediaType: 'voice',
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          duration,
          waveform: inputWaveform,
          size,
        },
        ttlSeconds,
      };
    }
    if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) {
      const { duration, performer, title } = audio || {};
      return {
        audio: {
          mediaType: 'audio',
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          mimeType,
          fileName,
          size,
          duration: duration || 0,
          title,
          performer,
        },
      };
    }
  }

  return {
    document: {
      mediaType: 'document',
      mimeType,
      fileName,
      size,
      previewBlobUrl,
    },
  };
}
