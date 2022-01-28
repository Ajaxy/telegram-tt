import { Api as GramJs } from '../../../lib/gramjs';

import { invokeRequest } from './client';
import { buildInputEntity, buildInputPeer } from '../gramjsBuilders';
import { ApiChat, ApiUser, OnApiUpdate } from '../../types';
import { addEntitiesWithPhotosToLocalDb } from '../helpers';
import { buildApiExportedInvite, buildChatInviteImporter } from '../apiBuilders/chats';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export function checkChatUsername({ username }: { username: string }) {
  return invokeRequest(new GramJs.channels.CheckUsername({
    channel: new GramJs.InputChannelEmpty(),
    username,
  }));
}

export async function setChatUsername(
  { chat, username }: { chat: ApiChat; username: string },
) {
  const result = await invokeRequest(new GramJs.channels.UpdateUsername({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    username,
  }));

  if (result) {
    onUpdate({
      '@type': 'updateChat',
      id: chat.id,
      chat: { username },
    });
  }
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

  if (!result) {
    return undefined;
  }

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
}: { peer: ApiChat; admin: ApiUser; limit: number; isRevoked?: boolean }) {
  const exportedInvites = await invokeRequest(new GramJs.messages.GetExportedChatInvites({
    peer: buildInputPeer(peer.id, peer.accessHash),
    adminId: buildInputEntity(admin.id, admin.accessHash) as GramJs.InputUser,
    limit,
    revoked: isRevoked || undefined,
  }));

  if (!exportedInvites) return undefined;
  addEntitiesWithPhotosToLocalDb(exportedInvites.users);
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

  addEntitiesWithPhotosToLocalDb(invite.users);
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
  peer: ApiChat; link?: string; offsetDate: number; offsetUser?: ApiUser; limit: number; isRequested?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.GetChatInviteImporters({
    peer: buildInputPeer(peer.id, peer.accessHash),
    link,
    offsetDate,
    offsetUser: offsetUser
      ? buildInputEntity(offsetUser.id, offsetUser.accessHash) as GramJs.InputUser : new GramJs.InputUserEmpty(),
    limit,
    requested: isRequested || undefined,
  }));

  if (!result) return undefined;
  addEntitiesWithPhotosToLocalDb(result.users);
  return result.importers.map((importer) => buildChatInviteImporter(importer));
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
  }), true);
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
  }), true);
}
