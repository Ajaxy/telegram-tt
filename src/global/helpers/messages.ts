import type {
  ApiChat, ApiMessage, ApiMessageEntityTextUrl, ApiPeer, ApiStory, ApiUser,
} from '../../api/types';
import type { LangFn } from '../../hooks/useLang';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import {
  CONTENT_NOT_SUPPORTED,
  RE_LINK_TEMPLATE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { areSortedArraysIntersecting, unique } from '../../util/iteratees';
import { getServerTime } from '../../util/serverTime';
import { IS_OPUS_SUPPORTED } from '../../util/windowEnvironment';
import { getGlobal } from '../index';
import { getChatTitle, isUserId } from './chats';
import { getUserFullName } from './users';

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
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  const global = getGlobal();

  return transcriptionId && global.transcriptions[transcriptionId]?.text;
}

export function hasMessageText(message: ApiMessage | ApiStory) {
  const {
    text, sticker, photo, video, audio, voice, document, poll, webPage, contact, invoice, location,
    game, action, storyData,
  } = message.content;

  return Boolean(text) || !(
    sticker || photo || video || audio || voice || document || contact || poll || webPage || invoice || location
    || game || action?.phoneCall || storyData
  );
}

export function getMessageText(message: ApiMessage | ApiStory) {
  return hasMessageText(message) ? message.content.text?.text || CONTENT_NOT_SUPPORTED : undefined;
}

export function getMessageCustomShape(message: ApiMessage): boolean {
  const {
    text, sticker, photo, video, audio, voice,
    document, poll, webPage, contact, action,
    game, invoice, location, storyData,
  } = message.content;

  if (sticker || (video?.isRound)) {
    return true;
  }

  if (!text || photo || video || audio || voice || document || poll || webPage || contact || action || game || invoice
    || location || storyData) {
    return false;
  }

  const hasOtherFormatting = text?.entities?.some((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji);

  return Boolean(message.emojiOnlyCount && !hasOtherFormatting);
}

export function getMessageSingleRegularEmoji(message: ApiMessage) {
  const { text } = message.content;

  if (text?.entities?.length || message.emojiOnlyCount !== 1) {
    return undefined;
  }

  return text!.text;
}

export function getMessageSingleCustomEmoji(message: ApiMessage): string | undefined {
  const { text } = message.content;

  if (text?.entities?.length !== 1
    || text.entities[0].type !== ApiMessageEntityTypes.CustomEmoji
    || message.emojiOnlyCount !== 1) {
    return undefined;
  }

  return text.entities[0].documentId;
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

export function isMainThread(threadId: number) {
  return threadId === MAIN_THREAD_ID;
}

export function isOwnMessage(message: ApiMessage) {
  return message.isOutgoing;
}

export function isReplyMessage(message: ApiMessage) {
  return Boolean(message.replyToMessageId);
}

export function isReplyToUserThreadMessage(message: ApiMessage) {
  return isReplyMessage(message) && !isMainThread(message.replyToMessageId!);
}

export function isForwardedMessage(message: ApiMessage) {
  return Boolean(message.forwardInfo || message.content.storyData);
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

export function getSenderTitle(lang: LangFn, sender: ApiPeer) {
  return isUserId(sender.id) ? getUserFullName(sender as ApiUser) : getChatTitle(lang, sender as ApiChat);
}

export function getSendingState(message: ApiMessage) {
  if (!message.sendingState) {
    return 'succeeded';
  }

  return message.sendingState === 'messageSendingStateFailed' ? 'failed' : 'pending';
}

export function isMessageLocal(message: ApiMessage) {
  return isLocalMessageId(message.id);
}

export function isMessageFailed(message: ApiMessage) {
  return message.sendingState === 'messageSendingStateFailed';
}

export function isLocalMessageId(id: number) {
  return !Number.isInteger(id);
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
    const extension = content.sticker.isLottie ? 'tgs' : content.sticker.isVideo ? 'webm' : 'webp';
    return `${content.sticker.id}.${extension}`;
  }

  if (content.audio) {
    return content.audio.fileName;
  }

  const baseFilename = `${getMessageKey(message)}${message.isScheduled ? '_scheduled' : ''}`;

  if (photo) {
    return `${baseFilename}.jpg`;
  }

  if (content.voice) {
    return IS_OPUS_SUPPORTED ? `${baseFilename}.ogg` : `${baseFilename}.wav`;
  }

  return baseFilename;
}

export function isGeoLiveExpired(message: ApiMessage) {
  const { location } = message.content;
  if (location?.type !== 'geoLive') return false;
  return getServerTime() - (message.date || 0) >= location.period;
}

export function isMessageTranslatable(message: ApiMessage, allowOutgoing?: boolean) {
  const { text, game } = message.content;

  const isLocal = isMessageLocal(message);
  const isServiceNotification = isServiceNotificationMessage(message);
  const isAction = isActionMessage(message);

  return Boolean(text?.text.length && !message.emojiOnlyCount && !game && (allowOutgoing || !message.isOutgoing)
    && !isLocal && !isServiceNotification && !isAction && !message.isScheduled);
}

export function getMessageSingleInlineButton(message: ApiMessage) {
  return message.inlineButtons?.length === 1
    && message.inlineButtons[0].length === 1
    && message.inlineButtons[0][0];
}

export function orderHistoryIds(listedIds: number[]) {
  return listedIds.sort((a, b) => a - b);
}

export function orderPinnedIds(pinnedIds: number[]) {
  return pinnedIds.sort((a, b) => b - a);
}

export function mergeIdRanges(ranges: number[][], idsUpdate: number[]): number[][] {
  let hasIntersection = false;
  let newOutlyingLists = ranges.length ? ranges.map((list) => {
    if (areSortedArraysIntersecting(list, idsUpdate) && !hasIntersection) {
      hasIntersection = true;
      return orderHistoryIds(unique(list.concat(idsUpdate)));
    }
    return list;
  }) : [idsUpdate];

  if (!hasIntersection) {
    newOutlyingLists = newOutlyingLists.concat([idsUpdate]);
  }

  newOutlyingLists.sort((a, b) => a[0] - b[0]);

  let length = newOutlyingLists.length;
  for (let i = 0; i < length; i++) {
    const array = newOutlyingLists[i];
    const prevArray = newOutlyingLists[i - 1];

    if (prevArray && (prevArray.includes(array[0]) || prevArray.includes(array[0] - 1))) {
      newOutlyingLists[i - 1] = orderHistoryIds(unique(array.concat(prevArray)));
      newOutlyingLists.splice(i, 1);

      length--;
      i--;
    }
  }

  return newOutlyingLists;
}

export function extractMessageText(message: ApiMessage | ApiStory, inChatList = false) {
  const contentText = message.content.text;
  if (!contentText) return undefined;

  const { text } = contentText;
  let { entities } = contentText;

  if (text && inChatList && 'chatId' in message && message.chatId === SERVICE_NOTIFICATIONS_USER_ID
    // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
    && !getGlobal().settings.byKey.shouldShowLoginCodeInChatList) {
    const authCode = text.match(/^\D*([\d-]{5,7})\D/)?.[1];
    if (authCode) {
      entities = [
        ...entities || [],
        {
          type: ApiMessageEntityTypes.Spoiler,
          offset: text.indexOf(authCode),
          length: authCode.length,
        },
      ];
      entities.sort((a, b) => (a.offset > b.offset ? 1 : -1));
    }
  }

  return { text, entities };
}
