import type {
  ApiContact,
  ApiFormattedText,
  ApiMediaTodo,
  ApiMessage,
  ApiNewMediaTodo,
  ApiNewPoll,
  ApiPoll,
  ApiSticker,
  ApiVideo,
} from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import {
  getAudioMediaHash,
  getDocumentMediaHash,
  getMessageAudio,
  getMessageDocument,
  getMessagePhoto,
  getMessageSticker,
  getMessageTodo,
  getMessageVideo,
  getMessageVoice,
  getPhotoMediaHash,
  getVideoMediaHash,
  getVoiceMediaHash,
} from '../../global/helpers/messageMedia';
import { blobToFile } from '../../util/files';
import * as mediaLoader from '../../util/mediaLoader';

export interface MediaFileWithMeta {
  file: File;
  quick?: {
    width: number;
    height: number;
  };
}

export interface TemplateContent {
  text?: ApiFormattedText;
  files: File[];
  mediaFiles: MediaFileWithMeta[];
}

/**
 * Checks if a message can be used as a template.
 * Excludes: locations, games, giveaways, actions
 */
export function canUseMessageAsTemplate(message: ApiMessage): boolean {
  const { content } = message;

  // Exclude unsupported content types
  if (
    content.location
    || content.game
    || content.giveaway
    || content.giveawayResults
    || content.action
  ) {
    return false;
  }

  // Must have either text, contact, poll, todo, or supported media
  const hasText = Boolean(content.text?.text);
  const hasContact = Boolean(content.contact);
  const hasPoll = Boolean(content.pollId);
  const hasTodo = Boolean(content.todo);
  const hasPhoto = Boolean(getMessagePhoto(message));
  const hasVideo = Boolean(getMessageVideo(message));
  const hasDocument = Boolean(getMessageDocument(message));
  const hasSticker = Boolean(getMessageSticker(message));
  const hasAudio = Boolean(getMessageAudio(message));
  const hasVoice = Boolean(getMessageVoice(message));

  return hasText || hasContact || hasPoll || hasTodo || hasPhoto || hasVideo
    || hasDocument || hasSticker || hasAudio || hasVoice;
}

/**
 * Extracts text content from a message for use as template
 */
export function extractMessageText(message: ApiMessage): ApiFormattedText | undefined {
  const { text } = message.content;
  if (!text?.text) return undefined;

  return {
    text: text.text,
    entities: text.entities,
  };
}

/**
 * Downloads media from a message and converts to File objects with metadata
 */
export async function downloadMessageMedia(message: ApiMessage): Promise<MediaFileWithMeta[]> {
  const mediaFiles: MediaFileWithMeta[] = [];

  const photo = getMessagePhoto(message);
  const video = getMessageVideo(message);
  const document = getMessageDocument(message);
  const audio = getMessageAudio(message);

  // Download photo - include dimensions for inline display
  if (photo) {
    const mediaHash = getPhotoMediaHash(photo, 'full');
    if (mediaHash) {
      try {
        const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const fileName = `photo_${photo.id}.jpg`;
              // Get dimensions from the largest available size
              const largestSize = photo.sizes[photo.sizes.length - 1];
              mediaFiles.push({
                file: blobToFile(blob, fileName),
                quick: largestSize ? { width: largestSize.width, height: largestSize.height } : undefined,
              });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to download photo for template:', e);
      }
    }
  }

  // Download video (skip GIFs - they're sent directly via sendMessage({ gif }))
  if (video && !video.isGif) {
    const mediaHash = getVideoMediaHash(video, 'download');
    if (mediaHash) {
      try {
        const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const fileName = video.fileName || `video_${video.id}.mp4`;
              mediaFiles.push({
                file: blobToFile(blob, fileName),
                quick: { width: video.width, height: video.height },
              });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to download video for template:', e);
      }
    }
  }

  // Download document (no quick metadata - sent as file)
  if (document) {
    const mediaHash = getDocumentMediaHash(document, 'download');
    if (mediaHash) {
      try {
        const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const fileName = document.fileName || `document_${document.id}`;
              mediaFiles.push({ file: blobToFile(blob, fileName) });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to download document for template:', e);
      }
    }
  }

  // Download audio (no quick metadata - sent as file)
  if (audio) {
    const mediaHash = getAudioMediaHash(audio, 'download');
    if (mediaHash) {
      try {
        const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const fileName = audio.fileName || `audio_${audio.id}.mp3`;
              mediaFiles.push({ file: blobToFile(blob, fileName) });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to download audio for template:', e);
      }
    }
  }

  // Download voice message (no quick metadata - sent as file)
  const voice = getMessageVoice(message);
  if (voice) {
    const mediaHash = getVoiceMediaHash(voice, 'download');
    if (mediaHash) {
      try {
        const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const fileName = `voice_${voice.id}.ogg`;
              mediaFiles.push({ file: blobToFile(blob, fileName) });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to download voice for template:', e);
      }
    }
  }

  return mediaFiles;
}

/**
 * Prepares a message to be used as a template.
 * Returns text immediately, downloads media in background.
 */
export async function prepareMessageAsTemplate(message: ApiMessage): Promise<TemplateContent> {
  const text = extractMessageText(message);
  const mediaFiles = await downloadMessageMedia(message);

  return {
    text,
    files: mediaFiles.map((m) => m.file),
    mediaFiles,
  };
}

/**
 * Checks if a message has downloadable media for template
 * Note: Stickers and GIFs are sent directly, not downloaded
 */
export function hasDownloadableMedia(message: ApiMessage): boolean {
  const video = getMessageVideo(message);
  const hasNonGifVideo = video && !video.isGif;

  return Boolean(
    getMessagePhoto(message)
    || hasNonGifVideo
    || getMessageDocument(message)
    || getMessageAudio(message)
    || getMessageVoice(message),
  );
}

/**
 * Checks if a message can be used in bulk send.
 * More restrictive than canUseMessageAsTemplate - only supports text and downloadable media.
 * Excludes: stickers, GIFs, polls, todos, contacts (which require special handling)
 */
export function canUseMessageForBulkSend(message: ApiMessage): boolean {
  const { content } = message;

  // Exclude unsupported content types (same as canUseMessageAsTemplate)
  if (
    content.location
    || content.game
    || content.giveaway
    || content.giveawayResults
    || content.action
  ) {
    return false;
  }

  // Exclude special types that require special handling for now
  if (
    content.sticker
    || content.pollId
    || content.todo
    || content.contact
  ) {
    return false;
  }

  // Exclude GIFs (videos with isGif flag)
  const video = getMessageVideo(message);
  if (video?.isGif) {
    return false;
  }

  // Must have either text or downloadable media
  const hasText = Boolean(content.text?.text);
  const hasMedia = hasDownloadableMedia(message);

  return hasText || hasMedia;
}

/**
 * Extracts contact from a message
 */
export function getMessageContact(message: ApiMessage): ApiContact | undefined {
  return message.content.contact;
}

/**
 * Extracts poll ID from a message
 */
export function getMessagePollId(message: ApiMessage): string | undefined {
  return message.content.pollId;
}

/**
 * Extracts sticker from a message
 */
export function getTemplateSticker(message: ApiMessage): ApiSticker | undefined {
  return message.content.sticker;
}

/**
 * Extracts GIF video from a message
 */
export function getMessageGif(message: ApiMessage): ApiVideo | undefined {
  const video = getMessageVideo(message);
  return video?.isGif ? video : undefined;
}

/**
 * Extracts todo from a message
 */
export function getTemplateTodo(message: ApiMessage): ApiMediaTodo | undefined {
  return getMessageTodo(message);
}

/**
 * Converts an existing ApiMediaTodo to ApiNewMediaTodo format for sending
 */
export function convertTodoToNewTodo(todo: ApiMediaTodo): ApiNewMediaTodo {
  return {
    todo: todo.todo,
  };
}

/**
 * Converts an existing ApiPoll to ApiNewPoll format for sending
 */
export function convertPollToNewPoll(poll: ApiPoll): ApiNewPoll {
  const { summary, results } = poll;

  // Map old option IDs to new sequential indices for answers
  const oldToNewOptionMap = new Map<string, string>();
  const newAnswers = summary.answers.map((answer, index) => {
    const newOption = String(index);
    oldToNewOptionMap.set(answer.option, newOption);
    return {
      text: answer.text,
      option: newOption,
    };
  });

  // Build quiz data if this is a quiz - map correct answers to new option IDs
  const quiz = summary.quiz ? {
    correctAnswers: results.results
      ?.filter((r) => r.isCorrect)
      .map((r) => oldToNewOptionMap.get(r.option))
      .filter((opt): opt is string => opt !== undefined) || [],
    solution: results.solution,
    solutionEntities: results.solutionEntities,
  } : undefined;

  return {
    summary: {
      question: summary.question,
      answers: newAnswers,
      isPublic: summary.isPublic,
      multipleChoice: summary.multipleChoice,
      quiz: summary.quiz,
      // Don't copy closePeriod/closeDate as they're relative to original poll
    },
    quiz,
  };
}
