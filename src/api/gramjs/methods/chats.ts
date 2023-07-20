import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import type {
  OnApiUpdate,
  ApiChat,
  ApiMessage,
  ApiUser,
  ApiMessageEntity,
  ApiFormattedText,
  ApiChatFullInfo,
  ApiChatFolder,
  ApiChatBannedRights,
  ApiChatAdminRights,
  ApiGroupCall,
  ApiUserStatus,
  ApiPhoto,
  ApiTopic,
  ApiChatReactions,
} from '../../types';

import {
  DEBUG,
  ARCHIVED_FOLDER_ID,
  MEMBERS_LOAD_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
  ALL_FOLDER_ID,
  MAX_INT_32,
  TOPICS_SLICE,
  GENERAL_TOPIC_ID,
} from '../../../config';
import { invokeRequest, uploadFile } from './client';
import {
  buildApiChatFromDialog,
  getPeerKey,
  buildChatMembers,
  buildApiChatFromPreview,
  buildApiChatFolder,
  buildApiChatFolderFromSuggested,
  buildApiChatBotCommands,
  buildApiChatSettings,
  buildApiChatReactions,
  buildApiTopic,
  buildApiChatlistInvite,
  buildApiChatlistExportedInvite,
} from '../apiBuilders/chats';
import { buildApiMessage, buildMessageDraft } from '../apiBuilders/messages';
import { buildApiUser, buildApiUsersAndStatuses } from '../apiBuilders/users';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  buildInputEntity,
  buildInputPeer,
  buildMtpMessageEntity,
  buildFilterFromApiFolder,
  isMessageWithMedia,
  buildChatBannedRights,
  buildChatAdminRights,
  buildInputChatReactions,
  buildInputPhoto,
  generateRandomBigInt,
} from '../gramjsBuilders';
import {
  addEntitiesToLocalDb,
  addMessageToLocalDb,
  addPhotoToLocalDb,
  isChatFolder,

} from '../helpers';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildApiPhoto } from '../apiBuilders/common';
import { buildStickerSet } from '../apiBuilders/symbols';
import localDb from '../localDb';
import { updateChannelState } from '../updateManager';
import { scheduleMutedChatUpdate } from '../scheduleUnmute';

type FullChatData = {
  fullInfo: ApiChatFullInfo;
  users?: ApiUser[];
  userStatusesById: { [userId: string]: ApiUserStatus };
  groupCall?: Partial<ApiGroupCall>;
  membersCount?: number;
};

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchChats({
  limit,
  offsetDate,
  archived,
  withPinned,
  lastLocalServiceMessage,
}: {
  limit: number;
  offsetDate?: number;
  archived?: boolean;
  withPinned?: boolean;
  lastLocalServiceMessage?: ApiMessage;
}) {
  const result = await invokeRequest(new GramJs.messages.GetDialogs({
    offsetPeer: new GramJs.InputPeerEmpty(),
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

  if (resultPinned) {
    updateLocalDb(resultPinned);
  }
  updateLocalDb(result);

  const lastMessagesByChatId = buildCollectionByKey(
    (resultPinned ? resultPinned.messages : []).concat(result.messages)
      .map(buildApiMessage)
      .filter(Boolean),
    'chatId',
  );

  const peersByKey = preparePeers(result);
  if (resultPinned) {
    Object.assign(peersByKey, preparePeers(resultPinned, peersByKey));
  }

  const chats: ApiChat[] = [];
  const draftsById: Record<string, ApiFormattedText> = {};
  const replyingToById: Record<string, number> = {};

  const dialogs = (resultPinned ? resultPinned.dialogs : []).concat(result.dialogs);

  const orderedPinnedIds: string[] = [];

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

    if (dialog.pts) {
      updateChannelState(chat.id, dialog.pts);
    }

    if (
      chat.id === SERVICE_NOTIFICATIONS_USER_ID
      && lastLocalServiceMessage
      && (!lastMessagesByChatId[chat.id] || lastLocalServiceMessage.date > lastMessagesByChatId[chat.id].date)
    ) {
      chat.lastMessage = lastLocalServiceMessage;
    } else {
      chat.lastMessage = lastMessagesByChatId[chat.id];
    }

    chat.isListed = true;

    chats.push(chat);

    scheduleMutedChatUpdate(chat.id, chat.muteUntil, onUpdate);

    if (withPinned && dialog.pinned) {
      orderedPinnedIds.push(chat.id);
    }

    if (dialog.draft) {
      const { formattedText, replyingToId } = buildMessageDraft(dialog.draft) || {};
      if (formattedText) {
        draftsById[chat.id] = formattedText;
      }
      if (replyingToId) {
        replyingToById[chat.id] = replyingToId;
      }
    }
  });

  const chatIds = chats.map((chat) => chat.id);

  const { users, userStatusesById } = buildApiUsersAndStatuses((resultPinned?.users || []).concat(result.users));

  let totalChatCount: number;
  if (result instanceof GramJs.messages.DialogsSlice) {
    totalChatCount = result.count;
  } else {
    totalChatCount = chatIds.length;
  }

  return {
    chatIds,
    chats,
    users,
    userStatusesById,
    draftsById,
    replyingToById,
    orderedPinnedIds: withPinned ? orderedPinnedIds : undefined,
    totalChatCount,
  };
}

export function fetchFullChat(chat: ApiChat) {
  const { id, accessHash, adminRights } = chat;

  const input = buildInputEntity(id, accessHash);

  return input instanceof GramJs.InputChannel
    ? getFullChannelInfo(id, accessHash!, adminRights)
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

  addEntitiesToLocalDb(result.users);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    settings: buildApiChatSettings(result.settings),
  };
}

export async function searchChats({ query }: { query: string }) {
  const result = await invokeRequest(new GramJs.contacts.Search({ q: query }));
  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  const localPeerIds = result.myResults.map(getApiChatIdFromMtpPeer);
  const allChats = result.chats.concat(result.users)
    .map((user) => buildApiChatFromPreview(user))
    .filter(Boolean);
  const allUsers = result.users.map(buildApiUser).filter((user) => Boolean(user) && !user.isSelf) as ApiUser[];

  return {
    localChats: allChats.filter((r) => localPeerIds.includes(r.id)),
    localUsers: allUsers.filter((u) => localPeerIds.includes(u.id)),
    globalChats: allChats.filter((r) => !localPeerIds.includes(r.id)),
    globalUsers: allUsers.filter((u) => !localPeerIds.includes(u.id)),
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

  onUpdate({
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

  updateLocalDb(result);

  const lastRemoteMessage = buildApiMessage(result.messages[0]);
  const lastMessage = lastLocalMessage && (!lastRemoteMessage || (lastLocalMessage.date > lastRemoteMessage.date))
    ? lastLocalMessage
    : lastRemoteMessage;

  const chatUpdate = {
    ...buildApiChatFromDialog(dialog, peerEntity),
    ...(!noLastMessage && { lastMessage }),
  };

  onUpdate({
    '@type': 'updateChat',
    id,
    chat: chatUpdate,
  });

  scheduleMutedChatUpdate(chatUpdate.id, chatUpdate.muteUntil, onUpdate);
}

export function saveDraft({
  chat,
  text,
  entities,
  threadId,
  replyToMsgId,
}: {
  chat: ApiChat;
  text: string;
  entities?: ApiMessageEntity[];
  threadId?: number;
  replyToMsgId?: number;
}) {
  return invokeRequest(new GramJs.messages.SaveDraft({
    peer: buildInputPeer(chat.id, chat.accessHash),
    message: text,
    ...(entities && {
      entities: entities.map(buildMtpMessageEntity),
    }),
    replyToMsgId,
    topMsgId: threadId,
  }));
}

export function clearDraft(chat: ApiChat, threadId?: number) {
  return invokeRequest(new GramJs.messages.SaveDraft({
    peer: buildInputPeer(chat.id, chat.accessHash),
    message: '',
    ...(threadId && { topMsgId: threadId }),
  }));
}

async function getFullChatInfo(chatId: string): Promise<FullChatData | undefined> {
  const result = await invokeRequest(new GramJs.messages.GetFullChat({
    chatId: buildInputEntity(chatId) as BigInt.BigInteger,
  }));

  if (!result || !(result.fullChat instanceof GramJs.ChatFull)) {
    return undefined;
  }

  updateLocalDb(result);

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
  } = result.fullChat;

  if (chatPhoto instanceof GramJs.Photo) {
    localDb.photos[chatPhoto.id.toString()] = chatPhoto;
  }

  const members = buildChatMembers(participants);
  const adminMembers = members ? members.filter(({ isAdmin, isOwner }) => isAdmin || isOwner) : undefined;
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;
  const inviteLink = exportedInvite instanceof GramJs.ChatInviteExported ? exportedInvite.link : undefined;
  const { users, userStatusesById } = buildApiUsersAndStatuses(result.users);

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
      requestsPending,
      recentRequesterIds: recentRequesters?.map((userId) => buildApiPeerId(userId, 'user')),
      isTranslationDisabled: translationsDisabled,
    },
    users,
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
  id: string,
  accessHash: string,
  adminRights?: ApiChatAdminRights,
): Promise<FullChatData | undefined> {
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
    defaultSendAs,
    requestsPending,
    recentRequesters,
    statsDc,
    participantsCount,
    stickerset,
    chatPhoto,
    participantsHidden,
    translationsDisabled,
  } = result.fullChat;

  if (chatPhoto instanceof GramJs.Photo) {
    localDb.photos[chatPhoto.id.toString()] = chatPhoto;
  }

  const inviteLink = exportedInvite instanceof GramJs.ChatInviteExported
    ? exportedInvite.link
    : undefined;

  const { members, users, userStatusesById } = (canViewParticipants && await fetchMembers(id, accessHash)) || {};
  const { members: kickedMembers, users: bannedUsers, userStatusesById: bannedStatusesById } = (
    canViewParticipants && adminRights && await fetchMembers(id, accessHash, 'kicked')
  ) || {};
  const { members: adminMembers, users: adminUsers, userStatusesById: adminStatusesById } = (
    canViewParticipants && await fetchMembers(id, accessHash, 'admin')
  ) || {};
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;

  if (result?.chats?.length > 1) {
    updateLocalDb(result);

    const [, mtpLinkedChat] = result.chats;
    const chat = buildApiChatFromPreview(mtpLinkedChat);
    if (chat) {
      onUpdate({
        '@type': 'updateChat',
        id: chat.id,
        chat,
      });
    }
  }

  if (result.fullChat.pts) {
    updateChannelState(id, result.fullChat.pts);
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
      isPreHistoryHidden: hiddenPrehistory,
      members,
      kickedMembers,
      adminMembersById: adminMembers ? buildCollectionByKey(adminMembers, 'userId') : undefined,
      groupCallId: call ? String(call.id) : undefined,
      linkedChatId: linkedChatId ? buildApiPeerId(linkedChatId, 'chat') : undefined,
      botCommands,
      enabledReactions: buildApiChatReactions(availableReactions),
      sendAsId: defaultSendAs ? getApiChatIdFromMtpPeer(defaultSendAs) : undefined,
      requestsPending,
      recentRequesterIds: recentRequesters?.map((userId) => buildApiPeerId(userId, 'user')),
      statisticsDcId: statsDc,
      stickerSet: stickerset ? buildStickerSet(stickerset) : undefined,
      areParticipantsHidden: participantsHidden,
      isTranslationDisabled: translationsDisabled,
    },
    users: [...(users || []), ...(bannedUsers || []), ...(adminUsers || [])],
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

  onUpdate({
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

  onUpdate({
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
}, noErrorUpdate = false): Promise<ApiChat | undefined> {
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

  if (users?.length) {
    try {
      await invokeRequest(new GramJs.channels.InviteToChannel({
        channel: buildInputEntity(channel.id, channel.accessHash) as GramJs.InputChannel,
        users: users.map(({ id, accessHash }) => buildInputEntity(id, accessHash)) as GramJs.InputUser[],
      }), {
        shouldThrow: noErrorUpdate,
      });
    } catch (err) {
      // `noErrorUpdate` will cause an exception which we don't want either
    }
  }

  return channel;
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
  chat, user,
}: {
  chat: ApiChat; user: ApiUser;
}) {
  if (chat.type !== 'chatTypeBasicGroup') return undefined;
  return invokeRequest(new GramJs.messages.DeleteChatUser({
    chatId: buildInputEntity(chat.id, chat.accessHash) as BigInt.BigInteger,
    userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
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
}): Promise<ApiChat | undefined> {
  const result = await invokeRequest(new GramJs.messages.CreateChat({
    title,
    users: users.map(({ id, accessHash }) => buildInputEntity(id, accessHash)) as GramJs.InputUser[],
  }), {
    shouldThrow: true,
  });

  // `createChat` can return a lot of different update types according to docs,
  // but currently chat creation returns only `Updates` type.
  // Errors are added to catch unexpected cases in future testing
  if (!(result instanceof GramJs.Updates)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Unexpected chat creation update', result);
    }
    return undefined;
  }

  const newChat = result.chats[0];
  if (!newChat || !(newChat instanceof GramJs.Chat)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Created chat not found', result);
    }
    return undefined;
  }

  return buildApiChatFromPreview(newChat);
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
    onUpdate({
      '@type': 'updateChatPinned',
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

  const defaultFolderPosition = result.findIndex((folder) => folder instanceof GramJs.DialogFilterDefault);
  const dialogFilters = result.filter(isChatFolder);
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
    onUpdate({
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
    onUpdate({
      '@type': 'updateChatFolder',
      id,
      folder: undefined,
    });
  }
  if (recommendedChatFolders) {
    onUpdate({
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
    onUpdate({
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

export async function getChatByUsername(username: string) {
  const result = await invokeRequest(new GramJs.contacts.ResolveUsername({
    username,
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

  updateLocalDb(result);

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

  onUpdate({
    '@type': 'updateChatFullInfo',
    id: chat.id,
    fullInfo: {
      about,
    },
  });
}

export function toggleSignatures({
  chat, isEnabled,
}: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;
  const channel = buildInputEntity(id, accessHash);

  return invokeRequest(new GramJs.channels.ToggleSignatures({
    channel: channel as GramJs.InputChannel,
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
}

type ChannelMembersFilter =
  'kicked'
  | 'admin'
  | 'recent';

export async function fetchMembers(
  chatId: string,
  accessHash: string,
  memberFilter: ChannelMembersFilter = 'recent',
  offset?: number,
) {
  let filter: GramJs.TypeChannelParticipantsFilter;

  switch (memberFilter) {
    case 'kicked':
      filter = new GramJs.ChannelParticipantsKicked({ q: '' });
      break;
    case 'admin':
      filter = new GramJs.ChannelParticipantsAdmins();
      break;
    default:
      filter = new GramJs.ChannelParticipantsRecent();
      break;
  }

  const result = await invokeRequest(new GramJs.channels.GetParticipants({
    channel: buildInputEntity(chatId, accessHash) as GramJs.InputChannel,
    filter,
    offset,
    limit: MEMBERS_LOAD_SLICE,
  }), {
    abortControllerChatId: chatId,
  });

  if (!result || result instanceof GramJs.channels.ChannelParticipantsNotModified) {
    return undefined;
  }

  updateLocalDb(result);
  const { users, userStatusesById } = buildApiUsersAndStatuses(result.users);

  return {
    members: buildChatMembers(result),
    users,
    userStatusesById,
  };
}

export async function fetchGroupsForDiscussion() {
  const result = await invokeRequest(new GramJs.channels.GetGroupsForDiscussion());

  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

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

  updateLocalDb(result);

  return buildApiChatFromPreview(result.chats[1]);
}

export async function openChatByInvite(hash: string) {
  const result = await invokeRequest(new GramJs.messages.CheckChatInvite({ hash }));

  if (!result) {
    return undefined;
  }

  let chat: ApiChat | undefined;

  if (result instanceof GramJs.ChatInvite) {
    const {
      photo, participantsCount, title, channel, requestNeeded, about, megagroup,
    } = result;

    if (photo instanceof GramJs.Photo) {
      addPhotoToLocalDb(result.photo);
    }

    onUpdate({
      '@type': 'showInvite',
      data: {
        title,
        about,
        hash,
        participantsCount,
        isChannel: channel && !megagroup,
        isRequestNeeded: requestNeeded,
        ...(photo instanceof GramJs.Photo && { photo: buildApiPhoto(photo) }),
      },
    });
  } else {
    chat = buildApiChatFromPreview(result.chat);

    if (chat) {
      onUpdate({
        '@type': 'updateChat',
        id: chat.id,
        chat,
      });
    }
  }

  if (!chat) {
    return undefined;
  }

  return { chatId: chat.id };
}

export async function addChatMembers(chat: ApiChat, users: ApiUser[], noErrorUpdate = false) {
  try {
    if (chat.type === 'chatTypeChannel' || chat.type === 'chatTypeSuperGroup') {
      return await invokeRequest(new GramJs.channels.InviteToChannel({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        users: users.map((user) => buildInputEntity(user.id, user.accessHash)) as GramJs.InputUser[],
      }), {
        shouldReturnTrue: true,
        shouldThrow: noErrorUpdate,
      });
    }

    return await Promise.all(users.map((user) => {
      return invokeRequest(new GramJs.messages.AddChatUser({
        chatId: buildInputEntity(chat.id) as BigInt.BigInteger,
        userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
      }), {
        shouldReturnTrue: true,
        shouldThrow: noErrorUpdate,
      });
    }));
  } catch (err) {
    // `noErrorUpdate` will cause an exception which we don't want either
    return undefined;
  }
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
  result: GramJs.messages.Dialogs | GramJs.messages.DialogsSlice | GramJs.messages.PeerDialogs,
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

function updateLocalDb(result: (
  GramJs.messages.Dialogs | GramJs.messages.DialogsSlice | GramJs.messages.PeerDialogs |
  GramJs.messages.ChatFull | GramJs.contacts.Found |
  GramJs.contacts.ResolvedPeer | GramJs.channels.ChannelParticipants |
  GramJs.messages.Chats | GramJs.messages.ChatsSlice | GramJs.TypeUpdates | GramJs.messages.ForumTopics
)) {
  if ('users' in result) {
    addEntitiesToLocalDb(result.users);
  }

  if ('chats' in result) {
    addEntitiesToLocalDb(result.chats);
  }

  if ('messages' in result) {
    result.messages.forEach((message) => {
      if (message instanceof GramJs.Message && isMessageWithMedia(message)) {
        addMessageToLocalDb(message);
      }
    });
  }
}

export async function importChatInvite({ hash }: { hash: string }) {
  const updates = await invokeRequest(new GramJs.messages.ImportChatInvite({ hash }));
  if (!(updates instanceof GramJs.Updates) || !updates.chats.length) {
    return undefined;
  }

  return buildApiChatFromPreview(updates.chats[0]);
}

export function setChatEnabledReactions({
  chat, enabledReactions,
}: {
  chat: ApiChat; enabledReactions?: ApiChatReactions;
}) {
  return invokeRequest(new GramJs.messages.SetChatAvailableReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    availableReactions: buildInputChatReactions(enabledReactions),
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
  sendAs?: ApiUser | ApiChat;
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
    users: ApiUser[];
    chats: ApiChat[];
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

  updateLocalDb(result);

  const { count, orderByCreateDate } = result;

  const topics = result.topics.map(buildApiTopic).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
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
    users,
    chats,
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
    users: ApiUser[];
    chats: ApiChat[];
  } | undefined> {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.channels.GetForumTopicsByID({
    channel: buildInputPeer(id, accessHash),
    topics: [topicId],
  }));

  if (!result?.topics.length || !(result.topics[0] instanceof GramJs.ForumTopic)) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    topic: buildApiTopic(result.topics[0])!,
    messages,
    users,
    chats,
  };
}

export function deleteTopic({
  chat, topicId,
}: {
  chat: ApiChat;
  topicId: number;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.channels.DeleteTopicHistory({
    channel: buildInputPeer(id, accessHash),
    topMsgId: topicId,
  }), {
    shouldReturnTrue: true,
  });
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

  updateLocalDb(result);

  return {
    invite,
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
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
  peers: (ApiChat | ApiUser)[];
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
  peers: (ApiChat | ApiUser)[];
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

  updateLocalDb(result);

  return {
    invites: result.invites.map(buildApiChatlistExportedInvite).filter(Boolean),
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
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
