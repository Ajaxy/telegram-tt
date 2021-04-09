import { Api as GramJs } from '../../../lib/gramjs';

export function isPeerUser(peer: GramJs.TypePeer): peer is GramJs.PeerUser {
  return peer.hasOwnProperty('userId');
}

export function isPeerChat(peer: GramJs.TypePeer): peer is GramJs.PeerChat {
  return peer.hasOwnProperty('chatId');
}

export function isPeerChannel(peer: GramJs.TypePeer): peer is GramJs.PeerChannel {
  return peer.hasOwnProperty('channelId');
}

export function isInputPeerUser(peer: GramJs.TypeInputPeer): peer is GramJs.InputPeerUser {
  return peer.hasOwnProperty('userId');
}

export function isInputPeerChat(peer: GramJs.TypeInputPeer): peer is GramJs.InputPeerChat {
  return peer.hasOwnProperty('chatId');
}

export function isInputPeerChannel(peer: GramJs.TypeInputPeer): peer is GramJs.InputPeerChannel {
  return peer.hasOwnProperty('channelId');
}
