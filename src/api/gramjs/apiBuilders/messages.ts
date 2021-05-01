import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiMessage,
  ApiMessageForwardInfo,
  ApiPhoto,
  ApiSticker,
  ApiVideo,
  ApiVoice,
  ApiAudio,
  ApiDocument,
  ApiAction,
  ApiContact,
  ApiAttachment,
  ApiPoll,
  ApiNewPoll,
  ApiWebPage,
  ApiMessageEntity,
  ApiFormattedText,
  ApiKeyboardButtons,
  ApiKeyboardButton,
  ApiChat,
  ApiThreadInfo,
  ApiInvoice,
} from '../../types';

import { DELETED_COMMENTS_CHANNEL_ID, LOCAL_MESSAGE_ID_BASE, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { pick } from '../../../util/iteratees';
import { getApiChatIdFromMtpPeer } from './chats';
import { buildStickerFromDocument } from './symbols';
import { buildApiPhoto, buildApiThumbnailFromStripped, buildApiPhotoSize } from './common';
import { interpolateArray } from '../../../util/waveform';
import { getCurrencySign } from '../../../components/middle/helpers/getCurrencySign';
import { buildPeer } from '../gramjsBuilders';
import { addPhotoToLocalDb, resolveMessageApiChatId } from '../helpers';

const LOCAL_IMAGE_UPLOADING_TEMP_ID = 'temp';
const LOCAL_VIDEO_UPLOADING_TEMP_ID = 'temp';
const INPUT_WAVEFORM_LENGTH = 63;

let localMessageCounter = LOCAL_MESSAGE_ID_BASE;
let currentUserId!: number;

export function setMessageBuilderCurrentUserId(_currentUserId: number) {
  currentUserId = _currentUserId;
}

export function buildApiMessage(mtpMessage: GramJs.TypeMessage): ApiMessage | undefined {
  const chatId = resolveMessageApiChatId(mtpMessage);
  if (
    !chatId
    || !(mtpMessage instanceof GramJs.Message || mtpMessage instanceof GramJs.MessageService)) {
    return undefined;
  }

  return buildApiMessageWithChatId(chatId, mtpMessage);
}

export function buildApiMessageFromShort(mtpMessage: GramJs.UpdateShortMessage): ApiMessage {
  const chatId = getApiChatIdFromMtpPeer({ userId: mtpMessage.userId } as GramJs.TypePeer);

  return buildApiMessageWithChatId(chatId, {
    ...mtpMessage,
    fromId: buildPeer(mtpMessage.out ? currentUserId : mtpMessage.userId),
  });
}

export function buildApiMessageFromShortChat(mtpMessage: GramJs.UpdateShortChatMessage): ApiMessage {
  const chatId = getApiChatIdFromMtpPeer({ chatId: mtpMessage.chatId } as GramJs.TypePeer);

  return buildApiMessageWithChatId(chatId, {
    ...mtpMessage,
    fromId: buildPeer(mtpMessage.fromId),
  });
}

export function buildApiMessageFromNotification(
  notification: GramJs.UpdateServiceNotification,
  currentDate: number,
): ApiMessage {
  const localId = localMessageCounter++;
  let content: ApiMessage['content'] = {};

  if (notification.media) {
    content = {
      ...buildMessageMediaContent(notification.media),
    };
  }

  if (notification.message && !content.sticker && !content.poll && !content.contact) {
    content = {
      ...content,
      text: buildMessageTextContent(notification.message, notification.entities),
    };
  }

  return {
    id: localId,
    chatId: SERVICE_NOTIFICATIONS_USER_ID,
    date: notification.inboxDate || (currentDate / 1000),
    content,
    isOutgoing: false,
  };
}

type UniversalMessage = (
  Pick<GramJs.Message & GramJs.MessageService, ('id' | 'date')>
  & Pick<Partial<GramJs.Message & GramJs.MessageService>, (
    'out' | 'message' | 'entities' | 'fromId' | 'peerId' | 'fwdFrom' | 'replyTo' | 'replyMarkup' | 'post' |
    'media' | 'action' | 'views' | 'editDate' | 'editHide' | 'mediaUnread' | 'groupedId' | 'mentioned' | 'viaBotId' |
    'replies' | 'fromScheduled' | 'postAuthor'
  )>
);

export function buildApiMessageWithChatId(chatId: number, mtpMessage: UniversalMessage): ApiMessage {
  const fromId = mtpMessage.fromId ? getApiChatIdFromMtpPeer(mtpMessage.fromId) : undefined;
  const isChatWithSelf = !fromId && chatId === currentUserId;
  const isOutgoing = (mtpMessage.out && !mtpMessage.post) || (isChatWithSelf && !mtpMessage.fwdFrom);

  let content: ApiMessage['content'] = {};

  if (mtpMessage.media) {
    content = {
      ...buildMessageMediaContent(mtpMessage.media),
    };
  }

  if (mtpMessage.message && !content.sticker && !content.poll && !content.contact) {
    content = {
      ...content,
      text: buildMessageTextContent(mtpMessage.message, mtpMessage.entities),
    };
  }

  const action = mtpMessage.action && buildAction(mtpMessage.action, fromId, Boolean(mtpMessage.post), isOutgoing);
  if (action) {
    content.action = action;
  }

  const { replyToMsgId, replyToTopId } = mtpMessage.replyTo || {};
  const isEdited = mtpMessage.editDate && !mtpMessage.editHide;
  const { inlineButtons, keyboardButtons } = buildReplyButtons(mtpMessage) || {};
  const forwardInfo = mtpMessage.fwdFrom && buildApiMessageForwardInfo(mtpMessage.fwdFrom, isChatWithSelf);
  const { replies, mediaUnread: isMediaUnread, postAuthor } = mtpMessage;
  const groupedId = mtpMessage.groupedId && mtpMessage.groupedId.toString();
  const isInAlbum = Boolean(groupedId) && !(content.document || content.audio);
  const shouldHideKeyboardButtons = mtpMessage.replyMarkup instanceof GramJs.ReplyKeyboardHide;

  return {
    id: mtpMessage.id,
    chatId,
    isOutgoing,
    content,
    date: mtpMessage.date,
    senderId: fromId || (mtpMessage.out && mtpMessage.post && currentUserId) || chatId,
    views: mtpMessage.views,
    isFromScheduled: mtpMessage.fromScheduled,
    ...(replyToMsgId && { replyToMessageId: replyToMsgId }),
    ...(replyToTopId && { replyToTopMessageId: replyToTopId }),
    ...(forwardInfo && { forwardInfo }),
    ...(isEdited && { isEdited }),
    ...(isMediaUnread && { isMediaUnread }),
    ...(mtpMessage.mentioned && isMediaUnread && { hasUnreadMention: true }),
    ...(groupedId && {
      groupedId,
      isInAlbum,
    }),
    inlineButtons,
    ...(keyboardButtons && { keyboardButtons }),
    ...(shouldHideKeyboardButtons && { shouldHideKeyboardButtons }),
    ...(mtpMessage.viaBotId && { viaBotId: mtpMessage.viaBotId }),
    ...(replies && replies.comments && { threadInfo: buildThreadInfo(replies, mtpMessage.id, chatId) }),
    ...(postAuthor && { adminTitle: postAuthor }),
  };
}

export function buildMessageTextContent(
  message: string,
  entities?: GramJs.TypeMessageEntity[],
): ApiFormattedText {
  return {
    text: message,
    ...(entities && { entities: entities.map(buildApiMessageEntity) }),
  };
}

export function buildMessageDraft(draft: GramJs.TypeDraftMessage) {
  if (draft instanceof GramJs.DraftMessageEmpty || !draft.message) {
    return undefined;
  }

  return {
    formattedText: buildMessageTextContent(draft.message, draft.entities),
    replyingToId: draft.replyToMsgId,
  };
}

export function buildMessageMediaContent(media: GramJs.TypeMessageMedia): ApiMessage['content'] | undefined {
  const sticker = buildSticker(media);
  if (sticker) return { sticker };

  const photo = buildPhoto(media);
  if (photo) return { photo };

  const video = buildVideo(media);
  if (video) return { video };

  const audio = buildAudio(media);
  if (audio) return { audio };

  const voice = buildVoice(media);
  if (voice) return { voice };

  const document = buildDocumentFromMedia(media);
  if (document) return { document };

  const contact = buildContact(media);
  if (contact) return { contact };

  const poll = buildPollFromMedia(media);
  if (poll) return { poll };

  const webPage = buildWebPage(media);
  if (webPage) return { webPage };

  const invoice = buildInvoiceFromMedia(media);
  if (invoice) return { invoice };

  return undefined;
}

function buildApiMessageForwardInfo(fwdFrom: GramJs.MessageFwdHeader, isChatWithSelf = false): ApiMessageForwardInfo {
  const savedFromPeerId = fwdFrom.savedFromPeer && getApiChatIdFromMtpPeer(fwdFrom.savedFromPeer);
  const fromId = fwdFrom.fromId && getApiChatIdFromMtpPeer(fwdFrom.fromId);

  return {
    isChannelPost: Boolean(fwdFrom.channelPost),
    isLinkedChannelPost: Boolean(fwdFrom.channelPost && savedFromPeerId && !isChatWithSelf),
    fromChatId: savedFromPeerId || fromId,
    fromMessageId: fwdFrom.channelPost || fwdFrom.savedFromMsgId,
    senderUserId: fromId,
    hiddenUserName: fwdFrom.fromName,
    adminTitle: fwdFrom.postAuthor,
  };
}

function buildSticker(media: GramJs.TypeMessageMedia): ApiSticker | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  return buildStickerFromDocument(media.document);
}

function buildPhoto(media: GramJs.TypeMessageMedia): ApiPhoto | undefined {
  if (!(media instanceof GramJs.MessageMediaPhoto) || !media.photo || !(media.photo instanceof GramJs.Photo)) {
    return undefined;
  }

  if (media.ttlSeconds) {
    return undefined;
  }

  return buildApiPhoto(media.photo);
}

export function buildVideoFromDocument(document: GramJs.Document): ApiVideo | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const {
    id, mimeType, thumbs, size, attributes,
  } = document;

  const videoAttr = attributes
    .find((a: any): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

  if (!videoAttr) {
    return undefined;
  }

  const gifAttr = attributes
    .find((a: any): a is GramJs.DocumentAttributeAnimated => a instanceof GramJs.DocumentAttributeAnimated);

  const {
    duration,
    w: width,
    h: height,
    supportsStreaming = false,
    roundMessage: isRound = false,
  } = videoAttr;

  return {
    id: String(id),
    mimeType,
    duration,
    fileName: getFilenameFromDocument(document, 'video'),
    width,
    height,
    supportsStreaming,
    isRound,
    isGif: Boolean(gifAttr),
    thumbnail: buildApiThumbnailFromStripped(thumbs),
    size,
  };
}

function buildVideo(media: GramJs.TypeMessageMedia): ApiVideo | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !(media.document instanceof GramJs.Document)
    || !media.document.mimeType.startsWith('video')
  ) {
    return undefined;
  }

  return buildVideoFromDocument(media.document);
}

function buildAudio(media: GramJs.TypeMessageMedia): ApiAudio | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  const audioAttribute = media.document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || audioAttribute.voice) {
    return undefined;
  }

  return {
    fileName: getFilenameFromDocument(media.document, 'audio'),
    ...pick(media.document, ['size', 'mimeType']),
    ...pick(audioAttribute, ['duration', 'performer', 'title']),
  };
}

function buildVoice(media: GramJs.TypeMessageMedia): ApiVoice | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  const audioAttribute = media.document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || !audioAttribute.voice) {
    return undefined;
  }

  const { duration, waveform } = audioAttribute;

  return {
    duration,
    waveform: waveform ? Array.from(waveform) : undefined,
  };
}

function buildDocumentFromMedia(media: GramJs.TypeMessageMedia) {
  if (!(media instanceof GramJs.MessageMediaDocument) || !media.document) {
    return undefined;
  }

  if (media.ttlSeconds) {
    return undefined;
  }

  return buildApiDocument(media.document);
}

export function buildApiDocument(document: GramJs.TypeDocument): ApiDocument | undefined {
  if (!(document instanceof GramJs.Document)) {
    return undefined;
  }

  const {
    id, size, mimeType, date, thumbs,
  } = document;

  const thumbnail = thumbs && buildApiThumbnailFromStripped(thumbs);

  return {
    id: String(id),
    size,
    mimeType,
    timestamp: date,
    fileName: getFilenameFromDocument(document),
    thumbnail,
  };
}

function buildContact(media: GramJs.TypeMessageMedia): ApiContact | undefined {
  if (!(media instanceof GramJs.MessageMediaContact)) {
    return undefined;
  }

  return pick(media, [
    'firstName',
    'lastName',
    'phoneNumber',
    'userId',
  ]);
}

function buildPollFromMedia(media: GramJs.TypeMessageMedia): ApiPoll | undefined {
  if (!(media instanceof GramJs.MessageMediaPoll)) {
    return undefined;
  }

  return buildPoll(media.poll, media.results);
}


function buildInvoiceFromMedia(media: GramJs.TypeMessageMedia): ApiInvoice | undefined {
  if (!(media instanceof GramJs.MessageMediaInvoice)) {
    return undefined;
  }

  return buildInvoice(media);
}

export function buildPoll(poll: GramJs.Poll, pollResults: GramJs.PollResults): ApiPoll {
  const { id, answers: rawAnswers } = poll;
  const answers = rawAnswers.map((answer) => ({
    text: answer.text,
    option: String.fromCharCode(...answer.option),
  }));

  return {
    id: id.toString(),
    summary: {
      isPublic: poll.publicVoters,
      ...pick(poll, [
        'closed',
        'multipleChoice',
        'quiz',
        'question',
        'closePeriod',
        'closeDate',
      ]),
      answers,
    },
    results: buildPollResults(pollResults),
  };
}

export function buildInvoice(media: GramJs.MessageMediaInvoice): ApiInvoice {
  const {
    description: text, title, photo, test, totalAmount, currency, receiptMsgId,
  } = media;
  const currencySign = getCurrencySign(currency);
  return {
    text,
    title,
    photoUrl: photo && photo.url,
    receiptMsgId,
    description: `${currencySign}${(Number(totalAmount) / 100).toFixed(2)} ${test ? 'TEST INVOICE' : ''}`,
  };
}

export function buildPollResults(pollResults: GramJs.PollResults): ApiPoll['results'] {
  const {
    results: rawResults, totalVoters, recentVoters, solution, solutionEntities: entities,
  } = pollResults;
  const results = rawResults && rawResults.map(({
    option, chosen, correct, voters,
  }) => ({
    isChosen: chosen,
    isCorrect: correct,
    option: String.fromCharCode(...option),
    votersCount: voters,
  }));

  return {
    totalVoters,
    recentVoterIds: recentVoters,
    results,
    solution,
    ...(entities && { solutionEntities: entities.map(buildApiMessageEntity) }),
  };
}

export function buildWebPage(media: GramJs.TypeMessageMedia): ApiWebPage | undefined {
  if (
    !(media instanceof GramJs.MessageMediaWebPage)
    || !(media.webpage instanceof GramJs.WebPage)
  ) {
    return undefined;
  }

  const { id, photo, document } = media.webpage;

  return {
    id: Number(id),
    ...pick(media.webpage, [
      'url',
      'displayUrl',
      'siteName',
      'title',
      'description',
    ]),
    photo: photo && photo instanceof GramJs.Photo
      ? {
        id: String(photo.id),
        thumbnail: buildApiThumbnailFromStripped(photo.sizes),
        sizes: photo.sizes
          .filter((s: any): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize)
          .map(buildApiPhotoSize),
      }
      : undefined,
    // TODO support video and embed
    ...(document && { hasDocument: true }),
  };
}

function buildAction(
  action: GramJs.TypeMessageAction,
  senderId: number | undefined,
  isChannelPost: boolean,
  isOutgoing: boolean,
): ApiAction | undefined {
  if (action instanceof GramJs.MessageActionEmpty) {
    return undefined;
  }

  let text = '';
  let type: ApiAction['type'] = 'other';
  let photo: ApiPhoto | undefined;

  const targetUserId = 'users' in action
    // Api returns array of userIds, but no action currently has multiple users in it
    ? action.users && action.users[0]
    : ('userId' in action && action.userId) || undefined;
  let targetChatId: number | undefined;

  if (action instanceof GramJs.MessageActionChatCreate) {
    text = `%action_origin% created the group «${action.title}»`;
  } else if (action instanceof GramJs.MessageActionChatEditTitle) {
    text = isChannelPost
      ? `Channel renamed to «${action.title}»`
      : `%action_origin% changed group name to «${action.title}»`;
  } else if (action instanceof GramJs.MessageActionChatEditPhoto) {
    text = isChannelPost
      ? 'Channel photo updated'
      : '%action_origin% updated group photo';
  } else if (action instanceof GramJs.MessageActionChatDeletePhoto) {
    text = isChannelPost
      ? 'Channel photo was deleted'
      : 'Chat photo was deleted';
  } else if (action instanceof GramJs.MessageActionChatAddUser) {
    text = !senderId || senderId === targetUserId
      ? '%target_user% joined the group'
      : '%action_origin% added %target_user% to the group';
  } else if (action instanceof GramJs.MessageActionChatDeleteUser) {
    text = !senderId || senderId === targetUserId
      ? '%target_user% left the group'
      : '%action_origin% removed %target_user% from the group';
  } else if (action instanceof GramJs.MessageActionChatJoinedByLink) {
    text = '%action_origin% joined the chat from invitation link';
  } else if (action instanceof GramJs.MessageActionChannelCreate) {
    text = 'Channel created';
  } else if (action instanceof GramJs.MessageActionChatMigrateTo) {
    text = 'Migrated to %target_chat%';
    targetChatId = getApiChatIdFromMtpPeer(action);
  } else if (action instanceof GramJs.MessageActionChannelMigrateFrom) {
    text = 'Migrated from %target_chat%';
    targetChatId = getApiChatIdFromMtpPeer(action);
  } else if (action instanceof GramJs.MessageActionPinMessage) {
    text = '%action_origin% pinned %message%';
  } else if (action instanceof GramJs.MessageActionHistoryClear) {
    text = 'Chat history was cleared';
    type = 'historyClear';
  } else if (action instanceof GramJs.MessageActionPhoneCall) {
    text = `${isOutgoing ? 'Outgoing' : 'Incoming'} ${action.video ? 'Video' : 'Phone'} Call`;

    if (action.duration) {
      const mins = Math.max(Math.round(action.duration / 60), 1);
      text += ` (${mins} min${mins > 1 ? 's' : ''})`;
    }
  } else if (action instanceof GramJs.MessageActionContactSignUp) {
    text = '%action_origin% joined Telegram';
  } else if (action instanceof GramJs.MessageActionPaymentSent) {
    const currencySign = getCurrencySign(action.currency);
    const amount = (Number(action.totalAmount) / 100).toFixed(2);
    text = `You successfully transferred ${currencySign}${amount} to shop for %product%`;
  } else {
    text = '%ACTION_NOT_IMPLEMENTED%';
  }

  if ('photo' in action && action.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(action.photo);
    photo = buildApiPhoto(action.photo);
  }

  return {
    text,
    type,
    targetUserId,
    targetChatId,
    photo, // TODO Only used internally now, will be used for the UI in future
  };
}

function buildReplyButtons(message: UniversalMessage): {
  [K in 'inlineButtons' | 'keyboardButtons']?: ApiKeyboardButtons
} | undefined {
  const { id: messageId, replyMarkup, media } = message;

  if (!replyMarkup) {
    if (media instanceof GramJs.MessageMediaWebPage && media.webpage instanceof GramJs.WebPage) {
      if (media.webpage.type === 'telegram_message') {
        return {
          inlineButtons: [[{
            type: 'url' as const,
            text: 'Show Message',
            messageId,
            value: media.webpage.url,
          }]],
        };
      }
    }

    return undefined;
  }

  // TODO
  if (!(replyMarkup instanceof GramJs.ReplyKeyboardMarkup || replyMarkup instanceof GramJs.ReplyInlineMarkup)) {
    return undefined;
  }

  const markup = replyMarkup.rows.map(({ buttons }) => {
    return buttons.map((button) => {
      let { text } = button;

      let type;
      let value;
      if (button instanceof GramJs.KeyboardButton) {
        type = 'command';
        value = text;
      } else if (button instanceof GramJs.KeyboardButtonUrl) {
        type = 'url';
        value = button.url;
      } else if (button instanceof GramJs.KeyboardButtonCallback) {
        type = 'callback';
        value = String(button.data);
      } else if (button instanceof GramJs.KeyboardButtonRequestPoll) {
        type = 'requestPoll';
      } else if (button instanceof GramJs.KeyboardButtonBuy) {
        if (media instanceof GramJs.MessageMediaInvoice && media.receiptMsgId) {
          text = 'Receipt';
          value = media.receiptMsgId;
        }
        type = 'buy';
      } else {
        type = 'NOT_SUPPORTED';
      }

      return {
        type,
        text,
        messageId,
        value,
      } as ApiKeyboardButton;
    });
  });

  return { [replyMarkup instanceof GramJs.ReplyKeyboardMarkup ? 'keyboardButtons' : 'inlineButtons']: markup };
}

function getFilenameFromDocument(document: GramJs.Document, defaultBase = 'file') {
  const { mimeType, attributes } = document;
  const filenameAttribute = attributes
    .find((a: any): a is GramJs.DocumentAttributeFilename => a instanceof GramJs.DocumentAttributeFilename);

  if (filenameAttribute) {
    return filenameAttribute.fileName;
  }

  const extension = mimeType.split('/')[1];

  return `${defaultBase}${String(document.id)}.${extension}`;
}

export function buildLocalMessage(
  chat: ApiChat,
  text?: string,
  entities?: ApiMessageEntity[],
  replyingTo?: number,
  attachment?: ApiAttachment,
  sticker?: ApiSticker,
  gif?: ApiVideo,
  poll?: ApiNewPoll,
  groupedId?: string,
  scheduledAt?: number,
): ApiMessage {
  const localId = localMessageCounter++;
  const media = attachment && buildUploadingMedia(attachment);
  const isChannel = chat.type === 'chatTypeChannel';

  return {
    id: localId,
    chatId: chat.id,
    content: {
      ...(text && {
        text: {
          text,
          entities,
        },
      }),
      ...media,
      ...(sticker && { sticker }),
      ...(gif && { video: gif }),
      ...(poll && buildNewPoll(poll, localId)),
    },
    date: scheduledAt || Math.round(Date.now() / 1000),
    isOutgoing: !isChannel,
    senderId: currentUserId,
    ...(replyingTo && { replyToMessageId: replyingTo }),
    ...(groupedId && {
      groupedId,
      ...(media && (media.photo || media.video) && { isInAlbum: true }),
    }),
    ...(scheduledAt && { isScheduled: true }),
  };
}

export function buildForwardedMessage(
  toChat: ApiChat,
  message: ApiMessage,
): ApiMessage {
  const localId = localMessageCounter++;
  const {
    content,
    chatId: fromChatId,
    id: fromMessageId,
    senderId,
    groupedId,
    isInAlbum,
  } = message;

  const isAudio = content.audio;
  const asIncomingInChatWithSelf = (
    toChat.id === currentUserId && (fromChatId !== toChat.id || message.forwardInfo) && !isAudio
  );

  return {
    id: localId,
    chatId: toChat.id,
    content,
    date: Math.round(Date.now() / 1000),
    isOutgoing: !asIncomingInChatWithSelf && toChat.type !== 'chatTypeChannel',
    senderId: currentUserId,
    sendingState: 'messageSendingStatePending',
    // Forward info doesn't get added when users forwards his own messages, also when forwarding audio
    ...(senderId !== currentUserId && !isAudio && {
      forwardInfo: {
        isChannelPost: false,
        fromChatId,
        fromMessageId,
        senderUserId: senderId,
      },
    }),
    groupedId,
    isInAlbum,
  };
}

function buildUploadingMedia(
  attachment: ApiAttachment,
): ApiMessage['content'] {
  const {
    filename: fileName,
    blobUrl,
    previewBlobUrl,
    mimeType,
    size,
  } = attachment;

  if (attachment.quick) {
    const { width, height, duration } = attachment.quick;

    if (mimeType.startsWith('image/')) {
      return {
        photo: {
          id: LOCAL_IMAGE_UPLOADING_TEMP_ID,
          sizes: [],
          thumbnail: { width, height, dataUri: '' }, // Used only for dimensions
          blobUrl,
        },
      };
    } else {
      return {
        video: {
          id: LOCAL_VIDEO_UPLOADING_TEMP_ID,
          mimeType,
          duration: duration || 0,
          fileName,
          width,
          height,
          blobUrl,
          ...(previewBlobUrl && { thumbnail: { width, height, dataUri: previewBlobUrl } }),
          size,
        },
      };
    }
  } else if (attachment.voice) {
    const { duration, waveform } = attachment.voice;
    const { data: inputWaveform } = interpolateArray(waveform, INPUT_WAVEFORM_LENGTH);
    return {
      voice: {
        duration,
        waveform: inputWaveform,
      },
    };
  } else if (mimeType.startsWith('audio/')) {
    return {
      audio: {
        mimeType,
        fileName,
        size,
        duration: 200, // Arbitrary
      },
    };
  } else {
    return {
      document: {
        mimeType,
        fileName,
        size,
        ...(previewBlobUrl && { previewBlobUrl }),
      },
    };
  }
}

function buildNewPoll(poll: ApiNewPoll, localId: number) {
  return {
    poll: {
      id: localId.toString(),
      summary: pick(poll.summary, ['question', 'answers']),
      results: {},
    },
  };
}

function buildApiMessageEntity(entity: GramJs.TypeMessageEntity): ApiMessageEntity {
  const { className: type, offset, length } = entity;
  return {
    type,
    offset,
    length,
    ...('userId' in entity && typeof entity.userId === 'number' && { userId: entity.userId }),
    ...('url' in entity && { url: entity.url }),
  };
}

function buildThreadInfo(
  messageReplies: GramJs.TypeMessageReplies, messageId: number, chatId: number,
): ApiThreadInfo | undefined {
  const {
    channelId, replies, maxId, readMaxId, recentRepliers,
  } = messageReplies;

  if (channelId === DELETED_COMMENTS_CHANNEL_ID) {
    return undefined;
  }

  const isPostThread = chatId !== channelId;

  return {
    threadId: messageId,
    ...(isPostThread ? {
      chatId: getApiChatIdFromMtpPeer({ channelId } as GramJs.TypePeer),
      originChannelId: chatId,
    } : {
      chatId,
    }),
    messagesCount: replies,
    lastMessageId: maxId,
    lastReadInboxMessageId: readMaxId,
    ...(recentRepliers && { recentReplierIds: recentRepliers.map(getApiChatIdFromMtpPeer) }),
  };
}
