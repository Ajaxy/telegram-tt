import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiChat,
  ApiAttachment,
  ApiMessage,
  OnApiUpdate,
  ApiMessageSearchType,
  ApiUser,
  ApiSticker,
  ApiVideo,
  ApiNewPoll,
  ApiMessageEntity,
  ApiOnProgress,
  ApiThreadInfo,
  MAIN_THREAD_ID,
  MESSAGE_DELETED,
  ApiGlobalMessageSearchType,
  ApiReportReason,
  ApiSponsoredMessage,
  ApiSendMessageAction,
} from '../../types';

import {
  ALL_FOLDER_ID,
  DEBUG,
  PINNED_MESSAGES_LIMIT,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { invokeRequest, uploadFile } from './client';
import {
  buildApiMessage,
  buildLocalMessage,
  buildWebPage,
  buildLocalForwardedMessage,
  buildApiSponsoredMessage,
} from '../apiBuilders/messages';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputEntity,
  buildInputPeer,
  generateRandomBigInt,
  getEntityTypeById,
  buildInputMediaDocument,
  buildInputPoll,
  buildMtpMessageEntity,
  isMessageWithMedia,
  isServiceMessageWithMedia,
  buildInputReportReason,
  buildSendMessageAction,
} from '../gramjsBuilders';
import localDb from '../localDb';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { fetchFile } from '../../../util/files';
import { addMessageToLocalDb, deserializeBytes, resolveMessageApiChatId } from '../helpers';
import { interpolateArray } from '../../../util/waveform';
import { requestChatUpdate } from './chats';
import { buildApiPeerId } from '../apiBuilders/peers';

const FAST_SEND_TIMEOUT = 1000;
const INPUT_WAVEFORM_LENGTH = 63;

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchMessages({
  chat,
  threadId,
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
        msgId: threadId,
      }),
      ...pagination,
    }), undefined, true);
  } catch (err) {
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

  const messages = result.messages.map(buildApiMessage).filter<ApiMessage>(Boolean as any);
  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);
  const threadInfos = messages.map(({ threadInfo }) => threadInfo).filter<ApiThreadInfo>(Boolean as any);

  return {
    messages,
    users,
    chats,
    threadInfos,
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
      undefined,
      true,
    );
  } catch (err) {
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

  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);

  return { message, users };
}

let queue = Promise.resolve();

export function sendMessage(
  {
    chat,
    text,
    entities,
    replyingTo,
    attachment,
    sticker,
    gif,
    poll,
    isSilent,
    scheduledAt,
    groupedId,
    noWebPage,
    serverTimeOffset,
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: number;
    attachment?: ApiAttachment;
    sticker?: ApiSticker;
    gif?: ApiVideo;
    poll?: ApiNewPoll;
    isSilent?: boolean;
    scheduledAt?: number;
    groupedId?: string;
    noWebPage?: boolean;
    serverTimeOffset?: number;
  },
  onProgress?: ApiOnProgress,
) {
  const localMessage = buildLocalMessage(
    chat, text, entities, replyingTo, attachment, sticker, gif, poll, groupedId, scheduledAt, serverTimeOffset,
  );
  onUpdate({
    '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
    id: localMessage.id,
    chatId: chat.id,
    message: localMessage,
  });

  // This is expected to arrive after `updateMessageSendSucceeded` which replaces the local ID,
  // so in most cases this will be simply ignored
  setTimeout(() => {
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
  localDb.localMessages[String(randomId)] = localMessage;

  if (groupedId) {
    return sendGroupedMedia({
      chat, text, entities, replyingTo, attachment: attachment!, groupedId, isSilent, scheduledAt,
    }, randomId, localMessage, onProgress);
  }

  const prevQueue = queue;
  queue = (async () => {
    let media: GramJs.TypeInputMedia | undefined;
    if (attachment) {
      try {
        media = await uploadMedia(localMessage, attachment, onProgress!);
      } catch (err) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(err);
        }

        await prevQueue;

        return;
      }
    } else if (sticker) {
      media = buildInputMediaDocument(sticker);
    } else if (gif) {
      media = buildInputMediaDocument(gif);
    } else if (poll) {
      media = buildInputPoll(poll, randomId);
    }

    await prevQueue;

    const RequestClass = media ? GramJs.messages.SendMedia : GramJs.messages.SendMessage;

    await invokeRequest(new RequestClass({
      clearDraft: true,
      message: text || '',
      entities: entities ? entities.map(buildMtpMessageEntity) : undefined,
      peer: buildInputPeer(chat.id, chat.accessHash),
      randomId,
      ...(isSilent && { silent: isSilent }),
      ...(scheduledAt && { scheduleDate: scheduledAt }),
      ...(replyingTo && { replyToMsgId: replyingTo }),
      ...(media && { media }),
      ...(noWebPage && { noWebpage: noWebPage }),
    }), true);
  })();

  return queue;
}

const groupedUploads: Record<string, {
  counter: number;
  singleMediaByIndex: Record<number, GramJs.InputSingleMedia>;
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
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: number;
    attachment: ApiAttachment;
    groupedId: string;
    isSilent?: boolean;
    scheduledAt?: number;
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
    };
  }

  groupIndex = groupedUploads[groupedId].counter++;

  const prevQueue = queue;
  queue = (async () => {
    let media;
    try {
      media = await uploadMedia(localMessage, attachment, onProgress!);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(err);
      }

      groupedUploads[groupedId].counter--;

      await prevQueue;

      return;
    }

    const inputMedia = await fetchInputMedia(
      buildInputPeer(chat.id, chat.accessHash),
      media as GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
    );

    await prevQueue;

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

    if (Object.keys(groupedUploads[groupedId].singleMediaByIndex).length < groupedUploads[groupedId].counter) {
      return;
    }

    const { singleMediaByIndex } = groupedUploads[groupedId];
    delete groupedUploads[groupedId];

    await invokeRequest(new GramJs.messages.SendMultiMedia({
      clearDraft: true,
      peer: buildInputPeer(chat.id, chat.accessHash),
      multiMedia: Object.values(singleMediaByIndex), // Object keys are usually ordered
      replyToMsgId: replyingTo,
      ...(isSilent && { silent: isSilent }),
      ...(scheduledAt && { scheduleDate: scheduledAt }),
    }), true);
  })();

  return queue;
}

async function fetchInputMedia(
  peer: GramJs.TypeInputPeer,
  uploadedMedia: GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
) {
  const messageMedia = await invokeRequest(new GramJs.messages.UploadMedia({
    peer,
    media: uploadedMedia,
  }));

  if ((
    messageMedia instanceof GramJs.MessageMediaPhoto
    && messageMedia.photo
    && messageMedia.photo instanceof GramJs.Photo)
  ) {
    const { photo: { id, accessHash, fileReference } } = messageMedia;

    return new GramJs.InputMediaPhoto({
      id: new GramJs.InputPhoto({ id, accessHash, fileReference }),
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
  serverTimeOffset,
}: {
  chat: ApiChat;
  message: ApiMessage;
  text: string;
  entities?: ApiMessageEntity[];
  noWebPage?: boolean;
  serverTimeOffset: number;
}) {
  const isScheduled = message.date * 1000 > Date.now() + serverTimeOffset * 1000;
  const messageUpdate: Partial<ApiMessage> = {
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

  onUpdate({
    '@type': isScheduled ? 'updateScheduledMessage' : 'updateMessage',
    id: message.id,
    chatId: chat.id,
    message: messageUpdate,
  });

  // TODO Revise intersecting with scheduled
  localDb.localMessages[message.id] = { ...message, ...messageUpdate };

  const mtpEntities = entities && entities.map(buildMtpMessageEntity);

  await invokeRequest(new GramJs.messages.EditMessage({
    message: text || '',
    entities: mtpEntities,
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: message.id,
    ...(isScheduled && { scheduleDate: message.date }),
    ...(noWebPage && { noWebpage: noWebPage }),
  }), true);
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
  }), true);
}

async function uploadMedia(localMessage: ApiMessage, attachment: ApiAttachment, onProgress: ApiOnProgress) {
  const {
    filename, blobUrl, mimeType, quick, voice,
  } = attachment;

  const file = await fetchFile(blobUrl, filename);
  const patchedOnProgress: ApiOnProgress = (progress) => {
    if (onProgress.isCanceled) {
      patchedOnProgress.isCanceled = true;
    } else {
      onProgress(progress, localMessage.id);
    }
  };
  const inputFile = await uploadFile(file, patchedOnProgress);

  const attributes: GramJs.TypeDocumentAttribute[] = [new GramJs.DocumentAttributeFilename({ fileName: filename })];
  if (quick) {
    if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType)) {
      return new GramJs.InputMediaUploadedPhoto({ file: inputFile });
    }

    if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
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

  if (voice) {
    const { duration, waveform } = voice;
    const { data: inputWaveform } = interpolateArray(waveform, INPUT_WAVEFORM_LENGTH);
    attributes.push(new GramJs.DocumentAttributeAudio({
      voice: true,
      duration,
      waveform: Buffer.from(inputWaveform),
    }));
  }

  return new GramJs.InputMediaUploadedDocument({
    file: inputFile,
    mimeType,
    attributes,
  });
}

export async function pinMessage({
  chat, messageId, isUnpin, isOneSide, isSilent,
}: { chat: ApiChat; messageId: number; isUnpin: boolean; isOneSide: boolean; isSilent: boolean }) {
  await invokeRequest(new GramJs.messages.UpdatePinnedMessage({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageId,
    ...(isUnpin && { unpin: true }),
    ...(isOneSide && { pmOneside: true }),
    ...(isSilent && { silent: true }),
  }), true);
}

export async function unpinAllMessages({ chat }: { chat: ApiChat }) {
  await invokeRequest(new GramJs.messages.UnpinAllMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), true);
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

export async function deleteScheduledMessages({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  const result = await invokeRequest(
    new GramJs.messages.DeleteScheduledMessages({
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: messageIds,
    }),
  );

  if (!result) {
    return;
  }

  onUpdate({
    '@type': 'deleteScheduledMessages',
    ids: messageIds,
    chatId: chat.id,
  });
}

export async function deleteHistory({
  chat, shouldDeleteForAll, maxId,
}: {
  chat: ApiChat; shouldDeleteForAll?: boolean; maxId?: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';
  const result = await invokeRequest(
    isChannel
      ? new GramJs.channels.DeleteHistory({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        maxId,
      })
      : new GramJs.messages.DeleteHistory({
        peer: buildInputPeer(chat.id, chat.accessHash),
        ...(shouldDeleteForAll && { revoke: true }),
        ...(!shouldDeleteForAll && { just_clear: true }),
        maxId,
      }),
  );

  if (!result) {
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
  peer: ApiChat | ApiUser; messageIds: number[]; reason: ApiReportReason; description?: string;
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
  peer: ApiChat | ApiUser; threadId?: number; action: ApiSendMessageAction;
}) {
  const gramAction = buildSendMessageAction(action);
  if (!gramAction) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Unsupported message action', action);
    }
    return undefined;
  }

  const result = await invokeRequest(new GramJs.messages.SetTyping({
    peer: buildInputPeer(peer.id, peer.accessHash),
    topMsgId: threadId,
    action: gramAction,
  }));
  return result;
}

export async function markMessageListRead({
  chat, threadId, maxId, serverTimeOffset,
}: {
  chat: ApiChat; threadId: number; maxId?: number; serverTimeOffset: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  if (isChannel && threadId === MAIN_THREAD_ID) {
    await invokeRequest(new GramJs.channels.ReadHistory({
      channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      maxId,
    }));
  } else if (isChannel) {
    await invokeRequest(new GramJs.messages.ReadDiscussion({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: threadId,
      readMaxId: maxId,
    }));
  } else {
    await invokeRequest(new GramJs.messages.ReadHistory({
      peer: buildInputPeer(chat.id, chat.accessHash),
      maxId,
    }));
  }

  if (threadId === MAIN_THREAD_ID) {
    void requestChatUpdate({ chat, serverTimeOffset, noLastMessage: true });
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

export async function requestThreadInfoUpdate({
  chat, threadId,
}: {
  chat: ApiChat; threadId: number;
}) {
  const [topMessageResult, repliesResult] = await Promise.all([
    invokeRequest(new GramJs.messages.GetDiscussionMessage({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: threadId,
    })),
    invokeRequest(new GramJs.messages.GetReplies({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: threadId,
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

  onUpdate({
    '@type': 'updateThreadInfo',
    chatId: discussionChatId,
    threadId,
    threadInfo: {
      threadId,
      topMessageId: topMessageResult.messages[topMessageResult.messages.length - 1].id,
      lastReadInboxMessageId: topMessageResult.readInboxMaxId,
      messagesCount: (repliesResult instanceof GramJs.messages.ChannelMessages) ? repliesResult.count : undefined,
    },
    firstMessageId: repliesResult && 'messages' in repliesResult && repliesResult.messages.length
      ? repliesResult.messages[0].id
      : undefined,
  });

  const chats = topMessageResult.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);
  chats.forEach((newChat) => {
    onUpdate({
      '@type': 'updateChat',
      id: newChat.id,
      chat: newChat,
      noTopChatsRequest: true,
    });
  });

  return {
    discussionChatId,
  };
}

export async function searchMessagesLocal({
  chatOrUser, type, query, topMessageId, minDate, maxDate, ...pagination
}: {
  chatOrUser: ApiChat | ApiUser;
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
    peer: buildInputPeer(chatOrUser.id, chatOrUser.accessHash),
    filter,
    q: query || '',
    topMsgId: topMessageId,
    minDate,
    maxDate,
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

  const messages = result.messages.map(buildApiMessage).filter<ApiMessage>(Boolean as any);
  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);

  let totalCount = messages.length;
  let nextOffsetId: number | undefined;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;

    if (messages.length) {
      nextOffsetId = messages[messages.length - 1].id;
    }
  }

  return {
    messages,
    users,
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

  const chats = result.chats.map((user) => buildApiChatFromPreview(user)).filter<ApiChat>(Boolean as any);
  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const messages = result.messages.map(buildApiMessage).filter<ApiMessage>(Boolean as any);

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

export async function fetchWebPagePreview({ message }: { message: string }) {
  const preview = await invokeRequest(new GramJs.messages.GetWebPagePreview({
    message,
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
  }), true);
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
    chats: [] as GramJs.TypeChat[],
    users: result.users,
    messages: [] as GramJs.Message[],
  } as GramJs.messages.Messages);

  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const votes = result.votes.map((vote) => ({
    userId: vote.userId,
    date: vote.date,
  }));

  return {
    count: result.count,
    votes,
    users,
    nextOffset: result.nextOffset,
    shouldResetVoters,
  };
}

export async function forwardMessages({
  fromChat,
  toChat,
  messages,
  serverTimeOffset,
  isSilent,
  scheduledAt,
}: {
  fromChat: ApiChat;
  toChat: ApiChat;
  messages: ApiMessage[];
  serverTimeOffset: number;
  isSilent?: boolean;
  scheduledAt?: number;
}) {
  const messageIds = messages.map(({ id }) => id);
  const randomIds = messages.map(generateRandomBigInt);

  messages.forEach((message, index) => {
    const localMessage = buildLocalForwardedMessage(toChat, message, serverTimeOffset, scheduledAt);
    localDb.localMessages[String(randomIds[index])] = localMessage;

    onUpdate({
      '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
      id: localMessage.id,
      chatId: toChat.id,
      message: localMessage,
    });
  });

  await invokeRequest(new GramJs.messages.ForwardMessages({
    fromPeer: buildInputPeer(fromChat.id, fromChat.accessHash),
    toPeer: buildInputPeer(toChat.id, toChat.accessHash),
    randomId: randomIds,
    id: messageIds,
    ...(isSilent && { sil2ent: isSilent }),
    ...(scheduledAt && { scheduleDate: scheduledAt }),
  }), true);
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
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter<ApiMessage>(Boolean as any);

  return {
    messages,
  };
}

export async function sendScheduledMessages({ chat, ids }: { chat: ApiChat; ids: number[] }) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.SendScheduledMessages({
    peer: buildInputPeer(id, accessHash),
    id: ids,
  }), true);
}

function updateLocalDb(result: (
  GramJs.messages.MessagesSlice | GramJs.messages.Messages | GramJs.messages.ChannelMessages |
  GramJs.messages.DiscussionMessage | GramJs.messages.SponsoredMessages
)) {
  result.users.forEach((user) => {
    if (user instanceof GramJs.User) {
      localDb.users[buildApiPeerId(user.id, 'user')] = user;
    }
  });

  result.chats.forEach((chat) => {
    if (chat instanceof GramJs.Chat || chat instanceof GramJs.Channel) {
      localDb.chats[buildApiPeerId(chat.id, chat instanceof GramJs.Chat ? 'chat' : 'channel')] = chat;
    }
  });

  result.messages.forEach((message) => {
    if ((message instanceof GramJs.Message && isMessageWithMedia(message))
      || (message instanceof GramJs.MessageService && isServiceMessageWithMedia(message))
    ) {
      addMessageToLocalDb(message);
    }
  });
}

export async function fetchPinnedMessages({ chat }: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.messages.Search(
    {
      peer: buildInputPeer(chat.id, chat.accessHash),
      filter: new GramJs.InputMessagesFilterPinned(),
      q: '',
      limit: PINNED_MESSAGES_LIMIT,
    },
  ));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter<ApiMessage>(Boolean as any);
  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);

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

  return result ? result.map(String) : undefined;
}

export async function fetchSponsoredMessages({ chat }: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.GetSponsoredMessages({
    channel: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result || !result.messages.length) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiSponsoredMessage).filter<ApiSponsoredMessage>(Boolean as any);
  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);

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
