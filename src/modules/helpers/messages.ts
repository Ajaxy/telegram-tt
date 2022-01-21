import {
  ApiChat, ApiMessage, ApiMessageEntityTypes, ApiReactions, ApiUser,
} from '../../api/types';
import { LangFn } from '../../hooks/useLang';

import {
  LOCAL_MESSAGE_ID_BASE,
  SERVICE_NOTIFICATIONS_USER_ID,
  RE_LINK_TEMPLATE,
  CONTENT_NOT_SUPPORTED,
} from '../../config';
import { getUserFullName } from './users';
import { isWebpSupported, IS_OPUS_SUPPORTED } from '../../util/environment';
import { getChatTitle, isUserId } from './chats';
import parseEmojiOnlyString from '../../components/common/helpers/parseEmojiOnlyString';

const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');
const TRUNCATED_SUMMARY_LENGTH = 80;

export type MessageKey = `msg${string}-${number}`;

export function getMessageKey(message: ApiMessage): MessageKey {
  const { chatId, id } = message;

  return buildMessageKey(chatId, id);
}

export function buildMessageKey(chatId: string, msgId: number): MessageKey {
  return `msg${chatId}-${msgId}`;
}

export function parseMessageKey(key: MessageKey) {
  const match = key.match(/^msg(-?\d+)-(\d+)/)!;

  return { chatId: match[1], messageId: Number(match[2]) };
}

export function getMessageOriginalId(message: ApiMessage) {
  return message.previousLocalId || message.id;
}

export function getMessageSummaryText(lang: LangFn, message: ApiMessage, noEmoji = false) {
  const {
    text, photo, video, audio, voice, document, sticker, contact, poll, invoice,
  } = message.content;

  const truncatedText = text && text.text.substr(0, TRUNCATED_SUMMARY_LENGTH);

  if (message.groupedId) {
    return `${noEmoji ? '' : '🖼 '}${truncatedText || lang('lng_in_dlg_album')}`;
  }

  if (photo) {
    return `${noEmoji ? '' : '🖼 '}${truncatedText || lang('AttachPhoto')}`;
  }

  if (video) {
    return `${noEmoji ? '' : '📹 '}${truncatedText || lang(video.isGif ? 'AttachGif' : 'AttachVideo')}`;
  }

  if (sticker) {
    return `${sticker.emoji || ''} ${lang('AttachSticker')}`.trim();
  }

  if (audio) {
    return `${noEmoji ? '' : '🎧 '}${getMessageAudioCaption(message) || lang('AttachMusic')}`;
  }

  if (voice) {
    return `${noEmoji ? '' : '🎤 '}${truncatedText || lang('AttachAudio')}`;
  }

  if (document) {
    return `${noEmoji ? '' : '📎 '}${truncatedText || document.fileName}`;
  }

  if (contact) {
    return lang('AttachContact');
  }

  if (poll) {
    return `${noEmoji ? '' : '📊 '}${poll.summary.question}`;
  }

  if (invoice) {
    return 'Invoice';
  }

  if (text) {
    return truncatedText;
  }

  return CONTENT_NOT_SUPPORTED;
}

export function getMessageText(message: ApiMessage) {
  const {
    text, sticker, photo, video, audio, voice, document, poll, webPage, contact, invoice,
  } = message.content;

  if (text) {
    return text.text;
  }

  if (sticker || photo || video || audio || voice || document || contact || poll || webPage || invoice) {
    return undefined;
  }

  return CONTENT_NOT_SUPPORTED;
}

export function getMessageCustomShape(message: ApiMessage): boolean | number {
  const {
    text, sticker, photo, video, audio, voice, document, poll, webPage, contact,
  } = message.content;

  if (sticker || (video?.isRound)) {
    return true;
  }

  if (!text || photo || video || audio || voice || document || poll || webPage || contact) {
    return false;
  }

  // This is a "dual-intent" method used to limit calls of `parseEmojiOnlyString`.
  return parseEmojiOnlyString(text.text) || false;
}

export function getMessageSingleEmoji(message: ApiMessage) {
  const { text } = message.content;
  if (!(text && text.text.length <= 6)) {
    return undefined;
  }

  if (getMessageCustomShape(message) !== 1) {
    return undefined;
  }

  return text.text;
}

export function getFirstLinkInMessage(message: ApiMessage) {
  const { text } = message.content;

  let match: RegExpMatchArray | null | undefined;
  if (text?.entities) {
    let link = text.entities.find((entity) => entity.type === ApiMessageEntityTypes.TextUrl);
    if (link) {
      match = link.url!.match(RE_LINK);
    }

    if (!match) {
      link = text.entities.find((entity) => entity.type === ApiMessageEntityTypes.Url);
      if (link) {
        const { offset, length } = link;
        match = text.text.substring(offset, offset + length).match(RE_LINK);
      }
    }
  }

  if (!match && text) {
    match = text.text.match(RE_LINK);
  }

  if (!match) {
    return undefined;
  }

  return {
    url: match[0],
    domain: match[3],
  };
}

export function matchLinkInMessageText(message: ApiMessage) {
  const { text } = message.content;
  const match = text && text.text.match(RE_LINK);

  if (!match) {
    return undefined;
  }

  return {
    url: match[0],
    domain: match[3],
  };
}

export function isOwnMessage(message: ApiMessage) {
  return message.isOutgoing;
}

export function isReplyMessage(message: ApiMessage) {
  return Boolean(message.replyToMessageId);
}

export function isForwardedMessage(message: ApiMessage) {
  return Boolean(message.forwardInfo);
}

export function isActionMessage(message: ApiMessage) {
  return !!message.content.action;
}

export function isServiceNotificationMessage(message: ApiMessage) {
  return message.chatId === SERVICE_NOTIFICATIONS_USER_ID && Math.round(message.id) !== message.id;
}

export function isAnonymousOwnMessage(message: ApiMessage) {
  return Boolean(message.senderId) && !isUserId(message.senderId!) && isOwnMessage(message);
}

export function getSenderTitle(lang: LangFn, sender: ApiUser | ApiChat) {
  return isUserId(sender.id) ? getUserFullName(sender as ApiUser) : getChatTitle(lang, sender as ApiChat);
}

export function getSendingState(message: ApiMessage) {
  if (!message.sendingState) {
    return 'succeeded';
  }

  return message.sendingState === 'messageSendingStateFailed' ? 'failed' : 'pending';
}

export function isMessageLocal(message: ApiMessage) {
  return message.id >= LOCAL_MESSAGE_ID_BASE;
}

export function isHistoryClearMessage(message: ApiMessage) {
  return message.content.action && message.content.action.type === 'historyClear';
}

export function getMessageAudioCaption(message: ApiMessage) {
  const { audio, text } = message.content;

  return (audio && [audio.title, audio.performer].filter(Boolean).join(' — ')) || (text?.text);
}

export function getMessageContentFilename(message: ApiMessage) {
  const { content } = message;

  const video = content.webPage ? content.webPage.video : content.video;
  const photo = content.webPage ? content.webPage.photo : content.photo;
  const document = content.webPage ? content.webPage.document : content.document;
  if (document) {
    return document.fileName;
  }

  if (video) {
    return video.fileName;
  }

  if (content.sticker) {
    const extension = content.sticker.isAnimated ? 'tgs' : isWebpSupported() ? 'webp' : 'png';
    return `${content.sticker.id}.${extension}`;
  }

  if (content.audio) {
    return content.audio.fileName;
  }

  const baseFilename = getMessageKey(message);

  if (photo) {
    return `${baseFilename}.jpg`;
  }

  if (content.voice) {
    return IS_OPUS_SUPPORTED ? `${baseFilename}.ogg` : `${baseFilename}.wav`;
  }

  return baseFilename;
}

export function areReactionsEmpty(reactions: ApiReactions) {
  return !reactions.results.some((l) => l.count > 0);
}
