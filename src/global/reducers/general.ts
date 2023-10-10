import type {
  ApiChat, ApiChatFullInfo, ApiUser, ApiUserFullInfo,
} from '../../api/types';
import type { GlobalState } from '../types';

import { isUserId } from '../helpers';
import { updateChat, updateChatFullInfo } from './chats';
import { updateUser, updateUserFullInfo } from './users';

// `type` has different types in ApiChat and ApiUser
type ApiPeerSharedFields = Omit<CommonProperties<ApiChat, ApiUser>, 'type'>;
type ApiPeerFullInfoSharedFields = CommonProperties<ApiChatFullInfo, ApiUserFullInfo>;

export function updatePeer<T extends GlobalState>(
  global: T, peerId: string, peerUpdate: Partial<ApiPeerSharedFields>,
) {
  if (isUserId(peerId)) {
    return updateUser(global, peerId, peerUpdate);
  }

  return updateChat(global, peerId, peerUpdate);
}

export function updatePeerFullInfo<T extends GlobalState>(
  global: T, peerId: string, peerFullInfoUpdate: Partial<ApiPeerFullInfoSharedFields>,
) {
  if (isUserId(peerId)) {
    return updateUserFullInfo(global, peerId, peerFullInfoUpdate);
  }

  return updateChatFullInfo(global, peerId, peerFullInfoUpdate);
}
