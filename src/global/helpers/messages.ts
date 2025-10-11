import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiAttachment,
  ApiMessage,
  ApiMessageEntityTextUrl,
  ApiPeer,
  ApiStory,
  ApiTypeStory,
} from '../../api/types';
import type {
  ApiPoll, ApiWebPage, MediaContainer, StatefulMediaContent,
} from '../../api/types/messages';
import type { ThreadId } from '../../types';
import type { LangFn } from '../../util/localization';
import type { GlobalState } from '../types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import {
  LOTTIE_STICKER_MIME_TYPE,
  RE_LINK_TEMPLATE,
  SERVICE_NOTIFICATIONS_USER_ID,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  TME_LINK_PREFIX,
  VERIFICATION_CODES_USER_ID,
  VIDEO_STICKER_MIME_TYPE,
} from '../../config';
import { areDeepEqual } from '../../util/areDeepEqual';
import { getRawPeerId, isUserId } from '../../util/entities/ids';
import { areSortedArraysIntersecting, unique } from '../../util/iteratees';
import { isLocalMessageId } from '../../util/keys/messageKey';
import { getServerTime } from '../../util/serverTime';
import { getGlobal } from '../index';
import { selectPollFromMessage, selectWebPageFromMessage } from '../selectors';
import { getMainUsername } from './users';

const RE_LINK = new RegExp(RE_LINK_TEMPLATE, 'i');

export function getMessageHtmlId(messageId: number, index?: number) {
  const parts = ['message', messageId.toString().replace('.', '-'), index].filter(Boolean);
  return parts.join('-');
}

export function getMessageOriginalId(message: ApiMessage) {
  return message.previousLocalId || message.id;
}

export function getMessageTranscription(message: ApiMessage) {
  const { transcriptionId } = message;
  const global = getGlobal();

  return transcriptionId && global.transcriptions[transcriptionId]?.text;
}

export function hasMessageText(message: MediaContainer) {
  const {
    action, text, sticker, photo, video, audio, voice, document, pollId, todo,
    webPage, contact, invoice, location, game, storyData, giveaway, giveawayResults, paidMedia,
  } = message.content;

  return Boolean(text) || !(
    sticker || photo || video || audio || voice || document || contact || pollId || todo || webPage
    || invoice || location || game || storyData || giveaway || giveawayResults
    || paidMedia || action?.type === 'phoneCall'
  );
}

export function getMessageStatefulContent(global: GlobalState, message: ApiMessage): StatefulMediaContent {
  const poll = selectPollFromMessage(global, message);
  const webPage = selectWebPageFromMessage(global, message);

  const { peerId: storyPeerId, id: storyId } = message.content.storyData || {};
  const story = storyId && storyPeerId ? global.stories.byPeerId[storyPeerId]?.byId[storyId] : undefined;

  return groupStatefulContent({ poll, story, webPage });
}

export function groupStatefulContent({
  poll,
  story,
  webPage,
}: {
  poll?: ApiPoll;
  story?: ApiTypeStory;
  webPage?: ApiWebPage;
}) {
  return {
    poll,
    story: story && 'content' in story ? story : undefined,
    webPage,
  };
}

export function getMessageText(message: MediaContainer) {
  return hasMessageText(message) ? message.content.text : undefined;
}

export function getMessageTextWithFallback(lang: LangFn, message: MediaContainer) {
  return hasMessageText(message) ? message.content.text || { text: lang('MessageUnsupported') } : undefined;
}

export function getMessageCustomShape(message: ApiMessage): boolean {
  const {
    text, sticker, photo, video, audio, voice,
    document, pollId, webPage, contact, action,
    game, invoice, location, storyData,
  } = message.content;

  if (sticker || (video?.isRound)) {
    return true;
  }

  if (!text || photo || video || audio || voice || document || pollId || webPage || contact || action || game
    || invoice || location || storyData) {
    return false;
  }

  const hasOtherFormatting = text?.entities?.some((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji);

  return Boolean(text.emojiOnlyCount && !hasOtherFormatting);
}

export function getMessageSingleRegularEmoji(message: MediaContainer) {
  const { text } = message.content;

  if (!text || text.entities?.length || text.emojiOnlyCount !== 1) {
    return undefined;
  }

  return text.text;
}

export function getMessageSingleCustomEmoji(message: MediaContainer): string | undefined {
  const { text } = message.content;

  const firstEntity = text?.entities?.[0];
  if (text?.entities?.length !== 1
    || firstEntity?.type !== ApiMessageEntityTypes.CustomEmoji
    || firstEntity.offset !== 0
    || firstEntity.length !== text.text.length) {
    return undefined;
  }

  return firstEntity.documentId;
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

export function isReplyToMessage(message: ApiMessage) {
  return Boolean(message.replyInfo?.type === 'message');
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
  return Boolean(message.senderId) && !isUserId(message.senderId) && isOwnMessage(message);
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

export function isHistoryClearMessage(message: ApiMessage) {
  return message.content.action && message.content.action.type === 'historyClear';
}

export function isGeoLiveExpired(message: ApiMessage) {
  const { location } = message.content;
  if (location?.mediaType !== 'geoLive') return false;
  return getServerTime() - (message.date || 0) >= location.period;
}

export function isMessageTranslatable(message: ApiMessage, allowOutgoing?: boolean) {
  const { text, game } = message.content;

  const isLocal = isMessageLocal(message);
  const isServiceNotification = isServiceNotificationMessage(message);
  const isAction = isActionMessage(message);

  return Boolean(text?.text.length && !text.emojiOnlyCount && !game && (allowOutgoing || !message.isOutgoing)
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

  if (text && 'chatId' in message) {
    if (message.chatId === SERVICE_NOTIFICATIONS_USER_ID) {
      const authCode = text.match(/^\D*([\d-]{5,7})\D/)?.[1];
      if (authCode) {
        entities = [
          ...entities || [],
          {
            type: inChatList ? ApiMessageEntityTypes.Spoiler : ApiMessageEntityTypes.Code,
            offset: text.indexOf(authCode),
            length: authCode.length,
          },
        ];
        entities.sort((a, b) => (a.offset > b.offset ? 1 : -1));
      }
    }

    if (inChatList && message.chatId === VERIFICATION_CODES_USER_ID && entities) {
      // Wrap code entities in spoiler
      const hasCodeEntities = entities.some((entity) => entity.type === ApiMessageEntityTypes.Code);
      if (hasCodeEntities) {
        const oldEntities = entities;
        entities = [];

        for (let i = 0; i < oldEntities.length; i++) {
          const entity = oldEntities[i];
          if (entity.type === ApiMessageEntityTypes.Code) {
            entities.push({
              type: ApiMessageEntityTypes.Spoiler,
              offset: entity.offset,
              length: entity.length,
            });
          }
          entities.push(entity);
        }
      }
    }
  }

  return { text, entities };
}

export function isExpiredMessage(message: ApiMessage) {
  return message.content.action?.type === 'expired';
}

export function hasMessageTtl(message: ApiMessage) {
  return message.content?.ttlSeconds !== undefined;
}

export function getAttachmentMediaType(attachment: ApiAttachment) {
  if (SUPPORTED_AUDIO_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'audio';
  }

  if (attachment.shouldSendAsFile) return 'file';

  if (SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'photo';
  }

  if (SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType)) {
    return 'video';
  }

  return 'file';
}

export function isUploadingFileSticker(attachment: ApiAttachment) {
  return attachment ? (attachment.mimeType === 'image/webp' || attachment.mimeType === LOTTIE_STICKER_MIME_TYPE
    || attachment.mimeType === VIDEO_STICKER_MIME_TYPE) : undefined;
}

export function getMessageLink(peer: ApiPeer, topicId?: ThreadId, messageId?: number) {
  const chatUsername = getMainUsername(peer);

  const normalizedId = getRawPeerId(peer.id).toString();

  const chatPart = chatUsername || `c/${normalizedId}`;
  const topicPart = topicId && topicId !== MAIN_THREAD_ID ? `/${topicId}` : '';
  const messagePart = messageId ? `/${messageId}` : '';
  return `${TME_LINK_PREFIX}${chatPart}${topicPart}${messagePart}`;
}

export function splitMessagesForForwarding(messages: ApiMessage[], limit: number): ApiMessage[][] {
  const result: ApiMessage[][] = [];
  let currentArr: ApiMessage[] = [];

  // Group messages by `groupedId`
  messages.reduce<ApiMessage[][]>((acc, message) => {
    const lastGroup = acc[acc.length - 1];
    if (message.groupedId && lastGroup?.[0]?.groupedId === message.groupedId) {
      lastGroup.push(message);
      return acc;
    }

    acc.push([message]);
    return acc;
  }, []).forEach((batch) => {
    // Fit them into `limit` size
    if (currentArr.length + batch.length > limit) {
      result.push(currentArr);
      currentArr = [];
    }

    currentArr.push(...batch);
  });

  if (currentArr.length) {
    result.push(currentArr);
  }

  return result;
}

export interface SuggestedChangesInfo {
  isNewText: boolean;
  isNewPrice: boolean;
  isNewTime: boolean;
  isNewMedia: boolean;
}

export function getSuggestedChangesInfo(
  message: ApiMessage,
  originalMessage?: ApiMessage,
): SuggestedChangesInfo | undefined {
  if (!message.suggestedPostInfo || message.replyInfo?.type !== 'message'
    || !message.replyInfo?.replyToMsgId || !originalMessage) {
    return undefined;
  }

  if (!originalMessage.suggestedPostInfo) {
    return undefined;
  }

  const original = originalMessage.suggestedPostInfo;
  const suggested = message.suggestedPostInfo;

  const originalContent = originalMessage.content;
  const suggestedContent = message.content;
  const { text: originalText, ...originalMediaContent } = originalContent;
  const { text: suggestedText, ...suggestedMediaContent } = suggestedContent;

  const isNewText = !areDeepEqual(originalText, suggestedText);
  const isNewMedia = !areDeepEqual(originalMediaContent, suggestedMediaContent);

  const originalPrice = original.price?.amount;
  const suggestedPrice = suggested.price?.amount;
  const isNewPrice = originalPrice !== suggestedPrice;

  const originalTime = original.scheduleDate;
  const suggestedTime = suggested.scheduleDate;
  const isNewTime = originalTime !== suggestedTime;

  if (!isNewText && !isNewPrice && !isNewTime && !isNewMedia) {
    return undefined;
  }

  return {
    isNewText,
    isNewPrice,
    isNewTime,
    isNewMedia,
  };
}

export function getSuggestedChangesActionText(
  lang: LangFn,
  message: ApiMessage,
  originalMessage?: ApiMessage,
  isOutgoing?: boolean,
  senderLink?: TeactNode,
): TeactNode | undefined {
  const changesInfo = getSuggestedChangesInfo(message, originalMessage);
  if (!changesInfo) {
    return undefined;
  }

  const changesParts: string[] = [];
  if (changesInfo.isNewPrice) changesParts.push(lang('ActionSuggestedChangesPrice'));
  if (changesInfo.isNewTime) changesParts.push(lang('ActionSuggestedChangesTime'));
  if (changesInfo.isNewText) changesParts.push(lang('ActionSuggestedChangesText'));
  if (changesInfo.isNewMedia) changesParts.push(lang('ActionSuggestedChangesMedia'));

  const changesText = lang.conjunction(changesParts);

  const langKey = isOutgoing ? 'ActionSuggestedChangesOutgoing' : 'ActionSuggestedChangesIncoming';
  return lang(langKey, {
    changes: changesText,
    user: senderLink,
  }, {
    withNodes: true,
    withMarkdown: true,
  });
}
