import { CHANNEL_ID_BASE } from '../../../../config';
import Api from '../../tl/api';

export default function getIdFromInputPeer(peer: Api.TypeInputPeer | Api.TypeInputChannel) {
  if (peer instanceof Api.InputPeerChannel || peer instanceof Api.InputChannel) {
    return (-peer.channelId - CHANNEL_ID_BASE).toString();
  }

  if (peer instanceof Api.InputPeerUser) {
    return peer.userId.toString();
  }

  if (peer instanceof Api.InputPeerChat) {
    return (-peer.chatId).toString();
  }

  throw Error(`Unknown peer type${peer.className}`);
}
