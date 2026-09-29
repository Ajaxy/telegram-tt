import type { ApiAttachment, MediaContent } from '../api/types';

import {
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../config';
import { generateWaveform } from './generateWaveform';
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
  } = attachment;

  if (!shouldSendAsFile) {
    if (attachment.quick) {
      if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
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
      if (isRoundVideo || SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
        const { width, height, duration } = attachment.quick;
        return {
          video: {
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
            waveform: isRoundVideo ? generateWaveform(duration || 0) : undefined,
          },
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
