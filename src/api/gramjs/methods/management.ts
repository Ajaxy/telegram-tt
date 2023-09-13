import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiError, ApiUser, ApiUsername, OnApiUpdate,
} from '../../types';

import { USERNAME_PURCHASE_ERROR } from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import { buildApiExportedInvite, buildChatInviteImporter } from '../apiBuilders/chats';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputEntity, buildInputPeer } from '../gramjsBuilders';
import { addEntitiesToLocalDb } from '../helpers';
import { invokeRequest } from './client';

let onUpdate: OnApiUpdate;

export const ACCEPTABLE_USERNAME_ERRORS = new Set([USERNAME_PURCHASE_ERROR, 'USERNAME_INVALID']);

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function checkChatUsername({ username }: { username: string }) {
  try {
    const result = await invokeRequest(new GramJs.channels.CheckUsername({
      channel: new GramJs.InputChannelEmpty(),
      username,
    }), {
      shouldThrow: true,
    });

    return { result, error: undefined };
  } catch (error) {
    const errorMessage = (error as ApiError).message;

    if (ACCEPTABLE_USERNAME_ERRORS.has(errorMessage)) {
      return {
        result: false,
        error: errorMessage,
      };
    }

    throw error;
  }
}

export async function setChatUsername(
  { chat, username }: { chat: ApiChat; username: string },
) {
  const result = await invokeRequest(new GramJs.channels.UpdateUsername({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    username,
  }));

  let usernames: ApiUsername[] = username ? [{ username, isEditable: true, isActive: true }] : [];
  if (chat.usernames) {
    // User can remove username from chat when changing it type to private, so we need to filter out empty usernames
    usernames = usernames.concat(chat.usernames.filter((u) => u.username && !u.isEditable));
  }

  if (result) {
    onUpdate({
      '@type': 'updateChat',
      id: chat.id,
      chat: { usernames: usernames.length ? usernames : undefined },
    });
  }

  return result;
}

export async function deactivateAllUsernames({ chat }: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.DeactivateAllUsernames({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
  }));

  if (result) {
    const usernames = chat.usernames
      ? chat.usernames
        .map((u) => ({ ...u, isActive: false }))
        // User can remove username from chat when changing it type to private, so we need to filter out empty usernames
        .filter((u) => u.username)
      : undefined;

    onUpdate({
      '@type': 'updateChat',
      id: chat.id,
      chat: { usernames },
    });
  }

  return result;
}

export async function updatePrivateLink({
  chat, usageLimit, expireDate,
}: {
  chat: ApiChat; usageLimit?: number; expireDate?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.ExportChatInvite({
    peer: buildInputPeer(chat.id, chat.accessHash),
    usageLimit,
    expireDate,
  }));

  if (!(result instanceof GramJs.ChatInviteExported)) return undefined;

  onUpdate({
    '@type': 'updateChatFullInfo',
    id: chat.id,
    fullInfo: {
      inviteLink: result.link,
    },
  });

  return result.link;
}

export async function fetchExportedChatInvites({
  peer, admin, limit = 0, isRevoked,
}: { peer: ApiChat; admin: ApiUser; limit?: number; isRevoked?: boolean }) {
  const exportedInvites = await invokeRequest(new GramJs.messages.GetExportedChatInvites({
    peer: buildInputPeer(peer.id, peer.accessHash),
    adminId: buildInputEntity(admin.id, admin.accessHash) as GramJs.InputUser,
    limit,
    revoked: isRevoked || undefined,
  }), {
    abortControllerChatId: peer.id,
  });

  if (!exportedInvites) return undefined;
  addEntitiesToLocalDb(exportedInvites.users);

  const invites = (exportedInvites.invites
    .filter((invite): invite is GramJs.ChatInviteExported => invite instanceof GramJs.ChatInviteExported))
    .map(buildApiExportedInvite);

  return {
    invites,
    users: exportedInvites.users.map(buildApiUser).filter(Boolean),
  };
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

  addEntitiesToLocalDb(invite.users);
  if (invite instanceof GramJs.messages.ExportedChatInvite && invite.invite instanceof GramJs.ChatInviteExported) {
    const replaceInvite = buildApiExportedInvite(invite.invite);
    return {
      oldInvite: replaceInvite,
      newInvite: replaceInvite,
      users: invite.users.map(buildApiUser).filter(Boolean),
    };
  }

  if (invite instanceof GramJs.messages.ExportedChatInviteReplaced
    && invite.invite instanceof GramJs.ChatInviteExported
    && invite.newInvite instanceof GramJs.ChatInviteExported) {
    const oldInvite = buildApiExportedInvite(invite.invite);
    const newInvite = buildApiExportedInvite(invite.newInvite);
    return {
      oldInvite,
      newInvite,
      users: invite.users.map(buildApiUser).filter(Boolean),
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

  if (!(invite instanceof GramJs.ChatInviteExported)) return undefined;
  return buildApiExportedInvite(invite);
}

export async function deleteExportedChatInvite({
  peer, link,
}: {
  peer: ApiChat; link: string;
}) {
  const result = await invokeRequest(new GramJs.messages.DeleteExportedChatInvite({
    peer: buildInputPeer(peer.id, peer.accessHash),
    link,
  }));

  return result;
}

export async function deleteRevokedExportedChatInvites({
  peer, admin,
}: {
  peer: ApiChat; admin: ApiUser;
}) {
  const result = await invokeRequest(new GramJs.messages.DeleteRevokedExportedChatInvites({
    peer: buildInputPeer(peer.id, peer.accessHash),
    adminId: buildInputEntity(admin.id, admin.accessHash) as GramJs.InputUser,
  }));

  return result;
}

export async function fetchChatInviteImporters({
  peer, link, offsetDate = 0, offsetUser, limit = 0, isRequested,
}: {
  peer: ApiChat; link?: string; offsetDate?: number; offsetUser?: ApiUser; limit?: number; isRequested?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.GetChatInviteImporters({
    peer: buildInputPeer(peer.id, peer.accessHash),
    link,
    offsetDate,
    offsetUser: offsetUser
      ? buildInputEntity(offsetUser.id, offsetUser.accessHash) as GramJs.InputUser : new GramJs.InputUserEmpty(),
    limit,
    requested: isRequested || undefined,
  }), {
    abortControllerChatId: peer.id,
  });

  if (!result) return undefined;
  const users = result.users.map((user) => buildApiUser(user)).filter(Boolean);
  addEntitiesToLocalDb(result.users);
  return {
    importers: result.importers.map((importer) => buildChatInviteImporter(importer)),
    users: buildCollectionByKey(users, 'id'),
  };
}

export function hideChatJoinRequest({
  peer,
  user,
  isApproved,
}: {
  peer: ApiChat;
  user: ApiUser;
  isApproved: boolean;
}) {
  return invokeRequest(new GramJs.messages.HideChatJoinRequest({
    peer: buildInputPeer(peer.id, peer.accessHash),
    userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    approved: isApproved || undefined,
  }), {
    shouldReturnTrue: true,
  });
}

export function hideAllChatJoinRequests({
  peer,
  isApproved,
  link,
}: {
  peer: ApiChat;
  isApproved: boolean;
  link?: string;
}) {
  return invokeRequest(new GramJs.messages.HideAllChatJoinRequests({
    peer: buildInputPeer(peer.id, peer.accessHash),
    approved: isApproved || undefined,
    link,
  }), {
    shouldReturnTrue: true,
  });
}

export function hideChatReportPanel(chat: ApiChat) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.messages.HidePeerSettingsBar({
    peer: buildInputPeer(id, accessHash),
  }));
}
