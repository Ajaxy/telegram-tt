import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiChatFullInfo, ApiCommunityLinkedPeer,
} from '../../types';

import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiPhoto } from '../apiBuilders/common';
import { buildApiMessage } from '../apiBuilders/messages';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildInputChannel, buildInputPeer } from '../gramjsBuilders';
import { addPhotoToLocalDb } from '../helpers/localDb';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { handleGramJsUpdate, invokeRequest } from './client';

export async function fetchJoinedCommunities() {
  const result = await invokeRequest(new GramJs.communities.GetJoinedCommunities());
  if (!result) {
    return undefined;
  }

  const communities = result.chats.map((chat) => buildApiChatFromPreview(chat)).filter(Boolean);

  return { communities };
}

export async function toggleCommunityCollapsedInDialogs({
  community, isCollapsed,
}: {
  community: ApiChat;
  isCollapsed?: boolean;
}) {
  const result = await invokeRequest(new GramJs.communities.ToggleCommunityCollapsedInDialogs({
    community: buildInputChannel(community.id, community.accessHash),
    collapsed: isCollapsed || undefined,
  }));

  if (result) {
    handleGramJsUpdate(result);
  }

  return Boolean(result);
}

export async function fetchCommunityFullInfo({ community }: { community: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.GetFullChannel({
    channel: buildInputChannel(community.id, community.accessHash),
  }));

  if (!result || !(result.fullChat instanceof GramJs.CommunityFull)) {
    return undefined;
  }

  const chats = result.chats.map((chat) => buildApiChatFromPreview(chat)).filter(Boolean);

  return {
    fullInfo: buildApiCommunityFullInfo(result.fullChat),
    chats,
  };
}

// Chats a user can only view are missing from the dialog list, so their last message
// is unknown until requested. Fetch it for the whole community in one go.
export async function fetchCommunityPeerDialogs({ peers }: { peers: ApiChat[] }) {
  if (!peers.length) {
    return;
  }

  const result = await invokeRequest(new GramJs.messages.GetPeerDialogs({
    peers: peers.map((peer) => new GramJs.InputDialogPeer({
      peer: buildInputPeer(peer.id, peer.accessHash),
    })),
  }));

  if (!result) {
    return;
  }

  const lastMessages = result.messages.map(buildApiMessage).filter(Boolean);

  result.dialogs.forEach((dialog) => {
    if (!(dialog instanceof GramJs.Dialog)) {
      return;
    }

    const chatId = getApiChatIdFromMtpPeer(dialog.peer);
    const lastMessage = lastMessages.find(
      (message) => message.chatId === chatId && message.id === dialog.topMessage,
    );

    if (!lastMessage) {
      return;
    }

    sendApiUpdate({
      '@type': 'updateChatLastMessage',
      id: chatId,
      lastMessage,
    });
  });
}

function buildApiCommunityFullInfo(fullChat: GramJs.CommunityFull): ApiChatFullInfo {
  const {
    about, chatPhoto, linkedPeers, adminsCount, kickedCount, peerLinkRequestsPending,
  } = fullChat;

  if (chatPhoto instanceof GramJs.Photo) {
    addPhotoToLocalDb(chatPhoto);
  }

  return {
    about,
    profilePhoto: chatPhoto instanceof GramJs.Photo ? buildApiPhoto(chatPhoto) : undefined,
    linkedPeers: linkedPeers.map(buildApiCommunityLinkedPeer),
    adminsCount,
    kickedCount,
    peerLinkRequestsCount: peerLinkRequestsPending,
  };
}

function buildApiCommunityLinkedPeer(linkedPeer: GramJs.TypeCommunityPeer): ApiCommunityLinkedPeer {
  return {
    peerId: getApiChatIdFromMtpPeer(linkedPeer.peer),
    canViewHistory: linkedPeer.canViewHistory,
    isVisible: linkedPeer.visible,
  };
}
