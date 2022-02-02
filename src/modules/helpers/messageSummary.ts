import type { TextPart } from '../../components/common/helpers/renderTextWithEntities';

import { LangFn } from '../../hooks/useLang';
import { ApiMessage, ApiMessageEntityTypes } from '../../api/types';
import { CONTENT_NOT_SUPPORTED } from '../../config';
import { getMessageText } from './messages';
import trimText from '../../util/trimText';

const SPOILER_CHARS = ['⠺', '⠵', '⠞', '⠟'];
export const TRUNCATED_SUMMARY_LENGTH = 80;

export function getMessageSummaryText(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
) {
  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = trimText(getMessageTextWithSpoilers(message), truncateLength);
  const description = getMessageSummaryDescription(lang, message, text);

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

  return entities.reduce((accText, { type, offset, length }) => {
    if (type !== ApiMessageEntityTypes.Spoiler) {
      return accText;
    }

    const spoiler = generateBrailleSpoiler(length);


    return `${accText.substr(0, offset)}${spoiler}${accText.substr(offset + length, accText.length)}`;
  }, text);
}

export function getMessageSummaryEmoji(message: ApiMessage) {
  const {
    photo, video, audio, voice, document, sticker, poll,
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

  return undefined;
}

export function getMessageSummaryDescription(lang: LangFn, message: ApiMessage, truncatedText?: string | TextPart[]) {
  const {
    text, photo, video, audio, voice, document, sticker, contact, poll, invoice,
  } = message.content;

  if (message.groupedId) {
    return truncatedText || lang('lng_in_dlg_album');
  }

  if (photo) {
    return truncatedText || lang('AttachPhoto');
  }

  if (video) {
    return truncatedText || lang(video.isGif ? 'AttachGif' : 'AttachVideo');
  }

  if (sticker) {
    return lang('AttachSticker').trim();
  }

  if (audio) {
    return getMessageAudioCaption(message) || lang('AttachMusic');
  }

  if (voice) {
    return truncatedText || lang('AttachAudio');
  }

  if (document) {
    return truncatedText || document.fileName;
  }

  if (contact) {
    return lang('AttachContact');
  }

  if (poll) {
    return poll.summary.question;
  }

  if (invoice) {
    return 'Invoice';
  }

  if (text) {
    return truncatedText;
  }

  return CONTENT_NOT_SUPPORTED;
}

export function generateBrailleSpoiler(length: number) {
  return new Array(length)
    .fill(undefined)
    .map(() => SPOILER_CHARS[Math.floor(Math.random() * SPOILER_CHARS.length)])
    .join('');
}

function getMessageAudioCaption(message: ApiMessage) {
  const { audio, text } = message.content;

  return (audio && [audio.title, audio.performer].filter(Boolean).join(' — ')) || (text?.text);
}
