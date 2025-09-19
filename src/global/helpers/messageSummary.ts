import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiMediaExtendedPreview, ApiMessage, MediaContent, StatefulMediaContent,
} from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

import { type LangFn } from '../../util/localization';
import trimText from '../../util/trimText';
import { renderTextWithEntities } from '../../components/common/helpers/renderTextWithEntities';
import {
  getMessageTextWithFallback, getMessageTranscription,
} from './messages';

const SPOILER_CHARS = ['⠺', '⠵', '⠞', '⠟'];
export const TRUNCATED_SUMMARY_LENGTH = 80;

export function getMessageSummaryText(
  lang: LangFn,
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
  noEmoji = false,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  isExtended = false,
) {
  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = trimText(getMessageTextWithSpoilers(lang, message, statefulContent), truncateLength);
  const description = getMessageSummaryDescription(lang, message, statefulContent, text, isExtended) as string;

  return `${emojiWithSpace}${description}`;
}

export function getMessageTextWithSpoilers(
  lang: LangFn,
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
) {
  const transcription = getMessageTranscription(message);

  const textWithoutTranscription = getMessageTextWithFallback(lang, statefulContent?.story || message)?.text;
  if (!textWithoutTranscription) {
    return transcription;
  }

  const { entities } = message.content.text || {};
  if (!entities?.length) {
    return transcription ? `${transcription}\n${textWithoutTranscription}` : textWithoutTranscription;
  }

  const text = entities.reduce((accText, {
    type,
    offset,
    length,
  }) => {
    if (type !== ApiMessageEntityTypes.Spoiler) {
      return accText;
    }

    const spoiler = generateBrailleSpoiler(length);

    return `${accText.slice(0, offset)}${spoiler}${accText.slice(offset + length)}`;
  }, textWithoutTranscription);

  return transcription ? `${transcription}\n${text}` : text;
}

export function getMessageSummaryEmoji(message: ApiMessage) {
  const {
    photo,
    video,
    audio,
    voice,
    document,
    sticker,
    pollId,
    paidMedia,
    todo,
  } = message.content;

  if (message.groupedId || photo || paidMedia) {
    return '🖼';
  }

  if (video) {
    return '📹';
  }

  if (sticker) {
    return sticker.emoji;
  }

  if (audio) {
    return '🎧';
  }

  if (voice) {
    return '🎤';
  }

  if (document) {
    return '📎';
  }

  if (pollId) {
    return '📊';
  }

  if (todo) {
    return '📝';
  }

  return undefined;
}

export function getMediaContentTypeDescription(
  lang: LangFn, content: MediaContent, statefulContent: StatefulMediaContent | undefined,
) {
  return getSummaryDescription(lang, content, statefulContent);
}
export function getMessageSummaryDescription(
  lang: LangFn,
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
  truncatedText?: string | TeactNode,
  isExtended = false,
) {
  return getSummaryDescription(lang, message.content, statefulContent, message, truncatedText, isExtended);
}
function getSummaryDescription(
  lang: LangFn,
  mediaContent: MediaContent,
  statefulContent: StatefulMediaContent | undefined,
  message?: ApiMessage,
  truncatedText?: string | TeactNode,
  isExtended = false,
) {
  const {
    text,
    photo,
    video,
    audio,
    voice,
    document,
    sticker,
    contact,
    invoice,
    location,
    game,
    storyData,
    giveaway,
    giveawayResults,
    paidMedia,
    todo,
  } = mediaContent;
  const { poll } = statefulContent || {};

  let hasUsedTruncatedText = false;
  let summary: TeactNode | undefined;

  const boughtExtendedMedia = paidMedia?.isBought && paidMedia.extendedMedia;
  const previewExtendedMedia = paidMedia && !paidMedia.isBought
    ? paidMedia.extendedMedia as ApiMediaExtendedPreview[] : undefined;

  const isPaidMediaAlbum = paidMedia && paidMedia.extendedMedia.length > 1;
  const isPaidMediaSingleVideo = !isPaidMediaAlbum
    && (boughtExtendedMedia?.[0].video || previewExtendedMedia?.[0].duration);
  const isPaidMediaSinglePhoto = !isPaidMediaAlbum && !isPaidMediaSingleVideo;

  if (message?.groupedId || isPaidMediaAlbum) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang('Album');
  }

  if (photo || isPaidMediaSinglePhoto) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang('AttachPhoto');
  }

  if (video || isPaidMediaSingleVideo) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang(video?.isGif ? 'AttachGif' : 'AttachVideo');
  }

  if (sticker) {
    summary = lang('AttachSticker').trim();
  }

  if (audio) {
    summary = getMessageAudioCaption(mediaContent) || lang('AttachMusic');
  }

  if (voice) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang('AttachAudio');
  }

  if (document) {
    hasUsedTruncatedText = !isExtended;
    summary = isExtended ? document.fileName : (truncatedText || document.fileName);
  }

  if (contact) {
    summary = lang('AttachContact');
  }

  if (poll) {
    summary = renderTextWithEntities({
      text: poll.summary.question.text,
      entities: poll.summary.question.entities,
      asPreview: true,
    });
  }

  if (invoice) {
    summary = invoice.extendedMedia ? invoice.title : lang('AttachInvoice', { description: invoice.description });
  }

  if (text) {
    if (isExtended && summary && !hasUsedTruncatedText) {
      (summary as string) += `\n${truncatedText as string}`;
    } else {
      summary = truncatedText as string;
    }
  }

  if (location?.mediaType === 'geo' || location?.mediaType === 'venue') {
    summary = lang('AttachLocation');
  }

  if (location?.mediaType === 'geoLive') {
    summary = lang('AttachLiveLocation');
  }

  if (game) {
    summary = `🎮 ${game.title}`;
  }

  if (giveaway) {
    summary = lang('AttachGiveaway');
  }

  if (giveawayResults) {
    summary = lang('AttachGiveawayResults');
  }

  if (storyData) {
    summary = truncatedText || lang('AttachStory');
  }

  if (todo) {
    summary = renderTextWithEntities({
      text: todo.todo.title.text,
      entities: todo.todo.title.entities,
      asPreview: true,
    });
  }

  return summary || lang('MessageUnsupported');
}

export function generateBrailleSpoiler(length: number) {
  return new Array(length)
    .fill(undefined)
    .map(() => SPOILER_CHARS[Math.floor(Math.random() * SPOILER_CHARS.length)])
    .join('');
}

function getMessageAudioCaption(mediaContent: MediaContent) {
  const {
    audio,
    text,
  } = mediaContent;

  return (audio && [audio.title, audio.performer].filter(Boolean)
    .join(' — ')) || (text?.text);
}
