import type {
  ApiChat, ApiMessage, ApiMessageEntityTextUrl, ApiReactions, ApiUser,
} from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';
import type { LangFn } from '../../hooks/useLang';

import {
  CONTENT_NOT_SUPPORTED,
  LOCAL_MESSAGE_MIN_ID,
  RE_LINK_TEMPLATE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { getUserFullName } from './users';
import { IS_OPUS_SUPPORTED, isWebpSupported } from '../../util/environment';
import { getChatTitle, isUserId } from './chats';
import parseEmojiOnlyString from '../../components/common/helpers/parseEmojiOnlyString';
import { getGlobal } from '../index';

const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

export type MessageKey = `msg${string}-${number}`;

export function getMessageHtmlId(messageId: number) {
  return `message${messageId.toString().replace('.', '-')}`;
}

export function getMessageKey(message: ApiMessage): MessageKey {
  const { chatId, id, previousLocalId } = message;

  return buildMessageKey(chatId, isServiceNotificationMessage(message) ? previousLocalId || id : id);
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

export function getMessageTranscription(message: ApiMessage) {
  const { transcriptionId } = message;
  const global = getGlobal();

  return transcriptionId && global.transcriptions[transcriptionId]?.text;
}

export function getMessageText(message: ApiMessage) {
  const {
    text, sticker, photo, video, audio, voice, document, poll, webPage, contact, invoice, location,
    game, action,
  } = message.content;

  if (text) {
    return text.text;
  }

  if (sticker || photo || video || audio || voice || document
    || contact || poll || webPage || invoice || location || game || action?.phoneCall) {
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

  if (!text || text.entities?.length || photo || video || audio || voice || document || poll || webPage || contact) {
    return false;
  }

  // This is a "dual-intent" method used to limit calls of `parseEmojiOnlyString`.
  return parseEmojiOnlyString(text.text) || false;
}

export function getMessageSingleEmoji(message: ApiMessage) {
  const { text } = message.content;
  if (!(text && text.text.length <= 6) || text.entities?.length) {
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
    const firstTextUrl = text.entities.find((entity): entity is ApiMessageEntityTextUrl => (
      entity.type === ApiMessageEntityTypes.TextUrl
    ));
    if (firstTextUrl) {
      match = firstTextUrl.url.match(RE_LINK);
    }

    if (!match) {
      const firstUrl = text.entities.find((entity) => entity.type === ApiMessageEntityTypes.Url);
      if (firstUrl) {
        const { offset, length } = firstUrl;
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
  return Boolean(message.content.action);
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
  return message.id > LOCAL_MESSAGE_MIN_ID;
}

export function isHistoryClearMessage(message: ApiMessage) {
  return message.content.action && message.content.action.type === 'historyClear';
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
    const extension = content.sticker.isLottie ? 'tgs' : content.sticker.isVideo
      ? 'webm' : isWebpSupported() ? 'webp' : 'png';
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

export function isGeoLiveExpired(message: ApiMessage, timestamp = Date.now() / 1000) {
  const { location } = message.content;
  if (location?.type !== 'geoLive') return false;
  return (timestamp - (message.date || 0) >= location.period);
}

export function getMessageSingleInlineButton(message: ApiMessage) {
  return message.inlineButtons?.length === 1
    && message.inlineButtons[0].length === 1
    && message.inlineButtons[0][0];
}
