import type {
  GlobalState,
} from '../types';
import {
  type ApiMessage,
  ApiMessageEntityTypes,
  type MediaContainer,
  type SizeTarget,
} from '../../api/types';

import { NSFW_RESTRICTION_REASON } from '../../config';
import {
  getMessageAudio,
  getMessageContent,
  getMessageDocument,
  getMessageInvoice,
  getMessageMediaHash,
  getMessagePhoto,
  getMessageSticker,
  getMessageText,
  getMessageVideo,
  getMessageVoice,
  getWebPageAudio,
  getWebPagePhoto,
  getWebPageVideo,
} from '../helpers';
import { selectChat } from './chats';
import {
  selectActiveRestrictionReasons,
  selectReplyMessage,
  selectWebPageFromMessage,
} from './messages';
import { selectSettingsKeys } from './settings';
import { selectCustomEmoji } from './symbols';

export function selectIsMediaNsfw<T extends GlobalState>(global: T, message: ApiMessage) {
  const { isSensitiveEnabled } = selectSettingsKeys(global);
  const chat = selectChat(global, message.chatId);
  if (isSensitiveEnabled) return false;

  const chatActiveRestrictions = selectActiveRestrictionReasons(global, chat?.restrictionReasons);
  const messageActiveRestrictions = selectActiveRestrictionReasons(global, message.restrictionReasons);

  return chatActiveRestrictions.some((reason) => reason.reason === NSFW_RESTRICTION_REASON)
    || messageActiveRestrictions.some((reason) => reason.reason === NSFW_RESTRICTION_REASON);
}

export function selectMessageDownloadableMedia<T extends GlobalState>(global: T, message: MediaContainer) {
  const text = getMessageText(message);
  const firstEntity = text?.entities?.[0];
  const isSingleCustomEmoji = firstEntity
    && text.entities?.length === 1
    && firstEntity.type === ApiMessageEntityTypes.CustomEmoji
    && firstEntity.offset === 0
    && firstEntity.length === text.text.length;

  const customEmoji = isSingleCustomEmoji ? selectCustomEmoji(global, firstEntity.documentId) : undefined;

  const webPage = selectWebPageFromMessage(global, message);
  return (
    customEmoji
    || getMessagePhoto(message)
    || getMessageVideo(message)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getMessageAudio(message)
    || getMessageVoice(message)
    || getWebPagePhoto(webPage)
    || getWebPageVideo(webPage)
    || getWebPageAudio(webPage)
  );
}

export function selectMessageMediaThumbnail<T extends GlobalState>(global: T, message: MediaContainer) {
  const webPage = selectWebPageFromMessage(global, message);
  const media = getMessagePhoto(message)
    || getMessageVideo(message)
    || getMessageDocument(message)
    || getMessageSticker(message)
    || getWebPagePhoto(webPage)
    || getWebPageVideo(webPage)
    || getMessageInvoice(message)?.extendedMedia;

  if (!media) {
    return undefined;
  }

  return media.thumbnail;
}

export function selectMessageMediaThumbDataUri<T extends GlobalState>(global: T, message: MediaContainer) {
  const thumbnail = selectMessageMediaThumbnail(global, message);
  return thumbnail?.dataUri;
}

export function selectMessageMediaHash<T extends GlobalState>(
  global: T,
  message: MediaContainer,
  target: SizeTarget,
) {
  const webPage = selectWebPageFromMessage(global, message);

  return getMessageMediaHash(message, { webPage }, target);
}

export function selectMessageMediaDuration<T extends GlobalState>(global: T, message: MediaContainer) {
  const { audio, voice, video } = getMessageContent(message);
  const webPage = selectWebPageFromMessage(global, message);
  const media = audio || voice || video || getWebPageVideo(webPage) || getWebPageAudio(webPage);
  if (!media) {
    return undefined;
  }

  return media.duration;
}

export function selectTimestampableMedia<T extends GlobalState>(global: T, message: MediaContainer) {
  const webPage = selectWebPageFromMessage(global, message);
  const video = getMessageVideo(message) || getWebPageVideo(webPage);
  return (video && !video.isRound && !video.isGif ? video : undefined)
    || getMessageAudio(message)
    || getMessageVoice(message);
}

export function selectMessageTimestampableDuration<T extends GlobalState>(
  global: T, message: ApiMessage, noReplies?: boolean,
) {
  const replyMessage = !noReplies ? selectReplyMessage(global, message) : undefined;

  const timestampableMedia = selectTimestampableMedia(global, message);
  const replyTimestampableMedia = replyMessage && selectTimestampableMedia(global, replyMessage);

  return timestampableMedia?.duration || replyTimestampableMedia?.duration;
}

export function selectMessageLastPlaybackTimestamp<T extends GlobalState>(
  global: T, chatId: string, messageId: number,
) {
  return global.messages.playbackByChatId[chatId]?.byId[messageId];
}
