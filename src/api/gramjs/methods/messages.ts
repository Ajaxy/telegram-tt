import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAttachment,
  ApiChat,
  ApiContact,
  ApiFormattedText,
  ApiGlobalMessageSearchType,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageSearchType,
  ApiNewPoll,
  ApiOnProgress,
  ApiPeer,
  ApiPoll,
  ApiReportReason,
  ApiSendMessageAction,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiTypeReplyTo,
  ApiVideo,
  OnApiUpdate,
} from '../../types';
import {
  MAIN_THREAD_ID,
  MESSAGE_DELETED,
} from '../../types';

import {
  ALL_FOLDER_ID,
  DEBUG, GIF_MIME_TYPE, MAX_INT_32, MENTION_UNREAD_SLICE,
  PINNED_MESSAGES_LIMIT, REACTION_UNREAD_SLICE,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getEmojiOnlyCountForMessage } from '../../../global/helpers/getEmojiOnlyCountForMessage';
import { fetchFile } from '../../../util/files';
import { compact } from '../../../util/iteratees';
import { getServerTimeOffset } from '../../../util/serverTime';
import { interpolateArray } from '../../../util/waveform';
import { buildApiChatFromPreview, buildApiSendAsPeerId } from '../apiBuilders/chats';
import { buildApiFormattedText } from '../apiBuilders/common';
import {
  buildMessageMediaContent, buildMessageTextContent, buildWebPage,
} from '../apiBuilders/messageContent';
import {
  buildApiMessage,
  buildApiSponsoredMessage,
  buildLocalForwardedMessage,
  buildLocalMessage,
} from '../apiBuilders/messages';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputEntity,
  buildInputMediaDocument,
  buildInputPeer,
  buildInputPoll,
  buildInputPollFromExisting,
  buildInputReplyTo,
  buildInputReportReason,
  buildInputStory,
  buildInputTextWithEntities,
  buildMessageFromUpdate,
  buildMtpMessageEntity,
  buildSendMessageAction,
  generateRandomBigInt,
  getEntityTypeById,
  isMessageWithMedia,
  isServiceMessageWithMedia,
} from '../gramjsBuilders';
import {
  addEntitiesToLocalDb,
  addMessageToLocalDb,
  deserializeBytes,
  resolveMessageApiChatId,
} from '../helpers';
import { updateChannelState } from '../updateManager';
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

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchMessages({
  chat,
  threadId,
  offsetId,
  ...pagination
}: {
  chat: ApiChat;
  threadId?: number;
  offsetId?: number;
  addOffset?: number;
  limit: number;
}) {
  const RequestClass = threadId === MAIN_THREAD_ID ? GramJs.messages.GetHistory : GramJs.messages.GetReplies;
  let result;

  try {
    result = await invokeRequest(new RequestClass({
      peer: buildInputPeer(chat.id, chat.accessHash),
      ...(threadId !== MAIN_THREAD_ID && {
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
    if (err.message === 'CHANNEL_PRIVATE') {
      onUpdate({
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

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const repliesThreadInfos = messages.map(({ repliesThreadInfo }) => repliesThreadInfo).filter(Boolean);

  return {
    messages,
    users,
    chats,
    repliesThreadInfos,
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
      onUpdate({
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

  const message = mtpMessage && buildApiMessage(mtpMessage);
  if (!message) {
    return undefined;
  }

  if (mtpMessage instanceof GramJs.Message) {
    addMessageToLocalDb(mtpMessage);
  }

  const users = result.users.map(buildApiUser).filter(Boolean);

  return { message, users };
}

let mediaQueue = Promise.resolve();

export function sendMessage(
  {
    chat,
    text,
    entities,
    replyingTo,
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
  }: {
    chat: ApiChat;
    lastMessageId?: number;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: ApiTypeReplyTo;
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
  },
  onProgress?: ApiOnProgress,
) {
  const localMessage = buildLocalMessage(
    chat,
    text,
    entities,
    replyingTo,
    attachment,
    sticker,
    gif,
    poll,
    contact,
    groupedId,
    scheduledAt,
    sendAs,
    story,
  );

  onUpdate({
    '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
    id: localMessage.id,
    chatId: chat.id,
    message: localMessage,
  });

  // This is expected to arrive after `updateMessageSendSucceeded` which replaces the local ID,
  // so in most cases this will be simply ignored
  const timeout = setTimeout(() => {
    onUpdate({
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
      replyingTo,
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
    } else if (contact) {
      media = new GramJs.InputMediaContact({
        phoneNumber: contact.phoneNumber,
        firstName: contact.firstName,
        lastName: contact.lastName,
        vcard: '',
      });
    }

    const RequestClass = media ? GramJs.messages.SendMedia : GramJs.messages.SendMessage;
    const replyTo = replyingTo ? buildInputReplyTo(replyingTo) : undefined;

    try {
      const update = await invokeRequest(new RequestClass({
        clearDraft: true,
        message: text || '',
        entities: entities ? entities.map(buildMtpMessageEntity) : undefined,
        peer: buildInputPeer(chat.id, chat.accessHash),
        randomId,
        ...(isSilent && { silent: isSilent }),
        ...(scheduledAt && { scheduleDate: scheduledAt }),
        ...(replyTo && { replyTo }),
        ...(media && { media }),
        ...(noWebPage && { noWebpage: noWebPage }),
        ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
        ...(shouldUpdateStickerSetOrder && { updateStickersetsOrder: shouldUpdateStickerSetOrder }),
      }), {
        shouldThrow: true,
        shouldIgnoreUpdates: true,
      });
      if (update) handleLocalMessageUpdate(localMessage, update);
    } catch (error: any) {
      onUpdate({
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
    replyingTo,
    attachment,
    groupedId,
    isSilent,
    scheduledAt,
    sendAs,
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: ApiTypeReplyTo;
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
    const replyTo = replyingTo ? buildInputReplyTo(replyingTo) : undefined;

    const update = await invokeRequest(new GramJs.messages.SendMultiMedia({
      clearDraft: true,
      peer: buildInputPeer(chat.id, chat.accessHash),
      multiMedia: Object.values(singleMediaByIndex), // Object keys are usually ordered
      ...(replyingTo && { replyTo }),
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
  noWebPage,
}: {
  chat: ApiChat;
  message: ApiMessage;
  text: string;
  entities?: ApiMessageEntity[];
  noWebPage?: boolean;
}) {
  const isScheduled = message.date * 1000 > Date.now() + getServerTimeOffset() * 1000;
  let messageUpdate: Partial<ApiMessage> = {
    content: {
      ...message.content,
      ...(text && {
        text: {
          text,
          entities,
        },
      }),
    },
  };

  const emojiOnlyCount = getEmojiOnlyCountForMessage(messageUpdate.content!, messageUpdate.groupedId);
  messageUpdate = {
    ...messageUpdate,
    emojiOnlyCount,
  };

  onUpdate({
    '@type': isScheduled ? 'updateScheduledMessage' : 'updateMessage',
    id: message.id,
    chatId: chat.id,
    message: messageUpdate,
  });

  const mtpEntities = entities && entities.map(buildMtpMessageEntity);

  await invokeRequest(new GramJs.messages.EditMessage({
    message: text || '',
    entities: mtpEntities,
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: message.id,
    ...(isScheduled && { scheduleDate: message.date }),
    ...(noWebPage && { noWebpage: noWebPage }),
  }));
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

async function uploadMedia(localMessage: ApiMessage, attachment: ApiAttachment, onProgress: ApiOnProgress) {
  const {
    filename, blobUrl, mimeType, quick, voice, audio, previewBlobUrl, shouldSendAsFile, shouldSendAsSpoiler,
  } = attachment;

  const patchedOnProgress: ApiOnProgress = (progress) => {
    if (onProgress.isCanceled) {
      patchedOnProgress.isCanceled = true;
    } else {
      onProgress(progress, localMessage.id);
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
      if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType) && mimeType !== GIF_MIME_TYPE) {
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

export async function unpinAllMessages({ chat, threadId }: { chat: ApiChat; threadId?: number }) {
  await invokeRequest(new GramJs.messages.UnpinAllMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
    ...(threadId && { topMsgId: threadId }),
  }));
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

  onUpdate({
    '@type': 'deleteMessages',
    ids: messageIds,
    ...(isChannel && { chatId: chat.id }),
  });
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

  if ('offset' in result && result.offset) {
    await deleteHistory({ chat, shouldDeleteForAll });
    return;
  }

  onUpdate({
    '@type': 'deleteHistory',
    chatId: chat.id,
  });
}

export async function reportMessages({
  peer, messageIds, reason, description,
}: {
  peer: ApiPeer; messageIds: number[]; reason: ApiReportReason; description?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.Report({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: messageIds,
    reason: buildInputReportReason(reason),
    message: description,
  }));

  return result;
}

export async function sendMessageAction({
  peer, threadId, action,
}: {
  peer: ApiPeer; threadId?: number; action: ApiSendMessageAction;
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
      topMsgId: threadId,
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
  chat: ApiChat; threadId: number; maxId?: number;
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
      msgId: threadId,
      readMaxId: fixedMaxId,
    }));
  } else {
    await invokeRequest(new GramJs.messages.ReadHistory({
      peer: buildInputPeer(chat.id, chat.accessHash),
      maxId: fixedMaxId,
    }));
  }

  if (threadId === MAIN_THREAD_ID) {
    void requestChatUpdate({ chat, noLastMessage: true });
  } else {
    void requestThreadInfoUpdate({ chat, threadId });
  }
}

export async function markMessagesRead({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  await invokeRequest(
    isChannel
      ? new GramJs.channels.ReadMessageContents({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        id: messageIds,
      })
      : new GramJs.messages.ReadMessageContents({
        id: messageIds,
      }),
  );

  onUpdate({
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
  const result = await invokeRequest(new GramJs.messages.GetMessagesViews({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: ids,
    increment: shouldIncrement,
  }));

  if (!result) return undefined;

  return ids.map((id, index) => {
    const { views, forwards, replies } = result.views[index];
    return {
      id,
      views,
      forwards,
      messagesCount: replies?.replies,
      recentReplierIds: replies?.recentRepliers?.map(getApiChatIdFromMtpPeer),
      maxId: replies?.maxId,
      readMaxId: replies?.readMaxId,
    };
  });
}

export async function requestThreadInfoUpdate({
  chat, threadId, originChannelId,
}: {
  chat: ApiChat; threadId: number; originChannelId?: string;
}) {
  if (threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  const [topMessageResult, repliesResult] = await Promise.all([
    invokeRequest(new GramJs.messages.GetDiscussionMessage({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: Number(threadId),
    })),
    invokeRequest(new GramJs.messages.GetReplies({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: Number(threadId),
      offsetId: 1,
      addOffset: -1,
      limit: 1,
    })),
  ]);

  if (!topMessageResult || !topMessageResult.messages.length) {
    return undefined;
  }

  const discussionChatId = resolveMessageApiChatId(topMessageResult.messages[0]);
  if (!discussionChatId) {
    return undefined;
  }

  const topMessageId = topMessageResult.messages[topMessageResult.messages.length - 1].id;

  onUpdate({
    '@type': 'updateThreadInfo',
    chatId: discussionChatId,
    threadId: topMessageId,
    threadInfo: {
      threadId: topMessageId,
      topMessageId,
      lastReadInboxMessageId: topMessageResult.readInboxMaxId,
      messagesCount: (repliesResult instanceof GramJs.messages.ChannelMessages) ? repliesResult.count : undefined,
      lastMessageId: topMessageResult.maxId,
      ...(originChannelId ? { originChannelId } : undefined),
    },
    firstMessageId: repliesResult && 'messages' in repliesResult && repliesResult.messages.length
      ? repliesResult.messages[0].id
      : undefined,
  });

  const chats = topMessageResult.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  chats.forEach((newChat) => {
    onUpdate({
      '@type': 'updateChat',
      id: newChat.id,
      chat: newChat,
      noTopChatsRequest: true,
    });
  });

  if (chat.isForum) {
    onUpdate({
      '@type': 'updateTopic',
      chatId: chat.id,
      topicId: threadId,
    });
  }

  addEntitiesToLocalDb(topMessageResult.users);
  addEntitiesToLocalDb(topMessageResult.chats);

  const users = topMessageResult.users.map(buildApiUser).filter(Boolean);

  return {
    topMessageId,
    discussionChatId,
    users,
  };
}

export async function searchMessagesLocal({
  chat, type, query, topMessageId, minDate, maxDate, ...pagination
}: {
  chat: ApiChat;
  type?: ApiMessageSearchType | ApiGlobalMessageSearchType;
  query?: string;
  topMessageId?: number;
  offsetId?: number;
  addOffset?: number;
  limit: number;
  minDate?: number;
  maxDate?: number;
}) {
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

  const result = await invokeRequest(new GramJs.messages.Search({
    peer: buildInputPeer(chat.id, chat.accessHash),
    topMsgId: topMessageId,
    filter,
    q: query || '',
    minDate,
    maxDate,
    ...pagination,
  }), {
    abortControllerChatId: chat.id,
    abortControllerThreadId: topMessageId,
  });

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
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
    chats,
    users,
    messages,
    totalCount,
    nextOffsetId,
  };
}

export async function searchMessagesGlobal({
  query, offsetRate = 0, limit, type = 'text', minDate, maxDate,
}: {
  query: string;
  offsetRate?: number;
  limit: number;
  type?: ApiGlobalMessageSearchType;
  minDate?: number;
  maxDate?: number;
}) {
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

  const result = await invokeRequest(new GramJs.messages.SearchGlobal({
    q: query,
    offsetRate,
    offsetPeer: new GramJs.InputPeerEmpty(),
    limit,
    filter,
    folderId: ALL_FOLDER_ID,
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

  updateLocalDb({
    chats: result.chats,
    users: result.users,
    messages: result.messages,
  } as GramJs.messages.Messages);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  let nextRate: number | undefined;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;

    if (messages.length) {
      nextRate = messages[messages.length - 1].id;
    }
  }

  return {
    messages,
    users,
    chats,
    totalCount,
    nextRate: 'nextRate' in result && result.nextRate ? result.nextRate : nextRate,
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

  return preview && buildWebPage(preview);
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

  updateLocalDb({
    chats: result.chats,
    users: result.users,
    messages: [] as GramJs.Message[],
  } as GramJs.messages.Messages);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const votes = result.votes.map((vote) => ({
    peerId: getApiChatIdFromMtpPeer(vote.peer),
    date: vote.date,
  }));

  return {
    count: result.count,
    votes,
    chats,
    users,
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
}: {
  fromChat: ApiChat;
  toChat: ApiChat;
  toThreadId?: number;
  messages: ApiMessage[];
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiPeer;
  withMyScore?: boolean;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
}) {
  const messageIds = messages.map(({ id }) => id);
  const randomIds = messages.map(generateRandomBigInt);
  const localMessages: Record<string, ApiMessage> = {};

  messages.forEach((message, index) => {
    const localMessage = buildLocalForwardedMessage({
      toChat,
      toThreadId,
      message,
      scheduledAt,
      noAuthors,
      noCaptions,
      isCurrentUserPremium,
    });
    localMessages[randomIds[index].toString()] = localMessage;

    onUpdate({
      '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
      id: localMessage.id,
      chatId: toChat.id,
      message: localMessage,
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
      ...(toThreadId && { topMsgId: toThreadId }),
      ...(scheduledAt && { scheduleDate: scheduledAt }),
      ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
    }), {
      shouldThrow: true,
      shouldIgnoreUpdates: true,
    });
    if (update) handleMultipleLocalMessagesUpdate(localMessages, update);
  } catch (error: any) {
    Object.values(localMessages).forEach((localMessage) => {
      onUpdate({
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

  updateLocalDb(result);

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

function updateLocalDb(result: (
  GramJs.messages.MessagesSlice | GramJs.messages.Messages | GramJs.messages.ChannelMessages |
  GramJs.messages.DiscussionMessage | GramJs.messages.SponsoredMessages
)) {
  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  result.messages.forEach((message) => {
    if ((message instanceof GramJs.Message && isMessageWithMedia(message))
      || (message instanceof GramJs.MessageService && isServiceMessageWithMedia(message))
    ) {
      addMessageToLocalDb(message);
    }
  });
}

export async function fetchPinnedMessages({ chat, threadId }: { chat: ApiChat; threadId: number }) {
  const result = await invokeRequest(new GramJs.messages.Search(
    {
      peer: buildInputPeer(chat.id, chat.accessHash),
      filter: new GramJs.InputMessagesFilterPinned(),
      q: '',
      limit: PINNED_MESSAGES_LIMIT,
      topMsgId: threadId,
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

  updateLocalDb(result);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
    users,
    chats,
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

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    users,
    chats,
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

export async function fetchSponsoredMessages({ chat }: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.GetSponsoredMessages({
    channel: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result || result instanceof GramJs.messages.SponsoredMessagesEmpty || !result.messages.length) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiSponsoredMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
  };
}

export async function viewSponsoredMessage({ chat, random }: { chat: ApiChat; random: string }) {
  await invokeRequest(new GramJs.channels.ViewSponsoredMessage({
    channel: buildInputPeer(chat.id, chat.accessHash),
    randomId: deserializeBytes(random),
  }));
}

export function readAllMentions({
  chat,
}: {
  chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.ReadMentions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), {
    shouldReturnTrue: true,
  });
}

export function readAllReactions({
  chat,
}: {
  chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.ReadReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), {
    shouldReturnTrue: true,
  });
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

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
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

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
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

  onUpdate({
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
    onUpdate({
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

  update.updates.forEach((u) => {
    if (u instanceof GramJs.UpdateMessageID) {
      const localMessage = localMessages[u.randomId.toString()];
      handleLocalMessageUpdate(localMessage, u);
    } else {
      handleGramJsUpdate(u);
    }
  });
}

function handleLocalMessageUpdate(localMessage: ApiMessage, update: GramJs.TypeUpdates) {
  let messageUpdate;
  if (update instanceof GramJs.UpdateShortSentMessage || update instanceof GramJs.UpdateMessageID) {
    messageUpdate = update;
  } else if ('updates' in update) {
    messageUpdate = update.updates.find((u): u is GramJs.UpdateMessageID => u instanceof GramJs.UpdateMessageID);
  }

  if (!messageUpdate) {
    handleGramJsUpdate(update);
    return;
  }

  let newContent: ApiMessage['content'] | undefined;
  if (messageUpdate instanceof GramJs.UpdateShortSentMessage) {
    if (localMessage.content.text && messageUpdate.entities) {
      newContent = {
        text: buildMessageTextContent(localMessage.content.text.text, messageUpdate.entities),
      };
    }
    if (messageUpdate.media) {
      newContent = {
        ...newContent,
        ...buildMessageMediaContent(messageUpdate.media),
      };
    }

    const mtpMessage = buildMessageFromUpdate(messageUpdate.id, localMessage.chatId, messageUpdate);
    if (isMessageWithMedia(mtpMessage)) {
      addMessageToLocalDb(mtpMessage);
    }
  }

  // Edge case for "Send When Online"
  const isSentBefore = 'date' in messageUpdate && messageUpdate.date * 1000 < Date.now() + getServerTimeOffset() * 1000;

  onUpdate({
    '@type': localMessage.isScheduled && !isSentBefore
      ? 'updateScheduledMessageSendSucceeded'
      : 'updateMessageSendSucceeded',
    chatId: localMessage.chatId,
    localId: localMessage.id,
    message: {
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
    },
  });

  handleGramJsUpdate(update);
}
