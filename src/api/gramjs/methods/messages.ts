import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';

import type { ThreadId, WebPageMediaSize } from '../../../types';
import type {
  ApiAttachment,
  ApiChat,
  ApiContact,
  ApiError,
  ApiFormattedText,
  ApiGlobalMessageSearchType,
  ApiInputReplyInfo,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageSearchContext,
  ApiMessageSearchType,
  ApiNewPoll,
  ApiOnProgress,
  ApiPeer,
  ApiPoll,
  ApiReaction,
  ApiSendMessageAction,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiUserStatus,
  ApiVideo,
  MediaContent,
} from '../../types';
import { MAIN_THREAD_ID, MESSAGE_DELETED } from '../../types';

import {
  API_GENERAL_ID_LIMIT,
  DEBUG,
  GIF_MIME_TYPE,
  MAX_INT_32,
  MENTION_UNREAD_SLICE,
  MESSAGE_ID_REQUIRED_ERROR,
  PINNED_MESSAGES_LIMIT,
  REACTION_UNREAD_SLICE,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { fetchFile } from '../../../util/files';
import { compact, split } from '../../../util/iteratees';
import { getMessageKey } from '../../../util/keys/messageKey';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { interpolateArray } from '../../../util/waveform';
import {
  buildApiChatFromPreview,
  buildApiSendAsPeerId,
  buildApiSponsoredMessageReportResult,
} from '../apiBuilders/chats';
import { buildApiFormattedText } from '../apiBuilders/common';
import {
  buildMessageMediaContent, buildMessageTextContent, buildPollFromMedia, buildWebPage,
} from '../apiBuilders/messageContent';
import {
  buildApiFactCheck,
  buildApiMessage,
  buildApiQuickReply,
  buildApiReportResult,
  buildApiSponsoredMessage,
  buildApiThreadInfo,
  buildLocalForwardedMessage,
  buildLocalMessage,
  buildUploadingMedia,
} from '../apiBuilders/messages';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildApiUser, buildApiUserStatuses } from '../apiBuilders/users';
import {
  buildInputEntity,
  buildInputMediaDocument,
  buildInputPeer,
  buildInputPoll,
  buildInputPollFromExisting,
  buildInputReaction,
  buildInputReplyTo,
  buildInputStory,
  buildInputTextWithEntities,
  buildMessageFromUpdate,
  buildMtpMessageEntity,
  buildPeer,
  buildSendMessageAction,
  generateRandomBigInt,
  getEntityTypeById,
} from '../gramjsBuilders';
import {
  deserializeBytes,
  resolveMessageApiChatId,
} from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { processMessageAndUpdateThreadInfo } from '../updates/entityProcessor';
import { processAffectedHistory, updateChannelState } from '../updates/updateManager';
import { requestChatUpdate } from './chats';
import { handleGramJsUpdate, invokeRequest, uploadFile } from './client';

const FAST_SEND_TIMEOUT = 1000;
const INPUT_WAVEFORM_LENGTH = 63;

type TranslateTextParams = ({
  text: ApiFormattedText[];
} | {
  chat: ApiChat;
  messageIds: number[];
}) & {
  toLanguageCode: string;
};

type SearchResults = {
  messages: ApiMessage[];
  userStatusesById: Record<number, ApiUserStatus>;
  totalCount: number;
  nextOffsetRate?: number;
  nextOffsetPeerId?: string;
  nextOffsetId?: number;
};

export async function fetchMessages({
  chat,
  threadId,
  offsetId,
  isSavedDialog,
  ...pagination
}: {
  chat: ApiChat;
  threadId?: ThreadId;
  offsetId?: number;
  isSavedDialog?: boolean;
  addOffset?: number;
  limit: number;
}) {
  const RequestClass = threadId === MAIN_THREAD_ID
    ? GramJs.messages.GetHistory : isSavedDialog
      ? GramJs.messages.GetSavedHistory : GramJs.messages.GetReplies;
  let result;

  try {
    result = await invokeRequest(new RequestClass({
      peer: buildInputPeer(chat.id, chat.accessHash),
      ...(threadId !== MAIN_THREAD_ID && !isSavedDialog && {
        msgId: Number(threadId),
      }),
      ...(offsetId && {
        // Workaround for local message IDs overflowing some internal `Buffer` range check
        offsetId: Math.min(offsetId, MAX_INT_32),
      }),
      ...pagination,
    }), {
      shouldThrow: true,
      abortControllerChatId: chat.id,
      abortControllerThreadId: threadId,
    });
  } catch (err: any) {
    if (err.errorMessage === 'CHANNEL_PRIVATE') {
      sendApiUpdate({
        '@type': 'updateChat',
        id: chat.id,
        chat: {
          isRestricted: true,
        },
      });
    }
  }

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const count = !(result instanceof GramJs.messages.Messages) && result.count;

  return {
    messages,
    users,
    chats,
    count,
  };
}

export async function fetchMessage({ chat, messageId }: { chat: ApiChat; messageId: number }) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  let result;
  try {
    result = await invokeRequest(
      isChannel
        ? new GramJs.channels.GetMessages({
          channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
          id: [new GramJs.InputMessageID({ id: messageId })],
        })
        : new GramJs.messages.GetMessages({
          id: [new GramJs.InputMessageID({ id: messageId })],
        }),
      {
        shouldThrow: true,
        abortControllerChatId: chat.id,
      },
    );
  } catch (err: any) {
    const { message } = err;

    // When fetching messages for the bot @replies, there may be situations when the user was banned
    // in the comment group or this group was deleted
    if (message !== 'CHANNEL_PRIVATE') {
      sendApiUpdate({
        '@type': 'error',
        error: {
          message,
          isSlowMode: false,
          hasErrorKey: true,
        },
      });
    }
  }

  if (!result || result instanceof GramJs.messages.MessagesNotModified) {
    return undefined;
  }

  if ('pts' in result) {
    updateChannelState(chat.id, result.pts);
  }

  const mtpMessage = result.messages[0];
  if (!mtpMessage) {
    return undefined;
  }

  if (mtpMessage instanceof GramJs.MessageEmpty) {
    return MESSAGE_DELETED;
  }

  processMessageAndUpdateThreadInfo(mtpMessage);
  const message = buildApiMessage(mtpMessage);

  if (!message) {
    return undefined;
  }

  return { message };
}

let mediaQueue = Promise.resolve();

export function sendMessage(
  {
    chat,
    lastMessageId,
    text,
    entities,
    replyInfo,
    attachment,
    sticker,
    story,
    gif,
    poll,
    contact,
    isSilent,
    scheduledAt,
    groupedId,
    noWebPage,
    sendAs,
    shouldUpdateStickerSetOrder,
    wasDrafted,
    isInvertedMedia,
    effectId,
    webPageMediaSize,
    webPageUrl,
  }: {
    chat: ApiChat;
    lastMessageId?: number;
    text?: string;
    entities?: ApiMessageEntity[];
    replyInfo?: ApiInputReplyInfo;
    attachment?: ApiAttachment;
    sticker?: ApiSticker;
    story?: ApiStory | ApiStorySkipped;
    gif?: ApiVideo;
    poll?: ApiNewPoll;
    contact?: ApiContact;
    isSilent?: boolean;
    scheduledAt?: number;
    groupedId?: string;
    noWebPage?: boolean;
    sendAs?: ApiPeer;
    shouldUpdateStickerSetOrder?: boolean;
    wasDrafted?: boolean;
    isInvertedMedia?: true;
    effectId?: string;
    webPageMediaSize?: WebPageMediaSize;
    webPageUrl?: string;
  },
  onProgress?: ApiOnProgress,
) {
  const {
    message: localMessage,
    poll: localPoll,
  } = buildLocalMessage(
    chat,
    lastMessageId,
    text,
    entities,
    replyInfo,
    attachment,
    sticker,
    gif,
    poll,
    contact,
    groupedId,
    scheduledAt,
    sendAs,
    story,
    isInvertedMedia,
    effectId,
  );

  sendApiUpdate({
    '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
    id: localMessage.id,
    chatId: chat.id,
    message: localMessage,
    poll: localPoll,
    wasDrafted,
  });

  // This is expected to arrive after `updateMessageSendSucceeded` which replaces the local ID,
  // so in most cases this will be simply ignored
  const timeout = setTimeout(() => {
    sendApiUpdate({
      '@type': localMessage.isScheduled ? 'updateScheduledMessage' : 'updateMessage',
      id: localMessage.id,
      chatId: chat.id,
      message: {
        sendingState: 'messageSendingStatePending',
      },
    });
  }, FAST_SEND_TIMEOUT);

  const randomId = generateRandomBigInt();

  if (groupedId) {
    return sendGroupedMedia({
      chat,
      text,
      entities,
      replyInfo,
      attachment: attachment!,
      groupedId,
      isSilent,
      scheduledAt,
    }, randomId, localMessage, onProgress);
  }

  const messagePromise = (async () => {
    let media: GramJs.TypeInputMedia | undefined;
    if (attachment) {
      try {
        media = await uploadMedia(localMessage, attachment, onProgress!);
      } catch (err) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(err);
        }

        await mediaQueue;

        return;
      }
    } else if (sticker) {
      media = buildInputMediaDocument(sticker);
    } else if (gif) {
      media = buildInputMediaDocument(gif);
    } else if (poll) {
      media = buildInputPoll(poll, randomId);
    } else if (story) {
      media = buildInputStory(story);
    } else if (webPageUrl && webPageMediaSize) {
      media = new GramJs.InputMediaWebPage({
        url: webPageUrl,
        forceLargeMedia: webPageMediaSize === 'large' ? true : undefined,
        forceSmallMedia: webPageMediaSize === 'small' ? true : undefined,
      });
    } else if (contact) {
      media = new GramJs.InputMediaContact({
        phoneNumber: contact.phoneNumber,
        firstName: contact.firstName,
        lastName: contact.lastName,
        vcard: '',
      });
    }

    const RequestClass = media ? GramJs.messages.SendMedia : GramJs.messages.SendMessage;

    try {
      const update = await invokeRequest(new RequestClass({
        clearDraft: true,
        message: text || '',
        entities: entities ? entities.map(buildMtpMessageEntity) : undefined,
        peer: buildInputPeer(chat.id, chat.accessHash),
        randomId,
        replyTo: replyInfo && buildInputReplyTo(replyInfo),
        ...(isSilent && { silent: isSilent }),
        ...(scheduledAt && { scheduleDate: scheduledAt }),
        ...(media && { media }),
        ...(noWebPage && { noWebpage: noWebPage }),
        ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
        ...(shouldUpdateStickerSetOrder && { updateStickersetsOrder: shouldUpdateStickerSetOrder }),
        ...(isInvertedMedia && { invertMedia: isInvertedMedia }),
        ...(effectId && { effect: BigInt(effectId) }),
      }), {
        shouldThrow: true,
        shouldIgnoreUpdates: true,
      });
      if (update) handleLocalMessageUpdate(localMessage, update);
    } catch (error: any) {
      if (error.errorMessage === 'PRIVACY_PREMIUM_REQUIRED') {
        sendApiUpdate({ '@type': 'updateRequestUserUpdate', id: chat.id });
      }

      sendApiUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: chat.id,
        localId: localMessage.id,
        error: error.message,
      });
      clearTimeout(timeout);
    }
  })();

  return messagePromise;
}

const groupedUploads: Record<string, {
  counter: number;
  singleMediaByIndex: Record<number, GramJs.InputSingleMedia>;
  localMessages: Record<string, ApiMessage>;
}> = {};

function sendGroupedMedia(
  {
    chat,
    text,
    entities,
    replyInfo,
    attachment,
    groupedId,
    isSilent,
    scheduledAt,
    sendAs,
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyInfo?: ApiInputReplyInfo;
    attachment: ApiAttachment;
    groupedId: string;
    isSilent?: boolean;
    scheduledAt?: number;
    sendAs?: ApiPeer;
  },
  randomId: GramJs.long,
  localMessage: ApiMessage,
  onProgress?: ApiOnProgress,
) {
  let groupIndex = -1;
  if (!groupedUploads[groupedId]) {
    groupedUploads[groupedId] = {
      counter: 0,
      singleMediaByIndex: {},
      localMessages: {},
    };
  }

  groupIndex = groupedUploads[groupedId].counter++;

  const prevMediaQueue = mediaQueue;
  mediaQueue = (async () => {
    let media;
    try {
      media = await uploadMedia(localMessage, attachment, onProgress!);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(err);
      }

      groupedUploads[groupedId].counter--;

      await prevMediaQueue;

      return;
    }

    const inputMedia = await fetchInputMedia(
      buildInputPeer(chat.id, chat.accessHash),
      media as GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
    );

    await prevMediaQueue;

    if (!inputMedia) {
      groupedUploads[groupedId].counter--;

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('Failed to upload grouped media');
      }

      return;
    }

    groupedUploads[groupedId].singleMediaByIndex[groupIndex] = new GramJs.InputSingleMedia({
      media: inputMedia,
      randomId,
      message: text || '',
      entities: entities ? entities.map(buildMtpMessageEntity) : undefined,
    });
    groupedUploads[groupedId].localMessages[randomId.toString()] = localMessage;

    if (Object.keys(groupedUploads[groupedId].singleMediaByIndex).length < groupedUploads[groupedId].counter) {
      return;
    }

    const { singleMediaByIndex, localMessages } = groupedUploads[groupedId];
    delete groupedUploads[groupedId];

    const update = await invokeRequest(new GramJs.messages.SendMultiMedia({
      clearDraft: true,
      peer: buildInputPeer(chat.id, chat.accessHash),
      multiMedia: Object.values(singleMediaByIndex), // Object keys are usually ordered
      replyTo: replyInfo && buildInputReplyTo(replyInfo),
      ...(isSilent && { silent: isSilent }),
      ...(scheduledAt && { scheduleDate: scheduledAt }),
      ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
    }), {
      shouldIgnoreUpdates: true,
    });

    if (update) handleMultipleLocalMessagesUpdate(localMessages, update);
  })();

  return mediaQueue;
}

async function fetchInputMedia(
  peer: GramJs.TypeInputPeer,
  uploadedMedia: GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
) {
  const messageMedia = await invokeRequest(new GramJs.messages.UploadMedia({
    peer,
    media: uploadedMedia,
  }));
  const isSpoiler = uploadedMedia.spoiler;

  if ((
    messageMedia instanceof GramJs.MessageMediaPhoto
    && messageMedia.photo
    && messageMedia.photo instanceof GramJs.Photo)
  ) {
    const { photo: { id, accessHash, fileReference } } = messageMedia;

    return new GramJs.InputMediaPhoto({
      id: new GramJs.InputPhoto({ id, accessHash, fileReference }),
      spoiler: isSpoiler,
    });
  }

  if ((
    messageMedia instanceof GramJs.MessageMediaDocument
    && messageMedia.document
    && messageMedia.document instanceof GramJs.Document)
  ) {
    const { document: { id, accessHash, fileReference } } = messageMedia;

    return new GramJs.InputMediaDocument({
      id: new GramJs.InputDocument({ id, accessHash, fileReference }),
      spoiler: isSpoiler,
    });
  }

  return undefined;
}

export async function editMessage({
  chat,
  message,
  text,
  entities,
  attachment,
  noWebPage,
}: {
  chat: ApiChat;
  message: ApiMessage;
  text: string;
  entities?: ApiMessageEntity[];
  attachment?: ApiAttachment;
  noWebPage?: boolean;
}, onProgress?: ApiOnProgress) {
  const isScheduled = message.date * 1000 > Date.now() + getServerTimeOffset() * 1000;

  const media = attachment && buildUploadingMedia(attachment);

  const isInvertedMedia = text && !attachment?.shouldSendAsFile ? message.isInvertedMedia : undefined;

  const newContent = {
    ...(media || message.content),
    ...(text && {
      text: {
        text,
        entities,
      },
    }),
  };

  const messageUpdate: Partial<ApiMessage> = {
    ...message,
    content: newContent,
    isInvertedMedia,
  };

  sendApiUpdate({
    '@type': isScheduled ? 'updateScheduledMessage' : 'updateMessage',
    id: message.id,
    chatId: chat.id,
    message: messageUpdate,
  });

  try {
    let mediaUpdate: GramJs.TypeInputMedia | undefined;
    if (attachment) {
      mediaUpdate = await uploadMedia(message, attachment, onProgress!);
    }

    const mtpEntities = entities && entities.map(buildMtpMessageEntity);

    await invokeRequest(new GramJs.messages.EditMessage({
      message: text || '',
      entities: mtpEntities,
      media: mediaUpdate,
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: message.id,
      ...(isScheduled && { scheduleDate: message.date }),
      ...(noWebPage && { noWebpage: noWebPage }),
      ...(isInvertedMedia && { invertMedia: isInvertedMedia }),
    }), { shouldThrow: true });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(err);
    }

    const { message: messageErr } = err as Error;

    sendApiUpdate({
      '@type': 'error',
      error: {
        message: messageErr,
        hasErrorKey: true,
      },
    });

    // Rollback changes
    sendApiUpdate({
      '@type': isScheduled ? 'updateScheduledMessage' : 'updateMessage',
      id: message.id,
      chatId: chat.id,
      message,
    });
  }
}

export async function rescheduleMessage({
  chat,
  message,
  scheduledAt,
}: {
  chat: ApiChat;
  message: ApiMessage;
  scheduledAt: number;
}) {
  await invokeRequest(new GramJs.messages.EditMessage({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: message.id,
    scheduleDate: scheduledAt,
  }));
}

async function uploadMedia(message: ApiMessage, attachment: ApiAttachment, onProgress: ApiOnProgress) {
  const {
    filename, blobUrl, mimeType, quick, voice, audio, previewBlobUrl, shouldSendAsFile, shouldSendAsSpoiler, ttlSeconds,
  } = attachment;

  const patchedOnProgress: ApiOnProgress = (progress) => {
    if (onProgress.isCanceled) {
      patchedOnProgress.isCanceled = true;
    } else {
      onProgress(progress, getMessageKey(message));
    }
  };

  const fetchAndUpload = async (url: string, progressCallback?: (progress: number) => void) => {
    const file = await fetchFile(url, filename);
    return uploadFile(file, progressCallback);
  };

  const isVideo = SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType);
  const shouldUploadThumb = audio || isVideo || shouldSendAsFile;

  const [inputFile, thumb] = await Promise.all(compact([
    fetchAndUpload(blobUrl, patchedOnProgress),
    shouldUploadThumb && previewBlobUrl && fetchAndUpload(previewBlobUrl),
  ]));

  const attributes: GramJs.TypeDocumentAttribute[] = [new GramJs.DocumentAttributeFilename({ fileName: filename })];
  if (!shouldSendAsFile) {
    if (quick) {
      if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType) && mimeType !== GIF_MIME_TYPE) {
        return new GramJs.InputMediaUploadedPhoto({
          file: inputFile,
          spoiler: shouldSendAsSpoiler,
        });
      }

      if (isVideo) {
        const { width, height, duration } = quick;
        if (duration !== undefined) {
          attributes.push(new GramJs.DocumentAttributeVideo({
            duration,
            w: width,
            h: height,
            supportsStreaming: true,
          }));
        }
      }
    }

    if (audio) {
      const { duration, title, performer } = audio;
      attributes.push(new GramJs.DocumentAttributeAudio({
        duration,
        title,
        performer,
      }));
    }

    if (voice) {
      const { duration, waveform } = voice;
      const { data: inputWaveform } = interpolateArray(waveform, INPUT_WAVEFORM_LENGTH);
      attributes.push(new GramJs.DocumentAttributeAudio({
        voice: true,
        duration,
        waveform: Buffer.from(inputWaveform),
      }));
    }
  }

  return new GramJs.InputMediaUploadedDocument({
    file: inputFile,
    mimeType,
    attributes,
    thumb,
    forceFile: shouldSendAsFile,
    spoiler: shouldSendAsSpoiler,
    ttlSeconds,
  });
}

export async function pinMessage({
  chat, messageId, isUnpin, isOneSide, isSilent,
}: { chat: ApiChat; messageId: number; isUnpin: boolean; isOneSide?: boolean; isSilent?: boolean }) {
  await invokeRequest(new GramJs.messages.UpdatePinnedMessage({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageId,
    ...(isUnpin && { unpin: true }),
    ...(isOneSide && { pmOneside: true }),
    ...(isSilent && { silent: true }),
  }));
}

export async function unpinAllMessages({ chat, threadId }: { chat: ApiChat; threadId?: ThreadId }) {
  const result = await invokeRequest(new GramJs.messages.UnpinAllMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
    ...(threadId && { topMsgId: Number(threadId) }),
  }));

  if (!result) return;

  processAffectedHistory(chat, result);

  if (result.offset) {
    await unpinAllMessages({ chat, threadId });
  }
}

export async function deleteMessages({
  chat, messageIds, shouldDeleteForAll,
}: {
  chat: ApiChat; messageIds: number[]; shouldDeleteForAll?: boolean;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  const result = await invokeRequest(
    isChannel
      ? new GramJs.channels.DeleteMessages({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        id: messageIds,
      })
      : new GramJs.messages.DeleteMessages({
        id: messageIds,
        ...(shouldDeleteForAll && { revoke: true }),
      }),
  );

  if (!result) {
    return;
  }

  processAffectedHistory(chat, result);

  sendApiUpdate({
    '@type': 'deleteMessages',
    ids: messageIds,
    ...(isChannel && { chatId: chat.id }),
  });
}

export async function deleteParticipantHistory({
  chat, peer, isRepeat = false,
}: {
  chat: ApiChat; peer: ApiPeer; isRepeat?: boolean;
}) {
  const result = await invokeRequest(
    new GramJs.channels.DeleteParticipantHistory({
      channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      participant: buildInputPeer(peer.id, peer.accessHash),
    }),
  );

  if (!result) {
    return;
  }

  processAffectedHistory(chat, result);

  if (!isRepeat) {
    sendApiUpdate({
      '@type': 'deleteParticipantHistory',
      chatId: chat.id,
      peerId: peer.id,
    });
  }

  if (result.offset) {
    await deleteParticipantHistory({ chat, peer, isRepeat: true });
  }
}

export function deleteScheduledMessages({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  invokeRequest(new GramJs.messages.DeleteScheduledMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageIds,
  }));
}

export async function deleteHistory({
  chat, shouldDeleteForAll,
}: {
  chat: ApiChat; shouldDeleteForAll?: boolean; maxId?: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';
  const result = await invokeRequest(
    isChannel
      ? new GramJs.channels.DeleteHistory({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      })
      : new GramJs.messages.DeleteHistory({
        peer: buildInputPeer(chat.id, chat.accessHash),
        ...(shouldDeleteForAll && { revoke: true }),
        ...(!shouldDeleteForAll && { just_clear: true }),
      }),
  );

  if (!result) {
    return;
  }

  if ('offset' in result) {
    processAffectedHistory(chat, result);

    if (result.offset) {
      await deleteHistory({ chat, shouldDeleteForAll });
      return;
    }
  }

  sendApiUpdate({
    '@type': 'deleteHistory',
    chatId: chat.id,
  });
}

export async function deleteSavedHistory({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.messages.DeleteSavedHistory({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) {
    return;
  }

  processAffectedHistory(chat, result);

  if (result.offset) {
    await deleteSavedHistory({ chat });
    return;
  }

  sendApiUpdate({
    '@type': 'deleteSavedHistory',
    chatId: chat.id,
  });
}

export async function reportMessages({
  peer, messageIds, description, option,
}: {
  peer: ApiPeer; messageIds: number[]; description: string; option: string;
}) {
  try {
    const result = await invokeRequest(new GramJs.messages.Report({
      peer: buildInputPeer(peer.id, peer.accessHash),
      id: messageIds,
      option: deserializeBytes(option),
      message: description,
    }), { shouldThrow: true });

    if (!result) return undefined;

    return { result: buildApiReportResult(result), error: undefined };
  } catch (err: any) {
    const errorMessage = (err as ApiError).message;

    if (errorMessage === MESSAGE_ID_REQUIRED_ERROR) {
      return {
        result: undefined,
        error: errorMessage,
      };
    }

    throw err;
  }
}

export function reportChannelSpam({
  peer, chat, messageIds,
}: {
  peer: ApiPeer; chat: ApiChat; messageIds: number[];
}) {
  return invokeRequest(new GramJs.channels.ReportSpam({
    participant: buildInputPeer(peer.id, peer.accessHash),
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    id: messageIds,
  }));
}

export async function sendMessageAction({
  peer, threadId, action,
}: {
  peer: ApiPeer; threadId?: ThreadId; action: ApiSendMessageAction;
}) {
  const gramAction = buildSendMessageAction(action);
  if (!gramAction) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Unsupported message action', action);
    }
    return undefined;
  }

  try {
    const result = await invokeRequest(new GramJs.messages.SetTyping({
      peer: buildInputPeer(peer.id, peer.accessHash),
      topMsgId: Number(threadId),
      action: gramAction,
    }), {
      shouldThrow: true,
      abortControllerChatId: peer.id,
      abortControllerThreadId: threadId,
    });
    return result;
  } catch (error) {
    // Prevent error from being displayed in UI
  }
  return undefined;
}

export async function markMessageListRead({
  chat, threadId, maxId = 0,
}: {
  chat: ApiChat; threadId: ThreadId; maxId?: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  // Workaround for local message IDs overflowing some internal `Buffer` range check
  const fixedMaxId = Math.min(maxId, MAX_INT_32);
  if (isChannel && threadId === MAIN_THREAD_ID) {
    await invokeRequest(new GramJs.channels.ReadHistory({
      channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      maxId: fixedMaxId,
    }));
  } else if (isChannel) {
    await invokeRequest(new GramJs.messages.ReadDiscussion({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: Number(threadId),
      readMaxId: fixedMaxId,
    }));
  } else {
    const result = await invokeRequest(new GramJs.messages.ReadHistory({
      peer: buildInputPeer(chat.id, chat.accessHash),
      maxId: fixedMaxId,
    }));

    if (result) {
      processAffectedHistory(chat, result);
    }
  }

  if (threadId === MAIN_THREAD_ID) {
    void requestChatUpdate({ chat, noLastMessage: true });
  } else if (chat.isForum) {
    sendApiUpdate({
      '@type': 'updateTopic',
      chatId: chat.id,
      topicId: Number(threadId),
    });
  }
}

export async function markMessagesRead({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  const result = await invokeRequest(
    isChannel
      ? new GramJs.channels.ReadMessageContents({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        id: messageIds,
      })
      : new GramJs.messages.ReadMessageContents({
        id: messageIds,
      }),
  );

  if (!result) {
    return;
  }

  if (result !== true) {
    processAffectedHistory(chat, result);
  }

  sendApiUpdate({
    ...(isChannel ? {
      '@type': 'updateChannelMessages',
      channelId: chat.id,
    } : {
      '@type': 'updateCommonBoxMessages',
    }),
    ids: messageIds,
    messageUpdate: {
      hasUnreadMention: false,
      isMediaUnread: false,
    },
  });
}

export async function fetchMessageViews({
  chat, ids, shouldIncrement,
}: {
  chat: ApiChat;
  ids: number[];
  shouldIncrement?: boolean;
}) {
  const chunks = split(ids, API_GENERAL_ID_LIMIT);
  const results = await Promise.all(chunks.map((chunkIds) => (
    invokeRequest(new GramJs.messages.GetMessagesViews({
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: chunkIds,
      increment: shouldIncrement,
    }))
  )));

  if (!results || results.some((result) => !result)) return undefined;

  const viewsList = results.flatMap((result) => result!.views);

  const viewsInfo = ids.map((id, index) => {
    const { views, forwards, replies } = viewsList[index];
    return {
      id,
      views,
      forwards,
      threadInfo: replies ? buildApiThreadInfo(replies, id, chat.id) : undefined,
    };
  });

  return {
    viewsInfo,
  };
}

export async function fetchFactChecks({
  chat, ids,
}: {
  chat: ApiChat;
  ids: number[];
}) {
  const chunks = split(ids, API_GENERAL_ID_LIMIT);
  const results = await Promise.all(chunks.map((chunkIds) => (
    invokeRequest(new GramJs.messages.GetFactCheck({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: chunkIds,
    }))
  )));

  if (!results || results.some((result) => !result)) return undefined;

  return results.flatMap((result) => result!).map(buildApiFactCheck);
}

export function fetchPaidReactionPrivacy() {
  return invokeRequest(new GramJs.messages.GetPaidReactionPrivacy(), { shouldReturnTrue: true });
}

export function reportMessagesDelivery({
  chat, messageIds,
}: {
  chat: ApiChat;
  messageIds: number[];
}) {
  return invokeRequest(new GramJs.messages.ReportMessagesDelivery({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageIds,
  }));
}

export async function fetchDiscussionMessage({
  chat, messageId,
}: {
  chat: ApiChat;
  messageId: number;
}) {
  const [result, replies] = await Promise.all([
    invokeRequest(new GramJs.messages.GetDiscussionMessage({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: messageId,
    }), {
      abortControllerChatId: chat.id,
      abortControllerThreadId: messageId,
    }),
    fetchMessages({
      chat,
      threadId: messageId,
      offsetId: 1,
      addOffset: -1,
      limit: 1,
    }),
  ]);

  if (!result || !replies) return undefined;

  const topMessages = result.messages.map(buildApiMessage).filter(Boolean);
  const messages = topMessages.concat(replies.messages);
  const threadId = result.messages[result.messages.length - 1]?.id;

  if (!threadId) return undefined;

  const {
    unreadCount, maxId, readInboxMaxId, readOutboxMaxId,
  } = result;

  return {
    messages,
    topMessages,
    unreadCount,
    threadId,
    lastReadInboxMessageId: readInboxMaxId,
    lastReadOutboxMessageId: readOutboxMaxId,
    lastMessageId: maxId,
    chatId: topMessages[0]?.chatId,
    firstMessageId: replies.messages[0]?.id,
  };
}

export async function searchMessagesInChat({
  peer, isSavedDialog, savedTag, type, query = '', threadId, minDate, maxDate, ...pagination
}: {
  peer: ApiPeer;
  isSavedDialog?: boolean;
  savedTag?: ApiReaction;
  type?: ApiMessageSearchType | ApiGlobalMessageSearchType;
  query?: string;
  threadId?: ThreadId;
  offsetId?: number;
  addOffset?: number;
  limit: number;
  minDate?: number;
  maxDate?: number;
}): Promise<SearchResults | undefined> {
  let filter;
  switch (type) {
    case 'media':
      filter = new GramJs.InputMessagesFilterPhotoVideo();
      break;
    case 'documents':
      filter = new GramJs.InputMessagesFilterDocument();
      break;
    case 'links':
      filter = new GramJs.InputMessagesFilterUrl();
      break;
    case 'audio':
      filter = new GramJs.InputMessagesFilterMusic();
      break;
    case 'voice':
      filter = new GramJs.InputMessagesFilterRoundVoice();
      break;
    case 'profilePhoto':
      filter = new GramJs.InputMessagesFilterChatPhotos();
      break;
    case 'text':
    default: {
      filter = new GramJs.InputMessagesFilterEmpty();
    }
  }

  const inputPeer = buildInputPeer(peer.id, peer.accessHash);

  const result = await invokeRequest(new GramJs.messages.Search({
    peer: isSavedDialog ? new GramJs.InputPeerSelf() : inputPeer,
    savedPeerId: isSavedDialog ? inputPeer : undefined,
    savedReaction: savedTag && [buildInputReaction(savedTag)],
    topMsgId: threadId !== MAIN_THREAD_ID && !isSavedDialog ? Number(threadId) : undefined,
    filter,
    q: query,
    minDate,
    maxDate,
    ...pagination,
  }), {
    abortControllerChatId: peer.id,
    abortControllerThreadId: threadId,
  });

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const userStatusesById = buildApiUserStatuses(result.users);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  let nextOffsetId: number | undefined;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;

    if (messages.length) {
      nextOffsetId = messages[messages.length - 1].id;
    }
  }

  return {
    userStatusesById,
    messages,
    totalCount,
    nextOffsetId,
  };
}

export async function searchMessagesGlobal({
  query, offsetRate = 0, offsetPeer, offsetId, limit, type = 'text', minDate, maxDate, context = 'all',
}: {
  query: string;
  offsetRate?: number;
  offsetPeer?: ApiPeer;
  offsetId?: number;
  limit: number;
  type?: ApiGlobalMessageSearchType;
  context?: ApiMessageSearchContext;
  minDate?: number;
  maxDate?: number;
}): Promise<SearchResults | undefined> {
  let filter;
  switch (type) {
    case 'media':
      filter = new GramJs.InputMessagesFilterPhotoVideo();
      break;
    case 'documents':
      filter = new GramJs.InputMessagesFilterDocument();
      break;
    case 'links':
      filter = new GramJs.InputMessagesFilterUrl();
      break;
    case 'audio':
      filter = new GramJs.InputMessagesFilterMusic();
      break;
    case 'voice':
      filter = new GramJs.InputMessagesFilterRoundVoice();
      break;
    case 'text':
    default: {
      if (!query && !(maxDate && minDate)) {
        return undefined;
      }

      filter = new GramJs.InputMessagesFilterEmpty();
    }
  }

  const peer = (offsetPeer && buildInputPeer(offsetPeer.id, offsetPeer.accessHash)) || new GramJs.InputPeerEmpty();

  const result = await invokeRequest(new GramJs.messages.SearchGlobal({
    q: query,
    offsetRate,
    offsetPeer: peer,
    offsetId,
    broadcastsOnly: type === 'channels' || context === 'channels' || undefined,
    groupsOnly: context === 'groups' || undefined,
    usersOnly: context === 'users' || undefined,
    limit,
    filter,
    minDate,
    maxDate,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const userStatusesById = buildApiUserStatuses(result.users);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;
  } else {
    totalCount = result.messages.length;
  }

  const lastMessage = result.messages[result.messages.length - 1];
  const nextOffsetPeerId = resolveMessageApiChatId(lastMessage);
  const nextOffsetRate = 'nextRate' in result && result.nextRate ? result.nextRate : undefined;
  const nextOffsetId = lastMessage?.id;

  return {
    messages,
    userStatusesById,
    totalCount,
    nextOffsetRate,
    nextOffsetPeerId,
    nextOffsetId,
  };
}

export async function searchHashtagPosts({
  hashtag, offsetRate, offsetPeer, offsetId, limit,
}: {
  hashtag: string;
  offsetRate?: number;
  offsetPeer?: ApiPeer;
  offsetId?: number;
  limit?: number;
}): Promise<SearchResults | undefined> {
  const peer = (offsetPeer && buildInputPeer(offsetPeer.id, offsetPeer.accessHash)) || new GramJs.InputPeerEmpty();
  const result = await invokeRequest(new GramJs.channels.SearchPosts({
    hashtag,
    offsetRate,
    offsetId,
    offsetPeer: peer,
    limit,
  }));

  if (!result || result instanceof GramJs.messages.MessagesNotModified) {
    return undefined;
  }

  const userStatusesById = buildApiUserStatuses(result.users);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;
  } else {
    totalCount = result.messages.length;
  }

  const lastMessage = result.messages[result.messages.length - 1];
  const nextOffsetPeerId = resolveMessageApiChatId(lastMessage);
  const nextOffsetRate = 'nextRate' in result && result.nextRate ? result.nextRate : undefined;
  const nextOffsetId = lastMessage?.id;

  return {
    messages,
    userStatusesById,
    totalCount,
    nextOffsetRate,
    nextOffsetPeerId,
    nextOffsetId,
  };
}

export async function fetchWebPagePreview({
  text,
}: {
  text: ApiFormattedText;
}) {
  const textWithEntities = buildInputTextWithEntities(text);
  const preview = await invokeRequest(new GramJs.messages.GetWebPagePreview({
    message: textWithEntities.text,
    entities: textWithEntities.entities,
  }));

  return preview && buildWebPage(preview.media);
}

export async function sendPollVote({
  chat, messageId, options,
}: {
  chat: ApiChat;
  messageId: number;
  options: string[];
}) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.SendVote({
    peer: buildInputPeer(id, accessHash),
    msgId: messageId,
    options: options.map(deserializeBytes),
  }));
}

export async function closePoll({
  chat, messageId, poll,
}: {
  chat: ApiChat;
  messageId: number;
  poll: ApiPoll;
}) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.EditMessage({
    peer: buildInputPeer(id, accessHash),
    id: messageId,
    media: buildInputPollFromExisting(poll, true),
  }));
}

export async function loadPollOptionResults({
  chat, messageId, option, offset, limit, shouldResetVoters,
}: {
  chat: ApiChat;
  messageId: number;
  option?: string;
  offset?: string;
  limit?: number;
  shouldResetVoters?: boolean;
}) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetPollVotes({
    peer: buildInputPeer(id, accessHash),
    id: messageId,
    ...(option && { option: deserializeBytes(option) }),
    ...(offset && { offset }),
    ...(limit && { limit }),
  }));

  if (!result) {
    return undefined;
  }

  const votes = result.votes.map((vote) => ({
    peerId: getApiChatIdFromMtpPeer(vote.peer),
    date: vote.date,
  }));

  return {
    count: result.count,
    votes,
    nextOffset: result.nextOffset,
    shouldResetVoters,
  };
}

export async function fetchExtendedMedia({
  chat, ids,
}: {
  chat: ApiChat;
  ids: number[];
}) {
  await invokeRequest(new GramJs.messages.GetExtendedMedia({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: ids,
  }));
}

export async function forwardMessages({
  fromChat,
  toChat,
  toThreadId,
  messages,
  isSilent,
  scheduledAt,
  sendAs,
  withMyScore,
  noAuthors,
  noCaptions,
  isCurrentUserPremium,
  wasDrafted,
  lastMessageId,
}: {
  fromChat: ApiChat;
  toChat: ApiChat;
  toThreadId?: ThreadId;
  messages: ApiMessage[];
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiPeer;
  withMyScore?: boolean;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
  wasDrafted?: boolean;
  lastMessageId?: number;
}) {
  const messageIds = messages.map(({ id }) => id);
  const randomIds = messages.map(generateRandomBigInt);
  const localMessages: Record<string, ApiMessage> = {};

  messages.forEach((message, index) => {
    const localMessage = buildLocalForwardedMessage({
      toChat,
      toThreadId: Number(toThreadId),
      message,
      scheduledAt,
      noAuthors,
      noCaptions,
      isCurrentUserPremium,
      lastMessageId,
      sendAs,
    });
    localMessages[randomIds[index].toString()] = localMessage;

    sendApiUpdate({
      '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
      id: localMessage.id,
      chatId: toChat.id,
      message: localMessage,
      wasDrafted,
    });
  });

  try {
    const update = await invokeRequest(new GramJs.messages.ForwardMessages({
      fromPeer: buildInputPeer(fromChat.id, fromChat.accessHash),
      toPeer: buildInputPeer(toChat.id, toChat.accessHash),
      randomId: randomIds,
      id: messageIds,
      withMyScore: withMyScore || undefined,
      silent: isSilent || undefined,
      dropAuthor: noAuthors || undefined,
      dropMediaCaptions: noCaptions || undefined,
      ...(toThreadId && { topMsgId: Number(toThreadId) }),
      ...(scheduledAt && { scheduleDate: scheduledAt }),
      ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
    }), {
      shouldThrow: true,
      shouldIgnoreUpdates: true,
    });
    if (update) handleMultipleLocalMessagesUpdate(localMessages, update);
  } catch (error: any) {
    Object.values(localMessages).forEach((localMessage) => {
      sendApiUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: toChat.id,
        localId: localMessage.id,
        error: error.message,
      });
    });
  }
}

export async function findFirstMessageIdAfterDate({
  chat,
  timestamp,
}: {
  chat: ApiChat;
  timestamp: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetHistory({
    peer: buildInputPeer(chat.id, chat.accessHash),
    offsetDate: timestamp,
    addOffset: -1,
    limit: 1,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages || !result.messages.length
  ) {
    return undefined;
  }

  return result.messages[0].id;
}

export async function fetchScheduledHistory({ chat }: { chat: ApiChat }) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetScheduledHistory({
    peer: buildInputPeer(id, accessHash),
  }), {
    abortControllerChatId: id,
  });

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
  };
}

export async function sendScheduledMessages({ chat, ids }: { chat: ApiChat; ids: number[] }) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.SendScheduledMessages({
    peer: buildInputPeer(id, accessHash),
    id: ids,
  }));
}

export async function fetchPinnedMessages({ chat, threadId }: { chat: ApiChat; threadId: ThreadId }) {
  const result = await invokeRequest(new GramJs.messages.Search(
    {
      peer: buildInputPeer(chat.id, chat.accessHash),
      filter: new GramJs.InputMessagesFilterPinned(),
      q: '',
      limit: PINNED_MESSAGES_LIMIT,
      topMsgId: Number(threadId),
    },
  ), {
    abortControllerChatId: chat.id,
    abortControllerThreadId: threadId,
  });

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
  };
}

export async function fetchSeenBy({ chat, messageId }: { chat: ApiChat; messageId: number }) {
  const result = await invokeRequest(new GramJs.messages.GetMessageReadParticipants({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
  }));

  return result
    ? result.reduce((acc, readDate) => {
      acc[readDate.userId.toString()] = readDate.date;

      return acc;
    }, {} as Record<string, number>)
    : undefined;
}

export async function fetchSendAs({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.channels.GetSendAs({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), {
    shouldIgnoreErrors: true,
    abortControllerChatId: chat.id,
  });

  if (!result) {
    return undefined;
  }

  return {
    sendAs: result.peers.map(buildApiSendAsPeerId),
  };
}

export function saveDefaultSendAs({
  sendAs, chat,
}: {
  sendAs: ApiPeer; chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.SaveDefaultSendAs({
    peer: buildInputPeer(chat.id, chat.accessHash),
    sendAs: buildInputPeer(sendAs.id, sendAs.accessHash),
  }));
}

export async function fetchSponsoredMessages({ peer }: { peer: ApiPeer }) {
  const result = await invokeRequest(new GramJs.messages.GetSponsoredMessages({
    peer: buildInputPeer(peer.id, peer.accessHash),
  }));

  if (!result || result instanceof GramJs.messages.SponsoredMessagesEmpty || !result.messages.length) {
    return undefined;
  }

  const messages = result.messages
    .map((message) => buildApiSponsoredMessage(message, peer.id))
    .filter(Boolean);

  return {
    messages,
  };
}

export async function viewSponsoredMessage({ peer, random }: { peer: ApiPeer; random: string }) {
  await invokeRequest(new GramJs.messages.ViewSponsoredMessage({
    peer: buildInputPeer(peer.id, peer.accessHash),
    randomId: deserializeBytes(random),
  }));
}

export function clickSponsoredMessage({
  peer,
  random,
  isMedia,
  isFullscreen,
}: {
  peer: ApiPeer;
  random: string;
  isMedia?: boolean;
  isFullscreen?: boolean;
}) {
  return invokeRequest(new GramJs.messages.ClickSponsoredMessage({
    media: isMedia || undefined,
    fullscreen: isFullscreen || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    randomId: deserializeBytes(random),
  }));
}

export async function reportSponsoredMessage({
  peer,
  randomId,
  option,
}: {
  peer: ApiPeer;
  randomId: string;
  option: string;
}) {
  try {
    const result = await invokeRequest(new GramJs.messages.ReportSponsoredMessage({
      peer: buildInputPeer(peer.id, peer.accessHash),
      randomId: deserializeBytes(randomId),
      option: deserializeBytes(option),
    }), {
      shouldThrow: true,
    });

    if (!result) {
      return undefined;
    }

    return buildApiSponsoredMessageReportResult(result);
  } catch (err: unknown) {
    if (err instanceof RPCError && err.errorMessage === 'PREMIUM_ACCOUNT_REQUIRED') {
      return {
        type: 'premiumRequired' as const,
      };
    }
    return undefined;
  }
}

export async function readAllMentions({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.messages.ReadMentions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) return;

  processAffectedHistory(chat, result);

  if (result.offset) {
    await readAllMentions({ chat });
  }
}

export async function readAllReactions({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.messages.ReadReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) return;

  processAffectedHistory(chat, result);

  if (result.offset) {
    await readAllReactions({ chat });
  }
}

export async function fetchUnreadMentions({
  chat, ...pagination
}: {
  chat: ApiChat;
  offsetId?: number;
  addOffset?: number;
  maxId?: number;
  minId?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetUnreadMentions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    limit: MENTION_UNREAD_SLICE,
    ...pagination,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
  };
}

export async function fetchUnreadReactions({
  chat, ...pagination
}: {
  chat: ApiChat;
  offsetId?: number;
  addOffset?: number;
  maxId?: number;
  minId?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetUnreadReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    limit: REACTION_UNREAD_SLICE,
    ...pagination,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
  };
}

export async function transcribeAudio({
  chat, messageId,
}: {
  chat: ApiChat; messageId: number;
}) {
  const result = await invokeRequest(new GramJs.messages.TranscribeAudio({
    msgId: messageId,
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) return undefined;

  sendApiUpdate({
    '@type': 'updateTranscribedAudio',
    isPending: result.pending,
    transcriptionId: result.transcriptionId.toString(),
    text: result.text,
  });

  return result.transcriptionId.toString();
}

export async function translateText(params: TranslateTextParams) {
  let result;
  const isMessageTranslation = 'chat' in params;
  if (isMessageTranslation) {
    const { chat, messageIds, toLanguageCode } = params;
    result = await invokeRequest(new GramJs.messages.TranslateText({
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: messageIds,
      toLang: toLanguageCode,
    }));
  } else {
    const { text, toLanguageCode } = params;
    result = await invokeRequest(new GramJs.messages.TranslateText({
      text: text.map((t) => buildInputTextWithEntities(t)),
      toLang: toLanguageCode,
    }));
  }

  if (!result) return undefined;

  const formattedText = result.result.map((r) => buildApiFormattedText(r));

  if (isMessageTranslation) {
    sendApiUpdate({
      '@type': 'updateMessageTranslations',
      chatId: params.chat.id,
      messageIds: params.messageIds,
      translations: formattedText,
      toLanguageCode: params.toLanguageCode,
    });
  }

  return formattedText;
}

function handleMultipleLocalMessagesUpdate(
  localMessages: Record<string, ApiMessage>, update: GramJs.TypeUpdates,
) {
  if (!('updates' in update)) {
    handleGramJsUpdate(update);
    return;
  }

  const updateMessageIds = update.updates.filter((u): u is GramJs.UpdateMessageID => (
    u instanceof GramJs.UpdateMessageID
  ));

  // Server can return `UpdateNewScheduledMessage` that we currently process as video that requires processing
  updateMessageIds.forEach((updateMessageId) => {
    const updateNewScheduledMessage = update.updates
      .find((scheduledUpdate): scheduledUpdate is GramJs.UpdateNewScheduledMessage => {
        if (!(scheduledUpdate instanceof GramJs.UpdateNewScheduledMessage)) return false;
        return scheduledUpdate.message.id === updateMessageId.id;
      });

    const localMessage = localMessages[updateMessageId.randomId.toString()];
    handleLocalMessageUpdate(localMessage, updateMessageId, updateNewScheduledMessage);
  });

  const otherUpdates = update.updates.filter((u) => {
    if (u instanceof GramJs.UpdateMessageID) return false;
    if (u instanceof GramJs.UpdateNewScheduledMessage) return false;
    return true;
  });

  // Illegal monkey patching. Easier than creating mock update object
  update.updates = otherUpdates;

  handleGramJsUpdate(update);
}

function handleLocalMessageUpdate(
  localMessage: ApiMessage, update: GramJs.TypeUpdates, scheduledMessageUpdate?: GramJs.UpdateNewScheduledMessage,
) {
  let messageUpdate;
  if (update instanceof GramJs.UpdateShortSentMessage || update instanceof GramJs.UpdateMessageID) {
    messageUpdate = update;
  } else if ('updates' in update) {
    messageUpdate = update.updates.find((u): u is GramJs.UpdateMessageID => u instanceof GramJs.UpdateMessageID);
    scheduledMessageUpdate = update.updates.find((u): u is GramJs.UpdateNewScheduledMessage => (
      u instanceof GramJs.UpdateNewScheduledMessage
    ));
  }

  if (!messageUpdate) {
    handleGramJsUpdate(update);
    return;
  }

  let newContent: MediaContent | undefined;
  let poll: ApiPoll | undefined;
  if (messageUpdate instanceof GramJs.UpdateShortSentMessage) {
    if (localMessage.content.text && messageUpdate.entities) {
      newContent = {
        text: buildMessageTextContent(localMessage.content.text.text, messageUpdate.entities),
      };
    }
    if (messageUpdate.media) {
      newContent = {
        ...newContent,
        ...buildMessageMediaContent(messageUpdate.media, {
          peerId: buildPeer(localMessage.chatId), id: messageUpdate.id,
        }),
      };
      poll = buildPollFromMedia(messageUpdate.media);
    }

    const mtpMessage = buildMessageFromUpdate(messageUpdate.id, localMessage.chatId, messageUpdate);
    processMessageAndUpdateThreadInfo(mtpMessage);
  }

  const newScheduledMessage = scheduledMessageUpdate?.message && buildApiMessage(scheduledMessageUpdate.message);

  // Edge case for "Send When Online"
  const isSentBefore = 'date' in messageUpdate && messageUpdate.date < getServerTime();

  if (newScheduledMessage?.isVideoProcessingPending) {
    sendApiUpdate({
      '@type': 'updateVideoProcessingPending',
      chatId: localMessage.chatId,
      localId: localMessage.id,
      newScheduledMessageId: newScheduledMessage?.id,
    });
  } else {
    const updatedMessage: ApiMessage = {
      ...localMessage,
      ...(newContent && {
        content: {
          ...localMessage.content,
          ...newContent,
        },
      }),
      id: messageUpdate.id,
      sendingState: undefined,
      ...('date' in messageUpdate && { date: messageUpdate.date }),
    };

    sendApiUpdate({
      '@type': localMessage.isScheduled && !isSentBefore
        ? 'updateScheduledMessageSendSucceeded'
        : 'updateMessageSendSucceeded',
      chatId: localMessage.chatId,
      localId: localMessage.id,
      message: updatedMessage,
      poll,
    });
  }

  handleGramJsUpdate(update);
}

export async function fetchOutboxReadDate({ chat, messageId }: { chat: ApiChat; messageId: number }) {
  const { id, accessHash } = chat;
  const peer = buildInputPeer(id, accessHash);

  const result = await invokeRequest(new GramJs.messages.GetOutboxReadDate({
    peer: peer as GramJs.TypeInputPeer,
    msgId: messageId,
  }), { shouldThrow: true });

  if (!result) return undefined;

  return { date: result.date };
}

export async function fetchQuickReplies() {
  const result = await invokeRequest(new GramJs.messages.GetQuickReplies({}));
  if (!result || result instanceof GramJs.messages.QuickRepliesNotModified) return undefined;

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  const quickReplies = result.quickReplies.map(buildApiQuickReply);

  return {
    messages,
    quickReplies,
  };
}

export async function sendQuickReply({
  chat,
  shortcutId,
}: {
  chat: ApiChat;
  shortcutId: number;
}) {
  // Remove this request when the client fully supports quick replies and caches them
  const messages = await invokeRequest(new GramJs.messages.GetQuickReplyMessages({
    shortcutId,
  }));
  if (!messages || messages instanceof GramJs.messages.MessagesNotModified) return;

  const ids = messages.messages.map((m) => m.id);
  const randomIds = ids.map(generateRandomBigInt);

  const result = await invokeRequest(new GramJs.messages.SendQuickReplyMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
    shortcutId,
    id: ids,
    randomId: randomIds,
  }), {
    shouldIgnoreUpdates: true,
  });

  if (!result) return;

  // Hack to prevent client from thinking that those messages were local
  if ('updates' in result) {
    const filteredUpdates = result.updates
      .filter((u): u is GramJs.UpdateMessageID => !(u instanceof GramJs.UpdateMessageID));
    result.updates = filteredUpdates;
  }

  handleGramJsUpdate(result);
}

export async function exportMessageLink({
  id, chat, shouldIncludeThread, shouldIncludeGrouped,
}: {
  id: number;
  chat: ApiChat;
  shouldIncludeThread?: boolean;
  shouldIncludeGrouped?: boolean;
}) {
  const result = await invokeRequest(new GramJs.channels.ExportMessageLink({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    id,
    thread: shouldIncludeThread || undefined,
    grouped: shouldIncludeGrouped || undefined,
  }));

  return result?.link;
}
