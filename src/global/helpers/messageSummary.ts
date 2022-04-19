import { ApiMessage, ApiMessageEntityTypes } from '../../api/types';
import { CONTENT_NOT_SUPPORTED } from '../../config';

import { TextPart } from '../../types';
import { LangFn } from '../../hooks/useLang';

import trimText from '../../util/trimText';
import { getMessageText } from './messages';
import { getMessageRecentReaction } from './reactions';

const SPOILER_CHARS = ['⠺', '⠵', '⠞', '⠟'];
export const TRUNCATED_SUMMARY_LENGTH = 80;

export function getMessageSummaryText(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  noReactions = true,
  isExtended = false,
) {
  const emoji = !noEmoji && getMessageSummaryEmoji(message, noReactions);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = trimText(getMessageTextWithSpoilers(message), truncateLength);
  const description = getMessageSummaryDescription(lang, message, text, noReactions, isExtended);

  return `${emojiWithSpace}${description}`;
}

export function getMessageTextWithSpoilers(message: ApiMessage) {
  const text = getMessageText(message);
  if (!text) {
    return undefined;
  }

  const { entities } = message.content.text || {};
  if (!entities?.length) {
    return text;
  }

  return entities.reduce((accText, {
    type,
    offset,
    length,
  }) => {
    if (type !== ApiMessageEntityTypes.Spoiler) {
      return accText;
    }

    const spoiler = generateBrailleSpoiler(length);

    return `${accText.substr(0, offset)}${spoiler}${accText.substr(offset + length, accText.length)}`;
  }, text);
}

export function getMessageSummaryEmoji(message: ApiMessage, noReactions = true) {
  const {
    photo,
    video,
    audio,
    voice,
    document,
    sticker,
    poll,
  } = message.content;

  if (message.groupedId || photo) {
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

  if (poll) {
    return '📊';
  }

  const reaction = !noReactions && getMessageRecentReaction(message);
  if (reaction) {
    return reaction.reaction;
  }

  return undefined;
}

export function getMessageSummaryDescription(
  lang: LangFn,
  message: ApiMessage,
  truncatedText?: string | TextPart[],
  noReactions = true,
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
    poll,
    invoice,
    location,
    game,
  } = message.content;

  let summary: string | TextPart[] | undefined;

  if (message.groupedId) {
    summary = truncatedText || lang('lng_in_dlg_album');
  }

  if (photo) {
    summary = truncatedText || lang('AttachPhoto');
  }

  if (video) {
    summary = truncatedText || lang(video.isGif ? 'AttachGif' : 'AttachVideo');
  }

  if (sticker) {
    summary = lang('AttachSticker').trim();
  }

  if (audio) {
    summary = getMessageAudioCaption(message) || lang('AttachMusic');
  }

  if (voice) {
    summary = truncatedText || lang('AttachAudio');
  }

  if (document) {
    summary = isExtended ? document.fileName : (truncatedText || document.fileName);
  }

  if (contact) {
    summary = lang('AttachContact');
  }

  if (poll) {
    summary = poll.summary.question;
  }

  if (invoice) {
    summary = `${lang('PaymentInvoice')}: ${invoice.text}`;
  }

  if (text) {
    if (isExtended && summary) {
      summary += `\n${truncatedText}`;
    } else {
      summary = truncatedText;
    }
  }

  if (location?.type === 'geo' || location?.type === 'venue') {
    summary = lang('Message.Location');
  }

  if (location?.type === 'geoLive') {
    summary = lang('Message.LiveLocation');
  }

  if (game) {
    summary = `🎮 ${game.title}`;
  }

  const reaction = !noReactions && getMessageRecentReaction(message);
  if (summary && reaction) {
    summary = `to your "${summary}"`;
  }

  return summary || CONTENT_NOT_SUPPORTED;
}

export function generateBrailleSpoiler(length: number) {
  return new Array(length)
    .fill(undefined)
    .map(() => SPOILER_CHARS[Math.floor(Math.random() * SPOILER_CHARS.length)])
    .join('');
}

function getMessageAudioCaption(message: ApiMessage) {
  const {
    audio,
    text,
  } = message.content;

  return (audio && [audio.title, audio.performer].filter(Boolean)
    .join(' — ')) || (text?.text);
}
