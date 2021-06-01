import {
  ApiChat, ApiMessage, ApiMessageEntityTypes, ApiUser,
} from '../../api/types';
import { LangFn } from '../../hooks/useLang';

import { LOCAL_MESSAGE_ID_BASE, SERVICE_NOTIFICATIONS_USER_ID, RE_LINK_TEMPLATE } from '../../config';
import parseEmojiOnlyString from '../../components/common/helpers/parseEmojiOnlyString';
import { getUserFullName } from './users';
import { getChatTitle } from './chats';

const CONTENT_NOT_SUPPORTED = 'The message is not supported on this version of Telegram';
const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

export function getMessageKey(message: ApiMessage) {
  const { chatId, id } = message;

  return `msg${chatId}-${id}`;
}

export function parseMessageKey(key: string) {
  const match = key.match(/^msg(-?\d+)-(\d+)/)!;

  return { chatId: Number(match[1]), messageId: Number(match[2]) };
}

export function getMessageOriginalId(message: ApiMessage) {
  return message.previousLocalId || message.id;
}

export function getMessageSummaryText(lang: LangFn, message: ApiMessage, noEmoji = false) {
  const {
    text, photo, video, audio, voice, document, sticker, contact, poll, invoice,
  } = message.content;

  if (message.groupedId) {
    return `${noEmoji ? '' : '🖼 '}${text ? text.text : lang('lng_in_dlg_album')}`;
  }

  if (photo) {
    return `${noEmoji ? '' : '🖼 '}${text ? text.text : lang('AttachPhoto')}`;
  }

  if (video) {
    return `${noEmoji ? '' : '📹 '}${text ? text.text : lang(video.isGif ? 'AttachGif' : 'AttachVideo')}`;
  }

  if (sticker) {
    return `${sticker.emoji} ${lang('AttachSticker')} `;
  }

  if (audio) {
    const caption = [audio.title, audio.performer].filter(Boolean).join(' — ') || (text && text.text);
    return `${noEmoji ? '' : '🎧 '}${caption || lang('AttachMusic')}`;
  }

  if (voice) {
    return `${noEmoji ? '' : '🎤 '}${text ? text.text : lang('AttachAudio')}`;
  }

  if (document) {
    return `${noEmoji ? '' : '📎 '}${text ? text.text : document.fileName}`;
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
    return text.text;
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

  if (sticker || (video && video.isRound)) {
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
  if (text && text.entities) {
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
  return message.chatId === SERVICE_NOTIFICATIONS_USER_ID && isMessageLocal(message);
}

export function isAnonymousOwnMessage(message: ApiMessage) {
  return Boolean(message.senderId) && message.senderId! < 0 && isOwnMessage(message);
}

export function getSenderTitle(lang: LangFn, sender: ApiUser | ApiChat) {
  return sender.id > 0 ? getUserFullName(sender as ApiUser) : getChatTitle(lang, sender as ApiChat);
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
