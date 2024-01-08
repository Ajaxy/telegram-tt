import type { TeactNode } from '../../lib/teact/teact';

import type { ApiMessage } from '../../api/types';
import type { LangFn } from '../../hooks/useLang';
import { ApiMessageEntityTypes } from '../../api/types';

import { CONTENT_NOT_SUPPORTED } from '../../config';
import trimText from '../../util/trimText';
import { getGlobal } from '../index';
import { getMessageText, getMessageTranscription } from './messages';
import { getUserFirstOrLastName } from './users';

const SPOILER_CHARS = ['⠺', '⠵', '⠞', '⠟'];
export const TRUNCATED_SUMMARY_LENGTH = 80;

export function getMessageSummaryText(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  isExtended = false,
) {
  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = trimText(getMessageTextWithSpoilers(message), truncateLength);
  const description = getMessageSummaryDescription(lang, message, text, isExtended);

  return `${emojiWithSpace}${description}`;
}

export function getMessageTextWithSpoilers(message: ApiMessage) {
  const transcription = getMessageTranscription(message);

  const textWithoutTranscription = getMessageText(message);
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

    return `${accText.substr(0, offset)}${spoiler}${accText.substr(offset + length, accText.length)}`;
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

  return undefined;
}

export function getMessageSummaryDescription(
  lang: LangFn,
  message: ApiMessage,
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
    poll,
    invoice,
    location,
    game,
    storyData,
    giveaway,
    giveawayResults,
  } = message.content;

  let hasUsedTruncatedText = false;
  let summary: string | TeactNode | undefined;

  if (message.groupedId) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang('lng_in_dlg_album');
  }

  if (photo) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang('AttachPhoto');
  }

  if (video) {
    hasUsedTruncatedText = true;
    summary = truncatedText || lang(video.isGif ? 'AttachGif' : 'AttachVideo');
  }

  if (sticker) {
    summary = lang('AttachSticker').trim();
  }

  if (audio) {
    summary = getMessageAudioCaption(message) || lang('AttachMusic');
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
    summary = poll.summary.question;
  }

  if (invoice) {
    summary = invoice.extendedMedia ? invoice.title : `${lang('PaymentInvoice')}: ${invoice.text}`;
  }

  if (text) {
    if (isExtended && summary && !hasUsedTruncatedText) {
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

  if (giveaway) {
    summary = lang('BoostingGiveawayChannelStarted');
  }

  if (giveawayResults) {
    summary = lang('Message.GiveawayEndedWinners', giveawayResults.winnersCount);
  }

  if (storyData) {
    if (storyData.isMention) {
      // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
      const global = getGlobal();
      const firstName = getUserFirstOrLastName(global.users.byId[message.chatId]);
      summary = message.isOutgoing
        ? lang('Chat.Service.StoryMentioned.You', firstName)
        : lang('Chat.Service.StoryMentioned', firstName);
    } else {
      summary = lang('ForwardedStory');
    }
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
