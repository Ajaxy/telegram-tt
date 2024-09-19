import type { ApiPeer } from '../../api/types';
import type { GlobalState } from '../types';

import { selectChat } from './chats';
import { selectUser } from './users';

export function selectPeer<T extends GlobalState>(global: T, peerId: string): ApiPeer | undefined {
  return selectUser(global, peerId) || selectChat(global, peerId);
}

export function selectPeerPhotos<T extends GlobalState>(global: T, peerId: string) {
  return global.profilePhotosById[peerId];
}
