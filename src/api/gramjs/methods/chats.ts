import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';

import type {
  ApiChat,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatFullInfo,
  ApiChatReactions,
  ApiDraft,
  ApiGroupCall,
  ApiMessage,
  ApiMissingInvitedUser,
  ApiPeer,
  ApiPhoto,
  ApiTopic,
  ApiUser,
  ApiUserStatus,
} from '../../types';

import {
  ALL_FOLDER_ID,
  ARCHIVED_FOLDER_ID,
  DEBUG,
  GENERAL_TOPIC_ID,
  GLOBAL_SEARCH_CONTACTS_LIMIT,
  MAX_INT_32,
  MEMBERS_LOAD_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
  TOPICS_SLICE,
} from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  buildApiChatBotCommands,
  buildApiChatFolder,
  buildApiChatFolderFromSuggested,
  buildApiChatFromDialog,
  buildApiChatFromPreview,
  buildApiChatFromSavedDialog,
  buildApiChatInviteInfo,
  buildApiChatlistExportedInvite,
  buildApiChatlistInvite,
  buildApiChatReactions,
  buildApiChatSettings,
  buildApiMissingInvitedUser,
  buildApiTopic,
  buildChatMember,
  buildChatMembers,
  getPeerKey,
} from '../apiBuilders/chats';
import { buildApiBotVerification, buildApiPhoto } from '../apiBuilders/common';
import { buildApiMessage, buildMessageDraft } from '../apiBuilders/messages';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildStickerSet } from '../apiBuilders/symbols';
import { buildApiUser, buildApiUserStatuses } from '../apiBuilders/users';
import {
  buildChatAdminRights,
  buildChatBannedRights,
  buildFilterFromApiFolder,
  buildInputChatReactions,
  buildInputEntity,
  buildInputPeer,
  buildInputPhoto,
  buildInputReplyTo,
  buildMtpMessageEntity,
  generateRandomBigInt,
} from '../gramjsBuilders';
import {
  addPhotoToLocalDb,
} from '../helpers/localDb';
import { isChatFolder } from '../helpers/misc';
import { scheduleMutedChatUpdate } from '../scheduleUnmute';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import {
  applyState, processAffectedHistory, updateChannelState,
} from '../updates/updateManager';
import { handleGramJsUpdate, invokeRequest, uploadFile } from './client';

type FullChatData = {
  fullInfo: ApiChatFullInfo;
  chats: ApiChat[];
  userStatusesById: { [userId: string]: ApiUserStatus };
  groupCall?: Partial<ApiGroupCall>;
  membersCount?: number;
  isForumAsMessages?: true;
};

type ChatListData = {
  chatIds: string[];
  chats: ApiChat[];
  users: ApiUser[];
  userStatusesById: Record<string, ApiUserStatus>;
  draftsById: Record<string, ApiDraft>;
  orderedPinnedIds: string[] | undefined;
  totalChatCount: number;
  messages: ApiMessage[];
  lastMessageByChatId: Record<string, number>;
  nextOffsetId?: number;
  nextOffsetPeerId?: string;
  nextOffsetDate?: number;
};

export async function fetchChats({
  limit,
  offsetDate,
  offsetPeer,
  offsetId,
  archived,
  withPinned,
  lastLocalServiceMessageId,
}: {
  limit: number;
  offsetDate?: number;
  offsetPeer?: ApiPeer;
  offsetId?: number;
  archived?: boolean;
  withPinned?: boolean;
  lastLocalServiceMessageId?: number;
}): Promise<ChatListData | undefined> {
  const peer = (offsetPeer && buildInputPeer(offsetPeer.id, offsetPeer.accessHash)) || new GramJs.InputPeerEmpty();
  const result = await invokeRequest(new GramJs.messages.GetDialogs({
    offsetPeer: peer,
    offsetId,
    limit,
    offsetDate,
    folderId: archived ? ARCHIVED_FOLDER_ID : undefined,
    ...(withPinned && { excludePinned: true }),
  }));
  const resultPinned = withPinned
    ? await invokeRequest(new GramJs.messages.GetPinnedDialogs({
      folderId: archived ? ARCHIVED_FOLDER_ID : undefined,
    }))
    : undefined;

  if (!result || result instanceof GramJs.messages.DialogsNotModified) {
    return undefined;
  }

  const messages = (resultPinned ? resultPinned.messages : [])
    .concat(result.messages)
    .map(buildApiMessage)
    .filter(Boolean);

  const peersByKey = preparePeers(result);
  if (resultPinned) {
    Object.assign(peersByKey, preparePeers(resultPinned, peersByKey));
  }

  const chats: ApiChat[] = [];
  const draftsById: Record<string, ApiDraft> = {};

  const dialogs = (resultPinned?.dialogs || []).concat(result.dialogs);

  const orderedPinnedIds: string[] = [];
  const lastMessageByChatId: Record<string, number> = {};

  dialogs.forEach((dialog) => {
    if (
      !(dialog instanceof GramJs.Dialog)
      // This request can return dialogs not belonging to specified folder
      || (!archived && dialog.folderId === ARCHIVED_FOLDER_ID)
      || (archived && dialog.folderId !== ARCHIVED_FOLDER_ID)
    ) {
      return;
    }

    const peerEntity = peersByKey[getPeerKey(dialog.peer)];
    const chat = buildApiChatFromDialog(dialog, peerEntity);
    lastMessageByChatId[chat.id] = dialog.topMessage;

    if (dialog.pts) {
      updateChannelState(chat.id, dialog.pts);
    }

    if (
      chat.id === SERVICE_NOTIFICATIONS_USER_ID
      && lastLocalServiceMessageId
      && (lastLocalServiceMessageId > dialog.topMessage)
    ) {
      lastMessageByChatId[chat.id] = lastLocalServiceMessageId;
    }

    chat.isListed = true;

    chats.push(chat);

    scheduleMutedChatUpdate(chat.id, chat.muteUntil, sendApiUpdate);

    if (withPinned && dialog.pinned) {
      orderedPinnedIds.push(chat.id);
    }

    if (dialog.draft) {
      const draft = buildMessageDraft(dialog.draft);
      if (draft) {
        draftsById[chat.id] = draft;
      }
    }
  });

  const chatIds = chats.map((chat) => chat.id);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const userStatusesById = buildApiUserStatuses((resultPinned?.users || []).concat(result.users));

  let totalChatCount: number;
  if (result instanceof GramJs.messages.DialogsSlice) {
    totalChatCount = result.count;
  } else {
    totalChatCount = chatIds.length;
  }

  const lastDialog = chats[chats.length - 1];
  const lastMessageId = lastMessageByChatId[lastDialog?.id];
  const nextOffsetId = lastMessageId;
  const nextOffsetPeerId = lastDialog?.id;
  const nextOffsetDate = messages.reverse()
    .find((message) => message.chatId === lastDialog?.id && message.id === lastMessageId)?.date;

  return {
    chatIds,
    chats,
    users,
    userStatusesById,
    draftsById,
    orderedPinnedIds: withPinned ? orderedPinnedIds : undefined,
    totalChatCount,
    lastMessageByChatId,
    messages,
    nextOffsetId,
    nextOffsetPeerId,
    nextOffsetDate,
  };
}

export async function fetchSavedChats({
  limit,
  offsetDate,
  offsetPeer,
  offsetId,
  withPinned,
}: {
  limit: number;
  offsetDate?: number;
  offsetPeer?: ApiPeer;
  offsetId?: number;
  withPinned?: boolean;
}): Promise<ChatListData | undefined> {
  const peer = (offsetPeer && buildInputPeer(offsetPeer.id, offsetPeer.accessHash)) || new GramJs.InputPeerEmpty();
  const result = await invokeRequest(new GramJs.messages.GetSavedDialogs({
    offsetPeer: peer,
    offsetId,
    limit,
    offsetDate,
    ...(withPinned && { excludePinned: true }),
  }));
  const resultPinned = withPinned
    ? await invokeRequest(new GramJs.messages.GetPinnedSavedDialogs())
    : undefined;

  if (!result || result instanceof GramJs.messages.SavedDialogsNotModified) {
    return undefined;
  }

  const hasPinned = resultPinned && !(resultPinned instanceof GramJs.messages.SavedDialogsNotModified);

  const messages = (hasPinned ? resultPinned.messages : [])
    .concat(result.messages)
    .map(buildApiMessage)
    .filter(Boolean);

  const peersByKey = preparePeers(result);
  if (hasPinned) {
    Object.assign(peersByKey, preparePeers(resultPinned, peersByKey));
  }

  const dialogs = (hasPinned ? resultPinned.dialogs : []).concat(result.dialogs);

  const chatIds: string[] = [];
  const orderedPinnedIds: string[] = [];
  const lastMessageByChatId: Record<string, number> = {};

  const chats: ApiChat[] = [];

  dialogs.forEach((dialog) => {
    const peerEntity = peersByKey[getPeerKey(dialog.peer)];
    const chat = buildApiChatFromSavedDialog(dialog, peerEntity);
    const chatId = getApiChatIdFromMtpPeer(dialog.peer);

    chatIds.push(chatId);
    if (withPinned && dialog.pinned) {
      orderedPinnedIds.push(chatId);
    }

    lastMessageByChatId[chatId] = dialog.topMessage;

    chats.push(chat);
  });

  const users = result.users.map(buildApiUser).filter(Boolean);
  const userStatusesById = buildApiUserStatuses((hasPinned ? resultPinned.users : [])
    .concat(result.users));

  let totalChatCount: number;
  if (result instanceof GramJs.messages.SavedDialogsSlice) {
    totalChatCount = result.count;
  } else {
    totalChatCount = chatIds.length;
  }

  const lastDialog = chats[chats.length - 1];
  const lastMessageId = lastMessageByChatId[lastDialog?.id];
  const nextOffsetId = lastMessageId;
  const nextOffsetPeerId = lastDialog?.id;
  const nextOffsetDate = messages.reverse()
    .find((message) => message.chatId === lastDialog?.id && message.id === lastMessageId)?.date;

  return {
    chatIds,
    chats,
    users,
    userStatusesById,
    orderedPinnedIds: withPinned ? orderedPinnedIds : undefined,
    totalChatCount,
    lastMessageByChatId,
    messages,
    draftsById: {},
    nextOffsetId,
    nextOffsetPeerId,
    nextOffsetDate,
  };
}

export function fetchFullChat(chat: ApiChat) {
  const { id, accessHash } = chat;

  const input = buildInputEntity(id, accessHash);

  return input instanceof GramJs.InputChannel
    ? getFullChannelInfo(chat)
    : getFullChatInfo(id);
}

export async function fetchChatSettings(chat: ApiChat) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetPeerSettings({
    peer: buildInputPeer(id, accessHash),
  }), {
    abortControllerChatId: id,
  });

  if (!result) {
    return undefined;
  }

  return {
    settings: buildApiChatSettings(result.settings),
  };
}

export async function searchChats({ query }: { query: string }) {
  const result = await invokeRequest(new GramJs.contacts.Search({ q: query, limit: GLOBAL_SEARCH_CONTACTS_LIMIT }));
  if (!result) {
    return undefined;
  }

  const accountPeerIds = result.myResults.map(getApiChatIdFromMtpPeer);
  const globalPeerIds = result.results.map(getApiChatIdFromMtpPeer)
    .filter((id) => !accountPeerIds.includes(id));

  return {
    accountResultIds: accountPeerIds,
    globalResultIds: globalPeerIds,
  };
}

export async function fetchChat({
  type, user,
}: {
  type: 'user' | 'self' | 'support'; user?: ApiUser;
}) {
  let mtpUser: GramJs.User | undefined;

  if (type === 'self' || type === 'user') {
    const result = await invokeRequest(new GramJs.users.GetUsers({
      id: [
        type === 'user' && user
          ? buildInputEntity(user.id, user.accessHash) as GramJs.InputUser
          : new GramJs.InputUserSelf(),
      ],
    }));
    if (!result || !result.length) {
      return undefined;
    }

    [mtpUser] = result;
  } else if (type === 'support') {
    const result = await invokeRequest(new GramJs.help.GetSupport());
    if (!result || !result.user) {
      return undefined;
    }

    mtpUser = result.user;
  }

  const chat = buildApiChatFromPreview(mtpUser!, type === 'support');
  if (!chat) {
    return undefined;
  }

  sendApiUpdate({
    '@type': 'updateChat',
    id: chat.id,
    chat,
  });

  return { chatId: chat.id };
}

export async function requestChatUpdate({
  chat,
  lastLocalMessage,
  noLastMessage,
}: {
  chat: ApiChat; lastLocalMessage?: ApiMessage; noLastMessage?: boolean;
}) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetPeerDialogs({
    peers: [new GramJs.InputDialogPeer({
      peer: buildInputPeer(id, accessHash),
    })],
  }));

  if (!result) {
    return;
  }

  const dialog = result.dialogs[0];
  if (!dialog || !(dialog instanceof GramJs.Dialog)) {
    return;
  }

  const peersByKey = preparePeers(result);
  const peerEntity = peersByKey[getPeerKey(dialog.peer)];
  if (!peerEntity) {
    return;
  }

  const lastRemoteMessage = buildApiMessage(result.messages[0]);

  const lastMessage = lastLocalMessage && (!lastRemoteMessage || (lastLocalMessage.date > lastRemoteMessage.date))
    ? lastLocalMessage
    : lastRemoteMessage;

  const chatUpdate = buildApiChatFromDialog(dialog, peerEntity);

  sendApiUpdate({
    '@type': 'updateChat',
    id,
    chat: chatUpdate,
  });

  if (!noLastMessage && lastMessage) {
    sendApiUpdate({
      '@type': 'updateChatLastMessage',
      id,
      lastMessage,
    });
  }

  applyState(result.state);

  scheduleMutedChatUpdate(chatUpdate.id, chatUpdate.muteUntil, sendApiUpdate);
}

export function saveDraft({
  chat,
  draft,
}: {
  chat: ApiChat;
  draft?: ApiDraft;
}) {
  return invokeRequest(new GramJs.messages.SaveDraft({
    peer: buildInputPeer(chat.id, chat.accessHash),
    message: draft?.text?.text || '',
    entities: draft?.text?.entities?.map(buildMtpMessageEntity),
    replyTo: draft?.replyInfo && buildInputReplyTo(draft.replyInfo),
  }));
}

async function getFullChatInfo(chatId: string): Promise<FullChatData | undefined> {
  const result = await invokeRequest(new GramJs.messages.GetFullChat({
    chatId: buildInputEntity(chatId) as BigInt.BigInteger,
  }));

  if (!result || !(result.fullChat instanceof GramJs.ChatFull)) {
    return undefined;
  }

  const {
    about,
    participants,
    exportedInvite,
    botInfo,
    call,
    availableReactions,
    recentRequesters,
    requestsPending,
    chatPhoto,
    translationsDisabled,
    reactionsLimit,
    hasScheduled,
  } = result.fullChat;

  if (chatPhoto) {
    addPhotoToLocalDb(chatPhoto);
  }

  const members = buildChatMembers(participants);
  const adminMembers = members ? members.filter(({ isAdmin, isOwner }) => isAdmin || isOwner) : undefined;
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;
  const inviteLink = exportedInvite instanceof GramJs.ChatInviteExported ? exportedInvite.link : undefined;
  const userStatusesById = buildApiUserStatuses(result.users);
  const chats = result.chats.map((chat) => buildApiChatFromPreview(chat)).filter(Boolean);

  return {
    fullInfo: {
      ...(chatPhoto instanceof GramJs.Photo && { profilePhoto: buildApiPhoto(chatPhoto) }),
      about,
      members,
      adminMembersById: adminMembers ? buildCollectionByKey(adminMembers, 'userId') : undefined,
      canViewMembers: true,
      botCommands,
      inviteLink,
      groupCallId: call?.id.toString(),
      enabledReactions: buildApiChatReactions(availableReactions),
      reactionsLimit,
      requestsPending,
      recentRequesterIds: recentRequesters?.map((userId) => buildApiPeerId(userId, 'user')),
      isTranslationDisabled: translationsDisabled,
      isPreHistoryHidden: true,
      hasScheduledMessages: hasScheduled,
    },
    chats,
    userStatusesById,
    groupCall: call ? {
      chatId,
      isLoaded: false,
      id: call.id.toString(),
      accessHash: call.accessHash.toString(),
      connectionState: 'disconnected',
      participantsCount: 0,
      version: 0,
      participants: {},
    } : undefined,
    membersCount: members?.length,
  };
}

async function getFullChannelInfo(
  chat: ApiChat,
): Promise<FullChatData | undefined> {
  const { id, adminRights } = chat;
  const accessHash = chat.accessHash!;
  const result = await invokeRequest(new GramJs.channels.GetFullChannel({
    channel: buildInputEntity(id, accessHash) as GramJs.InputChannel,
  }));

  if (!result || !(result.fullChat instanceof GramJs.ChannelFull)) {
    return undefined;
  }

  const {
    about,
    onlineCount,
    exportedInvite,
    slowmodeSeconds,
    slowmodeNextSendDate,
    migratedFromChatId,
    migratedFromMaxId,
    canViewParticipants,
    canViewStats,
    linkedChatId,
    hiddenPrehistory,
    call,
    botInfo,
    availableReactions,
    reactionsLimit,
    defaultSendAs,
    requestsPending,
    recentRequesters,
    statsDc,
    participantsCount,
    stickerset,
    chatPhoto,
    participantsHidden,
    translationsDisabled,
    storiesPinnedAvailable,
    viewForumAsMessages,
    emojiset,
    boostsApplied,
    boostsUnrestrict,
    botVerification,
    canViewRevenue: canViewMonetization,
    paidReactionsAvailable,
    hasScheduled,
    stargiftsCount,
    stargiftsAvailable,
  } = result.fullChat;

  if (chatPhoto) {
    addPhotoToLocalDb(chatPhoto);
  }

  const inviteLink = exportedInvite instanceof GramJs.ChatInviteExported
    ? exportedInvite.link
    : undefined;

  const { members, userStatusesById } = (canViewParticipants && await fetchMembers({ chat })) || {};
  const { members: kickedMembers, userStatusesById: bannedStatusesById } = (
    canViewParticipants && adminRights && await fetchMembers({ chat, memberFilter: 'kicked' })
  ) || {};
  const { members: adminMembers, userStatusesById: adminStatusesById } = (
    canViewParticipants && await fetchMembers({ chat, memberFilter: 'admin' })
  ) || {};
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;
  const memberInfoRequest = !chat.isNotJoined && chat.type === 'chatTypeChannel'
    ? await fetchMember({ chat }) : undefined;
  const memberInfo = memberInfoRequest?.member;
  const joinInfo = memberInfo?.joinedDate ? {
    joinedDate: memberInfo.joinedDate,
    inviter: memberInfo.inviterId,
    isViaRequest: memberInfo.isViaRequest,
  } : undefined;

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  if (result?.chats?.length > 1) {
    const [, mtpLinkedChat] = result.chats;
    const linkedChat = buildApiChatFromPreview(mtpLinkedChat);
    if (linkedChat) {
      sendApiUpdate({
        '@type': 'updateChat',
        id: linkedChat.id,
        chat: linkedChat,
      });
    }
  }

  if (result.fullChat.pts) {
    updateChannelState(chat.id, result.fullChat.pts);
  }

  const statusesById = {
    ...userStatusesById,
    ...bannedStatusesById,
    ...adminStatusesById,
  };

  return {
    fullInfo: {
      ...(chatPhoto instanceof GramJs.Photo && { profilePhoto: buildApiPhoto(chatPhoto) }),
      about,
      onlineCount,
      inviteLink,
      slowMode: slowmodeSeconds ? {
        seconds: slowmodeSeconds,
        nextSendDate: slowmodeNextSendDate,
      } : undefined,
      migratedFrom: migratedFromChatId ? {
        chatId: buildApiPeerId(migratedFromChatId, 'chat'),
        maxMessageId: migratedFromMaxId,
      } : undefined,
      canViewMembers: canViewParticipants,
      canViewStatistics: canViewStats,
      canViewMonetization,
      isPreHistoryHidden: hiddenPrehistory,
      joinInfo,
      members,
      kickedMembers,
      adminMembersById: adminMembers ? buildCollectionByKey(adminMembers, 'userId') : undefined,
      groupCallId: call ? String(call.id) : undefined,
      linkedChatId: linkedChatId ? buildApiPeerId(linkedChatId, 'channel') : undefined,
      botCommands,
      enabledReactions: buildApiChatReactions(availableReactions),
      reactionsLimit,
      sendAsId: defaultSendAs ? getApiChatIdFromMtpPeer(defaultSendAs) : undefined,
      requestsPending,
      recentRequesterIds: recentRequesters?.map((userId) => buildApiPeerId(userId, 'user')),
      statisticsDcId: statsDc,
      stickerSet: stickerset ? buildStickerSet(stickerset) : undefined,
      emojiSet: emojiset ? buildStickerSet(emojiset) : undefined,
      areParticipantsHidden: participantsHidden,
      isTranslationDisabled: translationsDisabled,
      hasPinnedStories: Boolean(storiesPinnedAvailable),
      boostsApplied,
      boostsToUnrestrict: boostsUnrestrict,
      botVerification: botVerification && buildApiBotVerification(botVerification),
      isPaidReactionAvailable: paidReactionsAvailable,
      hasScheduledMessages: hasScheduled,
      starGiftCount: stargiftsCount,
      areStarGiftsAvailable: Boolean(stargiftsAvailable),
    },
    chats,
    userStatusesById: statusesById,
    groupCall: call ? {
      chatId: id,
      isLoaded: false,
      id: call.id.toString(),
      accessHash: call?.accessHash.toString(),
      participants: {},
      version: 0,
      participantsCount: 0,
      connectionState: 'disconnected',
    } : undefined,
    membersCount: participantsCount,
    ...(viewForumAsMessages && { isForumAsMessages: true }),
  };
}

export async function updateChatMutedState({
  chat, isMuted, muteUntil = 0,
}: {
  chat: ApiChat; isMuted: boolean; muteUntil?: number;
}) {
  if (isMuted && !muteUntil) {
    muteUntil = MAX_INT_32;
  }
  await invokeRequest(new GramJs.account.UpdateNotifySettings({
    peer: new GramJs.InputNotifyPeer({
      peer: buildInputPeer(chat.id, chat.accessHash),
    }),
    settings: new GramJs.InputPeerNotifySettings({ muteUntil }),
  }));

  sendApiUpdate({
    '@type': 'updateNotifyExceptions',
    chatId: chat.id,
    isMuted,
  });

  void requestChatUpdate({
    chat,
    noLastMessage: true,
  });
}

export async function updateTopicMutedState({
  chat, topicId, isMuted, muteUntil = 0,
}: {
  chat: ApiChat; topicId: number; isMuted: boolean; muteUntil?: number;
}) {
  if (isMuted && !muteUntil) {
    muteUntil = MAX_INT_32;
  }
  await invokeRequest(new GramJs.account.UpdateNotifySettings({
    peer: new GramJs.InputNotifyForumTopic({
      peer: buildInputPeer(chat.id, chat.accessHash),
      topMsgId: topicId,
    }),
    settings: new GramJs.InputPeerNotifySettings({ muteUntil }),
  }));

  sendApiUpdate({
    '@type': 'updateTopicNotifyExceptions',
    chatId: chat.id,
    topicId,
    isMuted,
  });

  // TODO[forums] Request forum topic thread update
}

export async function createChannel({
  title, about = '', users,
}: {
  title: string; about?: string; users?: ApiUser[];
}) {
  const result = await invokeRequest(new GramJs.channels.CreateChannel({
    broadcast: true,
    title,
    about,
  }), {
    shouldThrow: true,
  });

  // `createChannel` can return a lot of different update types according to docs,
  // but currently channel creation returns only `Updates` type.
  // Errors are added to catch unexpected cases in future testing
  if (!(result instanceof GramJs.Updates)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Unexpected channel creation update', result);
    }
    return undefined;
  }

  const newChannel = result.chats[0];
  if (!newChannel || !(newChannel instanceof GramJs.Channel)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Created channel not found', result);
    }
    return undefined;
  }

  const channel = buildApiChatFromPreview(newChannel)!;

  let missingUsers: ApiMissingInvitedUser[] | undefined;

  if (users?.length) {
    const invitedUsers = await invokeRequest(new GramJs.channels.InviteToChannel({
      channel: buildInputEntity(channel.id, channel.accessHash) as GramJs.InputChannel,
      users: users.map(({ id, accessHash }) => buildInputEntity(id, accessHash)) as GramJs.InputUser[],
    }));
    if (!invitedUsers) return undefined;

    handleGramJsUpdate(invitedUsers.updates);
    missingUsers = invitedUsers.missingInvitees.map(buildApiMissingInvitedUser);
  }

  return { channel, missingUsers };
}

export function joinChannel({
  channelId, accessHash,
}: {
  channelId: string; accessHash: string;
}) {
  return invokeRequest(new GramJs.channels.JoinChannel({
    channel: buildInputEntity(channelId, accessHash) as GramJs.InputChannel,
  }), {
    shouldReturnTrue: true,
    shouldThrow: true,
  });
}

export function deleteChatUser({
  chat, user, shouldRevokeHistory,
}: {
  chat: ApiChat; user: ApiUser; shouldRevokeHistory?: boolean;
}) {
  if (chat.type !== 'chatTypeBasicGroup') return undefined;
  return invokeRequest(new GramJs.messages.DeleteChatUser({
    chatId: buildInputEntity(chat.id, chat.accessHash) as BigInt.BigInteger,
    userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    revokeHistory: shouldRevokeHistory || undefined,
  }), {
    shouldReturnTrue: true,
  });
}

export function deleteChat({
  chatId,
}: {
  chatId: string;
}) {
  return invokeRequest(new GramJs.messages.DeleteChat({
    chatId: buildInputEntity(chatId) as BigInt.BigInteger,
  }), {
    shouldReturnTrue: true,
  });
}

export function leaveChannel({
  channelId, accessHash,
}: {
  channelId: string; accessHash: string;
}) {
  return invokeRequest(new GramJs.channels.LeaveChannel({
    channel: buildInputEntity(channelId, accessHash) as GramJs.InputChannel,
  }), {
    shouldReturnTrue: true,
  });
}

export function deleteChannel({
  channelId, accessHash,
}: {
  channelId: string; accessHash: string;
}) {
  return invokeRequest(new GramJs.channels.DeleteChannel({
    channel: buildInputEntity(channelId, accessHash) as GramJs.InputChannel,
  }), {
    shouldReturnTrue: true,
  });
}

export async function createGroupChat({
  title, users,
}: {
  title: string; users: ApiUser[];
}) {
  const invitedUsers = await invokeRequest(new GramJs.messages.CreateChat({
    title,
    users: users.map(({ id, accessHash }) => buildInputEntity(id, accessHash)) as GramJs.InputUser[],
  }));
  if (!invitedUsers) return undefined;

  handleGramJsUpdate(invitedUsers.updates);
  const missingUsers = invitedUsers.missingInvitees.map(buildApiMissingInvitedUser);

  const newChat = (invitedUsers.updates as GramJs.Updates).chats[0];
  if (!newChat || !(newChat instanceof GramJs.Chat)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Created chat not found', invitedUsers.updates);
    }
    return undefined;
  }

  return { chat: buildApiChatFromPreview(newChat), missingUsers };
}

export async function editChatPhoto({
  chatId, accessHash, photo,
}: {
  chatId: string; accessHash?: string; photo?: File | ApiPhoto;
}) {
  const inputEntity = buildInputEntity(chatId, accessHash);
  let inputPhoto: GramJs.TypeInputChatPhoto;
  if (photo instanceof File) {
    const uploadedPhoto = await uploadFile(photo);
    inputPhoto = new GramJs.InputChatUploadedPhoto({
      file: uploadedPhoto,
    });
  } else if (photo) {
    const photoId = buildInputPhoto(photo);
    if (!photoId) return false;
    inputPhoto = new GramJs.InputChatPhoto({
      id: photoId,
    });
  } else {
    inputPhoto = new GramJs.InputChatPhotoEmpty();
  }
  return invokeRequest(
    inputEntity instanceof GramJs.InputChannel
      ? new GramJs.channels.EditPhoto({
        channel: inputEntity as GramJs.InputChannel,
        photo: inputPhoto,
      })
      : new GramJs.messages.EditChatPhoto({
        chatId: inputEntity as BigInt.BigInteger,
        photo: inputPhoto,
      }),
    {
      shouldReturnTrue: true,
    },
  );
}

export async function toggleChatPinned({
  chat,
  shouldBePinned,
}: {
  chat: ApiChat;
  shouldBePinned: boolean;
}) {
  const { id, accessHash } = chat;

  const isActionSuccessful = await invokeRequest(new GramJs.messages.ToggleDialogPin({
    peer: new GramJs.InputDialogPeer({
      peer: buildInputPeer(id, accessHash),
    }),
    pinned: shouldBePinned || undefined,
  }));

  if (isActionSuccessful) {
    sendApiUpdate({
      '@type': 'updateChatPinned',
      id: chat.id,
      isPinned: shouldBePinned,
    });
  }
}

export async function toggleSavedDialogPinned({
  chat, shouldBePinned,
}: {
  chat: ApiChat;
  shouldBePinned: boolean;
}) {
  const { id, accessHash } = chat;

  const isActionSuccessful = await invokeRequest(new GramJs.messages.ToggleSavedDialogPin({
    peer: new GramJs.InputDialogPeer({
      peer: buildInputPeer(id, accessHash),
    }),
    pinned: shouldBePinned || undefined,
  }));

  if (isActionSuccessful) {
    sendApiUpdate({
      '@type': 'updateSavedDialogPinned',
      id: chat.id,
      isPinned: shouldBePinned,
    });
  }
}

export function toggleChatArchived({
  chat, folderId,
}: {
  chat: ApiChat; folderId: number;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.folders.EditPeerFolders({
    folderPeers: [new GramJs.InputFolderPeer({
      peer: buildInputPeer(id, accessHash),
      folderId,
    })],
  }), {
    shouldReturnTrue: true,
  });
}

export async function fetchChatFolders() {
  const result = await invokeRequest(new GramJs.messages.GetDialogFilters());

  if (!result) {
    return undefined;
  }
  const { filters } = result;

  const defaultFolderPosition = filters.findIndex((folder) => folder instanceof GramJs.DialogFilterDefault);
  const dialogFilters = filters.filter(isChatFolder);
  const orderedIds = dialogFilters.map(({ id }) => id);
  if (defaultFolderPosition !== -1) {
    orderedIds.splice(defaultFolderPosition, 0, ALL_FOLDER_ID);
  }
  return {
    byId: buildCollectionByKey(
      dialogFilters
        .map(buildApiChatFolder), 'id',
    ) as Record<number, ApiChatFolder>,
    orderedIds,
  };
}

export async function fetchRecommendedChatFolders() {
  const results = await invokeRequest(new GramJs.messages.GetSuggestedDialogFilters());

  if (!results) {
    return undefined;
  }

  return results.map(buildApiChatFolderFromSuggested).filter(Boolean);
}

export async function editChatFolder({
  id,
  folderUpdate,
}: {
  id: number;
  folderUpdate: ApiChatFolder;
}) {
  // Telegram ignores excluded chats if they also present in the included list
  folderUpdate.excludedChatIds = folderUpdate.excludedChatIds.filter((chatId) => {
    return !folderUpdate.includedChatIds.includes(chatId);
  });

  const filter = buildFilterFromApiFolder(folderUpdate);

  const isActionSuccessful = await invokeRequest(new GramJs.messages.UpdateDialogFilter({
    id,
    filter,
  }));

  if (isActionSuccessful) {
    sendApiUpdate({
      '@type': 'updateChatFolder',
      id,
      folder: folderUpdate,
    });
  }
}

export async function deleteChatFolder(id: number) {
  const isActionSuccessful = await invokeRequest(new GramJs.messages.UpdateDialogFilter({
    id,
    filter: undefined,
  }));
  const recommendedChatFolders = await fetchRecommendedChatFolders();

  if (isActionSuccessful) {
    sendApiUpdate({
      '@type': 'updateChatFolder',
      id,
      folder: undefined,
    });
  }
  if (recommendedChatFolders) {
    sendApiUpdate({
      '@type': 'updateRecommendedChatFolders',
      folders: recommendedChatFolders,
    });
  }
}

export function sortChatFolders(ids: number[]) {
  return invokeRequest(new GramJs.messages.UpdateDialogFiltersOrder({
    order: ids,
  }));
}

export async function toggleDialogUnread({
  chat, hasUnreadMark,
}: {
  chat: ApiChat; hasUnreadMark: boolean | undefined;
}) {
  const { id, accessHash } = chat;

  const isActionSuccessful = await invokeRequest(new GramJs.messages.MarkDialogUnread({
    peer: new GramJs.InputDialogPeer({
      peer: buildInputPeer(id, accessHash),
    }),
    unread: hasUnreadMark || undefined,
  }));

  if (isActionSuccessful) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: chat.id,
      chat: { hasUnreadMark },
    });
  }
}

export async function getChatByPhoneNumber(phoneNumber: string) {
  const result = await invokeRequest(new GramJs.contacts.ResolvePhone({
    phone: phoneNumber,
  }));

  return processResolvedPeer(result);
}

export async function getChatByUsername(username: string, referrer?: string) {
  const result = await invokeRequest(new GramJs.contacts.ResolveUsername({
    username,
    referer: referrer,
  }));

  return processResolvedPeer(result);
}

function processResolvedPeer(result?: GramJs.contacts.TypeResolvedPeer) {
  if (!result) {
    return undefined;
  }

  const { users, chats } = result;

  const chat = chats.length
    ? buildApiChatFromPreview(chats[0])
    : buildApiChatFromPreview(users[0]);

  if (!chat) {
    return undefined;
  }

  return {
    chat,
    user: buildApiUser(users[0]),
  };
}

export function togglePreHistoryHidden({
  chat, isEnabled,
}: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;
  const channel = buildInputEntity(id, accessHash);

  return invokeRequest(new GramJs.channels.TogglePreHistoryHidden({
    channel: channel as GramJs.InputChannel,
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
}

export function updateChatDefaultBannedRights({
  chat, bannedRights,
}: { chat: ApiChat; bannedRights: ApiChatBannedRights }) {
  const { id, accessHash } = chat;
  const peer = buildInputPeer(id, accessHash);

  return invokeRequest(new GramJs.messages.EditChatDefaultBannedRights({
    peer,
    bannedRights: buildChatBannedRights(bannedRights),
  }), {
    shouldReturnTrue: true,
  });
}

export function updateChatMemberBannedRights({
  chat, user, bannedRights, untilDate,
}: { chat: ApiChat; user: ApiUser; bannedRights: ApiChatBannedRights; untilDate?: number }) {
  const channel = buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel;
  const participant = buildInputPeer(user.id, user.accessHash) as GramJs.InputUser;

  return invokeRequest(new GramJs.channels.EditBanned({
    channel,
    participant,
    bannedRights: buildChatBannedRights(bannedRights, untilDate),
  }), {
    shouldReturnTrue: true,
  });
}

export function updateChatAdmin({
  chat, user, adminRights, customTitle = '',
}: { chat: ApiChat; user: ApiUser; adminRights: ApiChatAdminRights; customTitle?: string }) {
  const channel = buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel;
  const userId = buildInputEntity(user.id, user.accessHash) as GramJs.InputUser;

  return invokeRequest(new GramJs.channels.EditAdmin({
    channel,
    userId,
    adminRights: buildChatAdminRights(adminRights),
    rank: customTitle,
  }), {
    shouldReturnTrue: true,
  });
}

export async function updateChatTitle(chat: ApiChat, title: string) {
  const inputEntity = buildInputEntity(chat.id, chat.accessHash);
  await invokeRequest(
    inputEntity instanceof GramJs.InputChannel
      ? new GramJs.channels.EditTitle({
        channel: inputEntity as GramJs.InputChannel,
        title,
      }) : new GramJs.messages.EditChatTitle({
        chatId: inputEntity as BigInt.BigInteger,
        title,
      }),
    {
      shouldReturnTrue: true,
    },
  );
}

export async function updateChatAbout(chat: ApiChat, about: string) {
  const result = await invokeRequest(new GramJs.messages.EditChatAbout({
    peer: buildInputPeer(chat.id, chat.accessHash),
    about,
  }));

  if (!result) {
    return;
  }

  sendApiUpdate({
    '@type': 'updateChatFullInfo',
    id: chat.id,
    fullInfo: {
      about,
    },
  });
}

export function toggleSignatures({
  chat, areSignaturesEnabled, areProfilesEnabled,
}: {
  chat: ApiChat;
  areSignaturesEnabled: boolean;
  areProfilesEnabled: boolean;
}) {
  const { id, accessHash } = chat;
  const channel = buildInputEntity(id, accessHash);

  return invokeRequest(new GramJs.channels.ToggleSignatures({
    channel: channel as GramJs.InputChannel,
    signaturesEnabled: areSignaturesEnabled || undefined,
    profilesEnabled: areProfilesEnabled || undefined,
  }), {
    shouldReturnTrue: true,
  });
}

type ChannelMembersFilter =
  'kicked'
  | 'admin'
  | 'recent'
  | 'search';

export async function fetchMembers({
  chat,
  memberFilter = 'recent',
  offset,
  query = '',
} : {
  chat: ApiChat;
  memberFilter?: ChannelMembersFilter;
  offset?: number;
  query?: string;
}) {
  let filter: GramJs.TypeChannelParticipantsFilter;

  switch (memberFilter) {
    case 'kicked':
      filter = new GramJs.ChannelParticipantsKicked({ q: query });
      break;
    case 'admin':
      filter = new GramJs.ChannelParticipantsAdmins();
      break;
    case 'search':
      filter = new GramJs.ChannelParticipantsSearch({ q: query });
      break;
    default:
      filter = new GramJs.ChannelParticipantsRecent();
      break;
  }

  const result = await invokeRequest(new GramJs.channels.GetParticipants({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    filter,
    offset,
    limit: MEMBERS_LOAD_SLICE,
  }), {
    abortControllerChatId: chat.id,
  });

  if (!result || result instanceof GramJs.channels.ChannelParticipantsNotModified) {
    return undefined;
  }

  const userStatusesById = buildApiUserStatuses(result.users);

  return {
    members: buildChatMembers(result),
    userStatusesById,
  };
}

export async function fetchMember({
  chat,
  peer,
}: {
  chat: ApiChat;
  peer?: ApiPeer;
}) {
  const participant = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();

  const result = await invokeRequest(new GramJs.channels.GetParticipant({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    participant,
  }), {
    abortControllerChatId: chat.id,
  });

  if (!result) {
    return undefined;
  }

  const userStatusesById = buildApiUserStatuses(result.users);
  const member = buildChatMember(result.participant);

  if (!member) {
    return undefined;
  }

  return {
    member,
    userStatusesById,
  };
}

export async function fetchGroupsForDiscussion() {
  const result = await invokeRequest(new GramJs.channels.GetGroupsForDiscussion());

  if (!result) {
    return undefined;
  }

  return result.chats.map((chat) => buildApiChatFromPreview(chat));
}

export function setDiscussionGroup({
  channel,
  chat,
}: {
  channel: ApiChat;
  chat?: ApiChat;
}) {
  return invokeRequest(new GramJs.channels.SetDiscussionGroup({
    broadcast: buildInputPeer(channel.id, channel.accessHash),
    group: chat ? buildInputPeer(chat.id, chat.accessHash) : new GramJs.InputChannelEmpty(),
  }), {
    shouldReturnTrue: true,
  });
}

export async function migrateChat(chat: ApiChat) {
  const result = await invokeRequest(
    new GramJs.messages.MigrateChat({ chatId: buildInputEntity(chat.id) as BigInt.BigInteger }),
    {
      shouldThrow: true,
    },
  );

  // `migrateChat` can return a lot of different update types according to docs,
  // but currently chat migrations returns only `Updates` type.
  // Errors are added to catch unexpected cases in future testing
  if (!result || !(result instanceof GramJs.Updates)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Unexpected channel creation update', result);
    }

    return undefined;
  }

  const newChannelId = result.updates
    .find((update): update is GramJs.UpdateChannel => update instanceof GramJs.UpdateChannel)!.channelId;

  const newChannel = result.chats.find((c) => (
    c instanceof GramJs.Channel && c.id.toString() === newChannelId.toString()
  ))!;

  return buildApiChatFromPreview(newChannel);
}

export async function checkChatInvite(hash: string) {
  const result = await invokeRequest(new GramJs.messages.CheckChatInvite({ hash }));

  if (!result) {
    return undefined;
  }

  if (result instanceof GramJs.ChatInvite) {
    return {
      chat: undefined,
      invite: buildApiChatInviteInfo(result),
      users: result.participants?.map(buildApiUser).filter(Boolean),
    };
  }

  const chat = buildApiChatFromPreview(result.chat);
  if (!chat) {
    return undefined;
  }

  return { chat, invite: undefined, users: undefined };
}

export async function addChatMembers(chat: ApiChat, users: ApiUser[]) {
  try {
    if (chat.type === 'chatTypeChannel' || chat.type === 'chatTypeSuperGroup') {
      const invitedUsers = await invokeRequest(new GramJs.channels.InviteToChannel({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        users: users.map((user) => buildInputEntity(user.id, user.accessHash)) as GramJs.InputUser[],
      }));
      if (!invitedUsers) return undefined;
      handleGramJsUpdate(invitedUsers.updates);
      return invitedUsers.missingInvitees.map(buildApiMissingInvitedUser);
    }

    const addChatUsersResult = await Promise.all(
      users.map(async (user) => {
        const invitedUsers = await invokeRequest(new GramJs.messages.AddChatUser({
          chatId: buildInputEntity(chat.id) as BigInt.BigInteger,
          userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
        }));
        if (!invitedUsers) return undefined;
        handleGramJsUpdate(invitedUsers.updates);
        return invitedUsers.missingInvitees.map(buildApiMissingInvitedUser);
      }),
    );
    if (addChatUsersResult) {
      return addChatUsersResult.flat().filter(Boolean);
    }
  } catch (err: unknown) {
    const message = err instanceof RPCError ? err.errorMessage : (err as Error).message;
    sendApiUpdate({
      '@type': 'error',
      error: {
        message,
      },
    });
  }
  return undefined;
}

export function deleteChatMember(chat: ApiChat, user: ApiUser) {
  if (chat.type === 'chatTypeChannel' || chat.type === 'chatTypeSuperGroup') {
    return updateChatMemberBannedRights({
      chat,
      user,
      bannedRights: {
        viewMessages: true,
        sendMessages: true,
        sendMedia: true,
        sendStickers: true,
        sendGifs: true,
        sendGames: true,
        sendInline: true,
        embedLinks: true,
        sendPolls: true,
        changeInfo: true,
        inviteUsers: true,
        pinMessages: true,
        manageTopics: true,
        sendPhotos: true,
        sendVideos: true,
        sendRoundvideos: true,
        sendAudios: true,
        sendVoices: true,
        sendDocs: true,
        sendPlain: true,
      },
      untilDate: MAX_INT_32,
    });
  } else {
    return invokeRequest(new GramJs.messages.DeleteChatUser({
      chatId: buildInputEntity(chat.id) as BigInt.BigInteger,
      userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    }), {
      shouldReturnTrue: true,
    });
  }
}

export function toggleJoinToSend(chat: ApiChat, isEnabled: boolean) {
  return invokeRequest(new GramJs.channels.ToggleJoinToSend({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleJoinRequest(chat: ApiChat, isEnabled: boolean) {
  return invokeRequest(new GramJs.channels.ToggleJoinRequest({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
}

function preparePeers(
  result: GramJs.messages.Dialogs | GramJs.messages.DialogsSlice | GramJs.messages.PeerDialogs |
  GramJs.messages.SavedDialogs | GramJs.messages.SavedDialogsSlice,
  currentStore?: Record<string, GramJs.TypeChat | GramJs.TypeUser>,
) {
  const store: Record<string, GramJs.TypeChat | GramJs.TypeUser> = {};

  result.chats?.forEach((chat) => {
    const key = `chat${chat.id}`;

    if (currentStore?.[key] && 'min' in chat && chat.min) {
      return;
    }

    store[key] = chat;
  });

  result.users?.forEach((user) => {
    const key = `user${user.id}`;

    if (currentStore?.[key] && 'min' in user && user.min) {
      return;
    }

    store[key] = user;
  });

  return store;
}

export async function importChatInvite({ hash }: { hash: string }) {
  const updates = await invokeRequest(new GramJs.messages.ImportChatInvite({ hash }));
  if (!(updates instanceof GramJs.Updates) || !updates.chats.length) {
    return undefined;
  }

  return buildApiChatFromPreview(updates.chats[0]);
}

export function setChatEnabledReactions({
  chat, enabledReactions, reactionsLimit,
}: {
  chat: ApiChat; enabledReactions?: ApiChatReactions; reactionsLimit?: number;
}) {
  return invokeRequest(new GramJs.messages.SetChatAvailableReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    availableReactions: buildInputChatReactions(enabledReactions),
    reactionsLimit,
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleIsProtected({
  chat, isProtected,
}: { chat: ApiChat; isProtected: boolean }) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.messages.ToggleNoForwards({
    peer: buildInputPeer(id, accessHash),
    enabled: isProtected,
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleParticipantsHidden({
  chat, isEnabled,
}: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.channels.ToggleParticipantsHidden({
    channel: buildInputPeer(id, accessHash),
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleForum({
  chat, isEnabled,
}: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.channels.ToggleForum({
    channel: buildInputPeer(id, accessHash),
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
    shouldThrow: true,
  });
}

export async function createTopic({
  chat, title, iconColor, iconEmojiId, sendAs,
}: {
  chat: ApiChat;
  title: string;
  iconColor?: number;
  iconEmojiId?: string;
  sendAs?: ApiPeer;
}) {
  const { id, accessHash } = chat;

  const updates = await invokeRequest(new GramJs.channels.CreateForumTopic({
    channel: buildInputPeer(id, accessHash),
    title,
    iconColor,
    iconEmojiId: iconEmojiId ? BigInt(iconEmojiId) : undefined,
    sendAs: sendAs ? buildInputPeer(sendAs.id, sendAs.accessHash) : undefined,
    randomId: generateRandomBigInt(),
  }));

  if (!(updates instanceof GramJs.Updates) || !updates.updates.length) {
    return undefined;
  }

  // Finding topic id in updates
  return updates.updates?.find((update): update is GramJs.UpdateMessageID => (
    update instanceof GramJs.UpdateMessageID
  ))?.id;
}

export async function fetchTopics({
  chat, query, offsetTopicId, offsetId, offsetDate, limit = TOPICS_SLICE,
}: {
  chat: ApiChat;
  query?: string;
  offsetTopicId?: number;
  offsetId?: number;
  offsetDate?: number;
  limit?: number;
}): Promise<{
    topics: ApiTopic[];
    messages: ApiMessage[];
    count: number;
    shouldOrderByCreateDate?: boolean;
    draftsById: Record<number, ReturnType<typeof buildMessageDraft>>;
    readInboxMessageIdByTopicId: Record<number, number>;
  } | undefined> {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.channels.GetForumTopics({
    channel: buildInputPeer(id, accessHash),
    limit,
    q: query,
    offsetTopic: offsetTopicId,
    offsetId,
    offsetDate,
  }));

  if (!result) return undefined;

  const { count, orderByCreateDate } = result;

  const topics = result.topics.map(buildApiTopic).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const draftsById = result.topics.reduce((acc, topic) => {
    if (topic instanceof GramJs.ForumTopic && topic.draft) {
      acc[topic.id] = buildMessageDraft(topic.draft);
    }
    return acc;
  }, {} as Record<number, ReturnType<typeof buildMessageDraft>>);
  const readInboxMessageIdByTopicId = result.topics.reduce((acc, topic) => {
    if (topic instanceof GramJs.ForumTopic && topic.readInboxMaxId) {
      acc[topic.id] = topic.readInboxMaxId;
    }
    return acc;
  }, {} as Record<number, number>);

  return {
    topics,
    messages,
    // Include general topic
    count: count + 1,
    shouldOrderByCreateDate: orderByCreateDate,
    draftsById,
    readInboxMessageIdByTopicId,
  };
}

export async function fetchTopicById({
  chat, topicId,
}: {
  chat: ApiChat;
  topicId: number;
}): Promise<{
    topic: ApiTopic;
    messages: ApiMessage[];
  } | undefined> {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.channels.GetForumTopicsByID({
    channel: buildInputPeer(id, accessHash),
    topics: [topicId],
  }));

  if (!result?.topics.length || !(result.topics[0] instanceof GramJs.ForumTopic)) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    topic: buildApiTopic(result.topics[0])!,
    messages,
  };
}

export async function deleteTopic({
  chat, topicId,
}: {
  chat: ApiChat;
  topicId: number;
}) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.channels.DeleteTopicHistory({
    channel: buildInputPeer(id, accessHash),
    topMsgId: topicId,
  }));

  if (!result) return;

  processAffectedHistory(chat, result);

  if (result.offset) {
    await deleteTopic({ chat, topicId });
  }
}

export function togglePinnedTopic({
  chat, topicId, isPinned,
}: {
  chat: ApiChat;
  topicId: number;
  isPinned: boolean;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.channels.UpdatePinnedForumTopic({
    channel: buildInputPeer(id, accessHash),
    topicId,
    pinned: isPinned,
  }), {
    shouldReturnTrue: true,
  });
}

export function editTopic({
  chat, topicId, title, iconEmojiId, isClosed, isHidden,
}: {
  chat: ApiChat;
  topicId: number;
  title?: string;
  iconEmojiId?: string;
  isClosed?: boolean;
  isHidden?: boolean;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.channels.EditForumTopic({
    channel: buildInputPeer(id, accessHash),
    topicId,
    title,
    iconEmojiId: topicId !== GENERAL_TOPIC_ID && iconEmojiId ? BigInt(iconEmojiId) : undefined,
    closed: isClosed,
    hidden: isHidden,
  }), {
    shouldReturnTrue: true,
  });
}

export async function checkChatlistInvite({
  slug,
}: {
  slug: string;
}) {
  const result = await invokeRequest(new GramJs.chatlists.CheckChatlistInvite({
    slug,
  }));

  const invite = buildApiChatlistInvite(result, slug);

  if (!result || !invite) return undefined;

  return {
    invite,
  };
}

export function joinChatlistInvite({
  slug,
  peers,
}: {
  slug: string;
  peers: ApiChat[];
}) {
  return invokeRequest(new GramJs.chatlists.JoinChatlistInvite({
    slug,
    peers: peers.map((peer) => buildInputPeer(peer.id, peer.accessHash)),
  }), {
    shouldReturnTrue: true,
    shouldThrow: true,
  });
}

export async function fetchLeaveChatlistSuggestions({
  folderId,
}: {
  folderId: number;
}) {
  const result = await invokeRequest(new GramJs.chatlists.GetLeaveChatlistSuggestions({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
  }));

  if (!result) return undefined;

  return result.map(getApiChatIdFromMtpPeer);
}

export function leaveChatlist({
  folderId,
  peers,
}: {
  folderId: number;
  peers: ApiChat[];
}) {
  return invokeRequest(new GramJs.chatlists.LeaveChatlist({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
    peers: peers.map((peer) => buildInputPeer(peer.id, peer.accessHash)),
  }), {
    shouldReturnTrue: true,
  });
}

export async function createChalistInvite({
  folderId, title, peers,
}: {
  folderId: number;
  title?: string;
  peers: ApiPeer[];
}) {
  const result = await invokeRequest(new GramJs.chatlists.ExportChatlistInvite({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
    title: title || '',
    peers: peers.map((peer) => buildInputPeer(peer.id, peer.accessHash)),
  }), {
    shouldThrow: true,
  });

  if (!result || result.filter instanceof GramJs.DialogFilterDefault) return undefined;

  return {
    filter: buildApiChatFolder(result.filter),
    invite: buildApiChatlistExportedInvite(result.invite),
  };
}

export function deleteChatlistInvite({
  folderId, slug,
}: {
  folderId: number;
  slug: string;
}) {
  return invokeRequest(new GramJs.chatlists.DeleteExportedInvite({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
    slug,
  }));
}

export async function editChatlistInvite({
  folderId, slug, title, peers,
}: {
  folderId: number;
  slug: string;
  title?: string;
  peers: ApiPeer[];
}) {
  const result = await invokeRequest(new GramJs.chatlists.EditExportedInvite({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
    slug,
    title,
    peers: peers.map((peer) => buildInputPeer(peer.id, peer.accessHash)),
  }), {
    shouldThrow: true,
  });
  if (!result) return undefined;

  return buildApiChatlistExportedInvite(result);
}

export async function fetchChatlistInvites({
  folderId,
}: {
  folderId: number;
}) {
  const result = await invokeRequest(new GramJs.chatlists.GetExportedInvites({
    chatlist: new GramJs.InputChatlistDialogFilter({
      filterId: folderId,
    }),
  }));

  if (!result) return undefined;

  return {
    invites: result.invites.map(buildApiChatlistExportedInvite).filter(Boolean),
  };
}

export function togglePeerTranslations({
  chat, isEnabled,
}: {
  chat: ApiChat;
  isEnabled: boolean;
}) {
  return invokeRequest(new GramJs.messages.TogglePeerTranslations({
    disabled: isEnabled ? undefined : true,
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));
}

export function setViewForumAsMessages({ chat, isEnabled }: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;
  const channel = buildInputEntity(id, accessHash);

  return invokeRequest(new GramJs.channels.ToggleViewForumAsMessages({
    channel: channel as GramJs.InputChannel,
    enabled: Boolean(isEnabled),
  }), {
    shouldReturnTrue: true,
  });
}

export async function fetchChannelRecommendations({ chat }: { chat?: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.GetChannelRecommendations({
    channel: chat && buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
  }));
  if (!result) {
    return undefined;
  }

  const similarChannels = result?.chats
    .map((c) => buildApiChatFromPreview(c))
    .filter(Boolean);

  return {
    similarChannels,
    count: result instanceof GramJs.messages.ChatsSlice ? result.count : similarChannels.length,
  };
}
