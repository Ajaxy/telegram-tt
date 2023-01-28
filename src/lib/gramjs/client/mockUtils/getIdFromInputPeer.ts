import Api from '../../tl/api';

export default function getIdFromInputPeer(peer: Api.TypeInputPeer | Api.TypeInputChannel) {
    if (peer instanceof Api.InputPeerChannel || peer instanceof Api.InputChannel) {
        return (Number(peer.channelId.toString()) - 1000000000).toString();
    }

    if (peer instanceof Api.InputPeerUser) {
        return peer.userId.toString();
    }

    if (peer instanceof Api.InputPeerChat) {
        return peer.chatId.toString();
    }

    throw Error(`Unknown peer type${peer.className}`);
}
