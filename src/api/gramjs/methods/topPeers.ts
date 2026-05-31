import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiPeer,
  ApiTopPeer,
  ApiTopPeerCategory,
  ApiTopPeersResult,
} from '../../types';

import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildInputPeer, DEFAULT_PRIMITIVES } from '../gramjsBuilders';
import { addChatToLocalDb, addUserToLocalDb } from '../helpers/localDb';
import { invokeRequest } from './client';

const TOP_PEER_LIMIT = 50;

export async function fetchTopPeers({
  category,
}: {
  category: ApiTopPeerCategory;
}): Promise<ApiTopPeersResult | undefined> {
  const result = await invokeRequest(new GramJs.contacts.GetTopPeers({
    correspondents: category === 'correspondents' || undefined,
    botsInline: category === 'botsInline' || undefined,
    botsApp: category === 'botsApp' || undefined,
    botsGuestchat: category === 'botsGuestChat' || undefined,
    offset: DEFAULT_PRIMITIVES.INT,
    limit: TOP_PEER_LIMIT,
    hash: DEFAULT_PRIMITIVES.BIGINT,
  }));

  if (result instanceof GramJs.contacts.TopPeersNotModified) {
    return { type: 'unchanged' };
  }

  if (result instanceof GramJs.contacts.TopPeersDisabled) {
    return { type: 'disabled' };
  }

  if (!(result instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  result.users.forEach(addUserToLocalDb);
  result.chats.forEach((chat) => {
    if (chat instanceof GramJs.Chat || chat instanceof GramJs.Channel) {
      addChatToLocalDb(chat);
    }
  });

  const topPeerCategory = result.categories.find(({ category: mtpCategory }) => {
    return getTopPeerCategory(mtpCategory) === category;
  });

  const topPeers: ApiTopPeer[] = topPeerCategory
    ? topPeerCategory.peers.map(({ peer, rating }) => ({
      peerId: getApiChatIdFromMtpPeer(peer),
      rating,
    })) : [];

  return {
    type: 'topPeers',
    category,
    topPeers,
  };
}

export function resetTopPeerRating({ category, peer }: { category: ApiTopPeerCategory; peer: ApiPeer }) {
  return invokeRequest(new GramJs.contacts.ResetTopPeerRating({
    category: buildTopPeerCategory(category),
    peer: buildInputPeer(peer.id, peer.accessHash),
  }));
}

function getTopPeerCategory(category: GramJs.TypeTopPeerCategory): ApiTopPeerCategory | undefined {
  if (category instanceof GramJs.TopPeerCategoryCorrespondents) {
    return 'correspondents';
  }
  if (category instanceof GramJs.TopPeerCategoryBotsInline) {
    return 'botsInline';
  }
  if (category instanceof GramJs.TopPeerCategoryBotsApp) {
    return 'botsApp';
  }
  if (category instanceof GramJs.TopPeerCategoryBotsGuestChat) {
    return 'botsGuestChat';
  }

  return undefined;
}

function buildTopPeerCategory(category: ApiTopPeerCategory): GramJs.TypeTopPeerCategory {
  switch (category) {
    case 'correspondents':
      return new GramJs.TopPeerCategoryCorrespondents();
    case 'botsInline':
      return new GramJs.TopPeerCategoryBotsInline();
    case 'botsApp':
      return new GramJs.TopPeerCategoryBotsApp();
    case 'botsGuestChat':
      return new GramJs.TopPeerCategoryBotsGuestChat();
  }
}
