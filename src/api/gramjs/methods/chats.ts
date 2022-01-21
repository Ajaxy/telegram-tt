import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import {
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
} from '../../types';

import {
  DEBUG, ARCHIVED_FOLDER_ID, MEMBERS_LOAD_SLICE, SERVICE_NOTIFICATIONS_USER_ID,
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
  buildApiExportedInvite,
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
} from '../gramjsBuilders';
import { addEntitiesWithPhotosToLocalDb, addMessageToLocalDb, addPhotoToLocalDb } from '../helpers';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildApiPhoto } from '../apiBuilders/common';

const MAX_INT_32 = 2 ** 31 - 1;
let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchChats({
  limit,
  offsetDate,
  archived,
  withPinned,
  serverTimeOffset,
  lastLocalServiceMessage,
}: {
  limit: number;
  offsetDate?: number;
  archived?: boolean;
  withPinned?: boolean;
  serverTimeOffset: number;
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
      .filter<ApiMessage>(Boolean as any),
    'chatId',
  );
  const peersByKey: Record<string, GramJs.TypeChat | GramJs.TypeUser> = {
    ...(resultPinned && preparePeers(resultPinned)),
    ...preparePeers(result),
  };
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
    const chat = buildApiChatFromDialog(dialog, peerEntity, serverTimeOffset);

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

export async function searchChats({ query }: { query: string }) {
  const result = await invokeRequest(new GramJs.contacts.Search({ q: query }));
  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  const localPeerIds = result.myResults.map(getApiChatIdFromMtpPeer);
  const allChats = result.chats.concat(result.users)
    .map((user) => buildApiChatFromPreview(user))
    .filter<ApiChat>(Boolean as any);
  const allUsers = result.users.map(buildApiUser).filter((user) => !!user && !user.isSelf) as ApiUser[];

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
  serverTimeOffset,
  lastLocalMessage,
  noLastMessage,
}: {
  chat: ApiChat; serverTimeOffset: number; lastLocalMessage?: ApiMessage; noLastMessage?: boolean;
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

  onUpdate({
    '@type': 'updateChat',
    id,
    chat: {
      ...buildApiChatFromDialog(dialog, peerEntity, serverTimeOffset),
      ...(!noLastMessage && { lastMessage }),
    },
  });
}

export function saveDraft({
  chat,
  text,
  entities,
  replyToMsgId,
}: {
  chat: ApiChat;
  text: string;
  entities?: ApiMessageEntity[];
  replyToMsgId?: number;
}) {
  return invokeRequest(new GramJs.messages.SaveDraft({
    peer: buildInputPeer(chat.id, chat.accessHash),
    message: text,
    ...(entities && {
      entities: entities.map(buildMtpMessageEntity),
    }),
    replyToMsgId,
  }));
}

export function clearDraft(chat: ApiChat) {
  return invokeRequest(new GramJs.messages.SaveDraft({
    peer: buildInputPeer(chat.id, chat.accessHash),
    message: '',
  }));
}

async function getFullChatInfo(chatId: string): Promise<{
  fullInfo: ApiChatFullInfo;
  users?: ApiUser[];
  groupCall?: Partial<ApiGroupCall>;
} | undefined> {
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
  } = result.fullChat;

  const members = buildChatMembers(participants);
  const adminMembers = members ? members.filter(({ isAdmin, isOwner }) => isAdmin || isOwner) : undefined;
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;

  return {
    fullInfo: {
      about,
      members,
      adminMembers,
      canViewMembers: true,
      botCommands,
      ...(exportedInvite && {
        inviteLink: exportedInvite.link,
      }),
      groupCallId: call?.id.toString(),
      enabledReactions: availableReactions,
    },
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
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
  };
}

async function getFullChannelInfo(
  id: string,
  accessHash: string,
  adminRights?: ApiChatAdminRights,
): Promise<{
    fullInfo: ApiChatFullInfo;
    users?: ApiUser[];
    groupCall?: Partial<ApiGroupCall>;
  } | undefined> {
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
    linkedChatId,
    hiddenPrehistory,
    call,
    botInfo,
    availableReactions,
    defaultSendAs,
  } = result.fullChat;

  const inviteLink = exportedInvite instanceof GramJs.ChatInviteExported
    ? exportedInvite.link
    : undefined;

  const { members, users } = (canViewParticipants && await fetchMembers(id, accessHash)) || {};
  const { members: kickedMembers, users: bannedUsers } = (
    canViewParticipants && adminRights && await fetchMembers(id, accessHash, 'kicked')
  ) || {};
  const { members: adminMembers, users: adminUsers } = (
    canViewParticipants && adminRights && await fetchMembers(id, accessHash, 'admin')
  ) || {};
  const botCommands = botInfo ? buildApiChatBotCommands(botInfo) : undefined;

  if (result?.chats?.length > 1) {
    updateLocalDb(result);

    const [, mtpLinkedChat] = result.chats;
    const chat = buildApiChatFromPreview(mtpLinkedChat, undefined, true);
    if (chat) {
      onUpdate({
        '@type': 'updateChat',
        id: chat.id,
        chat,
      });
    }
  }

  return {
    fullInfo: {
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
      isPreHistoryHidden: hiddenPrehistory,
      members,
      kickedMembers,
      adminMembers,
      groupCallId: call ? String(call.id) : undefined,
      linkedChatId: linkedChatId ? buildApiPeerId(linkedChatId, 'chat') : undefined,
      botCommands,
      enabledReactions: availableReactions,
      sendAsId: defaultSendAs ? getApiChatIdFromMtpPeer(defaultSendAs) : undefined,
    },
    users: [...(users || []), ...(bannedUsers || []), ...(adminUsers || [])],
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
  };
}

export async function updateChatMutedState({
  chat, isMuted, serverTimeOffset,
}: {
  chat: ApiChat; isMuted: boolean; serverTimeOffset: number;
}) {
  await invokeRequest(new GramJs.account.UpdateNotifySettings({
    peer: new GramJs.InputNotifyPeer({
      peer: buildInputPeer(chat.id, chat.accessHash),
    }),
    settings: new GramJs.InputPeerNotifySettings({ muteUntil: isMuted ? MAX_INT_32 : 0 }),
  }));

  onUpdate({
    '@type': 'updateNotifyExceptions',
    chatId: chat.id,
    isMuted,
  });

  void requestChatUpdate({
    chat,
    serverTimeOffset,
    noLastMessage: true,
  });
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
  }));

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
      }), undefined, noErrorUpdate);
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
  }), true);
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
  }), true);
}

export function deleteChat({
  chatId,
}: {
  chatId: string;
}) {
  return invokeRequest(new GramJs.messages.DeleteChat({
    chatId: buildInputEntity(chatId) as BigInt.BigInteger,
  }), true);
}

export function leaveChannel({
  channelId, accessHash,
}: {
  channelId: string; accessHash: string;
}) {
  return invokeRequest(new GramJs.channels.LeaveChannel({
    channel: buildInputEntity(channelId, accessHash) as GramJs.InputChannel,
  }), true);
}

export function deleteChannel({
  channelId, accessHash,
}: {
  channelId: string; accessHash: string;
}) {
  return invokeRequest(new GramJs.channels.DeleteChannel({
    channel: buildInputEntity(channelId, accessHash) as GramJs.InputChannel,
  }), true);
}

export async function createGroupChat({
  title, users,
}: {
  title: string; users: ApiUser[];
}): Promise<ApiChat | undefined> {
  const result = await invokeRequest(new GramJs.messages.CreateChat({
    title,
    users: users.map(({ id, accessHash }) => buildInputEntity(id, accessHash)) as GramJs.InputUser[],
  }), undefined, true);

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
  chatId: string; accessHash?: string; photo: File;
}) {
  const uploadedPhoto = await uploadFile(photo);
  const inputEntity = buildInputEntity(chatId, accessHash);

  return invokeRequest(
    inputEntity instanceof GramJs.InputChannel
      ? new GramJs.channels.EditPhoto({
        channel: inputEntity as GramJs.InputChannel,
        photo: new GramJs.InputChatUploadedPhoto({
          file: uploadedPhoto,
        }),
      })
      : new GramJs.messages.EditChatPhoto({
        chatId: inputEntity as BigInt.BigInteger,
        photo: new GramJs.InputChatUploadedPhoto({
          file: uploadedPhoto,
        }),
      }),
    true,
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
  }), true);
}

export async function fetchChatFolders() {
  const result = await invokeRequest(new GramJs.messages.GetDialogFilters());

  if (!result) {
    return undefined;
  }

  return {
    byId: buildCollectionByKey(result.map(buildApiChatFolder), 'id') as Record<number, ApiChatFolder>,
    orderedIds: result.map(({ id }) => id),
  };
}

export async function fetchRecommendedChatFolders() {
  const results = await invokeRequest(new GramJs.messages.GetSuggestedDialogFilters());

  if (!results) {
    return undefined;
  }

  return results.map(buildApiChatFolderFromSuggested);
}

export async function editChatFolder({
  id,
  folderUpdate,
}: {
  id: number;
  folderUpdate: ApiChatFolder;
}) {
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

export async function getChatByUsername(username: string) {
  const result = await invokeRequest(new GramJs.contacts.ResolveUsername({
    username,
  }));

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

  return chat;
}

export function togglePreHistoryHidden({
  chat, isEnabled,
}: { chat: ApiChat; isEnabled: boolean }) {
  const { id, accessHash } = chat;
  const channel = buildInputEntity(id, accessHash);

  return invokeRequest(new GramJs.channels.TogglePreHistoryHidden({
    channel: channel as GramJs.InputChannel,
    enabled: isEnabled,
  }), true);
}

export function updateChatDefaultBannedRights({
  chat, bannedRights,
}: { chat: ApiChat; bannedRights: ApiChatBannedRights }) {
  const { id, accessHash } = chat;
  const peer = buildInputPeer(id, accessHash);

  return invokeRequest(new GramJs.messages.EditChatDefaultBannedRights({
    peer,
    bannedRights: buildChatBannedRights(bannedRights),
  }), true);
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
  }), true);
}

export function updateChatAdmin({
  chat, user, adminRights, customTitle = '',
}: { chat: ApiChat; user: ApiUser; adminRights: ApiChatAdminRights; customTitle: string }) {
  const channel = buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel;
  const userId = buildInputEntity(user.id, user.accessHash) as GramJs.InputUser;

  return invokeRequest(new GramJs.channels.EditAdmin({
    channel,
    userId,
    adminRights: buildChatAdminRights(adminRights),
    rank: customTitle,
  }), true);
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
    true,
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
  }), true);
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
  }));

  if (!result || result instanceof GramJs.channels.ChannelParticipantsNotModified) {
    return undefined;
  }

  updateLocalDb(result);

  return {
    members: buildChatMembers(result),
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
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
  }), true);
}

export async function migrateChat(chat: ApiChat) {
  const result = await invokeRequest(
    new GramJs.messages.MigrateChat({ chatId: buildInputEntity(chat.id) as BigInt.BigInteger }),
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
      photo, participantsCount, title, channel, requestNeeded, about,
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
        isChannel: channel,
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
      }), true, noErrorUpdate);
    }

    return await Promise.all(users.map((user) => {
      return invokeRequest(new GramJs.messages.AddChatUser({
        chatId: buildInputEntity(chat.id) as BigInt.BigInteger,
        userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
      }), true, noErrorUpdate);
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
      },
      untilDate: MAX_INT_32,
    });
  } else {
    return invokeRequest(new GramJs.messages.DeleteChatUser({
      chatId: buildInputEntity(chat.id) as BigInt.BigInteger,
      userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    }), true);
  }
}

function preparePeers(
  result: GramJs.messages.Dialogs | GramJs.messages.DialogsSlice | GramJs.messages.PeerDialogs,
) {
  const store: Record<string, GramJs.TypeChat | GramJs.TypeUser> = {};

  result.chats.forEach((chat) => {
    store[`chat${chat.id}`] = chat;
  });

  result.users.forEach((user) => {
    store[`user${user.id}`] = user;
  });

  return store;
}

function updateLocalDb(result: (
  GramJs.messages.Dialogs | GramJs.messages.DialogsSlice | GramJs.messages.PeerDialogs |
  GramJs.messages.ChatFull | GramJs.contacts.Found |
  GramJs.contacts.ResolvedPeer | GramJs.channels.ChannelParticipants |
  GramJs.messages.Chats | GramJs.messages.ChatsSlice | GramJs.TypeUpdates
)) {
  if ('users' in result) {
    addEntitiesWithPhotosToLocalDb(result.users);
  }

  if ('chats' in result) {
    addEntitiesWithPhotosToLocalDb(result.chats);
  }

  if ('messages' in result) {
    result.messages.forEach((message) => {
      if (message instanceof GramJs.Message && isMessageWithMedia(message)) {
        addMessageToLocalDb(message);
      }
    });
  }
}

export async function fetchExportedChatInvites({
  peer, admin, limit = 0, isRevoked,
}: { peer: ApiChat; admin: ApiUser; limit: number; isRevoked?: boolean }) {
  const exportedInvites = await invokeRequest(new GramJs.messages.GetExportedChatInvites({
    peer: buildInputPeer(peer.id, peer.accessHash),
    adminId: buildInputEntity(admin.id, admin.accessHash) as GramJs.InputUser,
    limit,
    revoked: isRevoked || undefined,
  }));

  if (!exportedInvites) return undefined;

  return exportedInvites.invites.map(buildApiExportedInvite);
}

export async function editExportedChatInvite({
  peer, isRevoked, link, expireDate, usageLimit, isRequestNeeded, title,
}: {
  peer: ApiChat;
  isRevoked?: boolean;
  link: string;
  expireDate?: number;
  usageLimit?: number;
  isRequestNeeded?: boolean;
  title?: string;
}) {
  const invite = await invokeRequest(new GramJs.messages.EditExportedChatInvite({
    link,
    peer: buildInputPeer(peer.id, peer.accessHash),
    expireDate,
    usageLimit: !isRequestNeeded ? usageLimit : undefined,
    requestNeeded: isRequestNeeded,
    title,
    revoked: isRevoked || undefined,
  }));

  if (!invite) return undefined;

  if (invite instanceof GramJs.messages.ExportedChatInvite) {
    const replaceInvite = buildApiExportedInvite(invite.invite);
    return {
      oldInvite: replaceInvite,
      newInvite: replaceInvite,
    };
  }

  if (invite instanceof GramJs.messages.ExportedChatInviteReplaced) {
    const oldInvite = buildApiExportedInvite(invite.invite);
    const newInvite = buildApiExportedInvite(invite.newInvite);
    return {
      oldInvite,
      newInvite,
    };
  }
  return undefined;
}

export async function exportChatInvite({
  peer, expireDate, usageLimit, isRequestNeeded, title,
}: {
  peer: ApiChat;
  expireDate?: number;
  usageLimit?: number;
  isRequestNeeded?: boolean;
  title?: string;
}) {
  const invite = await invokeRequest(new GramJs.messages.ExportChatInvite({
    peer: buildInputPeer(peer.id, peer.accessHash),
    expireDate,
    usageLimit: !isRequestNeeded ? usageLimit : undefined,
    requestNeeded: isRequestNeeded || undefined,
    title,
  }));

  if (!invite) return undefined;
  return buildApiExportedInvite(invite);
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
  chat: ApiChat; enabledReactions: string[];
}) {
  return invokeRequest(new GramJs.messages.SetChatAvailableReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    availableReactions: enabledReactions,
  }), true);
}

export function toggleIsProtected({
  chat, isProtected,
}: { chat: ApiChat; isProtected: boolean }) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.messages.ToggleNoForwards({
    peer: buildInputPeer(id, accessHash),
    enabled: isProtected,
  }), true);
}
